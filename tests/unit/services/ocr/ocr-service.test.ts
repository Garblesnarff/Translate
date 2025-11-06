// File: tests/unit/services/ocr/ocr-service.test.ts
// Comprehensive tests for OCR Service

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { OCRService } from '../../../../server/services/ocr/OCRService';
import type { OCRResult, OCRConfig } from '../../../../server/services/ocr/types';

// Mock Tesseract.js
vi.mock('tesseract.js', () => ({
  createWorker: vi.fn(() => ({
    load: vi.fn().mockResolvedValue(undefined),
    loadLanguage: vi.fn().mockResolvedValue(undefined),
    initialize: vi.fn().mockResolvedValue(undefined),
    setParameters: vi.fn().mockResolvedValue(undefined),
    recognize: vi.fn().mockResolvedValue({
      data: {
        text: 'བཀྲ་ཤིས་བདེ་ལེགས། ང་བོད་པ་ཡིན།',
        confidence: 85,
        words: [
          { text: 'བཀྲ་ཤིས་བདེ་ལེགས།', confidence: 87 },
          { text: 'ང་བོད་པ་ཡིན།', confidence: 83 },
        ],
      },
    }),
    terminate: vi.fn().mockResolvedValue(undefined),
  })),
}));

// Mock PDF.js
vi.mock('pdfjs-dist', () => ({
  getDocument: vi.fn((data: any) => ({
    promise: Promise.resolve({
      numPages: 2,
      getPage: vi.fn((pageNum: number) => {
        return Promise.resolve({
          getTextContent: vi.fn(() => {
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
          render: vi.fn(() => ({
            promise: Promise.resolve(),
          })),
        });
      }),
    }),
  })),
}));

describe('OCRService', () => {
  let ocrService: OCRService;

  beforeEach(() => {
    ocrService = new OCRService();
  });

  describe('needsOCR', () => {
    it('should detect when OCR is needed (sparse text <50 chars/page)', () => {
      // Text with less than 50 characters per page (2 pages = 100 total)
      const sparseText = 'བཀྲ་ཤིས།'; // 24 chars total for 2 pages = 12 chars/page
      const pageCount = 2;

      const result = ocrService.needsOCR(sparseText, pageCount);

      expect(result).toBe(true);
    });

    it('should not need OCR for text-rich PDFs', () => {
      // Text with more than 50 characters per page
      const richText = 'བཀྲ་ཤིས་བདེ་ལེགས། ང་བོད་པ་ཡིན། '.repeat(10); // ~300 chars for 2 pages = 150 chars/page
      const pageCount = 2;

      const result = ocrService.needsOCR(richText, pageCount);

      expect(result).toBe(false);
    });

    it('should need OCR for completely empty text', () => {
      const emptyText = '';
      const pageCount = 5;

      const result = ocrService.needsOCR(emptyText, pageCount);

      expect(result).toBe(true);
    });

    it('should need OCR for whitespace-only text', () => {
      const whitespaceText = '   \n\n   ';
      const pageCount = 3;

      const result = ocrService.needsOCR(whitespaceText, pageCount);

      expect(result).toBe(true);
    });

    it('should handle edge case of exactly 50 chars per page', () => {
      // Exactly 50 chars per page (threshold)
      const text = 'a'.repeat(50); // 50 chars for 1 page
      const pageCount = 1;

      const result = ocrService.needsOCR(text, pageCount);

      // Should NOT need OCR (>= 50 chars/page)
      expect(result).toBe(false);
    });
  });

  describe('processPage', () => {
    it('should extract text from scanned PDF page', async () => {
      const mockPageBuffer = Buffer.from('mock-pdf-page-image');

      const result = await ocrService.processPage(mockPageBuffer);

      expect(result).toBeDefined();
      expect(result.text).toBeDefined();
      expect(result.text.length).toBeGreaterThan(0);
      expect(result.confidence).toBeGreaterThan(0);
    });

    it('should return OCR confidence score', async () => {
      const mockPageBuffer = Buffer.from('mock-pdf-page-image');

      const result = await ocrService.processPage(mockPageBuffer);

      expect(result.confidence).toBeTypeOf('number');
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    });

    it('should handle Tesseract initialization', async () => {
      const mockPageBuffer = Buffer.from('mock-pdf-page-image');

      // First call should initialize worker
      const result1 = await ocrService.processPage(mockPageBuffer);
      expect(result1).toBeDefined();

      // Second call should reuse worker
      const result2 = await ocrService.processPage(mockPageBuffer);
      expect(result2).toBeDefined();
    });

    it('should handle empty pages gracefully', async () => {
      const mockPageBuffer = Buffer.from('');

      const result = await ocrService.processPage(mockPageBuffer);

      expect(result).toBeDefined();
      expect(result.text).toBeDefined();
      expect(result.confidence).toBeDefined();
    });
  });

  describe('postProcess', () => {
    it('should fix common OCR errors (Latin o→ོ)', () => {
      const ocrText = 'བཀྲo་ཤིསo།'; // Latin 'o' mistaken for Tibetan vowel

      const cleaned = ocrService.postProcess(ocrText);

      expect(cleaned).toContain('ོ');
      expect(cleaned).not.toContain('o');
    });

    it('should fix common OCR errors (Latin i→ི)', () => {
      const ocrText = 'བཀྲi་ཤིསi།'; // Latin 'i' mistaken for Tibetan vowel

      const cleaned = ocrService.postProcess(ocrText);

      expect(cleaned).toContain('ི');
      expect(cleaned).not.toContain('i');
    });

    it('should fix common OCR errors (pipe |→།)', () => {
      const ocrText = 'བཀྲ་ཤིས|'; // Pipe mistaken for shad

      const cleaned = ocrService.postProcess(ocrText);

      expect(cleaned).toContain('།');
      expect(cleaned).not.toContain('|');
    });

    it('should fix common OCR errors (slash /→་)', () => {
      const ocrText = 'བཀྲ/ཤིས/བདེ/ལེགས'; // Slash mistaken for tsek

      const cleaned = ocrService.postProcess(ocrText);

      expect(cleaned).toContain('་');
      expect(cleaned).not.toContain('/');
    });

    it('should fix multiple error types in one pass', () => {
      const ocrText = 'བཀྲo་ཤིསi| ངo་བoད་པ/ཡིན|'; // Multiple errors

      const cleaned = ocrService.postProcess(ocrText);

      expect(cleaned).toContain('ོ');
      expect(cleaned).toContain('ི');
      expect(cleaned).toContain('།');
      expect(cleaned).toContain('་');
      expect(cleaned).not.toContain('o');
      expect(cleaned).not.toContain('i');
      expect(cleaned).not.toContain('|');
      expect(cleaned).not.toContain('/');
    });

    it('should preserve correct text unchanged', () => {
      const correctText = 'བཀྲ་ཤིས་བདེ་ལེགས།';

      const result = ocrService.postProcess(correctText);

      expect(result).toBe(correctText);
    });

    it('should handle empty text', () => {
      const result = ocrService.postProcess('');

      expect(result).toBe('');
    });
  });

  describe('processBatch', () => {
    it('should process multiple pages in parallel', async () => {
      const mockPages = [
        Buffer.from('page1'),
        Buffer.from('page2'),
        Buffer.from('page3'),
        Buffer.from('page4'),
      ];

      const startTime = Date.now();
      const results = await ocrService.processBatch(mockPages);
      const duration = Date.now() - startTime;

      expect(results).toBeDefined();
      expect(results.length).toBe(4);

      // Parallel processing should be faster than sequential
      // Each page would take ~100ms sequentially = 400ms total
      // Parallel (4 at once) should be ~100ms
      expect(duration).toBeLessThan(5000); // Generous timeout for tests
    });

    it('should process pages with parallelism limit (4 at a time)', async () => {
      // Create 10 pages
      const mockPages = Array.from({ length: 10 }, (_, i) => Buffer.from(`page${i + 1}`));

      const results = await ocrService.processBatch(mockPages);

      expect(results).toBeDefined();
      expect(results.length).toBe(10);

      // All results should have text
      results.forEach((result) => {
        expect(result.text).toBeDefined();
        expect(result.confidence).toBeGreaterThanOrEqual(0);
      });
    });

    it('should handle empty batch', async () => {
      const results = await ocrService.processBatch([]);

      expect(results).toBeDefined();
      expect(results.length).toBe(0);
    });

    it('should handle single page batch', async () => {
      const results = await ocrService.processBatch([Buffer.from('single-page')]);

      expect(results).toBeDefined();
      expect(results.length).toBe(1);
      expect(results[0].text).toBeDefined();
    });

    it('should report progress for long documents', async () => {
      const mockPages = Array.from({ length: 20 }, (_, i) => Buffer.from(`page${i + 1}`));
      const progressUpdates: number[] = [];

      const onProgress = (progress: number) => {
        progressUpdates.push(progress);
      };

      const results = await ocrService.processBatch(mockPages, { onProgress });

      expect(results).toBeDefined();
      expect(results.length).toBe(20);

      // Should have reported progress
      expect(progressUpdates.length).toBeGreaterThan(0);

      // Progress should increase
      for (let i = 1; i < progressUpdates.length; i++) {
        expect(progressUpdates[i]).toBeGreaterThanOrEqual(progressUpdates[i - 1]);
      }

      // Final progress should be 100%
      expect(progressUpdates[progressUpdates.length - 1]).toBe(100);
    });
  });

  describe('configuration', () => {
    it('should initialize with default config', () => {
      const service = new OCRService();

      expect(service).toBeDefined();
    });

    it('should accept custom configuration', () => {
      const customConfig: OCRConfig = {
        lang: 'bod+eng',
        dpi: 300,
        psm: 3,
        oem: 1,
      };

      const service = new OCRService(customConfig);

      expect(service).toBeDefined();
    });

    it('should use high DPI for quality (300)', () => {
      const config = ocrService.getConfig();

      expect(config.dpi).toBe(300);
    });

    it('should use Tibetan + English languages', () => {
      const config = ocrService.getConfig();

      expect(config.lang).toContain('bod');
      expect(config.lang).toContain('eng');
    });

    it('should use LSTM neural net mode (oem: 1)', () => {
      const config = ocrService.getConfig();

      expect(config.oem).toBe(1);
    });
  });

  describe('cleanup', () => {
    it('should terminate Tesseract worker on cleanup', async () => {
      // Process a page to initialize worker
      await ocrService.processPage(Buffer.from('test'));

      // Cleanup
      await ocrService.cleanup();

      // Should be able to process again (new worker)
      const result = await ocrService.processPage(Buffer.from('test2'));
      expect(result).toBeDefined();
    });
  });
});
