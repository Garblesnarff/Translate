/**
 * Graph Query Service
 *
 * Comprehensive query service for traversing and analyzing the Tibetan Buddhist
 * knowledge graph. Provides methods for lineage tracing, path finding, network
 * analysis, timeline queries, authorship tracking, and geographic search.
 *
 * Phase 4, Task 4.4: Graph Query API
 */

import type { Neo4jClient } from '../../lib/neo4jClient';
import {
  buildLineageQuery,
  buildPathQuery,
  buildAllPathsQuery,
  buildNetworkQuery,
  buildContemporariesQuery,
  buildTimelineQuery,
  buildEntityTimelineQuery,
  buildTextsByAuthorQuery,
  buildCitationNetworkQuery,
  buildNearbyQuery,
  buildPersonJourneyQuery,
  buildMostInfluentalQuery,
  buildSearchQuery,
  buildIncarnationLineQuery,
} from './queryBuilders';
import {
  formatPath,
  formatNetwork,
  formatTimeline,
  formatSearchResults,
  formatLineageTree,
  formatJourneyStops,
  formatInfluentialEntities,
  formatEntities,
  formatTexts,
} from './formatters';
import { QueryCache } from './queryCache';
import { QueryMetrics } from './queryMetrics';

// ============================================================================
// Types
// ============================================================================

export interface Entity {
  id: string;
  type: string;
  canonicalName: string;
  names: any;
  attributes: any;
  dates?: any;
  confidence: number;
  verified: boolean;
}

export interface Relationship {
  id: string;
  subjectId: string;
  predicate: string;
  objectId: string;
  properties: any;
  confidence: number;
  verified: boolean;
}

export interface LineageNode {
  entity: Entity;
  position: number;
  relationship?: Relationship;
  children?: LineageNode[];
}

export interface LineageTree {
  root: Entity;
  path: LineageNode[];
  depth: number;
  totalConfidence: number;
}

export interface Path {
  nodes: Entity[];
  relationships: Relationship[];
  length: number;
  totalConfidence: number;
}

export interface Network {
  centerNode: Entity;
  nodes: Entity[];
  edges: Relationship[];
  statistics: {
    nodeCount: number;
    edgeCount: number;
    avgConfidence: number;
  };
}

export interface TimelineItem {
  timestamp: number; // year
  entity: Entity;
  event?: string;
  relationships?: Relationship[];
}

export interface TimelineEvent {
  date: any;
  type: string;
  description: string;
  relatedEntities: Entity[];
}

export interface JourneyStop {
  place: Entity;
  startDate?: any;
  endDate?: any;
  purpose?: string;
  confidence: number;
}

export interface Text {
  entity: Entity;
  author?: Entity;
  writtenDate?: any;
  commentaries?: Text[];
}

export interface SearchResult {
  entity: Entity;
  score: number;
  matchedFields: string[];
}

export interface SuggestedRelationship {
  fromEntity: Entity;
  toEntity: Entity;
  suggestedPredicate: string;
  confidence: number;
  reasoning: string;
}

export interface Community {
  id: number;
  members: Entity[];
  size: number;
  cohesion: number;
}

// Query Options

export interface LineageOptions {
  maxDepth?: number;
  includeDetails?: boolean;
  minConfidence?: number;
}

export interface PathOptions {
  relationshipTypes?: string[];
  maxLength?: number;
  limit?: number;
}

export interface NetworkOptions {
  depth?: number;
  relationshipTypes?: string[];
  entityTypes?: string[];
  minConfidence?: number;
}

export interface ContemporariesOptions {
  yearRange?: number;
  sameLocation?: boolean;
  sameTradition?: boolean;
}

export interface TimelineOptions {
  startYear: number;
  endYear: number;
  entityTypes?: string[];
  location?: string;
  tradition?: string;
}

export interface TextsByAuthorOptions {
  sortBy?: 'date' | 'name';
  includeCommentaries?: boolean;
}

export interface CitationNetworkOptions {
  direction?: 'outgoing' | 'incoming' | 'both';
  maxDepth?: number;
}

export interface NearbyOptions {
  latitude: number;
  longitude: number;
  radiusKm: number;
  entityTypes?: string[];
}

export interface MostInfluentialOptions {
  entityType?: string;
  tradition?: string;
  timeRange?: { start: number; end: number };
  limit?: number;
}

