/**
 * Fuzzy Name Matching Service
 *
 * Comprehensive name matching service for detecting similar entity names across documents.
 * Handles Tibetan, Wylie, phonetic, and English transliterations with multiple similarity algorithms.
 *
 * Phase 2.1: Entity Resolution
 *
 * @algorithm Levenshtein Distance - Character-level similarity
 * @algorithm Soundex - Phonetic matching for English names
 * @algorithm Normalization - Strip diacritics, honorifics, and standardize formats
 * @algorithm Word-level matching - Consider word order and overlap
 *
 * @example
 * const matcher = new FuzzyMatcher();
 * const score = matcher.calculateSimilarity("Marpa", "Mar-pa");
 * // Returns: 0.95 (very likely same entity)
 *
 * @see /roadmaps/knowledge-graph/PHASES_SUMMARY.md (Phase 2, lines 12-16)
 */

import type { Entity, NameVariants } from '../../types/entities';

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Match type indicating how the similarity was determined
 */
export type MatchType =
  | 'exact'           // Perfect match after normalization
  | 'levenshtein'     // Character-level similarity
  | 'phonetic'        // Phonetic similarity (sounds alike)
  | 'word_order'      // Word-level matching (different order)
  | 'transliteration' // Known transliteration variants
  | 'partial';        // Substring or partial match

/**
 * Similarity score with detailed breakdown
 */
export interface SimilarityScore {
  /** Overall similarity score (0.0-1.0) */
  score: number;

  /** How the match was determined */
  matchType: MatchType;

  /** Confidence in this match (0.0-1.0) */
  confidence: number;

  /** Human-readable explanation */
  reason: string;

  /** Breakdown of component scores */
  components: {
    levenshtein: number;
    phonetic: number;
    wordLevel: number;
    lengthPenalty: number;
  };
}

/**
 * A candidate name match with its score
 */
export interface NameMatch {
  /** The candidate entity that matches */
  candidate: Entity;

  /** Which specific name variant matched */
  matchedName: string;

  /** Which name from target matched */
  targetName: string;

  /** Similarity score details */
  score: SimilarityScore;

  /** Additional context about the match */
  reasons: string[];
}

/**
 * Options for fuzzy matching
 */
export interface MatchOptions {
  /** Minimum similarity threshold (0.0-1.0) */
  threshold?: number;

  /** Consider phonetic matching */
  usePhonetic?: boolean;

  /** Consider word-level matching */
  useWordLevel?: boolean;

  /** Prefer matches of same entity type */
  preferSameType?: boolean;

  /** Maximum number of results to return */
  limit?: number;
}

// ============================================================================
// Tibetan-Specific Constants
// ============================================================================

/**
 * Common Tibetan honorifics to strip for comparison
 */
const TIBETAN_HONORIFICS = [
  'rinpoche',
  'lama',
  'je',
  'rje',
  'རིན་པོ་ཆེ',
  'བླ་མ',
  'རྗེ',
  'lotsawa',
  'པཎ་ཆེན',
  'panchen',
  'dalai',
  'དལའི',
  'khenpo',
  'མཁན་པོ',
  'geshe',
  'དགེ་བཤེས',
  'tulku',
  'སྤྲུལ་སྐུ',
];

/**
 * Common Wylie to phonetic transliteration mappings
 */
const WYLIE_TO_PHONETIC: Record<string, string[]> = {
  'bla ma': ['lama'],
  'mar pa': ['marpa'],
  'mi la': ['milarepa', 'mila'],
  'sgam po pa': ['gampopa'],
  'tsong kha pa': ['tsongkhapa', 'je tsongkhapa'],
  'pad+ma': ['padma', 'pema'],
  'sa skya': ['sakya'],
  'dge lugs': ['gelug', 'geluk'],
  'rnying ma': ['nyingma'],
  'bka\' brgyud': ['kagyu', 'kagyü'],
  'Jo bo rje': ['atisha', 'jowo je'],
  'tā la\'i bla ma': ['dalai lama'],
};

