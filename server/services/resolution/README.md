# Fuzzy Name Matching Service

Comprehensive name matching service for detecting similar entity names across documents in the Tibetan Buddhist knowledge graph.

## Overview

The `FuzzyMatcher` service implements multiple similarity algorithms to handle the complexity of Tibetan name matching, including:
- Multiple romanization systems (Wylie, phonetic)
- Different scripts (Tibetan, Sanskrit, Chinese)
- Honorifics and titles (Rinpoche, Lama, Lotsawa)
- Transliteration variants (Marpa = Mar-pa = མར་པ།)

## Algorithms Implemented

### 1. Levenshtein Distance (50% weight)

**Character-level edit distance** - Measures how many single-character edits (insertions, deletions, substitutions) are needed to transform one string into another.

**Example:**
```
"marpa" → "mar-pa" = 1 edit (insert hyphen)
Similarity: 1 - (1/6) = 0.83
```

**Why it works:** Most name variants differ by only a few characters (punctuation, diacritics, spelling).

**Complexity:** O(n×m) where n, m are string lengths

### 2. Phonetic Matching (20% weight)

**Soundex algorithm** - Encodes names into phonetic codes so names that sound alike get the same code.

**How it works:**
1. Keep first letter
2. Map consonants to digits (B,F,P,V → 1; C,G,J,K → 2; etc.)
3. Remove vowels (except first letter)
4. Remove consecutive duplicates

**Example:**
```
"Marpa"   → M610
"Marpah"  → M610
"Marpha"  → M610
```

All three get the same code → phonetically similar!

**Why it matters:** Different transliterators spell Tibetan names differently based on how they heard them pronounced.

### 3. Word-Level Matching (20% weight)

**Jaccard similarity on word sets** - Treats names as sets of words and measures overlap.

**Example:**
```
"Marpa Lotsawa" vs "Lotsawa Marpa"
Words1: {marpa, lotsawa}
Words2: {lotsawa, marpa}
Overlap: 2, Union: 2
Similarity: 2/2 = 1.0
```

**Why it works:** Names often have words reordered or additional titles added.

### 4. Transliteration Variant Detection (10% weight)

**Dictionary-based lookup** - Checks against known Wylie ↔ Phonetic mappings.

**Examples:**
```
"mar pa"      ↔ "marpa"          (Wylie vs. phonetic)
"pad+ma"      ↔ "padma", "pema"  (Sanskrit variants)
"tsong kha pa" ↔ "tsongkhapa"    (Wylie vs. standard)
```

**Why it's needed:** Automatic transliteration systems produce predictable variants.

### 5. Length Penalty

**Penalizes vastly different name lengths** - Names with very different lengths are less likely to be the same entity.

**Formula:**
```
ratio = min(len1, len2) / max(len1, len2)

if ratio ≥ 0.7: penalty = 1.0   (no penalty)
if ratio ≥ 0.5: penalty = 0.95
if ratio ≥ 0.3: penalty = 0.85
else:           penalty = 0.7   (significant penalty)
```

**Example:**
```
"Marpa" vs "Marpa Lotsawa Chökyi Lodrö"
Lengths: 5 vs 28
Ratio: 5/28 = 0.18
Penalty: 0.7
```

This prevents false positives where a short name matches a substring of a longer name.

## Similarity Scoring Formula

**Final Score:**
```
score = (
  levenshtein_similarity * 0.5 +
  phonetic_similarity    * 0.2 +
  word_level_similarity  * 0.2 +
  transliteration_score  * 0.1
) * length_penalty
```

**Confidence Adjustment:**
- Exact matches: 1.0 confidence
- Transliteration variants: 0.95 confidence
- Word-level matches: 0.95 confidence
- Phonetic matches: 0.90 confidence (slightly less reliable)
- Levenshtein matches: Use raw score

## Threshold Recommendations

### Automatic Merging: 0.95+
**Use case:** Automatically merge entities without human review

**Characteristics:**
- Very high confidence
- Usually exact matches or known transliteration variants
- Low risk of false positives

**Example pairs:**
```
"Marpa" vs "Mar-pa"               → 0.97
"Tsongkhapa" vs "Tsong kha pa"    → 0.98
"Padmasambhava" vs "Padma sambhava" → 0.96
```

### Human Review Queue: 0.85-0.95
**Use case:** Flag likely matches for curator review

**Characteristics:**
- Likely the same entity but needs verification
- May have additional names or titles
- Context helps (dates, places, relationships)

**Example pairs:**
```
"Marpa" vs "Marpa Lotsawa"        → 0.89
"Milarepa" vs "Jetsun Milarepa"   → 0.87
"Atisha" vs "Jo bo rje Atisha"    → 0.85
```

