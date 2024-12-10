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
    let retries = 0;
    const startTime = Date.now();
    let translatedText = '';
    let chunkCount = 0;
    
    setState(prev => ({ ...prev, isTranslating: true, error: null }));
    setProgress(10);

    try {
      const response = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
      });

      if (!response.ok) {
        throw new Error(`Translation failed: ${response.statusText}`);
      }

      const data = await response.json();
      translatedText = data.translatedText;
      
      setProgress(100);
      setState(prev => ({ ...prev, isTranslating: false, error: null }));

      return {
        translatedText,
        confidence: data.metadata?.confidence || 0.95,
        metadata: {
          processingTime: Date.now() - startTime,
          chunkCount: data.metadata?.chunkCount || 1,
          totalChars: text.length
        }
      };
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
  };

  return {
    translate,
    isTranslating: state.isTranslating,
    progress: state.progress,
    error: state.error,
  };
};