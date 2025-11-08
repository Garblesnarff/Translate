/**
 * Neo4j Relationship Schema Definitions
 *
 * Defines all 43 relationship types (26 predicates + inverse relationships)
 * for the Tibetan Buddhist Knowledge Graph.
 *
 * Design Decisions:
 * - All relationships are directed with clear subject → object semantics
 * - Bidirectional pairs (teacher_of ↔ student_of) are stored as separate edges
 * - Confidence scores on all relationships
 * - Temporal properties (dates, durations) on relationships where applicable
 * - Source tracking for traceability
 *
 * Phase 4, Task 4.2: Graph Schema Design
 */

import type { PredicateType, EntityType } from '../types/entities';

// ============================================================================
// Relationship Schema Interfaces
// ============================================================================

export interface RelationshipPropertyDefinition {
  type: 'string' | 'integer' | 'float' | 'boolean' | 'datetime' | 'string[]' | 'json';
  required: boolean;
  indexed?: boolean;
  description: string;
  constraints?: {
    min?: number;
    max?: number;
    enum?: string[];
  };
}

export interface RelationshipTypeSchema {
  type: PredicateType;
  description: string;
  subjectTypes: EntityType[];
  objectTypes: EntityType[];
  properties: Record<string, RelationshipPropertyDefinition>;
  bidirectional: boolean;
  inversePredicate?: PredicateType;
  symmetric?: boolean; // True for relationships like sibling_of where A→B implies B→A with same predicate
  examples: string[];
}

// ============================================================================
// Base Relationship Properties (Common to All Relationship Types)
// ============================================================================

export const BaseRelationshipProperties: Record<string, RelationshipPropertyDefinition> = {
  id: {
    type: 'string',
    required: true,
    indexed: true,
    description: 'Unique UUID for this relationship'
  },
  confidence: {
    type: 'float',
    required: true,
    indexed: true,
    description: 'Confidence score for this relationship (0.0-1.0)',
    constraints: {
      min: 0.0,
      max: 1.0
    }
  },
  verified: {
    type: 'boolean',
    required: true,
    indexed: true,
    description: 'Whether this relationship has been verified by a human expert'
  },
  source_document_id: {
    type: 'string',
    required: false,
    indexed: true,
    description: 'Translation ID where this relationship was extracted'
  },
  source_page: {
    type: 'string',
    required: false,
    description: 'Page number where relationship is mentioned'
  },
  source_quote: {
    type: 'string',
    required: false,
    description: 'Exact text excerpt showing this relationship'
  },
  extraction_method: {
    type: 'string',
    required: true,
    indexed: true,
    description: 'How this relationship was extracted (pattern, llm, manual)',
    constraints: {
      enum: ['pattern', 'llm', 'manual', 'inferred']
    }
  },
  created_at: {
    type: 'datetime',
    required: true,
    indexed: true,
    description: 'When this relationship was created'
  },
  updated_at: {
    type: 'datetime',
    required: true,
    description: 'When this relationship was last updated'
  },
  created_by: {
    type: 'string',
    required: true,
    description: 'User ID or "ai" who created this relationship'
  },
  verified_by: {
    type: 'string',
    required: false,
    description: 'User ID who verified this relationship'
  },
  verified_at: {
    type: 'datetime',
    required: false,
    description: 'When this relationship was verified'
  },
  notes: {
    type: 'string',
    required: false,
    description: 'Additional notes about this relationship'
  }
};

// ============================================================================
// Teacher-Student Relationships
// ============================================================================

export const TeacherOfSchema: RelationshipTypeSchema = {
  type: 'teacher_of',
  description: 'One person taught another person',
  subjectTypes: ['person'],
  objectTypes: ['person'],
  bidirectional: true,
  inversePredicate: 'student_of',
  properties: {
    ...BaseRelationshipProperties,
    teaching_type: {
      type: 'string',
      required: false,
      description: 'Type of teaching (empowerment, transmission, instruction, ordination)',
      constraints: {
        enum: ['empowerment', 'transmission', 'instruction', 'ordination', 'debate_training', 'ritual']
      }
    },
    teaching_subject: {
      type: 'string',
      required: false,
      description: 'What was taught (text name, practice, subject)'
    },
    start_year: {
      type: 'integer',
      required: false,
      indexed: true,
      description: 'Year teaching relationship began'
    },
    end_year: {
      type: 'integer',
      required: false,
      description: 'Year teaching relationship ended'
    },
    location_id: {
      type: 'string',
      required: false,
      indexed: true,
      description: 'Place ID where teaching occurred'
    },
    duration: {
      type: 'string',
      required: false,
      description: 'Duration of teaching (e.g., "3 years", "6 months")'
    }
  },
  examples: [
    'Marpa teacher_of Milarepa',
    'Tsongkhapa teacher_of Gyaltsab Je',
    'Sakya Pandita teacher_of Phagpa'
  ]
};

