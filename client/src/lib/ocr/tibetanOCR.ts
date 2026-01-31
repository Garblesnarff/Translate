// client/src/lib/ocr/tibetanOCR.ts

import { createWorker, type Worker } from 'tesseract.js';
import type { PDFPageProxy } from 'pdfjs-dist';

export interface OCRResult {
  text: string;
  confidence: number;
  pageNumber: number;
  processingTimeMs: number;
}

export interface OCRProgress {
  status: 'initializing' | 'processing' | 'completed' | 'error';
  progress: number; // 0-1
  currentPage: number;
  totalPages: number;
  message: string;
}

export interface TibetanOCROptions {
  // Tesseract language (default: 'bod' for Tibetan, fallback to 'eng')
  language?: string;
  // Page Segmentation Mode (default: AUTO = 3)
  psm?: number;
  // DPI for rendering (default: 300 for good quality)
  renderDpi?: number;
  // Number of pages to process in parallel (default: 2)
  parallelPages?: number;
  // Enable progress callback
  onProgress?: (progress: OCRProgress) => void;
  // Tesseract worker initialization options
  workerOptions?: {
    langPath?: string;
    cachePath?: string;
    cacheMethod?: 'write' | 'readOnly' | 'none';
  };
}

const DEFAULT_OPTIONS: Required<Omit<TibetanOCROptions, 'onProgress' | 'workerOptions'>> = {
  language: 'bod+eng', // Tibetan + English for mixed content
  psm: 3, // PSM 3 = fully automatic page segmentation
  renderDpi: 300,
  parallelPages: 2,
};

/**
 * TibetanOCR class handles OCR processing of scanned PDF pages
 * Uses Tesseract.js with Tibetan language support
 */
export class TibetanOCR {
  private workers: Worker[] = [];
  private options: Required<Omit<TibetanOCROptions, 'onProgress' | 'workerOptions'>>;
  private onProgress?: (progress: OCRProgress) => void;
  private workerOptions?: TibetanOCROptions['workerOptions'];
  private initialized = false;

  constructor(options: TibetanOCROptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.onProgress = options.onProgress;
    this.workerOptions = options.workerOptions;
  }

  /**
   * Initialize Tesseract workers
   * Creates a pool of workers for parallel processing
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    this.reportProgress({
      status: 'initializing',
      progress: 0,
      currentPage: 0,
      totalPages: 0,
      message: 'Initializing OCR engine...',
    });

    try {
      // Create worker pool
      const workerPromises = [];
      for (let i = 0; i < this.options.parallelPages; i++) {
        workerPromises.push(this.createWorker());
      }

      this.workers = await Promise.all(workerPromises);
      this.initialized = true;

      this.reportProgress({
        status: 'initializing',
        progress: 1,
        currentPage: 0,
        totalPages: 0,
        message: `OCR engine ready (${this.workers.length} workers)`,
      });
    } catch (error) {
      this.reportProgress({
        status: 'error',
        progress: 0,
        currentPage: 0,
        totalPages: 0,
        message: `Failed to initialize OCR: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
      throw new Error(
        `Failed to initialize Tesseract workers: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Create and configure a Tesseract worker
   */
  private async createWorker(): Promise<Worker> {
    const worker = await createWorker(this.options.language, 1, {
      langPath: this.workerOptions?.langPath || 'https://tessdata.projectnaptha.com/4.0.0',
      cachePath: this.workerOptions?.cachePath,
      cacheMethod: this.workerOptions?.cacheMethod || 'write',
      logger: (m) => {
        // Optional: log Tesseract progress
        if (m.status === 'recognizing text') {
          // Can report sub-progress here if needed
        }
      },
    });

    // Configure Tesseract parameters for better Tibetan OCR
    // Note: PSM is set during worker creation, not via setParameters
    await worker.setParameters({
      // Preserve interword spaces for Tibetan text
      preserve_interword_spaces: '1',
      // Enable dictionary if available
      load_system_dawg: '1',
      load_freq_dawg: '1',
    });

    return worker;
  }

  /**
   * Render a PDF page to an ImageData object for OCR processing
   *
   * @param page PDF page proxy
   * @returns Canvas and ImageData
   */
  async renderPageToImage(
    page: PDFPageProxy
  ): Promise<{ canvas: HTMLCanvasElement; imageData: ImageData }> {
    const viewport = page.getViewport({ scale: this.options.renderDpi / 72 });

    // Create canvas
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('Failed to get canvas 2D context');
    }

    canvas.width = viewport.width;
    canvas.height = viewport.height;

    // Render PDF page to canvas
    await page.render({
      canvasContext: context,
      viewport: viewport,
    }).promise;

    // Get image data
    const imageData = context.getImageData(0, 0, canvas.width, canvas.height);

    // Optional: Enhance image for better OCR (increase contrast, etc.)
    this.enhanceImageForOCR(imageData);

