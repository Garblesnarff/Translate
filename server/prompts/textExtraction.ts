/**
 * Prompt Template for Text Entity Extraction from Tibetan Buddhist Texts
 *
 * Phase 1, Task 1.1.2: Extract literary works (sutras, tantras, commentaries, etc.)
 * and their authorship/translation relationships.
 *
 * Based on: roadmaps/knowledge-graph/PHASE_1_ENTITY_EXTRACTION.md lines 75-113
 */

export interface TextExtractionContext {
  documentTitle?: string;
  pageNumber?: string;
  tradition?: string; // Nyingma, Kagyu, Sakya, Gelug, etc.
  language?: string; // Primary language of the text being analyzed
}

/**
 * Main text extraction prompt for literary works
 */
export function buildTextExtractionPrompt(
  translatedText: string,
  originalTibetan?: string,
  context?: TextExtractionContext
): string {
  return `You are a specialized AI assistant for extracting TEXTS (literary works) from Tibetan Buddhist literature.

Your task is to identify all texts mentioned in the passage and extract detailed metadata about them.

${context?.documentTitle ? `DOCUMENT: ${context.documentTitle}` : ''}
${context?.pageNumber ? `PAGE: ${context.pageNumber}` : ''}
${context?.tradition ? `TRADITION: ${context.tradition}` : ''}
${context?.language ? `LANGUAGE: ${context.language}` : ''}

TEXT TO ANALYZE:
"""
${translatedText}
"""

${originalTibetan ? `\nORIGINAL TIBETAN (for reference):\n${originalTibetan}\n` : ''}

EXTRACTION GUIDELINES:

1. **BE CONSERVATIVE**: Only extract texts explicitly mentioned or clearly referenced
2. **PRESERVE TITLES**: Keep Tibetan and Sanskrit titles exactly as they appear
3. **HANDLE ABBREVIATIONS**: Note both full and abbreviated titles
4. **DISTINGUISH AUTHORS**: Separate original authors from translators
5. **NOTE RELATIONSHIPS**: Track commentary relationships and citations
6. **USE CONFIDENCE**: Mark uncertain extractions with lower confidence scores

TEXT TYPES TO IDENTIFY:

**SUTRA** (མདོ། mdo):
- Discourses attributed to Buddha or bodhisattvas
- Examples: Prajnaparamita Sutra, Lotus Sutra, Heart Sutra
- Usually translated from Sanskrit or Pali

**TANTRA** (རྒྱུད། rgyud):
- Esoteric Buddhist texts with ritual and meditation instructions
- Examples: Hevajra Tantra, Chakrasamvara Tantra, Guhyasamaja Tantra
- Often include deity visualization and mantra practices

**COMMENTARY** (འགྲེལ་པ། 'grel pa):
- Explanations and interpretations of root texts
- Identify which text is being commented upon
- Note the commentator as author

**BIOGRAPHY** (རྣམ་ཐར། rnam thar):
- Life stories of masters and practitioners
- Often called "liberation stories" or "hagiographies"
- Include autobiographies

**POETRY** (སྙན་ངག snyan ngag):
- Songs of realization (doha, mgur)
- Poetic compositions expressing spiritual insights
- May be authored by specific masters

**LETTERS** (ཡི་གེ། yi ge):
- Epistles between teachers and students
- Dharma advice letters
- Historical correspondence

**RITUAL** (ཆོ་ག། cho ga):
- Sadhanas (སྒྲུབ་ཐབས། sgrub thabs)
- Liturgies and ceremonial texts
- Empowerment rituals

**PHILOSOPHICAL TREATISE** (བསྟན་བཅོས། bstan bcos):
- Systematic presentations of Buddhist philosophy
- Logical and epistemological works
- Examples: Madhyamaka, Pramana texts

**HISTORY** (ལོ་རྒྱུས། lo rgyus):
- Historical chronicles
- Examples: Blue Annals, Red Annals
- Religious histories of Tibet

INFORMATION TO EXTRACT:

For each text, extract:

1. **TITLES**:
   - Full title in Tibetan (if mentioned)
   - Full title in English
   - Abbreviated title or common short name
   - Sanskrit title (if translated from Sanskrit)
   - Chinese title (if relevant)

2. **AUTHORS**:
   - Original author (who composed it)
   - Multiple authors if collaborative work
   - Note if authorship is attributed vs. uncertain

3. **TRANSLATORS**:
   - Who translated from Sanskrit/Chinese to Tibetan
   - Translation team if multiple translators
   - Note as "Lotsawa" (ལོ་ཙཱ་བ།) if mentioned

4. **DATES**:
   - Composition date (when originally written)
   - Translation date (when brought to Tibetan)
   - Publication/printing date if mentioned
   - Rediscovery date (for terma texts)

5. **TYPE/GENRE**:
   - Primary classification: sutra, tantra, commentary, etc.
   - Sub-genre if applicable (e.g., "mother tantra", "prajnaparamita sutra")

6. **COLLECTION MEMBERSHIP**:
   - Part of Kangyur (བཀའ་འགྱུར།) or Tengyur (བསྟན་འགྱུར།)?
   - Specific section (e.g., "Prajnaparamita section of Kangyur")
   - Part of a collected works (གསུང་འབུམ། gsung 'bum)?
   - Which master's collected works?

7. **TEXTUAL RELATIONSHIPS**:
   - Root texts that this text comments on
   - Texts cited or referenced
   - Related texts in same series or tradition

8. **METADATA**:
   - Language of composition (Sanskrit, Tibetan, Chinese, etc.)
   - Volume count (if multi-volume)
   - Page count (if mentioned)
   - Topics covered
   - Practices described

OUTPUT FORMAT:

Return ONLY valid JSON (no markdown, no extra text) in this exact structure:

{
  "texts": [
    {
      "tempId": "TEXT_1",
      "type": "text",
      "canonicalName": "Prajnaparamita Sutra in Eight Thousand Lines",
      "names": {
        "tibetan": ["ཤེར་ཕྱིན་བརྒྱད་སྟོང་པ།"],
        "english": ["Perfection of Wisdom Sutra in Eight Thousand Lines", "Astasahasrika Prajnaparamita"],
        "phonetic": ["Sher-chin Gyé-tong-pa"],
        "wylie": ["sher phyin brgyad stong pa"],
        "sanskrit": ["Aṣṭasāhasrikā Prajñāpāramitā"]
      },
      "attributes": {
        "textType": "sutra",
        "language": "Sanskrit",
        "volumeCount": 1,
        "topics": ["emptiness", "perfection of wisdom", "bodhisattva path"],
        "practices": ["meditation on emptiness", "six perfections"],
        "tibetanCanonSection": "Prajnaparamita section of Kangyur",
        "abbreviated": "Gyé-tong"
      },
      "dates": {
        "composed": {
          "year": 100,
          "precision": "circa",
          "confidence": 0.7,
          "source": "scholarly consensus"
        },
        "translated": {
          "year": 750,
          "precision": "estimated",
          "confidence": 0.6
        }
      },
      "confidence": 0.95,
      "extractionReason": "Explicitly mentioned as 'the Eight Thousand Line Prajnaparamita'"
    }
  ],
  "relationships": [
    {
      "subjectId": "PERSON_1",
      "subjectName": "Haribhadra",
      "predicate": "wrote",
      "objectId": "TEXT_2",
      "objectName": "Clear Meaning Commentary",
      "properties": {
        "date": {
          "year": 800,
          "precision": "circa",
          "confidence": 0.7
        }
      },
      "confidence": 0.9,
      "sourceQuote": "Haribhadra composed the Clear Meaning Commentary on the Eight Thousand Line Prajnaparamita",
      "extractionReason": "Explicit attribution of authorship"
    },
    {
      "subjectId": "TEXT_2",
      "subjectName": "Clear Meaning Commentary",
      "predicate": "commentary_on",
      "objectId": "TEXT_1",
      "objectName": "Prajnaparamita Sutra in Eight Thousand Lines",
      "properties": {},
      "confidence": 0.95,
      "sourceQuote": "Clear Meaning Commentary on the Eight Thousand Line Prajnaparamita",
      "extractionReason": "Explicit statement of commentary relationship"
    },
    {
      "subjectId": "PERSON_2",
      "subjectName": "Jinamitra",
      "predicate": "translated",
      "objectId": "TEXT_1",
      "objectName": "Prajnaparamita Sutra",
      "properties": {
        "fromLanguage": "Sanskrit",
        "toLanguage": "Tibetan",
        "date": {
          "year": 750,
          "precision": "estimated",
          "confidence": 0.6
        },
        "collaborators": ["Surendrabodhi", "Yeshe De"]
      },
      "confidence": 0.85,
      "sourceQuote": "translated by the Lotsawa Jinamitra together with Surendrabodhi and Yeshe De",
      "extractionReason": "Explicit mention of translation team"
    },
    {
      "subjectId": "TEXT_3",
      "subjectName": "Ornament of Clear Realization",
      "predicate": "cites",
      "objectId": "TEXT_1",
      "objectName": "Prajnaparamita Sutra",
      "properties": {
        "citationType": "primary source"
      },
      "confidence": 0.8,
      "sourceQuote": "As taught in the Prajnaparamita...",
      "extractionReason": "Text reference indicates citation relationship"
    },
    {
      "subjectId": "TEXT_1",
      "subjectName": "Prajnaparamita Sutra",
      "predicate": "part_of",
      "objectId": "COLLECTION_1",
      "objectName": "Kangyur",
      "properties": {
        "section": "Prajnaparamita"
      },
      "confidence": 0.95,
      "sourceQuote": "found in the Prajnaparamita section of the Kangyur",
      "extractionReason": "Explicit statement of collection membership"
    }
  ],
  "ambiguities": [
    "Translation date uncertain - sources vary between 750-800 CE",
    "Volume count not clearly stated in this passage",
    "Unclear if this refers to the 8000-line or 25000-line version"
  ]
}

IMPORTANT RULES FOR TEXT EXTRACTION:

1. **Use tempId** for text references (TEXT_1, TEXT_2, PERSON_1 for authors/translators, etc.)
2. **Distinguish authorship from translation**:
   - "wrote" = original composition
   - "translated" = brought from another language
   - "compiled" = gathered and organized existing materials
3. **Track commentary relationships**:
   - Always note which text is being commented upon
   - Use "commentary_on" predicate
4. **Handle collections properly**:
   - Kangyur = Buddha's words (translated sutras and tantras)
   - Tengyur = Commentaries and treatises
   - Collected works (gsung 'bum) = Complete works of a specific master
5. **Note text citations**:
   - When one text quotes or references another
   - Use "cites" predicate
6. **Be precise about dates**:
   - Composition date = when originally written
   - Translation date = when translated to Tibetan
   - Don't confuse the two
7. **Extract all name variants**:
   - Tibetan titles in Tibetan script
   - English translations
   - Sanskrit originals if mentioned
   - Common abbreviations
8. **Include confidence scores**:
   - High (0.9-1.0): Explicit, unambiguous mention
   - Medium (0.7-0.9): Strong implication or partial information
   - Low (0.5-0.7): Uncertain or inferred information
9. **Document ambiguities**:
   - List anything uncertain or contradictory
   - Note missing information that would be helpful
   - Flag items needing human review

SPECIAL CASES:

**Terma texts** (གཏེར་མ། gter ma):
- Hidden treasure texts "rediscovered" by tertöns
- Note both original author (e.g., Padmasambhava) and treasure revealer
- Include both composition date and rediscovery date

**Collected works** (གསུང་འབུམ། gsung 'bum):
- These are collections, not single texts
- Each text within should be extracted separately
- Link each text to the collection with "part_of" relationship

**Root texts vs. commentaries**:
- Root texts (རྩ་བ། rtsa ba): Original foundational texts
- Auto-commentaries: Commentary by the same author
- Subcommentaries: Commentaries on commentaries

**Anonymous texts**:
- Many texts have uncertain or disputed authorship
- Mark with lower confidence
- Note in extractionReason: "authorship uncertain/disputed"

Now extract all texts and their relationships from the provided passage. Return ONLY the JSON output.`;
}

