# Batch Extraction API Documentation

## Overview

The Batch Extraction API allows you to extract entities and relationships from multiple translations in parallel, with progress tracking and error handling.

**Implementation**: Phase 1, Task 1.2.2 of Knowledge Graph implementation
**Files Modified**:
- `/home/user/Translate/server/controllers/knowledgeGraphController.ts`
- `/home/user/Translate/server/routes.ts`

---

## Endpoints

### 1. Start Batch Extraction

**Endpoint**: `POST /api/extract/batch`

**Description**: Initiates a batch entity extraction job for multiple translations. The job runs asynchronously in the background.

#### Request Body

```json
{
  "translationIds": [1, 2, 3],  // Array of translation IDs (optional if collectionId provided)
  "collectionId": "col-123",     // Collection ID (optional if translationIds provided)
  "options": {                   // Optional processing options
    "parallel": 3                // Number of documents to process in parallel (default: 3)
  }
}
```

**Validation Rules**:
- Either `translationIds` OR `collectionId` must be provided (not both, not neither)
- `translationIds` must be an array of positive integers
- `options.parallel` must be a positive integer if provided

#### Response

**Status Code**: `202 Accepted` (job started successfully)

```json
{
  "success": true,
  "message": "Batch extraction started",
  "batchJobId": "550e8400-e29b-41d4-a716-446655440000",
  "status": "processing",
  "totalDocuments": 3,
  "hint": "Use GET /api/extract/batch/:batchJobId to check progress"
}
```

**Error Responses**:

| Status Code | Error | Description |
|-------------|-------|-------------|
| 400 | Invalid request parameters | Missing or invalid translationIds/collectionId |
| 500 | Internal server error | Unexpected server error |

#### Example Usage

```bash
# Extract from specific translations
curl -X POST http://localhost:5439/api/extract/batch \
  -H "Content-Type: application/json" \
  -d '{
    "translationIds": [1, 2, 3, 4, 5],
    "options": {
      "parallel": 3
    }
  }'

# Extract from entire collection
curl -X POST http://localhost:5439/api/extract/batch \
  -H "Content-Type: application/json" \
  -d '{
    "collectionId": "monastery-archive-2024"
  }'
```

---

### 2. Get Batch Extraction Status

**Endpoint**: `GET /api/extract/batch/:batchJobId`

**Description**: Retrieves the current status and statistics for a batch extraction job.

#### URL Parameters

- `batchJobId` (UUID): The batch job identifier returned from the start endpoint

#### Response

**Status Code**: `200 OK`

```json
{
  "success": true,
  "job": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "status": "processing",           // "pending" | "processing" | "completed" | "failed"
    "progress": 60,                   // Progress percentage (0-100)
    "totalDocuments": 5,              // Total number of documents to process
    "documentsProcessed": 3,          // Number of successfully processed documents
    "documentsFailed": 0,             // Number of failed documents
    "statistics": {
      "totalEntities": 127,           // Total entities extracted across all documents
      "totalRelationships": 45,       // Total relationships extracted
      "averageConfidence": 0.82       // Average confidence score (0-1)
    },
    "error": null,                    // Error message if status is "failed"
    "startedAt": "2025-11-07T10:00:00.000Z",
    "completedAt": null,              // Timestamp when job completed (null if still running)
    "createdAt": "2025-11-07T09:59:58.000Z"
  }
}
```

**Status Values**:
- `pending`: Job created but not yet started
- `processing`: Job is currently running
- `completed`: Job finished successfully
- `failed`: Job encountered a fatal error

**Error Responses**:

| Status Code | Error | Description |
|-------------|-------|-------------|
| 400 | Invalid batch job ID format | batchJobId is not a valid UUID |
| 404 | Batch job not found | No job exists with the given ID |
| 500 | Internal server error | Unexpected server error |

#### Example Usage

```bash
# Check batch job status
curl http://localhost:5439/api/extract/batch/550e8400-e29b-41d4-a716-446655440000 | jq '.'

# Poll for completion (example script)
BATCH_JOB_ID="550e8400-e29b-41d4-a716-446655440000"
while true; do
  STATUS=$(curl -s "http://localhost:5439/api/extract/batch/$BATCH_JOB_ID" | jq -r '.job.status')
  echo "Status: $STATUS"

  if [ "$STATUS" = "completed" ] || [ "$STATUS" = "failed" ]; then
    echo "Job finished!"
    curl "http://localhost:5439/api/extract/batch/$BATCH_JOB_ID" | jq '.'
    break
  fi

  sleep 5
done
```

---

## How It Works

### Asynchronous Processing

The batch extraction API uses **non-blocking async processing**:

1. **Request Received**: API validates the request and creates a batch job record
2. **Job Created**: Database record created with status `pending`
3. **Background Processing**: Extraction starts in a background promise (no blocking)
4. **Immediate Response**: API returns `202 Accepted` with jobId
5. **Client Polling**: Client polls the status endpoint to track progress
6. **Job Updates**: Background process updates database as it progresses
7. **Completion**: Status changes to `completed` or `failed`

```
Client                API                    BatchExtractor              Database
  |                    |                          |                         |
  |--POST /batch----->|                          |                         |
  |                   |---validate request------>|                         |
  |                   |---create job record------------------------------------->|
  |<--202 Accepted----|                          |                         |
  |   (jobId)         |                          |                         |
  |                   |---start extraction----->|                         |
  |                   |   (background)           |                         |
  |                   |<--return immediately-----|                         |
  |                   |                          |---process docs-------->|
  |                   |                          |<--update status--------|
  |--GET /status----->|                          |                         |
  |<--status data----------------------------------------get job-----------|
  |                   |                          |                         |
  |   (polling)       |                          |---continue processing->|
  |--GET /status----->|                          |                         |
  |<--status data----------------------------------------get job-----------|
```

