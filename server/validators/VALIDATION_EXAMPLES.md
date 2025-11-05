# Translation Validation System - Examples and Usage

This document provides comprehensive examples of the input and output validation system for Tibetan translations.

## Overview

The validation system consists of two main validators:
- **InputValidator**: Validates Tibetan text before translation processing
- **OutputValidator**: Validates translation output after processing

## Input Validation

### Purpose
Ensures that input text meets quality and format requirements before expensive translation processing.

### Validation Criteria

1. **Text Length**
   - Minimum: 10 characters
   - Maximum: 100,000 characters
   - Warning threshold: 50,000 characters

2. **Tibetan Content**
   - Minimum: 50% Tibetan characters (Unicode U+0F00-U+0FFF)
   - Warning threshold: 70% Tibetan characters

3. **Unicode Encoding**
   - No null bytes
   - No invalid UTF-8 sequences
   - No Unicode replacement characters (�)
   - Check for mixed normalization forms

---

## Example 1: Valid Tibetan Text

### Input
```
བཀྲ་ཤིས་བདེ་ལེགས། ང་ནི་བོད་པ་ཞིག་ཡིན། སངས་རྒྱས་ཀྱི་བསྟན་པ་ལ་དད་པ་ཡོད།
```

### Validation Result
```
Status: ✓ PASSED

Metadata:
  - Text length: 85 characters
  - Tibetan content: 98.8%

No issues found. Text is ready for translation.
```

---

## Example 2: Text Too Short

### Input
```
བཀྲ་ཤིས།
```

### Validation Result
```
Status: ✗ FAILED

Metadata:
  - Text length: 9 characters
  - Tibetan content: 100.0%

Errors (1):
  1. Text is too short (9 characters). Minimum length is 10 characters.
```

---

## Example 3: Insufficient Tibetan Content

### Input
```
This is mostly English text with just a few Tibetan characters: བོད།
```

### Validation Result
```
Status: ✗ FAILED

Metadata:
  - Text length: 70 characters
  - Tibetan content: 7.1%

Errors (1):
  1. Insufficient Tibetan content (7.1%). Text must contain at least 50% Tibetan characters.
     Found 5 Tibetan characters out of 70 total non-whitespace characters.
```

---

## Example 4: No Tibetan Characters

### Input
```
This is completely English text with no Tibetan characters at all.
```

### Validation Result
```
Status: ✗ FAILED

Metadata:
  - Text length: 63 characters
  - Tibetan content: 0.0%

Errors (1):
  1. No Tibetan characters detected in the text. Please ensure the text is in Tibetan
     script (Unicode U+0F00-U+0FFF).
```

---

## Example 5: Text Too Long

### Input
```
[100,001 characters of text]
```

### Validation Result
```
Status: ✗ FAILED

Metadata:
  - Text length: 100001 characters

Errors (1):
  1. Text is too long (100001 characters). Maximum length is 100,000 characters.
     Please split the text into smaller chunks.
```

---

## Example 6: Text with Unicode Issues

### Input
```
བཀྲ་ཤིས�བདེ་ལེགས། [contains Unicode replacement character]
```

### Validation Result
```
Status: ✗ FAILED

Metadata:
  - Text length: 22 characters
  - Tibetan content: 95.5%
  - Unicode issues: replacement_character

Errors (1):
  1. Text contains Unicode replacement character (�), indicating corrupted or invalid encoding

Warnings (0):
```

---

## Example 7: Text with Control Characters

### Input
```
བཀྲ་ཤིས\x00\x01བདེ་ལེགས། [contains null bytes and control characters]
```

### Validation Result
```
Status: ✗ FAILED

Metadata:
  - Text length: 22 characters
  - Tibetan content: 90.9%
  - Unicode issues: null_bytes, control_characters

Errors (1):
  1. Text contains null bytes (\0), which indicates corrupted data

Warnings (1):
  1. Text contains 2 control character(s) which may indicate encoding issues.
     These may cause unexpected behavior during translation.
```

---

## Output Validation

### Purpose
Ensures that translation output meets format and quality requirements.

### Validation Criteria

1. **Completeness**
   - Minimum: 10 characters
   - Translation must not be empty or just error messages

2. **Format Compliance**
   - Required format: "English (Tibetan)"
   - Balanced parentheses
   - Tibetan text inside parentheses
   - English text outside parentheses

3. **Tibetan Preservation**
   - Minimum: 70% of original Tibetan text preserved
   - Tibetan text should be in parentheses

