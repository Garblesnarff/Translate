# Tibetan Translation Tool - Implementation Plan V2

## Overview

This is a **complete reimplementation plan** based on lessons learned from V1. This approach prioritizes:
- **Foundation first** - Architecture, interfaces, and infrastructure
- **TDD methodology** - Tests before implementation
- **Simplicity** - Fewer, more focused services
- **Performance** - Caching, batching, parallel operations
- **Maintainability** - Clear structure, minimal duplication

---

## Timeline

| Phase | Duration | Focus | Tasks |
|-------|----------|-------|-------|
| **Phase 0** | 3 days | Foundation & Infrastructure | 25 |
| **Phase 1** | 5 days | Core Translation Engine | 35 |
| **Phase 2** | 5 days | Quality & Validation | 30 |
| **Phase 3** | 4 days | Advanced Features | 25 |
| **Phase 4** | 3 days | Production Hardening | 20 |
| **TOTAL** | **20 days** | **All Phases** | **135 tasks** |

**44 fewer tasks than V1 (179 → 135) due to better architecture!**

---

## PHASE 0: FOUNDATION & INFRASTRUCTURE (3 days, 25 tasks)

### 0.1 Project Architecture & Design (8 tasks)

#### 0.1.1 Core Abstractions & Interfaces
**Goal:** Define all interfaces before any implementation
**File:** `server/core/interfaces.ts`

- [ ] **Task 0.1.1.1**: Define `EmbeddingProvider` interface
  ```typescript
  interface EmbeddingProvider {
    getEmbedding(text: string): Promise<number[]>;
    getBatchEmbeddings(texts: string[]): Promise<number[][]>;
    dimension: number;
  }
  ```

- [ ] **Task 0.1.1.2**: Define `TranslationProvider` interface
  ```typescript
  interface TranslationProvider {
    translate(text: string, prompt: string): Promise<TranslationResult>;
    translateBatch(texts: string[], prompt: string): Promise<TranslationResult[]>;
    supportsStreaming: boolean;
  }
  ```

- [ ] **Task 0.1.1.3**: Define `CacheProvider` interface
  ```typescript
  interface CacheProvider {
    get<T>(key: string): Promise<T | null>;
    set<T>(key: string, value: T, ttl?: number): Promise<void>;
    delete(key: string): Promise<void>;
    clear(): Promise<void>;
  }
  ```

- [ ] **Task 0.1.1.4**: Define `StorageProvider` interface
  ```typescript
  interface StorageProvider {
    save(collection: string, data: any): Promise<string>;
    load(collection: string, id: string): Promise<any>;
    query(collection: string, filter: any): Promise<any[]>;
  }
  ```

#### 0.1.2 Type System Foundation
**File:** `shared/types.ts` (shared between client & server)

- [ ] **Task 0.1.2.1**: Define core domain types
  ```typescript
  // Translation domain
  interface TranslationRequest { text: string; options?: TranslationOptions }
  interface TranslationResult { translation: string; confidence: number; metadata: Metadata }
  interface TranslationOptions { maxTokens?: number; temperature?: number; model?: string }

  // Text processing domain
  interface TextChunk { id: string; text: string; pageNumber: number; tokenCount: number }
  interface ProcessedText { chunks: TextChunk[]; metadata: ExtractionMetadata }

  // Quality domain
  interface QualityScore { overall: number; confidence: number; format: number; preservation: number }
  interface ValidationResult { isValid: boolean; errors: string[]; warnings: string[] }
  ```

- [ ] **Task 0.1.2.2**: Define configuration types
  ```typescript
  interface TranslationConfig {
    models: ModelConfig[];
    quality: QualityConfig;
    retry: RetryConfig;
    cache: CacheConfig;
  }

  interface ModelConfig {
    provider: 'gemini' | 'openai' | 'anthropic';
    model: string;
    apiKey: string;
    priority: number;  // For fallback order
  }
  ```

- [ ] **Task 0.1.2.3**: Define error types
  ```typescript
  enum ErrorCode {
    VALIDATION_ERROR = 'VALIDATION_ERROR',
    RATE_LIMIT = 'RATE_LIMIT',
    NETWORK_ERROR = 'NETWORK_ERROR',
    TRANSLATION_FAILED = 'TRANSLATION_FAILED',
    // ... etc
  }

  class TranslationError extends Error {
    constructor(public code: ErrorCode, message: string, public cause?: Error) {}
  }
  ```

- [ ] **Task 0.1.2.4**: Export all types with comprehensive JSDoc
  - Document each type with examples
  - Add validation constraints as comments
  - Link related types

#### 0.1.3 Architecture Documentation
**File:** `docs/architecture/`

- [ ] **Task 0.1.3.1**: Create system architecture diagram
  - Data flow diagram
  - Service boundaries
  - Integration points
  - Export as PNG and Mermaid diagram

- [ ] **Task 0.1.3.2**: Document design decisions
  - File: `docs/architecture/ADR.md` (Architecture Decision Records)
  - Why provider interfaces?
  - Why centralized config?
  - Why TDD approach?
  - Trade-offs made

---

### 0.2 Configuration System (5 tasks)

#### 0.2.1 Unified Configuration
**File:** `server/core/config.ts`

- [ ] **Task 0.2.1.1**: Create `ConfigService` class
  ```typescript
  class ConfigService {
    private config: TranslationConfig;

    static load(env: NodeJS.ProcessEnv): ConfigService;
    static loadFromFile(path: string): ConfigService;

    get translation(): TranslationConfig;
    get database(): DatabaseConfig;
    get cache(): CacheConfig;
    get monitoring(): MonitoringConfig;

    validate(): ValidationResult;
  }
  ```

- [ ] **Task 0.2.1.2**: Create config validation with Zod
  ```typescript
  const configSchema = z.object({
    translation: z.object({
      maxTokens: z.number().min(100).max(10000),
      qualityThreshold: z.number().min(0).max(1),
      // ... etc
    }),
    // ... other sections
  });
  ```

- [ ] **Task 0.2.1.3**: Create default configuration
  - File: `config/defaults.json`
  - Sensible defaults for all settings
  - Comments explaining each setting

- [ ] **Task 0.2.1.4**: Create environment-specific configs
  - `config/development.json`
  - `config/production.json`
  - `config/test.json`

- [ ] **Task 0.2.1.5**: Add config hot-reloading
  ```typescript
  configService.watch((newConfig) => {
    // Update services without restart
  });
  ```

---

### 0.3 Database Layer (4 tasks)

#### 0.3.1 Database Schema (Optimized)
**File:** `db/schema-v2.ts`

- [ ] **Task 0.3.1.1**: Design normalized dictionary schema
  ```sql
  CREATE TABLE dictionary_entries (
    id UUID PRIMARY KEY,
    tibetan TEXT NOT NULL,
    english TEXT NOT NULL,
    wylie TEXT,
    sanskrit TEXT,
    category TEXT NOT NULL,
    frequency TEXT NOT NULL,
    context TEXT,
    alternate_translations TEXT[],
    created_at TIMESTAMP,
    updated_at TIMESTAMP,
    INDEX idx_tibetan (tibetan),
    INDEX idx_category_frequency (category, frequency)
  );
  ```

