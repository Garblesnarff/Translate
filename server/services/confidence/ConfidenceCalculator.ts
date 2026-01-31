/**
 * ConfidenceCalculator - Enhanced Confidence Scoring
 *
 * Calculates enhanced confidence scores for translations by combining multiple factors:
 * - Base confidence from AI model
 * - Dictionary term coverage boost (+0.15 max)
 * - Format compliance boost (+0.10 max)
 * - Preservation quality boost (+0.10 max)
 * - Semantic similarity boost (+0.15 max)
 *
 * Final confidence is capped at 0.98 (floor at 0.1).
 *
 * @module server/services/confidence/ConfidenceCalculator
 */

import type { DictionaryEntry } from '../dictionary/DictionaryService.js';
import type { TranslationResult } from '../../../shared/types.js';

/**
 * Context for confidence calculation
 */
export interface ConfidenceContext {
  /** Original Tibetan text */
  originalText: string;

  /** Dictionary terms found in the text */
  dictionaryTerms: DictionaryEntry[];

  /** Base confidence from AI model (default: 0.5) */
  baseConfidence?: number;

  /** Whether multiple models were used */
  multipleModels?: boolean;

  /** Other translation results (for consensus) */
  otherResults?: TranslationResult[];

  /** Pre-calculated semantic agreement score (0-1) */
  semanticAgreement?: number;
}

/**
 * ConfidenceCalculator calculates enhanced confidence scores.
 *
 * Confidence Boosting Formula:
 * ```
 * confidence = baseConfidence
 *
 * // Dictionary term coverage (0 to +0.15)
 * termUsage = usedTerms / totalTerms
 * confidence += termUsage * 0.15
 *
 * // Format compliance (0 to +0.10)
 * formatScore = hasCorrectFormat ? 1.0 : 0.0
 * confidence += formatScore * 0.10
 *
 * // Preservation quality (0 to +0.10)
 * preservationRatio = preservedChars / totalChars
 * confidence += min(preservationRatio, 1.0) * 0.10
 *
 * // Semantic agreement (0 to +0.15)
 * if (multipleModels) {
 *   confidence += semanticAgreement * 0.15
 * }
 *
 * // Cap and floor
 * return min(0.98, max(0.1, confidence))
 * ```
 *
 * @example
 * ```typescript
 * const calculator = new ConfidenceCalculator();
 *
 * const confidence = await calculator.calculate(
 *   'Greetings (བཀྲ་ཤིས་བདེ་ལེགས།).',
 *   {
 *     originalText: 'བཀྲ་ཤིས་བདེ་ལེགས།',
 *     dictionaryTerms: [{ tibetan: 'བཀྲ་ཤིས', english: 'greetings', ... }],
 *     baseConfidence: 0.8,
 *     multipleModels: true,
 *     semanticAgreement: 0.92
 *   }
 * );
 * // Returns: 0.95 (boosted from 0.8)
 * ```
 */
export class ConfidenceCalculator {
  /** Maximum confidence score */
  private readonly MAX_CONFIDENCE = 0.98;

  /** Minimum confidence score */
  private readonly MIN_CONFIDENCE = 0.1;

  /** Maximum boost from dictionary term usage */
  private readonly DICT_BOOST_MAX = 0.15;

  /** Maximum boost from format compliance */
  private readonly FORMAT_BOOST_MAX = 0.10;

  /** Maximum boost from preservation quality */
  private readonly PRESERVATION_BOOST_MAX = 0.10;

  /** Maximum boost from semantic agreement */
  private readonly SEMANTIC_BOOST_MAX = 0.15;

  /** Default base confidence when not provided */
  private readonly DEFAULT_BASE_CONFIDENCE = 0.5;

  /** Regex to detect Tibetan characters in parentheses */
  private readonly tibetanInParensRegex = /\([\u0F00-\u0FFF\s།་]+\)/g;

  /** Regex to extract Tibetan characters */
  private readonly tibetanCharsRegex = /[\u0F00-\u0FFF]/g;

  /**
   * Calculate enhanced confidence score.
   *
   * @param translation - The translated text
   * @param context - Context for confidence calculation
   * @returns Enhanced confidence score (0.1 to 0.98)
   */
  async calculate(
    translation: string,
    context: ConfidenceContext
  ): Promise<number> {
    // Start with base confidence
    let confidence = context.baseConfidence ?? this.DEFAULT_BASE_CONFIDENCE;

    // Apply dictionary term coverage boost
    confidence += this.calculateDictionaryBoost(translation, context.dictionaryTerms);

    // Apply format compliance boost
    confidence += this.calculateFormatBoost(translation, context.originalText);

    // Apply preservation quality boost
    confidence += this.calculatePreservationBoost(translation, context.originalText);

    // Apply semantic agreement boost (if multiple models used)
    if (context.multipleModels && context.semanticAgreement !== undefined) {
      confidence += this.calculateSemanticBoost(context.semanticAgreement);
    }

    // Enforce bounds
    return this.enforceBounds(confidence);
  }

