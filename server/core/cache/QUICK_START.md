# Cache System - Quick Start Guide

## 🚀 5-Minute Setup

### 1. Install Redis (Optional but Recommended)

```bash
# Docker (easiest)
docker run -d -p 6379:6379 --name redis redis:7-alpine

# macOS
brew install redis && brew services start redis

# Ubuntu/Debian
sudo apt-get install redis-server
```

### 2. Import and Create Cache

```typescript
import { createCacheService, getCacheConfig } from './server/core/cache';

// Use environment-based config
const cache = createCacheService(getCacheConfig());

// Or custom config
const cache = createCacheService({
  l1: { maxSize: 1000, defaultTtl: 3600 },
  l2: { host: 'localhost', port: 6379 }
});
```

### 3. Basic Usage

```typescript
// Store
await cache.set('key', { data: 'value' }, 3600); // TTL: 1 hour

// Retrieve
const value = await cache.get<{ data: string }>('key');

// Delete
await cache.delete('key');

// Clear all
await cache.clear();
```

## 📝 Common Patterns

### Translation Caching

```typescript
import { CacheKeys, hashText } from './server/core/cache';

async function translateWithCache(text: string) {
  const key = CacheKeys.translation(hashText(text));

  // Try cache
  const cached = await cache.get(key);
  if (cached) return cached;

  // Translate and cache
  const result = await translate(text);
  await cache.set(key, result, 3600);
  return result;
}
```

### Embedding Caching

```typescript
import { generateEmbeddingKey } from './server/core/cache';

async function getEmbeddingWithCache(text: string) {
  const key = generateEmbeddingKey(text, 'gemini');

  const cached = await cache.get<number[]>(key);
  if (cached) return cached;

  const embedding = await computeEmbedding(text);
  await cache.set(key, embedding, 86400); // 24 hours
  return embedding;
}
```

### Dictionary Caching

```typescript
import { CacheKeys } from './server/core/cache';

async function lookupWithCache(tibetan: string) {
  const key = CacheKeys.dictionary(tibetan);

  const cached = await cache.get(key);
  if (cached) return cached;

  const entry = await database.lookup(tibetan);
  if (entry) {
    await cache.set(key, entry, 3600);
  }
  return entry;
}
```

## 🎯 Cache Key Patterns

```typescript
import { CacheKeys, hashText } from './server/core/cache';

// Translation
CacheKeys.translation(hashText(sourceText))
// → "trans:abc123..."

// Embedding
CacheKeys.embedding(hashText(text))
// → "embed:def456..."

// Dictionary
CacheKeys.dictionary('བཀྲ་ཤིས།')
// → "dict:%E0%BD%96%E0..."

// Example
CacheKeys.example('greeting-001')
// → "ex:greeting-001"

// Custom
CacheKeys.generic('namespace', 'key')
// → "namespace:key"
```

## 📊 Monitoring

```typescript
// Get statistics
const stats = await cache.getStats();
console.log({
  size: stats.size,
  hitRate: (stats.hitRate * 100).toFixed(1) + '%',
  l1Size: stats.l1?.size,
  l2Connected: cache.isL2Available()
});

// Get efficiency metrics
const efficiency = await cache.getEfficiency();
console.log({
  l1HitRate: (efficiency.l1HitRatio * 100).toFixed(1) + '%',
  l2HitRate: (efficiency.l2HitRatio * 100).toFixed(1) + '%',
  overall: (efficiency.overallHitRate * 100).toFixed(1) + '%'
});
```

## 🔧 Configuration Presets

```typescript
import { CACHE_CONFIGS, createCacheService } from './server/core/cache';

// Development
const cache = createCacheService(CACHE_CONFIGS.development);
// L1: 500 items, L2: localhost:6379 (dev:)

// Test
const cache = createCacheService(CACHE_CONFIGS.test);
// L1: 100 items, L2: localhost:6379 (test:)

// Production
const cache = createCacheService(CACHE_CONFIGS.production);
// L1: 2000 items, L2: localhost:6379 (prod:)
```

## 🎨 Advanced Operations

