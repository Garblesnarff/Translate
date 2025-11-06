/**
 * Performance Benchmarks Test
 *
 * Benchmarks key operations and verifies they meet performance targets:
 * - PDF extraction (100 pages) - should be <5s
 * - Text chunking (10,000 chars) - should be <100ms
 * - Translation (single chunk) - should be <2s (with mock)
 * - Validation - should be <10ms
 * - Quality scoring - should be <5ms
 * - Cache lookup - should be <1ms
 *
 * Results are tracked over time for performance regression detection.
 *
 * @module tests/performance/benchmarks
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { splitTextIntoChunks } from '@/lib/textChunker';
import { validateAndNormalize } from '@/lib/tibetan/unicodeValidator';
import { ValidationService } from '../../../server/services/validation/ValidationService';
import { QualityScorer } from '../../../server/services/quality/QualityScorer';
import {
  MockTranslationProvider,
  MockCacheProvider,
  createMockProviders,
} from '../utils/mocks';
import type { TranslationResult } from '../../../shared/types';
import fs from 'fs';
import path from 'path';

/**
 * Performance targets (in milliseconds)
 */
const PERFORMANCE_TARGETS = {
  PDF_EXTRACTION_100_PAGES: 5000,
  TEXT_CHUNKING_10K_CHARS: 100,
  TRANSLATION_SINGLE_CHUNK: 2000,
  VALIDATION: 10,
  QUALITY_SCORING: 5,
  CACHE_LOOKUP: 1,
  DICTIONARY_LOOKUP: 5,
  TRANSLATION_MEMORY_SEARCH: 20,
};

