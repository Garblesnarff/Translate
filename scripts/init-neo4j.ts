#!/usr/bin/env tsx
/**
 * Neo4j Initialization Script
 *
 * Initializes Neo4j graph database for Tibetan Buddhist Knowledge Graph.
 * This script:
 * - Waits for Neo4j to be ready (with retry logic)
 * - Verifies database connectivity
 * - Checks APOC and GDS plugins are installed
 * - Creates initial schema constraints and indexes (Phase 4.2)
 * - Reports initialization status
 *
 * Usage:
 *   npm run init:neo4j
 *   tsx scripts/init-neo4j.ts
 *   tsx scripts/init-neo4j.ts --clear-data (WARNING: deletes all data)
 *
 * Environment Variables:
 *   NEO4J_URI - Neo4j connection URI (default: bolt://localhost:7687)
 *   NEO4J_USERNAME - Database username (default: neo4j)
 *   NEO4J_PASSWORD - Database password (required)
 *   NEO4J_DATABASE - Database name (default: neo4j)
 *
 * Phase 4.1: Neo4j Setup
 *
 * @author Knowledge Graph Team
 */

import { getNeo4jClient, Neo4jClient } from '../server/lib/neo4jClient.js';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

/**
 * Retry configuration
 */
const RETRY_CONFIG = {
  maxRetries: 30,
  retryDelayMs: 2000,
  retryBackoffMultiplier: 1.2
};

/**
 * Sleep helper
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Wait for Neo4j to be ready with exponential backoff
 */
async function waitForNeo4j(client: Neo4jClient): Promise<void> {
  console.log('[Init] Waiting for Neo4j to be ready...');
  console.log('='.repeat(60));

  let retries = 0;
  let delay = RETRY_CONFIG.retryDelayMs;

  while (retries < RETRY_CONFIG.maxRetries) {
    try {
      // Try to connect
      await client.connect();

      // Verify health
      const healthy = await client.healthCheck();

      if (healthy) {
        console.log('[Init] ✓ Neo4j is ready and responsive\n');
        return;
      }

      throw new Error('Health check failed');
    } catch (error) {
      retries++;
      const remainingRetries = RETRY_CONFIG.maxRetries - retries;

      if (remainingRetries === 0) {
        throw new Error(
          `Neo4j did not become ready after ${RETRY_CONFIG.maxRetries} attempts. ` +
            `Error: ${error instanceof Error ? error.message : String(error)}`
        );
      }

      console.log(
        `[Init] Neo4j not ready yet. Retry ${retries}/${RETRY_CONFIG.maxRetries} ` +
          `(waiting ${delay}ms). Remaining: ${remainingRetries}`
      );

      await sleep(delay);

      // Exponential backoff
      delay = Math.floor(delay * RETRY_CONFIG.retryBackoffMultiplier);
    }
  }
}

/**
 * Verify database connection and get server info
 */
async function verifyConnection(client: Neo4jClient): Promise<void> {
  console.log('[Init] Verifying database connection...');
  console.log('='.repeat(60));

  try {
    const stats = await client.getStats();

    console.log('[Init] Connection Status:');
    console.log(`  Connected: ${stats.connected ? '✓ Yes' : '✗ No'}`);
    console.log(`  Database: ${stats.database}`);

    if (stats.serverInfo) {
      console.log(`  Server Address: ${stats.serverInfo.address}`);
      console.log(`  Server Version: ${stats.serverInfo.version}`);
      console.log(`  Server Edition: ${stats.serverInfo.edition}`);
    }

    console.log('');
  } catch (error) {
    console.error('[Init] ✗ Failed to verify connection:', error);
    throw error;
  }
}

/**
 * Verify required plugins (APOC, GDS)
 */
async function verifyPlugins(client: Neo4jClient): Promise<void> {
  console.log('[Init] Verifying plugins...');
  console.log('='.repeat(60));

  try {
    const plugins = await client.verifyPlugins();

    // APOC Plugin
    console.log('[Init] APOC Plugin:');
    console.log(
      `  Status: ${plugins.apoc.installed ? '✓ Installed' : '✗ Not Installed'}`
    );
    console.log(`  Version: ${plugins.apoc.version}`);

    if (!plugins.apoc.installed) {
      console.warn(
        '\n[Init] WARNING: APOC plugin is not installed or not accessible.'
      );
      console.warn(
        '[Init] Install with: NEO4J_PLUGINS=["apoc"] in docker-compose.yml'
      );
    }

    console.log('');

    // GDS Plugin
    console.log('[Init] Graph Data Science (GDS) Plugin:');
    console.log(
      `  Status: ${plugins.gds.installed ? '✓ Installed' : '✗ Not Installed'}`
    );
    console.log(`  Version: ${plugins.gds.version}`);

    if (!plugins.gds.installed) {
      console.warn(
        '\n[Init] WARNING: GDS plugin is not installed or not accessible.'
      );
      console.warn(
        '[Init] Install with: NEO4J_PLUGINS=["graph-data-science"] in docker-compose.yml'
      );
    }

    console.log('');

    // Check if both are installed
    if (!plugins.apoc.installed || !plugins.gds.installed) {
      console.warn('[Init] ⚠ Some plugins are missing.');
      console.warn(
        '[Init] The knowledge graph will work but some features may be limited.\n'
      );
    } else {
      console.log('[Init] ✓ All required plugins are installed\n');
    }
  } catch (error) {
    console.error('[Init] ✗ Failed to verify plugins:', error);
    throw error;
  }
}

/**
 * Run initial schema setup
 * Note: Actual schema creation will be implemented in Phase 4.2
 */