/**
 * Diacritics to remove for normalization
 */
const DIACRITIC_MAP: Record<string, string> = {
  'ā': 'a', 'ī': 'i', 'ū': 'u', 'ṛ': 'r', 'ṝ': 'r',
  'ḷ': 'l', 'ḹ': 'l', 'ṅ': 'n', 'ñ': 'n', 'ṭ': 't',
  'ḍ': 'd', 'ṇ': 'n', 'ś': 's', 'ṣ': 's', 'ḥ': 'h',
  'á': 'a', 'é': 'e', 'í': 'i', 'ó': 'o', 'ú': 'u',
  'à': 'a', 'è': 'e', 'ì': 'i', 'ò': 'o', 'ù': 'u',
  'ä': 'a', 'ë': 'e', 'ï': 'i', 'ö': 'o', 'ü': 'u',
  'â': 'a', 'ê': 'e', 'î': 'i', 'ô': 'o', 'û': 'u',
  'ã': 'a', 'õ': 'o', 'ç': 'c',
};

// ============================================================================
// Fuzzy Matcher Service
// ============================================================================

/**
 * Fuzzy name matching service for entity resolution
 *
 * Handles multiple scripts (Tibetan, English, Wylie, phonetic) and provides
 * sophisticated similarity scoring for duplicate detection.
 */
export class FuzzyMatcher {
  /**
   * Calculate comprehensive similarity between two names
   *
   * Combines multiple algorithms for robust matching:
   * - Levenshtein distance for character-level similarity
   * - Phonetic matching (Soundex) for pronunciation
   * - Word-level matching for reordering
   * - Length penalties for vastly different lengths
   *
   * @param name1 - First name to compare
   * @param name2 - Second name to compare
   * @returns Detailed similarity score with breakdown
   *
   * @example
   * calculateSimilarity("Marpa Lotsawa", "Mar-pa the Translator")
   * // Returns: { score: 0.87, matchType: 'transliteration', ... }
   */
  calculateSimilarity(name1: string, name2: string): SimilarityScore {
    // Normalize both names
    const norm1 = this.normalizeText(name1);
    const norm2 = this.normalizeText(name2);

    // Check for exact match after normalization
    if (norm1 === norm2) {
      return {
        score: 1.0,
        matchType: 'exact',
        confidence: 1.0,
        reason: 'Exact match after normalization',
        components: {
          levenshtein: 1.0,
          phonetic: 1.0,
          wordLevel: 1.0,
          lengthPenalty: 1.0,
        },
      };
    }

    // Calculate component scores
    const levenshteinScore = this.calculateLevenshteinSimilarity(norm1, norm2);
    const phoneticScore = this.phoneticSimilarity(name1, name2);
    const wordLevelScore = this.wordLevelSimilarity(norm1, norm2);
    const lengthPenalty = this.calculateLengthPenalty(norm1, norm2);

    // Check for known transliteration variants
    const transliterationScore = this.checkTransliterationVariant(norm1, norm2);
    if (transliterationScore > 0.95) {
      return {
        score: transliterationScore,
        matchType: 'transliteration',
        confidence: 0.95,
        reason: 'Known transliteration variant',
        components: {
          levenshtein: levenshteinScore,
          phonetic: phoneticScore,
          wordLevel: wordLevelScore,
          lengthPenalty,
        },
      };
    }

    // Weighted combination of scores
    // Levenshtein gets highest weight as it's most reliable
    const weightedScore = (
      levenshteinScore * 0.5 +
      phoneticScore * 0.2 +
      wordLevelScore * 0.2 +
      transliterationScore * 0.1
    ) * lengthPenalty;

    // Determine match type based on which score contributed most
    let matchType: MatchType = 'levenshtein';
    let confidence = weightedScore;
    let reason = 'Character-level similarity';

    if (phoneticScore > 0.85 && phoneticScore > levenshteinScore) {
      matchType = 'phonetic';
      reason = 'Phonetic similarity (sounds alike)';
      confidence *= 0.9; // Slightly lower confidence for phonetic
    } else if (wordLevelScore > 0.85 && wordLevelScore > levenshteinScore) {
      matchType = 'word_order';
      reason = 'Word-level match (different order)';
      confidence *= 0.95;
    }

    return {
      score: weightedScore,
      matchType,
      confidence,
      reason,
      components: {
        levenshtein: levenshteinScore,
        phonetic: phoneticScore,
        wordLevel: wordLevelScore,
        lengthPenalty,
      },
    };
  }

