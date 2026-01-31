/**
 * Shared Type Definitions for Tibetan Translation Tool V2
 *
 * This file contains all domain types, configuration types, and error types
 * that are shared between client and server code. By centralizing these
 * definitions, we ensure type safety across the entire application.
 *
 * @module shared/types
 */

// ============================================================================
// TRANSLATION DOMAIN TYPES
// ============================================================================

/**
 * Request to translate Tibetan text to English.
 *
 * @example
 * ```typescript
 * const request: TranslationRequest = {
 *   text: "བཀྲ་ཤིས་བདེ་ལེགས།",
 *   options: {
 *     maxTokens: 2000,
 *     temperature: 0.3,
 *     model: "gemini-2.0-flash"
 *   }
 * };
 * ```
 */
export interface TranslationRequest {
  /** The Tibetan text to translate (Unicode) */
  text: string;

  /** Optional translation configuration */
  options?: TranslationOptions;

  /** Optional metadata for tracking/analytics */
  metadata?: {
    /** Source document ID or filename */
    source?: string;
    /** Page number in source document */
    pageNumber?: number;
    /** Custom tags for categorization */
    tags?: string[];
  };
}

/**
 * Configuration options for a translation request.
 *
 * These options can override global defaults on a per-request basis.
 */
export interface TranslationOptions {
  /** Maximum tokens for the translation output (default: from config) */
  maxTokens?: number;

  /**
   * Temperature for AI model (0.0 = deterministic, 1.0 = creative)
   * Lower values recommended for translation (0.2-0.4)
   */
  temperature?: number;

  /**
   * Specific model to use (overrides default)
   * Examples: "gemini-2.0-flash", "gpt-4", "claude-3-sonnet"
   */
  model?: string;

  /**
   * Whether to use cached translations if available
   * Set to false to force fresh translation
   */
  useCache?: boolean;

  /**
   * Whether to include dictionary terms in the prompt
   * Default: true
   */
  includeDictionary?: boolean;

  /**
   * Number of example translations to include (0-5)
   * Default: 3
   */
  exampleCount?: number;

  /**
   * Whether to use multiple models for consensus translation
   * When enabled, translates using 2-3 models and selects best result
   * Provides higher confidence through model agreement
   * Default: false (single model for cost-effectiveness)
   * Enable for: critical content, low confidence translations
   */
  useMultiModel?: boolean;
}

/**
 * Result of a successful translation operation.
 *
 * @example
 * ```typescript
 * const result: TranslationResult = {
 *   translation: "Greetings (བཀྲ་ཤིས་བདེ་ལེགས།).",
 *   confidence: 0.92,
 *   metadata: {
 *     model: "gemini-2.0-flash",
 *     cached: false,
 *     processingTimeMs: 1234,
 *     tokenCount: 45
 *   }
 * };
 * ```
 */
export interface TranslationResult {
  /** The translated English text with Tibetan preserved in parentheses */
  translation: string;

  /**
   * Confidence score (0.0 - 1.0)
   * - 0.9+: Excellent quality
   * - 0.8-0.9: Good quality
   * - 0.7-0.8: Acceptable quality
   * - <0.7: Review recommended
   */
  confidence: number;

  /** Additional metadata about the translation */
  metadata: TranslationMetadata;
}

/**
 * Metadata attached to translation results.
 */
export interface TranslationMetadata {
  /** Model used for translation */
  model: string;

  /** Whether result came from cache */
  cached: boolean;

  /** Processing time in milliseconds */
  processingTimeMs: number;

  /** Approximate token count of the translation */
  tokenCount: number;

  /** Quality score breakdown (optional) */
  qualityScore?: QualityScore;

  /** Whether translation came from translation memory */
  fromMemory?: boolean;

  /** Semantic agreement score if multiple models used */
  modelAgreement?: number;

  /** Timestamp when translation was created */
  timestamp?: number;
}

// ============================================================================
// TEXT PROCESSING TYPES
// ============================================================================

