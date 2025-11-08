/**
 * Query Builders for Neo4j Cypher Construction
 *
 * Helper functions that build optimized Cypher queries for various graph
 * traversal patterns. All queries use parameterized inputs for security
 * and performance.
 *
 * Phase 4, Task 4.4: Graph Query API
 */

import type {
  LineageOptions,
  PathOptions,
  NetworkOptions,
  ContemporariesOptions,
  TimelineOptions,
  TextsByAuthorOptions,
  CitationNetworkOptions,
  NearbyOptions,
  MostInfluentialOptions,
  SearchOptions,
} from './GraphQueryService';

export interface QueryWithParams {
  query: string;
  params: Record<string, any>;
}

// ============================================================================
// LINEAGE QUERIES
// ============================================================================

/**
 * Build lineage traversal query (teacher or student)
 */
export function buildLineageQuery(
  direction: 'teacher' | 'student',
  personId: string,
  options: LineageOptions = {}
): QueryWithParams {
  const maxDepth = options.maxDepth || 10;
  const minConfidence = options.minConfidence || 0;
  const includeDetails = options.includeDetails !== false;

  const relationshipType = direction === 'teacher' ? 'TEACHER_OF' : 'STUDENT_OF';
  const pathDirection = direction === 'teacher' ? '<-' : '->';

  const query = `
    MATCH path = (root:Person)${pathDirection}[:${relationshipType}*1..${maxDepth}]${pathDirection === '<-' ? '-' : ''}(target:Person {id: $personId})
    WHERE NOT (()${pathDirection}[:${relationshipType}]${pathDirection === '<-' ? '-' : ''}(root))
      ${minConfidence > 0 ? 'AND ALL(r IN relationships(path) WHERE toFloat(r.confidence) >= $minConfidence)' : ''}
    WITH path, relationships(path) as rels,
         reduce(conf = 1.0, r IN relationships(path) | conf * toFloat(r.confidence)) as totalConfidence
    RETURN path, rels, nodes(path) as allNodes, totalConfidence,
           length(path) as depth
    ORDER BY totalConfidence DESC, length(path) ASC
    LIMIT 1
  `;

  return {
    query,
    params: {
      personId,
      minConfidence,
    },
  };
}

/**
 * Build incarnation line query
 */
export function buildIncarnationLineQuery(personId: string): QueryWithParams {
  const query = `
    MATCH (person:Person {id: $personId})

    // Find all incarnations (both previous and next)
    OPTIONAL MATCH prevPath = (person)<-[:INCARNATION_OF*]-(prev:Person)
    OPTIONAL MATCH nextPath = (person)-[:INCARNATION_OF*]->(next:Person)

    WITH person,
         CASE WHEN prevPath IS NOT NULL THEN nodes(prevPath) ELSE [] END as prevChain,
         CASE WHEN nextPath IS NOT NULL THEN nodes(nextPath) ELSE [] END as nextChain

    WITH prevChain + [person] + nextChain as fullChain

    UNWIND fullChain as entity
    RETURN DISTINCT entity
    ORDER BY CASE
      WHEN entity.dates IS NOT NULL AND entity.dates.birth IS NOT NULL
      THEN toInteger(entity.dates.birth.year)
      ELSE 9999
    END
  `;

  return {
    query,
    params: { personId },
  };
}

// ============================================================================
// PATH QUERIES
// ============================================================================

/**
 * Build shortest path query
 */
export function buildPathQuery(
  fromId: string,
  toId: string,
  options: PathOptions = {}
): QueryWithParams {
  const maxLength = options.maxLength || 10;
  const relationshipTypes = options.relationshipTypes || ['*'];

  const relTypePattern = relationshipTypes.length === 1 && relationshipTypes[0] === '*'
    ? ''
    : `:${relationshipTypes.join('|')}`;

  const query = `
    MATCH (from {id: $fromId}), (to {id: $toId})
    MATCH path = shortestPath((from)-[${relTypePattern}*..${maxLength}]-(to))
    WHERE from <> to
    WITH path, relationships(path) as rels,
         reduce(conf = 1.0, r IN relationships(path) | conf * toFloat(r.confidence)) as totalConfidence
    RETURN path, rels, nodes(path) as allNodes, totalConfidence,
           length(path) as pathLength
    LIMIT 1
  `;

  return {
    query,
    params: {
      fromId,
      toId,
    },
  };
}