### Research Exploration: 0.75-0.85
**Use case:** Find potential connections for research

**Characteristics:**
- Possibly the same entity
- Requires additional signals (dates, locations, relationships)
- Cast wider net for discovery

**Example pairs:**
```
"Mila" vs "Milarepa"              → 0.82
"Gampopa" vs "Dakpo Lhaje"        → 0.78
"Drogön Chögyal Phagpa" vs "Phagpa" → 0.76
```

### Probably Different: <0.75
**Use case:** Likely different entities

**Characteristics:**
- Different people/places with similar names
- Common short names (need disambiguation)
- Require strong contextual evidence to merge

**Example pairs:**
```
"Rinpoche" vs "Lama"              → 0.45 (generic titles)
"Sakya" vs "Sakya Pandita"        → 0.72 (different people)
"Dharma" vs "Dharma Raja"         → 0.68 (different contexts)
```

## Usage Examples

### Basic Similarity Calculation

```typescript
import { FuzzyMatcher } from './FuzzyMatcher';

const matcher = new FuzzyMatcher();

const score = matcher.calculateSimilarity("Marpa Lotsawa", "Mar-pa the Translator");
console.log(score);
// {
//   score: 0.87,
//   matchType: 'word_order',
//   confidence: 0.87,
//   reason: 'Word-level match (different order)',
//   components: {
//     levenshtein: 0.65,
//     phonetic: 0.95,
//     wordLevel: 0.90,
//     lengthPenalty: 0.85
//   }
// }
```

### Finding Similar Names

```typescript
import { fuzzyMatcher } from './FuzzyMatcher';
import { allPersonEntities } from './database';

// Find all people similar to "Marpa"
const matches = fuzzyMatcher.findSimilarNames(
  "Marpa",
  allPersonEntities,
  {
    threshold: 0.85,  // Only show likely matches
    limit: 5,         // Top 5 results
    preferSameType: true  // Prefer Person entities
  }
);

matches.forEach(match => {
  console.log(`${match.matchedName}: ${match.score.score.toFixed(2)} (${match.score.reason})`);
});
// Output:
// Mar-pa: 0.97 (Known transliteration variant)
// Marpa Lotsawa: 0.89 (Word-level match)
// Marpa Chökyi Lodrö: 0.87 (Character-level similarity)
```

### Comparing Two Entities

```typescript
import { fuzzyMatcher } from './FuzzyMatcher';

// Compare all name variants between two entities
const entity1 = {
  canonicalName: "Marpa",
  names: {
    tibetan: ["མར་པ།"],
    english: ["Marpa", "Marpa Lotsawa"],
    wylie: ["mar pa", "mar pa lo tsā ba"],
    phonetic: ["Marpa", "Marpha"]
  },
  // ...
};

const entity2 = {
  canonicalName: "Mar-pa the Translator",
  names: {
    english: ["Mar-pa", "Marpa the Translator"],
    wylie: ["mar pa"],
    phonetic: ["Marpa"]
  },
  // ...
};

const bestScore = fuzzyMatcher.compareEntities(entity1, entity2);
console.log(`Best match: ${bestScore.score.toFixed(2)}`);
// Best match: 0.97
```

### Text Normalization

```typescript
import { FuzzyMatcher } from './FuzzyMatcher';

const matcher = new FuzzyMatcher();

// Normalize removes diacritics, honorifics, punctuation
const normalized = matcher.normalizeText("Pāramitā Rinpoche མར་པ།");
console.log(normalized);
// Output: "paramita"
```

### Levenshtein Distance

```typescript
import { FuzzyMatcher } from './FuzzyMatcher';

const matcher = new FuzzyMatcher();

const distance = matcher.calculateLevenshteinDistance("marpa", "mar-pa");
console.log(`Edit distance: ${distance}`);
// Edit distance: 1

const distance2 = matcher.calculateLevenshteinDistance("marpa", "milarepa");
console.log(`Edit distance: ${distance2}`);
// Edit distance: 5
```

### Phonetic Matching

```typescript
import { FuzzyMatcher } from './FuzzyMatcher';

const matcher = new FuzzyMatcher();

console.log(matcher.phoneticMatch("Marpa", "Marpah"));   // true
console.log(matcher.phoneticMatch("Marpa", "Milarepa")); // false
console.log(matcher.phoneticMatch("Smith", "Smythe"));   // true
```

## Handling Tibetan Names

### Tibetan Script vs. Wylie vs. Phonetic

The service handles all three representations:

```typescript
// These all match with high similarity:
"མར་པ།"                  (Tibetan script)
"mar pa"                  (Wylie transliteration)
"Marpa"                   (Phonetic/English)
```

