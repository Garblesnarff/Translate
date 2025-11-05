/**
 * FormatValidator
 *
 * Validates translation output format: "English (Tibetan)"
 *
 * @module FormatValidator
 */

import { Validator, ValidationResult, OutputValidationData } from '../types';

/**
 * Extract Tibetan text from parentheses
 */
function extractTibetanFromParens(text: string): string[] {
  const matches = text.matchAll(/\(([\u0F00-\u0FFF\s]+)\)/g);
  return Array.from(matches, m => m[1]);
}

/**
 * AI refusal patterns to detect
 */
const AI_REFUSAL_PATTERNS = [
  /I cannot/i,
  /I apologize/i,
  /I'm unable/i,
  /I can't/i,
  /as an AI/i,
  /I don't have/i,
];

/**
 * Validator for translation output format
 */
export class FormatValidator implements Validator {
  public readonly name = 'FormatValidator';
  public readonly stage = 'output' as const;

  /**
   * Validate translation format
   *
   * @param data - Output validation data
   * @returns Validation result
   */
  public validate(data: OutputValidationData | any): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Extract translation text
    const translation = typeof data === 'string' ? data : data?.translation;

    if (!translation || typeof translation !== 'string') {
      return {
        isValid: false,
        errors: ['Translation text is missing or invalid'],
        warnings: [],
      };
    }

    // Check for AI refusal patterns
    for (const pattern of AI_REFUSAL_PATTERNS) {
      if (pattern.test(translation)) {
        errors.push(
          `Translation contains AI refusal pattern. ` +
          `The model did not properly complete the translation.`
        );
        return {
          isValid: false,
          errors,
          warnings,
        };
      }
    }

    // Check for parentheses balance
    const openParens = (translation.match(/\(/g) || []).length;
    const closeParens = (translation.match(/\)/g) || []).length;

    if (openParens === 0 || closeParens === 0) {
      errors.push(
        'Translation format should be "English (Tibetan)". ' +
        'No parentheses found.'
      );
    } else if (openParens !== closeParens) {
      errors.push(
        `Unbalanced parentheses: ${openParens} opening, ${closeParens} closing`
      );
    }

    // Check if Tibetan text is inside parentheses
    const tibetanInParens = extractTibetanFromParens(translation);
    if (tibetanInParens.length === 0) {
      errors.push(
        'No Tibetan text found inside parentheses. ' +
        'Expected format: "English translation (Tibetan text)"'
      );
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      metadata: {
        formatSegments: tibetanInParens.length,
      },
    };
  }
}
