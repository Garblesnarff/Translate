# Tibetan Translation Tool - Comprehensive Implementation Plan

## Overview
This document breaks down the 4-phase improvement plan into the smallest logical work units for systematic implementation.

---

## **PHASE 1: CRITICAL FIXES (Week 1)**

### 1.1 PDF Text Extraction Improvements

#### 1.1.1 Tibetan-Aware Text Spacing
**File:** `client/src/lib/textExtractor.ts`
- [ ] **Task 1.1.1.1**: Add position data extraction from PDF.js
  - Extract `transform` property from textContent items
  - Calculate x, y coordinates for each text item
  - Store position metadata alongside text strings
  - **Location:** Line 40-44 in `extractFromPDF()`

- [ ] **Task 1.1.1.2**: Implement Tibetan syllable boundary detection
  - Create utility function `detectTibetanBoundaries(text: string): boolean`
  - Check for tsek (་) characters that mark syllable boundaries
  - Identify proper spacing vs. artifact spacing
  - **New file:** `client/src/lib/tibetan/syllableDetector.ts`

- [ ] **Task 1.1.1.3**: Build position-aware text reconstruction
  - Create `PositionalTextBuilder` class
  - Group text items by vertical position (same line)
  - Sort items by horizontal position
  - Calculate appropriate spacing based on distance
  - Preserve line breaks based on vertical distance
  - **New file:** `client/src/lib/pdf/PositionalTextBuilder.ts`

- [ ] **Task 1.1.1.4**: Integrate position-aware extraction into PDF extractor
  - Replace simple `.join(' ')` with `PositionalTextBuilder`
  - Pass position data from PDF.js to builder
  - Return formatted text with proper spacing
  - **Location:** `textExtractor.ts:40-44`

#### 1.1.2 Unicode Validation and Normalization
**New file:** `client/src/lib/tibetan/unicodeValidator.ts`
- [ ] **Task 1.1.2.1**: Create Unicode range validator
  - Define Tibetan Unicode ranges (U+0F00-U+0FFF)
  - Create `isValidTibetanText(text: string): boolean`
  - Calculate percentage of valid Tibetan characters
  - Set threshold (e.g., 70% Tibetan for valid document)

- [ ] **Task 1.1.2.2**: Implement Unicode normalization
  - Create `normalizeTibetanUnicode(text: string): string`
  - Convert NFD to NFC or vice versa (standardize)
  - Handle combining characters properly
  - Fix common Unicode corruption patterns

- [ ] **Task 1.1.2.3**: Add corruption detection
  - Detect broken Unicode sequences
  - Identify mojibake (encoding errors)
  - Flag pages with potential OCR errors
  - Create `UnicodeQualityReport` interface

- [ ] **Task 1.1.2.4**: Integrate validation into extraction pipeline
  - Call validator after text extraction
  - Add validation results to `ExtractedContent` type
  - Throw error if text fails validation
  - **Location:** `textExtractor.ts:64-89` in `extractTextContent()`

#### 1.1.3 PDF Artifact Removal
**New file:** `client/src/lib/pdf/artifactRemover.ts`
- [ ] **Task 1.1.3.1**: Detect common PDF artifacts
  - Create regex patterns for page numbers
  - Identify header patterns (repeated across pages)
  - Identify footer patterns (repeated across pages)
  - Detect margin content vs. body content

- [ ] **Task 1.1.3.2**: Build artifact removal engine
  - Create `PDFArtifactRemover` class
  - Implement `detectHeaders(pages: string[]): Pattern[]`
  - Implement `detectFooters(pages: string[]): Pattern[]`
  - Implement `removeArtifacts(text: string, patterns: Pattern[]): string`

- [ ] **Task 1.1.3.3**: Multi-page analysis for pattern detection
  - Compare first 3 pages to find common patterns
  - Use string similarity to identify repeating elements
  - Build artifact pattern database per document

- [ ] **Task 1.1.3.4**: Integrate into extraction pipeline
  - Run artifact detection on multi-page documents
  - Clean each page using detected patterns
  - **Location:** Add to `extractFromPDF()` after text extraction

#### 1.1.4 Multi-Column Layout Handling
**New file:** `client/src/lib/pdf/layoutAnalyzer.ts`
- [ ] **Task 1.1.4.1**: Detect multi-column layouts
  - Analyze horizontal position distribution
  - Identify column boundaries using x-coordinates
  - Detect if document has 1, 2, or 3 columns
  - Create `ColumnLayout` interface

- [ ] **Task 1.1.4.2**: Column-aware text reconstruction
  - Sort text items by column, then by vertical position
  - Handle column breaks properly
  - Maintain reading order (left column, then right column)
  - Add column break markers if needed

- [ ] **Task 1.1.4.3**: Test with multi-column PDFs
  - Create test PDF with 2-column layout
  - Verify correct reading order
  - Test with monastery texts (often multi-column)

---

### 1.2 Semantic Text Chunking

#### 1.2.1 Tibetan Sentence Boundary Detection
**New file:** `client/src/lib/tibetan/sentenceDetector.ts`
- [ ] **Task 1.2.1.1**: Define Tibetan sentence end markers
  - Shad (།) - basic sentence end
  - Double shad (༎) - section end
  - Nyis shad (༑) - enumeration marker
  - Create `TibetanPunctuation` enum

- [ ] **Task 1.2.1.2**: Implement sentence splitter
  - Create `splitIntoSentences(text: string): TibetanSentence[]`
  - Handle nested parentheses
  - Preserve punctuation with sentences
  - Return array with sentence text and boundaries

- [ ] **Task 1.2.1.3**: Handle mixed Tibetan-English text
  - Detect English periods (.) vs. Tibetan shad (།)
  - Handle abbreviations correctly
  - Don't split on periods in "Dr." or "etc."

#### 1.2.2 Semantic Chunking Engine
**Replace:** `client/src/lib/textChunker.ts`
- [ ] **Task 1.2.2.1**: Create `SemanticChunker` class
  - Constructor with max token limit parameter
  - Method `chunkBySemanticBoundaries(text: string): Chunk[]`
  - Respect sentence boundaries (never split mid-sentence)
  - Respect paragraph boundaries

- [ ] **Task 1.2.2.2**: Implement token counting
  - Create `estimateTokenCount(text: string): number`
  - Use rough estimate: ~4 chars per token for Tibetan
  - More accurate: use tiktoken library if available
  - Set safe limit: 3500 tokens per chunk (leave room for prompt)

- [ ] **Task 1.2.2.3**: Build chunk assembly algorithm
  - Start with first sentence
  - Add sentences until approaching token limit
  - When limit reached, finish current paragraph if possible
  - Create new chunk for remaining text
  - Ensure no chunk exceeds hard limit

- [ ] **Task 1.2.2.4**: Add context overlap
  - Include last 2 sentences from previous chunk
  - Mark overlap sentences for context only
  - Don't duplicate overlap in final translation
  - Create `ChunkWithContext` interface

