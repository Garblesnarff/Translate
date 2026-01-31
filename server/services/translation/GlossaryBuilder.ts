/**
 * Glossary Builder Service
 *
 * Builds document-specific glossaries by aggregating terms across pages.
 * Detects inconsistencies when the same Tibetan term is translated differently.
 * Suggests canonical translations based on frequency and context.
 *
 * Key features:
 * - Aggregates terms from multiple pages
 * - Tracks all translations for each Tibetan term
 * - Detects inconsistent translations
 * - Suggests canonical (most common) translation
 * - Provides glossary context for prompts
 *
 * @author Translation Service Team
 */

import { TermPair } from './TermExtractor';

export interface GlossaryEntry {
  tibetan: string;
  translations: TranslationVariant[];
  canonical: string;
  totalOccurrences: number;
  firstSeen: number; // page number
  lastSeen: number;  // page number
  confidence: number;
}

export interface TranslationVariant {
  english: string;
  count: number;
  pages: number[];
  averageConfidence: number;
}

export interface Inconsistency {
  tibetan: string;
  translations: TranslationVariant[];
  severity: 'high' | 'medium' | 'low';
  suggestion: string;
}

export interface GlossarySummary {
  totalTerms: number;
  totalVariants: number;
  inconsistentTerms: number;
  averageOccurrencesPerTerm: number;
  mostFrequentTerms: Array<{ tibetan: string; english: string; count: number }>;
}

export class GlossaryBuilder {
  private glossary: Map<string, GlossaryEntry> = new Map();

  /**
   * Adds term pairs to the glossary
   * Aggregates translations for each Tibetan term
   */
  public addTermPairs(pairs: TermPair[]): void {
    for (const pair of pairs) {
      this.addTermPair(pair);
    }

    console.log(`[GlossaryBuilder] Added ${pairs.length} term pairs. Glossary now has ${this.glossary.size} unique terms`);
  }

  /**
   * Adds a single term pair to the glossary
   */
  private addTermPair(pair: TermPair): void {
    const { tibetan, english, pageNumber, confidence } = pair;

    // Normalize Tibetan text (trim, normalize spaces)
    const normalizedTibetan = tibetan.trim().replace(/\s+/g, ' ');
    const normalizedEnglish = english.trim().replace(/\s+/g, ' ');

    if (!this.glossary.has(normalizedTibetan)) {
      // New term
      this.glossary.set(normalizedTibetan, {
        tibetan: normalizedTibetan,
        translations: [{
          english: normalizedEnglish,
          count: 1,
          pages: [pageNumber],
          averageConfidence: confidence
        }],
        canonical: normalizedEnglish,
        totalOccurrences: 1,
        firstSeen: pageNumber,
        lastSeen: pageNumber,
        confidence
      });
    } else {
      // Existing term - update
      const entry = this.glossary.get(normalizedTibetan)!;
      entry.totalOccurrences++;
      entry.lastSeen = Math.max(entry.lastSeen, pageNumber);

      // Find if this English translation already exists
      const existingVariant = entry.translations.find(
        t => this.areTranslationsSimilar(t.english, normalizedEnglish)
      );

      if (existingVariant) {
        // Update existing variant
        existingVariant.count++;
        if (!existingVariant.pages.includes(pageNumber)) {
          existingVariant.pages.push(pageNumber);
        }
        // Update running average of confidence
        existingVariant.averageConfidence =
          (existingVariant.averageConfidence * (existingVariant.count - 1) + confidence) / existingVariant.count;
      } else {
        // New variant
        entry.translations.push({
          english: normalizedEnglish,
          count: 1,
          pages: [pageNumber],
          averageConfidence: confidence
        });
      }

      // Update canonical translation (most frequent)
      entry.canonical = this.determineCanonical(entry.translations);

      // Update overall confidence (weighted average)
      entry.confidence = this.calculateEntryConfidence(entry);
    }
  }

