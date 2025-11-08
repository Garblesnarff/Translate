/**
 * Consistency Checker for PostgreSQL ↔ Neo4j Synchronization
 *
 * Validates data consistency between PostgreSQL and Neo4j databases.
 * Detects missing entities, relationships, property mismatches, and orphaned data.
 *
 * Phase 4, Task 4.3: Sync Service
 */

import { eq, sql, inArray } from 'drizzle-orm';
import type { Neo4jClient } from '../../lib/neo4jClient';
import type { Entity, Relationship } from '../../../db/schema';
import { getEntityCount, getRelationshipCount } from './batchOperations';

// ============================================================================
// Types
// ============================================================================

export interface ConsistencyReport {
  timestamp: Date;
  consistent: boolean;
  totalEntities: {
    postgres: number;
    neo4j: number;
    difference: number;
  };
  totalRelationships: {
    postgres: number;
    neo4j: number;
    difference: number;
  };
  missingInNeo4j: {
    entities: string[];
    relationships: string[];
  };
  missingInPostgres: {
    entities: string[];
    relationships: string[];
  };
  propertyMismatches: Array<{
    id: string;
    entityType: 'entity' | 'relationship';
    field: string;
    pgValue: any;
    neo4jValue: any;
  }>;
  orphanedRelationships: Array<{
    id: string;
    reason: string; // 'missing_subject' | 'missing_object'
    missingEntityId: string;
  }>;
  summary: string;
  duration: number;
}

export interface ConsistencyCheckOptions {
  checkProperties?: boolean; // Check property values match
  checkOrphans?: boolean; // Check for orphaned relationships
  sampleSize?: number; // Number of entities to spot-check properties (0 = all)
  maxMissingToReport?: number; // Max missing items to include in report
}

// ============================================================================
// Consistency Checker Class
// ============================================================================

export class ConsistencyChecker {
  private neo4jClient: Neo4jClient;
  private db: any;
  private tables: any;

  constructor(neo4jClient: Neo4jClient, db: any, tables: any) {
    this.neo4jClient = neo4jClient;
    this.db = db;
    this.tables = tables;
  }

  /**
   * Run comprehensive consistency check
   */
  async checkConsistency(options: ConsistencyCheckOptions = {}): Promise<ConsistencyReport> {
    const startTime = Date.now();
    console.log('[ConsistencyCheck] Starting consistency check...');

    const report: ConsistencyReport = {
      timestamp: new Date(),
      consistent: true,
      totalEntities: { postgres: 0, neo4j: 0, difference: 0 },
      totalRelationships: { postgres: 0, neo4j: 0, difference: 0 },
      missingInNeo4j: { entities: [], relationships: [] },
      missingInPostgres: { entities: [], relationships: [] },
      propertyMismatches: [],
      orphanedRelationships: [],
      summary: '',
      duration: 0
    };

    try {
      // 1. Check entity counts
      await this.checkEntityCounts(report);

      // 2. Check relationship counts
      await this.checkRelationshipCounts(report);

      // 3. Check for missing entities
      await this.checkMissingEntities(report, options.maxMissingToReport || 100);

      // 4. Check for missing relationships
      await this.checkMissingRelationships(report, options.maxMissingToReport || 100);

      // 5. Check property values (if enabled)
      if (options.checkProperties) {
        await this.checkPropertyValues(report, options.sampleSize || 100);
      }

      // 6. Check for orphaned relationships (if enabled)
      if (options.checkOrphans) {
        await this.checkOrphanedRelationships(report);
      }

      // 7. Generate summary
      report.consistent = this.isConsistent(report);
      report.summary = this.generateSummary(report);
      report.duration = Date.now() - startTime;

      console.log(`[ConsistencyCheck] Check completed in ${report.duration}ms`);
      console.log(`[ConsistencyCheck] Result: ${report.consistent ? 'CONSISTENT' : 'INCONSISTENT'}`);

      return report;
    } catch (error) {
      console.error('[ConsistencyCheck] Error during consistency check:', error);
      throw error;
    }
  }

  // ==========================================================================
  // Check Methods
  // ==========================================================================

