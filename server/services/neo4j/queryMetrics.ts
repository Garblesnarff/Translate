/**
 * Query Metrics for Performance Monitoring
 *
 * Tracks query execution times, result counts, cache hit rates, and slow queries.
 * Provides insights for optimization and troubleshooting.
 *
 * Phase 4, Task 4.4: Graph Query API
 */

// ============================================================================
// Types
// ============================================================================

interface QueryRecord {
  queryType: string;
  durationMs: number;
  resultCount: number;
  timestamp: number;
  cacheHit: boolean;
  error?: any;
}

interface SlowQuery {
  queryType: string;
  durationMs: number;
  resultCount: number;
  timestamp: Date;
}

interface QueryStats {
  queryType: string;
  totalQueries: number;
  avgDuration: number;
  p50Duration: number;
  p95Duration: number;
  p99Duration: number;
  maxDuration: number;
  minDuration: number;
  totalResults: number;
  avgResults: number;
  cacheHitRate: number;
  errorRate: number;
}

// ============================================================================
// QueryMetrics Class
// ============================================================================

export class QueryMetrics {
  private records: QueryRecord[];
  private maxRecords: number;
  private slowQueryThreshold: number;

  constructor(maxRecords: number = 10000, slowQueryThreshold: number = 1000) {
    this.records = [];
    this.maxRecords = maxRecords;
    this.slowQueryThreshold = slowQueryThreshold;
  }

