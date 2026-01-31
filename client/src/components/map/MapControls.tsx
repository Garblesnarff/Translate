import { useState } from 'react';
import { Checkbox } from '../ui/checkbox';
import { Button } from '../ui/button';
import { Slider } from '../ui/slider';
import { Label } from '../ui/label';
import { ScrollArea } from '../ui/scroll-area';
import { Separator } from '../ui/separator';
import { Badge } from '../ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import {
  PLACE_TYPES,
  TRADITION_COLORS,
  FAMOUS_LOCATIONS,
  TILE_LAYERS,
  type MapFilters,
  type PlaceType
} from '../../lib/mapConfig';

interface MapControlsProps {
  filters: MapFilters;
  onFiltersChange: (filters: MapFilters) => void;
  onFlyTo: (coords: [number, number], zoom?: number) => void;
  placeCount?: number;
}

export function MapControls({
  filters,
  onFiltersChange,
  onFlyTo,
  placeCount = 0
}: MapControlsProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  // Toggle place type
  const togglePlaceType = (type: PlaceType, checked: boolean) => {
    const newTypes = checked
      ? [...filters.placeTypes, type]
      : filters.placeTypes.filter(t => t !== type);

    onFiltersChange({ ...filters, placeTypes: newTypes });
  };

  // Toggle all place types
  const toggleAllPlaceTypes = (checked: boolean) => {
    onFiltersChange({
      ...filters,
      placeTypes: checked ? [...PLACE_TYPES] : []
    });
  };

  // Toggle tradition
  const toggleTradition = (tradition: string, checked: boolean) => {
    const newTraditions = checked
      ? [...filters.traditions, tradition]
      : filters.traditions.filter(t => t !== tradition);

    onFiltersChange({ ...filters, traditions: newTraditions });
  };

  // Update time range
  const updateTimeRange = (values: number[]) => {
    onFiltersChange({
      ...filters,
      timeRange: { start: values[0], end: values[1] }
    });
  };

  // Toggle display option
  const toggleDisplay = (key: keyof MapFilters, value: boolean) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  // Change tile layer
  const changeTileLayer = (layer: string) => {
    onFiltersChange({
      ...filters,
      tileLayer: layer as keyof typeof TILE_LAYERS
    });
  };

  // Reset filters
  const resetFilters = () => {
    onFiltersChange({
      placeTypes: [...PLACE_TYPES],
      timeRange: { start: 600, end: 1600 },
      traditions: [],
      showHeatMap: false,
      showJourneys: false,
      showClusters: true,
      tileLayer: 'terrain'
    });
  };

  const traditions = Object.keys(TRADITION_COLORS);

  return (
    <div className="map-controls bg-white rounded-lg shadow-lg">
      {/* Header */}
      <div className="p-4 border-b">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold">Map Controls</h3>
            <p className="text-sm text-gray-500">
              {placeCount} places shown
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            {isExpanded ? '−' : '+'}
          </Button>
        </div>
      </div>

      {isExpanded && (
        <ScrollArea className="h-[calc(100vh-200px)]">
          <div className="p-4 space-y-6">
            {/* Place Types */}
            <div className="filter-group">
              <div className="flex items-center justify-between mb-3">
                <Label className="text-sm font-semibold">Place Types</Label>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => toggleAllPlaceTypes(filters.placeTypes.length !== PLACE_TYPES.length)}
                >
                  {filters.placeTypes.length === PLACE_TYPES.length ? 'Deselect All' : 'Select All'}
                </Button>
              </div>

              <div className="space-y-2">
                {PLACE_TYPES.map((type) => (
                  <div key={type} className="flex items-center space-x-2">
                    <Checkbox
                      id={`place-${type}`}
                      checked={filters.placeTypes.includes(type)}
                      onCheckedChange={(checked) => togglePlaceType(type, checked as boolean)}
                    />
                    <label
                      htmlFor={`place-${type}`}
                      className="text-sm capitalize cursor-pointer flex-1"
                    >
                      {type.replace('_', ' ')}
                    </label>
                  </div>
                ))}
              </div>
            </div>

            <Separator />

            {/* Time Period */}
            <div className="filter-group">
              <Label className="text-sm font-semibold mb-3 block">
                Time Period
              </Label>

              <div className="space-y-4">
                <Slider
                  min={600}
                  max={1600}
                  step={10}
                  value={[filters.timeRange.start, filters.timeRange.end]}
                  onValueChange={updateTimeRange}
                  className="w-full"
                />

                <div className="flex justify-between text-sm">
                  <span className="font-medium">
                    {filters.timeRange.start} CE
                  </span>
                  <span className="font-medium">
                    {filters.timeRange.end} CE
                  </span>
                </div>

                {/* Quick presets */}
                <div className="flex gap-2 flex-wrap">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => updateTimeRange([600, 900])}
                  >
                    Early (600-900)
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => updateTimeRange([900, 1200])}
                  >
                    Middle (900-1200)
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => updateTimeRange([1200, 1600])}
                  >
                    Late (1200-1600)
                  </Button>
                </div>
              </div>
            </div>

            <Separator />

            {/* Traditions */}
            <div className="filter-group">
              <Label className="text-sm font-semibold mb-3 block">
                Traditions
              </Label>

              <div className="space-y-2">
                {traditions.map((tradition) => (
                  <div key={tradition} className="flex items-center space-x-2">
                    <Checkbox
                      id={`tradition-${tradition}`}
                      checked={filters.traditions.includes(tradition)}
                      onCheckedChange={(checked) => toggleTradition(tradition, checked as boolean)}
                    />
                    <label
                      htmlFor={`tradition-${tradition}`}
                      className="text-sm cursor-pointer flex-1 flex items-center gap-2"
                    >
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: TRADITION_COLORS[tradition] }}
                      />
                      {tradition}
                    </label>
                  </div>
                ))}
              </div>
            </div>

            <Separator />

            {/* Display Options */}
            <div className="filter-group">
              <Label className="text-sm font-semibold mb-3 block">
                Display Options
              </Label>

              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="show-heatmap"
                    checked={filters.showHeatMap}
                    onCheckedChange={(checked) => toggleDisplay('showHeatMap', checked as boolean)}
                  />
                  <label htmlFor="show-heatmap" className="text-sm cursor-pointer">
                    Show Heat Map
                  </label>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="show-journeys"
                    checked={filters.showJourneys}
                    onCheckedChange={(checked) => toggleDisplay('showJourneys', checked as boolean)}
                  />
                  <label htmlFor="show-journeys" className="text-sm cursor-pointer">
                    Show Journey Routes
                  </label>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="show-clusters"
                    checked={filters.showClusters}
                    onCheckedChange={(checked) => toggleDisplay('showClusters', checked as boolean)}
                  />
                  <label htmlFor="show-clusters" className="text-sm cursor-pointer">
                    Cluster Markers
                  </label>
                </div>
              </div>
            </div>

            <Separator />

            {/* Map Style */}
            <div className="filter-group">
              <Label className="text-sm font-semibold mb-3 block">
                Map Style
              </Label>

              <Select value={filters.tileLayer} onValueChange={changeTileLayer}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="modern">Modern</SelectItem>
                  <SelectItem value="satellite">Satellite</SelectItem>
                  <SelectItem value="terrain">Terrain</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Separator />

            {/* Quick Jump Locations */}
            <div className="filter-group">
              <Label className="text-sm font-semibold mb-3 block">
                Quick Jump
              </Label>

              <div className="space-y-2">
                {Object.entries(FAMOUS_LOCATIONS).map(([key, location]) => (
                  <Button
                    key={key}
                    variant="outline"
                    size="sm"
                    className="w-full justify-start"
                    onClick={() => onFlyTo(location.coords, 10)}
                  >
                    📍 {location.name}
                  </Button>
                ))}
              </div>
            </div>

            <Separator />

            {/* Actions */}
            <div className="space-y-2">
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={resetFilters}
              >
                Reset Filters
              </Button>
            </div>

            {/* Filter Summary */}
            <div className="bg-gray-50 p-3 rounded text-xs space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-600">Place Types:</span>
                <Badge variant="secondary" className="text-xs">
                  {filters.placeTypes.length}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Traditions:</span>
                <Badge variant="secondary" className="text-xs">
                  {filters.traditions.length || 'All'}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Time Range:</span>
                <Badge variant="secondary" className="text-xs">
                  {filters.timeRange.end - filters.timeRange.start} years
                </Badge>
              </div>
            </div>
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
