# Relationship Validation Examples

This document demonstrates the comprehensive validation capabilities of the RelationshipValidator service.

## Overview

The RelationshipValidator performs 4 categories of validation:

1. **Type Constraints** - Ensures entity types match relationship requirements
2. **Temporal Consistency** - Validates timeline coherence (birth/death, dates)
3. **Logical Constraints** - Checks for circular relationships and self-references
4. **Cross-References** - Validates bidirectional relationships

## Type Constraint Validation

### Valid Example: teacher_of (Person → Person)

```typescript
import { relationshipValidator } from './RelationshipValidator';

const marpa: PersonEntity = {
  id: 'marpa-1',
  type: 'person',
  canonicalName: 'Marpa',
  // ... other fields
};

const milarepa: PersonEntity = {
  id: 'milarepa-1',
  type: 'person',
  canonicalName: 'Milarepa',
  // ... other fields
};

const relationship: Relationship = {
  id: 'rel-1',
  subjectId: 'marpa-1',
  predicate: 'teacher_of',
  objectId: 'milarepa-1',
  confidence: 0.9,
  // ... other fields
};

const entities = new Map([
  ['marpa-1', marpa],
  ['milarepa-1', milarepa]
]);

const result = relationshipValidator.validateRelationship(relationship, entities);

console.log(result);
// {
//   valid: true,
//   issues: [],
//   warnings: [{
//     severity: 'warning',
//     category: 'reference',
//     message: 'Bidirectional relationship missing...',
//     code: 'MISSING_INVERSE_RELATIONSHIP'
//   }],
//   suggestions: [{
//     type: 'add_relationship',
//     description: 'Add inverse relationship: Milarepa student_of Marpa',
//     autoApply: true
//   }],
//   confidence: 0.765, // Reduced from 0.9 due to warning
//   originalConfidence: 0.9
// }
```

### Invalid Example: teacher_of (Person → Text)

```typescript
const person: PersonEntity = { type: 'person', /* ... */ };
const text: TextEntity = { type: 'text', /* ... */ };

const invalidRelationship: Relationship = {
  subjectId: person.id,
  predicate: 'teacher_of', // Expects Person → Person
  objectId: text.id,        // But got Text!
  // ...
};

const result = relationshipValidator.validateRelationship(invalidRelationship, entities);

// {
//   valid: false,
//   issues: [{
//     severity: 'error',
//     category: 'type',
//     message: 'Invalid object type for teacher_of: expected person, got text',
//     code: 'INVALID_OBJECT_TYPE',
//     suggestion: 'Change object to person entity'
//   }],
//   confidence: 0, // Type errors = invalid relationship
//   originalConfidence: 0.9
// }
```

### All Type Constraints

```typescript
// Teacher-Student
teacher_of: Person → Person
student_of: Person → Person

// Authorship
wrote: Person → Text
translated: Person → Text
compiled: Person → Text

// Spatial
lived_at: Person → Place/Institution
visited: Person → Place
founded: Person → Place/Institution
born_in: Person → Place
died_in: Person → Place

// Textual
commentary_on: Text → Text
cites: Text → Text
part_of: Text/Place → Text/Place (same type)
contains: Text/Place → Text/Place (same type)
mentions: Text → Person/Place/Event/Concept/Deity

// Transmission
received_transmission: Person → Person
gave_empowerment: Person → Person
transmitted_to: Person → Person

// Family
parent_of: Person → Person
child_of: Person → Person
sibling_of: Person → Person
spouse_of: Person → Person

// Geographic
within: Place → Place
near: Place → Place

// Conceptual
practiced: Person → Concept
held_view: Person → Concept
taught_concept: Person → Concept

// Temporal
preceded: Event → Event
followed: Event → Event
contemporary_with: Person → Person
```

## Temporal Consistency Validation

### Error: Action Before Birth

