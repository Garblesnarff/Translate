/**
 * Multi-Layer Cache System
 *
 * A sophisticated caching infrastructure with L1 (Memory) and L2 (Redis) layers.
 *
 * ## Architecture
 *
 * ```
 * ┌─────────────────────────────────────────┐
 * │         CacheService (Coordinator)       │
 * └─────────────────────────────────────────┘
 *                    │
 *        ┌───────────┴───────────┐
 *        ▼                       ▼
 * ┌──────────────┐      ┌──────────────┐
 * │  L1: Memory  │      │  L2: Redis   │
 * │   (Fast)     │      │  (Shared)    │
 * │   ~0.01ms    │      │   ~1-5ms     │
 * │   LRU evict  │      │   TTL expire │
 * └──────────────┘      └──────────────┘
 * ```
 *
 * ## Usage Examples
 *
 * ### Basic Usage
 * ```typescript
 * import { createCacheService } from './server/core/cache';
 *
 * const cache = createCacheService({
 *   l1: { maxSize: 1000, defaultTtl: 3600 },
 *   l2: { host: 'localhost', port: 6379 }
 * });
 *
 * // Store
 * await cache.set('key', { data: 'value' }, 3600); // TTL: 1 hour
 *
 * // Retrieve
 * const value = await cache.get<{ data: string }>('key');
 * ```
 *
 * ### With Cache Keys
 * ```typescript
 * import { CacheKeys, hashText } from './server/core/cache';
 *
 * const text = 'བཀྲ་ཤིས་བདེ་ལེགས།';
 * const key = CacheKeys.translation(hashText(text));
 *
 * await cache.set(key, translationResult);
 * const cached = await cache.get(key);
 * ```
 *
 * ### Singleton Pattern
 * ```typescript
 * import { getGlobalCacheService } from './server/core/cache';
 *
 * const cache = getGlobalCacheService();
 * ```
 *
 * ## Performance Characteristics
 *
 * - **L1 Hit**: ~0.01ms (synchronous memory access)
 * - **L2 Hit**: ~1-5ms (Redis network call + L1 promotion)
 * - **Cache Miss**: Depends on data source
 *
 * ## Hit Rate Expectations
 *
 * With proper configuration:
 * - L1 Hit Rate: 60-80% (frequently accessed data)
 * - L2 Hit Rate: 15-30% (less frequent data)
 * - Overall Hit Rate: 75-95%
 * - Miss Rate: 5-25%
 */

// Core types and interfaces
export type {
  CacheProvider,
  CacheStats,
  CacheEntry,
  CacheConfig,
  RedisCacheConfig,
  MultiLayerCacheConfig,
  CacheKeys as CacheKeysType,
} from './types.js';

export { CacheError, CacheErrorCode } from './types.js';

// Cache implementations
export { MemoryCache, createMemoryCache } from './MemoryCache.js';
export type { MemoryCacheConfig } from './MemoryCache.js';

export { RedisCache, createRedisCache } from './RedisCache.js';

export {
  CacheService,
  createCacheService,
  getGlobalCacheService,
  resetGlobalCacheService,
} from './CacheService.js';
export type { CacheServiceConfig } from './CacheService.js';

// Cache key utilities
export {
  CacheKeys,
  hashText,
  hashData,
  isValidCacheKey,
  sanitizeKeyComponent,
  generateTranslationKey,
  generateEmbeddingKey,
  parseCacheKey,
  buildKeyPattern,
} from './keys.js';

/**
 * Default cache configuration
 * Use these as a starting point and adjust based on your needs
 */
export const DEFAULT_CACHE_CONFIG = {
  l1: {
    maxSize: 1000, // Keep 1000 items in memory
    defaultTtl: 3600, // 1 hour
    autoCleanup: true,
    cleanupInterval: 60000, // 1 minute
    enableStats: true,
  },
  l2: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD,
    db: parseInt(process.env.REDIS_DB || '0'),
    defaultTtl: 86400, // 24 hours
    keyPrefix: 'tibetan:',
    enableStats: true,
  },
  writeThrough: true,
  promoteOnL2Hit: true,
  enableStats: true,
};

/**
 * Cache configuration for different environments
 */
export const CACHE_CONFIGS = {
  development: {
    ...DEFAULT_CACHE_CONFIG,
    l1: {
      ...DEFAULT_CACHE_CONFIG.l1,
      maxSize: 500, // Smaller in dev
    },
    l2: {
      ...DEFAULT_CACHE_CONFIG.l2,
      keyPrefix: 'tibetan:dev:',
    },
  },

  test: {
    ...DEFAULT_CACHE_CONFIG,
    l1: {
      ...DEFAULT_CACHE_CONFIG.l1,
      maxSize: 100, // Even smaller for tests
    },
    l2: {
      ...DEFAULT_CACHE_CONFIG.l2,
      keyPrefix: 'tibetan:test:',
      db: 1, // Use different DB for tests
    },
  },

  production: {
    ...DEFAULT_CACHE_CONFIG,
    l1: {
      ...DEFAULT_CACHE_CONFIG.l1,
      maxSize: 2000, // Larger in production
    },
    l2: {
      ...DEFAULT_CACHE_CONFIG.l2,
      keyPrefix: 'tibetan:prod:',
    },
  },
};

/**
 * Get cache configuration for current environment
 */
export function getCacheConfig() {
  const env = process.env.NODE_ENV || 'development';
  return CACHE_CONFIGS[env as keyof typeof CACHE_CONFIGS] || CACHE_CONFIGS.development;
}
