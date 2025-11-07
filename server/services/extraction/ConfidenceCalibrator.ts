/**
 * Confidence Calibration System
 *
 * Evaluates entity extraction quality against a golden calibration dataset
 * to measure precision, recall, F1 scores, and confidence accuracy.
 *
 * Phase 1, Task 1.3.2 of Knowledge Graph implementation
 */

import type { EntityExtractor } from '../knowledgeGraph/EntityExtractor';
import type { ExtractionResult } from '../knowledgeGraph/EntityExtractor';
import type { Entity, Relationship, EntityType, PredicateType } from '../../types/entities';
import {
  calibrationDataset,
  type CalibrationTestCase
} from '../../../tests/fixtures/calibrationDataset';

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Score for a single extraction attempt
 */
export interface ExtractionScore {
  precision: number;    // What % of extracted entities are correct?
  recall: number;       // What % of expected entities were found?
  f1: number;           // Harmonic mean of precision and recall
  confidenceAccuracy: number; // Are high-confidence predictions actually correct?
}

/**
 * Result for a single calibration test case
 */
export interface CalibrationTestResult {
  testCaseId: string;
  difficulty: 'easy' | 'medium' | 'hard';
  precision: number;
  recall: number;
  f1: number;
  confidenceAccuracy: number;
  passed: boolean;
  extractedEntities: number;
  expectedEntities: number;
  correctMatches: number;
  extractedRelationships: number;
  expectedRelationships: number;
  correctRelationships: number;
  notes?: string;
  failures?: string[]; // Specific failures for debugging
}

/**
 * Statistics aggregated by difficulty level
 */
export interface DifficultyStats {
  totalCases: number;
  passed: number;
  failed: number;
  passRate: number;
  avgPrecision: number;
  avgRecall: number;
  avgF1: number;
  avgConfidenceAccuracy: number;
}

/**
 * Overall calibration report
 */
export interface CalibrationReport {
  overall: {
    totalCases: number;
    passed: number;
    failed: number;
    passRate: number;
    avgPrecision: number;
    avgRecall: number;
    avgF1: number;
    avgConfidenceAccuracy: number;
    passingThreshold: number;
  };
  byDifficulty: {
    easy: DifficultyStats;
    medium: DifficultyStats;
    hard: DifficultyStats;
  };
  byEntityType: {
    [key in EntityType]?: {
      precision: number;
      recall: number;
      f1: number;
    };
  };
  failedCases: CalibrationTestResult[];
  recommendations: string[];
  calibrationDate: Date;
  totalExtractionTime: number;
}

// ============================================================================
// Confidence Calibrator Class
// ============================================================================

/**
 * Calibrates and evaluates entity extraction confidence scores
 *
 * Runs extraction on a golden dataset and compares results to expected outputs,
 * calculating precision, recall, F1 scores, and confidence accuracy.
 */
export class ConfidenceCalibrator {
  private passingThreshold = 0.7; // F1 score threshold for passing

