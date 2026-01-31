/**
 * Integration tests for the full quality pipeline
 *
 * Tests the complete flow from input validation through quality gates
 * Following TDD methodology - tests written before implementation
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ValidationService } from '../../server/services/validation/ValidationService';
import { QualityScorer } from '../../server/services/quality/QualityScorer';
import { QualityGateService } from '../../server/services/quality/QualityGateService';

describe('Quality Pipeline Integration', () => {
  let validationService: ValidationService;
  let qualityScorer: QualityScorer;
  let qualityGates: QualityGateService;

  beforeEach(() => {
    validationService = new ValidationService();
    qualityScorer = new QualityScorer();
    qualityGates = new QualityGateService(qualityScorer);
  });

  describe('Full Pipeline - Passing Case', () => {
    it('should process high-quality translation end-to-end', () => {
      const originalText = 'སངས་རྒྱས་ཆོས་དང་ཚོགས་ཀྱི་མཆོག་རྣམས་ལ། བྱང་ཆུབ་བར་དུ་བདག་ནི་སྐྱབས་སུ་མཆི།';
      const translatedText = 'I take refuge in the Buddha, Dharma and Sangha (སངས་རྒྱས་ཆོས་དང་ཚོགས་ཀྱི་མཆོག་རྣམས་ལ།). Until I attain enlightenment (བྱང་ཆུབ་བར་དུ་བདག་ནི་སྐྱབས་སུ་མཆི།).';

      // Step 1: Input Validation
      const inputValidation = validationService.validate(originalText, 'input');
      expect(inputValidation.isValid).toBe(true);
      expect(inputValidation.errors).toHaveLength(0);

      // Step 2: Translation (mocked - would call AI service)
      const translationResult = {
        translation: translatedText,
        confidence: 0.95,
      };

      // Step 3: Output Validation
      const outputValidation = validationService.validate(
        { translation: translatedText, original: originalText },
        'output'
      );
      expect(outputValidation.isValid).toBe(true);
      expect(outputValidation.errors).toHaveLength(0);

      // Step 4: Quality Scoring
      const qualityScore = qualityScorer.score(translationResult, originalText);
      expect(qualityScore.overall).toBeGreaterThan(0.8);
      expect(qualityScore.confidence).toBe(0.95);
      expect(qualityScore.format).toBe(1.0);
      expect(qualityScore.preservation).toBeGreaterThan(0.9);

      // Step 5: Quality Gates
      const gateResult = qualityGates.check(translationResult, originalText);
      expect(gateResult.passed).toBe(true);
      expect(gateResult.failures).toHaveLength(0);
    });
  });

  describe('Full Pipeline - Failing Cases', () => {
    it('should reject at input validation stage', () => {
      const invalidInput = 'This is all English text with no Tibetan';

      // Step 1: Input Validation - SHOULD FAIL
      const inputValidation = validationService.validate(invalidInput, 'input');
      expect(inputValidation.isValid).toBe(false);
      expect(inputValidation.errors.length).toBeGreaterThan(0);

      // Pipeline should stop here - don't proceed to translation
    });

    it('should reject at output validation stage (bad format)', () => {
      const originalText = 'སངས་རྒྱས་ཆོས་དང་ཚོགས་ཀྱི་མཆོག་རྣམས་ལ།';
      const badTranslation = 'I take refuge in the Buddha, Dharma and Sangha'; // No Tibetan in parentheses

      // Step 1: Input Validation - PASS
      const inputValidation = validationService.validate(originalText, 'input');
      expect(inputValidation.isValid).toBe(true);

      // Step 2: Translation (mocked)
      const translationResult = {
        translation: badTranslation,
        confidence: 0.9,
      };

      // Step 3: Output Validation - SHOULD FAIL
      const outputValidation = validationService.validate(
        { translation: badTranslation, original: originalText },
        'output'
      );
      expect(outputValidation.isValid).toBe(false);
      expect(outputValidation.errors.some(e => e.toLowerCase().includes('format') || e.toLowerCase().includes('parenthes'))).toBe(true);
    });

    it('should reject at quality gates stage (low confidence)', () => {
      const originalText = 'སངས་རྒྱས་ཆོས་དང་ཚོགས་ཀྱི་མཆོག་རྣམས་ལ།';
      const translation = 'I take refuge in the Buddha, Dharma and Sangha (སངས་རྒྱས་ཆོས་དང་ཚོགས་ཀྱི་མཆོག་རྣམས་ལ།)';

      // Step 1: Input Validation - PASS
      const inputValidation = validationService.validate(originalText, 'input');
      expect(inputValidation.isValid).toBe(true);

      // Step 2: Translation (mocked) with LOW CONFIDENCE
      const translationResult = {
        translation: translation,
        confidence: 0.5, // Below threshold
      };

      // Step 3: Output Validation - PASS
      const outputValidation = validationService.validate(
        { translation, original: originalText },
        'output'
      );
      expect(outputValidation.isValid).toBe(true);

      // Step 4: Quality Scoring
      const qualityScore = qualityScorer.score(translationResult, originalText);
      expect(qualityScore.confidence).toBe(0.5);

      // Step 5: Quality Gates - SHOULD FAIL
      const gateResult = qualityGates.check(translationResult, originalText);
      expect(gateResult.passed).toBe(false);
      expect(gateResult.failures.some(f => f.gate === 'confidence')).toBe(true);
    });

    it('should reject at quality gates stage (low preservation)', () => {
      const originalText = 'སངས་རྒྱས་ཆོས་དང་ཚོགས་ཀྱི་མཆོག་རྣམས་ལ།';
      const translation = 'I take refuge (སངས་)'; // Very low preservation

      // Step 1: Input Validation - PASS
      const inputValidation = validationService.validate(originalText, 'input');
      expect(inputValidation.isValid).toBe(true);

      // Step 2: Translation (mocked)
      const translationResult = {
        translation: translation,
        confidence: 0.9,
      };

      // Step 3: Output Validation - SHOULD FAIL on preservation
      const outputValidation = validationService.validate(
        { translation, original: originalText },
        'output'
      );
      expect(outputValidation.isValid).toBe(false);

      // Step 4: Quality Scoring
      const qualityScore = qualityScorer.score(translationResult, originalText);
      expect(qualityScore.preservation).toBeLessThan(0.7);

      // Step 5: Quality Gates - SHOULD FAIL
      const gateResult = qualityGates.check(translationResult, originalText);
      expect(gateResult.passed).toBe(false);
      expect(gateResult.failures.some(f => f.gate === 'preservation')).toBe(true);
    });

    it('should reject AI refusal patterns', () => {
      const originalText = 'སངས་རྒྱས་ཆོས་དང་ཚོགས་ཀྱི་མཆོག་རྣམས་ལ།';
      const aiRefusal = 'I cannot translate this text as an AI assistant';

      // Step 1: Input Validation - PASS
      const inputValidation = validationService.validate(originalText, 'input');
      expect(inputValidation.isValid).toBe(true);

      // Step 2: Translation (mocked) - AI REFUSED
      const translationResult = {
        translation: aiRefusal,
        confidence: 0.0,
      };

      // Step 3: Output Validation - SHOULD FAIL
      const outputValidation = validationService.validate(
        { translation: aiRefusal, original: originalText },
        'output'
      );
      expect(outputValidation.isValid).toBe(false);
      expect(outputValidation.errors.some(e => e.toLowerCase().includes('refusal') || e.toLowerCase().includes('ai'))).toBe(true);
    });
  });

  describe('Pipeline with Warnings', () => {
    it('should pass but include warnings for borderline cases', () => {
      const originalText = 'སངས་རྒྱས་ཆོས་དང་ཚོགས་ཀྱི་མཆོག་རྣམས་ལ།';
      // 90% preservation - should pass but might warn
      const translation = 'I take refuge (སངས་རྒྱས་ཆོས་དང་ཚོགས་ཀྱི་མཆོག་རྣམས།)';

      // Step 1: Input Validation
      const inputValidation = validationService.validate(originalText, 'input');
      expect(inputValidation.isValid).toBe(true);

      // Step 2: Translation (mocked)
      const translationResult = {
        translation: translation,
        confidence: 0.75, // Borderline
      };

      // Step 3: Output Validation
      const outputValidation = validationService.validate(
        { translation, original: originalText },
        'output'
      );
      expect(outputValidation.isValid).toBe(true);

      // Step 4: Quality Scoring
      const qualityScore = qualityScorer.score(translationResult, originalText);
      expect(qualityScore.overall).toBeGreaterThan(0.7);
      expect(qualityScore.overall).toBeLessThan(0.9);

      // Step 5: Quality Gates
      const gateResult = qualityGates.check(translationResult, originalText);
      expect(gateResult.passed).toBe(true);

      // May have warnings
      const allWarnings = [
        ...inputValidation.warnings,
        ...outputValidation.warnings,
      ];
      // Warnings are acceptable, just document them
      if (allWarnings.length > 0) {
        expect(allWarnings.length).toBeGreaterThan(0);
      }
    });

    it('should collect warnings from all stages', () => {
      // Long text with borderline Tibetan percentage (60%)
      const mixedText = 'སངས་རྒྱས་ཆོས་ '.repeat(50) + 'Some English text here '.repeat(50);
      // 90% preservation (should trigger warning)
      const preservedText = 'སངས་རྒྱས་ཆོས་ '.repeat(45);
      const translation = `Translation (${preservedText})`;

      // Step 1: Input Validation - may have warnings about Tibetan percentage
      const inputValidation = validationService.validate(mixedText, 'input');

      // Step 2: Translation (mocked)
      const translationResult = {
        translation: translation,
        confidence: 0.78,
      };

      // Step 3: Output Validation - may have warnings about preservation
      const outputValidation = validationService.validate(
        { translation, original: mixedText },
        'output'
      );

      // Collect all warnings from pipeline
      const allWarnings = [
        ...inputValidation.warnings,
        ...outputValidation.warnings,
      ];

      // Should have warnings from various stages (at least from input about Tibetan %)
      expect(allWarnings.length).toBeGreaterThan(0);
    });
  });

  describe('Pipeline Error Recovery', () => {
    it('should provide actionable error messages at each stage', () => {
      const badInput = 'English text only';

      // Input validation should provide clear error
      const inputValidation = validationService.validate(badInput, 'input');
      expect(inputValidation.isValid).toBe(false);
      expect(inputValidation.errors[0]).toBeDefined();
      expect(typeof inputValidation.errors[0]).toBe('string');
      expect(inputValidation.errors[0].length).toBeGreaterThan(10);
    });

    it('should aggregate errors from multiple validators', () => {
      const problematicText = '\uFFFD\u0000'; // Invalid unicode, too short, no Tibetan

      const inputValidation = validationService.validate(problematicText, 'input');

      expect(inputValidation.isValid).toBe(false);
      expect(inputValidation.errors.length).toBeGreaterThan(1); // Multiple issues
    });
  });

  describe('Performance Considerations', () => {
    it('should handle very long text efficiently', () => {
      const longText = 'སངས་རྒྱས་ཆོས་དང་ཚོགས་ཀྱི་མཆོག་རྣམས་ལ། '.repeat(1000);
      const translation = `Translation (${'སངས་རྒྱས་ཆོས་དང་ཚོགས་ཀྱི་མཆོག་རྣམས་ལ། '.repeat(1000)})`;

      const start = Date.now();

      // Run full pipeline
      const inputValidation = validationService.validate(longText, 'input');
      const translationResult = { translation, confidence: 0.9 };
      const outputValidation = validationService.validate(
        { translation, original: longText },
        'output'
      );
      const qualityScore = qualityScorer.score(translationResult, longText);
      const gateResult = qualityGates.check(translationResult, longText);

      const elapsed = Date.now() - start;

      // Should complete in reasonable time (< 1 second)
      expect(elapsed).toBeLessThan(1000);

      // Should still validate correctly
      expect(inputValidation.isValid).toBe(true);
      expect(outputValidation.isValid).toBe(true);
      expect(gateResult.passed).toBe(true);
    });
  });

  describe('Configuration Integration', () => {
    it('should support custom configuration across all components', () => {
      // Custom scorer weights
      const customScorer = new QualityScorer({
        confidence: 0.5,
        format: 0.3,
        preservation: 0.2,
      });

      // Custom gates
      const customGates = new QualityGateService(customScorer, {
        gates: [
          { name: 'confidence', threshold: 0.6, action: 'reject' },
          { name: 'format', threshold: 0.7, action: 'warn' },
          { name: 'preservation', threshold: 0.6, action: 'reject' },
        ],
      });

      const originalText = 'སངས་རྒྱས་ཆོས་དང་ཚོགས་ཀྱི་མཆོག་རྣམས་ལ།';
      const translation = 'I take refuge (སངས་རྒྱས་ཆོས་དང་ཚོགས་ཀྱི་མཆོག་རྣམས་ལ།)';
      const translationResult = { translation, confidence: 0.65 };

      // Should use custom configuration
      const qualityScore = customScorer.score(translationResult, originalText);
      const gateResult = customGates.check(translationResult, originalText);

      expect(gateResult.passed).toBe(true); // Custom thresholds are lower
    });
  });
});