```typescript
// Invalidate pattern
await cache.invalidatePattern(/^trans:/);
// Removes all translation cache entries

// Warm up L1 from L2
const count = await cache.warmupL1(['key1', 'key2']);
// Preload frequently accessed keys

// Sync L2 from L1
const synced = await cache.syncL2FromL1();
// Persist memory cache to Redis

// Get layer statistics
const layerStats = await cache.getLayerStats();
console.log('L1:', layerStats.l1);
console.log('L2:', layerStats.l2);
```

## ⚡ Performance Tips

1. **Use Deterministic Keys**
   ```typescript
   // ✅ Good
   const key = CacheKeys.translation(hashText(text));

   // ❌ Bad
   const key = `trans:${Date.now()}`;
   ```

2. **Set Appropriate TTLs**
   ```typescript
   // Frequently changing data: 1 hour
   await cache.set(key, data, 3600);

   // Rarely changing data: 24 hours
   await cache.set(key, data, 86400);

   // Permanent: no expiration
   await cache.set(key, data, 0);
   ```

3. **Handle Misses Gracefully**
   ```typescript
   const cached = await cache.get(key);
   if (cached) return cached;

   // Always cache successful results
   const result = await fetchData();
   await cache.set(key, result, ttl);
   return result;
   ```

## 🐛 Troubleshooting

### Redis Not Available

```typescript
// Cache works without Redis (L1 only)
if (!cache.isL2Available()) {
  console.warn('[Cache] Running L1-only mode');
}

// Force reconnect
await cache.getL2().reconnect();
```

### Low Hit Rate

```typescript
// Check efficiency
const eff = await cache.getEfficiency();
if (eff.overallHitRate < 0.5) {
  // Consider:
  // - Increase L1 maxSize
  // - Increase TTL values
  // - Review key generation logic
}
```

### High Memory Usage

```typescript
// Check memory
const stats = await cache.getStats();
const memoryMB = (stats.l1?.memoryUsed || 0) / 1024 / 1024;
console.log(`L1 memory: ${memoryMB.toFixed(2)} MB`);

// Reduce if needed
const cache = createCacheService({
  l1: { maxSize: 500 } // Reduce from default 1000
});
```

## 📚 Type Safety

```typescript
// Define your types
interface TranslationResult {
  translation: string;
  confidence: number;
}

// Type-safe operations
await cache.set<TranslationResult>('key', result);
const cached = await cache.get<TranslationResult>('key');

// TypeScript knows the shape
if (cached) {
  console.log(cached.confidence); // ✅ Type-safe
}
```

## 🎯 Expected Performance

| Metric | Without Cache | With Cache |
|--------|---------------|------------|
| **Translation** | 300ms | 0.01-15ms |
| **Embedding** | 150ms | 0.01-5ms |
| **Dictionary** | 30ms | 0.01-2ms |
| **Hit Rate** | N/A | 75-95% |
| **Throughput** | 3 req/s | 1,000-10,000 req/s |

## 🔒 Environment Variables

```bash
# Redis connection
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=secret
REDIS_DB=0

# Cache settings
CACHE_L1_MAX_SIZE=1000
CACHE_L2_TTL=86400
NODE_ENV=production
```

## ✅ Checklist

- [ ] Redis installed and running (optional)
- [ ] Cache service created
- [ ] Translation caching implemented
- [ ] Embedding caching implemented
- [ ] Dictionary caching implemented
- [ ] Monitoring enabled
- [ ] Tests passing

## 🚦 Next Steps

1. **Integrate with translation service** → 75-95% fewer API calls
2. **Monitor cache stats** → Optimize hit rates
3. **Adjust configuration** → Based on traffic patterns

## 📖 Full Documentation

- **Comprehensive Guide**: `server/core/cache/README.md`
- **Integration Examples**: `server/core/cache/example-integration.ts`
- **Implementation Summary**: `CACHE_IMPLEMENTATION_SUMMARY.md`
- **Tests**: `tests/unit/cache/`

---

**Need help?** Check the full documentation or examples!
