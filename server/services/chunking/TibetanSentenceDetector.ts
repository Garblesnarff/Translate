// File: server/services/chunking/TibetanSentenceDetector.ts
// Detect sentence boundaries in Tibetan and mixed text

import type { SentenceBoundary } from './types';

/**
 * TibetanSentenceDetector identifies sentence boundaries in Tibetan text
 *
 * Features:
 * - Detects Tibetan shad (།) and double shad (༎)
 * - Handles English punctuation (. ! ?)
 * - Respects parentheses (doesn't split inside)
 * - Works with mixed Tibetan-English text
 */
export class TibetanSentenceDetector {
  // Sentence-ending punctuation
  private readonly tibetanShad = '།';
  private readonly tibetanDoubleShad = '༎';
  private readonly englishPunctuation = ['.', '!', '?'];

  /**
   * Detect sentence boundaries in text
   *
   * @param text - Text to analyze
   * @returns Array of boundary indices
   */
  detectBoundaries(text: string): number[] {
    if (!text || text.length === 0) {
      return [];
    }

    const boundaries: number[] = [];

    for (let i = 0; i < text.length; i++) {
      const char = text[i];

      if (this.isSentenceBoundary(char, i, text)) {
        boundaries.push(i);
      }
    }

    return boundaries;
  }

  /**
   * Split text into sentences
   *
   * @param text - Text to split
   * @returns Array of sentences
   */
  splitIntoSentences(text: string): string[] {
    if (!text || text.length === 0) {
      return [];
    }

    const boundaries = this.detectBoundaries(text);

    if (boundaries.length === 0) {
      return [text];
    }

    const sentences: string[] = [];
    let lastIndex = 0;

    for (const boundary of boundaries) {
      // Include the boundary character in the sentence
      const sentence = text.substring(lastIndex, boundary + 1).trim();
      if (sentence.length > 0) {
        sentences.push(sentence);
      }
      lastIndex = boundary + 1;
    }

    // Add remaining text
    const remaining = text.substring(lastIndex).trim();
    if (remaining.length > 0) {
      sentences.push(remaining);
    }

    return sentences;
  }

  /**
   * Check if a character at a position is a sentence boundary
   *
   * @param char - Character to check
   * @param index - Position in text
   * @param text - Full text
   * @returns True if this is a sentence boundary
   */
  isSentenceBoundary(char: string, index: number, text: string): boolean {
    // Check if it's a sentence-ending character
    const isSentenceChar =
      char === this.tibetanShad ||
      char === this.tibetanDoubleShad ||
      this.englishPunctuation.includes(char);

    if (!isSentenceChar) {
      return false;
    }

    // Don't split inside parentheses
    if (this.isInsideParentheses(index, text)) {
      return false;
    }

    // Don't split after abbreviations (simple check for English)
    if (char === '.' && this.isAbbreviation(index, text)) {
      return false;
    }

    return true;
  }

  /**
   * Check if position is inside parentheses
   *
   * @param index - Position to check
   * @param text - Full text
   * @returns True if inside parentheses
   */
  private isInsideParentheses(index: number, text: string): boolean {
    let openCount = 0;

    for (let i = 0; i < index; i++) {
      if (text[i] === '(') openCount++;
      if (text[i] === ')') openCount--;
    }

    return openCount > 0;
  }

  /**
   * Check if a period is part of an abbreviation
   *
   * @param index - Period position
   * @param text - Full text
   * @returns True if likely an abbreviation
   */
  private isAbbreviation(index: number, text: string): boolean {
    // Common abbreviations
    const commonAbbrev = ['Dr', 'Mr', 'Mrs', 'Ms', 'Prof', 'Sr', 'Jr', 'etc', 'e.g', 'i.e'];

    // Look back up to 10 characters
    const before = text.substring(Math.max(0, index - 10), index);

    for (const abbrev of commonAbbrev) {
      if (before.endsWith(abbrev)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Get information about a boundary
   *
   * @param index - Boundary index
   * @param text - Full text
   * @returns Boundary information
   */
  getBoundaryInfo(index: number, text: string): SentenceBoundary {
    const char = text[index];
    let type: SentenceBoundary['type'];

    if (char === this.tibetanShad) {
      type = 'tibetan-shad';
    } else if (char === this.tibetanDoubleShad) {
      type = 'tibetan-double-shad';
    } else if (char === '.') {
      type = 'period';
    } else {
      type = 'other';
    }

    return { index, char, type };
  }
}
