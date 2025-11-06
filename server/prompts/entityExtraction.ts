/**
 * Prompt Templates for Entity Extraction from Tibetan Buddhist Texts
 *
 * These prompts guide the LLM to extract structured historical knowledge
 * from translated Tibetan texts.
 */

export interface ExtractionContext {
  documentTitle?: string;
  pageNumber?: string;
  documentType?: string;
  tradition?: string; // Nyingma, Kagyu, Sakya, Gelug, etc.
}

/**
 * Main extraction prompt for all entity types
 */
export function buildEntityExtractionPrompt(
  translatedText: string,
  originalTibetan?: string,
  context?: ExtractionContext
): string {
  return `You are a specialized AI assistant for extracting structured historical knowledge from Tibetan Buddhist texts.

Your task is to carefully analyze the text and extract entities (people, places, texts, events, etc.) and the relationships between them.

${context?.documentTitle ? `DOCUMENT: ${context.documentTitle}` : ''}
${context?.pageNumber ? `PAGE: ${context.pageNumber}` : ''}
${context?.documentType ? `TYPE: ${context.documentType}` : ''}
${context?.tradition ? `TRADITION: ${context.tradition}` : ''}

TEXT TO ANALYZE:
"""
${translatedText}
"""

${originalTibetan ? `\nORIGINAL TIBETAN (for reference):\n${originalTibetan}\n` : ''}

EXTRACTION GUIDELINES:

1. **BE CONSERVATIVE**: Only extract what is explicitly stated or very strongly implied
2. **PRESERVE NAMES**: Keep Tibetan names exactly as they appear
3. **NOTE UNCERTAINTY**: Use confidence scores to reflect ambiguity (0.0 = uncertain, 1.0 = certain)
4. **PROVIDE EVIDENCE**: Include source quotes for relationships
5. **HANDLE PRONOUNS**: When text says "he" or "she", try to resolve to the person from context, but mark with lower confidence if uncertain

ENTITY TYPES TO EXTRACT:

**PERSON**: Teachers, students, translators, patrons, scholars, practitioners, historical figures
- Extract: All name variants (Tibetan, English, phonetic)
- Extract: Titles (རྗེ་བཙུན།, Rinpoche, Lotsawa, etc.)
- Extract: Roles (teacher, translator, abbot, etc.)
- Extract: Birth/death dates if mentioned
- Extract: Tradition affiliation (Kagyu, Sakya, etc.)

**PLACE**: Monasteries, mountains, caves, regions, cities, countries
- Extract: Location type (monastery, mountain, cave, region, country)
- Extract: All name variants
- Extract: Geographic relationships (X is in Y)
- Extract: Founding dates and founders

**TEXT**: Sutras, tantras, commentaries, biographies, letters, treatises
- Extract: Type (sutra, tantra, commentary, biography, etc.)
- Extract: Author and translator if mentioned
- Extract: Composition/translation dates
- Extract: Which texts it comments on or cites

**EVENT**: Teachings, empowerments, debates, foundings, retreats, meetings
- Extract: Event type (teaching, empowerment, debate, etc.)
- Extract: Date (exact, circa, or relative like "after X died")
- Extract: Location
- Extract: Participants and their roles

RELATIONSHIP TYPES TO EXTRACT:

**Teacher-Student**: "X studied under Y", "Y taught X"
**Incarnation**: "X is the reincarnation of Y"
**Authorship**: "X wrote Y", "X translated Y"
**Spatial**: "X lived at Y", "X visited Y", "X founded Y"
**Textual**: "X is a commentary on Y", "X cites Y"
**Participation**: "X attended Y", "X organized Y"

OUTPUT FORMAT:

Return ONLY valid JSON (no markdown, no extra text) in this exact structure:

{
  "entities": [
    {
      "tempId": "PERSON_1",
      "type": "person",
      "canonicalName": "Primary name in English",
      "names": {
        "tibetan": ["མར་པ།"],
        "english": ["Marpa", "Marpa Lotsawa"],
        "phonetic": ["Mar-pa"],
        "wylie": ["mar pa"]
      },
      "attributes": {
        "titles": ["Lotsawa", "Mahaguru"],
        "roles": ["translator", "teacher"],
        "tradition": ["Kagyu"],
        "gender": "male"
      },
      "dates": {
        "birth": {
          "year": 1012,
          "precision": "estimated",
          "confidence": 0.8
        }
      },
      "confidence": 0.9,
      "extractionReason": "Explicitly named as 'the great translator Marpa'"
    }
  ],
  "relationships": [
    {
      "subjectId": "PERSON_1",
      "subjectName": "Milarepa",
      "predicate": "student_of",
      "objectId": "PERSON_2",
      "objectName": "Marpa",
      "properties": {
        "date": {
          "year": 1055,
          "precision": "circa",
          "confidence": 0.7
        },
        "location": "Lhodrak",
        "duration": "12 years"
      },
      "confidence": 0.95,
      "sourceQuote": "Milarepa studied under Marpa for twelve years at Lhodrak",
      "extractionReason": "Explicit statement of student-teacher relationship with duration and location"
    }
  ],
  "ambiguities": [
    "Birth year of Marpa varies in sources (1012 or 1009)",
    "The text mentions 'the master' but it's unclear if this refers to Marpa or someone else"
  ]
}

IMPORTANT RULES:

1. **Use tempId** for entity references (PERSON_1, PERSON_2, PLACE_1, etc.)
2. **Match tempIds** between entities and relationships arrays
3. **Include sourceQuote** showing exactly where you found each relationship
4. **Include extractionReason** explaining your confidence score
5. **List ambiguities** so human curators can review uncertain extractions
6. **Never invent information** - if something isn't in the text, don't extract it
7. **Handle dates carefully**:
   - Use "exact" only for specific dates like "1073"
   - Use "circa" for approximate dates like "around 1050"
   - Use "estimated" for scholarly estimates
   - Use "disputed" when sources conflict
   - Use relative dates like {"relative": "after X died"} when only relative information is given

8. **For Tibetan dates**: If text mentions Iron-Tiger year or similar:
   {
     "tibetanYear": {
       "element": "iron",
       "animal": "tiger",
       "rabjung": 16,
       "year": 47
     },
     "year": 2010,
     "precision": "exact",
     "confidence": 0.95
   }

Now extract all entities and relationships from the provided text. Return ONLY the JSON output.`;
}

