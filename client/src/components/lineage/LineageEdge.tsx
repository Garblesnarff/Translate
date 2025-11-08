/**
 * LineageEdge
 *
 * Utilities for creating and styling vis-network edges representing relationships
 * in the lineage graph (teacher-student, incarnation, transmission, etc.)
 */

import type { Relationship } from '../../hooks/useLineage';
import type { NetworkEdge } from '../../lib/networkConfig';
import {
  TEACHER_EDGE_STYLE,
  INCARNATION_EDGE_STYLE,
  TRANSMISSION_EDGE_STYLE,
  getEdgeStyle,
  getEdgeWidth,
} from '../../lib/networkConfig';

// ============================================================================
// Edge Creation
// ============================================================================

/**
 * Create a vis-network edge from a relationship
 */
export function createEdgeData(relationship: Relationship): NetworkEdge {
  const baseStyle = getEdgeStyle(relationship.predicate);
  const width = getEdgeWidth(relationship.confidence);

  const edge: NetworkEdge = {
    id: relationship.id,
    from: relationship.subject_id,
    to: relationship.object_id,
    ...baseStyle,
    width,
    title: createEdgeTooltip(relationship),
    _relationship: relationship, // Store full relationship data
  };

  // Ensure smooth has enabled property if it exists
  if (edge.smooth && typeof edge.smooth === 'object' && !('enabled' in edge.smooth)) {
    edge.smooth = {
      enabled: true,
      ...(edge.smooth as any),
    };
  }

  return edge;
}

// ============================================================================
// Edge Label Formatting
// ============================================================================

/**
 * Get human-readable label for relationship predicate
 */
export function getRelationshipLabel(predicate: string): string {
  const labels: Record<string, string> = {
    teacher_of: 'taught',
    student_of: 'student',
    incarnation_of: 'incarnation',
    transmitted_to: 'transmitted',
    received_transmission: 'received',
    gave_empowerment: 'empowerment',
    wrote: 'wrote',
    translated: 'translated',
    compiled: 'compiled',
    lived_at: 'lived at',
    visited: 'visited',
    founded: 'founded',
    born_in: 'born in',
    died_in: 'died in',
    attended: 'attended',
    organized: 'organized',
    sponsored: 'sponsored',
    member_of: 'member',
    abbot_of: 'abbot',
    patron_of: 'patron',
    commentary_on: 'commentary',
    cites: 'cites',
    part_of: 'part of',
    contains: 'contains',
    mentions: 'mentions',
    debated_with: 'debated',
    refuted: 'refuted',
    agreed_with: 'agreed',
    parent_of: 'parent',
    child_of: 'child',
    sibling_of: 'sibling',
    spouse_of: 'spouse',
    within: 'within',
    near: 'near',
    practiced: 'practiced',
    held_view: 'held view',
    taught_concept: 'taught',
    preceded: 'preceded',
    followed: 'followed',
    contemporary_with: 'contemporary',
  };

  return labels[predicate] || predicate.replace(/_/g, ' ');
}

// ============================================================================
// Tooltip Creation
// ============================================================================

/**
 * Create HTML tooltip for edge hover
 */
export function createEdgeTooltip(relationship: Relationship): string {
  const parts: string[] = [];

  // Relationship type
  parts.push(`<div style="font-weight: bold; font-size: 13px; margin-bottom: 6px;">`);
  parts.push(getRelationshipLabel(relationship.predicate));
  parts.push(`</div>`);

  // Properties (if any)
  if (relationship.properties) {
    const props = relationship.properties;

    // Date/year
    if (props.year || props.date) {
      parts.push(`<div style="font-size: 12px; color: #374151; margin-bottom: 4px;">`);
      parts.push(`📅 ${props.year || props.date}`);
      parts.push(`</div>`);
    }

    // Location
    if (props.location) {
      parts.push(`<div style="font-size: 12px; color: #374151; margin-bottom: 4px;">`);
      parts.push(`📍 ${props.location}`);
      parts.push(`</div>`);
    }

    // Duration
    if (props.duration) {
      parts.push(`<div style="font-size: 12px; color: #374151; margin-bottom: 4px;">`);
      parts.push(`⏱️ ${props.duration}`);
      parts.push(`</div>`);
    }

    // Notes
    if (props.notes) {
      parts.push(`<div style="font-size: 11px; color: #6b7280; margin-top: 6px; font-style: italic;">`);
      parts.push(truncateText(props.notes, 100));
      parts.push(`</div>`);
    }
  }

  // Confidence indicator
  const confidencePercent = Math.round(relationship.confidence * 100);
  const confidenceColor =
    relationship.confidence >= 0.9 ? '#059669' :
    relationship.confidence >= 0.7 ? '#ca8a04' :
    '#dc2626';

  parts.push(`<div style="margin-top: 8px; padding-top: 6px; border-top: 1px solid #e5e7eb; font-size: 11px;">`);
  parts.push(`<span style="color: ${confidenceColor};">●</span> ${confidencePercent}% confidence`);
  if (relationship.verified) {
    parts.push(` <span style="color: #059669;">✓ verified</span>`);
  }
  parts.push(`</div>`);

  return `<div style="padding: 6px; max-width: 250px; line-height: 1.4;">${parts.join('')}</div>`;
}

