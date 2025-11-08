/**
 * useLineage Hook
 *
 * Custom hook for fetching and transforming lineage data from the graph API.
 * Transforms API responses into vis-network compatible format.
 */

import { useQuery } from '@tanstack/react-query';
import type { NetworkNode, NetworkEdge } from '../lib/networkConfig';

// ============================================================================
// Types
// ============================================================================

export interface Entity {
  id: string;
  type: string;
  canonical_name: string;
  names: {
    tibetan?: string[];
    english?: string[];
    phonetic?: string[];
    wylie?: string[];
  };
  attributes: {
    tradition?: string[];
    birth_year?: number;
    death_year?: number;
    tibetan_name?: string;
    wylie_name?: string;
    roles?: string[];
    is_important?: boolean;
  };
  confidence: number;
  verified: boolean;
}

export interface Relationship {
  id: string;
  subject_id: string;
  predicate: string;
  object_id: string;
  properties?: any;
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

export interface IncarnationLine {
  entities: Entity[];
  relationships: Relationship[];
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

export type LineageType = 'teacher' | 'student' | 'incarnation';

export interface UseLineageOptions {
  personId: string;
  lineageType: LineageType;
  maxDepth?: number;
  enabled?: boolean;
}

export interface LineageData {
  nodes: NetworkNode[];
  edges: NetworkEdge[];
  rootNode?: NetworkNode;
  entities: Map<string, Entity>;
  relationships: Map<string, Relationship>;
}

// ============================================================================
// API Fetchers
// ============================================================================

/**
 * Fetch lineage data from API
 */
async function fetchLineage(
  personId: string,
  lineageType: 'teacher' | 'student',
  maxDepth?: number
): Promise<LineageTree> {
  const params = new URLSearchParams({
    type: lineageType,
    includeDetails: 'true',
  });

  if (maxDepth !== undefined) {
    params.append('maxDepth', maxDepth.toString());
  }

  const response = await fetch(`/api/graph/lineage/${personId}?${params}`);

  if (!response.ok) {
    throw new Error(`Failed to fetch lineage: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Fetch incarnation line from API
 */
async function fetchIncarnationLine(personId: string): Promise<IncarnationLine> {
  const response = await fetch(`/api/graph/incarnation/${personId}`);

  if (!response.ok) {
    throw new Error(`Failed to fetch incarnation line: ${response.statusText}`);
  }

  return response.json();
}

// ============================================================================
// Data Transformers
// ============================================================================

/**
 * Transform lineage tree into vis-network nodes and edges
 */
function transformLineageTree(tree: LineageTree): LineageData {
  const nodes: NetworkNode[] = [];
  const edges: NetworkEdge[] = [];
  const entities = new Map<string, Entity>();
  const relationships = new Map<string, Relationship>();

  // Add root node
  entities.set(tree.root.id, tree.root);

  // Process lineage path
  function processNode(node: LineageNode, isRoot: boolean = false) {
    const entity = node.entity;
    entities.set(entity.id, entity);

    // Add relationship edge if not root
    if (node.relationship) {
      relationships.set(node.relationship.id, node.relationship);
    }

    // Recursively process children
    if (node.children) {
      node.children.forEach(child => processNode(child, false));
    }
  }

  // Process all nodes in path
  tree.path.forEach(node => processNode(node, false));

  return {
    nodes,
    edges,
    rootNode: undefined,
    entities,
    relationships,
  };
}

/**
 * Transform incarnation line into vis-network nodes and edges
 */
function transformIncarnationLine(line: IncarnationLine): LineageData {
  const entities = new Map<string, Entity>();
  const relationships = new Map<string, Relationship>();

  // Store all entities
  line.entities.forEach(entity => {
    entities.set(entity.id, entity);
  });

  // Store all relationships
  line.relationships.forEach(rel => {
    relationships.set(rel.id, rel);
  });

  return {
    nodes: [],
    edges: [],
    entities,
    relationships,
  };
}

// ============================================================================
// Main Hook
// ============================================================================

/**
 * Hook for fetching and transforming lineage data
 */
export function useLineage(options: UseLineageOptions) {
  const { personId, lineageType, maxDepth, enabled = true } = options;

  const query = useQuery({
    queryKey: ['lineage', personId, lineageType, maxDepth],
    queryFn: async () => {
      if (lineageType === 'incarnation') {
        const data = await fetchIncarnationLine(personId);
        return transformIncarnationLine(data);
      } else {
        const data = await fetchLineage(personId, lineageType, maxDepth);
        return transformLineageTree(data);
      }
    },
    enabled: enabled && !!personId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
  });

  return {
    data: query.data,
    isLoading: query.isLoading,
    error: query.error as Error | null,
    refetch: query.refetch,
  };
}

/**
 * Hook for fetching network data (for network view)
 */
export function useNetwork(centerId: string, depth: number = 2, enabled: boolean = true) {
  const query = useQuery({
    queryKey: ['network', centerId, depth],
    queryFn: async (): Promise<Network> => {
      const response = await fetch(`/api/graph/network/${centerId}?depth=${depth}`);

      if (!response.ok) {
        throw new Error(`Failed to fetch network: ${response.statusText}`);
      }

      return response.json();
    },
    enabled: enabled && !!centerId,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  return {
    data: query.data,
    isLoading: query.isLoading,
    error: query.error as Error | null,
    refetch: query.refetch,
  };
}

/**
 * Hook for expanding a node (fetching its children/parents)
 */
export function useExpandNode(
  nodeId: string,
  lineageType: LineageType,
  maxDepth: number = 3
) {
  return useLineage({
    personId: nodeId,
    lineageType,
    maxDepth,
    enabled: false, // Only fetch when explicitly triggered
  });
}
