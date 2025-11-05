# OCR Implementation - File Reference

## All Files Created/Modified

### Created Files

#### OCR Detection Module
**File:** `/home/user/Translate/client/src/lib/ocr/ocrDetector.ts`
- **Lines:** 218
- **Purpose:** Intelligent detection of when OCR is needed
- **Key Functions:** `needsOCR()`, `detectPagesNeedingOCR()`, `isTextSparse()`
- **Exports:** OCRDetectionResult, OCRDetectionOptions

#### OCR Processing Engine
**File:** `/home/user/Translate/client/src/lib/ocr/tibetanOCR.ts`
- **Lines:** 354
- **Purpose:** Tesseract.js integration for Tibetan OCR
- **Key Classes:** `TibetanOCR`
- **Key Functions:** `initialize()`, `performOCR()`, `processMultiplePages()`, `ocrSinglePage()`
- **Exports:** OCRResult, OCRProgress, TibetanOCROptions

#### OCR Post-Processor
**File:** `/home/user/Translate/client/src/lib/ocr/ocrPostProcessor.ts`
- **Lines:** 334
- **Purpose:** Clean and validate OCR output
- **Key Classes:** `OCRPostProcessor`
- **Key Functions:** `process()`, `fixCharacterConfusions()`, `cleanOCRText()`
- **Exports:** PostProcessingResult, PostProcessingOptions

#### Documentation Files
**File:** `/home/user/Translate/OCR_IMPLEMENTATION_SUMMARY.md`
- **Purpose:** Comprehensive implementation documentation
- **Sections:** Overview, Architecture, Performance, Usage, Limitations

**File:** `/home/user/Translate/OCR_QUICK_REFERENCE.md`
- **Purpose:** Quick reference guide for developers
- **Sections:** Quick Start, API Reference, Common Patterns, Troubleshooting

**File:** `/home/user/Translate/OCR_FILES_REFERENCE.md` (this file)
- **Purpose:** File paths and structure reference

### Modified Files

#### Text Extractor (Main Integration)
**File:** `/home/user/Translate/client/src/lib/textExtractor.ts`

**Changes:**
1. **Lines 3-13:** Added OCR imports
   ```typescript
   import { needsOCR, detectPagesNeedingOCR, isTextSparse } from './ocr/ocrDetector';
   import { TibetanOCR, type OCRProgress } from './ocr/tibetanOCR';
   import { cleanOCRText } from './ocr/ocrPostProcessor';
   ```

2. **Lines 15-35:** Updated `ExtractedContent` interface
   - Added `extractionMethod` type: `'ocr' | 'hybrid-ocr'`
   - Added OCR metadata fields: `ocrUsed`, `ocrConfidence`, `ocrQuality`, etc.

3. **Lines 53-273:** Enhanced `extractFromPDF()` function
   - Added `onProgress` parameter
   - Added OCR detection logic (lines 120-127)
   - Added OCR processing (lines 136-225)
   - Added OCR metadata return values

4. **Lines 275-356:** Updated `extractTextContent()` function
   - Added `onProgress` parameter
   - Pass through OCR metadata
   - Return OCR fields in result

**Total Changes:** ~150 lines modified/added

#### Package Dependencies
**File:** `/home/user/Translate/package.json`

**Change:**
- **Line 86:** Added `"tesseract.js": "^6.0.1"`

## Directory Structure

```
/home/user/Translate/
├── client/
│   └── src/
│       └── lib/
│           ├── ocr/                           # NEW DIRECTORY
│           │   ├── ocrDetector.ts             # NEW FILE (218 lines)
│           │   ├── tibetanOCR.ts              # NEW FILE (354 lines)
│           │   └── ocrPostProcessor.ts        # NEW FILE (334 lines)
│           └── textExtractor.ts               # MODIFIED (150+ lines changed)
├── package.json                               # MODIFIED (1 line added)
├── OCR_IMPLEMENTATION_SUMMARY.md             # NEW FILE (documentation)
├── OCR_QUICK_REFERENCE.md                    # NEW FILE (quick reference)
└── OCR_FILES_REFERENCE.md                    # NEW FILE (this file)
```

## File Sizes

| File | Lines | Purpose |
|------|-------|---------|
| `ocrDetector.ts` | 218 | Detection logic |
| `tibetanOCR.ts` | 354 | OCR processing |
| `ocrPostProcessor.ts` | 334 | Post-processing |
| `textExtractor.ts` (changes) | ~150 | Integration |
| **Total New Code** | **~1,056 lines** | Complete OCR system |

## Import Paths (for reference)

### From Components/Pages:

```typescript
// Main extraction (automatic OCR)
import { extractTextContent } from '@/lib/textExtractor';

// Manual OCR detection
import { needsOCR, detectPagesNeedingOCR } from '@/lib/ocr/ocrDetector';

// Manual OCR processing
import { TibetanOCR, ocrSinglePage } from '@/lib/ocr/tibetanOCR';

// OCR post-processing
import { cleanOCRText, OCRPostProcessor } from '@/lib/ocr/ocrPostProcessor';
```

### From Other Lib Files:

```typescript
// Relative imports
import { needsOCR } from './ocr/ocrDetector';
import { TibetanOCR } from './ocr/tibetanOCR';
import { cleanOCRText } from './ocr/ocrPostProcessor';
```

## Type Exports

### Main Types

