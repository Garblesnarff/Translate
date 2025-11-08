/**
 * LLM-Based Relationship Extraction Service
 *
 * Handles complex relationship extraction that pattern matching cannot handle,
 * including pronoun resolution, implicit relationships, and context-dependent
 * relationship identification.
 *
 * Phase 3, Task 3.2 of Knowledge Graph implementation
 */

import { randomUUID } from 'crypto';
import type {
  Entity,
  Relationship,
  PredicateType,
  EntityType,
  PersonEntity,
  PlaceEntity,
  TextEntity,
} from '../../types/entities';
import { RelationshipSchema } from '../../validators/entities';
import { oddPagesGeminiService, evenPagesGeminiService } from '../translation/GeminiService';

// ============================================================================
// Types
// ============================================================================

/**
 * Context for relationship extraction
 */
export interface ExtractionContext {
  /** Previously mentioned entities in the document */
  knownEntities: Entity[];

  /** Previous sentences for pronoun resolution */
  previousSentences: string[];

  /** Current paragraph for broader context */
  currentParagraph?: string;

  /** Document metadata */
  metadata?: {
    documentId: string;
    pageNumber?: string;
    tradition?: string;
    documentType?: string;
  };

  /** Discourse state for tracking entity mentions */
  discourseState?: DiscourseState;
}

/**
 * Discourse state for tracking entity mentions across text
 */
export interface DiscourseState {
  /** Most recently mentioned entity of each type */
  recentMentions: {
    person?: Entity;
    place?: Entity;
    text?: Entity;
    event?: Entity;
  };

  /** Entities mentioned in current paragraph */
  currentParagraphEntities: Entity[];

  /** Role-based entity tracking (e.g., "the master", "the young lama") */
  roleBasedEntities: Map<string, Entity>;
}

/**
 * Options for relationship extraction
 */
export interface ExtractionOptions {
  /** Specific relationship types to extract */
  relationshipTypes?: PredicateType[];

  /** Minimum confidence threshold (0.0-1.0) */
  minConfidence?: number;

  /** Whether to attempt pronoun resolution */
  resolvePronounReferences?: boolean;

  /** Maximum number of sentences to use for context */
  contextWindowSize?: number;

  /** LLM temperature (0.0-1.0, lower = more deterministic) */
  temperature?: number;
}

/**
 * Resolved text with disambiguated pronouns
 */
export interface ResolvedText {
  /** Original text */
  original: string;

  /** Text with resolved pronouns */
  resolved: string;

  /** Pronoun resolutions made */
  resolutions: Array<{
    pronoun: string;
    resolvedTo: string;
    entityId: string;
    confidence: number;
  }>;
}

/**
 * LLM extraction response
 */
interface LLMExtractionResponse {
  relationships: Array<{
    subject: string; // Entity name or ID
    subjectType: EntityType;
    predicate: PredicateType;
    object: string; // Entity name or ID
    objectType: EntityType;
    confidence: number;
    sourceQuote: string;
    reasoning: string;
    properties?: any;
  }>;

  pronounResolutions?: Array<{
    pronoun: string;
    resolvedTo: string;
    confidence: number;
    reasoning: string;
  }>;

  ambiguities?: string[];
}

// ============================================================================
// Main Service Class
// ============================================================================

/**
 * LLM-Based Relationship Extractor
 *
 * Extracts complex relationships using LLM when pattern matching fails
 */
export class LLMRelationshipExtractor {
  private defaultOptions: ExtractionOptions = {
    minConfidence: 0.6,
    resolvePronounReferences: true,
    contextWindowSize: 3,
    temperature: 0.3, // Lower temperature for more consistent extraction
  };

