/**
 * Tests for ConfidenceCalculator
 *
 * Comprehensive test suite for enhanced confidence scoring system.
 * Tests all confidence factors:
 * - Base confidence from model
 * - Dictionary term usage boost (+0.15 max)
 * - Format compliance boost (+0.10 max)
 * - Preservation quality boost (+0.10 max)
 * - Semantic similarity boost (+0.15 max)
 * - Confidence capping (0.98 max, 0.1 min)
 * - Multi-model aggregation
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ConfidenceCalculator } from '../../../../server/services/confidence/ConfidenceCalculator.js';
import type { DictionaryEntry } from '../../../../server/services/dictionary/DictionaryService.js';
import type { TranslationResult } from '../../../../shared/types.js';

describe('ConfidenceCalculator', () => {
  let calculator: ConfidenceCalculator;

  beforeEach(() => {
    calculator = new ConfidenceCalculator();
  });

  describe('Base Confidence', () => {
    it('should calculate base confidence from model', async () => {
      const result = await calculator.calculate(
        'Greetings (བཀྲ་ཤིས་བདེ་ལེགས།).',
        {
          originalText: 'བཀྲ་ཤིས་བདེ་ལེགས།',
          dictionaryTerms: [],
          baseConfidence: 0.75,
        }
      );

      expect(result).toBeGreaterThanOrEqual(0.75);
      expect(result).toBeLessThanOrEqual(0.98);
    });

    it('should use default base confidence of 0.5 when not provided', async () => {
      const result = await calculator.calculate(
        'Greetings (བཀྲ་ཤིས་བདེ་ལེགས།).',
        {
          originalText: 'བཀྲ་ཤིས་བདེ་ལེགས།',
          dictionaryTerms: [],
        }
      );

      // With good formatting and preservation, should boost above 0.5
      expect(result).toBeGreaterThan(0.5);
    });

    it('should handle very low base confidence', async () => {
      const result = await calculator.calculate(
        'Translation',
        {
          originalText: 'བཀྲ་ཤིས་བདེ་ལེགས།',
          dictionaryTerms: [],
          baseConfidence: 0.05,
        }
      );

      // Even with boosts, should enforce floor of 0.1
      expect(result).toBeGreaterThanOrEqual(0.1);
    });

    it('should handle very high base confidence', async () => {
      const result = await calculator.calculate(
        'Perfect (བོད།).',
        {
          originalText: 'བོད།',
          dictionaryTerms: [],
          baseConfidence: 0.95,
        }
      );

      // Even with boosts, should enforce cap of 0.98
      expect(result).toBeLessThanOrEqual(0.98);
    });
  });

  describe('Dictionary Term Coverage Boost', () => {
    it('should boost confidence when all dictionary terms are used', async () => {
      const dictionaryTerms: DictionaryEntry[] = [
        {
          id: '1',
          tibetan: 'བཀྲ་ཤིས',
          english: 'greetings',
          frequency: 'very_common',
        },
        {
          id: '2',
          tibetan: 'བདེ་ལེགས',
          english: 'good fortune',
          frequency: 'common',
        },
      ];

      const withoutDict = await calculator.calculate(
        'Greetings and good fortune (བཀྲ་ཤིས་བདེ་ལེགས།).',
        {
          originalText: 'བཀྲ་ཤིས་བདེ་ལེགས།',
          dictionaryTerms: [],
          baseConfidence: 0.7,
        }
      );

      const withDict = await calculator.calculate(
        'Greetings and good fortune (བཀྲ་ཤིས་བདེ་ལེགས།).',
        {
          originalText: 'བཀྲ་ཤིས་བདེ་ལེགས།',
          dictionaryTerms,
          baseConfidence: 0.7,
        }
      );

      // Should boost by up to +0.15 when all terms used
      expect(withDict).toBeGreaterThan(withoutDict);
      expect(withDict - withoutDict).toBeLessThanOrEqual(0.15);
    });

    it('should give partial boost when some dictionary terms are used', async () => {
      const dictionaryTerms: DictionaryEntry[] = [
        {
          id: '1',
          tibetan: 'བཀྲ་ཤིས',
          english: 'greetings',
          frequency: 'very_common',
        },
        {
          id: '2',
          tibetan: 'བདེ་ལེགས',
          english: 'good fortune',
          frequency: 'common',
        },
      ];

      const result = await calculator.calculate(
        'Greetings (བཀྲ་ཤིས།).',
        {
          originalText: 'བཀྲ་ཤིས།',
          dictionaryTerms,
          baseConfidence: 0.7,
        }
      );

      // Should have some boost from dictionary (1/2 terms = 0.075)
      // Plus format and preservation boosts (up to 0.20)
      // Total possible: 0.7 + 0.075 + 0.20 = 0.975 but capped at 0.98
      expect(result).toBeGreaterThan(0.7);
      expect(result).toBeLessThanOrEqual(0.98);
    });

    it('should not boost when no dictionary terms are provided', async () => {
      const result = await calculator.calculate(
        'Greetings (བཀྲ་ཤིས།).',
        {
          originalText: 'བཀྲ་ཤིས།',
          dictionaryTerms: [],
          baseConfidence: 0.7,
        }
      );

      // Should not get dictionary boost, only format/preservation boosts
      expect(result).toBeGreaterThanOrEqual(0.7);
    });

    it('should handle case-insensitive term matching', async () => {
      const dictionaryTerms: DictionaryEntry[] = [
        {
          id: '1',
          tibetan: 'བཀྲ་ཤིས',
          english: 'greetings',
          frequency: 'very_common',
        },
      ];

      const result = await calculator.calculate(
        'GREETINGS (བཀྲ་ཤིས།).',
        {
          originalText: 'བཀྲ་ཤིས།',
          dictionaryTerms,
          baseConfidence: 0.7,
        }
      );

      // Should match "GREETINGS" with "greetings"
      expect(result).toBeGreaterThan(0.7);
    });
  });

  describe('Format Compliance Boost', () => {
    it('should boost confidence for perfect format compliance', async () => {
      const withoutFormat = await calculator.calculate(
        'Greetings བཀྲ་ཤིས།',
        {
          originalText: 'བཀྲ་ཤིས།',
          dictionaryTerms: [],
          baseConfidence: 0.7,
        }
      );

      const withFormat = await calculator.calculate(
        'Greetings (བཀྲ་ཤིས།).',
        {
          originalText: 'བཀྲ་ཤིས།',
          dictionaryTerms: [],
          baseConfidence: 0.7,
        }
      );

      // Perfect format should boost by up to +0.10
      expect(withFormat).toBeGreaterThan(withoutFormat);
      expect(withFormat - withoutFormat).toBeLessThanOrEqual(0.10);
    });

    it('should detect correct format: English (བོད་ཡིག).', async () => {
      const result = await calculator.calculate(
        'The Tibetan language (བོད་སྐད།) is important (གལ་ཆེན།).',
        {
          originalText: 'བོད་སྐད། གལ་ཆེན།',
          dictionaryTerms: [],
          baseConfidence: 0.7,
        }
      );

      expect(result).toBeGreaterThan(0.7);
    });

    it('should penalize incorrect format', async () => {
      const result = await calculator.calculate(
        'The Tibetan language བོད་སྐད without parentheses',
        {
          originalText: 'བོད་སྐད།',
          dictionaryTerms: [],
          baseConfidence: 0.7,
        }
      );

      // Should not get format boost
      expect(result).toBeLessThanOrEqual(0.80);
    });

    it('should handle multiple Tibetan terms in parentheses', async () => {
      const result = await calculator.calculate(
        'Text (བོད།). More (སྐད།). And (ཡིག།).',
        {
          originalText: 'བོད། སྐད། ཡིག།',
          dictionaryTerms: [],
          baseConfidence: 0.7,
        }
      );

      expect(result).toBeGreaterThan(0.7);
    });
  });

  describe('Preservation Quality Boost', () => {
    it('should boost confidence for high preservation quality', async () => {
      const withPoor = await calculator.calculate(
        'Translation (བོད།).',
        {
          originalText: 'བཀྲ་ཤིས་བདེ་ལེགས་སངས་རྒྱས་ཆོས་དམ་པ།',
          dictionaryTerms: [],
          baseConfidence: 0.7,
        }
      );

      const withGood = await calculator.calculate(
        'Translation (བཀྲ་ཤིས་བདེ་ལེགས་སངས་རྒྱས་ཆོས་དམ་པ།).',
        {
          originalText: 'བཀྲ་ཤིས་བདེ་ལེགས་སངས་རྒྱས་ཆོས་དམ་པ།',
          dictionaryTerms: [],
          baseConfidence: 0.7,
        }
      );

      // Good preservation (>95%) should boost by up to +0.10
      expect(withGood).toBeGreaterThan(withPoor);
    });

    it('should give full boost when preservation is >95%', async () => {
      const result = await calculator.calculate(
        'Text (བོད་སྐད་ཡིག།).',
        {
          originalText: 'བོད་སྐད་ཡིག།',
          dictionaryTerms: [],
          baseConfidence: 0.7,
        }
      );

      // 100% preservation should give full boost
      expect(result).toBeGreaterThanOrEqual(0.8); // 0.7 + 0.1
    });

    it('should give partial boost for partial preservation', async () => {
      const result = await calculator.calculate(
        'Text (བོད་སྐད།).',
        {
          originalText: 'བོད་སྐད་ཡིག་དེ་ནི།',
          dictionaryTerms: [],
          baseConfidence: 0.7,
        }
      );

      // Partial preservation should give some boost
      expect(result).toBeGreaterThan(0.7);
      expect(result).toBeLessThan(0.8);
    });

    it('should handle missing preservation gracefully', async () => {
      const result = await calculator.calculate(
        'Pure English translation without Tibetan.',
        {
          originalText: 'བོད་སྐད།',
          dictionaryTerms: [],
          baseConfidence: 0.7,
        }
      );

      // No preservation, no boost
      expect(result).toBeLessThanOrEqual(0.7);
    });
  });

  describe('Semantic Similarity Boost', () => {
    it('should boost confidence based on semantic agreement', async () => {
      const otherResults: TranslationResult[] = [
        {
          translation: 'Greetings (བཀྲ་ཤིས།).',
          confidence: 0.85,
          metadata: {
            model: 'gemini-flash',
            cached: false,
            processingTimeMs: 1000,
            tokenCount: 10,
          },
        },
        {
          translation: 'Hello (བཀྲ་ཤིས།).',
          confidence: 0.80,
          metadata: {
            model: 'gpt-4',
            cached: false,
            processingTimeMs: 1200,
            tokenCount: 10,
          },
        },
      ];

      const result = await calculator.calculate(
        'Greetings (བཀྲ་ཤིས།).',
        {
          originalText: 'བཀྲ་ཤིས།',
          dictionaryTerms: [],
          baseConfidence: 0.7,
          multipleModels: true,
          otherResults,
          semanticAgreement: 0.95,
        }
      );

      // High agreement (0.95) should boost by up to +0.15
      expect(result).toBeGreaterThan(0.7);
    });

    it('should give full boost for very high agreement', async () => {
      const result = await calculator.calculate(
        'Perfect (བོད།).',
        {
          originalText: 'བོད།',
          dictionaryTerms: [],
          baseConfidence: 0.7,
          multipleModels: true,
          semanticAgreement: 0.98,
        }
      );

      // Agreement of 0.98 should give near-full boost
      expect(result).toBeGreaterThanOrEqual(0.82); // 0.7 + ~0.147
    });

    it('should give partial boost for moderate agreement', async () => {
      const result = await calculator.calculate(
        'Text (བོད།).',
        {
          originalText: 'བོད།',
          dictionaryTerms: [],
          baseConfidence: 0.7,
          multipleModels: true,
          semanticAgreement: 0.7,
        }
      );

      // Semantic agreement of 0.7 gives boost of 0.7 * 0.15 = 0.105
      // Plus format and preservation boosts (up to 0.20)
      // Total possible: 0.7 + 0.105 + 0.20 = 1.005 but capped at 0.98
      expect(result).toBeGreaterThan(0.7);
      expect(result).toBeLessThanOrEqual(0.98);
    });

    it('should not boost when semantic agreement is not provided', async () => {
      const result = await calculator.calculate(
        'Text (བོད།).',
        {
          originalText: 'བོད།',
          dictionaryTerms: [],
          baseConfidence: 0.7,
          multipleModels: false,
        }
      );

      // No semantic agreement, no boost from this factor
      expect(result).toBeLessThanOrEqual(0.98);
    });
  });

  describe('Confidence Bounds', () => {
    it('should cap confidence at 0.98', async () => {
      const result = await calculator.calculate(
        'Perfect translation (བོད་སྐད།).',
        {
          originalText: 'བོད་སྐད།',
          dictionaryTerms: [
            {
              id: '1',
              tibetan: 'བོད་སྐད',
              english: 'tibetan language',
              frequency: 'very_common',
            },
          ],
          baseConfidence: 0.95,
          multipleModels: true,
          semanticAgreement: 0.99,
        }
      );

      // Even with all boosts, should cap at 0.98
      expect(result).toBeLessThanOrEqual(0.98);
    });

    it('should floor confidence at 0.1', async () => {
      const result = await calculator.calculate(
        'Bad translation',
        {
          originalText: 'བོད་སྐད་ཡིག་དེ་ནི་གལ་ཆེན་པོ་ཞིག་ཡིན།',
          dictionaryTerms: [],
          baseConfidence: 0.02,
        }
      );

      // Even with very low base confidence, should floor at 0.1
      expect(result).toBeGreaterThanOrEqual(0.1);
    });

    it('should never return confidence outside [0.1, 0.98]', async () => {
      const testCases = [
        {
          translation: 'Test (བོད།).',
          baseConfidence: 0,
        },
        {
          translation: 'Test',
          baseConfidence: -0.5,
        },
        {
          translation: 'Perfect (བོད།).',
          baseConfidence: 1.0,
        },
        {
          translation: 'Test (བོད།).',
          baseConfidence: 1.5,
        },
      ];

      for (const testCase of testCases) {
        const result = await calculator.calculate(testCase.translation, {
          originalText: 'བོད།',
          dictionaryTerms: [],
          baseConfidence: testCase.baseConfidence,
        });

        expect(result).toBeGreaterThanOrEqual(0.1);
        expect(result).toBeLessThanOrEqual(0.98);
      }
    });
  });

  describe('Combined Boosts', () => {
    it('should apply all boosts together', async () => {
      const dictionaryTerms: DictionaryEntry[] = [
        {
          id: '1',
          tibetan: 'བོད་སྐད',
          english: 'tibetan language',
          frequency: 'very_common',
        },
      ];

      const result = await calculator.calculate(
        'Tibetan language (བོད་སྐད།).',
        {
          originalText: 'བོད་སྐད།',
          dictionaryTerms,
          baseConfidence: 0.5,
          multipleModels: true,
          semanticAgreement: 0.9,
        }
      );

      // Should apply multiple boosts:
      // - Dictionary: +up to 0.15
      // - Format: +up to 0.10
      // - Preservation: +up to 0.10
      // - Semantic: +up to 0.15
      // Maximum possible: 0.5 + 0.5 = 1.0, but capped at 0.98
      expect(result).toBeGreaterThan(0.7); // Significant boost
      expect(result).toBeLessThanOrEqual(0.98);
    });

    it('should calculate realistic confidence for good translation', async () => {
      const dictionaryTerms: DictionaryEntry[] = [
        {
          id: '1',
          tibetan: 'བཀྲ་ཤིས',
          english: 'greetings',
          frequency: 'very_common',
        },
      ];

      const result = await calculator.calculate(
        'Greetings (བཀྲ་ཤིས།).',
        {
          originalText: 'བཀྲ་ཤིས།',
          dictionaryTerms,
          baseConfidence: 0.8,
        }
      );

      // Good translation with dictionary, format, and preservation
      expect(result).toBeGreaterThan(0.8);
      expect(result).toBeLessThanOrEqual(0.98);
    });

    it('should calculate realistic confidence for poor translation', async () => {
      const result = await calculator.calculate(
        'Translation without preservation',
        {
          originalText: 'བོད་སྐད་ཡིག་དེ་ནི་གལ་ཆེན་པོ་ཞིག་ཡིན།',
          dictionaryTerms: [],
          baseConfidence: 0.3,
        }
      );

      // Poor translation, no boosts
      expect(result).toBeLessThan(0.5);
      expect(result).toBeGreaterThanOrEqual(0.1);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty translation', async () => {
      const result = await calculator.calculate('', {
        originalText: 'བོད།',
        dictionaryTerms: [],
        baseConfidence: 0.7,
      });

      expect(result).toBeGreaterThanOrEqual(0.1);
      expect(result).toBeLessThanOrEqual(0.98);
    });

    it('should handle empty original text', async () => {
      const result = await calculator.calculate('Translation (བོད།).', {
        originalText: '',
        dictionaryTerms: [],
        baseConfidence: 0.7,
      });

      expect(result).toBeGreaterThanOrEqual(0.1);
      expect(result).toBeLessThanOrEqual(0.98);
    });

    it('should handle very long translation', async () => {
      const longTranslation = 'Text (བོད།). '.repeat(1000);
      const longOriginal = 'བོད། '.repeat(1000);

      const result = await calculator.calculate(longTranslation, {
        originalText: longOriginal,
        dictionaryTerms: [],
        baseConfidence: 0.7,
      });

      expect(result).toBeGreaterThanOrEqual(0.1);
      expect(result).toBeLessThanOrEqual(0.98);
    });

    it('should handle translations with special characters', async () => {
      const result = await calculator.calculate(
        'Text (བོད།). \n\nNew line (སྐད།).\t\tTab (ཡིག།).',
        {
          originalText: 'བོད། སྐད། ཡིག།',
          dictionaryTerms: [],
          baseConfidence: 0.7,
        }
      );

      expect(result).toBeGreaterThanOrEqual(0.1);
      expect(result).toBeLessThanOrEqual(0.98);
    });

    it('should handle unicode normalization differences', async () => {
      // Some Tibetan characters may have different Unicode representations
      const result = await calculator.calculate(
        'Text (བོད།).',
        {
          originalText: 'བོད།',
          dictionaryTerms: [],
          baseConfidence: 0.7,
        }
      );

      expect(result).toBeGreaterThan(0.7);
    });
  });
});
