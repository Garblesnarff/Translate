# Phase 0: Foundation

**Goal**: Extend existing translation system to support entity extraction and storage

**Duration**: 2 weeks (10 work days)

**Prerequisites**:
- V2 translation system complete and working
- PostgreSQL database operational
- Existing API endpoints functional

**Deliverables**:
- ✅ Database schema extended with entity tables
- ✅ Basic extraction service integrated
- ✅ API endpoints for entity CRUD operations
- ✅ Simple extraction test working on one document
- ✅ Source provenance tracking functional

---

## Task Breakdown

### 0.1: Database Schema Design (2 days)

#### 0.1.1: Create entities table
**File**: `db/schema.ts` (extend existing)
**Time**: 2 hours

```sql
CREATE TABLE entities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type VARCHAR(50) NOT NULL, -- person, place, text, event, lineage, concept, institution
  canonical_name VARCHAR(500) NOT NULL,
  names JSONB NOT NULL, -- {tibetan: [], english: [], phonetic: [], wylie: []}
  attributes JSONB NOT NULL DEFAULT '{}', -- Flexible schema for type-specific data
  dates JSONB, -- {birth: {...}, death: {...}, founded: {...}, etc}
  confidence FLOAT DEFAULT 0.5 CHECK (confidence >= 0 AND confidence <= 1),
  verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by VARCHAR(100), -- 'ai' or user_id
  verified_by VARCHAR(100),
  verified_at TIMESTAMP
);

CREATE INDEX idx_entities_type ON entities(type);
CREATE INDEX idx_entities_confidence ON entities(confidence);
CREATE INDEX idx_entities_verified ON entities(verified);
CREATE INDEX idx_entities_canonical_name ON entities(canonical_name);
CREATE INDEX idx_entities_names_gin ON entities USING GIN (names);
```

**Acceptance Criteria**:
- [ ] Table created in both PostgreSQL and SQLite schemas
- [ ] All indexes created
- [ ] Migration script runs without errors
- [ ] TypeScript types generated from schema

---

#### 0.1.2: Create relationships table
**File**: `db/schema.ts`
**Time**: 2 hours

```sql
CREATE TABLE relationships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  predicate VARCHAR(100) NOT NULL, -- teacher_of, student_of, wrote, lived_at, etc
  object_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  properties JSONB DEFAULT '{}', -- {date: {...}, location: '...', teaching: '...'}
  confidence FLOAT DEFAULT 0.5 CHECK (confidence >= 0 AND confidence <= 1),
  verified BOOLEAN DEFAULT FALSE,
  source_document_id UUID REFERENCES translations(id),
  source_page VARCHAR(50),
  source_quote TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by VARCHAR(100),
  verified_by VARCHAR(100),
  verified_at TIMESTAMP
);

CREATE INDEX idx_relationships_subject ON relationships(subject_id);
CREATE INDEX idx_relationships_object ON relationships(object_id);
CREATE INDEX idx_relationships_predicate ON relationships(predicate);
CREATE INDEX idx_relationships_verified ON relationships(verified);
CREATE INDEX idx_relationships_confidence ON relationships(confidence);
CREATE INDEX idx_relationships_source ON relationships(source_document_id);

-- Composite indexes for common queries
CREATE INDEX idx_rel_subject_predicate ON relationships(subject_id, predicate);
CREATE INDEX idx_rel_object_predicate ON relationships(object_id, predicate);
```

**Acceptance Criteria**:
- [ ] Table created with foreign key constraints
- [ ] All indexes created
- [ ] Cascading deletes configured
- [ ] TypeScript types generated

---

#### 0.1.3: Create lineages table
**File**: `db/schema.ts`
**Time**: 1 hour

```sql
CREATE TABLE lineages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(500) NOT NULL,
  tibetan_name VARCHAR(500),
  type VARCHAR(50) NOT NULL, -- incarnation, transmission, ordination, family, institutional
  tradition VARCHAR(100), -- Nyingma, Kagyu, Sakya, Gelug, Bon, Rimé
  teaching VARCHAR(500), -- What's being transmitted
  origin_text_id UUID REFERENCES entities(id),
  origin_date JSONB, -- {year: ..., precision: '...'}
  chain JSONB NOT NULL DEFAULT '[]', -- [{position: 1, person_id: '...', date: {...}}, ...]
  branches JSONB DEFAULT '[]', -- [lineage_id_1, lineage_id_2]
  sources JSONB DEFAULT '[]',
  confidence FLOAT DEFAULT 0.5,
  verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_lineages_type ON lineages(type);
CREATE INDEX idx_lineages_tradition ON lineages(tradition);
CREATE INDEX idx_lineages_verified ON lineages(verified);
```

