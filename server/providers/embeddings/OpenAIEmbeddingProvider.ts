/**
 * OpenAIEmbeddingProvider - OpenAI Embedding API Integration
 *
 * Provides text embeddings using OpenAI's embedding models.
 * Features:
 * - 1536-dimensional embeddings (text-embedding-3-small)
 * - Batch processing support
 * - Automatic caching for 24 hours
 * - Error handling and retry logic
 *
 * @module server/providers/embeddings/OpenAIEmbeddingProvider
 */

import type { EmbeddingProvider, CacheProvider } from '../../core/interfaces.js';
import { generateEmbeddingKey } from '../../core/cache/keys.js';
import { TranslationError, ErrorCode } from '../../../shared/types.js';

/**
 * Configuration for OpenAI Embedding Provider
 */
export interface OpenAIEmbeddingConfig {
  /** OpenAI API key */
  apiKey: string;

  /** Model name (default: text-embedding-3-small) */
  model?: string;

  /** Cache TTL in seconds (default: 86400 = 24 hours) */
  cacheTTL?: number;

  /** Enable caching (default: true) */
  enableCache?: boolean;

  /** API endpoint (default: https://api.openai.com/v1) */
  endpoint?: string;
}

/**
 * OpenAI embedding provider implementation.
 *
 * @example
 * ```typescript
 * const cache = new MemoryCache();
 * const provider = new OpenAIEmbeddingProvider({
 *   apiKey: process.env.OPENAI_API_KEY!,
 *   model: 'text-embedding-3-small'
 * }, cache);
 *
 * const embedding = await provider.getEmbedding('བཀྲ་ཤིས་བདེ་ལེགས།');
 * console.log(embedding.length); // 1536
 * ```
 */
export class OpenAIEmbeddingProvider implements EmbeddingProvider {
  /** Dimension of OpenAI embeddings (text-embedding-3-small) */
  public readonly dimension = 1536;

  private apiKey: string;
  private modelName: string;
  private cache?: CacheProvider;
  private cacheTTL: number;
  private enableCache: boolean;
  private endpoint: string;

  /**
   * Create a new OpenAI embedding provider.
   *
   * @param config - Provider configuration
   * @param cache - Optional cache provider
   */
  constructor(config: OpenAIEmbeddingConfig, cache?: CacheProvider) {
    if (!config.apiKey) {
      throw new TranslationError(
        ErrorCode.CONFIGURATION_ERROR,
        'OpenAI API key is required'
      );
    }

    this.apiKey = config.apiKey;
    this.modelName = config.model || 'text-embedding-3-small';
    this.cache = cache;
    this.cacheTTL = config.cacheTTL || 86400; // 24 hours default
    this.enableCache = config.enableCache !== false;
    this.endpoint = config.endpoint || 'https://api.openai.com/v1';
  }

  /**
   * Generate embedding for a single text.
   *
   * @param text - Text to embed
   * @returns Promise resolving to 1536-dimensional embedding vector
   * @throws {TranslationError} If API call fails
   */
  async getEmbedding(text: string): Promise<number[]> {
    // Check cache first
    if (this.enableCache && this.cache) {
      const cacheKey = generateEmbeddingKey(text, this.modelName);
      const cached = await this.cache.get<number[]>(cacheKey);

      if (cached) {
        return cached;
      }
    }

    try {
      // Call OpenAI API
      const response = await fetch(`${this.endpoint}/embeddings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.modelName,
          input: text,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));

        if (response.status === 429) {
          throw new TranslationError(
            ErrorCode.RATE_LIMIT,
            'OpenAI API rate limit exceeded',
            { status: response.status, error: errorData }
          );
        }

        if (response.status === 503) {
          throw new TranslationError(
            ErrorCode.API_UNAVAILABLE,
            'OpenAI API temporarily unavailable',
            { status: response.status, error: errorData }
          );
        }

        throw new TranslationError(
          ErrorCode.API_ERROR,
          `OpenAI API error: ${response.statusText}`,
          { status: response.status, error: errorData }
        );
      }

      const data = await response.json();

      if (!data.data || !data.data[0] || !data.data[0].embedding) {
        throw new TranslationError(
          ErrorCode.API_ERROR,
          'Invalid embedding response from OpenAI API',
          { response: data }
        );
      }

      const embedding = data.data[0].embedding;

      // Validate dimension
      if (embedding.length !== this.dimension) {
        throw new TranslationError(
          ErrorCode.API_ERROR,
          `Expected embedding dimension ${this.dimension}, got ${embedding.length}`
        );
      }

      // Cache the result
      if (this.enableCache && this.cache) {
        const cacheKey = generateEmbeddingKey(text, this.modelName);
        await this.cache.set(cacheKey, embedding, this.cacheTTL);
      }

      return embedding;
    } catch (error) {
      if (error instanceof TranslationError) {
        throw error;
      }

      throw new TranslationError(
        ErrorCode.API_ERROR,
        'Failed to generate embedding',
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
   * Generate embeddings for multiple texts in batch.
   *
   * OpenAI supports batch embedding requests, which is more efficient
   * than individual requests.
   *
   * @param texts - Array of texts to embed
   * @returns Promise resolving to array of embeddings
   * @throws {TranslationError} If batch operation fails
   */
  async getBatchEmbeddings(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) {
      return [];
    }

    try {
      // OpenAI supports batch embeddings directly
      const response = await fetch(`${this.endpoint}/embeddings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.modelName,
          input: texts,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));

        if (response.status === 429) {
          throw new TranslationError(
            ErrorCode.RATE_LIMIT,
            'OpenAI API rate limit exceeded',
            { status: response.status, error: errorData }
          );
        }

        throw new TranslationError(
          ErrorCode.API_ERROR,
          `OpenAI API error: ${response.statusText}`,
          { status: response.status, error: errorData }
        );
      }

      const data = await response.json();

      if (!data.data || !Array.isArray(data.data)) {
        throw new TranslationError(
          ErrorCode.API_ERROR,
          'Invalid batch embedding response from OpenAI API',
          { response: data }
        );
      }

      // Sort by index to maintain order
      const sortedData = data.data.sort((a: any, b: any) => a.index - b.index);
      const embeddings = sortedData.map((item: any) => item.embedding);

      // Cache each result
      if (this.enableCache && this.cache) {
        for (let i = 0; i < texts.length; i++) {
          const cacheKey = generateEmbeddingKey(texts[i], this.modelName);
          await this.cache.set(cacheKey, embeddings[i], this.cacheTTL);
        }
      }

      return embeddings;
    } catch (error) {
      if (error instanceof TranslationError) {
        throw error;
      }

      throw new TranslationError(
        ErrorCode.API_ERROR,
        'Failed to generate batch embeddings',
        { batchSize: texts.length },
        error as Error
      );
    }
  }
}