export const StudentOfSchema: RelationshipTypeSchema = {
  type: 'student_of',
  description: 'One person studied under another person',
  subjectTypes: ['person'],
  objectTypes: ['person'],
  bidirectional: true,
  inversePredicate: 'teacher_of',
  properties: TeacherOfSchema.properties,
  examples: [
    'Milarepa student_of Marpa',
    'Gyaltsab Je student_of Tsongkhapa'
  ]
};

// ============================================================================
// Incarnation Relationships
// ============================================================================

export const IncarnationOfSchema: RelationshipTypeSchema = {
  type: 'incarnation_of',
  description: 'One person is recognized as the incarnation/reincarnation of another',
  subjectTypes: ['person'],
  objectTypes: ['person'],
  bidirectional: false,
  properties: {
    ...BaseRelationshipProperties,
    recognition_year: {
      type: 'integer',
      required: false,
      indexed: true,
      description: 'Year the incarnation was recognized'
    },
    recognized_by: {
      type: 'string',
      required: false,
      description: 'Person ID who recognized the incarnation'
    },
    incarnation_number: {
      type: 'integer',
      required: false,
      description: 'Position in incarnation line (e.g., 14 for 14th Dalai Lama)'
    },
    lineage_id: {
      type: 'string',
      required: false,
      indexed: true,
      description: 'Lineage entity ID for this incarnation line'
    }
  },
  examples: [
    '14th Dalai Lama incarnation_of 13th Dalai Lama',
    '17th Karmapa incarnation_of 16th Karmapa'
  ]
};

// ============================================================================
// Authorship Relationships
// ============================================================================

export const WroteSchema: RelationshipTypeSchema = {
  type: 'wrote',
  description: 'Person authored a text',
  subjectTypes: ['person'],
  objectTypes: ['text'],
  bidirectional: false,
  properties: {
    ...BaseRelationshipProperties,
    composition_year: {
      type: 'integer',
      required: false,
      indexed: true,
      description: 'Year the text was composed'
    },
    location_id: {
      type: 'string',
      required: false,
      description: 'Place ID where text was written'
    },
    patron_id: {
      type: 'string',
      required: false,
      description: 'Person ID who sponsored the writing'
    },
    circumstances: {
      type: 'string',
      required: false,
      description: 'Circumstances under which text was written'
    }
  },
  examples: [
    'Longchenpa wrote Seven Treasuries',
    'Je Tsongkhapa wrote Great Treatise on the Stages of the Path'
  ]
};

export const TranslatedSchema: RelationshipTypeSchema = {
  type: 'translated',
  description: 'Person translated a text',
  subjectTypes: ['person'],
  objectTypes: ['text'],
  bidirectional: false,
  properties: {
    ...BaseRelationshipProperties,
    translation_year: {
      type: 'integer',
      required: false,
      indexed: true,
      description: 'Year the translation was completed'
    },
    from_language: {
      type: 'string',
      required: false,
      description: 'Source language'
    },
    to_language: {
      type: 'string',
      required: false,
      description: 'Target language'
    },
    collaborators: {
      type: 'string[]',
      required: false,
      description: 'Person IDs of co-translators'
    },
    location_id: {
      type: 'string',
      required: false,
      description: 'Place ID where translation occurred'
    }
  },
  examples: [
    'Marpa translated Hevajra Tantra',
    'Rinchen Zangpo translated many Sanskrit texts'
  ]
};

export const CompiledSchema: RelationshipTypeSchema = {
  type: 'compiled',
  description: 'Person compiled or edited a text from multiple sources',
  subjectTypes: ['person'],
  objectTypes: ['text'],
  bidirectional: false,
  properties: {
    ...BaseRelationshipProperties,
    compilation_year: {
      type: 'integer',
      required: false,
      indexed: true,
      description: 'Year the compilation was completed'
    },
    source_texts: {
      type: 'string[]',
      required: false,
      description: 'Text IDs of source materials'
    },
    location_id: {
      type: 'string',
      required: false,
      description: 'Place ID where compilation occurred'
    }
  },
  examples: [
    'Buton compiled Tengyur',
    'Longdol Lama compiled collected works'
  ]
};

// ============================================================================
// Spatial Relationships
// ============================================================================