/**
 * A chunk of text created by the chunking service.
 *
 * Text is divided into chunks to:
 * - Stay within model token limits
 * - Enable parallel processing
 * - Preserve context with overlap
 *
 * @example
 * ```typescript
 * const chunk: TextChunk = {
 *   id: "page-1-chunk-0",
 *   text: "བཀྲ་ཤིས་བདེ་ལེགས། ...",
 *   pageNumber: 1,
 *   tokenCount: 1500,
 *   metadata: {
 *     chunkIndex: 0,
 *     totalChunks: 5,
 *     hasOverlap: false
 *   }
 * };
 * ```
 */
export interface TextChunk {
  /** Unique identifier for this chunk */
  id: string;

  /** The Tibetan text content */
  text: string;

  /** Source page number */
  pageNumber: number;

  /** Estimated token count */
  tokenCount: number;

  /** Additional chunk metadata */
  metadata?: {
    /** Index of this chunk in the document */
    chunkIndex: number;
    /** Total number of chunks in the document */
    totalChunks: number;
    /** Whether this chunk includes overlap from previous chunk */
    hasOverlap: boolean;
    /** Original character range in source document */
    charRange?: [number, number];
  };
}

/**
 * Result of text extraction from a PDF or other source.
 */
export interface ProcessedText {
  /** Array of text chunks ready for translation */
  chunks: TextChunk[];

  /** Metadata about the extraction process */
  metadata: ExtractionMetadata;
}

/**
 * Metadata from the text extraction process.
 */
export interface ExtractionMetadata {
  /** Total number of pages in source document */
  pageCount: number;

  /** Method used for extraction */
  extractionMethod: 'native' | 'ocr' | 'hybrid';

  /** Detected layout type */
  layout?: 'single-column' | 'multi-column' | 'complex';

  /** Quality assessment of extracted text (0.0 - 1.0) */
  quality: number;

  /** Total character count */
  characterCount: number;

  /** Percentage of Tibetan characters (0-100) */
  tibetanPercentage: number;

  /** Whether Unicode normalization was applied */
  normalized: boolean;

  /** Any warnings encountered during extraction */
  warnings?: string[];
}

// ============================================================================
// QUALITY DOMAIN TYPES
// ============================================================================

/**
 * Comprehensive quality score for a translation.
 *
 * @example
 * ```typescript
 * const score: QualityScore = {
 *   overall: 0.88,
 *   confidence: 0.92,
 *   format: 0.95,
 *   preservation: 0.90
 * };
 * ```
 */
export interface QualityScore {
  /**
   * Overall quality score (0.0 - 1.0)
   * Weighted combination of other scores
   */
  overall: number;

  /**
   * Model's confidence in translation (0.0 - 1.0)
   * From AI model or consensus builder
   */
  confidence: number;

  /**
   * Format compliance score (0.0 - 1.0)
   * Measures adherence to format: "English (བོད་ཡིག)."
   */
  format: number;

  /**
   * Tibetan preservation score (0.0 - 1.0)
   * Measures how well original Tibetan is preserved
   */
  preservation: number;
}

/**
 * Result of validation checks.
 *
 * @example
 * ```typescript
 * const validation: ValidationResult = {
 *   isValid: true,
 *   errors: [],
 *   warnings: ['Text contains less than 70% Tibetan characters']
 * };
 * ```
 */
export interface ValidationResult {
  /** Whether validation passed */
  isValid: boolean;

  /** Critical errors that prevent processing */
  errors: string[];

  /** Non-critical warnings for user awareness */
  warnings: string[];
}

// ============================================================================
// CONFIGURATION TYPES
// ============================================================================

