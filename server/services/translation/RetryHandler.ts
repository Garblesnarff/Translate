/**
 * Retry Handler
 *
 * Handles retry logic with exponential backoff and circuit breaker pattern.
 * Provides intelligent retry mechanisms for transient failures.
 *
 * @author Translation Service Team
 */

import { ErrorClassifier, ErrorType, ErrorClassification } from '../../errors/ErrorClassifier';

/**
 * Retry options
 */
export interface RetryOptions {
  maxRetries?: number;           // Override max retries from strategy
  baseDelayMs?: number;          // Override base delay
  backoffMultiplier?: number;    // Override backoff multiplier
  maxDelayMs?: number;           // Override max delay
  onRetry?: (error: Error, attemptNumber: number, delay: number) => void;  // Callback on retry
  abortSignal?: AbortSignal;     // Abort signal for cancellation
}

/**
 * Retry result
 */
export interface RetryResult<T> {
  success: boolean;
  result?: T;
  error?: Error;
  attempts: number;
  totalDelay: number;
  classification?: ErrorClassification;
}

/**
 * Circuit breaker state
 */
enum CircuitState {
  CLOSED = 'CLOSED',     // Normal operation
  OPEN = 'OPEN',         // Failing, reject immediately
  HALF_OPEN = 'HALF_OPEN' // Testing if service recovered
}

/**
 * Circuit breaker configuration
 */
interface CircuitBreakerConfig {
  failureThreshold: number;      // Number of failures before opening
  successThreshold: number;      // Number of successes to close
  timeout: number;               // Time in ms before attempting recovery
}

/**
 * Circuit breaker for preventing repeated failures
 */
class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount: number = 0;
  private successCount: number = 0;
  private lastFailureTime: number = 0;
  private config: CircuitBreakerConfig;

  constructor(config: CircuitBreakerConfig) {
    this.config = config;
  }

  /**
   * Check if circuit breaker allows request
   */
  public canAttempt(): boolean {
    if (this.state === CircuitState.CLOSED) {
      return true;
    }

    if (this.state === CircuitState.OPEN) {
      // Check if timeout has passed
      const timeSinceFailure = Date.now() - this.lastFailureTime;
      if (timeSinceFailure >= this.config.timeout) {
        console.log('[CircuitBreaker] Entering HALF_OPEN state after timeout');
        this.state = CircuitState.HALF_OPEN;
        return true;
      }
      return false;
    }

    // HALF_OPEN state - allow limited requests
    return true;
  }

  /**
   * Record successful request
   */
  public recordSuccess(): void {
    this.failureCount = 0;

    if (this.state === CircuitState.HALF_OPEN) {
      this.successCount++;
      if (this.successCount >= this.config.successThreshold) {
        console.log('[CircuitBreaker] Closing circuit after successful recovery');
        this.state = CircuitState.CLOSED;
        this.successCount = 0;
      }
    }
  }

  /**
   * Record failed request
   */
  public recordFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    this.successCount = 0;

    if (this.state === CircuitState.HALF_OPEN) {
      console.log('[CircuitBreaker] Opening circuit after failure in HALF_OPEN state');
      this.state = CircuitState.OPEN;
    } else if (this.failureCount >= this.config.failureThreshold) {
      console.log(`[CircuitBreaker] Opening circuit after ${this.failureCount} consecutive failures`);
      this.state = CircuitState.OPEN;
    }
  }

  /**
   * Get current state
   */
  public getState(): CircuitState {
    return this.state;
  }

  /**
   * Reset circuit breaker
   */
  public reset(): void {
    this.state = CircuitState.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = 0;
  }
}

/**
 * RetryHandler - Handles intelligent retry logic with exponential backoff
 */
export class RetryHandler {
  private circuitBreakers: Map<string, CircuitBreaker> = new Map();

  private readonly defaultCircuitBreakerConfig: CircuitBreakerConfig = {
    failureThreshold: 5,   // Open after 5 consecutive failures
    successThreshold: 2,   // Close after 2 consecutive successes
    timeout: 60000         // Try recovery after 60 seconds
  };

