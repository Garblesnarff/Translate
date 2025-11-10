/**
 * Job Management API Routes
 * Task 3.2.2.3: Add Server-Sent Events endpoint
 *
 * Endpoints:
 * - POST /api/jobs - Enqueue new translation job
 * - GET /api/jobs/:id - Get job status
 * - GET /api/jobs/:id/stream - Stream job progress (SSE)
 * - DELETE /api/jobs/:id - Cancel job
 * - POST /api/jobs/:id/retry - Retry failed job
 * - GET /api/jobs - List all jobs (with pagination)
 */

import { Router, Request, Response } from 'express';
import { JobQueue } from '../services/queue/JobQueue';
import { ProgressTracker } from '../services/queue/ProgressTracker';
import type { TranslationRequest } from '../services/queue/JobWorker';

/**
 * Create job routes
 */
export function createJobRoutes(jobQueue: JobQueue, progressTracker: ProgressTracker): Router {
  const router = Router();

  /**
   * POST /api/jobs - Enqueue new translation job
   */
  router.post('/', async (req: Request, res: Response) => {
    try {
      const request: TranslationRequest = req.body;

      // Validate request
      if (!request.sourceText && (!request.chunks || request.chunks.length === 0)) {
        return res.status(400).json({
          error: 'Missing required field: sourceText or chunks',
        });
      }

      // Enqueue job
      const jobId = await jobQueue.enqueue(request);

      res.status(202).json({
        jobId,
        status: 'pending',
        message: 'Job enqueued successfully',
      });
    } catch (error) {
      console.error('[JobRoutes] Error enqueueing job:', error);
      res.status(500).json({
        error: 'Failed to enqueue job',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  /**
   * GET /api/jobs/:id - Get job status
   */
  router.get('/:id', async (req: Request, res: Response) => {
    try {
      const jobId = req.params.id;
      const status = await jobQueue.getStatus(jobId);

      res.json(status);
    } catch (error) {
      if (error instanceof Error && error.message === 'Job not found') {
        return res.status(404).json({ error: 'Job not found' });
      }

      console.error('[JobRoutes] Error getting job status:', error);
      res.status(500).json({
        error: 'Failed to get job status',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  /**
   * GET /api/jobs/:id/stream - Stream job progress using Server-Sent Events
   */
  router.get('/:id/stream', async (req: Request, res: Response) => {
    const jobId = req.params.id;

    try {
      // Verify job exists
      await jobQueue.getStatus(jobId);
    } catch (error) {
      if (error instanceof Error && error.message === 'Job not found') {
        return res.status(404).json({ error: 'Job not found' });
      }
      return res.status(500).json({ error: 'Failed to get job status' });
    }

    // Set up Server-Sent Events
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Disable buffering for Nginx

    console.log(`[JobRoutes] Starting SSE stream for job ${jobId}`);

    // Send initial connection message
    res.write(`data: ${JSON.stringify({ type: 'connected', jobId })}\n\n`);

    // Poll for job status and progress
    const intervalId = setInterval(async () => {
      try {
        const status = await jobQueue.getStatus(jobId);

        // Get progress if job is processing
        let progressInfo: any = null;
        if (status.status === 'processing') {
          try {
            progressInfo = await progressTracker.getProgress(jobId);
          } catch (error) {
            // Progress tracking might not be initialized yet
            progressInfo = {
              progress: status.progress,
              chunksCompleted: 0,
              chunksTotal: 0,
              estimatedTimeRemaining: null,
              throughput: 0,
            };
          }
        }

        // Send progress update
        const update = {
          id: status.id,
          status: status.status,
          progress: progressInfo?.progress || status.progress,
          estimatedTimeRemaining: progressInfo?.estimatedTimeRemaining || null,
          chunksCompleted: progressInfo?.chunksCompleted || 0,
          chunksTotal: progressInfo?.chunksTotal || 0,
          throughput: progressInfo?.throughput || 0,
        };

        res.write(`data: ${JSON.stringify(update)}\n\n`);

        // If job is complete, failed, or cancelled, close the stream
        if (status.status === 'completed' || status.status === 'failed' || status.status === 'cancelled') {
          console.log(`[JobRoutes] Job ${jobId} finished with status: ${status.status}`);

          // Send final status with result/error
          const finalUpdate = {
            ...update,
            result: status.result,
            error: status.error,
            completedAt: status.completedAt,
          };

          res.write(`data: ${JSON.stringify(finalUpdate)}\n\n`);
          res.write(`event: close\ndata: Job ${status.status}\n\n`);

          clearInterval(intervalId);
          res.end();
        }
      } catch (error) {
        console.error(`[JobRoutes] Error streaming job ${jobId}:`, error);
        res.write(`event: error\ndata: ${JSON.stringify({ error: 'Stream error' })}\n\n`);
        clearInterval(intervalId);
        res.end();
      }
    }, 1000); // Update every 1 second

    // Clean up on client disconnect
    req.on('close', () => {
      console.log(`[JobRoutes] Client disconnected from stream for job ${jobId}`);
      clearInterval(intervalId);
      res.end();
    });
  });

  /**
   * DELETE /api/jobs/:id - Cancel job
   */
  router.delete('/:id', async (req: Request, res: Response) => {
    try {
      const jobId = req.params.id;
      await jobQueue.cancel(jobId);

      res.json({
        message: 'Job cancelled successfully',
        jobId,
      });
    } catch (error) {
      if (error instanceof Error && error.message === 'Job not found') {
        return res.status(404).json({ error: 'Job not found' });
      }

      if (error instanceof Error && error.message.includes('Cannot cancel')) {
        return res.status(400).json({
          error: 'Cannot cancel job',
          message: error.message,
        });
      }

      console.error('[JobRoutes] Error cancelling job:', error);
      res.status(500).json({
        error: 'Failed to cancel job',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  /**
   * POST /api/jobs/:id/retry - Retry failed job
   */
  router.post('/:id/retry', async (req: Request, res: Response) => {
    try {
      const jobId = req.params.id;
      await jobQueue.retry(jobId);

      res.json({
        message: 'Job retry initiated',
        jobId,
      });
    } catch (error) {
      if (error instanceof Error && error.message === 'Job not found') {
        return res.status(404).json({ error: 'Job not found' });
      }

      if (error instanceof Error && error.message.includes('Can only retry')) {
        return res.status(400).json({
          error: 'Cannot retry job',
          message: error.message,
        });
      }

      console.error('[JobRoutes] Error retrying job:', error);
      res.status(500).json({
        error: 'Failed to retry job',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  /**
   * GET /api/jobs - List all jobs (with optional filtering and pagination)
   */
  router.get('/', async (req: Request, res: Response) => {
    try {
      const status = req.query.status as string | undefined;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
      const offset = req.query.offset ? parseInt(req.query.offset as string) : 0;

      // Get jobs from queue
      const filter = status ? { status: status as any } : undefined;
      const allJobs = await jobQueue.getQueue(filter);

      // Apply pagination
      const paginatedJobs = allJobs.slice(offset, offset + limit);

      res.json({
        jobs: paginatedJobs,
        total: allJobs.length,
        limit,
        offset,
      });
    } catch (error) {
      console.error('[JobRoutes] Error listing jobs:', error);
      res.status(500).json({
        error: 'Failed to list jobs',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  return router;
}
