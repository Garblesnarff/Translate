/**
 * Quality Gates System
 *
 * Implements configurable quality gates for translation validation.
 * Gates can reject, warn, or trigger retry based on quality metrics.
 *
 * Phase 2.4 Implementation:
 * - Confidence Gate (≥0.7, reject if fails)
 * - Format Gate (valid format, retry if fails)
 * - Length Gate (reasonable length ratio, warn if fails)
 * - Preservation Gate (Tibetan preserved, reject if fails)
 * - Agreement Gate (≥0.6, warn if fails)
 *
 * @author Translation Service Team
 */

import { formatValidator, FormatValidationResult } from '../../validators/formatValidator';

/**
 * Action to take when a gate fails
 */
export type GateFailureAction = 'reject' | 'warn' | 'retry';

/**
 * Gate check result
 */
export interface GateCheckResult {
  passed: boolean;
  score: number;
  message?: string;
  metadata?: any;
}

/**
 * Quality Gate definition
 */
export interface QualityGate {
  name: string;
  description: string;
  check: (result: TranslationResultForGates) => Promise<GateCheckResult> | GateCheckResult;
  threshold: number; // Minimum score to pass (0-1)
  weight: number; // Importance weight (0-1)
  failureAction: GateFailureAction;
  enabled: boolean;
}

/**
 * Translation result structure for gate checks
 */
export interface TranslationResultForGates {
  translation: string;
  originalText: string;
  confidence: number;
  modelAgreement?: number;
  iterationsUsed?: number;
  processingTime?: number;
  validationMetadata?: any;
}

/**
 * Result of running all gates
 */
export interface GateRunResults {
  passed: boolean; // Overall pass/fail
  gates: {
    [gateName: string]: {
      passed: boolean;
      score: number;
      threshold: number;
      action: GateFailureAction;
      message?: string;
      metadata?: any;
    };
  };
  overallScore: number; // Weighted average of all gate scores
  actions: {
    shouldReject: boolean;
    shouldRetry: boolean;
    shouldWarn: boolean;
    warnings: string[];
    rejectionReasons: string[];
    retryReasons: string[];
  };
}

/**
 * Quality Gate Runner
 * Executes all quality gates and determines actions
 */
export class QualityGateRunner {
  private gates: QualityGate[];

  constructor(gates?: QualityGate[]) {
    this.gates = gates || this.getDefaultGates();
  }

  /**
   * Run all enabled quality gates
   */
  public async runGates(result: TranslationResultForGates): Promise<GateRunResults> {
    const gateResults: GateRunResults['gates'] = {};
    const warnings: string[] = [];
    const rejectionReasons: string[] = [];
    const retryReasons: string[] = [];

    let totalWeightedScore = 0;
    let totalWeight = 0;

    // Run each enabled gate
    for (const gate of this.gates) {
      if (!gate.enabled) continue;

      try {
        const checkResult = await Promise.resolve(gate.check(result));

        const passed = checkResult.passed && checkResult.score >= gate.threshold;

        gateResults[gate.name] = {
          passed,
          score: checkResult.score,
          threshold: gate.threshold,
          action: gate.failureAction,
          message: checkResult.message,
          metadata: checkResult.metadata
        };

        // Accumulate weighted score
        totalWeightedScore += checkResult.score * gate.weight;
        totalWeight += gate.weight;

        // Handle gate failure
        if (!passed) {
          const failureMessage = `${gate.name} failed: ${checkResult.message || 'Below threshold'}`;

          switch (gate.failureAction) {
            case 'reject':
              rejectionReasons.push(failureMessage);
              break;
            case 'retry':
              retryReasons.push(failureMessage);
              break;
            case 'warn':
              warnings.push(failureMessage);
              break;
          }
        }
      } catch (error) {
        console.error(`[QualityGates] Gate ${gate.name} failed with error:`, error);
        warnings.push(`${gate.name} check failed with error`);
      }
    }

    const overallScore = totalWeight > 0 ? totalWeightedScore / totalWeight : 0;
    const allGatesPassed = Object.values(gateResults).every(g => g.passed);

    return {
      passed: allGatesPassed,
      gates: gateResults,
      overallScore,
      actions: {
        shouldReject: rejectionReasons.length > 0,
        shouldRetry: retryReasons.length > 0 && rejectionReasons.length === 0,
        shouldWarn: warnings.length > 0,
        warnings,
        rejectionReasons,
        retryReasons
      }
    };
  }

