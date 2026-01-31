import { useState, useRef, useCallback, useEffect } from 'react';
import { MapContainer, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import type { Map as LeafletMap } from 'leaflet';
import 'leaflet/dist/leaflet.css';

import { useMapData, useSearchPlaces, type Place } from '../../hooks/useMapData';
import { PlaceMarker, SimpleMarker, HighlightedMarker } from './PlaceMarker';
import { JourneyRoute } from './JourneyRoute';
import { HeatMapLayer } from './HeatMapLayer';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import {
  MAP_CONFIG,
  TILE_LAYERS,
  createClusterCustomIcon,
  type MapFilters,
  DEFAULT_MAP_FILTERS
} from '../../lib/mapConfig';

interface GeographicMapProps {
  center?: [number, number];
  zoom?: number;
  initialFilters?: Partial<MapFilters>;
  onMarkerClick?: (place: Place) => void;
  selectedPlace?: Place | null;
  selectedPersonId?: string;
}

// Component to handle map events and update bounds
function MapEventsHandler({ onBoundsChange }: { onBoundsChange: (bounds: any) => void }) {
  const map = useMapEvents({
    moveend: () => {
      onBoundsChange(map.getBounds());
    },
    zoomend: () => {
      onBoundsChange(map.getBounds());
    }
  });

  useEffect(() => {
    // Initial bounds
    onBoundsChange(map.getBounds());
  }, [map, onBoundsChange]);

  return null;
}

// Component to handle flying to locations
function FlyToHandler({ target, zoom }: { target: [number, number] | null; zoom?: number }) {
  const map = useMap();

  useEffect(() => {
    if (target) {
      map.flyTo(target, zoom || map.getZoom(), {
        duration: 1.5
      });
    }
  }, [target, zoom, map]);

  return null;
}

// Search component
function MapSearch({
  onPlaceSelect,
  onClear
}: {
  onPlaceSelect: (place: Place) => void;
  onClear: () => void;
}) {
  const [query, setQuery] = useState('');
  const { data: results, isLoading } = useSearchPlaces(query);

  return (
    <div className="map-search absolute top-4 left-1/2 transform -translate-x-1/2 z-[1000] w-full max-w-md px-4">
      <div className="bg-white rounded-lg shadow-lg">
        <div className="flex items-center gap-2 p-2">
          <Input
            type="text"
            placeholder="Search places..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1"
          />
          {query && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setQuery('');
                onClear();
              }}
            >
              Clear
            </Button>
          )}
        </div>

        {query && results && results.length > 0 && (
          <div className="border-t max-h-64 overflow-y-auto">
            {results.map((place) => (
              <button
                key={place.id}
                className="w-full text-left px-4 py-2 hover:bg-gray-100 transition"
                onClick={() => {
                  onPlaceSelect(place);
                  setQuery('');
                }}
              >
                <div className="font-medium">{place.canonical_name}</div>
                <div className="text-sm text-gray-600 capitalize">
                  {place.attributes.place_type.replace('_', ' ')}
                  {place.attributes.region && ` • ${place.attributes.region}`}
                </div>
              </button>
            ))}
          </div>
        )}

        {query && !isLoading && results && results.length === 0 && (
          <div className="border-t px-4 py-3 text-sm text-gray-500">
            No places found
          </div>
        )}

        {isLoading && (
          <div className="border-t px-4 py-3 text-sm text-gray-500">
            Searching...
          </div>
        )}
      </div>
    </div>
  );
}

// Loading overlay
function LoadingOverlay({ isLoading }: { isLoading: boolean }) {
  if (!isLoading) return null;

  return (
    <div className="absolute top-20 right-4 z-[1000]">
      <Badge variant="secondary" className="bg-white shadow-md">
        Loading places...
      </Badge>
    </div>
  );
}

