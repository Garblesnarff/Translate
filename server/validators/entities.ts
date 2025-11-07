/**
 * Zod Validation Schemas for Knowledge Graph Entities
 *
 * These schemas validate entity data at runtime and provide
 * TypeScript types via inference.
 */

import { z } from 'zod';

// ============================================================================
// Supporting Schemas
// ============================================================================

export const DateInfoSchema = z.object({
  year: z.number().int().optional(),
  tibetanYear: z.object({
    rabjung: z.number().int().min(1).max(20),
    year: z.number().int().min(1).max(60),
    element: z.enum(['wood', 'fire', 'earth', 'metal', 'water']),
    animal: z.enum(['rat', 'ox', 'tiger', 'rabbit', 'dragon', 'snake', 'horse', 'sheep', 'monkey', 'bird', 'dog', 'pig'])
  }).optional(),
  era: z.string().optional(),
  relative: z.string().optional(),
  season: z.enum(['spring', 'summer', 'fall', 'winter']).optional(),
  precision: z.enum(['exact', 'circa', 'estimated', 'disputed', 'unknown']),
  source: z.string().optional(),
  confidence: z.number().min(0).max(1)
});

export const NameVariantsSchema = z.object({
  tibetan: z.array(z.string()).default([]),
  english: z.array(z.string()).default([]),
  phonetic: z.array(z.string()).default([]),
  wylie: z.array(z.string()).default([]),
  sanskrit: z.array(z.string()).optional(),
  chinese: z.array(z.string()).optional(),
  mongolian: z.array(z.string()).optional()
});

export const SourceReferenceSchema = z.object({
  documentId: z.string(),
  pageNumbers: z.array(z.string()).optional(),
  chapterSection: z.string().optional(),
  quotation: z.string().optional(),
  extractedBy: z.enum(['human', 'ai']),
  extractionModel: z.string().optional(),
  extractionConfidence: z.number().min(0).max(1),
  verifiedBy: z.string().optional(),
  extractionDate: z.date(),
  notes: z.string().optional()
});

export const CoordinatesSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  accuracy: z.number().positive().optional(),
  source: z.string().optional()
});

// ============================================================================
// Entity Base Schema
// ============================================================================

export const EntityBaseSchema = z.object({
  id: z.string().uuid().optional(), // Optional for creation
  type: z.enum(['person', 'place', 'text', 'event', 'lineage', 'concept', 'institution', 'deity']),
  canonicalName: z.string().min(1).max(500),
  names: NameVariantsSchema,
  dates: z.record(DateInfoSchema).optional(),
  confidence: z.number().min(0).max(1).default(0.5),
  verified: z.boolean().default(false),
  createdBy: z.string().default('ai'),
  // Don't include timestamps in validation - they're set by database
});

// ============================================================================
// Specific Entity Schemas
// ============================================================================

export const PersonEntitySchema = EntityBaseSchema.extend({
  type: z.literal('person'),
  attributes: z.object({
    titles: z.array(z.string()).optional(),
    honorifics: z.array(z.string()).optional(),
    epithets: z.array(z.string()).optional(),
    roles: z.array(z.enum(['teacher', 'student', 'translator', 'abbot', 'patron', 'scholar', 'yogi', 'poet', 'king', 'minister'])).optional(),
    affiliations: z.array(z.string()).optional(),
    gender: z.enum(['male', 'female', 'unknown']).optional(),
    tradition: z.array(z.enum(['Nyingma', 'Kagyu', 'Sakya', 'Gelug', 'Bon', 'Rimé', 'Kadam', 'Jonang'])).optional(),
    biography: z.string().optional(),
    alternateNames: z.array(z.string()).optional()
  }).default({})
});

