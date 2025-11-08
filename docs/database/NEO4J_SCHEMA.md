# Neo4j Knowledge Graph Schema

**Phase 4, Task 4.2: Graph Schema Design**
**Tibetan Buddhist Knowledge Graph**

## Table of Contents

1. [Overview](#overview)
2. [Design Principles](#design-principles)
3. [Entity-Relationship Diagram](#entity-relationship-diagram)
4. [Node Labels](#node-labels)
5. [Relationship Types](#relationship-types)
6. [Indexes](#indexes)
7. [Constraints](#constraints)
8. [Query Patterns](#query-patterns)
9. [Data Loading](#data-loading)
10. [Future Enhancements](#future-enhancements)

---

## Overview

This Neo4j schema represents a comprehensive knowledge graph of Tibetan Buddhist history, encompassing:

- **8 Entity Types**: Person, Place, Text, Event, Concept, Institution, Deity, Lineage
- **43 Relationship Types**: 26 core predicates + bidirectional inverses
- **Multi-label Strategy**: All entities have `:Entity` base label + specific type label
- **Temporal Support**: Integer year storage with precision tracking
- **Quality Tracking**: Confidence scores, verification status, source attribution
- **Multi-language**: Tibetan script, Wylie, phonetic, Sanskrit, Chinese

### Statistics (Target Scale)

- **Entities**: 100,000+ (people, places, texts, etc.)
- **Relationships**: 500,000+ (teacher-student, authorship, spatial, etc.)
- **Time Period**: 7th century - present day
- **Geographic Scope**: Tibet, India, Nepal, Bhutan, Mongolia, China

---

## Design Principles

### 1. Multi-Label Approach

**Strategy**: Use both base `:Entity` label and specific type labels (`:Person`, `:Place`, etc.)

**Benefits**:
- Shared queries across all entities (`MATCH (e:Entity)`)
- Type-specific queries remain efficient (`MATCH (p:Person)`)
- Common property inheritance
- Consistent metadata tracking

**Example**:
```cypher
// Node has BOTH labels
(:Entity:Person {
  id: "uuid-123",
  entity_type: "person",  // Also stored as property for querying
  canonical_name: "Milarepa",
  confidence: 0.95
})
```

### 2. Temporal Data Model

**Integer Year Storage**: Store dates as integers for historical accuracy

**Precision Tracking**: Every date has a precision field
- `exact`: Confirmed date from reliable sources
- `circa`: Approximate date (±5 years)
- `estimated`: Educated guess (±20 years)
- `disputed`: Multiple conflicting sources
- `unknown`: No reliable date information

**Dual Calendar Support**: Both Gregorian and Tibetan calendar systems

```cypher
(:Person {
  birth_year: 1040,                    // Gregorian
  birth_year_precision: "circa",
  birth_tibetan_year: {                // Tibetan calendar
    rabjung: 1,
    year: 7,
    element: "metal",
    animal: "dragon"
  }
})
```

### 3. Confidence and Quality

**Confidence Scores** (0.0-1.0):
- 0.0-0.5: Low confidence, needs review
- 0.5-0.7: Moderate confidence
- 0.7-0.9: High confidence
- 0.9-1.0: Very high confidence (verified or well-documented)

**Extraction Method Tracking**:
- `pattern`: Rule-based extraction
- `llm`: LLM-based extraction (Gemini 2.0)
- `manual`: Human entry
- `merged`: Result of entity resolution
- `imported`: Imported from external source

**Verification Status**:
- `verified: false`: Extracted automatically
- `verified: true`: Reviewed by expert

### 4. Source Attribution

Every entity and relationship tracks:
- `source_document_id`: Translation ID where extracted
- `source_page`: Page number(s)
- `source_quote`: Exact text excerpt
- `created_by`: User ID or "ai"
- `created_at`: Timestamp

---

## Entity-Relationship Diagram

```
                    ┌──────────┐
                    │  Entity  │ (Base Label)
                    └─────┬────┘
                          │
          ┌───────────────┼───────────────┐
          │               │               │
     ┌────▼────┐    ┌────▼────┐    ┌────▼────┐
     │ Person  │    │  Place  │    │  Text   │
     └─────────┘    └─────────┘    └─────────┘
          │               │               │
    TEACHER_OF       WITHIN          WROTE
    STUDENT_OF       NEAR          COMMENTARY_ON
    LIVED_AT         BORN_IN
    INCARNATION_OF   DIED_IN


┌──────────────┐        ┌──────────────┐        ┌──────────────┐
│    Person    │───────▶│     Text     │───────▶│   Concept    │
│              │  WROTE │              │ MENTIONS│              │
└──────┬───────┘        └──────────────┘        └──────────────┘
       │
       │ TEACHER_OF
       │
       ▼
┌──────────────┐        ┌──────────────┐        ┌──────────────┐
│    Person    │───────▶│  Institution │───────▶│    Place     │
│   (Student)  │ MEMBER │              │ LOCATED │              │
└──────────────┘   _OF  └──────────────┘    _AT  └──────────────┘
```

---

## Node Labels

### Base Entity Label

All nodes share the `:Entity` label with common properties:

| Property | Type | Required | Indexed | Description |
|----------|------|----------|---------|-------------|
| `id` | string | ✓ | ✓ (unique) | UUID |
| `entity_type` | string | ✓ | ✓ | person, place, text, event, concept, institution, deity, lineage |
| `canonical_name` | string | ✓ | ✓ | Primary English name |
| `tibetan_name` | string | | ✓ | Tibetan script |
| `wylie_name` | string | | ✓ | Wylie transliteration |
| `phonetic_name` | string | | ✓ | Phonetic pronunciation |
| `alternate_names` | string[] | | fulltext | All name variants |
| `confidence` | float | ✓ | ✓ | 0.0-1.0 score |
| `verified` | boolean | ✓ | ✓ | Human verification status |
| `extraction_method` | string | ✓ | ✓ | pattern, llm, manual, merged, imported |
| `source_document_id` | string | | ✓ | Translation ID |
| `source_page` | string | | | Page number(s) |
| `source_quote` | string | | | Exact text excerpt |
| `created_at` | datetime | ✓ | ✓ | Creation timestamp |
| `updated_at` | datetime | ✓ | | Last update timestamp |
| `created_by` | string | ✓ | | User ID or "ai" |
| `verified_by` | string | | | User ID of verifier |
| `verified_at` | datetime | | | Verification timestamp |
| `notes` | string | | | Additional context |

---

### Person (`:Entity:Person`)

Historical Buddhist figures including teachers, scholars, translators, yogis, and patrons.

**Additional Properties**:

| Property | Type | Description |
|----------|------|-------------|
| `birth_year` | integer | Gregorian birth year |
| `birth_year_precision` | string | exact, circa, estimated, disputed, unknown |
| `birth_tibetan_year` | json | Tibetan calendar birth date |
| `death_year` | integer | Gregorian death year |
| `death_year_precision` | string | Precision of death date |
| `death_tibetan_year` | json | Tibetan calendar death date |
| `ordination_year` | integer | Year of monastic ordination |
| `enthronement_year` | integer | Year of enthronement as tulku |
| `titles` | string[] | Rinpoche, Lotsawa, Khenpo, etc. |
| `epithets` | string[] | "The Great Translator", etc. |
| `roles` | string[] | teacher, translator, abbot, patron, scholar, yogi, poet, king, minister |
| `gender` | string | male, female, unknown |
| `tradition` | string[] | Nyingma, Kagyu, Sakya, Gelug, Bon, Rimé, Kadam, Jonang |
| `affiliations` | string[] | Monastery names, lineage names |
| `biography` | string | Brief biographical summary |
| `lifespan_years` | integer | Computed: death_year - birth_year |

**Example**:
```cypher
CREATE (p:Entity:Person {
  id: "uuid-milarepa",
  entity_type: "person",
  canonical_name: "Milarepa",
  tibetan_name: "མི་ལ་རས་པ",
  wylie_name: "mi la ras pa",
  phonetic_name: "Milarepa",
  birth_year: 1040,
  birth_year_precision: "circa",
  death_year: 1123,
  death_year_precision: "circa",
  titles: ["Jetsun"],
  roles: ["yogi", "poet", "teacher"],
  tradition: ["Kagyu"],
  gender: "male",
  confidence: 0.95,
  verified: true,
  extraction_method: "manual"
})
```

---

### Place (`:Entity:Place`)

Geographic locations including monasteries, mountains, caves, cities, and regions.

**Additional Properties**:

| Property | Type | Description |
|----------|------|-------------|
| `place_type` | string | monastery, mountain, cave, city, region, country, holy_site, hermitage, temple, stupa |
| `latitude` | float | Latitude coordinate |
| `longitude` | float | Longitude coordinate |
| `coordinate_accuracy` | integer | Accuracy in meters |
| `altitude` | integer | Altitude in meters |
| `region` | string | Ü, Tsang, Kham, Amdo, etc. |
| `modern_country` | string | China, India, Nepal, Bhutan, etc. |
| `parent_place_id` | string | ID of parent place for hierarchy |
| `significance` | string[] | Why historically/spiritually significant |
| `description` | string | Detailed description |
| `founded_year` | integer | Year established |
| `destroyed_year` | integer | Year destroyed (if applicable) |
| `rebuilt_year` | integer | Year rebuilt (if applicable) |

**Example**:
```cypher
CREATE (p:Entity:Place {
  id: "uuid-samye",
  entity_type: "place",
  canonical_name: "Samye Monastery",
  tibetan_name: "བསམ་ཡས",
  wylie_name: "bsam yas",
  place_type: "monastery",
  region: "Ü",
  modern_country: "China (Tibet Autonomous Region)",
  latitude: 29.316,
  longitude: 91.734,
  founded_year: 779,
  significance: ["First Buddhist monastery in Tibet", "Site of Great Debate"],
  confidence: 0.98
})
```

---

### Text (`:Entity:Text`)

Buddhist texts including sutras, tantras, commentaries, biographies, and philosophical treatises.

**Additional Properties**:

| Property | Type | Description |
|----------|------|-------------|
| `text_type` | string | sutra, tantra, commentary, biography, poetry, letters, ritual, philosophical_treatise, history, medicine, astrology |
| `language` | string | Tibetan, Sanskrit, Chinese, Pali, etc. |
| `volume_count` | integer | Number of volumes |
| `page_count` | integer | Number of pages |
| `topics` | string[] | Main topics covered |
| `practices` | string[] | Practices described |
| `collection_id` | string | ID of larger collection |
| `tibetan_canon_section` | string | Kangyur/Tengyur section |
| `abbreviated_name` | string | Common short name |
| `composed_year` | integer | Year composed |
| `translated_year` | integer | Year translated |
| `printed_year` | integer | Year first printed |
| `rediscovered_year` | integer | Year rediscovered (terma texts) |

**Example**:
```cypher
CREATE (t:Entity:Text {
  id: "uuid-lamrim-chenmo",
  entity_type: "text",
  canonical_name: "The Great Treatise on the Stages of the Path to Enlightenment",
  tibetan_name: "བྱང་ཆུབ་ལམ་རིམ་ཆེན་མོ",
  wylie_name: "byang chub lam rim chen mo",
  abbreviated_name: "Lamrim Chenmo",
  text_type: "philosophical_treatise",
  language: "Tibetan",
  volume_count: 3,
  composed_year: 1402,
  topics: ["lamrim", "stages of the path", "sutrayana"],
  tradition: ["Gelug"],
  confidence: 1.0
})
```

---

### Event (`:Entity:Event`)

Historical events including teachings, empowerments, debates, foundings, and political events.

**Additional Properties**:

| Property | Type | Description |
|----------|------|-------------|
| `event_type` | string | teaching, empowerment, debate, founding, pilgrimage, retreat, death, birth, transmission, political, natural_disaster, meeting, ordination, enthronement |
| `location_id` | string | Place ID where occurred |
| `duration` | string | Duration (e.g., "3 days") |
| `significance` | string | Historical/spiritual significance |
| `description` | string | What happened |
| `attendee_count` | integer | Number of attendees |
| `outcome` | string | Result of the event |
| `occurred_year` | integer | Year occurred |
| `started_year` | integer | Year started (multi-year events) |
| `ended_year` | integer | Year ended |

---

### Concept (`:Entity:Concept`)

Philosophical views, meditation practices, doctrines, and technical terms.

**Additional Properties**:

| Property | Type | Description |
|----------|------|-------------|
| `concept_type` | string | philosophical_view, meditation_practice, doctrine, technical_term, practice |
| `definitions` | json | Array of definitions with source and author |
| `sanskrit_term` | string | Sanskrit equivalent |
| `pali_term` | string | Pali equivalent |
| `chinese_term` | string | Chinese equivalent |
| `short_definition` | string | Brief definition |

---

### Institution (`:Entity:Institution`)

Monasteries, colleges, hermitages, temples, and other Buddhist institutions.

**Additional Properties**:

| Property | Type | Description |
|----------|------|-------------|
| `institution_type` | string | monastery, college, hermitage, temple, printing_house, library, government, school |
| `location_id` | string | Place ID of location |
| `tradition` | string[] | Buddhist traditions |
| `parent_institution_id` | string | Parent institution ID |
| `subsidiary_ids` | string[] | Branch institution IDs |
| `description` | string | Detailed description |
| `notable_abbots` | json | Notable abbots with periods |
| `texts_produced` | json | Texts produced here |
| `major_events` | json | Major events |
| `founded_year` | integer | Year founded |
| `dissolved_year` | integer | Year dissolved |
| `reformed_year` | integer | Year reformed |

---

### Deity (`:Entity:Deity`)

Buddhist deities including buddhas, bodhisattvas, yidams, protectors, and dakinis.

**Additional Properties**:

| Property | Type | Description |
|----------|------|-------------|
| `deity_type` | string | buddha, bodhisattva, yidam, protector, dakini, dharma_protector |
| `tradition` | string[] | Traditions that practice this deity |
| `iconography` | json | Arms, heads, color, implements, posture |
| `qualities` | string[] | Compassion, wisdom, power, etc. |
| `mantras` | string[] | Associated mantras |
| `consort` | string | Name of consort deity |

---

### Lineage (`:Entity:Lineage`)

Transmission lineages including incarnation lines, teaching lineages, and ordination lineages.

**Additional Properties**:

| Property | Type | Description |
|----------|------|-------------|
| `lineage_type` | string | incarnation, transmission, ordination, family, institutional |
| `tradition` | string | Buddhist tradition |
| `teaching` | string | What is transmitted |
| `origin_text_id` | string | Text ID if relates to specific text |
| `origin_year` | integer | Year originated |
| `lineage_chain` | json | Complete chain with positions |
| `branch_lineage_ids` | string[] | Split lineages |

---

## Relationship Types

All relationships have common properties:

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `id` | string | ✓ | Unique UUID |
| `confidence` | float | ✓ | 0.0-1.0 score |
| `verified` | boolean | ✓ | Verification status |
| `source_document_id` | string | | Translation ID |
| `source_page` | string | | Page number |
| `source_quote` | string | | Exact excerpt |
| `extraction_method` | string | ✓ | pattern, llm, manual, inferred |
| `created_at` | datetime | ✓ | Creation timestamp |
| `updated_at` | datetime | ✓ | Update timestamp |
| `created_by` | string | ✓ | User ID or "ai" |
| `verified_by` | string | | Verifier ID |
| `verified_at` | datetime | | Verification timestamp |
| `notes` | string | | Additional context |

### Relationship Summary Table

| Relationship | Subject | Object | Bidirectional | Description |
|-------------|---------|--------|---------------|-------------|
| `TEACHER_OF` | Person | Person | ✓ (STUDENT_OF) | Teaching relationship |
| `STUDENT_OF` | Person | Person | ✓ (TEACHER_OF) | Learning relationship |
| `INCARNATION_OF` | Person | Person | ✗ | Reincarnation line |
| `WROTE` | Person | Text | ✗ | Authorship |
| `TRANSLATED` | Person | Text | ✗ | Translation |
| `COMPILED` | Person | Text | ✗ | Compilation/editing |
| `LIVED_AT` | Person | Place/Institution | ✗ | Residence |
| `VISITED` | Person | Place | ✗ | Visit |
| `FOUNDED` | Person | Place/Institution | ✗ | Founding |
| `BORN_IN` | Person | Place | ✗ | Birth location |
| `DIED_IN` | Person | Place | ✗ | Death location |
| `ATTENDED` | Person | Event | ✗ | Event participation |
| `ORGANIZED` | Person | Event | ✗ | Event organization |
| `SPONSORED` | Person | Event/Institution/Text | ✗ | Patronage |
| `MEMBER_OF` | Person | Institution | ✗ | Membership |
| `ABBOT_OF` | Person | Institution | ✗ | Leadership |
| `PATRON_OF` | Person | Person/Institution/Text | ✗ | Patronage |
| `COMMENTARY_ON` | Text | Text | ✗ | Commentary relationship |
| `CITES` | Text | Text | ✗ | Citation |
| `PART_OF` | Text/Place | Text/Place | ✗ | Part-whole relationship |
| `CONTAINS` | Text/Place | Text/Place | ✗ | Contains relationship |
| `MENTIONS` | Text | Person/Place/Event/Concept/Deity | ✗ | Mention |
| `RECEIVED_TRANSMISSION` | Person | Person | ✗ | Transmission received |
| `GAVE_EMPOWERMENT` | Person | Person | ✗ | Empowerment given |
| `TRANSMITTED_TO` | Person | Person | ✗ | Transmission given |
| `DEBATED_WITH` | Person | Person | ✓ (symmetric) | Philosophical debate |
| `REFUTED` | Person/Text | Concept/Text | ✗ | Refutation |
| `AGREED_WITH` | Person | Person/Concept | ✗ | Agreement |
| `PARENT_OF` | Person | Person | ✓ (CHILD_OF) | Parentage |
| `CHILD_OF` | Person | Person | ✓ (PARENT_OF) | Child relationship |
| `SIBLING_OF` | Person | Person | ✓ (symmetric) | Sibling relationship |
| `SPOUSE_OF` | Person | Person | ✓ (symmetric) | Marriage |
| `WITHIN` | Place | Place | ✗ | Geographic containment |
| `NEAR` | Place | Place | ✓ (symmetric) | Proximity |
| `PRACTICED` | Person | Concept | ✗ | Practice engagement |
| `HELD_VIEW` | Person | Concept | ✗ | Philosophical position |
| `TAUGHT_CONCEPT` | Person | Concept | ✗ | Teaching |
| `PRECEDED` | Event | Event | ✗ | Temporal precedence |
| `FOLLOWED` | Event | Event | ✗ | Temporal sequence |
| `CONTEMPORARY_WITH` | Person | Person | ✓ (symmetric) | Lived at same time |

---

## Indexes

### Index Strategy

The schema uses **4 types of indexes**:

1. **Property Indexes**: Fast lookup on single properties
2. **Composite Indexes**: Queries filtering on multiple properties
3. **Full-text Indexes**: Natural language search
4. **Vector Indexes**: Semantic search (future)

### Key Indexes

**Name Searching**:
- `entity_names_fulltext`: Full-text search across all name variants
- `entity_canonical_name_index`: Exact name match

**Timeline Queries**:
- `person_dates_composite`: (birth_year, death_year)
- `person_birth_year_index`
- `person_death_year_index`
- `text_composed_year_index`

**Geographic Queries**:
- `place_coordinates_composite`: (latitude, longitude)
- `place_type_region_composite`: (place_type, region)

**Tradition-Specific**:
- `person_tradition_dates_composite`: (tradition, birth_year, death_year)

**Quality Filtering**:
- `entity_type_confidence_composite`: (entity_type, confidence)
- `entity_verified_index`

---

## Constraints

### Uniqueness Constraints

- `entity_id_unique`: Every entity has unique UUID
- Type-specific ID constraints for Person, Place, Text, etc.
- Relationship ID uniqueness for all relationship types

### Existence Constraints

**Required on all entities**:
- `canonical_name`
- `entity_type`
- `confidence`
- `verified`
- `extraction_method`
- `created_at`
- `created_by`

**Type-specific required properties**:
- `place_type` for Place
- `text_type` for Text
- `event_type` for Event
- etc.

---

## Query Patterns

### 1. Name Search

```cypher
// Exact match
MATCH (e:Entity {canonical_name: 'Milarepa'})
RETURN e

// Full-text search (fuzzy)
CALL db.index.fulltext.queryNodes('entity_names_fulltext', 'Milarepa~')
YIELD node, score
RETURN node, score
ORDER BY score DESC
LIMIT 10

// Wylie transliteration search
MATCH (e:Entity)
WHERE e.wylie_name CONTAINS 'mi la ras pa'
RETURN e
```

### 2. Timeline Queries

```cypher
// People alive in 1350
MATCH (p:Person)
WHERE p.birth_year <= 1350
  AND (p.death_year IS NULL OR p.death_year >= 1350)
RETURN p
ORDER BY p.birth_year

// Sakya scholars from 1200-1300
MATCH (p:Person)
WHERE 'Sakya' IN p.tradition
  AND p.birth_year >= 1200
  AND p.birth_year <= 1300
RETURN p
ORDER BY p.birth_year

// Events in 14th century
MATCH (e:Event)
WHERE e.occurred_year >= 1300 AND e.occurred_year < 1400
RETURN e
ORDER BY e.occurred_year
```

### 3. Teacher Lineage

```cypher
// Direct teachers of Milarepa
MATCH (teacher:Person)-[:TEACHER_OF]->(student:Person {canonical_name: 'Milarepa'})
RETURN teacher

// Teacher lineage from Tilopa to Milarepa
MATCH path = (start:Person {canonical_name: 'Tilopa'})
             -[:TEACHER_OF*1..5]->
             (end:Person {canonical_name: 'Milarepa'})
RETURN path

// All students of Tsongkhapa (verified relationships only)
MATCH (teacher:Person {canonical_name: 'Tsongkhapa'})
      -[r:TEACHER_OF {verified: true}]->
      (student:Person)
WHERE r.confidence > 0.7
RETURN student.canonical_name, r.start_year
ORDER BY r.start_year
```

### 4. Incarnation Lines

```cypher
// Dalai Lama incarnation line
MATCH path = (latest:Person)
             -[:INCARNATION_OF*]->
             (first:Person)
WHERE latest.canonical_name CONTAINS 'Dalai Lama'
  AND NOT (first)-[:INCARNATION_OF]->()
RETURN path
ORDER BY length(path) DESC
LIMIT 1

// Find specific incarnation
MATCH (p:Person)-[r:INCARNATION_OF]->(prev:Person)
WHERE p.canonical_name CONTAINS '14th Dalai Lama'
RETURN prev.canonical_name AS previous_incarnation,
       r.recognition_year AS recognized_in
```

### 5. Text Authorship

```cypher
// All works by Tsongkhapa
MATCH (author:Person {canonical_name: 'Tsongkhapa'})
      -[:WROTE]->
      (text:Text)
RETURN text.canonical_name, text.text_type, text.composed_year
ORDER BY text.composed_year

// Commentaries on a root text
MATCH (commentary:Text)
      -[:COMMENTARY_ON]->
      (root:Text {canonical_name: 'Abhisamayalankara'})
RETURN commentary.canonical_name, commentary.composed_year
ORDER BY commentary.composed_year

// Texts translated by Marpa
MATCH (translator:Person {canonical_name: 'Marpa'})
      -[r:TRANSLATED]->
      (text:Text)
RETURN text.canonical_name, r.translation_year
```

### 6. Geographic Queries

```cypher
// Monasteries in Ü region
MATCH (p:Place {place_type: 'monastery', region: 'Ü'})
RETURN p.canonical_name, p.founded_year
ORDER BY p.founded_year

// Places within 100km of Lhasa
MATCH (ref:Place {canonical_name: 'Lhasa'}),
      (p:Place)
WHERE p.latitude IS NOT NULL AND p.longitude IS NOT NULL
WITH p, ref,
     point({latitude: p.latitude, longitude: p.longitude}) AS pPoint,
     point({latitude: ref.latitude, longitude: ref.longitude}) AS refPoint
WHERE distance(pPoint, refPoint) < 100000
RETURN p.canonical_name,
       toInteger(distance(pPoint, refPoint) / 1000) AS distance_km
ORDER BY distance_km

// Geographic hierarchy
MATCH path = (place:Place)-[:WITHIN*]->(region:Place {place_type: 'region'})
WHERE place.canonical_name = 'Samye Monastery'
RETURN path
```

### 7. Quality Filtering

```cypher
// High-confidence verified entities
MATCH (e:Entity)
WHERE e.verified = true AND e.confidence >= 0.9
RETURN e.entity_type, count(*) AS count
ORDER BY count DESC

// Unverified entities needing review
MATCH (e:Entity)
WHERE e.verified = false AND e.confidence < 0.7
RETURN e.canonical_name, e.entity_type, e.confidence
ORDER BY e.confidence
LIMIT 100

// Entities by extraction method
MATCH (e:Entity)
RETURN e.extraction_method, count(*) AS count
ORDER BY count DESC
```

### 8. Complex Pattern Matching

```cypher
// Teachers who were also translators
MATCH (p:Person)
WHERE 'teacher' IN p.roles AND 'translator' IN p.roles
RETURN p.canonical_name, p.tradition, p.birth_year
ORDER BY p.birth_year

// Texts that cite other texts (citation network)
MATCH (citing:Text)-[:CITES]->(cited:Text)
WITH cited, count(citing) AS citation_count
WHERE citation_count > 3
RETURN cited.canonical_name, citation_count
ORDER BY citation_count DESC

// People who attended the same event
MATCH (p1:Person)-[:ATTENDED]->(event:Event)<-[:ATTENDED]-(p2:Person)
WHERE p1.canonical_name = 'Tsongkhapa' AND p1 <> p2
RETURN DISTINCT p2.canonical_name, event.canonical_name
```

---

## Data Loading

### Loading from PostgreSQL

The sync service (`server/services/neo4j/GraphSyncService.ts`) handles data migration:

```typescript
// Example: Sync all entities
await graphSyncService.syncAllEntities();

// Example: Sync all relationships
await graphSyncService.syncAllRelationships();

// Example: Sync specific entity
await graphSyncService.syncEntity(entityId);
```

### Batch Import Template

```cypher
// Batch create Person nodes from CSV/JSON
UNWIND $persons AS person
CREATE (p:Entity:Person {
  id: person.id,
  entity_type: 'person',
  canonical_name: person.canonical_name,
  tibetan_name: person.tibetan_name,
  wylie_name: person.wylie_name,
  birth_year: person.birth_year,
  death_year: person.death_year,
  tradition: person.tradition,
  roles: person.roles,
  confidence: person.confidence,
  verified: person.verified,
  created_at: datetime(person.created_at),
  created_by: person.created_by
})

// Batch create relationships
UNWIND $relationships AS rel
MATCH (subject:Entity {id: rel.subject_id})
MATCH (object:Entity {id: rel.object_id})
CREATE (subject)-[r:TEACHER_OF {
  id: rel.id,
  confidence: rel.confidence,
  start_year: rel.properties.start_year,
  teaching_type: rel.properties.teaching_type,
  created_at: datetime(rel.created_at),
  created_by: rel.created_by
}]->(object)
```

---

## Future Enhancements

### 1. Vector Embeddings (Semantic Search)

Add embedding vectors to entities for semantic similarity:

```cypher
// Add vector property
MATCH (e:Entity)
SET e.embedding = $embeddingVector

// Create vector index
CREATE VECTOR INDEX entity_embedding_vector IF NOT EXISTS
FOR (e:Entity) ON (e.embedding)
OPTIONS {
  indexConfig: {
    `vector.dimensions`: 1536,
    `vector.similarity_function`: 'cosine'
  }
}

// Semantic similarity query
MATCH (e:Entity)
WHERE e.canonical_name = 'Emptiness'
CALL db.index.vector.queryNodes('entity_embedding_vector', 10, e.embedding)
YIELD node, score
RETURN node.canonical_name, score
```

### 2. Graph Algorithms

Use Neo4j Graph Data Science library:

```cypher
// PageRank to find influential figures
CALL gds.pageRank.stream({
  nodeProjection: 'Person',
  relationshipProjection: 'TEACHER_OF'
})
YIELD nodeId, score
RETURN gds.util.asNode(nodeId).canonical_name AS person, score
ORDER BY score DESC
LIMIT 20

// Community detection for traditions
CALL gds.louvain.stream({
  nodeProjection: 'Person',
  relationshipProjection: {
    TEACHER_OF: {orientation: 'UNDIRECTED'}
  }
})
YIELD nodeId, communityId
RETURN communityId, collect(gds.util.asNode(nodeId).canonical_name) AS members
```

### 3. Temporal Graphs

Integrate Neo4j's temporal features for time-based queries:

```cypher
// Find contemporaries (people alive at same time)
MATCH (p1:Person), (p2:Person)
WHERE p1.birth_year < p2.death_year
  AND p2.birth_year < p1.death_year
  AND p1 <> p2
CREATE (p1)-[:CONTEMPORARY_WITH {
  overlap_start: max(p1.birth_year, p2.birth_year),
  overlap_end: min(p1.death_year, p2.death_year)
}]->(p2)
```

### 4. Knowledge Graph Visualization

Build visualization endpoints using:
- D3.js force-directed graphs
- Neovis.js library
- GraphQL API for frontend queries

---

## Implementation Files

**Schema Definitions**:
- `/home/user/Translate/server/schema/neo4jSchema.ts` - Node label schemas
- `/home/user/Translate/server/schema/neo4jRelationships.ts` - Relationship schemas
- `/home/user/Translate/server/schema/neo4jIndexes.ts` - Index definitions
- `/home/user/Translate/server/schema/neo4jConstraints.ts` - Constraint definitions

**Cypher Script**:
- `/home/user/Translate/scripts/create-neo4j-schema.cypher` - Complete schema creation

**Services**:
- `/home/user/Translate/server/services/neo4j/GraphSyncService.ts` - PostgreSQL → Neo4j sync
- `/home/user/Translate/server/services/neo4j/Neo4jClient.ts` - Neo4j driver wrapper

**Tests**:
- `/home/user/Translate/tests/integration/neo4jSchema.test.ts` - Schema validation tests

---

## Appendix: Cypher Quick Reference

### Create Nodes

```cypher
CREATE (p:Entity:Person {
  id: 'uuid-123',
  canonical_name: 'Milarepa',
  confidence: 0.95
})
```

### Create Relationships

```cypher
MATCH (teacher:Person {canonical_name: 'Marpa'})
MATCH (student:Person {canonical_name: 'Milarepa'})
CREATE (teacher)-[:TEACHER_OF {
  id: 'uuid-rel-123',
  confidence: 1.0,
  start_year: 1056
}]->(student)
```

### Query Patterns

```cypher
// Find all
MATCH (p:Person)
RETURN p

// Filter
MATCH (p:Person)
WHERE p.birth_year > 1300
RETURN p

// Relationship traversal
MATCH (p:Person)-[:TEACHER_OF]->(student)
RETURN p, student

// Variable length path
MATCH path = (start)-[:TEACHER_OF*1..5]->(end)
RETURN path

// Shortest path
MATCH path = shortestPath((start)-[:TEACHER_OF*]-(end))
RETURN path
```

### Aggregation

```cypher
MATCH (p:Person)
RETURN p.tradition, count(*) AS count
ORDER BY count DESC

MATCH (p:Person)
RETURN avg(p.death_year - p.birth_year) AS avg_lifespan
```

---

**End of Schema Documentation**
