# Quick Start: Batch Extraction API

## Installation Complete ✅

Two new API endpoints are now available for batch entity extraction.

---

## Endpoints

### 1. Start Batch Extraction
```bash
POST /api/extract/batch
```

**Request**:
```json
{
  "translationIds": [1, 2, 3],
  "options": { "parallel": 3 }
}
```

**Response** (202 Accepted):
```json
{
  "success": true,
  "batchJobId": "550e8400-e29b-41d4-a716-446655440000",
  "status": "processing"
}
```

### 2. Check Status
```bash
GET /api/extract/batch/:batchJobId
```

**Response** (200 OK):
```json
{
  "success": true,
  "job": {
    "status": "processing",
    "progress": 60,
    "documentsProcessed": 3,
    "documentsFailed": 0,
    "statistics": {
      "totalEntities": 127,
      "totalRelationships": 45,
      "averageConfidence": 0.82
    }
  }
}
```

---

## Quick Test

```bash
# Start extraction
curl -X POST http://localhost:5439/api/extract/batch \
  -H "Content-Type: application/json" \
  -d '{"translationIds": [1, 2, 3]}'

# Check status (replace with your jobId)
curl http://localhost:5439/api/extract/batch/YOUR-JOB-ID
```

---

## Files Changed

1. `/home/user/Translate/server/controllers/knowledgeGraphController.ts` - Added batch extraction controllers
2. `/home/user/Translate/server/routes.ts` - Registered new routes

---

## Documentation

- **Full API Docs**: `/home/user/Translate/docs/BATCH_EXTRACTION_API.md`
- **Implementation Summary**: `/home/user/Translate/BATCH_EXTRACTION_IMPLEMENTATION_SUMMARY.md`
- **Test Script**: `/home/user/Translate/test-batch-extraction-api.sh`

---

## How It Works

1. Client sends POST request with translation IDs
2. API creates batch job in database
3. Extraction runs in background (async)
4. API returns jobId immediately
5. Client polls status endpoint
6. Background process updates database
7. Status shows real-time progress

**Key Benefit**: Non-blocking - large batches don't timeout!

---

## Next Steps

1. Ensure server is running: `npm run dev`
2. Have some translations in the database
3. Test with the provided script: `./test-batch-extraction-api.sh`
4. Integrate with n8n workflows

---

## Need Help?

- Check server logs for detailed errors
- Review full documentation in `docs/BATCH_EXTRACTION_API.md`
- Verify database connectivity and Gemini API keys
