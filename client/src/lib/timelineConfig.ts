/**
 * Timeline Configuration
 *
 * vis.js timeline configuration and constants for Tibetan Buddhist history timeline
 */

import type { TimelineOptions } from 'vis-timeline/types';

// ============================================================================
// VIS.JS TIMELINE OPTIONS
// ============================================================================

export const TIMELINE_OPTIONS: TimelineOptions = {
  // Zoom constraints
  zoomMin: 1000 * 60 * 60 * 24 * 365 * 10, // 10 years minimum
  zoomMax: 1000 * 60 * 60 * 24 * 365 * 1000, // 1000 years maximum

  // Layout
  orientation: 'top',
  stack: true,
  showCurrentTime: false,

  // Default visible range
  start: new Date(1000, 0, 1),
  end: new Date(1500, 0, 1),

  // Margins and spacing
  margin: {
    item: {
      horizontal: 10,
      vertical: 5
    },
    axis: 5
  },

  // Item appearance
  type: 'range',

  // Interaction
  zoomable: true,
  moveable: true,
  selectable: true,
  multiselect: false,

  // Tooltips
  tooltipOnItemUpdateTime: true,

  // Formatting
  format: {
    minorLabels: {
      year: 'YYYY',
      month: 'MMM',
      week: 'w',
      day: 'D',
      hour: 'h',
      minute: 'mm',
      second: 'ss',
      millisecond: 'SSS'
    },
    majorLabels: {
      year: '',
      month: 'YYYY',
      week: 'YYYY MMM',
      day: 'YYYY MMM D',
      hour: 'YYYY MMM D',
      minute: 'YYYY MMM D HH:mm',
      second: 'YYYY MMM D HH:mm:ss',
      millisecond: 'YYYY MMM D HH:mm:ss.SSS'
    }
  }
};

// ============================================================================
// SWIM LANE GROUPS
// ============================================================================

export const SWIM_LANE_GROUPS = [
  {
    id: 'person',
    content: 'People',
    className: 'timeline-group-person',
    order: 1
  },
  {
    id: 'event',
    content: 'Events',
    className: 'timeline-group-event',
    order: 2
  },
  {
    id: 'text',
    content: 'Texts',
    className: 'timeline-group-text',
    order: 3
  },
  {
    id: 'place',
    content: 'Places',
    className: 'timeline-group-place',
    order: 4
  },
  {
    id: 'lineage',
    content: 'Lineages',
    className: 'timeline-group-lineage',
    order: 5
  },
  {
    id: 'institution',
    content: 'Institutions',
    className: 'timeline-group-institution',
    order: 6
  }
];

// ============================================================================
// COLOR SCHEMES
// ============================================================================

/**
 * Tradition colors for border styling
 */
export const TRADITION_COLORS = {
  Nyingma: '#dc2626', // Red
  Kagyu: '#2563eb', // Blue
  Sakya: '#ea580c', // Orange
  Gelug: '#eab308', // Yellow
  Jonang: '#7c3aed', // Purple
  Bon: '#059669', // Green
  Rimé: '#ec4899', // Pink
  Unknown: '#6b7280' // Gray
} as const;

/**
 * Entity type colors for background
 */
export const ENTITY_TYPE_COLORS = {
  person: '#3b82f6', // Blue
  event: '#ef4444', // Red
  text: '#10b981', // Green
  place: '#a855f7', // Purple
  lineage: '#f59e0b', // Amber
  concept: '#06b6d4', // Cyan
  institution: '#ec4899', // Pink
  deity: '#8b5cf6' // Violet
} as const;

// ============================================================================
// PRESET TIME RANGES
// ============================================================================

