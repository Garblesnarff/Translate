#!/usr/bin/env node

/**
 * CLI Tool for Manual Graph Synchronization
 *
 * Provides command-line interface for running sync operations
 *
 * Usage:
 *   npm run sync -- full                    # Full sync
 *   npm run sync -- incremental             # Incremental sync
 *   npm run sync -- consistency             # Check consistency
 *   npm run sync -- entity <id>             # Sync single entity
 *   npm run sync -- relationship <id>       # Sync single relationship
 *
 * Phase 4, Task 4.3: Sync Service
 */

import { getNeo4jClient } from '../server/lib/neo4jClient';
import { getDatabase, getTables } from '../db/config';
import { getGraphSyncService } from '../server/services/neo4j/GraphSyncService';
import { createConsistencyChecker } from '../server/services/neo4j/consistencyChecker';
import { getSyncMonitor } from '../server/services/neo4j/syncMonitor';
import { getSyncConfig } from '../server/config/syncConfig';

// ============================================================================
// Command Handlers
// ============================================================================

/**
 * Run full sync
 */
async function runFullSync(clearExisting: boolean = false): Promise<void> {
  console.log('='.repeat(60));
  console.log('FULL SYNC: PostgreSQL → Neo4j');
  console.log('='.repeat(60));
  console.log('');

  if (clearExisting) {
    console.log('⚠️  WARNING: This will clear all existing data in Neo4j');
    console.log('');
  }

  const neo4jClient = getNeo4jClient();
  await neo4jClient.connect();

  const db = getDatabase();
  const tables = getTables();
  const syncService = getGraphSyncService(neo4jClient, db, tables);
  const monitor = getSyncMonitor();
  const config = getSyncConfig();

  const syncId = monitor.recordSyncStart('full');

  try {
    const result = await syncService.fullSync(
      {
        clearExisting,
        batchSize: config.batchSize,
        maxRetries: config.maxRetries,
        retryDelayMs: config.retryDelayMs
      },
      (progress) => {
        const bar = '█'.repeat(Math.floor(progress.percentage / 2));
        const empty = '░'.repeat(50 - Math.floor(progress.percentage / 2));
        process.stdout.write(
          `\r${progress.phase.padEnd(15)} [${bar}${empty}] ${progress.percentage.toFixed(1)}% (${progress.processed}/${progress.total})`
        );
      }
    );

    process.stdout.write('\n\n');

    monitor.recordSyncComplete(syncId, result, 'full');

    console.log('✓ Full sync completed');
    console.log('');
    console.log(`Duration: ${(result.duration / 1000).toFixed(2)}s`);
    console.log(`Entities synced: ${result.entitiesSynced}`);
    console.log(`Relationships synced: ${result.relationshipsSynced}`);

    if (result.entitiesFailed > 0 || result.relationshipsFailed > 0) {
      console.log(`⚠️  Failed: ${result.entitiesFailed} entities, ${result.relationshipsFailed} relationships`);

      if (result.errors.length > 0) {
        console.log('');
        console.log('Errors:');
        result.errors.slice(0, 10).forEach(error => console.log(`  - ${error}`));

        if (result.errors.length > 10) {
          console.log(`  ... and ${result.errors.length - 10} more`);
        }
      }
    }

    console.log('');
  } catch (error) {
    monitor.recordSyncError(syncId, error as Error, 'full');
    console.error('');
    console.error('✗ Full sync failed');
    console.error(error);
    process.exit(1);
  } finally {
    await neo4jClient.disconnect();
  }
}

/**
 * Run incremental sync
 */
async function runIncrementalSync(since?: string): Promise<void> {
  console.log('='.repeat(60));
  console.log('INCREMENTAL SYNC');
  console.log('='.repeat(60));
  console.log('');

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

  console.log(`Syncing changes since: ${lastSyncTime.toISOString()}`);
  console.log('');

  const neo4jClient = getNeo4jClient();
  await neo4jClient.connect();

  const db = getDatabase();
  const tables = getTables();
  const syncService = getGraphSyncService(neo4jClient, db, tables);
  const config = getSyncConfig();

  const syncId = monitor.recordSyncStart('incremental');

  try {
    const result = await syncService.incrementalSync(lastSyncTime, {
      batchSize: config.batchSize,
      maxRetries: config.maxRetries,
      retryDelayMs: config.retryDelayMs
    });

    monitor.recordSyncComplete(syncId, result, 'incremental');

    console.log('✓ Incremental sync completed');
    console.log('');
    console.log(`Duration: ${(result.duration / 1000).toFixed(2)}s`);
    console.log(`Entities synced: ${result.entitiesSynced}`);
    console.log(`Relationships synced: ${result.relationshipsSynced}`);
    console.log('');
  } catch (error) {
    monitor.recordSyncError(syncId, error as Error, 'incremental');
    console.error('✗ Incremental sync failed');
    console.error(error);
    process.exit(1);
  } finally {
    await neo4jClient.disconnect();
  }
}

