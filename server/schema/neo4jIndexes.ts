/**
 * Neo4j Index Definitions
 *
 * Defines comprehensive indexing strategy for the Tibetan Buddhist Knowledge Graph.
 *
 * Index Types:
 * - Property indexes: Fast lookup on single properties
 * - Composite indexes: Queries filtering on multiple properties
 * - Full-text indexes: Natural language search across name fields
 * - Vector indexes: Semantic search (future implementation)
 *
 * Phase 4, Task 4.2: Graph Schema Design
 */

import type { EntityType, PredicateType } from '../types/entities';

// ============================================================================
// Index Definition Types
// ============================================================================

export interface Neo4jIndex {
  name: string;
  type: 'property' | 'fulltext' | 'composite' | 'vector';
  labels?: string[]; // Node labels this index applies to
  relationshipTypes?: PredicateType[]; // Relationship types this index applies to
  properties: string[];
  description: string;
  cypher: string; // Cypher command to create this index
  dropCypher: string; // Cypher command to drop this index
}

// ============================================================================
// Node Property Indexes
// ============================================================================

/**
 * Primary indexes for unique identification
 */
export const UniqueIdentifierIndexes: Neo4jIndex[] = [
  {
    name: 'entity_id_unique',
    type: 'property',
    labels: ['Entity'],
    properties: ['id'],
    description: 'Unique index on entity UUID for fast lookups',
    cypher: 'CREATE CONSTRAINT entity_id_unique IF NOT EXISTS FOR (e:Entity) REQUIRE e.id IS UNIQUE',
    dropCypher: 'DROP CONSTRAINT entity_id_unique IF EXISTS'
  },
  {
    name: 'person_id_index',
    type: 'property',
    labels: ['Person'],
    properties: ['id'],
    description: 'Index on Person IDs',
    cypher: 'CREATE INDEX person_id_index IF NOT EXISTS FOR (p:Person) ON (p.id)',
    dropCypher: 'DROP INDEX person_id_index IF EXISTS'
  },
  {
    name: 'place_id_index',
    type: 'property',
    labels: ['Place'],
    properties: ['id'],
    description: 'Index on Place IDs',
    cypher: 'CREATE INDEX place_id_index IF NOT EXISTS FOR (p:Place) ON (p.id)',
    dropCypher: 'DROP INDEX place_id_index IF EXISTS'
  },
  {
    name: 'text_id_index',
    type: 'property',
    labels: ['Text'],
    properties: ['id'],
    description: 'Index on Text IDs',
    cypher: 'CREATE INDEX text_id_index IF NOT EXISTS FOR (t:Text) ON (t.id)',
    dropCypher: 'DROP INDEX text_id_index IF EXISTS'
  }
];

/**
 * Name-based indexes for text search
 */
export const NameIndexes: Neo4jIndex[] = [
  {
    name: 'entity_canonical_name_index',
    type: 'property',
    labels: ['Entity'],
    properties: ['canonical_name'],
    description: 'Index on canonical names for exact match queries',
    cypher: 'CREATE INDEX entity_canonical_name_index IF NOT EXISTS FOR (e:Entity) ON (e.canonical_name)',
    dropCypher: 'DROP INDEX entity_canonical_name_index IF EXISTS'
  },
  {
    name: 'entity_tibetan_name_index',
    type: 'property',
    labels: ['Entity'],
    properties: ['tibetan_name'],
    description: 'Index on Tibetan names',
    cypher: 'CREATE INDEX entity_tibetan_name_index IF NOT EXISTS FOR (e:Entity) ON (e.tibetan_name)',
    dropCypher: 'DROP INDEX entity_tibetan_name_index IF EXISTS'
  },
  {
    name: 'entity_wylie_name_index',
    type: 'property',
    labels: ['Entity'],
    properties: ['wylie_name'],
    description: 'Index on Wylie transliterations',
    cypher: 'CREATE INDEX entity_wylie_name_index IF NOT EXISTS FOR (e:Entity) ON (e.wylie_name)',
    dropCypher: 'DROP INDEX entity_wylie_name_index IF EXISTS'
  }
];

/**
 * Full-text search indexes for natural language queries
 */
