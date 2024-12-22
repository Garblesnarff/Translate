import type { Express, Request, Response, NextFunction } from "express";
import fileUpload from 'express-fileupload';
import { splitTextIntoChunks } from "../client/src/lib/textChunker";
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { requestLogger } from './middleware/requestLogger';
import { errorHandler, createTranslationError } from './middleware/errorHandler';
import { translationService } from './services/translationService';
import { TibetanDictionary } from './dictionary';
import { PDFGenerator } from './services/pdf/PDFGenerator';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

// Get __filename and __dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);


// Function to execute Python script
async function executeDataGatheringCrew(text: string) {
    return new Promise((resolve, reject) => {
      const pythonScriptPath = path.resolve(
        process.cwd(), 'client', 'src', 'data_gathering_crew', 'main.py'
    );
      console.log("python path:", pythonScriptPath);
    const pythonProcess = spawn('python3', [pythonScriptPath]);

    let result = '';
    let error = '';

    pythonProcess.stdin.write(text);
    pythonProcess.stdin.end();

    pythonProcess.stdout.on('data', (data) => {
      result += data.toString();
    });

    pythonProcess.stderr.on('data', (data) => {
      error += data.toString();
    });

    pythonProcess.on('close', (code) => {
      if (code === 0) {
        resolve(result);
      } else {
        reject(new Error(error || 'Python script execution failed'));
      }
    });
  });
}

// Schema for validating translation requests
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

          // Process chunks in pairs
            for (let i = 0; i < chunks.length; i += 2) {
              const currentPair = [];

                // First chunk of the pair
                currentPair.push(
                  (async () => {
                    try {
                      console.log(`Translating page ${chunks[i].pageNumber}`);
                      const result = await translationService.translateText(chunks[i]);
                      return {
                        pageNumber: chunks[i].pageNumber,
                        translation: result.translation,
                        confidence: result.confidence
                      };
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
                        console.log(`Translating page ${chunks[i + 1].pageNumber}`);
                        const result = await translationService.translateText(chunks[i + 1]);
                        return {
                          pageNumber: chunks[i + 1].pageNumber,
                          translation: result.translation,
                          confidence: result.confidence
                        };
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

          // Return translation results with metadata
            res.json({
              translatedText: combinedText,
              metadata: {
                processingTime: Date.now() - startTime,
                chunkCount: chunks.length,
                successfulChunks: translations.length,
                failedChunks: errors.length,
                confidence: averageConfidence,
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

      app.post('/api/data-gather',
          limiter,
          requestLogger,
        async (req: Request, res: Response, next: NextFunction) => {
          try {
            const validatedData = TranslationRequestSchema.parse(req.body);
            const { text } = validatedData;
            const result = await executeDataGatheringCrew(text);
             res.json({ result });
           } catch (error) {
              next(error);
          }
        }
      );

    // Register error handler
      app.use(errorHandler);
}