/**
 * DictionaryService V2
 *
 * Service for finding and managing Tibetan dictionary terms:
 * - Extract Tibetan terms from text using regex
 * - Find relevant terms in database
 * - Rank by frequency (common first)
 * - Batch query optimization
 * - Cache lookups for performance
 *
 * @module server/services/dictionary/DictionaryService
 */

import { CacheKeys } from '../../core/cache/keys.js';
import type { CacheProvider } from '../../../tests/utils/mocks.js';

/**
 * Dictionary entry structure
 */
export interface DictionaryEntry {
  id: string;
  tibetan: string;
  english: string;
  wylie?: string;
  sanskrit?: string;
  category?: string;
  frequency: 'very_common' | 'common' | 'uncommon' | 'rare';
  context?: string;
}

/**
 * Database interface for dictionary operations
 */
export interface DictionaryDatabase {
  /**
   * Query dictionary entries by Tibetan terms
   * @param terms - Array of Tibetan terms to lookup
   * @returns Array of matching dictionary entries
   */
  query(terms: string[]): Promise<DictionaryEntry[]>;

  /**
   * Insert a single dictionary entry
   * @param entry - Dictionary entry to insert
   * @returns ID of inserted entry
   */
  insert(entry: Omit<DictionaryEntry, 'id'>): Promise<string>;

  /**
   * Batch insert multiple dictionary entries
   * @param entries - Array of dictionary entries to insert
   * @returns Array of IDs of inserted entries
   */
  batchInsert(entries: Omit<DictionaryEntry, 'id'>[]): Promise<string[]>;
}

/**
 * Frequency priority for sorting (higher = more important)
 */
const FREQUENCY_PRIORITY: Record<string, number> = {
  very_common: 4,
  common: 3,
  uncommon: 2,
  rare: 1,
};

/**
 * DictionaryService manages Tibetan dictionary lookups.
 *
 * Flow for findRelevantTerms:
 * 1. Extract Tibetan terms from text (regex: [\u0F00-\u0FFF]+)
 * 2. Batch query database for matching entries
 * 3. Sort by frequency (very_common > common > uncommon > rare)
 * 4. Return top N terms
 * 5. Cache results for performance
 *
 * @example
 * ```typescript
 * const service = new DictionaryService(db, cache);
 *
 * const terms = await service.findRelevantTerms(
 *   "བཀྲ་ཤིས་བདེ་ལེགས། སངས་རྒྱས།",
 *   20
 * );
 *
 * // Returns: [
 * //   { tibetan: "བཀྲ་ཤིས་བདེ་ལེགས", english: "greetings", frequency: "very_common" },
 * //   { tibetan: "སངས་རྒྱས", english: "Buddha", frequency: "common" }
 * // ]
 * ```
 */
export class DictionaryService {
  private db: DictionaryDatabase;
  private cache: CacheProvider;
  private tibetanTermRegex: RegExp;

  /**
   * Create a new DictionaryService
   *
   * @param db - Database interface for dictionary operations
   * @param cache - Cache provider for performance
   */
  constructor(db: DictionaryDatabase, cache: CacheProvider) {
    this.db = db;
    this.cache = cache;

    // Regex to match Tibetan Unicode range (U+0F00-U+0FFF)
    // Matches one or more Tibetan characters
    this.tibetanTermRegex = /[\u0F00-\u0FFF]+/g;
  }

  /**
   * Find relevant dictionary terms in Tibetan text.
   *
   * Process:
   * 1. Extract Tibetan terms from text
   * 2. Check cache for each term
   * 3. Batch query database for uncached terms
   * 4. Sort by frequency (common first)
   * 5. Limit to top N terms
   * 6. Cache results
   *
   * @param text - Tibetan text to analyze
   * @param limit - Maximum number of terms to return (default: 20)
   * @returns Array of relevant dictionary entries, sorted by frequency
   */
  async findRelevantTerms(
    text: string,
    limit: number = 20
  ): Promise<DictionaryEntry[]> {
    // 1. Extract Tibetan terms from text
    const terms = this.extractTibetanTerms(text);

    if (terms.length === 0) {
      return [];
    }

    // 2. Batch query database (with caching)
    const entries = await this.batchQuery(terms);

    // 3. Sort by frequency
    const sorted = this.sortByFrequency(entries);

    // 4. Limit to top N
    return sorted.slice(0, limit);
  }

  /**
   * Extract Tibetan terms from text using regex.
   *
   * Extracts all sequences of Tibetan Unicode characters (U+0F00-U+0FFF).
   * Removes duplicates and returns unique terms.
   *
   * @param text - Text containing Tibetan characters
   * @returns Array of unique Tibetan terms
   */
  extractTibetanTerms(text: string): string[] {
    const matches = text.match(this.tibetanTermRegex);

    if (!matches) {
      return [];
    }

    // Remove duplicates and filter out single characters (too short)
    const unique = [...new Set(matches)];

    // Filter out very short terms (single tsek, punctuation only)
    return unique.filter(term => {
      // Must have at least one substantive character
      // Filter out standalone punctuation (།, ༎, ་)
      const withoutPunctuation = term.replace(/[།༎་\s]+/g, '');
      return withoutPunctuation.length > 0;
    });
  }

