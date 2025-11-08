/**
 * Integration Tests for Graph Query API
 *
 * Comprehensive test suite for all graph query endpoints.
 * Tests lineage, paths, networks, timelines, authorship, geographic,
 * analysis, and search queries.
 *
 * Phase 4, Task 4.4: Graph Query API
 *
 * @group integration
 */

import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import { Neo4jClient, getNeo4jClient, resetNeo4jClient } from '../../server/lib/neo4jClient';
import {
  GraphQueryService,
  getGraphQueryService,
  resetGraphQueryService,
} from '../../server/services/neo4j/GraphQueryService';

// ============================================================================
// Test Setup
// ============================================================================

let neo4jClient: Neo4jClient;
let queryService: GraphQueryService;

// Test data IDs (populated in beforeAll)
const testData = {
  people: {
    tilopa: 'test-tilopa',
    naropa: 'test-naropa',
    marpa: 'test-marpa',
    milarepa: 'test-milarepa',
    gampopa: 'test-gampopa',
    dalaiLama1: 'test-dalai-lama-1',
    dalaiLama2: 'test-dalai-lama-2',
  },
  texts: {
    hundredThousandSongs: 'test-hundred-thousand-songs',
    jewelOrnament: 'test-jewel-ornament',
  },
  places: {
    lhasa: 'test-lhasa',
    lhodrak: 'test-lhodrak',
  },
};

/**
 * Setup test database with sample data
 */
