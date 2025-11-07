# Entity Review Dashboard - Workflow Diagrams

## Overview
Visual workflows for the Entity Resolution Review process.

---

## Workflow 1: Single Entity Review

```
┌─────────────────────────────────────────────────────────┐
│                   CURATOR WORKFLOW                      │
└─────────────────────────────────────────────────────────┘

1. VIEW QUEUE
   ┌──────────────────────────────────┐
   │ Review Queue (6 pending)         │
   │ ┌──────┬──────┬──────┬─────┐    │
   │ │Entity│Entity│Sim   │Conf │    │
   │ │1     │2     │Score │     │    │
   │ ├──────┼──────┼──────┼─────┤    │
   │ │Marpa │Mar-pa│95%   │HIGH │ ◄──┼─── CURATOR SCANS LIST
   │ │Sakya │Sa-ska│88%   │HIGH │    │
   │ │Hevajr│Kye   │78%   │MED  │    │
   │ └──────┴──────┴──────┴─────┘    │
   └──────────────────────────────────┘
              │
              │ CLICK ROW
              ▼
2. COMPARE ENTITIES
   ┌──────────────────────────────────┐
   │    Side-by-Side Comparison       │
   ├────────────────┬─────────────────┤
   │ Entity 1       │ Entity 2        │
   │ ──────────     │ ──────────      │
   │ Marpa Lotsawa  │ Mar-pa          │
   │                │                 │
   │ Attributes:    │ Attributes:     │
   │ • birth: 1012  │ • birth: 1012   │
   │ • place: Lhod  │ • place: S.Tib  │ ◄── YELLOW HIGHLIGHT
   │ • title: Great │ • title: Trans  │ ◄── (DIFFERENT)
   │                │                 │
   │ Relations:     │ Relations:      │
   │ → Naropa       │ → Naropa        │ ◄── MATCH
   │ → Milarepa     │ → Mila          │ ◄── VARIANT
   └────────────────┴─────────────────┘
              │
              │ CURATOR DECISION
              ▼
3. MAKE DECISION
   ┌─────────────────────────────────────┐
   │  [Merge] [Not Same] [Unsure]        │
   └─────────────────────────────────────┘
        │         │          │
        │         │          └──────┐
        │         └─────────┐       │
        ▼                   ▼       ▼
   ┌─────────┐        ┌─────────┐  ┌──────────┐
   │ MERGE   │        │ REJECT  │  │ FLAG     │
   │ PREVIEW │        │         │  │ FOR      │
   └─────────┘        └─────────┘  │ EXPERT   │
        │                   │       └──────────┘
        │                   │             │
        ▼                   ▼             ▼
   ┌─────────┐        ┌─────────┐  ┌──────────┐
   │ Confirm │        │ Remove  │  │ Add to   │
   │ Merge?  │        │ from    │  │ Expert   │
   │ [Yes/No]│        │ Queue   │  │ Queue    │
   └─────────┘        └─────────┘  └──────────┘
        │                   │             │
        ▼                   ▼             ▼
   ┌─────────────────────────────────────────┐
   │  UPDATE DATABASE + SHOW NEXT PAIR       │
   └─────────────────────────────────────────┘
```

---

## Workflow 2: Bulk Operations

```
┌─────────────────────────────────────────────────────────┐
│              BULK REVIEW WORKFLOW                       │
└─────────────────────────────────────────────────────────┘

1. SELECT MULTIPLE PAIRS
   ┌────────────────────────────────────────┐
   │ Review Queue                           │
   │ ┌─┬──────┬──────┬─────┬──────┐        │
   │ │☑│Marpa │Mar-pa│95%  │HIGH  │ ◄──┐   │
   │ │☑│Sakya │Sa-ska│88%  │HIGH  │    │   │
   │ │☐│Hevajr│Kye   │78%  │MED   │    │   │
   │ │☑│Milar │Mila  │85%  │HIGH  │    │   │
   │ │☐│Narop │Naro  │42%  │LOW   │    │   │
   │ └─┴──────┴──────┴─────┴──────┘    │   │
   │                                    │   │
   │ [Merge Selected (3)]  [Reject]     │   │
   └────────────────────────────────────┘   │
                  │                         │
                  │                    CHECKBOX
                  │                    SELECTION
                  ▼                         │
2. VALIDATE SELECTION                       │
   ┌────────────────────────────────────────┘
   │ All selected HIGH confidence? ───┐
   │                                  │
   │  YES                       NO    │
   │   │                         │    │
   │   ▼                         ▼    │
   │ ┌───────────────┐    ┌──────────────┐
   │ │ PROCEED       │    │ SHOW ERROR   │
   │ │ TO MERGE      │    │ "Medium/Low" │
   │ └───────────────┘    │ "not allowed"│
   │                      └──────────────┘
   │
   ▼
3. CONFIRM BULK ACTION
   ┌────────────────────────────────────┐
   │ Confirm Bulk Merge?                │
   │                                    │
   │ 3 entity pairs will be merged:     │
   │ • Marpa Lotsawa + Mar-pa           │
   │ • Sakya Monastery + Sa-skya        │
   │ • Milarepa + Jetsun Mila           │
   │                                    │
   │    [Cancel]  [Confirm Merge]       │
   └────────────────────────────────────┘
                  │
                  ▼
4. EXECUTE BULK MERGE
   ┌────────────────────────────────────┐
   │ Processing... (1/3)                │
   │ ████████░░░░░░░░░░░░                │
   └────────────────────────────────────┘
                  │
                  ▼
   ┌────────────────────────────────────┐
   │ ✓ Success!                         │
   │ Merged 3 entity pairs              │
   │ • Marpa: 8 sources → 1 entity      │
   │ • Sakya: 12 sources → 1 entity     │
   │ • Milarepa: 17 sources → 1 entity  │
   └────────────────────────────────────┘
```

