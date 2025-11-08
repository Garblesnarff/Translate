/**
 * Network Link Component
 *
 * Renders relationship edges in the force-directed graph with directional arrows,
 * confidence-based styling, and optional labels.
 */

import React from 'react';
import type { D3Link } from '@/types/network';
import { RELATIONSHIP_COLORS } from '@/types/network';

// ============================================================================
// Props and Types
// ============================================================================

interface NetworkLinkProps {
  link: D3Link;
  showLabels: boolean;
}

interface LinkArrrowsProps {
  links: D3Link[];
}

// ============================================================================
// Helper Functions
// ============================================================================

function getRelationshipColor(predicate: string): string {
  return RELATIONSHIP_COLORS[predicate] || RELATIONSHIP_COLORS.default;
}

function formatPredicate(predicate: string): string {
  return predicate
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function getLinkWidth(link: D3Link): number {
  // Width based on confidence: 1-4px
  return Math.max(1, link.confidence * 4);
}

function getLinkOpacity(link: D3Link): number {
  if (link.highlighted) return 0.9;
  return 0.6;
}

function getLinkDashArray(link: D3Link): string | undefined {
  // Dashed line for low confidence relationships
  if (link.confidence < 0.5) {
    return '5,5';
  }
  return undefined;
}

// ============================================================================
// Arrow Markers Component
// ============================================================================

export function LinkArrows({ links }: LinkArrrowsProps): JSX.Element {
  // Get unique predicates from links
  const predicates = Array.from(new Set(links.map(l => l.predicate)));

  return (
    <defs>
      {predicates.map(predicate => {
        const color = getRelationshipColor(predicate);

        return (
          <marker
            key={predicate}
            id={`arrow-${predicate}`}
            viewBox="0 0 10 10"
            refX={8}
            refY={5}
            markerWidth={6}
            markerHeight={6}
            orient="auto"
            markerUnits="userSpaceOnUse"
          >
            <path
              d="M 0 0 L 10 5 L 0 10 z"
              fill={color}
            />
          </marker>
        );
      })}

      {/* Highlighted arrow */}
      <marker
        id="arrow-highlighted"
        viewBox="0 0 10 10"
        refX={8}
        refY={5}
        markerWidth={8}
        markerHeight={8}
        orient="auto"
        markerUnits="userSpaceOnUse"
      >
        <path
          d="M 0 0 L 10 5 L 0 10 z"
          fill="#60a5fa" // blue-400
        />
      </marker>
    </defs>
  );
}

// ============================================================================
// Link Component
// ============================================================================

export function NetworkLink({
  link,
  showLabels,
}: NetworkLinkProps): JSX.Element {
  const color = getRelationshipColor(link.predicate);
  const width = getLinkWidth(link);
  const opacity = getLinkOpacity(link);
  const dashArray = getLinkDashArray(link);

  // Calculate positions
  const sourceX = link.source.x!;
  const sourceY = link.source.y!;
  const targetX = link.target.x!;
  const targetY = link.target.y!;

  // Calculate angle for arrow marker offset
  const dx = targetX - sourceX;
  const dy = targetY - sourceY;
  const angle = Math.atan2(dy, dx);

  // Offset end point by target radius to prevent arrow from going into node
  const targetRadius = link.target.radius;
  const endX = targetX - Math.cos(angle) * (targetRadius + 8);
  const endY = targetY - Math.sin(angle) * (targetRadius + 8);

  // Offset start point by source radius
  const sourceRadius = link.source.radius;
  const startX = sourceX + Math.cos(angle) * (sourceRadius + 2);
  const startY = sourceY + Math.sin(angle) * (sourceRadius + 2);

  // Label position (midpoint)
  const labelX = (sourceX + targetX) / 2;
  const labelY = (sourceY + targetY) / 2;

  const markerEnd = link.highlighted
    ? 'url(#arrow-highlighted)'
    : `url(#arrow-${link.predicate})`;

  return (
    <g className="network-link">
      {/* Main line */}
      <line
        x1={startX}
        y1={startY}
        x2={endX}
        y2={endY}
        stroke={link.highlighted ? '#60a5fa' : color}
        strokeWidth={link.highlighted ? width + 1 : width}
        strokeOpacity={opacity}
        strokeDasharray={dashArray}
        markerEnd={markerEnd}
        className="link-line"
      />

      {/* Wider invisible line for easier hovering */}
      <line
        x1={startX}
        y1={startY}
        x2={endX}
        y2={endY}
        stroke="transparent"
        strokeWidth={Math.max(width + 10, 15)}
        className="link-hover-target"
      >
        <title>
          {formatPredicate(link.predicate)}
          {'\n'}Confidence: {(link.confidence * 100).toFixed(1)}%
          {link.properties && Object.keys(link.properties).length > 0 && (
            `\n${JSON.stringify(link.properties, null, 2)}`
          )}
        </title>
      </line>

      {/* Relationship label */}
      {(showLabels || link.showLabel || link.highlighted) && (
        <g transform={`translate(${labelX}, ${labelY})`}>
          {/* Background for label */}
          <rect
            x={-30}
            y={-10}
            width={60}
            height={16}
            fill="#ffffff"
            fillOpacity={0.9}
            stroke="#e5e7eb"
            strokeWidth={1}
            rx={3}
          />

          {/* Label text */}
          <text
            textAnchor="middle"
            dy="0.35em"
            fontSize={10}
            fill="#374151" // gray-700
            fontWeight={link.highlighted ? 'bold' : 'normal'}
            pointerEvents="none"
          >
            {formatPredicate(link.predicate)}
          </text>
        </g>
      )}
    </g>
  );
}

// ============================================================================
// Memoized Export
// ============================================================================

export default React.memo(NetworkLink, (prev, next) => {
  return (
    prev.link.id === next.link.id &&
    prev.link.source.x === next.link.source.x &&
    prev.link.source.y === next.link.source.y &&
    prev.link.target.x === next.link.target.x &&
    prev.link.target.y === next.link.target.y &&
    prev.link.highlighted === next.link.highlighted &&
    prev.link.showLabel === next.link.showLabel &&
    prev.showLabels === next.showLabels
  );
});