export const LivedAtSchema: RelationshipTypeSchema = {
  type: 'lived_at',
  description: 'Person lived at a place or institution',
  subjectTypes: ['person'],
  objectTypes: ['place', 'institution'],
  bidirectional: false,
  properties: {
    ...BaseRelationshipProperties,
    start_year: {
      type: 'integer',
      required: false,
      indexed: true,
      description: 'Year person began living there'
    },
    end_year: {
      type: 'integer',
      required: false,
      description: 'Year person stopped living there'
    },
    duration: {
      type: 'string',
      required: false,
      description: 'How long they lived there'
    },
    role: {
      type: 'string',
      required: false,
      description: 'Role held while living there (abbot, monk, hermit, etc.)'
    }
  },
  examples: [
    'Milarepa lived_at various caves in Kham',
    'Tsongkhapa lived_at Ganden Monastery'
  ]
};

export const VisitedSchema: RelationshipTypeSchema = {
  type: 'visited',
  description: 'Person visited a place',
  subjectTypes: ['person'],
  objectTypes: ['place'],
  bidirectional: false,
  properties: {
    ...BaseRelationshipProperties,
    visit_year: {
      type: 'integer',
      required: false,
      indexed: true,
      description: 'Year of visit'
    },
    purpose: {
      type: 'string',
      required: false,
      description: 'Purpose of visit (pilgrimage, teaching, retreat, etc.)'
    },
    duration: {
      type: 'string',
      required: false,
      description: 'Length of stay'
    },
    companions: {
      type: 'string[]',
      required: false,
      description: 'Person IDs of traveling companions'
    }
  },
  examples: [
    'Atisha visited Tibet',
    'Padmasambhava visited Samye Monastery'
  ]
};

export const FoundedSchema: RelationshipTypeSchema = {
  type: 'founded',
  description: 'Person founded a place or institution',
  subjectTypes: ['person'],
  objectTypes: ['place', 'institution'],
  bidirectional: false,
  properties: {
    ...BaseRelationshipProperties,
    founding_year: {
      type: 'integer',
      required: false,
      indexed: true,
      description: 'Year of founding'
    },
    co_founders: {
      type: 'string[]',
      required: false,
      description: 'Person IDs of co-founders'
    },
    patron_id: {
      type: 'string',
      required: false,
      description: 'Person ID of patron who supported founding'
    },
    circumstances: {
      type: 'string',
      required: false,
      description: 'Historical context of founding'
    }
  },
  examples: [
    'Tsongkhapa founded Ganden Monastery',
    'Khon Konchok Gyalpo founded Sakya Monastery'
  ]
};

export const BornInSchema: RelationshipTypeSchema = {
  type: 'born_in',
  description: 'Person was born in a place',
  subjectTypes: ['person'],
  objectTypes: ['place'],
  bidirectional: false,
  properties: {
    ...BaseRelationshipProperties,
    birth_year: {
      type: 'integer',
      required: false,
      indexed: true,
      description: 'Year of birth'
    },
    exact_location: {
      type: 'string',
      required: false,
      description: 'More specific location within the place'
    }
  },
  examples: [
    'Milarepa born_in Gungthang',
    '14th Dalai Lama born_in Taktser'
  ]
};

export const DiedInSchema: RelationshipTypeSchema = {
  type: 'died_in',
  description: 'Person died in a place',
  subjectTypes: ['person'],
  objectTypes: ['place'],
  bidirectional: false,
  properties: {
    ...BaseRelationshipProperties,
    death_year: {
      type: 'integer',
      required: false,
      indexed: true,
      description: 'Year of death'
    },
    cause: {
      type: 'string',
      required: false,
      description: 'Cause or circumstances of death'
    }
  },
  examples: [
    'Tsongkhapa died_in Ganden Monastery',
    'Marpa died_in Lhodrak'
  ]
};

// ============================================================================
// Event Participation
// ============================================================================

export const AttendedSchema: RelationshipTypeSchema = {
  type: 'attended',
  description: 'Person attended an event',
  subjectTypes: ['person'],
  objectTypes: ['event'],
  bidirectional: false,
  properties: {
    ...BaseRelationshipProperties,
    role: {
      type: 'string',
      required: false,
      description: 'Role at event (participant, student, observer, etc.)'
    },
    received: {
      type: 'string[]',
      required: false,
      description: 'What was received (empowerments, transmissions, teachings)'
    }
  },
  examples: [
    'Milarepa attended teachings by Marpa',
    'Many lamas attended Great Prayer Festival'
  ]
};

