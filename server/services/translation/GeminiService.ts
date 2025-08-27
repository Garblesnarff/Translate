import { GoogleGenerativeAI, GenerativeModel, GenerateContentResult } from "@google/generative-ai";

/**
 * Service responsible for managing Gemini AI model configuration and generation
 */
export class GeminiService {
  private genAI: GoogleGenerativeAI;
  private model: GenerativeModel;
  private pageType: 'odd' | 'even';

  constructor(apiKey: string, pageType: 'odd' | 'even') {
    if (!apiKey) {
      throw new Error(`GEMINI_API_KEY_${pageType.toUpperCase()} environment variable is required`);
    }

    this.pageType = pageType;
    this.genAI = new GoogleGenerativeAI(apiKey);
    this.model = this.genAI.getGenerativeModel({ 
      model: "gemini-2.0-flash-exp",
      generationConfig: {
        temperature: 0.1,
        topK: 1,
        topP: 0.8,
        maxOutputTokens: 8192,
      }
    });
  }

  /**
   * Generates content using the Gemini AI model with timeout handling and retry logic
   * @param prompt - The prompt to generate content from
   * @param timeout - Maximum time to wait for generation in milliseconds
   * @returns The generated content result
   * @throws Error if generation times out or fails after retries
   */
  public async generateContent(prompt: string, timeout: number = 30000): Promise<GenerateContentResult> {
    const maxRetries = 3;
    const baseDelay = 1000; // 1 second

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await Promise.race([
          this.model.generateContent({
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
          }),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Translation timeout')), timeout)
          )
        ]) as Promise<GenerateContentResult>;
      } catch (error) {
        // Check if it's a rate limit error
        if (error instanceof Error && error.message.includes('429')) {
          console.log(`[GeminiService] Rate limit hit on attempt ${attempt}/${maxRetries} for ${this.pageType} pages, retrying...`);
          
          if (attempt === maxRetries) {
            throw error; // Re-throw on final attempt
          }
          
          // Exponential backoff: 1s, 2s, 4s
          const delay = baseDelay * Math.pow(2, attempt - 1);
          await new Promise(resolve => setTimeout(resolve, delay));
        } else {
          // For non-rate-limit errors, throw immediately
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

// Create two separate instances for odd and even pages
export const oddPagesGeminiService = new GeminiService(process.env.GEMINI_API_KEY_ODD || '', 'odd');
export const evenPagesGeminiService = new GeminiService(process.env.GEMINI_API_KEY_EVEN || '', 'even');
