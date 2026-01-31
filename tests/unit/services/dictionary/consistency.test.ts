/**
 * ConsistencyTracker Tests (Task 2.4.2.1)
 *
 * Comprehensive test suite for the ConsistencyTracker class.
 * Tests terminology consistency tracking and inconsistency detection.
 *
 * Test Coverage:
 * - Track translations for each Tibetan term
 * - Detect inconsistencies (same Tibetan → different English)
 * - Calculate severity levels (low, medium, high)
 * - Suggest most common translation
 * - Report inconsistency statistics
 * - Handle edge cases (variants, similar meanings)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  ConsistencyTracker,
  type TermPair,
  type InconsistencyReport,
  type ConsistencyStats,
} from '../../../../server/services/dictionary/ConsistencyTracker.js';

describe('ConsistencyTracker', () => {
  let tracker: ConsistencyTracker;

  beforeEach(() => {
    tracker = new ConsistencyTracker();
  });

  describe('add()', () => {
    it('should add term pairs to tracker', () => {
      const term: TermPair = {
        tibetan: 'སངས་རྒྱས',
        english: 'Buddha',
        confidence: 0.9,
      };

      tracker.add(term);

      const stats = tracker.getStats();
      expect(stats.totalTerms).toBeGreaterThanOrEqual(1);
    });

    it('should handle multiple occurrences of same term', () => {
      const term1: TermPair = {
        tibetan: 'སངས་རྒྱས',
        english: 'Buddha',
        confidence: 0.9,
      };

      const term2: TermPair = {
        tibetan: 'སངས་རྒྱས',
        english: 'Buddha',
        confidence: 0.92,
      };

      tracker.add(term1);
      tracker.add(term2);

      const inconsistencies = tracker.checkConsistency();

      // Same translation - should be consistent
      expect(inconsistencies.length).toBe(0);
    });

    it('should track different translations for same Tibetan term', () => {
      const term1: TermPair = {
        tibetan: 'སངས་རྒྱས',
        english: 'Buddha',
        confidence: 0.9,
      };

      const term2: TermPair = {
        tibetan: 'སངས་རྒྱས',
        english: 'Enlightened One',
        confidence: 0.88,
      };

      tracker.add(term1);
      tracker.add(term2);

      const inconsistencies = tracker.checkConsistency();

      // Different translations - should detect inconsistency
      expect(inconsistencies.length).toBeGreaterThan(0);
      expect(inconsistencies[0].tibetan).toBe('སངས་རྒྱས');
      expect(inconsistencies[0].translations).toContain('Buddha');
      expect(inconsistencies[0].translations).toContain('Enlightened One');
    });
  });

  describe('checkConsistency()', () => {
    it('should detect inconsistencies', () => {
      tracker.add({ tibetan: 'ཆོས', english: 'dharma', confidence: 0.9 });
      tracker.add({ tibetan: 'ཆོས', english: 'doctrine', confidence: 0.85 });
      tracker.add({ tibetan: 'ཆོས', english: 'teaching', confidence: 0.87 });

      const inconsistencies = tracker.checkConsistency();

      expect(inconsistencies.length).toBeGreaterThan(0);

      const dhosInconsistency = inconsistencies.find(i => i.tibetan === 'ཆོས');
      expect(dhosInconsistency).toBeDefined();

      if (dhosInconsistency) {
        expect(dhosInconsistency.translations.length).toBe(3);
        expect(dhosInconsistency.count).toBe(3);
      }
    });

    it('should calculate severity: low (2 variants)', () => {
      tracker.add({ tibetan: 'སྙིང་རྗེ', english: 'compassion', confidence: 0.9 });
      tracker.add({ tibetan: 'སྙིང་རྗེ', english: 'loving-kindness', confidence: 0.88 });

      const inconsistencies = tracker.checkConsistency();

      const report = inconsistencies.find(i => i.tibetan === 'སྙིང་རྗེ');
      expect(report).toBeDefined();

      if (report) {
        expect(report.severity).toBe('low');
        expect(report.translations.length).toBe(2);
      }
    });

    it('should calculate severity: medium (3 variants)', () => {
      tracker.add({ tibetan: 'བླ་མ', english: 'lama', confidence: 0.9 });
      tracker.add({ tibetan: 'བླ་མ', english: 'guru', confidence: 0.88 });
      tracker.add({ tibetan: 'བླ་མ', english: 'spiritual teacher', confidence: 0.92 });

      const inconsistencies = tracker.checkConsistency();

      const report = inconsistencies.find(i => i.tibetan === 'བླ་མ');
      expect(report).toBeDefined();

      if (report) {
        expect(report.severity).toBe('medium');
        expect(report.translations.length).toBe(3);
      }
    });

    it('should calculate severity: high (4+ variants)', () => {
      tracker.add({ tibetan: 'རིག་པ', english: 'awareness', confidence: 0.9 });
      tracker.add({ tibetan: 'རིག་པ', english: 'consciousness', confidence: 0.88 });
      tracker.add({ tibetan: 'རིག་པ', english: 'knowledge', confidence: 0.85 });
      tracker.add({ tibetan: 'རིག་པ', english: 'cognition', confidence: 0.87 });

      const inconsistencies = tracker.checkConsistency();

      const report = inconsistencies.find(i => i.tibetan === 'རིག་པ');
      expect(report).toBeDefined();

      if (report) {
        expect(report.severity).toBe('high');
        expect(report.translations.length).toBe(4);
      }
    });

    it('should suggest most common translation', () => {
      // Buddha appears 3 times
      tracker.add({ tibetan: 'སངས་རྒྱས', english: 'Buddha', confidence: 0.9 });
      tracker.add({ tibetan: 'སངས་རྒྱས', english: 'Buddha', confidence: 0.92 });
      tracker.add({ tibetan: 'སངས་རྒྱས', english: 'Buddha', confidence: 0.88 });

      // Enlightened One appears 1 time
      tracker.add({ tibetan: 'སངས་རྒྱས', english: 'Enlightened One', confidence: 0.85 });

      const inconsistencies = tracker.checkConsistency();

      const report = inconsistencies.find(i => i.tibetan === 'སངས་རྒྱས');
      expect(report).toBeDefined();

      if (report) {
        expect(report.suggestion).toBe('Buddha'); // Most common
      }
    });

    it('should handle consistent terms (no inconsistencies)', () => {
      tracker.add({ tibetan: 'སངས་རྒྱས', english: 'Buddha', confidence: 0.9 });
      tracker.add({ tibetan: 'སངས་རྒྱས', english: 'Buddha', confidence: 0.92 });
      tracker.add({ tibetan: 'སངས་རྒྱས', english: 'Buddha', confidence: 0.88 });

      const inconsistencies = tracker.checkConsistency();

      // Should not report as inconsistency if all translations are identical
      const buddhaReport = inconsistencies.find(i => i.tibetan === 'སངས་རྒྱས');
      expect(buddhaReport).toBeUndefined();
    });

    it('should return empty array if no terms tracked', () => {
      const inconsistencies = tracker.checkConsistency();
      expect(inconsistencies).toEqual([]);
    });

    it('should handle case-sensitive differences', () => {
      tracker.add({ tibetan: 'བོད', english: 'tibet', confidence: 0.9 });
      tracker.add({ tibetan: 'བོད', english: 'Tibet', confidence: 0.92 });

      const inconsistencies = tracker.checkConsistency();

      // Should treat "tibet" and "Tibet" as different
      expect(inconsistencies.length).toBeGreaterThan(0);
    });

    it('should normalize whitespace in English translations', () => {
      tracker.add({ tibetan: 'བླ་མ', english: 'spiritual teacher', confidence: 0.9 });
      tracker.add({ tibetan: 'བླ་མ', english: 'spiritual  teacher', confidence: 0.88 }); // Extra space

      const inconsistencies = tracker.checkConsistency();

      // Should normalize whitespace - these should be considered the same
      expect(inconsistencies.length).toBe(0);
    });
  });

  describe('getMostCommon()', () => {
    it('should return most frequent translation', () => {
      tracker.add({ tibetan: 'སངས་རྒྱས', english: 'Buddha', confidence: 0.9 });
      tracker.add({ tibetan: 'སངས་རྒྱས', english: 'Buddha', confidence: 0.92 });
      tracker.add({ tibetan: 'སངས་རྒྱས', english: 'Buddha', confidence: 0.88 });
      tracker.add({ tibetan: 'སངས་རྒྱས', english: 'Enlightened One', confidence: 0.85 });

      const mostCommon = tracker.getMostCommon('སངས་རྒྱས');
      expect(mostCommon).toBe('Buddha');
    });

    it('should return first translation if tied', () => {
      tracker.add({ tibetan: 'ཆོས', english: 'dharma', confidence: 0.9 });
      tracker.add({ tibetan: 'ཆོས', english: 'teaching', confidence: 0.88 });

      const mostCommon = tracker.getMostCommon('ཆོས');

      // Should return one of them (implementation may choose first or random)
      expect(['dharma', 'teaching']).toContain(mostCommon);
    });

    it('should return empty string for unknown term', () => {
      const mostCommon = tracker.getMostCommon('unknown');
      expect(mostCommon).toBe('');
    });

    it('should handle single occurrence', () => {
      tracker.add({ tibetan: 'བོད', english: 'Tibet', confidence: 0.9 });

      const mostCommon = tracker.getMostCommon('བོད');
      expect(mostCommon).toBe('Tibet');
    });
  });

  describe('getStats()', () => {
    it('should return correct statistics', () => {
      // Consistent term
      tracker.add({ tibetan: 'སངས་རྒྱས', english: 'Buddha', confidence: 0.9 });
      tracker.add({ tibetan: 'སངས་རྒྱས', english: 'Buddha', confidence: 0.92 });

      // Inconsistent term (low severity)
      tracker.add({ tibetan: 'ཆོས', english: 'dharma', confidence: 0.9 });
      tracker.add({ tibetan: 'ཆོས', english: 'teaching', confidence: 0.88 });

      // Inconsistent term (medium severity)
      tracker.add({ tibetan: 'བླ་མ', english: 'lama', confidence: 0.9 });
      tracker.add({ tibetan: 'བླ་མ', english: 'guru', confidence: 0.88 });
      tracker.add({ tibetan: 'བླ་མ', english: 'teacher', confidence: 0.85 });

      const stats = tracker.getStats();

      expect(stats.totalTerms).toBe(3); // 3 unique Tibetan terms
      expect(stats.consistentTerms).toBe(1); // སངས་རྒྱས
      expect(stats.inconsistentTerms).toBe(2); // ཆོས and བླ་མ
      expect(stats.severityBreakdown.low).toBe(1); // ཆོས (2 variants)
      expect(stats.severityBreakdown.medium).toBe(1); // བླ་མ (3 variants)
      expect(stats.severityBreakdown.high).toBe(0); // none
    });

    it('should return zeros for empty tracker', () => {
      const stats = tracker.getStats();

      expect(stats.totalTerms).toBe(0);
      expect(stats.consistentTerms).toBe(0);
      expect(stats.inconsistentTerms).toBe(0);
      expect(stats.severityBreakdown.low).toBe(0);
      expect(stats.severityBreakdown.medium).toBe(0);
      expect(stats.severityBreakdown.high).toBe(0);
    });

    it('should count all consistent terms', () => {
      tracker.add({ tibetan: 'སངས་རྒྱས', english: 'Buddha', confidence: 0.9 });
      tracker.add({ tibetan: 'སངས་རྒྱས', english: 'Buddha', confidence: 0.92 });

      tracker.add({ tibetan: 'ཆོས', english: 'dharma', confidence: 0.9 });
      tracker.add({ tibetan: 'ཆོས', english: 'dharma', confidence: 0.88 });

      tracker.add({ tibetan: 'སྙིང་རྗེ', english: 'compassion', confidence: 0.9 });
      tracker.add({ tibetan: 'སྙིང་རྗེ', english: 'compassion', confidence: 0.87 });

      const stats = tracker.getStats();

      expect(stats.totalTerms).toBe(3);
      expect(stats.consistentTerms).toBe(3);
      expect(stats.inconsistentTerms).toBe(0);
    });

    it('should handle single occurrences as consistent', () => {
      tracker.add({ tibetan: 'བོད', english: 'Tibet', confidence: 0.9 });

      const stats = tracker.getStats();

      expect(stats.totalTerms).toBe(1);
      expect(stats.consistentTerms).toBe(1); // Single occurrence is consistent
      expect(stats.inconsistentTerms).toBe(0);
    });
  });

  describe('clear()', () => {
    it('should clear all tracked terms', () => {
      tracker.add({ tibetan: 'སངས་རྒྱས', english: 'Buddha', confidence: 0.9 });
      tracker.add({ tibetan: 'ཆོས', english: 'dharma', confidence: 0.88 });

      tracker.clear();

      const stats = tracker.getStats();
      expect(stats.totalTerms).toBe(0);
    });

    it('should allow adding terms after clear', () => {
      tracker.add({ tibetan: 'སངས་རྒྱས', english: 'Buddha', confidence: 0.9 });
      tracker.clear();

      tracker.add({ tibetan: 'ཆོས', english: 'dharma', confidence: 0.88 });

      const stats = tracker.getStats();
      expect(stats.totalTerms).toBe(1);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty Tibetan text', () => {
      tracker.add({ tibetan: '', english: 'test', confidence: 0.9 });

      // Should handle gracefully (might ignore or track)
      expect(() => tracker.checkConsistency()).not.toThrow();
    });

    it('should handle empty English text', () => {
      tracker.add({ tibetan: 'བོད', english: '', confidence: 0.9 });

      expect(() => tracker.checkConsistency()).not.toThrow();
    });

    it('should handle very long translation lists', () => {
      // Add 100 different translations for same term
      for (let i = 0; i < 100; i++) {
        tracker.add({
          tibetan: 'test',
          english: `translation-${i}`,
          confidence: 0.8,
        });
      }

      const inconsistencies = tracker.checkConsistency();
      const report = inconsistencies.find(i => i.tibetan === 'test');

      expect(report).toBeDefined();
      if (report) {
        expect(report.severity).toBe('high'); // 100 variants = high severity
        expect(report.translations.length).toBe(100);
      }
    });

    it('should handle Tibetan terms with punctuation', () => {
      tracker.add({ tibetan: 'སངས་རྒྱས།', english: 'Buddha', confidence: 0.9 });
      tracker.add({ tibetan: 'སངས་རྒྱས།', english: 'Enlightened One', confidence: 0.88 });

      const inconsistencies = tracker.checkConsistency();

      // Should handle punctuation correctly
      expect(inconsistencies.length).toBeGreaterThan(0);
    });

    it('should handle special characters in English', () => {
      tracker.add({ tibetan: 'བོད', english: 'Tibét', confidence: 0.9 });
      tracker.add({ tibetan: 'བོད', english: 'Tibet', confidence: 0.88 });

      const inconsistencies = tracker.checkConsistency();

      // Should treat as different due to accent
      expect(inconsistencies.length).toBeGreaterThan(0);
    });
  });

  describe('Integration', () => {
    it('should work with real-world terminology patterns', () => {
      // Simulate translations from multiple documents
      const terms = [
        // Document 1: Formal academic style
        { tibetan: 'སངས་རྒྱས', english: 'the Buddha', confidence: 0.92 },
        { tibetan: 'ཆོས', english: 'Dharma', confidence: 0.90 },
        { tibetan: 'བླ་མ', english: 'spiritual teacher', confidence: 0.88 },

        // Document 2: Modern casual style
        { tibetan: 'སངས་རྒྱས', english: 'Buddha', confidence: 0.91 },
        { tibetan: 'ཆོས', english: 'teachings', confidence: 0.87 },
        { tibetan: 'བླ་མ', english: 'lama', confidence: 0.89 },

        // Document 3: Traditional style
        { tibetan: 'སངས་རྒྱས', english: 'Enlightened One', confidence: 0.93 },
        { tibetan: 'ཆོས', english: 'doctrine', confidence: 0.91 },
        { tibetan: 'བླ་མ', english: 'guru', confidence: 0.90 },
      ];

      terms.forEach(term => tracker.add(term));

      const inconsistencies = tracker.checkConsistency();
      const stats = tracker.getStats();

      // Should detect all 3 terms as inconsistent
      expect(stats.inconsistentTerms).toBe(3);
      expect(inconsistencies.length).toBe(3);

      // Each should have 3 variants (medium severity)
      inconsistencies.forEach(report => {
        expect(report.translations.length).toBe(3);
        expect(report.severity).toBe('medium');
      });
    });
  });
});
