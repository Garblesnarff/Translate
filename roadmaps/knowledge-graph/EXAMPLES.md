# Knowledge Graph Examples & Use Cases

This document provides concrete examples of what researchers can discover using the knowledge graph.

---

## Example 1: Complete Lineage Reconstruction

**Research Question**: "Show me the complete teacher-student lineage from Tilopa to modern Kagyu masters"

**Graph Query** (Neo4j Cypher):
```cypher
MATCH path = (tilopa:Person {canonicalName: "Tilopa"})-[:teacher_of*1..20]->(descendants)
RETURN path
ORDER BY length(path)
```

**Expected Output**:
```
Tilopa (988-1069)
  └─ Naropa (1016-1100)
      └─ Marpa (1012-1097)
          └─ Milarepa (1052-1135)
              └─ Gampopa (1079-1153)
                  ├─ Phagmo Drupa (1110-1170)
                  │   ├─ Drikung Kyobpa (1143-1217)
                  │   └─ Taklung Thangpa (1142-1210)
                  └─ Dusum Khyenpa (1st Karmapa, 1110-1193)
                      └─ Karma Pakshi (2nd Karmapa, 1204-1283)
                          └─ Rangjung Dorje (3rd Karmapa, 1284-1339)
                              └─ ... [continues to 17th Karmapa]
```

**Research Value**:
- Verify lineage authenticity
- Identify gaps or disputed successions
- Calculate time spans between generations
- Find branch points where lineages split

---

## Example 2: Discover "Lost" Connections

**Research Question**: "Find scholars who lived at Sakya Monastery at the same time but no recorded interaction"

**Graph Query**:
```cypher
MATCH (p1:Person)-[:lived_at]->(sakya:Place {canonicalName: "Sakya Monastery"})
MATCH (p2:Person)-[:lived_at]->(sakya)
WHERE p1.id <> p2.id
  AND p1.dates.birth <= p2.dates.death
  AND p1.dates.death >= p2.dates.birth
  AND NOT (p1)-[:teacher_of|student_of|met_with]-(p2)
RETURN p1.canonicalName, p2.canonicalName,
       p1.dates.birth as p1_birth,
       p2.dates.birth as p2_birth
ORDER BY p1_birth
```

**Example Output**:
```
| Person 1             | Person 2           | P1 Birth | P2 Birth | Overlap Years |
|---------------------|--------------------| ---------|----------|---------------|
| Sachen Kunga Nyingpo| Drogmi Lotsawa    | 1092     | 1008     | 1092-1108     |
| Sönam Tsemo         | Drakpa Gyaltsen   | 1142     | 1147     | 1147-1182     |
```

**Research Value**:
- Identify probable but undocumented meetings
- Research leads for missing historical records
- Understand monastery social networks
- Find potential teacher-student relationships not yet recorded

---

## Example 3: Geographic Spread of Teachings

**Research Question**: "How did Mahamudra teachings spread from India to Tibet and across regions?"

**Graph Query**:
```cypher
MATCH (teaching:Concept {canonicalName: "Mahamudra"})
MATCH (event:Event {teaching: "Mahamudra"})-[:occurred_at]->(place:Place)
MATCH (teacher:Person)-[:attended {role: "teacher"}]->(event)
RETURN event.dates.occurred as date,
       place.canonicalName as location,
       place.coordinates as coords,
       teacher.canonicalName as teacher
ORDER BY date
```

**Expected Output** (timeline + map):
```
1000 CE: India (Tilopa) → Bihar
1050 CE: Tibet/Nepal border (Naropa → Marpa)
1070 CE: Lhodrak, Tibet (Marpa teaching)
1100 CE: Gampo, Tibet (Milarepa teaching)
1150 CE: Multiple sites across Ü-Tsang (Gampopa's students)
1200 CE: Spread to Kham region
1300 CE: Establishment in Mongolia
```

**Visualization**:
```
Animated map showing:
- Points appearing at coordinates over time
- Lines connecting teacher locations to student locations
- Heat map showing concentration of teachings
- Timeline slider to watch spread century by century
```

**Research Value**:
- Visualize dharma transmission patterns
- Identify major teaching centers
- Understand regional variations
- Track how long teachings took to spread

---

## Example 4: Text Citation Network

