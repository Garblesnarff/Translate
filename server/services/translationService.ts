import { GenerateContentResult } from "@google/generative-ai";
import { TibetanDictionary } from '../dictionary';
import { TibetanTextProcessor } from './textProcessing/TextProcessor';
import { PromptGenerator } from './translation/PromptGenerator';
import { oddPagesGeminiService, evenPagesGeminiService } from './translation/GeminiService';
import { createTranslationError } from '../middleware/errorHandler';

export class TranslationService {
  private promptGenerator: PromptGenerator;
  private dictionary: TibetanDictionary;
  private textProcessor: TibetanTextProcessor;

  /**
   * Initializes the translation service with required dependencies
   */
  constructor() {
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
   * Get the appropriate Gemini service based on page number
   */
  private getGeminiService(pageNumber: number) {
    return pageNumber % 2 === 0 ? evenPagesGeminiService : oddPagesGeminiService;
  }

  /**
   * Processes a translation request with error handling and retries
   */
  public async translateText(chunk: { pageNumber: number; content: string }, timeout: number = 60000): Promise<{
    translation: string;
    confidence: number;
  }> {
    try {
      const geminiService = this.getGeminiService(chunk.pageNumber);
      const prompt = await this.promptGenerator.createTranslationPrompt(chunk.pageNumber, chunk.content);
      const result = await geminiService.generateContent(prompt, timeout);

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