4. **AI Error Detection**
   - No "I apologize" or "I cannot" phrases
   - No meta-text prefixes like "Translation:", "Output:"
   - No code blocks or markdown
   - No AI preambles like "Here is the translation"

---

## Example 8: Valid Translation Output

### Input
```
Original: བཀྲ་ཤིས་བདེ་ལེགས། ང་ནི་བོད་པ་ཞིག་ཡིན།
Translation: Greetings (བཀྲ་ཤིས་བདེ་ལེགས།). I am a Tibetan (ང་ནི་བོད་པ་ཞིག་ཡིན།).
```

### Validation Result
```
Status: ✓ PASSED

Metadata:
  - Completeness: 100.0%
  - Format compliance: 100.0%
  - Tibetan preservation: 100.0%

No issues found. Translation meets all quality requirements.
```

---

## Example 9: Translation Too Short

### Input
```
Original: བཀྲ་ཤིས་བདེ་ལེགས།
Translation: Hi (བོད)
```

### Validation Result
```
Status: ✗ FAILED

Metadata:
  - Completeness: 50.0%
  - Format compliance: 70.0%
  - Tibetan preservation: 16.7%

Errors (1):
  1. Only 16.7% of Tibetan text preserved. Minimum requirement is 70%.
     Original: 18 characters, Translation: 3 characters.

Warnings (1):
  1. Translation is very short. Please verify it is complete.
```

---

## Example 10: Unbalanced Parentheses

### Input
```
Original: བཀྲ་ཤིས་བདེ་ལེགས།
Translation: Greetings (བཀྲ་ཤིས་བདེ་ལེགས། without closing
```

### Validation Result
```
Status: ✗ FAILED

Metadata:
  - Completeness: 100.0%
  - Format compliance: 30.0%
  - Tibetan preservation: 100.0%

Errors (1):
  1. Unbalanced parentheses: 1 opening, 0 closing.
     Translation format should be "English (Tibetan)".
```

---

## Example 11: Tibetan Outside Parentheses

### Input
```
Original: བཀྲ་ཤིས་བདེ་ལེགས།
Translation: བཀྲ་ཤིས Greetings (bde legs)
```

### Validation Result
```
Status: ✗ FAILED

Metadata:
  - Completeness: 100.0%
  - Format compliance: 20.0%
  - Tibetan preservation: 100.0%

Errors (2):
  1. 44.4% of Tibetan text is outside parentheses. All Tibetan text should be enclosed in parentheses.
  2. No Tibetan text found inside parentheses. Expected format: "English translation (Tibetan text)".
```

---

## Example 12: AI Refusal/Error

### Input
```
Original: བཀྲ་ཤིས་བདེ་ལེགས།
Translation: I apologize, but I cannot translate this text.
```

### Validation Result
```
Status: ✗ FAILED

Metadata:
  - Completeness: 100.0%
  - Format compliance: 0.0%
  - Tibetan preservation: 0.0%
  - AI errors detected: ai_refusal, ai_apology

Errors (3):
  1. Translation contains AI refusal or apology: "I apologize".
     This indicates the AI did not complete the translation properly.
  2. Translation contains AI refusal or apology: "I cannot".
     This indicates the AI did not complete the translation properly.
  3. Translation contains no Tibetan characters. All Tibetan text should be preserved in parentheses.
```

---

## Example 13: Meta-Text Prefix

### Input
```
Original: བཀྲ་ཤིས་བདེ་ལེགས།
Translation: Translation: Greetings (བཀྲ་ཤིས་བདེ་ལེགས།).
```

### Validation Result
```
Status: ✗ FAILED

Metadata:
  - Completeness: 100.0%
  - Format compliance: 70.0%
  - Tibetan preservation: 100.0%
  - AI errors detected: meta_text

Errors (1):
  1. Translation contains meta-text prefix: "Translation:".
     Translation should contain only the translated content without prefixes.
```

---

## Example 14: Code Blocks

### Input
```
Original: བཀྲ་ཤིས་བདེ་ལེགས།
Translation: ```
Greetings (བཀྲ་ཤིས་བདེ་ལེགས།)
```
```

### Validation Result
```
Status: ✗ FAILED

Metadata:
  - Completeness: 100.0%
  - Format compliance: 70.0%
  - Tibetan preservation: 100.0%
  - AI errors detected: code_blocks

Errors (1):
  1. Translation contains code block markers (```). These should be removed.
