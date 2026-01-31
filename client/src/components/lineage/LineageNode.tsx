/**
 * LineageNode
 *
 * Utilities for creating and styling vis-network nodes representing entities
 * in the lineage graph (people, places, texts, etc.)
 */

import type { Entity } from '../../hooks/useLineage';
import type { NetworkNode } from '../../lib/networkConfig';
import {
  BASE_NODE_STYLE,
  EXPANDED_NODE_STYLE,
  SELECTED_NODE_STYLE,
  ROOT_NODE_STYLE,
  IMPORTANT_NODE_STYLE,
  getTraditionColor,
  getBorderColor,
} from '../../lib/networkConfig';

// ============================================================================
// Node Creation
// ============================================================================

/**
 * Create a vis-network node from an entity
 */
export function createNodeData(
  entity: Entity,
  options: {
    isRoot?: boolean;
    isExpanded?: boolean;
    isSelected?: boolean;
  } = {}
): NetworkNode {
  const { isRoot = false, isExpanded = false, isSelected = false } = options;

  // Get colors based on tradition
  const colors = getTraditionColor(entity.attributes.tradition);

  // Base node configuration
  const node: NetworkNode = {
    id: entity.id,
    label: formatPersonName(entity),
    title: createTooltipHTML(entity),
    ...BASE_NODE_STYLE,
    color: {
      background: colors.background,
      border: entity.verified ? getBorderColor(entity.confidence) : colors.border,
      highlight: {
        background: '#fef3c7',
        border: '#eab308',
      },
      hover: {
        background: lightenColor(colors.background),
        border: colors.border,
      },
    },
    _entity: entity, // Store full entity data
  };

  // Apply root style
  if (isRoot) {
    Object.assign(node, ROOT_NODE_STYLE);
  }

  // Apply expanded style
  if (isExpanded) {
    node.size = EXPANDED_NODE_STYLE.size;
    node.borderWidth = EXPANDED_NODE_STYLE.borderWidth;
    if (node.font && typeof node.font === 'object') {
      node.font = { ...node.font, ...EXPANDED_NODE_STYLE.font };
    }
    node.shadow = EXPANDED_NODE_STYLE.shadow;
  }

  // Apply selected style
  if (isSelected) {
    node.color = SELECTED_NODE_STYLE.color;
    node.borderWidth = SELECTED_NODE_STYLE.borderWidth;
    node.shadow = SELECTED_NODE_STYLE.shadow;
  }

  // Apply important person style
  if (entity.attributes.is_important || entity.verified) {
    node.size = IMPORTANT_NODE_STYLE.size;
    node.borderWidth = IMPORTANT_NODE_STYLE.borderWidth;
  }

  return node;
}

// ============================================================================
// Name Formatting
// ============================================================================

/**
 * Format person name for display in node label
 * Priority: Wylie > Canonical > Tibetan
 */
export function formatPersonName(entity: Entity): string {
  // Try Wylie name first (most readable for lineage diagrams)
  if (entity.attributes.wylie_name) {
    return entity.attributes.wylie_name;
  }

  // Fallback to canonical name
  if (entity.canonical_name) {
    return entity.canonical_name;
  }

  // Last resort: first English name variant
  if (entity.names.english && entity.names.english.length > 0) {
    return entity.names.english[0];
  }

  // Very last resort: first Tibetan name
  if (entity.names.tibetan && entity.names.tibetan.length > 0) {
    return entity.names.tibetan[0];
  }

  return 'Unknown';
}

/**
 * Get short display name (for compact views)
 */
export function getShortName(entity: Entity): string {
  const fullName = formatPersonName(entity);

  // If name is too long, truncate intelligently
  if (fullName.length > 20) {
    // Try to get first and last word
    const words = fullName.split(/\s+/);
    if (words.length > 2) {
      return `${words[0]} ${words[words.length - 1]}`;
    }
    return fullName.substring(0, 18) + '...';
  }

  return fullName;
}

// ============================================================================
// Tooltip Creation
// ============================================================================

/**
 * Create HTML tooltip for node hover
 */