async function runSchemaSetup(client: Neo4jClient): Promise<void> {
  console.log('[Init] Running schema setup...');
  console.log('='.repeat(60));

  try {
    // Placeholder for Phase 4.2 schema creation
    console.log(
      '[Init] Schema setup will be implemented in Phase 4.2 (Graph Schema Design)'
    );
    console.log('[Init] Current tasks:');
    console.log('  - Define node labels and properties');
    console.log('  - Create uniqueness constraints');
    console.log('  - Create indexes for performance');
    console.log('  - Define relationship types');
    console.log('');

    // Simple verification query
    const result = await client.executeRead<{ count: number }>(
      'MATCH (n) RETURN count(n) AS count'
    );

    const nodeCount = result[0]?.count || 0;
    console.log(`[Init] Current node count: ${nodeCount}`);
    console.log('');
  } catch (error) {
    console.error('[Init] ✗ Schema setup failed:', error);
    throw error;
  }
}

/**
 * Clear all database data (for development/testing only)
 */
async function clearDatabaseData(client: Neo4jClient): Promise<void> {
  console.log('[Init] CLEARING ALL DATABASE DATA');
  console.log('='.repeat(60));
  console.warn('[Init] ⚠ WARNING: This will delete ALL nodes and relationships!');
  console.log('');

  try {
    // Prompt for confirmation in interactive mode
    if (process.stdin.isTTY) {
      console.log('[Init] Type "yes" to confirm data deletion:');

      // Simple confirmation (in production, use a proper CLI library)
      await new Promise<void>((resolve, reject) => {
        process.stdin.once('data', (data) => {
          const answer = data.toString().trim().toLowerCase();
          if (answer === 'yes') {
            resolve();
          } else {
            reject(new Error('Data deletion cancelled by user'));
          }
        });
      });
    }

    await client.clearDatabase();
    console.log('[Init] ✓ Database cleared successfully\n');
  } catch (error) {
    if (error instanceof Error && error.message.includes('cancelled')) {
      console.log('[Init] Data deletion cancelled\n');
      return;
    }

    console.error('[Init] ✗ Failed to clear database:', error);
    throw error;
  }
}

/**
 * Display final summary
 */
function displaySummary(success: boolean): void {
  console.log('='.repeat(60));
  console.log('[Init] INITIALIZATION SUMMARY');
  console.log('='.repeat(60));

  if (success) {
    console.log('[Init] ✓ Neo4j initialization completed successfully');
    console.log('');
    console.log('[Init] Next steps:');
    console.log('  1. Access Neo4j Browser: http://localhost:7474');
    console.log(
      '  2. Run Phase 4.2 schema setup (when implemented): npm run schema:neo4j'
    );
    console.log('  3. Test connection: npm run test:integration neo4j');
    console.log('  4. Start importing entities and relationships');
  } else {
    console.log('[Init] ✗ Initialization failed');
    console.log('');
    console.log('[Init] Troubleshooting:');
    console.log('  1. Check Neo4j container is running: docker ps');
    console.log(
      '  2. View container logs: docker logs tibetan-translate-neo4j'
    );
    console.log('  3. Verify .env file has correct credentials');
    console.log('  4. Check ports 7474 and 7687 are not blocked');
    console.log('  5. See docs/infrastructure/NEO4J_SETUP.md for help');
  }

  console.log('='.repeat(60));
}

/**
 * Main initialization function
 */
async function main(): Promise<void> {
  console.log('\n');
  console.log('╔' + '═'.repeat(58) + '╗');
  console.log('║' + ' '.repeat(10) + 'Neo4j Database Initialization' + ' '.repeat(18) + '║');
  console.log('║' + ' '.repeat(8) + 'Tibetan Buddhist Knowledge Graph' + ' '.repeat(17) + '║');
  console.log('╚' + '═'.repeat(58) + '╝');
  console.log('\n');

  let client: Neo4jClient | null = null;
  let success = false;

  try {
    // Parse command line arguments
    const args = process.argv.slice(2);
    const shouldClearData = args.includes('--clear-data');

    // Validate environment variables
    const uri = process.env.NEO4J_URI || 'bolt://localhost:7687';
    const username = process.env.NEO4J_USERNAME || 'neo4j';
    const password = process.env.NEO4J_PASSWORD;
    const database = process.env.NEO4J_DATABASE || 'neo4j';

    if (!password) {
      throw new Error(
        'NEO4J_PASSWORD environment variable is required. ' +
          'Set it in .env file or export NEO4J_PASSWORD=your_password'
      );
    }

    console.log('[Init] Configuration:');
    console.log(`  URI: ${uri}`);
    console.log(`  Username: ${username}`);
    console.log(`  Database: ${database}`);
    console.log(`  Clear Data: ${shouldClearData ? 'Yes' : 'No'}`);
    console.log('\n');

    // Initialize client
    client = getNeo4jClient({ uri, username, password, database });

    // Wait for Neo4j to be ready
    await waitForNeo4j(client);

    // Verify connection
    await verifyConnection(client);

    // Verify plugins
    await verifyPlugins(client);

    // Clear data if requested
    if (shouldClearData) {
      await clearDatabaseData(client);
    }

    // Run schema setup
    await runSchemaSetup(client);

    success = true;
  } catch (error) {
    console.error('\n[Init] Fatal error during initialization:');
    console.error(error);
    console.log('');
    success = false;
  } finally {
    // Disconnect from database
    if (client) {
      try {
        await client.disconnect();
      } catch (error) {
        console.error('[Init] Error during disconnect:', error);
      }
    }

    // Display summary
    displaySummary(success);

    // Exit with appropriate code
    process.exit(success ? 0 : 1);
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { waitForNeo4j, verifyConnection, verifyPlugins, runSchemaSetup };
