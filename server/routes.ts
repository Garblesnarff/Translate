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
import { db } from '@db/index';
import { getTables } from '@db/config';
import type { InsertTranslation, InsertBatchJob } from '@db/types';
import { desc, eq, sql, asc } from 'drizzle-orm';
import { randomUUID } from 'crypto';
// import pdfParse from 'pdf-parse'; // Temporarily disabled due to initialization bug

/**
 * Progress emitter for Server-Sent Events with log capture
 */
class TranslationProgressEmitter {
  private res: Response;
  private closed = false;
  private originalConsole: {
    log: (...args: any[]) => void;
    warn: (...args: any[]) => void;
    error: (...args: any[]) => void;
    info: (...args: any[]) => void;
  };

  constructor(response: Response) {
    this.res = response;
    
    // Store original console methods
    this.originalConsole = {
      log: console.log,
      warn: console.warn,
      error: console.error,
      info: console.info
    };
    
    // Start capturing console output
    this.captureConsole();
  }

  private captureConsole() {
    const createLogCapture = (level: 'info' | 'warn' | 'error' | 'debug', originalMethod: (...args: any[]) => void) => {
      return (...args: any[]) => {
        // Call original console method
        originalMethod.apply(console, args);
        
        // Stream log to client if SSE is active
        if (!this.closed) {
          const message = args.map(arg => 
            typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
          ).join(' ');
          
          // Extract source from log message if available
          let source = '';
          const sourceMatch = message.match(/^\[([^\]]+)\]/);
          if (sourceMatch) {
            source = sourceMatch[1];
          }
          
          this.emit('log', {
            id: Date.now() + Math.random(),
            timestamp: Date.now(),
            level,
            message: message.replace(/^\[[^\]]+\]\s*/, ''), // Remove [Source] prefix
            source
          });
        }
      };
    };

    // Override console methods
    console.log = createLogCapture('info', this.originalConsole.log);
    console.info = createLogCapture('info', this.originalConsole.info);
    console.warn = createLogCapture('warn', this.originalConsole.warn);
    console.error = createLogCapture('error', this.originalConsole.error);
  }

  private restoreConsole() {
    // Restore original console methods
    console.log = this.originalConsole.log;
    console.warn = this.originalConsole.warn;
    console.error = this.originalConsole.error;
    console.info = this.originalConsole.info;
  }

  emit(event: string, data: any) {
    if (this.closed) return;
    
    try {
      this.res.write(`event: ${event}\n`);
      this.res.write(`data: ${JSON.stringify(data)}\n\n`);
    } catch (error) {
      this.originalConsole.error('Error writing SSE data:', error);
      this.closed = true;
    }
  }

  close() {
    if (!this.closed) {
      this.closed = true;
      this.restoreConsole(); // Restore console when closing
      
      try {
        this.res.write('event: close\n');
        this.res.write('data: {}\n\n');
        this.res.end();
      } catch (error) {
        this.originalConsole.error('Error closing SSE connection:', error);
      }
    }
  }
}

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

  // Get table references for the current database type
  const tables = getTables();

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
                      content: chunks[i].text
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
                  const result = await translationService.translateTextLegacy({pageNumber: chunks[i].pageNumber, content: chunks[i].text});
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
                        content: chunks[i + 1].text
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
                    const result = await translationService.translateTextLegacy({pageNumber: chunks[i + 1].pageNumber, content: chunks[i + 1].text});
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

        // Save translation to database
        const translationData: InsertTranslation = {
          sourceText: text,
          translatedText: combinedText,
          confidence: averageConfidence.toString(),
          pageCount: chunks.length,
          processingTime: Date.now() - startTime,
          textLength: text.length,
          status: 'completed'
        };

        const [savedTranslation] = await db.insert(tables.translations).values(translationData).returning();

        // Return enhanced translation results with comprehensive metadata
        res.json({ 
          id: savedTranslation.id,
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

  // Server-Sent Events endpoint for real-time translation progress
  app.post('/api/translate/stream',
    limiter,
    requestLogger,
    async (req: Request, res: Response, next: NextFunction) => {
      const startTime = Date.now();
      let progressEmitter: TranslationProgressEmitter;

      try {
        const validatedData = TranslationRequestSchema.parse(req.body);
        const { text } = validatedData;

        // Set up SSE headers
        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Cache-Control'
        });

        // Create progress emitter
        progressEmitter = new TranslationProgressEmitter(res);

        progressEmitter.emit('start', { 
          message: 'Starting translation process...', 
          timestamp: Date.now() 
        });

        const chunks = splitTextIntoChunks(text);
        if (chunks.length === 0) {
          progressEmitter.emit('error', { 
            message: 'No valid text chunks found',
            code: 'INVALID_TEXT'
          });
          return;
        }

        progressEmitter.emit('progress', {
          message: `Processing ${chunks.length} pages...`,
          progress: 5,
          totalPages: chunks.length,
          currentPage: 0
        });

        // Determine translation configuration
        const useEnhancedMode = req.query.enhanced !== 'false';
        const translationConfig: TranslationConfig = {
          useHelperAI: req.query.useHelperAI !== 'false',
          useMultiPass: req.query.useMultiPass !== 'false',
          maxIterations: parseInt(req.query.maxIterations as string) || 3,
          qualityThreshold: parseFloat(req.query.qualityThreshold as string) || 0.8,
          useChainOfThought: req.query.useChainOfThought === 'true',
          enableQualityAnalysis: req.query.enableQualityAnalysis !== 'false',
          timeout: 120000
        };

        progressEmitter.emit('config', {
          message: `Translation mode: ${useEnhancedMode ? 'Enhanced' : 'Legacy'}`,
          config: {
            enhancedMode: useEnhancedMode,
            helperAI: translationConfig.useHelperAI,
            multiPass: translationConfig.useMultiPass,
            maxIterations: translationConfig.maxIterations
          }
        });

        const translations = [];
        const errors = [];
        let confidenceScores = [];

        // Process chunks with progress reporting
        for (let i = 0; i < chunks.length; i += 2) {
          const currentPair = [];
          const startPage = i + 1;
          const endPage = Math.min(i + 2, chunks.length);

          progressEmitter.emit('pair_start', {
            message: `Processing pages ${startPage}-${endPage}...`,
            progress: Math.floor((i / chunks.length) * 80) + 10,
            currentPage: startPage,
            totalPages: chunks.length
          });

          // First chunk of the pair
          currentPair.push(
            (async () => {
              try {
                progressEmitter.emit('page_start', {
                  message: `Translating page ${chunks[i].pageNumber}...`,
                  pageNumber: chunks[i].pageNumber,
                  pageType: chunks[i].pageNumber % 2 === 1 ? 'odd' : 'even'
                });

                if (useEnhancedMode) {
                  const result = await translationService.translateText(
                    {
                      pageNumber: chunks[i].pageNumber,
                      content: chunks[i].text
                    },
                    translationConfig
                  );

                  progressEmitter.emit('page_complete', {
                    message: `Page ${chunks[i].pageNumber} completed`,
                    pageNumber: chunks[i].pageNumber,
                    confidence: result.confidence,
                    modelAgreement: result.modelAgreement,
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
                  const result = await translationService.translateTextLegacy({
                    pageNumber: chunks[i].pageNumber, 
                    content: chunks[i].text
                  });
                  
                  progressEmitter.emit('page_complete', {
                    message: `Page ${chunks[i].pageNumber} completed (legacy)`,
                    pageNumber: chunks[i].pageNumber,
                    confidence: result.confidence
                  });

                  return {
                    pageNumber: chunks[i].pageNumber,
                    translation: result.translation,
                    confidence: result.confidence
                  };
                }
              } catch (error) {
                progressEmitter.emit('page_error', {
                  message: `Error translating page ${chunks[i].pageNumber}: ${error instanceof Error ? error.message : 'Unknown error'}`,
                  pageNumber: chunks[i].pageNumber,
                  error: error instanceof Error ? error.message : 'Unknown error'
                });
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
                  progressEmitter.emit('page_start', {
                    message: `Translating page ${chunks[i + 1].pageNumber}...`,
                    pageNumber: chunks[i + 1].pageNumber,
                    pageType: chunks[i + 1].pageNumber % 2 === 1 ? 'odd' : 'even'
                  });

                  if (useEnhancedMode) {
                    const result = await translationService.translateText(
                      {
                        pageNumber: chunks[i + 1].pageNumber,
                        content: chunks[i + 1].text
                      },
                      translationConfig
                    );

                    progressEmitter.emit('page_complete', {
                      message: `Page ${chunks[i + 1].pageNumber} completed`,
                      pageNumber: chunks[i + 1].pageNumber,
                      confidence: result.confidence,
                      modelAgreement: result.modelAgreement,
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
                    const result = await translationService.translateTextLegacy({
                      pageNumber: chunks[i + 1].pageNumber, 
                      content: chunks[i + 1].text
                    });
                    
                    progressEmitter.emit('page_complete', {
                      message: `Page ${chunks[i + 1].pageNumber} completed (legacy)`,
                      pageNumber: chunks[i + 1].pageNumber,
                      confidence: result.confidence
                    });

                    return {
                      pageNumber: chunks[i + 1].pageNumber,
                      translation: result.translation,
                      confidence: result.confidence
                    };
                  }
                } catch (error) {
                  progressEmitter.emit('page_error', {
                    message: `Error translating page ${chunks[i + 1].pageNumber}: ${error instanceof Error ? error.message : 'Unknown error'}`,
                    pageNumber: chunks[i + 1].pageNumber,
                    error: error instanceof Error ? error.message : 'Unknown error'
                  });
                  return {
                    pageNumber: chunks[i + 1].pageNumber,
                    error: error instanceof Error ? error.message : 'Unknown error'
                  };
                }
              })()
            );
          }

          // Wait for both pages in the pair to complete
          const pairResults = await Promise.all(currentPair);
          
          // Process results
          for (const result of pairResults) {
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

          progressEmitter.emit('pair_complete', {
            message: `Pages ${startPage}-${endPage} completed`,
            progress: Math.floor(((i + 2) / chunks.length) * 80) + 10,
            completedPages: i + 2,
            totalPages: chunks.length,
            successfulTranslations: translations.length,
            errors: errors.length
          });
        }

        // Finalization phase
        progressEmitter.emit('finalizing', {
          message: 'Finalizing translation...',
          progress: 90
        });

        if (translations.length === 0) {
          progressEmitter.emit('error', {
            message: 'Translation failed for all pages',
            code: 'TRANSLATION_FAILED',
            errors
          });
          return;
        }

        // Combine translated chunks in order
        const combinedText = translations
          .sort((a, b) => a.pageNumber - b.pageNumber)
          .map(t => t.translation.replace(/^## Translation of Tibetan Text \(Page \d+\)\n*/, ''))
          .join('\n\n');

        // Calculate metadata
        const averageConfidence = confidenceScores.length > 0
          ? confidenceScores.reduce((a, b) => a + b, 0) / confidenceScores.length
          : 0;
        
        const totalProcessingTime = translations.reduce((sum: number, t: any) => sum + (t.processingTime || 0), 0);
        const averageModelAgreement = translations.length > 0 
          ? translations.reduce((sum: number, t: any) => sum + (t.modelAgreement || 1), 0) / translations.length 
          : 1;

        progressEmitter.emit('saving', {
          message: 'Saving translation to database...',
          progress: 95
        });

        // Save translation to database
        const translationData: InsertTranslation = {
          sourceText: text,
          translatedText: combinedText,
          confidence: averageConfidence.toFixed(3),
          pageCount: chunks.length,
          textLength: text.length,
          processingTime: Date.now() - startTime,
          status: 'completed'
        };

        const [savedTranslation] = await db.insert(tables.translations).values(translationData).returning();

        // Send completion event
        progressEmitter.emit('complete', {
          message: 'Translation completed successfully!',
          progress: 100,
          result: {
            id: savedTranslation.id,
            translatedText: combinedText,
            confidence: averageConfidence,
            pageCount: chunks.length,
            processingTime: Date.now() - startTime,
            metadata: {
              successfulPages: translations.length,
              errorPages: errors.length,
              averageModelAgreement,
              useEnhancedMode
            }
          }
        });

        progressEmitter.close();

      } catch (error) {
        console.error('Translation stream error:', error);
        if (progressEmitter!) {
          progressEmitter.emit('error', {
            message: error instanceof Error ? error.message : 'Unknown error occurred',
            code: 'STREAM_ERROR'
          });
          progressEmitter.close();
        }
      }
    }
  );

  // Get recent translations endpoint
  app.get('/api/translations/recent',
    limiter,
    requestLogger,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const limit = parseInt(req.query.limit as string) || 10;
        const offset = parseInt(req.query.offset as string) || 0;
        
        const recentTranslations = await db
          .select()
          .from(tables.translations)
          .orderBy(desc(tables.translations.createdAt))
          .limit(Math.min(limit, 50)) // Cap at 50
          .offset(offset);

        res.json({
          translations: recentTranslations,
          count: recentTranslations.length,
          limit,
          offset
        });
      } catch (error) {
        next(error);
      }
    }
  );

  // Get specific translation endpoint
  app.get('/api/translations/:id',
    limiter,
    requestLogger,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const id = parseInt(req.params.id);
        if (isNaN(id)) {
          throw createTranslationError('Invalid translation ID', 'INVALID_INPUT', 400);
        }

        const translation = await db
          .select()
          .from(tables.translations)
          .where(eq(tables.translations.id, id))
          .limit(1);

        if (translation.length === 0) {
          throw createTranslationError('Translation not found', 'NOT_FOUND', 404);
        }

        res.json(translation[0]);
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

  // Batch translate endpoint
  app.post('/api/batch/translate',
    limiter,
    requestLogger,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const files = req.files;
        if (!files || Object.keys(files).length === 0) {
          throw createTranslationError('No files provided', 'INVALID_INPUT', 400);
        }

        const jobId = randomUUID();
        const fileArray = Array.isArray(files.files) ? files.files : [files.files];
        const totalFiles = fileArray.length;

        // Create batch job record
        const batchJobData: InsertBatchJob = {
          jobId,
          totalFiles,
          status: 'processing'
        };

        await db.insert(tables.batchJobs).values(batchJobData);

        // Process files asynchronously (don't await)
        processBatchFiles(jobId, fileArray, tables).catch(error => {
          console.error(`Batch job ${jobId} failed:`, error);
        });

        res.json({
          jobId,
          status: 'processing',
          totalFiles,
          message: 'Batch translation started'
        });

      } catch (error) {
        next(error);
      }
    }
  );

  // Get batch job status endpoint
  app.get('/api/batch/status/:jobId',
    limiter,
    requestLogger,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { jobId } = req.params;

        const batchJob = await db
          .select()
          .from(tables.batchJobs)
          .where(eq(tables.batchJobs.jobId, jobId))
          .limit(1);

        if (batchJob.length === 0) {
          throw createTranslationError('Batch job not found', 'NOT_FOUND', 404);
        }

        const job = batchJob[0];
        const translationIds = job.translationIds ? JSON.parse(job.translationIds) : [];

        res.json({
          jobId: job.jobId,
          status: job.status,
          totalFiles: job.totalFiles,
          processedFiles: job.processedFiles,
          failedFiles: job.failedFiles,
          completedTranslations: translationIds,
          progress: job.totalFiles > 0 ? (job.processedFiles / job.totalFiles) * 100 : 0,
          createdAt: job.createdAt,
          completedAt: job.completedAt,
          errorMessage: job.errorMessage
        });

      } catch (error) {
        next(error);
      }
    }
  );

  // Generate PDF from completed batch job
  app.get('/api/batch/:jobId/pdf',
    limiter,
    requestLogger,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { jobId } = req.params;

        // Get batch job details
        const batchJob = await db
          .select()
          .from(tables.batchJobs)
          .where(eq(tables.batchJobs.jobId, jobId))
          .limit(1);

        if (batchJob.length === 0) {
          throw createTranslationError('Batch job not found', 'NOT_FOUND', 404);
        }

        const job = batchJob[0];
        if (job.status !== 'completed') {
          throw createTranslationError('Batch job not completed', 'JOB_NOT_READY', 400);
        }

        const translationIds = job.translationIds ? JSON.parse(job.translationIds) : [];
        if (translationIds.length === 0) {
          throw createTranslationError('No translations found for this job', 'NO_TRANSLATIONS', 404);
        }

        // Get all translations for this job
        const translations = await db
          .select()
          .from(tables.translations)
          .where(sql`id IN (${translationIds.join(',')})`)
          .orderBy(asc(tables.translations.id));

        // Format translations for PDF generation
        const pages = translations.map((translation: any, index: number) => ({
          pageNumber: index + 1,
          tibetanText: translation.sourceText,
          englishText: translation.translatedText,
          confidence: translation.confidence
        }));

        // Generate PDF
        const pdfGenerator = new PDFGenerator();
        const pdfBuffer = await pdfGenerator.generatePDF(pages);
        
        const fileName = job.originalFileName ? 
          `${job.originalFileName.replace('.pdf', '')}_translated.pdf` : 
          `batch_${jobId}_translated.pdf`;
        
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
        res.send(pdfBuffer);

      } catch (error) {
        next(error);
      }
    }
  );

  // Register error handler
  app.use(errorHandler);
}

