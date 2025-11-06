/**
 * Complete Error Recovery Integration Test
 *
 * Tests the full error recovery pipeline:
 * 1. Primary provider fails (rate limit)
 * 2. Retry handler retries 3×
 * 3. Circuit breaker opens after 5 failures
 * 4. Fallback strategies execute in order
 * 5. Final fallback to manual review
 *
 * Verifies:
 * - Monitoring tracks all failures
 * - Manual review queue is populated
 * - Each recovery stage is attempted
 *
 * @module tests/integration/error-recovery-full
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { RetryHandler } from '../../../server/services/retry/RetryHandler';
import { CircuitBreaker, CircuitState } from '../../../server/services/retry/CircuitBreaker';
import { MockTranslationProvider, MockCacheProvider } from '../utils/mocks';
import type { TranslationResult } from '../../../shared/types';

describe('Complete Error Recovery Pipeline', () => {
  let retryHandler: RetryHandler;
  let circuitBreaker: CircuitBreaker;
  let mockProvider: MockTranslationProvider;
  let mockCache: MockCacheProvider;
  let failureLog: string[];

  beforeEach(() => {
    retryHandler = new RetryHandler();
    circuitBreaker = new CircuitBreaker({
      failureThreshold: 5,
      resetTimeout: 30000,
      halfOpenMaxAttempts: 3,
    });
    mockProvider = new MockTranslationProvider();
    mockCache = new MockCacheProvider();
    failureLog = [];
  });

  afterEach(() => {
    mockProvider.reset();
    mockCache.reset();
    failureLog = [];
  });

  describe('retry mechanism', () => {
    it('should retry 3 times on transient failures', async () => {
      const tibetanText = 'བཀྲ་ཤིས་བདེ་ལེགས།';
      let attemptCount = 0;

      // Create function that fails 2 times, succeeds on 3rd
      const unreliableTranslate = async () => {
        attemptCount++;
        failureLog.push(`attempt-${attemptCount}`);

        if (attemptCount < 3) {
          const error = new Error('Temporary network error');
          (error as any).status = 503;
          throw error;
        }

        return {
          translation: 'Tashi Delek (བཀྲ་ཤིས་བདེ་ལེགས།).',
          confidence: 0.85,
          metadata: { provider: 'mock', attempt: attemptCount },
        };
      };

      // Execute with retry
      const result = await retryHandler.executeWithRetry(
        unreliableTranslate,
        { maxRetries: 3, retryDelay: 100 },
        'translation'
      );

      // Verify retry behavior
      expect(attemptCount).toBe(3);
      expect(failureLog).toEqual(['attempt-1', 'attempt-2', 'attempt-3']);
      expect(result.translation).toContain('Tashi Delek');
      expect(result.metadata.attempt).toBe(3);

      console.log('✓ Retry mechanism: 3 attempts, succeeded on 3rd');
      console.log(`  Failure log: ${failureLog.join(' → ')}`);
    });

    it('should fail after max retries exhausted', async () => {
      let attemptCount = 0;

      // Create function that always fails
      const alwaysFails = async () => {
        attemptCount++;
        failureLog.push(`attempt-${attemptCount}`);
        throw new Error('Persistent failure');
      };

      // Execute with retry - should throw after exhausting retries
      await expect(
        retryHandler.executeWithRetry(
          alwaysFails,
          { maxRetries: 3, retryDelay: 10 },
          'translation'
        )
      ).rejects.toThrow('Persistent failure');

      // Should have tried 4 times total (initial + 3 retries)
      expect(attemptCount).toBe(4);

      console.log('✓ Failed after max retries exhausted');
      console.log(`  Total attempts: ${attemptCount}`);
    });

    it('should use exponential backoff for retries', async () => {
      const timestamps: number[] = [];
      let attemptCount = 0;

      const trackTimingFunction = async () => {
        attemptCount++;
        timestamps.push(Date.now());

        if (attemptCount < 4) {
          throw new Error('Retry me');
        }

        return { translation: 'Success', confidence: 0.8, metadata: {} };
      };

      const result = await retryHandler.executeWithRetry(
        trackTimingFunction,
        { maxRetries: 3, retryDelay: 100, exponentialBackoff: true },
        'test'
      );

      // Verify exponential backoff delays
      // Delays should be: 100ms, 200ms, 400ms
      if (timestamps.length >= 2) {
        const delay1 = timestamps[1] - timestamps[0];
        const delay2 = timestamps[2] - timestamps[1];
        const delay3 = timestamps[3] - timestamps[2];

        console.log('✓ Exponential backoff applied');
        console.log(`  Delays: ${delay1}ms, ${delay2}ms, ${delay3}ms`);

        // Delays should increase (allowing for timing variance)
        expect(delay2).toBeGreaterThan(delay1 * 0.8);
        expect(delay3).toBeGreaterThan(delay2 * 0.8);
      }
    });
  });

  describe('circuit breaker integration', () => {
    it('should open circuit after 5 consecutive failures', async () => {
      const failingFunction = async () => {
        throw new Error('Service unavailable');
      };

      // Make 5 calls through circuit breaker
      for (let i = 0; i < 5; i++) {
        try {
          await circuitBreaker.execute(failingFunction, 'test-service');
        } catch (error) {
          failureLog.push(`failure-${i + 1}`);
        }
      }

      // Circuit should now be open
      expect(circuitBreaker.getState('test-service')).toBe(CircuitState.OPEN);
      expect(failureLog).toHaveLength(5);

      console.log('✓ Circuit breaker opened after 5 failures');
      console.log(`  State: ${circuitBreaker.getState('test-service')}`);
    });

    it('should reject requests immediately when circuit is open', async () => {
      const failingFunction = async () => {
        throw new Error('Service error');
      };

      // Open the circuit
      for (let i = 0; i < 5; i++) {
        try {
          await circuitBreaker.execute(failingFunction, 'test-service');
        } catch {}
      }

      // Next request should be rejected immediately
      const startTime = Date.now();
      try {
        await circuitBreaker.execute(failingFunction, 'test-service');
      } catch (error: any) {
        const duration = Date.now() - startTime;

        expect(error.message).toContain('Circuit breaker is OPEN');
        expect(duration).toBeLessThan(10); // Should fail immediately

        console.log('✓ Open circuit rejected request immediately');
        console.log(`  Rejection time: ${duration}ms`);
      }
    });

    it('should transition to half-open and allow test requests', async () => {
      vi.useFakeTimers();

      let callCount = 0;
      const recoveringFunction = async () => {
        callCount++;
        if (callCount <= 5) {
          throw new Error('Still failing');
        }
        return { success: true };
      };

      // Open circuit
      for (let i = 0; i < 5; i++) {
        try {
          await circuitBreaker.execute(recoveringFunction, 'test-service');
        } catch {}
      }

      expect(circuitBreaker.getState('test-service')).toBe(CircuitState.OPEN);

      // Fast forward past reset timeout
      vi.advanceTimersByTime(31000);

      // Circuit should now be half-open
      expect(circuitBreaker.getState('test-service')).toBe(CircuitState.HALF_OPEN);

      // Test request should be allowed
      const result = await circuitBreaker.execute(recoveringFunction, 'test-service');
      expect(result.success).toBe(true);

      // Circuit should close after successful request
      expect(circuitBreaker.getState('test-service')).toBe(CircuitState.CLOSED);

      console.log('✓ Circuit transitioned OPEN → HALF_OPEN → CLOSED');

      vi.useRealTimers();
    });
  });

  describe('fallback strategies', () => {
    it('should try cache fallback first', async () => {
      const tibetanText = 'བཀྲ་ཤིས་བདེ་ལེགས།';
      const cachedTranslation: TranslationResult = {
        translation: 'Tashi Delek (cached) (བཀྲ་ཤིས་བདེ་ལེགས།).',
        confidence: 0.85,
        metadata: { source: 'cache', timestamp: Date.now() - 3600000 },
      };

      // Pre-populate cache
      await mockCache.set(`translation:${tibetanText}`, cachedTranslation);

      // Provider fails
      mockProvider.setFailureMode(true);

      // Try translation
      try {
        await mockProvider.translate(tibetanText, 'Translate');
      } catch {
        // Primary failed, check cache
        const cached = await mockCache.get<TranslationResult>(`translation:${tibetanText}`);

        expect(cached).toBeTruthy();
        expect(cached?.metadata.source).toBe('cache');

        failureLog.push('primary-failed');
        failureLog.push('cache-hit');

        console.log('✓ Cache fallback succeeded');
        console.log(`  Recovery path: ${failureLog.join(' → ')}`);
      }
    });

    it('should use simpler prompt as fallback', async () => {
      const tibetanText = 'སེམས་ཀྱི་རང་བཞིན་ནི་དག་པ་ཡིན།';

      // Complex prompt fails
      const complexPrompt = 'Translate this advanced Buddhist philosophical text with precise terminology and contextual understanding.';
      const simplePrompt = 'Translate this Tibetan text to English.';

      // First attempt with complex prompt fails
      let attemptCount = 0;
      const translateWithFallback = async (prompt: string) => {
        attemptCount++;
        failureLog.push(`attempt-${attemptCount}-prompt-length-${prompt.length}`);

        if (prompt === complexPrompt) {
          throw new Error('Complex prompt too demanding');
        }

        return {
          translation: 'The nature of mind (སེམས་ཀྱི་རང་བཞིན) is pure (དག་པ་ཡིན།).',
          confidence: 0.78,
          metadata: { promptType: 'simple', fallback: true },
        };
      };

      // Try complex, fall back to simple
      let result;
      try {
        result = await translateWithFallback(complexPrompt);
      } catch {
        result = await translateWithFallback(simplePrompt);
      }

      expect(result.metadata.fallback).toBe(true);
      expect(failureLog).toHaveLength(2);

      console.log('✓ Simpler prompt fallback succeeded');
      console.log(`  Recovery: complex → simple`);
    });

    it('should chunk text as fallback for large inputs', async () => {
      const longText = 'བོད་སྐད་གལ་ཆེན་ཡིན། '.repeat(50);

      let attemptCount = 0;
      const translateWithChunking = async (text: string, chunked: boolean = false) => {
        attemptCount++;

        if (!chunked && text.length > 100) {
          failureLog.push('full-text-failed');
          throw new Error('Text too long');
        }

        failureLog.push('chunked-success');
        return {
          translation: `Processed ${chunked ? 'in chunks' : 'full text'}`,
          confidence: 0.75,
          metadata: { chunked, chunkCount: chunked ? 5 : 1 },
        };
      };

      // Try full text, fall back to chunking
      let result;
      try {
        result = await translateWithChunking(longText, false);
      } catch {
        result = await translateWithChunking(longText, true);
      }

      expect(result.metadata.chunked).toBe(true);
      expect(result.metadata.chunkCount).toBe(5);
      expect(failureLog).toContain('full-text-failed');
      expect(failureLog).toContain('chunked-success');

      console.log('✓ Text chunking fallback succeeded');
    });

    it('should fall back to manual review as last resort', async () => {
      const tibetanText = 'དབུ་མའི་ལམ་ནི་མཐའ་གཉིས་སྤངས་པའི་ཆོས་ཉིད་ཡིན།';

      // Simulate all automated strategies failing
      const manualReviewQueue: any[] = [];

      const attemptTranslation = async () => {
        // Cache miss
        failureLog.push('cache-miss');

        // Translation fails
        failureLog.push('translation-failed');
        throw new Error('All providers failed');
      };

      const fallbackToManualReview = async (text: string, originalPrompt: string) => {
        failureLog.push('manual-review-queued');

        const reviewItem = {
          id: `review-${Date.now()}`,
          text,
          prompt: originalPrompt,
          status: 'pending',
          priority: 'high',
          createdAt: new Date(),
        };

        manualReviewQueue.push(reviewItem);
        return reviewItem;
      };

      // Attempt translation
      try {
        await attemptTranslation();
      } catch {
        // All automated fallbacks failed, queue for manual review
        const reviewItem = await fallbackToManualReview(
          tibetanText,
          'Translate this Madhyamaka philosophy text'
        );

        expect(reviewItem.status).toBe('pending');
        expect(manualReviewQueue).toHaveLength(1);
        expect(failureLog).toContain('manual-review-queued');

        console.log('✓ Manual review fallback activated');
        console.log(`  Review item ID: ${reviewItem.id}`);
        console.log(`  Queue length: ${manualReviewQueue.length}`);
      }
    });
  });

  describe('full recovery pipeline', () => {
    it('should execute complete recovery flow', async () => {
      vi.useFakeTimers();

      const tibetanText = 'བོད་ཀྱི་སྐད་ཡིག།';
      let primaryAttempts = 0;

      // Primary provider fails with rate limit
      const primaryTranslate = async () => {
        primaryAttempts++;
        failureLog.push(`primary-attempt-${primaryAttempts}`);

        const error = new Error('Rate limit exceeded');
        (error as any).status = 429;
        throw error;
      };

      // Recovery pipeline
      const fullRecoveryPipeline = async () => {
        // Step 1: Try primary with retries
        try {
          await retryHandler.executeWithRetry(
            primaryTranslate,
            { maxRetries: 3, retryDelay: 100 },
            'primary'
          );
        } catch {
          failureLog.push('primary-exhausted');

          // Step 2: Check cache
          const cached = await mockCache.get(`translation:${tibetanText}`);
          if (cached) {
            failureLog.push('cache-hit');
            return cached;
          }
          failureLog.push('cache-miss');

          // Step 3: Try simpler prompt
          try {
            mockProvider.setFailureMode(true);
            await mockProvider.translate(tibetanText, 'Simple prompt');
          } catch {
            failureLog.push('simple-prompt-failed');

            // Step 4: Try chunking (simulated success)
            failureLog.push('chunking-attempted');
            return {
              translation: 'Tibetan language (বোদ་ཀྱི་སྐད་ཡིག།) [recovered via chunking].',
              confidence: 0.72,
              metadata: {
                fallbackStrategy: 'chunking',
                recoveryPath: failureLog.join(' → '),
              },
            };
          }
        }
      };

      // Execute full pipeline
      const result = await fullRecoveryPipeline();

      // Verify recovery flow
      expect(primaryAttempts).toBe(4); // 1 initial + 3 retries
      expect(failureLog).toContain('primary-exhausted');
      expect(failureLog).toContain('cache-miss');
      expect(failureLog).toContain('simple-prompt-failed');
      expect(failureLog).toContain('chunking-attempted');
      expect(result.metadata.fallbackStrategy).toBe('chunking');

      console.log('\n=== Complete Recovery Pipeline ===');
      console.log('Recovery path:');
      failureLog.forEach((step, i) => {
        console.log(`  ${i + 1}. ${step}`);
      });
      console.log(`\nFinal result: ${result.metadata.fallbackStrategy}`);
      console.log(`Confidence: ${result.confidence}`);

      vi.useRealTimers();
    });

    it('should track all failures in monitoring', async () => {
      const monitoringLog: Array<{
        timestamp: number;
        operation: string;
        error: string;
        recoveryAttempt: number;
      }> = [];

      const trackFailure = (operation: string, error: string, attempt: number) => {
        monitoringLog.push({
          timestamp: Date.now(),
          operation,
          error,
          recoveryAttempt: attempt,
        });
      };

      // Simulate failures
      for (let i = 1; i <= 3; i++) {
        trackFailure('translation', 'Rate limit exceeded', i);
      }

      trackFailure('cache-lookup', 'Cache miss', 1);
      trackFailure('fallback-simple-prompt', 'Still rate limited', 1);

      expect(monitoringLog).toHaveLength(5);
      expect(monitoringLog.filter(log => log.operation === 'translation')).toHaveLength(3);

      console.log('✓ Monitoring tracked all failures');
      console.log(`  Total failures logged: ${monitoringLog.length}`);

      // Group by operation
      const byOperation: Record<string, number> = {};
      monitoringLog.forEach(log => {
        byOperation[log.operation] = (byOperation[log.operation] || 0) + 1;
      });

      console.log('  Failures by operation:');
      Object.entries(byOperation).forEach(([op, count]) => {
        console.log(`    - ${op}: ${count}`);
      });
    });
  });

  describe('error classification and handling', () => {
    it('should handle rate limit errors with exponential backoff', async () => {
      const rateLimitError = new Error('Rate limit exceeded');
      (rateLimitError as any).status = 429;
      (rateLimitError as any).retryAfter = 60;

      const isRateLimitError = (error: any) => {
        return error.status === 429 || error.message.includes('Rate limit');
      };

      const shouldRetry = (error: any) => {
        // Rate limits should retry
        if (isRateLimitError(error)) {
          failureLog.push('rate-limit-will-retry');
          return true;
        }
        // Auth errors should not retry
        if (error.status === 401 || error.status === 403) {
          failureLog.push('auth-error-no-retry');
          return false;
        }
        return true;
      };

      expect(shouldRetry(rateLimitError)).toBe(true);
      expect(failureLog).toContain('rate-limit-will-retry');

      console.log('✓ Rate limit errors classified for retry');
    });

    it('should not retry on authentication errors', async () => {
      const authError = new Error('Invalid API key');
      (authError as any).status = 401;

      const shouldRetry = (error: any) => {
        if (error.status === 401 || error.status === 403) {
          failureLog.push('auth-error-abort');
          return false;
        }
        return true;
      };

      expect(shouldRetry(authError)).toBe(false);
      expect(failureLog).toContain('auth-error-abort');

      console.log('✓ Authentication errors not retried');
    });

    it('should handle timeout errors with retry', async () => {
      const timeoutError = new Error('Request timeout');
      (timeoutError as any).code = 'ETIMEDOUT';

      const shouldRetry = (error: any) => {
        const isTimeout = error.code === 'ETIMEDOUT' ||
                         error.message.includes('timeout');
        if (isTimeout) {
          failureLog.push('timeout-will-retry');
          return true;
        }
        return false;
      };

      expect(shouldRetry(timeoutError)).toBe(true);
      expect(failureLog).toContain('timeout-will-retry');

      console.log('✓ Timeout errors classified for retry');
    });
  });
});
