/**
 * Force Simulation Utilities
 *
 * D3.js force-directed graph physics configuration and utilities.
 * Provides optimized force simulation for network visualization.
 */

import * as d3 from 'd3';
import type { D3Node, D3Link } from '@/types/network';
import { FORCE_PARAMS, NODE_RADIUS } from '@/types/network';

// ============================================================================
// Force Simulation Creation
// ============================================================================

export function createForceSimulation(
  nodes: D3Node[],
  links: D3Link[],
  width: number,
  height: number
): d3.Simulation<D3Node, D3Link> {
  const simulation = d3.forceSimulation<D3Node>(nodes)
    .force('link', d3.forceLink<D3Node, D3Link>(links)
      .id((d: D3Node) => d.id)
      .distance(FORCE_PARAMS.LINK_DISTANCE)
      .strength(FORCE_PARAMS.LINK_STRENGTH)
    )
    .force('charge', d3.forceManyBody<D3Node>()
      .strength(FORCE_PARAMS.CHARGE_STRENGTH)
      .distanceMax(FORCE_PARAMS.CHARGE_DISTANCE)
    )
    .force('center', d3.forceCenter<D3Node>(width / 2, height / 2))
    .force('collision', d3.forceCollide<D3Node>()
      .radius((d: D3Node) => d.radius + FORCE_PARAMS.COLLISION_PADDING)
      .iterations(2)
    )
    .alphaDecay(FORCE_PARAMS.ALPHA_DECAY)
    .velocityDecay(FORCE_PARAMS.VELOCITY_DECAY);

  return simulation;
}

// ============================================================================
// Node Radius Calculation
// ============================================================================

