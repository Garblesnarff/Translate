/**
 * Class responsible for formatting lineage sections in Tibetan translations
 */
export class LineageFormatter {
  /**
   * Formats lineage sections in the given text
   * @param text - The text containing lineage sections to format
   * @returns The text with properly formatted lineage sections
   */
  public format(text: string): string {
    // Format lineage sections
    let processed = text.replace(
      /(?:^|\n)((?:##\s*)?Lineage[^:\n]*:?)([^]*?)(?=\n##|\n\n(?:[A-Z]|$)|$)/gm,
      (match, header, content) => {
        // Clean and format the lineage entries
        const entries = content
          .split('\n')
          .map((line: string) => line.trim())
          .filter(Boolean)
          .map((line: string) => {
            // Remove any existing bullet points or markers
            line = line.replace(/^[*•-]\s*/, '');
            // Handle Sanskrit/Tibetan pairs with translations
            line = line.replace(/\s*\(\s*([^)]+)\s*\)\s*$/, ' ($1)');
            // Add bullet point
            return `* ${line}`;
          });

        return `\n## ${header.replace(/^##\s*/, '').replace(/:$/, '')}\n\n${entries.join('\n')}`;
      }
    );

    // Clean up multiple consecutive newlines
    processed = processed.replace(/\n{3,}/g, '\n\n');

    return processed;
  }
}
