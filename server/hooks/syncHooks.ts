/**
 * Sync Hooks - Automatic Synchronization Triggers
 *
 * Automatically syncs entities and relationships to Neo4j when they are
 * created or updated in PostgreSQL.
 *
 * Phase 4, Task 4.3: Sync Service
 */

import type { Entity, Relationship } from '../../db/schema';
import { getNeo4jClient } from '../lib/neo4jClient';
import { getDatabase, getTables } from '../../db/config';
import { getGraphSyncService } from '../services/neo4j/GraphSyncService';
import { getSyncConfig } from '../config/syncConfig';

// ============================================================================
// Event Emitter for Database Changes
// ============================================================================

type EventHandler = (...args: any[]) => void | Promise<void>;

class DatabaseEventEmitter {
  private handlers: Map<string, EventHandler[]> = new Map();

  on(event: string, handler: EventHandler): void {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, []);
    }

    this.handlers.get(event)!.push(handler);
  }

  off(event: string, handler: EventHandler): void {
    const eventHandlers = this.handlers.get(event);

    if (eventHandlers) {
      const index = eventHandlers.indexOf(handler);

      if (index !== -1) {
        eventHandlers.splice(index, 1);
      }
    }
  }

  async emit(event: string, ...args: any[]): Promise<void> {
    const eventHandlers = this.handlers.get(event);

    if (eventHandlers) {
      for (const handler of eventHandlers) {
        try {
          await handler(...args);
        } catch (error) {
          console.error(`[SyncHooks] Error in handler for ${event}:`, error);
        }
      }
    }
  }

  clear(): void {
    this.handlers.clear();
  }
}

// Singleton event emitter
const dbEvents = new DatabaseEventEmitter();

// ============================================================================
// Sync Hook Functions
// ============================================================================

/**
 * Hook called when entity is created
 */
async function onEntityCreated(entityId: string): Promise<void> {
  const config = getSyncConfig();

  if (!config.autoSyncEnabled) {
    return;
  }

  console.log(`[SyncHooks] Entity created: ${entityId}, triggering sync`);

  try {
    const neo4jClient = getNeo4jClient();
    const db = getDatabase();
    const tables = getTables();
    const syncService = getGraphSyncService(neo4jClient, db, tables);

    await syncService.syncEntity(entityId, {
      maxRetries: config.maxRetries,
      retryDelayMs: config.retryDelayMs
    });

    console.log(`[SyncHooks] Entity ${entityId} synced successfully`);
  } catch (error) {
    console.error(`[SyncHooks] Failed to sync entity ${entityId}:`, error);
    // Don't throw - allow the main operation to succeed even if sync fails
  }
}

/**
 * Hook called when entity is updated
 */
async function onEntityUpdated(entityId: string): Promise<void> {
  const config = getSyncConfig();

  if (!config.autoSyncEnabled) {
    return;
  }

  console.log(`[SyncHooks] Entity updated: ${entityId}, triggering sync`);

  try {
    const neo4jClient = getNeo4jClient();
    const db = getDatabase();
    const tables = getTables();
    const syncService = getGraphSyncService(neo4jClient, db, tables);

    await syncService.syncEntity(entityId, {
      maxRetries: config.maxRetries,
      retryDelayMs: config.retryDelayMs
    });

    console.log(`[SyncHooks] Entity ${entityId} synced successfully`);
  } catch (error) {
    console.error(`[SyncHooks] Failed to sync entity ${entityId}:`, error);
  }
}

/**
 * Hook called when relationship is created
 */
async function onRelationshipCreated(relationshipId: string): Promise<void> {
  const config = getSyncConfig();

  if (!config.autoSyncEnabled) {
    return;
  }

  console.log(`[SyncHooks] Relationship created: ${relationshipId}, triggering sync`);

  try {
    const neo4jClient = getNeo4jClient();
    const db = getDatabase();
    const tables = getTables();
    const syncService = getGraphSyncService(neo4jClient, db, tables);

    await syncService.syncRelationship(relationshipId, {
      maxRetries: config.maxRetries,
      retryDelayMs: config.retryDelayMs,
      createBidirectional: true // Auto-create inverse relationships
    });

    console.log(`[SyncHooks] Relationship ${relationshipId} synced successfully`);
  } catch (error) {
    console.error(`[SyncHooks] Failed to sync relationship ${relationshipId}:`, error);
  }
}

