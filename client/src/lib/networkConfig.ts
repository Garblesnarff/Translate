/**
 * vis-network Configuration
 *
 * Configuration options for lineage visualization using vis-network.
 * Defines layout modes, node styles, edge styles, and interaction settings.
 */

import type { Options, Node, Edge } from 'vis-network';

// ============================================================================
// Layout Configurations
// ============================================================================

/**
 * Tree layout - Hierarchical display (root at top, branches down)
 */
export const TREE_LAYOUT_OPTIONS: Options = {
  layout: {
    hierarchical: {
      enabled: true,
      direction: 'UD', // Up-Down
      sortMethod: 'directed',
      levelSeparation: 150,
      nodeSpacing: 200,
      treeSpacing: 250,
      blockShifting: true,
      edgeMinimization: true,
      parentCentralization: true,
    },
  },
  physics: {
    enabled: false, // Static tree layout
  },
  interaction: {
    dragNodes: true,
    dragView: true,
    zoomView: true,
    hover: true,
    tooltipDelay: 200,
    navigationButtons: true,
    keyboard: {
      enabled: true,
      bindToWindow: false,
    },
  },
};

/**
 * Network layout - Force-directed for complex connections
 */
export const NETWORK_LAYOUT_OPTIONS: Options = {
  layout: {
    improvedLayout: true,
    randomSeed: 42, // Consistent initial layout
  },
  physics: {
    enabled: true,
    solver: 'forceAtlas2Based',
    forceAtlas2Based: {
      gravitationalConstant: -50,
      centralGravity: 0.01,
      springLength: 200,
      springConstant: 0.08,
      damping: 0.4,
      avoidOverlap: 0.5,
    },
    stabilization: {
      enabled: true,
      iterations: 200,
      updateInterval: 50,
    },
    timestep: 0.5,
    adaptiveTimestep: true,
  },
  interaction: {
    dragNodes: true,
    dragView: true,
    zoomView: true,
    hover: true,
    tooltipDelay: 200,
    navigationButtons: true,
    keyboard: {
      enabled: true,
      bindToWindow: false,
    },
  },
};

// ============================================================================
// Node Styles
// ============================================================================

export interface NetworkNode extends Node {
  _entity?: any; // Store full entity data
}

/**
 * Base node style
 */
export const BASE_NODE_STYLE = {
  shape: 'circle' as const,
  size: 30,
  font: {
    size: 14,
    face: 'Inter, system-ui, sans-serif',
    color: '#1f2937',
    strokeWidth: 3,
    strokeColor: '#ffffff',
  },
  borderWidth: 3,
  shadow: {
    enabled: true,
    color: 'rgba(0,0,0,0.1)',
    size: 5,
    x: 2,
    y: 2,
  },
};

/**
 * Expanded node style (when node's lineage is shown)
 */
export const EXPANDED_NODE_STYLE = {
  size: 40,
  borderWidth: 5,
  font: {
    size: 16,
    bold: true,
  },
  shadow: {
    enabled: true,
    color: 'rgba(0,0,0,0.2)',
    size: 10,
    x: 3,
    y: 3,
  },
};

/**
 * Selected node style
 */
export const SELECTED_NODE_STYLE = {
  color: {
    border: '#eab308',
    background: '#fef3c7',
  },
  borderWidth: 5,
  shadow: {
    enabled: true,
    color: 'rgba(234,179,8,0.4)',
    size: 15,
    x: 0,
    y: 0,
  },
};

/**
 * Root node style (starting point of lineage)
 */
export const ROOT_NODE_STYLE = {
  size: 45,
  borderWidth: 6,
  shape: 'star' as const,
  font: {
    size: 16,
    bold: true,
  },
};

/**
 * Important person node style (verified, high confidence)
 */
export const IMPORTANT_NODE_STYLE = {
  size: 35,
  borderWidth: 4,
};

// ============================================================================
// Tradition Colors
// ============================================================================

/**
 * Color scheme for different Buddhist traditions
 */
export const TRADITION_COLORS: Record<string, { background: string; border: string }> = {
  Nyingma: {
    background: '#fecaca', // Red 200
    border: '#dc2626', // Red 600
  },
  Kagyu: {
    background: '#ddd6fe', // Violet 200
    border: '#7c3aed', // Violet 600
  },
  Sakya: {
    background: '#bfdbfe', // Blue 200
    border: '#2563eb', // Blue 600
  },
  Gelug: {
    background: '#fef08a', // Yellow 200
    border: '#ca8a04', // Yellow 600
  },
  Bon: {
    background: '#d1fae5', // Green 200
    border: '#059669', // Green 600
  },
  Rimé: {
    background: '#e9d5ff', // Purple 200
    border: '#9333ea', // Purple 600
  },
  Kadam: {
    background: '#fed7aa', // Orange 200
    border: '#ea580c', // Orange 600
  },
  Jonang: {
    background: '#e0e7ff', // Indigo 200
    border: '#4f46e5', // Indigo 600
  },
  Unknown: {
    background: '#e5e7eb', // Gray 200
    border: '#6b7280', // Gray 500
  },
};

