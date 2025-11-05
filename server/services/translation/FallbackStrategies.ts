/**
 * Fallback Strategies
 *
 * Provides multiple fallback strategies when primary translation methods fail.
 * Includes simpler prompts, alternative models, chunking strategies, and manual intervention.
 *
 * @author Translation Service Team
 */

import { PromptGenerator } from './PromptGenerator';
import { GeminiService } from './GeminiService';
import { multiProviderAIService } from './MultiProviderAIService';
import { TranslationChunk, TranslationConfig } from './types';
import { calculateEnhancedConfidence } from './confidence';

/**
 * Fallback strategy type
 */
export enum FallbackStrategy {
  SIMPLER_PROMPT = 'SIMPLER_PROMPT',       // Use simpler prompt without examples
  ALTERNATIVE_MODEL = 'ALTERNATIVE_MODEL', // Try alternative AI model
  SMALLER_CHUNKS = 'SMALLER_CHUNKS',       // Split into smaller chunks
  BASIC_PROMPT = 'BASIC_PROMPT',           // Absolute minimal prompt
  MANUAL_INTERVENTION = 'MANUAL_INTERVENTION' // Flag for human review
}

/**
 * Fallback result
 */
export interface FallbackResult {
  success: boolean;
  translation?: string;
  confidence?: number;
  strategyUsed?: FallbackStrategy;
  error?: Error;
  requiresManualIntervention?: boolean;
}

/**
 * FallbackStrategies - Handles fallback logic when primary translation fails
 */
export class FallbackStrategies {
  private promptGenerator: PromptGenerator;
  private geminiService: GeminiService;

  constructor(promptGenerator: PromptGenerator, geminiService: GeminiService) {
    this.promptGenerator = promptGenerator;
    this.geminiService = geminiService;
  }

  /**
   * Execute fallback strategies in order until one succeeds
   */
  public async executeFallbackCascade(
    chunk: TranslationChunk,
    config: TranslationConfig,
    originalError: Error,
    abortSignal?: AbortSignal
  ): Promise<FallbackResult> {
    console.log(`[FallbackStrategies] Starting fallback cascade for page ${chunk.pageNumber}`);

    // Strategy 1: Simpler prompt (remove chain-of-thought, reduce examples)
    try {
      console.log('[FallbackStrategies] Trying strategy 1: Simpler prompt');
      const result = await this.trySimplerPrompt(chunk, config, abortSignal);
      if (result.success) {
        console.log('[FallbackStrategies] Simpler prompt succeeded');
        return result;
      }
    } catch (error) {
      console.warn('[FallbackStrategies] Simpler prompt failed:', (error as Error).message);
    }

    // Strategy 2: Alternative model (if available)
    if (multiProviderAIService.isAvailable()) {
      try {
        console.log('[FallbackStrategies] Trying strategy 2: Alternative model');
        const result = await this.tryAlternativeModel(chunk, config, abortSignal);
        if (result.success) {
          console.log('[FallbackStrategies] Alternative model succeeded');
          return result;
        }
      } catch (error) {
        console.warn('[FallbackStrategies] Alternative model failed:', (error as Error).message);
      }
    }

    // Strategy 3: Basic prompt (absolute minimal)
    try {
      console.log('[FallbackStrategies] Trying strategy 3: Basic prompt');
      const result = await this.tryBasicPrompt(chunk, config, abortSignal);
      if (result.success) {
        console.log('[FallbackStrategies] Basic prompt succeeded');
        return result;
      }
    } catch (error) {
      console.warn('[FallbackStrategies] Basic prompt failed:', (error as Error).message);
    }

    // Strategy 4: Smaller chunks (split the text)
    if (chunk.content.length > 500) {
      try {
        console.log('[FallbackStrategies] Trying strategy 4: Smaller chunks');
        const result = await this.trySmallerChunks(chunk, config, abortSignal);
        if (result.success) {
          console.log('[FallbackStrategies] Smaller chunks succeeded');
          return result;
        }
      } catch (error) {
        console.warn('[FallbackStrategies] Smaller chunks failed:', (error as Error).message);
      }
    }

    // Strategy 5: Manual intervention required
    console.log('[FallbackStrategies] All strategies failed, flagging for manual intervention');
    return this.flagForManualIntervention(chunk, originalError);
  }

