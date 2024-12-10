import type { Express, Request, Response, NextFunction } from "express";
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
            const result = await Promise.race([
              model.generateContent({
                contents: [{ 
                  role: "user", 
                  parts: [{ 
                    text: createTranslationPrompt(chunk.pageNumber, chunk.content)
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

function createTranslationPrompt(pageNumber: number, text: string): string {
  return `Translate this Tibetan Buddhist text into clear English, following these specific guidelines:

TRANSLATION RULES:
1. Buddhist Terms:
   - Maintain Sanskrit terms with English in parentheses on first use
   - Example: "upāsaka (lay practitioner)"
   - Keep diacritical marks for Sanskrit terms (ā, ī, ṇ, ś, etc.)
   - Always preserve these terms: Dharma, Karma, Buddha, Sangha, Vajra

2. Names and Titles:
   - Keep Tibetan personal names in transliteration
   - Translate honorary titles
     - "Rinpoche" → "Precious One"
     - "Lama" → "Master"
   - Include original Tibetan in parentheses for important titles
   - Example: "Master Jampa Sönam (Bla ma Byams pa Bsod nams)"

3. Text Structure:
   - Use clear section headers with "## " prefix
   - Create proper paragraphs for narrative sections
   - Use bullet points (*) only for lineage lists
   - Separate sections with one blank line
   - Each sentence in a paragraph on its own line

Text to translate (Page ${pageNumber}):
${text}`;
}