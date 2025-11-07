# Entity Merger Service

**Phase 2.3: Entity Resolution - Entity Merging**

Comprehensive service for merging duplicate entities while preserving all data and maintaining referential integrity across the knowledge graph.

## Overview

The EntityMerger service handles the complex process of combining duplicate entities into a single canonical entity. It:

- Detects and resolves conflicts between entity attributes
- Merges all name variants, dates, and relationships
- Maintains referential integrity by updating all foreign key references
- Tracks complete merge history for audit trails and rollback
- Provides preview functionality for human review before committing
- Supports multiple conflict resolution strategies

## Architecture

### Merge Algorithm

```
1. Lock both entities (start transaction)
2. Create snapshots for rollback
3. Validate entities (same type, not already merged)
4. Combine attributes with conflict detection
5. Resolve conflicts based on strategy
6. Update all relationships → point to primary
7. Update extraction jobs → point to primary
8. Soft delete duplicate entity
9. Record merge history
10. Commit transaction
```

### Conflict Resolution Strategies

**1. Highest Confidence** (default)
- Compares confidence scores of both entities
- Keeps value from entity with higher confidence
- Best for automatic merging

**2. Most Recent**
- Prefers value from more recently updated entity
- Assumes newer data is more accurate
- Useful for actively curated entities

**3. Manual**
- Requires curator to explicitly choose each value
- Used for high-severity conflicts
- Provides maximum control

### Attribute Resolution Rules

#### Dates
```typescript
Resolution Priority:
1. More precise date (exact > circa > estimated > disputed > unknown)
2. Higher confidence score
3. Has source citation
4. More recent extraction
```

#### Names
```typescript
Strategy: Merge all variants, deduplicate
- Combine tibetan[], english[], phonetic[], wylie[]
- Remove exact duplicates (case-insensitive)
- Preserve all unique variants
- Result: Comprehensive name coverage
```

#### Arrays (roles, titles, affiliations, etc.)
```typescript
Strategy: Union with deduplication
- Combine arrays from both entities
- Remove duplicate entries
- Preserve order where possible
- Example: ['teacher', 'scholar'] + ['teacher', 'translator']
          → ['teacher', 'scholar', 'translator']
```

#### Simple Values (gender, placeType, etc.)
```typescript
Strategy: Conflict detection + resolution
- If values match → use common value
- If values differ → flag as conflict
- Resolve based on confidence/strategy
- Log conflict for audit trail
```

## Database Schema

### Entities Table (Modified)

```sql
ALTER TABLE entities ADD COLUMN merge_status TEXT DEFAULT 'active';
ALTER TABLE entities ADD COLUMN merged_into TEXT REFERENCES entities(id);

-- merge_status values:
--   'active'  : Normal entity, can be queried
--   'merged'  : Merged into another entity (soft deleted)
--   'deleted' : Hard deleted (not used with soft delete strategy)
```

### Entity Merge History Table

```sql
CREATE TABLE entity_merge_history (
  id TEXT PRIMARY KEY,
  primary_entity_id TEXT NOT NULL REFERENCES entities(id),
  duplicate_entity_id TEXT NOT NULL REFERENCES entities(id),
  merged_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  merged_by TEXT,
  merge_strategy TEXT NOT NULL,
  conflicts_resolved JSONB, -- Array of ConflictResolution objects
  original_primary JSONB,   -- Full snapshot before merge
  original_duplicate JSONB, -- Full snapshot before merge
  relationships_updated INTEGER,
  rollback_possible BOOLEAN DEFAULT TRUE,
  notes TEXT
);
```

## Referential Integrity

### Relationship Updates

All relationships are automatically updated to point to the primary entity:

```typescript
// Before merge:
{ subjectId: 'duplicate-123', predicate: 'teacher_of', objectId: 'student-456' }
{ subjectId: 'master-789', predicate: 'student_of', objectId: 'duplicate-123' }

// After merge (duplicate-123 → primary-001):
{ subjectId: 'primary-001', predicate: 'teacher_of', objectId: 'student-456' }
{ subjectId: 'master-789', predicate: 'student_of', objectId: 'primary-001' }
```

### Extraction Jobs

Entity references within extraction job results are updated to point to the merged entity.

### Lineages

Lineage chain positions are updated if they reference the duplicate entity.

## Usage Examples

### Basic Merge

