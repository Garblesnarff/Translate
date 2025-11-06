# Deployment Quick Start Guide

**Last Updated**: November 6, 2024

This is a quick reference for deploying the Tibetan Translation Tool. For detailed documentation, see `/docs/deployment/`.

## Prerequisites

```bash
# Install Docker & Docker Compose
curl -fsSL https://get.docker.com | sh

# Verify installation
docker --version
docker-compose --version
```

## Quick Deploy (5 Minutes)

### 1. Clone & Configure

```bash
# Clone repository
git clone https://github.com/your-org/tibetan-translate.git
cd tibetan-translate

# Configure environment
cp .env.example .env

# Edit .env with your values
nano .env
```

**Required Environment Variables**:
```bash
# AI Provider (at least one required)
GEMINI_API_KEY_ODD=your_key_here
GEMINI_API_KEY_EVEN=your_key_here

# Security (generate with: openssl rand -base64 32)
SESSION_SECRET=your_random_secret_32_chars
API_KEY_ENCRYPTION_KEY=your_random_secret_32_chars

# Database (optional for development)
DATABASE_URL=postgresql://user:pass@host:5432/db
```

### 2. Start Application

```bash
# Development (SQLite)
docker-compose up -d

# Production (PostgreSQL)
docker-compose -f docker-compose.yml up -d
```

### 3. Verify Deployment

```bash
# Check health
curl http://localhost:5439/api/health

# Check logs
docker logs tibetan-translate-app -f

# Access application
open http://localhost:5439
```

## Common Commands

### Docker

```bash
# Start all services
docker-compose up -d

# Stop all services
docker-compose down

# View logs
docker-compose logs -f app

# Restart application
docker-compose restart app

# Rebuild and restart
docker-compose up -d --build

# Scale instances
docker-compose up -d --scale app=3
```

### Database

```bash
# Run migrations
npm run migrate:v2

# Check migration status
npm run migrate:v2:status

# Rollback last migration
npm run migrate:v2:rollback

# Connect to database
docker-compose exec db psql -U postgres -d tibetan_translate
```

### Logs

```bash
# Application logs
docker-compose logs app -f

# Database logs
docker-compose logs db -f

# All logs
docker-compose logs -f
```

## Production Deployment

### Option 1: Automated Script

```bash
# Deploy to staging
./scripts/deploy.sh staging

# Deploy to production
./scripts/deploy.sh production v1.0.0
```

### Option 2: Manual Deployment

```bash
# 1. Build production image
docker build -t tibetan-translate:latest .

# 2. Run migrations
npm run migrate:v2

# 3. Start container
docker run -d \
  --name tibetan-translate \
  -p 5439:5439 \
  -e DATABASE_URL=postgresql://... \
  -e GEMINI_API_KEY_ODD=... \
  -e GEMINI_API_KEY_EVEN=... \
  -e SESSION_SECRET=... \
  -v tibetan-uploads:/app/uploads \
  -v tibetan-cache:/app/cache \
  --restart unless-stopped \
  tibetan-translate:latest

# 4. Verify
curl http://localhost:5439/api/health
```

## Monitoring

### Health Checks

```bash
# Basic health
curl http://localhost:5439/api/health

# System metrics
curl http://localhost:5439/api/monitoring/system

# Database metrics
curl http://localhost:5439/api/monitoring/database

# Cache metrics
curl http://localhost:5439/api/monitoring/cache
```

### Dashboards

- **Application**: http://localhost:5439
- **pgAdmin** (optional): http://localhost:5050
- **Prometheus**: http://localhost:9090 (if configured)
- **Grafana**: http://localhost:3000 (if configured)

## Backup

### Manual Backup

```bash
# Database backup
docker-compose exec db pg_dump -U postgres tibetan_translate | gzip > backup_$(date +%Y%m%d).sql.gz

# Upload to S3
aws s3 cp backup_$(date +%Y%m%d).sql.gz s3://your-bucket/backups/
```

### Automated Backup (Production)

```bash
# Set up automated backups
chmod +x /opt/backups/scripts/backup-all.sh

# Add to crontab
crontab -e

# Add this line (daily at 2 AM)
0 2 * * * /opt/backups/scripts/backup-all.sh >> /var/log/backup.log 2>&1
```

## Troubleshooting

### Application Won't Start

```bash
# Check logs
docker-compose logs app

# Check environment variables
docker-compose config

# Restart services
docker-compose restart
```

### Database Connection Error

