# Entity Types Reference

This document defines all entity types in the knowledge graph with their attributes, examples, and extraction guidelines.

---

## 1. Person (རྒྱལ་པོ།, བླ་མ།, སློབ་མ།)

**Description**: Teachers, students, translators, patrons, scholars, practitioners, historical figures

**Key Attributes**:
```typescript
{
  type: 'person',
  names: {
    tibetan: ['མར་པ།', 'མར་པ་ལོ་ཙཱ་བ།'],
    english: ['Marpa', 'Marpa Lotsawa', 'Marpa the Translator'],
    phonetic: ['Mar-pa'],
    wylie: ['mar pa', 'mar pa lo tsA ba'],
    sanskrit: [], // if applicable
    chinese: []  // if applicable
  },
  attributes: {
    titles: ['Lotsawa', 'Mahaguru', 'Rinpoche'],
    honorifics: ['རྗེ་བཙུན།', 'རིན་པོ་ཆེ།'],
    epithets: ['The Great Translator', 'Father of the Kagyu'],
    roles: ['teacher', 'translator', 'yogi', 'abbot', 'patron', 'scholar'],
    affiliations: ['Kagyu Lineage', 'Sakya Monastery'],
    gender: 'male' | 'female' | 'unknown',
    tradition: ['Kagyu', 'Nyingma', 'Sakya', 'Gelug', 'Bon', 'Rimé'],
    biography: 'Brief summary of life and achievements'
  },
  dates: {
    birth: { year: 1012, precision: 'estimated', confidence: 0.8 },
    death: { year: 1097, precision: 'estimated', confidence: 0.8 },
    ordination: { year: 1030, precision: 'circa', confidence: 0.6 },
    enthronement: { year: 1055, precision: 'estimated', confidence: 0.7 }
  }
}
```

**Common Relationships**:
- `teacher_of` → Person
- `student_of` → Person
- `incarnation_of` → Person
- `wrote` → Text
- `translated` → Text
- `lived_at` → Place
- `visited` → Place
- `founded` → Institution
- `member_of` → Institution
- `patron_of` → Person/Institution/Text

**Examples**:
- Marpa Lotsawa (1012-1097) - translator, teacher
- Yeshe Tsogyal (757-817) - consort of Padmasambhava, teacher
- Sakya Pandita (1182-1251) - scholar, author, political figure
- Milarepa (1052-1135) - yogi, poet, teacher

**Extraction Guidelines**:
- Always extract all name variants (critical for duplicate detection)
- Note gender if mentioned (important for research on female teachers)
- Extract roles even if informal (e.g., "the yogi" = role: yogi)
- Link to places where they lived/taught
- Note tradition affiliation carefully (some belong to multiple)

---

## 2. Place (གནས་, དགོན་པ།, རི།)

**Description**: Monasteries, mountains, caves, regions, cities, holy sites, geographical locations

**Key Attributes**:
```typescript
{
  type: 'place',
  names: {
    tibetan: ['ས་སྐྱ།', 'ས་སྐྱ་དགོན་པ།'],
    english: ['Sakya', 'Sakya Monastery'],
    phonetic: ['Sa-kya'],
    wylie: ['sa skya', 'sa skya dgon pa']
  },
  attributes: {
    placeType: 'monastery' | 'mountain' | 'cave' | 'city' | 'region' | 'country' | 'holy_site' | 'hermitage',
    coordinates: {
      latitude: 28.9014,
      longitude: 88.0234,
      accuracy: 100 // meters
    },
    region: 'Tsang',
    modernCountry: 'China (Tibet Autonomous Region)',
    parent: 'place_id_of_tsang_region', // hierarchical relationship
    significance: ['Seat of Sakya tradition', 'Major pilgrimage site'],
    description: 'Founded in 1073, headquarters of Sakya school'
  },
  dates: {
    founded: { year: 1073, precision: 'exact', confidence: 0.95 },
    destroyed: { year: 1960, precision: 'circa', confidence: 0.9 },
    rebuilt: { year: 1985, precision: 'exact', confidence: 1.0 }
  }
}
```