export const FullTextIndexes: Neo4jIndex[] = [
  {
    name: 'entity_names_fulltext',
    type: 'fulltext',
    labels: ['Entity'],
    properties: ['canonical_name', 'tibetan_name', 'wylie_name', 'phonetic_name', 'alternate_names'],
    description: 'Full-text search across all name variants',
    cypher: `CREATE FULLTEXT INDEX entity_names_fulltext IF NOT EXISTS
FOR (e:Entity)
ON EACH [e.canonical_name, e.tibetan_name, e.wylie_name, e.phonetic_name, e.alternate_names]`,
    dropCypher: 'DROP INDEX entity_names_fulltext IF EXISTS'
  },
  {
    name: 'person_biography_fulltext',
    type: 'fulltext',
    labels: ['Person'],
    properties: ['biography', 'canonical_name', 'titles'],
    description: 'Full-text search on person biographies and titles',
    cypher: `CREATE FULLTEXT INDEX person_biography_fulltext IF NOT EXISTS
FOR (p:Person)
ON EACH [p.biography, p.canonical_name, p.titles]`,
    dropCypher: 'DROP INDEX person_biography_fulltext IF EXISTS'
  },
  {
    name: 'text_content_fulltext',
    type: 'fulltext',
    labels: ['Text'],
    properties: ['canonical_name', 'topics', 'practices'],
    description: 'Full-text search on text names, topics, and practices',
    cypher: `CREATE FULLTEXT INDEX text_content_fulltext IF NOT EXISTS
FOR (t:Text)
ON EACH [t.canonical_name, t.topics, t.practices]`,
    dropCypher: 'DROP INDEX text_content_fulltext IF EXISTS'
  },
  {
    name: 'place_description_fulltext',
    type: 'fulltext',
    labels: ['Place'],
    properties: ['canonical_name', 'description', 'significance'],
    description: 'Full-text search on place descriptions',
    cypher: `CREATE FULLTEXT INDEX place_description_fulltext IF NOT EXISTS
FOR (p:Place)
ON EACH [p.canonical_name, p.description, p.significance]`,
    dropCypher: 'DROP INDEX place_description_fulltext IF EXISTS'
  },
  {
    name: 'concept_definition_fulltext',
    type: 'fulltext',
    labels: ['Concept'],
    properties: ['canonical_name', 'short_definition', 'sanskrit_term', 'pali_term'],
    description: 'Full-text search on concept definitions and terminology',
    cypher: `CREATE FULLTEXT INDEX concept_definition_fulltext IF NOT EXISTS
FOR (c:Concept)
ON EACH [c.canonical_name, c.short_definition, c.sanskrit_term, c.pali_term]`,
    dropCypher: 'DROP INDEX concept_definition_fulltext IF EXISTS'
  }
];

/**
 * Temporal indexes for date-based queries and timeline generation
 */
export const TemporalIndexes: Neo4jIndex[] = [
  {
    name: 'person_birth_year_index',
    type: 'property',
    labels: ['Person'],
    properties: ['birth_year'],
    description: 'Index on birth years for timeline queries',
    cypher: 'CREATE INDEX person_birth_year_index IF NOT EXISTS FOR (p:Person) ON (p.birth_year)',
    dropCypher: 'DROP INDEX person_birth_year_index IF EXISTS'
  },
  {
    name: 'person_death_year_index',
    type: 'property',
    labels: ['Person'],
    properties: ['death_year'],
    description: 'Index on death years for timeline queries',
    cypher: 'CREATE INDEX person_death_year_index IF NOT EXISTS FOR (p:Person) ON (p.death_year)',
    dropCypher: 'DROP INDEX person_death_year_index IF EXISTS'
  },
  {
    name: 'person_dates_composite',
    type: 'composite',
    labels: ['Person'],
    properties: ['birth_year', 'death_year'],
    description: 'Composite index for lifespan queries',
    cypher: 'CREATE INDEX person_dates_composite IF NOT EXISTS FOR (p:Person) ON (p.birth_year, p.death_year)',
    dropCypher: 'DROP INDEX person_dates_composite IF EXISTS'
  },
  {
    name: 'text_composed_year_index',
    type: 'property',
    labels: ['Text'],
    properties: ['composed_year'],
    description: 'Index on text composition dates',
    cypher: 'CREATE INDEX text_composed_year_index IF NOT EXISTS FOR (t:Text) ON (t.composed_year)',
    dropCypher: 'DROP INDEX text_composed_year_index IF EXISTS'
  },
  {
    name: 'event_occurred_year_index',
    type: 'property',
    labels: ['Event'],
    properties: ['occurred_year'],
    description: 'Index on event occurrence dates',
    cypher: 'CREATE INDEX event_occurred_year_index IF NOT EXISTS FOR (e:Event) ON (e.occurred_year)',
    dropCypher: 'DROP INDEX event_occurred_year_index IF EXISTS'
  },
  {
    name: 'institution_founded_year_index',
    type: 'property',
    labels: ['Institution'],
    properties: ['founded_year'],
    description: 'Index on institution founding dates',
    cypher: 'CREATE INDEX institution_founded_year_index IF NOT EXISTS FOR (i:Institution) ON (i.founded_year)',
    dropCypher: 'DROP INDEX institution_founded_year_index IF EXISTS'
  },
  {
    name: 'place_founded_year_index',
    type: 'property',
    labels: ['Place'],
    properties: ['founded_year'],
    description: 'Index on place founding dates',
    cypher: 'CREATE INDEX place_founded_year_index IF NOT EXISTS FOR (p:Place) ON (p.founded_year)',
    dropCypher: 'DROP INDEX place_founded_year_index IF EXISTS'
  }
];

