/**
 * Semantic Similarity Service
 *
 * Uses embedding models to calculate semantic similarity between texts.
 * This provides much more accurate similarity metrics compared to word-based approaches.
 *
 * @author Translation Service Team
 */

import { GoogleGenerativeAI } from "@google/generative-ai";

/**
 * Configuration for embedding service
 */
interface EmbeddingConfig {
  model?: string;
  taskType?: 'RETRIEVAL_QUERY' | 'RETRIEVAL_DOCUMENT' | 'SEMANTIC_SIMILARITY' | 'CLASSIFICATION' | 'CLUSTERING';
  title?: string;
}

/**
 * Result of semantic similarity comparison
 */
export interface SimilarityResult {
  score: number; // 0-1, where 1 is identical
  method: 'embedding' | 'fallback';
  metadata?: {
    dimension?: number;
    processingTime?: number;
  };
}

/**
 * Service for calculating semantic similarity using embeddings
 */
export class SemanticSimilarityService {
  private genAI: GoogleGenerativeAI | null = null;
  private embeddingModel: any = null;
  private isAvailable: boolean = false;
  private readonly defaultModel = "text-embedding-004";

  constructor() {
    this.initialize();
  }

  /**
   * Initialize the embedding service with Gemini API
   */
  private initialize(): void {
    try {
      // Try to use the odd pages API key for embeddings
      const apiKey = process.env.GEMINI_API_KEY_ODD || process.env.GEMINI_API_KEY_EVEN;

      if (!apiKey) {
        console.warn('[SemanticSimilarity] No Gemini API key found, falling back to word-based similarity');
        this.isAvailable = false;
        return;
      }

      this.genAI = new GoogleGenerativeAI(apiKey);
      this.embeddingModel = this.genAI.getGenerativeModel({ model: this.defaultModel });
      this.isAvailable = true;
      console.log('[SemanticSimilarity] Initialized with Gemini embeddings');
    } catch (error) {
      console.error('[SemanticSimilarity] Failed to initialize:', error);
      this.isAvailable = false;
    }
  }

  /**
   * Get embedding vector for a text
   *
   * @param text - The text to embed
   * @param config - Optional embedding configuration
   * @returns Embedding vector as array of numbers
   */
  public async getEmbedding(text: string, config?: EmbeddingConfig): Promise<number[]> {
    if (!this.isAvailable || !this.embeddingModel) {
      throw new Error('Embedding service not available');
    }

    try {
      const result = await this.embeddingModel.embedContent({
        content: { parts: [{ text }] },
        taskType: config?.taskType || 'SEMANTIC_SIMILARITY',
        title: config?.title
      });

      return result.embedding.values;
    } catch (error) {
      console.error('[SemanticSimilarity] Failed to get embedding:', error);
      throw error;
    }
  }

  /**
   * Calculate cosine similarity between two vectors
   *
   * @param vec1 - First embedding vector
   * @param vec2 - Second embedding vector
   * @returns Similarity score between 0 and 1
   */
  public cosineSimilarity(vec1: number[], vec2: number[]): number {
    if (vec1.length !== vec2.length) {
      throw new Error('Vectors must have the same length');
    }

    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;

    for (let i = 0; i < vec1.length; i++) {
      dotProduct += vec1[i] * vec2[i];
      norm1 += vec1[i] * vec1[i];
      norm2 += vec2[i] * vec2[i];
    }

    norm1 = Math.sqrt(norm1);
    norm2 = Math.sqrt(norm2);

    if (norm1 === 0 || norm2 === 0) {
      return 0;
    }

    // Cosine similarity ranges from -1 to 1, normalize to 0-1
    const similarity = dotProduct / (norm1 * norm2);
    return (similarity + 1) / 2;
  }

