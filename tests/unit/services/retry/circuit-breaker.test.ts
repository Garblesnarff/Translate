/**
 * Circuit Breaker Tests
 *
 * Tests for circuit breaker pattern implementation.
 * Verifies state transitions, failure thresholds, and recovery behavior.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CircuitBreaker, CircuitState } from '../../../../server/services/retry/CircuitBreaker';

describe('CircuitBreaker', () => {
  let circuitBreaker: CircuitBreaker;

  beforeEach(() => {
    vi.useFakeTimers();
    circuitBreaker = new CircuitBreaker({
      failureThreshold: 5,
      successThreshold: 2,
      timeout: 60000
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('State Transitions', () => {
    it('should start in CLOSED state', () => {
      expect(circuitBreaker.getState()).toBe(CircuitState.CLOSED);
      expect(circuitBreaker.canAttempt()).toBe(true);
    });

    it('should transition to OPEN after consecutive failures exceed threshold', () => {
      // Record 5 failures (threshold)
      for (let i = 0; i < 5; i++) {
        circuitBreaker.recordFailure();
      }

      expect(circuitBreaker.getState()).toBe(CircuitState.OPEN);
      expect(circuitBreaker.canAttempt()).toBe(false);
    });

    it('should stay CLOSED if failures are below threshold', () => {
      // Record 4 failures (below threshold of 5)
      for (let i = 0; i < 4; i++) {
        circuitBreaker.recordFailure();
      }

      expect(circuitBreaker.getState()).toBe(CircuitState.CLOSED);
      expect(circuitBreaker.canAttempt()).toBe(true);
    });

    it('should transition from OPEN to HALF_OPEN after timeout', () => {
      // Open the circuit
      for (let i = 0; i < 5; i++) {
        circuitBreaker.recordFailure();
      }

      expect(circuitBreaker.getState()).toBe(CircuitState.OPEN);
      expect(circuitBreaker.canAttempt()).toBe(false);

      // Wait for timeout (60 seconds)
      vi.advanceTimersByTime(60000);

      // Should now be allowed to attempt (enters HALF_OPEN)
      expect(circuitBreaker.canAttempt()).toBe(true);
      expect(circuitBreaker.getState()).toBe(CircuitState.HALF_OPEN);
    });

    it('should transition from HALF_OPEN to CLOSED after successful attempts', () => {
      // Open the circuit
      for (let i = 0; i < 5; i++) {
        circuitBreaker.recordFailure();
      }

      // Wait for timeout
      vi.advanceTimersByTime(60000);

      // Attempt and succeed (should enter HALF_OPEN)
      expect(circuitBreaker.canAttempt()).toBe(true);

      // Record 2 successes (success threshold)
      circuitBreaker.recordSuccess();
      circuitBreaker.recordSuccess();

      expect(circuitBreaker.getState()).toBe(CircuitState.CLOSED);
      expect(circuitBreaker.canAttempt()).toBe(true);
    });

    it('should transition from HALF_OPEN to OPEN on failure', () => {
      // Open the circuit
      for (let i = 0; i < 5; i++) {
        circuitBreaker.recordFailure();
      }

      // Wait for timeout to enter HALF_OPEN
      vi.advanceTimersByTime(60000);
      circuitBreaker.canAttempt(); // Triggers transition to HALF_OPEN

      // Record a failure in HALF_OPEN state
      circuitBreaker.recordFailure();

      expect(circuitBreaker.getState()).toBe(CircuitState.OPEN);
      expect(circuitBreaker.canAttempt()).toBe(false);
    });

    it('should reset failure count on success in CLOSED state', () => {
      // Record some failures
      circuitBreaker.recordFailure();
      circuitBreaker.recordFailure();
      circuitBreaker.recordFailure();

      // Record a success
      circuitBreaker.recordSuccess();

      // Should still be CLOSED
      expect(circuitBreaker.getState()).toBe(CircuitState.CLOSED);

      // Should need 5 more failures to open (not 2)
      circuitBreaker.recordFailure();
      circuitBreaker.recordFailure();
      expect(circuitBreaker.getState()).toBe(CircuitState.CLOSED);

      // 5 consecutive failures should open it
      circuitBreaker.recordFailure();
      circuitBreaker.recordFailure();
      circuitBreaker.recordFailure();
      expect(circuitBreaker.getState()).toBe(CircuitState.OPEN);
    });
  });

  describe('Failure Threshold', () => {
    it('should open after exactly N consecutive failures', () => {
      const breaker = new CircuitBreaker({
        failureThreshold: 3,
        successThreshold: 1,
        timeout: 60000
      });

      expect(breaker.getState()).toBe(CircuitState.CLOSED);

      breaker.recordFailure();
      expect(breaker.getState()).toBe(CircuitState.CLOSED);

      breaker.recordFailure();
      expect(breaker.getState()).toBe(CircuitState.CLOSED);

      breaker.recordFailure();
      expect(breaker.getState()).toBe(CircuitState.OPEN);
    });

    it('should handle different failure thresholds', () => {
      const breaker = new CircuitBreaker({
        failureThreshold: 10,
        successThreshold: 1,
        timeout: 60000
      });

      // Record 9 failures
      for (let i = 0; i < 9; i++) {
        breaker.recordFailure();
      }

      expect(breaker.getState()).toBe(CircuitState.CLOSED);

      // 10th failure should open
      breaker.recordFailure();
      expect(breaker.getState()).toBe(CircuitState.OPEN);
    });
  });

  describe('Success Threshold', () => {
    it('should close after exactly N consecutive successes in HALF_OPEN', () => {
      const breaker = new CircuitBreaker({
        failureThreshold: 3,
        successThreshold: 3,
        timeout: 60000
      });

      // Open the circuit
      for (let i = 0; i < 3; i++) {
        breaker.recordFailure();
      }

      // Wait for timeout
      vi.advanceTimersByTime(60000);
      breaker.canAttempt(); // Enter HALF_OPEN

      expect(breaker.getState()).toBe(CircuitState.HALF_OPEN);

      // Record 2 successes
      breaker.recordSuccess();
      expect(breaker.getState()).toBe(CircuitState.HALF_OPEN);

      breaker.recordSuccess();
      expect(breaker.getState()).toBe(CircuitState.HALF_OPEN);

      // 3rd success should close
      breaker.recordSuccess();
      expect(breaker.getState()).toBe(CircuitState.CLOSED);
    });
  });

  describe('Timeout Behavior', () => {
    it('should not allow attempts before timeout expires', () => {
      // Open the circuit
      for (let i = 0; i < 5; i++) {
        circuitBreaker.recordFailure();
      }

      expect(circuitBreaker.canAttempt()).toBe(false);

      // Wait for less than timeout
      vi.advanceTimersByTime(30000);

      // Should still be blocked
      expect(circuitBreaker.canAttempt()).toBe(false);
    });

    it('should allow attempts after timeout expires', () => {
      // Open the circuit
      for (let i = 0; i < 5; i++) {
        circuitBreaker.recordFailure();
      }

      expect(circuitBreaker.canAttempt()).toBe(false);

      // Wait for full timeout
      vi.advanceTimersByTime(60000);

      // Should now allow attempts
      expect(circuitBreaker.canAttempt()).toBe(true);
    });

    it('should handle custom timeout values', () => {
      const breaker = new CircuitBreaker({
        failureThreshold: 3,
        successThreshold: 1,
        timeout: 30000 // 30 seconds
      });

      // Open the circuit
      for (let i = 0; i < 3; i++) {
        breaker.recordFailure();
      }

      expect(breaker.canAttempt()).toBe(false);

      // Wait for custom timeout
      vi.advanceTimersByTime(30000);

      // Should now allow attempts
      expect(breaker.canAttempt()).toBe(true);
    });
  });

  describe('Reset Functionality', () => {
    it('should reset to CLOSED state', () => {
      // Open the circuit
      for (let i = 0; i < 5; i++) {
        circuitBreaker.recordFailure();
      }

      expect(circuitBreaker.getState()).toBe(CircuitState.OPEN);

      // Reset
      circuitBreaker.reset();

      expect(circuitBreaker.getState()).toBe(CircuitState.CLOSED);
      expect(circuitBreaker.canAttempt()).toBe(true);
    });

    it('should reset failure counts', () => {
      // Record some failures
      circuitBreaker.recordFailure();
      circuitBreaker.recordFailure();
      circuitBreaker.recordFailure();

      // Reset
      circuitBreaker.reset();

      // Should need full threshold to open again
      circuitBreaker.recordFailure();
      circuitBreaker.recordFailure();
      circuitBreaker.recordFailure();
      circuitBreaker.recordFailure();
      expect(circuitBreaker.getState()).toBe(CircuitState.CLOSED);

      circuitBreaker.recordFailure();
      expect(circuitBreaker.getState()).toBe(CircuitState.OPEN);
    });
  });

  describe('Cascading Failure Prevention', () => {
    it('should prevent repeated calls when circuit is open', () => {
      let callCount = 0;

      const testFunction = () => {
        if (!circuitBreaker.canAttempt()) {
          return false;
        }
        callCount++;
        circuitBreaker.recordFailure();
        return true;
      };

      // Open the circuit
      for (let i = 0; i < 5; i++) {
        testFunction();
      }

      expect(callCount).toBe(5);

      // Try to call 10 more times
      for (let i = 0; i < 10; i++) {
        testFunction();
      }

      // Should not have increased call count
      expect(callCount).toBe(5);
    });

    it('should fail fast when circuit is open', () => {
      // Open the circuit
      for (let i = 0; i < 5; i++) {
        circuitBreaker.recordFailure();
      }

      const startTime = Date.now();

      // Try to make request
      const canAttempt = circuitBreaker.canAttempt();

      // Should return immediately (fail fast)
      const elapsed = Date.now() - startTime;

      expect(canAttempt).toBe(false);
      expect(elapsed).toBeLessThan(10); // Should be near-instantaneous
    });
  });

  describe('Edge Cases', () => {
    it('should handle success in CLOSED state', () => {
      expect(circuitBreaker.getState()).toBe(CircuitState.CLOSED);

      circuitBreaker.recordSuccess();

      expect(circuitBreaker.getState()).toBe(CircuitState.CLOSED);
      expect(circuitBreaker.canAttempt()).toBe(true);
    });

    it('should handle mixed success/failure patterns', () => {
      // Pattern: fail, fail, success, fail, fail, fail
      circuitBreaker.recordFailure();
      circuitBreaker.recordFailure();
      circuitBreaker.recordSuccess(); // Resets count
      circuitBreaker.recordFailure();
      circuitBreaker.recordFailure();
      circuitBreaker.recordFailure();

      expect(circuitBreaker.getState()).toBe(CircuitState.CLOSED);

      // Need 2 more consecutive failures to open
      circuitBreaker.recordFailure();
      circuitBreaker.recordFailure();

      expect(circuitBreaker.getState()).toBe(CircuitState.OPEN);
    });

    it('should handle rapid state transitions', () => {
      // Open the circuit
      for (let i = 0; i < 5; i++) {
        circuitBreaker.recordFailure();
      }

      // Transition to HALF_OPEN
      vi.advanceTimersByTime(60000);
      circuitBreaker.canAttempt();

      // Fail immediately (back to OPEN)
      circuitBreaker.recordFailure();

      expect(circuitBreaker.getState()).toBe(CircuitState.OPEN);

      // Wait again
      vi.advanceTimersByTime(60000);
      circuitBreaker.canAttempt();

      // This time succeed twice
      circuitBreaker.recordSuccess();
      circuitBreaker.recordSuccess();

      expect(circuitBreaker.getState()).toBe(CircuitState.CLOSED);
    });
  });

  describe('Configuration Validation', () => {
    it('should work with minimum thresholds', () => {
      const breaker = new CircuitBreaker({
        failureThreshold: 1,
        successThreshold: 1,
        timeout: 1000
      });

      expect(breaker.getState()).toBe(CircuitState.CLOSED);

      breaker.recordFailure();
      expect(breaker.getState()).toBe(CircuitState.OPEN);

      vi.advanceTimersByTime(1000);
      breaker.canAttempt();

      breaker.recordSuccess();
      expect(breaker.getState()).toBe(CircuitState.CLOSED);
    });

    it('should work with large thresholds', () => {
      const breaker = new CircuitBreaker({
        failureThreshold: 100,
        successThreshold: 50,
        timeout: 300000
      });

      // Record 99 failures
      for (let i = 0; i < 99; i++) {
        breaker.recordFailure();
      }

      expect(breaker.getState()).toBe(CircuitState.CLOSED);

      breaker.recordFailure();
      expect(breaker.getState()).toBe(CircuitState.OPEN);
    });
  });
});
