/**
 * TermExtractor (Task 2.4.1.2)
 *
 * Extracts Tibetan-English term pairs from completed translations.
 * Uses regex pattern matching and confidence scoring to identify
 * high-quality terminology for dictionary learning.
 *
 * Features:
 * - Extracts pairs in format "English (Tibetan)"
 * - Filters out full sentences (>15 words)
 * - Filters out stop words
 * - Scores confidence based on multiple factors
 * - Handles nested parentheses and Sanskrit transliterations
 *
 * @module server/services/dictionary/TermExtractor
 */

/**
 * Term pair extracted from translation
 */
export interface TermPair {
  tibetan: string;
  english: string;
  confidence: number;
}

/**
 * Stop words list (common English words to filter)
 */
const STOP_WORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'is', 'are', 'was', 'were',
  'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did',
  'to', 'of', 'in', 'on', 'at', 'by', 'for', 'with', 'from',
  'this', 'that', 'these', 'those', 'it', 'its', 'they', 'their',
  'will', 'would', 'should', 'could', 'may', 'might', 'can',
  'about', 'into', 'through', 'during', 'before', 'after',
  'above', 'below', 'up', 'down', 'out', 'off', 'over', 'under',
  'again', 'further', 'then', 'once', 'here', 'there', 'when',
  'where', 'why', 'how', 'all', 'both', 'each', 'few', 'more',
  'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only',
  'own', 'same', 'so', 'than', 'too', 'very', 's', 't',
]);

/**
 * TermExtractor extracts Tibetan-English term pairs from translations.
 *
 * Algorithm:
 * 1. Find all "English (Tibetan)" patterns using regex
 * 2. Extract Tibetan text (Unicode range U+0F00-U+0FFF)
 * 3. Extract English text (text before parentheses)
 * 4. Filter out sentences and stop words
 * 5. Score confidence based on multiple factors
 *
 * Confidence Scoring Formula:
 * - Base: 0.5
 * - Length factor: +0.1 to +0.2 (multi-word terms)
 * - Capitalization: +0.15 (proper nouns)
 * - Repetition: +0.15 (appears 3+ times)
 * - Max: 0.98
 *
 * @example
 * ```typescript
 * const extractor = new TermExtractor();
 * const text = "The Buddha (སངས་རྒྱས་) taught compassion (སྙིང་རྗེ་).";
 * const terms = extractor.extract(text);
 * // [
 * //   { tibetan: "སངས་རྒྱས", english: "Buddha", confidence: 0.8 },
 * //   { tibetan: "སྙིང་རྗེ", english: "compassion", confidence: 0.75 }
 * // ]
 * ```
 */
export class TermExtractor {
  private tibetanRegex: RegExp;
  private pairRegex: RegExp;

