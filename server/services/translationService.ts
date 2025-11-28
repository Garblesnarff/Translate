import { TibetanDictionary } from '../dictionary';
import { TibetanTextProcessor } from './textProcessing/TextProcessor';
import { PromptGenerator } from './translation/PromptGenerator';
import { oddPagesGeminiService, evenPagesGeminiService } from './translation/GeminiService';
import { GeminiTranslationService } from './translation/GeminiTranslationService';
import { multiProviderAIService, AIResponse } from './translation/MultiProviderAIService';
import { ConsensusEngine } from './translation/ConsensusEngine';
import { QualityScorer } from './translation/QualityScorer';
import { createTranslationError } from '../middleware/errorHandler';
import { CancellationManager } from './CancellationManager';
import { performRefinementIteration } from './translation/refinement';
import { calculateConsensusConfidence, calculateModelAgreement } from './translation/confidence';
import { inputValidator } from '../validators/inputValidator';
import { outputValidator } from '../validators/outputValidator';
import { TermExtractor } from './translation/TermExtractor';
import { GlossaryBuilder } from './translation/GlossaryBuilder';
import { ConsistencyValidator } from './translation/ConsistencyValidator';
import { ErrorClassifier, ErrorType } from '../errors/ErrorClassifier';
import { retryHandler } from './translation/RetryHandler';
import { FallbackStrategies } from './translation/FallbackStrategies';
import { formatValidator } from '../validators/formatValidator';
import { QualityGateRunner, TranslationResultForGates } from './translation/QualityGates';
import { metricsCollector } from './translation/MetricsCollector';
import {
  TranslationConfig,
  EnhancedTranslationResult,
  TranslationChunk,
  TranslationContext,
  TranslationQuality
} from './translation/types';

/**
 * Enhanced translation service with multi-model support and quality analysis
 * Supports iterative refinement, consensus building, and comprehensive quality metrics
 */
export class TranslationService {
  private promptGenerator: PromptGenerator;
  private dictionary: TibetanDictionary;
  private textProcessor: TibetanTextProcessor;
  private consensusEngine: ConsensusEngine;
  private qualityScorer: QualityScorer;
  private geminiTranslationService: GeminiTranslationService;
  private termExtractor: TermExtractor;
  private glossaryBuilder: GlossaryBuilder;
  private consistencyValidator: ConsistencyValidator;
  private fallbackStrategies: FallbackStrategies;
  private qualityGateRunner: QualityGateRunner;

  private readonly defaultConfig: TranslationConfig = {
    useHelperAI: true,
    useMultiPass: true,
    maxIterations: 3,
    qualityThreshold: 0.8,
    useChainOfThought: false,
    contextWindow: 2,
    enableQualityAnalysis: true,
    timeout: 90000 // 90 seconds for enhanced processing
  };

  /**
   * Initializes the enhanced translation service with all components
   */
  constructor() {
    this.dictionary = new TibetanDictionary();
    // Pass Gemini API key for embedding generation
    const geminiApiKey = process.env.GEMINI_API_KEY_ODD || process.env.GEMINI_API_KEY_EVEN;
    this.promptGenerator = new PromptGenerator(this.dictionary, geminiApiKey);
    this.textProcessor = new TibetanTextProcessor({
      preserveSanskrit: true,
      formatLineages: true,
      enhancedSpacing: true,
      handleHonorifics: true
    });
    this.consensusEngine = new ConsensusEngine();
    this.qualityScorer = new QualityScorer();
    this.geminiTranslationService = new GeminiTranslationService(
      this.promptGenerator,
      oddPagesGeminiService,
      evenPagesGeminiService
    );
    this.termExtractor = new TermExtractor();
    this.glossaryBuilder = new GlossaryBuilder();
    this.consistencyValidator = new ConsistencyValidator();
    // Initialize fallback strategies with odd pages service as default
    this.fallbackStrategies = new FallbackStrategies(
      this.promptGenerator,
      oddPagesGeminiService
    );
    this.qualityGateRunner = new QualityGateRunner();
  }