export const OrganizedSchema: RelationshipTypeSchema = {
  type: 'organized',
  description: 'Person organized an event',
  subjectTypes: ['person'],
  objectTypes: ['event'],
  bidirectional: false,
  properties: {
    ...BaseRelationshipProperties,
    role: {
      type: 'string',
      required: false,
      description: 'Organizational role (chief organizer, sponsor, coordinator)'
    },
    co_organizers: {
      type: 'string[]',
      required: false,
      description: 'Person IDs of co-organizers'
    }
  },
  examples: [
    'Tsongkhapa organized Great Prayer Festival',
    'Sakya Pandita organized debate at Samye'
  ]
};

export const SponsoredSchema: RelationshipTypeSchema = {
  type: 'sponsored',
  description: 'Person sponsored an event, institution, or text production',
  subjectTypes: ['person'],
  objectTypes: ['event', 'institution', 'text'],
  bidirectional: false,
  properties: {
    ...BaseRelationshipProperties,
    sponsorship_year: {
      type: 'integer',
      required: false,
      indexed: true,
      description: 'Year of sponsorship'
    },
    sponsorship_type: {
      type: 'string',
      required: false,
      description: 'Type of support (financial, material, political)'
    },
    amount: {
      type: 'string',
      required: false,
      description: 'Amount or extent of sponsorship'
    }
  },
  examples: [
    'King Trisong Detsen sponsored construction of Samye',
    'Patron sponsored printing of Kangyur'
  ]
};

// ============================================================================
// Institutional Relationships
// ============================================================================

export const MemberOfSchema: RelationshipTypeSchema = {
  type: 'member_of',
  description: 'Person was a member of an institution',
  subjectTypes: ['person'],
  objectTypes: ['institution'],
  bidirectional: false,
  properties: {
    ...BaseRelationshipProperties,
    start_year: {
      type: 'integer',
      required: false,
      indexed: true,
      description: 'Year membership began'
    },
    end_year: {
      type: 'integer',
      required: false,
      description: 'Year membership ended'
    },
    role: {
      type: 'string',
      required: false,
      description: 'Role within institution (monk, scholar, administrator)'
    },
    rank: {
      type: 'string',
      required: false,
      description: 'Rank or position held'
    }
  },
  examples: [
    'Gyaltsab Je member_of Ganden Monastery',
    'Sakya Pandita member_of Sakya Monastery'
  ]
};

export const AbbotOfSchema: RelationshipTypeSchema = {
  type: 'abbot_of',
  description: 'Person served as abbot of an institution',
  subjectTypes: ['person'],
  objectTypes: ['institution'],
  bidirectional: false,
  properties: {
    ...BaseRelationshipProperties,
    start_year: {
      type: 'integer',
      required: false,
      indexed: true,
      description: 'Year abbacy began'
    },
    end_year: {
      type: 'integer',
      required: false,
      description: 'Year abbacy ended'
    },
    term_number: {
      type: 'integer',
      required: false,
      description: 'Which term (if multiple terms)'
    },
    accomplishments: {
      type: 'string[]',
      required: false,
      description: 'Major accomplishments during tenure'
    }
  },
  examples: [
    'Gyaltsab Je abbot_of Ganden Monastery',
    'Sakya Pandita abbot_of Sakya Monastery'
  ]
};

export const PatronOfSchema: RelationshipTypeSchema = {
  type: 'patron_of',
  description: 'Person acted as patron of another person, institution, or text',
  subjectTypes: ['person'],
  objectTypes: ['person', 'institution', 'text'],
  bidirectional: false,
  properties: {
    ...BaseRelationshipProperties,
    start_year: {
      type: 'integer',
      required: false,
      indexed: true,
      description: 'Year patronage began'
    },
    end_year: {
      type: 'integer',
      required: false,
      description: 'Year patronage ended'
    },
    support_type: {
      type: 'string[]',
      required: false,
      description: 'Types of support provided (financial, political, material)'
    }
  },
  examples: [
    'Kublai Khan patron_of Phagpa',
    'King Trisong Detsen patron_of Padmasambhava'
  ]
};

// ============================================================================
// Textual Relationships
// ============================================================================

export const CommentaryOnSchema: RelationshipTypeSchema = {
  type: 'commentary_on',
  description: 'One text is a commentary on another text',
  subjectTypes: ['text'],
  objectTypes: ['text'],
  bidirectional: false,
  properties: {
    ...BaseRelationshipProperties,
    commentary_type: {
      type: 'string',
      required: false,
      description: 'Type of commentary (word commentary, explanatory, annotated)',
      constraints: {
        enum: ['word_commentary', 'explanatory', 'annotated', 'summary', 'expansion']
      }
    },
    sections_covered: {
      type: 'string[]',
      required: false,
      description: 'Which sections of root text are covered'
    }
  },
  examples: [
    'Tsongkhapa\'s Great Treatise commentary_on Atisha\'s Lamp for the Path',
    'Chandrakirti\'s Clear Words commentary_on Nagarjuna\'s Root Verses'
  ]
};

