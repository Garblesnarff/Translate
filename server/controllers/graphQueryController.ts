/**
 * Graph Query Controller
 *
 * RESTful API endpoints for querying the Tibetan Buddhist knowledge graph.
 * Handles lineage, paths, networks, timelines, authorship, and geographic queries.
 *
 * Phase 4, Task 4.4: Graph Query API
 */

import type { Request, Response } from 'express';
import { getNeo4jClient } from '../lib/neo4jClient';
import { getGraphQueryService } from '../services/neo4j/GraphQueryService';
import { cleanForResponse, formatError } from '../services/neo4j/formatters';

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Handle async controller errors
 */
function asyncHandler(fn: (req: Request, res: Response) => Promise<void>) {
  return (req: Request, res: Response) => {
    Promise.resolve(fn(req, res)).catch((error) => {
      console.error('[GraphQueryController] Error:', error);
      res.status(500).json(formatError(error));
    });
  };
}

/**
 * Get query service instance
 */
function getQueryService() {
  const neo4jClient = getNeo4jClient();
  return getGraphQueryService(neo4jClient);
}

// ============================================================================
// LINEAGE ENDPOINTS
// ============================================================================

/**
 * GET /api/graph/lineage/:personId
 * Get teacher or student lineage
 */
export const getLineage = asyncHandler(async (req: Request, res: Response) => {
  const { personId } = req.params;
  const {
    type = 'teacher',
    maxDepth,
    includeDetails,
    minConfidence,
  } = req.query;

  const service = getQueryService();

  const options = {
    maxDepth: maxDepth ? parseInt(maxDepth as string) : undefined,
    includeDetails: includeDetails === 'true',
    minConfidence: minConfidence ? parseFloat(minConfidence as string) : undefined,
  };

  const lineage = type === 'student'
    ? await service.getStudentLineage(personId, options)
    : await service.getTeacherLineage(personId, options);

  res.json(cleanForResponse(lineage));
});

/**
 * GET /api/graph/incarnation/:personId
 * Get incarnation line
 */
export const getIncarnationLine = asyncHandler(async (req: Request, res: Response) => {
  const { personId } = req.params;

  const service = getQueryService();
  const incarnations = await service.getIncarnationLine(personId);

  res.json(cleanForResponse(incarnations));
});

// ============================================================================
// PATH ENDPOINTS
// ============================================================================

/**
 * GET /api/graph/path
 * Find shortest path between two entities
 */
export const getShortestPath = asyncHandler(async (req: Request, res: Response) => {
  const { from, to, maxLength, relationshipTypes } = req.query;

  if (!from || !to) {
    res.status(400).json({ error: 'Missing required parameters: from, to' });
    return;
  }

  const service = getQueryService();

  const options = {
    maxLength: maxLength ? parseInt(maxLength as string) : undefined,
    relationshipTypes: relationshipTypes
      ? (relationshipTypes as string).split(',')
      : undefined,
  };

  const path = await service.findShortestPath(from as string, to as string, options);

  if (!path) {
    res.status(404).json({ error: 'No path found between entities' });
    return;
  }

  res.json(cleanForResponse(path));
});

/**
 * GET /api/graph/paths/all
 * Find all paths between two entities
 */
export const getAllPaths = asyncHandler(async (req: Request, res: Response) => {
  const { from, to, maxLength, limit } = req.query;

  if (!from || !to) {
    res.status(400).json({ error: 'Missing required parameters: from, to' });
    return;
  }

  const service = getQueryService();

  const options = {
    maxLength: maxLength ? parseInt(maxLength as string) : undefined,
    limit: limit ? parseInt(limit as string) : undefined,
  };

  const paths = await service.findAllPaths(from as string, to as string, options);

  res.json(cleanForResponse(paths));
});

// ============================================================================
// NETWORK ENDPOINTS
// ============================================================================

/**
 * GET /api/graph/network/:centerId
 * Get entity's network
 */
export const getNetwork = asyncHandler(async (req: Request, res: Response) => {
  const { centerId } = req.params;
  const { depth, relationshipTypes, entityTypes, minConfidence } = req.query;

  const service = getQueryService();

  const options = {
    depth: depth ? parseInt(depth as string) : undefined,
    relationshipTypes: relationshipTypes
      ? (relationshipTypes as string).split(',')
      : undefined,
    entityTypes: entityTypes ? (entityTypes as string).split(',') : undefined,
    minConfidence: minConfidence ? parseFloat(minConfidence as string) : undefined,
  };

  const network = await service.getNetwork(centerId, options);

  res.json(cleanForResponse(network));
});