/**
 * Main configuration object for the translation system.
 *
 * @example
 * ```typescript
 * const config: TranslationConfig = {
 *   models: [
 *     {
 *       provider: 'gemini',
 *       model: 'gemini-2.0-flash',
 *       apiKey: process.env.GEMINI_API_KEY!,
 *       priority: 1
 *     }
 *   ],
 *   quality: {
 *     minConfidence: 0.7,
 *     requireFormat: true,
 *     minPreservation: 0.8
 *   },
 *   retry: {
 *     maxRetries: 3,
 *     baseDelay: 1000
 *   },
 *   cache: {
 *     enabled: true,
 *     ttl: 3600
 *   }
 * };
 * ```
 */
export interface TranslationConfig {
  /** Array of AI model configurations (ordered by priority) */
  models: ModelConfig[];

  /** Quality gates and thresholds */
  quality: QualityConfig;

  /** Retry and error recovery settings */
  retry: RetryConfig;

  /** Cache configuration */
  cache: CacheConfig;

  /** Chunking configuration */
  chunking?: ChunkingConfig;
}

/**
 * Configuration for a single AI model.
 */
export interface ModelConfig {
  /** Provider name */
  provider: 'gemini' | 'openai' | 'anthropic';

  /** Specific model identifier */
  model: string;

  /** API key for authentication */
  apiKey: string;

  /**
   * Priority for fallback ordering (1 = highest)
   * Lower number = tried first
   */
  priority: number;

  /** Optional model-specific settings */
  options?: {
    /** Default temperature */
    temperature?: number;
    /** Default max tokens */
    maxTokens?: number;
    /** Custom endpoint URL */
    endpoint?: string;
  };
}

/**
 * Quality control configuration.
 */
export interface QualityConfig {
  /**
   * Minimum confidence threshold (0.0 - 1.0)
   * Translations below this are rejected or flagged
   */
  minConfidence: number;

  /**
   * Whether to enforce format requirements
   * Format: "English (བོད་ཡིག)."
   */
  requireFormat: boolean;

  /**
   * Minimum Tibetan preservation score (0.0 - 1.0)
   */
  minPreservation: number;

  /**
   * Minimum percentage of Tibetan characters in input (0-100)
   */
  minTibetanPercentage?: number;
}

/**
 * Retry and error recovery configuration.
 */
export interface RetryConfig {
  /** Maximum number of retry attempts */
  maxRetries: number;

  /** Base delay in milliseconds before first retry */
  baseDelay: number;

  /** Maximum delay in milliseconds (for exponential backoff) */
  maxDelay?: number;

  /**
   * Multiplier for exponential backoff (default: 2)
   * delay = baseDelay * (backoffMultiplier ^ attemptNumber)
   */
  backoffMultiplier?: number;

  /** Whether to add random jitter to delays (default: true) */
  jitter?: boolean;

  /** Enable exponential backoff (default: true) */
  exponentialBackoff?: boolean;
}

/**
 * Cache configuration.
 */
export interface CacheConfig {
  /** Whether caching is enabled */
  enabled: boolean;

  /** Default TTL in seconds */
  ttl: number;

  /** Maximum cache size for in-memory cache (number of items) */
  maxSize?: number;

  /** Redis connection URL (for L2 cache) */
  redisUrl?: string;
}

/**
 * Text chunking configuration.
 */
export interface ChunkingConfig {
  /** Maximum tokens per chunk */
  maxTokens: number;

  /** Number of sentences to overlap between chunks */
  overlapSentences?: number;

  /**
   * Strategy for sentence boundary detection
   * - 'tibetan': Use Tibetan punctuation (།, ༎)
   * - 'mixed': Handle both Tibetan and English
   */
  strategy?: 'tibetan' | 'mixed';
}

/**
 * Database connection configuration.
 */
export interface DatabaseConfig {
  /** Database URL (PostgreSQL or SQLite) */
  url: string;

  /** Maximum number of connections in pool */
  maxConnections?: number;

  /** Connection timeout in milliseconds */
  connectionTimeout?: number;

  /** Whether to run migrations on startup */
  runMigrations?: boolean;
}

/**
 * Monitoring and metrics configuration.
 */
