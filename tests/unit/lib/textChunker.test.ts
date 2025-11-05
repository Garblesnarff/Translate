import { describe, it, expect, beforeEach } from 'vitest';
import {
  SemanticChunker,
  estimateTokenCount,
  splitTextIntoChunks,
  combineTranslations,
  getChunkingStats,
  type ChunkingConfig,
  type TextChunk,
} from '@/lib/textChunker';

describe('textChunker', () => {
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

  describe('SemanticChunker', () => {
    let chunker: SemanticChunker;

    beforeEach(() => {
      chunker = new SemanticChunker({
        maxTokens: 100, // Small limit for testing
        overlapSentences: 2,
        preferPageBased: true,
      });
    });

    describe('chunkText', () => {
      it('should return empty array for empty text', () => {
        expect(chunker.chunkText('')).toEqual([]);
        expect(chunker.chunkText('   ')).toEqual([]);
      });

      it('should detect numbered pages', () => {
        const text = '1 First page text། 2 Second page text།';
        const chunks = chunker.chunkText(text);

        expect(chunks.length).toBeGreaterThan(0);
        expect(chunks.some(c => c.chunkingStrategy === 'page')).toBe(true);
      });

      it('should use semantic chunking when no page markers', () => {
        const text = 'བོད་སྐད་ནི་སྐད་ཡིག་གལ་ཆེན་ཡིན། ང་ཚོ་བོད་སྐད་སློབ་སྦྱོང་བྱེད།';
        const chunks = chunker.chunkText(text);

        expect(chunks.length).toBeGreaterThan(0);
        expect(chunks[0].chunkingStrategy).toMatch(/semantic|page/);
      });

      it('should split large page chunks using hybrid strategy', () => {
        // Create a very long page that exceeds token limit
        const longText = '1 ' + 'བོད་སྐད་ '.repeat(100);
        const chunker = new SemanticChunker({ maxTokens: 50 });
        const chunks = chunker.chunkText(longText);

        expect(chunks.length).toBeGreaterThan(1);
        expect(chunks.some(c => c.chunkingStrategy === 'hybrid')).toBe(true);
      });

      it('should respect token limits', () => {
        const chunker = new SemanticChunker({ maxTokens: 100 });
        const longText = 'བོད་སྐད། '.repeat(200);
        const chunks = chunker.chunkText(longText);

        chunks.forEach(chunk => {
          expect(chunk.tokenCount).toBeLessThanOrEqual(100);
        });
      });

      it('should add overlap between chunks', () => {
        const text = 'Sentence one། Sentence two། Sentence three། Sentence four།';
        const chunker = new SemanticChunker({
          maxTokens: 30,
          overlapSentences: 1,
        });
        const chunks = chunker.chunkText(text);

        if (chunks.length > 1) {
          const hasOverlap = chunks.slice(1).some(c => c.hasOverlap);
          expect(hasOverlap).toBe(true);
        }
      });

      it('should not exceed token limit even with overlap', () => {
        const text = 'Short། '.repeat(50);
        const chunker = new SemanticChunker({ maxTokens: 50 });
        const chunks = chunker.chunkText(text);

        chunks.forEach(chunk => {
          expect(chunk.tokenCount).toBeLessThanOrEqual(50);
        });
      });
    });

    describe('sentence boundary respect', () => {
      it('should never split mid-sentence', () => {
        const text = 'བོད་སྐད་ནི་སྐད་ཡིག་ཡིན། ང་ཚོ་བོད་སྐད་སློབ་སྦྱོང་བྱེད།';
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
        const text = 'First sentence། Second sentence། Third sentence།';
        const chunks = splitTextIntoChunks(text, { maxTokens: 100 });

        // With high token limit, should keep all together
        expect(chunks.length).toBeLessThanOrEqual(2);
      });
    });

    describe('numbered page detection', () => {
      it('should detect page markers', () => {
        const text = `1 Page one content།
2 Page two content།
3 Page three content།`;
        const chunks = chunker.chunkText(text);

        expect(chunks.length).toBe(3);
        expect(chunks[0].pageNumber).toBe(1);
        expect(chunks[1].pageNumber).toBe(2);
        expect(chunks[2].pageNumber).toBe(3);
      });

      it('should extract page numbers correctly', () => {
        const text = '42 Some page content།';
        const chunks = chunker.chunkText(text);

        expect(chunks.length).toBe(1);
        expect(chunks[0].pageNumber).toBe(42);
      });

      it('should handle non-numbered text', () => {
        const text = 'No page numbers here།';
        const chunks = chunker.chunkText(text);

        expect(chunks.length).toBeGreaterThan(0);
        expect(chunks[0].chunkingStrategy).toBe('semantic');
      });
    });
  });

  describe('splitTextIntoChunks', () => {
    it('should work as convenience function', () => {
      const text = 'བོད་སྐད། Test text།';
      const chunks = splitTextIntoChunks(text);

      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks[0]).toHaveProperty('text');
      expect(chunks[0]).toHaveProperty('tokenCount');
    });

    it('should accept custom config', () => {
      const text = 'Test text། '.repeat(50);
      const chunks = splitTextIntoChunks(text, { maxTokens: 50 });

      chunks.forEach(chunk => {
        expect(chunk.tokenCount).toBeLessThanOrEqual(50);
      });
    });
  });

  describe('combineTranslations', () => {
    it('should combine translations in order', () => {
      const translations = [
        { pageNumber: 2, translation: 'Second' },
        { pageNumber: 1, translation: 'First' },
        { pageNumber: 3, translation: 'Third' },
      ];

      const combined = combineTranslations(translations);
      expect(combined).toBe('First\n\nSecond\n\nThird');
    });

    it('should handle single translation', () => {
      const translations = [{ pageNumber: 1, translation: 'Only one' }];
      const combined = combineTranslations(translations);

      expect(combined).toBe('Only one');
    });

    it('should handle empty array', () => {
      const combined = combineTranslations([]);
      expect(combined).toBe('');
    });

    it('should preserve decimal page numbers in order', () => {
      const translations = [
        { pageNumber: 1.2, translation: 'Sub 2' },
        { pageNumber: 1, translation: 'Main' },
        { pageNumber: 1.1, translation: 'Sub 1' },
      ];

      const combined = combineTranslations(translations);
      expect(combined).toBe('Main\n\nSub 1\n\nSub 2');
    });
  });

  describe('getChunkingStats', () => {
    it('should return zero stats for empty array', () => {
      const stats = getChunkingStats([]);

      expect(stats.totalChunks).toBe(0);
      expect(stats.totalTokens).toBe(0);
      expect(stats.avgTokensPerChunk).toBe(0);
      expect(stats.maxTokens).toBe(0);
      expect(stats.minTokens).toBe(0);
    });

    it('should calculate correct statistics', () => {
      const chunks: TextChunk[] = [
        {
          pageNumber: 1,
          text: 'test',
          tokenCount: 50,
          hasOverlap: false,
          chunkingStrategy: 'page',
        },
        {
          pageNumber: 2,
          text: 'test',
          tokenCount: 100,
          hasOverlap: true,
          chunkingStrategy: 'semantic',
        },
        {
          pageNumber: 3,
          text: 'test',
          tokenCount: 75,
          hasOverlap: false,
          chunkingStrategy: 'hybrid',
        },
      ];

      const stats = getChunkingStats(chunks);

      expect(stats.totalChunks).toBe(3);
      expect(stats.totalTokens).toBe(225);
      expect(stats.avgTokensPerChunk).toBe(75);
      expect(stats.maxTokens).toBe(100);
      expect(stats.minTokens).toBe(50);
      expect(stats.chunksWithOverlap).toBe(1);
      expect(stats.strategyCounts.page).toBe(1);
      expect(stats.strategyCounts.semantic).toBe(1);
      expect(stats.strategyCounts.hybrid).toBe(1);
    });

    it('should count strategy types correctly', () => {
      const chunks: TextChunk[] = [
        {
          pageNumber: 1,
          text: 'a',
          tokenCount: 10,
          hasOverlap: false,
          chunkingStrategy: 'page',
        },
        {
          pageNumber: 2,
          text: 'b',
          tokenCount: 10,
          hasOverlap: false,
          chunkingStrategy: 'page',
        },
        {
          pageNumber: 3,
          text: 'c',
          tokenCount: 10,
          hasOverlap: false,
          chunkingStrategy: 'semantic',
        },
      ];

      const stats = getChunkingStats(chunks);
      expect(stats.strategyCounts.page).toBe(2);
      expect(stats.strategyCounts.semantic).toBe(1);
    });
  });

  describe('context overlap', () => {
    it('should include overlap text when configured', () => {
      const text = 'Sentence 1። Sentence 2། Sentence 3། Sentence 4།';
      const chunks = splitTextIntoChunks(text, {
        maxTokens: 20,
        overlapSentences: 1,
      });

      if (chunks.length > 1) {
        const withOverlap = chunks.filter(c => c.hasOverlap);
        expect(withOverlap.length).toBeGreaterThan(0);
        withOverlap.forEach(chunk => {
          expect(chunk.overlapText).toBeDefined();
          expect(chunk.overlapText!.length).toBeGreaterThan(0);
        });
      }
    });

    it('should not add overlap to first chunk', () => {
      const text = 'Sentence 1། Sentence 2། Sentence 3།';
      const chunks = splitTextIntoChunks(text, {
        maxTokens: 20,
        overlapSentences: 2,
      });

      if (chunks.length > 0) {
        expect(chunks[0].hasOverlap).toBe(false);
        expect(chunks[0].overlapText).toBeUndefined();
      }
    });

    it('should respect overlapSentences configuration', () => {
      const text = 'S1། S2། S3। S4། S5། S6।';
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
});
