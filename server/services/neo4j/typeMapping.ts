/**
 * Type Mapping Utilities for PostgreSQL ↔ Neo4j Synchronization
 *
 * Handles conversion between PostgreSQL and Neo4j data types, including:
 * - Entity types → Node labels
 * - Predicates → Relationship types
 * - Property type conversions
 * - Date/time formatting
 *
 * Phase 4, Task 4.3: Sync Service
 */

import type { Entity, Relationship } from '../../../db/schema';
import type { EntityType, PredicateType } from '../../types/entities';

// ============================================================================
// Entity Type Mapping
// ============================================================================

/**
 * Map PostgreSQL entity type to Neo4j node labels
 * Uses multi-label approach: :Entity:SpecificType
 */
export function entityTypeToLabels(entityType: EntityType): string[] {
  const labelMap: Record<EntityType, string> = {
    person: 'Person',
    place: 'Place',
    text: 'Text',
    event: 'Event',
    concept: 'Concept',
    institution: 'Institution',
    deity: 'Deity',
    lineage: 'Lineage'
  };

  return ['Entity', labelMap[entityType]];
}

/**
 * Map Neo4j labels to PostgreSQL entity type
 */
export function labelsToEntityType(labels: string[]): EntityType | null {
  const labelMap: Record<string, EntityType> = {
    'Person': 'person',
    'Place': 'place',
    'Text': 'text',
    'Event': 'event',
    'Concept': 'concept',
    'Institution': 'institution',
    'Deity': 'deity',
    'Lineage': 'lineage'
  };

  for (const label of labels) {
    if (labelMap[label]) {
      return labelMap[label];
    }
  }

  return null;
}

// ============================================================================
// Relationship Type Mapping
// ============================================================================

/**
 * Map PostgreSQL predicate to Neo4j relationship type
 * Converts snake_case to SCREAMING_SNAKE_CASE
 */
export function predicateToRelType(predicate: PredicateType): string {
  return predicate.toUpperCase();
}

/**
 * Map Neo4j relationship type to PostgreSQL predicate
 * Converts SCREAMING_SNAKE_CASE to snake_case
 */
export function relTypeToPredicate(relType: string): PredicateType {
  return relType.toLowerCase() as PredicateType;
}

/**
 * Get inverse relationship type for bidirectional relationships
 */
export function getInverseRelType(relType: string): string | null {
  const inverseMap: Record<string, string> = {
    'TEACHER_OF': 'STUDENT_OF',
    'STUDENT_OF': 'TEACHER_OF',
    'PARENT_OF': 'CHILD_OF',
    'CHILD_OF': 'PARENT_OF',
    // Symmetric relationships map to themselves
    'DEBATED_WITH': 'DEBATED_WITH',
    'SIBLING_OF': 'SIBLING_OF',
    'SPOUSE_OF': 'SPOUSE_OF',
    'NEAR': 'NEAR',
    'CONTEMPORARY_WITH': 'CONTEMPORARY_WITH'
  };

  return inverseMap[relType] || null;
}

// ============================================================================
// Property Type Conversion
// ============================================================================

/**
 * Convert PostgreSQL value to Neo4j-compatible value
 */
export function pgToNeo4jValue(value: any, targetType?: string): any {
  if (value === null || value === undefined) {
    return null;
  }

  // Handle JSONB → Object conversion
  if (typeof value === 'string' && targetType === 'json') {
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }

  // Handle JSON objects that are already parsed
  if (typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
    return value;
  }

  // Handle arrays
  if (Array.isArray(value)) {
    return value.map(v => pgToNeo4jValue(v));
  }

  // Handle PostgreSQL TEXT → Neo4j Float for numeric strings
  if (typeof value === 'string' && targetType === 'float') {
    const num = parseFloat(value);
    return isNaN(num) ? null : num;
  }

  // Handle PostgreSQL TEXT → Neo4j Integer for numeric strings
  if (typeof value === 'string' && targetType === 'integer') {
    const num = parseInt(value, 10);
    return isNaN(num) ? null : num;
  }

  // Handle PostgreSQL timestamp → Neo4j datetime
  if (value instanceof Date) {
    return value.toISOString();
  }

  // Handle date strings
  if (typeof value === 'string' && targetType === 'datetime') {
    return new Date(value).toISOString();
  }

  // Handle boolean stored as integer (PostgreSQL pattern)
  if (targetType === 'boolean' && typeof value === 'number') {
    return value === 1;
  }

  return value;
}

