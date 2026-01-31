/**
 * Timeline Data Hook
 *
 * Fetches and transforms timeline data from graph API for vis.js timeline
 */

import { useQuery } from '@tanstack/react-query';
import type { DataSet } from 'vis-data';
import {
  formatEntityName,
  getStartDate,
  getEndDate,
  getEntityStyle,
  getEntityTooltip
} from '@/lib/timelineConfig';

// ============================================================================
// TYPES
// ============================================================================

export interface TimelineFilters {
  entityTypes: string[];
  traditions: string[];
  regions: string[];
  minConfidence: number;
}

export interface TimelineItem {
  id: string;
  group: string;
  content: string;
  start: Date;
  end?: Date | null;
  className?: string;
  style?: string;
  title?: string;
  entity: any;
}

export interface TimelineGroup {
  id: string;
  content: string;
  className?: string;
  order?: number;
}

export interface UseTimelineOptions {
  startYear: number;
  endYear: number;
  filters: TimelineFilters;
  enabled?: boolean;
}

export interface UseTimelineResult {
  items: TimelineItem[];
  groups: TimelineGroup[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
  entityCount: number;
}

// ============================================================================
// API FUNCTIONS
// ============================================================================

/**
 * Fetch timeline data from graph API
 */
async function fetchTimelineData(
  startYear: number,
  endYear: number,
  filters: TimelineFilters
): Promise<any[]> {
  const params = new URLSearchParams({
    start: startYear.toString(),
    end: endYear.toString()
  });

  // Add entity type filters
  if (filters.entityTypes.length > 0) {
    params.append('entityTypes', filters.entityTypes.join(','));
  }

  // Add tradition filter
  if (filters.traditions.length > 0) {
    params.append('tradition', filters.traditions.join(','));
  }

  // Note: The API might not support all filters, we'll filter client-side if needed
  const response = await fetch(`/api/graph/timeline?${params.toString()}`);

  if (!response.ok) {
    throw new Error(`Failed to fetch timeline: ${response.statusText}`);
  }

  const data = await response.json();
  return data.entities || data || [];
}

// ============================================================================
// DATA TRANSFORMATION
// ============================================================================

/**
 * Transform API entities to vis.js timeline items
 */
function transformToTimelineItems(entities: any[]): TimelineItem[] {
  return entities.map((entity) => {
    const start = getStartDate(entity);
    const end = getEndDate(entity);

    const item: TimelineItem = {
      id: entity.id,
      group: entity.type,
      content: formatEntityName(entity),
      start: start,
      end: end,
      className: `timeline-item-${entity.type} confidence-${getConfidenceLevel(parseFloat(entity.confidence))}`,
      style: getEntityStyle(entity),
      title: getEntityTooltip(entity),
      entity: entity
    };

    return item;
  });
}

/**
 * Get confidence level classification
 */
function getConfidenceLevel(confidence: number): string {
  if (confidence >= 0.8) return 'high';
  if (confidence >= 0.5) return 'medium';
  return 'low';
}

/**
 * Filter entities by client-side filters
 */
function filterEntities(entities: any[], filters: TimelineFilters): any[] {
  return entities.filter((entity) => {
    // Filter by confidence
    const confidence = parseFloat(entity.confidence);
    if (confidence < filters.minConfidence) {
      return false;
    }

    // Filter by entity type
    if (filters.entityTypes.length > 0 && !filters.entityTypes.includes(entity.type)) {
      return false;
    }

    // Filter by tradition
    if (filters.traditions.length > 0) {
      const entityTraditions = entity.attributes?.tradition || [];
      const hasTradition = filters.traditions.some(t =>
        entityTraditions.includes(t)
      );
      if (!hasTradition) {
        return false;
      }
    }

    // Filter by region
    if (filters.regions.length > 0) {
      const entityRegions = entity.attributes?.region || [];
      const hasRegion = filters.regions.some(r =>
        entityRegions.includes(r) ||
        entity.attributes?.location?.includes(r)
      );
      if (!hasRegion) {
        return false;
      }
    }

    return true;
  });
}

// ============================================================================
// HOOK
// ============================================================================

/**
 * Timeline data fetching and transformation hook
 */
export function useTimeline(options: UseTimelineOptions): UseTimelineResult {
  const { startYear, endYear, filters, enabled = true } = options;

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['timeline', startYear, endYear, filters],
    queryFn: () => fetchTimelineData(startYear, endYear, filters),
    enabled: enabled,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)
  });

  // Transform and filter data
  const entities = data || [];
  const filteredEntities = filterEntities(entities, filters);
  const items = transformToTimelineItems(filteredEntities);

  // Create groups (unique entity types in the data)
  const groupMap = new Map<string, TimelineGroup>();
  filteredEntities.forEach((entity) => {
    if (!groupMap.has(entity.type)) {
      groupMap.set(entity.type, {
        id: entity.type,
        content: entity.type.charAt(0).toUpperCase() + entity.type.slice(1) + 's',
        className: `timeline-group-${entity.type}`,
        order: getGroupOrder(entity.type)
      });
    }
  });

  const groups = Array.from(groupMap.values()).sort((a, b) =>
    (a.order || 0) - (b.order || 0)
  );

  return {
    items,
    groups,
    isLoading,
    error: error as Error | null,
    refetch,
    entityCount: filteredEntities.length
  };
}

/**
 * Get group order for sorting
 */
function getGroupOrder(type: string): number {
  const order: Record<string, number> = {
    person: 1,
    event: 2,
    text: 3,
    place: 4,
    lineage: 5,
    institution: 6,
    concept: 7,
    deity: 8
  };
  return order[type] || 99;
}

/**
 * Hook for fetching a specific entity's timeline
 */
export function useEntityTimeline(entityId: string | null) {
  return useQuery({
    queryKey: ['entity-timeline', entityId],
    queryFn: async () => {
      if (!entityId) return null;

      const response = await fetch(`/api/graph/entity/${entityId}/timeline`);
      if (!response.ok) {
        throw new Error(`Failed to fetch entity timeline: ${response.statusText}`);
      }

      return response.json();
    },
    enabled: !!entityId,
    staleTime: 5 * 60 * 1000
  });
}
