# Temporal Resolution Service - Implementation Summary

**Phase 3, Task 3.3: Temporal Resolution**
**Created**: 2025-11-08
**Status**: ✅ Complete

---

## Overview

The Temporal Resolution Service provides comprehensive date resolution for Tibetan Buddhist texts, handling multiple calendar systems, relative dates, and historical era references.

## Date Formats Supported

### 1. **Gregorian Dates** (Direct)
- Simple years: `1012`, `1097`
- With suffixes: `1012 CE`, `1050 AD`
- **Confidence**: 1.0
- **Precision**: exact

### 2. **Tibetan Calendar (Rabjung System)**

#### What is Rabjung?
- 60-year cycles used in Tibetan chronology
- Rabjung 1 started in 1027 CE
- Currently in Rabjung 17 (1987-2046)

#### Supported Formats
- Full specification: `"fire-dragon year of the 14th rabjung"`
  - Resolves to exact year (e.g., 1856)
  - **Confidence**: 0.9
  - **Precision**: exact

- Rabjung only: `"12th rabjung"`
  - Resolves to middle of cycle
  - **Confidence**: 0.5
  - **Precision**: estimated

#### Rabjung Lookup Table
```typescript
Rabjung  1: 1027-1086
Rabjung  2: 1087-1146
Rabjung  3: 1147-1206
Rabjung  4: 1207-1266
Rabjung  5: 1267-1326
Rabjung  6: 1327-1386
Rabjung  7: 1387-1446
Rabjung  8: 1447-1506
Rabjung  9: 1507-1566
Rabjung 10: 1567-1626
Rabjung 11: 1627-1686
Rabjung 12: 1687-1746
Rabjung 13: 1747-1806
Rabjung 14: 1807-1866
Rabjung 15: 1867-1926
Rabjung 16: 1927-1986
Rabjung 17: 1987-2046
```

### 3. **Element-Animal Cycle**

#### Chinese Sexagenary Cycle
- 60-year repeating cycle
- 5 elements × 12 animals = 60 combinations
- Each element appears twice (male/female)
- Used across East Asian calendars

#### Supported Formats
- Element-animal: `"fire-dragon year"`
- With context: `"water-horse year"` (near 1100 CE)
- **Confidence**: 0.6-0.8 (depending on context)
- **Precision**: circa

#### Element-Animal Pattern
```
Year 1-4:   Wood (rat, ox, tiger, rabbit)
Year 5-8:   Fire (dragon, snake, horse, sheep)
Year 9-12:  Earth (monkey, bird, dog, pig)
Year 13-16: Metal (rat, ox, tiger, rabbit)
Year 17-20: Water (dragon, snake, horse, sheep)
[pattern repeats 3 times for 60 years]
```

#### Example: Fire-Dragon Year
The fire-dragon combination occurs every 60 years:
- 1856, 1916, 1976, 2036...
- Service picks nearest occurrence based on context

### 4. **Relative Dates**

#### Supported Patterns

**"after X died"**
```typescript
Input: "after Marpa died"
Process:
  1. Lookup entity "Marpa"
  2. Find death date: 1097
  3. Add 1 year offset
Result: 1098 CE
Confidence: 0.7
```

**"before X was born"**
```typescript
Input: "before Atisha was born"
Process:
  1. Lookup entity "Atisha"
  2. Find birth date: 982
  3. Subtract 1 year
Result: 981 CE
Confidence: 0.7
```

**"X years after Y event"**
```typescript
Input: "three years after Marpa died"
Process:
  1. Lookup entity "Marpa"
  2. Find death date: 1097
  3. Add 3 years
Result: 1100 CE
Confidence: 0.75
```

**"at age X"**
```typescript
Input: "at age 40" (context: Milarepa)
Process:
  1. Use context entity Milarepa
  2. Find birth date: 1052
  3. Add 40 years
Result: 1092 CE
Confidence: 0.85
Precision: exact
```

### 5. **Era-Based Dates**

#### Era Database
We maintain a curated database of major Tibetan historical eras:

