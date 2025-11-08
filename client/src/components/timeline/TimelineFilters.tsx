/**
 * TimelineFilters Component
 *
 * Filter controls for timeline visualization
 */

import { useState } from 'react';
import type { TimelineFilters } from '@/hooks/useTimeline';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';

// ============================================================================
// CONSTANTS
// ============================================================================

const ENTITY_TYPES = [
  { value: 'person', label: 'People' },
  { value: 'event', label: 'Events' },
  { value: 'text', label: 'Texts' },
  { value: 'place', label: 'Places' },
  { value: 'lineage', label: 'Lineages' },
  { value: 'institution', label: 'Institutions' },
  { value: 'concept', label: 'Concepts' },
  { value: 'deity', label: 'Deities' }
];

const TRADITIONS = [
  'Nyingma',
  'Kagyu',
  'Sakya',
  'Gelug',
  'Jonang',
  'Bon',
  'Rimé'
];

const REGIONS = [
  'Ü',
  'Tsang',
  'Kham',
  'Amdo',
  'Ngari',
  'Central Tibet',
  'Eastern Tibet',
  'Western Tibet'
];

// ============================================================================
// TYPES
// ============================================================================

export interface TimelineFiltersProps {
  filters: TimelineFilters;
  onFiltersChange: (filters: TimelineFilters) => void;
  onReset?: () => void;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function TimelineFiltersPanel({
  filters,
  onFiltersChange,
  onReset
}: TimelineFiltersProps) {
  // ============================================================================
  // HANDLERS
  // ============================================================================

  const handleEntityTypeToggle = (entityType: string) => {
    const newTypes = filters.entityTypes.includes(entityType)
      ? filters.entityTypes.filter(t => t !== entityType)
      : [...filters.entityTypes, entityType];

    onFiltersChange({
      ...filters,
      entityTypes: newTypes
    });
  };

  const handleTraditionToggle = (tradition: string) => {
    const newTraditions = filters.traditions.includes(tradition)
      ? filters.traditions.filter(t => t !== tradition)
      : [...filters.traditions, tradition];

    onFiltersChange({
      ...filters,
      traditions: newTraditions
    });
  };

  const handleRegionToggle = (region: string) => {
    const newRegions = filters.regions.includes(region)
      ? filters.regions.filter(r => r !== region)
      : [...filters.regions, region];

    onFiltersChange({
      ...filters,
      regions: newRegions
    });
  };

  const handleConfidenceChange = (value: number[]) => {
    onFiltersChange({
      ...filters,
      minConfidence: value[0]
    });
  };

  const handleReset = () => {
    if (onReset) {
      onReset();
    } else {
      onFiltersChange({
        entityTypes: [],
        traditions: [],
        regions: [],
        minConfidence: 0
      });
    }
  };

  // ============================================================================
  // RENDER HELPERS
  // ============================================================================

  const getActiveFilterCount = () => {
    return (
      filters.entityTypes.length +
      filters.traditions.length +
      filters.regions.length +
      (filters.minConfidence > 0 ? 1 : 0)
    );
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <Card className="timeline-filters">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Filters</CardTitle>
          {getActiveFilterCount() > 0 && (
            <Badge variant="secondary">
              {getActiveFilterCount()} active
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Entity Types */}
        <div className="filter-section">
          <Label className="text-sm font-semibold mb-3 block">
            Entity Types
          </Label>
          <div className="space-y-2">
            {ENTITY_TYPES.map((type) => (
              <div key={type.value} className="flex items-center space-x-2">
                <Checkbox
                  id={`type-${type.value}`}
                  checked={filters.entityTypes.includes(type.value)}
                  onCheckedChange={() => handleEntityTypeToggle(type.value)}
                />
                <label
                  htmlFor={`type-${type.value}`}
                  className="text-sm font-normal cursor-pointer flex-1"
                >
                  {type.label}
                </label>
              </div>
            ))}
          </div>
        </div>

        <Separator />

        {/* Traditions */}
        <div className="filter-section">
          <Label className="text-sm font-semibold mb-3 block">
            Traditions
          </Label>
          <div className="space-y-2">
            {TRADITIONS.map((tradition) => (
              <div key={tradition} className="flex items-center space-x-2">
                <Checkbox
                  id={`tradition-${tradition}`}
                  checked={filters.traditions.includes(tradition)}
                  onCheckedChange={() => handleTraditionToggle(tradition)}
                />
                <label
                  htmlFor={`tradition-${tradition}`}
                  className="text-sm font-normal cursor-pointer flex-1"
                >
                  {tradition}
                </label>
              </div>
            ))}
          </div>
        </div>

        <Separator />

        {/* Regions */}
        <div className="filter-section">
          <Label className="text-sm font-semibold mb-3 block">
            Regions
          </Label>
          <div className="space-y-2">
            {REGIONS.map((region) => (
              <div key={region} className="flex items-center space-x-2">
                <Checkbox
                  id={`region-${region}`}
                  checked={filters.regions.includes(region)}
                  onCheckedChange={() => handleRegionToggle(region)}
                />
                <label
                  htmlFor={`region-${region}`}
                  className="text-sm font-normal cursor-pointer flex-1"
                >
                  {region}
                </label>
              </div>
            ))}
          </div>
        </div>

        <Separator />

        {/* Confidence */}
        <div className="filter-section">
          <div className="flex items-center justify-between mb-3">
            <Label className="text-sm font-semibold">
              Minimum Confidence
            </Label>
            <span className="text-sm text-muted-foreground">
              {Math.round(filters.minConfidence * 100)}%
            </span>
          </div>
          <Slider
            value={[filters.minConfidence]}
            onValueChange={handleConfidenceChange}
            min={0}
            max={1}
            step={0.05}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-muted-foreground mt-1">
            <span>0%</span>
            <span>50%</span>
            <span>100%</span>
          </div>
        </div>

        <Separator />

        {/* Reset Button */}
        <Button
          variant="outline"
          className="w-full"
          onClick={handleReset}
          disabled={getActiveFilterCount() === 0}
        >
          Reset Filters
        </Button>

        {/* Active Filters Summary */}
        {getActiveFilterCount() > 0 && (
          <div className="text-xs text-muted-foreground space-y-1">
            <p className="font-semibold">Active filters:</p>
            {filters.entityTypes.length > 0 && (
              <p>• {filters.entityTypes.length} entity type(s)</p>
            )}
            {filters.traditions.length > 0 && (
              <p>• {filters.traditions.length} tradition(s)</p>
            )}
            {filters.regions.length > 0 && (
              <p>• {filters.regions.length} region(s)</p>
            )}
            {filters.minConfidence > 0 && (
              <p>• Confidence ≥ {Math.round(filters.minConfidence * 100)}%</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