```bash
# Check database is running
docker-compose ps db

# Check database logs
docker-compose logs db

# Verify DATABASE_URL
echo $DATABASE_URL
```

### High Memory Usage

```bash
# Check resource usage
docker stats

# Increase Node.js memory
# Add to docker-compose.yml:
environment:
  - NODE_OPTIONS=--max-old-space-size=4096
```

### Port Already in Use

```bash
# Find process using port 5439
lsof -i :5439

# Kill process
kill -9 <PID>

# Or change port in docker-compose.yml
ports:
  - "5440:5439"
```

## Environment-Specific Configs

### Development

```bash
NODE_ENV=development
DATABASE_URL=sqlite:///tibetan_translation.db
LOG_LEVEL=debug
ENABLE_OCR=true
```

### Staging

```bash
NODE_ENV=staging
DATABASE_URL=postgresql://staging_user:pass@staging-db:5432/staging_db
REDIS_URL=redis://staging-redis:6379
LOG_LEVEL=info
```

### Production

```bash
NODE_ENV=production
DATABASE_URL=postgresql://prod_user:pass@prod-db:5432/prod_db
REDIS_URL=redis://prod-redis:6379
LOG_LEVEL=warn
ENABLE_CACHING=true
```

## Security Checklist

Before deploying to production:

- [ ] Change SESSION_SECRET from default
- [ ] Change API_KEY_ENCRYPTION_KEY from default
- [ ] Set strong database password
- [ ] Configure CORS for specific origins
- [ ] Enable SSL/TLS (HTTPS)
- [ ] Set up firewall rules
- [ ] Enable rate limiting
- [ ] Configure security headers
- [ ] Set up monitoring alerts
- [ ] Enable automated backups

## Scaling

### Vertical Scaling (Bigger Server)

```bash
# Increase resources in docker-compose.yml
deploy:
  resources:
    limits:
      cpus: '4'
      memory: 8G
```

### Horizontal Scaling (More Instances)

```bash
# Scale to 3 instances
docker-compose up -d --scale app=3

# Use nginx as load balancer
# See: /docs/deployment/PRODUCTION_CONFIG.md
```

## Performance Tips

1. **Enable Redis caching**
   ```bash
   REDIS_URL=redis://localhost:6379
   ENABLE_CACHING=true
   ```

2. **Increase worker threads**
   ```bash
   WORKER_THREADS=4
   ```

3. **Optimize database**
   ```bash
   # Create indexes
   docker-compose exec db psql -U postgres -d tibetan_translate -c "CREATE INDEX idx_translations_status ON translations(status);"
   ```

4. **Enable compression**
   ```bash
   # Already enabled by default
   ```

## Useful Links

- **Production Config**: `/docs/deployment/PRODUCTION_CONFIG.md`
- **Monitoring Setup**: `/docs/deployment/MONITORING_SETUP.md`
- **Backup & Recovery**: `/docs/deployment/BACKUP_RECOVERY.md`
- **Deployment Hub**: `/docs/deployment/README.md`
- **GitHub Actions**: `/.github/workflows/ci-cd.yml`

## Getting Help

### Check Documentation

```bash
# View all deployment docs
ls -l docs/deployment/

# Read production config
cat docs/deployment/PRODUCTION_CONFIG.md
```

### Review Logs

```bash
# Application logs
docker-compose logs app -f

# System logs
journalctl -u docker -f

# Health check
curl http://localhost:5439/api/health
```

### Common Issues

| Issue | Solution |
|-------|----------|
| Port in use | Change port or kill process |
| DB connection failed | Check DATABASE_URL and db container |
| Build fails | Check TypeScript errors |
| High memory | Increase NODE_OPTIONS |
| Slow performance | Enable Redis, add indexes |

## Emergency Procedures

### Rollback Deployment

```bash
# Stop current version
docker-compose down

# Checkout previous version
git checkout v1.0.0

# Rebuild and restart
docker-compose up -d --build
```

### Restore from Backup

```bash
# Download latest backup
aws s3 cp s3://your-bucket/backups/latest.sql.gz /tmp/

# Restore database
gunzip < /tmp/latest.sql.gz | docker-compose exec -T db psql -U postgres tibetan_translate

# Restart application
docker-compose restart app
```

## Support

- **Documentation**: `/docs`
- **GitHub Issues**: https://github.com/your-org/tibetan-translate/issues
- **Email**: devops@example.com

---

**Quick Start Complete!** For detailed information, see `/docs/deployment/README.md`