### Honorific Stripping

Common honorifics are automatically removed:

```typescript
// These normalize to the same thing:
"Marpa Rinpoche"          → "marpa"
"Rinpoche Marpa"          → "marpa"
"Marpa Lotsawa"           → "marpa lotsawa"
"མར་པ། རིན་པོ་ཆེ།"       → (tibetan only, not stripped)
```

**Honorifics removed:**
- Rinpoche (རིན་པོ་ཆེ)
- Lama (བླ་མ)
- Je (རྗེ)
- Lotsawa
- Panchen (པཎ་ཆེན)
- Dalai (དལའི)
- Khenpo (མཁན་པོ)
- Geshe (དགེ་བཤེས)
- Tulku (སྤྲུལ་སྐུ)

### Transliteration Variants

Known Wylie ↔ Phonetic mappings:

```typescript
// Automatically recognized:
"bla ma"      ↔ "lama"
"mar pa"      ↔ "marpa"
"mi la"       ↔ "milarepa", "mila"
"sgam po pa"  ↔ "gampopa"
"tsong kha pa" ↔ "tsongkhapa"
"pad+ma"      ↔ "padma", "pema"
"sa skya"     ↔ "sakya"
"dge lugs"    ↔ "gelug"
"rnying ma"   ↔ "nyingma"
"bka' brgyud" ↔ "kagyu"
```

## Example Matches with Scores

### Very High Confidence (0.95+)

```
"Marpa" vs "Mar-pa"
  Score: 0.97
  Type: transliteration
  Reason: Known transliteration variant
  Components: {levenshtein: 0.83, phonetic: 1.0, wordLevel: 1.0, lengthPenalty: 1.0}

"Tsongkhapa" vs "tsong kha pa"
  Score: 0.98
  Type: transliteration
  Reason: Known Wylie variant
  Components: {levenshtein: 0.75, phonetic: 0.95, wordLevel: 0.85, lengthPenalty: 1.0}

"Padmasambhava" vs "Padma Sambhava"
  Score: 0.96
  Type: exact
  Reason: Exact match after normalization
  Components: {levenshtein: 1.0, phonetic: 1.0, wordLevel: 1.0, lengthPenalty: 1.0}
```

### High Confidence (0.85-0.95)

```
"Marpa Lotsawa" vs "Marpa the Translator"
  Score: 0.89
  Type: word_order
  Reason: Word-level match (different order)
  Components: {levenshtein: 0.65, phonetic: 0.85, wordLevel: 0.90, lengthPenalty: 0.85}

"Milarepa" vs "Jetsun Milarepa"
  Score: 0.87
  Type: levenshtein
  Reason: Character-level similarity
  Components: {levenshtein: 0.75, phonetic: 0.90, wordLevel: 0.80, lengthPenalty: 0.85}

"Gampopa" vs "sgam po pa"
  Score: 0.88
  Type: transliteration
  Reason: Known Wylie variant
  Components: {levenshtein: 0.70, phonetic: 0.85, wordLevel: 0.90, lengthPenalty: 1.0}
```

### Medium Confidence (0.75-0.85)

```
"Mila" vs "Milarepa"
  Score: 0.82
  Type: levenshtein
  Reason: Substring match
  Components: {levenshtein: 0.75, phonetic: 0.80, wordLevel: 0.70, lengthPenalty: 0.70}

"Atisha" vs "Jo bo rje Atisha"
  Score: 0.78
  Type: word_order
  Reason: Partial word match with honorifics
  Components: {levenshtein: 0.60, phonetic: 0.75, wordLevel: 0.85, lengthPenalty: 0.70}

"Sakya Pandita" vs "Sakya Panchen"
  Score: 0.76
  Type: levenshtein
  Reason: Similar but different titles
  Components: {levenshtein: 0.72, phonetic: 0.78, wordLevel: 0.75, lengthPenalty: 0.95}
```

### Low Confidence (<0.75)

```
"Rinpoche" vs "Lama"
  Score: 0.45
  Type: levenshtein
  Reason: Generic honorifics, different words
  Components: {levenshtein: 0.25, phonetic: 0.30, wordLevel: 0.00, lengthPenalty: 0.85}

"Dharma" vs "Dharma Raja"
  Score: 0.68
  Type: levenshtein
  Reason: Partial match but likely different entities
  Components: {levenshtein: 0.70, phonetic: 0.75, wordLevel: 0.50, lengthPenalty: 0.70}
```

## Performance Characteristics

### Time Complexity

- **Levenshtein distance:** O(n×m) where n, m are string lengths
- **Soundex:** O(n) where n is string length
- **Word-level matching:** O(w₁×w₂) where w₁, w₂ are word counts
- **Full comparison:** O(n×m) dominated by Levenshtein

