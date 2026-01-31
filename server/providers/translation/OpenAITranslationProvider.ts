/**
 * OpenAITranslationProvider - OpenAI GPT Translation Integration
 *
 * Provides AI-powered translation using OpenAI's GPT models.
 * Features:
 * - GPT-4o-mini for cost-effectiveness
 * - Streaming support
 * - Batch processing
 * - Retry logic with exponential backoff
 * - Rate limit handling
 *
 * @module server/providers/translation/OpenAITranslationProvider
 */

import type { TranslationProvider, TranslationResult } from '../../core/interfaces.js';
import { TranslationError, ErrorCode, RetryConfig } from '../../../shared/types.js';

/**
 * Configuration for OpenAI Translation Provider
 */
export interface OpenAITranslationConfig {
  /** OpenAI API key */
  apiKey: string;

  /** Model name (default: gpt-4o-mini) */
  model?: string;

  /** Temperature for generation (default: 0.3) */
  temperature?: number;

  /** Maximum tokens to generate (default: 4000) */
  maxTokens?: number;

  /** Maximum parallel batch requests (default: 5) */
  maxParallelRequests?: number;

  /** API endpoint (default: https://api.openai.com/v1) */
  endpoint?: string;

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
 * OpenAI translation provider implementation.
 *
 * @example
 * ```typescript
 * const provider = new OpenAITranslationProvider({
 *   apiKey: process.env.OPENAI_API_KEY!,
 *   model: 'gpt-4o-mini',
 *   temperature: 0.3
 * });
 *
 * const result = await provider.translate(
 *   'བཀྲ་ཤིས་བདེ་ལེགས།',
 *   'Translate to English and preserve Tibetan in parentheses...'
 * );
 * ```
 */
export class OpenAITranslationProvider implements TranslationProvider {
  /** OpenAI supports streaming */
  public readonly supportsStreaming = true;

  private apiKey: string;
  private modelName: string;
  private temperature: number;
  private maxTokens: number;
  private maxParallelRequests: number;
  private endpoint: string;
  private retryConfig: RetryConfig;

  /**
   * Create a new OpenAI translation provider.
   *
   * @param config - Provider configuration
   */
  constructor(config: OpenAITranslationConfig) {
    if (!config.apiKey) {
      throw new TranslationError(
        ErrorCode.CONFIGURATION_ERROR,
        'OpenAI API key is required'
      );
    }

    this.apiKey = config.apiKey;
    this.modelName = config.model || 'gpt-4o-mini';
    this.temperature = config.temperature ?? 0.3;
    this.maxTokens = config.maxTokens || 4000;
    this.maxParallelRequests = config.maxParallelRequests || 5;
    this.endpoint = config.endpoint || 'https://api.openai.com/v1';
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
      const response = await this.withRetry(async () => {
        const res = await fetch(`${this.endpoint}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`,
          },
          body: JSON.stringify({
            model: this.modelName,
            messages: [
              {
                role: 'system',
                content: prompt,
              },
              {
                role: 'user',
                content: text,
              },
            ],
            temperature: this.temperature,
            max_tokens: this.maxTokens,
          }),
        });

        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));

          if (res.status === 429) {
            throw new TranslationError(
              ErrorCode.RATE_LIMIT,
              'OpenAI API rate limit exceeded',
              { status: res.status, error: errorData }
            );
          }

          if (res.status === 503) {
            throw new TranslationError(
              ErrorCode.API_UNAVAILABLE,
              'OpenAI API temporarily unavailable',
              { status: res.status, error: errorData }
            );
          }

