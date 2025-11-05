/**
 * Example: Integrating Cache with Translation Service
 *
 * This file demonstrates how to integrate the multi-layer cache
 * with the existing Tibetan translation service.
 */

import {
  createCacheService,
  CacheKeys,
  hashText,
  generateTranslationKey,
  generateEmbeddingKey,
  getCacheConfig,
} from './index.js';

// ============================================================================
// Example 1: Basic Translation Caching
// ============================================================================

interface TranslationResult {
  translation: string;
  confidence: number;
  metadata: {
    model: string;
    processingTime: number;
    cached?: boolean;
  };
}

/**
 * Translation service with integrated caching
 */
class CachedTranslationService {
  private cache = createCacheService(getCacheConfig());

  async translate(text: string): Promise<TranslationResult> {
    // Generate deterministic cache key
    const key = CacheKeys.translation(hashText(text));

    // Try cache first
    const cached = await this.cache.get<TranslationResult>(key);
    if (cached) {
      console.log('[Cache HIT] Translation retrieved from cache');
      return {
        ...cached,
        metadata: {
          ...cached.metadata,
          cached: true,
        },
      };
    }

    console.log('[Cache MISS] Translating...');

    // Perform translation (simulated)
    const startTime = Date.now();
    const result: TranslationResult = {
      translation: `Translation of: ${text}`,
      confidence: 0.95,
      metadata: {
        model: 'gemini',
        processingTime: Date.now() - startTime,
      },
    };

    // Cache the result (1 hour TTL)
    await this.cache.set(key, result, 3600);

    return result;
  }

  async getStats() {
    return await this.cache.getStats();
  }
}

// Usage
const translationService = new CachedTranslationService();
const result = await translationService.translate('བཀྲ་ཤིས་བདེ་ལེགས།');
console.log(result);

// ============================================================================
// Example 2: Embedding Caching
// ============================================================================

interface Embedding {
  vector: number[];
  model: string;
  dimension: number;
}

class CachedEmbeddingService {
  private cache = createCacheService(getCacheConfig());

  async getEmbedding(text: string, model: string = 'gemini'): Promise<Embedding> {
    // Generate cache key with model
    const key = generateEmbeddingKey(text, model);

    // Try cache
    const cached = await this.cache.get<Embedding>(key);
    if (cached) {
      console.log('[Cache HIT] Embedding from cache');
      return cached;
    }

    console.log('[Cache MISS] Computing embedding...');

    // Compute embedding (simulated)
    const embedding: Embedding = {
      vector: Array(768).fill(0).map(() => Math.random()),
      model,
      dimension: 768,
    };

    // Cache for 24 hours (embeddings rarely change)
    await this.cache.set(key, embedding, 86400);

    return embedding;
  }
}

// ============================================================================
// Example 3: Dictionary Caching
// ============================================================================

interface DictionaryEntry {
  tibetan: string;
  english: string;
  wylie?: string;
  frequency: string;
  category: string;
}

class CachedDictionaryService {
  private cache = createCacheService(getCacheConfig());

  async lookup(tibetan: string): Promise<DictionaryEntry | null> {
    const key = CacheKeys.dictionary(tibetan);

    // Try cache
    const cached = await this.cache.get<DictionaryEntry>(key);
    if (cached) {
      return cached;
    }

    // Lookup in database (simulated)
    const entry = await this.lookupInDatabase(tibetan);
    if (!entry) {
      return null;
    }

    // Cache for 1 hour
    await this.cache.set(key, entry, 3600);

    return entry;
  }

  private async lookupInDatabase(tibetan: string): Promise<DictionaryEntry | null> {
    // Simulated database lookup
    return {
      tibetan,
      english: 'example translation',
      frequency: 'common',
      category: 'greeting',
    };
  }
}

// ============================================================================
// Example 4: Batch Translation with Caching
// ============================================================================

class BatchTranslationService {
  private cache = createCacheService(getCacheConfig());

