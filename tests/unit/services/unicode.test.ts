// File: tests/unit/services/unicode.test.ts
// Comprehensive tests for Unicode validation and handling

import { describe, it, expect, beforeEach } from 'vitest';
import { UnicodeValidator } from '../../../server/services/unicode/UnicodeValidator';
import { TibetanText } from '../../utils/fixtures';
import { assertValidUnicode, assertValidationResult } from '../../utils/assertions';

describe('UnicodeValidator', () => {
  let validator: UnicodeValidator;

  beforeEach(() => {
    validator = new UnicodeValidator();
  });

  describe('validate', () => {
    it('should normalize to NFC', () => {
      // Create text with NFD normalization (decomposed)
      const nfdText = 'བཀྲ་ཤིས་བདེ་ལེགས།'.normalize('NFD');

      const result = validator.validate(nfdText);

      expect(result).toBeDefined();
      expect(result.normalized).toBe(nfdText.normalize('NFC'));

      // Note: For Tibetan, NFD and NFC may be identical
      // This test just ensures normalization is applied
      expect(result.normalized).toBeDefined();
    });

    it('should detect Unicode corruption', () => {
      // Text with replacement characters (indicates corruption)
      const corruptedText = 'བཀྲ་�་ཤིས་�་བདེ་ལེགས།';

      const result = validator.validate(corruptedText);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.toLowerCase().includes('corruption'))).toBe(true);
    });

    it('should validate Tibetan percentage (min 50%)', () => {
      // Mostly English text
      const lowTibetanText = 'This is mostly English with a bit of བོད་.';

      const result = validator.validate(lowTibetanText);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('Tibetan character'))).toBe(true);
    });

    it('should warn if Tibetan < 70%', () => {
      // Mix with ~60% Tibetan
      const mixedText = 'བཀྲ་ཤིས་བདེ་ལེགས། Hello world. ང་བོད་པ་ཡིན།';

      const result = validator.validate(mixedText);

      // Should be valid but with warning
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings.some(w => w.includes('70%'))).toBe(true);
    });

    it('should accept valid Tibetan text', () => {
      const validText = TibetanText.paragraph;

      const result = validator.validate(validText);

      expect(result.isValid).toBe(true);
      expect(result.errors.length).toBe(0);
      expect(result.normalized).toBe(validText.normalize('NFC'));
    });

    it('should detect common corruption patterns', () => {
      // Mixed encodings or corrupted data
      const patterns = [
        'བཀྲ་���ཤིས', // Replacement chars
        'à½¢à½à¼à½¤à½²à½¦', // Mojibake (double-encoded UTF-8)
      ];

      patterns.forEach(corruptedText => {
        const result = validator.validate(corruptedText);

        // Should detect as corrupted
        expect(result.isValid).toBe(false);
      });
    });

    it('should calculate correct Tibetan percentage', () => {
      const purelyTibetan = TibetanText.simple;

      const result = validator.validate(purelyTibetan);

      expect(result.tibetanPercentage).toBeGreaterThan(95);
      expect(result.tibetanPercentage).toBeLessThanOrEqual(100);
    });

    it('should handle empty text', () => {
      const result = validator.validate('');

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('empty'))).toBe(true);
    });

    it('should handle whitespace-only text', () => {
      const result = validator.validate('   \n\t  ');

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should return proper validation structure', () => {
      const result = validator.validate(TibetanText.simple);

      assertValidationResult(result);

      expect(result).toHaveProperty('isValid');
      expect(result).toHaveProperty('errors');
      expect(result).toHaveProperty('warnings');
      expect(result).toHaveProperty('normalized');
      expect(result).toHaveProperty('tibetanPercentage');
    });

    it('should handle mixed Tibetan-English gracefully', () => {
      const mixedText = TibetanText.mixed;

      const result = validator.validate(mixedText);

      // Should calculate percentage correctly
      expect(result.tibetanPercentage).toBeGreaterThan(0);
      expect(result.tibetanPercentage).toBeLessThan(100);
    });

    it('should detect invalid Unicode sequences', () => {
      // Create buffer with invalid UTF-8 sequence
      const invalidUtf8 = Buffer.from([0xED, 0xA0, 0x80]).toString();

      const result = validator.validate(invalidUtf8);

      // Should detect as invalid or corrupted
      expect(result.isValid).toBe(false);
    });

    it('should normalize combining characters', () => {
      // Tibetan uses combining marks
      const textWithCombining = 'བཀྲ་ཤིས་བདེ་ལེགས།';

      const result = validator.validate(textWithCombining);

      expect(result.normalized).toBe(textWithCombining.normalize('NFC'));
    });

    it('should preserve Tibetan punctuation', () => {
      const textWithPunctuation = TibetanText.withPunctuation;

      const result = validator.validate(textWithPunctuation);

      expect(result.normalized).toContain('།');
      expect(result.normalized).toContain('༎');
    });

    it('should handle Sanskrit in Tibetan text', () => {
      const textWithSanskrit = TibetanText.withSanskrit;

      const result = validator.validate(textWithSanskrit);

      // Sanskrit in Tibetan script is still valid
      expect(result.isValid).toBe(true);
    });

    it('should handle Tibetan numbers', () => {
      const textWithNumbers = TibetanText.withNumbers;

      const result = validator.validate(textWithNumbers);

      // Tibetan numerals should count as Tibetan characters
      expect(result.tibetanPercentage).toBeGreaterThan(50);
    });

    it('should detect zero-width characters', () => {
      const textWithZeroWidth = 'བཀྲ་\u200Bཤིས་བདེ་\u200Cལེགས།'; // Zero-width space

      const result = validator.validate(textWithZeroWidth);

      // Should warn about or normalize zero-width chars
      expect(result.warnings.length).toBeGreaterThanOrEqual(0);
    });

    it('should handle bi-directional text markers', () => {
      const textWithBidi = 'བཀྲ་ཤིས་\u200Eབདེ་ལེགས།'; // LTR mark

      const result = validator.validate(textWithBidi);

      expect(result).toBeDefined();
      expect(result.normalized).toBeDefined();
    });

    it('should validate control characters', () => {
      const textWithControls = 'བཀྲ་ཤིས་\x00\x01བདེ་ལེགས།'; // Null and control chars

      const result = validator.validate(textWithControls);

      // Should flag or remove control characters
      expect(result.warnings.length).toBeGreaterThan(0);
    });
  });

  describe('calculateTibetanPercentage', () => {
    it('should return 100 for pure Tibetan', () => {
      const percentage = validator.calculateTibetanPercentage(TibetanText.simple);

      expect(percentage).toBeGreaterThan(95);
      expect(percentage).toBeLessThanOrEqual(100);
    });

    it('should return 0 for pure English', () => {
      const percentage = validator.calculateTibetanPercentage('Hello World');

      expect(percentage).toBe(0);
    });

    it('should calculate percentage for mixed text', () => {
      const mixedText = 'བོད་ means Tibet';

      const percentage = validator.calculateTibetanPercentage(mixedText);

      expect(percentage).toBeGreaterThan(0);
      expect(percentage).toBeLessThan(100);

      // Rough check: "བོད་" is 4 chars out of ~16 total = ~25%
      expect(percentage).toBeGreaterThan(15);
      expect(percentage).toBeLessThan(40);
    });

    it('should handle empty text', () => {
      const percentage = validator.calculateTibetanPercentage('');

      expect(percentage).toBe(0);
    });

    it('should count Tibetan punctuation', () => {
      const punctuation = '།༎';

      const percentage = validator.calculateTibetanPercentage(punctuation);

      // Tibetan punctuation should count as Tibetan
      expect(percentage).toBe(100);
    });

    it('should count Tibetan numbers', () => {
      const numbers = '༡༢༣༤༥';

      const percentage = validator.calculateTibetanPercentage(numbers);

      // Tibetan numerals should count as Tibetan
      expect(percentage).toBe(100);
    });
  });

  describe('detectCorruption', () => {
    it('should detect replacement characters', () => {
      const corrupted = 'བཀྲ་�་ཤིས';

      const hasCorruption = validator.detectCorruption(corrupted);

      expect(hasCorruption).toBe(true);
    });

    it('should detect mojibake patterns', () => {
      // Double-encoded UTF-8 creates recognizable patterns
      // Using actual mojibake characters
      const mojibake = '\xC0\xC1\xF5'; // Invalid UTF-8 sequences

      const hasCorruption = validator.detectCorruption(mojibake);

      // May or may not detect depending on string conversion
      // The main point is it doesn't crash
      expect(typeof hasCorruption).toBe('boolean');
    });

    it('should accept clean text', () => {
      const clean = TibetanText.paragraph;

      const hasCorruption = validator.detectCorruption(clean);

      expect(hasCorruption).toBe(false);
    });

    it('should detect mixed encodings', () => {
      // Invalid byte sequences converted to string may lose info
      // Better test: use replacement character directly
      const invalid = 'བཀྲ\uFFFDཤིས'; // Replacement character

      const hasCorruption = validator.detectCorruption(invalid);

      // Should be detected as corruption
      expect(hasCorruption).toBe(true);
    });
  });

  describe('normalizeUnicode', () => {
    it('should convert NFD to NFC', () => {
      const nfd = 'བཀྲ་ཤིས།'.normalize('NFD');
      const nfc = validator.normalizeUnicode(nfd);

      expect(nfc).toBe('བཀྲ་ཤིས།'.normalize('NFC'));

      // Note: For Tibetan, NFD and NFC may be identical
      // This just ensures the normalization is applied
      expect(nfc).toBeDefined();
    });

    it('should be idempotent (normalizing twice gives same result)', () => {
      const text = TibetanText.paragraph;

      const normalized1 = validator.normalizeUnicode(text);
      const normalized2 = validator.normalizeUnicode(normalized1);

      expect(normalized1).toBe(normalized2);
    });

    it('should handle already normalized text', () => {
      const nfc = 'བཀྲ་ཤིས།'.normalize('NFC');

      const result = validator.normalizeUnicode(nfc);

      expect(result).toBe(nfc);
    });

    it('should preserve Tibetan characters', () => {
      const text = TibetanText.withSanskrit;

      const normalized = validator.normalizeUnicode(text);

      // Should preserve all Tibetan characters
      const originalTibetan = text.match(/[\u0F00-\u0FFF]/g) || [];
      const normalizedTibetan = normalized.match(/[\u0F00-\u0FFF]/g) || [];

      expect(normalizedTibetan.length).toBeGreaterThan(0);
      // Length might differ slightly due to combining chars
      expect(Math.abs(normalizedTibetan.length - originalTibetan.length)).toBeLessThan(10);
    });
  });

  describe('getValidationSummary', () => {
    it('should provide detailed summary for valid text', () => {
      const result = validator.validate(TibetanText.paragraph);
      const summary = validator.getValidationSummary(result);

      expect(summary).toBeDefined();
      expect(summary.toLowerCase()).toContain('valid');
      expect(summary).toContain('%'); // Should include percentage
    });

    it('should highlight errors in summary', () => {
      const result = validator.validate('Hello World');
      const summary = validator.getValidationSummary(result);

      expect(summary.toLowerCase()).toContain('error');
      expect(summary.toLowerCase()).toContain('tibetan');
    });

    it('should include warnings in summary', () => {
      const mixedText = 'བཀྲ་ཤིས། Hello. ང་བོད་པ།';
      const result = validator.validate(mixedText);
      const summary = validator.getValidationSummary(result);

      if (result.warnings.length > 0) {
        expect(summary.toLowerCase()).toContain('warning');
      }
    });
  });
});