```typescript
const person: PersonEntity = {
  type: 'person',
  dates: {
    birth: { year: 1050, precision: 'exact', confidence: 0.9 }
  },
  // ...
};

const relationship: Relationship = {
  subjectId: person.id,
  predicate: 'founded',
  objectId: monastery.id,
  properties: {
    date: { year: 1040, precision: 'exact', confidence: 0.9 } // 10 years before birth!
  },
  // ...
};

const result = relationshipValidator.validateRelationship(relationship, entities);

// {
//   valid: false,
//   issues: [{
//     severity: 'error',
//     category: 'temporal',
//     message: 'Person performed action before birth (birth: 1050, action: 1040)',
//     code: 'ACTION_BEFORE_BIRTH',
//     suggestion: 'Check birth date accuracy or event date accuracy'
//   }],
//   suggestions: [{
//     type: 'modify_date',
//     description: 'Review and correct birth date or event date',
//     confidence: 0.5
//   }, {
//     type: 'mark_disputed',
//     description: "Mark date as 'disputed' if sources conflict",
//     confidence: 0.7
//   }]
// }
```

### Error: Action After Death

```typescript
const author: PersonEntity = {
  dates: {
    birth: { year: 1050, precision: 'exact', confidence: 0.9 },
    death: { year: 1100, precision: 'exact', confidence: 0.9 }
  },
  // ...
};

const relationship: Relationship = {
  subjectId: author.id,
  predicate: 'teacher_of',
  objectId: student.id,
  properties: {
    date: { year: 1110, precision: 'exact', confidence: 0.9 } // 10 years after death!
  },
  // ...
};

// Result: ERROR - ACTION_AFTER_DEATH
```

### Error: Teacher Younger Than Student

```typescript
const teacher: PersonEntity = {
  dates: { birth: { year: 1070, precision: 'exact', confidence: 0.9 } }
};

const student: PersonEntity = {
  dates: { birth: { year: 1050, precision: 'exact', confidence: 0.9 } } // Born BEFORE teacher
};

const relationship: Relationship = {
  subjectId: teacher.id,
  predicate: 'teacher_of',
  objectId: student.id,
  // ...
};

// Result: ERROR - TEACHER_YOUNGER_THAN_STUDENT
```

### Warning: Unusual Age Difference

```typescript
const teacher: PersonEntity = {
  dates: { birth: { year: 1050, precision: 'exact', confidence: 0.9 } }
};

const student: PersonEntity = {
  dates: { birth: { year: 1045, precision: 'exact', confidence: 0.9 } } // Only 5 years older
};

// Result: WARNING - UNUSUAL_AGE_DIFFERENCE
// Confidence reduced by 15%
```

### Error: Incarnation Timeline Invalid

```typescript
const laterIncarnation: PersonEntity = {
  dates: { birth: { year: 1920, precision: 'exact', confidence: 0.9 } }
};

const earlierIncarnation: PersonEntity = {
  dates: { death: { year: 1930, precision: 'exact', confidence: 0.9 } } // Died AFTER next incarnation born
};

const relationship: Relationship = {
  subjectId: laterIncarnation.id,
  predicate: 'incarnation_of',
  objectId: earlierIncarnation.id,
  // ...
};

// Result: ERROR - INVALID_INCARNATION_TIMELINE
```

### Error: Text Cites Future Text

```typescript
const laterText: TextEntity = {
  dates: { composed: { year: 1200, precision: 'exact', confidence: 0.9 } }
};

const earlierText: TextEntity = {
  dates: { composed: { year: 1300, precision: 'exact', confidence: 0.9 } } // Composed LATER
};

const relationship: Relationship = {
  subjectId: laterText.id,
  predicate: 'cites',
  objectId: earlierText.id,
  // ...
};

// Result: ERROR - CITES_FUTURE_TEXT
```

### Error: Commentary Before Root Text

```typescript
const commentary: TextEntity = {
  dates: { composed: { year: 1100, precision: 'exact', confidence: 0.9 } }
};

const rootText: TextEntity = {
  dates: { composed: { year: 1200, precision: 'exact', confidence: 0.9 } } // Composed LATER
};

const relationship: Relationship = {
  subjectId: commentary.id,
  predicate: 'commentary_on',
  objectId: rootText.id,
  // ...
};

// Result: ERROR - COMMENTARY_BEFORE_ROOT_TEXT
```

## Logical Constraint Validation

### Error: Self-Relationship

```typescript
const person: PersonEntity = { id: 'person-1', /* ... */ };

const relationship: Relationship = {
  subjectId: 'person-1',
  predicate: 'teacher_of',
  objectId: 'person-1', // Same as subject!
  // ...
};

// Result: ERROR - SELF_RELATIONSHIP
// Suggestion: Remove this relationship
```

