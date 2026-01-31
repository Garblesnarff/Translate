/**
 * Class responsible for enhancing spacing and formatting in Tibetan translations
 */
export class SpacingEnhancer {
  /**
   * Enhances spacing and formatting in the given text
   * @param text - The text to enhance spacing in
   * @returns The text with improved spacing and formatting
   */
  public enhance(text: string): string {
    return text
      // Remove excessive whitespace
      .replace(/[ \t]+$/gm, '')
      .replace(/^[ \t]+/gm, '')

      // Ensure proper spacing around headers
      .replace(/\n*(##[^\n]+)\n*/g, '\n\n$1\n\n')

      // Format list items with proper spacing
      .replace(/(\n\*[^\n]+)(?=\n\*)/g, '$1\n')
      .replace(/(\n\*[^\n]+)(?=\n[^*\n])/g, '$1\n\n')

      // Clean up multiple consecutive blank lines
      .replace(/\n{3,}/g, '\n\n')

      // Ensure proper paragraph spacing
      .replace(/([^\n])\n([A-Z])/g, '$1\n\n$2')

      // Clean up spacing around parenthetical translations
      .replace(/\(\s+/g, '(')
      .replace(/\s+\)/g, ')')

      // Ensure single space after punctuation
      .replace(/([.!?])\s+([A-Z])/g, '$1 $2');
  }
}
