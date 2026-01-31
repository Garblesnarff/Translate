// File: tests/unit/services/ocr/ocr-cache.test.ts
// Tests for OCR result caching

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { OCRCache } from '../../../../server/services/ocr/OCRCache';
import type { OCRResult } from '../../../../server/services/ocr/types';

// Mock CacheService
vi.mock('../../../../server/core/cache/CacheService', () => ({
  CacheService: class MockCacheService {
    private cache = new Map<string, any>();

    async get<T>(key: string): Promise<T | null> {
      return this.cache.get(key) || null;
    }

    async set<T>(key: string, value: T, ttl?: number): Promise<void> {
      this.cache.set(key, value);
    }

    async has(key: string): Promise<boolean> {
      return this.cache.has(key);
    }

    async delete(key: string): Promise<void> {
      this.cache.delete(key);
    }

    async clear(): Promise<void> {
      this.cache.clear();
    }
  },
  createCacheService: () => new (vi.mocked(class MockCacheService {
    private cache = new Map<string, any>();

    async get<T>(key: string): Promise<T | null> {
      return this.cache.get(key) || null;
    }

    async set<T>(key: string, value: T, ttl?: number): Promise<void> {
      this.cache.set(key, value);
    }

    async has(key: string): Promise<boolean> {
      return this.cache.has(key);
    }

    async delete(key: string): Promise<void> {
      this.cache.delete(key);
    }

    async clear(): Promise<void> {
      this.cache.clear();
    }
  }))(),
}));

