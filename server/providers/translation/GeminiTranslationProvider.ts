/**
 * GeminiTranslationProvider - Google Gemini Translation Integration
 *
 * Provides AI-powered translation using Google's Gemini 2.5 Flash-Lite model.
 * Features:
 * - Streaming support for real-time updates
 * - Batch processing (5 chunks in parallel)
 * - Retry logic with exponential backoff (3 retries)
 * - Rate limit handling
 * - Confidence scoring
 * - 40% faster than 2.0 (887 tokens/sec)
 *
 * @module server/providers/translation/GeminiTranslationProvider
 */

import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';
import type { TranslationProvider, TranslationResult } from '../../core/interfaces.js';
import { TranslationError, ErrorCode, RetryConfig } from '../../../shared/types.js';

/**
 * Configuration for Gemini Translation Provider
 */
export interface GeminiTranslationConfig {
  /** Google Gemini API key */
  apiKey: string;

  /** Model name (default: gemini-2.5-flash-lite) */
  model?: string;

  /** Temperature for generation (default: 0.3) */
  temperature?: number;

  /** Maximum tokens to generate (default: 4000) */
  maxTokens?: number;

  /** Maximum parallel batch requests (default: 5) */
  maxParallelRequests?: number;

  /** Retry configuration */
  retry?: RetryConfig;
}

/**
 * Default retry configuration
 */
const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 60000,
  exponentialBackoff: true,
  backoffMultiplier: 2,
  jitter: true,
};

/**
 * Google Gemini translation provider implementation.
 *
 * @example
 * ```typescript
 * const provider = new GeminiTranslationProvider({
 *   apiKey: process.env.GEMINI_API_KEY!,
 *   model: 'gemini-2.5-flash-lite',
 *   temperature: 0.3,
 *   maxTokens: 4000
 * });
 *
 * const result = await provider.translate(
 *   'བཀྲ་ཤིས་བདེ་ལེགས།',
 *   'Translate to English and preserve Tibetan in parentheses...'
 * );
 * console.log(result.translation); // "Greetings (བཀྲ་ཤིས་བདེ་ལེགས།)."
 * ```
 */
export class GeminiTranslationProvider implements TranslationProvider {
  /** Gemini supports streaming */
  public readonly supportsStreaming = true;

  private client: GoogleGenerativeAI;
  private modelName: string;
  private temperature: number;
  private maxTokens: number;
  private maxParallelRequests: number;
  private retryConfig: RetryConfig;

  /**
   * Create a new Gemini translation provider.
   *
   * @param config - Provider configuration
   */
  constructor(config: GeminiTranslationConfig) {
    if (!config.apiKey) {
      throw new TranslationError(
        ErrorCode.CONFIGURATION_ERROR,
        'Gemini API key is required'
      );
    }

    this.client = new GoogleGenerativeAI(config.apiKey);
    this.modelName = config.model || 'gemini-2.5-flash-lite';
    this.temperature = config.temperature ?? 0.3;
    this.maxTokens = config.maxTokens || 4000;
    this.maxParallelRequests = config.maxParallelRequests || 5;
    this.retryConfig = { ...DEFAULT_RETRY_CONFIG, ...config.retry };
  }

  /**
   * Translate a single text using the provided prompt.
   *
   * @param text - Tibetan text to translate
   * @param prompt - Complete prompt with instructions and context
   * @returns Promise resolving to translation result
   * @throws {TranslationError} If translation fails
   */
  async translate(text: string, prompt: string): Promise<TranslationResult> {
    const startTime = Date.now();

    try {
      const model = this.getModel();

      // Combine prompt and text
      const fullPrompt = `${prompt}\n\nText to translate:\n${text}`;

      // Generate translation with retry logic
      const result = await this.withRetry(async () => {
        const response = await model.generateContent(fullPrompt);
        return response;
      });

      const translatedText = result.response.text();

      if (!translatedText || translatedText.trim().length === 0) {
        throw new TranslationError(
          ErrorCode.TRANSLATION_FAILED,
          'Gemini returned empty translation'
        );
      }

      // Calculate confidence score (simplified for now)
      const confidence = this.calculateConfidence(translatedText, text);

      const processingTime = Date.now() - startTime;

      return {
        translation: translatedText,
        confidence,
        metadata: {
          model: this.modelName,
          cached: false,
          processingTimeMs: processingTime,
          tokenCount: this.estimateTokenCount(translatedText),
          timestamp: Date.now(),
        },
      };
    } catch (error) {
      if (error instanceof TranslationError) {
        throw error;
      }

      const apiError = error as any;

      // Handle specific Gemini API errors
      if (apiError.status === 429 || apiError.message?.includes('quota')) {
        throw new TranslationError(
          ErrorCode.RATE_LIMIT,
          'Gemini API rate limit exceeded',
          { text: text.substring(0, 100) },
          error as Error
        );
      }

      if (apiError.status === 503 || apiError.message?.includes('unavailable')) {
        throw new TranslationError(
          ErrorCode.API_UNAVAILABLE,
          'Gemini API temporarily unavailable',
          { text: text.substring(0, 100) },
          error as Error
        );
      }

      throw new TranslationError(
        ErrorCode.TRANSLATION_FAILED,
        'Failed to translate text',
        {
          text: text.substring(0, 100),
          model: this.modelName,
          originalError: apiError.message,
        },
        error as Error
      );
    }
  }