---

## Workflow 3: Merge Preview Process

```
┌─────────────────────────────────────────────────────────┐
│              MERGE PREVIEW WORKFLOW                     │
└─────────────────────────────────────────────────────────┘

1. CURATOR CLICKS "MERGE"
   ┌────────────────────────────────┐
   │ Entity Comparison              │
   │ [Merge] [Not Same] [Unsure]    │
   └────────────────────────────────┘
        │
        │ CLICK "MERGE"
        ▼
2. SYSTEM GENERATES PREVIEW
   ┌────────────────────────────────────────┐
   │ MERGE ALGORITHM                        │
   │                                        │
   │ For each attribute:                    │
   │   if exists in both:                   │
   │     take highest confidence            │
   │   else:                                │
   │     take single value                  │
   │                                        │
   │ Sum all source counts                  │
   │ Merge all relationships                │
   │ Keep earliest firstSeen date           │
   │ Keep latest lastSeen date              │
   └────────────────────────────────────────┘
        │
        ▼
3. SHOW PREVIEW DIALOG
   ┌────────────────────────────────────────┐
   │ Confirm Merge                          │
   ├────────────────────────────────────────┤
   │                                        │
   │ Merged Name: Marpa Lotsawa             │
   │ Entity Type: Person                    │
   │                                        │
   │ Merged Attributes (6):                 │
   │ ┌────────────────────────────────────┐ │
   │ │ birth_year: 1012        [92%]      │ │
   │ │ death_year: 1097        [89%]      │ │
   │ │ birthplace: Lhodrak     [85%]  ◄───┼─┼── HIGHEST
   │ │            (not S.Tibet [75%])     │ │   CONFIDENCE
   │ │ title: Great Translator [95%]      │ │   SELECTED
   │ │ visits_to_india: 3      [90%]      │ │
   │ └────────────────────────────────────┘ │
   │                                        │
   │ Total Sources: 8 (5 + 3)               │
   │                                        │
   │    [Cancel]  [Confirm Merge ✓]         │
   └────────────────────────────────────────┘
        │
        │ CURATOR REVIEWS
        ▼
4. CURATOR DECISION
        │
    ┌───┴────┐
    │        │
  CANCEL  CONFIRM
    │        │
    ▼        ▼
  CLOSE   UPDATE DB
  DIALOG     │
             ▼
        ┌────────────────────┐
        │ Success Toast      │
        │ "Entities merged"  │
        └────────────────────┘
```

---

## Workflow 4: Filter & Sort Process

