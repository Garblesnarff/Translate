import { useState } from 'react';

const GEMINI_API_ENDPOINT = '/api/translate';
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 second

export class TranslationError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = 'TranslationError';
  }
}

export interface TranslationResult {
  translatedText: string;
  confidence: number;
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

  const setProgress = (progress: number) => {
    setState(prev => ({ ...prev, progress: Math.min(Math.max(progress, 0), 100) }));
  };

  const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  const translate = async (text: string): Promise<TranslationResult> => {
    setState({ isTranslating: true, progress: 0, error: null });
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
            response.status.toString(),
            errorData.details
          );
        }

        const reader = response.body?.getReader();
        let translatedText = '';
        let chunkCount = 0;
        
        if (reader) {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            translatedText += new TextDecoder().decode(value);
            chunkCount++;
            // More granular progress updates based on chunks received
            setProgress(Math.min((chunkCount * 15), 90));
          }
        }

        setProgress(100);
        setState(prev => ({ ...prev, isTranslating: false, error: null }));
        
        return {
          translatedText,
          confidence: 0.95,
        };
      } catch (error) {
        retries++;
        
        if (retries <= MAX_RETRIES) {
          // Log retry attempt
          console.warn(`Translation attempt ${retries} failed, retrying...`);
          setProgress(0); // Reset progress for retry
          await sleep(RETRY_DELAY * retries); // Exponential backoff
          continue;
        }

        // Convert error to TranslationError if it isn't already
        const translationError = error instanceof TranslationError
          ? error
          : new TranslationError(
              error instanceof Error ? error.message : 'Unknown error occurred',
              'UNKNOWN_ERROR',
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

    // This should never be reached due to the throw in the catch block
    throw new TranslationError('Maximum retries exceeded', 'MAX_RETRIES_EXCEEDED');
  };

  return {
    translate,
    isTranslating: state.isTranslating,
    progress: state.progress,
    error: state.error,
  };
};