  /**
   * Translate multiple texts in batch using the same prompt.
   *
   * Processes up to 5 texts in parallel for optimal throughput.
   *
   * @param texts - Array of Tibetan texts to translate
   * @param prompt - Prompt to use for all translations
   * @returns Promise resolving to array of translation results
   * @throws {TranslationError} If batch operation fails completely
   */
  async translateBatch(texts: string[], prompt: string): Promise<TranslationResult[]> {
    if (texts.length === 0) {
      return [];
    }

    try {
      // Process in batches of maxParallelRequests
      const results: TranslationResult[] = [];

      for (let i = 0; i < texts.length; i += this.maxParallelRequests) {
        const batch = texts.slice(i, i + this.maxParallelRequests);

        // Process batch in parallel
        const batchResults = await Promise.all(
          batch.map(text => this.translate(text, prompt))
        );

        results.push(...batchResults);
      }

      return results;
    } catch (error) {
      if (error instanceof TranslationError) {
        throw error;
      }

      throw new TranslationError(
        ErrorCode.TRANSLATION_FAILED,
        'Failed to translate batch',
        { batchSize: texts.length },
        error as Error
      );
    }
  }

  /**
   * Stream a translation with progressive results.
   *
   * @param text - Text to translate
   * @param prompt - Prompt to use
   * @param onChunk - Callback for each chunk
   * @returns Promise resolving when stream completes
   */
  async translateStream(
    text: string,
    prompt: string,
    onChunk: (chunk: string) => void
  ): Promise<TranslationResult> {
    const startTime = Date.now();

    try {
      const model = this.getModel();
      const fullPrompt = `${prompt}\n\nText to translate:\n${text}`;

      // Generate content with streaming
      const result = await model.generateContentStream(fullPrompt);

      let translatedText = '';

      for await (const chunk of result.stream) {
        const chunkText = chunk.text();
        translatedText += chunkText;
        onChunk(chunkText);
      }

      if (!translatedText || translatedText.trim().length === 0) {
        throw new TranslationError(
          ErrorCode.TRANSLATION_FAILED,
          'Gemini returned empty translation'
        );
      }

      const confidence = this.calculateConfidence(translatedText, text);
      const processingTime = Date.now() - startTime;

      return {
        translation: translatedText,
        confidence,
        metadata: {
          model: this.modelName,
          cached: false,
          processingTimeMs: processingTime,
          tokenCount: this.estimateTokenCount(translatedText),
          timestamp: Date.now(),
        },
      };
    } catch (error) {
      if (error instanceof TranslationError) {
        throw error;
      }

      throw new TranslationError(
        ErrorCode.TRANSLATION_FAILED,
        'Failed to stream translation',
        { text: text.substring(0, 100) },
        error as Error
      );
    }
  }

  /**
   * Get configured Gemini model instance.
   *
   * @private
   * @returns GenerativeModel instance
   */
  private getModel(): GenerativeModel {
    return this.client.getGenerativeModel({
      model: this.modelName,
      generationConfig: {
        temperature: this.temperature,
        maxOutputTokens: this.maxTokens,
      },
    });
  }

  /**
   * Execute a function with retry logic and exponential backoff.
   *
   * @private
   * @param fn - Function to execute
   * @returns Promise resolving to function result
   */
  private async withRetry<T>(fn: () => Promise<T>): Promise<T> {
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= this.retryConfig.maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error as Error;

        // Don't retry on non-transient errors
        if (error instanceof TranslationError && !error.isTransient()) {
          throw error;
        }

        // Don't retry on last attempt
        if (attempt === this.retryConfig.maxRetries) {
          break;
        }

        // Calculate delay with exponential backoff
        let delay = this.retryConfig.baseDelay;

        if (this.retryConfig.exponentialBackoff) {
          const multiplier = this.retryConfig.backoffMultiplier || 2;
          delay = Math.min(
            this.retryConfig.baseDelay * Math.pow(multiplier, attempt),
            this.retryConfig.maxDelay || 60000
          );
        }

        // Add jitter if enabled
        if (this.retryConfig.jitter) {
          delay = delay * (0.5 + Math.random() * 0.5);
        }

        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw lastError;
  }

  /**
   * Calculate confidence score for a translation.
   *
   * Simplified implementation - real implementation would use
   * more sophisticated metrics.
   *
   * @private
   * @param translation - Translated text
   * @param original - Original text
   * @returns Confidence score (0-1)
   */
  private calculateConfidence(translation: string, original: string): number {
    // Basic heuristics for confidence
    let score = 0.7; // Base confidence

    // Check if Tibetan is preserved
    const tibetanPattern = /[\u0F00-\u0FFF]/;
    if (tibetanPattern.test(translation)) {
      score += 0.15;
    }

    // Check if format includes parentheses
    if (translation.includes('(') && translation.includes(')')) {
      score += 0.1;
    }

    // Check if translation is not too short
    if (translation.length > original.length * 0.5) {
      score += 0.05;
    }

    return Math.min(score, 1.0);
  }

  /**
   * Estimate token count for text.
   *
   * Rough approximation: ~4 characters per token for Tibetan.
   *
   * @private
   * @param text - Text to estimate
   * @returns Estimated token count
   */
  private estimateTokenCount(text: string): number {
    return Math.ceil(text.length / 4);
  }
}