**Common Relationships**:
- `within` → Place (geographic hierarchy)
- `founded_by` ← Person
- `associated_with` → Deity/Concept

**Examples**:
- Sakya Monastery (ས་སྐྱ་དགོན་པ།) - monastery
- Mount Kailash (ག་ང་རིན་པོ་ཆེ།) - sacred mountain
- Tsurphu Monastery (མཚུར་ཕུ།) - seat of Karmapa
- Lhasa (ལྷ་ས།) - city
- Kham (ཁམས།) - region
- India (རྒྱ་གར།) - country

**Extraction Guidelines**:
- Build geographic hierarchies (cave → mountain → region → country)
- Extract coordinates for modern-identifiable locations
- Note multiple names (historical vs. modern)
- Link to founding events and founders
- Track destruction/reconstruction history

---

## 3. Text (གཞུང་།, བཀའ་འབུམ།, མདོ།, རྒྱུད།)

**Description**: Sutras, tantras, commentaries, biographies, poetry, letters, rituals, treatises, histories

**Key Attributes**:
```typescript
{
  type: 'text',
  names: {
    tibetan: ['རྒྱ་ཆེར་རོལ་པ།'],
    english: ['Lalitavistara Sutra', 'The Play in Full'],
    phonetic: ['Gyacher Rolpa'],
    wylie: ['rgya cher rol pa'],
    sanskrit: ['Lalitavistara']
  },
  attributes: {
    textType: 'sutra' | 'tantra' | 'commentary' | 'biography' | 'poetry' | 'letters' | 'ritual' | 'philosophical_treatise' | 'history',
    language: 'Tibetan' | 'Sanskrit' | 'Chinese' | 'Pali',
    volumeCount: 1,
    pageCount: 350,
    topics: ['Buddha\'s life', 'Mahayana doctrine'],
    practices: ['visualization', 'recitation'],
    collectionId: 'kangyur_id', // if part of larger collection
    tibetanCanonSection: 'Kangyur - Sutra Section'
  },
  dates: {
    composed: { year: 200, precision: 'estimated', confidence: 0.6 },
    translated: { year: 850, precision: 'circa', confidence: 0.7 },
    printed: { year: 1730, precision: 'exact', confidence: 0.95 }
  }
}
```

**Common Relationships**:
- `written_by` ← Person
- `translated_by` ← Person
- `commentary_on` → Text
- `commented_by` ← Text
- `cites` → Text
- `cited_by` ← Text
- `part_of` → Text (collection)
- `contains` ← Text (sub-texts)
- `mentions` → Person/Place/Concept/Deity

**Examples**:
- Prajnaparamita Sutras (ཤེར་ཕྱིན།) - sutra
- Hevajra Tantra (ཀྱེ་རྡོ་རྗེ་རྒྱུད།) - tantra
- Blue Annals (དེབ་ཐེར་སྔོན་པོ།) - history
- Life of Milarepa (རྗེ་བཙུན་མི་ལའི་རྣམ་ཐར།) - biography
- Bodhicaryavatara (བྱང་ཆུབ་སེམས་དཔའི་སྤྱོད་པ་ལ་འཇུག་པ།) - philosophical treatise

**Extraction Guidelines**:
- Extract full and abbreviated titles
- Note if translated (from which language, by whom)
- Link to authors, translators, commentators
- Identify genre/type carefully
- Track citation networks (which texts reference which)
- Extract collection membership (e.g., Tengyur volume 45)

---

## 4. Event (ལོ་རྒྱུས།, སྐབས།)

**Description**: Teachings, empowerments, debates, foundings, retreats, meetings, deaths, births, transmissions

