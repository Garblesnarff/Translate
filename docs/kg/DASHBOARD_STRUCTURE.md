# Extraction Dashboard UI Structure

## Visual Layout

```
┌────────────────────────────────────────────────────────────────────────┐
│ Entity Extraction Dashboard                          [Refresh Button] │
└────────────────────────────────────────────────────────────────────────┘

┌─────────────────┬─────────────────┬─────────────────┬─────────────────┐
│ Total Entities  │ Avg Confidence  │ Needs Review    │ Processing Time │
│                 │                 │                 │                 │
│    1,234        │     78.5%       │      89 ⚠       │     2345ms      │
│ [Database Icon] │ [Trend Icon]    │ [Alert Icon]    │ [Clock Icon]    │
└─────────────────┴─────────────────┴─────────────────┴─────────────────┘

┌─────────────────────────────────┬─────────────────────────────────────┐
│ Total Relationships             │ Verified Entities                   │
│                                 │                                     │
│          567                    │          456                        │
│ [GitBranch Icon]               │ [CheckCircle Icon]                  │
└─────────────────────────────────┴─────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────────┐
│ Entity Types Extracted                                                 │
│ Distribution of entity types across all extractions                   │
├────────────────────────────────────────────────────────────────────────┤
│ Person      ████████████████████████████████████ 234                  │
│ Place       ████████████████████ 123                                  │
│ Text        ████████████████ 89                                       │
│ Event       ████████████ 67                                          │
│ Lineage     ██████████ 45                                            │
│ Concept     ████████ 34                                              │
│ Institution ██████ 23                                                │
│ Deity       ████ 12                                                  │
└────────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────────┐
│ Confidence Score Distribution                                          │
│ Quality distribution of extracted entities                            │
├────────────────────────────────────────────────────────────────────────┤
│ 0-30%       ████ 12                                        [RED]      │
│ 30-50%      ████████████ 45                                [ORANGE]   │
│ 50-70%      ████████████████████ 123                       [ORANGE]   │
│ 70-90%      ████████████████████████████ 234               [YELLOW]   │
│ 90-100%     ████████████████████████████████████████ 456   [GREEN]    │
└────────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────────┐
│ [Alert Icon] Quality Alerts                                           │
│ Issues and warnings detected in extracted data                        │
├────────────────────────────────────────────────────────────────────────┤
│ ⚠  45 entities with very low confidence (<30%)        [Warning]       │
│                                                                        │
│ ℹ  89 entities have no relationships                  [Info]          │
└────────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────────┐
│ Recent Extractions                                                     │
│ Latest entity extraction jobs                                         │
├──────────┬─────┬───────────┬─────────┬──────────┬──────────┬─────────┤
│ Job ID   │ T#  │ Status    │ Entities│ Relations│ Confid.  │ Time    │
├──────────┼─────┼───────────┼─────────┼──────────┼──────────┼─────────┤
│ a1b2c3...│ 123 │ Completed │   45    │    23    │  78.5%   │ 2.3s    │
│ d4e5f6...│ 124 │ Completed │   67    │    34    │  82.1%   │ 3.1s    │
│ g7h8i9...│ 125 │ Processing│    -    │     -    │   -      │   -     │
│ j1k2l3...│ 126 │ Completed │   34    │    12    │  65.2%   │ 1.8s    │
│ m4n5o6...│ 127 │ Failed    │    -    │     -    │   -      │   -     │
└──────────┴─────┴───────────┴─────────┴──────────┴──────────┴─────────┘
```

## Component Hierarchy

