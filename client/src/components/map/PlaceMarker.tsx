import { Marker, Popup, Tooltip } from 'react-leaflet';
import type { Place } from '../../hooks/useMapData';
import { createPlaceIcon, PLACE_ICONS, type PlaceType } from '../../lib/mapConfig';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';

interface PlaceMarkerProps {
  place: Place;
  onClick: (place: Place) => void;
  showTooltip?: boolean;
}

export function PlaceMarker({ place, onClick, showTooltip = false }: PlaceMarkerProps) {
  const { latitude, longitude, place_type, tradition, tibetan_name, founded_year } = place.attributes;

  // Create custom icon
  const icon = createPlaceIcon(place_type as PlaceType, tradition);

  // Handle click
  const handleClick = () => {
    onClick(place);
  };

  // Format year display
  const formatYear = (year: number) => {
    if (year < 0) return `${Math.abs(year)} BCE`;
    return `${year} CE`;
  };

  return (
    <Marker
      position={[latitude, longitude]}
      icon={icon}
      eventHandlers={{
        click: handleClick
      }}
    >
      {showTooltip && (
        <Tooltip direction="top" offset={[0, -30]} opacity={0.9}>
          <div className="font-medium">{place.canonical_name}</div>
        </Tooltip>
      )}

      <Popup className="place-popup" maxWidth={300}>
        <div className="space-y-3">
          {/* Header */}
          <div className="border-b pb-2">
            <h4 className="text-lg font-semibold text-gray-900">
              {place.canonical_name}
            </h4>
            {tibetan_name && (
              <p className="text-sm text-gray-600 tibetan-font mt-1">
                {tibetan_name}
              </p>
            )}
          </div>

          {/* Details */}
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-2xl">{PLACE_ICONS[place_type as PlaceType] || '📍'}</span>
              <div>
                <p className="font-medium text-gray-700 capitalize">
                  {place_type.replace('_', ' ')}
                </p>
                {place.attributes.region && (
                  <p className="text-gray-500 text-xs">{place.attributes.region}</p>
                )}
              </div>
            </div>

            {founded_year && (
              <div className="flex items-center gap-2 text-gray-600">
                <span className="text-sm">📅</span>
                <span>Founded: {formatYear(founded_year)}</span>
              </div>
            )}

            {tradition && (
              <div className="flex items-center gap-2">
                <span className="text-sm">🏛️</span>
                <Badge variant="secondary" className="text-xs">
                  {tradition}
                </Badge>
              </div>
            )}

            {place.attributes.altitude && (
              <div className="flex items-center gap-2 text-gray-600">
                <span className="text-sm">⛰️</span>
                <span>{place.attributes.altitude}m elevation</span>
              </div>
            )}

            <div className="flex items-center gap-2 text-gray-500 text-xs">
              <span>📍</span>
              <span>
                {latitude.toFixed(4)}°, {longitude.toFixed(4)}°
              </span>
            </div>
          </div>

          {/* Metadata */}
          {place.metadata && (
            <div className="pt-2 border-t text-xs text-gray-500">
              <div className="flex items-center justify-between">
                <span>Confidence: {Math.round(place.metadata.confidence * 100)}%</span>
                <span>{place.metadata.source_count} sources</span>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="pt-2 flex gap-2">
            <Button
              size="sm"
              variant="outline"
              className="flex-1 text-xs"
              onClick={(e) => {
                e.stopPropagation();
                onClick(place);
              }}
            >
              View Details
            </Button>
          </div>
        </div>
      </Popup>
    </Marker>
  );
}

// Simplified marker for clustering (less detail)
export function SimpleMarker({ place, onClick }: PlaceMarkerProps) {
  const { latitude, longitude, place_type, tradition } = place.attributes;
  const icon = createPlaceIcon(place_type as PlaceType, tradition);

  return (
    <Marker
      position={[latitude, longitude]}
      icon={icon}
      eventHandlers={{
        click: () => onClick(place)
      }}
    >
      <Tooltip direction="top" offset={[0, -30]} opacity={0.9}>
        <div className="text-sm font-medium">{place.canonical_name}</div>
      </Tooltip>
    </Marker>
  );
}

// Marker for search results (highlighted)
export function HighlightedMarker({ place, onClick }: PlaceMarkerProps) {
  const { latitude, longitude } = place.attributes;

  return (
    <Marker
      position={[latitude, longitude]}
      icon={createPlaceIcon(place.attributes.place_type as PlaceType, place.attributes.tradition)}
      eventHandlers={{
        click: () => onClick(place)
      }}
      zIndexOffset={1000} // Bring to front
    >
      <Popup autoClose={false} closeOnClick={false}>
        <div className="p-2">
          <h4 className="font-semibold">{place.canonical_name}</h4>
          <p className="text-sm text-gray-600 capitalize">
            {place.attributes.place_type.replace('_', ' ')}
          </p>
          <Button
            size="sm"
            className="mt-2 w-full"
            onClick={(e) => {
              e.stopPropagation();
              onClick(place);
            }}
          >
            View Details
          </Button>
        </div>
      </Popup>
    </Marker>
  );
}