#### 1.2.3 Page-Based Chunking Preservation
**Location:** `client/src/lib/textChunker.ts`
- [ ] **Task 1.2.3.1**: Detect "Page N:" markers
  - Extract page numbers from text
  - Create page boundaries
  - Keep current numbered paragraph detection

- [ ] **Task 1.2.3.2**: Create hybrid chunking strategy
  - If document has page markers, use page-based chunking
  - If page chunks exceed token limit, split by sentences
  - If no page markers, use pure semantic chunking
  - Return `TextChunk[]` with proper metadata

- [ ] **Task 1.2.3.3**: Update chunk interface
  - Add `hasOverlap: boolean` field
  - Add `overlapText?: string` field
  - Add `tokenCount: number` field
  - Add `chunkingStrategy: 'page' | 'semantic' | 'hybrid'` field

---

### 1.3 Input/Output Validation

#### 1.3.1 Input Text Validation
**New file:** `server/validators/inputValidator.ts`
- [ ] **Task 1.3.1.1**: Create `InputValidator` class
  - Method `validateTibetanText(text: string): ValidationResult`
  - Check if text contains Tibetan characters
  - Calculate Tibetan character percentage
  - Minimum threshold: 50% Tibetan characters

- [ ] **Task 1.3.1.2**: Check text length constraints
  - Minimum: 10 characters
  - Maximum: 100,000 characters per chunk
  - Warn if very long (may need splitting)

- [ ] **Task 1.3.1.3**: Validate Unicode encoding
  - Use `unicodeValidator` from Phase 1.1.2
  - Check for null bytes, control characters
  - Verify valid UTF-8 encoding

- [ ] **Task 1.3.1.4**: Integrate into translation pipeline
  - Call validator before translation starts
  - Return clear error message if validation fails
  - **Location:** `server/services/translationService.ts:68-88` before Phase 1

#### 1.3.2 Output Translation Validation
**New file:** `server/validators/outputValidator.ts`
- [ ] **Task 1.3.2.1**: Create `OutputValidator` class
  - Method `validateTranslation(translation: string, originalText: string): ValidationResult`
  - Check required format: "English text (Tibetan text)"
  - Verify Tibetan text is preserved in parentheses

- [ ] **Task 1.3.2.2**: Check translation completeness
  - Ensure translation is not empty
  - Minimum length: 10 characters
  - Not just error message
  - Not "I cannot translate" or similar cop-out

- [ ] **Task 1.3.2.3**: Validate Tibetan preservation
  - Extract all Tibetan text from parentheses
  - Compare with original Tibetan text
  - Calculate percentage of original text preserved
  - Flag if < 70% preserved

- [ ] **Task 1.3.2.4**: Check for common AI errors
  - Contains "I apologize" or "I cannot"
  - Contains code blocks or markdown formatting
  - Contains "Translation:" prefix
  - Starts with explanatory text

- [ ] **Task 1.3.2.5**: Integrate into translation pipeline
  - Call validator after each translation
  - Retry with refined prompt if validation fails
  - **Location:** `server/services/translationService.ts:163` after Phase 5

#### 1.3.3 Schema Validation with Zod
**Location:** `server/schemas/translationSchemas.ts`
- [ ] **Task 1.3.3.1**: Create input schemas
  - `tibetanTextSchema` - validates Tibetan input
  - `chunkSchema` - validates translation chunk
  - `configSchema` - validates translation config

- [ ] **Task 1.3.3.2**: Create output schemas
  - `translationResultSchema` - validates translation result
  - `qualityReportSchema` - validates quality analysis
  - Export all schemas for reuse

- [ ] **Task 1.3.3.3**: Apply schemas to API endpoints
  - Validate request bodies
  - Validate response bodies
  - **Location:** `server/controllers/translationController.ts`

---

### 1.4 Unicode Normalization

#### 1.4.1 Unicode Normalization Library
**New file:** `server/services/textProcessing/UnicodeNormalizer.ts`
- [ ] **Task 1.4.1.1**: Create `UnicodeNormalizer` class
  - Method `normalizeNFC(text: string): string` - composed form
  - Method `normalizeNFD(text: string): string` - decomposed form
  - Method `normalizeNFKC(text: string): string` - compatibility composed
  - Decide on standard: NFC for Tibetan (most common)

- [ ] **Task 1.4.1.2**: Handle Tibetan-specific normalization
  - Normalize combining characters (vowel marks)
  - Handle subjoined consonants consistently
  - Normalize spacing characters (tsek, space, nbsp)
  - Create `normalizeTibetanSpecific(text: string): string`

- [ ] **Task 1.4.1.3**: Add normalization to text extraction
  - Normalize extracted text immediately
  - **Location:** `client/src/lib/textExtractor.ts:44` after extraction

- [ ] **Task 1.4.1.4**: Add normalization to translation input
  - Normalize before sending to AI
  - **Location:** `server/services/translationService.ts:82` before Phase 1

#### 1.4.2 Whitespace Normalization
**Location:** `server/services/textProcessing/SpacingEnhancer.ts` (extend existing)
- [ ] **Task 1.4.2.1**: Normalize Tibetan spacing
  - Replace multiple spaces with single space
  - Replace non-breaking spaces with regular spaces
  - Normalize zero-width spaces
  - Keep single tsek between syllables

- [ ] **Task 1.4.2.2**: Fix common spacing errors
  - Remove spaces before tsek: "text ་" → "text་"
  - Add space after shad: "text།next" → "text། next"
  - Normalize English-Tibetan boundaries

- [ ] **Task 1.4.2.3**: Integrate into existing SpacingEnhancer
  - Add as preprocessing step
  - Apply before other formatting

---

## **PHASE 2: QUALITY IMPROVEMENTS (Week 2)**

### 2.1 Dictionary Expansion

#### 2.1.1 Core Buddhist Terms Dictionary
**New file:** `server/data/buddhist-terms.json`
- [ ] **Task 2.1.1.1**: Research and compile top 200 Buddhist terms
  - Sanskrit/Tibetan/English mappings
  - Terms from: Lamrim, Madhyamaka, Prajnaparamita
  - Focus on Sakya monastery texts
  - Categories: philosophy, practice, monastics, texts

- [ ] **Task 2.1.1.2**: Structure term entries
  - Create comprehensive schema:
    ```typescript
    interface DictionaryEntry {
      tibetan: string;
      wylie?: string; // transliteration
      english: string;
      alternateTranslations?: string[];
      sanskrit?: string;
      context: string;
      category: 'philosophy' | 'practice' | 'monastic' | 'general';
      usage?: string; // example usage
      frequency?: 'common' | 'uncommon' | 'rare';
    }
    ```

- [ ] **Task 2.1.1.3**: Create JSON data file
  - Format as array of entries
  - Validate JSON structure
  - Add inline comments for clarification

#### 2.1.2 Sakya Monastery Specific Terms
**New file:** `server/data/sakya-terms.json`
- [ ] **Task 2.1.2.1**: Compile Sakya-specific terminology
  - Sakya lineage holders (20+ entries)
  - Sakya texts (Lamdre, etc.)
  - Sakya monasteries and institutions
  - Sakya practices and rituals

