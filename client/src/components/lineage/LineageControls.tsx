/**
 * LineageControls
 *
 * Control panel for lineage visualization settings:
 * - Layout mode (tree/network)
 * - Lineage type (teacher/student/incarnation)
 * - Depth slider
 * - Zoom controls
 * - Export options
 */

import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  Download,
  Network as NetworkIcon,
  GitBranch,
  RefreshCw,
} from 'lucide-react';
import type { LineageType } from '../../hooks/useLineage';

// ============================================================================
// Types
// ============================================================================

export type LayoutMode = 'tree' | 'network';

export interface LineageControlsProps {
  // Layout settings
  layoutMode: LayoutMode;
  onLayoutModeChange: (mode: LayoutMode) => void;

  // Lineage type
  lineageType: LineageType;
  onLineageTypeChange: (type: LineageType) => void;

  // Depth control
  maxDepth: number;
  onMaxDepthChange: (depth: number) => void;

  // Zoom controls
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFitToView: () => void;

  // Export
  onExportPNG: () => void;
  onExportSVG: () => void;
  onExportJSON: () => void;

  // Refresh
  onRefresh: () => void;

  // State
  isLoading?: boolean;
}

// ============================================================================
// Component
// ============================================================================

export function LineageControls({
  layoutMode,
  onLayoutModeChange,
  lineageType,
  onLineageTypeChange,
  maxDepth,
  onMaxDepthChange,
  onZoomIn,
  onZoomOut,
  onFitToView,
  onExportPNG,
  onExportSVG,
  onExportJSON,
  onRefresh,
  isLoading = false,
}: LineageControlsProps) {
  return (
    <Card className="lineage-controls">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <GitBranch className="h-5 w-5" />
          Visualization Controls
        </CardTitle>
        <CardDescription>
          Customize the lineage view and interaction
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Layout Mode */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">Layout Mode</Label>
          <ToggleGroup
            type="single"
            value={layoutMode}
            onValueChange={(value) => value && onLayoutModeChange(value as LayoutMode)}
            className="w-full"
          >
            <ToggleGroupItem value="tree" className="flex-1">
              <GitBranch className="h-4 w-4 mr-2" />
              Tree
            </ToggleGroupItem>
            <ToggleGroupItem value="network" className="flex-1">
              <NetworkIcon className="h-4 w-4 mr-2" />
              Network
            </ToggleGroupItem>
          </ToggleGroup>
          <p className="text-xs text-muted-foreground">
            {layoutMode === 'tree'
              ? 'Hierarchical layout from root to descendants'
              : 'Force-directed layout showing all connections'}
          </p>
        </div>

        <Separator />

        {/* Lineage Type */}
        <div className="space-y-2">
          <Label htmlFor="lineage-type" className="text-sm font-medium">
            Lineage Type
          </Label>
          <Select value={lineageType} onValueChange={(value) => onLineageTypeChange(value as LineageType)}>
            <SelectTrigger id="lineage-type">
              <SelectValue placeholder="Select lineage type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="teacher">
                <div className="flex flex-col items-start">
                  <span className="font-medium">Teacher Lineage</span>
                  <span className="text-xs text-muted-foreground">
                    Trace teachers upward
                  </span>
                </div>
              </SelectItem>
              <SelectItem value="student">
                <div className="flex flex-col items-start">
                  <span className="font-medium">Student Lineage</span>
                  <span className="text-xs text-muted-foreground">
                    Trace students downward
                  </span>
                </div>
              </SelectItem>
              <SelectItem value="incarnation">
                <div className="flex flex-col items-start">
                  <span className="font-medium">Incarnation Line</span>
                  <span className="text-xs text-muted-foreground">
                    Previous and future lives
                  </span>
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Separator />

        {/* Depth Control */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label htmlFor="depth-slider" className="text-sm font-medium">
              Max Depth
            </Label>
            <span className="text-sm font-bold text-primary">{maxDepth}</span>
          </div>
          <Slider
            id="depth-slider"
            min={1}
            max={10}
            step={1}
            value={[maxDepth]}
            onValueChange={(values) => onMaxDepthChange(values[0])}
            className="w-full"
            disabled={isLoading}
          />
          <p className="text-xs text-muted-foreground">
            Number of generations to display
          </p>
        </div>

        <Separator />

        {/* Zoom Controls */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">Zoom & View</Label>
          <div className="grid grid-cols-3 gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onZoomIn}
              className="w-full"
              title="Zoom In"
            >
              <ZoomIn className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={onZoomOut}
              className="w-full"
              title="Zoom Out"
            >
              <ZoomOut className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={onFitToView}
              className="w-full"
              title="Fit to View"
            >
              <Maximize2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <Separator />

        {/* Export Options */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">Export</Label>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="w-full">
                <Download className="h-4 w-4 mr-2" />
                Download
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-48">
              <DropdownMenuItem onClick={onExportPNG}>
                <Download className="h-4 w-4 mr-2" />
                Export as PNG
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onExportSVG}>
                <Download className="h-4 w-4 mr-2" />
                Export as SVG
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onExportJSON}>
                <Download className="h-4 w-4 mr-2" />
                Export Data (JSON)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <Separator />

        {/* Refresh */}
        <Button
          variant="secondary"
          className="w-full"
          onClick={onRefresh}
          disabled={isLoading}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh Data
        </Button>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Compact Controls (for mobile/small screens)
// ============================================================================

export interface CompactLineageControlsProps {
  layoutMode: LayoutMode;
  onLayoutModeChange: (mode: LayoutMode) => void;
  lineageType: LineageType;
  onLineageTypeChange: (type: LineageType) => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFitToView: () => void;
}

export function CompactLineageControls({
  layoutMode,
  onLayoutModeChange,
  lineageType,
  onLineageTypeChange,
  onZoomIn,
  onZoomOut,
  onFitToView,
}: CompactLineageControlsProps) {
  return (
    <div className="flex items-center gap-2 p-2 bg-background border rounded-lg">
      {/* Layout Toggle */}
      <ToggleGroup
        type="single"
        value={layoutMode}
        onValueChange={(value) => value && onLayoutModeChange(value as LayoutMode)}
        size="sm"
      >
        <ToggleGroupItem value="tree" size="sm">
          <GitBranch className="h-4 w-4" />
        </ToggleGroupItem>
        <ToggleGroupItem value="network" size="sm">
          <NetworkIcon className="h-4 w-4" />
        </ToggleGroupItem>
      </ToggleGroup>

      <Separator orientation="vertical" className="h-6" />

      {/* Lineage Type */}
      <Select value={lineageType} onValueChange={(value) => onLineageTypeChange(value as LineageType)}>
        <SelectTrigger className="w-[140px] h-8">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="teacher">Teacher</SelectItem>
          <SelectItem value="student">Student</SelectItem>
          <SelectItem value="incarnation">Incarnation</SelectItem>
        </SelectContent>
      </Select>

      <Separator orientation="vertical" className="h-6" />

      {/* Zoom Controls */}
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="sm" onClick={onZoomIn}>
          <ZoomIn className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="sm" onClick={onZoomOut}>
          <ZoomOut className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="sm" onClick={onFitToView}>
          <Maximize2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
