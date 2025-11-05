/**
 * Output Validator
 *
 * Validates translation output after processing.
 * Ensures translations meet format and quality requirements.
 *
 * @author Translation Service Team
 */

export interface OutputValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  metadata?: {
    formatCompliance?: number; // 0-100 percentage
    tibetanPreservation?: number; // 0-100 percentage
    completeness?: number; // 0-100 percentage
    aiErrorsDetected?: string[];
  };
}

/**
 * Output Validator Class
 * Validates translation output format and quality
 */
export class OutputValidator {
  private readonly MIN_TRANSLATION_LENGTH = 10;
  private readonly MIN_TIBETAN_PRESERVATION = 70; // Minimum 70% of Tibetan text preserved

  // Tibetan Unicode range
  private readonly TIBETAN_UNICODE_RANGE = /[\u0F00-\u0FFF]/g;

  // AI error patterns
  private readonly AI_ERROR_PATTERNS = [
    /I apologize/i,
    /I cannot/i,
    /I'm unable to/i,
    /I can't translate/i,
    /I don't have/i,
    /as an AI/i,
    /^(Translation|Output|Result):/i, // Meta-text prefixes
    /^Here is the translation/i,
    /^Here's the translation/i,
    /^The translation is/i,
    /```/g, // Code blocks
    /\[Note:/i, // AI notes
    /\[Explanation:/i
  ];

  /**
   * Main validation method for translation output
   */
  public validateTranslation(
    translation: string,
    originalText: string
  ): OutputValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const metadata: any = {};

    // Check 1: Basic completeness
    const completenessValidation = this.validateCompleteness(translation);
    if (!completenessValidation.isValid) {
      errors.push(...completenessValidation.errors);
    }
    warnings.push(...completenessValidation.warnings);
    metadata.completeness = completenessValidation.completeness;

    // Check 2: Format compliance (English (Tibetan))
    const formatValidation = this.validateFormat(translation);
    if (!formatValidation.isValid) {
      errors.push(...formatValidation.errors);
    }
    warnings.push(...formatValidation.warnings);
    metadata.formatCompliance = formatValidation.compliance;

    // Check 3: Tibetan preservation
    const preservationValidation = this.validateTibetanPreservation(
      translation,
      originalText
    );
    if (!preservationValidation.isValid) {
      errors.push(...preservationValidation.errors);
    }
    warnings.push(...preservationValidation.warnings);
    metadata.tibetanPreservation = preservationValidation.preservationPercentage;

    // Check 4: AI error detection
    const aiErrorValidation = this.checkAIErrors(translation);
    if (!aiErrorValidation.isValid) {
      errors.push(...aiErrorValidation.errors);
    }
    warnings.push(...aiErrorValidation.warnings);
    metadata.aiErrorsDetected = aiErrorValidation.detectedErrors;

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      metadata
    };
  }

  /**
   * Validate translation completeness
   */
  private validateCompleteness(translation: string): {
    isValid: boolean;
    errors: string[];
    warnings: string[];
    completeness: number;
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!translation || translation.trim().length === 0) {
      errors.push('Translation is empty');
      return { isValid: false, errors, warnings, completeness: 0 };
    }

    const trimmedLength = translation.trim().length;

    if (trimmedLength < this.MIN_TRANSLATION_LENGTH) {
      errors.push(
        `Translation is too short (${trimmedLength} characters). ` +
        `Minimum length is ${this.MIN_TRANSLATION_LENGTH} characters.`
      );
      return { isValid: false, errors, warnings, completeness: 0 };
    }

    // Check if translation is suspiciously short (likely incomplete)
    if (trimmedLength < 50) {
      warnings.push('Translation is very short. Please verify it is complete.');
    }

    // Calculate completeness score (simplified)
    let completeness = 100;
    if (trimmedLength < 100) {
      completeness = Math.max(50, (trimmedLength / 100) * 100);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      completeness
    };
  }

  /**
   * Validate translation format: "English (Tibetan)"
   */
  private validateFormat(translation: string): {
    isValid: boolean;
    errors: string[];
    warnings: string[];
    compliance: number;
  } {
    const errors: string[] = [];
    const warnings: string[] = [];
    let complianceScore = 0;

    // Check for parentheses balance
    const openParens = (translation.match(/\(/g) || []).length;
    const closeParens = (translation.match(/\)/g) || []).length;

    if (openParens !== closeParens) {
      errors.push(
        `Unbalanced parentheses: ${openParens} opening, ${closeParens} closing. ` +
        `Translation format should be "English (Tibetan)".`
      );
    } else {
      complianceScore += 30;
    }

    // Check if Tibetan text appears inside parentheses
    const tibetanInsideParens = this.extractTibetanFromParentheses(translation);
    if (tibetanInsideParens.length === 0) {
      errors.push(
        'No Tibetan text found inside parentheses. ' +
        'Expected format: "English translation (Tibetan text)".'
      );
    } else {
      complianceScore += 40;
    }

    // Check if there's Tibetan text outside parentheses (format violation)
    const tibetanOutsideParens = this.findTibetanOutsideParentheses(translation);
    if (tibetanOutsideParens.length > 0) {
      // Calculate percentage of Tibetan outside parentheses
      const totalTibetan = (translation.match(this.TIBETAN_UNICODE_RANGE) || []).length;
      const outsidePercentage = (tibetanOutsideParens.length / totalTibetan) * 100;

      if (outsidePercentage > 10) {
        errors.push(
          `${outsidePercentage.toFixed(1)}% of Tibetan text is outside parentheses. ` +
          `All Tibetan text should be enclosed in parentheses.`
        );
      } else {
        warnings.push(
          `Found ${tibetanOutsideParens.length} Tibetan characters outside parentheses. ` +
          `Consider reviewing the format.`
        );
        complianceScore += 20;
      }
    } else {
      complianceScore += 30;
    }

    // Check for proper sentence structure
    const sentences = translation.split(/[.!?]+/);
    let sentencesWithFormat = 0;

    for (const sentence of sentences) {
      if (sentence.trim().length > 0) {
        // Check if sentence has pattern: text (tibetan)
        const hasFormat = /\([^)]*[\u0F00-\u0FFF][^)]*\)/.test(sentence);
        if (hasFormat) {
          sentencesWithFormat++;
        }
      }
    }

    const formatCompliance = sentences.length > 1
      ? (sentencesWithFormat / sentences.filter(s => s.trim().length > 0).length) * 100
      : complianceScore;

    if (formatCompliance < 50 && sentences.length > 2) {
      warnings.push(
        `Only ${formatCompliance.toFixed(0)}% of sentences follow the expected format. ` +
        `Each sentence should have the pattern: "English (Tibetan)".`
      );
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      compliance: Math.min(100, complianceScore)
    };
  }

  /**
   * Validate Tibetan text preservation
   */
  private validateTibetanPreservation(
    translation: string,
    originalText: string
  ): {
    isValid: boolean;
    errors: string[];
    warnings: string[];
    preservationPercentage: number;
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Extract Tibetan characters from original text
    const originalTibetan = originalText.match(this.TIBETAN_UNICODE_RANGE) || [];
    const originalTibetanSet = new Set(originalTibetan.join(''));

    // Extract Tibetan characters from translation (should be in parentheses)
    const translationTibetan = translation.match(this.TIBETAN_UNICODE_RANGE) || [];
    const translationTibetanSet = new Set(translationTibetan.join(''));

    if (originalTibetan.length === 0) {
      warnings.push('Original text contains no Tibetan characters to validate preservation');
      return { isValid: true, errors, warnings, preservationPercentage: 100 };
    }

    if (translationTibetan.length === 0) {
      errors.push('Translation contains no Tibetan characters. All Tibetan text should be preserved in parentheses.');
      return { isValid: false, errors, warnings, preservationPercentage: 0 };
    }

    // Calculate preservation percentage (character count based)
    const preservationPercentage = (translationTibetan.length / originalTibetan.length) * 100;

    if (preservationPercentage < this.MIN_TIBETAN_PRESERVATION) {
      errors.push(
        `Only ${preservationPercentage.toFixed(1)}% of Tibetan text preserved. ` +
        `Minimum requirement is ${this.MIN_TIBETAN_PRESERVATION}%. ` +
        `Original: ${originalTibetan.length} characters, Translation: ${translationTibetan.length} characters.`
      );
    } else if (preservationPercentage < 85) {
      warnings.push(
        `${preservationPercentage.toFixed(1)}% of Tibetan text preserved. ` +
        `Consider reviewing to ensure all important Tibetan text is included.`
      );
    }

    // Check for significant character loss (unique characters)
    const uniqueOriginal = originalTibetanSet.size;
    const uniqueTranslation = translationTibetanSet.size;
    const uniquePreservation = (uniqueTranslation / uniqueOriginal) * 100;

    if (uniquePreservation < 70) {
      warnings.push(
        `Only ${uniquePreservation.toFixed(1)}% of unique Tibetan characters preserved. ` +
        `This may indicate significant content loss.`
      );
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      preservationPercentage
    };
  }

  /**
   * Check for common AI errors and meta-text
   */
  private checkAIErrors(translation: string): {
    isValid: boolean;
    errors: string[];
    warnings: string[];
    detectedErrors: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];
    const detectedErrors: string[] = [];

    for (const pattern of this.AI_ERROR_PATTERNS) {
      const matches = translation.match(pattern);
      if (matches) {
        const errorType = this.getErrorType(pattern);
        detectedErrors.push(errorType);

        if (errorType === 'ai_refusal' || errorType === 'ai_apology') {
          errors.push(
            `Translation contains AI refusal or apology: "${matches[0]}". ` +
            `This indicates the AI did not complete the translation properly.`
          );
        } else if (errorType === 'meta_text') {
          errors.push(
            `Translation contains meta-text prefix: "${matches[0]}". ` +
            `Translation should contain only the translated content without prefixes.`
          );
        } else if (errorType === 'code_blocks') {
          errors.push('Translation contains code block markers (```). These should be removed.');
        } else {
          warnings.push(`Translation contains unexpected AI text: "${matches[0]}".`);
        }
      }
    }

    // Check for excessive explanatory text
    if (/\[.*?\]/.test(translation)) {
      warnings.push('Translation contains bracketed notes or explanations. Consider removing editorial content.');
      detectedErrors.push('editorial_notes');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      detectedErrors
    };
  }

  /**
   * Extract Tibetan text from inside parentheses
   */
  private extractTibetanFromParentheses(text: string): string[] {
    const tibetanInParens: string[] = [];
    const parenRegex = /\(([^)]+)\)/g;
    let match;

    while ((match = parenRegex.exec(text)) !== null) {
      const content = match[1];
      const tibetan = content.match(this.TIBETAN_UNICODE_RANGE);
      if (tibetan) {
        tibetanInParens.push(...tibetan);
      }
    }

    return tibetanInParens;
  }

  /**
   * Find Tibetan text outside parentheses
   */
  private findTibetanOutsideParentheses(text: string): string[] {
    // Remove all parentheses and their content
    const textWithoutParens = text.replace(/\([^)]*\)/g, '');

    // Find Tibetan characters in what remains
    const tibetanOutside = textWithoutParens.match(this.TIBETAN_UNICODE_RANGE);

    return tibetanOutside || [];
  }

  /**
   * Get error type from pattern
   */
  private getErrorType(pattern: RegExp): string {
    const patternStr = pattern.toString();

    if (patternStr.includes('apologize') || patternStr.includes('cannot') || patternStr.includes('unable')) {
      return 'ai_refusal';
    }
    if (patternStr.includes('Translation:|Output:|Result:')) {
      return 'meta_text';
    }
    if (patternStr.includes('```')) {
      return 'code_blocks';
    }
    if (patternStr.includes('Here is') || patternStr.includes('Here\'s')) {
      return 'ai_preamble';
    }
    if (patternStr.includes('as an AI')) {
      return 'ai_apology';
    }

    return 'unknown_ai_error';
  }

  /**
   * Quick validation check (minimal validation for fast checks)
   */
  public quickValidate(translation: string): boolean {
    if (!translation || translation.trim().length < this.MIN_TRANSLATION_LENGTH) {
      return false;
    }

    // Check for basic format compliance
    const hasParentheses = translation.includes('(') && translation.includes(')');
    const hasTibetan = this.TIBETAN_UNICODE_RANGE.test(translation);

    return hasParentheses && hasTibetan;
  }

  /**
   * Get detailed validation report as string
   */
  public getValidationReport(result: OutputValidationResult): string {
    const lines: string[] = [];

    lines.push('=== Output Validation Report ===\n');
    lines.push(`Status: ${result.isValid ? '✓ PASSED' : '✗ FAILED'}\n`);

    if (result.metadata) {
      lines.push('Metadata:');
      if (result.metadata.completeness !== undefined) {
        lines.push(`  - Completeness: ${result.metadata.completeness.toFixed(1)}%`);
      }
      if (result.metadata.formatCompliance !== undefined) {
        lines.push(`  - Format compliance: ${result.metadata.formatCompliance.toFixed(1)}%`);
      }
      if (result.metadata.tibetanPreservation !== undefined) {
        lines.push(`  - Tibetan preservation: ${result.metadata.tibetanPreservation.toFixed(1)}%`);
      }
      if (result.metadata.aiErrorsDetected && result.metadata.aiErrorsDetected.length > 0) {
        lines.push(`  - AI errors detected: ${result.metadata.aiErrorsDetected.join(', ')}`);
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
      lines.push('No issues found. Translation meets all quality requirements.');
    }

    return lines.join('\n');
  }
}

// Export singleton instance
export const outputValidator = new OutputValidator();