  async translateBatch(texts: string[]): Promise<TranslationResult[]> {
    const results: TranslationResult[] = [];
    const toTranslate: { text: string; index: number }[] = [];

    // Check cache for each text
    for (let i = 0; i < texts.length; i++) {
      const text = texts[i];
      const key = CacheKeys.translation(hashText(text));
      const cached = await this.cache.get<TranslationResult>(key);

      if (cached) {
        console.log(`[Cache HIT] ${i}/${texts.length}`);
        results[i] = cached;
      } else {
        console.log(`[Cache MISS] ${i}/${texts.length}`);
        toTranslate.push({ text, index: i });
      }
    }

    // Translate uncached texts
    if (toTranslate.length > 0) {
      console.log(`Translating ${toTranslate.length} texts...`);

      const translations = await Promise.all(
        toTranslate.map(({ text }) => this.translateSingle(text))
      );

      // Insert translations and cache them
      for (let i = 0; i < toTranslate.length; i++) {
        const { index, text } = toTranslate[i];
        const translation = translations[i];

        results[index] = translation;

        // Cache result
        const key = CacheKeys.translation(hashText(text));
        await this.cache.set(key, translation, 3600);
      }
    }

    console.log(
      `[Batch] ${results.length - toTranslate.length}/${results.length} from cache`
    );

    return results;
  }

  private async translateSingle(text: string): Promise<TranslationResult> {
    // Simulated translation
    return {
      translation: `Translation of: ${text}`,
      confidence: 0.95,
      metadata: {
        model: 'gemini',
        processingTime: 100,
      },
    };
  }
}

// ============================================================================
// Example 5: Cache Invalidation Strategy
// ============================================================================

class CacheManager {
  private cache = createCacheService(getCacheConfig());

  /**
   * Invalidate all translations
   */
  async invalidateAllTranslations(): Promise<number> {
    console.log('[Cache] Invalidating all translations...');
    return await this.cache.invalidatePattern(/^trans:/);
  }

  /**
   * Invalidate all embeddings
   */
  async invalidateAllEmbeddings(): Promise<number> {
    console.log('[Cache] Invalidating all embeddings...');
    return await this.cache.invalidatePattern(/^embed:/);
  }

  /**
   * Invalidate dictionary entries
   */
  async invalidateDictionary(): Promise<number> {
    console.log('[Cache] Invalidating dictionary...');
    return await this.cache.invalidatePattern(/^dict:/);
  }

  /**
   * Invalidate specific translation
   */
  async invalidateTranslation(text: string): Promise<void> {
    const key = CacheKeys.translation(hashText(text));
    await this.cache.delete(key);
  }

  /**
   * Clear entire cache
   */
  async clearAll(): Promise<void> {
    console.log('[Cache] Clearing all cache...');
    await this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  async getStats() {
    const stats = await this.cache.getStats();
    const efficiency = await this.cache.getEfficiency();

    return {
      size: stats.size,
      hitRate: (stats.hitRate * 100).toFixed(2) + '%',
      l1HitRate: (efficiency.l1HitRatio * 100).toFixed(2) + '%',
      l2HitRate: (efficiency.l2HitRatio * 100).toFixed(2) + '%',
      l1Size: stats.l1?.size,
      l2Connected: this.cache.isL2Available(),
    };
  }

  /**
   * Monitor cache performance
   */
  startMonitoring(intervalMs: number = 60000) {
    setInterval(async () => {
      const stats = await this.getStats();
      console.log('[Cache Monitor]', stats);
    }, intervalMs);
  }
}

// ============================================================================
// Example 6: Express Middleware Integration
// ============================================================================

import type { Request, Response, NextFunction } from 'express';

interface CachedResponse {
  status: number;
  body: any;
  headers: Record<string, string>;
}

/**
 * Express middleware for caching API responses
 */
function createCacheMiddleware(ttl: number = 300) {
  const cache = createCacheService(getCacheConfig());

  return async (req: Request, res: Response, next: NextFunction) => {
    // Only cache GET requests
    if (req.method !== 'GET') {
      return next();
    }

    // Generate cache key from URL and query params
    const cacheKey = CacheKeys.generic(
      'api',
      hashText(`${req.path}:${JSON.stringify(req.query)}`)
    );

    // Try cache
    const cached = await cache.get<CachedResponse>(cacheKey);
    if (cached) {
      console.log('[API Cache HIT]', req.path);

      // Set headers
      Object.entries(cached.headers).forEach(([key, value]) => {
        res.setHeader(key, value);
      });

      // Send cached response
      return res.status(cached.status).json(cached.body);
    }

    console.log('[API Cache MISS]', req.path);

    // Capture response
    const originalJson = res.json.bind(res);
    res.json = function (body: any) {
      // Cache the response
      const cachedResponse: CachedResponse = {
        status: res.statusCode,
        body,
        headers: {
          'Content-Type': 'application/json',
        },
      };

      cache.set(cacheKey, cachedResponse, ttl).catch((error) => {
        console.error('[Cache] Failed to cache response:', error);
      });

      return originalJson(body);
    };

    next();
  };
}

// Usage in Express app
// app.use('/api/translate', createCacheMiddleware(3600)); // 1 hour cache

// ============================================================================
// Example 7: Performance Monitoring
// ============================================================================

class PerformanceMonitor {
  private cache = createCacheService(getCacheConfig());

