# Confidence Calibration System - Implementation Summary

## Overview

Successfully implemented the **Confidence Calibration System** for Phase 1, Task 1.3.2 of the Knowledge Graph Entity Extraction project. This system evaluates entity extraction quality against a golden dataset of 75 human-verified test cases from Tibetan Buddhist historical texts.

## Files Created

### 1. `/home/user/Translate/server/services/extraction/ConfidenceCalibrator.ts` (773 lines)

**Main calibration engine** that evaluates entity extraction quality.

#### Key Components:

##### Type Definitions
- `ExtractionScore` - Precision, recall, F1, confidence accuracy for a single extraction
- `CalibrationTestResult` - Detailed results for each test case
- `DifficultyStats` - Statistics aggregated by difficulty level (easy/medium/hard)
- `CalibrationReport` - Comprehensive report with overall stats, by-difficulty breakdowns, and recommendations

##### ConfidenceCalibrator Class

**Main Methods:**

1. **`calibrate(extractor: EntityExtractor): Promise<CalibrationReport>`**
   - Runs extraction on all 75 calibration test cases
   - Scores each extraction (precision, recall, F1)
   - Aggregates results by difficulty and entity type
   - Generates actionable recommendations
   - Returns comprehensive calibration report

2. **`scoreExtraction(extracted, expectedEntities, expectedRelationships): ExtractionScore`**
   - Calculates precision: What % of extracted entities are correct?
   - Calculates recall: What % of expected entities were found?
   - Calculates F1 score: Harmonic mean of precision and recall
   - Evaluates confidence accuracy: Are high-confidence predictions correct?

3. **`countCorrectMatches(extracted, expected): number`**
   - Matches extracted entities to expected entities
   - Uses type matching + normalized name matching
   - Handles UNKNOWN entities (ambiguous references)
   - Returns count of correct matches

4. **`evaluateConfidence(extracted, expected): number`**
   - Filters entities with confidence > 0.8
   - Checks how many are actually correct
   - Returns confidence accuracy ratio
   - Detects poorly calibrated confidence scores

5. **`aggregateStats(results): DifficultyStats`**
   - Aggregates metrics by difficulty level
   - Calculates pass rates, averages
   - Used for easy/medium/hard breakdowns

6. **`generateRecommendations(overall, byDifficulty, results): string[]`**
   - Analyzes calibration results
   - Generates actionable recommendations
   - Identifies common failure patterns
   - Suggests specific improvements

7. **`printReport(report): void`**
   - Prints human-readable calibration report
   - Shows overall performance, by-difficulty stats
   - Lists failed test cases with details
   - Displays recommendations

### 2. `/home/user/Translate/server/services/extraction/README.md` (12KB)

**Comprehensive documentation** covering:
- Usage examples
- Metric explanations (precision, recall, F1, confidence accuracy)
- Calibration dataset structure (75 test cases)
- Entity matching algorithm
- Report structure and interpretation
- Integration requirements
- Success criteria for production deployment

### 3. `/home/user/Translate/tests/calibration.example.ts`

**Example code** demonstrating:
- Running full calibration
- Analyzing failed cases
- Tracking calibration progress over time
- Focused calibration by difficulty level
- Production readiness checks

## Scoring Algorithms

### 1. Precision
**Formula:** `correct_matches / total_extracted`

**What it measures:** What percentage of extracted entities are correct?

**Example:**
```
Extracted: ["Marpa", "Milarepa", "Unknown Person"]
Expected: ["Marpa", "Milarepa"]
Correct: 2
Precision: 2/3 = 66.7%
```

**Interpretation:**
- High precision (>80%) = Few false positives
- Low precision (<70%) = Extracting too many incorrect entities

### 2. Recall
**Formula:** `correct_matches / total_expected`

**What it measures:** What percentage of expected entities were found?

**Example:**
```
Expected: ["Marpa", "Milarepa", "Gampopa"]
Extracted: ["Marpa", "Milarepa"]
Correct: 2
Recall: 2/3 = 66.7%
```

**Interpretation:**
- High recall (>80%) = Finding most expected entities
- Low recall (<70%) = Missing many expected entities

### 3. F1 Score
**Formula:** `2 * (precision * recall) / (precision + recall)`

**What it measures:** Harmonic mean balancing precision and recall

**Example:**
```
Precision: 80%
Recall: 70%
F1: 2 * (0.8 * 0.7) / (0.8 + 0.7) = 0.747 = 74.7%
```

**Passing Threshold:** F1 >= 0.70

**Interpretation:**
- F1 > 0.85 = Excellent performance
- F1 0.70-0.85 = Good performance
- F1 < 0.70 = Needs improvement

### 4. Confidence Accuracy
**Formula:** `correct_high_confidence / total_high_confidence`

**What it measures:** Are high-confidence predictions (>0.8) actually correct?

**Example:**
```
High-confidence entities (>0.8): 20
Correct among them: 18
Confidence Accuracy: 18/20 = 90%
```