- [ ] **Task 2.1.2.2**: Add honorific variations
  - Different forms of lama titles
  - Honorific particles
  - Formal vs. informal terms

#### 2.1.3 Extended Dictionary (500+ terms)
**New files:** `server/data/philosophy-terms.json`, `server/data/ritual-terms.json`, `server/data/historical-terms.json`
- [ ] **Task 2.1.3.1**: Philosophy terms (150 entries)
  - Madhyamaka terminology
  - Mind training terms
  - Epistemology terms

- [ ] **Task 2.1.3.2**: Ritual and practice terms (100 entries)
  - Meditation practices
  - Ritual implements
  - Offering terms

- [ ] **Task 2.1.3.3**: Historical and cultural terms (100 entries)
  - Historical figures
  - Place names
  - Cultural concepts

- [ ] **Task 2.1.3.4**: Common nouns and verbs (150 entries)
  - Frequently used words
  - Building comprehensive baseline

#### 2.1.4 Dictionary Loading and Management
**Location:** `server/dictionary.ts`
- [ ] **Task 2.1.4.1**: Create dictionary import system
  - Method `importFromJSON(filePath: string): Promise<void>`
  - Batch insert entries efficiently
  - Handle duplicates gracefully

- [ ] **Task 2.1.4.2**: Update initialization
  - Load all JSON files on startup
  - Add progress logging
  - **Location:** `dictionary.ts:82-104` expand `initializeDefaultDictionary()`

- [ ] **Task 2.1.4.3**: Add dictionary search capabilities
  - Method `searchTerm(tibetan: string): DictionaryEntry | null`
  - Method `searchByEnglish(english: string): DictionaryEntry[]`
  - Support partial matching

#### 2.1.5 Context-Aware Dictionary Usage
**Location:** `server/services/translation/PromptGenerator.ts`
- [ ] **Task 2.1.5.1**: Implement term extraction from input text
  - Method `extractRelevantTerms(text: string): DictionaryEntry[]`
  - Find all dictionary terms present in input
  - Rank by frequency and importance

- [ ] **Task 2.1.5.2**: Build focused dictionary context
  - Include only relevant terms in prompt
  - Limit to top 20 most relevant terms
  - Reduce prompt size, increase accuracy
  - **Location:** Replace full dictionary dump at line 45

- [ ] **Task 2.1.5.3**: Add term highlighting in prompts
  - Mark important terms: **བླ་མ** (Lama)
  - Provide context for each term
  - Emphasize consistency in usage

---

### 2.2 Confidence Calculation Improvements

#### 2.2.1 Semantic Similarity with Embeddings
**New file:** `server/services/translation/SemanticSimilarity.ts`
- [ ] **Task 2.2.1.1**: Set up embedding model
  - Use Gemini embedding API or OpenAI embeddings
  - Create `EmbeddingService` class
  - Method `getEmbedding(text: string): Promise<number[]>`

- [ ] **Task 2.2.1.2**: Implement cosine similarity
  - Create `cosineSimilarity(vec1: number[], vec2: number[]): number`
  - Returns value between 0 and 1

- [ ] **Task 2.2.1.3**: Build semantic comparison for translations
  - Method `compareTranslations(trans1: string, trans2: string): Promise<number>`
  - Get embeddings for both translations
  - Calculate cosine similarity
  - Use as agreement metric

- [ ] **Task 2.2.1.4**: Replace word-based similarity
  - **Location:** `confidence.ts:107-121` replace `calculateTranslationSimilarity()`
  - Use semantic similarity instead of word overlap
  - Much more accurate for comparing meaning

#### 2.2.2 Enhanced Confidence Factors
**Location:** `server/services/translation/confidence.ts`
- [ ] **Task 2.2.2.1**: Add dictionary term coverage factor
  - Count how many dictionary terms used
  - Check if used correctly
  - Add weight: 0.15 to confidence

- [ ] **Task 2.2.2.2**: Add punctuation preservation factor
  - Check if Tibetan punctuation preserved
  - Verify shad count matches original
  - Add weight: 0.1 to confidence

- [ ] **Task 2.2.2.3**: Add formatting quality factor
  - Check if parentheses balanced
  - Verify all Tibetan text in parentheses
  - Check sentence structure
  - Add weight: 0.1 to confidence

- [ ] **Task 2.2.2.4**: Update `calculateEnhancedConfidence()`
  - **Location:** Line 17-43
  - Add new factors
  - Reweight existing factors
  - Target: more accurate confidence scores

#### 2.2.3 Multi-Model Agreement Scoring
**Location:** `server/services/translation/confidence.ts`
- [ ] **Task 2.2.3.1**: Implement semantic agreement
  - Replace word-based comparison with embeddings
  - Use semantic similarity from Task 2.2.1.3
  - **Location:** Line 82-98 in `calculateModelAgreement()`

- [ ] **Task 2.2.3.2**: Add weighted agreement
  - Weight by individual model confidence
  - Higher confidence models have more weight
  - Create `calculateWeightedAgreement()` method

- [ ] **Task 2.2.3.3**: Detect outlier translations
  - Identify translations that differ significantly
  - Flag for review or exclusion
  - Don't let one bad translation skew consensus

---

### 2.3 Output Format Validation

#### 2.3.1 Strict Format Enforcement
**New file:** `server/validators/formatValidator.ts`
- [ ] **Task 2.3.1.1**: Create `FormatValidator` class
  - Method `validateFormat(translation: string): FormatValidation`
  - Check exact format: "English (Tibetan)"
  - Return detailed issues found

- [ ] **Task 2.3.1.2**: Validate parentheses structure
  - Count opening and closing parentheses
  - Check they're balanced
  - Verify Tibetan text inside parentheses
  - No nested parentheses (except for sub-clauses)

- [ ] **Task 2.3.1.3**: Validate sentence structure
  - Each sentence should have pattern: English (Tibetan)
  - Detect sentences missing Tibetan
  - Detect Tibetan text outside parentheses

- [ ] **Task 2.3.1.4**: Validate no meta-text
  - Should not contain "Translation:", "Output:", etc.
  - Should not contain AI explanations
  - Should not contain "Here is the translation"
  - Pure translation only

#### 2.3.2 Format Correction
**Location:** `server/validators/formatValidator.ts`
- [ ] **Task 2.3.2.1**: Implement automatic format fixes
  - Method `attemptFormatCorrection(translation: string): string`
  - Remove meta-text prefixes
  - Fix unbalanced parentheses if possible
  - Standardize spacing around parentheses

- [ ] **Task 2.3.2.2**: Extract translation from AI response
  - Handle cases where AI adds explanations
  - Extract just the translation portion
  - Remove markdown formatting if present

- [ ] **Task 2.3.2.3**: Apply corrections in pipeline
  - Try corrections if validation fails
  - Re-validate after correction
  - Only fail if correction doesn't help
  - **Location:** Integrate in `translationService.ts` after Phase 5

#### 2.3.3 Refined Prompt for Format Compliance
**Location:** `server/services/translation/PromptGenerator.ts`
- [ ] **Task 2.3.3.1**: Strengthen format instructions
  - Make format requirements bold and repeated
  - Add negative examples (what NOT to do)
  - **Location:** Lines 88-92 in `createStandardPrompt()`