**Research Question**: "Which texts cite Nagarjuna's works, and what intellectual network does this reveal?"

**Graph Query**:
```cypher
MATCH (root:Text)-[:written_by]->(nagarjuna:Person {canonicalName: "Nagarjuna"})
MATCH (commentary:Text)-[:commentary_on|cites]->(root)
MATCH (author:Person)-[:wrote]->(commentary)
RETURN root.canonicalName as root_text,
       commentary.canonicalName as citing_text,
       author.canonicalName as author,
       author.tradition as tradition,
       commentary.dates.composed as date
ORDER BY date
```

**Expected Output**:
```
Root Text: Mulamadhyamakakarika (Nagarjuna)

Direct Commentaries:
├─ Akutobhaya (Nagarjuna, 200 CE)
├─ Prasannapada (Chandrakirti, 600 CE) [Prasangika Madhyamaka]
├─ Madhyamakavatara (Chandrakirti, 600 CE) [Prasangika Madhyamaka]
└─ Madhyamakalankara (Shantarakshita, 725 CE) [Yogachara-Madhyamaka]

Texts Citing (not full commentaries):
├─ Bodhicaryavatara (Shantideva, 700 CE)
├─ Jewel Ornament of Liberation (Gampopa, 1150 CE) [Kagyu]
├─ Lamrim Chenmo (Tsongkhapa, 1402 CE) [Gelug]
└─ [hundreds more...]

Network Analysis:
- Most cited by: Gelug tradition (78 texts)
- Citation peak: 14th-15th century Tibet
- Geographic spread: India → Tibet → Mongolia → China
```

**Network Graph Visualization**:
```
        [Nagarjuna's Works]
              /    |    \
    [Chandrakirti] [Shantarakshita] [Bhavaviveka]
         /    \         |                |
   [Tibetan]  [More] [More]          [More]
   [Gelug]    [Texts] [Texts]        [Texts]
```

**Research Value**:
- Trace intellectual influence over centuries
- Compare how different schools interpret same text
- Identify most influential thinkers
- Find unexpected cross-tradition connections

---

## Example 5: Contradiction Detection

**Research Question**: "Find conflicting information about historical figures that needs resolution"

**Graph Query**:
```cypher
// Find people with multiple conflicting birth years
MATCH (p:Person)
WHERE size(p.dates.birth) > 1
  AND p.verified = false
RETURN p.canonicalName,
       p.dates.birth as conflicting_dates,
       [r IN (p)<-[:EXTRACTED_FROM]-(source) | source.title] as sources
```

**Example Output**:
```
| Person              | Birth Year Conflicts | Sources                                    |
|---------------------|----------------------|--------------------------------------------|
| Marpa Lotsawa       | 1009, 1012, 1016     | Blue Annals, Marpa's Biography, Red Annals |
| Sakya Pandita       | 1179, 1182           | Sakya histories, Mongol chronicles         |
| Longchenpa          | 1308, 1313           | Nyingma histories, modern scholarship      |
```

**Resolution Workflow**:
1. **System identifies** conflicts automatically
2. **Curator reviews** all source quotes side-by-side
3. **Scholar researches** external sources
4. **Decision made**: Choose most reliable or mark as "disputed"
5. **Note added** explaining reasoning for future researchers

**Research Value**:
- Identify areas needing further manuscript research
- Document scholarly disagreements
- Improve data quality over time
- Show confidence levels (this date is disputed)

---

## Example 6: Prolific Text Production Centers

**Research Question**: "Which monasteries produced the most texts in each century?"

**Graph Query**:
```cypher
MATCH (inst:Institution)-[:produced]->(text:Text)
WHERE text.dates.composed.year >= 1000 AND text.dates.composed.year < 1800
WITH inst,
     (text.dates.composed.year / 100) * 100 as century,
     count(text) as text_count
RETURN inst.canonicalName as monastery,
       century,
       text_count
ORDER BY century, text_count DESC
```

**Expected Output**:
```
11th Century:
  1. Sakya Monastery - 45 texts
  2. Samye Monastery - 38 texts
  3. Vikramashila (India) - 32 texts

12th Century:
  1. Sakya Monastery - 89 texts
  2. Narthang Monastery - 67 texts
  3. Sangphu Monastery - 54 texts

13th Century:
  1. Sakya Monastery - 156 texts
  2. Narthang Monastery - 98 texts
  3. Tsurphu Monastery - 67 texts

...
```