### Error: Circular Relationship

```typescript
// A → B → C → A (circular!)
const relationships: Relationship[] = [
  { subjectId: 'A', predicate: 'teacher_of', objectId: 'B' },
  { subjectId: 'B', predicate: 'teacher_of', objectId: 'C' },
  { subjectId: 'C', predicate: 'teacher_of', objectId: 'A' } // Creates cycle!
];

const result = relationshipValidator.validateRelationship(
  relationships[2],
  entities,
  relationships
);

// {
//   valid: false,
//   issues: [{
//     severity: 'error',
//     category: 'logical',
//     message: 'Circular relationship detected: Cycle in teacher_of: A → B → C → A',
//     code: 'CIRCULAR_RELATIONSHIP',
//     affectedEntities: ['A', 'B', 'C']
//   }],
//   suggestions: [{
//     type: 'remove_relationship',
//     description: 'Review and remove one relationship in the cycle',
//     confidence: 0.5
//   }]
// }
```

## Cross-Reference Validation

### Warning: Missing Inverse Relationship

```typescript
const teacher: PersonEntity = { id: 'teacher-1', /* ... */ };
const student: PersonEntity = { id: 'student-1', /* ... */ };

const relationship: Relationship = {
  subjectId: 'teacher-1',
  predicate: 'teacher_of',
  objectId: 'student-1',
  // ...
};

const result = relationshipValidator.validateRelationship(
  relationship,
  entities,
  [] // No other relationships exist
);

// {
//   valid: true, // Not an error, just a warning
//   warnings: [{
//     severity: 'warning',
//     category: 'reference',
//     message: 'Bidirectional relationship missing: expected inverse relationship (student_of)',
//     code: 'MISSING_INVERSE_RELATIONSHIP',
//     autoFixable: true
//   }],
//   suggestions: [{
//     type: 'add_relationship',
//     description: 'Add inverse relationship: Student student_of Teacher',
//     autoApply: true,
//     confidence: 0.95
//   }]
// }
```

### Valid: Inverse Relationship Exists

```typescript
const relationships: Relationship[] = [
  {
    subjectId: 'teacher-1',
    predicate: 'teacher_of',
    objectId: 'student-1'
  },
  {
    subjectId: 'student-1',
    predicate: 'student_of',
    objectId: 'teacher-1' // Inverse exists!
  }
];

const result = relationshipValidator.validateRelationship(
  relationships[0],
  entities,
  relationships
);

// No warnings about missing inverse relationship
```

## Batch Validation

### Validate All Relationships

```typescript
const relationships: Relationship[] = [
  // 100 relationships...
];

const report = relationshipValidator.validateAllRelationships(relationships, entities);

console.log(report);
// {
//   totalRelationships: 100,
//   validRelationships: 85,
//   invalidRelationships: 15,
//   totalIssues: 23,
//   issuesByCategory: {
//     type: 5,
//     temporal: 10,
//     logical: 3,
//     reference: 5
//   },
//   issueBySeverity: {
//     error: 15,
//     warning: 8
//   },
//   averageConfidence: 0.73,
//   systematicIssues: [
//     {
//       pattern: 'ACTION_AFTER_DEATH',
//       occurrences: 8,
//       affectedRelationships: ['person-1', 'person-5', ...],
//       suggestedFix: 'Check death date accuracy or event date accuracy'
//     }
//   ],
//   recommendations: [
//     'High error rate (15.0%). Review extraction prompts and patterns.',
//     'Systematic issue detected: ACTION_AFTER_DEATH (8 occurrences). Check death date accuracy or event date accuracy'
//   ]
// }
```

## Confidence Adjustment

The validator automatically adjusts confidence based on issues:

```typescript
// Original confidence: 0.9

// Type errors → confidence = 0
// Temporal errors → confidence *= 0.5^(error_count)
// Logical errors → confidence *= 0.3^(error_count)
// Warnings → confidence *= 0.85^(warning_count)

// Example:
// 1 temporal error: 0.9 * 0.5 = 0.45
// 2 warnings: 0.9 * 0.85^2 = 0.65
// 1 type error: 0 (invalid)
```

## Integration with Extraction Pipeline

### During Extraction

