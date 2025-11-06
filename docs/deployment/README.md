# Deployment Documentation

Welcome to the deployment documentation for the Tibetan Translation Tool. This directory contains everything you need to deploy and maintain the application in production.

## Quick Links

- **[Production Configuration Guide](PRODUCTION_CONFIG.md)** - Environment setup, security, and platform-specific deployment
- **[Monitoring & Alerting Setup](MONITORING_SETUP.md)** - Comprehensive monitoring with Prometheus, Grafana, and error tracking
- **[Backup & Recovery Procedures](BACKUP_RECOVERY.md)** - Complete backup strategy and disaster recovery plan

## Overview

The Tibetan Translation Tool is a production-ready application designed for automated translation of Tibetan texts. This deployment infrastructure supports:

- ✅ **Docker containerization** with multi-stage builds
- ✅ **CI/CD pipelines** with GitHub Actions
- ✅ **Production-grade monitoring** and alerting
- ✅ **Automated backups** with disaster recovery
- ✅ **Multi-platform deployment** (Docker, VPS, Cloud)

## Getting Started

### Prerequisites

- Docker & Docker Compose
- Node.js 18+ (for non-Docker deployments)
- PostgreSQL 14+ (or SQLite for development)
- Redis 7+ (optional but recommended)
- AI Provider API Keys (Gemini, OpenAI, or Anthropic)

### Quick Start with Docker

1. **Clone the repository**:
   ```bash
   git clone https://github.com/your-org/tibetan-translate.git
   cd tibetan-translate
   ```

2. **Configure environment**:
   ```bash
   cp .env.example .env
   # Edit .env with your production values
   ```

3. **Start with Docker Compose**:
   ```bash
   docker-compose up -d
   ```

4. **Access the application**:
   - Application: http://localhost:5439
   - Health Check: http://localhost:5439/api/health
   - pgAdmin (optional): http://localhost:5050

### Production Deployment

For production deployment, follow these guides:

1. **[Production Configuration](PRODUCTION_CONFIG.md)**
   - Set up environment variables
   - Configure database (PostgreSQL)
   - Set up Redis for caching
   - Configure SSL/TLS
   - Security hardening

2. **[Monitoring Setup](MONITORING_SETUP.md)**
   - Install Prometheus & Grafana
   - Configure alerting rules
   - Set up error tracking (Sentry)
   - Create dashboards

3. **[Backup Strategy](BACKUP_RECOVERY.md)**
   - Set up automated backups
   - Configure disaster recovery
   - Test recovery procedures

## Deployment Options

### Option 1: Docker (Recommended)

**Best for**: Quick deployment, consistent environments, easy scaling

```bash
# Build production image
docker build -t tibetan-translate:latest .

# Run container
docker run -d \
  --name tibetan-translate \
  -p 5439:5439 \
  -e DATABASE_URL=postgresql://... \
  -e GEMINI_API_KEY_ODD=... \
  -e GEMINI_API_KEY_EVEN=... \
  tibetan-translate:latest
```

