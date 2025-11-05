/**
 * Tests for MemoryCache (L1)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MemoryCache } from '../../../server/core/cache/MemoryCache.js';

describe('MemoryCache', () => {
  let cache: MemoryCache;

  beforeEach(() => {
    cache = new MemoryCache({
      maxSize: 3,
      defaultTtl: 1, // 1 second for testing
      autoCleanup: false, // Manual cleanup for testing
      enableStats: true,
    });
  });

  afterEach(() => {
    cache.destroy();
  });

  describe('Basic Operations', () => {
    it('should store and retrieve values', async () => {
      await cache.set('key1', 'value1');
      const result = await cache.get<string>('key1');

      expect(result).toBe('value1');
    });

    it('should return null for non-existent keys', async () => {
      const result = await cache.get('nonexistent');
      expect(result).toBeNull();
    });

    it('should delete keys', async () => {
      await cache.set('key1', 'value1');
      await cache.delete('key1');
      const result = await cache.get('key1');

      expect(result).toBeNull();
    });

    it('should clear all keys', async () => {
      await cache.set('key1', 'value1');
      await cache.set('key2', 'value2');
      await cache.clear();

      expect(cache.size()).toBe(0);
      expect(await cache.get('key1')).toBeNull();
      expect(await cache.get('key2')).toBeNull();
    });

    it('should check if key exists', async () => {
      await cache.set('key1', 'value1');

      expect(await cache.has('key1')).toBe(true);
      expect(await cache.has('nonexistent')).toBe(false);
    });
  });

  describe('Type Safety', () => {
    it('should handle complex objects', async () => {
      const obj = { name: 'test', value: 123, nested: { data: 'test' } };
      await cache.set('obj', obj);
      const result = await cache.get<typeof obj>('obj');

      expect(result).toEqual(obj);
    });

    it('should handle arrays', async () => {
      const arr = [1, 2, 3, 4, 5];
      await cache.set('arr', arr);
      const result = await cache.get<number[]>('arr');

      expect(result).toEqual(arr);
    });

    it('should handle null values', async () => {
      await cache.set('null', null);
      const result = await cache.get('null');

      expect(result).toBeNull();
    });
  });

  describe('TTL (Time-To-Live)', () => {
    it('should expire entries after TTL', async () => {
      await cache.set('key1', 'value1', 0.1); // 100ms TTL

      // Should exist immediately
      expect(await cache.get('key1')).toBe('value1');

      // Wait for expiration
      await new Promise((resolve) => setTimeout(resolve, 150));

      // Should be expired
      expect(await cache.get('key1')).toBeNull();
    });

    it('should not expire entries with no TTL', async () => {
      await cache.set('key1', 'value1', 0); // No expiration

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(await cache.get('key1')).toBe('value1');
    });

    it('should use default TTL when not specified', async () => {
      // Cache has defaultTtl: 1 second
      await cache.set('key1', 'value1');

      // Should exist for a bit
      await new Promise((resolve) => setTimeout(resolve, 500));
      expect(await cache.get('key1')).toBe('value1');

      // Should expire after 1 second
      await new Promise((resolve) => setTimeout(resolve, 600));
      expect(await cache.get('key1')).toBeNull();
    });
  });

  describe('LRU Eviction', () => {
    it('should evict least recently used item when full', async () => {
      // Cache maxSize is 3
      await cache.set('key1', 'value1');
      await cache.set('key2', 'value2');
      await cache.set('key3', 'value3');

      expect(cache.size()).toBe(3);

      // Add 4th item, should evict key1 (oldest)
      await cache.set('key4', 'value4');

      expect(cache.size()).toBe(3);
      expect(await cache.get('key1')).toBeNull(); // Evicted
      expect(await cache.get('key2')).toBe('value2');
      expect(await cache.get('key3')).toBe('value3');
      expect(await cache.get('key4')).toBe('value4');
    });

    it('should update LRU order on access', async () => {
      await cache.set('key1', 'value1');
      await cache.set('key2', 'value2');
      await cache.set('key3', 'value3');

      // Access key1, making it most recent
      await cache.get('key1');

      // Add 4th item, should evict key2 (now oldest)
      await cache.set('key4', 'value4');

      expect(await cache.get('key1')).toBe('value1'); // Not evicted
      expect(await cache.get('key2')).toBeNull(); // Evicted
      expect(await cache.get('key3')).toBe('value3');
      expect(await cache.get('key4')).toBe('value4');
    });

    it('should update LRU order on set (update)', async () => {
      await cache.set('key1', 'value1');
      await cache.set('key2', 'value2');
      await cache.set('key3', 'value3');

      // Update key1, making it most recent
      await cache.set('key1', 'updated1');

      // Add 4th item, should evict key2
      await cache.set('key4', 'value4');

      expect(await cache.get('key1')).toBe('updated1'); // Not evicted, updated
      expect(await cache.get('key2')).toBeNull(); // Evicted
    });
  });

  describe('Statistics', () => {
    it('should track hits and misses', async () => {
      await cache.set('key1', 'value1');

      // 2 hits
      await cache.get('key1');
      await cache.get('key1');

      // 1 miss
      await cache.get('nonexistent');

      const stats = await cache.getStats();

      expect(stats.hits).toBe(2);
      expect(stats.misses).toBe(1);
      expect(stats.hitRate).toBe(2 / 3);
    });

    it('should report cache size', async () => {
      await cache.set('key1', 'value1');
      await cache.set('key2', 'value2');

      const stats = await cache.getStats();

      expect(stats.size).toBe(2);
      expect(stats.maxSize).toBe(3);
    });

    it('should estimate memory usage', async () => {
      await cache.set('key1', 'value1');
      await cache.set('key2', { data: 'test' });

      const stats = await cache.getStats();

      expect(stats.memoryUsed).toBeGreaterThan(0);
    });

    it('should reset stats on clear', async () => {
      await cache.set('key1', 'value1');
      await cache.get('key1');
      await cache.get('nonexistent');

      await cache.clear();

      const stats = await cache.getStats();

      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
      expect(stats.size).toBe(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty cache', () => {
      expect(cache.isEmpty()).toBe(true);
      expect(cache.size()).toBe(0);
    });

    it('should handle getting all keys', async () => {
      await cache.set('key1', 'value1');
      await cache.set('key2', 'value2');

      const keys = cache.getKeys();

      expect(keys).toContain('key1');
      expect(keys).toContain('key2');
      expect(keys.length).toBe(2);
    });

    it('should handle very large values', async () => {
      const largeValue = 'x'.repeat(10000);
      await cache.set('large', largeValue);

      const result = await cache.get<string>('large');

      expect(result).toBe(largeValue);
    });

    it('should handle special characters in keys', async () => {
      const specialKeys = ['key:with:colons', 'key-with-dashes', 'key_with_underscores'];

      for (const key of specialKeys) {
        await cache.set(key, 'value');
        expect(await cache.get(key)).toBe('value');
      }
    });
  });

  describe('Auto Cleanup', () => {
    it('should automatically cleanup expired entries when enabled', async () => {
      const autoCache = new MemoryCache({
        maxSize: 10,
        defaultTtl: 0.1, // 100ms
        autoCleanup: true,
        cleanupInterval: 50, // Check every 50ms
        enableStats: true,
      });

      await autoCache.set('key1', 'value1');
      await autoCache.set('key2', 'value2');

      expect(autoCache.size()).toBe(2);

      // Wait for expiration + cleanup
      await new Promise((resolve) => setTimeout(resolve, 200));

      // Should be cleaned up
      expect(autoCache.size()).toBe(0);

      autoCache.destroy();
    });
  });
});