```typescript
import { relationshipValidator } from './services/relationships';

// After extracting relationships
const extractedRelationships = await extractRelationships(text);

// Validate each relationship
for (const rel of extractedRelationships) {
  const result = relationshipValidator.validateRelationship(rel, entities, extractedRelationships);

  if (!result.valid) {
    console.warn(`Invalid relationship: ${result.issues[0].message}`);
    // Don't save to database
    continue;
  }

  if (result.warnings.length > 0) {
    console.log(`Warnings for relationship: ${result.warnings.map(w => w.message).join(', ')}`);
  }

  // Update confidence with validation result
  rel.confidence = result.confidence;

  // Save to database
  await saveRelationship(rel);

  // Auto-apply suggestions
  for (const suggestion of result.suggestions.filter(s => s.autoApply)) {
    if (suggestion.type === 'add_relationship') {
      await createInverseRelationship(rel);
    }
  }
}
```

### Before Saving to Database

```typescript
// Validate before insert
async function saveRelationship(relationship: Relationship, entities: Map<string, Entity>) {
  const result = relationshipValidator.validateRelationship(relationship, entities);

  if (!result.valid) {
    throw new Error(`Cannot save invalid relationship: ${result.issues[0].message}`);
  }

  // Use adjusted confidence
  relationship.confidence = result.confidence;

  // Flag for human review if confidence is low
  if (result.confidence < 0.5) {
    relationship.needsReview = true;
    relationship.reviewReason = result.issues.map(i => i.message).join('; ');
  }

  await db.insert(relationships).values(relationship);
}
```

### After Entity Merge

```typescript
// Re-validate all relationships after merging entities
async function mergeEntities(entityA: Entity, entityB: Entity) {
  // Merge entities
  const mergedEntity = merge(entityA, entityB);

  // Get all relationships involving these entities
  const affectedRelationships = await getRelationshipsForEntities([entityA.id, entityB.id]);

  // Update relationship pointers
  for (const rel of affectedRelationships) {
    if (rel.subjectId === entityB.id) rel.subjectId = mergedEntity.id;
    if (rel.objectId === entityB.id) rel.objectId = mergedEntity.id;
  }

  // Re-validate
  const entities = await getAllEntities();
  const report = relationshipValidator.validateAllRelationships(affectedRelationships, entities);

  console.log(`Re-validation after merge: ${report.invalidRelationships} invalid relationships`);

  // Remove invalid relationships
  for (const rel of affectedRelationships) {
    const result = relationshipValidator.validateRelationship(rel, entities);
    if (!result.valid) {
      await deleteRelationship(rel.id);
    }
  }
}
```

## Quality Monitoring

### Daily Validation Report

```typescript
// Run daily to monitor extraction quality
async function generateDailyValidationReport() {
  const today = new Date();
  const relationships = await getRelationshipsCreatedToday(today);
  const entities = await getAllEntities();

  const report = relationshipValidator.validateAllRelationships(relationships, entities);

  // Send to monitoring dashboard
  await sendToDatadog({
    metric: 'relationship.validation.error_rate',
    value: report.invalidRelationships / report.totalRelationships,
    tags: ['phase:extraction']
  });

  // Alert if quality drops
  if (report.invalidRelationships / report.totalRelationships > 0.2) {
    await sendSlackAlert('⚠️ High relationship validation error rate: ' +
      (report.invalidRelationships / report.totalRelationships * 100).toFixed(1) + '%');
  }

  // Log systematic issues
  for (const issue of report.systematicIssues) {
    console.log(`Systematic issue: ${issue.pattern} (${issue.occurrences} times)`);
  }
}
```

## Summary

The RelationshipValidator provides comprehensive validation across 4 categories:

✅ **Type Constraints** - 20+ relationship types with specific entity type requirements
✅ **Temporal Consistency** - Birth/death timeline validation, incarnation checks, text dating
✅ **Logical Constraints** - Self-relationship detection, circular relationship detection
✅ **Cross-References** - Bidirectional relationship validation with auto-fix suggestions

**Key Features:**
- Auto-correction suggestions for common issues
- Confidence adjustment based on validation results
- Batch validation with systematic issue detection
- Integration with extraction pipeline
- Quality monitoring and reporting

**Validation Rules:** 25+ validation rules implemented
**Auto-fixes:** 5+ auto-applicable corrections
**Error Codes:** 15+ specific error codes for programmatic handling