```
┌─────────────────────────────────────────────────────────┐
│           FILTERING & SORTING WORKFLOW                  │
└─────────────────────────────────────────────────────────┘

1. INITIAL QUEUE (All 6 pairs)
   ┌──────────────────────────────────────────┐
   │ Entity Type: [All ▼] Confidence: [All ▼] │
   │ Sort: [Similarity ▼] Order: [▼]          │
   └──────────────────────────────────────────┘
   │
   │ Showing: All types, All confidence
   │ Sorted: Similarity DESC
   │
   ▼
   ┌─────────────────────────────────────────┐
   │ Marpa/Mar-pa         95%  HIGH  Person  │
   │ Gampopa/Dagpo        91%  HIGH  Person  │
   │ Sakya/Sa-skya        88%  HIGH  Place   │
   │ Milarepa/Mila        85%  HIGH  Person  │
   │ Hevajra/Kye          78%  MED   Text    │
   │ Naropa/Naro Bon      42%  LOW   Person  │
   └─────────────────────────────────────────┘

2. CURATOR APPLIES FILTER: "Person" + "High"
   ┌──────────────────────────────────────────┐
   │ Entity Type: [Person ▼] Conf: [High ▼]  │
   └──────────────────────────────────────────┘
   │
   │ Filtered to: Person + High confidence
   │
   ▼
   ┌─────────────────────────────────────────┐
   │ Marpa/Mar-pa         95%  HIGH  Person  │
   │ Gampopa/Dagpo        91%  HIGH  Person  │
   │ Milarepa/Mila        85%  HIGH  Person  │
   └─────────────────────────────────────────┘

3. CURATOR CHANGES SORT: Date DESC
   ┌──────────────────────────────────────────┐
   │ Sort: [Date ▼] Order: [▼ DESC]           │
   └──────────────────────────────────────────┘
   │
   │ Re-sorted by: Detection date (newest first)
   │
   ▼
   ┌─────────────────────────────────────────┐
   │ Marpa/Mar-pa         2025-11-05  95%    │
   │ Milarepa/Mila        2025-11-02  85%    │
   │ Gampopa/Dagpo        2025-10-31  91%    │
   └─────────────────────────────────────────┘

4. CURATOR TOGGLES SORT ORDER: ASC
   ┌──────────────────────────────────────────┐
   │ Sort: [Date ▼] Order: [▲ ASC]            │
   └──────────────────────────────────────────┘
   │
   │ Re-sorted by: Detection date (oldest first)
   │
   ▼
   ┌─────────────────────────────────────────┐
   │ Gampopa/Dagpo        2025-10-31  91%    │
   │ Milarepa/Mila        2025-11-02  85%    │
   │ Marpa/Mar-pa         2025-11-05  95%    │
   └─────────────────────────────────────────┘
```

---

## Workflow 5: Decision Flow Chart

```
                    ┌───────────────────┐
                    │  Entity Pair      │
                    │  Detected         │
                    └─────────┬─────────┘
                              │
                              ▼
                    ┌───────────────────┐
                    │  Calculate        │
                    │  Similarity       │
                    │  Score            │
                    └─────────┬─────────┘
                              │
                ┌─────────────┼─────────────┐
                │             │             │
                ▼             ▼             ▼
         ┌──────────┐  ┌──────────┐  ┌──────────┐
         │ ≥85%     │  │ 70-84%   │  │ <70%     │
         │ HIGH     │  │ MEDIUM   │  │ LOW      │
         └────┬─────┘  └────┬─────┘  └────┬─────┘
              │             │             │
              └─────────────┼─────────────┘
                            │
                            ▼
                    ┌───────────────────┐
                    │  Add to Review    │
                    │  Queue            │
                    └─────────┬─────────┘
                              │
                              ▼
                    ┌───────────────────┐
                    │  Curator Reviews  │
                    │  Side-by-Side     │
                    └─────────┬─────────┘
                              │
                ┌─────────────┼─────────────┐
                │             │             │
                ▼             ▼             ▼
         ┌──────────┐  ┌──────────┐  ┌──────────┐
         │ MERGE    │  │ REJECT   │  │ FLAG     │
         │          │  │          │  │          │
         └────┬─────┘  └────┬─────┘  └────┬─────┘
              │             │             │
              ▼             ▼             ▼
       ┌────────────┐ ┌───────────┐ ┌──────────────┐
       │ Merge      │ │ Mark as   │ │ Add to       │
       │ Entities   │ │ NOT dup   │ │ Expert Queue │
       │            │ │           │ │              │
       │ • Combine  │ │ • Remove  │ │ • Assign to  │
       │   attrs    │ │   from    │ │   expert     │
       │ • Update   │ │   queue   │ │ • Skip for   │
       │   refs     │ │ • Log     │ │   now        │
       │ • Delete   │ │   decision│ │              │
       │   dup      │ │           │ │              │
       └────┬───────┘ └─────┬─────┘ └──────┬───────┘
            │               │              │
            │               │              │
            └───────────────┼──────────────┘
                            │
                            ▼
                    ┌───────────────────┐
                    │  Log Decision     │
                    │  for ML Training  │
                    └─────────┬─────────┘
                              │
                              ▼
                    ┌───────────────────┐
                    │  Show Next Pair   │
                    └───────────────────┘
```

---

## Workflow 6: Data Flow Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    DATA FLOW DIAGRAM                        │
└─────────────────────────────────────────────────────────────┘

                         BACKEND
                            │
    ┌───────────────────────┼───────────────────────┐
    │                       │                       │
    ▼                       ▼                       ▼
┌─────────┐          ┌──────────┐           ┌──────────┐
│ Entity  │          │ Duplicate│           │ Merge    │
│ Extrac  │─────────▶│ Detector │──────────▶│ Service  │
│ tion    │          │          │           │          │
└─────────┘          └──────────┘           └──────────┘
    │                       │                       │
    │ Extract entities      │ Calculate similarity  │
    │                       │                       │
    ▼                       ▼                       ▼
