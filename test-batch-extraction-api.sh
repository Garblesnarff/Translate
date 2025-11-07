#!/bin/bash
# Test script for batch extraction API endpoints

API_URL="http://localhost:5439/api"

echo "======================================"
echo "Testing Batch Extraction API Endpoints"
echo "======================================"
echo ""

# Test 1: Start batch extraction with translation IDs
echo "Test 1: POST /api/extract/batch (with translationIds)"
echo "--------------------------------------"
curl -X POST "$API_URL/extract/batch" \
  -H "Content-Type: application/json" \
  -d '{
    "translationIds": [1, 2, 3],
    "options": {
      "parallel": 2
    }
  }' | jq '.'
echo ""
echo ""

# Extract jobId from response (manual step for now)
read -p "Enter the batchJobId from the response above: " BATCH_JOB_ID

# Test 2: Get batch extraction status
echo "Test 2: GET /api/extract/batch/:batchJobId"
echo "--------------------------------------"
curl -X GET "$API_URL/extract/batch/$BATCH_JOB_ID" | jq '.'
echo ""
echo ""

# Test 3: Invalid request (no translationIds or collectionId)
echo "Test 3: POST /api/extract/batch (invalid - missing required fields)"
echo "--------------------------------------"
curl -X POST "$API_URL/extract/batch" \
  -H "Content-Type: application/json" \
  -d '{}' | jq '.'
echo ""
echo ""

# Test 4: Get status for non-existent job
echo "Test 4: GET /api/extract/batch/:batchJobId (non-existent)"
echo "--------------------------------------"
curl -X GET "$API_URL/extract/batch/00000000-0000-0000-0000-000000000000" | jq '.'
echo ""
echo ""

echo "======================================"
echo "Tests completed!"
echo "======================================"