```typescript
// Dynastic Periods
Tibetan Empire: 618-842
Era of Fragmentation: 842-978
Phagmodrupa Dynasty: 1354-1435
Rinpung Period: 1435-1565
Tsangpa Dynasty: 1565-1642
Ganden Phodrang: 1642-1959

// Reigns
Songsten Gampo: 617-650
Trisong Detsen: 755-797
Fifth Dalai Lama: 1642-1682

// Buddhist Periods
Later Diffusion: 978-1204
Early Kadam Period: 1042-1150
Sakya Period: 1268-1354
Rimé Movement: 1850-1950
```

#### Resolution with Modifiers
```typescript
"during reign of Songsten Gampo"
  → Year: 633 (midpoint of 617-650)
  → Confidence: 0.85

"early Sakya period"
  → Year: 1285 (20% into 1268-1354)
  → Confidence: 0.72

"late Phagmodrupa dynasty"
  → Year: 1418 (80% into 1354-1435)
  → Confidence: 0.68
```

### 6. **Seasonal Markers**

```typescript
"summer of 1050"
  → Year: 1050
  → Season: summer
  → Precision: exact
  → Confidence: 0.95

"winter retreat 1045"
  → Year: 1045
  → Season: winter
  → Precision: exact
  → Confidence: 0.95
```

### 7. **Natural Language Dates**

#### Century Expressions
```typescript
"mid-11th century"
  → Year: 1050
  → Precision: estimated
  → Confidence: 0.6

"early 12th century"
  → Year: 1120
  → Precision: estimated
  → Confidence: 0.6

"late 13th century"
  → Year: 1280
  → Precision: estimated
  → Confidence: 0.6
```

---

## Core Methods

### `resolveDate(dateExpression, context)`
Main entry point for date resolution.

```typescript
const result = await temporalResolver.resolveDate(
  'fire-dragon year of the 14th rabjung',
  {
    documentId: 'trans-123',
    knownEntities: [marpa, milarepa],
    defaultYear: 1100,
  }
);

// Result:
{
  year: 1856,
  gregorianYear: 1856,
  tibetanYear: {
    rabjung: 14,
    year: 50,
    element: 'fire',
    animal: 'dragon'
  },
  precision: 'exact',
  confidence: 0.9,
  originalExpression: 'fire-dragon year of the 14th rabjung',
  resolutionMethod: 'rabjung'
}
```

### `convertTibetanToGregorian(rabjung, year, element, animal)`
Direct conversion from Tibetan calendar to Gregorian.

```typescript
const gregorian = temporalResolver.convertTibetanToGregorian(
  14,        // Rabjung 14
  50,        // Year 50 within rabjung
  'fire',    // Element
  'dragon'   // Animal
);
// Returns: 1856
```

### `resolveRelativeDate(expression, referenceEntity)`
Resolve date relative to known entity.

```typescript
const date = await temporalResolver.resolveRelativeDate(
  'after Marpa died',
  marpaEntity
);
// Returns DateInfo with year: 1098
```

### `resolveEraDate(eraName)`
Get date range for historical era.

```typescript
const range = temporalResolver.resolveEraDate('Sakya Period');
// Returns: { start: 1268, end: 1354, precision: 'estimated', confidence: 0.9 }
```

### `parseNaturalLanguageDate(text, contextYear)`
Parse natural language expressions.

```typescript
const date = temporalResolver.parseNaturalLanguageDate(
  'summer of 1050',
  1050
);
// Returns ResolvedDate with season: 'summer'
```

### `calculateAge(birthYear, eventYear)`
Simple age calculation.

```typescript
const age = temporalResolver.calculateAge(1012, 1052);
// Returns: 40
```

---

## Precision Levels

```typescript
type Precision = 'exact' | 'circa' | 'estimated' | 'disputed' | 'unknown';
```

### **exact**
- Direct Gregorian dates: "1012"
- Full rabjung dates with element/animal
- "at age X" calculations
- Seasonal dates: "summer of 1050"

### **circa**
- Relative dates: "after X died"
- Element-animal dates with context
- ±5 years uncertainty

### **estimated**
- Rabjung-only dates (no element/animal)
- Era-based dates with modifiers
- Century expressions
- ±10 years uncertainty

### **disputed**
- Multiple conflicting sources
- Scholarly disagreement
- Use with caution flag

### **unknown**
- Cannot determine from available information
- Requires manual review

---

## Confidence Scoring

