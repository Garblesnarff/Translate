# Temporal Resolver - Quick Reference

**Quick guide for developers using the Temporal Resolution Service**

---

## Import

```typescript
import { temporalResolver } from './server/services/relationships/TemporalResolver';
```

---

## Basic Usage

### Resolve Any Date Expression
```typescript
const date = await temporalResolver.resolveDate('fire-dragon year of the 14th rabjung');
console.log(date.year); // 1856
console.log(date.confidence); // 0.9
```

### With Context
```typescript
const date = await temporalResolver.resolveDate(
  'after Marpa died',
  {
    knownEntities: [marpaEntity, milarepaEntity],
    defaultYear: 1100
  }
);
```

---

## Date Format Examples

| Input | Result | Confidence |
|-------|--------|------------|
| `"1012"` | 1012 | 1.0 |
| `"1097 CE"` | 1097 | 1.0 |
| `"fire-dragon year of 14th rabjung"` | 1856 | 0.9 |
| `"water-horse year"` | ~1102 | 0.7 |
| `"after Marpa died"` | 1098 | 0.7 |
| `"at age 40"` (with context) | birth+40 | 0.85 |
| `"during reign of Songsten Gampo"` | ~633 | 0.85 |
| `"early Sakya period"` | ~1285 | 0.72 |
| `"summer of 1050"` | 1050 | 0.95 |
| `"mid-11th century"` | 1050 | 0.6 |

---

## Common Methods

### Convert Tibetan → Gregorian
```typescript
const year = temporalResolver.convertTibetanToGregorian(
  14,        // rabjung
  50,        // year within rabjung
  'fire',    // element
  'dragon'   // animal
);
// Returns: 1856
```

### Calculate Age
```typescript
const age = temporalResolver.calculateAge(1012, 1052);
// Returns: 40
```

### Get Era Date Range
```typescript
const range = temporalResolver.resolveEraDate('Sakya Period');
// Returns: { start: 1268, end: 1354, precision: 'estimated', confidence: 0.9 }
```

---

## Rabjung Quick Reference

| Rabjung | Years | Key Events |
|---------|-------|------------|
| 1 | 1027-1086 | Rabjung system established |
| 2 | 1087-1146 | Marpa, Milarepa era |
| 10 | 1567-1626 | Ming-Qing transition |
| 14 | 1807-1866 | 19th century masters |
| 16 | 1927-1986 | Modern era begins |
| 17 | 1987-2046 | Current rabjung |

---

## Element-Animal Cycle (60 years)

### Pattern
```
Wood:  rat, ox, tiger, rabbit
Fire:  dragon, snake, horse, sheep
Earth: monkey, bird, dog, pig
Metal: rat, ox, tiger, rabbit
Water: dragon, snake, horse, sheep
[repeat 3 times = 60 years]
```

### Common Combinations
- **Fire-Dragon**: Years 5, 65, 125... (1856, 1916, 1976, 2036)
- **Water-Horse**: Years 19, 79, 139... (1902, 1962, 2022)
- **Earth-Tiger**: Years 51, 111, 171... (1938, 1998, 2058)

---

## Major Eras

| Era | Years | Type |
|-----|-------|------|
| Reign of Songsten Gampo | 617-650 | reign |
| Tibetan Empire | 618-842 | period |
| Era of Fragmentation | 842-978 | period |
| Later Diffusion | 978-1204 | period |
| Sakya Period | 1268-1354 | period |
| Phagmodrupa Dynasty | 1354-1435 | dynasty |
| Ganden Phodrang | 1642-1959 | period |
| Reign of Fifth Dalai Lama | 1642-1682 | reign |
| Rimé Movement | 1850-1950 | movement |

---

## Precision Levels

- **exact**: Year is precise (±0 years)
- **circa**: Approximate (±5 years)
- **estimated**: Best guess (±10 years)
- **disputed**: Scholars disagree
- **unknown**: Cannot determine

---

## Confidence Ranges

- **0.9-1.0**: High confidence (direct dates, full rabjung)
- **0.7-0.9**: Medium-high (relative dates, element-animal with context)
- **0.5-0.7**: Medium (era dates, element-animal without context)
- **0.3-0.5**: Low (vague references)

---

## Error Handling

```typescript
try {
  const date = await temporalResolver.resolveDate(expression);
} catch (error) {
  if (error.message.includes('not found')) {
    // Reference entity doesn't exist
  } else if (error.message.includes('Invalid')) {
    // Invalid rabjung/year combination
  } else {
    // Could not parse date expression
  }
}
```

---

## Return Type

```typescript
interface ResolvedDate extends DateInfo {
  year?: number;                    // Gregorian year
  gregorianYear: number;            // Always present
  precision: Precision;             // exact | circa | estimated | disputed | unknown
  confidence: number;               // 0.0-1.0
  originalExpression: string;       // What was input
  resolutionMethod: string;         // How it was resolved

  // Optional fields
  tibetanYear?: TibetanDate;        // If from Tibetan calendar
  season?: Season;                  // spring | summer | fall | winter
  era?: string;                     // Era name if era-based
  relative?: string;                // Description if relative
  referenceEntity?: {               // If relative to entity
    id: string;
    name: string;
    type: string;
  };
}
```

---

## Common Patterns

### Timeline Validation
```typescript
// Check if date is within person's lifetime
if (eventDate.year < person.dates.birth.year ||
    eventDate.year > person.dates.death.year) {
  console.warn('Event outside lifetime');
}
```

### Cross-Validation
```typescript
// Resolve date two ways
const method1 = await temporalResolver.resolveDate('water-horse year');
const method2 = await temporalResolver.resolveDate('3 years after X');

// Check if they agree
if (Math.abs(method1.year - method2.year) <= 2) {
  console.log('Dates validated!');
}
```

### Age Calculation
```typescript
// Find age at event
const birthYear = person.dates.birth.year;
const eventYear = await temporalResolver.resolveDate(eventDate);
const age = eventYear.year - birthYear;
```

---

## Testing

Run tests:
```bash
npm test -- TemporalResolver.test.ts
```

Run examples:
```bash
npx ts-node server/services/relationships/TemporalResolver.examples.ts
```

---

## Need Help?

See full documentation:
- `TEMPORAL_RESOLUTION_SUMMARY.md` - Complete guide
- `TemporalResolver.examples.ts` - 10 examples
- `TemporalResolver.test.ts` - Test cases