/**
 * Spatial indexes for geographic queries
 */
export const SpatialIndexes: Neo4jIndex[] = [
  {
    name: 'place_coordinates_composite',
    type: 'composite',
    labels: ['Place'],
    properties: ['latitude', 'longitude'],
    description: 'Composite index for coordinate-based spatial queries',
    cypher: 'CREATE INDEX place_coordinates_composite IF NOT EXISTS FOR (p:Place) ON (p.latitude, p.longitude)',
    dropCypher: 'DROP INDEX place_coordinates_composite IF EXISTS'
  },
  {
    name: 'place_region_index',
    type: 'property',
    labels: ['Place'],
    properties: ['region'],
    description: 'Index on Tibetan regions (Ü, Tsang, Kham, Amdo)',
    cypher: 'CREATE INDEX place_region_index IF NOT EXISTS FOR (p:Place) ON (p.region)',
    dropCypher: 'DROP INDEX place_region_index IF EXISTS'
  },
  {
    name: 'place_country_index',
    type: 'property',
    labels: ['Place'],
    properties: ['modern_country'],
    description: 'Index on modern political boundaries',
    cypher: 'CREATE INDEX place_country_index IF NOT EXISTS FOR (p:Place) ON (p.modern_country)',
    dropCypher: 'DROP INDEX place_country_index IF EXISTS'
  }
];

/**
 * Type and category indexes for filtering
 */