export const PRESET_RANGES = [
  {
    label: 'Early Period (600-800)',
    start: new Date(600, 0, 1),
    end: new Date(800, 0, 1)
  },
  {
    label: '8th Century',
    start: new Date(700, 0, 1),
    end: new Date(800, 0, 1)
  },
  {
    label: 'Later Diffusion (1000-1200)',
    start: new Date(1000, 0, 1),
    end: new Date(1200, 0, 1)
  },
  {
    label: '11th Century',
    start: new Date(1000, 0, 1),
    end: new Date(1100, 0, 1)
  },
  {
    label: 'Sakya Dominance (1200-1350)',
    start: new Date(1200, 0, 1),
    end: new Date(1350, 0, 1)
  },
  {
    label: '14th Century',
    start: new Date(1300, 0, 1),
    end: new Date(1400, 0, 1)
  },
  {
    label: 'Gelug Rise (1350-1550)',
    start: new Date(1350, 0, 1),
    end: new Date(1550, 0, 1)
  },
  {
    label: 'Full Range (600-1600)',
    start: new Date(600, 0, 1),
    end: new Date(1600, 0, 1)
  }
];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get confidence class for styling opacity
 */
export function getConfidenceClass(confidence: number): string {
  if (confidence >= 0.8) return 'high';
  if (confidence >= 0.5) return 'medium';
  return 'low';
}

/**
 * Get entity style string
 */
export function getEntityStyle(entity: any): string {
  const tradition = entity.attributes?.tradition?.[0] || 'Unknown';
  const borderColor = TRADITION_COLORS[tradition as keyof typeof TRADITION_COLORS] || TRADITION_COLORS.Unknown;
  const bgColor = ENTITY_TYPE_COLORS[entity.type as keyof typeof ENTITY_TYPE_COLORS] || '#6b7280';
  const opacity = parseFloat(entity.confidence) || 0.5;

  return `
    border: 3px solid ${borderColor};
    background-color: ${bgColor};
    opacity: ${opacity};
    color: white;
  `;
}

/**
 * Parse date from entity attributes
 */
export function getStartDate(entity: any): Date {
  const type = entity.type;
  const attrs = entity.attributes || {};

  if (type === 'person') {
    const birthYear = attrs.birth_year || attrs.dates?.birth?.year;
    return birthYear ? new Date(birthYear, 0, 1) : new Date(1200, 0, 1);
  } else if (type === 'text') {
    const composedYear = attrs.composed_year || attrs.dates?.composed?.year;
    return composedYear ? new Date(composedYear, 0, 1) : new Date(1200, 0, 1);
  } else if (type === 'place' || type === 'institution') {
    const foundedYear = attrs.founded_year || attrs.dates?.founded?.year;
    return foundedYear ? new Date(foundedYear, 0, 1) : new Date(1200, 0, 1);
  } else if (type === 'event') {
    const year = attrs.year || attrs.dates?.occurred?.year;
    return year ? new Date(year, 0, 1) : new Date(1200, 0, 1);
  }

  return new Date(1200, 0, 1);
}

/**
 * Parse end date from entity attributes (null for point events)
 */
export function getEndDate(entity: any): Date | null {
  const type = entity.type;
  const attrs = entity.attributes || {};

  if (type === 'person') {
    const deathYear = attrs.death_year || attrs.dates?.death?.year;
    return deathYear ? new Date(deathYear, 0, 1) : null;
  } else if (type === 'event') {
    // Events are typically points unless they have duration
    const endYear = attrs.end_year || attrs.dates?.ended?.year;
    return endYear ? new Date(endYear, 0, 1) : null;
  }

  // Texts, places, institutions are point events at creation
  return null;
}

/**
 * Format entity name for timeline display
 */
export function formatEntityName(entity: any): string {
  return entity.canonicalName || entity.canonical_name || 'Unknown';
}

/**
 * Get entity tooltip content
 */
export function getEntityTooltip(entity: any): string {
  const name = formatEntityName(entity);
  const type = entity.type.charAt(0).toUpperCase() + entity.type.slice(1);
  const tradition = entity.attributes?.tradition?.[0] || 'Unknown';
  const confidence = `${Math.round(parseFloat(entity.confidence) * 100)}%`;

  return `
    <strong>${name}</strong><br/>
    Type: ${type}<br/>
    Tradition: ${tradition}<br/>
    Confidence: ${confidence}
  `;
}
