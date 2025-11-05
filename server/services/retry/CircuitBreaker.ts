/**
 * Circuit Breaker
 *
 * Implements the circuit breaker pattern to prevent cascading failures.
 * States: CLOSED (normal), OPEN (failing), HALF_OPEN (testing recovery).
 *
 * @author Translation Service Team
 */

/**
 * Circuit breaker states
 */
export enum CircuitState {
  CLOSED = 'CLOSED',     // Normal operation, requests allowed
  OPEN = 'OPEN',         // Failing state, requests blocked
  HALF_OPEN = 'HALF_OPEN' // Testing recovery, limited requests allowed
}

/**
 * Circuit breaker configuration
 */
export interface CircuitBreakerConfig {
  failureThreshold: number;  // Number of consecutive failures before opening
  successThreshold: number;  // Number of successes to close from HALF_OPEN
  timeout: number;           // Time in ms before attempting recovery (entering HALF_OPEN)
}

/**
 * CircuitBreaker - Prevents repeated calls to failing services
 *
 * Usage:
 * ```typescript
 * const breaker = new CircuitBreaker({
 *   failureThreshold: 5,
 *   successThreshold: 2,
 *   timeout: 60000
 * });
 *
 * if (breaker.canAttempt()) {
 *   try {
 *     const result = await someOperation();
 *     breaker.recordSuccess();
 *   } catch (error) {
 *     breaker.recordFailure();
 *   }
 * }
 * ```
 */
export class CircuitBreaker {
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
   *
   * @returns true if request can be attempted
   */
  public canAttempt(): boolean {
    if (this.state === CircuitState.CLOSED) {
      return true;
    }

    if (this.state === CircuitState.OPEN) {
      // Check if timeout has passed since last failure
      const timeSinceFailure = Date.now() - this.lastFailureTime;
      if (timeSinceFailure >= this.config.timeout) {
        console.log('[CircuitBreaker] Timeout expired, entering HALF_OPEN state');
        this.state = CircuitState.HALF_OPEN;
        this.successCount = 0;
        return true;
      }
      return false;
    }

    // HALF_OPEN state - allow request
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
        console.log('[CircuitBreaker] Success threshold reached, closing circuit');
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
      console.log('[CircuitBreaker] Failure in HALF_OPEN state, opening circuit');
      this.state = CircuitState.OPEN;
    } else if (this.failureCount >= this.config.failureThreshold) {
      console.log(`[CircuitBreaker] Failure threshold reached (${this.failureCount}), opening circuit`);
      this.state = CircuitState.OPEN;
    }
  }

  /**
   * Get current circuit state
   *
   * @returns current state (CLOSED, OPEN, or HALF_OPEN)
   */
  public getState(): CircuitState {
    return this.state;
  }

  /**
   * Reset circuit breaker to CLOSED state
   */
  public reset(): void {
    this.state = CircuitState.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = 0;
    console.log('[CircuitBreaker] Circuit breaker reset to CLOSED state');
  }
}