  /**
   * Batch query database for multiple terms efficiently.
   *
   * Uses caching to avoid redundant database queries:
   * - Check cache for each term
   * - Query database only for uncached terms
   * - Cache new results
   *
   * @param terms - Array of Tibetan terms to lookup
   * @returns Array of matching dictionary entries
   */
  async batchQuery(terms: string[]): Promise<DictionaryEntry[]> {
    const entries: DictionaryEntry[] = [];
    const uncachedTerms: string[] = [];

    // Check cache for each term
    for (const term of terms) {
      const cacheKey = CacheKeys.dictionary(term);
      const cached = await this.cache.get<DictionaryEntry[]>(cacheKey);

      if (cached) {
        entries.push(...cached);
      } else {
        uncachedTerms.push(term);
      }
    }

    // Query database for uncached terms
    if (uncachedTerms.length > 0) {
      const dbResults = await this.db.query(uncachedTerms);

      // Cache each result by term
      const resultsByTerm = this.groupByTerm(dbResults);

      for (const [term, termEntries] of Object.entries(resultsByTerm)) {
        const cacheKey = CacheKeys.dictionary(term);
        await this.cache.set(cacheKey, termEntries, 3600); // 1 hour TTL
      }

      entries.push(...dbResults);
    }

    return entries;
  }

  /**
   * Sort dictionary entries by frequency.
   *
   * Order: very_common > common > uncommon > rare
   *
   * @param entries - Array of dictionary entries
   * @returns Sorted array (most common first)
   */
  private sortByFrequency(entries: DictionaryEntry[]): DictionaryEntry[] {
    return [...entries].sort((a, b) => {
      const priorityA = FREQUENCY_PRIORITY[a.frequency] || 0;
      const priorityB = FREQUENCY_PRIORITY[b.frequency] || 0;

      // Higher priority first
      return priorityB - priorityA;
    });
  }

  /**
   * Group dictionary entries by their Tibetan term.
   *
   * @param entries - Array of dictionary entries
   * @returns Map of term -> entries
   */
  private groupByTerm(
    entries: DictionaryEntry[]
  ): Record<string, DictionaryEntry[]> {
    const grouped: Record<string, DictionaryEntry[]> = {};

    for (const entry of entries) {
      if (!grouped[entry.tibetan]) {
        grouped[entry.tibetan] = [];
      }
      grouped[entry.tibetan].push(entry);
    }

    return grouped;
  }

  /**
   * Load dictionary entries from a JSON file.
   *
   * Validates each entry before inserting into database.
   * Reports progress and handles errors gracefully.
   *
   * @param jsonPath - Path to JSON file containing dictionary entries
   * @returns Summary of load operation
   */
  async load(
    jsonPath: string
  ): Promise<{ loaded: number; errors: number; invalidEntries?: any[] }> {
    const fs = await import('fs/promises');

    try {
      // Read and parse JSON file
      const content = await fs.readFile(jsonPath, 'utf-8');
      const data = JSON.parse(content);

      if (!Array.isArray(data)) {
        throw new Error('JSON file must contain an array of dictionary entries');
      }

      // Validate and filter entries
      const validEntries: Omit<DictionaryEntry, 'id'>[] = [];
      const invalidEntries: any[] = [];

      for (const [index, entry] of data.entries()) {
        const validation = this.validateEntry(entry);

        if (validation.valid) {
          validEntries.push(entry);
        } else {
          invalidEntries.push({
            line: index + 1,
            entry,
            error: validation.error,
          });
        }
      }

      // Batch insert valid entries
      if (validEntries.length > 0) {
        await this.db.batchInsert(validEntries);
      }

      return {
        loaded: validEntries.length,
        errors: invalidEntries.length,
        invalidEntries: invalidEntries.length > 0 ? invalidEntries : undefined,
      };
    } catch (error) {
      throw new Error(`Failed to load dictionary from ${jsonPath}: ${error}`);
    }
  }

  /**
   * Validate a dictionary entry.
   *
   * @param entry - Entry to validate
   * @returns Validation result
   */
  private validateEntry(entry: any): { valid: boolean; error?: string } {
    if (!entry.tibetan || typeof entry.tibetan !== 'string') {
      return { valid: false, error: 'Missing or invalid tibetan field' };
    }

    if (!entry.english || typeof entry.english !== 'string') {
      return { valid: false, error: 'Missing or invalid english field' };
    }

    if (!entry.frequency) {
      // Default to 'common' if not specified
      entry.frequency = 'common';
    }

    const validFrequencies = ['very_common', 'common', 'uncommon', 'rare'];
    if (!validFrequencies.includes(entry.frequency)) {
      return { valid: false, error: `Invalid frequency: ${entry.frequency}` };
    }

    return { valid: true };
  }
}