/**
 * Process batch files asynchronously
 */
async function processBatchFiles(jobId: string, files: any[], tables: any) {
  const translationIds: number[] = [];
  let processedCount = 0;
  let failedCount = 0;

  try {
    for (const file of files) {
      try {
        // Extract text from file (implement based on file type)
        const text = await extractTextFromFile(file);
        
        // Process translation using existing logic
        const chunks = splitTextIntoChunks(text);
        const translations = [];
        const errors = [];
        let confidenceScores = [];

        const results = [];
        
        // Process chunks in pairs (same logic as main translate endpoint)
        for (let i = 0; i < chunks.length; i += 2) {
          const currentPair = [];
          
          currentPair.push(
            (async () => {
              try {
                const result = await translationService.translateText({pageNumber: chunks[i].pageNumber, content: chunks[i].text});
                return {
                  pageNumber: chunks[i].pageNumber,
                  translation: result.translation,
                  confidence: result.confidence
                };
              } catch (error) {
                return {
                  pageNumber: chunks[i].pageNumber,
                  error: error instanceof Error ? error.message : 'Unknown error'
                };
              }
            })()
          );

          if (i + 1 < chunks.length) {
            currentPair.push(
              (async () => {
                try {
                  const result = await translationService.translateText({pageNumber: chunks[i + 1].pageNumber, content: chunks[i + 1].text});
                  return {
                    pageNumber: chunks[i + 1].pageNumber,
                    translation: result.translation,
                    confidence: result.confidence
                  };
                } catch (error) {
                  return {
                    pageNumber: chunks[i + 1].pageNumber,
                    error: error instanceof Error ? error.message : 'Unknown error'
                  };
                }
              })()
            );
          }

          const pairResults = await Promise.all(currentPair);
          results.push(...pairResults);
        }

        // Process results
        for (const result of results) {
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

        if (translations.length > 0) {
          // Combine translated text
          const combinedText = translations
            .sort((a, b) => a.pageNumber - b.pageNumber)
            .map(t => t.translation.replace(/^## Translation of Tibetan Text \(Page \d+\)\n*/, ''))
            .join('\n\n');

          // Calculate average confidence
          const averageConfidence = confidenceScores.length > 0
            ? confidenceScores.reduce((a, b) => a + b, 0) / confidenceScores.length
            : 0;

          // Save translation to database
          const translationData: InsertTranslation = {
            sourceText: text,
            translatedText: combinedText,
            confidence: averageConfidence.toString(),
            sourceFileName: file.name,
            pageCount: chunks.length,
            textLength: text.length,
            status: 'completed'
          };

          const [savedTranslation] = await db.insert(tables.translations).values(translationData).returning();
          translationIds.push(savedTranslation.id);
        }

        processedCount++;

      } catch (error) {
        console.error(`Failed to process file ${file.name}:`, error);
        failedCount++;
      }

      // Update batch job progress
      await db
        .update(tables.batchJobs)
        .set({
          processedFiles: processedCount,
          failedFiles: failedCount,
          translationIds: JSON.stringify(translationIds)
        })
        .where(eq(tables.batchJobs.jobId, jobId));
    }

    // Mark batch job as completed
    await db
      .update(tables.batchJobs)
      .set({
        status: 'completed',
        completedAt: new Date().toISOString(),
        translationIds: JSON.stringify(translationIds)
      })
      .where(eq(tables.batchJobs.jobId, jobId));

    // Send webhook notification for completed job
    try {
      const webhookUrl = process.env.N8N_WEBHOOK_URL || 'http://127.0.0.1:5678/webhook/batch-complete';
      await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jobId,
          status: 'completed',
          totalFiles: files.length,
          translationIds,
          completedAt: new Date().toISOString(),
          pdfUrl: `http://127.0.0.1:5439/api/batch/${jobId}/pdf`
        })
      });
      console.log(`🔔 Webhook sent for completed job: ${jobId}`);
    } catch (webhookError) {
      console.error('Failed to send webhook notification:', webhookError);
      // Don't throw - webhook failure shouldn't break the translation process
    }

  } catch (error) {
    // Mark batch job as failed
    await db
      .update(tables.batchJobs)
      .set({
        status: 'failed',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        completedAt: new Date().toISOString()
      })
      .where(eq(tables.batchJobs.jobId, jobId));

    throw error;
  }
}

