import pg from 'pg';
import { z } from 'zod';
const { Pool } = pg;

export interface DictionaryEntry {
  tibetan: string;
  english: string;
  context: string;
  category: string;
}

const dictionarySchema = z.object({
  tibetan: z.string(),
  english: z.string(),
  context: z.string(),
  category: z.string()
});

export class TibetanDictionary {
  private pool: pg.Pool;

  constructor() {
    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL
    });
    this.initializeDatabase().catch(console.error);
  }

  private async initializeDatabase(): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS dictionary_entries (
          id SERIAL PRIMARY KEY,
          tibetan TEXT NOT NULL,
          english TEXT NOT NULL,
          context TEXT NOT NULL,
          category TEXT NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
        
        CREATE INDEX IF NOT EXISTS idx_dictionary_tibetan ON dictionary_entries(tibetan);
        CREATE INDEX IF NOT EXISTS idx_dictionary_english ON dictionary_entries(english);
      `);
    } finally {
      client.release();
    }
  }

  public async addEntries(entries: DictionaryEntry[]): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      for (const entry of entries) {
        const validatedEntry = dictionarySchema.parse(entry);
        await client.query(
          `INSERT INTO dictionary_entries (tibetan, english, context, category)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (tibetan) DO UPDATE
           SET english = $2, context = $3, category = $4`,
          [validatedEntry.tibetan, validatedEntry.english, validatedEntry.context, validatedEntry.category]
        );
      }

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  private async findSimilarTerms(tibetan: string): Promise<DictionaryEntry[]> {
    const client = await this.pool.connect();
    try {
      // Find exact matches and common variations
      const result = await client.query(
        `SELECT tibetan, english, context, category 
         FROM dictionary_entries 
         WHERE tibetan = $1
         OR tibetan LIKE $2
         OR $1 LIKE CONCAT('%', tibetan, '%')
         ORDER BY CASE 
           WHEN tibetan = $1 THEN 0
           WHEN tibetan LIKE $2 THEN 1
           ELSE 2
         END`,
        [tibetan, `%${tibetan}%`]
      );
      return result.rows;
    } finally {
      client.release();
    }
  }

  public async getDictionaryContext(): Promise<string> {
    const client = await this.pool.connect();
    try {
      const result = await client.query(
        `SELECT tibetan, english, context, category,
         COUNT(*) OVER (PARTITION BY category) as category_count
         FROM dictionary_entries 
         ORDER BY category, 
         (SELECT COUNT(*) FROM dictionary_entries de2 
          WHERE de2.english = dictionary_entries.english) DESC,
         tibetan`
      );

      if (result.rows.length === 0) {
        return "No dictionary entries available.";
      }

      const entriesByCategory = result.rows.reduce<Record<string, DictionaryEntry[]>>((acc, entry) => {
        if (!acc[entry.category]) {
          acc[entry.category] = [];
        }
        acc[entry.category].push(entry);
        return acc;
      }, {});

      let context = "DICTIONARY REFERENCE:\n\n";
      
      for (const [category, entries] of Object.entries(entriesByCategory)) {
        context += `${category.toUpperCase()}:\n`;
        for (const entry of entries) {
          // Include frequency information for common terms
          const frequencyNote = entries.length > 1 ? " [Common term]" : "";
          context += `- ${entry.tibetan}: ${entry.english} (${entry.context})${frequencyNote}\n`;
        }
        context += '\n';
      }

      return context;
    } finally {
      client.release();
    }
  }

  public async suggestNewTerms(text: string): Promise<DictionaryEntry[]> {
    const client = await this.pool.connect();
    try {
      // Extract potential Tibetan terms (basic implementation)
      const terms = text.match(/[\u0F00-\u0FFF]+/g) || [];
      const suggestions: DictionaryEntry[] = [];

      for (const term of terms) {
        // Check if term exists
        const existing = await this.findSimilarTerms(term);
        if (existing.length === 0) {
          suggestions.push({
            tibetan: term,
            english: "", // To be filled by LLM
            context: "Suggested new term",
            category: "suggested"
          });
        }
      }

      return suggestions;
    } finally {
      client.release();
    }
  }

  public async initializeDefaultDictionary(): Promise<void> {
    const defaultEntries: DictionaryEntry[] = [
      { tibetan: "བྱང་ཆུབ་སེམས་དཔའ", english: "Bodhisattva", context: "Enlightened being", category: "term" },
      { tibetan: "ཆོས", english: "Dharma", context: "Buddhist teachings", category: "term" },
      { tibetan: "སངས་རྒྱས", english: "Buddha", context: "Awakened One", category: "term" },
      { tibetan: "དགེ་བ", english: "virtue", context: "positive action", category: "term" },
      { tibetan: "སྡིག་པ", english: "non-virtue", context: "negative action", category: "term" },
      { tibetan: "བླ་མ", english: "Lama", context: "spiritual teacher", category: "title" },
      { tibetan: "རིན་པོ་ཆེ", english: "Rinpoche", context: "Precious One", category: "title" },
      { tibetan: "མཁན་པོ", english: "Khenpo", context: "Abbot", category: "title" },
      { tibetan: "དགེ་བཤེས", english: "Geshe", context: "Learned One", category: "title" },
      { tibetan: "སྒྲུབ་པ", english: "practice", context: "spiritual practice", category: "term" },
      { tibetan: "ཐེག་པ", english: "vehicle", context: "spiritual path", category: "term" },
      { tibetan: "དགོན་པ", english: "monastery", context: "Buddhist institution", category: "place" }
    ];

    try {
      await this.addEntries(defaultEntries);
      console.log("Successfully initialized default dictionary entries");
    } catch (error) {
      console.error("Failed to initialize default dictionary:", error);
      throw error;
    }
  }
}