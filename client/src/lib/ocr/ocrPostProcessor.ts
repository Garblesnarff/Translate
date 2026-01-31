// client/src/lib/ocr/ocrPostProcessor.ts

/**
 * OCR Post-Processor for Tibetan text
 * Fixes common OCR errors, validates character patterns, and cleans artifacts
 */

// Common OCR character confusions for Tibetan script
const CHARACTER_CONFUSION_MAP: Record<string, string> = {
  // Common misrecognitions in Tibetan Unicode range
  // Vowel marks often confused
  '\u0F72\u0F71': '\u0F71\u0F72', // i + a → a + i (correct order)
  '\u0F74\u0F71': '\u0F71\u0F74', // u + a → a + u (correct order)

  // Visually similar characters
  'o': 'ོ', // Latin o → Tibetan vowel sign o (U+0F7C)
  'i': 'ི', // Latin i → Tibetan vowel sign i (U+0F72)
  '|': '།', // Pipe → Tibetan shad (U+0F0D)
  '/': '་', // Slash → Tibetan tsek (U+0F0B)

  // Common punctuation confusions
  '.': '་', // Period → tsek (in some contexts)
  ',': '་', // Comma → tsek
  ';': '༔', // Semicolon → Tibetan mark yig mgo
};

// Valid Tibetan character ranges
const TIBETAN_RANGES = [
  { start: 0x0f00, end: 0x0fff }, // Tibetan
];

// Common Tibetan punctuation marks
const TIBETAN_PUNCTUATION = new Set([
  '\u0F0B', // tsek (་)
  '\u0F0C', // delimiter tsek
  '\u0F0D', // shad (།)
  '\u0F0E', // double shad (༎)
  '\u0F0F', // tsheg shad (༏)
  '\u0F11', // rin chen spungs shad (༑)
  '\u0F14', // gter tsheg (༔)
]);

export interface PostProcessingResult {
  text: string;
  corrections: number;
  issuesFixed: string[];
  suspiciousPatterns: string[];
  quality: number; // 0-1 score
}

export interface PostProcessingOptions {
  // Fix character confusion errors
  fixCharacterConfusions?: boolean;
  // Remove stray non-Tibetan characters
  removeStrayCharacters?: boolean;
  // Fix spacing issues
  fixSpacing?: boolean;
  // Validate syllable structure
  validateSyllables?: boolean;
  // Minimum confidence to keep text (0-1)
  minConfidence?: number;
}

const DEFAULT_OPTIONS: Required<PostProcessingOptions> = {
  fixCharacterConfusions: true,
  removeStrayCharacters: true,
  fixSpacing: true,
  validateSyllables: true,
  minConfidence: 0.5,
};

/**
 * OCR Post-Processor class
 * Cleans and validates OCR output for Tibetan text
 */
export class OCRPostProcessor {
  private options: Required<PostProcessingOptions>;

