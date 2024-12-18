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
   * Generates content using the Gemini AI model with timeout handling
   * @param prompt - The prompt to generate content from
   * @param timeout - Maximum time to wait for generation in milliseconds
   * @returns The generated content result
   * @throws Error if generation times out or fails
   */
  public async generateContent(prompt: string, timeout: number = 30000): Promise<GenerateContentResult> {
    return Promise.race([
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
  }

  public getPageType(): 'odd' | 'even' {
    return this.pageType;
  }
}

// Create two separate instances for odd and even pages
export const oddPagesGeminiService = new GeminiService(process.env.GEMINI_API_KEY_ODD || '', 'odd');
export const evenPagesGeminiService = new GeminiService(process.env.GEMINI_API_KEY_EVEN || '', 'even');