/**
 * Simplified extraction prompt for testing
 */
export function buildSimpleExtractionPrompt(text: string): string {
  return `Extract people, places, and relationships from this Tibetan Buddhist text.

TEXT:
${text}

Return JSON with structure:
{
  "entities": [{"tempId": "...", "type": "person|place", "canonicalName": "...", "names": {...}, "attributes": {...}, "confidence": 0.0-1.0}],
  "relationships": [{"subjectId": "...", "predicate": "...", "objectId": "...", "confidence": 0.0-1.0, "sourceQuote": "..."}]
}

Only extract what is explicitly stated. Include confidence scores.`;
}

/**
 * Person-focused extraction prompt (for Phase 1)
 */
export function buildPersonExtractionPrompt(text: string): string {
  return `Extract ONLY people (historical figures) from this Tibetan Buddhist text.

TEXT:
${text}

For each person, extract:
- All name variants (Tibetan, English, phonetic)
- Titles and honorifics (རྗེ་བཙུན།, Rinpoche, Lotsawa, etc.)
- Roles (teacher, translator, abbot, yogi, etc.)
- Birth/death dates if mentioned
- Tradition (Nyingma, Kagyu, Sakya, Gelug, Bon)
- Gender if determinable

Return JSON:
{
  "entities": [
    {
      "tempId": "PERSON_1",
      "type": "person",
      "canonicalName": "...",
      "names": {...},
      "attributes": {...},
      "dates": {...},
      "confidence": 0.0-1.0
    }
  ]
}`;
}

/**
 * Relationship-focused extraction prompt (for Phase 1)
 */
export function buildRelationshipExtractionPrompt(
  text: string,
  entities: Array<{ id: string; name: string; type: string }>
): string {
  const entityList = entities
    .map(e => `- ${e.id}: ${e.name} (${e.type})`)
    .join('\n');

  return `Given these known entities from a Tibetan Buddhist text, extract the relationships between them.

KNOWN ENTITIES:
${entityList}

TEXT:
${text}

Extract relationships like:
- teacher_of / student_of
- incarnation_of
- wrote / translated
- lived_at / visited / founded
- attended / organized

Return JSON:
{
  "relationships": [
    {
      "subjectId": "PERSON_1",
      "predicate": "teacher_of",
      "objectId": "PERSON_2",
      "properties": {"date": {...}, "location": "...", "teaching": "..."},
      "confidence": 0.0-1.0,
      "sourceQuote": "exact text showing this relationship"
    }
  ]
}

Only include relationships explicitly stated or strongly implied in the text.`;
}

/**
 * Validation prompt to check extraction quality
 */
export function buildValidationPrompt(
  text: string,
  extraction: any
): string {
  return `Review this entity extraction for accuracy.

ORIGINAL TEXT:
${text}

EXTRACTED DATA:
${JSON.stringify(extraction, null, 2)}

Check for:
1. Are all extracted entities actually mentioned in the text?
2. Are the relationships supported by the text?
3. Are confidence scores reasonable?
4. Are there any obvious mistakes?

Return JSON:
{
  "valid": true/false,
  "issues": ["list of problems found"],
  "suggestions": ["suggested improvements"],
  "qualityScore": 0.0-1.0
}`;
}
