/**
 * LocalEmbeddingProvider - Deterministic Hash-Based Embeddings
 *
 * Provides simple, deterministic embeddings without external API calls.
 * Useful for:
 * - Testing and development
 * - Offline operation
 * - Fallback when API is unavailable
 * - Cost-free operation
 *
 * Note: These are not semantic embeddings! They are simple hash-based
 * vectors that are consistent for the same input but don't capture
 * meaning or similarity in the way ML-based embeddings do.
 *
 * @module server/providers/embeddings/LocalEmbeddingProvider
 */

import { createHash } from 'crypto';
import type { EmbeddingProvider } from '../../core/interfaces.js';

/**
 * Configuration for Local Embedding Provider
 */
export interface LocalEmbeddingConfig {
  /** Dimension of embeddings to generate (default: 768) */
  dimension?: number;

  /** Seed for hash function (for deterministic variation) */
  seed?: string;
}

/**
 * Local deterministic embedding provider.
 *
 * Generates embeddings using hash functions without external API calls.
 * Embeddings are:
 * - Deterministic (same input → same output)
 * - Fast (no network calls)
 * - Free (no API costs)
 * - NOT semantic (don't capture meaning)
 *
 * @example
 * ```typescript
 * const provider = new LocalEmbeddingProvider({ dimension: 768 });
 *
 * const embedding = await provider.getEmbedding('བཀྲ་ཤིས་བདེ་ལེགས།');
 * console.log(embedding.length); // 768
 *
 * // Same input always produces same output
 * const embedding2 = await provider.getEmbedding('བཀྲ་ཤིས་བདེ་ལེགས།');
 * console.log(embedding[0] === embedding2[0]); // true
 * ```
 */
export class LocalEmbeddingProvider implements EmbeddingProvider {
  /** Dimension of embeddings */
  public readonly dimension: number;

  private seed: string;

  /**
   * Create a new local embedding provider.
   *
   * @param config - Provider configuration
   */
  constructor(config: LocalEmbeddingConfig = {}) {
    this.dimension = config.dimension || 768;
    this.seed = config.seed || 'tibetan-translation-v2';
  }

  /**
   * Generate deterministic embedding for a single text.
   *
   * Uses hash functions to create a consistent vector representation.
   * The embedding is normalized to [-1, 1] range.
   *
   * @param text - Text to embed
   * @returns Promise resolving to embedding vector
   */
  async getEmbedding(text: string): Promise<number[]> {
    // Generate multiple hashes with different seeds for different dimensions
    const embedding: number[] = [];

    // Use chunks of the dimension for different hash variations
    const chunkSize = 64; // Process 64 dimensions at a time
    const numChunks = Math.ceil(this.dimension / chunkSize);

    for (let chunk = 0; chunk < numChunks; chunk++) {
      // Create a hash with chunk-specific seed
      const hash = createHash('sha256')
        .update(this.seed)
        .update(String(chunk))
        .update(text)
        .digest();

      // Convert hash bytes to floating point values in [-1, 1]
      const remainingDims = Math.min(chunkSize, this.dimension - embedding.length);

      for (let i = 0; i < remainingDims; i++) {
        // Use hash bytes to generate deterministic floats
        const byteIndex = i % hash.length;
        const nextByteIndex = (i + 1) % hash.length;

        // Combine two bytes for better distribution
        const value = (hash[byteIndex] * 256 + hash[nextByteIndex]) / 65535;

        // Normalize to [-1, 1] range
        const normalized = (value * 2) - 1;

        embedding.push(normalized);
      }
    }

    return embedding;
  }

  /**
   * Generate embeddings for multiple texts in batch.
   *
   * @param texts - Array of texts to embed
   * @returns Promise resolving to array of embeddings
   */
  async getBatchEmbeddings(texts: string[]): Promise<number[][]> {
    // Process all texts (no network calls, so can do synchronously)
    const embeddings = await Promise.all(
      texts.map(text => this.getEmbedding(text))
    );

    return embeddings;
  }

  /**
   * Helper: Generate a simple hash-based similarity score.
   *
   * This is a utility method for comparing embeddings.
   * Uses cosine similarity.
   *
   * @param embedding1 - First embedding
   * @param embedding2 - Second embedding
   * @returns Similarity score (0-1)
   */
  static cosineSimilarity(embedding1: number[], embedding2: number[]): number {
    if (embedding1.length !== embedding2.length) {
      throw new Error('Embeddings must have same dimension');
    }

    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;

    for (let i = 0; i < embedding1.length; i++) {
      dotProduct += embedding1[i] * embedding2[i];
      norm1 += embedding1[i] * embedding1[i];
      norm2 += embedding2[i] * embedding2[i];
    }

    const magnitude = Math.sqrt(norm1) * Math.sqrt(norm2);

    if (magnitude === 0) {
      return 0;
    }

    return dotProduct / magnitude;
  }
}