  /**
   * Strategy 1: Try simpler prompt without chain-of-thought and fewer examples
   */
  private async trySimplerPrompt(
    chunk: TranslationChunk,
    config: TranslationConfig,
    abortSignal?: AbortSignal
  ): Promise<FallbackResult> {
    try {
      // Create simpler prompt - no chain-of-thought, fewer examples
      const simplifiedConfig = {
        ...config,
        useChainOfThought: false,
        timeout: config.timeout
      };

      const prompt = await this.promptGenerator.createTranslationPrompt(
        chunk.pageNumber,
        chunk.content,
        {
          iterationPass: 1,
          useChainOfThought: false,
          contextWindow: 1  // Minimal context
        },
        chunk.context
      );

      const result = await this.geminiService.generateContent(
        prompt,
        simplifiedConfig.timeout,
        abortSignal
      );

      const response = await result.response;
      const translation = response.text();
      const confidence = await calculateEnhancedConfidence(translation, chunk.content);

      return {
        success: true,
        translation,
        confidence,
        strategyUsed: FallbackStrategy.SIMPLER_PROMPT
      };
    } catch (error) {
      return {
        success: false,
        error: error as Error,
        strategyUsed: FallbackStrategy.SIMPLER_PROMPT
      };
    }
  }

  /**
   * Strategy 2: Try alternative AI model (GPT-4, Claude, etc.)
   */
  private async tryAlternativeModel(
    chunk: TranslationChunk,
    config: TranslationConfig,
    abortSignal?: AbortSignal
  ): Promise<FallbackResult> {
    try {
      // Note: We don't have access to dictionary context here without injecting dictionary
      // For now, we'll use an empty context
      const dictionaryContext = '';

      // Try getting translation from alternative providers
      const responses = await multiProviderAIService.getMultiProviderTranslations(
        chunk.content,
        dictionaryContext,
        1  // Just need one successful response
      );

      if (responses.length > 0) {
        const bestResponse = responses[0];  // Already sorted by confidence
        return {
          success: true,
          translation: bestResponse.translation,
          confidence: bestResponse.confidence,
          strategyUsed: FallbackStrategy.ALTERNATIVE_MODEL
        };
      }

      return {
        success: false,
        error: new Error('No alternative models available'),
        strategyUsed: FallbackStrategy.ALTERNATIVE_MODEL
      };
    } catch (error) {
      return {
        success: false,
        error: error as Error,
        strategyUsed: FallbackStrategy.ALTERNATIVE_MODEL
      };
    }
  }

  /**
   * Strategy 3: Try absolute basic prompt
   */
  private async tryBasicPrompt(
    chunk: TranslationChunk,
    config: TranslationConfig,
    abortSignal?: AbortSignal
  ): Promise<FallbackResult> {
    try {
      // Create the most basic prompt possible
      const basicPrompt = this.createBasicPrompt(chunk.content);

      const result = await this.geminiService.generateContent(
        basicPrompt,
        config.timeout,
        abortSignal
      );

      const response = await result.response;
      const translation = response.text();
      const confidence = await calculateEnhancedConfidence(translation, chunk.content);

      return {
        success: true,
        translation,
        confidence,
        strategyUsed: FallbackStrategy.BASIC_PROMPT
      };
    } catch (error) {
      return {
        success: false,
        error: error as Error,
        strategyUsed: FallbackStrategy.BASIC_PROMPT
      };
    }
  }

