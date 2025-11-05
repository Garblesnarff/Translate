# Multi-Layer Cache Infrastructure

A sophisticated caching system with L1 (Memory) and L2 (Redis) layers for optimal performance and scalability.

## Architecture

```
┌─────────────────────────────────────────┐
│         CacheService (Coordinator)       │
│   - Transparent multi-layer lookup       │
│   - Write-through strategy              │
│   - L2→L1 promotion                     │
└─────────────────────────────────────────┘
                    │
        ┌───────────┴───────────┐
        ▼                       ▼
┌──────────────┐      ┌──────────────┐
│  L1: Memory  │      │  L2: Redis   │
│   (Fast)     │      │  (Shared)    │
│   ~0.01ms    │      │   ~1-5ms     │
│   LRU evict  │      │   TTL expire │
│   1000 items │      │   Unlimited  │
└──────────────┘      └──────────────┘
```

## Features

### L1 (Memory Cache)
- **Synchronous** access (~0.01ms latency)
- **LRU eviction** when maxSize exceeded
- **TTL support** with automatic cleanup
- **Memory usage** tracking
- **Thread-safe** (single-threaded Node.js)

### L2 (Redis Cache)
- **Persistent** shared cache
- **Distributed** across multiple instances
- **TTL support** using Redis EXPIRE
- **Graceful fallback** if Redis unavailable
- **Automatic reconnection**

### Multi-Layer Coordinator
- **Transparent** cache-aside pattern
- **Write-through** to both layers
- **L2→L1 promotion** on cache hits
- **Consistent statistics** tracking
- **Pattern invalidation**

## Installation

```bash
# Add Redis dependency
npm install redis

# Optional: Install Redis server locally
# macOS
brew install redis

# Ubuntu/Debian
sudo apt-get install redis-server

# Docker
docker run -d -p 6379:6379 redis:7-alpine
```

## Usage

### Basic Usage

```typescript
import { createCacheService, CacheKeys, hashText } from './server/core/cache';

// Create cache service
const cache = createCacheService({
  l1: {
    maxSize: 1000,        // Keep 1000 items in memory
    defaultTtl: 3600,     // 1 hour
  },
  l2: {
    host: 'localhost',
    port: 6379,
    keyPrefix: 'tibetan:',
    defaultTtl: 86400,    // 24 hours
  }
});

// Store value
await cache.set('key', { data: 'value' }, 3600); // TTL: 1 hour

// Retrieve value
const value = await cache.get<{ data: string }>('key');

// Delete value
await cache.delete('key');

// Clear all
await cache.clear();
```

### Translation Caching

```typescript
import { CacheKeys, hashText } from './server/core/cache';

// Generate cache key
const sourceText = 'བཀྲ་ཤིས་བདེ་ལེགས།';
const key = CacheKeys.translation(hashText(sourceText));

// Store translation result
await cache.set(key, {
  translation: 'Greetings (བཀྲ་ཤིས་བདེ་ལེགས།).',
  confidence: 0.95,
  metadata: { model: 'gemini' }
}, 3600);

// Retrieve translation
const cached = await cache.get(key);
if (cached) {
  return cached; // Cache hit!
}

// ... perform translation and cache result
```

### Embedding Caching

```typescript
import { generateEmbeddingKey } from './server/core/cache';

const text = 'བཀྲ་ཤིས་བདེ་ལེགས།';
const key = generateEmbeddingKey(text, 'gemini-embedding');

// Store embedding
const embedding = await embeddingProvider.getEmbedding(text);
await cache.set(key, embedding, 86400); // 24 hours

// Retrieve embedding
const cachedEmbedding = await cache.get<number[]>(key);
```

### Dictionary Caching

```typescript
import { CacheKeys } from './server/core/cache';

const tibetan = 'བཀྲ་ཤིས།';
const key = CacheKeys.dictionary(tibetan);

// Cache dictionary entry
await cache.set(key, {
  tibetan: 'བཀྲ་ཤིས།',
  english: 'auspicious, fortunate',
  frequency: 'common'
}, 3600);
```

### Singleton Pattern

```typescript
import { getGlobalCacheService } from './server/core/cache';

// Get/create global instance
const cache = getGlobalCacheService();

// Use throughout application
await cache.set('key', 'value');
```

## Performance Characteristics

### Latency

| Layer | Latency | Use Case |
|-------|---------|----------|
| **L1 Hit** | ~0.01ms | Frequently accessed data |
| **L2 Hit** | ~1-5ms | Less frequent data, shared across instances |
| **Cache Miss** | Varies | Must fetch from source |

### Hit Rate Expectations

With proper configuration:
- **L1 Hit Rate**: 60-80% (frequently accessed data)
- **L2 Hit Rate**: 15-30% (less frequent data)
- **Overall Hit Rate**: 75-95%
- **Miss Rate**: 5-25%

### Memory Usage

| Cache Size | Memory (Estimate) |
|------------|-------------------|
| 100 items | ~100 KB |
| 1,000 items | ~1 MB |
| 10,000 items | ~10 MB |

*Actual memory usage varies based on data size*

## Configuration

### Environment-Specific Configs

```typescript
import { getCacheConfig } from './server/core/cache';

// Automatically uses NODE_ENV
const config = getCacheConfig();

// Or specify manually
const devConfig = {
  l1: { maxSize: 500 },
  l2: { keyPrefix: 'tibetan:dev:' }
};
```

### Environment Variables

```bash
# Redis configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=secret
REDIS_DB=0

# Cache settings
CACHE_L1_MAX_SIZE=1000
CACHE_L2_TTL=86400
```

## Advanced Features

