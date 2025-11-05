/**
 * Type definitions for the quality scoring system
 */

/**
 * Translation result to be scored
 */
export interface TranslationResult {
  translation: string;
  confidence?: number;
}

/**
 * Quality score for a translation
 */
export interface QualityScore {
  overall: number;      // Weighted average (0-1)
  confidence: number;   // From model (0-1)
  format: number;       // Format compliance (0-1)
  preservation: number; // Tibetan preservation (0-1)
}

/**
 * Weights for quality score calculation
 */
export interface QualityWeights {
  confidence: number;   // Default: 0.4 (40%)
  format: number;       // Default: 0.3 (30%)
  preservation: number; // Default: 0.3 (30%)
}

/**
 * Quality gate configuration
 */
export interface QualityGate {
  name: 'confidence' | 'format' | 'preservation' | 'overall';
  threshold: number;  // 0-1
  action: 'reject' | 'warn';
}

/**
 * Quality gate failure
 */
export interface GateFailure {
  gate: string;
  threshold: number;
  actual: number;
  action: 'reject' | 'warn';
  message: string;
}

/**
 * Quality gate check result
 */
export interface GateResult {
  passed: boolean;  // True if no rejections
  failures: GateFailure[];
  qualityScore: QualityScore;
}

/**
 * Quality gate service configuration
 */
export interface QualityGateConfig {
  gates?: QualityGate[];
}
