import { GoogleGenerativeAI, GenerativeModel, GenerateContentResult } from "@google/generative-ai";
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

  constructor(primaryApiKey: string, pageType: 'odd' | 'even', backupKeys: string[] = []) {
    if (!primaryApiKey) {
      throw new Error(`GEMINI_API_KEY_${pageType.toUpperCase()} environment variable is required`);
    }

    this.pageType = pageType;
    this.keyPool = new GeminiKeyPool(pageType, primaryApiKey, backupKeys);
    
    // Initialize with first available key
    this.initializeWithNextKey();
  }

  private initializeWithNextKey(): boolean {
    const apiKey = this.keyPool.getNextAvailableKey();
    if (!apiKey) {
      console.error(`[GeminiService] No available keys for ${this.pageType} pages`);
      return false;
    }

    if (this.currentApiKey === apiKey) {
      return true; // Already using this key
    }

    try {
      this.currentApiKey = apiKey;
      const genAI = new GoogleGenerativeAI(apiKey);
      this.currentModel = genAI.getGenerativeModel({ 
        model: "gemini-2.0-flash-exp",
        generationConfig: {
          temperature: 0.1,
          topK: 1,
          topP: 0.8,
          maxOutputTokens: 8192,
        }
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
   * @param abortSignal - The signal to abort the operation
   * @returns The generated content result
   * @throws Error if generation times out or fails after retries
   */
  public async generateContent(prompt: string, timeout: number = 30000, abortSignal?: AbortSignal): Promise<GenerateContentResult> {
    const maxRetries = 3;
    const baseDelay = 1000; // 1 second
    const startTime = Date.now();

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      CancellationManager.throwIfCancelled(abortSignal, `Gemini content generation attempt ${attempt}`);

      // Ensure we have a valid model with an available key
      if (!this.currentModel || !this.currentApiKey) {
        if (!this.initializeWithNextKey()) {
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
              maxOutputTokens: 8192,
              candidateCount: 1,
            },
          }, {
            signal: abortSignal
          }),
          new Promise((_, reject) => {
            const timeoutId = setTimeout(() => reject(new Error('Translation timeout')), timeout);
            if (abortSignal) {
              abortSignal.addEventListener('abort', () => {
                clearTimeout(timeoutId);
                reject(new Error('Translation cancelled'));
              });
            }
          })
        ]) as Promise<GenerateContentResult>;

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
              // No other keys available, wait with exponential backoff
              const delay = baseDelay * Math.pow(2, attempt - 1);
              console.log(`[GeminiService] No backup keys available, waiting ${delay}ms before retry`);
              
              // Create a cancellable delay
              await new Promise<void>((resolve, reject) => {
                const timeoutId = setTimeout(resolve, delay);
                CancellationManager.throwIfCancelled(abortSignal, 'rate limit backoff');
                if (abortSignal) {
                  abortSignal.addEventListener('abort', () => {
                    clearTimeout(timeoutId);
                    reject(new Error('Translation cancelled during backoff'));
                  });
                }
              });
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
