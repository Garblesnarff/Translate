// client/src/lib/ocr/ocrDetector.ts

import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist';

export interface OCRDetectionResult {
  needsOCR: boolean;
  confidence: number;
  reason: string;
  textDensity: number;
  hasImages: boolean;
  sparsePagesCount: number;
  totalPages: number;
  sparsePages: number[];
}

export interface OCRDetectionOptions {
  // Minimum characters per page to consider as "has text"
  minCharsPerPage?: number;
  // Percentage of pages that must be sparse to trigger OCR
  sparsePageThreshold?: number;
  // Minimum text density (chars per page area) to avoid OCR
  minTextDensity?: number;
  // Check for images in PDF
  checkForImages?: boolean;
}

const DEFAULT_OPTIONS: Required<OCRDetectionOptions> = {
  minCharsPerPage: 50,
  sparsePageThreshold: 0.3, // 30% of pages are sparse
  minTextDensity: 0.1, // chars per 1000 pixels²
  checkForImages: true,
};

/**
 * Detects if a PDF needs OCR processing based on text content quality
 *
 * @param pdf PDF document proxy
 * @param extractedText Extracted text from the PDF (if any)
 * @param options Detection options
 * @returns Detection result with reasoning
 */
export async function needsOCR(
  pdf: PDFDocumentProxy,
  extractedText: string,
  options: OCRDetectionOptions = {}
): Promise<OCRDetectionResult> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const totalPages = pdf.numPages;

  // Initialize detection result
  const result: OCRDetectionResult = {
    needsOCR: false,
    confidence: 0,
    reason: '',
    textDensity: 0,
    hasImages: false,
    sparsePagesCount: 0,
    totalPages,
    sparsePages: [],
  };

  // Check 1: Empty or extremely sparse text
  const totalChars = extractedText.trim().length;
  const avgCharsPerPage = totalChars / totalPages;

  if (totalChars === 0) {
    result.needsOCR = true;
    result.confidence = 1.0;
    result.reason = 'No text content found in PDF - likely fully scanned document';
    return result;
  }

  if (avgCharsPerPage < opts.minCharsPerPage) {
    result.needsOCR = true;
    result.confidence = 0.9;
    result.reason = `Very sparse text (${avgCharsPerPage.toFixed(1)} chars/page) - likely scanned with minimal text layer`;
    return result;
  }

  // Check 2: Analyze individual pages for sparseness
  const sparsePages: number[] = [];
  let totalTextDensity = 0;

  for (let i = 1; i <= totalPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const viewport = page.getViewport({ scale: 1.0 });
    const pageArea = viewport.width * viewport.height;

    // Count characters on this page
    const pageText = textContent.items
      .map((item: any) => ('str' in item ? item.str : ''))
      .join('');
    const pageChars = pageText.trim().length;

    // Calculate text density (chars per 1000 pixels²)
    const density = (pageChars / pageArea) * 1000;
    totalTextDensity += density;

    if (pageChars < opts.minCharsPerPage || density < opts.minTextDensity) {
      sparsePages.push(i);
    }
  }

  result.textDensity = totalTextDensity / totalPages;
  result.sparsePages = sparsePages;
  result.sparsePagesCount = sparsePages.length;

  const sparsePageRatio = sparsePages.length / totalPages;

  if (sparsePageRatio >= opts.sparsePageThreshold) {
    result.needsOCR = true;
    result.confidence = Math.min(0.8, sparsePageRatio);
    result.reason = `${sparsePages.length} of ${totalPages} pages have sparse text (${(sparsePageRatio * 100).toFixed(1)}%) - likely scanned document with poor text layer`;
    return result;
  }

  // Check 3: Check for images (indicates scanned pages)
  if (opts.checkForImages) {
    let imageCount = 0;

    // Sample first 3 pages to check for images
    const pagesToCheck = Math.min(3, totalPages);
    for (let i = 1; i <= pagesToCheck; i++) {
      const page = await pdf.getPage(i);
      const ops = await page.getOperatorList();

      // Check for image operators (paintImageXObject, etc.)
      for (let j = 0; j < ops.fnArray.length; j++) {
        const fn = ops.fnArray[j];
        // 85 = paintXObject (images), 86 = paintImageXObject
        if (fn === 85 || fn === 86) {
          imageCount++;
        }
      }
    }

    result.hasImages = imageCount > 0;

    // If we have images AND sparse text, likely needs OCR
    if (imageCount > 0 && sparsePageRatio > 0.1) {
      result.needsOCR = true;
      result.confidence = 0.7;
      result.reason = `Document contains images with relatively sparse text - may benefit from OCR`;
      return result;
    }
  }

  // If we got here, document has sufficient text
  result.needsOCR = false;
  result.confidence = 0.9;
  result.reason = `Document has sufficient native text (${avgCharsPerPage.toFixed(1)} chars/page, density: ${result.textDensity.toFixed(3)})`;

  return result;
}

/**
 * Detects which specific pages need OCR
 * Useful for hybrid extraction (some pages native text, some OCR)
 *
 * @param pdf PDF document proxy
 * @param options Detection options
 * @returns Array of page numbers that need OCR (1-indexed)
 */
export async function detectPagesNeedingOCR(
  pdf: PDFDocumentProxy,
  options: OCRDetectionOptions = {}
): Promise<number[]> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const pagesNeedingOCR: number[] = [];
  const totalPages = pdf.numPages;

  for (let i = 1; i <= totalPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const viewport = page.getViewport({ scale: 1.0 });
    const pageArea = viewport.width * viewport.height;

    // Count characters on this page
    const pageText = textContent.items
      .map((item: any) => ('str' in item ? item.str : ''))
      .join('');
    const pageChars = pageText.trim().length;

    // Calculate text density
    const density = (pageChars / pageArea) * 1000;

    if (pageChars < opts.minCharsPerPage || density < opts.minTextDensity) {
      pagesNeedingOCR.push(i);
    }
  }

  return pagesNeedingOCR;
}

/**
 * Quick check if text is suspiciously sparse for a Tibetan document
 * Can be used before full PDF analysis
 *
 * @param text Extracted text
 * @param pageCount Number of pages
 * @returns True if text seems too sparse
 */
export function isTextSparse(text: string, pageCount: number): boolean {
  const totalChars = text.trim().length;
  const avgCharsPerPage = totalChars / pageCount;

  // Tibetan documents typically have 500-2000+ chars per page
  // If less than 100 chars per page, likely needs OCR
  return avgCharsPerPage < 100;
}
