/**
 * PreservationValidator
 *
 * Validates that Tibetan text is preserved in translation output
 *
 * @module PreservationValidator
 */

import { Validator, ValidationResult, OutputValidationData } from '../types';

/**
 * Calculate percentage of Tibetan characters preserved
 */
function calculatePreservation(original: string, preserved: string): number {
  const origChars = original.match(/[\u0F00-\u0FFF]/g) || [];
  const presChars = preserved.match(/[\u0F00-\u0FFF]/g) || [];

  if (origChars.length === 0) return 100; // Nothing to preserve

  // Calculate based on character count
  return (presChars.length / origChars.length) * 100;
}

/**
 * Extract Tibetan from parentheses in translation
 */
function extractTibetanFromParens(text: string): string {
  const matches = text.matchAll(/\(([^\)]*[\u0F00-\u0FFF][^\)]*)\)/g);
  return Array.from(matches, m => m[1]).join('');
}

/**
 * Validator for Tibetan text preservation
 */
export class PreservationValidator implements Validator {
  public readonly name = 'PreservationValidator';
  public readonly stage = 'output' as const;

  private readonly MIN_PRESERVATION = 80; // Error threshold
  private readonly WARN_PRESERVATION = 95; // Warning threshold

  /**
   * Validate Tibetan text preservation
   *
   * @param data - Output validation data
   * @returns Validation result
   */
  public validate(data: OutputValidationData | any): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Extract fields
    const translation = typeof data === 'string' ? data : data?.translation;
    const original = typeof data === 'object' ? data?.original : '';

    if (!translation || typeof translation !== 'string') {
      return {
        isValid: false,
        errors: ['Translation text is missing or invalid'],
        warnings: [],
      };
    }

    if (!original || typeof original !== 'string') {
      // Can't validate preservation without original
      return {
        isValid: true,
        errors: [],
        warnings: ['No original text provided for preservation validation'],
      };
    }

    // Extract Tibetan from parentheses in translation
    const preservedTibetan = extractTibetanFromParens(translation);

    // Calculate preservation percentage
    const preservationPercentage = calculatePreservation(original, preservedTibetan);

    // Error if < 80% preserved
    if (preservationPercentage < this.MIN_PRESERVATION) {
      errors.push(
        `Only ${preservationPercentage.toFixed(1)}% of Tibetan text preserved. ` +
        `Minimum requirement is ${this.MIN_PRESERVATION}%.`
      );
    }
    // Warning if < 95% preserved but >= 80%
    else if (preservationPercentage < this.WARN_PRESERVATION) {
      warnings.push(
        `${preservationPercentage.toFixed(1)}% of Tibetan text preserved. ` +
        `Expected at least ${this.WARN_PRESERVATION}% for optimal preservation.`
      );
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      metadata: {
        preservationPercentage,
      },
    };
  }
}