```typescript
// From ocrDetector.ts
export interface OCRDetectionResult { ... }
export interface OCRDetectionOptions { ... }

// From tibetanOCR.ts
export interface OCRResult { ... }
export interface OCRProgress { ... }
export interface TibetanOCROptions { ... }
export class TibetanOCR { ... }

// From ocrPostProcessor.ts
export interface PostProcessingResult { ... }
export interface PostProcessingOptions { ... }
export class OCRPostProcessor { ... }

// From textExtractor.ts (updated)
export interface ExtractedContent { ... }
```

## Dependencies Added

### NPM Package

```json
{
  "dependencies": {
    "tesseract.js": "^6.0.1"
  }
}
```

**Installation:**
```bash
npm install tesseract.js
```

### Tesseract.js Dependencies (automatically installed)

- `tesseract.js-core` - Core OCR engine
- Language packs (downloaded at runtime):
  - `bod.traineddata` - Tibetan language pack (~5 MB)
  - `eng.traineddata` - English language pack (~5 MB)

**Source:** https://tessdata.projectnaptha.com/4.0.0/

## Related Files (Not Modified)

These files work with OCR but weren't modified:

- `/home/user/Translate/client/src/lib/tibetan/unicodeValidator.ts` - Used for validation
- `/home/user/Translate/client/src/lib/tibetan/syllableDetector.ts` - Used for validation
- `/home/user/Translate/client/src/lib/pdf/PositionalTextBuilder.ts` - Used for text building
- `/home/user/Translate/client/src/lib/pdf/artifactRemover.ts` - Used for cleanup
- `/home/user/Translate/client/src/lib/pdf/layoutAnalyzer.ts` - Used for layout detection

## Git Status

To see what changed:

```bash
# Show all modified files
git status

# Show OCR-related changes
git diff client/src/lib/ocr/
git diff client/src/lib/textExtractor.ts
git diff package.json

# Show line count changes
git diff --stat
```

## Build/Compile

### Type Checking

```bash
npm run check
```

**Expected result:** No errors in OCR files

### Development Server

```bash
npm run dev
```

**Expected result:** Server starts, OCR modules compile successfully

### Production Build

```bash
npm run build
```

**Expected result:** All OCR modules bundled correctly

## Testing Files Needed

To fully test OCR, create these test files:

```
/home/user/Translate/tests/
├── fixtures/
│   ├── scanned-tibetan.pdf        # Fully scanned PDF (no text layer)
│   ├── hybrid-tibetan.pdf         # Mixed scanned/digital
│   ├── digital-tibetan.pdf        # Native digital PDF
│   └── low-quality-scan.pdf       # Poor quality scan
└── ocr/
    ├── ocrDetector.test.ts
    ├── tibetanOCR.test.ts
    └── ocrPostProcessor.test.ts
```

## Maintenance Notes

### Where to Make Changes

**To adjust OCR detection:**
- Edit: `/home/user/Translate/client/src/lib/ocr/ocrDetector.ts`
- Modify: `needsOCR()` function thresholds

**To improve OCR quality:**
- Edit: `/home/user/Translate/client/src/lib/ocr/tibetanOCR.ts`
- Modify: `renderDpi`, `psm`, image enhancement

**To fix OCR errors:**
- Edit: `/home/user/Translate/client/src/lib/ocr/ocrPostProcessor.ts`
- Modify: `CHARACTER_CONFUSION_MAP`, correction logic

**To change integration:**
- Edit: `/home/user/Translate/client/src/lib/textExtractor.ts`
- Modify: `extractFromPDF()` OCR flow

### Adding New Features

**Add OCR language:**
```typescript
// In tibetanOCR.ts, line 41
language: 'bod+eng+san', // Add Sanskrit
```

**Add detection criteria:**
```typescript
// In ocrDetector.ts, needsOCR function
if (customCondition) {
  result.needsOCR = true;
  result.reason = 'Custom reason';
}
```

**Add post-processing rule:**
```typescript
// In ocrPostProcessor.ts, CHARACTER_CONFUSION_MAP
const CHARACTER_CONFUSION_MAP = {
  // ... existing
  'newWrong': 'newCorrect',
};
```

## Troubleshooting File Issues

### If OCR files not found:

```bash
# Check files exist
ls -la /home/user/Translate/client/src/lib/ocr/

# Check imports
grep -r "from '@/lib/ocr" /home/user/Translate/client/src/
```

### If TypeScript errors:

```bash
# Check for type errors
npm run check 2>&1 | grep ocr

# Rebuild
npm run build
```

### If imports fail:

```bash
# Check tsconfig path aliases
cat /home/user/Translate/tsconfig.json | grep paths

# Verify module resolution
npm run check
```

## Backup Recommendations

Before making changes, backup these files:

```bash
# Critical files
cp client/src/lib/textExtractor.ts client/src/lib/textExtractor.ts.backup
cp client/src/lib/ocr/ocrDetector.ts client/src/lib/ocr/ocrDetector.ts.backup
cp client/src/lib/ocr/tibetanOCR.ts client/src/lib/ocr/tibetanOCR.ts.backup
cp client/src/lib/ocr/ocrPostProcessor.ts client/src/lib/ocr/ocrPostProcessor.ts.backup
```

## Quick File Access

```bash
# Navigate to OCR directory
cd /home/user/Translate/client/src/lib/ocr

# Edit files
nano ocrDetector.ts
nano tibetanOCR.ts
nano ocrPostProcessor.ts

# View main integration
nano ../textExtractor.ts
```

---

**Last Updated:** November 5, 2025
**Implementation Status:** ✅ Complete
**Type Safety:** ✅ All passing
**Ready for Testing:** ✅ Yes
