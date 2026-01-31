# Tibetan Buddhist Historical Knowledge Graph

## Project Vision

Transform the Tibetan Translation Tool from a translation service into a comprehensive **historical knowledge extraction and research platform** that automatically builds an interconnected database of:

- **People**: Lamas, translators, patrons, scholars, practitioners
- **Places**: Monasteries, mountains, caves, regions, pilgrimage sites
- **Texts**: Sutras, tantras, commentaries, biographies, letters
- **Events**: Teachings, empowerments, debates, foundings, retreats
- **Lineages**: Teacher-student chains, incarnation lineages, transmissions
- **Concepts**: Philosophical views, practices, deities, technical terms
- **Institutions**: Monasteries, colleges, temples, libraries

## The Problem We're Solving

Currently, Tibetan Buddhist historical research requires:
- Manual reading of hundreds of texts
- Years to cross-reference sources
- Difficulty tracking lineages across centuries
- No way to visualize intellectual networks
- "Lost" connections remain undiscovered
- Contradictions across sources go unnoticed

## Our Solution

**Automated Knowledge Extraction → Human Verification → Interactive Research Platform**

```
┌─────────────────────────────────────────────────────────────┐
│  Step 1: Translate Tibetan texts (existing functionality)  │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  Step 2: Extract entities & relationships with AI          │
│  • Names, dates, places from translated text               │
│  • Teacher-student relationships                            │
│  • Text authorship, locations, events                       │
│  • Confidence scores for each extraction                    │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  Step 3: Resolve duplicates & verify                       │
│  • Fuzzy matching finds same person with different names   │
│  • Human curators review low-confidence extractions        │
│  • Build consensus across multiple sources                  │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  Step 4: Store in knowledge graph database                 │
│  • Neo4j for graph relationships & fast traversal          │
│  • PostgreSQL for source documents & metadata              │
│  • Hybrid architecture for best of both                     │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  Step 5: Visualize & research                               │
│  • Interactive timelines (800-1700 CE)                      │
│  • Lineage tree visualizations                              │
│  • Geographic maps of teaching spread                       │
│  • Network graphs of intellectual connections               │
│  • Research queries: "Who taught whom?", "Find gaps"       │
└─────────────────────────────────────────────────────────────┘
```

## What Makes This Unique

No existing tool combines:
1. ✅ **Automated extraction** from Tibetan texts at scale
2. ✅ **Multi-source verification** with confidence scoring
3. ✅ **Graph database** for relationship queries
4. ✅ **Interactive visualizations** (timelines, maps, networks)
5. ✅ **Provenance tracking** (every claim links to source)
6. ✅ **Self-hosted** option for data sovereignty
7. ✅ **Open for collaboration** (scholars worldwide can contribute)

## Example Research Questions We Enable

- **Lineage Tracing**: Show complete teacher-student chain from Tilopa → modern Kagyu teachers
- **Lost Connections**: Find people who lived at same monastery but no recorded meeting
- **Timeline Reconstruction**: When did teachings X spread from Tibet to Mongolia?
- **Comparative Analysis**: How do Sakya vs Gelug lineages differ for teaching Y?
- **Gap Identification**: Which lineages have missing holders? (research priorities)
- **Geographic Spread**: Animated map showing Mahamudra transmission 1000-1500 CE
- **Prolific Centers**: Which monasteries produced the most texts in each century?
- **Gender Analysis**: How many female teachers appear in historical records over time?
- **Text Networks**: Which texts cite each other? (intellectual genealogy)
- **Contradiction Detection**: Find conflicting dates/facts across sources

## Implementation Phases

### **Phase 0: Foundation** (2 weeks)
Extend existing codebase with entity storage, basic extraction

### **Phase 1: Entity Extraction** (2 weeks)
AI-powered extraction of people, places, texts, events from translated texts

### **Phase 2: Entity Resolution** (2 weeks)
Fuzzy matching, duplicate detection, name variant handling

### **Phase 3: Relationship Extraction** (2 weeks)
Extract teacher-student, authorship, location, temporal relationships

