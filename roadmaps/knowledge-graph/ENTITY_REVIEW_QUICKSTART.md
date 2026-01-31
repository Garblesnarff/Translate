# Entity Review Dashboard - Quick Start Guide

## Access the Dashboard

### 1. Start Development Server
```bash
npm run dev
```

### 2. Open Browser
Navigate to: **http://localhost:5439/entity-review**

---

## What You'll See

### Dashboard Overview
```
┌─────────────────────────────────────────────────────┐
│  Entity Resolution Review              [Export]     │
├─────────────────────────────────────────────────────┤
│  📊 Stats Cards                                     │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐  │
│  │Pending:6│ │Merged:0 │ │Rejected:│ │Flagged:0│  │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘  │
├─────────────────────────────────────────────────────┤
│  🔍 Filters                                         │
│  Entity Type: [All ▼]  Confidence: [All ▼]         │
│  Sort: [Similarity ▼]  Order: [▼]                  │
├─────────────────────────────────────────────────────┤
│  📋 Review Queue                                    │
│  (Table with 6 entity pairs)                       │
└─────────────────────────────────────────────────────┘
```

---

## Try These Workflows

### Workflow 1: Review a High-Confidence Match (Easy)
**Scenario**: Obvious duplicate with different transliteration

1. **Find the pair**: `Marpa Lotsawa` vs `Mar-pa` (95% similarity)
2. **Click the row** to view comparison
3. **Switch to "Comparison View" tab**
4. **Review side-by-side**:
   - ✅ Birth year matches (1012)
   - ⚠️ Birthplace differs (Lhodrak vs Southern Tibet)
   - ✅ Same teacher (Naropa)
5. **Click "Merge" button**
6. **Review merge preview**:
   - See combined attributes
   - Highest confidence values selected
   - Total sources: 8 (5 + 3)
7. **Click "Confirm Merge"**
8. **Result**: Success toast, pair removed from queue

**Expected outcome**: Entities merged successfully

---

### Workflow 2: Reject a False Positive (Low Confidence)
**Scenario**: Similar names, but different people

1. **Find the pair**: `Naropa` vs `Naro Bon Chong` (42% similarity, LOW)
2. **Click the row** to compare
3. **Review differences**:
   - Naropa: Buddhist master at Nalanda
   - Naro Bon Chong: Bon practitioner, rival of Milarepa
   - Completely different people!
4. **Click "Not the same" button**
5. **Result**: Pair marked as rejected, removed from queue

**Expected outcome**: False positive correctly rejected

---

### Workflow 3: Flag for Expert Review (Uncertain)
**Scenario**: Similar entities but conflicting information

1. **Find the pair**: `Milarepa` vs `Jetsun Mila` (85% similarity)
2. **Review comparison**:
   - Same person, different names (title vs name)
   - BUT: Birth years don't match (1052 vs 1040)
   - Relationships align
3. **Click "Unsure" button**
4. **Result**: Flagged for expert historian review

**Expected outcome**: Pair flagged, removed from queue, added to expert queue

---

### Workflow 4: Bulk Merge High-Confidence Matches
**Scenario**: Process multiple obvious duplicates quickly

1. **Filter to high confidence only**:
   - Confidence: [High ▼]
2. **Select multiple pairs**:
   - ☑ Marpa Lotsawa / Mar-pa (95%)
   - ☑ Sakya Monastery / Sa-skya dgon-pa (88%)
   - ☑ Milarepa / Jetsun Mila (85%)
3. **Click "Merge Selected (3)" button**
4. **Confirm bulk action**
5. **Result**: 3 pairs merged in one operation

**Expected outcome**: Bulk merge success, queue reduced by 3

---

### Workflow 5: Use Filters to Focus
**Scenario**: Review only specific entity types

1. **Filter by type**:
   - Entity Type: [Person ▼]
2. **Result**: Shows only person entities (4 pairs)
3. **Filter by confidence**:
   - Confidence: [High ▼]
4. **Result**: Shows only high-confidence person pairs (3 pairs)
5. **Sort by date**:
   - Sort: [Date ▼]
6. **Result**: Newest detections first

**Expected outcome**: Focused review of specific entity types

---

## Mock Data Examples

