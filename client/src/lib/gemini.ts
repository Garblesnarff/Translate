
import { useState, useCallback, useRef } from 'react';
import type { LogEntry } from '../types/log';

const GEMINI_API_ENDPOINT = '/api/translate';
const STREAM_API_ENDPOINT = '/api/translate/stream';
const CANCEL_API_ENDPOINT = '/api/translate/cancel';
const MAX_RETRIES = 3;
const BASE_RETRY_DELAY = 1000;

// Generate a unique session ID for tracking translations
function generateSessionId(): string {
  return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

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

export interface TranslationConfig {
  useHelperAI?: boolean;
  useMultiPass?: boolean;
  maxIterations?: number;
  qualityThreshold?: number;
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
  logs: LogEntry[];
  currentSessionId?: string;
}

export const useTranslation = () => {
  const [state, setState] = useState<TranslationState>({
    isTranslating: false,
    progress: 0,
    error: null,
    progressInfo: null,
    canCancel: false,
    logs: [],
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

  const cancelTranslation = useCallback(async () => {
    // Cancel server-side processing if we have a session ID
    if (state.currentSessionId) {
      try {
        const response = await fetch(`${CANCEL_API_ENDPOINT}/${state.currentSessionId}`, {
          method: 'POST',
        });
        
        if (response.ok) {
          const result = await response.json();
          console.log('Translation cancelled on server:', result);
        }
      } catch (error) {
        console.warn('Failed to cancel server-side translation:', error);
        // Continue with client-side cancellation even if server call fails
      }
    }

    // Cancel client-side stream
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    
    setState(prev => ({
      ...prev,
      isTranslating: false,
      canCancel: false,
      progressInfo: null,
      currentSessionId: undefined,
      error: new TranslationError('Translation cancelled by user', TranslationErrorCode.UNKNOWN_ERROR)
    }));
  }, [state.currentSessionId]);

  const clearLogs = useCallback(() => {
    setState(prev => ({
      ...prev,
      logs: []
    }));
  }, []);

  const translateWithStream = async (text: string, config?: TranslationConfig): Promise<TranslationResult> => {
    return new Promise(async (resolve, reject) => {
      startTimeRef.current = Date.now();
      let abortController = new AbortController();
      let resolved = false;
      const sessionId = generateSessionId();

      setState(prev => ({
        ...prev,
        isTranslating: true,
        error: null,
        progressInfo: null,
        canCancel: true,
        progress: 0,
        currentSessionId: sessionId
      }));

      // Store abort controller for cancellation
      const enhancedCancel = () => {
        if (!resolved) {
          resolved = true;
          abortController.abort();
          setState(prev => ({
            ...prev,
            isTranslating: false,
            canCancel: false,
            progressInfo: null,
            currentSessionId: undefined,
            error: new TranslationError('Translation cancelled by user', TranslationErrorCode.UNKNOWN_ERROR)
          }));
          reject(new TranslationError(
            'Translation cancelled by user',
            TranslationErrorCode.UNKNOWN_ERROR
          ));
        }
      };

      try {
        // Build query parameters from config
        const queryParams = new URLSearchParams();
        if (config?.useHelperAI !== undefined) {
          queryParams.append('useHelperAI', String(config.useHelperAI));
        }
        if (config?.useMultiPass !== undefined) {
          queryParams.append('useMultiPass', String(config.useMultiPass));
        }
        if (config?.maxIterations !== undefined) {
          queryParams.append('maxIterations', String(config.maxIterations));
        }
        if (config?.qualityThreshold !== undefined) {
          queryParams.append('qualityThreshold', String(config.qualityThreshold));
        }

        const queryString = queryParams.toString();
        const endpoint = queryString ? `${STREAM_API_ENDPOINT}?${queryString}` : STREAM_API_ENDPOINT;

        // First, start the translation process
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text, sessionId }),
          signal: abortController.signal
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
            let currentEventType = '';
            
            while (true) {
              const { done, value } = await reader.read();
              
              if (done) break;

              buffer += decoder.decode(value, { stream: true });
              const lines = buffer.split('\n');
              buffer = lines.pop() || '';

              for (const line of lines) {
                if (line.startsWith('event: ')) {
                  currentEventType = line.slice(7).trim();
                } else if (line.startsWith('data: ')) {
                  const data = line.slice(6);
                  if (data.trim() === '') continue; // Keep-alive

                  try {
                    const eventData = JSON.parse(data);
                    // Add event type to the data for proper handling
                    eventData._eventType = currentEventType;
                    handleStreamEvent(eventData);
                  } catch (parseError) {
                    console.warn('Failed to parse SSE data:', data, parseError);
                  }
                } else if (line === '') {
                  // Empty line marks end of event, reset event type
                  currentEventType = '';
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
          const eventType = data._eventType || 'unknown';

          console.log('SSE Event:', eventType, data);

          switch (eventType) {
            case 'start':
              setProgressInfo({
                message: data.message || 'Starting translation...',
                progress: 0,
                timeElapsed
              });
              break;

            case 'progress':
              setProgressInfo({
                message: data.message || 'Processing...',
                progress: data.progress || 5,
                currentPage: data.currentPage,
                totalPages: data.totalPages,
                timeElapsed
              });
              break;

            case 'config':
              setProgressInfo({
                message: data.message || 'Configuration loaded',
                progress: 0,
                timeElapsed
              });
              break;

            case 'pair_start':
              setProgressInfo({
                message: data.message || 'Processing page pair...',
                progress: data.progress || 10,
                currentPage: data.currentPage,
                totalPages: data.totalPages,
                timeElapsed
              });
              break;

            case 'page_start':
              setState(prev => ({
                ...prev,
                progressInfo: {
                  ...prev.progressInfo!,
                  message: data.message || 'Translating page...',
                  pageNumber: data.pageNumber,
                  pageType: data.pageType,
                  timeElapsed
                }
              }));
              break;

            case 'page_complete':
              setState(prev => ({
                ...prev,
                progressInfo: {
                  ...prev.progressInfo!,
                  message: data.message || 'Page completed',
                  pageNumber: data.pageNumber,
                  confidence: data.confidence,
                  quality: data.quality,
                  models: data.models,
                  iterations: data.iterations,
                  processingTime: data.processingTime,
                  timeElapsed
                }
              }));
              break;

            case 'page_error':
              setState(prev => ({
                ...prev,
                progressInfo: {
                  ...prev.progressInfo!,
                  message: data.message || 'Page error',
                  timeElapsed
                }
              }));
              break;

            case 'pair_complete':
              setProgressInfo({
                message: data.message || 'Pair completed',
                progress: data.progress || 50,
                currentPage: data.completedPages,
                totalPages: data.totalPages,
                timeElapsed
              });
              break;

            case 'finalizing':
              setState(prev => ({
                ...prev,
                progressInfo: {
                  ...prev.progressInfo!,
                  message: data.message || 'Finalizing...',
                  progress: data.progress || 90,
                  timeElapsed
                }
              }));
              break;

            case 'saving':
              setState(prev => ({
                ...prev,
                progressInfo: {
                  ...prev.progressInfo!,
                  message: data.message || 'Saving...',
                  progress: data.progress || 95,
                  timeElapsed
                }
              }));
              break;

            case 'complete':
              const result = data.result;
              resolved = true;
              
              setState(prev => ({ 
                ...prev, 
                isTranslating: false, 
                canCancel: false,
                progress: 100,
                currentSessionId: undefined,
                progressInfo: {
                  message: data.message || 'Complete!',
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

            case 'error':
              resolved = true;
              const error = new TranslationError(
                data.message || 'Translation error',
                data.code === 'STREAM_ERROR' ? TranslationErrorCode.API_ERROR : TranslationErrorCode.UNKNOWN_ERROR,
                data
              );

              setState(prev => ({ 
                ...prev, 
                isTranslating: false, 
                canCancel: false,
                currentSessionId: undefined,
                error
              }));

              reject(error);
              return;

            case 'log':
              // Handle log entries from server
              setState(prev => ({
                ...prev,
                logs: [...(prev.logs || []).slice(-99), data] // Keep last 100 logs
              }));
              break;

            case 'close':
              // Connection closed by server
              if (!resolved) {
                reject(new TranslationError(
                  'Connection closed unexpectedly',
                  TranslationErrorCode.NETWORK_ERROR
                ));
              }
              return;

            default:
              console.warn('Unknown SSE event type:', eventType, data);
              break;
          }
        };

        readStream().catch(error => {
          if (!resolved) {
            resolved = true;
            reject(new TranslationError(
              'Stream processing failed',
              TranslationErrorCode.NETWORK_ERROR,
              error
            ));
          }
        });
        
      } catch (error) {
        console.error('Failed to start translation stream:', error);
        resolved = true;
        reject(new TranslationError(
          'Failed to start translation stream',
          TranslationErrorCode.NETWORK_ERROR,
          error
        ));
      }
    });
  };

  const translate = async (text: string, config?: TranslationConfig): Promise<TranslationResult> => {
    try {
      // First try streaming translation
      return await translateWithStream(text, config);
    } catch (error) {
      // Fallback to regular API if SSE fails
      console.warn('Stream translation failed, falling back to regular API:', error);

      // Reset state for fallback
      setState(prev => ({
        ...prev,
        progressInfo: {
          message: 'Retrying with fallback method...',
          progress: 0,
          timeElapsed: 0
        },
        canCancel: false,
        error: null
      }));

      try {
        return await translateFallback(text, config);
      } catch (fallbackError) {
        console.error('Both streaming and fallback translation failed:', fallbackError);
        throw fallbackError;
      }
    }
  };

  const translateFallback = async (text: string, config?: TranslationConfig): Promise<TranslationResult> => {
    let retries = 0;
    const startTime = Date.now();
    const sessionId = generateSessionId();

    setState(prev => ({
      ...prev,
      isTranslating: true,
      error: null,
      currentSessionId: sessionId,
      canCancel: true
    }));
    setProgress(0);

    while (retries <= MAX_RETRIES) {
      try {
        // Build query parameters from config
        const queryParams = new URLSearchParams();
        if (config?.useHelperAI !== undefined) {
          queryParams.append('useHelperAI', String(config.useHelperAI));
        }
        if (config?.useMultiPass !== undefined) {
          queryParams.append('useMultiPass', String(config.useMultiPass));
        }
        if (config?.maxIterations !== undefined) {
          queryParams.append('maxIterations', String(config.maxIterations));
        }
        if (config?.qualityThreshold !== undefined) {
          queryParams.append('qualityThreshold', String(config.qualityThreshold));
        }

        const queryString = queryParams.toString();
        const endpoint = queryString ? `${GEMINI_API_ENDPOINT}?${queryString}` : GEMINI_API_ENDPOINT;

        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text, sessionId })
        });

        if (!response.ok) {
          throw new Error(`Translation failed: ${response.statusText}`);
        }

        const data = await response.json();
        
        setProgress(100);
        setState(prev => ({ 
          ...prev, 
          isTranslating: false, 
          error: null,
          currentSessionId: undefined,
          canCancel: false 
        }));

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
          error: translationError,
          currentSessionId: undefined,
          canCancel: false
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
    logs: state.logs,
    cancelTranslation,
    clearLogs,
    setProgress,
  };
};
