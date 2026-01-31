/**
 * Tests for Temporal Resolution Service
 *
 * Validates date resolution across all supported formats:
 * - Gregorian dates
 * - Tibetan calendar (rabjung)
 * - Element-animal cycles
 * - Relative dates
 * - Era-based dates
 * - Natural language dates
 */

import { describe, it, expect, beforeAll } from '@jest/globals';
import { temporalResolver, RABJUNG_CYCLES, ELEMENT_ANIMAL_CYCLE, ERAS } from './TemporalResolver';
import type { Entity } from '../../types/entities';

describe('TemporalResolver', () => {
  // Mock entities for testing
  let marpa: Entity;
  let milarepa: Entity;

  beforeAll(() => {
    marpa = {
      id: 'marpa-test',
      type: 'person',
      canonicalName: 'Marpa Lotsawa',
      names: {
        tibetan: ['མར་པ་ལོ་ཙཱ་བ།'],
        english: ['Marpa', 'Marpa the Translator'],
        phonetic: ['Marpa Lotsawa'],
        wylie: ['mar pa lo tsA ba'],
      },
      attributes: { roles: ['teacher', 'translator'] },
      dates: {
        birth: { year: 1012, precision: 'circa', confidence: 0.8 },
        death: { year: 1097, precision: 'circa', confidence: 0.85 },
      },
      confidence: 0.9,
      verified: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: 'ai',
    };

    milarepa = {
      id: 'milarepa-test',
      type: 'person',
      canonicalName: 'Milarepa',
      names: {
        tibetan: ['མི་ལ་རས་པ།'],
        english: ['Milarepa'],
        phonetic: ['Milarepa'],
        wylie: ['mi la ras pa'],
      },
      attributes: { roles: ['yogi', 'student'] },
      dates: {
        birth: { year: 1052, precision: 'circa', confidence: 0.85 },
        death: { year: 1135, precision: 'circa', confidence: 0.85 },
      },
      confidence: 0.95,
      verified: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: 'ai',
    };
  });

  // ============================================================================
  // Direct Gregorian Dates
  // ============================================================================

  describe('Direct Gregorian Dates', () => {
    it('should parse simple year', async () => {
      const result = await temporalResolver.resolveDate('1012');
      expect(result.year).toBe(1012);
      expect(result.precision).toBe('exact');
      expect(result.confidence).toBe(1.0);
      expect(result.resolutionMethod).toBe('direct');
    });

    it('should parse year with CE suffix', async () => {
      const result = await temporalResolver.resolveDate('1097 CE');
      expect(result.year).toBe(1097);
      expect(result.precision).toBe('exact');
      expect(result.confidence).toBe(1.0);
    });

    it('should parse year with AD suffix', async () => {
      const result = await temporalResolver.resolveDate('1050 AD');
      expect(result.year).toBe(1050);
      expect(result.precision).toBe('exact');
    });

    it('should reject invalid years', async () => {
      await expect(temporalResolver.resolveDate('500')).rejects.toThrow();
      await expect(temporalResolver.resolveDate('2500')).rejects.toThrow();
    });
  });

  // ============================================================================
  // Tibetan Calendar (Rabjung) Dates
  // ============================================================================

  describe('Tibetan Calendar (Rabjung)', () => {
    it('should resolve rabjung with element and animal', async () => {
      const result = await temporalResolver.resolveDate('fire-dragon year of the 14th rabjung');
      expect(result.year).toBe(1856);
      expect(result.tibetanYear?.rabjung).toBe(14);
      expect(result.tibetanYear?.element).toBe('fire');
      expect(result.tibetanYear?.animal).toBe('dragon');
      expect(result.precision).toBe('exact');
      expect(result.confidence).toBe(0.9);
    });

    it('should resolve rabjung number only', async () => {
      const result = await temporalResolver.resolveDate('12th rabjung');
      expect(result.year).toBeGreaterThanOrEqual(RABJUNG_CYCLES[12].start);
      expect(result.year).toBeLessThanOrEqual(RABJUNG_CYCLES[12].end);
      expect(result.precision).toBe('estimated');
      expect(result.confidence).toBe(0.5);
    });

    it('should validate rabjung numbers', () => {
      expect(() => {
        temporalResolver.convertTibetanToGregorian(0, 1);
      }).toThrow();

      expect(() => {
        temporalResolver.convertTibetanToGregorian(18, 1);
      }).toThrow();
    });

    it('should validate year within rabjung', () => {
      expect(() => {
        temporalResolver.convertTibetanToGregorian(1, 0);
      }).toThrow();

      expect(() => {
        temporalResolver.convertTibetanToGregorian(1, 61);
      }).toThrow();
    });

    it('should convert rabjung correctly', () => {
      // Rabjung 1, Year 1 = 1027
      const year1 = temporalResolver.convertTibetanToGregorian(1, 1);
      expect(year1).toBe(1027);

      // Rabjung 1, Year 60 = 1086
      const year60 = temporalResolver.convertTibetanToGregorian(1, 60);
      expect(year60).toBe(1086);

      // Rabjung 14, Year 30 = 1836
      const year14_30 = temporalResolver.convertTibetanToGregorian(14, 30);
      expect(year14_30).toBe(1836);
    });
  });

  // ============================================================================
  // Element-Animal Dates
  // ============================================================================

  describe('Element-Animal Dates', () => {
    it('should resolve element-animal combination', async () => {
      const result = await temporalResolver.resolveDate('water-horse year', {
        defaultYear: 1100,
      });
      expect(result.tibetanYear?.element).toBe('water');
      expect(result.tibetanYear?.animal).toBe('horse');
      expect(result.precision).toBe('circa');
    });

    it('should use context year for disambiguation', async () => {
      const result1 = await temporalResolver.resolveDate('fire-dragon year', {
        defaultYear: 1100,
      });
      const result2 = await temporalResolver.resolveDate('fire-dragon year', {
        defaultYear: 1500,
      });

      // Results should be in different 60-year cycles
      expect(Math.abs(result1.year! - result2.year!) >= 60).toBe(true);
    });
  });

  // ============================================================================
  // Relative Dates
  // ============================================================================

  describe('Relative Dates', () => {
    it('should resolve "after X died"', async () => {
      const result = await temporalResolver.resolveDate('after Marpa died', {
        knownEntities: [marpa],
      });
      expect(result.year).toBe(1098); // 1097 + 1
      expect(result.precision).toBe('circa');
      expect(result.referenceEntity?.name).toBe('Marpa Lotsawa');
    });

    it('should resolve "before X was born"', async () => {
      const result = await temporalResolver.resolveDate('before Milarepa was born', {
        knownEntities: [milarepa],
      });
      expect(result.year).toBe(1051); // 1052 - 1
      expect(result.precision).toBe('circa');
    });

    it('should resolve "X years after Y died"', async () => {
      const result = await temporalResolver.resolveDate('3 years after Marpa died', {
        knownEntities: [marpa],
      });
      expect(result.year).toBe(1100); // 1097 + 3
    });

    it('should resolve "at age X"', async () => {
      const result = await temporalResolver.resolveDate('at age 40', {
        knownEntities: [milarepa],
      });
      expect(result.year).toBe(1092); // 1052 + 40
      expect(result.precision).toBe('exact');
    });

    it('should throw error if reference entity not found', async () => {
      await expect(
        temporalResolver.resolveDate('after Unknown Person died')
      ).rejects.toThrow();
    });

    it('should throw error if reference entity has no date', async () => {
      const entityWithoutDates: Entity = {
        ...marpa,
        dates: undefined,
      };

      await expect(
        temporalResolver.resolveDate('after Unknown died', {
          knownEntities: [entityWithoutDates],
        })
      ).rejects.toThrow();
    });
  });

  // ============================================================================
  // Era-Based Dates
  // ============================================================================

  describe('Era-Based Dates', () => {
    it('should resolve era name', async () => {
      const result = await temporalResolver.resolveDate('during the reign of Songsten Gampo');
      expect(result.year).toBeGreaterThanOrEqual(617);
      expect(result.year).toBeLessThanOrEqual(650);
      expect(result.era).toBe('Reign of Songsten Gampo');
    });

    it('should handle "early" modifier', async () => {
      const result = await temporalResolver.resolveDate('early Sakya period');
      expect(result.year).toBeLessThan(1300); // Should be in early part
    });

    it('should handle "late" modifier', async () => {
      const result = await temporalResolver.resolveDate('late Phagmodrupa dynasty');
      expect(result.year).toBeGreaterThan(1400); // Should be in late part
    });

    it('should resolve era date range', () => {
      const range = temporalResolver.resolveEraDate('Sakya Period');
      expect(range.start).toBe(1268);
      expect(range.end).toBe(1354);
      expect(range.precision).toBe('estimated');
    });

    it('should throw error for unknown era', () => {
      expect(() => {
        temporalResolver.resolveEraDate('Unknown Dynasty');
      }).toThrow();
    });
  });

  // ============================================================================
  // Natural Language Dates
  // ============================================================================

  describe('Natural Language Dates', () => {
    it('should parse season + year', async () => {
      const result = await temporalResolver.resolveDate('summer of 1050');
      expect(result.year).toBe(1050);
      expect(result.season).toBe('summer');
      expect(result.precision).toBe('exact');
    });

    it('should parse "autumn" as "fall"', async () => {
      const result = await temporalResolver.resolveDate('autumn of 1100');
      expect(result.season).toBe('fall');
    });

    it('should parse century expressions', async () => {
      const result = await temporalResolver.resolveDate('mid-11th century');
      expect(result.year).toBe(1050); // Mid 11th century
      expect(result.precision).toBe('estimated');
    });

    it('should parse "early century"', async () => {
      const result = await temporalResolver.resolveDate('early 12th century');
      expect(result.year).toBe(1120); // Early 12th century
    });

    it('should parse "late century"', async () => {
      const result = await temporalResolver.resolveDate('late 13th century');
      expect(result.year).toBe(1280); // Late 13th century
    });
  });

  // ============================================================================
  // Helper Methods
  // ============================================================================

  describe('Helper Methods', () => {
    it('should calculate age correctly', () => {
      const age = temporalResolver.calculateAge(1012, 1052);
      expect(age).toBe(40);
    });

    it('should calculate age at death', () => {
      const age = temporalResolver.calculateAge(1012, 1097);
      expect(age).toBe(85);
    });
  });

  // ============================================================================
  // Data Integrity Tests
  // ============================================================================

  describe('Data Integrity', () => {
    it('should have 17 rabjung cycles', () => {
      expect(Object.keys(RABJUNG_CYCLES).length).toBe(17);
    });

    it('should have continuous rabjung cycles', () => {
      for (let i = 1; i < 17; i++) {
        const current = RABJUNG_CYCLES[i];
        const next = RABJUNG_CYCLES[i + 1];
        expect(next.start).toBe(current.end + 1);
      }
    });

    it('should have 60-year rabjung cycles', () => {
      Object.values(RABJUNG_CYCLES).forEach(cycle => {
        expect(cycle.end - cycle.start + 1).toBe(60);
      });
    });

    it('should have 60 element-animal combinations', () => {
      expect(ELEMENT_ANIMAL_CYCLE.length).toBe(60);
    });

    it('should have unique element-animal combinations', () => {
      const combinations = ELEMENT_ANIMAL_CYCLE.map(
        e => `${e.element}-${e.animal}-${e.gender}`
      );
      const unique = new Set(combinations);
      expect(unique.size).toBe(60);
    });

    it('should have valid eras', () => {
      ERAS.forEach(era => {
        expect(era.startYear).toBeLessThan(era.endYear);
        expect(era.confidence).toBeGreaterThan(0);
        expect(era.confidence).toBeLessThanOrEqual(1);
      });
    });
  });

  // ============================================================================
  // Edge Cases
  // ============================================================================

  describe('Edge Cases', () => {
    it('should handle different case inputs', async () => {
      const result1 = await temporalResolver.resolveDate('FIRE-DRAGON YEAR OF THE 14TH RABJUNG');
      const result2 = await temporalResolver.resolveDate('fire-dragon year of the 14th rabjung');
      expect(result1.year).toBe(result2.year);
    });

    it('should handle extra whitespace', async () => {
      const result = await temporalResolver.resolveDate('  1012  CE  ');
      expect(result.year).toBe(1012);
    });

    it('should throw error for completely invalid input', async () => {
      await expect(temporalResolver.resolveDate('invalid date')).rejects.toThrow();
      await expect(temporalResolver.resolveDate('')).rejects.toThrow();
    });
  });

  // ============================================================================
  // Confidence Scoring
  // ============================================================================

  describe('Confidence Scoring', () => {
    it('should assign high confidence to direct dates', async () => {
      const result = await temporalResolver.resolveDate('1012');
      expect(result.confidence).toBe(1.0);
    });

    it('should assign high confidence to full rabjung dates', async () => {
      const result = await temporalResolver.resolveDate('fire-dragon year of the 14th rabjung');
      expect(result.confidence).toBe(0.9);
    });

    it('should assign lower confidence to era dates', async () => {
      const result = await temporalResolver.resolveDate('during Sakya period');
      expect(result.confidence).toBeLessThan(0.8);
    });

    it('should assign lowest confidence to vague rabjung dates', async () => {
      const result = await temporalResolver.resolveDate('12th rabjung');
      expect(result.confidence).toBe(0.5);
    });
  });
});
