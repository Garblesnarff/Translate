/**
 * TimelinePage Component
 *
 * Full page timeline visualization for Tibetan Buddhist history
 */

import { useState, useRef } from 'react';
import { useTimeline } from '@/hooks/useTimeline';
import type { TimelineFilters } from '@/hooks/useTimeline';
import { TimelineViewer } from '@/components/timeline/TimelineViewer';
import type { TimelineViewerRef } from '@/components/timeline/TimelineViewer';
import { TimelineFiltersPanel } from '@/components/timeline/TimelineFilters';
import { TimelineDetails } from '@/components/timeline/TimelineDetails';
import { TimelineControls } from '@/components/timeline/TimelineControls';
import { Button } from '@/components/ui/button';
import { Link } from 'wouter';
import { ArrowLeft, Info } from 'lucide-react';
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '@/components/ui/alert';

// ============================================================================
// CONSTANTS
// ============================================================================

const DEFAULT_START_YEAR = 1000;
const DEFAULT_END_YEAR = 1500;

const DEFAULT_FILTERS: TimelineFilters = {
  entityTypes: [],
  traditions: [],
  regions: [],
  minConfidence: 0
};

// ============================================================================
// COMPONENT
// ============================================================================

export default function TimelinePage() {
  // ============================================================================
  // STATE
  // ============================================================================

  const [startYear, setStartYear] = useState(DEFAULT_START_YEAR);
  const [endYear, setEndYear] = useState(DEFAULT_END_YEAR);
  const [filters, setFilters] = useState<TimelineFilters>(DEFAULT_FILTERS);
  const [selectedEntity, setSelectedEntity] = useState<any | null>(null);
  const [showFilters, setShowFilters] = useState(true);
  const [showDetails, setShowDetails] = useState(true);

  const timelineRef = useRef<TimelineViewerRef>(null);

  // ============================================================================
  // DATA FETCHING
  // ============================================================================

  const {
    items,
    groups,
    isLoading,
    error,
    refetch,
    entityCount
  } = useTimeline({
    startYear,
    endYear,
    filters
  });

  // ============================================================================
  // HANDLERS
  // ============================================================================

  const handleItemClick = (entity: any) => {
    setSelectedEntity(entity);
    setShowDetails(true);
  };

  const handleDateRangeChange = (newStart: number, newEnd: number) => {
    setStartYear(newStart);
    setEndYear(newEnd);
  };

  const handleResetFilters = () => {
    setFilters(DEFAULT_FILTERS);
  };

  const handleShowLineage = (entityId: string) => {
    // Navigate to lineage page
    window.location.href = `/lineage/${entityId}`;
  };

  const handleShowMap = (entityId: string) => {
    // Navigate to map page
    window.location.href = `/map/${entityId}`;
  };

  const handleZoomIn = () => {
    // Timeline zoom is handled internally by TimelineViewer
    // This is a placeholder for future implementation if needed
  };

  const handleZoomOut = () => {
    // Timeline zoom is handled internally by TimelineViewer
    // This is a placeholder for future implementation if needed
  };

  const handleFit = () => {
    // Timeline fit is handled internally by TimelineViewer
    // This is a placeholder for future implementation if needed
  };

  const handleJumpToDate = (date: Date) => {
    // Timeline moveTo is handled internally by TimelineViewer
    // This is a placeholder for future implementation if needed
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div className="timeline-page min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" asChild>
                <Link href="/">
                  <ArrowLeft className="h-4 w-4" />
                </Link>
              </Button>
              <div>
                <h1 className="text-2xl font-bold">
                  Tibetan Buddhist History Timeline
                </h1>
                <p className="text-sm text-muted-foreground">
                  Explore {entityCount.toLocaleString()} entities across 1000 years of history
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowFilters(!showFilters)}
              >
                {showFilters ? 'Hide' : 'Show'} Filters
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowDetails(!showDetails)}
              >
                {showDetails ? 'Hide' : 'Show'} Details
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Info Alert */}
      <div className="container mx-auto px-4 py-4">
        <Alert>
          <Info className="h-4 w-4" />
          <AlertTitle>Interactive Timeline</AlertTitle>
          <AlertDescription>
            Click and drag to pan, scroll to zoom, and click on items to view details.
            Use the filters on the left to narrow down the view.
          </AlertDescription>
        </Alert>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 pb-8">
        <div className="grid grid-cols-12 gap-4">
          {/* Filters Sidebar */}
          {showFilters && (
            <aside className="col-span-12 lg:col-span-3">
              <div className="sticky top-4">
                <TimelineFiltersPanel
                  filters={filters}
                  onFiltersChange={setFilters}
                  onReset={handleResetFilters}
                />
              </div>
            </aside>
          )}

          {/* Timeline Main Area */}
          <main className={`col-span-12 ${showFilters ? 'lg:col-span-6' : showDetails ? 'lg:col-span-9' : 'lg:col-span-12'}`}>
            <div className="space-y-4">
              {/* Controls */}
              <TimelineControls
                startYear={startYear}
                endYear={endYear}
                onZoomIn={handleZoomIn}
                onZoomOut={handleZoomOut}
                onFit={handleFit}
                onDateRangeChange={handleDateRangeChange}
                onJumpToDate={handleJumpToDate}
                onRefresh={refetch}
              />

              {/* Timeline Visualization */}
              <TimelineViewer
                items={items}
                groups={groups}
                isLoading={isLoading}
                error={error}
                onItemClick={handleItemClick}
              />
            </div>
          </main>

          {/* Details Sidebar */}
          {showDetails && (
            <aside className="col-span-12 lg:col-span-3">
              <div className="sticky top-4">
                <TimelineDetails
                  entity={selectedEntity}
                  onClose={() => setSelectedEntity(null)}
                  onShowLineage={handleShowLineage}
                  onShowMap={handleShowMap}
                />
              </div>
            </aside>
          )}
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t bg-card mt-8">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <p>
              Tibetan Buddhist Knowledge Graph
            </p>
            <div className="flex items-center gap-4">
              <Link href="/extraction">
                <a className="hover:text-foreground">Entity Extraction</a>
              </Link>
              <Link href="/entity-review">
                <a className="hover:text-foreground">Entity Review</a>
              </Link>
              <Link href="/dashboard">
                <a className="hover:text-foreground">Dashboard</a>
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