/**
 * Simplified text extraction prompt for quick testing
 */
export function buildSimpleTextExtractionPrompt(text: string): string {
  return `Extract all TEXTS (sutras, tantras, commentaries, biographies, etc.) mentioned in this passage.

TEXT:
${text}

For each text, extract:
- Title (Tibetan and English)
- Type (sutra, tantra, commentary, biography, poetry, letters, ritual, philosophical_treatise, history)
- Author (if mentioned)
- Translator (if mentioned)

Return JSON:
{
  "texts": [
    {
      "tempId": "TEXT_1",
      "type": "text",
      "canonicalName": "...",
      "names": {"tibetan": [...], "english": [...], "wylie": [...]},
      "attributes": {"textType": "...", "language": "..."},
      "confidence": 0.0-1.0
    }
  ],
  "relationships": [
    {
      "subjectId": "PERSON_1",
      "predicate": "wrote|translated|commentary_on|cites",
      "objectId": "TEXT_1",
      "confidence": 0.0-1.0,
      "sourceQuote": "..."
    }
  ]
}

Only extract what is explicitly stated.`;
}

/**
 * Extract authorship relationships for known texts
 */
export function buildAuthorshipExtractionPrompt(
  text: string,
  knownTexts: Array<{ id: string; title: string }>
): string {
  const textList = knownTexts
    .map(t => `- ${t.id}: ${t.title}`)
    .join('\n');

  return `Given these known texts, extract authorship and translation relationships.

KNOWN TEXTS:
${textList}

TEXT TO ANALYZE:
${text}

Extract relationships:
- "wrote": original authorship
- "translated": translation from Sanskrit/Chinese/etc to Tibetan
- "compiled": gathered and organized existing materials
- "commentary_on": text is a commentary on another text
- "cites": text quotes or references another text

Return JSON:
{
  "relationships": [
    {
      "subjectId": "PERSON_1 or TEXT_1",
      "predicate": "wrote|translated|compiled|commentary_on|cites",
      "objectId": "TEXT_1",
      "properties": {
        "fromLanguage": "...",
        "toLanguage": "...",
        "collaborators": [...],
        "date": {...}
      },
      "confidence": 0.0-1.0,
      "sourceQuote": "exact quote from text"
    }
  ]
}`;
}

