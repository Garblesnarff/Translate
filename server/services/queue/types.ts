/**
 * Queue Types and Interfaces
 * Shared types for job queue system
 */

import type { TranslationConfig } from '../translation/types';

/**
 * Translation request structure
 */
export interface TranslationRequest {
  sourceText: string;
  config?: Partial<TranslationConfig>;
  chunks?: TranslationChunk[];
}

/**
 * Translation chunk structure
 */
export interface TranslationChunk {
  pageNumber: number;
  content: string;
  context?: {
    previousPage?: string;
    nextPage?: string;
    documentTitle?: string;
    chapter?: string;
  };
}

/**
 * Translation result structure
 */
export interface TranslationResult {
  translation: string;
  confidence: number;
  processingTime: number;
  metadata?: any;
}

/**
 * Job status enum
 */
export type JobStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';

/**
 * Job structure
 */
export interface Job {
  id: string;
  type: 'translation';
  status: JobStatus;
  request: TranslationRequest;
  result?: TranslationResult;
  error?: string;
  progress: number;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  cancelledAt?: Date;
}

/**
 * Job progress information
 */
export interface JobProgress {
  progress: number; // 0-100
  chunksCompleted: number;
  chunksTotal: number;
  estimatedTimeRemaining: number | null; // milliseconds
  throughput: number; // chunks per minute
}

/**
 * Queue statistics
 */
export interface QueueStats {
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  cancelled: number;
}