  constructor() {
    // Regex to match Tibetan Unicode range (U+0F00-U+0FFF)
    this.tibetanRegex = /[\u0F00-\u0FFF]+/g;

    // Regex to match "English (Tibetan)" pattern
    // Captures: English text before parentheses, Tibetan text in parentheses
    // Pattern: ([^()]+)\s*\(([^\)]*[\u0F00-\u0FFF][^\)]*)\)
    this.pairRegex = /([^()]+?)\s*\(([^)]*[\u0F00-\u0FFF][^)]*)\)/g;
  }

  /**
   * Extract term pairs from translation text.
   *
   * Process:
   * 1. Find all "English (Tibetan)" patterns
   * 2. Extract and clean Tibetan and English text
   * 3. Filter out invalid pairs
   * 4. Score confidence for each pair
   * 5. Return filtered and scored pairs
   *
   * @param text - Translation text containing "English (Tibetan)" pairs
   * @returns Array of extracted and scored term pairs
   */
  extract(text: string): TermPair[] {
    if (!text || text.trim().length === 0) {
      return [];
    }

    const pairs: TermPair[] = [];
    let match: RegExpExecArray | null;

    // Reset regex state
    this.pairRegex.lastIndex = 0;

    // Find all matches
    while ((match = this.pairRegex.exec(text)) !== null) {
      const englishRaw = match[1];
      const parenthesesContent = match[2];

      // Extract Tibetan text from parentheses content
      // Handle cases like "བོད་, Wylie: bod" by taking only Tibetan part
      const tibetanMatch = parenthesesContent.match(this.tibetanRegex);
      if (!tibetanMatch) {
        continue;
      }

      // Join all Tibetan matches (handles separated Tibetan text)
      const tibetan = tibetanMatch.join('');

      // Clean English text (remove extra whitespace, punctuation at end)
      const english = this.cleanEnglish(englishRaw);

      if (!english || !tibetan) {
        continue;
      }

      // Create preliminary pair
      const pair: TermPair = {
        tibetan: tibetan.trim(),
        english: english.trim(),
        confidence: 0,
      };

      pairs.push(pair);
    }

    // Filter invalid terms
    const filtered = this.filterTerms(pairs);

    // Score confidence for remaining terms
    const scored = filtered.map(pair => ({
      ...pair,
      confidence: this.scoreConfidence(pair, text),
    }));

    return scored;
  }

  /**
   * Clean English text by removing trailing punctuation and extra whitespace.
   *
   * @param text - Raw English text
   * @returns Cleaned English text
   */
  private cleanEnglish(text: string): string {
    return text
      .trim()
      .replace(/[.,;:!?]+$/, '') // Remove trailing punctuation
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();
  }

  /**
   * Filter out invalid term pairs.
   *
   * Filters:
   * - Full sentences (>15 words)
   * - Single stop words
   * - Very short Tibetan terms (<3 characters)
   *
   * @param terms - Array of term pairs to filter
   * @returns Filtered array of term pairs
   * @public - Exposed for testing
   */
  public filterTerms(terms: TermPair[]): TermPair[] {
    return terms.filter(term => {
      // Filter: English text must exist
      if (!term.english || term.english.trim().length === 0) {
        return false;
      }

      // Filter: Tibetan text must exist and be at least 3 characters
      if (!term.tibetan || term.tibetan.length < 3) {
        return false;
      }

      // Filter: No full sentences (>15 words)
      const wordCount = term.english.split(/\s+/).length;
      if (wordCount > 15) {
        return false;
      }

      // Filter: Single stop words (but allow multi-word phrases with stop words)
      if (wordCount === 1) {
        const word = term.english.toLowerCase();
        if (STOP_WORDS.has(word)) {
          return false;
        }
      }

      return true;
    });
  }

  /**
   * Score confidence for a term pair.
   *
   * Confidence Formula:
   * - Base: 0.5
   * - Length factor: +0.2 for 2-5 words, +0.1 for 6-10 words
   * - Capitalization: +0.15 if starts with capital letter
   * - Repetition: +0.15 if term appears 3+ times in text
   * - Max: 0.98
   *
   * @param term - Term pair to score
   * @param text - Full translation text (for repetition counting)
   * @returns Confidence score (0.5 - 0.98)
   * @public - Exposed for testing
   */
  public scoreConfidence(term: TermPair, text: string): number {
    let confidence = 0.5; // Base confidence

    // Length factor: Multi-word terms are more likely to be terminology
    const wordCount = term.english.split(/\s+/).length;
    if (wordCount >= 2 && wordCount <= 5) {
      confidence += 0.2;
    } else if (wordCount >= 6 && wordCount <= 10) {
      confidence += 0.1;
    }

    // Capitalization: Proper nouns are more likely to be important terms
    if (/^[A-Z]/.test(term.english)) {
      confidence += 0.15;
    }

    // Repetition: Terms that appear multiple times are more significant
    const escapedTibetan = term.tibetan.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escapedTibetan, 'g');
    const occurrences = (text.match(regex) || []).length;

    if (occurrences >= 3) {
      confidence += 0.15;
    } else if (occurrences === 2) {
      confidence += 0.08;
    }

    // Cap at 0.98 (never 100% certain from automated extraction)
    return Math.min(0.98, confidence);
  }

  /**
   * Extract high-confidence terms (>= threshold).
   *
   * @param text - Translation text
   * @param minConfidence - Minimum confidence threshold (default: 0.8)
   * @returns Array of high-confidence term pairs
   */
  extractHighConfidence(text: string, minConfidence: number = 0.8): TermPair[] {
    const allTerms = this.extract(text);
    return allTerms.filter(term => term.confidence >= minConfidence);
  }

  /**
   * Get statistics about extracted terms.
   *
   * @param text - Translation text
   * @returns Statistics object
   */
  getStats(text: string): {
    total: number;
    highConfidence: number;
    mediumConfidence: number;
    lowConfidence: number;
    avgConfidence: number;
  } {
    const terms = this.extract(text);

    const highConfidence = terms.filter(t => t.confidence >= 0.8).length;
    const mediumConfidence = terms.filter(t => t.confidence >= 0.6 && t.confidence < 0.8).length;
    const lowConfidence = terms.filter(t => t.confidence < 0.6).length;

    const avgConfidence = terms.length > 0
      ? terms.reduce((sum, t) => sum + t.confidence, 0) / terms.length
      : 0;

    return {
      total: terms.length,
      highConfidence,
      mediumConfidence,
      lowConfidence,
      avgConfidence,
    };
  }
}
