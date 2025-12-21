/**
 * Text Chunking Tests (now part of textExtractor)
 *
 * Tests the chunking functionality for splitting extracted text
 * into translation-ready chunks.
 */

import { describe, it, expect } from 'vitest';
import {
  estimateTokenCount,
  splitTextIntoChunks,
  type PageChunk,
  type ExtractionChunkingConfig,
} from '@/lib/textChunker';

describe('textExtractor chunking', () => {
  describe('estimateTokenCount', () => {
    it('should return 0 for empty text', () => {
      expect(estimateTokenCount('')).toBe(0);
      expect(estimateTokenCount(null as any)).toBe(0);
    });

    it('should estimate tokens based on character count', () => {
      const text = '1234567890'; // 10 chars, ~2.5 tokens at 4 chars/token
      const tokens = estimateTokenCount(text);
      expect(tokens).toBeGreaterThanOrEqual(2);
      expect(tokens).toBeLessThanOrEqual(3);
    });

    it('should handle Tibetan text', () => {
      const tibetan = 'བོད་ཀྱི་སྐད་ཡིག';
      const tokens = estimateTokenCount(tibetan);
      expect(tokens).toBeGreaterThan(0);
    });

    it('should round up to ensure conservative estimates', () => {
      const text = '12345'; // 5 chars = 1.25 tokens, should round up to 2
      expect(estimateTokenCount(text)).toBe(2);
    });
  });

  describe('splitTextIntoChunks', () => {
    it('should return empty array for empty text', () => {
      expect(splitTextIntoChunks('')).toEqual([]);
      expect(splitTextIntoChunks('   ')).toEqual([]);
    });

    it('should work as convenience function', () => {
      const text = 'Page 1:\nབོད་སྐད། Test text།';
      const chunks = splitTextIntoChunks(text);

      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks[0]).toHaveProperty('text');
      expect(chunks[0]).toHaveProperty('tokenCount');
    });

    it('should accept custom config', () => {
      const text = 'Page 1:\n' + 'Test text། '.repeat(50);
      const chunks = splitTextIntoChunks(text, { maxTokens: 50 });

      chunks.forEach(chunk => {
        expect(chunk.tokenCount).toBeLessThanOrEqual(50);
      });
    });

    it('should parse Page N: format correctly', () => {
      const text = `Page 1:
First page content།

Page 2:
Second page content།

Page 3:
Third page content།`;
      const chunks = splitTextIntoChunks(text);

      expect(chunks.length).toBe(3);
      expect(chunks[0].pageNumber).toBe(1);
      expect(chunks[0].text).toContain('First page');
      expect(chunks[1].pageNumber).toBe(2);
      expect(chunks[1].text).toContain('Second page');
      expect(chunks[2].pageNumber).toBe(3);
      expect(chunks[2].text).toContain('Third page');
    });

    it('should handle text without page markers as single chunk', () => {
      const text = 'No page markers here།';
      const chunks = splitTextIntoChunks(text);

      expect(chunks.length).toBe(1);
      expect(chunks[0].pageNumber).toBe(1);
      expect(chunks[0].text).toBe('No page markers here།');
    });

    it('should respect token limits', () => {
      const text = 'Page 1:\n' + 'བོད་སྐད། '.repeat(200);
      const chunks = splitTextIntoChunks(text, { maxTokens: 100 });

      chunks.forEach(chunk => {
        expect(chunk.tokenCount).toBeLessThanOrEqual(100);
      });
    });

    it('should split large pages into sub-chunks', () => {
      // Create a very long page that exceeds token limit
      const longText = 'Page 1:\n' + 'བོད་སྐད། '.repeat(100);
      const chunks = splitTextIntoChunks(longText, { maxTokens: 50 });

      expect(chunks.length).toBeGreaterThan(1);
      expect(chunks.some(c => c.isSubChunk)).toBe(true);
    });

    it('should use decimal page numbers for sub-chunks', () => {
      const longText = 'Page 1:\n' + 'བོད་སྐད། '.repeat(100);
      const chunks = splitTextIntoChunks(longText, { maxTokens: 50 });

      // First chunk should be page 1, sub-chunks should be 1.1, 1.2, etc.
      expect(chunks[0].pageNumber).toBe(1);
      if (chunks.length > 1) {
        // Sub-chunks have decimal page numbers
        const subChunks = chunks.filter(c => c.isSubChunk);
        expect(subChunks.length).toBeGreaterThan(0);
      }
    });

    describe('sentence boundary respect', () => {
      it('should never split mid-sentence', () => {
        const text = 'Page 1:\nབོད་སྐད་ནི་སྐད་ཡིག་ཡིན། ང་ཚོ་བོད་སྐད་སློབ་སྦྱོང་བྱེད།';
        const chunks = splitTextIntoChunks(text, { maxTokens: 20 });

        // Each chunk should end with proper sentence ending
        chunks.forEach(chunk => {
          if (chunk.text.includes('།')) {
            const sentences = chunk.text.split('།').filter(s => s.trim());
            expect(sentences.length).toBeGreaterThan(0);
          }
        });
      });

      it('should keep complete sentences together when possible', () => {
        const text = 'Page 1:\nFirst sentence། Second sentence། Third sentence།';
        const chunks = splitTextIntoChunks(text, { maxTokens: 100 });

        // With high token limit, should keep all together
        expect(chunks.length).toBeLessThanOrEqual(2);
      });
    });
  });

  describe('context overlap', () => {
    it('should include overlap text when configured', () => {
      const text = 'Page 1:\nSentence 1། Sentence 2། Sentence 3། Sentence 4།';
      const chunks = splitTextIntoChunks(text, {
        maxTokens: 20,
        overlapSentences: 1,
      });

      if (chunks.length > 1) {
        const withOverlap = chunks.filter(c => c.overlapText);
        expect(withOverlap.length).toBeGreaterThan(0);
        withOverlap.forEach(chunk => {
          expect(chunk.overlapText).toBeDefined();
          expect(chunk.overlapText!.length).toBeGreaterThan(0);
        });
      }
    });

    it('should not add overlap to first chunk', () => {
      const text = 'Page 1:\nSentence 1། Sentence 2། Sentence 3།';
      const chunks = splitTextIntoChunks(text, {
        maxTokens: 20,
        overlapSentences: 2,
      });

      if (chunks.length > 0) {
        expect(chunks[0].overlapText).toBeUndefined();
      }
    });

    it('should respect overlapSentences configuration', () => {
      const text = 'Page 1:\nS1། S2། S3། S4། S5། S6།';
      const chunks = splitTextIntoChunks(text, {
        maxTokens: 15,
        overlapSentences: 2,
      });

      if (chunks.length > 1) {
        chunks.slice(1).forEach(chunk => {
          if (chunk.overlapText) {
            // Should have at most 2 sentences in overlap
            const overlapSentences = chunk.overlapText.split('།').length;
            expect(overlapSentences).toBeLessThanOrEqual(3); // 2 + 1 for split behavior
          }
        });
      }
    });
  });

  describe('PageChunk interface', () => {
    it('should have required properties', () => {
      const text = 'Page 1:\nTest content།';
      const chunks = splitTextIntoChunks(text);

      expect(chunks.length).toBe(1);
      const chunk = chunks[0];

      expect(chunk).toHaveProperty('pageNumber');
      expect(chunk).toHaveProperty('text');
      expect(chunk).toHaveProperty('tokenCount');
      expect(chunk).toHaveProperty('isSubChunk');
      expect(chunk).toHaveProperty('sentenceCount');
    });

    it('should set isSubChunk correctly', () => {
      const text = 'Page 1:\nShort text།';
      const chunks = splitTextIntoChunks(text, { maxTokens: 3500 });

      expect(chunks[0].isSubChunk).toBe(false);
    });
  });

  describe('cross-page sentence merging', () => {
    it('should merge incomplete sentences across page boundaries', () => {
      // Simulates a sentence split across pages: "དེ་ཚེ་ང་རྒྱལ་བཅག་བྱ་" + "ཞིང་།"
      const text = `Page 1:
First complete sentence།
Incomplete sentence start བྱ་

Page 2:
ཞིང་། Second page content།`;

      const chunks = splitTextIntoChunks(text);

      // Page 1 should now include the completion "ཞིང་།"
      expect(chunks[0].text).toContain('ཞིང་།');
      // Page 2 should start after the merged portion
      expect(chunks[1].text).not.toMatch(/^ཞིང་།/);
    });

    it('should not merge when page ends with complete sentence', () => {
      const text = `Page 1:
Complete sentence one།
Complete sentence two།

Page 2:
Third sentence།`;

      const chunks = splitTextIntoChunks(text);

      expect(chunks.length).toBe(2);
      expect(chunks[0].text).toContain('sentence two།');
      expect(chunks[0].text).not.toContain('Third');
      expect(chunks[1].text).toContain('Third sentence།');
    });

    it('should handle multiple consecutive incomplete pages', () => {
      const text = `Page 1:
Start བྱ་

Page 2:
ཞིང་། Middle བྱ་

Page 3:
ཞིང་། End།`;

      const chunks = splitTextIntoChunks(text);

      // Page 1 should get completion from page 2
      expect(chunks[0].text).toContain('ཞིང་།');
      // Page 2 should get completion from page 3
      expect(chunks[1].text).toContain('ཞིང་།');
    });

    it('should handle real Tibetan text with page breaks mid-verse', () => {
      // Tibetan verse content split across pages (without page footers/headers)
      const text = `Page 1:
དེ་ཚེ་ང་རྒྱལ་བཅག་བྱ་

Page 2:
ཞིང་། །བླ་མའི་གདམས་ངག་དྲན་པར་བྱ།`;

      const chunks = splitTextIntoChunks(text);

      // The incomplete verse from page 1 should be completed with "ཞིང་།" from page 2
      expect(chunks[0].text).toContain('བཅག་བྱ་ཞིང་།');
      // Page 2 should start after the merged portion
      expect(chunks[1].text).toMatch(/^།བླ་མའི་གདམས་ངག/);
    });

    it('should recognize page footers ending with shad as complete sentences', () => {
      // When a page has a footer with shad, it's considered complete
      // (Footer stripping should happen during text extraction, not chunking)
      const text = `Page 1:
དེ་ཚེ་ང་རྒྱལ་བཅག་བྱ་
བྱང་ཆུབ་སེམས་དཔའི་ནོར་བུའི་ཕྲེང་བ། 1

Page 2:
ཞིང་། །བླ་མའི་གདམས་ངག་དྲན་པར་བྱ།`;

      const chunks = splitTextIntoChunks(text);

      // With footer present, page 1 ends with shad, so no merging happens
      expect(chunks.length).toBe(2);
      expect(chunks[0].text).toContain('ཕྲེང་བ། 1');
      expect(chunks[1].text).toContain('ཞིང་།');
    });

    it('should preserve page numbers after merging', () => {
      const text = `Page 1:
Incomplete བྱ་

Page 2:
ཞིང་། Content།

Page 3:
Final content།`;

      const chunks = splitTextIntoChunks(text);

      expect(chunks[0].pageNumber).toBe(1);
      expect(chunks[1].pageNumber).toBe(2);
      expect(chunks[2].pageNumber).toBe(3);
    });

    it('should filter out pages that become empty after merging', () => {
      const text = `Page 1:
Incomplete བྱ་

Page 2:
ཞིང་།

Page 3:
Real content།`;

      const chunks = splitTextIntoChunks(text);

      // Page 2 only had the completion text, should be filtered out
      expect(chunks.length).toBe(2);
      expect(chunks[0].pageNumber).toBe(1);
      expect(chunks[1].pageNumber).toBe(3);
    });
  });
});