**Acceptance Criteria**:
- [ ] Table created
- [ ] JSONB fields properly structured
- [ ] TypeScript types with proper JSONB type safety

---

#### 0.1.4: Create extraction_jobs table
**File**: `db/schema.ts`
**Time**: 1 hour

```sql
CREATE TABLE extraction_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  translation_id UUID NOT NULL REFERENCES translations(id),
  status VARCHAR(50) DEFAULT 'pending', -- pending, processing, completed, failed
  entities_extracted INTEGER DEFAULT 0,
  relationships_extracted INTEGER DEFAULT 0,
  confidence_avg FLOAT,
  error_message TEXT,
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_extraction_jobs_status ON extraction_jobs(status);
CREATE INDEX idx_extraction_jobs_translation ON extraction_jobs(translation_id);
```

**Acceptance Criteria**:
- [ ] Table created
- [ ] Status field uses enum or constrained values
- [ ] Progress tracking fields functional

---

#### 0.1.5: Run migrations
**File**: `server/scripts/runMigrations.ts` (create new)
**Time**: 2 hours

```typescript
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import { config } from '../core/config';

async function runMigrations() {
  const pool = new Pool({
    connectionString: config.database.url
  });

  const db = drizzle(pool);

  console.log('Running knowledge graph migrations...');
  await migrate(db, { migrationsFolder: './migrations-knowledge-graph' });
  console.log('Migrations complete!');

  await pool.end();
}

runMigrations().catch(console.error);
```

**Tasks**:
- [ ] Create migration files for all new tables
- [ ] Test migrations on SQLite (local dev)
- [ ] Test migrations on PostgreSQL (production)
- [ ] Add rollback scripts
- [ ] Update package.json with migration commands

**Acceptance Criteria**:
- [ ] `npm run migrate:kg` runs all knowledge graph migrations
- [ ] Migrations are idempotent (can run multiple times)
- [ ] Rollback scripts tested and working

---

### 0.2: TypeScript Type Definitions (1 day)

#### 0.2.1: Define core entity types
**File**: `server/types/entities.ts` (create new)
**Time**: 3 hours

