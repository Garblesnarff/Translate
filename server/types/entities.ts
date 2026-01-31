/**
 * Knowledge Graph Entity Types
 *
 * These types define the structure of all entities that can be extracted
 * from Tibetan Buddhist texts for building a historical knowledge graph.
 *
 * Based on: roadmaps/knowledge-graph/ENTITY_TYPES.md
 */

// ============================================================================
// Base Types
// ============================================================================

export type EntityType =
  | 'person'
  | 'place'
  | 'text'
  | 'event'
  | 'lineage'
  | 'concept'
  | 'institution'
  | 'deity'
  | 'artifact';

export type PredicateType =
  // Teacher-Student relationships
  | 'teacher_of'
  | 'student_of'

  // Incarnation relationships
  | 'incarnation_of'

  // Authorship relationships
  | 'wrote'
  | 'translated'
  | 'compiled'

  // Spatial relationships
  | 'lived_at'
  | 'visited'
  | 'founded'
  | 'born_in'
  | 'died_in'

  // Event participation
  | 'attended'
  | 'organized'
  | 'sponsored'

  // Institutional relationships
  | 'member_of'
  | 'abbot_of'
  | 'patron_of'

  // Textual relationships
  | 'commentary_on'
  | 'cites'
  | 'part_of'
  | 'contains'
  | 'mentions'

  // Transmission relationships
  | 'received_transmission'
  | 'gave_empowerment'
  | 'transmitted_to'

  // Debate relationships
  | 'debated_with'
  | 'refuted'
  | 'agreed_with'

  // Family relationships
  | 'parent_of'
  | 'child_of'
  | 'sibling_of'
  | 'spouse_of'

  // Geographic relationships
  | 'within'
  | 'near'

  // Conceptual relationships
  | 'practiced'
  | 'held_view'
  | 'taught_concept'

  // Temporal relationships
  | 'preceded'
  | 'followed'
  | 'contemporary_with'
  
  // System relationships
  | 'potential_duplicate_of';

// ============================================================================
// Supporting Types
// ============================================================================

export interface NameVariants {
  tibetan: string[];
  english: string[];
  phonetic: string[];
  wylie: string[];
  sanskrit?: string[];
  chinese?: string[];
  mongolian?: string[];
}

export interface DateInfo {
  year?: number; // Gregorian year
  tibetanYear?: {
    rabjung: number; // 60-year cycle number (1-17+)
    year: number; // Year within rabjung (1-60)
    element: 'wood' | 'fire' | 'earth' | 'metal' | 'water';
    animal: 'rat' | 'ox' | 'tiger' | 'rabbit' | 'dragon' | 'snake' | 'horse' | 'sheep' | 'monkey' | 'bird' | 'dog' | 'pig';
  };
  era?: string; // e.g., "during reign of King Songsten Gampo"
  relative?: string; // e.g., "after X died", "before Y was born"
  season?: 'spring' | 'summer' | 'fall' | 'winter';
  precision: 'exact' | 'circa' | 'estimated' | 'disputed' | 'unknown';
  source?: string; // Where this date comes from
  confidence: number; // 0.0-1.0
}

export interface SourceReference {
  documentId: string; // Translation ID
  pageNumbers?: string[];
  chapterSection?: string;
  quotation?: string; // Exact text showing this fact
  extractedBy: 'human' | 'ai';
  extractionModel?: string; // e.g., "claude-3.5-sonnet"
  extractionConfidence: number;
  verifiedBy?: string;
  extractionDate: Date;
  notes?: string;
}

export interface Coordinates {
  latitude: number;
  longitude: number;
  accuracy?: number; // meters
  source?: string; // How coordinates were determined
}

// ============================================================================
// Entity Base Interface
// ============================================================================

export interface EntityBase {
  id: string;
  type: EntityType;
  canonicalName: string; // Primary name in English
  names: NameVariants;
  dates?: {
    [key: string]: DateInfo; // birth, death, founded, dissolved, etc.
  };
  confidence: number; // 0.0-1.0
  verified: boolean;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string; // 'ai' or user ID
  verifiedBy?: string;
  verifiedAt?: Date;
}

// ============================================================================
// Specific Entity Types
// ============================================================================

export interface PersonEntity extends EntityBase {
  type: 'person';
  attributes: {
    titles?: string[]; // རྗེ་བཙུན།, Rinpoche, Lotsawa, etc.
    honorifics?: string[];
    epithets?: string[]; // "The Great Translator", etc.
    roles?: ('teacher' | 'student' | 'translator' | 'abbot' | 'patron' | 'scholar' | 'yogi' | 'poet' | 'king' | 'minister' | 'practitioner' | 'master' | 'author' | 'deity_human_form')[];
    affiliations?: string[]; // Monastery names, lineage names
    gender?: 'male' | 'female' | 'unknown';
    tradition?: ('Nyingma' | 'Kagyu' | 'Sakya' | 'Gelug' | 'Bon' | 'Rimé' | 'Kadam' | 'Jonang' | 'Shangpa' | 'Chod')[];
    biography?: string; // Brief summary
    alternateNames?: string[]; // Other names they were known by
  };
  dates?: {
    birth?: DateInfo;
    death?: DateInfo;
    ordination?: DateInfo;
    enthronement?: DateInfo;
  };
}