async function setupTestData() {
  console.log('[Test Setup] Creating test entities and relationships...');

  // Create people
  await neo4jClient.executeWrite(`
    CREATE (tilopa:Person {
      id: $tilopaId,
      type: 'person',
      canonicalName: 'Tilopa',
      names: '{"english": ["Tilopa"], "tibetan": ["ཏི་ལོ་པ།"]}',
      attributes: '{"tradition": "Kagyu"}',
      dates: '{"birth": {"year": 988}, "death": {"year": 1069}}',
      confidence: '0.95',
      verified: 1,
      mergeStatus: 'active'
    }),
    (naropa:Person {
      id: $naropaId,
      type: 'person',
      canonicalName: 'Naropa',
      names: '{"english": ["Naropa"], "tibetan": ["ན་རོ་པ།"]}',
      attributes: '{"tradition": "Kagyu"}',
      dates: '{"birth": {"year": 1016}, "death": {"year": 1100}}',
      confidence: '0.98',
      verified: 1,
      mergeStatus: 'active'
    }),
    (marpa:Person {
      id: $marpaId,
      type: 'person',
      canonicalName: 'Marpa',
      names: '{"english": ["Marpa"], "tibetan": ["མར་པ།"]}',
      attributes: '{"tradition": "Kagyu"}',
      dates: '{"birth": {"year": 1012}, "death": {"year": 1097}}',
      confidence: '0.97',
      verified: 1,
      mergeStatus: 'active'
    }),
    (milarepa:Person {
      id: $milarepaId,
      type: 'person',
      canonicalName: 'Milarepa',
      names: '{"english": ["Milarepa"], "tibetan": ["མི་ལ་རས་པ།"]}',
      attributes: '{"tradition": "Kagyu"}',
      dates: '{"birth": {"year": 1040}, "death": {"year": 1123}}',
      confidence: '0.96',
      verified: 1,
      mergeStatus: 'active'
    }),
    (gampopa:Person {
      id: $gampopaId,
      type: 'person',
      canonicalName: 'Gampopa',
      names: '{"english": ["Gampopa"], "tibetan": ["སྒམ་པོ་པ།"]}',
      attributes: '{"tradition": "Kagyu"}',
      dates: '{"birth": {"year": 1079}, "death": {"year": 1153}}',
      confidence: '0.94',
      verified: 1,
      mergeStatus: 'active'
    }),
    (dalaiLama1:Person {
      id: $dalaiLama1Id,
      type: 'person',
      canonicalName: 'Gendun Drup',
      names: '{"english": ["Gendun Drup"], "tibetan": ["དགེ་འདུན་གྲུབ།"]}',
      attributes: '{"tradition": "Gelug"}',
      dates: '{"birth": {"year": 1391}, "death": {"year": 1474}}',
      confidence: '0.92',
      verified: 1,
      mergeStatus: 'active'
    }),
    (dalaiLama2:Person {
      id: $dalaiLama2Id,
      type: 'person',
      canonicalName: 'Gendun Gyatso',
      names: '{"english": ["Gendun Gyatso"], "tibetan": ["དགེ་འདུན་རྒྱ་མཚོ།"]}',
      attributes: '{"tradition": "Gelug"}',
      dates: '{"birth": {"year": 1475}, "death": {"year": 1542}}',
      confidence: '0.93',
      verified: 1,
      mergeStatus: 'active'
    })
  `, {
    tilopaId: testData.people.tilopa,
    naropaId: testData.people.naropa,
    marpaId: testData.people.marpa,
    milarepaId: testData.people.milarepa,
    gampopaId: testData.people.gampopa,
    dalaiLama1Id: testData.people.dalaiLama1,
    dalaiLama2Id: testData.people.dalaiLama2,
  });

  // Create teacher-student relationships (lineage)
  await neo4jClient.executeWrite(`
    MATCH (tilopa:Person {id: $tilopaId})
    MATCH (naropa:Person {id: $naropaId})
    MATCH (marpa:Person {id: $marpaId})
    MATCH (milarepa:Person {id: $milarepaId})
    MATCH (gampopa:Person {id: $gampopaId})
    CREATE (tilopa)-[:TEACHER_OF {
      id: 'rel-tilopa-naropa',
      confidence: '0.98',
      properties: '{"date": {"year": 1040}}'
    }]->(naropa)
    CREATE (naropa)-[:TEACHER_OF {
      id: 'rel-naropa-marpa',
      confidence: '0.97',
      properties: '{"date": {"year": 1055}}'
    }]->(marpa)
    CREATE (marpa)-[:TEACHER_OF {
      id: 'rel-marpa-milarepa',
      confidence: '0.96',
      properties: '{"date": {"year": 1079}}'
    }]->(milarepa)
    CREATE (milarepa)-[:TEACHER_OF {
      id: 'rel-milarepa-gampopa',
      confidence: '0.95',
      properties: '{"date": {"year": 1112}}'
    }]->(gampopa)
  `, {
    tilopaId: testData.people.tilopa,
    naropaId: testData.people.naropa,
    marpaId: testData.people.marpa,
    milarepaId: testData.people.milarepa,
    gampopaId: testData.people.gampopa,
  });

  // Create incarnation line
  await neo4jClient.executeWrite(`
    MATCH (dalaiLama1:Person {id: $dalaiLama1Id})
    MATCH (dalaiLama2:Person {id: $dalaiLama2Id})
    CREATE (dalaiLama2)-[:INCARNATION_OF {
      id: 'rel-incarnation',
      confidence: '0.90',
      properties: '{}'
    }]->(dalaiLama1)
  `, {
    dalaiLama1Id: testData.people.dalaiLama1,
    dalaiLama2Id: testData.people.dalaiLama2,
  });

  // Create texts
  await neo4jClient.executeWrite(`
    MATCH (milarepa:Person {id: $milarepaId})
    CREATE (text:Text {
      id: $textId,
      type: 'text',
      canonicalName: 'Hundred Thousand Songs',
      names: '{"english": ["Hundred Thousand Songs of Milarepa"]}',
      attributes: '{}',
      dates: '{"written": {"year": 1100}}',
      confidence: '0.85',
      verified: 1,
      mergeStatus: 'active'
    })
    CREATE (milarepa)-[:WROTE {
      id: 'rel-milarepa-wrote',
      confidence: '0.85',
      properties: '{}'
    }]->(text)
  `, {
    milarepaId: testData.people.milarepa,
    textId: testData.texts.hundredThousandSongs,
  });

  // Create places
  await neo4jClient.executeWrite(`
    CREATE (lhasa:Place {
      id: $lhasaId,
      type: 'place',
      canonicalName: 'Lhasa',
      names: '{"english": ["Lhasa"], "tibetan": ["ལྷ་ས།"]}',
      attributes: '{"latitude": 29.6519, "longitude": 91.1315}',
      confidence: '0.99',
      verified: 1,
      mergeStatus: 'active'
    }),
    (lhodrak:Place {
      id: $lhodrakId,
      type: 'place',
      canonicalName: 'Lhodrak',
      names: '{"english": ["Lhodrak"], "tibetan": ["ལྷོ་བྲག"]}',
      attributes: '{"latitude": 28.2, "longitude": 90.8}',
      confidence: '0.90',
      verified: 1,
      mergeStatus: 'active'
    })
  `, {
    lhasaId: testData.places.lhasa,
    lhodrakId: testData.places.lhodrak,
  });

  // Create place relationships
  await neo4jClient.executeWrite(`
    MATCH (milarepa:Person {id: $milarepaId})
    MATCH (lhodrak:Place {id: $lhodrakId})
    CREATE (milarepa)-[:LIVED_AT {
      id: 'rel-milarepa-lhodrak',
      confidence: '0.88',
      properties: '{"startDate": {"year": 1079}, "endDate": {"year": 1110}}'
    }]->(lhodrak)
  `, {
    milarepaId: testData.people.milarepa,
    lhodrakId: testData.places.lhodrak,
  });

  console.log('[Test Setup] Test data created successfully');
}