/**
 * Hook called when relationship is updated
 */
async function onRelationshipUpdated(relationshipId: string): Promise<void> {
  const config = getSyncConfig();

  if (!config.autoSyncEnabled) {
    return;
  }

  console.log(`[SyncHooks] Relationship updated: ${relationshipId}, triggering sync`);

  try {
    const neo4jClient = getNeo4jClient();
    const db = getDatabase();
    const tables = getTables();
    const syncService = getGraphSyncService(neo4jClient, db, tables);

    await syncService.syncRelationship(relationshipId, {
      maxRetries: config.maxRetries,
      retryDelayMs: config.retryDelayMs,
      createBidirectional: true
    });

    console.log(`[SyncHooks] Relationship ${relationshipId} synced successfully`);
  } catch (error) {
    console.error(`[SyncHooks] Failed to sync relationship ${relationshipId}:`, error);
  }
}

/**
 * Hook called when entity is merged
 */
async function onEntityMerged(primaryId: string, duplicateId: string): Promise<void> {
  const config = getSyncConfig();

  if (!config.autoSyncEnabled) {
    return;
  }

  console.log(`[SyncHooks] Entity merged: ${duplicateId} → ${primaryId}, updating graph`);

  try {
    const neo4jClient = getNeo4jClient();
    const db = getDatabase();
    const tables = getTables();
    const syncService = getGraphSyncService(neo4jClient, db, tables);

    await syncService.handleEntityMerge(primaryId, duplicateId);

    console.log(`[SyncHooks] Entity merge handled successfully`);
  } catch (error) {
    console.error(`[SyncHooks] Failed to handle entity merge:`, error);
  }
}

// ============================================================================
// Hook Registration
// ============================================================================

/**
 * Register all sync hooks
 */
export function registerSyncHooks(): void {
  console.log('[SyncHooks] Registering sync hooks...');

  // Entity events
  dbEvents.on('entity:created', onEntityCreated);
  dbEvents.on('entity:updated', onEntityUpdated);

  // Relationship events
  dbEvents.on('relationship:created', onRelationshipCreated);
  dbEvents.on('relationship:updated', onRelationshipUpdated);

  // Merge events
  dbEvents.on('entity:merged', onEntityMerged);

  console.log('[SyncHooks] Sync hooks registered successfully');
}

/**
 * Unregister all sync hooks
 */
export function unregisterSyncHooks(): void {
  console.log('[SyncHooks] Unregistering sync hooks...');

  dbEvents.clear();

  console.log('[SyncHooks] Sync hooks unregistered');
}

// ============================================================================
// Event Trigger Functions (to be called from database operations)
// ============================================================================

/**
 * Trigger entity created event
 * Call this after inserting an entity into PostgreSQL
 */
export async function triggerEntityCreated(entityId: string): Promise<void> {
  await dbEvents.emit('entity:created', entityId);
}

/**
 * Trigger entity updated event
 * Call this after updating an entity in PostgreSQL
 */
export async function triggerEntityUpdated(entityId: string): Promise<void> {
  await dbEvents.emit('entity:updated', entityId);
}

/**
 * Trigger relationship created event
 * Call this after inserting a relationship into PostgreSQL
 */
export async function triggerRelationshipCreated(relationshipId: string): Promise<void> {
  await dbEvents.emit('relationship:created', relationshipId);
}

/**
 * Trigger relationship updated event
 * Call this after updating a relationship in PostgreSQL
 */
export async function triggerRelationshipUpdated(relationshipId: string): Promise<void> {
  await dbEvents.emit('relationship:updated', relationshipId);
}

/**
 * Trigger entity merged event
 * Call this after merging entities in PostgreSQL
 */
export async function triggerEntityMerged(primaryId: string, duplicateId: string): Promise<void> {
  await dbEvents.emit('entity:merged', primaryId, duplicateId);
}

// ============================================================================
// Initialize Hooks on Module Load
// ============================================================================

// Auto-register hooks if auto-sync is enabled
const config = getSyncConfig();

if (config.autoSyncEnabled) {
  registerSyncHooks();
  console.log('[SyncHooks] Auto-sync enabled, hooks are active');
} else {
  console.log('[SyncHooks] Auto-sync disabled, hooks will not trigger syncs');
}
