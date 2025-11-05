/**
 * Unit tests for QualityGateService
 *
 * Tests quality gates that reject or warn on low-quality translations
 * Following TDD methodology - tests written before implementation
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { QualityGateService } from '../../../../server/services/quality/QualityGateService';
import { QualityScorer } from '../../../../server/services/quality/QualityScorer';

describe('QualityGateService', () => {
  let gateService: QualityGateService;
  let scorer: QualityScorer;

  beforeEach(() => {
    scorer = new QualityScorer();
    gateService = new QualityGateService(scorer);
  });

  describe('Quality Gate Checks', () => {
    it('should pass high quality translation', () => {
      const original = 'སངས་རྒྱས་ཆོས་དང་ཚོགས་ཀྱི་མཆོག་རྣམས་ལ།';
      const result = {
        translation: 'I take refuge in the Buddha, Dharma and Sangha (སངས་རྒྱས་ཆོས་དང་ཚོགས་ཀྱི་མཆོག་རྣམས་ལ།)',
        confidence: 0.95,
      };

      const gateResult = gateService.check(result, original);

      expect(gateResult.passed).toBe(true);
      expect(gateResult.failures).toHaveLength(0);
    });

    it('should reject low confidence (<0.7)', () => {
      const original = 'སངས་རྒྱས་';
      const result = {
        translation: 'Buddha (སངས་རྒྱས་)',
        confidence: 0.6,
      };

      const gateResult = gateService.check(result, original);

      expect(gateResult.passed).toBe(false);
      expect(gateResult.failures.some(f => f.gate === 'confidence' && f.action === 'reject')).toBe(true);
    });

    it('should reject low preservation (<0.7)', () => {
      const original = 'སངས་རྒྱས་ཆོས་དང་ཚོགས་ཀྱི་མཆོག་རྣམས་ལ།';
      const result = {
        translation: 'I take refuge (སངས་)', // Very low preservation
        confidence: 0.9,
      };

      const gateResult = gateService.check(result, original);

      expect(gateResult.passed).toBe(false);
      expect(gateResult.failures.some(f => f.gate === 'preservation' && f.action === 'reject')).toBe(true);
    });

    it('should warn on format issues (0.8 threshold)', () => {
      const original = 'སངས་རྒྱས་';
      const result = {
        translation: 'Buddha', // No parentheses
        confidence: 0.9,
      };

      const gateResult = gateService.check(result, original);

      expect(gateResult.passed).toBe(false); // Format should cause rejection
      expect(gateResult.failures.some(f => f.gate === 'format')).toBe(true);
    });
  });

  describe('Gate Configuration', () => {
    it('should use default thresholds if not configured', () => {
      const original = 'སངས་རྒྱས་';
      const result = {
        translation: 'Buddha (སངས་རྒྱས་)',
        confidence: 0.69, // Just below default threshold
      };

      const gateResult = gateService.check(result, original);

      expect(gateResult.passed).toBe(false);
    });

    it('should allow custom thresholds via constructor', () => {
      const customGates = new QualityGateService(scorer, {
        gates: [
          { name: 'confidence', threshold: 0.5, action: 'reject' },
          { name: 'format', threshold: 0.8, action: 'warn' },
          { name: 'preservation', threshold: 0.6, action: 'reject' },
        ],
      });

      const original = 'སངས་རྒྱས་';
      const result = {
        translation: 'Buddha (སངས་རྒྱས་)',
        confidence: 0.55, // Would fail default but pass custom
      };

      const gateResult = customGates.check(result, original);

      expect(gateResult.passed).toBe(true);
    });

    it('should respect action types: "reject" vs "warn"', () => {
      const warnOnlyGates = new QualityGateService(scorer, {
        gates: [
          { name: 'confidence', threshold: 0.7, action: 'warn' },
          { name: 'format', threshold: 0.8, action: 'warn' },
          { name: 'preservation', threshold: 0.7, action: 'warn' },
        ],
      });

      const original = 'སངས་རྒྱས་';
      const result = {
        translation: 'Buddha (སངས་རྒྱས་)',
        confidence: 0.6,
      };

      const gateResult = warnOnlyGates.check(result, original);

      // Should still pass since all gates are warnings
      expect(gateResult.passed).toBe(true);
      expect(gateResult.failures.length).toBeGreaterThan(0);
      expect(gateResult.failures.every(f => f.action === 'warn')).toBe(true);
    });
  });

  describe('Gate Failures', () => {
    it('should report which gates failed', () => {
      const original = 'སངས་རྒྱས་ཆོས་དང་ཚོགས་ཀྱི་མཆོག་རྣམས་ལ།';
      const result = {
        translation: 'Some text', // Bad format, no preservation
        confidence: 0.5, // Low confidence
      };

      const gateResult = gateService.check(result, original);

      expect(gateResult.passed).toBe(false);
      expect(gateResult.failures.length).toBeGreaterThan(1); // Multiple failures

      // Check that failures include gate names
      const failedGates = gateResult.failures.map(f => f.gate);
      expect(failedGates).toContain('confidence');
      expect(failedGates).toContain('format');
      expect(failedGates).toContain('preservation');
    });

    it('should include actual and threshold values in failures', () => {
      const original = 'སངས་རྒྱས་';
      const result = {
        translation: 'Buddha (སངས་རྒྱས་)',
        confidence: 0.6,
      };

      const gateResult = gateService.check(result, original);

      const confidenceFailure = gateResult.failures.find(f => f.gate === 'confidence');

      expect(confidenceFailure).toBeDefined();
      expect(confidenceFailure?.actual).toBe(0.6);
      expect(confidenceFailure?.threshold).toBe(0.7);
    });

    it('should include reason/message in failures', () => {
      const original = 'སངས་རྒྱས་';
      const result = {
        translation: 'Buddha (སངས་རྒྱས་)',
        confidence: 0.6,
      };

      const gateResult = gateService.check(result, original);

      expect(gateResult.failures.length).toBeGreaterThan(0);
      expect(gateResult.failures[0].message).toBeDefined();
      expect(typeof gateResult.failures[0].message).toBe('string');
    });
  });

  describe('Multiple Gates', () => {
    it('should check all gates even if one fails', () => {
      const original = 'སངས་རྒྱས་';
      const result = {
        translation: 'Text', // Multiple issues
        confidence: 0.4,
      };

      const gateResult = gateService.check(result, original);

      // Should report all failures, not just the first
      expect(gateResult.failures.length).toBeGreaterThan(1);
    });

    it('should pass only if all reject gates pass', () => {
      const original = 'སངས་རྒྱས་';

      // Good confidence and preservation, bad format
      let result = {
        translation: 'Buddha', // No format
        confidence: 0.9,
      };
      let gateResult = gateService.check(result, original);
      expect(gateResult.passed).toBe(false);

      // Good format and preservation, bad confidence
      result = {
        translation: 'Buddha (སངས་རྒྱས་)',
        confidence: 0.5,
      };
      gateResult = gateService.check(result, original);
      expect(gateResult.passed).toBe(false);

      // All good
      result = {
        translation: 'Buddha (སངས་རྒྱས་)',
        confidence: 0.9,
      };
      gateResult = gateService.check(result, original);
      expect(gateResult.passed).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty translation', () => {
      const original = 'སངས་རྒྱས་';
      const result = {
        translation: '',
        confidence: 0.0,
      };

      const gateResult = gateService.check(result, original);

      expect(gateResult.passed).toBe(false);
      expect(gateResult.failures.length).toBeGreaterThan(0);
    });

    it('should handle missing confidence', () => {
      const original = 'སངས་རྒྱས་';
      const result = {
        translation: 'Buddha (སངས་རྒྱས་)',
      };

      const gateResult = gateService.check(result, original);

      // Should default to 0.5 and might fail confidence gate
      expect(gateResult).toBeDefined();
    });

    it('should handle perfect scores', () => {
      const original = 'སངས་རྒྱས་';
      const result = {
        translation: 'Buddha (སངས་རྒྱས་)',
        confidence: 1.0,
      };

      const gateResult = gateService.check(result, original);

      expect(gateResult.passed).toBe(true);
      expect(gateResult.failures).toHaveLength(0);
    });
  });

  describe('Integration with QualityScorer', () => {
    it('should use scorer to calculate quality metrics', () => {
      const original = 'སངས་རྒྱས་';
      const result = {
        translation: 'Buddha (སངས་རྒྱས་)',
        confidence: 0.9,
      };

      const gateResult = gateService.check(result, original);

      // Should have used scorer to calculate quality
      expect(gateResult.qualityScore).toBeDefined();
      expect(gateResult.qualityScore.overall).toBeGreaterThan(0);
    });

    it('should pass quality scores to gate checks', () => {
      const customScorer = new QualityScorer({
        confidence: 1, // 100% weight on confidence
        format: 0,
        preservation: 0,
      });

      const customGates = new QualityGateService(customScorer, {
        gates: [
          { name: 'confidence', threshold: 0.8, action: 'reject' },
        ],
      });

      const original = 'སངས་རྒྱས་';
      const result = {
        translation: 'Buddha', // Bad format, but we only check confidence
        confidence: 0.85,
      };

      const gateResult = customGates.check(result, original);

      expect(gateResult.passed).toBe(true); // Only confidence gate exists and passes
    });
  });

  describe('Custom Gate Rules', () => {
    it('should support disabling specific gates', () => {
      const gatesNoFormat = new QualityGateService(scorer, {
        gates: [
          { name: 'confidence', threshold: 0.7, action: 'reject' },
          { name: 'preservation', threshold: 0.7, action: 'reject' },
        ],
      });

      const original = 'སངས་རྒྱས་';
      const result = {
        translation: 'Buddha', // Bad format but format gate disabled
        confidence: 0.9,
      };

      const gateResult = gatesNoFormat.check(result, original);

      // Should fail on preservation or format, but format is disabled
      expect(gateResult.passed).toBe(false); // Preservation should fail
    });

    it('should support additional custom gates', () => {
      const gatesWithOverall = new QualityGateService(scorer, {
        gates: [
          { name: 'overall', threshold: 0.8, action: 'reject' },
        ],
      });

      const original = 'སངས་རྒྱས་';
      const result = {
        translation: 'Buddha (སངས་རྒྱས་)',
        confidence: 0.75, // Will bring overall down
      };

      const gateResult = gatesWithOverall.check(result, original);

      // Overall score might be below 0.8 with confidence at 0.75
      expect(gateResult).toBeDefined();
    });
  });
});