- [ ] **Task 2.3.3.2**: Add format examples
  - Expand few-shot examples with format emphasis
  - Show correct format explicitly
  - Show incorrect format with correction

---

### 2.4 Quality Gates Implementation

#### 2.4.1 Quality Gate System
**New file:** `server/services/translation/QualityGates.ts`
- [ ] **Task 2.4.1.1**: Create `QualityGate` interface
  ```typescript
  interface QualityGate {
    name: string;
    check: (result: TranslationResult) => boolean;
    threshold: number;
    weight: number;
    failureAction: 'reject' | 'warn' | 'retry';
  }
  ```

- [ ] **Task 2.4.1.2**: Define quality gates
  - **Confidence Gate**: confidence >= 0.7 (reject if fails)
  - **Format Gate**: valid format (retry if fails)
  - **Length Gate**: reasonable length ratio (warn if fails)
  - **Preservation Gate**: Tibetan preserved (reject if fails)
  - **Agreement Gate**: model agreement >= 0.6 (warn if fails)

- [ ] **Task 2.4.1.3**: Create `QualityGateRunner` class
  - Method `runGates(result: TranslationResult): GateResults`
  - Run all gates in sequence
  - Collect results
  - Decide on action based on failures

#### 2.4.2 Gate Integration in Pipeline
**Location:** `server/services/translationService.ts`
- [ ] **Task 2.4.2.1**: Add quality gate check point
  - After Phase 6 (quality analysis)
  - Before returning result
  - **Location:** Line 186 before return statement

- [ ] **Task 2.4.2.2**: Implement rejection logic
  - If gates fail with 'reject', throw error
  - Include specific gate failure details
  - Don't save failed translations to database

- [ ] **Task 2.4.2.3**: Implement retry logic
  - If gates fail with 'retry', attempt one more translation
  - Use refined prompt emphasizing failed aspect
  - Maximum 1 retry per gate failure

- [ ] **Task 2.4.2.4**: Implement warning logic
  - If gates fail with 'warn', save warning metadata
  - Flag translation for review
  - Still return translation but with warning

#### 2.4.3 Quality Metrics Dashboard Data
**New file:** `server/services/translation/MetricsCollector.ts`
- [ ] **Task 2.4.3.1**: Create `MetricsCollector` class
  - Track gate pass/fail rates
  - Track confidence score distribution
  - Track processing times
  - Track retry rates

- [ ] **Task 2.4.3.2**: Add database table for metrics
  - **New table:** `translation_metrics`
  - Columns: timestamp, gate_name, passed, confidence, processing_time
  - **Location:** `db/schema.ts` or `db/schema.sqlite.ts`

- [ ] **Task 2.4.3.3**: Store metrics after each translation
  - **Location:** `translationService.ts` after quality gates

---

## **PHASE 3: ADVANCED FEATURES (Week 3)**

### 3.1 OCR Support for Scanned PDFs

#### 3.1.1 OCR Detection and Setup
**New file:** `client/src/lib/ocr/ocrDetector.ts`
- [ ] **Task 3.1.1.1**: Detect if PDF needs OCR
  - Extract text using current method
  - Check if text is empty or very sparse
  - Check if PDF has images (scanned pages)
  - Method `needsOCR(pdf: PDFDocumentProxy, extractedText: string): boolean`

- [ ] **Task 3.1.1.2**: Install Tesseract.js
  - Add dependency: `npm install tesseract.js`
  - Add type definitions
  - Configure for client-side usage

- [ ] **Task 3.1.1.3**: Download Tibetan language pack
  - Tesseract traineddata for Tibetan (bod)
  - Host locally or use CDN
  - Configure path in Tesseract worker

#### 3.1.2 OCR Processing Engine
**New file:** `client/src/lib/ocr/tibetanOCR.ts`
- [ ] **Task 3.1.2.1**: Create `TibetanOCR` class
  - Initialize Tesseract worker
  - Configure for Tibetan language (bod)
  - Set page segmentation mode

- [ ] **Task 3.1.2.2**: Implement page image extraction
  - Method `renderPageToImage(page: PDFPageProxy): Promise<ImageData>`
  - Render PDF page to canvas
  - Extract image data
  - Optimize image for OCR (contrast, resolution)

- [ ] **Task 3.1.2.3**: Implement OCR processing
  - Method `performOCR(imageData: ImageData): Promise<string>`
  - Run Tesseract on image
  - Extract text with confidence scores
  - Filter low-confidence results

- [ ] **Task 3.1.2.4**: Batch OCR processing
  - Method `processMultiplePages(pages: PDFPageProxy[]): Promise<string[]>`
  - Process pages in parallel (2-3 at a time)
  - Show progress to user
  - Handle OCR failures gracefully

#### 3.1.3 OCR Integration with Text Extraction
**Location:** `client/src/lib/textExtractor.ts`
- [ ] **Task 3.1.3.1**: Add OCR fallback logic
  - Try normal text extraction first
  - If insufficient text, use OCR
  - **Location:** Line 28-62 in `extractFromPDF()`

- [ ] **Task 3.1.3.2**: Hybrid extraction mode
  - Combine normal extraction with OCR
  - Use OCR for pages with sparse text
  - Use normal extraction for pages with good text
  - Create `ExtractionMethod` enum: 'native' | 'ocr' | 'hybrid'

- [ ] **Task 3.1.3.3**: Add OCR quality indicators
  - Include OCR confidence scores in metadata
  - Flag low-confidence pages
  - Add to `ExtractedContent` interface:
    ```typescript
    interface ExtractedContent {
      text: string;
      sourceFormat: string;
      extractionMethod?: 'native' | 'ocr' | 'hybrid';
      ocrConfidence?: number;
      lowQualityPages?: number[];
    }
    ```

#### 3.1.4 OCR Post-Processing
**New file:** `client/src/lib/ocr/ocrPostProcessor.ts`
- [ ] **Task 3.1.4.1**: Create `OCRPostProcessor` class
  - Fix common OCR errors in Tibetan
  - Correct misrecognized characters
  - Use character confusion matrix

- [ ] **Task 3.1.4.2**: Implement Tibetan spellcheck
  - Create dictionary of valid Tibetan words
  - Check OCR output against dictionary
  - Flag suspicious words for manual review

- [ ] **Task 3.1.4.3**: Clean OCR artifacts
  - Remove stray characters
  - Fix spacing issues
  - Normalize Unicode (use normalizer from Phase 1)

---

### 3.2 Dynamic Few-Shot Example Selection

#### 3.2.1 Example Embedding System
**New file:** `server/services/translation/ExampleSelector.ts`
- [ ] **Task 3.2.1.1**: Create comprehensive example library
  - Expand from 7 to 50-100 examples
  - Cover diverse text types:
    - Prayers and liturgy (15 examples)
    - Philosophical texts (15 examples)
    - Biographical texts (10 examples)
    - Instructional texts (10 examples)
    - Historical narratives (10 examples)
    - Letters and correspondence (10 examples)
    - General prose (20 examples)

