// File: server/services/ocr/types.ts
// Type definitions for OCR services

/**
 * OCR result with text and confidence
 */
export interface OCRResult {
  /** Extracted text */
  text: string;

  /** Overall confidence score (0-1) */
  confidence: number;

  /** Quality assessment score (0-1) */
  quality: number;

  /** Word-level results (optional) */
  words?: Array<{
    text: string;
    confidence: number;
  }>;
}

/**
 * OCR configuration for Tesseract.js
 */
export interface OCRConfig {
  /** Language(s) to use for OCR (e.g., 'bod+eng' for Tibetan + English) */
  lang: string;

  /** DPI for image rendering (higher = better quality, default: 300) */
  dpi: number;

  /** Page segmentation mode (default: 3 = fully automatic) */
  psm: number;

  /** OCR engine mode (default: 1 = LSTM neural net) */
  oem: number;
}

/**
 * Batch processing options
 */
export interface BatchOptions {
  /** Progress callback (0-100) */
  onProgress?: (progress: number) => void;

  /** Maximum parallel workers (default: 4) */
  parallelism?: number;
}

/**
 * OCR quality assessment
 */
export interface QualityAssessment {
  /** Overall quality score (0-1) */
  score: number;

  /** Tibetan character percentage */
  tibetanRatio: number;

  /** Average confidence from Tesseract */
  avgConfidence: number;

  /** Whether quality is acceptable (>0.6) */
  isAcceptable: boolean;

  /** Warnings about quality issues */
  warnings: string[];
}

/**
 * Cached OCR result
 */
export interface CachedOCRResult extends OCRResult {
  /** Cache key (SHA-256 hash of page image) */
  cacheKey: string;

  /** When cached */
  cachedAt: number;

  /** Cache TTL in milliseconds */
  ttl: number;
}