/**
 * Extract text collection membership (Kangyur, Tengyur, Collected Works)
 */
export function buildCollectionExtractionPrompt(
  text: string,
  knownTexts: Array<{ id: string; title: string }>
): string {
  const textList = knownTexts
    .map(t => `- ${t.id}: ${t.title}`)
    .join('\n');

  return `Extract collection membership for these texts.

KNOWN TEXTS:
${textList}

TEXT TO ANALYZE:
${text}

Identify if texts are part of:
- Kangyur (བཀའ་འགྱུར།): Buddha's words
- Tengyur (བསྟན་འགྱུར།): Commentaries and treatises
- Collected Works (གསུང་འབུམ།): Complete works of a specific master
- Other collections

Return JSON:
{
  "relationships": [
    {
      "subjectId": "TEXT_1",
      "predicate": "part_of",
      "objectId": "COLLECTION_1",
      "properties": {
        "section": "Prajnaparamita",
        "volume": "...",
        "catalogNumber": "..."
      },
      "confidence": 0.0-1.0,
      "sourceQuote": "exact quote"
    }
  ],
  "collections": [
    {
      "tempId": "COLLECTION_1",
      "name": "Kangyur",
      "type": "canonical_collection",
      "description": "..."
    }
  ]
}`;
}

/**
 * Validation prompt specifically for text extraction
 */
export function buildTextValidationPrompt(
  originalText: string,
  extraction: any
): string {
  return `Review this text extraction for accuracy and completeness.

ORIGINAL TEXT:
${originalText}

EXTRACTED TEXTS:
${JSON.stringify(extraction, null, 2)}

Check for:
1. Are all mentioned texts extracted?
2. Are text types correctly identified (sutra vs tantra vs commentary)?
3. Are authorship and translation relationships accurate?
4. Are commentary relationships properly tracked?
5. Are collection memberships noted?
6. Are confidence scores reasonable?
7. Are there any texts that should have been extracted but weren't?

Return JSON:
{
  "valid": true/false,
  "textsFound": number,
  "textsMissed": ["list of texts mentioned but not extracted"],
  "incorrectClassifications": ["list of misclassified texts"],
  "missingRelationships": ["authorship/translation info not captured"],
  "issues": ["other problems found"],
  "suggestions": ["improvements"],
  "qualityScore": 0.0-1.0
}`;
}
