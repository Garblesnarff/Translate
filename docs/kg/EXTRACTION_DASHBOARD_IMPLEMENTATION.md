# Extraction Dashboard Implementation

## Overview

This document describes the implementation of the Entity Extraction Dashboard UI for Phase 1, Task 1.4.2 of the Knowledge Graph project.

## Files Created

### 1. Backend Controller
**File**: `/home/user/Translate/server/controllers/metricsController.ts`

Controller that handles metrics and quality report requests for the extraction dashboard.

**Endpoints Implemented**:
- `GET /api/metrics/aggregate` - Returns aggregate statistics across all extractions
- `GET /api/metrics/quality` - Returns quality report with alerts and issues
- `GET /api/extract/jobs` - Returns recent extraction jobs (default: 10, configurable via `?limit=N`)

### 2. Frontend Dashboard
**File**: `/home/user/Translate/client/src/pages/ExtractionDashboard.tsx`

Complete dashboard UI with real-time metrics visualization.

**Components**:
- `MetricCard` - Reusable card component for displaying individual metrics
- `QualityAlerts` - Displays quality issues with severity badges
- `ExtractionList` - Table of recent extraction jobs
- `EntityTypeChart` - Bar chart showing entity type distribution
- `ConfidenceChart` - Bar chart showing confidence score distribution

### 3. Route Registration
**File**: `/home/user/Translate/server/routes.ts` (modified)

Added three new routes under "Metrics and Monitoring Routes" section:
- `GET /api/metrics/aggregate`
- `GET /api/metrics/quality`
- `GET /api/extract/jobs`

### 4. Frontend Routing
**File**: `/home/user/Translate/client/src/main.tsx` (modified)

Added `/extraction` route that displays the ExtractionDashboard component.

## Dashboard Features

### Overview Stats Cards

Four main metric cards displaying:

1. **Total Entities**
   - Count of all extracted entities
   - Icon: Database

2. **Average Confidence**
   - Mean confidence score across all entities
   - Displayed as percentage
   - Icon: TrendingUp

3. **Needs Review**
   - Count of entities with confidence < 0.5
   - Shows alert styling if count > 100
   - Icon: AlertTriangle

4. **Processing Time**
   - Average extraction processing time
   - Displayed in milliseconds
   - Icon: Clock

Additional metric cards:

5. **Total Relationships**
   - Count of all extracted relationships
   - Icon: GitBranch

6. **Verified Entities**
   - Count of manually verified entities
   - Icon: CheckCircle2

### Entity Type Distribution

Visual bar chart showing:
- Count of entities by type (person, place, text, event, lineage, concept, institution, deity)
- Horizontal bars with relative width based on count
- Sorted display with counts

### Confidence Distribution

Visual bar chart showing:
- Distribution of confidence scores in buckets:
  - 0-30% (red)
  - 30-50% (orange)
  - 50-70% (yellow/orange)
  - 70-90% (yellow)
  - 90-100% (green)
- Color-coded bars indicating quality level

### Quality Alerts

Real-time quality monitoring with severity levels:

**Warning Alerts**:
- Very low confidence entities (< 30%)
- Unverified entities needing review (> 100)

**Error Alerts**:
- Failed extraction jobs

**Info Alerts**:
- Entities without relationships (orphaned)
- "No issues detected" when all checks pass

Each alert shows:
- Severity icon and badge
- Descriptive message
- Count (where applicable)

### Recent Extractions Table

Displays last 10 extraction jobs with:
- Job ID (truncated for display)
- Translation ID
- Status badge (Completed, Processing, Failed, Pending)
- Entity count
- Relationship count
- Average confidence score
- Processing time (formatted: ms, s, or m)
- Completion/start date

## Data Flow

### API Response Structure

**Aggregate Metrics Response** (`GET /api/metrics/aggregate`):
```json
{
  "success": true,
  "metrics": {
    "totalEntities": 1234,
    "totalRelationships": 567,
    "avgConfidence": 0.78,
    "needsReview": 89,
    "verifiedEntities": 456,
    "avgProcessingTime": 2345,
    "entityTypeBreakdown": [
      { "type": "person", "count": 234 },
      { "type": "place", "count": 123 }
    ],
    "confidenceBreakdown": [
      { "range": "0-30%", "count": 12 },
      { "range": "30-50%", "count": 45 }
    ]
  }
}
```