### High Confidence (0.85-1.0)
- Direct Gregorian dates: **1.0**
- Full rabjung dates: **0.9**
- "at age X" with known birth: **0.85**

### Medium Confidence (0.6-0.85)
- Element-animal with context: **0.7-0.8**
- Relative dates: **0.7-0.75**
- Era dates with modifiers: **0.6-0.7**

### Low Confidence (0.3-0.6)
- Rabjung-only (no element/animal): **0.5**
- Vague era references: **0.4-0.5**
- Century expressions: **0.6**

---

## Tibetan Calendar Conversion Algorithm

### Rabjung → Gregorian

```typescript
function convertToGregorian(rabjung: number, year: number): number {
  // 1. Find rabjung cycle dates
  const cycle = RABJUNG_CYCLES[rabjung];
  // Example: Rabjung 14 = 1807-1866

  // 2. Add year offset
  const gregorian = cycle.start + (year - 1);
  // Example: 1807 + (50 - 1) = 1856

  return gregorian;
}
```

### Gregorian → Rabjung

```typescript
function convertToRabjung(gregorianYear: number): TibetanDate {
  // 1. Find which rabjung cycle contains this year
  for (const [rabjungNum, cycle] of Object.entries(RABJUNG_CYCLES)) {
    if (gregorianYear >= cycle.start && gregorianYear <= cycle.end) {
      // 2. Calculate year within rabjung
      const yearInRabjung = gregorianYear - cycle.start + 1;

      // 3. Lookup element and animal
      const cycleEntry = ELEMENT_ANIMAL_CYCLE[yearInRabjung - 1];

      return {
        rabjung: parseInt(rabjungNum),
        year: yearInRabjung,
        element: cycleEntry.element,
        animal: cycleEntry.animal
      };
    }
  }
}
```

### Element-Animal → Gregorian

```typescript
function elementAnimalToGregorian(
  element: Element,
  animal: Animal,
  contextYear?: number
): number {
  // 1. Find position in 60-year cycle
  const cycleEntry = ELEMENT_ANIMAL_CYCLE.find(
    e => e.element === element && e.animal === animal
  );
  // Example: fire-dragon is year 5 in cycle

  // 2. Calculate base year (first occurrence after 1027)
  const baseYear = 1027 + cycleEntry.year - 1;
  // Example: 1027 + 5 - 1 = 1031

  // 3. Find nearest occurrence to context year
  if (contextYear) {
    const cyclesPassed = Math.round((contextYear - baseYear) / 60);
    return baseYear + (cyclesPassed * 60);
  }

  // 4. Default to occurrence before 1500
  while (baseYear + 60 < 1500) {
    baseYear += 60;
  }

  return baseYear;
}
```

---

## Example Date Resolutions

### Example 1: Marpa's Biography

**Text**: "Marpa returned from India in the fire-dragon year"

```typescript
const date = await temporalResolver.resolveDate(
  'fire-dragon year',
  { defaultYear: 1050 } // Marpa lived ~1012-1097
);

// Result: 1076 (nearest fire-dragon to 1050)
```

### Example 2: Milarepa's Study Period

**Text**: "Milarepa studied with Marpa for six years, starting at age 38"

```typescript
// Step 1: Find when Milarepa was 38
const startDate = await temporalResolver.resolveDate(
  'at age 38',
  { knownEntities: [milarepa] }
);
// Result: 1090 (born 1052 + 38)

// Step 2: Calculate end date
const endYear = startDate.year + 6;
// Result: 1096
```

### Example 3: Cross-Validation

**Text**: "The teachings occurred in the water-horse year, three years after Marpa died"

```typescript
// Method 1: Element-animal
const method1 = await temporalResolver.resolveDate(
  'water-horse year',
  { defaultYear: 1097 }
);
// Result: ~1102

// Method 2: Relative date
const method2 = await temporalResolver.resolveDate(
  'three years after Marpa died',
  { knownEntities: [marpa] }
);
// Result: 1100 (1097 + 3)

// Validation: Both methods agree within 2 years
// Confidence increases: 0.8 → 0.9
```

### Example 4: Era Dating

**Text**: "Founded during the early Sakya period"

```typescript
const date = await temporalResolver.resolveDate(
  'early Sakya period'
);

// Result:
{
  year: 1285,           // 20% into 1268-1354 period
  era: 'Sakya Period',
  precision: 'estimated',
  confidence: 0.72
}
```

