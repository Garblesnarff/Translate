/**
 * StatisticsAggregator - Statistical analysis for metrics
 * Task 2.2.2.2: Implement StatisticsAggregator
 *
 * Features:
 * - Calculate average, min, max, percentiles
 * - Group by time buckets (hour, day, week)
 * - Calculate trends
 * - Detect outliers
 */

/**
 * Statistics result
 */
export interface Statistics {
  avg: number;
  min: number;
  max: number;
  p50: number;
  p95: number;
  p99: number;
  count: number;
  trend: 'improving' | 'stable' | 'degrading';
}

/**
 * Metric with timestamp
 */
export interface TimestampedMetric {
  timestamp: Date;
  value: number;
}

/**
 * Metric with tags
 */
export interface TaggedMetric {
  value: number;
  tags?: Record<string, string>;
}

/**
 * Time bucket type
 */
export type TimeBucket = 'hour' | 'day' | 'week';

/**
 * Bucket result
 */
export interface BucketResult {
  count: number;
  sum: number;
  avg: number;
  min: number;
  max: number;
}

/**
 * Calculation options
 */
export interface StatsOptions {
  higherIsBetter?: boolean;
}

/**
 * StatisticsAggregator
 */
export class StatisticsAggregator {
  /**
   * Calculate comprehensive statistics
   */
  calculateStats(values: number[], options?: StatsOptions): Statistics {
    if (values.length === 0) {
      return {
        avg: 0,
        min: 0,
        max: 0,
        p50: 0,
        p95: 0,
        p99: 0,
        count: 0,
        trend: 'stable',
      };
    }

    const sorted = [...values].sort((a, b) => a - b);
    const count = values.length;
    const sum = values.reduce((acc, val) => acc + val, 0);
    const avg = sum / count;
    const min = sorted[0];
    const max = sorted[count - 1];

    // Calculate percentiles
    const p50 = this.calculatePercentile(sorted, 50);
    const p95 = this.calculatePercentile(sorted, 95);
    const p99 = this.calculatePercentile(sorted, 99);

    // Calculate trend
    const trend = this.calculateTrend(values, options);

    return {
      avg,
      min,
      max,
      p50,
      p95,
      p99,
      count,
      trend,
    };
  }

  /**
   * Calculate percentile
   */
  private calculatePercentile(sorted: number[], percentile: number): number {
    if (sorted.length === 0) return 0;
    if (sorted.length === 1) return sorted[0];

    const index = (percentile / 100) * (sorted.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);

    if (lower === upper) {
      return sorted[lower];
    }

    // Interpolate between values
    const fraction = index - lower;
    return sorted[lower] * (1 - fraction) + sorted[upper] * fraction;
  }

  /**
   * Calculate trend
   */
  private calculateTrend(
    values: number[],
    options?: StatsOptions
  ): 'improving' | 'stable' | 'degrading' {
    if (values.length < 2) {
      return 'stable';
    }

    const mid = Math.floor(values.length / 2);
    const firstHalf = values.slice(0, mid);
    const secondHalf = values.slice(mid);

    const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;

    const change = (secondAvg - firstAvg) / Math.abs(firstAvg);

    // Determine if higher is better (e.g., quality scores)
    const higherIsBetter = options?.higherIsBetter || false;

    // Threshold for considering a change significant
    const threshold = 0.05; // 5% change

    if (Math.abs(change) < threshold) {
      return 'stable';
    }

    if (higherIsBetter) {
      return change > 0 ? 'improving' : 'degrading';
    } else {
      // For latency, lower is better
      return change < 0 ? 'improving' : 'degrading';
    }
  }

  /**
   * Detect outliers (values > 3 standard deviations from mean)
   */
  detectOutliers(values: number[]): number[] {
    if (values.length < 2) {
      return [];
    }

    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const stdDev = this.calculateStdDev(values);

    if (stdDev === 0) {
      return [];
    }

    const outliers: number[] = [];
    const threshold = 2.5; // Use 2.5 instead of 3 for more sensitive detection

    values.forEach(value => {
      const zScore = Math.abs((value - mean) / stdDev);
      if (zScore >= threshold) {
        outliers.push(value);
      }
    });

    return outliers;
  }

