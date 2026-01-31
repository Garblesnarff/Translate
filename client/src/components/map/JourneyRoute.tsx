import { useState, useEffect } from 'react';
import { Polyline, CircleMarker, Tooltip } from 'react-leaflet';
import type { Journey, JourneyStop } from '../../hooks/useMapData';
import { PURPOSE_COLORS } from '../../lib/mapConfig';

interface JourneyRouteProps {
  journey: Journey;
  animated?: boolean;
  color?: string;
  onStopClick?: (stop: JourneyStop) => void;
}

export function JourneyRoute({
  journey,
  animated = true,
  color = '#3b82f6',
  onStopClick
}: JourneyRouteProps) {
  const [animationProgress, setAnimationProgress] = useState(animated ? 0 : 1);

  useEffect(() => {
    if (animated) {
      setAnimationProgress(0);
      const duration = 3000; // 3 seconds
      const steps = 60;
      const stepTime = duration / steps;
      let currentStep = 0;

      const interval = setInterval(() => {
        currentStep++;
        setAnimationProgress(currentStep / steps);

        if (currentStep >= steps) {
          clearInterval(interval);
        }
      }, stepTime);

      return () => clearInterval(interval);
    }
  }, [animated, journey.personId]);

  if (!journey.stops || journey.stops.length === 0) {
    return null;
  }

  // Calculate which segments to show based on animation progress
  const visibleStops = Math.ceil(journey.stops.length * animationProgress);
  const positions = journey.stops.slice(0, visibleStops).map(stop => stop.location);

  // Format duration
  const formatDuration = (years?: number) => {
    if (!years) return '';
    if (years < 1) return `${Math.round(years * 12)} months`;
    return `${years} years`;
  };

  // Format year
  const formatYear = (year?: number) => {
    if (!year) return 'Unknown';
    if (year < 0) return `${Math.abs(year)} BCE`;
    return `${year} CE`;
  };

  return (
    <>
      {/* Journey path */}
      {positions.length > 1 && (
        <Polyline
          positions={positions}
          color={color}
          weight={3}
          opacity={0.7}
          dashArray="10, 5"
        />
      )}

      {/* Journey stops */}
      {journey.stops.map((stop, index) => {
        const isVisible = index < visibleStops;
        const stopColor = PURPOSE_COLORS[stop.purpose] || PURPOSE_COLORS.unknown;

        return (
          <CircleMarker
            key={`${stop.placeId}-${index}`}
            center={stop.location}
            radius={index === 0 ? 8 : index === journey.stops.length - 1 ? 8 : 6}
            fillColor={stopColor}
            fillOpacity={isVisible ? 0.9 : 0}
            color="white"
            weight={2}
            opacity={isVisible ? 1 : 0}
            eventHandlers={{
              click: () => onStopClick?.(stop)
            }}
          >
            <Tooltip direction="top" offset={[0, -10]} opacity={0.95}>
              <div className="journey-stop-tooltip">
                <h4 className="font-semibold text-sm mb-1">{stop.placeName}</h4>

                <div className="text-xs space-y-1">
                  {/* Stop number */}
                  <div className="text-gray-500">
                    Stop {index + 1} of {journey.stops.length}
                  </div>

                  {/* Time period */}
                  {(stop.arrivalYear || stop.departureYear) && (
                    <div className="flex items-center gap-1">
                      <span>📅</span>
                      <span>
                        {formatYear(stop.arrivalYear)}
                        {stop.departureYear && ` - ${formatYear(stop.departureYear)}`}
                      </span>
                    </div>
                  )}

                  {/* Duration */}
                  {stop.duration && (
                    <div className="flex items-center gap-1">
                      <span>⏱️</span>
                      <span>{formatDuration(stop.duration)}</span>
                    </div>
                  )}

                  {/* Purpose */}
                  <div className="flex items-center gap-1">
                    <span>🎯</span>
                    <span className="capitalize">{stop.purpose}</span>
                  </div>
                </div>

                {/* Special markers for first and last */}
                {index === 0 && (
                  <div className="mt-1 text-xs font-medium text-green-600">
                    Journey Start
                  </div>
                )}
                {index === journey.stops.length - 1 && (
                  <div className="mt-1 text-xs font-medium text-red-600">
                    Journey End
                  </div>
                )}
              </div>
            </Tooltip>
          </CircleMarker>
        );
      })}
    </>
  );
}