export interface CommunityOptions {
  algorithm?: 'louvain' | 'label_propagation';
  relationshipTypes?: string[];
}

export interface SearchOptions {
  entityTypes?: string[];
  fuzzy?: boolean;
  limit?: number;
}

export interface SuggestRelationshipsOptions {
  relationshipType?: string;
  minSimilarity?: number;
}

// ============================================================================
// GraphQueryService Class
// ============================================================================

export class GraphQueryService {
  private neo4jClient: Neo4jClient;
  private cache: QueryCache;
  private metrics: QueryMetrics;

  constructor(neo4jClient: Neo4jClient) {
    this.neo4jClient = neo4jClient;
    this.cache = new QueryCache();
    this.metrics = new QueryMetrics();
  }

  // ==========================================================================
  // LINEAGE QUERIES
  // ==========================================================================

  /**
   * Get complete teacher lineage from root to person
   */
  async getTeacherLineage(
    personId: string,
    options: LineageOptions = {}
  ): Promise<LineageTree> {
    const startTime = Date.now();
    const cacheKey = this.cache.generateKey('teacher-lineage', { personId, options });

    // Check cache
    const cached = await this.cache.get<LineageTree>(cacheKey);
    if (cached) {
      this.metrics.recordQuery('teacher-lineage', Date.now() - startTime, 0, true);
      return cached;
    }

    try {
      const { query, params } = buildLineageQuery('teacher', personId, options);
      const results = await this.neo4jClient.executeRead(query, params);

      const lineageTree = formatLineageTree(results, 'teacher');

      // Cache for 1 hour
      await this.cache.set(cacheKey, lineageTree, 3600);

      this.metrics.recordQuery('teacher-lineage', Date.now() - startTime, results.length, false);

      return lineageTree;
    } catch (error) {
      this.metrics.recordQuery('teacher-lineage', Date.now() - startTime, 0, false, error);
      throw error;
    }
  }

  /**
   * Get all students (direct and indirect)
   */
  async getStudentLineage(
    personId: string,
    options: LineageOptions = {}
  ): Promise<LineageTree> {
    const startTime = Date.now();
    const cacheKey = this.cache.generateKey('student-lineage', { personId, options });

    const cached = await this.cache.get<LineageTree>(cacheKey);
    if (cached) {
      this.metrics.recordQuery('student-lineage', Date.now() - startTime, 0, true);
      return cached;
    }

    try {
      const { query, params } = buildLineageQuery('student', personId, options);
      const results = await this.neo4jClient.executeRead(query, params);

      const lineageTree = formatLineageTree(results, 'student');

      await this.cache.set(cacheKey, lineageTree, 3600);

      this.metrics.recordQuery('student-lineage', Date.now() - startTime, results.length, false);

      return lineageTree;
    } catch (error) {
      this.metrics.recordQuery('student-lineage', Date.now() - startTime, 0, false, error);
      throw error;
    }
  }

  /**
   * Get incarnation line (e.g., Dalai Lama chain)
   */
  async getIncarnationLine(personId: string): Promise<Entity[]> {
    const startTime = Date.now();
    const cacheKey = this.cache.generateKey('incarnation-line', { personId });

    const cached = await this.cache.get<Entity[]>(cacheKey);
    if (cached) {
      this.metrics.recordQuery('incarnation-line', Date.now() - startTime, 0, true);
      return cached;
    }

    try {
      const { query, params } = buildIncarnationLineQuery(personId);
      const results = await this.neo4jClient.executeRead(query, params);

      const incarnations = formatEntities(results);

      await this.cache.set(cacheKey, incarnations, 7200); // 2 hours

      this.metrics.recordQuery('incarnation-line', Date.now() - startTime, results.length, false);

      return incarnations;
    } catch (error) {
      this.metrics.recordQuery('incarnation-line', Date.now() - startTime, 0, false, error);
      throw error;
    }
  }

  // ==========================================================================
  // PATH QUERIES
  // ==========================================================================

