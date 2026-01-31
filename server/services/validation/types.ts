/**
 * Type definitions for the validation system
 */

/**
 * Validation result returned by validators
 */
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  validatorResults?: ValidatorResult[];
  metadata?: Record<string, any>;
  normalizedText?: string; // For UnicodeValidator
}

/**
 * Result from a single validator
 */
export interface ValidatorResult {
  validator: string;
  isValid: boolean;
  errors: string[];
  warnings: string[];
  metadata?: Record<string, any>;
}

/**
 * Validator interface that all validators must implement
 */
export interface Validator {
  name: string;
  stage: 'input' | 'output';
  validate(data: any): ValidationResult;
}

/**
 * Data structure for output validation
 */
export interface OutputValidationData {
  translation: string;
  original: string;
  confidence?: number;
}