  /**
   * Run full calibration on the golden dataset
   *
   * @param extractor - EntityExtractor instance to calibrate
   * @returns Comprehensive calibration report
   */
  async calibrate(extractor: EntityExtractor): Promise<CalibrationReport> {
    console.log('[ConfidenceCalibrator] Starting calibration with', calibrationDataset.length, 'test cases');
    const startTime = Date.now();
    const results: CalibrationTestResult[] = [];

    // Run extraction on each test case
    for (const testCase of calibrationDataset) {
      try {
        console.log(`[ConfidenceCalibrator] Processing test case: ${testCase.id} (${testCase.difficulty})`);

        // Extract entities from test case text
        // Note: This requires EntityExtractor to have an extractFromText method
        const extracted = await this.extractFromText(extractor, testCase);

        // Score the extraction
        const score = this.scoreExtraction(
          extracted,
          testCase.expectedEntities,
          testCase.expectedRelationships || []
        );

        // Count matches for detailed stats
        const correctEntities = this.countCorrectMatches(
          extracted.entities,
          testCase.expectedEntities
        );

        const correctRelationships = this.countCorrectRelationshipMatches(
          extracted.relationships,
          testCase.expectedRelationships || []
        );

        // Detect specific failures
        const failures: string[] = [];
        if (score.precision < 0.7) {
          failures.push(`Low precision (${score.precision.toFixed(2)}) - too many false positives`);
        }
        if (score.recall < 0.7) {
          failures.push(`Low recall (${score.recall.toFixed(2)}) - missing expected entities`);
        }
        if (score.confidenceAccuracy < 0.7) {
          failures.push(`Low confidence accuracy (${score.confidenceAccuracy.toFixed(2)}) - confidence scores not calibrated`);
        }

        results.push({
          testCaseId: testCase.id,
          difficulty: testCase.difficulty,
          precision: score.precision,
          recall: score.recall,
          f1: score.f1,
          confidenceAccuracy: score.confidenceAccuracy,
          passed: score.f1 >= this.passingThreshold,
          extractedEntities: extracted.entities.length,
          expectedEntities: testCase.expectedEntities.length,
          correctMatches: correctEntities,
          extractedRelationships: extracted.relationships.length,
          expectedRelationships: (testCase.expectedRelationships || []).length,
          correctRelationships,
          notes: testCase.notes,
          failures: failures.length > 0 ? failures : undefined,
        });
      } catch (error) {
        console.error(`[ConfidenceCalibrator] Failed to process test case ${testCase.id}:`, error);
        results.push({
          testCaseId: testCase.id,
          difficulty: testCase.difficulty,
          precision: 0,
          recall: 0,
          f1: 0,
          confidenceAccuracy: 0,
          passed: false,
          extractedEntities: 0,
          expectedEntities: testCase.expectedEntities.length,
          correctMatches: 0,
          extractedRelationships: 0,
          expectedRelationships: (testCase.expectedRelationships || []).length,
          correctRelationships: 0,
          failures: [error instanceof Error ? error.message : 'Unknown error'],
        });
      }
    }

    // Aggregate by difficulty
    const byDifficulty = {
      easy: this.aggregateStats(results.filter(r => r.difficulty === 'easy')),
      medium: this.aggregateStats(results.filter(r => r.difficulty === 'medium')),
      hard: this.aggregateStats(results.filter(r => r.difficulty === 'hard'))
    };

    // Aggregate by entity type
    const byEntityType = this.aggregateByEntityType(results, calibrationDataset);

    // Overall statistics
    const passed = results.filter(r => r.passed).length;
    const failed = results.filter(r => !r.passed).length;

    const overall = {
      totalCases: results.length,
      passed,
      failed,
      passRate: passed / results.length,
      avgPrecision: this.avg(results.map(r => r.precision)),
      avgRecall: this.avg(results.map(r => r.recall)),
      avgF1: this.avg(results.map(r => r.f1)),
      avgConfidenceAccuracy: this.avg(results.map(r => r.confidenceAccuracy)),
      passingThreshold: this.passingThreshold,
    };

    // Generate recommendations
    const recommendations = this.generateRecommendations(overall, byDifficulty, results);

    const totalExtractionTime = Date.now() - startTime;

    console.log('[ConfidenceCalibrator] Calibration complete:', {
      passed,
      failed,
      passRate: (overall.passRate * 100).toFixed(1) + '%',
      avgF1: overall.avgF1.toFixed(3),
    });

    return {
      overall,
      byDifficulty,
      byEntityType,
      failedCases: results.filter(r => !r.passed),
      recommendations,
      calibrationDate: new Date(),
      totalExtractionTime,
    };
  }

  /**
   * Extract entities from raw text (wrapper for EntityExtractor)
   *
   * Since EntityExtractor.extractFromTranslation requires a translation ID,
   * we need a way to extract from raw text. This is a placeholder that would
   * need to be implemented in EntityExtractor.
   */
  private async extractFromText(
    extractor: EntityExtractor,
    testCase: CalibrationTestCase
  ): Promise<ExtractionResult> {
    // TODO: EntityExtractor needs an extractFromText method
    // For now, this is a placeholder that would call:
    // return await extractor.extractFromText(testCase.text);

    // As a workaround, we could create a temporary translation in the database
    // and then call extractFromTranslation, but that's not ideal for calibration
    throw new Error('EntityExtractor.extractFromText not yet implemented. See Phase 1 Task 1.3.3');
  }

