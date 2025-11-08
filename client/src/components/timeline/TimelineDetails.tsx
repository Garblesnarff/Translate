/**
 * TimelineDetails Component
 *
 * Displays detailed information about selected timeline entity
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ExternalLink, Users, MapPin, X } from 'lucide-react';
import { TRADITION_COLORS } from '@/lib/timelineConfig';

// ============================================================================
// TYPES
// ============================================================================

export interface TimelineDetailsProps {
  entity: any | null;
  onClose?: () => void;
  onShowLineage?: (entityId: string) => void;
  onShowMap?: (entityId: string) => void;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function TimelineDetails({
  entity,
  onClose,
  onShowLineage,
  onShowMap
}: TimelineDetailsProps) {
  // ============================================================================
  // RENDER HELPERS
  // ============================================================================

  const formatDate = (dateInfo: any): string => {
    if (!dateInfo) return 'Unknown';
    if (typeof dateInfo === 'number') return dateInfo.toString();
    if (dateInfo.year) return dateInfo.year.toString();
    return 'Unknown';
  };

  const getEntityDates = () => {
    if (!entity) return null;

    const type = entity.type;
    const attrs = entity.attributes || {};
    const dates = attrs.dates || {};

    if (type === 'person') {
      return {
        birth: formatDate(attrs.birth_year || dates.birth),
        death: formatDate(attrs.death_year || dates.death)
      };
    } else if (type === 'text') {
      return {
        composed: formatDate(attrs.composed_year || dates.composed)
      };
    } else if (type === 'place' || type === 'institution') {
      return {
        founded: formatDate(attrs.founded_year || dates.founded)
      };
    } else if (type === 'event') {
      return {
        occurred: formatDate(attrs.year || dates.occurred)
      };
    }

    return null;
  };

  const getTraditionColor = (tradition: string): string => {
    return TRADITION_COLORS[tradition as keyof typeof TRADITION_COLORS] || '#6b7280';
  };

  const getConfidenceLabel = (confidence: number): { label: string; variant: 'default' | 'secondary' | 'outline' } => {
    if (confidence >= 0.8) return { label: 'High', variant: 'default' };
    if (confidence >= 0.5) return { label: 'Medium', variant: 'secondary' };
    return { label: 'Low', variant: 'outline' };
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  if (!entity) {
    return (
      <Card className="timeline-details-empty">
        <CardContent className="p-6">
          <div className="text-center text-muted-foreground">
            <p className="mb-2">No entity selected</p>
            <p className="text-sm">
              Click on a timeline item to view details
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const confidence = parseFloat(entity.confidence);
  const confidenceInfo = getConfidenceLabel(confidence);
  const dates = getEntityDates();
  const traditions = entity.attributes?.tradition || [];
  const names = typeof entity.names === 'string' ? JSON.parse(entity.names) : entity.names || {};

  return (
    <Card className="timeline-details">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-lg mb-1">
              {entity.canonicalName || entity.canonical_name}
            </CardTitle>
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="secondary" className="capitalize">
                {entity.type}
              </Badge>
              <Badge variant={confidenceInfo.variant}>
                {confidenceInfo.label} ({Math.round(confidence * 100)}%)
              </Badge>
            </div>
          </div>
          {onClose && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={onClose}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent>
        <ScrollArea className="h-[500px] pr-4">
          <div className="space-y-4">
            {/* Names */}
            {names && Object.keys(names).length > 0 && (
              <div>
                <h4 className="text-sm font-semibold mb-2">Names</h4>
                <div className="space-y-1 text-sm">
                  {names.tibetan?.length > 0 && (
                    <p>
                      <span className="text-muted-foreground">Tibetan:</span>{' '}
                      {names.tibetan.join(', ')}
                    </p>
                  )}
                  {names.wylie?.length > 0 && (
                    <p>
                      <span className="text-muted-foreground">Wylie:</span>{' '}
                      {names.wylie.join(', ')}
                    </p>
                  )}
                  {names.english?.length > 0 && (
                    <p>
                      <span className="text-muted-foreground">English:</span>{' '}
                      {names.english.join(', ')}
                    </p>
                  )}
                  {names.phonetic?.length > 0 && (
                    <p>
                      <span className="text-muted-foreground">Phonetic:</span>{' '}
                      {names.phonetic.join(', ')}
                    </p>
                  )}
                </div>
              </div>
            )}

            <Separator />

            {/* Dates */}
            {dates && (
              <div>
                <h4 className="text-sm font-semibold mb-2">Dates</h4>
                <div className="space-y-1 text-sm">
                  {dates.birth && (
                    <p>
                      <span className="text-muted-foreground">Birth:</span> {dates.birth}
                    </p>
                  )}
                  {dates.death && (
                    <p>
                      <span className="text-muted-foreground">Death:</span> {dates.death}
                    </p>
                  )}
                  {dates.composed && (
                    <p>
                      <span className="text-muted-foreground">Composed:</span> {dates.composed}
                    </p>
                  )}
                  {dates.founded && (
                    <p>
                      <span className="text-muted-foreground">Founded:</span> {dates.founded}
                    </p>
                  )}
                  {dates.occurred && (
                    <p>
                      <span className="text-muted-foreground">Occurred:</span> {dates.occurred}
                    </p>
                  )}
                </div>
              </div>
            )}

            {dates && <Separator />}

            {/* Traditions */}
            {traditions.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold mb-2">Traditions</h4>
                <div className="flex flex-wrap gap-2">
                  {traditions.map((tradition: string) => (
                    <Badge
                      key={tradition}
                      variant="outline"
                      style={{
                        borderColor: getTraditionColor(tradition),
                        color: getTraditionColor(tradition)
                      }}
                    >
                      {tradition}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {traditions.length > 0 && <Separator />}

            {/* Location */}
            {entity.attributes?.location && (
              <div>
                <h4 className="text-sm font-semibold mb-2">Location</h4>
                <p className="text-sm">{entity.attributes.location}</p>
              </div>
            )}

            {entity.attributes?.location && <Separator />}

            {/* Additional Attributes */}
            {entity.attributes && (
              <div>
                <h4 className="text-sm font-semibold mb-2">Additional Information</h4>
                <div className="space-y-1 text-sm">
                  {entity.attributes.description && (
                    <p className="text-muted-foreground">
                      {entity.attributes.description}
                    </p>
                  )}
                  {entity.attributes.title && (
                    <p>
                      <span className="text-muted-foreground">Title:</span>{' '}
                      {entity.attributes.title}
                    </p>
                  )}
                  {entity.attributes.region && (
                    <p>
                      <span className="text-muted-foreground">Region:</span>{' '}
                      {Array.isArray(entity.attributes.region)
                        ? entity.attributes.region.join(', ')
                        : entity.attributes.region}
                    </p>
                  )}
                </div>
              </div>
            )}

            <Separator />

            {/* Metadata */}
            <div>
              <h4 className="text-sm font-semibold mb-2">Metadata</h4>
              <div className="space-y-1 text-sm">
                <p>
                  <span className="text-muted-foreground">ID:</span>{' '}
                  <code className="text-xs bg-muted px-1 py-0.5 rounded">
                    {entity.id}
                  </code>
                </p>
                <p>
                  <span className="text-muted-foreground">Verified:</span>{' '}
                  {entity.verified ? 'Yes' : 'No'}
                </p>
                {entity.verifiedBy && (
                  <p>
                    <span className="text-muted-foreground">Verified by:</span>{' '}
                    {entity.verifiedBy}
                  </p>
                )}
                {entity.createdBy && (
                  <p>
                    <span className="text-muted-foreground">Created by:</span>{' '}
                    {entity.createdBy}
                  </p>
                )}
              </div>
            </div>

            <Separator />

            {/* Actions */}
            <div className="space-y-2">
              {entity.type === 'person' && onShowLineage && (
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => onShowLineage(entity.id)}
                >
                  <Users className="mr-2 h-4 w-4" />
                  Show Lineage
                </Button>
              )}

              {onShowMap && (entity.attributes?.location || entity.attributes?.coordinates) && (
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => onShowMap(entity.id)}
                >
                  <MapPin className="mr-2 h-4 w-4" />
                  Show on Map
                </Button>
              )}

              <Button
                variant="outline"
                className="w-full justify-start"
                asChild
              >
                <a href={`/entity/${entity.id}`} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="mr-2 h-4 w-4" />
                  View Full Details
                </a>
              </Button>
            </div>
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
