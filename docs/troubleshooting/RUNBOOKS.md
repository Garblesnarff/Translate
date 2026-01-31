# Tibetan Translation Tool - Troubleshooting Runbooks

## Table of Contents

1. [API Returns 500 Internal Server Error](#runbook-1-api-returns-500-internal-server-error)
2. [Translation Fails](#runbook-2-translation-fails)
3. [OCR Not Working](#runbook-3-ocr-not-working)
4. [Job Queue Stuck](#runbook-4-job-queue-stuck)
5. [High Memory Usage](#runbook-5-high-memory-usage)
6. [Database Connection Issues](#runbook-6-database-connection-issues)
7. [Slow Performance](#runbook-7-slow-performance)
8. [Rate Limit Exceeded](#runbook-8-rate-limit-exceeded)
9. [Cache Not Working](#runbook-9-cache-not-working)
10. [PDF Generation Fails](#runbook-10-pdf-generation-fails)
11. [Monitoring Endpoints Down](#runbook-11-monitoring-endpoints-down)
12. [WebSocket/SSE Connection Lost](#runbook-12-websocketsse-connection-lost)

---

## Runbook 1: API Returns 500 Internal Server Error

### Symptoms
- Client receives HTTP 500 responses
- Generic "Internal Server Error" message
- Multiple endpoints affected

### Impact
- **Severity**: Critical
- **User Impact**: Complete service outage
- **Business Impact**: No translations possible

### Investigation Steps

#### 1. Check Server Logs

```bash
# PM2 logs
pm2 logs tibetan-translation --lines 100 --err

# Docker logs
docker logs tibetan-translation -f

# Direct logs (if not using PM2)
tail -f /path/to/logs/error.log
```

**Look for:**
- Stack traces
- Uncaught exceptions
- Database errors
- Memory errors

#### 2. Verify Server Status

```bash
# Check if process is running
pm2 status

# Or for Docker
docker ps | grep tibetan-translation

# Check system resources
top -b -n 1 | head -20
free -h
df -h
```

#### 3. Test Health Endpoint

```bash
curl -v http://localhost:5001/api/monitoring/health
```

**Expected:** HTTP 200 with JSON response
**If fails:** Server is unhealthy or unreachable

#### 4. Check Database Connection

```bash
# Test PostgreSQL
psql $DATABASE_URL -c "SELECT 1;"

# Check connection count
psql $DATABASE_URL -c "SELECT count(*) FROM pg_stat_activity;"
```

#### 5. Verify Environment Variables

```bash
# Check critical env vars
echo $GEMINI_API_KEY_ODD
echo $GEMINI_API_KEY_EVEN
echo $DATABASE_URL
echo $NODE_ENV
```

### Resolution Steps

#### Solution 1: Restart Server

```bash
# PM2 restart
pm2 restart tibetan-translation

# Docker restart
docker restart tibetan-translation

# Verify health
curl http://localhost:5001/api/monitoring/health
```

#### Solution 2: Fix Database Connection

```bash
# Restart PostgreSQL
sudo systemctl restart postgresql

# Or restart Docker database
docker restart tibetan-translation-db

# Verify connection
psql $DATABASE_URL -c "SELECT version();"
```

#### Solution 3: Clear Stale Resources

```bash
# Clear Node.js cache
rm -rf node_modules/.cache

# Restart with fresh state
pm2 delete tibetan-translation
pm2 start npm --name "tibetan-translation" -- start
```

#### Solution 4: Check Environment Variables

```bash
# Reload environment
pm2 restart tibetan-translation --update-env

# Or for Docker
docker-compose down
docker-compose up -d
```

### Prevention

1. **Add Health Monitoring**: Use UptimeRobot or similar
2. **Set Up Alerts**: Configure alerting for 500 errors
3. **Graceful Shutdown**: Implement proper shutdown handlers
4. **Error Logging**: Ensure all errors are logged with context

### Escalation

If issue persists after 30 minutes:
- Contact: Senior Developer / DevOps Team
- Provide: Server logs, error messages, environment info
- Consider: Rollback to previous version

---

## Runbook 2: Translation Fails

### Symptoms
- Translation request returns error
- Confidence score is 0
- Error message: "Translation failed"

### Impact
- **Severity**: High
- **User Impact**: Cannot translate specific texts
- **Business Impact**: Reduced service quality

### Investigation Steps

#### 1. Identify Error Type

```bash
# Check translation logs
pm2 logs tibetan-translation --lines 50 | grep -i "translation"

# Check recent errors
curl http://localhost:5001/api/monitoring/errors/recent
```

#### 2. Verify Input Text

```bash
# Test with known good text
curl -X POST http://localhost:5001/api/translate \
  -H "Content-Type: application/json" \
  -d '{"text": "བཀྲ་ཤིས་བདེ་ལེགས།"}'
```

**Common input issues:**
- Text too short (<10 chars)
- No Tibetan characters (U+0F00-U+0FFF)
- Invalid Unicode

#### 3. Test API Keys

```bash
# Test Gemini API key
curl -H "Authorization: Bearer $GEMINI_API_KEY_ODD" \
  https://generativelanguage.googleapis.com/v1/models

# Expected: List of models
# Error: Invalid authentication or quota exceeded
```

#### 4. Check API Quota

Visit: https://console.cloud.google.com/apis/dashboard

**Check:**
- Quota usage
- Rate limits
- Billing status

#### 5. Review Quality Gates

```bash
# Check quality monitoring
curl http://localhost:5001/api/monitoring/quality
```

### Resolution Steps

#### Solution 1: Input Validation Error

```bash
# Validate Tibetan text
# Must contain Tibetan characters (U+0F00-U+0FFF)
# Minimum 10 characters
# Maximum 100,000 characters
```

**Fix:** Ensure text meets validation requirements

#### Solution 2: API Key Issues

```bash
# Rotate API keys
export GEMINI_API_KEY_ODD=new_key
export GEMINI_API_KEY_EVEN=new_key

# Restart server
pm2 restart tibetan-translation --update-env
```

#### Solution 3: Rate Limit Exceeded

```bash
# Check rate limit status
curl http://localhost:5001/api/monitoring/metrics

# Wait for rate limit reset (15 minutes)
# Or add more API keys
```

#### Solution 4: Quality Gate Failure

```bash
# Lower quality threshold temporarily
# Update config via API
curl -X POST http://localhost:5001/api/translation/config \
  -H "Content-Type: application/json" \
  -d '{"qualityThreshold": 0.6}'
```

#### Solution 5: Model Unavailable

```bash
# Check Gemini API status
curl https://generativelanguage.googleapis.com/v1/models

# Use fallback configuration
# Disable multi-model if one model is down
```

### Prevention

1. **Input Validation**: Add client-side validation
2. **API Key Rotation**: Implement automatic key rotation
3. **Fallback Models**: Configure alternative models
4. **Rate Limit Monitoring**: Alert before hitting limits
5. **Quality Thresholds**: Make configurable per request

### Escalation

If issue persists:
- Check Gemini API status: https://status.cloud.google.com
- Contact Google Cloud Support (for API issues)
- Provide: Sample text, error logs, API response

---

## Runbook 3: OCR Not Working

### Symptoms
- Scanned PDFs fail to extract text
- Error: "OCR failed" or "No text extracted"
- Blank results from PDF processing

### Impact
- **Severity**: Medium
- **User Impact**: Cannot process scanned PDFs
- **Business Impact**: Limited document support

### Investigation Steps

#### 1. Verify Tesseract Installation

```bash
# Check Tesseract
tesseract --version

# Expected: Tesseract Open Source OCR Engine v5.x
```

#### 2. Test Tesseract Directly

```bash
# Test with sample image
tesseract test-image.png output -l bod

# Check output
cat output.txt
```

#### 3. Check PDF Type

```bash
# Identify if PDF is scanned or digital
pdffonts input.pdf

# If output is empty or "no fonts", PDF is likely scanned
```

#### 4. Verify Tibetan Language Data

```bash
# Check Tesseract language files
ls /usr/share/tesseract-ocr/*/tessdata/ | grep bod

# Expected: bod.traineddata
```

### Resolution Steps

#### Solution 1: Install Tesseract

```bash
# Ubuntu/Debian
sudo apt update
sudo apt install tesseract-ocr tesseract-ocr-bod

# macOS
brew install tesseract tesseract-lang

# Verify
tesseract --version
tesseract --list-langs | grep bod
```

#### Solution 2: Install Tibetan Language Data

```bash
# Download Tibetan traineddata
sudo wget https://github.com/tesseract-ocr/tessdata/raw/main/bod.traineddata \
  -O /usr/share/tesseract-ocr/5/tessdata/bod.traineddata

# Verify
tesseract --list-langs | grep bod
```

#### Solution 3: Increase OCR Quality

```bash
# Use higher DPI setting
# Update OCR config in code:
# dpi: 300 -> 600
# psm: 3 -> 6 (assume uniform text block)
```

#### Solution 4: Pre-process Images

```bash
# Install ImageMagick
sudo apt install imagemagick

# Pre-process PDF for better OCR
convert -density 300 input.pdf -depth 8 -quality 100 output.png
tesseract output.png result -l bod
```

### Prevention

1. **Installation Check**: Add startup check for Tesseract
2. **Quality Settings**: Expose OCR quality settings to users
3. **Fallback**: Implement manual text input option
4. **Documentation**: Document OCR limitations

### Escalation

If OCR quality is poor:
- Consider commercial OCR: Adobe PDF Services, Google Vision API
- Manual transcription for critical documents

---

## Runbook 4: Job Queue Stuck

### Symptoms
- Batch jobs remain in "processing" status
- Job progress not updating
- No translations being completed

### Impact
- **Severity**: High
- **User Impact**: Batch processing blocked
- **Business Impact**: Backlog of pending jobs

### Investigation Steps

#### 1. Check Job Status

```bash
# Get specific job status
curl http://localhost:5001/api/batch/status/{jobId}

# Check database for stuck jobs
psql $DATABASE_URL -c "SELECT * FROM batch_jobs WHERE status='processing' AND created_at < NOW() - INTERVAL '1 hour';"
```

#### 2. Check Worker Processes

```bash
# Verify main process is running
pm2 status

# Check if translations are happening
tail -f logs/translation.log | grep "Page.*completed"
```

#### 3. Check System Resources

```bash
# CPU/Memory
htop

# Disk space
df -h

# Network connectivity (to Gemini API)
curl -I https://generativelanguage.googleapis.com
```

#### 4. Check Database Locks

```bash
psql $DATABASE_URL -c "SELECT * FROM pg_locks WHERE NOT granted;"
```

### Resolution Steps

#### Solution 1: Restart Stuck Jobs

```bash
# SQL query to find stuck jobs
psql $DATABASE_URL << EOF
SELECT job_id, created_at
FROM batch_jobs
WHERE status='processing'
AND created_at < NOW() - INTERVAL '1 hour';
EOF

# Manually retry job (via API or direct DB update)
psql $DATABASE_URL -c "UPDATE batch_jobs SET status='failed', error_message='Timeout - manual intervention required' WHERE job_id='stuck-job-id';"
```

#### Solution 2: Clear Queue

```bash
# Restart server (will pick up jobs on restart)
pm2 restart tibetan-translation

# Or force clear processing jobs
psql $DATABASE_URL -c "UPDATE batch_jobs SET status='failed' WHERE status='processing' AND created_at < NOW() - INTERVAL '2 hours';"
```

#### Solution 3: Check Concurrency Limits

```bash
# View current concurrency
curl http://localhost:5001/api/monitoring/metrics

# Adjust concurrency in code or config
# Default: 2 pages in parallel
# Increase if system has resources
```

#### Solution 4: Database Maintenance

```bash
# Vacuum and analyze
psql $DATABASE_URL -c "VACUUM ANALYZE batch_jobs;"

# Clear old jobs (optional)
psql $DATABASE_URL -c "DELETE FROM batch_jobs WHERE created_at < NOW() - INTERVAL '30 days' AND status='completed';"
```

### Prevention

1. **Job Timeout**: Implement automatic job timeout (2 hours)
2. **Health Checks**: Periodic queue health checks
3. **Dead Letter Queue**: Move failed jobs to DLQ
4. **Monitoring**: Alert on long-running jobs
5. **Checkpointing**: Ensure page-level checkpointing works

### Escalation

If queue consistently gets stuck:
- Review batch processing architecture
- Consider separate worker processes
- Implement message queue (RabbitMQ, Redis Queue)

---

## Runbook 5: High Memory Usage

### Symptoms
- Server using >80% memory
- Slow response times
- Occasional crashes with "Out of Memory" errors

### Impact
- **Severity**: High
- **User Impact**: Service degradation or downtime
- **Business Impact**: Reduced throughput

### Investigation Steps

#### 1. Check Memory Usage

```bash
# System memory
free -h

# Process memory (PM2)
pm2 show tibetan-translation

# Docker memory
docker stats tibetan-translation
```

#### 2. Identify Memory Leaks

```bash
# Node.js heap snapshot (requires --inspect flag)
node --inspect server/index.js

# Or use clinic.js
npx clinic doctor -- node server/index.js
```

#### 3. Check Cache Size

```bash
# Redis memory usage
redis-cli INFO memory

# Check cache stats via API
curl http://localhost:5001/api/monitoring/metrics
```

#### 4. Review Recent Activity

```bash
# Check for large translations
psql $DATABASE_URL -c "SELECT source_file_name, text_length FROM translations ORDER BY text_length DESC LIMIT 10;"

# Check active connections
psql $DATABASE_URL -c "SELECT count(*) FROM pg_stat_activity;"
```

### Resolution Steps

#### Solution 1: Restart Server

```bash
# Quick fix - restart
pm2 restart tibetan-translation

# Verify memory dropped
free -h
```

#### Solution 2: Adjust Cache Size

```bash
# Reduce L1 cache size in code
# Edit server/services/cache.ts
# MAX_CACHE_SIZE = 1000 -> 500

# Rebuild and restart
npm run build
pm2 restart tibetan-translation
```

#### Solution 3: Increase Memory Limit

```bash
# PM2 with memory limit
pm2 start npm --name "tibetan-translation" \
  --max-memory-restart 1G \
  -- start

# Node.js max old space size
NODE_OPTIONS="--max-old-space-size=2048" pm2 start npm --name "tibetan-translation" -- start
```

#### Solution 4: Clear Redis Cache

```bash
# Clear Redis cache
redis-cli FLUSHDB

# Restart Redis if needed
docker restart tibetan-translation-redis
```

#### Solution 5: Database Connection Pooling

```bash
# Check connection pool config
# Ensure max connections is reasonable (10-20)

# Edit database config
# maxConnections: 10
```

### Prevention

1. **Memory Limits**: Set PM2 max-memory-restart
2. **Cache TTL**: Implement aggressive TTL for L1 cache
3. **Connection Pooling**: Limit database connections
4. **Monitoring**: Alert on memory >70%
5. **Regular Restarts**: Schedule weekly restarts

### Escalation

If memory issues persist:
- Profile application with clinic.js or Chrome DevTools
- Review code for memory leaks (event listeners, timers)
- Consider horizontal scaling

---

## Runbook 6: Database Connection Issues

### Symptoms
- Errors: "Connection refused", "Too many connections"
- Intermittent database errors
- Slow query performance

### Impact
- **Severity**: Critical
- **User Impact**: Service outage or severe degradation
- **Business Impact**: Data access blocked

### Investigation Steps

#### 1. Test Database Connection

```bash
# Direct connection test
psql $DATABASE_URL -c "SELECT version();"

# Check if database is running
sudo systemctl status postgresql

# Or for Docker
docker ps | grep postgres
```

#### 2. Check Connection Count

```bash
# Active connections
psql $DATABASE_URL -c "SELECT count(*) FROM pg_stat_activity;"

# Connection limit
psql $DATABASE_URL -c "SHOW max_connections;"

# Idle connections
psql $DATABASE_URL -c "SELECT count(*) FROM pg_stat_activity WHERE state='idle';"
```

#### 3. Check Database Logs

```bash
# PostgreSQL logs (Ubuntu)
sudo tail -f /var/log/postgresql/postgresql-14-main.log

# Docker logs
docker logs tibetan-translation-db
```

#### 4. Verify Network Connectivity

```bash
# Ping database host
ping database-host

# Check port
telnet database-host 5432

# Or with nc
nc -zv database-host 5432
```

### Resolution Steps

#### Solution 1: Restart Database

```bash
# Restart PostgreSQL service
sudo systemctl restart postgresql

# Or Docker
docker restart tibetan-translation-db

# Verify
psql $DATABASE_URL -c "SELECT 1;"
```

#### Solution 2: Kill Idle Connections

```bash
# Terminate idle connections
psql $DATABASE_URL << EOF
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE state='idle'
AND state_change < NOW() - INTERVAL '5 minutes';
EOF
```

#### Solution 3: Increase Connection Limit

```bash
# Edit postgresql.conf
sudo nano /etc/postgresql/14/main/postgresql.conf

# Change:
# max_connections = 100 -> 200

# Restart PostgreSQL
sudo systemctl restart postgresql
```

#### Solution 4: Fix Connection Pool

```bash
# Update Drizzle pool config
# In db/config.ts:
# poolConfig: {
#   max: 20,  // Reduce from higher value
#   idleTimeoutMillis: 30000,
#   connectionTimeoutMillis: 5000
# }

# Rebuild and restart
npm run build
pm2 restart tibetan-translation
```

#### Solution 5: Connection String Fix

```bash
# Verify DATABASE_URL format
echo $DATABASE_URL
# Should be: postgresql://user:password@host:5432/dbname

# Test with correct format
export DATABASE_URL="postgresql://user:password@host:5432/dbname"
pm2 restart tibetan-translation --update-env
```

### Prevention

1. **Connection Pooling**: Implement proper connection pooling
2. **Health Checks**: Periodic database health checks
3. **Monitoring**: Alert on connection count >80% of max
4. **Automatic Cleanup**: Close idle connections automatically
5. **Failover**: Configure database failover/replica

### Escalation

If database issues persist:
- Contact Database Administrator
- Check for disk space issues
- Review database performance tuning
- Consider database upgrade or migration

---

## Runbook 7: Slow Performance

### Symptoms
- Translation requests taking >30 seconds
- High latency on all endpoints
- Timeouts on large documents

### Impact
- **Severity**: Medium-High
- **User Impact**: Poor user experience
- **Business Impact**: Reduced throughput

### Investigation Steps

#### 1. Check System Resources

```bash
# CPU, Memory, Disk I/O
htop

# Disk performance
iostat -x 1 10

# Network latency
ping -c 10 google.com
```

#### 2. Check Cache Hit Rates

```bash
# API metrics
curl http://localhost:5001/api/monitoring/metrics

# Look for cache hit rate
# Good: >60%, Poor: <30%
```

#### 3. Review Database Performance

```bash
# Slow queries
psql $DATABASE_URL -c "SELECT query, calls, total_time, mean_time FROM pg_stat_statements ORDER BY mean_time DESC LIMIT 10;"

# Table sizes
psql $DATABASE_URL -c "SELECT tablename, pg_size_pretty(pg_total_relation_size(tablename::text)) FROM pg_tables WHERE schemaname='public' ORDER BY pg_total_relation_size(tablename::text) DESC;"
```

#### 4. Check API Latency

```bash
# Test translation endpoint
time curl -X POST http://localhost:5001/api/translate \
  -H "Content-Type: application/json" \
  -d '{"text": "བཀྲ་ཤིས་བདེ་ལེགས།"}'

# Check Gemini API latency
time curl https://generativelanguage.googleapis.com/v1/models
```

#### 5. Review Recent Changes

```bash
# Git log
git log --oneline -10

# Check if recent deploy
pm2 info tibetan-translation | grep "created at"
```

### Resolution Steps

#### Solution 1: Clear Cache and Restart

```bash
# Clear all caches
redis-cli FLUSHDB

# Restart application
pm2 restart tibetan-translation

# Warm up cache with common requests
curl -X POST http://localhost:5001/api/translate \
  -H "Content-Type: application/json" \
  -d '{"text": "བཀྲ་ཤིས་བདེ་ལེགས།"}'
```

#### Solution 2: Database Optimization

```bash
# Vacuum and analyze
psql $DATABASE_URL -c "VACUUM ANALYZE;"

# Reindex if needed
psql $DATABASE_URL -c "REINDEX DATABASE tibetan_translation;"

# Add missing indexes
psql $DATABASE_URL << EOF
CREATE INDEX IF NOT EXISTS idx_translations_created_at ON translations(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_translations_status ON translations(status);
EOF
```

#### Solution 3: Optimize Configuration

```bash
# Reduce quality iterations
curl -X POST http://localhost:5001/api/translation/config \
  -H "Content-Type: application/json" \
  -d '{"maxIterations": 2, "useMultiPass": false}'

# Disable heavy features temporarily
# useChainOfThought: false
# enableQualityAnalysis: false
```

#### Solution 4: Scale Horizontally

```bash
# PM2 cluster mode
pm2 delete tibetan-translation
pm2 start npm --name "tibetan-translation" -i max -- start

# Verify instances
pm2 list
```

#### Solution 5: CDN for Static Assets

```bash
# Configure CDN for client assets
# Update Vite config to build for CDN
# Upload dist/client to CDN
# Update Nginx to serve from CDN
```

### Prevention

1. **Performance Monitoring**: Set up APM (Application Performance Monitoring)
2. **Database Indexes**: Ensure all frequently queried columns are indexed
3. **Caching Strategy**: Implement aggressive caching
4. **Code Profiling**: Regular performance profiling
5. **Load Testing**: Periodic load tests to identify bottlenecks

### Escalation

If performance doesn't improve:
- Run full performance profiling with clinic.js
- Review database query plans
- Consider upgrading infrastructure
- Engage performance engineering team

---

## Runbook 8: Rate Limit Exceeded

### Symptoms
- HTTP 429 "Too many requests" errors
- Users blocked temporarily
- Gemini API quota exceeded

### Impact
- **Severity**: Medium
- **User Impact**: Temporary service denial
- **Business Impact**: User frustration

### Investigation Steps

#### 1. Check Rate Limiter Status

```bash
# Check current rate limits
curl -I http://localhost:5001/api/translate

# Look for headers:
# X-RateLimit-Limit: 100
# X-RateLimit-Remaining: 0
# X-RateLimit-Reset: 1234567890
```

#### 2. Identify Rate Limited IPs

```bash
# Check Nginx logs
sudo tail -f /var/log/nginx/access.log | grep "429"

# Or application logs
pm2 logs tibetan-translation | grep "rate limit"
```

#### 3. Check Gemini API Quota

Visit: https://console.cloud.google.com/apis/dashboard

**Check:**
- Requests per minute
- Daily quota usage
- Quota reset time

### Resolution Steps

#### Solution 1: Wait for Reset

```bash
# Rate limit resets every 15 minutes
# Check reset time from header
# X-RateLimit-Reset: [timestamp]

# Convert to human readable
date -d @1234567890
```

#### Solution 2: Increase Rate Limits

```bash
# Edit server/routes.ts
# Update rate limiter config:
# windowMs: 15 * 60 * 1000  # 15 minutes
# max: 100 -> 200  # Increase limit

# Rebuild and restart
npm run build
pm2 restart tibetan-translation
```

#### Solution 3: Whitelist IPs

```bash
# Add IP whitelist to rate limiter
# In server/routes.ts:
# skip: (req) => {
#   const whitelist = ['127.0.0.1', 'trusted-ip'];
#   return whitelist.includes(req.ip);
# }
```

#### Solution 4: Add More API Keys

```bash
# Add additional Gemini API keys
export GEMINI_API_KEY_BACKUP=new_key

# Implement key rotation in code
# GeminiKeyPool with multiple keys
```

#### Solution 5: Implement User Quotas

```bash
# Per-user rate limiting
# Require API key authentication
# Track usage per user
# Implement tiered quotas (free/paid)
```

### Prevention

1. **API Key Management**: Multiple API keys with rotation
2. **User Authentication**: Implement per-user quotas
3. **Caching**: Aggressive caching reduces API calls
4. **Queue System**: Queue requests during high load
5. **Monitoring**: Alert when approaching limits

### Escalation

If rate limiting is blocking legitimate traffic:
- Upgrade Gemini API quota (paid plan)
- Implement request queuing
- Add CDN/caching layer
- Consider alternative AI providers

---

## Runbook 9: Cache Not Working

### Symptoms
- All requests hitting database/API
- No performance improvement from caching
- Cache hit rate is 0%

### Impact
- **Severity**: Medium
- **User Impact**: Slower response times
- **Business Impact**: Higher API costs

### Investigation Steps

#### 1. Check Cache Status

```bash
# Redis status
redis-cli ping
# Expected: PONG

# Check Redis memory
redis-cli INFO memory

# Check cache keys
redis-cli KEYS *
```

#### 2. Verify Cache Configuration

```bash
# Check environment variables
echo $REDIS_URL

# Test Redis connection
redis-cli -u $REDIS_URL ping
```

#### 3. Check Cache Metrics

```bash
# API metrics
curl http://localhost:5001/api/monitoring/metrics

# Look for:
# cacheHitRate: 0 (problem)
# cacheHitRate: 60+ (good)
```

#### 4. Review Cache Logic

```bash
# Check if cache is being used
pm2 logs tibetan-translation | grep -i "cache"

# Look for "cache hit" or "cache miss" logs
```

### Resolution Steps

#### Solution 1: Restart Redis

```bash
# Restart Redis
sudo systemctl restart redis

# Or Docker
docker restart tibetan-translation-redis

# Verify
redis-cli ping
```

#### Solution 2: Fix Redis Connection

```bash
# Check Redis URL format
echo $REDIS_URL
# Should be: redis://host:6379

# Test connection
redis-cli -u $REDIS_URL ping

# Update and restart
export REDIS_URL="redis://localhost:6379"
pm2 restart tibetan-translation --update-env
```

#### Solution 3: Clear and Rebuild Cache

```bash
# Flush Redis
redis-cli FLUSHALL

# Restart application
pm2 restart tibetan-translation

# Warm up cache
curl -X POST http://localhost:5001/api/translate \
  -H "Content-Type: application/json" \
  -d '{"text": "བཀྲ་ཤིས་བདེ་ལེགས།"}'

# Verify cache hit on second request
curl -X POST http://localhost:5001/api/translate \
  -H "Content-Type: application/json" \
  -d '{"text": "བཀྲ་ཤིས་བདེ་ལེགས།"}'
```

#### Solution 4: Check TTL Settings

```bash
# Verify TTL settings in Redis
redis-cli TTL some-cache-key

# If TTL is too short, increase in code:
# L1 cache: 1 hour
# L2 cache: 24 hours
```

#### Solution 5: Fallback to In-Memory Cache

```bash
# Disable Redis temporarily
unset REDIS_URL

# Restart (will use L1 cache only)
pm2 restart tibetan-translation --update-env

# Monitor performance
curl http://localhost:5001/api/monitoring/metrics
```

### Prevention

1. **Cache Monitoring**: Track cache hit rates
2. **Health Checks**: Periodic Redis health checks
3. **Fallback Logic**: Graceful degradation without Redis
4. **TTL Tuning**: Optimize TTL for usage patterns
5. **Cache Warmup**: Preload common translations

### Escalation

If caching issues persist:
- Review caching architecture
- Consider alternative caching solutions (Memcached)
- Engage caching expert for tuning

---

## Runbook 10: PDF Generation Fails

### Symptoms
- PDF generation endpoint returns error
- PDFs are corrupt or won't open
- Missing fonts or formatting issues

### Impact
- **Severity**: Medium
- **User Impact**: Cannot download translations
- **Business Impact**: Key feature unavailable

### Investigation Steps

#### 1. Test PDF Generation

```bash
# Test endpoint directly
curl -X POST http://localhost:5001/api/generate-pdf \
  -H "Content-Type: application/json" \
  -d '{
    "pages": [{
      "pageNumber": 1,
      "tibetanText": "བཀྲ་ཤིས་བདེ་ལེགས།",
      "englishText": "Hello",
      "confidence": 0.95
    }]
  }' --output test.pdf

# Try to open
open test.pdf  # macOS
xdg-open test.pdf  # Linux
```

#### 2. Check Fonts

```bash
# Verify Tibetan fonts are available
fc-list | grep -i tibetan

# Check font files in project
ls -la client/src/assets/fonts/
```

#### 3. Check Disk Space

```bash
# Disk space for temp files
df -h /tmp

# Clean old temp files
find /tmp -name "*.pdf" -mtime +1 -delete
```

#### 4. Review PDF Service Logs

```bash
# Check for PDF generation errors
pm2 logs tibetan-translation | grep -i "pdf"
```

### Resolution Steps

#### Solution 1: Install Missing Fonts

```bash
# Install Tibetan fonts
sudo apt update
sudo apt install fonts-tibetan-machine

# Or copy fonts to system
sudo cp client/src/assets/fonts/*.ttf /usr/share/fonts/truetype/
sudo fc-cache -fv
```

#### Solution 2: Fix PDF Library

```bash
# Reinstall jspdf
npm uninstall jspdf
npm install jspdf@latest

# Rebuild
npm run build
pm2 restart tibetan-translation
```

#### Solution 3: Increase Memory

```bash
# PDF generation can be memory intensive
NODE_OPTIONS="--max-old-space-size=4096" pm2 restart tibetan-translation
```

#### Solution 4: Simplify PDF

```bash
# Reduce complexity temporarily
# - Smaller font size
# - Fewer pages per PDF
# - Remove images/graphics
```

#### Solution 5: Alternative PDF Library

```bash
# Consider switching to PDFKit or Puppeteer
npm install pdfkit
# Or
npm install puppeteer
```

### Prevention

1. **Font Validation**: Check fonts on startup
2. **Memory Limits**: Ensure adequate memory for PDF generation
3. **Error Handling**: Better error messages for PDF issues
4. **Testing**: Regular PDF generation tests
5. **Alternatives**: Provide text download as fallback

### Escalation

If PDF generation consistently fails:
- Review PDF generation code
- Consider external PDF service (Adobe PDF Services)
- Provide alternative download formats (DOCX, TXT)

---

## Runbook 11: Monitoring Endpoints Down

### Symptoms
- `/api/monitoring/*` endpoints return 500 or timeout
- Metrics not being collected
- Alerts not firing

### Impact
- **Severity**: Low-Medium
- **User Impact**: None (internal)
- **Business Impact**: Loss of observability

### Investigation Steps

#### 1. Test Monitoring Endpoints

```bash
# Health
curl http://localhost:5001/api/monitoring/health

# Metrics
curl http://localhost:5001/api/monitoring/metrics

# Performance
curl http://localhost:5001/api/monitoring/performance
```

#### 2. Check Monitoring Service

```bash
# Check if monitoring routes are registered
pm2 logs tibetan-translation | grep -i "monitoring"

# Check for monitoring errors
pm2 logs tibetan-translation --err | grep -i "monitor"
```

#### 3. Check Database for Metrics

```bash
# Check if metrics are being stored
psql $DATABASE_URL -c "SELECT count(*) FROM metrics;"

# Check recent metrics
psql $DATABASE_URL -c "SELECT * FROM metrics ORDER BY recorded_at DESC LIMIT 10;"
```

### Resolution Steps

#### Solution 1: Restart Monitoring Service

```bash
# Restart application
pm2 restart tibetan-translation

# Verify monitoring endpoints
curl http://localhost:5001/api/monitoring/health
```

#### Solution 2: Check Monitoring Routes

```bash
# Verify monitoring routes are registered
# In server/routes.ts or server/index.ts
# Ensure monitoring router is imported and used

# Rebuild if needed
npm run build
pm2 restart tibetan-translation
```

#### Solution 3: Clear Metrics Buffer

```bash
# If metrics buffer is full
# Restart to clear
pm2 restart tibetan-translation

# Or implement buffer flush endpoint
curl -X POST http://localhost:5001/api/monitoring/flush
```

#### Solution 4: Fix Database Schema

```bash
# Ensure metrics table exists
psql $DATABASE_URL << EOF
CREATE TABLE IF NOT EXISTS metrics (
  id SERIAL PRIMARY KEY,
  metric_type VARCHAR(100),
  value FLOAT,
  metadata JSON,
  recorded_at TIMESTAMP DEFAULT NOW()
);
EOF
```

### Prevention

1. **Health Checks**: Monitor monitoring endpoints themselves
2. **Graceful Degradation**: Monitoring failures shouldn't affect main app
3. **Buffer Limits**: Implement buffer size limits
4. **Separate Service**: Consider separate monitoring service

---

## Runbook 12: WebSocket/SSE Connection Lost

### Symptoms
- Real-time updates stop working
- SSE connections disconnect
- Progress updates not received

### Impact
- **Severity**: Low-Medium
- **User Impact**: No real-time progress
- **Business Impact**: Poor UX for long translations

### Investigation Steps

#### 1. Test SSE Endpoint

```bash
# Test SSE connection
curl -N -H "Accept: text/event-stream" \
  http://localhost:5001/api/translate/stream \
  -H "Content-Type: application/json" \
  -d '{"text": "བཀྲ་ཤིས་བདེ་ལེགས།"}'
```

#### 2. Check Nginx Configuration

```bash
# SSE requires specific Nginx config
sudo nano /etc/nginx/sites-available/tibetan-translation

# Verify:
# proxy_buffering off;
# proxy_read_timeout 300s;
# proxy_set_header Connection '';
```

#### 3. Check Browser Console

```javascript
// In browser console
const eventSource = new EventSource('/api/translate/stream');
eventSource.onmessage = (event) => console.log(event.data);
eventSource.onerror = (error) => console.error(error);
```

### Resolution Steps

#### Solution 1: Fix Nginx Configuration

```nginx
location /api/translate/stream {
    proxy_pass http://localhost:5001;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection '';
    proxy_set_header Host $host;

    # SSE specific
    proxy_buffering off;
    proxy_cache off;
    proxy_read_timeout 300s;

    # CORS if needed
    add_header Access-Control-Allow-Origin *;
}
```

```bash
sudo nginx -t
sudo systemctl reload nginx
```

#### Solution 2: Increase Timeout

```bash
# In server code, increase SSE timeout
# res.setTimeout(300000); // 5 minutes

# Rebuild and restart
npm run build
pm2 restart tibetan-translation
```

#### Solution 3: Client Reconnection

```javascript
// Implement automatic reconnection on client
const connectSSE = () => {
  const eventSource = new EventSource('/api/translate/stream');

  eventSource.onerror = () => {
    eventSource.close();
    setTimeout(connectSSE, 3000); // Reconnect after 3s
  };
};
```

### Prevention

1. **Connection Keep-Alive**: Implement heartbeat/ping
2. **Automatic Reconnection**: Client-side reconnection logic
3. **Timeout Configuration**: Appropriate timeouts at all layers
4. **Fallback**: Polling fallback if SSE fails

---

## Quick Reference

### Common Commands

```bash
# Restart everything
pm2 restart tibetan-translation && docker restart tibetan-translation-redis tibetan-translation-db

# Check health
curl http://localhost:5001/api/monitoring/health

# View logs
pm2 logs tibetan-translation --lines 50

# Clear cache
redis-cli FLUSHDB

# Database backup
pg_dump tibetan_translation > backup.sql

# Check system resources
htop
free -h
df -h
```

### Emergency Contacts

- **On-Call Engineer**: [Phone/Email]
- **Database Admin**: [Phone/Email]
- **DevOps Lead**: [Phone/Email]
- **Google Cloud Support**: https://cloud.google.com/support

### Useful Links

- API Documentation: `/docs/api/openapi.yaml`
- Architecture: `/docs/architecture/ARCHITECTURE.md`
- Deployment: `/docs/deployment/DEPLOYMENT_GUIDE.md`
- GitHub Issues: https://github.com/your-org/tibetan-translation/issues

---

**Last Updated**: 2025-01-06
**Version**: 2.0.0