export const TypeIndexes: Neo4jIndex[] = [
  {
    name: 'entity_type_index',
    type: 'property',
    labels: ['Entity'],
    properties: ['entity_type'],
    description: 'Index on entity type for type-based filtering',
    cypher: 'CREATE INDEX entity_type_index IF NOT EXISTS FOR (e:Entity) ON (e.entity_type)',
    dropCypher: 'DROP INDEX entity_type_index IF EXISTS'
  },
  {
    name: 'person_tradition_index',
    type: 'property',
    labels: ['Person'],
    properties: ['tradition'],
    description: 'Index on Buddhist traditions',
    cypher: 'CREATE INDEX person_tradition_index IF NOT EXISTS FOR (p:Person) ON (p.tradition)',
    dropCypher: 'DROP INDEX person_tradition_index IF EXISTS'
  },
  {
    name: 'person_roles_index',
    type: 'property',
    labels: ['Person'],
    properties: ['roles'],
    description: 'Index on person roles (teacher, translator, etc.)',
    cypher: 'CREATE INDEX person_roles_index IF NOT EXISTS FOR (p:Person) ON (p.roles)',
    dropCypher: 'DROP INDEX person_roles_index IF EXISTS'
  },
  {
    name: 'place_type_index',
    type: 'property',
    labels: ['Place'],
    properties: ['place_type'],
    description: 'Index on place types (monastery, mountain, cave, etc.)',
    cypher: 'CREATE INDEX place_type_index IF NOT EXISTS FOR (p:Place) ON (p.place_type)',
    dropCypher: 'DROP INDEX place_type_index IF EXISTS'
  },
  {
    name: 'text_type_index',
    type: 'property',
    labels: ['Text'],
    properties: ['text_type'],
    description: 'Index on text types (sutra, tantra, commentary, etc.)',
    cypher: 'CREATE INDEX text_type_index IF NOT EXISTS FOR (t:Text) ON (t.text_type)',
    dropCypher: 'DROP INDEX text_type_index IF EXISTS'
  },
  {
    name: 'text_language_index',
    type: 'property',
    labels: ['Text'],
    properties: ['language'],
    description: 'Index on text language',
    cypher: 'CREATE INDEX text_language_index IF NOT EXISTS FOR (t:Text) ON (t.language)',
    dropCypher: 'DROP INDEX text_language_index IF EXISTS'
  },
  {
    name: 'event_type_index',
    type: 'property',
    labels: ['Event'],
    properties: ['event_type'],
    description: 'Index on event types',
    cypher: 'CREATE INDEX event_type_index IF NOT EXISTS FOR (e:Event) ON (e.event_type)',
    dropCypher: 'DROP INDEX event_type_index IF EXISTS'
  },
  {
    name: 'concept_type_index',
    type: 'property',
    labels: ['Concept'],
    properties: ['concept_type'],
    description: 'Index on concept types',
    cypher: 'CREATE INDEX concept_type_index IF NOT EXISTS FOR (c:Concept) ON (c.concept_type)',
    dropCypher: 'DROP INDEX concept_type_index IF EXISTS'
  },
  {
    name: 'institution_type_index',
    type: 'property',
    labels: ['Institution'],
    properties: ['institution_type'],
    description: 'Index on institution types',
    cypher: 'CREATE INDEX institution_type_index IF NOT EXISTS FOR (i:Institution) ON (i.institution_type)',
    dropCypher: 'DROP INDEX institution_type_index IF EXISTS'
  },
  {
    name: 'deity_type_index',
    type: 'property',
    labels: ['Deity'],
    properties: ['deity_type'],
    description: 'Index on deity types',
    cypher: 'CREATE INDEX deity_type_index IF NOT EXISTS FOR (d:Deity) ON (d.deity_type)',
    dropCypher: 'DROP INDEX deity_type_index IF EXISTS'
  },
  {
    name: 'lineage_type_index',
    type: 'property',
    labels: ['Lineage'],
    properties: ['lineage_type'],
    description: 'Index on lineage types',
    cypher: 'CREATE INDEX lineage_type_index IF NOT EXISTS FOR (l:Lineage) ON (l.lineage_type)',
    dropCypher: 'DROP INDEX lineage_type_index IF EXISTS'
  }
];

/**
 * Quality and verification indexes
 */
export const QualityIndexes: Neo4jIndex[] = [
  {
    name: 'entity_confidence_index',
    type: 'property',
    labels: ['Entity'],
    properties: ['confidence'],
    description: 'Index on confidence scores for quality filtering',
    cypher: 'CREATE INDEX entity_confidence_index IF NOT EXISTS FOR (e:Entity) ON (e.confidence)',
    dropCypher: 'DROP INDEX entity_confidence_index IF EXISTS'
  },
  {
    name: 'entity_verified_index',
    type: 'property',
    labels: ['Entity'],
    properties: ['verified'],
    description: 'Index on verification status',
    cypher: 'CREATE INDEX entity_verified_index IF NOT EXISTS FOR (e:Entity) ON (e.verified)',
    dropCypher: 'DROP INDEX entity_verified_index IF EXISTS'
  },
  {
    name: 'entity_type_confidence_composite',
    type: 'composite',
    labels: ['Entity'],
    properties: ['entity_type', 'confidence'],
    description: 'Composite index for filtering by type and quality',
    cypher: 'CREATE INDEX entity_type_confidence_composite IF NOT EXISTS FOR (e:Entity) ON (e.entity_type, e.confidence)',
    dropCypher: 'DROP INDEX entity_type_confidence_composite IF EXISTS'
  },
  {
    name: 'entity_extraction_method_index',
    type: 'property',
    labels: ['Entity'],
    properties: ['extraction_method'],
    description: 'Index on extraction method for quality analysis',
    cypher: 'CREATE INDEX entity_extraction_method_index IF NOT EXISTS FOR (e:Entity) ON (e.extraction_method)',
    dropCypher: 'DROP INDEX entity_extraction_method_index IF EXISTS'
  }
];

