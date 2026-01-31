/**
 * Neo4j Node Schema Definitions
 *
 * Defines the complete node label structure for the Tibetan Buddhist Knowledge Graph.
 * Uses multi-label approach: all entities have :Entity label plus specific type label.
 *
 * Design Decisions:
 * - Multi-label approach (:Entity:Person) for shared queries and property inheritance
 * - Date properties stored as integers (year) with precision tracking
 * - Confidence scores (0.0-1.0) on all nodes
 * - Source tracking for traceability
 * - Support for both Tibetan and Gregorian date systems
 *
 * Phase 4, Task 4.2: Graph Schema Design
 */

import type { EntityType, PredicateType } from '../types/entities';

// ============================================================================
// Base Schema Interfaces
// ============================================================================

export interface PropertyDefinition {
  type: 'string' | 'integer' | 'float' | 'boolean' | 'datetime' | 'string[]' | 'json';
  required: boolean;
  indexed?: boolean;
  unique?: boolean;
  fulltext?: boolean;
  default?: any;
  description: string;
  constraints?: {
    min?: number;
    max?: number;
    pattern?: string;
    enum?: string[];
  };
}

export interface NodeLabelSchema {
  label: string;
  parentLabels?: string[];
  description: string;
  properties: Record<string, PropertyDefinition>;
  indexes: IndexDefinition[];
  constraints: ConstraintDefinition[];
}

export interface IndexDefinition {
  name: string;
  type: 'property' | 'fulltext' | 'composite' | 'vector';
  properties: string[];
  description: string;
}

export interface ConstraintDefinition {
  name: string;
  type: 'unique' | 'exists' | 'node_key';
  properties: string[];
  description: string;
}

// ============================================================================
// Base Entity Schema (Shared by All Entity Types)
// ============================================================================

export const EntityBaseSchema: NodeLabelSchema = {
  label: 'Entity',
  description: 'Base label for all knowledge graph entities. Provides common properties and enables cross-entity queries.',
  properties: {
    id: {
      type: 'string',
      required: true,
      unique: true,
      indexed: true,
      description: 'Unique UUID for this entity'
    },
    entity_type: {
      type: 'string',
      required: true,
      indexed: true,
      description: 'Type of entity (person, place, text, event, concept, institution, deity, lineage, artifact)',
      constraints: {
        enum: ['person', 'place', 'text', 'event', 'concept', 'institution', 'deity', 'lineage', 'artifact']
      }
    },
    canonical_name: {
      type: 'string',
      required: true,
      indexed: true,
      fulltext: true,
      description: 'Primary name in English for this entity'
    },
    tibetan_name: {
      type: 'string',
      required: false,
      indexed: true,
      fulltext: true,
      description: 'Primary name in Tibetan script'
    },
    wylie_name: {
      type: 'string',
      required: false,
      indexed: true,
      fulltext: true,
      description: 'Wylie transliteration of Tibetan name'
    },
    phonetic_name: {
      type: 'string',
      required: false,
      indexed: true,
      fulltext: true,
      description: 'Phonetic pronunciation of Tibetan name'
    },
    alternate_names: {
      type: 'string[]',
      required: false,
      fulltext: true,
      description: 'Array of alternate names in all languages'
    },
    confidence: {
      type: 'float',
      required: true,
      indexed: true,
      default: 0.8,
      description: 'Confidence score for entity existence and attributes (0.0-1.0)',
      constraints: {
        min: 0.0,
        max: 1.0
      }
    },
    verified: {
      type: 'boolean',
      required: true,
      indexed: true,
      default: false,
      description: 'Whether this entity has been verified by a human expert'
    },
    extraction_method: {
      type: 'string',
      required: true,
      indexed: true,
      description: 'How this entity was extracted (pattern, llm, manual)',
      constraints: {
        enum: ['pattern', 'llm', 'manual', 'merged', 'imported']
      }
    },
    source_document_id: {
      type: 'string',
      required: false,
      indexed: true,
      description: 'Translation ID where this entity was first extracted'
    },
    source_page: {
      type: 'string',
      required: false,
      description: 'Page number(s) where entity appears'
    },
    source_quote: {
      type: 'string',
      required: false,
      description: 'Exact text excerpt that mentions this entity'
    },
    created_at: {
      type: 'datetime',
      required: true,
      indexed: true,
      description: 'When this entity was created in the database'
    },
    updated_at: {
      type: 'datetime',
      required: true,
      indexed: true,
      description: 'When this entity was last updated'
    },
    created_by: {
      type: 'string',
      required: true,
      description: 'User ID or "ai" who created this entity'
    },
    verified_by: {
      type: 'string',
      required: false,
      description: 'User ID who verified this entity'
    },
    verified_at: {
      type: 'datetime',
      required: false,
      description: 'When this entity was verified'
    },
    notes: {
      type: 'string',
      required: false,
      description: 'Additional notes or context about this entity'
    }
  },
  indexes: [
    {
      name: 'entity_id_unique',
      type: 'property',
      properties: ['id'],
      description: 'Unique index on entity ID'
    },
    {
      name: 'entity_type_confidence',
      type: 'composite',
      properties: ['entity_type', 'confidence'],
      description: 'Composite index for filtering by type and confidence'
    },
    {
      name: 'entity_names_fulltext',
      type: 'fulltext',
      properties: ['canonical_name', 'tibetan_name', 'wylie_name', 'phonetic_name', 'alternate_names'],
      description: 'Full-text search across all name variants'
    }
  ],
  constraints: [
    {
      name: 'entity_id_unique',
      type: 'unique',
      properties: ['id'],
      description: 'Each entity must have a unique ID'
    },
    {
      name: 'entity_canonical_name_exists',
      type: 'exists',
      properties: ['canonical_name'],
      description: 'Every entity must have a canonical name'
    }
  ]
};

