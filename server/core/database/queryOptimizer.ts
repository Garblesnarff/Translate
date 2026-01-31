/**
 * Query Optimizer V2
 *
 * Provides:
 * - EXPLAIN ANALYZE for query analysis
 * - Slow query logging (queries >100ms)
 * - Query result caching (5-minute TTL)
 * - Query plan analysis
 * - Performance metrics tracking
 */

import type { DatabaseService } from '../database.js';

export interface QueryPlan {
  query: string;
  planningTime?: number;
  executionTime?: number;
  plan?: any;
  rows?: number;
  cost?: number;
}

export interface SlowQuery {
  query: string;
  duration: number;
  timestamp: Date;
  params?: any[];
  stackTrace?: string;
}

export interface QueryMetrics {
  totalQueries: number;
  slowQueries: number;
  avgDuration: number;
  maxDuration: number;
  cacheHits: number;
  cacheMisses: number;
}

interface CachedResult {
  data: any[];
  timestamp: number;
  ttl: number;
}

/**
 * Query Optimizer
 * Analyzes and optimizes database queries
 */
export class QueryOptimizer {
  private db: DatabaseService;
  private slowQueryThreshold: number; // milliseconds
  private slowQueries: SlowQuery[] = [];
  private maxSlowQueries: number = 1000;

  // Query cache (5-minute TTL by default)
  private queryCache: Map<string, CachedResult> = new Map();
  private defaultCacheTTL: number = 5 * 60 * 1000; // 5 minutes

  // Metrics
  private metrics: QueryMetrics = {
    totalQueries: 0,
    slowQueries: 0,
    avgDuration: 0,
    maxDuration: 0,
    cacheHits: 0,
    cacheMisses: 0,
  };

  constructor(
    db: DatabaseService,
    options: {
      slowQueryThreshold?: number;
      cacheTTL?: number;
      maxSlowQueries?: number;
    } = {}
  ) {
    this.db = db;
    this.slowQueryThreshold = options.slowQueryThreshold || 100; // 100ms default
    this.defaultCacheTTL = options.cacheTTL || 5 * 60 * 1000;
    this.maxSlowQueries = options.maxSlowQueries || 1000;

    // Periodic cache cleanup
    setInterval(() => this.cleanExpiredCache(), 60000); // Every minute
  }

  /**
   * Execute query with performance tracking
   */
  async query<T = any>(
    sql: string,
    params?: any[],
    options: { cache?: boolean; cacheTTL?: number } = {}
  ): Promise<T[]> {
    const startTime = performance.now();
    const cacheKey = this.getCacheKey(sql, params);

    // Check cache if enabled
    if (options.cache) {
      const cached = this.getFromCache<T>(cacheKey);
      if (cached) {
        this.metrics.cacheHits++;
        return cached;
      }
      this.metrics.cacheMisses++;
    }

    try {
      // Execute query
      const result = await this.db.query<T>(sql, params);

      // Track metrics
      const duration = performance.now() - startTime;
      this.trackQueryMetrics(sql, duration, params);

      // Cache result if enabled
      if (options.cache) {
        this.setCache(cacheKey, result, options.cacheTTL || this.defaultCacheTTL);
      }

      return result;
    } catch (error) {
      const duration = performance.now() - startTime;
      this.logSlowQuery(sql, duration, params, error);
      throw error;
    }
  }

  /**
   * Analyze query plan (PostgreSQL only)
   */
  async analyzeQuery(sql: string, params?: any[]): Promise<QueryPlan> {
    if (this.db.dialect !== 'postgres') {
      return {
        query: sql,
        plan: 'Query analysis only available for PostgreSQL',
      };
    }

    try {
      // EXPLAIN ANALYZE shows actual execution time
      const explainSql = `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${sql}`;
      const result = await this.db.query(explainSql, params);

      const plan = result[0]?.['QUERY PLAN'] || result[0];

      return {
        query: sql,
        planningTime: plan[0]?.['Planning Time'],
        executionTime: plan[0]?.['Execution Time'],
        plan: plan[0]?.Plan,
        rows: plan[0]?.Plan?.['Actual Rows'],
        cost: plan[0]?.Plan?.['Total Cost'],
      };
    } catch (error) {
      console.error('Query analysis failed:', error);
      return {
        query: sql,
        plan: `Analysis failed: ${error}`,
      };
    }
  }

  /**
   * Get slow queries
   */
  getSlowQueries(limit?: number): SlowQuery[] {
    const queries = [...this.slowQueries].sort((a, b) => b.duration - a.duration);
    return limit ? queries.slice(0, limit) : queries;
  }

  /**
   * Log slow query
   */
  logSlowQuery(query: string, duration: number, params?: any[], error?: any): void {
    if (duration >= this.slowQueryThreshold) {
      const slowQuery: SlowQuery = {
        query,
        duration,
        timestamp: new Date(),
        params,
        stackTrace: new Error().stack,
      };

      this.slowQueries.push(slowQuery);

      // Keep only the most recent slow queries
      if (this.slowQueries.length > this.maxSlowQueries) {
        this.slowQueries.shift();
      }

      // Log to console
      console.warn(`🐌 Slow query detected (${duration.toFixed(2)}ms):`, {
        query: query.substring(0, 200),
        duration: `${duration.toFixed(2)}ms`,
        params: params?.length ? `${params.length} params` : 'no params',
        error: error ? error.message : undefined,
      });
    }
  }

