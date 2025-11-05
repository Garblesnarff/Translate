/**
 * Semantic Text Chunking for Tibetan Translation
 *
 * Provides sophisticated text chunking that:
 * - Respects sentence boundaries (never splits mid-sentence)
 * - Enforces token limits for AI models
 * - Adds context overlap between chunks
 * - Supports both page-based and semantic chunking strategies
 */

import {
  splitIntoSentences,
  combineSentences,
  type TibetanSentence
} from './tibetan/sentenceDetector';

/**
 * Chunking strategy used
 */
export type ChunkingStrategy = 'page' | 'semantic' | 'hybrid';

/**
 * Enhanced text chunk interface with semantic information
 */
export interface TextChunk {
  /** Page number (may be detected or assigned) */
  pageNumber: number;

  /** Main text content for this chunk */
  text: string;

  /** Whether this chunk includes context from previous chunk */
  hasOverlap: boolean;

  /** Overlapping text from previous chunk (for context only) */
  overlapText?: string;

  /** Estimated token count for this chunk */
  tokenCount: number;

  /** Strategy used to create this chunk */
  chunkingStrategy: ChunkingStrategy;

  /** Number of sentences in this chunk */
  sentenceCount?: number;
}

/**
 * Configuration for semantic chunking
 */
export interface ChunkingConfig {
  /** Maximum tokens per chunk (default: 3500) */
  maxTokens: number;

  /** Number of sentences to overlap (default: 2) */
  overlapSentences: number;

  /** Prefer page-based chunking if page markers detected */
  preferPageBased: boolean;

  /** Minimum sentences per chunk (default: 1) */
  minSentences: number;
}

/**
 * Default chunking configuration
 */
const DEFAULT_CONFIG: ChunkingConfig = {
  maxTokens: 3500, // Safe limit for Gemini with room for prompt
  overlapSentences: 2,
  preferPageBased: true,
  minSentences: 1,
};

/**
 * Estimate token count for text
 * Uses rough estimate of ~4 characters per token for Tibetan
 * English is roughly ~4 chars per token as well
 *
 * This is conservative to ensure we don't exceed model limits
 */
