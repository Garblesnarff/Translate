/**
 * ValidationService
 *
 * Pluggable validator system for input and output validation
 * Aggregates results from multiple validators
 *
 * @module ValidationService
 */

import { Validator, ValidationResult, ValidatorResult, OutputValidationData } from './types';
import { TibetanContentValidator } from './validators/TibetanContentValidator';
import { LengthValidator } from './validators/LengthValidator';
import { UnicodeValidator } from './validators/UnicodeValidator';
import { FormatValidator } from './validators/FormatValidator';
import { PreservationValidator } from './validators/PreservationValidator';

/**
 * Main validation service that orchestrates multiple validators
 */
export class ValidationService {
  private inputValidators: Validator[];
  private outputValidators: Validator[];

  constructor() {
    // Initialize input validators
    this.inputValidators = [
      new TibetanContentValidator(),
      new LengthValidator(),
      new UnicodeValidator(),
    ];

    // Initialize output validators
    this.outputValidators = [
      new FormatValidator(),
      new PreservationValidator(),
    ];
  }

  /**
   * Validate data at a specific stage (input or output)
   *
   * @param data - Data to validate (string for input, object for output)
   * @param stage - Validation stage ('input' or 'output')
   * @returns Aggregated validation result
   */
  public validate(data: any, stage: 'input' | 'output'): ValidationResult {
    const validators = stage === 'input' ? this.inputValidators : this.outputValidators;

    // Run all validators for this stage
    const validatorResults: ValidatorResult[] = [];
    const allErrors: string[] = [];
    const allWarnings: string[] = [];
    const allMetadata: Record<string, any> = {};

    for (const validator of validators) {
      const result = validator.validate(data);

      // Store individual validator result
      validatorResults.push({
        validator: validator.name,
        isValid: result.isValid,
        errors: result.errors,
        warnings: result.warnings,
        metadata: result.metadata,
      });

      // Aggregate errors and warnings
      allErrors.push(...result.errors);
      allWarnings.push(...result.warnings);

      // Merge metadata
      if (result.metadata) {
        Object.assign(allMetadata, result.metadata);
      }
    }

    // Overall result is valid only if all validators pass
    const isValid = allErrors.length === 0;

    return {
      isValid,
      errors: allErrors,
      warnings: allWarnings,
      validatorResults,
      metadata: Object.keys(allMetadata).length > 0 ? allMetadata : undefined,
    };
  }

  /**
   * Add a custom validator
   *
   * @param validator - Validator to add
   */
  public addValidator(validator: Validator): void {
    if (validator.stage === 'input') {
      this.inputValidators.push(validator);
    } else {
      this.outputValidators.push(validator);
    }
  }

  /**
   * Remove a validator by name
   *
   * @param name - Name of the validator to remove
   * @param stage - Stage of the validator
   */
  public removeValidator(name: string, stage: 'input' | 'output'): void {
    if (stage === 'input') {
      this.inputValidators = this.inputValidators.filter(v => v.name !== name);
    } else {
      this.outputValidators = this.outputValidators.filter(v => v.name !== name);
    }
  }

  /**
   * Get list of all validators for a stage
   *
   * @param stage - Validation stage
   * @returns Array of validator names
   */
  public getValidators(stage: 'input' | 'output'): string[] {
    const validators = stage === 'input' ? this.inputValidators : this.outputValidators;
    return validators.map(v => v.name);
  }
}
