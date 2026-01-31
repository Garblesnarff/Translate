/**
 * LengthValidator
 *
 * Validates text length constraints
 *
 * @module LengthValidator
 */

import { Validator, ValidationResult } from '../types';

/**
 * Validator for text length
 */
export class LengthValidator implements Validator {
  public readonly name = 'LengthValidator';
  public readonly stage = 'input' as const;

  private readonly MIN_LENGTH = 1;
  private readonly WARN_LENGTH = 50000; // Warn if > 50,000 chars

  /**
   * Validate text length
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

    const trimmed = data.trim();

    // Check if empty
    if (trimmed.length === 0) {
      errors.push('Text is empty or contains only whitespace');
      return {
        isValid: false,
        errors,
        warnings,
      };
    }

    // Warn if very long
    if (data.length > this.WARN_LENGTH) {
      warnings.push(
        `Text is very long (${data.length} characters). ` +
        `Processing may be slow. Consider chunking for texts over ${this.WARN_LENGTH} characters.`
      );
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      metadata: {
        textLength: data.length,
      },
    };
  }
}
