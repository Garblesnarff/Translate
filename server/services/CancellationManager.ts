/**
 * Manages cancellation of active translation sessions
 * Allows server-side operations to be cancelled when client disconnects or user cancels
 */
export class CancellationManager {
  private static instance: CancellationManager;
  private activeTranslations = new Map<string, AbortController>();
  private sessionMetadata = new Map<string, { 
    startTime: number; 
    type: 'stream' | 'direct';
    pagesTotal?: number;
    pagesCompleted?: number;
  }>();

  private constructor() {}

  public static getInstance(): CancellationManager {
    if (!CancellationManager.instance) {
      CancellationManager.instance = new CancellationManager();
    }
    return CancellationManager.instance;
  }

  /**
   * Creates a new cancellation session with AbortController
   */
  public createSession(sessionId: string, type: 'stream' | 'direct' = 'direct', pagesTotal?: number): AbortSignal {
    // Clean up any existing session with same ID
    this.cancelSession(sessionId);

    const controller = new AbortController();
    this.activeTranslations.set(sessionId, controller);
    this.sessionMetadata.set(sessionId, {
      startTime: Date.now(),
      type,
      pagesTotal,
      pagesCompleted: 0
    });

    // Auto-cleanup after 10 minutes to prevent memory leaks
    setTimeout(() => {
      if (this.activeTranslations.has(sessionId)) {
        this.cleanupSession(sessionId);
      }
    }, 10 * 60 * 1000);

    console.log(`[CancellationManager] Created session ${sessionId} (${type})`);
    return controller.signal;
  }

  /**
   * Cancels a specific translation session
   */
  public cancelSession(sessionId: string): boolean {
    const controller = this.activeTranslations.get(sessionId);
    if (controller) {
      controller.abort('Translation cancelled by user');
      this.cleanupSession(sessionId);
      console.log(`[CancellationManager] Cancelled session ${sessionId}`);
      return true;
    }
    return false;
  }

  /**
   * Checks if a session is cancelled
   */
  public isCancelled(sessionId: string): boolean {
    const controller = this.activeTranslations.get(sessionId);
    return controller?.signal.aborted ?? false;
  }

  /**
   * Gets the AbortSignal for a session
   */
  public getSignal(sessionId: string): AbortSignal | undefined {
    return this.activeTranslations.get(sessionId)?.signal;
  }

  /**
   * Updates progress for a session
   */
  public updateProgress(sessionId: string, pagesCompleted: number): void {
    const metadata = this.sessionMetadata.get(sessionId);
    if (metadata) {
      metadata.pagesCompleted = pagesCompleted;
    }
  }

  /**
   * Clean up session without aborting (for completed translations)
   */
  public completeSession(sessionId: string): void {
    this.cleanupSession(sessionId);
    console.log(`[CancellationManager] Completed session ${sessionId}`);
  }

  /**
   * Removes session from tracking
   */
  private cleanupSession(sessionId: string): void {
    this.activeTranslations.delete(sessionId);
    this.sessionMetadata.delete(sessionId);
  }

  /**
   * Get all active sessions for monitoring
   */
  public getActiveSessions(): Array<{
    sessionId: string;
    startTime: number;
    type: string;
    duration: number;
    pagesTotal?: number;
    pagesCompleted?: number;
  }> {
    const now = Date.now();
    const sessions: Array<{
      sessionId: string;
      startTime: number;
      type: string;
      duration: number;
      pagesTotal?: number;
      pagesCompleted?: number;
    }> = [];

    for (const [sessionId, metadata] of this.sessionMetadata.entries()) {
      sessions.push({
        sessionId,
        startTime: metadata.startTime,
        type: metadata.type,
        duration: now - metadata.startTime,
        pagesTotal: metadata.pagesTotal,
        pagesCompleted: metadata.pagesCompleted
      });
    }

    return sessions;
  }

  /**
   * Cancel all active sessions (for shutdown)
   */
  public cancelAllSessions(): void {
    const sessionIds = Array.from(this.activeTranslations.keys());
    sessionIds.forEach(sessionId => this.cancelSession(sessionId));
    console.log(`[CancellationManager] Cancelled ${sessionIds.length} active sessions`);
  }

  /**
   * Throws error if session is cancelled
   */
  public static throwIfCancelled(signal?: AbortSignal, context?: string): void {
    if (signal?.aborted) {
      const error = new Error(`Translation cancelled${context ? ` during ${context}` : ''}`);
      error.name = 'TranslationCancelledError';
      throw error;
    }
  }
}

/**
 * Singleton instance for easy access
 */
export const cancellationManager = CancellationManager.getInstance();