  /**
   * Extract relationships from text using LLM
   *
   * @param text - Text to extract relationships from
   * @param context - Extraction context with known entities
   * @param options - Extraction options
   * @returns Array of extracted relationships
   */
  async extractRelationships(
    text: string,
    context: ExtractionContext,
    options?: ExtractionOptions
  ): Promise<Relationship[]> {
    const opts = { ...this.defaultOptions, ...options };

    try {
      // Step 1: Disambiguate pronouns if enabled
      let processedText = text;
      if (opts.resolvePronounReferences) {
        const resolved = await this.disambiguatePronouns(text, context);
        processedText = resolved.resolved;
      }

      // Step 2: Determine which relationship types to extract
      const relationshipTypes = opts.relationshipTypes || this.inferRelationshipTypes(text);

      // Step 3: Extract relationships for each type
      const allRelationships: Relationship[] = [];

      for (const relType of relationshipTypes) {
        const prompt = this.buildExtractionPrompt(
          processedText,
          relType,
          context
        );

        // Use odd/even Gemini service for load balancing
        const geminiService = Math.random() > 0.5
          ? oddPagesGeminiService
          : evenPagesGeminiService;

        const result = await geminiService.generateContent(prompt, 30000);
        const responseText = result.response.text();

        // Parse response
        const parsed = this.parseExtractionResponse(responseText);

        // Validate and convert to Relationship objects
        for (const rel of parsed.relationships) {
          const validated = await this.validateExtraction(rel, processedText, context);
          if (validated && validated.confidence >= (opts.minConfidence ?? this.defaultOptions.minConfidence)) {
            allRelationships.push(validated);
          }
        }
      }

      // Step 4: Deduplicate relationships
      return this.deduplicateRelationships(allRelationships);

    } catch (error) {
      console.error('[LLMRelationshipExtractor] Extraction failed:', error);
      return [];
    }
  }

  /**
   * Build extraction prompt for specific relationship type
   *
   * @param text - Text to analyze
   * @param relationshipType - Type of relationship to extract
   * @param context - Extraction context
   * @returns Prompt string
   */
  buildExtractionPrompt(
    text: string,
    relationshipType: PredicateType,
    context: ExtractionContext
  ): string {
    // Get specialized prompt based on relationship type
    const basePrompt = this.getSpecializedPrompt(relationshipType, context);

    // Add entity list from context
    const entityList = this.formatEntityList(context.knownEntities);

    // Add context sentences
    const contextSentences = context.previousSentences.length > 0
      ? `\n\nPREVIOUS CONTEXT:\n${context.previousSentences.join('\n')}\n`
      : '';

    return `${basePrompt}

${contextSentences}

KNOWN ENTITIES IN THIS DOCUMENT:
${entityList}

TEXT TO ANALYZE:
"""
${text}
"""

IMPORTANT INSTRUCTIONS:
1. Only extract relationships of type "${relationshipType}" or closely related types
2. Match entity names to the KNOWN ENTITIES list above (use exact IDs when possible)
3. Provide source quotes showing exactly where you found each relationship
4. Include confidence scores (0.0-1.0) based on how explicit the relationship is
5. Explain your reasoning for each extraction
6. List any ambiguities or uncertainties

Return ONLY valid JSON in this format:
{
  "relationships": [
    {
      "subject": "Entity ID or name",
      "subjectType": "person|place|text|event|etc",
      "predicate": "${relationshipType}",
      "object": "Entity ID or name",
      "objectType": "person|place|text|event|etc",
      "confidence": 0.9,
      "sourceQuote": "exact text showing this relationship",
      "reasoning": "why you extracted this relationship",
      "properties": {
        "date": {"year": 1050, "precision": "circa"},
        "location": "place name",
        "duration": "3 years"
      }
    }
  ],
  "ambiguities": [
    "List any uncertainties or alternative interpretations"
  ]
}`;
  }

  /**
   * Get specialized prompt for specific relationship type
   *
   * @param relationshipType - Type of relationship
   * @param context - Extraction context
   * @returns Specialized prompt text
   */
  private getSpecializedPrompt(
    relationshipType: PredicateType,
    context: ExtractionContext
  ): string {
    switch (relationshipType) {
      case 'teacher_of':
      case 'student_of':
        return this.getTeacherStudentPrompt();

      case 'wrote':
      case 'translated':
      case 'compiled':
        return this.getAuthorshipPrompt();

      case 'lived_at':
      case 'visited':
      case 'founded':
      case 'born_in':
      case 'died_in':
        return this.getPlaceAssociationPrompt();

      case 'commentary_on':
      case 'cites':
      case 'part_of':
      case 'contains':
        return this.getTextRelationshipPrompt();

      case 'preceded':
      case 'followed':
      case 'contemporary_with':
        return this.getTemporalRelationshipPrompt();

      default:
        return this.getGeneralRelationshipPrompt(relationshipType);
    }
  }

