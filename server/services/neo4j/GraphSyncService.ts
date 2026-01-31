/**
 * Graph Synchronization Service
 *
 * Orchestrates bidirectional synchronization between PostgreSQL and Neo4j.
 * Handles full sync, incremental sync, entity/relationship sync, and merge operations.
 *
 * Features:
 * - Full database sync (PostgreSQL → Neo4j)
 * - Incremental sync (only changed entities)
 * - Single entity/relationship sync
 * - Entity merge handling
 * - Retry logic with exponential backoff
 * - Progress tracking and reporting
 *
 * Phase 4, Task 4.3: Sync Service
 */

import { eq, gt, sql } from 'drizzle-orm';
import type { Neo4jClient } from '../../lib/neo4jClient';
import type { Entity, Relationship } from '../../../db/schema';
import {
  batchUpsertEntities,
  batchUpsertRelationships,
  batchDeleteEntities,
  handleEntityMerge as batchHandleEntityMerge,
  getEntityCount,
  getRelationshipCount,
  clearAllData,
  type BatchResult,
  type BatchOptions
} from './batchOperations';

// ============================================================================
// Types
// ============================================================================

export interface SyncResult {
  success: boolean;
  entitiesSynced: number;
  relationshipsSynced: number;
  entitiesFailed: number;
  relationshipsFailed: number;
  errors: string[];
  duration: number; // milliseconds
  startTime: Date;
  endTime: Date;
}

export interface SyncOptions {
  clearExisting?: boolean; // Clear Neo4j before sync
  batchSize?: number; // Entities per batch
  continueOnError?: boolean; // Continue if batch fails
  createBidirectional?: boolean; // Auto-create inverse relationships
  maxRetries?: number; // Max retry attempts
  retryDelayMs?: number; // Initial retry delay
}

export interface ProgressCallback {
  (progress: {
    phase: 'entities' | 'relationships';
    processed: number;
    total: number;
    percentage: number;
  }): void;
}

// ============================================================================
// GraphSyncService Class
// ============================================================================

export class GraphSyncService {
  private neo4jClient: Neo4jClient;
  private db: any; // Drizzle database instance
  private tables: any; // Schema tables

  constructor(neo4jClient: Neo4jClient, db: any, tables: any) {
    this.neo4jClient = neo4jClient;
    this.db = db;
    this.tables = tables;
  }

  // ==========================================================================
  // Full Sync
  // ==========================================================================

  /**
   * Perform full synchronization from PostgreSQL to Neo4j
   */
  async fullSync(options: SyncOptions = {}, progressCallback?: ProgressCallback): Promise<SyncResult> {
    const startTime = new Date();
    console.log('[GraphSync] Starting full sync...');

    const result: SyncResult = {
      success: true,
      entitiesSynced: 0,
      relationshipsSynced: 0,
      entitiesFailed: 0,
      relationshipsFailed: 0,
      errors: [],
      duration: 0,
      startTime,
      endTime: new Date()
    };

    try {
      // Step 1: Clear existing data if requested
      if (options.clearExisting) {
        console.log('[GraphSync] Clearing existing Neo4j data...');
        await clearAllData(this.neo4jClient);
      }

      // Step 2: Sync all entities
      console.log('[GraphSync] Syncing entities...');
      const entityResult = await this.syncAllEntities(options, progressCallback);

      result.entitiesSynced = entityResult.processed;
      result.entitiesFailed = entityResult.failed;

      if (entityResult.errors.length > 0) {
        result.errors.push(...entityResult.errors.map(e => `Entity: ${e.error}`));
        result.success = false;
      }

      // Step 3: Sync all relationships
      console.log('[GraphSync] Syncing relationships...');
      const relResult = await this.syncAllRelationships(options, progressCallback);

      result.relationshipsSynced = relResult.processed;
      result.relationshipsFailed = relResult.failed;

      if (relResult.errors.length > 0) {
        result.errors.push(...relResult.errors.map(e => `Relationship: ${e.error}`));
        result.success = false;
      }

      result.endTime = new Date();
      result.duration = result.endTime.getTime() - result.startTime.getTime();

      console.log(`[GraphSync] Full sync completed in ${result.duration}ms`);
      console.log(`[GraphSync] Entities: ${result.entitiesSynced} synced, ${result.entitiesFailed} failed`);
      console.log(`[GraphSync] Relationships: ${result.relationshipsSynced} synced, ${result.relationshipsFailed} failed`);

      return result;
    } catch (error) {
      result.success = false;
      result.errors.push(error instanceof Error ? error.message : String(error));
      result.endTime = new Date();
      result.duration = result.endTime.getTime() - result.startTime.getTime();

      console.error('[GraphSync] Full sync failed:', error);
      return result;
    }
  }

