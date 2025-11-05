/**
 * ExampleSelector V2
 *
 * Selects the most relevant translation examples for few-shot learning:
 * - Calculate cosine similarity using embeddings
 * - Ensure category diversity (max 50% from same category)
 * - Fall back to keyword matching if embeddings unavailable
 * - Sort by similarity (descending)
 *
 * @module server/services/examples/ExampleSelectorV2
 */

import type { EmbeddingProvider } from '../../../tests/utils/mocks.js';

/**
 * Translation example with optional embedding
 */
export interface TranslationExample {
  id: string;
  tibetan: string;
  english: string;
  category: string;
  embedding?: number[];
  similarity?: number;
}

/**
 * Calculate cosine similarity between two vectors.
 *
 * Cosine similarity = (A · B) / (||A|| * ||B||)
 * Result range: [-1, 1] where 1 = identical, 0 = orthogonal, -1 = opposite
 *
 * @param a - First vector
 * @param b - Second vector
 * @returns Cosine similarity score (0-1)
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error('Vectors must have the same length');
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  normA = Math.sqrt(normA);
  normB = Math.sqrt(normB);

  if (normA === 0 || normB === 0) {
    return 0;
  }

  return dotProduct / (normA * normB);
}

/**
 * ExampleSelector selects the most relevant translation examples.
 *
 * Selection process:
 * 1. Get embedding for input text
 * 2. Calculate cosine similarity with all examples
 * 3. Sort by similarity (descending)
 * 4. Ensure diversity (max 50% from same category)
 * 5. Return top N examples
 *
 * Fallback:
 * - If embeddings unavailable, use keyword matching
 *
 * @example
 * ```typescript
 * const selector = new ExampleSelector(embeddingProvider, examples);
 *
 * const selected = await selector.selectBest("བཀྲ་ཤིས་བདེ་ལེགས།", 3);
 *
 * // Returns: [
 * //   { tibetan: "བཀྲ་ཤིས་བདེ་ལེགས།", english: "Greetings", similarity: 0.98 },
 * //   { tibetan: "ཐུགས་རྗེ་ཆེ།", english: "Thank you", similarity: 0.85 },
 * //   { tibetan: "སངས་རྒྱས།", english: "Buddha", similarity: 0.72 }
 * // ]
 * ```
 */
export class ExampleSelector {
  private embeddingProvider: EmbeddingProvider;
  private examples: TranslationExample[];

  /**
   * Create a new ExampleSelector
   *
   * @param embeddingProvider - Provider for generating embeddings
   * @param examples - Pool of translation examples to select from
   */
  constructor(
    embeddingProvider: EmbeddingProvider,
    examples: TranslationExample[]
  ) {
    this.embeddingProvider = embeddingProvider;
    this.examples = examples;
  }

  /**
   * Select the best examples for a given text.
   *
   * Process:
   * 1. Get embedding for input text
   * 2. Calculate similarity with all examples
   * 3. Sort by similarity (descending)
   * 4. Ensure diversity (max 50% from same category)
   * 5. Return top N
   *
   * @param text - Input Tibetan text
   * @param count - Number of examples to return
   * @returns Array of selected examples with similarity scores
   */
  async selectBest(
    text: string,
    count: number
  ): Promise<TranslationExample[]> {
    // Handle edge cases
    if (count <= 0 || this.examples.length === 0 || !text) {
      return [];
    }

    // Limit count to available examples
    const actualCount = Math.min(count, this.examples.length);

    try {
      // Try embedding-based selection
      return await this.selectByEmbedding(text, actualCount);
    } catch (error) {
      console.warn('Embedding-based selection failed, falling back to keyword matching:', error);
      // Fall back to keyword matching
      return this.selectByKeyword(text, actualCount);
    }
  }

  /**
   * Select examples using embedding similarity.
   *
   * @param text - Input text
   * @param count - Number of examples to return
   * @returns Selected examples sorted by similarity
   */
  private async selectByEmbedding(
    text: string,
    count: number
  ): Promise<TranslationExample[]> {
    // Get embedding for input text
    const inputEmbedding = await this.embeddingProvider.getEmbedding(text);

    // Calculate similarity for all examples
    const withSimilarity: TranslationExample[] = [];

    for (const example of this.examples) {
      // Get or generate embedding for example
      let exampleEmbedding = example.embedding;

      if (!exampleEmbedding) {
        // Generate embedding if not cached
        exampleEmbedding = await this.embeddingProvider.getEmbedding(
          example.tibetan
        );
      }

      // Calculate cosine similarity
      const similarity = cosineSimilarity(inputEmbedding, exampleEmbedding);

      withSimilarity.push({
        ...example,
        embedding: exampleEmbedding,
        similarity,
      });
    }

    // Sort by similarity (descending)
    withSimilarity.sort((a, b) => (b.similarity || 0) - (a.similarity || 0));

    // Ensure diversity and return top N
    return this.ensureDiversity(withSimilarity, count);
  }

