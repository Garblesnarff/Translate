/**
 * useNetwork Hook
 *
 * Manages network graph data fetching, transformation, and state.
 * Integrates with TanStack Query for caching and with D3 for layout.
 */

import { useState, useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import type {
  NetworkResponse,
  D3Node,
  D3Link,
  NetworkOptions,
} from '@/types/network';
import {
  calculateAllMetrics,
  assignCommunities,
  getDisplayLabel,
} from '@/lib/forceSimulation';

// ============================================================================
// API Functions
// ============================================================================

async function fetchNetwork(
  centerId: string,
  depth: number,
  relationshipTypes: string[],
  entityTypes: string[],
  minConfidence: number
): Promise<NetworkResponse> {
  const params = new URLSearchParams({
    depth: depth.toString(),
    minConfidence: minConfidence.toString(),
  });

  if (relationshipTypes.length > 0) {
    params.append('relationshipTypes', relationshipTypes.join(','));
  }

  if (entityTypes.length > 0) {
    params.append('entityTypes', entityTypes.join(','));
  }

  const response = await fetch(`/api/graph/network/${centerId}?${params}`);

  if (!response.ok) {
    throw new Error(`Failed to fetch network: ${response.statusText}`);
  }

  return response.json();
}

// ============================================================================
// Data Transformation
// ============================================================================

function transformToD3Nodes(
  entities: NetworkResponse['nodes'],
  centerNodeId: string
): D3Node[] {
  return entities.map(entity => ({
    id: entity.id,
    entity,
    x: 0,
    y: 0,
    fx: null,
    fy: null,
    radius: 20,
    color: '#6b7280',
    label: getDisplayLabel({ entity } as D3Node),
    selected: entity.id === centerNodeId,
    highlighted: false,
    expanded: entity.id === centerNodeId, // Center node starts expanded
    degree: 0,
    influence: 0,
  }));
}

function transformToD3Links(
  relationships: NetworkResponse['edges'],
  nodeMap: Map<string, D3Node>
): D3Link[] {
  return relationships
    .map(rel => {
      const source = nodeMap.get(rel.subjectId);
      const target = nodeMap.get(rel.objectId);

      if (!source || !target) {
        console.warn(`Missing node for relationship ${rel.id}`);
        return null;
      }

      return {
        id: rel.id,
        source,
        target,
        predicate: rel.predicate,
        confidence: rel.confidence,
        properties: rel.properties,
        showLabel: false,
        highlighted: false,
      } as D3Link;
    })
    .filter((link): link is D3Link => link !== null) as D3Link[];
}

// ============================================================================
// Hook
// ============================================================================

export interface UseNetworkOptions {
  centerId: string;
  depth: number;
  relationshipTypes: string[];
  entityTypes: string[];
  minConfidence: number;
}

export interface UseNetworkResult {
  // Data
  nodes: D3Node[];
  links: D3Link[];
  centerNode: D3Node | null;

  // State
  isLoading: boolean;
  error: Error | null;

  // Statistics
  statistics: {
    nodeCount: number;
    edgeCount: number;
    avgConfidence: number;
  } | null;

  // Actions
  expandNode: (nodeId: string) => void;
  selectNode: (nodeId: string) => void;
  highlightPath: (nodeIds: string[], linkIds: string[]) => void;
  clearHighlight: () => void;
  refetch: () => void;
}

export function useNetwork(options: UseNetworkOptions): UseNetworkResult {
  const { centerId, depth, relationshipTypes, entityTypes, minConfidence } = options;

  // Local state
  const [selectedNodeId, setSelectedNodeId] = useState<string>(centerId);
  const [highlightedNodeIds, setHighlightedNodeIds] = useState<Set<string>>(new Set());
  const [highlightedLinkIds, setHighlightedLinkIds] = useState<Set<string>>(new Set());
  const [expandedNodeIds, setExpandedNodeIds] = useState<Set<string>>(new Set([centerId]));

  // Fetch network data
  const {
    data: rawData,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['network', centerId, depth, relationshipTypes, entityTypes, minConfidence],
    queryFn: () => fetchNetwork(centerId, depth, relationshipTypes, entityTypes, minConfidence),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });

  // Transform data to D3 format
  const { nodes, links, centerNode } = useMemo(() => {
    if (!rawData) {
      return { nodes: [], links: [], centerNode: null };
    }

    // Create nodes
    const nodes = transformToD3Nodes(rawData.nodes, centerId);
    const nodeMap = new Map(nodes.map(n => [n.id, n]));

    // Create links
    const links = transformToD3Links(rawData.edges, nodeMap);

    // Calculate metrics
    calculateAllMetrics(nodes, links);
    assignCommunities(nodes, links);

    // Apply selection and highlight state
    nodes.forEach(node => {
      node.selected = node.id === selectedNodeId;
      node.highlighted = highlightedNodeIds.has(node.id);
      node.expanded = expandedNodeIds.has(node.id);
    });

    links.forEach(link => {
      link.highlighted = highlightedLinkIds.has(link.id);
    });

    const centerNode = nodeMap.get(centerId) || null;

    return { nodes, links, centerNode };
  }, [rawData, centerId, selectedNodeId, highlightedNodeIds, highlightedLinkIds, expandedNodeIds]);

  // Actions
  const expandNode = useCallback((nodeId: string) => {
    setExpandedNodeIds(prev => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  }, []);

  const selectNode = useCallback((nodeId: string) => {
    setSelectedNodeId(nodeId);
  }, []);

  const highlightPath = useCallback((nodeIds: string[], linkIds: string[]) => {
    setHighlightedNodeIds(new Set(nodeIds));
    setHighlightedLinkIds(new Set(linkIds));
  }, []);

  const clearHighlight = useCallback(() => {
    setHighlightedNodeIds(new Set());
    setHighlightedLinkIds(new Set());
  }, []);

  return {
    nodes,
    links,
    centerNode,
    isLoading,
    error: error as Error | null,
    statistics: rawData?.statistics || null,
    expandNode,
    selectNode,
    highlightPath,
    clearHighlight,
    refetch,
  };
}
