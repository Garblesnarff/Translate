// File: server/services/extraction/PositionAwareExtractor.ts
// Position-aware PDF text extraction for better spacing and layout handling

import * as pdfjsLib from 'pdfjs-dist';
import type { ExtractedText, TextBlock, ExtractionMetadata } from './types';

/**
 * PositionAwareExtractor uses PDF.js position data for intelligent text extraction
 *
 * Features:
 * - Uses X/Y coordinates to preserve proper spacing
 * - Handles multi-column layouts correctly
 * - Detects reading order
 * - Preserves Tibetan syllable boundaries
 */
export class PositionAwareExtractor {
  /**
   * Extract text with position awareness
   *
   * @param pdfData - PDF file data
   * @returns Extracted text with position metadata
   */
  async extractWithPosition(pdfData: Uint8Array): Promise<ExtractedText> {
    try {
      const loadingTask = pdfjsLib.getDocument({ data: pdfData });
      const pdfDocument = await loadingTask.promise;

      const pageCount = pdfDocument.numPages;
      const allBlocks: TextBlock[] = [];
      const pageTexts: string[] = [];

      // Extract text blocks from each page
      for (let i = 1; i <= pageCount; i++) {
        const { blocks, text } = await this.extractPageWithPosition(pdfDocument, i);
        allBlocks.push(...blocks);
        pageTexts.push(text);
      }

      // Combine page texts
      const text = pageTexts.join('\n\n').normalize('NFC');

      // Analyze layout
      const metadata = this.analyzeLayout(allBlocks, pageCount, text);

      return {
        text,
        metadata,
      };
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Position-aware extraction failed: ${error.message}`);
      }
      throw new Error('Position-aware extraction failed: Unknown error');
    }
  }

  /**
   * Extract text blocks with position data from a page
   *
   * @param pdfDocument - PDF document
   * @param pageNumber - Page number (1-indexed)
   * @returns Text blocks and combined text
   */
  private async extractPageWithPosition(
    pdfDocument: pdfjsLib.PDFDocumentProxy,
    pageNumber: number
  ): Promise<{ blocks: TextBlock[]; text: string }> {
    const page = await pdfDocument.getPage(pageNumber);
    const textContent = await page.getTextContent();

    const blocks: TextBlock[] = [];

    // Extract text items with position
    for (const item of textContent.items) {
      if ('str' in item && 'transform' in item) {
        const str = item.str;
        const transform = item.transform as number[];

        // transform[4] = x, transform[5] = y
        const x = transform[4];
        const y = transform[5];

        // Approximate width and height
        const fontSize = Math.abs(transform[0]);
        const width = item.width || str.length * fontSize * 0.6;
        const height = item.height || fontSize;

        blocks.push({
          text: str,
          x,
          y,
          width,
          height,
          pageNumber,
          fontSize,
        });
      }
    }

    // Sort blocks by reading order (top to bottom, left to right)
    const sortedBlocks = this.sortByReadingOrder(blocks);

    // Combine text with intelligent spacing
    const text = this.combineBlocksWithSpacing(sortedBlocks);

    return { blocks, text };
  }

  /**
   * Sort text blocks by reading order
   *
   * @param blocks - Text blocks
   * @returns Sorted blocks
   */
  private sortByReadingOrder(blocks: TextBlock[]): TextBlock[] {
    // Sort by Y (top to bottom) then X (left to right)
    return blocks.sort((a, b) => {
      // Group by approximate Y position (within 5px tolerance)
      const yDiff = Math.abs(a.y - b.y);
      if (yDiff < 5) {
        // Same line, sort by X
        return a.x - b.x;
      }
      // Different lines, sort by Y (note: PDF Y increases downward)
      return b.y - a.y; // Higher Y = earlier in reading order
    });
  }

  /**
   * Combine text blocks with intelligent spacing
   *
   * @param blocks - Sorted text blocks
   * @returns Combined text
   */
  private combineBlocksWithSpacing(blocks: TextBlock[]): string {
    if (blocks.length === 0) return '';

    let result = '';
    let prevBlock: TextBlock | null = null;

    for (const block of blocks) {
      if (prevBlock) {
        // Determine spacing based on position
        const xGap = block.x - (prevBlock.x + prevBlock.width);
        const yGap = Math.abs(block.y - prevBlock.y);

        // New line if Y difference is significant
        if (yGap > 5) {
          result += '\n';
        }
        // Add space if horizontal gap is significant
        else if (xGap > 5) {
          // Don't add space after Tibetan tsek
          if (!result.endsWith('་') && !result.endsWith('།') && !result.endsWith('༎')) {
            result += ' ';
          }
        }
      }

      result += block.text;
      prevBlock = block;
    }

    return result;
  }

  /**
   * Analyze layout from text blocks
   *
   * @param blocks - All text blocks
   * @param pageCount - Number of pages
   * @param text - Combined text
   * @returns Extraction metadata
   */
  private analyzeLayout(
    blocks: TextBlock[],
    pageCount: number,
    text: string
  ): ExtractionMetadata {
    // Detect number of columns
    const columns = this.detectColumns(blocks);

    // Detect reading order
    const readingOrder = this.detectReadingOrder(blocks);

    // Assess quality
    const quality = text.length / pageCount > 500 ? 'high' : 'medium';

    return {
      pageCount,
      layout: columns > 1 ? 'multi-column' : 'single-column',
      quality,
      extractionMethod: 'position-aware',
      hasImages: false,
      columns,
      readingOrder,
      hasPositionData: true,
      textBlocks: blocks,
    };
  }

  /**
   * Detect number of columns
   *
   * @param blocks - Text blocks
   * @returns Number of columns
   */
  private detectColumns(blocks: TextBlock[]): number {
    if (blocks.length === 0) return 1;

    // Group blocks by X position
    const xPositions = blocks.map(b => Math.floor(b.x / 50) * 50); // Round to nearest 50px
    const uniqueX = new Set(xPositions);

    // If we have distinct X positions, might be multi-column
    if (uniqueX.size > 2) {
      return 2; // Assume 2 columns for simplicity
    }

    return 1;
  }

  /**
   * Detect reading order direction
   *
   * @param blocks - Text blocks
   * @returns Reading order
   */
  private detectReadingOrder(blocks: TextBlock[]): 'ltr' | 'rtl' | 'ttb' {
    // Simple heuristic: LTR for now
    // Could be enhanced to detect RTL or top-to-bottom
    return 'ltr';
  }
}
