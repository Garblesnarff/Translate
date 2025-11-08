/**
 * Network Graph Types
 *
 * Type definitions for the force-directed network graph visualization.
 * Based on D3.js force simulation and Neo4j graph query responses.
 */

import type { SimulationNodeDatum, SimulationLinkDatum } from 'd3';

// ============================================================================
// API Response Types (matching server)
// ============================================================================

export interface Entity {
  id: string;
  type: string;
  canonicalName: string;
  names: {
    tibetan?: string[];
    english?: string[];
    phonetic?: string[];
    wylie?: string[];
  };
  attributes: {
    tradition?: string[];
    birth?: any;
    death?: any;
    location?: string;
    [key: string]: any;
  };
  dates?: any;
  confidence: number;
  verified: boolean;
}

export interface Relationship {
  id: string;
  subjectId: string;
  predicate: string;
  objectId: string;
  confidence: number;
  properties?: {
    date?: any;
    location?: string;
    [key: string]: any;
  };
}

export interface NetworkResponse {
  centerNode: Entity;
  nodes: Entity[];
  edges: Relationship[];
  statistics: {
    nodeCount: number;
    edgeCount: number;
    avgConfidence: number;
  };
}

// ============================================================================
// D3 Node Types
// ============================================================================

export interface D3Node extends SimulationNodeDatum {
  id: string;
  entity: Entity;
  x: number;
  y: number;
  fx?: number | null; // Fixed position
  fy?: number | null;
  vx?: number;
  vy?: number;

  // Visual properties
  radius: number;
  color: string;
  label: string;

  // State
  selected: boolean;
  highlighted: boolean;
  expanded: boolean;

  // Graph metrics
  degree: number;
  influence: number;
  community?: number;
}

export interface D3Link extends SimulationLinkDatum<D3Node> {
  id: string;
  source: D3Node;
  target: D3Node;
  predicate: string;
  confidence: number;
  properties?: Record<string, any>;

  // Visual state
  showLabel: boolean;
  highlighted: boolean;
}

// ============================================================================
// Network State
// ============================================================================

export interface NetworkState {
  nodes: D3Node[];
  links: D3Link[];
  centerNodeId: string;

  // Selection
  selectedNodeId: string | null;
  highlightedNodeIds: Set<string>;
  highlightedLinkIds: Set<string>;

  // Expansion tracking
  expandedNodeIds: Set<string>;

  // Search
  searchQuery: string;
  searchResults: D3Node[];
}

// ============================================================================
// Visualization Options
// ============================================================================

export type ColorMode = 'tradition' | 'entity_type' | 'community';
export type SizeMode = 'equal' | 'degree' | 'influence';

export interface NetworkOptions {
  depth: number;
  relationshipTypes: string[];
  entityTypes: string[];
  minConfidence: number;

  // Visual encoding
  colorMode: ColorMode;
  sizeMode: SizeMode;

  // Physics
  isPaused: boolean;

  // Interaction
  showLabels: boolean;
  showRelationshipLabels: boolean;
}

// ============================================================================
// Color Palettes
// ============================================================================

export const TRADITION_COLORS: Record<string, string> = {
  'Nyingma': '#dc2626', // red-600
  'Kagyu': '#0891b2', // cyan-600
  'Sakya': '#7c3aed', // violet-600
  'Gelug': '#eab308', // yellow-500
  'Bon': '#16a34a', // green-600
  'Rimé': '#f97316', // orange-500
  'Unknown': '#6b7280', // gray-500
};

export const ENTITY_TYPE_COLORS: Record<string, string> = {
  'person': '#3b82f6', // blue-500
  'place': '#10b981', // emerald-500
  'text': '#f59e0b', // amber-500
  'event': '#8b5cf6', // violet-500
  'lineage': '#ec4899', // pink-500
  'concept': '#06b6d4', // cyan-500
  'institution': '#14b8a6', // teal-500
  'deity': '#f43f5e', // rose-500
};

export const COMMUNITY_COLORS = [
  '#3b82f6', // blue
  '#10b981', // emerald
  '#f59e0b', // amber
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#14b8a6', // teal
  '#f43f5e', // rose
  '#84cc16', // lime
  '#f97316', // orange
];

export const RELATIONSHIP_COLORS: Record<string, string> = {
  'teacher_of': '#3b82f6', // blue-500
  'student_of': '#06b6d4', // cyan-500
  'wrote': '#f59e0b', // amber-500
  'incarnation_of': '#ec4899', // pink-500
  'lived_at': '#10b981', // emerald-500
  'belonged_to': '#8b5cf6', // violet-500
  'taught': '#14b8a6', // teal-500
  'studied': '#0ea5e9', // sky-500
  'contemporary_of': '#6366f1', // indigo-500
  'default': '#6b7280', // gray-500
};

// ============================================================================
// Constants
// ============================================================================

export const RELATIONSHIP_TYPES = [
  'teacher_of',
  'student_of',
  'wrote',
  'incarnation_of',
  'lived_at',
  'belonged_to',
  'taught',
  'studied',
  'contemporary_of',
];

export const NODE_RADIUS = {
  MIN: 10,
  DEFAULT: 20,
  MAX: 50,
};

export const FORCE_PARAMS = {
  LINK_DISTANCE: 100,
  LINK_STRENGTH: 1,
  CHARGE_STRENGTH: -300,
  CHARGE_DISTANCE: 500,
  COLLISION_PADDING: 5,
  ALPHA_DECAY: 0.02,
  VELOCITY_DECAY: 0.4,
};
