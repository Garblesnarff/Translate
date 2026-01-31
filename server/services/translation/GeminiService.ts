import { GoogleGenerativeAI, GenerativeModel, GenerateContentResult, HarmCategory, HarmBlockThreshold } from "@google/generative-ai";
import { GeminiKeyPool } from './GeminiKeyPool';
import { CancellationManager } from '../CancellationManager';

/**
 * Service responsible for managing Gemini AI model configuration and generation with failover
 */
export class GeminiService {
  private keyPool: GeminiKeyPool;
  private pageType: 'odd' | 'even';
  private currentModel: GenerativeModel | null = null;
  private currentApiKey: string | null = null;

  // Standard safety settings to prevent silent truncation of historical content
  private readonly safetySettings = [
    { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
  ];

  constructor(primaryApiKey: string, pageType: 'odd' | 'even', backupKeys: string[] = []) {
    if (!primaryApiKey) {
      throw new Error(`GEMINI_API_KEY_${pageType.toUpperCase()} environment variable is required`);
    }

    this.pageType = pageType;
    this.keyPool = new GeminiKeyPool(pageType, primaryApiKey, backupKeys);
    
    // Initialize with first available key
    this.initializeWithNextKey();
  }

  private initializeWithNextKey(modelId: string = "gemini-3-flash-preview"): boolean {
    const apiKey = this.keyPool.getNextAvailableKey();
    if (!apiKey) {
      console.error(`[GeminiService] No available keys for ${this.pageType} pages`);
      return false;
    }

    // If key hasn't changed AND model hasn't changed, skip
    // We check if currentModel's config matches the requested modelId if possible
    // but for simplicity we'll re-initialize if modelId is provided and different

    try {
      this.currentApiKey = apiKey;
      const genAI = new GoogleGenerativeAI(apiKey);
      this.currentModel = genAI.getGenerativeModel({ 
        model: modelId,
        generationConfig: {
          temperature: 0.1,
          topK: 1,
          topP: 0.8,
          // Removed maxOutputTokens cap - let model use full capacity
          // 8192 was causing MAX_TOKENS truncation on longer translations
        },
        safetySettings: this.safetySettings
      });
      return true;
    } catch (error) {
      console.error(`[GeminiService] Failed to initialize with key for ${this.pageType}:`, error);
      return false;
    }
  }

  /**
   * Generates content using the Gemini AI model with timeout handling and failover
   * @param prompt - The prompt to generate content from
   * @param timeout - Maximum time to wait for generation in milliseconds
   * @param abortSignal - Signal to abort the operation
   * @param mimeType - Optional response MIME type (e.g. "application/json")
   * @param modelId - Optional model ID to use (overrides default)
   * @returns The generated content result
   * @throws Error if generation times out or fails after retries
   */
  public async generateContent(
    prompt: string, 
    timeout: number = 30000, 
    abortSignal?: AbortSignal,
    mimeType: string = "text/plain",
    modelId: string = "gemini-3-flash-preview"
  ): Promise<GenerateContentResult> {
    const maxRetries = 3;
    const baseDelay = 1000; // 1 second
    const startTime = Date.now();

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      // Check for cancellation before each attempt
      CancellationManager.throwIfCancelled(abortSignal, `Gemini attempt ${attempt}`);
      
      // Ensure we have a valid model with an available key or if modelId changed
      if (!this.currentModel || !this.currentApiKey) {
        if (!this.initializeWithNextKey(modelId)) {
          throw new Error(`No available Gemini keys for ${this.pageType} pages`);
        }
      }

      try {
        const result = await Promise.race([
          this.currentModel!.generateContent({
            contents: [{ 
              role: "user", 
              parts: [{ text: prompt }]
            }],
            generationConfig: {
              temperature: 0.1,
              topK: 1,
              topP: 0.8,
              // Removed maxOutputTokens cap - let model use full capacity
              candidateCount: 1,
              responseMimeType: mimeType,
            },
            safetySettings: this.safetySettings
          }),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Translation timeout')), timeout)
          )
        ]) as GenerateContentResult;

        // Check for truncation/safety blocks
        const candidate = result.response.candidates?.[0];
        if (candidate?.finishReason && candidate.finishReason !== 'STOP') {
          const reason = candidate.finishReason;
          console.warn(`[GeminiService] Response terminated early! Reason: ${reason}`);
          
          if (reason === 'MAX_TOKENS') {
            throw new Error('Gemini output truncated (MAX_TOKENS)');
          }
          if (reason === 'SAFETY') {
            throw new Error('Gemini output blocked by safety filters');
          }
          // For other reasons, we still might want to treat it as a failure if no text is returned
          if (!result.response.text()) {
            throw new Error(`Gemini failed to return text. Reason: ${reason}`);
          }
        }

        // Record successful call
        const responseTime = Date.now() - startTime;
        this.keyPool.recordSuccessfulCall(this.currentApiKey!, responseTime);
        
        return result;

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        
        // Handle rate limit errors
        if (errorMessage.includes('429') || errorMessage.includes('rate_limit_exceeded')) {
          console.warn(`[GeminiService] Rate limit hit on ${this.pageType} key, attempt ${attempt}/${maxRetries}`);
          
          // Mark current key as rate-limited
          if (this.currentApiKey) {
            this.keyPool.markKeyAsRateLimited(this.currentApiKey, error);
          }
          
          // Try to get a different key for next attempt
          if (attempt < maxRetries) {
            const newKey = this.keyPool.getNextAvailableKey();
            if (newKey && newKey !== this.currentApiKey) {
              console.log(`[GeminiService] Switching to backup key for ${this.pageType} pages`);
              this.currentApiKey = null; // Force re-initialization
              this.currentModel = null;
              continue; // Try with new key immediately
            } else {
              // No other keys available, don't wait if it's pointless
              console.warn(`[GeminiService] No backup keys available for ${this.pageType} pool`);
              throw new Error(`Rate limit exceeded and no backup keys available for ${this.pageType} pages`);
            }
          }
        } 
        // Handle authentication or permanent errors
        else if (errorMessage.includes('401') || errorMessage.includes('403') || errorMessage.includes('API key')) {
          console.error(`[GeminiService] Authentication error for ${this.pageType}:`, errorMessage);
          
          if (this.currentApiKey) {
            this.keyPool.markKeyAsDisabled(this.currentApiKey, 'Authentication failed');
          }
          
          // Try to get another key
          if (!this.initializeWithNextKey()) {
            throw new Error(`All Gemini keys failed authentication for ${this.pageType} pages`);
          }
        }
        // For other errors, throw immediately if it's the last attempt
        else if (attempt === maxRetries) {
          throw error;
        }
      }
    }
    
    throw new Error('Max retries exceeded');
  }

  public getPageType(): 'odd' | 'even' {
    return this.pageType;
  }
}

// Create two separate instances for odd and even pages with backup keys
export const oddPagesGeminiService = new GeminiService(
  process.env.GEMINI_API_KEY_ODD || '', 
  'odd',
  [process.env.GEMINI_API_KEY_BACKUP_1 || '', process.env.GEMINI_API_KEY_BACKUP_2 || '']
);
export const evenPagesGeminiService = new GeminiService(
  process.env.GEMINI_API_KEY_EVEN || '', 
  'even', 
  [process.env.GEMINI_API_KEY_BACKUP_1 || '', process.env.GEMINI_API_KEY_BACKUP_2 || '']
);