export const PlaceEntitySchema = EntityBaseSchema.extend({
  type: z.literal('place'),
  attributes: z.object({
    placeType: z.enum(['monastery', 'mountain', 'cave', 'city', 'region', 'country', 'holy_site', 'hermitage', 'temple', 'stupa']),
    coordinates: CoordinatesSchema.optional(),
    region: z.string().optional(),
    modernCountry: z.string().optional(),
    parent: z.string().optional(),
    significance: z.array(z.string()).optional(),
    description: z.string().optional(),
    altitude: z.number().optional()
  })
});

export const TextEntitySchema = EntityBaseSchema.extend({
  type: z.literal('text'),
  attributes: z.object({
    textType: z.enum(['sutra', 'tantra', 'commentary', 'biography', 'poetry', 'letters', 'ritual', 'philosophical_treatise', 'history', 'medicine', 'astrology']),
    language: z.string(),
    volumeCount: z.number().int().positive().optional(),
    pageCount: z.number().int().positive().optional(),
    topics: z.array(z.string()).optional(),
    practices: z.array(z.string()).optional(),
    collectionId: z.string().optional(),
    tibetanCanonSection: z.string().optional(),
    abbreviated: z.string().optional()
  })
});

export const EventEntitySchema = EntityBaseSchema.extend({
  type: z.literal('event'),
  attributes: z.object({
    eventType: z.enum(['teaching', 'empowerment', 'debate', 'founding', 'pilgrimage', 'retreat', 'death', 'birth', 'transmission', 'political', 'natural_disaster', 'meeting', 'ordination', 'enthronement']),
    location: z.string().optional(),
    duration: z.string().optional(),
    significance: z.string().optional(),
    description: z.string().optional(),
    attendeeCount: z.number().int().positive().optional(),
    outcome: z.string().optional()
  })
});

// Event Extraction Supporting Schemas
export const EventParticipantSchema = z.object({
  eventId: z.string(),
  participantId: z.string(),
  role: z.enum(['teacher', 'student', 'organizer', 'sponsor', 'attendee', 'recipient', 'witness', 'performer']),
  sourceQuote: z.string().optional()
});

export const EventRelatedTextSchema = z.object({
  eventId: z.string(),
  textId: z.string(),
  relationship: z.enum(['taught', 'composed', 'revealed', 'received_transmission', 'commented_on', 'translated']),
  sourceQuote: z.string().optional()
});

export const EventTemporalRelationshipSchema = z.object({
  event1Id: z.string(),
  event2Id: z.string(),
  relationship: z.enum(['before', 'after', 'during', 'concurrent_with']),
  timeDifference: z.string().optional(),
  confidence: z.number().min(0).max(1),
  sourceQuote: z.string().optional()
});

export const EventExtractionResultSchema = z.object({
  events: z.array(EventEntitySchema),
  participants: z.array(EventParticipantSchema).optional(),
  relatedTexts: z.array(EventRelatedTextSchema).optional(),
  temporalRelationships: z.array(EventTemporalRelationshipSchema).optional(),
  ambiguities: z.array(z.string()).optional()
});

// ============================================================================
// Concept Extraction Supporting Schemas (Phase 1, Task 1.1.4)
// ============================================================================

// Enhanced concept definition schema with school tracking
export const ConceptDefinitionSchema = z.object({
  text: z.string().min(1).max(5000),
  source: z.string(), // Text ID or description
  author: z.string(), // Person ID or name
  school: z.string().optional(), // Which tradition's interpretation
  context: z.string().optional(), // Additional context about this definition
  confidence: z.number().min(0).max(1).optional()
});

// Related concepts schema with prerequisite and progression tracking
export const RelatedConceptsSchema = z.object({
  broader: z.array(z.string()).optional(), // Parent concepts
  narrower: z.array(z.string()).optional(), // Sub-concepts
  related: z.array(z.string()).optional(), // Associated concepts
  contradicts: z.array(z.string()).optional(), // Opposing views
  prerequisite: z.array(z.string()).optional(), // Required prior understanding
  leads_to: z.array(z.string()).optional() // Advanced concepts this leads to
});