**Key Attributes**:
```typescript
{
  type: 'event',
  names: {
    tibetan: ['རང་བྱུང་རྡོ་རྗེའི་དབང་བསྐུར།'],
    english: ['Rangjung Dorje\'s Empowerment at Tsurphu'],
    phonetic: ['Rangjung Dorje\'i Wang Kur']
  },
  attributes: {
    eventType: 'teaching' | 'empowerment' | 'debate' | 'founding' | 'pilgrimage' | 'retreat' | 'death' | 'birth' | 'transmission' | 'political' | 'natural_disaster' | 'meeting',
    location: 'place_id_of_tsurphu',
    duration: '7 days',
    significance: 'Major transmission of Kagyu teachings',
    description: 'Third Karmapa gave Hevajra empowerment to 500 monks',
    attendeeCount: 500
  },
  dates: {
    occurred: { year: 1350, precision: 'circa', confidence: 0.75 },
    started: { year: 1350, precision: 'circa', confidence: 0.75 },
    ended: { year: 1350, precision: 'circa', confidence: 0.75 }
  }
}
```

**Common Relationships**:
- `occurred_at` → Place
- `attended_by` ← Person (with role: teacher/student/sponsor)
- `transmitted` → Text (if teaching)
- `followed_by` → Event (sequential events)
- `caused` → Event (causal relationships)

**Examples**:
- Founding of Sakya Monastery (1073)
- Marpa receiving Hevajra teachings from Naropa
- Great Debate of Samye (792-794)
- Milarepa's 12-year retreat
- Death of Tsongkhapa (1419)

**Extraction Guidelines**:
- Extract participants with roles (teacher, student, sponsor, attendee)
- Link to location precisely
- Handle date ranges (start and end for long events)
- Note significance/outcome when mentioned
- Connect to related texts (e.g., teaching about X text)
- Track sequential events ("After this, he traveled to...")

---

## 5. Concept (ཆོས།, རྩོད་གཞི།, ལྟ་བ།)

**Description**: Philosophical views, meditation practices, deities, doctrines, technical terms

**Key Attributes**:
```typescript
{
  type: 'concept',
  names: {
    tibetan: ['སྟོང་པ་ཉིད།'],
    english: ['Emptiness', 'Voidness', 'Sunyata'],
    wylie: ['stong pa nyid'],
    sanskrit: ['śūnyatā']
  },
  attributes: {
    conceptType: 'philosophical_view' | 'meditation_practice' | 'deity' | 'doctrine' | 'technical_term',
    definitions: [
      {
        text: 'Absence of inherent existence',
        source: 'text_id_of_madhyamakavatara',
        author: 'person_id_of_chandrakirti',
        school: 'Madhyamaka'
      },
      {
        text: 'Union of appearance and emptiness',
        source: 'text_id_of_mahamudra_text',
        author: 'person_id_of_gampopa',
        school: 'Kagyu'
      }
    ],
    relatedConcepts: {
      broader: ['concept_id_of_two_truths'], // parent concepts
      narrower: ['concept_id_of_emptiness_of_self'], // sub-concepts
      related: ['concept_id_of_dependent_origination'], // associated
      contradicts: ['concept_id_of_eternalism'] // opposing views
    }
  }
}
```

**Common Relationships**:
- `related_to` → Concept
- `practiced_by` ← Person
- `taught_at` ← Institution
- `debated_in` ← Event

**Examples**:
**Philosophical Views**:
- Emptiness (སྟོང་པ་ཉིད།)
- Buddha-nature (བདེ་གཤེགས་སྙིང་པོ།)
- Two Truths (བདེན་པ་གཉིས།)

**Practices**:
- Mahamudra (ཕྱག་རྒྱ་ཆེན་པོ།)
- Dzogchen (རྫོགས་ཆེན།)
- Shamatha (ཞི་གནས།)
- Vipashyana (ལྷག་མཐོང་།)

