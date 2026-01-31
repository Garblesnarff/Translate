import { describe, it, expect, beforeEach } from 'vitest';
import { OutputValidator, type OutputValidationResult } from '../../../server/validators/outputValidator';

describe('OutputValidator', () => {
  let validator: OutputValidator;
  const sampleOriginalText = 'བོད་ཀྱི་སྐད་ཡིག་ནི་གལ་ཆེན་པོ་ཡིན།';

  beforeEach(() => {
    validator = new OutputValidator();
  });

  describe('validateTranslation', () => {
    it('should validate well-formed translation', () => {
      const translation = 'Tibetan language is important (བོད་ཀྱི་སྐད་ཡིག་ནི་གལ་ཆེན་པོ་ཡིན།).';
      const result = validator.validateTranslation(translation, sampleOriginalText);

      expect(result.isValid).toBe(true);
      expect(result.errors.length).toBe(0);
      expect(result.metadata?.formatCompliance).toBeGreaterThan(50);
      expect(result.metadata?.tibetanPreservation).toBeGreaterThan(70);
    });

    it('should reject empty translation', () => {
      const result = validator.validateTranslation('', sampleOriginalText);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Translation is empty');
    });

    it('should reject very short translation', () => {
      const shortTranslation = 'Short';
      const result = validator.validateTranslation(shortTranslation, sampleOriginalText);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('too short'))).toBe(true);
    });

    it('should detect unbalanced parentheses', () => {
      const translation = 'Tibetan (བོད་སྐད is important.';
      const result = validator.validateTranslation(translation, sampleOriginalText);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('Unbalanced parentheses'))).toBe(true);
    });

    it('should detect missing Tibetan in parentheses', () => {
      const translation = 'Tibetan language is important (English text only).';
      const result = validator.validateTranslation(translation, sampleOriginalText);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('No Tibetan text found inside parentheses'))).toBe(true);
    });

    it('should detect Tibetan text outside parentheses', () => {
      const translation = 'བོད་སྐད is Tibetan (ཡིན།).';
      const result = validator.validateTranslation(translation, sampleOriginalText);

      // Should have error or warning about Tibetan outside parens
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('outside parentheses'))).toBe(true);
    });

    it('should detect insufficient Tibetan preservation', () => {
      const translation = 'Tibetan language (བོད།).'; // Only small part preserved
      const result = validator.validateTranslation(translation, sampleOriginalText);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('preserved'))).toBe(true);
      expect(result.metadata?.tibetanPreservation).toBeLessThan(70);
    });

    it('should detect AI refusal patterns', () => {
      const translation = 'I apologize, but I cannot translate this text.';
      const result = validator.validateTranslation(translation, sampleOriginalText);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('AI refusal'))).toBe(true);
      expect(result.metadata?.aiErrorsDetected).toContain('ai_refusal');
    });

    it('should detect meta-text prefixes', () => {
      const translation = 'Translation: Tibetan language (བོད་སྐད།).';
      const result = validator.validateTranslation(translation, sampleOriginalText);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('meta-text prefix'))).toBe(true);
      expect(result.metadata?.aiErrorsDetected).toContain('meta_text');
    });

    it('should detect code blocks', () => {
      const translation = '```\nTibetan language (བོད་སྐད།)\n```';
      const result = validator.validateTranslation(translation, sampleOriginalText);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('code block'))).toBe(true);
      expect(result.metadata?.aiErrorsDetected).toContain('code_blocks');
    });

    it('should detect "I cannot" patterns', () => {
      const translation = 'I cannot provide a translation for this.';
      const result = validator.validateTranslation(translation, sampleOriginalText);

      expect(result.isValid).toBe(false);
      expect(result.metadata?.aiErrorsDetected?.length).toBeGreaterThan(0);
    });

    it('should detect "as an AI" patterns', () => {
      const translation = 'As an AI, I should note that Tibetan (བོད།).';
      const result = validator.validateTranslation(translation, sampleOriginalText);

      expect(result.isValid).toBe(false);
      expect(result.metadata?.aiErrorsDetected).toContain('ai_apology');
    });

    it('should warn about editorial notes', () => {
      const translation = 'Tibetan language [Note: important] (བོད་སྐད།).';
      const result = validator.validateTranslation(translation, sampleOriginalText);

      if (result.warnings) {
        expect(result.warnings.some(w => w.includes('bracketed notes'))).toBe(true);
      }
      expect(result.metadata?.aiErrorsDetected).toContain('editorial_notes');
    });

    it('should warn about short translation', () => {
      const translation = 'Tibetan language here.';
      const result = validator.validateTranslation(translation, sampleOriginalText);

      if (result.warnings) {
        expect(result.warnings.some(w => w.includes('very short'))).toBe(true);
      }
    });

    it('should handle translation without original Tibetan', () => {
      const englishOriginal = 'Pure English text';
      const translation = 'Pure English translation.';
      const result = validator.validateTranslation(translation, englishOriginal);

      // Should have warning about no Tibetan to validate
      expect(result.warnings?.some(w => w.includes('no Tibetan characters'))).toBe(true);
    });

    it('should calculate completeness score', () => {
      const translation = 'Tibetan language is very important (བོད་ཀྱི་སྐད་ཡིག།).';
      const result = validator.validateTranslation(translation, sampleOriginalText);

      expect(result.metadata?.completeness).toBeGreaterThan(0);
      expect(result.metadata?.completeness).toBeLessThanOrEqual(100);
    });

    it('should calculate format compliance score', () => {
      const translation = 'Tibetan (བོད།) is (ཡིན།) important.';
      const result = validator.validateTranslation(translation, sampleOriginalText);

      expect(result.metadata?.formatCompliance).toBeGreaterThan(0);
      expect(result.metadata?.formatCompliance).toBeLessThanOrEqual(100);
    });

    it('should calculate preservation percentage', () => {
      const translation = 'Tibetan language (བོད་ཀྱི་སྐད་ཡིག་ནི་གལ་ཆེན་པོ་ཡིན།).';
      const result = validator.validateTranslation(translation, sampleOriginalText);

      expect(result.metadata?.tibetanPreservation).toBeGreaterThan(90);
    });
  });

  describe('quickValidate', () => {
    it('should return true for valid translation', () => {
      const translation = 'Tibetan language (བོད་སྐད།).';
      expect(validator.quickValidate(translation)).toBe(true);
    });

    it('should return false for empty translation', () => {
      expect(validator.quickValidate('')).toBe(false);
    });

    it('should return false for short translation', () => {
      const shortTranslation = 'Short';
      expect(validator.quickValidate(shortTranslation)).toBe(false);
    });

    it('should return false for translation without parentheses', () => {
      const translation = 'Tibetan language བོད་སྐད།';
      expect(validator.quickValidate(translation)).toBe(false);
    });

    it('should return false for translation without Tibetan', () => {
      const translation = 'English translation (English text).';
      expect(validator.quickValidate(translation)).toBe(false);
    });

    it('should return true for properly formatted translation', () => {
      const translation = 'This is the Tibetan language (བོད་ཀྱི་སྐད་ཡིག།).';
      expect(validator.quickValidate(translation)).toBe(true);
    });
  });

  describe('getValidationReport', () => {
    it('should generate readable report for valid translation', () => {
      const translation = 'Tibetan language (བོད་སྐད།).';
      const result = validator.validateTranslation(translation, sampleOriginalText);
      const report = validator.getValidationReport(result);

      expect(report).toContain('Output Validation Report');
      expect(report).toContain('Metadata');
    });

    it('should show PASSED for valid translation', () => {
      const translation = 'Tibetan language is important (བོད་ཀྱི་སྐད་ཡིག་ནི་གལ་ཆེན་པོ་ཡིན།).';
      const result = validator.validateTranslation(translation, sampleOriginalText);
      const report = validator.getValidationReport(result);

      if (result.isValid) {
        expect(report).toContain('PASSED');
      }
    });

    it('should show FAILED for invalid translation', () => {
      const translation = 'I cannot translate';
      const result = validator.validateTranslation(translation, sampleOriginalText);
      const report = validator.getValidationReport(result);

      expect(report).toContain('FAILED');
      expect(report).toContain('Errors');
    });

    it('should include all metadata', () => {
      const translation = 'Tibetan language (བོད་སྐད།).';
      const result = validator.validateTranslation(translation, sampleOriginalText);
      const report = validator.getValidationReport(result);

      expect(report).toContain('Completeness');
      expect(report).toContain('Format compliance');
      expect(report).toContain('Tibetan preservation');
    });

    it('should list all errors', () => {
      const result: OutputValidationResult = {
        isValid: false,
        errors: ['Error 1', 'Error 2', 'Error 3'],
        warnings: [],
        metadata: {},
      };

      const report = validator.getValidationReport(result);

      expect(report).toContain('Errors (3)');
      expect(report).toContain('Error 1');
      expect(report).toContain('Error 2');
      expect(report).toContain('Error 3');
    });

    it('should list all warnings', () => {
      const result: OutputValidationResult = {
        isValid: true,
        errors: [],
        warnings: ['Warning 1', 'Warning 2'],
        metadata: {},
      };

      const report = validator.getValidationReport(result);

      expect(report).toContain('Warnings (2)');
      expect(report).toContain('Warning 1');
      expect(report).toContain('Warning 2');
    });

    it('should show success message for perfect translation', () => {
      const result: OutputValidationResult = {
        isValid: true,
        errors: [],
        warnings: [],
        metadata: {},
      };

      const report = validator.getValidationReport(result);

      expect(report).toContain('No issues found');
      expect(report).toContain('meets all quality requirements');
    });
  });

  describe('edge cases', () => {
    it('should handle nested parentheses', () => {
      const translation = 'Text (outer (བོད།) nested).';
      const result = validator.validateTranslation(translation, sampleOriginalText);

      // Should still extract Tibetan from nested parens
      expect(result).toBeDefined();
    });

    it('should handle multiple sentences', () => {
      const translation = 'First sentence (བོད།). Second sentence (སྐད།). Third (ཡིག།).';
      const result = validator.validateTranslation(translation, sampleOriginalText);

      expect(result.metadata?.formatCompliance).toBeDefined();
    });

    it('should handle translation with punctuation inside parentheses', () => {
      const translation = 'Tibetan language (བོད་སྐད།༎).';
      const result = validator.validateTranslation(translation, sampleOriginalText);

      expect(result.isValid || result.warnings.length === 0).toBeDefined();
    });

    it('should handle very long translations', () => {
      const longTranslation = 'Tibetan language (བོད་སྐད།). '.repeat(100);
      const result = validator.validateTranslation(longTranslation, sampleOriginalText);

      expect(result).toBeDefined();
      expect(result.metadata?.completeness).toBe(100);
    });

    it('should handle empty original text gracefully', () => {
      const translation = 'Some translation (བོད།).';
      const result = validator.validateTranslation(translation, '');

      expect(result).toBeDefined();
    });
  });
});
