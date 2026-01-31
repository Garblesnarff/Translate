# Confidence Calibration System

## Overview

The Confidence Calibration System evaluates entity extraction quality against a golden calibration dataset of 75 human-verified test cases. It measures precision, recall, F1 scores, and confidence accuracy to ensure the extraction system is production-ready.

## Files

- **ConfidenceCalibrator.ts** - Main calibration engine
- **calibrationDataset.ts** - 75 golden test cases (easy/medium/hard)

## Usage

```typescript
import { ConfidenceCalibrator } from './ConfidenceCalibrator';
import { EntityExtractor } from '../knowledgeGraph/EntityExtractor';

const calibrator = new ConfidenceCalibrator();
const extractor = new EntityExtractor();

// Run full calibration
const report = await calibrator.calibrate(extractor);

// Print human-readable report
calibrator.printReport(report);

// Access specific metrics
console.log('Overall F1:', report.overall.avgF1);
console.log('Easy cases pass rate:', report.byDifficulty.easy.passRate);
console.log('Person entity precision:', report.byEntityType.person?.precision);
```

## Metrics Explained

### Precision
**What percentage of extracted entities are correct?**

- High precision = Few false positives
- Low precision = Extracting too many incorrect entities
- Formula: `correct_matches / total_extracted`

**Example:**
- Extracted 10 entities
- 8 were correct
- Precision = 80%

### Recall
**What percentage of expected entities were found?**

- High recall = Finding most expected entities
- Low recall = Missing many expected entities
- Formula: `correct_matches / total_expected`

**Example:**
- Expected 12 entities
- Found 8 of them
- Recall = 66.7%

### F1 Score
**Harmonic mean of precision and recall**

- Balances precision and recall
- Formula: `2 * (precision * recall) / (precision + recall)`
- Passing threshold: **F1 >= 0.70**

**Example:**
- Precision = 80%
- Recall = 66.7%
- F1 = 72.7% (PASS)

### Confidence Accuracy
**Are high-confidence predictions (>0.8) actually correct?**

- Evaluates confidence score calibration
- High confidence should correlate with correctness
- Formula: `correct_high_confidence / total_high_confidence`

**Example:**
- 20 entities with confidence > 0.8
- 18 of them were correct
- Confidence accuracy = 90%

## Calibration Dataset

The dataset contains **75 test cases** across 3 difficulty levels:

### Easy (30 cases)
- Clear, explicit entity mentions
- Full names with dates
- Obvious relationships
- **Expected pass rate: >90%**

Example:
```
"Marpa Lotsawa (1012-1097) was a Tibetan translator who brought
many tantric teachings from India to Tibet."

Expected:
- Person: Marpa Lotsawa (1012-1097), translator
- High confidence (>0.9)
```

### Medium (30 cases)
- Ambiguous references ("the master", "he")
- Multiple people with same name
- Generic titles without specifics
- **Expected pass rate: >70%**

Example:
```
"The master taught at the monastery for many years before
moving to the mountains."

Expected:
- Person: UNKNOWN (ambiguous reference)
- Institution: UNKNOWN (which monastery?)
- Medium confidence (0.5-0.7)
```

### Hard (15 cases)
- Tibetan calendar conversions
- Complex date calculations
- Lost historical identities
- Conflicting sources
- **Expected pass rate: >50%**

Example:
```
"Born in the wood-sheep year of the 14th rabjung, he passed away
in the earth-pig year of the same cycle."

Expected:
- Person: UNKNOWN
- Birth: 1655 CE (rabjung calculation required)
- Death: 1659 CE
- Low-medium confidence (0.6-0.8)
```

## Entity Matching Algorithm

### Type Matching
Entity type must match exactly:
- `person`, `place`, `text`, `event`, `concept`, `institution`, `deity`, `lineage`

### Name Matching
Names are matched using normalized comparison:
1. Convert to lowercase
2. Remove punctuation
3. Normalize whitespace
4. Compare canonical name and all variants