See: [Docker Deployment Guide](PRODUCTION_CONFIG.md#docker-deployment)

### Option 2: VPS (Hetzner, DigitalOcean, Linode)

**Best for**: Cost-effective hosting, full control, custom configurations

- Monthly cost: ~$5-20 depending on specs
- Recommended: Hetzner CX22 (2 vCPU, 4GB RAM, ~$8/month)

See: [VPS Deployment Guide](PRODUCTION_CONFIG.md#vps-deployment-hetzner-digitalocean-etc)

### Option 3: Cloud Platforms

**Best for**: Auto-scaling, managed services, enterprise deployments

- **AWS**: Elastic Beanstalk, ECS, or EC2
- **Google Cloud**: Cloud Run or Compute Engine
- **Azure**: App Service or Container Instances
- **Heroku**: Quick deployment with add-ons

See: [Cloud Deployment Guide](PRODUCTION_CONFIG.md#cloud-platform-deployment)

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     Load Balancer / CDN                      │
│                         (Optional)                           │
└───────────────────────────┬─────────────────────────────────┘
                            │
                ┌───────────▼───────────┐
                │   Nginx (Reverse      │
                │   Proxy + SSL/TLS)    │
                └───────────┬───────────┘
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
┌───────▼────────┐  ┌───────▼────────┐  ┌──────▼──────┐
│  App Instance  │  │  App Instance  │  │  App Instance│
│   (Docker)     │  │   (Docker)     │  │  (Docker)   │
└───────┬────────┘  └───────┬────────┘  └──────┬──────┘
        │                   │                   │
        └───────────────────┼───────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
┌───────▼────────┐  ┌───────▼────────┐  ┌──────▼──────┐
│  PostgreSQL    │  │     Redis      │  │  S3/Storage │
│   (Primary)    │  │    (Cache)     │  │  (Backups)  │
└────────────────┘  └────────────────┘  └─────────────┘
```

## System Requirements

### Minimum (Development)

- CPU: 1 vCPU
- RAM: 2 GB
- Disk: 10 GB SSD
- Network: 100 Mbps

### Recommended (Production)

- CPU: 2-4 vCPUs
- RAM: 4-8 GB
- Disk: 50 GB SSD (+ storage for backups)
- Network: 1 Gbps
- Database: Separate PostgreSQL instance

### High Availability

- CPU: 4-8 vCPUs per instance
- RAM: 8-16 GB per instance
- Instances: 3+ (load balanced)
- Database: PostgreSQL with replication
- Cache: Redis Cluster
- Storage: Distributed/replicated storage

## Security Checklist

Before deploying to production:

- [ ] All secrets generated using cryptographically secure methods
- [ ] Environment variables properly configured (no defaults)
- [ ] Database uses strong password and restricted access
- [ ] SSL/TLS certificates installed and configured
- [ ] Firewall configured (only necessary ports open)
- [ ] CORS configured for specific origins (not `*`)
- [ ] Rate limiting enabled
- [ ] Security headers configured (Helmet.js)
- [ ] File upload validation enabled
- [ ] Regular security updates scheduled
- [ ] Secrets stored in secure secrets manager
- [ ] Backup encryption enabled
- [ ] Access logs enabled
- [ ] SSH key-based authentication (no password login)
- [ ] Principle of least privilege applied

See: [Security Configuration](PRODUCTION_CONFIG.md#security-configuration)

## Monitoring & Observability

The application includes:

### Built-in Monitoring

- Health check endpoint: `/api/health`
- System metrics: `/api/monitoring/system`
- Database metrics: `/api/monitoring/database`
- Prometheus metrics: `/metrics`

### External Monitoring

- **Prometheus + Grafana**: Time-series metrics and dashboards
- **Sentry**: Error tracking and performance monitoring
- **CloudWatch/Stackdriver**: Cloud platform monitoring
- **ELK/Loki**: Log aggregation and analysis

See: [Monitoring Setup Guide](MONITORING_SETUP.md)

## Backup & Disaster Recovery

### Backup Strategy

- **Database**: Daily full + hourly incremental
- **Files**: Daily backups of cache, uploads, translation memory
- **Configuration**: Encrypted backups after changes
- **Retention**: 7 days (daily), 4 weeks (weekly), 3 months (monthly)

### Recovery Objectives

- **RTO** (Recovery Time Objective): < 1 hour
- **RPO** (Recovery Point Objective): < 1 hour

### Testing

- Monthly restore tests
- Quarterly disaster recovery drills

See: [Backup & Recovery Guide](BACKUP_RECOVERY.md)

## CI/CD Pipeline

GitHub Actions workflow includes:

1. **Code Quality**: TypeScript type checking, linting
2. **Testing**: Unit tests, integration tests, coverage
3. **Build**: Production build verification
4. **Docker**: Multi-stage Docker build and test
5. **Security**: Dependency scanning, vulnerability checks
6. **Deployment**: Automated deployment to staging/production

Workflow file: `.github/workflows/ci-cd.yml`

## Performance Tuning

### Application

- Worker threads for parallel processing
- Redis caching for translations and API responses
- Connection pooling for database
- Compression (gzip/brotli) for responses
- CDN for static assets (optional)

### Database

- Indexes on frequently queried columns
- Connection pooling (max 20 connections)
- Query performance tracking
- Regular VACUUM and ANALYZE

### Cache

- Redis for session storage and rate limiting
- LRU eviction policy
- 256MB memory limit
- TTL-based expiration

See: [Performance Tuning](PRODUCTION_CONFIG.md#performance-tuning)

## Scaling

### Vertical Scaling (Scale Up)

Increase resources for single instance:
- More CPU cores (increase `WORKER_THREADS`)
- More RAM (increase `NODE_OPTIONS=--max-old-space-size`)
- Faster storage (NVMe SSD)

### Horizontal Scaling (Scale Out)

Add more instances behind load balancer:
- Use PostgreSQL for session storage (not in-memory)
- Shared Redis cache across instances
- Sticky sessions on load balancer
- Shared storage (NFS or S3) for uploads

```bash
# Scale to 3 instances with Docker Compose
docker-compose up -d --scale app=3
```

## Troubleshooting

### Common Issues

**Application won't start**
- Check environment variables are set
- Verify database connection
- Check logs: `docker logs tibetan-translate`

**High memory usage**
- Increase Node.js heap size: `NODE_OPTIONS=--max-old-space-size=4096`
- Check for memory leaks in logs
- Monitor with: `docker stats`

**Database connection errors**
- Verify DATABASE_URL is correct
- Check database is running: `pg_isready`
- Check connection pool settings

**Slow performance**
- Enable Redis caching
- Check database indexes
- Monitor with `/api/monitoring/system`

See logs:
```bash
# Docker logs
docker logs tibetan-translate -f

# PM2 logs
pm2 logs tibetan-translate

# System logs
journalctl -u tibetan-translate -f
```

## Support & Resources

### Documentation

- Project README: `/README.md`
- API Documentation: `/docs/api/`
- Architecture: `/docs/architecture/`

### Monitoring

- Health Check: `https://your-domain.com/api/health`
- Metrics: `https://your-domain.com/api/monitoring/system`
- Grafana: `https://grafana.your-domain.com`

### Getting Help

- GitHub Issues: [Create an issue](https://github.com/your-org/tibetan-translate/issues)
- Documentation: Check `/docs` directory
- Logs: Review application and system logs

### Emergency Contacts

- On-Call Engineer: oncall@example.com
- DevOps Team: devops@example.com
- Security Issues: security@example.com

## Maintenance

### Regular Tasks

**Daily**
- Check monitoring dashboards
- Review error logs
- Verify backups completed

**Weekly**
- Review security alerts
- Check resource utilization
- Update dependencies (if needed)

**Monthly**
- Test backup restoration
- Review and optimize database
- Security patches and updates
- Review monitoring alerts and thresholds

**Quarterly**
- Disaster recovery drill
- Security audit
- Performance review
- Capacity planning

## Changelog

Track deployment changes and versions:

```bash
# Tag releases
git tag -a v1.0.0 -m "Production release 1.0.0"
git push origin v1.0.0

# View deployment history
git log --oneline --decorate
```

## License

See LICENSE file in project root.

## Contributing

See CONTRIBUTING.md for development and deployment contribution guidelines.

---

**Last Updated**: 2024-11-06
**Version**: 1.0.0
**Maintainer**: DevOps Team
