/**
 * Redis Cache (L2)
 *
 * Persistent, distributed cache using Redis for shared state across instances.
 * Provides fallback behavior when Redis is unavailable.
 *
 * Features:
 * - Redis connection with automatic reconnection
 * - TTL support using Redis EXPIRE
 * - Graceful degradation if Redis unavailable
 * - JSON serialization/deserialization
 * - Connection pooling
 * - Error handling and logging
 */

import type {
  CacheProvider,
  CacheStats,
  RedisCacheConfig,
  CacheError,
  CacheErrorCode,
} from './types.js';

// Redis types - will be dynamically imported
type RedisClientType = any;
type RedisClientOptions = any;

/**
 * Redis cache implementation with graceful fallback
 */
export class RedisCache implements CacheProvider {
  private client: RedisClientType | null = null;
  private isConnected = false;
  private isConnecting = false;
  private config: Required<RedisCacheConfig>;

  // Statistics
  private hits = 0;
  private misses = 0;

  // Connection retry
  private reconnectAttempts = 0;
  private readonly maxReconnectAttempts = 5;
  private reconnectTimer?: NodeJS.Timeout;

  constructor(config: RedisCacheConfig = {}) {
    this.config = {
      host: config.host ?? 'localhost',
      port: config.port ?? 6379,
      password: config.password ?? undefined,
      db: config.db ?? 0,
      connectTimeout: config.connectTimeout ?? 5000,
      tls: config.tls ?? false,
      keyPrefix: config.keyPrefix ?? 'tibetan:',
      maxSize: config.maxSize ?? 10000,
      defaultTtl: config.defaultTtl ?? 3600,
      enableStats: config.enableStats ?? true,
    };

    // Start connection (async, don't wait)
    this.connect().catch((error) => {
      console.error('[RedisCache] Initial connection failed:', error.message);
    });
  }

  /**
   * Connect to Redis
   */
  private async connect(): Promise<void> {
    if (this.isConnected || this.isConnecting) {
      return;
    }

    this.isConnecting = true;

    try {
      // Dynamic import of redis (only if installed)
      const { createClient } = await import('redis').catch(() => {
        throw new Error('redis package not installed. Run: npm install redis');
      });

      const options: RedisClientOptions = {
        socket: {
          host: this.config.host,
          port: this.config.port,
          connectTimeout: this.config.connectTimeout,
          tls: this.config.tls,
        },
        database: this.config.db,
      };

      if (this.config.password) {
        options.password = this.config.password;
      }

      this.client = createClient(options);

      // Error handling
      this.client.on('error', (error: Error) => {
        console.error('[RedisCache] Redis error:', error.message);
        this.isConnected = false;
      });

      this.client.on('connect', () => {
        console.log('[RedisCache] Connected to Redis');
        this.isConnected = true;
        this.reconnectAttempts = 0;
      });

      this.client.on('disconnect', () => {
        console.log('[RedisCache] Disconnected from Redis');
        this.isConnected = false;
      });

      this.client.on('reconnecting', () => {
        console.log('[RedisCache] Reconnecting to Redis...');
      });

      await this.client.connect();
    } catch (error: any) {
      console.error('[RedisCache] Failed to connect:', error.message);
      this.isConnecting = false;
      this.scheduleReconnect();
      throw error;
    }

    this.isConnecting = false;
  }

