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
import { TranslationChunk, TranslationConfig, GeminiTranslationResult } from './types';

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
   * @param abortSignal - Optional abort signal for cancellation
   * @returns Promise with translation result and confidence
   */
  public async performInitialTranslation(
    chunk: TranslationChunk,
    config: TranslationConfig,
    iteration: number,
    abortSignal?: AbortSignal
  ): Promise<GeminiTranslationResult> {
    const geminiService = this.getGeminiService(chunk.pageNumber);

    const promptOptions: PromptOptions = {
      iterationPass: iteration,
      useChainOfThought: config.useChainOfThought,
      contextWindow: config.contextWindow
    };

    const prompt = await this.promptGenerator.createTranslationPrompt(
      chunk.pageNumber,
      chunk.content,
      promptOptions,
      chunk.context
    );

    // Check for cancellation before making the API call
    CancellationManager.throwIfCancelled(abortSignal, 'Gemini API call');

    const result = await geminiService.generateContent(prompt, config.timeout, abortSignal);
    const response = await result.response;
    const rawTranslation = response.text();

    // Enhanced confidence calculation
    const confidence = await calculateEnhancedConfidence(rawTranslation, chunk.content);

    return {
      translation: rawTranslation,
      confidence
    };
  }

  /**
   * Performs a refinement pass focusing on specific quality issues
   *
   * @param originalText - The original Tibetan text
   * @param previousTranslation - The translation to be improved
   * @param focusAreas - List of quality issues to address
   * @param pageNumber - The page number for service selection
   * @param config - Translation configuration
   * @param abortSignal - Optional abort signal
   * @returns Promise with refined translation result
   */
  public async performRefinementPass(
    originalText: string,
    previousTranslation: string,
    focusAreas: string[],
    pageNumber: number,
    config: TranslationConfig,
    abortSignal?: AbortSignal
  ): Promise<GeminiTranslationResult> {
    const geminiService = this.getGeminiService(pageNumber);

    const prompt = this.promptGenerator.createRefinementPrompt(
      originalText,
      previousTranslation,
      focusAreas
    );

    // Check for cancellation before making the API call
    CancellationManager.throwIfCancelled(abortSignal, 'Gemini refinement call');

    const result = await geminiService.generateContent(prompt, config.timeout, abortSignal);
    const response = await result.response;
    const rawTranslation = response.text();

    // Enhanced confidence calculation
    const confidence = await calculateEnhancedConfidence(rawTranslation, originalText);

    return {
      translation: rawTranslation,
      confidence
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
}
