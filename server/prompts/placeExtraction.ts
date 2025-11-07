/**
 * Place Extraction Prompt for Knowledge Graph
 *
 * Specialized prompt for extracting geographic locations and places
 * from Tibetan Buddhist texts.
 *
 * Phase 1, Task 1.1.1: Place extraction
 */

export interface PlaceExtractionContext {
  documentTitle?: string;
  pageNumber?: string;
  documentType?: string;
  tradition?: string;
  knownRegion?: string; // If we already know the general region
}

/**
 * Build specialized prompt for extracting places from Tibetan Buddhist texts
 *
 * Extracts: monasteries, mountains, caves, regions, countries, cities, holy sites,
 * hermitages, temples, stupas with their geographic hierarchies, coordinates,
 * founding information, and associated people.
 */
export function buildPlaceExtractionPrompt(
  text: string,
  context?: PlaceExtractionContext
): string {
  return `You are a specialized AI assistant for extracting PLACE entities from Tibetan Buddhist historical texts.

Your task is to identify all geographic locations and places mentioned in the text and extract detailed information about them.

${context?.documentTitle ? `DOCUMENT: ${context.documentTitle}` : ''}
${context?.pageNumber ? `PAGE: ${context.pageNumber}` : ''}
${context?.documentType ? `TYPE: ${context.documentType}` : ''}
${context?.tradition ? `TRADITION: ${context.tradition}` : ''}
${context?.knownRegion ? `KNOWN REGION: ${context.knownRegion}` : ''}

TEXT TO ANALYZE:
"""
${text}
"""

PLACE TYPES TO EXTRACT:

**MONASTERY** (དགོན་པ།): Buddhist monasteries, monastic complexes, abbeys
- Examples: Sakya Monastery, Samye, Nalanda, Vikramashila, Mindrolling
- Look for: དགོན་པ།, དགོན།, monastery names with "Gompa" suffix

**MOUNTAIN** (རི།): Sacred mountains, pilgrimage peaks, meditation mountains
- Examples: Mount Kailash (གངས་རིན་པོ་ཆེ།), Tsari (ཙཱ་རི།), Wutai Shan
- Look for: རི།, གངས།, mountain names, peaks

**CAVE** (བྲག་ཕུག།): Meditation caves, retreat caves, hermitages in caves
- Examples: Milarepa's caves, Guru Rinpoche's caves, retreat locations
- Look for: བྲག་ཕུག།, ཕུག།, cave, grotto

**REGION** (ས་ཁུལ།): Administrative or cultural regions
- Examples: Ü-Tsang (དབུས་གཙང།), Kham (ཁམས།), Amdo (ཨ་མདོ།), Central Tibet
- Look for: Regional names, province names, cultural zones

**COUNTRY** (རྒྱལ་ཁབ།): Nations, kingdoms, empires
- Examples: Tibet (བོད།), Nepal (བལ་ཡུལ།), India (རྒྱ་གར།), China, Mongolia
- Look for: Country names, kingdom names

**CITY** (གྲོང་ཁྱེར།): Cities, towns, settlements
- Examples: Lhasa (ལྷ་ས།), Shigatse (གཞིས་ཀ་རྩེ།), Kathmandu, Varanasi
- Look for: City names, capital cities, major settlements

**HOLY_SITE** (གནས་མཆོག།): Pilgrimage sites, sacred locations
- Examples: Bodhgaya, Tsari, Lake Manasarovar, sacred circuits
- Look for: Pilgrimage destinations, sacred sites, holy places

**HERMITAGE** (རི་ཁྲོད།): Retreat centers, isolated practice locations
- Examples: Forest hermitages, mountain retreats, practice centers
- Look for: རི་ཁྲོད།, retreat centers, isolated monasteries

**TEMPLE** (ལྷ་ཁང།): Temples, shrines, chapels
- Examples: Jokhang Temple, Ramoche Temple, shrine halls
- Look for: ལྷ་ཁང།, temples, shrine buildings

**STUPA** (མཆོད་རྟེན།): Stupas, reliquaries, memorial monuments
- Examples: Boudhanath Stupa, Swayambhunath, memorial stupas
- Look for: མཆོད་རྟེན།, stupa, chorten

EXTRACTION GUIDELINES:

1. **NAME VARIANTS**: Extract ALL ways the place is referenced
   - Tibetan names (exact script if available)
   - English names (common spellings)
   - Phonetic transliterations (how it sounds)
   - Wylie transliteration (for Tibetan)
   - Regional variants (different local names)
   - Historical names (old names vs modern names)

2. **GEOGRAPHIC HIERARCHY**: Build location relationships
   - Monastery → Mountain → Region → Country
   - Cave → Mountain → Region → Country
   - City → Region → Country
   - Example: "Sakya Monastery is in Tsang region in Tibet"

3. **COORDINATES**: Identify modern locations when possible
   - If you recognize a well-known place, estimate coordinates
   - Mark confidence based on certainty of identification
   - Only include coordinates for places you can reliably identify
   - Include source of coordinate information

4. **FOUNDING INFORMATION**: Extract establishment details
   - Founding date (exact, circa, or relative)
   - Founder(s) - who established the place
   - Sponsors/patrons - who supported the founding
   - Historical context - events around the founding

5. **ASSOCIATED PEOPLE**: Link people to places
   - Founders and establishers
   - Famous residents (teachers, yogis, scholars)
   - Abbots and leaders
   - Visitors and pilgrims
   - Patrons and benefactors

6. **HISTORICAL SIGNIFICANCE**: Note why the place matters
   - Religious importance (sacred site, teaching center)
   - Historical events that occurred there
   - Famous people associated with it
   - Pilgrimage significance
   - Lineage connections

7. **CONFIDENCE SCORING**:
   - 0.9-1.0: Well-known place explicitly named with clear details
   - 0.7-0.9: Place clearly identified but some details ambiguous
   - 0.5-0.7: Place name mentioned but context unclear
   - 0.3-0.5: Possible place reference but uncertain
   - 0.0-0.3: Very uncertain, may not be a place

OUTPUT FORMAT:

Return ONLY valid JSON (no markdown, no extra text) in this exact structure:

{
  "entities": [
    {
      "tempId": "PLACE_1",
      "type": "place",
      "canonicalName": "Sakya Monastery",
      "names": {
        "tibetan": ["ས་སྐྱ་དགོན་པ།"],
        "english": ["Sakya Monastery", "Sakya Gompa"],
        "phonetic": ["Sa-kya", "Sakya"],
        "wylie": ["sa skya dgon pa"]
      },
      "attributes": {
        "placeType": "monastery",
        "coordinates": {
          "latitude": 28.9019,
          "longitude": 88.0247,
          "accuracy": 100,
          "source": "Known location of Sakya Monastery in Tibet"
        },
        "region": "Tsang",
        "modernCountry": "Tibet Autonomous Region, China",
        "parent": "PLACE_2",
        "significance": [
          "Main monastery of Sakya school of Tibetan Buddhism",
          "One of the most important monasteries in Tibet",
          "Center of Sakya political power during 13th-14th centuries"
        ],
        "description": "Principal monastery of the Sakya school, founded in 1073, famous for its gray-striped walls and vast library",
        "altitude": 4316
      },
      "dates": {
        "founded": {
          "year": 1073,
          "precision": "exact",
          "confidence": 0.95,
          "source": "Historical records"
        }
      },
      "confidence": 0.98,
      "extractionReason": "Explicitly mentioned as 'Sakya Monastery' with founding details"
    },
    {
      "tempId": "PLACE_2",
      "type": "place",
      "canonicalName": "Tsang",
      "names": {
        "tibetan": ["གཙང།"],
        "english": ["Tsang", "Gtsang"],
        "phonetic": ["Tsang"],
        "wylie": ["gtsang"]
      },
      "attributes": {
        "placeType": "region",
        "region": "Central Tibet",
        "modernCountry": "Tibet Autonomous Region, China",
        "description": "One of the three traditional provinces of central Tibet, historically important region"
      },
      "confidence": 0.90,
      "extractionReason": "Region mentioned as location of Sakya Monastery"
    },
    {
      "tempId": "PLACE_3",
      "type": "place",
      "canonicalName": "Mount Kailash",
      "names": {
        "tibetan": ["གངས་རིན་པོ་ཆེ།", "ཏི་སེ།"],
        "english": ["Mount Kailash", "Mount Kailas", "Gang Rinpoche"],
        "phonetic": ["Gang Rin-po-che", "Ti-se"],
        "wylie": ["gangs rin po che", "ti se"],
        "sanskrit": ["Kailāsa"]
      },
      "attributes": {
        "placeType": "mountain",
        "coordinates": {
          "latitude": 31.0688,
          "longitude": 81.3108,
          "accuracy": 10,
          "source": "Well-known location of Mount Kailash"
        },
        "region": "Western Tibet",
        "modernCountry": "Tibet Autonomous Region, China",
        "significance": [
          "Sacred to four religions: Buddhism, Hinduism, Jainism, and Bon",
          "Major pilgrimage destination",
          "Considered the center of the world in Buddhist and Hindu cosmology"
        ],
        "altitude": 6638
      },
      "confidence": 0.95,
      "extractionReason": "Mentioned as pilgrimage destination"
    }
  ],
  "relationships": [
    {
      "subjectId": "PLACE_1",
      "subjectName": "Sakya Monastery",
      "predicate": "within",
      "objectId": "PLACE_2",
      "objectName": "Tsang",
      "properties": {
        "hierarchyLevel": "monastery_in_region"
      },
      "confidence": 0.95,
      "sourceQuote": "Sakya Monastery in Tsang region",
      "extractionReason": "Geographic hierarchy explicitly stated"
    },
    {
      "subjectId": "PLACE_1",
      "subjectName": "Sakya Monastery",
      "predicate": "founded",
      "objectId": "PERSON_1",
      "objectName": "Khön Könchok Gyalpo",
      "properties": {
        "date": {
          "year": 1073,
          "precision": "exact",
          "confidence": 0.95
        },
        "role": "founder"
      },
      "confidence": 0.95,
      "sourceQuote": "founded by Khön Könchok Gyalpo in 1073",
      "extractionReason": "Founding relationship with date explicitly stated"
    }
  ],
  "geographicHierarchies": [
    {
      "description": "Sakya Monastery location hierarchy",
      "chain": [
        {"tempId": "PLACE_1", "name": "Sakya Monastery", "type": "monastery"},
        {"tempId": "PLACE_2", "name": "Tsang", "type": "region"},
        {"tempId": "PLACE_3", "name": "Tibet", "type": "country"}
      ]
    }
  ],
  "ambiguities": [
    "Text mentions 'the monastery in the north' but doesn't specify which monastery",
    "Unclear if 'Kham' refers to the entire Kham region or a specific district within it"
  ]
}

IMPORTANT RULES:

1. **BE SPECIFIC ABOUT PLACE TYPE**: Choose the most accurate type from the list above
2. **BUILD HIERARCHIES**: Use the "parent" field to link places (monastery → region → country)
3. **COORDINATES**: Only include if you can identify the modern location with confidence
4. **PRESERVE TIBETAN NAMES**: Keep exact spellings from text
5. **EXTRACT FOUNDING INFO**: Who, when, where, why - get all founding details
6. **LINK TO PEOPLE**: Extract relationships between places and people (founded_by, lived_at, etc.)
7. **NOTE SIGNIFICANCE**: Explain why this place matters historically/religiously
8. **HANDLE AMBIGUITY**: If unsure about identification, mark with lower confidence
9. **GEOGRAPHIC CONTEXT**: Always try to place locations within larger geographic units
10. **TEMPORAL CONTEXT**: Note if place names changed over time or if it's destroyed/rebuilt

COMMON PATTERNS TO RECOGNIZE:

- "དགོན་པ།" or "gompa" → monastery
- "རི།" or "mountain" → mountain
- "བྲག་ཕུག།" or "cave of..." → cave
- "གནས་" → holy site
- "ཁུལ།" or "region" → region
- Place + founder name → founding relationship
- Person + "at" + place → lived_at/visited relationship
- Event + "at" + place → location relationship

Now extract all place entities from the provided text. Return ONLY the JSON output.`;
}

