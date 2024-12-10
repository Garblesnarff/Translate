interface TextChunk {
  pageNumber: number;
  content: string;
}

export function splitTextIntoChunks(text: string): TextChunk[] {
  // Handle empty or whitespace-only text
  if (!text || !text.trim()) {
    return [];
  }

  // First try to split by numbered paragraphs
  const chunks = text.split(/(?=^\s*\d+\s+)/m);
  const numberedChunks = chunks
    .map((chunk, index) => {
      const pageMatch = chunk.match(/^\s*(\d+)\s+/);
      if (!pageMatch) return null;
      
      const pageNumber = parseInt(pageMatch[1]);
      const content = chunk.replace(/^\s*\d+\s+/, '').trim();
      
      if (!content) return null;
      
      return {
        pageNumber,
        content
      };
    })
    .filter((chunk): chunk is TextChunk => chunk !== null);

  // If we found numbered chunks, return them
  if (numberedChunks.length > 0) {
    return numberedChunks;
  }

  // Otherwise, treat the entire text as a single chunk
  const trimmedText = text.trim();
  if (trimmedText) {
    return [{
      pageNumber: 1,
      content: trimmedText
    }];
  }

  return [];
}

export function combineTranslations(translations: { pageNumber: number; translation: string }[]): string {
  return translations
    .sort((a, b) => a.pageNumber - b.pageNumber)
    .map(({ translation }) => translation)
    .join('\n\n');
}
