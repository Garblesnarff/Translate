/**
 * FuzzyMatcher Unit Tests
 *
 * Comprehensive test suite for fuzzy name matching algorithms.
 * Tests all major functionality including:
 * - Levenshtein distance
 * - Phonetic matching
 * - Text normalization
 * - Tibetan name handling
 * - Entity comparison
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import {
  FuzzyMatcher,
  type SimilarityScore,
  type NameMatch,
  classifySimilarity,
  describeSimilarity,
} from './FuzzyMatcher';
import type { Entity, PersonEntity, PlaceEntity } from '../../types/entities';

describe('FuzzyMatcher', () => {
  let matcher: FuzzyMatcher;

  beforeEach(() => {
    matcher = new FuzzyMatcher();
  });

  // ============================================================================
  // Basic Similarity Tests
  // ============================================================================

  describe('calculateSimilarity', () => {
    it('should return 1.0 for exact matches', () => {
      const score = matcher.calculateSimilarity('Marpa', 'Marpa');
      expect(score.score).toBe(1.0);
      expect(score.matchType).toBe('exact');
    });

    it('should handle case-insensitive matching', () => {
      const score = matcher.calculateSimilarity('MARPA', 'marpa');
      expect(score.score).toBe(1.0);
    });

    it('should detect known transliteration variants', () => {
      const score = matcher.calculateSimilarity('mar pa', 'marpa');
      expect(score.score).toBeGreaterThan(0.95);
      expect(score.matchType).toBe('transliteration');
    });

    it('should score similar names highly', () => {
      const score = matcher.calculateSimilarity('Marpa', 'Mar-pa');
      expect(score.score).toBeGreaterThan(0.9);
    });

    it('should score dissimilar names low', () => {
      const score = matcher.calculateSimilarity('Marpa', 'Milarepa');
      expect(score.score).toBeLessThan(0.7);
    });

    it('should handle empty strings', () => {
      const score = matcher.calculateSimilarity('', '');
      expect(score.score).toBe(1.0);
    });

    it('should penalize very different lengths', () => {
      const score = matcher.calculateSimilarity(
        'Marpa',
        'Marpa Lotsawa Chökyi Lodrö of the Drugpa Kagyu'
      );
      expect(score.score).toBeLessThan(0.8);
      expect(score.components.lengthPenalty).toBeLessThan(0.8);
    });
  });

  // ============================================================================
  // Levenshtein Distance Tests
  // ============================================================================

  describe('calculateLevenshteinDistance', () => {
    it('should return 0 for identical strings', () => {
      expect(matcher.calculateLevenshteinDistance('marpa', 'marpa')).toBe(0);
    });

    it('should calculate insertion distance', () => {
      expect(matcher.calculateLevenshteinDistance('marpa', 'mar-pa')).toBe(1);
    });

    it('should calculate deletion distance', () => {
      expect(matcher.calculateLevenshteinDistance('marpa', 'mara')).toBe(1);
    });

    it('should calculate substitution distance', () => {
      expect(matcher.calculateLevenshteinDistance('marpa', 'marba')).toBe(1);
    });

    it('should handle multiple operations', () => {
      expect(matcher.calculateLevenshteinDistance('marpa', 'milarepa')).toBe(5);
    });

    it('should handle empty strings', () => {
      expect(matcher.calculateLevenshteinDistance('', '')).toBe(0);
      expect(matcher.calculateLevenshteinDistance('marpa', '')).toBe(5);
      expect(matcher.calculateLevenshteinDistance('', 'marpa')).toBe(5);
    });
  });

  // ============================================================================
  // Phonetic Matching Tests
  // ============================================================================

  describe('phoneticMatch', () => {
    it('should match phonetically similar names', () => {
      expect(matcher.phoneticMatch('Marpa', 'Marpah')).toBe(true);
      expect(matcher.phoneticMatch('Smith', 'Smythe')).toBe(true);
      expect(matcher.phoneticMatch('Robert', 'Rupert')).toBe(true);
    });

    it('should not match phonetically different names', () => {
      expect(matcher.phoneticMatch('Marpa', 'Milarepa')).toBe(false);
      expect(matcher.phoneticMatch('Smith', 'Johnson')).toBe(false);
    });

    it('should handle case insensitivity', () => {
      expect(matcher.phoneticMatch('MARPA', 'marpa')).toBe(true);
    });

    it('should ignore punctuation', () => {
      expect(matcher.phoneticMatch('Mar-pa', 'Marpa')).toBe(true);
    });
  });

  // ============================================================================
  // Text Normalization Tests
  // ============================================================================

  describe('normalizeText', () => {
    it('should convert to lowercase', () => {
      expect(matcher.normalizeText('MARPA')).toBe('marpa');
    });

    it('should remove diacritics', () => {
      expect(matcher.normalizeText('Pāramitā')).toBe('paramita');
      expect(matcher.normalizeText('Tsongkhapā')).toBe('tsongkhapa');
      expect(matcher.normalizeText('Śāntideva')).toBe('santideva');
    });

    it('should strip Tibetan honorifics', () => {
      expect(matcher.normalizeText('Marpa Rinpoche')).toBe('marpa');
      expect(matcher.normalizeText('Rinpoche Marpa')).toBe('marpa');
      expect(matcher.normalizeText('Lama Tsongkhapa')).toBe('tsongkhapa');
      expect(matcher.normalizeText('Je Tsongkhapa')).toBe('tsongkhapa');
      expect(matcher.normalizeText('Marpa Lotsawa')).toBe('marpa');
    });

    it('should remove punctuation', () => {
      expect(matcher.normalizeText('Mar-pa')).toBe('mar pa');
      expect(matcher.normalizeText('Marpa, Lotsawa')).toBe('marpa lotsawa');
      expect(matcher.normalizeText('མར་པ།')).toContain('མར པ');
    });

    it('should collapse multiple spaces', () => {
      expect(matcher.normalizeText('Marpa   Lotsawa')).toBe('marpa lotsawa');
    });

    it('should handle complex names', () => {
      const input = 'རྗེ་བཙུན། Jetsun Milarépa Rinpoche';
      const normalized = matcher.normalizeText(input);
      expect(normalized).toContain('jetsun');
      expect(normalized).toContain('milarepa');
      expect(normalized).not.toContain('rinpoche');
    });
  });

  // ============================================================================
  // Tibetan-Specific Tests
  // ============================================================================

  describe('Tibetan name handling', () => {
    it('should match Wylie and phonetic variants', () => {
      const tests = [
        ['mar pa', 'marpa'],
        ['tsong kha pa', 'tsongkhapa'],
        ['pad+ma', 'padma'],
        ['sa skya', 'sakya'],
        ['bka\' brgyud', 'kagyu'],
      ];

      tests.forEach(([wylie, phonetic]) => {
        const score = matcher.calculateSimilarity(wylie, phonetic);
        expect(score.score).toBeGreaterThan(0.85);
      });
    });

    it('should handle multiple phonetic variants', () => {
      const score1 = matcher.calculateSimilarity('pad+ma', 'padma');
      const score2 = matcher.calculateSimilarity('pad+ma', 'pema');

      expect(score1.score).toBeGreaterThan(0.85);
      expect(score2.score).toBeGreaterThan(0.85);
    });

    it('should match Milarepa variants', () => {
      const variants = ['mi la', 'mila', 'milarepa'];

      for (let i = 0; i < variants.length; i++) {
        for (let j = i + 1; j < variants.length; j++) {
          const score = matcher.calculateSimilarity(variants[i], variants[j]);
          expect(score.score).toBeGreaterThan(0.75);
        }
      }
    });

    it('should distinguish different traditions', () => {
      const score = matcher.calculateSimilarity('rnying ma', 'dge lugs');
      expect(score.score).toBeLessThan(0.5);
    });
  });

  // ============================================================================
  // Entity Comparison Tests
  // ============================================================================

  describe('compareEntities', () => {
    it('should find best match across all name variants', () => {
      const entity1: PersonEntity = {
        id: '1',
        type: 'person',
        canonicalName: 'Marpa',
        names: {
          tibetan: ['མར་པ།'],
          english: ['Marpa', 'Marpa Lotsawa'],
          wylie: ['mar pa', 'mar pa lo tsā ba'],
          phonetic: ['Marpa', 'Marpha'],
        },
        confidence: 0.9,
        verified: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: 'ai',
        attributes: {
          roles: ['translator'],
        },
      };

      const entity2: PersonEntity = {
        id: '2',
        type: 'person',
        canonicalName: 'Mar-pa the Translator',
        names: {
          tibetan: [],
          english: ['Mar-pa', 'Marpa the Translator'],
          wylie: ['mar pa'],
          phonetic: ['Marpa'],
        },
        confidence: 0.85,
        verified: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: 'ai',
        attributes: {
          roles: ['translator'],
        },
      };

      const score = matcher.compareEntities(entity1, entity2);
      expect(score.score).toBeGreaterThan(0.95);
    });

    it('should detect different entities with similar names', () => {
      const entity1: PersonEntity = {
        id: '1',
        type: 'person',
        canonicalName: 'Sakya Pandita',
        names: {
          tibetan: [],
          english: ['Sakya Pandita'],
          wylie: ['sa skya pandita'],
          phonetic: [],
        },
        confidence: 0.9,
        verified: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: 'ai',
        attributes: {
          roles: ['scholar'],
        },
      };

      const entity2: PlaceEntity = {
        id: '2',
        type: 'place',
        canonicalName: 'Sakya Monastery',
        names: {
          tibetan: [],
          english: ['Sakya', 'Sakya Monastery'],
          wylie: ['sa skya'],
          phonetic: [],
        },
        confidence: 0.85,
        verified: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: 'ai',
        attributes: {
          placeType: 'monastery',
        },
      };

      const score = matcher.compareEntities(entity1, entity2);
      // Should score medium (place name in person's name) but not high enough to auto-merge
      expect(score.score).toBeGreaterThan(0.6);
      expect(score.score).toBeLessThan(0.9);
    });
  });

  // ============================================================================
  // Find Similar Names Tests
  // ============================================================================

  describe('findSimilarNames', () => {
    const candidates: PersonEntity[] = [
      {
        id: '1',
        type: 'person',
        canonicalName: 'Marpa Lotsawa',
        names: {
          tibetan: ['མར་པ།'],
          english: ['Marpa Lotsawa', 'Marpa the Translator'],
          wylie: ['mar pa lo tsā ba'],
          phonetic: ['Marpa'],
        },
        confidence: 0.9,
        verified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: 'human',
        attributes: { roles: ['translator'] },
      },
      {
        id: '2',
        type: 'person',
        canonicalName: 'Milarepa',
        names: {
          tibetan: ['མི་ལ་རས་པ།'],
          english: ['Milarepa', 'Jetsun Milarepa'],
          wylie: ['mi la ras pa'],
          phonetic: ['Milarepa', 'Mila'],
        },
        confidence: 0.95,
        verified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: 'human',
        attributes: { roles: ['yogi'] },
      },
      {
        id: '3',
        type: 'person',
        canonicalName: 'Gampopa',
        names: {
          tibetan: ['སྒམ་པོ་པ།'],
          english: ['Gampopa', 'Dakpo Lhaje'],
          wylie: ['sgam po pa'],
          phonetic: ['Gampopa'],
        },
        confidence: 0.88,
        verified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: 'human',
        attributes: { roles: ['teacher'] },
      },
    ];

    it('should find exact and close matches', () => {
      const matches = matcher.findSimilarNames('Marpa', candidates, {
        threshold: 0.85,
      });

      expect(matches.length).toBeGreaterThan(0);
      expect(matches[0].candidate.canonicalName).toBe('Marpa Lotsawa');
      expect(matches[0].score.score).toBeGreaterThan(0.85);
    });

    it('should respect threshold', () => {
      const matches = matcher.findSimilarNames('Marpa', candidates, {
        threshold: 0.99, // Very high threshold
      });

      // Should only get near-exact matches
      expect(matches.length).toBeLessThanOrEqual(1);
    });

    it('should respect limit', () => {
      const matches = matcher.findSimilarNames('a', candidates, {
        threshold: 0.1, // Very low to get many matches
        limit: 2,
      });

      expect(matches.length).toBeLessThanOrEqual(2);
    });

    it('should sort by score descending', () => {
      const matches = matcher.findSimilarNames('Marpa', candidates, {
        threshold: 0.5,
      });

      for (let i = 0; i < matches.length - 1; i++) {
        expect(matches[i].score.score).toBeGreaterThanOrEqual(
          matches[i + 1].score.score
        );
      }
    });

    it('should find partial name matches', () => {
      const matches = matcher.findSimilarNames('Mila', candidates, {
        threshold: 0.75,
      });

      const milarepaMatch = matches.find(
        m => m.candidate.canonicalName === 'Milarepa'
      );
      expect(milarepaMatch).toBeDefined();
    });
  });

  // ============================================================================
  // Threshold Recommendation Tests
  // ============================================================================

  describe('getRecommendedThreshold', () => {
    it('should return highest threshold for auto-merge', () => {
      const threshold = matcher.getRecommendedThreshold('auto_merge');
      expect(threshold).toBe(0.95);
    });

    it('should return medium threshold for review queue', () => {
      const threshold = matcher.getRecommendedThreshold('review_queue');
      expect(threshold).toBe(0.85);
    });

    it('should return lowest threshold for exploration', () => {
      const threshold = matcher.getRecommendedThreshold('exploration');
      expect(threshold).toBe(0.75);
    });
  });

  // ============================================================================
  // Helper Function Tests
  // ============================================================================

  describe('classifySimilarity', () => {
    it('should classify high scores correctly', () => {
      expect(classifySimilarity(0.97)).toBe('very_likely_same');
      expect(classifySimilarity(0.95)).toBe('very_likely_same');
    });

    it('should classify medium-high scores correctly', () => {
      expect(classifySimilarity(0.90)).toBe('likely_same');
      expect(classifySimilarity(0.85)).toBe('likely_same');
    });

    it('should classify medium scores correctly', () => {
      expect(classifySimilarity(0.80)).toBe('possibly_same');
      expect(classifySimilarity(0.75)).toBe('possibly_same');
    });

    it('should classify low scores correctly', () => {
      expect(classifySimilarity(0.70)).toBe('probably_different');
      expect(classifySimilarity(0.50)).toBe('probably_different');
    });
  });

  describe('describeSimilarity', () => {
    it('should provide human-readable descriptions', () => {
      expect(describeSimilarity(0.97)).toBe('Very likely the same entity');
      expect(describeSimilarity(0.90)).toBe('Likely the same entity');
      expect(describeSimilarity(0.80)).toBe('Possibly the same entity');
      expect(describeSimilarity(0.60)).toBe('Probably different entities');
      expect(describeSimilarity(0.30)).toBe('Definitely different entities');
    });
  });

  // ============================================================================
  // Edge Case Tests
  // ============================================================================

  describe('edge cases', () => {
    it('should handle unicode characters', () => {
      const score = matcher.calculateSimilarity('མར་པ།', 'མར་པ།');
      expect(score.score).toBe(1.0);
    });

    it('should handle very long names', () => {
      const long1 = 'a'.repeat(1000);
      const long2 = 'a'.repeat(1000);
      const score = matcher.calculateSimilarity(long1, long2);
      expect(score.score).toBe(1.0);
    });

    it('should handle special characters', () => {
      const score = matcher.calculateSimilarity(
        'Mar-pa (lo-tsā-ba)',
        'Marpa Lotsawa'
      );
      expect(score.score).toBeGreaterThan(0.8);
    });

    it('should handle mixed scripts', () => {
      const score = matcher.calculateSimilarity(
        'མར་པ། Marpa',
        'Marpa མར་པ།'
      );
      expect(score.score).toBeGreaterThan(0.9);
    });

    it('should not crash on null or undefined', () => {
      // TypeScript should prevent this, but test runtime safety
      expect(() => {
        matcher.calculateSimilarity(null as any, 'test');
      }).not.toThrow();
    });
  });

  // ============================================================================
  // Real-World Examples
  // ============================================================================

  describe('real-world examples', () => {
    it('should match Dalai Lama variants', () => {
      const variants = [
        'Dalai Lama',
        'དལའི་བླ་མ།',
        "tā la'i bla ma",
        'His Holiness the Dalai Lama',
      ];

      // Compare first variant with others
      for (let i = 1; i < variants.length; i++) {
        const score = matcher.calculateSimilarity(variants[0], variants[i]);
        // Even with honorifics, should score reasonably high
        expect(score.score).toBeGreaterThan(0.6);
      }
    });

    it('should match Atisha variants', () => {
      const score = matcher.calculateSimilarity('Atisha', 'Jo bo rje Atisha');
      expect(score.score).toBeGreaterThan(0.75);
    });

    it('should distinguish Sakya Pandita from Sakya', () => {
      const score = matcher.calculateSimilarity('Sakya Pandita', 'Sakya');
      // Should be medium score (substring match) but not high enough for auto-merge
      expect(score.score).toBeGreaterThan(0.5);
      expect(score.score).toBeLessThan(0.85);
    });

    it('should match Tsongkhapa variants', () => {
      const variants = ['Tsongkhapa', 'tsong kha pa', 'Je Tsongkhapa', 'Lobsang Drakpa'];

      // First three should match well
      const score1 = matcher.calculateSimilarity(variants[0], variants[1]);
      const score2 = matcher.calculateSimilarity(variants[0], variants[2]);

      expect(score1.score).toBeGreaterThan(0.90);
      expect(score2.score).toBeGreaterThan(0.85);

      // Birth name should be different
      const score3 = matcher.calculateSimilarity(variants[0], variants[3]);
      expect(score3.score).toBeLessThan(0.5);
    });
  });
});
