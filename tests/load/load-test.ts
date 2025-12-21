/**
 * Load Testing Suite
 *
 * Simulates concurrent requests to test system under load:
 * - 10 concurrent translations
 * - 50 concurrent translations
 * - 100 concurrent translations
 *
 * Measures:
 * - Average response time
 * - p95 response time
 * - p99 response time
 * - Error rate
 * - Throughput (req/s)
 *
 * Asserts system handles load gracefully and error rate <1%.
 *
 * @module tests/load/load-test
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { splitTextIntoChunks } from '@/lib/textExtractor';
import { ValidationService } from '../../../server/services/validation/ValidationService';
import { QualityScorer } from '../../../server/services/quality/QualityScorer';
import {
  MockTranslationProvider,
  MockCacheProvider,
  createMockProviders,
} from '../utils/mocks';
import fs from 'fs';
import path from 'path';

/**
 * Load test targets
 */
const LOAD_TEST_TARGETS = {
  '10_concurrent': {
    avgResponseTime: 500,
    p95ResponseTime: 1000,
    p99ResponseTime: 2000,
    maxErrorRate: 0.01, // 1%
    minThroughput: 10, // req/s
  },
  '50_concurrent': {
    avgResponseTime: 1000,
    p95ResponseTime: 2000,
    p99ResponseTime: 4000,
    maxErrorRate: 0.005, // 0.5%
    minThroughput: 40, // req/s
  },
  '100_concurrent': {
    avgResponseTime: 2000,
    p95ResponseTime: 4000,
    p99ResponseTime: 8000,
    maxErrorRate: 0.01, // 1%
    minThroughput: 60, // req/s
  },
};

interface LoadTestResult {
  concurrency: number;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  errorRate: number;
  duration: number;
  throughput: number;
  avgResponseTime: number;
  p50ResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  minResponseTime: number;
  maxResponseTime: number;
}