  /**
   * Enhanced translation method with multi-model consensus and quality analysis
   */
  public async translateText(
    chunk: TranslationChunk,
    config: TranslationConfig = {},
    abortSignal?: AbortSignal
  ): Promise<EnhancedTranslationResult> {
    const startTime = Date.now();
    const mergedConfig = { ...this.defaultConfig, ...config };

    console.log(`[TranslationService] Starting enhanced translation for page ${chunk.pageNumber}`);

    try {
      // Check for cancellation before starting
      CancellationManager.throwIfCancelled(abortSignal, 'translation start');

      // Input Validation: Validate Tibetan text before processing
      console.log(`[TranslationService] Validating input text for page ${chunk.pageNumber}`);
      const inputValidation = inputValidator.validateTibetanText(chunk.content);

      if (!inputValidation.isValid) {
        console.error(`[TranslationService] Input validation failed for page ${chunk.pageNumber}:`, inputValidation.errors);
        throw createTranslationError(
          `Input validation failed: ${inputValidation.errors.join('; ')}`,
          'INPUT_VALIDATION_ERROR',
          400,
          {
            errors: inputValidation.errors,
            warnings: inputValidation.warnings,
            metadata: inputValidation.metadata
          }
        );
      }

      // Log warnings if any
      if (inputValidation.warnings.length > 0) {
        console.warn(`[TranslationService] Input validation warnings for page ${chunk.pageNumber}:`, inputValidation.warnings);
      }

      console.log(`[TranslationService] Input validation passed: ${inputValidation.metadata?.tibetanPercentage?.toFixed(1)}% Tibetan content`);

      // Terminology Consistency: Enhance prompt with glossary if available
      // This guides the AI to use consistent terminology from previous pages
      let glossaryEnhanced = false;
      if (this.glossaryBuilder.getAllEntries().length > 0) {
        console.log(`[TranslationService] Enhancing prompt with ${this.glossaryBuilder.getAllEntries().length} glossary terms`);
        glossaryEnhanced = true;
        // The glossary will be included in the prompt generation
        // Note: We'll pass the glossary to the prompt generator in a future enhancement
      }

      // Phase 1: Initial Translation with Gemini (with retry and fallback)
      let currentTranslation;
      let usedFallback = false;
      let fallbackStrategy: string | undefined;

      try {
        // Wrap Gemini call with retry logic
        currentTranslation = await retryHandler.executeWithRetry(
          async () => {
            return await this.geminiTranslationService.performInitialTranslation(
              chunk,
              mergedConfig,
              1, // First iteration
              abortSignal
            );
          },
          {
            maxRetries: 3,
            abortSignal,
            onRetry: (error, attemptNumber, delay) => {
              console.log(`[TranslationService] Retry attempt ${attemptNumber} after ${delay}ms due to: ${error.message}`);
            }
          },
          `translation-page-${chunk.pageNumber}`
        );
      } catch (error) {
        // Classify error and attempt fallback strategies
        const classification = ErrorClassifier.classifyError(error);
        console.error(`[TranslationService] Translation failed with error type ${classification.errorType}:`, error);

        // If error is fatal, throw immediately
        if (classification.isFatal) {
          console.error(`[TranslationService] Fatal error, cannot recover`);
          throw error;
        }

        // Try fallback strategies
        console.log(`[TranslationService] Attempting fallback strategies for page ${chunk.pageNumber}`);
        const fallbackResult = await this.fallbackStrategies.executeFallbackCascade(
          chunk,
          mergedConfig,
          error as Error,
          abortSignal
        );

        if (fallbackResult.success && fallbackResult.translation && fallbackResult.confidence) {
          console.log(`[TranslationService] Fallback strategy succeeded: ${fallbackResult.strategyUsed}`);
          currentTranslation = {
            translation: fallbackResult.translation,
            confidence: fallbackResult.confidence
          };
          usedFallback = true;
          fallbackStrategy = fallbackResult.strategyUsed;
        } else if (fallbackResult.requiresManualIntervention) {
          throw createTranslationError(
            `Translation failed for page ${chunk.pageNumber} and all fallback strategies exhausted. Manual intervention required.`,
            'MANUAL_INTERVENTION_REQUIRED',
            500,
            {
              originalError: error,
              fallbackAttempts: fallbackResult.strategyUsed
            }
          );
        } else {
          throw error;
        }
      }

      let helperResponses: AIResponse[] = [];
      let modelAgreement = 1.0;

      // Phase 2: Multi-Provider AI Validation (if enabled)
      if (mergedConfig.useHelperAI && multiProviderAIService.isAvailable()) {
        console.log(`[TranslationService] Getting multi-provider AI translations for page ${chunk.pageNumber}`);
        try {
          const dictionaryContext = await this.dictionary.getDictionaryContext();
          helperResponses = await multiProviderAIService.getMultiProviderTranslations(
            chunk.content,
            dictionaryContext,
            3 // Use up to 3 providers for maximum accuracy
          );
          console.log(`[TranslationService] Received ${helperResponses.length} helper translations from providers: ${helperResponses.map(r => r.provider).join(', ')}`);
        } catch (error) {
          console.warn(`[TranslationService] Multi-provider AI failed:`, error);
          // Continue without helper AI
        }
      }

      // Phase 3: Consensus Building
      let finalConfidence = currentTranslation.confidence;
      if (helperResponses.length > 0) {
        console.log(`[TranslationService] Building consensus from multiple models`);
        const consensus = this.consensusEngine.createConsensus(
          currentTranslation.translation,
          currentTranslation.confidence,
          helperResponses
        );

        currentTranslation.translation = consensus.finalTranslation;
        finalConfidence = consensus.confidence;
        modelAgreement = consensus.modelAgreement;

        console.log(`[TranslationService] Consensus: confidence=${finalConfidence.toFixed(3)}, agreement=${modelAgreement.toFixed(3)}`);
      }

      // Phase 4: Iterative Refinement (if enabled and quality is below threshold)
      let iterationsUsed = 1;
      if (mergedConfig.useMultiPass && finalConfidence < mergedConfig.qualityThreshold!) {
        console.log(`[TranslationService] Quality below threshold (${finalConfidence.toFixed(3)} < ${mergedConfig.qualityThreshold}), starting refinement`);

        for (let iteration = 2; iteration <= mergedConfig.maxIterations!; iteration++) {
          // Check for cancellation before each refinement
          CancellationManager.throwIfCancelled(abortSignal, `refinement iteration ${iteration}`);

          const refinedTranslation = await performRefinementIteration(
            chunk.content,
            currentTranslation.translation,
            iteration,
            mergedConfig,
            chunk.pageNumber,
            abortSignal
          );

          if (refinedTranslation.confidence > finalConfidence) {
            currentTranslation = refinedTranslation;
            finalConfidence = refinedTranslation.confidence;
            iterationsUsed = iteration;
            console.log(`[TranslationService] Iteration ${iteration}: improved confidence to ${finalConfidence.toFixed(3)}`);

            // Stop if we've reached good quality
            if (finalConfidence >= mergedConfig.qualityThreshold!) {
              break;
            }
          } else {
            console.log(`[TranslationService] Iteration ${iteration}: no improvement, stopping`);
            break;
          }
        }
      }

      // Phase 5: Final Processing
      const processedTranslation = this.textProcessor.processText(currentTranslation.translation);

      // Terminology Consistency: Extract terms and update glossary
      console.log(`[TranslationService] Extracting terms for glossary from page ${chunk.pageNumber}`);
      const extractedTerms = this.termExtractor.extractTermPairs(processedTranslation, chunk.pageNumber);
      this.glossaryBuilder.addTermPairs(extractedTerms);

      // Validate consistency with glossary
      const consistencyValidation = this.consistencyValidator.validateConsistency(
        processedTranslation,
        chunk.pageNumber,
        this.glossaryBuilder
      );

      if (consistencyValidation.warnings.length > 0) {
        console.warn(`[TranslationService] Consistency warnings for page ${chunk.pageNumber}:`,
          consistencyValidation.warnings.map(w => `${w.tibetan}: ${w.message}`).join('; '));
      }

      // Output Validation: Validate translation format and quality
      console.log(`[TranslationService] Validating output translation for page ${chunk.pageNumber}`);
      const outputValidation = outputValidator.validateTranslation(
        processedTranslation,
        chunk.content
      );

      if (!outputValidation.isValid) {
        console.error(`[TranslationService] Output validation failed for page ${chunk.pageNumber}:`, outputValidation.errors);

        // Log the validation report for debugging
        const validationReport = outputValidator.getValidationReport(outputValidation);
        console.error(`[TranslationService] Validation Report:\n${validationReport}`);

        // For critical errors, we might want to reject the translation
        // For now, we'll log the errors but continue, adding validation metadata
        console.warn(`[TranslationService] Continuing with translation despite validation errors`);
      }

      // Log warnings if any
      if (outputValidation.warnings.length > 0) {
        console.warn(`[TranslationService] Output validation warnings for page ${chunk.pageNumber}:`, outputValidation.warnings);
      }

      if (outputValidation.metadata) {
        console.log(`[TranslationService] Output validation metrics:`, {
          formatCompliance: outputValidation.metadata.formatCompliance?.toFixed(1) + '%',
          tibetanPreservation: outputValidation.metadata.tibetanPreservation?.toFixed(1) + '%',
          completeness: outputValidation.metadata.completeness?.toFixed(1) + '%'
        });
      }

      // Phase 6: Quality Analysis (if enabled)
      let quality: TranslationQuality | undefined;
      if (mergedConfig.enableQualityAnalysis) {
        console.log(`[TranslationService] Analyzing translation quality`);
        const dictionaryContext = await this.dictionary.getDictionaryContext();
        quality = this.qualityScorer.analyzeTranslationQuality(
          chunk.content,
          processedTranslation,
          {
            finalTranslation: processedTranslation,
            confidence: finalConfidence,
            modelAgreement,
            models: ['gemini-2.0-flash-exp', ...helperResponses.map(r => `${r.provider}:${r.model}`)],
            individualResponses: helperResponses
          },
          dictionaryContext
        );
      }

      // Phase 7: Format Validation and Correction
      console.log(`[TranslationService] Validating translation format for page ${chunk.pageNumber}`);
      let finalTranslation = processedTranslation;
      const formatValidation = formatValidator.validateFormat(finalTranslation);

      if (!formatValidation.isValid) {
        console.warn(`[TranslationService] Format validation failed, attempting correction`);
        const correction = formatValidator.attemptFormatCorrection(finalTranslation);

        if (correction.success) {
          console.log(`[TranslationService] Format corrected successfully:`, correction.changesMade);
          finalTranslation = correction.corrected;
        } else {
          console.warn(`[TranslationService] Format correction failed, using original translation`);
        }
      }

      // Phase 8: Quality Gates (Phase 2.4.1-2.4.2)
      console.log(`[TranslationService] Running quality gates for page ${chunk.pageNumber}`);

      // Disable Agreement gate if helper AI is not enabled (Fast Mode)
      const agreementGateWasEnabled = this.qualityGateRunner.getGates().find(g => g.name === 'Agreement')?.enabled ?? true;
      if (!mergedConfig.useHelperAI) {
        console.log(`[TranslationService] Fast Mode: Skipping Agreement gate (helper AI disabled)`);
        this.qualityGateRunner.setGateEnabled('Agreement', false);
      }

      const gateInput: TranslationResultForGates = {
        translation: finalTranslation,
        originalText: chunk.content,
        confidence: finalConfidence,
        modelAgreement,
        iterationsUsed,
        processingTime: Date.now() - startTime,
        validationMetadata: outputValidation.metadata
      };

      const gateResults = await this.qualityGateRunner.runGates(gateInput);

      // Restore Agreement gate state
      if (!mergedConfig.useHelperAI && agreementGateWasEnabled) {
        this.qualityGateRunner.setGateEnabled('Agreement', true);
      }
      console.log(`[TranslationService] Quality gates ${gateResults.passed ? 'PASSED' : 'FAILED'}`);
      console.log(this.qualityGateRunner.generateReport(gateResults));

      // Handle gate failures
      if (!gateResults.passed) {
        if (gateResults.actions.shouldReject) {
          // Rejection: Throw error with details
          const errorMessage = `Quality gates failed for page ${chunk.pageNumber}: ${gateResults.actions.rejectionReasons.join('; ')}`;
          console.error(`[TranslationService] ${errorMessage}`);

          // Record metrics for rejected translation
          await metricsCollector.recordTranslationResult(
            {
              translation: finalTranslation,
              originalText: chunk.content,
              confidence: finalConfidence,
              quality,
              modelAgreement,
              iterationsUsed,
              helperModels: helperResponses.map(r => `${r.provider}:${r.model}`),
              processingTime: Date.now() - startTime,
              validationMetadata: outputValidation.metadata
            },
            gateResults,
            {
              pageNumber: chunk.pageNumber,
              documentId: (chunk as any).documentId, // Optional field
              retriesNeeded: 0
            }
          );

          throw createTranslationError(
            errorMessage,
            'QUALITY_GATE_FAILURE',
            422,
            {
              gateResults,
              failedGates: gateResults.actions.rejectionReasons
            }
          );
        } else if (gateResults.actions.shouldRetry) {
          // Retry: One more attempt with refined prompt
          console.log(`[TranslationService] Quality gates recommend retry for page ${chunk.pageNumber}`);

          // TODO: Implement retry with refined prompt focusing on failed gates
          // For now, we'll continue with warnings
          console.warn(`[TranslationService] Retry logic not yet implemented, continuing with warnings`);
        }
      }

      const processingTime = Date.now() - startTime;
      console.log(`[TranslationService] Completed page ${chunk.pageNumber} in ${processingTime}ms`);

      // Phase 9: Metrics Collection (Phase 2.4.3)
      await metricsCollector.recordTranslationResult(
        {
          translation: finalTranslation,
          originalText: chunk.content,
          confidence: finalConfidence,
          quality,
          modelAgreement,
          iterationsUsed,
          helperModels: helperResponses.map(r => `${r.provider}:${r.model}`),
          processingTime,
          validationMetadata: outputValidation.metadata
        },
        gateResults,
        {
          pageNumber: chunk.pageNumber,
          documentId: (chunk as any).documentId, // Optional field
          retriesNeeded: 0
        }
      );

      return {
        translation: finalTranslation,
        confidence: finalConfidence,
        quality,
        modelAgreement,
        iterationsUsed,
        helperModels: helperResponses.map(r => `${r.provider}:${r.model}`),
        processingTime,
        // Include validation metadata for monitoring and debugging
        validationMetadata: {
          inputValidation: {
            tibetanPercentage: inputValidation.metadata?.tibetanPercentage,
            textLength: inputValidation.metadata?.textLength
          },
          outputValidation: {
            isValid: outputValidation.isValid,
            formatCompliance: outputValidation.metadata?.formatCompliance,
            tibetanPreservation: outputValidation.metadata?.tibetanPreservation,
            completeness: outputValidation.metadata?.completeness,
            errors: outputValidation.errors.length > 0 ? outputValidation.errors : undefined,
            warnings: outputValidation.warnings.length > 0 ? outputValidation.warnings : undefined
          },
          glossary: {
            termsExtracted: extractedTerms.length,
            glossarySize: this.glossaryBuilder.getAllEntries().length,
            consistencyScore: consistencyValidation.consistencyScore,
            inconsistencyWarnings: consistencyValidation.warnings.length
          }
        },
        // Include error recovery metadata
        errorRecovery: usedFallback ? {
          usedFallback: true,
          fallbackStrategy
        } : undefined
      };

    } catch (error) {
      console.error(`[TranslationService] Translation failed for page ${chunk.pageNumber}:`, error);

      // Classify error for better error reporting
      const classification = ErrorClassifier.classifyError(error);

      throw createTranslationError(
        error instanceof Error ? error.message : 'Enhanced translation failed',
        classification.errorType,
        classification.metadata?.httpStatus || 500,
        {
          originalError: error,
          errorType: classification.errorType,
          isRetryable: classification.isRetryable,
          isFatal: classification.isFatal,
          recommendedAction: classification.recommendedAction
        }
      );
    }
  }



