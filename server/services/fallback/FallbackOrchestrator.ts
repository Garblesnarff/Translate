/**
 * Fallback Orchestrator
 *
 * Executes fallback strategies in order until one succeeds.
 * Logs which strategy succeeded and tracks fallback usage in metrics.
 *
 * @author Translation Service Team
 */

import type { FallbackStrategy, TranslationRequest, TranslationResult } from './types';

/**
 * FallbackOrchestrator - Manages fallback strategy execution
 *
 * Usage:
 * ```typescript
 * const orchestrator = new FallbackOrchestrator();
 * orchestrator.registerStrategy(new SimplerPromptStrategy(service));
 * orchestrator.registerStrategy(new AlternativeModelStrategy(service));
 *
 * try {
 *   const result = await orchestrator.executeFallback(request, originalError);
 *   console.log(`Used strategy: ${result.metadata.fallbackStrategy}`);
 * } catch (error) {
 *   console.error('All fallback strategies failed');
 * }
 * ```
 */
export class FallbackOrchestrator {
  private strategies: FallbackStrategy[] = [];

  /**
   * Register a fallback strategy
   *
   * @param strategy - Strategy to register
   */
  public registerStrategy(strategy: FallbackStrategy): void {
    this.strategies.push(strategy);
  }

  /**
   * Execute fallback strategies in order until one succeeds
   *
   * @param request - Translation request
   * @param originalError - Original error that triggered fallback
   * @returns Translation result from successful strategy
   * @throws Error if all strategies fail
   */
  public async executeFallback(
    request: TranslationRequest,
    originalError: Error
  ): Promise<TranslationResult> {
    console.log(`[FallbackOrchestrator] Fallback initiated for page ${request.pageNumber} after error: ${originalError.message}`);

    const failedStrategies: string[] = [];

    for (const strategy of this.strategies) {
      try {
        console.log(`[FallbackOrchestrator] Trying strategy: ${strategy.name}`);
        const result = await strategy.execute(request);

        console.log(`[FallbackOrchestrator] Strategy ${strategy.name} succeeded`);

        // Add fallback metadata
        result.metadata.fallbackUsed = true;
        result.metadata.fallbackStrategy = result.metadata.fallbackStrategy || strategy.name;

        return result;

      } catch (error) {
        console.warn(`[FallbackOrchestrator] Strategy ${strategy.name} failed:`, (error as Error).message);
        failedStrategies.push(strategy.name);
      }
    }

    // All strategies failed
    console.error('[FallbackOrchestrator] All fallback strategies failed', { failedStrategies });
    throw new Error(`All fallback strategies failed: ${failedStrategies.join(', ')}`);
  }

  /**
   * Get registered strategies
   *
   * @returns Array of strategy names
   */
  public getStrategies(): string[] {
    return this.strategies.map(s => s.name);
  }

  /**
   * Clear all registered strategies
   */
  public clearStrategies(): void {
    this.strategies = [];
  }
}
