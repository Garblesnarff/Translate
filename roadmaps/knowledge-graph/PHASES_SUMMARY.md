# Phases 2-7 Summary

Quick reference for remaining implementation phases. Each phase builds on previous work.

---

## Phase 2: Entity Resolution (2 weeks)

**Goal**: Handle duplicate entities and name variants across documents

**Key Tasks**:
1. **Fuzzy Name Matching** (3 days)
   - Levenshtein distance for similar names
   - Phonetic matching (Marpa = Mar-pa = མར་པ།)
   - Handle diacritics and transliteration variants
   - Similarity scoring (0.8+ threshold = likely match)

2. **Duplicate Detection** (2 days)
   - Cross-document entity comparison
   - Multiple signals: name + date + location + relationships
   - Confidence scoring for merge suggestions
   - Cluster similar entities

3. **Entity Merging Service** (2 days)
   - Combine attributes from multiple sources
   - Keep highest confidence values
   - Merge all source references
   - Update all relationship pointers
   - Maintain merge history (audit trail)

4. **Human Review Workflow** (3 days)
   - Curator dashboard for reviewing merges
   - Side-by-side comparison interface
   - "Merge" / "Not the same" / "Unsure" options
   - Bulk operations for obvious cases
   - Track curator decisions for ML training

**Deliverables**:
- EntityResolver service
- Merge API endpoints
- Review UI
- Merge history tracking

**Success Metric**: <5% false positive merges, >90% duplicate detection rate

---

## Phase 3: Relationship Extraction (2 weeks)

**Goal**: Extract relationships between entities with high accuracy

**Key Tasks**:
1. **Pattern-Based Extraction** (3 days)
   - 100+ regex patterns for common relationships
   - "X studied under Y" → student_of
   - "X wrote Y" → wrote
   - "X lived at Y from A to B" → lived_at with dates
   - Pattern library expandable

2. **LLM-Based Extraction** (3 days)
   - For complex sentences pattern matching can't handle
   - Specialized prompts per relationship type
   - Context-aware (use surrounding sentences)
   - Entity disambiguation ("he" = most recent Person)

3. **Temporal Resolution** (2 days)
   - Resolve relative dates: "after X died" → lookup X's death + 1 year
   - Tibetan calendar conversion (rabjung → Gregorian)
   - Era-based dating: "during reign of..." → lookup era dates
   - Handle date ranges and uncertainty

