/**
 * UnicodeValidator
 *
 * Validates and normalizes Unicode text
 *
 * @module UnicodeValidator
 */

import { Validator, ValidationResult } from '../types';

/**
 * Validator for Unicode encoding and normalization
 */
export class UnicodeValidator implements Validator {
  public readonly name = 'UnicodeValidator';
  public readonly stage = 'input' as const;

  /**
   * Validate Unicode encoding and normalize to NFC
   *
   * @param data - Text to validate
   * @returns Validation result with normalized text
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

    // Check for null bytes
    if (data.includes('\u0000')) {
      errors.push('Text contains null bytes (\\0), which indicates corrupted data');
    }

    // Check for Unicode replacement character (indicates encoding issues)
    if (data.includes('\uFFFD')) {
      errors.push('Text contains Unicode replacement character (�), indicating corrupted or invalid encoding');
    }

    // Check for control characters (except common whitespace)
    const controlChars = data.match(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g);
    if (controlChars && controlChars.length > 0) {
      warnings.push(
        `Text contains ${controlChars.length} control character(s) which may indicate encoding issues`
      );
    }

    // Normalize to NFC
    const normalizedText = data.normalize('NFC');

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      normalizedText,
      metadata: {
        normalized: data !== normalizedText,
      },
    };
  }
}