/**
 * Convert Neo4j value to PostgreSQL-compatible value
 */
export function neo4jToPgValue(value: any, targetType?: string): any {
  if (value === null || value === undefined) {
    return null;
  }

  // Handle Neo4j DateTime → PostgreSQL timestamp
  if (typeof value === 'object' && value.toString && targetType === 'timestamp') {
    return new Date(value.toString());
  }

  // Handle Neo4j Integer → PostgreSQL integer
  if (typeof value === 'object' && typeof value.toNumber === 'function') {
    return value.toNumber();
  }

  // Handle objects → JSONB (stored as TEXT in PostgreSQL)
  if (typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
    return JSON.stringify(value);
  }

  // Handle arrays of objects → JSONB
  if (Array.isArray(value) && value.length > 0 && typeof value[0] === 'object') {
    return JSON.stringify(value);
  }

  // Handle boolean → integer (PostgreSQL storage pattern)
  if (typeof value === 'boolean' && targetType === 'integer') {
    return value ? 1 : 0;
  }

  // Handle float → TEXT (PostgreSQL storage pattern for precision)
  if (typeof value === 'number' && targetType === 'text') {
    return value.toString();
  }

  return value;
}

// ============================================================================
// Entity Property Mapping
// ============================================================================

/**
 * Convert PostgreSQL entity to Neo4j node properties
 */
export function pgEntityToNeo4jNode(entity: Entity): Record<string, any> {
  const attributes = typeof entity.attributes === 'string'
    ? JSON.parse(entity.attributes)
    : entity.attributes;

  const names = typeof entity.names === 'string'
    ? JSON.parse(entity.names)
    : entity.names;

  const dates = entity.dates
    ? (typeof entity.dates === 'string' ? JSON.parse(entity.dates) : entity.dates)
    : null;

  // Base properties (common to all entities)
  const baseProps: Record<string, any> = {
    id: entity.id,
    entity_type: entity.type,
    canonical_name: entity.canonicalName,
    tibetan_name: names?.tibetan?.[0] || null,
    wylie_name: names?.wylie?.[0] || null,
    phonetic_name: names?.phonetic?.[0] || null,
    alternate_names: [
      ...(names?.tibetan || []),
      ...(names?.english || []),
      ...(names?.wylie || []),
      ...(names?.phonetic || [])
    ].filter(Boolean),
    confidence: pgToNeo4jValue(entity.confidence, 'float'),
    verified: pgToNeo4jValue(entity.verified, 'boolean'),
    extraction_method: entity.createdBy === 'ai' ? 'llm' : 'manual',
    source_document_id: null, // TODO: Map from source_translation_id when available
    source_page: null,
    source_quote: null,
    created_at: pgToNeo4jValue(entity.createdAt, 'datetime'),
    updated_at: pgToNeo4jValue(entity.updatedAt, 'datetime'),
    created_by: entity.createdBy,
    verified_by: entity.verifiedBy,
    verified_at: entity.verifiedAt ? pgToNeo4jValue(entity.verifiedAt, 'datetime') : null,
    notes: null
  };

  // Type-specific properties
  const typeSpecificProps = mapTypeSpecificProperties(entity.type, attributes, dates);

  return {
    ...baseProps,
    ...typeSpecificProps
  };
}

/**
 * Map type-specific attributes from PostgreSQL to Neo4j
 */