4. **Relationship Validation** (2 days)
   - Logic checks (person can't be born after death)
   - Timeline consistency (can't be two places at once)
   - Relationship type constraints (wrote: Person → Text only)
   - Cross-reference with existing relationships

**Deliverables**:
- RelationshipExtractor service
- Pattern library
- Temporal resolver
- Validation rules engine

**Success Metric**: >85% precision on relationship extraction

---

## Phase 4: Graph Database Integration (2 weeks)

**Goal**: Add Neo4j for graph queries alongside PostgreSQL

**Key Tasks**:
1. **Neo4j Setup** (2 days)
   - Docker container with Neo4j 5.x
   - APOC and Graph Data Science plugins
   - Authentication and security
   - Backup configuration

2. **Graph Schema Design** (2 days)
   - Node labels for each entity type
   - Relationship types
   - Property indexes for performance
   - Constraints (uniqueness, existence)

3. **Sync Service** (3 days)
   - PostgreSQL → Neo4j sync on every entity/relationship create/update
   - Batch sync for initial data load
   - Handle sync failures gracefully
   - Consistency checks

4. **Graph Query API** (3 days)
   - GET /api/graph/lineage/:personId
   - GET /api/graph/path?from=:id1&to=:id2
   - GET /api/graph/network/:centerId?depth=2
   - GET /api/graph/contemporaries/:personId
   - Query builder for complex queries

**Deliverables**:
- Neo4j instance running
- Sync service
- Graph query endpoints
- Documentation for Cypher queries

**Success Metric**: Graph queries <1s response time for 10,000+ entities

---

## Phase 5: Visualization (3 weeks)

**Goal**: Interactive timelines, lineage trees, maps, network graphs

**Key Tasks**:
1. **Timeline Component** (5 days)
   - vis.js Timeline integration
   - Multiple lanes (people, events, texts)
   - Zoom levels (century → decade → year)
   - Filters by type, tradition, region
   - Click to see entity details

2. **Lineage Visualizer** (4 days)
   - vis-network for graph visualization
   - Tree layout for vertical lineages
   - Network layout for complex connections
   - Highlight incarnation vs. transmission lineages
   - Export as PNG/SVG

3. **Geographic Map** (4 days)
   - Leaflet with historical map tiles
   - Plot places with entity counts (heat map)
   - Animated: watch teachings spread over time
   - Journey tracking (follow a person's travels)
   - Filter by time period

4. **Network Graph** (2 days)
   - D3.js or vis-network
   - Show intellectual connections
   - Color code by tradition
   - Size nodes by importance (degree centrality)
   - Interactive: click to expand

**Deliverables**:
- Timeline page
- Lineage visualizer page
- Geographic map page
- Network graph page

**Success Metric**: Scholars can answer research questions visually in <5 minutes

---

## Phase 6: Curator Tools (2 weeks)

**Goal**: Human-in-the-loop verification and quality control

**Key Tasks**:
1. **Review Queue** (3 days)
   - List of low-confidence extractions
   - Filter by entity type, confidence, source
   - Sort by priority
   - Batch review capabilities

2. **Verification Interface** (3 days)
   - Show entity/relationship with source quote
   - Display extraction reasoning
   - Edit attributes inline
   - Accept / Reject / Edit workflow
   - Add notes for future curators

3. **Conflict Resolution** (2 days)
   - Show contradictions (same person, different birth years)
   - Side-by-side source comparison
   - Choose correct version or mark as "disputed"
   - Document reasoning

4. **Curator Analytics** (2 days)
   - Curator activity dashboard
   - Verification statistics
   - Inter-curator agreement metrics
   - Quality improvement trends

**Deliverables**:
- Review queue UI
- Verification workflow
- Conflict resolution UI
- Analytics dashboard

**Success Metric**: Curators can verify 50+ entities/hour

---

## Phase 7: Research Features (3 weeks)

**Goal**: Advanced queries, exports, API, and discovery tools

**Key Tasks**:
1. **Query Builder** (4 days)
   - No-code interface for common queries
   - "Find all students of [person]"
   - "Show texts written in [place] during [period]"
   - "Compare lineages of [teaching A] vs [teaching B]"
   - Save queries for reuse

2. **Export Tools** (3 days)
   - CSV for spreadsheet analysis
   - GraphML for Gephi/Cytoscape
   - JSON-LD for web publishing
   - BibTeX for citations
   - PDF reports with visualizations

3. **Public API** (4 days)
   - RESTful API for external researchers
   - API key authentication
   - Rate limiting
   - Swagger documentation
   - Client libraries (Python, JavaScript)

4. **Anomaly Detection** (2 days)
   - Identify impossible relationships (born after death)
   - Find timeline contradictions
   - Detect unusual patterns
   - Generate research leads

5. **Citation Generator** (2 days)
   - Generate academic citations
   - Multiple formats (Chicago, MLA, APA)
   - Include confidence scores
   - Link to source documents

**Deliverables**:
- Query builder UI
- Export functionality
- Public API with docs
- Anomaly detection service
- Citation generator

**Success Metric**: External researchers using API, <10% support requests

---

## Overall Timeline

```
Phase 0: Foundation          ████████░░ (2 weeks)
Phase 1: Entity Extraction   ████████░░ (2 weeks)
Phase 2: Entity Resolution   ████████░░ (2 weeks)
Phase 3: Relationships       ████████░░ (2 weeks)
Phase 4: Graph Database      ████████░░ (2 weeks)
Phase 5: Visualization       ████████████ (3 weeks)
Phase 6: Curator Tools       ████████░░ (2 weeks)
Phase 7: Research Features   ████████████ (3 weeks)
─────────────────────────────────────────────────────
Total:                       16 weeks (4 months)
```

---

## Dependencies Between Phases

```
Phase 0 (Foundation)
  └──> Phase 1 (Entity Extraction)
        └──> Phase 2 (Entity Resolution)
              └──> Phase 3 (Relationships)
                    ├──> Phase 4 (Graph Database)
                    │     └──> Phase 5 (Visualization)
                    └──> Phase 6 (Curator Tools)
                          └──> Phase 7 (Research Features)
```

**Critical Path**: 0 → 1 → 2 → 3 → 4 → 5

**Parallel Work Possible**:
- Phase 3 and Phase 6 can partially overlap (curator tools don't need graph DB)
- Phase 5 and Phase 7 can partially overlap (some visualizations, some API work)

---

## Risk Mitigation

**Phase 2 Risks**:
- **Risk**: Name matching too aggressive (false merges)
- **Mitigation**: Conservative thresholds (0.9+ similarity), always show source quotes for verification

**Phase 3 Risks**:
- **Risk**: Temporal resolution fails for ambiguous dates
- **Mitigation**: Mark as "uncertain" and flag for human review, don't guess

**Phase 4 Risks**:
- **Risk**: PostgreSQL ↔ Neo4j sync gets out of sync
- **Mitigation**: Transaction-based sync, periodic consistency checks, monitoring

**Phase 5 Risks**:
- **Risk**: Visualizations slow with large datasets (10,000+ entities)
- **Mitigation**: Pagination, clustering, server-side rendering for heavy operations

**Phase 6 Risks**:
- **Risk**: Curators overwhelmed with low-quality extractions
- **Mitigation**: Prioritize high-value entities first, batch operations, automation for obvious cases

**Phase 7 Risks**:
- **Risk**: API misuse (scraping, overload)
- **Mitigation**: Rate limiting, API keys, terms of service, monitoring

---

## Minimum Viable Product (MVP)

If time/resources are limited, prioritize:

**MVP = Phases 0 + 1 + 4 + 5 (basic)**

This gives you:
- ✅ Entity extraction working
- ✅ Data in graph database
- ✅ Basic timeline visualization
- ✅ Simple lineage queries

**Skip for MVP**:
- ❌ Entity resolution (do manual deduplication for now)
- ❌ Advanced relationship extraction (use simple patterns only)
- ❌ Curator tools (have one person review manually)
- ❌ Public API (internal use only)

**MVP Timeline**: 8 weeks instead of 16

---

## Post-Launch Enhancements (Phase 8+)

After completing Phase 7, consider:

### Phase 8: Machine Learning Enhancements
- Train custom NER model on Tibetan Buddhist texts
- Relationship extraction using fine-tuned LLM
- Confidence calibration using curator feedback
- Auto-resolution of common duplicate types

### Phase 9: Collaborative Features
- Multi-user editing with conflict resolution
- Discussion threads on entities (scholarly debate)
- Voting on disputed facts
- Contribution tracking and credit

### Phase 10: Multi-Language Support
- Extract from Tibetan texts directly (not just translations)
- Support Sanskrit, Chinese, Mongolian sources
- Cross-language entity resolution
- Multi-lingual interface

### Phase 11: Advanced Analytics
- Network analysis (centrality, communities, clustering)
- Influence tracking over time
- Predictive modeling (missing links)
- Statistical analysis tools

### Phase 12: Public Engagement
- Mobile app for exploring lineages
- Interactive educational modules
- Social media integration (share discoveries)
- Gamification (achievements for contributions)

---

*This roadmap is a living document. Adjust based on feedback and real-world testing.*