- [ ] **Task 3.2.1.2**: Structure example database
  ```typescript
  interface TranslationExample {
    id: string;
    tibetan: string;
    english: string;
    category: string;
    subcategory?: string;
    complexity: 'simple' | 'medium' | 'complex';
    length: 'short' | 'medium' | 'long';
    embedding?: number[]; // semantic vector
    keywords?: string[]; // for quick filtering
  }
  ```
  - **Location:** `server/data/translation-examples.json`

- [ ] **Task 3.2.1.3**: Generate embeddings for all examples
  - Use embedding service from Phase 2.2.1
  - Pre-compute embeddings for all examples
  - Store embeddings in database or file
  - Create migration to add embeddings to existing examples

#### 3.2.2 Similarity-Based Example Selection
**Location:** `server/services/translation/ExampleSelector.ts`
- [ ] **Task 3.2.2.1**: Create `ExampleSelector` class
  - Load example library on initialization
  - Method `selectExamples(inputText: string, count: number): TranslationExample[]`

- [ ] **Task 3.2.2.2**: Implement embedding-based selection
  - Get embedding for input text
  - Calculate similarity with all example embeddings
  - Sort by similarity score
  - Return top N most similar examples

- [ ] **Task 3.2.2.3**: Add diversity to selection
  - Don't select all examples from same category
  - Ensure variety in example types
  - Balance similarity with diversity
  - Algorithm: Select top 3 most similar, then select diverse examples from remaining

- [ ] **Task 3.2.2.4**: Optimize for prompt size
  - Limit total token count of examples
  - Prefer shorter examples if prompt getting too long
  - Maximum 3-5 examples per prompt

#### 3.2.3 Category-Based Filtering
**Location:** `server/services/translation/ExampleSelector.ts`
- [ ] **Task 3.2.3.1**: Enhance text type detection
  - Use more sophisticated category detection
  - Check multiple indicators
  - **Enhance:** `PromptGenerator.detectTextType()` at line 240

- [ ] **Task 3.2.3.2**: Pre-filter examples by category
  - Before embedding comparison, filter by category
  - Only compare with relevant examples
  - Fallback to all categories if too few matches

- [ ] **Task 3.2.3.3**: Support custom example injection
  - Allow user to provide examples
  - Add user examples to selection pool
  - Prioritize user examples

#### 3.2.4 Integration with Prompt Generator
**Location:** `server/services/translation/PromptGenerator.ts`
- [ ] **Task 3.2.4.1**: Replace static examples with dynamic selection
  - Remove hardcoded examples from `initializeFewShotExamples()`
  - Use `ExampleSelector` instead
  - **Location:** Lines 168-206

- [ ] **Task 3.2.4.2**: Update `selectRelevantExamples()` method
  - Use embedding-based selection
  - **Location:** Lines 211-235

- [ ] **Task 3.2.4.3**: Format examples in prompt
  - Show both Tibetan and English
  - Highlight why example is relevant
  - Add brief annotation if helpful

---

### 3.3 Terminology Consistency Checking

#### 3.3.1 Term Extraction from Translations
**New file:** `server/services/translation/TermExtractor.ts`
- [ ] **Task 3.3.1.1**: Create `TermExtractor` class
  - Method `extractTermPairs(translation: string): TermPair[]`
  - Extract Tibetan-English pairs from format: "English (Tibetan)"
  - Parse parenthetical Tibetan text
  - Match with preceding English phrase

- [ ] **Task 3.3.1.2**: Implement term pair parser
  ```typescript
  interface TermPair {
    tibetan: string;
    english: string;
    context: string; // surrounding text
    pageNumber: number;
    confidence: number;
  }
  ```
  - Use regex to find pattern: `([^()]+)\s*\(([^\)]*[\u0F00-\u0FFF][^\)]*)\)`
  - Clean extracted terms
  - Normalize Unicode

- [ ] **Task 3.3.1.3**: Filter out non-term pairs
  - Exclude full sentences (too long)
  - Exclude single common words (not interesting)
  - Focus on key terms (2-10 words)
  - Calculate term importance score

#### 3.3.2 Document Glossary Builder
**New file:** `server/services/translation/GlossaryBuilder.ts`
- [ ] **Task 3.3.2.1**: Create `GlossaryBuilder` class
  - Collect terms across entire document
  - Build document-specific glossary
  - Track all translations for each Tibetan term

- [ ] **Task 3.3.2.2**: Implement term aggregation
  - Method `addTermPairs(pairs: TermPair[]): void`
  - Group by Tibetan term
  - Track all English translations used
  - Count occurrences

- [ ] **Task 3.3.2.3**: Detect inconsistencies
  - Method `findInconsistencies(): Inconsistency[]`
  - Identify terms translated multiple ways
  - Calculate consistency score
  - Flag significant variations
  ```typescript
  interface Inconsistency {
    tibetan: string;
    translations: { english: string; count: number; pages: number[] }[];
    severity: 'high' | 'medium' | 'low';
  }
  ```

- [ ] **Task 3.3.2.4**: Suggest canonical translations
  - Use most frequent translation as canonical
  - Check against dictionary
  - Method `getCanonicalTranslation(tibetan: string): string`

#### 3.3.3 Consistency Validation
**New file:** `server/services/translation/ConsistencyValidator.ts`
- [ ] **Task 3.3.3.1**: Create `ConsistencyValidator` class
  - Method `validateConsistency(glossary: Glossary): ValidationResult`
  - Calculate document consistency score
  - Flag pages with inconsistencies

- [ ] **Task 3.3.3.2**: Real-time consistency checking
  - Check each page translation against glossary
  - Warn if new translation differs from established
  - Suggest canonical translation

- [ ] **Task 3.3.3.3**: Glossary-guided translation
  - Include glossary in translation prompt
  - Instruct AI to use consistent terminology
  - Update prompt generator to include document glossary

#### 3.3.4 Integration with Translation Pipeline
**Location:** `server/services/translationService.ts`
- [ ] **Task 3.3.4.1**: Add glossary to translation context
  - Build glossary from previously translated pages
  - Pass to prompt generator
  - **Location:** Add before Phase 1 (line 82)

- [ ] **Task 3.3.4.2**: Extract and update glossary after each page
  - Extract terms from new translation
  - Update document glossary
  - Check consistency
  - **Location:** Add after Phase 5 (line 163)

- [ ] **Task 3.3.4.3**: Store glossary in database
  - Add `glossaries` table
  - Link to translation jobs
  - Allow retrieval for future translations of same text

---

### 3.4 Automated Test Suite

#### 3.4.1 Test Infrastructure Setup
**New files:** `tests/` directory structure
- [ ] **Task 3.4.1.1**: Install testing dependencies
  ```bash
  npm install --save-dev vitest @vitest/ui @testing-library/react @testing-library/jest-dom
  ```

- [ ] **Task 3.4.1.2**: Create test configuration
  - **New file:** `vitest.config.ts`
  - Configure for TypeScript
  - Set up path aliases
  - Configure test environment