  /**
   * Prompt for teacher-student relationships
   */
  private getTeacherStudentPrompt(): string {
    return `You are extracting TEACHER-STUDENT relationships from Tibetan Buddhist texts.

Look for patterns indicating:
- "X studied under Y"
- "Y taught X"
- "X received teachings from Y"
- "Y transmitted the lineage to X"
- "X was a student of Y"
- "the master" or "his teacher" (resolve pronoun to specific person)

Extract details like:
- Teaching received (Dharma, empowerment, meditation instructions, etc.)
- Duration of study ("12 years", "from 1050 to 1062")
- Location where study took place
- Specific texts or practices taught

Be careful with:
- Distinguish between direct teachers and lineage ancestors
- "He heard teachings" might mean attended a public teaching (not private student)
- Context matters: "X and Y studied together" means both are students of someone else`;
  }

  /**
   * Prompt for authorship relationships
   */
  private getAuthorshipPrompt(): string {
    return `You are extracting AUTHORSHIP and TRANSLATION relationships from Tibetan Buddhist texts.

Look for patterns indicating:
- "X wrote Y" → (subject: Person, predicate: wrote, object: Text)
- "X translated Y from Sanskrit" → (subject: Person, predicate: translated, object: Text)
- "X compiled the collection Y" → (subject: Person, predicate: compiled, object: Text)
- "the commentary by X" → implicit authorship
- "X's treatise on..." → implicit authorship

Extract details like:
- Year or date of composition/translation
- Original language (Sanskrit, Chinese, Pali, etc.)
- Location where text was written
- Circumstances of composition (e.g., "at the request of the king")
- Collaborators (if multiple authors/translators)

Be careful with:
- Distinguish authorship from transmission (teaching ≠ writing)
- "X studied Y's text" does NOT mean X wrote the text
- Verify entity types: subject must be Person, object must be Text`;
  }

  /**
   * Prompt for place association relationships
   */
  private getPlaceAssociationPrompt(): string {
    return `You are extracting PLACE ASSOCIATION relationships from Tibetan Buddhist texts.

Look for patterns indicating:
- "X lived at Y" → long-term residence
- "X visited Y" → temporary visit
- "X founded Y" → establishment of monastery/institution
- "X was born in Y" → birth location
- "X died at Y" → death location
- "the monastery where he lived" → resolve "he" and "the monastery"

Extract details like:
- Duration of residence ("lived there for 20 years")
- Date of visit or founding
- Purpose ("went there to meditate", "established a retreat center")
- Significant events at that location

Be careful with:
- Distinguish residence (lived_at) from visits (visited)
- "X went to Y" might be temporary visit, not residence
- Founding requires explicit statement of establishment
- Verify entity types: subject is Person, object is Place`;
  }

  /**
   * Prompt for text relationship extraction
   */
  private getTextRelationshipPrompt(): string {
    return `You are extracting TEXTUAL RELATIONSHIPS from Tibetan Buddhist texts.

Look for patterns indicating:
- "X is a commentary on Y" → (subject: Text, predicate: commentary_on, object: Text)
- "X cites Y" → reference to another text
- "X is part of the collection Y" → part-whole relationship
- "the commentary" → resolve to specific text from context

Extract details like:
- Type of relationship (commentary, summary, expansion, refutation)
- Sections or chapters referenced
- Purpose of citation

Be careful with:
- Both subject and object must be Texts (not Persons)
- "X wrote a commentary on Y" involves TWO relationships:
  1. (Person X, wrote, Text "commentary")
  2. (Text "commentary", commentary_on, Text Y)
- Distinguish direct commentary from casual mention`;
  }

  /**
   * Prompt for temporal relationships
   */
  private getTemporalRelationshipPrompt(): string {
    return `You are extracting TEMPORAL RELATIONSHIPS from Tibetan Buddhist texts.

Look for patterns indicating:
- "X preceded Y" → X came before Y in time
- "X followed Y" → X came after Y
- "X was contemporary with Y" → lived at the same time
- "after X died" → temporal ordering
- "during the time of X" → contemporaneity

Extract details like:
- Approximate time difference ("30 years after")
- Era or period references
- Known dates from other sources

Be careful with:
- Don't confuse lineage succession with temporal precedence
- "X succeeded Y as abbot" is institutional, but they might overlap in time
- Contemporaneity requires evidence they lived at overlapping times`;
  }

  /**
   * General relationship prompt for other types
   */
  private getGeneralRelationshipPrompt(relationshipType: PredicateType): string {
    return `You are extracting relationships of type "${relationshipType}" from Tibetan Buddhist texts.

Analyze the text carefully to identify this specific relationship type.

Consider:
- What entities are involved?
- What is the nature of their connection?
- What evidence supports this relationship?
- What additional properties or context are mentioned?

Extract all relevant details and provide source quotes.`;
  }

