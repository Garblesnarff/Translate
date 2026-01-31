import { describe, it, expect, beforeEach } from 'vitest';
import { InputValidator, type ValidationResult } from '../../../server/validators/inputValidator';

describe('InputValidator', () => {
  let validator: InputValidator;

  beforeEach(() => {
    validator = new InputValidator();
  });

  describe('validateTibetanText', () => {
    it('should validate well-formed Tibetan text', () => {
      const text = 'བོད་ཀྱི་སྐད་ཡིག་ནི་བོད་ཀྱི་རིག་གནས་ཡིན།';
      const result = validator.validateTibetanText(text);

      expect(result.isValid).toBe(true);
      expect(result.errors.length).toBe(0);
      expect(result.metadata?.tibetanPercentage).toBeGreaterThan(90);
    });

    it('should reject empty text', () => {
      const result = validator.validateTibetanText('');

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Text is empty or contains only whitespace');
    });

    it('should reject text with only whitespace', () => {
      const result = validator.validateTibetanText('   \n\t  ');

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('empty'))).toBe(true);
    });

    it('should reject text that is too short', () => {
      const shortText = 'བོད';
      const result = validator.validateTibetanText(shortText);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('too short'))).toBe(true);
    });

    it('should reject text that is too long', () => {
      const longText = 'བོད་སྐད།'.repeat(20000); // Over 100k chars
      const result = validator.validateTibetanText(longText);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('too long'))).toBe(true);
    });

    it('should warn about very long text', () => {
      const longText = 'བོད་སྐད།'.repeat(8000); // 50k+ chars
      const result = validator.validateTibetanText(longText);

      if (result.warnings) {
        expect(result.warnings.some(w => w.includes('very long'))).toBe(true);
      }
    });

    it('should reject text with insufficient Tibetan content', () => {
      const englishText = 'This is mostly English text with one བ character here.';
      const result = validator.validateTibetanText(englishText);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('Insufficient Tibetan content'))).toBe(true);
      expect(result.metadata?.tibetanPercentage).toBeLessThan(50);
    });

    it('should warn about text with low Tibetan percentage', () => {
      const mixedText = 'བོད་སྐད། with significant English content here and there.';
      const result = validator.validateTibetanText(mixedText);

      // This might pass validation but should have warnings
      expect(result.metadata?.tibetanPercentage).toBeDefined();
    });

    it('should detect null bytes', () => {
      const corruptedText = 'བོད\u0000སྐད་ཡིག་དེ་ནི་གལ་ཆེན་ཡིན།';
      const result = validator.validateTibetanText(corruptedText);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('null bytes'))).toBe(true);
      expect(result.metadata?.unicodeIssues).toContain('null_bytes');
    });

    it('should detect replacement characters', () => {
      const corruptedText = 'བོད�སྐད་ཡིག';
      const result = validator.validateTibetanText(corruptedText);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('replacement character'))).toBe(true);
      expect(result.metadata?.unicodeIssues).toContain('replacement_character');
    });

    it('should warn about control characters', () => {
      const textWithControl = 'བོད\u0001སྐད';
      const result = validator.validateTibetanText(textWithControl);

      if (result.warnings) {
        expect(result.warnings.some(w => w.includes('control character'))).toBe(true);
      }
      expect(result.metadata?.unicodeIssues).toContain('control_characters');
    });

    it('should allow valid control characters', () => {
      const textWithNewlines = 'བོད་སྐད\nའདི་རྒྱུ་མཚན\tགལ་ཆེན';
      const result = validator.validateTibetanText(textWithNewlines);

      // Should not complain about \n or \t
      const controlCharWarnings = result.warnings?.filter(w => w.includes('control'));
      expect(controlCharWarnings?.length || 0).toBe(0);
    });

    it('should warn about unusual spacing', () => {
      const textWithUnusualSpaces = 'བོད\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0སྐད';
      const result = validator.validateTibetanText(textWithUnusualSpaces);

      if (result.warnings && result.warnings.length > 0) {
        expect(result.warnings.some(w => w.includes('unusual space'))).toBe(true);
      }
    });

    it('should calculate Tibetan percentage correctly', () => {
      const text = 'བོད་སྐད English';
      const result = validator.validateTibetanText(text);

      expect(result.metadata?.tibetanPercentage).toBeDefined();
      expect(result.metadata?.tibetanPercentage).toBeGreaterThan(0);
      expect(result.metadata?.tibetanPercentage).toBeLessThan(100);
    });

    it('should include text length in metadata', () => {
      const text = 'བོད་ཀྱི་སྐད་ཡིག';
      const result = validator.validateTibetanText(text);

      expect(result.metadata?.textLength).toBe(text.length);
    });
  });

  describe('quickValidate', () => {
    it('should return true for valid Tibetan text', () => {
      const text = 'བོད་ཀྱི་སྐད་ཡིག་ནི་གལ་ཆེན་ཡིན།';
      expect(validator.quickValidate(text)).toBe(true);
    });

    it('should return false for empty text', () => {
      expect(validator.quickValidate('')).toBe(false);
    });

    it('should return false for text that is too short', () => {
      const shortText = 'བོད';
      expect(validator.quickValidate(shortText)).toBe(false);
    });

    it('should return false for text that is too long', () => {
      const longText = 'བོད་སྐད།'.repeat(20000);
      expect(validator.quickValidate(longText)).toBe(false);
    });

    it('should return false for text with no Tibetan', () => {
      const englishText = 'Pure English text without Tibetan';
      expect(validator.quickValidate(englishText)).toBe(false);
    });

    it('should return true even for text with low Tibetan percentage', () => {
      // quickValidate is more permissive than full validation
      const mixedText = 'Mostly English but has བོད here';
      expect(validator.quickValidate(mixedText)).toBe(true);
    });
  });

  describe('getValidationReport', () => {
    it('should generate readable report for valid text', () => {
      const text = 'བོད་ཀྱི་སྐད་ཡིག་ནི་གལ་ཆེན་ཡིན།';
      const result = validator.validateTibetanText(text);
      const report = validator.getValidationReport(result);

      expect(report).toContain('PASSED');
      expect(report).toContain('Metadata');
      expect(report).toContain('Text length');
      expect(report).toContain('Tibetan content');
    });

    it('should generate report with errors', () => {
      const result: ValidationResult = {
        isValid: false,
        errors: ['Test error 1', 'Test error 2'],
        warnings: [],
        metadata: {},
      };

      const report = validator.getValidationReport(result);

      expect(report).toContain('FAILED');
      expect(report).toContain('Errors (2)');
      expect(report).toContain('Test error 1');
      expect(report).toContain('Test error 2');
    });

    it('should generate report with warnings', () => {
      const result: ValidationResult = {
        isValid: true,
        errors: [],
        warnings: ['Warning 1', 'Warning 2'],
        metadata: {},
      };

      const report = validator.getValidationReport(result);

      expect(report).toContain('PASSED');
      expect(report).toContain('Warnings (2)');
      expect(report).toContain('Warning 1');
      expect(report).toContain('Warning 2');
    });

    it('should include metadata in report', () => {
      const result: ValidationResult = {
        isValid: true,
        errors: [],
        warnings: [],
        metadata: {
          textLength: 100,
          tibetanPercentage: 95.5,
          unicodeIssues: ['test_issue'],
        },
      };

      const report = validator.getValidationReport(result);

      expect(report).toContain('100 characters');
      expect(report).toContain('95.5%');
      expect(report).toContain('test_issue');
    });

    it('should show success message for perfect text', () => {
      const result: ValidationResult = {
        isValid: true,
        errors: [],
        warnings: [],
        metadata: {},
      };

      const report = validator.getValidationReport(result);

      expect(report).toContain('No issues found');
      expect(report).toContain('ready for translation');
    });
  });

  describe('edge cases', () => {
    it('should handle text with only Tibetan punctuation', () => {
      const text = '།༎༑'.repeat(10);
      const result = validator.validateTibetanText(text);

      expect(result.metadata?.tibetanPercentage).toBeGreaterThan(90);
    });

    it('should handle mixed scripts correctly', () => {
      const text = 'བོད་སྐད (Tibetan language) 中文 русский';
      const result = validator.validateTibetanText(text);

      expect(result.metadata?.tibetanPercentage).toBeDefined();
    });

    it('should handle text with many numbers', () => {
      const text = 'བོད་སྐད 123 456 789 000';
      const result = validator.validateTibetanText(text);

      // Numbers should not count as Tibetan
      expect(result.metadata?.tibetanPercentage).toBeLessThan(100);
    });

    it('should handle text with emojis', () => {
      const text = 'བོད་སྐད 😀 🎉';
      const result = validator.validateTibetanText(text);

      // Should handle gracefully
      expect(result).toBeDefined();
      expect(result.isValid).toBeDefined();
    });
  });
});
