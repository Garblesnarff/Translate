/**
 * Neo4j Constraint Definitions
 *
 * Defines all constraints for data integrity in the Tibetan Buddhist Knowledge Graph.
 *
 * Constraint Types:
 * - Uniqueness: Ensure property values are unique within a label
 * - Existence: Ensure required properties always have values
 * - Node Key: Composite uniqueness across multiple properties
 * - Relationship Property: Ensure relationship properties meet requirements
 *
 * Phase 4, Task 4.2: Graph Schema Design
 */

import type { EntityType, PredicateType } from '../types/entities';

// ============================================================================
// Constraint Definition Types
// ============================================================================

export interface Neo4jConstraint {
  name: string;
  type: 'unique' | 'exists' | 'node_key' | 'relationship_property_existence';
  labels?: string[]; // Node labels this constraint applies to
  relationshipTypes?: string[]; // Relationship types this constraint applies to
  properties: string[];
  description: string;
  cypher: string; // Cypher command to create this constraint
  dropCypher: string; // Cypher command to drop this constraint
}

// ============================================================================
// Uniqueness Constraints
// ============================================================================

/**
 * Ensure entity IDs are unique across all entities
 */
export const EntityIdConstraints: Neo4jConstraint[] = [
  {
    name: 'entity_id_unique',
    type: 'unique',
    labels: ['Entity'],
    properties: ['id'],
    description: 'Each entity must have a unique UUID',
    cypher: 'CREATE CONSTRAINT entity_id_unique IF NOT EXISTS FOR (e:Entity) REQUIRE e.id IS UNIQUE',
    dropCypher: 'DROP CONSTRAINT entity_id_unique IF EXISTS'
  },
  {
    name: 'person_id_unique',
    type: 'unique',
    labels: ['Person'],
    properties: ['id'],
    description: 'Each person must have a unique UUID',
    cypher: 'CREATE CONSTRAINT person_id_unique IF NOT EXISTS FOR (p:Person) REQUIRE p.id IS UNIQUE',
    dropCypher: 'DROP CONSTRAINT person_id_unique IF EXISTS'
  },
  {
    name: 'place_id_unique',
    type: 'unique',
    labels: ['Place'],
    properties: ['id'],
    description: 'Each place must have a unique UUID',
    cypher: 'CREATE CONSTRAINT place_id_unique IF NOT EXISTS FOR (p:Place) REQUIRE p.id IS UNIQUE',
    dropCypher: 'DROP CONSTRAINT place_id_unique IF EXISTS'
  },
  {
    name: 'text_id_unique',
    type: 'unique',
    labels: ['Text'],
    properties: ['id'],
    description: 'Each text must have a unique UUID',
    cypher: 'CREATE CONSTRAINT text_id_unique IF NOT EXISTS FOR (t:Text) REQUIRE t.id IS UNIQUE',
    dropCypher: 'DROP CONSTRAINT text_id_unique IF EXISTS'
  },
  {
    name: 'event_id_unique',
    type: 'unique',
    labels: ['Event'],
    properties: ['id'],
    description: 'Each event must have a unique UUID',
    cypher: 'CREATE CONSTRAINT event_id_unique IF NOT EXISTS FOR (e:Event) REQUIRE e.id IS UNIQUE',
    dropCypher: 'DROP CONSTRAINT event_id_unique IF EXISTS'
  },
  {
    name: 'concept_id_unique',
    type: 'unique',
    labels: ['Concept'],
    properties: ['id'],
    description: 'Each concept must have a unique UUID',
    cypher: 'CREATE CONSTRAINT concept_id_unique IF NOT EXISTS FOR (c:Concept) REQUIRE c.id IS UNIQUE',
    dropCypher: 'DROP CONSTRAINT concept_id_unique IF EXISTS'
  },
  {
    name: 'institution_id_unique',
    type: 'unique',
    labels: ['Institution'],
    properties: ['id'],
    description: 'Each institution must have a unique UUID',
    cypher: 'CREATE CONSTRAINT institution_id_unique IF NOT EXISTS FOR (i:Institution) REQUIRE i.id IS UNIQUE',
    dropCypher: 'DROP CONSTRAINT institution_id_unique IF EXISTS'
  },
  {
    name: 'deity_id_unique',
    type: 'unique',
    labels: ['Deity'],
    properties: ['id'],
    description: 'Each deity must have a unique UUID',
    cypher: 'CREATE CONSTRAINT deity_id_unique IF NOT EXISTS FOR (d:Deity) REQUIRE d.id IS UNIQUE',
    dropCypher: 'DROP CONSTRAINT deity_id_unique IF EXISTS'
  },
  {
    name: 'lineage_id_unique',
    type: 'unique',
    labels: ['Lineage'],
    properties: ['id'],
    description: 'Each lineage must have a unique UUID',
    cypher: 'CREATE CONSTRAINT lineage_id_unique IF NOT EXISTS FOR (l:Lineage) REQUIRE l.id IS UNIQUE',
    dropCypher: 'DROP CONSTRAINT lineage_id_unique IF EXISTS'
  },
  {
    name: 'artifact_id_unique',
    type: 'unique',
    labels: ['Artifact'],
    properties: ['id'],
    description: 'Each artifact must have a unique UUID',
    cypher: 'CREATE CONSTRAINT artifact_id_unique IF NOT EXISTS FOR (a:Artifact) REQUIRE a.id IS UNIQUE',
    dropCypher: 'DROP CONSTRAINT artifact_id_unique IF EXISTS'
  }
];

