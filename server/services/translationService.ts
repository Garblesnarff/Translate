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
import { referenceTranslationService, ReferenceTranslationService } from './translation/ReferenceTranslationService';
import { QualityGateService } from './translation/QualityGateService';
import {
  TranslationConfig,
  EnhancedTranslationResult,
  TranslationChunk,
  TranslationContext,
  TranslationQuality,
  RefinementResult
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
  private referenceTranslationService: ReferenceTranslationService;
  private qualityGateService: QualityGateService;
  
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
    this.promptGenerator = new PromptGenerator(this.dictionary);
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
    this.referenceTranslationService = referenceTranslationService;
    this.qualityGateService = new QualityGateService(this.promptGenerator, oddPagesGeminiService);
  }

  /**
   * Enhanced translation method with multi-model consensus and quality analysis
   */
  private async performTwoPassTranslation(
    chunk: TranslationChunk,
    config: TranslationConfig,
    abortSignal?: AbortSignal
  ): Promise<any> { // TODO: Define a proper return type
    // First pass: initial translation and glossary extraction
    const referenceTranslations = this.referenceTranslationService.getRelevantReferences(chunk.content);
    const initialResult = await this.geminiTranslationService.performInitialTranslation(
      chunk,
      config,
      referenceTranslations,
      1,
      abortSignal
    );

    // Second pass: refinement with glossary
    const refinementPrompt = this.promptGenerator.createRefinementPrompt(
      chunk.content,
      initialResult.translation,
      [`Incorporate the following glossary: ${JSON.stringify(initialResult.glossary)}`]
    );

    const geminiService = chunk.pageNumber % 2 === 0 ? evenPagesGeminiService : oddPagesGeminiService;
    const refinedResult = await geminiService.generateContent(refinementPrompt, config.timeout, abortSignal);
    const refinedResponse = await refinedResult.response;
    const refinedTranslation = refinedResponse.text();

    return {
      translation: refinedTranslation,
      confidence: calculateConsensusConfidence(initialResult.translation, [{ translation: refinedTranslation, confidence: 0.9 }]),
      glossary: initialResult.glossary
    };
  }

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
      
      // Perform two-pass translation
      let currentTranslation: RefinementResult = await this.performTwoPassTranslation(chunk, mergedConfig, abortSignal);
      
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
      let processedTranslation = this.textProcessor.processText(currentTranslation.translation);
      
      // Phase 6: Quality Gate (if enabled)
      if (mergedConfig.enableQualityAnalysis) {
        processedTranslation = await this.qualityGateService.reviewAndRefine(chunk, processedTranslation, abortSignal);
      }

      // Phase 7: Quality Analysis (if enabled)
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
      
      const processingTime = Date.now() - startTime;
      console.log(`[TranslationService] Completed page ${chunk.pageNumber} in ${processingTime}ms`);
      
      return {
        translation: processedTranslation,
        confidence: finalConfidence,
        quality,
        modelAgreement,
        iterationsUsed,
        helperModels: helperResponses.map(r => `${r.provider}:${r.model}`),
        processingTime
      };
      
    } catch (error) {
      console.error(`[TranslationService] Translation failed for page ${chunk.pageNumber}:`, error);
      throw createTranslationError(
        error instanceof Error ? error.message : 'Enhanced translation failed',
        'ENHANCED_TRANSLATION_ERROR',
        500,
        error
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
      { pageNumber: chunk.pageNumber, content: chunk.content },
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
        'Buddhist terminology expertise'
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
}

export const translationService = new TranslationService();
