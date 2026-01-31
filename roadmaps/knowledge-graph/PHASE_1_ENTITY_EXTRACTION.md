# Phase 1: Entity Extraction Enhancement

**Goal**: Improve extraction coverage for all entity types and build confidence in extraction quality

**Duration**: 2 weeks (10 work days)

**Prerequisites**:
- Phase 0 complete (basic extraction working)
- Database schema operational
- Entity extraction tested on sample texts

**Deliverables**:
- ✅ Extraction for all 7 entity types (person, place, text, event, concept, institution, deity)
- ✅ Specialized prompts for each entity type
- ✅ Batch extraction for multiple documents
- ✅ Confidence calibration system
- ✅ Named Entity Recognition (NER) enhancement
- ✅ Extraction quality metrics dashboard

---

## Task Breakdown

### 1.1: Multi-Type Entity Extraction (3 days)

#### 1.1.1: Place extraction
**File**: `server/prompts/placeExtraction.ts`
**Time**: 3 hours

```typescript
export function buildPlaceExtractionPrompt(text: string): string {
  return `Extract all PLACES (locations) from this Tibetan Buddhist text.

PLACE TYPES:
- monastery: དགོན་པ། (e.g., Sakya Monastery, Samye)
- mountain: རི། (e.g., Mount Kailash, Tsari)
- cave: བྲག་ཕུག། (e.g., Milarepa's cave)
- region: ས་ཁུལ། (e.g., Kham, Amdo, Ü-Tsang)
- country: རྒྱལ་ཁབ། (e.g., Tibet, Nepal, India)
- city: གྲོང་ཁྱེར། (e.g., Lhasa, Shigatse)
- holy_site: གནས་མཆོག (pilgrimage sites)

EXTRACT:
- All name variants (Tibetan, English, regional names)
- Geographic hierarchy (monastery in region in country)
- Coordinates if modern location identifiable
- Historical significance
- Founding dates if mentioned
- Associated people (founders, residents)

TEXT:
"""
${text}
"""

Return JSON with place entities and their attributes.`;
}
```

**Tasks**:
- [ ] Create place-specific extraction prompt
- [ ] Add place validation schema
- [ ] Handle geographic hierarchies (monastery → region → country)
- [ ] Extract coordinates for known places
- [ ] Test with texts mentioning many locations

**Acceptance Criteria**:
- [ ] Extracts monasteries, mountains, regions correctly
- [ ] Builds parent-child location relationships
- [ ] Identifies founding dates and founders
- [ ] Confidence scores calibrated for place extraction

---

#### 1.1.2: Text extraction
**File**: `server/prompts/textExtraction.ts`
**Time**: 3 hours

```typescript
export function buildTextExtractionPrompt(text: string): string {
  return `Extract all TEXTS (literary works) mentioned in this passage.

TEXT TYPES:
- sutra: མདོ། (e.g., Prajnaparamita Sutra)
- tantra: རྒྱུད། (e.g., Hevajra Tantra)
- commentary: འགྲེལ་པ། (e.g., commentaries on sutras)
- biography: རྣམ་ཐར། (namtar - life stories)
- poetry: སྙན་ངག (songs, dohas)
- letters: ཡི་གེ།
- ritual: ཆོ་ག། (sadhanas, liturgies)
- philosophical_treatise: བསྟན་བཅོས།
- history: ལོ་རྒྱུས། (e.g., Blue Annals)

EXTRACT:
- Full title (Tibetan and English)
- Abbreviated title if commonly used
- Author(s)
- Translator(s) if translated from Sanskrit/Chinese
- Dates of composition/translation
- Type/genre
- Collection membership (e.g., part of collected works)
- Texts it comments on or cites

Return JSON with text entities and authorship relationships.`;
}
```

**Acceptance Criteria**:
- [ ] Identifies different text types correctly
- [ ] Extracts authorship and translation relationships
- [ ] Handles text collections and sub-texts
- [ ] Links commentaries to root texts

---

#### 1.1.3: Event extraction
**File**: `server/prompts/eventExtraction.ts`
**Time**: 3 hours

```typescript
export function buildEventExtractionPrompt(text: string): string {
  return `Extract all significant EVENTS from this historical text.

EVENT TYPES:
- teaching: ཆོས་འབངས། (dharma teachings)
- empowerment: དབང་བསྐུར། (wang - initiations)
- debate: རྩོད་པ། (philosophical debates)
- founding: གསར་རྒྱག (monastery/institution founding)
- pilgrimage: གནས་སྐོར། (sacred journeys)
- retreat: མཚམས། (solitary meditation retreat)
- transmission: བརྒྱུད་པ། (lineage transmission)
- meeting: མཇལ་འཕྲད། (significant encounters)
- death: འདས་པ།
- birth: སྐྱེས་པ།
- political: (royal appointments, treaties, wars)
- natural_disaster: (earthquakes, floods affecting monasteries)

EXTRACT FOR EACH EVENT:
- Event type
- Date (exact, circa, or relative to other events)
- Location (place name)
- Participants (teachers, students, attendees, sponsors)
- Duration if mentioned
- Significance/outcome
- Related texts (teachings given, texts composed)

TEMPORAL CLUES:
- "during the reign of..." → link to era
- "after X died" → relative date
- "at age 40" → calculate from birth year
- Tibetan calendar dates (rabjung year)

Return JSON with events, participants, and temporal information.`;
}
```

**Acceptance Criteria**:
- [ ] Recognizes various event types
- [ ] Extracts participant roles correctly
- [ ] Handles temporal expressions (relative and absolute dates)
- [ ] Links events to locations and people

---

#### 1.1.4: Concept extraction
**File**: `server/prompts/conceptExtraction.ts`
**Time**: 3 hours

```typescript
export function buildConceptExtractionPrompt(text: string): string {
  return `Extract philosophical CONCEPTS, practices, and deities mentioned in this text.

CONCEPT TYPES:
- philosophical_view: ལྟ་བ། (e.g., emptiness, Buddha-nature)
- meditation_practice: སྒོམ། (e.g., shamatha, vipashyana, Mahamudra)
- deity: ལྷ། (e.g., Chenrezig, Tara, Vajrayogini)
- doctrine: བསྟན་པ། (e.g., two truths, dependent origination)
- technical_term: (specialized Buddhist terminology)

EXTRACT:
- Tibetan term (exact spelling from text)
- Sanskrit equivalent if mentioned
- English translation(s)
- Brief definition from context
- Associated lineage/school (concepts may have different interpretations)
- Related concepts (broader/narrower/contradictory)
- Practitioners known for this practice
- Texts teaching this concept

IMPORTANT:
- Same term may have different meanings in different traditions
- Note school-specific interpretations
- Identify debates about concepts

Return JSON with concepts and their relationships.`;
}
```

**Acceptance Criteria**:
- [ ] Identifies philosophical terms correctly
- [ ] Extracts deities and practices
- [ ] Links concepts to schools/traditions
- [ ] Notes interpretation differences

---

#### 1.1.5: Institution extraction
**File**: `server/prompts/institutionExtraction.ts`
**Time**: 2 hours

```typescript
export function buildInstitutionExtractionPrompt(text: string): string {
  return `Extract INSTITUTIONS (organizations) from this text.

INSTITUTION TYPES:
- monastery: དགོན་པ།
- college: བཤད་གྲྭ། (monastic college)
- hermitage: རི་ཁྲོད། (retreat center)
- temple: ལྷ་ཁང།
- printing_house: པར་ཁང། (text production center)
- library: དཔེ་མཛོད།
- government: གཞུང་།

EXTRACT:
- Institution name (all variants)
- Type
- Location
- Founding date and founder(s)
- Tradition/school affiliation
- Hierarchical relationships (parent/subsidiary institutions)
- Notable abbots/leaders over time
- Texts produced there
- Major events at institution

Return JSON with institutions and organizational relationships.`;
}
```

**Acceptance Criteria**:
- [ ] Distinguishes different institution types
- [ ] Extracts organizational hierarchies
- [ ] Links to founders and abbots
- [ ] Tracks institutional history

---

### 1.2: Batch Extraction (2 days)

#### 1.2.1: Batch processing service
**File**: `server/services/extraction/BatchExtractor.ts`
**Time**: 4 hours

```typescript
export class BatchExtractor {
  constructor(
    private entityExtractor: EntityExtractor,
    private db: any
  ) {}

  async extractFromMultipleDocuments(
    translationIds: string[],
    options: {
      parallel?: number; // How many to process simultaneously
      onProgress?: (completed: number, total: number) => void;
    } = {}
  ): Promise<BatchExtractionResult> {
    const parallel = options.parallel || 3;
    const results: ExtractionResult[] = [];
    const errors: Array<{ translationId: string; error: string }> = [];

    // Process in batches
    for (let i = 0; i < translationIds.length; i += parallel) {
      const batch = translationIds.slice(i, i + parallel);

      const batchResults = await Promise.allSettled(
        batch.map(id => this.entityExtractor.extractFromTranslation(id))
      );

      batchResults.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          errors.push({
            translationId: batch[index],
            error: result.reason.message
          });
        }
      });

      // Report progress
      if (options.onProgress) {
        options.onProgress(i + batch.length, translationIds.length);
      }
    }

    // Aggregate statistics
    const totalEntities = results.reduce((sum, r) => sum + r.entities.length, 0);
    const totalRelationships = results.reduce((sum, r) => sum + r.relationships.length, 0);
    const avgConfidence = results.reduce((sum, r) => sum + r.metadata.averageConfidence, 0) / results.length;

    return {
      results,
      errors,
      statistics: {
        documentsProcessed: results.length,
        documentsFailed: errors.length,
        totalEntities,
        totalRelationships,
        averageConfidence: avgConfidence
      }
    };
  }

  async extractFromEntireCollection(collectionId: string): Promise<BatchExtractionResult> {
    // Get all translations in a collection
    const translations = await this.db
      .select('id')
      .from('translations')
      .where({ collection_id: collectionId });

    return this.extractFromMultipleDocuments(
      translations.map(t => t.id),
      {
        parallel: 5,
        onProgress: (completed, total) => {
          console.log(`Extraction progress: ${completed}/${total} documents`);
        }
      }
    );
  }
}
```

**Acceptance Criteria**:
- [ ] Processes multiple documents in parallel
- [ ] Reports progress during batch processing
- [ ] Handles errors gracefully (continues with other documents)
- [ ] Aggregates statistics across batch
- [ ] Limits concurrent requests to avoid rate limits

---

#### 1.2.2: Batch extraction API
**File**: `server/routes.ts` (extend)
**Time**: 2 hours

```typescript
// POST /api/extract/batch - Extract from multiple documents
app.post('/api/extract/batch', async (req, res) => {
  const { translationIds, collectionId, options } = req.body;

  if (!translationIds && !collectionId) {
    return res.status(400).json({
      error: 'Either translationIds array or collectionId required'
    });
  }

  // Create batch job
  const batchJob = await db.insert('batch_extraction_jobs').values({
    id: uuidv4(),
    status: 'pending',
    total_documents: translationIds?.length || 0,
    created_at: new Date()
  }).returning();

  // Start batch extraction asynchronously
  const batchExtractor = new BatchExtractor(entityExtractor, db);

  (async () => {
    try {
      await db.update('batch_extraction_jobs')
        .set({ status: 'processing', started_at: new Date() })
        .where({ id: batchJob[0].id });

      const result = collectionId
        ? await batchExtractor.extractFromEntireCollection(collectionId)
        : await batchExtractor.extractFromMultipleDocuments(translationIds, options);

      await db.update('batch_extraction_jobs')
        .set({
          status: 'completed',
          documents_processed: result.statistics.documentsProcessed,
          documents_failed: result.statistics.documentsFailed,
          total_entities: result.statistics.totalEntities,
          total_relationships: result.statistics.totalRelationships,
          avg_confidence: result.statistics.averageConfidence,
          completed_at: new Date()
        })
        .where({ id: batchJob[0].id });
    } catch (error) {
      await db.update('batch_extraction_jobs')
        .set({ status: 'failed', error_message: error.message })
        .where({ id: batchJob[0].id });
    }
  })();

  res.json({ batchJobId: batchJob[0].id, status: 'pending' });
});

// GET /api/extract/batch/:batchJobId - Get batch job status
app.get('/api/extract/batch/:batchJobId', async (req, res) => {
  const job = await db
    .select()
    .from('batch_extraction_jobs')
    .where({ id: req.params.batchJobId })
    .first();

  if (!job) {
    return res.status(404).json({ error: 'Batch job not found' });
  }

  res.json(job);
});
```

**Acceptance Criteria**:
- [ ] Batch endpoint accepts multiple translation IDs
- [ ] Can process entire collections
- [ ] Progress tracking via job status endpoint
- [ ] Handles failures gracefully

---

### 1.3: Confidence Calibration (2 days)

#### 1.3.1: Build calibration dataset
**File**: `tests/fixtures/calibrationDataset.ts`
**Time**: 4 hours

```typescript
/**
 * Golden dataset for confidence calibration
 * Each entry has been human-verified as correct or incorrect
 */
export const calibrationDataset = [
  // HIGH CONFIDENCE EXAMPLES (should extract correctly)
  {
    id: 'person-001',
    text: 'Marpa Lotsawa (1012-1097) was a Tibetan translator.',
    expectedEntities: [
      {
        type: 'person',
        name: 'Marpa Lotsawa',
        dates: { birth: 1012, death: 1097 },
        roles: ['translator']
      }
    ],
    expectedConfidence: '>0.9',
    difficulty: 'easy'
  },
  {
    id: 'person-002',
    text: 'Milarepa studied under Marpa and became renowned for his songs.',
    expectedEntities: [
      { type: 'person', name: 'Milarepa' },
      { type: 'person', name: 'Marpa' }
    ],
    expectedRelationships: [
      { subject: 'Milarepa', predicate: 'student_of', object: 'Marpa' }
    ],
    expectedConfidence: '>0.85',
    difficulty: 'easy'
  },

  // MEDIUM CONFIDENCE (ambiguous cases)
  {
    id: 'person-003',
    text: 'The master taught at the monastery for many years.',
    expectedEntities: [
      { type: 'person', name: 'UNKNOWN', note: 'master is ambiguous reference' }
    ],
    expectedConfidence: '0.5-0.7',
    difficulty: 'medium',
    notes: 'Should flag for human review - cannot determine which master'
  },

  // LOW CONFIDENCE (challenging cases)
  {
    id: 'date-001',
    text: 'He was born in the fire-dragon year during the reign of King Songsten Gampo.',
    expectedEntities: [
      {
        type: 'person',
        dates: {
          birth: {
            tibetanYear: { element: 'fire', animal: 'dragon' },
            era: 'reign of Songsten Gampo'
          }
        }
      }
    ],
    expectedConfidence: '0.6-0.8',
    difficulty: 'hard',
    notes: 'Requires Tibetan calendar conversion + historical era knowledge'
  },

  // ... 50-100 more examples covering various cases
];
```

**Tasks**:
- [ ] Create 100+ human-verified test cases
- [ ] Cover all entity types
- [ ] Include easy, medium, hard examples
- [ ] Include edge cases (ambiguous references, missing context)

**Acceptance Criteria**:
- [ ] Dataset covers all entity types
- [ ] Difficulty levels balanced
- [ ] Each case has expected output and confidence range
- [ ] Cases represent real-world extraction challenges

---

#### 1.3.2: Calibration scoring system
**File**: `server/services/extraction/ConfidenceCalibrator.ts`
**Time**: 4 hours

```typescript
export class ConfidenceCalibrator {
  /**
   * Run extraction on calibration dataset and compare results
   */
  async calibrate(extractor: EntityExtractor): Promise<CalibrationReport> {
    const results = [];

    for (const testCase of calibrationDataset) {
      const extracted = await extractor.extractFromText(testCase.text);

      const score = this.scoreExtraction(
        extracted,
        testCase.expectedEntities,
        testCase.expectedRelationships
      );

      results.push({
        testCaseId: testCase.id,
        difficulty: testCase.difficulty,
        precision: score.precision,
        recall: score.recall,
        f1: score.f1,
        confidenceAccuracy: score.confidenceAccuracy,
        passed: score.f1 > 0.7
      });
    }

    // Aggregate by difficulty
    const byDifficulty = {
      easy: results.filter(r => r.difficulty === 'easy'),
      medium: results.filter(r => r.difficulty === 'medium'),
      hard: results.filter(r => r.difficulty === 'hard')
    };

    return {
      overall: {
        totalCases: results.length,
        passed: results.filter(r => r.passed).length,
        avgPrecision: avg(results.map(r => r.precision)),
        avgRecall: avg(results.map(r => r.recall)),
        avgF1: avg(results.map(r => r.f1))
      },
      byDifficulty: {
        easy: this.aggregateStats(byDifficulty.easy),
        medium: this.aggregateStats(byDifficulty.medium),
        hard: this.aggregateStats(byDifficulty.hard)
      },
      failedCases: results.filter(r => !r.passed)
    };
  }

  private scoreExtraction(
    extracted: ExtractionResult,
    expectedEntities: any[],
    expectedRelationships: any[]
  ): ExtractionScore {
    // Calculate precision: What % of extracted entities are correct?
    const correctEntities = this.countCorrectMatches(
      extracted.entities,
      expectedEntities
    );
    const precision = correctEntities / extracted.entities.length;

    // Calculate recall: What % of expected entities were found?
    const recall = correctEntities / expectedEntities.length;

    // F1 score (harmonic mean)
    const f1 = (2 * precision * recall) / (precision + recall);

    // Confidence calibration: Are high-confidence predictions actually correct?
    const confidenceAccuracy = this.evaluateConfidence(
      extracted.entities,
      expectedEntities
    );

    return { precision, recall, f1, confidenceAccuracy };
  }

  private evaluateConfidence(
    extracted: Entity[],
    expected: any[]
  ): number {
    // Check if confidence scores correlate with correctness
    const highConfidence = extracted.filter(e => e.confidence > 0.8);
    const correctHighConfidence = highConfidence.filter(e =>
      expected.some(exp => this.matches(e, exp))
    );

    return correctHighConfidence.length / highConfidence.length;
  }
}
```

**Acceptance Criteria**:
- [ ] Calibration runs on full dataset
- [ ] Reports precision, recall, F1 scores
- [ ] Identifies which test cases fail
- [ ] Evaluates confidence score accuracy
- [ ] Generates actionable improvement suggestions

---

### 1.4: Quality Metrics Dashboard (2 days)

#### 1.4.1: Extraction metrics tracking
**File**: `server/services/metrics/ExtractionMetrics.ts`
**Time**: 3 hours

```typescript
export class ExtractionMetrics {
  async recordExtraction(result: ExtractionResult): Promise<void> {
    await this.db.insert('extraction_metrics').values({
      extraction_id: result.metadata.documentId,
      timestamp: new Date(),
      entities_count: result.entities.length,
      relationships_count: result.relationships.length,
      avg_confidence: result.metadata.averageConfidence,
      processing_time_ms: result.metadata.processingTime,
      entity_type_distribution: this.getTypeDistribution(result.entities),
      confidence_distribution: this.getConfidenceDistribution(result.entities),
      model_used: result.metadata.model
    });
  }

  async getAggregateMetrics(timeRange?: { start: Date; end: Date }): Promise<AggregateMetrics> {
    // Query aggregated metrics
    const metrics = await this.db
      .select()
      .from('extraction_metrics')
      .where(timeRange ? 'timestamp >= ? AND timestamp <= ?' : '1=1')
      .params(timeRange ? [timeRange.start, timeRange.end] : []);

    return {
      totalExtractions: metrics.length,
      totalEntities: sum(metrics.map(m => m.entities_count)),
      totalRelationships: sum(metrics.map(m => m.relationships_count)),
      avgConfidence: avg(metrics.map(m => m.avg_confidence)),
      avgProcessingTime: avg(metrics.map(m => m.processing_time_ms)),
      entityTypeBreakdown: this.aggregateTypeDistribution(metrics),
      confidenceBreakdown: this.aggregateConfidenceDistribution(metrics),
      trendsOverTime: this.calculateTrends(metrics)
    };
  }

  async getExtractionQualityReport(): Promise<QualityReport> {
    const lowConfidence = await this.db
      .select()
      .from('entities')
      .where('confidence < 0.7 AND verified = false')
      .count();

    const unverifiedHighValue = await this.db
      .select()
      .from('entities')
      .where('confidence > 0.9 AND verified = false')
      .count();

    const contradictions = await this.findContradictions();

    return {
      needsReview: lowConfidence[0].count,
      readyForVerification: unverifiedHighValue[0].count,
      potentialContradictions: contradictions.length,
      overallHealthScore: this.calculateHealthScore(lowConfidence, unverifiedHighValue)
    };
  }

  private async findContradictions(): Promise<Contradiction[]> {
    // Find entities with conflicting information
    // E.g., same person with different birth years
    // Or person listed in two places at same time
    const contradictions = [];

    // Check for duplicate persons with different dates
    const potentialDuplicates = await this.db.raw(`
      SELECT e1.id as id1, e2.id as id2, e1.canonical_name,
             e1.dates as dates1, e2.dates as dates2
      FROM entities e1
      JOIN entities e2 ON similarity(e1.canonical_name, e2.canonical_name) > 0.8
      WHERE e1.id < e2.id
        AND e1.type = 'person'
        AND e2.type = 'person'
        AND e1.dates->>'birth' != e2.dates->>'birth'
    `);

    return potentialDuplicates.map(d => ({
      type: 'conflicting_dates',
      entity1: d.id1,
      entity2: d.id2,
      issue: `${d.canonical_name} has conflicting birth dates`
    }));
  }
}
```

**Acceptance Criteria**:
- [ ] Metrics recorded for every extraction
- [ ] Aggregate statistics calculated correctly
- [ ] Identifies quality issues automatically
- [ ] Tracks metrics over time

---

#### 1.4.2: Dashboard UI
**File**: `client/src/pages/ExtractionDashboard.tsx`
**Time**: 5 hours

```tsx
export function ExtractionDashboard() {
  const { data: metrics } = useQuery('extraction-metrics', fetchMetrics);

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-6">Entity Extraction Dashboard</h1>

      {/* Overview Stats */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <MetricCard
          title="Total Entities"
          value={metrics?.totalEntities}
          trend={+12}
        />
        <MetricCard
          title="Avg Confidence"
          value={`${(metrics?.avgConfidence * 100).toFixed(1)}%`}
          trend={+3}
        />
        <MetricCard
          title="Needs Review"
          value={metrics?.needsReview}
          alert={metrics?.needsReview > 100}
        />
        <MetricCard
          title="Processing Time"
          value={`${metrics?.avgProcessingTime}ms`}
          trend={-8}
        />
      </div>

      {/* Entity Type Distribution */}
      <Card className="mb-8">
        <CardHeader>Entity Types Extracted</CardHeader>
        <CardContent>
          <BarChart data={metrics?.entityTypeBreakdown} />
        </CardContent>
      </Card>

      {/* Confidence Distribution */}
      <Card className="mb-8">
        <CardHeader>Confidence Score Distribution</CardHeader>
        <CardContent>
          <HistogramChart
            data={metrics?.confidenceBreakdown}
            xLabel="Confidence Score"
            yLabel="Count"
          />
        </CardContent>
      </Card>

      {/* Quality Issues */}
      <Card>
        <CardHeader>Quality Alerts</CardHeader>
        <CardContent>
          <QualityAlerts alerts={metrics?.qualityReport} />
        </CardContent>
      </Card>

      {/* Recent Extractions */}
      <Card className="mt-8">
        <CardHeader>Recent Extractions</CardHeader>
        <CardContent>
          <ExtractionList extractions={metrics?.recentExtractions} />
        </CardContent>
      </Card>
    </div>
  );
}
```

**Acceptance Criteria**:
- [ ] Dashboard shows real-time extraction statistics
- [ ] Charts visualize entity type distribution
- [ ] Quality issues highlighted
- [ ] Responsive design

---

## Definition of Done

Phase 1 is complete when:

- [x] **All entity types extractable** (person, place, text, event, concept, institution, deity)
- [x] **Specialized prompts** for each entity type
- [x] **Batch extraction working** for multiple documents
- [x] **Confidence calibration** completed with 80%+ accuracy on test set
- [x] **Quality metrics tracked** and visualized
- [x] **Dashboard operational** showing extraction statistics
- [x] **Performance acceptable** (<30s per document on average)
- [x] **Tests passing** with >80% coverage

## Success Metrics

After Phase 1, we should be able to:
- ✅ Process 100 pages from Sakya Monastery archive
- ✅ Extract 500+ unique entities
- ✅ Achieve >0.8 average confidence
- ✅ Identify entity types correctly (>85% accuracy)
- ✅ Process batch of 20 documents in parallel
- ✅ View quality metrics in dashboard

## Next Phase

Proceed to **Phase 2: Entity Resolution** which will:
- Handle duplicate detection across documents
- Fuzzy match name variants
- Build entity disambiguation system
- Create human review workflows

---

*Phase 1 Estimated Total Time: 10 work days (2 weeks)*
