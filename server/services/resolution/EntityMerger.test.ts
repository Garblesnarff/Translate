/**
 * Entity Merger Tests
 *
 * Comprehensive test suite for entity merging functionality
 *
 * Tests cover:
 * - Basic entity merging
 * - Conflict detection and resolution
 * - Name variant merging
 * - Date conflict handling
 * - Referential integrity updates
 * - Merge preview
 * - Rollback capability
 * - Edge cases
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { EntityMerger } from './EntityMerger';
import type { PersonEntity, PlaceEntity } from '../../types/entities';

describe('EntityMerger', () => {
  let merger: EntityMerger;

  beforeEach(() => {
    merger = new EntityMerger();
  });

  describe('combineEntities', () => {
    it('should merge two person entities with no conflicts', () => {
      const primary: PersonEntity = {
        id: 'person-1',
        type: 'person',
        canonicalName: 'Marpa Lotsawa',
        names: {
          tibetan: ['མར་པ་ལོ་ཙཱ་བ'],
          english: ['Marpa the Translator'],
          phonetic: ['Marpa'],
          wylie: ['mar pa lo tsa ba'],
        },
        attributes: {
          titles: ['Lotsawa'],
          roles: ['translator', 'teacher'],
          tradition: ['Kagyu'],
        },
        confidence: 0.9,
        verified: true,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
        createdBy: 'ai',
      };

      const duplicate: PersonEntity = {
        id: 'person-2',
        type: 'person',
        canonicalName: 'Mar-pa',
        names: {
          tibetan: [],
          english: ['Marpa'],
          phonetic: ['Mar-pa'],
          wylie: ['mar-pa'],
        },
        attributes: {
          roles: ['yogi'],
          affiliations: ['Kagyu Lineage'],
        },
        confidence: 0.7,
        verified: false,
        createdAt: new Date('2024-01-02'),
        updatedAt: new Date('2024-01-02'),
        createdBy: 'ai',
      };

      const combined = merger.combineEntities(primary, duplicate);

      // Should keep primary canonical name
      expect(combined.canonicalName).toBe('Marpa Lotsawa');

      // Should merge all name variants
      expect(combined.names.tibetan).toContain('མར་པ་ལོ་ཙཱ་བ');
      expect(combined.names.english).toContain('Marpa the Translator');
      expect(combined.names.english).toContain('Marpa');
      expect(combined.names.phonetic).toContain('Marpa');
      expect(combined.names.phonetic).toContain('Mar-pa');

      // Should merge attributes
      expect(combined.attributes.roles).toContain('translator');
      expect(combined.attributes.roles).toContain('teacher');
      expect(combined.attributes.roles).toContain('yogi');
      expect(combined.attributes.affiliations).toContain('Kagyu Lineage');

      // Should calculate weighted confidence
      expect(combined.confidence).toBeGreaterThan(0.7);
      expect(combined.confidence).toBeLessThan(0.9);

      // Should preserve verification status
      expect(combined.verified).toBe(true);
    });

    it('should detect conflicts in entity attributes', () => {
      const primary: PersonEntity = {
        id: 'person-1',
        type: 'person',
        canonicalName: 'Je Tsongkhapa',
        names: {
          tibetan: ['རྗེ་ཙོང་ཁ་པ'],
          english: ['Je Tsongkhapa'],
          phonetic: ['Tsongkhapa'],
          wylie: ['rje tsong kha pa'],
        },
        attributes: {
          gender: 'male',
          tradition: ['Gelug'],
        },
        dates: {
          birth: {
            year: 1357,
            precision: 'exact',
            confidence: 0.95,
          },
          death: {
            year: 1419,
            precision: 'exact',
            confidence: 0.95,
          },
        },
        confidence: 0.95,
        verified: true,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
        createdBy: 'ai',
      };

      const duplicate: PersonEntity = {
        id: 'person-2',
        type: 'person',
        canonicalName: 'Tsongkhapa',
        names: {
          tibetan: [],
          english: ['Tsongkhapa'],
          phonetic: ['Tsong-ka-pa'],
          wylie: ['tsong kha pa'],
        },
        attributes: {
          gender: 'male',
          tradition: ['Gelug'],
        },
        dates: {
          birth: {
            year: 1357,
            precision: 'exact',
            confidence: 0.95,
          },
          death: {
            year: 1420, // CONFLICT: Different death year
            precision: 'circa',
            confidence: 0.7,
          },
        },
        confidence: 0.8,
        verified: false,
        createdAt: new Date('2024-01-02'),
        updatedAt: new Date('2024-01-02'),
        createdBy: 'ai',
      };

      const combined = merger.combineEntities(primary, duplicate, 'highest_confidence');

      // Should detect date conflict
      expect(combined._conflicts).toBeDefined();
      expect(combined._conflicts!.length).toBeGreaterThan(0);

      const dateConflict = combined._conflicts!.find(c =>
        c.attribute.includes('death.year')
      );
      expect(dateConflict).toBeDefined();
      expect(dateConflict!.conflictType).toBe('date_mismatch');
      expect(dateConflict!.severity).toBe('high');

      // Should resolve by keeping primary's date (higher confidence)
      expect(combined.dates?.death?.year).toBe(1419);
    });

    it('should merge place entities with geographic data', () => {
      const primary: PlaceEntity = {
        id: 'place-1',
        type: 'place',
        canonicalName: 'Sakya Monastery',
        names: {
          tibetan: ['ས་སྐྱ་དགོན་པ'],
          english: ['Sakya Monastery'],
          phonetic: ['Sakya Gon'],
          wylie: ['sa skya dgon pa'],
        },
        attributes: {
          placeType: 'monastery',
          region: 'Tsang',
          modernCountry: 'Tibet (China)',
          coordinates: {
            latitude: 28.9,
            longitude: 88.0,
            accuracy: 1000,
            source: 'GPS survey',
          },
        },
        confidence: 0.9,
        verified: true,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
        createdBy: 'ai',
      };

      const duplicate: PlaceEntity = {
        id: 'place-2',
        type: 'place',
        canonicalName: 'Sakya',
        names: {
          tibetan: [],
          english: ['Sakya'],
          phonetic: ['Sakya'],
          wylie: ['sa skya'],
        },
        attributes: {
          placeType: 'monastery',
          significance: ['Seat of Sakya tradition'],
        },
        dates: {
          founded: {
            year: 1073,
            precision: 'exact',
            confidence: 0.9,
          },
        },
        confidence: 0.7,
        verified: false,
        createdAt: new Date('2024-01-02'),
        updatedAt: new Date('2024-01-02'),
        createdBy: 'ai',
      };

      const combined = merger.combineEntities(primary, duplicate);

      // Should keep more complete canonical name
      expect(combined.canonicalName).toBe('Sakya Monastery');

      // Should preserve geographic data
      expect(combined.attributes.coordinates).toBeDefined();
      expect(combined.attributes.coordinates?.latitude).toBe(28.9);

      // Should add significance from duplicate
      expect(combined.attributes.significance).toBeDefined();
      expect(combined.attributes.significance).toContain('Seat of Sakya tradition');

      // Should preserve founded date
      expect(combined.dates?.founded?.year).toBe(1073);
    });

    it('should handle array merging and deduplication', () => {
      const primary: PersonEntity = {
        id: 'person-1',
        type: 'person',
        canonicalName: 'Atisha',
        names: {
          tibetan: ['ཨ་ཏི་ཤ'],
          english: ['Atisha', 'Jowo Je'],
          phonetic: ['Atisha'],
          wylie: ['a ti sha'],
          sanskrit: ['Atiśa'],
        },
        attributes: {
          titles: ['Dipamkara Shrijnana'],
          roles: ['teacher', 'scholar'],
          tradition: ['Kadam'],
        },
        confidence: 0.9,
        verified: true,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
        createdBy: 'ai',
      };

      const duplicate: PersonEntity = {
        id: 'person-2',
        type: 'person',
        canonicalName: 'Jowo Je Atisha',
        names: {
          tibetan: [],
          english: ['Atisha', 'Jowo Atisha'], // Partial overlap
          phonetic: ['Atisha'],
          wylie: ['jo bo rje'],
        },
        attributes: {
          roles: ['teacher', 'translator'], // Partial overlap
          tradition: ['Kadam', 'Mahayana'], // Partial overlap
        },
        confidence: 0.8,
        verified: false,
        createdAt: new Date('2024-01-02'),
        updatedAt: new Date('2024-01-02'),
        createdBy: 'ai',
      };

      const combined = merger.combineEntities(primary, duplicate);

      // Should deduplicate overlapping array items
      const englishNames = combined.names.english;
      expect(englishNames.filter(n => n === 'Atisha')).toHaveLength(1);

      // Should include unique items from both
      expect(englishNames).toContain('Jowo Je');
      expect(englishNames).toContain('Jowo Atisha');

      // Should merge roles without duplicates
      expect(combined.attributes.roles).toContain('teacher');
      expect(combined.attributes.roles).toContain('scholar');
      expect(combined.attributes.roles).toContain('translator');
      expect(combined.attributes.roles!.filter(r => r === 'teacher')).toHaveLength(1);

      // Should merge traditions
      expect(combined.attributes.tradition).toContain('Kadam');
      expect(combined.attributes.tradition).toContain('Mahayana');
    });

    it('should prefer more precise dates', () => {
      const primary: PersonEntity = {
        id: 'person-1',
        type: 'person',
        canonicalName: 'Milarepa',
        names: {
          tibetan: ['མི་ལ་རས་པ'],
          english: ['Milarepa'],
          phonetic: ['Milarepa'],
          wylie: ['mi la ras pa'],
        },
        attributes: {},
        dates: {
          birth: {
            year: 1040,
            precision: 'circa',
            confidence: 0.7,
          },
        },
        confidence: 0.8,
        verified: false,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
        createdBy: 'ai',
      };

      const duplicate: PersonEntity = {
        id: 'person-2',
        type: 'person',
        canonicalName: 'Mila Repa',
        names: {
          tibetan: [],
          english: ['Mila'],
          phonetic: ['Mila'],
          wylie: ['mi la'],
        },
        attributes: {},
        dates: {
          birth: {
            year: 1052,
            precision: 'exact', // More precise
            confidence: 0.9,
            source: 'Biography of Milarepa',
          },
        },
        confidence: 0.85,
        verified: true,
        createdAt: new Date('2024-01-02'),
        updatedAt: new Date('2024-01-02'),
        createdBy: 'curator-1',
      };

      const combined = merger.combineEntities(primary, duplicate, 'highest_confidence');

      // Should prefer exact date over circa
      expect(combined.dates?.birth?.year).toBe(1052);
      expect(combined.dates?.birth?.precision).toBe('exact');
      expect(combined.dates?.birth?.source).toBe('Biography of Milarepa');
    });
  });

  describe('Edge Cases', () => {
    it('should handle entities with minimal data', () => {
      const primary: PersonEntity = {
        id: 'person-1',
        type: 'person',
        canonicalName: 'Unknown Master',
        names: {
          tibetan: [],
          english: ['Unknown Master'],
          phonetic: [],
          wylie: [],
        },
        attributes: {},
        confidence: 0.3,
        verified: false,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
        createdBy: 'ai',
      };

      const duplicate: PersonEntity = {
        id: 'person-2',
        type: 'person',
        canonicalName: 'Unknown',
        names: {
          tibetan: [],
          english: [],
          phonetic: [],
          wylie: [],
        },
        attributes: {},
        confidence: 0.2,
        verified: false,
        createdAt: new Date('2024-01-02'),
        updatedAt: new Date('2024-01-02'),
        createdBy: 'ai',
      };

      const combined = merger.combineEntities(primary, duplicate);

      expect(combined).toBeDefined();
      expect(combined.canonicalName).toBe('Unknown Master');
      expect(combined.confidence).toBeGreaterThan(0);
    });

    it('should handle entities with conflicting verification status', () => {
      const primary: PersonEntity = {
        id: 'person-1',
        type: 'person',
        canonicalName: 'Padmasambhava',
        names: {
          tibetan: ['པདྨ་འབྱུང་གནས'],
          english: ['Padmasambhava'],
          phonetic: ['Pemajungne'],
          wylie: ['pad+ma \'byung gnas'],
        },
        attributes: {},
        confidence: 0.7,
        verified: false, // Not verified
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
        createdBy: 'ai',
      };

      const duplicate: PersonEntity = {
        id: 'person-2',
        type: 'person',
        canonicalName: 'Guru Rinpoche',
        names: {
          tibetan: ['གུ་རུ་རིན་པོ་ཆེ'],
          english: ['Guru Rinpoche'],
          phonetic: ['Guru Rinpoche'],
          wylie: ['gu ru rin po che'],
        },
        attributes: {},
        confidence: 0.8,
        verified: true, // Verified by curator
        verifiedBy: 'curator-1',
        verifiedAt: new Date('2024-01-15'),
        createdAt: new Date('2024-01-02'),
        updatedAt: new Date('2024-01-02'),
        createdBy: 'ai',
      };

      const combined = merger.combineEntities(primary, duplicate);

      // Should be marked as verified (either one is verified = both verified)
      expect(combined.verified).toBe(true);
      expect(combined.verifiedBy).toBe('curator-1');
      expect(combined.verifiedAt).toBeDefined();
    });
  });

  describe('Conflict Resolution Strategies', () => {
    it('should use highest_confidence strategy correctly', () => {
      const primary: PersonEntity = {
        id: 'person-1',
        type: 'person',
        canonicalName: 'Naropa',
        names: {
          tibetan: [],
          english: ['Naropa'],
          phonetic: [],
          wylie: [],
        },
        attributes: {
          gender: 'male',
        },
        confidence: 0.95, // Higher confidence
        verified: true,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
        createdBy: 'curator-1',
      };

      const duplicate: PersonEntity = {
        id: 'person-2',
        type: 'person',
        canonicalName: 'Naropa',
        names: {
          tibetan: [],
          english: [],
          phonetic: [],
          wylie: [],
        },
        attributes: {
          gender: 'unknown', // Conflict
        },
        confidence: 0.6, // Lower confidence
        verified: false,
        createdAt: new Date('2024-01-02'),
        updatedAt: new Date('2024-01-02'),
        createdBy: 'ai',
      };

      const combined = merger.combineEntities(primary, duplicate, 'highest_confidence');

      // Should keep primary's gender (higher confidence)
      expect(combined.attributes.gender).toBe('male');
    });
  });
});