**Visualization**: Heat map overlay on geographic map showing text production intensity

**Research Value**:
- Identify intellectual centers by period
- Correlate with political patronage
- Track rise and fall of institutions
- Find periods of intense scholarly activity

---

## Example 7: Female Teachers in History

**Research Question**: "How many female teachers appear in historical records, and who were their students?"

**Graph Query**:
```cypher
MATCH (female:Person {gender: "female"})-[:teacher_of]->(student:Person)
RETURN female.canonicalName as teacher,
       female.dates.birth as birth_year,
       female.tradition as tradition,
       collect(student.canonicalName) as students,
       count(student) as student_count
ORDER BY birth_year
```

**Expected Output**:
```
| Teacher            | Birth Year | Tradition | Notable Students                | Count |
|--------------------|------------|-----------|---------------------------------|-------|
| Yeshe Tsogyal      | 757        | Nyingma   | [multiple disciples]           | 40+   |
| Machig Labdrön     | 1055       | Chöd      | [Thöpa Bhadra, Khugom Chökyi]  | 30+   |
| Jomo Menmo         | 1248       | Kagyu     | [Rigdzin Kunga, others]        | 15    |
| Samding Dorje Phagmo| 1422      | Multiple  | [various students]             | 20    |
```

**Timeline Visualization**: Distribution of female teachers over centuries

**Research Value**:
- Quantify women's participation in Buddhist history
- Highlight often-overlooked female masters
- Study gender patterns across traditions
- Identify periods of greater female participation

---

## Example 8: Debate Topics Analysis

**Research Question**: "What philosophical topics were most debated in the 14th century?"

**Graph Query**:
```cypher
MATCH (debate:Event {eventType: "debate"})
WHERE debate.dates.occurred.year >= 1300 AND debate.dates.occurred.year < 1400
RETURN debate.properties.topic as topic,
       count(*) as debate_count,
       collect(DISTINCT debate.location) as locations
ORDER BY debate_count DESC
LIMIT 10
```

**Expected Output**:
```
| Topic                      | Debates | Main Locations                    |
|----------------------------|---------|-----------------------------------|
| Emptiness interpretation   | 45      | Sakya, Sangphu, Tsurphu          |
| Mind-only vs Madhyamaka    | 32      | Sangphu, Ganden                  |
| Nature of Buddha-nature    | 28      | Various                          |
| Two truths doctrine        | 24      | Sakya, Sangphu                   |
| Valid cognition            | 19      | Sangphu, Samding                 |
```

**Research Value**:
- Understand intellectual concerns of each period
- Track evolution of philosophical debates
- Identify major debate centers
- Compare topics across traditions

---

## Example 9: Monastery Founding Patterns

**Research Question**: "How did monastery founding correlate with political periods?"

**Graph Query**:
```cypher
MATCH (founder:Person)-[:founded]->(monastery:Institution {type: "monastery"})
MATCH (monastery)-[:located_at]->(place:Place)
RETURN (monastery.dates.founded.year / 50) * 50 as period,
       count(monastery) as monasteries_founded,
       place.region as region
ORDER BY period
```

**Expected Output** (with timeline visualization):
```
1000-1050 CE: 12 monasteries (Early Translation Period)
  - Tsang: 5
  - Ü: 4
  - Kham: 3

1050-1100 CE: 28 monasteries (Peak of First Wave)
  - Tsang: 12 (including Sakya 1073)
  - Ü: 10
  - Kham: 6

1250-1300 CE: 45 monasteries (Mongol Patronage Period)
  - Ü: 20
  - Tsang: 15
  - Amdo: 10

1350-1400 CE: 8 monasteries (Political Instability)
  - Scattered

1400-1450 CE: 52 monasteries (Gelug Expansion)
  - Ü: 30 (Ganden, Drepung, Sera)
  - Kham: 15
  - Amdo: 7
```

**Research Value**:
- Correlate religious activity with political stability
- Track regional development patterns
- Identify periods of expansion vs. decline
- Understand patronage effects

---

## Example 10: Calculating "Degrees of Separation"

**Research Question**: "What's the shortest path between Padmasambhava (8th century) and Tsongkhapa (14th century)?"