/**
 * Check consistency
 */
async function checkConsistency(): Promise<void> {
  console.log('='.repeat(60));
  console.log('CONSISTENCY CHECK');
  console.log('='.repeat(60));
  console.log('');

  const neo4jClient = getNeo4jClient();
  await neo4jClient.connect();

  const db = getDatabase();
  const tables = getTables();
  const checker = createConsistencyChecker(neo4jClient, db, tables);

  try {
    const report = await checker.checkConsistency({
      checkProperties: true,
      checkOrphans: true,
      sampleSize: 100,
      maxMissingToReport: 100
    });

    console.log(report.summary);
    console.log('');

    if (!report.consistent) {
      console.log('⚠️  Databases are inconsistent. Run full sync to fix.');
      process.exit(1);
    }
  } catch (error) {
    console.error('✗ Consistency check failed');
    console.error(error);
    process.exit(1);
  } finally {
    await neo4jClient.disconnect();
  }
}

/**
 * Sync single entity
 */
async function syncEntity(entityId: string): Promise<void> {
  console.log(`Syncing entity: ${entityId}`);

  const neo4jClient = getNeo4jClient();
  await neo4jClient.connect();

  const db = getDatabase();
  const tables = getTables();
  const syncService = getGraphSyncService(neo4jClient, db, tables);
  const config = getSyncConfig();

  try {
    await syncService.syncEntity(entityId, {
      maxRetries: config.maxRetries,
      retryDelayMs: config.retryDelayMs
    });

    console.log(`✓ Entity ${entityId} synced successfully`);
  } catch (error) {
    console.error(`✗ Failed to sync entity ${entityId}`);
    console.error(error);
    process.exit(1);
  } finally {
    await neo4jClient.disconnect();
  }
}

/**
 * Sync single relationship
 */
async function syncRelationship(relationshipId: string): Promise<void> {
  console.log(`Syncing relationship: ${relationshipId}`);

  const neo4jClient = getNeo4jClient();
  await neo4jClient.connect();

  const db = getDatabase();
  const tables = getTables();
  const syncService = getGraphSyncService(neo4jClient, db, tables);
  const config = getSyncConfig();

  try {
    await syncService.syncRelationship(relationshipId, {
      maxRetries: config.maxRetries,
      retryDelayMs: config.retryDelayMs,
      createBidirectional: true
    });

    console.log(`✓ Relationship ${relationshipId} synced successfully`);
  } catch (error) {
    console.error(`✗ Failed to sync relationship ${relationshipId}`);
    console.error(error);
    process.exit(1);
  } finally {
    await neo4jClient.disconnect();
  }
}

// ============================================================================
// CLI Interface
// ============================================================================

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log('Usage:');
    console.log('  npm run sync -- full [--clear]     # Full sync');
    console.log('  npm run sync -- incremental [date] # Incremental sync');
    console.log('  npm run sync -- consistency        # Check consistency');
    console.log('  npm run sync -- entity <id>        # Sync entity');
    console.log('  npm run sync -- relationship <id>  # Sync relationship');
    console.log('');
    process.exit(0);
  }

  const command = args[0];

  try {
    switch (command) {
      case 'full':
        await runFullSync(args.includes('--clear'));
        break;

      case 'incremental':
        await runIncrementalSync(args[1]);
        break;

      case 'consistency':
        await checkConsistency();
        break;

      case 'entity':
        if (!args[1]) {
          console.error('Error: entity ID required');
          process.exit(1);
        }
        await syncEntity(args[1]);
        break;

      case 'relationship':
        if (!args[1]) {
          console.error('Error: relationship ID required');
          process.exit(1);
        }
        await syncRelationship(args[1]);
        break;

      default:
        console.error(`Unknown command: ${command}`);
        process.exit(1);
    }

    process.exit(0);
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}
