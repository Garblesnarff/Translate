/**
 * Batch Operations Service for Neo4j
 *
 * Provides efficient bulk operations for creating, updating, and deleting
 * nodes and relationships in Neo4j using UNWIND for performance.
 *
 * Performance targets:
 * - 500-1000 entities per batch
 * - 10,000 entities in <60 seconds
 *
 * Phase 4, Task 4.3: Sync Service
 */

import type { Neo4jClient } from '../../lib/neo4jClient';
import type { Entity, Relationship } from '../../../db/schema';
import {
  pgEntityToNeo4jNode,
  pgRelationshipToNeo4jRel,
  entityTypeToLabels,
  predicateToRelType,
  getInverseRelType
} from './typeMapping';

// ============================================================================
// Types
// ============================================================================

export interface BatchResult {
  success: boolean;
  processed: number;
  failed: number;
  errors: Array<{
    index: number;
    error: string;
    item?: any;
  }>;
  duration: number; // milliseconds
}

export interface BatchOptions {
  batchSize?: number;
  continueOnError?: boolean;
  createBidirectional?: boolean; // Auto-create inverse relationships
}

// ============================================================================
// Batch Entity Operations
// ============================================================================

/**
 * Batch create or update entities in Neo4j
 */
export async function batchUpsertEntities(
  client: Neo4jClient,
  entities: Entity[],
  options: BatchOptions = {}
): Promise<BatchResult> {
  const startTime = Date.now();
  const batchSize = options.batchSize || 500;
  const continueOnError = options.continueOnError ?? true;

  const result: BatchResult = {
    success: true,
    processed: 0,
    failed: 0,
    errors: [],
    duration: 0
  };

  // Process in batches
  for (let i = 0; i < entities.length; i += batchSize) {
    const batch = entities.slice(i, i + batchSize);

    try {
      await processBatchUpsertEntities(client, batch);
      result.processed += batch.length;
    } catch (error) {
      result.failed += batch.length;
      result.success = false;
      result.errors.push({
        index: i,
        error: error instanceof Error ? error.message : String(error),
        item: batch[0] // Include first item for debugging
      });

      if (!continueOnError) {
        result.duration = Date.now() - startTime;
        return result;
      }
    }
  }

  result.duration = Date.now() - startTime;
  return result;
}

/**
 * Process a single batch of entity upserts
 */
async function processBatchUpsertEntities(
  client: Neo4jClient,
  entities: Entity[]
): Promise<void> {
  // Convert entities to Neo4j node format
  const nodes = entities.map(entity => {
    const props = pgEntityToNeo4jNode(entity);
    const labels = entityTypeToLabels(entity.type);

    return {
      id: entity.id,
      labels,
      properties: props
    };
  });

  // Use UNWIND for efficient batch operation
  const query = `
    UNWIND $nodes AS node

    // Create or match the node with both labels
    CALL apoc.merge.node(
      node.labels,
      {id: node.id},
      node.properties,
      node.properties
    ) YIELD node AS n

    // Set synced timestamp
    SET n.synced_at = datetime()

    RETURN count(n) as created
  `;

  try {
    await client.executeWrite(query, { nodes });
  } catch (error) {
    // Fallback to non-APOC method if APOC is not available
    console.warn('[BatchOps] APOC not available, using fallback method');
    await processBatchUpsertEntitiesFallback(client, nodes);
  }
}

/**
 * Fallback method without APOC
 */
async function processBatchUpsertEntitiesFallback(
  client: Neo4jClient,
  nodes: Array<{ id: string; labels: string[]; properties: any }>
): Promise<void> {
  const query = `
    UNWIND $nodes AS node

    // MERGE on Entity label with id
    MERGE (e:Entity {id: node.id})

    // Set all labels
    WITH e, node
    CALL apoc.create.addLabels(e, node.labels) YIELD node AS labeled

    // Set all properties
    SET labeled += node.properties
    SET labeled.synced_at = datetime()

    RETURN count(labeled) as created
  `;

  try {
    await client.executeWrite(query, { nodes });
  } catch (error) {
    // Final fallback: simple MERGE without dynamic labels
    for (const node of nodes) {
      const labelString = node.labels.join(':');
      const simpleQuery = `
        MERGE (e:${labelString} {id: $id})
        SET e += $properties
        SET e.synced_at = datetime()
      `;

      await client.executeWrite(simpleQuery, {
        id: node.id,
        properties: node.properties
      });
    }
  }
}