export interface MonitoringConfig {
  /** Whether monitoring is enabled */
  enabled: boolean;

  /** Metrics flush interval in milliseconds */
  flushInterval?: number;

  /** Maximum metrics buffer size before forced flush */
  maxBufferSize?: number;
}

// ============================================================================
// ERROR TYPES
// ============================================================================

/**
 * Enumeration of error codes for the translation system.
 *
 * These codes enable:
 * - Consistent error handling
 * - Automated retry logic
 * - Better error reporting
 * - Debugging and monitoring
 */
export enum ErrorCode {
  // Validation Errors (4xx equivalent)
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  INVALID_INPUT = 'INVALID_INPUT',
  INVALID_UNICODE = 'INVALID_UNICODE',
  TEXT_TOO_LONG = 'TEXT_TOO_LONG',
  TEXT_TOO_SHORT = 'TEXT_TOO_SHORT',
  INSUFFICIENT_TIBETAN = 'INSUFFICIENT_TIBETAN',

  // API and Network Errors (5xx equivalent)
  RATE_LIMIT = 'RATE_LIMIT',
  QUOTA_EXCEEDED = 'QUOTA_EXCEEDED',
  NETWORK_ERROR = 'NETWORK_ERROR',
  TIMEOUT = 'TIMEOUT',
  API_UNAVAILABLE = 'API_UNAVAILABLE',
  API_ERROR = 'API_ERROR',

  // Translation Errors
  TRANSLATION_FAILED = 'TRANSLATION_FAILED',
  FORMAT_ERROR = 'FORMAT_ERROR',
  QUALITY_THRESHOLD_NOT_MET = 'QUALITY_THRESHOLD_NOT_MET',
  ALL_PROVIDERS_FAILED = 'ALL_PROVIDERS_FAILED',

  // Storage Errors
  STORAGE_ERROR = 'STORAGE_ERROR',
  NOT_FOUND = 'NOT_FOUND',
  DUPLICATE_KEY = 'DUPLICATE_KEY',

  // Cache Errors
  CACHE_ERROR = 'CACHE_ERROR',

  // System Errors
  CONFIGURATION_ERROR = 'CONFIGURATION_ERROR',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  NOT_IMPLEMENTED = 'NOT_IMPLEMENTED',
}

/**
 * Custom error class for translation system errors.
 *
 * Extends native Error with:
 * - Structured error codes
 * - Error cause chaining
 * - Additional context data
 *
 * @example
 * ```typescript
 * throw new TranslationError(
 *   ErrorCode.INSUFFICIENT_TIBETAN,
 *   'Text must contain at least 50% Tibetan characters',
 *   { percentage: 35 }
 * );
 * ```
 *
 * @example
 * ```typescript
 * try {
 *   await callAPI();
 * } catch (error) {
 *   throw new TranslationError(
 *     ErrorCode.API_ERROR,
 *     'Failed to call translation API',
 *     undefined,
 *     error
 *   );
 * }
 * ```
 */
export class TranslationError extends Error {
  /**
   * Structured error code for programmatic handling
   */
  public readonly code: ErrorCode;

  /**
   * Original error that caused this error (if any)
   */
  public readonly cause?: Error;

  /**
   * Additional context data for debugging
   */
  public readonly context?: any;

  /**
   * Timestamp when error occurred
   */
  public readonly timestamp: number;