### Example 1: Obvious Transliteration Variant
```
Entity 1: Marpa Lotsawa (5 sources)
Entity 2: Mar-pa (3 sources)
Similarity: 95% (HIGH confidence)

Why similar:
✅ Same birth year (1012)
✅ Same teacher (Naropa)
✅ Same student (Milarepa)
⚠️ Different birthplace names

Recommendation: MERGE
```

### Example 2: Place Name Variant
```
Entity 1: Sakya Monastery (8 sources)
Entity 2: Sa-skya dgon-pa (4 sources)
Similarity: 88% (HIGH confidence)

Why similar:
✅ Same founding date (1073)
✅ Same location (Shigatse/Tsang)
✅ Same founder (Khon Konchok Gyalpo)

Recommendation: MERGE
```

### Example 3: Same Text, Different Names
```
Entity 1: Hevajra Tantra (6 sources)
Entity 2: Kye Dorje Root Tantra (3 sources)
Similarity: 78% (MEDIUM confidence)

Why similar:
✅ Same category (Highest Yoga Tantra)
✅ Same principal deity (Hevajra)
⚠️ Different chapter counts

Recommendation: CAREFUL REVIEW
```

### Example 4: False Positive
```
Entity 1: Naropa (9 sources)
Entity 2: Naro Bon Chong (2 sources)
Similarity: 42% (LOW confidence)

Why flagged:
- Similar name prefix "Naro"
- Different contexts entirely
- Different traditions (Buddhism vs Bon)

Recommendation: REJECT
```

---

## UI Features to Test

### 1. Review Queue Table
- ✅ Click rows to select for comparison
- ✅ Use checkboxes for bulk selection
- ✅ Inline action buttons (Merge/Reject/Flag)
- ✅ Color-coded similarity scores
- ✅ Confidence badges (green/yellow/red)
- ✅ Entity type icons

### 2. Filters
- ✅ Entity Type dropdown (All, Person, Place, Text, etc.)
- ✅ Confidence dropdown (All, High, Medium, Low)
- ✅ Sort by Similarity or Date
- ✅ Toggle sort order (ascending/descending)

### 3. Side-by-Side Comparison
- ✅ Two-column entity cards
- ✅ Attributes with confidence scores
- ✅ Relationships with targets
- ✅ Yellow highlighting for differences
- ✅ Source document references

### 4. Merge Preview
- ✅ Shows merged entity name
- ✅ Lists all merged attributes
- ✅ Highlights which source had higher confidence
- ✅ Shows total source count
- ✅ Cancel or confirm options

### 5. Bulk Operations
- ✅ Select All checkbox
- ✅ Merge Selected button (high-confidence only)
- ✅ Reject Selected button
- ✅ Validation (prevents bulk merge of medium/low)

### 6. Toast Notifications
- ✅ Success messages on merge
- ✅ Success messages on reject
- ✅ Warning messages on flag
- ✅ Error messages on validation failures

### 7. Statistics
- ✅ Pending count (updates live)
- ✅ Merged count
- ✅ Rejected count
- ✅ Flagged count

---

## Keyboard Shortcuts (Future Enhancement)

These could be added in the future:

- `↑` / `↓` - Navigate rows
- `Enter` - View comparison
- `m` - Merge selected pair
- `r` - Reject selected pair
- `f` - Flag selected pair
- `Esc` - Close dialog
- `Ctrl+A` - Select all

---

## Testing Checklist

Run through this checklist to verify everything works:

### Basic Navigation
- [ ] Dashboard loads without errors
- [ ] See 6 entity pairs in queue
- [ ] Stats show correct counts (Pending: 6, others: 0)

### Queue Interaction
- [ ] Click a row, see it highlighted
- [ ] Switch to "Comparison View" tab
- [ ] See side-by-side entity comparison
- [ ] Yellow highlights show differences

### Single Merge
- [ ] Click "Merge" on Marpa/Mar-pa pair
- [ ] See merge preview dialog
- [ ] See combined attributes
- [ ] Click "Confirm Merge"
- [ ] See success toast
- [ ] Pair removed from queue
- [ ] Stats update (Pending: 5, Merged: 1)