// ============================================================================
// Existence Constraints (Required Properties)
// ============================================================================

/**
 * Ensure all entities have required base properties
 */
export const EntityExistenceConstraints: Neo4jConstraint[] = [
  {
    name: 'entity_canonical_name_exists',
    type: 'exists',
    labels: ['Entity'],
    properties: ['canonical_name'],
    description: 'Every entity must have a canonical name',
    cypher: 'CREATE CONSTRAINT entity_canonical_name_exists IF NOT EXISTS FOR (e:Entity) REQUIRE e.canonical_name IS NOT NULL',
    dropCypher: 'DROP CONSTRAINT entity_canonical_name_exists IF EXISTS'
  },
  {
    name: 'entity_type_exists',
    type: 'exists',
    labels: ['Entity'],
    properties: ['entity_type'],
    description: 'Every entity must have a type',
    cypher: 'CREATE CONSTRAINT entity_type_exists IF NOT EXISTS FOR (e:Entity) REQUIRE e.entity_type IS NOT NULL',
    dropCypher: 'DROP CONSTRAINT entity_type_exists IF EXISTS'
  },
  {
    name: 'entity_confidence_exists',
    type: 'exists',
    labels: ['Entity'],
    properties: ['confidence'],
    description: 'Every entity must have a confidence score',
    cypher: 'CREATE CONSTRAINT entity_confidence_exists IF NOT EXISTS FOR (e:Entity) REQUIRE e.confidence IS NOT NULL',
    dropCypher: 'DROP CONSTRAINT entity_confidence_exists IF EXISTS'
  },
  {
    name: 'entity_verified_exists',
    type: 'exists',
    labels: ['Entity'],
    properties: ['verified'],
    description: 'Every entity must have a verification status',
    cypher: 'CREATE CONSTRAINT entity_verified_exists IF NOT EXISTS FOR (e:Entity) REQUIRE e.verified IS NOT NULL',
    dropCypher: 'DROP CONSTRAINT entity_verified_exists IF EXISTS'
  },
  {
    name: 'entity_extraction_method_exists',
    type: 'exists',
    labels: ['Entity'],
    properties: ['extraction_method'],
    description: 'Every entity must record how it was extracted',
    cypher: 'CREATE CONSTRAINT entity_extraction_method_exists IF NOT EXISTS FOR (e:Entity) REQUIRE e.extraction_method IS NOT NULL',
    dropCypher: 'DROP CONSTRAINT entity_extraction_method_exists IF EXISTS'
  },
  {
    name: 'entity_created_at_exists',
    type: 'exists',
    labels: ['Entity'],
    properties: ['created_at'],
    description: 'Every entity must have a creation timestamp',
    cypher: 'CREATE CONSTRAINT entity_created_at_exists IF NOT EXISTS FOR (e:Entity) REQUIRE e.created_at IS NOT NULL',
    dropCypher: 'DROP CONSTRAINT entity_created_at_exists IF EXISTS'
  },
  {
    name: 'entity_created_by_exists',
    type: 'exists',
    labels: ['Entity'],
    properties: ['created_by'],
    description: 'Every entity must record who created it',
    cypher: 'CREATE CONSTRAINT entity_created_by_exists IF NOT EXISTS FOR (e:Entity) REQUIRE e.created_by IS NOT NULL',
    dropCypher: 'DROP CONSTRAINT entity_created_by_exists IF EXISTS'
  }
];

