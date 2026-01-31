/**
 * Retry Handler (Enhanced Version for Phase 2.3)
 *
 * Provides intelligent retry logic with exponential backoff, jitter, and circuit breaker integration.
 * Smarter than provider-level retry implementations with configurable strategies.
 *
 * @author Translation Service Team
 */

import { ErrorClassifier, ErrorType } from '../../errors/ErrorClassifier';
import { CircuitBreaker, CircuitState } from './CircuitBreaker';

/**
 * Retry options
 */
export interface RetryOptions {
  maxRetries?: number;           // Override max retries from error classification
  baseDelayMs?: number;          // Override base delay
  backoffMultiplier?: number;    // Override backoff multiplier
  maxDelayMs?: number;           // Override max delay
  onRetry?: (error: Error, attemptNumber: number, delay: number) => void;
  abortSignal?: AbortSignal;     // Abort signal for cancellation
}

/**
 * RetryHandler - Intelligent retry logic with exponential backoff
 *
 * Features:
 * - Exponential backoff with jitter (±20%) to prevent thundering herd
 * - Circuit breaker integration to prevent cascading failures
 * - Error classification for retry decisions
 * - Configurable retry strategies per error type
 * - Abort signal support for cancellation
 *
 * Usage:
 * ```typescript
 * const handler = new RetryHandler();
 * const result = await handler.executeWithRetry(
 *   async () => await translateText(text),
 *   { maxRetries: 3, onRetry: (error, attempt, delay) => console.log(`Retry ${attempt}`) },
 *   'translation-service'
 * );
 * ```
 */
export class RetryHandler {
  private circuitBreakers: Map<string, CircuitBreaker> = new Map();

  private readonly defaultCircuitBreakerConfig = {
    failureThreshold: 5,   // Open after 5 consecutive failures
    successThreshold: 2,   // Close after 2 consecutive successes
    timeout: 60000         // Try recovery after 60 seconds
  };

  /**
   * Execute function with retry logic
   *
   * @param fn - Function to execute
   * @param options - Retry options
   * @param context - Context identifier for circuit breaker (e.g., 'translation-service')
   * @returns Result from successful execution
   * @throws Error if all retries exhausted or non-retryable error
   */
  public async executeWithRetry<T>(
    fn: () => Promise<T>,
    options: RetryOptions = {},
    context?: string
  ): Promise<T> {
    const circuitBreaker = this.getCircuitBreaker(context || 'default');
    let lastError: Error | undefined;
    let attemptNumber = 0;

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

        // Success - record in circuit breaker and return
        circuitBreaker.recordSuccess();
        console.log(`[RetryHandler] Success on attempt ${attemptNumber}${context ? ` (${context})` : ''}`);
        return result;

      } catch (error) {
        lastError = error as Error;
        const classification = ErrorClassifier.classifyError(error);

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
   * Calculate delay before retry with exponential backoff and jitter
   *
   * @param errorType - Type of error
   * @param attemptNumber - Current attempt number (1-indexed)
   * @param options - Retry options
   * @param retryAfter - Server-provided retry-after value in ms
   * @returns Delay in milliseconds
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

    // Get strategy from error classifier
    const strategy = ErrorClassifier.getRecoveryStrategy(errorType);
    const baseDelay = options.baseDelayMs ?? strategy.baseDelayMs;
    const multiplier = options.backoffMultiplier ?? strategy.backoffMultiplier;
    const maxDelay = options.maxDelayMs ?? strategy.maxDelayMs;

    // Calculate exponential backoff
    const exponentialDelay = baseDelay * Math.pow(multiplier, attemptNumber - 1);

    // Add jitter (±20% randomization) to prevent thundering herd
    const jitter = exponentialDelay * 0.2 * (Math.random() * 2 - 1);
    const delayWithJitter = exponentialDelay + jitter;

    // Cap at max delay and ensure non-negative
    return Math.min(Math.max(delayWithJitter, 0), maxDelay);
  }

  /**
   * Delay execution with cancellation support
   *
   * @param ms - Milliseconds to delay
   * @param abortSignal - Optional abort signal
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
   *
   * @param context - Context identifier
   * @returns Circuit breaker instance
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
   * Reset circuit breaker for specific context
   *
   * @param context - Context identifier
   */
  public resetCircuitBreaker(context: string = 'default'): void {
    const breaker = this.circuitBreakers.get(context);
    if (breaker) {
      breaker.reset();
      console.log(`[RetryHandler] Reset circuit breaker for ${context}`);
    }
  }

  /**
   * Get circuit breaker state for context
   *
   * @param context - Context identifier
   * @returns Circuit state
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
