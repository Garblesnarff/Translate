/**
 * Network Graph Component
 *
 * Main force-directed graph visualization using D3.js and React.
 * Handles rendering, simulation, zoom, pan, and user interactions.
 */

import React, { useRef, useEffect, useState, useCallback } from 'react';
import * as d3 from 'd3';
import type { D3Node, D3Link, ColorMode, SizeMode } from '@/types/network';
import { NetworkNode } from './NetworkNode';
import { NetworkLink, LinkArrows } from './NetworkLink';
import {
  createForceSimulation,
  createZoomBehavior,
  createDragBehavior,
  resetZoom,
  zoomToNode,
} from '@/lib/forceSimulation';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2 } from 'lucide-react';

// ============================================================================
// Props
// ============================================================================

export interface NetworkGraphProps {
  nodes: D3Node[];
  links: D3Link[];
  colorMode: ColorMode;
  sizeMode: SizeMode;
  showLabels: boolean;
  showRelationshipLabels: boolean;
  isPaused: boolean;
  width: number;
  height: number;
  onNodeClick?: (node: D3Node) => void;
  onNodeDoubleClick?: (node: D3Node) => void;
  onBackgroundClick?: () => void;
}

// ============================================================================
// Component
// ============================================================================

export function NetworkGraph({
  nodes,
  links,
  colorMode,
  sizeMode,
  showLabels,
  showRelationshipLabels,
  isPaused,
  width,
  height,
  onNodeClick,
  onNodeDoubleClick,
  onBackgroundClick,
}: NetworkGraphProps): JSX.Element {
  const svgRef = useRef<SVGSVGElement>(null);
  const graphGroupRef = useRef<SVGGElement>(null);
  const simulationRef = useRef<d3.Simulation<D3Node, D3Link> | null>(null);
  const zoomBehaviorRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const [renderKey, setRenderKey] = useState(0);

  // ============================================================================
  // Initialize Simulation
  // ============================================================================

  useEffect(() => {
    if (nodes.length === 0 || !svgRef.current || !graphGroupRef.current) {
      return;
    }

    // Create simulation
    const simulation = createForceSimulation(nodes, links, width, height);
    simulationRef.current = simulation;

    // Update render on each tick
    simulation.on('tick', () => {
      setRenderKey(prev => prev + 1);
    });

    // Setup zoom behavior
    const svg = d3.select(svgRef.current);
    const graphGroup = d3.select(graphGroupRef.current);
    const zoom = createZoomBehavior(svg, graphGroup);
    zoomBehaviorRef.current = zoom;

    // Cleanup
    return () => {
      simulation.stop();
    };
  }, [nodes, links, width, height]);

  // ============================================================================
  // Pause/Resume Simulation
  // ============================================================================

  useEffect(() => {
    if (simulationRef.current) {
      if (isPaused) {
        simulationRef.current.stop();
      } else {
        simulationRef.current.alpha(0.3).restart();
      }
    }
  }, [isPaused]);

  // ============================================================================
  // Setup Drag Behavior
  // ============================================================================

  useEffect(() => {
    if (!simulationRef.current || !graphGroupRef.current) return;

    const simulation = simulationRef.current;
    const dragBehavior = createDragBehavior(simulation);

    // Apply drag to node groups
    d3.select(graphGroupRef.current)
      .selectAll<SVGGElement, D3Node>('.network-node')
      .call(dragBehavior);
  }, [nodes, renderKey]);

  // ============================================================================
  // Event Handlers
  // ============================================================================

  const handleNodeClick = useCallback((node: D3Node) => {
    onNodeClick?.(node);
  }, [onNodeClick]);

  const handleNodeDoubleClick = useCallback((node: D3Node) => {
    onNodeDoubleClick?.(node);

    // Zoom to node
    if (svgRef.current && zoomBehaviorRef.current) {
      const svg = d3.select(svgRef.current);
      zoomToNode(svg, zoomBehaviorRef.current, node, width, height);
    }
  }, [onNodeDoubleClick, width, height]);

  const handleBackgroundClick = useCallback(() => {
    onBackgroundClick?.();
  }, [onBackgroundClick]);

  const handleResetZoom = useCallback(() => {
    if (svgRef.current && zoomBehaviorRef.current) {
      const svg = d3.select(svgRef.current);
      resetZoom(svg, zoomBehaviorRef.current);
    }
  }, []);

  // ============================================================================
  // Loading State
  // ============================================================================

  if (nodes.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-500" />
          <p className="text-sm text-gray-500">Loading network...</p>
        </div>
      </div>
    );
  }

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <div className="relative w-full h-full">
      {/* Reset Zoom Button */}
      <button
        onClick={handleResetZoom}
        className="absolute top-4 right-4 z-10 px-3 py-2 text-sm bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50"
      >
        Reset Zoom
      </button>

      {/* Info Badge */}
      <div className="absolute top-4 left-4 z-10 px-3 py-2 bg-white border border-gray-200 rounded-md shadow-sm text-xs">
        <div className="font-medium text-gray-700">
          {nodes.length} nodes · {links.length} edges
        </div>
      </div>

      {/* SVG Canvas */}
      <svg
        ref={svgRef}
        width={width}
        height={height}
        className="network-graph-svg"
        onClick={handleBackgroundClick}
        style={{ cursor: 'grab' }}
      >
        <LinkArrows links={links} />

        <g ref={graphGroupRef} className="network-graph-group">
          {/* Render links first (so they appear behind nodes) */}
          {links.map(link => (
            <NetworkLink
              key={link.id}
              link={link}
              showLabels={showRelationshipLabels}
            />
          ))}

          {/* Render nodes */}
          {nodes.map(node => (
            <NetworkNode
              key={node.id}
              node={node}
              colorMode={colorMode}
              sizeMode={sizeMode}
              showLabels={showLabels}
              onClick={handleNodeClick}
              onDoubleClick={handleNodeDoubleClick}
            />
          ))}
        </g>
      </svg>

      {/* Instructions */}
      <div className="absolute bottom-4 left-4 z-10 max-w-xs">
        <Alert>
          <AlertDescription className="text-xs">
            <strong>Interactions:</strong>
            <br />
            • Click node to select
            <br />
            • Double-click to zoom in
            <br />
            • Drag to reposition
            <br />
            • Scroll to zoom
            <br />• Drag background to pan
          </AlertDescription>
        </Alert>
      </div>
    </div>
  );
}

export default NetworkGraph;