  // ==========================================================================
  // Incremental Sync
  // ==========================================================================

  /**
   * Sync only entities and relationships updated since lastSyncTime
   */
  async incrementalSync(lastSyncTime: Date, options: SyncOptions = {}): Promise<SyncResult> {
    const startTime = new Date();
    console.log(`[GraphSync] Starting incremental sync (since ${lastSyncTime.toISOString()})...`);

    const result: SyncResult = {
      success: true,
      entitiesSynced: 0,
      relationshipsSynced: 0,
      entitiesFailed: 0,
      relationshipsFailed: 0,
      errors: [],
      duration: 0,
      startTime,
      endTime: new Date()
    };

    try {
      // Fetch entities updated since lastSyncTime
      const entities = await this.db
        .select()
        .from(this.tables.entities)
        .where(gt(this.tables.entities.updatedAt, lastSyncTime))
        .execute();

      console.log(`[GraphSync] Found ${entities.length} updated entities`);

      // Sync entities
      if (entities.length > 0) {
        const entityResult = await this.retryOperation(
          () => batchUpsertEntities(this.neo4jClient, entities, {
            batchSize: options.batchSize,
            continueOnError: options.continueOnError
          }),
          options.maxRetries,
          options.retryDelayMs
        );

        result.entitiesSynced = entityResult.processed;
        result.entitiesFailed = entityResult.failed;

        if (entityResult.errors.length > 0) {
          result.errors.push(...entityResult.errors.map(e => `Entity: ${e.error}`));
          result.success = false;
        }
      }

      // Fetch relationships updated since lastSyncTime
      const relationships = await this.db
        .select()
        .from(this.tables.relationships)
        .where(gt(this.tables.relationships.updatedAt, lastSyncTime))
        .execute();

      console.log(`[GraphSync] Found ${relationships.length} updated relationships`);

      // Sync relationships
      if (relationships.length > 0) {
        const relResult = await this.retryOperation(
          () => batchUpsertRelationships(this.neo4jClient, relationships, {
            batchSize: options.batchSize,
            continueOnError: options.continueOnError,
            createBidirectional: options.createBidirectional
          }),
          options.maxRetries,
          options.retryDelayMs
        );

        result.relationshipsSynced = relResult.processed;
        result.relationshipsFailed = relResult.failed;

        if (relResult.errors.length > 0) {
          result.errors.push(...relResult.errors.map(e => `Relationship: ${e.error}`));
          result.success = false;
        }
      }

      result.endTime = new Date();
      result.duration = result.endTime.getTime() - result.startTime.getTime();

      console.log(`[GraphSync] Incremental sync completed in ${result.duration}ms`);
      console.log(`[GraphSync] Entities: ${result.entitiesSynced} synced, ${result.entitiesFailed} failed`);
      console.log(`[GraphSync] Relationships: ${result.relationshipsSynced} synced, ${result.relationshipsFailed} failed`);

      return result;
    } catch (error) {
      result.success = false;
      result.errors.push(error instanceof Error ? error.message : String(error));
      result.endTime = new Date();
      result.duration = result.endTime.getTime() - result.startTime.getTime();

      console.error('[GraphSync] Incremental sync failed:', error);
      return result;
    }
  }

  // ==========================================================================
  // Single Entity/Relationship Sync
  // ==========================================================================

  /**
   * Sync a single entity to Neo4j
   */
  async syncEntity(entityId: string, options: SyncOptions = {}): Promise<void> {
    console.log(`[GraphSync] Syncing entity ${entityId}...`);

    try {
      // Fetch entity from PostgreSQL
      const entities = await this.db
        .select()
        .from(this.tables.entities)
        .where(eq(this.tables.entities.id, entityId))
        .execute();

      if (entities.length === 0) {
        throw new Error(`Entity ${entityId} not found in PostgreSQL`);
      }

      // Sync to Neo4j with retry
      await this.retryOperation(
        () => batchUpsertEntities(this.neo4jClient, entities, {
          batchSize: 1,
          continueOnError: false
        }),
        options.maxRetries || 3,
        options.retryDelayMs || 1000
      );

      console.log(`[GraphSync] Entity ${entityId} synced successfully`);
    } catch (error) {
      console.error(`[GraphSync] Failed to sync entity ${entityId}:`, error);
      throw error;
    }
  }