// ============================================================================
// Person Entity Schema
// ============================================================================

export const PersonSchema: NodeLabelSchema = {
  label: 'Person',
  parentLabels: ['Entity'],
  description: 'Historical Buddhist figures including teachers, scholars, translators, yogis, and patrons',
  properties: {
    // Dates (stored as integers for historical accuracy)
    birth_year: {
      type: 'integer',
      required: false,
      indexed: true,
      description: 'Birth year in Gregorian calendar'
    },
    birth_year_precision: {
      type: 'string',
      required: false,
      description: 'Precision of birth date (exact, circa, estimated, disputed, unknown)',
      constraints: {
        enum: ['exact', 'circa', 'estimated', 'disputed', 'unknown']
      }
    },
    birth_tibetan_year: {
      type: 'json',
      required: false,
      description: 'Birth year in Tibetan calendar system (rabjung, year, element, animal)'
    },
    death_year: {
      type: 'integer',
      required: false,
      indexed: true,
      description: 'Death year in Gregorian calendar'
    },
    death_year_precision: {
      type: 'string',
      required: false,
      description: 'Precision of death date',
      constraints: {
        enum: ['exact', 'circa', 'estimated', 'disputed', 'unknown']
      }
    },
    death_tibetan_year: {
      type: 'json',
      required: false,
      description: 'Death year in Tibetan calendar system'
    },
    ordination_year: {
      type: 'integer',
      required: false,
      indexed: true,
      description: 'Year of monastic ordination'
    },
    enthronement_year: {
      type: 'integer',
      required: false,
      description: 'Year of enthronement as tulku/rinpoche'
    },

    // Personal attributes
    titles: {
      type: 'string[]',
      required: false,
      description: 'Honorific titles (Rinpoche, Lotsawa, Khenpo, etc.)'
    },
    epithets: {
      type: 'string[]',
      required: false,
      description: 'Descriptive epithets ("The Great Translator", "Lord of Dharma", etc.)'
    },
    roles: {
      type: 'string[]',
      required: false,
      indexed: true,
      description: 'Roles held (teacher, translator, abbot, patron, scholar, yogi, poet, king, minister)'
    },
    gender: {
      type: 'string',
      required: false,
      description: 'Gender (male, female, unknown)',
      constraints: {
        enum: ['male', 'female', 'unknown']
      }
    },
    tradition: {
      type: 'string[]',
      required: false,
      indexed: true,
      description: 'Buddhist tradition affiliations (Nyingma, Kagyu, Sakya, Gelug, Bon, Rimé, Kadam, Jonang)'
    },
    affiliations: {
      type: 'string[]',
      required: false,
      description: 'Institutional affiliations (monastery names, lineage names)'
    },
    biography: {
      type: 'string',
      required: false,
      description: 'Brief biographical summary'
    },

    // Life span computed property
    lifespan_years: {
      type: 'integer',
      required: false,
      description: 'Computed lifespan if both birth and death years known'
    }
  },
  indexes: [
    {
      name: 'person_dates',
      type: 'composite',
      properties: ['birth_year', 'death_year'],
      description: 'Index for date-based queries and timeline generation'
    },
    {
      name: 'person_tradition',
      type: 'property',
      properties: ['tradition'],
      description: 'Index for filtering by Buddhist tradition'
    },
    {
      name: 'person_roles',
      type: 'property',
      properties: ['roles'],
      description: 'Index for finding people by role'
    }
  ],
  constraints: []
};