          throw new TranslationError(
            ErrorCode.API_ERROR,
            `OpenAI API error: ${res.statusText}`,
            { status: res.status, error: errorData }
          );
        }

        return res.json();
      });

      const translatedText = response.choices[0]?.message?.content;

      if (!translatedText || translatedText.trim().length === 0) {
        throw new TranslationError(
          ErrorCode.TRANSLATION_FAILED,
          'OpenAI returned empty translation'
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
          tokenCount: response.usage?.total_tokens || this.estimateTokenCount(translatedText),
          timestamp: Date.now(),
        },
      };
    } catch (error) {
      if (error instanceof TranslationError) {
        throw error;
      }

      throw new TranslationError(
        ErrorCode.TRANSLATION_FAILED,
        'Failed to translate text',
        {
          text: text.substring(0, 100),
          model: this.modelName,
          originalError: (error as Error).message,
        },
        error as Error
      );
    }
  }

  /**
   * Translate multiple texts in batch using the same prompt.
   *
   * @param texts - Array of Tibetan texts to translate
   * @param prompt - Prompt to use for all translations
   * @returns Promise resolving to array of translation results
   */
  async translateBatch(texts: string[], prompt: string): Promise<TranslationResult[]> {
    if (texts.length === 0) {
      return [];
    }

    try {
      const results: TranslationResult[] = [];

      // Process in batches
      for (let i = 0; i < texts.length; i += this.maxParallelRequests) {
        const batch = texts.slice(i, i + this.maxParallelRequests);

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
      const response = await fetch(`${this.endpoint}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.modelName,
          messages: [
            {
              role: 'system',
              content: prompt,
            },
            {
              role: 'user',
              content: text,
            },
          ],
          temperature: this.temperature,
          max_tokens: this.maxTokens,
          stream: true,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new TranslationError(
          ErrorCode.API_ERROR,
          `OpenAI API error: ${response.statusText}`,
          { status: response.status, error: errorData }
        );
      }

      let translatedText = '';
      const reader = response.body?.getReader();

      if (!reader) {
        throw new TranslationError(
          ErrorCode.API_ERROR,
          'Failed to get response stream'
        );
      }

      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();

        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n').filter(line => line.trim() !== '');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);

            if (data === '[DONE]') continue;

            try {
              const parsed = JSON.parse(data);
              const content = parsed.choices[0]?.delta?.content;

              if (content) {
                translatedText += content;
                onChunk(content);
              }
            } catch (e) {
              // Ignore parse errors for incomplete chunks
            }
          }
        }
      }

      if (!translatedText || translatedText.trim().length === 0) {
        throw new TranslationError(
          ErrorCode.TRANSLATION_FAILED,
          'OpenAI returned empty translation'
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
   * Execute a function with retry logic and exponential backoff.
   *
   * @private
   */
  private async withRetry<T>(fn: () => Promise<T>): Promise<T> {
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= this.retryConfig.maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error as Error;

        if (error instanceof TranslationError && !error.isTransient()) {
          throw error;
        }

        if (attempt === this.retryConfig.maxRetries) {
          break;
        }

        let delay = this.retryConfig.baseDelay;

        if (this.retryConfig.exponentialBackoff) {
          const multiplier = this.retryConfig.backoffMultiplier || 2;
          delay = Math.min(
            this.retryConfig.baseDelay * Math.pow(multiplier, attempt),
            this.retryConfig.maxDelay || 60000
          );
        }

        if (this.retryConfig.jitter) {
          delay = delay * (0.5 + Math.random() * 0.5);
        }

        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw lastError;
  }

  /**
   * Calculate confidence score for a translation.
   *
   * @private
   */
  private calculateConfidence(translation: string, original: string): number {
    let score = 0.7;

    const tibetanPattern = /[\u0F00-\u0FFF]/;
    if (tibetanPattern.test(translation)) {
      score += 0.15;
    }

    if (translation.includes('(') && translation.includes(')')) {
      score += 0.1;
    }

    if (translation.length > original.length * 0.5) {
      score += 0.05;
    }

    return Math.min(score, 1.0);
  }

  /**
   * Estimate token count for text.
   *
   * @private
   */
  private estimateTokenCount(text: string): number {
    return Math.ceil(text.length / 4);
  }
}
