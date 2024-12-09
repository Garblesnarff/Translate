interface TextChunk {
  pageNumber: number;
  content: string;
}

export function splitTextIntoChunks(text: string): TextChunk[] {
  // Split text by numbers followed by whitespace at the start of a line
  const chunks = text.split(/(?=^\s*\d+\s+)/m);
  
  return chunks
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
}

export function combineTranslations(translations: { pageNumber: number; translation: string }[]): string {
  return translations
    .sort((a, b) => a.pageNumber - b.pageNumber)
    .map(({ translation }) => translation)
    .join('\n\n');
}