  /**
   * Select examples using keyword matching (fallback).
   *
   * @param text - Input text
   * @param count - Number of examples to return
   * @returns Selected examples
   */
  private selectByKeyword(
    text: string,
    count: number
  ): TranslationExample[] {
    // Extract meaningful Tibetan keywords (ignore common particles)
    const keywords = this.extractKeywords(text);

    if (keywords.length === 0) {
      // No keywords, return first N examples
      return this.examples.slice(0, count);
    }

    // Score examples by keyword overlap
    const scored = this.examples.map(example => {
      const exampleKeywords = this.extractKeywords(example.tibetan);
      const overlapCount = keywords.filter(k =>
        exampleKeywords.includes(k)
      ).length;

      return {
        ...example,
        similarity: overlapCount / keywords.length,
      };
    });

    // Sort by score
    scored.sort((a, b) => (b.similarity || 0) - (a.similarity || 0));

    // Ensure diversity and return top N
    return this.ensureDiversity(scored, count);
  }

  /**
   * Extract meaningful Tibetan keywords from text.
   *
   * Filters out:
   * - Common particles (ལ, ནས, གིས, ཀྱིས, etc.)
   * - Punctuation (།, ༎, ་)
   * - Very short terms (<2 characters)
   *
   * @param text - Tibetan text
   * @returns Array of keywords
   */
  private extractKeywords(text: string): string[] {
    // Extract Tibetan terms
    const tibetanRegex = /[\u0F00-\u0FFF]+/g;
    const terms = text.match(tibetanRegex) || [];

    // Common Tibetan particles to filter out
    const particles = new Set([
      'ལ',
      'ནས',
      'གིས',
      'ཀྱིས',
      'ཀྱི',
      'གི',
      'འི',
      'ཡི',
      'དང',
      'ནི',
      'པ',
      'བ',
      'མ',
      '་',
      '།',
      '༎',
    ]);

    // Filter and clean terms
    return terms
      .map(term => term.trim())
      .filter(term => {
        // Remove punctuation
        const cleaned = term.replace(/[།༎་\s]+/g, '');
        // Keep if not a particle and has length >= 2
        return cleaned.length >= 2 && !particles.has(cleaned);
      });
  }

  /**
   * Ensure category diversity in selected examples.
   *
   * Limits any single category to 50% of total examples.
   * Maintains similarity order while enforcing diversity.
   *
   * @param candidates - Sorted candidates with similarity scores
   * @param count - Number of examples to return
   * @returns Diverse subset of examples
   */
  ensureDiversity(
    candidates: TranslationExample[],
    count: number
  ): TranslationExample[] {
    const maxPerCategory = Math.ceil(count * 0.5);
    const selected: TranslationExample[] = [];
    const categoryCount: Map<string, number> = new Map();

    for (const candidate of candidates) {
      if (selected.length >= count) {
        break;
      }

      const category = candidate.category;
      const currentCount = categoryCount.get(category) || 0;

      // Check if adding this example would exceed category limit
      if (currentCount < maxPerCategory) {
        selected.push(candidate);
        categoryCount.set(category, currentCount + 1);
      }
    }

    // If we couldn't fill the quota due to diversity constraints,
    // add more examples from any category
    if (selected.length < count) {
      for (const candidate of candidates) {
        if (selected.length >= count) {
          break;
        }

        if (!selected.includes(candidate)) {
          selected.push(candidate);
        }
      }
    }

    return selected;
  }

  /**
   * Calculate similarity between two texts.
   *
   * @param text1 - First text
   * @param text2 - Second text
   * @returns Similarity score (0-1)
   */
  async calculateSimilarity(text1: string, text2: string): Promise<number> {
    const embedding1 = await this.embeddingProvider.getEmbedding(text1);
    const embedding2 = await this.embeddingProvider.getEmbedding(text2);

    return cosineSimilarity(embedding1, embedding2);
  }
}