  /**
   * Find similar names from a list of candidates
   *
   * Compares target name against all candidate entities and returns
   * matches above the threshold, sorted by similarity score.
   *
   * @param targetName - Name to search for
   * @param candidates - List of entity candidates to compare against
   * @param options - Matching options (threshold, limits, etc.)
   * @returns Array of matches sorted by similarity (highest first)
   *
   * @example
   * const matches = matcher.findSimilarNames(
   *   "Marpa",
   *   allPersonEntities,
   *   { threshold: 0.85, limit: 5 }
   * );
   */
  findSimilarNames(
    targetName: string,
    candidates: Entity[],
    options: MatchOptions = {}
  ): NameMatch[] {
    const {
      threshold = 0.75,
      limit = 10,
      preferSameType = false,
    } = options;

    const matches: NameMatch[] = [];

    for (const candidate of candidates) {
      // Get all name variants for this candidate
      const nameVariants = this.extractAllNames(candidate.names);

      // Compare against each name variant
      for (const variantName of nameVariants) {
        const score = this.calculateSimilarity(targetName, variantName);

        if (score.score >= threshold) {
          matches.push({
            candidate,
            matchedName: variantName,
            targetName,
            score,
            reasons: [score.reason],
          });
        }
      }
    }

    // Sort by score (highest first)
    matches.sort((a, b) => b.score.score - a.score.score);

    // Apply type preference if requested
    if (preferSameType && matches.length > 0) {
      const targetType = matches[0].candidate.type;
      matches.sort((a, b) => {
        const aTypeMatch = a.candidate.type === targetType ? 1 : 0;
        const bTypeMatch = b.candidate.type === targetType ? 1 : 0;
        return (bTypeMatch - aTypeMatch) || (b.score.score - a.score.score);
      });
    }

    // Apply limit
    return matches.slice(0, limit);
  }

