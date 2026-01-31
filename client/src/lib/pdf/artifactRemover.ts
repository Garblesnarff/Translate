// client/src/lib/pdf/artifactRemover.ts

/**
 * PDF artifact detection and removal
 *
 * PDFs often contain artifacts that should not be part of the main text:
 * - Page numbers
 * - Headers and footers
 * - Watermarks
 * - Margin notes
 * - Running titles
 */

/**
 * Pattern detected in PDF pages
 */
export interface ArtifactPattern {
  type: 'header' | 'footer' | 'page_number' | 'watermark' | 'margin';
  pattern: RegExp;
  locations: number[]; // Page numbers where found
  confidence: number; // 0-1, how confident we are this is an artifact
  text: string; // Example text matching the pattern
}

/**
 * Configuration for artifact detection
 */
export interface ArtifactRemovalConfig {
  /** Minimum number of pages where pattern must appear to be considered artifact */
  minRepetitions: number;

  /** Check for page numbers */
  detectPageNumbers: boolean;

  /** Check for headers */
  detectHeaders: boolean;

  /** Check for footers */
  detectFooters: boolean;

  /** Check for watermarks */
  detectWatermarks: boolean;

  /** Number of lines to check at top of page for headers */
  headerLines: number;

  /** Number of lines to check at bottom of page for footers */
  footerLines: number;
}

const DEFAULT_CONFIG: ArtifactRemovalConfig = {
  minRepetitions: 3,
  detectPageNumbers: true,
  detectHeaders: true,
  detectFooters: true,
  detectWatermarks: true,
  headerLines: 3,
  footerLines: 3,
};

/**
 * Common page number patterns
 */
const PAGE_NUMBER_PATTERNS = [
  /^-?\s*\d+\s*-?$/,                    // "- 5 -", "5", " 5 "
  /^Page\s+\d+$/i,                       // "Page 5"
  /^\d+\s*\/\s*\d+$/,                   // "5/120"
  /^\[\s*\d+\s*\]$/,                    // "[5]"
  /^-\s*\d+\s*-$/,                      // "- 5 -"
  /^\d+\s*of\s+\d+$/i,                  // "5 of 120"
];

/**
 * PDFArtifactRemover detects and removes repeating headers, footers,
 * and other artifacts from PDF text extraction
 */
export class PDFArtifactRemover {
  private config: ArtifactRemovalConfig;
  private detectedPatterns: ArtifactPattern[] = [];