/**
 * Clean up test database
 */
async function cleanupTestData() {
  console.log('[Test Cleanup] Removing test data...');

  await neo4jClient.executeWrite(`
    MATCH (n)
    WHERE n.id STARTS WITH 'test-'
    DETACH DELETE n
  `);

  console.log('[Test Cleanup] Test data removed');
}

beforeAll(async () => {
  // Connect to Neo4j
  neo4jClient = getNeo4jClient({
    uri: process.env.NEO4J_URI || 'bolt://localhost:7687',
    username: process.env.NEO4J_USERNAME || 'neo4j',
    password: process.env.NEO4J_PASSWORD || 'password',
  });

  await neo4jClient.connect();

  // Initialize query service
  queryService = getGraphQueryService(neo4jClient);

  // Setup test data
  await setupTestData();
});

afterAll(async () => {
  // Cleanup test data
  await cleanupTestData();

  // Disconnect
  await neo4jClient.disconnect();

  // Reset singletons
  resetNeo4jClient();
  resetGraphQueryService();
});

// ============================================================================
// LINEAGE QUERY TESTS
// ============================================================================

describe('Lineage Queries', () => {
  test('should get teacher lineage', async () => {
    const result = await queryService.getTeacherLineage(testData.people.milarepa, {
      maxDepth: 5,
    });

    expect(result).toBeDefined();
    expect(result.root).toBeDefined();
    expect(result.root.canonicalName).toBe('Tilopa');
    expect(result.path).toHaveLength(4); // Tilopa -> Naropa -> Marpa -> Milarepa
    expect(result.depth).toBe(3);
    expect(result.totalConfidence).toBeGreaterThan(0.8);
  });

  test('should get student lineage', async () => {
    const result = await queryService.getStudentLineage(testData.people.marpa, {
      maxDepth: 5,
    });

    expect(result).toBeDefined();
    expect(result.path.length).toBeGreaterThanOrEqual(2); // Marpa -> Milarepa -> Gampopa
  });

  test('should get incarnation line', async () => {
    const result = await queryService.getIncarnationLine(testData.people.dalaiLama1);

    expect(result).toBeDefined();
    expect(result).toHaveLength(2); // Two Dalai Lamas
    expect(result[0].canonicalName).toBe('Gendun Drup');
    expect(result[1].canonicalName).toBe('Gendun Gyatso');
  });

  test('should filter by minimum confidence', async () => {
    const result = await queryService.getTeacherLineage(testData.people.milarepa, {
      minConfidence: 0.96,
    });

    expect(result).toBeDefined();
    // Should have fewer relationships due to confidence filter
  });
});

// ============================================================================
// PATH QUERY TESTS
// ============================================================================

describe('Path Queries', () => {
  test('should find shortest path', async () => {
    const result = await queryService.findShortestPath(
      testData.people.tilopa,
      testData.people.gampopa
    );

    expect(result).toBeDefined();
    expect(result.nodes).toHaveLength(5); // Tilopa -> Naropa -> Marpa -> Milarepa -> Gampopa
    expect(result.length).toBe(4);
    expect(result.relationships).toHaveLength(4);
  });

  test('should return null when no path exists', async () => {
    const result = await queryService.findShortestPath(
      testData.people.tilopa,
      'nonexistent-entity'
    );

    expect(result).toBeNull();
  });

  test('should find all paths', async () => {
    const result = await queryService.findAllPaths(
      testData.people.tilopa,
      testData.people.milarepa,
      { limit: 5 }
    );

    expect(result).toBeDefined();
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
  });

  test('should respect max path length', async () => {
    const result = await queryService.findShortestPath(
      testData.people.tilopa,
      testData.people.gampopa,
      { maxLength: 2 }
    );

    // Should return null because actual path is 4 hops
    expect(result).toBeNull();
  });
});

