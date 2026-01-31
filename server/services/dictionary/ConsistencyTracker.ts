/**
 * ConsistencyTracker (Task 2.4.2.2)
 *
 * Tracks terminology usage across translations and detects inconsistencies.
 * Helps identify when the same Tibetan term is translated differently,
 * which can indicate translation quality issues or terminology confusion.
 *
 * Features:
 * - Track all term pair occurrences
 * - Detect inconsistent translations (same Tibetan → different English)
 * - Calculate severity (low, medium, high)
 * - Suggest most common translation
 * - Provide consistency statistics
 *
 * @module server/services/dictionary/ConsistencyTracker
 */

/**
 * Term pair for tracking
 */
export interface TermPair {
  tibetan: string;
  english: string;
  confidence: number;
}

/**
 * Inconsistency report for a single Tibetan term
 */
export interface InconsistencyReport {
  tibetan: string;
  translations: string[];
  count: number;
  severity: 'low' | 'medium' | 'high';
  suggestion: string; // Most common translation
}

/**
 * Overall consistency statistics
 */
export interface ConsistencyStats {
  totalTerms: number;
  consistentTerms: number;
  inconsistentTerms: number;
  severityBreakdown: {
    low: number;
    medium: number;
    high: number;
  };
}

/**
 * Translation usage count
 */
interface TranslationCount {
  english: string;
  count: number;
}

/**
 * ConsistencyTracker monitors terminology consistency across translations.
 *
 * Algorithm:
 * 1. Add term pairs as they are encountered
 * 2. Group by Tibetan term
 * 3. Count frequency of each English translation
 * 4. Detect terms with multiple translations
 * 5. Calculate severity based on variant count
 * 6. Suggest most common translation
 *
 * Severity Levels:
 * - Low: 2 variants (minor inconsistency)
 * - Medium: 3 variants (moderate inconsistency)
 * - High: 4+ variants (major inconsistency)
 *
 * @example
 * ```typescript
 * const tracker = new ConsistencyTracker();
 *
 * // Add terms as they're translated
 * tracker.add({ tibetan: "སངས་རྒྱས", english: "Buddha", confidence: 0.9 });
 * tracker.add({ tibetan: "སངས་རྒྱས", english: "Enlightened One", confidence: 0.85 });
 *
 * // Check for inconsistencies
 * const issues = tracker.checkConsistency();
 * // [
 * //   {
 * //     tibetan: "སངས་རྒྱས",
 * //     translations: ["Buddha", "Enlightened One"],
 * //     count: 2,
 * //     severity: "low",
 * //     suggestion: "Buddha"
 * //   }
 * // ]
 *
 * // Get statistics
 * const stats = tracker.getStats();
 * // { totalTerms: 1, consistentTerms: 0, inconsistentTerms: 1, ... }
 * ```
 */
export class ConsistencyTracker {
  // Map: Tibetan term → Map of English translation → count
  private termMap: Map<string, Map<string, number>>;

  constructor() {
    this.termMap = new Map();
  }

  /**
   * Add a term pair to the tracker.
   *
   * Normalizes English text by:
   * - Trimming whitespace
   * - Collapsing multiple spaces to single space
   *
   * @param term - Term pair to track
   */
  add(term: TermPair): void {
    const tibetan = term.tibetan;
    const english = this.normalizeEnglish(term.english);

    if (!this.termMap.has(tibetan)) {
      this.termMap.set(tibetan, new Map());
    }

    const translationMap = this.termMap.get(tibetan)!;
    const currentCount = translationMap.get(english) || 0;
    translationMap.set(english, currentCount + 1);
  }

  /**
   * Normalize English text for consistent comparison.
   *
   * @param text - English text to normalize
   * @returns Normalized text
   */
  private normalizeEnglish(text: string): string {
    return text
      .trim()
      .replace(/\s+/g, ' '); // Collapse multiple spaces
  }

  /**
   * Check consistency and generate inconsistency reports.
   *
   * Reports terms that have multiple different English translations.
   * Single occurrences or identical translations are considered consistent.
   *
   * @returns Array of inconsistency reports, sorted by severity (high first)
   */
  checkConsistency(): InconsistencyReport[] {
    const reports: InconsistencyReport[] = [];

    for (const [tibetan, translationMap] of this.termMap.entries()) {
      // Get unique translations
      const translations = Array.from(translationMap.keys());

      // Only report if there are multiple different translations
      if (translations.length > 1) {
        const severity = this.calculateSeverity(translations.length);
        const suggestion = this.getMostCommon(tibetan);
        const totalCount = Array.from(translationMap.values()).reduce((sum, count) => sum + count, 0);

        reports.push({
          tibetan,
          translations,
          count: totalCount,
          severity,
          suggestion,
        });
      }
    }

    // Sort by severity (high first)
    const severityOrder = { high: 3, medium: 2, low: 1 };
    reports.sort((a, b) => severityOrder[b.severity] - severityOrder[a.severity]);

    return reports;
  }