// Multi-journey component for displaying multiple journeys
interface MultiJourneyProps {
  journeys: Journey[];
  animated?: boolean;
  onStopClick?: (stop: JourneyStop) => void;
}

export function MultiJourneyRoutes({
  journeys,
  animated = false,
  onStopClick
}: MultiJourneyProps) {
  const colors = [
    '#3b82f6', // blue
    '#10b981', // green
    '#f59e0b', // amber
    '#8b5cf6', // purple
    '#ec4899', // pink
    '#14b8a6', // teal
  ];

  return (
    <>
      {journeys.map((journey, index) => (
        <JourneyRoute
          key={journey.personId}
          journey={journey}
          animated={animated}
          color={colors[index % colors.length]}
          onStopClick={onStopClick}
        />
      ))}
    </>
  );
}

// Journey legend component
interface JourneyLegendProps {
  journeys: Journey[];
  onJourneySelect?: (personId: string) => void;
  selectedPersonId?: string;
}

export function JourneyLegend({
  journeys,
  onJourneySelect,
  selectedPersonId
}: JourneyLegendProps) {
  const colors = [
    '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#14b8a6'
  ];

  return (
    <div className="journey-legend bg-white p-3 rounded-lg shadow-md">
      <h4 className="text-sm font-semibold mb-2">Journeys</h4>
      <div className="space-y-1">
        {journeys.map((journey, index) => (
          <button
            key={journey.personId}
            className={`w-full text-left px-2 py-1 rounded text-xs hover:bg-gray-100 transition ${
              selectedPersonId === journey.personId ? 'bg-gray-100' : ''
            }`}
            onClick={() => onJourneySelect?.(journey.personId)}
          >
            <div className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: colors[index % colors.length] }}
              />
              <span className="font-medium">{journey.personName}</span>
              <span className="text-gray-500 ml-auto">
                {journey.stops.length} stops
              </span>
            </div>
          </button>
        ))}
      </div>

      {/* Purpose legend */}
      <div className="mt-3 pt-3 border-t">
        <h5 className="text-xs font-semibold mb-2">Purpose Colors</h5>
        <div className="grid grid-cols-2 gap-1 text-xs">
          {Object.entries(PURPOSE_COLORS).map(([purpose, color]) => (
            <div key={purpose} className="flex items-center gap-1">
              <div
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: color }}
              />
              <span className="capitalize text-gray-600">{purpose}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Journey timeline component
interface JourneyTimelineProps {
  journey: Journey;
}

export function JourneyTimeline({ journey }: JourneyTimelineProps) {
  return (
    <div className="journey-timeline space-y-3">
      <h4 className="font-semibold text-sm">
        Journey of {journey.personName}
      </h4>

      <div className="space-y-2">
        {journey.stops.map((stop, index) => (
          <div key={`${stop.placeId}-${index}`} className="flex gap-3">
            {/* Timeline marker */}
            <div className="flex flex-col items-center">
              <div
                className="w-3 h-3 rounded-full border-2 border-white shadow"
                style={{ backgroundColor: PURPOSE_COLORS[stop.purpose] }}
              />
              {index < journey.stops.length - 1 && (
                <div className="w-0.5 h-full bg-gray-300 flex-1 mt-1" />
              )}
            </div>

            {/* Stop details */}
            <div className="flex-1 pb-4">
              <div className="font-medium text-sm">{stop.placeName}</div>
              <div className="text-xs text-gray-600 space-y-1 mt-1">
                {stop.arrivalYear && (
                  <div>Arrived: {stop.arrivalYear} CE</div>
                )}
                {stop.duration && (
                  <div>Duration: {stop.duration} years</div>
                )}
                <div className="capitalize">Purpose: {stop.purpose}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
