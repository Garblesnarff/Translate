/**
 * Relationship Validator Tests
 *
 * Tests all validation categories:
 * - Type constraints
 * - Temporal consistency
 * - Logical constraints
 * - Cross-reference validation
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { RelationshipValidator } from '../../server/services/relationships/RelationshipValidator';
import type { Entity, Relationship, PersonEntity, TextEntity, PlaceEntity } from '../../server/types/entities';

describe('RelationshipValidator', () => {
  let validator: RelationshipValidator;
  let entities: Map<string, Entity>;

  beforeEach(() => {
    validator = new RelationshipValidator();
    entities = new Map();
  });

  // ============================================================================
  // Type Constraint Tests
  // ============================================================================

  describe('Type Constraints', () => {
    it('should validate correct teacher_of relationship (person → person)', () => {
      const marpa: PersonEntity = {
        id: 'marpa-1',
        type: 'person',
        canonicalName: 'Marpa',
        names: { tibetan: ['མར་པ།'], english: ['Marpa'], phonetic: [], wylie: ['mar pa'] },
        confidence: 0.95,
        verified: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: 'ai',
        attributes: { roles: ['teacher'] }
      };

      const milarepa: PersonEntity = {
        id: 'milarepa-1',
        type: 'person',
        canonicalName: 'Milarepa',
        names: { tibetan: ['མི་ལ་རས་པ།'], english: ['Milarepa'], phonetic: [], wylie: ['mi la ras pa'] },
        confidence: 0.95,
        verified: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: 'ai',
        attributes: { roles: ['student'] }
      };

      entities.set(marpa.id, marpa);
      entities.set(milarepa.id, milarepa);

      const relationship: Relationship = {
        id: 'rel-1',
        subjectId: marpa.id,
        predicate: 'teacher_of',
        objectId: milarepa.id,
        properties: {},
        confidence: 0.9,
        verified: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: 'ai'
      };

      const result = validator.validateRelationship(relationship, entities);

      expect(result.valid).toBe(true);
      expect(result.issues.filter(i => i.severity === 'error')).toHaveLength(0);
    });

    it('should reject teacher_of with wrong types (person → text)', () => {
      const person: PersonEntity = {
        id: 'person-1',
        type: 'person',
        canonicalName: 'Teacher',
        names: { tibetan: [], english: ['Teacher'], phonetic: [], wylie: [] },
        confidence: 0.95,
        verified: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: 'ai',
        attributes: {}
      };

      const text: TextEntity = {
        id: 'text-1',
        type: 'text',
        canonicalName: 'Some Text',
        names: { tibetan: [], english: ['Some Text'], phonetic: [], wylie: [] },
        confidence: 0.95,
        verified: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: 'ai',
        attributes: { textType: 'commentary', language: 'Tibetan' }
      };

      entities.set(person.id, person);
      entities.set(text.id, text);

      const relationship: Relationship = {
        id: 'rel-1',
        subjectId: person.id,
        predicate: 'teacher_of',
        objectId: text.id,
        properties: {},
        confidence: 0.9,
        verified: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: 'ai'
      };

      const result = validator.validateRelationship(relationship, entities);

      expect(result.valid).toBe(false);
      expect(result.issues).toContainEqual(
        expect.objectContaining({
          severity: 'error',
          category: 'type',
          code: 'INVALID_OBJECT_TYPE'
        })
      );
    });

    it('should validate wrote relationship (person → text)', () => {
      const author: PersonEntity = {
        id: 'author-1',
        type: 'person',
        canonicalName: 'Tsongkhapa',
        names: { tibetan: [], english: ['Tsongkhapa'], phonetic: [], wylie: [] },
        confidence: 0.95,
        verified: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: 'ai',
        attributes: { roles: ['scholar', 'teacher'] }
      };

      const text: TextEntity = {
        id: 'text-1',
        type: 'text',
        canonicalName: 'Lamrim Chenmo',
        names: { tibetan: [], english: ['Lamrim Chenmo'], phonetic: [], wylie: [] },
        confidence: 0.95,
        verified: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: 'ai',
        attributes: { textType: 'philosophical_treatise', language: 'Tibetan' }
      };

      entities.set(author.id, author);
      entities.set(text.id, text);

      const relationship: Relationship = {
        id: 'rel-1',
        subjectId: author.id,
        predicate: 'wrote',
        objectId: text.id,
        properties: {
          date: { year: 1402, precision: 'exact' as const, confidence: 0.9 }
        },
        confidence: 0.9,
        verified: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: 'ai'
      };

      const result = validator.validateRelationship(relationship, entities);

      expect(result.valid).toBe(true);
      expect(result.issues.filter(i => i.severity === 'error')).toHaveLength(0);
    });
  });

  // ============================================================================
  // Temporal Consistency Tests
  // ============================================================================

  describe('Temporal Consistency', () => {
    it('should detect action before birth', () => {
      const person: PersonEntity = {
        id: 'person-1',
        type: 'person',
        canonicalName: 'Someone',
        names: { tibetan: [], english: ['Someone'], phonetic: [], wylie: [] },
        confidence: 0.95,
        verified: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: 'ai',
        attributes: {},
        dates: {
          birth: { year: 1050, precision: 'exact' as const, confidence: 0.9 }
        }
      };

      const place: PlaceEntity = {
        id: 'place-1',
        type: 'place',
        canonicalName: 'Some Monastery',
        names: { tibetan: [], english: ['Some Monastery'], phonetic: [], wylie: [] },
        confidence: 0.95,
        verified: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: 'ai',
        attributes: { placeType: 'monastery' }
      };

      entities.set(person.id, person);
      entities.set(place.id, place);

      const relationship: Relationship = {
        id: 'rel-1',
        subjectId: person.id,
        predicate: 'founded',
        objectId: place.id,
        properties: {
          date: { year: 1040, precision: 'exact' as const, confidence: 0.9 } // 10 years before birth!
        },
        confidence: 0.9,
        verified: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: 'ai'
      };

      const result = validator.validateRelationship(relationship, entities);

      expect(result.valid).toBe(false);
      expect(result.issues).toContainEqual(
        expect.objectContaining({
          severity: 'error',
          category: 'temporal',
          code: 'ACTION_BEFORE_BIRTH'
        })
      );
      expect(result.confidence).toBeLessThan(0.9); // Confidence reduced
    });

    it('should detect action after death', () => {
      const person: PersonEntity = {
        id: 'person-1',
        type: 'person',
        canonicalName: 'Someone',
        names: { tibetan: [], english: ['Someone'], phonetic: [], wylie: [] },
        confidence: 0.95,
        verified: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: 'ai',
        attributes: {},
        dates: {
          birth: { year: 1050, precision: 'exact' as const, confidence: 0.9 },
          death: { year: 1100, precision: 'exact' as const, confidence: 0.9 }
        }
      };

      const student: PersonEntity = {
        id: 'student-1',
        type: 'person',
        canonicalName: 'Student',
        names: { tibetan: [], english: ['Student'], phonetic: [], wylie: [] },
        confidence: 0.95,
        verified: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: 'ai',
        attributes: {}
      };

      entities.set(person.id, person);
      entities.set(student.id, student);

      const relationship: Relationship = {
        id: 'rel-1',
        subjectId: person.id,
        predicate: 'teacher_of',
        objectId: student.id,
        properties: {
          date: { year: 1110, precision: 'exact' as const, confidence: 0.9 } // 10 years after death!
        },
        confidence: 0.9,
        verified: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: 'ai'
      };

      const result = validator.validateRelationship(relationship, entities);

      expect(result.valid).toBe(false);
      expect(result.issues).toContainEqual(
        expect.objectContaining({
          severity: 'error',
          category: 'temporal',
          code: 'ACTION_AFTER_DEATH'
        })
      );
    });

    it('should detect teacher younger than student', () => {
      const teacher: PersonEntity = {
        id: 'teacher-1',
        type: 'person',
        canonicalName: 'Teacher',
        names: { tibetan: [], english: ['Teacher'], phonetic: [], wylie: [] },
        confidence: 0.95,
        verified: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: 'ai',
        attributes: {},
        dates: {
          birth: { year: 1070, precision: 'exact' as const, confidence: 0.9 }
        }
      };

      const student: PersonEntity = {
        id: 'student-1',
        type: 'person',
        canonicalName: 'Student',
        names: { tibetan: [], english: ['Student'], phonetic: [], wylie: [] },
        confidence: 0.95,
        verified: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: 'ai',
        attributes: {},
        dates: {
          birth: { year: 1050, precision: 'exact' as const, confidence: 0.9 } // Born BEFORE teacher
        }
      };

      entities.set(teacher.id, teacher);
      entities.set(student.id, student);

      const relationship: Relationship = {
        id: 'rel-1',
        subjectId: teacher.id,
        predicate: 'teacher_of',
        objectId: student.id,
        properties: {},
        confidence: 0.9,
        verified: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: 'ai'
      };

      const result = validator.validateRelationship(relationship, entities);

      expect(result.valid).toBe(false);
      expect(result.issues).toContainEqual(
        expect.objectContaining({
          severity: 'error',
          category: 'temporal',
          code: 'TEACHER_YOUNGER_THAN_STUDENT'
        })
      );
    });

    it('should detect text citing future text', () => {
      const laterText: TextEntity = {
        id: 'text-1',
        type: 'text',
        canonicalName: 'Later Text',
        names: { tibetan: [], english: ['Later Text'], phonetic: [], wylie: [] },
        confidence: 0.95,
        verified: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: 'ai',
        attributes: { textType: 'commentary', language: 'Tibetan' },
        dates: {
          composed: { year: 1200, precision: 'exact' as const, confidence: 0.9 }
        }
      };

      const earlierText: TextEntity = {
        id: 'text-2',
        type: 'text',
        canonicalName: 'Earlier Text',
        names: { tibetan: [], english: ['Earlier Text'], phonetic: [], wylie: [] },
        confidence: 0.95,
        verified: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: 'ai',
        attributes: { textType: 'sutra', language: 'Sanskrit' },
        dates: {
          composed: { year: 1300, precision: 'exact' as const, confidence: 0.9 } // Composed AFTER citing text
        }
      };

      entities.set(laterText.id, laterText);
      entities.set(earlierText.id, earlierText);

      const relationship: Relationship = {
        id: 'rel-1',
        subjectId: laterText.id,
        predicate: 'cites',
        objectId: earlierText.id,
        properties: {},
        confidence: 0.9,
        verified: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: 'ai'
      };

      const result = validator.validateRelationship(relationship, entities);

      expect(result.valid).toBe(false);
      expect(result.issues).toContainEqual(
        expect.objectContaining({
          severity: 'error',
          category: 'temporal',
          code: 'CITES_FUTURE_TEXT'
        })
      );
    });
  });

  // ============================================================================
  // Logical Constraint Tests
  // ============================================================================

  describe('Logical Constraints', () => {
    it('should detect self-relationship', () => {
      const person: PersonEntity = {
        id: 'person-1',
        type: 'person',
        canonicalName: 'Someone',
        names: { tibetan: [], english: ['Someone'], phonetic: [], wylie: [] },
        confidence: 0.95,
        verified: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: 'ai',
        attributes: {}
      };

      entities.set(person.id, person);

      const relationship: Relationship = {
        id: 'rel-1',
        subjectId: person.id,
        predicate: 'teacher_of',
        objectId: person.id, // Same as subject!
        properties: {},
        confidence: 0.9,
        verified: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: 'ai'
      };

      const result = validator.validateRelationship(relationship, entities);

      expect(result.valid).toBe(false);
      expect(result.issues).toContainEqual(
        expect.objectContaining({
          severity: 'error',
          category: 'logical',
          code: 'SELF_RELATIONSHIP'
        })
      );
    });

    it('should detect circular teacher-student relationship', () => {
      const person1: PersonEntity = {
        id: 'person-1',
        type: 'person',
        canonicalName: 'Person A',
        names: { tibetan: [], english: ['Person A'], phonetic: [], wylie: [] },
        confidence: 0.95,
        verified: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: 'ai',
        attributes: {}
      };

      const person2: PersonEntity = {
        id: 'person-2',
        type: 'person',
        canonicalName: 'Person B',
        names: { tibetan: [], english: ['Person B'], phonetic: [], wylie: [] },
        confidence: 0.95,
        verified: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: 'ai',
        attributes: {}
      };

      const person3: PersonEntity = {
        id: 'person-3',
        type: 'person',
        canonicalName: 'Person C',
        names: { tibetan: [], english: ['Person C'], phonetic: [], wylie: [] },
        confidence: 0.95,
        verified: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: 'ai',
        attributes: {}
      };

      entities.set(person1.id, person1);
      entities.set(person2.id, person2);
      entities.set(person3.id, person3);

      const allRelationships: Relationship[] = [
        {
          id: 'rel-1',
          subjectId: 'person-1',
          predicate: 'teacher_of',
          objectId: 'person-2',
          properties: {},
          confidence: 0.9,
          verified: false,
          createdAt: new Date(),
          updatedAt: new Date(),
          createdBy: 'ai'
        },
        {
          id: 'rel-2',
          subjectId: 'person-2',
          predicate: 'teacher_of',
          objectId: 'person-3',
          properties: {},
          confidence: 0.9,
          verified: false,
          createdAt: new Date(),
          updatedAt: new Date(),
          createdBy: 'ai'
        },
        {
          id: 'rel-3',
          subjectId: 'person-3',
          predicate: 'teacher_of',
          objectId: 'person-1', // Back to A! Creates cycle: A → B → C → A
          properties: {},
          confidence: 0.9,
          verified: false,
          createdAt: new Date(),
          updatedAt: new Date(),
          createdBy: 'ai'
        }
      ];

      const result = validator.validateRelationship(allRelationships[2], entities, allRelationships);

      expect(result.valid).toBe(false);
      expect(result.issues).toContainEqual(
        expect.objectContaining({
          severity: 'error',
          category: 'logical',
          code: 'CIRCULAR_RELATIONSHIP'
        })
      );
    });
  });

  // ============================================================================
  // Cross-Reference Validation Tests
  // ============================================================================

  describe('Cross-Reference Validation', () => {
    it('should suggest creating inverse relationship (teacher_of ↔ student_of)', () => {
      const teacher: PersonEntity = {
        id: 'teacher-1',
        type: 'person',
        canonicalName: 'Teacher',
        names: { tibetan: [], english: ['Teacher'], phonetic: [], wylie: [] },
        confidence: 0.95,
        verified: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: 'ai',
        attributes: {}
      };

      const student: PersonEntity = {
        id: 'student-1',
        type: 'person',
        canonicalName: 'Student',
        names: { tibetan: [], english: ['Student'], phonetic: [], wylie: [] },
        confidence: 0.95,
        verified: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: 'ai',
        attributes: {}
      };

      entities.set(teacher.id, teacher);
      entities.set(student.id, student);

      const relationship: Relationship = {
        id: 'rel-1',
        subjectId: teacher.id,
        predicate: 'teacher_of',
        objectId: student.id,
        properties: {},
        confidence: 0.9,
        verified: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: 'ai'
      };

      const result = validator.validateRelationship(relationship, entities, []);

      expect(result.warnings).toContainEqual(
        expect.objectContaining({
          severity: 'warning',
          category: 'reference',
          code: 'MISSING_INVERSE_RELATIONSHIP',
          autoFixable: true
        })
      );

      expect(result.suggestions).toContainEqual(
        expect.objectContaining({
          type: 'add_relationship',
          autoApply: true
        })
      );
    });

    it('should NOT warn if inverse relationship exists', () => {
      const teacher: PersonEntity = {
        id: 'teacher-1',
        type: 'person',
        canonicalName: 'Teacher',
        names: { tibetan: [], english: ['Teacher'], phonetic: [], wylie: [] },
        confidence: 0.95,
        verified: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: 'ai',
        attributes: {}
      };

      const student: PersonEntity = {
        id: 'student-1',
        type: 'person',
        canonicalName: 'Student',
        names: { tibetan: [], english: ['Student'], phonetic: [], wylie: [] },
        confidence: 0.95,
        verified: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: 'ai',
        attributes: {}
      };

      entities.set(teacher.id, teacher);
      entities.set(student.id, student);

      const allRelationships: Relationship[] = [
        {
          id: 'rel-1',
          subjectId: teacher.id,
          predicate: 'teacher_of',
          objectId: student.id,
          properties: {},
          confidence: 0.9,
          verified: false,
          createdAt: new Date(),
          updatedAt: new Date(),
          createdBy: 'ai'
        },
        {
          id: 'rel-2',
          subjectId: student.id,
          predicate: 'student_of',
          objectId: teacher.id,
          properties: {},
          confidence: 0.9,
          verified: false,
          createdAt: new Date(),
          updatedAt: new Date(),
          createdBy: 'ai'
        }
      ];

      const result = validator.validateRelationship(allRelationships[0], entities, allRelationships);

      const inverseWarnings = result.warnings.filter(w => w.code === 'MISSING_INVERSE_RELATIONSHIP');
      expect(inverseWarnings).toHaveLength(0);
    });
  });

  // ============================================================================
  // Batch Validation Tests
  // ============================================================================

  describe('Batch Validation', () => {
    it('should generate comprehensive batch validation report', () => {
      const person1: PersonEntity = {
        id: 'person-1',
        type: 'person',
        canonicalName: 'Person 1',
        names: { tibetan: [], english: ['Person 1'], phonetic: [], wylie: [] },
        confidence: 0.95,
        verified: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: 'ai',
        attributes: {},
        dates: {
          birth: { year: 1050, precision: 'exact' as const, confidence: 0.9 },
          death: { year: 1100, precision: 'exact' as const, confidence: 0.9 }
        }
      };

      const person2: PersonEntity = {
        id: 'person-2',
        type: 'person',
        canonicalName: 'Person 2',
        names: { tibetan: [], english: ['Person 2'], phonetic: [], wylie: [] },
        confidence: 0.95,
        verified: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: 'ai',
        attributes: {}
      };

      const text1: TextEntity = {
        id: 'text-1',
        type: 'text',
        canonicalName: 'Text 1',
        names: { tibetan: [], english: ['Text 1'], phonetic: [], wylie: [] },
        confidence: 0.95,
        verified: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: 'ai',
        attributes: { textType: 'commentary', language: 'Tibetan' }
      };

      entities.set(person1.id, person1);
      entities.set(person2.id, person2);
      entities.set(text1.id, text1);

      const relationships: Relationship[] = [
        // Valid relationship
        {
          id: 'rel-1',
          subjectId: person1.id,
          predicate: 'teacher_of',
          objectId: person2.id,
          properties: {},
          confidence: 0.9,
          verified: false,
          createdAt: new Date(),
          updatedAt: new Date(),
          createdBy: 'ai'
        },
        // Invalid: wrong type (person → text for teacher_of)
        {
          id: 'rel-2',
          subjectId: person1.id,
          predicate: 'teacher_of',
          objectId: text1.id,
          properties: {},
          confidence: 0.9,
          verified: false,
          createdAt: new Date(),
          updatedAt: new Date(),
          createdBy: 'ai'
        },
        // Invalid: action after death
        {
          id: 'rel-3',
          subjectId: person1.id,
          predicate: 'wrote',
          objectId: text1.id,
          properties: {
            date: { year: 1150, precision: 'exact' as const, confidence: 0.9 } // 50 years after death
          },
          confidence: 0.9,
          verified: false,
          createdAt: new Date(),
          updatedAt: new Date(),
          createdBy: 'ai'
        }
      ];

      const report = validator.validateAllRelationships(relationships, entities);

      expect(report.totalRelationships).toBe(3);
      expect(report.invalidRelationships).toBeGreaterThan(0);
      expect(report.totalIssues).toBeGreaterThan(0);
      expect(report.issuesByCategory).toBeDefined();
      expect(report.issueBySeverity).toBeDefined();
      expect(report.recommendations).toBeDefined();
      expect(report.recommendations.length).toBeGreaterThan(0);
    });
  });

  // ============================================================================
  // Confidence Adjustment Tests
  // ============================================================================

  describe('Confidence Adjustment', () => {
    it('should reduce confidence for temporal warnings', () => {
      const teacher: PersonEntity = {
        id: 'teacher-1',
        type: 'person',
        canonicalName: 'Teacher',
        names: { tibetan: [], english: ['Teacher'], phonetic: [], wylie: [] },
        confidence: 0.95,
        verified: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: 'ai',
        attributes: {},
        dates: {
          birth: { year: 1050, precision: 'exact' as const, confidence: 0.9 }
        }
      };

      const student: PersonEntity = {
        id: 'student-1',
        type: 'person',
        canonicalName: 'Student',
        names: { tibetan: [], english: ['Student'], phonetic: [], wylie: [] },
        confidence: 0.95,
        verified: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: 'ai',
        attributes: {},
        dates: {
          birth: { year: 1045, precision: 'exact' as const, confidence: 0.9 } // Only 5 years older
        }
      };

      entities.set(teacher.id, teacher);
      entities.set(student.id, student);

      const relationship: Relationship = {
        id: 'rel-1',
        subjectId: teacher.id,
        predicate: 'teacher_of',
        objectId: student.id,
        properties: {},
        confidence: 0.9,
        verified: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: 'ai'
      };

      const result = validator.validateRelationship(relationship, entities);

      expect(result.confidence).toBeLessThan(0.9);
      expect(result.originalConfidence).toBe(0.9);
    });

    it('should set confidence to 0 for type errors', () => {
      const person: PersonEntity = {
        id: 'person-1',
        type: 'person',
        canonicalName: 'Person',
        names: { tibetan: [], english: ['Person'], phonetic: [], wylie: [] },
        confidence: 0.95,
        verified: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: 'ai',
        attributes: {}
      };

      const text: TextEntity = {
        id: 'text-1',
        type: 'text',
        canonicalName: 'Text',
        names: { tibetan: [], english: ['Text'], phonetic: [], wylie: [] },
        confidence: 0.95,
        verified: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: 'ai',
        attributes: { textType: 'commentary', language: 'Tibetan' }
      };

      entities.set(person.id, person);
      entities.set(text.id, text);

      const relationship: Relationship = {
        id: 'rel-1',
        subjectId: person.id,
        predicate: 'teacher_of',
        objectId: text.id, // Wrong type!
        properties: {},
        confidence: 0.9,
        verified: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: 'ai'
      };

      const result = validator.validateRelationship(relationship, entities);

      expect(result.confidence).toBe(0);
      expect(result.valid).toBe(false);
    });
  });
});
