import pg from 'pg';
import { z } from 'zod';
const { Pool } = pg;

interface DictionaryEntry {
  tibetan: string;
  english: string;
  context?: string;
  category?: "term" | "name" | "title" | "place";
}

const dictionaryEntrySchema = z.object({
  tibetan: z.string(),
  english: z.string(),
  context: z.string().optional(),
  category: z.enum(["term", "name", "title", "place"]).optional()
});

export class TibetanDictionary {
  private pool: Pool;
  private entriesCache: Map<string, DictionaryEntry> = new Map();
  private lastCacheUpdate: number = 0;
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  constructor() {
    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: {
        rejectUnauthorized: false
      }
    });
  }

  private async refreshCache(): Promise<void> {
    const now = Date.now();
    if (now - this.lastCacheUpdate < this.CACHE_TTL && this.entriesCache.size > 0) {
      return;
    }

    const { rows } = await this.pool.query(
      'SELECT tibetan, english, context, category FROM dictionary_entries'
    );
    
    this.entriesCache.clear();
    rows.forEach((row: any) => {
      this.entriesCache.set(row.tibetan, row);
    });
    
    this.lastCacheUpdate = now;
  }

  public async getEntries(): Promise<DictionaryEntry[]> {
    await this.refreshCache();
    return Array.from(this.entriesCache.values());
  }

  public async addEntry(entry: DictionaryEntry): Promise<void> {
    try {
      const validatedEntry = dictionaryEntrySchema.parse(entry);
      await this.pool.query(
        'INSERT INTO dictionary_entries (tibetan, english, context, category) VALUES ($1, $2, $3, $4)',
        [validatedEntry.tibetan, validatedEntry.english, validatedEntry.context, validatedEntry.category]
      );
      this.entriesCache.set(entry.tibetan, entry);
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to add dictionary entry: ${error.message}`);
      }
      throw error;
    }
  }

  public async addEntries(entries: DictionaryEntry[]): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      
      for (const entry of entries) {
        const validatedEntry = dictionaryEntrySchema.parse(entry);
        await client.query(
          'INSERT INTO dictionary_entries (tibetan, english, context, category) VALUES ($1, $2, $3, $4) ON CONFLICT (tibetan) DO UPDATE SET english = $2, context = $3, category = $4',
          [validatedEntry.tibetan, validatedEntry.english, validatedEntry.context, validatedEntry.category]
        );
      }
      
      await client.query('COMMIT');
      this.lastCacheUpdate = 0; // Force cache refresh on next get
    } catch (error) {
      await client.query('ROLLBACK');
      if (error instanceof Error) {
        throw new Error(`Failed to add dictionary entries: ${error.message}`);
      }
      throw error;
    } finally {
      client.release();
    }
  }

  public async lookupTibetan(tibetanWord: string): Promise<DictionaryEntry | undefined> {
    await this.refreshCache();
    return this.entriesCache.get(tibetanWord);
  }

  public async lookupEnglish(englishWord: string): Promise<DictionaryEntry | undefined> {
    await this.refreshCache();
    const lowerEnglish = englishWord.toLowerCase();
    return Array.from(this.entriesCache.values()).find(
      entry => entry.english.toLowerCase() === lowerEnglish
    );
  }

  public async getDictionaryContext(): Promise<string> {
    const entries = await this.getEntries();
    const termsList = entries
      .map(entry => `${entry.tibetan} = ${entry.english}${entry.context ? ` (${entry.context})` : ''}`)
      .join('\n');

    return `
TIBETAN-ENGLISH DICTIONARY REFERENCE:
The following Tibetan terms should be translated consistently:

${termsList}

When encountering these terms in the text:
1. Use the provided English translations consistently
2. Preserve the original Tibetan in parentheses on first use
3. For titles and names, follow the format: English (Tibetan)
4. Maintain any provided context or special meanings
`;
  }

  public async importFromPDF(pdfBuffer: Buffer): Promise<void> {
    const pdf = await import('pdf-parse').then(module => module.default);
    try {
      const data = await pdf(pdfBuffer);
      const text = data.text;
      
      // Simple pattern matching for dictionary entries
      // Assumes format: "Tibetan_Word = English_Translation (context)"
      const entries: DictionaryEntry[] = [];
      const lines = text.split('\n');
      
      for (const line of lines) {
        const match = line.match(/^([\u0F00-\u0FFF\s]+)\s*=\s*([^(]+)(?:\s*\(([^)]+)\))?$/);
        if (match) {
          const [, tibetan, english, context] = match;
          entries.push({
            tibetan: tibetan.trim(),
            english: english.trim(),
            context: context?.trim(),
            category: 'term' // Default category, could be improved with better parsing
          });
        }
      }

      if (entries.length > 0) {
        await this.addEntries(entries);
        console.log(`Imported ${entries.length} dictionary entries from PDF`);
      } else {
        throw new Error('No valid dictionary entries found in PDF');
      }
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to import PDF dictionary: ${error.message}`);
      }
      throw error;
    }
  }
}
