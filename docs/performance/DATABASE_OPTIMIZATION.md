# Database Query Optimization

This document outlines database optimization strategies implemented in the Tibetan Translation Tool V2.

## Overview

Database performance is critical for production scale. This document covers:
- Query optimization techniques
- Index strategies (already implemented in Phase 0.3)
- Connection pooling (enhanced in Phase 4.2)
- Query caching
- Slow query detection

## 1. Index Optimization (Phase 0.3 - Already Implemented)

### Existing Indexes

The following 22 indexes were implemented in Phase 0.3:

#### Translations Table
- `idx_translations_status` - Query translations by status
- `idx_translations_source_language` - Filter by source language
- `idx_translations_target_language` - Filter by target language
- `idx_translations_created_at` - Sort by creation date
- `idx_translations_completed_at` - Sort by completion date
- `idx_translations_user_id` - Filter by user

#### Batch Jobs Table
- `idx_batch_jobs_status` - Query jobs by status
- `idx_batch_jobs_created_at` - Sort by creation date
- `idx_batch_jobs_user_id` - Filter by user

#### Dictionary Table
- `idx_dictionary_source_term` - Look up Tibetan terms
- `idx_dictionary_target_term` - Look up English translations
- `idx_dictionary_category` - Filter by category

#### Audit Logs Table
- `idx_audit_logs_entity_type` - Filter by entity type
- `idx_audit_logs_entity_id` - Look up specific entity logs
- `idx_audit_logs_user_id` - Filter by user
- `idx_audit_logs_created_at` - Sort by date

#### User Activity Table
- `idx_user_activity_user_id` - Filter by user
- `idx_user_activity_action_type` - Filter by action
- `idx_user_activity_created_at` - Sort by date

#### Performance Metrics Table
- `idx_performance_metrics_endpoint` - Filter by endpoint
- `idx_performance_metrics_status_code` - Filter by status
- `idx_performance_metrics_created_at` - Sort by date

### Index Performance Impact

**Expected Performance Gains:**
- Simple queries (indexed): **<10ms** (vs 100-500ms unindexed)
- Complex joins (indexed): **<50ms** (vs 1000-5000ms unindexed)
- Full-text search: **<100ms** (vs 10000+ ms unindexed)

### Verifying Index Usage

#### PostgreSQL
```sql
-- Show all indexes
SELECT * FROM pg_indexes WHERE schemaname = 'public';

-- Analyze index usage
SELECT
  schemaname,
  tablename,
  indexname,
  idx_scan as index_scans,
  idx_tup_read as tuples_read,
  idx_tup_fetch as tuples_fetched
FROM pg_stat_user_indexes
ORDER BY idx_scan DESC;

-- Find unused indexes
SELECT
  schemaname,
  tablename,
  indexname,
  idx_scan
FROM pg_stat_user_indexes
WHERE idx_scan = 0
  AND indexname NOT LIKE 'pg_toast%';
```

#### SQLite
```sql
-- Show all indexes
SELECT * FROM sqlite_master WHERE type = 'index';

-- Analyze query plan
EXPLAIN QUERY PLAN SELECT * FROM translations WHERE status = 'completed';
```

## 2. Connection Pooling (Enhanced in Phase 4.2)

### Original Implementation (Phase 0.3)

Basic connection pooling was implemented with:
- Max 20 connections
- 30s idle timeout
- 2s connection timeout
- Error handling

### Enhanced Features (Phase 4.2)

#### Connection Health Checks
```typescript
// Periodic health checks (every 30s)
setInterval(async () => {
  const healthy = await db.healthCheck();
  if (!healthy) {
    console.error('Database health check failed');
    // Trigger reconnection
  }
}, 30000);
```

#### Connection Retry with Exponential Backoff
```typescript
async function queryWithRetry<T>(sql: string, params?: any[], maxRetries = 3): Promise<T[]> {
  let lastError: Error | null = null;

  for (let i = 0; i < maxRetries; i++) {
    try {
      return await db.query<T>(sql, params);
    } catch (error) {
      lastError = error;
      const delay = Math.min(1000 * Math.pow(2, i), 10000); // Max 10s
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}
```

