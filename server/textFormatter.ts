interface TranslationChunk {
  pageNumber: number;
  translation: string;
}

/**
 * Formats the raw translation text according to specified rules
 */
export function formatTranslation(text: string): string {
  return text
    // Step 1: Standardize line endings
    .replace(/\r\n?/g, '\n')
    
    // Step 2: Handle headers
    // Only format as headers if they follow specific patterns
    .replace(/^(?:Chapter|Section|Part)\s+[\d\w]+[:\.]\s*([^\n]+)/gim, '# $1')
    .replace(/^([A-Z][^a-z\n]{2,}(?:[^a-z\n]|$))/gm, '# $1')
    
    // Step 3: Handle italicized Sanskrit terms
    // Wrap known Buddhist terms in italics, but avoid over-matching
    .replace(/\b(dharma|karma|buddha|bodhisattva|sutra|tantra|sangha)\b/gi, 
             (match) => `*${match.charAt(0).toLowerCase() + match.slice(1)}*`)
    
    // Step 4: Clean up paragraph breaks
    // Standardize to double line breaks between paragraphs
    .replace(/\n{3,}/g, '\n\n')
    // Ensure single line break after headers
    .replace(/^(#[^\n]+)\n+/gm, '$1\n')
    
    // Step 5: Handle nested lists and indentation
    .replace(/^(\s{2,})-\s/gm, '  - ')
    
    // Step 6: Clean up whitespace
    .trim()
    .replace(/[ \t]+$/gm, '');
}

/**
 * Combines multiple translation chunks while maintaining proper formatting
 */
export function combineTranslations(translations: TranslationChunk[]): string {
  // Sort chunks by page number
  const sortedTranslations = [...translations].sort((a, b) => a.pageNumber - b.pageNumber);
  
  // Process each chunk and combine
  const combinedText = sortedTranslations
    .map(chunk => {
      const formattedText = formatTranslation(chunk.translation);
      // Add page markers only if there are multiple pages
      return translations.length > 1 
        ? `\n[Page ${chunk.pageNumber}]\n\n${formattedText}`
        : formattedText;
    })
    .join('\n\n');
  
  return formatTranslation(combinedText);
}

/**
 * Processes the Gemini API response to ensure consistent formatting
 */
export function processGeminiResponse(response: string): string {
  return formatTranslation(response)
    // Remove any meta-commentary from the model
    .replace(/^(?:Translation:|Here's the translation:|Translated text:)\s*/i, '')
    // Remove any trailing notes or explanations
    .replace(/\n+(?:Note:|Notes:|Translator's note:)[\s\S]*$/, '')
    // Ensure proper spacing around parenthetical text
    .replace(/\(\s*([^)]+)\s*\)/g, '($1)');
}
