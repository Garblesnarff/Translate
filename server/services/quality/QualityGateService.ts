/**
 * QualityGateService
 *
 * Implements quality gates that reject or warn on low-quality translations
 *
 * @module QualityGateService
 */

import { QualityScorer } from './QualityScorer';
import {
  TranslationResult,
  QualityGate,
  GateResult,
  GateFailure,
  QualityGateConfig,
} from './types';

/**
 * Default quality gates
 */
const DEFAULT_GATES: QualityGate[] = [
  { name: 'confidence', threshold: 0.7, action: 'reject' },
  { name: 'format', threshold: 0.8, action: 'warn' },
  { name: 'preservation', threshold: 0.7, action: 'reject' },
];

/**
 * Quality gate service that checks translation quality
 */
export class QualityGateService {
  private scorer: QualityScorer;
  private gates: QualityGate[];

  constructor(scorer: QualityScorer, config?: QualityGateConfig) {
    this.scorer = scorer;
    this.gates = config?.gates ?? DEFAULT_GATES;
  }

  /**
   * Check translation against quality gates
   *
   * @param result - Translation result
   * @param original - Original text
   * @returns Gate check result
   */
  public check(result: TranslationResult, original: string): GateResult {
    // Calculate quality score
    const qualityScore = this.scorer.score(result, original);

    // Check each gate
    const failures: GateFailure[] = [];

    for (const gate of this.gates) {
      const actual = this.getScoreValue(qualityScore, gate.name);

      if (actual < gate.threshold) {
        failures.push({
          gate: gate.name,
          threshold: gate.threshold,
          actual,
          action: gate.action,
          message: this.generateFailureMessage(gate.name, actual, gate.threshold, gate.action),
        });
      }
    }

    // Determine if passed (no rejections)
    const rejections = failures.filter(f => f.action === 'reject');
    const passed = rejections.length === 0;

    return {
      passed,
      failures,
      qualityScore,
    };
  }

  /**
   * Get score value for a specific gate
   */
  private getScoreValue(qualityScore: any, gateName: string): number {
    switch (gateName) {
      case 'confidence':
        return qualityScore.confidence;
      case 'format':
        return qualityScore.format;
      case 'preservation':
        return qualityScore.preservation;
      case 'overall':
        return qualityScore.overall;
      default:
        return 0;
    }
  }

  /**
   * Generate failure message
   */
  private generateFailureMessage(
    gateName: string,
    actual: number,
    threshold: number,
    action: 'reject' | 'warn'
  ): string {
    const actionText = action === 'reject' ? 'fails' : 'warning';
    const actualPercent = (actual * 100).toFixed(1);
    const thresholdPercent = (threshold * 100).toFixed(1);

    switch (gateName) {
      case 'confidence':
        return `Translation confidence ${actionText}: ${actualPercent}% (threshold: ${thresholdPercent}%)`;
      case 'format':
        return `Translation format ${actionText}: ${actualPercent}% compliance (threshold: ${thresholdPercent}%)`;
      case 'preservation':
        return `Tibetan preservation ${actionText}: ${actualPercent}% (threshold: ${thresholdPercent}%)`;
      case 'overall':
        return `Overall quality ${actionText}: ${actualPercent}% (threshold: ${thresholdPercent}%)`;
      default:
        return `Quality gate "${gateName}" ${actionText}: ${actualPercent}% (threshold: ${thresholdPercent}%)`;
    }
  }

  /**
   * Get configured gates
   */
  public getGates(): QualityGate[] {
    return [...this.gates];
  }

  /**
   * Add a custom gate
   */
  public addGate(gate: QualityGate): void {
    this.gates.push(gate);
  }

  /**
   * Remove a gate by name
   */
  public removeGate(name: string): void {
    this.gates = this.gates.filter(g => g.name !== name);
  }
}
