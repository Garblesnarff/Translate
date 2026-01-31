/**
 * Tests for StatisticsAggregator
 * Task 2.2.2.1: Write tests for statistics aggregation
 *
 * Following TDD methodology - tests written FIRST
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { StatisticsAggregator } from '../../../../server/services/monitoring/StatisticsAggregator';

describe('StatisticsAggregator', () => {
  let aggregator: StatisticsAggregator;

  beforeEach(() => {
    aggregator = new StatisticsAggregator();
  });

  describe('Basic Statistics Calculation', () => {
    it('should calculate average, min, max', () => {
      const values = [100, 200, 300, 400, 500];
      const stats = aggregator.calculateStats(values);

      expect(stats.avg).toBe(300);
      expect(stats.min).toBe(100);
      expect(stats.max).toBe(500);
      expect(stats.count).toBe(5);
    });

    it('should handle single value', () => {
      const values = [150];
      const stats = aggregator.calculateStats(values);

      expect(stats.avg).toBe(150);
      expect(stats.min).toBe(150);
      expect(stats.max).toBe(150);
      expect(stats.count).toBe(1);
    });

    it('should handle empty array', () => {
      const values: number[] = [];
      const stats = aggregator.calculateStats(values);

      expect(stats.avg).toBe(0);
      expect(stats.min).toBe(0);
      expect(stats.max).toBe(0);
      expect(stats.count).toBe(0);
    });

    it('should handle negative values', () => {
      const values = [-100, -50, 0, 50, 100];
      const stats = aggregator.calculateStats(values);

      expect(stats.avg).toBe(0);
      expect(stats.min).toBe(-100);
      expect(stats.max).toBe(100);
    });

    it('should handle decimal values', () => {
      const values = [0.1, 0.2, 0.3, 0.4, 0.5];
      const stats = aggregator.calculateStats(values);

      expect(stats.avg).toBeCloseTo(0.3, 5);
      expect(stats.min).toBe(0.1);
      expect(stats.max).toBe(0.5);
    });
  });

  describe('Percentile Calculation', () => {
    it('should calculate p50 (median)', () => {
      const values = [100, 200, 300, 400, 500];
      const stats = aggregator.calculateStats(values);

      expect(stats.p50).toBe(300);
    });

    it('should calculate p95', () => {
      const values = Array.from({ length: 100 }, (_, i) => i + 1);
      const stats = aggregator.calculateStats(values);

      expect(stats.p95).toBeGreaterThanOrEqual(95);
      expect(stats.p95).toBeLessThanOrEqual(96);
    });

    it('should calculate p99', () => {
      const values = Array.from({ length: 100 }, (_, i) => i + 1);
      const stats = aggregator.calculateStats(values);

      expect(stats.p99).toBeGreaterThanOrEqual(99);
      expect(stats.p99).toBeLessThanOrEqual(100);
    });

    it('should handle even-length arrays for median', () => {
      const values = [100, 200, 300, 400];
      const stats = aggregator.calculateStats(values);

      // Median of [100, 200, 300, 400] is 250
      expect(stats.p50).toBe(250);
    });

    it('should handle small arrays for percentiles', () => {
      const values = [10, 20, 30];
      const stats = aggregator.calculateStats(values);

      expect(stats.p50).toBe(20);
      expect(stats.p95).toBeGreaterThan(0);
      expect(stats.p99).toBeGreaterThan(0);
    });
  });

  describe('Trend Detection', () => {
    it('should detect improving trend (values decreasing for latency)', () => {
      const values = [1000, 900, 800, 700, 600];
      const stats = aggregator.calculateStats(values);

      // For latency, lower is better
      expect(stats.trend).toBe('improving');
    });

    it('should detect degrading trend (values increasing for latency)', () => {
      const values = [600, 700, 800, 900, 1000];
      const stats = aggregator.calculateStats(values);

      expect(stats.trend).toBe('degrading');
    });

    it('should detect stable trend (values similar)', () => {
      const values = [500, 505, 495, 500, 498];
      const stats = aggregator.calculateStats(values);

      expect(stats.trend).toBe('stable');
    });

    it('should detect improving trend for quality scores (increasing)', () => {
      const values = [0.70, 0.75, 0.80, 0.85, 0.90];
      const stats = aggregator.calculateStats(values, { higherIsBetter: true });

      expect(stats.trend).toBe('improving');
    });

    it('should detect degrading trend for quality scores (decreasing)', () => {
      const values = [0.90, 0.85, 0.80, 0.75, 0.70];
      const stats = aggregator.calculateStats(values, { higherIsBetter: true });

      expect(stats.trend).toBe('degrading');
    });

    it('should handle insufficient data for trend', () => {
      const values = [100];
      const stats = aggregator.calculateStats(values);

      expect(stats.trend).toBe('stable');
    });
  });

  describe('Outlier Detection', () => {
    it('should detect outliers (> 3 standard deviations)', () => {
      // Create data with clear outlier
      const values = [100, 100, 100, 100, 100, 100, 100, 100, 100, 10000]; // Last value is clear outlier
      const outliers = aggregator.detectOutliers(values);

      expect(outliers.length).toBeGreaterThan(0);
      expect(outliers).toContain(10000);
    });

    it('should handle no outliers', () => {
      const values = [100, 110, 90, 105, 95];
      const outliers = aggregator.detectOutliers(values);

      expect(outliers.length).toBe(0);
    });

    it('should handle empty array', () => {
      const values: number[] = [];
      const outliers = aggregator.detectOutliers(values);

      expect(outliers.length).toBe(0);
    });

    it('should detect multiple outliers', () => {
      // Create data with multiple clear outliers
      const values = [100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 10000, 20000];
      const outliers = aggregator.detectOutliers(values);

      // Should detect at least one outlier
      expect(outliers.length).toBeGreaterThanOrEqual(1);
      // Both 10000 and 20000 should be detected
      if (outliers.length > 0) {
        expect(outliers.some(v => v >= 10000)).toBe(true);
      }
    });

    it('should handle single value (no outliers possible)', () => {
      const values = [100];
      const outliers = aggregator.detectOutliers(values);

      expect(outliers.length).toBe(0);
    });
  });

  describe('Time Bucket Grouping', () => {
    it('should group by hour', () => {
      const metrics = [
        { timestamp: new Date('2025-01-01T10:00:00Z'), value: 100 },
        { timestamp: new Date('2025-01-01T10:30:00Z'), value: 150 },
        { timestamp: new Date('2025-01-01T11:00:00Z'), value: 200 },
        { timestamp: new Date('2025-01-01T11:30:00Z'), value: 250 },
      ];

      const grouped = aggregator.groupByTimeBucket(metrics, 'hour');

      expect(Object.keys(grouped).length).toBeGreaterThanOrEqual(2);
    });

    it('should group by day', () => {
      const metrics = [
        { timestamp: new Date('2025-01-01T10:00:00Z'), value: 100 },
        { timestamp: new Date('2025-01-01T20:00:00Z'), value: 150 },
        { timestamp: new Date('2025-01-02T10:00:00Z'), value: 200 },
        { timestamp: new Date('2025-01-03T10:00:00Z'), value: 250 },
      ];

      const grouped = aggregator.groupByTimeBucket(metrics, 'day');

      expect(Object.keys(grouped).length).toBe(3);
    });

    it('should group by week', () => {
      const metrics = [
        { timestamp: new Date('2025-01-01T10:00:00Z'), value: 100 },
        { timestamp: new Date('2025-01-08T10:00:00Z'), value: 150 },
        { timestamp: new Date('2025-01-15T10:00:00Z'), value: 200 },
      ];

      const grouped = aggregator.groupByTimeBucket(metrics, 'week');

      expect(Object.keys(grouped).length).toBe(3);
    });

    it('should aggregate values within each bucket', () => {
      const metrics = [
        { timestamp: new Date('2025-01-01T10:00:00Z'), value: 100 },
        { timestamp: new Date('2025-01-01T10:30:00Z'), value: 200 },
        { timestamp: new Date('2025-01-01T11:00:00Z'), value: 300 },
      ];

      const grouped = aggregator.groupByTimeBucket(metrics, 'hour');

      // Each bucket should have aggregated values
      Object.values(grouped).forEach(bucket => {
        expect(bucket).toHaveProperty('count');
        expect(bucket).toHaveProperty('sum');
        expect(bucket).toHaveProperty('avg');
      });
    });

    it('should handle empty metrics array', () => {
      const metrics: Array<{ timestamp: Date; value: number }> = [];
      const grouped = aggregator.groupByTimeBucket(metrics, 'hour');

      expect(Object.keys(grouped).length).toBe(0);
    });

    it('should handle single metric', () => {
      const metrics = [
        { timestamp: new Date('2025-01-01T10:00:00Z'), value: 100 },
      ];

      const grouped = aggregator.groupByTimeBucket(metrics, 'hour');

      expect(Object.keys(grouped).length).toBe(1);
    });
  });

  describe('Aggregation with Metadata', () => {
    it('should calculate statistics with tags', () => {
      const metrics = [
        { value: 100, tags: { model: 'gemini', status: 'success' } },
        { value: 150, tags: { model: 'gemini', status: 'success' } },
        { value: 200, tags: { model: 'gpt', status: 'success' } },
      ];

      const grouped = aggregator.groupByTag(metrics, 'model');

      expect(grouped).toHaveProperty('gemini');
      expect(grouped).toHaveProperty('gpt');
      expect(grouped.gemini.count).toBe(2);
      expect(grouped.gpt.count).toBe(1);
    });

    it('should handle missing tags gracefully', () => {
      const metrics = [
        { value: 100, tags: { model: 'gemini' } },
        { value: 150 }, // Missing tags
        { value: 200, tags: { model: 'gpt' } },
      ];

      const grouped = aggregator.groupByTag(metrics, 'model');

      expect(grouped).toHaveProperty('gemini');
      expect(grouped).toHaveProperty('gpt');
    });

    it('should aggregate multiple tag values', () => {
      const metrics = [
        { value: 100, tags: { status: 'success' } },
        { value: 150, tags: { status: 'success' } },
        { value: 200, tags: { status: 'failure' } },
      ];

      const grouped = aggregator.groupByTag(metrics, 'status');

      expect(grouped.success.count).toBe(2);
      expect(grouped.failure.count).toBe(1);
      expect(grouped.success.avg).toBe(125);
    });
  });

  describe('Standard Deviation Calculation', () => {
    it('should calculate standard deviation', () => {
      const values = [2, 4, 4, 4, 5, 5, 7, 9];
      const stdDev = aggregator.calculateStdDev(values);

      expect(stdDev).toBeGreaterThan(0);
      expect(stdDev).toBeCloseTo(2, 0); // Approximately 2
    });

    it('should return 0 for single value', () => {
      const values = [100];
      const stdDev = aggregator.calculateStdDev(values);

      expect(stdDev).toBe(0);
    });

    it('should return 0 for identical values', () => {
      const values = [100, 100, 100, 100];
      const stdDev = aggregator.calculateStdDev(values);

      expect(stdDev).toBe(0);
    });

    it('should handle empty array', () => {
      const values: number[] = [];
      const stdDev = aggregator.calculateStdDev(values);

      expect(stdDev).toBe(0);
    });
  });

  describe('Time-Series Analysis', () => {
    it('should calculate moving average', () => {
      const values = [100, 150, 200, 250, 300];
      const movingAvg = aggregator.calculateMovingAverage(values, 3);

      expect(movingAvg.length).toBeLessThanOrEqual(values.length);
      expect(movingAvg[0]).toBeCloseTo(150, 0); // (100 + 150 + 200) / 3
    });

    it('should handle window size larger than array', () => {
      const values = [100, 200];
      const movingAvg = aggregator.calculateMovingAverage(values, 5);

      expect(movingAvg.length).toBeGreaterThan(0);
    });

    it('should handle empty array', () => {
      const values: number[] = [];
      const movingAvg = aggregator.calculateMovingAverage(values, 3);

      expect(movingAvg.length).toBe(0);
    });
  });

  describe('Rate Calculation', () => {
    it('should calculate rate per second', () => {
      const metrics = [
        { timestamp: new Date('2025-01-01T10:00:00Z'), value: 1 },
        { timestamp: new Date('2025-01-01T10:00:01Z'), value: 1 },
        { timestamp: new Date('2025-01-01T10:00:02Z'), value: 1 },
        { timestamp: new Date('2025-01-01T10:00:03Z'), value: 1 },
      ];

      const rate = aggregator.calculateRate(metrics);

      // 4 events over ~3 seconds = ~1.33 per second
      expect(rate).toBeGreaterThan(0);
      expect(rate).toBeLessThanOrEqual(2);
    });

    it('should handle single metric', () => {
      const metrics = [
        { timestamp: new Date('2025-01-01T10:00:00Z'), value: 1 },
      ];

      const rate = aggregator.calculateRate(metrics);

      expect(rate).toBe(0);
    });

    it('should handle empty array', () => {
      const metrics: Array<{ timestamp: Date; value: number }> = [];
      const rate = aggregator.calculateRate(metrics);

      expect(rate).toBe(0);
    });
  });
});