  /**
   * Normalize text for comparison
   *
   * Performs comprehensive normalization:
   * - Lowercase
   * - Remove diacritics
   * - Strip honorifics
   * - Remove punctuation and extra spaces
   * - Handle Wylie/phonetic variants
   *
   * @param text - Text to normalize
   * @returns Normalized text ready for comparison
   *
   * @example
   * normalizeText("མར་པ། Marpa Lotsāwa Rinpoche")
   * // Returns: "marpa lotsawa"
   */
  normalizeText(text: string): string {
    // Lowercase
    let normalized = text.toLowerCase().trim();

    // Remove diacritics
    normalized = this.removeDiacritics(normalized);

    // Remove common honorifics
    for (const honorific of TIBETAN_HONORIFICS) {
      const regex = new RegExp(`\\b${honorific.toLowerCase()}\\b`, 'gi');
      normalized = normalized.replace(regex, '');
    }

    // Remove punctuation (but keep hyphens and apostrophes for Wylie)
    normalized = normalized.replace(/[།་\.\,\!\?\;\:\"\"\'\']/g, ' ');

    // Normalize spaces and hyphens
    normalized = normalized.replace(/[-_]/g, ' '); // Convert hyphens to spaces
    normalized = normalized.replace(/\s+/g, ' '); // Collapse multiple spaces
    normalized = normalized.trim();

    return normalized;
  }

  /**
   * Calculate Levenshtein distance between two strings
   *
   * Uses dynamic programming to compute the minimum number of
   * single-character edits (insertions, deletions, substitutions)
   * needed to transform one string into another.
   *
   * @param str1 - First string
   * @param str2 - Second string
   * @returns Edit distance (0 = identical, higher = more different)
   *
   * @complexity O(n*m) where n and m are string lengths
   *
   * @example
   * calculateLevenshteinDistance("marpa", "mar-pa")
   * // Returns: 1 (one insertion)
   */
  calculateLevenshteinDistance(str1: string, str2: string): number {
    const len1 = str1.length;
    const len2 = str2.length;

    // Create 2D array for dynamic programming
    const dp: number[][] = Array(len1 + 1)
      .fill(null)
      .map(() => Array(len2 + 1).fill(0));

    // Initialize first row and column
    for (let i = 0; i <= len1; i++) {
      dp[i][0] = i;
    }
    for (let j = 0; j <= len2; j++) {
      dp[0][j] = j;
    }

    // Fill the matrix
    for (let i = 1; i <= len1; i++) {
      for (let j = 1; j <= len2; j++) {
        if (str1[i - 1] === str2[j - 1]) {
          // Characters match, no edit needed
          dp[i][j] = dp[i - 1][j - 1];
        } else {
          // Take minimum of three operations
          dp[i][j] = Math.min(
            dp[i - 1][j] + 1,     // Deletion
            dp[i][j - 1] + 1,     // Insertion
            dp[i - 1][j - 1] + 1  // Substitution
          );
        }
      }
    }

    return dp[len1][len2];
  }

  /**
   * Calculate similarity as normalized Levenshtein score
   *
   * Converts edit distance to similarity score (0.0-1.0)
   *
   * @param str1 - First string
   * @param str2 - Second string
   * @returns Similarity score (1.0 = identical, 0.0 = completely different)
   */
  private calculateLevenshteinSimilarity(str1: string, str2: string): number {
    const maxLen = Math.max(str1.length, str2.length);
    if (maxLen === 0) return 1.0;

    const distance = this.calculateLevenshteinDistance(str1, str2);
    return 1 - (distance / maxLen);
  }

  /**
   * Check if two names match phonetically
   *
   * Uses Soundex algorithm for English/phonetic names to detect
   * names that sound alike but are spelled differently.
   *
   * @param name1 - First name
   * @param name2 - Second name
   * @returns True if phonetically similar
   *
   * @example
   * phoneticMatch("Marpa", "Marpah")
   * // Returns: true
   */
  phoneticMatch(name1: string, name2: string): boolean {
    const soundex1 = this.soundex(name1);
    const soundex2 = this.soundex(name2);
    return soundex1 === soundex2;
  }

  /**
   * Calculate phonetic similarity score
   *
   * @param name1 - First name
   * @param name2 - Second name
   * @returns Similarity score based on phonetic matching
   */
  private phoneticSimilarity(name1: string, name2: string): number {
    // Split into words and compare each
    const words1 = name1.toLowerCase().split(/\s+/);
    const words2 = name2.toLowerCase().split(/\s+/);

    if (words1.length === 0 || words2.length === 0) return 0;

    let matchingWords = 0;
    for (const word1 of words1) {
      for (const word2 of words2) {
        if (this.phoneticMatch(word1, word2)) {
          matchingWords++;
          break;
        }
      }
    }

    return matchingWords / Math.max(words1.length, words2.length);
  }

  /**
   * Soundex algorithm for phonetic encoding
   *
   * Converts names to phonetic codes so names that sound alike
   * get the same code (e.g., "Smith" and "Smythe" both → S530)
   *
   * @param name - Name to encode
   * @returns Four-character Soundex code
   *
   * @see https://en.wikipedia.org/wiki/Soundex
   */
  private soundex(name: string): string {
    // Remove non-alphabetic characters and uppercase
    name = name.replace(/[^a-zA-Z]/g, '').toUpperCase();

    if (name.length === 0) return '0000';

    // Soundex mapping
    const mapping: Record<string, string> = {
      'B': '1', 'F': '1', 'P': '1', 'V': '1',
      'C': '2', 'G': '2', 'J': '2', 'K': '2', 'Q': '2', 'S': '2', 'X': '2', 'Z': '2',
      'D': '3', 'T': '3',
      'L': '4',
      'M': '5', 'N': '5',
      'R': '6',
    };

    // Keep first letter
    let code = name[0];

    // Encode remaining letters
    let prevCode = mapping[name[0]] || '0';
    for (let i = 1; i < name.length && code.length < 4; i++) {
      const char = name[i];
      const currCode = mapping[char];

      if (currCode && currCode !== prevCode) {
        code += currCode;
        prevCode = currCode;
      } else if (!currCode) {
        prevCode = '0'; // Reset for vowels
      }
    }

    // Pad with zeros
    return (code + '0000').substring(0, 4);
  }

  /**
   * Calculate word-level similarity
   *
   * Compares words independently, useful for detecting names with
   * different word order or additional words.
   *
   * @param text1 - First text
   * @param text2 - Second text
   * @returns Word overlap similarity (0.0-1.0)
   *
   * @example
   * wordLevelSimilarity("marpa lotsawa", "lotsawa marpa")
   * // Returns: 1.0 (same words, different order)
   */
  private wordLevelSimilarity(text1: string, text2: string): number {
    const words1 = new Set(text1.split(/\s+/).filter(w => w.length > 0));
    const words2 = new Set(text2.split(/\s+/).filter(w => w.length > 0));

    if (words1.size === 0 || words2.size === 0) return 0;

    // Count overlapping words
    let overlap = 0;
    words1.forEach((word) => {
      if (words2.has(word)) {
        overlap++;
      }
    });

    // Jaccard similarity
    const union = words1.size + words2.size - overlap;
    return union > 0 ? overlap / union : 0;
  }

  /**
   * Calculate length penalty for vastly different name lengths
   *
   * Names with very different lengths are less likely to be the same entity.
   * Applies a penalty factor that decreases similarity for length differences.
   *
   * @param text1 - First text
   * @param text2 - Second text
   * @returns Penalty factor (0.5-1.0)
   */
  private calculateLengthPenalty(text1: string, text2: string): number {
    const len1 = text1.length;
    const len2 = text2.length;

    if (len1 === 0 || len2 === 0) return 0.5;

    const ratio = Math.min(len1, len2) / Math.max(len1, len2);

    // No penalty if ratio > 0.7, gradually increase penalty below that
    if (ratio >= 0.7) return 1.0;
    if (ratio >= 0.5) return 0.95;
    if (ratio >= 0.3) return 0.85;
    return 0.7; // Significant penalty for very different lengths
  }

  /**
   * Check for known transliteration variants
   *
   * Looks up known Wylie → Phonetic mappings to detect variants
   * that are definitely the same entity.
   *
   * @param text1 - First text (normalized)
   * @param text2 - Second text (normalized)
   * @returns Similarity score (0.0-1.0)
   */
  private checkTransliterationVariant(text1: string, text2: string): number {
    // Check if either text matches a known Wylie pattern
    for (const [wylie, phonetics] of Object.entries(WYLIE_TO_PHONETIC)) {
      const wylieNorm = wylie.toLowerCase();

      // Check if text1 is Wylie and text2 is phonetic
      if (text1.includes(wylieNorm) && phonetics.some(p => text2.includes(p.toLowerCase()))) {
        return 0.98;
      }

      // Check if text2 is Wylie and text1 is phonetic
      if (text2.includes(wylieNorm) && phonetics.some(p => text1.includes(p.toLowerCase()))) {
        return 0.98;
      }
    }

    return 0.0;
  }

  /**
   * Remove diacritical marks from text
   *
   * Strips accents and special characters for normalized comparison.
   *
   * @param text - Text with potential diacritics
   * @returns Text with diacritics removed
   *
   * @example
   * removeDiacritics("Pāramitā")
   * // Returns: "Paramita"
   */
  private removeDiacritics(text: string): string {
    let result = text;

    for (const [diacritic, replacement] of Object.entries(DIACRITIC_MAP)) {
      result = result.replace(new RegExp(diacritic, 'g'), replacement);
    }

    // Also use Unicode normalization as fallback
    result = result.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

    return result;
  }

  /**
   * Extract all name variants from NameVariants object
   *
   * Flattens all name arrays into a single list for comparison.
   *
   * @param names - NameVariants object
   * @returns Array of all name strings
   */
  private extractAllNames(names: NameVariants): string[] {
    const allNames: string[] = [];

    if (names.tibetan) allNames.push(...names.tibetan);
    if (names.english) allNames.push(...names.english);
    if (names.phonetic) allNames.push(...names.phonetic);
    if (names.wylie) allNames.push(...names.wylie);
    if (names.sanskrit) allNames.push(...names.sanskrit);
    if (names.chinese) allNames.push(...names.chinese);
    if (names.mongolian) allNames.push(...names.mongolian);

    return allNames.filter(name => name && name.trim().length > 0);
  }

  /**
   * Get recommended threshold based on match context
   *
   * Returns threshold recommendations based on use case:
   * - Automatic merging: Use 0.95+ (very high confidence)
   * - Human review queue: Use 0.85-0.95 (likely matches)
   * - Research exploration: Use 0.75-0.85 (possible matches)
   *
   * @param context - Matching context
   * @returns Recommended threshold
   */
  getRecommendedThreshold(
    context: 'auto_merge' | 'review_queue' | 'exploration'
  ): number {
    switch (context) {
      case 'auto_merge':
        return 0.95; // Very high confidence needed for automatic actions
      case 'review_queue':
        return 0.85; // Likely matches for human review
      case 'exploration':
        return 0.75; // Cast wider net for research
      default:
        return 0.85;
    }
  }

  /**
   * Compare two entities across all their name variants
   *
   * Convenience method that compares the canonical names plus all variants
   * and returns the best match score found.
   *
   * @param entity1 - First entity
   * @param entity2 - Second entity
   * @returns Best similarity score found
   */
  compareEntities(entity1: Entity, entity2: Entity): SimilarityScore {
    // Get all names for both entities
    const names1 = [entity1.canonicalName, ...this.extractAllNames(entity1.names)];
    const names2 = [entity2.canonicalName, ...this.extractAllNames(entity2.names)];

    let bestScore: SimilarityScore = {
      score: 0,
      matchType: 'levenshtein',
      confidence: 0,
      reason: 'No match found',
      components: {
        levenshtein: 0,
        phonetic: 0,
        wordLevel: 0,
        lengthPenalty: 0,
      },
    };

    // Compare all combinations and keep the best score
    for (const name1 of names1) {
      for (const name2 of names2) {
        const score = this.calculateSimilarity(name1, name2);
        if (score.score > bestScore.score) {
          bestScore = score;
        }
      }
    }

    return bestScore;
  }
}

// Export singleton instance for convenience
export const fuzzyMatcher = new FuzzyMatcher();

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Classify similarity score into categories
 *
 * @param score - Similarity score (0.0-1.0)
 * @returns Classification string
 */
export function classifySimilarity(score: number): string {
  if (score >= 0.95) return 'very_likely_same';
  if (score >= 0.85) return 'likely_same';
  if (score >= 0.75) return 'possibly_same';
  return 'probably_different';
}

/**
 * Get human-readable description of similarity level
 *
 * @param score - Similarity score (0.0-1.0)
 * @returns Human-readable description
 */
export function describeSimilarity(score: number): string {
  if (score >= 0.95) return 'Very likely the same entity';
  if (score >= 0.85) return 'Likely the same entity';
  if (score >= 0.75) return 'Possibly the same entity';
  if (score >= 0.50) return 'Probably different entities';
  return 'Definitely different entities';
}
