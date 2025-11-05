# Translation Validators

Comprehensive validation system for Tibetan translation input and output.

## Overview

This directory contains validators that ensure translation quality at both input and output stages of the translation pipeline. The validators are automatically integrated into the translation service and run on every translation request.

## Files

### Core Validators
- **`inputValidator.ts`** - Validates Tibetan text input before translation
- **`outputValidator.ts`** - Validates translation output after processing

### Documentation
- **`VALIDATION_EXAMPLES.md`** - Comprehensive examples of validation in action
- **`test-validators.ts`** - Test script to demonstrate validators
- **`README.md`** - This file

## Quick Start

### Running the Test Suite

```bash
npx tsx server/validators/test-validators.ts
```

This will run 13 test cases demonstrating both input and output validation with various scenarios.

### Using Validators in Code

#### Input Validation
```typescript
import { inputValidator } from './validators/inputValidator';

const text = 'བཀྲ་ཤིས་བདེ་ལེགས།';
const result = inputValidator.validateTibetanText(text);

if (!result.isValid) {
  console.error('Validation failed:', result.errors);
  // Handle validation failure
} else {
  console.log('Text is valid!');
  console.log(`Tibetan content: ${result.metadata?.tibetanPercentage}%`);
  // Proceed with translation
}
```

#### Output Validation
```typescript
import { outputValidator } from './validators/outputValidator';

const translation = 'Greetings (བཀྲ་ཤིས་བདེ་ལེགས།)';
const originalText = 'བཀྲ་ཤིས་བདེ་ལེགས།';
const result = outputValidator.validateTranslation(translation, originalText);

if (!result.isValid) {
  console.error('Translation validation failed:', result.errors);
  // Handle validation failure or retry
} else {
  console.log('Translation is valid!');
  console.log(`Format compliance: ${result.metadata?.formatCompliance}%`);
  // Accept translation
}
```

## Integration with Translation Pipeline

The validators are automatically integrated into the translation service:

1. **Input Validation** runs **before Phase 1** (Initial Translation)
   - Location: `server/services/translationService.ts:84-107`
   - Rejects invalid input with `INPUT_VALIDATION_ERROR` (400)

2. **Output Validation** runs **after Phase 5** (Final Processing)
   - Location: `server/services/translationService.ts:192-222`
   - Logs validation results but continues processing
   - Includes validation metadata in response

## Validation Criteria

### Input Validation

✓ **Text Length**
- Minimum: 10 characters
- Maximum: 100,000 characters
- Warning: >50,000 characters

✓ **Tibetan Content**
- Minimum: 50% Tibetan characters (U+0F00-U+0FFF)
- Warning: <70% Tibetan characters

✓ **Unicode Encoding**
- No null bytes
- No control characters (except tab, newline, CR)
- No replacement characters (�)
- Valid UTF-8 encoding
- Consistent Unicode normalization

### Output Validation

✓ **Completeness**
- Minimum: 10 characters
- Not empty or error message only

✓ **Format Compliance**
- Pattern: "English (Tibetan)"
- Balanced parentheses
- Tibetan text inside parentheses
- English text outside parentheses

✓ **Tibetan Preservation**
- Minimum: 70% of original Tibetan preserved
- Tibetan characters present in translation