export function calculateNodeRadius(
  node: D3Node,
  sizeMode: 'equal' | 'degree' | 'influence'
): number {
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

// ============================================================================
// Graph Metrics Calculation
// ============================================================================

export function calculateDegree(nodeId: string, links: D3Link[]): number {
  return links.filter(
    link => link.source.id === nodeId || link.target.id === nodeId
  ).length;
}

export function calculateInfluence(node: D3Node, links: D3Link[]): number {
  // Simple PageRank-like metric: combination of degree and confidence
  const degree = calculateDegree(node.id, links);
  const confidence = node.entity.confidence;

  // Weighted average
  return (degree / 10) * 0.7 + confidence * 0.3;
}

export function calculateAllMetrics(nodes: D3Node[], links: D3Link[]): void {
  nodes.forEach(node => {
    node.degree = calculateDegree(node.id, links);
    node.influence = calculateInfluence(node, links);
  });
}

// ============================================================================
// Community Detection (simplified)
// ============================================================================

export function assignCommunities(nodes: D3Node[], links: D3Link[]): void {
  // Simple connected components algorithm
  const visited = new Set<string>();
  let communityId = 0;

  nodes.forEach(node => {
    if (!visited.has(node.id)) {
      // BFS to find connected component
      const queue = [node];
      visited.add(node.id);
      node.community = communityId;

      while (queue.length > 0) {
        const current = queue.shift()!;

        // Find neighbors
        links.forEach(link => {
          let neighbor: D3Node | null = null;

          if (link.source.id === current.id) {
            neighbor = link.target;
          } else if (link.target.id === current.id) {
            neighbor = link.source;
          }

          if (neighbor && !visited.has(neighbor.id)) {
            visited.add(neighbor.id);
            neighbor.community = communityId;
            queue.push(neighbor);
          }
        });
      }

      communityId++;
    }
  });
}

// ============================================================================
// Path Finding
// ============================================================================

export interface PathResult {
  nodes: D3Node[];
  links: D3Link[];
}

export function findShortestPath(
  startId: string,
  endId: string,
  nodes: D3Node[],
  links: D3Link[]
): PathResult | null {
  const nodeMap = new Map(nodes.map(n => [n.id, n]));
  const linkMap = new Map<string, D3Link[]>();

  // Build adjacency list
  links.forEach(link => {
    const sourceId = link.source.id;
    const targetId = link.target.id;

    if (!linkMap.has(sourceId)) linkMap.set(sourceId, []);
    if (!linkMap.has(targetId)) linkMap.set(targetId, []);

    linkMap.get(sourceId)!.push(link);
    linkMap.get(targetId)!.push(link);
  });

  // BFS to find shortest path
  const queue: string[] = [startId];
  const visited = new Set<string>([startId]);
  const parent = new Map<string, { nodeId: string; link: D3Link }>();

  while (queue.length > 0) {
    const currentId = queue.shift()!;

    if (currentId === endId) {
      // Reconstruct path
      const pathNodes: D3Node[] = [];
      const pathLinks: D3Link[] = [];
      let current = endId;

      while (current !== startId) {
        pathNodes.unshift(nodeMap.get(current)!);
        const prev = parent.get(current)!;
        pathLinks.unshift(prev.link);
        current = prev.nodeId;
      }
      pathNodes.unshift(nodeMap.get(startId)!);

      return { nodes: pathNodes, links: pathLinks };
    }

    // Explore neighbors
    const neighbors = linkMap.get(currentId) || [];
    neighbors.forEach(link => {
      const nextId = link.source.id === currentId ? link.target.id : link.source.id;

      if (!visited.has(nextId)) {
        visited.add(nextId);
        parent.set(nextId, { nodeId: currentId, link });
        queue.push(nextId);
      }
    });
  }

  return null; // No path found
}

// ============================================================================
// Zoom and Pan Utilities
// ============================================================================

export function createZoomBehavior(
  svgSelection: d3.Selection<SVGSVGElement, unknown, null, undefined>,
  graphGroup: d3.Selection<SVGGElement, unknown, null, undefined>
): d3.ZoomBehavior<SVGSVGElement, unknown> {
  const zoom = d3.zoom<SVGSVGElement, unknown>()
    .scaleExtent([0.1, 4])
    .on('zoom', (event) => {
      graphGroup.attr('transform', event.transform);
    });

  svgSelection.call(zoom);

  return zoom;
}

export function resetZoom(
  svgSelection: d3.Selection<SVGSVGElement, unknown, null, undefined>,
  zoom: d3.ZoomBehavior<SVGSVGElement, unknown>
): void {
  svgSelection
    .transition()
    .duration(750)
    .call(zoom.transform, d3.zoomIdentity);
}

export function zoomToNode(
  svgSelection: d3.Selection<SVGSVGElement, unknown, null, undefined>,
  zoom: d3.ZoomBehavior<SVGSVGElement, unknown>,
  node: D3Node,
  width: number,
  height: number
): void {
  const scale = 1.5;
  const x = width / 2 - node.x! * scale;
  const y = height / 2 - node.y! * scale;

  svgSelection
    .transition()
    .duration(750)
    .call(
      zoom.transform,
      d3.zoomIdentity.translate(x, y).scale(scale)
    );
}

// ============================================================================
// Label Utilities
// ============================================================================

export function truncateLabel(label: string, maxRadius: number): string {
  const maxLength = Math.floor(maxRadius / 4);
  if (label.length <= maxLength) return label;
  return label.substring(0, maxLength - 1) + '…';
}

export function getDisplayLabel(node: D3Node): string {
  return node.entity.canonicalName;
}

// ============================================================================
// Drag Behavior
// ============================================================================

export function createDragBehavior(
  simulation: d3.Simulation<D3Node, D3Link>
): d3.DragBehavior<SVGGElement, D3Node, D3Node> {
  function dragStarted(event: d3.D3DragEvent<SVGGElement, D3Node, D3Node>) {
    if (!event.active) simulation.alphaTarget(0.3).restart();
    event.subject.fx = event.subject.x;
    event.subject.fy = event.subject.y;
  }

  function dragged(event: d3.D3DragEvent<SVGGElement, D3Node, D3Node>) {
    event.subject.fx = event.x;
    event.subject.fy = event.y;
  }

  function dragEnded(event: d3.D3DragEvent<SVGGElement, D3Node, D3Node>) {
    if (!event.active) simulation.alphaTarget(0);
    // Keep node fixed after drag
    // Uncomment next lines to release node:
    // event.subject.fx = null;
    // event.subject.fy = null;
  }

  return d3.drag<SVGGElement, D3Node, D3Node>()
    .on('start', dragStarted)
    .on('drag', dragged)
    .on('end', dragEnded);
}