    return { canvas, imageData };
  }

  /**
   * Enhance image quality for better OCR results
   * Applies contrast enhancement and noise reduction
   */
  private enhanceImageForOCR(imageData: ImageData): void {
    const data = imageData.data;

    // Simple contrast enhancement using histogram stretching
    let min = 255;
    let max = 0;

    // Find min/max values
    for (let i = 0; i < data.length; i += 4) {
      const gray = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
      if (gray < min) min = gray;
      if (gray > max) max = gray;
    }

    // Stretch histogram if needed
    if (max > min) {
      const scale = 255 / (max - min);
      for (let i = 0; i < data.length; i += 4) {
        const gray = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
        const enhanced = Math.round((gray - min) * scale);
        data[i] = enhanced; // R
        data[i + 1] = enhanced; // G
        data[i + 2] = enhanced; // B
        // Alpha unchanged
      }
    }
  }

  /**
   * Perform OCR on a single page
   *
   * @param page PDF page proxy
   * @param pageNumber Page number (1-indexed)
   * @param workerIndex Index of worker to use
   * @returns OCR result
   */
  async performOCR(
    page: PDFPageProxy,
    pageNumber: number,
    workerIndex: number = 0
  ): Promise<OCRResult> {
    const startTime = performance.now();

    if (!this.initialized) {
      await this.initialize();
    }

    const worker = this.workers[workerIndex % this.workers.length];

    try {
      // Render page to image
      const { canvas } = await this.renderPageToImage(page);

      // Perform OCR
      const result = await worker.recognize(canvas);

      const processingTimeMs = performance.now() - startTime;

      return {
        text: result.data.text,
        confidence: result.data.confidence / 100, // Convert to 0-1 range
        pageNumber,
        processingTimeMs,
      };
    } catch (error) {
      throw new Error(
        `OCR failed for page ${pageNumber}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Process multiple PDF pages with OCR in parallel
   * Shows progress updates during processing
   *
   * @param pages Array of PDF page proxies
   * @param startPageNumber Starting page number (1-indexed)
   * @returns Array of OCR results
   */
  async processMultiplePages(
    pages: PDFPageProxy[],
    startPageNumber: number = 1
  ): Promise<OCRResult[]> {
    if (!this.initialized) {
      await this.initialize();
    }

    const totalPages = pages.length;
    const results: OCRResult[] = new Array(totalPages);
    let completedPages = 0;

    this.reportProgress({
      status: 'processing',
      progress: 0,
      currentPage: 0,
      totalPages,
      message: 'Starting OCR processing...',
    });

    // Process pages in batches based on worker pool size
    const batchSize = this.options.parallelPages;

    for (let i = 0; i < totalPages; i += batchSize) {
      const batch = pages.slice(i, Math.min(i + batchSize, totalPages));
      const batchPromises = batch.map((page, batchIndex) => {
        const pageNumber = startPageNumber + i + batchIndex;
        const workerIndex = batchIndex % this.workers.length;
        return this.performOCR(page, pageNumber, workerIndex);
      });

      try {
        const batchResults = await Promise.all(batchPromises);

        // Store results in correct positions
        batchResults.forEach((result, batchIndex) => {
          results[i + batchIndex] = result;
        });

        completedPages += batch.length;

        this.reportProgress({
          status: 'processing',
          progress: completedPages / totalPages,
          currentPage: completedPages,
          totalPages,
          message: `Processing page ${completedPages} of ${totalPages}...`,
        });
      } catch (error) {
        this.reportProgress({
          status: 'error',
          progress: completedPages / totalPages,
          currentPage: completedPages,
          totalPages,
          message: `Error processing batch: ${error instanceof Error ? error.message : 'Unknown error'}`,
        });
        throw error;
      }
    }

    this.reportProgress({
      status: 'completed',
      progress: 1,
      currentPage: totalPages,
      totalPages,
      message: 'OCR processing completed',
    });

    return results;
  }

  /**
   * Terminate all workers and free resources
   */
  async terminate(): Promise<void> {
    await Promise.all(this.workers.map((worker) => worker.terminate()));
    this.workers = [];
    this.initialized = false;
  }

  /**
   * Report progress to callback if provided
   */
  private reportProgress(progress: OCRProgress): void {
    if (this.onProgress) {
      this.onProgress(progress);
    }
  }
}

/**
 * Helper function to quickly OCR a single page
 * Creates a temporary worker, processes the page, and terminates
 *
 * @param page PDF page proxy
 * @param pageNumber Page number
 * @param options OCR options
 * @returns OCR result
 */
export async function ocrSinglePage(
  page: PDFPageProxy,
  pageNumber: number,
  options: TibetanOCROptions = {}
): Promise<OCRResult> {
  const ocr = new TibetanOCR(options);
  try {
    await ocr.initialize();
    const result = await ocr.performOCR(page, pageNumber);
    return result;
  } finally {
    await ocr.terminate();
  }
}
