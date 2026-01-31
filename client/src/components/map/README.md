# Geographic Map Component System

Interactive map visualizer for exploring Tibetan Buddhist places, monasteries, and journey routes.

## Overview

A complete geographic exploration system built with Leaflet, React, and TypeScript. Enables users to visualize and explore places, institutions, and historical journeys across Tibet.

## Features

### Core Map Features
- **Interactive Leaflet Map**: Pan, zoom, and explore Tibet region
- **Multiple Tile Layers**: Modern, Satellite, and Terrain views
- **Custom Place Markers**: Color-coded by tradition, icon by place type
- **Marker Clustering**: Automatic grouping for dense areas (500+ markers)
- **Search**: Find places by name, jump to location
- **Heat Map**: Entity density visualization
- **Journey Routes**: Animated travel paths with stops
- **Time Slider**: Filter places by historical period (600-1600 CE)

### Data Integration
- **Graph API Integration**: Fetches from `/api/graph/nearby` and `/api/graph/person/:id/journey`
- **Real-time Filtering**: By place type, tradition, time range
- **Nearby Search**: Find places within radius
- **Related Entities**: View people, texts, events at each place

### Visual Design
- **Tradition Colors**: Nyingma (red), Kagyu (blue), Sakya (orange), Gelug (yellow), Jonang (purple)
- **Place Icons**: Monastery 🏛️, Mountain ⛰️, Cave 🕳️, Temple ⛩️, Stupa 🗼
- **Purpose Colors**: Study (blue), Teaching (green), Pilgrimage (amber), Residence (purple)

## Components

### 1. GeographicMap (348 lines)
Main map component with Leaflet integration, search, and event handling.

```tsx
<GeographicMap
  center={[29.65, 91.13]}
  zoom={7}
  initialFilters={filters}
  onMarkerClick={(place) => console.log(place)}
  selectedPlace={place}
/>
```

### 2. PlaceMarker (186 lines)
Custom markers with popups, tooltips, and metadata display.

### 3. JourneyRoute (293 lines)
Animated travel paths showing person's journey through Tibet.

```tsx
<JourneyRoute
  journey={journey}
  animated={true}
  onStopClick={(stop) => console.log(stop)}
/>
```

### 4. HeatMapLayer (253 lines)
Density visualization showing entity concentration per region.

### 5. MapControls (370 lines)
Filter panel with place types, time range, traditions, display options.

### 6. PlaceDetails (329 lines)
Sidebar panel showing detailed place information, related entities, nearby places.

### 7. MapPage (205 lines)
Full-page layout integrating all components.

## Data Hooks

### useMapData (313 lines)
```tsx
const { places, journey, heatMapData, isLoading } = useMapData({
  bounds: mapBounds,
  filters: filters,
  selectedPersonId: 'person-123'
});
```

### useSearchPlaces
```tsx
const { data: results } = useSearchPlaces('Lhasa');
```

### usePlaceDetails
```tsx
const { data: details } = usePlaceDetails('place-123');
// Returns: { place, relatedPeople, relatedTexts, relatedEvents }
```

### useNearbyPlaces
```tsx
const { data: nearby } = useNearbyPlaces(29.65, 91.13, 50); // 50km radius
```

## Configuration (211 lines)

`mapConfig.ts` provides:
- Map center, zoom, bounds
- Tile layer URLs
- Place type constants
- Tradition color scheme
- Purpose color scheme
- Famous locations (Lhasa, Kailash, Samye, Sakya, Ganden, Tsurphu)
- Icon creation helpers
- Distance calculation utilities

## Styling (435 lines)

`map.css` includes:
- Leaflet customization
- Custom marker styles
- Popup and tooltip styling
- Journey route animations
- Heat map effects
- Cluster styling
- Responsive layouts
- Dark mode support
- Print styles

## Usage

### Basic Map
```tsx
import { MapPage } from '@/pages/MapPage';

function App() {
  return <MapPage />;
}
```

### Embedded Map
```tsx
import { GeographicMap } from '@/components/map';

function Dashboard() {
  return (
    <div style={{ height: '500px' }}>
      <GeographicMap onMarkerClick={handleClick} />
    </div>
  );
}
```

### With Filters
```tsx
const [filters, setFilters] = useState({
  placeTypes: ['monastery', 'temple'],
  timeRange: { start: 1000, end: 1400 },
  traditions: ['Sakya'],
  showHeatMap: true,
  showJourneys: false,
  showClusters: true,
  tileLayer: 'terrain'
});

<GeographicMap initialFilters={filters} />
```

## API Requirements

The map expects these endpoints:

### GET /api/graph/nearby
```
?lat=29.65&lon=91.1&radius=100&entityTypes=Place
```
Returns: `{ entities: Place[] }`

### GET /api/graph/person/:personId/journey
Returns:
```json
{
  "person": { "id": "...", "name": "..." },
  "places": [
    {
      "id": "...",
      "name": "...",
      "latitude": 29.65,
      "longitude": 91.13,
      "arrivalYear": 1250,
      "departureYear": 1255,
      "duration": 5,
      "purpose": "study"
    }
  ]
}
```

### GET /api/graph/entity/:id
Returns: `{ entity: Place, related: Entity[] }`

### GET /api/graph/search?q=query&type=place&limit=10
Returns: `{ results: Place[] }`

## Performance

- **Marker Clustering**: Handles 500+ markers smoothly
- **Lazy Loading**: Only fetches places in current viewport
- **Debounced Search**: 300ms delay on search input
- **Cache**: TanStack Query with 5-minute stale time
- **Optimistic Rendering**: Shows UI before data loads

## Accessibility

- Keyboard navigation support
- Focus indicators on markers
- ARIA labels on controls
- Screen reader friendly popups
- High contrast mode support

## Browser Support

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Mobile Safari/Chrome

## Dependencies

- `leaflet@^1.9.4`
- `react-leaflet@^4.2.1`
- `react-leaflet-cluster@^2.1.0`
- `@types/leaflet@^1.9.0`

## Routes

Access at: `http://localhost:5439/map`

## Future Enhancements

- [ ] 3D terrain visualization
- [ ] Historical map overlays (ancient Tibet)
- [ ] Multiple journey comparison
- [ ] Export to KML/GeoJSON
- [ ] Offline map support
- [ ] Custom map styles
- [ ] Photo galleries per place
- [ ] Audio guide integration
- [ ] VR/AR preview mode

## Testing

```bash
# Type check
npm run check

# Unit tests (future)
npm test

# Integration tests (future)
npm run test:integration
```

## License

Part of the Tibetan Translation Knowledge Graph system.