┌─────────────────────────────────────────────────────┐
│              POSTGRESQL DATABASE                    │
│                                                     │
│  ┌─────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │ entities│  │ entity_pairs │  │ merge_history│  │
│  └─────────┘  └──────────────┘  └──────────────┘  │
└─────────────────────┬───────────────────────────────┘
                      │
                      │ GET /api/entity-resolution/pending
                      │
                      ▼
              ┌───────────────┐
              │  API LAYER    │
              │  REST + JSON  │
              └───────┬───────┘
                      │
                      │ TanStack Query
                      │
                      ▼
┌─────────────────────────────────────────────────────────┐
│              REACT FRONTEND                             │
│                                                         │
│  ┌───────────────────────────────────────────────────┐ │
│  │  EntityReviewDashboard Component                  │ │
│  │                                                    │ │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐        │ │
│  │  │ Review   │  │ Compare  │  │ Decision │        │ │
│  │  │ Queue    │  │ View     │  │ Buttons  │        │ │
│  │  └──────────┘  └──────────┘  └──────────┘        │ │
│  └───────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
                      │
                      │ User clicks "Merge"
                      │
                      ▼
              ┌───────────────┐
              │  POST /merge  │
              └───────┬───────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────┐
│              MERGE EXECUTION                            │
│                                                         │
│  1. Validate entities exist                            │
│  2. Merge attributes (highest confidence)              │
│  3. Consolidate sources                                │
│  4. Update all relationship pointers                   │
│  5. Delete duplicate entity                            │
│  6. Log merge history                                  │
│  7. Return success response                            │
└─────────────────────────────────────────────────────────┘
                      │
                      │ Response
                      │
                      ▼
              ┌───────────────┐
              │  Refetch data │
              │  Show toast   │
              │  Next pair    │
              └───────────────┘
```

---

## Workflow 7: Confidence-Based Routing

```
┌─────────────────────────────────────────────────────────┐
│         CONFIDENCE-BASED WORKFLOW ROUTING               │
└─────────────────────────────────────────────────────────┘

                    Entity Pair Detected
                            │
                            ▼
                    Calculate Similarity
                            │
            ┌───────────────┼───────────────┐
            │               │               │
            ▼               ▼               ▼
       HIGH (≥85%)     MEDIUM (70-84%)   LOW (<70%)
            │               │               │
            │               │               │
            ▼               ▼               ▼
    ┌────────────────┐ ┌────────────┐ ┌─────────────┐
    │ BULK MERGE     │ │ CAREFUL    │ │ LIKELY      │
    │ ELIGIBLE       │ │ REVIEW     │ │ FALSE       │
    │                │ │            │ │ POSITIVE    │
    │ ✓ Can bulk     │ │ ✓ One-by-  │ │             │
    │   merge        │ │   one      │ │ ✓ Review    │
    │ ✓ Auto-merge   │ │ ✓ Required │ │   carefully │
    │   with confirm │ │   curator  │ │ ✓ Often     │
    │                │ │   decision │ │   rejected  │
    └────────┬───────┘ └──────┬─────┘ └──────┬──────┘
             │                │              │
             │                │              │
             └────────────────┼──────────────┘
                              │
                              ▼
                        Review Queue
                              │
                              ▼
                     Curator Reviews
                              │
            ┌─────────────────┼─────────────────┐
            │                 │                 │
            ▼                 ▼                 ▼
      ┌──────────┐      ┌──────────┐     ┌──────────┐
      │  MERGE   │      │  REJECT  │     │   FLAG   │
      │          │      │          │     │          │
      │ Outcome: │      │ Outcome: │     │ Outcome: │
      │ Combined │      │ Keep     │     │ Expert   │
      │ entity   │      │ separate │     │ reviews  │
      └────┬─────┘      └────┬─────┘     └────┬─────┘
           │                 │                 │
           │                 │                 │
           └─────────────────┼─────────────────┘
                             │
                             ▼
                    Track for ML Training
                             │
                             ▼
                  Improve Future Detection
```

---

## Summary

These workflows demonstrate:

1. **Single Review** - Detailed comparison and decision-making
2. **Bulk Operations** - Efficient processing of obvious matches
3. **Merge Preview** - Safe merge confirmation process
4. **Filtering** - Finding specific entity types or confidence levels
5. **Decision Flow** - Complete path from detection to resolution
6. **Data Architecture** - Full stack data flow
7. **Confidence Routing** - Different handling for different confidence levels

**Key Principles:**
- High confidence = Bulk eligible
- Medium confidence = Careful review
- Low confidence = Often false positives
- All decisions logged for ML training
- Preview before merge (safety check)
- Side-by-side comparison (clarity)
