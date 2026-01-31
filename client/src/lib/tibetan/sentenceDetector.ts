/**
 * Tibetan Sentence Boundary Detection
 *
 * Handles Tibetan-specific punctuation and sentence boundaries,
 * including mixed Tibetan-English text.
 */

/**
 * Tibetan punctuation marks and their meanings
 */
export enum TibetanPunctuation {
  /** Shad (།) - basic sentence end, clause separator */
  SHAD = '།',

  /** Double Shad (༎) - section end, major break */
  DOUBLE_SHAD = '༎',

  /** Nyis Shad (༑) - enumeration marker, list separator */
  NYIS_SHAD = '༑',

  /** Tsek (་) - syllable boundary (not sentence end) */
  TSEK = '་',

  /** Rin Chen Spungs Shad (༔) - topic change marker */
  RINCHEN_SPUNGS_SHAD = '༔',
}

/**
 * Interface for a detected Tibetan sentence
 */
export interface TibetanSentence {
  /** The sentence text including punctuation */
  text: string;

  /** Starting position in original text */
  start: number;

  /** Ending position in original text */
  end: number;

  /** The punctuation mark that ended this sentence */
  endMarker: TibetanPunctuation | '.' | null;

  /** Whether this sentence contains Tibetan text */
  hasTibetan: boolean;

  /** Whether this sentence contains English text */
  hasEnglish: boolean;
}

/**
 * Check if a character is Tibetan
 */
export function isTibetanChar(char: string): boolean {
  const code = char.charCodeAt(0);
  // Tibetan Unicode range: U+0F00 to U+0FFF
  return code >= 0x0F00 && code <= 0x0FFF;
}

/**
 * Check if a character is a Tibetan sentence-ending punctuation
 */
export function isTibetanSentenceEnd(char: string): boolean {
  return char === TibetanPunctuation.SHAD ||
         char === TibetanPunctuation.DOUBLE_SHAD ||
         char === TibetanPunctuation.NYIS_SHAD ||
         char === TibetanPunctuation.RINCHEN_SPUNGS_SHAD;
}

/**
 * Check if text contains Tibetan characters
 */
export function containsTibetan(text: string): boolean {
  return Array.from(text).some(isTibetanChar);
}

/**
 * Check if text contains English/Latin characters
 */
export function containsEnglish(text: string): boolean {
  return /[a-zA-Z]/.test(text);
}

/**
 * Common English abbreviations that shouldn't trigger sentence breaks
 */
const ENGLISH_ABBREVIATIONS = [
  'Dr.', 'Mr.', 'Mrs.', 'Ms.', 'Prof.', 'Sr.', 'Jr.',
  'etc.', 'et al.', 'i.e.', 'e.g.', 'vs.', 'vol.',
  'p.', 'pp.', 'no.', 'nos.', 'fig.', 'figs.',
];

/**
 * Check if a period is part of an abbreviation
 */
function isAbbreviation(text: string, periodIndex: number): boolean {
  // Get context around the period (previous 10 chars)
  const start = Math.max(0, periodIndex - 10);
  const context = text.substring(start, periodIndex + 1);

  return ENGLISH_ABBREVIATIONS.some(abbrev => context.endsWith(abbrev));
}

/**
 * Split Tibetan text into sentences respecting Tibetan punctuation
 * and handling mixed Tibetan-English text properly.
 *
 * @param text The text to split into sentences
 * @returns Array of detected sentences with metadata
 */
export function splitIntoSentences(text: string): TibetanSentence[] {
  if (!text || !text.trim()) {
    return [];
  }

  const sentences: TibetanSentence[] = [];
  let currentStart = 0;
  let currentText = '';
  let parenDepth = 0; // Track parenthesis nesting

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    currentText += char;

    // Track parentheses to avoid splitting inside them
    if (char === '(') {
      parenDepth++;
      continue;
    }
    if (char === ')') {
      parenDepth--;
      continue;
    }

    // Don't split inside parentheses
    if (parenDepth > 0) {
      continue;
    }

    let endMarker: TibetanPunctuation | '.' | null = null;
    let shouldSplit = false;

    // Check for Tibetan sentence endings
    if (isTibetanSentenceEnd(char)) {
      endMarker = char as TibetanPunctuation;
      shouldSplit = true;
    }
    // Check for English period (but not in abbreviations)
    else if (char === '.' && !isAbbreviation(text, i)) {
      // Look ahead to see if next char is whitespace or end of string
      const nextChar = i + 1 < text.length ? text[i + 1] : '';
      if (!nextChar || /\s/.test(nextChar) || isTibetanChar(nextChar)) {
        endMarker = '.';
        shouldSplit = true;
      }
    }

    if (shouldSplit) {
      // Trim the sentence but preserve the ending punctuation
      const sentenceText = currentText.trim();

      if (sentenceText) {
        const hasTibetan = containsTibetan(sentenceText);
        const hasEnglish = containsEnglish(sentenceText);

        sentences.push({
          text: sentenceText,
          start: currentStart,
          end: i + 1,
          endMarker,
          hasTibetan,
          hasEnglish,
        });

        // Move to next sentence
        currentStart = i + 1;
        currentText = '';
      }
    }
  }

  // Handle any remaining text
  const remainingText = currentText.trim();
  if (remainingText) {
    const hasTibetan = containsTibetan(remainingText);
    const hasEnglish = containsEnglish(remainingText);

    sentences.push({
      text: remainingText,
      start: currentStart,
      end: text.length,
      endMarker: null,
      hasTibetan,
      hasEnglish,
    });
  }

  return sentences;
}

/**
 * Get a readable description of a Tibetan punctuation mark
 */
export function getPunctuationDescription(mark: TibetanPunctuation): string {
  switch (mark) {
    case TibetanPunctuation.SHAD:
      return 'Shad (།) - sentence end / clause separator';
    case TibetanPunctuation.DOUBLE_SHAD:
      return 'Double Shad (༎) - section end / major break';
    case TibetanPunctuation.NYIS_SHAD:
      return 'Nyis Shad (༑) - enumeration marker / list separator';
    case TibetanPunctuation.TSEK:
      return 'Tsek (་) - syllable boundary';
    case TibetanPunctuation.RINCHEN_SPUNGS_SHAD:
      return 'Rin Chen Spungs Shad (༔) - topic change marker';
    default:
      return 'Unknown Tibetan punctuation';
  }
}

/**
 * Combine sentences back into text
 */
export function combineSentences(sentences: TibetanSentence[]): string {
  return sentences.map(s => s.text).join(' ');
}