// Practice-specific details for meditation practices
export const PracticeDetailsSchema = z.object({
  stages: z.array(z.string()).optional(), // Stages of practice
  prerequisites: z.array(z.string()).optional(), // What's needed before this practice
  duration: z.string().optional(), // Typical practice duration
  results: z.array(z.string()).optional(), // Expected outcomes
  techniques: z.array(z.string()).optional(), // Specific techniques involved
  warnings: z.array(z.string()).optional() // Cautions or requirements
});

// School-specific interpretation tracking
export const SchoolInterpretationSchema = z.object({
  school: z.string(), // Gelug, Kagyu, Sakya, Nyingma, Jonang, etc.
  interpretation: z.string().min(1).max(5000),
  proponents: z.array(z.string()).optional(), // Person IDs or names
  sources: z.array(z.string()).optional(), // Text IDs or references
  confidence: z.number().min(0).max(1).optional(),
  period: z.string().optional(), // When this interpretation emerged
  context: z.string().optional() // Historical or doctrinal context
});

// Debate and controversy tracking
export const ConceptControversySchema = z.object({
  description: z.string().min(1).max(2000),
  schools_involved: z.array(z.string()).optional(),
  significance: z.string().optional(),
  resolution: z.string().optional(), // How/if it was resolved
  ongoing: z.boolean().optional() // Still debated?
});

// Debate position schema for tracking different views
export const DebatePositionSchema = z.object({
  school: z.string(),
  view: z.string().min(1).max(2000),
  proponents: z.array(z.string()).optional(),
  sources: z.array(z.string()).optional(),
  confidence: z.number().min(0).max(1).optional()
});

// Full debate schema
export const DebateSchema = z.object({
  concept: z.string(), // Concept ID or tempId
  conceptName: z.string(),
  description: z.string(),
  positions: z.array(DebatePositionSchema),
  significance: z.string().optional(),
  resolution: z.string().optional(),
  ongoing: z.boolean().default(true)
});

// Enhanced Concept Entity Schema
export const ConceptEntitySchema = EntityBaseSchema.extend({
  type: z.literal('concept'),
  attributes: z.object({
    conceptType: z.enum(['philosophical_view', 'meditation_practice', 'deity', 'doctrine', 'technical_term']),
    definitions: z.array(ConceptDefinitionSchema).optional(),
    relatedConcepts: RelatedConceptsSchema.optional(),
    sanskritTerm: z.string().optional(),
    paliTerm: z.string().optional(),
    chineseTerm: z.string().optional(),
    // Practice-specific details (for meditation practices)
    practiceDetails: PracticeDetailsSchema.optional(),
    // School-specific interpretations (CRITICAL for concepts)
    schoolInterpretations: z.array(SchoolInterpretationSchema).optional(),
    // Debates and controversies
    controversies: z.array(ConceptControversySchema).optional(),
    // Known practitioners or teachers of this concept/practice
    notablePractitioners: z.array(z.string()).optional(), // Person IDs
    // Key texts that teach this concept
    keyTexts: z.array(z.string()).optional(), // Text IDs
    // Historical context
    historicalContext: z.string().optional()
  })
});

export const InstitutionEntitySchema = EntityBaseSchema.extend({
  type: z.literal('institution'),
  attributes: z.object({
    institutionType: z.enum(['monastery', 'college', 'hermitage', 'temple', 'printing_house', 'library', 'government', 'school']),
    location: z.string().optional(),
    tradition: z.array(z.string()).optional(),
    hierarchy: z.object({
      parent: z.string().optional(),
      subsidiaries: z.array(z.string()).optional()
    }).optional(),
    description: z.string().optional(),
    // Founding information
    founders: z.array(z.string()).optional(), // Person IDs or tempIds
    // Notable leaders over time
    notableAbbots: z.array(z.object({
      personId: z.string().optional(),
      personName: z.string(),
      period: z.string().optional(), // e.g., "mid-13th century", "1450-1475"
      significance: z.string().optional() // What they accomplished
    })).optional(),
    // Texts produced at this institution
    textsProduced: z.array(z.object({
      textId: z.string().optional(),
      textName: z.string(),
      year: z.number().int().optional(),
      significance: z.string().optional()
    })).optional(),
    // Major historical events at this institution
    majorEvents: z.array(z.object({
      eventId: z.string().optional(),
      description: z.string(),
      date: DateInfoSchema.optional()
    })).optional()
  })
});

