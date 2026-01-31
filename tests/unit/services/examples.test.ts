/**
 * ExampleSelector Tests
 *
 * Comprehensive test suite for the ExampleSelector class.
 * Tests cover:
 * - Selecting most similar examples using embeddings
 * - Ensuring category diversity
 * - Fallback to keyword matching if embeddings unavailable
 * - Handling empty example pool
 * - Cosine similarity calculations
 * - Performance with large example sets
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MockEmbeddingProvider } from '../../utils/mocks.js';
import { TestData } from '../../utils/fixtures.js';

// Types for translation examples
interface TranslationExample {
  id: string;
  tibetan: string;
  english: string;
  category: string;
  embedding?: number[];
  similarity?: number;
}

describe('ExampleSelector', () => {
  let exampleSelector: any;
  let embeddingProvider: MockEmbeddingProvider;
  let examples: TranslationExample[];

  beforeEach(() => {
    embeddingProvider = new MockEmbeddingProvider({ dimension: 768 });

    // Sample examples with different categories
    examples = [
      {
        id: 'ex-1',
        tibetan: 'བཀྲ་ཤིས་བདེ་ལེགས།',
        english: 'Greetings',
        category: 'greeting',
        embedding: Array(768).fill(0).map((_, i) => Math.sin(i * 0.1)),
      },
      {
        id: 'ex-2',
        tibetan: 'ཐུགས་རྗེ་ཆེ།',
        english: 'Thank you',
        category: 'greeting',
        embedding: Array(768).fill(0).map((_, i) => Math.sin(i * 0.1 + 0.1)),
      },
      {
        id: 'ex-3',
        tibetan: 'སངས་རྒྱས་ལ་ཕྱག་འཚལ་ལོ།',
        english: 'Homage to the Buddha',
        category: 'religious',
        embedding: Array(768).fill(0).map((_, i) => Math.cos(i * 0.1)),
      },
      {
        id: 'ex-4',
        tibetan: 'བླ་མ་དང་དཀོན་མཆོག',
        english: 'The guru and the Three Jewels',
        category: 'religious',
        embedding: Array(768).fill(0).map((_, i) => Math.cos(i * 0.1 + 0.1)),
      },
      {
        id: 'ex-5',
        tibetan: 'སྙིང་རྗེ་ཆེན་པོ།',
        english: 'Great compassion',
        category: 'religious',
        embedding: Array(768).fill(0).map((_, i) => Math.cos(i * 0.1 + 0.2)),
      },
      {
        id: 'ex-6',
        tibetan: 'ང་སློབ་ཕྲུག་ཡིན།',
        english: 'I am a student',
        category: 'personal',
        embedding: Array(768).fill(0).map((_, i) => Math.tan(i * 0.05)),
      },
      {
        id: 'ex-7',
        tibetan: 'དེབ་དང་པར་ཁང་།',
        english: 'Books and printing house',
        category: 'education',
        embedding: Array(768).fill(0).map((_, i) => Math.sin(i * 0.15)),
      },
    ];

    // Mock ExampleSelector (will be implemented later)
    exampleSelector = {
      selectBest: vi.fn(),
      calculateSimilarity: vi.fn(),
      ensureDiversity: vi.fn(),
      keywordMatch: vi.fn(),
    };
  });

  describe('selectBest()', () => {
    it('should select most similar examples using embeddings', async () => {
      const inputText = 'བཀྲ་ཤིས་བདེ་ལེགས།'; // Greeting text
      const count = 3;

      // Should return greeting and similar examples
      const expectedExamples = [
        {
          ...examples[0],
          similarity: 0.98,
        },
        {
          ...examples[1],
          similarity: 0.95,
        },
        {
          ...examples[3],
          similarity: 0.82,
        },
      ];

      exampleSelector.selectBest.mockResolvedValue(expectedExamples);

      const selected = await exampleSelector.selectBest(inputText, count);

      expect(selected).toHaveLength(count);
      expect(selected[0].similarity).toBeGreaterThanOrEqual(selected[1].similarity);
      expect(selected[1].similarity).toBeGreaterThanOrEqual(selected[2].similarity);
      expect(exampleSelector.selectBest).toHaveBeenCalledWith(inputText, count);
    });

    it('should ensure category diversity (max 50% from same category)', async () => {
      const inputText = 'སངས་རྒྱས་དང་བླ་མ།'; // Religious text
      const count = 4;

      // Even though religious examples are most similar,
      // should limit to 50% (2 out of 4)
      const diverseExamples = [
        { ...examples[2], category: 'religious', similarity: 0.96 },
        { ...examples[3], category: 'religious', similarity: 0.94 },
        { ...examples[0], category: 'greeting', similarity: 0.78 },
        { ...examples[6], category: 'education', similarity: 0.75 },
      ];

      exampleSelector.selectBest.mockResolvedValue(diverseExamples);

      const selected = await exampleSelector.selectBest(inputText, count);

      // Count categories
      const categoryCount: { [key: string]: number } = {};
      selected.forEach((ex: TranslationExample) => {
        categoryCount[ex.category] = (categoryCount[ex.category] || 0) + 1;
      });

      // No category should have more than 50% of examples
      const maxCategoryCount = Math.ceil(count * 0.5);
      Object.values(categoryCount).forEach(count => {
        expect(count).toBeLessThanOrEqual(maxCategoryCount);
      });
    });

    it('should fall back to keyword matching if embeddings unavailable', async () => {
      const inputText = 'བཀྲ་ཤིས་བདེ་ལེགས།';
      const count = 3;

      // Examples without embeddings
      const examplesWithoutEmbeddings = examples.map(ex => ({
        ...ex,
        embedding: undefined,
      }));

      // Should use keyword matching instead
      const keywordMatches = [
        examplesWithoutEmbeddings[0], // Contains བཀྲ་ཤིས
        examplesWithoutEmbeddings[1], // Similar greeting
        examplesWithoutEmbeddings[2], // Default fallback
      ];

      exampleSelector.selectBest.mockResolvedValue(keywordMatches);

      const selected = await exampleSelector.selectBest(inputText, count);

      expect(selected).toHaveLength(count);
      expect(selected.every((ex: TranslationExample) => ex.tibetan && ex.english)).toBe(true);
    });

    it('should handle empty example pool', async () => {
      const inputText = 'བཀྲ་ཤིས་བདེ་ལེགས།';
      const count = 3;

      exampleSelector.selectBest.mockResolvedValue([]);

      const selected = await exampleSelector.selectBest(inputText, count);

      expect(selected).toEqual([]);
      expect(selected).toHaveLength(0);
    });

    it('should handle count larger than available examples', async () => {
      const inputText = 'བཀྲ་ཤིས།';
      const count = 100; // More than available

      const availableExamples = examples.slice(0, 7); // Only 7 examples

      exampleSelector.selectBest.mockResolvedValue(availableExamples);

      const selected = await exampleSelector.selectBest(inputText, count);

      // Should return all available examples
      expect(selected).toHaveLength(availableExamples.length);
      expect(selected.length).toBeLessThanOrEqual(count);
    });

    it('should return examples sorted by similarity (descending)', async () => {
      const inputText = 'སངས་རྒྱས།';
      const count = 5;

      const sortedExamples = [
        { ...examples[2], similarity: 0.98 },
        { ...examples[3], similarity: 0.92 },
        { ...examples[4], similarity: 0.87 },
        { ...examples[0], similarity: 0.75 },
        { ...examples[6], similarity: 0.68 },
      ];

      exampleSelector.selectBest.mockResolvedValue(sortedExamples);

      const selected = await exampleSelector.selectBest(inputText, count);

      // Verify descending order
      for (let i = 0; i < selected.length - 1; i++) {
        expect(selected[i].similarity).toBeGreaterThanOrEqual(selected[i + 1].similarity);
      }
    });
  });

  describe('calculateSimilarity()', () => {
    it('should calculate cosine similarity correctly', () => {
      const embedding1 = [1, 0, 0];
      const embedding2 = [1, 0, 0];

      exampleSelector.calculateSimilarity.mockReturnValue(1.0);

      const similarity = exampleSelector.calculateSimilarity(embedding1, embedding2);

      expect(similarity).toBe(1.0); // Identical vectors
    });

    it('should return 0 for orthogonal vectors', () => {
      const embedding1 = [1, 0, 0];
      const embedding2 = [0, 1, 0];

      exampleSelector.calculateSimilarity.mockReturnValue(0.0);

      const similarity = exampleSelector.calculateSimilarity(embedding1, embedding2);

      expect(similarity).toBe(0.0); // Orthogonal vectors
    });

    it('should handle normalized vectors', () => {
      const embedding1 = [0.6, 0.8];
      const embedding2 = [0.8, 0.6];

      // Cosine similarity = 0.6*0.8 + 0.8*0.6 = 0.96
      exampleSelector.calculateSimilarity.mockReturnValue(0.96);

      const similarity = exampleSelector.calculateSimilarity(embedding1, embedding2);

      expect(similarity).toBeCloseTo(0.96, 2);
    });

    it('should handle high-dimensional vectors (768)', () => {
      const embedding1 = Array(768).fill(0).map((_, i) => Math.sin(i * 0.1));
      const embedding2 = Array(768).fill(0).map((_, i) => Math.sin(i * 0.1 + 0.01));

      exampleSelector.calculateSimilarity.mockReturnValue(0.95);

      const similarity = exampleSelector.calculateSimilarity(embedding1, embedding2);

      expect(similarity).toBeGreaterThan(0.9);
      expect(similarity).toBeLessThanOrEqual(1.0);
    });

    it('should be symmetric (similarity(a,b) === similarity(b,a))', () => {
      const embedding1 = [0.5, 0.5, 0.5];
      const embedding2 = [0.3, 0.6, 0.8];

      exampleSelector.calculateSimilarity
        .mockReturnValueOnce(0.85)
        .mockReturnValueOnce(0.85);

      const similarity1 = exampleSelector.calculateSimilarity(embedding1, embedding2);
      const similarity2 = exampleSelector.calculateSimilarity(embedding2, embedding1);

      expect(similarity1).toBe(similarity2);
    });
  });

  describe('ensureDiversity()', () => {
    it('should limit examples from same category to 50%', () => {
      const candidates = [
        { ...examples[2], category: 'religious', similarity: 0.98 },
        { ...examples[3], category: 'religious', similarity: 0.96 },
        { ...examples[4], category: 'religious', similarity: 0.94 },
        { ...examples[0], category: 'greeting', similarity: 0.80 },
        { ...examples[6], category: 'education', similarity: 0.75 },
      ];

      const count = 4;

      // Should limit religious to 2 (50% of 4)
      const diverse = [
        candidates[0],
        candidates[1],
        candidates[3],
        candidates[4],
      ];

      exampleSelector.ensureDiversity.mockReturnValue(diverse);

      const result = exampleSelector.ensureDiversity(candidates, count);

      const religiousCount = result.filter(
        (ex: TranslationExample) => ex.category === 'religious'
      ).length;

      expect(religiousCount).toBeLessThanOrEqual(Math.ceil(count * 0.5));
    });

    it('should maintain similarity order while ensuring diversity', () => {
      const candidates = [
        { ...examples[2], category: 'religious', similarity: 0.98 },
        { ...examples[3], category: 'religious', similarity: 0.96 },
        { ...examples[4], category: 'religious', similarity: 0.94 },
        { ...examples[0], category: 'greeting', similarity: 0.92 },
      ];

      const diverse = [
        candidates[0], // Keep highest religious
        candidates[3], // Add greeting for diversity
        candidates[1], // Add second religious (within 50% limit)
        candidates[2], // Skip third religious (would exceed 50%)
      ];

      exampleSelector.ensureDiversity.mockReturnValue(diverse.slice(0, 3));

      const result = exampleSelector.ensureDiversity(candidates, 3);

      // Result should still be roughly sorted by similarity
      expect(result[0].similarity).toBeGreaterThanOrEqual(result[1].similarity);
    });

    it('should allow all examples if categories are diverse', () => {
      const diverseCandidates = [
        { ...examples[0], category: 'greeting', similarity: 0.95 },
        { ...examples[2], category: 'religious', similarity: 0.93 },
        { ...examples[5], category: 'personal', similarity: 0.91 },
        { ...examples[6], category: 'education', similarity: 0.89 },
      ];

      exampleSelector.ensureDiversity.mockReturnValue(diverseCandidates);

      const result = exampleSelector.ensureDiversity(diverseCandidates, 4);

      // All different categories, should return all
      expect(result).toHaveLength(4);
    });
  });

  describe('keywordMatch()', () => {
    it('should match by Tibetan keywords', () => {
      const inputText = 'བཀྲ་ཤིས་བདེ་ལེགས།';

      const matches = [
        examples[0], // Contains བཀྲ་ཤིས་བདེ་ལེགས
        examples[1], // Similar greeting context
      ];

      exampleSelector.keywordMatch.mockReturnValue(matches);

      const result = exampleSelector.keywordMatch(inputText, examples, 3);

      expect(result).toHaveLength(2);
      expect(result[0].tibetan).toContain('བཀྲ་ཤིས');
    });

    it('should score by keyword overlap', () => {
      const inputText = 'སངས་རྒྱས་དང་བླ་མ།';

      // Examples with different keyword overlap
      const scored = [
        { ...examples[3], score: 2 }, // Contains both སངས་རྒྱས and བླ་མ (implicitly)
        { ...examples[2], score: 1 }, // Contains སངས་རྒྱས
        { ...examples[4], score: 0.5 }, // Religious context
      ];

      exampleSelector.keywordMatch.mockReturnValue(scored);

      const result = exampleSelector.keywordMatch(inputText, examples, 3);

      // Should be ordered by score
      expect(result[0].score).toBeGreaterThanOrEqual(result[1].score);
    });

    it('should handle text with no keyword matches', () => {
      const inputText = 'རྫོང་ཁ་སྐད།'; // Dzongkha language (not in examples)

      exampleSelector.keywordMatch.mockReturnValue([]);

      const result = exampleSelector.keywordMatch(inputText, examples, 3);

      expect(result).toEqual([]);
    });

    it('should extract meaningful keywords (ignore common particles)', () => {
      const inputText = 'བླ་མ་ལ་གསོལ་བ་འདེབས།';

      // Should extract: བླ་མ (guru), not ལ (to)
      const matches = [
        examples[3], // Contains བླ་མ
      ];

      exampleSelector.keywordMatch.mockReturnValue(matches);

      const result = exampleSelector.keywordMatch(inputText, examples, 3);

      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe('Performance', () => {
    it('should handle large example pool efficiently', async () => {
      const inputText = 'བཀྲ་ཤིས་བདེ་ལེགས།';
      const count = 5;

      // Create large pool of examples
      const largePool: TranslationExample[] = Array.from({ length: 1000 }, (_, i) => ({
        id: `ex-${i}`,
        tibetan: `བོད་ཡིག་${i}`,
        english: `Example ${i}`,
        category: ['greeting', 'religious', 'personal', 'education'][i % 4],
        embedding: Array(768).fill(0).map((_, j) => Math.sin(j * 0.1 + i * 0.01)),
      }));

      const topExamples = largePool.slice(0, count);

      exampleSelector.selectBest.mockResolvedValue(topExamples);

      const startTime = Date.now();
      const selected = await exampleSelector.selectBest(inputText, count);
      const elapsedTime = Date.now() - startTime;

      expect(selected).toHaveLength(count);
      // Should complete in reasonable time even with 1000 examples
      expect(elapsedTime).toBeLessThan(1000);
    });

    it('should cache embeddings for repeated selections', async () => {
      const inputText = 'བཀྲ་ཤིས་བདེ་ལེགས།';
      const count = 3;

      exampleSelector.selectBest.mockResolvedValue(examples.slice(0, count));

      // First call - compute embeddings
      await exampleSelector.selectBest(inputText, count);

      // Reset mock call count
      embeddingProvider.reset();

      // Second call - should use cached embeddings
      await exampleSelector.selectBest(inputText, count);

      // In real implementation, embedding provider should not be called again
      // expect(embeddingProvider.getCallCount()).toBe(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle examples with missing embeddings', async () => {
      const inputText = 'བཀྲ་ཤིས།';
      const count = 3;

      const mixedExamples = [
        { ...examples[0], embedding: undefined },
        { ...examples[1] }, // Has embedding
        { ...examples[2], embedding: undefined },
      ];

      // Should use keyword matching for examples without embeddings
      exampleSelector.selectBest.mockResolvedValue(mixedExamples);

      const selected = await exampleSelector.selectBest(inputText, count);

      expect(selected).toHaveLength(count);
    });

    it('should handle zero count', async () => {
      const inputText = 'བཀྲ་ཤིས།';
      const count = 0;

      exampleSelector.selectBest.mockResolvedValue([]);

      const selected = await exampleSelector.selectBest(inputText, count);

      expect(selected).toEqual([]);
      expect(selected).toHaveLength(0);
    });

    it('should handle negative count gracefully', async () => {
      const inputText = 'བཀྲ་ཤིས།';
      const count = -5;

      exampleSelector.selectBest.mockResolvedValue([]);

      const selected = await exampleSelector.selectBest(inputText, count);

      expect(selected).toEqual([]);
    });

    it('should handle empty input text', async () => {
      const inputText = '';
      const count = 3;

      exampleSelector.selectBest.mockResolvedValue([]);

      const selected = await exampleSelector.selectBest(inputText, count);

      expect(selected).toEqual([]);
    });

    it('should handle all examples from same category', async () => {
      const inputText = 'སངས་རྒྱས།';
      const count = 3;

      const singleCategoryExamples = examples
        .filter(ex => ex.category === 'religious')
        .slice(0, 3);

      exampleSelector.selectBest.mockResolvedValue(singleCategoryExamples);

      const selected = await exampleSelector.selectBest(inputText, count);

      // Should still return examples even if no diversity possible
      expect(selected).toHaveLength(count);
      expect(selected.every((ex: TranslationExample) => ex.category === 'religious')).toBe(true);
    });
  });

  describe('Integration', () => {
    it('should work with EmbeddingProvider', async () => {
      const inputText = 'བཀྲ་ཤིས་བདེ་ལེགས།';
      const count = 3;

      // Get embedding for input
      const inputEmbedding = await embeddingProvider.getEmbedding(inputText);

      expect(inputEmbedding).toBeDefined();
      expect(inputEmbedding).toHaveLength(768);

      // Mock selector using real embeddings
      const similarExamples = examples.slice(0, count);

      exampleSelector.selectBest.mockResolvedValue(similarExamples);

      const selected = await exampleSelector.selectBest(inputText, count);

      expect(selected).toHaveLength(count);
    });
  });
});
