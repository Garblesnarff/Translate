/**
 * TranslationMemory V2
 *
 * Translation memory system using vector similarity search:
 * - Find similar translations (>95% similarity by default)
 * - Store translations with embeddings
 * - Use pgvector extension for PostgreSQL
 * - Track hits/misses for metrics
 *
 * @module server/services/translation/TranslationMemoryV2
 */

import { cosineSimilarity } from '../examples/ExampleSelectorV2.js';
import type {
  TranslationRequest,
  TranslationResult,
} from '../../../shared/types.js';
import type { EmbeddingProvider } from '../../../tests/utils/mocks.js';

/**
 * Translation memory entry
 */
export interface TranslationMemoryEntry {
  id: string;
  sourceText: string;
  translation: string;
  confidence: number;
  embedding: number[];
  metadata: any;
  createdAt: number;
}

/**
 * Database interface for translation memory
 */
export interface TranslationMemoryDatabase {
  /**
   * Find similar translations using vector search
   * @param embedding - Query embedding vector
   * @param threshold - Minimum similarity threshold (0-1)
   * @param limit - Maximum number of results
   * @returns Array of similar entries with similarity scores
   */
  vectorSearch(
    embedding: number[],
    threshold: number,
    limit: number
  ): Promise<Array<TranslationMemoryEntry & { similarity: number }>>;

  /**
   * Insert a new translation memory entry
   * @param entry - Entry to insert
   * @returns ID of inserted entry
   */
  insert(entry: Omit<TranslationMemoryEntry, 'id'>): Promise<string>;

  /**
   * Get total count of entries
   * @returns Total number of entries in memory
   */
  count(): Promise<number>;
}

/**
 * Statistics for translation memory
 */
export interface TranslationMemoryStats {
  totalEntries: number;
  hits: number;
  misses: number;
  hitRate: number;
}

/**
 * TranslationMemory provides semantic caching using vector similarity.
 *
 * Unlike exact-match caching, translation memory can find similar
 * translations even for slightly different input text.
 *
 * Process:
 * 1. Convert input text to embedding
 * 2. Perform vector similarity search in database
 * 3. Return cached translation if similarity > threshold (default 0.95)
 * 4. Otherwise return null (cache miss)
 *
 * Storage:
 * - Each translation stored with its embedding
 * - Uses pgvector extension for PostgreSQL
 * - Fast nearest-neighbor search with HNSW or IVFFlat index
 *
 * @example
 * ```typescript
 * const memory = new TranslationMemory(db, embeddingProvider);
 *
 * // Check for similar translation
 * const similar = await memory.findSimilar("བཀྲ་ཤིས་བདེ་ལེགས།", 0.95);
 *
 * if (similar) {
 *   console.log("Cache hit:", similar.translation);
 * } else {
 *   // Translate and save
 *   const result = await translate(...);
 *   await memory.save(request, result);
 * }
 * ```
 */
export class TranslationMemory {
  private db: TranslationMemoryDatabase;
  private embeddingProvider: EmbeddingProvider;
  private stats: TranslationMemoryStats;

  /**
   * Create a new TranslationMemory
   *
   * @param db - Database interface with vector search support
   * @param embeddingProvider - Provider for generating embeddings
   */
  constructor(
    db: TranslationMemoryDatabase,
    embeddingProvider: EmbeddingProvider
  ) {
    this.db = db;
    this.embeddingProvider = embeddingProvider;
    this.stats = {
      totalEntries: 0,
      hits: 0,
      misses: 0,
      hitRate: 0,
    };

    // Initialize stats
    this.refreshStats();
  }

  /**
   * Find a similar translation in memory.
   *
   * Process:
   * 1. Generate embedding for input text
   * 2. Perform vector similarity search
   * 3. Return best match if similarity > threshold
   * 4. Otherwise return null
   *
   * @param text - Input Tibetan text
   * @param threshold - Minimum similarity threshold (default: 0.95)
   * @returns Cached translation if found, null otherwise
   */
  async findSimilar(
    text: string,
    threshold: number = 0.95
  ): Promise<TranslationResult | null> {
    // Validate threshold
    if (threshold < 0 || threshold > 1) {
      throw new Error('Threshold must be between 0 and 1');
    }

    // Handle empty text
    if (!text || text.trim().length === 0) {
      this.stats.misses++;
      this.updateHitRate();
      return null;
    }

    try {
      // Generate embedding for input text
      const embedding = await this.embeddingProvider.getEmbedding(text);

      // Perform vector similarity search
      const results = await this.db.vectorSearch(embedding, threshold, 1);

      if (results.length === 0) {
        // No similar translation found
        this.stats.misses++;
        this.updateHitRate();
        return null;
      }

      // Return best match
      const match = results[0];
      this.stats.hits++;
      this.updateHitRate();

      return {
        translation: match.translation,
        confidence: match.confidence,
        metadata: {
          ...match.metadata,
          fromMemory: true,
          similarity: match.similarity,
          processingTimeMs: 5, // Very fast retrieval from memory
        },
      };
    } catch (error) {
      console.error('Failed to search translation memory:', error);
      throw error;
    }
  }

  /**
   * Save a translation to memory.
   *
   * Process:
   * 1. Generate embedding for source text
   * 2. Create memory entry with embedding
   * 3. Insert into database
   *
   * @param request - Original translation request
   * @param result - Translation result to save
   * @returns ID of saved entry
   */
  async save(
    request: TranslationRequest,
    result: TranslationResult
  ): Promise<string> {
    try {
      // Generate embedding for source text
      const embedding = await this.embeddingProvider.getEmbedding(request.text);

      // Create memory entry
      const entry: Omit<TranslationMemoryEntry, 'id'> = {
        sourceText: request.text,
        translation: result.translation,
        confidence: result.confidence,
        embedding,
        metadata: {
          ...result.metadata,
          requestMetadata: request.metadata,
          timestamp: Date.now(),
        },
        createdAt: Date.now(),
      };

      // Insert into database
      const id = await this.db.insert(entry);

      // Update stats
      this.stats.totalEntries++;

      return id;
    } catch (error) {
      console.error('Failed to save to translation memory:', error);
      throw error;
    }
  }

  /**
   * Calculate similarity score between two texts.
   *
   * @param text1 - First text
   * @param text2 - Second text
   * @returns Similarity score (0-1)
   */
  async getSimilarityScore(text1: string, text2: string): Promise<number> {
    const embedding1 = await this.embeddingProvider.getEmbedding(text1);
    const embedding2 = await this.embeddingProvider.getEmbedding(text2);

    return cosineSimilarity(embedding1, embedding2);
  }

  /**
   * Get current statistics.
   *
   * @returns Current stats snapshot
   */
  getStats(): TranslationMemoryStats {
    return { ...this.stats };
  }

  /**
   * Refresh entry count from database.
   */
  private async refreshStats(): Promise<void> {
    try {
      this.stats.totalEntries = await this.db.count();
    } catch (error) {
      console.error('Failed to refresh stats:', error);
    }
  }

  /**
   * Update hit rate calculation.
   */
  private updateHitRate(): void {
    const total = this.stats.hits + this.stats.misses;
    this.stats.hitRate = total === 0 ? 0 : this.stats.hits / total;
  }
}