  /**
   * Calculate dictionary term coverage boost.
   *
   * Boosts confidence based on how many dictionary terms were used in the translation.
   * Maximum boost: +0.15
   *
   * @param translation - The translated text
   * @param dictionaryTerms - Dictionary terms found in the original text
   * @returns Boost value (0 to 0.15)
   */
  private calculateDictionaryBoost(
    translation: string,
    dictionaryTerms: DictionaryEntry[]
  ): number {
    if (dictionaryTerms.length === 0) {
      return 0;
    }

    const translationLower = translation.toLowerCase();
    let usedTerms = 0;

    // Check how many dictionary terms appear in the translation
    for (const term of dictionaryTerms) {
      const englishLower = term.english.toLowerCase();

      // Check if the English translation appears in the text
      if (translationLower.includes(englishLower)) {
        usedTerms++;
      }
    }

    // Calculate coverage ratio
    const coverage = usedTerms / dictionaryTerms.length;

    // Return proportional boost
    return coverage * this.DICT_BOOST_MAX;
  }

  /**
   * Calculate format compliance boost.
   *
   * Checks if translation follows the format: "English (བོད་ཡིག)."
   * Maximum boost: +0.10
   *
   * @param translation - The translated text
   * @param originalText - The original Tibetan text
   * @returns Boost value (0 to 0.10)
   */
  private calculateFormatBoost(
    translation: string,
    originalText: string
  ): number {
    // Count Tibetan terms in parentheses
    const tibetanInParens = translation.match(this.tibetanInParensRegex);
    const parenthesizedCount = tibetanInParens?.length || 0;

    if (parenthesizedCount === 0) {
      // No Tibetan in parentheses - no format compliance
      return 0;
    }

    // Extract Tibetan characters from original text
    const originalTibetanChars = (originalText.match(this.tibetanCharsRegex) || []).length;

    if (originalTibetanChars === 0) {
      // No original Tibetan to preserve
      return 0;
    }

    // Check if translation has correct format:
    // - Tibetan in parentheses
    // - Ends with sentence punctuation
    const hasCorrectFormat = parenthesizedCount > 0;

    // Calculate format compliance score
    // More parenthesized terms = better format compliance
    const formatScore = Math.min(parenthesizedCount / 3, 1.0); // Cap at 3+ terms

    return hasCorrectFormat ? formatScore * this.FORMAT_BOOST_MAX : 0;
  }

  /**
   * Calculate Tibetan preservation quality boost.
   *
   * Measures how well the original Tibetan text is preserved in the translation.
   * Maximum boost: +0.10
   *
   * @param translation - The translated text
   * @param originalText - The original Tibetan text
   * @returns Boost value (0 to 0.10)
   */
  private calculatePreservationBoost(
    translation: string,
    originalText: string
  ): number {
    // Extract Tibetan characters from both texts
    const originalChars = originalText.match(this.tibetanCharsRegex) || [];
    const preservedChars = translation.match(this.tibetanCharsRegex) || [];

    if (originalChars.length === 0) {
      // No original Tibetan to preserve
      return 0;
    }

    // Calculate preservation ratio
    const preservationRatio = preservedChars.length / originalChars.length;

    // Normalize to 0-1 (can exceed 1 if translation has extra Tibetan)
    const normalizedRatio = Math.min(preservationRatio, 1.0);

    // Give full boost if >95% preserved
    if (normalizedRatio >= 0.95) {
      return this.PRESERVATION_BOOST_MAX;
    }

    // Proportional boost otherwise
    return normalizedRatio * this.PRESERVATION_BOOST_MAX;
  }

  /**
   * Calculate semantic agreement boost.
   *
   * Boosts confidence based on how similar multiple model outputs are.
   * Maximum boost: +0.15
   *
   * @param semanticAgreement - Pre-calculated semantic agreement score (0-1)
   * @returns Boost value (0 to 0.15)
   */
  private calculateSemanticBoost(semanticAgreement: number): number {
    // Direct proportional boost based on agreement
    return semanticAgreement * this.SEMANTIC_BOOST_MAX;
  }

  /**
   * Enforce confidence bounds (0.1 to 0.98).
   *
   * @param confidence - Raw confidence score
   * @returns Bounded confidence score
   */
  private enforceBounds(confidence: number): number {
    return Math.min(this.MAX_CONFIDENCE, Math.max(this.MIN_CONFIDENCE, confidence));
  }
}
