/**
 * MonitoringService - Unified monitoring service for metrics collection
 * Task 2.2.1.2: Implement MonitoringService
 *
 * Features:
 * - In-memory metric buffering
 * - Auto-flush every 30 seconds OR when buffer reaches 100 metrics
 * - Performance, quality, and cache tracking
 * - Health checks and statistics
 */

import { DatabaseService } from '../../core/database';

/**
 * Metric interface
 */
export interface Metric {
  timestamp: number;
  name: string;
  value: number;
  tags?: Record<string, string>;
}

/**
 * Quality score interface
 */
export interface QualityScore {
  overall: number;
  confidence: number;
  format?: number;
  preservation?: number;
}

/**
 * Time range interface
 */
export interface TimeRange {
  start: number;
  end: number;
}

/**
 * Statistics interface
 */
export interface Statistics {
  [metricName: string]: {
    avg: number;
    min: number;
    max: number;
    p50: number;
    p95: number;
    p99: number;
    count: number;
    trend: 'improving' | 'stable' | 'degrading';
  };
}

/**
 * Health status interface
 */
export interface HealthStatus {
  healthy: boolean;
  uptime: number;
  database: 'connected' | 'disconnected';
  cache: 'available' | 'unavailable';
  lastError?: string;
}

/**
 * Configuration options
 */
export interface MonitoringConfig {
  bufferSize?: number;
  flushIntervalMs?: number;
}

/**
 * MonitoringService - Main monitoring service
 */
export class MonitoringService {
  private metricsBuffer: Metric[] = [];
  private readonly bufferSize: number;
  private readonly flushIntervalMs: number;
  private flushTimer?: NodeJS.Timeout;
  private readonly db: DatabaseService;
  private readonly startTime: number;
  private lastError?: string;

  constructor(db: DatabaseService, config?: MonitoringConfig) {
    this.db = db;
    this.bufferSize = config?.bufferSize || 100;
    this.flushIntervalMs = config?.flushIntervalMs || 30000;
    this.startTime = Date.now();

    // Start auto-flush timer
    this.startAutoFlush();
  }

  /**
   * Start auto-flush timer
   */
  private startAutoFlush(): void {
    this.flushTimer = setInterval(() => {
      if (this.metricsBuffer.length > 0) {
        this.flush().catch(error => {
          console.error('Auto-flush failed:', error);
          this.lastError = error.message;
        });
      }
    }, this.flushIntervalMs);
  }

  /**
   * Record a metric
   */
  record(name: string, value: number, tags?: Record<string, string>): void {
    const metric: Metric = {
      timestamp: Date.now(),
      name,
      value,
      tags,
    };

    this.metricsBuffer.push(metric);

    // Auto-flush if buffer is full
    if (this.metricsBuffer.length >= this.bufferSize) {
      this.flush().catch(error => {
        console.error('Buffer-full flush failed:', error);
        this.lastError = error.message;
      });
    }
  }

  /**
   * Track translation performance
   */
  async trackTranslation(duration: number, success: boolean): Promise<void> {
    this.record('translation.duration', duration);
    this.record('translation.success', success ? 1 : 0);
  }

  /**
   * Track quality metrics
   */
  async trackQuality(score: QualityScore): Promise<void> {
    this.record('quality.overall', score.overall);
    this.record('quality.confidence', score.confidence);

    if (score.format !== undefined) {
      this.record('quality.format', score.format);
    }

    if (score.preservation !== undefined) {
      this.record('quality.preservation', score.preservation);
    }
  }

  /**
   * Track cache hits/misses
   */
  async trackCache(hit: boolean): Promise<void> {
    this.record('cache.hit', hit ? 1 : 0);
  }

  /**
   * Flush buffered metrics to database
   */
  async flush(): Promise<void> {
    if (this.metricsBuffer.length === 0) {
      return;
    }

    const metricsToFlush = [...this.metricsBuffer];
    this.metricsBuffer = [];

    try {
      // Batch insert metrics
      if (this.db.dialect === 'postgres') {
        await this.flushPostgres(metricsToFlush);
      } else {
        await this.flushSqlite(metricsToFlush);
      }
    } catch (error) {
      console.error('Failed to flush metrics to database:', error);
      this.lastError = error instanceof Error ? error.message : String(error);

      // Put metrics back in buffer for retry (only if not too many)
      if (this.metricsBuffer.length < this.bufferSize * 2) {
        this.metricsBuffer.unshift(...metricsToFlush);
      }
    }
  }

