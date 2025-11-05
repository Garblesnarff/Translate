// client/src/lib/tibetan/unicodeValidator.ts

import { isTibetanCharacter, getTibetanPercentage } from './syllableDetector';

/**
 * Unicode validation and normalization for Tibetan text
 */

/**
 * Tibetan Unicode blocks
 */
export const TIBETAN_UNICODE_BLOCKS = {
  main: {
    name: 'Tibetan',
    start: 0x0F00,
    end: 0x0FFF,
  },
  extensions: {
    name: 'Tibetan Extensions',
    start: 0x1000,
    end: 0x109F,
  },
};

/**
 * Common Unicode normalization forms
 */
export enum NormalizationForm {
  NFC = 'NFC',   // Canonical Composition
  NFD = 'NFD',   // Canonical Decomposition
  NFKC = 'NFKC', // Compatibility Composition
  NFKD = 'NFKD', // Compatibility Decomposition
}

/**
 * Unicode quality report for a text
 */
export interface UnicodeQualityReport {
  isValid: boolean;
  tibetanPercentage: number;
  totalCharacters: number;
  tibetanCharacters: number;
  corruptionIssues: CorruptionIssue[];
  hasProperEncoding: boolean;
  normalizationForm: string;
  recommendedNormalization: NormalizationForm;
}

/**
 * Types of Unicode corruption
 */
export enum CorruptionType {
  BROKEN_SEQUENCE = 'BROKEN_SEQUENCE',
  MOJIBAKE = 'MOJIBAKE',
  REPLACEMENT_CHAR = 'REPLACEMENT_CHAR',
  CONTROL_CHARS = 'CONTROL_CHARS',
  NULL_BYTES = 'NULL_BYTES',
  INVALID_COMBINING = 'INVALID_COMBINING',
  MIXED_ENCODING = 'MIXED_ENCODING',
}

/**
 * Corruption issue detected in text
 */
export interface CorruptionIssue {
  type: CorruptionType;
  position: number;
  length: number;
  context: string;
  description: string;
  severity: 'high' | 'medium' | 'low';
}

/**
 * Validate if text contains valid Tibetan characters
 */
export function isValidTibetanText(
  text: string,
  minTibetanPercentage: number = 0.5
): boolean {
  if (!text || text.length === 0) return false;

  const tibetanPercentage = getTibetanPercentage(text);
  return tibetanPercentage >= minTibetanPercentage;
}

/**
 * Normalize Tibetan Unicode text to a standard form
 * Default: NFC (Canonical Composition) - most common for Tibetan
 */
export function normalizeTibetanUnicode(
  text: string,
  form: NormalizationForm = NormalizationForm.NFC
): string {
  if (!text) return '';

  // Apply Unicode normalization
  let normalized = text.normalize(form);

  // Tibetan-specific normalizations
  normalized = normalizeTibetanSpecific(normalized);

  return normalized;
}

/**
 * Apply Tibetan-specific Unicode normalizations
 */
function normalizeTibetanSpecific(text: string): string {
  let result = text;

  // Normalize different space characters to standard space
  result = result.replace(/[\u00A0\u1680\u2000-\u200B\u202F\u205F\u3000\uFEFF]/g, ' ');

  // Remove zero-width characters that might interfere with text processing
  result = result.replace(/[\u200B-\u200D\uFEFF]/g, '');

  // Normalize multiple consecutive spaces to single space
  result = result.replace(/ {2,}/g, ' ');

  // Remove spaces before Tibetan tsek (་)
  result = result.replace(/ ([\u0F0B\u0F0C])/g, '$1');

  // Ensure space after Tibetan shad (།) if followed by text
  result = result.replace(/([\u0F0D\u0F0E])([^\s\u0F00-\u0FFF])/g, '$1 $2');

  return result;
}

/**
 * Detect Unicode corruption in text
 */
