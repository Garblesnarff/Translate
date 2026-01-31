# Relationship Types Reference

This document defines all relationship types (predicates) in the knowledge graph with examples and extraction patterns.

---

## Relationship Schema

```typescript
interface Relationship {
  subject: Entity;      // The "doer" or source
  predicate: string;    // The relationship type
  object: Entity;       // The "receiver" or target
  properties: {         // Additional context
    date?: DateInfo;
    location?: string;  // Place ID
    teaching?: string;
    duration?: string;
    role?: string;
    notes?: string;
  };
  confidence: number;
  sourceQuote: string;  // Text showing this relationship
}
```

---

## 1. Teacher-Student Relationships

### `teacher_of`
**Subject**: Person (teacher)
**Object**: Person (student)
**Direction**: Teacher → Student

**Properties**:
- `date`: When teaching occurred
- `location`: Where teaching occurred
- `teaching`: What was taught (e.g., "Mahamudra")
- `duration`: Length of study

**Text Patterns**:
- "X taught Y"
- "Y studied under X"
- "Y was a disciple of X"
- "Y received teachings from X"
- "X transmitted the lineage to Y"

**Examples**:
```typescript
{
  subject: 'Marpa',
  predicate: 'teacher_of',
  object: 'Milarepa',
  properties: {
    date: { year: 1055, precision: 'circa' },
    location: 'Lhodrak',
    teaching: 'Hevajra Tantra',
    duration: '12 years'
  },
  sourceQuote: 'Milarepa studied under Marpa for twelve years at Lhodrak'
}
```

---

### `student_of`
**Subject**: Person (student)
**Object**: Person (teacher)
**Direction**: Student → Teacher

**Note**: Inverse of `teacher_of`. We store both directions for easier querying.

**Text Patterns**:
- "X studied under Y"
- "X was a student of Y"
- "X received teachings from Y"

---

## 2. Incarnation Relationships

### `incarnation_of`
**Subject**: Person (later incarnation)
**Object**: Person (previous incarnation)
**Direction**: Later → Earlier

**Properties**:
- `lineage`: Lineage name (e.g., "Karmapa lineage")
- `position`: Position in lineage (e.g., 16)
- `recognition_date`: When recognized
- `recognized_by`: Who confirmed the incarnation

**Text Patterns**:
- "X is the reincarnation of Y"
- "X is the tulku of Y"
- "X is recognized as Y's rebirth"
- "the Nth incarnation of Y"

**Examples**:
```typescript
{
  subject: '16th Karmapa (Rangjung Rigpe Dorje)',
  predicate: 'incarnation_of',
  object: '15th Karmapa (Khakhyab Dorje)',
  properties: {
    lineage: 'Karma Kagyu Golden Rosary',
    position: 16,
    recognition_date: { year: 1924 }
  }
}
```

---

## 3. Authorship Relationships

### `wrote`
**Subject**: Person (author)
**Object**: Text
**Direction**: Author → Text

**Properties**:
- `date`: When composed
- `location`: Where composed
- `language`: Original language
- `commissioned_by`: Patron who requested

**Text Patterns**:
- "X wrote Y"
- "X composed Y"
- "X authored Y"
- "Y was written by X"
- "Y is attributed to X"

**Examples**:
```typescript
{
  subject: 'Tsongkhapa',
  predicate: 'wrote',
  object: 'Lamrim Chenmo',
  properties: {
    date: { year: 1402, precision: 'exact' },
    location: 'Reting Monastery'
  }
}
```

---

### `translated`
**Subject**: Person (translator)
**Object**: Text
**Direction**: Translator → Text

**Properties**:
- `from_language`: Original language (Sanskrit, Chinese, etc.)
- `to_language`: Target language (usually Tibetan)
- `date`: When translated
- `location`: Where translation occurred
- `collaborated_with`: Co-translators

**Text Patterns**:
- "X translated Y from Sanskrit"
- "Y was translated by X"
- "X rendered Y into Tibetan"

**Examples**:
```typescript
{
  subject: 'Marpa Lotsawa',
  predicate: 'translated',
  object: 'Hevajra Tantra',
  properties: {
    from_language: 'Sanskrit',
    to_language: 'Tibetan',
    date: { year: 1070, precision: 'circa' },
    location: 'Tibet'
  }
}
```

