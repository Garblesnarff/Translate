# Monitoring & Alerting Setup

This guide covers comprehensive monitoring and alerting setup for the Tibetan Translation Tool.

## Table of Contents

- [Overview](#overview)
- [Built-in Monitoring](#built-in-monitoring)
- [Prometheus & Grafana](#prometheus--grafana)
- [Cloud Monitoring](#cloud-monitoring)
- [Error Tracking](#error-tracking)
- [Alerting Rules](#alerting-rules)
- [Key Metrics](#key-metrics)
- [Dashboard Setup](#dashboard-setup)
- [Log Management](#log-management)

## Overview

The application provides multiple monitoring options:

1. **Built-in Monitoring** - REST API endpoints (Phase 2.2)
2. **Prometheus + Grafana** - Industry standard monitoring stack
3. **Cloud Platform Monitoring** - AWS CloudWatch, GCP Cloud Monitoring, Azure Monitor
4. **Error Tracking** - Sentry, Rollbar, Bugsnag
5. **Log Aggregation** - ELK Stack, Loki, Papertrail

## Built-in Monitoring

The application includes built-in monitoring endpoints (implemented in Phase 2.2).

### Available Endpoints

```bash
# System health check
GET /api/health

# System metrics (CPU, memory, uptime)
GET /api/monitoring/system

# Database metrics (connections, query performance)
GET /api/monitoring/database

# Translation service metrics
GET /api/monitoring/translations

# Cache metrics (hits, misses, size)
GET /api/monitoring/cache

# Export metrics for Prometheus
GET /metrics
```

### Example Usage

```bash
# Check system health
curl http://localhost:5439/api/health

# Get system metrics
curl http://localhost:5439/api/monitoring/system

# Get Prometheus metrics
curl http://localhost:5439/metrics
```

### Dashboard

Access the built-in monitoring dashboard at:

```
https://your-domain.com/monitoring
```

## Prometheus & Grafana

Prometheus is a powerful monitoring system with time-series database. Grafana provides visualization.

### Installation

#### Using Docker Compose

Add to `docker-compose.yml`:

```yaml
services:
  prometheus:
    image: prom/prometheus:latest
    container_name: prometheus
    ports:
      - "9090:9090"
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
      - prometheus_data:/prometheus
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.path=/prometheus'
    restart: unless-stopped

  grafana:
    image: grafana/grafana:latest
    container_name: grafana
    ports:
      - "3000:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin
    volumes:
      - grafana_data:/var/lib/grafana
      - ./grafana/provisioning:/etc/grafana/provisioning
    depends_on:
      - prometheus
    restart: unless-stopped

volumes:
  prometheus_data:
  grafana_data:
```

#### Prometheus Configuration

Create `prometheus.yml`:

```yaml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  - job_name: 'tibetan-translate'
    static_configs:
      - targets: ['app:5439']
    metrics_path: '/metrics'

  - job_name: 'node-exporter'
    static_configs:
      - targets: ['node-exporter:9100']

  - job_name: 'postgres-exporter'
    static_configs:
      - targets: ['postgres-exporter:9187']

  - job_name: 'redis-exporter'
    static_configs:
      - targets: ['redis-exporter:9121']
```

### Grafana Dashboards

#### Import Pre-built Dashboards

1. **Node.js Application Dashboard** - ID: 11159
2. **PostgreSQL Database** - ID: 9628
3. **Redis Dashboard** - ID: 11835
4. **System Metrics** - ID: 1860

Import in Grafana: Dashboards → Import → Enter ID

#### Custom Dashboard JSON

Create `grafana/provisioning/dashboards/tibetan-translate.json`:

```json
{
  "dashboard": {
    "title": "Tibetan Translation Tool",
    "panels": [
      {
        "title": "Request Rate",
        "targets": [
          {
            "expr": "rate(http_requests_total[5m])"
          }
        ]
      },
      {
        "title": "Error Rate",
        "targets": [
          {
            "expr": "rate(http_requests_total{status=~\"5..\"}[5m])"
          }
        ]
      },
      {
        "title": "Response Time (p95)",
        "targets": [
          {
            "expr": "histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))"
          }
        ]
      }
    ]
  }
}
```

### Alert Manager

Configure alerts in `alertmanager.yml`:

```yaml
global:
  resolve_timeout: 5m

route:
  group_by: ['alertname', 'severity']
  group_wait: 10s
  group_interval: 10s
  repeat_interval: 1h
  receiver: 'web.hook'

receivers:
  - name: 'web.hook'
    webhook_configs:
      - url: 'http://alertmanager-webhook:5001/'

  - name: 'slack'
    slack_configs:
      - api_url: 'YOUR_SLACK_WEBHOOK_URL'
        channel: '#alerts'
        title: 'Alert: {{ .GroupLabels.alertname }}'
        text: '{{ range .Alerts }}{{ .Annotations.description }}{{ end }}'

  - name: 'email'
    email_configs:
      - to: 'ops-team@example.com'
        from: 'alertmanager@example.com'
        smarthost: 'smtp.gmail.com:587'
        auth_username: 'alertmanager@example.com'
        auth_password: 'password'
```

## Cloud Monitoring

### AWS CloudWatch

#### Setup CloudWatch Agent

```bash
# Install CloudWatch agent
wget https://s3.amazonaws.com/amazoncloudwatch-agent/ubuntu/amd64/latest/amazon-cloudwatch-agent.deb
sudo dpkg -i amazon-cloudwatch-agent.deb

# Configure agent
sudo /opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-config-wizard
```

#### CloudWatch Configuration

Create `cloudwatch-config.json`:

```json
{
  "metrics": {
    "namespace": "TibetanTranslate",
    "metrics_collected": {
      "cpu": {
        "measurement": [
          {
            "name": "cpu_usage_idle",
            "rename": "CPU_IDLE",
            "unit": "Percent"
          }
        ],
        "totalcpu": false
      },
      "mem": {
        "measurement": [
          {
            "name": "mem_used_percent",
            "rename": "MEMORY_USED",
            "unit": "Percent"
          }
        ]
      }
    }
  },
  "logs": {
    "logs_collected": {
      "files": {
        "collect_list": [
          {
            "file_path": "/var/log/tibetan-translate/*.log",
            "log_group_name": "/aws/tibetan-translate",
            "log_stream_name": "{instance_id}"
          }
        ]
      }
    }
  }
}
```

### Google Cloud Monitoring

```bash
# Install Cloud Monitoring agent
curl -sSO https://dl.google.com/cloudagents/add-monitoring-agent-repo.sh
sudo bash add-monitoring-agent-repo.sh
sudo apt-get update
sudo apt-get install -y stackdriver-agent
```

### Azure Monitor

```bash
# Install Azure Monitor agent
wget https://aka.ms/dependencyagentlinux -O InstallDependencyAgent-Linux64.bin
sudo sh InstallDependencyAgent-Linux64.bin
```

## Error Tracking

### Sentry (Recommended)

#### Installation

```bash
npm install @sentry/node @sentry/profiling-node
```

#### Configuration

Add to `server/index.ts`:

```typescript
import * as Sentry from "@sentry/node";
import { ProfilingIntegration } from "@sentry/profiling-node";

// Initialize Sentry
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  integrations: [
    new ProfilingIntegration(),
  ],
  tracesSampleRate: 1.0,
  profilesSampleRate: 1.0,
  environment: process.env.NODE_ENV,
});

// Request handler middleware (must be first)
app.use(Sentry.Handlers.requestHandler());

// Tracing middleware
app.use(Sentry.Handlers.tracingHandler());

// Your routes here
// ...

// Error handler middleware (must be last)
app.use(Sentry.Handlers.errorHandler());
```

#### Environment Variables

```bash
SENTRY_DSN=https://examplePublicKey@o0.ingest.sentry.io/0
SENTRY_ENVIRONMENT=production
```

### Alternative: Rollbar

```bash
npm install rollbar
```

```typescript
import Rollbar from 'rollbar';

const rollbar = new Rollbar({
  accessToken: process.env.ROLLBAR_ACCESS_TOKEN,
  environment: process.env.NODE_ENV,
  captureUncaught: true,
  captureUnhandledRejections: true,
});

app.use(rollbar.errorHandler());
```

## Alerting Rules

### Critical Alerts

These require immediate attention (page ops team):

```yaml
# High Error Rate
- alert: HighErrorRate
  expr: |
    (
      sum(rate(http_requests_total{status=~"5.."}[5m]))
      /
      sum(rate(http_requests_total[5m]))
    ) > 0.05
  for: 5m
  labels:
    severity: critical
  annotations:
    summary: "High error rate detected"
    description: "Error rate is {{ $value | humanizePercentage }} (threshold: 5%)"

# Database Connection Failure
- alert: DatabaseDown
  expr: database_connections_active == 0
  for: 1m
  labels:
    severity: critical
  annotations:
    summary: "Database connection lost"
    description: "No active database connections detected"

# Application Down
- alert: ApplicationDown
  expr: up{job="tibetan-translate"} == 0
  for: 2m
  labels:
    severity: critical
  annotations:
    summary: "Application is down"
    description: "Tibetan Translation application is not responding"

# Out of Memory
- alert: HighMemoryUsage
  expr: memory_usage_percent > 90
  for: 5m
  labels:
    severity: critical
  annotations:
    summary: "High memory usage"
    description: "Memory usage is {{ $value }}% (threshold: 90%)"
```

### Warning Alerts

These should be investigated but aren't urgent:

```yaml
# Slow Response Time
- alert: SlowResponseTime
  expr: |
    histogram_quantile(0.95,
      rate(http_request_duration_seconds_bucket[5m])
    ) > 2
  for: 5m
  labels:
    severity: warning
  annotations:
    summary: "Slow response time"
    description: "95th percentile response time is {{ $value }}s (threshold: 2s)"

# High CPU Usage
- alert: HighCPUUsage
  expr: cpu_usage_percent > 80
  for: 10m
  labels:
    severity: warning
  annotations:
    summary: "High CPU usage"
    description: "CPU usage is {{ $value }}% (threshold: 80%)"

# Low Cache Hit Rate
- alert: LowCacheHitRate
  expr: cache_hit_rate < 0.7
  for: 15m
  labels:
    severity: warning
  annotations:
    summary: "Low cache hit rate"
    description: "Cache hit rate is {{ $value | humanizePercentage }} (threshold: 70%)"

# High Disk Usage
- alert: HighDiskUsage
  expr: disk_usage_percent > 85
  for: 5m
  labels:
    severity: warning
  annotations:
    summary: "High disk usage"
    description: "Disk usage is {{ $value }}% (threshold: 85%)"
```

### Info Alerts

These are informational:

```yaml
# Translation Job Failed
- alert: TranslationJobFailed
  expr: translation_job_failures_total > 0
  for: 1m
  labels:
    severity: info
  annotations:
    summary: "Translation job failed"
    description: "{{ $value }} translation jobs have failed"

# API Key Expiring Soon
- alert: APIKeyExpiring
  expr: api_key_expiry_days < 7
  for: 1h
  labels:
    severity: info
  annotations:
    summary: "API key expiring soon"
    description: "API key expires in {{ $value }} days"
```

## Key Metrics

### Application Metrics

| Metric | Description | Alert Threshold |
|--------|-------------|-----------------|
| `http_requests_total` | Total HTTP requests | N/A |
| `http_request_duration_seconds` | Request latency | p95 > 2s |
| `http_requests_errors_total` | HTTP error count | rate > 5% |
| `translation_jobs_total` | Total translation jobs | N/A |
| `translation_jobs_success` | Successful translations | N/A |
| `translation_jobs_failed` | Failed translations | > 0 |
| `translation_duration_seconds` | Translation processing time | p95 > 60s |

### System Metrics

| Metric | Description | Alert Threshold |
|--------|-------------|-----------------|
| `cpu_usage_percent` | CPU utilization | > 80% |
| `memory_usage_percent` | Memory utilization | > 90% |
| `disk_usage_percent` | Disk utilization | > 85% |
| `network_bytes_sent` | Network traffic (egress) | N/A |
| `network_bytes_received` | Network traffic (ingress) | N/A |

### Database Metrics

| Metric | Description | Alert Threshold |
|--------|-------------|-----------------|
| `database_connections_active` | Active DB connections | == 0 |
| `database_connections_idle` | Idle DB connections | N/A |
| `database_query_duration_seconds` | Query execution time | p95 > 1s |
| `database_errors_total` | Database errors | > 0 |

### Cache Metrics

| Metric | Description | Alert Threshold |
|--------|-------------|-----------------|
| `cache_hit_rate` | Cache hit percentage | < 70% |
| `cache_size_bytes` | Cache memory usage | N/A |
| `cache_entries_total` | Total cached items | N/A |
| `cache_evictions_total` | Cache evictions | N/A |

## Dashboard Setup

### Essential Dashboards

1. **Overview Dashboard**
   - Request rate (last 24h)
   - Error rate (last 24h)
   - Response time (p50, p95, p99)
   - Active users
   - Translation jobs (success/failure)

2. **System Resources Dashboard**
   - CPU usage
   - Memory usage
   - Disk usage
   - Network I/O
   - Process count

3. **Database Dashboard**
   - Connection pool status
   - Query performance
   - Slow queries
   - Lock contention
   - Table sizes

4. **Translation Service Dashboard**
   - Jobs in progress
   - Queue length
   - Processing time by page count
   - Success/failure rate
   - AI provider usage

5. **Cache Dashboard**
   - Hit/miss rate
   - Memory usage
   - Eviction rate
   - Most accessed keys

### Dashboard Access

- **Built-in**: `https://your-domain.com/monitoring`
- **Grafana**: `https://grafana.your-domain.com`
- **Prometheus**: `https://prometheus.your-domain.com`

## Log Management

### Log Levels

Configure in environment:

```bash
LOG_LEVEL=info  # debug, info, warn, error
LOG_FORMAT=json  # json, text
```

### Log Aggregation

#### ELK Stack (Elasticsearch, Logstash, Kibana)

Add to `docker-compose.yml`:

```yaml
elasticsearch:
  image: docker.elastic.co/elasticsearch/elasticsearch:8.10.0
  environment:
    - discovery.type=single-node
  ports:
    - "9200:9200"

logstash:
  image: docker.elastic.co/logstash/logstash:8.10.0
  volumes:
    - ./logstash.conf:/usr/share/logstash/pipeline/logstash.conf
  depends_on:
    - elasticsearch

kibana:
  image: docker.elastic.co/kibana/kibana:8.10.0
  ports:
    - "5601:5601"
  depends_on:
    - elasticsearch
```

#### Loki (Lightweight Alternative)

```yaml
loki:
  image: grafana/loki:latest
  ports:
    - "3100:3100"
  volumes:
    - loki_data:/loki

promtail:
  image: grafana/promtail:latest
  volumes:
    - /var/log:/var/log
    - ./promtail-config.yml:/etc/promtail/config.yml
  depends_on:
    - loki
```

### Structured Logging

Update application logging:

```typescript
import pino from 'pino';

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  formatters: {
    level: (label) => {
      return { level: label };
    },
  },
});

// Log with context
logger.info({
  translationId: '123',
  pageCount: 50,
  duration: 125.5
}, 'Translation completed');
```

## Notification Channels

### Slack Integration

```bash
# Webhook URL
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL

# Channel
SLACK_CHANNEL=#alerts
```

### Email Notifications

```bash
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=alerts@your-domain.com
SMTP_PASSWORD=your_password
ALERT_EMAIL=ops-team@your-domain.com
```

### PagerDuty Integration

```bash
PAGERDUTY_INTEGRATION_KEY=your_integration_key
```

## Testing Monitoring

### Test Alerts

```bash
# Trigger high error rate
for i in {1..100}; do
  curl http://localhost:5439/api/nonexistent &
done

# Trigger high CPU
stress --cpu 4 --timeout 60s

# Trigger memory alert
node -e "const arr = []; while(true) arr.push(new Array(1000000))"
```

### Verify Alert Delivery

1. Check Prometheus alerts: `http://prometheus:9090/alerts`
2. Check AlertManager: `http://alertmanager:9093`
3. Verify notification received (Slack, email, etc.)

## Best Practices

1. **Set Realistic Thresholds**: Base on production data
2. **Avoid Alert Fatigue**: Don't alert on everything
3. **Use Runbooks**: Document resolution steps
4. **Regular Testing**: Test alerts monthly
5. **Review Dashboards**: Keep them up to date
6. **Log Retention**: Balance cost vs. compliance
7. **Aggregate Logs**: Centralized logging is crucial
8. **Monitor Monitors**: Ensure monitoring system is healthy

## Troubleshooting

### No Metrics Available

```bash
# Check if Prometheus is scraping
curl http://localhost:9090/api/v1/targets

# Check application metrics endpoint
curl http://localhost:5439/metrics
```

### Alerts Not Firing

```bash
# Check Prometheus rules
curl http://localhost:9090/api/v1/rules

# Check AlertManager status
curl http://localhost:9093/api/v2/status
```

### High False Positive Rate

- Adjust alert thresholds
- Increase alert duration (`for: 5m` → `for: 10m`)
- Add more specific conditions

## Resources

- [Prometheus Documentation](https://prometheus.io/docs/)
- [Grafana Dashboards](https://grafana.com/grafana/dashboards/)
- [Sentry Documentation](https://docs.sentry.io/)
- [CloudWatch Documentation](https://docs.aws.amazon.com/cloudwatch/)

## Support

For monitoring issues:
- Check `/api/health` endpoint
- Review Grafana dashboards
- Check error tracking (Sentry)
- Review application logs