/**
 * Type-specific required properties
 */
export const TypeSpecificExistenceConstraints: Neo4jConstraint[] = [
  {
    name: 'place_type_exists',
    type: 'exists',
    labels: ['Place'],
    properties: ['place_type'],
    description: 'Every place must have a place_type',
    cypher: 'CREATE CONSTRAINT place_type_exists IF NOT EXISTS FOR (p:Place) REQUIRE p.place_type IS NOT NULL',
    dropCypher: 'DROP CONSTRAINT place_type_exists IF EXISTS'
  },
  {
    name: 'text_type_exists',
    type: 'exists',
    labels: ['Text'],
    properties: ['text_type'],
    description: 'Every text must have a text_type',
    cypher: 'CREATE CONSTRAINT text_type_exists IF NOT EXISTS FOR (t:Text) REQUIRE t.text_type IS NOT NULL',
    dropCypher: 'DROP CONSTRAINT text_type_exists IF EXISTS'
  },
  {
    name: 'event_type_exists',
    type: 'exists',
    labels: ['Event'],
    properties: ['event_type'],
    description: 'Every event must have an event_type',
    cypher: 'CREATE CONSTRAINT event_type_exists IF NOT EXISTS FOR (e:Event) REQUIRE e.event_type IS NOT NULL',
    dropCypher: 'DROP CONSTRAINT event_type_exists IF EXISTS'
  },
  {
    name: 'concept_type_exists',
    type: 'exists',
    labels: ['Concept'],
    properties: ['concept_type'],
    description: 'Every concept must have a concept_type',
    cypher: 'CREATE CONSTRAINT concept_type_exists IF NOT EXISTS FOR (c:Concept) REQUIRE c.concept_type IS NOT NULL',
    dropCypher: 'DROP CONSTRAINT concept_type_exists IF EXISTS'
  },
  {
    name: 'institution_type_exists',
    type: 'exists',
    labels: ['Institution'],
    properties: ['institution_type'],
    description: 'Every institution must have an institution_type',
    cypher: 'CREATE CONSTRAINT institution_type_exists IF NOT EXISTS FOR (i:Institution) REQUIRE i.institution_type IS NOT NULL',
    dropCypher: 'DROP CONSTRAINT institution_type_exists IF EXISTS'
  },
  {
    name: 'deity_type_exists',
    type: 'exists',
    labels: ['Deity'],
    properties: ['deity_type'],
    description: 'Every deity must have a deity_type',
    cypher: 'CREATE CONSTRAINT deity_type_exists IF NOT EXISTS FOR (d:Deity) REQUIRE d.deity_type IS NOT NULL',
    dropCypher: 'DROP CONSTRAINT deity_type_exists IF EXISTS'
  },
  {
    name: 'lineage_type_exists',
    type: 'exists',
    labels: ['Lineage'],
    properties: ['lineage_type'],
    description: 'Every lineage must have a lineage_type',
    cypher: 'CREATE CONSTRAINT lineage_type_exists IF NOT EXISTS FOR (l:Lineage) REQUIRE l.lineage_type IS NOT NULL',
    dropCypher: 'DROP CONSTRAINT lineage_type_exists IF EXISTS'
  },
  {
    name: 'artifact_type_exists',
    type: 'exists',
    labels: ['Artifact'],
    properties: ['artifact_type'],
    description: 'Every artifact must have an artifact_type',
    cypher: 'CREATE CONSTRAINT artifact_type_exists IF NOT EXISTS FOR (a:Artifact) REQUIRE a.artifact_type IS NOT NULL',
    dropCypher: 'DROP CONSTRAINT artifact_type_exists IF EXISTS'
  }
];