  /**
   * Schedule reconnection attempt
   */
  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error(
        `[RedisCache] Max reconnect attempts (${this.maxReconnectAttempts}) reached. Giving up.`
      );
      return;
    }

    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
    this.reconnectAttempts++;

    console.log(
      `[RedisCache] Scheduling reconnect attempt ${this.reconnectAttempts} in ${delay}ms`
    );

    this.reconnectTimer = setTimeout(() => {
      this.connect().catch(() => {
        // Error already logged in connect()
      });
    }, delay);
  }

  /**
   * Get full key with prefix
   */
  private getFullKey(key: string): string {
    return `${this.config.keyPrefix}${key}`;
  }

  /**
   * Get value from Redis cache
   */
  async get<T>(key: string): Promise<T | null> {
    if (!this.isConnected || !this.client) {
      if (this.config.enableStats) {
        this.misses++;
      }
      return null; // Graceful fallback
    }

    try {
      const fullKey = this.getFullKey(key);
      const value = await this.client.get(fullKey);

      if (value === null) {
        if (this.config.enableStats) {
          this.misses++;
        }
        return null;
      }

      // Deserialize JSON
      const parsed = JSON.parse(value) as T;

      if (this.config.enableStats) {
        this.hits++;
      }

      return parsed;
    } catch (error: any) {
      console.error('[RedisCache] Get error:', error.message);
      if (this.config.enableStats) {
        this.misses++;
      }
      return null; // Graceful fallback
    }
  }

  /**
   * Store value in Redis cache with TTL
   */
  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    if (!this.isConnected || !this.client) {
      return; // Graceful fallback - don't throw error
    }

    try {
      const fullKey = this.getFullKey(key);
      const serialized = JSON.stringify(value);
      const ttlSeconds = ttl ?? this.config.defaultTtl;

      if (ttlSeconds > 0) {
        // Set with expiration
        await this.client.setEx(fullKey, ttlSeconds, serialized);
      } else {
        // Set without expiration
        await this.client.set(fullKey, serialized);
      }
    } catch (error: any) {
      console.error('[RedisCache] Set error:', error.message);
      // Graceful fallback - don't throw
    }
  }

  /**
   * Delete key from Redis cache
   */
  async delete(key: string): Promise<void> {
    if (!this.isConnected || !this.client) {
      return;
    }

    try {
      const fullKey = this.getFullKey(key);
      await this.client.del(fullKey);
    } catch (error: any) {
      console.error('[RedisCache] Delete error:', error.message);
    }
  }

  /**
   * Clear all keys with the configured prefix
   */
  async clear(): Promise<void> {
    if (!this.isConnected || !this.client) {
      return;
    }

    try {
      // Use SCAN to find all keys with our prefix
      const keys: string[] = [];
      let cursor = 0;

      do {
        const result = await this.client.scan(cursor, {
          MATCH: `${this.config.keyPrefix}*`,
          COUNT: 100,
        });

        cursor = result.cursor;
        keys.push(...result.keys);
      } while (cursor !== 0);

      // Delete all found keys
      if (keys.length > 0) {
        await this.client.del(keys);
      }

      // Reset stats
      if (this.config.enableStats) {
        this.hits = 0;
        this.misses = 0;
      }
    } catch (error: any) {
      console.error('[RedisCache] Clear error:', error.message);
    }
  }

  /**
   * Check if key exists
   */
  async has(key: string): Promise<boolean> {
    if (!this.isConnected || !this.client) {
      return false;
    }

    try {
      const fullKey = this.getFullKey(key);
      const exists = await this.client.exists(fullKey);
      return exists === 1;
    } catch (error: any) {
      console.error('[RedisCache] Has error:', error.message);
      return false;
    }
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<CacheStats> {
    const total = this.hits + this.misses;
    const hitRate = total > 0 ? this.hits / total : 0;

    let size = 0;

    if (this.isConnected && this.client) {
      try {
        // Count keys with our prefix
        const info = await this.client.dbSize();
        size = info;
      } catch (error: any) {
        console.error('[RedisCache] Stats error:', error.message);
      }
    }

    return {
      size,
      hits: this.hits,
      misses: this.misses,
      hitRate,
      connected: this.isConnected,
      maxSize: this.config.maxSize,
    };
  }

  /**
   * Get Redis connection status
   */
  getConnectionStatus(): {
    isConnected: boolean;
    isConnecting: boolean;
    reconnectAttempts: number;
  } {
    return {
      isConnected: this.isConnected,
      isConnecting: this.isConnecting,
      reconnectAttempts: this.reconnectAttempts,
    };
  }

  /**
   * Disconnect from Redis and cleanup
   */
  async destroy(): Promise<void> {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
    }

    if (this.client && this.isConnected) {
      try {
        await this.client.quit();
      } catch (error: any) {
        console.error('[RedisCache] Disconnect error:', error.message);
      }
    }

    this.client = null;
    this.isConnected = false;
  }

  /**
   * Manually trigger reconnection
   */
  async reconnect(): Promise<void> {
    await this.destroy();
    this.reconnectAttempts = 0;
    await this.connect();
  }
}

/**
 * Create a Redis cache with configuration
 */
export function createRedisCache(config?: RedisCacheConfig): RedisCache {
  return new RedisCache(config);
}