- [ ] **Task 0.3.1.2**: Design translation results schema
  ```sql
  CREATE TABLE translations (
    id UUID PRIMARY KEY,
    source_text_hash TEXT NOT NULL,  -- For deduplication
    source_text TEXT NOT NULL,
    translation TEXT NOT NULL,
    confidence FLOAT NOT NULL,
    quality_score JSONB,
    metadata JSONB,
    cached BOOLEAN DEFAULT false,
    created_at TIMESTAMP,
    INDEX idx_hash (source_text_hash),
    INDEX idx_created (created_at DESC)
  );
  ```

- [ ] **Task 0.3.1.3**: Design metrics schema (time-series optimized)
  ```sql
  CREATE TABLE metrics (
    timestamp TIMESTAMPTZ NOT NULL,
    metric_name TEXT NOT NULL,
    value FLOAT NOT NULL,
    tags JSONB,
    PRIMARY KEY (timestamp, metric_name)
  );

  -- Use TimescaleDB or partition by month
  SELECT create_hypertable('metrics', 'timestamp');
  ```

- [ ] **Task 0.3.1.4**: Create database migration system
  ```typescript
  // migrations/001_initial_schema.ts
  export async function up(db: Database) {
    await db.schema.createTable('dictionary_entries')...
  }

  export async function down(db: Database) {
    await db.schema.dropTable('dictionary_entries');
  }
  ```

#### 0.3.2 Database Connection & Pooling
**File:** `server/core/database.ts`

- [ ] **Task 0.3.2.1**: Create `DatabaseService` with connection pooling
  ```typescript
  class DatabaseService {
    private pool: Pool;

    constructor(config: DatabaseConfig) {
      this.pool = new Pool({
        max: config.maxConnections || 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000,
      });
    }

    async query<T>(sql: string, params?: any[]): Promise<T[]>;
    async transaction<T>(fn: (tx: Transaction) => Promise<T>): Promise<T>;
  }
  ```

---

### 0.4 Caching Infrastructure (4 tasks)

#### 0.4.1 Multi-Layer Cache
**File:** `server/core/cache/`

- [ ] **Task 0.4.1.1**: Create in-memory cache (L1)
  ```typescript
  // cache/MemoryCache.ts
  class MemoryCache implements CacheProvider {
    private cache: Map<string, CacheEntry>;
    private maxSize: number;

    constructor(maxSize: number = 1000) {
      this.cache = new Map();
      this.maxSize = maxSize;
    }

    // LRU eviction when maxSize exceeded
    get<T>(key: string): Promise<T | null>;
    set<T>(key: string, value: T, ttl?: number): Promise<void>;
  }
  ```

- [ ] **Task 0.4.1.2**: Create Redis cache (L2)
  ```typescript
  // cache/RedisCache.ts
  class RedisCache implements CacheProvider {
    private client: RedisClient;

    async get<T>(key: string): Promise<T | null>;
    async set<T>(key: string, value: T, ttl?: number): Promise<void>;
    async clear(): Promise<void>;
  }
  ```

- [ ] **Task 0.4.1.3**: Create multi-layer cache coordinator
  ```typescript
  // cache/CacheService.ts
  class CacheService implements CacheProvider {
    constructor(
      private l1: MemoryCache,
      private l2: RedisCache
    ) {}

    async get<T>(key: string): Promise<T | null> {
      // Check L1 first, then L2, populate L1 on L2 hit
      let value = await this.l1.get<T>(key);
      if (value) return value;

      value = await this.l2.get<T>(key);
      if (value) await this.l1.set(key, value);

      return value;
    }
  }
  ```

- [ ] **Task 0.4.1.4**: Add cache key utilities
  ```typescript
  // cache/keys.ts
  export const CacheKeys = {
    translation: (textHash: string) => `trans:${textHash}`,
    embedding: (textHash: string) => `embed:${textHash}`,
    dictionary: (tibetan: string) => `dict:${tibetan}`,
    example: (exampleId: string) => `ex:${exampleId}`,
  };

  export function hashText(text: string): string {
    return createHash('sha256').update(text).digest('hex');
  }
  ```

---

### 0.5 Test Infrastructure (4 tasks)

#### 0.5.1 Test Utilities & Fixtures
**File:** `tests/utils/`

- [ ] **Task 0.5.1.1**: Create mock providers
  ```typescript
  // utils/mocks.ts
  export class MockEmbeddingProvider implements EmbeddingProvider {
    dimension = 768;
    async getEmbedding(text: string): Promise<number[]> {
      // Return deterministic fake embedding
      return Array(768).fill(0).map((_, i) => Math.sin(i * text.length));
    }
  }

  export class MockTranslationProvider implements TranslationProvider {
    async translate(text: string): Promise<TranslationResult> {
      return {
        translation: `Mocked translation of: ${text}`,
        confidence: 0.85,
        metadata: {}
      };
    }
  }
  ```

- [ ] **Task 0.5.1.2**: Create test fixtures
  ```typescript
  // utils/fixtures.ts
  export const TestData = {
    tibetan: {
      simple: 'བཀྲ་ཤིས་བདེ་ལེགས།',
      paragraph: '...',
      multiPage: '...',
      withSanskrit: '...',
    },

    translations: {
      valid: 'Greetings (བཀྲ་ཤིས་བདེ་ལེགས།).',
      missingTibetan: 'Greetings.',
      wrongFormat: 'Translation: Greetings བཀྲ་ཤིས་བདེ་ལེགས།',
    },

    pdfs: {
      digital: './fixtures/digital-text.pdf',
      scanned: './fixtures/scanned-image.pdf',
      multiColumn: './fixtures/two-column.pdf',
    }
  };
  ```

- [ ] **Task 0.5.1.3**: Create test database utilities
  ```typescript
  // utils/testDatabase.ts
  export async function setupTestDb(): Promise<DatabaseService> {
    const db = new DatabaseService(testConfig);
    await db.migrate();
    await db.seed(TestData);
    return db;
  }

  export async function cleanupTestDb(db: DatabaseService) {
    await db.query('TRUNCATE TABLE translations, dictionary_entries');
    await db.close();
  }
  ```

- [ ] **Task 0.5.1.4**: Create assertion helpers
  ```typescript
  // utils/assertions.ts
  export function assertValidTranslation(result: TranslationResult) {
    expect(result.translation).toBeDefined();
    expect(result.confidence).toBeGreaterThan(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
    // Format check
    expect(result.translation).toMatch(/.*\([\u0F00-\u0FFF]+.*\)/);
  }

  export function assertValidTibetan(text: string) {
    const tibetanPercent = calculateTibetanPercentage(text);
    expect(tibetanPercent).toBeGreaterThan(50);
  }
  ```

---

## PHASE 1: CORE TRANSLATION ENGINE (5 days, 35 tasks)

### 1.1 Provider Implementations (8 tasks)

#### 1.1.1 Embedding Providers (TDD)
**File:** `server/providers/embeddings/`

- [ ] **Task 1.1.1.1**: Write tests for EmbeddingProvider interface
  ```typescript
  // tests/providers/embeddings.test.ts
  describe('EmbeddingProvider', () => {
    it('should return embedding of correct dimension');
    it('should handle batch requests efficiently');
    it('should cache repeated requests');
    it('should throw on invalid input');
  });
  ```

- [ ] **Task 1.1.1.2**: Implement `GeminiEmbeddingProvider`
  ```typescript
  // providers/embeddings/GeminiEmbeddingProvider.ts
  export class GeminiEmbeddingProvider implements EmbeddingProvider {
    dimension = 768;

    constructor(
      private apiKey: string,
      private cache: CacheProvider
    ) {}

    async getEmbedding(text: string): Promise<number[]> {
      const key = CacheKeys.embedding(hashText(text));
      const cached = await this.cache.get<number[]>(key);
      if (cached) return cached;

      const result = await this.callGeminiAPI(text);
      await this.cache.set(key, result, 86400); // 24h cache
      return result;
    }

    async getBatchEmbeddings(texts: string[]): Promise<number[][]> {
      // Batch API call for efficiency
    }
  }
  ```