```
ExtractionDashboard
├── Header
│   ├── Title: "Entity Extraction Dashboard"
│   └── RefreshButton
│
├── OverviewMetrics (Grid: 4 columns)
│   ├── MetricCard: Total Entities
│   ├── MetricCard: Avg Confidence
│   ├── MetricCard: Needs Review (with alert styling)
│   └── MetricCard: Processing Time
│
├── AdditionalMetrics (Grid: 2 columns)
│   ├── MetricCard: Total Relationships
│   └── MetricCard: Verified Entities
│
├── EntityTypeDistribution (Card)
│   ├── CardHeader
│   │   ├── Title: "Entity Types Extracted"
│   │   └── Description
│   └── CardContent
│       └── EntityTypeChart
│           └── Bar chart (horizontal bars)
│
├── ConfidenceDistribution (Card)
│   ├── CardHeader
│   │   ├── Title: "Confidence Score Distribution"
│   │   └── Description
│   └── CardContent
│       └── ConfidenceChart
│           └── Bar chart (color-coded by range)
│
├── QualityAlertsSection (Card)
│   ├── CardHeader
│   │   ├── Icon: AlertCircle
│   │   ├── Title: "Quality Alerts"
│   │   └── Description
│   └── CardContent
│       └── QualityAlerts
│           └── Alert items (with icons and badges)
│
└── RecentExtractionsSection (Card)
    ├── CardHeader
    │   ├── Title: "Recent Extractions"
    │   └── Description
    └── CardContent
        └── ExtractionList
            └── Table (responsive, horizontal scroll)
```

## Data Flow Diagram

```
┌──────────────────────────────────────────────────────────────┐
│                    ExtractionDashboard                       │
│                                                              │
│  ┌────────────────────────────────────────────────────┐    │
│  │  TanStack Query (with auto-refresh)                │    │
│  │                                                     │    │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────┐ │    │
│  │  │ Metrics Data │  │ Quality Data │  │ Jobs Data│ │    │
│  │  │ (30s refresh)│  │ (60s refresh)│  │(15s ref) │ │    │
│  │  └──────┬───────┘  └──────┬───────┘  └────┬─────┘ │    │
│  └─────────┼──────────────────┼───────────────┼───────┘    │
│            │                  │               │            │
└────────────┼──────────────────┼───────────────┼────────────┘
             │                  │               │
             ▼                  ▼               ▼
    ┌────────────────┐  ┌────────────┐  ┌────────────┐
    │ GET /api/      │  │ GET /api/  │  │ GET /api/  │
    │ metrics/       │  │ metrics/   │  │ extract/   │
    │ aggregate      │  │ quality    │  │ jobs       │
    └────────┬───────┘  └─────┬──────┘  └─────┬──────┘
             │                │               │
             ▼                ▼               ▼
    ┌────────────────────────────────────────────────┐
    │      Metrics Controller                        │
    │                                                │
    │  ┌──────────────────┐  ┌──────────────────┐   │
    │  │ getAggregate     │  │ getQuality       │   │
    │  │ Metrics()        │  │ Report()         │   │
    │  └────────┬─────────┘  └────────┬─────────┘   │
    │           │                     │             │
    │           │  ┌──────────────────┴────────┐    │
    │           │  │ getRecent                 │    │
    │           │  │ ExtractionJobs()          │    │
    │           │  └───────────┬───────────────┘    │
    └───────────┼──────────────┼────────────────────┘
                │              │
                ▼              ▼
    ┌─────────────────────────────────────┐
    │         Database (SQLite)           │
    │                                     │
    │  ┌─────────┐  ┌──────────────┐     │
    │  │entities │  │relationships │     │
    │  └─────────┘  └──────────────┘     │
    │                                     │
    │  ┌────────────────┐                 │
    │  │extraction_jobs │                 │
    │  └────────────────┘                 │
    └─────────────────────────────────────┘
```

## State Management

```
Dashboard State:
├── metricsData (from useQuery)
│   ├── Loading state
│   ├── Error state
│   └── Data: AggregateMetrics
│       ├── totalEntities: number
│       ├── totalRelationships: number
│       ├── avgConfidence: number
│       ├── needsReview: number
│       ├── verifiedEntities: number
│       ├── avgProcessingTime: number
│       ├── entityTypeBreakdown: EntityTypeData[]
│       └── confidenceBreakdown: ConfidenceData[]
│
├── qualityData (from useQuery)
│   ├── Loading state
│   ├── Error state
│   └── Data: QualityReport
│       ├── alerts: QualityAlert[]
│       └── timestamp: string
│
└── jobsData (from useQuery)
    ├── Loading state
    ├── Error state
    └── Data: ExtractionJob[]
        └── Job details (id, status, counts, times, etc.)
```