  /**
   * Track query metrics
   */
  private trackQueryMetrics(sql: string, duration: number, params?: any[]): void {
    this.metrics.totalQueries++;

    // Update average duration
    const totalDuration = this.metrics.avgDuration * (this.metrics.totalQueries - 1);
    this.metrics.avgDuration = (totalDuration + duration) / this.metrics.totalQueries;

    // Update max duration
    if (duration > this.metrics.maxDuration) {
      this.metrics.maxDuration = duration;
    }

    // Track slow queries
    if (duration >= this.slowQueryThreshold) {
      this.metrics.slowQueries++;
      this.logSlowQuery(sql, duration, params);
    }
  }

  /**
   * Get query metrics
   */
  getMetrics(): QueryMetrics {
    return { ...this.metrics };
  }

  /**
   * Reset metrics
   */
  resetMetrics(): void {
    this.metrics = {
      totalQueries: 0,
      slowQueries: 0,
      avgDuration: 0,
      maxDuration: 0,
      cacheHits: 0,
      cacheMisses: 0,
    };
  }

  /**
   * Clear slow query log
   */
  clearSlowQueries(): void {
    this.slowQueries = [];
  }

  /**
   * Generate cache key
   */
  private getCacheKey(sql: string, params?: any[]): string {
    return `${sql}:${JSON.stringify(params || [])}`;
  }

  /**
   * Get from cache
   */
  private getFromCache<T>(key: string): T[] | null {
    const cached = this.queryCache.get(key);

    if (!cached) {
      return null;
    }

    // Check if expired
    const now = Date.now();
    if (now - cached.timestamp > cached.ttl) {
      this.queryCache.delete(key);
      return null;
    }

    return cached.data as T[];
  }

  /**
   * Set cache
   */
  private setCache(key: string, data: any[], ttl: number): void {
    this.queryCache.set(key, {
      data,
      timestamp: Date.now(),
      ttl,
    });
  }

  /**
   * Clean expired cache entries
   */
  private cleanExpiredCache(): void {
    const now = Date.now();
    const toDelete: string[] = [];

    // Convert to array to avoid iterator issues
    Array.from(this.queryCache.entries()).forEach(([key, value]) => {
      if (now - value.timestamp > value.ttl) {
        toDelete.push(key);
      }
    });

    toDelete.forEach(key => {
      this.queryCache.delete(key);
    });

    if (toDelete.length > 0) {
      console.log(`🧹 Cleaned ${toDelete.length} expired cache entries`);
    }
  }

  /**
   * Clear all cache
   */
  clearCache(): void {
    this.queryCache.clear();
    console.log('🗑️  Query cache cleared');
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return {
      size: this.queryCache.size,
      hitRate: this.metrics.totalQueries > 0
        ? (this.metrics.cacheHits / this.metrics.totalQueries) * 100
        : 0,
      hits: this.metrics.cacheHits,
      misses: this.metrics.cacheMisses,
    };
  }

  /**
   * Paginate query results
   */
  async queryWithPagination<T = any>(
    sql: string,
    params: any[] = [],
    options: {
      page: number;
      pageSize: number;
      cache?: boolean;
    }
  ): Promise<{ data: T[]; total: number; page: number; pageSize: number; totalPages: number }> {
    const { page, pageSize, cache } = options;

    // Get total count
    const countSql = `SELECT COUNT(*) as count FROM (${sql}) AS subquery`;
    const countResult = await this.query<{ count: number }>(countSql, params, { cache });
    const total = Number(countResult[0]?.count || 0);

    // Calculate pagination
    const offset = (page - 1) * pageSize;
    const totalPages = Math.ceil(total / pageSize);

    // Get paginated results
    const paginatedSql = this.db.dialect === 'postgres'
      ? `${sql} LIMIT $${params.length + 1} OFFSET $${params.length + 2}`
      : `${sql} LIMIT ? OFFSET ?`;

    const data = await this.query<T>(
      paginatedSql,
      [...params, pageSize, offset],
      { cache }
    );

    return {
      data,
      total,
      page,
      pageSize,
      totalPages,
    };
  }
}

/**
 * Export singleton instance
 */
let optimizerInstance: QueryOptimizer | null = null;

export function getQueryOptimizer(db: DatabaseService): QueryOptimizer {
  if (!optimizerInstance) {
    optimizerInstance = new QueryOptimizer(db);
  }
  return optimizerInstance;
}

export function createQueryOptimizer(
  db: DatabaseService,
  options?: {
    slowQueryThreshold?: number;
    cacheTTL?: number;
    maxSlowQueries?: number;
  }
): QueryOptimizer {
  return new QueryOptimizer(db, options);
}
