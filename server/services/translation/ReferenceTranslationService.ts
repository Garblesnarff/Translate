/**
 * Reference Translation Service
 *
 * Manages and retrieves reference translations to be used as
 * in-context learning examples. Cherry-picked from PR #1.
 *
 * @author Translation Service Team
 */

import { ReferenceTranslation } from './types';

/**
 * Sample reference translations from classical Tibetan Buddhist texts.
 * These serve as gold standard examples for the AI to learn proper
 * translation style and terminology.
 */
const DEFAULT_REFERENCE_TRANSLATIONS: ReferenceTranslation[] = [
  {
    source: '༄༅། །རྒྱ་གར་སྐད་དུ།',
    translation: 'In the language of India:',
    context: 'Standard opening formula'
  },
  {
    source: 'བྱང་ཆུབ་སེམས་དཔའ།',
    translation: 'bodhisattva',
    context: 'Buddhist terminology'
  },
  {
    source: 'སངས་རྒྱས་བཅོམ་ལྡན་འདས།',
    translation: 'Buddha, the Blessed One',
    context: 'Honorific title'
  },
  {
    source: 'ཆོས་ཀྱི་འཁོར་ལོ་བསྐོར་བ།',
    translation: 'turning the wheel of Dharma',
    context: 'Teaching metaphor'
  },
  {
    source: 'ཐེག་པ་ཆེན་པོ།',
    translation: 'the Great Vehicle (Mahayana)',
    context: 'Buddhist vehicle'
  },
  {
    source: 'བླ་མ་དམ་པ།',
    translation: 'holy guru',
    context: 'Honorific for teacher'
  },
  {
    source: 'རྗེ་བཙུན།',
    translation: 'venerable lord',
    context: 'Honorific title'
  },
  {
    source: 'མཁས་པའི་དབང་པོ།',
    translation: 'lord of scholars',
    context: 'Honorific epithet'
  }
];

/**
 * Manages the loading and retrieval of reference translations.
 * These serve as in-context learning examples for the AI model.
 */
export class ReferenceTranslationService {
  private referenceTranslations: ReferenceTranslation[];

  constructor(references?: ReferenceTranslation[]) {
    this.referenceTranslations = references || DEFAULT_REFERENCE_TRANSLATIONS;
  }

  /**
   * Retrieves relevant reference translations for a given text.
   * Currently uses simple substring matching; future versions could
   * use semantic similarity or embedding-based search.
   *
   * @param text - The source text to find relevant references for
   * @param maxResults - Maximum number of references to return
   * @returns Array of relevant reference translation pairs
   */
  public getRelevantReferences(text: string, maxResults: number = 3): ReferenceTranslation[] {
    // First, try to find exact or partial matches in the text
    const matches = this.referenceTranslations.filter(ref =>
      text.includes(ref.source) || ref.source.includes(text.substring(0, 20))
    );

    if (matches.length > 0) {
      return matches.slice(0, maxResults);
    }

    // If no matches, return general examples for style guidance
    return this.referenceTranslations.slice(0, maxResults);
  }

  /**
   * Add new reference translations to the service
   */
  public addReferences(references: ReferenceTranslation[]): void {
    this.referenceTranslations.push(...references);
  }

  /**
   * Get all available reference translations
   */
  public getAllReferences(): ReferenceTranslation[] {
    return [...this.referenceTranslations];
  }

  /**
   * Get references filtered by context
   */
  public getReferencesByContext(context: string): ReferenceTranslation[] {
    return this.referenceTranslations.filter(ref =>
      ref.context?.toLowerCase().includes(context.toLowerCase())
    );
  }

  /**
   * Clear all references (useful for testing)
   */
  public clear(): void {
    this.referenceTranslations = [];
  }

  /**
   * Reset to default references
   */
  public reset(): void {
    this.referenceTranslations = [...DEFAULT_REFERENCE_TRANSLATIONS];
  }
}

// Singleton instance for convenience
export const referenceTranslationService = new ReferenceTranslationService();