// ============================================================================
// Node Key Constraints (Composite Uniqueness)
// ============================================================================

/**
 * Prevent duplicate entities based on name + type combinations
 * Note: These are commented out by default as they may be too strict
 * Uncomment if you want to enforce strict deduplication
 */
export const NodeKeyConstraints: Neo4jConstraint[] = [
  // Example: Prevent duplicate people with same canonical name
  // {
  //   name: 'person_canonical_name_key',
  //   type: 'node_key',
  //   labels: ['Person'],
  //   properties: ['canonical_name'],
  //   description: 'Prevent duplicate persons with the same canonical name',
  //   cypher: 'CREATE CONSTRAINT person_canonical_name_key IF NOT EXISTS FOR (p:Person) REQUIRE p.canonical_name IS NODE KEY',
  //   dropCypher: 'DROP CONSTRAINT person_canonical_name_key IF EXISTS'
  // },

  // Example: Places with same name in same region should be unique
  // {
  //   name: 'place_name_region_key',
  //   type: 'node_key',
  //   labels: ['Place'],
  //   properties: ['canonical_name', 'region'],
  //   description: 'Prevent duplicate places with same name in same region',
  //   cypher: 'CREATE CONSTRAINT place_name_region_key IF NOT EXISTS FOR (p:Place) REQUIRE (p.canonical_name, p.region) IS NODE KEY',
  //   dropCypher: 'DROP CONSTRAINT place_name_region_key IF EXISTS'
  // }
];

// ============================================================================
// Relationship Constraints
// ============================================================================

/**
 * Ensure relationship IDs are unique
 */
export const RelationshipIdConstraints: Neo4jConstraint[] = [
  {
    name: 'teacher_of_id_unique',
    type: 'unique',
    relationshipTypes: ['TEACHER_OF'],
    properties: ['id'],
    description: 'Each teacher_of relationship must have a unique ID',
    cypher: 'CREATE CONSTRAINT teacher_of_id_unique IF NOT EXISTS FOR ()-[r:TEACHER_OF]-() REQUIRE r.id IS UNIQUE',
    dropCypher: 'DROP CONSTRAINT teacher_of_id_unique IF EXISTS'
  },
  {
    name: 'student_of_id_unique',
    type: 'unique',
    relationshipTypes: ['STUDENT_OF'],
    properties: ['id'],
    description: 'Each student_of relationship must have a unique ID',
    cypher: 'CREATE CONSTRAINT student_of_id_unique IF NOT EXISTS FOR ()-[r:STUDENT_OF]-() REQUIRE r.id IS UNIQUE',
    dropCypher: 'DROP CONSTRAINT student_of_id_unique IF EXISTS'
  },
  {
    name: 'wrote_id_unique',
    type: 'unique',
    relationshipTypes: ['WROTE'],
    properties: ['id'],
    description: 'Each wrote relationship must have a unique ID',
    cypher: 'CREATE CONSTRAINT wrote_id_unique IF NOT EXISTS FOR ()-[r:WROTE]-() REQUIRE r.id IS UNIQUE',
    dropCypher: 'DROP CONSTRAINT wrote_id_unique IF EXISTS'
  },
  {
    name: 'lived_at_id_unique',
    type: 'unique',
    relationshipTypes: ['LIVED_AT'],
    properties: ['id'],
    description: 'Each lived_at relationship must have a unique ID',
    cypher: 'CREATE CONSTRAINT lived_at_id_unique IF NOT EXISTS FOR ()-[r:LIVED_AT]-() REQUIRE r.id IS UNIQUE',
    dropCypher: 'DROP CONSTRAINT lived_at_id_unique IF EXISTS'
  },
  {
    name: 'incarnation_of_id_unique',
    type: 'unique',
    relationshipTypes: ['INCARNATION_OF'],
    properties: ['id'],
    description: 'Each incarnation_of relationship must have a unique ID',
    cypher: 'CREATE CONSTRAINT incarnation_of_id_unique IF NOT EXISTS FOR ()-[r:INCARNATION_OF]-() REQUIRE r.id IS UNIQUE',
    dropCypher: 'DROP CONSTRAINT incarnation_of_id_unique IF EXISTS'
  }
  // Add more relationship ID constraints for other relationship types as needed
];

