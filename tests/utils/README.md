# Test Utilities

Comprehensive test utilities, mocks, and fixtures for the Tibetan Translation Tool V2.

## Overview

This directory contains all testing infrastructure needed for TDD (Test-Driven Development) throughout the project:

- **Mocks**: Mock implementations of provider interfaces
- **Fixtures**: Test data covering all edge cases
- **Database**: Test database utilities (SQLite, in-memory)
- **Assertions**: Custom assertion helpers

## Quick Start

```typescript
import {
  // Mocks
  MockTranslationProvider,
  createMockProviders,

  // Fixtures
  TestData,

  // Database
  withSeededDatabase,

  // Assertions
  assertValidTranslation,
  assertValidTibetan,
} from '@tests/utils';

describe('My Feature', () => {
  it('should translate Tibetan text', async () => {
    // Use mock provider
    const provider = new MockTranslationProvider();

    // Use test data
    const result = await provider.translate(TestData.tibetan.simple, 'Translate');

    // Use custom assertions
    assertValidTranslation(result);
  });
});
```

## Mock Providers

### Overview

Mock implementations of all provider interfaces with configurable success/failure modes.

### Available Mocks

- `MockEmbeddingProvider` - Deterministic fake embeddings
- `MockTranslationProvider` - Predictable translations
- `MockCacheProvider` - In-memory cache (no Redis needed)
- `MockStorageProvider` - In-memory database

### Usage

```typescript
import { MockTranslationProvider } from '@tests/utils';

const provider = new MockTranslationProvider({
  confidence: 0.9,
  shouldFail: false,
});

// Translate
const result = await provider.translate('བཀྲ་ཤིས་བདེ་ལེགས།', 'prompt');

// Custom responses
provider.setCustomResponse('test', {
  translation: 'Custom result',
  confidence: 0.99,
  metadata: {},
});

// Track calls
expect(provider.getCallCount()).toBe(1);

// Test failure scenarios
provider.setFailureMode(true);
await expect(provider.translate('text', 'prompt')).rejects.toThrow();
```

### Factory Functions

```typescript
import { createMockProviders, createSpyProviders } from '@tests/utils';

// Create all providers at once
const mocks = createMockProviders({
  shouldFail: false,
  embeddingDimension: 768,
  translationConfidence: 0.9,
});

// Create with Vitest spies
const spies = createSpyProviders();
await spies.translation.translate('text', 'prompt');
expect(spies.translation.translate).toHaveBeenCalledTimes(1);
```

## Test Fixtures

### Overview

Comprehensive test data covering all edge cases and complexity levels.

### Available Fixtures

```typescript
TestData.tibetan.simple         // Simple greeting
TestData.tibetan.paragraph      // Multi-sentence paragraph
TestData.tibetan.multiPage      // Multi-page document
TestData.tibetan.withSanskrit   // Buddhist terms with Sanskrit

TestData.translations.valid     // Correct format
TestData.translations.missingTibetan  // Missing preservation
TestData.translations.wrongFormat     // Incorrect format

TestData.chunks.single          // Single chunk
TestData.chunks.multiple        // Multiple chunks
TestData.chunks.withOverlap     // Chunks with overlap

TestData.quality.excellent      // High quality score
TestData.quality.good           // Good quality score
TestData.quality.poor           // Poor quality score

TestData.dictionary.common      // Common dictionary entries
TestData.dictionary.religious   // Religious terms
TestData.dictionary.technical   // Technical terms
```

### Usage

```typescript
import { TestData } from '@tests/utils';

describe('Text Processing', () => {
  it('should handle simple text', () => {
    const text = TestData.tibetan.simple;
    // Test with text...
  });

  it('should validate translation format', () => {
    const expected = TestData.translations.valid;
    // Validate against expected...
  });
});
```

### Custom Test Data

```typescript
import { createTestData, generateTestCases } from '@tests/utils';

// Override specific fields
const custom = createTestData(TestData.results.highConfidence, {
  confidence: 0.75,
  metadata: { custom: true },
});

// Generate multiple test cases
const cases = generateTestCases({ text: 'base', confidence: 0.5 }, [
  { confidence: 0.8 },
  { confidence: 0.9 },
  { text: 'different' },
]);
```

## Database Utilities

### Overview

Fast, in-memory SQLite databases for testing with automatic cleanup.

### Basic Usage

```typescript
import { setupTestDb, cleanupTestDb } from '@tests/utils';

describe('Database Tests', () => {
  let db;

  beforeEach(async () => {
    db = await setupTestDb();
  });

  afterEach(async () => {
    await cleanupTestDb(db, true); // Delete file
  });

  it('should query data', async () => {
    const results = await db.query('SELECT * FROM translations');
    expect(results).toHaveLength(0);
  });
});
```

### Auto-Cleanup Pattern

```typescript
import { withTestDatabase, withSeededDatabase } from '@tests/utils';

// Empty database with auto-cleanup
await withTestDatabase(async (db) => {
  // Database automatically cleaned up after
});

// Seeded database with auto-cleanup
await withSeededDatabase(async (db) => {
  const counts = await db.getCounts();
  expect(counts.dictionary).toBeGreaterThan(0);
});
```

### Transactions

```typescript
import { setupTestDb } from '@tests/utils';

const db = await setupTestDb();

db.beginTransaction();
await db.execute('INSERT INTO translations ...');
db.commitTransaction(); // or rollbackTransaction()
```

## Custom Assertions

### Overview

Readable, domain-specific assertions for common validation patterns.

### Translation Assertions

