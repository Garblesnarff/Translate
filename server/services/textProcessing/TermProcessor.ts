import { BuddhistTerm } from './types';
import { PRESERVED_TERMS, HONORIFIC_MAPPINGS } from './constants';

/**
 * Class responsible for processing Buddhist terms and honorific titles in translations
 */
export class TermProcessor {
  /**
   * Processes Buddhist terms in the text, adding English translations on first occurrence
   * @param text - The text to process
   * @returns The text with processed Buddhist terms
   */
  public processBuddhistTerms(text: string): string {
    return PRESERVED_TERMS.reduce((processed, term) => {
      // Only add English translation on first occurrence
      const pattern = new RegExp(`\\b${term.sanskrit}\\b(?![^(]*\\))`, 'g');
      let isFirst = true;

      return processed.replace(pattern, (match) => {
        if (isFirst) {
          isFirst = false;
          return `${term.sanskrit} (${term.english})`;
        }
        return term.sanskrit;
      });
    }, text);
  }

  /**
   * Processes honorific titles in the text, adding English translations
   * @param text - The text to process
   * @returns The text with processed honorific titles
   */
  public processHonorificTitles(text: string): string {
    return Array.from(HONORIFIC_MAPPINGS.entries())
      .reduce((processed, [tibetan, english]) => {
        const pattern = new RegExp(`\\b${tibetan}\\b(?![^(]*\\))`, 'g');
        return processed.replace(pattern, `${english} (${tibetan})`);
      }, text);
  }
}