  constructor(options: PostProcessingOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * Process OCR text and apply all corrections
   *
   * @param text Raw OCR text
   * @param confidence OCR confidence score (0-1)
   * @returns Post-processed result
   */
  process(text: string, confidence: number = 1.0): PostProcessingResult {
    let processedText = text;
    const issuesFixed: string[] = [];
    let corrections = 0;

    // Skip processing if confidence is too low
    if (confidence < this.options.minConfidence) {
      return {
        text,
        corrections: 0,
        issuesFixed: [],
        suspiciousPatterns: ['Low OCR confidence - minimal processing applied'],
        quality: confidence,
      };
    }

    // Step 1: Fix character confusions
    if (this.options.fixCharacterConfusions) {
      const { text: fixedText, count } = this.fixCharacterConfusions(processedText);
      processedText = fixedText;
      corrections += count;
      if (count > 0) {
        issuesFixed.push(`Fixed ${count} character confusion errors`);
      }
    }

    // Step 2: Remove stray characters
    if (this.options.removeStrayCharacters) {
      const { text: cleanedText, count } = this.removeStrayCharacters(processedText);
      processedText = cleanedText;
      corrections += count;
      if (count > 0) {
        issuesFixed.push(`Removed ${count} stray characters`);
      }
    }

    // Step 3: Fix spacing issues
    if (this.options.fixSpacing) {
      const { text: spacedText, count } = this.fixSpacing(processedText);
      processedText = spacedText;
      corrections += count;
      if (count > 0) {
        issuesFixed.push(`Fixed ${count} spacing issues`);
      }
    }

    // Step 4: Detect suspicious patterns
    const suspiciousPatterns = this.detectSuspiciousPatterns(processedText);

    // Calculate quality score
    const quality = this.calculateQuality(processedText, confidence, corrections);

    return {
      text: processedText,
      corrections,
      issuesFixed,
      suspiciousPatterns,
      quality,
    };
  }

  /**
   * Fix common character confusion errors
   */
  private fixCharacterConfusions(text: string): { text: string; count: number } {
    let fixedText = text;
    let count = 0;

    // Apply each character confusion fix
    for (const [wrong, correct] of Object.entries(CHARACTER_CONFUSION_MAP)) {
      const regex = new RegExp(wrong, 'g');
      const matches = fixedText.match(regex);
      if (matches) {
        count += matches.length;
        fixedText = fixedText.replace(regex, correct);
      }
    }

    return { text: fixedText, count };
  }

  /**
   * Remove stray non-Tibetan characters that are likely OCR errors
   */
  private removeStrayCharacters(text: string): { text: string; count: number } {
    let count = 0;
    const lines = text.split('\n');
    const cleanedLines = lines.map((line) => {
      // Split into characters
      const chars = [...line];
      const cleaned: string[] = [];

      for (let i = 0; i < chars.length; i++) {
        const char = chars[i];
        const code = char.charCodeAt(0);

        // Keep Tibetan characters
        if (this.isTibetanCharacter(code)) {
          cleaned.push(char);
          continue;
        }

        // Keep whitespace and newlines
        if (/\s/.test(char)) {
          cleaned.push(char);
          continue;
        }

        // Keep basic Latin letters and numbers if surrounded by Latin
        if (/[a-zA-Z0-9]/.test(char)) {
          const prevChar = i > 0 ? chars[i - 1] : '';
          const nextChar = i < chars.length - 1 ? chars[i + 1] : '';

          // Keep if part of English word/number sequence
          if (/[a-zA-Z0-9\s]/.test(prevChar) || /[a-zA-Z0-9\s]/.test(nextChar)) {
            cleaned.push(char);
            continue;
          }
        }

        // Keep common punctuation
        if (/[.,!?;:\-()[\]{}"]/.test(char)) {
          cleaned.push(char);
          continue;
        }

        // Otherwise, it's likely a stray character - remove it
        count++;
      }

      return cleaned.join('');
    });

    return { text: cleanedLines.join('\n'), count };
  }

  /**
   * Fix spacing issues in Tibetan text
   */
  private fixSpacing(text: string): { text: string; count: number } {
    let fixedText = text;
    let count = 0;

    // Fix 1: Remove spaces before tsek
    const spacesBeforeTsek = fixedText.match(/\s+་/g);
    if (spacesBeforeTsek) {
      count += spacesBeforeTsek.length;
      fixedText = fixedText.replace(/\s+་/g, '་');
    }

    // Fix 2: Ensure space after shad
    const shadWithoutSpace = fixedText.match(/།([^\s།])/g);
    if (shadWithoutSpace) {
      count += shadWithoutSpace.length;
      fixedText = fixedText.replace(/།([^\s།])/g, '། $1');
    }

    // Fix 3: Normalize multiple spaces to single space
    const multipleSpaces = fixedText.match(/\s{2,}/g);
    if (multipleSpaces) {
      count += multipleSpaces.length;
      fixedText = fixedText.replace(/\s{2,}/g, ' ');
    }

    // Fix 4: Remove spaces between tsek and Tibetan characters
    const spacesAfterTsek = fixedText.match(/་\s+([^\s])/g);
    if (spacesAfterTsek) {
      // Only fix if followed by Tibetan character
      fixedText = fixedText.replace(/་\s+([\u0F00-\u0FFF])/g, (match, char) => {
        count++;
        return '་' + char;
      });
    }

    return { text: fixedText, count };
  }

  /**
   * Detect suspicious patterns that might indicate OCR issues
   */
  private detectSuspiciousPatterns(text: string): string[] {
    const suspicious: string[] = [];

    // Check for repeated tsek
    if (/་{3,}/.test(text)) {
      suspicious.push('Multiple consecutive tsek characters detected');
    }

    // Check for repeated shad
    if (/།{3,}/.test(text)) {
      suspicious.push('Multiple consecutive shad characters detected');
    }

    // Check for unusual character sequences
    if (/[\u0F00-\u0FFF]\s+[\u0F00-\u0FFF]\s+[\u0F00-\u0FFF]/.test(text)) {
      const count = (text.match(/[\u0F00-\u0FFF]\s+[\u0F00-\u0FFF]/g) || []).length;
      if (count > text.length / 100) {
        suspicious.push('Unusual spacing between Tibetan characters');
      }
    }

    // Check for isolated Tibetan characters
    const isolatedCount = (text.match(/\s[\u0F00-\u0FFF]\s/g) || []).length;
    if (isolatedCount > 5) {
      suspicious.push(`${isolatedCount} isolated Tibetan characters found`);
    }

    // Check Tibetan percentage
    const tibetanChars = (text.match(/[\u0F00-\u0FFF]/g) || []).length;
    const totalChars = text.replace(/\s/g, '').length;
    const tibetanPercentage = tibetanChars / totalChars;

    if (tibetanPercentage < 0.5) {
      suspicious.push(
        `Low Tibetan content (${(tibetanPercentage * 100).toFixed(1)}%) - possible OCR quality issues`
      );
    }

    return suspicious;
  }

  /**
   * Calculate overall quality score for processed text
   */
  private calculateQuality(text: string, confidence: number, corrections: number): number {
    // Start with OCR confidence
    let quality = confidence;

    // Penalize for many corrections (indicates poor OCR quality)
    const correctionPenalty = Math.min(0.3, corrections / text.length);
    quality -= correctionPenalty;

    // Check Tibetan character ratio
    const tibetanChars = (text.match(/[\u0F00-\u0FFF]/g) || []).length;
    const totalChars = text.replace(/\s/g, '').length;
    const tibetanRatio = totalChars > 0 ? tibetanChars / totalChars : 0;

    // Bonus for high Tibetan content
    if (tibetanRatio > 0.8) {
      quality += 0.1;
    } else if (tibetanRatio < 0.5) {
      quality -= 0.2;
    }

    // Ensure quality is in 0-1 range
    return Math.max(0, Math.min(1, quality));
  }

  /**
   * Check if a character code is in valid Tibetan range
   */
  private isTibetanCharacter(code: number): boolean {
    return TIBETAN_RANGES.some((range) => code >= range.start && code <= range.end);
  }

  /**
   * Validate Tibetan syllable structure
   * Basic check - a proper implementation would use a full syllable parser
   */
  validateSyllableStructure(text: string): {
    isValid: boolean;
    issues: string[];
  } {
    const issues: string[] = [];

    // Split by tsek to get syllables
    const syllables = text.split('་').filter((s) => s.trim().length > 0);

    let invalidSyllables = 0;

    for (const syllable of syllables) {
      // Very basic validation: should contain at least one Tibetan character
      if (!/[\u0F40-\u0FBC]/.test(syllable)) {
        invalidSyllables++;
      }
    }

    if (invalidSyllables > 0) {
      issues.push(`${invalidSyllables} syllables may have structural issues`);
    }

    return {
      isValid: invalidSyllables === 0,
      issues,
    };
  }
}

/**
 * Helper function to quickly post-process OCR text
 *
 * @param text Raw OCR text
 * @param confidence OCR confidence
 * @param options Processing options
 * @returns Cleaned text
 */
export function cleanOCRText(
  text: string,
  confidence: number = 1.0,
  options: PostProcessingOptions = {}
): PostProcessingResult {
  const processor = new OCRPostProcessor(options);
  return processor.process(text, confidence);
}
