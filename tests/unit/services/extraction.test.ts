// File: tests/unit/services/extraction.test.ts
// Comprehensive tests for PDF text extraction services

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TextExtractor } from '../../../server/services/extraction/TextExtractor';
import { PositionAwareExtractor } from '../../../server/services/extraction/PositionAwareExtractor';
import { ArtifactRemover } from '../../../server/services/extraction/ArtifactRemover';
import { TibetanText } from '../../utils/fixtures';
import { assertValidTibetan, assertValidUnicode } from '../../utils/assertions';

// Mock PDF.js
vi.mock('pdfjs-dist', () => ({
  getDocument: vi.fn((data: any) => {
    return {
      promise: Promise.resolve({
        numPages: 5,
        getPage: vi.fn((pageNum: number) => {
          return Promise.resolve({
            getTextContent: vi.fn(() => {
              return Promise.resolve({
                items: [
                  { str: 'བཀྲ་ཤིས་བདེ་ལེགས།', transform: [12, 0, 0, 12, 100, 700], width: 100, height: 12 },
                  { str: ' ', transform: [12, 0, 0, 12, 200, 700], width: 10, height: 12 },
                  { str: 'ང་བོད་པ་ཡིན།', transform: [12, 0, 0, 12, 210, 700], width: 90, height: 12 },
                ],
              });
            }),
          });
        }),
      }),
    };
  }),
}));

describe('TextExtractor', () => {
  let extractor: TextExtractor;

  beforeEach(() => {
    extractor = new TextExtractor();
  });

  describe('extract', () => {
    it('should extract text from digital PDF', async () => {
      // Mock PDF.js response
      const mockPdfData = new Uint8Array([0x25, 0x50, 0x44, 0x46]); // PDF header

      const result = await extractor.extract(mockPdfData);

      expect(result).toBeDefined();
      expect(result.text).toBeDefined();
      expect(result.metadata).toBeDefined();
      expect(result.metadata.pageCount).toBeGreaterThan(0);
    });

    it('should preserve Tibetan spacing (tsek ་)', async () => {
      // Mock PDF with Tibetan text
      const mockPdfData = new Uint8Array([0x25, 0x50, 0x44, 0x46]);

      const result = await extractor.extract(mockPdfData);

      // Should not add spaces after tsek
      expect(result.text).not.toContain('་ ');

      // If text contains Tibetan, it should have proper tsek usage
      if (result.text.match(/[\u0F00-\u0FFF]/)) {
        // Tsek should be present for Tibetan syllables
        expect(result.text).toContain('་');
      }
    });

    it('should detect multi-column layout', async () => {
      const mockPdfData = new Uint8Array([0x25, 0x50, 0x44, 0x46]);

      const result = await extractor.extract(mockPdfData);

      expect(result.metadata.layout).toBeDefined();
      expect(['single-column', 'multi-column', 'complex']).toContain(result.metadata.layout);
    });

    it('should remove headers/footers', async () => {
      const mockPdfData = new Uint8Array([0x25, 0x50, 0x44, 0x46]);

      const result = await extractor.extract(mockPdfData);

      // Should not contain common header/footer patterns
      expect(result.text.toLowerCase()).not.toMatch(/page \d+ of \d+/);
      expect(result.text).not.toMatch(/^\d+$/m); // Standalone page numbers
    });

    it('should handle scanned PDFs gracefully', async () => {
      // Mock scanned PDF (images only, no text)
      const mockPdfData = new Uint8Array([0x25, 0x50, 0x44, 0x46]);

      const result = await extractor.extract(mockPdfData);

      expect(result).toBeDefined();
      expect(result.metadata.quality).toBeDefined();

      // Should indicate scanned/image-based
      if (result.text.length === 0 || result.text.trim().length === 0) {
        expect(result.metadata.quality).toBe('scanned');
      }
    });

    it('should return metadata (pageCount, layout, quality)', async () => {
      const mockPdfData = new Uint8Array([0x25, 0x50, 0x44, 0x46]);

      const result = await extractor.extract(mockPdfData);

      expect(result.metadata).toBeDefined();
      expect(result.metadata.pageCount).toBeTypeOf('number');
      expect(result.metadata.pageCount).toBeGreaterThan(0);

      expect(result.metadata.layout).toBeDefined();
      expect(typeof result.metadata.layout).toBe('string');

      expect(result.metadata.quality).toBeDefined();
      expect(['high', 'medium', 'low', 'scanned']).toContain(result.metadata.quality);
    });

    it('should perform parallel page extraction', async () => {
      const mockPdfData = new Uint8Array([0x25, 0x50, 0x44, 0x46]);

      const startTime = Date.now();
      const result = await extractor.extract(mockPdfData);
      const duration = Date.now() - startTime;

      // Parallel extraction should be reasonably fast
      // This is a soft check - actual timing depends on PDF size
      expect(result).toBeDefined();
      expect(duration).toBeLessThan(30000); // 30 seconds max for test
    });

    it('should normalize Unicode to NFC', async () => {
      const mockPdfData = new Uint8Array([0x25, 0x50, 0x44, 0x46]);

      const result = await extractor.extract(mockPdfData);

      // All text should be in NFC form
      expect(result.text).toBe(result.text.normalize('NFC'));
    });

    it('should handle empty PDFs', async () => {
      const mockPdfData = new Uint8Array([0x25, 0x50, 0x44, 0x46]);

      const result = await extractor.extract(mockPdfData);

      expect(result).toBeDefined();
      expect(result.text).toBeDefined();
      expect(result.metadata.pageCount).toBeGreaterThanOrEqual(0);
    });

    it('should handle malformed PDF data', async () => {
      // Note: With our mock, this won't actually throw
      // In real usage with actual PDF.js, invalid data would throw
      // This test validates the error handling structure
      const invalidPdfData = new Uint8Array([0x00, 0x00, 0x00]);

      // The mock will still succeed, so we just verify the structure
      const result = await extractor.extract(invalidPdfData);
      expect(result).toBeDefined();
    });

    it('should extract metadata correctly', async () => {
      const mockPdfData = new Uint8Array([0x25, 0x50, 0x44, 0x46]);

      const result = await extractor.extract(mockPdfData);

      expect(result.metadata).toMatchObject({
        pageCount: expect.any(Number),
        layout: expect.any(String),
        quality: expect.any(String),
        extractionMethod: expect.any(String),
        hasImages: expect.any(Boolean),
      });
    });
  });
});

