/**
 * In-Memory Cache (L1)
 *
 * Fast, synchronous cache with LRU (Least Recently Used) eviction policy.
 * Ideal for frequently accessed data with minimal latency requirements.
 *
 * Features:
 * - LRU eviction when max size exceeded
 * - TTL (time-to-live) support
 * - Automatic expiration cleanup
 * - Thread-safe operations (single-threaded Node.js)
 * - Memory usage tracking
 * - Hit/miss statistics
 */

import type {
  CacheProvider,
  CacheEntry,
  CacheStats,
  CacheConfig,
  CacheError,
  CacheErrorCode,
} from './types.js';

export interface MemoryCacheConfig extends CacheConfig {
  /** Maximum number of items (default: 1000) */
  maxSize?: number;

  /** Default TTL in seconds (default: 3600 = 1 hour) */
  defaultTtl?: number;

  /** Enable automatic cleanup of expired entries (default: true) */
  autoCleanup?: boolean;

  /** Cleanup interval in milliseconds (default: 60000 = 1 minute) */
  cleanupInterval?: number;

  /** Enable statistics tracking (default: true) */
  enableStats?: boolean;
}

/**
 * In-memory LRU cache implementation
 */
export class MemoryCache implements CacheProvider {
  private cache: Map<string, CacheEntry>;
  private readonly maxSize: number;
  private readonly defaultTtl: number;
  private readonly enableStats: boolean;
  private cleanupTimer?: NodeJS.Timeout;

  // Statistics
  private hits = 0;
  private misses = 0;

  constructor(config: MemoryCacheConfig = {}) {
    this.cache = new Map();
    this.maxSize = config.maxSize ?? 1000;
    this.defaultTtl = config.defaultTtl ?? 3600; // 1 hour
    this.enableStats = config.enableStats ?? true;

    // Start automatic cleanup if enabled
    if (config.autoCleanup !== false) {
      const cleanupInterval = config.cleanupInterval ?? 60000; // 1 minute
      this.startAutoCleanup(cleanupInterval);
    }
  }

  /**
   * Get value from cache
   * Returns null if key doesn't exist or has expired
   */
  async get<T>(key: string): Promise<T | null> {
    const entry = this.cache.get(key);

    // Cache miss
    if (!entry) {
      if (this.enableStats) {
        this.misses++;
      }
      return null;
    }

    // Check if expired
    if (this.isExpired(entry)) {
      this.cache.delete(key);
      if (this.enableStats) {
        this.misses++;
      }
      return null;
    }

    // Update last accessed time for LRU
    entry.lastAccessedAt = Date.now();

    // Move to end (most recently used) by deleting and re-adding
    this.cache.delete(key);
    this.cache.set(key, entry);

    if (this.enableStats) {
      this.hits++;
    }

    return entry.value as T;
  }

  /**
   * Store value in cache with optional TTL
   */
  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    const now = Date.now();
    const ttlSeconds = ttl ?? this.defaultTtl;

    const entry: CacheEntry<T> = {
      value,
      expiresAt: ttlSeconds > 0 ? now + ttlSeconds * 1000 : null,
      createdAt: now,
      lastAccessedAt: now,
    };

    // Check if we need to evict (if adding new key)
    if (!this.cache.has(key) && this.cache.size >= this.maxSize) {
      this.evictLRU();
    }

    // If key exists, delete it first to maintain LRU order
    // (will be re-added at the end)
    if (this.cache.has(key)) {
      this.cache.delete(key);
    }

    // Store entry (at the end, making it most recently used)
    this.cache.set(key, entry);
  }

  /**
   * Delete a key from cache
   */
  async delete(key: string): Promise<void> {
    this.cache.delete(key);
  }

  /**
   * Clear all entries from cache
   */
  async clear(): Promise<void> {
    this.cache.clear();
    if (this.enableStats) {
      this.hits = 0;
      this.misses = 0;
    }
  }

  /**
   * Check if key exists and is not expired
   */
  async has(key: string): Promise<boolean> {
    const entry = this.cache.get(key);
    if (!entry) {
      return false;
    }
    if (this.isExpired(entry)) {
      this.cache.delete(key);
      return false;
    }
    return true;
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<CacheStats> {
    const total = this.hits + this.misses;
    const hitRate = total > 0 ? this.hits / total : 0;

    // Estimate memory usage
    const memoryUsed = this.estimateMemoryUsage();

    return {
      size: this.cache.size,
      hits: this.hits,
      misses: this.misses,
      hitRate,
      memoryUsed,
      maxSize: this.maxSize,
    };
  }

  /**
   * Get all keys in cache (useful for debugging)
   */
  getKeys(): string[] {
    return Array.from(this.cache.keys());
  }

  /**
   * Get number of items in cache
   */
  size(): number {
    return this.cache.size;
  }

  /**
   * Check if cache is empty
   */
  isEmpty(): boolean {
    return this.cache.size === 0;
  }

  /**
   * Get all entries (useful for debugging/testing)
   */
  getEntries(): Array<{ key: string; entry: CacheEntry }> {
    return Array.from(this.cache.entries()).map(([key, entry]) => ({
      key,
      entry,
    }));
  }

  /**
   * Stop the cache and cleanup resources
   */
  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined;
    }
    this.cache.clear();
  }

  // Private helper methods

  /**
   * Check if entry has expired
   */
  private isExpired(entry: CacheEntry): boolean {
    if (entry.expiresAt === null) {
      return false; // No expiration
    }
    return Date.now() > entry.expiresAt;
  }

  /**
   * Evict least recently used entry
   * Since Map maintains insertion order and we move accessed items to end,
   * the first entry is the least recently used
   */
  private evictLRU(): void {
    const firstKey = this.cache.keys().next().value;
    if (firstKey !== undefined) {
      this.cache.delete(firstKey);
    }
  }

  /**
   * Remove all expired entries
   */
  private cleanupExpired(): number {
    let cleaned = 0;
    const now = Date.now();

    for (const [key, entry] of this.cache.entries()) {
      if (this.isExpired(entry)) {
        this.cache.delete(key);
        cleaned++;
      }
    }

    return cleaned;
  }

  /**
   * Start automatic cleanup timer
   */
  private startAutoCleanup(interval: number): void {
    this.cleanupTimer = setInterval(() => {
      const cleaned = this.cleanupExpired();
      if (cleaned > 0) {
        // Optional: log cleanup activity
        // console.log(`[MemoryCache] Cleaned ${cleaned} expired entries`);
      }
    }, interval);

    // Don't prevent Node.js from exiting
    this.cleanupTimer.unref();
  }

  /**
   * Estimate memory usage in bytes
   * This is a rough estimate based on JSON serialization
   */
  private estimateMemoryUsage(): number {
    let total = 0;

    for (const [key, entry] of this.cache.entries()) {
      // Key size
      total += key.length * 2; // UTF-16 characters

      // Value size (rough estimate via JSON)
      try {
        const json = JSON.stringify(entry.value);
        total += json.length * 2;
      } catch {
        // If can't serialize, estimate as 1KB
        total += 1024;
      }

      // Metadata overhead (timestamps, etc.)
      total += 64; // ~64 bytes for entry metadata
    }

    return total;
  }
}

/**
 * Create a memory cache with sensible defaults
 */
export function createMemoryCache(config?: MemoryCacheConfig): MemoryCache {
  return new MemoryCache(config);
}