/**
 * Required properties on relationships
 */
export const RelationshipPropertyConstraints: Neo4jConstraint[] = [
  {
    name: 'teacher_of_confidence_exists',
    type: 'relationship_property_existence',
    relationshipTypes: ['TEACHER_OF'],
    properties: ['confidence'],
    description: 'All teacher_of relationships must have a confidence score',
    cypher: 'CREATE CONSTRAINT teacher_of_confidence_exists IF NOT EXISTS FOR ()-[r:TEACHER_OF]-() REQUIRE r.confidence IS NOT NULL',
    dropCypher: 'DROP CONSTRAINT teacher_of_confidence_exists IF EXISTS'
  },
  {
    name: 'teacher_of_created_at_exists',
    type: 'relationship_property_existence',
    relationshipTypes: ['TEACHER_OF'],
    properties: ['created_at'],
    description: 'All teacher_of relationships must have a creation timestamp',
    cypher: 'CREATE CONSTRAINT teacher_of_created_at_exists IF NOT EXISTS FOR ()-[r:TEACHER_OF]-() REQUIRE r.created_at IS NOT NULL',
    dropCypher: 'DROP CONSTRAINT teacher_of_created_at_exists IF EXISTS'
  }
  // Add more relationship property constraints as needed
];

// ============================================================================
// Data Validation Constraints (Enforce Business Rules)
// ============================================================================

/**
 * These constraints enforce data quality rules
 * Note: Neo4j doesn't support all validation types natively, so some
 * must be enforced at the application level
 */
export const ValidationRules = {
  confidence_range: {
    description: 'Confidence scores must be between 0.0 and 1.0',
    enforcement: 'application',
    validation: (confidence: number) => confidence >= 0.0 && confidence <= 1.0
  },

  date_consistency: {
    description: 'Death year must be after birth year',
    enforcement: 'application',
    validation: (birthYear: number | null, deathYear: number | null) => {
      if (birthYear === null || deathYear === null) return true;
      return deathYear > birthYear;
    }
  },

  coordinate_validity: {
    description: 'Latitude must be -90 to 90, longitude -180 to 180',
    enforcement: 'application',
    validation: (lat: number | null, lon: number | null) => {
      if (lat === null || lon === null) return true;
      return lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180;
    }
  },

  entity_type_enum: {
    description: 'Entity type must be one of the defined types',
    enforcement: 'application',
    allowedValues: ['person', 'place', 'text', 'event', 'concept', 'institution', 'deity', 'lineage', 'artifact'],
    validation: (type: string) => {
      const allowed: EntityType[] = ['person', 'place', 'text', 'event', 'concept', 'institution', 'deity', 'lineage', 'artifact'];
      return allowed.includes(type as EntityType);
    }
  }
};

// ============================================================================
// Constraint Registry
// ============================================================================

export const AllConstraints: Neo4jConstraint[] = [
  ...EntityIdConstraints,
  ...EntityExistenceConstraints,
  ...TypeSpecificExistenceConstraints,
  ...NodeKeyConstraints,
  ...RelationshipIdConstraints,
  ...RelationshipPropertyConstraints
];

/**
 * Get all constraints for a specific label
 */
export function getConstraintsForLabel(label: string): Neo4jConstraint[] {
  return AllConstraints.filter(c => c.labels?.includes(label));
}

/**
 * Get all uniqueness constraints
 */
export function getUniquenessConstraints(): Neo4jConstraint[] {
  return AllConstraints.filter(c => c.type === 'unique');
}

/**
 * Get all existence constraints
 */
