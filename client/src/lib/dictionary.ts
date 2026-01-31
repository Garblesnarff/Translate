interface DictionaryEntry {
  tibetan: string;
  english: string;
  context?: string;
}

class TibetanDictionary {
  private dictionary: Map<string, DictionaryEntry>;

  constructor() {
    this.dictionary = new Map();
  }

  addEntry(entry: DictionaryEntry) {
    this.dictionary.set(entry.tibetan, entry);
  }

  lookup(word: string): DictionaryEntry | undefined {
    return this.dictionary.get(word);
  }

  async loadDictionary() {
    const response = await fetch('/api/dictionary');
    const entries = await response.json();
    entries.forEach((entry: DictionaryEntry) => {
      this.addEntry(entry);
    });
  }
}

export const dictionary = new TibetanDictionary();