```typescript
// Base types
export type EntityType =
  | 'person'
  | 'place'
  | 'text'
  | 'event'
  | 'lineage'
  | 'concept'
  | 'institution'
  | 'deity';

export type PredicateType =
  | 'teacher_of'
  | 'student_of'
  | 'incarnation_of'
  | 'wrote'
  | 'translated'
  | 'lived_at'
  | 'visited'
  | 'attended'
  | 'founded'
  | 'member_of'
  | 'part_of'
  | 'commentary_on'
  | 'cites'
  | 'mentions';

export interface NameVariants {
  tibetan: string[];
  english: string[];
  phonetic: string[];
  wylie: string[];
  sanskrit?: string[];
  chinese?: string[];
}

export interface DateInfo {
  year?: number; // Gregorian
  tibetanYear?: {
    rabjung: number;
    year: number;
    element: string; // wood, fire, earth, metal, water
    animal: string; // rat, ox, tiger, rabbit, dragon, snake, horse, sheep, monkey, bird, dog, pig
  };
  era?: string; // "during reign of...", "under X dynasty"
  relative?: string; // "after X died", "before Y was born"
  season?: 'spring' | 'summer' | 'fall' | 'winter';
  precision: 'exact' | 'circa' | 'estimated' | 'disputed' | 'unknown';
  source?: string;
  confidence: number;
}

export interface SourceReference {
  documentId: string;
  pageNumbers?: string[];
  chapterSection?: string;
  quotation?: string;
  extractedBy: 'human' | 'ai';
  extractionModel?: string; // e.g., "claude-3.5-sonnet"
  extractionConfidence: number;
  verifiedBy?: string;
  extractionDate: Date;
  notes?: string;
}

// Entity base interface
export interface Entity {
  id: string;
  type: EntityType;
  canonicalName: string;
  names: NameVariants;
  attributes: Record<string, any>; // Type-specific data
  dates?: {
    [key: string]: DateInfo; // birth, death, founded, dissolved, etc.
  };
  confidence: number;
  verified: boolean;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  verifiedBy?: string;
  verifiedAt?: Date;
}

// Specific entity types
export interface Person extends Entity {
  type: 'person';
  attributes: {
    titles?: string[];
    honorifics?: string[];
    epithets?: string[];
    roles?: string[]; // teacher, abbot, translator, poet, patron, scholar
    affiliations?: string[]; // monastery names, lineage names
    gender?: 'male' | 'female' | 'unknown';
    tradition?: string[]; // Nyingma, Kagyu, Sakya, Gelug, Bon
    biography?: string;
  };
  dates?: {
    birth?: DateInfo;
    death?: DateInfo;
    ordination?: DateInfo;
    enthronement?: DateInfo;
  };
}

export interface Place extends Entity {
  type: 'place';
  attributes: {
    placeType: 'monastery' | 'mountain' | 'cave' | 'city' | 'region' | 'country' | 'holy_site' | 'hermitage';
    coordinates?: {
      latitude: number;
      longitude: number;
      accuracy?: number; // meters
    };
    region?: string;
    modernCountry?: string;
    parent?: string; // Parent place ID (hierarchical)
    significance?: string[];
    description?: string;
  };
  dates?: {
    founded?: DateInfo;
    destroyed?: DateInfo;
    rebuilt?: DateInfo;
  };
}

export interface Text extends Entity {
  type: 'text';
  attributes: {
    textType: 'sutra' | 'tantra' | 'commentary' | 'biography' | 'poetry' | 'letters' | 'ritual' | 'philosophical_treatise' | 'history';
    language: string; // Tibetan, Sanskrit, Chinese, etc.
    volumeCount?: number;
    pageCount?: number;
    topics?: string[];
    practices?: string[];
    collectionId?: string; // If part of larger collection
    tibetanCanonSection?: string; // Kangyur, Tengyur section
  };
  dates?: {
    composed?: DateInfo;
    translated?: DateInfo;
    printed?: DateInfo;
  };
}

export interface Event extends Entity {
  type: 'event';
  attributes: {
    eventType: 'teaching' | 'empowerment' | 'debate' | 'founding' | 'pilgrimage' | 'retreat' | 'death' | 'birth' | 'transmission' | 'political' | 'natural_disaster' | 'meeting';
    location?: string; // Place ID
    duration?: string; // "3 days", "6 months", etc.
    significance?: string;
    description?: string;
    attendeeCount?: number;
  };
  dates?: {
    occurred?: DateInfo;
    started?: DateInfo;
    ended?: DateInfo;
  };
}

// Relationship type
export interface Relationship {
  id: string;
  subjectId: string;
  predicate: PredicateType;
  objectId: string;
  properties: {
    date?: DateInfo;
    location?: string; // Place ID
    teaching?: string;
    duration?: string;
    role?: string;
    notes?: string;
    [key: string]: any;
  };
  confidence: number;
  verified: boolean;
  sourceDocumentId?: string;
  sourcePage?: string;
  sourceQuote?: string;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  verifiedBy?: string;
  verifiedAt?: Date;
}

// Lineage type
export interface Lineage {
  id: string;
  name: string;
  tibetanName?: string;
  type: 'incarnation' | 'transmission' | 'ordination' | 'family' | 'institutional';
  tradition?: string;
  teaching?: string;
  originTextId?: string;
  originDate?: DateInfo;
  chain: LineageLink[];
  branches?: string[]; // Other lineage IDs
  sources: SourceReference[];
  confidence: number;
  verified: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface LineageLink {
  position: number;
  personId: string;
  receivedFrom?: string; // Person ID
  transmittedTo?: string[]; // Person IDs
  date?: DateInfo;
  location?: string; // Place ID
  eventId?: string;
  notes?: string;
}

// Extraction results
export interface ExtractionResult {
  entities: Entity[];
  relationships: Relationship[];
  lineages?: Lineage[];
  metadata: {
    documentId: string;
    extractionDate: Date;
    model: string;
    averageConfidence: number;
    processingTime: number; // milliseconds
  };
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
```

**Acceptance Criteria**:
- [ ] All types compile without errors
- [ ] Types match database schema
- [ ] Discriminated unions work correctly
- [ ] JSDoc comments added for complex types

---

#### 0.2.2: Create validation schemas
**File**: `server/validators/entities.ts` (create new)
**Time**: 2 hours