// ============================================================================
// Place Entity Schema
// ============================================================================

export const PlaceSchema: NodeLabelSchema = {
  label: 'Place',
  parentLabels: ['Entity'],
  description: 'Geographic locations including monasteries, mountains, caves, cities, and regions',
  properties: {
    place_type: {
      type: 'string',
      required: true,
      indexed: true,
      description: 'Type of place',
      constraints: {
        enum: ['monastery', 'mountain', 'cave', 'city', 'region', 'country', 'holy_site', 'hermitage', 'temple', 'stupa', 'route', 'pass']
      }
    },
    latitude: {
      type: 'float',
      required: false,
      indexed: true,
      description: 'Latitude coordinate',
      constraints: {
        min: -90,
        max: 90
      }
    },
    longitude: {
      type: 'float',
      required: false,
      indexed: true,
      description: 'Longitude coordinate',
      constraints: {
        min: -180,
        max: 180
      }
    },
    coordinate_accuracy: {
      type: 'integer',
      required: false,
      description: 'Accuracy of coordinates in meters'
    },
    altitude: {
      type: 'integer',
      required: false,
      description: 'Altitude in meters (relevant for mountains, monasteries)'
    },
    region: {
      type: 'string',
      required: false,
      indexed: true,
      description: 'Traditional Tibetan region (Ü, Tsang, Kham, Amdo, etc.)'
    },
    modern_country: {
      type: 'string',
      required: false,
      indexed: true,
      description: 'Current political entity (China, India, Nepal, Bhutan, etc.)'
    },
    parent_place_id: {
      type: 'string',
      required: false,
      indexed: true,
      description: 'ID of parent place for geographic hierarchy'
    },
    significance: {
      type: 'string[]',
      required: false,
      description: 'Why this place is historically/spiritually significant'
    },
    description: {
      type: 'string',
      required: false,
      description: 'Detailed description of the place'
    },
    founded_year: {
      type: 'integer',
      required: false,
      indexed: true,
      description: 'Year the place was founded/established'
    },
    destroyed_year: {
      type: 'integer',
      required: false,
      description: 'Year the place was destroyed (if applicable)'
    },
    rebuilt_year: {
      type: 'integer',
      required: false,
      description: 'Year the place was rebuilt (if applicable)'
    }
  },
  indexes: [
    {
      name: 'place_coordinates',
      type: 'composite',
      properties: ['latitude', 'longitude'],
      description: 'Spatial index for geographic queries'
    },
    {
      name: 'place_type_region',
      type: 'composite',
      properties: ['place_type', 'region'],
      description: 'Index for filtering places by type and region'
    }
  ],
  constraints: []
};

// ============================================================================
// Text Entity Schema
// ============================================================================

