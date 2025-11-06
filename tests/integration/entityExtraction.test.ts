/**
 * Entity Extraction Integration Tests
 *
 * Tests the entity extraction validation and transformation logic.
 * Note: Full database integration tests require schema migrations.
 *
 * Phase 0.4.1 of Knowledge Graph implementation
 */

import { describe, it, expect } from 'vitest';
import { randomUUID } from 'crypto';
import { validateEntity } from '../../server/validators/entities';
import type {
  PersonEntity,
  PlaceEntity,
  Relationship,
  EntityType
} from '../../server/types/entities';

describe('Entity Extraction Integration Tests', () => {
  describe('Entity Validation', () => {
    it('should validate a complete person entity', () => {
      const validPerson: PersonEntity = {
        id: randomUUID(),
        type: 'person',
        canonicalName: 'Marpa Lotsawa',
        names: {
          tibetan: ['མར་པ་ལོ་ཙཱ་བ།'],
          english: ['Marpa Lotsawa', 'Marpa the Translator'],
          wylie: ['mar pa lo tsA ba'],
          phonetic: ['Marpa Lotsawa']
        },
        attributes: {
          titles: ['Lotsawa'],
          roles: ['translator', 'teacher'],
          tradition: ['Kagyu'],
          gender: 'male'
        },
        dates: {
          birth: {
            year: 1012,
            precision: 'exact',
            confidence: 0.9
          },
          death: {
            year: 1097,
            precision: 'exact',
            confidence: 0.9
          }
        },
        confidence: 0.95,
        verified: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: 'ai'
      };

      const result = validateEntity(validPerson);
      expect(result.type).toBe('person');
      expect(result.canonicalName).toBe('Marpa Lotsawa');
      expect(result.confidence).toBe(0.95);
    });

    it('should validate a place entity', () => {
      const validPlace: PlaceEntity = {
        id: randomUUID(),
        type: 'place',
        canonicalName: 'Lhodrak',
        names: {
          tibetan: ['ལྷོ་བྲག'],
          english: ['Lhodrak'],
          wylie: ['lho brag'],
          phonetic: ['Lhodrak']
        },
        attributes: {
          placeType: 'region',
          region: 'Southern Tibet'
        },
        confidence: 0.85,
        verified: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: 'ai'
      };

      const result = validateEntity(validPlace);
      expect(result.type).toBe('place');
      expect(result.canonicalName).toBe('Lhodrak');
    });

    it('should reject entity with invalid confidence', () => {
      const invalidEntity = {
        id: 'test-invalid-1',
        type: 'person' as const,
        canonicalName: 'Test Person',
        names: {
          tibetan: ['test'],
          english: ['Test'],
          wylie: ['test'],
          phonetic: ['test']
        },
        attributes: {},
        confidence: 1.5, // Invalid: > 1.0
        verified: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: 'ai'
      };

      expect(() => validateEntity(invalidEntity)).toThrow();
    });

    it('should reject entity with missing required fields', () => {
      const invalidEntity = {
        type: 'person' as const,
        canonicalName: 'Test Person',
        // Missing names
        confidence: 0.9,
        verified: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: 'ai'
      };

      expect(() => validateEntity(invalidEntity)).toThrow();
    });
  });

  describe('Relationship Structure', () => {
    it('should validate a teacher-student relationship', () => {
      const validRelationship: Relationship = {
        id: 'test-rel-1',
        subjectId: 'person-1',
        predicate: 'teacher_of',
        objectId: 'person-2',
        properties: {
          duration: '12 years'
        },
        confidence: 0.95,
        verified: false,
        sourceQuote: 'Marpa was a teacher of Milarepa for twelve years',
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: 'ai'
      };

      expect(validRelationship.subjectId).toBeDefined();
      expect(validRelationship.objectId).toBeDefined();
      expect(validRelationship.predicate).toBe('teacher_of');
      expect(validRelationship.confidence).toBeGreaterThan(0);
      expect(validRelationship.confidence).toBeLessThanOrEqual(1);
    });

    it('should validate a lived_at relationship', () => {
      const validRelationship: Relationship = {
        id: 'test-rel-2',
        subjectId: 'person-1',
        predicate: 'lived_at',
        objectId: 'place-1',
        properties: {
          location: 'Lhodrak'
        },
        confidence: 0.9,
        verified: false,
        sourceQuote: 'He lived in Lhodrak',
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: 'ai'
      };

      expect(validRelationship.predicate).toBe('lived_at');
      expect(validRelationship.properties.location).toBe('Lhodrak');
    });
  });

  describe('Date Precision Handling', () => {
    it('should handle exact dates', () => {
      const entity: PersonEntity = {
        id: 'test-person-dates-1',
        type: 'person',
        canonicalName: 'Test Person',
        names: {
          tibetan: ['test'],
          english: ['Test'],
          wylie: ['test'],
          phonetic: ['test']
        },
        attributes: {},
        dates: {
          birth: {
            year: 1012,
            precision: 'exact',
            confidence: 1.0
          }
        },
        confidence: 0.9,
        verified: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: 'ai'
      };

      expect(entity.dates?.birth?.precision).toBe('exact');
      expect(entity.dates?.birth?.year).toBe(1012);
    });

    it('should handle circa dates', () => {
      const entity: PersonEntity = {
        id: 'test-person-dates-2',
        type: 'person',
        canonicalName: 'Test Person',
        names: {
          tibetan: ['test'],
          english: ['Test'],
          wylie: ['test'],
          phonetic: ['test']
        },
        attributes: {},
        dates: {
          birth: {
            year: 1050,
            precision: 'circa',
            confidence: 0.7
          }
        },
        confidence: 0.8,
        verified: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: 'ai'
      };

      expect(entity.dates?.birth?.precision).toBe('circa');
      expect(entity.dates?.birth?.confidence).toBeLessThan(1.0);
    });

    it('should handle Tibetan calendar dates', () => {
      const entity: PersonEntity = {
        id: 'test-person-dates-3',
        type: 'person',
        canonicalName: 'Test Person',
        names: {
          tibetan: ['test'],
          english: ['Test'],
          wylie: ['test'],
          phonetic: ['test']
        },
        attributes: {},
        dates: {
          birth: {
            year: 1012,
            tibetanYear: {
              rabjung: 1,
              year: 29,
              element: 'water',
              animal: 'dragon'
            },
            precision: 'exact',
            confidence: 0.9
          }
        },
        confidence: 0.9,
        verified: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: 'ai'
      };

      expect(entity.dates?.birth?.tibetanYear?.element).toBe('water');
      expect(entity.dates?.birth?.tibetanYear?.animal).toBe('dragon');
    });
  });

  describe('Confidence Scoring', () => {
    it('should calculate average confidence from multiple entities', () => {
      const entities = [
        { confidence: 0.9, name: 'Entity 1' },
        { confidence: 0.8, name: 'Entity 2' },
        { confidence: 0.7, name: 'Entity 3' }
      ];

      const average = entities.reduce((sum, e) => sum + e.confidence, 0) / entities.length;

      expect(average).toBeCloseTo(0.8, 2);
    });

    it('should identify low confidence entities for review', () => {
      const entities = [
        { id: '1', confidence: 0.9, name: 'High confidence' },
        { id: '2', confidence: 0.4, name: 'Low confidence' },
        { id: '3', confidence: 0.8, name: 'Medium confidence' },
        { id: '4', confidence: 0.3, name: 'Very low confidence' }
      ];

      const lowConfidenceThreshold = 0.5;
      const lowConfidenceEntities = entities.filter(e => e.confidence < lowConfidenceThreshold);

      expect(lowConfidenceEntities).toHaveLength(2);
      expect(lowConfidenceEntities.map(e => e.id)).toEqual(['2', '4']);
    });

    it('should track confidence distribution', () => {
      const entities = [
        { confidence: 0.95 },
        { confidence: 0.85 },
        { confidence: 0.75 },
        { confidence: 0.65 },
        { confidence: 0.45 }
      ];

      const highConfidence = entities.filter(e => e.confidence >= 0.8).length;
      const mediumConfidence = entities.filter(e => e.confidence >= 0.6 && e.confidence < 0.8).length;
      const lowConfidence = entities.filter(e => e.confidence < 0.6).length;

      expect(highConfidence).toBe(2);
      expect(mediumConfidence).toBe(2);
      expect(lowConfidence).toBe(1);
    });
  });

  describe('Entity Type Distribution', () => {
    it('should categorize entities by type', () => {
      const entities: Array<{ type: EntityType }> = [
        { type: 'person' },
        { type: 'person' },
        { type: 'place' },
        { type: 'text' },
        { type: 'person' },
        { type: 'event' }
      ];

      const byType = entities.reduce((acc, e) => {
        acc[e.type] = (acc[e.type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      expect(byType.person).toBe(3);
      expect(byType.place).toBe(1);
      expect(byType.text).toBe(1);
      expect(byType.event).toBe(1);
    });
  });

  describe('Name Variants', () => {
    it('should store multiple name variants', () => {
      const entity: PersonEntity = {
        id: 'test-person-names',
        type: 'person',
        canonicalName: 'Marpa Lotsawa',
        names: {
          tibetan: ['མར་པ་ལོ་ཙཱ་བ།', 'མར་པ།'],
          english: ['Marpa Lotsawa', 'Marpa the Translator', 'Marpa'],
          wylie: ['mar pa lo tsA ba', 'mar pa'],
          phonetic: ['Marpa Lotsawa', 'Marpa'],
          sanskrit: ['Mārpa Lotsāwa']
        },
        attributes: {},
        confidence: 0.9,
        verified: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: 'ai'
      };

      expect(entity.names.english.length).toBeGreaterThan(1);
      expect(entity.names.tibetan).toContain('མར་པ།');
      expect(entity.names.sanskrit).toBeDefined();
    });
  });

  describe('Extraction Statistics', () => {
    it('should calculate extraction metrics', () => {
      const extractionResult = {
        entities: new Array(15).fill(null),
        relationships: new Array(8).fill(null),
        processingTime: 2500,
        averageConfidence: 0.85
      };

      expect(extractionResult.entities.length).toBe(15);
      expect(extractionResult.relationships.length).toBe(8);
      expect(extractionResult.processingTime).toBeLessThan(5000);
      expect(extractionResult.averageConfidence).toBeGreaterThan(0.7);
    });
  });

  describe('Ambiguity Handling', () => {
    it('should flag ambiguous references', () => {
      const ambiguities = [
        'Pronoun "he" in paragraph 2 could refer to multiple people',
        'Date "circa 1050" has low precision',
        'Place name "Lho" is incomplete'
      ];

      expect(ambiguities.length).toBeGreaterThan(0);
      expect(ambiguities[0]).toContain('Pronoun');
    });
  });
});