export function detectCorruption(text: string): CorruptionIssue[] {
  const issues: CorruptionIssue[] = [];

  // Check for null bytes
  for (let i = 0; i < text.length; i++) {
    if (text.charCodeAt(i) === 0) {
      issues.push({
        type: CorruptionType.NULL_BYTES,
        position: i,
        length: 1,
        context: getContext(text, i, 10),
        description: 'Null byte detected in text',
        severity: 'high',
      });
    }
  }

  // Check for Unicode replacement character (�)
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '\uFFFD') {
      issues.push({
        type: CorruptionType.REPLACEMENT_CHAR,
        position: i,
        length: 1,
        context: getContext(text, i, 10),
        description: 'Unicode replacement character found (indicates encoding error)',
        severity: 'high',
      });
    }
  }

  // Check for control characters (except newline, tab, carriage return)
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code < 32 && code !== 10 && code !== 13 && code !== 9) {
      issues.push({
        type: CorruptionType.CONTROL_CHARS,
        position: i,
        length: 1,
        context: getContext(text, i, 10),
        description: `Control character detected (code: ${code})`,
        severity: 'medium',
      });
    }
  }

  // Check for broken Unicode sequences (surrogates)
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    // Lone surrogates indicate broken encoding
    if ((code >= 0xD800 && code <= 0xDFFF)) {
      issues.push({
        type: CorruptionType.BROKEN_SEQUENCE,
        position: i,
        length: 1,
        context: getContext(text, i, 10),
        description: 'Broken Unicode surrogate pair detected',
        severity: 'high',
      });
    }
  }

  // Check for common mojibake patterns
  const mojibakePatterns = [
    /Ã[€-¿]/g,  // UTF-8 interpreted as Latin-1
    /â[€-¿]{2}/g, // Common mojibake pattern
  ];

  for (const pattern of mojibakePatterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      issues.push({
        type: CorruptionType.MOJIBAKE,
        position: match.index,
        length: match[0].length,
        context: getContext(text, match.index, 10),
        description: 'Possible mojibake (encoding mismatch) detected',
        severity: 'medium',
      });
    }
  }

  // Check for invalid combining character sequences
  // Combining marks should follow base characters
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    // Tibetan combining marks range
    if (code >= 0x0F71 && code <= 0x0F84) {
      // Check if preceded by valid base character
      if (i === 0 || !isTibetanCharacter(text[i - 1])) {
        issues.push({
          type: CorruptionType.INVALID_COMBINING,
          position: i,
          length: 1,
          context: getContext(text, i, 10),
          description: 'Combining character without valid base character',
          severity: 'medium',
        });
      }
    }
  }

  return issues;
}

/**
 * Generate a comprehensive quality report for text
 */
export function generateQualityReport(text: string): UnicodeQualityReport {
  const tibetanPercentage = getTibetanPercentage(text);
  const corruptionIssues = detectCorruption(text);

  let totalChars = 0;
  let tibetanChars = 0;

  for (const char of text) {
    if (char.trim().length > 0) {
      totalChars++;
      if (isTibetanCharacter(char)) {
        tibetanChars++;
      }
    }
  }

  // Check if text has high-severity corruption
  const hasHighSeverityIssues = corruptionIssues.some(
    issue => issue.severity === 'high'
  );

  // Detect current normalization form (approximation)
  const nfc = text.normalize('NFC');
  const nfd = text.normalize('NFD');
  let currentForm = 'UNKNOWN';

  if (text === nfc && text !== nfd) {
    currentForm = 'NFC';
  } else if (text === nfd && text !== nfc) {
    currentForm = 'NFD';
  } else if (text === nfc && text === nfd) {
    currentForm = 'CANONICAL';
  }

  return {
    isValid: tibetanPercentage >= 0.5 && !hasHighSeverityIssues,
    tibetanPercentage,
    totalCharacters: totalChars,
    tibetanCharacters: tibetanChars,
    corruptionIssues,
    hasProperEncoding: corruptionIssues.length === 0,
    normalizationForm: currentForm,
    recommendedNormalization: NormalizationForm.NFC,
  };
}

/**
 * Validate and normalize text in one step
 */
export function validateAndNormalize(
  text: string,
  minTibetanPercentage: number = 0.5
): { text: string; report: UnicodeQualityReport } {
  const report = generateQualityReport(text);

  // If text is valid, normalize it
  if (report.isValid) {
    const normalized = normalizeTibetanUnicode(text);
    return { text: normalized, report };
  }

  // If text has issues but is recoverable, try to fix and normalize
  if (report.tibetanPercentage >= minTibetanPercentage) {
    const cleaned = cleanCorruptedText(text, report.corruptionIssues);
    const normalized = normalizeTibetanUnicode(cleaned);
    return { text: normalized, report };
  }

  // Return original text if not recoverable
  return { text, report };
}

