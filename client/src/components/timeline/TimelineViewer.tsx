/**
 * TimelineViewer Component
 *
 * Main timeline visualization using vis.js Timeline library
 */

import { useEffect, useRef, useState } from 'react';
import { Timeline } from 'vis-timeline/standalone';
import { DataSet } from 'vis-data';
import type { TimelineItem, TimelineGroup } from '@/hooks/useTimeline';
import { TIMELINE_OPTIONS } from '@/lib/timelineConfig';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';

// ============================================================================
// TYPES
// ============================================================================

export interface TimelineViewerProps {
  items: TimelineItem[];
  groups: TimelineGroup[];
  isLoading?: boolean;
  error?: Error | null;
  onItemClick?: (entity: any) => void;
  onRangeChange?: (start: Date, end: Date) => void;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function TimelineViewer({
  items,
  groups,
  isLoading = false,
  error = null,
  onItemClick,
  onRangeChange
}: TimelineViewerProps) {
  const timelineRef = useRef<HTMLDivElement>(null);
  const timelineInstance = useRef<Timeline | null>(null);
  const itemsDataSet = useRef<DataSet<any> | null>(null);
  const groupsDataSet = useRef<DataSet<any> | null>(null);

  // ============================================================================
  // INITIALIZATION
  // ============================================================================

  useEffect(() => {
    if (!timelineRef.current) return;

    // Create DataSets
    itemsDataSet.current = new DataSet<any>([]);
    groupsDataSet.current = new DataSet<any>([]);

    // Create Timeline instance
    timelineInstance.current = new Timeline(
      timelineRef.current,
      itemsDataSet.current,
      groupsDataSet.current,
      TIMELINE_OPTIONS
    );

    // Setup event listeners
    if (onItemClick) {
      timelineInstance.current.on('select', handleItemSelect);
    }

    if (onRangeChange) {
      timelineInstance.current.on('rangechanged', handleRangeChange);
    }

    // Cleanup
    return () => {
      if (timelineInstance.current) {
        timelineInstance.current.destroy();
        timelineInstance.current = null;
      }
    };
  }, []);

  // ============================================================================
  // DATA UPDATES
  // ============================================================================

  // Update items when they change
  useEffect(() => {
    if (!itemsDataSet.current) return;

    // Clear and add new items
    itemsDataSet.current.clear();
    if (items.length > 0) {
      itemsDataSet.current.add(items);
    }
  }, [items]);

  // Update groups when they change
  useEffect(() => {
    if (!groupsDataSet.current) return;

    // Clear and add new groups
    groupsDataSet.current.clear();
    if (groups.length > 0) {
      groupsDataSet.current.add(groups);
    }
  }, [groups]);

  // ============================================================================
  // EVENT HANDLERS
  // ============================================================================

  function handleItemSelect(properties: any) {
    if (!onItemClick) return;

    const { items: selectedItems } = properties;
    if (selectedItems && selectedItems.length > 0) {
      const itemId = selectedItems[0];
      const itemData = itemsDataSet.current?.get(itemId);
      // DataSet.get() returns an array when called with a single id in vis-data
      const item = (Array.isArray(itemData) ? itemData[0] : itemData) as TimelineItem;
      if (item && item.entity) {
        onItemClick(item.entity);
      }
    }
  }

  function handleRangeChange(properties: any) {
    if (!onRangeChange) return;

    const { start, end } = properties;
    if (start && end) {
      onRangeChange(start, end);
    }
  }

  // ============================================================================
  // PUBLIC METHODS (exposed via ref)
  // ============================================================================

  // These methods can be called from parent components via ref
  const zoomIn = () => {
    timelineInstance.current?.zoomIn(0.5);
  };

  const zoomOut = () => {
    timelineInstance.current?.zoomOut(0.5);
  };

  const fit = () => {
    timelineInstance.current?.fit();
  };

  const moveTo = (date: Date) => {
    timelineInstance.current?.moveTo(date);
  };

  const setWindow = (start: Date, end: Date) => {
    timelineInstance.current?.setWindow(start, end);
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  // Loading state
  if (isLoading) {
    return (
      <div className="timeline-loading space-y-3">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-8 w-full" />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>
          Failed to load timeline: {error.message}
        </AlertDescription>
      </Alert>
    );
  }

  // Empty state
  if (items.length === 0 && !isLoading) {
    return (
      <Alert>
        <AlertDescription>
          No entities found for the selected time range and filters.
          Try adjusting your filters or time range.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="timeline-viewer-container">
      <div
        ref={timelineRef}
        className="timeline-canvas"
        style={{ height: '600px', width: '100%' }}
      />
      <div className="timeline-info text-sm text-muted-foreground mt-2">
        Showing {items.length} entities across {groups.length} categories
      </div>
    </div>
  );
}

// Export methods for parent components to call
export type TimelineViewerRef = {
  zoomIn: () => void;
  zoomOut: () => void;
  fit: () => void;
  moveTo: (date: Date) => void;
  setWindow: (start: Date, end: Date) => void;
};