  /**
   * Find shortest path between two entities
   */
  async findShortestPath(
    fromId: string,
    toId: string,
    options: PathOptions = {}
  ): Promise<Path | null> {
    const startTime = Date.now();
    const cacheKey = this.cache.generateKey('shortest-path', { fromId, toId, options });

    const cached = await this.cache.get<Path | null>(cacheKey);
    if (cached) {
      this.metrics.recordQuery('shortest-path', Date.now() - startTime, 0, true);
      return cached;
    }

    try {
      const { query, params } = buildPathQuery(fromId, toId, options);
      const results = await this.neo4jClient.executeRead(query, params);

      if (results.length === 0) {
        await this.cache.set(cacheKey, null, 1800); // 30 minutes
        this.metrics.recordQuery('shortest-path', Date.now() - startTime, 0, false);
        return null;
      }

      const path = formatPath(results[0]);

      await this.cache.set(cacheKey, path, 1800);

      this.metrics.recordQuery('shortest-path', Date.now() - startTime, results.length, false);

      return path;
    } catch (error) {
      this.metrics.recordQuery('shortest-path', Date.now() - startTime, 0, false, error);
      throw error;
    }
  }

  /**
   * Find all paths between two entities
   */
  async findAllPaths(
    fromId: string,
    toId: string,
    options: PathOptions = {}
  ): Promise<Path[]> {
    const startTime = Date.now();
    const cacheKey = this.cache.generateKey('all-paths', { fromId, toId, options });

    const cached = await this.cache.get<Path[]>(cacheKey);
    if (cached) {
      this.metrics.recordQuery('all-paths', Date.now() - startTime, 0, true);
      return cached;
    }

    try {
      const { query, params } = buildAllPathsQuery(fromId, toId, options);
      const results = await this.neo4jClient.executeRead(query, params);

      const paths = results.map(result => formatPath(result));

      await this.cache.set(cacheKey, paths, 1800);

      this.metrics.recordQuery('all-paths', Date.now() - startTime, results.length, false);

      return paths;
    } catch (error) {
      this.metrics.recordQuery('all-paths', Date.now() - startTime, 0, false, error);
      throw error;
    }
  }

  // ==========================================================================
  // NETWORK QUERIES
  // ==========================================================================

  /**
   * Get entity's immediate network (1-2 hops)
   */
  async getNetwork(
    centerId: string,
    options: NetworkOptions = {}
  ): Promise<Network> {
    const startTime = Date.now();
    const cacheKey = this.cache.generateKey('network', { centerId, options });

    const cached = await this.cache.get<Network>(cacheKey);
    if (cached) {
      this.metrics.recordQuery('network', Date.now() - startTime, 0, true);
      return cached;
    }

    try {
      const { query, params } = buildNetworkQuery(centerId, options);
      const results = await this.neo4jClient.executeRead(query, params);

      const network = formatNetwork(results, centerId);

      await this.cache.set(cacheKey, network, 1800);

      this.metrics.recordQuery('network', Date.now() - startTime, results.length, false);

      return network;
    } catch (error) {
      this.metrics.recordQuery('network', Date.now() - startTime, 0, false, error);
      throw error;
    }
  }

  /**
   * Find contemporaries (people alive at same time)
   */
  async getContemporaries(
    personId: string,
    options: ContemporariesOptions = {}
  ): Promise<Entity[]> {
    const startTime = Date.now();
    const cacheKey = this.cache.generateKey('contemporaries', { personId, options });

    const cached = await this.cache.get<Entity[]>(cacheKey);
    if (cached) {
      this.metrics.recordQuery('contemporaries', Date.now() - startTime, 0, true);
      return cached;
    }

    try {
      const { query, params } = buildContemporariesQuery(personId, options);
      const results = await this.neo4jClient.executeRead(query, params);

      const contemporaries = formatEntities(results);

      await this.cache.set(cacheKey, contemporaries, 3600);

      this.metrics.recordQuery('contemporaries', Date.now() - startTime, results.length, false);

      return contemporaries;
    } catch (error) {
      this.metrics.recordQuery('contemporaries', Date.now() - startTime, 0, false, error);
      throw error;
    }
  }

  // ==========================================================================
  // TIMELINE QUERIES
  // ==========================================================================

  /**
   * Get all events/people in a time range
   */
  async getTimeline(options: TimelineOptions): Promise<TimelineItem[]> {
    const startTime = Date.now();
    const cacheKey = this.cache.generateKey('timeline', options);

    const cached = await this.cache.get<TimelineItem[]>(cacheKey);
    if (cached) {
      this.metrics.recordQuery('timeline', Date.now() - startTime, 0, true);
      return cached;
    }

    try {
      const { query, params } = buildTimelineQuery(options);
      const results = await this.neo4jClient.executeRead(query, params);

      const timeline = formatTimeline(results);

      await this.cache.set(cacheKey, timeline, 3600);

      this.metrics.recordQuery('timeline', Date.now() - startTime, results.length, false);

      return timeline;
    } catch (error) {
      this.metrics.recordQuery('timeline', Date.now() - startTime, 0, false, error);
      throw error;
    }
  }

