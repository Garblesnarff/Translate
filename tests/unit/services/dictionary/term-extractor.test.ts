/**
 * TermExtractor Tests (Task 2.4.1.1)
 *
 * Comprehensive test suite for the TermExtractor class.
 * Tests term extraction from translation results, filtering, and confidence scoring.
 *
 * Test Coverage:
 * - Extract Tibetan-English pairs from format "English (Tibetan)"
 * - Filter out full sentences (>15 words)
 * - Filter out single common words (stop words)
 * - Score term importance/confidence
 * - Handle multiple pairs in one translation
 * - Handle nested parentheses
 * - Handle Sanskrit transliterations
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { TermExtractor, type TermPair } from '../../../../server/services/dictionary/TermExtractor.js';

describe('TermExtractor', () => {
  let extractor: TermExtractor;

  beforeEach(() => {
    extractor = new TermExtractor();
  });

  describe('extract()', () => {
    it('should extract Tibetan-English pairs from format "English (Tibetan)"', () => {
      const text = 'The Buddha (སངས་རྒྱས་) taught compassion (སྙིང་རྗེ་) to all beings.';

      const expected: TermPair[] = [
        { tibetan: 'སངས་རྒྱས', english: 'Buddha', confidence: expect.any(Number) },
        { tibetan: 'སྙིང་རྗེ', english: 'compassion', confidence: expect.any(Number) },
      ];

      // Test will verify real implementation extracts these pairs
      // For now, we're defining the expected behavior
      const result = extractor.extract(text);

      // Placeholder assertions - real implementation should pass
      expect(result).toEqual(expect.arrayContaining([
        expect.objectContaining({ tibetan: expect.stringMatching(/སངས་རྒྱས/), english: expect.stringMatching(/Buddha/i) }),
        expect.objectContaining({ tibetan: expect.stringMatching(/སྙིང་རྗེ/), english: expect.stringMatching(/compassion/i) }),
      ]));
    });

    it('should handle text without parentheses', () => {
      const text = 'This is plain English text without any Tibetan.';

      const result = extractor.extract(text);

      expect(result).toEqual([]);
    });

    it('should handle text with only Tibetan (no pairs)', () => {
      const text = 'བཀྲ་ཤིས་བདེ་ལེགས། སངས་རྒྱས།';

      const result = extractor.extract(text);

      expect(result).toEqual([]);
    });

    it('should handle multiple pairs in one translation', () => {
      const text = `Homage to the spiritual teacher (བླ་མ་) and the Buddha (སངས་རྒྱས་).
      The dharma (ཆོས་) is profound and the sangha (དགེ་འདུན་) is noble.`;

      const result = extractor.extract(text);

      // Should extract 4 term pairs
      expect(result.length).toBeGreaterThanOrEqual(4);
      expect(result).toEqual(expect.arrayContaining([
        expect.objectContaining({ english: expect.stringMatching(/spiritual teacher|teacher/i) }),
        expect.objectContaining({ english: expect.stringMatching(/Buddha/i) }),
        expect.objectContaining({ english: expect.stringMatching(/dharma/i) }),
        expect.objectContaining({ english: expect.stringMatching(/sangha/i) }),
      ]));
    });

    it('should handle nested parentheses', () => {
      const text = 'The mantra (སྔགས་ (mantra)) is sacred.';

      const result = extractor.extract(text);

      // Should extract the outer pair correctly
      expect(result.length).toBeGreaterThan(0);
      expect(result[0].tibetan).toMatch(/སྔགས/);
    });

    it('should handle Sanskrit transliterations', () => {
      const text = 'Om Mani Padme Hum (ཨོཾ་མ་ཎི་པདྨེ་ཧཱུྃ་) is a sacred mantra (Sanskrit: मणिपद्मे).';

      const result = extractor.extract(text);

      // Should extract the Tibetan pair
      expect(result).toEqual(expect.arrayContaining([
        expect.objectContaining({ tibetan: expect.stringMatching(/ཨོཾ.*ཧཱུྃ/) }),
      ]));

      // Sanskrit should not be extracted (different Unicode range)
      expect(result.every((term: TermPair) => !term.tibetan.includes('मणि'))).toBe(true);
    });

    it('should extract pairs with Wylie transliteration in parentheses', () => {
      const text = 'The lama (བླ་མ་, Wylie: bla ma) is revered.';

      const result = extractor.extract(text);

      // Should handle comma-separated Tibetan and Wylie
      expect(result.length).toBeGreaterThan(0);
      expect(result[0].tibetan).toMatch(/བླ་མ/);
    });

    it('should handle empty string', () => {
      const result = extractor.extract('');
      expect(result).toEqual([]);
    });

    it('should handle whitespace-only string', () => {
      const result = extractor.extract('   \n\t  ');
      expect(result).toEqual([]);
    });

    it('should preserve tsek and other Tibetan punctuation', () => {
      const text = 'Greetings (བཀྲ་ཤིས་བདེ་ལེགས།) to you.';

      const result = extractor.extract(text);

      expect(result[0]?.tibetan).toMatch(/་/); // Contains tsek
      expect(result[0]?.tibetan).toMatch(/།/); // Contains shad
    });
  });

  describe('filterTerms() - Full Sentences', () => {
    it('should filter out full sentences (>15 words)', () => {
      const terms: TermPair[] = [
        {
          tibetan: 'བོད་ཡིག',
          english: 'Buddha',
          confidence: 0.8
        },
        {
          tibetan: 'དེ་ནས་འདི',
          english: 'This is a very long sentence with more than fifteen words that should be filtered out completely',
          confidence: 0.7
        },
        {
          tibetan: 'སྙིང་རྗེ',
          english: 'compassion',
          confidence: 0.9
        },
      ];

      const result = extractor.filterTerms(terms);

      // Should filter out the long sentence
      expect(result.length).toBe(2);
      expect(result).not.toContainEqual(expect.objectContaining({
        english: expect.stringMatching(/very long sentence/)
      }));
    });

    it('should keep terms with exactly 15 words (boundary)', () => {
      const terms: TermPair[] = [
        {
          tibetan: 'བོད་ཡིག',
          english: 'one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen',
          confidence: 0.8
        },
      ];

      const result = extractor.filterTerms(terms);

      // 15 words should be kept (not > 15)
      expect(result.length).toBe(1);
    });

    it('should filter sentences with 16+ words', () => {
      const terms: TermPair[] = [
        {
          tibetan: 'བོད་ཡིག',
          english: 'one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen',
          confidence: 0.8
        },
      ];

      const result = extractor.filterTerms(terms);

      // 16 words should be filtered out
      expect(result.length).toBe(0);
    });
  });

  describe('filterTerms() - Stop Words', () => {
    it('should filter out single common words (stop words)', () => {
      const terms: TermPair[] = [
        { tibetan: 'དེ་', english: 'the', confidence: 0.5 },
        { tibetan: 'ཞིག་', english: 'a', confidence: 0.5 },
        { tibetan: 'ཡིན་', english: 'is', confidence: 0.5 },
        { tibetan: 'སངས་རྒྱས་', english: 'Buddha', confidence: 0.8 },
        { tibetan: 'དང་', english: 'and', confidence: 0.5 },
      ];

      const result = extractor.filterTerms(terms);

      // Should only keep 'Buddha' (not a stop word)
      expect(result.length).toBe(1);
      expect(result[0].english).toBe('Buddha');
    });

    it('should keep multi-word phrases even if they contain stop words', () => {
      const terms: TermPair[] = [
        { tibetan: 'དེ་', english: 'the', confidence: 0.5 },
        { tibetan: 'བླ་མ་', english: 'the spiritual teacher', confidence: 0.8 },
      ];

      const result = extractor.filterTerms(terms);

      // Should filter single stop word but keep phrase
      expect(result.length).toBe(1);
      expect(result[0].english).toBe('the spiritual teacher');
    });

    it('should filter stop words case-insensitively', () => {
      const terms: TermPair[] = [
        { tibetan: 'དེ་', english: 'The', confidence: 0.5 },
        { tibetan: 'དེ་', english: 'THE', confidence: 0.5 },
        { tibetan: 'སངས་རྒྱས་', english: 'Buddha', confidence: 0.8 },
      ];

      const result = extractor.filterTerms(terms);

      expect(result.length).toBe(1);
      expect(result[0].english).toBe('Buddha');
    });
  });

  describe('filterTerms() - Tibetan Length', () => {
    it('should filter Tibetan terms shorter than 3 characters', () => {
      const terms: TermPair[] = [
        { tibetan: 'ཀ', english: 'ka', confidence: 0.5 },
        { tibetan: 'ཀཁ', english: 'kha', confidence: 0.5 },
        { tibetan: 'ཀཁག', english: 'khag', confidence: 0.7 },
        { tibetan: 'བཀྲ་ཤིས', english: 'auspicious', confidence: 0.8 },
      ];

      const result = extractor.filterTerms(terms);

      // Should keep terms with 3+ characters
      expect(result.length).toBe(2);
      expect(result.every((t: TermPair) => t.tibetan.length >= 3)).toBe(true);
    });
  });

  describe('scoreConfidence()', () => {
    it('should score based on term length (longer = higher confidence)', () => {
      const shortTerm: TermPair = {
        tibetan: 'བོད་',
        english: 'Tibet',
        confidence: 0
      };

      const longTerm: TermPair = {
        tibetan: 'བླ་མ་དམ་པ་རིན་པོ་ཆེ་',
        english: 'precious holy spiritual teacher',
        confidence: 0
      };

      const text = 'Some text with these terms...';

      const shortScore = extractor.scoreConfidence(shortTerm, text);
      const longScore = extractor.scoreConfidence(longTerm, text);

      expect(longScore).toBeGreaterThan(shortScore);
    });

    it('should boost confidence for capitalized terms (proper nouns)', () => {
      const commonTerm: TermPair = {
        tibetan: 'སྙིང་རྗེ་',
        english: 'compassion',
        confidence: 0
      };

      const properNoun: TermPair = {
        tibetan: 'བོད་',
        english: 'Tibet',
        confidence: 0
      };

      const text = 'Text containing these terms';

      const commonScore = extractor.scoreConfidence(commonTerm, text);
      const properNounScore = extractor.scoreConfidence(properNoun, text);

      expect(properNounScore).toBeGreaterThan(commonScore);
    });

    it('should boost confidence for repeated terms in text', () => {
      const term: TermPair = {
        tibetan: 'སངས་རྒྱས་',
        english: 'Buddha',
        confidence: 0
      };

      const textWithOnce = 'The Buddha (སངས་རྒྱས་) taught wisdom.';
      const textWithMultiple = 'The Buddha (སངས་རྒྱས་) taught wisdom. སངས་རྒྱས་ said... The Buddha སངས་རྒྱས་ explained...';

      const scoreOnce = extractor.scoreConfidence(term, textWithOnce);
      const scoreMultiple = extractor.scoreConfidence(term, textWithMultiple);

      expect(scoreMultiple).toBeGreaterThan(scoreOnce);
    });

    it('should score multi-word terms higher than single words', () => {
      const singleWord: TermPair = {
        tibetan: 'ཆོས་',
        english: 'dharma',
        confidence: 0
      };

      const multiWord: TermPair = {
        tibetan: 'བླ་མ་དམ་པ་',
        english: 'holy spiritual teacher',
        confidence: 0
      };

      const text = 'Some text';

      const singleScore = extractor.scoreConfidence(singleWord, text);
      const multiScore = extractor.scoreConfidence(multiWord, text);

      expect(multiScore).toBeGreaterThan(singleScore);
    });

    it('should cap confidence at 0.98 maximum', () => {
      const term: TermPair = {
        tibetan: 'བླ་མ་རིན་པོ་ཆེ་མཆོག་',
        english: 'Supreme Precious Spiritual Teacher',
        confidence: 0
      };

      // Create text with many repetitions to maximize score
      const text = `${term.tibetan} `.repeat(100);

      const score = extractor.scoreConfidence(term, text);

      expect(score).toBeLessThanOrEqual(0.98);
    });

    it('should have base confidence of at least 0.5', () => {
      const term: TermPair = {
        tibetan: 'ཀ་',
        english: 'x',
        confidence: 0
      };

      const text = 'Unrelated text';

      const score = extractor.scoreConfidence(term, text);

      expect(score).toBeGreaterThanOrEqual(0.5);
    });

    it('should apply confidence formula: base + length + capitalization + repetition', () => {
      // Test the complete formula
      const term: TermPair = {
        tibetan: 'བོད་ལྗོངས་',
        english: 'Tibet', // Capitalized, 5 chars
        confidence: 0
      };

      const text = `Tibet བོད་ལྗོངས་ is mentioned. བོད་ལྗོངས་ again. བོད་ལྗོངས་ once more.`;

      const score = extractor.scoreConfidence(term, text);

      // Base: 0.5, +0.2 (multi-word <=5), +0.15 (capitalized), +0.15 (3+ occurrences)
      // Expected: ~0.8 - 0.95
      expect(score).toBeGreaterThan(0.75);
      expect(score).toBeLessThan(0.98);
    });
  });

  describe('Integration Tests', () => {
    it('should extract and filter terms from full translation', () => {
      const translation = `The spiritual teacher (བླ་མ་) taught the dharma (ཆོས་) to his students.
      Compassion (སྙིང་རྗེ་) is the essence of the teachings.
      The Buddha (སངས་རྒྱས་) said that all beings seek happiness.
      In this text (འདི་ལ་) we find wisdom (ཤེས་རབ་).`;

      const result = extractor.extract(translation);

      // Should extract multiple terms
      expect(result.length).toBeGreaterThan(0);

      // All should have Tibetan text
      expect(result.every((t: TermPair) => /[\u0F00-\u0FFF]+/.test(t.tibetan))).toBe(true);

      // All should have English translation
      expect(result.every((t: TermPair) => t.english.length > 0)).toBe(true);

      // All should have confidence score
      expect(result.every((t: TermPair) => t.confidence > 0 && t.confidence <= 1)).toBe(true);
    });

    it('should handle mixed content with parentheses for other purposes', () => {
      const translation = `The year (2024) was significant. The Buddha (སངས་རྒྱས་) taught in ancient times (circa 500 BCE).`;

      const result = extractor.extract(translation);

      // Should only extract pairs with Tibetan text
      expect(result.every((t: TermPair) => /[\u0F00-\u0FFF]+/.test(t.tibetan))).toBe(true);

      // Should not extract "(2024)" or "(circa 500 BCE)"
      expect(result.some((t: TermPair) => t.tibetan === '2024')).toBe(false);
    });

    it('should handle terms with multiple English translations', () => {
      const translation = `The dharma (ཆོས་) or doctrine is profound.`;

      const result = extractor.extract(translation);

      // Should extract "dharma" or "doctrine" (implementation choice)
      expect(result.length).toBeGreaterThan(0);
      expect(result[0].tibetan).toMatch(/ཆོས/);
    });

    it('should extract high-confidence terms (>0.8)', () => {
      const translation = `Homage to the Precious Teacher (བླ་མ་རིན་པོ་ཆེ་).
      The Buddha (སངས་རྒྱས་) taught compassion (སྙིང་རྗེ་).
      The holy dharma (དམ་པའི་ཆོས་) is profound.`;

      const result = extractor.extract(translation);

      const highConfidence = result.filter((t: TermPair) => t.confidence > 0.8);

      // Multi-word capitalized terms should be high confidence
      expect(highConfidence.length).toBeGreaterThan(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle unbalanced parentheses', () => {
      const text = 'The teacher (བླ་མ་ taught wisdom (ཤེས་རབ་).';

      // Should not crash, may extract what it can
      expect(() => extractor.extract(text)).not.toThrow();
    });

    it('should handle Tibetan text with embedded English', () => {
      const text = 'The སངས་རྒྱས་ (Buddha) is revered.';

      // Should handle either format
      const result = extractor.extract(text);
      expect(() => extractor.extract(text)).not.toThrow();
    });

    it('should handle very long Tibetan terms', () => {
      const longTibetan = 'བླ་མ་དམ་པ་རིན་པོ་ཆེ་མཆོག་གི་ཞལ་སྔ་ནས་གསུང་པའི་ཆོས་ཀྱི་སྐོར་';
      const text = `The teaching (${longTibetan}) was given.`;

      const result = extractor.extract(text);

      expect(result.length).toBeGreaterThan(0);
      expect(result[0].tibetan.length).toBeGreaterThan(20);
    });

    it('should handle multiple parentheses on same line', () => {
      const text = 'Buddha (སངས་རྒྱས་) and dharma (ཆོས་) and sangha (དགེ་འདུན་).';

      const result = extractor.extract(text);

      expect(result.length).toBe(3);
    });

    it('should handle parentheses with extra whitespace', () => {
      const text = 'Buddha (  སངས་རྒྱས་  ) taught wisdom.';

      const result = extractor.extract(text);

      expect(result.length).toBeGreaterThan(0);
      expect(result[0].tibetan.trim()).toMatch(/སངས་རྒྱས/);
    });
  });
});