export const CitesSchema: RelationshipTypeSchema = {
  type: 'cites',
  description: 'One text cites another text',
  subjectTypes: ['text'],
  objectTypes: ['text'],
  bidirectional: false,
  properties: {
    ...BaseRelationshipProperties,
    citation_count: {
      type: 'integer',
      required: false,
      description: 'Number of times cited'
    },
    citation_context: {
      type: 'string',
      required: false,
      description: 'Purpose of citation (support, refutation, explanation)'
    }
  },
  examples: [
    'Je Tsongkhapa\'s works cite Nagarjuna extensively',
    'Modern commentaries cite classical texts'
  ]
};

export const PartOfSchema: RelationshipTypeSchema = {
  type: 'part_of',
  description: 'One entity is part of another (text in collection, place within region)',
  subjectTypes: ['text', 'place'],
  objectTypes: ['text', 'place'],
  bidirectional: false,
  properties: {
    ...BaseRelationshipProperties,
    volume_number: {
      type: 'integer',
      required: false,
      description: 'Volume number if part of a collection'
    },
    section: {
      type: 'string',
      required: false,
      description: 'Which section or subdivision'
    }
  },
  examples: [
    'Heart Sutra part_of Prajnaparamita collection',
    'Samye part_of Ü-Tsang region'
  ]
};

export const ContainsSchema: RelationshipTypeSchema = {
  type: 'contains',
  description: 'One entity contains another (inverse of part_of)',
  subjectTypes: ['text', 'place'],
  objectTypes: ['text', 'place'],
  bidirectional: false,
  properties: PartOfSchema.properties,
  examples: [
    'Kangyur contains many sutras',
    'Lhasa contains Jokhang Temple'
  ]
};

export const MentionsSchema: RelationshipTypeSchema = {
  type: 'mentions',
  description: 'Text mentions a person, place, event, concept, or deity',
  subjectTypes: ['text'],
  objectTypes: ['person', 'place', 'event', 'concept', 'deity'],
  bidirectional: false,
  properties: {
    ...BaseRelationshipProperties,
    mention_count: {
      type: 'integer',
      required: false,
      description: 'Number of times mentioned'
    },
    context: {
      type: 'string',
      required: false,
      description: 'Context in which mentioned'
    },
    prominence: {
      type: 'string',
      required: false,
      description: 'How prominently featured (main_topic, supporting, passing_reference)',
      constraints: {
        enum: ['main_topic', 'supporting', 'passing_reference']
      }
    }
  },
  examples: [
    'Biography mentions Milarepa',
    'Tantra mentions Vajrayogini'
  ]
};

// ============================================================================
// Transmission Relationships
// ============================================================================

export const ReceivedTransmissionSchema: RelationshipTypeSchema = {
  type: 'received_transmission',
  description: 'Person received a transmission from another person',
  subjectTypes: ['person'],
  objectTypes: ['person'],
  bidirectional: false,
  properties: {
    ...BaseRelationshipProperties,
    transmission_type: {
      type: 'string',
      required: false,
      description: 'Type of transmission (lung, wang, tri)',
      constraints: {
        enum: ['lung', 'wang', 'tri', 'lineage']
      }
    },
    teaching_name: {
      type: 'string',
      required: false,
      description: 'Name of teaching transmitted'
    },
    text_id: {
      type: 'string',
      required: false,
      indexed: true,
      description: 'Text ID if transmission relates to a text'
    },
    transmission_year: {
      type: 'integer',
      required: false,
      indexed: true,
      description: 'Year transmission occurred'
    },
    location_id: {
      type: 'string',
      required: false,
      description: 'Place ID where transmission occurred'
    }
  },
  examples: [
    'Milarepa received_transmission from Marpa',
    'Tsongkhapa received_transmission from Rendawa'
  ]
};

export const GaveEmpowermentSchema: RelationshipTypeSchema = {
  type: 'gave_empowerment',
  description: 'Person gave an empowerment to another person',
  subjectTypes: ['person'],
  objectTypes: ['person'],
  bidirectional: false,
  properties: ReceivedTransmissionSchema.properties,
  examples: [
    'Marpa gave_empowerment to Milarepa',
    'Sakya Pandita gave_empowerment to Phagpa'
  ]
};