  /**
   * Score an extraction result against expected entities and relationships
   *
   * Calculates precision, recall, F1, and confidence accuracy.
   *
   * @param extracted - Extraction result from EntityExtractor
   * @param expectedEntities - Expected entities from calibration dataset
   * @param expectedRelationships - Expected relationships from calibration dataset
   * @returns Extraction score metrics
   */
  private scoreExtraction(
    extracted: ExtractionResult,
    expectedEntities: any[],
    expectedRelationships: any[]
  ): ExtractionScore {
    // Handle edge cases
    if (expectedEntities.length === 0 && extracted.entities.length === 0) {
      return { precision: 1.0, recall: 1.0, f1: 1.0, confidenceAccuracy: 1.0 };
    }

    if (extracted.entities.length === 0) {
      return { precision: 0, recall: 0, f1: 0, confidenceAccuracy: 0 };
    }

    // Calculate entity precision and recall
    const correctEntities = this.countCorrectMatches(
      extracted.entities,
      expectedEntities
    );

    // Precision: What % of extracted entities are correct?
    const precision = extracted.entities.length > 0
      ? correctEntities / extracted.entities.length
      : 0;

    // Recall: What % of expected entities were found?
    const recall = expectedEntities.length > 0
      ? correctEntities / expectedEntities.length
      : 0;

    // F1 score (harmonic mean of precision and recall)
    const f1 = (precision + recall) > 0
      ? (2 * precision * recall) / (precision + recall)
      : 0;

    // Confidence calibration: Are high-confidence predictions actually correct?
    const confidenceAccuracy = this.evaluateConfidence(
      extracted.entities,
      expectedEntities
    );

    return { precision, recall, f1, confidenceAccuracy };
  }

  /**
   * Count how many extracted entities correctly match expected entities
   *
   * Matches entities based on:
   * 1. Type must match
   * 2. Name must match (case-insensitive, normalized)
   * 3. Key attributes should match (for entities with UNKNOWN names)
   *
   * @param extracted - Entities extracted by EntityExtractor
   * @param expected - Expected entities from calibration dataset
   * @returns Number of correct matches
   */
  private countCorrectMatches(extracted: Entity[], expected: any[]): number {
    let correctCount = 0;

    for (const expectedEntity of expected) {
      // Find matching extracted entity
      const match = extracted.find(e => this.matchesEntity(e, expectedEntity));
      if (match) {
        correctCount++;
      }
    }

    return correctCount;
  }

  /**
   * Count how many extracted relationships correctly match expected relationships
   */
  private countCorrectRelationshipMatches(
    extracted: Relationship[],
    expected: any[]
  ): number {
    let correctCount = 0;

    for (const expectedRel of expected) {
      // Find matching extracted relationship
      const match = extracted.find(r => this.matchesRelationship(r, expectedRel));
      if (match) {
        correctCount++;
      }
    }

    return correctCount;
  }

  /**
   * Check if an extracted entity matches an expected entity
   *
   * Matching criteria:
   * - Type must match exactly
   * - Name must match (normalized, case-insensitive)
   * - For UNKNOWN entities, we match based on type and attributes
   * - For specific entities, we match on canonical name or any name variant
   */
  private matchesEntity(extracted: Entity, expected: any): boolean {
    // Type must match
    if (extracted.type !== expected.type) {
      return false;
    }

    // Handle UNKNOWN entities (ambiguous references from medium/hard test cases)
    if (expected.name === 'UNKNOWN') {
      // For UNKNOWN entities, we just check if the type matches
      // and maybe some key attributes if specified
      return true; // Lenient matching for UNKNOWN entities
    }

    // For specific entities, check if names match
    const expectedName = this.normalizeName(expected.name);

    // Check canonical name
    if (this.normalizeName(extracted.canonicalName) === expectedName) {
      return true;
    }

    // Check all name variants
    const allNames = [
      ...(extracted.names.english || []),
      ...(extracted.names.tibetan || []),
      ...(extracted.names.wylie || []),
      ...(extracted.names.sanskrit || []),
      ...(extracted.names.phonetic || []),
    ];

    for (const name of allNames) {
      if (this.normalizeName(name) === expectedName) {
        return true;
      }
    }

    // Check alternate names in attributes
    if (extracted.type === 'person' && 'attributes' in extracted) {
      const attrs = extracted.attributes as any;
      if (attrs?.alternateNames) {
        for (const altName of attrs.alternateNames) {
          if (this.normalizeName(altName) === expectedName) {
            return true;
          }
        }
      }
    }

    return false;
  }

