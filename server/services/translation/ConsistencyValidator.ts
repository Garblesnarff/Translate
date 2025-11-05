/**
 * Consistency Validator Service
 *
 * Validates terminology consistency in translations using document glossaries.
 * Provides real-time warnings when translations deviate from established terms.
 * Generates glossary-enhanced prompts to guide consistent translations.
 *
 * Key features:
 * - Real-time consistency checking against glossary
 * - Warning generation for inconsistent translations
 * - Glossary-enhanced prompt generation
 * - Consistency scoring
 *
 * @author Translation Service Team
 */

import { GlossaryBuilder, GlossaryEntry } from './GlossaryBuilder';
import { TermExtractor, TermPair } from './TermExtractor';

export interface ConsistencyWarning {
  tibetan: string;
  usedTranslation: string;
  expectedTranslation: string;
  severity: 'high' | 'medium' | 'low';
  message: string;
  pageNumber: number;
}

export interface ConsistencyValidationResult {
  isConsistent: boolean;
  consistencyScore: number;
  warnings: ConsistencyWarning[];
  termsChecked: number;
  inconsistentTerms: number;
}

export class ConsistencyValidator {
  private termExtractor: TermExtractor;

  constructor() {
    this.termExtractor = new TermExtractor();
  }

  /**
   * Validates consistency of a translation against a glossary
   *
   * @param translation - The translation text to validate
   * @param pageNumber - The page number for context
   * @param glossary - The document glossary to check against
   * @returns Validation result with warnings
   */
  public validateConsistency(
    translation: string,
    pageNumber: number,
    glossary: GlossaryBuilder
  ): ConsistencyValidationResult {
    // Extract terms from the new translation
    const newTerms = this.termExtractor.extractTermPairs(translation, pageNumber);

    if (newTerms.length === 0) {
      return {
        isConsistent: true,
        consistencyScore: 1.0,
        warnings: [],
        termsChecked: 0,
        inconsistentTerms: 0
      };
    }

    const warnings: ConsistencyWarning[] = [];
    let termsChecked = 0;
    let inconsistentTerms = 0;

    // Check each term against the glossary
    for (const term of newTerms) {
      const glossaryEntry = glossary.getEntry(term.tibetan);

      if (glossaryEntry) {
        termsChecked++;

        // Check if the used translation matches the canonical one
        const isConsistent = this.isTranslationConsistent(
          term.english,
          glossaryEntry.canonical,
          glossaryEntry
        );

        if (!isConsistent) {
          inconsistentTerms++;
          const severity = this.determineWarningSeverity(glossaryEntry);

          warnings.push({
            tibetan: term.tibetan,
            usedTranslation: term.english,
            expectedTranslation: glossaryEntry.canonical,
            severity,
            message: this.generateWarningMessage(term, glossaryEntry),
            pageNumber
          });
        }
      }
    }

    // Calculate consistency score
    const consistencyScore = termsChecked > 0
      ? (termsChecked - inconsistentTerms) / termsChecked
      : 1.0;

    const isConsistent = consistencyScore >= 0.8; // 80% threshold

    if (warnings.length > 0) {
      console.log(`[ConsistencyValidator] Page ${pageNumber}: Found ${warnings.length} consistency warnings`);
    }

    return {
      isConsistent,
      consistencyScore,
      warnings,
      termsChecked,
      inconsistentTerms
    };
  }

  /**
   * Checks if a translation is consistent with the glossary
   * Handles minor variations
   */
  private isTranslationConsistent(
    usedTranslation: string,
    canonicalTranslation: string,
    entry: GlossaryEntry
  ): boolean {
    // Normalize for comparison
    const normalize = (s: string) =>
      s.toLowerCase().replace(/[.,!?;:]/g, '').trim();

    const normUsed = normalize(usedTranslation);
    const normCanonical = normalize(canonicalTranslation);

    // Exact match
    if (normUsed === normCanonical) {
      return true;
    }

    // Check if it matches any accepted variant
    for (const variant of entry.translations) {
      if (normalize(variant.english) === normUsed) {
        // It's a known variant, so it's acceptable
        // Only warn if it's not the most common one
        return variant.count >= entry.translations[0].count * 0.3; // At least 30% as common
      }
    }

    // Check if one is a subset of the other (e.g., "Lama" vs "the Lama")
    if (normUsed.includes(normCanonical) || normCanonical.includes(normUsed)) {
      return true;
    }

    return false;
  }

  /**
   * Determines warning severity based on term importance
   */
  private determineWarningSeverity(entry: GlossaryEntry): 'high' | 'medium' | 'low' {
    // High severity for:
    // - Frequently used terms (appears many times)
    // - High confidence terms
    // - Terms with clear dominant translation

    const frequency = entry.totalOccurrences;
    const confidence = entry.confidence;
    const variants = entry.translations.length;

    // Calculate dominance of canonical translation
    const canonicalCount = entry.translations[0].count;
    const dominance = canonicalCount / frequency;

    if (frequency >= 10 && confidence >= 0.85 && dominance >= 0.7) {
      return 'high';
    }

    if (frequency >= 5 && confidence >= 0.7) {
      return 'medium';
    }

    return 'low';
  }