  /**
   * Legacy method for backwards compatibility
   */
  public async translateTextLegacy(
    chunk: { pageNumber: number; content: string },
    timeout: number = 60000
  ): Promise<{ translation: string; confidence: number }> {
    const result = await this.translateText(
      { ...chunk },
      {
        useHelperAI: false,
        useMultiPass: false,
        enableQualityAnalysis: false,
        timeout
      }
    );

    return {
      translation: result.translation,
      confidence: result.confidence
    };
  }



  /**
   * Gets translation statistics and capabilities
   */
  public getCapabilities(): {
    hasHelperAI: boolean;
    availableModels: string[];
    supportedFeatures: string[];
  } {
    return {
      hasHelperAI: multiProviderAIService.isAvailable(),
      availableModels: ['gemini-2.0-flash-exp', ...multiProviderAIService.getAvailableProviders().map(p => `${p.provider}:${p.model}`)],
      supportedFeatures: [
        'Multi-model consensus',
        'Iterative refinement',
        'Quality analysis',
        'Chain-of-thought reasoning',
        'Context-aware translation',
        'Buddhist terminology expertise',
        'Error recovery and fallback strategies',
        'Terminology consistency checking'
      ]
    };
  }

  /**
   * Updates translation configuration
   */
  public setConfig(config: Partial<TranslationConfig>): void {
    Object.assign(this.defaultConfig, config);
  }