export const TransmittedToSchema: RelationshipTypeSchema = {
  type: 'transmitted_to',
  description: 'Person transmitted teachings to another person',
  subjectTypes: ['person'],
  objectTypes: ['person'],
  bidirectional: false,
  properties: ReceivedTransmissionSchema.properties,
  examples: [
    'Atisha transmitted_to Dromtonpa',
    'Padmasambhava transmitted_to Yeshe Tsogyal'
  ]
};

// ============================================================================
// Debate Relationships
// ============================================================================

export const DebatedWithSchema: RelationshipTypeSchema = {
  type: 'debated_with',
  description: 'Person engaged in philosophical debate with another person',
  subjectTypes: ['person'],
  objectTypes: ['person'],
  bidirectional: true,
  inversePredicate: 'debated_with',
  symmetric: true,
  properties: {
    ...BaseRelationshipProperties,
    debate_year: {
      type: 'integer',
      required: false,
      indexed: true,
      description: 'Year debate occurred'
    },
    topic: {
      type: 'string',
      required: false,
      description: 'Subject of debate'
    },
    location_id: {
      type: 'string',
      required: false,
      description: 'Place ID where debate occurred'
    },
    outcome: {
      type: 'string',
      required: false,
      description: 'Result of debate if known'
    }
  },
  examples: [
    'Sakya Pandita debated_with various scholars',
    'Tsongkhapa debated_with Rendawa'
  ]
};

export const RefutedSchema: RelationshipTypeSchema = {
  type: 'refuted',
  description: 'Person or text refuted a concept or text',
  subjectTypes: ['person', 'text'],
  objectTypes: ['concept', 'text'],
  bidirectional: false,
  properties: {
    ...BaseRelationshipProperties,
    refutation_basis: {
      type: 'string',
      required: false,
      description: 'Grounds for refutation (logic, scripture, experience)'
    },
    text_id: {
      type: 'string',
      required: false,
      description: 'Text ID where refutation appears'
    }
  },
  examples: [
    'Tsongkhapa refuted certain Madhyamaka interpretations',
    'Chandrakirti refuted Svatantrika views'
  ]
};

export const AgreedWithSchema: RelationshipTypeSchema = {
  type: 'agreed_with',
  description: 'Person agreed with another person or concept',
  subjectTypes: ['person'],
  objectTypes: ['person', 'concept'],
  bidirectional: false,
  properties: {
    ...BaseRelationshipProperties,
    agreement_scope: {
      type: 'string',
      required: false,
      description: 'Extent of agreement (full, partial, conditional)'
    },
    text_id: {
      type: 'string',
      required: false,
      description: 'Text ID where agreement is expressed'
    }
  },
  examples: [
    'Tsongkhapa agreed_with Nagarjuna on emptiness',
    'Many scholars agreed_with Madhyamaka view'
  ]
};

// ============================================================================
// Family Relationships
// ============================================================================

export const ParentOfSchema: RelationshipTypeSchema = {
  type: 'parent_of',
  description: 'Person is parent of another person',
  subjectTypes: ['person'],
  objectTypes: ['person'],
  bidirectional: true,
  inversePredicate: 'child_of',
  properties: {
    ...BaseRelationshipProperties,
    relationship_type: {
      type: 'string',
      required: false,
      description: 'Type of parent (father, mother, adoptive)',
      constraints: {
        enum: ['father', 'mother', 'adoptive_father', 'adoptive_mother']
      }
    }
  },
  examples: [
    'Marpa parent_of [Marpa\'s children]',
    'Khon Konchok Gyalpo parent_of Khon Konchok Bar'
  ]
};

export const ChildOfSchema: RelationshipTypeSchema = {
  type: 'child_of',
  description: 'Person is child of another person',
  subjectTypes: ['person'],
  objectTypes: ['person'],
  bidirectional: true,
  inversePredicate: 'parent_of',
  properties: ParentOfSchema.properties,
  examples: [
    'Milarepa child_of [Milarepa\'s parents]'
  ]
};

export const SiblingOfSchema: RelationshipTypeSchema = {
  type: 'sibling_of',
  description: 'Person is sibling of another person',
  subjectTypes: ['person'],
  objectTypes: ['person'],
  bidirectional: true,
  inversePredicate: 'sibling_of',
  symmetric: true,
  properties: {
    ...BaseRelationshipProperties,
    relationship_type: {
      type: 'string',
      required: false,
      description: 'Type of sibling (brother, sister, half-sibling)',
      constraints: {
        enum: ['brother', 'sister', 'half_brother', 'half_sister']
      }
    }
  },
  examples: [
    'Milarepa sibling_of Peta'
  ]
};

