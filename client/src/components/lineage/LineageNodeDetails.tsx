/**
 * LineageNodeDetails
 *
 * Details panel showing comprehensive information about a selected node
 * in the lineage graph, including names, dates, relationships, and actions.
 */

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  User,
  Calendar,
  MapPin,
  BookOpen,
  Users,
  ArrowRight,
  ExternalLink,
  Expand,
  Check,
} from 'lucide-react';
import type { Entity, Relationship } from '../../hooks/useLineage';

// ============================================================================
// Types
// ============================================================================

export interface LineageNodeDetailsProps {
  entity: Entity | null;
  relationships?: {
    teachers: Array<{ entity: Entity; relationship: Relationship }>;
    students: Array<{ entity: Entity; relationship: Relationship }>;
    incarnations: Array<{ entity: Entity; relationship: Relationship }>;
  };
  onExpandNode?: (entityId: string) => void;
  onFocusNode?: (entityId: string) => void;
  onViewFullProfile?: (entityId: string) => void;
}

// ============================================================================
// Component
// ============================================================================

export function LineageNodeDetails({
  entity,
  relationships,
  onExpandNode,
  onFocusNode,
  onViewFullProfile,
}: LineageNodeDetailsProps) {
  if (!entity) {
    return (
      <Card className="lineage-node-details h-full">
        <CardContent className="flex items-center justify-center h-full text-muted-foreground">
          <div className="text-center">
            <User className="h-12 w-12 mx-auto mb-2 opacity-30" />
            <p className="text-sm">Select a node to view details</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="lineage-node-details h-full">
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <CardTitle className="text-lg truncate">{entity.canonical_name}</CardTitle>
            {entity.attributes.wylie_name && (
              <CardDescription className="text-sm italic">
                {entity.attributes.wylie_name}
              </CardDescription>
            )}
          </div>
          {entity.verified && (
            <Badge variant="default" className="flex-shrink-0">
              <Check className="h-3 w-3 mr-1" />
              Verified
            </Badge>
          )}
        </div>
      </CardHeader>

      <ScrollArea className="flex-1">
        <CardContent className="space-y-6">
          {/* Tibetan Name */}
          {entity.attributes.tibetan_name && (
            <div>
              <h4 className="text-sm font-medium mb-2">Tibetan Name</h4>
              <p className="text-lg font-tibetan" style={{ fontFamily: 'Jomolhari, serif' }}>
                {entity.attributes.tibetan_name}
              </p>
            </div>
          )}

          <Separator />

          {/* Dates */}
          {(entity.attributes.birth_year || entity.attributes.death_year) && (
            <>
              <div>
                <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Lifespan
                </h4>
                <p className="text-sm text-muted-foreground">
                  {entity.attributes.birth_year || '?'} - {entity.attributes.death_year || '?'}
                </p>
              </div>
              <Separator />
            </>
          )}

          {/* Tradition */}
          {entity.attributes.tradition && entity.attributes.tradition.length > 0 && (
            <>
              <div>
                <h4 className="text-sm font-medium mb-2">Tradition</h4>
                <div className="flex flex-wrap gap-2">
                  {entity.attributes.tradition.map((tradition) => (
                    <Badge key={tradition} variant="secondary">
                      {tradition}
                    </Badge>
                  ))}
                </div>
              </div>
              <Separator />
            </>
          )}

          {/* Roles */}
          {entity.attributes.roles && entity.attributes.roles.length > 0 && (
            <>
              <div>
                <h4 className="text-sm font-medium mb-2">Roles</h4>
                <div className="flex flex-wrap gap-2">
                  {entity.attributes.roles.map((role) => (
                    <Badge key={role} variant="outline">
                      {role}
                    </Badge>
                  ))}
                </div>
              </div>
              <Separator />
            </>
          )}

          {/* Teachers */}
          {relationships?.teachers && relationships.teachers.length > 0 && (
            <>
              <div>
                <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Teachers ({relationships.teachers.length})
                </h4>
                <div className="space-y-2">
                  {relationships.teachers.slice(0, 5).map(({ entity: teacher }) => (
                    <button
                      key={teacher.id}
                      onClick={() => onFocusNode?.(teacher.id)}
                      className="w-full flex items-center justify-between p-2 rounded hover:bg-accent text-left text-sm group"
                    >
                      <span className="truncate">{teacher.canonical_name}</span>
                      <ArrowRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </button>
                  ))}
                  {relationships.teachers.length > 5 && (
                    <p className="text-xs text-muted-foreground text-center">
                      +{relationships.teachers.length - 5} more
                    </p>
                  )}
                </div>
              </div>
              <Separator />
            </>
          )}

          {/* Students */}
          {relationships?.students && relationships.students.length > 0 && (
            <>
              <div>
                <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Students ({relationships.students.length})
                </h4>
                <div className="space-y-2">
                  {relationships.students.slice(0, 5).map(({ entity: student }) => (
                    <button
                      key={student.id}
                      onClick={() => onFocusNode?.(student.id)}
                      className="w-full flex items-center justify-between p-2 rounded hover:bg-accent text-left text-sm group"
                    >
                      <span className="truncate">{student.canonical_name}</span>
                      <ArrowRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </button>
                  ))}
                  {relationships.students.length > 5 && (
                    <p className="text-xs text-muted-foreground text-center">
                      +{relationships.students.length - 5} more
                    </p>
                  )}
                </div>
              </div>
              <Separator />
            </>
          )}

          {/* Incarnations */}
          {relationships?.incarnations && relationships.incarnations.length > 0 && (
            <>
              <div>
                <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                  <BookOpen className="h-4 w-4" />
                  Incarnation Line
                </h4>
                <div className="space-y-2">
                  {relationships.incarnations.map(({ entity: incarnation }) => (
                    <button
                      key={incarnation.id}
                      onClick={() => onFocusNode?.(incarnation.id)}
                      className="w-full flex items-center justify-between p-2 rounded hover:bg-accent text-left text-sm group"
                    >
                      <span className="truncate">{incarnation.canonical_name}</span>
                      <ArrowRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </button>
                  ))}
                </div>
              </div>
              <Separator />
            </>
          )}

          {/* Confidence */}
          <div>
            <h4 className="text-sm font-medium mb-2">Confidence</h4>
            <div className="flex items-center gap-2">
              <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden">
                <div
                  className="h-full bg-primary transition-all"
                  style={{ width: `${entity.confidence * 100}%` }}
                />
              </div>
              <span className="text-sm font-medium">{Math.round(entity.confidence * 100)}%</span>
            </div>
          </div>
        </CardContent>
      </ScrollArea>

      {/* Actions */}
      <CardContent className="pt-0">
        <Separator className="mb-4" />
        <div className="space-y-2">
          {onExpandNode && (
            <Button
              variant="outline"
              className="w-full"
              onClick={() => onExpandNode(entity.id)}
            >
              <Expand className="h-4 w-4 mr-2" />
              Expand Lineage
            </Button>
          )}
          {onViewFullProfile && (
            <Button
              variant="default"
              className="w-full"
              onClick={() => onViewFullProfile(entity.id)}
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              View Full Profile
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Compact Details (for mobile)
// ============================================================================

export interface CompactLineageNodeDetailsProps {
  entity: Entity | null;
  onClose: () => void;
  onExpandNode?: (entityId: string) => void;
}

export function CompactLineageNodeDetails({
  entity,
  onClose,
  onExpandNode,
}: CompactLineageNodeDetailsProps) {
  if (!entity) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 bg-background border-t shadow-lg p-4">
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-sm truncate">{entity.canonical_name}</h3>
          {entity.attributes.wylie_name && (
            <p className="text-xs text-muted-foreground italic truncate">
              {entity.attributes.wylie_name}
            </p>
          )}
        </div>
        <Button variant="ghost" size="sm" onClick={onClose} className="h-7 w-7 p-0">
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex items-center gap-2 mb-3 text-xs text-muted-foreground">
        {entity.attributes.birth_year && entity.attributes.death_year && (
          <span>
            {entity.attributes.birth_year} - {entity.attributes.death_year}
          </span>
        )}
        {entity.attributes.tradition && entity.attributes.tradition.length > 0 && (
          <Badge variant="secondary" className="text-xs">
            {entity.attributes.tradition[0]}
          </Badge>
        )}
      </div>

      {onExpandNode && (
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={() => onExpandNode(entity.id)}
        >
          <Expand className="h-3 w-3 mr-2" />
          Expand Lineage
        </Button>
      )}
    </div>
  );
}