```typescript
import { assertValidTranslation, assertValidTibetan } from '@tests/utils';

const result = await translate('བཀྲ་ཤིས་བདེ་ལེགས།');

// Validates structure, format, confidence, and Tibetan preservation
assertValidTranslation(result);

// Validates Tibetan content percentage (default 50%)
assertValidTibetan(result.translation);
assertValidTibetan(result.translation, 70); // Custom threshold
```

### Quality Assertions

```typescript
import { assertValidQuality, assertQualityThreshold } from '@tests/utils';

const score = calculateQuality(result);

// Validates score structure and ranges
assertValidQuality(score);

// Validates minimum quality
assertQualityThreshold(score, 0.7);
```

### Preservation Assertions

```typescript
import { assertPreservation, assertProperFormat } from '@tests/utils';

// Validates Tibetan is preserved in translation
assertPreservation(original, translation);

// Validates formatting (spacing, punctuation)
assertProperFormat(translation);
```

### Cache Assertions

```typescript
import { assertCached } from '@tests/utils';

await assertCached(
  () => service.translate(text),
  () => cache.getStats()
);
```

### Performance Assertions

```typescript
import { assertPerformance, measureTime } from '@tests/utils';

const { result, duration } = await measureTime(async () => {
  return await expensiveOperation();
});

// Assert within ±50% of expected
assertPerformance(duration, 100, 0.5);
```

### Async Error Assertions

```typescript
import { assertThrowsAsync } from '@tests/utils';

await assertThrowsAsync(
  () => service.invalidOperation(),
  'Expected error message'
);
```

## Complete Example

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import {
  // Mocks
  MockTranslationProvider,
  MockCacheProvider,

  // Fixtures
  TestData,

  // Database
  withSeededDatabase,

  // Assertions
  assertValidTranslation,
  assertValidQuality,
  assertPerformance,
  measureTime,
} from '@tests/utils';

describe('Translation Service', () => {
  let provider: MockTranslationProvider;
  let cache: MockCacheProvider;

  beforeEach(() => {
    provider = new MockTranslationProvider({ confidence: 0.9 });
    cache = new MockCacheProvider();
  });

  it('should translate with caching', async () => {
    // Use fixtures
    const text = TestData.tibetan.simple;

    // Measure performance
    const { result, duration } = await measureTime(async () => {
      return await provider.translate(text, 'Translate this');
    });

    // Assert translation
    assertValidTranslation(result);

    // Assert quality
    const quality = {
      overall: result.confidence,
      confidence: result.confidence,
      format: 0.9,
      preservation: 0.85,
    };
    assertValidQuality(quality);

    // Assert performance
    assertPerformance(duration, 50, 0.5);

    // Verify cache
    const stats = cache.getStats();
    expect(stats.hits).toBeGreaterThan(0);
  });

  it('should handle database operations', async () => {
    await withSeededDatabase(async (db) => {
      const counts = await db.getCounts();
      expect(counts.dictionary).toBeGreaterThan(0);

      const entries = await db.query(
        'SELECT * FROM dictionary WHERE category = ?',
        ['religious']
      );
      expect(entries.length).toBeGreaterThan(0);
    });
  });
});
```

## Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run with UI
npm run test:ui

# Run with coverage
npm run test:coverage

# Run specific test file
npm test tests/examples/mocks.example.test.ts

# Run unit tests only
npm run test:unit

# Run integration tests only
npm run test:integration
```

## Best Practices

### 1. Use Mocks for External Dependencies

```typescript
// Good: Use mock providers
const provider = new MockTranslationProvider();

// Avoid: Using real API calls in tests
```

### 2. Use Fixtures for Consistency

```typescript
// Good: Use fixtures
const text = TestData.tibetan.simple;

// Avoid: Hardcoding test data
const text = 'བཀྲ་ཤིས་བདེ་ལེགས།';
```

### 3. Use Custom Assertions

```typescript
// Good: Use custom assertions
assertValidTranslation(result);

// Avoid: Manual validation
expect(result.translation).toBeDefined();
expect(result.confidence).toBeGreaterThan(0);
// ... many more lines
```

### 4. Use Auto-Cleanup Patterns

```typescript
// Good: Auto-cleanup
await withTestDatabase(async (db) => {
  // Test with db
});

// Avoid: Manual cleanup
const db = await setupTestDb();
// ... tests
await cleanupTestDb(db);
```

### 5. Test Edge Cases

```typescript
// Test edge cases from fixtures
TestData.tibetan.empty
TestData.tibetan.whitespace
TestData.tibetan.singleTsek
```

## Performance

- **In-memory databases**: ~1-2ms per operation
- **Mock providers**: <1ms per call
- **Fixture access**: <1ms
- **Custom assertions**: <1ms

All test utilities are optimized for speed to enable fast TDD cycles.

## Troubleshooting

### Tests failing with "Module not found"

Make sure the `@tests` alias is configured in `vitest.config.ts`:

```typescript
resolve: {
  alias: {
    '@tests': path.resolve(__dirname, 'tests'),
  },
}
```

### Database errors

Clean up stale test databases:

```typescript
import { cleanupAllTestDatabases } from '@tests/utils';
cleanupAllTestDatabases();
```

### Type errors with mocks

Ensure mock providers implement the correct interfaces from `tests/utils/mocks.ts`.

## Contributing

When adding new test utilities:

1. Add the utility to the appropriate file (`mocks.ts`, `fixtures.ts`, etc.)
2. Export it from `index.ts`
3. Add an example test in `tests/examples/`
4. Update this README
5. Ensure TypeScript types are correct

## Next Steps

See the implementation examples in:
- `tests/examples/mocks.example.test.ts`
- `tests/examples/fixtures.example.test.ts`
- `tests/examples/database.example.test.ts`
- `tests/examples/assertions.example.test.ts`