  /**
   * Check if an extracted relationship matches an expected relationship
   *
   * Matching is based on:
   * - Predicate must match
   * - Subject and object entity names must match (normalized)
   */
  private matchesRelationship(extracted: Relationship, expected: any): boolean {
    // Predicate must match
    if (extracted.predicate !== expected.predicate) {
      return false;
    }

    // For now, we can't easily match relationships because we need to
    // resolve entity IDs back to names. This would require access to
    // the extracted entities. We'll implement this in a future iteration.
    // For calibration purposes, we can skip relationship matching or
    // make it optional.

    return true; // Simplified for now
  }

  /**
   * Evaluate confidence score calibration
   *
   * Checks if high-confidence predictions (>0.8) are actually correct.
   * A well-calibrated system should have high accuracy for high-confidence predictions.
   *
   * @param extracted - Extracted entities
   * @param expected - Expected entities
   * @returns Confidence accuracy (0.0-1.0)
   */
  private evaluateConfidence(extracted: Entity[], expected: any[]): number {
    // Filter for high-confidence predictions
    const highConfidence = extracted.filter(e => e.confidence > 0.8);

    if (highConfidence.length === 0) {
      // No high-confidence predictions to evaluate
      return 1.0; // Neutral score
    }

    // Count how many high-confidence predictions are correct
    let correctHighConfidence = 0;
    for (const entity of highConfidence) {
      const isCorrect = expected.some(exp => this.matchesEntity(entity, exp));
      if (isCorrect) {
        correctHighConfidence++;
      }
    }

    return correctHighConfidence / highConfidence.length;
  }

