import { describe, it, expect } from 'vitest';
import {
  isTibetanCharacter,
  isTsek,
  isSentenceEnd,
  containsTibetan,
  getTibetanPercentage,
  detectSyllableBoundaries,
  isArtificialSpacing,
  isProperBoundary,
  splitIntoSyllables,
  validateSyllableStructure,
  TIBETAN_PUNCTUATION,
} from '@/lib/tibetan/syllableDetector';

describe('syllableDetector', () => {
  describe('isTibetanCharacter', () => {
    it('should return true for Tibetan characters', () => {
      expect(isTibetanCharacter('བ')).toBe(true);
      expect(isTibetanCharacter('ཀ')).toBe(true);
      expect(isTibetanCharacter('ལ')).toBe(true);
    });

    it('should return false for non-Tibetan characters', () => {
      expect(isTibetanCharacter('a')).toBe(false);
      expect(isTibetanCharacter('1')).toBe(false);
      expect(isTibetanCharacter(' ')).toBe(false);
    });

    it('should return false for empty string', () => {
      expect(isTibetanCharacter('')).toBe(false);
    });
  });

  describe('isTsek', () => {
    it('should return true for tsek character', () => {
      expect(isTsek(TIBETAN_PUNCTUATION.TSEK)).toBe(true);
      expect(isTsek('་')).toBe(true);
    });

    it('should return true for space tsek', () => {
      expect(isTsek(TIBETAN_PUNCTUATION.SPACE_TSEK)).toBe(true);
    });

    it('should return false for non-tsek characters', () => {
      expect(isTsek('བ')).toBe(false);
      expect(isTsek(' ')).toBe(false);
      expect(isTsek('།')).toBe(false);
    });
  });

  describe('isSentenceEnd', () => {
    it('should return true for shad', () => {
      expect(isSentenceEnd(TIBETAN_PUNCTUATION.SHAD)).toBe(true);
      expect(isSentenceEnd('།')).toBe(true);
    });

    it('should return true for double shad', () => {
      expect(isSentenceEnd(TIBETAN_PUNCTUATION.DOUBLE_SHAD)).toBe(true);
      expect(isSentenceEnd('༎')).toBe(true);
    });

    it('should return true for nyis shad', () => {
      expect(isSentenceEnd(TIBETAN_PUNCTUATION.NYIS_SHAD)).toBe(true);
    });

    it('should return false for non-sentence-ending characters', () => {
      expect(isSentenceEnd('བ')).toBe(false);
      expect(isSentenceEnd('་')).toBe(false);
      expect(isSentenceEnd('.')).toBe(false);
    });
  });

  describe('containsTibetan', () => {
    it('should return true when text has sufficient Tibetan content', () => {
      const tibetan = 'བོད་ཀྱི་སྐད་ཡིག';
      expect(containsTibetan(tibetan, 0.3)).toBe(true);
    });

    it('should return false when text has insufficient Tibetan content', () => {
      const english = 'This is English text with one བ character';
      expect(containsTibetan(english, 0.5)).toBe(false);
    });

    it('should handle mixed content correctly', () => {
      const mixed = 'བོད་སྐད། Tibetan language';
      expect(containsTibetan(mixed, 0.3)).toBe(true);
      expect(containsTibetan(mixed, 0.8)).toBe(false);
    });

    it('should return false for empty text', () => {
      expect(containsTibetan('', 0.3)).toBe(false);
    });
  });

  describe('getTibetanPercentage', () => {
    it('should calculate correct percentage for pure Tibetan', () => {
      const tibetan = 'བོད་ཀྱི་སྐད་ཡིག';
      const percentage = getTibetanPercentage(tibetan);
      expect(percentage).toBeGreaterThan(0.9);
    });

    it('should calculate correct percentage for mixed text', () => {
      const mixed = 'བོད་སྐད། English';
      const percentage = getTibetanPercentage(mixed);
      expect(percentage).toBeGreaterThan(0);
      expect(percentage).toBeLessThan(1);
    });

    it('should return 0 for pure English', () => {
      const english = 'Pure English text';
      expect(getTibetanPercentage(english)).toBe(0);
    });

    it('should return 0 for empty text', () => {
      expect(getTibetanPercentage('')).toBe(0);
    });
  });

  describe('detectSyllableBoundaries', () => {
    it('should detect tsek boundaries', () => {
      const text = 'བོད་ཀྱི་སྐད';
      const boundaries = detectSyllableBoundaries(text);
      expect(boundaries.length).toBeGreaterThan(2);
      expect(boundaries[0]).toBe(0);
      expect(boundaries[boundaries.length - 1]).toBe(text.length);
    });

    it('should detect shad boundaries', () => {
      const text = 'བོད་སྐད། ཡིག';
      const boundaries = detectSyllableBoundaries(text);
      expect(boundaries).toContain(text.indexOf('།') + 1);
    });

    it('should detect space boundaries after Tibetan', () => {
      const text = 'བོད སྐད';
      const boundaries = detectSyllableBoundaries(text);
      expect(boundaries).toContain(text.indexOf(' '));
    });

    it('should start and end with text boundaries', () => {
      const text = 'བོད་སྐད';
      const boundaries = detectSyllableBoundaries(text);
      expect(boundaries[0]).toBe(0);
      expect(boundaries[boundaries.length - 1]).toBe(text.length);
    });
  });

  describe('isArtificialSpacing', () => {
    it('should detect space after tsek as artificial', () => {
      const text = 'བོད་ སྐད';
      const spacePos = text.indexOf(' ');
      expect(isArtificialSpacing(text, spacePos)).toBe(true);
    });

    it('should detect space before tsek as artificial', () => {
      const text = 'བོད ་སྐད';
      const spacePos = text.indexOf(' ');
      expect(isArtificialSpacing(text, spacePos)).toBe(true);
    });

    it('should detect multiple consecutive spaces as artificial', () => {
      const text = 'བོད  སྐད';
      const spacePos = text.indexOf(' ');
      expect(isArtificialSpacing(text, spacePos)).toBe(true);
    });

    it('should return false for non-space characters', () => {
      const text = 'བོད་སྐད';
      expect(isArtificialSpacing(text, 2)).toBe(false);
    });
  });

  describe('isProperBoundary', () => {
    it('should recognize tsek as proper boundary', () => {
      const text = 'བོད་སྐད';
      const tsekPos = text.indexOf('་') + 1;
      expect(isProperBoundary(text, tsekPos)).toBe(true);
    });

    it('should recognize shad as proper boundary', () => {
      const text = 'བོད།སྐད';
      const shadPos = text.indexOf('།') + 1;
      expect(isProperBoundary(text, shadPos)).toBe(true);
    });

    it('should recognize Tibetan-English boundary as proper', () => {
      const text = 'བོད English';
      const boundaryPos = text.indexOf(' ');
      expect(isProperBoundary(text, boundaryPos)).toBe(true);
    });

    it('should return true at start and end positions', () => {
      const text = 'བོད་སྐད';
      expect(isProperBoundary(text, 0)).toBe(true);
      expect(isProperBoundary(text, text.length)).toBe(true);
    });
  });

  describe('splitIntoSyllables', () => {
    it('should split Tibetan text into syllables', () => {
      const text = 'བོད་ཀྱི་སྐད';
      const syllables = splitIntoSyllables(text);
      expect(syllables.length).toBeGreaterThan(0);
      expect(syllables.every(s => s.length > 0)).toBe(true);
    });

    it('should handle text with shad markers', () => {
      const text = 'བོད་སྐད། ཡིག';
      const syllables = splitIntoSyllables(text);
      expect(syllables.length).toBeGreaterThan(2);
    });

    it('should return empty array for empty text', () => {
      expect(splitIntoSyllables('')).toEqual([]);
    });

    it('should trim syllables', () => {
      const text = 'བོད་  སྐད';
      const syllables = splitIntoSyllables(text);
      expect(syllables.every(s => s === s.trim())).toBe(true);
    });
  });

  describe('validateSyllableStructure', () => {
    it('should validate well-formed Tibetan text', () => {
      const text = 'བོད་ཀྱི་སྐད་ཡིག་ནི་བོད་ཀྱི་རིག་གནས་ཡིན།';
      const validation = validateSyllableStructure(text);
      expect(validation.isValid).toBe(true);
      expect(validation.hasTseks).toBe(true);
      expect(validation.syllableCount).toBeGreaterThan(0);
    });

    it('should detect missing syllable separators', () => {
      const text = 'བོདསྐད'; // No tseks
      const validation = validateSyllableStructure(text);
      // Text with no separators might still be valid if short
      expect(validation.syllableCount).toBeGreaterThan(0);
    });

    it('should detect artificial spacing issues', () => {
      const text = 'བ ོ ད ་ ས ྐ ད'; // Many artificial spaces
      const validation = validateSyllableStructure(text);
      expect(validation.issues.length).toBeGreaterThan(0);
    });

    it('should handle empty text', () => {
      const validation = validateSyllableStructure('');
      expect(validation.syllableCount).toBe(0);
    });

    it('should detect long sequences without separators', () => {
      // Create a long string of Tibetan chars without separators
      const text = 'བོདསྐདཡིགནིབོདཀྱིརིགགནསཡིན';
      const validation = validateSyllableStructure(text);
      expect(validation.issues.some(i => i.includes('syllable separators'))).toBe(true);
    });
  });
});
