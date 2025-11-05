// File: server/services/extraction/types.ts
// Type definitions for PDF text extraction

/**
 * Metadata about extracted text
 */
export interface ExtractionMetadata {
  /** Number of pages in the PDF */
  pageCount: number;

  /** Layout type detected */
  layout: 'single-column' | 'multi-column' | 'complex';

  /** Extraction quality assessment */
  quality: 'high' | 'medium' | 'low' | 'scanned';

  /** Method used for extraction */
  extractionMethod: 'native' | 'position-aware' | 'ocr';

  /** Whether PDF contains images */
  hasImages: boolean;

  /** Primary language detected */
  language?: string;

  /** Number of columns (for multi-column layouts) */
  columns?: number;

  /** Reading order direction */
  readingOrder?: 'ltr' | 'rtl' | 'ttb';

  /** Whether position data was available */
  hasPositionData?: boolean;

  /** Text blocks with position information */
  textBlocks?: TextBlock[];
}

/**
 * Result of text extraction
 */
export interface ExtractedText {
  /** Extracted and cleaned text */
  text: string;

  /** Metadata about the extraction */
  metadata: ExtractionMetadata;

  /** Warnings encountered during extraction */
  warnings?: string[];
}

/**
 * Text block with position information
 */
export interface TextBlock {
  /** Text content */
  text: string;

  /** X coordinate */
  x: number;

  /** Y coordinate */
  y: number;

  /** Width */
  width: number;

  /** Height */
  height: number;

  /** Page number */
  pageNumber: number;

  /** Font size */
  fontSize?: number;
}

/**
 * Detected artifact pattern
 */
export interface ArtifactPattern {
  /** Pattern text */
  text: string;

  /** Number of occurrences */
  occurrences: number;

  /** Pattern type */
  type: 'header' | 'footer' | 'page-number' | 'watermark' | 'unknown';

  /** Confidence that this is an artifact (0-1) */
  confidence: number;
}

/**
 * Options for text extraction
 */
export interface ExtractionOptions {
  /** Whether to remove artifacts */
  removeArtifacts?: boolean;

  /** Whether to use position-aware extraction */
  usePositionData?: boolean;

  /** Whether to normalize Unicode */
  normalizeUnicode?: boolean;

  /** Maximum pages to extract (0 = all) */
  maxPages?: number;
}