export function estimateTokenCount(text: string): number {
  if (!text) return 0;

  // Average characters per token (conservative estimate)
  const CHARS_PER_TOKEN = 4;

  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

/**
 * Semantic Chunker - intelligently splits text into chunks
 * that respect sentence boundaries and token limits
 */
export class SemanticChunker {
  private config: ChunkingConfig;

  constructor(config: Partial<ChunkingConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Main entry point for chunking text
   */
  public chunkText(text: string): TextChunk[] {
    if (!text || !text.trim()) {
      return [];
    }

    // Try numbered paragraph/page detection first (backward compatibility)
    const numberedChunks = this.detectNumberedPages(text);
    if (numberedChunks.length > 0 && this.config.preferPageBased) {
      // Check if any numbered chunk exceeds token limit
      const needsSplitting = numberedChunks.some(
        chunk => chunk.tokenCount > this.config.maxTokens
      );

      if (needsSplitting) {
        // Use hybrid approach: split large page-based chunks
        return this.applyHybridStrategy(numberedChunks);
      }

      // Page-based chunks are good as-is
      return this.addContextOverlap(numberedChunks, 'page');
    }

    // No page markers or page-based not preferred: use semantic chunking
    return this.chunkBySemanticBoundaries(text);
  }

  /**
   * Detect numbered pages/paragraphs (e.g., "1 text", "2 text")
   * This maintains backward compatibility with the old system
   */
  private detectNumberedPages(text: string): TextChunk[] {
    const chunks = text.split(/(?=^\s*\d+\s+)/m);
    const numberedChunks: TextChunk[] = [];

    for (const chunk of chunks) {
      const pageMatch = chunk.match(/^\s*(\d+)\s+/);
      if (!pageMatch) continue;

      const pageNumber = parseInt(pageMatch[1]);
      const chunkText = chunk.replace(/^\s*\d+\s+/, '').trim();

      if (!chunkText) continue;

      const sentences = splitIntoSentences(chunkText);

      numberedChunks.push({
        pageNumber,
        text: chunkText,
        hasOverlap: false,
        tokenCount: estimateTokenCount(chunkText),
        chunkingStrategy: 'page',
        sentenceCount: sentences.length,
      });
    }

    return numberedChunks;
  }

  /**
   * Apply hybrid strategy: split page-based chunks that are too large
   */
  private applyHybridStrategy(pageChunks: TextChunk[]): TextChunk[] {
    const result: TextChunk[] = [];
    let subChunkCounter = 0;

    for (const chunk of pageChunks) {
      if (chunk.tokenCount <= this.config.maxTokens) {
        // Chunk is fine as-is
        result.push(chunk);
      } else {
        // Split this chunk semantically
        const subChunks = this.splitChunkBySemanticBoundaries(
          chunk.text,
          chunk.pageNumber + subChunkCounter / 1000 // e.g., 1.001, 1.002
        );

        // Mark as hybrid strategy
        subChunks.forEach(sc => {
          sc.chunkingStrategy = 'hybrid';
        });

        result.push(...subChunks);
        subChunkCounter += subChunks.length;
      }
    }

    return this.addContextOverlap(result, 'hybrid');
  }

  /**
   * Chunk text purely by semantic boundaries (sentences)
   */
  private chunkBySemanticBoundaries(text: string): TextChunk[] {
    const sentences = splitIntoSentences(text);
    if (sentences.length === 0) return [];

    const chunks: TextChunk[] = [];
    let currentSentences: TibetanSentence[] = [];
    let currentTokenCount = 0;
    let chunkNumber = 1;

    for (let i = 0; i < sentences.length; i++) {
      const sentence = sentences[i];
      const sentenceTokens = estimateTokenCount(sentence.text);

      // Check if adding this sentence would exceed limit
      if (currentSentences.length > 0 &&
          currentTokenCount + sentenceTokens > this.config.maxTokens) {
        // Create chunk from current sentences
        chunks.push(this.createChunkFromSentences(
          currentSentences,
          chunkNumber++,
          'semantic'
        ));

        // Start new chunk
        currentSentences = [sentence];
        currentTokenCount = sentenceTokens;
      } else {
        // Add sentence to current chunk
        currentSentences.push(sentence);
        currentTokenCount += sentenceTokens;
      }
    }

    // Handle remaining sentences
    if (currentSentences.length > 0) {
      chunks.push(this.createChunkFromSentences(
        currentSentences,
        chunkNumber,
        'semantic'
      ));
    }

    return this.addContextOverlap(chunks, 'semantic');
  }

  /**
   * Split a single chunk by semantic boundaries
   * Used for hybrid strategy when a page-based chunk is too large
   */
  private splitChunkBySemanticBoundaries(
    text: string,
    basePageNumber: number
  ): TextChunk[] {
    const sentences = splitIntoSentences(text);
    if (sentences.length === 0) return [];

    const chunks: TextChunk[] = [];
    let currentSentences: TibetanSentence[] = [];
    let currentTokenCount = 0;
    let subChunkIndex = 0;

    for (const sentence of sentences) {
      const sentenceTokens = estimateTokenCount(sentence.text);

      if (currentSentences.length > 0 &&
          currentTokenCount + sentenceTokens > this.config.maxTokens) {
        // Create chunk
        const chunkText = combineSentences(currentSentences);
        chunks.push({
          pageNumber: Math.floor(basePageNumber) + subChunkIndex * 0.1,
          text: chunkText,
          hasOverlap: false,
          tokenCount: currentTokenCount,
          chunkingStrategy: 'hybrid',
          sentenceCount: currentSentences.length,
        });

        subChunkIndex++;
        currentSentences = [sentence];
        currentTokenCount = sentenceTokens;
      } else {
        currentSentences.push(sentence);
        currentTokenCount += sentenceTokens;
      }
    }

    // Remaining sentences
    if (currentSentences.length > 0) {
      const chunkText = combineSentences(currentSentences);
      chunks.push({
        pageNumber: Math.floor(basePageNumber) + subChunkIndex * 0.1,
        text: chunkText,
        hasOverlap: false,
        tokenCount: currentTokenCount,
        chunkingStrategy: 'hybrid',
        sentenceCount: currentSentences.length,
      });
    }

    return chunks;
  }

  /**
   * Create a chunk from sentences
   */
  private createChunkFromSentences(
    sentences: TibetanSentence[],
    pageNumber: number,
    strategy: ChunkingStrategy
  ): TextChunk {
    const text = combineSentences(sentences);
    const tokenCount = estimateTokenCount(text);

    return {
      pageNumber,
      text,
      hasOverlap: false,
      tokenCount,
      chunkingStrategy: strategy,
      sentenceCount: sentences.length,
    };
  }

  /**
   * Add context overlap between chunks
   * Includes last N sentences from previous chunk
   */
  private addContextOverlap(
    chunks: TextChunk[],
    strategy: ChunkingStrategy
  ): TextChunk[] {
    if (chunks.length <= 1 || this.config.overlapSentences === 0) {
      return chunks;
    }

    for (let i = 1; i < chunks.length; i++) {
      const previousChunk = chunks[i - 1];
      const currentChunk = chunks[i];

      // Get sentences from previous chunk
      const previousSentences = splitIntoSentences(previousChunk.text);

      // Take last N sentences
      const overlapSentences = previousSentences.slice(
        -this.config.overlapSentences
      );

      if (overlapSentences.length > 0) {
        const overlapText = combineSentences(overlapSentences);
        const overlapTokens = estimateTokenCount(overlapText);

        // Only add overlap if it doesn't push us over the limit
        if (currentChunk.tokenCount + overlapTokens <= this.config.maxTokens) {
          currentChunk.hasOverlap = true;
          currentChunk.overlapText = overlapText;
          currentChunk.tokenCount += overlapTokens;
        }
      }
    }

    return chunks;
  }
}

/**
 * Convenience function to split text into chunks with default configuration
 */
export function splitTextIntoChunks(
  text: string,
  config?: Partial<ChunkingConfig>
): TextChunk[] {
  const chunker = new SemanticChunker(config);
  return chunker.chunkText(text);
}

/**
 * Combine translated chunks back into a single document
 */
export function combineTranslations(
  translations: { pageNumber: number; translation: string }[]
): string {
  return translations
    .sort((a, b) => a.pageNumber - b.pageNumber)
    .map(({ translation }) => translation)
    .join('\n\n');
}

/**
 * Get statistics about chunks
 */
export function getChunkingStats(chunks: TextChunk[]): {
  totalChunks: number;
  totalTokens: number;
  avgTokensPerChunk: number;
  maxTokens: number;
  minTokens: number;
  chunksWithOverlap: number;
  strategyCounts: Record<ChunkingStrategy, number>;
} {
  if (chunks.length === 0) {
    return {
      totalChunks: 0,
      totalTokens: 0,
      avgTokensPerChunk: 0,
      maxTokens: 0,
      minTokens: 0,
      chunksWithOverlap: 0,
      strategyCounts: { page: 0, semantic: 0, hybrid: 0 },
    };
  }

  const totalTokens = chunks.reduce((sum, c) => sum + c.tokenCount, 0);
  const strategyCounts = chunks.reduce((acc, c) => {
    acc[c.chunkingStrategy] = (acc[c.chunkingStrategy] || 0) + 1;
    return acc;
  }, {} as Record<ChunkingStrategy, number>);

  return {
    totalChunks: chunks.length,
    totalTokens,
    avgTokensPerChunk: totalTokens / chunks.length,
    maxTokens: Math.max(...chunks.map(c => c.tokenCount)),
    minTokens: Math.min(...chunks.map(c => c.tokenCount)),
    chunksWithOverlap: chunks.filter(c => c.hasOverlap).length,
    strategyCounts,
  };
}
