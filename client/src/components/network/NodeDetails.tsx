/**
 * Node Details Component
 *
 * Displays detailed information about a selected node including attributes,
 * connections, and metadata.
 */

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  User,
  MapPin,
  BookOpen,
  Calendar,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  Network,
} from 'lucide-react';
import type { D3Node } from '@/types/network';

// ============================================================================
// Props
// ============================================================================

export interface NodeDetailsProps {
  node: D3Node | null;
}

// ============================================================================
// Helper Functions
// ============================================================================

function formatDate(dateInfo: any): string {
  if (!dateInfo) return 'Unknown';
  if (typeof dateInfo === 'string') return dateInfo;
  if (dateInfo.year) return dateInfo.year.toString();
  return JSON.stringify(dateInfo);
}

function formatAttribute(key: string, value: any): { label: string; display: string } {
  const label = key.split(/(?=[A-Z])/).join(' ');
  const capitalizedLabel = label.charAt(0).toUpperCase() + label.slice(1);

  let display: string;
  if (Array.isArray(value)) {
    display = value.join(', ');
  } else if (typeof value === 'object' && value !== null) {
    display = JSON.stringify(value, null, 2);
  } else {
    display = String(value);
  }

  return { label: capitalizedLabel, display };
}

// ============================================================================
// Component
// ============================================================================

export function NodeDetails({ node }: NodeDetailsProps): JSX.Element {
  if (!node) {
    return (
      <Card className="h-full">
        <CardContent className="flex items-center justify-center h-full text-gray-400">
          <div className="text-center">
            <AlertCircle className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Select a node to view details</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const { entity } = node;

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center justify-between">
          <span className="flex items-center gap-2">
            <User className="w-5 h-5" />
            Entity Details
          </span>
          {entity.verified && (
            <CheckCircle2 className="w-5 h-5 text-emerald-500" />
          )}
        </CardTitle>
      </CardHeader>

      <Separator />

      <ScrollArea className="flex-1">
        <CardContent className="pt-4 space-y-4">
          {/* Canonical Name */}
          <div>
            <h3 className="font-semibold text-base">{entity.canonicalName}</h3>
            <Badge variant="outline" className="mt-1">
              {entity.type}
            </Badge>
          </div>

          {/* Alternative Names */}
          {entity.names && (
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-2">Names</h4>
              <div className="space-y-1 text-sm">
                {entity.names.english && entity.names.english.length > 0 && (
                  <div>
                    <span className="text-gray-500">English:</span>{' '}
                    {entity.names.english.join(', ')}
                  </div>
                )}
                {entity.names.tibetan && entity.names.tibetan.length > 0 && (
                  <div>
                    <span className="text-gray-500">Tibetan:</span>{' '}
                    {entity.names.tibetan.join(', ')}
                  </div>
                )}
                {entity.names.phonetic && entity.names.phonetic.length > 0 && (
                  <div>
                    <span className="text-gray-500">Phonetic:</span>{' '}
                    {entity.names.phonetic.join(', ')}
                  </div>
                )}
                {entity.names.wylie && entity.names.wylie.length > 0 && (
                  <div>
                    <span className="text-gray-500">Wylie:</span>{' '}
                    {entity.names.wylie.join(', ')}
                  </div>
                )}
              </div>
            </div>
          )}

          <Separator />

          {/* Dates */}
          {entity.dates && (
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                Dates
              </h4>
              <div className="space-y-1 text-sm">
                {entity.dates.birth && (
                  <div>
                    <span className="text-gray-500">Birth:</span>{' '}
                    {formatDate(entity.dates.birth)}
                  </div>
                )}
                {entity.dates.death && (
                  <div>
                    <span className="text-gray-500">Death:</span>{' '}
                    {formatDate(entity.dates.death)}
                  </div>
                )}
                {entity.dates.founded && (
                  <div>
                    <span className="text-gray-500">Founded:</span>{' '}
                    {formatDate(entity.dates.founded)}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Attributes */}
          {entity.attributes && Object.keys(entity.attributes).length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                <BookOpen className="w-4 h-4" />
                Attributes
              </h4>
              <div className="space-y-2 text-sm">
                {Object.entries(entity.attributes)
                  .filter(([_, value]) => value !== null && value !== undefined)
                  .map(([key, value]) => {
                    const { label, display } = formatAttribute(key, value);
                    return (
                      <div key={key}>
                        <span className="text-gray-500">{label}:</span>{' '}
                        {display.length > 100 ? (
                          <pre className="text-xs mt-1 p-2 bg-gray-50 rounded overflow-x-auto">
                            {display}
                          </pre>
                        ) : (
                          <span>{display}</span>
                        )}
                      </div>
                    );
                  })}
              </div>
            </div>
          )}

          <Separator />

          {/* Graph Metrics */}
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
              <Network className="w-4 h-4" />
              Network Metrics
            </h4>
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-gray-500">Connections:</span>
                <Badge variant="secondary">{node.degree}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-500">Influence:</span>
                <Badge variant="secondary">
                  {(node.influence * 100).toFixed(0)}%
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-500">Confidence:</span>
                <div className="flex items-center gap-2">
                  <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500"
                      style={{ width: `${entity.confidence * 100}%` }}
                    />
                  </div>
                  <span className="text-xs">
                    {(entity.confidence * 100).toFixed(0)}%
                  </span>
                </div>
              </div>
              {node.community !== undefined && (
                <div className="flex items-center justify-between">
                  <span className="text-gray-500">Community:</span>
                  <Badge variant="outline">{node.community + 1}</Badge>
                </div>
              )}
            </div>
          </div>

          <Separator />

          {/* Status */}
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-2">Status</h4>
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                {entity.verified ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    <span>Verified</span>
                  </>
                ) : (
                  <>
                    <AlertCircle className="w-4 h-4 text-amber-500" />
                    <span>Unverified (AI-extracted)</span>
                  </>
                )}
              </div>
              {node.expanded ? (
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-blue-500" />
                  <span>Expanded</span>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-gray-400" />
                  <span>Not expanded (click to load connections)</span>
                </div>
              )}
            </div>
          </div>

          {/* Entity ID */}
          <div className="text-xs text-gray-400 font-mono break-all">
            ID: {entity.id}
          </div>
        </CardContent>
      </ScrollArea>
    </Card>
  );
}

export default NodeDetails;