  constructor(
    code: ErrorCode,
    message: string,
    context?: any,
    cause?: Error
  ) {
    super(message);
    this.name = 'TranslationError';
    this.code = code;
    this.context = context;
    this.cause = cause;
    this.timestamp = Date.now();

    // Maintains proper stack trace for where error was thrown
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, TranslationError);
    }
  }

  /**
   * Determine if this error is transient and should be retried.
   *
   * Transient errors:
   * - Network timeouts
   * - Rate limits
   * - Temporary API unavailability
   *
   * Non-transient errors:
   * - Validation errors
   * - Invalid configuration
   * - Authentication failures
   */
  isTransient(): boolean {
    return [
      ErrorCode.RATE_LIMIT,
      ErrorCode.NETWORK_ERROR,
      ErrorCode.TIMEOUT,
      ErrorCode.API_UNAVAILABLE,
    ].includes(this.code);
  }

  /**
   * Convert error to JSON for logging/transmission.
   */
  toJSON(): object {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      context: this.context,
      timestamp: this.timestamp,
      stack: this.stack,
      cause: this.cause ? {
        name: this.cause.name,
        message: this.cause.message,
      } : undefined,
    };
  }
}

// ============================================================================
// UTILITY TYPES
// ============================================================================

/**
 * Type guard to check if a value is a TranslationError.
 */
export function isTranslationError(error: any): error is TranslationError {
  return error instanceof TranslationError;
}

/**
 * Type for async functions with retry support.
 */
export type RetryableFunction<T> = () => Promise<T>;

/**
 * Time range for metrics queries.
 */
export interface TimeRange {
  start: number;
  end: number;
}

/**
 * Generic paginated response.
 */
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasNext: boolean;
}

// ============================================================================
// ADDITIONAL CONFIGURATION TYPES (for ConfigService)
// ============================================================================

/**
 * Server configuration.
 */
export interface ServerConfig {
  /** Server port */
  port: number;
  /** Environment (development, production, test) */
  environment: 'development' | 'production' | 'test';
  /** Enable CORS */
  enableCors: boolean;
  /** Enable request logging */
  enableLogging: boolean;
  /** Request timeout in milliseconds */
  requestTimeout: number;
  /** Maximum request body size */
  maxBodySize: string;
}

/**
 * Translation configuration (extended).
 */
export interface TranslationConfigExtended {
  /** Array of AI model configurations (ordered by priority) */
  models: ModelConfig[];
  /** Maximum tokens per request */
  maxTokens: number;
  /** Default temperature */
  temperature: number;
  /** Quality threshold (0-1) */
  qualityThreshold: number;
  /** Enable parallel processing */
  enableParallel: boolean;
  /** Maximum parallel requests */
  maxParallelRequests: number;
  /** Retry configuration */
  retry: RetryConfig;
}

/**
 * Database configuration (extended).
 */
export interface DatabaseConfigExtended {
  /** Database connection URL (PostgreSQL or SQLite) */
  url: string;
  /** Database type */
  type: 'postgresql' | 'sqlite';
  /** Maximum number of connections in pool */
  maxConnections: number;
  /** Enable SSL for PostgreSQL */
  ssl: boolean;
  /** Connection timeout in milliseconds */
  connectionTimeout: number;
  /** Enable query logging */
  enableLogging: boolean;
}

/**
 * Cache configuration (extended).
 */
export interface CacheConfigExtended {
  /** Enable caching */
  enabled: boolean;
  /** Cache type */
  type: 'memory' | 'redis';
  /** Maximum cache size (for memory cache) */
  maxSize: number;
  /** Default TTL in seconds */
  defaultTTL: number;
  /** Redis connection URL (if type is 'redis') */
  redisUrl?: string;
}

/**
 * Monitoring configuration (extended).
 */
export interface MonitoringConfigExtended {
  /** Enable monitoring */
  enabled: boolean;
  /** Metrics collection interval in milliseconds */
  metricsInterval: number;
  /** Enable performance tracking */
  enablePerformance: boolean;
  /** Enable quality tracking */
  enableQuality: boolean;
  /** Enable error tracking */
  enableErrors: boolean;
  /** Buffer size for metrics before flush */
  bufferSize: number;
}

/**
 * Complete application configuration.
 */
export interface AppConfig {
  server: ServerConfig;
  translation: TranslationConfigExtended;
  database: DatabaseConfigExtended;
  cache: CacheConfigExtended;
  monitoring: MonitoringConfigExtended;
}
