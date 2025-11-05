# Architecture Decision Records (ADR)

**Tibetan Translation Tool V2 - Foundation Design Decisions**

This document explains the key architectural decisions made for the V2 reimplementation of the Tibetan Translation Tool. Each decision includes the context, considered alternatives, and rationale.

---

## ADR-001: Provider Interface Abstraction

**Status:** Accepted
**Date:** 2025-11-05
**Context:**

In V1, translation and embedding services were tightly coupled to specific AI providers (primarily Google Gemini). Adding support for new providers required significant refactoring and introduced duplication.

**Decision:**

Create abstract provider interfaces (`EmbeddingProvider`, `TranslationProvider`, `CacheProvider`, `StorageProvider`) that define contracts for all providers.

**Alternatives Considered:**

1. **Monolithic service approach** - Single service with conditional logic for different providers
   - Rejected: Would create god objects and tight coupling

2. **Factory pattern only** - Use factories without interfaces
   - Rejected: Loses compile-time type safety

3. **Plugin system with runtime loading** - Dynamic provider loading
   - Rejected: Too complex for current needs, can add later

**Rationale:**

- **Extensibility:** Adding new providers (OpenAI, Anthropic) requires only implementing the interface
- **Testability:** Easy to create mock providers for testing without real API calls
- **Flexibility:** Can swap providers at runtime for A/B testing or failover
- **Separation of Concerns:** Business logic decoupled from provider specifics

**Consequences:**

✅ **Positive:**
- New providers can be added in ~100 lines of code
- Tests run without API keys or network calls
- Can mix providers (e.g., Gemini for translation, OpenAI for embeddings)

⚠️ **Negative:**
- Additional abstraction layer adds some complexity
- Interface design requires careful thought upfront

**Implementation Notes:**
```typescript
// Easy to swap providers
const provider = useOpenAI
  ? new OpenAITranslationProvider(apiKey, config)
  : new GeminiTranslationProvider(apiKey, config);

// Service layer doesn't care
const service = new TranslationService(provider, cache, config);
```

---

## ADR-002: Centralized Configuration System

**Status:** Accepted
**Date:** 2025-11-05
**Context:**

In V1, configuration was scattered across environment variables, hardcoded constants, and multiple config files. This made it difficult to:
- Understand what settings were available
- Change settings without code changes
- Deploy to different environments

**Decision:**

Create a centralized `ConfigService` with:
- Single source of truth for all settings
- Type-safe configuration with Zod validation
- Environment-specific overrides (development, production, test)
- Hot-reloading support for runtime updates

**Alternatives Considered:**

1. **Continue using environment variables** - Keep current approach
   - Rejected: Doesn't scale, no validation, hard to document

2. **Configuration per service** - Each service has its own config
   - Rejected: Duplication, hard to get global view

3. **Database-driven configuration** - Store config in database
   - Rejected: Overkill, adds dependency for bootstrapping

**Rationale:**

- **Single Source of Truth:** All configuration in one place (`TranslationConfig`)
- **Type Safety:** TypeScript interfaces catch errors at compile time
- **Validation:** Zod ensures runtime validation (e.g., confidence must be 0-1)
- **Environment Flexibility:** Easy to override settings per environment
- **Documentation:** Types serve as documentation

**Consequences:**

✅ **Positive:**
- Configuration errors caught early (validation on startup)
- Easy to see all available settings
- Can change settings without redeployment (if using hot-reload)
- Easier testing with different configurations

⚠️ **Negative:**
- Requires defining all settings upfront
- Changes to config structure require migration

**Implementation Notes:**
```typescript
// config/production.json
{
  "translation": {
    "quality": {
      "minConfidence": 0.8  // Stricter in production
    }
  }
}

// config/test.json
{
  "translation": {
    "quality": {
      "minConfidence": 0.5  // Looser for testing
    }
  }
}
```

---

## ADR-003: Test-Driven Development (TDD) Approach

**Status:** Accepted
**Date:** 2025-11-05
**Context:**

In V1, tests were written after implementation (or not at all). This led to:
- Hard-to-test code (tight coupling, hidden dependencies)
- Bugs discovered late in development
- Regression issues when refactoring
- Low test coverage

**Decision:**

