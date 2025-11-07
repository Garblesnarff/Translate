# Entity Review Dashboard - Implementation Summary

## Overview
Created a comprehensive human review workflow UI for Phase 2, Task 2.4 - Entity Resolution. The dashboard allows curators to review, compare, and merge duplicate entities detected across different documents.

## Files Created

### 1. `/home/user/Translate/client/src/pages/EntityReviewDashboard.tsx` (1,150 lines)
Main dashboard component with complete review workflow

### 2. `/home/user/Translate/client/src/main.tsx` (Updated)
Added route: `/entity-review` → `EntityReviewDashboard`

## Components Created

### Core Components

#### 1. **EntityReviewDashboard** (Main Component)
- Tab-based interface: Review Queue + Comparison View
- Statistics dashboard (Pending, Merged, Rejected, Flagged)
- Filter system (type, confidence, sorting)
- Pagination (20 items per page)
- Bulk operations support

#### 2. **Review Queue Table**
Columns:
- **Checkbox** - Select for bulk operations
- **Entity 1** - Name + source count
- **Entity 2** - Name + source count
- **Type** - Person, Place, Text, Organization, Concept
- **Similarity** - 0-100% score with color coding
- **Confidence** - High/Medium/Low badge
- **Sources** - Total source count (entity1 + entity2)
- **Date** - Detection date
- **Actions** - Merge, Reject, Flag buttons

#### 3. **Side-by-Side Comparison** (EntityCard)
Features:
- **Entity metadata** - Name, type, source count, first/last seen
- **Attributes panel** - All entity attributes with:
  - Attribute name and value
  - Confidence score badge
  - Source document reference
  - Highlight differences in yellow
- **Relationships panel** - Visual relationship display with:
  - Relationship type
  - Target entity
  - Confidence scores

#### 4. **Merge Preview Dialog** (MergePreviewDialog)
Shows:
- Merged entity name (defaults to entity1)
- Merged entity type
- Combined attributes (highest confidence wins)
- Total source count
- Confirm/Cancel actions

#### 5. **Supporting Components**
- **EntityTypeIcon** - Icons for each entity type
- **ConfidenceBadge** - Color-coded confidence levels
- **SimilarityScore** - Color-coded similarity percentage

## Mock Data

### Entity Pairs Generated (6 examples)

1. **Marpa Lotsawa vs Mar-pa** (95% similarity, HIGH confidence)
   - Person entity
   - Birth year matches (1012)
   - Teacher-student relationships align
   - Different transliteration styles

2. **Sakya Monastery vs Sa-skya dgon-pa** (88%, HIGH)
   - Place entity
   - Founded date matches (1073)
   - Location variants (Shigatse vs Tsang region)
   - Wylie vs simplified names

3. **Hevajra Tantra vs Kye Dorje Root Tantra** (78%, MEDIUM)
   - Text entity
   - Same category (Highest Yoga Tantra)
   - Different names for same text
   - Related deity (Hevajra)

4. **Milarepa vs Jetsun Mila** (85%, HIGH)
   - Person entity
   - Birth year discrepancy (1052 vs 1040)
   - Same teacher (Marpa)
   - Title variants

5. **Naropa vs Naro Bon Chung** (42%, LOW)
   - Person entity
   - FALSE POSITIVE - different people
   - Similar names, different contexts
   - Tests low-confidence rejection workflow

6. **Gampopa vs Dagpo Lhaje** (91%, HIGH)
   - Person entity
   - Same person, different titles
   - "Dagpo Lhaje" = "Physician from Dagpo" = Gampopa's title
   - Tests name/title merging

### Mock Data Structure
```typescript
interface EntityPair {
  id: string;
  entity1: Entity;
  entity2: Entity;
  similarityScore: number; // 0.0 - 1.0
  confidence: 'high' | 'medium' | 'low';
  status: 'pending' | 'merged' | 'rejected' | 'flagged';
  detectedDate: string;
  reviewedBy?: string;
  reviewedAt?: string;
}

interface Entity {
  id: string;
  name: string;
  type: 'person' | 'place' | 'text' | 'organization' | 'concept';
  attributes: EntityAttribute[];
  relationships: EntityRelationship[];
  sourceCount: number;
  firstSeen: string;
  lastSeen: string;
}
```

## UI Layout