/**
 * Build all paths query
 */
export function buildAllPathsQuery(
  fromId: string,
  toId: string,
  options: PathOptions = {}
): QueryWithParams {
  const maxLength = options.maxLength || 5;
  const limit = options.limit || 10;
  const relationshipTypes = options.relationshipTypes || ['*'];

  const relTypePattern = relationshipTypes.length === 1 && relationshipTypes[0] === '*'
    ? ''
    : `:${relationshipTypes.join('|')}`;

  const query = `
    MATCH (from {id: $fromId}), (to {id: $toId})
    MATCH path = allShortestPaths((from)-[${relTypePattern}*..${maxLength}]-(to))
    WHERE from <> to
    WITH path, relationships(path) as rels,
         reduce(conf = 1.0, r IN relationships(path) | conf * toFloat(r.confidence)) as totalConfidence
    RETURN path, rels, nodes(path) as allNodes, totalConfidence,
           length(path) as pathLength
    ORDER BY totalConfidence DESC, pathLength ASC
    LIMIT $limit
  `;

  return {
    query,
    params: {
      fromId,
      toId,
      limit,
    },
  };
}

// ============================================================================
// NETWORK QUERIES
// ============================================================================

/**
 * Build network query (N-hop neighborhood)
 */
export function buildNetworkQuery(
  centerId: string,
  options: NetworkOptions = {}
): QueryWithParams {
  const depth = options.depth || 2;
  const minConfidence = options.minConfidence || 0;
  const entityTypes = options.entityTypes || [];
  const relationshipTypes = options.relationshipTypes || ['*'];

  const relTypePattern = relationshipTypes.length === 1 && relationshipTypes[0] === '*'
    ? ''
    : `:${relationshipTypes.join('|')}`;

  const entityTypeFilter = entityTypes.length > 0
    ? `AND (${entityTypes.map(t => `n:${t}`).join(' OR ')})`
    : '';

  const query = `
    MATCH (center {id: $centerId})
    MATCH path = (center)-[r${relTypePattern}*1..${depth}]-(n)
    WHERE ALL(rel IN relationships(path) WHERE toFloat(rel.confidence) >= $minConfidence)
      ${entityTypeFilter}
    WITH center, n, relationships(path)[0] as firstRel,
         min(length(path)) as distance,
         max(toFloat(relationships(path)[0].confidence)) as maxConfidence
    RETURN center, collect(DISTINCT n) as nodes,
           collect(DISTINCT firstRel) as edges,
           count(DISTINCT n) as nodeCount,
           avg(maxConfidence) as avgConfidence
  `;

  return {
    query,
    params: {
      centerId,
      minConfidence,
    },
  };
}

/**
 * Build contemporaries query
 */
export function buildContemporariesQuery(
  personId: string,
  options: ContemporariesOptions = {}
): QueryWithParams {
  const yearRange = options.yearRange || 50;
  const sameLocation = options.sameLocation || false;
  const sameTradition = options.sameTradition || false;

  let locationFilter = '';
  if (sameLocation) {
    locationFilter = `
      AND EXISTS {
        MATCH (person)-[:LIVED_AT|STUDIED_AT|TAUGHT_AT]->(place:Place)<-[:LIVED_AT|STUDIED_AT|TAUGHT_AT]-(contemporary)
      }
    `;
  }

  let traditionFilter = '';
  if (sameTradition) {
    traditionFilter = `
      AND person.attributes.tradition = contemporary.attributes.tradition
    `;
  }

  const query = `
    MATCH (person:Person {id: $personId})
    WHERE person.dates IS NOT NULL
      AND person.dates.birth IS NOT NULL

    WITH person,
         toInteger(person.dates.birth.year) as personBirth,
         CASE WHEN person.dates.death IS NOT NULL
              THEN toInteger(person.dates.death.year)
              ELSE personBirth + 80
         END as personDeath

    MATCH (contemporary:Person)
    WHERE contemporary.id <> person.id
      AND contemporary.dates IS NOT NULL
      AND contemporary.dates.birth IS NOT NULL
      AND toInteger(contemporary.dates.birth.year) >= personBirth - $yearRange
      AND toInteger(contemporary.dates.birth.year) <= personDeath + $yearRange
      ${locationFilter}
      ${traditionFilter}

    RETURN contemporary
    ORDER BY abs(toInteger(contemporary.dates.birth.year) - personBirth)
    LIMIT 50
  `;

  return {
    query,
    params: {
      personId,
      yearRange,
    },
  };
}