  /**
   * Parse LLM extraction response
   *
   * @param responseText - Raw LLM response
   * @returns Parsed extraction data
   */
  parseExtractionResponse(responseText: string): LLMExtractionResponse {
    try {
      // Extract JSON from markdown code blocks if present
      const jsonMatch = responseText.match(/```json\s*([\s\S]*?)\s*```/) ||
                       responseText.match(/```\s*([\s\S]*?)\s*```/);
      const jsonText = jsonMatch ? jsonMatch[1] : responseText;

      const parsed = JSON.parse(jsonText.trim());

      return {
        relationships: parsed.relationships || [],
        pronounResolutions: parsed.pronounResolutions || [],
        ambiguities: parsed.ambiguities || [],
      };
    } catch (error) {
      console.error('[LLMRelationshipExtractor] Failed to parse response:', error);
      console.error('Response was:', responseText.substring(0, 500));
      return {
        relationships: [],
        ambiguities: ['Failed to parse LLM response'],
      };
    }
  }

  /**
   * Validate extracted relationship
   *
   * @param relationship - Raw relationship from LLM
   * @param text - Source text
   * @param context - Extraction context
   * @returns Validated Relationship object or null if invalid
   */
  async validateExtraction(
    relationship: any,
    text: string,
    context: ExtractionContext
  ): Promise<Relationship | null> {
    try {
      // Step 1: Validate entity types match predicate requirements
      if (!this.validateEntityTypes(relationship.predicate, relationship.subjectType, relationship.objectType)) {
        console.warn('[LLMRelationshipExtractor] Invalid entity types for predicate:', relationship);
        return null;
      }

      // Step 2: Verify source quote actually mentions both entities
      if (relationship.sourceQuote && !text.includes(relationship.sourceQuote)) {
        console.warn('[LLMRelationshipExtractor] Source quote not found in text:', relationship);
        // Don't reject, but lower confidence
        relationship.confidence *= 0.8;
      }

      // Step 3: Resolve entity names to IDs
      const subjectId = this.resolveEntityId(relationship.subject, context.knownEntities);
      const objectId = this.resolveEntityId(relationship.object, context.knownEntities);

      if (!subjectId || !objectId) {
        console.warn('[LLMRelationshipExtractor] Could not resolve entity IDs:', relationship);
        return null;
      }

      // Step 4: Build validated Relationship object
      const validated: Relationship = {
        id: randomUUID(),
        subjectId,
        predicate: relationship.predicate,
        objectId,
        properties: relationship.properties || {},
        confidence: relationship.confidence,
        verified: false,
        sourceDocumentId: context.metadata?.documentId,
        sourcePage: context.metadata?.pageNumber,
        sourceQuote: relationship.sourceQuote,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: 'ai-llm',
      };

      // Step 5: Validate with schema
      return RelationshipSchema.parse(validated) as Relationship;

    } catch (error) {
      console.warn('[LLMRelationshipExtractor] Validation failed:', error);
      return null;
    }
  }