- [ ] **Task 1.1.1.3**: Implement `OpenAIEmbeddingProvider`
  ```typescript
  // Similar structure, different API
  ```

- [ ] **Task 1.1.1.4**: Implement `LocalEmbeddingProvider` (offline mode)
  ```typescript
  // Uses pre-computed embeddings or simple hashing fallback
  ```

#### 1.1.2 Translation Providers (TDD)

- [ ] **Task 1.1.2.1**: Write tests for TranslationProvider interface
  ```typescript
  describe('TranslationProvider', () => {
    it('should translate Tibetan to English');
    it('should preserve Tibetan in parentheses');
    it('should handle batch translations');
    it('should retry on transient failures');
  });
  ```

- [ ] **Task 1.1.2.2**: Implement `GeminiTranslationProvider`
  ```typescript
  export class GeminiTranslationProvider implements TranslationProvider {
    constructor(
      private apiKey: string,
      private config: ModelConfig
    ) {}

    async translate(text: string, prompt: string): Promise<TranslationResult> {
      // Call Gemini API with retry logic
    }

    async translateBatch(texts: string[], prompt: string): Promise<TranslationResult[]> {
      // Batch translations (5 at a time)
      const batches = chunk(texts, 5);
      const results = await Promise.all(
        batches.map(batch => this.processBatch(batch, prompt))
      );
      return results.flat();
    }
  }
  ```

- [ ] **Task 1.1.2.3**: Implement `OpenAITranslationProvider`

- [ ] **Task 1.1.2.4**: Implement `AnthropicTranslationProvider`

---

### 1.2 Text Processing Pipeline (9 tasks)

#### 1.2.1 PDF Text Extraction (TDD)
**File:** `server/services/extraction/`

- [ ] **Task 1.2.1.1**: Write tests for text extraction
  ```typescript
  // tests/services/extraction.test.ts
  describe('TextExtractor', () => {
    it('should extract text from digital PDF', async () => {
      const result = await extractor.extract(TestData.pdfs.digital);
      assertValidTibetan(result.text);
      expect(result.metadata.pageCount).toBeGreaterThan(0);
    });

    it('should preserve Tibetan spacing', async () => {
      const result = await extractor.extract(TestData.pdfs.withTsek);
      expect(result.text).toMatch(/་/); // Contains tsek
      expect(result.text).not.toMatch(/་ /); // No space after tsek
    });

    it('should detect multi-column layout', async () => {
      const result = await extractor.extract(TestData.pdfs.multiColumn);
      expect(result.metadata.layout).toBe('multi-column');
    });
  });
  ```

- [ ] **Task 1.2.1.2**: Implement `TextExtractor` service
  ```typescript
  // services/extraction/TextExtractor.ts
  export class TextExtractor {
    async extract(pdfBuffer: Buffer): Promise<ExtractedText> {
      const pdf = await pdfjsLib.getDocument(pdfBuffer).promise;
      const pages = await this.extractPages(pdf);
      const cleaned = this.removeArtifacts(pages);
      const normalized = this.normalizeUnicode(cleaned);

      return {
        text: normalized.join('\n\n'),
        metadata: {
          pageCount: pages.length,
          layout: this.detectLayout(pages),
          quality: this.assessQuality(normalized)
        }
      };
    }

    private async extractPages(pdf: PDFDocument): Promise<string[]> {
      // Parallel page extraction
      const pageNumbers = Array.from({ length: pdf.numPages }, (_, i) => i + 1);
      return await Promise.all(
        pageNumbers.map(n => this.extractPage(pdf, n))
      );
    }
  }
  ```

- [ ] **Task 1.2.1.3**: Implement position-aware extraction
  ```typescript
  // services/extraction/PositionAwareExtractor.ts
  class PositionAwareExtractor {
    extractWithPositions(page: PDFPage): PositionalText[] {
      // Use PDF.js position data
      // Group by line, sort by column
      // Calculate intelligent spacing
    }
  }
  ```

- [ ] **Task 1.2.1.4**: Implement artifact removal
  ```typescript
  // services/extraction/ArtifactRemover.ts
  class ArtifactRemover {
    removeArtifacts(pages: string[]): string[] {
      const patterns = this.detectRepeatingPatterns(pages);
      return pages.map(page => this.cleanPage(page, patterns));
    }
  }
  ```

#### 1.2.2 Text Chunking (TDD)

- [ ] **Task 1.2.2.1**: Write tests for chunking
  ```typescript
  describe('TextChunker', () => {
    it('should never exceed max tokens');
    it('should never split mid-sentence');
    it('should add context overlap');
    it('should detect Tibetan sentence boundaries');
  });
  ```

- [ ] **Task 1.2.2.2**: Implement `TextChunker` service
  ```typescript
  // services/chunking/TextChunker.ts
  export class TextChunker {
    constructor(private config: ChunkingConfig) {}

    chunk(text: string): TextChunk[] {
      const sentences = this.splitIntoSentences(text);
      const chunks: TextChunk[] = [];
      let currentChunk: string[] = [];
      let tokenCount = 0;

      for (const sentence of sentences) {
        const sentenceTokens = this.estimateTokens(sentence);

        if (tokenCount + sentenceTokens > this.config.maxTokens) {
          // Save current chunk with overlap from previous
          chunks.push(this.createChunk(currentChunk, chunks.length));
          currentChunk = this.getOverlap(currentChunk);
          tokenCount = this.estimateTokens(currentChunk.join(' '));
        }

        currentChunk.push(sentence);
        tokenCount += sentenceTokens;
      }

      if (currentChunk.length > 0) {
        chunks.push(this.createChunk(currentChunk, chunks.length));
      }

      return chunks;
    }
  }
  ```

- [ ] **Task 1.2.2.3**: Implement Tibetan sentence detector
  ```typescript
  // services/chunking/TibetanSentenceDetector.ts
  class TibetanSentenceDetector {
    split(text: string): string[] {
      // Detect shad (།), double shad (༎), etc.
      // Handle mixed Tibetan-English
      // Respect parentheses
    }
  }
  ```

- [ ] **Task 1.2.2.4**: Implement token estimator
  ```typescript
  // services/chunking/TokenEstimator.ts
  class TokenEstimator {
    estimate(text: string): number {
      // ~4 chars per token for Tibetan
      // Use tiktoken for English portions
      const tibetanChars = text.match(/[\u0F00-\u0FFF]/g)?.length || 0;
      const otherChars = text.length - tibetanChars;
      return Math.ceil(tibetanChars / 4) + Math.ceil(otherChars / 4);
    }
  }
  ```

#### 1.2.3 Unicode Handling (TDD)

- [ ] **Task 1.2.3.1**: Write tests for Unicode validation
  ```typescript
  describe('UnicodeValidator', () => {
    it('should normalize to NFC');
    it('should detect corruption');
    it('should validate Tibetan percentage');
  });
  ```

