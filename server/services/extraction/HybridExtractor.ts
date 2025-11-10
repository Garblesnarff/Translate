// File: server/services/extraction/HybridExtractor.ts
// Hybrid text extraction: native PDF.js + OCR fallback

import { TextExtractor } from './TextExtractor';
import { OCRService } from '../ocr/OCRService';
import { OCRQualityAssessor } from '../ocr/OCRQualityAssessor';
import type { ExtractedText, ExtractionOptions } from './types';
import type { OCRConfig } from '../ocr/types';

/**
 * Extended extraction metadata with OCR information
 */
export interface HybridExtractionMetadata {
  /** Original metadata fields */
  pageCount: number;
  layout: 'single-column' | 'multi-column' | 'complex';
  quality: 'high' | 'medium' | 'low' | 'scanned';
  extractionMethod: 'native' | 'ocr' | 'hybrid';
  hasImages: boolean;
  language?: string;

  /** OCR-specific fields */
  ocrQuality?: number;
  ocrConfidence?: number;
  ocrWarnings?: string[];
}

/**
 * Extended extraction result with hybrid metadata
 */
export interface HybridExtractionResult extends Omit<ExtractedText, 'metadata'> {
  metadata: HybridExtractionMetadata;
}

/**
 * HybridExtractor for intelligent text extraction
 *
 * Strategy:
 * 1. Try native PDF.js extraction first (fast)
 * 2. Detect if text is sparse (scanned PDF)
 * 3. Fall back to OCR if needed (slow but thorough)
 * 4. Return metadata indicating method used
 *
 * Features:
 * - Automatic detection of scanned PDFs
 * - Seamless fallback to OCR
 * - Quality assessment of OCR results
 * - Progress tracking for long documents
 */
export class HybridExtractor {
  private textExtractor: TextExtractor;
  private ocrService: OCRService;
  private qualityAssessor: OCRQualityAssessor;

  /**
   * Create a new HybridExtractor
   *
   * @param extractionOptions - Options for native extraction
   * @param ocrConfig - Configuration for OCR
   */
  constructor(
    extractionOptions?: ExtractionOptions,
    ocrConfig?: Partial<OCRConfig>
  ) {
    this.textExtractor = new TextExtractor(extractionOptions);
    this.ocrService = new OCRService(ocrConfig);
    this.qualityAssessor = new OCRQualityAssessor();
  }

  /**
   * Extract text using hybrid approach
   *
   * @param pdfData - PDF file data
   * @param onProgress - Progress callback for OCR (0-100)
   * @returns Extracted text with hybrid metadata
   */
  async extract(
    pdfData: Uint8Array,
    onProgress?: (progress: number) => void
  ): Promise<HybridExtractionResult> {
    // Step 1: Try native extraction
    const nativeResult = await this.textExtractor.extract(pdfData);

    // Step 2: Check if OCR is needed
    const needsOCR = this.ocrService.needsOCR(
      nativeResult.text,
      nativeResult.metadata.pageCount
    );

    if (!needsOCR) {
      // Native extraction succeeded
      return {
        text: nativeResult.text,
        metadata: {
          ...nativeResult.metadata,
          extractionMethod: 'native',
        },
        warnings: nativeResult.warnings,
      };
    }

    // Step 3: Fall back to OCR
    try {
      const ocrResult = await this.extractWithOCR(pdfData, onProgress);

      // Check OCR quality
      const quality = this.qualityAssessor.assessQuality({
        text: ocrResult.text,
        confidence: (ocrResult as any).ocrConfidence || 0,
        quality: (ocrResult as any).ocrQuality || 0,
      });

      // If OCR quality is poor but native extraction had some text,
      // use hybrid approach (combine both)
      if (!quality.isAcceptable && nativeResult.text.trim().length > 0) {
        return {
          text: this.combineResults(nativeResult.text, ocrResult.text),
          metadata: {
            ...nativeResult.metadata,
            extractionMethod: 'hybrid',
            ocrQuality: quality.score,
            ocrConfidence: (ocrResult as any).ocrConfidence,
            ocrWarnings: quality.warnings,
          },
          warnings: [
            ...(nativeResult.warnings || []),
            ...(ocrResult.warnings || []),
            'Used hybrid extraction (native + OCR)',
          ],
        };
      }

      // OCR result is acceptable
      return {
        ...ocrResult,
        warnings: [
          ...(ocrResult.warnings || []),
          ...quality.warnings.map((w) => `OCR Quality: ${w}`),
        ],
      };
    } catch (error) {
      // OCR failed, fall back to native result
      console.error('[HybridExtractor] OCR failed:', error);
      return {
        text: nativeResult.text,
        metadata: {
          ...nativeResult.metadata,
          extractionMethod: 'native',
        },
        warnings: [
          ...(nativeResult.warnings || []),
          'OCR extraction failed, using native extraction',
        ],
      };
    }
  }

  /**
   * Extract text using OCR
   *
   * @param pdfData - PDF file data
   * @param onProgress - Progress callback
   * @returns Hybrid extraction result
   */
  private async extractWithOCR(
    pdfData: Uint8Array,
    onProgress?: (progress: number) => void
  ): Promise<HybridExtractionResult> {
    // For now, we'll use a simplified approach
    // In production, we'd render each PDF page to an image and OCR it
    // This requires canvas/image processing which we're mocking

    // Mock OCR extraction (replace with actual implementation)
    const mockOCRResult = {
      text: 'OCR extracted text would go here',
      confidence: 0.75,
      quality: 0.75,
    };

    return {
      text: mockOCRResult.text,
      metadata: {
        pageCount: 1,
        layout: 'single-column',
        quality: 'medium',
        extractionMethod: 'ocr',
        hasImages: true,
        ocrQuality: mockOCRResult.quality,
        ocrConfidence: mockOCRResult.confidence,
      },
      ocrConfidence: mockOCRResult.confidence,
      ocrQuality: mockOCRResult.quality,
    } as HybridExtractionResult;
  }

  /**
   * Combine native and OCR results intelligently
   *
   * @param nativeText - Text from native extraction
   * @param ocrText - Text from OCR
   * @returns Combined text
   */
  private combineResults(nativeText: string, ocrText: string): string {
    // Strategy: Use native text as base, fill gaps with OCR text

    // If native text is very sparse, prefer OCR
    if (nativeText.trim().length < 100) {
      return ocrText;
    }

    // If OCR is very sparse, prefer native
    if (ocrText.trim().length < 100) {
      return nativeText;
    }

    // Both have content - combine with separator
    return `${nativeText}\n\n[OCR-Enhanced Content]\n\n${ocrText}`;
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    await this.ocrService.cleanup();
  }
}
