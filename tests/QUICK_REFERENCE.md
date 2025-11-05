# Test Utilities Quick Reference

## Import Everything
```typescript
import {
  // Mocks
  MockTranslationProvider,
  MockEmbeddingProvider,
  MockCacheProvider,
  MockStorageProvider,
  createMockProviders,

  // Fixtures
  TestData,

  // Database
  withSeededDatabase,

  // Assertions
  assertValidTranslation,
  assertValidTibetan,
  assertValidQuality,
  measureTime,
} from '@tests/utils';
```

## Common Patterns

### Test with Mock
```typescript
it('should translate', async () => {
  const provider = new MockTranslationProvider();
  const result = await provider.translate('བཀྲ་ཤིས་བདེ་ལེགས།', 'prompt');
  assertValidTranslation(result);
});
```

### Test with Fixtures
```typescript
it('should handle text', () => {
  const text = TestData.tibetan.simple;
  assertValidTibetan(text);
});
```

### Test with Database
```typescript
it('should query data', async () => {
  await withSeededDatabase(async (db) => {
    const results = await db.query('SELECT * FROM dictionary');
    expect(results.length).toBeGreaterThan(0);
  });
});
```

### Test Performance
```typescript
it('should be fast', async () => {
  const { result, duration } = await measureTime(() => fn());
  expect(duration).toBeLessThan(100);
});
```

## Key Test Data

```typescript
TestData.tibetan.simple           // 'བཀྲ་ཤིས་བདེ་ལེགས།'
TestData.tibetan.paragraph        // Multi-sentence paragraph
TestData.translations.valid       // Correct format
TestData.quality.excellent        // High quality score
TestData.dictionary.common        // Common dictionary entries
```

## Key Assertions

```typescript
assertValidTranslation(result)         // Full validation
assertValidTibetan(text, minPercent)   // Tibetan content check
assertValidQuality(score)              // Quality structure
assertQualityThreshold(score, min)     // Minimum quality
assertPreservation(orig, trans)        // Preservation check
assertPerformance(ms, expected, tol)   // Performance check
```

## Mock Configuration

```typescript
// Success mode
const provider = new MockTranslationProvider({ confidence: 0.9 });

// Failure mode
provider.setFailureMode(true);

// Custom response
provider.setCustomResponse('test', { translation: 'custom', confidence: 1, metadata: {} });

// Track calls
expect(provider.getCallCount()).toBe(1);
```

## Run Tests

```bash
npm test                    # All tests
npm run test:watch          # Watch mode
npm run test:ui             # UI mode
npm run test:coverage       # With coverage
npm test tests/examples     # Examples only
```