**Quality Report Response** (`GET /api/metrics/quality`):
```json
{
  "success": true,
  "qualityReport": {
    "alerts": [
      {
        "type": "warning",
        "message": "45 entities with very low confidence (<30%)",
        "count": 45
      }
    ],
    "timestamp": "2025-11-07T12:34:56.789Z"
  }
}
```

**Recent Jobs Response** (`GET /api/extract/jobs?limit=10`):
```json
{
  "success": true,
  "jobs": [
    {
      "id": "uuid-here",
      "translationId": 123,
      "status": "completed",
      "entityCount": 45,
      "relationshipCount": 23,
      "averageConfidence": 0.78,
      "processingTime": 2345,
      "startedAt": "2025-11-07T12:00:00Z",
      "completedAt": "2025-11-07T12:00:02Z",
      "error": null
    }
  ]
}
```

## Real-Time Updates

The dashboard implements automatic polling for real-time data:

- **Aggregate Metrics**: Refresh every 30 seconds
- **Quality Report**: Refresh every 60 seconds
- **Recent Jobs**: Refresh every 15 seconds

Users can also manually refresh all data using the "Refresh" button in the header.

## Database Queries

The metrics controller uses efficient SQL queries:

### Entity Type Breakdown
```sql
SELECT type, COUNT(*) as count
FROM entities
GROUP BY type
```

### Confidence Distribution
```sql
SELECT
  CASE
    WHEN CAST(confidence AS REAL) < 0.3 THEN '0-30%'
    WHEN CAST(confidence AS REAL) < 0.5 THEN '30-50%'
    WHEN CAST(confidence AS REAL) < 0.7 THEN '50-70%'
    WHEN CAST(confidence AS REAL) < 0.9 THEN '70-90%'
    ELSE '90-100%'
  END as confidenceRange,
  COUNT(*) as count
FROM entities
GROUP BY confidenceRange
```

### Processing Time Average
```sql
SELECT
  CAST(
    (julianday(completed_at) - julianday(started_at)) * 86400000 AS INTEGER
  ) as processingTime
FROM extraction_jobs
WHERE status = 'completed'
LIMIT 50
```

## Responsive Design

The dashboard is fully responsive:

- **Desktop (lg)**: 4-column grid for overview stats, 2-column for additional metrics
- **Tablet (md)**: 2-column grid
- **Mobile**: Single column layout

All charts and tables adapt to container width.

## UI Components Used

All components use shadcn/ui library:

- `Card`, `CardHeader`, `CardContent`, `CardTitle`, `CardDescription`
- `Badge` (with variants: default, destructive, outline)
- `Button` (with variants: default, outline)
- Icons from `lucide-react`: RefreshCw, CheckCircle2, AlertTriangle, Info, Clock, TrendingUp, Database, GitBranch, AlertCircle

## Access

**Dashboard URL**: `http://localhost:5439/extraction`

## Future Enhancements

Potential improvements for future iterations:

1. **Interactive Filtering**: Filter extraction jobs by status, date range, confidence threshold
2. **Drill-Down Views**: Click on metrics to see detailed breakdowns
3. **Export Functionality**: Download metrics as CSV/JSON
4. **Historical Trends**: Chart showing metrics over time
5. **Real-Time WebSocket Updates**: Replace polling with WebSocket for instant updates
6. **Quality Score**: Overall quality score calculation with recommendations
7. **Comparison View**: Compare metrics across different time periods
8. **Advanced Charts**: Use recharts or d3.js for more sophisticated visualizations

## Testing Recommendations

To test the dashboard:

1. **Start the server**: `npm run dev`
2. **Navigate to**: `http://localhost:5439/extraction`
3. **Run some extractions**: Use the API to trigger extractions
4. **Verify metrics update**: Check that auto-refresh works
5. **Test manual refresh**: Click the refresh button
6. **Check responsive design**: Resize browser window
7. **Verify error handling**: Stop the server and check error display

## Performance Considerations

- Queries use database indexes on `type`, `confidence`, `status`, `created_at`
- Aggregations limited to necessary data only
- Client-side caching via TanStack Query
- Configurable polling intervals to balance freshness vs. server load
- Table pagination can be added if job count grows large

## Database Schema Dependencies

The dashboard relies on these tables:
- `entities` (type, confidence, verified)
- `relationships` (subject_id, object_id)
- `extraction_jobs` (status, entities_extracted, relationships_extracted, confidence_avg, processing times)

All fields are part of Phase 0 schema implementation.