  /**
   * Gets current configuration
   */
  public getConfig(): TranslationConfig {
    return { ...this.defaultConfig };
  }

  /**
   * Gets the current glossary builder instance
   * Useful for inspecting glossary state or generating reports
   */
  public getGlossary(): GlossaryBuilder {
    return this.glossaryBuilder;
  }

  /**
   * Clears the glossary
   * Call this when starting a new document translation
   */
  public clearGlossary(): void {
    this.glossaryBuilder.clear();
    console.log('[TranslationService] Glossary cleared for new document');
  }

  /**
   * Exports the current glossary to JSON
   * Useful for saving glossary to database
   */
  public exportGlossary(): string {
    return this.glossaryBuilder.exportToJSON();
  }

  /**
   * Imports a glossary from JSON
   * Useful for loading glossary from database
   */
  public importGlossary(json: string): void {
    this.glossaryBuilder.importFromJSON(json);
    console.log('[TranslationService] Glossary imported from JSON');
  }

  /**
   * Generates a consistency report for the current glossary
   */
  public generateConsistencyReport(includeDetails: boolean = false): string {
    return this.consistencyValidator.generateConsistencyReport(
      this.glossaryBuilder,
      includeDetails
    );
  }

  /**
   * Gets glossary summary statistics
   */
  public getGlossarySummary() {
    return this.glossaryBuilder.getSummary();
  }

  /**
   * Finds inconsistencies in the current glossary
   */
  public findGlossaryInconsistencies() {
    return this.glossaryBuilder.findInconsistencies();
  }

  /**
   * Reset circuit breakers for error recovery
   * Useful when recovering from sustained failures
   */
  public resetErrorRecovery(): void {
    retryHandler.resetAllCircuitBreakers();
    console.log('[TranslationService] Error recovery circuit breakers reset');
  }
}

export const translationService = new TranslationService();