  /**
   * Compare two translations using semantic similarity
   *
   * @param translation1 - First translation
   * @param translation2 - Second translation
   * @returns Similarity result with score and metadata
   */
  public async compareTranslations(
    translation1: string,
    translation2: string
  ): Promise<SimilarityResult> {
    const startTime = Date.now();

    // Clean translations - remove Tibetan text in parentheses for comparison
    const clean1 = this.cleanTranslation(translation1);
    const clean2 = this.cleanTranslation(translation2);

    // If embeddings not available, fall back to word-based similarity
    if (!this.isAvailable) {
      const score = this.wordBasedSimilarity(clean1, clean2);
      return {
        score,
        method: 'fallback',
        metadata: { processingTime: Date.now() - startTime }
      };
    }

    try {
      // Get embeddings for both translations
      const [embedding1, embedding2] = await Promise.all([
        this.getEmbedding(clean1, { taskType: 'SEMANTIC_SIMILARITY' }),
        this.getEmbedding(clean2, { taskType: 'SEMANTIC_SIMILARITY' })
      ]);

      // Calculate cosine similarity
      const score = this.cosineSimilarity(embedding1, embedding2);

      return {
        score,
        method: 'embedding',
        metadata: {
          dimension: embedding1.length,
          processingTime: Date.now() - startTime
        }
      };
    } catch (error) {
      console.warn('[SemanticSimilarity] Embedding comparison failed, falling back to word-based:', error);
      const score = this.wordBasedSimilarity(clean1, clean2);
      return {
        score,
        method: 'fallback',
        metadata: { processingTime: Date.now() - startTime }
      };
    }
  }

  /**
   * Calculate semantic similarity for multiple translations
   * Returns average pairwise similarity
   *
   * @param translations - Array of translations to compare
   * @returns Average similarity score
   */
  public async calculateAverageSimilarity(translations: string[]): Promise<number> {
    if (translations.length < 2) {
      return 1.0;
    }

    let totalSimilarity = 0;
    let pairCount = 0;

    // Compare each pair of translations
    for (let i = 0; i < translations.length; i++) {
      for (let j = i + 1; j < translations.length; j++) {
        const result = await this.compareTranslations(translations[i], translations[j]);
        totalSimilarity += result.score;
        pairCount++;
      }
    }

    return pairCount > 0 ? totalSimilarity / pairCount : 1.0;
  }

  /**
   * Clean translation text for comparison
   * Removes Tibetan text in parentheses and normalizes whitespace
   *
   * @param translation - The translation to clean
   * @returns Cleaned text
   */
  private cleanTranslation(translation: string): string {
    return translation
      .replace(/\([^)]*[\u0F00-\u0FFF][^)]*\)/g, '') // Remove Tibetan in parentheses
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim()
      .toLowerCase();
  }

  /**
   * Fallback word-based similarity calculation
   * Used when embeddings are not available
   *
   * @param text1 - First text
   * @param text2 - Second text
   * @returns Similarity score between 0 and 1
   */
  private wordBasedSimilarity(text1: string, text2: string): number {
    const words1 = text1.split(/\s+/).filter(word => word.length > 2); // Filter short words
    const words2 = text2.split(/\s+/).filter(word => word.length > 2);

    if (words1.length === 0 || words2.length === 0) {
      return 0;
    }

    // Use Jaccard similarity coefficient
    const set1 = new Set(words1);
    const set2 = new Set(words2);

    const intersection = new Set([...set1].filter(word => set2.has(word)));
    const union = new Set([...set1, ...set2]);

    return intersection.size / union.size;
  }

  /**
   * Check if embedding service is available
   */
  public isEmbeddingAvailable(): boolean {
    return this.isAvailable;
  }

  /**
   * Get service status information
   */
  public getStatus(): {
    available: boolean;
    model: string;
    method: 'embedding' | 'fallback';
  } {
    return {
      available: this.isAvailable,
      model: this.isAvailable ? this.defaultModel : 'none',
      method: this.isAvailable ? 'embedding' : 'fallback'
    };
  }
}

// Export singleton instance
export const semanticSimilarityService = new SemanticSimilarityService();
