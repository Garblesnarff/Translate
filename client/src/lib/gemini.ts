
import { useState, useCallback, useRef } from 'react';

const GEMINI_API_ENDPOINT = '/api/translate';
const STREAM_API_ENDPOINT = '/api/translate/stream';
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

export interface ProgressInfo {
  message: string;
  progress: number;
  currentPage?: number;
  totalPages?: number;
  pageNumber?: number;
  pageType?: 'odd' | 'even';
  confidence?: number;
  quality?: string;
  models?: number;
  iterations?: number;
  processingTime?: number;
  timeElapsed?: number;
  estimatedTimeRemaining?: number;
}

interface TranslationState {
  isTranslating: boolean;
  progress: number;
  error: TranslationError | null;
  progressInfo: ProgressInfo | null;
  canCancel: boolean;
}

export const useTranslation = () => {
  const [state, setState] = useState<TranslationState>({
    isTranslating: false,
    progress: 0,
    error: null,
    progressInfo: null,
    canCancel: false,
  });
  
  const eventSourceRef = useRef<EventSource | null>(null);
  const startTimeRef = useRef<number>(0);

  const setProgress = useCallback((progress: number) => {
    setState(prev => ({
      ...prev,
      progress: Math.min(Math.max(progress, 0), 100)
    }));
  }, []);

  const setProgressInfo = useCallback((info: ProgressInfo) => {
    setState(prev => ({
      ...prev,
      progressInfo: info,
      progress: info.progress
    }));
  }, []);

  const cancelTranslation = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    setState(prev => ({
      ...prev,
      isTranslating: false,
      canCancel: false,
      progressInfo: null,
      error: new TranslationError('Translation cancelled by user', TranslationErrorCode.UNKNOWN_ERROR)
    }));
  }, []);

  const translateWithStream = async (text: string): Promise<TranslationResult> => {
    return new Promise(async (resolve, reject) => {
      startTimeRef.current = Date.now();
      
      setState(prev => ({ 
        ...prev, 
        isTranslating: true, 
        error: null, 
        progressInfo: null,
        canCancel: true,
        progress: 0
      }));

      try {
        // First, start the translation process
        const response = await fetch(STREAM_API_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text })
        });

        if (!response.ok) {
          throw new Error(`Translation failed: ${response.statusText}`);
        }

        // Read the SSE stream
        const reader = response.body?.getReader();
        if (!reader) {
          throw new Error('Failed to get response stream reader');
        }

        const decoder = new TextDecoder();
        let buffer = '';

        const readStream = async () => {
          try {
            while (true) {
              const { done, value } = await reader.read();
              
              if (done) break;

              buffer += decoder.decode(value, { stream: true });
              const lines = buffer.split('\n');
              buffer = lines.pop() || '';

              for (const line of lines) {
                if (line.startsWith('data: ')) {
                  const data = line.slice(6);
                  if (data === '') continue; // Keep-alive

                  try {
                    const eventData = JSON.parse(data);
                    handleStreamEvent(eventData);
                  } catch (parseError) {
                    console.warn('Failed to parse SSE data:', data);
                  }
                } else if (line.startsWith('event: ')) {
                  // Store event type for next data line
                  continue;
                }
              }
            }
          } catch (error) {
            console.error('Stream reading error:', error);
            reject(new TranslationError(
              'Stream reading failed',
              TranslationErrorCode.NETWORK_ERROR,
              error
            ));
          }
        };

        const handleStreamEvent = (data: any) => {
          const timeElapsed = Date.now() - startTimeRef.current;

          // Handle different event types based on the data structure
          if (data.message === 'Starting translation process...') {
            setProgressInfo({
              message: data.message,
              progress: 0,
              timeElapsed
            });
          } else if (data.message?.includes('Processing') && data.totalPages) {
            setProgressInfo({
              message: data.message,
              progress: data.progress || 5,
              currentPage: data.currentPage,
              totalPages: data.totalPages,
              timeElapsed
            });
          } else if (data.message?.includes('Translation mode:')) {
            setProgressInfo(prev => ({
              ...prev,
              message: data.message,
              timeElapsed
            }));
          } else if (data.message?.includes('Processing pages')) {
            setProgressInfo({
              message: data.message,
              progress: data.progress || 10,
              currentPage: data.currentPage,
              totalPages: data.totalPages,
              timeElapsed
            });
          } else if (data.message?.includes('Translating page')) {
            setProgressInfo(prev => ({
              ...prev,
              message: data.message,
              pageNumber: data.pageNumber,
              pageType: data.pageType,
              timeElapsed
            }));
          } else if (data.message?.includes('completed') && data.confidence !== undefined) {
            setProgressInfo(prev => ({
              ...prev,
              message: data.message,
              pageNumber: data.pageNumber,
              confidence: data.confidence,
              quality: data.quality,
              models: data.models,
              iterations: data.iterations,
              processingTime: data.processingTime,
              timeElapsed
            }));
          } else if (data.message?.includes('Pages') && data.message?.includes('completed')) {
            setProgressInfo({
              message: data.message,
              progress: data.progress || 50,
              currentPage: data.completedPages,
              totalPages: data.totalPages,
              timeElapsed
            });
          } else if (data.message?.includes('Finalizing')) {
            setProgressInfo(prev => ({
              ...prev,
              message: data.message,
              progress: data.progress || 90,
              timeElapsed
            }));
          } else if (data.message?.includes('Saving')) {
            setProgressInfo(prev => ({
              ...prev,
              message: data.message,
              progress: data.progress || 95,
              timeElapsed
            }));
          } else if (data.message?.includes('Translation completed successfully!') && data.result) {
            const result = data.result;
            
            setState(prev => ({ 
              ...prev, 
              isTranslating: false, 
              canCancel: false,
              progress: 100,
              progressInfo: {
                message: data.message,
                progress: 100,
                timeElapsed
              }
            }));

            resolve({
              translatedText: result.translatedText,
              confidence: result.confidence,
              metadata: {
                processingTime: result.processingTime,
                chunkCount: result.pageCount,
                totalChars: text.length
              }
            });
            return;
          } else if (data.code && data.message) {
            // Error event
            const error = new TranslationError(
              data.message,
              data.code === 'STREAM_ERROR' ? TranslationErrorCode.API_ERROR : TranslationErrorCode.UNKNOWN_ERROR,
              data
            );

            setState(prev => ({ 
              ...prev, 
              isTranslating: false, 
              canCancel: false,
              error
            }));

            reject(error);
            return;
          }
        };

        readStream();
      } catch (error) {
        console.error('Failed to start translation stream:', error);
        reject(new TranslationError(
          'Failed to start translation',
          TranslationErrorCode.NETWORK_ERROR,
          error
        ));
      }
    });
  };

  const translate = async (text: string): Promise<TranslationResult> => {
    try {
      return await translateWithStream(text);
    } catch (error) {
      // Fallback to regular API if SSE fails
      console.warn('Stream translation failed, falling back to regular API:', error);
      return translateFallback(text);
    }
  };

  const translateFallback = async (text: string): Promise<TranslationResult> => {
    let retries = 0;
    const startTime = Date.now();
    
    setState(prev => ({ ...prev, isTranslating: true, error: null }));
    setProgress(0);

    while (retries <= MAX_RETRIES) {
      try {
        const response = await fetch(GEMINI_API_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text })
        });

        if (!response.ok) {
          throw new Error(`Translation failed: ${response.statusText}`);
        }

        const data = await response.json();
        
        setProgress(100);
        setState(prev => ({ ...prev, isTranslating: false, error: null }));

        return {
          translatedText: data.translatedText,
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
    }
    
    return {
      translatedText: '',
      confidence: 0,
      metadata: {
        processingTime: Date.now() - startTime,
        chunkCount: 0,
        totalChars: text.length
      }
    };
  };

  return {
    translate,
    isTranslating: state.isTranslating,
    progress: state.progress,
    error: state.error,
    progressInfo: state.progressInfo,
    canCancel: state.canCancel,
    cancelTranslation,
    setProgress,
  };
};