## Interaction Flow

```
User lands on /extraction
         │
         ▼
Dashboard loads (shows loading spinner)
         │
         ▼
3 parallel API calls triggered
    ├── /api/metrics/aggregate
    ├── /api/metrics/quality
    └── /api/extract/jobs
         │
         ▼
Data renders in components
         │
         ├─► Auto-refresh timers start
         │   ├── 30s: metrics
         │   ├── 60s: quality
         │   └── 15s: jobs
         │
         └─► User can manually refresh
             ├── Click "Refresh" button
             ├── All 3 endpoints re-fetched
             └── Toast notification shown
```

## Responsive Breakpoints

```
Mobile (< 768px):
┌──────────────┐
│ Total Entit. │
├──────────────┤
│ Avg Confid.  │
├──────────────┤
│ Needs Review │
├──────────────┤
│ Process Time │
├──────────────┤
│ Chart 1      │
├──────────────┤
│ Chart 2      │
├──────────────┤
│ Alerts       │
├──────────────┤
│ Jobs Table   │
│ (scroll →)   │
└──────────────┘

Tablet (768px - 1024px):
┌──────────┬──────────┐
│ Total E. │ Avg Conf │
├──────────┼──────────┤
│ Needs R. │ Proc Time│
├──────────┴──────────┤
│ Chart 1             │
├─────────────────────┤
│ Chart 2             │
├─────────────────────┤
│ Alerts              │
├─────────────────────┤
│ Jobs Table          │
└─────────────────────┘

Desktop (> 1024px):
┌────┬────┬────┬────┐
│ T  │ A  │ N  │ P  │
│ E  │ C  │ R  │ T  │
├────┴────┼────┴────┤
│ T Rel.  │ Verif.  │
├─────────┴─────────┤
│ Chart 1           │
├───────────────────┤
│ Chart 2           │
├───────────────────┤
│ Alerts            │
├───────────────────┤
│ Jobs Table        │
└───────────────────┘
```

## Color Scheme

```
Confidence Ranges:
├── 0-30%   → Red (#EF4444)      │ Critical
├── 30-50%  → Orange (#F97316)   │ Warning
├── 50-70%  → Orange (#F97316)   │ Moderate
├── 70-90%  → Yellow (#EAB308)   │ Good
└── 90-100% → Green (#22C55E)    │ Excellent

Status Badges:
├── Completed  → Green (#22C55E)
├── Processing → Blue (#3B82F6)
├── Failed     → Red (#EF4444)
└── Pending    → Gray (#6B7280)

Alert Types:
├── Error   → Red icon + Destructive badge
├── Warning → Orange icon + Orange badge
└── Info    → Blue icon + Outline badge
```

## Loading States

```
Initial Load:
┌────────────────────────────┐
│    [Spinner] Loading...    │
└────────────────────────────┘

Refresh in Progress:
┌────────────────────────────┐
│ Dashboard Title   [Spinner]│  ← Button shows spinner
└────────────────────────────┘

Partial Load (data from cache):
┌────────────────────────────┐
│ Shows cached data          │
│ Background refresh active  │
└────────────────────────────┘
```

## Error States

```
No Data Available:
┌────────────────────────────┐
│ No entity data available   │  ← Centered, muted text
└────────────────────────────┘

API Error:
┌────────────────────────────┐
│ ❌ Error                    │
│ Failed to load metrics     │
│ [Retry Button]             │
└────────────────────────────┘

Network Error:
┌────────────────────────────┐
│ ⚠ Connection Error         │
│ Check your connection      │
│ [Retry Button]             │
└────────────────────────────┘
```
