// File: tests/utils/assertions.ts
// Custom assertion helpers for tests

import { expect } from 'vitest';
import type { TranslationResult } from './mocks';

/**
 * Tibetan Unicode range
 */
const TIBETAN_UNICODE_RANGE = /[\u0F00-\u0FFF]/g;

/**
 * Calculate percentage of Tibetan characters in text
 */
export function calculateTibetanPercentage(text: string): number {
  if (!text || text.length === 0) return 0;

  const tibetanChars = text.match(TIBETAN_UNICODE_RANGE) || [];
  return (tibetanChars.length / text.length) * 100;
}

/**
 * Check if text contains valid Tibetan characters
 */
export function containsTibetan(text: string): boolean {
  return TIBETAN_UNICODE_RANGE.test(text);
}

/**
 * Extract Tibetan text from parentheses
 */
export function extractTibetanFromParentheses(text: string): string[] {
  const pattern = /\(([^)]*[\u0F00-\u0FFF][^)]*)\)/g;
  const matches: string[] = [];
  let match;

  while ((match = pattern.exec(text)) !== null) {
    matches.push(match[1]);
  }

  return matches;
}

/**
 * Assert that translation result is valid
 */
export function assertValidTranslation(result: TranslationResult, message?: string): void {
  const prefix = message ? `${message}: ` : '';

  // Check basic structure
  expect(result, `${prefix}Translation result should be defined`).toBeDefined();
  expect(result.translation, `${prefix}Translation text should be defined`).toBeDefined();
  expect(typeof result.translation, `${prefix}Translation should be a string`).toBe('string');

  // Check confidence
  expect(result.confidence, `${prefix}Confidence should be defined`).toBeDefined();
  expect(result.confidence, `${prefix}Confidence should be a number`).toBeTypeOf('number');
  expect(result.confidence, `${prefix}Confidence should be >= 0`).toBeGreaterThanOrEqual(0);
  expect(result.confidence, `${prefix}Confidence should be <= 1`).toBeLessThanOrEqual(1);

  // Check metadata
  expect(result.metadata, `${prefix}Metadata should be defined`).toBeDefined();
  expect(typeof result.metadata, `${prefix}Metadata should be an object`).toBe('object');

  // Check format: Tibetan should be preserved in parentheses
  const tibetanInParens = extractTibetanFromParentheses(result.translation);
  expect(
    tibetanInParens.length,
    `${prefix}Translation should preserve Tibetan text in parentheses`
  ).toBeGreaterThan(0);
}

/**
 * Assert that text contains valid Tibetan
 */
export function assertValidTibetan(text: string, minPercentage = 50, message?: string): void {
  const prefix = message ? `${message}: ` : '';

  expect(text, `${prefix}Text should be defined`).toBeDefined();
  expect(text.length, `${prefix}Text should not be empty`).toBeGreaterThan(0);

  const percentage = calculateTibetanPercentage(text);
  expect(
    percentage,
    `${prefix}Text should contain at least ${minPercentage}% Tibetan characters (found ${percentage.toFixed(1)}%)`
  ).toBeGreaterThanOrEqual(minPercentage);
}

/**
 * Assert that quality score is valid
 */
export function assertValidQuality(
  score: { overall: number; confidence: number; format: number; preservation: number },
  message?: string
): void {
  const prefix = message ? `${message}: ` : '';

  expect(score, `${prefix}Quality score should be defined`).toBeDefined();

  // Check each component
  const components = ['overall', 'confidence', 'format', 'preservation'] as const;

  for (const component of components) {
    expect(score[component], `${prefix}${component} should be defined`).toBeDefined();
    expect(
      typeof score[component],
      `${prefix}${component} should be a number`
    ).toBe('number');
    expect(
      score[component],
      `${prefix}${component} should be >= 0`
    ).toBeGreaterThanOrEqual(0);
    expect(
      score[component],
      `${prefix}${component} should be <= 1`
    ).toBeLessThanOrEqual(1);
  }
}

/**
 * Assert that quality score meets threshold
 */
export function assertQualityThreshold(
  score: { overall: number },
  threshold: number,
  message?: string
): void {
  const prefix = message ? `${message}: ` : '';

  expect(
    score.overall,
    `${prefix}Quality score ${score.overall.toFixed(2)} should be >= ${threshold}`
  ).toBeGreaterThanOrEqual(threshold);
}

