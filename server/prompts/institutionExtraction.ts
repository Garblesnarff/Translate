/**
 * Institution Extraction Prompt
 *
 * Specialized prompt for extracting Buddhist institutions (monasteries, colleges,
 * hermitages, temples, etc.) from Tibetan texts.
 *
 * Based on: roadmaps/knowledge-graph/PHASE_1_ENTITY_EXTRACTION.md (Task 1.1.5)
 */

export interface InstitutionExtractionContext {
  documentTitle?: string;
  pageNumber?: string;
  tradition?: string;
  region?: string;
}

/**
 * Builds a comprehensive institution extraction prompt
 */
export function buildInstitutionExtractionPrompt(
  text: string,
  originalTibetan?: string,
  context?: InstitutionExtractionContext
): string {
  return `You are a specialized AI assistant for extracting INSTITUTIONS (religious organizations and establishments) from Tibetan Buddhist texts.

Your task is to identify and extract detailed information about monasteries, colleges, temples, and other Buddhist institutions mentioned in the text.

${context?.documentTitle ? `DOCUMENT: ${context.documentTitle}` : ''}
${context?.pageNumber ? `PAGE: ${context.pageNumber}` : ''}
${context?.tradition ? `TRADITION: ${context.tradition}` : ''}
${context?.region ? `REGION: ${context.region}` : ''}

TEXT TO ANALYZE:
"""
${text}
"""

${originalTibetan ? `\nORIGINAL TIBETAN (for reference):\n${originalTibetan}\n` : ''}

═══════════════════════════════════════════════════════════════════════════
INSTITUTION TYPES
═══════════════════════════════════════════════════════════════════════════

Extract institutions of these types:

1. **monastery** (དགོན་པ།, dgon pa)
   - Main monastic institutions
   - Can contain multiple colleges
   - Examples: Narthang Monastery, Sakya Monastery

2. **college** (བཤད་གྲྭ།, bshad grwa)
   - Monastic colleges within larger monasteries
   - Educational subdivisions
   - Examples: Tsennyi College, Shartse College

3. **hermitage** (རི་ཁྲོད།, ri khrod)
   - Retreat centers
   - Mountain hermitages
   - Isolated meditation centers
   - Examples: Milarepa's hermitage at Lapchi

4. **temple** (ལྷ་ཁང།, lha khang)
   - Temple buildings
   - Shrine halls
   - Examples: Jokhang Temple

5. **printing_house** (པར་ཁང།, par khang)
   - Text production centers
   - Scriptoriums
   - Block printing facilities
   - Examples: Derge Printing House

6. **library** (དཔེ་མཛོད།, dpe mdzod)
   - Text repositories
   - Archives
   - Manuscript collections

7. **government** (གཞུང།, gzhung)
   - Religious governance bodies
   - Theocratic administrations
   - Ecclesiastical offices
   - Examples: Ganden Phodrang

═══════════════════════════════════════════════════════════════════════════
WHAT TO EXTRACT
═══════════════════════════════════════════════════════════════════════════

For each institution, extract:

**1. NAME VARIANTS**
   - Tibetan script: དགོན་པ་ཆེན་པོ།
   - Wylie transliteration: dgon pa chen po
   - Phonetic: Gönpa Chenpo
   - English: Great Monastery
   - Sanskrit name (if applicable)
   - Chinese name (if applicable)
   - Common abbreviations or shortened names

**2. INSTITUTION TYPE**
   - One of: monastery, college, hermitage, temple, printing_house, library, government, school

**3. LOCATION**
   - Geographic location (region, valley, mountain, etc.)
   - Parent location (which larger place it's within)
   - Modern country/region if known
   - Coordinates or geographic descriptions

**4. FOUNDING INFORMATION**
   - Founding date (exact year, circa, Tibetan calendar, or relative date)
   - Founder(s) - person or people who established it
   - Circumstances of founding
   - Original purpose or mission

**5. TRADITION/SCHOOL AFFILIATION**
   - Which Buddhist school(s): Nyingma, Kagyu, Sakya, Gelug, Bon, Kadam, Jonang
   - Sub-lineages within traditions
   - Changes in affiliation over time
   - Multi-tradition institutions

**6. HIERARCHICAL RELATIONSHIPS**
   - Parent institution (if this is a subsidiary)
     Example: Tsennyi College is part of Narthang Monastery
   - Subsidiary institutions (colleges within monastery, branch monasteries)
   - Sister institutions (related but independent)
   - Network affiliations

**7. NOTABLE ABBOTS/LEADERS**
   - Throne holders (གདན་ས་པ།, dan sa pa)
   - Abbots (མཁན་པོ།, mkhan po)
   - Administrative leaders
   - Time periods of their leadership
   - Significant accomplishments during tenure

**8. TEXTS PRODUCED**
   - Major texts written at this institution
   - Printing/publication activities
   - Scriptural collections housed there
   - Famous commentaries composed there

**9. MAJOR HISTORICAL EVENTS**
   - Important teachings held there
   - Debates and scholarly gatherings
   - Renovations or expansions
   - Destruction and rebuilding
   - Notable visits by important figures
   - Political events affecting the institution

**10. OTHER ATTRIBUTES**
   - Number of monks/residents (if mentioned)
   - Architectural features
   - Relics or sacred objects housed there
   - Economic activities (land holdings, trade)
   - Educational specializations
   - Ritual specializations

═══════════════════════════════════════════════════════════════════════════
HANDLING ORGANIZATIONAL HIERARCHIES
═══════════════════════════════════════════════════════════════════════════

Many Tibetan institutions have complex hierarchical structures:

**Parent-Subsidiary Examples:**
- Sakya Monastery (parent)
  - Lhakhang Chenmo (subsidiary temple)
  - North Monastery (subsidiary)
  - South Monastery (subsidiary)

- Narthang Monastery (parent)
  - Tsennyi College (subsidiary college)
  - Gungru College (subsidiary college)

**How to represent:**
1. Extract each institution as a separate entity
2. Use the hierarchy.parent field to reference the parent institution
3. Use the hierarchy.subsidiaries array to list child institutions
4. Use tempId references: "hierarchy": {"parent": "INST_1"}

**Multiple hierarchies:**
- Geographic: Temple → Monastery → Region
- Administrative: College → Monastery → Head Monastery
- Lineage: Branch Monastery → Mother Monastery → Founding Monastery

═══════════════════════════════════════════════════════════════════════════
EXTRACTION GUIDELINES
═══════════════════════════════════════════════════════════════════════════

1. **BE PRECISE**: Only extract institutions explicitly mentioned
2. **DISTINGUISH TYPES**: A temple within a monastery should be marked as "temple", not "monastery"
3. **TRACK CHANGES**: If an institution changed affiliation or purpose, note this in description
4. **RESOLVE REFERENCES**: When text says "the monastery" or "that temple", identify which one from context
5. **NOTE UNCERTAINTY**: Use confidence scores (0.0-1.0) to reflect ambiguity
6. **PRESERVE NAMES**: Keep all name variants exactly as they appear
7. **LINK ENTITIES**: Use tempIds to reference founders, abbots, locations, texts, and events
8. **CONTEXT MATTERS**: Consider document tradition when categorizing institutions

═══════════════════════════════════════════════════════════════════════════
OUTPUT FORMAT
═══════════════════════════════════════════════════════════════════════════

Return ONLY valid JSON (no markdown, no extra text) in this exact structure:

{
  "entities": [
    {
      "tempId": "INST_1",
      "type": "institution",
      "canonicalName": "Narthang Monastery",
      "names": {
        "tibetan": ["སྣར་ཐང་དགོན་པ།"],
        "english": ["Narthang Monastery", "Nar-thang"],
        "phonetic": ["Narthang Gönpa"],
        "wylie": ["snar thang dgon pa"]
      },
      "attributes": {
        "institutionType": "monastery",
        "location": "PLACE_1",
        "tradition": ["Kadampa", "Gelug"],
        "hierarchy": {
          "parent": null,
          "subsidiaries": ["INST_2", "INST_3"]
        },
        "founders": ["PERSON_1"],
        "notableAbbots": [
          {
            "personId": "PERSON_2",
            "personName": "Chim Namkha Drak",
            "period": "mid-13th century",
            "significance": "Expanded the printing house"
          }
        ],
        "textsProduced": [
          {
            "textId": "TEXT_1",
            "textName": "Narthang Kangyur",
            "year": 1730,
            "significance": "Major xylographic edition of Tibetan Buddhist canon"
          }
        ],
        "majorEvents": [
          {
            "eventId": "EVENT_1",
            "description": "Founding of printing house",
            "date": {
              "year": 1153,
              "precision": "circa",
              "confidence": 0.8
            }
          }
        ],
        "description": "Major Kadampa monastery in Tsang, later became Gelugpa. Famous for its printing house which produced the Narthang edition of the Kangyur."
      },
      "dates": {
        "founded": {
          "year": 1153,
          "precision": "exact",
          "confidence": 0.9,
          "source": "Blue Annals"
        }
      },
      "confidence": 0.95,
      "extractionReason": "Explicitly mentioned as 'snar thang dgon pa' with founding details"
    },
    {
      "tempId": "INST_2",
      "type": "college",
      "canonicalName": "Tsennyi College",
      "names": {
        "tibetan": ["མཚན་ཉིད་གྲྭ།"],
        "english": ["Tsennyi College", "College of Buddhist Philosophy"],
        "phonetic": ["Tsennyi Dra"],
        "wylie": ["mtshan nyid grwa"]
      },
      "attributes": {
        "institutionType": "college",
        "location": "PLACE_1",
        "tradition": ["Gelug"],
        "hierarchy": {
          "parent": "INST_1",
          "subsidiaries": []
        },
        "description": "Philosophical college within Narthang Monastery specializing in pramana (logic and epistemology)"
      },
      "confidence": 0.88,
      "extractionReason": "Mentioned as subdivision of Narthang focused on philosophy"
    }
  ],
  "relationships": [
    {
      "subjectId": "PERSON_1",
      "subjectName": "Tumton Lotsawa",
      "predicate": "founded",
      "objectId": "INST_1",
      "objectName": "Narthang Monastery",
      "properties": {
        "date": {
          "year": 1153,
          "precision": "exact",
          "confidence": 0.9
        },
        "location": "Tsang region"
      },
      "confidence": 0.95,
      "sourceQuote": "In 1153, the great translator Tumton founded Narthang Monastery in Tsang",
      "extractionReason": "Explicit founding relationship with date and location"
    },
    {
      "subjectId": "INST_2",
      "subjectName": "Tsennyi College",
      "predicate": "part_of",
      "objectId": "INST_1",
      "objectName": "Narthang Monastery",
      "properties": {
        "role": "constituent college"
      },
      "confidence": 0.9,
      "sourceQuote": "The monastery had two colleges, Tsennyi for philosophy and Gungru for tantra",
      "extractionReason": "Clear hierarchical relationship described"
    }
  ],
  "ambiguities": [
    "Text mentions 'the printing house' but unclear if this is a separate institution or part of the monastery complex",
    "Founding date given as 'Fire-Bird year' - calculated as 1153 CE but some sources suggest 1157"
  ]
}

═══════════════════════════════════════════════════════════════════════════
IMPORTANT RULES
═══════════════════════════════════════════════════════════════════════════

1. **Use tempIds** (INST_1, INST_2, PERSON_1, PLACE_1, TEXT_1, EVENT_1, etc.)
2. **Match tempIds** consistently across entities and relationships
3. **Include sourceQuote** showing exactly where each fact came from
4. **Include extractionReason** explaining confidence scores
5. **List ambiguities** for human curator review
6. **Never invent information** - only extract what's in the text
7. **For hierarchies**: Extract each level as a separate entity, link with parent/subsidiary
8. **For founders and abbots**: Reference by tempId if they're extracted as entities
9. **For dates**:
   - Use "exact" only for specific dates
   - Use "circa" for approximate dates
   - Use "estimated" for scholarly estimates
   - Use "disputed" when sources conflict
   - Include Tibetan calendar info when mentioned
10. **Handle name variants carefully**: Monasteries often have formal and colloquial names

═══════════════════════════════════════════════════════════════════════════

Now extract all institutions and their relationships from the provided text.
Return ONLY the JSON output, with no additional text or markdown.`;
}