/**
 * Source tracking indexes
 */
export const SourceIndexes: Neo4jIndex[] = [
  {
    name: 'entity_source_document_index',
    type: 'property',
    labels: ['Entity'],
    properties: ['source_document_id'],
    description: 'Index on source document for traceability',
    cypher: 'CREATE INDEX entity_source_document_index IF NOT EXISTS FOR (e:Entity) ON (e.source_document_id)',
    dropCypher: 'DROP INDEX entity_source_document_index IF EXISTS'
  },
  {
    name: 'entity_created_at_index',
    type: 'property',
    labels: ['Entity'],
    properties: ['created_at'],
    description: 'Index on creation timestamp',
    cypher: 'CREATE INDEX entity_created_at_index IF NOT EXISTS FOR (e:Entity) ON (e.created_at)',
    dropCypher: 'DROP INDEX entity_created_at_index IF EXISTS'
  }
];

/**
 * Composite indexes for common query patterns
 */
export const CompositeIndexes: Neo4jIndex[] = [
  {
    name: 'person_tradition_dates_composite',
    type: 'composite',
    labels: ['Person'],
    properties: ['tradition', 'birth_year', 'death_year'],
    description: 'Composite index for tradition-specific timeline queries',
    cypher: 'CREATE INDEX person_tradition_dates_composite IF NOT EXISTS FOR (p:Person) ON (p.tradition, p.birth_year, p.death_year)',
    dropCypher: 'DROP INDEX person_tradition_dates_composite IF EXISTS'
  },
  {
    name: 'text_type_language_composite',
    type: 'composite',
    labels: ['Text'],
    properties: ['text_type', 'language'],
    description: 'Composite index for text filtering by type and language',
    cypher: 'CREATE INDEX text_type_language_composite IF NOT EXISTS FOR (t:Text) ON (t.text_type, t.language)',
    dropCypher: 'DROP INDEX text_type_language_composite IF EXISTS'
  },
  {
    name: 'place_type_region_composite',
    type: 'composite',
    labels: ['Place'],
    properties: ['place_type', 'region'],
    description: 'Composite index for geographic queries by type and region',
    cypher: 'CREATE INDEX place_type_region_composite IF NOT EXISTS FOR (p:Place) ON (p.place_type, p.region)',
    dropCypher: 'DROP INDEX place_type_region_composite IF EXISTS'
  },
  {
    name: 'institution_type_tradition_composite',
    type: 'composite',
    labels: ['Institution'],
    properties: ['institution_type', 'tradition'],
    description: 'Composite index for institution queries by type and tradition',
    cypher: 'CREATE INDEX institution_type_tradition_composite IF NOT EXISTS FOR (i:Institution) ON (i.institution_type, i.tradition)',
    dropCypher: 'DROP INDEX institution_type_tradition_composite IF EXISTS'
  }
];

// ============================================================================
// Relationship Indexes
// ============================================================================

export const RelationshipIndexes: Neo4jIndex[] = [
  {
    name: 'relationship_id_index',
    type: 'property',
    relationshipTypes: ['teacher_of'], // Example - apply to all relationship types
    properties: ['id'],
    description: 'Index on relationship IDs',
    cypher: 'CREATE INDEX relationship_id_index IF NOT EXISTS FOR ()-[r:TEACHER_OF]-() ON (r.id)',
    dropCypher: 'DROP INDEX relationship_id_index IF EXISTS'
  },
  {
    name: 'relationship_confidence_index',
    type: 'property',
    relationshipTypes: ['teacher_of'],
    properties: ['confidence'],
    description: 'Index on relationship confidence scores',
    cypher: 'CREATE INDEX relationship_confidence_index IF NOT EXISTS FOR ()-[r:TEACHER_OF]-() ON (r.confidence)',
    dropCypher: 'DROP INDEX relationship_confidence_index IF EXISTS'
  },
  {
    name: 'relationship_source_document_index',
    type: 'property',
    relationshipTypes: ['teacher_of'],
    properties: ['source_document_id'],
    description: 'Index on relationship source documents',
    cypher: 'CREATE INDEX relationship_source_document_index IF NOT EXISTS FOR ()-[r:TEACHER_OF]-() ON (r.source_document_id)',
    dropCypher: 'DROP INDEX relationship_source_document_index IF EXISTS'
  },
  {
    name: 'relationship_created_at_index',
    type: 'property',
    relationshipTypes: ['teacher_of'],
    properties: ['created_at'],
    description: 'Index on relationship creation timestamps',
    cypher: 'CREATE INDEX relationship_created_at_index IF NOT EXISTS FOR ()-[r:TEACHER_OF]-() ON (r.created_at)',
    dropCypher: 'DROP INDEX relationship_created_at_index IF EXISTS'
  }
];

