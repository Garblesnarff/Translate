// File: server/services/extraction/ArtifactRemover.ts
// Remove common PDF artifacts like headers, footers, and page numbers

import type { ArtifactPattern } from './types';

/**
 * ArtifactRemover detects and removes common PDF artifacts
 *
 * Removes:
 * - Repeating headers and footers
 * - Page numbers
 * - Watermarks
 * - Copyright notices
 */
export class ArtifactRemover {
  private minOccurrencesForPattern = 3;

  /**
   * Remove artifacts from extracted text
   *
   * @param text - Extracted text
   * @returns Cleaned text
   */
  removeArtifacts(text: string): string {
    if (!text || text.trim().length === 0) {
      return '';
    }

    // Detect repeating patterns
    const patterns = this.detectPatterns(text);

    // Remove detected artifacts
    let cleaned = text;

    for (const pattern of patterns) {
      if (pattern.confidence > 0.7) {
        // Remove this pattern
        cleaned = this.removePattern(cleaned, pattern.text);
      }
    }

    // Remove standalone page numbers
    cleaned = this.removePageNumbers(cleaned);

    // Clean up excessive whitespace
    cleaned = this.normalizeWhitespace(cleaned);

    return cleaned;
  }

  /**
   * Detect repeating patterns in text
   *
   * @param text - Text to analyze
   * @returns Detected artifact patterns
   */
  detectPatterns(text: string): ArtifactPattern[] {
    const patterns: ArtifactPattern[] = [];
    const lines = text.split('\n');

    // Track line occurrences
    const lineOccurrences = new Map<string, number>();

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.length === 0) continue;
      if (trimmed.length > 100) continue; // Too long to be header/footer

      const count = lineOccurrences.get(trimmed) || 0;
      lineOccurrences.set(trimmed, count + 1);
    }

    // Find patterns that repeat
    for (const [line, count] of lineOccurrences.entries()) {
      if (count >= this.minOccurrencesForPattern) {
        const type = this.classifyPattern(line);
        const confidence = this.calculateConfidence(line, count, lines.length);

        patterns.push({
          text: line,
          occurrences: count,
          type,
          confidence,
        });
      }
    }

    return patterns.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Classify pattern type
   *
   * @param pattern - Pattern text
   * @returns Pattern type
   */
  private classifyPattern(pattern: string): ArtifactPattern['type'] {
    const trimmed = pattern.trim();

    // Page number pattern
    if (/^(\d+|page \d+|\d+ of \d+)$/i.test(trimmed)) {
      return 'page-number';
    }

    // Copyright pattern
    if (/copyright|©|all rights reserved/i.test(trimmed)) {
      return 'footer';
    }

    // Watermark pattern
    if (/draft|confidential|proprietary/i.test(trimmed)) {
      return 'watermark';
    }

    // Header pattern (often short, repeated)
    if (trimmed.length < 50) {
      return 'header';
    }

    return 'unknown';
  }

  /**
   * Calculate confidence that this is an artifact
   *
   * @param pattern - Pattern text
   * @param occurrences - Number of occurrences
   * @param totalLines - Total lines in document
   * @returns Confidence (0-1)
   */
  private calculateConfidence(
    pattern: string,
    occurrences: number,
    totalLines: number
  ): number {
    let confidence = 0;
    const trimmed = pattern.trim();

    // More occurrences = higher confidence
    const occurrenceRatio = occurrences / totalLines;
    confidence += Math.min(occurrenceRatio * 10, 0.5);

    // Short text = more likely artifact
    if (trimmed.length < 30) {
      confidence += 0.2;
    }

    // Contains common artifact keywords
    if (/page|copyright|draft|header|footer/i.test(trimmed)) {
      confidence += 0.3;
    }

    // Numeric-only = likely page number
    if (/^\d+$/.test(trimmed)) {
      confidence += 0.4;
    }

    // Watermark patterns get high confidence
    if (/DRAFT|CONFIDENTIAL|PROPRIETARY/i.test(trimmed)) {
      confidence += 0.4;
    }

    // Copyright and page info patterns
    if (/copyright|©|\d+ of \d+/i.test(trimmed)) {
      confidence += 0.4;
    }

    return Math.min(confidence, 1.0);
  }

  /**
   * Remove a pattern from text
   *
   * @param text - Text to clean
   * @param pattern - Pattern to remove
   * @returns Cleaned text
   */
  private removePattern(text: string, pattern: string): string {
    // Escape special regex characters
    const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    // Remove pattern (case insensitive, whole line)
    const regex = new RegExp(`^\\s*${escaped}\\s*$`, 'gmi');
    return text.replace(regex, '');
  }

  /**
   * Remove standalone page numbers
   *
   * @param text - Text to clean
   * @returns Cleaned text
   */
  private removePageNumbers(text: string): string {
    // Remove lines that are just numbers
    let cleaned = text.replace(/^\s*\d+\s*$/gm, '');

    // Remove "Page X" patterns
    cleaned = cleaned.replace(/^\s*page\s+\d+\s*$/gim, '');

    // Remove "X of Y" patterns
    cleaned = cleaned.replace(/^\s*\d+\s+of\s+\d+\s*$/gim, '');

    return cleaned;
  }

  /**
   * Normalize whitespace
   *
   * @param text - Text to normalize
   * @returns Normalized text
   */
  private normalizeWhitespace(text: string): string {
    // Remove excessive blank lines (more than 2)
    let normalized = text.replace(/\n{3,}/g, '\n\n');

    // Remove trailing whitespace from lines
    normalized = normalized
      .split('\n')
      .map(line => line.trimEnd())
      .join('\n');

    // Trim overall
    normalized = normalized.trim();

    return normalized;
  }
}