// Main map component
export function GeographicMap({
  center = MAP_CONFIG.center,
  zoom = MAP_CONFIG.zoom,
  initialFilters,
  onMarkerClick,
  selectedPlace,
  selectedPersonId
}: GeographicMapProps) {
  const [bounds, setBounds] = useState<any>(null);
  const [filters, setFilters] = useState<MapFilters>({
    ...DEFAULT_MAP_FILTERS,
    ...initialFilters
  });
  const [flyToTarget, setFlyToTarget] = useState<[number, number] | null>(null);
  const [highlightedPlace, setHighlightedPlace] = useState<Place | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);

  // Fetch map data
  const { places, journey, heatMapData, isLoading } = useMapData({
    bounds,
    filters,
    selectedPersonId
  });

  // Handle marker click
  const handleMarkerClick = useCallback((place: Place) => {
    onMarkerClick?.(place);
    setHighlightedPlace(null);
  }, [onMarkerClick]);

  // Handle search result selection
  const handleSearchSelect = useCallback((place: Place) => {
    setHighlightedPlace(place);
    setFlyToTarget([place.attributes.latitude, place.attributes.longitude]);
    onMarkerClick?.(place);
  }, [onMarkerClick]);

  // Handle search clear
  const handleSearchClear = useCallback(() => {
    setHighlightedPlace(null);
  }, []);

  // Handle bounds change
  const handleBoundsChange = useCallback((newBounds: any) => {
    setBounds(newBounds);
  }, []);

  // Fly to location helper
  const flyTo = useCallback((coords: [number, number], zoomLevel?: number) => {
    setFlyToTarget(coords);
    if (zoomLevel && mapRef.current) {
      setTimeout(() => {
        mapRef.current?.setZoom(zoomLevel);
      }, 100);
    }
  }, []);

  // Get tile layer configuration
  const tileLayerConfig = TILE_LAYERS[filters.tileLayer];

  return (
    <div className="geographic-map relative w-full h-full">
      <MapContainer
        center={center}
        zoom={zoom}
        minZoom={MAP_CONFIG.minZoom}
        maxZoom={MAP_CONFIG.maxZoom}
        maxBounds={MAP_CONFIG.maxBounds}
        className="w-full h-full"
        ref={mapRef}
      >
        {/* Tile Layer */}
        <TileLayer
          url={tileLayerConfig.url}
          attribution={tileLayerConfig.attribution}
        />

        {/* Map Event Handlers */}
        <MapEventsHandler onBoundsChange={handleBoundsChange} />
        <FlyToHandler target={flyToTarget} zoom={zoom} />

        {/* Heat Map Layer */}
        {filters.showHeatMap && heatMapData.length > 0 && (
          <HeatMapLayer points={heatMapData} />
        )}

        {/* Journey Routes */}
        {filters.showJourneys && journey && (
          <JourneyRoute journey={journey} animated={true} />
        )}

        {/* Place Markers */}
        {filters.showClusters ? (
          <MarkerClusterGroup
            chunkedLoading
            maxClusterRadius={50}
            showCoverageOnHover={false}
            iconCreateFunction={createClusterCustomIcon}
          >
            {places.map((place) => (
              <SimpleMarker
                key={place.id}
                place={place}
                onClick={handleMarkerClick}
              />
            ))}
          </MarkerClusterGroup>
        ) : (
          <>
            {places.map((place) => (
              <PlaceMarker
                key={place.id}
                place={place}
                onClick={handleMarkerClick}
                showTooltip={places.length < 50}
              />
            ))}
          </>
        )}

        {/* Highlighted Place (from search) */}
        {highlightedPlace && (
          <HighlightedMarker
            place={highlightedPlace}
            onClick={handleMarkerClick}
          />
        )}

        {/* Selected Place Highlight */}
        {selectedPlace && (
          <HighlightedMarker
            place={selectedPlace}
            onClick={handleMarkerClick}
          />
        )}
      </MapContainer>

      {/* Search Bar */}
      <MapSearch
        onPlaceSelect={handleSearchSelect}
        onClear={handleSearchClear}
      />

      {/* Loading Indicator */}
      <LoadingOverlay isLoading={isLoading} />

      {/* Map Info */}
      <div className="absolute bottom-4 left-4 z-[1000]">
        <div className="bg-white px-3 py-2 rounded-lg shadow-md text-sm">
          <div className="flex items-center gap-4">
            <div>
              <span className="text-gray-600">Places: </span>
              <span className="font-semibold">{places.length}</span>
            </div>
            {journey && (
              <div>
                <span className="text-gray-600">Journey Stops: </span>
                <span className="font-semibold">{journey.stops.length}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Export helper to access map methods from parent
export interface MapHandle {
  flyTo: (coords: [number, number], zoom?: number) => void;
  setFilters: (filters: MapFilters) => void;
  getFilters: () => MapFilters;
}

export function GeographicMapWithControls({
  onMarkerClick,
  selectedPlace,
  selectedPersonId
}: Omit<GeographicMapProps, 'center' | 'zoom' | 'initialFilters'>) {
  const [filters, setFilters] = useState<MapFilters>(DEFAULT_MAP_FILTERS);
  const [flyToTarget, setFlyToTarget] = useState<[number, number] | null>(null);

  const handleFlyTo = useCallback((coords: [number, number], zoom?: number) => {
    setFlyToTarget(coords);
  }, []);

  return (
    <GeographicMap
      center={MAP_CONFIG.center}
      zoom={MAP_CONFIG.zoom}
      initialFilters={filters}
      onMarkerClick={onMarkerClick}
      selectedPlace={selectedPlace}
      selectedPersonId={selectedPersonId}
    />
  );
}