function mapTypeSpecificProperties(
  entityType: EntityType,
  attributes: any,
  dates: any
): Record<string, any> {
  const props: Record<string, any> = {};

  switch (entityType) {
    case 'person':
      props.birth_year = dates?.birth?.year || null;
      props.birth_year_precision = dates?.birth?.precision || 'unknown';
      props.birth_tibetan_year = dates?.birth?.tibetan || null;
      props.death_year = dates?.death?.year || null;
      props.death_year_precision = dates?.death?.precision || 'unknown';
      props.death_tibetan_year = dates?.death?.tibetan || null;
      props.ordination_year = dates?.ordination?.year || null;
      props.enthronement_year = dates?.enthronement?.year || null;
      props.titles = attributes.titles || [];
      props.epithets = attributes.epithets || [];
      props.roles = attributes.roles || [];
      props.gender = attributes.gender || 'unknown';
      props.tradition = attributes.tradition || [];
      props.affiliations = attributes.affiliations || [];
      props.biography = attributes.biography || null;
      if (props.birth_year && props.death_year) {
        props.lifespan_years = props.death_year - props.birth_year;
      }
      break;

    case 'place':
      props.place_type = attributes.place_type || 'unknown';
      props.latitude = attributes.coordinates?.latitude || null;
      props.longitude = attributes.coordinates?.longitude || null;
      props.coordinate_accuracy = attributes.coordinates?.accuracy || null;
      props.altitude = attributes.altitude || null;
      props.region = attributes.region || null;
      props.modern_country = attributes.modern_country || null;
      props.parent_place_id = attributes.parent_place_id || null;
      props.significance = attributes.significance || [];
      props.description = attributes.description || null;
      props.founded_year = dates?.founded?.year || null;
      props.destroyed_year = dates?.destroyed?.year || null;
      props.rebuilt_year = dates?.rebuilt?.year || null;
      break;

    case 'text':
      props.text_type = attributes.text_type || 'unknown';
      props.language = attributes.language || null;
      props.volume_count = attributes.volume_count || null;
      props.page_count = attributes.page_count || null;
      props.topics = attributes.topics || [];
      props.practices = attributes.practices || [];
      props.collection_id = attributes.collection_id || null;
      props.tibetan_canon_section = attributes.tibetan_canon_section || null;
      props.abbreviated_name = attributes.abbreviated_name || null;
      props.composed_year = dates?.composed?.year || null;
      props.translated_year = dates?.translated?.year || null;
      props.printed_year = dates?.printed?.year || null;
      props.rediscovered_year = dates?.rediscovered?.year || null;
      break;

    case 'event':
      props.event_type = attributes.event_type || 'unknown';
      props.location_id = attributes.location_id || null;
      props.duration = attributes.duration || null;
      props.significance = attributes.significance || null;
      props.description = attributes.description || null;
      props.attendee_count = attributes.attendee_count || null;
      props.outcome = attributes.outcome || null;
      props.occurred_year = dates?.occurred?.year || null;
      props.started_year = dates?.started?.year || null;
      props.ended_year = dates?.ended?.year || null;
      break;

    case 'concept':
      props.concept_type = attributes.concept_type || 'unknown';
      props.definitions = attributes.definitions || null;
      props.sanskrit_term = attributes.sanskrit_term || null;
      props.pali_term = attributes.pali_term || null;
      props.chinese_term = attributes.chinese_term || null;
      props.short_definition = attributes.short_definition || null;
      break;

    case 'institution':
      props.institution_type = attributes.institution_type || 'unknown';
      props.location_id = attributes.location_id || null;
      props.tradition = attributes.tradition || [];
      props.parent_institution_id = attributes.parent_institution_id || null;
      props.subsidiary_ids = attributes.subsidiary_ids || [];
      props.description = attributes.description || null;
      props.notable_abbots = attributes.notable_abbots || null;
      props.texts_produced = attributes.texts_produced || null;
      props.major_events = attributes.major_events || null;
      props.founded_year = dates?.founded?.year || null;
      props.dissolved_year = dates?.dissolved?.year || null;
      props.reformed_year = dates?.reformed?.year || null;
      break;

    case 'deity':
      props.deity_type = attributes.deity_type || 'unknown';
      props.tradition = attributes.tradition || [];
      props.iconography = attributes.iconography || null;
      props.qualities = attributes.qualities || [];
      props.mantras = attributes.mantras || [];
      props.consort = attributes.consort || null;
      break;

    case 'lineage':
      props.lineage_type = attributes.lineage_type || 'unknown';
      props.tradition = attributes.tradition || null;
      props.teaching = attributes.teaching || null;
      props.origin_text_id = attributes.origin_text_id || null;
      props.origin_year = dates?.origin?.year || null;
      props.lineage_chain = attributes.lineage_chain || null;
      props.branch_lineage_ids = attributes.branch_lineage_ids || [];
      break;
  }

  return props;
}

