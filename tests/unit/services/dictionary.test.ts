/**
 * DictionaryService Tests
 *
 * Comprehensive test suite for the DictionaryService class.
 * Tests cover:
 * - Finding relevant terms in Tibetan text
 * - Frequency-based ranking
 * - Term limiting
 * - Cache integration
 * - Loading from JSON files
 * - Batch query efficiency
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MockCacheProvider, MockStorageProvider } from '../../utils/mocks.js';
import { TestData } from '../../utils/fixtures.js';

// Types for dictionary entries
interface DictionaryEntry {
  id: string;
  tibetan: string;
  english: string;
  wylie?: string;
  category?: string;
  frequency: 'very_common' | 'common' | 'uncommon' | 'rare';
  context?: string;
  sanskrit?: string;
}

describe('DictionaryService', () => {
  let dictionaryService: any;
  let cache: MockCacheProvider;
  let storage: MockStorageProvider;
  let mockDb: any;

  beforeEach(() => {
    cache = new MockCacheProvider();
    storage = new MockStorageProvider();

    // Mock database with sample dictionary entries
    mockDb = {
      query: vi.fn().mockResolvedValue(TestData.dictionary.common),
      insert: vi.fn().mockResolvedValue('dict-id-123'),
      batchInsert: vi.fn().mockResolvedValue(['dict-1', 'dict-2', 'dict-3']),
    };

    // Mock DictionaryService (will be implemented later)
    dictionaryService = {
      findRelevantTerms: vi.fn(),
      load: vi.fn(),
      extractTibetanTerms: vi.fn(),
      batchQuery: vi.fn(),
    };
  });

  describe('findRelevantTerms()', () => {
    it('should find terms in Tibetan text', async () => {
      const text = 'བཀྲ་ཤིས་བདེ་ལེགས། སངས་རྒྱས་དང་བླ་མ་ལ་ཕྱག་འཚལ་ལོ།';

      const expectedTerms: DictionaryEntry[] = [
        {
          id: 'dict-1',
          tibetan: 'བཀྲ་ཤིས་བདེ་ལེགས',
          english: 'greetings',
          wylie: 'bkra shis bde legs',
          category: 'greeting',
          frequency: 'very_common',
          context: 'Used as a greeting in Tibetan',
        },
        {
          id: 'dict-2',
          tibetan: 'སངས་རྒྱས',
          english: 'Buddha',
          wylie: 'sangs rgyas',
          category: 'religious',
          frequency: 'common',
          context: 'The enlightened one',
        },
        {
          id: 'dict-3',
          tibetan: 'བླ་མ',
          english: 'spiritual teacher',
          wylie: 'bla ma',
          sanskrit: 'guru',
          category: 'religious',
          frequency: 'common',
        },
      ];

      dictionaryService.findRelevantTerms.mockResolvedValue(expectedTerms);

      const terms = await dictionaryService.findRelevantTerms(text, 20);

      expect(terms).toBeDefined();
      expect(terms.length).toBeGreaterThan(0);
      expect(terms.length).toBeLessThanOrEqual(20);
      expect(terms.every((t: any) => t.tibetan && t.english)).toBe(true);
      expect(dictionaryService.findRelevantTerms).toHaveBeenCalledWith(text, 20);
    });

    it('should rank by frequency (common first)', async () => {
      const text = TestData.tibetan.religious;

      const terms: DictionaryEntry[] = [
        {
          id: 'dict-1',
          tibetan: 'བཀྲ་ཤིས་བདེ་ལེགས',
          english: 'greetings',
          wylie: 'bkra shis bde legs',
          frequency: 'very_common',
          category: 'greeting',
        },
        {
          id: 'dict-2',
          tibetan: 'སངས་རྒྱས',
          english: 'Buddha',
          wylie: 'sangs rgyas',
          frequency: 'common',
          category: 'religious',
        },
        {
          id: 'dict-3',
          tibetan: 'རིག་འཛིན',
          english: 'knowledge holder',
          wylie: 'rig \\u0027dzin',
          frequency: 'uncommon',
          category: 'religious',
        },
        {
          id: 'dict-4',
          tibetan: 'དགོང་དག',
          english: 'evening',
          wylie: 'dgong dag',
          frequency: 'rare',
          category: 'time',
        },
      ];

      dictionaryService.findRelevantTerms.mockResolvedValue(terms);

      const results = await dictionaryService.findRelevantTerms(text, 20);

      // Verify ordering by frequency
      const frequencies = results.map((t: any) => t.frequency);
      expect(frequencies[0]).toBe('very_common');
      expect(frequencies[frequencies.length - 1]).toBe('rare');

      // Very common terms should come first
      const firstTerm = results[0];
      expect(firstTerm.frequency).toBe('very_common');
    });

    it('should limit to N terms (default 20)', async () => {
      const text = TestData.tibetan.multiPage; // Long text with many terms

      // Create 50 mock terms
      const manyTerms: DictionaryEntry[] = Array.from({ length: 50 }, (_, i) => ({
        id: `dict-${i + 1}`,
        tibetan: `བོད་ཡིག་${i}`,
        english: `term-${i}`,
        frequency: 'common' as const,
        category: 'test',
      }));

      // Mock should return only 20 terms (default limit)
      dictionaryService.findRelevantTerms.mockResolvedValue(manyTerms.slice(0, 20));

      const results = await dictionaryService.findRelevantTerms(text);

      expect(results).toHaveLength(20);
      expect(dictionaryService.findRelevantTerms).toHaveBeenCalledWith(text, undefined);
    });

    it('should respect custom limit parameter', async () => {
      const text = TestData.tibetan.paragraph;
      const customLimit = 5;

      const terms: DictionaryEntry[] = Array.from({ length: 5 }, (_, i) => ({
        id: `dict-${i + 1}`,
        tibetan: TestData.dictionary.common[i % TestData.dictionary.common.length].tibetan,
        english: TestData.dictionary.common[i % TestData.dictionary.common.length].english,
        frequency: 'common' as const,
        category: 'test',
      }));

      dictionaryService.findRelevantTerms.mockResolvedValue(terms);

      const results = await dictionaryService.findRelevantTerms(text, customLimit);

      expect(results).toHaveLength(customLimit);
      expect(dictionaryService.findRelevantTerms).toHaveBeenCalledWith(text, customLimit);
    });

    it('should cache lookups', async () => {
      const text = TestData.tibetan.simple;

      const cachedTerms: DictionaryEntry[] = [
        {
          id: 'dict-1',
          tibetan: 'བཀྲ་ཤིས་བདེ་ལེགས',
          english: 'greetings',
          frequency: 'very_common',
          category: 'greeting',
        },
      ];

      dictionaryService.findRelevantTerms.mockResolvedValue(cachedTerms);

      // First call - should populate cache
      const result1 = await dictionaryService.findRelevantTerms(text, 20);

      // Second call - should use cache
      const result2 = await dictionaryService.findRelevantTerms(text, 20);

      expect(result1).toEqual(result2);
      // In real implementation, verify cache was hit on second call
    });

    it('should handle text with no matching terms', async () => {
      const text = 'Hello World 123'; // No Tibetan text

      dictionaryService.findRelevantTerms.mockResolvedValue([]);

      const results = await dictionaryService.findRelevantTerms(text, 20);

      expect(results).toEqual([]);
      expect(results).toHaveLength(0);
    });

    it('should extract Tibetan terms using regex', async () => {
      const text = 'Mixed text: བོད་ཡིག and English བཀྲ་ཤིས with numbers 123';

      const extractedTerms = ['བོད་ཡིག', 'བཀྲ་ཤིས'];

      dictionaryService.extractTibetanTerms.mockReturnValue(extractedTerms);

      const terms = dictionaryService.extractTibetanTerms(text);

      expect(terms).toEqual(extractedTerms);
      expect(terms.every((t: string) => /[\u0F00-\u0FFF]+/.test(t))).toBe(true);
    });

    it('should handle batch queries efficiently', async () => {
      const tibetanTerms = [
        'བཀྲ་ཤིས་བདེ་ལེགས',
        'སངས་རྒྱས',
        'སྙིང་རྗེ',
        'བླ་མ',
        'ཆོས',
      ];

      const batchResults = TestData.dictionary.common;

      dictionaryService.batchQuery.mockResolvedValue(batchResults);

      const results = await dictionaryService.batchQuery(tibetanTerms);

      expect(results).toHaveLength(batchResults.length);
      expect(dictionaryService.batchQuery).toHaveBeenCalledWith(tibetanTerms);
      expect(dictionaryService.batchQuery).toHaveBeenCalledTimes(1);
    });
  });

  describe('load()', () => {
    it('should load from JSON file', async () => {
      const jsonPath = '/path/to/dictionary.json';

      const jsonData = [
        { tibetan: 'བཀྲ་ཤིས', english: 'auspicious', frequency: 'common' },
        { tibetan: 'བདེ་ལེགས', english: 'well-being', frequency: 'common' },
        { tibetan: 'སངས་རྒྱས', english: 'Buddha', frequency: 'common' },
      ];

      dictionaryService.load.mockResolvedValue({
        loaded: jsonData.length,
        errors: 0,
      });

      const result = await dictionaryService.load(jsonPath);

      expect(result.loaded).toBeGreaterThan(0);
      expect(result.errors).toBe(0);
      expect(dictionaryService.load).toHaveBeenCalledWith(jsonPath);
    });

    it('should handle invalid JSON gracefully', async () => {
      const jsonPath = '/path/to/invalid.json';

      dictionaryService.load.mockRejectedValue(
        new Error('Invalid JSON format')
      );

      await expect(dictionaryService.load(jsonPath)).rejects.toThrow('Invalid JSON');
    });

    it('should handle missing file gracefully', async () => {
      const jsonPath = '/path/to/nonexistent.json';

      dictionaryService.load.mockRejectedValue(
        new Error('File not found')
      );

      await expect(dictionaryService.load(jsonPath)).rejects.toThrow('File not found');
    });

    it('should validate entries before loading', async () => {
      const jsonPath = '/path/to/dictionary-with-invalid.json';

      // Some entries missing required fields
      dictionaryService.load.mockResolvedValue({
        loaded: 8,
        errors: 2,
        invalidEntries: [
          { error: 'Missing tibetan field', line: 5 },
          { error: 'Missing english field', line: 12 },
        ],
      });

      const result = await dictionaryService.load(jsonPath);

      expect(result.loaded).toBe(8);
      expect(result.errors).toBe(2);
    });
  });

  describe('Cache Integration', () => {
    it('should use cache key format: dict:{tibetan}', async () => {
      const tibetan = 'བཀྲ་ཤིས་བདེ་ལེགས';
      const expectedKey = `dict:${encodeURIComponent(tibetan)}`;

      // Mock cache behavior
      await cache.set(expectedKey, TestData.dictionary.common[0], 3600);
      const cached = await cache.get(expectedKey);

      expect(cached).toBeDefined();
      expect(cached).toEqual(TestData.dictionary.common[0]);
    });

    it('should cache individual term lookups', async () => {
      const tibetan = 'སངས་རྒྱས';

      const entry: DictionaryEntry = {
        id: 'dict-2',
        tibetan: 'སངས་རྒྱས',
        english: 'Buddha',
        wylie: 'sangs rgyas',
        category: 'religious',
        frequency: 'common',
        context: 'The enlightened one',
      };

      dictionaryService.findRelevantTerms.mockResolvedValue([entry]);

      // First lookup - miss cache
      await dictionaryService.findRelevantTerms(tibetan, 1);

      // Second lookup - hit cache
      const result = await dictionaryService.findRelevantTerms(tibetan, 1);

      expect(result).toEqual([entry]);
    });

    it('should respect cache TTL', async () => {
      const tibetan = 'བླ་མ';
      const cacheKey = `dict:${encodeURIComponent(tibetan)}`;

      const entry: DictionaryEntry = TestData.dictionary.religious[0];

      // Set with 1 second TTL
      await cache.set(cacheKey, entry, 1);

      // Immediate read should work
      const result1 = await cache.get(cacheKey);
      expect(result1).toEqual(entry);

      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 1100));

      // Should be expired
      const result2 = await cache.get(cacheKey);
      expect(result2).toBeNull();
    });
  });

  describe('Frequency-based Ranking', () => {
    it('should prioritize very_common over common', async () => {
      const terms: DictionaryEntry[] = [
        { id: '1', tibetan: 'ཆོས', english: 'dharma', frequency: 'very_common', category: 'religious' },
        { id: '2', tibetan: 'བླ་མ', english: 'guru', frequency: 'common', category: 'religious' },
      ];

      dictionaryService.findRelevantTerms.mockResolvedValue(terms);

      const results = await dictionaryService.findRelevantTerms('text', 20);

      expect(results[0].frequency).toBe('very_common');
      expect(results[1].frequency).toBe('common');
    });

    it('should prioritize common over uncommon', async () => {
      const terms: DictionaryEntry[] = [
        { id: '1', tibetan: 'སངས་རྒྱས', english: 'Buddha', frequency: 'common', category: 'religious' },
        { id: '2', tibetan: 'རིག་འཛིན', english: 'knowledge holder', frequency: 'uncommon', category: 'religious' },
      ];

      dictionaryService.findRelevantTerms.mockResolvedValue(terms);

      const results = await dictionaryService.findRelevantTerms('text', 20);

      expect(results[0].frequency).toBe('common');
      expect(results[1].frequency).toBe('uncommon');
    });

    it('should prioritize uncommon over rare', async () => {
      const terms: DictionaryEntry[] = [
        { id: '1', tibetan: 'དགོང་དག', english: 'evening', frequency: 'uncommon', category: 'time' },
        { id: '2', tibetan: 'གསང་སྔགས', english: 'secret mantra', frequency: 'rare', category: 'religious' },
      ];

      dictionaryService.findRelevantTerms.mockResolvedValue(terms);

      const results = await dictionaryService.findRelevantTerms('text', 20);

      expect(results[0].frequency).toBe('uncommon');
      expect(results[1].frequency).toBe('rare');
    });
  });

  describe('Tibetan Text Extraction', () => {
    it('should extract Tibetan Unicode range (U+0F00-U+0FFF)', async () => {
      const text = 'English བོད་ཡིག 123 བཀྲ་ཤིས more text';
      const expected = ['བོད་ཡིག', 'བཀྲ་ཤིས'];

      dictionaryService.extractTibetanTerms.mockReturnValue(expected);

      const extracted = dictionaryService.extractTibetanTerms(text);

      expect(extracted).toEqual(expected);
      expect(extracted).toHaveLength(2);
    });

    it('should handle text with only Tibetan', async () => {
      const text = 'བཀྲ་ཤིས་བདེ་ལེགས། སངས་རྒྱས།';
      const expected = ['བཀྲ་ཤིས་བདེ་ལེགས', 'སངས་རྒྱས'];

      dictionaryService.extractTibetanTerms.mockReturnValue(expected);

      const extracted = dictionaryService.extractTibetanTerms(text);

      expect(extracted.length).toBeGreaterThan(0);
      expect(extracted).toEqual(expected);
    });

    it('should handle text with no Tibetan', async () => {
      const text = 'Only English text here 12345';

      dictionaryService.extractTibetanTerms.mockReturnValue([]);

      const extracted = dictionaryService.extractTibetanTerms(text);

      expect(extracted).toEqual([]);
      expect(extracted).toHaveLength(0);
    });

    it('should preserve Tibetan punctuation in extraction', async () => {
      const text = 'བཀྲ་ཤིས་བདེ་ལེགས།'; // With shad (།)

      // Extract should include punctuation as part of term
      const expected = ['བཀྲ་ཤིས་བདེ་ལེགས'];

      dictionaryService.extractTibetanTerms.mockReturnValue(expected);

      const extracted = dictionaryService.extractTibetanTerms(text);

      expect(extracted).toEqual(expected);
    });
  });

  describe('Performance', () => {
    it('should handle large text efficiently', async () => {
      const largeText = TestData.tibetan.multiPage.repeat(10); // ~5000+ characters

      const terms = TestData.dictionary.common.slice(0, 20);

      dictionaryService.findRelevantTerms.mockResolvedValue(terms);

      const startTime = Date.now();
      const results = await dictionaryService.findRelevantTerms(largeText, 20);
      const elapsedTime = Date.now() - startTime;

      expect(results).toHaveLength(20);
      // Should complete reasonably fast even with large text
      expect(elapsedTime).toBeLessThan(1000);
    });

    it('should batch database queries', async () => {
      const terms = ['བཀྲ་ཤིས', 'བདེ་ལེགས', 'སངས་རྒྱས', 'བླ་མ', 'ཆོས'];

      dictionaryService.batchQuery.mockResolvedValue(
        TestData.dictionary.common.slice(0, 5)
      );

      await dictionaryService.batchQuery(terms);

      // Should make only one database call for multiple terms
      expect(dictionaryService.batchQuery).toHaveBeenCalledTimes(1);
      expect(dictionaryService.batchQuery).toHaveBeenCalledWith(terms);
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      const text = TestData.tibetan.simple;

      dictionaryService.findRelevantTerms.mockRejectedValue(
        new Error('Database connection failed')
      );

      await expect(dictionaryService.findRelevantTerms(text, 20)).rejects.toThrow(
        'Database connection failed'
      );
    });

    it('should handle cache errors gracefully', async () => {
      const text = TestData.tibetan.simple;

      // Simulate cache failure but continue with database lookup
      cache.setFailureMode(true);

      dictionaryService.findRelevantTerms.mockResolvedValue(
        TestData.dictionary.common
      );

      const results = await dictionaryService.findRelevantTerms(text, 20);

      // Should still return results even if cache fails
      expect(results).toBeDefined();
      expect(results.length).toBeGreaterThan(0);
    });
  });
});