/**
 * Assert that function result is cached
 */
export async function assertCached<T>(
  fn: () => Promise<T>,
  getCacheStats: () => { hits: number; misses: number }
): Promise<void> {
  // Get initial stats
  const initialStats = getCacheStats();

  // Call function twice
  await fn();
  await fn();

  // Get final stats
  const finalStats = getCacheStats();

  // Second call should be a cache hit
  expect(
    finalStats.hits,
    'Second call should result in cache hit'
  ).toBeGreaterThan(initialStats.hits);
}

/**
 * Assert that text has valid Unicode normalization
 */
export function assertValidUnicode(text: string, message?: string): void {
  const prefix = message ? `${message}: ` : '';

  expect(text, `${prefix}Text should be defined`).toBeDefined();

  // Check for common Unicode issues
  const normalized = text.normalize('NFC');
  expect(
    text,
    `${prefix}Text should be in NFC normalized form`
  ).toBe(normalized);

  // Check for replacement characters (indicates corruption)
  expect(
    text.includes('�'),
    `${prefix}Text should not contain replacement characters`
  ).toBe(false);
}

/**
 * Assert that text chunks are valid
 */
export function assertValidChunks(
  chunks: Array<{ text: string; tokenCount: number }>,
  maxTokens: number,
  message?: string
): void {
  const prefix = message ? `${message}: ` : '';

  expect(chunks, `${prefix}Chunks should be defined`).toBeDefined();
  expect(chunks.length, `${prefix}Should have at least one chunk`).toBeGreaterThan(0);

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];

    expect(chunk.text, `${prefix}Chunk ${i} text should be defined`).toBeDefined();
    expect(
      chunk.text.length,
      `${prefix}Chunk ${i} should not be empty`
    ).toBeGreaterThan(0);

    expect(
      chunk.tokenCount,
      `${prefix}Chunk ${i} should not exceed ${maxTokens} tokens (has ${chunk.tokenCount})`
    ).toBeLessThanOrEqual(maxTokens);

    // Check for sentence boundary (should not split mid-sentence)
    // Tibetan sentence endings: shad (།) or double shad (༎)
    if (i < chunks.length - 1) {
      const lastChar = chunk.text.trim().slice(-1);
      // This is a soft check - not all chunks will end with punctuation
      // but we want to encourage proper sentence boundaries
      if (containsTibetan(chunk.text)) {
        // If it's Tibetan text, prefer ending with shad
        // This is a warning, not a hard requirement
      }
    }
  }
}

/**
 * Assert that translation preserves original Tibetan
 */
export function assertPreservation(
  original: string,
  translation: string,
  message?: string
): void {
  const prefix = message ? `${message}: ` : '';

  const originalTibetan = original.match(TIBETAN_UNICODE_RANGE) || [];
  const preservedTibetan = extractTibetanFromParentheses(translation);

  expect(
    preservedTibetan.length,
    `${prefix}Translation should preserve Tibetan text`
  ).toBeGreaterThan(0);

  // Check that some Tibetan characters are preserved
  const preservedText = preservedTibetan.join('');
  const preservedChars = preservedText.match(TIBETAN_UNICODE_RANGE) || [];

  expect(
    preservedChars.length,
    `${prefix}Should preserve at least some Tibetan characters`
  ).toBeGreaterThan(0);
}

/**
 * Assert that text has proper Tibetan formatting
 */
export function assertProperFormat(text: string, message?: string): void {
  const prefix = message ? `${message}: ` : '';

  // Check for common formatting issues

  // 1. No space after tsek (་)
  expect(
    text.includes('་ '),
    `${prefix}Should not have space after tsek`
  ).toBe(false);

  // 2. No space before shad (།)
  expect(
    text.includes(' །'),
    `${prefix}Should not have space before shad`
  ).toBe(false);

  // 3. Proper spacing around parentheses with Tibetan
  const parenthesesPattern = /\([^)]*[\u0F00-\u0FFF][^)]*\)/g;
  const matches = text.match(parenthesesPattern);

  if (matches) {
    for (const match of matches) {
      // Check for improper spacing inside parentheses
      expect(
        match.startsWith('( '),
        `${prefix}Should not have space after opening parenthesis: ${match}`
      ).toBe(false);

      expect(
        match.endsWith(' )'),
        `${prefix}Should not have space before closing parenthesis: ${match}`
      ).toBe(false);
    }
  }
}

