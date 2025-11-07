/**
 * Prompt Templates for Concept Extraction from Tibetan Buddhist Texts
 *
 * These prompts guide the LLM to extract philosophical concepts, practices,
 * deities, doctrines, and technical terms from Tibetan Buddhist texts.
 *
 * Phase 1, Task 1.1.4: Concept Extraction
 */

export interface ConceptExtractionContext {
  documentTitle?: string;
  pageNumber?: string;
  documentType?: string;
  tradition?: string; // Nyingma, Kagyu, Sakya, Gelug, etc.
  author?: string; // Important for identifying school-specific interpretations
}

/**
 * Main concept extraction prompt
 */
export function buildConceptExtractionPrompt(
  translatedText: string,
  originalTibetan?: string,
  context?: ConceptExtractionContext
): string {
  return `You are a specialized AI assistant for extracting philosophical CONCEPTS, practices, and deities from Tibetan Buddhist texts.

Your task is to identify and extract conceptual entities including philosophical views, meditation practices, deities, doctrines, and technical terminology.

${context?.documentTitle ? `DOCUMENT: ${context.documentTitle}` : ''}
${context?.pageNumber ? `PAGE: ${context.pageNumber}` : ''}
${context?.documentType ? `TYPE: ${context.documentType}` : ''}
${context?.tradition ? `TRADITION: ${context.tradition}` : ''}
${context?.author ? `AUTHOR: ${context.author}` : ''}

TEXT TO ANALYZE:
"""
${translatedText}
"""

${originalTibetan ? `\nORIGINAL TIBETAN (for reference):\n${originalTibetan}\n` : ''}

CONCEPT TYPES TO EXTRACT:

1. **PHILOSOPHICAL_VIEW** (ལྟ་བ།):
   - Views on reality, emptiness, Buddha-nature, self, etc.
   - Examples: emptiness (སྟོང་པ་ཉིད།), two truths (བདེན་གཉིས།), Buddha-nature (དེ་བཞིན་གཤེགས་པའི་སྙིང་པོ།)
   - Different schools often have DIFFERENT interpretations of the same term
   - Note: Madhyamaka vs. Cittamatra vs. Rangtong vs. Shentong interpretations

2. **MEDITATION_PRACTICE** (སྒོམ།):
   - Specific meditation techniques and practices
   - Examples: shamatha (ཞི་གནས།), vipashyana (ལྷག་མཐོང།), Mahamudra (ཕྱག་རྒྱ་ཆེན་པོ།), Dzogchen (རྫོགས་ཆེན།)
   - Include: practice instructions, stages, prerequisites, results
   - Link to: practitioners known for this practice, texts teaching it

3. **DEITY** (ལྷ།):
   - Buddhas, bodhisattvas, yidams, protectors, dakinis
   - Examples: Chenrezig (སྤྱན་རས་གཟིགས།), Tara (སྒྲོལ་མ།), Vajrayogini (རྡོ་རྗེ་རྣལ་འབྱོར་མ།)
   - Extract: iconographic details (arms, heads, color, implements)
   - Extract: qualities, associated practices, mantras
   - Note: tradition-specific forms (peaceful vs. wrathful, different lineages)

4. **DOCTRINE** (བསྟན་པ།):
   - Fundamental Buddhist teachings and doctrines
   - Examples: Four Noble Truths (བདེན་པ་བཞི།), dependent origination (རྟེན་འབྲེལ།), karma (ལས།)
   - Include: different school interpretations
   - Link to: authoritative texts, key teachers

5. **TECHNICAL_TERM**:
   - Specialized Buddhist terminology
   - Examples: bardo (བར་དོ།), rigpa (རིག་པ།), alaya consciousness (ཀུན་གཞི་རྣམ་ཤེས།)
   - Terms that require specialized knowledge to understand
   - May have multiple meanings in different contexts

EXTRACTION REQUIREMENTS:

For EACH concept, extract:

1. **Names and Translations**:
   - Tibetan term (exact spelling from text)
   - Sanskrit equivalent (if mentioned or commonly known)
   - Pali equivalent (if relevant)
   - English translation(s) (multiple if applicable)
   - Wylie transliteration

2. **Definitions**:
   - Definition from THIS text (context-specific)
   - Which school/tradition's interpretation (CRITICAL!)
   - Author of this interpretation (if known)
   - Source text reference

3. **School-Specific Interpretations**:
   - IMPORTANT: Same term may mean different things in different traditions!
   - Example: "emptiness" in Gelug vs. Jonang traditions
   - Example: "Mahamudra" in Kagyu vs. Gelug contexts
   - Mark which school's view is being presented

4. **Related Concepts**:
   - Broader concepts (parent concepts)
   - Narrower concepts (sub-types, specific instances)
   - Related concepts (associated ideas)
   - Contradictory concepts (opposing views, debates)

5. **Practitioners and Texts**:
   - Notable practitioners known for this practice/view
   - Key texts that teach this concept
   - Lineages that transmit this teaching

6. **Debates and Controversies**:
   - If the text mentions debates about this concept
   - Different interpretations or disputes
   - Which schools agree or disagree
   - Historical evolution of the concept

OUTPUT FORMAT:

Return ONLY valid JSON (no markdown, no extra text) in this exact structure:

{
  "concepts": [
    {
      "tempId": "CONCEPT_1",
      "type": "concept",
      "canonicalName": "Emptiness",
      "names": {
        "tibetan": ["སྟོང་པ་ཉིད།"],
        "english": ["emptiness", "voidness", "shunyata"],
        "phonetic": ["tong-pa-nyi"],
        "wylie": ["stong pa nyid"],
        "sanskrit": ["śūnyatā"]
      },
      "attributes": {
        "conceptType": "philosophical_view",
        "definitions": [
          {
            "text": "The absence of inherent existence in all phenomena",
            "source": "This text, page 42",
            "author": "Tsongkhapa",
            "school": "Gelug"
          }
        ],
        "relatedConcepts": {
          "broader": ["two truths"],
          "narrower": ["emptiness of self", "emptiness of phenomena"],
          "related": ["dependent origination", "middle way"],
          "contradicts": ["eternalism", "nihilism"]
        },
        "sanskritTerm": "śūnyatā"
      },
      "confidence": 0.95,
      "extractionReason": "Central concept explicitly defined and discussed in this section"
    },
    {
      "tempId": "CONCEPT_2",
      "type": "concept",
      "canonicalName": "Shamatha",
      "names": {
        "tibetan": ["ཞི་གནས།"],
        "english": ["calm abiding", "tranquility meditation"],
        "phonetic": ["zhi-né"],
        "wylie": ["zhi gnas"],
        "sanskrit": ["śamatha"]
      },
      "attributes": {
        "conceptType": "meditation_practice",
        "definitions": [
          {
            "text": "Single-pointed concentration that stabilizes the mind",
            "source": "This text",
            "school": "general"
          }
        ],
        "relatedConcepts": {
          "related": ["vipashyana", "nine stages of shamatha"],
          "broader": ["meditation practices"]
        },
        "sanskritTerm": "śamatha"
      },
      "confidence": 0.9
    },
    {
      "tempId": "DEITY_1",
      "type": "deity",
      "canonicalName": "Chenrezig",
      "names": {
        "tibetan": ["སྤྱན་རས་གཟིགས།"],
        "english": ["Avalokiteshvara", "Chenrezig"],
        "phonetic": ["chen-ré-zig"],
        "wylie": ["spyan ras gzigs"],
        "sanskrit": ["Avalokiteśvara"]
      },
      "attributes": {
        "deityType": "bodhisattva",
        "tradition": ["all traditions"],
        "iconography": {
          "arms": 4,
          "heads": 1,
          "color": "white",
          "implements": ["lotus", "crystal mala"],
          "posture": "seated in lotus position"
        },
        "qualities": ["compassion", "loving-kindness"],
        "mantras": ["OM MANI PADME HUM"]
      },
      "confidence": 0.95
    }
  ],
  "relationships": [
    {
      "subjectId": "PERSON_1",
      "subjectName": "Tsongkhapa",
      "predicate": "held_view",
      "objectId": "CONCEPT_1",
      "objectName": "Emptiness (Gelug interpretation)",
      "properties": {
        "school": "Gelug",
        "interpretation": "Prasangika Madhyamaka view"
      },
      "confidence": 0.9,
      "sourceQuote": "Tsongkhapa taught emptiness as the absence of inherent existence"
    },
    {
      "subjectId": "PERSON_2",
      "subjectName": "Milarepa",
      "predicate": "practiced",
      "objectId": "CONCEPT_3",
      "objectName": "Tummo",
      "properties": {
        "location": "Mountain caves",
        "duration": "many years",
        "achievement": "mastered inner heat"
      },
      "confidence": 0.95,
      "sourceQuote": "Milarepa practiced tummo in the caves and gained mastery"
    },
    {
      "subjectId": "TEXT_1",
      "subjectName": "Lamrim Chenmo",
      "predicate": "teaches_concept",
      "objectId": "CONCEPT_1",
      "objectName": "Emptiness",
      "properties": {
        "section": "Chapter on Wisdom",
        "detail_level": "comprehensive"
      },
      "confidence": 0.95
    }
  ],
  "debates": [
    {
      "concept": "CONCEPT_1",
      "conceptName": "Emptiness",
      "description": "Gelug vs. Jonang interpretation",
      "positions": [
        {
          "school": "Gelug",
          "view": "Rangtong - self-emptiness, all phenomena are empty of inherent existence",
          "proponents": ["Tsongkhapa", "Khedrup Je"]
        },
        {
          "school": "Jonang",
          "view": "Shentong - other-emptiness, Buddha-nature is not empty but only empty of adventitious defilements",
          "proponents": ["Dolpopa", "Taranatha"]
        }
      ],
      "significance": "Fundamental difference in understanding ultimate reality"
    }
  ],
  "ambiguities": [
    "The text mentions 'the view' but doesn't specify which philosophical school's interpretation",
    "Deity description mentions 'four arms' but unclear if peaceful or wrathful form"
  ]
}

CRITICAL GUIDELINES:

1. **School-Specific Interpretations** (MOST IMPORTANT):
   - Always note which tradition's interpretation is being presented
   - Same term can have VERY different meanings across schools
   - Examples:
     * "Buddha-nature": Gelug (potential) vs. Nyingma (already present)
     * "Mahamudra": Kagyu (essence) vs. Gelug (emptiness)
     * "Ground" (གཞི།): Dzogchen vs. general usage
   - Mark confidence lower if school affiliation is unclear

2. **Deities as Concepts**:
   - Extract deities as type "deity" (not just "concept")
   - Include iconographic details when mentioned
   - Note tradition-specific forms (e.g., Sakya Vajrayogini vs. Kagyu)
   - Link to associated practices and practitioners

3. **Debate Recognition**:
   - Identify when text mentions different interpretations
   - Note opposing views explicitly
   - Track historical development of concepts
   - Mark controversial or disputed concepts

4. **Context Sensitivity**:
   - Definition should reflect THIS text's usage
   - May differ from general dictionary definitions
   - Author and tradition context is crucial
   - Time period may affect interpretation

5. **Technical Precision**:
   - Use exact Tibetan spelling from text
   - Provide standard Sanskrit equivalents
   - Multiple English translations are common and valuable
   - Wylie transliteration for scholarly reference

6. **Relationship Extraction**:
   - Link practitioners to their views and practices
   - Connect texts to concepts they teach
   - Show which lineages hold which interpretations
   - Track who taught what to whom

7. **Confidence Scoring**:
   - 0.95-1.0: Explicitly defined in text with clear school attribution
   - 0.8-0.9: Clearly mentioned but school interpretation inferred from context
   - 0.6-0.8: Mentioned but definition must be inferred
   - 0.4-0.6: Implied or unclear which interpretation
   - 0.0-0.4: Highly uncertain or ambiguous

8. **Quality Control**:
   - Never invent definitions not in the text
   - Always provide sourceQuote for relationships
   - List ambiguities for human review
   - Mark debates and controversies explicitly
   - Use extractionReason to explain your confidence

Now extract all concepts, deities, practices, and their relationships from the provided text. Return ONLY the JSON output.`;
}

