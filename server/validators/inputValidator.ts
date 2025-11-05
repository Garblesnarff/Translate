/**
 * Input Validator
 *
 * Validates Tibetan text input before translation processing.
 * Ensures text meets quality and format requirements.
 *
 * @author Translation Service Team
 */

/**
 * Validation result interface
 */
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  metadata?: {
    tibetanPercentage?: number;
    textLength?: number;
    unicodeIssues?: string[];
  };
}

/**
 * Input Validator Class
 * Validates Tibetan text input before translation
 */
export class InputValidator {
  private readonly MIN_TIBETAN_PERCENTAGE = 50; // Minimum 50% Tibetan characters
  private readonly MIN_TEXT_LENGTH = 10; // Minimum 10 characters
  private readonly MAX_TEXT_LENGTH = 100000; // Maximum 100,000 characters

  // Tibetan Unicode range: U+0F00 to U+0FFF
  private readonly TIBETAN_UNICODE_RANGE = /[\u0F00-\u0FFF]/g;

  // Control characters and problematic Unicode
  private readonly CONTROL_CHARS = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g;
  private readonly NULL_BYTES = /\0/g;

  /**
   * Main validation method for Tibetan text
   */
  public validateTibetanText(text: string): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const metadata: any = {};

    // Check 1: Text length constraints
    const lengthValidation = this.validateLength(text);
    if (!lengthValidation.isValid) {
      errors.push(...lengthValidation.errors);
    }
    warnings.push(...lengthValidation.warnings);
    metadata.textLength = text.length;

    // Check 2: Tibetan character percentage
    const tibetanValidation = this.validateTibetanContent(text);
    if (!tibetanValidation.isValid) {
      errors.push(...tibetanValidation.errors);
    }
    warnings.push(...tibetanValidation.warnings);
    metadata.tibetanPercentage = tibetanValidation.percentage;

