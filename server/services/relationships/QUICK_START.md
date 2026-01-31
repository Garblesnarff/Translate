# RelationshipValidator Quick Start

## Basic Usage

```typescript
import { relationshipValidator } from './services/relationships';

// Validate a single relationship
const result = relationshipValidator.validateRelationship(
  relationship,
  entities,
  allRelationships
);

if (result.valid) {
  console.log('✅ Valid relationship');
  console.log('Adjusted confidence:', result.confidence);
} else {
  console.log('❌ Invalid relationship');
  console.log('Issues:', result.issues);
}
```

## Validation Result

```typescript
interface ValidationResult {
  valid: boolean;                   // Can this relationship be saved?
  issues: ValidationIssue[];        // Errors found
  warnings: ValidationWarning[];    // Non-blocking warnings
  suggestions: Correction[];        // How to fix issues
  confidence: number;               // Adjusted confidence (0-1)
  originalConfidence: number;       // Before adjustment
}
```

## Common Patterns

### Pattern 1: Validate Before Save

```typescript
async function saveRelationship(rel: Relationship) {
  const result = relationshipValidator.validateRelationship(rel, entities);

  if (!result.valid) {
    throw new Error(`Invalid: ${result.issues[0].message}`);
  }

  rel.confidence = result.confidence; // Use adjusted confidence
  await db.insert(relationships).values(rel);
}
```

### Pattern 2: Auto-Apply Suggestions

```typescript
const result = relationshipValidator.validateRelationship(rel, entities, allRels);

// Apply safe corrections automatically
for (const suggestion of result.suggestions.filter(s => s.autoApply)) {
  if (suggestion.type === 'add_relationship') {
    // Create inverse relationship
    await createInverseRelationship(rel);
  }
  if (suggestion.type === 'remove_relationship') {
    // Remove invalid relationship
    await deleteRelationship(rel.id);
  }
}
```

### Pattern 3: Batch Validation

```typescript
const report = relationshipValidator.validateAllRelationships(
  relationships,
  entities
);

console.log(`Valid: ${report.validRelationships}/${report.totalRelationships}`);
console.log(`Average confidence: ${report.averageConfidence.toFixed(2)}`);

if (report.systematicIssues.length > 0) {
  console.log('Systematic issues detected:');
  for (const issue of report.systematicIssues) {
    console.log(`  - ${issue.pattern}: ${issue.occurrences} times`);
  }
}
```

### Pattern 4: Flag for Human Review

```typescript
const result = relationshipValidator.validateRelationship(rel, entities);

if (result.confidence < 0.5) {
  rel.needsReview = true;
  rel.reviewReason = result.issues.map(i => i.message).join('; ');
}

if (result.warnings.length > 0) {
  rel.reviewNotes = result.warnings.map(w => w.message).join('; ');
}

await db.insert(relationships).values(rel);
```

## Error Code Reference

```typescript
// Type Errors (confidence = 0)
'UNKNOWN_PREDICATE'           // Unknown relationship type
'INVALID_SUBJECT_TYPE'        // Wrong subject entity type
'INVALID_OBJECT_TYPE'         // Wrong object entity type

// Temporal Errors (confidence *= 0.5)
'ACTION_BEFORE_BIRTH'         // Action before person was born
'ACTION_AFTER_DEATH'          // Action after person died
'TEACHER_YOUNGER_THAN_STUDENT' // Teacher born after student
'UNUSUAL_AGE_DIFFERENCE'      // Small age gap (warning)
'INVALID_INCARNATION_TIMELINE' // Incarnation timeline error
'LARGE_INCARNATION_GAP'       // >50 years between incarnations
'CITES_FUTURE_TEXT'           // Text cites future text
'COMMENTARY_BEFORE_ROOT_TEXT' // Commentary before root text

// Logical Errors (confidence *= 0.3)
'SELF_RELATIONSHIP'           // Entity → itself
'CIRCULAR_RELATIONSHIP'       // A → B → C → A

// Reference Errors (confidence *= 0.85)
'MISSING_ENTITY'              // Entity not found
'MISSING_INVERSE_RELATIONSHIP' // Expected inverse missing
```

## Type Constraints (Quick Reference)

```typescript
// Teacher-Student
teacher_of: Person → Person
student_of: Person → Person

// Authorship
wrote: Person → Text
translated: Person → Text

// Spatial
lived_at: Person → Place/Institution
founded: Person → Place/Institution

// Textual
commentary_on: Text → Text
cites: Text → Text

// Family
parent_of: Person → Person
child_of: Person → Person

// Geographic
within: Place → Place

// ... 44 total relationship types
```

## Integration with Extraction Pipeline

```typescript
// After extracting relationships
const extractedRelationships = await extractRelationships(text);

for (const rel of extractedRelationships) {
  // Validate
  const result = relationshipValidator.validateRelationship(
    rel,
    entities,
    extractedRelationships
  );

  // Skip invalid
  if (!result.valid) {
    console.warn(`Skipping invalid relationship: ${result.issues[0].message}`);
    continue;
  }

  // Update confidence
  rel.confidence = result.confidence;

  // Auto-apply suggestions
  for (const suggestion of result.suggestions.filter(s => s.autoApply)) {
    if (suggestion.type === 'add_relationship') {
      extractedRelationships.push(createInverse(rel));
    }
  }

  // Save
  await saveRelationship(rel);
}
```

## Quality Monitoring

```typescript
// Daily validation report
async function dailyValidationReport() {
  const relationships = await getRelationshipsCreatedToday();
  const entities = await getAllEntities();

  const report = relationshipValidator.validateAllRelationships(
    relationships,
    entities
  );

  // Alert if quality drops
  const errorRate = report.invalidRelationships / report.totalRelationships;
  if (errorRate > 0.2) {
    await sendAlert(`High error rate: ${(errorRate * 100).toFixed(1)}%`);
  }

  // Log systematic issues
  for (const issue of report.systematicIssues) {
    console.log(`Systematic: ${issue.pattern} (${issue.occurrences}x)`);
  }

  return report;
}
```

## See Also

- **VALIDATION_EXAMPLES.md** - Detailed examples for each validation category
- **IMPLEMENTATION_SUMMARY.md** - Complete technical documentation
- **relationshipValidation.test.ts** - 14 comprehensive tests
