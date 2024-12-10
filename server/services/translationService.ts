import { GoogleGenerativeAI, GenerateContentResult } from "@google/generative-ai";
import { TibetanDictionary } from '../dictionary';
import { TibetanTextProcessor } from './textProcessing/TextProcessor';
import { PromptGenerator } from './translation/PromptGenerator';
import { createTranslationError } from '../middleware/errorHandler';

export class TranslationService {
  private genAI: GoogleGenerativeAI;
  private model: ReturnType<GoogleGenerativeAI['getGenerativeModel']>;
  private promptGenerator: PromptGenerator;
  private dictionary: TibetanDictionary;
  private textProcessor: TibetanTextProcessor;

  /**
   * Initializes the translation service with required dependencies
   */
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
    
    this.dictionary = new TibetanDictionary();
    this.promptGenerator = new PromptGenerator(this.dictionary);
    this.textProcessor = new TibetanTextProcessor({
      preserveSanskrit: true,
      formatLineages: true,
      enhancedSpacing: true,
      handleHonorifics: true
    });
  }

  /**
   * Calculates confidence score based on dictionary term usage in translation
   * @param translation - The translated text to analyze
   * @returns A confidence score between 0 and 1
   */
  private calculateConfidence(translation: string): number {
    const dictionaryTerms = translation.match(/\([^)]+\)/g) || [];
    return Math.min(0.95, 0.7 + (dictionaryTerms.length * 0.05));
  }

  /**
   * Processes a translation request with error handling and retries
   */
  public async translateText(chunk: { pageNumber: number; content: string }, timeout: number = 30000): Promise<{
    translation: string;
    confidence: number;
  }> {
    try {
      const prompt = await this.promptGenerator.createTranslationPrompt(chunk.pageNumber, chunk.content);
      const result = await Promise.race([
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
        }) as Promise<GenerateContentResult>,
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Translation timeout')), timeout)
        )
      ]) as GenerateContentResult;

      const response = await result.response;
      const rawTranslation = response.text();
      
      // Calculate confidence based on dictionary term usage
      const dictionaryTerms = rawTranslation.match(/\([^)]+\)/g) || [];
      const confidence = Math.min(0.95, 0.7 + (dictionaryTerms.length * 0.05));

      const processedTranslation = this.textProcessor.processText(rawTranslation);

      return {
        translation: processedTranslation,
        confidence
      };
    } catch (error) {
      throw createTranslationError(
        error instanceof Error ? error.message : 'Translation failed',
        'TRANSLATION_ERROR',
        500,
        error
      );
    }
  }
}

export const translationService = new TranslationService();
