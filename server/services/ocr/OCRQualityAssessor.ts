// File: server/services/ocr/OCRQualityAssessor.ts
// Assesses OCR quality for extracted text

import type { OCRResult, QualityAssessment } from './types';
import { QUALITY_THRESHOLDS, SUSPICIOUS_PATTERNS } from './config';

/**
 * OCRQualityAssessor for evaluating OCR extraction quality
 *
 * Features:
 * - Assesses Tibetan character ratio
 * - Evaluates confidence scores
 * - Detects suspicious patterns
 * - Returns quality score (0-1)
 * - Provides warnings for quality issues
 */
export class OCRQualityAssessor {
  /**
   * Assess OCR quality
   *
   * @param result - OCR result to assess
   * @returns Quality assessment
   */
  assessQuality(result: OCRResult): QualityAssessment {
    const warnings: string[] = [];

    // Calculate Tibetan character ratio
    const tibetanRatio = this.calculateTibetanRatio(result.text);

    // Check Tibetan ratio
    if (tibetanRatio < QUALITY_THRESHOLDS.MIN_TIBETAN_RATIO) {
      warnings.push(
        `Low Tibetan character ratio (${(tibetanRatio * 100).toFixed(1)}%)`
      );
    }

    // Check confidence
    const avgConfidence = result.confidence;
    if (avgConfidence < QUALITY_THRESHOLDS.MIN_QUALITY) {
      warnings.push(
        `Low OCR confidence (${(avgConfidence * 100).toFixed(1)}%)`
      );
    }

    // Check for suspicious patterns
    const suspiciousFound = this.detectSuspiciousPatterns(result.text);
    if (suspiciousFound.length > 0) {
      warnings.push(
        `Suspicious patterns detected: ${suspiciousFound.join(', ')}`
      );
    }

    // Calculate overall quality score
    const score = this.calculateQualityScore(
      tibetanRatio,
      avgConfidence,
      suspiciousFound.length
    );

    return {
      score,
      tibetanRatio,
      avgConfidence,
      isAcceptable: score >= QUALITY_THRESHOLDS.MIN_QUALITY,
      warnings,
    };
  }

  /**
   * Assess batch of OCR results
   *
   * @param results - Array of OCR results
   * @returns Quality assessment for entire batch
   */
  assessBatch(results: OCRResult[]): QualityAssessment {
    if (results.length === 0) {
      return {
        score: 0,
        tibetanRatio: 0,
        avgConfidence: 0,
        isAcceptable: false,
        warnings: ['No results to assess'],
      };
    }

    // Combine all text
    const combinedText = results.map((r) => r.text).join('\n');

    // Calculate average confidence
    const avgConfidence =
      results.reduce((sum, r) => sum + r.confidence, 0) / results.length;

    // Calculate Tibetan ratio
    const tibetanRatio = this.calculateTibetanRatio(combinedText);

    // Check for suspicious patterns
    const suspiciousFound = this.detectSuspiciousPatterns(combinedText);

    const warnings: string[] = [];

    if (tibetanRatio < QUALITY_THRESHOLDS.MIN_TIBETAN_RATIO) {
      warnings.push(
        `Low Tibetan character ratio (${(tibetanRatio * 100).toFixed(1)}%)`
      );
    }

    if (avgConfidence < QUALITY_THRESHOLDS.MIN_QUALITY) {
      warnings.push(
        `Low average OCR confidence (${(avgConfidence * 100).toFixed(1)}%)`
      );
    }

    if (suspiciousFound.length > 0) {
      warnings.push(
        `Suspicious patterns detected: ${suspiciousFound.join(', ')}`
      );
    }

    // Check individual page quality variance
    const confidenceStdDev = this.calculateStandardDeviation(
      results.map((r) => r.confidence)
    );
    if (confidenceStdDev > 0.3) {
      warnings.push('High variance in page quality');
    }

    const score = this.calculateQualityScore(
      tibetanRatio,
      avgConfidence,
      suspiciousFound.length
    );

    return {
      score,
      tibetanRatio,
      avgConfidence,
      isAcceptable: score >= QUALITY_THRESHOLDS.MIN_QUALITY,
      warnings,
    };
  }

  /**
   * Calculate Tibetan character ratio
   *
   * @param text - Text to analyze
   * @returns Ratio of Tibetan characters (0-1)
   */
  private calculateTibetanRatio(text: string): number {
    if (!text || text.length === 0) {
      return 0;
    }

    // Count Tibetan characters (Unicode range U+0F00-U+0FFF)
    const tibetanChars = text.match(/[\u0F00-\u0FFF]/g);
    const tibetanCount = tibetanChars ? tibetanChars.length : 0;

    // Count total meaningful characters (exclude whitespace)
    const totalChars = text.replace(/\s/g, '').length;

    return totalChars > 0 ? tibetanCount / totalChars : 0;
  }

  /**
   * Detect suspicious patterns that indicate poor OCR quality
   *
   * @param text - Text to analyze
   * @returns Array of pattern descriptions
   */
  private detectSuspiciousPatterns(text: string): string[] {
    const found: string[] = [];

    for (const pattern of SUSPICIOUS_PATTERNS) {
      if (pattern.test(text)) {
        found.push(pattern.source);
      }
    }

    return found;
  }

  /**
   * Calculate overall quality score
   *
   * @param tibetanRatio - Tibetan character ratio
   * @param confidence - OCR confidence
   * @param suspiciousCount - Number of suspicious patterns
   * @returns Quality score (0-1)
   */
  private calculateQualityScore(
    tibetanRatio: number,
    confidence: number,
    suspiciousCount: number
  ): number {
    // Weighted average
    const tibetanWeight = 0.4;
    const confidenceWeight = 0.5;
    const suspiciousWeight = 0.1;

    // Suspicious penalty (each pattern reduces score)
    const suspiciousPenalty = Math.min(suspiciousCount * 0.1, 0.5);

    const score =
      tibetanRatio * tibetanWeight +
      confidence * confidenceWeight -
      suspiciousPenalty * suspiciousWeight;

    // Clamp to 0-1 range
    return Math.max(0, Math.min(1, score));
  }

  /**
   * Calculate standard deviation
   *
   * @param values - Array of numbers
   * @returns Standard deviation
   */
  private calculateStandardDeviation(values: number[]): number {
    if (values.length === 0) {
      return 0;
    }

    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const squaredDiffs = values.map((val) => Math.pow(val - mean, 2));
    const variance =
      squaredDiffs.reduce((sum, val) => sum + val, 0) / values.length;

    return Math.sqrt(variance);
  }
}
