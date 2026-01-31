// File: tests/unit/services/ocr/ocr-quality.test.ts
// Tests for OCR quality assessment

import { describe, it, expect, beforeEach } from 'vitest';
import { OCRQualityAssessor } from '../../../../server/services/ocr/OCRQualityAssessor';
import type { OCRResult } from '../../../../server/services/ocr/types';

describe('OCRQualityAssessor', () => {
  let assessor: OCRQualityAssessor;

  beforeEach(() => {
    assessor = new OCRQualityAssessor();
  });

  describe('assessQuality', () => {
    it('should assess Tibetan character percentage', () => {
      const result: OCRResult = {
        text: 'བཀྲ་ཤིས་བདེ་ལེགས།', // 100% Tibetan
        confidence: 0.85,
        quality: 0.85,
      };

      const assessment = assessor.assessQuality(result);

      expect(assessment.tibetanRatio).toBeGreaterThan(0.5);
    });

    it('should detect low Tibetan character ratio', () => {
      const result: OCRResult = {
        text: 'English text with very few Tibetan characters', // Low Tibetan ratio
        confidence: 0.85,
        quality: 0.85,
      };

      const assessment = assessor.assessQuality(result);

      expect(assessment.tibetanRatio).toBeLessThan(0.3);
      expect(assessment.warnings.length).toBeGreaterThan(0);
    });

    it('should evaluate confidence scores', () => {
      const highConfidence: OCRResult = {
        text: 'བཀྲ་ཤིས་བདེ་ལེགས།',
        confidence: 0.9,
        quality: 0.9,
      };

      const lowConfidence: OCRResult = {
        text: 'བཀྲ་ཤིས་བདེ་ལེགས།',
        confidence: 0.4,
        quality: 0.4,
      };

      const highAssessment = assessor.assessQuality(highConfidence);
      const lowAssessment = assessor.assessQuality(lowConfidence);

      expect(highAssessment.avgConfidence).toBe(0.9);
      expect(lowAssessment.avgConfidence).toBe(0.4);
      expect(lowAssessment.warnings.length).toBeGreaterThan(0);
    });

    it('should detect suspicious patterns', () => {
      const suspiciousResult: OCRResult = {
        text: 'བཀྲ|||ཤིས///བདེ|||ལེགས', // Multiple pipes and slashes
        confidence: 0.85,
        quality: 0.85,
      };

      const assessment = assessor.assessQuality(suspiciousResult);

      expect(assessment.warnings.some((w) => w.includes('Suspicious'))).toBe(true);
    });

    it('should return quality score (0-1)', () => {
      const result: OCRResult = {
        text: 'བཀྲ་ཤིས་བདེ་ལེགས།',
        confidence: 0.85,
        quality: 0.85,
      };

      const assessment = assessor.assessQuality(result);

      expect(assessment.score).toBeGreaterThanOrEqual(0);
      expect(assessment.score).toBeLessThanOrEqual(1);
    });

    it('should mark high quality as acceptable', () => {
      const result: OCRResult = {
        text: 'བཀྲ་ཤིས་བདེ་ལེགས། ང་བོད་པ་ཡིན།',
        confidence: 0.9,
        quality: 0.9,
      };

      const assessment = assessor.assessQuality(result);

      expect(assessment.isAcceptable).toBe(true);
      expect(assessment.score).toBeGreaterThan(0.6);
    });

    it('should mark low quality as unacceptable', () => {
      const result: OCRResult = {
        text: 'aabbccdd', // No Tibetan
        confidence: 0.3,
        quality: 0.3,
      };

      const assessment = assessor.assessQuality(result);

      expect(assessment.isAcceptable).toBe(false);
      expect(assessment.score).toBeLessThan(0.6);
    });
  });

  describe('assessBatch', () => {
    it('should assess multiple pages together', () => {
      const results: OCRResult[] = [
        { text: 'བཀྲ་ཤིས་བདེ་ལེགས།', confidence: 0.85, quality: 0.85 },
        { text: 'ང་བོད་པ་ཡིན།', confidence: 0.9, quality: 0.9 },
        { text: 'ཐུགས་རྗེ་ཆེ།', confidence: 0.8, quality: 0.8 },
      ];

      const assessment = assessor.assessBatch(results);

      expect(assessment).toBeDefined();
      expect(assessment.avgConfidence).toBeCloseTo(0.85, 2);
    });

    it('should calculate average confidence', () => {
      const results: OCRResult[] = [
        { text: 'Text 1', confidence: 0.8, quality: 0.8 },
        { text: 'Text 2', confidence: 0.9, quality: 0.9 },
        { text: 'Text 3', confidence: 0.7, quality: 0.7 },
      ];

      const assessment = assessor.assessBatch(results);

      expect(assessment.avgConfidence).toBeCloseTo(0.8, 2);
    });

    it('should handle empty batch', () => {
      const assessment = assessor.assessBatch([]);

      expect(assessment.score).toBe(0);
      expect(assessment.isAcceptable).toBe(false);
      expect(assessment.warnings.length).toBeGreaterThan(0);
    });

    it('should detect quality variance across pages', () => {
      const results: OCRResult[] = [
        { text: 'Page 1', confidence: 0.9, quality: 0.9 },
        { text: 'Page 2', confidence: 0.2, quality: 0.2 }, // Very different
        { text: 'Page 3', confidence: 0.85, quality: 0.85 },
      ];

      const assessment = assessor.assessBatch(results);

      // Should warn about high variance
      expect(
        assessment.warnings.some((w) => w.includes('variance'))
      ).toBe(true);
    });

    it('should combine text from all pages', () => {
      const results: OCRResult[] = [
        { text: 'བཀྲ་ཤིས།', confidence: 0.85, quality: 0.85 },
        { text: 'བདེ་ལེགས།', confidence: 0.85, quality: 0.85 },
      ];

      const assessment = assessor.assessBatch(results);

      // Tibetan ratio should be calculated from combined text
      expect(assessment.tibetanRatio).toBeGreaterThan(0.5);
    });
  });
});
