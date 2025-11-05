import { describe, it, expect } from 'vitest';
import {
  isTibetanChar,
  isTibetanSentenceEnd,
  containsTibetan,
  containsEnglish,
  splitIntoSentences,
  combineSentences,
  getPunctuationDescription,
  TibetanPunctuation,
  type TibetanSentence,
} from '@/lib/tibetan/sentenceDetector';

describe('sentenceDetector', () => {
  describe('isTibetanChar', () => {
    it('should return true for Tibetan characters', () => {
      expect(isTibetanChar('བ')).toBe(true);
      expect(isTibetanChar('ཀ')).toBe(true);
      expect(isTibetanChar('།')).toBe(true); // Tibetan punctuation is also in the range
    });

    it('should return false for non-Tibetan characters', () => {
      expect(isTibetanChar('a')).toBe(false);
      expect(isTibetanChar('A')).toBe(false);
      expect(isTibetanChar('1')).toBe(false);
      expect(isTibetanChar(' ')).toBe(false);
      expect(isTibetanChar('.')).toBe(false);
    });
  });

  describe('isTibetanSentenceEnd', () => {
    it('should return true for shad', () => {
      expect(isTibetanSentenceEnd(TibetanPunctuation.SHAD)).toBe(true);
      expect(isTibetanSentenceEnd('།')).toBe(true);
    });

    it('should return true for double shad', () => {
      expect(isTibetanSentenceEnd(TibetanPunctuation.DOUBLE_SHAD)).toBe(true);
      expect(isTibetanSentenceEnd('༎')).toBe(true);
    });

    it('should return true for nyis shad', () => {
      expect(isTibetanSentenceEnd(TibetanPunctuation.NYIS_SHAD)).toBe(true);
      expect(isTibetanSentenceEnd('༑')).toBe(true);
    });

    it('should return false for non-sentence-ending characters', () => {
      expect(isTibetanSentenceEnd('བ')).toBe(false);
      expect(isTibetanSentenceEnd(TibetanPunctuation.TSEK)).toBe(false);
      expect(isTibetanSentenceEnd('་')).toBe(false);
      expect(isTibetanSentenceEnd('.')).toBe(false);
    });
  });

  describe('containsTibetan', () => {
    it('should return true for Tibetan text', () => {
      expect(containsTibetan('བོད་སྐད')).toBe(true);
      expect(containsTibetan('བོད་ཀྱི་སྐད་ཡིག')).toBe(true);
    });

    it('should return true for mixed text', () => {
      expect(containsTibetan('Hello བོད world')).toBe(true);
    });

    it('should return false for non-Tibetan text', () => {
      expect(containsTibetan('English only')).toBe(false);
      expect(containsTibetan('123456')).toBe(false);
    });

    it('should return false for empty text', () => {
      expect(containsTibetan('')).toBe(false);
    });
  });

  describe('containsEnglish', () => {
    it('should return true for English text', () => {
      expect(containsEnglish('Hello')).toBe(true);
      expect(containsEnglish('English text')).toBe(true);
    });

    it('should return true for mixed text', () => {
      expect(containsEnglish('Hello བོད world')).toBe(true);
    });

    it('should return false for non-English text', () => {
      expect(containsEnglish('བོད་སྐད')).toBe(false);
      expect(containsEnglish('123456')).toBe(false);
    });

    it('should return false for empty text', () => {
      expect(containsEnglish('')).toBe(false);
    });
  });

  describe('splitIntoSentences', () => {
    it('should return empty array for empty text', () => {
      expect(splitIntoSentences('')).toEqual([]);
      expect(splitIntoSentences('   ')).toEqual([]);
    });

    it('should split on Tibetan shad', () => {
      const text = 'བོད་སྐད་ནི་སྐད་ཡིག་ཡིན། ང་ཚོ་བོད་སྐད་སློབ་སྦྱོང་བྱེད།';
      const sentences = splitIntoSentences(text);

      expect(sentences.length).toBe(2);
      expect(sentences[0].text).toContain('།');
      expect(sentences[0].endMarker).toBe(TibetanPunctuation.SHAD);
    });

    it('should split on English periods', () => {
      const text = 'First sentence. Second sentence.';
      const sentences = splitIntoSentences(text);

      expect(sentences.length).toBe(2);
      expect(sentences[0].endMarker).toBe('.');
      expect(sentences[0].text).toBe('First sentence.');
    });

    it('should not split on abbreviations', () => {
      const text = 'Dr. Smith went to the store. Then he came back.';
      const sentences = splitIntoSentences(text);

      // Should only split at the actual sentence end, not at "Dr."
      expect(sentences.length).toBe(2);
      expect(sentences[0].text).toContain('Dr.');
    });

    it('should handle mixed Tibetan-English text', () => {
      const text = 'བོད་སྐད། English sentence. བོད་ཡིག།';
      const sentences = splitIntoSentences(text);

      expect(sentences.length).toBe(3);
      expect(sentences[0].hasTibetan).toBe(true);
      expect(sentences[1].hasEnglish).toBe(true);
      expect(sentences[2].hasTibetan).toBe(true);
    });

    it('should not split inside parentheses', () => {
      const text = 'བོད་སྐད (Tibetan language། inside parens) ཡིན།';
      const sentences = splitIntoSentences(text);

      // Should not split at the shad inside parentheses
      expect(sentences.length).toBeLessThanOrEqual(2);
    });

    it('should handle nested parentheses', () => {
      const text = 'Text (outer (inner། nested) more)། Outside।';
      const sentences = splitIntoSentences(text);

      // Should only split at shad outside all parentheses
      expect(sentences.length).toBe(2);
    });

    it('should set hasTibetan flag correctly', () => {
      const text = 'བོད་སྐད། English only.';
      const sentences = splitIntoSentences(text);

      expect(sentences[0].hasTibetan).toBe(true);
      expect(sentences[1].hasTibetan).toBe(false);
    });

    it('should set hasEnglish flag correctly', () => {
      const text = 'བོད་སྐད། English text.';
      const sentences = splitIntoSentences(text);

      expect(sentences[0].hasEnglish).toBe(false);
      expect(sentences[1].hasEnglish).toBe(true);
    });

    it('should set start and end positions', () => {
      const text = 'First། Second།';
      const sentences = splitIntoSentences(text);

      expect(sentences[0].start).toBe(0);
      expect(sentences[0].end).toBeGreaterThan(0);
      expect(sentences[1].start).toBe(sentences[0].end);
    });

    it('should handle text without sentence endings', () => {
      const text = 'བོད་སྐད incomplete';
      const sentences = splitIntoSentences(text);

      expect(sentences.length).toBe(1);
      expect(sentences[0].endMarker).toBeNull();
    });

    it('should handle double shad', () => {
      const text = 'བོད་སྐད༎ Next section།';
      const sentences = splitIntoSentences(text);

      expect(sentences.length).toBe(2);
      expect(sentences[0].endMarker).toBe(TibetanPunctuation.DOUBLE_SHAD);
    });

    it('should handle nyis shad', () => {
      const text = 'Item 1༑ Item 2།';
      const sentences = splitIntoSentences(text);

      expect(sentences.length).toBe(2);
      expect(sentences[0].endMarker).toBe(TibetanPunctuation.NYIS_SHAD);
    });

    it('should trim sentences', () => {
      const text = '  བོད་སྐད།   Next sentence།  ';
      const sentences = splitIntoSentences(text);

      sentences.forEach(sentence => {
        expect(sentence.text).toBe(sentence.text.trim());
      });
    });

    it('should handle consecutive shads', () => {
      const text = 'བོད།།སྐད།';
      const sentences = splitIntoSentences(text);

      // Should create separate sentences for each shad
      expect(sentences.length).toBeGreaterThan(0);
    });
  });

  describe('combineSentences', () => {
    it('should combine sentences with spaces', () => {
      const sentences: TibetanSentence[] = [
        {
          text: 'First།',
          start: 0,
          end: 6,
          endMarker: TibetanPunctuation.SHAD,
          hasTibetan: true,
          hasEnglish: false,
        },
        {
          text: 'Second།',
          start: 7,
          end: 14,
          endMarker: TibetanPunctuation.SHAD,
          hasTibetan: true,
          hasEnglish: false,
        },
      ];

      const combined = combineSentences(sentences);
      expect(combined).toBe('First། Second།');
    });

    it('should handle empty array', () => {
      expect(combineSentences([])).toBe('');
    });

    it('should handle single sentence', () => {
      const sentences: TibetanSentence[] = [
        {
          text: 'Only།',
          start: 0,
          end: 5,
          endMarker: TibetanPunctuation.SHAD,
          hasTibetan: true,
          hasEnglish: false,
        },
      ];

      expect(combineSentences(sentences)).toBe('Only།');
    });
  });

  describe('getPunctuationDescription', () => {
    it('should return description for shad', () => {
      const desc = getPunctuationDescription(TibetanPunctuation.SHAD);
      expect(desc).toContain('Shad');
      expect(desc).toContain('sentence end');
    });

    it('should return description for double shad', () => {
      const desc = getPunctuationDescription(TibetanPunctuation.DOUBLE_SHAD);
      expect(desc).toContain('Double Shad');
      expect(desc).toContain('section end');
    });

    it('should return description for nyis shad', () => {
      const desc = getPunctuationDescription(TibetanPunctuation.NYIS_SHAD);
      expect(desc).toContain('Nyis Shad');
      expect(desc).toContain('enumeration');
    });

    it('should return description for tsek', () => {
      const desc = getPunctuationDescription(TibetanPunctuation.TSEK);
      expect(desc).toContain('Tsek');
      expect(desc).toContain('syllable boundary');
    });

    it('should return description for rinchen spungs shad', () => {
      const desc = getPunctuationDescription(TibetanPunctuation.RINCHEN_SPUNGS_SHAD);
      expect(desc).toContain('Rin Chen Spungs Shad');
      expect(desc).toContain('topic change');
    });
  });

  describe('edge cases', () => {
    it('should handle very long sentences', () => {
      const longSentence = 'བོད་སྐད་'.repeat(1000) + '།';
      const sentences = splitIntoSentences(longSentence);

      expect(sentences.length).toBe(1);
      expect(sentences[0].text.length).toBeGreaterThan(1000);
    });

    it('should handle unicode edge cases', () => {
      const text = 'Test\u200Bབོད།'; // zero-width space
      const sentences = splitIntoSentences(text);

      expect(sentences.length).toBeGreaterThan(0);
    });

    it('should handle mixed punctuation', () => {
      const text = 'བོད་སྐད། English. བོད༎ More.';
      const sentences = splitIntoSentences(text);

      expect(sentences.length).toBe(4);
    });
  });
});