  async logPerformance() {
    const stats = await this.cache.getStats();
    const efficiency = await this.cache.getEfficiency();
    const layerStats = await this.cache.getLayerStats();

    console.log('\n=== Cache Performance Report ===');
    console.log('\nOverall:');
    console.log(`  Total Size: ${stats.size} items`);
    console.log(`  Hit Rate: ${(stats.hitRate * 100).toFixed(2)}%`);
    console.log(`  Hits: ${stats.hits}`);
    console.log(`  Misses: ${stats.misses}`);

    console.log('\nL1 (Memory):');
    console.log(`  Size: ${layerStats.l1.size} / ${layerStats.l1.maxSize} items`);
    console.log(`  Hit Rate: ${(efficiency.l1HitRatio * 100).toFixed(2)}%`);
    console.log(`  Memory: ${(layerStats.l1.memoryUsed! / 1024).toFixed(2)} KB`);

    console.log('\nL2 (Redis):');
    console.log(`  Connected: ${this.cache.isL2Available()}`);
    console.log(`  Hit Rate: ${(efficiency.l2HitRatio * 100).toFixed(2)}%`);

    console.log('\nLatency:');
    console.log(`  L1: ${efficiency.avgLatency.l1}`);
    console.log(`  L2: ${efficiency.avgLatency.l2}`);

    console.log('\n================================\n');
  }

  startPeriodicReporting(intervalMs: number = 60000) {
    setInterval(() => {
      this.logPerformance();
    }, intervalMs);
  }
}

// ============================================================================
// Example 8: Warmup on Startup
// ============================================================================

class CacheWarmup {
  private cache = createCacheService(getCacheConfig());

  async warmupCommonTranslations() {
    console.log('[Warmup] Loading common translations into cache...');

    const commonPhrases = [
      'བཀྲ་ཤིས་བདེ་ལེགས།',
      // ... more common phrases
    ];

    let warmed = 0;
    for (const phrase of commonPhrases) {
      const key = CacheKeys.translation(hashText(phrase));

      // Check if already cached in L2
      const cached = await this.cache.getL2().get(key);
      if (cached) {
        // Promote to L1
        await this.cache.getL1().set(key, cached);
        warmed++;
      }
    }

    console.log(`[Warmup] Warmed up ${warmed} translations`);
  }

  async warmupDictionary() {
    console.log('[Warmup] Loading dictionary into cache...');
    // Load frequently accessed dictionary entries
  }
}

// Run on startup
// const warmup = new CacheWarmup();
// await warmup.warmupCommonTranslations();
// await warmup.warmupDictionary();

// ============================================================================
// Export examples
// ============================================================================

export {
  CachedTranslationService,
  CachedEmbeddingService,
  CachedDictionaryService,
  BatchTranslationService,
  CacheManager,
  createCacheMiddleware,
  PerformanceMonitor,
  CacheWarmup,
};
