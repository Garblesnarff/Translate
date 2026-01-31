/**
 * Network Node Component
 *
 * Renders individual nodes in the force-directed graph with visual encoding
 * for size, color, and state (selected, highlighted, expanded).
 */

import React from 'react';
import type { D3Node, ColorMode, SizeMode } from '@/types/network';
import {
  TRADITION_COLORS,
  ENTITY_TYPE_COLORS,
  COMMUNITY_COLORS,
  NODE_RADIUS,
} from '@/types/network';
import { truncateLabel } from '@/lib/forceSimulation';

// ============================================================================
// Props and Types
// ============================================================================

interface NetworkNodeProps {
  node: D3Node;
  colorMode: ColorMode;
  sizeMode: SizeMode;
  showLabels: boolean;
  onClick: (node: D3Node) => void;
  onDoubleClick: (node: D3Node) => void;
}

// ============================================================================
// Helper Functions
// ============================================================================

function getNodeColor(node: D3Node, colorMode: ColorMode): string {
  switch (colorMode) {
    case 'tradition': {
      const tradition = node.entity.attributes.tradition?.[0];
      return TRADITION_COLORS[tradition || 'Unknown'] || '#6b7280';
    }

    case 'entity_type': {
      return ENTITY_TYPE_COLORS[node.entity.type] || '#6b7280';
    }

    case 'community': {
      const communityId = node.community || 0;
      return COMMUNITY_COLORS[communityId % COMMUNITY_COLORS.length];
    }

    default:
      return '#6b7280';
  }
}

function getNodeRadius(node: D3Node, sizeMode: SizeMode): number {
  switch (sizeMode) {
    case 'equal':
      return NODE_RADIUS.DEFAULT;

    case 'degree':
      return Math.min(
        NODE_RADIUS.MIN + node.degree * 2,
        NODE_RADIUS.MAX
      );

    case 'influence':
      return Math.min(
        NODE_RADIUS.MIN + node.influence * 30,
        NODE_RADIUS.MAX
      );

    default:
      return NODE_RADIUS.DEFAULT;
  }
}

function getStrokeWidth(node: D3Node): number {
  if (node.selected) return 4;
  if (node.highlighted) return 3;
  if (node.entity.verified) return 2.5;
  return 2;
}

function getStrokeColor(node: D3Node): string {
  if (node.selected) return '#fbbf24'; // amber-400
  if (node.highlighted) return '#60a5fa'; // blue-400
  return '#ffffff';
}

function getOpacity(node: D3Node): number {
  if (node.selected || node.highlighted) return 1;
  return 0.9;
}

// ============================================================================
// Component
// ============================================================================

export function NetworkNode({
  node,
  colorMode,
  sizeMode,
  showLabels,
  onClick,
  onDoubleClick,
}: NetworkNodeProps): JSX.Element {
  const radius = getNodeRadius(node, sizeMode);
  const color = getNodeColor(node, colorMode);
  const strokeWidth = getStrokeWidth(node);
  const strokeColor = getStrokeColor(node);
  const opacity = getOpacity(node);

  // Update node's radius for collision detection
  node.radius = radius;
  node.color = color;

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onClick(node);
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDoubleClick(node);
  };

  return (
    <g
      className="network-node"
      transform={`translate(${node.x}, ${node.y})`}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      style={{ cursor: 'pointer' }}
    >
      {/* Shadow for depth */}
      {(node.selected || node.highlighted) && (
        <circle
          r={radius + 2}
          fill="none"
          stroke={strokeColor}
          strokeWidth={strokeWidth + 2}
          opacity={0.3}
        />
      )}

      {/* Main circle */}
      <circle
        r={radius}
        fill={color}
        stroke={strokeColor}
        strokeWidth={strokeWidth}
        opacity={opacity}
        className="node-circle"
      />

      {/* Confidence indicator (inner circle) */}
      <circle
        r={radius * node.entity.confidence}
        fill="none"
        stroke="#000000"
        strokeWidth={1}
        strokeDasharray="2,2"
        opacity={0.3}
        pointerEvents="none"
      />

      {/* Verification badge */}
      {node.entity.verified && (
        <circle
          cx={radius * 0.6}
          cy={-radius * 0.6}
          r={radius * 0.25}
          fill="#10b981" // emerald-500
          stroke="#ffffff"
          strokeWidth={1}
        />
      )}

      {/* Expansion indicator */}
      {!node.expanded && (
        <g transform={`translate(${radius * 0.6}, ${radius * 0.6})`}>
          <circle
            r={radius * 0.3}
            fill="#eab308" // yellow-500
            stroke="#ffffff"
            strokeWidth={1}
          />
          <text
            textAnchor="middle"
            dy="0.35em"
            fontSize={radius * 0.4}
            fill="#ffffff"
            fontWeight="bold"
            pointerEvents="none"
          >
            +
          </text>
        </g>
      )}

      {/* Label */}
      {showLabels && (
        <text
          dy={radius + 14}
          textAnchor="middle"
          fontSize={12}
          fill="#1f2937" // gray-800
          fontWeight={node.selected ? 'bold' : 'normal'}
          pointerEvents="none"
          className="node-label"
        >
          {truncateLabel(node.label, radius)}
        </text>
      )}

      {/* Hover tooltip data */}
      <title>
        {node.entity.canonicalName}
        {'\n'}Type: {node.entity.type}
        {'\n'}Confidence: {(node.entity.confidence * 100).toFixed(1)}%
        {node.entity.attributes.tradition && (
          `\nTradition: ${node.entity.attributes.tradition.join(', ')}`
        )}
        {'\n'}Connections: {node.degree}
      </title>
    </g>
  );
}

// ============================================================================
// Memoized Export
// ============================================================================

export default React.memo(NetworkNode, (prev, next) => {
  return (
    prev.node.id === next.node.id &&
    prev.node.x === next.node.x &&
    prev.node.y === next.node.y &&
    prev.node.selected === next.node.selected &&
    prev.node.highlighted === next.node.highlighted &&
    prev.node.expanded === next.node.expanded &&
    prev.colorMode === next.colorMode &&
    prev.sizeMode === next.sizeMode &&
    prev.showLabels === next.showLabels
  );
});