#### Connection Pool Monitoring
```typescript
// Monitor pool statistics
const stats = db.getPoolStats();
console.log('Pool stats:', {
  total: stats.total,
  active: stats.total - stats.idle,
  idle: stats.idle,
  waiting: stats.waiting,
});

// Alert if waiting connections
if (stats.waiting > 5) {
  console.warn('High connection contention detected');
}
```

#### Graceful Connection Draining
```typescript
// Shutdown procedure
async function shutdown() {
  console.log('Draining connections...');

  // Stop accepting new requests
  server.close();

  // Wait for active queries to complete (max 30s)
  await new Promise(resolve => setTimeout(resolve, 30000));

  // Close database connections
  await db.close();

  process.exit(0);
}
```

#### Connection Leak Detection
```typescript
// Track long-running queries
const activeQueries = new Map<string, { sql: string; startTime: number }>();

function trackQuery(id: string, sql: string) {
  activeQueries.set(id, { sql, startTime: Date.now() });
}

function releaseQuery(id: string) {
  activeQueries.delete(id);
}

// Periodic leak detection (every 5 minutes)
setInterval(() => {
  const now = Date.now();
  const leaks = Array.from(activeQueries.entries())
    .filter(([_, q]) => now - q.startTime > 60000) // 1 minute threshold
    .map(([id, q]) => ({ id, sql: q.sql, duration: now - q.startTime }));

  if (leaks.length > 0) {
    console.error('Potential connection leaks detected:', leaks);
  }
}, 5 * 60 * 1000);
```

## 3. Query Optimization

### EXPLAIN ANALYZE (PostgreSQL)

Use EXPLAIN ANALYZE to understand query execution:

```typescript
import { getQueryOptimizer } from './server/core/database/queryOptimizer';

const optimizer = getQueryOptimizer(db);

// Analyze query
const analysis = await optimizer.analyzeQuery(
  'SELECT * FROM translations WHERE status = $1 ORDER BY created_at DESC',
  ['completed']
);

console.log('Query plan:', analysis);
// Output:
// {
//   query: '...',
//   planningTime: 0.123,
//   executionTime: 2.456,
//   plan: { ... },
//   rows: 100,
//   cost: 50.23
// }
```

### Query Result Caching (5-Minute TTL)

Cache frequently accessed data:

```typescript
// Enable caching for expensive queries
const results = await optimizer.query(
  'SELECT * FROM translations WHERE status = $1 ORDER BY created_at DESC LIMIT 10',
  ['completed'],
  { cache: true, cacheTTL: 5 * 60 * 1000 } // 5 minutes
);

// Check cache statistics
const stats = optimizer.getCacheStats();
console.log('Cache hit rate:', stats.hitRate.toFixed(2) + '%');
```

**Cache Strategy:**
- Cache read-heavy queries (translations list, dictionary lookups)
- Skip caching for user-specific or real-time data
- Use shorter TTL (1-2 minutes) for frequently changing data
- Use longer TTL (10-15 minutes) for static data (dictionary)

### Pagination for Large Result Sets

Always paginate large result sets:

```typescript
// Paginated query
const result = await optimizer.queryWithPagination(
  'SELECT * FROM translations ORDER BY created_at DESC',
  [],
  { page: 1, pageSize: 50, cache: true }
);

console.log('Results:', {
  data: result.data,
  total: result.total,
  page: result.page,
  pageSize: result.pageSize,
  totalPages: result.totalPages,
});
```

**Pagination Best Practices:**
- Default page size: 50 items
- Max page size: 100 items
- Use cursor-based pagination for real-time feeds
- Cache paginated results for 5 minutes

## 4. Slow Query Logging

### Configuration

Queries exceeding 100ms are automatically logged:

```typescript
const optimizer = createQueryOptimizer(db, {
  slowQueryThreshold: 100, // 100ms
  maxSlowQueries: 1000,    // Keep last 1000 slow queries
  cacheTTL: 5 * 60 * 1000, // 5-minute cache
});
```

### Viewing Slow Queries

