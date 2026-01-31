/**
 * Lineage Components
 *
 * Export all lineage visualization components for easy import.
 */

export { LineageVisualizer, useNetworkControls } from './LineageVisualizer';
export { LineageControls, CompactLineageControls } from './LineageControls';
export { LineageSearch, CompactLineageSearch } from './LineageSearch';
export { LineageNodeDetails, CompactLineageNodeDetails } from './LineageNodeDetails';
export {
  createNodeData,
  formatPersonName,
  getShortName,
  createTooltipHTML,
  getNodeSize,
  setNodeExpanded,
  setNodeSelected,
  resetNodeState,
} from './LineageNode';
export {
  createEdgeData,
  getRelationshipLabel,
  createEdgeTooltip,
  getRelationshipColor,
  shouldUseDashes,
  getArrowConfig,
  filterEdgesByType,
  filterEdgesByConfidence,
  groupEdgesByType,
  getEdgeTypeStats,
} from './LineageEdge';

export type { LineageVisualizerProps, VisNetwork } from './LineageVisualizer';
export type {
  LineageControlsProps,
  CompactLineageControlsProps,
  LayoutMode,
} from './LineageControls';
export type {
  LineageSearchProps,
  CompactLineageSearchProps,
  SearchResult,
} from './LineageSearch';
export type {
  LineageNodeDetailsProps,
  CompactLineageNodeDetailsProps,
} from './LineageNodeDetails';