### Error Handling

The API implements **graceful error handling**:

1. **Individual Document Failures**: If some documents fail, the job continues processing others
2. **Partial Success**: Job status will be `completed` even with some failures
3. **Error Tracking**: Failed documents are counted and reported in statistics
4. **Complete Failure**: Only if ALL documents fail will the job status be `failed`

Example response with partial failures:
```json
{
  "job": {
    "status": "completed",
    "documentsProcessed": 3,
    "documentsFailed": 2,
    "statistics": {
      "totalEntities": 85,
      "totalRelationships": 30
    }
  }
}
```

### Database Schema

The batch extraction jobs are stored in the `batch_extraction_jobs` table:

```sql
CREATE TABLE batch_extraction_jobs (
  id TEXT PRIMARY KEY,                      -- UUID
  status TEXT NOT NULL,                     -- "pending" | "processing" | "completed" | "failed"
  total_documents INTEGER NOT NULL,         -- Total documents to process
  documents_processed INTEGER DEFAULT 0,    -- Successfully processed
  documents_failed INTEGER DEFAULT 0,       -- Failed documents
  total_entities INTEGER DEFAULT 0,         -- Total entities extracted
  total_relationships INTEGER DEFAULT 0,    -- Total relationships extracted
  avg_confidence TEXT,                      -- Average confidence score
  error_message TEXT,                       -- Error message if failed
  started_at TIMESTAMP,                     -- When processing started
  completed_at TIMESTAMP,                   -- When processing completed
  created_at TIMESTAMP NOT NULL             -- When job was created
);
```

---

## Integration with BatchExtractor Service

The API endpoints leverage the `BatchExtractor` service located at:
`/home/user/Translate/server/services/extraction/BatchExtractor.ts`

**Key Features**:
- Parallel processing with configurable concurrency
- Progress tracking with callbacks
- Error resilience using `Promise.allSettled`
- Automatic database persistence
- Statistics aggregation

**Example BatchExtractor Usage**:
```typescript
import { batchExtractor } from '../services/extraction/BatchExtractor';

// Extract from multiple translations
const result = await batchExtractor.extractFromMultipleDocuments(
  [1, 2, 3, 4, 5],
  {
    parallel: 3,
    persistToDb: true,
    onProgress: (completed, total) => {
      console.log(`Progress: ${completed}/${total}`);
    }
  }
);

// Get batch job status
const job = await batchExtractor.getBatchJob(jobId);
```

---

## Rate Limiting

Both endpoints are subject to the standard API rate limiting:
- **Limit**: 100 requests per 15-minute window
- **Headers**: Standard rate limit headers included in responses
- **429 Response**: When limit exceeded, returns "Too many translation requests"

---

## Testing

A test script is provided at `/home/user/Translate/test-batch-extraction-api.sh`:

```bash
# Make executable (if not already)
chmod +x test-batch-extraction-api.sh

# Run tests
./test-batch-extraction-api.sh
```

**Test Coverage**:
1. Start batch extraction with translation IDs
2. Get batch extraction status
3. Invalid request (missing required fields)
4. Get status for non-existent job

---

## Future Enhancements

Potential improvements for future phases:

1. **WebSocket Progress Updates**: Real-time progress notifications instead of polling
2. **Job Cancellation**: Ability to cancel running batch jobs
3. **Job Priority**: Queue system with priority levels
4. **Batch Job Filters**: List all jobs with status filters
5. **Retry Mechanism**: Automatic retry for failed documents
6. **Results Download**: Export batch results as JSON/CSV
7. **Webhook Notifications**: Callback URL when job completes

---

## Error Codes Reference

| HTTP Status | Error Code | Description | Solution |
|-------------|-----------|-------------|----------|
| 202 | - | Job started successfully | Poll status endpoint |
| 400 | VALIDATION_ERROR | Invalid request parameters | Check request body format |
| 400 | MISSING_PARAMS | Neither translationIds nor collectionId provided | Provide one of the required parameters |
| 404 | JOB_NOT_FOUND | Batch job ID doesn't exist | Verify jobId is correct |
| 429 | RATE_LIMIT_EXCEEDED | Too many requests | Wait before retrying |
| 500 | INTERNAL_ERROR | Server error | Check server logs |

---

## Performance Considerations

- **Parallel Processing**: Default is 3 concurrent documents, adjust based on server capacity
- **Large Batches**: For 100+ documents, consider splitting into smaller batches
- **Polling Frequency**: Recommended polling interval is 5-10 seconds
- **Database Load**: Each status check queries the database
- **Memory Usage**: Large batches may require significant memory

---

## Support

For issues or questions:
1. Check server logs for detailed error messages
2. Verify database connectivity
3. Ensure Gemini API keys are configured
4. Review the BatchExtractor service logs

**Related Documentation**:
- Phase 1 Entity Extraction: `/home/user/Translate/roadmaps/knowledge-graph/PHASE_1_ENTITY_EXTRACTION.md`
- BatchExtractor Service: `/home/user/Translate/server/services/extraction/BatchExtractor.ts`
- Knowledge Graph Schema: `/home/user/Translate/db/schema.ts`