### Warmup L1 from L2

```typescript
// Preload frequently accessed keys
await cache.warmupL1(['key1', 'key2', 'key3']);
```

### Sync L2 from L1

```typescript
// Persist memory cache to Redis
await cache.syncL2FromL1();
```

### Pattern Invalidation

```typescript
// Invalidate all translation cache entries
await cache.invalidatePattern(/^trans:/);

// Invalidate specific namespace
await cache.invalidatePattern(/^dict:བཀྲ/);
```

### Statistics

```typescript
// Get combined statistics
const stats = await cache.getStats();
console.log(`Hit rate: ${stats.hitRate * 100}%`);

// Get layer-specific stats
const layerStats = await cache.getLayerStats();
console.log('L1:', layerStats.l1);
console.log('L2:', layerStats.l2);

// Get efficiency metrics
const efficiency = await cache.getEfficiency();
console.log('L1 hit ratio:', efficiency.l1HitRatio);
console.log('L2 hit ratio:', efficiency.l2HitRatio);
```

## Testing

```bash
# Run cache tests
npm run test tests/unit/cache

# Watch mode
npm run test:watch tests/unit/cache

# Coverage
npm run test:coverage tests/unit/cache
```

## Best Practices

### 1. Use Deterministic Keys

```typescript
// Good: Deterministic hash-based key
const key = CacheKeys.translation(hashText(sourceText));

// Bad: Random or time-based key
const key = `trans:${Math.random()}`;
```

### 2. Set Appropriate TTLs

```typescript
// Short-lived data (1 hour)
await cache.set('temp:key', data, 3600);

// Long-lived data (24 hours)
await cache.set('dict:term', entry, 86400);

// No expiration (permanent until explicitly deleted)
await cache.set('config:key', value, 0);
```

### 3. Handle Cache Misses Gracefully

```typescript
async function getTranslation(text: string) {
  const key = CacheKeys.translation(hashText(text));

  // Try cache first
  let result = await cache.get<TranslationResult>(key);
  if (result) {
    return result;
  }

  // Cache miss - perform translation
  result = await translationService.translate(text);

  // Cache result
  await cache.set(key, result, 3600);

  return result;
}
```

### 4. Use Type Safety

```typescript
interface TranslationResult {
  translation: string;
  confidence: number;
}

// Type-safe get
const result = await cache.get<TranslationResult>(key);
if (result) {
  console.log(result.confidence); // TypeScript knows the shape
}
```

### 5. Monitor Performance

```typescript
// Log cache statistics periodically
setInterval(async () => {
  const stats = await cache.getStats();
  console.log('[Cache]', {
    hitRate: (stats.hitRate * 100).toFixed(2) + '%',
    size: stats.size,
    l1Size: stats.l1?.size,
    l2Connected: cache.isL2Available()
  });
}, 60000); // Every minute
```

## Troubleshooting

### Redis Connection Issues

```typescript
// Check L2 status
if (!cache.isL2Available()) {
  console.warn('[Cache] Redis unavailable, using L1 only');
}

// Get connection status
const l2 = cache.getL2();
const status = l2.getConnectionStatus();
console.log('Redis status:', status);
```

### High Memory Usage

```typescript
// Check memory usage
const stats = await cache.getStats();
console.log('Memory used:', stats.l1?.memoryUsed, 'bytes');

// Reduce L1 size if needed
const cache = createCacheService({
  l1: { maxSize: 500 } // Reduce from 1000
});
```

### Low Hit Rates

```typescript
// Analyze hit rates
const efficiency = await cache.getEfficiency();
if (efficiency.overallHitRate < 0.5) {
  console.warn('[Cache] Low hit rate - consider:');
  console.warn('- Increasing L1 maxSize');
  console.warn('- Increasing TTL values');
  console.warn('- Reviewing cache key generation');
}
```

## Performance Comparison

### No Cache vs L1 vs L2 vs Multi-Layer

| Scenario | Latency | Throughput |
|----------|---------|------------|
| **No Cache** | 100-500ms | 2-10 req/s |
| **L1 Only** | ~0.01ms | 10,000+ req/s |
| **L2 Only** | ~1-5ms | 200-1000 req/s |
| **Multi-Layer** | ~0.01-5ms* | 1,000-10,000 req/s |

*Depends on L1 hit rate

### Example: Translation API

```
Without cache: 300ms per translation
With L1 cache: 0.01ms per translation (30,000× faster)
With L2 cache: 2ms per translation (150× faster)

Expected speedup with 80% L1 hit rate:
  (0.8 × 0.01ms) + (0.2 × 2ms) = 0.408ms
  ~735× faster than no cache
```

## Architecture Decisions

### Why Multi-Layer?

1. **L1 (Memory)**: Ultra-fast for hot data, but limited capacity
2. **L2 (Redis)**: Larger capacity, shared across instances, persistent
3. **Together**: Best of both worlds - speed + capacity + persistence

### Why LRU for L1?

- **Automatic eviction** when full
- **Recent items stay** (temporal locality)
- **Simple to implement** and understand
- **Predictable behavior**

### Why Redis for L2?

- **Industry standard** for distributed caching
- **Built-in TTL** support
- **Persistence options** (RDB, AOF)
- **Scalability** (clustering, replication)
- **Rich features** (pub/sub, transactions)

## Future Enhancements

- [ ] Cache warming on startup
- [ ] Automatic TTL adjustment based on access patterns
- [ ] Cache hit prediction
- [ ] Compression for large values
- [ ] Tiered eviction policies
- [ ] Cache versioning/invalidation
- [ ] Distributed cache coordination

## License

MIT
