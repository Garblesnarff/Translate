/**
 * Entity Extraction Service
 *
 * Extracts structured entities and relationships from translated Tibetan texts
 * using LLM-based extraction with validation and database persistence.
 *
 * Phase 0.3.2 of Knowledge Graph implementation
 */

import { randomUUID } from 'crypto';
import { eq, sql } from 'drizzle-orm';
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
import { buildEntityExtractionPrompt, type ExtractionContext } from '../../prompts/entityExtraction';
import { oddPagesGeminiService, evenPagesGeminiService } from '../translation/GeminiService';
import { multiProviderAIService } from '../translation/MultiProviderAIService';
import { retryHandler } from '../translation/RetryHandler';
import { fuzzyMatcher, duplicateDetector } from '../resolution';

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
        startedAt: new Date().toISOString(),
      });

      // 3. Build extraction prompt
      const prompt = buildEntityExtractionPrompt(
        translationData.translatedText,
        translationData.sourceText || undefined,
        context
      );

      // 4. Call LLM with prompt (with retry and fallback)
      let responseText: string;
      
      try {
        // Primary: Gemma 3 27B via MultiProviderAIService (Decoupled from Gemini rate limits)
        console.log(`[EntityExtractor] Calling Gemma 3 27B for translation ${translationId}`);
        const responses = await retryHandler.executeWithRetry(
          async () => {
            // We use a custom call to MultiProviderAI to ensure we target Gemma
            return await multiProviderAIService.generateContent(prompt, 1, 'openrouter-gemma-3-27b');
          },
          { maxRetries: 2 },
          `entity-extraction-${translationId}`
        );

        if (responses.length > 0 && responses[0].translation) {
          responseText = responses[0].translation;
          console.log(`[EntityExtractor] Extraction using ${responses[0].provider} (${responses[0].model}) succeeded`);
        } else {
          throw new Error('Gemma extraction failed to return content');
        }
      } catch (error) {
        console.warn(`[EntityExtractor] Primary extraction failed for translation ${translationId}, trying fallback:`, (error as Error).message);
        
        // Fallback to Gemini if MultiProvider failed (or try other MultiProvider models)
        const geminiService = translationId % 2 === 0
          ? evenPagesGeminiService
          : oddPagesGeminiService;

        try {
          const llmResult = await geminiService.generateContent(prompt, 60000, undefined, "application/json");
          responseText = llmResult.response.text();
          console.log(`[EntityExtractor] Fallback to Gemini succeeded`);
        } catch (geminiError) {
          console.error(`[EntityExtractor] All extraction models failed for translation ${translationId}`);
          throw geminiError;
        }
      }

      // 5. Parse JSON response
      let rawExtraction: RawExtractionOutput;
      try {
        // More robust JSON extraction
        let jsonText = responseText;
        
        // 1. Try to find JSON in markdown blocks
        const jsonMatch = responseText.match(/```json\s*([\s\S]*?)\s*```/) ||
                         responseText.match(/```\s*([\s\S]*?)\s*```/);
        
        if (jsonMatch) {
          jsonText = jsonMatch[1];
        } else {
          // 2. Try to find the first { and last }
          const firstBrace = responseText.indexOf('{');
          const lastBrace = responseText.lastIndexOf('}');
          if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
            jsonText = responseText.substring(firstBrace, lastBrace + 1);
          }
        }
        
        // Clean up common LLM artifacts that break JSON.parse
        const cleanedJson = jsonText
          .trim()
          .replace(/[\u0000-\u001F\u007F-\u009F]/g, "") // Remove control characters
          .replace(/,\s*([}\]])/g, "$1"); // Remove trailing commas
          
        rawExtraction = JSON.parse(cleanedJson);
      } catch (parseError) {
        console.error('[EntityExtractor] Failed to parse LLM response:', parseError);
        console.error('[EntityExtractor] Response was:', responseText.substring(0, 1000));
        throw new Error('LLM returned invalid JSON');
      }

      // 6. Validate and transform entities
      const tempIdToRealId = new Map<string, string>();
      const validatedEntities: Entity[] = [];
      const potentialDuplicates: Array<{ sourceId: string, targetId: string, confidence: number }> = [];

      if (rawExtraction.entities && Array.isArray(rawExtraction.entities)) {
        // Prepare for resolution by fetching possible candidates from DB
        // For performance, we could limit this to entities with similar names
        // but for now we'll do a per-entity resolution
        
        for (const rawEntity of rawExtraction.entities) {
          try {
            // Filter out generic roles/titles that aren't specific named entities
            if (this.isGenericEntity(rawEntity)) {
              console.log(`[EntityExtractor] Skipping generic entity: "${rawEntity.canonicalName}"`);
              continue;
            }

            // Sanitize raw entity attributes to match enums
            const sanitizedEntity = this.sanitizeRawEntity(rawEntity);
            
            // Resolve entity against existing ones in DB
            const resolvedId = await this.resolveEntity(sanitizedEntity);
            
            if (resolvedId && typeof resolvedId === 'string') {
              // Very high confidence match found - REUSE existing ID
              tempIdToRealId.set(rawEntity.tempId, resolvedId);
              console.log(`[EntityExtractor] Resolved "${rawEntity.canonicalName}" to existing entity ${resolvedId}`);
            } else {
              // No high confidence match, or a medium confidence one was found (handled inside resolveEntity)
              // Generate real UUID for NEW entity
              const realId = randomUUID();

              // Validate entity
              const validated = validateEntity({
                ...sanitizedEntity,
                id: realId,
                createdAt: new Date(),
                updatedAt: new Date(),
                createdBy: 'ai',
                verified: false,
              });

              tempIdToRealId.set(rawEntity.tempId, realId);
              validatedEntities.push(validated as Entity);

              // If resolveEntity returned a potential duplicate (object), record it
              if (resolvedId && typeof resolvedId === 'object') {
                potentialDuplicates.push({
                  sourceId: realId,
                  targetId: resolvedId.id,
                  confidence: resolvedId.score
                });
              }
            }
          } catch (validationError) {
            console.warn(`[EntityExtractor] Entity validation failed for "${rawEntity.canonicalName}":`, validationError);
            // Continue with other entities
          }
        }
      }

      // 7. Validate and transform relationships
      const validatedRelationships: Relationship[] = [];

      if (rawExtraction.relationships && Array.isArray(rawExtraction.relationships)) {
        for (const rawRel of rawExtraction.relationships) {
          try {
            // Resolve tempIds to real IDs (might be existing or new)
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
      }

      // Add potential duplicate relationships
      for (const dup of potentialDuplicates) {
        validatedRelationships.push({
          id: randomUUID(),
          subjectId: dup.sourceId,
          predicate: 'potential_duplicate_of',
          objectId: dup.targetId,
          properties: { confidence: dup.confidence },
          confidence: dup.confidence,
          verified: false,
          sourceDocumentId: translationId.toString(),
          createdAt: new Date(),
          updatedAt: new Date(),
          createdBy: 'ai',
        });
      }

      // 8. Save results to database - handle sync/async transactions
      const saveToDb = (tx: any) => {
        // Save entities
        if (validatedEntities.length > 0) {
          for (const entity of validatedEntities) {
            tx.insert(tables.entities).values({
              id: entity.id,
              type: entity.type,
              canonicalName: entity.canonicalName,
              names: JSON.stringify(entity.names),
              attributes: JSON.stringify(entity.attributes || {}),
              dates: entity.dates ? JSON.stringify(entity.dates) : null,
              confidence: entity.confidence.toString(),
              verified: entity.verified ? 1 : 0,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              createdBy: entity.createdBy || 'ai',
              verifiedBy: null,
              verifiedAt: null,
            }).run(); // Use .run() for better-sqlite3 sync inserts if needed, or just regular Drizzle
          }
          console.log(`[EntityExtractor] Inserted ${validatedEntities.length} entities for translation ${translationId}`);
        }

        // Save relationships
        if (validatedRelationships.length > 0) {
          for (const relationship of validatedRelationships) {
            tx.insert(tables.relationships).values({
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
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              createdBy: 'ai',
              verifiedBy: null,
              verifiedAt: null,
            }).run();
          }
          console.log(`[EntityExtractor] Inserted ${validatedRelationships.length} relationships for translation ${translationId}`);
        }
      };

      // Execute transaction based on database type
      const isSqlite = !process.env.DATABASE_URL || 
                       process.env.DATABASE_URL.startsWith('sqlite:') || 
                       process.env.DATABASE_URL.endsWith('.db');

      if (isSqlite) {
        // For better-sqlite3, transaction MUST be synchronous
        db.transaction((tx: any) => {
          // Save entities
          if (validatedEntities.length > 0) {
            for (const entity of validatedEntities) {
              tx.insert(tables.entities).values({
                id: entity.id,
                type: entity.type,
                canonicalName: entity.canonicalName,
                names: JSON.stringify(entity.names),
                attributes: JSON.stringify(entity.attributes || {}),
                dates: entity.dates ? JSON.stringify(entity.dates) : null,
                confidence: entity.confidence.toString(),
                verified: entity.verified ? 1 : 0,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                createdBy: entity.createdBy || 'ai',
                verifiedBy: null,
                verifiedAt: null,
              }).run();
            }
            console.log(`[EntityExtractor] Inserted ${validatedEntities.length} entities for translation ${translationId}`);
          }

          // Save relationships
          if (validatedRelationships.length > 0) {
            for (const relationship of validatedRelationships) {
              tx.insert(tables.relationships).values({
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
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                createdBy: 'ai',
                verifiedBy: null,
                verifiedAt: null,
              }).run();
            }
            console.log(`[EntityExtractor] Inserted ${validatedRelationships.length} relationships for translation ${translationId}`);
          }
        });
      } else {
        // For PostgreSQL, transaction IS asynchronous
        await db.transaction(async (tx: any) => {
          if (validatedEntities.length > 0) {
            for (const entity of validatedEntities) {
              await tx.insert(tables.entities).values({
                id: entity.id,
                type: entity.type,
                canonicalName: entity.canonicalName,
                names: JSON.stringify(entity.names),
                attributes: JSON.stringify(entity.attributes || {}),
                dates: entity.dates ? JSON.stringify(entity.dates) : null,
                confidence: entity.confidence.toString(),
                verified: entity.verified ? 1 : 0,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                createdBy: entity.createdBy || 'ai',
              });
            }
            console.log(`[EntityExtractor] Inserted ${validatedEntities.length} entities for translation ${translationId}`);
          }
          if (validatedRelationships.length > 0) {
            for (const relationship of validatedRelationships) {
              await tx.insert(tables.relationships).values({
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
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                createdBy: 'ai',
              });
            }
            console.log(`[EntityExtractor] Inserted ${validatedRelationships.length} relationships for translation ${translationId}`);
          }
        });
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
          completedAt: new Date().toISOString(),
          entitiesExtracted: validatedEntities.length,
          relationshipsExtracted: validatedRelationships.length,
          confidenceAvg: averageConfidence.toString(),
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
          llmProvider: 'gemini-3-flash-preview',
        },
        success: true,
      };

    } catch (error) {
      const extractionTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      console.error('[EntityExtractor] Extraction failed:', error);

      // Try to update job status if job was created
      try {
        // Find existing job if jobId isn't available in this scope (should be from outer scope)
        await db
          .update(tables.extractionJobs)
          .set({
            status: 'failed',
            completedAt: new Date().toISOString(),
            errorMessage: errorMessage,
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
          llmProvider: 'gemini-3-flash-preview',
        },
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Check if an entity is a generic role or title rather than a specific individual
   */
  private isGenericEntity(rawEntity: any): boolean {
    if (rawEntity.type !== 'person' && rawEntity.type !== 'deity') return false;

    const name = (rawEntity.canonicalName || '').toLowerCase().trim();
    
    // List of generic titles/roles that should not be standalone entities 
    // unless they have a proper name attached.
    const genericBlacklist = [
      'abbot', 'master', 'teacher', 'practitioner', 'guru', 'lama', 'monk', 'nun',
      'scholar', 'translator', 'lotsawa', 'disciple', 'student', 'king', 'minister',
      'deity', 'deities', 'the abbot', 'the master', 'the teacher', 'the practitioner',
      'the guru', 'the lama', 'the monk', 'the nun', 'the scholar', 'the translator',
      'the lotsawa', 'the disciple', 'the student', 'the king', 'the minister',
      'the deity', 'deity of faith'
    ];

    if (genericBlacklist.includes(name)) return true;

    // If it's a person and only has one name which is also in roles, it's likely generic
    if (rawEntity.type === 'person' && rawEntity.attributes?.roles) {
      const roles = rawEntity.attributes.roles.map((r: string) => r.toLowerCase());
      if (roles.includes(name)) return true;
    }

    return false;
  }

  /**
   * Resolve a raw entity against existing entities in the database
   *
   * @returns Existing entity ID if very high confidence, or {id, score} for potential duplicate
   */
  private async resolveEntity(rawEntity: any): Promise<string | { id: string, score: number } | null> {
    const tables = getTables();
    
    // 1. Get possible candidates by name similarity (limit to same type)
    // For performance, we'll fetch entities that have ANY overlapping name in Tibetan or English
    const nameToSearch = rawEntity.canonicalName;
    if (!nameToSearch) return null;

    // Fetch a pool of entities of the same type with similar names
    // In a real large-scale system, we'd use a vector search or a more optimized SQL query
    const candidates = await db
      .select()
      .from(tables.entities)
      .where(sql`${tables.entities.type} = ${rawEntity.type} AND (${tables.entities.canonicalName} LIKE ${`%${nameToSearch}%`} OR ${tables.entities.names} LIKE ${`%${nameToSearch}%`})`)
      .limit(200); // Increased limit for better coverage

    if (candidates.length === 0) return null;

    // Parse candidates for comparison
    const parsedCandidates: Entity[] = candidates.map((e: any) => ({
      id: e.id,
      type: e.type,
      canonicalName: e.canonicalName,
      names: JSON.parse(e.names),
      attributes: JSON.parse(e.attributes),
      dates: e.dates ? JSON.parse(e.dates) : undefined,
      confidence: parseFloat(e.confidence),
      verified: e.verified === 1,
      createdAt: new Date(e.createdAt),
      updatedAt: new Date(e.updatedAt),
      createdBy: e.createdBy,
    })) as Entity[];

    // 2. Use DuplicateDetector to score candidates
    // We treat the raw entity as a temporary entity for comparison
    const targetEntity: Entity = {
      id: 'temp',
      type: rawEntity.type,
      canonicalName: rawEntity.canonicalName,
      names: rawEntity.names || { tibetan: [], english: [], phonetic: [], wylie: [] },
      attributes: rawEntity.attributes || {},
      dates: rawEntity.dates,
      confidence: rawEntity.confidence || 0.5,
      verified: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: 'ai',
    } as Entity;

    const matches = await duplicateDetector.findDuplicates(targetEntity, parsedCandidates, {
      threshold: 0.70,
      limit: 5
    });

    if (matches.length === 0) return null;

    const bestMatch = matches[0];

    // 3. Decision Logic
    // Thresholds matching DuplicateDetector recommendations
    if (bestMatch.score.overall >= 0.95) {
      // VERY high confidence - reuse the existing ID
      return bestMatch.entity2.id;
    } else if (bestMatch.score.overall >= 0.80) {
      // High confidence - create new but flag as potential duplicate
      return { id: bestMatch.entity2.id, score: bestMatch.score.overall };
    }

    return null;
  }

  /**
   * Sanitize raw entity data from LLM to match strict Zod schemas
   */
  private sanitizeRawEntity(raw: any): any {
    const sanitized = { ...raw };
    
    // Ensure names is always an object with required fields
    if (!sanitized.names) {
      sanitized.names = { tibetan: [], english: [], phonetic: [], wylie: [] };
    } else {
      sanitized.names.tibetan = sanitized.names.tibetan || [];
      sanitized.names.english = sanitized.names.english || [];
      sanitized.names.phonetic = sanitized.names.phonetic || [];
      sanitized.names.wylie = sanitized.names.wylie || [];
    }

    if (raw.type === 'person') {
      const attrs = { ...(raw.attributes || {}) };
      
      // Fix roles (ensure array)
      if (typeof attrs.roles === 'string') {
        attrs.roles = [attrs.roles];
      }

      if (Array.isArray(attrs.roles)) {
        const validRoles = ['teacher', 'student', 'translator', 'abbot', 'patron', 'scholar', 'yogi', 'poet', 'king', 'minister', 'practitioner', 'master', 'author', 'deity_human_form'];
        attrs.roles = attrs.roles.map((role: string) => {
          const lower = role.toLowerCase().trim();
          if (lower.includes('practitioner')) return 'practitioner';
          if (lower.includes('author') || lower.includes('writer')) return 'author';
          if (lower.includes('master') || lower.includes('guru') || lower.includes('lama')) return 'master';
          if (lower.includes('deity')) return 'deity_human_form';
          if (lower.includes('monk') || lower.includes('nun')) return 'practitioner';
          return lower;
        }).filter((r: string) => validRoles.includes(r));
        
        if (attrs.roles.length === 0) attrs.roles = ['scholar'];
      } else {
        attrs.roles = ['scholar'];
      }
      
      // Fix tradition (ensure array)
      if (typeof attrs.tradition === 'string') {
        attrs.tradition = [attrs.tradition];
      }

      if (Array.isArray(attrs.tradition)) {
        const validTraditions = ['Nyingma', 'Kagyu', 'Sakya', 'Gelug', 'Bon', 'Rimé', 'Kadam', 'Jonang', 'Shangpa', 'Chod'];
        attrs.tradition = attrs.tradition.filter((t: string) => validTraditions.includes(t));
      }

      // Ensure other potential array fields are arrays
      ['titles', 'honorifics', 'epithets', 'affiliations'].forEach(field => {
        if (attrs[field] && typeof attrs[field] === 'string') {
          attrs[field] = [attrs[field]];
        }
      });
      
      // Fix gender
      if (!attrs.gender || attrs.gender === 'null' || attrs.gender === 'undefined') {
        attrs.gender = 'unknown';
      }
      
      sanitized.attributes = attrs;
    }
    
    if (raw.type === 'place') {
      const attrs = { ...(raw.attributes || {}) };
      
      // Ensure placeType is present and valid
      const validPlaceTypes = ['monastery', 'mountain', 'cave', 'city', 'region', 'country', 'holy_site', 'hermitage', 'temple', 'stupa', 'village', 'district', 'kingdom', 'retreat_center', 'route', 'pass'];
      if (!attrs.placeType || !validPlaceTypes.includes(attrs.placeType)) {
        // Try to infer placeType from canonicalName
        const name = (raw.canonicalName || '').toLowerCase();
        if (name.includes('monastery') || name.includes(' gompa')) attrs.placeType = 'monastery';
        else if (name.includes('cave')) attrs.placeType = 'cave';
        else if (name.includes('mountain')) attrs.placeType = 'mountain';
        else if (name.includes('temple')) attrs.placeType = 'temple';
        else if (name.includes('village')) attrs.placeType = 'village';
        else attrs.placeType = 'region'; // Default to region
      }

      // Fix arrays
      if (attrs.significance && typeof attrs.significance === 'string') {
        attrs.significance = [attrs.significance];
      }
      
      sanitized.attributes = attrs;
    }

    if (raw.type === 'text') {
      const attrs = { ...(raw.attributes || {}) };
      
      // Ensure textType is valid
      const validTextTypes = ['sutra', 'tantra', 'commentary', 'biography', 'poetry', 'letters', 'ritual', 'philosophical_treatise', 'history', 'medicine', 'astrology', 'prayer', 'aspiration', 'terma', 'lexicon', 'grammar', 'instruction', 'treatise'];
      if (!attrs.textType || !validTextTypes.includes(attrs.textType)) {
        const lower = (attrs.textType || '').toLowerCase();
        if (lower.includes('prayer')) attrs.textType = 'prayer';
        else if (lower.includes('aspiration')) attrs.textType = 'aspiration';
        else if (lower.includes('treatise')) attrs.textType = 'philosophical_treatise';
        else if (lower.includes('commentary')) attrs.textType = 'commentary';
        else attrs.textType = 'philosophical_treatise';
      }
      
      // Fix arrays
      if (attrs.topics && typeof attrs.topics === 'string') {
        attrs.topics = [attrs.topics];
      }
      if (attrs.practices && typeof attrs.practices === 'string') {
        attrs.practices = [attrs.practices];
      }

      // Fix language
      if (Array.isArray(attrs.language)) {
        attrs.language = attrs.language[0] || 'Tibetan';
      } else if (!attrs.language) {
        attrs.language = 'Tibetan';
      }
      
      sanitized.attributes = attrs;
    }

    if (raw.type === 'artifact') {
      const attrs = { ...(raw.attributes || {}) };
      
      const validArtifactTypes = ['reliquary', 'statue', 'thangka', 'ritual_object', 'amulet', 'manuscript_object'];
      if (!attrs.artifactType || !validArtifactTypes.includes(attrs.artifactType)) {
        attrs.artifactType = 'ritual_object';
      }

      if (attrs.significance && typeof attrs.significance === 'string') {
        attrs.significance = [attrs.significance];
      }

      sanitized.attributes = attrs;
    }
    
    return sanitized;
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
