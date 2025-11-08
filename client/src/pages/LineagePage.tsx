/**
 * LineagePage
 *
 * Full page layout for exploring Tibetan Buddhist lineages.
 * Integrates visualizer, controls, search, and details panel.
 */

import { useState, useMemo } from 'react';
import { useRoute } from 'wouter';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle, ArrowLeft, Home } from 'lucide-react';
import { useLineage, type LineageType } from '../hooks/useLineage';
import { LineageVisualizer, useNetworkControls } from '../components/lineage/LineageVisualizer';
import { LineageControls, type LayoutMode } from '../components/lineage/LineageControls';
import { LineageSearch } from '../components/lineage/LineageSearch';
import { LineageNodeDetails } from '../components/lineage/LineageNodeDetails';
import type { Entity, Relationship } from '../hooks/useLineage';
import '../styles/lineage.css';

// ============================================================================
// Component
// ============================================================================

export default function LineagePage() {
  // URL params - /lineage/:personId
  const [match, params] = useRoute('/lineage/:personId');
  const personId = params?.personId || '';

  // Visualization state
  const [layoutMode, setLayoutMode] = useState<LayoutMode>('tree');
  const [lineageType, setLineageType] = useState<LineageType>('teacher');
  const [maxDepth, setMaxDepth] = useState(5);
  const [selectedEntity, setSelectedEntity] = useState<Entity | null>(null);

  // Fetch lineage data
  const { data, isLoading, error, refetch } = useLineage({
    personId,
    lineageType,
    maxDepth,
    enabled: !!personId,
  });

  // Network controls
  const {
    zoomIn,
    zoomOut,
    fitToView,
    focusNode,
    exportPNG,
    exportSVG,
    exportJSON,
  } = useNetworkControls();

  // Get all entities as array for search
  const entitiesArray = useMemo(() => {
    if (!data) return [];
    return Array.from(data.entities.values());
  }, [data]);

  // Get selected entity's relationships
  const selectedEntityRelationships = useMemo(() => {
    if (!selectedEntity || !data) {
      return undefined;
    }

    const teachers: Array<{ entity: Entity; relationship: Relationship }> = [];
    const students: Array<{ entity: Entity; relationship: Relationship }> = [];
    const incarnations: Array<{ entity: Entity; relationship: Relationship }> = [];

    data.relationships.forEach((rel) => {
      // Teachers (where selected entity is student)
      if (rel.object_id === selectedEntity.id && rel.predicate === 'teacher_of') {
        const teacher = data.entities.get(rel.subject_id);
        if (teacher) {
          teachers.push({ entity: teacher, relationship: rel });
        }
      }

      // Students (where selected entity is teacher)
      if (rel.subject_id === selectedEntity.id && rel.predicate === 'teacher_of') {
        const student = data.entities.get(rel.object_id);
        if (student) {
          students.push({ entity: student, relationship: rel });
        }
      }

      // Incarnations
      if (
        (rel.subject_id === selectedEntity.id || rel.object_id === selectedEntity.id) &&
        rel.predicate === 'incarnation_of'
      ) {
        const otherId = rel.subject_id === selectedEntity.id ? rel.object_id : rel.subject_id;
        const other = data.entities.get(otherId);
        if (other) {
          incarnations.push({ entity: other, relationship: rel });
        }
      }
    });

    return { teachers, students, incarnations };
  }, [selectedEntity, data]);

  // Handle entity selection from search
  function handleSearchSelect(entity: Entity) {
    setSelectedEntity(entity);
    focusNode(entity.id);
  }

  // Handle node click
  function handleNodeClick(entity: Entity) {
    setSelectedEntity(entity);
  }

  // Handle expand node
  function handleExpandNode(entityId: string) {
    // In a real implementation, this would fetch more data
    // For now, just focus on the node
    focusNode(entityId);
  }

  // Handle view full profile
  function handleViewFullProfile(entityId: string) {
    // Navigate to entity review page or profile page
    window.location.href = `/entity-review?entityId=${entityId}`;
  }

  // No person ID provided
  if (!personId) {
    return (
      <div className="lineage-page h-screen flex items-center justify-center p-6">
        <Alert className="max-w-md">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <div className="font-medium mb-2">No person selected</div>
            <div className="text-sm mb-4">
              Please provide a person ID to explore their lineage.
            </div>
            <Button asChild variant="outline" size="sm">
              <a href="/entity-review">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Go to Entity Review
              </a>
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="lineage-page h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" asChild>
              <a href="/">
                <Home className="h-4 w-4" />
              </a>
            </Button>
            <div>
              <h1 className="text-2xl font-bold">Lineage Explorer</h1>
              <p className="text-sm text-muted-foreground">
                Explore teacher-student transmissions and incarnation lines
              </p>
            </div>
          </div>

          {/* Search */}
          <div className="w-96">
            <LineageSearch
              entities={entitiesArray}
              onSelectEntity={handleSearchSelect}
            />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar - Controls */}
        <aside className="w-80 border-r bg-muted/10 overflow-y-auto">
          <div className="p-4">
            <LineageControls
              layoutMode={layoutMode}
              onLayoutModeChange={setLayoutMode}
              lineageType={lineageType}
              onLineageTypeChange={setLineageType}
              maxDepth={maxDepth}
              onMaxDepthChange={setMaxDepth}
              onZoomIn={zoomIn}
              onZoomOut={zoomOut}
              onFitToView={fitToView}
              onExportPNG={exportPNG}
              onExportSVG={exportSVG}
              onExportJSON={exportJSON}
              onRefresh={() => refetch()}
              isLoading={isLoading}
            />
          </div>
        </aside>

        {/* Center - Visualization */}
        <main className="flex-1 relative">
          {data && (
            <LineageVisualizer
              rootPersonId={personId}
              lineageType={lineageType}
              layoutMode={layoutMode}
              maxDepth={maxDepth}
              entities={data.entities}
              relationships={data.relationships}
              isLoading={isLoading}
              error={error}
              onNodeClick={handleNodeClick}
              onNodeDoubleClick={(entity) => handleViewFullProfile(entity.id)}
            />
          )}

          {isLoading && !data && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/80">
              <div className="space-y-4 text-center">
                <Skeleton className="h-64 w-64 mx-auto rounded-full" />
                <Skeleton className="h-4 w-48 mx-auto" />
              </div>
            </div>
          )}

          {error && (
            <div className="absolute inset-0 flex items-center justify-center p-6">
              <Alert variant="destructive" className="max-w-md">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <div className="font-medium mb-1">Failed to load lineage</div>
                  <div className="text-sm mb-4">{error.message}</div>
                  <Button onClick={() => refetch()} size="sm" variant="outline">
                    Try Again
                  </Button>
                </AlertDescription>
              </Alert>
            </div>
          )}
        </main>

        {/* Right Sidebar - Details */}
        <aside className="w-96 border-l bg-muted/10 overflow-y-auto">
          <div className="p-4 h-full">
            <LineageNodeDetails
              entity={selectedEntity}
              relationships={selectedEntityRelationships}
              onExpandNode={handleExpandNode}
              onFocusNode={focusNode}
              onViewFullProfile={handleViewFullProfile}
            />
          </div>
        </aside>
      </div>

      {/* Legend */}
      <footer className="border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="px-6 py-3">
          <div className="flex items-center gap-6 text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-blue-200 border-2 border-blue-600" />
              <span>Teacher-Student</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-purple-200 border-2 border-purple-600 border-dashed" />
              <span>Incarnation</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-amber-200 border-2 border-amber-600" />
              <span>Transmission</span>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <span>Click: Select</span>
              <span>•</span>
              <span>Double-Click: View Profile</span>
              <span>•</span>
              <span>Drag: Pan</span>
              <span>•</span>
              <span>Scroll: Zoom</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