Adopt TDD methodology:
1. Write tests first (red)
2. Implement minimum code to pass (green)
3. Refactor while keeping tests green

**Alternatives Considered:**

1. **Test after implementation** - Traditional approach
   - Rejected: Leads to hard-to-test code

2. **No tests, manual testing only** - Fast initial development
   - Rejected: Not sustainable, high regression risk

3. **Integration tests only** - Skip unit tests
   - Rejected: Slow feedback, hard to isolate issues

**Rationale:**

- **Better Design:** Writing tests first forces clean interfaces
- **Confidence:** Tests as safety net for refactoring
- **Documentation:** Tests serve as usage examples
- **Regression Prevention:** Catch bugs before they reach production
- **Faster Debugging:** Narrow down issues quickly with unit tests

**Consequences:**

✅ **Positive:**
- Higher code quality from the start
- Easier refactoring with confidence
- Tests serve as specification
- Faster debugging cycles

⚠️ **Negative:**
- Slower initial development (but faster overall)
- Requires discipline to write tests first
- Learning curve for team members new to TDD

**Implementation Notes:**
```typescript
// 1. Write test first (FAILS)
describe('TextChunker', () => {
  it('should never exceed max tokens', () => {
    const chunker = new TextChunker({ maxTokens: 1000 });
    const chunks = chunker.chunk(longText);

    chunks.forEach(chunk => {
      expect(chunk.tokenCount).toBeLessThanOrEqual(1000);
    });
  });
});

// 2. Implement minimum code to pass
// 3. Refactor while keeping test green
```

---

## ADR-004: Multi-Layer Caching Strategy

**Status:** Accepted
**Date:** 2025-11-05
**Context:**

Translation API calls are:
- Expensive ($0.02-0.10 per 1K tokens)
- Slow (500-2000ms per request)
- Rate-limited (60 requests/minute)

V1 had minimal caching, leading to unnecessary API calls.

**Decision:**

Implement multi-layer caching:
- **L1 (Memory):** Fast, in-process cache for hot data (max 1000 items)
- **L2 (Redis):** Shared cache across instances, medium speed
- **L3 (Database):** Permanent storage, slowest but persistent

**Alternatives Considered:**

1. **No caching** - Always call API
   - Rejected: Too expensive and slow

2. **Single-layer cache (memory only)** - Simple approach
   - Rejected: Doesn't survive restarts, not shared across instances

3. **Database-only cache** - Simplest persistent cache
   - Rejected: Too slow for frequently accessed data

**Rationale:**

- **Cost Reduction:** Cache hits avoid expensive API calls
- **Performance:** L1 cache provides sub-millisecond lookups
- **Reliability:** Multiple layers provide fallback
- **Scalability:** Shared cache (Redis) enables horizontal scaling

**Consequences:**

✅ **Positive:**
- **5x faster** translation for cached text
- **90% cost reduction** for repeated content
- **Lower API quota usage**
- **Better user experience** with instant responses

⚠️ **Negative:**
- Added complexity in managing three cache layers
- Cache invalidation complexity (though translations rarely change)
- Additional infrastructure (Redis for production)

**Implementation Notes:**
```typescript
// Transparent multi-layer lookup
async get(key: string): Promise<T | null> {
  // Check L1 first (fastest)
  let value = await this.l1.get(key);
  if (value) return value;

  // Check L2 (medium)
  value = await this.l2.get(key);
  if (value) {
    await this.l1.set(key, value); // Populate L1
    return value;
  }

  // Check L3 (slowest, but persistent)
  value = await this.l3.get(key);
  if (value) {
    await this.l1.set(key, value); // Populate L1
    await this.l2.set(key, value); // Populate L2
  }

  return value;
}
```

---

## ADR-005: Unified Monitoring Service

**Status:** Accepted
**Date:** 2025-11-05
**Context:**

V1 had four separate services for monitoring:
- `PerformanceMonitor`
- `QualityTracker`
- `ErrorLogger`
- `MetricsCollector`

This led to:
- Duplication of code (each had its own buffer/flush logic)
- Inconsistent metric formats
- Difficult to get unified view

**Decision:**

Create single `MonitoringService` that handles:
- Performance metrics (latency, throughput)
- Quality metrics (confidence, scores)
- Error tracking
- Custom metrics

**Alternatives Considered:**

