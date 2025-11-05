/**
 * Review API Routes
 *
 * Endpoints for human review workflow: queue management,
 * approve/reject/correct translations, and analytics
 */

import { Router, Request, Response } from 'express';
import { ReviewQueue } from '../services/review/ReviewQueue';
import { FeedbackProcessor, TranslationCorrection } from '../services/review/FeedbackProcessor';
import { ReviewAnalytics } from '../services/review/ReviewAnalytics';
import { logRequest, LogLevel } from '../middleware/requestLogger';
import { db } from '@db/index';
import { getTables } from '@db/config';

const router = Router();

// Initialize services
const reviewQueue = new ReviewQueue();
const feedbackProcessor = new FeedbackProcessor();
const reviewAnalytics = new ReviewAnalytics();
const tables = getTables();

/**
 * GET /api/review/queue
 * Get pending reviews with optional filtering
 */
router.get('/queue', async (req: Request, res: Response) => {
  try {
    const { limit, severity, status } = req.query;

    let reviews = await reviewQueue.getPendingReviews(
      limit ? parseInt(limit as string) : 50
    );

    // Apply filters
    if (severity) {
      reviews = reviews.filter(r => r.severity === severity);
    }

    if (status) {
      reviews = reviews.filter(r => r.status === status);
    }

    // Get queue statistics
    const stats = await reviewQueue.getQueueStats();

    res.json({
      reviews,
      stats,
      total: reviews.length
    });
  } catch (error: any) {
    logRequest(req, LogLevel.ERROR, 'Failed to get review queue', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/review/stats
 * Get review queue statistics
 */
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const stats = await reviewQueue.getQueueStats();
    res.json(stats);
  } catch (error: any) {
    logRequest(req, LogLevel.ERROR, 'Failed to get queue stats', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/review/:id
 * Get specific review item with full translation details
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const reviewItem = await reviewQueue.getReviewById(id);

    if (!reviewItem) {
      return res.status(404).json({ error: 'Review item not found' });
    }

    // Get associated translation
    const translations = await db
      .select()
      .from(tables.translations)
      .where((table: any) => table.id.eq(reviewItem.translationId))
      .limit(1);

    const translation = translations.length > 0 ? translations[0] : null;

    res.json({
      review: reviewItem,
      translation
    });
  } catch (error: any) {
    logRequest(req, LogLevel.ERROR, 'Failed to get review item', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/review/:id/assign
 * Assign review to a user
 */
router.post('/:id/assign', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    await reviewQueue.assignReview(id, userId);

    logRequest(req, LogLevel.INFO, 'Review assigned', { reviewId: id, userId });
    res.json({ success: true, message: 'Review assigned successfully' });
  } catch (error: any) {
    logRequest(req, LogLevel.ERROR, 'Failed to assign review', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/review/:id/approve
 * Approve a translation
 */
router.post('/:id/approve', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { notes } = req.body;

    await reviewQueue.approveReview(id, notes);

    logRequest(req, LogLevel.INFO, 'Review approved', { reviewId: id });
    res.json({ success: true, message: 'Translation approved' });
  } catch (error: any) {
    logRequest(req, LogLevel.ERROR, 'Failed to approve review', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/review/:id/reject
 * Reject a translation
 */
router.post('/:id/reject', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    if (!reason) {
      return res.status(400).json({ error: 'Rejection reason is required' });
    }

    await reviewQueue.rejectReview(id, reason);

    logRequest(req, LogLevel.INFO, 'Review rejected', { reviewId: id, reason });
    res.json({ success: true, message: 'Translation rejected' });
  } catch (error: any) {
    logRequest(req, LogLevel.ERROR, 'Failed to reject review', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/review/:id/correct
 * Submit a corrected translation
 */
router.put('/:id/correct', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const {
      correctedText,
      correctionType,
      reason,
      correctedBy
    } = req.body;

    if (!correctedText) {
      return res.status(400).json({ error: 'correctedText is required' });
    }

    // Get review item
    const reviewItem = await reviewQueue.getReviewById(id);
    if (!reviewItem) {
      return res.status(404).json({ error: 'Review item not found' });
    }

    // Get original translation
    const translations = await db
      .select()
      .from(tables.translations)
      .where((table: any) => table.id.eq(reviewItem.translationId))
      .limit(1);

    if (translations.length === 0) {
      return res.status(404).json({ error: 'Original translation not found' });
    }

    const originalText = translations[0].translatedText;

    // Extract term changes
    const extractedTerms = feedbackProcessor.extractTermChanges(originalText, correctedText);

    // Record correction
    const correction: TranslationCorrection = {
      translationId: reviewItem.translationId,
      reviewItemId: id,
      originalText,
      correctedText,
      correctionType: correctionType || 'accuracy',
      correctedBy,
      correctionReason: reason,
      extractedTerms: extractedTerms.length > 0 ? extractedTerms : undefined
    };

    await feedbackProcessor.recordCorrection(correction);

    // Update translation in database with corrected version
    await db
      .update(tables.translations)
      .set({ translatedText: correctedText })
      .where((table: any) => table.id.eq(reviewItem.translationId));

    // Approve the review
    await reviewQueue.approveReview(id, `Corrected by ${correctedBy || 'reviewer'}`);

    logRequest(req, LogLevel.INFO, 'Translation corrected', {
      reviewId: id,
      termsExtracted: extractedTerms.length
    });

    res.json({
      success: true,
      message: 'Translation corrected successfully',
      extractedTerms
    });
  } catch (error: any) {
    logRequest(req, LogLevel.ERROR, 'Failed to correct translation', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/review/analytics/metrics
 * Get review metrics for a period
 */
router.get('/analytics/metrics', async (req: Request, res: Response) => {
  try {
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({
        error: 'startDate and endDate query parameters are required'
      });
    }

    const start = new Date(startDate as string);
    const end = new Date(endDate as string);

    const metrics = await reviewAnalytics.calculateMetrics(start, end);

    res.json(metrics);
  } catch (error: any) {
    logRequest(req, LogLevel.ERROR, 'Failed to get review metrics', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/review/analytics/weekly
 * Get weekly review report
 */
router.get('/analytics/weekly', async (req: Request, res: Response) => {
  try {
    const { weekStart } = req.query;

    const start = weekStart ? new Date(weekStart as string) : new Date();
    const report = await reviewAnalytics.generateWeeklyReport(start);

    const { format } = req.query;
    if (format === 'markdown') {
      const markdown = reviewAnalytics.formatWeeklyReport(report);
      res.type('text/markdown').send(markdown);
    } else {
      res.json(report);
    }
  } catch (error: any) {
    logRequest(req, LogLevel.ERROR, 'Failed to generate weekly report', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/review/corrections/patterns
 * Get correction pattern analysis
 */
router.get('/corrections/patterns', async (req: Request, res: Response) => {
  try {
    const { startDate, endDate } = req.query;

    const start = startDate ? new Date(startDate as string) : undefined;
    const end = endDate ? new Date(endDate as string) : undefined;

    const patterns = await feedbackProcessor.analyzeCorrectionPatterns(start, end);

    res.json({ patterns });
  } catch (error: any) {
    logRequest(req, LogLevel.ERROR, 'Failed to analyze patterns', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/review/corrections/unapplied
 * Get terminology corrections not yet applied to dictionary
 */
router.get('/corrections/unapplied', async (req: Request, res: Response) => {
  try {
    const corrections = await feedbackProcessor.getUnappliedTerminologyCorrections();

    res.json({
      corrections,
      count: corrections.length
    });
  } catch (error: any) {
    logRequest(req, LogLevel.ERROR, 'Failed to get unapplied corrections', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/review/corrections/:id/apply
 * Mark a correction as applied to dictionary
 */
router.post('/corrections/:id/apply', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await feedbackProcessor.markCorrectionApplied(parseInt(id));

    logRequest(req, LogLevel.INFO, 'Correction marked as applied', { correctionId: id });
    res.json({ success: true, message: 'Correction marked as applied' });
  } catch (error: any) {
    logRequest(req, LogLevel.ERROR, 'Failed to mark correction', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

export default router;