/**
 * Focused deity extraction prompt
 */
export function buildDeityExtractionPrompt(
  text: string,
  context?: ConceptExtractionContext
): string {
  return `Extract ONLY deities (buddhas, bodhisattvas, yidams, protectors, dakinis) from this Tibetan Buddhist text.

${context?.tradition ? `TRADITION: ${context.tradition}` : ''}

TEXT:
${text}

For each deity, extract:
- All name variants (Tibetan, Sanskrit, English)
- Deity type (buddha, bodhisattva, yidam, protector, dakini, dharma_protector)
- Iconography (arms, heads, color, implements, posture)
- Qualities and attributes
- Associated mantras
- Which traditions practice this deity
- Tradition-specific forms (e.g., Sakya vs. Kagyu forms)

Return JSON:
{
  "concepts": [
    {
      "tempId": "DEITY_1",
      "type": "deity",
      "canonicalName": "...",
      "names": {...},
      "attributes": {
        "deityType": "...",
        "tradition": [...],
        "iconography": {...},
        "qualities": [...],
        "mantras": [...]
      },
      "confidence": 0.0-1.0
    }
  ]
}

Only extract deities explicitly mentioned in the text.`;
}

/**
 * Philosophical view extraction prompt
 */
export function buildPhilosophicalViewExtractionPrompt(
  text: string,
  context?: ConceptExtractionContext
): string {
  return `Extract ONLY philosophical views (ལྟ་བ།) from this Tibetan Buddhist text.

${context?.tradition ? `TRADITION: ${context.tradition}` : ''}
${context?.author ? `AUTHOR: ${context.author}` : ''}

TEXT:
${text}

Extract views on:
- Emptiness, Buddha-nature, ultimate reality
- Two truths, dependent origination
- Mind, consciousness, awareness
- Rangtong vs. Shentong debates
- Madhyamaka vs. Cittamatra
- School-specific interpretations

CRITICAL: Note which school's interpretation is being presented!

Return JSON:
{
  "concepts": [
    {
      "tempId": "VIEW_1",
      "type": "concept",
      "canonicalName": "...",
      "names": {...},
      "attributes": {
        "conceptType": "philosophical_view",
        "definitions": [
          {
            "text": "...",
            "source": "...",
            "author": "...",
            "school": "Gelug|Kagyu|Sakya|Nyingma|Jonang|etc"
          }
        ],
        "relatedConcepts": {...}
      },
      "confidence": 0.0-1.0
    }
  ],
  "debates": [
    {
      "concept": "VIEW_1",
      "description": "...",
      "positions": [
        {"school": "...", "view": "...", "proponents": [...]}
      ]
    }
  ]
}`;
}