  /**
   * Execute function with retry logic
   */
  public async executeWithRetry<T>(
    fn: () => Promise<T>,
    options: RetryOptions = {},
    context?: string
  ): Promise<T> {
    const circuitBreaker = this.getCircuitBreaker(context || 'default');
    let lastError: Error | undefined;
    let totalDelay = 0;
    let attemptNumber = 0;

    // Get initial classification to determine strategy
    let classification: ErrorClassification | undefined;

    while (true) {
      attemptNumber++;

      // Check circuit breaker
      if (!circuitBreaker.canAttempt()) {
        const error = new Error('Circuit breaker is open, service unavailable');
        (error as any).code = 'CIRCUIT_OPEN';
        throw error;
      }

      // Check for cancellation
      if (options.abortSignal?.aborted) {
        const error = new Error('Operation cancelled');
        (error as any).name = 'AbortError';
        throw error;
      }

      try {
        console.log(`[RetryHandler] Attempt ${attemptNumber}${context ? ` (${context})` : ''}`);
        const result = await fn();

        // Success - record and return
        circuitBreaker.recordSuccess();
        console.log(`[RetryHandler] Success on attempt ${attemptNumber}${context ? ` (${context})` : ''}`);
        return result;

      } catch (error) {
        lastError = error as Error;
        classification = ErrorClassifier.classifyError(error);

        console.error(`[RetryHandler] Attempt ${attemptNumber} failed:`, {
          errorType: classification.errorType,
          message: lastError.message,
          isRetryable: classification.isRetryable
        });

        // Record failure in circuit breaker
        circuitBreaker.recordFailure();

        // Check if error is fatal or non-retryable
        if (classification.isFatal || !classification.isRetryable) {
          console.log(`[RetryHandler] Error is ${classification.isFatal ? 'fatal' : 'non-retryable'}, not retrying`);
          throw lastError;
        }

        // Determine max retries
        const maxRetries = options.maxRetries ?? classification.recoveryStrategy.maxRetries;

        // Check if we've exhausted retries
        if (attemptNumber > maxRetries) {
          console.log(`[RetryHandler] Exhausted all ${maxRetries} retry attempts`);
          throw lastError;
        }

        // Calculate delay
        const delay = this.calculateDelay(
          classification.errorType,
          attemptNumber,
          options,
          classification.metadata?.retryAfter
        );

        totalDelay += delay;

        console.log(`[RetryHandler] Retrying in ${delay}ms (attempt ${attemptNumber}/${maxRetries})`);

        // Call retry callback if provided
        if (options.onRetry) {
          options.onRetry(lastError, attemptNumber, delay);
        }

        // Wait before retry
        await this.delay(delay, options.abortSignal);
      }
    }
  }

  /**
   * Calculate delay before retry
   */
  private calculateDelay(
    errorType: ErrorType,
    attemptNumber: number,
    options: RetryOptions,
    retryAfter?: number
  ): number {
    // Use server-provided retry-after if available
    if (retryAfter) {
      return retryAfter;
    }

    // Use custom options or default strategy
    const strategy = ErrorClassifier.getRecoveryStrategy(errorType);
    const baseDelay = options.baseDelayMs ?? strategy.baseDelayMs;
    const multiplier = options.backoffMultiplier ?? strategy.backoffMultiplier;
    const maxDelay = options.maxDelayMs ?? strategy.maxDelayMs;

    // Exponential backoff
    const exponentialDelay = baseDelay * Math.pow(multiplier, attemptNumber - 1);

    // Add jitter (±20% randomization) to prevent thundering herd
    const jitter = exponentialDelay * 0.2 * (Math.random() * 2 - 1);
    const delayWithJitter = exponentialDelay + jitter;

    // Cap at max delay
    return Math.min(Math.max(delayWithJitter, 0), maxDelay);
  }

  /**
   * Delay execution with cancellation support
   */
  private delay(ms: number, abortSignal?: AbortSignal): Promise<void> {
    return new Promise((resolve, reject) => {
      if (abortSignal?.aborted) {
        reject(new Error('Operation cancelled'));
        return;
      }

      const timeout = setTimeout(() => {
        cleanup();
        resolve();
      }, ms);

      const cleanup = () => {
        clearTimeout(timeout);
        abortSignal?.removeEventListener('abort', onAbort);
      };

      const onAbort = () => {
        cleanup();
        const error = new Error('Operation cancelled');
        (error as any).name = 'AbortError';
        reject(error);
      };

      abortSignal?.addEventListener('abort', onAbort);
    });
  }

  /**
   * Get or create circuit breaker for context
   */
  private getCircuitBreaker(context: string): CircuitBreaker {
    if (!this.circuitBreakers.has(context)) {
      this.circuitBreakers.set(
        context,
        new CircuitBreaker(this.defaultCircuitBreakerConfig)
      );
    }
    return this.circuitBreakers.get(context)!;
  }

  /**
   * Reset circuit breaker for context
   */
  public resetCircuitBreaker(context: string = 'default'): void {
    const breaker = this.circuitBreakers.get(context);
    if (breaker) {
      breaker.reset();
      console.log(`[RetryHandler] Reset circuit breaker for ${context}`);
    }
  }

  /**
   * Get circuit breaker state
   */
  public getCircuitBreakerState(context: string = 'default'): CircuitState {
    const breaker = this.circuitBreakers.get(context);
    return breaker?.getState() ?? CircuitState.CLOSED;
  }

  /**
   * Reset all circuit breakers
   */
  public resetAllCircuitBreakers(): void {
    for (const [context, breaker] of this.circuitBreakers.entries()) {
      breaker.reset();
      console.log(`[RetryHandler] Reset circuit breaker for ${context}`);
    }
  }
}

// Export singleton instance
export const retryHandler = new RetryHandler();