export const TextSchema: NodeLabelSchema = {
  label: 'Text',
  parentLabels: ['Entity'],
  description: 'Buddhist texts including sutras, tantras, commentaries, biographies, and philosophical treatises',
  properties: {
    text_type: {
      type: 'string',
      required: true,
      indexed: true,
      description: 'Type of text',
      constraints: {
        enum: ['sutra', 'tantra', 'commentary', 'biography', 'poetry', 'letters', 'ritual', 'philosophical_treatise', 'history', 'medicine', 'astrology', 'prophecy', 'mantra']
      }
    },
    language: {
      type: 'string',
      required: false,
      indexed: true,
      description: 'Primary language of the text (Tibetan, Sanskrit, Chinese, Pali, etc.)'
    },
    volume_count: {
      type: 'integer',
      required: false,
      description: 'Number of volumes'
    },
    page_count: {
      type: 'integer',
      required: false,
      description: 'Number of pages'
    },
    topics: {
      type: 'string[]',
      required: false,
      indexed: true,
      description: 'Main topics covered in the text'
    },
    practices: {
      type: 'string[]',
      required: false,
      description: 'Practices described in the text'
    },
    collection_id: {
      type: 'string',
      required: false,
      indexed: true,
      description: 'ID of larger collection this text belongs to'
    },
    tibetan_canon_section: {
      type: 'string',
      required: false,
      indexed: true,
      description: 'Kangyur/Tengyur section if applicable'
    },
    abbreviated_name: {
      type: 'string',
      required: false,
      indexed: true,
      description: 'Common abbreviated name'
    },
    composed_year: {
      type: 'integer',
      required: false,
      indexed: true,
      description: 'Year the text was composed'
    },
    translated_year: {
      type: 'integer',
      required: false,
      description: 'Year the text was translated'
    },
    printed_year: {
      type: 'integer',
      required: false,
      description: 'Year the text was first printed'
    },
    rediscovered_year: {
      type: 'integer',
      required: false,
      description: 'Year the text was rediscovered (for terma texts)'
    }
  },
  indexes: [
    {
      name: 'text_type_language',
      type: 'composite',
      properties: ['text_type', 'language'],
      description: 'Index for filtering texts by type and language'
    },
    {
      name: 'text_topics',
      type: 'property',
      properties: ['topics'],
      description: 'Index for topic-based searches'
    }
  ],
  constraints: []
};

// ============================================================================
// Event Entity Schema
// ============================================================================

export const EventSchema: NodeLabelSchema = {
  label: 'Event',
  parentLabels: ['Entity'],
  description: 'Historical events including teachings, empowerments, debates, foundings, and political events',
  properties: {
    event_type: {
      type: 'string',
      required: true,
      indexed: true,
      description: 'Type of event',
      constraints: {
        enum: ['teaching', 'empowerment', 'debate', 'founding', 'pilgrimage', 'retreat', 'death', 'birth', 'transmission', 'political', 'natural_disaster', 'meeting', 'ordination', 'enthronement', 'atmospheric_event', 'water_event', 'earth_event', 'route_disruption', 'temporal_marker', 'oath_binding', 'subjugation', 'consecration', 'sea_voyage', 'religious_conflict', 'volcanic_event', 'tsunami', 'astronomical_event', 'famine', 'epidemic']
      }
    },
    location_id: {
      type: 'string',
      required: false,
      indexed: true,
      description: 'Place ID where event occurred'
    },
    duration: {
      type: 'string',
      required: false,
      description: 'Duration of event (e.g., "3 days", "6 months", "12 years")'
    },
    significance: {
      type: 'string',
      required: false,
      description: 'Historical/spiritual significance of the event'
    },
    description: {
      type: 'string',
      required: false,
      description: 'Detailed description of what happened'
    },
    attendee_count: {
      type: 'integer',
      required: false,
      description: 'Approximate number of attendees'
    },
    casualty_count: {
      type: 'integer',
      required: false,
      description: 'Approximate number of casualties (for disasters/conflicts)'
    },
    damage_assessment: {
      type: 'string',
      required: false,
      description: 'Assessment of damage caused'
    },
    recovery_duration: {
      type: 'string',
      required: false,
      description: 'Time taken to recover from the event'
    },
    outcome: {
      type: 'string',
      required: false,
      description: 'Result or outcome of the event'
    },
    occurred_year: {
      type: 'integer',
      required: false,
      indexed: true,
      description: 'Year the event occurred'
    },
    started_year: {
      type: 'integer',
      required: false,
      indexed: true,
      description: 'Year the event started (for multi-year events)'
    },
    ended_year: {
      type: 'integer',
      required: false,
      description: 'Year the event ended'
    }
  },
  indexes: [
    {
      name: 'event_type_year',
      type: 'composite',
      properties: ['event_type', 'occurred_year'],
      description: 'Index for timeline queries by event type'
    },
    {
      name: 'event_location',
      type: 'property',
      properties: ['location_id'],
      description: 'Index for finding events by location'
    }
  ],
  constraints: []
};

