# Neo4j Setup Guide

**Tibetan Buddhist Knowledge Graph - Phase 4.1: Neo4j Infrastructure**

This guide covers the complete setup and configuration of Neo4j graph database for the Tibetan Buddhist Knowledge Graph system.

## Table of Contents

- [Overview](#overview)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Configuration](#configuration)
- [Starting Neo4j](#starting-neo4j)
- [Accessing Neo4j Browser](#accessing-neo4j-browser)
- [Verification](#verification)
- [Plugin Management](#plugin-management)
- [Backup and Restore](#backup-and-restore)
- [Performance Tuning](#performance-tuning)
- [Troubleshooting](#troubleshooting)
- [Production Deployment](#production-deployment)
- [Reference](#reference)

## Overview

Neo4j is the graph database powering the Tibetan Buddhist Knowledge Graph. It stores:

- **Entities**: People, places, texts, events, concepts, institutions, deities
- **Relationships**: Teacher-student, authored, lived at, influenced by, etc.
- **Properties**: Names (Tibetan, English, Wylie), dates, attributes, metadata

### Architecture

```
┌─────────────────────────────────────────────────────────┐
│                   Application Layer                      │
│              (TypeScript/Node.js Server)                 │
└────────────────────┬────────────────────────────────────┘
                     │
                     │ Neo4j Driver (Bolt Protocol)
                     │
┌────────────────────▼────────────────────────────────────┐
│                    Neo4j Client                          │
│              (server/lib/neo4jClient.ts)                 │
│  - Connection Pooling                                    │
│  - Transaction Management                                │
│  - Health Checks                                         │
└────────────────────┬────────────────────────────────────┘
                     │
                     │ Port 7687 (Bolt)
                     │
┌────────────────────▼────────────────────────────────────┐
│                 Neo4j Database                           │
│                  (Docker Container)                      │
│  - Graph Storage Engine                                  │
│  - APOC Plugin (Procedures)                              │
│  - GDS Plugin (Graph Algorithms)                         │
└──────────────────────────────────────────────────────────┘
```

## Prerequisites

### System Requirements

- **Docker**: Version 20.10 or higher
- **Docker Compose**: Version 2.0 or higher
- **RAM**: Minimum 4GB available (8GB+ recommended)
- **Disk**: 10GB+ for data storage
- **Ports**: 7474 (HTTP), 7687 (Bolt) must be available

### Software Dependencies

```bash
# Node.js packages (will be installed via npm)
neo4j-driver: ^5.25.0
```

### Knowledge Requirements

- Basic understanding of graph databases
- Familiarity with Cypher query language (optional but helpful)
- Docker container management

## Installation

### Step 1: Clone Configuration Files

The repository includes:

- `docker-compose.neo4j.yml` - Neo4j container configuration
- `.env.example` - Environment variable templates
- `server/lib/neo4jClient.ts` - TypeScript client library
- `scripts/init-neo4j.ts` - Initialization script

### Step 2: Configure Environment Variables

Create a `.env` file from the template:

```bash
cp .env.example .env
```

Edit `.env` and configure Neo4j settings:

```bash
# Neo4j Connection
NEO4J_URI=bolt://localhost:7687
NEO4J_USERNAME=neo4j
NEO4J_PASSWORD=your_secure_password_here  # CHANGE THIS!
NEO4J_DATABASE=neo4j

# Optional: Docker Compose Auth (format: username/password)
NEO4J_AUTH=neo4j/your_secure_password_here

# Optional: Memory Configuration
NEO4J_HEAP_INITIAL=512m
NEO4J_HEAP_MAX=2g
NEO4J_PAGECACHE=1g
```

**Important Security Notes:**

- ⚠️ **Change the default password** before deployment
- Never commit `.env` file to version control
- Use strong passwords (16+ characters, mixed case, numbers, symbols)
- Consider using Docker secrets in production

### Step 3: Install Node Dependencies

```bash
npm install neo4j-driver
```

Or add to `package.json`:

```json
{
  "dependencies": {
    "neo4j-driver": "^5.25.0"
  }
}
```

## Configuration

### Docker Compose Configuration

The `docker-compose.neo4j.yml` file defines the Neo4j container:

```yaml
services:
  neo4j:
    image: neo4j:5.25.1
    ports:
      - "7474:7474"  # HTTP Browser
      - "7687:7687"  # Bolt Protocol
    environment:
      NEO4J_AUTH: neo4j/password
      NEO4J_PLUGINS: '["apoc", "graph-data-science"]'
    volumes:
      - neo4j_data:/data
      - neo4j_logs:/logs
      - neo4j_backups:/backups
```

### Key Configuration Options

#### Memory Settings

Adjust based on your dataset size:

```bash
# Small datasets (< 1M nodes)
NEO4J_HEAP_INITIAL=512m
NEO4J_HEAP_MAX=2g
NEO4J_PAGECACHE=1g

# Medium datasets (1-10M nodes)
NEO4J_HEAP_INITIAL=2g
NEO4J_HEAP_MAX=8g
NEO4J_PAGECACHE=4g

# Large datasets (10M+ nodes)
NEO4J_HEAP_INITIAL=4g
NEO4J_HEAP_MAX=16g
NEO4J_PAGECACHE=8g
```

**Rule of Thumb:**
- Heap: 50% of available RAM (max 31GB due to JVM limits)
- Page Cache: 50% of available RAM

#### Connection Pool

```yaml
NEO4J_server_bolt_thread__pool__min__size: 5
NEO4J_server_bolt_thread__pool__max__size: 400
```

#### Logging

```yaml
NEO4J_server_logs_debug_level: INFO  # DEBUG, INFO, WARN, ERROR
```

## Starting Neo4j

### Option 1: Standalone Neo4j Container

```bash
# Start Neo4j
docker-compose -f docker-compose.neo4j.yml up -d

# View logs
docker-compose -f docker-compose.neo4j.yml logs -f neo4j

# Stop Neo4j
docker-compose -f docker-compose.neo4j.yml down
```

### Option 2: With Main Application Stack

If integrating with the main `docker-compose.yml`:

```bash
# Start all services
docker-compose up -d

# Start specific services
docker-compose up -d neo4j postgres redis
```

### Verify Container is Running

```bash
# Check container status
docker ps | grep neo4j

# Expected output:
# tibetan-translate-neo4j   neo4j:5.25.1   Up 2 minutes   0.0.0.0:7474->7474/tcp, 0.0.0.0:7687->7687/tcp
```

### Initialize Database

Run the initialization script:

```bash
# Method 1: Using npm script (add to package.json)
npm run init:neo4j

# Method 2: Direct execution
tsx scripts/init-neo4j.ts

# Method 3: With Docker
docker exec -it tibetan-translate-neo4j cypher-shell -u neo4j -p your_password
```

The initialization script will:
1. Wait for Neo4j to be ready (with retries)
2. Verify database connectivity
3. Check APOC and GDS plugins are installed
4. Run schema setup (Phase 4.2)
5. Report status

## Accessing Neo4j Browser

### Web Interface

1. Open browser: http://localhost:7474
2. Login credentials:
   - **Username**: `neo4j`
   - **Password**: (from your .env file)
   - **Database**: `neo4j`
3. Connection URL: `bolt://localhost:7687`

### First Login

On first login, Neo4j will prompt you to change the default password:

1. Current password: `neo4j`
2. New password: (enter your secure password)
3. Confirm password

### Browser Features

- **Query Editor**: Write and execute Cypher queries
- **Graph Visualization**: Interactive graph rendering
- **Database Information**: Nodes, relationships, indexes
- **Query History**: Previous queries and results

## Verification

### Health Check

```bash
# Using curl
curl http://localhost:7474

# Using wget
wget --spider http://localhost:7474

# Using Docker
docker exec tibetan-translate-neo4j neo4j status
```

### Test Connection with Cypher

In Neo4j Browser or cypher-shell:

```cypher
-- Simple health check
RETURN 1 AS health;

-- Check database version
CALL dbms.components() YIELD name, versions;

-- Count nodes and relationships
MATCH (n)
RETURN count(n) AS nodeCount;

MATCH ()-[r]->()
RETURN count(r) AS relationshipCount;
```

### Using TypeScript Client

```typescript
import { getNeo4jClient } from './server/lib/neo4jClient';

async function testConnection() {
  const client = getNeo4jClient();

  try {
    await client.connect();

    const healthy = await client.healthCheck();
    console.log('Neo4j healthy:', healthy);

    const stats = await client.getStats();
    console.log('Stats:', stats);

    await client.disconnect();
  } catch (error) {
    console.error('Connection failed:', error);
  }
}

testConnection();
```

## Plugin Management

### APOC (Awesome Procedures On Cypher)

APOC provides utility functions and procedures for Neo4j.

**Verify Installation:**

```cypher
RETURN apoc.version() AS version;
```

**Common APOC Functions:**

```cypher
-- Date/time utilities
RETURN apoc.date.format(timestamp(), 'ms', 'yyyy-MM-dd HH:mm:ss') AS formattedDate;

-- JSON import/export
CALL apoc.load.json('file:///import/entities.json') YIELD value
RETURN value;

-- Text utilities
RETURN apoc.text.clean('བཀྲ་ཤིས་བདེ་ལེགས') AS cleaned;

-- Fuzzy matching
RETURN apoc.text.levenshteinDistance('Marpa', 'Marpa Lotsawa') AS distance;
```

### GDS (Graph Data Science)

GDS provides graph algorithms for analytics and machine learning.

**Verify Installation:**

```cypher
RETURN gds.version() AS version;
```

**Common GDS Algorithms:**

```cypher
-- PageRank (find important nodes)
CALL gds.pageRank.stream('myGraph')
YIELD nodeId, score
RETURN gds.util.asNode(nodeId).name AS name, score
ORDER BY score DESC LIMIT 10;

-- Community Detection
CALL gds.louvain.stream('myGraph')
YIELD nodeId, communityId
RETURN communityId, collect(gds.util.asNode(nodeId).name) AS members;

-- Shortest Path
MATCH (start:Person {name: 'Marpa'}), (end:Person {name: 'Milarepa'})
CALL gds.shortestPath.dijkstra.stream('myGraph', {
  sourceNode: start,
  targetNode: end
})
YIELD path
RETURN path;
```

### Manual Plugin Installation

If plugins are not auto-installed:

```bash
# Download plugins to volume
docker exec tibetan-translate-neo4j \
  bash -c "cd plugins && curl -L -O https://github.com/neo4j-contrib/neo4j-apoc-procedures/releases/download/5.25.0/apoc-5.25.0-core.jar"

# Restart container
docker-compose -f docker-compose.neo4j.yml restart neo4j
```

## Backup and Restore

### Database Dump

```bash
# Dump entire database
docker exec tibetan-translate-neo4j \
  neo4j-admin database dump neo4j --to-path=/backups

# Copy backup to host
docker cp tibetan-translate-neo4j:/backups/neo4j.dump ./backups/

# Dump with compression
docker exec tibetan-translate-neo4j \
  neo4j-admin database dump neo4j --to-path=/backups --compress
```

### Restore from Dump

```bash
# Stop database
docker-compose -f docker-compose.neo4j.yml stop neo4j

# Copy backup into container
docker cp ./backups/neo4j.dump tibetan-translate-neo4j:/backups/

# Restore database
docker exec tibetan-translate-neo4j \
  neo4j-admin database load neo4j --from-path=/backups --overwrite-destination=true

# Start database
docker-compose -f docker-compose.neo4j.yml start neo4j
```

### Export to CSV/JSON

```cypher
-- Export nodes to CSV
CALL apoc.export.csv.all('/var/lib/neo4j/import/export.csv', {});

-- Export to JSON
CALL apoc.export.json.all('/var/lib/neo4j/import/export.json', {});

-- Export specific query results
MATCH (p:Person)
WITH collect(p) AS persons
CALL apoc.export.json.data(persons, [], '/var/lib/neo4j/import/persons.json', {})
YIELD file, nodes, relationships
RETURN file, nodes, relationships;
```

### Automated Backups

Add to crontab:

```bash
# Backup every day at 2 AM
0 2 * * * docker exec tibetan-translate-neo4j neo4j-admin database dump neo4j --to-path=/backups/daily-$(date +\%Y\%m\%d).dump
```

## Performance Tuning

### Indexes

Create indexes for frequently queried properties:

```cypher
-- Unique constraint (automatically creates index)
CREATE CONSTRAINT person_canonical_name IF NOT EXISTS
FOR (p:Person) REQUIRE p.canonicalName IS UNIQUE;

-- Regular index
CREATE INDEX person_name_index IF NOT EXISTS
FOR (p:Person) ON (p.canonicalName);

-- Composite index
CREATE INDEX person_dates_index IF NOT EXISTS
FOR (p:Person) ON (p.birthYear, p.deathYear);

-- Full-text search index
CALL db.index.fulltext.createNodeIndex(
  'personNameSearch',
  ['Person'],
  ['canonicalName', 'nameEnglish', 'nameTibetan']
);

-- List indexes
SHOW INDEXES;

-- Drop index
DROP INDEX person_name_index IF EXISTS;
```

### Query Optimization

```cypher
-- Use EXPLAIN to see query plan
EXPLAIN MATCH (p:Person {canonicalName: 'Marpa'}) RETURN p;

-- Use PROFILE to see actual execution stats
PROFILE MATCH (p:Person {canonicalName: 'Marpa'}) RETURN p;

-- Avoid cartesian products
-- BAD:
MATCH (p:Person), (t:Text) RETURN p, t;

-- GOOD:
MATCH (p:Person)-[:AUTHORED]->(t:Text) RETURN p, t;

-- Use parameters for repeated queries
:param name => 'Marpa'
MATCH (p:Person {canonicalName: $name}) RETURN p;
```

### Memory Monitoring

```cypher
-- Check memory usage
CALL dbms.queryJmx('org.neo4j:instance=kernel#0,name=Memory') YIELD attributes
RETURN attributes;

-- Clear query cache
CALL db.clearQueryCaches();
```

## Troubleshooting

### Common Issues

#### 1. Container Won't Start

**Symptoms:**
- Container exits immediately
- Logs show authentication errors

**Solutions:**

```bash
# Check logs
docker-compose -f docker-compose.neo4j.yml logs neo4j

# Common fixes:
# 1. Remove existing data volume
docker-compose -f docker-compose.neo4j.yml down -v
docker-compose -f docker-compose.neo4j.yml up -d

# 2. Check port conflicts
lsof -i :7474
lsof -i :7687

# 3. Increase Docker memory limit
# Docker Desktop → Settings → Resources → Memory (8GB+)
```

#### 2. Cannot Connect from Application

**Symptoms:**
- Connection timeout errors
- "ServiceUnavailable" errors

**Solutions:**

```bash
# 1. Verify container is running
docker ps | grep neo4j

# 2. Test connection from host
docker exec -it tibetan-translate-neo4j cypher-shell -u neo4j -p your_password

# 3. Check environment variables
cat .env | grep NEO4J

# 4. Verify network connectivity
docker network inspect tibetan-network
```

#### 3. Plugins Not Available

**Symptoms:**
- "Unknown function apoc.version()" errors
- APOC/GDS functions don't work

**Solutions:**

```bash
# 1. Check plugin environment variable
docker-compose -f docker-compose.neo4j.yml config | grep PLUGINS

# 2. Verify plugins directory
docker exec tibetan-translate-neo4j ls -la /var/lib/neo4j/plugins

# 3. Check plugin configuration
docker exec tibetan-translate-neo4j cat /var/lib/neo4j/conf/neo4j.conf | grep apoc

# 4. Restart with fresh install
docker-compose -f docker-compose.neo4j.yml down
docker-compose -f docker-compose.neo4j.yml up -d
```

#### 4. Out of Memory Errors

**Symptoms:**
- Queries timeout
- Container crashes
- "OutOfMemoryError" in logs

**Solutions:**

```bash
# 1. Increase heap size in .env
NEO4J_HEAP_MAX=4g
NEO4J_PAGECACHE=2g

# 2. Restart container
docker-compose -f docker-compose.neo4j.yml restart neo4j

# 3. Check Docker memory limits
docker stats tibetan-translate-neo4j

# 4. Optimize queries to use less memory
# - Add LIMIT clauses
# - Use indexes
# - Avoid large cartesian products
```

### Debugging Commands

```bash
# View real-time logs
docker-compose -f docker-compose.neo4j.yml logs -f neo4j

# Execute cypher-shell
docker exec -it tibetan-translate-neo4j cypher-shell -u neo4j -p your_password

# Check container filesystem
docker exec -it tibetan-translate-neo4j bash

# View configuration
docker exec tibetan-translate-neo4j cat /var/lib/neo4j/conf/neo4j.conf

# Check Java version
docker exec tibetan-translate-neo4j java -version
```

### Getting Help

- **Neo4j Community**: https://community.neo4j.com/
- **Documentation**: https://neo4j.com/docs/
- **GitHub Issues**: https://github.com/neo4j/neo4j/issues
- **Stack Overflow**: Tag `[neo4j]`

## Production Deployment

### Security Checklist

- [ ] Change default password
- [ ] Enable TLS/SSL encryption
- [ ] Configure firewall rules
- [ ] Use Docker secrets for credentials
- [ ] Disable Neo4j Browser in production (or restrict access)
- [ ] Enable authentication and authorization
- [ ] Regular security updates
- [ ] Network isolation (VPC/private subnets)

### TLS/SSL Configuration

```yaml
# docker-compose.neo4j.yml
environment:
  NEO4J_dbms_connector_bolt_tls__level: REQUIRED
  NEO4J_dbms_ssl_policy_bolt_enabled: "true"
  NEO4J_dbms_ssl_policy_bolt_base__directory: /var/lib/neo4j/certificates
  NEO4J_dbms_ssl_policy_bolt_private__key: private.key
  NEO4J_dbms_ssl_policy_bolt_public__certificate: public.crt

volumes:
  - ./certificates:/var/lib/neo4j/certificates:ro
```

### High Availability (Enterprise)

For production workloads, consider Neo4j Enterprise with clustering:

```yaml
# Causal Cluster (3+ core servers)
services:
  neo4j-core-1:
    image: neo4j:5.25.1-enterprise
    environment:
      NEO4J_dbms_mode: CORE
      NEO4J_causal__clustering_initial__discovery__members: neo4j-core-1,neo4j-core-2,neo4j-core-3

  neo4j-core-2:
    # ... same config with different hostname

  neo4j-core-3:
    # ... same config with different hostname
```

### Monitoring

Set up monitoring with Prometheus + Grafana:

```yaml
# Enable metrics endpoint
NEO4J_metrics_enabled: "true"
NEO4J_metrics_prometheus_enabled: "true"
NEO4J_metrics_prometheus_endpoint: "0.0.0.0:2004"
```

## Reference

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `NEO4J_URI` | `bolt://localhost:7687` | Connection URI |
| `NEO4J_USERNAME` | `neo4j` | Database username |
| `NEO4J_PASSWORD` | (required) | Database password |
| `NEO4J_DATABASE` | `neo4j` | Database name |
| `NEO4J_AUTH` | `neo4j/neo4j` | Docker auth (username/password) |
| `NEO4J_HEAP_INITIAL` | `512m` | Initial heap size |
| `NEO4J_HEAP_MAX` | `2g` | Maximum heap size |
| `NEO4J_PAGECACHE` | `1g` | Page cache size |

### Useful Cypher Queries

```cypher
-- Database info
CALL dbms.components();
CALL dbms.queryJmx('org.neo4j:*');

-- Schema overview
CALL db.schema.visualization();
CALL db.labels();
CALL db.relationshipTypes();

-- Performance
CALL db.stats.retrieve('GRAPH COUNTS');
SHOW INDEXES;
SHOW CONSTRAINTS;

-- Clear all data (WARNING: destructive)
MATCH (n) DETACH DELETE n;
```

### TypeScript Client API

```typescript
// Initialize client
const client = getNeo4jClient({
  uri: 'bolt://localhost:7687',
  username: 'neo4j',
  password: 'password',
  database: 'neo4j'
});

// Connect
await client.connect();

// Health check
const healthy = await client.healthCheck();

// Read query
const results = await client.executeRead<Person>(
  'MATCH (p:Person {name: $name}) RETURN p',
  { name: 'Marpa' }
);

// Write query
await client.executeWrite(
  'CREATE (p:Person {name: $name, birthYear: $year})',
  { name: 'Marpa', year: 1012 }
);

// Transaction
await client.withWriteTransaction(async (tx) => {
  await tx.run('CREATE (p:Person {name: $name})', { name: 'Test' });
  await tx.run('CREATE (t:Text {title: $title})', { title: 'Book' });
  // Automatically commits if no errors
});

// Disconnect
await client.disconnect();
```

### Docker Compose Commands

```bash
# Start services
docker-compose -f docker-compose.neo4j.yml up -d

# View logs
docker-compose -f docker-compose.neo4j.yml logs -f neo4j

# Stop services
docker-compose -f docker-compose.neo4j.yml down

# Stop and remove volumes (WARNING: deletes data)
docker-compose -f docker-compose.neo4j.yml down -v

# Restart service
docker-compose -f docker-compose.neo4j.yml restart neo4j

# View service status
docker-compose -f docker-compose.neo4j.yml ps

# Execute command in container
docker-compose -f docker-compose.neo4j.yml exec neo4j bash
```

---

**Next Steps:**

1. Complete Phase 4.2: Graph Schema Design
2. Define node labels, properties, and constraints
3. Create indexes for performance
4. Implement entity synchronization (PostgreSQL → Neo4j)
5. Build graph query APIs

**For Support:**

- See `docs/troubleshooting/RUNBOOKS.md`
- Check GitHub Issues
- Contact: Knowledge Graph Team

---

*Last Updated: 2025-11-08*
*Phase: 4.1 - Neo4j Setup*
*Version: 1.0.0*
