# Pattern-Based Relationship Extractor

**Phase 3, Task 3.1: Pattern-Based Extraction**

This service extracts relationships from Tibetan Buddhist texts using 100+ regex patterns across 8 categories.

## Features

- **130 comprehensive patterns** covering all major relationship types
- **Active/passive voice handling** with bidirectional relationships
- **Entity resolution** with fuzzy name matching (Levenshtein distance)
- **Date and location extraction** from contextual patterns
- **Confidence scoring** based on pattern strength and entity match quality
- **Extensible architecture** for adding custom patterns

## Quick Start

### Basic Usage

```typescript
import { PatternExtractor } from './server/services/relationships';
import type { Entity, Relationship } from './server/types/entities';

// Initialize extractor
const extractor = new PatternExtractor();

// Sample text
const text = `
  Milarepa studied under Marpa for twelve years at Lhodrak.
  Marpa had received the Mahamudra transmission from Naropa.
  Tsongkhapa wrote the Lamrim Chenmo in 1402 at Reting Monastery.
`;

// Sample entities (from entity extraction phase)
const entities: Entity[] = [
  {
    id: 'person-001',
    type: 'person',
    canonicalName: 'Milarepa',
    names: {
      tibetan: ['མི་ལ་རས་པ།'],
      english: ['Milarepa', 'Mila Repa'],
      phonetic: ['Milarepa'],
      wylie: ['mi-la-ras-pa']
    },
    confidence: 0.95,
    // ... other fields
  }
  // ... more entities
];

// Extract relationships
const relationships = extractor.extractRelationships(text, entities);
```

## Pattern Categories (130 total)

### 1. Teacher-Student (26 patterns)
- "X taught Y" → teacher_of
- "Y studied under X for 12 years" → student_of
- Confidence: 0.80-0.93

### 2. Authorship (22 patterns)
- "X wrote the Lamrim Chenmo" → wrote
- "X translated Y from Sanskrit" → translated
- Confidence: 0.80-0.93

### 3. Location (21 patterns)
- "X lived at Y" → lived_at
- "Y founded Z in 1073" → founded
- Confidence: 0.82-0.95

### 4. Text Relationships (16 patterns)
- "X is a commentary on Y" → commentary_on
- "Y cites Z" → cites
- Confidence: 0.82-0.93

### 5. Event Participation (15 patterns)
- "X attended the council" → attended
- "Y organized the debate" → organized
- Confidence: 0.83-0.92

### 6. Lineage Transmission (12 patterns)
- "X received transmission from Y" → received_transmission
- "Y is the reincarnation of Z" → incarnation_of
- Confidence: 0.87-0.93

### 7. Institutional (10 patterns)
- "X was a monk at Y" → member_of
- "Y was a patron of Z" → patron_of
- Confidence: 0.78-0.91

### 8. Family (8 patterns)
- "X was the father of Y" → parent_of
- "Y and Z were brothers" → sibling_of
- Confidence: 0.88-0.94

## API Reference

### Main Methods

- `extractRelationships(text, entities)` - Extract all relationships
- `matchPattern(text, pattern)` - Match specific pattern
- `resolveEntityReferences(match, entities)` - Resolve entity names
- `getAllPatterns()` - Get all 130 patterns
- `getPatternsByPredicate(predicate)` - Filter by predicate
- `getPatternsByCategory(category)` - Filter by category
- `addCustomPattern(pattern)` - Add custom pattern

## Confidence Scoring

```
overallConfidence = patternConfidence × ((subjectConf + objectConf) / 2)
```

**Thresholds:**
- ≥ 0.8: Auto-accept
- 0.6-0.8: Review recommended
- < 0.6: Requires manual review

## Example Extractions

**Input:**
```
Milarepa studied under Marpa for twelve years at Lhodrak.
```

**Output:**
```typescript
[
  {
    subjectId: 'person-001',  // Milarepa
    predicate: 'student_of',
    objectId: 'person-002',    // Marpa
    properties: {
      duration: 'twelve years',
      locationText: 'Lhodrak'
    },
    confidence: 0.91,
    sourceQuote: 'Milarepa studied under Marpa for twelve years at Lhodrak.'
  },
  {
    subjectId: 'person-002',  // Marpa (inverse)
    predicate: 'teacher_of',
    objectId: 'person-001',
    confidence: 0.91
  }
]
```

## See Also

- `/home/user/Translate/roadmaps/knowledge-graph/RELATIONSHIP_TYPES.md`
- `/home/user/Translate/roadmaps/knowledge-graph/PHASES_SUMMARY.md` (lines 48-84)
