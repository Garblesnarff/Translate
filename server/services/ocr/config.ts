// File: server/services/ocr/config.ts
// OCR configuration and constants

import type { OCRConfig } from './types';

/**
 * Default OCR configuration for Tibetan text
 */
export const DEFAULT_OCR_CONFIG: OCRConfig = {
  // Language: Tibetan (bod) + English (eng) for mixed content
  lang: 'bod+eng',

  // High DPI for quality OCR
  dpi: 300,

  // Page segmentation mode: 3 = Fully automatic page segmentation (default)
  psm: 3,

  // OCR engine mode: 1 = LSTM neural net mode (most accurate)
  oem: 1,
};

/**
 * OCR quality thresholds
 */
export const QUALITY_THRESHOLDS = {
  /** Minimum acceptable quality score */
  MIN_QUALITY: 0.6,

  /** Minimum Tibetan character ratio for Tibetan documents */
  MIN_TIBETAN_RATIO: 0.3,

  /** Minimum confidence for individual words */
  MIN_WORD_CONFIDENCE: 0.5,

  /** High quality threshold */
  HIGH_QUALITY: 0.8,
};

/**
 * Text sparsity threshold
 * If average characters per page is below this, OCR is likely needed
 */
export const SPARSE_TEXT_THRESHOLD = 50;

/**
 * Common Tibetan OCR error corrections
 * Maps commonly misrecognized characters to correct Tibetan characters
 */
export const OCR_CORRECTIONS: Record<string, string> = {
  // Latin vowels mistaken for Tibetan vowel signs
  'o': 'ོ', // Latin o → Tibetan vowel sign o (U+0F7C)
  'i': 'ི', // Latin i → Tibetan vowel sign i (U+0F72)
  'u': 'ུ', // Latin u → Tibetan vowel sign u (U+0F74)
  'e': 'ེ', // Latin e → Tibetan vowel sign e (U+0F7A)

  // Punctuation
  '|': '།', // Pipe → shad (U+0F0D)
  '/': '་', // Slash → tsek (U+0F0B)

  // Numbers mistaken for Tibetan
  '0': 'ོ', // Zero → vowel o
  '1': '།', // One → shad
};

/**
 * Suspicious OCR patterns that indicate poor quality
 */
export const SUSPICIOUS_PATTERNS = [
  /\|{3,}/, // Multiple pipes
  /\/{3,}/, // Multiple slashes
  /o{3,}/i, // Multiple 'o' letters (likely vowel signs)
  /i{3,}/i, // Multiple 'i' letters (likely vowel signs)
  /\d{5,}/, // Long number sequences (unlikely in text)
];

/**
 * Batch processing configuration
 */
export const BATCH_CONFIG = {
  /** Maximum parallel OCR workers */
  MAX_PARALLELISM: 4,

  /** Progress update interval (number of pages) */
  PROGRESS_INTERVAL: 5,
};

/**
 * Cache configuration for OCR results
 */
export const CACHE_CONFIG = {
  /** Cache TTL: 30 days in milliseconds */
  TTL: 30 * 24 * 60 * 60 * 1000,

  /** Minimum quality to cache */
  MIN_QUALITY_TO_CACHE: 0.6,

  /** Cache key prefix */
  KEY_PREFIX: 'ocr:',
};

/**
 * Image preprocessing configuration
 */
export const IMAGE_CONFIG = {
  /** DPI for rendering PDF pages */
  RENDER_DPI: 300,

  /** Image format for OCR */
  FORMAT: 'PNG',

  /** Brightness adjustment (-1 to 1, 0 = no change) */
  BRIGHTNESS: 0,

  /** Contrast adjustment (-1 to 1, 0 = no change) */
  CONTRAST: 0.1,

  /** Whether to apply denoising */
  DENOISE: false,
};

/**
 * Get OCR config with optional overrides
 */
export function getOCRConfig(overrides?: Partial<OCRConfig>): OCRConfig {
  return {
    ...DEFAULT_OCR_CONFIG,
    ...overrides,
  };
}
