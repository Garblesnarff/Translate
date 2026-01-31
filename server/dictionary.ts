import { db } from '@db/index';
import { getTables } from '@db/config';
import { z } from 'zod';
import { readFileSync } from 'fs';
import { join } from 'path';

export interface DictionaryEntry {
  tibetan: string;
  english: string;
  context?: string;
}

export interface ExtendedDictionaryEntry extends DictionaryEntry {
  wylie?: string;
  alternateTranslations?: string[];
  sanskrit?: string | null;
  category?: string;
  usage?: string;
  frequency?: 'common' | 'uncommon' | 'rare';
}

const dictionarySchema = z.object({
  tibetan: z.string(),
  english: z.string(),
  context: z.string().optional()
});

const extendedDictionarySchema = z.object({
  tibetan: z.string(),
  wylie: z.string().optional(),
  english: z.string(),
  alternateTranslations: z.array(z.string()).optional(),
  sanskrit: z.string().nullable().optional(),
  context: z.string(),
  category: z.string().optional(),
  usage: z.string().optional(),
  frequency: z.enum(['common', 'uncommon', 'rare']).optional()
});

export class TibetanDictionary {
  private tables: any;

  constructor() {
    this.tables = getTables();
    this.initializeDatabase().catch(console.error);
  }

  private async initializeDatabase(): Promise<void> {
    try {
      // Check if we have any dictionary entries, if not initialize defaults
      const existingEntries = await db.select().from(this.tables.dictionary).limit(1);
      
      if (existingEntries.length === 0) {
        await this.initializeDefaultDictionary();
      }
      
      console.log("📚 TibetanDictionary initialized");
    } catch (error) {
      console.error("Failed to initialize TibetanDictionary:", error);
    }
  }

  public async addEntries(entries: DictionaryEntry[]): Promise<void> {
    try {
      for (const entry of entries) {
        const validatedEntry = dictionarySchema.parse(entry);
        await db.insert(this.tables.dictionary).values({
          tibetan: validatedEntry.tibetan,
          english: validatedEntry.english,
          context: validatedEntry.context || ''
        });
      }
    } catch (error) {
      console.error("Failed to add dictionary entries:", error);
      throw error;
    }
  }

  public async getDictionaryContext(): Promise<string> {
    try {
      const entries = await db.select().from(this.tables.dictionary);

      if (entries.length === 0) {
        return "No dictionary entries available.";
      }

      let context = "DICTIONARY REFERENCE:\n\n";
      
      for (const entry of entries) {
        context += `- ${entry.tibetan}: ${entry.english}`;
        if (entry.context) {
          context += ` (${entry.context})`;
        }
        context += '\n';
      }

      return context;
    } catch (error) {
      console.error("Failed to get dictionary context:", error);
      return "Error loading dictionary.";
    }
  }

  public async initializeDefaultDictionary(): Promise<void> {
    const dataDir = join(__dirname, 'data');
    const jsonFiles = [
      'buddhist-terms.json',
      'sakya-terms.json',
      'philosophy-terms.json',
      'ritual-terms.json',
      'historical-terms.json'
    ];

    try {
      let totalLoaded = 0;
      for (const filename of jsonFiles) {
        const count = await this.importFromJSON(join(dataDir, filename));
        totalLoaded += count;
        console.log(`  ✓ Loaded ${count} terms from ${filename}`);
      }
      console.log(`📚 Successfully initialized dictionary with ${totalLoaded} terms`);
    } catch (error) {
      console.error("❌ Failed to initialize dictionary:", error);
      // Don't throw here - dictionary can work without all terms
    }
  }

  /**
   * Import dictionary entries from a JSON file
   */
  public async importFromJSON(filePath: string): Promise<number> {
    try {
      const fileContent = readFileSync(filePath, 'utf-8');
      const entries = JSON.parse(fileContent) as ExtendedDictionaryEntry[];

      // Validate entries
      const validatedEntries = entries.map(entry => extendedDictionarySchema.parse(entry));

      // Convert extended entries to database format (store metadata in context as JSON)
      const dbEntries: DictionaryEntry[] = validatedEntries.map(entry => ({
        tibetan: entry.tibetan,
        english: entry.english,
        context: JSON.stringify({
          wylie: entry.wylie,
          alternateTranslations: entry.alternateTranslations,
          sanskrit: entry.sanskrit,
          category: entry.category,
          usage: entry.usage,
          frequency: entry.frequency,
          originalContext: entry.context
        })
      }));

      // Batch insert efficiently
      await this.addEntries(dbEntries);
      return dbEntries.length;
    } catch (error) {
      console.error(`Failed to import from ${filePath}:`, error);
      throw error;
    }
  }

  /**
   * Search for a specific Tibetan term
   */
  public async searchTerm(tibetan: string): Promise<ExtendedDictionaryEntry | null> {
    try {
      const results = await db
        .select()
        .from(this.tables.dictionary)
        .where((table: any) => table.tibetan.eq(tibetan))
        .limit(1);

      if (results.length === 0) return null;

      const entry = results[0];
      return this.parseExtendedEntry(entry);
    } catch (error) {
      console.error("Failed to search term:", error);
      return null;
    }
  }

  /**
   * Search dictionary by English translation
   */
  public async searchByEnglish(english: string): Promise<ExtendedDictionaryEntry[]> {
    try {
      const results = await db
        .select()
        .from(this.tables.dictionary)
        .where((table: any) => table.english.like(`%${english}%`));

      return results.map((entry: any) => this.parseExtendedEntry(entry));
    } catch (error) {
      console.error("Failed to search by English:", error);
      return [];
    }
  }