  /**
   * Record query execution
   */
  recordQuery(
    queryType: string,
    durationMs: number,
    resultCount: number,
    cacheHit: boolean = false,
    error?: any
  ): void {
    const record: QueryRecord = {
      queryType,
      durationMs,
      resultCount,
      timestamp: Date.now(),
      cacheHit,
      error,
    };

    this.records.push(record);

    // Trim old records if exceeding max
    if (this.records.length > this.maxRecords) {
      this.records.shift();
    }

    // Log slow queries
    if (durationMs > this.slowQueryThreshold) {
      console.warn(
        `[QueryMetrics] Slow query detected: ${queryType} took ${durationMs}ms (${resultCount} results)`
      );
    }

    // Log errors
    if (error) {
      console.error(
        `[QueryMetrics] Query error: ${queryType} failed:`,
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  /**
   * Get statistics for a specific query type or all queries
   */
  getStats(queryType?: string): QueryStats | Record<string, QueryStats> {
    if (queryType) {
      return this.calculateStats(queryType);
    }

    // Get stats for all query types
    const allStats: Record<string, QueryStats> = {};
    const queryTypes = new Set(this.records.map(r => r.queryType));

    for (const type of queryTypes) {
      allStats[type] = this.calculateStats(type);
    }

    return allStats;
  }

  /**
   * Calculate statistics for a specific query type
   */
  private calculateStats(queryType: string): QueryStats {
    const filtered = this.records.filter(r => r.queryType === queryType);

    if (filtered.length === 0) {
      return {
        queryType,
        totalQueries: 0,
        avgDuration: 0,
        p50Duration: 0,
        p95Duration: 0,
        p99Duration: 0,
        maxDuration: 0,
        minDuration: 0,
        totalResults: 0,
        avgResults: 0,
        cacheHitRate: 0,
        errorRate: 0,
      };
    }

    // Sort by duration for percentile calculations
    const durations = filtered.map(r => r.durationMs).sort((a, b) => a - b);

    const totalQueries = filtered.length;
    const avgDuration = durations.reduce((a, b) => a + b, 0) / totalQueries;
    const p50Duration = this.percentile(durations, 0.5);
    const p95Duration = this.percentile(durations, 0.95);
    const p99Duration = this.percentile(durations, 0.99);
    const maxDuration = Math.max(...durations);
    const minDuration = Math.min(...durations);

    const totalResults = filtered.reduce((sum, r) => sum + r.resultCount, 0);
    const avgResults = totalResults / totalQueries;

    const cacheHits = filtered.filter(r => r.cacheHit).length;
    const cacheHitRate = cacheHits / totalQueries;

    const errors = filtered.filter(r => r.error !== undefined).length;
    const errorRate = errors / totalQueries;

    return {
      queryType,
      totalQueries,
      avgDuration: Math.round(avgDuration),
      p50Duration: Math.round(p50Duration),
      p95Duration: Math.round(p95Duration),
      p99Duration: Math.round(p99Duration),
      maxDuration,
      minDuration,
      totalResults,
      avgResults: Math.round(avgResults),
      cacheHitRate: Math.round(cacheHitRate * 100) / 100,
      errorRate: Math.round(errorRate * 100) / 100,
    };
  }

  /**
   * Get slow queries above threshold
   */
  getSlowQueries(thresholdMs?: number): SlowQuery[] {
    const threshold = thresholdMs || this.slowQueryThreshold;

    return this.records
      .filter(r => r.durationMs >= threshold)
      .map(r => ({
        queryType: r.queryType,
        durationMs: r.durationMs,
        resultCount: r.resultCount,
        timestamp: new Date(r.timestamp),
      }))
      .sort((a, b) => b.durationMs - a.durationMs)
      .slice(0, 50); // Top 50 slowest
  }

  /**
   * Get recent queries
   */
  getRecentQueries(limit: number = 100): Array<{
    queryType: string;
    durationMs: number;
    resultCount: number;
    timestamp: Date;
    cacheHit: boolean;
    error?: any;
  }> {
    return this.records
      .slice(-limit)
      .reverse()
      .map(r => ({
        queryType: r.queryType,
        durationMs: r.durationMs,
        resultCount: r.resultCount,
        timestamp: new Date(r.timestamp),
        cacheHit: r.cacheHit,
        error: r.error,
      }));
  }

  /**
   * Get error queries
   */
  getErrors(limit: number = 50): Array<{
    queryType: string;
    error: any;
    timestamp: Date;
  }> {
    return this.records
      .filter(r => r.error !== undefined)
      .slice(-limit)
      .reverse()
      .map(r => ({
        queryType: r.queryType,
        error: r.error,
        timestamp: new Date(r.timestamp),
      }));
  }

  /**
   * Get overall summary
   */
  getSummary(): {
    totalQueries: number;
    avgDuration: number;
    cacheHitRate: number;
    errorRate: number;
    slowQueryCount: number;
    queryTypes: number;
    timeRange: { start: Date; end: Date } | null;
  } {
    if (this.records.length === 0) {
      return {
        totalQueries: 0,
        avgDuration: 0,
        cacheHitRate: 0,
        errorRate: 0,
        slowQueryCount: 0,
        queryTypes: 0,
        timeRange: null,
      };
    }

    const totalQueries = this.records.length;
    const avgDuration = this.records.reduce((sum, r) => sum + r.durationMs, 0) / totalQueries;
    const cacheHits = this.records.filter(r => r.cacheHit).length;
    const cacheHitRate = cacheHits / totalQueries;
    const errors = this.records.filter(r => r.error !== undefined).length;
    const errorRate = errors / totalQueries;
    const slowQueryCount = this.records.filter(r => r.durationMs >= this.slowQueryThreshold).length;
    const queryTypes = new Set(this.records.map(r => r.queryType)).size;

    const timestamps = this.records.map(r => r.timestamp);
    const timeRange = {
      start: new Date(Math.min(...timestamps)),
      end: new Date(Math.max(...timestamps)),
    };

    return {
      totalQueries,
      avgDuration: Math.round(avgDuration),
      cacheHitRate: Math.round(cacheHitRate * 100) / 100,
      errorRate: Math.round(errorRate * 100) / 100,
      slowQueryCount,
      queryTypes,
      timeRange,
    };
  }

  /**
   * Calculate percentile from sorted array
   */
  private percentile(sorted: number[], p: number): number {
    if (sorted.length === 0) return 0;

    const index = Math.ceil(sorted.length * p) - 1;
    return sorted[Math.max(0, index)];
  }

  /**
   * Reset metrics
   */
  reset(): void {
    this.records = [];
  }

  /**
   * Export metrics to JSON
   */
  export(): {
    summary: ReturnType<typeof this.getSummary>;
    stats: Record<string, QueryStats>;
    slowQueries: SlowQuery[];
    errors: ReturnType<typeof this.getErrors>;
  } {
    return {
      summary: this.getSummary(),
      stats: this.getStats() as Record<string, QueryStats>,
      slowQueries: this.getSlowQueries(),
      errors: this.getErrors(),
    };
  }
}

/**
 * Format metrics for console output
 */
export function formatMetricsReport(metrics: QueryMetrics): string {
  const summary = metrics.getSummary();
  const stats = metrics.getStats() as Record<string, QueryStats>;

  let report = '\n';
  report += '========================================\n';
  report += '  QUERY METRICS REPORT\n';
  report += '========================================\n\n';

  report += '📊 SUMMARY:\n';
  report += `  Total Queries: ${summary.totalQueries}\n`;
  report += `  Avg Duration: ${summary.avgDuration}ms\n`;
  report += `  Cache Hit Rate: ${(summary.cacheHitRate * 100).toFixed(1)}%\n`;
  report += `  Error Rate: ${(summary.errorRate * 100).toFixed(1)}%\n`;
  report += `  Slow Queries: ${summary.slowQueryCount}\n`;
  report += `  Query Types: ${summary.queryTypes}\n\n`;

  report += '📈 BY QUERY TYPE:\n';
  for (const [type, stat] of Object.entries(stats)) {
    report += `\n  ${type}:\n`;
    report += `    Count: ${stat.totalQueries}\n`;
    report += `    Avg: ${stat.avgDuration}ms | P95: ${stat.p95Duration}ms | Max: ${stat.maxDuration}ms\n`;
    report += `    Cache Hit Rate: ${(stat.cacheHitRate * 100).toFixed(1)}%\n`;
    report += `    Avg Results: ${stat.avgResults}\n`;
  }

  const slowQueries = metrics.getSlowQueries();
  if (slowQueries.length > 0) {
    report += '\n\n🐌 SLOW QUERIES (Top 10):\n';
    slowQueries.slice(0, 10).forEach((sq, i) => {
      report += `  ${i + 1}. ${sq.queryType}: ${sq.durationMs}ms (${sq.resultCount} results)\n`;
    });
  }

  report += '\n========================================\n';

  return report;
}