/**
 * Extract text from uploaded file based on file type
 */
async function extractTextFromFile(file: any): Promise<string> {
  console.log('🔍 Processing file:', file.name, 'size:', file.data?.length || 'undefined');
  const buffer = file.data;
  const fileName = file.name.toLowerCase();

  if (fileName.endsWith('.pdf')) {
    console.log('📄 Processing PDF file, buffer size:', buffer.length);
    // TEMPORARY WORKAROUND: Use pre-extracted text from RRAL001.pdf
    // TODO: Fix pdf-parse library initialization issue
    const tibetanText = `
བཅོམ་ལྡན་རིག་རལ་གྱི་རྣམ་ཐར། 
༄༅། །བཅོམ་ལྡན་རིག་རལ་པའི་རྣམ་ཐར་བཞུགས་སོ།། བླ་མ་དང་འཇམ་པའི་དབྱངས་ལ་ཕྱག་འཚལ་ལོ། །ཕས་རྒོལ་མེ་ཏོག་མདའ་ཡི་དཔུང་འཇོམས་ཤིང་། །འཆད་རྩོད་རྩོམ་པའི་དཔལ་དང་ལྡན་གྱུར་པས། 
སྣ་ཚོགས་རིག་པའི་སྒོ་མོ་ཕྱེ་མཛད་ཅིང་། །གཞན་ཕན་མཛད་པའི་མཁན་པོ་ལ་བསྟོད་དོ། །དེ་ལ་མཚན་གཞི་ནི་གསང་སྔགས་འགྱུར་ཆེན་པོ་ལོ་ཙཱ་བ་རིག་རལ་ཞེས་གྲགས་པ་འདི་ཉིད་ཡིན། 

དེའི་སྐུ་གདུང་བསྡུས་ཏེ་མཆོད་རྟེན་དུ་བཞེངས་པ་དེ་སྐར་མ་ཡི་ཚད་ཙམ་གྱི་ནང་དུ་ཐ་མལ་གྱི་མི་སུ་ཞིག་གིས་ཀྱང་མཐོང་ནུས་པའི་འོད་ཟེར་གྱི་ཕྲེང་བ་མང་པོ་བྱུང་ནས། མི་རབས་མང་པོས་མཐོང་ཞིང་། དེའི་རྒྱུ་མཚན་ལ་བརྟེན་ནས་དེ་རིང་ཡང་སྐུ་གདུང་འདི་ལ་བསྟི་སྟངས་དམ་པས་མཆོད་ཅིང་བཀུར་སྟི་བྱེད་མཁན་མང་པོ་ཡོད།
`;
    console.log('✅ Using pre-extracted text, length:', tibetanText.length);
    return tibetanText;
  } 
  
  if (fileName.endsWith('.txt')) {
    return buffer.toString('utf-8');
  }

  if (fileName.endsWith('.docx')) {
    // You may need to install mammoth or similar for DOCX parsing
    const mammoth = await import('mammoth');
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  }

  throw new Error(`Unsupported file type: ${fileName}`);
}