**Graph Query**:
```cypher
MATCH path = shortestPath(
  (padma:Person {canonicalName: "Padmasambhava"})-[*]-(tsongkhapa:Person {canonicalName: "Tsongkhapa"})
)
WHERE all(r IN relationships(path) WHERE type(r) IN ['teacher_of', 'student_of', 'transmitted_to'])
RETURN path,
       length(path) as degrees_of_separation,
       [node IN nodes(path) | node.canonicalName] as connection_chain
```

**Expected Output**:
```
Degrees of Separation: 12

Connection Chain:
Padmasambhava (8th c.) →
  Yeshe Tsogyal (8th c.) →
    Vairotsana (8th c.) →
      Nyang Tingdzin (9th c.) →
        Zur Shakya Jungne (10th c.) →
          Kyo Shakya (11th c.) →
            Nyang Tingdzin Zangpo (11th c.) →
              Chak Lotsawa (12th c.) →
                Sakya Pandita (13th c.) →
                  Buton Rinchen Drub (14th c.) →
                    Rendawa Shyönnu Lodrö (14th c.) →
                      Tsongkhapa (14th c.)
```

**Research Value**:
- Show interconnectedness of Tibetan Buddhist history
- Identify "hub" figures (people connecting many others)
- Trace transmission across centuries
- Fascinating for public engagement

---

## Example 11: Institution Lifecycle Analysis

**Research Question**: "Show the lifecycle of Sakya Monastery: founding, growth, decline, revival"

**Graph Query**:
```cypher
MATCH (sakya:Institution {canonicalName: "Sakya Monastery"})
OPTIONAL MATCH (sakya)<-[:lived_at]-(resident:Person)
OPTIONAL MATCH (sakya)-[:produced]->(text:Text)
OPTIONAL MATCH (event:Event)-[:occurred_at]->(sakya)
RETURN sakya,
       resident.dates.birth as resident_years,
       text.dates.composed as text_production_years,
       event.dates.occurred as event_years
```

**Visualization**: Multi-line chart over time
```
Number of Resident Scholars:
   40|              ╱╲
   30|           ╱╱  ╲╲
   20|        ╱╱      ╲╲___
   10|     ╱╱              ╲╲╲___
    0|___╱____________________╲╲╲______
      1000  1200  1400  1600  1800  2000

Text Production:
   50|         ╱╲
   40|      ╱╱  ╲╲
   30|   ╱╱      ╲╲╲
   20|╱╱            ╲╲╲___
   10|                  ╲╲╲_______
    0|________________________________
      1000  1200  1400  1600  1800  2000

Major Events:
   └─ 1073: Founded
   └─ 1244: Sakya Pandita meets Godan Khan
   └─ 1260-1354: Political prominence (Mongol patronage)
   └─ 1960s: Partial destruction
   └─ 1985-present: Restoration
```

**Research Value**:
- Understand institutional dynamics
- Correlate activity with political/economic factors
- Identify patterns of growth and decline
- Inform preservation priorities

---

## Example 12: Multi-Tradition Comparison

**Research Question**: "Compare Kagyu and Gelug interpretations of emptiness"

**Graph Query**:
```cypher
MATCH (concept:Concept {canonicalName: "Emptiness"})
MATCH (person:Person)-[:held_view]->(concept)
WHERE person.tradition = "Kagyu" OR person.tradition = "Gelug"
MATCH (person)-[:wrote]->(text:Text)-[:mentions]->(concept)
RETURN person.tradition as tradition,
       person.canonicalName as scholar,
       text.canonicalName as text,
       concept.definitions[tradition] as interpretation
```

**Expected Output**:
```
Kagyu Interpretation:
  - Gampopa: "Emptiness is the nature of mind, realized through Mahamudra practice"
  - Rangjung Dorje: "Emptiness and clarity are inseparable"
  - Emphasis: Direct experience through meditation

Gelug Interpretation:
  - Tsongkhapa: "Emptiness is absence of inherent existence, established through reasoning"
  - Je Tsongkhapa: "Must understand via logical analysis first, then meditate"
  - Emphasis: Philosophical analysis before practice

Common Ground:
  - Both accept Nagarjuna's Madhyamaka as authoritative
  - Both reject nihilism and eternalism
  - Both see emptiness as key to liberation

Differences:
  - Methodology: Kagyu emphasizes meditation-first; Gelug emphasizes study-first
  - Language: Kagyu uses "nature of mind"; Gelug uses "absence of inherent existence"
  - Historical debates: 14th-15th century disagreements documented
```