  /**
   * Check entity counts between databases
   */
  private async checkEntityCounts(report: ConsistencyReport): Promise<void> {
    // Count in PostgreSQL (only active entities)
    const pgResult = await this.db
      .select({ count: sql`count(*)` })
      .from(this.tables.entities)
      .where(eq(this.tables.entities.mergeStatus, 'active'))
      .execute();

    report.totalEntities.postgres = Number(pgResult[0]?.count || 0);

    // Count in Neo4j
    report.totalEntities.neo4j = await getEntityCount(this.neo4jClient);

    // Calculate difference
    report.totalEntities.difference = report.totalEntities.postgres - report.totalEntities.neo4j;

    console.log(`[ConsistencyCheck] Entity counts: PG=${report.totalEntities.postgres}, Neo4j=${report.totalEntities.neo4j}`);
  }

  /**
   * Check relationship counts between databases
   */
  private async checkRelationshipCounts(report: ConsistencyReport): Promise<void> {
    // Count in PostgreSQL
    const pgResult = await this.db
      .select({ count: sql`count(*)` })
      .from(this.tables.relationships)
      .execute();

    report.totalRelationships.postgres = Number(pgResult[0]?.count || 0);

    // Count in Neo4j
    report.totalRelationships.neo4j = await getRelationshipCount(this.neo4jClient);

    // Calculate difference
    report.totalRelationships.difference = report.totalRelationships.postgres - report.totalRelationships.neo4j;

    console.log(`[ConsistencyCheck] Relationship counts: PG=${report.totalRelationships.postgres}, Neo4j=${report.totalRelationships.neo4j}`);
  }

  /**
   * Check for entities missing in Neo4j
   */
  private async checkMissingEntities(report: ConsistencyReport, maxToReport: number): Promise<void> {
    // Get all entity IDs from PostgreSQL
    const pgEntities = await this.db
      .select({ id: this.tables.entities.id })
      .from(this.tables.entities)
      .where(eq(this.tables.entities.mergeStatus, 'active'))
      .execute();

    const pgIds = new Set(pgEntities.map((e: any) => e.id));

    // Get all entity IDs from Neo4j
    const neo4jResult = await this.neo4jClient.executeRead(
      'MATCH (e:Entity) RETURN e.id as id'
    );

    const neo4jIds = new Set(neo4jResult.map((r: any) => r.id));

    // Find missing in Neo4j
    const missingInNeo4j: string[] = [];

    for (const id of pgIds) {
      if (!neo4jIds.has(id)) {
        missingInNeo4j.push(id);

        if (missingInNeo4j.length >= maxToReport) {
          break;
        }
      }
    }

    report.missingInNeo4j.entities = missingInNeo4j;

    // Find missing in PostgreSQL
    const missingInPg: string[] = [];

    for (const id of neo4jIds) {
      if (!pgIds.has(id)) {
        missingInPg.push(id);

        if (missingInPg.length >= maxToReport) {
          break;
        }
      }
    }

    report.missingInPostgres.entities = missingInPg;

    console.log(`[ConsistencyCheck] Missing entities: Neo4j=${missingInNeo4j.length}, PostgreSQL=${missingInPg.length}`);
  }

  /**
   * Check for relationships missing in Neo4j
   */
  private async checkMissingRelationships(report: ConsistencyReport, maxToReport: number): Promise<void> {
    // Get all relationship IDs from PostgreSQL
    const pgRels = await this.db
      .select({ id: this.tables.relationships.id })
      .from(this.tables.relationships)
      .execute();

    const pgIds = new Set(pgRels.map((r: any) => r.id));

    // Get all relationship IDs from Neo4j
    const neo4jResult = await this.neo4jClient.executeRead(
      'MATCH ()-[r]->() RETURN r.id as id'
    );

    const neo4jIds = new Set(neo4jResult.map((r: any) => r.id).filter(Boolean));

    // Find missing in Neo4j
    const missingInNeo4j: string[] = [];

    for (const id of pgIds) {
      if (!neo4jIds.has(id)) {
        missingInNeo4j.push(id);

        if (missingInNeo4j.length >= maxToReport) {
          break;
        }
      }
    }

    report.missingInNeo4j.relationships = missingInNeo4j;

    // Find missing in PostgreSQL
    const missingInPg: string[] = [];

    for (const id of neo4jIds) {
      if (!pgIds.has(id)) {
        missingInPg.push(id);

        if (missingInPg.length >= maxToReport) {
          break;
        }
      }
    }

    report.missingInPostgres.relationships = missingInPg;

    console.log(`[ConsistencyCheck] Missing relationships: Neo4j=${missingInNeo4j.length}, PostgreSQL=${missingInPg.length}`);
  }

