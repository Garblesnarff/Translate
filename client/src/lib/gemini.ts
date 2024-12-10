import { useState, useCallback } from 'react';

const GEMINI_API_ENDPOINT = '/api/translate';
const MAX_RETRIES = 3;
const BASE_RETRY_DELAY = 1000;

export enum TranslationErrorCode {
  NETWORK_ERROR = 'NETWORK_ERROR',
  API_ERROR = 'API_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  MAX_RETRIES_EXCEEDED = 'MAX_RETRIES_EXCEEDED',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR'
}

export class TranslationError extends Error {
  constructor(
    message: string,
    public readonly code: TranslationErrorCode,
    public readonly details?: unknown,
    public readonly httpStatus?: number
  ) {
    super(message);
    this.name = 'TranslationError';
  }
}

export interface TranslationResult {
  translatedText: string;
  confidence: number;
  metadata?: {
    processingTime: number;
    chunkCount: number;
    totalChars: number;
  };
}

interface TranslationState {
  isTranslating: boolean;
  progress: number;
  error: TranslationError | null;
}

export const useTranslation = () => {
  const [state, setState] = useState<TranslationState>({
    isTranslating: false,
    progress: 0,
    error: null,
  });

  const setProgress = useCallback((progress: number) => {
    setState(prev => ({
      ...prev,
      progress: Math.min(Math.max(progress, 0), 100)
    }));
  }, []);

  const translate = async (text: string): Promise<TranslationResult> => {
    setState({ isTranslating: true, progress: 0, error: null });
    const startTime = Date.now();

    let retries = 0;
    while (retries <= MAX_RETRIES) {
      try {
        const response = await fetch(GEMINI_API_ENDPOINT, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ text }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new TranslationError(
            errorData.message || 'Translation request failed',
            TranslationErrorCode.API_ERROR,
            errorData.details,
            response.status
          );
        }

        const reader = response.body?.getReader();
        let translatedText = '';
        let chunkCount = 0;
        const totalExpectedChunks = Math.ceil(text.length / 1000);

        if (reader) {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            translatedText += new TextDecoder().decode(value);
            chunkCount++;
            setProgress(Math.min((chunkCount / totalExpectedChunks) * 90 + 10, 90));
          }
        }

        setProgress(100);

        const result: TranslationResult = {
          translatedText,
          confidence: 0.95,
          metadata: {
            processingTime: Date.now() - startTime,
            chunkCount,
            totalChars: text.length
          }
        };

        setState(prev => ({ 
          ...prev, 
          isTranslating: false, 
          error: null 
        }));

        return result;

      } catch (error) {
        retries++;

        if (retries <= MAX_RETRIES) {
          console.warn(`Translation attempt ${retries} failed, retrying...`);
          setProgress(0);
          await new Promise(resolve => 
            setTimeout(resolve, BASE_RETRY_DELAY * Math.pow(2, retries - 1))
          );
          continue;
        }

        const translationError = error instanceof TranslationError
          ? error
          : new TranslationError(
              error instanceof Error ? error.message : 'Unknown error occurred',
              TranslationErrorCode.UNKNOWN_ERROR,
              error
            );

        setState(prev => ({ 
          ...prev, 
          isTranslating: false, 
          error: translationError 
        }));

        throw translationError;
      }
    }

    throw new TranslationError(
      'Maximum retries exceeded', 
      TranslationErrorCode.MAX_RETRIES_EXCEEDED
    );
  };

  return {
    translate,
    isTranslating: state.isTranslating,
    progress: state.progress,
    error: state.error,
  };
};