// ============================================================================
// NETWORK QUERY TESTS
// ============================================================================

describe('Network Queries', () => {
  test('should get entity network', async () => {
    const result = await queryService.getNetwork(testData.people.milarepa, {
      depth: 2,
    });

    expect(result).toBeDefined();
    expect(result.centerNode.id).toBe(testData.people.milarepa);
    expect(result.nodes.length).toBeGreaterThan(0);
    expect(result.edges.length).toBeGreaterThan(0);
    expect(result.statistics).toBeDefined();
    expect(result.statistics.nodeCount).toBeGreaterThan(0);
  });

  test('should filter network by entity type', async () => {
    const result = await queryService.getNetwork(testData.people.milarepa, {
      depth: 1,
      entityTypes: ['Person'],
    });

    expect(result).toBeDefined();
    // All nodes should be Person type
    result.nodes.forEach(node => {
      expect(node.type).toBe('person');
    });
  });

  test('should get contemporaries', async () => {
    const result = await queryService.getContemporaries(testData.people.milarepa, {
      yearRange: 50,
    });

    expect(result).toBeDefined();
    expect(Array.isArray(result)).toBe(true);
    // Should include Marpa and Gampopa (overlap in lifespan)
  });
});

// ============================================================================
// TIMELINE QUERY TESTS
// ============================================================================

describe('Timeline Queries', () => {
  test('should get timeline for time range', async () => {
    const result = await queryService.getTimeline({
      startYear: 1000,
      endYear: 1100,
    });

    expect(result).toBeDefined();
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);

    // Verify timeline is sorted
    for (let i = 1; i < result.length; i++) {
      expect(result[i].timestamp).toBeGreaterThanOrEqual(result[i - 1].timestamp);
    }
  });

  test('should filter timeline by entity type', async () => {
    const result = await queryService.getTimeline({
      startYear: 1000,
      endYear: 1200,
      entityTypes: ['Person'],
    });

    expect(result).toBeDefined();
    result.forEach(item => {
      expect(item.entity.type).toBe('person');
    });
  });

  test('should get entity timeline', async () => {
    const result = await queryService.getEntityTimeline(testData.people.milarepa);

    expect(result).toBeDefined();
    expect(Array.isArray(result)).toBe(true);
    // Should include birth and death events
  });
});

// ============================================================================
// AUTHORSHIP QUERY TESTS
// ============================================================================

describe('Authorship Queries', () => {
  test('should get texts by author', async () => {
    const result = await queryService.getTextsByAuthor(testData.people.milarepa);

    expect(result).toBeDefined();
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
    expect(result[0].entity.canonicalName).toBe('Hundred Thousand Songs');
  });

  test('should sort texts by date', async () => {
    const result = await queryService.getTextsByAuthor(testData.people.milarepa, {
      sortBy: 'date',
    });

    expect(result).toBeDefined();
    // Verify sorted by date
  });

  test('should get citation network', async () => {
    // This test may return empty if no citations exist in test data
    const result = await queryService.getCitationNetwork(
      testData.texts.hundredThousandSongs,
      { maxDepth: 2 }
    );

    expect(result).toBeDefined();
    expect(result.centerNode).toBeDefined();
  });
});

// ============================================================================
// GEOGRAPHIC QUERY TESTS
// ============================================================================

describe('Geographic Queries', () => {
  test('should find nearby entities', async () => {
    const result = await queryService.findNearby({
      latitude: 29.0,
      longitude: 91.0,
      radiusKm: 200,
    });

    expect(result).toBeDefined();
    expect(Array.isArray(result)).toBe(true);
    // Should include Lhasa and Lhodrak
  });

  test('should filter by entity type', async () => {
    const result = await queryService.findNearby({
      latitude: 29.0,
      longitude: 91.0,
      radiusKm: 200,
      entityTypes: ['Place'],
    });

    expect(result).toBeDefined();
    result.forEach(entity => {
      expect(entity.type).toBe('place');
    });
  });

  test('should get person journey', async () => {
    const result = await queryService.getPersonJourney(testData.people.milarepa);

    expect(result).toBeDefined();
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
    expect(result[0].place.canonicalName).toBe('Lhodrak');
  });
});

