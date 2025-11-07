/**
 * Event Extraction Prompt for Tibetan Buddhist Historical Texts
 *
 * This prompt extracts structured event data including teachings, empowerments,
 * debates, pilgrimages, retreats, and other significant historical occurrences.
 *
 * Based on: roadmaps/knowledge-graph/PHASE_1_ENTITY_EXTRACTION.md (Task 1.1.3)
 */

export interface EventExtractionContext {
  documentTitle?: string;
  pageNumber?: string;
  documentType?: string;
  tradition?: string;
  knownPeople?: Array<{ id: string; name: string }>;
  knownPlaces?: Array<{ id: string; name: string }>;
}

/**
 * Main event extraction prompt
 */
export function buildEventExtractionPrompt(
  translatedText: string,
  originalTibetan?: string,
  context?: EventExtractionContext
): string {
  const knownPeopleList = context?.knownPeople?.length
    ? context.knownPeople.map(p => `- ${p.id}: ${p.name}`).join('\n')
    : 'None provided';

  const knownPlacesList = context?.knownPlaces?.length
    ? context.knownPlaces.map(p => `- ${p.id}: ${p.name}`).join('\n')
    : 'None provided';

  return `You are a specialized AI assistant for extracting historical EVENTS from Tibetan Buddhist texts.

Your task is to identify and extract all significant events mentioned in the text with precise details about dates, participants, locations, and outcomes.

${context?.documentTitle ? `DOCUMENT: ${context.documentTitle}` : ''}
${context?.pageNumber ? `PAGE: ${context.pageNumber}` : ''}
${context?.documentType ? `TYPE: ${context.documentType}` : ''}
${context?.tradition ? `TRADITION: ${context.tradition}` : ''}

KNOWN PEOPLE (reference these IDs when possible):
${knownPeopleList}

KNOWN PLACES (reference these IDs when possible):
${knownPlacesList}

TEXT TO ANALYZE:
"""
${translatedText}
"""

${originalTibetan ? `\nORIGINAL TIBETAN (for reference):\n${originalTibetan}\n` : ''}

═══════════════════════════════════════════════════════════════════════
EVENT TYPES TO EXTRACT
═══════════════════════════════════════════════════════════════════════

**TEACHING** (ཆོས་འབངས། / chos 'bangs - dharma teachings):
- Public teachings, private instructions, oral transmissions
- Extract: teacher, students/audience, text taught, duration, location
- Examples: "He gave teachings on the Prajnaparamita", "received instructions on Mahamudra"

**EMPOWERMENT** (དབང་བསྐུར། / dbang bskur - wang/abhisheka initiations):
- Tantric empowerments, initiations, consecrations
- Extract: lama giving empowerment, deity/tantra, recipients, location
- Examples: "bestowed the Hevajra empowerment", "received the Chakrasamvara wang"

**DEBATE** (རྩོད་པ། / rtsod pa - philosophical debates):
- Public debates, philosophical disputes, doctrinal contests
- Extract: participants, topic/position, outcome, location, audience
- Examples: "debated with the scholar on emptiness", "defeated his opponents"

**FOUNDING** (གསར་རྒྱག / gsar rgyag - monastery/institution founding):
- Establishment of monasteries, colleges, hermitages, institutions
- Extract: founder, location, institution type, date, sponsors
- Examples: "established a monastery at Sakya", "founded three meditation centers"

**PILGRIMAGE** (གནས་སྐོར། / gnas skor - sacred journeys):
- Pilgrimages to holy sites, circumambulations, sacred travels
- Extract: pilgrim(s), destination(s), route, duration, purpose
- Examples: "made pilgrimage to Bodhgaya", "circumambulated Mount Kailash"

**RETREAT** (མཚམས། / mtshams - solitary meditation retreat):
- Meditation retreats, solitary practice periods
- Extract: practitioner, location, duration, practice type, outcome
- Examples: "entered three-year retreat", "practiced Tummo for six months"

**TRANSMISSION** (བརྒྱུད་པ། / brgyud pa - lineage transmission):
- Formal transmission of teachings, lineages, practices
- Extract: master, disciple, teaching/lineage transmitted, location
- Examples: "transmitted the Six Yogas of Naropa", "received the Lamdre lineage"

**MEETING** (མཇལ་འཕྲད། / mjal 'phrad - significant encounters):
- Important meetings between masters, disciples, patrons
- Extract: participants, purpose, location, outcome
- Examples: "met the king and converted him", "first encounter with his guru"

**DEATH** (འདས་པ། / 'das pa - passing away):
- Death of significant figures, manner of death, signs
- Extract: person, date, location, age, circumstances, successors
- Examples: "passed away at age 84", "entered parinirvana displaying signs"

**BIRTH** (སྐྱེས་པ། / skyes pa):
- Birth of significant figures, miraculous signs
- Extract: person, date, location, parents, birth circumstances
- Examples: "born in the Wood-Dragon year", "born with auspicious signs"

**POLITICAL** (political events):
- Royal appointments, treaties, wars, edicts, state ceremonies
- Extract: rulers, officials, type of event, location, outcome
- Examples: "appointed as imperial preceptor", "treaty with Mongol emperor"

**NATURAL_DISASTER** (natural disasters affecting Buddhist institutions):
- Earthquakes, floods, fires, famines affecting monasteries/communities
- Extract: type of disaster, location, date, damage, response
- Examples: "earthquake destroyed the monastery", "fire consumed the library"

**ORDINATION** (ordination ceremonies):
- Monk/nun ordinations, taking vows
- Extract: ordinand, ordaining master, location, vow type (novice/full)
- Examples: "received full ordination from...", "took novice vows at age 12"

**ENTHRONEMENT** (enthronement ceremonies):
- Installation of abbots, recognition of tulkus
- Extract: person enthroned, position, location, date, presiding lamas
- Examples: "enthroned as abbot of Sakya", "recognized as incarnation of..."

═══════════════════════════════════════════════════════════════════════
EXTRACTION DETAILS FOR EACH EVENT
═══════════════════════════════════════════════════════════════════════

For EVERY event you extract, provide:

1. **EVENT TYPE** (one of the types above)

2. **DATE INFORMATION** (critical - extract ALL temporal clues):

   a) EXACT DATES:
      - Gregorian year: 1073
      - Tibetan calendar: "Iron-Tiger year" → calculate/note rabjung cycle
      - Include precision: "exact", "circa", "estimated", "disputed"

   b) RELATIVE DATES (when exact year unknown):
      - "after X died" → {"relative": "after PERSON_5 died"}
      - "during reign of King Y" → {"era": "reign of King Songtsen Gampo"}
      - "at age 40" → calculate from birth year if known
      - "in his youth" → {"relative": "youth of PERSON_3", "precision": "estimated"}
      - "before the monastery was founded" → {"relative": "before EVENT_7"}

   c) PARTIAL DATES:
      - Season: "in the summer of..." → {"season": "summer", "year": 1234}
      - Month: "in the third month" → note this
      - Duration from another event: "three years after..." → calculate or mark relative

3. **LOCATION**:
   - Place name (monastery, city, mountain, region)
   - Reference known place ID if available: "PLACE_3"
   - Extract hierarchy: "at Samye Monastery in Ü region"

4. **PARTICIPANTS** with roles:
   - Teacher/Master: who gave teaching/empowerment/transmission
   - Student/Disciple: who received
   - Organizer: who arranged the event
   - Sponsor: who funded (patrons, kings)
   - Attendees: audience size if mentioned ("attended by 1000 monks")
   - Witnesses: important observers

5. **DURATION** (if mentioned):
   - "3 days", "six months", "12 years", "from age 20 to 30"
   - Start and end dates if both given

6. **SIGNIFICANCE/OUTCOME**:
   - Why was this event important?
   - What resulted from it?
   - "This transmission founded the Kagyu lineage in Tibet"
   - "He attained realization during this retreat"

7. **RELATED TEXTS** (if applicable):
   - Texts taught during teachings
   - Texts composed during retreat
   - Texts revealed (terma discovery)
   - Example: "taught the Guhyasamaja Tantra", "composed commentary on..."

═══════════════════════════════════════════════════════════════════════
TEMPORAL EXPRESSION HANDLING
═══════════════════════════════════════════════════════════════════════

PAY SPECIAL ATTENTION to these temporal clues:

**REIGN-BASED DATES**:
"during the reign of King X" →
{
  "era": "reign of King Songtsen Gampo",
  "relative": "during reign of PERSON_12",
  "precision": "estimated",
  "confidence": 0.7
}

**EVENT-RELATIVE DATES**:
"after his teacher died" →
{
  "relative": "after PERSON_5 died",
  "precision": "estimated",
  "confidence": 0.8
}

**AGE-BASED DATES**:
"at age 40" + known birth year 1012 →
{
  "year": 1052,
  "precision": "estimated",
  "confidence": 0.7,
  "source": "calculated from birth year and age mentioned"
}

**TIBETAN CALENDAR DATES**:
"Iron-Tiger year" →
{
  "tibetanYear": {
    "rabjung": 16,
    "year": 47,
    "element": "metal",
    "animal": "tiger"
  },
  "year": 2010,
  "precision": "exact",
  "confidence": 0.9
}

**SEQUENTIAL EVENTS**:
"After receiving empowerment, he entered retreat for three years" →
Extract as TWO events with temporal link:
- EVENT_1: empowerment (date if known)
- EVENT_2: retreat (started after EVENT_1, duration "3 years")

═══════════════════════════════════════════════════════════════════════
OUTPUT FORMAT
═══════════════════════════════════════════════════════════════════════

Return ONLY valid JSON (no markdown, no extra text) in this structure:

{
  "events": [
    {
      "tempId": "EVENT_1",
      "type": "event",
      "canonicalName": "Brief descriptive name (e.g., 'Marpa's Journey to India', 'Founding of Sakya Monastery')",
      "names": {
        "tibetan": ["Tibetan name if mentioned"],
        "english": ["English name"],
        "phonetic": ["Phonetic rendering"],
        "wylie": ["Wylie transliteration"]
      },
      "attributes": {
        "eventType": "teaching|empowerment|debate|founding|pilgrimage|retreat|transmission|meeting|death|birth|political|natural_disaster|ordination|enthronement",
        "location": "PLACE_3 or place name",
        "duration": "3 years",
        "significance": "Why this event matters",
        "description": "Detailed description of what happened",
        "attendeeCount": 1000,
        "outcome": "Result of the event"
      },
      "dates": {
        "occurred": {
          "year": 1073,
          "tibetanYear": {
            "rabjung": 1,
            "year": 13,
            "element": "water",
            "animal": "ox"
          },
          "era": "during reign of...",
          "relative": "after X died",
          "season": "summer",
          "precision": "exact|circa|estimated|disputed|unknown",
          "source": "Where this date comes from",
          "confidence": 0.85
        },
        "started": { /* for events with duration */ },
        "ended": { /* for events with duration */ }
      },
      "confidence": 0.9,
      "extractionReason": "Explicitly described as 'the great debate at Samye'"
    }
  ],
  "participants": [
    {
      "eventId": "EVENT_1",
      "participantId": "PERSON_3 or person name if not in known list",
      "role": "teacher|student|organizer|sponsor|attendee|recipient",
      "sourceQuote": "exact text showing participation"
    }
  ],
  "relatedTexts": [
    {
      "eventId": "EVENT_1",
      "textId": "TEXT_5 or text title",
      "relationship": "taught|composed|revealed|received_transmission",
      "sourceQuote": "exact text mentioning this"
    }
  ],
  "ambiguities": [
    "Date uncertain - text says 'many years later' but no specific year",
    "Location might be Samye or Lhodrak - text unclear"
  ]
}

═══════════════════════════════════════════════════════════════════════
CRITICAL RULES
═══════════════════════════════════════════════════════════════════════

1. **TEMPORAL PRECISION**:
   - ALWAYS extract date information, even if relative/vague
   - Use "relative" field for expressions like "after X", "during Y's reign"
   - Set precision accurately: exact/circa/estimated/disputed/unknown
   - Adjust confidence based on date certainty

2. **MULTIPLE EVENT DETECTION**:
   - A single sentence might describe multiple events
   - "He received empowerment, then taught for three years, then entered retreat"
     → Extract THREE events with temporal sequence

3. **PARTICIPANT ROLES**:
   - Clearly distinguish roles: teacher vs. student, organizer vs. sponsor
   - Same person can have multiple roles: "X organized and sponsored the teaching"

4. **SIGNIFICANCE**:
   - Extract why the event matters historically
   - Include outcomes: "This debate led to the king favoring Buddhism"

5. **CONSERVATIVE EXTRACTION**:
   - Only extract events explicitly mentioned or strongly implied
   - Don't invent details not in the text
   - Use confidence scores to reflect uncertainty

6. **EVIDENCE**:
   - Include sourceQuote for participant relationships
   - Include extractionReason explaining your interpretation

7. **TEMPORAL CHAINS**:
   - When events are described in sequence, preserve that ordering
   - Use relative dates to link events: "after EVENT_1"

8. **CROSS-REFERENCES**:
   - Reference known person/place IDs when possible
   - If entity not in known list, include name and mark for later resolution

Now extract ALL events from the provided text. Return ONLY the JSON output.`;
}