- [ ] **Task 1.2.3.2**: Implement `UnicodeValidator`
  ```typescript
  // services/unicode/UnicodeValidator.ts
  export class UnicodeValidator {
    validate(text: string): ValidationResult {
      const normalized = this.normalize(text);
      const corruption = this.detectCorruption(normalized);
      const tibetanPercent = this.calculateTibetanPercentage(normalized);

      return {
        isValid: corruption.length === 0 && tibetanPercent >= 50,
        errors: corruption,
        warnings: tibetanPercent < 70 ? ['Low Tibetan content'] : []
      };
    }
  }
  ```

---

### 1.3 Translation Core (10 tasks)

#### 1.3.1 Translation Service (TDD)
**File:** `server/services/translation/`

- [ ] **Task 1.3.1.1**: Write tests for TranslationService
  ```typescript
  describe('TranslationService', () => {
    it('should translate single chunk');
    it('should translate multiple chunks in parallel');
    it('should use cache for repeated translations');
    it('should fall back on provider failure');
    it('should track metrics');
  });
  ```

- [ ] **Task 1.3.1.2**: Implement `TranslationService`
  ```typescript
  // services/translation/TranslationService.ts
  export class TranslationService {
    constructor(
      private providers: TranslationProvider[],
      private cache: CacheProvider,
      private config: TranslationConfig
    ) {}

    async translate(request: TranslationRequest): Promise<TranslationResult> {
      // 1. Check cache
      const cacheKey = CacheKeys.translation(hashText(request.text));
      const cached = await this.cache.get<TranslationResult>(cacheKey);
      if (cached) return cached;

      // 2. Generate prompt
      const prompt = await this.promptGenerator.generate(request);

      // 3. Try providers in priority order
      let result: TranslationResult;
      for (const provider of this.providers) {
        try {
          result = await provider.translate(request.text, prompt);
          break;
        } catch (error) {
          // Log and try next provider
        }
      }

      // 4. Cache result
      await this.cache.set(cacheKey, result, 3600);

      return result;
    }

    async translateBatch(chunks: TextChunk[]): Promise<TranslationResult[]> {
      // Process 5 chunks in parallel
      const batches = chunk(chunks, 5);
      const results: TranslationResult[] = [];

      for (const batch of batches) {
        const batchResults = await Promise.all(
          batch.map(chunk => this.translate({ text: chunk.text }))
        );
        results.push(...batchResults);
      }

      return results;
    }
  }
  ```

- [ ] **Task 1.3.1.3**: Implement `PromptGenerator`
  ```typescript
  // services/translation/PromptGenerator.ts
  export class PromptGenerator {
    constructor(
      private dictionary: DictionaryService,
      private examples: ExampleSelector
    ) {}

    async generate(request: TranslationRequest): Promise<string> {
      const relevantTerms = await this.dictionary.findRelevantTerms(request.text);
      const examples = await this.examples.selectBest(request.text, 3);

      return this.buildPrompt({
        text: request.text,
        terms: relevantTerms,
        examples: examples
      });
    }
  }
  ```

#### 1.3.2 Dictionary Service (TDD)

- [ ] **Task 1.3.2.1**: Write tests for DictionaryService
  ```typescript
  describe('DictionaryService', () => {
    it('should find terms in text');
    it('should rank by frequency');
    it('should limit to N terms');
    it('should cache lookups');
  });
  ```

- [ ] **Task 1.3.2.2**: Implement `DictionaryService`
  ```typescript
  // services/dictionary/DictionaryService.ts
  export class DictionaryService {
    constructor(
      private db: DatabaseService,
      private cache: CacheProvider
    ) {}

    async findRelevantTerms(text: string, limit: number = 20): Promise<DictionaryEntry[]> {
      // 1. Extract potential terms from text
      const terms = this.extractTibetanTerms(text);

      // 2. Batch query database
      const entries = await this.db.query<DictionaryEntry>(
        'SELECT * FROM dictionary_entries WHERE tibetan = ANY($1)',
        [terms]
      );

      // 3. Sort by frequency (common first)
      const sorted = entries.sort((a, b) =>
        this.frequencyOrder[a.frequency] - this.frequencyOrder[b.frequency]
      );

      return sorted.slice(0, limit);
    }

    async load(jsonPath: string): Promise<void> {
      // Bulk insert from JSON files
      const entries = await readJSON(jsonPath);
      await this.db.transaction(async (tx) => {
        for (const entry of entries) {
          await tx.insert('dictionary_entries', entry);
        }
      });
    }
  }
  ```

- [ ] **Task 1.3.2.3**: Create dictionary loader utility
  ```typescript
  // scripts/load-dictionary.ts
  async function loadAllDictionaries() {
    const files = [
      'data/buddhist-terms.json',
      'data/sakya-terms.json',
      'data/philosophy-terms.json',
      // etc
    ];

    for (const file of files) {
      await dictionaryService.load(file);
    }
  }
  ```

#### 1.3.3 Example Selector (TDD)

- [ ] **Task 1.3.3.1**: Write tests for ExampleSelector
  ```typescript
  describe('ExampleSelector', () => {
    it('should select most similar examples');
    it('should ensure diversity');
    it('should fall back to keyword matching');
  });
  ```

- [ ] **Task 1.3.3.2**: Implement `ExampleSelector`
  ```typescript
  // services/examples/ExampleSelector.ts
  export class ExampleSelector {
    constructor(
      private embeddingProvider: EmbeddingProvider,
      private examples: TranslationExample[]
    ) {}

    async selectBest(text: string, count: number): Promise<TranslationExample[]> {
      // 1. Get embedding for input text
      const textEmbedding = await this.embeddingProvider.getEmbedding(text);

      // 2. Calculate similarity with all examples
      const similarities = this.examples.map(ex => ({
        example: ex,
        similarity: cosineSimilarity(textEmbedding, ex.embedding)
      }));

      // 3. Sort by similarity
      similarities.sort((a, b) => b.similarity - a.similarity);

      // 4. Select diverse examples
      return this.selectDiverse(similarities, count);
    }

    private selectDiverse(ranked: SimilarityScore[], count: number): TranslationExample[] {
      const selected: TranslationExample[] = [];
      const categories = new Set<string>();

      for (const { example } of ranked) {
        if (selected.length >= count) break;

        // Ensure diversity - max 50% from same category
        if (categories.has(example.category) &&
            selected.filter(e => e.category === example.category).length >= count / 2) {
          continue;
        }

        selected.push(example);
        categories.add(example.category);
      }

      return selected;
    }
  }
  ```

- [ ] **Task 1.3.3.3**: Create example embeddings generator
  ```typescript
  // scripts/generate-example-embeddings.ts
  async function generateEmbeddings() {
    const examples = await loadExamples('data/translation-examples.json');
    const provider = new GeminiEmbeddingProvider(apiKey, cache);

    // Batch process
    const embeddings = await provider.getBatchEmbeddings(
      examples.map(ex => ex.tibetan)
    );

    // Save with examples
    const withEmbeddings = examples.map((ex, i) => ({
      ...ex,
      embedding: embeddings[i]
    }));

    await writeJSON('data/translation-examples-with-embeddings.json', withEmbeddings);
  }
  ```

#### 1.3.4 Translation Memory (NEW - wasn't in V1)

- [ ] **Task 1.3.4.1**: Write tests for TranslationMemory
  ```typescript
  describe('TranslationMemory', () => {
    it('should find similar translations');
    it('should return null if no match above threshold');
    it('should update memory with new translations');
  });
  ```

