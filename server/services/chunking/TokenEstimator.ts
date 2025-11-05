// File: server/services/chunking/TokenEstimator.ts
// Estimate token counts for text (especially Tibetan)

/**
 * TokenEstimator provides conservative token count estimates
 *
 * Estimation rules:
 * - Tibetan: ~4 characters per token (conservative)
 * - English: ~1.3 tokens per word
 * - Conservative: Better to under-chunk than over-chunk
 */
export class TokenEstimator {
  // Estimation ratios
  private readonly tibetanCharsPerToken = 4;
  private readonly englishTokensPerWord = 1.3;

  /**
   * Estimate token count for text
   *
   * @param text - Text to estimate
   * @returns Estimated token count
   */
  estimate(text: string): number {
    if (!text || text.length === 0) {
      return 0;
    }

    // Separate Tibetan and non-Tibetan portions
    const { tibetan, other } = this.separateText(text);

    // Estimate Tibetan tokens
    const tibetanTokens = Math.ceil(tibetan.length / this.tibetanCharsPerToken);

    // Estimate other (mainly English) tokens
    const otherTokens = this.estimateEnglishTokens(other);

    return tibetanTokens + otherTokens;
  }

  /**
   * Separate text into Tibetan and other portions
   *
   * @param text - Text to separate
   * @returns Tibetan and other text
   */
  private separateText(text: string): { tibetan: string; other: string } {
    const tibetanChars: string[] = [];
    const otherChars: string[] = [];

    for (const char of text) {
      if (this.isTibetan(char)) {
        tibetanChars.push(char);
      } else {
        otherChars.push(char);
      }
    }

    return {
      tibetan: tibetanChars.join(''),
      other: otherChars.join(''),
    };
  }

  /**
   * Check if character is Tibetan
   *
   * @param char - Character to check
   * @returns True if Tibetan
   */
  private isTibetan(char: string): boolean {
    const code = char.charCodeAt(0);
    return code >= 0x0f00 && code <= 0x0fff;
  }

  /**
   * Estimate tokens for English/other text
   *
   * @param text - Text to estimate
   * @returns Estimated tokens
   */
  private estimateEnglishTokens(text: string): number {
    // Count words (split by whitespace)
    const words = text.trim().split(/\s+/).filter(w => w.length > 0);

    // Apply tokens-per-word ratio
    return Math.ceil(words.length * this.englishTokensPerWord);
  }

  /**
   * Estimate tokens for a substring
   *
   * @param text - Full text
   * @param start - Start index
   * @param end - End index
   * @returns Estimated tokens
   */
  estimateSubstring(text: string, start: number, end: number): number {
    const substring = text.substring(start, end);
    return this.estimate(substring);
  }

  /**
   * Find the maximum text that fits within token limit
   *
   * @param text - Text to chunk
   * @param maxTokens - Maximum tokens allowed
   * @param startIndex - Starting index (default 0)
   * @returns End index that fits within limit
   */
  findMaxFit(text: string, maxTokens: number, startIndex = 0): number {
    if (startIndex >= text.length) {
      return text.length;
    }

    // Binary search for the right end point
    let left = startIndex;
    let right = text.length;
    let bestEnd = startIndex;

    while (left <= right) {
      const mid = Math.floor((left + right) / 2);
      const tokens = this.estimateSubstring(text, startIndex, mid);

      if (tokens <= maxTokens) {
        bestEnd = mid;
        left = mid + 1;
      } else {
        right = mid - 1;
      }
    }

    return bestEnd;
  }
}