---

## Error Handling

### Missing Reference Entity
```typescript
try {
  await temporalResolver.resolveDate('after Unknown Person died');
} catch (error) {
  // Error: "Reference entity Unknown Person not found"
}
```

### Invalid Rabjung
```typescript
try {
  temporalResolver.convertTibetanToGregorian(18, 1);
} catch (error) {
  // Error: "Invalid rabjung: 18"
}
```

### Ambiguous Date
```typescript
try {
  await temporalResolver.resolveDate('invalid date expression');
} catch (error) {
  // Error: "Could not resolve date expression"
}
```

---

## Usage in Relationship Extraction

### Integration with RelationshipExtractor

```typescript
// In relationship extraction
const relationship = {
  subject: 'milarepa-id',
  predicate: 'received_transmission',
  object: 'marpa-id',
  properties: {
    teaching: 'Mahamudra',
    location: 'lhodrak-id',
    date: 'water-horse year when he was 38'
  }
};

// Resolve date
const resolvedDate = await temporalResolver.resolveDate(
  relationship.properties.date,
  {
    knownEntities: [milarepa, marpa],
    defaultYear: 1090
  }
);

// Update relationship with resolved date
relationship.properties.resolvedDate = resolvedDate;
```

### Cross-Referencing Dates

```typescript
// Validate timeline consistency
if (resolvedDate.year < marpa.dates.birth.year) {
  console.warn('Impossible: event before teacher was born');
}

if (resolvedDate.year > marpa.dates.death.year) {
  console.warn('Impossible: event after teacher died');
}
```

---

## Testing

Comprehensive test suite covering:
- ✅ All date format parsing
- ✅ Rabjung conversion accuracy
- ✅ Element-animal cycle integrity
- ✅ Relative date resolution
- ✅ Era date ranges
- ✅ Confidence scoring
- ✅ Edge cases and error handling
- ✅ Data integrity (60-year cycles, etc.)

Run tests:
```bash
npm test -- TemporalResolver.test.ts
```

---

## Performance Characteristics

- **Direct dates**: O(1) - instant parsing
- **Rabjung dates**: O(1) - lookup table
- **Element-animal**: O(1) - array lookup
- **Relative dates**: O(n) - entity search (n = entities)
- **Era dates**: O(m) - era search (m = eras, small constant)
- **Natural language**: O(1) - regex matching

**Database Queries**: Only for relative date entity lookups

---

## Future Enhancements

1. **Lunar Calendar Support**
   - Tibetan lunar months
   - Festival date calculations

2. **Date Uncertainty Ranges**
   - Return ranges instead of single years
   - Support "between 1050-1055"

3. **Multiple Era Systems**
   - Chinese imperial eras
   - Indian eras (Kali Yuga, etc.)
   - Buddhist eras

4. **Machine Learning Date Extraction**
   - Train model on Tibetan date patterns
   - Auto-detect date format

5. **Conflict Resolution**
   - Handle contradictory sources
   - Weighted averaging of dates

---

## Files Created

1. **`TemporalResolver.ts`** (1,200+ lines)
   - Main service implementation
   - All date resolution methods
   - Lookup tables (rabjung, element-animal, eras)

2. **`TemporalResolver.examples.ts`** (450+ lines)
   - 10 comprehensive examples
   - Real-world scenarios
   - Cross-validation demonstrations

3. **`TemporalResolver.test.ts`** (500+ lines)
   - 50+ test cases
   - All date formats
   - Edge cases and errors
   - Data integrity tests

4. **`TEMPORAL_RESOLUTION_SUMMARY.md`** (this file)
   - Complete documentation
   - Algorithm explanations
   - Usage examples

---

## Summary

The Temporal Resolution Service provides **production-ready** date resolution for Tibetan Buddhist knowledge graphs with:

✅ **7 date format types**
✅ **5 resolution methods**
✅ **5 precision levels**
✅ **Confidence scoring**
✅ **17 rabjung cycles** (1027-2046)
✅ **60-year element-animal cycle**
✅ **15+ historical eras**
✅ **Comprehensive testing**
✅ **Full documentation**

**Ready for Phase 3 relationship extraction integration!**