- [ ] **Task 1.3.4.2**: Implement `TranslationMemory`
  ```typescript
  // services/translation/TranslationMemory.ts
  export class TranslationMemory {
    constructor(
      private db: DatabaseService,
      private embeddingProvider: EmbeddingProvider
    ) {}

    async findSimilar(text: string, threshold: number = 0.95): Promise<TranslationResult | null> {
      // 1. Get embedding
      const embedding = await this.embeddingProvider.getEmbedding(text);

      // 2. Vector similarity search in database
      const similar = await this.db.query<SavedTranslation>(
        `SELECT *,
          1 - (embedding <=> $1::vector) AS similarity
         FROM translations
         WHERE 1 - (embedding <=> $1::vector) > $2
         ORDER BY similarity DESC
         LIMIT 1`,
        [embedding, threshold]
      );

      if (similar.length === 0) return null;

      return {
        translation: similar[0].translation,
        confidence: similar[0].confidence,
        metadata: { ...similar[0].metadata, fromMemory: true }
      };
    }

    async save(request: TranslationRequest, result: TranslationResult): Promise<void> {
      const embedding = await this.embeddingProvider.getEmbedding(request.text);

      await this.db.query(
        `INSERT INTO translations (source_text_hash, source_text, translation, confidence, embedding)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (source_text_hash) DO UPDATE
         SET translation = $3, confidence = $4, updated_at = NOW()`,
        [hashText(request.text), request.text, result.translation, result.confidence, embedding]
      );
    }
  }
  ```

---

### 1.4 Quality & Validation (8 tasks)

#### 1.4.1 Validation Framework (TDD)
**File:** `server/services/validation/`

- [ ] **Task 1.4.1.1**: Write tests for validators
  ```typescript
  describe('InputValidator', () => {
    it('should validate Tibetan text');
    it('should check length constraints');
    it('should detect invalid Unicode');
  });

  describe('OutputValidator', () => {
    it('should validate format');
    it('should check Tibetan preservation');
    it('should detect AI refusals');
  });
  ```

- [ ] **Task 1.4.1.2**: Implement `ValidationService`
  ```typescript
  // services/validation/ValidationService.ts
  export class ValidationService {
    private validators: Validator[] = [
      new TibetanContentValidator(),
      new LengthValidator(),
      new UnicodeValidator(),
      new FormatValidator(),
      new PreservationValidator(),
    ];

    validate(data: any, stage: 'input' | 'output'): ValidationResult {
      const results = this.validators
        .filter(v => v.stage === stage)
        .map(v => v.validate(data));

      return {
        isValid: results.every(r => r.isValid),
        errors: results.flatMap(r => r.errors),
        warnings: results.flatMap(r => r.warnings)
      };
    }
  }
  ```

- [ ] **Task 1.4.1.3**: Implement individual validators
  ```typescript
  // services/validation/validators/TibetanContentValidator.ts
  export class TibetanContentValidator implements Validator {
    stage = 'input';

    validate(text: string): ValidationResult {
      const tibetanPercent = calculateTibetanPercentage(text);

      if (tibetanPercent < 50) {
        return {
          isValid: false,
          errors: ['Text must contain at least 50% Tibetan characters'],
          warnings: []
        };
      }

      if (tibetanPercent < 70) {
        return {
          isValid: true,
          errors: [],
          warnings: ['Text contains less than 70% Tibetan characters']
        };
      }

      return { isValid: true, errors: [], warnings: [] };
    }
  }
  ```

#### 1.4.2 Quality Scoring (TDD)

- [ ] **Task 1.4.2.1**: Write tests for quality scorer
  ```typescript
  describe('QualityScorer', () => {
    it('should calculate overall score');
    it('should score confidence');
    it('should score format compliance');
    it('should score preservation');
  });
  ```

- [ ] **Task 1.4.2.2**: Implement `QualityScorer`
  ```typescript
  // services/quality/QualityScorer.ts
  export class QualityScorer {
    score(result: TranslationResult, original: string): QualityScore {
      return {
        overall: this.calculateOverall(result, original),
        confidence: result.confidence,
        format: this.scoreFormat(result.translation),
        preservation: this.scorePreservation(result.translation, original),
      };
    }

    private calculateOverall(result: TranslationResult, original: string): number {
      const weights = {
        confidence: 0.4,
        format: 0.3,
        preservation: 0.3
      };

      return (
        result.confidence * weights.confidence +
        this.scoreFormat(result.translation) * weights.format +
        this.scorePreservation(result.translation, original) * weights.preservation
      );
    }
  }
  ```

#### 1.4.3 Quality Gates (TDD)

- [ ] **Task 1.4.3.1**: Write tests for quality gates
  ```typescript
  describe('QualityGates', () => {
    it('should reject low confidence');
    it('should warn on format issues');
    it('should pass high quality');
  });
  ```

- [ ] **Task 1.4.3.2**: Implement `QualityGateService`
  ```typescript
  // services/quality/QualityGateService.ts
  export class QualityGateService {
    private gates: QualityGate[] = [
      { name: 'confidence', threshold: 0.7, action: 'reject' },
      { name: 'format', threshold: 0.8, action: 'warn' },
      { name: 'preservation', threshold: 0.7, action: 'reject' },
    ];

    check(result: TranslationResult, original: string): GateResult {
      const score = this.scorer.score(result, original);
      const failures: GateFailure[] = [];

      for (const gate of this.gates) {
        const value = score[gate.name as keyof QualityScore];
        if (value < gate.threshold) {
          failures.push({
            gate: gate.name,
            threshold: gate.threshold,
            actual: value,
            action: gate.action
          });
        }
      }

      return {
        passed: failures.filter(f => f.action === 'reject').length === 0,
        failures
      };
    }
  }
  ```

---

## PHASE 2: QUALITY & VALIDATION (5 days, 30 tasks)

### 2.1 Confidence System (8 tasks)

#### 2.1.1 Confidence Calculator (TDD)
**File:** `server/services/confidence/`

- [ ] **Task 2.1.1.1**: Write comprehensive confidence tests
  ```typescript
  describe('ConfidenceCalculator', () => {
    it('should calculate base confidence from model');
    it('should boost for dictionary term usage');
    it('should penalize for format issues');
    it('should consider semantic similarity');
    it('should aggregate from multiple models');
  });
  ```

- [ ] **Task 2.1.1.2**: Implement `ConfidenceCalculator`
  ```typescript
  // services/confidence/ConfidenceCalculator.ts
  export class ConfidenceCalculator {
    calculate(result: TranslationResult, context: ConfidenceContext): number {
      let confidence = result.confidence; // Base from model

      // Factor 1: Dictionary term coverage (+0.15)
      confidence += this.dictionaryBoost(result.translation, context.dictionaryTerms);

      // Factor 2: Format compliance (+0.10)
      confidence += this.formatBoost(result.translation);

      // Factor 3: Preservation quality (+0.10)
      confidence += this.preservationBoost(result.translation, context.originalText);

      // Factor 4: Semantic consistency (+0.15)
      if (context.multipleModels) {
        confidence += this.semanticAgreement(result, context.otherResults);
      }

      return Math.min(0.98, Math.max(0.1, confidence));
    }
  }
  ```