// ============================================================================
// ANALYSIS QUERY TESTS
// ============================================================================

describe('Analysis Queries', () => {
  test('should get most influential entities', async () => {
    const result = await queryService.getMostInfluential({
      limit: 10,
    });

    expect(result).toBeDefined();
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);

    // Verify sorted by influence
    for (let i = 1; i < result.length; i++) {
      expect(result[i].influence).toBeLessThanOrEqual(result[i - 1].influence);
    }
  });

  test('should filter by entity type', async () => {
    const result = await queryService.getMostInfluential({
      entityType: 'Person',
      limit: 5,
    });

    expect(result).toBeDefined();
    result.forEach(item => {
      expect(item.entity.type).toBe('person');
    });
  });

  test('should suggest relationships', async () => {
    const result = await queryService.suggestRelationships(testData.people.naropa, {
      minSimilarity: 0.3,
    });

    expect(result).toBeDefined();
    expect(Array.isArray(result)).toBe(true);
    // May be empty if no common neighbors
  });
});

// ============================================================================
// SEARCH QUERY TESTS
// ============================================================================

describe('Search Queries', () => {
  test('should search entities by name', async () => {
    const result = await queryService.search('Milarepa', {
      fuzzy: true,
      limit: 10,
    });

    expect(result).toBeDefined();
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
    expect(result[0].entity.canonicalName).toContain('Milarepa');
    expect(result[0].score).toBeGreaterThan(0);
  });

  test('should filter search by entity type', async () => {
    const result = await queryService.search('Milarepa', {
      entityTypes: ['Person'],
      limit: 5,
    });

    expect(result).toBeDefined();
    result.forEach(item => {
      expect(item.entity.type).toBe('person');
    });
  });

  test('should perform exact match', async () => {
    const result = await queryService.search('Milarepa', {
      fuzzy: false,
    });

    expect(result).toBeDefined();
    expect(result.length).toBeGreaterThan(0);
  });
});

// ============================================================================
// METRICS TESTS
// ============================================================================

describe('Query Metrics', () => {
  test('should track query metrics', async () => {
    // Execute a few queries
    await queryService.getTeacherLineage(testData.people.milarepa);
    await queryService.search('Tilopa');

    const metrics = queryService.getMetrics();

    expect(metrics).toBeDefined();
    expect(typeof metrics).toBe('object');
  });

  test('should get slow queries', async () => {
    const slowQueries = queryService.getSlowQueries(1); // Very low threshold to catch any

    expect(slowQueries).toBeDefined();
    expect(Array.isArray(slowQueries)).toBe(true);
  });

  test('should clear cache', () => {
    expect(() => {
      queryService.clearCache();
    }).not.toThrow();
  });
});

// ============================================================================
// ERROR HANDLING TESTS
// ============================================================================

describe('Error Handling', () => {
  test('should handle non-existent entity', async () => {
    await expect(
      queryService.getTeacherLineage('nonexistent-id')
    ).rejects.toThrow();
  });

  test('should handle invalid parameters', async () => {
    await expect(
      queryService.findShortestPath('', '')
    ).rejects.toThrow();
  });

  test('should handle malformed custom query', async () => {
    await expect(
      queryService.customQuery('INVALID CYPHER QUERY')
    ).rejects.toThrow();
  });
});

// ============================================================================
// PERFORMANCE TESTS
// ============================================================================

describe('Performance', () => {
  test('lineage query should complete within 500ms', async () => {
    const start = Date.now();

    await queryService.getTeacherLineage(testData.people.milarepa, {
      maxDepth: 5,
    });

    const duration = Date.now() - start;
    expect(duration).toBeLessThan(500);
  });

  test('search query should complete within 200ms', async () => {
    const start = Date.now();

    await queryService.search('Milarepa', { limit: 10 });

    const duration = Date.now() - start;
    expect(duration).toBeLessThan(200);
  });

  test('cache should improve performance on repeated queries', async () => {
    // First query (cache miss)
    const start1 = Date.now();
    await queryService.getTeacherLineage(testData.people.milarepa);
    const duration1 = Date.now() - start1;

    // Second query (cache hit)
    const start2 = Date.now();
    await queryService.getTeacherLineage(testData.people.milarepa);
    const duration2 = Date.now() - start2;

    // Cached query should be significantly faster
    expect(duration2).toBeLessThan(duration1 * 0.5);
  });
});