```typescript
// Get slowest queries
const slowQueries = optimizer.getSlowQueries(10); // Top 10

slowQueries.forEach(q => {
  console.log(`Query: ${q.query.substring(0, 100)}`);
  console.log(`Duration: ${q.duration.toFixed(2)}ms`);
  console.log(`Timestamp: ${q.timestamp.toISOString()}`);
  console.log(`Stack trace: ${q.stackTrace}`);
});
```

### Query Performance Metrics

```typescript
// Get overall metrics
const metrics = optimizer.getMetrics();

console.log('Query metrics:', {
  totalQueries: metrics.totalQueries,
  slowQueries: metrics.slowQueries,
  avgDuration: metrics.avgDuration.toFixed(2) + 'ms',
  maxDuration: metrics.maxDuration.toFixed(2) + 'ms',
  cacheHitRate: ((metrics.cacheHits / metrics.totalQueries) * 100).toFixed(2) + '%',
});
```

## 5. Query Optimization Best Practices

### Use Indexes Effectively

```sql
-- ✅ Good: Uses index
SELECT * FROM translations WHERE status = 'completed';

-- ❌ Bad: Full table scan (function on indexed column)
SELECT * FROM translations WHERE UPPER(status) = 'COMPLETED';

-- ✅ Good: Uses index
SELECT * FROM translations WHERE created_at > '2025-01-01';

-- ❌ Bad: Full table scan (function on indexed column)
SELECT * FROM translations WHERE DATE(created_at) = '2025-01-01';
```

### Avoid N+1 Queries

```typescript
// ❌ Bad: N+1 queries
const translations = await db.query('SELECT * FROM translations LIMIT 10');
for (const t of translations) {
  const user = await db.query('SELECT * FROM users WHERE id = $1', [t.user_id]);
  t.user = user[0];
}

// ✅ Good: Single join query
const translations = await db.query(`
  SELECT t.*, u.name as user_name
  FROM translations t
  LEFT JOIN users u ON t.user_id = u.id
  LIMIT 10
`);
```

### Use Prepared Statements

```typescript
// ✅ Good: Parameterized query (SQL injection safe)
await db.query('SELECT * FROM translations WHERE id = $1', [translationId]);

// ❌ Bad: String interpolation (SQL injection risk)
await db.query(`SELECT * FROM translations WHERE id = '${translationId}'`);
```

### Optimize JOINs

```sql
-- ✅ Good: Specific columns
SELECT t.id, t.content, u.name
FROM translations t
JOIN users u ON t.user_id = u.id;

-- ❌ Bad: SELECT *
SELECT *
FROM translations t
JOIN users u ON t.user_id = u.id;
```

## 6. Materialized Views (PostgreSQL)

For complex aggregations, consider materialized views:

```sql
-- Create materialized view for dashboard stats
CREATE MATERIALIZED VIEW translation_stats AS
SELECT
  DATE(created_at) as date,
  COUNT(*) as total_translations,
  COUNT(*) FILTER (WHERE status = 'completed') as completed,
  COUNT(*) FILTER (WHERE status = 'failed') as failed,
  AVG(confidence_score) as avg_confidence
FROM translations
GROUP BY DATE(created_at)
ORDER BY date DESC;

-- Create index on materialized view
CREATE INDEX idx_translation_stats_date ON translation_stats(date);

-- Refresh periodically (e.g., every hour)
REFRESH MATERIALIZED VIEW translation_stats;
```

**Usage in Code:**
```typescript
// Fast dashboard query (uses materialized view)
const stats = await db.query('SELECT * FROM translation_stats ORDER BY date DESC LIMIT 30');
```

**Refresh Strategy:**
```typescript
// Refresh materialized views hourly
setInterval(async () => {
  console.log('Refreshing materialized views...');
  await db.query('REFRESH MATERIALIZED VIEW translation_stats');
  console.log('✅ Materialized views refreshed');
}, 60 * 60 * 1000); // Every hour
```

## 7. Database Monitoring

### Key Metrics to Track

1. **Query Performance**
   - Average query time: <10ms
   - P95 query time: <50ms
   - P99 query time: <200ms
   - Slow queries: <1% of total