export const SpouseOfSchema: RelationshipTypeSchema = {
  type: 'spouse_of',
  description: 'Person is married to another person',
  subjectTypes: ['person'],
  objectTypes: ['person'],
  bidirectional: true,
  inversePredicate: 'spouse_of',
  symmetric: true,
  properties: {
    ...BaseRelationshipProperties,
    marriage_year: {
      type: 'integer',
      required: false,
      indexed: true,
      description: 'Year of marriage'
    },
    divorce_year: {
      type: 'integer',
      required: false,
      description: 'Year of divorce if applicable'
    }
  },
  examples: [
    'Marpa spouse_of Dagmema',
    'King Songtsen Gampo spouse_of Princess Wencheng'
  ]
};

// ============================================================================
// Geographic Relationships
// ============================================================================

export const WithinSchema: RelationshipTypeSchema = {
  type: 'within',
  description: 'Place is geographically within another place',
  subjectTypes: ['place'],
  objectTypes: ['place'],
  bidirectional: false,
  properties: {
    ...BaseRelationshipProperties,
    administrative_level: {
      type: 'string',
      required: false,
      description: 'Administrative relationship (district, province, region)'
    }
  },
  examples: [
    'Samye Monastery within Ü-Tsang',
    'Lhasa within Tibet'
  ]
};

export const NearSchema: RelationshipTypeSchema = {
  type: 'near',
  description: 'Place is near another place',
  subjectTypes: ['place'],
  objectTypes: ['place'],
  bidirectional: true,
  inversePredicate: 'near',
  symmetric: true,
  properties: {
    ...BaseRelationshipProperties,
    distance: {
      type: 'string',
      required: false,
      description: 'Approximate distance between places'
    },
    direction: {
      type: 'string',
      required: false,
      description: 'Direction (north, south, east, west, northeast, etc.)'
    }
  },
  examples: [
    'Sera Monastery near Drepung Monastery',
    'Ganden near Lhasa'
  ]
};

// ============================================================================
// Conceptual Relationships
// ============================================================================

export const PracticedSchema: RelationshipTypeSchema = {
  type: 'practiced',
  description: 'Person practiced a concept/meditation',
  subjectTypes: ['person'],
  objectTypes: ['concept'],
  bidirectional: false,
  properties: {
    ...BaseRelationshipProperties,
    start_year: {
      type: 'integer',
      required: false,
      description: 'Year practice began'
    },
    duration: {
      type: 'string',
      required: false,
      description: 'Duration of practice'
    },
    location_id: {
      type: 'string',
      required: false,
      description: 'Place ID where practice occurred'
    },
    depth: {
      type: 'string',
      required: false,
      description: 'Depth of practice (beginner, intermediate, mastery)',
      constraints: {
        enum: ['beginner', 'intermediate', 'advanced', 'mastery']
      }
    }
  },
  examples: [
    'Milarepa practiced tummo',
    'Tsongkhapa practiced Madhyamaka meditation'
  ]
};

export const HeldViewSchema: RelationshipTypeSchema = {
  type: 'held_view',
  description: 'Person held a particular philosophical view',
  subjectTypes: ['person'],
  objectTypes: ['concept'],
  bidirectional: false,
  properties: {
    ...BaseRelationshipProperties,
    conviction: {
      type: 'string',
      required: false,
      description: 'Strength of conviction (tentative, moderate, strong)',
      constraints: {
        enum: ['tentative', 'moderate', 'strong']
      }
    },
    text_id: {
      type: 'string',
      required: false,
      description: 'Text ID where view is expressed'
    }
  },
  examples: [
    'Tsongkhapa held_view Prasangika Madhyamaka',
    'Sakya Pandita held_view certain epistemological positions'
  ]
};

export const TaughtConceptSchema: RelationshipTypeSchema = {
  type: 'taught_concept',
  description: 'Person taught a particular concept',
  subjectTypes: ['person'],
  objectTypes: ['concept'],
  bidirectional: false,
  properties: {
    ...BaseRelationshipProperties,
    teaching_year: {
      type: 'integer',
      required: false,
      indexed: true,
      description: 'Year teaching occurred'
    },
    location_id: {
      type: 'string',
      required: false,
      description: 'Place ID where teaching occurred'
    },
    audience_size: {
      type: 'integer',
      required: false,
      description: 'Approximate number of students'
    }
  },
  examples: [
    'Atisha taught_concept Bodhicitta',
    'Tsongkhapa taught_concept Lamrim'
  ]
};

// ============================================================================
// Temporal Relationships
// ============================================================================