### Review Queue Tab
```
┌─────────────────────────────────────────────────────────┐
│  Entity Resolution Review                    [Export]   │
├─────────────────────────────────────────────────────────┤
│  Stats: Pending: 6  Merged: 0  Rejected: 0  Flagged: 0 │
├─────────────────────────────────────────────────────────┤
│  Filters                    [Merge Selected] [Reject]   │
│  Entity Type: [All] Confidence: [All] Sort: [Sim ▼]    │
├─────────────────────────────────────────────────────────┤
│  Duplicate Candidates (6)                               │
│  ┌───┬────────┬────────┬──────┬─────┬─────┬────┬────┐  │
│  │☐ │Entity1 │Entity2 │Type  │Sim  │Conf │Src │Act │  │
│  ├───┼────────┼────────┼──────┼─────┼─────┼────┼────┤  │
│  │☐ │Marpa   │Mar-pa  │Person│95%  │HIGH │8   │M/R │  │
│  │☐ │Sakya   │Sa-skya │Place │88%  │HIGH │12  │M/R │  │
│  └───┴────────┴────────┴──────┴─────┴─────┴────┴────┘  │
│                                          Page 1 of 1    │
└─────────────────────────────────────────────────────────┘
```

### Comparison View Tab
```
┌─────────────────────────────────────────────────────────┐
│  Entity Comparison                                      │
│  Similarity: 95% • Confidence: HIGH                     │
│                      [Merge] [Not same] [Unsure]        │
├──────────────────────────┬──────────────────────────────┤
│  Marpa Lotsawa          │  Mar-pa                      │
│  Person • 5 sources     │  Person • 3 sources          │
│  ┌────────────────────┐ │ ┌────────────────────┐       │
│  │ Attributes:        │ │ │ Attributes:        │       │
│  │ birth_year: 1012   │ │ │ birth_year: 1012   │       │
│  │ birthplace: Lhodrak│ │ │ birthplace: S.Tibet│ [!]   │
│  │ title: Great Trans │ │ │ title: Translator  │ [!]   │
│  └────────────────────┘ │ └────────────────────┘       │
│  ┌────────────────────┐ │ ┌────────────────────┐       │
│  │ Relationships:     │ │ │ Relationships:     │       │
│  │ → student_of Narop │ │ │ → student_of Narop │       │
│  │ → teacher_of Milar │ │ │ → teacher_of Mila  │       │
│  └────────────────────┘ │ └────────────────────┘       │
└──────────────────────────┴──────────────────────────────┘
```

## Workflow Steps

### Single Review Workflow
1. **View Queue** - See all pending entity pairs
2. **Filter/Sort** - Narrow down by type/confidence
3. **Click Row** - Open comparison view
4. **Review Side-by-Side** - Compare attributes/relationships
5. **Make Decision**:
   - **Merge** → Preview → Confirm → Status: merged
   - **Not the same** → Mark rejected → Remove from queue
   - **Unsure** → Flag for expert review → Skip for now

### Bulk Operations Workflow
1. **Select Multiple** - Use checkboxes
2. **Bulk Merge** (high-confidence only):
   - Validates all selected are high confidence
   - Shows error if any are medium/low
   - Confirms bulk action
   - Merges all selected pairs
3. **Bulk Reject** - Rejects all selected pairs

### Merge Preview Workflow
1. Click "Merge" button
2. System generates preview:
   - Takes entity1.name as merged name
   - Combines all attributes (highest confidence wins)
   - Sums source counts
3. Curator reviews merged result
4. Confirms or cancels
5. On confirm:
   - Updates status to "merged"
   - Shows success toast
   - Removes from queue

## Features Implemented

### Filtering
- **Entity Type**: All, Person, Place, Text, Organization, Concept
- **Confidence**: All, High, Medium, Low
- **Sort**: By similarity or date
- **Sort Order**: Ascending/Descending

### State Management
- React useState for local state
- Set-based selection tracking
- Filtered/sorted data memoization
- Pagination state

### Responsive Design
- Mobile: Stacked cards, horizontal scroll for table
- Desktop: Full table layout, side-by-side comparison
- Flexbox-based filter controls

### Visual Feedback
- Color-coded similarity scores:
  - Green: ≥85%
  - Yellow: 70-84%
  - Red: <70%