/**
 * Get color for a person based on tradition
 */
export function getTraditionColor(tradition?: string[]): { background: string; border: string } {
  if (!tradition || tradition.length === 0) {
    return TRADITION_COLORS.Unknown;
  }
  // Use first tradition
  return TRADITION_COLORS[tradition[0]] || TRADITION_COLORS.Unknown;
}

/**
 * Get border color based on confidence level
 */
export function getBorderColor(confidence: number): string {
  if (confidence >= 0.9) return '#15803d'; // Green 700 - high confidence
  if (confidence >= 0.7) return '#ca8a04'; // Yellow 600 - medium confidence
  return '#dc2626'; // Red 600 - low confidence
}

// ============================================================================
// Edge Styles
// ============================================================================

export interface NetworkEdge extends Edge {
  _relationship?: any; // Store full relationship data
}

/**
 * Teacher-student relationship style
 */
export const TEACHER_EDGE_STYLE = {
  arrows: {
    to: {
      enabled: true,
      scaleFactor: 0.8,
    },
  },
  color: {
    color: '#3b82f6', // Blue 500
    highlight: '#2563eb', // Blue 600
    hover: '#1d4ed8', // Blue 700
  },
  width: 2,
  smooth: {
    enabled: true,
    type: 'cubicBezier' as const,
    roundness: 0.5,
  },
  label: 'taught',
  font: {
    size: 11,
    color: '#6b7280',
    background: '#ffffff',
    strokeWidth: 2,
    strokeColor: '#ffffff',
  },
};

/**
 * Incarnation relationship style
 */
export const INCARNATION_EDGE_STYLE = {
  arrows: {
    to: {
      enabled: true,
      scaleFactor: 1.0,
    },
  },
  color: {
    color: '#a855f7', // Purple 500
    highlight: '#9333ea', // Purple 600
    hover: '#7e22ce', // Purple 700
  },
  width: 3,
  dashes: [10, 5],
  smooth: {
    enabled: true,
    type: 'cubicBezier' as const,
    roundness: 0.6,
  },
  label: 'incarnation',
  font: {
    size: 12,
    color: '#7e22ce',
    background: '#ffffff',
    strokeWidth: 2,
    strokeColor: '#ffffff',
    bold: true,
  },
};

/**
 * Transmission relationship style
 */
export const TRANSMISSION_EDGE_STYLE = {
  arrows: {
    to: {
      enabled: true,
      scaleFactor: 0.9,
    },
  },
  color: {
    color: '#f59e0b', // Amber 500
    highlight: '#d97706', // Amber 600
    hover: '#b45309', // Amber 700
  },
  width: 2.5,
  smooth: {
    enabled: true,
    type: 'cubicBezier' as const,
    roundness: 0.5,
  },
  label: 'transmitted',
  font: {
    size: 11,
    color: '#92400e',
    background: '#ffffff',
    strokeWidth: 2,
    strokeColor: '#ffffff',
  },
};

/**
 * Get edge style based on relationship predicate
 */
export function getEdgeStyle(predicate: string) {
  switch (predicate) {
    case 'teacher_of':
    case 'student_of':
      return TEACHER_EDGE_STYLE;
    case 'incarnation_of':
      return INCARNATION_EDGE_STYLE;
    case 'transmitted_to':
    case 'received_transmission':
    case 'gave_empowerment':
      return TRANSMISSION_EDGE_STYLE;
    default:
      return {
        ...TEACHER_EDGE_STYLE,
        color: {
          color: '#6b7280',
          highlight: '#4b5563',
          hover: '#374151',
        },
        label: predicate.replace(/_/g, ' '),
      };
  }
}

/**
 * Get edge width based on confidence
 */
export function getEdgeWidth(confidence: number): number {
  if (confidence >= 0.9) return 3;
  if (confidence >= 0.7) return 2;
  return 1;
}

// ============================================================================
// Interaction Configuration
// ============================================================================

/**
 * Common interaction options
 */
export const INTERACTION_OPTIONS = {
  hover: true,
  tooltipDelay: 200,
  navigationButtons: true,
  keyboard: {
    enabled: true,
    bindToWindow: false,
  },
  zoomView: true,
  dragView: true,
  dragNodes: true,
  multiselect: false,
};

/**
 * Export configuration
 */
export const EXPORT_OPTIONS = {
  png: {
    format: 'image/png' as const,
    quality: 1.0,
  },
  svg: {
    format: 'image/svg+xml' as const,
  },
};
