import { useQuery } from '@tanstack/react-query';
import type { LatLngBounds } from 'leaflet';
import type { MapFilters } from '../lib/mapConfig';

// Entity types from the knowledge graph
export interface Entity {
  id: string;
  type: string;
  canonical_name: string;
  aliases: string[];
  attributes: Record<string, any>;
  metadata: {
    confidence: number;
    source_count: number;
    last_updated: string;
  };
}

export interface Place extends Entity {
  type: 'place';
  attributes: {
    tibetan_name?: string;
    place_type: string;
    latitude: number;
    longitude: number;
    region?: string;
    founded_year?: number;
    tradition?: string;
    altitude?: number;
  };
}

export interface Journey {
  personId: string;
  personName: string;
  stops: JourneyStop[];
}

export interface JourneyStop {
  placeId: string;
  placeName: string;
  location: [number, number];
  arrivalYear?: number;
  departureYear?: number;
  duration?: number;
  purpose: string;
}

export interface HeatMapPoint {
  lat: number;
  lng: number;
  intensity: number;
}

// Fetch places within map bounds
async function fetchPlacesInBounds(
  bounds: LatLngBounds,
  filters: MapFilters
): Promise<Place[]> {
  const center = bounds.getCenter();
  const ne = bounds.getNorthEast();

  // Calculate approximate radius in km
  const R = 6371; // Earth's radius in km
  const dLat = (ne.lat - center.lat) * Math.PI / 180;
  const dLon = (ne.lng - center.lng) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(center.lat * Math.PI / 180) * Math.cos(ne.lat * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const radius = Math.ceil(R * c);

  // Build query parameters
  const params = new URLSearchParams({
    lat: center.lat.toString(),
    lon: center.lng.toString(),
    radius: radius.toString(),
    entityTypes: 'Place'
  });

  const response = await fetch(`/api/graph/nearby?${params}`);

  if (!response.ok) {
    throw new Error('Failed to fetch places');
  }

  const data = await response.json();

  // Filter and transform the results
  const places = data.entities
    .filter((entity: Entity) => {
      // Must be a place
      if (entity.type !== 'place') return false;

      // Must have coordinates
      if (!entity.attributes.latitude || !entity.attributes.longitude) return false;

      // Filter by place type
      if (filters.placeTypes.length > 0 &&
          !filters.placeTypes.includes(entity.attributes.place_type)) {
        return false;
      }

      // Filter by tradition if specified
      if (filters.traditions.length > 0 &&
          entity.attributes.tradition &&
          !filters.traditions.includes(entity.attributes.tradition)) {
        return false;
      }

      // Filter by time range
      if (entity.attributes.founded_year) {
        const year = entity.attributes.founded_year;
        if (year < filters.timeRange.start || year > filters.timeRange.end) {
          return false;
        }
      }

      return true;
    })
    .map((entity: Entity) => entity as Place);

  return places;
}

// Fetch journey data for a person
async function fetchJourney(personId: string): Promise<Journey | null> {
  try {
    const response = await fetch(`/api/graph/person/${personId}/journey`);

    if (!response.ok) {
      return null;
    }

    const data = await response.json();

    if (!data.person || !data.places || data.places.length === 0) {
      return null;
    }

    const stops: JourneyStop[] = data.places.map((place: any) => ({
      placeId: place.id,
      placeName: place.name,
      location: [place.latitude, place.longitude] as [number, number],
      arrivalYear: place.arrivalYear,
      departureYear: place.departureYear,
      duration: place.duration,
      purpose: place.purpose || 'unknown'
    }));

    return {
      personId: data.person.id,
      personName: data.person.name,
      stops
    };
  } catch (error) {
    console.error('Error fetching journey:', error);
    return null;
  }
}

// Generate heat map data from places
function generateHeatMapData(places: Place[]): HeatMapPoint[] {
  // Group places by approximate grid (0.5 degree cells)
  const cellSize = 0.5;
  const grid = new Map<string, { lat: number; lng: number; count: number }>();

  places.forEach(place => {
    const cellLat = Math.floor(place.attributes.latitude / cellSize) * cellSize;
    const cellLng = Math.floor(place.attributes.longitude / cellSize) * cellSize;
    const key = `${cellLat},${cellLng}`;

    if (grid.has(key)) {
      const cell = grid.get(key)!;
      cell.count += 1;
    } else {
      grid.set(key, {
        lat: cellLat + cellSize / 2,
        lng: cellLng + cellSize / 2,
        count: 1
      });
    }
  });

  // Convert to heat map points
  return Array.from(grid.values()).map(cell => ({
    lat: cell.lat,
    lng: cell.lng,
    intensity: cell.count
  }));
}

// Main hook for map data
export function useMapData(options: {
  bounds: LatLngBounds | null;
  filters: MapFilters;
  selectedPersonId?: string;
}) {
  const { bounds, filters, selectedPersonId } = options;

  // Fetch places
  const placesQuery = useQuery({
    queryKey: ['map-places', bounds?.toBBoxString(), filters],
    queryFn: () => {
      if (!bounds) return [];
      return fetchPlacesInBounds(bounds, filters);
    },
    enabled: !!bounds,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Fetch journey if person is selected
  const journeyQuery = useQuery({
    queryKey: ['journey', selectedPersonId],
    queryFn: () => selectedPersonId ? fetchJourney(selectedPersonId) : null,
    enabled: !!selectedPersonId && filters.showJourneys,
    staleTime: 10 * 60 * 1000, // 10 minutes
  });

  // Generate heat map data
  const heatMapData = filters.showHeatMap && placesQuery.data
    ? generateHeatMapData(placesQuery.data)
    : [];

  return {
    places: placesQuery.data || [],
    journey: journeyQuery.data,
    heatMapData,
    isLoading: placesQuery.isLoading || (filters.showJourneys && journeyQuery.isLoading),
    error: placesQuery.error || journeyQuery.error,
    refetch: placesQuery.refetch
  };
}

// Hook for searching places by name
export function useSearchPlaces(query: string) {
  return useQuery({
    queryKey: ['search-places', query],
    queryFn: async () => {
      if (!query || query.length < 2) return [];

      const response = await fetch(`/api/graph/search?q=${encodeURIComponent(query)}&type=place&limit=10`);

      if (!response.ok) {
        throw new Error('Search failed');
      }

      const data = await response.json();
      return data.results as Place[];
    },
    enabled: query.length >= 2,
    staleTime: 30 * 1000, // 30 seconds
  });
}

// Hook for fetching place details and related entities
export function usePlaceDetails(placeId: string | null) {
  return useQuery({
    queryKey: ['place-details', placeId],
    queryFn: async () => {
      if (!placeId) return null;

      const response = await fetch(`/api/graph/entity/${placeId}`);

      if (!response.ok) {
        throw new Error('Failed to fetch place details');
      }

      const data = await response.json();
      return {
        place: data.entity as Place,
        relatedPeople: data.related?.filter((e: Entity) => e.type === 'person') || [],
        relatedTexts: data.related?.filter((e: Entity) => e.type === 'text') || [],
        relatedEvents: data.related?.filter((e: Entity) => e.type === 'event') || []
      };
    },
    enabled: !!placeId,
    staleTime: 5 * 60 * 1000,
  });
}

// Hook for fetching nearby places
export function useNearbyPlaces(
  lat: number | null,
  lon: number | null,
  radius: number = 50
) {
  return useQuery({
    queryKey: ['nearby-places', lat, lon, radius],
    queryFn: async () => {
      if (lat === null || lon === null) return [];

      const params = new URLSearchParams({
        lat: lat.toString(),
        lon: lon.toString(),
        radius: radius.toString(),
        entityTypes: 'Place'
      });

      const response = await fetch(`/api/graph/nearby?${params}`);

      if (!response.ok) {
        throw new Error('Failed to fetch nearby places');
      }

      const data = await response.json();
      return data.entities.filter((e: Entity) => e.type === 'place') as Place[];
    },
    enabled: lat !== null && lon !== null,
    staleTime: 5 * 60 * 1000,
  });
}
