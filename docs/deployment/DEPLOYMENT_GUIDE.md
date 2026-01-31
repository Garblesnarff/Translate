# Tibetan Translation Tool - Deployment Guide

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Environment Setup](#environment-setup)
3. [Development Deployment](#development-deployment)
4. [Production Deployment](#production-deployment)
5. [Docker Deployment](#docker-deployment)
6. [Cloud Deployment](#cloud-deployment)
7. [Post-Deployment](#post-deployment)
8. [Maintenance](#maintenance)
9. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Required Software

| Software | Minimum Version | Purpose |
|----------|----------------|---------|
| Node.js | 18.0.0+ | Runtime environment |
| npm | 9.0.0+ | Package manager |
| PostgreSQL | 14.0+ | Production database (optional) |
| Redis | 6.0+ | Caching layer (optional) |
| Git | 2.30+ | Version control |

### Optional Software

| Software | Purpose |
|----------|---------|
| Docker | Containerization |
| Docker Compose | Multi-container orchestration |
| Tesseract OCR | OCR support for scanned PDFs |
| PM2 | Process management |

### API Keys Required

You'll need Google Gemini API keys:

1. Visit [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Create two API keys (for odd/even page processing)
3. Save keys securely for environment configuration

### System Requirements

**Development:**
- CPU: 2+ cores
- RAM: 4GB+
- Disk: 2GB+ free space
- OS: Linux, macOS, Windows

**Production:**
- CPU: 4+ cores
- RAM: 8GB+
- Disk: 10GB+ free space
- OS: Linux (Ubuntu 20.04+ recommended)

---

## Environment Setup

### 1. Clone Repository

```bash
git clone https://github.com/your-org/tibetan-translation.git
cd tibetan-translation
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment Variables

Create a `.env` file in the project root:

```bash
# Required - Gemini API Keys
GEMINI_API_KEY_ODD=your_gemini_api_key_for_odd_pages
GEMINI_API_KEY_EVEN=your_gemini_api_key_for_even_pages

# Optional - Database Configuration
# Leave blank for SQLite (development default)
DATABASE_URL=postgresql://user:password@localhost:5432/tibetan_translation

# Optional - Redis Cache
REDIS_URL=redis://localhost:6379

# Optional - Server Configuration
PORT=5001
NODE_ENV=production

# Optional - Monitoring
ENABLE_MONITORING=true
LOG_LEVEL=info

# Optional - n8n Webhook (for batch completion notifications)
N8N_WEBHOOK_URL=http://localhost:5678/webhook/batch-complete

# Optional - API Authentication
API_KEY=your_secure_api_key_here
```

### 4. Database Setup

#### SQLite (Development)

No setup required. Database file (`tibetan_translation.db`) will be created automatically.

#### PostgreSQL (Production)

```bash
# Create database
createdb tibetan_translation

# Set DATABASE_URL in .env
DATABASE_URL=postgresql://user:password@localhost:5432/tibetan_translation

# Run migrations
npm run migrate:v2
```

### 5. Verify Installation

```bash
# Type checking
npm run check

# Run tests (optional)
npm test
```

---

## Development Deployment

### Quick Start

```bash
# Start development server with hot reload
npm run dev
```

The server will start on http://localhost:5001

### With Gemini API Keys

```bash
# Set API keys inline (one-time)
GEMINI_API_KEY_ODD=your_key GEMINI_API_KEY_EVEN=your_key npm run dev
```

### Development Features

- Hot Module Replacement (HMR) via Vite
- SQLite database (auto-created)
- Detailed error messages
- Source maps for debugging
- Auto-restart on code changes

### Development Workflow

1. **Start Server**: `npm run dev`
2. **Open Browser**: http://localhost:5001
3. **Make Changes**: Code updates trigger auto-reload
4. **Test Translation**: Upload PDF or enter Tibetan text
5. **Check Logs**: Console shows detailed request/response logs

### Development Database Management

```bash
# Check database schema
npm run db:push

# View migrations status
npm run migrate:v2:status

# SQLite CLI (inspect database)
sqlite3 tibetan_translation.db
```

---

## Production Deployment

### 1. Build Application

```bash
# Build client and server
npm run build
```

This creates:
- `dist/client/` - Frontend static files
- `dist/index.js` - Backend server bundle

### 2. Configure Production Environment

```bash
# Production .env
NODE_ENV=production
PORT=5001
DATABASE_URL=postgresql://user:password@host:5432/tibetan_translation
REDIS_URL=redis://host:6379
GEMINI_API_KEY_ODD=your_key
GEMINI_API_KEY_EVEN=your_key
LOG_LEVEL=warn
ENABLE_MONITORING=true
```

### 3. Database Migration

```bash
# Run migrations
NODE_ENV=production npm run migrate:v2

# Verify migration status
npm run migrate:v2:status
```

### 4. Start Production Server

```bash
# Direct start
npm run start

# With PM2 (recommended)
pm2 start npm --name "tibetan-translation" -- start
pm2 save
pm2 startup
```

### 5. Verify Deployment

```bash
# Health check
curl http://localhost:5001/api/monitoring/health

# Expected response:
# {"status":"healthy","timestamp":"...","uptime":123,"memory":{...}}
```

### Production Best Practices

#### Process Management (PM2)

```bash
# Install PM2 globally
npm install -g pm2

# Start with PM2
pm2 start npm --name "tibetan-translation" -- start

# Monitor
pm2 monit

# View logs
pm2 logs tibetan-translation

# Restart on failure
pm2 restart tibetan-translation

# Save configuration
pm2 save
pm2 startup
```

#### Reverse Proxy (Nginx)

```nginx
# /etc/nginx/sites-available/tibetan-translation
server {
    listen 80;
    server_name your-domain.com;

    # Redirect to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Proxy to Node.js
    location / {
        proxy_pass http://localhost:5001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # SSE support
        proxy_read_timeout 300s;
        proxy_buffering off;
    }

    # Static files cache
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        proxy_pass http://localhost:5001;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

```bash
# Enable site
sudo ln -s /etc/nginx/sites-available/tibetan-translation /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

#### SSL/TLS (Certbot)

```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx

# Obtain certificate
sudo certbot --nginx -d your-domain.com

# Auto-renewal is configured automatically
# Test renewal:
sudo certbot renew --dry-run
```

---

## Docker Deployment

### 1. Create Dockerfile

```dockerfile
# /home/user/Translate/Dockerfile
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source
COPY . .

# Build application
RUN npm run build

# Production image
FROM node:18-alpine

WORKDIR /app

# Install production dependencies only
COPY package*.json ./
RUN npm ci --only=production

# Copy built files
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/client/dist ./client/dist

# Expose port
EXPOSE 5001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:5001/api/monitoring/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start server
CMD ["npm", "run", "start"]
```

### 2. Create docker-compose.yml

```yaml
# /home/user/Translate/docker-compose.yml
version: '3.8'

services:
  app:
    build: .
    container_name: tibetan-translation
    ports:
      - "5001:5001"
    environment:
      - NODE_ENV=production
      - PORT=5001
      - DATABASE_URL=postgresql://postgres:password@db:5432/tibetan_translation
      - REDIS_URL=redis://redis:6379
      - GEMINI_API_KEY_ODD=${GEMINI_API_KEY_ODD}
      - GEMINI_API_KEY_EVEN=${GEMINI_API_KEY_EVEN}
    depends_on:
      - db
      - redis
    restart: unless-stopped
    volumes:
      - ./logs:/app/logs
    networks:
      - app-network

  db:
    image: postgres:14-alpine
    container_name: tibetan-translation-db
    environment:
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=password
      - POSTGRES_DB=tibetan_translation
    ports:
      - "5432:5432"
    volumes:
      - postgres-data:/var/lib/postgresql/data
    restart: unless-stopped
    networks:
      - app-network

  redis:
    image: redis:7-alpine
    container_name: tibetan-translation-redis
    ports:
      - "6379:6379"
    volumes:
      - redis-data:/data
    restart: unless-stopped
    networks:
      - app-network

volumes:
  postgres-data:
  redis-data:

networks:
  app-network:
    driver: bridge
```

### 3. Build and Run

```bash
# Build image
docker build -t tibetan-translation:latest .

# Start services
docker-compose up -d

# View logs
docker-compose logs -f app

# Stop services
docker-compose down

# Stop and remove volumes
docker-compose down -v
```

### 4. Docker Management

```bash
# View running containers
docker ps

# Execute command in container
docker exec -it tibetan-translation sh

# View logs
docker logs tibetan-translation -f

# Restart container
docker restart tibetan-translation

# Update container
docker-compose pull
docker-compose up -d
```

---

## Cloud Deployment

### Heroku

```bash
# Install Heroku CLI
curl https://cli-assets.heroku.com/install.sh | sh

# Login
heroku login

# Create app
heroku create tibetan-translation

# Add PostgreSQL
heroku addons:create heroku-postgresql:mini

# Add Redis
heroku addons:create heroku-redis:mini

# Set environment variables
heroku config:set GEMINI_API_KEY_ODD=your_key
heroku config:set GEMINI_API_KEY_EVEN=your_key
heroku config:set NODE_ENV=production

# Deploy
git push heroku main

# View logs
heroku logs --tail

# Open app
heroku open
```

### Railway

1. **Create Railway Account**: https://railway.app
2. **New Project**: Click "New Project"
3. **Deploy from GitHub**: Connect repository
4. **Add PostgreSQL**: Click "New" → "Database" → "PostgreSQL"
5. **Add Redis**: Click "New" → "Database" → "Redis"
6. **Environment Variables**:
   ```
   GEMINI_API_KEY_ODD=your_key
   GEMINI_API_KEY_EVEN=your_key
   NODE_ENV=production
   ```
7. **Deploy**: Railway auto-deploys on git push

### Vercel (Frontend) + Railway (Backend)

#### Frontend (Vercel)

1. **Install Vercel CLI**:
   ```bash
   npm i -g vercel
   ```

2. **Deploy**:
   ```bash
   vercel --prod
   ```

3. **Environment Variables**:
   - `VITE_API_URL=https://your-api.railway.app`

#### Backend (Railway)

Follow Railway instructions above.

### AWS EC2

```bash
# Connect to EC2 instance
ssh -i your-key.pem ubuntu@your-ec2-ip

# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Install PostgreSQL
sudo apt install -y postgresql postgresql-contrib

# Clone repository
git clone https://github.com/your-org/tibetan-translation.git
cd tibetan-translation

# Install dependencies
npm install

# Configure environment
cp .env.example .env
nano .env  # Edit with your values

# Build
npm run build

# Install PM2
sudo npm install -g pm2

# Start application
pm2 start npm --name "tibetan-translation" -- start
pm2 save
pm2 startup

# Install Nginx
sudo apt install -y nginx
sudo nano /etc/nginx/sites-available/tibetan-translation
# (Copy Nginx config from above)

sudo ln -s /etc/nginx/sites-available/tibetan-translation /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx

# Install SSL
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

### Google Cloud Run

```bash
# Install gcloud CLI
curl https://sdk.cloud.google.com | bash

# Login
gcloud auth login

# Set project
gcloud config set project your-project-id

# Build container
gcloud builds submit --tag gcr.io/your-project-id/tibetan-translation

# Deploy
gcloud run deploy tibetan-translation \
  --image gcr.io/your-project-id/tibetan-translation \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars GEMINI_API_KEY_ODD=your_key,GEMINI_API_KEY_EVEN=your_key
```

---

## Post-Deployment

### 1. Health Checks

```bash
# API health
curl https://your-domain.com/api/monitoring/health

# System status
curl https://your-domain.com/api/status

# Metrics
curl https://your-domain.com/api/monitoring/metrics
```

### 2. Monitoring Setup

#### Application Monitoring

```bash
# PM2 monitoring
pm2 monit

# Custom metrics endpoint
curl https://your-domain.com/api/monitoring/metrics
```

#### External Monitoring (UptimeRobot)

1. Visit https://uptimerobot.com
2. Add new monitor:
   - Type: HTTP(s)
   - URL: `https://your-domain.com/api/monitoring/health`
   - Interval: 5 minutes
3. Configure alert contacts

#### Log Management

```bash
# View application logs
pm2 logs tibetan-translation

# Rotate logs
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7

# Or use external logging (Papertrail, Loggly)
```

### 3. Backup Configuration

#### Database Backups

```bash
# PostgreSQL backup script
#!/bin/bash
# /home/user/backup-db.sh

BACKUP_DIR="/backups/tibetan-translation"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
DB_NAME="tibetan_translation"

mkdir -p $BACKUP_DIR

pg_dump $DB_NAME > $BACKUP_DIR/backup_$TIMESTAMP.sql

# Keep only last 7 days
find $BACKUP_DIR -name "backup_*.sql" -mtime +7 -delete

echo "Backup completed: backup_$TIMESTAMP.sql"
```

```bash
# Make executable and add to cron
chmod +x /home/user/backup-db.sh

# Add to crontab (daily at 2 AM)
crontab -e
# Add line:
0 2 * * * /home/user/backup-db.sh
```

#### File Backups

```bash
# Backup application files
tar -czf tibetan-translation-$(date +%Y%m%d).tar.gz /path/to/tibetan-translation

# Upload to S3 (optional)
aws s3 cp tibetan-translation-$(date +%Y%m%d).tar.gz s3://your-bucket/backups/
```

### 4. Security Hardening

```bash
# Firewall (UFW)
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable

# Fail2Ban (brute force protection)
sudo apt install fail2ban
sudo systemctl enable fail2ban
sudo systemctl start fail2ban

# Update packages regularly
sudo apt update && sudo apt upgrade -y

# Security patches auto-install
sudo apt install unattended-upgrades
sudo dpkg-reconfigure --priority=low unattended-upgrades
```

---

## Maintenance

### Updating Application

```bash
# Pull latest changes
cd /path/to/tibetan-translation
git pull origin main

# Install new dependencies
npm install

# Run migrations (if any)
npm run migrate:v2

# Rebuild
npm run build

# Restart
pm2 restart tibetan-translation

# Verify
curl http://localhost:5001/api/monitoring/health
```

### Database Maintenance

```bash
# Vacuum (optimize PostgreSQL)
psql tibetan_translation -c "VACUUM ANALYZE;"

# Check database size
psql tibetan_translation -c "SELECT pg_size_pretty(pg_database_size('tibetan_translation'));"

# Check table sizes
psql tibetan_translation -c "SELECT tablename, pg_size_pretty(pg_total_relation_size(tablename::text)) FROM pg_tables WHERE schemaname='public' ORDER BY pg_total_relation_size(tablename::text) DESC;"
```

### Cache Maintenance

```bash
# Clear Redis cache
redis-cli FLUSHDB

# Check cache statistics
redis-cli INFO stats
```

### Log Rotation

```bash
# Configure logrotate
sudo nano /etc/logrotate.d/tibetan-translation

# Add:
/path/to/tibetan-translation/logs/*.log {
    daily
    missingok
    rotate 14
    compress
    delaycompress
    notifempty
    create 0640 www-data www-data
    sharedscripts
    postrotate
        pm2 reloadLogs
    endscript
}
```

---

## Troubleshooting

### Server Won't Start

```bash
# Check port availability
sudo lsof -i :5001

# Check logs
pm2 logs tibetan-translation --lines 100

# Check environment variables
printenv | grep GEMINI

# Verify Node.js version
node --version  # Should be 18+
```

### Database Connection Issues

```bash
# Test PostgreSQL connection
psql $DATABASE_URL

# Check PostgreSQL service
sudo systemctl status postgresql

# Restart PostgreSQL
sudo systemctl restart postgresql

# Check connection pool
psql tibetan_translation -c "SELECT count(*) FROM pg_stat_activity;"
```

### Translation Failures

```bash
# Verify API keys
curl -H "Authorization: Bearer $GEMINI_API_KEY_ODD" \
  https://generativelanguage.googleapis.com/v1/models

# Check API quota
# Visit: https://console.cloud.google.com/apis/dashboard

# View error logs
pm2 logs tibetan-translation --err --lines 50
```

### High Memory Usage

```bash
# Check memory
free -h

# Check Node.js memory
pm2 show tibetan-translation

# Restart if needed
pm2 restart tibetan-translation

# Increase PM2 max memory
pm2 start npm --name "tibetan-translation" --max-memory-restart 1G -- start
```

### Performance Issues

```bash
# Check system resources
htop

# Check database performance
psql tibetan_translation -c "SELECT * FROM pg_stat_statements ORDER BY total_time DESC LIMIT 10;"

# Check Redis performance
redis-cli --latency

# Check Nginx logs
sudo tail -f /var/log/nginx/access.log
```

---

## Performance Tuning

### Node.js Optimization

```bash
# Increase max old space size
NODE_OPTIONS="--max-old-space-size=4096" npm run start

# Enable cluster mode (PM2)
pm2 start npm --name "tibetan-translation" -i max -- start
```

### PostgreSQL Optimization

```sql
-- postgresql.conf optimizations
shared_buffers = 256MB
effective_cache_size = 1GB
maintenance_work_mem = 64MB
checkpoint_completion_target = 0.9
wal_buffers = 16MB
default_statistics_target = 100
random_page_cost = 1.1
effective_io_concurrency = 200
work_mem = 16MB
min_wal_size = 1GB
max_wal_size = 4GB
```

### Redis Optimization

```bash
# redis.conf
maxmemory 256mb
maxmemory-policy allkeys-lru
```

---

## Support

For deployment issues:
- GitHub Issues: https://github.com/your-org/tibetan-translation/issues
- Documentation: https://github.com/your-org/tibetan-translation/docs
- Email: support@your-domain.com

---

**Deployment Checklist:**

- [ ] Prerequisites installed
- [ ] Repository cloned
- [ ] Dependencies installed
- [ ] Environment variables configured
- [ ] Database setup complete
- [ ] Application built
- [ ] Server started
- [ ] Health check passed
- [ ] Monitoring configured
- [ ] Backups scheduled
- [ ] SSL/TLS configured
- [ ] Firewall configured
- [ ] Logs rotating
- [ ] Documentation reviewed
