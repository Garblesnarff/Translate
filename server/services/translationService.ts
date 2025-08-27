import { GenerateContentResult } from "@google/generative-ai";
import { TibetanDictionary } from '../dictionary';
import { TibetanTextProcessor } from './textProcessing/TextProcessor';
import { PromptGenerator, PromptOptions, TranslationContext } from './translation/PromptGenerator';
import { oddPagesGeminiService, evenPagesGeminiService } from './translation/GeminiService';
import { multiProviderAIService, AIResponse } from './translation/MultiProviderAIService';
import { ConsensusEngine } from './translation/ConsensusEngine';
import { QualityScorer, TranslationQuality } from './translation/QualityScorer';
import { createTranslationError } from '../middleware/errorHandler';

export interface TranslationConfig {
  useHelperAI?: boolean;
  useMultiPass?: boolean;
  maxIterations?: number;
  qualityThreshold?: number;
  useChainOfThought?: boolean;
  contextWindow?: number;
  enableQualityAnalysis?: boolean;
  timeout?: number;
}

export interface EnhancedTranslationResult {
  translation: string;
  confidence: number;
  quality?: TranslationQuality;
  modelAgreement?: number;
  iterationsUsed?: number;
  helperModels?: string[];
  processingTime?: number;
}

export interface TranslationChunk {
  pageNumber: number;
  content: string;
  context?: TranslationContext;
}

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
  }

  /**
   * Enhanced translation method with multi-model consensus and quality analysis
   */
  public async translateText(
    chunk: TranslationChunk, 
    config: TranslationConfig = {}
  ): Promise<EnhancedTranslationResult> {
    const startTime = Date.now();
    const mergedConfig = { ...this.defaultConfig, ...config };
    
    console.log(`[TranslationService] Starting enhanced translation for page ${chunk.pageNumber}`);
    
    try {
      // Phase 1: Initial Translation with Gemini
      let currentTranslation = await this.performGeminiTranslation(
        chunk, 
        mergedConfig,
        1 // First iteration
      );
      
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
          const refinedTranslation = await this.performRefinementIteration(
            chunk.content,
            currentTranslation.translation,
            iteration,
            mergedConfig,
            chunk.pageNumber
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
   * Performs initial Gemini translation
   */
  private async performGeminiTranslation(
    chunk: TranslationChunk,
    config: TranslationConfig,
    iteration: number
  ): Promise<{ translation: string; confidence: number }> {
    const geminiService = this.getGeminiService(chunk.pageNumber);
    
    const promptOptions: PromptOptions = {
      iterationPass: iteration,
      useChainOfThought: config.useChainOfThought,
      contextWindow: config.contextWindow
    };
    
    const prompt = await this.promptGenerator.createTranslationPrompt(
      chunk.pageNumber,
      chunk.content,
      promptOptions,
      chunk.context
    );
    
    const result = await geminiService.generateContent(prompt, config.timeout);
    const response = await result.response;
    const rawTranslation = response.text();
    
    // Enhanced confidence calculation
    const confidence = this.calculateEnhancedConfidence(rawTranslation, chunk.content);
    
    return {
      translation: rawTranslation,
      confidence
    };
  }

  /**
   * Performs a refinement iteration using specialized prompts
   */
  private async performRefinementIteration(
    originalText: string,
    currentTranslation: string,
    iteration: number,
    config: TranslationConfig,
    pageNumber: number
  ): Promise<{ translation: string; confidence: number }> {
    const focusAreas = this.determineFocusAreas(currentTranslation, iteration);
    const refinementPrompt = this.promptGenerator.createRefinementPrompt(
      originalText,
      currentTranslation,
      focusAreas
    );
    
    // Use correct Gemini service based on page number
    const geminiService = this.getGeminiService(pageNumber);
    const result = await geminiService.generateContent(refinementPrompt, config.timeout);
    const response = await result.response;
    const refinedTranslation = response.text();
    
    const confidence = this.calculateEnhancedConfidence(refinedTranslation, originalText);
    
    return {
      translation: refinedTranslation,
      confidence
    };
  }

  /**
   * Determines focus areas for refinement based on iteration and current quality
   */
  private determineFocusAreas(translation: string, iteration: number): string[] {
    const focusAreas: string[] = [];
    
    switch (iteration) {
      case 2:
        focusAreas.push('Improve accuracy of Buddhist terminology');
        focusAreas.push('Enhance naturalness of English expression');
        break;
      case 3:
        focusAreas.push('Ensure consistency in technical terms');
        focusAreas.push('Perfect sentence structure and flow');
        break;
      default:
        focusAreas.push('Refine cultural and contextual nuances');
        focusAreas.push('Optimize overall readability');
    }
    
    // Add specific focus based on translation characteristics
    if (translation.match(/\([^)]*[\u0F00-\u0FFF][^)]*\)/g)?.length === 0) {
      focusAreas.push('Include Tibetan original text in parentheses');
    }
    
    return focusAreas;
  }

  /**
   * Enhanced confidence calculation with multiple factors
   */
  private calculateEnhancedConfidence(translation: string, originalText: string): number {
    let confidence = 0.6; // Base confidence
    
    // Factor 1: Dictionary term usage
    const tibetanParens = (translation.match(/\([^)]*[\u0F00-\u0FFF][^)]*\)/g) || []).length;
    confidence += Math.min(0.2, tibetanParens * 0.03);
    
    // Factor 2: Proper sentence structure
    const sentences = translation.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const properStructure = sentences.filter(s => /\([^)]*[\u0F00-\u0FFF][^)]*\)/.test(s)).length;
    if (sentences.length > 0) {
      confidence += (properStructure / sentences.length) * 0.15;
    }
    
    // Factor 3: Length appropriateness
    const lengthRatio = translation.replace(/\([^)]*\)/g, '').length / originalText.length;
    if (lengthRatio >= 0.5 && lengthRatio <= 3) {
      confidence += 0.1;
    }
    
    // Factor 4: No obvious errors
    if (!translation.includes('Error:') && !translation.includes('Failed:')) {
      confidence += 0.05;
    }
    
    return Math.min(0.98, Math.max(0.1, confidence));
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
   * Get the appropriate Gemini service based on page number
   */
  private getGeminiService(pageNumber: number) {
    return pageNumber % 2 === 0 ? evenPagesGeminiService : oddPagesGeminiService;
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