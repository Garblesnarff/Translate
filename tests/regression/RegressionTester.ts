/**
 * RegressionTester - Automated regression testing framework
 *
 * Features:
 * - Store and compare baseline translations
 * - Semantic similarity-based comparison
 * - Regression score calculation
 * - Version tracking
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

export interface GoldenTranslation {
  id: string;
  tibetan: string;
  expectedEnglish: string;
  category: string;
  complexity: 'simple' | 'medium' | 'complex';
  version: string; // semantic version of baseline
  metadata?: {
    source?: string;
    notes?: string;
    [key: string]: any;
  };
}

export interface TranslationComparison {
  goldenExample: GoldenTranslation;
  actualTranslation: string;
  similarityScore: number; // 0-1, semantic similarity
  confidence: number;
  passed: boolean;
  issues: string[];
}

export interface RegressionResult {
  version: string;
  timestamp: Date;
  totalTests: number;
  passed: number;
  failed: number;
  averageSimilarity: number;
  averageConfidence: number;
  comparisons: TranslationComparison[];
  regressionScore: number; // 0-100, higher is better
  verdict: 'passed' | 'failed' | 'warning';
}

export class RegressionTester {
  private goldenDatasetPath: string;
  private baselinesPath: string;
  private readonly similarityThreshold = 0.75; // Minimum similarity to pass
  private readonly confidenceThreshold = 0.70; // Minimum confidence to pass

  constructor(
    goldenDatasetPath?: string,
    baselinesPath?: string
  ) {
    this.goldenDatasetPath = goldenDatasetPath || join(__dirname, '../fixtures/golden-translations.json');
    this.baselinesPath = baselinesPath || join(__dirname, '../fixtures/baselines');
  }

  /**
   * Load golden dataset from file
   */
  loadGoldenDataset(): GoldenTranslation[] {
    try {
      if (!existsSync(this.goldenDatasetPath)) {
        console.warn(`Golden dataset not found at ${this.goldenDatasetPath}`);
        return [];
      }

      const content = readFileSync(this.goldenDatasetPath, 'utf-8');
      return JSON.parse(content) as GoldenTranslation[];
    } catch (error) {
      console.error('Failed to load golden dataset:', error);
      return [];
    }
  }

  /**
   * Save golden dataset to file
   */
  saveGoldenDataset(dataset: GoldenTranslation[]): void {
    try {
      const content = JSON.stringify(dataset, null, 2);
      writeFileSync(this.goldenDatasetPath, content, 'utf-8');
    } catch (error) {
      console.error('Failed to save golden dataset:', error);
      throw error;
    }
  }

  /**
   * Calculate semantic similarity between two texts
   * Uses simple word overlap for now, should be replaced with embedding-based similarity
   */
  calculateSimilarity(text1: string, text2: string): number {
    // Normalize texts
    const normalize = (text: string) => text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 0);

    const words1 = new Set(normalize(text1));
    const words2 = new Set(normalize(text2));

    // Calculate Jaccard similarity
    const intersection = new Set([...words1].filter(w => words2.has(w)));
    const union = new Set([...words1, ...words2]);

    if (union.size === 0) return 0;
    return intersection.size / union.size;
  }

  /**
   * Compare actual translation with golden example
   */
  compareTranslation(
    goldenExample: GoldenTranslation,
    actualTranslation: string,
    confidence: number
  ): TranslationComparison {
    const issues: string[] = [];

    // Calculate similarity
    const similarityScore = this.calculateSimilarity(
      goldenExample.expectedEnglish,
      actualTranslation
    );

    // Check similarity threshold
    if (similarityScore < this.similarityThreshold) {
      issues.push(`Low similarity score: ${similarityScore.toFixed(2)} (threshold: ${this.similarityThreshold})`);
    }

    // Check confidence threshold
    if (confidence < this.confidenceThreshold) {
      issues.push(`Low confidence: ${confidence.toFixed(2)} (threshold: ${this.confidenceThreshold})`);
    }

    // Check if Tibetan text is preserved
    if (!actualTranslation.includes(goldenExample.tibetan)) {
      issues.push('Original Tibetan text not preserved in translation');
    }

    const passed = issues.length === 0;

    return {
      goldenExample,
      actualTranslation,
      similarityScore,
      confidence,
      passed,
      issues
    };
  }

  /**
   * Run regression tests on a set of translations
   */
  async runRegressionTests(
    translateFunction: (tibetan: string) => Promise<{ translation: string; confidence: number }>,
    version: string,
    filter?: { category?: string; complexity?: string }
  ): Promise<RegressionResult> {
    const goldenDataset = this.loadGoldenDataset();

    // Filter dataset if criteria provided
    let testSet = goldenDataset;
    if (filter) {
      testSet = goldenDataset.filter(example => {
        if (filter.category && example.category !== filter.category) return false;
        if (filter.complexity && example.complexity !== filter.complexity) return false;
        return true;
      });
    }

    if (testSet.length === 0) {
      throw new Error('No golden examples found matching filter criteria');
    }

    // Run translations
    const comparisons: TranslationComparison[] = [];
    for (const goldenExample of testSet) {
      try {
        const { translation, confidence } = await translateFunction(goldenExample.tibetan);
        const comparison = this.compareTranslation(goldenExample, translation, confidence);
        comparisons.push(comparison);
      } catch (error: any) {
        // Record failed translation
        comparisons.push({
          goldenExample,
          actualTranslation: '',
          similarityScore: 0,
          confidence: 0,
          passed: false,
          issues: [`Translation failed: ${error.message}`]
        });
      }
    }

    // Calculate statistics
    const passed = comparisons.filter(c => c.passed).length;
    const failed = comparisons.length - passed;
    const averageSimilarity = comparisons.reduce((sum, c) => sum + c.similarityScore, 0) / comparisons.length;
    const averageConfidence = comparisons.reduce((sum, c) => sum + c.confidence, 0) / comparisons.length;

    // Calculate regression score (0-100)
    const regressionScore = Math.round(
      (passed / comparisons.length) * 50 + // 50% weight on pass rate
      averageSimilarity * 30 + // 30% weight on similarity
      averageConfidence * 20 // 20% weight on confidence
    );

    // Determine verdict
    let verdict: 'passed' | 'failed' | 'warning';
    if (regressionScore >= 85 && failed === 0) {
      verdict = 'passed';
    } else if (regressionScore < 70 || failed > comparisons.length * 0.2) {
      verdict = 'failed';
    } else {
      verdict = 'warning';
    }

    return {
      version,
      timestamp: new Date(),
      totalTests: comparisons.length,
      passed,
      failed,
      averageSimilarity,
      averageConfidence,
      comparisons,
      regressionScore,
      verdict
    };
  }

  /**
   * Save baseline results for future comparison
   */
  saveBaseline(result: RegressionResult): void {
    try {
      const baselineFile = join(this.baselinesPath, `baseline-${result.version}.json`);
      const content = JSON.stringify(result, null, 2);
      writeFileSync(baselineFile, content, 'utf-8');
      console.log(`✓ Baseline saved: ${baselineFile}`);
    } catch (error) {
      console.error('Failed to save baseline:', error);
      throw error;
    }
  }

  /**
   * Load baseline results
   */
  loadBaseline(version: string): RegressionResult | null {
    try {
      const baselineFile = join(this.baselinesPath, `baseline-${version}.json`);
      if (!existsSync(baselineFile)) {
        return null;
      }

      const content = readFileSync(baselineFile, 'utf-8');
      return JSON.parse(content) as RegressionResult;
    } catch (error) {
      console.error('Failed to load baseline:', error);
      return null;
    }
  }

  /**
   * Compare current results with baseline
   */
  compareWithBaseline(
    current: RegressionResult,
    baseline: RegressionResult
  ): {
    improved: boolean;
    scoreDelta: number;
    passRateDelta: number;
    significantChanges: string[];
  } {
    const scoreDelta = current.regressionScore - baseline.regressionScore;
    const currentPassRate = current.passed / current.totalTests;
    const baselinePassRate = baseline.passed / baseline.totalTests;
    const passRateDelta = currentPassRate - baselinePassRate;

    const significantChanges: string[] = [];

    if (Math.abs(scoreDelta) >= 5) {
      significantChanges.push(
        `Regression score ${scoreDelta > 0 ? 'improved' : 'degraded'} by ${Math.abs(scoreDelta)} points`
      );
    }

    if (Math.abs(passRateDelta) >= 0.1) {
      significantChanges.push(
        `Pass rate ${passRateDelta > 0 ? 'improved' : 'degraded'} by ${(Math.abs(passRateDelta) * 100).toFixed(1)}%`
      );
    }

    const similarityDelta = current.averageSimilarity - baseline.averageSimilarity;
    if (Math.abs(similarityDelta) >= 0.05) {
      significantChanges.push(
        `Average similarity ${similarityDelta > 0 ? 'improved' : 'degraded'} by ${(Math.abs(similarityDelta) * 100).toFixed(1)}%`
      );
    }

    return {
      improved: scoreDelta > 0,
      scoreDelta,
      passRateDelta,
      significantChanges
    };
  }
}
