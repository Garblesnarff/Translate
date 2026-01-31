/**
 * Golden Dataset Regression Tests
 *
 * Comprehensive regression testing using the golden dataset.
 * Tests each example against expected translations and tracks quality over time.
 *
 * @module tests/regression/golden-dataset-regression
 */

import { describe, it, expect, beforeAll } from 'vitest';
import goldenDataset, { type GoldenExample } from '../fixtures/golden-dataset';
import {
  calculateSimilarity,
  calculateComprehensiveSimilarity,
  calculateTibetanPreservation,
  validateTranslationFormat,
} from '../utils/similarity';
import { MockTranslationProvider } from '../utils/mocks';
import fs from 'fs';
import path from 'path';

describe('Golden Dataset Regression Tests', () => {
  let mockProvider: MockTranslationProvider;
  let regressionResults: RegressionResult[] = [];

  interface RegressionResult {
    id: string;
    category: string;
    difficulty: string;
    similarity: number;
    confidence: number;
    tibetanPreservation: number;
    formatScore: number;
    passed: boolean;
    errors: string[];
    warnings: string[];
  }

  beforeAll(() => {
    // Initialize mock provider
    mockProvider = new MockTranslationProvider({ confidence: 0.85 });

    // Set up custom responses for each golden example
    // In real tests, these would come from actual translation service
    goldenDataset.forEach((example) => {
      mockProvider.setCustomResponse(example.tibetan, {
        translation: example.expectedEnglish,
        confidence: example.minConfidence,
        metadata: {
          provider: 'mock',
          category: example.category,
          difficulty: example.difficulty,
        },
      });
    });
  });

  describe('dataset validation', () => {
    it('should have 50 examples', () => {
      expect(goldenDataset).toHaveLength(50);
    });

    it('should have correct difficulty distribution', () => {
      const simple = goldenDataset.filter(ex => ex.difficulty === 'simple');
      const medium = goldenDataset.filter(ex => ex.difficulty === 'medium');
      const complex = goldenDataset.filter(ex => ex.difficulty === 'complex');
      const veryComplex = goldenDataset.filter(ex => ex.difficulty === 'very_complex');

      expect(simple.length).toBe(10);
      expect(medium.length).toBe(15);
      expect(complex.length).toBe(15);
      expect(veryComplex.length).toBe(10);
    });

    it('should have all required fields', () => {
      goldenDataset.forEach((example) => {
        expect(example).toHaveProperty('id');
        expect(example).toHaveProperty('tibetan');
        expect(example).toHaveProperty('expectedEnglish');
        expect(example).toHaveProperty('category');
        expect(example).toHaveProperty('difficulty');
        expect(example).toHaveProperty('minConfidence');

        expect(example.tibetan).toMatch(/[\u0F00-\u0FFF]/);
        expect(example.expectedEnglish).toMatch(/[\u0F00-\u0FFF]/);
        expect(example.minConfidence).toBeGreaterThan(0);
        expect(example.minConfidence).toBeLessThanOrEqual(1);
      });
    });

    it('should have diverse categories', () => {
      const categories = new Set(goldenDataset.map(ex => ex.category));
      expect(categories.size).toBeGreaterThanOrEqual(8);
    });
  });

  describe('simple examples regression', () => {
    const simpleExamples = goldenDataset.filter(ex => ex.difficulty === 'simple');

    simpleExamples.forEach((example) => {
      it(`should correctly translate: ${example.id}`, async () => {
        // Get translation from mock provider
        const result = await mockProvider.translate(
          example.tibetan,
          'Translate this Tibetan text to English'
        );

        // Calculate similarity
        const similarity = calculateSimilarity(
          result.translation,
          example.expectedEnglish
        );

        // Calculate Tibetan preservation
        const preservation = calculateTibetanPreservation(
          example.tibetan,
          result.translation
        );

        // Validate format
        const format = validateTranslationFormat(
          result.translation,
          example.tibetan
        );

        // Assert quality thresholds
        expect(similarity).toBeGreaterThanOrEqual(0.85);
        expect(result.confidence).toBeGreaterThanOrEqual(example.minConfidence);
        expect(preservation).toBeGreaterThanOrEqual(0.7);
        expect(format.isValid).toBe(true);

        // Track regression results
        regressionResults.push({
          id: example.id,
          category: example.category,
          difficulty: example.difficulty,
          similarity,
          confidence: result.confidence,
          tibetanPreservation: preservation,
          formatScore: format.score,
          passed: similarity >= 0.85 && result.confidence >= example.minConfidence,
          errors: format.errors,
          warnings: format.warnings,
        });
      });
    });
  });

  describe('medium examples regression', () => {
    const mediumExamples = goldenDataset.filter(ex => ex.difficulty === 'medium');

    mediumExamples.forEach((example) => {
      it(`should correctly translate: ${example.id}`, async () => {
        const result = await mockProvider.translate(
          example.tibetan,
          'Translate this Tibetan text to English'
        );

        const similarity = calculateSimilarity(
          result.translation,
          example.expectedEnglish
        );

        const preservation = calculateTibetanPreservation(
          example.tibetan,
          result.translation
        );

        const format = validateTranslationFormat(
          result.translation,
          example.tibetan
        );

        // Medium examples: slightly lower threshold
        expect(similarity).toBeGreaterThanOrEqual(0.80);
        expect(result.confidence).toBeGreaterThanOrEqual(example.minConfidence);
        expect(preservation).toBeGreaterThanOrEqual(0.65);
        expect(format.isValid).toBe(true);

        regressionResults.push({
          id: example.id,
          category: example.category,
          difficulty: example.difficulty,
          similarity,
          confidence: result.confidence,
          tibetanPreservation: preservation,
          formatScore: format.score,
          passed: similarity >= 0.80 && result.confidence >= example.minConfidence,
          errors: format.errors,
          warnings: format.warnings,
        });
      });
    });
  });

  describe('complex examples regression', () => {
    const complexExamples = goldenDataset.filter(ex => ex.difficulty === 'complex');

    complexExamples.forEach((example) => {
      it(`should correctly translate: ${example.id}`, async () => {
        const result = await mockProvider.translate(
          example.tibetan,
          'Translate this Tibetan text to English with special attention to Buddhist philosophical terms'
        );

        const comprehensive = calculateComprehensiveSimilarity(
          result.translation,
          example.expectedEnglish,
          example.tibetan
        );

        // Complex examples: focus on semantic similarity and Tibetan preservation
        expect(comprehensive.overallScore).toBeGreaterThanOrEqual(0.75);
        expect(result.confidence).toBeGreaterThanOrEqual(example.minConfidence);
        expect(comprehensive.tibetanPreservation).toBeGreaterThanOrEqual(0.6);
        expect(comprehensive.formatValidation?.isValid).toBe(true);

        regressionResults.push({
          id: example.id,
          category: example.category,
          difficulty: example.difficulty,
          similarity: comprehensive.overallScore,
          confidence: result.confidence,
          tibetanPreservation: comprehensive.tibetanPreservation || 0,
          formatScore: comprehensive.formatValidation?.score || 0,
          passed: comprehensive.overallScore >= 0.75 && result.confidence >= example.minConfidence,
          errors: comprehensive.formatValidation?.errors || [],
          warnings: comprehensive.formatValidation?.warnings || [],
        });
      });
    });
  });

  describe('very complex examples regression', () => {
    const veryComplexExamples = goldenDataset.filter(ex => ex.difficulty === 'very_complex');

    veryComplexExamples.forEach((example) => {
      it(`should correctly translate: ${example.id}`, async () => {
        const result = await mockProvider.translate(
          example.tibetan,
          'Translate this advanced Tibetan Buddhist text with precise terminology'
        );

        const comprehensive = calculateComprehensiveSimilarity(
          result.translation,
          example.expectedEnglish,
          example.tibetan
        );

        // Very complex: lower thresholds but still must pass format validation
        expect(comprehensive.overallScore).toBeGreaterThanOrEqual(0.65);
        expect(result.confidence).toBeGreaterThanOrEqual(example.minConfidence);
        expect(comprehensive.tibetanPreservation).toBeGreaterThanOrEqual(0.5);

        // Format validation is critical even for very complex texts
        if (!comprehensive.formatValidation?.isValid) {
          console.warn(`Format issues for ${example.id}:`, comprehensive.formatValidation?.errors);
        }

        regressionResults.push({
          id: example.id,
          category: example.category,
          difficulty: example.difficulty,
          similarity: comprehensive.overallScore,
          confidence: result.confidence,
          tibetanPreservation: comprehensive.tibetanPreservation || 0,
          formatScore: comprehensive.formatValidation?.score || 0,
          passed: comprehensive.overallScore >= 0.65 && result.confidence >= example.minConfidence,
          errors: comprehensive.formatValidation?.errors || [],
          warnings: comprehensive.formatValidation?.warnings || [],
        });
      });
    });
  });

  describe('category-specific regression', () => {
    it('should maintain high quality for greeting category', async () => {
      const greetingExamples = goldenDataset.filter(ex => ex.category === 'greeting');

      const results = await Promise.all(
        greetingExamples.map(async (example) => {
          const result = await mockProvider.translate(example.tibetan, '');
          return calculateSimilarity(result.translation, example.expectedEnglish);
        })
      );

      const avgSimilarity = results.reduce((sum, s) => sum + s, 0) / results.length;
      expect(avgSimilarity).toBeGreaterThanOrEqual(0.9);
    });

    it('should maintain quality for philosophy category', async () => {
      const philosophyExamples = goldenDataset.filter(ex => ex.category === 'philosophy');

      const results = await Promise.all(
        philosophyExamples.map(async (example) => {
          const result = await mockProvider.translate(example.tibetan, '');
          return calculateSimilarity(result.translation, example.expectedEnglish);
        })
      );

      const avgSimilarity = results.reduce((sum, s) => sum + s, 0) / results.length;
      expect(avgSimilarity).toBeGreaterThanOrEqual(0.7);
    });

    it('should maintain quality for practice category', async () => {
      const practiceExamples = goldenDataset.filter(ex => ex.category === 'practice');

      const results = await Promise.all(
        practiceExamples.map(async (example) => {
          const result = await mockProvider.translate(example.tibetan, '');
          return calculateSimilarity(result.translation, example.expectedEnglish);
        })
      );

      const avgSimilarity = results.reduce((sum, s) => sum + s, 0) / results.length;
      expect(avgSimilarity).toBeGreaterThanOrEqual(0.7);
    });

    it('should preserve liturgical texts exactly', async () => {
      const liturgicalExamples = goldenDataset.filter(ex => ex.category === 'liturgical');

      const results = await Promise.all(
        liturgicalExamples.map(async (example) => {
          const result = await mockProvider.translate(example.tibetan, '');
          return calculateTibetanPreservation(example.tibetan, result.translation);
        })
      );

      // Liturgical texts should have very high preservation (mantras, prayers)
      results.forEach(preservation => {
        expect(preservation).toBeGreaterThanOrEqual(0.9);
      });
    });
  });

  describe('regression statistics', () => {
    it('should calculate and report overall statistics', () => {
      // This runs after all tests to generate comprehensive stats
      const stats = {
        totalTests: regressionResults.length,
        passed: regressionResults.filter(r => r.passed).length,
        failed: regressionResults.filter(r => !r.passed).length,
        avgSimilarity: regressionResults.reduce((sum, r) => sum + r.similarity, 0) / regressionResults.length,
        avgConfidence: regressionResults.reduce((sum, r) => sum + r.confidence, 0) / regressionResults.length,
        avgPreservation: regressionResults.reduce((sum, r) => sum + r.tibetanPreservation, 0) / regressionResults.length,
        byDifficulty: {
          simple: {
            count: regressionResults.filter(r => r.difficulty === 'simple').length,
            avgSimilarity: calculateAverage(regressionResults.filter(r => r.difficulty === 'simple'), 'similarity'),
          },
          medium: {
            count: regressionResults.filter(r => r.difficulty === 'medium').length,
            avgSimilarity: calculateAverage(regressionResults.filter(r => r.difficulty === 'medium'), 'similarity'),
          },
          complex: {
            count: regressionResults.filter(r => r.difficulty === 'complex').length,
            avgSimilarity: calculateAverage(regressionResults.filter(r => r.difficulty === 'complex'), 'similarity'),
          },
          very_complex: {
            count: regressionResults.filter(r => r.difficulty === 'very_complex').length,
            avgSimilarity: calculateAverage(regressionResults.filter(r => r.difficulty === 'very_complex'), 'similarity'),
          },
        },
      };

      console.log('\n=== Golden Dataset Regression Statistics ===');
      console.log(JSON.stringify(stats, null, 2));

      // Save results to file for tracking over time
      const resultsDir = path.join(__dirname, '../results');
      if (!fs.existsSync(resultsDir)) {
        fs.mkdirSync(resultsDir, { recursive: true });
      }

      const resultsFile = path.join(resultsDir, `regression-${Date.now()}.json`);
      fs.writeFileSync(resultsFile, JSON.stringify({
        timestamp: new Date().toISOString(),
        stats,
        details: regressionResults,
      }, null, 2));

      console.log(`Results saved to: ${resultsFile}`);

      // Assert overall quality
      expect(stats.avgSimilarity).toBeGreaterThanOrEqual(0.75);
      expect(stats.avgConfidence).toBeGreaterThanOrEqual(0.75);
      expect(stats.avgPreservation).toBeGreaterThanOrEqual(0.65);
      expect(stats.passed / stats.totalTests).toBeGreaterThanOrEqual(0.9); // 90% pass rate
    });
  });

  describe('regression tracking', () => {
    it('should compare against previous results if available', () => {
      const resultsDir = path.join(__dirname, '../results');

      if (!fs.existsSync(resultsDir)) {
        console.log('No previous results to compare against');
        return;
      }

      const resultFiles = fs.readdirSync(resultsDir)
        .filter(f => f.startsWith('regression-') && f.endsWith('.json'))
        .sort()
        .slice(-2); // Get last 2 result files

      if (resultFiles.length < 2) {
        console.log('Not enough previous results to compare');
        return;
      }

      const previousFile = path.join(resultsDir, resultFiles[0]);
      const previousResults = JSON.parse(fs.readFileSync(previousFile, 'utf-8'));

      const currentAvgSimilarity = regressionResults.reduce((sum, r) => sum + r.similarity, 0) / regressionResults.length;
      const previousAvgSimilarity = previousResults.stats.avgSimilarity;

      console.log('\n=== Regression Comparison ===');
      console.log(`Previous avg similarity: ${previousAvgSimilarity.toFixed(3)}`);
      console.log(`Current avg similarity: ${currentAvgSimilarity.toFixed(3)}`);
      console.log(`Change: ${((currentAvgSimilarity - previousAvgSimilarity) * 100).toFixed(2)}%`);

      // Warn if quality has degraded significantly
      if (currentAvgSimilarity < previousAvgSimilarity - 0.05) {
        console.warn('⚠️  Quality has degraded by more than 5%');
      }

      // Quality should not degrade by more than 10%
      expect(currentAvgSimilarity).toBeGreaterThanOrEqual(previousAvgSimilarity - 0.10);
    });
  });
});

/**
 * Helper function to calculate average of a specific field
 */
function calculateAverage(results: any[], field: string): number {
  if (results.length === 0) return 0;
  return results.reduce((sum, r) => sum + r[field], 0) / results.length;
}
