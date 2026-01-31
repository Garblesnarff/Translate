# Technology Choices

This document explains the technology stack decisions for the knowledge graph project.

---

## Database Strategy: Hybrid PostgreSQL + Neo4j

### PostgreSQL (Primary)
**Purpose**: Document storage, source attribution, entity attributes

**Why**:
- ✅ Already in use for translations
- ✅ Excellent for structured entity data
- ✅ JSONB for flexible attributes
- ✅ Full-text search
- ✅ Mature, reliable, well-understood
- ✅ Strong ACID guarantees
- ✅ Easy backup and replication

**Use Cases**:
- Store entity records with all attributes
- Track source provenance (which document, which page)
- Store extraction metadata (confidence, timestamps)
- Audit logs
- User accounts and permissions

**Example Schema**:
```sql
CREATE TABLE entities (
  id UUID PRIMARY KEY,
  type VARCHAR(50),
  canonical_name VARCHAR(500),
  names JSONB,  -- All name variants
  attributes JSONB,  -- Flexible schema per type
  dates JSONB,
  confidence FLOAT,
  verified BOOLEAN
);
```

---

### Neo4j (Secondary - Graph)
**Purpose**: Relationship traversal, network analysis, lineage queries

**Why**:
- ✅ Native graph database (optimized for relationships)
- ✅ Cypher query language (human-readable)
- ✅ Fast graph traversal (follows relationships natively)
- ✅ Excellent visualization tools
- ✅ Perfect for "6 degrees of separation" queries
- ✅ Built-in graph algorithms (centrality, communities, shortest path)

**Use Cases**:
- Lineage chain queries ("show all teachers from X to Y")
- Network analysis ("who are the most influential people?")
- Path finding ("shortest connection between two figures")
- Community detection (cluster by school/tradition)
- Temporal analysis (who was alive at same time?)

**Example Query**:
```cypher
// Find teacher-student chain
MATCH path = (start:Person {name: "Marpa"})-[:teacher_of*1..10]->(end)
RETURN path
ORDER BY length(path)
```

---

### Sync Strategy
**Approach**: PostgreSQL is source of truth, Neo4j is synced copy

**Implementation**:
```typescript
// On entity create/update in PostgreSQL:
await db.insert('entities').values(entity);

// Immediately sync to Neo4j:
await neo4j.run(`
  MERGE (e:${entity.type} {id: $id})
  SET e += $properties
`, { id: entity.id, properties: entity });
```

**Benefits**:
- PostgreSQL handles complex queries, full-text search
- Neo4j handles graph traversal, visualization
- Best of both worlds

**Alternatives Considered**:
- ❌ PostgreSQL only: Graph queries slow, complex recursive CTEs
- ❌ Neo4j only: Less mature for general data operations, harder backup
- ✅ Hybrid: Leverage strengths of each

---

## AI / LLM Provider

### Choice: Multi-Provider Strategy

**Primary**: Claude 3.5 Sonnet (Anthropic)
- ✅ Best for structured extraction (JSON output)
- ✅ Large context window (200k tokens)
- ✅ Excellent instruction following
- ✅ Strong at reasoning and ambiguity handling

**Fallback 1**: GPT-4o-mini (OpenAI)
- ✅ Good balance of speed and cost
- ✅ JSON mode support
- ✅ Reliable for entity extraction

**Fallback 2**: Gemini 2.0 Flash (Google)
- ✅ Already in use for translation
- ✅ Very fast
- ✅ Cost-effective

**Why Multi-Provider**:
- Resilience: If one provider is down, use another
- Cost optimization: Use cheaper models for simple extractions
- Quality: Compare outputs for verification
- Avoid vendor lock-in

**Example**:
```typescript
const providers = [claude, gpt4oMini, gemini];
for (const provider of providers) {
  try {
    return await provider.extract(text);
  } catch (error) {
    console.log(`${provider.name} failed, trying next...`);
  }
}
```

---

## Visualization Libraries

### Timeline: vis.js Timeline
**Why**:
- ✅ Mature library specifically for timelines
- ✅ Handles large datasets well
- ✅ Zoom, pan, group, cluster
- ✅ Multiple lanes (people, events, texts)
- ✅ Good documentation

**Alternatives Considered**:
- D3.js: More flexible but requires more custom code
- Timeline.js: Limited features
- Custom React: Too much effort

---

### Network Graphs: vis-network
**Why**:
- ✅ Part of vis.js ecosystem (consistent API)
- ✅ Good performance with 1000+ nodes
- ✅ Physics simulation for layout
- ✅ Hierarchical layouts (perfect for lineages)
- ✅ Click, hover, zoom interactions

**Alternatives Considered**:
- D3.js force layout: More control but harder to implement
- Cytoscape.js: Academic focus, less user-friendly
- React Flow: Good for workflows, not ideal for historical networks

---

### Maps: Leaflet
**Why**:
- ✅ Industry standard for web maps
- ✅ Plugin ecosystem (historical map tiles, markers, heat maps)
- ✅ Mobile-friendly
- ✅ Good performance
- ✅ Can overlay historical maps