  /**
   * Get chronological order of events related to entity
   */
  async getEntityTimeline(entityId: string): Promise<TimelineEvent[]> {
    const startTime = Date.now();
    const cacheKey = this.cache.generateKey('entity-timeline', { entityId });

    const cached = await this.cache.get<TimelineEvent[]>(cacheKey);
    if (cached) {
      this.metrics.recordQuery('entity-timeline', Date.now() - startTime, 0, true);
      return cached;
    }

    try {
      const { query, params } = buildEntityTimelineQuery(entityId);
      const results = await this.neo4jClient.executeRead(query, params);

      // Format results as timeline events
      const events: TimelineEvent[] = results.map((r: any) => ({
        date: r.date,
        type: r.eventType || 'unknown',
        description: r.description || '',
        relatedEntities: r.entities ? formatEntities(r.entities) : []
      }));

      await this.cache.set(cacheKey, events, 3600);

      this.metrics.recordQuery('entity-timeline', Date.now() - startTime, results.length, false);

      return events;
    } catch (error) {
      this.metrics.recordQuery('entity-timeline', Date.now() - startTime, 0, false, error);
      throw error;
    }
  }

  // ==========================================================================
  // AUTHORSHIP & TEXT QUERIES
  // ==========================================================================

  /**
   * Get all texts by author
   */
  async getTextsByAuthor(
    authorId: string,
    options: TextsByAuthorOptions = {}
  ): Promise<Text[]> {
    const startTime = Date.now();
    const cacheKey = this.cache.generateKey('texts-by-author', { authorId, options });

    const cached = await this.cache.get<Text[]>(cacheKey);
    if (cached) {
      this.metrics.recordQuery('texts-by-author', Date.now() - startTime, 0, true);
      return cached;
    }

    try {
      const { query, params } = buildTextsByAuthorQuery(authorId, options);
      const results = await this.neo4jClient.executeRead(query, params);

      const texts = formatTexts(results);

      await this.cache.set(cacheKey, texts, 3600);

      this.metrics.recordQuery('texts-by-author', Date.now() - startTime, results.length, false);

      return texts;
    } catch (error) {
      this.metrics.recordQuery('texts-by-author', Date.now() - startTime, 0, false, error);
      throw error;
    }
  }

  /**
   * Get citation network (text A cites B, B cites C...)
   */
  async getCitationNetwork(
    textId: string,
    options: CitationNetworkOptions = {}
  ): Promise<Network> {
    const startTime = Date.now();
    const cacheKey = this.cache.generateKey('citation-network', { textId, options });

    const cached = await this.cache.get<Network>(cacheKey);
    if (cached) {
      this.metrics.recordQuery('citation-network', Date.now() - startTime, 0, true);
      return cached;
    }

    try {
      const { query, params } = buildCitationNetworkQuery(textId, options);
      const results = await this.neo4jClient.executeRead(query, params);

      const network = formatNetwork(results, textId);

      await this.cache.set(cacheKey, network, 3600);

      this.metrics.recordQuery('citation-network', Date.now() - startTime, results.length, false);

      return network;
    } catch (error) {
      this.metrics.recordQuery('citation-network', Date.now() - startTime, 0, false, error);
      throw error;
    }
  }

  // ==========================================================================
  // GEOGRAPHIC QUERIES
  // ==========================================================================

  /**
   * Find entities near a location
   */
  async findNearby(options: NearbyOptions): Promise<Entity[]> {
    const startTime = Date.now();
    const cacheKey = this.cache.generateKey('nearby', options);

    const cached = await this.cache.get<Entity[]>(cacheKey);
    if (cached) {
      this.metrics.recordQuery('nearby', Date.now() - startTime, 0, true);
      return cached;
    }

    try {
      const { query, params } = buildNearbyQuery(options);
      const results = await this.neo4jClient.executeRead(query, params);

      const entities = formatEntities(results);

      await this.cache.set(cacheKey, entities, 1800);

      this.metrics.recordQuery('nearby', Date.now() - startTime, results.length, false);

      return entities;
    } catch (error) {
      this.metrics.recordQuery('nearby', Date.now() - startTime, 0, false, error);
      throw error;
    }
  }

