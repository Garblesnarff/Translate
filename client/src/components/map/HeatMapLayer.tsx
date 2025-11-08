import { CircleMarker } from 'react-leaflet';
import type { HeatMapPoint } from '../../hooks/useMapData';

interface HeatMapLayerProps {
  points: HeatMapPoint[];
  maxIntensity?: number;
  radius?: number;
}

export function HeatMapLayer({
  points,
  maxIntensity = 50,
  radius = 30
}: HeatMapLayerProps) {
  if (!points || points.length === 0) {
    return null;
  }

  // Find the maximum intensity for normalization
  const max = Math.max(...points.map(p => p.intensity), maxIntensity);

  // Color gradient function
  const getColor = (intensity: number): string => {
    const normalized = Math.min(intensity / max, 1);

    // Blue -> Yellow -> Red gradient
    if (normalized < 0.5) {
      // Blue to Yellow
      const t = normalized * 2;
      const r = Math.round(0 + (255 * t));
      const g = Math.round(0 + (255 * t));
      const b = Math.round(255 * (1 - t));
      return `rgb(${r}, ${g}, ${b})`;
    } else {
      // Yellow to Red
      const t = (normalized - 0.5) * 2;
      const r = 255;
      const g = Math.round(255 * (1 - t));
      const b = 0;
      return `rgb(${r}, ${g}, ${b})`;
    }
  };

  // Calculate opacity based on intensity
  const getOpacity = (intensity: number): number => {
    const normalized = Math.min(intensity / max, 1);
    return 0.3 + (normalized * 0.4); // 0.3 to 0.7
  };

  return (
    <>
      {points.map((point, index) => (
        <CircleMarker
          key={`heatmap-${index}`}
          center={[point.lat, point.lng]}
          radius={radius}
          fillColor={getColor(point.intensity)}
          fillOpacity={getOpacity(point.intensity)}
          stroke={false}
          interactive={false}
        />
      ))}
    </>
  );
}

// Canvas-based heat map for better performance
interface CanvasHeatMapProps {
  points: HeatMapPoint[];
  radius?: number;
  blur?: number;
  maxIntensity?: number;
}

export function CanvasHeatMap({
  points,
  radius = 25,
  blur = 15,
  maxIntensity = 50
}: CanvasHeatMapProps) {
  // This would use a canvas overlay for better performance
  // For now, using CircleMarker-based approach
  return <HeatMapLayer points={points} maxIntensity={maxIntensity} radius={radius} />;
}

// Heat map legend
interface HeatMapLegendProps {
  maxIntensity: number;
  unit?: string;
}

export function HeatMapLegend({ maxIntensity, unit = 'places' }: HeatMapLegendProps) {
  const gradient = [
    { color: 'rgb(0, 0, 255)', label: '0' },
    { color: 'rgb(0, 255, 255)', label: Math.round(maxIntensity * 0.25).toString() },
    { color: 'rgb(0, 255, 0)', label: Math.round(maxIntensity * 0.5).toString() },
    { color: 'rgb(255, 255, 0)', label: Math.round(maxIntensity * 0.75).toString() },
    { color: 'rgb(255, 0, 0)', label: maxIntensity.toString() }
  ];

  return (
    <div className="heatmap-legend bg-white p-3 rounded-lg shadow-md">
      <h4 className="text-sm font-semibold mb-2">Entity Density</h4>

      {/* Gradient bar */}
      <div className="relative h-4 rounded overflow-hidden mb-2"
           style={{
             background: 'linear-gradient(to right, rgb(0, 0, 255), rgb(0, 255, 255), rgb(0, 255, 0), rgb(255, 255, 0), rgb(255, 0, 0))'
           }}
      />

      {/* Labels */}
      <div className="flex justify-between text-xs text-gray-600">
        <span>Low</span>
        <span>High</span>
      </div>

      {/* Values */}
      <div className="mt-2 space-y-1">
        {gradient.map((item, index) => (
          <div key={index} className="flex items-center gap-2 text-xs">
            <div
              className="w-3 h-3 rounded border border-gray-300"
              style={{ backgroundColor: item.color }}
            />
            <span className="text-gray-600">
              {item.label} {unit}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Density grid visualization
interface DensityGridProps {
  points: HeatMapPoint[];
  gridSize?: number;
}

export function DensityGrid({ points, gridSize = 0.5 }: DensityGridProps) {
  // Group points into grid cells
  const cells = new Map<string, { lat: number; lng: number; count: number }>();

  points.forEach(point => {
    const cellLat = Math.floor(point.lat / gridSize) * gridSize;
    const cellLng = Math.floor(point.lng / gridSize) * gridSize;
    const key = `${cellLat},${cellLng}`;

    if (cells.has(key)) {
      cells.get(key)!.count += point.intensity;
    } else {
      cells.set(key, {
        lat: cellLat + gridSize / 2,
        lng: cellLng + gridSize / 2,
        count: point.intensity
      });
    }
  });

  const maxCount = Math.max(...Array.from(cells.values()).map(c => c.count), 1);

  return (
    <>
      {Array.from(cells.values()).map((cell, index) => {
        const opacity = Math.min(cell.count / maxCount, 1);
        return (
          <CircleMarker
            key={`density-${index}`}
            center={[cell.lat, cell.lng]}
            radius={20}
            fillColor="#3b82f6"
            fillOpacity={opacity * 0.5}
            stroke={false}
            interactive={false}
          />
        );
      })}
    </>
  );
}

// Helper to calculate heat map statistics
export function calculateHeatMapStats(points: HeatMapPoint[]) {
  if (points.length === 0) {
    return {
      total: 0,
      max: 0,
      min: 0,
      average: 0,
      median: 0
    };
  }

  const intensities = points.map(p => p.intensity).sort((a, b) => a - b);
  const sum = intensities.reduce((acc, val) => acc + val, 0);

  return {
    total: sum,
    max: intensities[intensities.length - 1],
    min: intensities[0],
    average: sum / intensities.length,
    median: intensities[Math.floor(intensities.length / 2)]
  };
}

// Heat map overlay with stats
interface HeatMapOverlayProps {
  points: HeatMapPoint[];
  showStats?: boolean;
  radius?: number;
  maxIntensity?: number;
}

export function HeatMapOverlay({
  points,
  showStats = false,
  radius = 30,
  maxIntensity = 50
}: HeatMapOverlayProps) {
  const stats = showStats ? calculateHeatMapStats(points) : null;

  return (
    <>
      <HeatMapLayer points={points} radius={radius} maxIntensity={maxIntensity} />

      {showStats && stats && (
        <div className="heatmap-stats absolute top-4 right-4 bg-white p-3 rounded-lg shadow-md z-[1000]">
          <h4 className="text-sm font-semibold mb-2">Heat Map Statistics</h4>
          <div className="space-y-1 text-xs">
            <div className="flex justify-between gap-4">
              <span className="text-gray-600">Total:</span>
              <span className="font-medium">{stats.total}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-gray-600">Max:</span>
              <span className="font-medium">{stats.max}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-gray-600">Average:</span>
              <span className="font-medium">{stats.average.toFixed(1)}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-gray-600">Points:</span>
              <span className="font-medium">{points.length}</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
