/**
 * Unit tests for QualityScorer
 *
 * Tests quality scoring system for translation results
 * Following TDD methodology - tests written before implementation
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { QualityScorer } from '../../../../server/services/quality/QualityScorer';

describe('QualityScorer', () => {
  let scorer: QualityScorer;

  beforeEach(() => {
    scorer = new QualityScorer();
  });

  describe('Overall Score Calculation', () => {
    it('should calculate weighted average of all scores', () => {
      const original = 'སངས་རྒྱས་ཆོས་དང་ཚོགས་ཀྱི་མཆོག་རྣམས་ལ།';
      const result = {
        translation: 'I take refuge in the Buddha, Dharma and Sangha (སངས་རྒྱས་ཆོས་དང་ཚོགས་ཀྱི་མཆོག་རྣམས་ལ།)',
        confidence: 0.9,
      };

      const quality = scorer.score(result, original);

      // Overall score should be weighted average
      expect(quality.overall).toBeGreaterThan(0);
      expect(quality.overall).toBeLessThanOrEqual(1);

      // Check weights are applied: confidence (40%), format (30%), preservation (30%)
      const expectedScore = (
        quality.confidence * 0.4 +
        quality.format * 0.3 +
        quality.preservation * 0.3
      );

      expect(quality.overall).toBeCloseTo(expectedScore, 2);
    });

    it('should return score between 0 and 1', () => {
      const original = 'སངས་རྒྱས་';
      const result = {
        translation: 'Buddha (སངས་རྒྱས་)',
        confidence: 0.85,
      };

      const quality = scorer.score(result, original);

      expect(quality.overall).toBeGreaterThanOrEqual(0);
      expect(quality.overall).toBeLessThanOrEqual(1);
    });

    it('should handle perfect translation', () => {
      const original = 'སངས་རྒྱས་ཆོས་དང་ཚོགས་ཀྱི་མཆོག་རྣམས་ལ།';
      const result = {
        translation: 'I take refuge in the Buddha, Dharma and Sangha (སངས་རྒྱས་ཆོས་དང་ཚོགས་ཀྱི་མཆོག་རྣམས་ལ།)',
        confidence: 1.0,
      };

      const quality = scorer.score(result, original);

      expect(quality.overall).toBeGreaterThan(0.9);
      expect(quality.confidence).toBe(1.0);
      expect(quality.format).toBe(1.0);
      expect(quality.preservation).toBeGreaterThan(0.95);
    });

    it('should handle poor translation', () => {
      const original = 'སངས་རྒྱས་ཆོས་དང་ཚོགས་ཀྱི་མཆོག་རྣམས་ལ།';
      const result = {
        translation: 'Some text here',
        confidence: 0.3,
      };

      const quality = scorer.score(result, original);

      expect(quality.overall).toBeLessThan(0.5);
    });
  });

  describe('Confidence Scoring', () => {
    it('should use model confidence directly', () => {
      const original = 'སངས་རྒྱས་';
      const result = {
        translation: 'Buddha (སངས་རྒྱས་)',
        confidence: 0.85,
      };

      const quality = scorer.score(result, original);

      expect(quality.confidence).toBe(0.85);
    });

    it('should default to 0.5 if confidence not provided', () => {
      const original = 'སངས་རྒྱས་';
      const result = {
        translation: 'Buddha (སངས་རྒྱས་)',
      };

      const quality = scorer.score(result, original);

      expect(quality.confidence).toBe(0.5);
    });

    it('should clamp confidence to [0, 1] range', () => {
      const original = 'སངས་རྒྱས་';

      // Test > 1
      let result = {
        translation: 'Buddha (སངས་རྒྱས་)',
        confidence: 1.5,
      };
      let quality = scorer.score(result, original);
      expect(quality.confidence).toBeLessThanOrEqual(1);

      // Test < 0
      result = {
        translation: 'Buddha (སངས་རྒྱས་)',
        confidence: -0.5,
      };
      quality = scorer.score(result, original);
      expect(quality.confidence).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Format Scoring', () => {
    it('should give 1.0 for perfect format', () => {
      const original = 'སངས་རྒྱས་';
      const result = {
        translation: 'Buddha (སངས་རྒྱས་)',
        confidence: 0.9,
      };

      const quality = scorer.score(result, original);

      expect(quality.format).toBe(1.0);
    });

    it('should give 0.0 for wrong format (no parentheses)', () => {
      const original = 'སངས་རྒྱས་';
      const result = {
        translation: 'Buddha',
        confidence: 0.9,
      };

      const quality = scorer.score(result, original);

      expect(quality.format).toBe(0.0);
    });

    it('should give 0.0 for format without Tibetan in parentheses', () => {
      const original = 'སངས་རྒྱས་';
      const result = {
        translation: 'Buddha (enlightened one)',
        confidence: 0.9,
      };

      const quality = scorer.score(result, original);

      expect(quality.format).toBe(0.0);
    });

    it('should score format with multiple segments', () => {
      const original = 'སངས་རྒྱས་ ཆོས་';
      const result = {
        translation: 'Buddha (སངས་རྒྱས་) and Dharma (ཆོས་)',
        confidence: 0.9,
      };

      const quality = scorer.score(result, original);

      expect(quality.format).toBe(1.0);
    });

    it('should detect AI refusal patterns and score 0.0', () => {
      const original = 'སངས་རྒྱས་';
      const result = {
        translation: 'I cannot translate this text',
        confidence: 0.9,
      };

      const quality = scorer.score(result, original);

      expect(quality.format).toBe(0.0);
    });
  });

  describe('Preservation Scoring', () => {
    it('should give 1.0 for 100% preservation', () => {
      const original = 'སངས་རྒྱས་ཆོས་དང་ཚོགས་';
      const result = {
        translation: 'Buddha, Dharma and Sangha (སངས་རྒྱས་ཆོས་དང་ཚོགས་)',
        confidence: 0.9,
      };

      const quality = scorer.score(result, original);

      expect(quality.preservation).toBe(1.0);
    });

    it('should calculate percentage for partial preservation', () => {
      const original = 'སངས་རྒྱས་ཆོས་དང་'; // 21 characters
      const result = {
        translation: 'Buddha and Dharma (སངས་རྒྱས་ཆོས་དང་)', // 21 characters but only 16 preserved = ~76%
        confidence: 0.9,
      };

      const quality = scorer.score(result, original);

      // Should be around 75-80%
      expect(quality.preservation).toBeGreaterThan(0.7);
      expect(quality.preservation).toBeLessThanOrEqual(1.0);
    });

    it('should give 0.0 for no preservation', () => {
      const original = 'སངས་རྒྱས་';
      const result = {
        translation: 'Buddha (enlightened)',
        confidence: 0.9,
      };

      const quality = scorer.score(result, original);

      expect(quality.preservation).toBe(0.0);
    });

    it('should handle original with no Tibetan', () => {
      const original = 'No Tibetan here';
      const result = {
        translation: 'No Tibetan here',
        confidence: 0.9,
      };

      const quality = scorer.score(result, original);

      expect(quality.preservation).toBe(1.0);
    });

    it('should extract Tibetan only from parentheses in translation', () => {
      const original = 'སངས་རྒྱས་';
      const result = {
        translation: 'Buddha (སངས་རྒྱས་) སངས་', // Extra Tibetan outside should be ignored
        confidence: 0.9,
      };

      const quality = scorer.score(result, original);

      // Should only count Tibetan inside parentheses
      expect(quality.preservation).toBe(1.0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty translation', () => {
      const original = 'སངས་རྒྱས་';
      const result = {
        translation: '',
        confidence: 0.0,
      };

      const quality = scorer.score(result, original);

      expect(quality.overall).toBe(0);
      expect(quality.format).toBe(0);
      expect(quality.preservation).toBe(0);
    });

    it('should handle empty original', () => {
      const original = '';
      const result = {
        translation: 'Some translation',
        confidence: 0.9,
      };

      const quality = scorer.score(result, original);

      // Should not throw error
      expect(quality).toBeDefined();
    });

    it('should handle very long text', () => {
      const original = 'སངས་རྒྱས་'.repeat(1000);
      const result = {
        translation: `Translation (${'སངས་རྒྱས་'.repeat(1000)})`,
        confidence: 0.9,
      };

      const quality = scorer.score(result, original);

      expect(quality.overall).toBeGreaterThan(0.8);
    });

    it('should handle special characters in translation', () => {
      const original = 'སངས་རྒྱས་';
      const result = {
        translation: 'Buddha! (སངས་རྒྱས་) @#$%',
        confidence: 0.9,
      };

      const quality = scorer.score(result, original);

      expect(quality.format).toBe(1.0);
      expect(quality.preservation).toBe(1.0);
    });
  });

  describe('Weight Configuration', () => {
    it('should use default weights if not configured', () => {
      const original = 'སངས་རྒྱས་';
      const result = {
        translation: 'Buddha (སངས་རྒྱས་)',
        confidence: 0.8,
      };

      const quality = scorer.score(result, original);

      // Default: confidence 40%, format 30%, preservation 30%
      const expectedScore = (0.8 * 0.4) + (1.0 * 0.3) + (1.0 * 0.3);
      expect(quality.overall).toBeCloseTo(expectedScore, 2);
    });

    it('should allow custom weights via constructor', () => {
      const customScorer = new QualityScorer({
        confidence: 0.5,
        format: 0.25,
        preservation: 0.25,
      });

      const original = 'སངས་རྒྱས་';
      const result = {
        translation: 'Buddha (སངས་རྒྱས་)',
        confidence: 0.8,
      };

      const quality = customScorer.score(result, original);

      // Custom weights: confidence 50%, format 25%, preservation 25%
      const expectedScore = (0.8 * 0.5) + (1.0 * 0.25) + (1.0 * 0.25);
      expect(quality.overall).toBeCloseTo(expectedScore, 2);
    });

    it('should normalize weights if they do not sum to 1', () => {
      const customScorer = new QualityScorer({
        confidence: 2,
        format: 1,
        preservation: 1,
      });

      const original = 'སངས་རྒྱས་';
      const result = {
        translation: 'Buddha (སངས་རྒྱས་)',
        confidence: 0.8,
      };

      const quality = customScorer.score(result, original);

      // Should normalize to: 2/4 = 0.5, 1/4 = 0.25, 1/4 = 0.25
      expect(quality.overall).toBeGreaterThan(0);
      expect(quality.overall).toBeLessThanOrEqual(1);
    });
  });
});
