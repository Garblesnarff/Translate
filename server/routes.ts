import type { Express, Request, Response, NextFunction } from "express";
import fileUpload from 'express-fileupload';
import { splitTextIntoChunks } from "../client/src/lib/textChunker";
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { requestLogger } from './middleware/requestLogger';
import { errorHandler } from './middleware/errorHandler';
import { translationService } from './services/translationService';

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

  const logRequest = (req: Request, res: Response, next: NextFunction) => {
    const startTime = Date.now();
    res.on('finish', () => {
      const duration = Date.now() - startTime;
      console.log({
        method: req.method,
        path: req.path,
        status: res.statusCode,
        duration,
        userAgent: req.headers['user-agent'],
        contentLength: req.headers['content-length'],
      });
    });
    next();
  };

  // Dictionary is built-in and initialized on server start
  app.get('/api/dictionary/entries', 
    limiter,
    logRequest,
    async (_req: Request, res: Response, next: NextFunction) => {
      try {
        const context = await dictionary.getDictionaryContext();
        res.json({ entries: context });
      } catch (error) {
        next(error);
      }
    }
  );

  app.post('/api/translate', 
    limiter,
    logRequest,
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

        // Look for potential new terms before translation
        const suggestedTerms = await dictionary.suggestNewTerms(text);

        const textProcessor = new TibetanTextProcessor({
          preserveSanskrit: true,
          formatLineages: true,
          enhancedSpacing: true,
          handleHonorifics: true
        });

        const translations = [];
        const errors = [];
        let confidenceScores = [];

        for (const chunk of chunks) {
          try {
            const prompt = await createTranslationPrompt(chunk.pageNumber, chunk.content);
            const result = await Promise.race([
              model.generateContent({
                contents: [{ 
                  role: "user", 
                  parts: [{ 
                    text: prompt
                  }]
                }],
                generationConfig: {
                  temperature: 0.1,
                  topK: 1,
                  topP: 0.8,
                  maxOutputTokens: 8192,
                  candidateCount: 1,
                },
              }) as Promise<GenerateContentResult>,
              new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Translation timeout')), 30000)
              )
            ]) as GenerateContentResult;

            const response = await result.response;
            const rawTranslation = response.text();
            
            // Calculate confidence based on dictionary term usage
            const dictionaryTerms = rawTranslation.match(/\([^)]+\)/g) || [];
            const confidence = Math.min(0.95, 0.7 + (dictionaryTerms.length * 0.05));
            confidenceScores.push(confidence);

            const processedTranslation = textProcessor.processText(rawTranslation);

            translations.push({
              pageNumber: chunk.pageNumber,
              translation: processedTranslation,
              confidence
            });
          } catch (error) {
            errors.push({
              pageNumber: chunk.pageNumber,
              error: error instanceof Error ? error.message : 'Unknown error'
            });
          }
        }

        if (translations.length === 0 && errors.length > 0) {
          throw createTranslationError(
            'All translation chunks failed',
            'TRANSLATION_FAILED',
            500,
            { errors }
          );
        }

        const combinedText = translations
          .sort((a, b) => a.pageNumber - b.pageNumber)
          .map(t => t.translation)
          .join('\n\n');

        const averageConfidence = confidenceScores.reduce((a, b) => a + b, 0) / confidenceScores.length;

        res.json({ 
          translatedText: combinedText,
          metadata: {
            processingTime: Date.now() - startTime,
            chunkCount: chunks.length,
            successfulChunks: translations.length,
            failedChunks: errors.length,
            confidence: averageConfidence,
            suggestedNewTerms: suggestedTerms.length > 0 ? suggestedTerms : undefined,
            errors: errors.length > 0 ? errors : undefined
          }
        });

      } catch (error) {
        if (error instanceof z.ZodError) {
          next(createTranslationError(
            'Invalid request data',
            'VALIDATION_ERROR',
            400,
            error.errors
          ));
        } else if (error instanceof Error) {
          next(error);
        } else {
          next(createTranslationError(
            'Unknown error occurred',
            'UNKNOWN_ERROR',
            500
          ));
        }
      }
    }
  );
}

import { TibetanDictionary } from './dictionary';

const dictionary = new TibetanDictionary();

// Initialize the dictionary with default entries
dictionary.initializeDefaultDictionary().catch(error => {
  console.error("Failed to initialize dictionary:", error);
});

async function createTranslationPrompt(pageNumber: number, text: string): Promise<string> {
  const dictionaryContext = await dictionary.getDictionaryContext();
  return `You are an expert Tibetan translator. Follow these instructions carefully but do not include them in your output.

BACKGROUND INFORMATION (Do not include in output):
You will translate Tibetan text using both your knowledge and a provided dictionary.
First translate using your expertise, then check against the dictionary for any matching terms.

DICTIONARY (Reference only, do not include in output):
${dictionaryContext}

TRANSLATION RULES (Do not include in output):
1. Always translate everything, combining:
   - Dictionary terms: Use exact translations provided
   - Non-dictionary terms: Use your knowledge of Tibetan
2. For Buddhist terms not in dictionary:
   - Include Sanskrit with English explanation
   - Preserve literary style and meaning

OUTPUT FORMAT:
Provide ONLY the translation, starting with:
"## Translation of Tibetan Text (Page ${pageNumber})"
Then the translated text, with:
- One sentence per line
- Bullet points (*) for lists
- Dictionary terms: Use provided English with Tibetan in parentheses
- Key terms: Include Tibetan in parentheses

===== BEGIN TEXT TO TRANSLATE =====
${text}
===== END TEXT TO TRANSLATE =====

Important: Output only the translation, without any instructions or explanations about the process.`;
}