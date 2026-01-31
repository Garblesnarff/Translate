/**
 * Network Legend Component
 *
 * Displays legend explaining the visual encoding of colors, sizes, and relationships.
 * Adapts based on current colorMode and sizeMode settings.
 */

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Info } from 'lucide-react';
import type { ColorMode, SizeMode } from '@/types/network';
import {
  TRADITION_COLORS,
  ENTITY_TYPE_COLORS,
  COMMUNITY_COLORS,
  RELATIONSHIP_COLORS,
  RELATIONSHIP_TYPES,
} from '@/types/network';

// ============================================================================
// Props
// ============================================================================

export interface NetworkLegendProps {
  colorMode: ColorMode;
  sizeMode: SizeMode;
  relationshipTypes: string[];
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

export function NetworkLegend({
  colorMode,
  sizeMode,
  relationshipTypes,
}: NetworkLegendProps): JSX.Element {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Info className="w-4 h-4" />
          Legend
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Color Legend */}
        <div>
          <h4 className="text-xs font-semibold text-gray-700 mb-2">Node Colors</h4>

          {colorMode === 'tradition' && (
            <div className="space-y-1.5">
              {Object.entries(TRADITION_COLORS).map(([tradition, color]) => (
                <div key={tradition} className="flex items-center gap-2">
                  <div
                    className="w-4 h-4 rounded-full border border-gray-300"
                    style={{ backgroundColor: color }}
                  />
                  <span className="text-xs">{tradition}</span>
                </div>
              ))}
            </div>
          )}

          {colorMode === 'entity_type' && (
            <div className="space-y-1.5">
              {Object.entries(ENTITY_TYPE_COLORS).map(([type, color]) => (
                <div key={type} className="flex items-center gap-2">
                  <div
                    className="w-4 h-4 rounded-full border border-gray-300"
                    style={{ backgroundColor: color }}
                  />
                  <span className="text-xs capitalize">{type}</span>
                </div>
              ))}
            </div>
          )}

          {colorMode === 'community' && (
            <div className="space-y-1.5">
              <p className="text-xs text-gray-600 mb-2">
                Colors represent detected communities in the network
              </p>
              <div className="flex flex-wrap gap-1">
                {COMMUNITY_COLORS.map((color, index) => (
                  <div
                    key={index}
                    className="w-6 h-6 rounded-full border border-gray-300"
                    style={{ backgroundColor: color }}
                    title={`Community ${index + 1}`}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Size Legend */}
        <div>
          <h4 className="text-xs font-semibold text-gray-700 mb-2">Node Size</h4>

          {sizeMode === 'equal' && (
            <p className="text-xs text-gray-600">All nodes are equal size</p>
          )}

          {sizeMode === 'degree' && (
            <div className="space-y-1">
              <p className="text-xs text-gray-600">Sized by number of connections</p>
              <div className="flex items-end gap-2 mt-2">
                <div className="flex flex-col items-center gap-1">
                  <div className="w-3 h-3 rounded-full bg-blue-500" />
                  <span className="text-xs text-gray-500">Few</span>
                </div>
                <div className="flex flex-col items-center gap-1">
                  <div className="w-5 h-5 rounded-full bg-blue-500" />
                  <span className="text-xs text-gray-500">Some</span>
                </div>
                <div className="flex flex-col items-center gap-1">
                  <div className="w-8 h-8 rounded-full bg-blue-500" />
                  <span className="text-xs text-gray-500">Many</span>
                </div>
              </div>
            </div>
          )}

          {sizeMode === 'influence' && (
            <div className="space-y-1">
              <p className="text-xs text-gray-600">Sized by calculated influence</p>
              <div className="flex items-end gap-2 mt-2">
                <div className="flex flex-col items-center gap-1">
                  <div className="w-3 h-3 rounded-full bg-blue-500" />
                  <span className="text-xs text-gray-500">Low</span>
                </div>
                <div className="flex flex-col items-center gap-1">
                  <div className="w-5 h-5 rounded-full bg-blue-500" />
                  <span className="text-xs text-gray-500">Medium</span>
                </div>
                <div className="flex flex-col items-center gap-1">
                  <div className="w-8 h-8 rounded-full bg-blue-500" />
                  <span className="text-xs text-gray-500">High</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Relationship Types */}
        {relationshipTypes.length > 0 && (
          <div>
            <h4 className="text-xs font-semibold text-gray-700 mb-2">
              Relationships
            </h4>
            <div className="space-y-1.5">
              {relationshipTypes.map(type => (
                <div key={type} className="flex items-center gap-2">
                  <svg width="24" height="12" viewBox="0 0 24 12">
                    <defs>
                      <marker
                        id={`legend-arrow-${type}`}
                        viewBox="0 0 10 10"
                        refX={8}
                        refY={5}
                        markerWidth={4}
                        markerHeight={4}
                        orient="auto"
                      >
                        <path
                          d="M 0 0 L 10 5 L 0 10 z"
                          fill={RELATIONSHIP_COLORS[type] || RELATIONSHIP_COLORS.default}
                        />
                      </marker>
                    </defs>
                    <line
                      x1="0"
                      y1="6"
                      x2="24"
                      y2="6"
                      stroke={RELATIONSHIP_COLORS[type] || RELATIONSHIP_COLORS.default}
                      strokeWidth="2"
                      markerEnd={`url(#legend-arrow-${type})`}
                    />
                  </svg>
                  <span className="text-xs">{formatPredicate(type)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Visual Indicators */}
        <div>
          <h4 className="text-xs font-semibold text-gray-700 mb-2">
            Visual Indicators
          </h4>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="relative">
                <div className="w-5 h-5 rounded-full bg-blue-500 border-2 border-white" />
                <div className="w-2 h-2 rounded-full bg-emerald-500 border border-white absolute -top-0.5 -right-0.5" />
              </div>
              <span className="text-xs">Verified entity</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <div className="w-5 h-5 rounded-full bg-blue-500 border-2 border-white" />
                <div className="w-2 h-2 rounded-full bg-yellow-500 border border-white absolute bottom-0 right-0" />
              </div>
              <span className="text-xs">Expandable (has more connections)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded-full bg-blue-500 border-4 border-amber-400" />
              <span className="text-xs">Selected node</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded-full bg-blue-500 border-3 border-blue-400" />
              <span className="text-xs">Highlighted node</span>
            </div>
          </div>
        </div>

        {/* Confidence */}
        <div>
          <h4 className="text-xs font-semibold text-gray-700 mb-2">
            Confidence
          </h4>
          <div className="space-y-1">
            <p className="text-xs text-gray-600">
              Dashed inner circle shows entity confidence level
            </p>
            <p className="text-xs text-gray-600">
              Dashed edges indicate low-confidence relationships
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default NetworkLegend;
