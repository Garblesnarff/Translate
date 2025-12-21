import { describe, it, expect, vi } from 'vitest';
import { splitTextIntoChunks } from '@/lib/textExtractor';
import { splitIntoSentences } from '@/lib/tibetan/sentenceDetector';
import { validateSyllableStructure } from '@/lib/tibetan/syllableDetector';
import { validateAndNormalize } from '@/lib/tibetan/unicodeValidator';
import { InputValidator } from '../../../server/validators/inputValidator';
import { OutputValidator } from '../../../server/validators/outputValidator';

describe('Integration Tests', () => {
  describe('text processing pipeline', () => {
    it('should process Tibetan text through the full pipeline', () => {
      const inputText = 'བོད་ཀྱི་སྐད་ཡིག་ནི་གལ་ཆེན་པོ་ཡིན། ང་ཚོ་བོད་སྐད་སློབ་སྦྱོང་བྱེད།';

      // Step 1: Unicode validation and normalization
      const { text: normalizedText, report } = validateAndNormalize(inputText);
      expect(report.isValid).toBe(true);
      expect(normalizedText.length).toBeGreaterThan(0);

      // Step 2: Syllable structure validation
      const syllableValidation = validateSyllableStructure(normalizedText);
      expect(syllableValidation.syllableCount).toBeGreaterThan(0);

      // Step 3: Sentence detection
      const sentences = splitIntoSentences(normalizedText);
      expect(sentences.length).toBeGreaterThan(0);
      expect(sentences.every(s => s.text.length > 0)).toBe(true);

      // Step 4: Text chunking
      const chunks = splitTextIntoChunks(normalizedText);
      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks.every(c => c.tokenCount > 0)).toBe(true);
    });

    it('should validate input and output together', () => {
      const inputValidator = new InputValidator();
      const outputValidator = new OutputValidator();

      const originalText = 'བོད་ཀྱི་སྐད་ཡིག་ནི་གལ་ཆེན་པོ་ཡིན།';
      const translation = 'The Tibetan language (བོད་ཀྱི་སྐད་ཡིག) is important (གལ་ཆེན་པོ་ཡིན།).';

      // Validate input
      const inputValidation = inputValidator.validateTibetanText(originalText);
      expect(inputValidation.isValid).toBe(true);

      // Validate output
      const outputValidation = outputValidator.validateTranslation(translation, originalText);
      expect(outputValidation.isValid).toBe(true);
    });
  });

  describe('end-to-end text processing', () => {
    it('should handle multi-sentence text', () => {
      const text = 'བོད་སྐད། ཡིག་གཞུང་། རིག་གནས།';

      const sentences = splitIntoSentences(text);
      expect(sentences.length).toBe(3);

      const chunks = splitTextIntoChunks(text);
      expect(chunks.length).toBeGreaterThan(0);
    });

    it('should handle mixed Tibetan-English text', () => {
      const text = 'བོད་སྐད (Tibetan) དང་ English འདྲེས།';

      const sentences = splitIntoSentences(text);
      expect(sentences.length).toBeGreaterThan(0);

      const hasMixedContent = sentences.some(s => s.hasTibetan && s.hasEnglish);
      expect(hasMixedContent).toBe(true);
    });

    it('should chunk large text appropriately', () => {
      const longText = 'བོད་སྐད་ནི་སྐད་ཡིག་གལ་ཆེན་ཡིན། '.repeat(100);

      const chunks = splitTextIntoChunks(longText, { maxTokens: 100 });
      expect(chunks.length).toBeGreaterThan(1);

      chunks.forEach(chunk => {
        expect(chunk.tokenCount).toBeLessThanOrEqual(100);
      });
    });
  });

  describe('validation pipeline', () => {
    it('should validate complete translation workflow', () => {
      const inputValidator = new InputValidator();
      const outputValidator = new OutputValidator();

      // Input
      const input = 'བོད་ཀྱི་སྐད་ཡིག་དེ་ནི་བོད་པའི་རིག་གནས་ཀྱི་གཞི་རྩ་ཡིན།';
      const inputResult = inputValidator.validateTibetanText(input);
      expect(inputResult.isValid).toBe(true);

      // Process (mocked translation)
      const mockTranslation = 'The Tibetan language (བོད་ཀྱི་སྐད་ཡིག་དེ) is the foundation (གཞི་རྩ་ཡིན།) of Tibetan culture (བོད་པའི་རིག་གནས་ཀྱི).';

      // Output validation
      const outputResult = outputValidator.validateTranslation(mockTranslation, input);
      expect(outputResult.isValid).toBe(true);
    });

    it('should catch invalid translations', () => {
      const outputValidator = new OutputValidator();
      const originalText = 'བོད་སྐད།';

      const badTranslations = [
        'Translation: Tibetan.',
        'I cannot translate this.',
        'Tibetan language.',  // No Tibetan preserved
        '',  // Empty
      ];

      badTranslations.forEach(translation => {
        const result = outputValidator.validateTranslation(translation, originalText);
        expect(result.isValid).toBe(false);
      });
    });
  });
});