  /**
   * Sync a single relationship to Neo4j
   */
  async syncRelationship(relationshipId: string, options: SyncOptions = {}): Promise<void> {
    console.log(`[GraphSync] Syncing relationship ${relationshipId}...`);

    try {
      // Fetch relationship from PostgreSQL
      const relationships = await this.db
        .select()
        .from(this.tables.relationships)
        .where(eq(this.tables.relationships.id, relationshipId))
        .execute();

      if (relationships.length === 0) {
        throw new Error(`Relationship ${relationshipId} not found in PostgreSQL`);
      }

      // Sync to Neo4j with retry
      await this.retryOperation(
        () => batchUpsertRelationships(this.neo4jClient, relationships, {
          batchSize: 1,
          continueOnError: false,
          createBidirectional: options.createBidirectional
        }),
        options.maxRetries || 3,
        options.retryDelayMs || 1000
      );

      console.log(`[GraphSync] Relationship ${relationshipId} synced successfully`);
    } catch (error) {
      console.error(`[GraphSync] Failed to sync relationship ${relationshipId}:`, error);
      throw error;
    }
  }

  // ==========================================================================
  // Entity Merge Handling
  // ==========================================================================

  /**
   * Handle entity merge operation
   * Updates Neo4j to reflect the merge performed in PostgreSQL
   */
  async handleEntityMerge(primaryId: string, duplicateId: string): Promise<void> {
    console.log(`[GraphSync] Handling entity merge: ${duplicateId} → ${primaryId}`);

    try {
      // Execute merge in Neo4j
      await batchHandleEntityMerge(this.neo4jClient, primaryId, duplicateId);

      console.log(`[GraphSync] Entity merge completed successfully`);
    } catch (error) {
      console.error(`[GraphSync] Failed to handle entity merge:`, error);
      throw error;
    }
  }

  // ==========================================================================
  // Consistency Verification
  // ==========================================================================

  /**
   * Verify consistency between PostgreSQL and Neo4j
   * Returns detailed report of any discrepancies
   */
  async verifyConsistency(): Promise<{
    consistent: boolean;
    entityCountPg: number;
    entityCountNeo4j: number;
    relationshipCountPg: number;
    relationshipCountNeo4j: number;
    discrepancies: string[];
  }> {
    console.log('[GraphSync] Verifying consistency...');

    const discrepancies: string[] = [];

    // Count entities in PostgreSQL
    const entityCountResult = await this.db
      .select({ count: sql`count(*)` })
      .from(this.tables.entities)
      .where(eq(this.tables.entities.mergeStatus, 'active'))
      .execute();

    const entityCountPg = Number(entityCountResult[0]?.count || 0);

    // Count entities in Neo4j
    const entityCountNeo4j = await getEntityCount(this.neo4jClient);

    // Count relationships in PostgreSQL
    const relCountResult = await this.db
      .select({ count: sql`count(*)` })
      .from(this.tables.relationships)
      .execute();

    const relationshipCountPg = Number(relCountResult[0]?.count || 0);

    // Count relationships in Neo4j
    const relationshipCountNeo4j = await getRelationshipCount(this.neo4jClient);

    // Check for discrepancies
    if (entityCountPg !== entityCountNeo4j) {
      discrepancies.push(
        `Entity count mismatch: PostgreSQL=${entityCountPg}, Neo4j=${entityCountNeo4j}`
      );
    }

    if (relationshipCountPg !== relationshipCountNeo4j) {
      discrepancies.push(
        `Relationship count mismatch: PostgreSQL=${relationshipCountPg}, Neo4j=${relationshipCountNeo4j}`
      );
    }

    const consistent = discrepancies.length === 0;

    console.log(`[GraphSync] Consistency check: ${consistent ? 'PASS' : 'FAIL'}`);

    if (!consistent) {
      console.log('[GraphSync] Discrepancies found:');
      discrepancies.forEach(d => console.log(`  - ${d}`));
    }

    return {
      consistent,
      entityCountPg,
      entityCountNeo4j,
      relationshipCountPg,
      relationshipCountNeo4j,
      discrepancies
    };
  }

  // ==========================================================================
  // Helper Methods
  // ==========================================================================

