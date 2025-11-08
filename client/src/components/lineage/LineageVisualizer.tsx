/**
 * LineageVisualizer
 *
 * Main component for interactive lineage visualization using vis-network.
 * Renders teacher-student transmission lineages and incarnation chains.
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { Network } from 'vis-network';
import { DataSet } from 'vis-data';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle, Loader2 } from 'lucide-react';
import type { Entity, Relationship, LineageType } from '../../hooks/useLineage';
import type { NetworkNode, NetworkEdge } from '../../lib/networkConfig';
import {
  TREE_LAYOUT_OPTIONS,
  NETWORK_LAYOUT_OPTIONS,
  INTERACTION_OPTIONS,
} from '../../lib/networkConfig';
import { createNodeData } from './LineageNode';
import { createEdgeData } from './LineageEdge';
import type { LayoutMode } from './LineageControls';

// ============================================================================
// Types
// ============================================================================

export interface LineageVisualizerProps {
  rootPersonId: string;
  lineageType: LineageType;
  layoutMode: LayoutMode;
  maxDepth?: number;
  entities: Map<string, Entity>;
  relationships: Map<string, Relationship>;
  isLoading?: boolean;
  error?: Error | null;
  onNodeClick?: (entity: Entity) => void;
  onNodeDoubleClick?: (entity: Entity) => void;
}

export interface VisNetwork {
  network: Network;
  nodes: DataSet<NetworkNode>;
  edges: DataSet<NetworkEdge>;
}

// ============================================================================
// Component
// ============================================================================

export function LineageVisualizer({
  rootPersonId,
  lineageType,
  layoutMode,
  maxDepth = 5,
  entities,
  relationships,
  isLoading = false,
  error = null,
  onNodeClick,
  onNodeDoubleClick,
}: LineageVisualizerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const networkRef = useRef<VisNetwork | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  // Build network data from entities and relationships
  const buildNetworkData = useCallback(() => {
    const nodes: NetworkNode[] = [];
    const edges: NetworkEdge[] = [];

    // Create nodes from entities
    entities.forEach((entity) => {
      const isRoot = entity.id === rootPersonId;
      const isSelected = entity.id === selectedNodeId;

      nodes.push(createNodeData(entity, { isRoot, isSelected }));
    });

    // Create edges from relationships
    relationships.forEach((relationship) => {
      edges.push(createEdgeData(relationship));
    });

    return { nodes, edges };
  }, [entities, relationships, rootPersonId, selectedNodeId]);

  // Initialize network
  useEffect(() => {
    if (!containerRef.current) return;

    const { nodes, edges } = buildNetworkData();
    const nodesDataSet = new DataSet(nodes);
    const edgesDataSet = new DataSet(edges);

    const options =
      layoutMode === 'tree'
        ? { ...TREE_LAYOUT_OPTIONS, ...INTERACTION_OPTIONS }
        : { ...NETWORK_LAYOUT_OPTIONS, ...INTERACTION_OPTIONS };

    const network = new Network(
      containerRef.current,
      {
        nodes: nodesDataSet,
        edges: edgesDataSet,
      },
      options
    );

    // Store network reference
    networkRef.current = {
      network,
      nodes: nodesDataSet,
      edges: edgesDataSet,
    };

    // Event handlers
    network.on('click', (params) => {
      if (params.nodes.length > 0) {
        const nodeId = params.nodes[0] as string;
        setSelectedNodeId(nodeId);

        const entity = entities.get(nodeId);
        if (entity && onNodeClick) {
          onNodeClick(entity);
        }
      } else {
        setSelectedNodeId(null);
      }
    });

    network.on('doubleClick', (params) => {
      if (params.nodes.length > 0) {
        const nodeId = params.nodes[0] as string;
        const entity = entities.get(nodeId);
        if (entity && onNodeDoubleClick) {
          onNodeDoubleClick(entity);
        }
      }
    });

    // Cleanup
    return () => {
      network.destroy();
      networkRef.current = null;
    };
  }, [
    layoutMode,
    buildNetworkData,
    entities,
    onNodeClick,
    onNodeDoubleClick,
  ]);

  // Update network data when entities/relationships change
  useEffect(() => {
    if (!networkRef.current) return;

    const { nodes, edges } = buildNetworkData();

    // Update nodes
    networkRef.current.nodes.clear();
    networkRef.current.nodes.add(nodes);

    // Update edges
    networkRef.current.edges.clear();
    networkRef.current.edges.add(edges);

    // Fit network to view after stabilization
    if (layoutMode === 'network') {
      networkRef.current.network.once('stabilized', () => {
        networkRef.current?.network.fit({
          animation: {
            duration: 500,
            easingFunction: 'easeInOutQuad',
          },
        });
      });
    } else {
      // For tree layout, fit immediately
      setTimeout(() => {
        networkRef.current?.network.fit({
          animation: {
            duration: 500,
            easingFunction: 'easeInOutQuad',
          },
        });
      }, 100);
    }
  }, [buildNetworkData, layoutMode]);

  // Expose network controls
  useEffect(() => {
    if (networkRef.current) {
      // Store network instance for external access
      (window as any).__lineageNetwork = networkRef.current.network;
    }
  }, []);

  // Loading state
  if (isLoading) {
    return (
      <div className="lineage-visualizer-loading flex items-center justify-center h-full bg-muted/10">
        <div className="text-center space-y-4">
          <Loader2 className="h-12 w-12 animate-spin mx-auto text-primary" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-48 mx-auto" />
            <Skeleton className="h-3 w-32 mx-auto" />
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="lineage-visualizer-error flex items-center justify-center h-full p-6">
        <Alert variant="destructive" className="max-w-md">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <div className="font-medium mb-1">Failed to load lineage</div>
            <div className="text-sm">{error.message}</div>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  // Empty state
  if (entities.size === 0) {
    return (
      <div className="lineage-visualizer-empty flex items-center justify-center h-full">
        <div className="text-center text-muted-foreground">
          <p className="text-sm">No lineage data available</p>
          <p className="text-xs mt-1">Select a person to view their lineage</p>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="lineage-visualizer w-full h-full bg-background"
      style={{ minHeight: '500px' }}
    />
  );
}

// ============================================================================
// Network Controls Hook
// ============================================================================

/**
 * Hook for controlling the network instance externally
 */
