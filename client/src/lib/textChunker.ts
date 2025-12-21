// client/src/lib/textChunker.ts
// Text chunking utilities for translation processing
// This module is server-compatible (no browser-specific dependencies)

import { splitIntoSentences, combineSentences, isTibetanSentenceEnd, type TibetanSentence } from './tibetan/sentenceDetector';

/**
 * Page chunk interface for translation processing
 */
export interface PageChunk {
  /** Page number (1-based). Sub-chunks use decimals: 1, 1.1, 1.2 */
  pageNumber: number;
  /** Text content for this chunk */
  text: string;
  /** Estimated token count */
  tokenCount: number;
  /** Whether this is a sub-chunk from splitting an oversized page */
  isSubChunk: boolean;
  /** Number of sentences in this chunk */
  sentenceCount: number;
  /** Overlapping text from previous chunk for context */
  overlapText?: string;
}

/**
 * Configuration for text chunking
 */
export interface ExtractionChunkingConfig {
  /** Maximum tokens per chunk (default: 3500) */
  maxTokens?: number;
  /** Number of sentences to overlap between chunks (default: 2) */
  overlapSentences?: number;
}

/** Default chunking configuration */
const DEFAULT_CHUNKING_CONFIG: Required<ExtractionChunkingConfig> = {
  maxTokens: 3500,
  overlapSentences: 2,
};

/**
 * Check if text ends with a complete Tibetan sentence.
 * Returns true if the text ends with a Tibetan sentence-ending punctuation mark.
 */
function endsWithCompleteSentence(text: string): boolean {
  if (!text || !text.trim()) return true;

  const trimmed = text.trim();
  // Check last few characters for sentence-ending punctuation
  // Account for possible trailing whitespace or page numbers
  const lastChars = trimmed.slice(-20);

  // Find the last Tibetan character position
  for (let i = lastChars.length - 1; i >= 0; i--) {
    const char = lastChars[i];
    // Skip numbers, spaces, and Latin characters (page numbers like "བྱང་ཆུབ། 1")
    if (/[\d\s\na-zA-Z]/.test(char)) continue;
    // Check if it's a sentence-ending mark
    return isTibetanSentenceEnd(char);
  }
  return true; // No Tibetan text found, treat as complete
}

/**
 * Find the position of the first complete sentence end in text.
 * Returns the index after the sentence-ending punctuation, or -1 if not found.
 */
function findFirstSentenceEnd(text: string): number {
  for (let i = 0; i < text.length; i++) {
    if (isTibetanSentenceEnd(text[i])) {
      return i + 1;
    }
  }
  return -1;
}

/**
 * Strip common Tibetan page headers and footers from text.
 * Footers typically appear as: <title>། <page_number> or <page_number> <title>།
 */
function stripPageHeadersFooters(text: string): string {
  // Remove lines that are just page numbers (possibly with title)
  // Pattern: title ending with shad + space + number at end of text
  // Or: number + space + title at start of text
  const lines = text.split('\n');
  const cleanedLines: string[] = [];

  for (const line of lines) {
    const trimmedLine = line.trim();

    // Skip empty lines
    if (!trimmedLine) {
      cleanedLines.push(line);
      continue;
    }

    // Footer pattern: title ending with shad/number, or just page number
    // e.g., "བྱང་ཆུབ་སེམས་དཔའི་ནོར་བུའི་ཕྲེང་བ། 1" or "1"
    const footerPattern = /^.*།\s*\d+$/;
    const headerPattern = /^\d+\s+.*།$/;
    const standaloneNumberPattern = /^\d+$/;

    if (footerPattern.test(trimmedLine) ||
        headerPattern.test(trimmedLine) ||
        standaloneNumberPattern.test(trimmedLine)) {
      // This looks like a header/footer, skip it
      continue;
    }

    cleanedLines.push(line);
  }

  return cleanedLines.join('\n').trim();
}

/**
 * Merge incomplete sentences across page boundaries.
 * When a page ends without proper sentence-ending punctuation,
 * move the beginning of the next page (up to first sentence end) to the current page.
 */
function mergeIncompleteSentences(
  pages: { pageNumber: number; text: string }[]
): { pageNumber: number; text: string }[] {
  if (pages.length <= 1) return pages;

  const result: { pageNumber: number; text: string }[] = [];

  for (let i = 0; i < pages.length; i++) {
    const currentPage = { ...pages[i] };

    // Check if this page ends with an incomplete sentence
    if (i < pages.length - 1 && !endsWithCompleteSentence(currentPage.text)) {
      const nextPage = pages[i + 1];
      const sentenceEndPos = findFirstSentenceEnd(nextPage.text);

      if (sentenceEndPos > 0) {
        // Move text from next page to complete this sentence
        const textToMove = nextPage.text.substring(0, sentenceEndPos);
        currentPage.text = currentPage.text.trimEnd() + textToMove;

        // Update next page to remove the moved text
        pages[i + 1] = {
          ...nextPage,
          text: nextPage.text.substring(sentenceEndPos).trimStart()
        };
      }
    }

    result.push(currentPage);
  }

  // Filter out any pages that became empty after merging
  return result.filter(p => p.text.trim().length > 0);
}

