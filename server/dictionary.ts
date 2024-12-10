interface DictionaryEntry {
  tibetan: string;
  english: string;
  context?: string;
  category?: "term" | "name" | "title" | "place";
}

export class TibetanDictionary {
  private entries: DictionaryEntry[] = [
    // Core Buddhist terms
    { tibetan: "ཆོས", english: "Dharma", context: "Buddhist teachings", category: "term" },
    { tibetan: "སངས་རྒྱས", english: "Buddha", context: "Enlightened One", category: "term" },
    { tibetan: "དགེ་འདུན", english: "Sangha", context: "Buddhist community", category: "term" },
    { tibetan: "ལས", english: "Karma", context: "Action and its results", category: "term" },
    { tibetan: "རྡོ་རྗེ", english: "Vajra", context: "Diamond-like, indestructible", category: "term" },
    
    // Common titles
    { tibetan: "རིན་པོ་ཆེ", english: "Rinpoche", context: "Precious One", category: "title" },
    { tibetan: "བླ་མ", english: "Lama", context: "Spiritual teacher", category: "title" },
    { tibetan: "དགེ་བཤེས", english: "Geshe", context: "Learned One", category: "title" },
    { tibetan: "མཁན་པོ", english: "Khenpo", context: "Preceptor", category: "title" },
    
    // Important concepts
    { tibetan: "བྱང་ཆུབ་སེམས", english: "Bodhicitta", context: "Enlightened mind", category: "term" },
    { tibetan: "སྟོང་པ་ཉིད", english: "Śūnyatā", context: "Emptiness", category: "term" },
    { tibetan: "སྙིང་རྗེ", english: "Karuṇā", context: "Compassion", category: "term" }
  ];

  public getEntries(): DictionaryEntry[] {
    return this.entries;
  }

  public addEntry(entry: DictionaryEntry): void {
    this.entries.push(entry);
  }

  public lookupTibetan(tibetanWord: string): DictionaryEntry | undefined {
    return this.entries.find(entry => entry.tibetan === tibetanWord);
  }

  public lookupEnglish(englishWord: string): DictionaryEntry | undefined {
    return this.entries.find(entry => 
      entry.english.toLowerCase() === englishWord.toLowerCase()
    );
  }

  public getDictionaryContext(): string {
    // Generate a formatted context string for the LLM
    const termsList = this.entries
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
}