**Interpretation:**
- High confidence accuracy (>85%) = Well-calibrated confidence scores
- Low confidence accuracy (<75%) = Confidence scores unreliable

## Entity Matching Algorithm

### Type Matching
Entity types must match exactly:
- `person`, `place`, `text`, `event`, `concept`, `institution`, `deity`, `lineage`

### Name Matching
Multi-step normalization process:

1. **Convert to lowercase**
   ```
   "Marpa Lotsawa" → "marpa lotsawa"
   ```

2. **Remove punctuation**
   ```
   "Drogön Chögyal Phagpa" → "Drogön Chögyal Phagpa"
   ```

3. **Normalize whitespace**
   ```
   "Tsongkhapa  Lobsang  Drakpa" → "Tsongkhapa Lobsang Drakpa"
   ```

4. **Compare canonical name and all variants**
   - Canonical name
   - English names
   - Tibetan names
   - Wylie transliterations
   - Sanskrit names
   - Phonetic variants
   - Alternate names in attributes

### UNKNOWN Entity Handling
For ambiguous references (medium/hard test cases):
```typescript
{
  type: 'person',
  name: 'UNKNOWN',
  note: 'pronoun "he" needs antecedent from context'
}
```

- Lenient matching - type match is sufficient
- Measures system's ability to detect ambiguity
- Prevents false positives on uncertain entities

## Calibration Dataset Structure

### Total: 75 Test Cases

#### Easy Cases (30 cases)
**Characteristics:**
- Clear, explicit entity mentions
- Full names with dates
- Obvious relationships
- High expected confidence (>0.9)

**Expected Performance:** >90% pass rate

**Example:**
```
"Marpa Lotsawa (1012-1097) was a Tibetan translator who brought
many tantric teachings from India to Tibet."

Expected:
- Person: Marpa Lotsawa
  - Dates: birth=1012, death=1097
  - Roles: translator
  - Confidence: >0.9
```

#### Medium Cases (30 cases)
**Characteristics:**
- Ambiguous references ("the master", "he")
- Multiple people with same name
- Generic titles without specifics
- Complex hierarchies

**Expected Performance:** >70% pass rate

**Example:**
```
"After his teacher died, he went to India to continue his studies."

Expected:
- Person: UNKNOWN (pronoun needs context)
- Person: UNKNOWN (teacher identity unknown)
- Place: India
- Relationship: student_of (with UNKNOWN entities)
- Confidence: 0.5-0.7
```

#### Hard Cases (15 cases)
**Characteristics:**
- Tibetan calendar conversions (rabjung cycles)
- Lost historical identities
- Conflicting sources
- Complex date calculations

**Expected Performance:** >50% pass rate

**Example:**
```
"Born in the wood-sheep year of the 14th rabjung, he passed away
in the earth-pig year of the same cycle."

Expected:
- Person: UNKNOWN
- Birth: 1655 CE (requires rabjung calculation)
- Death: 1659 CE
- Confidence: 0.6-0.8
```

### Entity Type Coverage
- **Person:** 20+ cases
- **Place:** 10+ cases
- **Text:** 10+ cases
- **Event:** 10+ cases
- **Concept:** 10+ cases
- **Institution:** 10+ cases
- **Deity:** 5+ cases

## Example Calibration Report

```typescript
{
  overall: {
    totalCases: 75,
    passed: 58,              // 77.3% pass rate
    failed: 17,
    passRate: 0.773,
    avgPrecision: 0.82,      // 82% of extracted entities are correct
    avgRecall: 0.76,         // 76% of expected entities were found
    avgF1: 0.78,             // Good balance of precision/recall
    avgConfidenceAccuracy: 0.85  // High-confidence predictions are reliable
  },

  byDifficulty: {
    easy: {
      totalCases: 30,
      passed: 28,
      passRate: 0.933,       // 93.3% - excellent
      avgF1: 0.90
    },
    medium: {
      totalCases: 30,
      passed: 22,
      passRate: 0.733,       // 73.3% - acceptable
      avgF1: 0.74
    },
    hard: {
      totalCases: 15,
      passed: 8,
      passRate: 0.533,       // 53.3% - expected for hard cases
      avgF1: 0.60
    }
  },

  byEntityType: {
    person: { precision: 0.84, recall: 0.79, f1: 0.81 },
    text: { precision: 0.88, recall: 0.82, f1: 0.85 },    // Best performer
    place: { precision: 0.81, recall: 0.75, f1: 0.78 },
    institution: { precision: 0.79, recall: 0.73, f1: 0.76 }
  },

  recommendations: [
    "✓ Overall pass rate is 77.3%. System is performing well.",
    "⚠️ Low recall (76.0%) - missing expected entities. Consider improving entity detection prompts.",
    "⚠️ MEDIUM cases pass rate is 73.3%. Focus on improving disambiguation."
  ]
}
```

## How to Interpret Results

### Production Readiness Checklist