// ============================================================================
// Concept Entity Schema
// ============================================================================

export const ConceptSchema: NodeLabelSchema = {
  label: 'Concept',
  parentLabels: ['Entity'],
  description: 'Philosophical views, meditation practices, deities, doctrines, and technical terms',
  properties: {
    concept_type: {
      type: 'string',
      required: true,
      indexed: true,
      description: 'Type of concept',
      constraints: {
        enum: ['philosophical_view', 'meditation_practice', 'doctrine', 'technical_term', 'practice']
      }
    },
    definitions: {
      type: 'json',
      required: false,
      description: 'Array of definitions with source, author, and school context'
    },
    sanskrit_term: {
      type: 'string',
      required: false,
      indexed: true,
      description: 'Sanskrit equivalent term'
    },
    pali_term: {
      type: 'string',
      required: false,
      description: 'Pali equivalent term'
    },
    chinese_term: {
      type: 'string',
      required: false,
      description: 'Chinese equivalent term'
    },
    short_definition: {
      type: 'string',
      required: false,
      description: 'Brief definition of the concept'
    }
  },
  indexes: [
    {
      name: 'concept_type',
      type: 'property',
      properties: ['concept_type'],
      description: 'Index for filtering concepts by type'
    },
    {
      name: 'concept_terms',
      type: 'fulltext',
      properties: ['sanskrit_term', 'pali_term', 'chinese_term'],
      description: 'Full-text search across terminology'
    }
  ],
  constraints: []
};

// ============================================================================
// Institution Entity Schema
// ============================================================================

export const InstitutionSchema: NodeLabelSchema = {
  label: 'Institution',
  parentLabels: ['Entity'],
  description: 'Monasteries, colleges, hermitages, temples, and other Buddhist institutions',
  properties: {
    institution_type: {
      type: 'string',
      required: true,
      indexed: true,
      description: 'Type of institution',
      constraints: {
        enum: ['monastery', 'college', 'hermitage', 'temple', 'printing_house', 'library', 'government', 'school']
      }
    },
    location_id: {
      type: 'string',
      required: false,
      indexed: true,
      description: 'Place ID of institution location'
    },
    tradition: {
      type: 'string[]',
      required: false,
      indexed: true,
      description: 'Buddhist tradition(s) of the institution'
    },
    parent_institution_id: {
      type: 'string',
      required: false,
      indexed: true,
      description: 'ID of parent institution in hierarchy'
    },
    subsidiary_ids: {
      type: 'string[]',
      required: false,
      description: 'IDs of branch institutions'
    },
    description: {
      type: 'string',
      required: false,
      description: 'Detailed description of the institution'
    },
    notable_abbots: {
      type: 'json',
      required: false,
      description: 'Array of notable abbots with periods and accomplishments'
    },
    texts_produced: {
      type: 'json',
      required: false,
      description: 'Array of texts produced by this institution'
    },
    major_events: {
      type: 'json',
      required: false,
      description: 'Array of major events at this institution'
    },
    founded_year: {
      type: 'integer',
      required: false,
      indexed: true,
      description: 'Year the institution was founded'
    },
    dissolved_year: {
      type: 'integer',
      required: false,
      description: 'Year the institution was dissolved'
    },
    reformed_year: {
      type: 'integer',
      required: false,
      description: 'Year the institution was reformed'
    }
  },
  indexes: [
    {
      name: 'institution_type_tradition',
      type: 'composite',
      properties: ['institution_type', 'tradition'],
      description: 'Index for filtering institutions by type and tradition'
    }
  ],
  constraints: []
};