export const DeityEntitySchema = EntityBaseSchema.extend({
  type: z.literal('deity'),
  attributes: z.object({
    deityType: z.enum(['buddha', 'bodhisattva', 'yidam', 'protector', 'dakini', 'dharma_protector']),
    tradition: z.array(z.string()).optional(),
    iconography: z.object({
      arms: z.number().int().positive().optional(),
      heads: z.number().int().positive().optional(),
      color: z.string().optional(),
      implements: z.array(z.string()).optional(),
      posture: z.string().optional()
    }).optional(),
    qualities: z.array(z.string()).optional(),
    mantras: z.array(z.string()).optional()
  })
});

export const LineageLinkSchema = z.object({
  position: z.number().int().positive(),
  personId: z.string(),
  receivedFrom: z.string().optional(),
  transmittedTo: z.array(z.string()).optional(),
  date: DateInfoSchema.optional(),
  location: z.string().optional(),
  eventId: z.string().optional(),
  notes: z.string().optional()
});

export const LineageEntitySchema = EntityBaseSchema.extend({
  type: z.literal('lineage'),
  attributes: z.object({
    lineageType: z.enum(['incarnation', 'transmission', 'ordination', 'family', 'institutional']),
    tradition: z.string().optional(),
    teaching: z.string().optional(),
    originTextId: z.string().optional(),
    originDate: DateInfoSchema.optional(),
    chain: z.array(LineageLinkSchema),
    branches: z.array(z.string()).optional()
  })
});

// ============================================================================
// Relationship Schema
// ============================================================================

export const RelationshipSchema = z.object({
  id: z.string().uuid().optional(),
  subjectId: z.string().uuid(),
  predicate: z.string().min(1).max(100),
  objectId: z.string().uuid(),
  properties: z.record(z.any()).default({}),
  confidence: z.number().min(0).max(1).default(0.5),
  verified: z.boolean().default(false),
  sourceDocumentId: z.string().optional(),
  sourcePage: z.string().optional(),
  sourceQuote: z.string().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
  createdBy: z.string().default('ai'),
  verifiedBy: z.string().optional(),
  verifiedAt: z.date().optional(),
});

// ============================================================================
// Extraction Result Schema
// ============================================================================

export const ExtractionResultSchema = z.object({
  entities: z.array(z.union([
    PersonEntitySchema,
    PlaceEntitySchema,
    TextEntitySchema,
    EventEntitySchema,
    ConceptEntitySchema,
    InstitutionEntitySchema,
    DeityEntitySchema,
    LineageEntitySchema
  ])),
  relationships: z.array(RelationshipSchema),
  lineages: z.array(LineageEntitySchema).optional(),
  metadata: z.object({
    documentId: z.string(),
    extractionDate: z.date(),
    model: z.string(),
    averageConfidence: z.number().min(0).max(1),
    processingTime: z.number().positive(),
    entitiesByType: z.record(z.number()).optional()
  }),
  ambiguities: z.array(z.string()).optional()
});

// Concept-specific extraction result schema
export const ConceptExtractionResultSchema = z.object({
  concepts: z.array(z.union([ConceptEntitySchema, DeityEntitySchema])),
  relationships: z.array(RelationshipSchema).optional(),
  debates: z.array(DebateSchema).optional(),
  ambiguities: z.array(z.string()).optional()
});

// ============================================================================
// Type Exports (inferred from schemas)
// ============================================================================