- [ ] **Task 2.1.1.3**: Implement semantic similarity for confidence
  ```typescript
  // services/confidence/SemanticAgreement.ts
  export class SemanticAgreement {
    constructor(private embeddingProvider: EmbeddingProvider) {}

    async calculateAgreement(translations: string[]): Promise<number> {
      if (translations.length < 2) return 1.0;

      // Get embeddings for all translations
      const embeddings = await this.embeddingProvider.getBatchEmbeddings(translations);

      // Calculate pairwise similarities
      const similarities: number[] = [];
      for (let i = 0; i < embeddings.length; i++) {
        for (let j = i + 1; j < embeddings.length; j++) {
          similarities.push(cosineSimilarity(embeddings[i], embeddings[j]));
        }
      }

      // Return average similarity
      return similarities.reduce((a, b) => a + b, 0) / similarities.length;
    }
  }
  ```

- [ ] **Task 2.1.1.4**: Implement multi-model consensus
  ```typescript
  // services/confidence/ConsensusBuilder.ts
  export class ConsensusBuilder {
    async buildConsensus(results: TranslationResult[]): Promise<TranslationResult> {
      if (results.length === 1) return results[0];

      // 1. Calculate semantic agreement
      const agreement = await this.semanticAgreement.calculateAgreement(
        results.map(r => r.translation)
      );

      // 2. Weight by individual confidence
      const weighted = results.map(r => ({
        result: r,
        weight: r.confidence * agreement
      }));

      // 3. Select highest weighted or blend
      weighted.sort((a, b) => b.weight - a.weight);
      const best = weighted[0].result;

      // 4. Boost confidence based on agreement
      return {
        ...best,
        confidence: Math.min(0.98, best.confidence + (agreement * 0.1)),
        metadata: {
          ...best.metadata,
          consensus: true,
          modelAgreement: agreement
        }
      };
    }
  }
  ```

---

### 2.2 Monitoring & Metrics (7 tasks)

#### 2.2.1 Unified Monitoring Service (TDD)
**File:** `server/services/monitoring/`

- [ ] **Task 2.2.1.1**: Write monitoring tests
  ```typescript
  describe('MonitoringService', () => {
    it('should track performance metrics');
    it('should track quality metrics');
    it('should detect anomalies');
    it('should flush metrics to database');
  });
  ```

- [ ] **Task 2.2.1.2**: Implement `MonitoringService`
  ```typescript
  // services/monitoring/MonitoringService.ts
  export class MonitoringService {
    private buffer: Metric[] = [];
    private readonly FLUSH_INTERVAL = 30000; // 30 seconds

    constructor(private db: DatabaseService) {
      this.startAutoFlush();
    }

    record(name: string, value: number, tags?: Record<string, string>): void {
      this.buffer.push({
        timestamp: Date.now(),
        name,
        value,
        tags
      });

      if (this.buffer.length >= 100) {
        this.flush(); // Flush if buffer full
      }
    }

    async flush(): Promise<void> {
      if (this.buffer.length === 0) return;

      const metrics = [...this.buffer];
      this.buffer = [];

      await this.db.transaction(async (tx) => {
        for (const metric of metrics) {
          await tx.insert('metrics', metric);
        }
      });
    }

    // Performance tracking
    trackTranslation(duration: number, success: boolean): void {
      this.record('translation.duration', duration);
      this.record('translation.success', success ? 1 : 0);
    }

    // Quality tracking
    trackQuality(score: QualityScore): void {
      this.record('quality.overall', score.overall);
      this.record('quality.confidence', score.confidence);
      this.record('quality.format', score.format);
      this.record('quality.preservation', score.preservation);
    }

    // Get statistics
    async getStats(timeRange: TimeRange): Promise<Statistics> {
      const metrics = await this.db.query<Metric>(
        `SELECT name, AVG(value) as avg, MAX(value) as max, MIN(value) as min
         FROM metrics
         WHERE timestamp BETWEEN $1 AND $2
         GROUP BY name`,
        [timeRange.start, timeRange.end]
      );

      return this.aggregateStats(metrics);
    }
  }
  ```

- [ ] **Task 2.2.1.3**: Implement performance tracking middleware
  ```typescript
  // middleware/performanceTracker.ts
  export function performanceTracker(monitoring: MonitoringService) {
    return async (req: Request, res: Response, next: NextFunction) => {
      const start = Date.now();

      res.on('finish', () => {
        const duration = Date.now() - start;
        monitoring.record('api.request.duration', duration, {
          method: req.method,
          path: req.path,
          status: res.statusCode.toString()
        });
      });

      next();
    };
  }
  ```

- [ ] **Task 2.2.1.4**: Create monitoring API endpoints
  ```typescript
  // routes/monitoring.ts
  router.get('/api/monitoring/health', async (req, res) => {
    const health = await monitoring.checkHealth();
    res.json(health);
  });

  router.get('/api/monitoring/metrics', async (req, res) => {
    const { start, end } = req.query;
    const stats = await monitoring.getStats({ start, end });
    res.json(stats);
  });

  router.get('/api/monitoring/quality', async (req, res) => {
    const quality = await monitoring.getQualityTrends();
    res.json(quality);
  });
  ```

---

### 2.3 Error Recovery (8 tasks)

#### 2.3.1 Retry Handler (TDD)
**File:** `server/services/retry/`

- [ ] **Task 2.3.1.1**: Write retry tests
  ```typescript
  describe('RetryHandler', () => {
    it('should retry transient errors');
    it('should use exponential backoff');
    it('should respect max retries');
    it('should not retry validation errors');
  });
  ```

- [ ] **Task 2.3.1.2**: Implement `RetryHandler`
  ```typescript
  // services/retry/RetryHandler.ts
  export class RetryHandler {
    async executeWithRetry<T>(
      fn: () => Promise<T>,
      options: RetryOptions
    ): Promise<T> {
      let lastError: Error;

      for (let attempt = 0; attempt <= options.maxRetries; attempt++) {
        try {
          return await fn();
        } catch (error) {
          lastError = error as Error;

          // Don't retry if not transient
          if (!this.isTransient(error)) {
            throw error;
          }

          // Wait before retry with exponential backoff
          const delay = this.calculateDelay(attempt, options);
          await this.sleep(delay);
        }
      }

      throw lastError!;
    }

    private calculateDelay(attempt: number, options: RetryOptions): number {
      const baseDelay = options.baseDelay || 1000;
      const maxDelay = options.maxDelay || 60000;

      // Exponential backoff with jitter
      const exponential = baseDelay * Math.pow(2, attempt);
      const jitter = Math.random() * 0.2 * exponential; // ±20%

      return Math.min(exponential + jitter, maxDelay);
    }

    private isTransient(error: any): boolean {
      if (error instanceof TranslationError) {
        return [
          ErrorCode.RATE_LIMIT,
          ErrorCode.NETWORK_ERROR,
          ErrorCode.TIMEOUT,
          ErrorCode.API_UNAVAILABLE
        ].includes(error.code);
      }
      return false;
    }
  }
  ```

- [ ] **Task 2.3.1.3**: Implement circuit breaker
  ```typescript
  // services/retry/CircuitBreaker.ts
  export class CircuitBreaker {
    private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';
    private failures = 0;
    private lastFailureTime = 0;

    async execute<T>(fn: () => Promise<T>): Promise<T> {
      if (this.state === 'OPEN') {
        if (Date.now() - this.lastFailureTime > this.config.resetTimeout) {
          this.state = 'HALF_OPEN';
        } else {
          throw new Error('Circuit breaker is OPEN');
        }
      }

      try {
        const result = await fn();
        this.onSuccess();
        return result;
      } catch (error) {
        this.onFailure();
        throw error;
      }
    }

    private onSuccess(): void {
      this.failures = 0;
      this.state = 'CLOSED';
    }

    private onFailure(): void {
      this.failures++;
      this.lastFailureTime = Date.now();

      if (this.failures >= this.config.failureThreshold) {
        this.state = 'OPEN';
      }
    }
  }
  ```

