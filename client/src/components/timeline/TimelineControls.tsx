/**
 * TimelineControls Component
 *
 * Navigation and zoom controls for timeline
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import {
  ZoomIn,
  ZoomOut,
  Maximize,
  Calendar,
  RefreshCw
} from 'lucide-react';
import { PRESET_RANGES } from '@/lib/timelineConfig';

// ============================================================================
// TYPES
// ============================================================================

export interface TimelineControlsProps {
  startYear: number;
  endYear: number;
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  onFit?: () => void;
  onDateRangeChange?: (start: number, end: number) => void;
  onJumpToDate?: (date: Date) => void;
  onRefresh?: () => void;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function TimelineControls({
  startYear,
  endYear,
  onZoomIn,
  onZoomOut,
  onFit,
  onDateRangeChange,
  onJumpToDate,
  onRefresh
}: TimelineControlsProps) {
  const [jumpYear, setJumpYear] = useState<string>('');

  // ============================================================================
  // HANDLERS
  // ============================================================================

  const handleJumpToDate = () => {
    const year = parseInt(jumpYear);
    if (!isNaN(year) && year >= 600 && year <= 1600 && onJumpToDate) {
      onJumpToDate(new Date(year, 0, 1));
      setJumpYear('');
    }
  };

  const handlePresetRange = (preset: string) => {
    const range = PRESET_RANGES.find(r => r.label === preset);
    if (range && onDateRangeChange) {
      const startYear = range.start.getFullYear();
      const endYear = range.end.getFullYear();
      onDateRangeChange(startYear, endYear);
    }
  };

  const handleStartYearChange = (value: string) => {
    const year = parseInt(value);
    if (!isNaN(year) && year >= 600 && year < endYear && onDateRangeChange) {
      onDateRangeChange(year, endYear);
    }
  };

  const handleEndYearChange = (value: string) => {
    const year = parseInt(value);
    if (!isNaN(year) && year > startYear && year <= 1600 && onDateRangeChange) {
      onDateRangeChange(startYear, year);
    }
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <Card className="timeline-controls mb-4">
      <CardContent className="p-4">
        <div className="flex flex-wrap items-end gap-4">
          {/* Zoom Controls */}
          <div className="flex items-center gap-2">
            <Label className="text-sm whitespace-nowrap">Zoom:</Label>
            <div className="flex gap-1">
              <Button
                variant="outline"
                size="icon"
                onClick={onZoomIn}
                title="Zoom in"
              >
                <ZoomIn className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={onZoomOut}
                title="Zoom out"
              >
                <ZoomOut className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={onFit}
                title="Fit all items"
              >
                <Maximize className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Date Range Inputs */}
          <div className="flex items-end gap-2">
            <div className="space-y-1">
              <Label htmlFor="start-year" className="text-xs">
                Start Year
              </Label>
              <Input
                id="start-year"
                type="number"
                value={startYear}
                onChange={(e) => handleStartYearChange(e.target.value)}
                className="w-24"
                min={600}
                max={1600}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="end-year" className="text-xs">
                End Year
              </Label>
              <Input
                id="end-year"
                type="number"
                value={endYear}
                onChange={(e) => handleEndYearChange(e.target.value)}
                className="w-24"
                min={600}
                max={1600}
              />
            </div>
          </div>

          {/* Preset Ranges */}
          <div className="space-y-1">
            <Label className="text-xs">Quick Range</Label>
            <Select onValueChange={handlePresetRange}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Select a period" />
              </SelectTrigger>
              <SelectContent>
                {PRESET_RANGES.map((range) => (
                  <SelectItem key={range.label} value={range.label}>
                    {range.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Jump to Date */}
          <div className="flex items-end gap-2">
            <div className="space-y-1">
              <Label htmlFor="jump-year" className="text-xs">
                Jump to Year
              </Label>
              <div className="flex gap-1">
                <Input
                  id="jump-year"
                  type="number"
                  value={jumpYear}
                  onChange={(e) => setJumpYear(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleJumpToDate()}
                  placeholder="e.g., 1200"
                  className="w-32"
                  min={600}
                  max={1600}
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleJumpToDate}
                  disabled={!jumpYear}
                  title="Jump to date"
                >
                  <Calendar className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          {/* Refresh Button */}
          {onRefresh && (
            <Button
              variant="outline"
              size="icon"
              onClick={onRefresh}
              title="Refresh timeline"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* Current Range Display */}
        <div className="mt-3 pt-3 border-t text-sm text-muted-foreground">
          Viewing: {startYear} - {endYear} CE ({endYear - startYear} years)
        </div>
      </CardContent>
    </Card>
  );
}