  /**
   * Strategy 4: Split into smaller chunks and translate separately
   */
  private async trySmallerChunks(
    chunk: TranslationChunk,
    config: TranslationConfig,
    abortSignal?: AbortSignal
  ): Promise<FallbackResult> {
    try {
      console.log(`[FallbackStrategies] Splitting chunk into smaller pieces`);

      // Split text by sentences or paragraphs
      const subChunks = this.splitIntoSmallerChunks(chunk.content);

      if (subChunks.length <= 1) {
        throw new Error('Cannot split chunk further');
      }

      console.log(`[FallbackStrategies] Split into ${subChunks.length} sub-chunks`);

      // Translate each sub-chunk
      const translations: string[] = [];
      const confidences: number[] = [];

      for (let i = 0; i < subChunks.length; i++) {
        const subChunk = subChunks[i];

        const prompt = await this.promptGenerator.createTranslationPrompt(
          chunk.pageNumber,
          subChunk,
          {
            iterationPass: 1,
            useChainOfThought: false,
            contextWindow: 0
          }
        );

        const result = await this.geminiService.generateContent(
          prompt,
          config.timeout,
          abortSignal
        );

        const response = await result.response;
        const translation = response.text();
        const confidence = await calculateEnhancedConfidence(translation, subChunk);

        translations.push(translation);
        confidences.push(confidence);
      }

      // Combine translations
      const combinedTranslation = translations.join('\n\n');
      const averageConfidence = confidences.reduce((a, b) => a + b, 0) / confidences.length;

      return {
        success: true,
        translation: combinedTranslation,
        confidence: averageConfidence,
        strategyUsed: FallbackStrategy.SMALLER_CHUNKS
      };
    } catch (error) {
      return {
        success: false,
        error: error as Error,
        strategyUsed: FallbackStrategy.SMALLER_CHUNKS
      };
    }
  }

  /**
   * Strategy 5: Flag for manual intervention
   */
  private flagForManualIntervention(
    chunk: TranslationChunk,
    originalError: Error
  ): FallbackResult {
    console.log(`[FallbackStrategies] Flagging page ${chunk.pageNumber} for manual intervention`);

    return {
      success: false,
      error: originalError,
      strategyUsed: FallbackStrategy.MANUAL_INTERVENTION,
      requiresManualIntervention: true
    };
  }

  /**
   * Create basic prompt without any enhancements
   */
  private createBasicPrompt(tibetanText: string): string {
    return `Translate the following Tibetan text to English.
Preserve the Tibetan text in parentheses after each English translation.
Format: English translation (Tibetan text)

Tibetan Text:
${tibetanText}

Translation:`;
  }

  /**
   * Split text into smaller chunks
   */
  private splitIntoSmallerChunks(text: string): string[] {
    // Try to split by double line breaks (paragraphs)
    const paragraphs = text.split(/\n\n+/).filter(p => p.trim().length > 0);

    if (paragraphs.length > 1) {
      return paragraphs;
    }

    // Try to split by Tibetan shad (།)
    const sentences = text.split(/།\s*/).filter(s => s.trim().length > 0);

    if (sentences.length > 1) {
      // Add shad back to sentences
      return sentences.map(s => s.trim() + '།');
    }

    // Try to split by single line breaks
    const lines = text.split(/\n/).filter(l => l.trim().length > 0);

    if (lines.length > 1) {
      return lines;
    }

    // Cannot split further - split by character count as last resort
    const chunkSize = Math.ceil(text.length / 2);
    return [
      text.substring(0, chunkSize),
      text.substring(chunkSize)
    ];
  }

  /**
   * Try a specific fallback strategy
   */
  public async tryStrategy(
    strategy: FallbackStrategy,
    chunk: TranslationChunk,
    config: TranslationConfig,
    abortSignal?: AbortSignal
  ): Promise<FallbackResult> {
    switch (strategy) {
      case FallbackStrategy.SIMPLER_PROMPT:
        return this.trySimplerPrompt(chunk, config, abortSignal);

      case FallbackStrategy.ALTERNATIVE_MODEL:
        return this.tryAlternativeModel(chunk, config, abortSignal);

      case FallbackStrategy.BASIC_PROMPT:
        return this.tryBasicPrompt(chunk, config, abortSignal);

      case FallbackStrategy.SMALLER_CHUNKS:
        return this.trySmallerChunks(chunk, config, abortSignal);

      case FallbackStrategy.MANUAL_INTERVENTION:
        return {
          success: false,
          strategyUsed: FallbackStrategy.MANUAL_INTERVENTION,
          requiresManualIntervention: true
        };

      default:
        throw new Error(`Unknown fallback strategy: ${strategy}`);
    }
  }
}
