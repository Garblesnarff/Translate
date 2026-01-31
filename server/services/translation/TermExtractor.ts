/**
 * Term Extraction Service
 *
 * Extracts Tibetan-English term pairs from translations to build glossaries.
 * Parses "English (Tibetan)" format and filters out non-term pairs.
 *
 * Key features:
 * - Regex-based extraction of term pairs
 * - Filtering of full sentences and common words
 * - Context preservation for each term
 * - Confidence scoring for extracted terms
 *
 * @author Translation Service Team
 */

export interface TermPair {
  tibetan: string;
  english: string;
  context: string;
  pageNumber: number;
  confidence: number;
}

export class TermExtractor {
  // Regex to match "English (Tibetan)" pattern
  // Captures: English text, then Tibetan text inside parentheses
  private readonly TERM_PATTERN = /([^()]+)\s*\(([^\)]*[\u0F00-\u0FFF][^\)]*)\)/g;

  // Common words to exclude from term extraction (too generic)
  private readonly COMMON_WORDS = new Set([
    'and', 'or', 'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
    'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'should', 'could',
    'may', 'might', 'can', 'must', 'shall', 'this', 'that', 'these', 'those',
    'i', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'him', 'her', 'us', 'them',
    'my', 'your', 'his', 'its', 'our', 'their', 'mine', 'yours', 'hers', 'ours', 'theirs',
    'what', 'which', 'who', 'whom', 'whose', 'where', 'when', 'why', 'how',
    'all', 'some', 'any', 'many', 'much', 'few', 'more', 'most', 'other', 'another',
    'such', 'no', 'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very'
  ]);

  /**
   * Extracts term pairs from a translation
   *
   * @param translation - The translated text in "English (Tibetan)" format
   * @param pageNumber - The page number for context
   * @returns Array of extracted term pairs
   */
  public extractTermPairs(translation: string, pageNumber: number): TermPair[] {
    const termPairs: TermPair[] = [];

    // Reset regex index
    this.TERM_PATTERN.lastIndex = 0;

    let match: RegExpExecArray | null;
    while ((match = this.TERM_PATTERN.exec(translation)) !== null) {
      const english = match[1].trim();
      const tibetan = match[2].trim();

      // Extract context (surrounding text)
      const contextStart = Math.max(0, match.index - 50);
      const contextEnd = Math.min(translation.length, match.index + match[0].length + 50);
      const context = translation.substring(contextStart, contextEnd).trim();

      // Filter out non-term pairs
      if (!this.isValidTermPair(english, tibetan)) {
        continue;
      }

      // Calculate confidence based on term characteristics
      const confidence = this.calculateTermConfidence(english, tibetan);

      termPairs.push({
        tibetan,
        english,
        context,
        pageNumber,
        confidence
      });
    }

    console.log(`[TermExtractor] Extracted ${termPairs.length} term pairs from page ${pageNumber}`);
    return termPairs;
  }

  /**
   * Validates whether a pair is a true term pair (not a sentence or common word)
   */
  private isValidTermPair(english: string, tibetan: string): boolean {
    // Reject if either is empty
    if (!english || !tibetan) {
      return false;
    }

    // Reject if English text is too long (likely a full sentence)
    const wordCount = english.split(/\s+/).length;
    if (wordCount > 15) {
      return false;
    }

    // Reject if English text is too short (likely just punctuation or article)
    if (wordCount === 1 && this.COMMON_WORDS.has(english.toLowerCase())) {
      return false;
    }

    // Reject if English contains sentence-ending punctuation (likely full sentence)
    if (english.includes('.') || english.includes('!') || english.includes('?')) {
      // Allow if it's an abbreviation (e.g., "Dr.", "etc.")
      if (!/\b[A-Z][a-z]*\.$/.test(english) && !/etc\.$/.test(english)) {
        return false;
      }
    }

    // Reject if Tibetan text is too short (likely just a syllable)
    const tibetanLength = tibetan.replace(/[\s་།༎༑]/g, '').length;
    if (tibetanLength < 2) {
      return false;
    }

    // Reject if the pair looks like a full sentence
    // (contains multiple shad markers, indicating sentence ends)
    const shadCount = (tibetan.match(/[།༎]/g) || []).length;
    if (shadCount > 2) {
      return false;
    }

    return true;
  }

  /**
   * Calculates confidence score for a term pair
   * Based on characteristics like term length, structure, etc.
   */
  private calculateTermConfidence(english: string, tibetan: string): number {
    let confidence = 0.7; // Base confidence

    // Word count factor (2-10 words is ideal for terms)
    const wordCount = english.split(/\s+/).length;
    if (wordCount >= 2 && wordCount <= 10) {
      confidence += 0.15;
    } else if (wordCount === 1) {
      confidence += 0.05;
    } else {
      confidence -= 0.1;
    }

    // Capitalization factor (proper nouns/important terms are often capitalized)
    if (/^[A-Z]/.test(english)) {
      confidence += 0.1;
    }

    // Tibetan length factor (longer terms are typically more specific)
    const tibetanLength = tibetan.replace(/[\s་།༎༑]/g, '').length;
    if (tibetanLength >= 3 && tibetanLength <= 20) {
      confidence += 0.1;
    }

    // Check for Buddhist terminology indicators
    const buddhistTerms = [
      'buddha', 'dharma', 'sangha', 'lama', 'teacher', 'meditation', 'emptiness',
      'compassion', 'wisdom', 'enlightenment', 'bodhisattva', 'arhat', 'sutra',
      'tantra', 'mantra', 'mandala', 'practice', 'teaching', 'lineage', 'transmission',
      'vow', 'precept', 'refuge', 'merit', 'karma', 'rebirth', 'nirvana', 'samsara'
    ];

    const lowerEnglish = english.toLowerCase();
    if (buddhistTerms.some(term => lowerEnglish.includes(term))) {
      confidence += 0.1;
    }

    // Cap confidence at 1.0
    return Math.min(confidence, 1.0);
  }

  /**
   * Extracts all unique terms from multiple pages
   * Useful for batch processing
   */
  public extractTermsFromPages(pages: Array<{ translation: string; pageNumber: number }>): TermPair[] {
    const allTerms: TermPair[] = [];

    for (const page of pages) {
      const pageTerms = this.extractTermPairs(page.translation, page.pageNumber);
      allTerms.push(...pageTerms);
    }

    console.log(`[TermExtractor] Extracted ${allTerms.length} total term pairs from ${pages.length} pages`);
    return allTerms;
  }

  /**
   * Gets statistics about extracted terms
   */
  public getExtractionStats(termPairs: TermPair[]): {
    totalTerms: number;
    uniqueTibetan: number;
    uniqueEnglish: number;
    averageConfidence: number;
    highConfidenceTerms: number;
  } {
    const uniqueTibetan = new Set(termPairs.map(t => t.tibetan));
    const uniqueEnglish = new Set(termPairs.map(t => t.english));
    const averageConfidence = termPairs.reduce((sum, t) => sum + t.confidence, 0) / termPairs.length;
    const highConfidenceTerms = termPairs.filter(t => t.confidence >= 0.9).length;

    return {
      totalTerms: termPairs.length,
      uniqueTibetan: uniqueTibetan.size,
      uniqueEnglish: uniqueEnglish.size,
      averageConfidence,
      highConfidenceTerms
    };
  }
}