/**
 * Build a simplified place extraction prompt for testing
 */
export function buildSimplePlaceExtractionPrompt(text: string): string {
  return `Extract all PLACES (locations) from this Tibetan Buddhist text.

PLACE TYPES: monastery, mountain, cave, region, country, city, holy_site, hermitage, temple, stupa

TEXT:
${text}

For each place extract:
- Name variants (Tibetan, English, phonetic)
- Place type
- Geographic location (region, country)
- Coordinates if identifiable
- Founding date and founder if mentioned

Return JSON:
{
  "entities": [
    {
      "tempId": "PLACE_1",
      "type": "place",
      "canonicalName": "...",
      "names": {...},
      "attributes": {
        "placeType": "monastery|mountain|cave|...",
        "region": "...",
        "modernCountry": "...",
        "coordinates": {...}
      },
      "dates": {
        "founded": {...}
      },
      "confidence": 0.0-1.0
    }
  ],
  "relationships": [
    {
      "subjectId": "PLACE_1",
      "predicate": "within|founded|near",
      "objectId": "PLACE_2",
      "confidence": 0.0-1.0,
      "sourceQuote": "..."
    }
  ]
}`;
}

/**
 * Build prompt for extracting geographic hierarchies from already-identified places
 */
export function buildGeographicHierarchyPrompt(
  text: string,
  places: Array<{ id: string; name: string; type: string }>
): string {
  const placeList = places
    .map(p => `- ${p.id}: ${p.name} (${p.type})`)
    .join('\n');

  return `Given these known places from a Tibetan Buddhist text, extract the geographic relationships between them.

KNOWN PLACES:
${placeList}

TEXT:
${text}

Extract geographic hierarchies and spatial relationships:
- **within**: X is located within Y (monastery within region, region within country)
- **near**: X is near Y (monastery near mountain)
- **parent**: Hierarchical relationship (city → region → country)

Build complete location chains like:
- Cave → Mountain → Region → Country
- Monastery → City → Region → Country
- Temple → Monastery → Region → Country

Return JSON:
{
  "relationships": [
    {
      "subjectId": "PLACE_1",
      "predicate": "within",
      "objectId": "PLACE_2",
      "properties": {
        "hierarchyLevel": "monastery_in_region"
      },
      "confidence": 0.0-1.0,
      "sourceQuote": "exact text showing this relationship"
    }
  ],
  "hierarchies": [
    {
      "description": "Full location chain",
      "chain": [
        {"id": "PLACE_1", "name": "Sakya Monastery", "type": "monastery"},
        {"id": "PLACE_2", "name": "Tsang", "type": "region"},
        {"id": "PLACE_3", "name": "Tibet", "type": "country"}
      ]
    }
  ]
}

Only include relationships explicitly stated or clearly implied by the text.`;
}

