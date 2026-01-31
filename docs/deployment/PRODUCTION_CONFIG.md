# Production Configuration Guide

This guide covers production deployment configuration for the Tibetan Translation Tool.

## Table of Contents

- [Environment Variables](#environment-variables)
- [Production Checklist](#production-checklist)
- [Database Configuration](#database-configuration)
- [Security Configuration](#security-configuration)
- [Performance Tuning](#performance-tuning)
- [SSL/TLS Configuration](#ssltls-configuration)
- [Deployment Platforms](#deployment-platforms)

## Environment Variables

### Required Variables

```bash
# Application Environment
NODE_ENV=production
PORT=5439

# Database (PostgreSQL recommended for production)
DATABASE_URL=postgresql://user:password@host:5432/tibetan_translate

# AI Provider Keys (at least one required)
GEMINI_API_KEY_ODD=your_gemini_key_for_odd_pages
GEMINI_API_KEY_EVEN=your_gemini_key_for_even_pages

# Security Secrets (MUST be unique and random)
SESSION_SECRET=random_secret_minimum_32_chars_change_me
API_KEY_ENCRYPTION_KEY=random_secret_minimum_32_chars_change_me
```

### Optional but Recommended

```bash
# Redis Cache (highly recommended for production)
REDIS_URL=redis://user:password@host:6379

# Additional AI Providers
OPENAI_API_KEY=your_openai_key_here
ANTHROPIC_API_KEY=your_anthropic_key_here

# Monitoring & Logging
SENTRY_DSN=https://your_sentry_dsn@sentry.io/project
LOG_LEVEL=info
LOG_FORMAT=json

# CORS Configuration
CORS_ORIGIN=https://your-frontend-domain.com

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Performance
MAX_CONNECTIONS=20
CACHE_MAX_SIZE=1000
CACHE_TTL=3600
WORKER_THREADS=4

# File Upload Limits
MAX_FILE_SIZE=52428800  # 50MB in bytes
MAX_FILES_PER_REQUEST=10

# OCR Configuration
ENABLE_OCR=true
OCR_CONFIDENCE_THRESHOLD=0.6
```

### Generating Secure Secrets

Use these commands to generate secure random secrets:

```bash
# Generate SESSION_SECRET (32 characters)
openssl rand -base64 32

# Generate API_KEY_ENCRYPTION_KEY (32 characters)
openssl rand -base64 32

# Alternative using Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

## Production Checklist

### Pre-Deployment

- [ ] All environment variables configured and tested
- [ ] Secrets generated using cryptographically secure methods
- [ ] Database migrations tested in staging
- [ ] SSL/TLS certificates acquired and configured
- [ ] Domain DNS configured
- [ ] CORS origins configured for frontend domain
- [ ] Rate limiting configured appropriately
- [ ] File upload limits set appropriately
- [ ] Monitoring and error tracking configured
- [ ] Backup system configured and tested
- [ ] Load testing completed
- [ ] Security audit completed

### Database Setup

- [ ] PostgreSQL database created
- [ ] Database user created with appropriate permissions
- [ ] Database connection tested
- [ ] Migrations applied: `npm run migrate:v2`
- [ ] Indexes created for performance
- [ ] Backup scheduled (daily minimum)
- [ ] Connection pooling configured

### Security

- [ ] SESSION_SECRET changed from default
- [ ] API_KEY_ENCRYPTION_KEY changed from default
- [ ] HTTPS/TLS enabled (no HTTP)
- [ ] Secure headers configured (helmet.js)
- [ ] CORS configured for specific origins (not *)
- [ ] Rate limiting enabled
- [ ] File upload validation enabled
- [ ] SQL injection protection verified (using Drizzle ORM)
- [ ] XSS protection enabled
- [ ] CSRF protection enabled

### Performance

- [ ] Redis configured for caching
- [ ] Database connection pooling enabled
- [ ] CDN configured for static assets (optional)
- [ ] Compression enabled (gzip/brotli)
- [ ] Worker threads configured
- [ ] Memory limits set appropriately
- [ ] Resource monitoring enabled

### Monitoring

- [ ] Health check endpoint tested: `/api/health`
- [ ] Metrics endpoint configured: `/api/metrics`
- [ ] Error tracking configured (Sentry recommended)
- [ ] Log aggregation configured
- [ ] Uptime monitoring enabled
- [ ] Alert rules configured
- [ ] Dashboard created

### Post-Deployment

- [ ] Smoke tests passed
- [ ] Health check passing
- [ ] SSL/TLS verified
- [ ] Performance metrics baseline established
- [ ] Monitoring alerts tested
- [ ] Backup tested and verified
- [ ] Rollback procedure tested
- [ ] Documentation updated
- [ ] Team notified

## Database Configuration

### PostgreSQL Production Setup

```bash
# Create database
createdb tibetan_translate

# Create user with limited privileges
psql -c "CREATE USER tibetan_app WITH PASSWORD 'secure_password_here';"
psql -c "GRANT ALL PRIVILEGES ON DATABASE tibetan_translate TO tibetan_app;"

# Run migrations
DATABASE_URL=postgresql://tibetan_app:password@localhost:5432/tibetan_translate \
  npm run migrate:v2
```

### Database Connection Pooling

Configure in your environment:

```bash
# Connection pool settings
DATABASE_MAX_CONNECTIONS=20
DATABASE_MIN_CONNECTIONS=2
DATABASE_IDLE_TIMEOUT=10000
DATABASE_CONNECTION_TIMEOUT=5000
```

### Database Performance

```sql
-- Create indexes for frequently queried columns
CREATE INDEX idx_translations_status ON translations(status);
CREATE INDEX idx_translations_created_at ON translations(created_at);
CREATE INDEX idx_batch_jobs_status ON batch_jobs(status);
CREATE INDEX idx_cache_entries_key ON cache_entries(key);

-- Enable query performance tracking
ALTER SYSTEM SET track_activities = on;
ALTER SYSTEM SET track_counts = on;
ALTER SYSTEM SET track_io_timing = on;
```

## Security Configuration

### Helmet.js Security Headers

Add to `server/index.ts`:

```typescript
import helmet from 'helmet';

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));
```

### CORS Configuration

```typescript
import cors from 'cors';

app.use(cors({
  origin: process.env.CORS_ORIGIN || 'https://your-frontend-domain.com',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
```

### Rate Limiting

Already configured in `server/index.ts`:

```typescript
import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP'
});

app.use('/api/', limiter);
```

## Performance Tuning

### Node.js Memory Configuration

```bash
# Increase Node.js memory limit for large translations
NODE_OPTIONS="--max-old-space-size=4096"
```

### Redis Configuration

```bash
# Redis memory limit and eviction policy
redis-cli CONFIG SET maxmemory 256mb
redis-cli CONFIG SET maxmemory-policy allkeys-lru
```

### Worker Threads

Configure in environment:

```bash
WORKER_THREADS=4  # Number of CPU cores
```

## SSL/TLS Configuration

### Using Let's Encrypt (Certbot)

```bash
# Install certbot
sudo apt-get install certbot

# Generate certificate
sudo certbot certonly --standalone -d tibetan-translate.example.com

# Certificates will be in:
# /etc/letsencrypt/live/tibetan-translate.example.com/
```

### Nginx Reverse Proxy

```nginx
server {
    listen 443 ssl http2;
    server_name tibetan-translate.example.com;

    ssl_certificate /etc/letsencrypt/live/tibetan-translate.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/tibetan-translate.example.com/privkey.pem;

    # SSL configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;

    location / {
        proxy_pass http://localhost:5439;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

# Redirect HTTP to HTTPS
server {
    listen 80;
    server_name tibetan-translate.example.com;
    return 301 https://$server_name$request_uri;
}
```

## Deployment Platforms

### Docker Deployment

See `docker-compose.yml` for local setup.

For production:

```bash
# Build image
docker build -t tibetan-translate:latest .

# Run with production settings
docker run -d \
  --name tibetan-translate \
  -p 5439:5439 \
  -e DATABASE_URL=postgresql://... \
  -e REDIS_URL=redis://... \
  -e GEMINI_API_KEY_ODD=... \
  -e GEMINI_API_KEY_EVEN=... \
  -v /var/app/uploads:/app/uploads \
  -v /var/app/cache:/app/cache \
  tibetan-translate:latest
```

### VPS Deployment (Hetzner, DigitalOcean, etc.)

```bash
# SSH into VPS
ssh user@your-vps-ip

# Install dependencies
sudo apt-get update
sudo apt-get install -y nodejs npm postgresql redis-server nginx

# Clone repository
git clone https://github.com/your-repo/tibetan-translate.git
cd tibetan-translate

# Install dependencies
npm ci --only=production

# Build application
npm run build

# Configure environment
cp .env.example .env
# Edit .env with production values

# Run migrations
npm run migrate:v2

# Install PM2 for process management
npm install -g pm2

# Start application
pm2 start dist/index.js --name tibetan-translate

# Configure PM2 to start on boot
pm2 startup
pm2 save
```

### Cloud Platform Deployment

#### AWS (Elastic Beanstalk)

Create `Dockerrun.aws.json`:

```json
{
  "AWSEBDockerrunVersion": "1",
  "Image": {
    "Name": "your-docker-hub-user/tibetan-translate:latest"
  },
  "Ports": [
    {
      "ContainerPort": 5439
    }
  ]
}
```

#### Google Cloud Platform (Cloud Run)

```bash
# Build and push to Google Container Registry
gcloud builds submit --tag gcr.io/PROJECT_ID/tibetan-translate

# Deploy to Cloud Run
gcloud run deploy tibetan-translate \
  --image gcr.io/PROJECT_ID/tibetan-translate \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated
```

#### Heroku

```bash
# Login to Heroku
heroku login

# Create app
heroku create tibetan-translate

# Add PostgreSQL
heroku addons:create heroku-postgresql:hobby-dev

# Add Redis
heroku addons:create heroku-redis:hobby-dev

# Set environment variables
heroku config:set NODE_ENV=production
heroku config:set GEMINI_API_KEY_ODD=your_key
heroku config:set GEMINI_API_KEY_EVEN=your_key

# Deploy
git push heroku main
```

## Environment-Specific Configurations

### Development

```bash
NODE_ENV=development
DATABASE_URL=sqlite:///tibetan_translation.db
LOG_LEVEL=debug
```

### Staging

```bash
NODE_ENV=staging
DATABASE_URL=postgresql://staging_user:password@staging-db:5432/staging_db
LOG_LEVEL=info
```

### Production

```bash
NODE_ENV=production
DATABASE_URL=postgresql://prod_user:password@prod-db:5432/prod_db
LOG_LEVEL=warn
```

## Health Checks

The application exposes health check endpoints:

```bash
# Basic health check
curl https://your-domain.com/api/health

# Detailed system status
curl https://your-domain.com/api/monitoring/system

# Database health
curl https://your-domain.com/api/monitoring/database
```

## Troubleshooting

### Database Connection Issues

```bash
# Test database connection
psql $DATABASE_URL -c "SELECT version();"

# Check connection pool
curl https://your-domain.com/api/monitoring/database
```

### High Memory Usage

```bash
# Check Node.js memory
NODE_OPTIONS="--max-old-space-size=4096"

# Monitor with PM2
pm2 monit
```

### Slow Performance

- Check Redis connection
- Review database indexes
- Check rate limiting configuration
- Monitor system resources

## Support

For issues or questions:

- Check logs: `pm2 logs` or `docker logs`
- Review monitoring dashboards
- Check error tracking (Sentry)
- Consult documentation in `/docs`

## Security Contacts

Report security vulnerabilities to: security@your-domain.com
