/**
 * Query Cache for Performance Optimization
 *
 * In-memory LRU cache for frequently-accessed graph query results.
 * Reduces database load and improves response times for common queries.
 *
 * Phase 4, Task 4.4: Graph Query API
 */

import crypto from 'crypto';

// ============================================================================
// Types
// ============================================================================

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
  hits: number;
  createdAt: number;
}

// ============================================================================
// QueryCache Class
// ============================================================================

export class QueryCache {
  private cache: Map<string, CacheEntry<any>>;
  private maxSize: number;
  private defaultTTL: number;

  constructor(maxSize: number = 1000, defaultTTL: number = 3600) {
    this.cache = new Map();
    this.maxSize = maxSize;
    this.defaultTTL = defaultTTL; // seconds
  }

  /**
   * Get cached value
   */
  async get<T>(key: string): Promise<T | null> {
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    // Increment hit counter
    entry.hits++;

    return entry.value as T;
  }

  /**
   * Set cached value
   */
  async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    const ttl = ttlSeconds || this.defaultTTL;

    // Evict oldest entries if cache is full
    if (this.cache.size >= this.maxSize) {
      this.evictLRU();
    }

    const entry: CacheEntry<T> = {
      value,
      expiresAt: Date.now() + ttl * 1000,
      hits: 0,
      createdAt: Date.now(),
    };

    this.cache.set(key, entry);
  }

  /**
   * Generate cache key from query type and parameters
   */
  generateKey(queryType: string, params: any): string {
    const paramStr = JSON.stringify(params, Object.keys(params).sort());
    const hash = crypto.createHash('md5').update(paramStr).digest('hex');

    return `${queryType}:${hash}`;
  }

  /**
   * Invalidate cache entries matching a pattern
   */
  invalidate(pattern: string): void {
    const regex = new RegExp(pattern);

    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    size: number;
    maxSize: number;
    hitRate: number;
    entries: Array<{ key: string; hits: number; age: number }>;
  } {
    const entries: Array<{ key: string; hits: number; age: number }> = [];
    let totalHits = 0;

    for (const [key, entry] of this.cache.entries()) {
      const age = Math.floor((Date.now() - entry.createdAt) / 1000);
      entries.push({ key, hits: entry.hits, age });
      totalHits += entry.hits;
    }

    const hitRate = totalHits > 0 ? totalHits / this.cache.size : 0;

    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      hitRate,
      entries: entries.sort((a, b) => b.hits - a.hits).slice(0, 20), // Top 20
    };
  }

  /**
   * Evict least recently used entry
   */
  private evictLRU(): void {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;

    for (const [key, entry] of this.cache.entries()) {
      // Prefer evicting expired entries first
      if (Date.now() > entry.expiresAt) {
        this.cache.delete(key);
        return;
      }

      // Otherwise evict oldest entry with fewest hits
      const score = entry.createdAt + entry.hits * 10000;
      if (score < oldestTime) {
        oldestTime = score;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
    }
  }

  /**
   * Clean up expired entries
   */
  cleanup(): number {
    const now = Date.now();
    let removed = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
        removed++;
      }
    }

    return removed;
  }

  /**
   * Warm up cache with common queries
   */
  async warmup(queries: Array<{ key: string; value: any; ttl?: number }>): Promise<void> {
    for (const { key, value, ttl } of queries) {
      await this.set(key, value, ttl);
    }
  }
}

/**
 * Start periodic cleanup task
 */
export function startCacheCleanup(cache: QueryCache, intervalMs: number = 60000): NodeJS.Timeout {
  return setInterval(() => {
    const removed = cache.cleanup();
    if (removed > 0) {
      console.log(`[QueryCache] Cleaned up ${removed} expired entries`);
    }
  }, intervalMs);
}