export interface PlaceEntity extends EntityBase {
  type: 'place';
  attributes: {
    placeType: 'monastery' | 'mountain' | 'cave' | 'city' | 'region' | 'country' | 'holy_site' | 'hermitage' | 'temple' | 'stupa' | 'village' | 'district' | 'kingdom' | 'retreat_center' | 'route' | 'pass';
    coordinates?: Coordinates;
    region?: string; // Ü, Tsang, Kham, Amdo, etc.
    modernCountry?: string; // Current political entity
    parent?: string; // Parent place ID for hierarchy
    significance?: string[]; // Why this place is important
    description?: string;
    altitude?: number; // meters (relevant for mountains)
  };
  dates?: {
    founded?: DateInfo;
    destroyed?: DateInfo;
    rebuilt?: DateInfo;
  };
}

export interface TextEntity extends EntityBase {
  type: 'text';
  attributes: {
    textType: 'sutra' | 'tantra' | 'commentary' | 'biography' | 'poetry' | 'letters' | 'ritual' | 'philosophical_treatise' | 'history' | 'medicine' | 'astrology' | 'prayer' | 'aspiration' | 'terma' | 'lexicon' | 'grammar' | 'instruction' | 'treatise' | 'prophecy' | 'mantra';
    language: string; // Tibetan, Sanskrit, Chinese, Pali, etc.
    volumeCount?: number;
    pageCount?: number;
    topics?: string[]; // Main topics covered
    practices?: string[]; // Practices described
    collectionId?: string; // If part of larger collection
    tibetanCanonSection?: string; // Kangyur/Tengyur section
    abbreviated?: string; // Common short name
  };
  dates?: {
    composed?: DateInfo;
    translated?: DateInfo;
    printed?: DateInfo;
    rediscovered?: DateInfo; // For terma texts
  };
}

export interface EventEntity extends EntityBase {
  type: 'event';
  attributes: {
    eventType: 'teaching' | 'empowerment' | 'debate' | 'founding' | 'pilgrimage' | 'retreat' | 'death' | 'birth' | 'transmission' | 'political' | 'natural_disaster' | 'meeting' | 'ordination' | 'enthronement' | 'atmospheric_event' | 'water_event' | 'earth_event' | 'route_disruption' | 'temporal_marker' | 'oath_binding' | 'subjugation' | 'consecration' | 'sea_voyage' | 'religious_conflict' | 'volcanic_event' | 'tsunami' | 'astronomical_event' | 'famine' | 'epidemic';
    location?: string; // Place ID
    duration?: string; // "3 days", "6 months", "12 years"
    significance?: string;
    description?: string;
    attendeeCount?: number;
    casualtyCount?: number; // For disasters/conflicts
    damageAssessment?: string; // "City destroyed", "Library burned"
    recoveryDuration?: string; // "13 years"
    outcome?: string; // Result of the event
  };
  dates?: {
    occurred?: DateInfo;
    started?: DateInfo;
    ended?: DateInfo;
  };
}

export interface ConceptEntity extends EntityBase {
  type: 'concept';
  attributes: {
    conceptType: 'philosophical_view' | 'meditation_practice' | 'deity' | 'doctrine' | 'technical_term';
    definitions?: Array<{
      text: string;
      source: string; // Text ID
      author: string; // Person ID
      school?: string; // Which tradition's interpretation
    }>;
    relatedConcepts?: {
      broader?: string[]; // Parent concepts
      narrower?: string[]; // Sub-concepts
      related?: string[]; // Associated concepts
      contradicts?: string[]; // Opposing views
    };
    sanskritTerm?: string;
    paliTerm?: string;
  };
}

export interface InstitutionEntity extends EntityBase {
  type: 'institution';
  attributes: {
    institutionType: 'monastery' | 'college' | 'hermitage' | 'temple' | 'printing_house' | 'library' | 'government' | 'school';
    location?: string; // Place ID
    tradition?: string[]; // Can have multiple
    hierarchy?: {
      parent?: string; // Parent institution ID
      subsidiaries?: string[]; // Branch institution IDs
    };
    description?: string;
    founders?: string[]; // Person IDs
    notableAbbots?: Array<{
      personId?: string;
      personName: string;
      period?: string; // e.g., "mid-13th century", "1450-1475"
      significance?: string; // What they accomplished
    }>;
    textsProduced?: Array<{
      textId?: string;
      textName: string;
      year?: number;
      significance?: string;
    }>;
    majorEvents?: Array<{
      eventId?: string;
      description: string;
      date?: DateInfo;
    }>;
  };
  dates?: {
    founded?: DateInfo;
    dissolved?: DateInfo;
    reformed?: DateInfo;
  };
}