    // Check 3: Unicode encoding validation
    const unicodeValidation = this.validateUnicode(text);
    if (!unicodeValidation.isValid) {
      errors.push(...unicodeValidation.errors);
    }
    warnings.push(...unicodeValidation.warnings);
    metadata.unicodeIssues = unicodeValidation.issues;

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      metadata
    };
  }

  /**
   * Validate text length constraints
   */
  private validateLength(text: string): { isValid: boolean; errors: string[]; warnings: string[] } {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!text || text.trim().length === 0) {
      errors.push('Text is empty or contains only whitespace');
      return { isValid: false, errors, warnings };
    }

    const length = text.length;

    if (length < this.MIN_TEXT_LENGTH) {
      errors.push(`Text is too short (${length} characters). Minimum length is ${this.MIN_TEXT_LENGTH} characters.`);
    }

    if (length > this.MAX_TEXT_LENGTH) {
      errors.push(`Text is too long (${length} characters). Maximum length is ${this.MAX_TEXT_LENGTH} characters. Please split the text into smaller chunks.`);
    }

    // Warn if text is very long (may need chunking)
    if (length > 50000) {
      warnings.push(`Text is very long (${length} characters). Processing may take significant time and may benefit from manual chunking.`);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Validate Tibetan content percentage
   */
  private validateTibetanContent(text: string): {
    isValid: boolean;
    errors: string[];
    warnings: string[];
    percentage: number;
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Count Tibetan characters
    const tibetanMatches = text.match(this.TIBETAN_UNICODE_RANGE);
    const tibetanCharCount = tibetanMatches ? tibetanMatches.length : 0;

    // Remove whitespace for more accurate percentage calculation
    const nonWhitespaceText = text.replace(/\s/g, '');
    const totalNonWhitespaceChars = nonWhitespaceText.length;

    if (totalNonWhitespaceChars === 0) {
      errors.push('Text contains only whitespace');
      return { isValid: false, errors, warnings, percentage: 0 };
    }

    const tibetanPercentage = (tibetanCharCount / totalNonWhitespaceChars) * 100;

    if (tibetanCharCount === 0) {
      errors.push('No Tibetan characters detected in the text. Please ensure the text is in Tibetan script (Unicode U+0F00-U+0FFF).');
    } else if (tibetanPercentage < this.MIN_TIBETAN_PERCENTAGE) {
      errors.push(
        `Insufficient Tibetan content (${tibetanPercentage.toFixed(1)}%). ` +
        `Text must contain at least ${this.MIN_TIBETAN_PERCENTAGE}% Tibetan characters. ` +
        `Found ${tibetanCharCount} Tibetan characters out of ${totalNonWhitespaceChars} total non-whitespace characters.`
      );
    } else if (tibetanPercentage < 70) {
      warnings.push(
        `Text contains only ${tibetanPercentage.toFixed(1)}% Tibetan characters. ` +
        `Consider reviewing the input text for unexpected non-Tibetan content.`
      );
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      percentage: tibetanPercentage
    };
  }

  /**
   * Validate Unicode encoding
   */
  private validateUnicode(text: string): {
    isValid: boolean;
    errors: string[];
    warnings: string[];
    issues: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];
    const issues: string[] = [];

    // Check for null bytes
    if (this.NULL_BYTES.test(text)) {
      errors.push('Text contains null bytes (\\0), which indicates corrupted data');
      issues.push('null_bytes');
    }

    // Check for control characters (except common ones like newline, tab, carriage return)
    const controlChars = text.match(this.CONTROL_CHARS);
    if (controlChars && controlChars.length > 0) {
      warnings.push(
        `Text contains ${controlChars.length} control character(s) which may indicate encoding issues. ` +
        `These may cause unexpected behavior during translation.`
      );
      issues.push('control_characters');
    }

    // Check for replacement character (indicates encoding problems)
    if (text.includes('\uFFFD')) {
      errors.push('Text contains Unicode replacement character (�), indicating corrupted or invalid encoding');
      issues.push('replacement_character');
    }

    // Check for invalid UTF-8 sequences by trying to encode/decode
    try {
      const encoded = new TextEncoder().encode(text);
      const decoded = new TextDecoder('utf-8', { fatal: true }).decode(encoded);
      if (decoded !== text) {
        warnings.push('Text may contain non-standard Unicode sequences');
        issues.push('non_standard_unicode');
      }
    } catch (e) {
      errors.push('Text contains invalid UTF-8 encoding');
      issues.push('invalid_utf8');
    }

    // Check for common Tibetan Unicode issues
    const tibetanIssues = this.checkTibetanUnicodeIssues(text);
    warnings.push(...tibetanIssues.warnings);
    issues.push(...tibetanIssues.issues);

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      issues
    };
  }

  /**
   * Check for common Tibetan-specific Unicode issues
   */
  private checkTibetanUnicodeIssues(text: string): {
    warnings: string[];
    issues: string[];
  } {
    const warnings: string[] = [];
    const issues: string[] = [];

    // Check for mixed normalization forms (NFD vs NFC)
    // This is a simplified check - in production, you might want more sophisticated detection
    const hasComposingChars = /[\u0F71-\u0F84]/.test(text); // Tibetan vowel signs and combining marks
    if (hasComposingChars) {
      // Check if text appears to have inconsistent normalization
      const nfc = text.normalize('NFC');
      const nfd = text.normalize('NFD');

      if (text !== nfc && text !== nfd) {
        warnings.push('Text may have mixed Unicode normalization forms. Consider normalizing to NFC.');
        issues.push('mixed_normalization');
      }
    }

    // Check for unusual spacing
    const unusualSpaces = text.match(/[\u00A0\u2000-\u200B\u202F\u205F\u3000]/g);
    if (unusualSpaces && unusualSpaces.length > 5) {
      warnings.push(
        `Text contains ${unusualSpaces.length} unusual space characters (non-breaking spaces, zero-width spaces, etc.). ` +
        `These may affect text processing.`
      );
      issues.push('unusual_spacing');
    }

    // Check for Tibetan marks without associated characters
    const orphanedMarks = text.match(/^[\u0F71-\u0F84]/gm);
    if (orphanedMarks && orphanedMarks.length > 0) {
      warnings.push('Text contains orphaned Tibetan combining marks without base characters');
      issues.push('orphaned_combining_marks');
    }

    return { warnings, issues };
  }

  /**
   * Quick validation check (minimal validation for fast checks)
   */
  public quickValidate(text: string): boolean {
    if (!text || text.trim().length < this.MIN_TEXT_LENGTH) {
      return false;
    }

    if (text.length > this.MAX_TEXT_LENGTH) {
      return false;
    }

    const tibetanMatches = text.match(this.TIBETAN_UNICODE_RANGE);
    const tibetanCharCount = tibetanMatches ? tibetanMatches.length : 0;

    return tibetanCharCount > 0;
  }

  /**
   * Get detailed validation report as string
   */
  public getValidationReport(result: ValidationResult): string {
    const lines: string[] = [];

    lines.push('=== Input Validation Report ===\n');
    lines.push(`Status: ${result.isValid ? '✓ PASSED' : '✗ FAILED'}\n`);

    if (result.metadata) {
      lines.push('Metadata:');
      if (result.metadata.textLength !== undefined) {
        lines.push(`  - Text length: ${result.metadata.textLength} characters`);
      }
      if (result.metadata.tibetanPercentage !== undefined) {
        lines.push(`  - Tibetan content: ${result.metadata.tibetanPercentage.toFixed(1)}%`);
      }
      if (result.metadata.unicodeIssues && result.metadata.unicodeIssues.length > 0) {
        lines.push(`  - Unicode issues: ${result.metadata.unicodeIssues.join(', ')}`);
      }
      lines.push('');
    }

    if (result.errors.length > 0) {
      lines.push(`Errors (${result.errors.length}):`);
      result.errors.forEach((error, i) => {
        lines.push(`  ${i + 1}. ${error}`);
      });
      lines.push('');
    }

    if (result.warnings.length > 0) {
      lines.push(`Warnings (${result.warnings.length}):`);
      result.warnings.forEach((warning, i) => {
        lines.push(`  ${i + 1}. ${warning}`);
      });
      lines.push('');
    }

    if (result.isValid && result.errors.length === 0 && result.warnings.length === 0) {
      lines.push('No issues found. Text is ready for translation.');
    }

    return lines.join('\n');
  }
}

// Export singleton instance
export const inputValidator = new InputValidator();