/**
 * GET /api/graph/contemporaries/:personId
 * Find contemporaries
 */
export const getContemporaries = asyncHandler(async (req: Request, res: Response) => {
  const { personId } = req.params;
  const { yearRange, sameLocation, sameTradition } = req.query;

  const service = getQueryService();

  const options = {
    yearRange: yearRange ? parseInt(yearRange as string) : undefined,
    sameLocation: sameLocation === 'true',
    sameTradition: sameTradition === 'true',
  };

  const contemporaries = await service.getContemporaries(personId, options);

  res.json(cleanForResponse(contemporaries));
});

// ============================================================================
// TIMELINE ENDPOINTS
// ============================================================================

/**
 * GET /api/graph/timeline
 * Get timeline for a time range
 */
export const getTimeline = asyncHandler(async (req: Request, res: Response) => {
  const { start, end, entityTypes, location, tradition } = req.query;

  if (!start || !end) {
    res.status(400).json({ error: 'Missing required parameters: start, end' });
    return;
  }

  const service = getQueryService();

  const options = {
    startYear: parseInt(start as string),
    endYear: parseInt(end as string),
    entityTypes: entityTypes ? (entityTypes as string).split(',') : undefined,
    location: location as string | undefined,
    tradition: tradition as string | undefined,
  };

  const timeline = await service.getTimeline(options);

  res.json(cleanForResponse(timeline));
});

/**
 * GET /api/graph/entity/:entityId/timeline
 * Get entity's timeline
 */
export const getEntityTimeline = asyncHandler(async (req: Request, res: Response) => {
  const { entityId } = req.params;

  const service = getQueryService();
  const timeline = await service.getEntityTimeline(entityId);

  res.json(cleanForResponse(timeline));
});

// ============================================================================
// AUTHORSHIP ENDPOINTS
// ============================================================================

/**
 * GET /api/graph/author/:authorId/texts
 * Get texts by author
 */
export const getTextsByAuthor = asyncHandler(async (req: Request, res: Response) => {
  const { authorId } = req.params;
  const { sortBy, includeCommentaries } = req.query;

  const service = getQueryService();

  const options = {
    sortBy: (sortBy as 'date' | 'name') || undefined,
    includeCommentaries: includeCommentaries !== 'false',
  };

  const texts = await service.getTextsByAuthor(authorId, options);

  res.json(cleanForResponse(texts));
});

/**
 * GET /api/graph/text/:textId/citations
 * Get citation network
 */
export const getCitationNetwork = asyncHandler(async (req: Request, res: Response) => {
  const { textId } = req.params;
  const { direction, maxDepth } = req.query;

  const service = getQueryService();

  const options = {
    direction: (direction as 'outgoing' | 'incoming' | 'both') || undefined,
    maxDepth: maxDepth ? parseInt(maxDepth as string) : undefined,
  };

  const network = await service.getCitationNetwork(textId, options);

  res.json(cleanForResponse(network));
});

// ============================================================================
// GEOGRAPHIC ENDPOINTS
// ============================================================================

/**
 * GET /api/graph/nearby
 * Find nearby entities
 */
export const getNearby = asyncHandler(async (req: Request, res: Response) => {
  const { lat, lon, radius, entityTypes } = req.query;

  if (!lat || !lon || !radius) {
    res.status(400).json({ error: 'Missing required parameters: lat, lon, radius' });
    return;
  }

  const service = getQueryService();

  const options = {
    latitude: parseFloat(lat as string),
    longitude: parseFloat(lon as string),
    radiusKm: parseFloat(radius as string),
    entityTypes: entityTypes ? (entityTypes as string).split(',') : undefined,
  };

  const entities = await service.findNearby(options);

  res.json(cleanForResponse(entities));
});

/**
 * GET /api/graph/person/:personId/journey
 * Get person's journey
 */
export const getPersonJourney = asyncHandler(async (req: Request, res: Response) => {
  const { personId } = req.params;

  const service = getQueryService();
  const journey = await service.getPersonJourney(personId);

  res.json(cleanForResponse(journey));
});

// ============================================================================
// ANALYSIS ENDPOINTS
// ============================================================================

/**
 * GET /api/graph/influential
 * Get most influential entities
 */