```

---

## Example 15: Insufficient Tibetan Preservation

### Input
```
Original: བཀྲ་ཤིས་བདེ་ལེགས། ང་ནི་བོད་པ་ཞིག་ཡིན། སངས་རྒྱས་ཀྱི་བསྟན་པ་ལ་དད་པ་ཡོད།
Translation: Greetings. I am Tibetan. I have faith in Buddhism.
```

### Validation Result
```
Status: ✗ FAILED

Metadata:
  - Completeness: 100.0%
  - Format compliance: 0.0%
  - Tibetan preservation: 0.0%

Errors (2):
  1. No Tibetan text found inside parentheses. Expected format: "English translation (Tibetan text)".
  2. Translation contains no Tibetan characters. All Tibetan text should be preserved in parentheses.
```

---

## Integration with Translation Pipeline

The validators are automatically integrated into the translation service pipeline:

### Input Validation (Before Phase 1)
```typescript
// In translationService.ts
const inputValidation = inputValidator.validateTibetanText(chunk.content);

if (!inputValidation.isValid) {
  throw createTranslationError(
    `Input validation failed: ${inputValidation.errors.join('; ')}`,
    'INPUT_VALIDATION_ERROR',
    400,
    { errors: inputValidation.errors, warnings: inputValidation.warnings }
  );
}
```

### Output Validation (After Phase 5)
```typescript
// In translationService.ts
const outputValidation = outputValidator.validateTranslation(
  processedTranslation,
  chunk.content
);

if (!outputValidation.isValid) {
  console.error('Output validation failed:', outputValidation.errors);
  // Log errors but continue (or implement retry logic)
}
```

---

## Using Validators Programmatically

### Input Validation
```typescript
import { inputValidator } from './validators/inputValidator';

// Full validation
const result = inputValidator.validateTibetanText(text);
if (result.isValid) {
  console.log('Text is valid!');
  console.log(`Tibetan content: ${result.metadata?.tibetanPercentage}%`);
} else {
  console.error('Validation failed:', result.errors);
}

// Quick validation (faster)
if (inputValidator.quickValidate(text)) {
  // Proceed with translation
}

// Get detailed report
const report = inputValidator.getValidationReport(result);
console.log(report);
```

### Output Validation
```typescript
import { outputValidator } from './validators/outputValidator';

// Full validation
const result = outputValidator.validateTranslation(translation, originalText);
if (result.isValid) {
  console.log('Translation is valid!');
  console.log(`Format compliance: ${result.metadata?.formatCompliance}%`);
  console.log(`Tibetan preservation: ${result.metadata?.tibetanPreservation}%`);
} else {
  console.error('Validation failed:', result.errors);
}

// Quick validation (faster)
if (outputValidator.quickValidate(translation)) {
  // Translation has basic format compliance
}

// Get detailed report
const report = outputValidator.getValidationReport(result);
console.log(report);
```

---

## API Error Responses

When input validation fails, the API returns a 400 error with detailed validation information:

```json
{
  "error": {
    "message": "Input validation failed: No Tibetan characters detected in the text",
    "code": "INPUT_VALIDATION_ERROR",
    "statusCode": 400,
    "details": {
      "errors": [
        "No Tibetan characters detected in the text. Please ensure the text is in Tibetan script (Unicode U+0F00-U+0FFF)."
      ],
      "warnings": [],
      "metadata": {
        "textLength": 63,
        "tibetanPercentage": 0
      }
    }
  }
}
```

---

## Best Practices

1. **Always validate input before translation** to avoid wasting API calls on invalid text
2. **Log validation warnings** even when validation passes to track potential issues
3. **Monitor validation metrics** to identify patterns in input quality
4. **Use quick validation** for fast pre-checks before full validation
5. **Include validation metadata** in translation results for quality tracking
6. **Implement retry logic** for output validation failures (Phase 2.4)
7. **Store validation results** in database for analytics and improvement

---

## Future Enhancements

- **Phase 2.3**: Automatic format correction for common output format issues
- **Phase 2.4**: Quality gates with configurable validation thresholds
- **Phase 3.3**: Terminology consistency checking across documents
- **Phase 4.4**: Learning from human corrections to improve validation

---

## Summary

The validation system provides comprehensive quality checks at both input and output stages:

- **Input validation** catches issues early, saving processing time and costs
- **Output validation** ensures translations meet format and quality standards
- **Detailed reporting** helps debug issues and improve the system
- **Integration with pipeline** provides seamless validation without manual intervention
- **Metrics tracking** enables monitoring and continuous improvement

All validation is now active in the translation pipeline and will help ensure high-quality translations!
