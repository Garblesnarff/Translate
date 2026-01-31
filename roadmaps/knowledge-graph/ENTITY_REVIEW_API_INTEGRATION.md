# Entity Review Dashboard - API Integration Guide

## Overview
This guide shows how to replace mock data with real API calls when backend services are ready.

## Current Mock Implementation

### Mock Data Generator (Lines 190-370)
```typescript
const generateMockData = (): EntityPair[] => {
  return [
    // Hardcoded entity pairs...
  ];
};

// Usage in component:
const [mockData] = useState<EntityPair[]>(generateMockData());
const [localData, setLocalData] = useState<EntityPair[]>(mockData);
```

## Future Real Implementation

### 1. Replace Mock Data with API Query

**Replace this:**
```typescript
const [mockData] = useState<EntityPair[]>(generateMockData());
const [localData, setLocalData] = useState<EntityPair[]>(mockData);
```

**With this:**
```typescript
const {
  data: apiData,
  isLoading,
  error,
  refetch
} = useQuery({
  queryKey: ['/api/entity-resolution/pending'],
  refetchInterval: 30000, // Auto-refresh every 30 seconds
});

const entityPairs: EntityPair[] = apiData?.pairs || [];
```

### 2. Add Mutation Hooks for Actions

**Merge Action:**
```typescript
const mergeMutation = useMutation({
  mutationFn: async (pairId: string) => {
    const response = await fetch(`/api/entity-resolution/merge/${pairId}`, {
      method: 'POST',
    });
    if (!response.ok) throw new Error('Merge failed');
    return response.json();
  },
  onSuccess: () => {
    refetch(); // Refresh the list
    toast({
      title: "Entities merged",
      description: "Successfully merged entities",
    });
  },
  onError: (error) => {
    toast({
      title: "Merge failed",
      description: error.message,
      variant: "destructive",
    });
  },
});

// Usage:
const handleConfirmMerge = () => {
  if (selectedPair) {
    mergeMutation.mutate(selectedPair.id);
  }
};
```

**Reject Action:**
```typescript
const rejectMutation = useMutation({
  mutationFn: async (pairId: string) => {
    const response = await fetch(`/api/entity-resolution/reject/${pairId}`, {
      method: 'POST',
    });
    if (!response.ok) throw new Error('Reject failed');
    return response.json();
  },
  onSuccess: () => {
    refetch();
    toast({
      title: "Pair rejected",
      description: "Marked as not the same",
    });
  },
});
```

