/**
 * Sync Monitor - Tracks synchronization metrics and performance
 *
 * Monitors sync operations between PostgreSQL and Neo4j, tracking:
 * - Sync frequency and duration
 * - Success/failure rates
 * - Entity and relationship counts
 * - Performance metrics
 *
 * Phase 4, Task 4.3: Sync Service
 */

import type { SyncResult } from './GraphSyncService';

// ============================================================================
// Types
// ============================================================================

export interface SyncMetrics {
  lastFullSync: Date | null;
  lastIncrementalSync: Date | null;
  lastSyncDuration: number | null; // milliseconds
  totalSyncs: number;
  successfulSyncs: number;
  failedSyncs: number;
  totalEntitiesSynced: number;
  totalRelationshipsSynced: number;
  totalErrors: number;
  averageSyncDuration: number; // milliseconds
  syncHistory: SyncHistoryEntry[];
}

export interface SyncHistoryEntry {
  id: string;
  type: 'full' | 'incremental' | 'entity' | 'relationship';
  startTime: Date;
  endTime: Date;
  duration: number;
  success: boolean;
  entitiesSynced: number;
  relationshipsSynced: number;
  errors: number;
}

// ============================================================================
// Sync Monitor Class
// ============================================================================

export class SyncMonitor {
  private metrics: SyncMetrics;
  private maxHistorySize: number;

  constructor(maxHistorySize: number = 100) {
    this.maxHistorySize = maxHistorySize;
    this.metrics = {
      lastFullSync: null,
      lastIncrementalSync: null,
      lastSyncDuration: null,
      totalSyncs: 0,
      successfulSyncs: 0,
      failedSyncs: 0,
      totalEntitiesSynced: 0,
      totalRelationshipsSynced: 0,
      totalErrors: 0,
      averageSyncDuration: 0,
      syncHistory: []
    };
  }

  /**
   * Record start of sync operation
   * Returns sync ID for tracking
   */
  recordSyncStart(type: 'full' | 'incremental'): string {
    const syncId = this.generateSyncId();

    console.log(`[SyncMonitor] Sync started: ${syncId} (type: ${type})`);

    return syncId;
  }

  /**
   * Record completion of sync operation
   */
  recordSyncComplete(syncId: string, result: SyncResult, type: 'full' | 'incremental'): void {
    // Update metrics
    this.metrics.totalSyncs++;

    if (result.success) {
      this.metrics.successfulSyncs++;
    } else {
      this.metrics.failedSyncs++;
    }

    this.metrics.totalEntitiesSynced += result.entitiesSynced;
    this.metrics.totalRelationshipsSynced += result.relationshipsSynced;
    this.metrics.totalErrors += result.errors.length;
    this.metrics.lastSyncDuration = result.duration;

    // Update last sync timestamps
    if (type === 'full') {
      this.metrics.lastFullSync = result.endTime;
    } else {
      this.metrics.lastIncrementalSync = result.endTime;
    }

    // Update average duration
    this.updateAverageDuration(result.duration);

    // Add to history
    const historyEntry: SyncHistoryEntry = {
      id: syncId,
      type,
      startTime: result.startTime,
      endTime: result.endTime,
      duration: result.duration,
      success: result.success,
      entitiesSynced: result.entitiesSynced,
      relationshipsSynced: result.relationshipsSynced,
      errors: result.errors.length
    };

    this.addToHistory(historyEntry);

    console.log(`[SyncMonitor] Sync completed: ${syncId} (success: ${result.success}, duration: ${result.duration}ms)`);
  }

  /**
   * Record sync error
   */
  recordSyncError(syncId: string, error: Error, type: 'full' | 'incremental'): void {
    this.metrics.totalSyncs++;
    this.metrics.failedSyncs++;
    this.metrics.totalErrors++;

    // Add to history
    const historyEntry: SyncHistoryEntry = {
      id: syncId,
      type,
      startTime: new Date(),
      endTime: new Date(),
      duration: 0,
      success: false,
      entitiesSynced: 0,
      relationshipsSynced: 0,
      errors: 1
    };

    this.addToHistory(historyEntry);

    console.error(`[SyncMonitor] Sync error: ${syncId} - ${error.message}`);
  }

  /**
   * Get current metrics
   */
  getMetrics(): SyncMetrics {
    return { ...this.metrics };
  }

  /**
   * Get sync history
   */
  getHistory(limit?: number): SyncHistoryEntry[] {
    if (limit) {
      return this.metrics.syncHistory.slice(0, limit);
    }

    return [...this.metrics.syncHistory];
  }

  /**
   * Get success rate
   */
  getSuccessRate(): number {
    if (this.metrics.totalSyncs === 0) {
      return 1.0;
    }

    return this.metrics.successfulSyncs / this.metrics.totalSyncs;
  }

  /**
   * Reset metrics (for testing)
   */
  reset(): void {
    this.metrics = {
      lastFullSync: null,
      lastIncrementalSync: null,
      lastSyncDuration: null,
      totalSyncs: 0,
      successfulSyncs: 0,
      failedSyncs: 0,
      totalEntitiesSynced: 0,
      totalRelationshipsSynced: 0,
      totalErrors: 0,
      averageSyncDuration: 0,
      syncHistory: []
    };
  }

  // ==========================================================================
  // Helper Methods
  // ==========================================================================

  /**
   * Generate unique sync ID
   */
  private generateSyncId(): string {
    return `sync_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }

  /**
   * Update average sync duration
   */
  private updateAverageDuration(newDuration: number): void {
    if (this.metrics.totalSyncs === 1) {
      this.metrics.averageSyncDuration = newDuration;
    } else {
      // Running average
      this.metrics.averageSyncDuration =
        (this.metrics.averageSyncDuration * (this.metrics.totalSyncs - 1) + newDuration) /
        this.metrics.totalSyncs;
    }
  }

  /**
   * Add entry to history, maintaining max size
   */
  private addToHistory(entry: SyncHistoryEntry): void {
    this.metrics.syncHistory.unshift(entry);

    // Trim history if exceeds max size
    if (this.metrics.syncHistory.length > this.maxHistorySize) {
      this.metrics.syncHistory = this.metrics.syncHistory.slice(0, this.maxHistorySize);
    }
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let syncMonitorInstance: SyncMonitor | null = null;

/**
 * Get or create SyncMonitor singleton
 */
export function getSyncMonitor(): SyncMonitor {
  if (!syncMonitorInstance) {
    syncMonitorInstance = new SyncMonitor();
  }

  return syncMonitorInstance;
}

/**
 * Reset singleton (for testing)
 */
export function resetSyncMonitor(): void {
  if (syncMonitorInstance) {
    syncMonitorInstance.reset();
  }
  syncMonitorInstance = null;
}