export function useNetworkControls() {
  const getNetwork = useCallback((): Network | null => {
    return (window as any).__lineageNetwork || null;
  }, []);

  const zoomIn = useCallback(() => {
    const network = getNetwork();
    if (!network) return;

    const scale = network.getScale();
    network.moveTo({
      scale: scale * 1.2,
      animation: {
        duration: 300,
        easingFunction: 'easeInOutQuad',
      },
    });
  }, [getNetwork]);

  const zoomOut = useCallback(() => {
    const network = getNetwork();
    if (!network) return;

    const scale = network.getScale();
    network.moveTo({
      scale: scale * 0.8,
      animation: {
        duration: 300,
        easingFunction: 'easeInOutQuad',
      },
    });
  }, [getNetwork]);

  const fitToView = useCallback(() => {
    const network = getNetwork();
    if (!network) return;

    network.fit({
      animation: {
        duration: 500,
        easingFunction: 'easeInOutQuad',
      },
    });
  }, [getNetwork]);

  const focusNode = useCallback((nodeId: string) => {
    const network = getNetwork();
    if (!network) return;

    network.focus(nodeId, {
      scale: 1.5,
      animation: {
        duration: 500,
        easingFunction: 'easeInOutQuad',
      },
    });

    // Select the node
    network.selectNodes([nodeId]);
  }, [getNetwork]);

  const exportPNG = useCallback(() => {
    const network = getNetwork();
    if (!network) return;

    const canvas = (network as any).canvas.frame.canvas;
    const dataURL = canvas.toDataURL('image/png');

    // Download
    const link = document.createElement('a');
    link.download = `lineage-${Date.now()}.png`;
    link.href = dataURL;
    link.click();
  }, [getNetwork]);

  const exportSVG = useCallback(() => {
    // Note: vis-network doesn't natively support SVG export
    // This would require custom implementation or a third-party library
    console.warn('SVG export not yet implemented');
  }, []);

  const exportJSON = useCallback(() => {
    const network = getNetwork();
    if (!network) return;

    const nodes = (network as any).body.data.nodes.get();
    const edges = (network as any).body.data.edges.get();

    const data = {
      nodes: nodes.map((node: NetworkNode) => ({
        id: node.id,
        label: node.label,
        entity: node._entity,
      })),
      edges: edges.map((edge: NetworkEdge) => ({
        id: edge.id,
        from: edge.from,
        to: edge.to,
        relationship: edge._relationship,
      })),
    };

    const dataStr = JSON.stringify(data, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.download = `lineage-${Date.now()}.json`;
    link.href = url;
    link.click();

    URL.revokeObjectURL(url);
  }, [getNetwork]);

  return {
    zoomIn,
    zoomOut,
    fitToView,
    focusNode,
    exportPNG,
    exportSVG,
    exportJSON,
  };
}
