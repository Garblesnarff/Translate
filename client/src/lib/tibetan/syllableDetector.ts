// client/src/lib/tibetan/syllableDetector.ts

/**
 * Tibetan syllable boundary detection utilities
 *
 * Tibetan text uses specific Unicode characters to mark syllable and word boundaries:
 * - Tsek (་ U+0F0B): Syllable separator, marks boundaries between syllables
 * - Shad (། U+0F0D): Sentence end marker
 * - Double Shad (༎ U+0F0E): Section/paragraph end marker
 * - Space (U+0020): Word boundary (but often inconsistently used in PDFs)
 */

/**
 * Tibetan Unicode ranges
 */
export const TIBETAN_UNICODE_RANGES = {
  main: { start: 0x0F00, end: 0x0FFF },           // Main Tibetan block
  extensions: { start: 0x1000, end: 0x109F },    // Tibetan extensions (rare)
};

/**
 * Special Tibetan punctuation characters
 */
export const TIBETAN_PUNCTUATION = {
  TSEK: '\u0F0B',           // ་ syllable separator
  SHAD: '\u0F0D',           // । sentence end
  DOUBLE_SHAD: '\u0F0E',    // ༎ section end
  NYIS_SHAD: '\u0F11',      // ༑ enumeration marker
  SPACE_TSEK: '\u0F0C',     // ༌ non-breaking tsek
};

/**
 * Check if a character is a Tibetan character
 */
export function isTibetanCharacter(char: string): boolean {
  if (!char || char.length === 0) return false;
  const code = char.charCodeAt(0);
  return (
    (code >= TIBETAN_UNICODE_RANGES.main.start && code <= TIBETAN_UNICODE_RANGES.main.end) ||
    (code >= TIBETAN_UNICODE_RANGES.extensions.start && code <= TIBETAN_UNICODE_RANGES.extensions.end)
  );
}

/**
 * Check if a character is a Tibetan tsek (syllable boundary marker)
 */
export function isTsek(char: string): boolean {
  return char === TIBETAN_PUNCTUATION.TSEK || char === TIBETAN_PUNCTUATION.SPACE_TSEK;
}

/**
 * Check if a character is a Tibetan sentence-ending punctuation
 */
export function isSentenceEnd(char: string): boolean {
  return (
    char === TIBETAN_PUNCTUATION.SHAD ||
    char === TIBETAN_PUNCTUATION.DOUBLE_SHAD ||
    char === TIBETAN_PUNCTUATION.NYIS_SHAD
  );
}

/**
 * Detect if a text segment contains Tibetan content
 * Returns true if at least minPercentage of characters are Tibetan
 */
export function containsTibetan(text: string, minPercentage: number = 0.3): boolean {
  if (!text || text.length === 0) return false;

  let tibetanCharCount = 0;
  let totalCharCount = 0;

  for (const char of text) {
    // Skip whitespace in the count
    if (char.trim().length > 0) {
      totalCharCount++;
      if (isTibetanCharacter(char)) {
        tibetanCharCount++;
      }
    }
  }

  if (totalCharCount === 0) return false;
  return (tibetanCharCount / totalCharCount) >= minPercentage;
}

/**
 * Calculate the percentage of Tibetan characters in text
 */
export function getTibetanPercentage(text: string): number {
  if (!text || text.length === 0) return 0;

  let tibetanCharCount = 0;
  let totalCharCount = 0;

  for (const char of text) {
    if (char.trim().length > 0) {
      totalCharCount++;
      if (isTibetanCharacter(char)) {
        tibetanCharCount++;
      }
    }
  }

  return totalCharCount === 0 ? 0 : tibetanCharCount / totalCharCount;
}

/**
 * Detect syllable boundaries in Tibetan text
 * Returns array of syllable positions
 */
export function detectSyllableBoundaries(text: string): number[] {
  const boundaries: number[] = [0]; // Start is always a boundary

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    // Tsek marks syllable boundaries
    if (isTsek(char)) {
      // The boundary is after the tsek
      boundaries.push(i + 1);
    }
    // Sentence endings also mark boundaries
    else if (isSentenceEnd(char)) {
      boundaries.push(i + 1);
    }
    // Spaces after Tibetan characters mark word boundaries
    else if (char === ' ' && i > 0 && isTibetanCharacter(text[i - 1])) {
      boundaries.push(i);
    }
  }

  // End is always a boundary
  if (boundaries[boundaries.length - 1] !== text.length) {
    boundaries.push(text.length);
  }

  return boundaries;
}

