/**
 * Error Classification System
 *
 * Classifies errors into categories with appropriate recovery strategies.
 * Determines whether errors should be retried, fixed, or failed immediately.
 *
 * @author Translation Service Team
 */

/**
 * Error type categories with recovery guidance
 */
export enum ErrorType {
  // Transient errors (should retry with backoff)
  RATE_LIMIT = 'RATE_LIMIT',           // API rate limit exceeded
  NETWORK_ERROR = 'NETWORK_ERROR',     // Network connectivity issues
  TIMEOUT = 'TIMEOUT',                 // Request timeout
  API_UNAVAILABLE = 'API_UNAVAILABLE', // Service temporarily unavailable
  SERVICE_OVERLOADED = 'SERVICE_OVERLOADED', // Service is overloaded

  // Validation errors (fix input and fail fast)
  INVALID_INPUT = 'INVALID_INPUT',     // Invalid input data
  INVALID_FORMAT = 'INVALID_FORMAT',   // Invalid data format
  EMPTY_TEXT = 'EMPTY_TEXT',           // Empty or missing text

  // Processing errors (try fallback strategies)
  TRANSLATION_FAILED = 'TRANSLATION_FAILED', // Translation generation failed
  QUALITY_TOO_LOW = 'QUALITY_TOO_LOW',       // Quality below threshold
  CONTENT_POLICY_VIOLATION = 'CONTENT_POLICY_VIOLATION', // Content policy violation

  // Fatal errors (fail immediately, no retry)
  INVALID_API_KEY = 'INVALID_API_KEY',       // Invalid or expired API key
  UNSUPPORTED_FILE = 'UNSUPPORTED_FILE',     // Unsupported file type
  DATABASE_ERROR = 'DATABASE_ERROR',         // Database operation failed
  CONFIGURATION_ERROR = 'CONFIGURATION_ERROR', // Configuration error
  CANCELLATION = 'CANCELLATION',             // User cancelled operation

  // Unknown errors (classify based on inspection)
  UNKNOWN = 'UNKNOWN'
}

/**
 * Recovery action to take for an error type
 */
export enum RecoveryAction {
  RETRY = 'RETRY',         // Retry with exponential backoff
  FALLBACK = 'FALLBACK',   // Try fallback strategy
  FIX_INPUT = 'FIX_INPUT', // Fix input and retry
  FAIL = 'FAIL'            // Fail immediately, no recovery
}

/**
 * Recovery strategy configuration for each error type
 */
export interface RecoveryStrategy {
  errorType: ErrorType;
  action: RecoveryAction;
  maxRetries: number;           // Maximum retry attempts
  baseDelayMs: number;          // Base delay in milliseconds
  backoffMultiplier: number;    // Exponential backoff multiplier
  maxDelayMs: number;           // Maximum delay between retries
  useFallback: boolean;         // Whether to use fallback strategies
  isFatal: boolean;             // Whether error is fatal
  description: string;          // Human-readable description
}

/**
 * Error classification result
 */
export interface ErrorClassification {
  errorType: ErrorType;
  recoveryStrategy: RecoveryStrategy;
  originalError: Error;
  isRetryable: boolean;
  isFatal: boolean;
  recommendedAction: RecoveryAction;
  metadata?: {
    httpStatus?: number;
    errorCode?: string;
    retryAfter?: number;
    details?: any;
  };
}

/**
 * Default recovery strategies for each error type
 */
