/**
 * Network Controls Component
 *
 * Control panel for adjusting visualization settings including color mode,
 * size mode, relationship filters, depth, and physics parameters.
 */

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import {
  Palette,
  Maximize,
  GitBranch,
  Layers,
  Play,
  Pause,
  RotateCcw,
} from 'lucide-react';
import type { ColorMode, SizeMode } from '@/types/network';
import { RELATIONSHIP_TYPES } from '@/types/network';

// ============================================================================
// Props
// ============================================================================

export interface NetworkControlsProps {
  // Visual encoding
  colorMode: ColorMode;
  sizeMode: SizeMode;
  onColorModeChange: (mode: ColorMode) => void;
  onSizeModeChange: (mode: SizeMode) => void;

  // Filters
  relationshipTypes: string[];
  onRelationshipTypesChange: (types: string[]) => void;
  depth: number;
  onDepthChange: (depth: number) => void;
  minConfidence: number;
  onMinConfidenceChange: (confidence: number) => void;

  // Display options
  showLabels: boolean;
  onShowLabelsChange: (show: boolean) => void;
  showRelationshipLabels: boolean;
  onShowRelationshipLabelsChange: (show: boolean) => void;

  // Physics
  isPaused: boolean;
  onPauseToggle: () => void;
  onResetLayout: () => void;
}

// ============================================================================
// Helper Functions
// ============================================================================

function formatPredicate(predicate: string): string {
  return predicate
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

// ============================================================================
// Component
// ============================================================================

export function NetworkControls({
  colorMode,
  sizeMode,
  onColorModeChange,
  onSizeModeChange,
  relationshipTypes,
  onRelationshipTypesChange,
  depth,
  onDepthChange,
  minConfidence,
  onMinConfidenceChange,
  showLabels,
  onShowLabelsChange,
  showRelationshipLabels,
  onShowRelationshipLabelsChange,
  isPaused,
  onPauseToggle,
  onResetLayout,
}: NetworkControlsProps): JSX.Element {
  // ============================================================================
  // Event Handlers
  // ============================================================================

  const handleRelationshipToggle = (type: string, checked: boolean) => {
    if (checked) {
      onRelationshipTypesChange([...relationshipTypes, type]);
    } else {
      onRelationshipTypesChange(relationshipTypes.filter(t => t !== type));
    }
  };

  const handleSelectAllRelationships = () => {
    onRelationshipTypesChange([...RELATIONSHIP_TYPES]);
  };

  const handleDeselectAllRelationships = () => {
    onRelationshipTypesChange([]);
  };

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <div className="space-y-4 p-4 overflow-y-auto">
      {/* Color Mode */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Palette className="w-4 h-4" />
            Color By
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <RadioGroup value={colorMode} onValueChange={onColorModeChange}>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="tradition" id="color-tradition" />
              <Label htmlFor="color-tradition" className="text-sm cursor-pointer">
                Tradition
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="entity_type" id="color-type" />
              <Label htmlFor="color-type" className="text-sm cursor-pointer">
                Entity Type
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="community" id="color-community" />
              <Label htmlFor="color-community" className="text-sm cursor-pointer">
                Community
              </Label>
            </div>
          </RadioGroup>
        </CardContent>
      </Card>

      {/* Size Mode */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Maximize className="w-4 h-4" />
            Size By
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <RadioGroup value={sizeMode} onValueChange={onSizeModeChange}>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="equal" id="size-equal" />
              <Label htmlFor="size-equal" className="text-sm cursor-pointer">
                Equal
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="degree" id="size-degree" />
              <Label htmlFor="size-degree" className="text-sm cursor-pointer">
                Connections
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="influence" id="size-influence" />
              <Label htmlFor="size-influence" className="text-sm cursor-pointer">
                Influence
              </Label>
            </div>
          </RadioGroup>
        </CardContent>
      </Card>

      {/* Relationship Filters */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <GitBranch className="w-4 h-4" />
            Show Relationships
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2 mb-3">
            <Button
              variant="outline"
              size="sm"
              onClick={handleSelectAllRelationships}
              className="flex-1 text-xs"
            >
              All
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleDeselectAllRelationships}
              className="flex-1 text-xs"
            >
              None
            </Button>
          </div>

          <div className="space-y-2 max-h-48 overflow-y-auto">
            {RELATIONSHIP_TYPES.map(type => (
              <div key={type} className="flex items-center space-x-2">
                <Checkbox
                  id={`rel-${type}`}
                  checked={relationshipTypes.includes(type)}
                  onCheckedChange={(checked) =>
                    handleRelationshipToggle(type, checked as boolean)
                  }
                />
                <Label
                  htmlFor={`rel-${type}`}
                  className="text-sm cursor-pointer flex-1"
                >
                  {formatPredicate(type)}
                </Label>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Depth Control */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Layers className="w-4 h-4" />
            Expansion Depth: {depth}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Slider
            value={[depth]}
            onValueChange={(values) => onDepthChange(values[0])}
            min={1}
            max={3}
            step={1}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-gray-500 mt-2">
            <span>1 hop</span>
            <span>2 hops</span>
            <span>3 hops</span>
          </div>
        </CardContent>
      </Card>

      {/* Confidence Filter */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">
            Min Confidence: {(minConfidence * 100).toFixed(0)}%
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Slider
            value={[minConfidence * 100]}
            onValueChange={(values) => onMinConfidenceChange(values[0] / 100)}
            min={0}
            max={100}
            step={5}
            className="w-full"
          />
        </CardContent>
      </Card>

      {/* Display Options */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Display Options</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <Label htmlFor="show-labels" className="text-sm">
              Node Labels
            </Label>
            <Switch
              id="show-labels"
              checked={showLabels}
              onCheckedChange={onShowLabelsChange}
            />
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="show-rel-labels" className="text-sm">
              Relationship Labels
            </Label>
            <Switch
              id="show-rel-labels"
              checked={showRelationshipLabels}
              onCheckedChange={onShowRelationshipLabelsChange}
            />
          </div>
        </CardContent>
      </Card>

      {/* Physics Controls */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Physics</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onPauseToggle}
            className="w-full"
          >
            {isPaused ? (
              <>
                <Play className="w-4 h-4 mr-2" />
                Resume
              </>
            ) : (
              <>
                <Pause className="w-4 h-4 mr-2" />
                Pause
              </>
            )}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onResetLayout}
            className="w-full"
          >
            <RotateCcw className="w-4 h-4 mr-2" />
            Reset Layout
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

export default NetworkControls;