**Flag Action:**
```typescript
const flagMutation = useMutation({
  mutationFn: async (pairId: string) => {
    const response = await fetch(`/api/entity-resolution/flag/${pairId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: 'Needs expert review' }),
    });
    if (!response.ok) throw new Error('Flag failed');
    return response.json();
  },
  onSuccess: () => {
    refetch();
    toast({
      title: "Flagged for review",
      description: "Flagged for expert review",
    });
  },
});
```

**Bulk Merge:**
```typescript
const bulkMergeMutation = useMutation({
  mutationFn: async (pairIds: string[]) => {
    const response = await fetch('/api/entity-resolution/bulk-merge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pairIds }),
    });
    if (!response.ok) throw new Error('Bulk merge failed');
    return response.json();
  },
  onSuccess: (data) => {
    refetch();
    toast({
      title: "Bulk merge complete",
      description: `Successfully merged ${data.mergedCount} entity pairs`,
    });
    setSelectedIds(new Set());
  },
});
```

### 3. Update Component Structure

**Full integration example:**
```typescript
export default function EntityReviewDashboard() {
  const { toast } = useToast();

  // API Query
  const {
    data: apiData,
    isLoading,
    error,
    refetch
  } = useQuery({
    queryKey: ['/api/entity-resolution/pending'],
    refetchInterval: 30000,
  });

  // Mutations
  const mergeMutation = useMutation({ /* ... */ });
  const rejectMutation = useMutation({ /* ... */ });
  const flagMutation = useMutation({ /* ... */ });
  const bulkMergeMutation = useMutation({ /* ... */ });
  const bulkRejectMutation = useMutation({ /* ... */ });

  // Local state for UI only
  const [selectedPair, setSelectedPair] = useState<EntityPair | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [filterType, setFilterType] = useState<string>('all');
  const [filterConfidence, setFilterConfidence] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'similarity' | 'date'>('similarity');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [showMergePreview, setShowMergePreview] = useState(false);

  // Get data from API
  const entityPairs: EntityPair[] = apiData?.pairs || [];

  // Loading state
  if (isLoading) {
    return <div>Loading...</div>;
  }

  // Error state
  if (error) {
    return <div>Error: {error.message}</div>;
  }

  // Rest of component...
}
```

## Required Backend API Endpoints

### 1. GET /api/entity-resolution/pending
Get all pending entity pairs for review.

**Query Parameters:**
- `type` (optional): Filter by entity type (person, place, text, etc.)
- `confidence` (optional): Filter by confidence level (high, medium, low)
- `sortBy` (optional): Sort by similarity or date
- `sortOrder` (optional): asc or desc
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 20)

**Response:**
```json
{
  "pairs": [
    {
      "id": "uuid",
      "entity1": {
        "id": "e1",
        "name": "Marpa Lotsawa",
        "type": "person",
        "attributes": [
          {
            "name": "birth_year",
            "value": "1012",
            "confidence": 0.92,
            "source": "Text A, Page 45"
          }
        ],
        "relationships": [
          {
            "type": "student_of",
            "target": "Naropa",
            "confidence": 0.98
          }
        ],
        "sourceCount": 5,
        "firstSeen": "2025-01-15",
        "lastSeen": "2025-11-02"
      },
      "entity2": { /* similar structure */ },
      "similarityScore": 0.95,
      "confidence": "high",
      "status": "pending",
      "detectedDate": "2025-11-05T10:30:00Z"
    }
  ],
  "total": 42,
  "page": 1,
  "limit": 20,
  "totalPages": 3
}
```

### 2. POST /api/entity-resolution/merge/:pairId
Merge two entities into one.

**Request Body:**
```json
{
  "primaryEntityId": "e1",  // Which entity to keep as primary
  "mergeStrategy": "highest_confidence"  // or "manual"
}
```

**Response:**
```json
{
  "success": true,
  "mergedEntityId": "e1",
  "attributesMerged": 12,
  "sourcesConsolidated": 8,
  "relationshipsUpdated": 5
}
```

### 3. POST /api/entity-resolution/reject/:pairId
Mark two entities as NOT duplicates.

**Request Body:**
```json
{
  "reason": "Different people despite similar names"
}
```

**Response:**
```json
{
  "success": true,
  "pairId": "uuid",
  "status": "rejected"
}
```

### 4. POST /api/entity-resolution/flag/:pairId
Flag a pair for expert review.

**Request Body:**
```json
{
  "reason": "Uncertain match - needs expert review",
  "notes": "Birth years don't match, but other attributes align"
}
```

**Response:**
```json
{
  "success": true,
  "pairId": "uuid",
  "status": "flagged",
  "assignedTo": null  // or curator ID
}
```

### 5. POST /api/entity-resolution/bulk-merge
Merge multiple entity pairs at once.

**Request Body:**
```json
{
  "pairIds": ["uuid1", "uuid2", "uuid3"],
  "strategy": "highest_confidence"
}
```

**Response:**
```json
{
  "success": true,
  "mergedCount": 3,
  "failed": [],
  "results": [
    {
      "pairId": "uuid1",
      "mergedEntityId": "e1",
      "status": "merged"
    }
  ]
}
```

### 6. POST /api/entity-resolution/bulk-reject
Reject multiple entity pairs at once.

**Request Body:**
```json
{
  "pairIds": ["uuid4", "uuid5"],
  "reason": "False positives"
}
```

**Response:**
```json
{
  "success": true,
  "rejectedCount": 2,
  "failed": []
}
```

### 7. GET /api/entity-resolution/stats
Get statistics for dashboard cards.

**Response:**
```json
{
  "pending": 42,
  "merged": 128,
  "rejected": 15,
  "flagged": 7,
  "avgConfidence": 0.83,
  "totalReviewed": 150
}
```

## Database Schema Requirements

### entity_resolution_pairs Table
```sql
CREATE TABLE entity_resolution_pairs (
  id UUID PRIMARY KEY,
  entity1_id UUID NOT NULL REFERENCES entities(id),
  entity2_id UUID NOT NULL REFERENCES entities(id),
  similarity_score FLOAT NOT NULL,
  confidence VARCHAR(10) NOT NULL,  -- high, medium, low
  status VARCHAR(20) NOT NULL,  -- pending, merged, rejected, flagged
  detected_date TIMESTAMP NOT NULL DEFAULT NOW(),
  reviewed_by UUID REFERENCES users(id),
  reviewed_at TIMESTAMP,
  merge_notes TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_pairs_status ON entity_resolution_pairs(status);
CREATE INDEX idx_pairs_confidence ON entity_resolution_pairs(confidence);
CREATE INDEX idx_pairs_similarity ON entity_resolution_pairs(similarity_score);
```

### entity_merge_history Table
```sql
CREATE TABLE entity_merge_history (
  id UUID PRIMARY KEY,
  pair_id UUID NOT NULL REFERENCES entity_resolution_pairs(id),
  primary_entity_id UUID NOT NULL REFERENCES entities(id),
  merged_entity_id UUID NOT NULL,  -- Entity that was merged away
  attributes_merged JSONB NOT NULL,
  curator_id UUID REFERENCES users(id),
  merge_strategy VARCHAR(50) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
```

## Step-by-Step Migration Plan

### Step 1: Add API Query (Keep Mock as Fallback)
```typescript
const { data: apiData, isLoading, error } = useQuery({
  queryKey: ['/api/entity-resolution/pending'],
  enabled: false, // Disabled initially
});

// Use mock data while API is not ready
const entityPairs = apiData?.pairs || generateMockData();
```

### Step 2: Add Mutations (No-op Initially)
```typescript
const mergeMutation = useMutation({
  mutationFn: async (pairId: string) => {
    // TODO: Replace with real API call
    return Promise.resolve({ success: true });
  },
});
```

### Step 3: Enable API Query
```typescript
const { data: apiData } = useQuery({
  queryKey: ['/api/entity-resolution/pending'],
  enabled: true, // Enable when backend is ready
});
```

### Step 4: Remove Mock Data
```typescript
// Delete generateMockData() function
// Remove mock state
```

### Step 5: Add Error Handling
```typescript
if (error) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-red-600">Error Loading Pairs</CardTitle>
      </CardHeader>
      <CardContent>
        <p>{error.message}</p>
        <Button onClick={() => refetch()}>Retry</Button>
      </CardContent>
    </Card>
  );
}
```

## Testing API Integration

### 1. Create Mock API Handlers (MSW)
```typescript
// mocks/handlers.ts
import { http, HttpResponse } from 'msw';

