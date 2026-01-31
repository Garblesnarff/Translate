/**
 * Integration Test: Full Error Recovery Flow
 *
 * Tests the complete error recovery pipeline:
 * 1. Primary provider fails (rate limit)
 * 2. Retry handler retries 3 times
 * 3. Circuit breaker opens after 5 failures
 * 4. Fallback strategies activated
 * 5. Result returned with fallback metadata
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RetryHandler } from '../../server/services/retry/RetryHandler';
import { CircuitBreaker, CircuitState } from '../../server/services/retry/CircuitBreaker';
import { FallbackOrchestrator } from '../../server/services/fallback/FallbackOrchestrator';
import { SimplerPromptStrategy } from '../../server/services/fallback/strategies/SimplerPromptStrategy';
import { AlternativeModelStrategy } from '../../server/services/fallback/strategies/AlternativeModelStrategy';
import { SmallerChunkStrategy } from '../../server/services/fallback/strategies/SmallerChunkStrategy';
import { ManualReviewStrategy } from '../../server/services/fallback/strategies/ManualReviewStrategy';

describe('Error Recovery Integration', () => {
  let retryHandler: RetryHandler;
  let fallbackOrchestrator: FallbackOrchestrator;

  beforeEach(() => {
    vi.useFakeTimers();
    retryHandler = new RetryHandler();
    fallbackOrchestrator = new FallbackOrchestrator();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should complete full error recovery flow', async () => {
    const timeline: string[] = [];
    let primaryCallCount = 0;

    // Mock primary translation service that always fails with rate limit
    const primaryTranslate = vi.fn(async () => {
      primaryCallCount++;
      timeline.push(`primary-attempt-${primaryCallCount}`);
      const error = new Error('Rate limit exceeded');
      (error as any).status = 429;
      throw error;
    });

    // Mock fallback strategies
    const mockTranslationService = {
      translate: vi.fn()
    };

    const mockProviderService = {
      getNextProvider: vi.fn().mockReturnValue(null)
    };

    const mockReviewQueue = {
      add: vi.fn().mockResolvedValue('review-123')
    };

    // Setup strategies
    const simplerPrompt = new SimplerPromptStrategy(mockTranslationService);
    vi.spyOn(simplerPrompt, 'execute').mockImplementation(async () => {
      timeline.push('fallback-simpler-prompt');
      throw new Error('Simpler prompt failed');
    });

    const alternativeModel = new AlternativeModelStrategy(mockProviderService);
    vi.spyOn(alternativeModel, 'execute').mockImplementation(async () => {
      timeline.push('fallback-alternative-model');
      throw new Error('No alternative models available');
    });

    const smallerChunk = new SmallerChunkStrategy(mockTranslationService);
    vi.spyOn(smallerChunk, 'execute').mockImplementation(async () => {
      timeline.push('fallback-smaller-chunks');
      return {
        translation: 'Success via smaller chunks (བཀྲ་ཤིས་བདེ་ལེགས།)',
        confidence: 0.78,
        metadata: {
          fallbackStrategy: 'SMALLER_CHUNKS',
          chunksUsed: 2
        }
      };
    });

    fallbackOrchestrator.registerStrategy(simplerPrompt);
    fallbackOrchestrator.registerStrategy(alternativeModel);
    fallbackOrchestrator.registerStrategy(smallerChunk);

    // Execute with retry and fallback
    const executeWithFallback = async () => {
      try {
        return await retryHandler.executeWithRetry(
          primaryTranslate,
          { maxRetries: 3 },
          'translation-service'
        );
      } catch (error) {
        timeline.push('initiating-fallback');
        return await fallbackOrchestrator.executeFallback(
          {
            text: 'བཀྲ་ཤིས་བདེ་ལེགས།',
            pageNumber: 1,
            context: {}
          },
          error as Error
        );
      }
    };

    const promise = executeWithFallback();
    await vi.runAllTimersAsync();
    const result = await promise;

    // Verify timeline
    expect(timeline).toEqual([
      'primary-attempt-1',
      'primary-attempt-2',
      'primary-attempt-3',
      'primary-attempt-4', // Initial + 3 retries
      'initiating-fallback',
      'fallback-simpler-prompt',
      'fallback-alternative-model',
      'fallback-smaller-chunks'
    ]);

    // Verify result
    expect(result.translation).toBe('Success via smaller chunks (བཀྲ་ཤིས་བདེ་ལེགས།)');
    expect(result.confidence).toBe(0.78);
    expect(result.metadata.fallbackStrategy).toBe('SMALLER_CHUNKS');
    expect(result.metadata.chunksUsed).toBe(2);
  });

  it('should open circuit breaker after repeated failures', async () => {
    let callCount = 0;

    const primaryTranslate = vi.fn(async () => {
      callCount++;
      const error = new Error('Service error');
      (error as any).status = 500;
      throw error;
    });

    // Make 5 failed attempts to open circuit
    for (let i = 0; i < 5; i++) {
      try {
        await retryHandler.executeWithRetry(
          primaryTranslate,
          { maxRetries: 0 },
          'translation-service'
        );
      } catch (error) {
        // Expected to fail
      }
      await vi.runAllTimersAsync();
    }

    expect(callCount).toBe(5);

    // Circuit should be open now
    const state = retryHandler.getCircuitBreakerState('translation-service');
    expect(state).toBe(CircuitState.OPEN);

    // Next attempt should fail immediately without calling function
    await expect(
      retryHandler.executeWithRetry(
        primaryTranslate,
        { maxRetries: 0 },
        'translation-service'
      )
    ).rejects.toThrow('Circuit breaker is open');

    expect(callCount).toBe(5); // Should not have increased
  });

  it('should recover after circuit breaker timeout', async () => {
    let callCount = 0;

    const primaryTranslate = vi.fn(async () => {
      callCount++;
      if (callCount <= 5) {
        const error = new Error('Service error');
        throw error;
      }
      return 'Success after recovery';
    });

    // Open circuit breaker
    for (let i = 0; i < 5; i++) {
      try {
        await retryHandler.executeWithRetry(
          primaryTranslate,
          { maxRetries: 0 },
          'translation-service'
        );
      } catch (error) {
        // Expected
      }
      await vi.runAllTimersAsync();
    }

    // Circuit should be open
    expect(retryHandler.getCircuitBreakerState('translation-service')).toBe(CircuitState.OPEN);

    // Wait for circuit breaker timeout (60 seconds)
    vi.advanceTimersByTime(60000);

    // Should now allow attempt (HALF_OPEN)
    const promise = retryHandler.executeWithRetry(
      primaryTranslate,
      { maxRetries: 0 },
      'translation-service'
    );
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result).toBe('Success after recovery');

    // After one success, should still be HALF_OPEN (needs 2 successes to close)
    expect(retryHandler.getCircuitBreakerState('translation-service')).toBe(CircuitState.HALF_OPEN);

    // Make another successful call to fully close the circuit
    const promise2 = retryHandler.executeWithRetry(
      primaryTranslate,
      { maxRetries: 0 },
      'translation-service'
    );
    await vi.runAllTimersAsync();
    await promise2;

    // Now circuit should be fully closed
    expect(retryHandler.getCircuitBreakerState('translation-service')).toBe(CircuitState.CLOSED);
  });

  it('should use fallback when all retries exhausted', async () => {
    let primaryAttempts = 0;

    const primaryTranslate = vi.fn(async () => {
      primaryAttempts++;
      const error = new Error('Rate limit exceeded');
      (error as any).status = 429;
      throw error;
    });

    const mockTranslationService = {
      translate: vi.fn().mockResolvedValue({
        translation: 'Fallback translation (བཀྲ་ཤིས་བདེ་ལེགས།)',
        confidence: 0.72
      })
    };

    const simplerPrompt = new SimplerPromptStrategy(mockTranslationService);
    fallbackOrchestrator.registerStrategy(simplerPrompt);

    const executeWithFallback = async () => {
      try {
        return await retryHandler.executeWithRetry(
          primaryTranslate,
          { maxRetries: 2 }
        );
      } catch (error) {
        return await fallbackOrchestrator.executeFallback(
          {
            text: 'བཀྲ་ཤིས་བདེ་ལེགས།',
            pageNumber: 1,
            context: {}
          },
          error as Error
        );
      }
    };

    const promise = executeWithFallback();
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(primaryAttempts).toBe(3); // Initial + 2 retries
    expect(result.translation).toBe('Fallback translation (བཀྲ་ཤིས་བདེ་ལེགས།)');
    expect(result.metadata.fallbackStrategy).toBe('SIMPLER_PROMPT');
  });

  it('should escalate to manual review when all strategies fail', async () => {
    const primaryTranslate = vi.fn(async () => {
      const error = new Error('Translation failed');
      throw error;
    });

    const mockTranslationService = {
      translate: vi.fn().mockRejectedValue(new Error('Failed'))
    };

    const mockProviderService = {
      getNextProvider: vi.fn().mockReturnValue(null)
    };

    const mockReviewQueue = {
      add: vi.fn().mockResolvedValue('review-456')
    };

    // Setup strategies that all fail except manual review
    const simplerPrompt = new SimplerPromptStrategy(mockTranslationService);
    const alternativeModel = new AlternativeModelStrategy(mockProviderService);
    const smallerChunk = new SmallerChunkStrategy(mockTranslationService);
    const manualReview = new ManualReviewStrategy(mockReviewQueue);

    fallbackOrchestrator.registerStrategy(simplerPrompt);
    fallbackOrchestrator.registerStrategy(alternativeModel);
    fallbackOrchestrator.registerStrategy(smallerChunk);
    fallbackOrchestrator.registerStrategy(manualReview);

    const executeWithFallback = async () => {
      try {
        return await retryHandler.executeWithRetry(
          primaryTranslate,
          { maxRetries: 1 }
        );
      } catch (error) {
        return await fallbackOrchestrator.executeFallback(
          {
            text: 'བཀྲ་ཤིས་བདེ་ལེགས།',
            pageNumber: 7,
            context: {}
          },
          error as Error
        );
      }
    };

    const promise = executeWithFallback();
    await vi.runAllTimersAsync();
    const result = await promise;

    // Should escalate to manual review
    expect(result.confidence).toBe(0);
    expect(result.metadata.requiresManualReview).toBe(true);
    expect(result.metadata.fallbackStrategy).toBe('MANUAL_REVIEW');
    expect(mockReviewQueue.add).toHaveBeenCalled();
  });

  it('should handle mixed success/failure scenarios', async () => {
    let callCount = 0;

    const primaryTranslate = vi.fn(async () => {
      callCount++;
      if (callCount < 3) {
        const error = new Error('Temporary error');
        (error as any).code = 'ECONNREFUSED';
        throw error;
      }
      return 'Success after retries';
    });

    const promise = retryHandler.executeWithRetry(primaryTranslate);
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result).toBe('Success after retries');
    expect(callCount).toBe(3);

    // Circuit should still be closed (success resets it)
    expect(retryHandler.getCircuitBreakerState('default')).toBe(CircuitState.CLOSED);
  });

  it('should preserve error context through recovery flow', async () => {
    const originalError = new Error('Original failure');
    (originalError as any).status = 503;
    (originalError as any).details = { reason: 'Maintenance' };

    const primaryTranslate = vi.fn(async () => {
      throw originalError;
    });

    const mockReviewQueue = {
      add: vi.fn().mockResolvedValue('review-789')
    };

    const manualReview = new ManualReviewStrategy(mockReviewQueue);
    vi.spyOn(manualReview, 'execute').mockImplementation(async (request) => {
      return {
        translation: '',
        confidence: 0,
        metadata: {
          requiresManualReview: true,
          fallbackStrategy: 'MANUAL_REVIEW',
          originalError: request.context?.originalError
        }
      };
    });

    fallbackOrchestrator.registerStrategy(manualReview);

    const executeWithFallback = async () => {
      try {
        return await retryHandler.executeWithRetry(
          primaryTranslate,
          { maxRetries: 1 }
        );
      } catch (error) {
        return await fallbackOrchestrator.executeFallback(
          {
            text: 'བཀྲ་ཤིས་བདེ་ལེགས།',
            pageNumber: 1,
            context: {
              originalError: error
            }
          },
          error as Error
        );
      }
    };

    const promise = executeWithFallback();
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result.metadata.originalError).toBeDefined();
  });

  it('should track metrics throughout recovery pipeline', async () => {
    const metrics = {
      retryAttempts: 0,
      fallbackAttempts: 0,
      successfulStrategy: null as string | null
    };

    const primaryTranslate = vi.fn(async () => {
      const error = new Error('Rate limit');
      (error as any).status = 429;
      throw error;
    });

    const onRetry = vi.fn((error, attempt, delay) => {
      metrics.retryAttempts = attempt;
    });

    const mockTranslationService = {
      translate: vi.fn().mockResolvedValue({
        translation: 'Success',
        confidence: 0.8
      })
    };

    const simplerPrompt = new SimplerPromptStrategy(mockTranslationService);
    vi.spyOn(simplerPrompt, 'execute').mockImplementation(async () => {
      metrics.fallbackAttempts++;
      metrics.successfulStrategy = 'SIMPLER_PROMPT';
      return {
        translation: 'Success',
        confidence: 0.8,
        metadata: { fallbackStrategy: 'SIMPLER_PROMPT' }
      };
    });

    fallbackOrchestrator.registerStrategy(simplerPrompt);

    const executeWithFallback = async () => {
      try {
        return await retryHandler.executeWithRetry(
          primaryTranslate,
          { maxRetries: 3, onRetry }
        );
      } catch (error) {
        return await fallbackOrchestrator.executeFallback(
          {
            text: 'བཀྲ་ཤིས་བདེ་ལེགས།',
            pageNumber: 1,
            context: {}
          },
          error as Error
        );
      }
    };

    const promise = executeWithFallback();
    await vi.runAllTimersAsync();
    await promise;

    expect(metrics.retryAttempts).toBe(3);
    expect(metrics.fallbackAttempts).toBe(1);
    expect(metrics.successfulStrategy).toBe('SIMPLER_PROMPT');
  });
});
