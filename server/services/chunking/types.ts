// File: server/services/chunking/types.ts
// Type definitions for text chunking

/**
 * A chunk of text for processing
 */
export interface TextChunk {
  /** Unique chunk identifier */
  id: string;

  /** Chunk text content */
  text: string;

  /** Estimated token count */
  tokenCount: number;

  /** Starting index in original text */
  startIndex: number;

  /** Ending index in original text */
  endIndex: number;

  /** Page number (if available) */
  pageNumber?: number;

  /** Overlap text from previous chunk */
  overlap?: string;
}

/**
 * Options for text chunking
 */
export interface ChunkingOptions {
  /** Maximum tokens per chunk */
  maxTokens?: number;

  /** Overlap percentage between chunks (0-1) */
  overlapPercentage?: number;

  /** Whether to respect sentence boundaries */
  respectSentences?: boolean;

  /** Minimum chunk size (tokens) */
  minTokens?: number;
}

/**
 * Sentence boundary information
 */
export interface SentenceBoundary {
  /** Index in text */
  index: number;

  /** Boundary character */
  char: string;

  /** Type of boundary */
  type: 'tibetan-shad' | 'tibetan-double-shad' | 'period' | 'other';
}
