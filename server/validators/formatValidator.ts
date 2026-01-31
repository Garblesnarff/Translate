/**
 * Format Validator
 *
 * Strict format validation and correction for translation output.
 * Enforces the "English (Tibetan)" format pattern.
 *
 * Phase 2.3 Implementation:
 * - Strict format enforcement
 * - Automatic format correction
 * - Meta-text detection and removal
 *
 * @author Translation Service Team
 */

export interface FormatValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  metadata?: {
    parenthesesBalanced: boolean;
    hasMetaText: boolean;
    tibetanInParentheses: boolean;
    tibetanOutsideParentheses: boolean;
    formatScore: number; // 0-1
  };
}

export interface FormatCorrectionResult {
  corrected: string;
  changesMade: string[];
  success: boolean;
}

/**
 * Format Validator Class
 * Validates and corrects translation format
 */
export class FormatValidator {
  // Expected format pattern: English text (Tibetan text)
  private readonly EXPECTED_FORMAT_REGEX = /[^()]+\([^)]*[\u0F00-\u0FFF][^)]*\)/;

  // Meta-text patterns to detect
  private readonly META_TEXT_PATTERNS = [
    /^Translation:/i,
    /^Output:/i,
    /^Result:/i,
    /^Here is( the)?( translation)?:/i,
    /^Here's( the)?( translation)?:/i,
    /^I have translated:/i,
    /^The translation is:/i,
    /^Translated text:/i,
    /^Final translation:/i,
    /^Below is the translation:/i,
    /```/g, // Code blocks
    /\*\*Translation\*\*/i,
    /## Translation/i,
    /### Translation/i
  ];

  // Tibetan Unicode range
  private readonly TIBETAN_UNICODE = /[\u0F00-\u0FFF]/g;

  /**
   * Main validation method for format compliance
   */
  public validateFormat(translation: string): FormatValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const metadata: any = {
      parenthesesBalanced: true,
      hasMetaText: false,
      tibetanInParentheses: true,
      tibetanOutsideParentheses: false,
      formatScore: 1.0
    };

    let score = 1.0;

    // Check 1: Balanced parentheses
    const parenthesesCheck = this.checkParenthesesBalance(translation);
    if (!parenthesesCheck.balanced) {
      errors.push(`Unbalanced parentheses: ${parenthesesCheck.openCount} open, ${parenthesesCheck.closeCount} close`);
      metadata.parenthesesBalanced = false;
      score -= 0.3;
    }

    // Check 2: Meta-text detection
    const metaTextCheck = this.detectMetaText(translation);
    if (metaTextCheck.hasMetaText) {
      errors.push(`Meta-text detected: "${metaTextCheck.examples.join('", "')}"`);
      metadata.hasMetaText = true;
      metadata.metaTextPatterns = metaTextCheck.examples;
      score -= 0.3;
    }

    // Check 3: Tibetan text inside parentheses
    const tibetanCheck = this.checkTibetanPlacement(translation);
    if (!tibetanCheck.allInParentheses) {
      errors.push('Some Tibetan text found outside parentheses');
      metadata.tibetanInParentheses = false;
      metadata.tibetanOutsideParentheses = true;
      score -= 0.2;
    }

    // Check 4: Each sentence has proper format
    const sentenceCheck = this.checkSentenceFormat(translation);
    if (sentenceCheck.malformedSentences > 0) {
      warnings.push(`${sentenceCheck.malformedSentences} sentence(s) missing proper English (Tibetan) format`);
      score -= sentenceCheck.malformedSentences * 0.05;
    }

    // Check 5: No empty parentheses
    if (/\(\s*\)/.test(translation)) {
      warnings.push('Empty parentheses found');
      score -= 0.05;
    }

    // Check 6: No nested parentheses (usually indicates formatting error)
    if (/\([^()]*\([^)]*\)[^()]*\)/.test(translation)) {
      warnings.push('Nested parentheses detected - may indicate formatting issues');
      score -= 0.05;
    }

    metadata.formatScore = Math.max(0, score);

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      metadata
    };
  }

  /**
   * Attempt to automatically correct format issues
   */
  public attemptFormatCorrection(translation: string): FormatCorrectionResult {
    let corrected = translation;
    const changesMade: string[] = [];

    // Correction 1: Remove meta-text prefixes
    const metaTextResult = this.removeMetaText(corrected);
    if (metaTextResult.changed) {
      corrected = metaTextResult.text;
      changesMade.push(...metaTextResult.changes);
    }

    // Correction 2: Remove code blocks
    const codeBlockResult = this.removeCodeBlocks(corrected);
    if (codeBlockResult.changed) {
      corrected = codeBlockResult.text;
      changesMade.push('Removed code block markers');
    }

    // Correction 3: Remove markdown formatting
    const markdownResult = this.removeMarkdownFormatting(corrected);
    if (markdownResult.changed) {
      corrected = markdownResult.text;
      changesMade.push('Removed markdown formatting');
    }

    // Correction 4: Fix common parentheses issues
    const parenthesesResult = this.fixParentheses(corrected);
    if (parenthesesResult.changed) {
      corrected = parenthesesResult.text;
      changesMade.push(...parenthesesResult.changes);
    }

    // Correction 5: Normalize whitespace
    const whitespaceResult = this.normalizeWhitespace(corrected);
    if (whitespaceResult.changed) {
      corrected = whitespaceResult.text;
      changesMade.push('Normalized whitespace');
    }

    // Validation: Check if corrections improved the format
    const validation = this.validateFormat(corrected);
    const success = validation.isValid || validation.errors.length === 0;

    return {
      corrected,
      changesMade,
      success
    };
  }

  /**
   * Extract pure translation from AI response
   * Removes explanations, notes, and meta-text
   */
  public extractTranslation(aiResponse: string): string {
    let extracted = aiResponse.trim();

    // Remove everything before "Translation:" or similar markers
    const translationMarkers = [
      /^.*?Translation:\s*/i,
      /^.*?Output:\s*/i,
      /^.*?Result:\s*/i,
      /^.*?Here is( the)?( translation)?:\s*/i,
      /^.*?Here's( the)?( translation)?:\s*/i
    ];

    for (const marker of translationMarkers) {
      if (marker.test(extracted)) {
        extracted = extracted.replace(marker, '');
        break;
      }
    }

    // Remove code blocks
    extracted = extracted.replace(/```[\s\S]*?```/g, '');
    extracted = extracted.replace(/```/g, '');

    // Remove explanatory notes at the end
    const noteMarkers = [
      /\n\n\[Note:.*$/i,
      /\n\nNote:.*$/i,
      /\n\nExplanation:.*$/i,
      /\n\n\*\*Note:.*$/i
    ];

    for (const marker of noteMarkers) {
      extracted = extracted.replace(marker, '');
    }

    // Remove markdown headers
    extracted = extracted.replace(/^#+\s+.*/gm, '');

    // Remove leading/trailing whitespace
    extracted = extracted.trim();

    return extracted;
  }

  /**
   * Check if parentheses are balanced
   */
  private checkParenthesesBalance(text: string): {
    balanced: boolean;
    openCount: number;
    closeCount: number;
  } {
    const openCount = (text.match(/\(/g) || []).length;
    const closeCount = (text.match(/\)/g) || []).length;

    return {
      balanced: openCount === closeCount,
      openCount,
      closeCount
    };
  }

  /**
   * Detect meta-text in translation
   */
  private detectMetaText(text: string): {
    hasMetaText: boolean;
    examples: string[];
  } {
    const examples: string[] = [];

    for (const pattern of this.META_TEXT_PATTERNS) {
      const match = text.match(pattern);
      if (match) {
        examples.push(match[0]);
      }
    }

    return {
      hasMetaText: examples.length > 0,
      examples
    };
  }

  /**
   * Check Tibetan text placement
   */
  private checkTibetanPlacement(text: string): {
    allInParentheses: boolean;
    tibetanOutsideCount: number;
  } {
    // Remove all text in parentheses
    const textWithoutParens = text.replace(/\([^)]*\)/g, '');

    // Check if there's Tibetan text remaining
    const tibetanOutside = textWithoutParens.match(this.TIBETAN_UNICODE);
    const tibetanOutsideCount = tibetanOutside ? tibetanOutside.length : 0;

    // Allow a few Tibetan characters outside (might be intentional)
    return {
      allInParentheses: tibetanOutsideCount <= 2,
      tibetanOutsideCount
    };
  }

  /**
   * Check sentence format
   */
  private checkSentenceFormat(text: string): {
    totalSentences: number;
    malformedSentences: number;
  } {
    // Split by sentence-ending punctuation
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 10);

    let malformedSentences = 0;

    for (const sentence of sentences) {
      // Check if sentence has Tibetan text
      const hasTibetan = this.TIBETAN_UNICODE.test(sentence);

      if (hasTibetan) {
        // Should have parentheses with Tibetan inside
        const hasProperFormat = /\([^)]*[\u0F00-\u0FFF][^)]*\)/.test(sentence);

        if (!hasProperFormat) {
          malformedSentences++;
        }
      }
    }

    return {
      totalSentences: sentences.length,
      malformedSentences
    };
  }

  /**
   * Remove meta-text from translation
   */
  private removeMetaText(text: string): {
    text: string;
    changed: boolean;
    changes: string[];
  } {
    let result = text;
    const changes: string[] = [];
    let changed = false;

    // Remove meta-text patterns from the beginning
    for (const pattern of this.META_TEXT_PATTERNS) {
      const match = result.match(pattern);
      if (match) {
        result = result.replace(pattern, '').trim();
        changes.push(`Removed meta-text: "${match[0]}"`);
        changed = true;
      }
    }

    // Remove "I apologize" or "I cannot" phrases
    const apologyPatterns = [
      /I apologize[^.]*\./gi,
      /I cannot[^.]*\./gi,
      /I'm unable to[^.]*\./gi
    ];

    for (const pattern of apologyPatterns) {
      if (pattern.test(result)) {
        result = result.replace(pattern, '').trim();
        changes.push('Removed AI apology/refusal');
        changed = true;
      }
    }

    return { text: result, changed, changes };
  }

  /**
   * Remove code blocks
   */
  private removeCodeBlocks(text: string): {
    text: string;
    changed: boolean;
  } {
    const original = text;
    const result = text.replace(/```[\s\S]*?```/g, '').replace(/```/g, '').trim();

    return {
      text: result,
      changed: original !== result
    };
  }

  /**
   * Remove markdown formatting
   */
  private removeMarkdownFormatting(text: string): {
    text: string;
    changed: boolean;
  } {
    const original = text;
    let result = text;

    // Remove markdown headers
    result = result.replace(/^#+\s+/gm, '');

    // Remove bold/italic
    result = result.replace(/\*\*([^*]+)\*\*/g, '$1');
    result = result.replace(/\*([^*]+)\*/g, '$1');
    result = result.replace(/__([^_]+)__/g, '$1');
    result = result.replace(/_([^_]+)_/g, '$1');

    return {
      text: result.trim(),
      changed: original !== result
    };
  }

  /**
   * Fix common parentheses issues
   */
  private fixParentheses(text: string): {
    text: string;
    changed: boolean;
    changes: string[];
  } {
    let result = text;
    const changes: string[] = [];
    const original = text;

    // Remove empty parentheses
    if (/\(\s*\)/.test(result)) {
      result = result.replace(/\(\s*\)/g, '');
      changes.push('Removed empty parentheses');
    }

    // Fix spacing around parentheses: "text( tibetan )" -> "text (tibetan)"
    result = result.replace(/\s*\(\s*/g, ' (');
    result = result.replace(/\s*\)\s*/g, ') ');

    // Remove extra spaces
    result = result.replace(/\s+/g, ' ').trim();

    return {
      text: result,
      changed: original !== result,
      changes
    };
  }

  /**
   * Normalize whitespace
   */
  private normalizeWhitespace(text: string): {
    text: string;
    changed: boolean;
  } {
    const original = text;

    // Replace multiple spaces with single space
    let result = text.replace(/[ \t]+/g, ' ');

    // Replace multiple newlines with double newline
    result = result.replace(/\n{3,}/g, '\n\n');

    // Trim each line
    result = result.split('\n').map(line => line.trim()).join('\n');

    // Trim overall
    result = result.trim();

    return {
      text: result,
      changed: original !== result
    };
  }

  /**
   * Get a human-readable validation report
   */
  public getValidationReport(validation: FormatValidationResult): string {
    let report = '=== FORMAT VALIDATION REPORT ===\n\n';

    report += `Status: ${validation.isValid ? '✓ VALID' : '✗ INVALID'}\n`;

    if (validation.metadata) {
      report += `Format Score: ${(validation.metadata.formatScore * 100).toFixed(1)}%\n\n`;
    }

    if (validation.errors.length > 0) {
      report += 'ERRORS:\n';
      validation.errors.forEach((error, i) => {
        report += `  ${i + 1}. ${error}\n`;
      });
      report += '\n';
    }

    if (validation.warnings.length > 0) {
      report += 'WARNINGS:\n';
      validation.warnings.forEach((warning, i) => {
        report += `  ${i + 1}. ${warning}\n`;
      });
      report += '\n';
    }

    if (validation.metadata) {
      report += 'DETAILS:\n';
      report += `  - Parentheses Balanced: ${validation.metadata.parenthesesBalanced ? '✓' : '✗'}\n`;
      report += `  - Has Meta-text: ${validation.metadata.hasMetaText ? '✗' : '✓'}\n`;
      report += `  - Tibetan in Parentheses: ${validation.metadata.tibetanInParentheses ? '✓' : '✗'}\n`;
      report += `  - Tibetan Outside Parentheses: ${validation.metadata.tibetanOutsideParentheses ? '✗' : '✓'}\n`;
    }

    return report;
  }
}

// Export singleton instance
export const formatValidator = new FormatValidator();