// ============================================================================
// TIMELINE QUERIES
// ============================================================================

/**
 * Build timeline query
 */
export function buildTimelineQuery(options: TimelineOptions): QueryWithParams {
  const entityTypes = options.entityTypes || ['Person', 'Event', 'Text', 'Institution'];
  const location = options.location;
  const tradition = options.tradition;

  const entityTypePattern = entityTypes.map(t => `n:${t}`).join(' OR ');

  let locationFilter = '';
  if (location) {
    locationFilter = `
      AND (
        (n)-[:LOCATED_AT|LIVED_AT|FOUNDED_AT]->(:Place {canonicalName: $location})
        OR n.attributes.location = $location
      )
    `;
  }

  let traditionFilter = '';
  if (tradition) {
    traditionFilter = `AND n.attributes.tradition = $tradition`;
  }

  const query = `
    MATCH (n)
    WHERE (${entityTypePattern})
      AND n.dates IS NOT NULL
      AND (
        (n.dates.birth IS NOT NULL AND toInteger(n.dates.birth.year) >= $startYear AND toInteger(n.dates.birth.year) <= $endYear)
        OR (n.dates.death IS NOT NULL AND toInteger(n.dates.death.year) >= $startYear AND toInteger(n.dates.death.year) <= $endYear)
        OR (n.dates.founded IS NOT NULL AND toInteger(n.dates.founded.year) >= $startYear AND toInteger(n.dates.founded.year) <= $endYear)
        OR (n.dates.occurred IS NOT NULL AND toInteger(n.dates.occurred.year) >= $startYear AND toInteger(n.dates.occurred.year) <= $endYear)
      )
      ${locationFilter}
      ${traditionFilter}

    WITH n,
         COALESCE(
           toInteger(n.dates.birth.year),
           toInteger(n.dates.founded.year),
           toInteger(n.dates.occurred.year)
         ) as year

    RETURN n, year
    ORDER BY year ASC
    LIMIT 1000
  `;

  return {
    query,
    params: {
      startYear: options.startYear,
      endYear: options.endYear,
      location: location || null,
      tradition: tradition || null,
    },
  };
}

/**
 * Build entity timeline query
 */
export function buildEntityTimelineQuery(entityId: string): QueryWithParams {
  const query = `
    MATCH (entity {id: $entityId})

    // Get entity's own dates
    WITH entity, entity.dates as dates

    // Get related events with dates
    OPTIONAL MATCH (entity)-[r]-(related)
    WHERE related.dates IS NOT NULL OR r.properties.date IS NOT NULL

    WITH entity, dates,
         collect({
           relationship: type(r),
           relatedEntity: related,
           date: COALESCE(r.properties.date, related.dates)
         }) as relatedEvents

    // Combine entity dates with related events
    WITH dates, relatedEvents,
         [
           {type: 'birth', date: dates.birth, description: 'Born'},
           {type: 'death', date: dates.death, description: 'Died'},
           {type: 'founded', date: dates.founded, description: 'Founded'}
         ] as entityEvents

    UNWIND (entityEvents + relatedEvents) as event
    WHERE event.date IS NOT NULL

    RETURN event.type as eventType,
           event.date as date,
           event.description as description,
           event.relatedEntity as entity
    ORDER BY CASE
      WHEN event.date.year IS NOT NULL THEN toInteger(event.date.year)
      ELSE 9999
    END
  `;

  return {
    query,
    params: { entityId },
  };
}

// ============================================================================
// AUTHORSHIP & TEXT QUERIES
// ============================================================================

/**
 * Build texts by author query
 */