2. **Connection Pool**
   - Active connections: <80% of max
   - Waiting connections: 0 (normal load)
   - Connection acquisition time: <5ms
   - Connection errors: 0

3. **Cache Performance**
   - Cache hit rate: >70%
   - Cache size: <1000 entries
   - Cache evictions: Minimal

4. **Database Size**
   - Total size: Monitor growth
   - Index size: Should be reasonable
   - Unused indexes: Remove if found

### Monitoring Commands

#### PostgreSQL
```sql
-- Database size
SELECT pg_size_pretty(pg_database_size(current_database()));

-- Table sizes
SELECT
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- Active queries
SELECT
  pid,
  now() - query_start as duration,
  query
FROM pg_stat_activity
WHERE state = 'active'
ORDER BY duration DESC;

-- Kill long-running query
SELECT pg_terminate_backend(pid);
```

#### SQLite
```sql
-- Database size
SELECT page_count * page_size as size FROM pragma_page_count(), pragma_page_size();

-- Table sizes
SELECT name, (SELECT COUNT(*) FROM sqlite_master WHERE tbl_name = name) as row_count
FROM sqlite_master WHERE type = 'table';
```

## 8. Performance Targets

### Query Performance
- Simple SELECT: <10ms
- Complex JOIN: <50ms
- Aggregation: <100ms
- Full-text search: <200ms

### Connection Pool
- Pool acquisition: <5ms
- Active connections: <16/20 (80%)
- Waiting connections: 0 (normal load)
- Connection errors: 0

### Cache Performance
- Hit rate: >70%
- Miss penalty: <50ms
- Cache size: <1000 entries
- Eviction rate: <10%/hour

## 9. Troubleshooting

### Slow Queries

1. **Identify slow queries:**
   ```typescript
   const slowQueries = optimizer.getSlowQueries(10);
   ```

2. **Analyze query plan:**
   ```typescript
   const plan = await optimizer.analyzeQuery(slowQuery.query);
   ```

3. **Check for missing indexes:**
   - Look for "Seq Scan" in query plan
   - Add index on frequently filtered columns

4. **Optimize query:**
   - Reduce result set size
   - Use pagination
   - Add WHERE clauses
   - Avoid functions on indexed columns

### Connection Pool Exhaustion

1. **Check pool stats:**
   ```typescript
   const stats = db.getPoolStats();
   console.log('Waiting:', stats.waiting);
   ```

2. **Identify connection leaks:**
   - Check for unreleased connections
   - Look for long-running queries

3. **Increase pool size (if needed):**
   ```typescript
   const db = new DatabaseService({ maxConnections: 30 });
   ```

### Low Cache Hit Rate

1. **Check cache stats:**
   ```typescript
   const stats = optimizer.getCacheStats();
   console.log('Hit rate:', stats.hitRate);
   ```

2. **Increase cache TTL:**
   ```typescript
   await optimizer.query(sql, params, { cache: true, cacheTTL: 10 * 60 * 1000 });
   ```

3. **Identify cacheable queries:**
   - Read-heavy queries
   - Infrequently changing data
   - Expensive aggregations

## 10. Production Checklist

- [ ] All tables have appropriate indexes
- [ ] Slow query logging enabled (threshold: 100ms)
- [ ] Query result caching enabled (TTL: 5 minutes)
- [ ] Connection pool sized appropriately (20 connections)
- [ ] Connection health checks enabled (every 30s)
- [ ] Graceful shutdown implemented
- [ ] Connection leak detection enabled
- [ ] Pagination used for large result sets
- [ ] Materialized views created for complex aggregations
- [ ] Database monitoring dashboard configured
- [ ] Regular VACUUM/ANALYZE scheduled (PostgreSQL)
- [ ] Database backups configured

## Related Documentation

- [Performance Benchmarks](../benchmarks/PERFORMANCE_BENCHMARKS.md)
- [Bundle Optimization](./BUNDLE_OPTIMIZATION.md)
- [CDN Configuration](../deployment/CDN_SETUP.md)
- [Monitoring Setup](../monitoring/MONITORING_SETUP.md)
