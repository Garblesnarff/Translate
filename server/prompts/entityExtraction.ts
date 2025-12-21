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

1. **BE CONSERVATIVE**: Only extract what is explicitly stated or very strongly implied.
2. **NAMED ENTITIES ONLY**: Only extract specific named individuals or entities with unique identities. DO NOT create "Person" entities for generic roles or titles (e.g., "The Abbot", "the master", "the teacher", "the practitioner") unless they have a proper name.
3. **PRESERVE NAMES**: Keep Tibetan names exactly as they appear.
4. **NOTE UNCERTAINTY**: Use confidence scores to reflect ambiguity (0.0 = uncertain, 1.0 = certain).
5. **PROVIDE EVIDENCE**: Include source quotes for relationships.
6. **HANDLE PRONOUNS**: When text says "he" or "she", try to resolve to the person from context, but mark with lower confidence if uncertain.

ENTITY TYPES TO EXTRACT:

**PERSON**: Specific teachers, students, translators, patrons, scholars, practitioners, historical figures.
- MUST HAVE a proper name or be a unique historical figure.
- Extract: All name variants (Tibetan, English, phonetic).
- Attributes roles (MUST BE one or more of): 'teacher', 'student', 'translator', 'abbot', 'patron', 'scholar', 'yogi', 'poet', 'king', 'minister', 'practitioner', 'master', 'author'.
- Attributes tradition (MUST BE one of): 'Nyingma', 'Kagyu', 'Sakya', 'Gelug', 'Bon', 'Rimé', 'Kadam', 'Jonang', 'Shangpa', 'Chod'.
- Extract: Birth/death dates if mentioned.
- Attributes gender: 'male', 'female', or 'unknown'.

**PLACE**: Monasteries, mountains, caves, regions, cities, countries
- Attributes placeType (MUST BE one of): 'monastery', 'mountain', 'cave', 'city', 'region', 'country', 'holy_site', 'hermitage', 'temple', 'stupa', 'village', 'district', 'kingdom', 'retreat_center'
- Extract: All name variants
- Extract: Geographic relationships (X is in Y)
- Extract: Founding dates and founders

**TEXT**: Sutras, tantras, commentaries, biographies, letters, treatises, prayers
- Attributes textType (MUST BE one of): 'sutra', 'tantra', 'commentary', 'biography', 'poetry', 'letters', 'ritual', 'philosophical_treatise', 'history', 'medicine', 'astrology', 'prayer', 'aspiration', 'terma', 'lexicon', 'grammar', 'instruction', 'treatise'
- Extract: Author and translator if mentioned
- Extract: Composition/translation dates
- Extract: Which texts it comments on or cites

**EVENT**: Teachings, empowerments, debates, foundings, retreats, meetings, renunciation, enlightenment, miracles
- Attributes eventType (MUST BE one of): 'teaching', 'empowerment', 'debate', 'founding', 'pilgrimage', 'retreat', 'death', 'birth', 'transmission', 'political', 'natural_disaster', 'meeting', 'ordination', 'enthronement', 'renunciation', 'enlightenment', 'parinirvana', 'prophecy', 'miracle'
- Extract: Date (exact, circa, or relative)
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

Return ONLY valid JSON. Do not include any conversational text, markdown outside of the JSON block, or notes.

{
  "entities": [
    {
      "tempId": "PERSON_1",
      "type": "person",
      "canonicalName": "Marpa Lotsawa",
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
    },
    {
      "tempId": "PLACE_1",
      "type": "place",
      "canonicalName": "India",
      "names": {
        "tibetan": ["རྒྱ་གར།"],
        "english": ["India"]
      },
      "attributes": {
        "placeType": "country"
      },
      "confidence": 1.0,
      "extractionReason": "Explicitly mentioned as location"
    }
  ],
  "relationships": [
    {
      "subjectId": "PERSON_1",
      "predicate": "origin_from",
      "objectId": "PLACE_1",
      "confidence": 0.95,
      "sourceQuote": "Marpa traveled to India",
      "extractionReason": "Marpa is the subject and India is the destination of travel"
    }
  ],
  "ambiguities": []
}

IMPORTANT RULES:

1. **Use tempId** for entity references (PERSON_1, PERSON_2, PLACE_1, etc.)
2. **Match tempIds** between entities and relationships arrays
3. **Include sourceQuote**: Keep quotes under 15 words. ONLY include the most relevant part.
4. **Include extractionReason**: MAX 10 words. Be extremely concise.
5. **List ambiguities**: Only list critical uncertainties that affect graph structure.
6. **Never invent information** - if something isn't in the text, don't extract it
7. **Handle dates carefully**
8. **PlaceType is MANDATORY** for all place entities. Use 'region' or 'country' if unsure but generic.
9. **Roles must be selected** from the provided list.
10. **JSON MUST BE PARSABLE**. Check for trailing commas and balance all brackets.
11. **BE CONCISE**: Priority is on data structure, not descriptive reasoning.

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