export const handlers = [
  http.get('/api/entity-resolution/pending', () => {
    return HttpResponse.json({
      pairs: generateMockData(),
      total: 6,
      page: 1,
      limit: 20,
      totalPages: 1,
    });
  }),

  http.post('/api/entity-resolution/merge/:pairId', () => {
    return HttpResponse.json({
      success: true,
      mergedEntityId: 'e1',
      attributesMerged: 12,
    });
  }),
];
```

### 2. Add Integration Tests
```typescript
// EntityReviewDashboard.test.tsx
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { server } from './mocks/server';

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

test('loads and displays pending pairs', async () => {
  render(
    <QueryClientProvider client={queryClient}>
      <EntityReviewDashboard />
    </QueryClientProvider>
  );

  await waitFor(() => {
    expect(screen.getByText('Marpa Lotsawa')).toBeInTheDocument();
  });
});
```

## Performance Optimizations

### 1. Optimistic Updates
```typescript
const mergeMutation = useMutation({
  mutationFn: mergeEntityPair,
  onMutate: async (pairId) => {
    // Cancel outgoing refetches
    await queryClient.cancelQueries({ queryKey: ['/api/entity-resolution/pending'] });

    // Snapshot previous value
    const previous = queryClient.getQueryData(['/api/entity-resolution/pending']);

    // Optimistically update
    queryClient.setQueryData(['/api/entity-resolution/pending'], (old: any) => ({
      ...old,
      pairs: old.pairs.filter((p: EntityPair) => p.id !== pairId),
    }));

    return { previous };
  },
  onError: (err, pairId, context) => {
    // Rollback on error
    queryClient.setQueryData(['/api/entity-resolution/pending'], context?.previous);
  },
});
```

### 2. Pagination (Server-side)
```typescript
const [currentPage, setCurrentPage] = useState(1);

const { data } = useQuery({
  queryKey: ['/api/entity-resolution/pending', { page: currentPage }],
  keepPreviousData: true, // Keep showing old data while fetching
});
```

### 3. Debounced Filters
```typescript
import { useDebouncedValue } from '@/hooks/use-debounced-value';

const [filterType, setFilterType] = useState('all');
const debouncedType = useDebouncedValue(filterType, 300);

const { data } = useQuery({
  queryKey: ['/api/entity-resolution/pending', { type: debouncedType }],
});
```

## Security Considerations

### 1. Add CSRF Protection
```typescript
const mergeMutation = useMutation({
  mutationFn: async (pairId: string) => {
    const csrfToken = document.querySelector('meta[name="csrf-token"]')?.content;
    const response = await fetch(`/api/entity-resolution/merge/${pairId}`, {
      method: 'POST',
      headers: {
        'X-CSRF-Token': csrfToken,
      },
    });
    return response.json();
  },
});
```

### 2. Add Authentication Headers
```typescript
const mergeMutation = useMutation({
  mutationFn: async (pairId: string) => {
    const token = localStorage.getItem('authToken');
    const response = await fetch(`/api/entity-resolution/merge/${pairId}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    return response.json();
  },
});
```

### 3. Validate Permissions
Backend should check:
- User is authenticated
- User has curator role
- User has permission to merge entities
- Merge operation is valid (entities exist, not already merged)

## Summary

**Current State**: Fully functional UI with mock data
**Next State**: Backend API integration with real-time updates
**Migration Path**: Gradual replacement of mock data with API queries
**Timeline**: Can be done incrementally as backend services are built