```typescript
import { z } from 'zod';

export const DateInfoSchema = z.object({
  year: z.number().optional(),
  tibetanYear: z.object({
    rabjung: z.number().min(1).max(17),
    year: z.number().min(1).max(60),
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
  chinese: z.array(z.string()).optional()
});

export const EntityBaseSchema = z.object({
  id: z.string().uuid().optional(),
  type: z.enum(['person', 'place', 'text', 'event', 'lineage', 'concept', 'institution', 'deity']),
  canonicalName: z.string().min(1).max(500),
  names: NameVariantsSchema,
  attributes: z.record(z.any()),
  dates: z.record(DateInfoSchema).optional(),
  confidence: z.number().min(0).max(1).default(0.5),
  verified: z.boolean().default(false),
  createdBy: z.string().default('ai')
});

export const PersonSchema = EntityBaseSchema.extend({
  type: z.literal('person'),
  attributes: z.object({
    titles: z.array(z.string()).optional(),
    honorifics: z.array(z.string()).optional(),
    epithets: z.array(z.string()).optional(),
    roles: z.array(z.string()).optional(),
    affiliations: z.array(z.string()).optional(),
    gender: z.enum(['male', 'female', 'unknown']).optional(),
    tradition: z.array(z.string()).optional(),
    biography: z.string().optional()
  })
});

export const RelationshipSchema = z.object({
  id: z.string().uuid().optional(),
  subjectId: z.string().uuid(),
  predicate: z.string().min(1).max(100),
  objectId: z.string().uuid(),
  properties: z.record(z.any()).default({}),
  confidence: z.number().min(0).max(1).default(0.5),
  verified: z.boolean().default(false),
  sourceDocumentId: z.string().uuid().optional(),
  sourcePage: z.string().optional(),
  sourceQuote: z.string().optional(),
  createdBy: z.string().default('ai')
});

// Export types from schemas
export type DateInfoInput = z.infer<typeof DateInfoSchema>;
export type NameVariantsInput = z.infer<typeof NameVariantsSchema>;
export type PersonInput = z.infer<typeof PersonSchema>;
export type RelationshipInput = z.infer<typeof RelationshipSchema>;
```

**Acceptance Criteria**:
- [ ] All schemas validate correct data
- [ ] Schemas reject invalid data with clear errors
- [ ] Default values work correctly
- [ ] Types inferred from schemas match entity types

---

### 0.3: Basic Extraction Service (3 days)

#### 0.3.1: Create extraction prompt template
**File**: `server/prompts/entityExtraction.ts` (create new)
**Time**: 4 hours

```typescript
export function buildEntityExtractionPrompt(
  translatedText: string,
  originalTibetan?: string,
  context?: {
    documentTitle?: string;
    pageNumber?: string;
    documentType?: string;
  }
): string {
  return `You are a specialized AI assistant for extracting structured historical knowledge from Tibetan Buddhist texts.

TASK: Extract all entities and relationships from the following text.

DOCUMENT CONTEXT:
${context?.documentTitle ? `Title: ${context.documentTitle}` : ''}
${context?.pageNumber ? `Page: ${context.pageNumber}` : ''}
${context?.documentType ? `Type: ${context.documentType}` : ''}

TEXT TO ANALYZE:
"""
${translatedText}
"""

${originalTibetan ? `ORIGINAL TIBETAN (for reference):\n${originalTibetan}\n` : ''}

EXTRACTION RULES:
1. Be conservative - only extract what is explicitly stated or strongly implied
2. Note ambiguities and uncertainties in confidence scores (0.0-1.0)
3. Preserve original Tibetan names when mentioned
4. Extract dates with precision indicators (exact, circa, estimated, disputed)
5. Link relationships to specific text passages (provide quote)
6. Distinguish between different entity types clearly

ENTITY TYPES TO EXTRACT:
- person: Teachers, students, translators, patrons, scholars, practitioners
- place: Monasteries, mountains, caves, regions, countries, holy sites
- text: Sutras, tantras, commentaries, biographies, letters, treatises
- event: Teachings, empowerments, debates, foundings, retreats, meetings

RELATIONSHIP TYPES TO EXTRACT:
- teacher_of / student_of
- incarnation_of
- wrote / translated
- lived_at / visited
- attended / founded
- member_of
- part_of (text collections)
- commentary_on / cites
- mentions

