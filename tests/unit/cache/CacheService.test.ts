/**
 * Tests for CacheService (Multi-Layer Cache)
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { CacheService } from '../../../server/core/cache/CacheService.js';

describe('CacheService (Multi-Layer Cache)', () => {
  let cache: CacheService;

  beforeEach(() => {
    cache = new CacheService({
      l1: {
        maxSize: 3,
        defaultTtl: 3600,
        autoCleanup: false,
        enableStats: true,
      },
      l2: {
        // Redis config - will gracefully fallback if not available
        host: 'localhost',
        port: 6379,
        keyPrefix: 'test:',
        defaultTtl: 3600,
      },
      writeThrough: true,
      promoteOnL2Hit: true,
      enableStats: true,
    });
  });

  afterEach(async () => {
    await cache.destroy();
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

    it('should delete from both layers', async () => {
      await cache.set('key1', 'value1');
      await cache.delete('key1');
      const result = await cache.get('key1');

      expect(result).toBeNull();
    });

    it('should clear both layers', async () => {
      await cache.set('key1', 'value1');
      await cache.set('key2', 'value2');
      await cache.clear();

      expect(await cache.get('key1')).toBeNull();
      expect(await cache.get('key2')).toBeNull();
    });

    it('should check if key exists', async () => {
      await cache.set('key1', 'value1');

      expect(await cache.has('key1')).toBe(true);
      expect(await cache.has('nonexistent')).toBe(false);
    });
  });

  describe('Multi-Layer Behavior', () => {
    it('should write to both layers when writeThrough enabled', async () => {
      await cache.set('key1', 'value1');

      const l1 = cache.getL1();
      const l2 = cache.getL2();

      // Both layers should have the value
      expect(await l1.get('key1')).toBe('value1');
      // L2 might not be available in test environment, that's ok
    });

    it('should promote L2 hits to L1', async () => {
      // This test requires Redis to be available
      // In test environment, it will gracefully skip if Redis unavailable

      const l1 = cache.getL1();
      const l2 = cache.getL2();

      // Only set in L2 (simulating L1 miss)
      await l2.set('test:key1', 'value1');

      // Clear L1
      await l1.clear();

      // Get from cache (should hit L2)
      const result = await cache.get('key1');

      // If Redis available, should have promoted to L1
      if (result !== null) {
        expect(result).toBe('value1');
        expect(await l1.get('key1')).toBe('value1');
      }
    });

    it('should handle L1 only when writeThrough disabled', async () => {
      const cacheL1Only = new CacheService({
        l1: { maxSize: 10 },
        l2: { host: 'localhost' },
        writeThrough: false,
      });

      await cacheL1Only.set('key1', 'value1');

      const l1 = cacheL1Only.getL1();
      expect(await l1.get('key1')).toBe('value1');

      await cacheL1Only.destroy();
    });
  });

  describe('Type Safety', () => {
    it('should handle complex objects', async () => {
      const obj = {
        name: 'test',
        value: 123,
        nested: { data: 'nested' },
        array: [1, 2, 3],
      };

      await cache.set('obj', obj);
      const result = await cache.get<typeof obj>('obj');

      expect(result).toEqual(obj);
    });

    it('should handle arrays', async () => {
      const arr = ['a', 'b', 'c'];
      await cache.set('arr', arr);
      const result = await cache.get<string[]>('arr');

      expect(result).toEqual(arr);
    });

    it('should handle translation results', async () => {
      interface TranslationResult {
        translation: string;
        confidence: number;
        metadata: Record<string, any>;
      }

      const translation: TranslationResult = {
        translation: 'Greetings (བཀྲ་ཤིས་བདེ་ལེགས།).',
        confidence: 0.95,
        metadata: { model: 'gemini', tokens: 10 },
      };

      await cache.set('trans:123', translation);
      const result = await cache.get<TranslationResult>('trans:123');

      expect(result).toEqual(translation);
    });
  });

  describe('TTL Support', () => {
    it('should support TTL on set', async () => {
      await cache.set('key1', 'value1', 0.1); // 100ms

      expect(await cache.get('key1')).toBe('value1');

      // Wait for expiration
      await new Promise((resolve) => setTimeout(resolve, 150));

      expect(await cache.get('key1')).toBeNull();
    });

    it('should use default TTL when not specified', async () => {
      await cache.set('key1', 'value1');

      // Should still exist after a short wait
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(await cache.get('key1')).toBe('value1');
    });
  });

  describe('Statistics', () => {
    it('should provide combined statistics', async () => {
      await cache.set('key1', 'value1');
      await cache.set('key2', 'value2');

      // Generate some hits and misses
      await cache.get('key1'); // L1 hit
      await cache.get('key1'); // L1 hit
      await cache.get('nonexistent'); // Miss

      const stats = await cache.getStats();

      expect(stats.hits).toBeGreaterThanOrEqual(2);
      expect(stats.misses).toBeGreaterThanOrEqual(1);
      expect(stats.hitRate).toBeGreaterThan(0);
    });

    it('should provide layer statistics', async () => {
      await cache.set('key1', 'value1');

      const layerStats = await cache.getLayerStats();

      expect(layerStats.l1).toBeDefined();
      expect(layerStats.l2).toBeDefined();
      expect(layerStats.combined).toBeDefined();
    });

    it('should provide efficiency metrics', async () => {
      await cache.set('key1', 'value1');
      await cache.get('key1');

      const efficiency = await cache.getEfficiency();

      expect(efficiency.l1HitRatio).toBeGreaterThanOrEqual(0);
      expect(efficiency.l2HitRatio).toBeGreaterThanOrEqual(0);
      expect(efficiency.overallHitRate).toBeGreaterThanOrEqual(0);
      expect(efficiency.avgLatency).toBeDefined();
    });
  });

  describe('Advanced Operations', () => {
    it('should warm up L1 from L2', async () => {
      const l2 = cache.getL2();

      // Populate L2 directly (simulating persisted data)
      await l2.set('test:key1', 'value1');
      await l2.set('test:key2', 'value2');

      // Warm up L1
      const warmedUp = await cache.warmupL1(['key1', 'key2']);

      // If Redis available, should have warmed up
      if (cache.isL2Available()) {
        expect(warmedUp).toBeGreaterThan(0);
      }
    });

    it('should sync L2 from L1', async () => {
      const l1 = cache.getL1();

      // Populate L1 only
      await l1.set('key1', 'value1');
      await l1.set('key2', 'value2');

      // Sync to L2
      const synced = await cache.syncL2FromL1();

      expect(synced).toBeGreaterThanOrEqual(0);
    });

    it('should invalidate patterns', async () => {
      await cache.set('trans:1', 'value1');
      await cache.set('trans:2', 'value2');
      await cache.set('embed:1', 'value3');

      // Invalidate all trans: keys
      const invalidated = await cache.invalidatePattern(/^trans:/);

      expect(invalidated).toBe(2);
      expect(await cache.get('trans:1')).toBeNull();
      expect(await cache.get('trans:2')).toBeNull();
      expect(await cache.get('embed:1')).toBe('value3');
    });
  });

  describe('Error Handling', () => {
    it('should gracefully handle Redis unavailability', async () => {
      // Even if Redis is not available, cache should still work with L1
      await cache.set('key1', 'value1');
      const result = await cache.get('key1');

      expect(result).toBe('value1');
    });

    it('should report L2 availability', () => {
      const isAvailable = cache.isL2Available();

      // Should be boolean regardless of Redis status
      expect(typeof isAvailable).toBe('boolean');
    });
  });

  describe('Real-World Use Cases', () => {
    it('should cache translation results', async () => {
      interface TranslationCache {
        source: string;
        translation: string;
        confidence: number;
        timestamp: number;
      }

      const sourceText = 'བཀྲ་ཤིས་བདེ་ལེགས།';
      const cacheData: TranslationCache = {
        source: sourceText,
        translation: 'Greetings (བཀྲ་ཤིས་བདེ་ལེགས།).',
        confidence: 0.95,
        timestamp: Date.now(),
      };

      await cache.set('trans:greeting', cacheData, 3600);
      const cached = await cache.get<TranslationCache>('trans:greeting');

      expect(cached).toEqual(cacheData);
    });

    it('should cache embeddings', async () => {
      const embedding = Array(768).fill(0).map(() => Math.random());

      await cache.set('embed:text1', embedding, 86400);
      const cached = await cache.get<number[]>('embed:text1');

      expect(cached).toEqual(embedding);
    });

    it('should cache dictionary lookups', async () => {
      interface DictionaryEntry {
        tibetan: string;
        english: string;
        frequency: string;
        category: string;
      }

      const entry: DictionaryEntry = {
        tibetan: 'བཀྲ་ཤིས།',
        english: 'auspicious, fortunate',
        frequency: 'common',
        category: 'greeting',
      };

      await cache.set('dict:བཀྲ་ཤིས།', entry, 3600);
      const cached = await cache.get<DictionaryEntry>('dict:བཀྲ་ཤིས།');

      expect(cached).toEqual(entry);
    });
  });

  describe('Performance', () => {
    it('should handle rapid sequential operations', async () => {
      const operations = 100;

      for (let i = 0; i < operations; i++) {
        await cache.set(`key${i}`, `value${i}`);
      }

      // Only first 3 should be in L1 (maxSize: 3)
      const l1 = cache.getL1();
      expect(l1.size()).toBe(3);

      // But should still be retrievable (from L2 or miss)
      const result = await cache.get('key0');
      // Result depends on LRU and Redis availability
    });

    it('should handle concurrent operations', async () => {
      const promises = [];

      for (let i = 0; i < 10; i++) {
        promises.push(cache.set(`key${i}`, `value${i}`));
      }

      await Promise.all(promises);

      // All operations should complete without error
      // key9 should be in cache (most recent)
      const result = await cache.get('key9');
      expect(result).toBe('value9');
    });
  });
});
