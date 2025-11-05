/**
 * SemanticAgreement - Semantic Similarity Calculator
 *
 * Calculates semantic agreement between multiple translations by:
 * - Getting embeddings for each translation
 * - Computing pairwise cosine similarities
 * - Averaging similarities to get overall agreement
 *
 * Used to boost confidence when multiple models agree semantically.
 *
 * @module server/services/confidence/SemanticAgreement
 */

import type { EmbeddingProvider } from '../../../tests/utils/mocks.js';

/**
 * SemanticAgreement calculates semantic similarity between translations.
 *
 * Algorithm:
 * 1. Get embeddings for all texts using EmbeddingProvider
 * 2. Calculate pairwise cosine similarities
 * 3. Return average similarity (0-1)
 *
 * Cosine Similarity Formula:
 * ```
 * similarity = (A · B) / (||A|| * ||B||)
 * ```
 *
 * @example
 * ```typescript
 * const embeddingProvider = new GeminiEmbeddingProvider(config);
 * const semanticAgreement = new SemanticAgreement(embeddingProvider);
 *
 * const texts = [
 *   'Greetings (བཀྲ་ཤིས།).',
 *   'Hello (བཀྲ་ཤིས།).',
 *   'Salutations (བཀྲ་ཤིས།).'
 * ];
 *
 * const agreement = await semanticAgreement.calculate(texts);
 * // Returns: 0.89 (high agreement)
 * ```
 */
export class SemanticAgreement {
  private embeddingProvider: EmbeddingProvider;

  /**
   * Create a new SemanticAgreement calculator.
   *
   * @param embeddingProvider - Provider for generating text embeddings
   */
  constructor(embeddingProvider: EmbeddingProvider) {
    this.embeddingProvider = embeddingProvider;
  }

  /**
   * Calculate semantic agreement between multiple texts.
   *
   * Process:
   * 1. Handle edge cases (empty, single text)
   * 2. Get embeddings for all texts (batch API)
   * 3. Calculate all pairwise cosine similarities
   * 4. Return average similarity
   *
   * @param texts - Array of translation texts to compare
   * @returns Average semantic similarity (0-1), where 1.0 = perfect agreement
   * @throws Error if embedding provider fails
   */
  async calculate(texts: string[]): Promise<number> {
    // Handle edge cases
    if (texts.length === 0) {
      return 0; // No texts = no agreement
    }

    if (texts.length === 1) {
      return 1.0; // Single text = perfect agreement with itself
    }

    try {
      // Get embeddings for all texts using batch API
      const embeddings = await this.embeddingProvider.getBatchEmbeddings(texts);

      // Calculate pairwise similarities
      const similarities: number[] = [];

      for (let i = 0; i < embeddings.length; i++) {
        for (let j = i + 1; j < embeddings.length; j++) {
          const similarity = this.cosineSimilarity(embeddings[i], embeddings[j]);
          similarities.push(similarity);
        }
      }

      // Return average similarity
      if (similarities.length === 0) {
        return 1.0; // Shouldn't happen, but default to perfect agreement
      }

      const averageSimilarity = similarities.reduce((sum, sim) => sum + sim, 0) / similarities.length;

      // Ensure result is in [0, 1] range
      return Math.max(0, Math.min(1.0, averageSimilarity));
    } catch (error) {
      // Re-throw embedding provider errors
      throw error;
    }
  }

  /**
   * Calculate cosine similarity between two embedding vectors.
   *
   * Formula: cos(θ) = (A · B) / (||A|| * ||B||)
   *
   * @param vectorA - First embedding vector
   * @param vectorB - Second embedding vector
   * @returns Cosine similarity (0-1), where 1.0 = identical
   */
  private cosineSimilarity(vectorA: number[], vectorB: number[]): number {
    if (vectorA.length !== vectorB.length) {
      throw new Error(
        `Vector dimensions must match: ${vectorA.length} vs ${vectorB.length}`
      );
    }

    if (vectorA.length === 0) {
      return 0;
    }

    // Calculate dot product (A · B)
    let dotProduct = 0;
    for (let i = 0; i < vectorA.length; i++) {
      dotProduct += vectorA[i] * vectorB[i];
    }

    // Calculate magnitudes
    let magnitudeA = 0;
    let magnitudeB = 0;

    for (let i = 0; i < vectorA.length; i++) {
      magnitudeA += vectorA[i] * vectorA[i];
      magnitudeB += vectorB[i] * vectorB[i];
    }

    magnitudeA = Math.sqrt(magnitudeA);
    magnitudeB = Math.sqrt(magnitudeB);

    // Avoid division by zero
    if (magnitudeA === 0 || magnitudeB === 0) {
      return 0;
    }

    // Calculate cosine similarity
    const similarity = dotProduct / (magnitudeA * magnitudeB);

    // Ensure result is in [-1, 1] range (should be [0, 1] for most embeddings)
    // Convert to [0, 1] range for agreement score
    return Math.max(0, Math.min(1.0, similarity));
  }
}