OUTPUT FORMAT (JSON):
{
  "entities": [
    {
      "type": "person",
      "canonicalName": "Primary name in English",
      "names": {
        "tibetan": ["མར་པ།"],
        "english": ["Marpa", "Marpa Lotsawa"],
        "phonetic": ["Mar-pa"],
        "wylie": ["mar pa"]
      },
      "attributes": {
        "titles": ["Lotsawa", "Translator"],
        "roles": ["translator", "teacher"],
        "tradition": ["Kagyu"]
      },
      "dates": {
        "birth": {
          "year": 1012,
          "precision": "estimated",
          "confidence": 0.8
        },
        "death": {
          "year": 1097,
          "precision": "estimated",
          "confidence": 0.8
        }
      },
      "confidence": 0.9,
      "extractionReason": "Explicitly named in text as 'the great translator Marpa'"
    }
  ],
  "relationships": [
    {
      "subjectId": "TEMP_ID_1",
      "subjectName": "Milarepa",
      "predicate": "student_of",
      "objectId": "TEMP_ID_2",
      "objectName": "Marpa",
      "properties": {
        "date": {
          "year": 1055,
          "precision": "circa",
          "confidence": 0.7
        },
        "location": "Lhodrak"
      },
      "confidence": 0.95,
      "sourceQuote": "Then I went to Lhodrak to meet the great translator Marpa...",
      "extractionReason": "Explicit statement of student-teacher relationship"
    }
  ],
  "ambiguities": [
    "Birth year of Marpa varies in sources (1012 or 1009)",
    "Location 'Lhodrak' could refer to region or specific monastery"
  ]
}

IMPORTANT:
- Use TEMP_ID_1, TEMP_ID_2, etc. for entity references in relationships
- Match temp IDs between entities and relationships arrays
- Provide sourceQuote showing where relationship was found
- Include extractionReason explaining your confidence score
- List ambiguities that human curators should review

Now extract all entities and relationships from the provided text.`;
}
```

**Acceptance Criteria**:
- [ ] Prompt template compiles
- [ ] All required sections included
- [ ] Clear instructions for JSON output format
- [ ] Example output format provided

---

#### 0.3.2: Build extraction service
**File**: `server/services/extraction/EntityExtractor.ts` (create new)
**Time**: 6 hours

