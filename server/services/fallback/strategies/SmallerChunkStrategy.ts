/**
 * Smaller Chunk Strategy
 *
 * Splits text into 2 smaller chunks, translates each separately, and combines results.
 * Useful when hitting token limits or dealing with complex texts.
 *
 * @author Translation Service Team
 */

import type { FallbackStrategy, TranslationRequest, TranslationResult } from '../types';

/**
 * SmallerChunkStrategy - Splits text into smaller pieces
 *
 * When large texts fail, this strategy:
 * - Splits text into 2 chunks
 * - Translates each chunk separately
 * - Combines results
 * - Averages confidence scores
 */
export class SmallerChunkStrategy implements FallbackStrategy {
  public readonly name = 'SMALLER_CHUNKS';

  constructor(private translationService: any) {}

  /**
   * Execute smaller chunk strategy
   *
   * @param request - Translation request
   * @returns Translation result
   */
  public async execute(request: TranslationRequest): Promise<TranslationResult> {
    console.log(`[SmallerChunkStrategy] Executing for page ${request.pageNumber}`);

    // Split text into smaller chunks
    const chunks = this.splitText(request.text);

    if (chunks.length <= 1) {
      throw new Error('Cannot split text into smaller chunks');
    }

    console.log(`[SmallerChunkStrategy] Split into ${chunks.length} chunks`);

    // Translate each chunk
    const translations: string[] = [];
    const confidences: number[] = [];

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      console.log(`[SmallerChunkStrategy] Translating chunk ${i + 1}/${chunks.length}`);

      const result = await this.translationService.translate({
        text: chunk,
        includeDictionary: false,
        includeExamples: false,
        useChainOfThought: false
      });

      translations.push(result.translation);
      confidences.push(result.confidence);
    }

    // Combine translations
    const combinedTranslation = translations.join('\n\n');
    const averageConfidence = confidences.reduce((a, b) => a + b, 0) / confidences.length;

    return {
      translation: combinedTranslation,
      confidence: averageConfidence,
      metadata: {
        fallbackStrategy: 'SMALLER_CHUNKS',
        chunksUsed: chunks.length
      }
    };
  }

  /**
   * Split text into smaller chunks
   *
   * @param text - Text to split
   * @returns Array of text chunks
   */
  private splitText(text: string): string[] {
    // Don't split if text is too short
    if (text.length < 20) {
      return [text];
    }

    // Try to split by double line breaks (paragraphs)
    const paragraphs = text.split(/\n\n+/).filter(p => p.trim().length > 0);
    if (paragraphs.length > 1) {
      return paragraphs.slice(0, 2); // Limit to 2 chunks
    }

    // Try to split by Tibetan shad (།)
    const sentences = text.split(/།\s*/).filter(s => s.trim().length > 0);
    if (sentences.length > 1) {
      // Add shad back to sentences and limit to 2 chunks
      return sentences.slice(0, 2).map(s => s.trim() + '།');
    }

    // Try to split by single line breaks
    const lines = text.split(/\n/).filter(l => l.trim().length > 0);
    if (lines.length > 1) {
      return lines.slice(0, 2); // Limit to 2 chunks
    }

    // Last resort: split by character count (only if long enough)
    if (text.length >= 40) {
      const midpoint = Math.ceil(text.length / 2);
      return [
        text.substring(0, midpoint),
        text.substring(midpoint)
      ];
    }

    // Cannot split further
    return [text];
  }
}