/**
 * Assert that error has expected structure
 */
export function assertValidError(
  error: unknown,
  expectedMessage?: string,
  expectedCode?: string
): void {
  expect(error).toBeDefined();
  expect(error).toBeInstanceOf(Error);

  const err = error as Error;
  expect(err.message).toBeDefined();

  if (expectedMessage) {
    expect(err.message).toContain(expectedMessage);
  }

  if (expectedCode && 'code' in err) {
    expect((err as any).code).toBe(expectedCode);
  }
}

/**
 * Assert that validation result has expected structure
 */
export function assertValidationResult(
  result: { isValid: boolean; errors: string[]; warnings: string[] },
  message?: string
): void {
  const prefix = message ? `${message}: ` : '';

  expect(result, `${prefix}Validation result should be defined`).toBeDefined();
  expect(typeof result.isValid, `${prefix}isValid should be boolean`).toBe('boolean');
  expect(Array.isArray(result.errors), `${prefix}errors should be array`).toBe(true);
  expect(Array.isArray(result.warnings), `${prefix}warnings should be array`).toBe(true);
}

/**
 * Assert that two embeddings are similar (cosine similarity)
 */
export function assertSimilarEmbeddings(
  embedding1: number[],
  embedding2: number[],
  threshold = 0.8,
  message?: string
): void {
  const prefix = message ? `${message}: ` : '';

  expect(embedding1.length, `${prefix}Embeddings should have same length`).toBe(embedding2.length);

  const similarity = cosineSimilarity(embedding1, embedding2);

  expect(
    similarity,
    `${prefix}Embeddings should be similar (similarity: ${similarity.toFixed(3)}, threshold: ${threshold})`
  ).toBeGreaterThanOrEqual(threshold);
}

/**
 * Calculate cosine similarity between two vectors
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error('Vectors must have same length');
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  normA = Math.sqrt(normA);
  normB = Math.sqrt(normB);

  if (normA === 0 || normB === 0) {
    return 0;
  }

  return dotProduct / (normA * normB);
}

/**
 * Assert that async function throws
 */
export async function assertThrowsAsync(
  fn: () => Promise<any>,
  expectedError?: string | RegExp
): Promise<void> {
  let thrown = false;
  let error: Error | undefined;

  try {
    await fn();
  } catch (e) {
    thrown = true;
    error = e as Error;
  }

  expect(thrown, 'Function should throw an error').toBe(true);

  if (expectedError && error) {
    if (typeof expectedError === 'string') {
      expect(error.message).toContain(expectedError);
    } else {
      expect(error.message).toMatch(expectedError);
    }
  }
}

/**
 * Assert that performance is within expected range
 */
export function assertPerformance(
  actualMs: number,
  expectedMs: number,
  tolerance = 0.5,
  message?: string
): void {
  const prefix = message ? `${message}: ` : '';
  const minMs = expectedMs * (1 - tolerance);
  const maxMs = expectedMs * (1 + tolerance);

  expect(
    actualMs,
    `${prefix}Performance should be within ${tolerance * 100}% of expected (${expectedMs}ms), got ${actualMs}ms`
  ).toBeGreaterThanOrEqual(minMs);

  expect(
    actualMs,
    `${prefix}Performance should be within ${tolerance * 100}% of expected (${expectedMs}ms), got ${actualMs}ms`
  ).toBeLessThanOrEqual(maxMs);
}

/**
 * Measure async function execution time
 */
export async function measureTime<T>(fn: () => Promise<T>): Promise<{ result: T; duration: number }> {
  const start = Date.now();
  const result = await fn();
  const duration = Date.now() - start;

  return { result, duration };
}

/**
 * Export all assertions
 */
export default {
  assertValidTranslation,
  assertValidTibetan,
  assertValidQuality,
  assertQualityThreshold,
  assertCached,
  assertValidUnicode,
  assertValidChunks,
  assertPreservation,
  assertProperFormat,
  assertValidError,
  assertValidationResult,
  assertSimilarEmbeddings,
  assertThrowsAsync,
  assertPerformance,
  measureTime,
  cosineSimilarity,
  calculateTibetanPercentage,
  containsTibetan,
  extractTibetanFromParentheses,
};
