/**
 * Network Page
 *
 * Full-page network visualization with controls, search, legend, and details.
 * Integrates all network components into a cohesive interface.
 */

import React, { useState, useEffect } from 'react';
import { useParams, useLocation } from 'wouter';
import { NetworkGraph } from '@/components/network/NetworkGraph';
import { NetworkControls } from '@/components/network/NetworkControls';
import { NetworkSearch } from '@/components/network/NetworkSearch';
import { NetworkLegend } from '@/components/network/NetworkLegend';
import { NodeDetails } from '@/components/network/NodeDetails';
import { useNetwork } from '@/hooks/useNetwork';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Loader2, AlertCircle, ArrowLeft } from 'lucide-react';
import type { D3Node, ColorMode, SizeMode } from '@/types/network';
import { RELATIONSHIP_TYPES } from '@/types/network';
import '@/styles/network.css';

// ============================================================================
// Component
// ============================================================================

export function NetworkPage(): JSX.Element {
  const params = useParams();
  const [, navigate] = useLocation();

  // Get entity ID from URL params or use default
  const entityId = params.entityId || 'default-entity-id';

  // ============================================================================
  // State Management
  // ============================================================================

  // Visual encoding
  const [colorMode, setColorMode] = useState<ColorMode>('tradition');
  const [sizeMode, setSizeMode] = useState<SizeMode>('degree');

  // Filters
  const [relationshipTypes, setRelationshipTypes] = useState<string[]>([...RELATIONSHIP_TYPES]);
  const [depth, setDepth] = useState(2);
  const [minConfidence, setMinConfidence] = useState(0.3);

  // Display options
  const [showLabels, setShowLabels] = useState(true);
  const [showRelationshipLabels, setShowRelationshipLabels] = useState(false);

  // Physics
  const [isPaused, setIsPaused] = useState(false);

  // Selected node
  const [selectedNode, setSelectedNode] = useState<D3Node | null>(null);

  // Dimensions
  const [dimensions, setDimensions] = useState({ width: 1200, height: 800 });

  // ============================================================================
  // Network Data Hook
  // ============================================================================

  const {
    nodes,
    links,
    centerNode,
    isLoading,
    error,
    statistics,
    expandNode,
    selectNode,
    highlightPath,
    clearHighlight,
    refetch,
  } = useNetwork({
    centerId: entityId,
    depth,
    relationshipTypes,
    entityTypes: [], // All types
    minConfidence,
  });

  // ============================================================================
  // Window Resize Handling
  // ============================================================================

  useEffect(() => {
    const updateDimensions = () => {
      // Calculate available space (full viewport minus header/margins)
      const width = window.innerWidth - 700; // Account for sidebars
      const height = window.innerHeight - 120; // Account for header
      setDimensions({ width: Math.max(800, width), height: Math.max(600, height) });
    };

    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  // ============================================================================
  // Event Handlers
  // ============================================================================

  const handleNodeClick = (node: D3Node) => {
    setSelectedNode(node);
    selectNode(node.id);
  };

  const handleNodeDoubleClick = (node: D3Node) => {
    expandNode(node.id);
    // In a real app, you might want to trigger a new fetch with expanded depth
  };

  const handleBackgroundClick = () => {
    setSelectedNode(null);
    clearHighlight();
  };

  const handlePauseToggle = () => {
    setIsPaused(prev => !prev);
  };

  const handleResetLayout = () => {
    refetch();
  };

  const handleGoBack = () => {
    navigate('/');
  };

  // ============================================================================
  // Loading State
  // ============================================================================

  if (isLoading && nodes.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4 text-blue-500" />
          <h2 className="text-xl font-semibold mb-2">Loading Network</h2>
          <p className="text-gray-500">
            Fetching entities and relationships...
          </p>
        </div>
      </div>
    );
  }

  // ============================================================================
  // Error State
  // ============================================================================

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen p-4">
        <Alert variant="destructive" className="max-w-2xl">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error Loading Network</AlertTitle>
          <AlertDescription>
            {error.message || 'Failed to load network data'}
          </AlertDescription>
          <div className="mt-4 flex gap-2">
            <Button onClick={() => refetch()} variant="outline" size="sm">
              Try Again
            </Button>
            <Button onClick={handleGoBack} variant="outline" size="sm">
              Go Back
            </Button>
          </div>
        </Alert>
      </div>
    );
  }

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <div className="network-page">
      {/* Header */}
      <header className="network-header">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleGoBack}
            className="gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Knowledge Network Explorer</h1>
            {centerNode && (
              <p className="text-sm text-gray-600">
                Centered on: {centerNode.entity.canonicalName}
              </p>
            )}
          </div>
        </div>

        {statistics && (
          <div className="flex gap-4 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-gray-600">Nodes:</span>
              <span className="font-semibold">{statistics.nodeCount}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-gray-600">Edges:</span>
              <span className="font-semibold">{statistics.edgeCount}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-gray-600">Avg Confidence:</span>
              <span className="font-semibold">
                {(statistics.avgConfidence * 100).toFixed(0)}%
              </span>
            </div>
          </div>
        )}
      </header>

      {/* Main Layout */}
      <div className="network-layout">
        {/* Left Sidebar - Controls */}
        <aside className="network-sidebar network-sidebar-left">
          <div className="mb-4">
            <NetworkSearch
              nodes={nodes}
              links={links}
              onNodeSelect={handleNodeClick}
              onPathHighlight={highlightPath}
              onClearHighlight={clearHighlight}
            />
          </div>

          <NetworkControls
            colorMode={colorMode}
            sizeMode={sizeMode}
            onColorModeChange={setColorMode}
            onSizeModeChange={setSizeMode}
            relationshipTypes={relationshipTypes}
            onRelationshipTypesChange={setRelationshipTypes}
            depth={depth}
            onDepthChange={setDepth}
            minConfidence={minConfidence}
            onMinConfidenceChange={setMinConfidence}
            showLabels={showLabels}
            onShowLabelsChange={setShowLabels}
            showRelationshipLabels={showRelationshipLabels}
            onShowRelationshipLabelsChange={setShowRelationshipLabels}
            isPaused={isPaused}
            onPauseToggle={handlePauseToggle}
            onResetLayout={handleResetLayout}
          />

          <div className="mt-4">
            <NetworkLegend
              colorMode={colorMode}
              sizeMode={sizeMode}
              relationshipTypes={relationshipTypes}
            />
          </div>
        </aside>

        {/* Center - Graph */}
        <main className="network-main">
          <NetworkGraph
            nodes={nodes}
            links={links}
            colorMode={colorMode}
            sizeMode={sizeMode}
            showLabels={showLabels}
            showRelationshipLabels={showRelationshipLabels}
            isPaused={isPaused}
            width={dimensions.width}
            height={dimensions.height}
            onNodeClick={handleNodeClick}
            onNodeDoubleClick={handleNodeDoubleClick}
            onBackgroundClick={handleBackgroundClick}
          />
        </main>

        {/* Right Sidebar - Node Details */}
        <aside className="network-sidebar network-sidebar-right">
          <NodeDetails node={selectedNode} />
        </aside>
      </div>
    </div>
  );
}

export default NetworkPage;
