/**
 * Neo4j Schema Integration Tests
 *
 * Tests that the Neo4j schema is correctly created and all constraints,
 * indexes, and node/relationship types are properly configured.
 *
 * Prerequisites:
 * - Neo4j database running (local or Docker)
 * - Schema created via scripts/create-neo4j-schema.cypher
 *
 * Phase 4, Task 4.2: Graph Schema Design
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import neo4j, { Driver, Session } from 'neo4j-driver';
import {
  NodeSchemas,
  getNodeSchema,
  getRequiredProperties,
  validateProperty
} from '../../server/schema/neo4jSchema';
import {
  RelationshipSchemas,
  validateRelationshipTypes
} from '../../server/schema/neo4jRelationships';
import { AllIndexes } from '../../server/schema/neo4jIndexes';
import {
  AllConstraints,
  validateNodeConstraints
} from '../../server/schema/neo4jConstraints';

// Test configuration
const NEO4J_URI = process.env.NEO4J_URI || 'bolt://localhost:7687';
const NEO4J_USER = process.env.NEO4J_USER || 'neo4j';
const NEO4J_PASSWORD = process.env.NEO4J_PASSWORD || 'password';

let driver: Driver;
let session: Session;

// ============================================================================
// Setup and Teardown
// ============================================================================

beforeAll(async () => {
  // Connect to Neo4j
  driver = neo4j.driver(
    NEO4J_URI,
    neo4j.auth.basic(NEO4J_USER, NEO4J_PASSWORD)
  );

  // Verify connection
  await driver.verifyConnectivity();
  session = driver.session();

  console.log('Connected to Neo4j database');
});

afterAll(async () => {
  // Close session and driver
  if (session) {
    await session.close();
  }
  if (driver) {
    await driver.close();
  }

  console.log('Closed Neo4j connection');
});

// ============================================================================
// Helper Functions
// ============================================================================

async function runCypher(query: string, params: any = {}) {
  const result = await session.run(query, params);
  return result.records;
}

async function getConstraintNames(): Promise<string[]> {
  const records = await runCypher('SHOW CONSTRAINTS');
  return records.map(r => r.get('name'));
}

async function getIndexNames(): Promise<string[]> {
  const records = await runCypher('SHOW INDEXES');
  return records.map(r => r.get('name'));
}

async function createTestNode(label: string, properties: any) {
  const query = `
    CREATE (n:${label} $props)
    RETURN n
  `;
  const result = await runCypher(query, { props: properties });
  return result[0].get('n');
}

async function deleteTestNodes() {
  await runCypher('MATCH (n) WHERE n.test_data = true DELETE n');
}

// ============================================================================
// Schema Structure Tests
// ============================================================================

describe('Neo4j Schema Structure', () => {
  it('should have all entity type schemas defined', () => {
    const expectedTypes = ['Entity', 'Person', 'Place', 'Text', 'Event', 'Concept', 'Institution', 'Deity', 'Lineage'];

    for (const type of expectedTypes) {
      expect(NodeSchemas[type]).toBeDefined();
      expect(NodeSchemas[type].label).toBe(type);
      expect(NodeSchemas[type].properties).toBeDefined();
    }
  });

  it('should have all relationship type schemas defined', () => {
    const expectedPredicates = [
      'teacher_of', 'student_of', 'incarnation_of',
      'wrote', 'translated', 'compiled',
      'lived_at', 'visited', 'founded', 'born_in', 'died_in',
      'attended', 'organized', 'sponsored',
      'member_of', 'abbot_of', 'patron_of',
      'commentary_on', 'cites', 'part_of', 'contains', 'mentions',
      'received_transmission', 'gave_empowerment', 'transmitted_to',
      'debated_with', 'refuted', 'agreed_with',
      'parent_of', 'child_of', 'sibling_of', 'spouse_of',
      'within', 'near',
      'practiced', 'held_view', 'taught_concept',
      'preceded', 'followed', 'contemporary_with'
    ];

    for (const predicate of expectedPredicates) {
      expect(RelationshipSchemas[predicate as any]).toBeDefined();
    }

    expect(Object.keys(RelationshipSchemas).length).toBe(expectedPredicates.length);
  });

  it('should define base Entity properties', () => {
    const entitySchema = NodeSchemas.Entity;
    const requiredProps = ['id', 'entity_type', 'canonical_name', 'confidence', 'verified', 'extraction_method', 'created_at', 'created_by'];

    for (const prop of requiredProps) {
      expect(entitySchema.properties[prop]).toBeDefined();
      expect(entitySchema.properties[prop].required).toBe(true);
    }
  });

  it('should define Person-specific properties', () => {
    const personSchema = NodeSchemas.Person;
    const expectedProps = ['birth_year', 'death_year', 'tradition', 'roles', 'titles', 'gender'];

    for (const prop of expectedProps) {
      expect(personSchema.properties[prop]).toBeDefined();
    }
  });
});

// ============================================================================
// Constraint Tests
// ============================================================================

describe('Neo4j Constraints', () => {
  it('should have entity ID uniqueness constraint', async () => {
    const constraints = await getConstraintNames();
    expect(constraints).toContain('entity_id_unique');
  });

  it('should have type-specific ID constraints', async () => {
    const constraints = await getConstraintNames();
    const expectedConstraints = [
      'person_id_unique',
      'place_id_unique',
      'text_id_unique',
      'event_id_unique',
      'concept_id_unique',
      'institution_id_unique',
      'deity_id_unique',
      'lineage_id_unique'
    ];

    for (const constraint of expectedConstraints) {
      expect(constraints).toContain(constraint);
    }
  });

  it('should have existence constraints for required properties', async () => {
    const constraints = await getConstraintNames();
    const expectedConstraints = [
      'entity_canonical_name_exists',
      'entity_type_exists',
      'entity_confidence_exists',
      'entity_verified_exists',
      'entity_extraction_method_exists',
      'entity_created_at_exists',
      'entity_created_by_exists'
    ];

    for (const constraint of expectedConstraints) {
      expect(constraints).toContain(constraint);
    }
  });

  it('should enforce uniqueness constraints (duplicate ID should fail)', async () => {
    const testId = 'test-duplicate-id-' + Date.now();

    // Create first node
    await createTestNode('Entity', {
      id: testId,
      entity_type: 'person',
      canonical_name: 'Test Person',
      confidence: 0.8,
      verified: false,
      extraction_method: 'manual',
      created_at: new Date(),
      created_by: 'test',
      test_data: true
    });

    // Try to create duplicate - should fail
    try {
      await createTestNode('Entity', {
        id: testId, // Same ID
        entity_type: 'place',
        canonical_name: 'Test Place',
        confidence: 0.8,
        verified: false,
        extraction_method: 'manual',
        created_at: new Date(),
        created_by: 'test',
        test_data: true
      });
      fail('Should have thrown constraint violation error');
    } catch (error: any) {
      expect(error.message).toContain('ConstraintValidationFailed');
    }

    // Cleanup
    await deleteTestNodes();
  });

  it('should enforce existence constraints (missing required property should fail)', async () => {
    try {
      await createTestNode('Entity', {
        id: 'test-missing-prop-' + Date.now(),
        entity_type: 'person',
        // Missing canonical_name (required)
        confidence: 0.8,
        verified: false,
        extraction_method: 'manual',
        created_at: new Date(),
        created_by: 'test',
        test_data: true
      });
      fail('Should have thrown constraint violation error');
    } catch (error: any) {
      expect(error.message).toContain('ConstraintValidationFailed');
    }
  });
});

// ============================================================================
// Index Tests
// ============================================================================

describe('Neo4j Indexes', () => {
  it('should have all expected indexes created', async () => {
    const indexes = await getIndexNames();

    // Sample of important indexes (not exhaustive due to large number)
    const expectedIndexes = [
      'entity_canonical_name_index',
      'entity_tibetan_name_index',
      'person_birth_year_index',
      'person_death_year_index',
      'place_type_index',
      'text_type_index',
      'entity_type_confidence_composite'
    ];

    for (const index of expectedIndexes) {
      expect(indexes).toContain(index);
    }
  });

  it('should have full-text indexes', async () => {
    const indexes = await getIndexNames();
    const fulltextIndexes = [
      'entity_names_fulltext',
      'person_biography_fulltext',
      'text_content_fulltext',
      'place_description_fulltext',
      'concept_definition_fulltext'
    ];

    for (const index of fulltextIndexes) {
      expect(indexes).toContain(index);
    }
  });

  it('should have composite indexes for common query patterns', async () => {
    const indexes = await getIndexNames();
    const compositeIndexes = [
      'person_dates_composite',
      'place_coordinates_composite',
      'text_type_language_composite',
      'person_tradition_dates_composite'
    ];

    for (const index of compositeIndexes) {
      expect(indexes).toContain(index);
    }
  });
});

// ============================================================================
// Node Creation Tests
// ============================================================================

describe('Node Creation and Validation', () => {
  afterEach(async () => {
    await deleteTestNodes();
  });

  it('should create a valid Person node', async () => {
    const person = await createTestNode('Entity:Person', {
      id: 'test-person-' + Date.now(),
      entity_type: 'person',
      canonical_name: 'Test Lama',
      tibetan_name: 'བླ་མ',
      wylie_name: 'bla ma',
      birth_year: 1350,
      death_year: 1425,
      tradition: ['Sakya'],
      roles: ['teacher', 'scholar'],
      confidence: 0.9,
      verified: false,
      extraction_method: 'manual',
      created_at: new Date(),
      created_by: 'test',
      test_data: true
    });

    expect(person.properties.canonical_name).toBe('Test Lama');
    expect(person.properties.birth_year.toNumber()).toBe(1350);
  });

  it('should create a valid Place node', async () => {
    const place = await createTestNode('Entity:Place', {
      id: 'test-place-' + Date.now(),
      entity_type: 'place',
      canonical_name: 'Test Monastery',
      place_type: 'monastery',
      region: 'Ü',
      latitude: 29.65,
      longitude: 91.1,
      founded_year: 1100,
      confidence: 0.85,
      verified: false,
      extraction_method: 'manual',
      created_at: new Date(),
      created_by: 'test',
      test_data: true
    });

    expect(place.properties.place_type).toBe('monastery');
    expect(place.properties.latitude).toBeCloseTo(29.65, 2);
  });

  it('should create a valid Text node', async () => {
    const text = await createTestNode('Entity:Text', {
      id: 'test-text-' + Date.now(),
      entity_type: 'text',
      canonical_name: 'Test Commentary',
      text_type: 'commentary',
      language: 'Tibetan',
      composed_year: 1400,
      topics: ['madhyamaka', 'emptiness'],
      confidence: 0.8,
      verified: false,
      extraction_method: 'manual',
      created_at: new Date(),
      created_by: 'test',
      test_data: true
    });

    expect(text.properties.text_type).toBe('commentary');
    expect(text.properties.topics).toEqual(['madhyamaka', 'emptiness']);
  });
});

// ============================================================================
// Relationship Tests
// ============================================================================

describe('Relationship Creation', () => {
  let teacherId: string;
  let studentId: string;

  beforeEach(async () => {
    // Create test nodes
    teacherId = 'test-teacher-' + Date.now();
    studentId = 'test-student-' + Date.now();

    await createTestNode('Entity:Person', {
      id: teacherId,
      entity_type: 'person',
      canonical_name: 'Test Teacher',
      confidence: 0.9,
      verified: false,
      extraction_method: 'manual',
      created_at: new Date(),
      created_by: 'test',
      test_data: true
    });

    await createTestNode('Entity:Person', {
      id: studentId,
      entity_type: 'person',
      canonical_name: 'Test Student',
      confidence: 0.9,
      verified: false,
      extraction_method: 'manual',
      created_at: new Date(),
      created_by: 'test',
      test_data: true
    });
  });

  afterEach(async () => {
    await deleteTestNodes();
  });

  it('should create a TEACHER_OF relationship', async () => {
    const query = `
      MATCH (teacher:Person {id: $teacherId})
      MATCH (student:Person {id: $studentId})
      CREATE (teacher)-[r:TEACHER_OF {
        id: $relId,
        confidence: 0.95,
        verified: false,
        extraction_method: 'manual',
        created_at: datetime(),
        created_by: 'test',
        start_year: 1370,
        teaching_type: 'instruction'
      }]->(student)
      RETURN r
    `;

    const result = await runCypher(query, {
      teacherId,
      studentId,
      relId: 'test-rel-' + Date.now()
    });

    expect(result.length).toBe(1);
    const rel = result[0].get('r');
    expect(rel.properties.confidence).toBeCloseTo(0.95, 2);
    expect(rel.properties.start_year.toNumber()).toBe(1370);
  });

  it('should enforce relationship type constraints', () => {
    // Test that teacher_of requires Person → Person
    const result = validateRelationshipTypes('teacher_of', 'person', 'person');
    expect(result.valid).toBe(true);

    // Test invalid combination (person → text)
    const invalidResult = validateRelationshipTypes('teacher_of', 'person', 'text');
    expect(invalidResult.valid).toBe(false);
    expect(invalidResult.error).toContain('Invalid object type');
  });

  it('should create bidirectional relationships', async () => {
    const teacherOfId = 'test-teacher-of-' + Date.now();
    const studentOfId = 'test-student-of-' + Date.now();

    // Create TEACHER_OF
    await runCypher(`
      MATCH (teacher:Person {id: $teacherId})
      MATCH (student:Person {id: $studentId})
      CREATE (teacher)-[:TEACHER_OF {
        id: $teacherOfId,
        confidence: 0.95,
        created_at: datetime(),
        created_by: 'test'
      }]->(student)
    `, { teacherId, studentId, teacherOfId });

    // Create STUDENT_OF (inverse)
    await runCypher(`
      MATCH (teacher:Person {id: $teacherId})
      MATCH (student:Person {id: $studentId})
      CREATE (student)-[:STUDENT_OF {
        id: $studentOfId,
        confidence: 0.95,
        created_at: datetime(),
        created_by: 'test'
      }]->(teacher)
    `, { teacherId, studentId, studentOfId });

    // Verify both relationships exist
    const teacherOfResult = await runCypher(`
      MATCH (teacher:Person {id: $teacherId})-[r:TEACHER_OF]->(student:Person {id: $studentId})
      RETURN r
    `, { teacherId, studentId });

    const studentOfResult = await runCypher(`
      MATCH (student:Person {id: $studentId})-[r:STUDENT_OF]->(teacher:Person {id: $teacherId})
      RETURN r
    `, { teacherId, studentId });

    expect(teacherOfResult.length).toBe(1);
    expect(studentOfResult.length).toBe(1);
  });
});

// ============================================================================
// Property Validation Tests
// ============================================================================

describe('Property Validation', () => {
  it('should validate required properties', () => {
    const validation = validateNodeConstraints('Entity', {
      id: 'test-123',
      entity_type: 'person',
      canonical_name: 'Test',
      confidence: 0.8,
      verified: false,
      extraction_method: 'manual',
      created_at: new Date(),
      created_by: 'test'
    });

    expect(validation.valid).toBe(true);
    expect(validation.violations).toHaveLength(0);
  });

  it('should detect missing required properties', () => {
    const validation = validateNodeConstraints('Entity', {
      id: 'test-123',
      // Missing canonical_name (required)
      entity_type: 'person',
      confidence: 0.8,
      verified: false,
      extraction_method: 'manual',
      created_at: new Date(),
      created_by: 'test'
    });

    expect(validation.valid).toBe(false);
    expect(validation.violations).toContain('Missing required property: canonical_name');
  });

  it('should validate confidence score range', () => {
    const validation = validateNodeConstraints('Entity', {
      id: 'test-123',
      entity_type: 'person',
      canonical_name: 'Test',
      confidence: 1.5, // Invalid: > 1.0
      verified: false,
      extraction_method: 'manual',
      created_at: new Date(),
      created_by: 'test'
    });

    expect(validation.valid).toBe(false);
    expect(validation.violations).toContain('Confidence must be between 0.0 and 1.0');
  });

  it('should validate date consistency for Person', () => {
    const validation = validateNodeConstraints('Person', {
      id: 'test-123',
      entity_type: 'person',
      canonical_name: 'Test',
      birth_year: 1400,
      death_year: 1350, // Invalid: death before birth
      confidence: 0.8,
      verified: false,
      extraction_method: 'manual',
      created_at: new Date(),
      created_by: 'test'
    });

    expect(validation.valid).toBe(false);
    expect(validation.violations).toContain('Death year must be after birth year');
  });

  it('should validate coordinate ranges for Place', () => {
    const validation = validateNodeConstraints('Place', {
      id: 'test-123',
      entity_type: 'place',
      canonical_name: 'Test',
      place_type: 'monastery',
      latitude: 95, // Invalid: > 90
      longitude: 91.1,
      confidence: 0.8,
      verified: false,
      extraction_method: 'manual',
      created_at: new Date(),
      created_by: 'test'
    });

    expect(validation.valid).toBe(false);
    expect(validation.violations).toContain('Invalid coordinates (lat: -90 to 90, lon: -180 to 180)');
  });
});

// ============================================================================
// Query Pattern Tests
// ============================================================================

describe('Common Query Patterns', () => {
  beforeAll(async () => {
    // Create sample test data for queries
    await createTestNode('Entity:Person', {
      id: 'test-query-person-1',
      entity_type: 'person',
      canonical_name: 'Query Test Lama 1',
      birth_year: 1300,
      death_year: 1380,
      tradition: ['Sakya'],
      confidence: 0.9,
      verified: true,
      extraction_method: 'manual',
      created_at: new Date(),
      created_by: 'test',
      test_data: true
    });

    await createTestNode('Entity:Person', {
      id: 'test-query-person-2',
      entity_type: 'person',
      canonical_name: 'Query Test Lama 2',
      birth_year: 1350,
      death_year: 1425,
      tradition: ['Gelug'],
      confidence: 0.85,
      verified: false,
      extraction_method: 'llm',
      created_at: new Date(),
      created_by: 'test',
      test_data: true
    });
  });

  afterAll(async () => {
    await deleteTestNodes();
  });

  it('should query entities by type', async () => {
    const result = await runCypher(`
      MATCH (e:Entity)
      WHERE e.entity_type = 'person' AND e.test_data = true
      RETURN count(e) AS count
    `);

    expect(result[0].get('count').toNumber()).toBeGreaterThanOrEqual(2);
  });

  it('should query by confidence threshold', async () => {
    const result = await runCypher(`
      MATCH (e:Entity)
      WHERE e.confidence >= 0.9 AND e.test_data = true
      RETURN count(e) AS count
    `);

    expect(result[0].get('count').toNumber()).toBeGreaterThanOrEqual(1);
  });

  it('should query verified entities', async () => {
    const result = await runCypher(`
      MATCH (e:Entity)
      WHERE e.verified = true AND e.test_data = true
      RETURN count(e) AS count
    `);

    expect(result[0].get('count').toNumber()).toBeGreaterThanOrEqual(1);
  });

  it('should query by date range', async () => {
    const result = await runCypher(`
      MATCH (p:Person)
      WHERE p.birth_year >= 1300
        AND p.birth_year <= 1400
        AND p.test_data = true
      RETURN count(p) AS count
    `);

    expect(result[0].get('count').toNumber()).toBe(2);
  });

  it('should query by tradition', async () => {
    const result = await runCypher(`
      MATCH (p:Person)
      WHERE 'Sakya' IN p.tradition AND p.test_data = true
      RETURN count(p) AS count
    `);

    expect(result[0].get('count').toNumber()).toBeGreaterThanOrEqual(1);
  });
});

// ============================================================================
// Summary Test
// ============================================================================

describe('Schema Completeness', () => {
  it('should have complete schema definition', () => {
    console.log('\n=== Schema Summary ===');
    console.log(`Node Labels: ${Object.keys(NodeSchemas).length}`);
    console.log(`Relationship Types: ${Object.keys(RelationshipSchemas).length}`);
    console.log(`Indexes: ${AllIndexes.length}`);
    console.log(`Constraints: ${AllConstraints.length}`);
    console.log('======================\n');

    expect(Object.keys(NodeSchemas).length).toBe(9); // 8 entity types + base Entity
    expect(Object.keys(RelationshipSchemas).length).toBe(43);
    expect(AllIndexes.length).toBeGreaterThan(30);
    expect(AllConstraints.length).toBeGreaterThan(15);
  });
});