// ============================================================================
// Vector Indexes (for future semantic search)
// ============================================================================

export const VectorIndexes: Neo4jIndex[] = [
  {
    name: 'entity_embedding_vector',
    type: 'vector',
    labels: ['Entity'],
    properties: ['embedding'],
    description: 'Vector index for semantic similarity search on entity embeddings',
    cypher: `CREATE VECTOR INDEX entity_embedding_vector IF NOT EXISTS
FOR (e:Entity) ON (e.embedding)
OPTIONS {indexConfig: {
  \`vector.dimensions\`: 1536,
  \`vector.similarity_function\`: 'cosine'
}}`,
    dropCypher: 'DROP INDEX entity_embedding_vector IF EXISTS'
  },
  {
    name: 'text_content_embedding_vector',
    type: 'vector',
    labels: ['Text'],
    properties: ['content_embedding'],
    description: 'Vector index for semantic search on text content',
    cypher: `CREATE VECTOR INDEX text_content_embedding_vector IF NOT EXISTS
FOR (t:Text) ON (t.content_embedding)
OPTIONS {indexConfig: {
  \`vector.dimensions\`: 1536,
  \`vector.similarity_function\`: 'cosine'
}}`,
    dropCypher: 'DROP INDEX text_content_embedding_vector IF EXISTS'
  }
];

// ============================================================================
// Index Registry
// ============================================================================

export const AllIndexes: Neo4jIndex[] = [
  ...UniqueIdentifierIndexes,
  ...NameIndexes,
  ...FullTextIndexes,
  ...TemporalIndexes,
  ...SpatialIndexes,
  ...TypeIndexes,
  ...QualityIndexes,
  ...SourceIndexes,
  ...CompositeIndexes,
  ...RelationshipIndexes,
  // Vector indexes commented out for initial deployment
  // ...VectorIndexes
];

/**
 * Get all indexes for a specific label
 */
export function getIndexesForLabel(label: string): Neo4jIndex[] {
  return AllIndexes.filter(idx => idx.labels?.includes(label));
}

/**
 * Get all full-text indexes
 */
export function getFullTextIndexes(): Neo4jIndex[] {
  return AllIndexes.filter(idx => idx.type === 'fulltext');
}

/**
 * Get all composite indexes
 */
export function getCompositeIndexes(): Neo4jIndex[] {
  return AllIndexes.filter(idx => idx.type === 'composite');
}

/**
 * Generate Cypher script to create all indexes
 */
export function generateIndexCreationScript(): string {
  const lines = [
    '// ============================================================================',
    '// Neo4j Index Creation Script',
    '// Generated from schema/neo4jIndexes.ts',
    '// ============================================================================',
    '',
    '// Create all indexes for optimal query performance',
    ''
  ];

  const indexGroups = [
    { name: 'Unique Identifier Indexes', indexes: UniqueIdentifierIndexes },
    { name: 'Name Indexes', indexes: NameIndexes },
    { name: 'Full-Text Indexes', indexes: FullTextIndexes },
    { name: 'Temporal Indexes', indexes: TemporalIndexes },
    { name: 'Spatial Indexes', indexes: SpatialIndexes },
    { name: 'Type Indexes', indexes: TypeIndexes },
    { name: 'Quality Indexes', indexes: QualityIndexes },
    { name: 'Source Tracking Indexes', indexes: SourceIndexes },
    { name: 'Composite Indexes', indexes: CompositeIndexes },
    { name: 'Relationship Indexes', indexes: RelationshipIndexes }
  ];

  for (const group of indexGroups) {
    lines.push(`// ${group.name}`);
    lines.push('// ' + '='.repeat(78));
    lines.push('');

    for (const index of group.indexes) {
      lines.push(`// ${index.description}`);
      lines.push(index.cypher + ';');
      lines.push('');
    }
  }

  return lines.join('\n');
}

