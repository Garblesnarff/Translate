/**
 * Sync Controller
 *
 * Handles HTTP requests for graph synchronization operations
 *
 * Phase 4, Task 4.3: Sync Service
 */

import type { Request, Response } from 'express';
import { getNeo4jClient } from '../lib/neo4jClient';
import { getDatabase, getTables } from '../../db/config';
import { getGraphSyncService } from '../services/neo4j/GraphSyncService';
import { createConsistencyChecker } from '../services/neo4j/consistencyChecker';
import { getSyncMonitor } from '../services/neo4j/syncMonitor';
import { getSyncConfig } from '../config/syncConfig';

/**
 * POST /api/sync/full
 * Trigger full synchronization from PostgreSQL to Neo4j
 */
export async function handleFullSync(req: Request, res: Response) {
  try {
    const { clearExisting = false } = req.body;

    console.log(`[SyncAPI] Full sync requested (clearExisting: ${clearExisting})`);

    // Get services
    const neo4jClient = getNeo4jClient();
    const db = getDatabase();
    const tables = getTables();
    const syncService = getGraphSyncService(neo4jClient, db, tables);
    const monitor = getSyncMonitor();
    const config = getSyncConfig();

    // Record start
    const syncId = monitor.recordSyncStart('full');

    // Execute sync
    const result = await syncService.fullSync(
      {
        clearExisting,
        batchSize: config.batchSize,
        maxRetries: config.maxRetries,
        retryDelayMs: config.retryDelayMs
      },
      (progress) => {
        console.log(`[SyncAPI] Progress: ${progress.phase} ${progress.percentage.toFixed(1)}%`);
      }
    );

    // Record completion
    monitor.recordSyncComplete(syncId, result, 'full');

    res.json({
      success: result.success,
      syncId,
      result,
      metrics: monitor.getMetrics()
    });
  } catch (error) {
    console.error('[SyncAPI] Full sync error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

/**
 * POST /api/sync/incremental
 * Trigger incremental synchronization
 */
export async function handleIncrementalSync(req: Request, res: Response) {
  try {
    const { since } = req.body;

    // Default to last sync time or 1 hour ago
    const monitor = getSyncMonitor();
    const metrics = monitor.getMetrics();

    let lastSyncTime: Date;

    if (since) {
      lastSyncTime = new Date(since);
    } else if (metrics.lastIncrementalSync) {
      lastSyncTime = metrics.lastIncrementalSync;
    } else {
      lastSyncTime = new Date(Date.now() - 60 * 60 * 1000); // 1 hour ago
    }

    console.log(`[SyncAPI] Incremental sync requested (since: ${lastSyncTime.toISOString()})`);

    // Get services
    const neo4jClient = getNeo4jClient();
    const db = getDatabase();
    const tables = getTables();
    const syncService = getGraphSyncService(neo4jClient, db, tables);
    const config = getSyncConfig();

    // Record start
    const syncId = monitor.recordSyncStart('incremental');

    // Execute sync
    const result = await syncService.incrementalSync(lastSyncTime, {
      batchSize: config.batchSize,
      maxRetries: config.maxRetries,
      retryDelayMs: config.retryDelayMs
    });

    // Record completion
    monitor.recordSyncComplete(syncId, result, 'incremental');

    res.json({
      success: result.success,
      syncId,
      lastSyncTime: lastSyncTime.toISOString(),
      result,
      metrics: monitor.getMetrics()
    });
  } catch (error) {
    console.error('[SyncAPI] Incremental sync error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

/**
 * POST /api/sync/entity/:entityId
 * Sync single entity
 */
export async function handleSyncEntity(req: Request, res: Response) {
  try {
    const { entityId } = req.params;

    console.log(`[SyncAPI] Entity sync requested: ${entityId}`);

    // Get services
    const neo4jClient = getNeo4jClient();
    const db = getDatabase();
    const tables = getTables();
    const syncService = getGraphSyncService(neo4jClient, db, tables);
    const config = getSyncConfig();

    // Execute sync
    await syncService.syncEntity(entityId, {
      maxRetries: config.maxRetries,
      retryDelayMs: config.retryDelayMs
    });

    res.json({
      success: true,
      entityId,
      message: 'Entity synced successfully'
    });
  } catch (error) {
    console.error(`[SyncAPI] Entity sync error:`, error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

/**
 * POST /api/sync/relationship/:relationshipId
 * Sync single relationship
 */
export async function handleSyncRelationship(req: Request, res: Response) {
  try {
    const { relationshipId } = req.params;

    console.log(`[SyncAPI] Relationship sync requested: ${relationshipId}`);

    // Get services
    const neo4jClient = getNeo4jClient();
    const db = getDatabase();
    const tables = getTables();
    const syncService = getGraphSyncService(neo4jClient, db, tables);
    const config = getSyncConfig();

    // Execute sync
    await syncService.syncRelationship(relationshipId, {
      maxRetries: config.maxRetries,
      retryDelayMs: config.retryDelayMs
    });

    res.json({
      success: true,
      relationshipId,
      message: 'Relationship synced successfully'
    });
  } catch (error) {
    console.error(`[SyncAPI] Relationship sync error:`, error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

/**
 * GET /api/sync/consistency
 * Check consistency between databases
 */
export async function handleConsistencyCheck(req: Request, res: Response) {
  try {
    const {
      checkProperties = true,
      checkOrphans = true,
      sampleSize = 100,
      maxMissingToReport = 100
    } = req.query;

    console.log('[SyncAPI] Consistency check requested');

    // Get services
    const neo4jClient = getNeo4jClient();
    const db = getDatabase();
    const tables = getTables();
    const checker = createConsistencyChecker(neo4jClient, db, tables);

    // Run check
    const report = await checker.checkConsistency({
      checkProperties: checkProperties === 'true' || checkProperties === true,
      checkOrphans: checkOrphans === 'true' || checkOrphans === true,
      sampleSize: parseInt(String(sampleSize)),
      maxMissingToReport: parseInt(String(maxMissingToReport))
    });

    res.json({
      success: true,
      report
    });
  } catch (error) {
    console.error('[SyncAPI] Consistency check error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

/**
 * GET /api/sync/status
 * Get sync metrics and status
 */
export async function handleSyncStatus(req: Request, res: Response) {
  try {
    const monitor = getSyncMonitor();
    const config = getSyncConfig();

    const metrics = monitor.getMetrics();
    const history = monitor.getHistory(20); // Last 20 syncs
    const successRate = monitor.getSuccessRate();

    res.json({
      success: true,
      metrics,
      history,
      successRate,
      config: {
        autoSyncEnabled: config.autoSyncEnabled,
        incrementalSyncIntervalMs: config.incrementalSyncIntervalMs,
        fullSyncSchedule: config.fullSyncSchedule,
        consistencyCheckSchedule: config.consistencyCheckSchedule
      }
    });
  } catch (error) {
    console.error('[SyncAPI] Status error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