/**
 * Meditation practice extraction prompt
 */
export function buildPracticeExtractionPrompt(
  text: string,
  context?: ConceptExtractionContext
): string {
  return `Extract ONLY meditation practices (སྒོམ།) from this Tibetan Buddhist text.

${context?.tradition ? `TRADITION: ${context.tradition}` : ''}

TEXT:
${text}

Extract practices like:
- Shamatha, vipashyana, Mahamudra, Dzogchen
- Generation stage, completion stage
- Guru yoga, deity practices
- Specific techniques and instructions
- Prerequisites and results

For each practice, extract:
- Name variants (Tibetan, Sanskrit, English)
- Type of practice
- Associated lineage/tradition
- Practitioners known for this practice
- Texts that teach it
- Stages or components

Return JSON:
{
  "concepts": [
    {
      "tempId": "PRACTICE_1",
      "type": "concept",
      "canonicalName": "...",
      "names": {...},
      "attributes": {
        "conceptType": "meditation_practice",
        "definitions": [...],
        "relatedConcepts": {...}
      },
      "confidence": 0.0-1.0
    }
  ],
  "relationships": [
    {
      "subjectId": "PERSON_X",
      "predicate": "practiced",
      "objectId": "PRACTICE_1",
      "properties": {"achievement": "..."},
      "confidence": 0.0-1.0,
      "sourceQuote": "..."
    }
  ]
}`;
}