✅ **READY FOR PRODUCTION** if:
- Overall pass rate > 85%
- Easy cases pass rate > 90%
- Medium cases pass rate > 75%
- Confidence accuracy > 85%
- Average F1 > 0.80

⚠️ **NEEDS IMPROVEMENT** if:
- Overall pass rate 70-85%
- Some difficulty levels below threshold
- Confidence accuracy 75-85%

❌ **NOT READY** if:
- Overall pass rate < 70%
- Easy cases pass rate < 80%
- Confidence accuracy < 75%

### Common Issues and Solutions

#### Low Precision (Too many false positives)
**Causes:**
- Over-eager entity detection
- Poor entity type classification
- Extracting noise as entities

**Solutions:**
1. Add stricter validation rules
2. Increase confidence thresholds
3. Improve entity type classification prompts
4. Filter out low-confidence entities

#### Low Recall (Missing expected entities)
**Causes:**
- Entity detection too conservative
- Missing name variants
- Poor context understanding
- Overly strict matching

**Solutions:**
1. Improve entity detection prompts
2. Better handling of name variants
3. Enhanced context understanding
4. Use broader entity patterns

#### Poor Confidence Calibration
**Causes:**
- LLM overconfident
- Confidence not reflecting actual correctness
- No calibration of confidence scores

**Solutions:**
1. Recalibrate confidence thresholds
2. Use temperature sampling
3. Ensemble multiple predictions
4. Human-in-the-loop validation

## Integration Requirements

### EntityExtractor.extractFromText Method

The calibration system requires `EntityExtractor` to implement:

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

    return {
      jobId: randomUUID(),
      translationId: -1,
      entities: validatedEntities,
      relationships: validatedRelationships,
      ambiguities: rawExtraction.ambiguities || [],
      statistics: { /* ... */ },
      success: true
    };
  }
}
```

**Status:** Not yet implemented (see Phase 1, Task 1.3.3)

## Usage Example

```typescript
import { confidenceCalibrator } from './server/services/extraction/ConfidenceCalibrator';
import { entityExtractor } from './server/services/knowledgeGraph/EntityExtractor';

// Run calibration
const report = await confidenceCalibrator.calibrate(entityExtractor);

// Print report
confidenceCalibrator.printReport(report);

// Check production readiness
if (report.overall.passRate >= 0.85) {
  console.log('✓ System is production-ready!');
} else {
  console.log('✗ System needs improvement');
  console.log('Recommendations:', report.recommendations);
}
```

## Next Steps

1. **Implement EntityExtractor.extractFromText** (Phase 1, Task 1.3.3)
   - Add text extraction method to EntityExtractor
   - Enable calibration to run without database translations

2. **Run First Calibration**
   - Establish baseline metrics
   - Identify weak areas
   - Document initial performance

3. **Iterate on Extraction**
   - Improve prompts based on failed cases
   - Adjust confidence thresholds
   - Enhance entity matching logic

4. **Add to CI/CD Pipeline**
   - Run calibration on every pull request
   - Track metrics over time
   - Prevent regressions

5. **Create Calibration Dashboard**
   - Visualize trends
   - Compare runs
   - Monitor production performance

## Success Metrics

| Metric | Current | Target | Status |
|--------|---------|--------|--------|
| Overall Pass Rate | - | >85% | Not yet run |
| Easy Pass Rate | - | >90% | Not yet run |
| Medium Pass Rate | - | >75% | Not yet run |
| Hard Pass Rate | - | >50% | Not yet run |
| Precision | - | >80% | Not yet run |
| Recall | - | >80% | Not yet run |
| F1 Score | - | >0.80 | Not yet run |
| Confidence Accuracy | - | >85% | Not yet run |

## Technical Details

**File Location:** `/home/user/Translate/server/services/extraction/ConfidenceCalibrator.ts`

**Lines of Code:** 773

**Dependencies:**
- `EntityExtractor` - Entity extraction service
- `calibrationDataset` - 75 golden test cases
- Entity type definitions

**Exports:**
- `ConfidenceCalibrator` class
- `confidenceCalibrator` singleton instance
- Type definitions for reports and scores

**Key Features:**
- ✅ Precision/recall/F1 calculation
- ✅ Confidence accuracy evaluation
- ✅ By-difficulty aggregation
- ✅ By-entity-type aggregation
- ✅ Failed case analysis
- ✅ Recommendation generation
- ✅ Human-readable report printing
- ✅ Comprehensive documentation

**Limitations:**
- ⚠️ Requires `extractFromText` to be implemented
- ⚠️ Relationship matching simplified (will improve in future)
- ⚠️ No database persistence of calibration runs

## Conclusion

The Confidence Calibration System is **fully implemented** and ready for use once `EntityExtractor.extractFromText` is added. The system provides:

1. **Comprehensive evaluation** of entity extraction quality
2. **Actionable recommendations** for improvement
3. **Clear production readiness criteria**
4. **Detailed failure analysis** for debugging
5. **Well-documented** with examples and explanations

This completes **Phase 1, Task 1.3.2** of the Knowledge Graph implementation.