/**
 * Truncate text to max length
 */
function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}

// ============================================================================
// Edge Color Utilities
// ============================================================================

/**
 * Get edge color based on relationship predicate
 */
export function getRelationshipColor(predicate: string): string {
  // Teacher-student (blue)
  if (predicate === 'teacher_of' || predicate === 'student_of') {
    return '#3b82f6';
  }

  // Incarnation (purple)
  if (predicate === 'incarnation_of') {
    return '#a855f7';
  }

  // Transmission (amber)
  if (
    predicate === 'transmitted_to' ||
    predicate === 'received_transmission' ||
    predicate === 'gave_empowerment'
  ) {
    return '#f59e0b';
  }

  // Authorship (green)
  if (predicate === 'wrote' || predicate === 'translated' || predicate === 'compiled') {
    return '#10b981';
  }

  // Spatial (teal)
  if (
    predicate === 'lived_at' ||
    predicate === 'visited' ||
    predicate === 'founded' ||
    predicate === 'born_in' ||
    predicate === 'died_in'
  ) {
    return '#14b8a6';
  }

  // Institutional (indigo)
  if (predicate === 'member_of' || predicate === 'abbot_of' || predicate === 'patron_of') {
    return '#6366f1';
  }

  // Textual (cyan)
  if (
    predicate === 'commentary_on' ||
    predicate === 'cites' ||
    predicate === 'part_of' ||
    predicate === 'contains' ||
    predicate === 'mentions'
  ) {
    return '#06b6d4';
  }

  // Family (pink)
  if (
    predicate === 'parent_of' ||
    predicate === 'child_of' ||
    predicate === 'sibling_of' ||
    predicate === 'spouse_of'
  ) {
    return '#ec4899';
  }

  // Conceptual (violet)
  if (predicate === 'practiced' || predicate === 'held_view' || predicate === 'taught_concept') {
    return '#8b5cf6';
  }

  // Default (gray)
  return '#6b7280';
}

// ============================================================================
// Edge Style Variations
// ============================================================================

/**
 * Check if edge should be dashed
 */
export function shouldUseDashes(predicate: string): boolean {
  // Incarnation relationships use dashes
  if (predicate === 'incarnation_of') return true;

  // Uncertain/inferred relationships (if marked in properties)
  return false;
}

/**
 * Get arrow configuration for relationship direction
 */
export function getArrowConfig(predicate: string) {
  // Bidirectional relationships
  const bidirectional = ['contemporary_with', 'debated_with', 'sibling_of'];
  if (bidirectional.includes(predicate)) {
    return {
      to: { enabled: true, scaleFactor: 0.8 },
      from: { enabled: true, scaleFactor: 0.8 },
    };
  }

  // Standard directed arrow
  return {
    to: { enabled: true, scaleFactor: 0.8 },
  };
}

// ============================================================================
// Edge Filtering
// ============================================================================

/**
 * Filter edges by predicate types
 */
export function filterEdgesByType(
  edges: NetworkEdge[],
  predicateTypes: string[]
): NetworkEdge[] {
  if (predicateTypes.length === 0) return edges;

  return edges.filter(edge => {
    const rel = edge._relationship;
    return rel && predicateTypes.includes(rel.predicate);
  });
}

/**
 * Filter edges by confidence threshold
 */
export function filterEdgesByConfidence(
  edges: NetworkEdge[],
  minConfidence: number
): NetworkEdge[] {
  return edges.filter(edge => {
    const rel = edge._relationship;
    return rel && rel.confidence >= minConfidence;
  });
}

// ============================================================================
// Edge Grouping
// ============================================================================

/**
 * Group edges by predicate type for legend/filtering
 */
export function groupEdgesByType(edges: NetworkEdge[]): Map<string, NetworkEdge[]> {
  const groups = new Map<string, NetworkEdge[]>();

  edges.forEach(edge => {
    const rel = edge._relationship;
    if (!rel) return;

    const predicate = rel.predicate;
    if (!groups.has(predicate)) {
      groups.set(predicate, []);
    }
    groups.get(predicate)!.push(edge);
  });

  return groups;
}

/**
 * Get edge type statistics
 */
export function getEdgeTypeStats(edges: NetworkEdge[]): Array<{
  predicate: string;
  count: number;
  avgConfidence: number;
  color: string;
}> {
  const groups = groupEdgesByType(edges);
  const stats: Array<{
    predicate: string;
    count: number;
    avgConfidence: number;
    color: string;
  }> = [];

  groups.forEach((groupEdges, predicate) => {
    const avgConfidence =
      groupEdges.reduce((sum, edge) => sum + (edge._relationship?.confidence || 0), 0) /
      groupEdges.length;

    stats.push({
      predicate,
      count: groupEdges.length,
      avgConfidence,
      color: getRelationshipColor(predicate),
    });
  });

  return stats.sort((a, b) => b.count - a.count);
}
