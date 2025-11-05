/**
 * FeedbackProcessor - Learning from human corrections
 *
 * Features:
 * - Collect and store human corrections
 * - Analyze correction patterns
 * - Extract learnings for dictionary and examples
 */

import { db } from '@db/index';
import { getTables } from '@db/config';

export interface TranslationCorrection {
  translationId: number;
  reviewItemId?: string;
  originalText: string;
  correctedText: string;
  correctionType: 'terminology' | 'grammar' | 'accuracy' | 'formatting';
  correctedBy?: string;
  correctionReason?: string;
  extractedTerms?: { tibetan: string; english: string }[];
}

export interface CorrectionPattern {
  pattern: string;
  frequency: number;
  examples: string[];
  suggestedImprovement: string;
}

export class FeedbackProcessor {
  private tables: any;

  constructor() {
    this.tables = getTables();
  }

  /**
   * Record a human correction
   */
  async recordCorrection(correction: TranslationCorrection): Promise<void> {
    try {
      await db.insert(this.tables.translationCorrections).values({
        translationId: correction.translationId,
        reviewItemId: correction.reviewItemId,
        originalText: correction.originalText,
        correctedText: correction.correctedText,
        correctionType: correction.correctionType,
        correctedBy: correction.correctedBy,
        correctionReason: correction.correctionReason,
        extractedTerms: correction.extractedTerms ? JSON.stringify(correction.extractedTerms) : null,
        appliedToDictionary: 0,
        createdAt: new Date()
      });

      console.log('✓ Correction recorded');
    } catch (error) {
      console.error('Failed to record correction:', error);
      throw error;
    }
  }

  /**
   * Extract term pairs from correction
   * Compares original and corrected to find terminology changes
   */
  extractTermChanges(original: string, corrected: string): { tibetan: string; english: string }[] {
    const terms: { tibetan: string; english: string }[] = [];

    // Simple pattern matching for Tibetan in parentheses
    const tibetanPattern = /([^()]+)\s*\(([^\)]*[\u0F00-\u0FFF][^\)]*)\)/g;

    const originalMatches = [...original.matchAll(tibetanPattern)];
    const correctedMatches = [...corrected.matchAll(tibetanPattern)];

    // Find terms that changed between original and corrected
    correctedMatches.forEach(corrMatch => {
      const tibetan = corrMatch[2].trim();
      const englishCorrected = corrMatch[1].trim();

      // Find matching Tibetan in original
      const origMatch = originalMatches.find(om => om[2].trim() === tibetan);
      if (origMatch) {
        const englishOriginal = origMatch[1].trim();

        // If English translation changed, record it
        if (englishOriginal !== englishCorrected) {
          terms.push({ tibetan, english: englishCorrected });
        }
      }
    });

    return terms;
  }

  /**
   * Analyze correction patterns across multiple corrections
   */
  async analyzeCorrectionPatterns(
    startDate?: Date,
    endDate?: Date
  ): Promise<CorrectionPattern[]> {
    try {
      let query = db.select().from(this.tables.translationCorrections);

      if (startDate && endDate) {
        query = query.where((table: any) => {
          return table.createdAt.gte(startDate).and(table.createdAt.lte(endDate));
        });
      }

      const corrections = await query;

      // Group by correction type
      const patternMap = new Map<string, CorrectionPattern>();

      corrections.forEach((correction: any) => {
        const key = correction.correctionType;

        if (!patternMap.has(key)) {
          patternMap.set(key, {
            pattern: key,
            frequency: 0,
            examples: [],
            suggestedImprovement: this.getSuggestedImprovement(key)
          });
        }

        const pattern = patternMap.get(key)!;
        pattern.frequency++;

        // Store example (limit to 5 per pattern)
        if (pattern.examples.length < 5) {
          pattern.examples.push(`${correction.originalText} → ${correction.correctedText}`);
        }
      });

      return Array.from(patternMap.values())
        .sort((a, b) => b.frequency - a.frequency);
    } catch (error) {
      console.error('Failed to analyze correction patterns:', error);
      return [];
    }
  }

  /**
   * Get suggested improvement based on correction type
   */
  private getSuggestedImprovement(correctionType: string): string {
    const improvements: Record<string, string> = {
      terminology: 'Add corrected terms to dictionary for consistent future translations',
      grammar: 'Review grammar rules in post-processing phase',
      accuracy: 'Improve translation model prompts or use better examples',
      formatting: 'Strengthen format validation and correction rules'
    };

    return improvements[correctionType] || 'Review and improve translation pipeline';
  }

  /**
   * Get corrections by type
   */
  async getCorrectionsByType(
    correctionType: 'terminology' | 'grammar' | 'accuracy' | 'formatting',
    limit: number = 50
  ): Promise<any[]> {
    try {
      const corrections = await db
        .select()
        .from(this.tables.translationCorrections)
        .where((table: any) => table.correctionType.eq(correctionType))
        .orderBy((table: any) => table.createdAt.desc())
        .limit(limit);

      return corrections;
    } catch (error) {
      console.error('Failed to get corrections by type:', error);
      return [];
    }
  }

  /**
   * Get terminology corrections that haven't been applied to dictionary
   */
  async getUnappliedTerminologyCorrections(): Promise<any[]> {
    try {
      const corrections = await db
        .select()
        .from(this.tables.translationCorrections)
        .where((table: any) => {
          return table.correctionType.eq('terminology')
            .and(table.appliedToDictionary.eq(0))
            .and(table.extractedTerms.isNotNull());
        });

      return corrections.map((c: any) => ({
        ...c,
        extractedTerms: c.extractedTerms ? JSON.parse(c.extractedTerms) : []
      }));
    } catch (error) {
      console.error('Failed to get unapplied corrections:', error);
      return [];
    }
  }

  /**
   * Mark correction as applied to dictionary
   */
  async markCorrectionApplied(correctionId: number): Promise<void> {
    try {
      await db
        .update(this.tables.translationCorrections)
        .set({ appliedToDictionary: 1 })
        .where((table: any) => table.id.eq(correctionId));
    } catch (error) {
      console.error('Failed to mark correction as applied:', error);
      throw error;
    }
  }

  /**
   * Get correction statistics
   */
  async getCorrectionStats(startDate?: Date, endDate?: Date): Promise<{
    total: number;
    byType: Record<string, number>;
    appliedToDictionary: number;
    averageCorrectionsPerDay: number;
  }> {
    try {
      let query = db.select().from(this.tables.translationCorrections);

      if (startDate && endDate) {
        query = query.where((table: any) => {
          return table.createdAt.gte(startDate).and(table.createdAt.lte(endDate));
        });
      }

      const corrections = await query;

      const byType: Record<string, number> = {
        terminology: 0,
        grammar: 0,
        accuracy: 0,
        formatting: 0
      };

      let appliedToDictionary = 0;

      corrections.forEach((c: any) => {
        byType[c.correctionType] = (byType[c.correctionType] || 0) + 1;
        if (c.appliedToDictionary === 1) {
          appliedToDictionary++;
        }
      });

      let averageCorrectionsPerDay = 0;
      if (startDate && endDate) {
        const days = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
        averageCorrectionsPerDay = corrections.length / days;
      }

      return {
        total: corrections.length,
        byType,
        appliedToDictionary,
        averageCorrectionsPerDay
      };
    } catch (error) {
      console.error('Failed to get correction stats:', error);
      return {
        total: 0,
        byType: {},
        appliedToDictionary: 0,
        averageCorrectionsPerDay: 0
      };
    }
  }
}