/**
 * Build prompt for extracting coordinates for known places
 */
export function buildCoordinateExtractionPrompt(
  places: Array<{ id: string; name: string; description?: string }>
): string {
  const placeList = places
    .map(p => `- ${p.id}: ${p.name}${p.description ? ` (${p.description})` : ''}`)
    .join('\n');

  return `Given these places extracted from a Tibetan Buddhist text, identify their modern geographic coordinates if possible.

PLACES:
${placeList}

For each place that you can confidently identify with a real-world location, provide:
- latitude and longitude (decimal degrees)
- accuracy estimate (meters)
- confidence in the identification (0.0-1.0)
- source/reasoning for the coordinates

Only include coordinates if you can make a confident identification. Many historical places may not be identifiable or may no longer exist.

Return JSON:
{
  "coordinates": [
    {
      "placeId": "PLACE_1",
      "placeName": "Sakya Monastery",
      "coordinates": {
        "latitude": 28.9019,
        "longitude": 88.0247,
        "accuracy": 100,
        "source": "Well-documented location of Sakya Monastery in Tibet"
      },
      "confidence": 0.95,
      "modernLocation": "Sakya County, Shigatse, Tibet Autonomous Region, China",
      "notes": "Main monastery still exists and is a major tourist/pilgrimage site"
    }
  ]
}`;
}
