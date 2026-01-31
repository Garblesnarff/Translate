# Graph Query API Documentation

Complete reference for querying the Tibetan Buddhist Knowledge Graph via REST API.

**Base URL**: `http://localhost:5439/api/graph`

**Phase**: 4.4 - Graph Query API

---

## Table of Contents

1. [Lineage Queries](#lineage-queries)
2. [Path Queries](#path-queries)
3. [Network Queries](#network-queries)
4. [Timeline Queries](#timeline-queries)
5. [Authorship Queries](#authorship-queries)
6. [Geographic Queries](#geographic-queries)
7. [Analysis Queries](#analysis-queries)
8. [Search Queries](#search-queries)
9. [Metrics & Administration](#metrics--administration)
10. [Error Handling](#error-handling)
11. [Performance Tips](#performance-tips)

---

## Lineage Queries

### Get Teacher Lineage

Find the complete transmission lineage from historical root teacher to target person.

**Endpoint**: `GET /api/graph/lineage/:personId`

**Parameters**:
- `personId` (path, required): Entity ID of the person
- `type` (query, optional): `teacher` (default) or `student`
- `maxDepth` (query, optional): Maximum lineage depth (default: 10)
- `includeDetails` (query, optional): Include full entity details (default: true)
- `minConfidence` (query, optional): Minimum relationship confidence (0-1)

**Example Request**:
```bash
curl "http://localhost:5439/api/graph/lineage/milarepa-123?type=teacher&maxDepth=5"
```

**Example Response**:
```json
{
  "root": {
    "id": "tilopa-456",
    "type": "person",
    "canonicalName": "Tilopa",
    "names": {
      "english": ["Tilopa"],
      "tibetan": ["ཏི་ལོ་པ།"],
      "phonetic": ["ti lo pa"]
    },
    "confidence": 0.95,
    "verified": true
  },
  "path": [
    {
      "entity": {
        "id": "tilopa-456",
        "canonicalName": "Tilopa"
      },
      "position": 0,
      "children": []
    },
    {
      "entity": {
        "id": "naropa-789",
        "canonicalName": "Naropa"
      },
      "position": 1,
      "relationship": {
        "id": "rel-1",
        "predicate": "TEACHER_OF",
        "confidence": 0.98
      },
      "children": []
    },
    {
      "entity": {
        "id": "marpa-012",
        "canonicalName": "Marpa Lotsawa"
      },
      "position": 2,
      "relationship": {
        "id": "rel-2",
        "predicate": "TEACHER_OF",
        "confidence": 0.97
      },
      "children": []
    },
    {
      "entity": {
        "id": "milarepa-123",
        "canonicalName": "Milarepa"
      },
      "position": 3,
      "relationship": {
        "id": "rel-3",
        "predicate": "TEACHER_OF",
        "confidence": 0.96
      },
      "children": []
    }
  ],
  "depth": 3,
  "totalConfidence": 0.91
}
```

**Cypher Query Used**:
```cypher
MATCH path = (root:Person)<-[:TEACHER_OF*1..5]-(target:Person {id: 'milarepa-123'})
WHERE NOT (()<-[:TEACHER_OF]-(root))
  AND ALL(r IN relationships(path) WHERE toFloat(r.confidence) >= 0)
RETURN path, relationships(path) as rels, nodes(path) as allNodes,
       reduce(conf = 1.0, r IN relationships(path) | conf * toFloat(r.confidence)) as totalConfidence,
       length(path) as depth
ORDER BY totalConfidence DESC, length(path) ASC
LIMIT 1
```

---

### Get Incarnation Line

Find all incarnations in a tulku lineage (e.g., Dalai Lama succession).

**Endpoint**: `GET /api/graph/incarnation/:personId`

**Parameters**:
- `personId` (path, required): Entity ID of any person in the incarnation line

**Example Request**:
```bash
curl "http://localhost:5439/api/graph/incarnation/dalai-lama-14"
```

**Example Response**:
```json
[
  {
    "id": "dalai-lama-1",
    "canonicalName": "Gendun Drup",
    "dates": {
      "birth": {"year": 1391, "certainty": "approximate"},
      "death": {"year": 1474, "certainty": "approximate"}
    }
  },
  {
    "id": "dalai-lama-2",
    "canonicalName": "Gendun Gyatso",
    "dates": {
      "birth": {"year": 1475},
      "death": {"year": 1542}
    }
  },
  // ... continues through all incarnations
  {
    "id": "dalai-lama-14",
    "canonicalName": "Tenzin Gyatso",
    "dates": {
      "birth": {"year": 1935, "month": 7, "day": 6}
    }
  }
]
```

---

## Path Queries

### Find Shortest Path

Find the shortest connection between two entities.

**Endpoint**: `GET /api/graph/path`

**Parameters**:
- `from` (query, required): Starting entity ID
- `to` (query, required): Ending entity ID
- `maxLength` (query, optional): Maximum path length (default: 10)
- `relationshipTypes` (query, optional): Comma-separated list of relationship types to traverse

**Example Request**:
```bash
curl "http://localhost:5439/api/graph/path?from=milarepa-123&to=tsongkhapa-456&maxLength=6"
```

**Example Response**:
```json
{
  "nodes": [
    {"id": "milarepa-123", "canonicalName": "Milarepa"},
    {"id": "gampopa-789", "canonicalName": "Gampopa"},
    {"id": "phagmo-drupa-012", "canonicalName": "Phagmo Drupa"},
    {"id": "tsongkhapa-456", "canonicalName": "Tsongkhapa"}
  ],
  "relationships": [
    {
      "id": "rel-1",
      "subjectId": "milarepa-123",
      "predicate": "TEACHER_OF",
      "objectId": "gampopa-789",
      "confidence": 0.98
    },
    {
      "id": "rel-2",
      "subjectId": "gampopa-789",
      "predicate": "TEACHER_OF",
      "objectId": "phagmo-drupa-012",
      "confidence": 0.95
    },
    {
      "id": "rel-3",
      "subjectId": "phagmo-drupa-012",
      "predicate": "INFLUENCED",
      "objectId": "tsongkhapa-456",
      "confidence": 0.75
    }
  ],
  "length": 3,
  "totalConfidence": 0.69
}
```

---

### Find All Paths

Find all possible paths between two entities (up to a limit).

**Endpoint**: `GET /api/graph/paths/all`

**Parameters**:
- `from` (query, required): Starting entity ID
- `to` (query, required): Ending entity ID
- `maxLength` (query, optional): Maximum path length (default: 5)
- `limit` (query, optional): Maximum number of paths to return (default: 10)

**Example Request**:
```bash
curl "http://localhost:5439/api/graph/paths/all?from=entity-1&to=entity-2&limit=5"
```

**Example Response**:
```json
[
  {
    "nodes": [...],
    "relationships": [...],
    "length": 2,
    "totalConfidence": 0.95
  },
  {
    "nodes": [...],
    "relationships": [...],
    "length": 3,
    "totalConfidence": 0.87
  },
  // ... up to 5 paths
]
```

---

## Network Queries

### Get Entity Network

Get an entity's immediate network (1-3 hop neighborhood).

**Endpoint**: `GET /api/graph/network/:centerId`

**Parameters**:
- `centerId` (path, required): Central entity ID
- `depth` (query, optional): Network depth in hops (default: 2, max: 3)
- `relationshipTypes` (query, optional): Filter by relationship types
- `entityTypes` (query, optional): Filter by entity types (Person, Text, Place, etc.)
- `minConfidence` (query, optional): Minimum relationship confidence

**Example Request**:
```bash
curl "http://localhost:5439/api/graph/network/milarepa-123?depth=2&entityTypes=Person,Text"
```

**Example Response**:
```json
{
  "centerNode": {
    "id": "milarepa-123",
    "canonicalName": "Milarepa"
  },
  "nodes": [
    {"id": "marpa-012", "canonicalName": "Marpa", "type": "person"},
    {"id": "gampopa-789", "canonicalName": "Gampopa", "type": "person"},
    {"id": "hundred-thousand-songs", "canonicalName": "Hundred Thousand Songs", "type": "text"}
  ],
  "edges": [
    {
      "id": "rel-1",
      "subjectId": "marpa-012",
      "predicate": "TEACHER_OF",
      "objectId": "milarepa-123",
      "confidence": 0.98
    },
    {
      "id": "rel-2",
      "subjectId": "milarepa-123",
      "predicate": "WROTE",
      "objectId": "hundred-thousand-songs",
      "confidence": 0.85
    }
  ],
  "statistics": {
    "nodeCount": 12,
    "edgeCount": 18,
    "avgConfidence": 0.87
  }
}
```

---

### Find Contemporaries

Find people who lived at the same time.

**Endpoint**: `GET /api/graph/contemporaries/:personId`

**Parameters**:
- `personId` (path, required): Person entity ID
- `yearRange` (query, optional): ±N years tolerance (default: 50)
- `sameLocation` (query, optional): Must have lived in same place (default: false)
- `sameTradition` (query, optional): Must belong to same tradition (default: false)

**Example Request**:
```bash
curl "http://localhost:5439/api/graph/contemporaries/milarepa-123?yearRange=30"
```

**Example Response**:
```json
[
  {
    "id": "atisha-456",
    "canonicalName": "Atisha",
    "dates": {
      "birth": {"year": 982},
      "death": {"year": 1054}
    }
  },
  {
    "id": "marpa-012",
    "canonicalName": "Marpa",
    "dates": {
      "birth": {"year": 1012},
      "death": {"year": 1097}
    }
  }
]
```

---

## Timeline Queries

### Get Timeline

Get all entities/events in a specific time range.

**Endpoint**: `GET /api/graph/timeline`

**Parameters**:
- `start` (query, required): Start year
- `end` (query, required): End year
- `entityTypes` (query, optional): Filter by types (Person, Event, Text, Institution)
- `location` (query, optional): Filter by location
- `tradition` (query, optional): Filter by Buddhist tradition

**Example Request**:
```bash
curl "http://localhost:5439/api/graph/timeline?start=1000&end=1200&tradition=Kagyu"
```

**Example Response**:
```json
[
  {
    "timestamp": 1012,
    "entity": {
      "id": "marpa-012",
      "canonicalName": "Marpa",
      "type": "person"
    },
    "event": "birth"
  },
  {
    "timestamp": 1040,
    "entity": {
      "id": "milarepa-123",
      "canonicalName": "Milarepa",
      "type": "person"
    },
    "event": "birth"
  },
  {
    "timestamp": 1079,
    "entity": {
      "id": "gampopa-789",
      "canonicalName": "Gampopa",
      "type": "person"
    },
    "event": "birth"
  }
]
```

---

### Get Entity Timeline

Get chronological events related to a specific entity.

**Endpoint**: `GET /api/graph/entity/:entityId/timeline`

**Parameters**:
- `entityId` (path, required): Entity ID

**Example Request**:
```bash
curl "http://localhost:5439/api/graph/entity/milarepa-123/timeline"
```

**Example Response**:
```json
[
  {
    "date": {"year": 1040},
    "type": "birth",
    "description": "Born",
    "relatedEntities": []
  },
  {
    "date": {"year": 1079},
    "type": "teaching",
    "description": "Met teacher Marpa",
    "relatedEntities": [
      {"id": "marpa-012", "canonicalName": "Marpa"}
    ]
  },
  {
    "date": {"year": 1123},
    "type": "death",
    "description": "Died",
    "relatedEntities": []
  }
]
```

---

## Authorship Queries

### Get Texts by Author

Find all texts written by a specific author.

**Endpoint**: `GET /api/graph/author/:authorId/texts`

**Parameters**:
- `authorId` (path, required): Author entity ID
- `sortBy` (query, optional): Sort by `date` or `name` (default: name)
- `includeCommentaries` (query, optional): Include commentaries (default: true)

**Example Request**:
```bash
curl "http://localhost:5439/api/graph/author/tsongkhapa-456/texts?sortBy=date"
```

**Example Response**:
```json
[
  {
    "entity": {
      "id": "lamrim-chenmo",
      "canonicalName": "The Great Treatise on the Stages of the Path",
      "type": "text"
    },
    "author": {
      "id": "tsongkhapa-456",
      "canonicalName": "Tsongkhapa"
    },
    "writtenDate": {"year": 1402},
    "commentaries": []
  },
  {
    "entity": {
      "id": "three-principal-aspects",
      "canonicalName": "The Three Principal Aspects of the Path",
      "type": "text"
    },
    "author": {
      "id": "tsongkhapa-456",
      "canonicalName": "Tsongkhapa"
    },
    "writtenDate": {"year": 1415},
    "commentaries": [
      {
        "entity": {
          "id": "commentary-xyz",
          "canonicalName": "Commentary on Three Principal Aspects"
        }
      }
    ]
  }
]
```

---

### Get Citation Network

Find texts that cite or are cited by a specific text.

**Endpoint**: `GET /api/graph/text/:textId/citations`

**Parameters**:
- `textId` (path, required): Text entity ID
- `direction` (query, optional): `outgoing` (cites), `incoming` (cited by), or `both` (default: both)
- `maxDepth` (query, optional): Maximum citation depth (default: 3)

**Example Request**:
```bash
curl "http://localhost:5439/api/graph/text/lamrim-chenmo/citations?direction=outgoing&maxDepth=2"
```

**Example Response**:
```json
{
  "centerNode": {
    "id": "lamrim-chenmo",
    "canonicalName": "Lamrim Chenmo"
  },
  "nodes": [
    {"id": "abhisamayalamkara", "canonicalName": "Abhisamayalamkara"},
    {"id": "madhyamakavatara", "canonicalName": "Madhyamakavatara"}
  ],
  "edges": [
    {
      "predicate": "CITES",
      "subjectId": "lamrim-chenmo",
      "objectId": "abhisamayalamkara"
    }
  ],
  "statistics": {
    "nodeCount": 25,
    "edgeCount": 42,
    "avgConfidence": 0.88
  }
}
```

---

## Geographic Queries

### Find Nearby Entities

Find entities within a geographic radius.

**Endpoint**: `GET /api/graph/nearby`

**Parameters**:
- `lat` (query, required): Latitude
- `lon` (query, required): Longitude
- `radius` (query, required): Radius in kilometers
- `entityTypes` (query, optional): Filter by entity types

**Example Request**:
```bash
curl "http://localhost:5439/api/graph/nearby?lat=27.9881&lon=86.9250&radius=100&entityTypes=Place,Institution"
```

**Example Response**:
```json
[
  {
    "id": "everest-monastery",
    "canonicalName": "Rongbuk Monastery",
    "type": "institution",
    "attributes": {
      "latitude": 28.1316,
      "longitude": 86.8555
    },
    "distanceKm": 16.2
  },
  {
    "id": "lhasa-jokhang",
    "canonicalName": "Jokhang Temple",
    "type": "place",
    "attributes": {
      "latitude": 29.6519,
      "longitude": 91.1315
    },
    "distanceKm": 85.7
  }
]
```

---

### Get Person's Journey

Find all places a person lived, studied, or visited.

**Endpoint**: `GET /api/graph/person/:personId/journey`

**Parameters**:
- `personId` (path, required): Person entity ID

**Example Request**:
```bash
curl "http://localhost:5439/api/graph/person/milarepa-123/journey"
```

**Example Response**:
```json
[
  {
    "place": {
      "id": "kya-ngatsa",
      "canonicalName": "Kya Ngatsa"
    },
    "startDate": {"year": 1040},
    "endDate": {"year": 1055},
    "purpose": "LIVED_AT",
    "confidence": 0.90
  },
  {
    "place": {
      "id": "lhodrak",
      "canonicalName": "Lhodrak"
    },
    "startDate": {"year": 1055},
    "endDate": {"year": 1067},
    "purpose": "STUDIED_AT",
    "confidence": 0.95
  }
]
```

---

## Analysis Queries

### Get Most Influential Entities

Find entities with highest degree centrality (most connections).

**Endpoint**: `GET /api/graph/influential`

**Parameters**:
- `entityType` (query, optional): Filter by type (Person, Text, Institution)
- `tradition` (query, optional): Filter by tradition
- `startYear` (query, optional): Filter by time range start
- `endYear` (query, optional): Filter by time range end
- `limit` (query, optional): Max results (default: 50)

**Example Request**:
```bash
curl "http://localhost:5439/api/graph/influential?entityType=Person&tradition=Gelug&limit=10"
```

**Example Response**:
```json
[
  {
    "entity": {
      "id": "tsongkhapa-456",
      "canonicalName": "Tsongkhapa"
    },
    "influence": 245.8
  },
  {
    "entity": {
      "id": "dalai-lama-5",
      "canonicalName": "Fifth Dalai Lama"
    },
    "influence": 198.3
  }
]
```

---

### Detect Communities

Find clusters/communities in the graph using GDS algorithms.

**Endpoint**: `GET /api/graph/communities`

**Parameters**:
- `algorithm` (query, optional): `louvain` or `label_propagation` (default: louvain)
- `relationshipTypes` (query, optional): Filter relationships

**Example Request**:
```bash
curl "http://localhost:5439/api/graph/communities?algorithm=louvain"
```

**Example Response**:
```json
[
  {
    "id": 1,
    "size": 45,
    "cohesion": 0.82,
    "members": [
      {"id": "entity-1", "canonicalName": "..."},
      {"id": "entity-2", "canonicalName": "..."}
    ]
  },
  {
    "id": 2,
    "size": 38,
    "cohesion": 0.75,
    "members": [...]
  }
]
```

**Note**: Requires Neo4j Graph Data Science library. Returns empty array if GDS not installed.

---

### Suggest Relationships

Find potential missing relationships based on common neighbors.

**Endpoint**: `GET /api/graph/suggest-relationships/:entityId`

**Parameters**:
- `entityId` (path, required): Entity ID
- `relationshipType` (query, optional): Suggested relationship type
- `minSimilarity` (query, optional): Minimum similarity score (0-1, default: 0.5)

**Example Request**:
```bash
curl "http://localhost:5439/api/graph/suggest-relationships/person-123?minSimilarity=0.7"
```

**Example Response**:
```json
[
  {
    "fromEntity": {"id": "person-123", "canonicalName": "..."},
    "toEntity": {"id": "person-456", "canonicalName": "..."},
    "suggestedPredicate": "related_to",
    "confidence": 0.85,
    "reasoning": "12 common connections (85% similarity)"
  }
]
```

---

## Search Queries

### Full-Text Search

Search entities by name (fuzzy matching supported).

**Endpoint**: `GET /api/graph/search`

**Parameters**:
- `q` (query, required): Search term
- `entityTypes` (query, optional): Filter by types
- `fuzzy` (query, optional): Enable fuzzy matching (default: true)
- `limit` (query, optional): Max results (default: 20)

**Example Request**:
```bash
curl "http://localhost:5439/api/graph/search?q=milarepa&fuzzy=true&limit=10"
```

**Example Response**:
```json
[
  {
    "entity": {
      "id": "milarepa-123",
      "canonicalName": "Milarepa",
      "type": "person"
    },
    "score": 1.0,
    "matchedFields": ["canonicalName"]
  },
  {
    "entity": {
      "id": "hundred-thousand-songs",
      "canonicalName": "Hundred Thousand Songs of Milarepa",
      "type": "text"
    },
    "score": 0.7,
    "matchedFields": ["names.english"]
  }
]
```

---

### Custom Cypher Query

Execute custom read-only Cypher queries.

**Endpoint**: `POST /api/graph/query`

**Request Body**:
```json
{
  "query": "MATCH (p:Person)-[:TEACHER_OF]->(s:Person) WHERE p.id = $teacherId RETURN s",
  "params": {
    "teacherId": "marpa-012"
  }
}
```

**Security**: Only read queries (MATCH, RETURN, WITH) are allowed. Write operations (CREATE, DELETE, SET, etc.) are blocked.

**Example Request**:
```bash
curl -X POST "http://localhost:5439/api/graph/query" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "MATCH (p:Person {id: $id})-[:WROTE]->(t:Text) RETURN t LIMIT 5",
    "params": {"id": "tsongkhapa-456"}
  }'
```

**Example Response**:
```json
[
  {
    "t": {
      "id": "lamrim-chenmo",
      "properties": {...}
    }
  },
  {
    "t": {
      "id": "three-principal-aspects",
      "properties": {...}
    }
  }
]
```

---

## Metrics & Administration

### Get Query Metrics

Get performance statistics for graph queries.

**Endpoint**: `GET /api/graph/metrics`

**Parameters**:
- `queryType` (query, optional): Filter by specific query type

**Example Request**:
```bash
curl "http://localhost:5439/api/graph/metrics?queryType=teacher-lineage"
```

**Example Response**:
```json
{
  "teacher-lineage": {
    "queryType": "teacher-lineage",
    "totalQueries": 342,
    "avgDuration": 245,
    "p50Duration": 198,
    "p95Duration": 456,
    "p99Duration": 892,
    "maxDuration": 1240,
    "minDuration": 45,
    "totalResults": 1826,
    "avgResults": 5,
    "cacheHitRate": 0.73,
    "errorRate": 0.02
  }
}
```

---

### Get Slow Queries

Identify slow-performing queries.

**Endpoint**: `GET /api/graph/slow-queries`

**Parameters**:
- `threshold` (query, optional): Minimum duration in ms (default: 1000)

**Example Request**:
```bash
curl "http://localhost:5439/api/graph/slow-queries?threshold=500"
```

**Example Response**:
```json
[
  {
    "queryType": "all-paths",
    "durationMs": 2340,
    "resultCount": 125,
    "timestamp": "2025-11-08T10:23:45.678Z"
  },
  {
    "queryType": "network",
    "durationMs": 1820,
    "resultCount": 456,
    "timestamp": "2025-11-08T10:20:12.345Z"
  }
]
```

---

### Clear Query Cache

Clear the in-memory query cache.

**Endpoint**: `POST /api/graph/cache/clear`

**Request Body**:
```json
{
  "pattern": "lineage.*"
}
```

**Parameters**:
- `pattern` (optional): Regex pattern to match cache keys (omit to clear all)

**Example Request**:
```bash
curl -X POST "http://localhost:5439/api/graph/cache/clear" \
  -H "Content-Type: application/json" \
  -d '{"pattern": "teacher-lineage.*"}'
```

**Example Response**:
```json
{
  "message": "Cache cleared successfully",
  "pattern": "teacher-lineage.*"
}
```

---

## Error Handling

All endpoints return errors in this format:

```json
{
  "error": "Entity not found",
  "details": "No entity with id 'invalid-123' exists in the graph"
}
```

**Common HTTP Status Codes**:
- `200 OK` - Success
- `400 Bad Request` - Missing or invalid parameters
- `403 Forbidden` - Unauthorized operation (e.g., write query in custom endpoint)
- `404 Not Found` - Entity or path not found
- `429 Too Many Requests` - Rate limit exceeded
- `500 Internal Server Error` - Database or server error

---

## Performance Tips

### Caching
- Common queries are cached for 10-60 minutes
- Cache hit rate typically 70%+
- Clear cache after bulk data updates

### Query Optimization
1. **Use specific entity types**: `entityTypes=Person` instead of all types
2. **Limit depth**: Keep `maxDepth` ≤ 5 for path queries
3. **Filter by confidence**: Use `minConfidence=0.7` to reduce noise
4. **Use pagination**: Limit results to avoid large responses

### Performance Targets
- **Lineage query** (5 hops): <500ms
- **Shortest path** (max 10 hops): <1s
- **Network query** (2 hops, 100 nodes): <300ms
- **Timeline query** (200-year range): <500ms
- **Full-text search**: <200ms

### Slow Query Investigation
1. Check `/api/graph/slow-queries` for problematic patterns
2. Review `/api/graph/metrics` for per-type statistics
3. Reduce depth/limit parameters
4. Ensure Neo4j indexes exist on frequently queried properties

---

## Examples Collection

### Use Case: Trace Kagyu Lineage

```bash
# Get teacher lineage from Milarepa back to Tilopa
curl "http://localhost:5439/api/graph/lineage/milarepa-123?type=teacher"

# Get student lineage from Gampopa forward
curl "http://localhost:5439/api/graph/lineage/gampopa-789?type=student"
```

### Use Case: Find Connections Between Traditions

```bash
# Find path between Kagyu and Gelug masters
curl "http://localhost:5439/api/graph/path?from=milarepa-123&to=tsongkhapa-456"

# Get all paths (to see multiple connection routes)
curl "http://localhost:5439/api/graph/paths/all?from=milarepa-123&to=tsongkhapa-456&limit=5"
```

### Use Case: Scholarly Research on Texts

```bash
# Find all texts by Tsongkhapa
curl "http://localhost:5439/api/graph/author/tsongkhapa-456/texts?sortBy=date"

# Get citation network for Lamrim Chenmo
curl "http://localhost:5439/api/graph/text/lamrim-chenmo/citations?maxDepth=2"
```

### Use Case: Geographic Analysis

```bash
# Find monasteries near Lhasa
curl "http://localhost:5439/api/graph/nearby?lat=29.6519&lon=91.1315&radius=50&entityTypes=Institution"

# Trace a master's travels
curl "http://localhost:5439/api/graph/person/atisha-456/journey"
```

### Use Case: Historical Timeline

```bash
# Get 11th century Tibetan Buddhist events
curl "http://localhost:5439/api/graph/timeline?start=1000&end=1100&entityTypes=Person,Event"

# Get Milarepa's life events
curl "http://localhost:5439/api/graph/entity/milarepa-123/timeline"
```

---

## API Rate Limits

- **Default**: 100 requests per 15 minutes per IP
- **Burst**: Up to 10 concurrent requests
- **Headers**: Rate limit info returned in `X-RateLimit-*` headers

---

## Support & Issues

For bugs, feature requests, or questions:
- GitHub Issues: https://github.com/your-repo/issues
- Documentation: /docs/api/
- Neo4j Browser: http://localhost:7474 (development only)

---

**Last Updated**: November 2025
**API Version**: 1.0
**Phase**: 4.4 - Graph Query API