  /**
   * Generates a helpful warning message
   */
  private generateWarningMessage(term: TermPair, glossaryEntry: GlossaryEntry): string {
    const variantInfo = glossaryEntry.translations.length > 1
      ? ` (also seen as: ${glossaryEntry.translations.slice(1, 3).map(t => t.english).join(', ')})`
      : '';

    return `Inconsistent translation for "${term.tibetan}". ` +
      `Used: "${term.english}", ` +
      `Expected: "${glossaryEntry.canonical}" ` +
      `(used ${glossaryEntry.translations[0].count}x in document${variantInfo}).`;
  }

  /**
   * Enhances a translation prompt with glossary context
   * This helps the AI use consistent terminology
   */
  public enhancePromptWithGlossary(
    basePrompt: string,
    glossary: GlossaryBuilder,
    maxTerms: number = 30
  ): string {
    const glossaryText = glossary.getGlossaryForPrompt(maxTerms);

    if (!glossaryText) {
      return basePrompt;
    }

    // Insert glossary before the translation instructions
    const glossarySection = `
## Document-Specific Terminology

The following terms have been used consistently in previous pages of this document.
Please use these same translations to maintain consistency:

${glossaryText}

**IMPORTANT**: When you encounter these Tibetan terms, use the translations shown above.
Consistency in terminology is crucial for this document.

---

`;

    return glossarySection + basePrompt;
  }

  /**
   * Generates a consistency report for a document
   */
  public generateConsistencyReport(
    glossary: GlossaryBuilder,
    includeDetails: boolean = false
  ): string {
    const summary = glossary.getSummary();
    const inconsistencies = glossary.findInconsistencies();

    let report = `=== Terminology Consistency Report ===\n\n`;
    report += `Total unique terms: ${summary.totalTerms}\n`;
    report += `Total translation variants: ${summary.totalVariants}\n`;
    report += `Inconsistent terms: ${summary.inconsistentTerms}\n`;
    report += `Average occurrences per term: ${summary.averageOccurrencesPerTerm.toFixed(1)}\n\n`;

    if (inconsistencies.length > 0) {
      report += `## Inconsistencies Found (${inconsistencies.length})\n\n`;

      // Group by severity
      const high = inconsistencies.filter(i => i.severity === 'high');
      const medium = inconsistencies.filter(i => i.severity === 'medium');
      const low = inconsistencies.filter(i => i.severity === 'low');

      if (high.length > 0) {
        report += `### High Severity (${high.length})\n`;
        for (const issue of high.slice(0, 10)) {
          report += this.formatInconsistencyForReport(issue, includeDetails);
        }
        report += '\n';
      }

      if (medium.length > 0) {
        report += `### Medium Severity (${medium.length})\n`;
        for (const issue of medium.slice(0, 5)) {
          report += this.formatInconsistencyForReport(issue, includeDetails);
        }
        report += '\n';
      }

      if (low.length > 0) {
        report += `### Low Severity (${low.length})\n`;
        report += `(showing first 3)\n`;
        for (const issue of low.slice(0, 3)) {
          report += this.formatInconsistencyForReport(issue, includeDetails);
        }
      }
    } else {
      report += `✓ No significant inconsistencies found!\n`;
    }

    if (summary.mostFrequentTerms.length > 0) {
      report += `\n## Most Frequent Terms\n\n`;
      for (const term of summary.mostFrequentTerms.slice(0, 10)) {
        report += `- ${term.tibetan} → "${term.english}" (${term.count}x)\n`;
      }
    }

    return report;
  }

  /**
   * Formats an inconsistency for the report
   */
  private formatInconsistencyForReport(issue: any, includeDetails: boolean): string {
    let text = `\n**${issue.tibetan}**\n`;
    text += `  Variants:\n`;

    for (const variant of issue.translations) {
      const pages = includeDetails ? ` [pages: ${variant.pages.slice(0, 5).join(', ')}${variant.pages.length > 5 ? '...' : ''}]` : '';
      text += `  - "${variant.english}" (${variant.count}x)${pages}\n`;
    }

    text += `  ${issue.suggestion}\n`;

    return text;
  }

  /**
   * Gets statistics about consistency validation
   */
  public getValidationStats(results: ConsistencyValidationResult[]): {
    totalPages: number;
    pagesWithWarnings: number;
    totalWarnings: number;
    averageConsistencyScore: number;
    highSeverityWarnings: number;
    mediumSeverityWarnings: number;
    lowSeverityWarnings: number;
  } {
    return {
      totalPages: results.length,
      pagesWithWarnings: results.filter(r => r.warnings.length > 0).length,
      totalWarnings: results.reduce((sum, r) => sum + r.warnings.length, 0),
      averageConsistencyScore: results.reduce((sum, r) => sum + r.consistencyScore, 0) / results.length,
      highSeverityWarnings: results.reduce((sum, r) => sum + r.warnings.filter(w => w.severity === 'high').length, 0),
      mediumSeverityWarnings: results.reduce((sum, r) => sum + r.warnings.filter(w => w.severity === 'medium').length, 0),
      lowSeverityWarnings: results.reduce((sum, r) => sum + r.warnings.filter(w => w.severity === 'low').length, 0)
    };
  }
}