/**
 * Attempt to clean corrupted text
 */
function cleanCorruptedText(text: string, issues: CorruptionIssue[]): string {
  let cleaned = text;

  // Sort issues by position (descending) to avoid position shifts
  const sortedIssues = [...issues].sort((a, b) => b.position - a.position);

  for (const issue of sortedIssues) {
    switch (issue.type) {
      case CorruptionType.NULL_BYTES:
      case CorruptionType.REPLACEMENT_CHAR:
      case CorruptionType.CONTROL_CHARS:
        // Remove problematic characters
        cleaned =
          cleaned.substring(0, issue.position) +
          cleaned.substring(issue.position + issue.length);
        break;

      case CorruptionType.INVALID_COMBINING:
        // Remove invalid combining marks
        cleaned =
          cleaned.substring(0, issue.position) +
          cleaned.substring(issue.position + 1);
        break;

      // For mojibake and broken sequences, we can't automatically fix
      // without knowing the original encoding
      default:
        break;
    }
  }

  return cleaned;
}

/**
 * Get context around a position in text
 */
function getContext(text: string, position: number, radius: number): string {
  const start = Math.max(0, position - radius);
  const end = Math.min(text.length, position + radius + 1);
  return text.substring(start, end);
}

/**
 * Check if text is properly UTF-8 encoded
 */
export function isValidUTF8(text: string): boolean {
  try {
    // Try to encode and decode
    const encoded = new TextEncoder().encode(text);
    const decoded = new TextDecoder('utf-8', { fatal: true }).decode(encoded);
    return decoded === text;
  } catch {
    return false;
  }
}

/**
 * Calculate entropy of text (useful for detecting encoding issues)
 * Low entropy might indicate repeated characters or encoding problems
 */
export function calculateEntropy(text: string): number {
  if (!text || text.length === 0) return 0;

  const frequencies = new Map<string, number>();

  // Count character frequencies
  for (const char of text) {
    frequencies.set(char, (frequencies.get(char) || 0) + 1);
  }

  // Calculate Shannon entropy
  let entropy = 0;
  const length = text.length;

  for (const count of frequencies.values()) {
    const probability = count / length;
    entropy -= probability * Math.log2(probability);
  }

  return entropy;
}

/**
 * Validation result interface
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  normalizedText?: string;
}

/**
 * Comprehensive validation function
 */
export function validateText(
  text: string,
  options: {
    minTibetanPercentage?: number;
    requireNormalization?: boolean;
    checkEncoding?: boolean;
  } = {}
): ValidationResult {
  const {
    minTibetanPercentage = 0.5,
    requireNormalization = true,
    checkEncoding = true,
  } = options;

  const errors: string[] = [];
  const warnings: string[] = [];

  // Basic checks
  if (!text || text.trim().length === 0) {
    errors.push('Text is empty');
    return { valid: false, errors, warnings };
  }

  // Check Tibetan content
  const tibetanPercentage = getTibetanPercentage(text);
  if (tibetanPercentage < minTibetanPercentage) {
    errors.push(
      `Insufficient Tibetan content: ${(tibetanPercentage * 100).toFixed(1)}% ` +
      `(minimum: ${(minTibetanPercentage * 100).toFixed(1)}%)`
    );
  }

  // Check encoding
  if (checkEncoding && !isValidUTF8(text)) {
    errors.push('Text is not valid UTF-8');
  }

  // Check for corruption
  const corruptionIssues = detectCorruption(text);
  for (const issue of corruptionIssues) {
    if (issue.severity === 'high') {
      errors.push(`${issue.description} at position ${issue.position}`);
    } else if (issue.severity === 'medium') {
      warnings.push(`${issue.description} at position ${issue.position}`);
    }
  }

  // Check normalization
  let normalizedText: string | undefined;
  if (requireNormalization) {
    const nfc = text.normalize('NFC');
    if (text !== nfc) {
      warnings.push('Text should be normalized to NFC form');
      normalizedText = normalizeTibetanUnicode(text);
    }
  }

  // Check entropy (very low might indicate issues)
  const entropy = calculateEntropy(text);
  if (entropy < 2.0 && text.length > 100) {
    warnings.push('Text has unusually low entropy (possible encoding issue)');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    normalizedText,
  };
}