/**
 * Estimate token count for text.
 * Uses ~4 characters per token (conservative estimate for Tibetan/English).
 */
export function estimateTokenCount(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

/**
 * Split an oversized page into smaller chunks by sentence boundaries.
 */
function splitOversizedPage(
  pageText: string,
  pageNumber: number,
  maxTokens: number
): PageChunk[] {
  const sentences = splitIntoSentences(pageText);
  if (sentences.length === 0) {
    return [{
      pageNumber,
      text: pageText,
      tokenCount: estimateTokenCount(pageText),
      isSubChunk: false,
      sentenceCount: 0,
    }];
  }

  const chunks: PageChunk[] = [];
  let currentSentences: TibetanSentence[] = [];
  let currentTokenCount = 0;
  let subChunkIndex = 0;

  for (const sentence of sentences) {
    const sentenceTokens = estimateTokenCount(sentence.text);

    if (currentSentences.length > 0 && currentTokenCount + sentenceTokens > maxTokens) {
      // Create chunk from current sentences
      const chunkText = combineSentences(currentSentences);
      chunks.push({
        pageNumber: subChunkIndex === 0 ? pageNumber : pageNumber + subChunkIndex * 0.1,
        text: chunkText,
        tokenCount: currentTokenCount,
        isSubChunk: subChunkIndex > 0,
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

  // Handle remaining sentences
  if (currentSentences.length > 0) {
    const chunkText = combineSentences(currentSentences);
    chunks.push({
      pageNumber: subChunkIndex === 0 ? pageNumber : pageNumber + subChunkIndex * 0.1,
      text: chunkText,
      tokenCount: currentTokenCount,
      isSubChunk: subChunkIndex > 0,
      sentenceCount: currentSentences.length,
    });
  }

  return chunks;
}

/**
 * Add context overlap between chunks (last N sentences from previous chunk).
 */
function addOverlapContext(chunks: PageChunk[], overlapSentences: number): PageChunk[] {
  if (chunks.length <= 1 || overlapSentences === 0) {
    return chunks;
  }

  for (let i = 1; i < chunks.length; i++) {
    const previousChunk = chunks[i - 1];
    const currentChunk = chunks[i];

    const previousSentences = splitIntoSentences(previousChunk.text);
    const overlapSentenceList = previousSentences.slice(-overlapSentences);

    if (overlapSentenceList.length > 0) {
      const overlapText = combineSentences(overlapSentenceList);
      currentChunk.overlapText = overlapText;
    }
  }

  return chunks;
}

/**
 * Split text into chunks for translation.
 * Parses "Page N:" format from textExtractor and applies token limits.
 *
 * This is the main entry point used by server controllers for chunking.
 */
export function splitTextIntoChunks(
  text: string,
  config?: ExtractionChunkingConfig
): PageChunk[] {
  if (!text || !text.trim()) {
    return [];
  }

  const { maxTokens, overlapSentences } = { ...DEFAULT_CHUNKING_CONFIG, ...config };

  // Parse "Page N:\n<content>" format from textExtractor
  const pageRegex = /Page\s+(\d+):\n([\s\S]*?)(?=Page\s+\d+:|$)/g;
  const pages: { pageNumber: number; text: string }[] = [];
  let match;

  while ((match = pageRegex.exec(text)) !== null) {
    const pageNumber = parseInt(match[1], 10);
    // Strip headers/footers (like "བྱང་ཆུབ་སེམས་དཔའི་ནོར་བུའི་ཕྲེང་བ། 1") before processing
    const pageText = stripPageHeadersFooters(match[2]);
    if (pageText) {
      pages.push({ pageNumber, text: pageText });
    }
  }

  // If no page markers found, treat entire text as one page
  if (pages.length === 0) {
    const trimmedText = text.trim();
    if (trimmedText) {
      pages.push({ pageNumber: 1, text: trimmedText });
    }
  }

  // Merge incomplete sentences across page boundaries
  // This ensures sentences that span PDF page breaks are kept together
  const mergedPages = mergeIncompleteSentences(pages);

  // Build chunks, splitting oversized pages
  let allChunks: PageChunk[] = [];

  for (const page of mergedPages) {
    const tokenCount = estimateTokenCount(page.text);

    if (tokenCount > maxTokens) {
      // Split oversized page by sentence boundaries
      const subChunks = splitOversizedPage(page.text, page.pageNumber, maxTokens);
      allChunks.push(...subChunks);
    } else {
      // Page fits within token limit
      const sentences = splitIntoSentences(page.text);
      allChunks.push({
        pageNumber: page.pageNumber,
        text: page.text,
        tokenCount,
        isSubChunk: false,
        sentenceCount: sentences.length,
      });
    }
  }

  // Add context overlap between chunks
  allChunks = addOverlapContext(allChunks, overlapSentences);

  return allChunks;
}
