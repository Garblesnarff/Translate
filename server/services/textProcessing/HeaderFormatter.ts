/**
 * Class responsible for formatting section headers in Tibetan translations
 */
export class HeaderFormatter {
  /**
   * Formats headers in the given text according to standardized rules
   * @param text - The text to format headers in
   * @returns The text with properly formatted headers
   */
  public format(text: string): string {
    // First clean up any existing malformed headers
    let processed = text.replace(/#{2,}\s*([^#\n]+)#{2,}/g, '## $1');

    // Format section headers consistently
    processed = processed.replace(
      /^(?:##\s*)?([A-Z][^.!?\n]+(?:Lineage|Vows|Empowerment|Teachings|Activities)[^.!?\n]*):?\s*$/gm,
      '\n## $1\n'
    );

    // Clean up multiple consecutive newlines around headers
    processed = processed.replace(/\n{3,}##/g, '\n\n##');
    processed = processed.replace(/##([^\n]+)\n{3,}/g, '## $1\n\n');

    return processed;
  }
}
