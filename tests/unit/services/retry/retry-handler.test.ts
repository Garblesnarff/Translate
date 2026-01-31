/**
 * Retry Handler Tests
 *
 * Comprehensive tests for retry handler with exponential backoff and circuit breaker.
 * Tests cover transient errors, non-transient errors, backoff strategies, and circuit breaker behavior.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RetryHandler } from '../../../../server/services/retry/RetryHandler';
import { ErrorType } from '../../../../server/errors/ErrorClassifier';

describe('RetryHandler', () => {
  let retryHandler: RetryHandler;

  beforeEach(() => {
    retryHandler = new RetryHandler();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Transient Error Retries', () => {
    it('should retry transient errors (RATE_LIMIT)', async () => {
      let attempts = 0;
      const fn = vi.fn(async () => {
        attempts++;
        if (attempts < 3) {
          const error = new Error('Rate limit exceeded');
          (error as any).status = 429;
          throw error;
        }
        return 'success';
      });

      const promise = retryHandler.executeWithRetry(fn);

      // Fast forward through retry delays
      await vi.runAllTimersAsync();

      const result = await promise;

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(3);
      expect(attempts).toBe(3);
    });

    it('should retry network errors', async () => {
      let attempts = 0;
      const fn = vi.fn(async () => {
        attempts++;
        if (attempts < 2) {
          const error = new Error('Network error');
          (error as any).code = 'ECONNREFUSED';
          throw error;
        }
        return 'success';
      });

      const promise = retryHandler.executeWithRetry(fn);
      await vi.runAllTimersAsync();
      const result = await promise;

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should retry timeout errors', async () => {
      let attempts = 0;
      const fn = vi.fn(async () => {
        attempts++;
        if (attempts < 2) {
          const error = new Error('Request timeout');
          (error as any).code = 'ETIMEDOUT';
          throw error;
        }
        return 'success';
      });

      const promise = retryHandler.executeWithRetry(fn);
      await vi.runAllTimersAsync();
      const result = await promise;

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should retry API_UNAVAILABLE errors', async () => {
      let attempts = 0;
      const fn = vi.fn(async () => {
        attempts++;
        if (attempts < 2) {
          const error = new Error('Service unavailable');
          (error as any).status = 503;
          throw error;
        }
        return 'success';
      });

      const promise = retryHandler.executeWithRetry(fn);
      await vi.runAllTimersAsync();
      const result = await promise;

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(2);
    });
  });

  describe('Non-Transient Errors', () => {
    it('should NOT retry validation errors', async () => {
      const fn = vi.fn(async () => {
        const error = new Error('Invalid input');
        (error as any).status = 400;
        throw error;
      });

      await expect(retryHandler.executeWithRetry(fn)).rejects.toThrow('Invalid input');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should NOT retry auth errors', async () => {
      const fn = vi.fn(async () => {
        const error = new Error('Unauthorized');
        (error as any).status = 401;
        throw error;
      });

      await expect(retryHandler.executeWithRetry(fn)).rejects.toThrow('Unauthorized');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should NOT retry configuration errors', async () => {
      const fn = vi.fn(async () => {
        const error = new Error('Configuration error');
        throw error;
      });

      await expect(retryHandler.executeWithRetry(fn)).rejects.toThrow('Configuration error');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should NOT retry cancellation errors', async () => {
      const fn = vi.fn(async () => {
        const error = new Error('Operation cancelled');
        (error as any).name = 'AbortError';
        throw error;
      });

      await expect(retryHandler.executeWithRetry(fn)).rejects.toThrow('Operation cancelled');
      expect(fn).toHaveBeenCalledTimes(1);
    });
  });

  describe('Exponential Backoff with Jitter', () => {
    it('should use exponential backoff (1s, 2s, 4s, 8s)', async () => {
      const delays: number[] = [];
      let attempts = 0;

      const fn = vi.fn(async () => {
        attempts++;
        if (attempts < 5) {
          const error = new Error('Rate limit');
          (error as any).status = 429;
          throw error;
        }
        return 'success';
      });

      const onRetry = vi.fn((error: Error, attemptNumber: number, delay: number) => {
        delays.push(delay);
      });

      const promise = retryHandler.executeWithRetry(fn, { onRetry });
      await vi.runAllTimersAsync();
      await promise;

      expect(delays.length).toBe(4);

      // Check that delays roughly follow exponential pattern (with jitter)
      // Base delay for rate limit is 2000ms with 2x multiplier
      // Expected: ~2000, ~4000, ~8000, ~16000 (±20% jitter)
      expect(delays[0]).toBeGreaterThan(1600);
      expect(delays[0]).toBeLessThan(2400);

      expect(delays[1]).toBeGreaterThan(3200);
      expect(delays[1]).toBeLessThan(4800);

      expect(delays[2]).toBeGreaterThan(6400);
      expect(delays[2]).toBeLessThan(9600);
    });

    it('should apply jitter (±20%) to prevent thundering herd', async () => {
      const delays: number[] = [];

      for (let i = 0; i < 10; i++) {
        let attempts = 0;
        const fn = async () => {
          attempts++;
          if (attempts < 2) {
            const error = new Error('Network error');
            (error as any).code = 'ECONNREFUSED';
            throw error;
          }
          return 'success';
        };

        const onRetry = (error: Error, attemptNumber: number, delay: number) => {
          delays.push(delay);
        };

        const promise = retryHandler.executeWithRetry(fn, { onRetry });
        await vi.runAllTimersAsync();
        await promise;
      }

      // Check that delays vary (jitter is working)
      const uniqueDelays = new Set(delays);
      expect(uniqueDelays.size).toBeGreaterThan(1);
    });

    it('should respect maxDelay cap', async () => {
      const delays: number[] = [];
      let attempts = 0;

      const fn = vi.fn(async () => {
        attempts++;
        if (attempts < 10) {
          const error = new Error('Rate limit');
          (error as any).status = 429;
          throw error;
        }
        return 'success';
      });

      const onRetry = vi.fn((error: Error, attemptNumber: number, delay: number) => {
        delays.push(delay);
      });

      const promise = retryHandler.executeWithRetry(fn, { onRetry, maxRetries: 10 });
      await vi.runAllTimersAsync();
      await promise;

      // Max delay for rate limit is 60000ms
      delays.forEach(delay => {
        expect(delay).toBeLessThanOrEqual(60000);
      });
    });
  });

  describe('Retry Attempts', () => {
    it('should respect maxRetries limit', async () => {
      const fn = vi.fn(async () => {
        const error = new Error('Rate limit');
        (error as any).status = 429;
        throw error;
      });

      const promise = retryHandler.executeWithRetry(fn, { maxRetries: 3 });
      await vi.runAllTimersAsync();

      await expect(promise).rejects.toThrow('Rate limit');
      expect(fn).toHaveBeenCalledTimes(4); // Initial + 3 retries
    });

    it('should track retry attempts in metadata', async () => {
      let attempts = 0;
      const attemptNumbers: number[] = [];

      const fn = vi.fn(async () => {
        attempts++;
        if (attempts < 3) {
          const error = new Error('Network error');
          (error as any).code = 'ECONNREFUSED';
          throw error;
        }
        return 'success';
      });

      const onRetry = vi.fn((error: Error, attemptNumber: number, delay: number) => {
        attemptNumbers.push(attemptNumber);
      });

      const promise = retryHandler.executeWithRetry(fn, { onRetry });
      await vi.runAllTimersAsync();
      await promise;

      expect(attemptNumbers).toEqual([1, 2]);
    });

    it('should stop after first success', async () => {
      let attempts = 0;

      const fn = vi.fn(async () => {
        attempts++;
        if (attempts < 2) {
          const error = new Error('Network error');
          (error as any).code = 'ECONNREFUSED';
          throw error;
        }
        return 'success';
      });

      const promise = retryHandler.executeWithRetry(fn);
      await vi.runAllTimersAsync();
      const result = await promise;

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(2);
    });
  });

  describe('Delay Calculations', () => {
    it('should calculate correct delays (1s, 2s, 4s, 8s) for network errors', async () => {
      const delays: number[] = [];
      let attempts = 0;

      const fn = vi.fn(async () => {
        attempts++;
        if (attempts < 5) {
          const error = new Error('Network error');
          (error as any).code = 'ECONNREFUSED';
          throw error;
        }
        return 'success';
      });

      const onRetry = vi.fn((error: Error, attemptNumber: number, delay: number) => {
        delays.push(delay);
      });

      const promise = retryHandler.executeWithRetry(fn, { onRetry, maxRetries: 5 });
      await vi.runAllTimersAsync();
      await promise;

      // Network error base delay is 1000ms with 2x multiplier
      // Expected: ~1000, ~2000, ~4000, ~8000 (±20% jitter)
      expect(delays[0]).toBeGreaterThan(800);
      expect(delays[0]).toBeLessThan(1200);

      expect(delays[1]).toBeGreaterThan(1600);
      expect(delays[1]).toBeLessThan(2400);

      expect(delays[2]).toBeGreaterThan(3200);
      expect(delays[2]).toBeLessThan(4800);

      expect(delays[3]).toBeGreaterThan(6400);
      expect(delays[3]).toBeLessThan(9600);
    });

    it('should use custom baseDelay when provided', async () => {
      const delays: number[] = [];
      let attempts = 0;

      const fn = vi.fn(async () => {
        attempts++;
        if (attempts < 2) {
          const error = new Error('Network error');
          (error as any).code = 'ECONNREFUSED';
          throw error;
        }
        return 'success';
      });

      const onRetry = vi.fn((error: Error, attemptNumber: number, delay: number) => {
        delays.push(delay);
      });

      const promise = retryHandler.executeWithRetry(fn, {
        onRetry,
        baseDelayMs: 500
      });
      await vi.runAllTimersAsync();
      await promise;

      // Custom base delay of 500ms
      expect(delays[0]).toBeGreaterThan(400);
      expect(delays[0]).toBeLessThan(600);
    });

    it('should use custom maxDelay when provided', async () => {
      const delays: number[] = [];
      let attempts = 0;

      const fn = vi.fn(async () => {
        attempts++;
        if (attempts < 10) {
          const error = new Error('Rate limit');
          (error as any).status = 429;
          throw error;
        }
        return 'success';
      });

      const onRetry = vi.fn((error: Error, attemptNumber: number, delay: number) => {
        delays.push(delay);
      });

      const promise = retryHandler.executeWithRetry(fn, {
        onRetry,
        maxRetries: 10,
        maxDelayMs: 5000
      });
      await vi.runAllTimersAsync();
      await promise;

      // Custom max delay of 5000ms
      delays.forEach(delay => {
        expect(delay).toBeLessThanOrEqual(5000);
      });
    });
  });

  describe('Circuit Breaker Integration', () => {
    it('should integrate with circuit breaker', async () => {
      const fn = vi.fn(async () => {
        const error = new Error('Service error');
        (error as any).status = 500;
        throw error;
      });

      // Circuit breaker should open after 5 consecutive failures
      for (let i = 0; i < 5; i++) {
        const promise = retryHandler.executeWithRetry(fn, { maxRetries: 0 }, 'test-service');
        await vi.runAllTimersAsync();
        await expect(promise).rejects.toThrow();
      }

      // Next attempt should fail immediately with circuit open
      const promise = retryHandler.executeWithRetry(fn, { maxRetries: 0 }, 'test-service');
      await expect(promise).rejects.toThrow('Circuit breaker is open');

      // Should not call function when circuit is open
      expect(fn).toHaveBeenCalledTimes(5);
    });

    it('should allow requests after circuit breaker timeout', async () => {
      const fn = vi.fn(async () => {
        const error = new Error('Service error');
        throw error;
      });

      // Open circuit breaker
      for (let i = 0; i < 5; i++) {
        const promise = retryHandler.executeWithRetry(fn, { maxRetries: 0 }, 'test-service');
        await vi.runAllTimersAsync();
        await expect(promise).rejects.toThrow();
      }

      // Circuit should be open
      await expect(
        retryHandler.executeWithRetry(fn, { maxRetries: 0 }, 'test-service')
      ).rejects.toThrow('Circuit breaker is open');

      // Wait for circuit breaker timeout (60 seconds)
      vi.advanceTimersByTime(60000);

      // Circuit should be half-open now, allowing one request
      fn.mockImplementationOnce(async () => 'success');

      const promise = retryHandler.executeWithRetry(fn, { maxRetries: 0 }, 'test-service');
      await vi.runAllTimersAsync();
      const result = await promise;

      expect(result).toBe('success');
    });
  });

  describe('Abort Signal Support', () => {
    it('should support cancellation via AbortSignal', async () => {
      const abortController = new AbortController();
      let attempts = 0;

      const fn = vi.fn(async () => {
        attempts++;
        const error = new Error('Rate limit');
        (error as any).status = 429;
        throw error;
      });

      const promise = retryHandler.executeWithRetry(fn, {
        abortSignal: abortController.signal
      });

      // Start retries
      await vi.advanceTimersByTimeAsync(1000);

      // Cancel during retry
      abortController.abort();
      await vi.runAllTimersAsync();

      await expect(promise).rejects.toThrow('Operation cancelled');
    });
  });

  describe('Custom Options', () => {
    it('should support custom backoffMultiplier', async () => {
      const delays: number[] = [];
      let attempts = 0;

      const fn = vi.fn(async () => {
        attempts++;
        if (attempts < 4) {
          const error = new Error('Network error');
          (error as any).code = 'ECONNREFUSED';
          throw error;
        }
        return 'success';
      });

      const onRetry = vi.fn((error: Error, attemptNumber: number, delay: number) => {
        delays.push(delay);
      });

      const promise = retryHandler.executeWithRetry(fn, {
        onRetry,
        baseDelayMs: 1000,
        backoffMultiplier: 3 // Triple each time instead of double
      });
      await vi.runAllTimersAsync();
      await promise;

      // With 3x multiplier: ~1000, ~3000, ~9000
      expect(delays[0]).toBeGreaterThan(800);
      expect(delays[0]).toBeLessThan(1200);

      expect(delays[1]).toBeGreaterThan(2400);
      expect(delays[1]).toBeLessThan(3600);

      expect(delays[2]).toBeGreaterThan(7200);
      expect(delays[2]).toBeLessThan(10800);
    });
  });
});