### Rejection
- [ ] Click "Not the same" on Naropa/Naro pair
- [ ] See success toast
- [ ] Pair removed from queue
- [ ] Stats update (Pending: 4, Rejected: 1)

### Flagging
- [ ] Click "Unsure" on Milarepa/Mila pair
- [ ] See flag toast
- [ ] Pair removed from queue
- [ ] Stats update (Pending: 3, Flagged: 1)

### Bulk Operations
- [ ] Select 2 high-confidence pairs with checkboxes
- [ ] Click "Merge Selected (2)"
- [ ] Confirm bulk merge
- [ ] See success toast
- [ ] Both pairs removed
- [ ] Stats update correctly

### Filters
- [ ] Change Entity Type to "Person"
- [ ] See only person pairs
- [ ] Change Confidence to "High"
- [ ] See fewer results
- [ ] Change Sort to "Date"
- [ ] See reordered results
- [ ] Toggle sort order
- [ ] See reversed order

### Error Handling
- [ ] Select mix of high/medium confidence
- [ ] Click "Merge Selected"
- [ ] See error message
- [ ] Bulk merge blocked

---

## Next Steps After Testing

### For Developers
1. Read `/roadmaps/knowledge-graph/ENTITY_REVIEW_UI_SUMMARY.md`
2. Review `/roadmaps/knowledge-graph/ENTITY_REVIEW_API_INTEGRATION.md`
3. Implement backend API endpoints
4. Replace mock data with real API calls
5. Add authentication/authorization

### For Product Owners
1. Test all workflows
2. Provide feedback on UX
3. Suggest improvements
4. Define curator roles and permissions
5. Plan expert review workflow

### For Curators
1. Familiarize yourself with UI
2. Practice reviewing different entity types
3. Learn confidence level meanings
4. Understand when to merge vs flag
5. Develop review guidelines

---

## Common Questions

### Q: Why are some pairs low confidence?
**A**: Low similarity scores (< 70%) often indicate false positives. The system detects them to be thorough, but they usually get rejected.

### Q: Can I edit entity attributes before merging?
**A**: Not in current version. Planned for future release. For now, merge first, then edit the merged entity.

### Q: What happens to the merged entity?
**A**: Entity 1 becomes the primary, entity 2 is deleted, all sources are consolidated, all relationships are updated to point to the merged entity.

### Q: Can I undo a merge?
**A**: Not yet. Future enhancement will add merge history and rollback capability.

### Q: Why can't I bulk merge medium confidence pairs?
**A**: Safety measure. Medium confidence requires individual review to prevent incorrect merges.

### Q: How is similarity calculated?
**A**: Mock data uses preset scores. Real system will use fuzzy name matching, attribute overlap, relationship analysis, and temporal proximity.

---

## Troubleshooting

### Dashboard doesn't load
**Check**: Development server running (`npm run dev`)
**Check**: Navigate to correct URL (`/entity-review`)

### No data showing
**Check**: Mock data generator function is working
**Check**: Console for JavaScript errors

### Filters don't work
**Check**: Browser console for errors
**Check**: React state updates correctly

### Actions don't persist
**Expected**: Actions are client-side only (mock data)
**Future**: Will persist to database via API

---

## Files to Reference

1. **Main Component**: `/home/user/Translate/client/src/pages/EntityReviewDashboard.tsx`
2. **Summary Doc**: `/home/user/Translate/roadmaps/knowledge-graph/ENTITY_REVIEW_UI_SUMMARY.md`
3. **API Guide**: `/home/user/Translate/roadmaps/knowledge-graph/ENTITY_REVIEW_API_INTEGRATION.md`
4. **Workflows**: `/home/user/Translate/roadmaps/knowledge-graph/ENTITY_REVIEW_WORKFLOWS.md`

---

## Success Criteria

You'll know it's working correctly when:
- ✅ All 6 entity pairs display
- ✅ Filters reduce the list correctly
- ✅ Clicking rows shows comparison
- ✅ Merge preview shows combined attributes
- ✅ Actions update stats in real-time
- ✅ Bulk operations validate correctly
- ✅ Toast notifications appear on actions
- ✅ No console errors

---

**Ready to start?** Just run `npm run dev` and navigate to `/entity-review`!