  /**
   * Validate that entity types are appropriate for the predicate
   *
   * @param predicate - Relationship predicate
   * @param subjectType - Subject entity type
   * @param objectType - Object entity type
   * @returns True if valid combination
   */
  private validateEntityTypes(
    predicate: PredicateType,
    subjectType: EntityType,
    objectType: EntityType
  ): boolean {
    const rules: Record<PredicateType, { subject: EntityType[], object: EntityType[] }> = {
      // Teacher-student relationships
      teacher_of: { subject: ['person'], object: ['person'] },
      student_of: { subject: ['person'], object: ['person'] },

      // Incarnation
      incarnation_of: { subject: ['person'], object: ['person'] },

      // Authorship
      wrote: { subject: ['person'], object: ['text'] },
      translated: { subject: ['person'], object: ['text'] },
      compiled: { subject: ['person'], object: ['text'] },

      // Place associations
      lived_at: { subject: ['person'], object: ['place', 'institution'] },
      visited: { subject: ['person'], object: ['place', 'institution'] },
      founded: { subject: ['person'], object: ['place', 'institution'] },
      born_in: { subject: ['person'], object: ['place'] },
      died_in: { subject: ['person'], object: ['place'] },

      // Event participation
      attended: { subject: ['person'], object: ['event'] },
      organized: { subject: ['person', 'institution'], object: ['event'] },
      sponsored: { subject: ['person', 'institution'], object: ['event', 'text', 'institution'] },

      // Institutional
      member_of: { subject: ['person'], object: ['institution', 'lineage'] },
      abbot_of: { subject: ['person'], object: ['institution'] },
      patron_of: { subject: ['person'], object: ['institution', 'person'] },

      // Textual relationships
      commentary_on: { subject: ['text'], object: ['text'] },
      cites: { subject: ['text'], object: ['text'] },
      part_of: { subject: ['text'], object: ['text'] },
      contains: { subject: ['text'], object: ['text'] },
      mentions: { subject: ['text'], object: ['person', 'place', 'event', 'concept'] },

      // Transmission
      received_transmission: { subject: ['person'], object: ['person', 'text'] },
      gave_empowerment: { subject: ['person'], object: ['person'] },
      transmitted_to: { subject: ['person'], object: ['person'] },

      // Debate
      debated_with: { subject: ['person'], object: ['person'] },
      refuted: { subject: ['person'], object: ['person', 'concept'] },
      agreed_with: { subject: ['person'], object: ['person', 'concept'] },

      // Family
      parent_of: { subject: ['person'], object: ['person'] },
      child_of: { subject: ['person'], object: ['person'] },
      sibling_of: { subject: ['person'], object: ['person'] },
      spouse_of: { subject: ['person'], object: ['person'] },

      // Geographic
      within: { subject: ['place'], object: ['place'] },
      near: { subject: ['place'], object: ['place'] },

      // Conceptual
      practiced: { subject: ['person'], object: ['concept'] },
      held_view: { subject: ['person'], object: ['concept'] },
      taught_concept: { subject: ['person'], object: ['concept'] },

      // Temporal
      preceded: { subject: ['person', 'event'], object: ['person', 'event'] },
      followed: { subject: ['person', 'event'], object: ['person', 'event'] },
      contemporary_with: { subject: ['person'], object: ['person'] },
    };

    const rule = rules[predicate];
    if (!rule) {
      console.warn('[LLMRelationshipExtractor] Unknown predicate:', predicate);
      return false;
    }

    return rule.subject.includes(subjectType) && rule.object.includes(objectType);
  }

  /**
   * Disambiguate pronouns in text
   *
   * @param text - Text with pronouns
   * @param context - Extraction context with entity information
   * @returns Resolved text with disambiguated pronouns
   */
  async disambiguatePronouns(
    text: string,
    context: ExtractionContext
  ): Promise<ResolvedText> {
    try {
      const prompt = this.buildPronounResolutionPrompt(text, context);

      // Use Gemini for pronoun resolution
      const geminiService = oddPagesGeminiService;
      const result = await geminiService.generateContent(prompt, 20000);
      const responseText = result.response.text();

      const parsed = this.parseExtractionResponse(responseText);

      // Apply resolutions to text
      let resolvedText = text;
      const resolutions: ResolvedText['resolutions'] = [];

      if (parsed.pronounResolutions) {
        for (const resolution of parsed.pronounResolutions) {
          // Find entity ID
          const entityId = this.resolveEntityId(resolution.resolvedTo, context.knownEntities);
          if (entityId) {
            // Replace pronoun with resolved name (in parentheses for clarity)
            resolvedText = resolvedText.replace(
              new RegExp(`\\b${resolution.pronoun}\\b`, 'gi'),
              `${resolution.pronoun} [${resolution.resolvedTo}]`
            );

            resolutions.push({
              pronoun: resolution.pronoun,
              resolvedTo: resolution.resolvedTo,
              entityId,
              confidence: resolution.confidence,
            });
          }
        }
      }

      return {
        original: text,
        resolved: resolvedText,
        resolutions,
      };

    } catch (error) {
      console.error('[LLMRelationshipExtractor] Pronoun resolution failed:', error);
      return {
        original: text,
        resolved: text,
        resolutions: [],
      };
    }
  }

