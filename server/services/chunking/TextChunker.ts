// File: server/services/chunking/TextChunker.ts
// Split text into chunks respecting sentence boundaries and token limits

import { TibetanSentenceDetector } from './TibetanSentenceDetector';
import { TokenEstimator } from './TokenEstimator';
import type { TextChunk, ChunkingOptions } from './types';

/**
 * TextChunker splits text into manageable chunks for processing
 *
 * Features:
 * - Respects sentence boundaries (never splits mid-sentence)
 * - Stays within token limits
 * - Adds configurable overlap between chunks
 * - Handles mixed Tibetan-English text
 */
export class TextChunker {
  private detector: TibetanSentenceDetector;
  private estimator: TokenEstimator;
  private options: Required<ChunkingOptions>;

  /**
   * Create a new TextChunker
   *
   * @param options - Chunking options
   */
  constructor(options: ChunkingOptions = {}) {
    this.detector = new TibetanSentenceDetector();
    this.estimator = new TokenEstimator();

    this.options = {
      maxTokens: options.maxTokens ?? 3500,
      overlapPercentage: options.overlapPercentage ?? 0.1,
      respectSentences: options.respectSentences ?? true,
      minTokens: options.minTokens ?? 100,
    };
  }

  /**
   * Split text into chunks
   *
   * @param text - Text to chunk
   * @returns Array of text chunks
   */
  chunk(text: string): TextChunk[] {
    if (!text || text.trim().length === 0) {
      return [];
    }

    // Check if text fits in one chunk
    const totalTokens = this.estimator.estimate(text);
    if (totalTokens <= this.options.maxTokens) {
      return [
        {
          id: this.generateChunkId(0),
          text,
          tokenCount: totalTokens,
          startIndex: 0,
          endIndex: text.length,
        },
      ];
    }

    // Split into sentences
    const sentences = this.options.respectSentences
      ? this.detector.splitIntoSentences(text)
      : [text];

    // Group sentences into chunks
    return this.groupIntoChunks(sentences, text);
  }

  /**
   * Group sentences into chunks
   *
   * @param sentences - Array of sentences
   * @param originalText - Original full text
   * @returns Array of chunks
   */
  private groupIntoChunks(sentences: string[], originalText: string): TextChunk[] {
    const chunks: TextChunk[] = [];
    let currentSentences: string[] = [];
    let currentTokens = 0;
    let startIndex = 0;

    for (let i = 0; i < sentences.length; i++) {
      const sentence = sentences[i];
      const sentenceTokens = this.estimator.estimate(sentence);

      // Check if adding this sentence would exceed limit
      if (currentTokens + sentenceTokens > this.options.maxTokens && currentSentences.length > 0) {
        // Create chunk from current sentences
        const chunk = this.createChunk(
          currentSentences,
          startIndex,
          originalText,
          chunks.length,
          chunks.length > 0 ? chunks[chunks.length - 1] : undefined
        );
        chunks.push(chunk);

        // Start new chunk
        currentSentences = [sentence];
        currentTokens = sentenceTokens;
        startIndex = this.findSentenceStart(originalText, sentence, startIndex);
      } else {
        // Add sentence to current chunk
        currentSentences.push(sentence);
        currentTokens += sentenceTokens;
      }
    }

    // Add final chunk
    if (currentSentences.length > 0) {
      const chunk = this.createChunk(
        currentSentences,
        startIndex,
        originalText,
        chunks.length,
        chunks.length > 0 ? chunks[chunks.length - 1] : undefined
      );
      chunks.push(chunk);
    }

    return chunks;
  }

  /**
   * Create a chunk from sentences
   *
   * @param sentences - Sentences in this chunk
   * @param startIndex - Start index in original text
   * @param originalText - Original full text
   * @param chunkIndex - Index of this chunk
   * @param previousChunk - Previous chunk (for overlap)
   * @returns Text chunk
   */
  private createChunk(
    sentences: string[],
    startIndex: number,
    originalText: string,
    chunkIndex: number,
    previousChunk?: TextChunk
  ): TextChunk {
    const text = sentences.join(' ');
    const tokenCount = this.estimator.estimate(text);

    // Calculate overlap from previous chunk
    let overlap = '';
    if (previousChunk && this.options.overlapPercentage > 0) {
      const overlapLength = Math.floor(
        previousChunk.text.length * this.options.overlapPercentage
      );
      if (overlapLength > 0) {
        overlap = previousChunk.text.substring(
          previousChunk.text.length - overlapLength
        );
      }
    }

    // Find actual end index in original text
    const endIndex = this.findSentenceEnd(originalText, text, startIndex);

    return {
      id: this.generateChunkId(chunkIndex),
      text,
      tokenCount,
      startIndex,
      endIndex,
      overlap,
    };
  }

  /**
   * Find start index of sentence in original text
   *
   * @param text - Original text
   * @param sentence - Sentence to find
   * @param fromIndex - Start searching from this index
   * @returns Start index
   */
  private findSentenceStart(text: string, sentence: string, fromIndex: number): number {
    const index = text.indexOf(sentence.trim(), fromIndex);
    return index >= 0 ? index : fromIndex;
  }

  /**
   * Find end index of text in original
   *
   * @param originalText - Original text
   * @param chunkText - Chunk text
   * @param startIndex - Start index
   * @returns End index
   */
  private findSentenceEnd(
    originalText: string,
    chunkText: string,
    startIndex: number
  ): number {
    return startIndex + chunkText.length;
  }

  /**
   * Generate unique chunk ID
   *
   * @param index - Chunk index
   * @returns Chunk ID
   */
  private generateChunkId(index: number): string {
    return `chunk-${index + 1}`;
  }
}
