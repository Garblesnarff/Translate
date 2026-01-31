// File: server/services/extraction/TextExtractor.ts
// Core PDF text extraction service using PDF.js

import * as pdfjsLib from 'pdfjs-dist';
import type { ExtractedText, ExtractionOptions, ExtractionMetadata } from './types';

/**
 * TextExtractor service for extracting text from PDF files
 *
 * Features:
 * - Extracts text from digital PDFs using PDF.js
 * - Parallel page extraction for performance
 * - Removes common artifacts (headers, footers, page numbers)
 * - Unicode normalization (NFC)
 * - Returns metadata about extraction quality
 */
export class TextExtractor {
  private options: ExtractionOptions;

  /**
   * Create a new TextExtractor
   *
   * @param options - Extraction options
   */
  constructor(options: ExtractionOptions = {}) {
    this.options = {
      removeArtifacts: true,
      usePositionData: false,
      normalizeUnicode: true,
      maxPages: 0,
      ...options,
    };
  }

  /**
   * Extract text from PDF data
   *
   * @param pdfData - PDF file data as Uint8Array
   * @returns Extracted text with metadata
   */
  async extract(pdfData: Uint8Array): Promise<ExtractedText> {
    try {
      // Load PDF document
      const loadingTask = pdfjsLib.getDocument({ data: pdfData });
      const pdfDocument = await loadingTask.promise;

      // Get page count
      const pageCount = pdfDocument.numPages;
      const pagesToExtract = this.options.maxPages
        ? Math.min(pageCount, this.options.maxPages)
        : pageCount;

      // Extract text from all pages in parallel
      const pagePromises: Promise<string>[] = [];
      for (let i = 1; i <= pagesToExtract; i++) {
        pagePromises.push(this.extractPageText(pdfDocument, i));
      }

      const pages = await Promise.all(pagePromises);

      // Combine page text
      let text = pages.join('\n\n');

      // Normalize Unicode if requested
      if (this.options.normalizeUnicode) {
        text = text.normalize('NFC');
      }

      // Detect layout and quality
      const metadata = this.analyzeExtraction(text, pageCount, pages);

      // Remove artifacts if requested
      if (this.options.removeArtifacts) {
        const { ArtifactRemover } = await import('./ArtifactRemover');
        const remover = new ArtifactRemover();
        text = remover.removeArtifacts(text);
      }

      return {
        text,
        metadata,
      };
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`PDF extraction failed: ${error.message}`);
      }
      throw new Error('PDF extraction failed: Unknown error');
    }
  }

  /**
   * Extract text from a single page
   *
   * @param pdfDocument - PDF document
   * @param pageNumber - Page number (1-indexed)
   * @returns Page text
   */
  private async extractPageText(
    pdfDocument: pdfjsLib.PDFDocumentProxy,
    pageNumber: number
  ): Promise<string> {
    const page = await pdfDocument.getPage(pageNumber);
    const textContent = await page.getTextContent();

    // Combine text items
    const textItems = textContent.items
      .map((item: any) => {
        if ('str' in item) {
          return item.str;
        }
        return '';
      })
      .filter((str: string) => str.length > 0);

    return textItems.join(' ');
  }

  /**
   * Analyze extraction to determine quality and layout
   *
   * @param text - Extracted text
   * @param pageCount - Number of pages
   * @param pages - Individual page texts
   * @returns Extraction metadata
   */
  private analyzeExtraction(
    text: string,
    pageCount: number,
    pages: string[]
  ): ExtractionMetadata {
    // Detect if text was successfully extracted
    const avgCharsPerPage = text.length / pageCount;
    let quality: ExtractionMetadata['quality'];

    if (avgCharsPerPage > 500) {
      quality = 'high';
    } else if (avgCharsPerPage > 100) {
      quality = 'medium';
    } else if (avgCharsPerPage > 10) {
      quality = 'low';
    } else {
      quality = 'scanned'; // Likely image-based PDF
    }

    // Detect layout (simple heuristic)
    const layout = this.detectLayout(text);

    // Detect if PDF has images (simple check)
    const hasImages = quality === 'scanned';

    // Detect primary language
    const language = this.detectLanguage(text);

    return {
      pageCount,
      layout,
      quality,
      extractionMethod: 'native',
      hasImages,
      language,
    };
  }

  /**
   * Detect layout type
   *
   * @param text - Extracted text
   * @returns Layout type
   */
  private detectLayout(text: string): ExtractionMetadata['layout'] {
    // Simple heuristic: if text has many short lines, might be multi-column
    const lines = text.split('\n');
    const avgLineLength = lines.reduce((sum, line) => sum + line.length, 0) / lines.length;

    if (avgLineLength < 40) {
      return 'multi-column';
    } else if (avgLineLength < 80) {
      return 'single-column';
    } else {
      return 'complex';
    }
  }

  /**
   * Detect primary language
   *
   * @param text - Extracted text
   * @returns Language code or undefined
   */
  private detectLanguage(text: string): string | undefined {
    // Check for Tibetan characters
    const tibetanChars = text.match(/[\u0F00-\u0FFF]/g);

    if (tibetanChars && tibetanChars.length > text.length * 0.3) {
      return 'tibetan';
    }

    // Default to English
    return 'english';
  }
}
