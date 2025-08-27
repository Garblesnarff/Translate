import type { Express, Request, Response, NextFunction } from "express";
import fileUpload from 'express-fileupload';
import { splitTextIntoChunks } from "../client/src/lib/textChunker";
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { requestLogger } from './middleware/requestLogger';
import { errorHandler, createTranslationError } from './middleware/errorHandler';
import { translationService, TranslationConfig } from './services/translationService';
import { TibetanDictionary } from './dictionary';
import { PDFGenerator } from './services/pdf/PDFGenerator';

/**
 * Schema for validating translation requests
 */
const TranslationRequestSchema = z.object({
  text: z.string().min(1).max(100000),
});

// Configure rate limiter
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Too many translation requests, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Registers all application routes and middleware
 * @param app Express application instance
 */
export function registerRoutes(app: Express) {
  // Enable trust proxy to properly handle X-Forwarded-For header
  app.set('trust proxy', 1);
  
  // Enable file upload middleware
  app.use(fileUpload({
    limits: { fileSize: 50 * 1024 * 1024 }, // 50MB max file size
    abortOnLimit: true
  }));

  // Dictionary is initialized and managed by the translation service
  const dictionary = new TibetanDictionary();

  // Dictionary is built-in and initialized on server start
  app.get('/api/dictionary/entries', 
    limiter,
    requestLogger,
    async (_req: Request, res: Response, next: NextFunction) => {
      try {
        const context = await dictionary.getDictionaryContext();
        res.json({ entries: context });
      } catch (error) {
        next(error);
      }
    }
  );

app.post('/api/generate-pdf', 
  limiter,
  requestLogger,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const pages = req.body.pages;
      if (!Array.isArray(pages)) {
        throw createTranslationError('Invalid pages data', 'INVALID_INPUT', 400);
      }

      const pdfGenerator = new PDFGenerator();
      const pdfBuffer = await pdfGenerator.generatePDF(pages);
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename=translation.pdf');
      res.send(pdfBuffer);
    } catch (error) {
      next(error);
    }
  }
);

