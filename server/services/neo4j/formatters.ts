/**
 * Response Formatters for Neo4j Query Results
 *
 * Converts Neo4j native data structures into clean, JSON-serializable
 * TypeScript objects for API responses.
 *
 * Phase 4, Task 4.4: Graph Query API
 */

import type {
  Entity,
  Relationship,
  Path,
  Network,
  TimelineItem,
  SearchResult,
  LineageTree,
  LineageNode,
  JourneyStop,
  Text,
} from './GraphQueryService';

// ============================================================================
// Entity & Relationship Formatters
// ============================================================================

/**
 * Format a Neo4j node to Entity
 */
export function formatEntity(node: any): Entity {
  if (!node || !node.properties) {
    throw new Error('Invalid node structure');
  }

  const props = node.properties;

  return {
    id: props.id || node.id,
    type: props.type || 'unknown',
    canonicalName: props.canonicalName || props.canonical_name || 'Unknown',
    names: typeof props.names === 'string' ? JSON.parse(props.names) : (props.names || {}),
    attributes: typeof props.attributes === 'string' ? JSON.parse(props.attributes) : (props.attributes || {}),
    dates: props.dates ? (typeof props.dates === 'string' ? JSON.parse(props.dates) : props.dates) : undefined,
    confidence: parseFloat(props.confidence || '0.5'),
    verified: props.verified === 1 || props.verified === true,
  };
}

/**
 * Format multiple entities
 */
export function formatEntities(nodes: any[]): Entity[] {
  if (!Array.isArray(nodes)) {
    return [];
  }

  return nodes
    .filter(node => node !== null && node !== undefined)
    .map(node => {
      try {
        // Handle case where node is already an entity object
        if (node.properties) {
          return formatEntity(node);
        } else if (node.id && node.canonicalName) {
          // Already formatted
          return node as Entity;
        } else {
          // Try to format anyway
          return formatEntity({ properties: node });
        }
      } catch (error) {
        console.warn('[Formatter] Failed to format entity:', error);
        return null;
      }
    })
    .filter((entity): entity is Entity => entity !== null);
}

/**
 * Format a Neo4j relationship to Relationship
 */
export function formatRelationship(rel: any): Relationship {
  if (!rel || !rel.properties) {
    throw new Error('Invalid relationship structure');
  }

  const props = rel.properties;

  return {
    id: props.id || rel.id,
    subjectId: props.subjectId || props.subject_id || '',
    predicate: rel.type || props.predicate || 'unknown',
    objectId: props.objectId || props.object_id || '',
    properties: typeof props.properties === 'string' ? JSON.parse(props.properties) : (props.properties || {}),
    confidence: parseFloat(props.confidence || '0.5'),
    verified: props.verified === 1 || props.verified === true,
  };
}

/**
 * Format multiple relationships
 */
export function formatRelationships(rels: any[]): Relationship[] {
  if (!Array.isArray(rels)) {
    return [];
  }

  return rels
    .filter(rel => rel !== null && rel !== undefined)
    .map(rel => {
      try {
        if (rel.properties) {
          return formatRelationship(rel);
        } else if (rel.id && rel.predicate) {
          return rel as Relationship;
        } else {
          return formatRelationship({ properties: rel, type: rel.predicate });
        }
      } catch (error) {
        console.warn('[Formatter] Failed to format relationship:', error);
        return null;
      }
    })
    .filter((rel): rel is Relationship => rel !== null);
}

// ============================================================================
// Path Formatters
// ============================================================================

/**
 * Format a Neo4j path result to Path object
 */
export function formatPath(result: any): Path {
  if (!result || !result.path) {
    throw new Error('Invalid path result');
  }

  const path = result.path;
  const nodes = result.allNodes || [];
  const rels = result.rels || [];

  const formattedNodes = formatEntities(nodes);
  const formattedRels = formatRelationships(rels);

  const totalConfidence = result.totalConfidence || formattedRels.reduce(
    (acc, rel) => acc * rel.confidence,
    1.0
  );

  return {
    nodes: formattedNodes,
    relationships: formattedRels,
    length: result.pathLength || result.depth || formattedRels.length,
    totalConfidence: parseFloat(String(totalConfidence)),
  };
}

