# Backup & Recovery Procedures

This guide covers comprehensive backup and disaster recovery procedures for the Tibetan Translation Tool.

## Table of Contents

- [Overview](#overview)
- [Backup Strategy](#backup-strategy)
- [Database Backups](#database-backups)
- [File Backups](#file-backups)
- [Configuration Backups](#configuration-backups)
- [Automated Backup Scripts](#automated-backup-scripts)
- [Recovery Procedures](#recovery-procedures)
- [Disaster Recovery Plan](#disaster-recovery-plan)
- [Testing & Validation](#testing--validation)

## Overview

### Recovery Objectives

- **RTO (Recovery Time Objective)**: < 1 hour
- **RPO (Recovery Point Objective)**: < 1 hour
- **Data Retention**: 7 days (daily), 4 weeks (weekly), 3 months (monthly)
- **Backup Storage**: Encrypted, off-site, multi-region

### Backup Types

1. **Database Backups**: Daily full + hourly incremental
2. **File Backups**: OCR cache, uploads, translation memory
3. **Configuration Backups**: Environment variables, secrets, configs
4. **Code Backups**: Git repository (primary source of truth)

## Backup Strategy

### Backup Schedule

| Type | Frequency | Retention | Storage |
|------|-----------|-----------|---------|
| Database (Full) | Daily 2 AM | 7 days | S3/GCS |
| Database (Incremental) | Hourly | 24 hours | S3/GCS |
| Database (Weekly) | Sunday 2 AM | 4 weeks | S3/GCS |
| Database (Monthly) | 1st of month | 3 months | S3 Glacier |
| Files (Cache) | Daily 3 AM | 3 days | S3/GCS |
| Files (Uploads) | Daily 3 AM | 30 days | S3/GCS |
| Config (Secrets) | After each change | 30 days | Encrypted S3 |
| Application Logs | Daily 4 AM | 30 days | S3/GCS |

### Backup Storage

- **Primary**: AWS S3 or Google Cloud Storage
- **Secondary**: Alternative cloud provider (redundancy)
- **Encryption**: AES-256 encryption at rest
- **Access Control**: IAM roles, least privilege
- **Versioning**: Enabled for all buckets

## Database Backups

### PostgreSQL Backup

#### Daily Full Backup

Create `/opt/backups/scripts/backup-database-full.sh`:

```bash
#!/bin/bash
set -euo pipefail

# Configuration
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/opt/backups/database"
RETENTION_DAYS=7
S3_BUCKET="s3://your-bucket/backups/database"

# Database credentials (use environment or secrets manager)
DB_URL="${DATABASE_URL}"

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Create backup
echo "Starting full database backup: $TIMESTAMP"
pg_dump "$DB_URL" | gzip > "$BACKUP_DIR/full_backup_$TIMESTAMP.sql.gz"

# Verify backup integrity
gunzip -t "$BACKUP_DIR/full_backup_$TIMESTAMP.sql.gz"
if [ $? -eq 0 ]; then
    echo "Backup integrity verified"
else
    echo "ERROR: Backup integrity check failed!"
    exit 1
fi

# Upload to S3
echo "Uploading to S3..."
aws s3 cp "$BACKUP_DIR/full_backup_$TIMESTAMP.sql.gz" "$S3_BUCKET/full/" \
    --storage-class STANDARD \
    --metadata "backup_type=full,timestamp=$TIMESTAMP"

# Verify upload
aws s3 ls "$S3_BUCKET/full/full_backup_$TIMESTAMP.sql.gz"
if [ $? -eq 0 ]; then
    echo "Upload verified"
else
    echo "ERROR: Upload verification failed!"
    exit 1
fi

# Cleanup old local backups
find "$BACKUP_DIR" -name "full_backup_*.sql.gz" -mtime +$RETENTION_DAYS -delete

# Cleanup old S3 backups
aws s3 ls "$S3_BUCKET/full/" | while read -r line; do
    createDate=$(echo $line | awk {'print $1" "$2'})
    createDate=$(date -d "$createDate" +%s)
    olderThan=$(date -d "$RETENTION_DAYS days ago" +%s)
    if [[ $createDate -lt $olderThan ]]; then
        fileName=$(echo $line | awk {'print $4'})
        if [[ $fileName != "" ]]; then
            aws s3 rm "$S3_BUCKET/full/$fileName"
        fi
    fi
done

echo "Backup completed successfully: $TIMESTAMP"
```

#### Hourly Incremental Backup

Create `/opt/backups/scripts/backup-database-incremental.sh`:

```bash
#!/bin/bash
set -euo pipefail

# Configuration
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/opt/backups/database/incremental"
RETENTION_HOURS=24
S3_BUCKET="s3://your-bucket/backups/database"

# Database credentials
DB_URL="${DATABASE_URL}"

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Backup only recent changes (using pg_dump with WHERE clause)
echo "Starting incremental database backup: $TIMESTAMP"

# Export translations modified in last hour
psql "$DB_URL" -c "\COPY (
    SELECT * FROM translations
    WHERE updated_at >= NOW() - INTERVAL '1 hour'
) TO STDOUT WITH CSV HEADER" | gzip > "$BACKUP_DIR/translations_$TIMESTAMP.csv.gz"

# Export batch_jobs modified in last hour
psql "$DB_URL" -c "\COPY (
    SELECT * FROM batch_jobs
    WHERE updated_at >= NOW() - INTERVAL '1 hour'
) TO STDOUT WITH CSV HEADER" | gzip > "$BACKUP_DIR/batch_jobs_$TIMESTAMP.csv.gz"

# Upload to S3
aws s3 sync "$BACKUP_DIR" "$S3_BUCKET/incremental/" \
    --exclude "*" \
    --include "*_$TIMESTAMP.csv.gz"

# Cleanup old backups
find "$BACKUP_DIR" -name "*.csv.gz" -mmin +$(($RETENTION_HOURS * 60)) -delete

echo "Incremental backup completed: $TIMESTAMP"
```

### SQLite Backup (Development)

```bash
#!/bin/bash
set -euo pipefail

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
DB_FILE="/path/to/tibetan_translation.db"
BACKUP_DIR="/opt/backups/sqlite"

mkdir -p "$BACKUP_DIR"

# Use sqlite3 backup command (safe for active databases)
sqlite3 "$DB_FILE" ".backup '$BACKUP_DIR/backup_$TIMESTAMP.db'"

# Compress backup
gzip "$BACKUP_DIR/backup_$TIMESTAMP.db"

# Upload to S3
aws s3 cp "$BACKUP_DIR/backup_$TIMESTAMP.db.gz" \
    "s3://your-bucket/backups/sqlite/"

echo "SQLite backup completed: $TIMESTAMP"
```

### Make Scripts Executable

```bash
chmod +x /opt/backups/scripts/backup-database-full.sh
chmod +x /opt/backups/scripts/backup-database-incremental.sh
```

### Schedule with Cron

Add to crontab (`crontab -e`):

```cron
# Daily full backup at 2 AM
0 2 * * * /opt/backups/scripts/backup-database-full.sh >> /var/log/backup-full.log 2>&1

# Hourly incremental backup
0 * * * * /opt/backups/scripts/backup-database-incremental.sh >> /var/log/backup-incremental.log 2>&1

# Weekly backup at 2 AM on Sunday (keep for 4 weeks)
0 2 * * 0 /opt/backups/scripts/backup-database-full.sh && aws s3 cp /opt/backups/database/full_backup_*.sql.gz s3://your-bucket/backups/weekly/

# Monthly backup on 1st at 2 AM (archive to Glacier)
0 2 1 * * /opt/backups/scripts/backup-database-full.sh && aws s3 cp /opt/backups/database/full_backup_*.sql.gz s3://your-bucket/backups/monthly/ --storage-class GLACIER
```

## File Backups

### OCR Cache Backup

```bash
#!/bin/bash
set -euo pipefail

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
CACHE_DIR="/app/cache"
BACKUP_DIR="/opt/backups/cache"
S3_BUCKET="s3://your-bucket/backups/cache"

mkdir -p "$BACKUP_DIR"

# Tar and compress cache directory
tar -czf "$BACKUP_DIR/cache_$TIMESTAMP.tar.gz" -C "$CACHE_DIR" .

# Upload to S3
aws s3 cp "$BACKUP_DIR/cache_$TIMESTAMP.tar.gz" "$S3_BUCKET/"

# Cleanup old backups (3 days retention)
find "$BACKUP_DIR" -name "cache_*.tar.gz" -mtime +3 -delete

echo "Cache backup completed: $TIMESTAMP"
```

### User Uploads Backup

```bash
#!/bin/bash
set -euo pipefail

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
UPLOADS_DIR="/app/uploads"
S3_BUCKET="s3://your-bucket/backups/uploads"

# Sync uploads to S3 (incremental)
aws s3 sync "$UPLOADS_DIR" "$S3_BUCKET/$TIMESTAMP/" \
    --storage-class STANDARD_IA \
    --exclude "*.tmp" \
    --exclude ".DS_Store"

echo "Uploads backup completed: $TIMESTAMP"
```

### Translation Memory Backup

```bash
#!/bin/bash
set -euo pipefail

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
TM_DIR="/app/data/translation-memory"
S3_BUCKET="s3://your-bucket/backups/translation-memory"

# Backup translation memory database
tar -czf "/opt/backups/tm_$TIMESTAMP.tar.gz" -C "$TM_DIR" .

aws s3 cp "/opt/backups/tm_$TIMESTAMP.tar.gz" "$S3_BUCKET/"

echo "Translation memory backup completed: $TIMESTAMP"
```

## Configuration Backups

### Environment Variables Backup

```bash
#!/bin/bash
set -euo pipefail

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="/opt/backups/config/env_$TIMESTAMP.enc"
S3_BUCKET="s3://your-bucket/backups/config"

# Encrypt environment variables using gpg
env | grep -E "^(DATABASE_URL|REDIS_URL|GEMINI_|SESSION_SECRET|API_KEY)" | \
    gpg --symmetric --cipher-algo AES256 --output "$BACKUP_FILE"

# Upload encrypted config
aws s3 cp "$BACKUP_FILE" "$S3_BUCKET/" \
    --metadata "backup_type=env,timestamp=$TIMESTAMP"

echo "Environment backup completed: $TIMESTAMP"
```

### Secrets Manager Backup (AWS)

```bash
#!/bin/bash
set -euo pipefail

TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Export all secrets
aws secretsmanager list-secrets --query 'SecretList[*].Name' --output text | \
while read secret; do
    echo "Backing up secret: $secret"
    aws secretsmanager get-secret-value --secret-id "$secret" \
        --query SecretString --output text > "/opt/backups/secrets/${secret}_$TIMESTAMP.json"
done

# Encrypt and upload
tar -czf "/opt/backups/secrets_$TIMESTAMP.tar.gz" -C /opt/backups/secrets .
gpg --symmetric --cipher-algo AES256 "/opt/backups/secrets_$TIMESTAMP.tar.gz"
aws s3 cp "/opt/backups/secrets_$TIMESTAMP.tar.gz.gpg" "s3://your-bucket/backups/secrets/"

echo "Secrets backup completed: $TIMESTAMP"
```

## Automated Backup Scripts

### All-in-One Backup Script

Create `/opt/backups/scripts/backup-all.sh`:

```bash
#!/bin/bash
set -euo pipefail

echo "========================================="
echo "Starting complete system backup"
echo "========================================="

# Set logging
LOGFILE="/var/log/backup-all.log"
exec 1> >(tee -a "$LOGFILE")
exec 2>&1

# Backup database
echo "1. Backing up database..."
/opt/backups/scripts/backup-database-full.sh
if [ $? -ne 0 ]; then
    echo "ERROR: Database backup failed!"
    exit 1
fi

# Backup files
echo "2. Backing up cache..."
/opt/backups/scripts/backup-cache.sh

echo "3. Backing up uploads..."
/opt/backups/scripts/backup-uploads.sh

echo "4. Backing up translation memory..."
/opt/backups/scripts/backup-translation-memory.sh

# Backup configuration
echo "5. Backing up configuration..."
/opt/backups/scripts/backup-config.sh

# Send notification
echo "6. Sending notification..."
curl -X POST "$SLACK_WEBHOOK_URL" \
    -H 'Content-Type: application/json' \
    -d "{\"text\":\"✅ Daily backup completed successfully\"}"

echo "========================================="
echo "Complete system backup finished"
echo "========================================="
```

### Backup Health Check

Create `/opt/backups/scripts/verify-backups.sh`:

```bash
#!/bin/bash
set -euo pipefail

S3_BUCKET="s3://your-bucket/backups"
ALERT_EMAIL="ops-team@example.com"

# Check if backups exist for today
TODAY=$(date +%Y%m%d)
ERRORS=0

# Check database backup
if ! aws s3 ls "$S3_BUCKET/database/full/" | grep -q "$TODAY"; then
    echo "ERROR: No database backup found for today!"
    ERRORS=$((ERRORS + 1))
fi

# Check cache backup
if ! aws s3 ls "$S3_BUCKET/cache/" | grep -q "$TODAY"; then
    echo "WARNING: No cache backup found for today"
fi

# Check uploads backup
if ! aws s3 ls "$S3_BUCKET/uploads/" | grep -q "$TODAY"; then
    echo "ERROR: No uploads backup found for today!"
    ERRORS=$((ERRORS + 1))
fi

# Send alert if errors found
if [ $ERRORS -gt 0 ]; then
    echo "Backup verification failed with $ERRORS errors"

    # Send email alert
    echo "Backup verification failed. Please check logs." | \
        mail -s "ALERT: Backup Verification Failed" "$ALERT_EMAIL"

    exit 1
else
    echo "All backups verified successfully"
    exit 0
fi
```

## Recovery Procedures

### Database Recovery

#### Full Database Restore

```bash
#!/bin/bash
set -euo pipefail

# WARNING: This will drop and recreate the database!
read -p "Are you sure you want to restore database? (yes/no): " confirm
if [ "$confirm" != "yes" ]; then
    echo "Restore cancelled"
    exit 0
fi

# Configuration
BACKUP_FILE="$1"  # Pass backup file as argument
DB_URL="${DATABASE_URL}"

if [ -z "$BACKUP_FILE" ]; then
    echo "Usage: $0 <backup_file.sql.gz>"
    echo ""
    echo "Available backups:"
    aws s3 ls s3://your-bucket/backups/database/full/ | tail -10
    exit 1
fi

# Download backup from S3 if needed
if [[ $BACKUP_FILE == s3://* ]]; then
    echo "Downloading backup from S3..."
    aws s3 cp "$BACKUP_FILE" /tmp/restore.sql.gz
    BACKUP_FILE=/tmp/restore.sql.gz
fi

# Verify backup file
echo "Verifying backup integrity..."
gunzip -t "$BACKUP_FILE"
if [ $? -ne 0 ]; then
    echo "ERROR: Backup file is corrupted!"
    exit 1
fi

# Create backup of current database before restore
echo "Creating safety backup of current database..."
pg_dump "$DB_URL" | gzip > "/tmp/pre_restore_backup_$(date +%Y%m%d_%H%M%S).sql.gz"

# Drop existing connections
echo "Terminating existing connections..."
psql "$DB_URL" -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = current_database() AND pid <> pg_backend_pid();"

# Restore database
echo "Restoring database..."
gunzip < "$BACKUP_FILE" | psql "$DB_URL"

if [ $? -eq 0 ]; then
    echo "Database restored successfully!"

    # Run migrations to ensure schema is up to date
    echo "Running migrations..."
    npm run migrate:v2

    # Verify restoration
    echo "Verifying restoration..."
    psql "$DB_URL" -c "SELECT COUNT(*) FROM translations;"

    echo "Restore completed successfully!"
else
    echo "ERROR: Database restore failed!"
    exit 1
fi
```

#### Incremental Recovery

```bash
#!/bin/bash
set -euo pipefail

# Restore incremental backups
INCREMENTAL_BACKUP_DIR="$1"
DB_URL="${DATABASE_URL}"

if [ -z "$INCREMENTAL_BACKUP_DIR" ]; then
    echo "Usage: $0 <incremental_backup_directory>"
    exit 1
fi

# Download incremental backups from S3
aws s3 sync "s3://your-bucket/backups/database/incremental/" "$INCREMENTAL_BACKUP_DIR/"

# Restore each table
for file in "$INCREMENTAL_BACKUP_DIR"/*.csv.gz; do
    echo "Restoring: $file"

    table=$(basename "$file" | cut -d'_' -f1)

    gunzip < "$file" | psql "$DB_URL" -c "\COPY $table FROM STDIN WITH CSV HEADER"
done

echo "Incremental restore completed!"
```

### File Recovery

```bash
#!/bin/bash
set -euo pipefail

RESTORE_TYPE="$1"  # cache, uploads, or translation-memory
RESTORE_DATE="${2:-latest}"

case $RESTORE_TYPE in
    cache)
        S3_PATH="s3://your-bucket/backups/cache/"
        LOCAL_PATH="/app/cache"
        ;;
    uploads)
        S3_PATH="s3://your-bucket/backups/uploads/"
        LOCAL_PATH="/app/uploads"
        ;;
    translation-memory)
        S3_PATH="s3://your-bucket/backups/translation-memory/"
        LOCAL_PATH="/app/data/translation-memory"
        ;;
    *)
        echo "Usage: $0 {cache|uploads|translation-memory} [date]"
        exit 1
        ;;
esac

# Backup current files
echo "Creating safety backup of current files..."
tar -czf "/tmp/${RESTORE_TYPE}_pre_restore_$(date +%Y%m%d_%H%M%S).tar.gz" -C "$LOCAL_PATH" .

# Restore files
echo "Restoring $RESTORE_TYPE files..."
if [ "$RESTORE_DATE" == "latest" ]; then
    # Get latest backup
    LATEST=$(aws s3 ls "$S3_PATH" | sort | tail -n 1 | awk '{print $4}')
    aws s3 cp "$S3_PATH$LATEST" /tmp/restore.tar.gz
else
    # Restore specific date
    aws s3 cp "$S3_PATH${RESTORE_TYPE}_${RESTORE_DATE}.tar.gz" /tmp/restore.tar.gz
fi

# Extract backup
tar -xzf /tmp/restore.tar.gz -C "$LOCAL_PATH"

echo "File restore completed!"
```

### Configuration Recovery

```bash
#!/bin/bash
set -euo pipefail

BACKUP_FILE="$1"

if [ -z "$BACKUP_FILE" ]; then
    echo "Usage: $0 <encrypted_config_backup>"
    echo ""
    echo "Available backups:"
    aws s3 ls s3://your-bucket/backups/config/ | tail -10
    exit 1
fi

# Download encrypted backup
if [[ $BACKUP_FILE == s3://* ]]; then
    aws s3 cp "$BACKUP_FILE" /tmp/config.enc
    BACKUP_FILE=/tmp/config.enc
fi

# Decrypt configuration
gpg --decrypt "$BACKUP_FILE" > /tmp/recovered_env

echo "Configuration recovered to: /tmp/recovered_env"
echo "Please review and apply manually to .env file"
```

## Disaster Recovery Plan

### Scenario 1: Database Corruption

**Detection**: Health checks fail, database errors in logs

**Recovery Steps**:
1. Stop application to prevent further corruption
2. Verify backup integrity
3. Restore from latest full backup
4. Apply incremental backups if needed
5. Run database migrations
6. Verify data integrity
7. Restart application
8. Monitor for errors

**Estimated Recovery Time**: 30-60 minutes

### Scenario 2: Complete Server Failure

**Detection**: Server unreachable, monitoring alerts

**Recovery Steps**:
1. Provision new server (or failover to standby)
2. Install dependencies (Docker, Node.js, PostgreSQL)
3. Restore code from Git repository
4. Restore database from latest backup
5. Restore file backups (cache, uploads)
6. Restore configuration from encrypted backup
7. Run health checks
8. Update DNS if needed
9. Monitor application

**Estimated Recovery Time**: 45-90 minutes

### Scenario 3: Data Center Outage

**Detection**: Complete region unreachable

**Recovery Steps**:
1. Activate DR site in alternate region
2. Restore database from cross-region backup
3. Deploy application from CI/CD pipeline
4. Restore files from S3 (automatically replicated)
5. Update DNS to point to DR site
6. Verify all services operational
7. Notify users of temporary migration

**Estimated Recovery Time**: 60-120 minutes

### Scenario 4: Accidental Data Deletion

**Detection**: User reports missing data

**Recovery Steps**:
1. Identify timestamp of deletion
2. Find backup before deletion occurred
3. Extract specific records from backup
4. Verify data integrity
5. Restore only affected records
6. Validate with user
7. Document incident

**Estimated Recovery Time**: 15-30 minutes

## Testing & Validation

### Monthly Backup Testing

Create `/opt/backups/scripts/test-restore.sh`:

```bash
#!/bin/bash
set -euo pipefail

echo "========================================="
echo "Monthly Backup Restore Test"
echo "========================================="

# Use test environment
export DATABASE_URL="postgresql://test_user:password@localhost:5433/test_restore"

# Download latest backup
LATEST_BACKUP=$(aws s3 ls s3://your-bucket/backups/database/full/ | sort | tail -n 1 | awk '{print $4}')
aws s3 cp "s3://your-bucket/backups/database/full/$LATEST_BACKUP" /tmp/test_restore.sql.gz

# Create test database
createdb -h localhost -p 5433 -U test_user test_restore

# Restore backup
gunzip < /tmp/test_restore.sql.gz | psql "$DATABASE_URL"

# Verify restoration
TRANSLATION_COUNT=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM translations;")
echo "Translations in backup: $TRANSLATION_COUNT"

# Cleanup
dropdb -h localhost -p 5433 -U test_user test_restore
rm /tmp/test_restore.sql.gz

echo "Backup restore test completed successfully!"
```

Schedule monthly test:

```cron
# Monthly restore test on 15th at 3 AM
0 3 15 * * /opt/backups/scripts/test-restore.sh >> /var/log/backup-test.log 2>&1
```

### Backup Verification Checklist

- [ ] Database backup exists for today
- [ ] Database backup is not corrupted (integrity check)
- [ ] Database backup size is reasonable (not empty)
- [ ] File backups uploaded to S3
- [ ] Configuration backup encrypted and uploaded
- [ ] Backup logs show no errors
- [ ] S3 bucket has versioning enabled
- [ ] Old backups cleaned up according to retention policy
- [ ] Cross-region replication verified (if enabled)
- [ ] Test restore completed successfully (monthly)

### Recovery Time Testing

Document actual recovery times:

| Scenario | Target RTO | Actual RTO | Last Tested |
|----------|-----------|------------|-------------|
| Database restore | < 30 min | 25 min | 2024-11-01 |
| Full server rebuild | < 60 min | 55 min | 2024-10-15 |
| File recovery | < 15 min | 12 min | 2024-11-01 |
| Config recovery | < 10 min | 8 min | 2024-11-01 |

## Backup Monitoring

### CloudWatch Alarms (AWS)

```bash
# Alarm for failed backups
aws cloudwatch put-metric-alarm \
    --alarm-name backup-failed \
    --alarm-description "Alert when backup fails" \
    --metric-name BackupFailed \
    --namespace TibetanTranslate \
    --statistic Sum \
    --period 3600 \
    --evaluation-periods 1 \
    --threshold 1 \
    --comparison-operator GreaterThanOrEqualToThreshold \
    --alarm-actions arn:aws:sns:us-east-1:123456789:backup-alerts
```

### Backup Size Monitoring

```bash
#!/bin/bash

# Monitor backup sizes
CURRENT_SIZE=$(aws s3 ls s3://your-bucket/backups/database/full/ --summarize | grep "Total Size" | awk '{print $3}')
EXPECTED_MIN_SIZE=1000000  # 1MB minimum

if [ "$CURRENT_SIZE" -lt "$EXPECTED_MIN_SIZE" ]; then
    echo "WARNING: Backup size too small: $CURRENT_SIZE bytes"
    # Send alert
fi
```

## Best Practices

1. **3-2-1 Rule**: 3 copies, 2 different media, 1 off-site
2. **Encrypt Everything**: All backups encrypted at rest and in transit
3. **Test Regularly**: Monthly restore tests minimum
4. **Monitor Backups**: Automated verification and alerts
5. **Document Everything**: Maintain runbooks for recovery procedures
6. **Automate**: Use cron, systemd timers, or orchestration tools
7. **Retention Policy**: Balance storage costs with compliance requirements
8. **Access Control**: Limit who can delete or restore backups
9. **Audit Logs**: Track all backup and restore operations
10. **Cross-Region**: Replicate critical backups to multiple regions

## Emergency Contacts

| Role | Name | Contact | Availability |
|------|------|---------|--------------|
| Database Admin | TBD | db-admin@example.com | 24/7 |
| DevOps Lead | TBD | devops@example.com | Business hours |
| Security Team | TBD | security@example.com | 24/7 |
| On-Call Engineer | Rotation | oncall@example.com | 24/7 |

## Resources

- [PostgreSQL Backup Documentation](https://www.postgresql.org/docs/current/backup.html)
- [AWS S3 Backup Best Practices](https://docs.aws.amazon.com/prescriptive-guidance/latest/backup-recovery/backup-recovery.html)
- [Disaster Recovery Planning Guide](https://www.ready.gov/business/emergency-plans/disaster-recovery)

## Revision History

| Date | Version | Changes | Author |
|------|---------|---------|--------|
| 2024-11-06 | 1.0 | Initial version | System |

---

**Remember**: Backups are useless if you can't restore from them. Test your recovery procedures regularly!
