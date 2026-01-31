// File: server/services/unicode/UnicodeValidator.ts
// Validate and normalize Unicode text, especially Tibetan

import type { ValidationResult } from './types';

/**
 * UnicodeValidator handles Unicode normalization and validation
 *
 * Features:
 * - Normalizes to NFC form
 * - Detects Unicode corruption
 * - Validates Tibetan character percentage
 * - Warns on low Tibetan content
 */
export class UnicodeValidator {
  // Tibetan Unicode range
  private readonly tibetanRange = /[\u0F00-\u0FFF]/g;

  // Minimum Tibetan percentage for valid text
  private readonly minTibetanPercentage = 50;

  // Warning threshold for Tibetan percentage
  private readonly warnTibetanPercentage = 70;

  /**
   * Validate and normalize text
   *
   * @param text - Text to validate
   * @returns Validation result
   */
  validate(text: string): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check for empty text
    if (!text || text.trim().length === 0) {
      errors.push('Text is empty or contains only whitespace');
      return {
        isValid: false,
        errors,
        warnings,
        normalized: '',
        tibetanPercentage: 0,
      };
    }

    // Normalize to NFC
    const normalized = this.normalizeUnicode(text);

    // Calculate Tibetan percentage
    const tibetanPercentage = this.calculateTibetanPercentage(normalized);

    // Validate Tibetan percentage
    if (tibetanPercentage < this.minTibetanPercentage) {
      errors.push(
        `Text must contain at least ${this.minTibetanPercentage}% Tibetan characters (found ${tibetanPercentage.toFixed(1)}%)`
      );
    } else if (tibetanPercentage < this.warnTibetanPercentage) {
      warnings.push(
        `Text contains less than ${this.warnTibetanPercentage}% Tibetan characters (${tibetanPercentage.toFixed(1)}%)`
      );
    }

    // Detect corruption
    const hasCorruption = this.detectCorruption(normalized);
    if (hasCorruption) {
      errors.push('Unicode corruption detected (replacement characters or invalid sequences)');
    }

    // Check for control characters
    if (this.hasControlCharacters(normalized)) {
      warnings.push('Text contains control characters');
    }

    // Check for zero-width characters
    if (this.hasZeroWidthCharacters(normalized)) {
      warnings.push('Text contains zero-width characters');
    }

    const isValid = errors.length === 0;

    return {
      isValid,
      errors,
      warnings,
      normalized,
      tibetanPercentage,
      hasCorruption,
    };
  }

  /**
   * Calculate percentage of Tibetan characters
   *
   * @param text - Text to analyze
   * @returns Percentage (0-100)
   */
  calculateTibetanPercentage(text: string): number {
    if (!text || text.length === 0) {
      return 0;
    }

    const tibetanChars = text.match(this.tibetanRange);
    const tibetanCount = tibetanChars ? tibetanChars.length : 0;

    return (tibetanCount / text.length) * 100;
  }

  /**
   * Detect Unicode corruption
   *
   * @param text - Text to check
   * @returns True if corruption detected
   */
  detectCorruption(text: string): boolean {
    // Check for replacement character �
    if (text.includes('\uFFFD')) {
      return true;
    }

    // Check for common mojibake patterns (double-encoded UTF-8)
    // Characters in Latin-1 Supplement range that look like mojibake
    const mojibakePattern = /[\xC0-\xFF]{2,}/;
    if (mojibakePattern.test(text)) {
      return true;
    }

    // Check for null bytes or other problematic characters
    if (text.includes('\x00')) {
      return true;
    }

    return false;
  }

  /**
   * Normalize Unicode to NFC form
   *
   * @param text - Text to normalize
   * @returns Normalized text
   */
  normalizeUnicode(text: string): string {
    return text.normalize('NFC');
  }

  /**
   * Check for control characters
   *
   * @param text - Text to check
   * @returns True if control characters found
   */
  private hasControlCharacters(text: string): boolean {
    // Check for control characters (0x00-0x1F, excluding common ones like \n, \t)
    const controlPattern = /[\x00-\x08\x0B\x0C\x0E-\x1F]/;
    return controlPattern.test(text);
  }

  /**
   * Check for zero-width characters
   *
   * @param text - Text to check
   * @returns True if zero-width characters found
   */
  private hasZeroWidthCharacters(text: string): boolean {
    const zeroWidthChars = [
      '\u200B', // Zero-width space
      '\u200C', // Zero-width non-joiner
      '\u200D', // Zero-width joiner
      '\uFEFF', // Zero-width no-break space
    ];

    return zeroWidthChars.some(char => text.includes(char));
  }

  /**
   * Get validation summary as string
   *
   * @param result - Validation result
   * @returns Human-readable summary
   */
  getValidationSummary(result: ValidationResult): string {
    const parts: string[] = [];

    if (result.isValid) {
      parts.push(`Valid text with ${result.tibetanPercentage.toFixed(1)}% Tibetan characters`);
    } else {
      parts.push('Invalid text:');
      if (result.errors.length > 0) {
        parts.push(`Errors: ${result.errors.join(', ')}`);
      }
    }

    if (result.warnings.length > 0) {
      parts.push(`Warnings: ${result.warnings.join(', ')}`);
    }

    return parts.join(' ');
  }

  /**
   * Check if text needs normalization
   *
   * @param text - Text to check
   * @returns True if normalization needed
   */
  needsNormalization(text: string): boolean {
    return text !== text.normalize('NFC');
  }

  /**
   * Get detailed character analysis
   *
   * @param text - Text to analyze
   * @returns Character breakdown
   */
  analyzeCharacters(text: string): {
    total: number;
    tibetan: number;
    english: number;
    punctuation: number;
    whitespace: number;
    other: number;
  } {
    let tibetan = 0;
    let english = 0;
    let punctuation = 0;
    let whitespace = 0;
    let other = 0;

    for (const char of text) {
      const code = char.charCodeAt(0);

      if (code >= 0x0f00 && code <= 0x0fff) {
        tibetan++;
      } else if (/[a-zA-Z]/.test(char)) {
        english++;
      } else if (/[.,!?;:।༎]/.test(char)) {
        punctuation++;
      } else if (/\s/.test(char)) {
        whitespace++;
      } else {
        other++;
      }
    }

    return {
      total: text.length,
      tibetan,
      english,
      punctuation,
      whitespace,
      other,
    };
  }
}