/**
 * Simplified event extraction for testing
 */
export function buildSimpleEventExtractionPrompt(text: string): string {
  return `Extract significant EVENTS from this Tibetan Buddhist text.

TEXT:
${text}

Extract events like: teachings, empowerments, debates, monastery foundings, pilgrimages, retreats, transmissions, births, deaths.

For each event provide:
- Event type
- Date (exact year or relative like "after X died")
- Location
- Participants and their roles
- Duration if mentioned
- Significance

Return JSON:
{
  "events": [
    {
      "tempId": "EVENT_1",
      "type": "event",
      "canonicalName": "Brief name",
      "attributes": {
        "eventType": "teaching|empowerment|...",
        "location": "place name",
        "duration": "3 years",
        "significance": "why important"
      },
      "dates": {
        "occurred": {
          "year": 1073,
          "precision": "exact|circa|estimated",
          "confidence": 0.8
        }
      },
      "confidence": 0.9
    }
  ],
  "participants": [
    {
      "eventId": "EVENT_1",
      "participantId": "person name",
      "role": "teacher|student|sponsor|...",
      "sourceQuote": "..."
    }
  ]
}

Only extract events explicitly mentioned. Use confidence scores for uncertain dates.`;
}

/**
 * Focused extraction for specific event types
 */