  /**
   * Sync all entities from PostgreSQL to Neo4j
   */
  private async syncAllEntities(
    options: SyncOptions = {},
    progressCallback?: ProgressCallback
  ): Promise<BatchResult> {
    // Fetch all active entities
    const entities = await this.db
      .select()
      .from(this.tables.entities)
      .where(eq(this.tables.entities.mergeStatus, 'active'))
      .execute();

    console.log(`[GraphSync] Found ${entities.length} entities to sync`);

    // Track progress
    let processed = 0;

    const batchOpts: BatchOptions = {
      batchSize: options.batchSize || 500,
      continueOnError: options.continueOnError ?? true
    };

    // Process in batches with progress tracking
    const totalBatches = Math.ceil(entities.length / batchOpts.batchSize!);
    let currentBatch = 0;

    const allResults: BatchResult[] = [];

    for (let i = 0; i < entities.length; i += batchOpts.batchSize!) {
      const batch = entities.slice(i, i + batchOpts.batchSize!);
      currentBatch++;

      console.log(`[GraphSync] Processing entity batch ${currentBatch}/${totalBatches}...`);

      const result = await this.retryOperation(
        () => batchUpsertEntities(this.neo4jClient, batch, batchOpts),
        options.maxRetries || 3,
        options.retryDelayMs || 1000
      );

      allResults.push(result);
      processed += result.processed;

      // Report progress
      if (progressCallback) {
        progressCallback({
          phase: 'entities',
          processed,
          total: entities.length,
          percentage: (processed / entities.length) * 100
        });
      }
    }

    // Aggregate results
    return this.aggregateBatchResults(allResults);
  }

  /**
   * Sync all relationships from PostgreSQL to Neo4j
   */
  private async syncAllRelationships(
    options: SyncOptions = {},
    progressCallback?: ProgressCallback
  ): Promise<BatchResult> {
    // Fetch all relationships
    const relationships = await this.db
      .select()
      .from(this.tables.relationships)
      .execute();

    console.log(`[GraphSync] Found ${relationships.length} relationships to sync`);

    // Track progress
    let processed = 0;

    const batchOpts: BatchOptions = {
      batchSize: options.batchSize || 500,
      continueOnError: options.continueOnError ?? true,
      createBidirectional: options.createBidirectional ?? false
    };

    // Process in batches with progress tracking
    const totalBatches = Math.ceil(relationships.length / batchOpts.batchSize!);
    let currentBatch = 0;

    const allResults: BatchResult[] = [];

    for (let i = 0; i < relationships.length; i += batchOpts.batchSize!) {
      const batch = relationships.slice(i, i + batchOpts.batchSize!);
      currentBatch++;

      console.log(`[GraphSync] Processing relationship batch ${currentBatch}/${totalBatches}...`);

      const result = await this.retryOperation(
        () => batchUpsertRelationships(this.neo4jClient, batch, batchOpts),
        options.maxRetries || 3,
        options.retryDelayMs || 1000
      );

      allResults.push(result);
      processed += result.processed;

      // Report progress
      if (progressCallback) {
        progressCallback({
          phase: 'relationships',
          processed,
          total: relationships.length,
          percentage: (processed / relationships.length) * 100
        });
      }
    }

    // Aggregate results
    return this.aggregateBatchResults(allResults);
  }

  /**
   * Retry operation with exponential backoff
   */
  private async retryOperation<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    initialDelayMs: number = 1000,
    maxDelayMs: number = 10000
  ): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (attempt < maxRetries) {
          const delay = Math.min(initialDelayMs * Math.pow(2, attempt), maxDelayMs);
          console.warn(`[GraphSync] Operation failed, retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})...`);
          await this.sleep(delay);
        }
      }
    }

    throw lastError || new Error('Operation failed after max retries');
  }

  /**
   * Aggregate multiple batch results into a single result
   */
  private aggregateBatchResults(results: BatchResult[]): BatchResult {
    return results.reduce(
      (acc, result) => ({
        success: acc.success && result.success,
        processed: acc.processed + result.processed,
        failed: acc.failed + result.failed,
        errors: [...acc.errors, ...result.errors],
        duration: acc.duration + result.duration
      }),
      {
        success: true,
        processed: 0,
        failed: 0,
        errors: [],
        duration: 0
      }
    );
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let graphSyncServiceInstance: GraphSyncService | null = null;

/**
 * Get or create GraphSyncService singleton
 */
export function getGraphSyncService(
  neo4jClient: Neo4jClient,
  db: any,
  tables: any
): GraphSyncService {
  if (!graphSyncServiceInstance) {
    graphSyncServiceInstance = new GraphSyncService(neo4jClient, db, tables);
  }

  return graphSyncServiceInstance;
}

/**
 * Reset singleton instance (for testing)
 */
export function resetGraphSyncService(): void {
  graphSyncServiceInstance = null;
}
