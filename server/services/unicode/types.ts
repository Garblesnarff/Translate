// File: server/services/unicode/types.ts
// Type definitions for Unicode validation

/**
 * Result of Unicode validation
 */
export interface ValidationResult {
  /** Whether text is valid */
  isValid: boolean;

  /** Validation errors */
  errors: string[];

  /** Validation warnings */
  warnings: string[];

  /** Normalized text (NFC form) */
  normalized: string;

  /** Percentage of Tibetan characters (0-100) */
  tibetanPercentage: number;

  /** Whether corruption was detected */
  hasCorruption?: boolean;
}