const RECOVERY_STRATEGIES: Record<ErrorType, RecoveryStrategy> = {
  // Transient errors - aggressive retry
  [ErrorType.RATE_LIMIT]: {
    errorType: ErrorType.RATE_LIMIT,
    action: RecoveryAction.RETRY,
    maxRetries: 5,
    baseDelayMs: 2000,
    backoffMultiplier: 2,
    maxDelayMs: 60000,
    useFallback: true,
    isFatal: false,
    description: 'API rate limit exceeded, retry with backoff'
  },
  [ErrorType.NETWORK_ERROR]: {
    errorType: ErrorType.NETWORK_ERROR,
    action: RecoveryAction.RETRY,
    maxRetries: 3,
    baseDelayMs: 1000,
    backoffMultiplier: 2,
    maxDelayMs: 30000,
    useFallback: false,
    isFatal: false,
    description: 'Network error, retry with exponential backoff'
  },
  [ErrorType.TIMEOUT]: {
    errorType: ErrorType.TIMEOUT,
    action: RecoveryAction.RETRY,
    maxRetries: 2,
    baseDelayMs: 2000,
    backoffMultiplier: 2,
    maxDelayMs: 30000,
    useFallback: true,
    isFatal: false,
    description: 'Request timeout, retry with increased timeout'
  },
  [ErrorType.API_UNAVAILABLE]: {
    errorType: ErrorType.API_UNAVAILABLE,
    action: RecoveryAction.RETRY,
    maxRetries: 3,
    baseDelayMs: 5000,
    backoffMultiplier: 2,
    maxDelayMs: 60000,
    useFallback: true,
    isFatal: false,
    description: 'API unavailable, retry with backoff or use fallback'
  },
  [ErrorType.SERVICE_OVERLOADED]: {
    errorType: ErrorType.SERVICE_OVERLOADED,
    action: RecoveryAction.RETRY,
    maxRetries: 4,
    baseDelayMs: 3000,
    backoffMultiplier: 2,
    maxDelayMs: 60000,
    useFallback: true,
    isFatal: false,
    description: 'Service overloaded, retry with longer delays'
  },

  // Validation errors - fail fast with clear message
  [ErrorType.INVALID_INPUT]: {
    errorType: ErrorType.INVALID_INPUT,
    action: RecoveryAction.FIX_INPUT,
    maxRetries: 0,
    baseDelayMs: 0,
    backoffMultiplier: 1,
    maxDelayMs: 0,
    useFallback: false,
    isFatal: true,
    description: 'Invalid input, cannot proceed without fix'
  },
  [ErrorType.INVALID_FORMAT]: {
    errorType: ErrorType.INVALID_FORMAT,
    action: RecoveryAction.FIX_INPUT,
    maxRetries: 0,
    baseDelayMs: 0,
    backoffMultiplier: 1,
    maxDelayMs: 0,
    useFallback: false,
    isFatal: true,
    description: 'Invalid format, fix and resubmit'
  },
  [ErrorType.EMPTY_TEXT]: {
    errorType: ErrorType.EMPTY_TEXT,
    action: RecoveryAction.FAIL,
    maxRetries: 0,
    baseDelayMs: 0,
    backoffMultiplier: 1,
    maxDelayMs: 0,
    useFallback: false,
    isFatal: true,
    description: 'Empty text, nothing to translate'
  },

  // Processing errors - try fallback strategies
  [ErrorType.TRANSLATION_FAILED]: {
    errorType: ErrorType.TRANSLATION_FAILED,
    action: RecoveryAction.FALLBACK,
    maxRetries: 2,
    baseDelayMs: 1000,
    backoffMultiplier: 1.5,
    maxDelayMs: 10000,
    useFallback: true,
    isFatal: false,
    description: 'Translation failed, try simpler prompt or alternative model'
  },
  [ErrorType.QUALITY_TOO_LOW]: {
    errorType: ErrorType.QUALITY_TOO_LOW,
    action: RecoveryAction.FALLBACK,
    maxRetries: 1,
    baseDelayMs: 500,
    backoffMultiplier: 1,
    maxDelayMs: 5000,
    useFallback: true,
    isFatal: false,
    description: 'Quality too low, try with different approach'
  },
  [ErrorType.CONTENT_POLICY_VIOLATION]: {
    errorType: ErrorType.CONTENT_POLICY_VIOLATION,
    action: RecoveryAction.FALLBACK,
    maxRetries: 1,
    baseDelayMs: 0,
    backoffMultiplier: 1,
    maxDelayMs: 0,
    useFallback: true,
    isFatal: false,
    description: 'Content policy violation, try alternative model'
  },

  // Fatal errors - no retry
  [ErrorType.INVALID_API_KEY]: {
    errorType: ErrorType.INVALID_API_KEY,
    action: RecoveryAction.FAIL,
    maxRetries: 0,
    baseDelayMs: 0,
    backoffMultiplier: 1,
    maxDelayMs: 0,
    useFallback: false,
    isFatal: true,
    description: 'Invalid API key, check configuration'
  },
  [ErrorType.UNSUPPORTED_FILE]: {
    errorType: ErrorType.UNSUPPORTED_FILE,
    action: RecoveryAction.FAIL,
    maxRetries: 0,
    baseDelayMs: 0,
    backoffMultiplier: 1,
    maxDelayMs: 0,
    useFallback: false,
    isFatal: true,
    description: 'Unsupported file type'
  },
  [ErrorType.DATABASE_ERROR]: {
    errorType: ErrorType.DATABASE_ERROR,
    action: RecoveryAction.RETRY,
    maxRetries: 2,
    baseDelayMs: 1000,
    backoffMultiplier: 2,
    maxDelayMs: 10000,
    useFallback: false,
    isFatal: false,
    description: 'Database error, retry limited times'
  },
  [ErrorType.CONFIGURATION_ERROR]: {
    errorType: ErrorType.CONFIGURATION_ERROR,
    action: RecoveryAction.FAIL,
    maxRetries: 0,
    baseDelayMs: 0,
    backoffMultiplier: 1,
    maxDelayMs: 0,
    useFallback: false,
    isFatal: true,
    description: 'Configuration error, fix configuration'
  },
  [ErrorType.CANCELLATION]: {
    errorType: ErrorType.CANCELLATION,
    action: RecoveryAction.FAIL,
    maxRetries: 0,
    baseDelayMs: 0,
    backoffMultiplier: 1,
    maxDelayMs: 0,
    useFallback: false,
    isFatal: true,
    description: 'Operation cancelled by user'
  },

  // Unknown errors - conservative retry
  [ErrorType.UNKNOWN]: {
    errorType: ErrorType.UNKNOWN,
    action: RecoveryAction.RETRY,
    maxRetries: 1,
    baseDelayMs: 2000,
    backoffMultiplier: 2,
    maxDelayMs: 10000,
    useFallback: false,
    isFatal: false,
    description: 'Unknown error, limited retry'
  }
};