### **Phase 4: Graph Database** (2 weeks)
Integrate Neo4j, build sync layer with PostgreSQL, graph queries

### **Phase 5: Visualization** (3 weeks)
Interactive timelines, lineage trees, geographic maps, network graphs

### **Phase 6: Curator Tools** (2 weeks)
Human review interface, verification workflow, conflict resolution

### **Phase 7: Research Features** (3 weeks)
Advanced queries, export tools, API for scholars, anomaly detection

**Total Estimated Time**: 16 weeks (4 months)

## Success Metrics

After Phase 7, we should have:
- ✅ 1,000+ unique entities extracted from Sakya Monastery texts
- ✅ 5,000+ verified relationships
- ✅ 50+ complete lineages reconstructed
- ✅ Interactive timeline spanning 800-1700 CE
- ✅ Network graph showing intellectual connections
- ✅ 10+ research queries demonstrating value
- ✅ Positive feedback from Buddhist studies scholars

## Directory Structure

```
/roadmaps/knowledge-graph/
├── README.md                          # This file - project overview
├── PHASE_0_FOUNDATION.md              # Extend database, basic extraction
├── PHASE_1_ENTITY_EXTRACTION.md       # AI extraction pipeline
├── PHASE_2_ENTITY_RESOLUTION.md       # Duplicate handling, name variants
├── PHASE_3_RELATIONSHIP_EXTRACTION.md # Extract relationships between entities
├── PHASE_4_GRAPH_DATABASE.md          # Neo4j integration, graph queries
├── PHASE_5_VISUALIZATION.md           # Timeline, maps, network graphs
├── PHASE_6_CURATOR_TOOLS.md           # Human verification interface
├── PHASE_7_RESEARCH_FEATURES.md       # Advanced queries, exports, API
├── ENTITY_TYPES.md                    # Reference: All entity types & schemas
├── RELATIONSHIP_TYPES.md              # Reference: All relationship types
├── EXAMPLES.md                        # Use cases, example queries, outputs
└── TECHNOLOGY_CHOICES.md              # Why Neo4j, vis.js, etc.
```

## Target Users

1. **Academic Researchers**
   - Need: Cross-reference sources, find citations, verify lineages
   - Value: Automated extraction saves years of manual work

2. **Monastery Archivists**
   - Need: Preserve institutional history, track lineages
   - Value: Self-hosted platform, data sovereignty, lineage verification

3. **Dharma Practitioners**
   - Need: Verify authentic lineages, learn history
   - Value: Interactive timelines, visual lineage trees, educational content

4. **Digital Humanities Scholars**
   - Need: Apply computational methods to Buddhist studies
   - Value: Open API, exportable data, graph query capabilities

5. **Students**
   - Need: Learn Tibetan Buddhist history
   - Value: Interactive visualizations, curated timelines

## Alignment with Existing Project Goals

This builds on the **Sakya Monastery Translation Pipeline** vision:
- ✅ Still processes monastery archives automatically
- ✅ Still generates content for social media, blogs, podcasts
- ✅ **NEW**: Now also extracts historical knowledge for research
- ✅ **NEW**: Creates reusable knowledge base for future content generation
- ✅ **NEW**: Positions tool as essential infrastructure for Buddhist studies

## Next Steps

1. **Read Phase Files**: Review each phase's detailed task breakdown
2. **Review Reference Docs**: Understand entity types and relationships
3. **Start with Phase 0**: Foundation work (database schema, basic extraction)
4. **Iterate**: Build → Test → Get Feedback → Improve

## Related Projects

- **BDRC (Buddhist Digital Resource Center)**: Text preservation with Linked Open Data
- **Treasury of Lives**: 1,400 biographical entries (manual curation)
- **Dharmamitra**: Academic machine translation project (research focus)
- **84000**: Professional human translation (no knowledge graph)

**Our Differentiator**: Automated extraction + verification + research platform at scale

---

*Last Updated: 2025-01-15*
*Version: 1.0*
*Status: Planning Phase*