export function buildEventTypeExtractionPrompt(
  text: string,
  eventTypes: string[]
): string {
  const typeList = eventTypes.join(', ');

  return `Extract ONLY these event types from the text: ${typeList}

TEXT:
${text}

For each event:
- Identify the type
- Extract date (exact or relative)
- Extract location
- Extract participants with roles
- Extract significance/outcome

Return JSON with events array matching the standard event schema.

Focus on quality over quantity - only extract events that are clearly described.`;
}

/**
 * Temporal relationship extraction between events
 */
export function buildEventTemporalExtractionPrompt(
  text: string,
  knownEvents: Array<{ id: string; name: string; date?: string }>
): string {
  const eventList = knownEvents
    .map(e => `- ${e.id}: ${e.name}${e.date ? ` (${e.date})` : ''}`)
    .join('\n');

  return `Given these known events, extract temporal relationships between them.

KNOWN EVENTS:
${eventList}

TEXT:
${text}

Find temporal clues like:
- "X happened before Y"
- "During event X, person did Y"
- "Three years after X, event Y occurred"
- "While at retreat (EVENT_1), he received visitors (EVENT_2)"

Return JSON:
{
  "temporalRelationships": [
    {
      "event1Id": "EVENT_1",
      "event2Id": "EVENT_2",
      "relationship": "before|after|during|concurrent_with",
      "timeDifference": "3 years",
      "confidence": 0.85,
      "sourceQuote": "exact text showing relationship"
    }
  ]
}`;
}