  /**
   * Calculate standard deviation
   */
  calculateStdDev(values: number[]): number {
    if (values.length < 2) {
      return 0;
    }

    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const squaredDiffs = values.map(value => Math.pow(value - mean, 2));
    const variance = squaredDiffs.reduce((a, b) => a + b, 0) / values.length;

    return Math.sqrt(variance);
  }

  /**
   * Group metrics by time bucket
   */
  groupByTimeBucket(
    metrics: TimestampedMetric[],
    bucket: TimeBucket
  ): Record<string, BucketResult> {
    if (metrics.length === 0) {
      return {};
    }

    const grouped: Record<string, number[]> = {};

    metrics.forEach(metric => {
      const key = this.getBucketKey(metric.timestamp, bucket);
      if (!grouped[key]) {
        grouped[key] = [];
      }
      grouped[key].push(metric.value);
    });

    // Aggregate each bucket
    const result: Record<string, BucketResult> = {};

    Object.entries(grouped).forEach(([key, values]) => {
      const count = values.length;
      const sum = values.reduce((a, b) => a + b, 0);
      const avg = sum / count;
      const min = Math.min(...values);
      const max = Math.max(...values);

      result[key] = { count, sum, avg, min, max };
    });

    return result;
  }

  /**
   * Get bucket key for timestamp
   */
  private getBucketKey(timestamp: Date, bucket: TimeBucket): string {
    const date = new Date(timestamp);

    switch (bucket) {
      case 'hour':
        return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}_${String(date.getUTCHours()).padStart(2, '0')}`;

      case 'day':
        return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;

      case 'week':
        const weekNumber = this.getWeekNumber(date);
        return `${date.getUTCFullYear()}-W${String(weekNumber).padStart(2, '0')}`;
    }
  }

  /**
   * Get ISO week number
   */
  private getWeekNumber(date: Date): number {
    const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  }

  /**
   * Group metrics by tag value
   */
  groupByTag(
    metrics: TaggedMetric[],
    tagKey: string
  ): Record<string, { count: number; sum: number; avg: number }> {
    const grouped: Record<string, number[]> = {};

    metrics.forEach(metric => {
      if (metric.tags && metric.tags[tagKey]) {
        const tagValue = metric.tags[tagKey];
        if (!grouped[tagValue]) {
          grouped[tagValue] = [];
        }
        grouped[tagValue].push(metric.value);
      }
    });

    // Aggregate each group
    const result: Record<string, { count: number; sum: number; avg: number }> = {};

    Object.entries(grouped).forEach(([tagValue, values]) => {
      const count = values.length;
      const sum = values.reduce((a, b) => a + b, 0);
      const avg = sum / count;

      result[tagValue] = { count, sum, avg };
    });

    return result;
  }

  /**
   * Calculate moving average
   */
  calculateMovingAverage(values: number[], windowSize: number): number[] {
    if (values.length === 0 || windowSize < 1) {
      return [];
    }

    const result: number[] = [];
    const actualWindowSize = Math.min(windowSize, values.length);

    for (let i = 0; i <= values.length - actualWindowSize; i++) {
      const window = values.slice(i, i + actualWindowSize);
      const avg = window.reduce((a, b) => a + b, 0) / window.length;
      result.push(avg);
    }

    return result;
  }

  /**
   * Calculate rate (events per second)
   */
  calculateRate(metrics: TimestampedMetric[]): number {
    if (metrics.length < 2) {
      return 0;
    }

    const timestamps = metrics.map(m => new Date(m.timestamp).getTime());
    const minTime = Math.min(...timestamps);
    const maxTime = Math.max(...timestamps);
    const durationSeconds = (maxTime - minTime) / 1000;

    if (durationSeconds === 0) {
      return 0;
    }

    return metrics.length / durationSeconds;
  }
}
