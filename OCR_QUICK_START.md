# OCR Quick Start Guide

## Quick Usage

### 1. Detect if OCR is Needed
```typescript
import { OCRService } from './server/services/ocr';

const ocr = new OCRService();
const needsOCR = ocr.needsOCR(extractedText, pageCount);
```

### 2. Process Single Page
```typescript
const result = await ocr.processPage(pageBuffer);
console.log(result.text);        // Extracted text
console.log(result.confidence);  // 0.0 - 1.0
console.log(result.quality);     // 0.0 - 1.0
```

### 3. Batch Processing
```typescript
const results = await ocr.processBatch(pageBuffers, {
  parallelism: 4,
  onProgress: (percent) => console.log(`${percent}%`)
});
```

### 4. Hybrid Extraction (Recommended)
```typescript
import { HybridExtractor } from './server/services/extraction';

const extractor = new HybridExtractor();
const result = await extractor.extract(pdfData);

// Automatically uses:
// - Native extraction for digital PDFs (fast)
// - OCR for scanned PDFs (accurate)
// - Hybrid for mixed quality
```

### 5. Quality Assessment
```typescript
import { OCRQualityAssessor } from './server/services/ocr';

const assessor = new OCRQualityAssessor();
const quality = assessor.assessQuality(ocrResult);

if (!quality.isAcceptable) {
  console.warn('Low OCR quality:', quality.warnings);
}
```

### 6. Caching
```typescript
import { OCRCache } from './server/services/ocr';

const cache = new OCRCache();

// Check cache
const cached = await cache.getCached(pageBuffer);
if (cached) return cached;

// Process and cache
const result = await ocr.processPage(pageBuffer);
await cache.cacheResult(pageBuffer, result);
```

## Configuration

```typescript
import { OCRService } from './server/services/ocr';

const ocr = new OCRService({
  lang: 'bod+eng',  // Tibetan + English
  dpi: 300,         // High quality
  psm: 3,           // Auto segmentation
  oem: 1,           // LSTM neural net
});
```

## API Reference

### OCRService
- `needsOCR(text, pageCount)` - Detect sparse text
- `processPage(buffer)` - OCR single page
- `processBatch(buffers, options)` - Parallel OCR
- `postProcess(text)` - Fix common errors
- `cleanup()` - Release resources

### HybridExtractor
- `extract(pdfData, onProgress?)` - Smart extraction

### OCRQualityAssessor
- `assessQuality(result)` - Single page quality
- `assessBatch(results)` - Batch quality

### OCRCache
- `cacheResult(buffer, result)` - Cache OCR result
- `getCached(buffer)` - Retrieve cached result
- `invalidate(buffer)` - Remove from cache
- `getStats()` - Cache statistics

## Common Patterns

### Pattern 1: Safe Extraction
```typescript
try {
  const extractor = new HybridExtractor();
  const result = await extractor.extract(pdfData);

  if (result.warnings?.length > 0) {
    console.warn('Warnings:', result.warnings);
  }

  return result.text;
} catch (error) {
  console.error('Extraction failed:', error);
  return '';
}
```

### Pattern 2: Cached Batch Processing
```typescript
const ocr = new OCRService();
const cache = new OCRCache();

async function processPages(pageBuffers) {
  const results = [];

  for (const buffer of pageBuffers) {
    // Try cache first
    let result = await cache.getCached(buffer);

    if (!result) {
      // Process with OCR
      result = await ocr.processPage(buffer);
      await cache.cacheResult(buffer, result);
    }

    results.push(result);
  }

  return results;
}
```

### Pattern 3: Quality-Based Fallback
```typescript
const extractor = new HybridExtractor();
const assessor = new OCRQualityAssessor();

const result = await extractor.extract(pdfData);
const quality = assessor.assessQuality({
  text: result.text,
  confidence: result.metadata.ocrConfidence || 0,
  quality: result.metadata.ocrQuality || 0,
});

if (!quality.isAcceptable) {
  // Manual review needed
  console.warn('Poor quality, manual review required');
  console.warn('Warnings:', quality.warnings);
}
```

## Troubleshooting

### Low OCR Quality
```typescript
// Check Tibetan ratio
if (quality.tibetanRatio < 0.3) {
  console.warn('Low Tibetan content');
}

// Check confidence
if (quality.avgConfidence < 0.6) {
  console.warn('Low OCR confidence');
}

// Check for suspicious patterns
if (quality.warnings.some(w => w.includes('Suspicious'))) {
  console.warn('Suspicious patterns detected');
}
```

### Performance Optimization
```typescript
// Increase parallelism
const results = await ocr.processBatch(pages, {
  parallelism: 8  // Process 8 pages at once
});

// Use caching
const cache = new OCRCache();
// 30-day TTL, automatic

// Monitor cache hit rate
const stats = cache.getStats();
console.log(`Hit rate: ${(stats.hitRate * 100).toFixed(1)}%`);
```

## Test Commands

```bash
# Run OCR tests
npm test tests/unit/services/ocr

# Run specific test file
npm test tests/unit/services/ocr/ocr-service.test.ts

# Run with coverage
npm run test:coverage tests/unit/services/ocr

# Watch mode
npm run test:watch tests/unit/services/ocr
```

## Files

### Production
- `server/services/ocr/OCRService.ts` - Main OCR service
- `server/services/ocr/OCRCache.ts` - Result caching
- `server/services/ocr/OCRQualityAssessor.ts` - Quality assessment
- `server/services/ocr/config.ts` - Configuration
- `server/services/ocr/types.ts` - Type definitions
- `server/services/extraction/HybridExtractor.ts` - Hybrid extraction

### Tests
- `tests/unit/services/ocr/ocr-service.test.ts`
- `tests/unit/services/ocr/ocr-cache.test.ts`
- `tests/unit/services/ocr/ocr-quality.test.ts`
- `tests/unit/services/ocr/hybrid-extractor.test.ts`

## Dependencies

- `tesseract.js` (v6.0.1) - Already installed ✅
- `pdfjs-dist` - Already installed ✅
- `CacheService` (Phase 0) - Already implemented ✅

## Performance Metrics

| Operation | Speed | Notes |
|-----------|-------|-------|
| needsOCR() | <1ms | Quick check |
| processPage() | 2-5s | First time |
| processPage() | ~10ms | Cached |
| processBatch(4) | 2-5s | Parallel |
| Native extraction | ~100ms | Digital PDFs |

## Quality Thresholds

- **Acceptable**: >0.6
- **High Quality**: >0.8
- **Tibetan Ratio**: >0.5 for Tibetan docs
- **Confidence**: >0.6 minimum

## Next Steps

1. Test with real scanned PDFs
2. Monitor accuracy metrics
3. Adjust thresholds if needed
4. Consider image preprocessing (Phase 3.2)
