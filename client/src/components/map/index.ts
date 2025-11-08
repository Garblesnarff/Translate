// Main map component
export { GeographicMap, GeographicMapWithControls } from './GeographicMap';
export type { MapHandle } from './GeographicMap';

// Map controls
export { MapControls } from './MapControls';

// Place markers
export { PlaceMarker, SimpleMarker, HighlightedMarker } from './PlaceMarker';

// Journey routes
export {
  JourneyRoute,
  MultiJourneyRoutes,
  JourneyLegend,
  JourneyTimeline
} from './JourneyRoute';

// Heat map
export {
  HeatMapLayer,
  CanvasHeatMap,
  HeatMapLegend,
  HeatMapOverlay,
  DensityGrid,
  calculateHeatMapStats
} from './HeatMapLayer';

// Place details
export { PlaceDetails, PlaceDetailsMini } from './PlaceDetails';