/**
 * Batch delete entities from Neo4j
 */
export async function batchDeleteEntities(
  client: Neo4jClient,
  entityIds: string[],
  options: BatchOptions = {}
): Promise<BatchResult> {
  const startTime = Date.now();
  const batchSize = options.batchSize || 1000;

  const result: BatchResult = {
    success: true,
    processed: 0,
    failed: 0,
    errors: [],
    duration: 0
  };

  // Process in batches
  for (let i = 0; i < entityIds.length; i += batchSize) {
    const batch = entityIds.slice(i, i + batchSize);

    try {
      const query = `
        UNWIND $ids AS id
        MATCH (e:Entity {id: id})
        DETACH DELETE e
      `;

      await client.executeWrite(query, { ids: batch });
      result.processed += batch.length;
    } catch (error) {
      result.failed += batch.length;
      result.success = false;
      result.errors.push({
        index: i,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  result.duration = Date.now() - startTime;
  return result;
}

// ============================================================================
// Batch Relationship Operations
// ============================================================================

/**
 * Batch create or update relationships in Neo4j
 */
export async function batchUpsertRelationships(
  client: Neo4jClient,
  relationships: Relationship[],
  options: BatchOptions = {}
): Promise<BatchResult> {
  const startTime = Date.now();
  const batchSize = options.batchSize || 500;
  const continueOnError = options.continueOnError ?? true;
  const createBidirectional = options.createBidirectional ?? false;

  const result: BatchResult = {
    success: true,
    processed: 0,
    failed: 0,
    errors: [],
    duration: 0
  };

  // Group relationships by predicate type for efficiency
  const relsByType = new Map<string, Relationship[]>();

  for (const rel of relationships) {
    const relType = predicateToRelType(rel.predicate);
    if (!relsByType.has(relType)) {
      relsByType.set(relType, []);
    }
    relsByType.get(relType)!.push(rel);
  }

  // Process each type separately
  for (const [relType, rels] of relsByType.entries()) {
    // Process in batches
    for (let i = 0; i < rels.length; i += batchSize) {
      const batch = rels.slice(i, i + batchSize);

      try {
        await processBatchUpsertRelationships(client, batch, relType, createBidirectional);
        result.processed += batch.length;
      } catch (error) {
        result.failed += batch.length;
        result.success = false;
        result.errors.push({
          index: i,
          error: error instanceof Error ? error.message : String(error),
          item: batch[0]
        });

        if (!continueOnError) {
          result.duration = Date.now() - startTime;
          return result;
        }
      }
    }
  }

  result.duration = Date.now() - startTime;
  return result;
}

/**
 * Process a single batch of relationship upserts
 */
async function processBatchUpsertRelationships(
  client: Neo4jClient,
  relationships: Relationship[],
  relType: string,
  createBidirectional: boolean
): Promise<void> {
  // Convert relationships to Neo4j format
  const rels = relationships.map(rel => ({
    id: rel.id,
    subjectId: rel.subjectId,
    objectId: rel.objectId,
    properties: pgRelationshipToNeo4jRel(rel)
  }));

  // Create forward relationships
  const query = `
    UNWIND $rels AS rel

    MATCH (subject:Entity {id: rel.subjectId})
    MATCH (object:Entity {id: rel.objectId})

    // Delete existing relationship if it exists (for update)
    OPTIONAL MATCH (subject)-[existing:${relType} {id: rel.id}]->(object)
    DELETE existing

    // Create new relationship
    CREATE (subject)-[r:${relType}]->(object)
    SET r = rel.properties
    SET r.synced_at = datetime()

    RETURN count(r) as created
  `;

  await client.executeWrite(query, { rels });

  // Create bidirectional relationships if needed
  if (createBidirectional) {
    const inverseRelType = getInverseRelType(relType);

    if (inverseRelType && inverseRelType !== relType) {
      // Create inverse relationships
      const inverseQuery = `
        UNWIND $rels AS rel

        MATCH (subject:Entity {id: rel.subjectId})
        MATCH (object:Entity {id: rel.objectId})

        // Delete existing inverse if it exists
        OPTIONAL MATCH (object)-[existing:${inverseRelType} {id: rel.id + '_inverse'}]->(subject)
        DELETE existing

        // Create inverse relationship
        CREATE (object)-[r:${inverseRelType}]->(subject)
        SET r = rel.properties
        SET r.id = rel.id + '_inverse'
        SET r.synced_at = datetime()

        RETURN count(r) as created
      `;

      await client.executeWrite(inverseQuery, { rels });
    } else if (inverseRelType === relType) {
      // Symmetric relationship - create in both directions with same properties
      const symmetricQuery = `
        UNWIND $rels AS rel

        MATCH (subject:Entity {id: rel.subjectId})
        MATCH (object:Entity {id: rel.objectId})

        // Delete existing symmetric if it exists
        OPTIONAL MATCH (object)-[existing:${relType} {id: rel.id + '_symmetric'}]->(subject)
        DELETE existing

        // Create symmetric relationship
        CREATE (object)-[r:${relType}]->(subject)
        SET r = rel.properties
        SET r.id = rel.id + '_symmetric'
        SET r.synced_at = datetime()

        RETURN count(r) as created
      `;

      await client.executeWrite(symmetricQuery, { rels });
    }
  }
}

/**
 * Batch delete relationships from Neo4j
 */
export async function batchDeleteRelationships(
  client: Neo4jClient,
  relationshipIds: string[],
  options: BatchOptions = {}
): Promise<BatchResult> {
  const startTime = Date.now();
  const batchSize = options.batchSize || 1000;

  const result: BatchResult = {
    success: true,
    processed: 0,
    failed: 0,
    errors: [],
    duration: 0
  };

  // Process in batches
  for (let i = 0; i < relationshipIds.length; i += batchSize) {
    const batch = relationshipIds.slice(i, i + batchSize);

    try {
      const query = `
        UNWIND $ids AS id
        MATCH ()-[r {id: id}]->()
        DELETE r
      `;

      await client.executeWrite(query, { ids: batch });
      result.processed += batch.length;
    } catch (error) {
      result.failed += batch.length;
      result.success = false;
      result.errors.push({
        index: i,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  result.duration = Date.now() - startTime;
  return result;
}

// ============================================================================
// Entity Merge Operations
// ============================================================================

/**
 * Handle entity merge in Neo4j
 * Merges duplicate entity into primary entity
 */
export async function handleEntityMerge(
  client: Neo4jClient,
  primaryId: string,
  duplicateId: string
): Promise<void> {
  const query = `
    MATCH (duplicate:Entity {id: $duplicateId})
    MATCH (primary:Entity {id: $primaryId})

    // Step 1: Transfer incoming relationships
    OPTIONAL MATCH (other)-[r_in]->(duplicate)
    WHERE NOT (other)-[]->( primary)
    WITH duplicate, primary, other, r_in, type(r_in) AS relType, properties(r_in) AS props
    WHERE r_in IS NOT NULL
    CALL apoc.create.relationship(other, relType, props, primary) YIELD rel AS new_in
    DELETE r_in

    // Step 2: Transfer outgoing relationships
    WITH duplicate, primary
    OPTIONAL MATCH (duplicate)-[r_out]->(other)
    WHERE NOT (primary)-[]->(other)
    WITH duplicate, primary, other, r_out, type(r_out) AS relType, properties(r_out) AS props
    WHERE r_out IS NOT NULL
    CALL apoc.create.relationship(primary, relType, props, other) YIELD rel AS new_out
    DELETE r_out

    // Step 3: Delete duplicate node
    WITH duplicate
    DETACH DELETE duplicate
  `;

  try {
    await client.executeWrite(query, { primaryId, duplicateId });
  } catch (error) {
    // Fallback without APOC
    console.warn('[BatchOps] APOC not available for merge, using manual method');
    await handleEntityMergeFallback(client, primaryId, duplicateId);
  }
}

/**
 * Fallback merge without APOC
 */
async function handleEntityMergeFallback(
  client: Neo4jClient,
  primaryId: string,
  duplicateId: string
): Promise<void> {
  // Get all relationships of duplicate
  const query1 = `
    MATCH (duplicate:Entity {id: $duplicateId})
    OPTIONAL MATCH (duplicate)-[r]-(other)
    RETURN duplicate, collect({
      type: type(r),
      direction: CASE
        WHEN startNode(r) = duplicate THEN 'out'
        ELSE 'in'
      END,
      otherId: other.id,
      properties: properties(r)
    }) AS rels
  `;

  const result = await client.executeRead(query1, { duplicateId });

  if (result.length === 0) {
    throw new Error(`Duplicate entity ${duplicateId} not found`);
  }

  const rels = result[0].rels || [];

  // Recreate relationships pointing to primary
  for (const rel of rels) {
    if (!rel.type) continue;

    if (rel.direction === 'out') {
      const createQuery = `
        MATCH (primary:Entity {id: $primaryId})
        MATCH (other:Entity {id: $otherId})
        MERGE (primary)-[r:${rel.type}]->(other)
        SET r = $properties
      `;

      await client.executeWrite(createQuery, {
        primaryId,
        otherId: rel.otherId,
        properties: rel.properties
      });
    } else {
      const createQuery = `
        MATCH (primary:Entity {id: $primaryId})
        MATCH (other:Entity {id: $otherId})
        MERGE (other)-[r:${rel.type}]->(primary)
        SET r = $properties
      `;

      await client.executeWrite(createQuery, {
        primaryId,
        otherId: rel.otherId,
        properties: rel.properties
      });
    }
  }

  // Delete duplicate
  const deleteQuery = `
    MATCH (duplicate:Entity {id: $duplicateId})
    DETACH DELETE duplicate
  `;

  await client.executeWrite(deleteQuery, { duplicateId });
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get count of entities in Neo4j by type
 */
export async function getEntityCount(
  client: Neo4jClient,
  entityType?: string
): Promise<number> {
  const query = entityType
    ? `MATCH (e:Entity {entity_type: $entityType}) RETURN count(e) as count`
    : `MATCH (e:Entity) RETURN count(e) as count`;

  const result = await client.executeRead(query, entityType ? { entityType } : {});

  return result[0]?.count || 0;
}

/**
 * Get count of relationships in Neo4j by type
 */
export async function getRelationshipCount(
  client: Neo4jClient,
  relType?: string
): Promise<number> {
  const query = relType
    ? `MATCH ()-[r:${relType}]->() RETURN count(r) as count`
    : `MATCH ()-[r]->() RETURN count(r) as count`;

  const result = await client.executeRead(query);

  return result[0]?.count || 0;
}

/**
 * Clear all data from Neo4j (USE WITH CAUTION)
 */
export async function clearAllData(client: Neo4jClient): Promise<void> {
  console.warn('[BatchOps] CLEARING ALL NEO4J DATA');

  const query = `
    MATCH (n)
    DETACH DELETE n
  `;

  await client.executeWrite(query);
}

/**
 * Batch update entity properties
 */
export async function batchUpdateEntityProperties(
  client: Neo4jClient,
  updates: Array<{ id: string; properties: Record<string, any> }>,
  options: BatchOptions = {}
): Promise<BatchResult> {
  const startTime = Date.now();
  const batchSize = options.batchSize || 500;

  const result: BatchResult = {
    success: true,
    processed: 0,
    failed: 0,
    errors: [],
    duration: 0
  };

  for (let i = 0; i < updates.length; i += batchSize) {
    const batch = updates.slice(i, i + batchSize);

    try {
      const query = `
        UNWIND $updates AS update
        MATCH (e:Entity {id: update.id})
        SET e += update.properties
        SET e.updated_at = datetime()
        SET e.synced_at = datetime()
        RETURN count(e) as updated
      `;

      await client.executeWrite(query, { updates: batch });
      result.processed += batch.length;
    } catch (error) {
      result.failed += batch.length;
      result.success = false;
      result.errors.push({
        index: i,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  result.duration = Date.now() - startTime;
  return result;
}
