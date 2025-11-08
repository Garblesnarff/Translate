import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { ScrollArea } from '../ui/scroll-area';
import { Separator } from '../ui/separator';
import { Skeleton } from '../ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import type { Place } from '../../hooks/useMapData';
import { usePlaceDetails, useNearbyPlaces } from '../../hooks/useMapData';
import { PLACE_ICONS, type PlaceType } from '../../lib/mapConfig';

interface PlaceDetailsProps {
  place: Place | null;
  onClose: () => void;
  onPlaceSelect?: (place: Place) => void;
  onShowNearby?: (place: Place) => void;
  onShowEntities?: (placeId: string) => void;
}

export function PlaceDetails({
  place,
  onClose,
  onPlaceSelect,
  onShowNearby,
  onShowEntities
}: PlaceDetailsProps) {
  const { data: details, isLoading: detailsLoading } = usePlaceDetails(place?.id || null);
  const { data: nearbyPlaces, isLoading: nearbyLoading } = useNearbyPlaces(
    place?.attributes.latitude || null,
    place?.attributes.longitude || null,
    50
  );

  if (!place) {
    return (
      <div className="place-details-empty flex items-center justify-center h-full text-gray-500">
        <div className="text-center">
          <div className="text-4xl mb-2">📍</div>
          <p className="text-sm">Select a place to view details</p>
        </div>
      </div>
    );
  }

  const formatYear = (year: number) => {
    if (year < 0) return `${Math.abs(year)} BCE`;
    return `${year} CE`;
  };

  return (
    <div className="place-details bg-white rounded-lg shadow-lg h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b">
        <div className="flex items-start justify-between mb-2">
          <div className="flex-1">
            <h3 className="text-xl font-bold text-gray-900">
              {place.canonical_name}
            </h3>
            {place.attributes.tibetan_name && (
              <p className="text-sm text-gray-600 tibetan-font mt-1">
                {place.attributes.tibetan_name}
              </p>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="ml-2"
          >
            ✕
          </Button>
        </div>

        {/* Aliases */}
        {place.aliases && place.aliases.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {place.aliases.slice(0, 3).map((alias, i) => (
              <Badge key={i} variant="outline" className="text-xs">
                {alias}
              </Badge>
            ))}
          </div>
        )}
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-6">
          {/* Basic Information */}
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <span className="text-3xl">
                {PLACE_ICONS[place.attributes.place_type as PlaceType] || '📍'}
              </span>
              <div>
                <p className="font-semibold capitalize">
                  {place.attributes.place_type.replace('_', ' ')}
                </p>
                {place.attributes.region && (
                  <p className="text-sm text-gray-600">{place.attributes.region}</p>
                )}
              </div>
            </div>

            {place.attributes.tradition && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600">Tradition:</span>
                <Badge variant="secondary">{place.attributes.tradition}</Badge>
              </div>
            )}

            {place.attributes.founded_year && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600">Founded:</span>
                <span className="font-medium">
                  {formatYear(place.attributes.founded_year)}
                </span>
              </div>
            )}

            {place.attributes.altitude && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600">Elevation:</span>
                <span className="font-medium">{place.attributes.altitude}m</span>
              </div>
            )}
          </div>

          <Separator />

          {/* Coordinates */}
          <div className="space-y-2">
            <h4 className="font-semibold text-sm">Location</h4>
            <div className="bg-gray-50 p-3 rounded text-sm space-y-1">
              <div className="flex justify-between">
                <span className="text-gray-600">Latitude:</span>
                <span className="font-mono">{place.attributes.latitude.toFixed(4)}°</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Longitude:</span>
                <span className="font-mono">{place.attributes.longitude.toFixed(4)}°</span>
              </div>
            </div>
          </div>

          <Separator />

          {/* Related Entities */}
          {detailsLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          ) : details ? (
            <div className="space-y-3">
              <h4 className="font-semibold text-sm">Related Entities</h4>

              <div className="grid grid-cols-3 gap-2">
                <Card>
                  <CardHeader className="p-3 pb-2">
                    <CardTitle className="text-xs text-gray-600">People</CardTitle>
                  </CardHeader>
                  <CardContent className="p-3 pt-0">
                    <div className="text-2xl font-bold">
                      {details.relatedPeople?.length || 0}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="p-3 pb-2">
                    <CardTitle className="text-xs text-gray-600">Texts</CardTitle>
                  </CardHeader>
                  <CardContent className="p-3 pt-0">
                    <div className="text-2xl font-bold">
                      {details.relatedTexts?.length || 0}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="p-3 pb-2">
                    <CardTitle className="text-xs text-gray-600">Events</CardTitle>
                  </CardHeader>
                  <CardContent className="p-3 pt-0">
                    <div className="text-2xl font-bold">
                      {details.relatedEvents?.length || 0}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Top related people */}
              {details.relatedPeople && details.relatedPeople.length > 0 && (
                <div className="mt-3">
                  <h5 className="text-xs font-semibold text-gray-600 mb-2">
                    Associated People
                  </h5>
                  <div className="space-y-1">
                    {details.relatedPeople.slice(0, 5).map((person: any) => (
                      <div
                        key={person.id}
                        className="text-sm p-2 bg-gray-50 rounded hover:bg-gray-100 cursor-pointer"
                        onClick={() => onPlaceSelect?.(person)}
                      >
                        {person.canonical_name}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : null}

          <Separator />

          {/* Nearby Places */}
          {nearbyLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          ) : nearbyPlaces && nearbyPlaces.length > 0 ? (
            <div className="space-y-3">
              <h4 className="font-semibold text-sm">
                Nearby Places ({nearbyPlaces.length - 1})
              </h4>
              <div className="space-y-1">
                {nearbyPlaces
                  .filter(p => p.id !== place.id)
                  .slice(0, 5)
                  .map((nearby) => (
                    <div
                      key={nearby.id}
                      className="text-sm p-2 bg-gray-50 rounded hover:bg-gray-100 cursor-pointer flex items-center gap-2"
                      onClick={() => onPlaceSelect?.(nearby)}
                    >
                      <span>
                        {PLACE_ICONS[nearby.attributes.place_type as PlaceType] || '📍'}
                      </span>
                      <span className="flex-1">{nearby.canonical_name}</span>
                      <span className="text-xs text-gray-500">
                        {nearby.attributes.region}
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          ) : null}

          <Separator />

          {/* Metadata */}
          <div className="space-y-2">
            <h4 className="font-semibold text-sm">Metadata</h4>
            <div className="bg-gray-50 p-3 rounded text-xs space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-600">Confidence:</span>
                <span className="font-medium">
                  {Math.round(place.metadata.confidence * 100)}%
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Sources:</span>
                <span className="font-medium">{place.metadata.source_count}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Last Updated:</span>
                <span className="font-medium">
                  {new Date(place.metadata.last_updated).toLocaleDateString()}
                </span>
              </div>
            </div>
          </div>
        </div>
      </ScrollArea>

      {/* Actions */}
      <div className="p-4 border-t space-y-2">
        <Button
          className="w-full"
          onClick={() => onShowEntities?.(place.id)}
        >
          View All Entities
        </Button>
        <Button
          variant="outline"
          className="w-full"
          onClick={() => onShowNearby?.(place)}
        >
          Show Nearby (50km)
        </Button>
      </div>
    </div>
  );
}

// Compact version for sidebar
export function PlaceDetailsMini({ place }: { place: Place }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <span>
            {PLACE_ICONS[place.attributes.place_type as PlaceType] || '📍'}
          </span>
          {place.canonical_name}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        {place.attributes.tibetan_name && (
          <p className="text-gray-600 tibetan-font">
            {place.attributes.tibetan_name}
          </p>
        )}
        <div className="flex items-center justify-between">
          <span className="text-gray-600">Type:</span>
          <span className="capitalize">{place.attributes.place_type.replace('_', ' ')}</span>
        </div>
        {place.attributes.founded_year && (
          <div className="flex items-center justify-between">
            <span className="text-gray-600">Founded:</span>
            <span>{place.attributes.founded_year} CE</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