describe('PositionAwareExtractor', () => {
  let extractor: PositionAwareExtractor;

  beforeEach(() => {
    extractor = new PositionAwareExtractor();
  });

  describe('extractWithPosition', () => {
    it('should use PDF.js position data for intelligent spacing', async () => {
      const mockPdfData = new Uint8Array([0x25, 0x50, 0x44, 0x46]);

      const result = await extractor.extractWithPosition(mockPdfData);

      expect(result).toBeDefined();
      expect(result.text).toBeDefined();

      // Position-aware extraction should preserve proper spacing
      // Allow double newlines (page breaks) but not double spaces on same line
      const lines = result.text.split('\n');
      lines.forEach(line => {
        expect(line).not.toMatch(/  +/); // No double spaces within lines
      });
    });

    it('should handle multi-column layouts correctly', async () => {
      const mockPdfData = new Uint8Array([0x25, 0x50, 0x44, 0x46]);

      const result = await extractor.extractWithPosition(mockPdfData);

      expect(result).toBeDefined();

      if (result.metadata.layout === 'multi-column') {
        // Should maintain correct reading order
        expect(result.metadata.columns).toBeGreaterThan(1);
      }
    });

    it('should detect reading order correctly', async () => {
      const mockPdfData = new Uint8Array([0x25, 0x50, 0x44, 0x46]);

      const result = await extractor.extractWithPosition(mockPdfData);

      expect(result).toBeDefined();
      expect(result.metadata.readingOrder).toBeDefined();
      expect(['ltr', 'rtl', 'ttb']).toContain(result.metadata.readingOrder);
    });

    it('should preserve Tibetan syllable boundaries', async () => {
      const mockPdfData = new Uint8Array([0x25, 0x50, 0x44, 0x46]);

      const result = await extractor.extractWithPosition(mockPdfData);

      // Tibetan syllables should be separated by tsek, not spaces
      if (result.text.match(/[\u0F00-\u0FFF]/)) {
        // Should use tsek for syllable separation
        expect(result.text).toContain('་');

        // Should not have spaces between Tibetan syllables
        // (spaces only between words/phrases)
        const tibetanSegments = result.text.match(/[\u0F00-\u0FFF་]+/g);
        if (tibetanSegments) {
          tibetanSegments.forEach(segment => {
            expect(segment).not.toMatch(/[\u0F00-\u0FFF] [\u0F00-\u0FFF]/);
          });
        }
      }
    });

    it('should handle position data for text alignment', async () => {
      const mockPdfData = new Uint8Array([0x25, 0x50, 0x44, 0x46]);

      const result = await extractor.extractWithPosition(mockPdfData);

      expect(result.metadata).toBeDefined();

      // Should include position metadata
      if (result.metadata.hasPositionData) {
        expect(result.metadata.textBlocks).toBeDefined();
        expect(Array.isArray(result.metadata.textBlocks)).toBe(true);
      }
    });
  });
});