**Deities**:
- Chenrezig (སྤྱན་རས་གཟིགས།) - Avalokiteshvara
- Tara (སྒྲོལ་མ།)
- Vajrayogini (རྡོ་རྗེ་རྣལ་འབྱོར་མ།)
- Manjushri (འཇམ་དཔལ་དབྱངས།)

**Extraction Guidelines**:
- Always extract Tibetan term exactly as written
- Note Sanskrit equivalents when given
- Extract multiple definitions (may vary by school)
- Track school-specific interpretations
- Build concept hierarchies (emptiness > emptiness of self)
- Link to practitioners and texts teaching the concept
- Note contradictory views (philosophical debates)

---

## 6. Institution (སྡེ།, གྲྭ་ཚང་།)

**Description**: Monasteries, colleges, hermitages, temples, libraries, government bodies

**Key Attributes**:
```typescript
{
  type: 'institution',
  names: {
    tibetan: ['ས་སྐྱ་དགོན་པ།'],
    english: ['Sakya Monastery', 'Sakya Gompa']
  },
  attributes: {
    institutionType: 'monastery' | 'college' | 'hermitage' | 'temple' | 'printing_house' | 'library' | 'government',
    location: 'place_id_of_sakya',
    tradition: ['Sakya'], // can be multiple
    founded: { year: 1073, precision: 'exact', confidence: 0.95 },
    founder: ['person_id_of_khon_konchok_gyalpo'],
    hierarchy: {
      parent: null, // seat monastery
      subsidiaries: ['institution_id_of_branch1', 'institution_id_of_branch2']
    },
    history: {
      abbots: [
        {
          person: 'person_id_of_sachen_kunga_nyingpo',
          startDate: { year: 1092, precision: 'estimated' },
          endDate: { year: 1158, precision: 'estimated' }
        }
      ],
      majorEvents: ['event_id_of_founding', 'event_id_of_expansion'],
      textualProductions: ['text_id_1', 'text_id_2'] // texts written/printed here
    }
  }
}
```

**Common Relationships**:
- `located_at` → Place
- `founded_by` ← Person
- `parent_of` → Institution
- `subsidiary_of` ← Institution
- `produced` → Text
- `resident` ← Person (with dates)

**Examples**:
- Sakya Monastery (ས་སྐྱ་དགོན་པ།) - seat of Sakya tradition
- Nalanda University (ནཱ་ལེནྡྲ།) - ancient Buddhist university
- Tsurphu Monastery (མཚུར་ཕུ།) - seat of Karmapa
- Sera Monastery (སེ་ར།) - major Gelug monastery
- Derge Parkhang (སྡེ་དགེ་པར་ཁང་།) - famous printing house

**Extraction Guidelines**:
- Distinguish from Place (institution vs. physical location)
- Track institutional hierarchy (headquarters, branches)
- Link to tradition/school affiliation
- Record succession of abbots/leaders
- Note text production (important for intellectual history)
- Track major events (foundings, destructions, reforms)

---

## 7. Lineage (བརྒྱུད་པ།)

**Description**: Chains of transmission for teachings, incarnation lines, family lineages, institutional successions

**Key Attributes**:
```typescript
{
  type: 'lineage',
  name: 'Karma Kagyu Golden Rosary',
  tibetanName: 'ཀརྨ་བཀའ་བརྒྱུད་གསེར་ཕྲེང་།',
  lineageType: 'incarnation' | 'transmission' | 'ordination' | 'family' | 'institutional',
  tradition: 'Kagyu',
  teaching: 'Mahamudra teachings',
  originText: 'text_id_of_mahamudra_root_text',
  originDate: { year: 1050, precision: 'circa', confidence: 0.7 },
  chain: [
    {
      position: 1,
      personId: 'person_id_of_tilopa',
      receivedFrom: null, // first in lineage
      transmittedTo: ['person_id_of_naropa'],
      date: { year: 1000, precision: 'circa', confidence: 0.6 },
      location: 'place_id_of_india',
      notes: 'Received directly from Vajradhara'
    },
    {
      position: 2,
      personId: 'person_id_of_naropa',
      receivedFrom: 'person_id_of_tilopa',
      transmittedTo: ['person_id_of_marpa'],
      date: { year: 1040, precision: 'circa', confidence: 0.7 }
    },
    // ... continues
  ],
  branches: ['lineage_id_of_drikung_kagyu', 'lineage_id_of_drukpa_kagyu']
}
```