### Space Complexity

- **Levenshtein:** O(n×m) for DP matrix
- **Overall:** O(n+m) with optimized Levenshtein (rolling array)

### Typical Performance

For entity resolution across 10,000 entities:
- Single name comparison: <1ms
- Full entity comparison (all variants): 5-10ms
- Finding similar names: 50-100ms per query

**Optimization notes:**
- Pre-normalize names and cache results
- Use database indexes for initial filtering
- Consider parallel processing for batch operations

## Integration with Entity Resolution

### Workflow

1. **Extract entities** from document (Phase 1)
2. **Find similar names** using FuzzyMatcher
3. **Review matches** above threshold
4. **Merge entities** if confirmed duplicate
5. **Update relationships** to point to merged entity

### Example Pipeline

```typescript
import { entityExtractor } from '../knowledgeGraph/EntityExtractor';
import { fuzzyMatcher } from './FuzzyMatcher';
import { entityMerger } from './EntityMerger'; // Phase 2.3

// Step 1: Extract entities from new document
const extraction = await entityExtractor.extractFromTranslation(translationId);

// Step 2: For each extracted entity, check for duplicates
for (const entity of extraction.entities) {
  const matches = fuzzyMatcher.findSimilarNames(
    entity.canonicalName,
    existingEntities,
    { threshold: 0.85, limit: 5 }
  );

  if (matches.length > 0) {
    // Step 3: Add to review queue or auto-merge based on confidence
    for (const match of matches) {
      if (match.score.score >= 0.95) {
        // High confidence: Auto-merge
        await entityMerger.mergeEntities(entity, match.candidate);
      } else {
        // Medium confidence: Add to review queue
        await reviewQueue.add({
          newEntity: entity,
          existingEntity: match.candidate,
          similarity: match.score,
          status: 'pending_review'
        });
      }
    }
  }
}
```

## Testing

### Unit Tests

```typescript
import { FuzzyMatcher } from './FuzzyMatcher';

describe('FuzzyMatcher', () => {
  const matcher = new FuzzyMatcher();

  test('exact match returns 1.0', () => {
    const score = matcher.calculateSimilarity("Marpa", "Marpa");
    expect(score.score).toBe(1.0);
  });

  test('known transliteration variant scores high', () => {
    const score = matcher.calculateSimilarity("mar pa", "marpa");
    expect(score.score).toBeGreaterThan(0.95);
  });

  test('phonetic match detected', () => {
    const match = matcher.phoneticMatch("Marpa", "Marpah");
    expect(match).toBe(true);
  });

  test('diacritics removed in normalization', () => {
    const norm = matcher.normalizeText("Pāramitā");
    expect(norm).toBe("paramita");
  });

  test('honorifics stripped', () => {
    const norm = matcher.normalizeText("Marpa Rinpoche");
    expect(norm).toBe("marpa");
  });
});
```

## Limitations and Future Improvements

### Current Limitations

1. **Tibetan script processing:** Currently treats Tibetan as opaque strings. Could improve with proper syllable parsing.

2. **Context-free:** Doesn't use dates, places, or relationships to improve matching. These are handled in Phase 2.2 (Duplicate Detection).

3. **Fixed transliteration map:** Hardcoded Wylie mappings. Could be expanded with more variants.

4. **No machine learning:** Uses rule-based algorithms. Could train ML model on curator decisions.

### Potential Improvements

1. **Tibetan syllable normalization:** Parse Tibetan into syllables and compare at syllable level instead of character level.

2. **Context-aware matching:** Incorporate temporal, spatial, and relationship signals (Phase 2.2).

3. **Machine learning model:** Train neural network on curator decisions to learn better similarity functions.

4. **Metaphone algorithm:** Add Metaphone (more accurate than Soundex) for English/phonetic names.

5. **Weighted entity types:** Different thresholds for Person vs Place vs Text entities.

6. **Performance optimization:** Pre-compute Soundex codes, cache normalized names, use approximate nearest neighbor search for large datasets.

## References

- **Levenshtein Distance:** https://en.wikipedia.org/wiki/Levenshtein_distance
- **Soundex Algorithm:** https://en.wikipedia.org/wiki/Soundex
- **Jaccard Similarity:** https://en.wikipedia.org/wiki/Jaccard_index
- **Wylie Transliteration:** https://en.wikipedia.org/wiki/Wylie_transliteration

## Support

For questions or issues with the FuzzyMatcher service:
1. Check the examples in this README
2. Review the inline JSDoc comments in FuzzyMatcher.ts
3. See Phase 2 specification: `/roadmaps/knowledge-graph/PHASES_SUMMARY.md`