  /**
   * Determines if two translations are similar enough to be considered the same
   * Handles minor variations like capitalization, punctuation
   */
  private areTranslationsSimilar(trans1: string, trans2: string): boolean {
    // Normalize for comparison
    const normalize = (s: string) =>
      s.toLowerCase().replace(/[.,!?;:]/g, '').trim();

    const norm1 = normalize(trans1);
    const norm2 = normalize(trans2);

    // Exact match after normalization
    if (norm1 === norm2) {
      return true;
    }

    // Check if one is a subset of the other (e.g., "Lama" vs "the Lama")
    if (norm1.includes(norm2) || norm2.includes(norm1)) {
      return true;
    }

    return false;
  }

  /**
   * Determines the canonical (preferred) translation
   * Uses most frequent translation, with ties broken by confidence
   */
  private determineCanonical(variants: TranslationVariant[]): string {
    if (variants.length === 0) {
      return '';
    }

    // Sort by count (descending), then by confidence (descending)
    const sorted = [...variants].sort((a, b) => {
      if (b.count !== a.count) {
        return b.count - a.count;
      }
      return b.averageConfidence - a.averageConfidence;
    });

    return sorted[0].english;
  }

  /**
   * Calculates overall confidence for a glossary entry
   * Weighted by occurrence count and variant confidence
   */
  private calculateEntryConfidence(entry: GlossaryEntry): number {
    let totalWeight = 0;
    let weightedSum = 0;

    for (const variant of entry.translations) {
      const weight = variant.count;
      weightedSum += variant.averageConfidence * weight;
      totalWeight += weight;
    }

    return totalWeight > 0 ? weightedSum / totalWeight : 0.5;
  }

  /**
   * Finds inconsistencies where the same Tibetan term is translated differently
   */
  public findInconsistencies(): Inconsistency[] {
    const inconsistencies: Inconsistency[] = [];

    for (const [tibetan, entry] of this.glossary.entries()) {
      // Check if term has multiple significantly different translations
      if (entry.translations.length > 1) {
        // Filter to significant variants (not just minor variations)
        const significantVariants = entry.translations.filter(v => v.count >= 2);

        if (significantVariants.length > 1) {
          // Calculate severity based on:
          // - Number of variants
          // - Distribution of usage (is one dominant or split evenly?)
          const severity = this.calculateInconsistencySeverity(entry);

          inconsistencies.push({
            tibetan,
            translations: entry.translations,
            severity,
            suggestion: `Consider using "${entry.canonical}" consistently throughout the document.`
          });
        }
      }
    }

    // Sort by severity
    inconsistencies.sort((a, b) => {
      const severityOrder = { high: 3, medium: 2, low: 1 };
      return severityOrder[b.severity] - severityOrder[a.severity];
    });

    console.log(`[GlossaryBuilder] Found ${inconsistencies.length} inconsistent terms`);
    return inconsistencies;
  }

  /**
   * Calculates severity of inconsistency
   */
  private calculateInconsistencySeverity(entry: GlossaryEntry): 'high' | 'medium' | 'low' {
    const variants = entry.translations.length;
    const totalOccurrences = entry.totalOccurrences;

    // Calculate entropy (how evenly distributed are the variants?)
    let entropy = 0;
    for (const variant of entry.translations) {
      const probability = variant.count / totalOccurrences;
      if (probability > 0) {
        entropy -= probability * Math.log2(probability);
      }
    }

    // High entropy = more evenly distributed = more severe inconsistency
    const maxEntropy = Math.log2(variants);
    const normalizedEntropy = maxEntropy > 0 ? entropy / maxEntropy : 0;

    // High severity: many variants, evenly distributed, frequent term
    if (variants >= 4 || (variants >= 3 && normalizedEntropy > 0.7) || (totalOccurrences > 10 && normalizedEntropy > 0.5)) {
      return 'high';
    }

    // Medium severity: some variants, moderately distributed
    if (variants >= 3 || (variants === 2 && normalizedEntropy > 0.8)) {
      return 'medium';
    }

    // Low severity: few variants, one dominant
    return 'low';
  }

  /**
   * Gets the canonical (most common) translation for a Tibetan term
   */
  public getCanonicalTranslation(tibetan: string): string | null {
    const normalized = tibetan.trim().replace(/\s+/g, ' ');
    const entry = this.glossary.get(normalized);
    return entry ? entry.canonical : null;
  }

