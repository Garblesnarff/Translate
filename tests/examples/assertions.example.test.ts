// File: tests/examples/assertions.example.test.ts
// Example tests demonstrating custom assertions

import { describe, it, expect } from 'vitest';
import {
  assertValidTranslation,
  assertValidTibetan,
  assertValidQuality,
  assertQualityThreshold,
  assertValidUnicode,
  assertValidChunks,
  assertPreservation,
  assertProperFormat,
  assertSimilarEmbeddings,
  assertThrowsAsync,
  assertPerformance,
  measureTime,
  cosineSimilarity,
  calculateTibetanPercentage,
  containsTibetan,
  extractTibetanFromParentheses,
  TestData,
  MockTranslationProvider,
  MockCacheProvider,
} from '../utils';

describe('Custom Assertions Examples', () => {
  describe('Translation Assertions', () => {
    it('should validate correct translation format', () => {
      const result = {
        translation: 'Greetings (བཀྲ་ཤིས་བདེ་ལེགས།). Welcome.',
        confidence: 0.85,
        metadata: { model: 'test' },
      };

      // This should pass
      assertValidTranslation(result);
    });

    it('should detect invalid translation', () => {
      const invalidResult = {
        translation: 'No Tibetan here',
        confidence: 0.85,
        metadata: {},
      };

      // This should fail
      expect(() => assertValidTranslation(invalidResult)).toThrow();
    });

    it('should validate Tibetan text content', () => {
      const tibetanText = 'བཀྲ་ཤིས་བདེ་ལེགས། ང་བོད་པ་ཡིན།';

      // Should pass - high percentage of Tibetan
      assertValidTibetan(tibetanText);

      // Custom threshold
      assertValidTibetan(tibetanText, 70);
    });

    it('should detect low Tibetan content', () => {
      const mixedText = 'This is mostly English with little Tibetan: བོད';

      // Should fail with default 50% threshold
      expect(() => assertValidTibetan(mixedText)).toThrow();
    });
  });

  describe('Quality Assertions', () => {
    it('should validate quality score structure', () => {
      const score = {
        overall: 0.85,
        confidence: 0.88,
        format: 0.90,
        preservation: 0.78,
      };

      // Should pass
      assertValidQuality(score);
    });

    it('should check quality thresholds', () => {
      const goodScore = { overall: 0.85 };
      const poorScore = { overall: 0.45 };

      // Should pass
      assertQualityThreshold(goodScore, 0.7);

      // Should fail
      expect(() => assertQualityThreshold(poorScore, 0.7)).toThrow();
    });
  });

  describe('Unicode Assertions', () => {
    it('should validate Unicode normalization', () => {
      const normalizedText = 'བཀྲ་ཤིས་བདེ་ལེགས།'.normalize('NFC');

      // Should pass
      assertValidUnicode(normalizedText);
    });

    it('should detect corruption', () => {
      const corruptedText = 'Text with replacement char: �';

      // Should fail
      expect(() => assertValidUnicode(corruptedText)).toThrow();
    });
  });

  describe('Chunk Assertions', () => {
    it('should validate text chunks', () => {
      const chunks = [
        { text: 'First chunk', tokenCount: 50 },
        { text: 'Second chunk', tokenCount: 75 },
        { text: 'Third chunk', tokenCount: 100 },
      ];

      // Should pass - all under 200 tokens
      assertValidChunks(chunks, 200);
    });

    it('should detect chunks exceeding max tokens', () => {
      const chunks = [
        { text: 'Short chunk', tokenCount: 50 },
        { text: 'Very long chunk', tokenCount: 250 },
      ];

      // Should fail - second chunk exceeds 200 tokens
      expect(() => assertValidChunks(chunks, 200)).toThrow();
    });
  });

  describe('Preservation Assertions', () => {
    it('should verify Tibetan preservation', () => {
      const original = 'བཀྲ་ཤིས་བདེ་ལེགས།';
      const translation = 'Greetings (བཀྲ་ཤིས་བདེ་ལེགས།).';

      // Should pass
      assertPreservation(original, translation);
    });

    it('should detect missing preservation', () => {
      const original = 'བཀྲ་ཤིས་བདེ་ལེགས།';
      const translation = 'Greetings.';

      // Should fail - no preserved Tibetan
      expect(() => assertPreservation(original, translation)).toThrow();
    });
  });

  describe('Format Assertions', () => {
    it('should validate proper Tibetan formatting', () => {
      const wellFormatted = 'Text (བོད་ཡིག) with proper spacing.';

      // Should pass
      assertProperFormat(wellFormatted);
    });

    it('should detect formatting issues', () => {
      const poorlyFormatted = 'Text ( བོད་ཡིག ) with spaces.';

      // Should fail - spaces inside parentheses
      expect(() => assertProperFormat(poorlyFormatted)).toThrow();
    });
  });

  describe('Similarity Assertions', () => {
    it('should compare embedding similarity', () => {
      const embedding1 = Array(768)
        .fill(0)
        .map((_, i) => Math.sin(i));
      const embedding2 = Array(768)
        .fill(0)
        .map((_, i) => Math.sin(i) * 0.95); // Very similar

      // Should pass - high similarity
      assertSimilarEmbeddings(embedding1, embedding2, 0.9);
    });

    it('should detect dissimilar embeddings', () => {
      const embedding1 = Array(768)
        .fill(0)
        .map(() => Math.random());
      const embedding2 = Array(768)
        .fill(0)
        .map(() => Math.random());

      // Should fail - random embeddings unlikely to be similar
      expect(() => assertSimilarEmbeddings(embedding1, embedding2, 0.9)).toThrow();
    });

    it('should calculate cosine similarity', () => {
      const vec1 = [1, 0, 0];
      const vec2 = [0, 1, 0];
      const vec3 = [1, 0, 0];

      expect(cosineSimilarity(vec1, vec2)).toBeCloseTo(0, 1); // Orthogonal
      expect(cosineSimilarity(vec1, vec3)).toBeCloseTo(1, 1); // Identical
    });
  });

  describe('Async Error Assertions', () => {
    it('should assert async function throws', async () => {
      const failingFunction = async () => {
        throw new Error('Expected error');
      };

      // Should pass
      await assertThrowsAsync(failingFunction, 'Expected error');
    });

    it('should fail when async function does not throw', async () => {
      const successFunction = async () => {
        return 'success';
      };

      // Should fail
      await expect(assertThrowsAsync(successFunction)).rejects.toThrow();
    });
  });

  describe('Performance Assertions', () => {
    it('should measure execution time', async () => {
      const { result, duration } = await measureTime(async () => {
        await new Promise(resolve => setTimeout(resolve, 50));
        return 'done';
      });

      expect(result).toBe('done');
      expect(duration).toBeGreaterThan(40);
      expect(duration).toBeLessThan(100);
    });

    it('should assert performance within tolerance', async () => {
      const { duration } = await measureTime(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
      });

      // Should pass - 100ms ± 50% tolerance
      assertPerformance(duration, 100, 0.5);
    });

    it('should detect performance outside tolerance', () => {
      // Should fail - too far from expected
      expect(() => assertPerformance(200, 100, 0.2)).toThrow();
    });
  });

  describe('Utility Functions', () => {
    it('should calculate Tibetan percentage', () => {
      const text = 'བཀྲ་ཤིས་ hello world';
      const percentage = calculateTibetanPercentage(text);

      expect(percentage).toBeGreaterThan(0);
      expect(percentage).toBeLessThan(100);
    });

    it('should check if text contains Tibetan', () => {
      expect(containsTibetan('བཀྲ་ཤིས་བདེ་ལེགས།')).toBe(true);
      expect(containsTibetan('Hello world')).toBe(false);
      expect(containsTibetan('Mixed བོད text')).toBe(true);
    });

    it('should extract Tibetan from parentheses', () => {
      const text = 'Greetings (བཀྲ་ཤིས་བདེ་ལེགས།). Welcome (དགའ་བསུ།).';
      const extracted = extractTibetanFromParentheses(text);

      expect(extracted).toHaveLength(2);
      expect(extracted[0]).toBe('བཀྲ་ཤིས་བདེ་ལེགས།');
      expect(extracted[1]).toBe('དགའ་བསུ།');
    });
  });

  describe('Real-World Usage Examples', () => {
    it('should validate complete translation workflow', async () => {
      const provider = new MockTranslationProvider({ confidence: 0.9 });

      // Measure translation time
      const { result, duration } = await measureTime(async () => {
        return await provider.translate(TestData.tibetan.simple, 'Translate this');
      });

      // Validate result
      assertValidTranslation(result);

      // Check quality
      const quality = {
        overall: result.confidence,
        confidence: result.confidence,
        format: 0.9,
        preservation: 0.85,
      };
      assertValidQuality(quality);
      assertQualityThreshold(quality, 0.7);

      // Performance should be fast for mock
      expect(duration).toBeLessThan(100);
    });

    it('should validate caching behavior', async () => {
      const cache = new MockCacheProvider();
      const key = 'test-key';
      const value = 'test-value';

      // Set value
      await cache.set(key, value);

      // First get (cache hit)
      const result1 = await cache.get(key);
      expect(result1).toBe(value);

      // Second get (another cache hit)
      const result2 = await cache.get(key);
      expect(result2).toBe(value);

      // Verify cache statistics
      const stats = cache.getStats();
      expect(stats.hits).toBe(2);
      expect(stats.misses).toBe(0);
      expect(stats.hitRate).toBe(1);
    });
  });
});