export function createTooltipHTML(entity: Entity): string {
  const parts: string[] = [];

  // Name section
  parts.push(`<div style="font-weight: bold; font-size: 14px; margin-bottom: 8px;">`);
  parts.push(entity.canonical_name || 'Unknown');
  parts.push(`</div>`);

  // Tibetan name
  if (entity.attributes.tibetan_name) {
    parts.push(`<div style="font-size: 18px; margin-bottom: 4px; font-family: 'Jomolhari', serif;">`);
    parts.push(entity.attributes.tibetan_name);
    parts.push(`</div>`);
  }

  // Wylie transliteration
  if (entity.attributes.wylie_name) {
    parts.push(`<div style="font-size: 12px; color: #6b7280; margin-bottom: 8px; font-style: italic;">`);
    parts.push(entity.attributes.wylie_name);
    parts.push(`</div>`);
  }

  // Dates
  const birthYear = entity.attributes.birth_year;
  const deathYear = entity.attributes.death_year;
  if (birthYear || deathYear) {
    parts.push(`<div style="font-size: 12px; color: #374151; margin-bottom: 4px;">`);
    parts.push(`📅 ${birthYear || '?'} - ${deathYear || '?'}`);
    parts.push(`</div>`);
  }

  // Tradition
  if (entity.attributes.tradition && entity.attributes.tradition.length > 0) {
    parts.push(`<div style="font-size: 12px; color: #374151; margin-bottom: 4px;">`);
    parts.push(`🏛️ ${entity.attributes.tradition.join(', ')}`);
    parts.push(`</div>`);
  }

  // Roles
  if (entity.attributes.roles && entity.attributes.roles.length > 0) {
    parts.push(`<div style="font-size: 11px; color: #6b7280;">`);
    parts.push(`${entity.attributes.roles.join(', ')}`);
    parts.push(`</div>`);
  }

  // Confidence indicator
  const confidencePercent = Math.round(entity.confidence * 100);
  const confidenceColor = entity.confidence >= 0.9 ? '#059669' : entity.confidence >= 0.7 ? '#ca8a04' : '#dc2626';
  parts.push(`<div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid #e5e7eb; font-size: 11px;">`);
  parts.push(`<span style="color: ${confidenceColor};">●</span> ${confidencePercent}% confidence`);
  if (entity.verified) {
    parts.push(` <span style="color: #059669;">✓ verified</span>`);
  }
  parts.push(`</div>`);

  return `<div style="padding: 8px; max-width: 300px; line-height: 1.4;">${parts.join('')}</div>`;
}

// ============================================================================
// Node Size Calculation
// ============================================================================

/**
 * Calculate node size based on entity importance
 */
export function getNodeSize(entity: Entity): number {
  let size = BASE_NODE_STYLE.size;

  // Increase size for verified entities
  if (entity.verified) {
    size += 5;
  }

  // Increase size for high confidence
  if (entity.confidence >= 0.9) {
    size += 3;
  }

  // Increase size for important people
  if (entity.attributes.is_important) {
    size += 8;
  }

  return Math.min(size, 50); // Cap at 50
}

// ============================================================================
// Color Utilities
// ============================================================================

/**
 * Lighten a hex color by a percentage
 */
function lightenColor(color: string, percent: number = 20): string {
  const num = parseInt(color.replace('#', ''), 16);
  const amt = Math.round(2.55 * percent);
  const R = Math.min(255, (num >> 16) + amt);
  const G = Math.min(255, ((num >> 8) & 0x00ff) + amt);
  const B = Math.min(255, (num & 0x0000ff) + amt);
  return `#${(0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1)}`;
}

// ============================================================================
// Node State Management
// ============================================================================

/**
 * Update node to expanded state
 */
export function setNodeExpanded(node: NetworkNode): NetworkNode {
  const updatedNode: NetworkNode = {
    ...node,
    size: EXPANDED_NODE_STYLE.size,
    borderWidth: EXPANDED_NODE_STYLE.borderWidth,
    shadow: EXPANDED_NODE_STYLE.shadow,
  };

  if (node.font && typeof node.font === 'object') {
    updatedNode.font = { ...node.font, ...EXPANDED_NODE_STYLE.font };
  }

  return updatedNode;
}

/**
 * Update node to selected state
 */
export function setNodeSelected(node: NetworkNode): NetworkNode {
  return {
    ...node,
    color: SELECTED_NODE_STYLE.color,
    borderWidth: SELECTED_NODE_STYLE.borderWidth,
    shadow: SELECTED_NODE_STYLE.shadow,
  };
}

/**
 * Reset node to default state
 */
export function resetNodeState(entity: Entity): NetworkNode {
  return createNodeData(entity);
}