/**
 * Concept relationship extraction prompt
 */
export function buildConceptRelationshipPrompt(
  text: string,
  concepts: Array<{ id: string; name: string; type: string; conceptType?: string }>
): string {
  const conceptList = concepts
    .map(c => `- ${c.id}: ${c.name} (${c.conceptType || c.type})`)
    .join('\n');

  return `Given these known concepts from a Tibetan Buddhist text, extract the relationships between concepts, people, and texts.

KNOWN CONCEPTS:
${conceptList}

TEXT:
${text}

Extract relationships like:
- PERSON practiced CONCEPT
- PERSON held_view CONCEPT
- PERSON taught_concept CONCEPT
- TEXT teaches_concept CONCEPT
- CONCEPT broader_than CONCEPT
- CONCEPT contradicts CONCEPT
- CONCEPT related_to CONCEPT

Return JSON:
{
  "relationships": [
    {
      "subjectId": "...",
      "predicate": "practiced|held_view|taught_concept|teaches_concept|broader_than|contradicts|related_to",
      "objectId": "...",
      "properties": {
        "school": "...",
        "interpretation": "...",
        "context": "..."
      },
      "confidence": 0.0-1.0,
      "sourceQuote": "exact text showing this relationship"
    }
  ]
}`;
}

/**
 * School interpretation comparison prompt
 */
export function buildSchoolComparisonPrompt(
  conceptName: string,
  text: string
): string {
  return `Analyze how different Buddhist schools interpret the concept "${conceptName}" in this text.

TEXT:
${text}

Identify:
1. Which school's interpretation is being presented?
2. Are multiple schools' views mentioned?
3. Are there debates or disagreements noted?
4. How does this school's view differ from others?

Return JSON:
{
  "concept": "${conceptName}",
  "interpretations": [
    {
      "school": "Gelug|Kagyu|Sakya|Nyingma|Jonang|etc",
      "view": "detailed explanation of this school's interpretation",
      "sourceQuote": "...",
      "proponents": ["list of teachers who held this view"],
      "confidence": 0.0-1.0
    }
  ],
  "debates": [
    {
      "description": "what the debate is about",
      "schools": ["which schools are involved"],
      "significance": "why this debate matters"
    }
  ]
}`;
}