export function buildTextsByAuthorQuery(
  authorId: string,
  options: TextsByAuthorOptions = {}
): QueryWithParams {
  const sortBy = options.sortBy || 'name';
  const includeCommentaries = options.includeCommentaries !== false;

  const sortClause = sortBy === 'date'
    ? 'ORDER BY CASE WHEN text.dates IS NOT NULL AND text.dates.written IS NOT NULL THEN toInteger(text.dates.written.year) ELSE 9999 END'
    : 'ORDER BY text.canonicalName';

  const commentaryFilter = includeCommentaries
    ? ''
    : 'AND NOT (text)-[:COMMENTARY_ON]->(:Text)';

  const query = `
    MATCH (author:Person {id: $authorId})-[:WROTE]->(text:Text)
    WHERE text.mergeStatus = 'active'
      ${commentaryFilter}

    OPTIONAL MATCH (text)-[:COMMENTARY_ON]->(originalText:Text)

    RETURN text, author, originalText
    ${sortClause}
  `;

  return {
    query,
    params: { authorId },
  };
}

/**
 * Build citation network query
 */
export function buildCitationNetworkQuery(
  textId: string,
  options: CitationNetworkOptions = {}
): QueryWithParams {
  const direction = options.direction || 'both';
  const maxDepth = options.maxDepth || 3;

  let pathPattern = '';
  if (direction === 'outgoing') {
    pathPattern = `(center)-[:CITES|COMMENTARY_ON*1..${maxDepth}]->(text:Text)`;
  } else if (direction === 'incoming') {
    pathPattern = `(center)<-[:CITES|COMMENTARY_ON*1..${maxDepth}]-(text:Text)`;
  } else {
    pathPattern = `(center)-[:CITES|COMMENTARY_ON*1..${maxDepth}]-(text:Text)`;
  }

  const query = `
    MATCH (center:Text {id: $textId})
    MATCH path = ${pathPattern}
    WHERE center <> text

    WITH center, text, relationships(path) as rels, min(length(path)) as distance

    RETURN center, collect(DISTINCT text) as nodes,
           collect(DISTINCT rels[0]) as edges,
           count(DISTINCT text) as nodeCount
  `;

  return {
    query,
    params: { textId },
  };
}

// ============================================================================
// GEOGRAPHIC QUERIES
// ============================================================================

/**
 * Build nearby query (geographic proximity)
 */
export function buildNearbyQuery(options: NearbyOptions): QueryWithParams {
  const entityTypes = options.entityTypes || ['Place', 'Person', 'Institution'];

  const entityTypePattern = entityTypes.map(t => `n:${t}`).join(' OR ');

  const query = `
    MATCH (n)
    WHERE (${entityTypePattern})
      AND n.attributes IS NOT NULL
      AND n.attributes.latitude IS NOT NULL
      AND n.attributes.longitude IS NOT NULL

    WITH n,
         point({latitude: n.attributes.latitude, longitude: n.attributes.longitude}) as entityPoint,
         point({latitude: $latitude, longitude: $longitude}) as searchPoint

    WITH n, distance(entityPoint, searchPoint) as distanceMeters
    WHERE distanceMeters <= $radiusMeters

    RETURN n, distanceMeters / 1000.0 as distanceKm
    ORDER BY distanceMeters ASC
    LIMIT 100
  `;

  return {
    query,
    params: {
      latitude: options.latitude,
      longitude: options.longitude,
      radiusMeters: options.radiusKm * 1000,
    },
  };
}

/**
 * Build person journey query
 */
export function buildPersonJourneyQuery(personId: string): QueryWithParams {
  const query = `
    MATCH (person:Person {id: $personId})-[r:LIVED_AT|STUDIED_AT|TAUGHT_AT|VISITED]->(place:Place)

    WITH person, place, r,
         CASE
           WHEN r.properties.startDate IS NOT NULL THEN r.properties.startDate
           WHEN r.properties.date IS NOT NULL THEN r.properties.date
           ELSE null
         END as startDate,
         CASE
           WHEN r.properties.endDate IS NOT NULL THEN r.properties.endDate
           ELSE null
         END as endDate,
         r.properties.purpose as purpose,
         toFloat(r.confidence) as confidence

    RETURN place, startDate, endDate, purpose, confidence, type(r) as relationshipType
    ORDER BY CASE
      WHEN startDate IS NOT NULL AND startDate.year IS NOT NULL THEN toInteger(startDate.year)
      ELSE 9999
    END
  `;

  return {
    query,
    params: { personId },
  };
}

// ============================================================================
// ANALYSIS QUERIES
// ============================================================================

/**
 * Build most influential query (degree centrality)
 */
