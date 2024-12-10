import { GoogleGenerativeAI, GenerativeModel, GenerateContentResult } from "@google/generative-ai";

/**
 * Service responsible for managing Gemini AI model configuration and generation
 */
export class GeminiService {
  private genAI: GoogleGenerativeAI;
  private model: GenerativeModel;

  constructor() {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY environment variable is required');
    }

    this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    this.model = this.genAI.getGenerativeModel({ 
      model: "gemini-1.5-flash-8b",
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
}

export const geminiService = new GeminiService();