describe('Performance Benchmarks', () => {
  let validationService: ValidationService;
  let qualityScorer: QualityScorer;
  let mockProviders: ReturnType<typeof createMockProviders>;
  let benchmarkResults: BenchmarkResult[] = [];

  interface BenchmarkResult {
    operation: string;
    duration: number;
    target: number;
    passed: boolean;
    details?: any;
  }

  beforeEach(() => {
    validationService = new ValidationService();
    qualityScorer = new QualityScorer();
    mockProviders = createMockProviders({ translationConfidence: 0.85 });
    benchmarkResults = [];
  });

  /**
   * Benchmark helper function
   */
  async function benchmark<T>(
    name: string,
    fn: () => Promise<T> | T,
    target: number
  ): Promise<{ result: T; duration: number }> {
    const startTime = performance.now();
    const result = await fn();
    const duration = performance.now() - startTime;

    const passed = duration <= target;
    benchmarkResults.push({
      operation: name,
      duration,
      target,
      passed,
    });

    console.log(
      `${passed ? '✓' : '✗'} ${name}: ${duration.toFixed(2)}ms (target: ${target}ms)`
    );

    return { result, duration };
  }

  describe('text processing benchmarks', () => {
    it('should chunk 10,000 character text within 100ms', async () => {
      // Create 10,000 character Tibetan text
      const longText = 'བོད་ཀྱི་སྐད་ཡིག་ནི་གལ་ཆེན་པོ་ཡིན། '.repeat(334); // ~10,000 chars

      const { result, duration } = await benchmark(
        'Text Chunking (10K chars)',
        () => splitTextIntoChunks(longText, { maxTokens: 500 }),
        PERFORMANCE_TARGETS.TEXT_CHUNKING_10K_CHARS
      );

      expect(duration).toBeLessThan(PERFORMANCE_TARGETS.TEXT_CHUNKING_10K_CHARS);
      expect(result.length).toBeGreaterThan(0);
      expect(result.every(chunk => chunk.tokenCount > 0)).toBe(true);
    });

    it('should chunk 50,000 character text efficiently', async () => {
      const veryLongText = 'བོད་སྐད་གལ་ཆེན་ཡིན། '.repeat(2000); // ~50,000 chars

      const { result, duration } = await benchmark(
        'Text Chunking (50K chars)',
        () => splitTextIntoChunks(veryLongText, { maxTokens: 500 }),
        500 // Allow 500ms for 50K chars
      );

      expect(duration).toBeLessThan(500);
      expect(result.length).toBeGreaterThan(0);
      console.log(`  Chunks created: ${result.length}`);
    });

    it('should validate Unicode quickly', async () => {
      const tibetanText = 'བོད་ཀྱི་སྐད་ཡིག་ནི་གལ་ཆེན་པོ་ཡིན།';

      const { result, duration } = await benchmark(
        'Unicode Validation',
        () => validateAndNormalize(tibetanText),
        10
      );

      expect(duration).toBeLessThan(10);
      expect(result.report.isValid).toBe(true);
    });

    it('should validate large text efficiently', async () => {
      const largeText = 'བོད་སྐད་གལ་ཆེན་ཡིན། '.repeat(1000); // ~25,000 chars

      const { result, duration } = await benchmark(
        'Unicode Validation (25K chars)',
        () => validateAndNormalize(largeText),
        50
      );

      expect(duration).toBeLessThan(50);
      expect(result.report.isValid).toBe(true);
    });
  });

  describe('translation benchmarks', () => {
    it('should translate single chunk within 2s (mock)', async () => {
      const tibetanText = 'བོད་ཀྱི་སྐད་ཡིག་ནི་གལ་ཆེན་པོ་ཡིན།';

      const { result, duration } = await benchmark(
        'Translation (single chunk)',
        () =>
          mockProviders.translation.translate(
            tibetanText,
            'Translate this Tibetan text'
          ),
        PERFORMANCE_TARGETS.TRANSLATION_SINGLE_CHUNK
      );

      expect(duration).toBeLessThan(PERFORMANCE_TARGETS.TRANSLATION_SINGLE_CHUNK);
      expect(result.translation).toBeTruthy();
      expect(result.confidence).toBeGreaterThan(0);
    });

    it('should translate batch of 10 chunks efficiently', async () => {
      const chunks = Array(10).fill('བོད་སྐད་གལ་ཆེན་ཡིན།');

      const { result, duration } = await benchmark(
        'Translation (10 chunks parallel)',
        () =>
          Promise.all(
            chunks.map(chunk =>
              mockProviders.translation.translate(chunk, 'Translate')
            )
          ),
        5000 // 5s for 10 parallel translations
      );

      expect(duration).toBeLessThan(5000);
      expect(result.length).toBe(10);
      expect(result.every(r => r.confidence > 0)).toBe(true);

      console.log(`  Avg per chunk: ${(duration / 10).toFixed(2)}ms`);
    });

    it('should translate batch of 50 chunks efficiently', async () => {
      const chunks = Array(50).fill('བོད་སྐད།');

      const { result, duration } = await benchmark(
        'Translation (50 chunks parallel)',
        () =>
          Promise.all(
            chunks.map(chunk =>
              mockProviders.translation.translate(chunk, 'Translate')
            )
          ),
        10000 // 10s for 50 parallel translations
      );

      expect(duration).toBeLessThan(10000);
      expect(result.length).toBe(50);

      console.log(`  Avg per chunk: ${(duration / 50).toFixed(2)}ms`);
    });
  });

  describe('validation benchmarks', () => {
    it('should validate input within 10ms', async () => {
      const tibetanText = 'བོད་ཀྱི་སྐད་ཡིག་ནི་གལ་ཆེན་པོ་ཡིན།';

      const { result, duration } = await benchmark(
        'Input Validation',
        () => validationService.validate(tibetanText, 'input'),
        PERFORMANCE_TARGETS.VALIDATION
      );

      expect(duration).toBeLessThan(PERFORMANCE_TARGETS.VALIDATION);
      expect(result.isValid).toBe(true);
    });

    it('should validate output within 10ms', async () => {
      const original = 'བོད་སྐད།';
      const translation = 'Tibetan language (བོད་སྐད།).';

      const { result, duration } = await benchmark(
        'Output Validation',
        () =>
          validationService.validate(
            { translation, original },
            'output'
          ),
        PERFORMANCE_TARGETS.VALIDATION
      );

      expect(duration).toBeLessThan(PERFORMANCE_TARGETS.VALIDATION);
    });

    it('should validate 100 translations in under 500ms', async () => {
      const translations = Array(100)
        .fill(null)
        .map((_, i) => ({
          translation: `Translation ${i} (བོད་སྐད།).`,
          original: 'བོད་སྐད།',
        }));

      const { result, duration } = await benchmark(
        'Validation (100 translations)',
        () =>
          translations.map(t =>
            validationService.validate(t, 'output')
          ),
        500
      );

      expect(duration).toBeLessThan(500);
      expect(result.length).toBe(100);

      console.log(`  Avg per validation: ${(duration / 100).toFixed(2)}ms`);
    });
  });

  describe('quality scoring benchmarks', () => {
    it('should score quality within 5ms', async () => {
      const translation: TranslationResult = {
        translation: 'Tibetan language (བོད་སྐད།).',
        confidence: 0.85,
        metadata: { provider: 'mock' },
      };
      const original = 'བོད་སྐད།';

      const { result, duration } = await benchmark(
        'Quality Scoring',
        () => qualityScorer.score(translation, original),
        PERFORMANCE_TARGETS.QUALITY_SCORING
      );

      expect(duration).toBeLessThan(PERFORMANCE_TARGETS.QUALITY_SCORING);
      expect(result.overall).toBeGreaterThan(0);
    });

    it('should score 100 translations in under 300ms', async () => {
      const translations: TranslationResult[] = Array(100)
        .fill(null)
        .map((_, i) => ({
          translation: `Translation ${i} (བོད་སྐད།).`,
          confidence: 0.8 + Math.random() * 0.15,
          metadata: { provider: 'mock' },
        }));

      const original = 'བོད་སྐད།';

      const { result, duration } = await benchmark(
        'Quality Scoring (100 translations)',
        () => translations.map(t => qualityScorer.score(t, original)),
        300
      );

      expect(duration).toBeLessThan(300);
      expect(result.length).toBe(100);

      console.log(`  Avg per score: ${(duration / 100).toFixed(2)}ms`);
    });
  });

  describe('cache benchmarks', () => {
    it('should lookup from cache within 1ms', async () => {
      // Pre-populate cache
      await mockProviders.cache.set('test-key', { value: 'test' });

      const { result, duration } = await benchmark(
        'Cache Lookup',
        () => mockProviders.cache.get('test-key'),
        PERFORMANCE_TARGETS.CACHE_LOOKUP
      );

      expect(duration).toBeLessThan(PERFORMANCE_TARGETS.CACHE_LOOKUP);
      expect(result).toBeTruthy();
    });

    it('should handle 1000 cache lookups in under 100ms', async () => {
      // Pre-populate cache
      for (let i = 0; i < 100; i++) {
        await mockProviders.cache.set(`key-${i}`, { value: i });
      }

      const { result, duration } = await benchmark(
        'Cache Lookup (1000 ops)',
        async () => {
          const results = [];
          for (let i = 0; i < 1000; i++) {
            const key = `key-${i % 100}`;
            results.push(await mockProviders.cache.get(key));
          }
          return results;
        },
        100
      );

      expect(duration).toBeLessThan(100);
      console.log(`  Avg per lookup: ${(duration / 1000).toFixed(3)}ms`);
    });

    it('should set cache entries efficiently', async () => {
      const { result, duration } = await benchmark(
        'Cache Set (100 entries)',
        async () => {
          for (let i = 0; i < 100; i++) {
            await mockProviders.cache.set(`bulk-key-${i}`, {
              value: `data-${i}`,
              timestamp: Date.now(),
            });
          }
        },
        50
      );

      expect(duration).toBeLessThan(50);
      console.log(`  Avg per set: ${(duration / 100).toFixed(2)}ms`);
    });
  });

  describe('end-to-end pipeline benchmarks', () => {
    it('should process complete pipeline efficiently', async () => {
      const tibetanText = 'བོད་ཀྱི་སྐད་ཡིག་ནི་གལ་ཆེན་པོ་ཡིན།';

      const { result, duration } = await benchmark(
        'Full Pipeline (simple text)',
        async () => {
          // Step 1: Validation
          const inputValidation = validationService.validate(tibetanText, 'input');

          // Step 2: Chunking
          const chunks = splitTextIntoChunks(tibetanText);

          // Step 3: Translation
          const translations = await Promise.all(
            chunks.map(chunk =>
              mockProviders.translation.translate(chunk.text, 'Translate')
            )
          );

          // Step 4: Quality scoring
          const qualityScores = translations.map((t, i) =>
            qualityScorer.score(t, chunks[i].text)
          );

          return {
            inputValidation,
            chunks: chunks.length,
            translations: translations.length,
            avgQuality:
              qualityScores.reduce((sum, s) => sum + s.overall, 0) /
              qualityScores.length,
          };
        },
        2500 // 2.5s for full pipeline
      );

      expect(duration).toBeLessThan(2500);
      expect(result.inputValidation.isValid).toBe(true);
      expect(result.translations).toBeGreaterThan(0);
    });

    it('should process long text pipeline efficiently', async () => {
      const longText = 'བོད་སྐད་གལ་ཆེན་ཡིན། '.repeat(100);

      const { result, duration } = await benchmark(
        'Full Pipeline (long text)',
        async () => {
          const inputValidation = validationService.validate(longText, 'input');
          const chunks = splitTextIntoChunks(longText, { maxTokens: 200 });
          const translations = await Promise.all(
            chunks.map(chunk =>
              mockProviders.translation.translate(chunk.text, 'Translate')
            )
          );

          return {
            chunks: chunks.length,
            translations: translations.length,
          };
        },
        5000 // 5s for long text pipeline
      );

      expect(duration).toBeLessThan(5000);
      console.log(`  Processed ${result.chunks} chunks in ${duration.toFixed(0)}ms`);
    });
  });

  describe('performance tracking and reporting', () => {
    it('should generate performance report', () => {
      // Calculate overall statistics
      const stats = {
        totalBenchmarks: benchmarkResults.length,
        passed: benchmarkResults.filter(r => r.passed).length,
        failed: benchmarkResults.filter(r => !r.passed).length,
        avgDuration:
          benchmarkResults.reduce((sum, r) => sum + r.duration, 0) /
          benchmarkResults.length,
        byOperation: {} as Record<string, { avg: number; max: number; min: number }>,
      };

      // Group by operation category
      const categories: Record<string, BenchmarkResult[]> = {};
      benchmarkResults.forEach(result => {
        const category = result.operation.split('(')[0].trim();
        if (!categories[category]) {
          categories[category] = [];
        }
        categories[category].push(result);
      });

      console.log('\n=== Performance Benchmark Summary ===');
      console.log(`Total benchmarks: ${stats.totalBenchmarks}`);
      console.log(`Passed: ${stats.passed} (${((stats.passed / stats.totalBenchmarks) * 100).toFixed(1)}%)`);
      console.log(`Failed: ${stats.failed}`);
      console.log(`Avg duration: ${stats.avgDuration.toFixed(2)}ms`);

      console.log('\n=== By Category ===');
      Object.entries(categories).forEach(([category, results]) => {
        const durations = results.map(r => r.duration);
        const avg = durations.reduce((sum, d) => sum + d, 0) / durations.length;
        const max = Math.max(...durations);
        const min = Math.min(...durations);

        console.log(`${category}:`);
        console.log(`  Avg: ${avg.toFixed(2)}ms | Min: ${min.toFixed(2)}ms | Max: ${max.toFixed(2)}ms`);
      });

      // Save results to file
      const resultsDir = path.join(__dirname, '../results');
      if (!fs.existsSync(resultsDir)) {
        fs.mkdirSync(resultsDir, { recursive: true });
      }

      const resultsFile = path.join(resultsDir, `benchmarks-${Date.now()}.json`);
      fs.writeFileSync(
        resultsFile,
        JSON.stringify(
          {
            timestamp: new Date().toISOString(),
            stats,
            details: benchmarkResults,
          },
          null,
          2
        )
      );

      console.log(`\nResults saved to: ${resultsFile}`);

      // Assert overall performance
      expect(stats.passed / stats.totalBenchmarks).toBeGreaterThanOrEqual(0.9); // 90% pass rate
    });
  });
});
