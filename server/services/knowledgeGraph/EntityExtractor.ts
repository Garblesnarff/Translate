/**
 * Entity Extraction Service
 *
 * Extracts structured entities and relationships from translated Tibetan texts
 * using LLM-based extraction with validation and database persistence.
 *
 * Phase 0.3.2 of Knowledge Graph implementation
 */

import { randomUUID } from 'crypto';
import { eq } from 'drizzle-orm';
import { db } from '@db/index';
import { getTables } from '@db/config';
import type {
  Entity,
  Relationship,
  EntityType,
  PredicateType
} from '../../types/entities';
import {
  validateEntity,
  RelationshipSchema
} from '../../validators/entities';
import {
  buildEntityExtractionPrompt,
  type ExtractionContext
} from '../../prompts/entityExtraction';
import { oddPagesGeminiService, evenPagesGeminiService } from '../translation/GeminiService';

/**
 * Result of entity extraction from a single document
 */
export interface ExtractionResult {
  /** Extraction job ID */
  jobId: string;

  /** Source translation ID */
  translationId: number;

  /** Entities extracted */
  entities: Entity[];

  /** Relationships extracted */
  relationships: Relationship[];

  /** Ambiguities flagged for human review */
  ambiguities: string[];

  /** Extraction statistics */
  statistics: {
    entityCount: number;
    relationshipCount: number;
    averageConfidence: number;
    extractionTime: number;
    llmProvider: string;
  };

  /** Whether extraction succeeded */
  success: boolean;

  /** Error message if failed */
  error?: string;
}

/**
 * Raw extraction output from LLM (before validation)
 */
interface RawExtractionOutput {
  entities: Array<{
    tempId: string;
    type: EntityType;
    canonicalName: string;
    names: {
      tibetan?: string[];
      english?: string[];
      wylie?: string[];
      sanskrit?: string[];
      chinese?: string[];
      mongolian?: string[];
      phonetic?: string[];
    };
    attributes?: any;
    dates?: any;
    confidence: number;
    extractionReason: string;
  }>;
  relationships: Array<{
    subjectId: string; // tempId
    predicate: PredicateType;
    objectId: string; // tempId
    properties?: any;
    confidence: number;
    sourceQuote: string;
  }>;
  ambiguities?: string[];
}

/**
 * Entity Extraction Service
 *
 * Orchestrates the extraction of entities and relationships from translated texts.
 */
