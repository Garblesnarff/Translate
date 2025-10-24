/**
 * Gemini Translation Service
 *
 * Handles initial translation using Gemini AI service.
 * This service encapsulates the logic for performing the first translation pass
 * with proper dependency injection and improved testability.
 *
 * @author Translation Service Team
 */

import { PromptGenerator, PromptOptions } from './PromptGenerator';
import { GeminiService } from './GeminiService';
import { CancellationManager } from '../CancellationManager';
import { calculateEnhancedConfidence } from './confidence';
import { TranslationChunk, TranslationConfig, GeminiTranslationResult, Glossary, ReferenceTranslation } from './types';

/**
 * Service for handling initial Gemini translations
 */
export class GeminiTranslationService {
  private readonly promptGenerator: PromptGenerator;
  private readonly oddPagesGeminiService: GeminiService;
  private readonly evenPagesGeminiService: GeminiService;

  /**
   * Creates a new GeminiTranslationService instance
   *
   * @param promptGenerator - The prompt generator for creating translation prompts
   * @param oddPagesGeminiService - Gemini service for odd-numbered pages
   * @param evenPagesGeminiService - Gemini service for even-numbered pages
   */
  constructor(
    promptGenerator: PromptGenerator,
    oddPagesGeminiService: GeminiService,
    evenPagesGeminiService: GeminiService
  ) {
    this.promptGenerator = promptGenerator;
    this.oddPagesGeminiService = oddPagesGeminiService;
    this.evenPagesGeminiService = evenPagesGeminiService;
  }

  /**
   * Performs initial Gemini translation
   *
   * @param chunk - The translation chunk to process
   * @param config - Translation configuration
   * @param iteration - Current iteration number (usually 1 for initial)
   * @param abortSignal - The signal to abort the operation
   * @returns Promise with translation result and confidence
   */
  public async performInitialTranslation(
    chunk: TranslationChunk,
    config: TranslationConfig,
    referenceTranslations: ReferenceTranslation[],
    iteration: number,
    abortSignal?: AbortSignal
  ): Promise<GeminiTranslationResult> {
    CancellationManager.throwIfCancelled(abortSignal, 'initial translation');

    const geminiService = this.getGeminiService(chunk.pageNumber);

    const promptOptions: PromptOptions = {
      iterationPass: iteration,
      useChainOfThought: config.useChainOfThought,
      contextWindow: config.contextWindow,
      referenceTranslations
    };

    const prompt = await this.promptGenerator.createTranslationPrompt(
      chunk.pageNumber,
      chunk.content,
      promptOptions,
      chunk.context
    );

    const result = await geminiService.generateContent(prompt, config.timeout, abortSignal);
    const response = await result.response;
    const rawTranslation = response.text();

    // Enhanced confidence calculation
    const confidence = calculateEnhancedConfidence(rawTranslation, chunk.content);

    // Extract glossary
    const glossary = await this.extractGlossary(chunk.content, abortSignal);

    return {
      translation: rawTranslation,
      confidence,
      glossary
    };
  }

  /**
   * Get the appropriate Gemini service based on page number
   *
   * @param pageNumber - The page number to determine service for
   * @returns The appropriate Gemini service instance
   */
  private getGeminiService(pageNumber: number): GeminiService {
    return pageNumber % 2 === 0 ? this.evenPagesGeminiService : this.oddPagesGeminiService;
  }

  /**
   * Extracts a glossary of key terms from the text.
   * @param text The text to extract terms from.
   * @param abortSignal The signal to abort the operation
   * @returns A promise that resolves to a glossary object.
   */
  public async extractGlossary(text: string, abortSignal?: AbortSignal): Promise<Glossary> {
    CancellationManager.throwIfCancelled(abortSignal, 'glossary extraction');
    const geminiService = this.oddPagesGeminiService; // Use a single service for consistency
    const prompt = this.promptGenerator.createGlossaryExtractionPrompt(text);

    const result = await geminiService.generateContent(prompt, 30000, abortSignal);
    const response = await result.response;
    const rawGlossary = response.text();

    try {
      return JSON.parse(rawGlossary);
    } catch (error) {
      console.error("Failed to parse glossary:", error);
      return {};
    }
  }
}