// ============================================================================
// Deity Entity Schema
// ============================================================================

export const DeitySchema: NodeLabelSchema = {
  label: 'Deity',
  parentLabels: ['Entity'],
  description: 'Buddhist deities including buddhas, bodhisattvas, yidams, protectors, and dakinis',
  properties: {
    deity_type: {
      type: 'string',
      required: true,
      indexed: true,
      description: 'Type of deity',
      constraints: {
        enum: ['buddha', 'bodhisattva', 'yidam', 'protector', 'dakini', 'dharma_protector', 'hindu_deity', 'naga', 'rakshasa', 'mara', 'spirit']
      }
    },
    tradition: {
      type: 'string[]',
      required: false,
      indexed: true,
      description: 'Buddhist traditions that practice this deity'
    },
    iconography: {
      type: 'json',
      required: false,
      description: 'Iconographic details (arms, heads, color, implements, posture)'
    },
    qualities: {
      type: 'string[]',
      required: false,
      description: 'Qualities embodied (compassion, wisdom, power, etc.)'
    },
    mantras: {
      type: 'string[]',
      required: false,
      description: 'Associated mantras'
    },
    consort: {
      type: 'string',
      required: false,
      description: 'Name of consort deity if applicable'
    }
  },
  indexes: [
    {
      name: 'deity_type_tradition',
      type: 'composite',
      properties: ['deity_type', 'tradition'],
      description: 'Index for filtering deities by type and tradition'
    }
  ],
  constraints: []
};

// ============================================================================
// Lineage Entity Schema
// ============================================================================

export const LineageSchema: NodeLabelSchema = {
  label: 'Lineage',
  parentLabels: ['Entity'],
  description: 'Transmission lineages including incarnation lines, teaching lineages, and ordination lineages',
  properties: {
    lineage_type: {
      type: 'string',
      required: true,
      indexed: true,
      description: 'Type of lineage',
      constraints: {
        enum: ['incarnation', 'transmission', 'ordination', 'family', 'institutional']
      }
    },
    tradition: {
      type: 'string',
      required: false,
      indexed: true,
      description: 'Buddhist tradition of this lineage'
    },
    teaching: {
      type: 'string',
      required: false,
      description: 'What teaching/transmission is being passed'
    },
    origin_text_id: {
      type: 'string',
      required: false,
      indexed: true,
      description: 'Text ID if lineage relates to a specific text'
    },
    origin_year: {
      type: 'integer',
      required: false,
      indexed: true,
      description: 'Year the lineage originated'
    },
    lineage_chain: {
      type: 'json',
      required: false,
      description: 'Complete lineage chain with positions and dates'
    },
    branch_lineage_ids: {
      type: 'string[]',
      required: false,
      description: 'IDs of lineages that split from this one'
    }
  },
  indexes: [
    {
      name: 'lineage_type_tradition',
      type: 'composite',
      properties: ['lineage_type', 'tradition'],
      description: 'Index for filtering lineages by type and tradition'
    }
  ],
  constraints: []
};

// ============================================================================
// Artifact Entity Schema
// ============================================================================

export const ArtifactSchema: NodeLabelSchema = {
  label: 'Artifact',
  parentLabels: ['Entity'],
  description: 'Sacred objects, reliquaries, statues, thangkas, and ritual items',
  properties: {
    artifact_type: {
      type: 'string',
      required: true,
      indexed: true,
      description: 'Type of artifact',
      constraints: {
        enum: ['reliquary', 'statue', 'thangka', 'ritual_object', 'amulet', 'manuscript_object']
      }
    },
    material: {
      type: 'string',
      required: false,
      description: 'Material composition (gold, sandalwood, bone, etc.)'
    },
    dimensions: {
      type: 'string',
      required: false,
      description: 'Physical dimensions'
    },
    creator_id: {
      type: 'string',
      required: false,
      indexed: true,
      description: 'Person ID of the creator'
    },
    location_id: {
      type: 'string',
      required: false,
      indexed: true,
      description: 'Current or historical location (Place ID)'
    },
    description: {
      type: 'string',
      required: false,
      description: 'Detailed description of the artifact'
    },
    significance: {
      type: 'string[]',
      required: false,
      description: 'Why this artifact is important'
    },
    created_year: {
      type: 'integer',
      required: false,
      indexed: true,
      description: 'Year created'
    },
    discovered_year: {
      type: 'integer',
      required: false,
      description: 'Year discovered (for termas)'
    }
  },
  indexes: [
    {
      name: 'artifact_type',
      type: 'property',
      properties: ['artifact_type'],
      description: 'Index for filtering artifacts by type'
    }
  ],
  constraints: []
};