/**
 * ErrorClassifier - Classifies errors and determines recovery strategies
 */
export class ErrorClassifier {
  /**
   * Classify an error and determine recovery strategy
   */
  public static classifyError(error: Error | any): ErrorClassification {
    const errorType = this.determineErrorType(error);
    const recoveryStrategy = RECOVERY_STRATEGIES[errorType];

    const classification: ErrorClassification = {
      errorType,
      recoveryStrategy,
      originalError: error,
      isRetryable: recoveryStrategy.maxRetries > 0,
      isFatal: recoveryStrategy.isFatal,
      recommendedAction: recoveryStrategy.action,
      metadata: this.extractErrorMetadata(error)
    };

    return classification;
  }

  /**
   * Determine error type from error object
   */
  private static determineErrorType(error: Error | any): ErrorType {
    const errorMessage = error?.message?.toLowerCase() || '';
    const errorCode = error?.code?.toUpperCase() || '';
    const statusCode = error?.status || error?.statusCode;

    // Check for cancellation
    if (error?.name === 'AbortError' || errorMessage.includes('abort') || errorMessage.includes('cancel')) {
      return ErrorType.CANCELLATION;
    }

    // Check for rate limiting
    if (statusCode === 429 ||
        errorMessage.includes('rate limit') ||
        errorMessage.includes('quota exceeded') ||
        errorMessage.includes('too many requests')) {
      return ErrorType.RATE_LIMIT;
    }

    // Check for API key issues
    if (statusCode === 401 ||
        statusCode === 403 ||
        errorMessage.includes('api key') ||
        errorMessage.includes('unauthorized') ||
        errorMessage.includes('authentication')) {
      return ErrorType.INVALID_API_KEY;
    }

    // Check for network errors
    if (errorCode.includes('NETWORK') ||
        errorCode === 'ECONNREFUSED' ||
        errorCode === 'ENOTFOUND' ||
        errorCode === 'ECONNRESET' ||
        errorMessage.includes('network') ||
        errorMessage.includes('connection refused') ||
        errorMessage.includes('dns')) {
      return ErrorType.NETWORK_ERROR;
    }

    // Check for timeout
    if (errorCode === 'ETIMEDOUT' ||
        errorMessage.includes('timeout') ||
        errorMessage.includes('timed out')) {
      return ErrorType.TIMEOUT;
    }

    // Check for service unavailability
    if (statusCode === 503 ||
        statusCode === 502 ||
        statusCode === 504 ||
        errorMessage.includes('unavailable') ||
        errorMessage.includes('service down')) {
      return ErrorType.API_UNAVAILABLE;
    }

    // Check for overload
    if (statusCode === 503 ||
        errorMessage.includes('overload') ||
        errorMessage.includes('capacity')) {
      return ErrorType.SERVICE_OVERLOADED;
    }

    // Check for validation errors
    if (statusCode === 400 ||
        errorCode === 'VALIDATION_ERROR' ||
        errorCode === 'INPUT_VALIDATION_ERROR' ||
        errorMessage.includes('validation') ||
        errorMessage.includes('invalid input')) {
      return ErrorType.INVALID_INPUT;
    }

    // Check for format errors
    if (errorMessage.includes('format') ||
        errorMessage.includes('parse') ||
        errorMessage.includes('invalid format')) {
      return ErrorType.INVALID_FORMAT;
    }

    // Check for empty text
    if (errorMessage.includes('empty') ||
        errorMessage.includes('no text') ||
        errorMessage.includes('missing text')) {
      return ErrorType.EMPTY_TEXT;
    }

    // Check for translation failures
    if (errorMessage.includes('translation failed') ||
        errorMessage.includes('generation failed') ||
        errorCode === 'TRANSLATION_ERROR') {
      return ErrorType.TRANSLATION_FAILED;
    }

    // Check for quality issues
    if (errorMessage.includes('quality') ||
        errorMessage.includes('confidence too low')) {
      return ErrorType.QUALITY_TOO_LOW;
    }

    // Check for content policy
    if (errorMessage.includes('content policy') ||
        errorMessage.includes('safety') ||
        errorMessage.includes('blocked')) {
      return ErrorType.CONTENT_POLICY_VIOLATION;
    }

    // Check for database errors
    if (errorMessage.includes('database') ||
        errorMessage.includes('sql') ||
        errorCode.includes('DB_')) {
      return ErrorType.DATABASE_ERROR;
    }

    // Check for unsupported file
    if (errorMessage.includes('unsupported file') ||
        errorMessage.includes('file type not supported')) {
      return ErrorType.UNSUPPORTED_FILE;
    }

    // Check for configuration errors
    if (errorMessage.includes('configuration') ||
        errorMessage.includes('config') ||
        errorMessage.includes('environment')) {
      return ErrorType.CONFIGURATION_ERROR;
    }

    // Default to unknown
    return ErrorType.UNKNOWN;
  }