/**
 * Generate Cypher script to drop all indexes
 */
export function generateIndexDeletionScript(): string {
  const lines = [
    '// ============================================================================',
    '// Neo4j Index Deletion Script',
    '// WARNING: This will remove all indexes',
    '// ============================================================================',
    ''
  ];

  for (const index of AllIndexes) {
    lines.push(`// Drop ${index.name}`);
    lines.push(index.dropCypher + ';');
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Query patterns this index strategy supports
 */
export const SupportedQueryPatterns = {
  name_search: {
    description: 'Find entities by name (exact or fuzzy)',
    indexes: ['entity_names_fulltext', 'entity_canonical_name_index'],
    exampleCypher: `
      // Exact match
      MATCH (e:Entity {canonical_name: 'Milarepa'})
      RETURN e

      // Full-text search
      CALL db.index.fulltext.queryNodes('entity_names_fulltext', 'Milarepa~')
      YIELD node
      RETURN node
    `
  },

  timeline_queries: {
    description: 'Find people alive during a specific time period',
    indexes: ['person_dates_composite', 'person_birth_year_index', 'person_death_year_index'],
    exampleCypher: `
      // People alive in 1350
      MATCH (p:Person)
      WHERE p.birth_year <= 1350 AND (p.death_year IS NULL OR p.death_year >= 1350)
      RETURN p
      ORDER BY p.birth_year
    `
  },

  geographic_queries: {
    description: 'Find places by region or coordinates',
    indexes: ['place_coordinates_composite', 'place_region_index', 'place_type_region_composite'],
    exampleCypher: `
      // Monasteries in Ü region
      MATCH (p:Place {place_type: 'monastery', region: 'Ü'})
      RETURN p

      // Places near a coordinate
      MATCH (p:Place)
      WHERE p.latitude IS NOT NULL AND p.longitude IS NOT NULL
      WITH p, point({latitude: p.latitude, longitude: p.longitude}) AS pPoint,
           point({latitude: 29.65, longitude: 91.1}) AS refPoint
      WHERE distance(pPoint, refPoint) < 100000  // within 100km
      RETURN p
    `
  },

  tradition_specific: {
    description: 'Find entities by Buddhist tradition',
    indexes: ['person_tradition_index', 'person_tradition_dates_composite'],
    exampleCypher: `
      // Sakya scholars from 1200-1300
      MATCH (p:Person)
      WHERE 'Sakya' IN p.tradition
        AND p.birth_year >= 1200
        AND p.birth_year <= 1300
      RETURN p
      ORDER BY p.birth_year
    `
  },

  quality_filtering: {
    description: 'Filter by confidence and verification status',
    indexes: ['entity_confidence_index', 'entity_type_confidence_composite'],
    exampleCypher: `
      // High-confidence verified people
      MATCH (p:Person)
      WHERE p.verified = true AND p.confidence >= 0.9
      RETURN p

      // All entities by type with confidence > 0.7
      MATCH (e:Entity)
      WHERE e.entity_type = 'person' AND e.confidence > 0.7
      RETURN e
    `
  },

  relationship_traversal: {
    description: 'Find connected entities (teacher lineages, incarnation lines)',
    indexes: ['relationship_confidence_index', 'person_id_index'],
    exampleCypher: `
      // Teacher lineage from Tilopa to Milarepa
      MATCH path = (start:Person {canonical_name: 'Tilopa'})
                   -[:TEACHER_OF*1..5]->
                   (end:Person {canonical_name: 'Milarepa'})
      RETURN path

      // All students of Tsongkhapa
      MATCH (teacher:Person {canonical_name: 'Tsongkhapa'})
            -[r:TEACHER_OF]->
            (student:Person)
      WHERE r.confidence > 0.7
      RETURN student
      ORDER BY r.start_year
    `
  },

  text_authorship: {
    description: 'Find texts by author, type, or topic',
    indexes: ['text_type_index', 'text_content_fulltext'],
    exampleCypher: `
      // All commentaries by Tsongkhapa
      MATCH (author:Person {canonical_name: 'Tsongkhapa'})
            -[:WROTE]->
            (text:Text {text_type: 'commentary'})
      RETURN text

      // Texts on emptiness
      CALL db.index.fulltext.queryNodes('text_content_fulltext', 'emptiness')
      YIELD node
      RETURN node
    `
  }
};