/**
 * Detect if spacing in text appears to be artificial (PDF extraction artifact)
 * vs. intentional (proper word boundaries)
 */
export function isArtificialSpacing(text: string, position: number): boolean {
  if (position <= 0 || position >= text.length) return false;

  const before = text[position - 1];
  const after = text[position];
  const char = text[position];

  // If it's not a space, it's not spacing
  if (char !== ' ') return false;

  // If there's a tsek before or after, the space is likely artificial
  if (isTsek(before) || isTsek(after)) {
    return true;
  }

  // If we have multiple consecutive spaces, likely artificial
  if (text[position + 1] === ' ') {
    return true;
  }

  // If space is between two Tibetan characters with no tsek, it might be proper
  if (isTibetanCharacter(before) && isTibetanCharacter(after)) {
    // Check if there's a tsek nearby (within 1-2 characters)
    const nearbyHasTsek = (
      (position > 1 && isTsek(text[position - 2])) ||
      (position < text.length - 1 && isTsek(text[position + 1]))
    );
    return nearbyHasTsek;
  }

  return false;
}

/**
 * Check if a word boundary at a position is proper (not an artifact)
 */
export function isProperBoundary(text: string, position: number): boolean {
  if (position <= 0 || position >= text.length) return true;

  const before = text[position - 1];
  const after = text[position];

  // Tsek is always a proper boundary
  if (isTsek(before)) return true;

  // Sentence endings are proper boundaries
  if (isSentenceEnd(before)) return true;

  // Space between Tibetan and non-Tibetan is proper
  if (isTibetanCharacter(before) && !isTibetanCharacter(after)) return true;
  if (!isTibetanCharacter(before) && isTibetanCharacter(after)) return true;

  // Check if this is artificial spacing
  if (text[position] === ' ') {
    return !isArtificialSpacing(text, position);
  }

  return true;
}

/**
 * Split Tibetan text into syllables
 */
export function splitIntoSyllables(text: string): string[] {
  const boundaries = detectSyllableBoundaries(text);
  const syllables: string[] = [];

  for (let i = 0; i < boundaries.length - 1; i++) {
    const start = boundaries[i];
    const end = boundaries[i + 1];
    const syllable = text.substring(start, end).trim();
    if (syllable.length > 0) {
      syllables.push(syllable);
    }
  }

  return syllables;
}

/**
 * Validate that text has proper Tibetan syllable structure
 */
export interface SyllableValidation {
  isValid: boolean;
  issues: string[];
  hasTseks: boolean;
  hasProperSpacing: boolean;
  syllableCount: number;
}

export function validateSyllableStructure(text: string): SyllableValidation {
  const issues: string[] = [];
  const syllables = splitIntoSyllables(text);

  const hasTseks = text.includes(TIBETAN_PUNCTUATION.TSEK);
  const hasSpaces = text.includes(' ');

  // Check for common issues
  if (!hasTseks && !hasSpaces && containsTibetan(text, 0.5)) {
    issues.push('Text appears to be Tibetan but has no syllable separators (tsek or spaces)');
  }

  // Check for artificial spacing patterns
  let artificialSpaceCount = 0;
  for (let i = 0; i < text.length; i++) {
    if (isArtificialSpacing(text, i)) {
      artificialSpaceCount++;
    }
  }

  const hasProperSpacing = artificialSpaceCount < text.length * 0.1;
  if (!hasProperSpacing) {
    issues.push(`High number of artificial spaces detected (${artificialSpaceCount})`);
  }

  // Check for missing tseks (consecutive Tibetan chars without separator)
  let consecutiveTibetan = 0;
  for (const char of text) {
    if (isTibetanCharacter(char) && !isTsek(char) && !isSentenceEnd(char)) {
      consecutiveTibetan++;
      if (consecutiveTibetan > 10) {
        issues.push('Long sequences of Tibetan characters without syllable separators');
        break;
      }
    } else {
      consecutiveTibetan = 0;
    }
  }

  return {
    isValid: issues.length === 0,
    issues,
    hasTseks,
    hasProperSpacing,
    syllableCount: syllables.length,
  };
}