  /**
   * Gets a full glossary entry for a Tibetan term
   */
  public getEntry(tibetan: string): GlossaryEntry | null {
    const normalized = tibetan.trim().replace(/\s+/g, ' ');
    return this.glossary.get(normalized) || null;
  }

  /**
   * Gets all glossary entries
   */
  public getAllEntries(): GlossaryEntry[] {
    return Array.from(this.glossary.values());
  }

  /**
   * Gets glossary formatted for inclusion in translation prompts
   * Returns top N most relevant terms
   */
  public getGlossaryForPrompt(maxTerms: number = 30): string {
    // Get all entries sorted by relevance (frequency * confidence)
    const entries = Array.from(this.glossary.values()).sort((a, b) => {
      const scoreA = a.totalOccurrences * a.confidence;
      const scoreB = b.totalOccurrences * b.confidence;
      return scoreB - scoreA;
    });

    // Take top N terms
    const topTerms = entries.slice(0, maxTerms);

    if (topTerms.length === 0) {
      return '';
    }

    // Format as glossary
    const glossaryLines = topTerms.map(entry => {
      const variants = entry.translations.length > 1
        ? ` (also: ${entry.translations.slice(1, 3).map(t => t.english).join(', ')})`
        : '';
      return `- ${entry.tibetan} → ${entry.canonical}${variants}`;
    });

    return `Document Glossary (established translations):\n${glossaryLines.join('\n')}`;
  }

  /**
   * Gets a summary of the glossary
   */
  public getSummary(): GlossarySummary {
    const entries = Array.from(this.glossary.values());
    const totalVariants = entries.reduce((sum, e) => sum + e.translations.length, 0);
    const inconsistentTerms = entries.filter(e => e.translations.length > 1).length;
    const totalOccurrences = entries.reduce((sum, e) => sum + e.totalOccurrences, 0);

    // Get top 10 most frequent terms
    const mostFrequent = entries
      .sort((a, b) => b.totalOccurrences - a.totalOccurrences)
      .slice(0, 10)
      .map(e => ({
        tibetan: e.tibetan,
        english: e.canonical,
        count: e.totalOccurrences
      }));

    return {
      totalTerms: entries.length,
      totalVariants,
      inconsistentTerms,
      averageOccurrencesPerTerm: entries.length > 0 ? totalOccurrences / entries.length : 0,
      mostFrequentTerms: mostFrequent
    };
  }

  /**
   * Clears the glossary
   */
  public clear(): void {
    this.glossary.clear();
    console.log(`[GlossaryBuilder] Glossary cleared`);
  }

  /**
   * Exports glossary to JSON format for storage
   */
  public exportToJSON(): string {
    const entries = Array.from(this.glossary.values());
    return JSON.stringify(entries, null, 2);
  }

  /**
   * Imports glossary from JSON format
   */
  public importFromJSON(json: string): void {
    try {
      const entries = JSON.parse(json) as GlossaryEntry[];
      this.glossary.clear();

      for (const entry of entries) {
        this.glossary.set(entry.tibetan, entry);
      }

      console.log(`[GlossaryBuilder] Imported ${entries.length} glossary entries`);
    } catch (error) {
      console.error(`[GlossaryBuilder] Failed to import glossary:`, error);
      throw new Error('Invalid glossary JSON format');
    }
  }

  /**
   * Merges another glossary into this one
   * Useful for combining glossaries from multiple documents
   */
  public merge(other: GlossaryBuilder): void {
    for (const entry of other.getAllEntries()) {
      // Convert entry back to term pairs and add them
      for (const variant of entry.translations) {
        for (const page of variant.pages) {
          this.addTermPair({
            tibetan: entry.tibetan,
            english: variant.english,
            context: '',
            pageNumber: page,
            confidence: variant.averageConfidence
          });
        }
      }
    }

    console.log(`[GlossaryBuilder] Merged glossaries. Now has ${this.glossary.size} unique terms`);
  }
}