---

## 4. Spatial Relationships

### `lived_at`
**Subject**: Person
**Object**: Place
**Direction**: Person → Place

**Properties**:
- `start_date`: When residence began
- `end_date`: When residence ended
- `role`: Abbot, resident monk, retreatant
- `duration`: Total time lived there

**Text Patterns**:
- "X lived at Y"
- "X resided at Y"
- "X was abbot of Y"
- "X spent N years at Y"

**Examples**:
```typescript
{
  subject: 'Sachen Kunga Nyingpo',
  predicate: 'lived_at',
  object: 'Sakya Monastery',
  properties: {
    start_date: { year: 1092 },
    end_date: { year: 1158 },
    role: 'abbot and teacher'
  }
}
```

---

### `visited`
**Subject**: Person
**Object**: Place
**Direction**: Person → Place

**Properties**:
- `date`: When visited
- `duration`: Length of visit
- `purpose`: Reason for visit (pilgrimage, teaching, retreat)
- `companions`: Who traveled with them

**Text Patterns**:
- "X visited Y"
- "X traveled to Y"
- "X made a pilgrimage to Y"
- "X went to Y to [purpose]"

---

### `founded`
**Subject**: Person
**Object**: Place or Institution
**Direction**: Founder → Founded

**Properties**:
- `date`: When founded
- `co_founders`: Other founders
- `sponsored_by`: Patron who funded
- `reason`: Purpose of founding

**Text Patterns**:
- "X founded Y"
- "X established Y"
- "Y was founded by X"
- "X built Y"

**Examples**:
```typescript
{
  subject: 'Khön Könchok Gyalpo',
  predicate: 'founded',
  object: 'Sakya Monastery',
  properties: {
    date: { year: 1073, precision: 'exact' },
    reason: 'To establish a center for Buddhist teachings'
  }
}
```

---

## 5. Textual Relationships

### `commentary_on`
**Subject**: Text (commentary)
**Object**: Text (root text)
**Direction**: Commentary → Root Text

**Properties**:
- `commentary_type`: 'word commentary', 'meaning commentary', 'extensive', 'concise'
- `tradition`: Which school's interpretation

**Text Patterns**:
- "X is a commentary on Y"
- "X explains Y"
- "X elucidates Y"

**Examples**:
```typescript
{
  subject: 'Madhyamakavatara (Chandrakirti)',
  predicate: 'commentary_on',
  object: 'Mulamadhyamakakarika (Nagarjuna)',
  properties: {
    commentary_type: 'extensive commentary',
    tradition: 'Madhyamaka'
  }
}
```

---

### `cites`
**Subject**: Text
**Object**: Text
**Direction**: Citing Text → Cited Text

**Properties**:
- `page`: Where citation appears
- `context`: Why cited (support, critique, explanation)

**Text Patterns**:
- "X quotes Y"
- "X cites Y"
- "X references Y"
- "As stated in Y..."

---

### `part_of`
**Subject**: Text (sub-text)
**Object**: Text (collection)
**Direction**: Part → Whole

**Properties**:
- `volume`: Volume number
- `chapter`: Chapter/section number
- `page_range`: Page numbers in collection

**Text Patterns**:
- "X is part of Y"
- "X appears in Y"
- "X is included in Y"

**Examples**:
```typescript
{
  subject: 'Prajnaparamita Heart Sutra',
  predicate: 'part_of',
  object: 'Kangyur',
  properties: {
    volume: 34,
    chapter: 'Prajnaparamita Section'
  }
}
```

---

## 6. Event Participation

### `attended`
**Subject**: Person
**Object**: Event
**Direction**: Person → Event

**Properties**:
- `role`: 'teacher', 'student', 'sponsor', 'attendee', 'organizer'
- `contribution`: What they did at the event

**Text Patterns**:
- "X attended Y"
- "X was present at Y"
- "X participated in Y"
- "X gave teachings at Y"

**Examples**:
```typescript
{
  subject: 'Sakya Pandita',
  predicate: 'attended',
  object: 'Meeting with Godan Khan (1244)',
  properties: {
    role: 'teacher and negotiator',
    contribution: 'Established Tibetan-Mongol relations'
  }
}
```

---

## 7. Institutional Relationships