  /**
   * Get all places a person lived/visited
   */
  async getPersonJourney(personId: string): Promise<JourneyStop[]> {
    const startTime = Date.now();
    const cacheKey = this.cache.generateKey('person-journey', { personId });

    const cached = await this.cache.get<JourneyStop[]>(cacheKey);
    if (cached) {
      this.metrics.recordQuery('person-journey', Date.now() - startTime, 0, true);
      return cached;
    }

    try {
      const { query, params } = buildPersonJourneyQuery(personId);
      const results = await this.neo4jClient.executeRead(query, params);

      const journey = formatJourneyStops(results);

      await this.cache.set(cacheKey, journey, 3600);

      this.metrics.recordQuery('person-journey', Date.now() - startTime, results.length, false);

      return journey;
    } catch (error) {
      this.metrics.recordQuery('person-journey', Date.now() - startTime, 0, false, error);
      throw error;
    }
  }

  // ==========================================================================
  // ANALYSIS QUERIES
  // ==========================================================================

  /**
   * Find most influential entities (by degree centrality)
   */
  async getMostInfluential(
    options: MostInfluentialOptions = {}
  ): Promise<Array<{ entity: Entity; influence: number }>> {
    const startTime = Date.now();
    const cacheKey = this.cache.generateKey('most-influential', options);

    const cached = await this.cache.get<Array<{ entity: Entity; influence: number }>>(cacheKey);
    if (cached) {
      this.metrics.recordQuery('most-influential', Date.now() - startTime, 0, true);
      return cached;
    }

    try {
      const { query, params } = buildMostInfluentalQuery(options);
      const results = await this.neo4jClient.executeRead(query, params);

      const influential = formatInfluentialEntities(results);

      await this.cache.set(cacheKey, influential, 7200); // 2 hours

      this.metrics.recordQuery('most-influential', Date.now() - startTime, results.length, false);

      return influential;
    } catch (error) {
      this.metrics.recordQuery('most-influential', Date.now() - startTime, 0, false, error);
      throw error;
    }
  }

  /**
   * Detect communities/clusters in the graph
   */
  async detectCommunities(options: CommunityOptions = {}): Promise<Community[]> {
    const startTime = Date.now();
    const cacheKey = this.cache.generateKey('detect-communities', options);

    const cached = await this.cache.get<Community[]>(cacheKey);
    if (cached) {
      this.metrics.recordQuery('detect-communities', Date.now() - startTime, 0, true);
      return cached;
    }

    try {
      const algorithm = options.algorithm || 'louvain';
      const relationshipTypes = options.relationshipTypes || ['*'];

      // Use Graph Data Science library for community detection
      const query = `
        CALL gds.${algorithm}.stream({
          nodeProjection: '*',
          relationshipProjection: ${relationshipTypes.length === 1 && relationshipTypes[0] === '*' ? "'*'" : JSON.stringify(relationshipTypes)},
          includeIntermediateCommunities: false
        })
        YIELD nodeId, communityId
        MATCH (n) WHERE id(n) = nodeId
        RETURN communityId, collect(n) as members, count(n) as size
        ORDER BY size DESC
      `;

      const results = await this.neo4jClient.executeRead(query, {});

      const communities: Community[] = results.map((r: any, index: number) => ({
        id: r.communityId || index,
        members: formatEntities(r.members || []),
        size: r.size || 0,
        cohesion: 0.8 // Calculate actual cohesion if needed
      }));

      await this.cache.set(cacheKey, communities, 7200); // 2 hours

      this.metrics.recordQuery('detect-communities', Date.now() - startTime, results.length, false);

      return communities;
    } catch (error) {
      // GDS might not be available, return empty array
      console.warn('[GraphQueryService] Community detection failed (GDS may not be installed):', error);
      this.metrics.recordQuery('detect-communities', Date.now() - startTime, 0, false, error);
      return [];
    }
  }