export class EntityExtractor {
  /**
   * Extract entities and relationships from a translation
   *
   * @param translationId - ID of the translation to extract from
   * @param context - Optional extraction context (previous entities, focus areas)
   * @returns Extraction result with entities, relationships, and statistics
   */
  async extractFromTranslation(
    translationId: number,
    context?: ExtractionContext
  ): Promise<ExtractionResult> {
    const startTime = Date.now();
    const tables = getTables();

    try {
      // 1. Get translation from database
      const translation = await db
        .select()
        .from(tables.translations)
        .where(eq(tables.translations.id, translationId))
        .limit(1);

      if (!translation || translation.length === 0) {
        throw new Error(`Translation ${translationId} not found`);
      }

      const translationData = translation[0];

      if (!translationData.translatedText) {
        throw new Error(`Translation ${translationId} has no translated text`);
      }

      // 2. Create extraction job record
      const jobId = randomUUID();
      await db.insert(tables.extractionJobs).values({
        id: jobId,
        translationId: translationId,
        status: 'processing',
        startedAt: new Date(),
        createdBy: 'ai',
      });

      // 3. Build extraction prompt
      const prompt = buildEntityExtractionPrompt(
        translationData.translatedText,
        translationData.sourceText || undefined,
        context
      );

      // 4. Call LLM with prompt
      // Use odd/even service based on translation ID for load balancing
      const geminiService = translationId % 2 === 0
        ? evenPagesGeminiService
        : oddPagesGeminiService;

      console.log(`[EntityExtractor] Extracting entities from translation ${translationId} using ${geminiService.getPageType()} service`);

      const llmResult = await geminiService.generateContent(prompt, 60000); // 60 second timeout
      const llmResponse = llmResult.response;
      const responseText = llmResponse.text();

      // 5. Parse JSON response
      let rawExtraction: RawExtractionOutput;
      try {
        // Extract JSON from markdown code blocks if present
        const jsonMatch = responseText.match(/```json\s*([\s\S]*?)\s*```/) ||
                         responseText.match(/```\s*([\s\S]*?)\s*```/);
        const jsonText = jsonMatch ? jsonMatch[1] : responseText;
        rawExtraction = JSON.parse(jsonText.trim());
      } catch (parseError) {
        console.error('[EntityExtractor] Failed to parse LLM response:', parseError);
        console.error('[EntityExtractor] Response was:', responseText.substring(0, 500));
        throw new Error('LLM returned invalid JSON');
      }

      // 6. Validate and transform entities
      const tempIdToRealId = new Map<string, string>();
      const validatedEntities: Entity[] = [];

      for (const rawEntity of rawExtraction.entities) {
        try {
          // Generate real UUID
          const realId = randomUUID();
          tempIdToRealId.set(rawEntity.tempId, realId);

          // Validate entity
          const validated = validateEntity({
            ...rawEntity,
            id: realId,
            createdAt: new Date(),
            updatedAt: new Date(),
            createdBy: 'ai',
            verified: false,
          });

          validatedEntities.push(validated as Entity);
        } catch (validationError) {
          console.warn('[EntityExtractor] Entity validation failed:', validationError);
          // Continue with other entities
        }
      }

      // 7. Validate and transform relationships
      const validatedRelationships: Relationship[] = [];

      for (const rawRel of rawExtraction.relationships) {
        try {
          // Resolve tempIds to real IDs
          const subjectId = tempIdToRealId.get(rawRel.subjectId);
          const objectId = tempIdToRealId.get(rawRel.objectId);

          if (!subjectId || !objectId) {
            console.warn('[EntityExtractor] Relationship references unknown entity:', rawRel);
            continue;
          }

          // Validate relationship
          const validated = RelationshipSchema.parse({
            id: randomUUID(),
            subjectId,
            predicate: rawRel.predicate,
            objectId,
            properties: rawRel.properties || {},
            confidence: rawRel.confidence,
            verified: false,
            sourceDocumentId: translationId.toString(),
            sourcePage: '1', // TODO: Track page numbers
            sourceQuote: rawRel.sourceQuote,
            createdAt: new Date(),
            updatedAt: new Date(),
            createdBy: 'ai',
          }) as Relationship;

          validatedRelationships.push(validated);
        } catch (validationError) {
          console.warn('[EntityExtractor] Relationship validation failed:', validationError);
          // Continue with other relationships
        }
      }

      // 8. Save entities to database
      if (validatedEntities.length > 0) {
        for (const entity of validatedEntities) {
          await db.insert(tables.entities).values({
            id: entity.id,
            type: entity.type,
            canonicalName: entity.canonicalName,
            names: JSON.stringify(entity.names),
            attributes: JSON.stringify(entity.attributes || {}),
            dates: entity.dates ? JSON.stringify(entity.dates) : null,
            confidence: entity.confidence.toString(),
            verified: entity.verified ? 1 : 0,
            createdAt: new Date(),
            updatedAt: new Date(),
            createdBy: entity.createdBy || 'ai',
            verifiedBy: null,
            verifiedAt: null,
          });
        }
      }

      // 9. Save relationships to database
      if (validatedRelationships.length > 0) {
        for (const relationship of validatedRelationships) {
          await db.insert(tables.relationships).values({
            id: relationship.id,
            subjectId: relationship.subjectId,
            predicate: relationship.predicate,
            objectId: relationship.objectId,
            properties: JSON.stringify(relationship.properties || {}),
            confidence: relationship.confidence.toString(),
            verified: relationship.verified ? 1 : 0,
            sourceDocumentId: relationship.sourceDocumentId ? parseInt(relationship.sourceDocumentId) : null,
            sourcePage: relationship.sourcePage || null,
            sourceQuote: relationship.sourceQuote || null,
            createdAt: new Date(),
            updatedAt: new Date(),
            createdBy: 'ai',
            verifiedBy: null,
            verifiedAt: null,
          });
        }
      }

      // 10. Calculate statistics
      const extractionTime = Date.now() - startTime;
      const averageConfidence = validatedEntities.length > 0
        ? validatedEntities.reduce((sum, e) => sum + e.confidence, 0) / validatedEntities.length
        : 0;

      // 11. Update extraction job with results
      await db
        .update(tables.extractionJobs)
        .set({
          status: 'completed',
          completedAt: new Date(),
          entityCount: validatedEntities.length,
          relationshipCount: validatedRelationships.length,
          averageConfidence: averageConfidence.toString(),
          processingTime: extractionTime,
          ambiguities: JSON.stringify(rawExtraction.ambiguities || []),
        })
        .where(eq(tables.extractionJobs.id, jobId));

      // 12. Return extraction result
      return {
        jobId,
        translationId,
        entities: validatedEntities,
        relationships: validatedRelationships,
        ambiguities: rawExtraction.ambiguities || [],
        statistics: {
          entityCount: validatedEntities.length,
          relationshipCount: validatedRelationships.length,
          averageConfidence,
          extractionTime,
          llmProvider: 'gemini-2.0-flash-exp',
        },
        success: true,
      };

    } catch (error) {
      const extractionTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      console.error('[EntityExtractor] Extraction failed:', error);

      // Try to update job status if job was created
      try {
        const jobId = randomUUID();
        await db
          .update(tables.extractionJobs)
          .set({
            status: 'failed',
            completedAt: new Date(),
            processingTime: extractionTime,
            error: errorMessage,
          })
          .where(eq(tables.extractionJobs.translationId, translationId));
      } catch (updateError) {
        console.error('[EntityExtractor] Failed to update job status:', updateError);
      }

      return {
        jobId: randomUUID(),
        translationId,
        entities: [],
        relationships: [],
        ambiguities: [],
        statistics: {
          entityCount: 0,
          relationshipCount: 0,
          averageConfidence: 0,
          extractionTime,
          llmProvider: 'gemini-2.0-flash-exp',
        },
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Get extraction job status
   *
   * @param jobId - Extraction job ID
   * @returns Job status and statistics
   */
  async getExtractionJob(jobId: string) {
    const tables = getTables();
    const job = await db
      .select()
      .from(tables.extractionJobs)
      .where(eq(tables.extractionJobs.id, jobId))
      .limit(1);

    if (!job || job.length === 0) {
      return null;
    }

    return job[0];
  }

  /**
   * Get all entities extracted from a translation
   *
   * @param translationId - Translation ID
   * @returns Array of entities
   */
  async getEntitiesForTranslation(translationId: number): Promise<Entity[]> {
    const tables = getTables();

    // Get extraction job for this translation
    const jobs = await db
      .select()
      .from(tables.extractionJobs)
      .where(eq(tables.extractionJobs.translationId, translationId));

    if (!jobs || jobs.length === 0) {
      return [];
    }

    // Get all entities from this translation's extraction
    // Note: We need a way to link entities back to extraction jobs
    // For now, we'll just return all entities (TODO: add extraction_job_id to entities table)
    const entities = await db
      .select()
      .from(tables.entities);

    return entities.map((e: any) => ({
      id: e.id,
      type: e.type as EntityType,
      canonicalName: e.canonicalName,
      names: JSON.parse(e.names),
      attributes: JSON.parse(e.attributes),
      dates: e.dates ? JSON.parse(e.dates) : undefined,
      confidence: parseFloat(e.confidence),
      verified: e.verified === 1,
      createdAt: e.createdAt,
      updatedAt: e.updatedAt,
      createdBy: e.createdBy,
      verifiedBy: e.verifiedBy || undefined,
      verifiedAt: e.verifiedAt || undefined,
    })) as Entity[];
  }
}

// Export singleton instance
export const entityExtractor = new EntityExtractor();