export function getExistenceConstraints(): Neo4jConstraint[] {
  return AllConstraints.filter(c => c.type === 'exists');
}

/**
 * Generate Cypher script to create all constraints
 */
export function generateConstraintCreationScript(): string {
  const lines = [
    '// ============================================================================',
    '// Neo4j Constraint Creation Script',
    '// Generated from schema/neo4jConstraints.ts',
    '// ============================================================================',
    '',
    '// IMPORTANT: Constraints should be created before loading data',
    '// Creating constraints on existing data may fail if data violates constraints',
    '',
    '// Create all constraints for data integrity',
    ''
  ];

  const constraintGroups = [
    { name: 'Entity ID Uniqueness Constraints', constraints: EntityIdConstraints },
    { name: 'Entity Existence Constraints', constraints: EntityExistenceConstraints },
    { name: 'Type-Specific Existence Constraints', constraints: TypeSpecificExistenceConstraints },
    { name: 'Relationship ID Uniqueness Constraints', constraints: RelationshipIdConstraints },
    { name: 'Relationship Property Constraints', constraints: RelationshipPropertyConstraints }
  ];

  for (const group of constraintGroups) {
    lines.push(`// ${group.name}`);
    lines.push('// ' + '='.repeat(78));
    lines.push('');

    for (const constraint of group.constraints) {
      lines.push(`// ${constraint.description}`);
      lines.push(constraint.cypher + ';');
      lines.push('');
    }
  }

  return lines.join('\n');
}

/**
 * Generate Cypher script to drop all constraints
 */
export function generateConstraintDeletionScript(): string {
  const lines = [
    '// ============================================================================',
    '// Neo4j Constraint Deletion Script',
    '// WARNING: This will remove all constraints',
    '// ============================================================================',
    ''
  ];

  for (const constraint of AllConstraints) {
    lines.push(`// Drop ${constraint.name}`);
    lines.push(constraint.dropCypher + ';');
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Validate a node against all applicable constraints
 */
export function validateNodeConstraints(
  label: string,
  properties: Record<string, any>
): { valid: boolean; violations: string[] } {
  const violations: string[] = [];
  const constraints = getConstraintsForLabel(label);

  for (const constraint of constraints) {
    if (constraint.type === 'exists') {
      for (const prop of constraint.properties) {
        if (properties[prop] === null || properties[prop] === undefined) {
          violations.push(`Missing required property: ${prop}`);
        }
      }
    }
  }

  // Validate confidence range
  if (properties.confidence !== undefined) {
    if (!ValidationRules.confidence_range.validation(properties.confidence)) {
      violations.push('Confidence must be between 0.0 and 1.0');
    }
  }

  // Validate date consistency for Person
  if (label === 'Person') {
    if (properties.birth_year !== undefined && properties.death_year !== undefined) {
      if (!ValidationRules.date_consistency.validation(properties.birth_year, properties.death_year)) {
        violations.push('Death year must be after birth year');
      }
    }
  }

  // Validate coordinates for Place
  if (label === 'Place') {
    if (properties.latitude !== undefined || properties.longitude !== undefined) {
      if (!ValidationRules.coordinate_validity.validation(properties.latitude, properties.longitude)) {
        violations.push('Invalid coordinates (lat: -90 to 90, lon: -180 to 180)');
      }
    }
  }

  // Validate entity type
  if (properties.entity_type !== undefined) {
    if (!ValidationRules.entity_type_enum.validation(properties.entity_type)) {
      violations.push(`Invalid entity type: ${properties.entity_type}`);
    }
  }

  return {
    valid: violations.length === 0,
    violations
  };
}

/**
 * Check if a constraint exists in Neo4j
 * (This is a helper for the sync service to query constraint status)
 */
export const ConstraintQueries = {
  listAllConstraints: 'SHOW CONSTRAINTS',
  listConstraintsForLabel: (label: string) => `SHOW CONSTRAINTS WHERE entityType = "${label}"`,
  checkConstraintExists: (name: string) => `SHOW CONSTRAINTS WHERE name = "${name}"`
};