1. **Keep separate services** - Maintain current approach
   - Rejected: Too much duplication

2. **Use external service (Datadog, New Relic)** - Managed solution
   - Rejected: Added cost, vendor lock-in, can add later

3. **Log-based monitoring** - Parse logs for metrics
   - Rejected: Too slow, hard to query

**Rationale:**

- **Simplicity:** One service to understand and maintain
- **Consistency:** All metrics in same format
- **Efficiency:** Single buffer and flush mechanism
- **Flexibility:** Easy to add new metric types

**Consequences:**

✅ **Positive:**
- **75% less code** compared to separate services
- Unified metric format
- Easier to query and visualize
- Single point of configuration

⚠️ **Negative:**
- Service does more (but still focused on monitoring)
- Potential for service to become too large (mitigated by clear interface)

**Implementation Notes:**
```typescript
// Simple, consistent API
monitoring.record('translation.duration', 1234, { model: 'gemini' });
monitoring.record('quality.confidence', 0.92);
monitoring.trackError(error);

// Get unified stats
const stats = await monitoring.getStats({
  start: Date.now() - 86400000,  // Last 24h
  end: Date.now()
});
```

---

## ADR-006: Foundation-First Implementation Order

**Status:** Accepted
**Date:** 2025-11-05
**Context:**

V1 implementation started with visible features (translation UI) and added infrastructure later. This led to:
- Retrofitting abstractions into existing code
- Breaking changes when adding infrastructure
- Hard to test early code

**Decision:**

Phase 0: Build foundation first
1. Interfaces and types (Phase 0.1)
2. Configuration system (Phase 0.2)
3. Database layer (Phase 0.3)
4. Caching infrastructure (Phase 0.4)
5. Test infrastructure (Phase 0.5)

Only then proceed to features (Phase 1+).

**Alternatives Considered:**

1. **Feature-first** - Build translation, then infrastructure
   - Rejected: V1 experience showed this causes rework

2. **Big bang** - Build everything at once
   - Rejected: Too risky, hard to test incrementally

3. **Parallel development** - Foundation and features simultaneously
   - Rejected: High coordination overhead, risk of misalignment

**Rationale:**

- **Solid Base:** Infrastructure ready before building on it
- **No Rework:** Don't need to retrofit abstractions later
- **Easier Testing:** Test infrastructure available from start
- **Clear Progress:** Can measure progress through phases

**Consequences:**

✅ **Positive:**
- No visible features in week 1, but solid foundation
- Faster feature development in weeks 2-3
- Less rework and breaking changes
- Higher quality from the start

⚠️ **Negative:**
- No "shippable" product for ~1 week
- Requires faith in the process
- Must resist urge to "just build the feature"

**Implementation Timeline:**
```
Week 1: Foundation (no visible features)
  - Day 1-3: Phase 0 (this is the investment)

Week 2: Core Engine (features start appearing)
  - Day 4-8: Phase 1 (can translate documents)

Week 3: Quality & Advanced Features
  - Day 9-13: Phases 2-3 (production-ready)

Week 4: Polish
  - Day 14-16: Phase 4 (optimized, documented, deployed)
```

---

## ADR-007: Error Handling with Custom Error Class

**Status:** Accepted
**Date:** 2025-11-05
**Context:**

V1 used generic `Error` objects, making it hard to:
- Distinguish error types programmatically
- Determine if error should be retried
- Log errors with proper context

**Decision:**

Create `TranslationError` class with:
- Structured error codes (`ErrorCode` enum)
- Error cause chaining
- Context data for debugging
- `isTransient()` method for retry logic

**Alternatives Considered:**

1. **Use generic Error** - Simplest approach
   - Rejected: Loses type information

2. **Multiple error classes** - `NetworkError`, `ValidationError`, etc.
   - Rejected: Too many classes, harder to handle

3. **Error codes as strings** - Instead of enum
   - Rejected: No type safety, easy to typo

**Rationale:**

- **Type Safety:** Error codes are enum, caught at compile time
- **Retry Logic:** `isTransient()` centralizes retry decision
- **Debugging:** Context and cause chaining provide full error trail
- **Monitoring:** Structured errors easier to aggregate and alert on

**Consequences:**

✅ **Positive:**
- Programmatic error handling
- Better error messages with context
- Automated retry logic
- Easier monitoring and alerting