/**
 * Simplified institution extraction for testing
 */
export function buildSimpleInstitutionExtractionPrompt(text: string): string {
  return `Extract Buddhist institutions (monasteries, temples, colleges) from this text.

TEXT:
${text}

For each institution, extract:
- Name (all variants)
- Type (monastery, college, hermitage, temple, printing_house, library, government)
- Location
- Founding date and founder
- Tradition (Nyingma, Kagyu, Sakya, Gelug, etc.)
- Parent/subsidiary relationships

Return JSON:
{
  "entities": [
    {
      "tempId": "INST_1",
      "type": "institution",
      "canonicalName": "...",
      "names": {...},
      "attributes": {
        "institutionType": "...",
        "location": "...",
        "tradition": [...],
        "hierarchy": {...}
      },
      "dates": {...},
      "confidence": 0.0-1.0
    }
  ],
  "relationships": [
    {
      "subjectId": "...",
      "predicate": "founded|part_of|...",
      "objectId": "...",
      "confidence": 0.0-1.0,
      "sourceQuote": "..."
    }
  ]
}

Only extract what is explicitly stated. Include confidence scores.`;
}

/**
 * Focused prompt for extracting organizational hierarchies
 */
export function buildInstitutionHierarchyPrompt(
  text: string,
  institutions: Array<{ id: string; name: string }>
): string {
  const instList = institutions
    .map(i => `- ${i.id}: ${i.name}`)
    .join('\n');

  return `Given these known institutions from a Tibetan Buddhist text, extract the hierarchical relationships between them.

KNOWN INSTITUTIONS:
${instList}

TEXT:
${text}

Extract hierarchical relationships:
- **part_of**: College is part of monastery
- **within**: Temple is within monastery complex
- **branch_of**: Branch monastery of mother monastery
- **affiliated_with**: Sister institutions in same network

Return JSON:
{
  "relationships": [
    {
      "subjectId": "INST_1",
      "subjectName": "...",
      "predicate": "part_of",
      "objectId": "INST_2",
      "objectName": "...",
      "properties": {
        "role": "constituent college",
        "established": "...",
        "notes": "..."
      },
      "confidence": 0.0-1.0,
      "sourceQuote": "exact text showing this relationship"
    }
  ]
}

Only include relationships explicitly stated in the text.`;
}
