/**
 * Neo4j Connection Integration Tests
 *
 * Tests the Neo4j client connection, transactions, and basic operations.
 * These tests require a running Neo4j instance.
 *
 * Setup:
 *   1. Start Neo4j: npm run neo4j:start
 *   2. Wait for it to be ready (30-60 seconds)
 *   3. Run tests: npm run test:integration neo4j
 *
 * Environment Variables Required:
 *   - NEO4J_URI (default: bolt://localhost:7687)
 *   - NEO4J_USERNAME (default: neo4j)
 *   - NEO4J_PASSWORD (required)
 *   - NEO4J_DATABASE (default: neo4j)
 *
 * Phase 4.1: Neo4j Setup - Integration Tests
 *
 * @author Knowledge Graph Team
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import {
  Neo4jClient,
  getNeo4jClient,
  resetNeo4jClient
} from '../../server/lib/neo4jClient.js';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Test configuration
const TEST_CONFIG = {
  uri: process.env.NEO4J_URI || 'bolt://localhost:7687',
  username: process.env.NEO4J_USERNAME || 'neo4j',
  password: process.env.NEO4J_PASSWORD || 'tibetan_knowledge_graph_2025',
  database: process.env.NEO4J_DATABASE || 'neo4j'
};

// Check if Neo4j is configured for testing
const isNeo4jConfigured = Boolean(process.env.NEO4J_PASSWORD);

// Test suite configuration
const testOptions = {
  // Skip tests if Neo4j is not configured
  skip: !isNeo4jConfigured,
  timeout: 30000 // 30 second timeout for integration tests
};

describe.skipIf(!isNeo4jConfigured)(
  'Neo4j Connection Integration Tests',
  testOptions,
  () => {
    let client: Neo4jClient;

    beforeAll(async () => {
      if (!isNeo4jConfigured) {
        console.log(
          'Skipping Neo4j tests: NEO4J_PASSWORD not set in environment'
        );
        return;
      }

      console.log('Initializing Neo4j client for tests...');
      client = new Neo4jClient(TEST_CONFIG);

      try {
        await client.connect();
        console.log('Neo4j client connected successfully');
      } catch (error) {
        console.error('Failed to connect to Neo4j:', error);
        throw error;
      }
    });

    afterAll(async () => {
      if (client) {
        console.log('Disconnecting Neo4j client...');
        await client.disconnect();
        resetNeo4jClient();
      }
    });

    beforeEach(async () => {
      // Clean up test data before each test
      try {
        await client.executeWrite('MATCH (n:TestNode) DETACH DELETE n');
      } catch (error) {
        // Ignore errors if no test nodes exist
      }
    });

    describe('Connection Management', () => {
      it('should successfully connect to Neo4j', () => {
        expect(client.getConnectionStatus()).toBe(true);
      });

      it('should perform health check', async () => {
        const healthy = await client.healthCheck();
        expect(healthy).toBe(true);
      });

      it('should get database statistics', async () => {
        const stats = await client.getStats();

        expect(stats).toMatchObject({
          connected: true,
          database: TEST_CONFIG.database
        });

        expect(stats.serverInfo).toBeDefined();
        expect(stats.serverInfo?.address).toBeDefined();
        expect(stats.serverInfo?.version).toBeDefined();
      });

      it('should handle connection status check', () => {
        const status = client.getConnectionStatus();
        expect(status).toBe(true);
      });
    });

    describe('Plugin Verification', () => {
      it('should verify APOC plugin availability', async () => {
        const apocInfo = await client.verifyApocPlugin();

        expect(apocInfo).toMatchObject({
          name: 'APOC',
          installed: expect.any(Boolean)
        });

        if (apocInfo.installed) {
          expect(apocInfo.version).toBeTruthy();
          console.log(`APOC version: ${apocInfo.version}`);
        } else {
          console.warn('APOC plugin not installed');
        }
      });

      it('should verify GDS plugin availability', async () => {
        const gdsInfo = await client.verifyGdsPlugin();

        expect(gdsInfo).toMatchObject({
          name: 'GDS',
          installed: expect.any(Boolean)
        });

        if (gdsInfo.installed) {
          expect(gdsInfo.version).toBeTruthy();
          console.log(`GDS version: ${gdsInfo.version}`);
        } else {
          console.warn('GDS plugin not installed');
        }
      });

      it('should verify all plugins', async () => {
        const plugins = await client.verifyPlugins();

        expect(plugins).toHaveProperty('apoc');
        expect(plugins).toHaveProperty('gds');
        expect(plugins.apoc.name).toBe('APOC');
        expect(plugins.gds.name).toBe('GDS');
      });
    });

    describe('Read Operations', () => {
      it('should execute simple read query', async () => {
        const result = await client.executeRead<{ value: number }>(
          'RETURN 1 AS value'
        );

        expect(result).toHaveLength(1);
        expect(result[0].value).toBe(1);
      });

      it('should execute parameterized read query', async () => {
        const result = await client.executeRead<{ sum: number }>(
          'RETURN $a + $b AS sum',
          { a: 10, b: 20 }
        );

        expect(result).toHaveLength(1);
        expect(result[0].sum).toBe(30);
      });

      it('should return empty array for no matches', async () => {
        const result = await client.executeRead<{ name: string }>(
          'MATCH (n:NonExistentLabel) RETURN n.name AS name'
        );

        expect(result).toEqual([]);
      });

      it('should handle complex data types', async () => {
        const result = await client.executeRead<{
          num: number;
          str: string;
          bool: boolean;
          arr: number[];
        }>(
          `RETURN
            42 AS num,
            'hello' AS str,
            true AS bool,
            [1, 2, 3] AS arr`
        );

        expect(result[0]).toMatchObject({
          num: 42,
          str: 'hello',
          bool: true,
          arr: [1, 2, 3]
        });
      });
    });

    describe('Write Operations', () => {
      it('should create a node', async () => {
        const result = await client.executeWrite<{ name: string }>(
          `CREATE (n:TestNode {name: $name, created: timestamp()})
           RETURN n.name AS name`,
          { name: 'Test Node 1' }
        );

        expect(result).toHaveLength(1);
        expect(result[0].name).toBe('Test Node 1');
      });

      it('should create multiple nodes', async () => {
        await client.executeWrite(
          `CREATE (n1:TestNode {name: 'Node 1'}),
                  (n2:TestNode {name: 'Node 2'}),
                  (n3:TestNode {name: 'Node 3'})`
        );

        const count = await client.executeRead<{ count: number }>(
          'MATCH (n:TestNode) RETURN count(n) AS count'
        );

        expect(count[0].count).toBeGreaterThanOrEqual(3);
      });

      it('should create node with relationship', async () => {
        await client.executeWrite(
          `CREATE (p:TestNode:Person {name: 'Marpa'})-[:TEACHES]->(s:TestNode:Person {name: 'Milarepa'})`
        );

        const result = await client.executeRead<{
          teacher: string;
          student: string;
        }>(
          `MATCH (p:TestNode:Person)-[:TEACHES]->(s:TestNode:Person)
           RETURN p.name AS teacher, s.name AS student`
        );

        expect(result).toHaveLength(1);
        expect(result[0].teacher).toBe('Marpa');
        expect(result[0].student).toBe('Milarepa');
      });

      it('should update node properties', async () => {
        // Create node
        await client.executeWrite(
          `CREATE (n:TestNode {name: 'Original', version: 1})`
        );

        // Update node
        await client.executeWrite(
          `MATCH (n:TestNode {name: 'Original'})
           SET n.name = 'Updated', n.version = 2`
        );

        // Verify update
        const result = await client.executeRead<{
          name: string;
          version: number;
        }>(
          `MATCH (n:TestNode {version: 2})
           RETURN n.name AS name, n.version AS version`
        );

        expect(result[0].name).toBe('Updated');
        expect(result[0].version).toBe(2);
      });

      it('should delete nodes', async () => {
        // Create nodes
        await client.executeWrite(
          `CREATE (n1:TestNode {name: 'Delete Me 1'}),
                  (n2:TestNode {name: 'Delete Me 2'})`
        );

        // Delete nodes
        await client.executeWrite(
          `MATCH (n:TestNode)
           WHERE n.name STARTS WITH 'Delete Me'
           DELETE n`
        );

        // Verify deletion
        const result = await client.executeRead<{ count: number }>(
          `MATCH (n:TestNode)
           WHERE n.name STARTS WITH 'Delete Me'
           RETURN count(n) AS count`
        );

        expect(result[0].count).toBe(0);
      });
    });

    describe('Transaction Support', () => {
      it('should execute read transaction', async () => {
        const result = await client.withReadTransaction(async (tx) => {
          const res = await tx.run('RETURN 1 AS value');
          return res.records.map((r) => r.get('value').toNumber());
        });

        expect(result).toEqual([1]);
      });

      it('should execute write transaction', async () => {
        const result = await client.withWriteTransaction(async (tx) => {
          const res = await tx.run(
            'CREATE (n:TestNode {name: $name}) RETURN n.name AS name',
            { name: 'Transaction Node' }
          );
          return res.records.map((r) => r.get('name'));
        });

        expect(result).toEqual(['Transaction Node']);

        // Verify node was created
        const verify = await client.executeRead<{ count: number }>(
          `MATCH (n:TestNode {name: 'Transaction Node'})
           RETURN count(n) AS count`
        );
        expect(verify[0].count).toBe(1);
      });

      it('should rollback failed transaction', async () => {
        try {
          await client.withWriteTransaction(async (tx) => {
            await tx.run(
              'CREATE (n:TestNode {name: $name})',
              { name: 'Rollback Test' }
            );

            // Intentionally cause an error
            throw new Error('Simulated transaction failure');
          });
        } catch (error) {
          expect(error).toBeInstanceOf(Error);
        }

        // Verify node was NOT created (transaction rolled back)
        const result = await client.executeRead<{ count: number }>(
          `MATCH (n:TestNode {name: 'Rollback Test'})
           RETURN count(n) AS count`
        );

        expect(result[0].count).toBe(0);
      });

      it('should commit successful transaction', async () => {
        await client.withWriteTransaction(async (tx) => {
          await tx.run('CREATE (n1:TestNode {name: $name1})', {
            name1: 'Commit Test 1'
          });
          await tx.run('CREATE (n2:TestNode {name: $name2})', {
            name2: 'Commit Test 2'
          });
          // No error - transaction should commit
        });

        // Verify both nodes were created
        const result = await client.executeRead<{ count: number }>(
          `MATCH (n:TestNode)
           WHERE n.name IN ['Commit Test 1', 'Commit Test 2']
           RETURN count(n) AS count`
        );

        expect(result[0].count).toBe(2);
      });
    });

    describe('Error Handling', () => {
      it('should handle invalid Cypher query', async () => {
        await expect(
          client.executeRead('INVALID CYPHER QUERY')
        ).rejects.toThrow();
      });

      it('should handle missing parameters', async () => {
        await expect(
          client.executeRead('RETURN $missingParam AS value')
        ).rejects.toThrow();
      });

      it('should handle constraint violations', async () => {
        // Note: This test assumes no unique constraints are defined
        // In Phase 4.2, we'll add constraints and test violations

        // Create two nodes with same name (should succeed without constraints)
        await client.executeWrite(
          `CREATE (n1:TestNode {name: 'Duplicate'}),
                  (n2:TestNode {name: 'Duplicate'})`
        );

        const result = await client.executeRead<{ count: number }>(
          `MATCH (n:TestNode {name: 'Duplicate'})
           RETURN count(n) AS count`
        );

        expect(result[0].count).toBe(2);
      });
    });

    describe('Singleton Pattern', () => {
      it('should return same instance from getNeo4jClient', () => {
        const instance1 = getNeo4jClient(TEST_CONFIG);
        const instance2 = getNeo4jClient(TEST_CONFIG);

        expect(instance1).toBe(instance2);
      });

      it('should reset singleton with resetNeo4jClient', () => {
        const instance1 = getNeo4jClient(TEST_CONFIG);
        resetNeo4jClient();
        const instance2 = getNeo4jClient(TEST_CONFIG);

        // After reset, instances should be different
        expect(instance1).not.toBe(instance2);
      });
    });

    describe('Data Type Conversion', () => {
      it('should handle Neo4j Integer type', async () => {
        const result = await client.executeRead<{ bigNumber: number }>(
          'RETURN 9007199254740991 AS bigNumber'
        );

        expect(result[0].bigNumber).toBeTypeOf('number');
      });

      it('should handle arrays', async () => {
        const result = await client.executeRead<{
          numbers: number[];
          strings: string[];
        }>(
          `RETURN
            [1, 2, 3, 4, 5] AS numbers,
            ['a', 'b', 'c'] AS strings`
        );

        expect(result[0].numbers).toEqual([1, 2, 3, 4, 5]);
        expect(result[0].strings).toEqual(['a', 'b', 'c']);
      });

      it('should handle null values', async () => {
        const result = await client.executeRead<{
          value: null;
        }>('RETURN null AS value');

        expect(result[0].value).toBeNull();
      });
    });

    describe('Performance', () => {
      it('should handle batch inserts efficiently', async () => {
        const startTime = Date.now();
        const batchSize = 100;

        // Create 100 nodes in one query
        const params = Array.from({ length: batchSize }, (_, i) => ({
          name: `Batch Node ${i}`,
          index: i
        }));

        await client.executeWrite(
          `UNWIND $nodes AS node
           CREATE (n:TestNode {name: node.name, index: node.index})`,
          { nodes: params }
        );

        const endTime = Date.now();
        const duration = endTime - startTime;

        console.log(
          `Created ${batchSize} nodes in ${duration}ms (${(batchSize / duration * 1000).toFixed(2)} nodes/sec)`
        );

        // Verify count
        const result = await client.executeRead<{ count: number }>(
          'MATCH (n:TestNode) WHERE n.name STARTS WITH "Batch Node" RETURN count(n) AS count'
        );

        expect(result[0].count).toBe(batchSize);
        expect(duration).toBeLessThan(5000); // Should complete in under 5 seconds
      });
    });
  }
);

// Informational test that always runs
describe('Neo4j Test Configuration', () => {
  it('should display test configuration', () => {
    console.log('\nNeo4j Test Configuration:');
    console.log('  URI:', TEST_CONFIG.uri);
    console.log('  Username:', TEST_CONFIG.username);
    console.log('  Database:', TEST_CONFIG.database);
    console.log(
      '  Password:',
      TEST_CONFIG.password ? '***configured***' : 'NOT SET'
    );
    console.log(
      '  Tests will',
      isNeo4jConfigured ? 'RUN' : 'SKIP (no password)'
    );
    console.log('\nTo enable tests:');
    console.log('  1. Start Neo4j: npm run neo4j:start');
    console.log('  2. Set NEO4J_PASSWORD in .env file');
    console.log('  3. Run: npm run test:integration neo4j\n');

    expect(true).toBe(true);
  });
});