- Confidence badges:
  - Green: High
  - Yellow: Medium
  - Red: Low
- Highlighted differences in comparison view (yellow background)
- Selected row highlighting (blue background)
- Toast notifications for actions

## shadcn/ui Components Used
- **Card** - Container layouts
- **Badge** - Status/confidence indicators
- **Button** - Actions
- **Checkbox** - Bulk selection
- **Dialog** - Merge preview
- **Select** - Filter dropdowns
- **Input** - Text fields (in preview)
- **Label** - Form labels
- **Tabs** - Queue/Comparison switching
- **ScrollArea** - Long content scrolling
- **Separator** - Visual dividers

## TanStack Query Integration (Ready)
```typescript
// Currently using mock data, but structure is ready for:
const { data, isLoading, error } = useQuery({
  queryKey: ['/api/entity-resolution/pending'],
  refetchInterval: 30000, // Auto-refresh
});
```

Future API endpoints needed:
- `GET /api/entity-resolution/pending` - Get pending pairs
- `POST /api/entity-resolution/merge/:pairId` - Merge entities
- `POST /api/entity-resolution/reject/:pairId` - Reject pair
- `POST /api/entity-resolution/flag/:pairId` - Flag for review
- `POST /api/entity-resolution/bulk-merge` - Bulk merge
- `POST /api/entity-resolution/bulk-reject` - Bulk reject

## What's Mocked vs. What Will Be Real

### Currently Mocked (Client-side only)
✅ **Mock Data**:
- 6 entity pairs with full attributes/relationships
- Similarity scores (0.42 - 0.95)
- Confidence levels (high/medium/low)
- Entity types (person, place, text)
- Source counts and dates

✅ **Mock Actions**:
- Merge operation (updates local state)
- Reject operation (updates local state)
- Flag operation (updates local state)
- Bulk operations (updates local state)

✅ **Mock Filters/Sorting**:
- All filtering happens client-side
- All sorting happens client-side
- Pagination is client-side

### Will Be Real (Backend integration needed)
❌ **API Calls**:
- Fetch pending pairs from database
- POST merge requests to backend
- POST reject/flag decisions to backend
- Real-time updates via polling/websockets

❌ **Database Persistence**:
- Store merge decisions
- Update entity records
- Track curator actions
- Maintain audit trail

❌ **Entity Resolution Service**:
- Fuzzy name matching
- Similarity scoring algorithms
- Duplicate detection
- Merge conflict resolution

❌ **Authentication**:
- Track who reviewed what (reviewedBy field)
- Role-based access (curator vs. expert)
- Review history per user

## Next Steps for Backend Integration

1. **Phase 2.1** - Implement fuzzy name matching service
2. **Phase 2.2** - Build duplicate detection service
3. **Phase 2.3** - Create entity merging service
4. **Phase 2.4** - Connect UI to backend APIs (this UI)
5. **Phase 2.5** - Add ML training pipeline for curator decisions

## Access Instructions

1. **Start dev server**: `npm run dev`
2. **Navigate to**: `http://localhost:5439/entity-review`
3. **Test workflows**:
   - Click different rows to compare
   - Use filters to narrow results
   - Try merge/reject/flag actions
   - Select multiple and test bulk operations
   - View merge preview before confirming

## Key Design Decisions

1. **Mock data first** - UI development independent of backend
2. **Tab-based layout** - Separate queue browsing from detailed comparison
3. **Side-by-side comparison** - Easy visual comparison of entities
4. **Color-coded confidence** - Instant visual feedback on match quality
5. **Bulk operations** - Efficiency for high-confidence obvious matches
6. **Merge preview** - Safety check before irreversible merge
7. **Highlight differences** - Yellow background for conflicting attributes
8. **Three-option workflow** - Merge/Reject/Flag covers all scenarios
9. **Source tracking** - Show which document each attribute came from
10. **Responsive design** - Works on mobile for field work

## Statistics

- **Lines of Code**: 1,150
- **Components**: 6 major components
- **Mock Entity Pairs**: 6 examples
- **UI States**: Pending, Merged, Rejected, Flagged
- **Filter Options**: 3 filters × multiple values
- **Actions per Row**: 3 (Merge, Reject, Flag)
- **Bulk Actions**: 2 (Merge, Reject)
- **shadcn/ui Components**: 12 different components