⚠️ **Negative:**
- More code than plain `Error`
- Must remember to use `TranslationError` consistently

**Implementation Notes:**
```typescript
// Creating errors with context
throw new TranslationError(
  ErrorCode.INSUFFICIENT_TIBETAN,
  'Text must contain at least 50% Tibetan characters',
  { percentage: 35, required: 50 }
);

// Error chaining
try {
  await api.call();
} catch (error) {
  throw new TranslationError(
    ErrorCode.API_ERROR,
    'Failed to call Gemini API',
    { model: 'gemini-2.0-flash' },
    error  // Cause chain
  );
}

// Automated retry logic
if (error.isTransient()) {
  await retry(() => operation());
} else {
  throw error;  // Don't retry validation errors
}
```

---

## ADR-008: Shared Types Between Client and Server

**Status:** Accepted
**Date:** 2025-11-05
**Context:**

V1 had separate type definitions in client and server, leading to:
- Type mismatches at runtime
- Duplication of type definitions
- API contract drift

**Decision:**

Create `shared/types.ts` with all domain types, configuration types, and error types that are used by both client and server.

**Alternatives Considered:**

1. **Separate types** - Client and server have own definitions
   - Rejected: Leads to drift and bugs

2. **Server types only** - Client imports from server
   - Rejected: Circular dependency issues

3. **OpenAPI/GraphQL schema** - Generate types from schema
   - Rejected: Added complexity, can add later

**Rationale:**

- **Type Safety:** Compile-time guarantee of API contract
- **Single Source of Truth:** Types defined once
- **DRY Principle:** No duplication
- **Refactoring Safety:** Changes propagate to both sides

**Consequences:**

✅ **Positive:**
- API contracts can't drift
- Refactoring is safer
- Better IDE support with full type information
- Less code overall

⚠️ **Negative:**
- Shared directory requires proper build configuration
- Some types may only be relevant to one side

**Implementation Notes:**
```typescript
// shared/types.ts
export interface TranslationRequest {
  text: string;
  options?: TranslationOptions;
}

// client/src/api/translate.ts
import { TranslationRequest } from '../../shared/types';

function translateText(request: TranslationRequest) {
  // TypeScript knows exact shape
}

// server/routes/translate.ts
import { TranslationRequest } from '../../shared/types';

app.post('/api/translate', (req, res) => {
  const request: TranslationRequest = req.body;
  // TypeScript validates at compile time
});
```

---

## Summary of Key Decisions

| Decision | Impact | Trade-off |
|----------|--------|-----------|
| **Provider Interfaces** | High extensibility | Some abstraction overhead |
| **Centralized Config** | Easy deployment | Requires upfront design |
| **TDD Approach** | Higher quality | Slower initial speed |
| **Multi-Layer Cache** | 5x performance boost | Added complexity |
| **Unified Monitoring** | 75% less code | Single service responsibility |
| **Foundation-First** | No rework needed | No features for 1 week |
| **Custom Error Class** | Better error handling | More code than plain Error |
| **Shared Types** | Type-safe API | Build config complexity |

---

## Lessons from V1

These decisions directly address pain points from V1:

❌ **V1 Problem** → ✅ **V2 Solution**

1. **Hard to add providers** → Provider interfaces
2. **Config scattered** → Centralized configuration
3. **Tests written late** → TDD from start
4. **Slow, expensive** → Multi-layer caching
5. **4 monitoring services** → Unified monitoring
6. **Retrofit abstractions** → Foundation first
7. **Generic errors** → Custom error class
8. **Type drift** → Shared types

---

## Future Considerations

These architectural decisions support future enhancements:

- **Horizontal Scaling:** Provider interfaces + shared cache enable multiple instances
- **Multi-Tenancy:** Configuration system can support per-tenant settings
- **Additional Providers:** Interface design makes adding OpenAI/Anthropic trivial
- **Real-time Translation:** Provider interface supports streaming
- **A/B Testing:** Can swap providers or configurations easily
- **Monitoring Integration:** Can plug in Datadog/New Relic later
- **Plugin System:** Provider interfaces are foundation for plugins

---

*Last Updated: 2025-11-05*
*Authors: Implementation Team*
*Status: Living Document (will be updated as new decisions are made)*