### `member_of`
**Subject**: Person
**Object**: Institution
**Direction**: Person → Institution

**Properties**:
- `rank`: 'abbot', 'senior monk', 'student', 'patron'
- `start_date`: When membership began
- `end_date`: When membership ended

**Text Patterns**:
- "X was a monk at Y"
- "X served as abbot of Y"
- "X belonged to Y"

---

### `patron_of`
**Subject**: Person (patron)
**Object**: Person, Institution, or Text
**Direction**: Patron → Beneficiary

**Properties**:
- `support_type`: 'financial', 'political', 'material'
- `date`: When patronage occurred
- `contribution`: What was provided

**Text Patterns**:
- "X sponsored Y"
- "X supported Y"
- "X patronized Y"
- "Y was supported by X"

**Examples**:
```typescript
{
  subject: 'Kublai Khan',
  predicate: 'patron_of',
  object: 'Phagpa',
  properties: {
    support_type: 'political and financial',
    date: { year: 1260, precision: 'circa' },
    contribution: 'Appointed as Imperial Preceptor'
  }
}
```

---

## 8. Conceptual Relationships

### `practiced`
**Subject**: Person
**Object**: Concept (meditation practice)
**Direction**: Person → Practice

**Properties**:
- `duration`: How long practiced
- `location`: Where practiced
- `achievement`: Results attained

**Text Patterns**:
- "X practiced Y"
- "X meditated on Y"
- "X realized Y through practice"

---

### `held_view`
**Subject**: Person
**Object**: Concept (philosophical view)
**Direction**: Person → View

**Properties**:
- `confidence`: How strongly held
- `school`: Which tradition's interpretation

**Text Patterns**:
- "X believed Y"
- "X held the view of Y"
- "X taught Y"

---

## 9. Temporal Relationships

### `preceded`
**Subject**: Event
**Object**: Event
**Direction**: Earlier Event → Later Event

**Properties**:
- `interval`: Time between events
- `causal`: Whether first event caused second

**Text Patterns**:
- "After X, then Y"
- "Following X..."
- "X occurred before Y"

---

### `contemporary_with`
**Subject**: Person
**Object**: Person
**Direction**: Bidirectional

**Properties**:
- `overlap_period`: Years when both were alive
- `met`: Whether they actually met
- `location`: Where they might have overlapped

**Text Patterns**:
- "X and Y lived at the same time"
- "X was a contemporary of Y"
- "During X's time, Y was also..."

---

## 10. Lineage Relationships

### `received_transmission`
**Subject**: Person (receiver)
**Object**: Person (transmitter)
**Direction**: Receiver → Transmitter

**Properties**:
- `teaching`: What was transmitted
- `lineage`: Lineage name
- `date`: When transmission occurred
- `location`: Where it occurred
- `event_id`: Associated event

**Text Patterns**:
- "X received [teaching] from Y"
- "Y transmitted [teaching] to X"
- "X obtained [teaching] from Y"

---

### `gave_empowerment`
**Subject**: Person (lama)
**Object**: Person (recipient)
**Direction**: Giver → Receiver

**Properties**:
- `empowerment`: Name of empowerment (wang)
- `deity`: Associated deity
- `date`: When given
- `location`: Where given

**Text Patterns**:
- "X gave [empowerment] to Y"
- "Y received [empowerment] from X"
- "X bestowed [empowerment] upon Y"

---

## 11. Debate & Opposition

### `debated_with`
**Subject**: Person
**Object**: Person
**Direction**: Bidirectional

**Properties**:
- `topic`: Subject of debate
- `date`: When debate occurred
- `location`: Where debate occurred
- `outcome`: Who won (if recorded)

**Text Patterns**:
- "X debated with Y"
- "X and Y engaged in debate"
- "X challenged Y on [topic]"

---

### `refuted`
**Subject**: Person or Text
**Object**: Concept or Text
**Direction**: Refuter → Refuted

**Properties**:
- `reasoning`: Basis for refutation
- `text`: Where refutation appears

**Text Patterns**:
- "X refuted Y"
- "X criticized Y"
- "X challenged Y"

---

## 12. Family Relationships

### `parent_of` / `child_of`
**Subject**: Person (parent)
**Object**: Person (child)
**Direction**: Parent → Child

---