**Plugins Used**:
- Leaflet.heat: Heat maps for entity concentration
- Leaflet.timeline: Animated maps over time
- Leaflet.markercluster: Cluster nearby markers

**Alternatives Considered**:
- Google Maps: Costs money, overkill
- Mapbox: Also paid, not necessary
- OpenLayers: More complex API

---

## Frontend Framework

### Choice: React 18 + TypeScript

**Why**:
- ✅ Already in use for translation UI
- ✅ Large ecosystem of components
- ✅ TypeScript for type safety
- ✅ Component reusability
- ✅ TanStack Query for server state

**UI Library**: shadcn/ui
- ✅ Modern, accessible components
- ✅ Already in use
- ✅ Customizable with Tailwind CSS

**Alternatives Considered**:
- Vue: Smaller ecosystem for graph visualization
- Svelte: Less mature ecosystem
- Angular: Too heavyweight for this project

---

## Backend Framework

### Choice: Express.js + TypeScript

**Why**:
- ✅ Already in use for translation API
- ✅ Simple, flexible
- ✅ Large middleware ecosystem
- ✅ Easy to extend existing codebase
- ✅ Good TypeScript support

**Alternatives Considered**:
- Fastify: Slightly faster but not necessary
- NestJS: Too opinionated, heavyweight
- tRPC: Would require frontend rewrite

---

## ORM: Drizzle ORM

**Why**:
- ✅ Already in use
- ✅ Type-safe queries
- ✅ Supports both PostgreSQL and SQLite
- ✅ Good migration system
- ✅ Lightweight

**Alternatives Considered**:
- Prisma: Heavier, client generation step
- TypeORM: Less type-safe
- Kysely: Similar but less mature

---

## Validation: Zod

**Why**:
- ✅ TypeScript-first
- ✅ Runtime validation + static types
- ✅ Excellent error messages
- ✅ Composable schemas
- ✅ Already in use

**Example**:
```typescript
const PersonSchema = z.object({
  type: z.literal('person'),
  names: z.object({
    tibetan: z.array(z.string()),
    english: z.array(z.string())
  }),
  dates: z.object({
    birth: DateInfoSchema.optional()
  }).optional()
});

// Infer TypeScript type
type Person = z.infer<typeof PersonSchema>;
```

---

## Testing: Vitest

**Why**:
- ✅ Fast (parallel, async)
- ✅ Compatible with Jest syntax
- ✅ Good TypeScript support
- ✅ Already in use
- ✅ Built-in coverage

**Test Types**:
- Unit tests: Entity extraction, validation, utilities
- Integration tests: API endpoints, database operations
- E2E tests: Full extraction pipeline

---

## Deployment

### Development: Docker Compose

**Why**:
- ✅ Consistent environment
- ✅ Easy to spin up PostgreSQL + Neo4j + Redis
- ✅ One command: `docker-compose up`

**Services**:
```yaml
services:
  postgres:
    image: postgres:16
  neo4j:
    image: neo4j:5.15
    plugins: ["apoc", "graph-data-science"]
  redis:
    image: redis:7-alpine
  app:
    build: .
    depends_on: [postgres, neo4j, redis]
```

---

### Production: Docker + VPS

**Why**:
- ✅ Self-hosted (data sovereignty for monastery archives)
- ✅ Cost-effective (Hetzner VPS ~$20/month)
- ✅ Full control
- ✅ No vendor lock-in

**Architecture**:
```
┌─────────────────────────────────────┐
│  Caddy (Reverse Proxy + SSL)       │
└─────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────┐
│  Docker Container (Node.js App)     │
└─────────────────────────────────────┘
     │                │             │
     ▼                ▼             ▼
┌────────┐      ┌────────┐    ┌────────┐
│PostgreSQL│     │ Neo4j  │    │ Redis  │
└────────┘      └────────┘    └────────┘
```

**Alternatives Considered**:
- Heroku/Railway: Expensive for PostgreSQL + Neo4j
- AWS/GCP: Complex, overkill, expensive
- DigitalOcean: Similar to Hetzner but slightly pricier

---

## CI/CD: GitHub Actions

**Why**:
- ✅ Free for public repos
- ✅ Integrated with GitHub
- ✅ Good Docker support
- ✅ Easy to configure

**Pipeline**:
```yaml
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - Checkout code
      - Setup Node.js 18
      - npm ci
      - npm run check (TypeScript)
      - npm test (Vitest)
      - npm run build

  deploy:
    needs: test
    if: github.ref == 'refs/heads/main'
    steps:
      - Build Docker image
      - Push to registry
      - SSH to VPS
      - Pull and restart containers
```

---

## Monitoring

### Choice: Prometheus + Grafana + Sentry

**Prometheus**: Metrics collection
- ✅ Industry standard
- ✅ Pull-based (less intrusive)
- ✅ Rich query language (PromQL)
- ✅ Good for time-series data

**Grafana**: Visualization
- ✅ Beautiful dashboards
- ✅ Alerting
- ✅ Connects to Prometheus easily

