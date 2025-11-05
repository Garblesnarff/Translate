// File: tests/utils/index.ts
// Central export for all test utilities

/**
 * Mock Providers
 *
 * Usage:
 * ```typescript
 * import { MockTranslationProvider, createMockProviders } from '@/tests/utils';
 *
 * const mocks = createMockProviders();
 * const result = await mocks.translation.translate('བཀྲ་ཤིས་བདེ་ལེགས།', 'Translate this');
 * ```
 */
export {
  // Interfaces
  type EmbeddingProvider,
  type TranslationProvider,
  type TranslationResult,
  type CacheProvider,
  type StorageProvider,

  // Mock implementations
  MockEmbeddingProvider,
  MockTranslationProvider,
  MockCacheProvider,
  MockStorageProvider,

  // Factory functions
  createMockProviders,
  createSpyProviders,
} from './mocks';

/**
 * Test Fixtures
 *
 * Usage:
 * ```typescript
 * import { TestData } from '@/tests/utils';
 *
 * const tibetanText = TestData.tibetan.simple;
 * const expectedTranslation = TestData.translations.valid;
 * ```
 */
export {
  // Main test data object
  TestData,

  // Individual data categories
  TibetanText,
  ExpectedTranslations,
  TranslationResults,
  TextChunks,
  QualityScores,
  PDFFixtures,
  DictionaryEntries,
  TranslationExamples,
  ValidationErrors,
  MetadataSamples,

  // Helper functions
  createTestData,
  generateTestCases,
} from './fixtures';

/**
 * Database Utilities
 *
 * Usage:
 * ```typescript
 * import { setupTestDb, cleanupTestDb, withSeededDatabase } from '@/tests/utils';
 *
 * const db = await setupTestDb();
 * // ... use database
 * await cleanupTestDb(db);
 *
 * // Or use with auto-cleanup:
 * await withSeededDatabase(async (db) => {
 *   const results = await db.query('SELECT * FROM translations');
 *   // ...
 * });
 * ```
 */
export {
  // Classes
  TestDatabaseService,
  type TestDatabaseConfig,

  // Functions
  setupTestDb,
  cleanupTestDb,
  seedTestData,
  withTestDatabase,
  withSeededDatabase,
  cleanupAllTestDatabases,
} from './testDatabase';

/**
 * Custom Assertions
 *
 * Usage:
 * ```typescript
 * import { assertValidTranslation, assertValidTibetan } from '@/tests/utils';
 *
 * const result = await translationService.translate(text);
 * assertValidTranslation(result);
 * assertValidTibetan(result.translation);
 * ```
 */
export {
  // Translation assertions
  assertValidTranslation,
  assertValidTibetan,
  assertPreservation,
  assertProperFormat,

  // Quality assertions
  assertValidQuality,
  assertQualityThreshold,

  // Unicode and validation assertions
  assertValidUnicode,
  assertValidChunks,
  assertValidationResult,
  assertValidError,

  // Performance assertions
  assertCached,
  assertPerformance,
  assertThrowsAsync,

  // Similarity assertions
  assertSimilarEmbeddings,

  // Utility functions
  measureTime,
  cosineSimilarity,
  calculateTibetanPercentage,
  containsTibetan,
  extractTibetanFromParentheses,
} from './assertions';

/**
 * Re-export everything as a namespace for convenience
 */
import * as mocks from './mocks';
import * as fixtures from './fixtures';
import * as database from './testDatabase';
import * as assertions from './assertions';

export const TestUtils = {
  mocks,
  fixtures,
  database,
  assertions,
};

export default TestUtils;
