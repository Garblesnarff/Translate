// File: server/services/ocr/OCRService.ts
// OCR service using Tesseract.js for scanned PDFs

import { createWorker, type Worker } from 'tesseract.js';
import type { OCRResult, OCRConfig, BatchOptions } from './types';
import {
  DEFAULT_OCR_CONFIG,
  SPARSE_TEXT_THRESHOLD,
  OCR_CORRECTIONS,
  BATCH_CONFIG,
} from './config';

/**
 * OCRService for extracting text from scanned PDFs
 *
 * Features:
 * - Detects when OCR is needed (sparse text)
 * - Extracts text using Tesseract.js
 * - Post-processes to fix common OCR errors
 * - Parallel processing for batch operations
 * - Progress tracking for long documents
 */
export class OCRService {
  private config: OCRConfig;
  private worker: Worker | null = null;
  private workerInitialized = false;

  /**
   * Create a new OCRService
   *
   * @param config - OCR configuration
   */
  constructor(config?: Partial<OCRConfig>) {
    this.config = {
      ...DEFAULT_OCR_CONFIG,
      ...config,
    };
  }

  /**
   * Detect if OCR is needed based on text sparsity
   *
   * @param text - Extracted text from PDF
   * @param pageCount - Number of pages
   * @returns True if OCR is needed
   */
  needsOCR(text: string, pageCount: number): boolean {
    if (pageCount === 0) {
      return false;
    }

    // Calculate average characters per page
    const avgCharsPerPage = text.trim().length / pageCount;

    // If less than threshold, likely a scanned PDF
    return avgCharsPerPage < SPARSE_TEXT_THRESHOLD;
  }

  /**
   * Process a single page with OCR
   *
   * @param pageBuffer - Page image buffer
   * @returns OCR result with text and confidence
   */
  async processPage(pageBuffer: Buffer): Promise<OCRResult> {
    try {
      // Initialize worker if needed
      if (!this.workerInitialized) {
        await this.initializeWorker();
      }

      // Handle empty buffer
      if (!pageBuffer || pageBuffer.length === 0) {
        return {
          text: '',
          confidence: 0,
          quality: 0,
        };
      }

      // Perform OCR
      const result = await this.worker!.recognize(pageBuffer);

      // Extract text and confidence
      const rawText = result.data.text || '';
      const confidence = (result.data.confidence || 0) / 100; // Convert to 0-1 range

      // Post-process to fix common errors
      const cleanedText = this.postProcess(rawText);

      return {
        text: cleanedText,
        confidence,
        quality: confidence, // Quality initially same as confidence
        words: result.data.words?.map((word) => ({
          text: word.text,
          confidence: word.confidence / 100,
        })),
      };
    } catch (error) {
      console.error('[OCRService] Error processing page:', error);
      return {
        text: '',
        confidence: 0,
        quality: 0,
      };
    }
  }

  /**
   * Process multiple pages in parallel
   *
   * @param pageBuffers - Array of page image buffers
   * @param options - Batch processing options
   * @returns Array of OCR results
   */
  async processBatch(
    pageBuffers: Buffer[],
    options: BatchOptions = {}
  ): Promise<OCRResult[]> {
    const { onProgress, parallelism = BATCH_CONFIG.MAX_PARALLELISM } = options;

    if (pageBuffers.length === 0) {
      return [];
    }

    const results: OCRResult[] = [];
    let completed = 0;

    // Process in batches of N pages at a time
    for (let i = 0; i < pageBuffers.length; i += parallelism) {
      const batch = pageBuffers.slice(i, i + parallelism);

      // Process batch in parallel
      const batchResults = await Promise.all(
        batch.map((buffer) => this.processPage(buffer))
      );

      results.push(...batchResults);

      // Update progress
      completed += batch.length;
      if (onProgress) {
        const progress = Math.round((completed / pageBuffers.length) * 100);
        onProgress(progress);
      }
    }

    return results;
  }

  /**
   * Post-process OCR text to fix common errors
   *
   * @param text - Raw OCR text
   * @returns Cleaned text
   */
  postProcess(text: string): string {
    if (!text) {
      return '';
    }

    let cleaned = text;

    // Apply common corrections
    for (const [wrong, correct] of Object.entries(OCR_CORRECTIONS)) {
      // Use regex to replace all occurrences
      // Escape special regex characters
      const escapedWrong = wrong.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(escapedWrong, 'g');
      cleaned = cleaned.replace(regex, correct);
    }

    return cleaned;
  }

  /**
   * Get current OCR configuration
   *
   * @returns OCR configuration
   */
  getConfig(): OCRConfig {
    return { ...this.config };
  }

  /**
   * Initialize Tesseract worker
   */
  private async initializeWorker(): Promise<void> {
    if (this.workerInitialized) {
      return;
    }

    try {
      this.worker = await createWorker(this.config.lang);

      // Set OCR parameters
      await this.worker.setParameters({
        tessedit_pageseg_mode: this.config.psm.toString(),
        tessedit_ocr_engine_mode: this.config.oem.toString(),
      });

      this.workerInitialized = true;
    } catch (error) {
      console.error('[OCRService] Failed to initialize Tesseract worker:', error);
      throw new Error('Failed to initialize OCR service');
    }
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    if (this.worker) {
      await this.worker.terminate();
      this.worker = null;
      this.workerInitialized = false;
    }
  }
}