**Sentry**: Error tracking
- ✅ Captures errors automatically
- ✅ Source map support
- ✅ Releases and tracking
- ✅ Free tier generous

**Metrics to Track**:
- Extraction speed (entities/minute)
- Confidence score distribution
- API response times
- Database query performance
- Error rates
- Curator verification rates

---

## Authentication & Authorization

### Choice: API Keys + PostgreSQL

**Why**:
- ✅ Simple for research tool
- ✅ No OAuth complexity needed
- ✅ Easy to generate and revoke
- ✅ Per-key rate limiting

**Schema**:
```sql
CREATE TABLE api_keys (
  id UUID PRIMARY KEY,
  key VARCHAR(64) UNIQUE,
  user_id UUID,
  permissions JSONB, -- {read: true, write: false, admin: false}
  rate_limit INT DEFAULT 100, -- requests per hour
  expires_at TIMESTAMP,
  created_at TIMESTAMP
);
```

**Alternatives Considered**:
- OAuth: Overkill for internal research tool
- JWT: Stateless but harder to revoke
- Session-based: Not ideal for API

---

## Backup Strategy

### PostgreSQL
**Method**: pg_dump daily
**Storage**: Local + S3-compatible (Backblaze B2)
**Retention**: 30 daily, 12 monthly, 7 yearly

### Neo4j
**Method**: neo4j-admin dump
**Storage**: Same as PostgreSQL
**Frequency**: Daily

### Application Code
**Method**: Git + GitHub
**Backup**: Automatic (Git history)

---

## Cost Estimate (Monthly)

**Infrastructure**:
- VPS (Hetzner CX21): $8/month
- Backups (Backblaze B2): $1/month
- Domain + SSL: $1/month

**AI APIs** (estimate for 1000 pages/month):
- Claude API: ~$5/month (primary)
- OpenAI API: ~$2/month (fallback)
- Gemini API: ~$1/month (fallback)

**Total: ~$18/month** for self-hosted research tool

**Compare to**:
- Heroku Postgres + Neo4j + Redis: ~$100/month
- AWS equivalent: ~$150/month
- Human translation cost for same pages: $50,000+

---

## Performance Targets

**Entity Extraction**:
- Single document: <30 seconds
- Batch (20 docs): <10 minutes (parallel processing)

**Database Queries**:
- Entity lookup by ID: <10ms
- Relationship query: <50ms
- Complex graph traversal (10 hops): <500ms

**Visualizations**:
- Timeline render (1000 entities): <2s
- Network graph (500 nodes): <3s
- Map with 200 markers: <1s

**API Response Times**:
- Simple GET: <100ms
- Complex search: <500ms
- Graph query: <1s

---

## Scalability Considerations

**Current Design**: Handles up to:
- 100,000 entities
- 500,000 relationships
- 50 concurrent users
- 1,000 API requests/hour

**If We Need to Scale**:
- Add read replicas for PostgreSQL
- Cluster Neo4j (Enterprise edition)
- Add Redis for caching
- CDN for static assets
- Horizontal scaling (multiple app instances)

**Reality**: Unlikely to need more for academic research tool. Tibetan Buddhist corpus is finite.

---

## Technology Decision Matrix

| Requirement | Options Considered | Choice | Why |
|-------------|-------------------|--------|-----|
| Primary DB | PostgreSQL, MongoDB, Neo4j only | PostgreSQL | Structured data, already in use |
| Graph DB | Neo4j, ArangoDB, JanusGraph | Neo4j | Mature, great docs, Cypher query language |
| Backend | Express, Fastify, NestJS | Express | Simple, already in use, good ecosystem |
| Frontend | React, Vue, Svelte | React | Largest ecosystem, already in use |
| Timeline | vis.js, D3.js, custom | vis.js | Purpose-built, good performance |
| Network Graph | vis-network, D3.js, Cytoscape | vis-network | Easy to use, good for hierarchies |
| Map | Leaflet, Google Maps, Mapbox | Leaflet | Free, plugin ecosystem, good enough |
| AI Provider | Claude, GPT-4, Gemini | Multi-provider | Resilience, cost optimization |
| ORM | Drizzle, Prisma, TypeORM | Drizzle | Type-safe, already in use, lightweight |
| Testing | Vitest, Jest, Mocha | Vitest | Fast, modern, good TS support |
| Deployment | Docker, Kubernetes, VPS | Docker on VPS | Cost-effective, sufficient scale |

---

## Open Source Licenses

All chosen technologies are open source or have generous free tiers:
- PostgreSQL: PostgreSQL License (permissive)
- Neo4j Community: GPLv3 (OK for open source research tools)
- Node.js/Express: MIT
- React: MIT
- vis.js: MIT/Apache 2.0
- Leaflet: BSD 2-Clause

**Our Project License Recommendation**: MIT or Apache 2.0
- Allows academic and commercial use
- Encourages collaboration
- Compatible with all dependencies

---

*Technology choices prioritize pragmatism, cost-effectiveness, and maintainability over perfection.*