### `sibling_of`
**Subject**: Person
**Object**: Person
**Direction**: Bidirectional

---

### `spouse_of`
**Subject**: Person
**Object**: Person
**Direction**: Bidirectional

**Examples**:
```typescript
{
  subject: 'Sachen Kunga Nyingpo',
  predicate: 'parent_of',
  object: 'Sönam Tsemo',
  properties: {
    relationship: 'father-son',
    also_relationship: 'teacher-student'
  }
}
```

---

## 13. Geographic Relationships

### `within`
**Subject**: Place (smaller)
**Object**: Place (larger)
**Direction**: Part → Whole

**Properties**:
- `relationship_type`: 'monastery in region', 'cave on mountain', 'city in country'

**Text Patterns**:
- "X is in Y"
- "X is located in Y"
- "X is part of Y"

**Examples**:
```typescript
{
  subject: 'Sakya Monastery',
  predicate: 'within',
  object: 'Tsang region',
  properties: {
    relationship_type: 'monastery in region'
  }
}

{
  subject: 'Tsang region',
  predicate: 'within',
  object: 'Tibet',
  properties: {
    relationship_type: 'region in country'
  }
}
```

---

## Extraction Priority by Relationship Type

**Critical** (extract first):
1. `teacher_of` / `student_of` - core lineage relationships
2. `wrote` / `translated` - authorship
3. `lived_at` - geographic context
4. `founded` - institutional history

**Important** (extract second):
5. `incarnation_of` - lineage continuity
6. `commentary_on` / `cites` - intellectual genealogy
7. `attended` - event participation
8. `received_transmission` - teaching transmission

**Valuable** (extract third):
9. `patron_of` - political/economic context
10. `member_of` - institutional affiliation
11. `debated_with` - intellectual debates
12. `practiced` / `held_view` - doctrinal positions

**Optional** (extract if time):
13. Family relationships (unless historically significant)
14. `contemporary_with` (can be inferred from dates)
15. `visited` (unless significant pilgrimage)

---

## Confidence Scoring for Relationships

**High Confidence (0.8-1.0)**:
- Direct quotes: "Milarepa studied under Marpa"
- Explicit statements with details
- Multiple sources confirm
- Clear temporal/spatial context

**Medium Confidence (0.5-0.8)**:
- Implied relationships: "his teacher" (need to resolve "his")
- Single source only
- Vague temporal context: "later in life"
- Common knowledge but not explicitly stated in this text

**Low Confidence (0.3-0.5)**:
- Ambiguous references: "the master taught him"
- Conflicting sources
- Indirect evidence only
- Needs human review

**Very Low Confidence (<0.3)**:
- Speculation: "probably studied with"
- Extremely ambiguous
- Should not be stored without human verification

---

## Common Extraction Challenges

### 1. Pronoun Resolution
**Problem**: "He taught him at the monastery"
**Solution**: Link to most recent entities by type, note low confidence

### 2. Implicit Relationships
**Problem**: "Marpa's student, Milarepa..."
**Solution**: Extract even though not explicit: `Marpa teacher_of Milarepa`

### 3. Temporal Ambiguity
**Problem**: "He later visited..."
**Solution**: Use relative dates: `{relative: "after receiving teachings"}`

### 4. Multiple Relationships
**Problem**: "Sachen taught his son Sönam..."
**Solution**: Extract both: `parent_of` AND `teacher_of`

### 5. Relationship Direction
**Problem**: "The text by Nagarjuna was commented on by Chandrakirti"
**Solution**: Standardize direction: `Chandrakirti commentary_on Nagarjuna's_text`

---

## Validation Rules

**Required for all relationships**:
- `subject_id` must reference valid entity
- `object_id` must reference valid entity
- `predicate` must be from allowed list
- `confidence` between 0.0 and 1.0
- `source_quote` should be provided when possible

**Type constraints**:
- `teacher_of`: subject and object must be Person
- `commentary_on`: subject and object must be Text
- `within`: subject and object must be Place
- `wrote`: subject must be Person, object must be Text

**Logical constraints**:
- Person cannot be `teacher_of` themselves
- Text cannot be `part_of` itself
- Place cannot be `within` itself
- Dates should be chronologically consistent

---

*This reference should guide extraction prompt design and relationship validation logic.*