// ============================================================================
// Schema Registry
// ============================================================================

export const NodeSchemas: Record<string, NodeLabelSchema> = {
  Entity: EntityBaseSchema,
  Person: PersonSchema,
  Place: PlaceSchema,
  Text: TextSchema,
  Event: EventSchema,
  Concept: ConceptSchema,
  Institution: InstitutionSchema,
  Deity: DeitySchema,
  Lineage: LineageSchema,
  Artifact: ArtifactSchema
};

/**
 * Get schema for a specific entity type
 */
export function getNodeSchema(entityType: EntityType): NodeLabelSchema {
  const schemaMap: Record<EntityType, NodeLabelSchema> = {
    person: PersonSchema,
    place: PlaceSchema,
    text: TextSchema,
    event: EventSchema,
    concept: ConceptSchema,
    institution: InstitutionSchema,
    deity: DeitySchema,
    lineage: LineageSchema,
    artifact: ArtifactSchema
  };

  return schemaMap[entityType];
}

/**
 * Get all required properties for a node label
 */
export function getRequiredProperties(label: string): string[] {
  const schema = NodeSchemas[label];
  if (!schema) return [];

  return Object.entries(schema.properties)
    .filter(([_, def]) => def.required)
    .map(([name, _]) => name);
}

/**
 * Get all indexed properties for a node label
 */
export function getIndexedProperties(label: string): string[] {
  const schema = NodeSchemas[label];
  if (!schema) return [];

  return Object.entries(schema.properties)
    .filter(([_, def]) => def.indexed)
    .map(([name, _]) => name);
}

/**
 * Validate node property value against schema
 */
export function validateProperty(
  label: string,
  propertyName: string,
  value: any
): { valid: boolean; error?: string } {
  const schema = NodeSchemas[label];
  if (!schema) {
    return { valid: false, error: `Unknown label: ${label}` };
  }

  const propertyDef = schema.properties[propertyName];
  if (!propertyDef) {
    return { valid: false, error: `Unknown property: ${propertyName} for label ${label}` };
  }

  // Check required
  if (propertyDef.required && (value === null || value === undefined)) {
    return { valid: false, error: `Property ${propertyName} is required` };
  }

  // Check type
  if (value !== null && value !== undefined) {
    const expectedType = propertyDef.type;
    const actualType = Array.isArray(value) ? 'array' : typeof value;

    if (expectedType.includes('[]') && !Array.isArray(value)) {
      return { valid: false, error: `Property ${propertyName} must be an array` };
    }

    if (expectedType === 'integer' && !Number.isInteger(value)) {
      return { valid: false, error: `Property ${propertyName} must be an integer` };
    }

    if (expectedType === 'float' && typeof value !== 'number') {
      return { valid: false, error: `Property ${propertyName} must be a number` };
    }
  }

  // Check constraints
  if (propertyDef.constraints) {
    if (propertyDef.constraints.min !== undefined && value < propertyDef.constraints.min) {
      return { valid: false, error: `Property ${propertyName} must be >= ${propertyDef.constraints.min}` };
    }

    if (propertyDef.constraints.max !== undefined && value > propertyDef.constraints.max) {
      return { valid: false, error: `Property ${propertyName} must be <= ${propertyDef.constraints.max}` };
    }

    if (propertyDef.constraints.enum && !propertyDef.constraints.enum.includes(value)) {
      return { valid: false, error: `Property ${propertyName} must be one of: ${propertyDef.constraints.enum.join(', ')}` };
    }
  }

  return { valid: true };
}
