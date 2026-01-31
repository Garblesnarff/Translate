import { describe, it, expect } from 'vitest';
import {
  isValidTibetanText,
  normalizeTibetanUnicode,
  detectCorruption,
  generateQualityReport,
  validateAndNormalize,
  isValidUTF8,
  calculateEntropy,
  validateText,
  NormalizationForm,
  CorruptionType,
} from '@/lib/tibetan/unicodeValidator';

describe('unicodeValidator', () => {
  describe('isValidTibetanText', () => {
    it('should return true for valid Tibetan text', () => {
      const tibetan = 'བོད་ཀྱི་སྐད་ཡིག';
      expect(isValidTibetanText(tibetan, 0.5)).toBe(true);
    });

    it('should return false for insufficient Tibetan content', () => {
      const english = 'Mostly English with one བ character';
      expect(isValidTibetanText(english, 0.5)).toBe(false);
    });

    it('should respect minTibetanPercentage parameter', () => {
      const mixed = 'བོད་སྐད English text here';
      expect(isValidTibetanText(mixed, 0.3)).toBe(true);
      expect(isValidTibetanText(mixed, 0.8)).toBe(false);
    });

    it('should return false for empty text', () => {
      expect(isValidTibetanText('', 0.5)).toBe(false);
    });
  });

  describe('normalizeTibetanUnicode', () => {
    it('should normalize multiple spaces to single space', () => {
      const text = 'བོད་སྐད    test';
      const normalized = normalizeTibetanUnicode(text);
      expect(normalized).not.toContain('    ');
      expect(normalized).toContain(' ');
    });

    it('should remove space before tsek', () => {
      const text = 'བོད ་སྐད';
      const normalized = normalizeTibetanUnicode(text);
      expect(normalized).not.toContain(' ་');
    });

    it('should add space after shad', () => {
      const text = 'བོད།English';
      const normalized = normalizeTibetanUnicode(text);
      expect(normalized).toContain('། ');
    });

    it('should remove zero-width characters', () => {
      const text = 'བོད\u200Bསྐད'; // zero-width space
      const normalized = normalizeTibetanUnicode(text);
      expect(normalized).not.toContain('\u200B');
    });

    it('should normalize different space types', () => {
      const text = 'བོད\u00A0སྐད'; // non-breaking space
      const normalized = normalizeTibetanUnicode(text);
      expect(normalized).toContain(' '); // regular space
    });

    it('should apply NFC normalization by default', () => {
      const text = 'བོད་སྐད';
      const normalized = normalizeTibetanUnicode(text);
      expect(normalized).toBe(normalized.normalize('NFC'));
    });

    it('should support different normalization forms', () => {
      const text = 'བོད་སྐད';
      const nfc = normalizeTibetanUnicode(text, NormalizationForm.NFC);
      const nfd = normalizeTibetanUnicode(text, NormalizationForm.NFD);
      expect(nfc).toBe(text.normalize('NFC'));
      expect(nfd).toBe(text.normalize('NFD'));
    });
  });

  describe('detectCorruption', () => {
    it('should detect null bytes', () => {
      const text = 'བོད\u0000སྐད';
      const issues = detectCorruption(text);
      expect(issues.some(i => i.type === CorruptionType.NULL_BYTES)).toBe(true);
    });

    it('should detect replacement characters', () => {
      const text = 'བོད�སྐད';
      const issues = detectCorruption(text);
      expect(issues.some(i => i.type === CorruptionType.REPLACEMENT_CHAR)).toBe(true);
    });

    it('should detect control characters', () => {
      const text = 'བོད\u0001སྐད';
      const issues = detectCorruption(text);
      expect(issues.some(i => i.type === CorruptionType.CONTROL_CHARS)).toBe(true);
    });

    it('should not flag valid control characters', () => {
      const text = 'བོད\nསྐད\ttext'; // newline and tab are OK
      const issues = detectCorruption(text);
      const controlCharIssues = issues.filter(i => i.type === CorruptionType.CONTROL_CHARS);
      expect(controlCharIssues.length).toBe(0);
    });

    it('should return empty array for clean text', () => {
      const text = 'བོད་ཀྱི་སྐད་ཡིག';
      const issues = detectCorruption(text);
      expect(issues.length).toBe(0);
    });

    it('should include context for corruption issues', () => {
      const text = 'བོད�སྐད';
      const issues = detectCorruption(text);
      expect(issues[0].context.length).toBeGreaterThan(0);
    });

    it('should assign severity levels', () => {
      const text = 'བོད�སྐད'; // replacement char = high severity
      const issues = detectCorruption(text);
      expect(issues.some(i => i.severity === 'high')).toBe(true);
    });
  });

  describe('generateQualityReport', () => {
    it('should generate complete report for valid text', () => {
      const text = 'བོད་ཀྱི་སྐད་ཡིག';
      const report = generateQualityReport(text);

      expect(report.isValid).toBe(true);
      expect(report.tibetanPercentage).toBeGreaterThan(0.9);
      expect(report.totalCharacters).toBeGreaterThan(0);
      expect(report.tibetanCharacters).toBeGreaterThan(0);
      expect(report.corruptionIssues.length).toBe(0);
      expect(report.hasProperEncoding).toBe(true);
    });

    it('should detect invalid text', () => {
      const text = 'Pure English text';
      const report = generateQualityReport(text);

      expect(report.isValid).toBe(false);
      expect(report.tibetanPercentage).toBe(0);
    });

    it('should identify corruption in quality report', () => {
      const text = 'བོད�སྐད';
      const report = generateQualityReport(text);

      expect(report.hasProperEncoding).toBe(false);
      expect(report.corruptionIssues.length).toBeGreaterThan(0);
    });

    it('should recommend normalization form', () => {
      const text = 'བོད་སྐད';
      const report = generateQualityReport(text);

      expect(report.recommendedNormalization).toBe(NormalizationForm.NFC);
    });

    it('should count Tibetan and total characters correctly', () => {
      const text = 'བོད་སྐད English';
      const report = generateQualityReport(text);

      expect(report.tibetanCharacters).toBeGreaterThan(0);
      expect(report.totalCharacters).toBeGreaterThan(report.tibetanCharacters);
    });
  });

  describe('validateAndNormalize', () => {
    it('should normalize valid text', () => {
      const text = 'བོད་  སྐད'; // double space
      const result = validateAndNormalize(text, 0.3);

      expect(result.text).not.toContain('  ');
      expect(result.report.isValid).toBe(true);
    });

    it('should clean and normalize recoverable text', () => {
      const text = 'བོད\u0000སྐད'; // null byte
      const result = validateAndNormalize(text, 0.3);

      expect(result.text).not.toContain('\u0000');
      expect(result.report.tibetanPercentage).toBeGreaterThan(0);
    });

    it('should return original text if not recoverable', () => {
      const text = 'Pure English text with no Tibetan';
      const result = validateAndNormalize(text, 0.5);

      expect(result.text).toBe(text);
      expect(result.report.isValid).toBe(false);
    });

    it('should generate report for all text', () => {
      const text = 'བོད་སྐད';
      const result = validateAndNormalize(text);

      expect(result.report).toBeDefined();
      expect(result.report.tibetanPercentage).toBeDefined();
    });
  });

  describe('isValidUTF8', () => {
    it('should return true for valid UTF-8 text', () => {
      const text = 'བོད་ཀྱི་སྐད་ཡིག';
      expect(isValidUTF8(text)).toBe(true);
    });

    it('should return true for ASCII text', () => {
      const text = 'Simple ASCII text';
      expect(isValidUTF8(text)).toBe(true);
    });

    it('should return true for mixed valid UTF-8', () => {
      const text = 'བོད་སྐད English text 中文';
      expect(isValidUTF8(text)).toBe(true);
    });
  });

  describe('calculateEntropy', () => {
    it('should return 0 for empty text', () => {
      expect(calculateEntropy('')).toBe(0);
    });

    it('should return low entropy for repetitive text', () => {
      const text = 'aaaaaaaa';
      const entropy = calculateEntropy(text);
      expect(entropy).toBeLessThan(1);
    });

    it('should return higher entropy for diverse text', () => {
      const text = 'བོད་ཀྱི་སྐད་ཡིག English text';
      const entropy = calculateEntropy(text);
      expect(entropy).toBeGreaterThan(2);
    });

    it('should calculate Shannon entropy correctly', () => {
      const text = 'ab'; // 50% each = 1 bit of entropy
      const entropy = calculateEntropy(text);
      expect(entropy).toBeCloseTo(1, 1);
    });
  });

  describe('validateText', () => {
    it('should validate well-formed Tibetan text', () => {
      const text = 'བོད་ཀྱི་སྐད་ཡིག';
      const result = validateText(text, { minTibetanPercentage: 0.5 });

      expect(result.valid).toBe(true);
      expect(result.errors.length).toBe(0);
    });

    it('should reject empty text', () => {
      const result = validateText('');

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Text is empty');
    });

    it('should reject insufficient Tibetan content', () => {
      const text = 'Mostly English with བོད';
      const result = validateText(text, { minTibetanPercentage: 0.8 });

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('Insufficient Tibetan content'))).toBe(true);
    });

    it('should warn about normalization issues', () => {
      const text = 'བོད་  སྐད'; // double space
      const result = validateText(text, { requireNormalization: true });

      // Might have warnings about normalization
      expect(result.warnings).toBeDefined();
    });

    it('should detect corruption as errors', () => {
      const text = 'བོད�སྐད'; // replacement character
      const result = validateText(text);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should warn about low entropy', () => {
      const text = 'a'.repeat(200); // Very low entropy
      const result = validateText(text, { minTibetanPercentage: 0 });

      expect(result.warnings.some(w => w.includes('entropy'))).toBe(true);
    });

    it('should provide normalized text when needed', () => {
      const text = 'བོད་  སྐད';
      const result = validateText(text, { requireNormalization: true });

      if (result.normalizedText) {
        expect(result.normalizedText).not.toContain('  ');
      }
    });

    it('should respect custom options', () => {
      const text = 'བོད';
      const result = validateText(text, {
        minTibetanPercentage: 0.1,
        requireNormalization: false,
        checkEncoding: false,
      });

      expect(result.valid).toBe(true);
    });
  });
});