```typescript
import { TranslationProvider } from '../../core/interfaces';
import { Entity, Relationship, ExtractionResult } from '../../types/entities';
import { PersonSchema, RelationshipSchema } from '../../validators/entities';
import { buildEntityExtractionPrompt } from '../../prompts/entityExtraction';
import { v4 as uuidv4 } from 'uuid';

export class EntityExtractor {
  constructor(
    private llm: TranslationProvider,
    private db: any // Database connection
  ) {}

  async extractFromTranslation(translationId: string): Promise<ExtractionResult> {
    const startTime = Date.now();

    // Get translation from database
    const translation = await this.db
      .select()
      .from('translations')
      .where({ id: translationId })
      .first();

    if (!translation) {
      throw new Error(`Translation ${translationId} not found`);
    }

    // Build extraction prompt
    const prompt = buildEntityExtractionPrompt(
      translation.translatedText,
      translation.originalText,
      {
        documentTitle: translation.metadata?.title,
        pageNumber: translation.metadata?.page,
        documentType: translation.metadata?.type
      }
    );

    // Call LLM with specialized extraction prompt
    const response = await this.llm.translate(
      prompt,
      'Extract entities as JSON' // System prompt
    );

    // Parse JSON response
    const extractedData = this.parseExtractionResponse(response.translation);

    // Validate and transform entities
    const entities = await this.validateAndTransformEntities(
      extractedData.entities,
      translationId
    );

    // Validate and transform relationships
    const relationships = await this.validateAndTransformRelationships(
      extractedData.relationships,
      entities,
      translationId
    );

    // Save to database
    await this.saveExtractionResults(entities, relationships, translationId);

    const processingTime = Date.now() - startTime;

    return {
      entities,
      relationships,
      metadata: {
        documentId: translationId,
        extractionDate: new Date(),
        model: this.llm.constructor.name,
        averageConfidence: this.calculateAverageConfidence(entities, relationships),
        processingTime
      }
    };
  }

  private parseExtractionResponse(responseText: string): any {
    try {
      // Try to extract JSON from response (LLM might add explanation text)
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }
      return JSON.parse(jsonMatch[0]);
    } catch (error) {
      throw new Error(`Failed to parse extraction response: ${error.message}`);
    }
  }

  private async validateAndTransformEntities(
    rawEntities: any[],
    sourceDocId: string
  ): Promise<Entity[]> {
    const validated: Entity[] = [];
    const tempIdMap = new Map<string, string>();

    for (const raw of rawEntities) {
      try {
        // Validate against schema
        const validatedEntity = PersonSchema.parse(raw); // TODO: Handle other entity types

        // Generate real UUID
        const realId = uuidv4();
        const tempId = raw.tempId || `TEMP_ID_${validated.length}`;
        tempIdMap.set(tempId, realId);

        // Add metadata
        const entity: Entity = {
          ...validatedEntity,
          id: realId,
          createdAt: new Date(),
          updatedAt: new Date(),
          createdBy: 'ai'
        };

        validated.push(entity);
      } catch (error) {
        console.error(`Failed to validate entity: ${error.message}`, raw);
        // Continue with other entities
      }
    }

    return validated;
  }

  private async validateAndTransformRelationships(
    rawRelationships: any[],
    entities: Entity[],
    sourceDocId: string
  ): Promise<Relationship[]> {
    const validated: Relationship[] = [];

    for (const raw of rawRelationships) {
      try {
        // Resolve temp IDs to real entity IDs
        const subjectEntity = entities.find(e =>
          e.canonicalName === raw.subjectName ||
          raw.subjectId === `TEMP_ID_${entities.indexOf(e)}`
        );

        const objectEntity = entities.find(e =>
          e.canonicalName === raw.objectName ||
          raw.objectId === `TEMP_ID_${entities.indexOf(e)}`
        );

        if (!subjectEntity || !objectEntity) {
          console.warn('Could not resolve entity IDs for relationship', raw);
          continue;
        }

        // Validate against schema
        const validatedRel = RelationshipSchema.parse({
          ...raw,
          subjectId: subjectEntity.id,
          objectId: objectEntity.id,
          sourceDocumentId: sourceDocId
        });

        // Add metadata
        const relationship: Relationship = {
          ...validatedRel,
          id: uuidv4(),
          createdAt: new Date(),
          updatedAt: new Date(),
          createdBy: 'ai'
        };

        validated.push(relationship);
      } catch (error) {
        console.error(`Failed to validate relationship: ${error.message}`, raw);
      }
    }

    return validated;
  }

  private async saveExtractionResults(
    entities: Entity[],
    relationships: Relationship[],
    translationId: string
  ): Promise<void> {
    // Use transaction to ensure atomicity
    await this.db.transaction(async (tx) => {
      // Insert entities
      if (entities.length > 0) {
        await tx.insert('entities').values(
          entities.map(e => ({
            id: e.id,
            type: e.type,
            canonical_name: e.canonicalName,
            names: e.names,
            attributes: e.attributes,
            dates: e.dates,
            confidence: e.confidence,
            verified: e.verified,
            created_by: e.createdBy,
            created_at: e.createdAt,
            updated_at: e.updatedAt
          }))
        );
      }

      // Insert relationships
      if (relationships.length > 0) {
        await tx.insert('relationships').values(
          relationships.map(r => ({
            id: r.id,
            subject_id: r.subjectId,
            predicate: r.predicate,
            object_id: r.objectId,
            properties: r.properties,
            confidence: r.confidence,
            verified: r.verified,
            source_document_id: r.sourceDocumentId,
            source_page: r.sourcePage,
            source_quote: r.sourceQuote,
            created_by: r.createdBy,
            created_at: r.createdAt,
            updated_at: r.updatedAt
          }))
        );
      }

      // Update extraction job status
      await tx.update('extraction_jobs')
        .set({
          status: 'completed',
          entities_extracted: entities.length,
          relationships_extracted: relationships.length,
          confidence_avg: this.calculateAverageConfidence(entities, relationships),
          completed_at: new Date()
        })
        .where({ translation_id: translationId });
    });
  }

  private calculateAverageConfidence(
    entities: Entity[],
    relationships: Relationship[]
  ): number {
    const allConfidences = [
      ...entities.map(e => e.confidence),
      ...relationships.map(r => r.confidence)
    ];

    if (allConfidences.length === 0) return 0;

    return allConfidences.reduce((a, b) => a + b, 0) / allConfidences.length;
  }
}
```

**Acceptance Criteria**:
- [ ] Service successfully calls LLM with extraction prompt
- [ ] JSON response parsed correctly
- [ ] Entities validated against schemas
- [ ] Relationships resolve entity references correctly
- [ ] Data saved to database in transaction
- [ ] Error handling for invalid extractions
- [ ] Confidence scores calculated

---

#### 0.3.3: Add API endpoints
**File**: `server/routes.ts` (extend existing)
**Time**: 4 hours

