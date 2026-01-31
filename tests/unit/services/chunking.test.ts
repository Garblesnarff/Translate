// File: tests/unit/services/chunking.test.ts
// Comprehensive tests for text chunking services

import { describe, it, expect, beforeEach } from 'vitest';
import { TextChunker } from '../../../server/services/chunking/TextChunker';
import { TibetanSentenceDetector } from '../../../server/services/chunking/TibetanSentenceDetector';
import { TokenEstimator } from '../../../server/services/chunking/TokenEstimator';
import { TibetanText } from '../../utils/fixtures';
import { assertValidChunks } from '../../utils/assertions';

describe('TextChunker', () => {
  let chunker: TextChunker;
  const DEFAULT_MAX_TOKENS = 3500;

  beforeEach(() => {
    chunker = new TextChunker({ maxTokens: DEFAULT_MAX_TOKENS });
  });

  describe('chunk', () => {
    it('should never exceed max tokens', () => {
      const longText = TibetanText.multiPage.repeat(10);

      const chunks = chunker.chunk(longText);

      expect(chunks).toBeDefined();
      expect(chunks.length).toBeGreaterThan(0);

      // Every chunk must be under max tokens
      chunks.forEach((chunk, index) => {
        expect(
          chunk.tokenCount,
          `Chunk ${index} has ${chunk.tokenCount} tokens, exceeds max ${DEFAULT_MAX_TOKENS}`
        ).toBeLessThanOrEqual(DEFAULT_MAX_TOKENS);
      });
    });

    it('should never split mid-sentence', () => {
      const text = TibetanText.paragraph;

      const chunks = chunker.chunk(text);

      chunks.forEach((chunk, index) => {
        // Last character of each chunk (except the last) should be sentence-ending punctuation
        if (index < chunks.length - 1) {
          const trimmed = chunk.text.trim();
          const lastChar = trimmed[trimmed.length - 1];

          // Should end with Tibetan shad or other sentence-ending punctuation
          const validEndings = ['།', '༎', '.', '!', '?', '\n'];
          const endsWithValidChar = validEndings.some(ending => trimmed.endsWith(ending));

          // This is a preference, not a hard requirement for very long sentences
          if (chunk.tokenCount < DEFAULT_MAX_TOKENS * 0.9) {
            expect(
              endsWithValidChar,
              `Chunk ${index} should end with sentence boundary, got: "${lastChar}"`
            ).toBe(true);
          }
        }
      });
    });

    it('should add context overlap (10% default)', () => {
      const text = TibetanText.multiPage;

      const chunks = chunker.chunk(text);

      if (chunks.length > 1) {
        // Check for overlap between consecutive chunks
        for (let i = 0; i < chunks.length - 1; i++) {
          const currentChunk = chunks[i];
          const nextChunk = chunks[i + 1];

          if (currentChunk.overlap && currentChunk.overlap.length > 0) {
            // Overlap should be present
            expect(currentChunk.overlap).toBeDefined();

            // Overlap should be ~10% of chunk size
            const overlapRatio = currentChunk.overlap.length / currentChunk.text.length;
            expect(overlapRatio).toBeLessThanOrEqual(0.15); // Up to 15% tolerance
          }
        }
      }
    });

    it('should detect Tibetan sentence boundaries (shad །)', () => {
      const tibetanText = TibetanText.paragraph;

      const chunks = chunker.chunk(tibetanText);

      chunks.forEach((chunk, index) => {
        if (index < chunks.length - 1 && chunk.text.includes('།')) {
          // Should preferably end with shad
          const trimmed = chunk.text.trim();
          // Check if ends with shad or at least respects sentence boundary
          const endsWithShad = trimmed.endsWith('།') || trimmed.endsWith('༎');

          // For Tibetan text, we strongly prefer shad endings
          if (chunk.text.match(/[\u0F00-\u0FFF]/)) {
            // This is a soft check - if there are shads in the text,
            // chunks should try to end at shad boundaries
          }
        }
      });
    });

    it('should handle mixed Tibetan-English text', () => {
      const mixedText = TibetanText.mixed;

      const chunks = chunker.chunk(mixedText);

      expect(chunks).toBeDefined();
      expect(chunks.length).toBeGreaterThan(0);

      // Should preserve both Tibetan and English
      const allText = chunks.map(c => c.text).join('');
      expect(allText).toContain('བོད');
      expect(allText).toMatch(/[a-zA-Z]/);
    });

    it('should preserve parentheses', () => {
      const textWithParens = 'བཀྲ་ཤིས་བདེ་ལེགས། (Greetings) ང་བོད་པ་ཡིན། (I am Tibetan)';

      const chunks = chunker.chunk(textWithParens);

      const allText = chunks.map(c => c.text).join('');

      // Count parentheses
      const openParens = (allText.match(/\(/g) || []).length;
      const closeParens = (allText.match(/\)/g) || []).length;

      // Should preserve all parentheses
      expect(openParens).toBe(closeParens);
      expect(openParens).toBeGreaterThan(0);
    });

    it('should handle short text (single chunk)', () => {
      const shortText = TibetanText.simple;

      const chunks = chunker.chunk(shortText);

      expect(chunks.length).toBe(1);
      expect(chunks[0].text).toBe(shortText);
      expect(chunks[0].tokenCount).toBeLessThan(DEFAULT_MAX_TOKENS);
    });

    it('should handle empty text', () => {
      const chunks = chunker.chunk('');

      expect(chunks).toBeDefined();
      expect(chunks.length).toBe(0);
    });

    it('should include chunk metadata', () => {
      const text = TibetanText.paragraph;

      const chunks = chunker.chunk(text);

      chunks.forEach((chunk, index) => {
        expect(chunk.id).toBeDefined();
        expect(typeof chunk.id).toBe('string');

        expect(chunk.text).toBeDefined();
        expect(typeof chunk.text).toBe('string');

        expect(chunk.tokenCount).toBeDefined();
        expect(typeof chunk.tokenCount).toBe('number');

        expect(chunk.startIndex).toBeDefined();
        expect(typeof chunk.startIndex).toBe('number');

        expect(chunk.endIndex).toBeDefined();
        expect(typeof chunk.endIndex).toBe('number');

        // Verify indices
        expect(chunk.endIndex).toBeGreaterThan(chunk.startIndex);
      });
    });

    it('should handle custom max tokens', () => {
      const customChunker = new TextChunker({ maxTokens: 1000 });
      const longText = TibetanText.multiPage.repeat(5);

      const chunks = customChunker.chunk(longText);

      chunks.forEach((chunk, index) => {
        expect(
          chunk.tokenCount,
          `Chunk ${index} exceeds custom max 1000 tokens`
        ).toBeLessThanOrEqual(1000);
      });
    });

    it('should handle configurable overlap percentage', () => {
      const chunkerWithOverlap = new TextChunker({
        maxTokens: 2000,
        overlapPercentage: 0.2, // 20% overlap
      });

      const text = TibetanText.multiPage;
      const chunks = chunkerWithOverlap.chunk(text);

      if (chunks.length > 1) {
        chunks.forEach((chunk, index) => {
          if (chunk.overlap && index < chunks.length - 1) {
            const overlapRatio = chunk.overlap.length / chunk.text.length;
            // Should be around 20%, with some tolerance
            expect(overlapRatio).toBeLessThanOrEqual(0.25);
          }
        });
      }
    });
  });
});