/**
 * Convert Neo4j node properties to PostgreSQL entity
 */
export function neo4jNodeToPgEntity(node: any): Partial<Entity> {
  const props = node.properties || node;

  // Extract names
  const names = {
    tibetan: props.tibetan_name ? [props.tibetan_name] : [],
    english: props.canonical_name ? [props.canonical_name] : [],
    wylie: props.wylie_name ? [props.wylie_name] : [],
    phonetic: props.phonetic_name ? [props.phonetic_name] : []
  };

  // Extract dates based on entity type
  const dates = extractDatesFromNode(props);

  // Extract type-specific attributes
  const attributes = extractAttributesFromNode(props);

  return {
    id: props.id,
    type: props.entity_type,
    canonicalName: props.canonical_name,
    names: JSON.stringify(names),
    attributes: JSON.stringify(attributes),
    dates: dates ? JSON.stringify(dates) : null,
    confidence: neo4jToPgValue(props.confidence, 'text'),
    verified: neo4jToPgValue(props.verified, 'integer'),
    createdAt: props.created_at ? new Date(props.created_at) : new Date(),
    updatedAt: props.updated_at ? new Date(props.updated_at) : new Date(),
    createdBy: props.created_by || 'ai',
    verifiedBy: props.verified_by || null,
    verifiedAt: props.verified_at ? new Date(props.verified_at) : null,
    mergeStatus: 'active',
    mergedInto: null
  };
}

/**
 * Extract date information from Neo4j node
 */
function extractDatesFromNode(props: any): any {
  const dates: any = {};

  // Person dates
  if (props.birth_year) {
    dates.birth = {
      year: props.birth_year,
      precision: props.birth_year_precision || 'unknown',
      tibetan: props.birth_tibetan_year || null
    };
  }

  if (props.death_year) {
    dates.death = {
      year: props.death_year,
      precision: props.death_year_precision || 'unknown',
      tibetan: props.death_tibetan_year || null
    };
  }

  if (props.ordination_year) {
    dates.ordination = { year: props.ordination_year };
  }

  if (props.enthronement_year) {
    dates.enthronement = { year: props.enthronement_year };
  }

  // Place/Institution dates
  if (props.founded_year) {
    dates.founded = { year: props.founded_year };
  }

  if (props.destroyed_year) {
    dates.destroyed = { year: props.destroyed_year };
  }

  if (props.rebuilt_year) {
    dates.rebuilt = { year: props.rebuilt_year };
  }

  if (props.dissolved_year) {
    dates.dissolved = { year: props.dissolved_year };
  }

  if (props.reformed_year) {
    dates.reformed = { year: props.reformed_year };
  }

  // Text dates
  if (props.composed_year) {
    dates.composed = { year: props.composed_year };
  }

  if (props.translated_year) {
    dates.translated = { year: props.translated_year };
  }

  if (props.printed_year) {
    dates.printed = { year: props.printed_year };
  }

  if (props.rediscovered_year) {
    dates.rediscovered = { year: props.rediscovered_year };
  }

  // Event dates
  if (props.occurred_year) {
    dates.occurred = { year: props.occurred_year };
  }

  if (props.started_year) {
    dates.started = { year: props.started_year };
  }

  if (props.ended_year) {
    dates.ended = { year: props.ended_year };
  }

  // Lineage dates
  if (props.origin_year) {
    dates.origin = { year: props.origin_year };
  }

  return Object.keys(dates).length > 0 ? dates : null;
}

/**
 * Extract type-specific attributes from Neo4j node
 */
