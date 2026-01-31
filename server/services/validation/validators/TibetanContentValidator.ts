/**
 * TibetanContentValidator
 *
 * Validates that input text contains sufficient Tibetan content
 *
 * @module TibetanContentValidator
 */

import { Validator, ValidationResult } from '../types';

/**
 * Calculate percentage of Tibetan characters in text
 */
function calculateTibetanPercentage(text: string): number {
  const tibetanChars = (text.match(/[\u0F00-\u0FFF]/g) || []).length;
  const nonWhitespaceChars = text.replace(/\s/g, '').length;

  if (nonWhitespaceChars === 0) return 0;

  return (tibetanChars / nonWhitespaceChars) * 100;
}

/**
 * Validator for Tibetan content percentage
 */
export class TibetanContentValidator implements Validator {
  public readonly name = 'TibetanContentValidator';
  public readonly stage = 'input' as const;

  private readonly MIN_TIBETAN_PERCENTAGE = 50; // Error threshold
  private readonly WARN_TIBETAN_PERCENTAGE = 70; // Warning threshold

  /**
   * Validate that text contains sufficient Tibetan characters
   *
   * @param data - Text to validate
   * @returns Validation result
   */
  public validate(data: string): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (typeof data !== 'string') {
      return {
        isValid: false,
        errors: ['Input must be a string'],
        warnings: [],
      };
    }

    const tibetanPercentage = calculateTibetanPercentage(data);

    // Error if < 50% Tibetan
    if (tibetanPercentage < this.MIN_TIBETAN_PERCENTAGE) {
      errors.push(
        `Insufficient Tibetan content (${tibetanPercentage.toFixed(1)}%). ` +
        `Text must contain at least ${this.MIN_TIBETAN_PERCENTAGE}% Tibetan characters.`
      );
    }
    // Warning if < 70% Tibetan but >= 50%
    else if (tibetanPercentage < this.WARN_TIBETAN_PERCENTAGE) {
      warnings.push(
        `Text contains only ${tibetanPercentage.toFixed(1)}% Tibetan characters. ` +
        `Expected at least ${this.WARN_TIBETAN_PERCENTAGE}% for optimal results.`
      );
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      metadata: {
        tibetanPercentage,
      },
    };
  }
}