// ============================================================================
// Lineage Formatters
// ============================================================================

/**
 * Format lineage query results to LineageTree
 */
export function formatLineageTree(results: any[], direction: 'teacher' | 'student'): LineageTree {
  if (!results || results.length === 0) {
    throw new Error('No lineage found');
  }

  const result = results[0];
  const nodes = result.allNodes || [];
  const rels = result.rels || [];

  const formattedNodes = formatEntities(nodes);
  const formattedRels = formatRelationships(rels);

  if (formattedNodes.length === 0) {
    throw new Error('No nodes in lineage');
  }

  // Build lineage path
  const root = direction === 'teacher' ? formattedNodes[0] : formattedNodes[formattedNodes.length - 1];
  const path: LineageNode[] = formattedNodes.map((entity, index) => ({
    entity,
    position: index,
    relationship: formattedRels[index - 1],
    children: [],
  }));

  return {
    root,
    path,
    depth: result.depth || formattedNodes.length - 1,
    totalConfidence: parseFloat(String(result.totalConfidence || 0.5)),
  };
}

// ============================================================================
// Network Formatters
// ============================================================================

/**
 * Format network query results to Network object
 */
export function formatNetwork(results: any[], centerId: string): Network {
  if (!results || results.length === 0) {
    throw new Error('Network query returned no results');
  }

  const result = results[0];

  const centerNode = result.center ? formatEntity(result.center) : { id: centerId } as Entity;
  const nodes = formatEntities(result.nodes || []);
  const edges = formatRelationships(result.edges || []);

  const avgConfidence = result.avgConfidence
    ? parseFloat(String(result.avgConfidence))
    : edges.reduce((acc, edge) => acc + edge.confidence, 0) / (edges.length || 1);

  return {
    centerNode,
    nodes,
    edges,
    statistics: {
      nodeCount: result.nodeCount || nodes.length,
      edgeCount: edges.length,
      avgConfidence,
    },
  };
}

// ============================================================================
// Timeline Formatters
// ============================================================================

/**
 * Format timeline query results to TimelineItem array
 */
export function formatTimeline(results: any[]): TimelineItem[] {
  if (!Array.isArray(results)) {
    return [];
  }

  return results
    .map(result => {
      try {
        const entity = formatEntity(result.n);
        const year = result.year || extractYear(entity.dates);

        return {
          timestamp: year || 0,
          entity,
          event: determineEventType(entity),
        };
      } catch (error) {
        console.warn('[Formatter] Failed to format timeline item:', error);
        return null;
      }
    })
    .filter((item): item is TimelineItem => item !== null)
    .sort((a, b) => a.timestamp - b.timestamp);
}

/**
 * Extract year from date object
 */
function extractYear(dates: any): number | undefined {
  if (!dates) return undefined;

  if (dates.birth?.year) return parseInt(dates.birth.year);
  if (dates.founded?.year) return parseInt(dates.founded.year);
  if (dates.occurred?.year) return parseInt(dates.occurred.year);
  if (dates.written?.year) return parseInt(dates.written.year);

  return undefined;
}

/**
 * Determine event type from entity
 */
function determineEventType(entity: Entity): string {
  if (!entity.dates) return 'unknown';

  if (entity.dates.birth) return 'birth';
  if (entity.dates.founded) return 'founded';
  if (entity.dates.occurred) return 'occurred';
  if (entity.dates.written) return 'written';

  return 'unknown';
}

// ============================================================================
// Text & Authorship Formatters
// ============================================================================

/**
 * Format texts with author information
 */