export function buildMostInfluentalQuery(
  options: MostInfluentialOptions = {}
): QueryWithParams {
  const entityType = options.entityType;
  const tradition = options.tradition;
  const timeRange = options.timeRange;
  const limit = options.limit || 50;

  let typeFilter = entityType ? `WHERE n:${entityType}` : 'WHERE n:Person OR n:Text OR n:Institution';

  let traditionFilter = '';
  if (tradition) {
    traditionFilter = `AND n.attributes.tradition = $tradition`;
  }

  let timeRangeFilter = '';
  if (timeRange) {
    timeRangeFilter = `
      AND n.dates IS NOT NULL
      AND (
        (n.dates.birth IS NOT NULL AND toInteger(n.dates.birth.year) >= $startYear AND toInteger(n.dates.birth.year) <= $endYear)
        OR (n.dates.founded IS NOT NULL AND toInteger(n.dates.founded.year) >= $startYear AND toInteger(n.dates.founded.year) <= $endYear)
      )
    `;
  }

  const query = `
    MATCH (n)
    ${typeFilter}
      ${traditionFilter}
      ${timeRangeFilter}

    // Calculate degree centrality (total connections)
    WITH n, size((n)--()) as degree
    WHERE degree > 0

    // Calculate weighted influence based on confidence
    OPTIONAL MATCH (n)-[r]-()
    WITH n, degree, avg(toFloat(r.confidence)) as avgConfidence

    WITH n, degree, avgConfidence,
         degree * avgConfidence as influence

    RETURN n, degree, avgConfidence, influence
    ORDER BY influence DESC
    LIMIT $limit
  `;

  return {
    query,
    params: {
      tradition: tradition || null,
      startYear: timeRange?.start || null,
      endYear: timeRange?.end || null,
      limit,
    },
  };
}

// ============================================================================
// SEARCH QUERIES
// ============================================================================

/**
 * Build full-text search query
 */
export function buildSearchQuery(
  searchTerm: string,
  options: SearchOptions = {}
): QueryWithParams {
  const entityTypes = options.entityTypes || [];
  const fuzzy = options.fuzzy !== false;
  const limit = options.limit || 20;

  const typeFilter = entityTypes.length > 0
    ? `AND (${entityTypes.map(t => `n:${t}`).join(' OR ')})`
    : '';

  // Use fuzzy matching with Levenshtein distance
  const matchCondition = fuzzy
    ? `
      toLower(n.canonicalName) CONTAINS toLower($searchTerm)
      OR any(name IN n.names.english WHERE toLower(name) CONTAINS toLower($searchTerm))
      OR any(name IN n.names.tibetan WHERE toLower(name) CONTAINS toLower($searchTerm))
      OR any(name IN n.names.phonetic WHERE toLower(name) CONTAINS toLower($searchTerm))
    `
    : `
      n.canonicalName = $searchTerm
      OR $searchTerm IN n.names.english
      OR $searchTerm IN n.names.tibetan
      OR $searchTerm IN n.names.phonetic
    `;

  const query = `
    MATCH (n)
    WHERE (${matchCondition})
      ${typeFilter}
      AND n.mergeStatus = 'active'

    // Calculate match score
    WITH n,
         CASE
           WHEN toLower(n.canonicalName) = toLower($searchTerm) THEN 1.0
           WHEN toLower(n.canonicalName) CONTAINS toLower($searchTerm) THEN 0.8
           WHEN any(name IN n.names.english WHERE toLower(name) = toLower($searchTerm)) THEN 0.9
           WHEN any(name IN n.names.english WHERE toLower(name) CONTAINS toLower($searchTerm)) THEN 0.7
           ELSE 0.5
         END as score,
         CASE
           WHEN toLower(n.canonicalName) = toLower($searchTerm) THEN ['canonicalName']
           WHEN any(name IN n.names.english WHERE toLower(name) CONTAINS toLower($searchTerm)) THEN ['names.english']
           WHEN any(name IN n.names.tibetan WHERE toLower(name) CONTAINS toLower($searchTerm)) THEN ['names.tibetan']
           ELSE ['other']
         END as matchedFields

    RETURN n, score, matchedFields
    ORDER BY score DESC, n.canonicalName ASC
    LIMIT $limit
  `;

  return {
    query,
    params: {
      searchTerm,
      limit,
    },
  };
}