  constructor(config: Partial<ArtifactRemovalConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Analyze multiple pages to detect artifact patterns
   */
  analyzePages(pages: string[]): ArtifactPattern[] {
    this.detectedPatterns = [];

    if (pages.length < this.config.minRepetitions) {
      return this.detectedPatterns;
    }

    // Detect page numbers
    if (this.config.detectPageNumbers) {
      this.detectPageNumbers(pages);
    }

    // Detect headers
    if (this.config.detectHeaders) {
      this.detectHeaders(pages);
    }

    // Detect footers
    if (this.config.detectFooters) {
      this.detectFooters(pages);
    }

    // Detect watermarks
    if (this.config.detectWatermarks) {
      this.detectWatermarks(pages);
    }

    return this.detectedPatterns;
  }

  /**
   * Remove detected artifacts from a page
   */
  cleanPage(pageText: string, pageNumber: number): string {
    let cleaned = pageText;

    for (const pattern of this.detectedPatterns) {
      // Only apply if pattern was found on this page or is common enough
      if (pattern.locations.includes(pageNumber) ||
          pattern.confidence > 0.8) {
        cleaned = cleaned.replace(pattern.pattern, '');
      }
    }

    // Clean up multiple blank lines
    cleaned = cleaned.replace(/\n{3,}/g, '\n\n');

    // Trim
    cleaned = cleaned.trim();

    return cleaned;
  }

  /**
   * Clean all pages using detected patterns
   */
  cleanAllPages(pages: string[]): string[] {
    // First analyze to detect patterns
    this.analyzePages(pages);

    // Then clean each page
    return pages.map((page, index) => this.cleanPage(page, index + 1));
  }

  /**
   * Get detected artifact patterns
   */
  getDetectedPatterns(): ArtifactPattern[] {
    return this.detectedPatterns;
  }

  /**
   * Detect page numbers in pages
   */
  private detectPageNumbers(pages: string[]): void {
    const pageNumberLocations = new Map<string, number[]>();

    for (let i = 0; i < pages.length; i++) {
      const lines = pages[i].split('\n');

      // Check first and last few lines for page numbers
      const linesToCheck = [
        ...lines.slice(0, 2),
        ...lines.slice(-2),
      ];

      for (const line of linesToCheck) {
        const trimmed = line.trim();

        for (const pattern of PAGE_NUMBER_PATTERNS) {
          if (pattern.test(trimmed)) {
            const key = pattern.source;
            if (!pageNumberLocations.has(key)) {
              pageNumberLocations.set(key, []);
            }
            pageNumberLocations.get(key)!.push(i + 1);

            // Also try to match the specific text
            const match = trimmed.match(pattern);
            if (match) {
              this.addPattern({
                type: 'page_number',
                pattern: new RegExp(this.escapeRegex(trimmed), 'g'),
                locations: [i + 1],
                confidence: 0.95,
                text: trimmed,
              });
            }
          }
        }
      }
    }
  }

  /**
   * Detect repeating headers
   */
  private detectHeaders(pages: string[]): void {
    const headerCandidates = new Map<string, number[]>();

    // Extract first N lines from each page
    for (let i = 0; i < pages.length; i++) {
      const lines = pages[i].split('\n');
      const headerLines = lines.slice(0, this.config.headerLines);

      for (const line of headerLines) {
        const trimmed = line.trim();
        if (trimmed.length > 3 && trimmed.length < 200) {
          if (!headerCandidates.has(trimmed)) {
            headerCandidates.set(trimmed, []);
          }
          headerCandidates.get(trimmed)!.push(i + 1);
        }
      }
    }

    // Find candidates that appear on multiple pages
    for (const [text, locations] of headerCandidates.entries()) {
      if (locations.length >= this.config.minRepetitions) {
        this.addPattern({
          type: 'header',
          pattern: new RegExp('^' + this.escapeRegex(text) + '\\n?', 'gm'),
          locations,
          confidence: this.calculateConfidence(locations.length, pages.length),
          text,
        });
      }
    }
  }

  /**
   * Detect repeating footers
   */
  private detectFooters(pages: string[]): void {
    const footerCandidates = new Map<string, number[]>();

    // Extract last N lines from each page
    for (let i = 0; i < pages.length; i++) {
      const lines = pages[i].split('\n');
      const footerLines = lines.slice(-this.config.footerLines);

      for (const line of footerLines) {
        const trimmed = line.trim();
        if (trimmed.length > 3 && trimmed.length < 200) {
          if (!footerCandidates.has(trimmed)) {
            footerCandidates.set(trimmed, []);
          }
          footerCandidates.get(trimmed)!.push(i + 1);
        }
      }
    }

    // Find candidates that appear on multiple pages
    for (const [text, locations] of footerCandidates.entries()) {
      if (locations.length >= this.config.minRepetitions) {
        this.addPattern({
          type: 'footer',
          pattern: new RegExp('\\n?' + this.escapeRegex(text) + '$', 'gm'),
          locations,
          confidence: this.calculateConfidence(locations.length, pages.length),
          text,
        });
      }
    }
  }

  /**
   * Detect watermarks (text that appears on many pages in the same position)
   */
  private detectWatermarks(pages: string[]): void {
    // Common watermark patterns
    const watermarkPatterns = [
      /CONFIDENTIAL/gi,
      /DRAFT/gi,
      /COPY/gi,
      /SAMPLE/gi,
      /WATERMARK/gi,
      /DO NOT DISTRIBUTE/gi,
    ];

    const watermarkLocations = new Map<string, number[]>();

    for (let i = 0; i < pages.length; i++) {
      for (const pattern of watermarkPatterns) {
        const matches = pages[i].match(pattern);
        if (matches) {
          for (const match of matches) {
            const key = match.toLowerCase();
            if (!watermarkLocations.has(key)) {
              watermarkLocations.set(key, []);
            }
            watermarkLocations.get(key)!.push(i + 1);
          }
        }
      }
    }

    // Add patterns that appear on many pages
    for (const [text, locations] of watermarkLocations.entries()) {
      if (locations.length >= this.config.minRepetitions) {
        this.addPattern({
          type: 'watermark',
          pattern: new RegExp(this.escapeRegex(text), 'gi'),
          locations,
          confidence: this.calculateConfidence(locations.length, pages.length),
          text,
        });
      }
    }
  }

  /**
   * Add a pattern, merging with existing similar patterns
   */
  private addPattern(pattern: ArtifactPattern): void {
    // Check if we already have a similar pattern
    const existing = this.detectedPatterns.find(
      p => p.type === pattern.type && this.isSimilarText(p.text, pattern.text)
    );

    if (existing) {
      // Merge locations
      existing.locations = Array.from(
        new Set([...existing.locations, ...pattern.locations])
      );
      // Update confidence
      existing.confidence = Math.max(existing.confidence, pattern.confidence);
    } else {
      this.detectedPatterns.push(pattern);
    }
  }

  /**
   * Calculate confidence based on repetition
   */
  private calculateConfidence(occurrences: number, totalPages: number): number {
    const ratio = occurrences / totalPages;

    // Very common (>80% of pages) = very high confidence
    if (ratio > 0.8) return 0.95;

    // Common (>50% of pages) = high confidence
    if (ratio > 0.5) return 0.85;

    // Somewhat common (>30% of pages) = medium confidence
    if (ratio > 0.3) return 0.70;

    // Less common = lower confidence
    return 0.5;
  }

  /**
   * Check if two texts are similar (for deduplication)
   */
  private isSimilarText(text1: string, text2: string): boolean {
    // Exact match
    if (text1 === text2) return true;

    // Similar length and high overlap
    const maxLen = Math.max(text1.length, text2.length);
    const minLen = Math.min(text1.length, text2.length);

    // If lengths differ significantly, not similar
    if (minLen / maxLen < 0.8) return false;

    // Calculate character overlap
    const shorter = text1.length < text2.length ? text1 : text2;
    const longer = text1.length >= text2.length ? text1 : text2;

    return longer.includes(shorter);
  }

  /**
   * Escape special regex characters
   */
  private escapeRegex(text: string): string {
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}

/**
 * Convenience function to clean pages
 */
export function removeArtifacts(
  pages: string[],
  config?: Partial<ArtifactRemovalConfig>
): { cleanedPages: string[]; patterns: ArtifactPattern[] } {
  const remover = new PDFArtifactRemover(config);
  const cleanedPages = remover.cleanAllPages(pages);
  const patterns = remover.getDetectedPatterns();

  return { cleanedPages, patterns };
}

/**
 * Detect artifacts without removing them (for analysis)
 */
export function detectArtifacts(
  pages: string[],
  config?: Partial<ArtifactRemovalConfig>
): ArtifactPattern[] {
  const remover = new PDFArtifactRemover(config);
  return remover.analyzePages(pages);
}

/**
 * Check if a line appears to be an artifact
 */
export function isLikelyArtifact(line: string): boolean {
  const trimmed = line.trim();

  // Empty or very short
  if (trimmed.length < 2) return false;

  // Check against page number patterns
  for (const pattern of PAGE_NUMBER_PATTERNS) {
    if (pattern.test(trimmed)) return true;
  }

  // Check for common artifact indicators
  const artifactIndicators = [
    /^page \d+/i,
    /^\d+\s*$/,
    /^-+$/,
    /^=+$/,
    /^\*+$/,
    /^_{3,}$/,
  ];

  for (const pattern of artifactIndicators) {
    if (pattern.test(trimmed)) return true;
  }

  return false;
}

/**
 * Split text into lines and remove artifact lines
 */
export function removeArtifactLines(text: string): string {
  const lines = text.split('\n');
  const cleaned = lines.filter(line => !isLikelyArtifact(line));
  return cleaned.join('\n');
}