✓ **AI Error Detection**
- No "I apologize" or "I cannot" phrases
- No meta-text prefixes ("Translation:", "Output:")
- No code blocks (```)
- No AI preambles ("Here is the translation")

## Validation Results

Both validators return a `ValidationResult` or `OutputValidationResult` object:

```typescript
interface ValidationResult {
  isValid: boolean;       // Overall pass/fail
  errors: string[];       // Critical errors
  warnings: string[];     // Non-critical issues
  metadata?: {            // Additional metrics
    tibetanPercentage?: number;
    textLength?: number;
    unicodeIssues?: string[];
    // ... output-specific fields
  };
}
```

## Examples

See `VALIDATION_EXAMPLES.md` for 15 comprehensive examples covering:
- Valid inputs and outputs
- Various failure scenarios
- API error responses
- Integration examples

## API Integration

### Request Validation

The translation API automatically validates input using Zod schemas that incorporate the validators:

```typescript
// In translationController.ts
const validatedData = TranslationRequestSchema.parse(req.body);
// Includes tibetanTextSchema validation
```

### Response Metadata

Validation results are included in translation responses:

```json
{
  "translation": "Greetings (བཀྲ་ཤིས་བདེ་ལེགས།)",
  "confidence": 0.95,
  "validationMetadata": {
    "inputValidation": {
      "tibetanPercentage": 98.8,
      "textLength": 85
    },
    "outputValidation": {
      "isValid": true,
      "formatCompliance": 100,
      "tibetanPreservation": 100,
      "completeness": 100
    }
  }
}
```

## Error Handling

### Input Validation Errors

When input validation fails, a 400 error is returned:

```json
{
  "error": {
    "message": "Input validation failed: No Tibetan characters detected",
    "code": "INPUT_VALIDATION_ERROR",
    "statusCode": 400,
    "details": {
      "errors": ["No Tibetan characters detected in the text..."],
      "warnings": [],
      "metadata": {
        "textLength": 63,
        "tibetanPercentage": 0
      }
    }
  }
}
```

### Output Validation Errors

When output validation fails, the error is logged but processing continues. The validation metadata is included in the response for monitoring.

**Future Enhancement (Phase 2.4):** Implement automatic retry with refined prompts when output validation fails.

## Performance

### Quick Validation

Both validators provide a `quickValidate()` method for fast pre-checks:

```typescript
// Fast pre-check (microseconds)
if (inputValidator.quickValidate(text)) {
  // Likely valid, proceed to full validation
}

// Full validation (milliseconds)
const result = inputValidator.validateTibetanText(text);
```

### Performance Metrics

- Input validation: ~1-5ms per request
- Output validation: ~2-8ms per request
- Negligible impact on overall translation time (<1%)

## Monitoring and Analytics

Validation metrics are included in translation results for:
- Quality monitoring dashboards
- Error rate tracking
- Input quality trends
- Output format compliance rates

## Future Enhancements

### Phase 2.3: Format Correction
- Automatic format fixes for common issues
- Remove meta-text automatically
- Balance parentheses where possible

### Phase 2.4: Quality Gates
- Configurable validation thresholds
- Automatic retry on validation failures
- Rejection vs. warning policies

### Phase 3.3: Terminology Consistency
- Cross-document term consistency checks
- Glossary-based validation
- Term extraction and tracking

### Phase 4.4: Learning from Corrections
- Update validators based on human corrections
- Improve detection patterns over time
- Adaptive validation thresholds

## Development

### Adding New Validation Rules

#### Input Validator
```typescript
// In inputValidator.ts
private checkNewRule(text: string): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Your validation logic here
  if (/* condition */) {
    errors.push('Error message');
  }

  return { isValid: errors.length === 0, errors };
}

// Add to validateTibetanText()
const newRuleValidation = this.checkNewRule(text);
if (!newRuleValidation.isValid) {
  errors.push(...newRuleValidation.errors);
}
```

#### Output Validator
```typescript
// In outputValidator.ts
private checkNewRule(translation: string): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Your validation logic here
  if (/* condition */) {
    errors.push('Error message');
  }

  return { isValid: errors.length === 0, errors };
}

// Add to validateTranslation()
const newRuleValidation = this.checkNewRule(translation);
if (!newRuleValidation.isValid) {
  errors.push(...newRuleValidation.errors);
}
```

### Testing New Rules

Add test cases to `test-validators.ts`:

```typescript
console.log('Test X: New Validation Rule');
console.log('─'.repeat(40));
const testText = 'your test text here';
const result = inputValidator.validateTibetanText(testText);
console.log(inputValidator.getValidationReport(result));
console.log();
```

## Related Files

- `/server/schemas/translationSchemas.ts` - Zod schemas using validators
- `/server/services/translationService.ts` - Integration point
- `/server/services/translation/types.ts` - Type definitions
- `/server/controllers/translationController.ts` - API endpoints

## Support

For issues, questions, or enhancement requests:
1. Check `VALIDATION_EXAMPLES.md` for common scenarios
2. Run `test-validators.ts` to verify system is working
3. Review validation logs in console output
4. Check API error responses for detailed information

## License

Part of the Tibetan Translation Tool project.