export type DateInfoInput = z.infer<typeof DateInfoSchema>;
export type NameVariantsInput = z.infer<typeof NameVariantsSchema>;
export type PersonEntityInput = z.infer<typeof PersonEntitySchema>;
export type PlaceEntityInput = z.infer<typeof PlaceEntitySchema>;
export type TextEntityInput = z.infer<typeof TextEntitySchema>;
export type EventEntityInput = z.infer<typeof EventEntitySchema>;
export type ConceptEntityInput = z.infer<typeof ConceptEntitySchema>;
export type InstitutionEntityInput = z.infer<typeof InstitutionEntitySchema>;
export type DeityEntityInput = z.infer<typeof DeityEntitySchema>;
export type LineageEntityInput = z.infer<typeof LineageEntitySchema>;
export type RelationshipInput = z.infer<typeof RelationshipSchema>;
export type ExtractionResultInput = z.infer<typeof ExtractionResultSchema>;

// Event Extraction Result Types
export type EventParticipantInput = z.infer<typeof EventParticipantSchema>;
export type EventRelatedTextInput = z.infer<typeof EventRelatedTextSchema>;
export type EventTemporalRelationshipInput = z.infer<typeof EventTemporalRelationshipSchema>;
export type EventExtractionResultInput = z.infer<typeof EventExtractionResultSchema>;

// Concept Extraction Result Types (Phase 1, Task 1.1.4)
export type ConceptDefinitionInput = z.infer<typeof ConceptDefinitionSchema>;
export type RelatedConceptsInput = z.infer<typeof RelatedConceptsSchema>;
export type PracticeDetailsInput = z.infer<typeof PracticeDetailsSchema>;
export type SchoolInterpretationInput = z.infer<typeof SchoolInterpretationSchema>;
export type ConceptControversyInput = z.infer<typeof ConceptControversySchema>;
export type DebatePositionInput = z.infer<typeof DebatePositionSchema>;
export type DebateInput = z.infer<typeof DebateSchema>;
export type ConceptExtractionResultInput = z.infer<typeof ConceptExtractionResultSchema>;

// ============================================================================
// Validation Helper Functions
// ============================================================================

/**
 * Validate and parse an entity, returning validated data or throwing error
 */
export function validateEntity(data: unknown):
  | PersonEntityInput
  | PlaceEntityInput
  | TextEntityInput
  | EventEntityInput
  | ConceptEntityInput
  | InstitutionEntityInput
  | DeityEntityInput
  | LineageEntityInput {

  // Try each schema based on type field
  const baseData = data as any;

  switch (baseData?.type) {
    case 'person':
      return PersonEntitySchema.parse(data);
    case 'place':
      return PlaceEntitySchema.parse(data);
    case 'text':
      return TextEntitySchema.parse(data);
    case 'event':
      return EventEntitySchema.parse(data);
    case 'concept':
      return ConceptEntitySchema.parse(data);
    case 'institution':
      return InstitutionEntitySchema.parse(data);
    case 'deity':
      return DeityEntitySchema.parse(data);
    case 'lineage':
      return LineageEntitySchema.parse(data);
    default:
      throw new Error(`Unknown entity type: ${baseData?.type}`);
  }
}

/**
 * Validate a relationship
 */
export function validateRelationship(data: unknown): RelationshipInput {
  return RelationshipSchema.parse(data);
}

/**
 * Validate an extraction result
 */
export function validateExtractionResult(data: unknown): ExtractionResultInput {
  return ExtractionResultSchema.parse(data);
}

/**
 * Safe parse that returns result or error without throwing
 */
export function safeValidateEntity(data: unknown) {
  try {
    return { success: true as const, data: validateEntity(data) };
  } catch (error) {
    return { success: false as const, error };
  }
}

/**
 * Validate an event extraction result
 */
export function validateEventExtractionResult(data: unknown): EventExtractionResultInput {
  return EventExtractionResultSchema.parse(data);
}

/**
 * Safe validate event extraction result without throwing
 */
export function safeValidateEventExtraction(data: unknown) {
  try {
    return { success: true as const, data: validateEventExtractionResult(data) };
  } catch (error) {
    return { success: false as const, error };
  }
}
