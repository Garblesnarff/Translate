import { useState, useCallback } from 'react';
import { GeographicMap } from '../components/map/GeographicMap';
import { MapControls } from '../components/map/MapControls';
import { PlaceDetails } from '../components/map/PlaceDetails';
import type { Place } from '../hooks/useMapData';
import { DEFAULT_MAP_FILTERS, type MapFilters } from '../lib/mapConfig';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';

export function MapPage() {
  const [selectedPlace, setSelectedPlace] = useState<Place | null>(null);
  const [filters, setFilters] = useState<MapFilters>(DEFAULT_MAP_FILTERS);
  const [flyToTarget, setFlyToTarget] = useState<{ coords: [number, number]; zoom?: number } | null>(null);
  const [showControls, setShowControls] = useState(true);
  const [showDetails, setShowDetails] = useState(true);

  // Handle place selection
  const handlePlaceSelect = useCallback((place: Place) => {
    setSelectedPlace(place);
    setShowDetails(true);
  }, []);

  // Handle close details
  const handleCloseDetails = useCallback(() => {
    setSelectedPlace(null);
  }, []);

  // Handle show nearby
  const handleShowNearby = useCallback((place: Place) => {
    setFlyToTarget({
      coords: [place.attributes.latitude, place.attributes.longitude],
      zoom: 11
    });
  }, []);

  // Handle fly to location
  const handleFlyTo = useCallback((coords: [number, number], zoom?: number) => {
    setFlyToTarget({ coords, zoom });
    // Clear after use
    setTimeout(() => setFlyToTarget(null), 100);
  }, []);

  // Calculate place count from filters
  const getPlaceTypeCount = () => {
    return filters.placeTypes.length;
  };

  return (
    <div className="map-page h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b px-6 py-4 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Geographic Explorer
            </h1>
            <p className="text-sm text-gray-600 mt-1">
              Explore sacred sites and monasteries across Tibet
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Filter summary */}
            <div className="flex items-center gap-2">
              <Badge variant="secondary">
                {filters.placeTypes.length} place types
              </Badge>
              <Badge variant="secondary">
                {filters.timeRange.start}-{filters.timeRange.end} CE
              </Badge>
              {filters.traditions.length > 0 && (
                <Badge variant="secondary">
                  {filters.traditions.length} traditions
                </Badge>
              )}
            </div>

            {/* Toggle controls */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowControls(!showControls)}
            >
              {showControls ? 'Hide' : 'Show'} Controls
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Map Controls Panel */}
        {showControls && (
          <aside className="w-80 bg-white border-r flex-shrink-0 overflow-hidden">
            <MapControls
              filters={filters}
              onFiltersChange={setFilters}
              onFlyTo={handleFlyTo}
              placeCount={getPlaceTypeCount()}
            />
          </aside>
        )}

        {/* Map Container */}
        <main className="flex-1 relative">
          <GeographicMap
            initialFilters={filters}
            onMarkerClick={handlePlaceSelect}
            selectedPlace={selectedPlace}
          />

          {/* Toggle details button (mobile) */}
          {selectedPlace && !showDetails && (
            <Button
              className="absolute bottom-4 right-4 z-[1000]"
              onClick={() => setShowDetails(true)}
            >
              Show Details
            </Button>
          )}
        </main>

        {/* Place Details Panel */}
        {showDetails && selectedPlace && (
          <aside className="w-96 bg-white border-l flex-shrink-0 overflow-hidden">
            <PlaceDetails
              place={selectedPlace}
              onClose={handleCloseDetails}
              onPlaceSelect={handlePlaceSelect}
              onShowNearby={handleShowNearby}
              onShowEntities={(placeId) => {
                console.log('Show entities for:', placeId);
                // Navigate to entity explorer with this place
              }}
            />
          </aside>
        )}
      </div>

      {/* Instructions overlay (for first-time users) */}
      {!selectedPlace && (
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-[500] pointer-events-none">
          <div className="bg-white bg-opacity-95 p-6 rounded-lg shadow-xl max-w-md pointer-events-auto">
            <h3 className="text-lg font-semibold mb-3">
              Welcome to the Geographic Explorer
            </h3>
            <div className="space-y-2 text-sm text-gray-700">
              <p>🗺️ Pan and zoom to explore the map</p>
              <p>📍 Click markers to view place details</p>
              <p>🔍 Use search to find specific places</p>
              <p>⚙️ Adjust filters to refine results</p>
              <p>🛤️ Enable journey routes to see travels</p>
            </div>
            <Button
              className="w-full mt-4"
              onClick={() => {
                // This would set a localStorage flag to not show again
                document.querySelector('.z-\\[500\\]')?.remove();
              }}
            >
              Got it!
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// Simplified map page for embedding
export function EmbeddedMapPage({
  initialPlace,
  onPlaceSelect
}: {
  initialPlace?: Place;
  onPlaceSelect?: (place: Place) => void;
}) {
  const [selectedPlace, setSelectedPlace] = useState<Place | null>(initialPlace || null);

  const handlePlaceSelect = (place: Place) => {
    setSelectedPlace(place);
    onPlaceSelect?.(place);
  };

  return (
    <div className="h-full flex">
      <div className="flex-1">
        <GeographicMap
          onMarkerClick={handlePlaceSelect}
          selectedPlace={selectedPlace}
        />
      </div>

      {selectedPlace && (
        <aside className="w-80 bg-white border-l">
          <PlaceDetails
            place={selectedPlace}
            onClose={() => setSelectedPlace(null)}
            onPlaceSelect={handlePlaceSelect}
          />
        </aside>
      )}
    </div>
  );
}