- [ ] **Task 3.4.1.3**: Set up test directory structure
  ```
  tests/
    unit/
      lib/
      services/
      validators/
    integration/
    e2e/
    fixtures/
      sample-texts.json
      golden-translations.json
  ```

#### 3.4.2 Unit Tests - Text Processing
**New file:** `tests/unit/lib/textExtractor.test.ts`
- [ ] **Task 3.4.2.1**: Test Tibetan syllable detection
  - Test with valid Tibetan text
  - Test with mixed Tibetan-English
  - Test with corrupted Unicode

- [ ] **Task 3.4.2.2**: Test positional text reconstruction
  - Mock PDF.js textContent items
  - Test multi-column layouts
  - Test proper spacing

- [ ] **Task 3.4.2.3**: Test artifact removal
  - Test header/footer detection
  - Test page number removal

**New file:** `tests/unit/lib/textChunker.test.ts`
- [ ] **Task 3.4.2.4**: Test semantic chunking
  - Test sentence boundary detection
  - Test token limit enforcement
  - Test context overlap

- [ ] **Task 3.4.2.5**: Test chunk size constraints
  - Verify no chunk exceeds max tokens
  - Verify reasonable chunk sizes

#### 3.4.3 Unit Tests - Validation
**New file:** `tests/unit/validators/inputValidator.test.ts`
- [ ] **Task 3.4.3.1**: Test input validation
  - Test Tibetan text detection
  - Test minimum length
  - Test Unicode validation

**New file:** `tests/unit/validators/outputValidator.test.ts`
- [ ] **Task 3.4.3.2**: Test output validation
  - Test format compliance
  - Test Tibetan preservation
  - Test error detection

**New file:** `tests/unit/validators/formatValidator.test.ts`
- [ ] **Task 3.4.3.3**: Test format validation
  - Test parentheses balancing
  - Test meta-text detection
  - Test format correction

#### 3.4.4 Unit Tests - Translation Services
**New file:** `tests/unit/services/confidence.test.ts`
- [ ] **Task 3.4.4.1**: Test confidence calculations
  - Test enhanced confidence with known inputs
  - Test model agreement calculation
  - Test semantic similarity

**New file:** `tests/unit/services/qualityScorer.test.ts`
- [ ] **Task 3.4.4.2**: Test quality scoring
  - Mock translation results
  - Verify score calculation
  - Test quality thresholds

#### 3.4.5 Integration Tests
**New file:** `tests/integration/translation-pipeline.test.ts`
- [ ] **Task 3.4.5.1**: Test full translation pipeline
  - Use real sample Tibetan text (short)
  - Call translation service
  - Verify output format
  - Check quality scores
  - Mock API calls to avoid charges

- [ ] **Task 3.4.5.2**: Test error handling
  - Test with invalid input
  - Test with API failures
  - Test with timeout scenarios

**New file:** `tests/integration/api-endpoints.test.ts`
- [ ] **Task 3.4.5.3**: Test API endpoints
  - Test POST /api/translate
  - Test GET /api/translations/:id
  - Test POST /api/batch/translate
  - Mock database operations

#### 3.4.6 Golden Dataset Tests
**New file:** `tests/fixtures/golden-translations.json`
- [ ] **Task 3.4.6.1**: Create golden dataset
  - 20-30 manually verified translations
  - Various text types
  - Range of complexity
  - Include original Tibetan, expected English

**New file:** `tests/regression/golden-dataset.test.ts`
- [ ] **Task 3.4.6.2**: Implement golden dataset tests
  - Translate each golden example
  - Compare with expected output
  - Allow for minor variations
  - Use semantic similarity for comparison (not exact match)

- [ ] **Task 3.4.6.3**: Calculate quality metrics
  - Calculate average confidence
  - Calculate average quality score
  - Track regression over time

#### 3.4.7 Test Automation
**New file:** `.github/workflows/test.yml` (if using GitHub)
- [ ] **Task 3.4.7.1**: Set up CI/CD pipeline
  - Run tests on every commit
  - Run tests on pull requests
  - Generate test coverage reports

- [ ] **Task 3.4.7.2**: Add npm scripts
  ```json
  {
    "scripts": {
      "test": "vitest",
      "test:ui": "vitest --ui",
      "test:coverage": "vitest --coverage",
      "test:unit": "vitest tests/unit",
      "test:integration": "vitest tests/integration"
    }
  }
  ```

---

## **PHASE 4: PRODUCTION HARDENING (Week 4)**

### 4.1 Comprehensive Error Recovery

#### 4.1.1 Error Classification System
**New file:** `server/errors/ErrorClassifier.ts`
- [ ] **Task 4.1.1.1**: Define error types
  ```typescript
  enum ErrorType {
    // Transient errors (retry)
    RATE_LIMIT = 'RATE_LIMIT',
    NETWORK_ERROR = 'NETWORK_ERROR',
    TIMEOUT = 'TIMEOUT',
    API_UNAVAILABLE = 'API_UNAVAILABLE',

    // Validation errors (fix input)
    INVALID_INPUT = 'INVALID_INPUT',
    INVALID_FORMAT = 'INVALID_FORMAT',
    EMPTY_TEXT = 'EMPTY_TEXT',

    // Processing errors (fallback strategy)
    TRANSLATION_FAILED = 'TRANSLATION_FAILED',
    QUALITY_TOO_LOW = 'QUALITY_TOO_LOW',

    // Fatal errors (fail fast)
    INVALID_API_KEY = 'INVALID_API_KEY',
    UNSUPPORTED_FILE = 'UNSUPPORTED_FILE',
    DATABASE_ERROR = 'DATABASE_ERROR'
  }
  ```

- [ ] **Task 4.1.1.2**: Create error classifier
  - Method `classifyError(error: Error): ErrorType`
  - Parse error messages
  - Check HTTP status codes
  - Determine error category

- [ ] **Task 4.1.1.3**: Define recovery strategies
  ```typescript
  interface RecoveryStrategy {
    errorType: ErrorType;
    maxRetries: number;
    backoffMultiplier: number;
    fallbackAction?: () => Promise<any>;
  }
  ```

#### 4.1.2 Retry Logic with Exponential Backoff
**New file:** `server/services/translation/RetryHandler.ts`
- [ ] **Task 4.1.2.1**: Create `RetryHandler` class
  - Method `executeWithRetry<T>(fn: () => Promise<T>, options: RetryOptions): Promise<T>`
  - Implement exponential backoff
  - Track retry attempts
  - Log retry events

- [ ] **Task 4.1.2.2**: Implement backoff algorithm
  - Base delay: 1 second
  - Multiplier: 2x
  - Max delay: 60 seconds
  - Add jitter to prevent thundering herd

- [ ] **Task 4.1.2.3**: Add circuit breaker pattern
  - Stop retrying after consecutive failures
  - Enter "open" state (fail fast)
  - Attempt recovery after cool-down period

#### 4.1.3 Fallback Strategies
**New file:** `server/services/translation/FallbackStrategies.ts`
- [ ] **Task 4.1.3.1**: Simpler prompt fallback
  - If complex prompt fails, try simpler version
  - Remove chain-of-thought
  - Remove examples
  - Use basic prompt

