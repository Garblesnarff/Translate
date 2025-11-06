// File: server/services/ocr/OCRCache.ts
// Caching layer for OCR results

import { createHash } from 'crypto';
import { CacheService, createCacheService } from '../../core/cache/CacheService';
import type { OCRResult, CachedOCRResult } from './types';
import { CACHE_CONFIG } from './config';

/**
 * Cache statistics
 */
interface CacheStats {
  hits: number;
  misses: number;
  hitRate: number;
}

/**
 * OCRCache for caching expensive OCR operations
 *
 * Features:
 * - Caches OCR results by page hash (SHA-256)
 * - 30-day TTL (OCR results don't change)
 * - Only caches high-quality results (>0.6)
 * - Tracks cache hit/miss statistics
 * - Integrates with multi-layer CacheService
 */
export class OCRCache {
  private cache: CacheService;
  private hits = 0;
  private misses = 0;

  /**
   * Create a new OCRCache
   *
   * @param cache - Optional custom cache service
   */
  constructor(cache?: CacheService) {
    this.cache = cache || createCacheService();
  }

  /**
   * Cache OCR result for a page
   *
   * @param pageBuffer - Page image buffer
   * @param result - OCR result to cache
   * @returns Cache TTL in milliseconds
   */
  async cacheResult(pageBuffer: Buffer, result: OCRResult): Promise<number> {
    // Only cache if quality is acceptable
    if (result.quality < CACHE_CONFIG.MIN_QUALITY_TO_CACHE) {
      return 0;
    }

    const cacheKey = this.generateCacheKey(pageBuffer);

    const cachedResult: CachedOCRResult = {
      ...result,
      cacheKey,
      cachedAt: Date.now(),
      ttl: CACHE_CONFIG.TTL,
    };

    await this.cache.set(cacheKey, cachedResult, CACHE_CONFIG.TTL);

    return CACHE_CONFIG.TTL;
  }

  /**
   * Get cached OCR result
   *
   * @param pageBuffer - Page image buffer
   * @returns Cached result or null
   */
  async getCached(pageBuffer: Buffer): Promise<OCRResult | null> {
    const cacheKey = this.generateCacheKey(pageBuffer);

    const cached = await this.cache.get<CachedOCRResult>(cacheKey);

    if (cached) {
      this.hits++;
      return {
        text: cached.text,
        confidence: cached.confidence,
        quality: cached.quality,
        words: cached.words,
      };
    }

    this.misses++;
    return null;
  }

  /**
   * Invalidate cached result for a page
   *
   * @param pageBuffer - Page image buffer
   */
  async invalidate(pageBuffer: Buffer): Promise<void> {
    const cacheKey = this.generateCacheKey(pageBuffer);
    await this.cache.delete(cacheKey);
  }

  /**
   * Clear all cached OCR results
   */
  async clear(): Promise<void> {
    await this.cache.clear();
    this.hits = 0;
    this.misses = 0;
  }

  /**
   * Get cache statistics
   *
   * @returns Cache stats
   */
  getStats(): CacheStats {
    const total = this.hits + this.misses;
    return {
      hits: this.hits,
      misses: this.misses,
      hitRate: total > 0 ? this.hits / total : 0,
    };
  }

  /**
   * Generate cache key from page buffer
   * Uses SHA-256 hash of page image
   *
   * @param pageBuffer - Page image buffer
   * @returns Cache key
   */
  private generateCacheKey(pageBuffer: Buffer): string {
    const hash = createHash('sha256').update(pageBuffer).digest('hex');
    return `${CACHE_CONFIG.KEY_PREFIX}${hash}`;
  }
}