#### 2.3.2 Fallback System (TDD)

- [ ] **Task 2.3.2.1**: Write fallback tests
  ```typescript
  describe('FallbackStrategy', () => {
    it('should try simpler prompt first');
    it('should try alternative model');
    it('should try smaller chunks');
    it('should mark for manual review as last resort');
  });
  ```

- [ ] **Task 2.3.2.2**: Implement `FallbackOrchestrator`
  ```typescript
  // services/fallback/FallbackOrchestrator.ts
  export class FallbackOrchestrator {
    private strategies: FallbackStrategy[] = [
      new SimplerPromptStrategy(),
      new AlternativeModelStrategy(),
      new SmallerChunkStrategy(),
      new ManualReviewStrategy()
    ];

    async executeWithFallback(
      request: TranslationRequest
    ): Promise<TranslationResult> {
      let lastError: Error;

      for (const strategy of this.strategies) {
        try {
          return await strategy.execute(request);
        } catch (error) {
          lastError = error as Error;
          console.log(`Strategy ${strategy.name} failed, trying next...`);
        }
      }

      throw new Error(`All fallback strategies failed: ${lastError!.message}`);
    }
  }
  ```

- [ ] **Task 2.3.2.3**: Implement specific fallback strategies
  ```typescript
  // services/fallback/strategies/SimplerPromptStrategy.ts
  export class SimplerPromptStrategy implements FallbackStrategy {
    name = 'simpler-prompt';

    async execute(request: TranslationRequest): Promise<TranslationResult> {
      // Remove examples, simplify prompt
      const simplePrompt = `Translate this Tibetan text to English. Include the original Tibetan in parentheses after each sentence.\n\n${request.text}`;

      return await this.provider.translate(request.text, simplePrompt);
    }
  }
  ```

---

### 2.4 Advanced Dictionary Features (7 tasks)

#### 2.4.1 Dictionary Learning (TDD)

- [ ] **Task 2.4.1.1**: Write tests for term extraction
  ```typescript
  describe('TermExtractor', () => {
    it('should extract Tibetan-English pairs');
    it('should filter non-terms');
    it('should score term importance');
  });
  ```

- [ ] **Task 2.4.1.2**: Implement `TermExtractor`
  ```typescript
  // services/dictionary/TermExtractor.ts
  export class TermExtractor {
    extract(translation: string): TermPair[] {
      // Regex: English (Tibetan)
      const pattern = /([^()]+)\s*\(([^\)]*[\u0F00-\u0FFF][^\)]*)\)/g;
      const pairs: TermPair[] = [];

      let match;
      while ((match = pattern.exec(translation)) !== null) {
        const english = match[1].trim();
        const tibetan = match[2].trim();

        // Filter out full sentences (too long)
        if (english.split(' ').length > 15) continue;

        // Filter out single common words
        if (english.split(' ').length === 1 && this.isCommonWord(english)) continue;

        pairs.push({
          tibetan,
          english,
          confidence: this.scoreTermConfidence(tibetan, english)
        });
      }

      return pairs;
    }
  }
  ```

- [ ] **Task 2.4.1.3**: Implement terminology consistency tracker
  ```typescript
  // services/dictionary/ConsistencyTracker.ts
  export class ConsistencyTracker {
    private glossary: Map<string, string[]> = new Map();

    add(term: TermPair): void {
      if (!this.glossary.has(term.tibetan)) {
        this.glossary.set(term.tibetan, []);
      }

      this.glossary.get(term.tibetan)!.push(term.english);
    }

    checkConsistency(): InconsistencyReport[] {
      const issues: InconsistencyReport[] = [];

      for (const [tibetan, translations] of this.glossary.entries()) {
        const unique = new Set(translations);

        if (unique.size > 1) {
          issues.push({
            tibetan,
            translations: Array.from(unique),
            count: translations.length,
            severity: this.calculateSeverity(unique.size, translations.length)
          });
        }
      }

      return issues;
    }
  }
  ```

---

## PHASE 3: ADVANCED FEATURES (4 days, 25 tasks)

### 3.1 OCR Support (8 tasks)

#### 3.1.1 OCR Integration (TDD)
**File:** `client/src/services/ocr/`

- [ ] **Task 3.1.1.1**: Write OCR tests
  ```typescript
  describe('OCRService', () => {
    it('should detect when OCR needed');
    it('should extract text from scanned PDF');
    it('should post-process OCR results');
  });
  ```

- [ ] **Task 3.1.1.2**: Implement `OCRService`
  ```typescript
  // services/ocr/OCRService.ts
  export class OCRService {
    async needsOCR(extractedText: string, pageCount: number): Promise<boolean> {
      const avgCharsPerPage = extractedText.length / pageCount;
      return avgCharsPerPage < 50; // Sparse text, likely scanned
    }

    async processPage(page: PDFPage): Promise<string> {
      // 1. Render to high-quality image
      const image = await this.renderToImage(page, 300); // 300 DPI

      // 2. Run Tesseract
      const result = await this.tesseract.recognize(image, { lang: 'bod' });

      // 3. Post-process
      const cleaned = this.postProcess(result.text);

      return cleaned;
    }

    private postProcess(text: string): string {
      // Fix common OCR errors in Tibetan
      let cleaned = text;

      // Character confusion corrections
      const corrections = {
        'o': 'ོ',  // Latin o → Tibetan vowel
        'i': 'ི',  // Latin i → Tibetan vowel
        '|': '།',  // Pipe → shad
        '/': '་',  // Slash → tsek
      };

      for (const [wrong, correct] of Object.entries(corrections)) {
        cleaned = cleaned.replace(new RegExp(wrong, 'g'), correct);
      }

      return cleaned;
    }
  }
  ```

- [ ] **Task 3.1.1.3**: Implement hybrid extraction strategy
  ```typescript
  // services/extraction/HybridExtractor.ts
  export class HybridExtractor {
    async extract(pdf: Buffer): Promise<ExtractedText> {
      // Try native extraction first
      const nativeResult = await this.nativeExtractor.extract(pdf);

      // Check if OCR needed
      if (await this.ocrService.needsOCR(nativeResult.text, nativeResult.pageCount)) {
        console.log('Sparse text detected, using OCR...');
        const ocrResult = await this.ocrExtractor.extract(pdf);
        return {
          ...ocrResult,
          metadata: {
            ...ocrResult.metadata,
            extractionMethod: 'ocr'
          }
        };
      }

      return nativeResult;
    }
  }
  ```

*[Tasks 3.1.1.4-3.1.1.8 continue with OCR quality assessment, caching, parallel processing, etc.]*

---

### 3.2 Request Queue & Job System (7 tasks)

#### 3.2.1 Job Queue (NEW - better than simple batch processing)
**File:** `server/services/queue/`

- [ ] **Task 3.2.1.1**: Write queue tests
  ```typescript
  describe('JobQueue', () => {
    it('should enqueue translation job');
    it('should process jobs in order');
    it('should handle job failures');
    it('should allow cancellation');
  });
  ```