app.post('/api/translate', 
    limiter,
    requestLogger,
    async (req: Request, res: Response, next: NextFunction) => {
      const startTime = Date.now();

      try {
        const validatedData = TranslationRequestSchema.parse(req.body);
        const { text } = validatedData;

        const chunks = splitTextIntoChunks(text);
        if (chunks.length === 0) {
          throw createTranslationError(
            'No valid text chunks found',
            'INVALID_TEXT',
            400
          );
        }

        const translations = [];
        const errors = [];
        let confidenceScores = [];

        console.log('Starting parallel translation in pairs...');
        const results = [];

        // Determine translation configuration based on query parameters or defaults
        const useEnhancedMode = req.query.enhanced !== 'false'; // Default to enhanced mode
        const translationConfig: TranslationConfig = {
          useHelperAI: req.query.useHelperAI !== 'false',
          useMultiPass: req.query.useMultiPass !== 'false',
          maxIterations: parseInt(req.query.maxIterations as string) || 3,
          qualityThreshold: parseFloat(req.query.qualityThreshold as string) || 0.8,
          useChainOfThought: req.query.useChainOfThought === 'true',
          enableQualityAnalysis: req.query.enableQualityAnalysis !== 'false',
          timeout: 120000 // 2 minutes for enhanced processing
        };

        console.log(`Translation mode: ${useEnhancedMode ? 'Enhanced' : 'Legacy'}`);
        console.log(`Helper AI: ${translationConfig.useHelperAI ? 'Enabled' : 'Disabled'}`);
        console.log(`Multi-pass: ${translationConfig.useMultiPass ? 'Enabled' : 'Disabled'}`);

        // Process chunks in pairs using the enhanced translation service
        for (let i = 0; i < chunks.length; i += 2) {
          const currentPair = [];
          
          // First chunk of the pair
          currentPair.push(
            (async () => {
              try {
                console.log(`Starting translation for page ${chunks[i].pageNumber}`);
                
                if (useEnhancedMode) {
                  const result = await translationService.translateText(
                    {
                      pageNumber: chunks[i].pageNumber,
                      content: chunks[i].content
                    },
                    translationConfig
                  );
                  
                  console.log(`Page ${chunks[i].pageNumber} completed:`, {
                    confidence: result.confidence.toFixed(3),
                    modelAgreement: result.modelAgreement?.toFixed(3),
                    iterations: result.iterationsUsed,
                    models: result.helperModels?.length || 1,
                    quality: result.quality?.grade,
                    processingTime: result.processingTime
                  });
                  
                  return {
                    pageNumber: chunks[i].pageNumber,
                    translation: result.translation,
                    confidence: result.confidence,
                    quality: result.quality,
                    modelAgreement: result.modelAgreement,
                    iterationsUsed: result.iterationsUsed,
                    helperModels: result.helperModels,
                    processingTime: result.processingTime
                  };
                } else {
                  // Legacy mode for backwards compatibility
                  const result = await translationService.translateTextLegacy(chunks[i]);
                  return {
                    pageNumber: chunks[i].pageNumber,
                    translation: result.translation,
                    confidence: result.confidence
                  };
                }
              } catch (error) {
                console.error(`Error translating page ${chunks[i].pageNumber}:`, error);
                return {
                  pageNumber: chunks[i].pageNumber,
                  error: error instanceof Error ? error.message : 'Unknown error'
                };
              }
            })()
          );

          // Second chunk of the pair if it exists
          if (i + 1 < chunks.length) {
            currentPair.push(
              (async () => {
                try {
                  console.log(`Starting translation for page ${chunks[i + 1].pageNumber}`);
                  
                  if (useEnhancedMode) {
                    const result = await translationService.translateText(
                      {
                        pageNumber: chunks[i + 1].pageNumber,
                        content: chunks[i + 1].content
                      },
                      translationConfig
                    );
                    
                    console.log(`Page ${chunks[i + 1].pageNumber} completed:`, {
                      confidence: result.confidence.toFixed(3),
                      modelAgreement: result.modelAgreement?.toFixed(3),
                      iterations: result.iterationsUsed,
                      models: result.helperModels?.length || 1,
                      quality: result.quality?.grade,
                      processingTime: result.processingTime
                    });
                    
                    return {
                      pageNumber: chunks[i + 1].pageNumber,
                      translation: result.translation,
                      confidence: result.confidence,
                      quality: result.quality,
                      modelAgreement: result.modelAgreement,
                      iterationsUsed: result.iterationsUsed,
                      helperModels: result.helperModels,
                      processingTime: result.processingTime
                    };
                  } else {
                    // Legacy mode for backwards compatibility
                    const result = await translationService.translateTextLegacy(chunks[i + 1]);
                    return {
                      pageNumber: chunks[i + 1].pageNumber,
                      translation: result.translation,
                      confidence: result.confidence
                    };
                  }
                } catch (error) {
                  console.error(`Error translating page ${chunks[i + 1].pageNumber}:`, error);
                  return {
                    pageNumber: chunks[i + 1].pageNumber,
                    error: error instanceof Error ? error.message : 'Unknown error'
                  };
                }
              })()
            );
          }

          // Wait for both chunks in the pair to complete
          const pairResults = await Promise.all(currentPair);
          results.push(...pairResults);
        }

        // Process results
        const allResults = results;
        for (const result of allResults) {
          if ('error' in result) {
            errors.push({
              pageNumber: result.pageNumber,
              error: result.error
            });
          } else {
            translations.push(result);
            confidenceScores.push(result.confidence);
          }
        }

        // Continue even if some translations fail
        if (translations.length === 0) {
          throw createTranslationError(
            'Translation failed for all pages',
            'TRANSLATION_FAILED',
            500,
            { errors }
          );
        }

        // Combine translated chunks in order
        const combinedText = translations
          .sort((a, b) => a.pageNumber - b.pageNumber)
          .map(t => t.translation.replace(/^## Translation of Tibetan Text \(Page \d+\)\n*/, ''))
          .join('\n\n');

        // Calculate average confidence score
        const averageConfidence = confidenceScores.length > 0
          ? confidenceScores.reduce((a, b) => a + b, 0) / confidenceScores.length
          : 0;

        // Calculate enhanced metadata
        const totalProcessingTime = translations.reduce((sum: number, t: any) => sum + (t.processingTime || 0), 0);
        const averageModelAgreement = translations.length > 0 
          ? translations.reduce((sum: number, t: any) => sum + (t.modelAgreement || 1), 0) / translations.length 
          : 1;
        const totalIterations = translations.reduce((sum: number, t: any) => sum + (t.iterationsUsed || 1), 0);
        const uniqueHelperModels = [...new Set(translations.flatMap((t: any) => t.helperModels || []))];
        const qualityGrades = translations.map((t: any) => t.quality?.grade).filter(Boolean);
        const qualityDistribution = qualityGrades.reduce((acc: any, grade: string) => {
          acc[grade] = (acc[grade] || 0) + 1;
          return acc;
        }, {});

        // Return enhanced translation results with comprehensive metadata
        res.json({ 
          translatedText: combinedText,
          metadata: {
            processingTime: Date.now() - startTime,
            totalModelProcessingTime: totalProcessingTime,
            chunkCount: chunks.length,
            successfulChunks: translations.length,
            failedChunks: errors.length,
            confidence: averageConfidence,
            modelAgreement: averageModelAgreement,
            totalIterations,
            averageIterationsPerChunk: translations.length > 0 ? totalIterations / translations.length : 0,
            helperModelsUsed: uniqueHelperModels,
            qualityDistribution,
            enhancedMode: useEnhancedMode,
            translationConfig: useEnhancedMode ? translationConfig : undefined,
            errors: errors.length > 0 ? errors : undefined
          }
        });

      } catch (error) {
        // Handle validation errors
        if (error instanceof z.ZodError) {
          next(createTranslationError(
            'Invalid request data',
            'VALIDATION_ERROR',
            400,
            error.errors
          ));
          return;
        }

        // Handle known translation errors
        if (error instanceof Error && 'code' in error) {
          next(error);
          return;
        }

        // Handle unexpected errors
        next(createTranslationError(
          'An unexpected error occurred during translation',
          'UNKNOWN_ERROR',
          500,
          error instanceof Error ? error.message : undefined
        ));
      }
    }
  );

  // Add endpoint to get translation service capabilities
  app.get('/api/translation/capabilities',
    limiter,
    requestLogger,
    (req: Request, res: Response, next: NextFunction) => {
      try {
        const capabilities = translationService.getCapabilities();
        res.json(capabilities);
      } catch (error) {
        next(error);
      }
    }
  );

  // Add endpoint to get/set translation configuration
  app.get('/api/translation/config',
    limiter,
    requestLogger,
    (req: Request, res: Response, next: NextFunction) => {
      try {
        const config = translationService.getConfig();
        res.json(config);
      } catch (error) {
        next(error);
      }
    }
  );

  app.post('/api/translation/config',
    limiter,
    requestLogger,
    (req: Request, res: Response, next: NextFunction) => {
      try {
        const config = req.body;
        translationService.setConfig(config);
        res.json({ message: 'Configuration updated successfully', config: translationService.getConfig() });
      } catch (error) {
        next(error);
      }
    }
  );

  // Register error handler
  app.use(errorHandler);
}

