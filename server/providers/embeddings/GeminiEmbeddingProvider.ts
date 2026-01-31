/**
 * GeminiEmbeddingProvider - Google Gemini Embedding API Integration
 *
 * Provides text embeddings using Google's Gemini Embedding API.
 * Features:
 * - 768-dimensional embeddings
 * - Batch processing support
 * - Automatic caching for 24 hours
 * - Error handling and retry logic
 *
 * @module server/providers/embeddings/GeminiEmbeddingProvider
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import type { EmbeddingProvider, CacheProvider } from '../../core/interfaces.js';
import { hashText, generateEmbeddingKey } from '../../core/cache/keys.js';
import { TranslationError, ErrorCode } from '../../../shared/types.js';

/**
 * Configuration for Gemini Embedding Provider
 */
export interface GeminiEmbeddingConfig {
  /** Google Gemini API key */
  apiKey: string;

  /** Model name (default: text-embedding-004) */
  model?: string;

  /** Cache TTL in seconds (default: 86400 = 24 hours) */
  cacheTTL?: number;

  /** Enable caching (default: true) */
  enableCache?: boolean;
}

/**
 * Google Gemini embedding provider implementation.
 *
 * @example
 * ```typescript
 * const cache = new MemoryCache();
 * const provider = new GeminiEmbeddingProvider({
 *   apiKey: process.env.GEMINI_API_KEY!,
 *   model: 'text-embedding-004'
 * }, cache);
 *
 * const embedding = await provider.getEmbedding('བཀྲ་ཤིས་བདེ་ལེགས།');
 * console.log(embedding.length); // 768
 * ```
 */
export class GeminiEmbeddingProvider implements EmbeddingProvider {
  /** Dimension of Gemini embeddings */
  public readonly dimension = 768;

  private client: GoogleGenerativeAI;
  private modelName: string;
  private cache?: CacheProvider;
  private cacheTTL: number;
  private enableCache: boolean;

  /**
   * Create a new Gemini embedding provider.
   *
   * @param config - Provider configuration
   * @param cache - Optional cache provider
   */
  constructor(config: GeminiEmbeddingConfig, cache?: CacheProvider) {
    if (!config.apiKey) {
      throw new TranslationError(
        ErrorCode.CONFIGURATION_ERROR,
        'Gemini API key is required'
      );
    }

    this.client = new GoogleGenerativeAI(config.apiKey);
    this.modelName = config.model || 'text-embedding-004';
    this.cache = cache;
    this.cacheTTL = config.cacheTTL || 86400; // 24 hours default
    this.enableCache = config.enableCache !== false;
  }

  /**
   * Generate embedding for a single text.
   *
   * @param text - Text to embed
   * @returns Promise resolving to 768-dimensional embedding vector
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
      // Generate embedding using Gemini API
      const model = this.client.getGenerativeModel({ model: this.modelName });
      const result = await model.embedContent(text);

      if (!result.embedding || !result.embedding.values) {
        throw new TranslationError(
          ErrorCode.API_ERROR,
          'Invalid embedding response from Gemini API'
        );
      }

      const embedding = result.embedding.values;

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

      // Handle Gemini API errors
      const apiError = error as any;
      if (apiError.status === 429 || apiError.message?.includes('quota')) {
        throw new TranslationError(
          ErrorCode.RATE_LIMIT,
          'Gemini API rate limit exceeded',
          { originalError: apiError.message },
          error as Error
        );
      }

      if (apiError.status === 503 || apiError.message?.includes('unavailable')) {
        throw new TranslationError(
          ErrorCode.API_UNAVAILABLE,
          'Gemini API temporarily unavailable',
          { originalError: apiError.message },
          error as Error
        );
      }

      throw new TranslationError(
        ErrorCode.API_ERROR,
        'Failed to generate embedding',
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
   * Generate embeddings for multiple texts in batch.
   *
   * Processes items in parallel for better throughput.
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
      // Process in parallel using Promise.all
      // Gemini API handles batching internally
      const embeddings = await Promise.all(
        texts.map(text => this.getEmbedding(text))
      );

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