export function formatTexts(results: any[]): Text[] {
  if (!Array.isArray(results)) {
    return [];
  }

  return results
    .map(result => {
      try {
        const text = formatEntity(result.text);
        const author = result.author ? formatEntity(result.author) : undefined;
        const originalText = result.originalText ? formatEntity(result.originalText) : undefined;

        return {
          entity: text,
          author,
          writtenDate: text.dates?.written,
          commentaries: originalText ? [{ entity: originalText } as Text] : [],
        };
      } catch (error) {
        console.warn('[Formatter] Failed to format text:', error);
        return null;
      }
    })
    .filter((text): text is Text => text !== null);
}

// ============================================================================
// Journey Formatters
// ============================================================================

/**
 * Format person journey query results to JourneyStop array
 */
export function formatJourneyStops(results: any[]): JourneyStop[] {
  if (!Array.isArray(results)) {
    return [];
  }

  return results
    .map(result => {
      try {
        const place = formatEntity(result.place);

        return {
          place,
          startDate: result.startDate,
          endDate: result.endDate,
          purpose: result.purpose || result.relationshipType || 'unknown',
          confidence: parseFloat(String(result.confidence || 0.5)),
        };
      } catch (error) {
        console.warn('[Formatter] Failed to format journey stop:', error);
        return null;
      }
    })
    .filter((stop): stop is JourneyStop => stop !== null);
}

// ============================================================================
// Search Formatters
// ============================================================================

/**
 * Format search query results to SearchResult array
 */
export function formatSearchResults(results: any[]): SearchResult[] {
  if (!Array.isArray(results)) {
    return [];
  }

  return results
    .map(result => {
      try {
        const entity = formatEntity(result.n);
        const score = parseFloat(String(result.score || 0.5));
        const matchedFields = result.matchedFields || [];

        return {
          entity,
          score,
          matchedFields,
        };
      } catch (error) {
        console.warn('[Formatter] Failed to format search result:', error);
        return null;
      }
    })
    .filter((result): result is SearchResult => result !== null)
    .sort((a, b) => b.score - a.score);
}

// ============================================================================
// Analysis Formatters
// ============================================================================

/**
 * Format influential entities query results
 */
export function formatInfluentialEntities(
  results: any[]
): Array<{ entity: Entity; influence: number }> {
  if (!Array.isArray(results)) {
    return [];
  }

  return results
    .map(result => {
      try {
        const entity = formatEntity(result.n);
        const influence = parseFloat(String(result.influence || result.degree || 0));

        return { entity, influence };
      } catch (error) {
        console.warn('[Formatter] Failed to format influential entity:', error);
        return null;
      }
    })
    .filter((item): item is { entity: Entity; influence: number } => item !== null)
    .sort((a, b) => b.influence - a.influence);
}

// ============================================================================
// Utility Formatters
// ============================================================================

/**
 * Clean JSON for API response (remove Neo4j internals)
 */
export function cleanForResponse(data: any): any {
  if (data === null || data === undefined) {
    return data;
  }

  if (Array.isArray(data)) {
    return data.map(item => cleanForResponse(item));
  }

  if (typeof data === 'object') {
    // Remove Neo4j internal properties
    const cleaned: any = {};

    for (const [key, value] of Object.entries(data)) {
      if (key === 'identity' || key === 'labels' || key === 'elementId') {
        continue; // Skip Neo4j internals
      }

      cleaned[key] = cleanForResponse(value);
    }

    return cleaned;
  }

  return data;
}

/**
 * Format error for API response
 */
export function formatError(error: any): { error: string; details?: string } {
  if (error instanceof Error) {
    return {
      error: error.message,
      details: error.stack,
    };
  }

  return {
    error: String(error),
  };
}

/**
 * Format pagination metadata
 */
export function formatPaginationMeta(
  total: number,
  offset: number,
  limit: number
): {
  total: number;
  offset: number;
  limit: number;
  hasMore: boolean;
} {
  return {
    total,
    offset,
    limit,
    hasMore: offset + limit < total,
  };
}