```typescript
// Add to existing routes
import { EntityExtractor } from './services/extraction/EntityExtractor';

// POST /api/extract/entities - Start extraction job
app.post('/api/extract/entities', async (req, res) => {
  try {
    const { translationId } = req.body;

    if (!translationId) {
      return res.status(400).json({ error: 'translationId required' });
    }

    // Create extraction job
    const job = await db.insert('extraction_jobs').values({
      id: uuidv4(),
      translation_id: translationId,
      status: 'pending',
      created_at: new Date()
    }).returning();

    // Start extraction asynchronously
    const extractor = new EntityExtractor(translationService, db);
    extractor.extractFromTranslation(translationId)
      .catch(error => {
        db.update('extraction_jobs')
          .set({ status: 'failed', error_message: error.message })
          .where({ id: job[0].id });
      });

    res.json({ jobId: job[0].id, status: 'pending' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/extract/jobs/:jobId - Get extraction job status
app.get('/api/extract/jobs/:jobId', async (req, res) => {
  const job = await db
    .select()
    .from('extraction_jobs')
    .where({ id: req.params.jobId })
    .first();

  if (!job) {
    return res.status(404).json({ error: 'Job not found' });
  }

  res.json(job);
});

// GET /api/entities - List entities (paginated)
app.get('/api/entities', async (req, res) => {
  const { type, verified, limit = 50, offset = 0 } = req.query;

  let query = db.select().from('entities');

  if (type) {
    query = query.where({ type });
  }
  if (verified !== undefined) {
    query = query.where({ verified: verified === 'true' });
  }

  const entities = await query
    .limit(parseInt(limit))
    .offset(parseInt(offset))
    .orderBy('confidence', 'desc');

  const total = await db.select().from('entities').count();

  res.json({
    entities,
    pagination: {
      total: total[0].count,
      limit: parseInt(limit),
      offset: parseInt(offset)
    }
  });
});

// GET /api/entities/:id - Get single entity with relationships
app.get('/api/entities/:id', async (req, res) => {
  const entity = await db
    .select()
    .from('entities')
    .where({ id: req.params.id })
    .first();

  if (!entity) {
    return res.status(404).json({ error: 'Entity not found' });
  }

  // Get all relationships where this entity is subject or object
  const relationships = await db
    .select()
    .from('relationships')
    .where('subject_id', req.params.id)
    .orWhere('object_id', req.params.id);

  res.json({ entity, relationships });
});

// GET /api/relationships - Query relationships
app.get('/api/relationships', async (req, res) => {
  const { subjectId, objectId, predicate, verified, limit = 50, offset = 0 } = req.query;

  let query = db.select().from('relationships');

  if (subjectId) query = query.where({ subject_id: subjectId });
  if (objectId) query = query.where({ object_id: objectId });
  if (predicate) query = query.where({ predicate });
  if (verified !== undefined) query = query.where({ verified: verified === 'true' });

  const relationships = await query
    .limit(parseInt(limit))
    .offset(parseInt(offset));

  res.json({ relationships });
});
```

**Acceptance Criteria**:
- [ ] All endpoints respond correctly
- [ ] Pagination works
- [ ] Filtering by type, verified status works
- [ ] Error handling for invalid requests
- [ ] OpenAPI documentation updated

---

### 0.4: Integration & Testing (2 days)

#### 0.4.1: Write integration tests
**File**: `tests/integration/entityExtraction.test.ts` (create new)
**Time**: 4 hours

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { EntityExtractor } from '../../server/services/extraction/EntityExtractor';
import { setupTestDatabase, cleanupTestDatabase } from '../fixtures/database';

describe('Entity Extraction Integration', () => {
  let db;
  let extractor;

  beforeAll(async () => {
    db = await setupTestDatabase();
    extractor = new EntityExtractor(mockLLM, db);
  });

  afterAll(async () => {
    await cleanupTestDatabase(db);
  });

  it('should extract entities from a simple biographical text', async () => {
    const translationId = await createTestTranslation(db, {
      text: 'Marpa Lotsawa (1012-1097) was a teacher of Milarepa. He lived in Lhodrak.'
    });

    const result = await extractor.extractFromTranslation(translationId);

    expect(result.entities).toHaveLength(3); // Marpa, Milarepa, Lhodrak
    expect(result.relationships).toHaveLength(2); // teacher_of, lived_at
    expect(result.metadata.averageConfidence).toBeGreaterThan(0.7);
  });

  it('should handle dates with different precisions', async () => {
    // Test circa, estimated, exact dates
  });

  it('should save entities to database', async () => {
    // Test database persistence
  });

  it('should create extraction job record', async () => {
    // Test job tracking
  });
});
```

**Acceptance Criteria**:
- [ ] All tests pass
- [ ] Edge cases covered (empty text, invalid JSON, etc.)
- [ ] Database cleanup after tests
- [ ] Test coverage >80%

---

#### 0.4.2: Test with real Sakya Monastery text
**File**: `tests/manual/sakyaExtractionTest.ts` (create new)
**Time**: 4 hours

```typescript
/**
 * Manual test script for extracting entities from actual Sakya Monastery text
 * Run with: npm run test:manual:extraction
 */