  /**
   * Find potential missing links (relationship prediction)
   */
  async suggestRelationships(
    entityId: string,
    options: SuggestRelationshipsOptions = {}
  ): Promise<SuggestedRelationship[]> {
    const startTime = Date.now();
    const cacheKey = this.cache.generateKey('suggest-relationships', { entityId, options });

    const cached = await this.cache.get<SuggestedRelationship[]>(cacheKey);
    if (cached) {
      this.metrics.recordQuery('suggest-relationships', Date.now() - startTime, 0, true);
      return cached;
    }

    try {
      const minSimilarity = options.minSimilarity || 0.5;

      // Find potential relationships based on common neighbors
      const query = `
        MATCH (a {id: $entityId})--(common)--(b)
        WHERE a <> b
          AND NOT (a)--(b)
        WITH a, b, count(common) as commonNeighbors
        WHERE commonNeighbors >= 2
        RETURN a, b, commonNeighbors,
               toFloat(commonNeighbors) / (size((a)--()) + size((b)--()) - commonNeighbors) as similarity
        ORDER BY similarity DESC
        LIMIT 10
      `;

      const results = await this.neo4jClient.executeRead(query, { entityId });

      const suggestions: SuggestedRelationship[] = results
        .filter((r: any) => r.similarity >= minSimilarity)
        .map((r: any) => ({
          fromEntity: formatEntities([r.a])[0],
          toEntity: formatEntities([r.b])[0],
          suggestedPredicate: options.relationshipType || 'related_to',
          confidence: r.similarity || 0,
          reasoning: `${r.commonNeighbors} common connections (${Math.round(r.similarity * 100)}% similarity)`
        }));

      await this.cache.set(cacheKey, suggestions, 3600);

      this.metrics.recordQuery('suggest-relationships', Date.now() - startTime, results.length, false);

      return suggestions;
    } catch (error) {
      this.metrics.recordQuery('suggest-relationships', Date.now() - startTime, 0, false, error);
      throw error;
    }
  }

  // ==========================================================================
  // SEARCH QUERIES
  // ==========================================================================

  /**
   * Full-text search across entities
   */
  async search(
    query: string,
    options: SearchOptions = {}
  ): Promise<SearchResult[]> {
    const startTime = Date.now();
    const cacheKey = this.cache.generateKey('search', { query, options });

    const cached = await this.cache.get<SearchResult[]>(cacheKey);
    if (cached) {
      this.metrics.recordQuery('search', Date.now() - startTime, 0, true);
      return cached;
    }

    try {
      const { query: cypherQuery, params } = buildSearchQuery(query, options);
      const results = await this.neo4jClient.executeRead(cypherQuery, params);

      const searchResults = formatSearchResults(results);

      await this.cache.set(cacheKey, searchResults, 600); // 10 minutes

      this.metrics.recordQuery('search', Date.now() - startTime, results.length, false);

      return searchResults;
    } catch (error) {
      this.metrics.recordQuery('search', Date.now() - startTime, 0, false, error);
      throw error;
    }
  }

  /**
   * Advanced pattern matching (custom Cypher)
   */
  async customQuery(cypherQuery: string, params: Record<string, any> = {}): Promise<any> {
    const startTime = Date.now();

    try {
      const results = await this.neo4jClient.executeRead(cypherQuery, params);

      this.metrics.recordQuery('custom-query', Date.now() - startTime, results.length, false);

      return results;
    } catch (error) {
      this.metrics.recordQuery('custom-query', Date.now() - startTime, 0, false, error);
      throw error;
    }
  }

  // ==========================================================================
  // UTILITY METHODS
  // ==========================================================================

  /**
   * Get query metrics
   */
  getMetrics(queryType?: string) {
    return this.metrics.getStats(queryType);
  }

  /**
   * Get slow queries
   */
  getSlowQueries(thresholdMs: number = 1000) {
    return this.metrics.getSlowQueries(thresholdMs);
  }

  /**
   * Clear cache
   */
  clearCache(pattern?: string) {
    if (pattern) {
      this.cache.invalidate(pattern);
    } else {
      this.cache.clear();
    }
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let graphQueryServiceInstance: GraphQueryService | null = null;

/**
 * Get or create GraphQueryService singleton
 */
export function getGraphQueryService(neo4jClient: Neo4jClient): GraphQueryService {
  if (!graphQueryServiceInstance) {
    graphQueryServiceInstance = new GraphQueryService(neo4jClient);
  }

  return graphQueryServiceInstance;
}

/**
 * Reset singleton instance (for testing)
 */
export function resetGraphQueryService(): void {
  graphQueryServiceInstance = null;
}
