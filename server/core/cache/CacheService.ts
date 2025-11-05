/**
 * Multi-Layer Cache Service
 *
 * Coordinates between L1 (Memory) and L2 (Redis) caches for optimal performance.
 * Implements transparent cache-aside pattern with write-through strategy.
 *
 * Strategy:
 * 1. Read: Check L1 (instant) → L2 (fast) → null (miss)
 * 2. Write: Update L1 and L2 simultaneously (write-through)
 * 3. L2 hit: Populate L1 for future reads (promotion)
 *
 * Performance characteristics:
 * - L1 hit: ~0.01ms (synchronous memory access)
 * - L2 hit: ~1-5ms (Redis network call)
 * - Cache miss: Caller must fetch and populate
 */

import type {
  CacheProvider,
  CacheStats,
  MultiLayerCacheConfig,
} from './types.js';
import { MemoryCache, type MemoryCacheConfig } from './MemoryCache.js';
import { RedisCache, type RedisCacheConfig } from './RedisCache.js';

export interface CacheServiceConfig {
  /** L1 (Memory) cache configuration */
  l1?: MemoryCacheConfig;

  /** L2 (Redis) cache configuration */
  l2?: RedisCacheConfig;

  /** Enable write-through (write to both layers, default: true) */
  writeThrough?: boolean;

  /** Enable L1 promotion on L2 hits (default: true) */
  promoteOnL2Hit?: boolean;

  /** Enable cache statistics (default: true) */
  enableStats?: boolean;
}

/**
 * Multi-layer cache service coordinating L1 and L2 caches
 */
export class CacheService implements CacheProvider {
  private l1: MemoryCache;
  private l2: RedisCache;
  private writeThrough: boolean;
  private promoteOnL2Hit: boolean;
  private enableStats: boolean;

  // Statistics
  private l1Hits = 0;
  private l2Hits = 0;
  private totalMisses = 0;

  constructor(config: CacheServiceConfig = {}) {
    this.l1 = new MemoryCache(config.l1);
    this.l2 = new RedisCache(config.l2);
    this.writeThrough = config.writeThrough ?? true;
    this.promoteOnL2Hit = config.promoteOnL2Hit ?? true;
    this.enableStats = config.enableStats ?? true;
  }

  /**
   * Get value from cache (multi-layer lookup)
   *
   * Flow:
   * 1. Check L1 (memory) - instant
   * 2. If miss, check L2 (Redis) - fast
   * 3. If L2 hit, promote to L1
   * 4. If both miss, return null
   */
  async get<T>(key: string): Promise<T | null> {
    // Try L1 first (fastest)
    const l1Value = await this.l1.get<T>(key);
    if (l1Value !== null) {
      if (this.enableStats) {
        this.l1Hits++;
      }
      return l1Value;
    }

    // L1 miss, try L2
    const l2Value = await this.l2.get<T>(key);
    if (l2Value !== null) {
      if (this.enableStats) {
        this.l2Hits++;
      }

      // Promote to L1 for faster future access
      if (this.promoteOnL2Hit) {
        await this.l1.set(key, l2Value);
      }

      return l2Value;
    }

    // Both layers missed
    if (this.enableStats) {
      this.totalMisses++;
    }

    return null;
  }

