import { describe, it, expect, vi } from 'vitest';
import { calculateEnhancedConfidenceSync } from '../../../server/services/translation/confidence';

describe('confidence calculations', () => {
  describe('calculateEnhancedConfidenceSync', () => {
    it('should return confidence score between 0 and 1', () => {
      const translation = 'Tibetan language (བོད་སྐད།).';
      const original = 'བོད་སྐད།';
      const confidence = calculateEnhancedConfidenceSync(translation, original);

      expect(confidence).toBeGreaterThanOrEqual(0);
      expect(confidence).toBeLessThanOrEqual(1);
    });

    it('should give higher confidence for well-formatted translations', () => {
      const goodTranslation = 'The Tibetan language (བོད་སྐད།) is important (གལ་ཆེན།).';
      const original = 'བོད་སྐད། གལ་ཆེན།';
      const confidence = calculateEnhancedConfidenceSync(goodTranslation, original);

      expect(confidence).toBeGreaterThan(0.6);
    });

    it('should give lower confidence for poorly formatted translations', () => {
      const badTranslation = 'Tibetan language དམ།';
      const original = 'བོད་སྐད་དམ།';
      const confidence = calculateEnhancedConfidenceSync(badTranslation, original);

      expect(confidence).toBeLessThan(0.7);
    });

    it('should detect translations with Tibetan in parentheses', () => {
      const translation = 'Text (བོད།). More (སྐད།). And (ཡིག།).';
      const original = 'བོད།སྐད།ཡིག།';
      const confidence = calculateEnhancedConfidenceSync(translation, original);

      // Should have decent confidence due to multiple Tibetan parens
      expect(confidence).toBeGreaterThan(0.5);
    });

    it('should penalize translations with error messages', () => {
      const translation = 'Error: Cannot translate this text';
      const original = 'བོད་སྐད།';
      const confidence = calculateEnhancedConfidenceSync(translation, original);

      expect(confidence).toBeLessThan(0.6);
    });

    it('should penalize translations with AI refusals', () => {
      const translation = 'I apologize, I cannot translate this';
      const original = 'བོད་སྐད།';
      const confidence = calculateEnhancedConfidenceSync(translation, original);

      expect(confidence).toBeLessThan(0.6);
    });

    it('should consider length ratio', () => {
      const shortTranslation = 'T (བ།).';
      const longOriginal = 'བོད་ཀྱི་སྐད་ཡིག་དེ་ནི་གལ་ཆེན་པོ་ཞིག་ཡིན།';
      const confidence = calculateEnhancedConfidenceSync(shortTranslation, longOriginal);

      // Unreasonable length ratio should lower confidence
      expect(confidence).toBeLessThan(0.8);
    });

    it('should handle empty translation', () => {
      const translation = '';
      const original = 'བོད་སྐད།';
      const confidence = calculateEnhancedConfidenceSync(translation, original);

      expect(confidence).toBeLessThan(0.5);
    });

    it('should handle translation without Tibetan preservation', () => {
      const translation = 'Pure English translation without Tibetan text.';
      const original = 'བོད་སྐད།';
      const confidence = calculateEnhancedConfidenceSync(translation, original);

      // Should have low confidence without Tibetan
      expect(confidence).toBeLessThan(0.7);
    });

    it('should handle very long appropriate translations', () => {
      const translation = 'The Tibetan language (བོད་སྐད།) is a very important part of culture.'.repeat(2);
      const original = 'བོད་སྐད།'.repeat(2);
      const confidence = calculateEnhancedConfidenceSync(translation, original);

      expect(confidence).toBeGreaterThan(0.5);
    });
  });
});