  /**
   * Check property values for sample of entities
   */
  private async checkPropertyValues(report: ConsistencyReport, sampleSize: number): Promise<void> {
    // Get sample of entities from PostgreSQL
    const pgEntities = await this.db
      .select()
      .from(this.tables.entities)
      .where(eq(this.tables.entities.mergeStatus, 'active'))
      .limit(sampleSize)
      .execute();

    for (const pgEntity of pgEntities) {
      // Get corresponding entity from Neo4j
      const neo4jResult = await this.neo4jClient.executeRead(
        'MATCH (e:Entity {id: $id}) RETURN e',
        { id: pgEntity.id }
      );

      if (neo4jResult.length === 0) {
        continue; // Already reported as missing
      }

      const neo4jEntity = neo4jResult[0].e;

      // Compare key properties
      const mismatches = this.compareEntityProperties(pgEntity, neo4jEntity);

      report.propertyMismatches.push(...mismatches);
    }

    console.log(`[ConsistencyCheck] Property mismatches found: ${report.propertyMismatches.length}`);
  }

  /**
   * Check for orphaned relationships (pointing to non-existent entities)
   */
  private async checkOrphanedRelationships(report: ConsistencyReport): Promise<void> {
    // Find relationships in Neo4j where subject or object doesn't exist
    const orphanedQuery = `
      MATCH ()-[r]->()
      WHERE r.id IS NOT NULL
      WITH r, startNode(r) AS subject, endNode(r) AS object
      WHERE NOT EXISTS {
        MATCH (check:Entity {id: subject.id})
      } OR NOT EXISTS {
        MATCH (check:Entity {id: object.id})
      }
      RETURN r.id AS id,
             subject.id AS subjectId,
             object.id AS objectId,
             CASE
               WHEN NOT EXISTS { MATCH (check:Entity {id: subject.id}) } THEN 'missing_subject'
               ELSE 'missing_object'
             END AS reason,
             CASE
               WHEN NOT EXISTS { MATCH (check:Entity {id: subject.id}) } THEN subject.id
               ELSE object.id
             END AS missingEntityId
      LIMIT 100
    `;

    try {
      const result = await this.neo4jClient.executeRead(orphanedQuery);

      report.orphanedRelationships = result.map((r: any) => ({
        id: r.id,
        reason: r.reason,
        missingEntityId: r.missingEntityId
      }));

      console.log(`[ConsistencyCheck] Orphaned relationships found: ${report.orphanedRelationships.length}`);
    } catch (error) {
      console.warn('[ConsistencyCheck] Could not check for orphaned relationships:', error);
    }
  }

  // ==========================================================================
  // Helper Methods
  // ==========================================================================

  /**
   * Compare properties between PostgreSQL and Neo4j entities
   */
  private compareEntityProperties(pgEntity: any, neo4jEntity: any): Array<{
    id: string;
    entityType: 'entity';
    field: string;
    pgValue: any;
    neo4jValue: any;
  }> {
    const mismatches: Array<{
      id: string;
      entityType: 'entity';
      field: string;
      pgValue: any;
      neo4jValue: any;
    }> = [];

    // Compare canonical_name
    if (pgEntity.canonicalName !== neo4jEntity.properties?.canonical_name) {
      mismatches.push({
        id: pgEntity.id,
        entityType: 'entity',
        field: 'canonical_name',
        pgValue: pgEntity.canonicalName,
        neo4jValue: neo4jEntity.properties?.canonical_name
      });
    }

    // Compare confidence (convert to float for comparison)
    const pgConfidence = parseFloat(pgEntity.confidence);
    const neo4jConfidence = neo4jEntity.properties?.confidence;

    if (Math.abs(pgConfidence - neo4jConfidence) > 0.01) {
      mismatches.push({
        id: pgEntity.id,
        entityType: 'entity',
        field: 'confidence',
        pgValue: pgConfidence,
        neo4jValue: neo4jConfidence
      });
    }

    // Compare verified status
    const pgVerified = pgEntity.verified === 1 || pgEntity.verified === true;
    const neo4jVerified = neo4jEntity.properties?.verified;

    if (pgVerified !== neo4jVerified) {
      mismatches.push({
        id: pgEntity.id,
        entityType: 'entity',
        field: 'verified',
        pgValue: pgVerified,
        neo4jValue: neo4jVerified
      });
    }

    return mismatches;
  }