```typescript
import { entityMerger } from './services/resolution';

const result = await entityMerger.mergeEntities(
  'marpa-primary',
  'marpa-duplicate',
  {
    conflictStrategy: 'highest_confidence',
    mergedBy: 'curator-1',
    notes: 'Merging duplicate Marpa entities from different sources'
  }
);

console.log(`Merged ${result.conflictsResolved.length} conflicts`);
console.log(`Updated ${result.relationshipsUpdated} relationships`);
```

### Preview Before Merging

```typescript
const preview = await entityMerger.previewMerge(
  'tsongkhapa-1',
  'tsongkhapa-2'
);

console.log(`Would resolve ${preview.conflicts.length} conflicts`);
console.log(`Quality: ${preview.qualityAssessment.consistencyScore}`);

// Check for high-severity conflicts
const highConflicts = preview.conflicts.filter(c => c.severity === 'high');
if (highConflicts.length > 0) {
  console.log('⚠ High-severity conflicts detected - manual review needed');
} else {
  // Safe to proceed with automatic merge
  await entityMerger.mergeEntities(primary, duplicate);
}
```

### Manual Conflict Resolution

```typescript
const preview = await entityMerger.previewMerge(primary, duplicate);

// Curator reviews and decides
const manualResolutions = {};
for (const conflict of preview.conflicts) {
  if (conflict.severity === 'high') {
    // Show to curator in UI, let them choose
    manualResolutions[conflict.attribute] = curatorChoice;
  }
}

const result = await entityMerger.mergeEntities(primary, duplicate, {
  conflictStrategy: 'manual',
  manualResolutions,
  mergedBy: 'curator-2'
});
```

### Rollback a Merge

```typescript
// Merge operation
const result = await entityMerger.mergeEntities(primary, duplicate, {
  softDelete: true // Required for rollback
});

// Later, undo the merge
await entityMerger.undoMerge(result.mergeHistoryId);

// Both entities restored to original state
```

## Conflict Types

### Value Mismatch

```typescript
{
  attribute: 'gender',
  primaryValue: 'male',
  duplicateValue: 'unknown',
  conflictType: 'value_mismatch',
  severity: 'low'
}
```

**Resolution:** Keep value with higher confidence

### Date Mismatch

```typescript
{
  attribute: 'dates.birth.year',
  primaryValue: 1357,
  duplicateValue: 1356,
  conflictType: 'date_mismatch',
  severity: 'high'
}
```

**Resolution:** Keep more precise date, then higher confidence

### Array Overlap

```typescript
{
  attribute: 'roles',
  primaryValue: ['teacher', 'scholar'],
  duplicateValue: ['teacher', 'translator'],
  conflictType: 'array_overlap',
  severity: 'low'
}
```

**Resolution:** Merge arrays, deduplicate → `['teacher', 'scholar', 'translator']`

### Structure Mismatch

```typescript
{
  attribute: 'attributes',
  primaryValue: { complex: 'object' },
  duplicateValue: { different: 'structure' },
  conflictType: 'structure_mismatch',
  severity: 'medium'
}
```

**Resolution:** Deep merge objects, flag conflicts in nested values

## Merge Result

```typescript
interface MergeResult {
  mergedEntityId: string;        // Primary entity ID
  duplicateEntityId: string;     // Duplicate that was merged
  mergedEntity: Entity;          // Final combined entity
  relationshipsUpdated: number;  // Count of updated relationships
  extractionJobsUpdated: number; // Count of updated extraction refs
  conflictsResolved: ConflictResolution[];
  mergeHistoryId: string;        // For rollback
  mergedAt: Date;
  success: boolean;
  warnings?: string[];           // Any issues to note
}
```

## Edge Cases Handled

### 1. Minimal Data Entities

```typescript
// Entity with almost no data
{
  canonicalName: 'Unknown',
  names: { english: ['Unknown'], tibetan: [], phonetic: [], wylie: [] },
  confidence: 0.2
}

// Still merges successfully, primary entity data preserved
```

### 2. Conflicting Verification Status

```typescript
primary.verified = false
duplicate.verified = true

// Result: merged.verified = true (either verified = both verified)
```

### 3. Circular Merge Attempts

```typescript
// Prevented by validation
if (primary.mergeStatus === 'merged') {
  throw new Error('Primary entity already merged');
}
```

### 4. Different Entity Types