- [ ] **Task 4.1.3.2**: Model fallback
  - If primary model fails, try alternative
  - Fallback order: Gemini Flash → GPT-4 → Claude
  - Track which model succeeded

- [ ] **Task 4.1.3.3**: Chunking fallback
  - If large chunk fails, split into smaller chunks
  - Translate each separately
  - Combine results

- [ ] **Task 4.1.3.4**: Manual intervention fallback
  - If all automatic methods fail, flag for manual translation
  - Save partial progress
  - Allow human to complete

#### 4.1.4 Partial Success Handling
**Location:** `server/controllers/batchController.ts`
- [ ] **Task 4.1.4.1**: Save successful pages even if some fail
  - Don't rollback entire batch on single failure
  - Mark failed pages separately
  - Allow retry of failed pages only

- [ ] **Task 4.1.4.2**: Implement checkpointing
  - Save progress after each page
  - Allow resuming from checkpoint
  - Store checkpoint in database

- [ ] **Task 4.1.4.3**: Add progress recovery
  - If batch job crashes, detect incomplete jobs
  - Allow resuming incomplete jobs
  - Don't re-translate successful pages

#### 4.1.5 Integration with Translation Pipeline
**Location:** `server/services/translationService.ts`
- [ ] **Task 4.1.5.1**: Wrap Gemini calls with retry logic
  - Add retry to `performInitialTranslation()`
  - **Location:** Line 83-88

- [ ] **Task 4.1.5.2**: Add error classification
  - Catch all errors
  - Classify error type
  - Apply appropriate recovery strategy
  - **Location:** Line 197-205 in catch block

- [ ] **Task 4.1.5.3**: Implement fallback cascade
  - Try recovery strategies in order
  - Log each attempt
  - Only fail after all strategies exhausted

---

### 4.2 Monitoring and Metrics

#### 4.2.1 Metrics Collection System
**New file:** `server/services/monitoring/MetricsCollector.ts`
- [ ] **Task 4.2.1.1**: Define metrics to track
  ```typescript
  interface TranslationMetrics {
    // Performance metrics
    processingTimeMs: number;
    tokensProcessed: number;
    apiLatencyMs: number;

    // Quality metrics
    confidenceScore: number;
    qualityScore: number;
    modelAgreement: number;

    // Usage metrics
    modelUsed: string;
    iterationsUsed: number;
    retriesNeeded: number;

    // Business metrics
    pageNumber: number;
    documentId: string;
    timestamp: Date;

    // Error metrics
    errorType?: string;
    errorMessage?: string;
  }
  ```

- [ ] **Task 4.2.1.2**: Create MetricsCollector class
  - Method `recordMetric(metric: TranslationMetrics): void`
  - Buffer metrics in memory
  - Flush to database periodically
  - Handle high-volume metric collection

- [ ] **Task 4.2.1.3**: Add metrics to database
  - Create `translation_metrics` table
  - Optimize for time-series queries
  - Add indexes on timestamp, documentId
  - **Location:** `db/schema.ts` or `db/schema.sqlite.ts`

#### 4.2.2 Performance Monitoring
**New file:** `server/services/monitoring/PerformanceMonitor.ts`
- [ ] **Task 4.2.2.1**: Add timing instrumentation
  - Track time for each pipeline phase
  - Track API call latency
  - Track database query time
  - Use `performance.now()` for precise timing

- [ ] **Task 4.2.2.2**: Create performance report
  - Method `generatePerformanceReport(): PerformanceReport`
  - Average processing time per page
  - P50, P95, P99 latencies
  - Bottleneck identification

- [ ] **Task 4.2.2.3**: Add performance alerts
  - Alert if average time > threshold
  - Alert if API latency spike
  - Alert if queue backlog growing

#### 4.2.3 Quality Monitoring
**New file:** `server/services/monitoring/QualityMonitor.ts`
- [ ] **Task 4.2.3.1**: Track quality trends
  - Average confidence scores over time
  - Quality gate failure rates
  - Model agreement trends

- [ ] **Task 4.2.3.2**: Detect quality degradation
  - Alert if confidence drops below baseline
  - Alert if failure rate increases
  - Compare with historical averages

- [ ] **Task 4.2.3.3**: Track quality by document type
  - Segment metrics by text category
  - Identify which types perform best/worst

#### 4.2.4 Error Rate Monitoring
**New file:** `server/services/monitoring/ErrorMonitor.ts`
- [ ] **Task 4.2.4.1**: Track error rates
  - Count errors by type
  - Calculate error percentage
  - Track retry success rate

- [ ] **Task 4.2.4.2**: Alert on error spikes
  - Alert if error rate > 10%
  - Alert if specific error type recurring
  - Alert on API key issues

- [ ] **Task 4.2.4.3**: Create error dashboard
  - Show recent errors
  - Group by error type
  - Show error trends

#### 4.2.5 Logging Infrastructure
**Location:** `server/middleware/requestLogger.ts` (enhance existing)
- [ ] **Task 4.2.5.1**: Structured logging
  - Use JSON log format
  - Include correlation IDs
  - Add log levels: DEBUG, INFO, WARN, ERROR

- [ ] **Task 4.2.5.2**: Add request tracing
  - Trace requests end-to-end
  - Log all pipeline phases
  - Include timing information

- [ ] **Task 4.2.5.3**: Log aggregation
  - Consider log management tool (if deploying)
  - Retain logs for analysis
  - Search and filter logs

#### 4.2.6 Monitoring Dashboard API
**New file:** `server/routes/monitoring.ts`
- [ ] **Task 4.2.6.1**: Create monitoring endpoints
  - `GET /api/monitoring/metrics` - current metrics
  - `GET /api/monitoring/performance` - performance stats
  - `GET /api/monitoring/quality` - quality trends
  - `GET /api/monitoring/errors` - error summary
  - `GET /api/monitoring/health` - health check

- [ ] **Task 4.2.6.2**: Add metrics aggregation
  - Query metrics by time range
  - Aggregate by hour, day, week
  - Calculate statistics

---

### 4.3 Regression Testing

#### 4.3.1 Regression Test Framework
**New file:** `tests/regression/RegressionTester.ts`
- [ ] **Task 4.3.1.1**: Create regression test manager
  - Store baseline translations
  - Compare new translations with baseline
  - Calculate regression score

- [ ] **Task 4.3.1.2**: Define regression criteria
  - Confidence score change > 0.1
  - Quality score change > 0.15
  - Format violations
  - Terminology inconsistencies

- [ ] **Task 4.3.1.3**: Implement comparison logic
  - Use semantic similarity for translation comparison
  - Don't require exact match
  - Flag significant differences
  - Method `compareWithBaseline(current: Translation, baseline: Translation): RegressionResult`

#### 4.3.2 Golden Dataset Management
**Location:** `tests/fixtures/golden-translations.json` (expand from 3.4.6)
- [ ] **Task 4.3.2.1**: Expand golden dataset to 50 examples
  - Cover all text types
  - Include edge cases
  - Include known difficult passages