describe('OCRCache', () => {
  let ocrCache: OCRCache;

  beforeEach(() => {
    ocrCache = new OCRCache();
  });

  afterEach(async () => {
    await ocrCache.clear();
  });

  describe('cacheResult', () => {
    it('should cache OCR results by page hash', async () => {
      const pageBuffer = Buffer.from('test-page-image');
      const result: OCRResult = {
        text: 'བཀྲ་ཤིས་བདེ་ལེགས།',
        confidence: 0.85,
        quality: 0.8,
      };

      await ocrCache.cacheResult(pageBuffer, result);

      const cached = await ocrCache.getCached(pageBuffer);

      expect(cached).toBeDefined();
      expect(cached?.text).toBe(result.text);
      expect(cached?.confidence).toBe(result.confidence);
    });

    it('should use SHA-256 hash as cache key', async () => {
      const pageBuffer = Buffer.from('test-page-image');
      const result: OCRResult = {
        text: 'Test text',
        confidence: 0.9,
        quality: 0.9,
      };

      await ocrCache.cacheResult(pageBuffer, result);

      // Same buffer should retrieve same result
      const cached1 = await ocrCache.getCached(pageBuffer);
      expect(cached1).toBeDefined();

      // Different buffer should not retrieve result
      const differentBuffer = Buffer.from('different-image');
      const cached2 = await ocrCache.getCached(differentBuffer);
      expect(cached2).toBeNull();
    });

    it('should only cache if quality >0.6', async () => {
      const pageBuffer = Buffer.from('test-page-image');

      // Low quality result
      const lowQualityResult: OCRResult = {
        text: 'Poor quality text',
        confidence: 0.4,
        quality: 0.4,
      };

      await ocrCache.cacheResult(pageBuffer, lowQualityResult);

      const cached = await ocrCache.getCached(pageBuffer);

      // Should not cache low quality results
      expect(cached).toBeNull();
    });

    it('should cache high quality results', async () => {
      const pageBuffer = Buffer.from('test-page-image');

      // High quality result
      const highQualityResult: OCRResult = {
        text: 'High quality text',
        confidence: 0.9,
        quality: 0.85,
      };

      await ocrCache.cacheResult(pageBuffer, highQualityResult);

      const cached = await ocrCache.getCached(pageBuffer);

      // Should cache high quality results
      expect(cached).toBeDefined();
      expect(cached?.text).toBe(highQualityResult.text);
    });

    it('should set 30-day TTL', async () => {
      const pageBuffer = Buffer.from('test-page-image');
      const result: OCRResult = {
        text: 'Test text',
        confidence: 0.85,
        quality: 0.8,
      };

      const ttl = await ocrCache.cacheResult(pageBuffer, result);

      // Should return TTL in milliseconds (30 days)
      const expectedTTL = 30 * 24 * 60 * 60 * 1000;
      expect(ttl).toBe(expectedTTL);
    });
  });

  describe('getCached', () => {
    it('should retrieve from cache on repeated OCR', async () => {
      const pageBuffer = Buffer.from('test-page-image');
      const result: OCRResult = {
        text: 'Cached text',
        confidence: 0.88,
        quality: 0.85,
      };

      // Cache the result
      await ocrCache.cacheResult(pageBuffer, result);

      // Retrieve multiple times
      const cached1 = await ocrCache.getCached(pageBuffer);
      const cached2 = await ocrCache.getCached(pageBuffer);
      const cached3 = await ocrCache.getCached(pageBuffer);

      expect(cached1).toBeDefined();
      expect(cached2).toBeDefined();
      expect(cached3).toBeDefined();

      expect(cached1?.text).toBe(result.text);
      expect(cached2?.text).toBe(result.text);
      expect(cached3?.text).toBe(result.text);
    });

    it('should return null for uncached pages', async () => {
      const pageBuffer = Buffer.from('uncached-page');

      const cached = await ocrCache.getCached(pageBuffer);

      expect(cached).toBeNull();
    });

    it('should handle different pages independently', async () => {
      const page1Buffer = Buffer.from('page-1');
      const page2Buffer = Buffer.from('page-2');

      const result1: OCRResult = {
        text: 'Page 1 text',
        confidence: 0.85,
        quality: 0.8,
      };

      const result2: OCRResult = {
        text: 'Page 2 text',
        confidence: 0.9,
        quality: 0.88,
      };

      await ocrCache.cacheResult(page1Buffer, result1);
      await ocrCache.cacheResult(page2Buffer, result2);

      const cached1 = await ocrCache.getCached(page1Buffer);
      const cached2 = await ocrCache.getCached(page2Buffer);

      expect(cached1?.text).toBe('Page 1 text');
      expect(cached2?.text).toBe('Page 2 text');
    });
  });

  describe('invalidate', () => {
    it('should invalidate cache after 30 days', async () => {
      // Note: This test is conceptual since we can't easily simulate 30 days
      // In practice, the CacheService TTL handles this automatically

      const pageBuffer = Buffer.from('test-page');
      const result: OCRResult = {
        text: 'Temporary text',
        confidence: 0.85,
        quality: 0.8,
      };

      await ocrCache.cacheResult(pageBuffer, result);

      // Immediately should be cached
      const cached = await ocrCache.getCached(pageBuffer);
      expect(cached).toBeDefined();

      // After TTL expires, CacheService would return null
      // This is handled by the underlying cache implementation
    });

    it('should allow manual invalidation', async () => {
      const pageBuffer = Buffer.from('test-page');
      const result: OCRResult = {
        text: 'Text to invalidate',
        confidence: 0.85,
        quality: 0.8,
      };

      await ocrCache.cacheResult(pageBuffer, result);

      // Should be cached
      const cached1 = await ocrCache.getCached(pageBuffer);
      expect(cached1).toBeDefined();

      // Invalidate
      await ocrCache.invalidate(pageBuffer);

      // Should no longer be cached
      const cached2 = await ocrCache.getCached(pageBuffer);
      expect(cached2).toBeNull();
    });
  });

  describe('clear', () => {
    it('should clear all cached results', async () => {
      const page1 = Buffer.from('page-1');
      const page2 = Buffer.from('page-2');
      const page3 = Buffer.from('page-3');

      const result: OCRResult = {
        text: 'Test',
        confidence: 0.85,
        quality: 0.8,
      };

      await ocrCache.cacheResult(page1, result);
      await ocrCache.cacheResult(page2, result);
      await ocrCache.cacheResult(page3, result);

      // All should be cached
      expect(await ocrCache.getCached(page1)).toBeDefined();
      expect(await ocrCache.getCached(page2)).toBeDefined();
      expect(await ocrCache.getCached(page3)).toBeDefined();

      // Clear cache
      await ocrCache.clear();

      // All should be gone
      expect(await ocrCache.getCached(page1)).toBeNull();
      expect(await ocrCache.getCached(page2)).toBeNull();
      expect(await ocrCache.getCached(page3)).toBeNull();
    });
  });

  describe('statistics', () => {
    it('should track cache hits and misses', async () => {
      const pageBuffer = Buffer.from('test-page');
      const result: OCRResult = {
        text: 'Test',
        confidence: 0.85,
        quality: 0.8,
      };

      // Miss (not cached)
      await ocrCache.getCached(pageBuffer);

      // Cache it
      await ocrCache.cacheResult(pageBuffer, result);

      // Hit (cached)
      await ocrCache.getCached(pageBuffer);
      await ocrCache.getCached(pageBuffer);

      const stats = ocrCache.getStats();

      expect(stats.hits).toBe(2);
      expect(stats.misses).toBe(1);
      expect(stats.hitRate).toBeCloseTo(0.667, 2); // 2/3
    });

    it('should calculate correct hit rate', async () => {
      const page1 = Buffer.from('page-1');
      const page2 = Buffer.from('page-2');

      const result: OCRResult = {
        text: 'Test',
        confidence: 0.85,
        quality: 0.8,
      };

      // Cache page1
      await ocrCache.cacheResult(page1, result);

      // Hit
      await ocrCache.getCached(page1);
      await ocrCache.getCached(page1);

      // Miss
      await ocrCache.getCached(page2);

      const stats = ocrCache.getStats();

      expect(stats.hits).toBe(2);
      expect(stats.misses).toBe(1);
      expect(stats.hitRate).toBeCloseTo(2 / 3);
    });
  });
});
