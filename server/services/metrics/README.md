# ExtractionMetrics Service

## Overview

The ExtractionMetrics service provides comprehensive tracking, analysis, and quality reporting for entity extraction operations in the Knowledge Graph system. It monitors performance, detects quality issues, and identifies contradictions in extracted data.

**Phase 1, Task 1.4.1** of the Knowledge Graph implementation.

## Features

### 1. Metrics Recording
- **Entity & Relationship Counts**: Track volumes of extracted data
- **Confidence Scores**: Monitor average confidence per extraction
- **Processing Time**: Measure extraction performance
- **Type Distribution**: Count entities by type (person, place, text, etc.)
- **Confidence Distribution**: Histogram of confidence levels (low/medium/high)
- **Model Tracking**: Record which AI model performed the extraction

### 2. Aggregate Analytics
- **Time-Range Queries**: Get metrics for specific date ranges
- **Trend Analysis**: Track performance and quality over time
- **Type Breakdown**: Aggregate entity type distributions
- **Performance Metrics**: Average processing times and confidence scores

### 3. Quality Reporting
- **Low Confidence Detection**: Find entities needing human review (<0.7)
- **High Confidence Verification**: Identify entities ready for verification (>0.9)
- **Contradiction Detection**: Discover conflicting entity information
- **Health Score**: Overall quality score (0-100)

### 4. Contradiction Detection
- **Conflicting Dates**: Same person with different birth/death years
- **Duplicate Entities**: Identical entities extracted multiple times
- **Name Similarity**: Uses Levenshtein distance for fuzzy matching

## Database Schema

The `extraction_metrics` table stores:

```typescript
{
  id: string (UUID)
  extractionId: string
  timestamp: Date
  entitiesCount: number
  relationshipsCount: number
  avgConfidence: string (decimal as text)
  processingTimeMs: number
  entityTypeDistribution: string (JSON)
  confidenceDistribution: string (JSON)
  modelUsed: string
}
```

## Usage

### Installation

```typescript
import { db } from '@db/index';
import { getTables } from '@db/config';
import { createExtractionMetrics } from './services/metrics';

const tables = getTables();
const metricsService = createExtractionMetrics(db, tables);
```

### Recording Metrics

After each extraction:

```typescript
const extractionResult = await entityExtractor.extractFromTranslation(translationId);

// Record metrics automatically
await metricsService.recordExtraction(extractionResult);
```

### Getting Aggregate Metrics

```typescript
// Last 7 days
const metrics = await metricsService.getAggregateMetrics({
  start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
  end: new Date(),
});

console.log({
  totalExtractions: metrics.totalExtractions,
  totalEntities: metrics.totalEntities,
  avgConfidence: metrics.avgConfidence,
  avgProcessingTime: metrics.avgProcessingTime,
  entityTypeBreakdown: metrics.entityTypeBreakdown,
  confidenceBreakdown: metrics.confidenceBreakdown,
  trendsOverTime: metrics.trendsOverTime,
});
```

### Getting Quality Report

```typescript
const report = await metricsService.getExtractionQualityReport();

console.log({
  healthScore: report.overallHealthScore,
  needsReview: report.needsReview,
  readyForVerification: report.readyForVerification,
  contradictions: report.potentialContradictions,
  lowConfidenceEntities: report.lowConfidenceEntities,
  highConfidenceUnverified: report.highConfidenceUnverified,
  contradictions: report.contradictions,
});
```

## API Response Examples

### Aggregate Metrics

```json
{
  "totalExtractions": 156,
  "totalEntities": 1247,
  "totalRelationships": 834,
  "avgConfidence": 0.87,
  "avgProcessingTime": 2341,
  "entityTypeBreakdown": {
    "person": 542,
    "place": 189,
    "text": 234,
    "event": 87,
    "lineage": 45,
    "concept": 98,
    "institution": 42,
    "deity": 10
  },
  "confidenceBreakdown": {
    "low": 87,
    "medium": 456,
    "high": 704
  },
  "trendsOverTime": [
    {
      "date": "2025-11-01",
      "extractions": 23,
      "avgConfidence": 0.85,
      "avgProcessingTime": 2450
    },
    {
      "date": "2025-11-02",
      "extractions": 31,
      "avgConfidence": 0.88,
      "avgProcessingTime": 2230
    }
  ]
}
```

### Quality Report

```json
{
  "overallHealthScore": 87.5,
  "needsReview": 12,
  "readyForVerification": 45,
  "potentialContradictions": 3,
  "lowConfidenceEntities": [
    {
      "id": "entity-123",
      "type": "person",
      "canonicalName": "Unknown Lama",
      "confidence": 0.62,
      "verified": false
    }
  ],
  "highConfidenceUnverified": [
    {
      "id": "entity-456",
      "type": "person",
      "canonicalName": "Sakya Pandita",
      "confidence": 0.95,
      "verified": false
    }
  ],
  "contradictions": [
    {
      "type": "conflicting_dates",
      "entity1Id": "entity-789",
      "entity2Id": "entity-790",
      "entity1Name": "Gorampa Sonam Senge",
      "entity2Name": "Gorampa Sonam Senge",
      "issue": "Similar names with conflicting birth years: 1429 vs 1432",
      "details": {
        "dates1": { "year": 1429 },
        "dates2": { "year": 1432 }
      }
    }
  ]
}
```

## Health Score Calculation

The health score (0-100) is calculated based on:

- **Low Confidence Entities**: Each reduces score by 2 points (max -40)
- **Contradictions**: Each reduces score by 5 points (max -30)
- **High Confidence Unverified**: Each reduces score by 0.5 points (max -10)

**Score Interpretation**:
- **90-100**: Excellent - minimal issues
- **75-89**: Good - some review needed
- **60-74**: Fair - quality attention required
- **Below 60**: Poor - significant quality issues

## Integration Points

### With EntityExtractor

```typescript
// In extraction workflow
const result = await entityExtractor.extractFromTranslation(translationId);

// Automatically record metrics
await metricsService.recordExtraction(result);
```

### With Quality Review System

```typescript
// Get entities needing review
const report = await metricsService.getExtractionQualityReport();

// Route to review queue
for (const entity of report.lowConfidenceEntities) {
  await reviewQueue.add(entity, 'low_confidence');
}
```

### With Monitoring Dashboard

```typescript
// Display real-time metrics
app.get('/api/kg/metrics/dashboard', async (req, res) => {
  const [metrics, quality] = await Promise.all([
    metricsService.getAggregateMetrics(),
    metricsService.getExtractionQualityReport(),
  ]);

  res.json({
    performance: metrics,
    quality: quality,
  });
});
```

## Performance Considerations

- **Contradiction Detection**: O(n²) complexity - limited to person entities only
- **Quality Reports**: Limited to 100 entities per query for performance
- **Trend Calculations**: Metrics grouped by date for efficient aggregation
- **Index Recommendations**:
  - `extraction_metrics.timestamp` for time-range queries
  - `entities.confidence` for quality reports
  - `entities.type` for contradiction detection

## Future Enhancements

- Real-time alerting for quality thresholds
- Machine learning models for anomaly detection
- Automated contradiction resolution suggestions
- Historical comparison and regression detection
- Integration with entity resolution service

## Testing

See `example-usage.ts` for comprehensive usage examples covering:
1. Recording extraction metrics
2. Getting aggregate statistics
3. Generating quality reports
4. Building monitoring dashboards

## Dependencies

- `drizzle-orm`: Database ORM
- `crypto`: UUID generation
- Knowledge Graph entity types
- Database schema tables

## License

Part of the Tibetan Translation Knowledge Graph system.
