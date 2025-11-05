/**
 * QualityScorer
 *
 * Calculates quality scores for translation results
 * Scores: confidence, format, preservation, and overall
 *
 * @module QualityScorer
 */

import { TranslationResult, QualityScore, QualityWeights } from './types';

/**
 * Default quality weights
 */
const DEFAULT_WEIGHTS: QualityWeights = {
  confidence: 0.4,  // 40%
  format: 0.3,      // 30%
  preservation: 0.3, // 30%
};

/**
 * Extract Tibetan from parentheses
 */
function extractTibetanFromParens(text: string): string {
  const matches = text.matchAll(/\(([^\)]*[\u0F00-\u0FFF][^\)]*)\)/g);
  return Array.from(matches, m => m[1]).join('');
}

/**
 * Calculate Tibetan preservation percentage
 */
function calculatePreservation(original: string, preserved: string): number {
  const origChars = original.match(/[\u0F00-\u0FFF]/g) || [];
  const presChars = preserved.match(/[\u0F00-\u0FFF]/g) || [];

  if (origChars.length === 0) return 1.0; // Nothing to preserve

  return presChars.length / origChars.length;
}

/**
 * Check if text matches expected format
 */
function checkFormat(text: string): number {
  // Check for parentheses
  if (!text.includes('(') || !text.includes(')')) {
    return 0.0;
  }

  // Check for Tibetan inside parentheses
  const tibetanInParens = extractTibetanFromParens(text);
  if (tibetanInParens.length === 0) {
    return 0.0;
  }

  // Check for AI refusal patterns
  const refusalPatterns = [
    /I cannot/i,
    /I apologize/i,
    /I'm unable/i,
    /as an AI/i,
  ];

  for (const pattern of refusalPatterns) {
    if (pattern.test(text)) {
      return 0.0;
    }
  }

  // Format is correct
  return 1.0;
}

/**
 * Quality scorer for translation results
 */
export class QualityScorer {
  private weights: QualityWeights;

  constructor(weights?: Partial<QualityWeights>) {
    // Merge with defaults
    this.weights = { ...DEFAULT_WEIGHTS, ...weights };

    // Normalize weights to sum to 1
    const sum = this.weights.confidence + this.weights.format + this.weights.preservation;
    if (sum !== 1) {
      this.weights.confidence /= sum;
      this.weights.format /= sum;
      this.weights.preservation /= sum;
    }
  }

  /**
   * Calculate quality score for a translation result
   *
   * @param result - Translation result with confidence
   * @param original - Original Tibetan text
   * @returns Quality score breakdown
   */
  public score(result: TranslationResult, original: string): QualityScore {
    // Confidence score (from model, default to 0.5)
    let confidence = result.confidence ?? 0.5;
    // Clamp to [0, 1]
    confidence = Math.max(0, Math.min(1, confidence));

    // Format score (1.0 if correct, 0.0 if wrong)
    const format = checkFormat(result.translation);

    // Preservation score (0-1 based on percentage preserved)
    const preservedTibetan = extractTibetanFromParens(result.translation);
    const preservation = calculatePreservation(original, preservedTibetan);

    // Overall score (weighted average)
    const overall = (
      confidence * this.weights.confidence +
      format * this.weights.format +
      preservation * this.weights.preservation
    );

    return {
      overall,
      confidence,
      format,
      preservation,
    };
  }

  /**
   * Get current weights configuration
   */
  public getWeights(): QualityWeights {
    return { ...this.weights };
  }
}
