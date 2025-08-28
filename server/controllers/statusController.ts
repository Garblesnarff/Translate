/**
 * Status Controller
 *
 * Handles system status and health check requests.
 * Contains business logic for status-related endpoints.
 *
 * @author Translation Service Team
 */

import type { Request, Response, NextFunction } from "express";
import { createTranslationError } from '../middleware/errorHandler';

/**
 * Get system status and service health
 */
export async function getSystemStatus(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // Dynamic imports to avoid initialization issues
    const { oddPagesGeminiService, evenPagesGeminiService } = await import('../services/translation/GeminiService');
    const { multiProviderAIService } = await import('../services/translation/MultiProviderAIService');

    const status = {
      timestamp: new Date().toISOString(),
      services: {
        gemini: {
          odd: {
            pageType: oddPagesGeminiService.getPageType(),
            keyPool: (oddPagesGeminiService as any).keyPool.getPoolStatus()
          },
          even: {
            pageType: evenPagesGeminiService.getPageType(),
            keyPool: (evenPagesGeminiService as any).keyPool.getPoolStatus()
          }
        },
        aiProviders: multiProviderAIService.getProviderStatus()
      },
      database: {
        connected: true, // We'll assume connected if we reach this point
        type: process.env.DATABASE_URL ? 'PostgreSQL' : 'SQLite'
      },
      environment: {
        nodeEnv: process.env.NODE_ENV,
        port: process.env.PORT,
        hasGeminiOddKey: !!process.env.GEMINI_API_KEY_ODD,
        hasGeminiEvenKey: !!process.env.GEMINI_API_KEY_EVEN,
        hasBackupKeys: !!(process.env.GEMINI_API_KEY_BACKUP_1 || process.env.GEMINI_API_KEY_BACKUP_2),
        backupKeyCount: [
          process.env.GEMINI_API_KEY_BACKUP_1,
          process.env.GEMINI_API_KEY_BACKUP_2
        ].filter(Boolean).length
      }
    };

    res.json(status);
  } catch (error) {
    next(error);
  }
}

/**
 * Get dictionary entries
 */
export async function getDictionaryEntries(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { TibetanDictionary } = await import('../dictionary');
    const dictionary = new TibetanDictionary();
    const context = await dictionary.getDictionaryContext();
    res.json({ entries: context });
  } catch (error) {
    next(error);
  }
}