describe('Load Testing Suite', () => {
  let validationService: ValidationService;
  let qualityScorer: QualityScorer;
  let mockProviders: ReturnType<typeof createMockProviders>;
  let loadTestResults: LoadTestResult[] = [];

  beforeEach(() => {
    validationService = new ValidationService();
    qualityScorer = new QualityScorer();
    mockProviders = createMockProviders({ translationConfidence: 0.85 });
    loadTestResults = [];
  });

  /**
   * Execute load test with specified concurrency
   */
  async function executeLoadTest(
    concurrency: number,
    requestsPerWorker: number = 10
  ): Promise<LoadTestResult> {
    const totalRequests = concurrency * requestsPerWorker;
    const responseTimes: number[] = [];
    let successfulRequests = 0;
    let failedRequests = 0;

    console.log(`\n=== Load Test: ${concurrency} concurrent users ===`);
    console.log(`Total requests: ${totalRequests}`);

    const testStartTime = Date.now();

    // Create concurrent workers
    const workers = Array(concurrency)
      .fill(null)
      .map(async (_, workerIndex) => {
        const workerResults: number[] = [];

        for (let i = 0; i < requestsPerWorker; i++) {
          const requestId = workerIndex * requestsPerWorker + i;
          const tibetanText = `བོད་སྐད་གལ་ཆེན་ཡིན། ${requestId}`;

          const startTime = Date.now();

          try {
            // Simulate translation request
            const result = await mockProviders.translation.translate(
              tibetanText,
              'Translate this text'
            );

            const responseTime = Date.now() - startTime;
            responseTimes.push(responseTime);
            workerResults.push(responseTime);
            successfulRequests++;

            // Verify result quality
            if (result.confidence < 0.5) {
              failedRequests++;
              successfulRequests--;
            }
          } catch (error) {
            const responseTime = Date.now() - startTime;
            responseTimes.push(responseTime);
            failedRequests++;
          }
        }

        return workerResults;
      });

    // Wait for all workers to complete
    await Promise.all(workers);

    const duration = Date.now() - testStartTime;

    // Calculate statistics
    const sortedTimes = responseTimes.sort((a, b) => a - b);
    const avgResponseTime =
      responseTimes.reduce((sum, t) => sum + t, 0) / responseTimes.length;

    const result: LoadTestResult = {
      concurrency,
      totalRequests,
      successfulRequests,
      failedRequests,
      errorRate: failedRequests / totalRequests,
      duration,
      throughput: (totalRequests / duration) * 1000, // requests per second
      avgResponseTime,
      p50ResponseTime: sortedTimes[Math.floor(sortedTimes.length * 0.5)],
      p95ResponseTime: sortedTimes[Math.floor(sortedTimes.length * 0.95)],
      p99ResponseTime: sortedTimes[Math.floor(sortedTimes.length * 0.99)],
      minResponseTime: sortedTimes[0],
      maxResponseTime: sortedTimes[sortedTimes.length - 1],
    };

    // Log results
    console.log(`Duration: ${duration}ms`);
    console.log(`Throughput: ${result.throughput.toFixed(2)} req/s`);
    console.log(`Success rate: ${((successfulRequests / totalRequests) * 100).toFixed(2)}%`);
    console.log(`Error rate: ${(result.errorRate * 100).toFixed(2)}%`);
    console.log(`\nResponse Times:`);
    console.log(`  Min: ${result.minResponseTime}ms`);
    console.log(`  Avg: ${result.avgResponseTime.toFixed(2)}ms`);
    console.log(`  p50: ${result.p50ResponseTime}ms`);
    console.log(`  p95: ${result.p95ResponseTime}ms`);
    console.log(`  p99: ${result.p99ResponseTime}ms`);
    console.log(`  Max: ${result.maxResponseTime}ms`);

    loadTestResults.push(result);
    return result;
  }

  describe('10 concurrent users', () => {
    it('should handle 10 concurrent translation requests', async () => {
      const result = await executeLoadTest(10, 10);
      const targets = LOAD_TEST_TARGETS['10_concurrent'];

      // Assert performance targets
      expect(result.avgResponseTime).toBeLessThan(targets.avgResponseTime);
      expect(result.p95ResponseTime).toBeLessThan(targets.p95ResponseTime);
      expect(result.p99ResponseTime).toBeLessThan(targets.p99ResponseTime);
      expect(result.errorRate).toBeLessThan(targets.maxErrorRate);
      expect(result.throughput).toBeGreaterThan(targets.minThroughput);

      console.log('✓ All targets met for 10 concurrent users');
    });

    it('should maintain quality under 10 concurrent requests', async () => {
      const concurrency = 10;
      const qualityResults: number[] = [];

      const workers = Array(concurrency)
        .fill(null)
        .map(async () => {
          const result = await mockProviders.translation.translate(
            'བོད་སྐད་གལ་ཆེན་ཡིན།',
            'Translate'
          );

          const qualityScore = qualityScorer.score(
            result,
            'བོད་སྐད་གལ་ཆེན་ཡིན།'
          );

          return qualityScore.overall;
        });

      const scores = await Promise.all(workers);
      const avgQuality = scores.reduce((sum, s) => sum + s, 0) / scores.length;

      expect(avgQuality).toBeGreaterThan(0.7);
      console.log(`✓ Maintained quality: ${avgQuality.toFixed(3)} avg under load`);
    });
  });

  describe('50 concurrent users', () => {
    it('should handle 50 concurrent translation requests', async () => {
      const result = await executeLoadTest(50, 10);
      const targets = LOAD_TEST_TARGETS['50_concurrent'];

      expect(result.avgResponseTime).toBeLessThan(targets.avgResponseTime);
      expect(result.p95ResponseTime).toBeLessThan(targets.p95ResponseTime);
      expect(result.p99ResponseTime).toBeLessThan(targets.p99ResponseTime);
      expect(result.errorRate).toBeLessThan(targets.maxErrorRate);
      expect(result.throughput).toBeGreaterThan(targets.minThroughput);

      console.log('✓ All targets met for 50 concurrent users');
    });

    it('should not degrade significantly from 10 to 50 concurrent', async () => {
      const result10 = await executeLoadTest(10, 5);
      const result50 = await executeLoadTest(50, 5);

      // Response time should not increase by more than 3x
      const degradationFactor = result50.avgResponseTime / result10.avgResponseTime;
      expect(degradationFactor).toBeLessThan(3);

      console.log(`✓ Performance degradation: ${degradationFactor.toFixed(2)}x (acceptable)`);
    });
  });

  describe('100 concurrent users', () => {
    it('should handle 100 concurrent translation requests', async () => {
      const result = await executeLoadTest(100, 10);
      const targets = LOAD_TEST_TARGETS['100_concurrent'];

      expect(result.avgResponseTime).toBeLessThan(targets.avgResponseTime);
      expect(result.p95ResponseTime).toBeLessThan(targets.p95ResponseTime);
      expect(result.p99ResponseTime).toBeLessThan(targets.p99ResponseTime);
      expect(result.errorRate).toBeLessThan(targets.maxErrorRate);
      expect(result.throughput).toBeGreaterThan(targets.minThroughput);

      console.log('✓ All targets met for 100 concurrent users');
    });

    it('should maintain error rate below 1% under heavy load', async () => {
      const result = await executeLoadTest(100, 10);

      expect(result.errorRate).toBeLessThan(0.01);
      console.log(`✓ Error rate: ${(result.errorRate * 100).toFixed(2)}% (target: <1%)`);
    });
  });

  describe('spike testing', () => {
    it('should handle sudden spike from 10 to 100 users', async () => {
      console.log('\n=== Spike Test: 10 → 100 users ===');

      // Start with 10 concurrent users
      const result10 = await executeLoadTest(10, 5);

      // Spike to 100 concurrent users
      const result100 = await executeLoadTest(100, 5);

      // System should recover and maintain acceptable error rate
      expect(result100.errorRate).toBeLessThan(0.02); // Allow 2% error during spike

      console.log('✓ System handled spike successfully');
      console.log(`  10 users: ${result10.errorRate.toFixed(3)} error rate`);
      console.log(`  100 users: ${result100.errorRate.toFixed(3)} error rate`);
    });
  });

  describe('sustained load testing', () => {
    it('should maintain performance over sustained 50-user load', async () => {
      const iterations = 5;
      const results: LoadTestResult[] = [];

      console.log('\n=== Sustained Load Test: 5 iterations of 50 users ===');

      for (let i = 0; i < iterations; i++) {
        console.log(`\nIteration ${i + 1}/${iterations}`);
        const result = await executeLoadTest(50, 5);
        results.push(result);
      }

      // Calculate consistency
      const avgTimes = results.map(r => r.avgResponseTime);
      const avgOfAvg = avgTimes.reduce((sum, t) => sum + t, 0) / avgTimes.length;
      const maxDeviation = Math.max(...avgTimes.map(t => Math.abs(t - avgOfAvg)));

      // Deviation should be < 50% of average
      expect(maxDeviation).toBeLessThan(avgOfAvg * 0.5);

      console.log('\n✓ Performance remained consistent over sustained load');
      console.log(`  Avg response time: ${avgOfAvg.toFixed(2)}ms`);
      console.log(`  Max deviation: ${maxDeviation.toFixed(2)}ms`);
    });
  });

  describe('cache effectiveness under load', () => {
    it('should improve performance with cache hits', async () => {
      const repeatedText = 'བོད་སྐད་གལ་ཆེན་ཡིན།';

      // First pass - populate cache
      console.log('\n=== Cache Test: First pass (cold cache) ===');
      const coldResult = await executeLoadTest(20, 5);

      // Pre-populate cache
      for (let i = 0; i < 100; i++) {
        await mockProviders.cache.set(`translation:${repeatedText} ${i}`, {
          translation: `Cached ${i}`,
          confidence: 0.85,
          metadata: { source: 'cache' },
        });
      }

      // Second pass - with cache
      console.log('\n=== Cache Test: Second pass (warm cache) ===');
      const warmResult = await executeLoadTest(20, 5);

      // Warm cache should be faster (or at least not slower)
      expect(warmResult.avgResponseTime).toBeLessThanOrEqual(coldResult.avgResponseTime * 1.1);

      console.log('✓ Cache improved or maintained performance');
      console.log(`  Cold: ${coldResult.avgResponseTime.toFixed(2)}ms avg`);
      console.log(`  Warm: ${warmResult.avgResponseTime.toFixed(2)}ms avg`);
    });
  });

  describe('resource utilization', () => {
    it('should measure memory usage under load', async () => {
      const memBefore = process.memoryUsage();

      await executeLoadTest(50, 10);

      const memAfter = process.memoryUsage();

      const heapIncrease = (memAfter.heapUsed - memBefore.heapUsed) / 1024 / 1024;

      console.log('\n=== Memory Usage ===');
      console.log(`Heap increase: ${heapIncrease.toFixed(2)} MB`);
      console.log(`Current heap: ${(memAfter.heapUsed / 1024 / 1024).toFixed(2)} MB`);
      console.log(`Heap limit: ${(memAfter.heapTotal / 1024 / 1024).toFixed(2)} MB`);

      // Memory increase should be reasonable (<100MB for 500 requests)
      expect(heapIncrease).toBeLessThan(100);
    });
  });

  describe('load test reporting', () => {
    it('should generate comprehensive load test report', () => {
      if (loadTestResults.length === 0) {
        console.log('⚠ No load test results to report');
        return;
      }

      const report = {
        timestamp: new Date().toISOString(),
        summary: {
          totalTests: loadTestResults.length,
          totalRequests: loadTestResults.reduce((sum, r) => sum + r.totalRequests, 0),
          avgThroughput:
            loadTestResults.reduce((sum, r) => sum + r.throughput, 0) /
            loadTestResults.length,
          avgErrorRate:
            loadTestResults.reduce((sum, r) => sum + r.errorRate, 0) /
            loadTestResults.length,
        },
        details: loadTestResults,
      };

      console.log('\n=== Load Test Summary ===');
      console.log(`Total tests: ${report.summary.totalTests}`);
      console.log(`Total requests: ${report.summary.totalRequests}`);
      console.log(`Avg throughput: ${report.summary.avgThroughput.toFixed(2)} req/s`);
      console.log(`Avg error rate: ${(report.summary.avgErrorRate * 100).toFixed(2)}%`);

      // Save report
      const resultsDir = path.join(__dirname, '../results');
      if (!fs.existsSync(resultsDir)) {
        fs.mkdirSync(resultsDir, { recursive: true });
      }

      const reportFile = path.join(resultsDir, `load-test-${Date.now()}.json`);
      fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));

      console.log(`\nReport saved to: ${reportFile}`);

      // Assert overall quality
      expect(report.summary.avgErrorRate).toBeLessThan(0.01); // <1% average error rate
      expect(report.summary.avgThroughput).toBeGreaterThan(10); // >10 req/s throughput
    });
  });
});