export const getMostInfluential = asyncHandler(async (req: Request, res: Response) => {
  const { entityType, tradition, startYear, endYear, limit } = req.query;

  const service = getQueryService();

  const options = {
    entityType: entityType as string | undefined,
    tradition: tradition as string | undefined,
    timeRange:
      startYear && endYear
        ? { start: parseInt(startYear as string), end: parseInt(endYear as string) }
        : undefined,
    limit: limit ? parseInt(limit as string) : undefined,
  };

  const influential = await service.getMostInfluential(options);

  res.json(cleanForResponse(influential));
});

/**
 * GET /api/graph/communities
 * Detect communities
 */
export const detectCommunities = asyncHandler(async (req: Request, res: Response) => {
  const { algorithm, relationshipTypes } = req.query;

  const service = getQueryService();

  const options = {
    algorithm: (algorithm as 'louvain' | 'label_propagation') || undefined,
    relationshipTypes: relationshipTypes
      ? (relationshipTypes as string).split(',')
      : undefined,
  };

  const communities = await service.detectCommunities(options);

  res.json(cleanForResponse(communities));
});

/**
 * GET /api/graph/suggest-relationships/:entityId
 * Suggest potential relationships
 */
export const suggestRelationships = asyncHandler(async (req: Request, res: Response) => {
  const { entityId } = req.params;
  const { relationshipType, minSimilarity } = req.query;

  const service = getQueryService();

  const options = {
    relationshipType: relationshipType as string | undefined,
    minSimilarity: minSimilarity ? parseFloat(minSimilarity as string) : undefined,
  };

  const suggestions = await service.suggestRelationships(entityId, options);

  res.json(cleanForResponse(suggestions));
});

// ============================================================================
// SEARCH ENDPOINTS
// ============================================================================

/**
 * GET /api/graph/search
 * Full-text search
 */
export const searchEntities = asyncHandler(async (req: Request, res: Response) => {
  const { q, entityTypes, fuzzy, limit } = req.query;

  if (!q) {
    res.status(400).json({ error: 'Missing required parameter: q' });
    return;
  }

  const service = getQueryService();

  const options = {
    entityTypes: entityTypes ? (entityTypes as string).split(',') : undefined,
    fuzzy: fuzzy !== 'false',
    limit: limit ? parseInt(limit as string) : undefined,
  };

  const results = await service.search(q as string, options);

  res.json(cleanForResponse(results));
});

/**
 * POST /api/graph/query
 * Custom Cypher query
 */
export const customQuery = asyncHandler(async (req: Request, res: Response) => {
  const { query, params } = req.body;

  if (!query) {
    res.status(400).json({ error: 'Missing required field: query' });
    return;
  }

  // Security: Only allow read queries (MATCH, RETURN, WITH, etc.)
  const normalizedQuery = query.trim().toUpperCase();
  const writeKeywords = ['CREATE', 'DELETE', 'SET', 'REMOVE', 'MERGE', 'DETACH'];

  for (const keyword of writeKeywords) {
    if (normalizedQuery.includes(keyword)) {
      res.status(403).json({
        error: `Write operation not allowed: ${keyword}. Only read queries are permitted.`,
      });
      return;
    }
  }

  const service = getQueryService();
  const results = await service.customQuery(query, params || {});

  res.json(cleanForResponse(results));
});

// ============================================================================
// METRICS ENDPOINTS
// ============================================================================

/**
 * GET /api/graph/metrics
 * Get query performance metrics
 */
export const getQueryMetrics = asyncHandler(async (req: Request, res: Response) => {
  const { queryType } = req.query;

  const service = getQueryService();
  const metrics = service.getMetrics(queryType as string | undefined);

  res.json(metrics);
});

/**
 * GET /api/graph/slow-queries
 * Get slow queries
 */
export const getSlowQueries = asyncHandler(async (req: Request, res: Response) => {
  const { threshold } = req.query;

  const service = getQueryService();
  const slowQueries = service.getSlowQueries(
    threshold ? parseInt(threshold as string) : undefined
  );

  res.json(slowQueries);
});

/**
 * POST /api/graph/cache/clear
 * Clear query cache
 */
export const clearCache = asyncHandler(async (req: Request, res: Response) => {
  const { pattern } = req.body;

  const service = getQueryService();
  service.clearCache(pattern);

  res.json({ message: 'Cache cleared successfully', pattern: pattern || 'all' });
});
