import L from 'leaflet';

// Fix Leaflet default marker icon issue in bundlers
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';
import iconRetina from 'leaflet/dist/images/marker-icon-2x.png';

let DefaultIcon = L.icon({
  iconUrl: icon,
  iconRetinaUrl: iconRetina,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  tooltipAnchor: [16, -28],
  shadowSize: [41, 41]
});

L.Marker.prototype.options.icon = DefaultIcon;

// Map Configuration
export const MAP_CONFIG = {
  center: [29.6519, 91.1315] as [number, number], // Lhasa
  zoom: 7,
  minZoom: 5,
  maxZoom: 18,
  maxBounds: [[25, 75], [40, 105]] as [[number, number], [number, number]], // Tibet region
};

// Tile Layers
export const TILE_LAYERS = {
  modern: {
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  },
  satellite: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri'
  },
  terrain: {
    url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    attribution: 'Map data: &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>, <a href="http://viewfinderpanoramas.org">SRTM</a> | Map style: &copy; <a href="https://opentopomap.org">OpenTopoMap</a>'
  }
};

// Place Types
export const PLACE_TYPES = [
  'monastery',
  'mountain',
  'cave',
  'city',
  'temple',
  'stupa',
  'holy_site',
  'hermitage'
] as const;

export type PlaceType = typeof PLACE_TYPES[number];

// Marker Icons by Place Type
export const PLACE_ICONS: Record<PlaceType, string> = {
  monastery: '🏛️',
  mountain: '⛰️',
  cave: '🕳️',
  city: '🏙️',
  temple: '⛩️',
  stupa: '🗼',
  holy_site: '✨',
  hermitage: '🏘️'
};

// Tradition Colors
export const TRADITION_COLORS: Record<string, string> = {
  Nyingma: '#dc2626',
  Kagyu: '#2563eb',
  Sakya: '#ea580c',
  Gelug: '#eab308',
  Jonang: '#7c3aed',
  Bon: '#059669',
  Unknown: '#6b7280'
};

// Purpose Colors for Journey Routes
export const PURPOSE_COLORS: Record<string, string> = {
  study: '#3b82f6',
  teaching: '#10b981',
  pilgrimage: '#f59e0b',
  residence: '#8b5cf6',
  retreat: '#ec4899',
  unknown: '#6b7280'
};

// Famous Locations for Quick Jump
export const FAMOUS_LOCATIONS = {
  LHASA: { name: 'Lhasa', coords: [29.6519, 91.1315] as [number, number] },
  KAILASH: { name: 'Mt. Kailash', coords: [31.0667, 81.3111] as [number, number] },
  SAMYE: { name: 'Samye', coords: [29.4667, 91.7667] as [number, number] },
  SAKYA: { name: 'Sakya', coords: [28.9000, 88.0167] as [number, number] },
  GANDEN: { name: 'Ganden', coords: [29.7667, 91.4667] as [number, number] },
  TSURPHU: { name: 'Tsurphu', coords: [30.0167, 90.6833] as [number, number] }
};

// Create custom marker icon
export function createCustomIcon(
  emoji: string,
  color: string = '#3b82f6'
): L.DivIcon {
  return L.divIcon({
    html: `
      <div class="custom-marker" style="background-color: ${color}">
        <span class="marker-emoji">${emoji}</span>
      </div>
    `,
    className: 'custom-marker-wrapper',
    iconSize: [36, 36],
    iconAnchor: [18, 36],
    popupAnchor: [0, -36]
  });
}

// Create custom marker with tradition color
export function createPlaceIcon(
  placeType: PlaceType,
  tradition?: string
): L.DivIcon {
  const emoji = PLACE_ICONS[placeType];
  const color = tradition ? TRADITION_COLORS[tradition] || TRADITION_COLORS.Unknown : '#3b82f6';
  return createCustomIcon(emoji, color);
}

// Cluster icon creation
export function createClusterCustomIcon(cluster: any) {
  const count = cluster.getChildCount();
  let size = 'small';
  let className = 'marker-cluster-small';

  if (count > 50) {
    size = 'large';
    className = 'marker-cluster-large';
  } else if (count > 10) {
    size = 'medium';
    className = 'marker-cluster-medium';
  }

  return L.divIcon({
    html: `<div><span>${count}</span></div>`,
    className: `marker-cluster ${className}`,
    iconSize: L.point(40, 40, true)
  });
}

// Default time range (7th-17th century)
export const DEFAULT_TIME_RANGE = {
  start: 600,
  end: 1600
};

// Map filters interface
export interface MapFilters {
  placeTypes: PlaceType[];
  timeRange: { start: number; end: number };
  traditions: string[];
  showHeatMap: boolean;
  showJourneys: boolean;
  showClusters: boolean;
  tileLayer: keyof typeof TILE_LAYERS;
}

// Default map filters
export const DEFAULT_MAP_FILTERS: MapFilters = {
  placeTypes: [...PLACE_TYPES],
  timeRange: DEFAULT_TIME_RANGE,
  traditions: [],
  showHeatMap: false,
  showJourneys: false,
  showClusters: true,
  tileLayer: 'terrain'
};

// Helper to check if a place is within time range
export function isWithinTimeRange(
  foundedYear: number | undefined,
  timeRange: { start: number; end: number }
): boolean {
  if (!foundedYear) return true; // Show if no date
  return foundedYear >= timeRange.start && foundedYear <= timeRange.end;
}

// Helper to calculate bounds center
export function getBoundsCenter(bounds: L.LatLngBounds): [number, number] {
  const center = bounds.getCenter();
  return [center.lat, center.lng];
}

// Helper to calculate distance between two points (Haversine formula)
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