- [ ] **Task 3.2.1.2**: Implement `JobQueue`
  ```typescript
  // services/queue/JobQueue.ts
  export class JobQueue {
    private queue: Job[] = [];
    private processing = false;

    async enqueue(request: TranslationRequest): Promise<string> {
      const job: Job = {
        id: generateId(),
        request,
        status: 'pending',
        createdAt: Date.now()
      };

      this.queue.push(job);
      await this.db.insert('jobs', job);

      if (!this.processing) {
        this.processQueue();
      }

      return job.id;
    }

    async getStatus(jobId: string): Promise<JobStatus> {
      const job = await this.db.query<Job>(
        'SELECT * FROM jobs WHERE id = $1',
        [jobId]
      );

      return {
        id: job.id,
        status: job.status,
        progress: job.progress || 0,
        result: job.result
      };
    }

    private async processQueue(): Promise<void> {
      this.processing = true;

      while (this.queue.length > 0) {
        const job = this.queue.shift()!;
        await this.processJob(job);
      }

      this.processing = false;
    }
  }
  ```

- [ ] **Task 3.2.1.3**: Add Server-Sent Events for progress
  ```typescript
  // routes/jobs.ts
  router.get('/api/jobs/:id/stream', async (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const jobId = req.params.id;

    // Stream progress updates
    const interval = setInterval(async () => {
      const status = await jobQueue.getStatus(jobId);
      res.write(`data: ${JSON.stringify(status)}\n\n`);

      if (status.status === 'completed' || status.status === 'failed') {
        clearInterval(interval);
        res.end();
      }
    }, 1000);
  });
  ```

*[Continue with remaining queue tasks...]*

---

### 3.3 Testing & Quality Assurance (10 tasks)

#### 3.3.1 Integration Test Suite

- [ ] **Task 3.3.1.1**: Create end-to-end test
  ```typescript
  // tests/integration/full-pipeline.test.ts
  describe('Full Translation Pipeline', () => {
    it('should extract, chunk, translate, and validate', async () => {
      // 1. Upload PDF
      const pdf = await readFile(TestData.pdfs.digital);

      // 2. Extract text
      const extracted = await textExtractor.extract(pdf);
      assertValidTibetan(extracted.text);

      // 3. Chunk text
      const chunks = await textChunker.chunk(extracted.text);
      expect(chunks).toHaveLength(greaterThan(0));

      // 4. Translate
      const results = await translationService.translateBatch(chunks);
      results.forEach(assertValidTranslation);

      // 5. Validate quality
      const scores = results.map(r => qualityScorer.score(r));
      expect(scores.every(s => s.overall > 0.7)).toBe(true);
    });
  });
  ```

#### 3.3.2 Golden Dataset Testing

- [ ] **Task 3.3.2.1**: Create golden dataset
  ```typescript
  // tests/fixtures/golden-dataset.ts
  export const goldenDataset = [
    {
      id: 'greeting-001',
      tibetan: 'བཀྲ་ཤིས་བདེ་ལེགས།',
      expected: 'Greetings (བཀྲ་ཤིས་བདེ་ལེགས།).',
      category: 'greeting',
      difficulty: 'simple'
    },
    // ... 50 total examples
  ];
  ```

- [ ] **Task 3.3.2.2**: Implement regression tests
  ```typescript
  // tests/regression/golden-dataset.test.ts
  describe('Golden Dataset Regression', () => {
    goldenDataset.forEach(example => {
      it(`should translate ${example.id} correctly`, async () => {
        const result = await translationService.translate({
          text: example.tibetan
        });

        const similarity = await calculateSimilarity(
          result.translation,
          example.expected
        );

        expect(similarity).toBeGreaterThan(0.85);
      });
    });
  });
  ```

*[Continue with performance tests, load tests, etc.]*

---

## PHASE 4: PRODUCTION HARDENING (3 days, 20 tasks)

### 4.1 Security & Authentication (5 tasks)

- [ ] **Task 4.1.1**: Implement API key authentication
- [ ] **Task 4.1.2**: Add rate limiting per user
- [ ] **Task 4.1.3**: Implement input sanitization
- [ ] **Task 4.1.4**: Add audit logging
- [ ] **Task 4.1.5**: Set up secret management

### 4.2 Performance Optimization (5 tasks)

- [ ] **Task 4.2.1**: Add database query optimization
- [ ] **Task 4.2.2**: Implement connection pooling
- [ ] **Task 4.2.3**: Add response compression
- [ ] **Task 4.2.4**: Optimize bundle sizes
- [ ] **Task 4.2.5**: Add CDN configuration

### 4.3 Documentation (5 tasks)

- [ ] **Task 4.3.1**: Generate OpenAPI/Swagger spec
- [ ] **Task 4.3.2**: Create architecture diagrams
- [ ] **Task 4.3.3**: Write deployment guide
- [ ] **Task 4.3.4**: Create troubleshooting runbooks
- [ ] **Task 4.3.5**: Write API usage examples

### 4.4 Deployment & DevOps (5 tasks)

- [ ] **Task 4.4.1**: Create Docker configuration
- [ ] **Task 4.4.2**: Set up CI/CD pipeline
- [ ] **Task 4.4.3**: Configure production environment
- [ ] **Task 4.4.4**: Set up monitoring/alerting
- [ ] **Task 4.4.5**: Create backup/recovery procedures

---

## Summary Comparison: V1 vs V2

| Aspect | V1 (Original) | V2 (Improved) | Benefit |
|--------|---------------|---------------|---------|
| **Total Tasks** | 179 | 135 | -24% fewer tasks |
| **Timeline** | 4 weeks | 3 weeks | -25% faster |
| **Architecture** | Scattered services | Unified, layered | Better maintainability |
| **Testing** | End (Phase 3) | Throughout (TDD) | Fewer bugs |
| **Caching** | Minimal | Multi-layer | 5× faster |
| **Config** | Scattered | Centralized | Easier deployment |
| **Monitoring** | 4 services | 1 unified | Simpler ops |
| **Error Handling** | Added late | Built-in from start | More reliable |
| **Documentation** | Retrofitted | Concurrent | Always up-to-date |

---

## Key Improvements in V2

### 1. **Foundation First**
- All interfaces defined before implementation
- Type system established upfront
- Configuration centralized from day 1

### 2. **TDD Throughout**
- Tests written before implementation
- Catches issues immediately
- Prevents technical debt

### 3. **Simpler Architecture**
- Fewer services (17 vs 30+)
- Clear boundaries
- Better organized file structure

### 4. **Performance Built-In**
- Multi-layer caching
- Batch operations
- Parallel processing
- Connection pooling

### 5. **Better Developer Experience**
- Clear abstractions
- Minimal duplication
- Comprehensive mocks/fixtures
- Well-documented

---

## Implementation Strategy

### Week 1: Foundation
- Days 1-3: Phase 0 (architecture, config, cache, test infrastructure)
- No visible features yet, but solid foundation

### Week 2: Core Engine
- Days 4-8: Phase 1 (providers, text processing, translation core)
- Can translate single documents by end of week

### Week 3: Quality & Features
- Days 9-13: Phase 2-3 (quality, validation, monitoring, OCR, queue)
- Production-ready features

### Week 4: Polish & Deploy
- Days 14-16: Phase 4 (security, optimization, docs, deployment)
- Ready for production launch

---

## Next Steps

1. **Review this plan** - Adjust based on priorities
2. **Set up repository** - Fresh start or new branch?
3. **Begin Phase 0** - Foundation work
4. **Follow TDD strictly** - Write tests first
5. **Iterate and improve** - Learn and adapt

This plan incorporates all lessons learned and should result in a faster, cleaner, more maintainable implementation!