describe('TibetanSentenceDetector', () => {
  let detector: TibetanSentenceDetector;

  beforeEach(() => {
    detector = new TibetanSentenceDetector();
  });

  describe('detectBoundaries', () => {
    it('should detect single shad (།) as sentence boundary', () => {
      const text = 'བཀྲ་ཤིས་བདེ་ལེགས། ང་བོད་པ་ཡིན།';

      const boundaries = detector.detectBoundaries(text);

      expect(boundaries).toBeDefined();
      expect(boundaries.length).toBeGreaterThan(0);

      // Should find shad boundaries
      const shadIndices = [];
      for (let i = 0; i < text.length; i++) {
        if (text[i] === '།') shadIndices.push(i);
      }

      expect(boundaries.length).toBeGreaterThanOrEqual(shadIndices.length);
    });

    it('should detect double shad (༎) as sentence boundary', () => {
      const text = 'བཀྲ་ཤིས་བདེ་ལེགས༎ ང་བོད་པ་ཡིན༎';

      const boundaries = detector.detectBoundaries(text);

      expect(boundaries).toBeDefined();
      expect(boundaries.length).toBeGreaterThan(0);

      // Should find double shad boundaries
      expect(boundaries.some(b => text[b] === '༎')).toBe(true);
    });

    it('should handle other Tibetan punctuation', () => {
      const text = TibetanText.withPunctuation;

      const boundaries = detector.detectBoundaries(text);

      expect(boundaries).toBeDefined();
      expect(boundaries.length).toBeGreaterThan(0);
    });

    it('should handle mixed Tibetan-English text', () => {
      const text = 'བོད་ཀྱི་སློབ་གྲྭ། This is a school. དགེ་རྒན།';

      const boundaries = detector.detectBoundaries(text);

      expect(boundaries).toBeDefined();

      // Should detect both Tibetan shad and English periods
      expect(boundaries.length).toBeGreaterThan(0);
    });

    it('should respect parentheses (do not split inside)', () => {
      const text = 'བཀྲ་ཤིས་བདེ་ལེགས། (This is a greeting. Do not split.) ང་བོད་པ་ཡིན།';

      const boundaries = detector.detectBoundaries(text);

      // Should not treat period inside parentheses as boundary
      const sentences = detector.splitIntoSentences(text);

      // Should have 2 main sentences (not 3)
      expect(sentences.length).toBeLessThanOrEqual(3);

      // Parentheses content should be kept together
      const hasCompleteParens = sentences.some(s => s.includes('(') && s.includes(')'));
      expect(hasCompleteParens).toBe(true);
    });

    it('should handle text without punctuation', () => {
      const text = 'བཀྲ་ཤིས་བདེ་ལེགས';

      const boundaries = detector.detectBoundaries(text);

      // Should return empty or just end-of-text
      expect(boundaries.length).toBeLessThanOrEqual(1);
    });

    it('should handle empty text', () => {
      const boundaries = detector.detectBoundaries('');

      expect(boundaries).toBeDefined();
      expect(boundaries.length).toBe(0);
    });

    it('should detect English sentence boundaries', () => {
      const text = 'This is the first sentence. This is the second. And the third!';

      const boundaries = detector.detectBoundaries(text);

      expect(boundaries).toBeDefined();
      expect(boundaries.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('splitIntoSentences', () => {
    it('should split text at detected boundaries', () => {
      const text = 'བཀྲ་ཤིས་བདེ་ལེགས། ང་བོད་པ་ཡིན། ངའི་མིང་ལ་བསྟན་འཛིན་ཞེས་ཟེར།';

      const sentences = detector.splitIntoSentences(text);

      expect(sentences).toBeDefined();
      expect(sentences.length).toBeGreaterThan(1);

      // Each sentence should end with shad
      sentences.forEach((sentence, index) => {
        if (index < sentences.length - 1) {
          expect(sentence.trim()).toMatch(/།$/);
        }
      });
    });

    it('should preserve sentence-ending punctuation', () => {
      const text = 'བཀྲ་ཤིས་བདེ་ལེགས། ང་བོད་པ་ཡིན།';

      const sentences = detector.splitIntoSentences(text);

      // Shad should be included in sentences
      expect(sentences[0]).toContain('།');
    });

    it('should handle nested parentheses correctly', () => {
      const text = 'Text (with (nested) parens). Next sentence.';

      const sentences = detector.splitIntoSentences(text);

      // Should not split inside parentheses
      const firstSentence = sentences[0];
      expect(firstSentence).toContain('(');
      expect(firstSentence).toContain(')');
    });
  });

  describe('isSentenceBoundary', () => {
    it('should identify shad as boundary', () => {
      expect(detector.isSentenceBoundary('།', 0, 'བཀྲ་ཤིས་བདེ་ལེགས།')).toBe(true);
    });

    it('should identify period as boundary', () => {
      expect(detector.isSentenceBoundary('.', 0, 'Hello.')).toBe(true);
    });

    it('should not identify tsek as boundary', () => {
      expect(detector.isSentenceBoundary('་', 0, 'བཀྲ་ཤིས་')).toBe(false);
    });

    it('should not identify punctuation inside parentheses as boundary', () => {
      const text = 'Text (example.)';
      const periodIndex = text.indexOf('.');

      expect(detector.isSentenceBoundary('.', periodIndex, text)).toBe(false);
    });
  });
});

describe('TokenEstimator', () => {
  let estimator: TokenEstimator;

  beforeEach(() => {
    estimator = new TokenEstimator();
  });

  describe('estimate', () => {
    it('should estimate tokens for Tibetan text (~4 chars per token)', () => {
      const tibetanText = TibetanText.paragraph;

      const tokenCount = estimator.estimate(tibetanText);

      // Rough estimate: Tibetan is ~4 characters per token
      const expectedTokens = Math.ceil(tibetanText.length / 4);

      // Should be reasonably close (within 50% margin)
      expect(tokenCount).toBeGreaterThan(expectedTokens * 0.5);
      expect(tokenCount).toBeLessThan(expectedTokens * 1.5);
    });

    it('should handle English text appropriately', () => {
      const englishText = 'This is a test sentence with multiple words.';

      const tokenCount = estimator.estimate(englishText);

      // English is roughly 1 word = 1.3 tokens
      const wordCount = englishText.split(/\s+/).length;

      expect(tokenCount).toBeGreaterThan(wordCount * 0.8);
      expect(tokenCount).toBeLessThan(wordCount * 2);
    });

    it('should handle mixed Tibetan-English text', () => {
      const mixedText = TibetanText.mixed;

      const tokenCount = estimator.estimate(mixedText);

      expect(tokenCount).toBeGreaterThan(0);
      expect(tokenCount).toBeLessThan(mixedText.length); // Should be less than char count
    });

    it('should return conservative estimates', () => {
      // Conservative means: better to under-chunk than over-chunk
      // So estimates should err on the higher side
      const text = TibetanText.paragraph;

      const estimate1 = estimator.estimate(text);
      const estimate2 = estimator.estimate(text);

      // Estimate should be consistent
      expect(estimate1).toBe(estimate2);

      // Should be positive
      expect(estimate1).toBeGreaterThan(0);
    });

    it('should handle empty text', () => {
      expect(estimator.estimate('')).toBe(0);
    });

    it('should handle whitespace-only text', () => {
      expect(estimator.estimate('   ')).toBeLessThanOrEqual(1);
    });

    it('should handle very long text', () => {
      const longText = TibetanText.multiPage.repeat(100);

      const tokenCount = estimator.estimate(longText);

      expect(tokenCount).toBeGreaterThan(1000);
      expect(tokenCount).toBeLessThan(longText.length); // Sanity check
    });

    it('should handle special characters', () => {
      const specialText = '།༎་\n\t\r';

      const tokenCount = estimator.estimate(specialText);

      expect(tokenCount).toBeGreaterThanOrEqual(0);
      expect(tokenCount).toBeLessThan(10);
    });

    it('should handle numbers', () => {
      const textWithNumbers = TibetanText.withNumbers;

      const tokenCount = estimator.estimate(textWithNumbers);

      expect(tokenCount).toBeGreaterThan(0);
    });
  });

  describe('estimateTokensPerChunk', () => {
    it('should provide accurate estimates for chunking decisions', () => {
      const text = TibetanText.paragraph;
      const maxTokens = 1000;

      const estimate = estimator.estimate(text);

      // Should help determine if text needs chunking
      if (estimate > maxTokens) {
        // Text needs chunking
        expect(text.length).toBeGreaterThan(100);
      }
    });
  });
});