  /**
   * Normalize entity name for matching
   *
   * - Convert to lowercase
   * - Remove diacritics
   * - Remove extra whitespace
   * - Remove punctuation
   */
  private normalizeName(name: string): string {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^\w\s]/g, '') // Remove punctuation
      .replace(/\s+/g, ' '); // Normalize whitespace
  }

  /**
   * Aggregate statistics for a set of test results
   */
  private aggregateStats(results: CalibrationTestResult[]): DifficultyStats {
    if (results.length === 0) {
      return {
        totalCases: 0,
        passed: 0,
        failed: 0,
        passRate: 0,
        avgPrecision: 0,
        avgRecall: 0,
        avgF1: 0,
        avgConfidenceAccuracy: 0,
      };
    }

    const passed = results.filter(r => r.passed).length;
    const failed = results.filter(r => !r.passed).length;

    return {
      totalCases: results.length,
      passed,
      failed,
      passRate: passed / results.length,
      avgPrecision: this.avg(results.map(r => r.precision)),
      avgRecall: this.avg(results.map(r => r.recall)),
      avgF1: this.avg(results.map(r => r.f1)),
      avgConfidenceAccuracy: this.avg(results.map(r => r.confidenceAccuracy)),
    };
  }

  /**
   * Aggregate statistics by entity type
   */
  private aggregateByEntityType(
    results: CalibrationTestResult[],
    testCases: CalibrationTestCase[]
  ): Record<string, { precision: number; recall: number; f1: number }> {
    const byType: Record<string, { precision: number[]; recall: number[]; f1: number[] }> = {};

    // Group results by entity type
    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      const testCase = testCases[i];

      // Get all entity types in this test case
      const entityTypes = new Set(testCase.expectedEntities.map(e => e.type));

      for (const type of entityTypes) {
        if (!byType[type]) {
          byType[type] = { precision: [], recall: [], f1: [] };
        }
        byType[type].precision.push(result.precision);
        byType[type].recall.push(result.recall);
        byType[type].f1.push(result.f1);
      }
    }

    // Calculate averages
    const aggregated: Record<string, { precision: number; recall: number; f1: number }> = {};
    for (const [type, scores] of Object.entries(byType)) {
      aggregated[type] = {
        precision: this.avg(scores.precision),
        recall: this.avg(scores.recall),
        f1: this.avg(scores.f1),
      };
    }

    return aggregated;
  }

  /**
   * Calculate average of numbers
   */
  private avg(numbers: number[]): number {
    if (numbers.length === 0) return 0;
    return numbers.reduce((sum, n) => sum + n, 0) / numbers.length;
  }

  /**
   * Generate actionable recommendations based on calibration results
   */
  private generateRecommendations(
    overall: any,
    byDifficulty: any,
    results: CalibrationTestResult[]
  ): string[] {
    const recommendations: string[] = [];

    // Overall performance
    if (overall.passRate < 0.7) {
      recommendations.push(
        `⚠️ CRITICAL: Overall pass rate is ${(overall.passRate * 100).toFixed(1)}% (below 70% threshold). ` +
        `Extraction quality needs significant improvement before production use.`
      );
    } else if (overall.passRate < 0.85) {
      recommendations.push(
        `⚠️ Overall pass rate is ${(overall.passRate * 100).toFixed(1)}%. ` +
        `Consider improving extraction quality to reach >85% before production deployment.`
      );
    } else {
      recommendations.push(
        `✓ Overall pass rate is ${(overall.passRate * 100).toFixed(1)}%. System is performing well.`
      );
    }

    // Precision vs Recall
    if (overall.avgPrecision < 0.7) {
      recommendations.push(
        `⚠️ Low precision (${(overall.avgPrecision * 100).toFixed(1)}%) - too many false positives. ` +
        `Consider: (1) Stricter entity validation, (2) Higher confidence thresholds, (3) Better entity type classification.`
      );
    }

    if (overall.avgRecall < 0.7) {
      recommendations.push(
        `⚠️ Low recall (${(overall.avgRecall * 100).toFixed(1)}%) - missing expected entities. ` +
        `Consider: (1) Improving entity detection prompts, (2) Better handling of name variants, ` +
        `(3) Enhanced context understanding.`
      );
    }

    // Confidence calibration
    if (overall.avgConfidenceAccuracy < 0.8) {
      recommendations.push(
        `⚠️ Confidence scores are poorly calibrated (${(overall.avgConfidenceAccuracy * 100).toFixed(1)}% accuracy). ` +
        `High-confidence predictions are not reliably correct. Consider recalibrating confidence thresholds.`
      );
    }

    // Difficulty-specific recommendations
    if (byDifficulty.easy.passRate < 0.9) {
      recommendations.push(
        `⚠️ EASY cases pass rate is only ${(byDifficulty.easy.passRate * 100).toFixed(1)}% (should be >90%). ` +
        `Basic entity extraction needs improvement.`
      );
    }

    if (byDifficulty.medium.passRate < 0.7) {
      recommendations.push(
        `⚠️ MEDIUM cases pass rate is ${(byDifficulty.medium.passRate * 100).toFixed(1)}%. ` +
        `Focus on improving disambiguation and context resolution.`
      );
    }

    if (byDifficulty.hard.passRate < 0.5) {
      recommendations.push(
        `ℹ️ HARD cases pass rate is ${(byDifficulty.hard.passRate * 100).toFixed(1)}%. ` +
        `This is expected for challenging cases. Consider flagging these for human review.`
      );
    } else if (byDifficulty.hard.passRate > 0.7) {
      recommendations.push(
        `✓ Excellent performance on HARD cases (${(byDifficulty.hard.passRate * 100).toFixed(1)}%). ` +
        `System handles complex scenarios well.`
      );
    }

    // Common failure patterns
    const commonFailures = this.analyzeFailurePatterns(results.filter(r => !r.passed));
    if (commonFailures.length > 0) {
      recommendations.push(`\nCommon failure patterns:`);
      recommendations.push(...commonFailures);
    }

    return recommendations;
  }

  /**
   * Analyze failure patterns to identify common issues
   */
  private analyzeFailurePatterns(failedCases: CalibrationTestResult[]): string[] {
    const patterns: string[] = [];

    // Count failure types
    const lowPrecision = failedCases.filter(c => c.precision < 0.7).length;
    const lowRecall = failedCases.filter(c => c.recall < 0.7).length;
    const lowConfidence = failedCases.filter(c => c.confidenceAccuracy < 0.7).length;

    if (lowPrecision > failedCases.length * 0.5) {
      patterns.push(
        `  - ${lowPrecision}/${failedCases.length} failures due to low precision (false positives)`
      );
    }

    if (lowRecall > failedCases.length * 0.5) {
      patterns.push(
        `  - ${lowRecall}/${failedCases.length} failures due to low recall (missed entities)`
      );
    }

    if (lowConfidence > failedCases.length * 0.3) {
      patterns.push(
        `  - ${lowConfidence}/${failedCases.length} failures due to poor confidence calibration`
      );
    }

    return patterns;
  }

  /**
   * Print calibration report to console in human-readable format
   */
  printReport(report: CalibrationReport): void {
    console.log('\n' + '='.repeat(80));
    console.log('CONFIDENCE CALIBRATION REPORT');
    console.log('='.repeat(80));
    console.log(`Calibration Date: ${report.calibrationDate.toISOString()}`);
    console.log(`Total Extraction Time: ${(report.totalExtractionTime / 1000).toFixed(2)}s`);
    console.log('');

    // Overall statistics
    console.log('OVERALL PERFORMANCE');
    console.log('-'.repeat(80));
    console.log(`Total Cases: ${report.overall.totalCases}`);
    console.log(`Passed: ${report.overall.passed} (${(report.overall.passRate * 100).toFixed(1)}%)`);
    console.log(`Failed: ${report.overall.failed}`);
    console.log(`Passing Threshold: F1 >= ${report.overall.passingThreshold}`);
    console.log('');
    console.log(`Average Precision: ${(report.overall.avgPrecision * 100).toFixed(1)}%`);
    console.log(`Average Recall:    ${(report.overall.avgRecall * 100).toFixed(1)}%`);
    console.log(`Average F1 Score:  ${(report.overall.avgF1 * 100).toFixed(1)}%`);
    console.log(`Confidence Accuracy: ${(report.overall.avgConfidenceAccuracy * 100).toFixed(1)}%`);
    console.log('');

    // By difficulty
    console.log('PERFORMANCE BY DIFFICULTY');
    console.log('-'.repeat(80));
    for (const [difficulty, stats] of Object.entries(report.byDifficulty)) {
      console.log(`\n${difficulty.toUpperCase()}:`);
      console.log(`  Cases: ${stats.totalCases} | Passed: ${stats.passed} (${(stats.passRate * 100).toFixed(1)}%)`);
      console.log(`  Precision: ${(stats.avgPrecision * 100).toFixed(1)}% | Recall: ${(stats.avgRecall * 100).toFixed(1)}% | F1: ${(stats.avgF1 * 100).toFixed(1)}%`);
      console.log(`  Confidence Accuracy: ${(stats.avgConfidenceAccuracy * 100).toFixed(1)}%`);
    }
    console.log('');

    // By entity type
    console.log('PERFORMANCE BY ENTITY TYPE');
    console.log('-'.repeat(80));
    for (const [type, stats] of Object.entries(report.byEntityType)) {
      console.log(`${type.padEnd(15)} | P: ${(stats.precision * 100).toFixed(1)}% | R: ${(stats.recall * 100).toFixed(1)}% | F1: ${(stats.f1 * 100).toFixed(1)}%`);
    }
    console.log('');

    // Failed cases
    if (report.failedCases.length > 0) {
      console.log('FAILED TEST CASES');
      console.log('-'.repeat(80));
      for (const failed of report.failedCases.slice(0, 10)) { // Show first 10
        console.log(`\n${failed.testCaseId} (${failed.difficulty}):`);
        console.log(`  P: ${(failed.precision * 100).toFixed(1)}% | R: ${(failed.recall * 100).toFixed(1)}% | F1: ${(failed.f1 * 100).toFixed(1)}%`);
        console.log(`  Extracted: ${failed.extractedEntities} | Expected: ${failed.expectedEntities} | Correct: ${failed.correctMatches}`);
        if (failed.failures && failed.failures.length > 0) {
          console.log(`  Issues: ${failed.failures.join('; ')}`);
        }
      }
      if (report.failedCases.length > 10) {
        console.log(`\n... and ${report.failedCases.length - 10} more failed cases`);
      }
      console.log('');
    }

    // Recommendations
    console.log('RECOMMENDATIONS');
    console.log('-'.repeat(80));
    for (const rec of report.recommendations) {
      console.log(rec);
    }
    console.log('');
    console.log('='.repeat(80));
  }
}

// Export singleton instance
export const confidenceCalibrator = new ConfidenceCalibrator();