  /**
   * Extract relevant dictionary terms found in input text
   * Returns terms sorted by frequency (common first)
   */
  public async extractRelevantTerms(text: string, limit: number = 20): Promise<ExtendedDictionaryEntry[]> {
    try {
      // Get all dictionary entries
      const allEntries = await db.select().from(this.tables.dictionary);

      // Find entries whose Tibetan text appears in the input
      const relevantEntries = allEntries
        .filter((entry: any) => text.includes(entry.tibetan))
        .map((entry: any) => this.parseExtendedEntry(entry))
        .sort((a: any, b: any) => {
          // Sort by frequency: common > uncommon > rare > undefined
          const freqOrder: Record<string, number> = { 'common': 0, 'uncommon': 1, 'rare': 2 };
          const aFreq = a.frequency ? freqOrder[a.frequency] ?? 3 : 3;
          const bFreq = b.frequency ? freqOrder[b.frequency] ?? 3 : 3;
          return aFreq - bFreq;
        })
        .slice(0, limit);

      return relevantEntries;
    } catch (error) {
      console.error("Failed to extract relevant terms:", error);
      return [];
    }
  }

  /**
   * Parse extended entry from database format
   */
  private parseExtendedEntry(dbEntry: any): ExtendedDictionaryEntry {
    let metadata: any = {};
    try {
      metadata = JSON.parse(dbEntry.context || '{}');
    } catch {
      metadata = { originalContext: dbEntry.context };
    }

    return {
      tibetan: dbEntry.tibetan,
      english: dbEntry.english,
      wylie: metadata.wylie,
      alternateTranslations: metadata.alternateTranslations,
      sanskrit: metadata.sanskrit,
      context: metadata.originalContext || dbEntry.context,
      category: metadata.category,
      usage: metadata.usage,
      frequency: metadata.frequency
    };
  }

  /**
   * Extract term pairs from a translation text
   * Finds patterns like "English (Tibetan)" and extracts them
   */
  public extractTermPairs(translationText: string): { tibetan: string; english: string }[] {
    const terms: { tibetan: string; english: string }[] = [];

    // Pattern: English text followed by Tibetan in parentheses
    const tibetanPattern = /([^()]+)\s*\(([^\)]*[\u0F00-\u0FFF][^\)]*)\)/g;
    const matches = [...translationText.matchAll(tibetanPattern)];

    matches.forEach(match => {
      const english = match[1].trim();
      const tibetan = match[2].trim();

      // Only include if it looks like a term (not too long)
      if (english.split(/\s+/).length <= 5 && tibetan.length > 0) {
        terms.push({ tibetan, english });
      }
    });

    return terms;
  }

  /**
   * Suggest dictionary additions from corrections
   * Returns terms that appear frequently but aren't in dictionary
   */
  public async suggestDictionaryAdditions(
    minFrequency: number = 2
  ): Promise<{
    tibetan: string;
    suggestedEnglish: string;
    frequency: number;
    confidence: 'high' | 'medium' | 'low';
  }[]> {
    try {
      // Get all corrections from database
      const corrections = await db.select().from(this.tables.translationCorrections);

      // Extract terms from corrections
      const termFrequency = new Map<string, { englishTranslations: Map<string, number>; total: number }>();

      corrections.forEach((correction: any) => {
        if (correction.extractedTerms) {
          try {
            const terms = JSON.parse(correction.extractedTerms) as { tibetan: string; english: string }[];

            terms.forEach(term => {
              if (!termFrequency.has(term.tibetan)) {
                termFrequency.set(term.tibetan, {
                  englishTranslations: new Map(),
                  total: 0
                });
              }

              const termData = termFrequency.get(term.tibetan)!;
              const count = termData.englishTranslations.get(term.english) || 0;
              termData.englishTranslations.set(term.english, count + 1);
              termData.total++;
            });
          } catch (error) {
            // Skip invalid JSON
          }
        }
      });

      // Filter by minimum frequency and check if already in dictionary
      const suggestions: {
        tibetan: string;
        suggestedEnglish: string;
        frequency: number;
        confidence: 'high' | 'medium' | 'low';
      }[] = [];

      for (const [tibetan, data] of termFrequency.entries()) {
        if (data.total >= minFrequency) {
          // Check if already in dictionary
          const existing = await this.searchTerm(tibetan);

          if (!existing) {
            // Find most common English translation
            const sortedTranslations = Array.from(data.englishTranslations.entries())
              .sort((a, b) => b[1] - a[1]);

            const suggestedEnglish = sortedTranslations[0][0];
            const maxCount = sortedTranslations[0][1];

            // Calculate confidence based on consistency
            const consistencyRatio = maxCount / data.total;
            let confidence: 'high' | 'medium' | 'low';
            if (consistencyRatio >= 0.8) {
              confidence = 'high';
            } else if (consistencyRatio >= 0.6) {
              confidence = 'medium';
            } else {
              confidence = 'low';
            }

            suggestions.push({
              tibetan,
              suggestedEnglish,
              frequency: data.total,
              confidence
            });
          }
        }
      }

      // Sort by frequency (most common first)
      return suggestions.sort((a, b) => b.frequency - a.frequency);
    } catch (error) {
      console.error('Failed to suggest dictionary additions:', error);
      return [];
    }
  }

  /**
   * Add term from correction to dictionary
   */
  public async addTermFromCorrection(
    tibetan: string,
    english: string,
    source: string = 'correction'
  ): Promise<void> {
    try {
      const entry: DictionaryEntry = {
        tibetan,
        english,
        context: JSON.stringify({
          category: 'learned',
          source,
          addedAt: new Date().toISOString()
        })
      };

      await this.addEntries([entry]);
      console.log(`✓ Added term from correction: ${tibetan} → ${english}`);
    } catch (error) {
      console.error('Failed to add term from correction:', error);
      throw error;
    }
  }
}