  /**
   * Flush to PostgreSQL
   */
  private async flushPostgres(metrics: Metric[]): Promise<void> {
    const values: any[] = [];
    const placeholders: string[] = [];

    metrics.forEach((metric, index) => {
      const offset = index * 4;
      placeholders.push(`($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4})`);
      values.push(
        new Date(metric.timestamp),
        metric.name,
        metric.value,
        metric.tags ? JSON.stringify(metric.tags) : null
      );
    });

    const sql = `
      INSERT INTO metrics (timestamp, metric_name, value, tags)
      VALUES ${placeholders.join(', ')}
    `;

    await this.db.query(sql, values);
  }

  /**
   * Flush to SQLite
   */
  private async flushSqlite(metrics: Metric[]): Promise<void> {
    const values: any[] = [];
    const placeholders: string[] = [];

    metrics.forEach(() => {
      placeholders.push('(?, ?, ?, ?)');
    });

    metrics.forEach(metric => {
      values.push(
        new Date(metric.timestamp).toISOString(),
        metric.name,
        metric.value,
        metric.tags ? JSON.stringify(metric.tags) : null
      );
    });

    const sql = `
      INSERT INTO metrics (timestamp, metric_name, value, tags)
      VALUES ${placeholders.join(', ')}
    `;

    await this.db.query(sql, values);
  }

  /**
   * Get statistics for time range
   */
  async getStats(timeRange: TimeRange): Promise<Statistics> {
    const sql = `
      SELECT metric_name, value, timestamp
      FROM metrics
      WHERE timestamp >= ? AND timestamp <= ?
      ORDER BY metric_name, timestamp
    `;

    const params = this.db.dialect === 'postgres'
      ? [new Date(timeRange.start), new Date(timeRange.end)]
      : [new Date(timeRange.start).toISOString(), new Date(timeRange.end).toISOString()];

    const rows = await this.db.query<{
      metric_name: string;
      value: number;
      timestamp: Date | string;
    }>(sql, params);

    // Group by metric name
    const grouped = new Map<string, number[]>();

    rows.forEach(row => {
      if (!grouped.has(row.metric_name)) {
        grouped.set(row.metric_name, []);
      }
      grouped.get(row.metric_name)!.push(row.value);
    });

    // Calculate statistics for each metric
    const stats: Statistics = {};

    grouped.forEach((values, metricName) => {
      stats[metricName] = this.calculateStats(values);
    });

    return stats;
  }

  /**
   * Calculate statistics for a set of values
   */
  private calculateStats(values: number[]): Statistics[string] {
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
    const p50 = this.percentile(sorted, 0.5);
    const p95 = this.percentile(sorted, 0.95);
    const p99 = this.percentile(sorted, 0.99);

    // Calculate trend (simplified: compare first half to second half)
    const trend = this.calculateTrend(values);

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
  private percentile(sorted: number[], p: number): number {
    const index = Math.ceil(sorted.length * p) - 1;
    return sorted[Math.max(0, Math.min(index, sorted.length - 1))];
  }

  /**
   * Calculate trend
   */
  private calculateTrend(values: number[]): 'improving' | 'stable' | 'degrading' {
    if (values.length < 2) {
      return 'stable';
    }

    const mid = Math.floor(values.length / 2);
    const firstHalf = values.slice(0, mid);
    const secondHalf = values.slice(mid);

    const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;

    const change = (secondAvg - firstAvg) / firstAvg;

    // For latency metrics, lower is better
    if (change < -0.1) return 'improving';
    if (change > 0.1) return 'degrading';
    return 'stable';
  }

  /**
   * Check system health
   */
  async checkHealth(): Promise<HealthStatus> {
    const uptime = Date.now() - this.startTime;

    // Check database connection
    let dbConnected = false;
    try {
      dbConnected = await this.db.healthCheck();
    } catch (error) {
      console.error('Database health check failed:', error);
    }

    // Check cache (placeholder - would check actual cache service)
    const cacheAvailable = true;

    return {
      healthy: dbConnected && cacheAvailable,
      uptime,
      database: dbConnected ? 'connected' : 'disconnected',
      cache: cacheAvailable ? 'available' : 'unavailable',
      lastError: this.lastError,
    };
  }

  /**
   * Get current buffer size
   */
  getBufferSize(): number {
    return this.metricsBuffer.length;
  }

  /**
   * Destroy service and cleanup
   */
  async destroy(): Promise<void> {
    // Clear timer
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }

    // Final flush
    await this.flush();
  }
}