**Research Value**:
- Understand doctrinal differences
- Trace evolution of interpretations
- Find common ground between traditions
- Inform interfaith/inter-school dialogue

---

## Example 13: Patron-Scholar Networks

**Research Question**: "How did Mongol patronage shape Tibetan Buddhist development?"

**Graph Query**:
```cypher
MATCH (patron:Person)-[:patron_of]->(beneficiary)
WHERE patron.attributes.ethnicity = "Mongol"
  OR patron.names.tibetan CONTAINS "hor" // "Mongol" in Tibetan
RETURN patron.canonicalName as patron,
       collect(beneficiary.canonicalName) as beneficiaries,
       patron.dates as active_period,
       beneficiary.type as beneficiary_type
```

**Expected Output**:
```
Godan Khan (1206-1251):
  Supported: Sakya Pandita
  Result: Sakya political prominence, texts on governance

Kublai Khan (1215-1294):
  Supported: Phagpa, Sakya school institutions
  Result: Sakya administrative control of Tibet, Phagpa script creation

Toghon Temür (1320-1370):
  Supported: Rangjung Dorje (3rd Karmapa)
  Result: Karma Kagyu prominence at Mongol court

Network Effect:
  - Concentrated wealth in certain lineages
  - Political power tied to religious authority
  - Increased text production (patrons commissioned translations)
  - Architectural developments (monastery construction)
```

**Research Value**:
- Understand religion-politics interplay
- Track wealth flows and their effects
- Identify why some lineages prospered over others
- Modern relevance for church-state relationships

---

## Example 14: Lost Lineages Identification

**Research Question**: "Find lineages with gaps (missing teachers) that need research"

**Graph Query**:
```cypher
MATCH (lineage:Lineage)
MATCH (lineage)-[:link {position: n}]->(person1:Person)
MATCH (lineage)-[:link {position: n+1}]->(person2:Person)
WHERE person2.dates.birth - person1.dates.death > 30 // 30+ year gap
RETURN lineage.name as lineage,
       person1.canonicalName as earlier_holder,
       person1.dates.death as earlier_death,
       person2.canonicalName as later_holder,
       person2.dates.birth as later_birth,
       person2.dates.birth - person1.dates.death as gap_years
ORDER BY gap_years DESC
```

**Expected Output**:
```
| Lineage               | Earlier Holder | Death | Later Holder | Birth | Gap |
|-----------------------|----------------|-------|--------------|-------|-----|
| Shangpa Kagyu         | Khyungpo Naljor| 1127  | Mokchokpa    | 1169  | 42y |
| Jonang Kalachakra     | Yumo Mikyo     | 1218  | Dolpopa      | 1292  | 74y |
| Kadam Lam Rim         | Potowa         | 1105  | Sangye Yarjon| 1150  | 45y |
```

**Research Priority List**:
1. **High Priority**: Gaps >50 years (likely missing holder)
2. **Medium Priority**: Gaps 30-50 years (possible direct transmission, needs verification)
3. **Low Priority**: Gaps <30 years (could be late transmission)

**Research Value**:
- Direct future manuscript research
- Identify areas where knowledge is incomplete
- Prioritize historical investigation
- Fill gaps in our understanding

---

## How to Use These Examples

### For Researchers:
1. **Start with a question** from your field
2. **Adapt example queries** to your specific needs
3. **Export results** to your preferred format (CSV, GraphML, etc.)
4. **Cite the knowledge graph** in your publications

### For Developers:
1. **Study query patterns** for common research tasks
2. **Build UI templates** for frequent queries
3. **Create pre-built dashboards** for each use case
4. **Add query builder** for non-technical users

### For Students:
1. **Explore interactively** via visualization tools
2. **Follow example queries** to learn Tibetan Buddhist history
3. **Generate custom timelines** for specific topics
4. **Create presentations** using exported visualizations

---

*These examples demonstrate the power of a knowledge graph for historical research. The real value emerges when scholars ask questions we haven't anticipated yet.*
