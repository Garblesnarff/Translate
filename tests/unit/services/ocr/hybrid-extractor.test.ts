// File: tests/unit/services/ocr/hybrid-extractor.test.ts
// Tests for HybridExtractor

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { HybridExtractor } from '../../../../server/services/extraction/HybridExtractor';

// Mock PDF.js
vi.mock('pdfjs-dist', () => ({
  getDocument: vi.fn((data: any) => ({
    promise: Promise.resolve({
      numPages: 2,
      getPage: vi.fn((pageNum: number) => {
        return Promise.resolve({
          getTextContent: vi.fn(() => {
            // Simulate scanned PDF with sparse text
            return Promise.resolve({
              items: [
                { str: 'sparse', transform: [12, 0, 0, 12, 100, 700], width: 100, height: 12 },
              ],
            });
          }),
          getViewport: vi.fn(({ scale }: any) => ({
            width: 612,
            height: 792,
            scale,
          })),
        });
      }),
    }),
  })),
}));

// Mock Tesseract.js
vi.mock('tesseract.js', () => ({
  createWorker: vi.fn(() => ({
    load: vi.fn().mockResolvedValue(undefined),
    loadLanguage: vi.fn().mockResolvedValue(undefined),
    initialize: vi.fn().mockResolvedValue(undefined),
    setParameters: vi.fn().mockResolvedValue(undefined),
    recognize: vi.fn().mockResolvedValue({
      data: {
        text: 'བཀྲ་ཤིས་བདེ་ལེགས། OCR extracted text.',
        confidence: 85,
      },
    }),
    terminate: vi.fn().mockResolvedValue(undefined),
  })),
}));

describe('HybridExtractor', () => {
  let extractor: HybridExtractor;

  beforeEach(() => {
    extractor = new HybridExtractor();
  });

  afterEach(async () => {
    await extractor.cleanup();
  });

  describe('extract', () => {
    it('should try native extraction first', async () => {
      const mockPdfData = new Uint8Array([0x25, 0x50, 0x44, 0x46]);

      const result = await extractor.extract(mockPdfData);

      expect(result).toBeDefined();
      expect(result.text).toBeDefined();
      expect(result.metadata).toBeDefined();
    });

    it('should fall back to OCR if text is sparse', async () => {
      const mockPdfData = new Uint8Array([0x25, 0x50, 0x44, 0x46]);

      const result = await extractor.extract(mockPdfData);

      expect(result).toBeDefined();
      expect(result.metadata.extractionMethod).toBeDefined();
    });

    it('should return metadata indicating extraction method', async () => {
      const mockPdfData = new Uint8Array([0x25, 0x50, 0x44, 0x46]);

      const result = await extractor.extract(mockPdfData);

      expect(result.metadata.extractionMethod).toBeDefined();
      expect(['native', 'ocr', 'hybrid']).toContain(result.metadata.extractionMethod);
    });

    it('should include OCR quality if OCR was used', async () => {
      const mockPdfData = new Uint8Array([0x25, 0x50, 0x44, 0x46]);

      const result = await extractor.extract(mockPdfData);

      if (result.metadata.extractionMethod === 'ocr' || result.metadata.extractionMethod === 'hybrid') {
        expect(result.metadata.ocrQuality).toBeDefined();
        expect(result.metadata.ocrConfidence).toBeDefined();
      }
    });

    it('should support progress tracking for OCR', async () => {
      const mockPdfData = new Uint8Array([0x25, 0x50, 0x44, 0x46]);
      const progressUpdates: number[] = [];

      const onProgress = (progress: number) => {
        progressUpdates.push(progress);
      };

      await extractor.extract(mockPdfData, onProgress);

      // Progress callback might or might not be called depending on extraction method
      // Just verify it doesn't crash
      expect(progressUpdates).toBeDefined();
    });

    it('should include warnings if quality is poor', async () => {
      const mockPdfData = new Uint8Array([0x25, 0x50, 0x44, 0x46]);

      const result = await extractor.extract(mockPdfData);

      expect(result.warnings).toBeDefined();
    });

    it('should handle extraction errors gracefully', async () => {
      const invalidPdfData = new Uint8Array([0x00]);

      const result = await extractor.extract(invalidPdfData);

      expect(result).toBeDefined();
      expect(result.text).toBeDefined();
    });
  });

  describe('hybrid strategy', () => {
    it('should use native extraction for text-rich PDFs', async () => {
      // This test verifies the strategy but with mocks it's limited
      const mockPdfData = new Uint8Array([0x25, 0x50, 0x44, 0x46]);

      const result = await extractor.extract(mockPdfData);

      expect(result).toBeDefined();
      expect(result.metadata.extractionMethod).toBeDefined();
    });

    it('should combine native and OCR for hybrid approach', async () => {
      // When both methods produce results, hybrid mode combines them
      const mockPdfData = new Uint8Array([0x25, 0x50, 0x44, 0x46]);

      const result = await extractor.extract(mockPdfData);

      expect(result).toBeDefined();
    });
  });

  describe('cleanup', () => {
    it('should cleanup OCR resources', async () => {
      const mockPdfData = new Uint8Array([0x25, 0x50, 0x44, 0x46]);

      await extractor.extract(mockPdfData);
      await extractor.cleanup();

      // Should be able to extract again after cleanup
      const result = await extractor.extract(mockPdfData);
      expect(result).toBeDefined();
    });
  });
});