export interface DeityEntity extends EntityBase {
  type: 'deity';
  attributes: {
    deityType: 'buddha' | 'bodhisattva' | 'yidam' | 'protector' | 'dakini' | 'dharma_protector' | 'hindu_deity' | 'naga' | 'rakshasa' | 'mara' | 'spirit';
    tradition?: string[]; // Which traditions practice
    iconography?: {
      arms?: number;
      heads?: number;
      color?: string;
      implements?: string[]; // Vajra, bell, sword, etc.
      posture?: string; // Seated, standing, dancing
    };
    qualities?: string[]; // Compassion, wisdom, power, etc.
    mantras?: string[];
  };
}

export interface ArtifactEntity extends EntityBase {
  type: 'artifact';
  attributes: {
    artifactType: 'reliquary' | 'statue' | 'thangka' | 'ritual_object' | 'amulet' | 'manuscript_object';
    material?: string; // "gold", "sandalwood", "bone"
    dimensions?: string;
    creator?: string; // Person ID
    location?: string; // Current or historical location (Place ID)
    description?: string;
    significance?: string[];
  };
  dates?: {
    created?: DateInfo;
    discovered?: DateInfo; // For termas
    moved?: DateInfo; // Major relocation
  };
}

export interface LineageEntity extends EntityBase {
  type: 'lineage';
  attributes: {
    lineageType: 'incarnation' | 'transmission' | 'ordination' | 'family' | 'institutional';
    tradition?: string;
    teaching?: string; // What's being transmitted
    originTextId?: string; // Text ID if applicable
    originDate?: DateInfo;
    chain: LineageLink[];
    branches?: string[]; // Other lineage IDs that split from this
  };
}

export interface LineageLink {
  position: number; // Position in chain (1, 2, 3...)
  personId: string;
  receivedFrom?: string; // Person ID
  transmittedTo?: string[]; // Person IDs
  date?: DateInfo;
  location?: string; // Place ID
  eventId?: string; // Event ID if known
  notes?: string;
}

// ============================================================================
// Union Type for All Entities
// ============================================================================

export type Entity =
  | PersonEntity
  | PlaceEntity
  | TextEntity
  | EventEntity
  | ConceptEntity
  | InstitutionEntity
  | DeityEntity
  | LineageEntity
  | ArtifactEntity;

// ============================================================================
// Relationship Type
// ============================================================================

export interface Relationship {
  id: string;
  subjectId: string; // Entity ID
  predicate: PredicateType;
  objectId: string; // Entity ID
  properties: {
    date?: DateInfo;
    location?: string; // Place ID
    teaching?: string;
    duration?: string;
    role?: string;
    notes?: string;
    [key: string]: any; // Allow additional properties
  };
  confidence: number;
  verified: boolean;
  sourceDocumentId?: string; // Translation ID
  sourcePage?: string;
  sourceQuote?: string;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  verifiedBy?: string;
  verifiedAt?: Date;
}

// ============================================================================
// Extraction Result Types
// ============================================================================

export interface ExtractionResult {
  entities: Entity[];
  relationships: Relationship[];
  lineages?: LineageEntity[];
  metadata: {
    documentId: string;
    extractionDate: Date;
    model: string;
    averageConfidence: number;
    processingTime: number; // milliseconds
    entitiesByType?: Record<EntityType, number>;
  };
  ambiguities?: string[]; // List of uncertainties for human review
}

export interface ExtractionJob {
  id: string;
  translationId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  entitiesExtracted: number;
  relationshipsExtracted: number;
  confidenceAvg?: number;
  errorMessage?: string;
  startedAt?: Date;
  completedAt?: Date;
  createdAt: Date;
}

export interface BatchExtractionJob {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  totalDocuments: number;
  documentsProcessed: number;
  documentsFailed: number;
  totalEntities: number;
  totalRelationships: number;
  avgConfidence?: number;
  errorMessage?: string;
  startedAt?: Date;
  completedAt?: Date;
  createdAt: Date;
}

// ============================================================================
// Helper Types
// ============================================================================

export interface PlaceVisit {
  placeId: string;
  purpose?: string;
  date?: DateInfo;
  duration?: string;
  companions?: string[]; // Person IDs
  events?: string[]; // Event IDs
}

export interface Retreat {
  location: string; // Place ID
  duration: string;
  startDate?: DateInfo;
  endDate?: DateInfo;
  practice?: string;
  teacher?: string; // Person ID
  outcome?: string;
}

// ============================================================================
// Type Guards
// ============================================================================

export function isPerson(entity: Entity): entity is PersonEntity {
  return entity.type === 'person';
}

export function isPlace(entity: Entity): entity is PlaceEntity {
  return entity.type === 'place';
}

export function isText(entity: Entity): entity is TextEntity {
  return entity.type === 'text';
}

export function isEvent(entity: Entity): entity is EventEntity {
  return entity.type === 'event';
}

export function isConcept(entity: Entity): entity is ConceptEntity {
  return entity.type === 'concept';
}

export function isInstitution(entity: Entity): entity is InstitutionEntity {
  return entity.type === 'institution';
}

export function isDeity(entity: Entity): entity is DeityEntity {
  return entity.type === 'deity';
}

export function isLineage(entity: Entity): entity is LineageEntity {
  return entity.type === 'lineage';
}