  /**
   * Set value in cache (multi-layer write)
   *
   * Flow:
   * 1. Always write to L1 (memory)
   * 2. If writeThrough enabled, also write to L2 (Redis)
   * 3. Both operations happen in parallel for speed
   */
  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    if (this.writeThrough) {
      // Write to both layers in parallel
      await Promise.all([
        this.l1.set(key, value, ttl),
        this.l2.set(key, value, ttl),
      ]);
    } else {
      // Write to L1 only
      await this.l1.set(key, value, ttl);
    }
  }

  /**
   * Delete from both cache layers
   */
  async delete(key: string): Promise<void> {
    await Promise.all([this.l1.delete(key), this.l2.delete(key)]);
  }

  /**
   * Clear both cache layers
   */
  async clear(): Promise<void> {
    await Promise.all([this.l1.clear(), this.l2.clear()]);

    // Reset stats
    if (this.enableStats) {
      this.l1Hits = 0;
      this.l2Hits = 0;
      this.totalMisses = 0;
    }
  }

  /**
   * Check if key exists in either layer
   */
  async has(key: string): Promise<boolean> {
    // Check L1 first (faster)
    const inL1 = await this.l1.has(key);
    if (inL1) {
      return true;
    }

    // Check L2
    return await this.l2.has(key);
  }

  /**
   * Get combined cache statistics
   */
  async getStats(): Promise<CacheStats> {
    const [l1Stats, l2Stats] = await Promise.all([
      this.l1.getStats(),
      this.l2.getStats(),
    ]);

    const totalHits = this.l1Hits + this.l2Hits;
    const total = totalHits + this.totalMisses;
    const overallHitRate = total > 0 ? totalHits / total : 0;

    return {
      size: l1Stats.size + l2Stats.size,
      hits: totalHits,
      misses: this.totalMisses,
      hitRate: overallHitRate,
      l1: {
        size: l1Stats.size,
        hits: this.l1Hits,
        hitRate: l1Stats.hitRate,
        memoryUsed: l1Stats.memoryUsed,
        maxSize: l1Stats.maxSize,
      },
      l2: {
        size: l2Stats.size,
        hits: this.l2Hits,
        hitRate: l2Stats.hitRate,
        connected: (l2Stats as any).connected,
      },
    };
  }

  /**
   * Get detailed layer statistics
   */
  async getLayerStats(): Promise<{
    l1: CacheStats;
    l2: CacheStats;
    combined: CacheStats;
  }> {
    const [l1Stats, l2Stats, combined] = await Promise.all([
      this.l1.getStats(),
      this.l2.getStats(),
      this.getStats(),
    ]);

    return {
      l1: l1Stats,
      l2: l2Stats,
      combined,
    };
  }

  /**
   * Get cache efficiency metrics
   */
  async getEfficiency(): Promise<{
    l1HitRatio: number;
    l2HitRatio: number;
    overallHitRate: number;
    avgLatency: {
      l1: string;
      l2: string;
      miss: string;
    };
  }> {
    const totalHits = this.l1Hits + this.l2Hits;
    const total = totalHits + this.totalMisses;

    return {
      l1HitRatio: total > 0 ? this.l1Hits / total : 0,
      l2HitRatio: total > 0 ? this.l2Hits / total : 0,
      overallHitRate: total > 0 ? totalHits / total : 0,
      avgLatency: {
        l1: '~0.01ms',
        l2: '~1-5ms',
        miss: 'varies',
      },
    };
  }

  /**
   * Warm up L1 cache from L2 for specific keys
   * Useful for preloading frequently accessed data
   */
  async warmupL1(keys: string[]): Promise<number> {
    let warmedUp = 0;

    await Promise.all(
      keys.map(async (key) => {
        const value = await this.l2.get(key);
        if (value !== null) {
          await this.l1.set(key, value);
          warmedUp++;
        }
      })
    );

    return warmedUp;
  }

  /**
   * Sync L2 with L1 data (push L1 to L2)
   * Useful before shutting down to persist memory cache
   */
  async syncL2FromL1(): Promise<number> {
    let synced = 0;

    const entries = this.l1.getEntries();

    await Promise.all(
      entries.map(async ({ key, entry }) => {
        try {
          await this.l2.set(key, entry.value);
          synced++;
        } catch (error) {
          console.error(`[CacheService] Failed to sync key ${key}:`, error);
        }
      })
    );

    return synced;
  }

  /**
   * Invalidate cache entries matching a pattern
   * Useful for invalidating related cache entries
   */
  async invalidatePattern(pattern: RegExp): Promise<number> {
    let invalidated = 0;

    const l1Keys = this.l1.getKeys();

    // Invalidate matching keys
    await Promise.all(
      l1Keys
        .filter((key) => pattern.test(key))
        .map(async (key) => {
          await this.delete(key);
          invalidated++;
        })
    );

    return invalidated;
  }

  /**
   * Get L1 cache instance (for advanced operations)
   */
  getL1(): MemoryCache {
    return this.l1;
  }

  /**
   * Get L2 cache instance (for advanced operations)
   */
  getL2(): RedisCache {
    return this.l2;
  }

  /**
   * Check if Redis (L2) is available
   */
  isL2Available(): boolean {
    return this.l2.getConnectionStatus().isConnected;
  }

  /**
   * Destroy cache service and cleanup resources
   */
  async destroy(): Promise<void> {
    await Promise.all([
      Promise.resolve(this.l1.destroy()),
      this.l2.destroy(),
    ]);
  }
}

/**
 * Create a cache service with configuration
 */
export function createCacheService(config?: CacheServiceConfig): CacheService {
  return new CacheService(config);
}

/**
 * Singleton cache service instance
 * Use this for app-wide caching
 */
let globalCacheService: CacheService | null = null;

/**
 * Get or create global cache service
 */
export function getGlobalCacheService(
  config?: CacheServiceConfig
): CacheService {
  if (!globalCacheService) {
    globalCacheService = createCacheService(config);
  }
  return globalCacheService;
}

/**
 * Reset global cache service (useful for testing)
 */
export async function resetGlobalCacheService(): Promise<void> {
  if (globalCacheService) {
    await globalCacheService.destroy();
    globalCacheService = null;
  }
}