**Common Relationships**:
- `link` → Person (lineage holder)
- `branched_from` ← Lineage (lineage splits)
- `transmitted_through` → Place (where transmission occurred)

**Examples**:
**Incarnation Lineages**:
- Dalai Lamas (14 incarnations)
- Karmapas (17 incarnations)
- Panchen Lamas (11 incarnations)

**Transmission Lineages**:
- Kagyu Mahamudra lineage (Tilopa → Naropa → Marpa → Milarepa → Gampopa)
- Sakya Lamdre lineage
- Nyingma Dzogchen lineage

**Family Lineages**:
- Khön family (Sakya)
- Phagmodru family

**Extraction Guidelines**:
- Track complete chains (position is critical)
- Note where/when transmission occurred
- Identify branch points (where lineages split)
- Distinguish incarnation vs. transmission lineages
- Link to specific teachings being transmitted
- Handle gaps (missing lineage holders)
- Note disputed successions

---

## 8. Deity (ལྷ།, ཡི་དམ།)

**Description**: Buddhist deities, yidams (meditation deities), protectors, bodhisattvas

**Key Attributes**:
```typescript
{
  type: 'deity',
  names: {
    tibetan: ['སྤྱན་རས་གཟིགས།'],
    english: ['Chenrezig', 'Avalokiteshvara'],
    sanskrit: ['Avalokiteśvara'],
    phonetic: ['Chen-re-zig']
  },
  attributes: {
    deityType: 'buddha' | 'bodhisattva' | 'yidam' | 'protector' | 'dakini',
    tradition: ['all traditions'], // or specific to one
    iconography: {
      arms: 4,
      color: 'white',
      implements: ['lotus', 'mala'],
      posture: 'seated'
    },
    qualities: ['compassion', 'loving-kindness'],
    mantras: ['oṃ maṇi padme hūṃ']
  }
}
```

**Common Relationships**:
- `associated_with` → Concept (e.g., compassion)
- `practiced_by` ← Person
- `appears_in` → Text
- `resides_at` → Place (sacred sites)

**Examples**:
- Chenrezig/Avalokiteshvara - bodhisattva of compassion
- Tara - female buddha, protector
- Vajrayogini - yidam deity
- Mahakala - protector
- Manjushri - bodhisattva of wisdom

---

## Extraction Priority

**High Priority** (extract first):
1. **Person** - most relationships stem from people
2. **Place** - essential for geographic context
3. **Text** - intellectual artifacts
4. **Event** - connects people, places, texts in time

**Medium Priority** (extract second):
5. **Lineage** - can be constructed from person relationships
6. **Institution** - often tied to places

**Lower Priority** (extract later):
7. **Concept** - complex, requires context
8. **Deity** - often mentioned but less critical for historical network

---

## Confidence Scoring Guidelines

**High Confidence (0.8-1.0)**:
- Explicit statements with dates/names
- Multiple sources confirm
- Well-known historical figures
- Clear, unambiguous references

**Medium Confidence (0.5-0.8)**:
- Implied relationships
- Single source
- Less famous figures
- Dates given as "circa" or ranges

**Low Confidence (0.3-0.5)**:
- Ambiguous references ("the master", "he")
- Conflicting sources
- Very uncertain dates ("possibly", "perhaps")
- Require disambiguation

**Very Low Confidence (<0.3)**:
- Speculation in text
- Extremely ambiguous
- Should flag for immediate human review

---

*This reference document should be consulted when building extraction prompts and validation logic.*