  /**
   * Extract metadata from error object
   */
  private static extractErrorMetadata(error: any): ErrorClassification['metadata'] {
    const metadata: ErrorClassification['metadata'] = {};

    // HTTP status code
    if (error?.status || error?.statusCode) {
      metadata.httpStatus = error.status || error.statusCode;
    }

    // Error code
    if (error?.code) {
      metadata.errorCode = error.code;
    }

    // Retry-After header for rate limiting
    if (error?.headers?.['retry-after']) {
      metadata.retryAfter = parseInt(error.headers['retry-after'], 10) * 1000;
    }

    // Additional details
    if (error?.details) {
      metadata.details = error.details;
    }

    return metadata;
  }

  /**
   * Get recovery strategy for a specific error type
   */
  public static getRecoveryStrategy(errorType: ErrorType): RecoveryStrategy {
    return RECOVERY_STRATEGIES[errorType];
  }

  /**
   * Check if error is retryable
   */
  public static isRetryable(error: Error | any): boolean {
    const classification = this.classifyError(error);
    return classification.isRetryable;
  }

  /**
   * Check if error is fatal
   */
  public static isFatal(error: Error | any): boolean {
    const classification = this.classifyError(error);
    return classification.isFatal;
  }

  /**
   * Get recommended delay before retry
   */
  public static getRetryDelay(errorType: ErrorType, attemptNumber: number): number {
    const strategy = RECOVERY_STRATEGIES[errorType];
    const exponentialDelay = strategy.baseDelayMs * Math.pow(strategy.backoffMultiplier, attemptNumber - 1);

    // Add jitter (±20% randomization) to prevent thundering herd
    const jitter = exponentialDelay * 0.2 * (Math.random() * 2 - 1);
    const delayWithJitter = exponentialDelay + jitter;

    // Cap at max delay
    return Math.min(delayWithJitter, strategy.maxDelayMs);
  }
}