import { EntityExtractor } from '../../server/services/extraction/EntityExtractor';
import { readFileSync } from 'fs';

async function testSakyaExtraction() {
  // Load a translated page from Sakya Monastery text
  const sampleText = readFileSync('./tests/fixtures/sakya-sample-page.txt', 'utf-8');

  console.log('Starting extraction from Sakya Monastery text...');
  console.log(`Text length: ${sampleText.length} characters`);

  const startTime = Date.now();
  const result = await extractor.extractFromTranslation(sampleTextId);
  const duration = Date.now() - startTime;

  console.log('\n=== EXTRACTION RESULTS ===');
  console.log(`Entities found: ${result.entities.length}`);
  console.log(`Relationships found: ${result.relationships.length}`);
  console.log(`Average confidence: ${result.metadata.averageConfidence.toFixed(2)}`);
  console.log(`Processing time: ${duration}ms`);

  console.log('\n=== ENTITIES BY TYPE ===');
  const byType = result.entities.reduce((acc, e) => {
    acc[e.type] = (acc[e.type] || 0) + 1;
    return acc;
  }, {});
  console.log(byType);

  console.log('\n=== SAMPLE ENTITIES ===');
  result.entities.slice(0, 5).forEach(entity => {
    console.log(`- ${entity.canonicalName} (${entity.type}), confidence: ${entity.confidence}`);
  });

  console.log('\n=== SAMPLE RELATIONSHIPS ===');
  result.relationships.slice(0, 5).forEach(rel => {
    const subject = result.entities.find(e => e.id === rel.subjectId);
    const object = result.entities.find(e => e.id === rel.objectId);
    console.log(`- ${subject?.canonicalName} ${rel.predicate} ${object?.canonicalName}`);
    console.log(`  Source: "${rel.sourceQuote?.substring(0, 80)}..."`);
  });

  // Check for low-confidence extractions that need human review
  const lowConfidence = result.entities.filter(e => e.confidence < 0.7);
  console.log(`\n=== LOW CONFIDENCE (< 0.7): ${lowConfidence.length} items ===`);
  lowConfidence.forEach(e => {
    console.log(`- ${e.canonicalName}: ${e.confidence.toFixed(2)}`);
  });
}

testSakyaExtraction().catch(console.error);
```

**Acceptance Criteria**:
- [ ] Successfully extracts entities from real Sakya text
- [ ] Results look reasonable (entities make sense)
- [ ] Relationships correctly connect entities
- [ ] Confidence scores distributed appropriately
- [ ] Low-confidence items flagged for review

---

## Definition of Done

Phase 0 is complete when:

- [x] **Database schema extended** with entities, relationships, lineages, extraction_jobs tables
- [x] **All tables have proper indexes** for performance
- [x] **TypeScript types defined** for all entities and relationships
- [x] **Validation schemas created** using Zod
- [x] **Entity extraction service built** and functional
- [x] **API endpoints added** for extraction and entity queries
- [x] **Integration tests pass** with >80% coverage
- [x] **Real Sakya text extraction succeeds** with reasonable results
- [x] **Documentation updated** with new API endpoints
- [x] **Migration scripts tested** on both PostgreSQL and SQLite

## Success Metrics

After Phase 0, we should be able to:
- ✅ Upload a translated document
- ✅ Trigger entity extraction
- ✅ See extracted entities in database
- ✅ Query entities via API
- ✅ View relationships between entities
- ✅ Identify low-confidence extractions needing review

## Next Phase

Once Phase 0 is complete, proceed to **Phase 1: Entity Extraction** which will:
- Add extraction for all entity types (not just people)
- Improve extraction prompts based on real-world testing
- Add batch extraction for multiple documents
- Build confidence calibration system

---

*Phase 0 Estimated Total Time: 10 work days (2 weeks)*