### UNKNOWN Entity Handling
For ambiguous references (medium/hard cases):
- Expected entity name is `"UNKNOWN"`
- Lenient matching - type match is sufficient
- Helps measure system's ability to detect ambiguity

## Calibration Report Structure

```typescript
{
  overall: {
    totalCases: 75,
    passed: 58,
    failed: 17,
    passRate: 0.773,
    avgPrecision: 0.82,
    avgRecall: 0.76,
    avgF1: 0.78,
    avgConfidenceAccuracy: 0.85,
    passingThreshold: 0.70
  },

  byDifficulty: {
    easy: {
      totalCases: 30,
      passed: 28,
      passRate: 0.933,
      avgPrecision: 0.92,
      avgRecall: 0.89,
      avgF1: 0.90,
      avgConfidenceAccuracy: 0.94
    },
    medium: {
      totalCases: 30,
      passed: 22,
      passRate: 0.733,
      avgPrecision: 0.78,
      avgRecall: 0.71,
      avgF1: 0.74,
      avgConfidenceAccuracy: 0.81
    },
    hard: {
      totalCases: 15,
      passed: 8,
      passRate: 0.533,
      avgPrecision: 0.65,
      avgRecall: 0.58,
      avgF1: 0.60,
      avgConfidenceAccuracy: 0.72
    }
  },

  byEntityType: {
    person: { precision: 0.84, recall: 0.79, f1: 0.81 },
    place: { precision: 0.81, recall: 0.75, f1: 0.78 },
    text: { precision: 0.88, recall: 0.82, f1: 0.85 },
    institution: { precision: 0.79, recall: 0.73, f1: 0.76 },
    // ...
  },

  failedCases: [
    {
      testCaseId: 'person-012',
      difficulty: 'medium',
      precision: 0.60,
      recall: 0.50,
      f1: 0.54,
      passed: false,
      failures: [
        'Low recall (0.50) - missing expected entities',
        'Low precision (0.60) - too many false positives'
      ]
    },
    // ...
  ],

  recommendations: [
    '✓ Overall pass rate is 77.3%. System is performing well.',
    '⚠️ Low recall (76.0%) - missing expected entities. Consider: ...',
    '⚠️ MEDIUM cases pass rate is 73.3%. Focus on improving disambiguation...',
    // ...
  ]
}
```

## Recommendations Engine

The system generates actionable recommendations based on:

### Overall Performance
- ❌ < 70%: CRITICAL - Not ready for production
- ⚠️ 70-85%: Needs improvement
- ✓ > 85%: Production-ready

### Precision Issues
Low precision suggests:
1. Stricter entity validation needed
2. Higher confidence thresholds
3. Better entity type classification
4. Too many false positives

### Recall Issues
Low recall suggests:
1. Improve entity detection prompts
2. Better handling of name variants
3. Enhanced context understanding
4. Missing expected entities

### Confidence Calibration Issues
Low confidence accuracy suggests:
1. Recalibrate confidence thresholds
2. High-confidence predictions not reliable
3. Need better uncertainty estimation

## Example Calibration Output