- [ ] **Task 4.3.2.2**: Version baseline translations
  - Store translation outputs for each version
  - Track improvements over time
  - Detect when changes cause regressions

- [ ] **Task 4.3.2.3**: Add golden dataset validation
  - Validate all golden examples periodically
  - Update baselines when improvements made
  - Require approval for baseline changes

#### 4.3.3 Regression Detection
**New file:** `tests/regression/RegressionDetector.ts`
- [ ] **Task 4.3.3.1**: Automated regression checks
  - Run on every deployment
  - Compare with previous version
  - Generate regression report

- [ ] **Task 4.3.3.2**: Regression scoring
  - Calculate overall regression score
  - Weight by importance (critical terms weighted higher)
  - Set pass/fail threshold

- [ ] **Task 4.3.3.3**: Regression alerts
  - Alert if regression detected
  - Block deployment if critical regression
  - Require manual review

#### 4.3.4 Version Comparison Tool
**New file:** `tests/regression/VersionComparer.ts`
- [ ] **Task 4.3.4.1**: Compare two versions
  - Method `compareVersions(v1: string, v2: string): ComparisonReport`
  - Run both versions on golden dataset
  - Generate side-by-side comparison
  - Highlight differences

- [ ] **Task 4.3.4.2**: Visualization of differences
  - Show where translations differ
  - Color-code improvements (green) vs. regressions (red)
  - Generate HTML report

---

### 4.4 Human Review Workflow

#### 4.4.1 Review Queue System
**New file:** `server/services/review/ReviewQueue.ts`
- [ ] **Task 4.4.1.1**: Define review criteria
  - Low confidence (< 0.7)
  - Quality gate failures
  - Inconsistent terminology
  - User-flagged translations

- [ ] **Task 4.4.1.2**: Create review queue
  - Add translations needing review to queue
  - Prioritize by severity
  - Track review status
  ```typescript
  interface ReviewItem {
    id: string;
    translationId: string;
    reason: string;
    severity: 'high' | 'medium' | 'low';
    status: 'pending' | 'in_review' | 'approved' | 'rejected';
    assignedTo?: string;
    createdAt: Date;
  }
  ```

- [ ] **Task 4.4.1.3**: Add database table for review queue
  - **New table:** `review_queue`
  - **Location:** `db/schema.ts` or `db/schema.sqlite.ts`

#### 4.4.2 Review Interface API
**New file:** `server/routes/review.ts`
- [ ] **Task 4.4.2.1**: Create review endpoints
  - `GET /api/review/queue` - get pending reviews
  - `GET /api/review/:id` - get specific review item
  - `POST /api/review/:id/approve` - approve translation
  - `POST /api/review/:id/reject` - reject translation
  - `PUT /api/review/:id/correct` - submit corrected translation

- [ ] **Task 4.4.2.2**: Add review assignment
  - Assign reviews to human reviewers
  - Track who reviewed what
  - Prevent multiple reviewers on same item

#### 4.4.3 Correction Feedback Loop
**New file:** `server/services/review/FeedbackProcessor.ts`
- [ ] **Task 4.4.3.1**: Collect human corrections
  - Store original translation
  - Store corrected translation
  - Store reason for correction
  - **New table:** `translation_corrections`

- [ ] **Task 4.4.3.2**: Analyze correction patterns
  - Identify common mistakes
  - Identify problematic terms
  - Identify weak text types

- [ ] **Task 4.4.3.3**: Learn from corrections
  - Add corrected terms to dictionary
  - Add corrected examples to few-shot library
  - Adjust confidence calculation based on patterns
  - Update quality thresholds

#### 4.4.4 Correction-Based Dictionary Updates
**Location:** `server/dictionary.ts`
- [ ] **Task 4.4.4.1**: Extract terms from corrections
  - Find terms that were corrected
  - Extract Tibetan-English pairs
  - Add to dictionary automatically

- [ ] **Task 4.4.4.2**: Suggest dictionary additions
  - Method `suggestDictionaryAdditions(): DictionaryEntry[]`
  - Based on frequency of corrections
  - Require approval before adding

- [ ] **Task 4.4.4.3**: Dictionary maintenance
  - Mark entries as "learned from corrections"
  - Track confidence in dictionary entries
  - Periodically review auto-added entries

#### 4.4.5 Review Analytics
**New file:** `server/services/review/ReviewAnalytics.ts`
- [ ] **Task 4.4.5.1**: Track review metrics
  - Review turnaround time
  - Approval vs. rejection rate
  - Common correction types
  - Reviewer performance

- [ ] **Task 4.4.5.2**: Identify improvement areas
  - Which text types need most corrections?
  - Which terms are most problematic?
  - Which quality gates are most accurate?

- [ ] **Task 4.4.5.3**: Generate review reports
  - Weekly review summary
  - Quality improvement trends
  - Dictionary growth from reviews

---

## **PHASE 5: INTEGRATION AND DEPLOYMENT (Optional - Week 5)**

### 5.1 Docker Configuration
- [ ] **Task 5.1.1**: Create Dockerfile
- [ ] **Task 5.1.2**: Create docker-compose.yml
- [ ] **Task 5.1.3**: Configure environment variables
- [ ] **Task 5.1.4**: Set up PostgreSQL container

### 5.2 VPS Deployment
- [ ] **Task 5.2.1**: Provision Hetzner VPS
- [ ] **Task 5.2.2**: Install Docker and dependencies
- [ ] **Task 5.2.3**: Configure nginx reverse proxy
- [ ] **Task 5.2.4**: Set up SSL certificates
- [ ] **Task 5.2.5**: Configure firewall

### 5.3 n8n Integration
- [ ] **Task 5.3.1**: Set up n8n workflows
- [ ] **Task 5.3.2**: Configure scheduled jobs
- [ ] **Task 5.3.3**: Test automation pipeline
- [ ] **Task 5.3.4**: Set up error notifications

---

## Summary by Phase

### Phase 1 (Week 1): 44 tasks
Critical infrastructure fixes for reliable text extraction and processing.

### Phase 2 (Week 2): 38 tasks
Quality improvements for more accurate translations.

### Phase 3 (Week 3): 52 tasks
Advanced features for handling complex scenarios.

### Phase 4 (Week 4): 45 tasks
Production-ready error handling, monitoring, and review systems.

### **Total: 179 granular tasks**

---

## Priority Indicators

🔴 **Critical** - Must have, blocks other work
🟡 **Important** - Significant impact, should complete
🟢 **Nice to have** - Valuable but can defer

Most tasks in Phase 1 are 🔴 Critical
Most tasks in Phase 2 are 🟡 Important
Tasks in Phase 3 are mix of 🟡 Important and 🟢 Nice to have
Tasks in Phase 4 are 🟡 Important for production

---

## Notes

- Each task is designed to be completed in 30 minutes to 3 hours
- Tasks are ordered within each phase for logical progression
- File paths are specified where code changes needed
- Line numbers provided where existing code should be modified
- Dependencies between tasks are clear from ordering
- Can parallelize tasks within same section if independent
