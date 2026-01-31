/**
 * Multi-Layer Cache System - Type Definitions
 *
 * This module defines the core interfaces and types for the caching infrastructure.
 * The cache system supports multi-layer architecture (L1: Memory, L2: Redis) for
 * optimal performance and scalability.
 */

/**
 * Core cache provider interface that all cache implementations must follow.
 * Supports generic types for type-safe cache operations.
 */
export interface CacheProvider {
  /**
   * Retrieve a value from the cache
   * @param key - Cache key
   * @returns The cached value or null if not found/expired
   */
  get<T>(key: string): Promise<T | null>;

  /**
   * Store a value in the cache
   * @param key - Cache key
   * @param value - Value to store
   * @param ttl - Time-to-live in seconds (optional)
   */
  set<T>(key: string, value: T, ttl?: number): Promise<void>;

  /**
   * Delete a specific key from the cache
   * @param key - Cache key to delete
   */
  delete(key: string): Promise<void>;

  /**
   * Clear all entries from the cache
   */
  clear(): Promise<void>;

  /**
   * Check if a key exists in the cache
   * @param key - Cache key to check
   */
  has(key: string): Promise<boolean>;

  /**
   * Get cache statistics
   */
  getStats(): Promise<CacheStats>;
}

/**
 * Cache statistics for monitoring and debugging
 */
export interface CacheStats {
  /** Total number of items in cache */
  size: number;

  /** Number of cache hits */
  hits: number;

  /** Number of cache misses */
  misses: number;

  /** Hit rate (0-1) */
  hitRate: number;

  /** Memory used (bytes) for memory cache */
  memoryUsed?: number;

  /** Maximum size allowed */
  maxSize?: number;

  /** Additional provider-specific stats */
  [key: string]: any;
}

/**
 * Entry stored in cache with metadata
 */
export interface CacheEntry<T = any> {
  /** The cached value */
  value: T;

  /** Expiration timestamp (milliseconds since epoch) */
  expiresAt: number | null;

  /** When this entry was created */
  createdAt: number;

  /** Last access timestamp for LRU tracking */
  lastAccessedAt: number;
}

/**
 * Configuration for cache providers
 */
export interface CacheConfig {
  /** Maximum number of items (for memory cache) */
  maxSize?: number;

  /** Default TTL in seconds */
  defaultTtl?: number;

  /** Enable cache statistics tracking */
  enableStats?: boolean;
}

/**
 * Configuration for Redis cache
 */
export interface RedisCacheConfig extends CacheConfig {
  /** Redis host */
  host?: string;

  /** Redis port */
  port?: number;

  /** Redis password */
  password?: string;

  /** Redis database number */
  db?: number;

  /** Connection timeout in milliseconds */
  connectTimeout?: number;

  /** Enable TLS */
  tls?: boolean;

  /** Key prefix for all Redis keys */
  keyPrefix?: string;
}

/**
 * Configuration for multi-layer cache service
 */
export interface MultiLayerCacheConfig {
  /** L1 (Memory) cache configuration */
  l1: CacheConfig;

  /** L2 (Redis) cache configuration */
  l2: RedisCacheConfig;

  /** Enable write-through caching (write to both layers) */
  writeThrough?: boolean;

  /** Enable cache statistics */
  enableStats?: boolean;
}

/**
 * Cache key generators for different entity types
 */
export interface CacheKeys {
  /** Translation cache key */
  translation: (textHash: string) => string;

  /** Embedding cache key */
  embedding: (textHash: string) => string;

  /** Dictionary lookup cache key */
  dictionary: (tibetan: string) => string;

  /** Translation example cache key */
  example: (exampleId: string) => string;

  /** Generic cache key with namespace */
  generic: (namespace: string, key: string) => string;
}

/**
 * Error types for cache operations
 */
export class CacheError extends Error {
  constructor(
    message: string,
    public readonly code: CacheErrorCode,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'CacheError';
  }
}

export enum CacheErrorCode {
  CONNECTION_FAILED = 'CONNECTION_FAILED',
  SERIALIZATION_ERROR = 'SERIALIZATION_ERROR',
  DESERIALIZATION_ERROR = 'DESERIALIZATION_ERROR',
  TIMEOUT = 'TIMEOUT',
  INVALID_KEY = 'INVALID_KEY',
  CAPACITY_EXCEEDED = 'CAPACITY_EXCEEDED',
}