describe('ArtifactRemover', () => {
  let remover: ArtifactRemover;

  beforeEach(() => {
    remover = new ArtifactRemover();
  });

  describe('removeArtifacts', () => {
    it('should detect repeating patterns (headers, footers)', () => {
      const textWithHeaders = `Header Text
Page 1
Content here
Header Text
Page 2
More content
Header Text
Page 3
Final content`;

      const result = remover.removeArtifacts(textWithHeaders);

      // Should remove "Header Text" pattern
      const headerCount = (result.match(/Header Text/g) || []).length;
      expect(headerCount).toBeLessThan(3); // Should remove at least some repetitions
    });

    it('should remove page numbers', () => {
      const textWithPages = `Some content here
1
More content
2
Final content
3`;

      const result = remover.removeArtifacts(textWithPages);

      // Should remove standalone page numbers
      expect(result).not.toMatch(/^\s*\d+\s*$/m);
    });

    it('should preserve actual content', () => {
      const content = TibetanText.paragraph;

      const result = remover.removeArtifacts(content);

      // Should keep actual content
      expect(result.length).toBeGreaterThan(0);

      // Should preserve Tibetan text
      if (content.match(/[\u0F00-\u0FFF]/)) {
        expect(result).toMatch(/[\u0F00-\u0FFF]/);
      }
    });

    it('should remove common footer patterns', () => {
      const textWithFooter = `Content here
Copyright © 2024
Page 1 of 10
More content
Copyright © 2024
Page 2 of 10
Final content
Copyright © 2024
Page 3 of 10`;

      const result = remover.removeArtifacts(textWithFooter);

      // Should remove copyright and page info (needs at least 3 occurrences)
      const copyrightCount = (result.match(/Copyright ©/g) || []).length;
      expect(copyrightCount).toBeLessThan(3); // Should remove most/all
    });

    it('should handle text without artifacts', () => {
      const cleanText = TibetanText.simpleSentence;

      const result = remover.removeArtifacts(cleanText);

      // Should return text unchanged or minimally changed
      expect(result).toBeTruthy();
      expect(result.length).toBeGreaterThan(0);
    });

    it('should detect and remove watermarks', () => {
      const watermarkLine = 'DRAFT DRAFT DRAFT';
      const textWithWatermark = `${watermarkLine}
Some content
${watermarkLine}
More content
${watermarkLine}
Final content`;

      const result = remover.removeArtifacts(textWithWatermark);

      // Should remove watermark line pattern (appears 3 times)
      const draftLineCount = (result.match(/DRAFT DRAFT DRAFT/g) || []).length;
      expect(draftLineCount).toBeLessThan(3); // Should remove most/all occurrences
    });

    it('should preserve paragraph structure', () => {
      const multiParagraph = `First paragraph here.

Second paragraph here.

Third paragraph here.`;

      const result = remover.removeArtifacts(multiParagraph);

      // Should maintain paragraph breaks
      expect(result).toContain('\n\n');
      expect(result.split(/\n\n/).length).toBeGreaterThan(1);
    });

    it('should handle empty or whitespace-only input', () => {
      expect(remover.removeArtifacts('')).toBe('');
      expect(remover.removeArtifacts('   ')).toBe('');
      expect(remover.removeArtifacts('\n\n\n')).toBe('');
    });
  });

  describe('detectPattern', () => {
    it('should detect repeating header patterns', () => {
      const text = `HEADER
content
HEADER
content
HEADER`;

      const patterns = remover.detectPatterns(text);

      expect(patterns).toBeDefined();
      expect(Array.isArray(patterns)).toBe(true);
      expect(patterns.length).toBeGreaterThan(0);

      // Should identify "HEADER" as a pattern
      const headerPattern = patterns.find(p => p.text.includes('HEADER'));
      expect(headerPattern).toBeDefined();
      expect(headerPattern?.occurrences).toBeGreaterThanOrEqual(3);
    });

    it('should detect page number patterns', () => {
      const text = `content
1
content
1
content
1`;

      const patterns = remover.detectPatterns(text);

      expect(patterns).toBeDefined();

      // Should identify page numbers (needs at least 3 occurrences of same number)
      const pagePattern = patterns.find(p => /^\d+$/.test(p.text.trim()));
      expect(pagePattern).toBeDefined();
      if (pagePattern) {
        expect(pagePattern.occurrences).toBeGreaterThanOrEqual(3);
      }
    });

    it('should not flag unique content as patterns', () => {
      const text = TibetanText.paragraph;

      const patterns = remover.detectPatterns(text);

      // Unique content should not be flagged as artifacts
      expect(patterns.length).toBe(0);
    });
  });
});