function extractAttributesFromNode(props: any): any {
  const attributes: any = {};

  // Copy all non-base properties
  const baseProperties = [
    'id', 'entity_type', 'canonical_name', 'tibetan_name', 'wylie_name',
    'phonetic_name', 'alternate_names', 'confidence', 'verified',
    'extraction_method', 'source_document_id', 'source_page', 'source_quote',
    'created_at', 'updated_at', 'created_by', 'verified_by', 'verified_at',
    'notes', 'birth_year', 'birth_year_precision', 'birth_tibetan_year',
    'death_year', 'death_year_precision', 'death_tibetan_year',
    'ordination_year', 'enthronement_year', 'lifespan_years',
    'founded_year', 'destroyed_year', 'rebuilt_year', 'dissolved_year',
    'reformed_year', 'composed_year', 'translated_year', 'printed_year',
    'rediscovered_year', 'occurred_year', 'started_year', 'ended_year',
    'origin_year'
  ];

  for (const [key, value] of Object.entries(props)) {
    if (!baseProperties.includes(key) && value !== null && value !== undefined) {
      // Handle coordinates specially
      if (key === 'latitude' || key === 'longitude' || key === 'coordinate_accuracy') {
        if (!attributes.coordinates) {
          attributes.coordinates = {};
        }
        attributes.coordinates[key === 'coordinate_accuracy' ? 'accuracy' : key] = value;
      } else {
        attributes[key] = value;
      }
    }
  }

  return attributes;
}

// ============================================================================
// Relationship Property Mapping
// ============================================================================

/**
 * Convert PostgreSQL relationship to Neo4j relationship properties
 */
export function pgRelationshipToNeo4jRel(relationship: Relationship): Record<string, any> {
  const properties = typeof relationship.properties === 'string'
    ? JSON.parse(relationship.properties)
    : relationship.properties;

  return {
    id: relationship.id,
    confidence: pgToNeo4jValue(relationship.confidence, 'float'),
    verified: pgToNeo4jValue(relationship.verified, 'boolean'),
    source_document_id: relationship.sourceDocumentId || null,
    source_page: relationship.sourcePage || null,
    source_quote: relationship.sourceQuote || null,
    extraction_method: relationship.createdBy === 'ai' ? 'llm' : 'manual',
    created_at: pgToNeo4jValue(relationship.createdAt, 'datetime'),
    updated_at: pgToNeo4jValue(relationship.updatedAt, 'datetime'),
    created_by: relationship.createdBy,
    verified_by: relationship.verifiedBy || null,
    verified_at: relationship.verifiedAt ? pgToNeo4jValue(relationship.verifiedAt, 'datetime') : null,
    notes: null,
    ...properties
  };
}

/**
 * Convert Neo4j relationship properties to PostgreSQL relationship
 */
export function neo4jRelToPgRelationship(
  rel: any,
  subjectId: string,
  objectId: string,
  predicate: PredicateType
): Partial<Relationship> {
  const props = rel.properties || rel;

  // Separate base properties from relationship-specific properties
  const baseProps = [
    'id', 'confidence', 'verified', 'source_document_id', 'source_page',
    'source_quote', 'extraction_method', 'created_at', 'updated_at',
    'created_by', 'verified_by', 'verified_at', 'notes'
  ];

  const relationshipProps: any = {};
  for (const [key, value] of Object.entries(props)) {
    if (!baseProps.includes(key)) {
      relationshipProps[key] = value;
    }
  }

  return {
    id: props.id,
    subjectId,
    predicate,
    objectId,
    properties: JSON.stringify(relationshipProps),
    confidence: neo4jToPgValue(props.confidence, 'text'),
    verified: neo4jToPgValue(props.verified, 'integer'),
    sourceDocumentId: props.source_document_id ? parseInt(props.source_document_id) : null,
    sourcePage: props.source_page || null,
    sourceQuote: props.source_quote || null,
    createdAt: props.created_at ? new Date(props.created_at) : new Date(),
    updatedAt: props.updated_at ? new Date(props.updated_at) : new Date(),
    createdBy: props.created_by || 'ai',
    verifiedBy: props.verified_by || null,
    verifiedAt: props.verified_at ? new Date(props.verified_at) : null
  };
}