```
================================================================================
CONFIDENCE CALIBRATION REPORT
================================================================================
Calibration Date: 2025-01-15T10:30:00.000Z
Total Extraction Time: 142.35s

OVERALL PERFORMANCE
--------------------------------------------------------------------------------
Total Cases: 75
Passed: 58 (77.3%)
Failed: 17
Passing Threshold: F1 >= 0.7

Average Precision: 82.0%
Average Recall:    76.0%
Average F1 Score:  78.0%
Confidence Accuracy: 85.0%

PERFORMANCE BY DIFFICULTY
--------------------------------------------------------------------------------

EASY:
  Cases: 30 | Passed: 28 (93.3%)
  Precision: 92.0% | Recall: 89.0% | F1: 90.0%
  Confidence Accuracy: 94.0%

MEDIUM:
  Cases: 30 | Passed: 22 (73.3%)
  Precision: 78.0% | Recall: 71.0% | F1: 74.0%
  Confidence Accuracy: 81.0%

HARD:
  Cases: 15 | Passed: 8 (53.3%)
  Precision: 65.0% | Recall: 58.0% | F1: 60.0%
  Confidence Accuracy: 72.0%

PERFORMANCE BY ENTITY TYPE
--------------------------------------------------------------------------------
person          | P: 84.0% | R: 79.0% | F1: 81.0%
place           | P: 81.0% | R: 75.0% | F1: 78.0%
text            | P: 88.0% | R: 82.0% | F1: 85.0%
institution     | P: 79.0% | R: 73.0% | F1: 76.0%

FAILED TEST CASES
--------------------------------------------------------------------------------

person-012 (medium):
  P: 60.0% | R: 50.0% | F1: 54.0%
  Extracted: 5 | Expected: 3 | Correct: 2
  Issues: Low recall (0.50) - missing expected entities; Low precision (0.60) - too many false positives

date-004 (hard):
  P: 40.0% | R: 33.0% | F1: 36.0%
  Extracted: 3 | Expected: 2 | Correct: 1
  Issues: Low precision (0.40) - too many false positives; Low recall (0.33) - missing expected entities

RECOMMENDATIONS
--------------------------------------------------------------------------------
✓ Overall pass rate is 77.3%. System is performing well.
⚠️ Low recall (76.0%) - missing expected entities. Consider: (1) Improving entity detection prompts, (2) Better handling of name variants, (3) Enhanced context understanding.
⚠️ MEDIUM cases pass rate is 73.3%. Focus on improving disambiguation and context resolution.
ℹ️ HARD cases pass rate is 53.3%. This is expected for challenging cases. Consider flagging these for human review.

Common failure patterns:
  - 10/17 failures due to low recall (missed entities)
  - 8/17 failures due to low precision (false positives)

================================================================================
```

## Integration with Entity Extraction

The calibration system requires `EntityExtractor` to implement an `extractFromText` method:

```typescript
class EntityExtractor {
  /**
   * Extract entities from raw text (for calibration/testing)
   *
   * @param text - Raw text to extract from
   * @returns Extraction result
   */
  async extractFromText(text: string): Promise<ExtractionResult> {
    // Build prompt
    const prompt = buildEntityExtractionPrompt(text);

    // Call LLM
    const llmResult = await geminiService.generateContent(prompt);

    // Parse and validate
    const rawExtraction = JSON.parse(llmResult.response.text());

    // Validate entities
    const validatedEntities = this.validateEntities(rawExtraction.entities);
    const validatedRelationships = this.validateRelationships(rawExtraction.relationships);

    return {
      jobId: randomUUID(),
      translationId: -1, // No translation ID for text-only extraction
      entities: validatedEntities,
      relationships: validatedRelationships,
      ambiguities: rawExtraction.ambiguities || [],
      statistics: { /* ... */ },
      success: true
    };
  }
}
```

## Current Limitations

1. **extractFromText not implemented**: The `EntityExtractor.extractFromText` method needs to be implemented for calibration to work. See Phase 1, Task 1.3.3.

2. **Relationship matching simplified**: Currently, relationship matching is simplified because we can't easily resolve entity IDs back to names without full context. This will be improved in a future iteration.

3. **No database persistence for calibration runs**: Calibration results are returned but not saved to database. Consider adding a `calibration_runs` table to track historical calibration results.

## Next Steps

1. **Implement EntityExtractor.extractFromText** (Task 1.3.3)
2. **Run first calibration** to establish baseline metrics
3. **Iterate on extraction prompts** to improve F1 scores
4. **Add calibration runs to CI/CD** to catch regressions
5. **Create calibration dashboard** for visualization

## Success Criteria

Before deploying to production:
- ✓ Overall pass rate > 85%
- ✓ Easy cases pass rate > 90%
- ✓ Medium cases pass rate > 75%
- ✓ Hard cases pass rate > 50%
- ✓ Confidence accuracy > 85%
- ✓ Average F1 score > 0.80

Current status: **Not yet run** (awaiting EntityExtractor.extractFromText implementation)