export const PrecededSchema: RelationshipTypeSchema = {
  type: 'preceded',
  description: 'One event preceded another event',
  subjectTypes: ['event'],
  objectTypes: ['event'],
  bidirectional: false,
  properties: {
    ...BaseRelationshipProperties,
    time_gap: {
      type: 'string',
      required: false,
      description: 'Time between events'
    },
    causal: {
      type: 'boolean',
      required: false,
      description: 'Whether first event caused or influenced second'
    }
  },
  examples: [
    'Samye construction preceded Great Translation period',
    'Debate at Samye preceded establishment of Buddhism'
  ]
};

export const FollowedSchema: RelationshipTypeSchema = {
  type: 'followed',
  description: 'One event followed another event',
  subjectTypes: ['event'],
  objectTypes: ['event'],
  bidirectional: false,
  properties: PrecededSchema.properties,
  examples: [
    'Great Translation period followed Samye construction'
  ]
};

export const ContemporaryWithSchema: RelationshipTypeSchema = {
  type: 'contemporary_with',
  description: 'Two people lived at the same time',
  subjectTypes: ['person'],
  objectTypes: ['person'],
  bidirectional: true,
  inversePredicate: 'contemporary_with',
  symmetric: true,
  properties: {
    ...BaseRelationshipProperties,
    overlap_start: {
      type: 'integer',
      required: false,
      description: 'Year their lifetimes began overlapping'
    },
    overlap_end: {
      type: 'integer',
      required: false,
      description: 'Year their lifetimes stopped overlapping'
    },
    met: {
      type: 'boolean',
      required: false,
      description: 'Whether they actually met'
    }
  },
  examples: [
    'Tsongkhapa contemporary_with Rendawa',
    'Sakya Pandita contemporary_with Phagpa'
  ]
};

// ============================================================================
// Relationship Schema Registry
// ============================================================================

export const RelationshipSchemas: Record<PredicateType, RelationshipTypeSchema> = {
  teacher_of: TeacherOfSchema,
  student_of: StudentOfSchema,
  incarnation_of: IncarnationOfSchema,
  wrote: WroteSchema,
  translated: TranslatedSchema,
  compiled: CompiledSchema,
  lived_at: LivedAtSchema,
  visited: VisitedSchema,
  founded: FoundedSchema,
  born_in: BornInSchema,
  died_in: DiedInSchema,
  attended: AttendedSchema,
  organized: OrganizedSchema,
  sponsored: SponsoredSchema,
  member_of: MemberOfSchema,
  abbot_of: AbbotOfSchema,
  patron_of: PatronOfSchema,
  commentary_on: CommentaryOnSchema,
  cites: CitesSchema,
  part_of: PartOfSchema,
  contains: ContainsSchema,
  mentions: MentionsSchema,
  received_transmission: ReceivedTransmissionSchema,
  gave_empowerment: GaveEmpowermentSchema,
  transmitted_to: TransmittedToSchema,
  debated_with: DebatedWithSchema,
  refuted: RefutedSchema,
  agreed_with: AgreedWithSchema,
  parent_of: ParentOfSchema,
  child_of: ChildOfSchema,
  sibling_of: SiblingOfSchema,
  spouse_of: SpouseOfSchema,
  within: WithinSchema,
  near: NearSchema,
  practiced: PracticedSchema,
  held_view: HeldViewSchema,
  taught_concept: TaughtConceptSchema,
  preceded: PrecededSchema,
  followed: FollowedSchema,
  contemporary_with: ContemporaryWithSchema
};

/**
 * Get schema for a specific relationship type
 */
export function getRelationshipSchema(predicate: PredicateType): RelationshipTypeSchema {
  return RelationshipSchemas[predicate];
}

/**
 * Check if relationship type is bidirectional
 */
export function isBidirectional(predicate: PredicateType): boolean {
  return RelationshipSchemas[predicate].bidirectional;
}

/**
 * Get inverse predicate for bidirectional relationships
 */
export function getInversePredicate(predicate: PredicateType): PredicateType | null {
  const schema = RelationshipSchemas[predicate];
  return schema.inversePredicate || null;
}

/**
 * Validate that subject and object types are allowed for this relationship
 */
export function validateRelationshipTypes(
  predicate: PredicateType,
  subjectType: EntityType,
  objectType: EntityType
): { valid: boolean; error?: string } {
  const schema = RelationshipSchemas[predicate];

  if (!schema.subjectTypes.includes(subjectType)) {
    return {
      valid: false,
      error: `Invalid subject type ${subjectType} for relationship ${predicate}. Expected: ${schema.subjectTypes.join(', ')}`
    };
  }

  if (!schema.objectTypes.includes(objectType)) {
    return {
      valid: false,
      error: `Invalid object type ${objectType} for relationship ${predicate}. Expected: ${schema.objectTypes.join(', ')}`
    };
  }

  return { valid: true };
}
