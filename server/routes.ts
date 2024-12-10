import type { Express, Request, Response, NextFunction } from "express";
import fileUpload from 'express-fileupload';
import { GoogleGenerativeAI, GenerateContentResult } from "@google/generative-ai";
import { splitTextIntoChunks } from "../client/src/lib/textChunker";
import { TibetanTextProcessor } from "./textFormatter";
import rateLimit from 'express-rate-limit';
import { z } from 'zod';

// Validation schema
const TranslationRequestSchema = z.object({
  text: z.string().min(1).max(100000),
});

interface TranslationError extends Error {
  code: string;
  status: number;
  details?: unknown;
}

const createTranslationError = (
  message: string,
  code: string,
  status: number = 500,
  details?: unknown
): TranslationError => {
  const error = new Error(message) as TranslationError;
  error.code = code;
  error.status = status;
  error.details = details;
  return error;
};

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

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
  const model = genAI.getGenerativeModel({ 
    model: "gemini-1.5-flash-8b",
    generationConfig: {
      temperature: 0.1,
      topK: 1,
      topP: 0.8,
      maxOutputTokens: 8192,
    }
  });

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

        const textProcessor = new TibetanTextProcessor({
          preserveSanskrit: true,
          formatLineages: true,
          enhancedSpacing: true,
          handleHonorifics: true
        });

        const translations = [];
        const errors = [];

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
              }) as Promise<GenerateContentResult>,
              new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Translation timeout')), 30000)
              )
            ]) as GenerateContentResult;

            const response = await result.response;
            const rawTranslation = response.text();
            const processedTranslation = textProcessor.processText(rawTranslation);

            translations.push({
              pageNumber: chunk.pageNumber,
              translation: processedTranslation,
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

        res.json({ 
          translatedText: combinedText,
          metadata: {
            processingTime: Date.now() - startTime,
            chunkCount: chunks.length,
            successfulChunks: translations.length,
            failedChunks: errors.length,
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
  return `Translate this Tibetan Buddhist text into clear English. This is critical: You MUST use the provided dictionary entries exactly as shown for consistent translations.

DICTIONARY (Use these translations exactly as provided):
${dictionaryContext}

TRANSLATION REQUIREMENTS:
1. Dictionary Terms (Highest Priority):
   - You MUST use the exact translations from the dictionary above
   - For terms in the dictionary, use the provided English translation with Tibetan in parentheses
   - Example: If དགེ་བཤེས appears, translate as "Learned One (Geshe)"

2. Terms Not in Dictionary:
   - Use your knowledge of Tibetan to translate terms not found in the dictionary
   - For Buddhist technical terms, provide Sanskrit with English explanation
   - Keep literary and poetic nuances in the translation
   - Maintain consistency for repeated terms throughout the text

3. Formatting Rules:
   - Use "## " for section headers
   - One sentence per line for clarity
   - Use bullet points (*) for lists
   - Include original Tibetan in parentheses for key terms
   - Keep proper spacing and paragraph structure

4. Quality Checks:
   - Double-check all dictionary terms are translated correctly
   - Ensure consistent translation of repeated terms
   - Verify all technical terms are properly explained

Text to translate (Page ${pageNumber}):
${text}

Remember: The dictionary translations provided above are authoritative and must be used exactly as shown.`;
}