import { db } from '@db/index';
import { getTables } from '@db/config';
import { z } from 'zod';

export interface DictionaryEntry {
  tibetan: string;
  english: string;
  context?: string;
}

const dictionarySchema = z.object({
  tibetan: z.string(),
  english: z.string(),
  context: z.string().optional()
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
    const defaultEntries: DictionaryEntry[] = [
      { tibetan: "བྱང་ཆུབ་སེམས་དཔའ", english: "Bodhisattva", context: "Enlightened being" },
      { tibetan: "ཆོས", english: "Dharma", context: "Buddhist teachings" },
      { tibetan: "སངས་རྒྱས", english: "Buddha", context: "Awakened One" },
      { tibetan: "དགེ་བ", english: "virtue", context: "positive action" },
      { tibetan: "སྡིག་པ", english: "non-virtue", context: "negative action" },
      { tibetan: "བླ་མ", english: "Lama", context: "spiritual teacher" },
      { tibetan: "རིན་པོ་ཆེ", english: "Rinpoche", context: "Precious One" },
      { tibetan: "མཁན་པོ", english: "Khenpo", context: "Abbot" },
      { tibetan: "དགེ་བཤེས", english: "Geshe", context: "Learned One" },
      { tibetan: "སྒྲུབ་པ", english: "practice", context: "spiritual practice" },
      { tibetan: "ཐེག་པ", english: "vehicle", context: "spiritual path" },
      { tibetan: "དགོན་པ", english: "monastery", context: "Buddhist institution" }
    ];

    try {
      await this.addEntries(defaultEntries);
      console.log("✅ Successfully initialized default dictionary entries");
    } catch (error) {
      console.error("❌ Failed to initialize default dictionary:", error);
      // Don't throw here - dictionary can work without defaults
    }
  }
}