```typescript
// Prevented by validation
if (primary.type !== duplicate.type) {
  throw new Error('Cannot merge different entity types');
}
```

### 5. Self-Merge

```typescript
// Prevented by validation
if (primaryId === duplicateId) {
  throw new Error('Cannot merge entity with itself');
}
```

## Performance Considerations

### Transaction Isolation

All merge operations run in database transactions:
- Ensures atomic operations (all-or-nothing)
- Locks entities during merge to prevent concurrent modifications
- Rollback on any error

### Batch Merging

For merging multiple duplicates:

```typescript
const pairs = await duplicateDetector.findAllDuplicates();

for (const pair of pairs) {
  // Preview first
  const preview = await entityMerger.previewMerge(pair.primary, pair.duplicate);

  // Skip if high conflicts
  if (preview.conflicts.some(c => c.severity === 'high')) {
    continue;
  }

  // Merge
  await entityMerger.mergeEntities(pair.primary, pair.duplicate);
}
```

### Index Usage

Queries use indexes on:
- `entities.merge_status` - Filter active entities
- `entities.merged_into` - Resolve merge chains
- `entity_merge_history.primary_entity_id` - Audit queries
- `entity_merge_history.merged_at` - Temporal queries

## Quality Metrics

### Data Completeness

```typescript
Calculated as: (filled_fields / total_expected_fields)

- canonicalName: required
- names.tibetan: high value
- names.english: high value
- attributes: type-specific
- dates: type-specific
- verified: bonus points
```

### Consistency Score

```typescript
Calculated as: 1.0 - (conflict_count * 0.1)

- No conflicts: 1.0
- 5 conflicts: 0.5
- 10+ conflicts: 0.0
```

### Source Reliability

```typescript
Based on:
- Entity confidence score
- Verification status
- Source document quality
- Extraction model confidence
```

## Integration with Knowledge Graph

### Query Active Entities

```typescript
// Only get active entities (exclude merged/deleted)
const entities = await db
  .select()
  .from(entities)
  .where(eq(entities.mergeStatus, 'active'));
```

### Resolve Merge Chains

```typescript
// Follow merge chain to find canonical entity
function resolveEntity(entityId: string): string {
  const entity = db.select().from(entities).where(eq(entities.id, entityId));

  if (entity.mergeStatus === 'merged') {
    return resolveEntity(entity.mergedInto!);
  }

  return entityId;
}
```

### Audit Trail

```typescript
// Get complete merge history for an entity
const history = await db
  .select()
  .from(entityMergeHistory)
  .where(eq(entityMergeHistory.primaryEntityId, entityId))
  .orderBy(desc(entityMergeHistory.mergedAt));
```

## Future Enhancements

### 1. Confidence-Based Auto-Merge

```typescript
// Automatically merge if similarity > 0.95 and no high conflicts
if (similarity > 0.95 && !hasHighConflicts) {
  await autoMerge(primary, duplicate);
}
```

### 2. Merge Suggestions

```typescript
// ML model suggests optimal primary entity
const suggestion = await mergeSuggester.recommend(entity1, entity2);
// Returns which should be primary based on data quality
```

### 3. Merge Clustering

```typescript
// Merge N entities into 1 (not just pairwise)
await entityMerger.mergeCluster([
  'entity-1',
  'entity-2',
  'entity-3',
  'entity-4'
], { primaryId: 'entity-1' });
```

### 4. Provenance Tracking

```typescript
// Track which source each attribute came from
mergedEntity._provenance = {
  canonicalName: 'primary',
  'dates.birth': 'duplicate',
  'attributes.roles': 'merged'
};
```

## References

- **Phase 2.3 Specification**: `/roadmaps/knowledge-graph/PHASES_SUMMARY.md` (lines 24-30)
- **Entity Types**: `/server/types/entities.ts`
- **Database Schema**: `/db/schema.ts`
- **FuzzyMatcher**: `/server/services/resolution/FuzzyMatcher.ts`

## Support

For issues, questions, or feature requests related to entity merging:

1. Check existing test cases in `EntityMerger.test.ts`
2. Review examples in `EntityMerger.examples.ts`
3. Consult Phase 2.3 roadmap documentation
4. Check merge history table for audit trails

---

**Status**: ✅ Complete (Phase 2.3)
**Last Updated**: 2024-11-07
**Maintainer**: Knowledge Graph Team