  /**
   * Determine if databases are consistent
   */
  private isConsistent(report: ConsistencyReport): boolean {
    return (
      report.totalEntities.difference === 0 &&
      report.totalRelationships.difference === 0 &&
      report.missingInNeo4j.entities.length === 0 &&
      report.missingInNeo4j.relationships.length === 0 &&
      report.missingInPostgres.entities.length === 0 &&
      report.missingInPostgres.relationships.length === 0 &&
      report.propertyMismatches.length === 0 &&
      report.orphanedRelationships.length === 0
    );
  }

  /**
   * Generate human-readable summary
   */
  private generateSummary(report: ConsistencyReport): string {
    const lines: string[] = [];

    lines.push('=== Consistency Check Summary ===');
    lines.push('');

    // Entity counts
    lines.push(`Entities:`);
    lines.push(`  PostgreSQL: ${report.totalEntities.postgres}`);
    lines.push(`  Neo4j: ${report.totalEntities.neo4j}`);

    if (report.totalEntities.difference !== 0) {
      lines.push(`  ⚠ Difference: ${report.totalEntities.difference}`);
    } else {
      lines.push(`  ✓ Counts match`);
    }

    lines.push('');

    // Relationship counts
    lines.push(`Relationships:`);
    lines.push(`  PostgreSQL: ${report.totalRelationships.postgres}`);
    lines.push(`  Neo4j: ${report.totalRelationships.neo4j}`);

    if (report.totalRelationships.difference !== 0) {
      lines.push(`  ⚠ Difference: ${report.totalRelationships.difference}`);
    } else {
      lines.push(`  ✓ Counts match`);
    }

    lines.push('');

    // Missing items
    if (report.missingInNeo4j.entities.length > 0) {
      lines.push(`⚠ ${report.missingInNeo4j.entities.length} entities missing in Neo4j`);
    }

    if (report.missingInNeo4j.relationships.length > 0) {
      lines.push(`⚠ ${report.missingInNeo4j.relationships.length} relationships missing in Neo4j`);
    }

    if (report.missingInPostgres.entities.length > 0) {
      lines.push(`⚠ ${report.missingInPostgres.entities.length} entities missing in PostgreSQL`);
    }

    if (report.missingInPostgres.relationships.length > 0) {
      lines.push(`⚠ ${report.missingInPostgres.relationships.length} relationships missing in PostgreSQL`);
    }

    // Property mismatches
    if (report.propertyMismatches.length > 0) {
      lines.push(`⚠ ${report.propertyMismatches.length} property mismatches detected`);
    }

    // Orphaned relationships
    if (report.orphanedRelationships.length > 0) {
      lines.push(`⚠ ${report.orphanedRelationships.length} orphaned relationships found`);
    }

    lines.push('');

    // Final verdict
    if (report.consistent) {
      lines.push('✓ Databases are CONSISTENT');
    } else {
      lines.push('⚠ Databases are INCONSISTENT - sync recommended');
    }

    lines.push('');
    lines.push(`Duration: ${report.duration}ms`);

    return lines.join('\n');
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create ConsistencyChecker instance
 */
export function createConsistencyChecker(
  neo4jClient: Neo4jClient,
  db: any,
  tables: any
): ConsistencyChecker {
  return new ConsistencyChecker(neo4jClient, db, tables);
}