  /**
   * Get default quality gates
   */
  private getDefaultGates(): QualityGate[] {
    return [
      // Gate 1: Confidence Gate
      {
        name: 'Confidence',
        description: 'Ensures translation confidence meets minimum threshold',
        check: (result) => ({
          passed: result.confidence >= 0.7,
          score: result.confidence,
          message: result.confidence < 0.7
            ? `Confidence ${(result.confidence * 100).toFixed(1)}% is below 70% threshold`
            : `Confidence: ${(result.confidence * 100).toFixed(1)}%`
        }),
        threshold: 0.7,
        weight: 0.3,
        failureAction: 'reject',
        enabled: true
      },

      // Gate 2: Format Gate
      {
        name: 'Format',
        description: 'Validates translation format compliance',
        check: (result) => {
          const validation = formatValidator.validateFormat(result.translation);

          const score = validation.metadata?.formatScore || 0;
          const passed = validation.isValid;

          return {
            passed,
            score,
            message: passed
              ? 'Format is valid'
              : `Format issues: ${validation.errors.join('; ')}`,
            metadata: validation.metadata
          };
        },
        threshold: 0.7,
        weight: 0.25,
        failureAction: 'retry',
        enabled: true
      },

      // Gate 3: Length Gate
      {
        name: 'Length',
        description: 'Checks if translation length is reasonable',
        check: (result) => {
          const cleanTranslation = result.translation.replace(/\([^)]*\)/g, '');
          const lengthRatio = cleanTranslation.length / result.originalText.length;

          let score = 1.0;
          let message = 'Length ratio is reasonable';

          if (lengthRatio < 0.3) {
            score = 0.3;
            message = `Translation too short: ${lengthRatio.toFixed(2)}x original length`;
          } else if (lengthRatio > 4) {
            score = 0.4;
            message = `Translation too long: ${lengthRatio.toFixed(2)}x original length`;
          } else if (lengthRatio < 0.5 || lengthRatio > 3) {
            score = 0.7;
            message = `Length ratio borderline: ${lengthRatio.toFixed(2)}x`;
          }

          return {
            passed: score >= 0.6,
            score,
            message,
            metadata: { lengthRatio }
          };
        },
        threshold: 0.6,
        weight: 0.15,
        failureAction: 'warn',
        enabled: true
      },

      // Gate 4: Preservation Gate
      {
        name: 'Preservation',
        description: 'Ensures Tibetan text is preserved in parentheses',
        check: (result) => {
          const tibetanInOriginal = (result.originalText.match(/[\u0F00-\u0FFF]/g) || []).length;
          const tibetanInTranslation = (result.translation.match(/[\u0F00-\u0FFF]/g) || []).length;

          if (tibetanInOriginal === 0) {
            return {
              passed: true,
              score: 1.0,
              message: 'No Tibetan text to preserve'
            };
          }

          const preservationRatio = tibetanInTranslation / tibetanInOriginal;
          let score = Math.min(preservationRatio, 1.0);

          // Check if Tibetan is in parentheses
          const tibetanInParens = (result.translation.match(/\([^)]*[\u0F00-\u0FFF][^)]*\)/g) || [])
            .join('')
            .match(/[\u0F00-\u0FFF]/g)?.length || 0;

          const parenthesesRatio = tibetanInTranslation > 0 ? tibetanInParens / tibetanInTranslation : 0;

          // Penalize if Tibetan is not in parentheses
          if (parenthesesRatio < 0.9) {
            score *= 0.5;
          }

          return {
            passed: preservationRatio >= 0.7 && parenthesesRatio >= 0.9,
            score,
            message: preservationRatio < 0.7
              ? `Only ${(preservationRatio * 100).toFixed(1)}% of Tibetan preserved`
              : parenthesesRatio < 0.9
              ? `Some Tibetan text outside parentheses`
              : `Tibetan preservation: ${(preservationRatio * 100).toFixed(1)}%`,
            metadata: { preservationRatio, parenthesesRatio }
          };
        },
        threshold: 0.7,
        weight: 0.2,
        failureAction: 'reject',
        enabled: true
      },

      // Gate 5: Agreement Gate
      {
        name: 'Agreement',
        description: 'Checks model agreement for multi-model translations',
        check: (result) => {
          const agreement = result.modelAgreement || 1.0;

          return {
            passed: agreement >= 0.6,
            score: agreement,
            message: agreement < 0.6
              ? `Low model agreement: ${(agreement * 100).toFixed(1)}%`
              : `Model agreement: ${(agreement * 100).toFixed(1)}%`,
            metadata: { modelAgreement: agreement }
          };
        },
        threshold: 0.6,
        weight: 0.1,
        failureAction: 'warn',
        enabled: true
      }
    ];
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

  /**
   * Enable/disable a gate
   */
  public setGateEnabled(name: string, enabled: boolean): void {
    const gate = this.gates.find(g => g.name === name);
    if (gate) {
      gate.enabled = enabled;
    }
  }

  /**
   * Update gate threshold
   */
  public setGateThreshold(name: string, threshold: number): void {
    const gate = this.gates.find(g => g.name === name);
    if (gate) {
      gate.threshold = Math.max(0, Math.min(1, threshold));
    }
  }

  /**
   * Get all gates
   */
  public getGates(): QualityGate[] {
    return [...this.gates];
  }

  /**
   * Get enabled gates
   */
  public getEnabledGates(): QualityGate[] {
    return this.gates.filter(g => g.enabled);
  }

  /**
   * Generate a human-readable report
   */
  public generateReport(results: GateRunResults): string {
    let report = '=== QUALITY GATES REPORT ===\n\n';

    report += `Overall Status: ${results.passed ? '✓ PASSED' : '✗ FAILED'}\n`;
    report += `Overall Score: ${(results.overallScore * 100).toFixed(1)}%\n\n`;

    report += 'GATE RESULTS:\n';
    for (const [name, gateResult] of Object.entries(results.gates)) {
      const status = gateResult.passed ? '✓' : '✗';
      const score = (gateResult.score * 100).toFixed(1);
      const threshold = (gateResult.threshold * 100).toFixed(1);

      report += `  ${status} ${name}: ${score}% (threshold: ${threshold}%)\n`;

      if (gateResult.message) {
        report += `     ${gateResult.message}\n`;
      }
    }

    if (results.actions.shouldReject) {
      report += '\n❌ REJECTION REASONS:\n';
      results.actions.rejectionReasons.forEach(reason => {
        report += `  - ${reason}\n`;
      });
    }

    if (results.actions.shouldRetry) {
      report += '\n🔄 RETRY RECOMMENDED:\n';
      results.actions.retryReasons.forEach(reason => {
        report += `  - ${reason}\n`;
      });
    }

    if (results.actions.shouldWarn) {
      report += '\n⚠️  WARNINGS:\n';
      results.actions.warnings.forEach(warning => {
        report += `  - ${warning}\n`;
      });
    }

    return report;
  }
}

// Export default instance
export const defaultQualityGateRunner = new QualityGateRunner();