  /**
   * Build pronoun resolution prompt
   */
  private buildPronounResolutionPrompt(
    text: string,
    context: ExtractionContext
  ): string {
    const entityList = this.formatEntityList(context.knownEntities);
    const previousContext = context.previousSentences.join('\n');

    return `You are resolving pronoun references in Tibetan Buddhist texts.

KNOWN ENTITIES:
${entityList}

PREVIOUS CONTEXT:
${previousContext}

TEXT WITH PRONOUNS:
"""
${text}
"""

Identify and resolve pronouns like:
- "he", "she", "him", "her" → most recent Person entity matching gender
- "the master", "the teacher" → Person with role='teacher'
- "the young lama" → Person with appropriate attributes
- "the monastery" → most recent Place with type='monastery'
- "this text", "the commentary" → most recent Text entity

DISAMBIGUATION RULES:
1. Prefer most recently mentioned entity of matching type
2. Use role information to narrow candidates (e.g., "the master" → Person with role='teacher')
3. Use gender information if available
4. If multiple candidates, choose the most contextually relevant
5. Assign confidence based on how clear the resolution is

Return JSON:
{
  "pronounResolutions": [
    {
      "pronoun": "he",
      "resolvedTo": "Marpa Lotsawa",
      "confidence": 0.9,
      "reasoning": "Most recently mentioned male person with role=teacher"
    }
  ]
}`;
  }

  /**
   * Resolve entity name to ID
   */
  private resolveEntityId(nameOrId: string, knownEntities: Entity[]): string | null {
    // Check if it's already a UUID
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(nameOrId)) {
      return nameOrId;
    }

    // Search for entity by name
    for (const entity of knownEntities) {
      // Check canonical name
      if (entity.canonicalName.toLowerCase() === nameOrId.toLowerCase()) {
        return entity.id;
      }

      // Check all name variants
      for (const variants of Object.values(entity.names)) {
        if (Array.isArray(variants)) {
          for (const variant of variants) {
            if (variant.toLowerCase() === nameOrId.toLowerCase()) {
              return entity.id;
            }
          }
        }
      }
    }

    return null;
  }

  /**
   * Format entity list for prompts
   */
  private formatEntityList(entities: Entity[]): string {
    return entities
      .map(e => {
        const type = e.type;
        const names = [
          e.canonicalName,
          ...(e.names.tibetan || []),
          ...(e.names.english || []).filter(n => n !== e.canonicalName)
        ].filter(Boolean).join(', ');

        let attributes = '';
        if (e.type === 'person' && (e as PersonEntity).attributes?.roles) {
          attributes = ` (roles: ${(e as PersonEntity).attributes.roles?.join(', ')})`;
        } else if (e.type === 'place' && (e as PlaceEntity).attributes?.placeType) {
          attributes = ` (type: ${(e as PlaceEntity).attributes.placeType})`;
        } else if (e.type === 'text' && (e as TextEntity).attributes?.textType) {
          attributes = ` (type: ${(e as TextEntity).attributes.textType})`;
        }

        return `- ${e.id}: ${names} [${type}]${attributes}`;
      })
      .join('\n');
  }

  /**
   * Infer likely relationship types from text content
   */
  private inferRelationshipTypes(text: string): PredicateType[] {
    const types: PredicateType[] = [];

    // Simple keyword matching to infer relationship types
    if (/studied|student|taught|teacher|master|guru|disciple/i.test(text)) {
      types.push('student_of', 'teacher_of');
    }

    if (/wrote|author|composed|translated|compiler/i.test(text)) {
      types.push('wrote', 'translated');
    }

    if (/lived|resided|monastery|cave|hermitage|born|died/i.test(text)) {
      types.push('lived_at', 'born_in', 'died_in');
    }

    if (/commentary|cites|quotes|mentions|refers to/i.test(text)) {
      types.push('commentary_on', 'cites');
    }

    if (/before|after|contemporary|preceded|followed/i.test(text)) {
      types.push('preceded', 'followed', 'contemporary_with');
    }

    // Default to common relationship types if none inferred
    if (types.length === 0) {
      types.push('student_of', 'wrote', 'lived_at');
    }

    return types;
  }

  /**
   * Deduplicate relationships
   */
  private deduplicateRelationships(relationships: Relationship[]): Relationship[] {
    const seen = new Map<string, Relationship>();

    for (const rel of relationships) {
      const key = `${rel.subjectId}-${rel.predicate}-${rel.objectId}`;
      const existing = seen.get(key);

      if (!existing || rel.confidence > existing.confidence) {
        seen.set(key, rel);
      }
    }

    return Array.from(seen.values());
  }
}

// ============================================================================
// Export singleton instance
// ============================================================================

export const llmRelationshipExtractor = new LLMRelationshipExtractor();