  /**
   * Calculate severity based on number of translation variants.
   *
   * @param variantCount - Number of different translations
   * @returns Severity level
   */
  private calculateSeverity(variantCount: number): 'low' | 'medium' | 'high' {
    if (variantCount >= 4) {
      return 'high';
    } else if (variantCount === 3) {
      return 'medium';
    } else {
      return 'low'; // 2 variants
    }
  }

  /**
   * Get the most common English translation for a Tibetan term.
   *
   * If multiple translations have the same frequency, returns the first one
   * alphabetically.
   *
   * @param tibetan - Tibetan term to lookup
   * @returns Most common English translation, or empty string if not found
   */
  getMostCommon(tibetan: string): string {
    const translationMap = this.termMap.get(tibetan);

    if (!translationMap || translationMap.size === 0) {
      return '';
    }

    // Convert to array and sort by count (descending), then alphabetically
    const translations: TranslationCount[] = Array.from(translationMap.entries())
      .map(([english, count]) => ({ english, count }))
      .sort((a, b) => {
        // First by count (descending)
        if (b.count !== a.count) {
          return b.count - a.count;
        }
        // Then alphabetically (for ties)
        return a.english.localeCompare(b.english);
      });

    return translations[0].english;
  }

  /**
   * Get overall consistency statistics.
   *
   * @returns Consistency statistics
   */
  getStats(): ConsistencyStats {
    const totalTerms = this.termMap.size;
    let consistentTerms = 0;
    let inconsistentTerms = 0;
    const severityBreakdown = {
      low: 0,
      medium: 0,
      high: 0,
    };

    for (const translationMap of this.termMap.values()) {
      const variantCount = translationMap.size;

      if (variantCount === 1) {
        // Only one translation - consistent
        consistentTerms++;
      } else {
        // Multiple translations - inconsistent
        inconsistentTerms++;

        const severity = this.calculateSeverity(variantCount);
        severityBreakdown[severity]++;
      }
    }

    return {
      totalTerms,
      consistentTerms,
      inconsistentTerms,
      severityBreakdown,
    };
  }

  /**
   * Clear all tracked terms.
   *
   * Useful for starting a new analysis or resetting state.
   */
  clear(): void {
    this.termMap.clear();
  }

  /**
   * Get all Tibetan terms being tracked.
   *
   * @returns Array of unique Tibetan terms
   */
  getTrackedTerms(): string[] {
    return Array.from(this.termMap.keys());
  }

  /**
   * Get all translations for a specific Tibetan term.
   *
   * @param tibetan - Tibetan term to lookup
   * @returns Array of translation counts, sorted by frequency
   */
  getTranslations(tibetan: string): TranslationCount[] {
    const translationMap = this.termMap.get(tibetan);

    if (!translationMap) {
      return [];
    }

    return Array.from(translationMap.entries())
      .map(([english, count]) => ({ english, count }))
      .sort((a, b) => b.count - a.count);
  }

  /**
   * Get total number of term occurrences tracked.
   *
   * @returns Total count of all term pairs added
   */
  getTotalOccurrences(): number {
    let total = 0;

    for (const translationMap of this.termMap.values()) {
      for (const count of translationMap.values()) {
        total += count;
      }
    }

    return total;
  }

  /**
   * Export consistency data as JSON.
   *
   * Useful for reporting or further analysis.
   *
   * @returns JSON string representation of tracked data
   */
  exportAsJSON(): string {
    const data: Record<string, Record<string, number>> = {};

    for (const [tibetan, translationMap] of this.termMap.entries()) {
      data[tibetan] = Object.fromEntries(translationMap);
    }

    return JSON.stringify(data, null, 2);
  }

  /**
   * Import consistency data from JSON.
   *
   * @param json - JSON string to import
   */
  importFromJSON(json: string): void {
    const data = JSON.parse(json);

    this.clear();

    for (const [tibetan, translations] of Object.entries(data)) {
      const translationMap = new Map<string, number>();

      for (const [english, count] of Object.entries(translations as Record<string, number>)) {
        translationMap.set(english, count);
      }

      this.termMap.set(tibetan, translationMap);
    }
  }
}
