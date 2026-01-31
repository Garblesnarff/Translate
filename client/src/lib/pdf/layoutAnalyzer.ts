// client/src/lib/pdf/layoutAnalyzer.ts

import type { PositionalTextItem } from './PositionalTextBuilder';

/**
 * PDF layout analysis for detecting and handling multi-column layouts
 */

/**
 * Represents a column in the layout
 */
export interface Column {
  index: number;
  leftBoundary: number;
  rightBoundary: number;
  items: PositionalTextItem[];
  width: number;
}

/**
 * Layout analysis result
 */
export interface ColumnLayout {
  type: 'single' | 'double' | 'triple' | 'complex';
  columnCount: number;
  columns: Column[];
  confidence: number; // 0-1, how confident we are in this layout detection
  pageWidth?: number;
  pageHeight?: number;
}

/**
 * Configuration for layout analysis
 */
export interface LayoutAnalysisConfig {
  /** Minimum gap between columns (in PDF units) */
  minColumnGap: number;

  /** Minimum column width (in PDF units) */
  minColumnWidth: number;

  /** Minimum items per column to be considered valid */
  minItemsPerColumn: number;

  /** Whether to be strict about column boundaries */
  strictBoundaries: boolean;
}

const DEFAULT_CONFIG: LayoutAnalysisConfig = {
  minColumnGap: 40,
  minColumnWidth: 100,
  minItemsPerColumn: 5,
  strictBoundaries: false,
};

/**
 * LayoutAnalyzer detects multi-column layouts in PDF pages
 */
export class LayoutAnalyzer {
  private config: LayoutAnalysisConfig;

  constructor(config: Partial<LayoutAnalysisConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Analyze items to detect column layout
   */
  analyzeLayout(items: PositionalTextItem[]): ColumnLayout {
    if (items.length === 0) {
      return {
        type: 'single',
        columnCount: 1,
        columns: [],
        confidence: 1.0,
      };
    }

    // Calculate page dimensions
    const { pageWidth, pageHeight } = this.estimatePageDimensions(items);

    // Detect columns using multiple methods
    const xClustering = this.detectColumnsByXClustering(items);
    const gapAnalysis = this.detectColumnsByGapAnalysis(items);

    // Choose the best method based on confidence
    let layout: ColumnLayout;

    if (xClustering.confidence > gapAnalysis.confidence) {
      layout = xClustering;
    } else {
      layout = gapAnalysis;
    }

    // Add page dimensions
    layout.pageWidth = pageWidth;
    layout.pageHeight = pageHeight;

    // Validate and refine layout
    layout = this.validateAndRefineLayout(layout);

    return layout;
  }

  /**
   * Detect columns by clustering x-positions
   */
  private detectColumnsByXClustering(items: PositionalTextItem[]): ColumnLayout {
    // Collect all x-positions
    const xPositions = items.map(item => item.x).sort((a, b) => a - b);

    // Use k-means-like clustering to find column centers
    const clusters = this.clusterPositions(xPositions, 3); // Try up to 3 columns

    if (clusters.length === 1) {
      return {
        type: 'single',
        columnCount: 1,
        columns: [this.createColumn(0, items, Math.min(...xPositions), Math.max(...xPositions))],
        confidence: 0.9,
      };
    }

    // Create columns from clusters
    const columns: Column[] = [];
    for (let i = 0; i < clusters.length; i++) {
      const clusterItems = items.filter(item =>
        this.belongsToCluster(item.x, clusters[i])
      );

      if (clusterItems.length >= this.config.minItemsPerColumn) {
        const leftBoundary = Math.min(...clusterItems.map(item => item.x));
        const rightBoundary = Math.max(...clusterItems.map(item => item.x + item.width));

        columns.push(this.createColumn(i, clusterItems, leftBoundary, rightBoundary));
      }
    }

    // Determine layout type
    let type: 'single' | 'double' | 'triple' | 'complex' = 'single';
    if (columns.length === 2) type = 'double';
    else if (columns.length === 3) type = 'triple';
    else if (columns.length > 3) type = 'complex';

    return {
      type,
      columnCount: columns.length,
      columns,
      confidence: this.calculateClusteringConfidence(columns, items),
    };
  }

  /**
   * Detect columns by analyzing gaps in x-positions
   */
  private detectColumnsByGapAnalysis(items: PositionalTextItem[]): ColumnLayout {
    // Sort items by x position
    const sortedItems = [...items].sort((a, b) => a.x - b.x);

    // Find significant gaps
    const gaps: Array<{ position: number; size: number }> = [];

    for (let i = 1; i < sortedItems.length; i++) {
      const prevItem = sortedItems[i - 1];
      const currItem = sortedItems[i];
      const gap = currItem.x - (prevItem.x + prevItem.width);

      if (gap >= this.config.minColumnGap) {
        gaps.push({
          position: prevItem.x + prevItem.width + gap / 2,
          size: gap,
        });
      }
    }

    // If no significant gaps, it's single column
    if (gaps.length === 0) {
      return {
        type: 'single',
        columnCount: 1,
        columns: [
          this.createColumn(
            0,
            items,
            Math.min(...items.map(i => i.x)),
            Math.max(...items.map(i => i.x + i.width))
          ),
        ],
        confidence: 0.85,
      };
    }

    // Sort gaps by size and take the largest ones
    gaps.sort((a, b) => b.size - a.size);
    const columnBoundaries = gaps.slice(0, 2).map(g => g.position).sort((a, b) => a - b);

    // Create columns based on boundaries
    const columns: Column[] = [];
    const boundaries = [
      Math.min(...items.map(i => i.x)),
      ...columnBoundaries,
      Math.max(...items.map(i => i.x + i.width)),
    ];

    for (let i = 0; i < boundaries.length - 1; i++) {
      const left = boundaries[i];
      const right = boundaries[i + 1];

      const columnItems = items.filter(
        item => item.x >= left && item.x + item.width <= right
      );

      if (columnItems.length >= this.config.minItemsPerColumn) {
        columns.push(this.createColumn(i, columnItems, left, right));
      }
    }

    // Determine layout type
    let type: 'single' | 'double' | 'triple' | 'complex' = 'single';
    if (columns.length === 2) type = 'double';
    else if (columns.length === 3) type = 'triple';
    else if (columns.length > 3) type = 'complex';

    return {
      type,
      columnCount: columns.length,
      columns,
      confidence: this.calculateGapConfidence(gaps, columns),
    };
  }

  /**
   * Create a column object
   */
  private createColumn(
    index: number,
    items: PositionalTextItem[],
    left: number,
    right: number
  ): Column {
    return {
      index,
      leftBoundary: left,
      rightBoundary: right,
      items,
      width: right - left,
    };
  }

  /**
   * Cluster positions using simple k-means-like algorithm
   */
  private clusterPositions(positions: number[], maxClusters: number): number[][] {
    if (positions.length === 0) return [];

    // Start with one cluster
    let clusters: number[][] = [positions];

    // Try to split into more clusters
    for (let k = 2; k <= maxClusters; k++) {
      const newClusters = this.splitIntoClusters(positions, k);

      // Check if split makes sense (clusters are well-separated)
      if (this.areClustersWellSeparated(newClusters)) {
        clusters = newClusters;
      } else {
        break;
      }
    }

    return clusters;
  }

  /**
   * Split positions into k clusters
   */
  private splitIntoClusters(positions: number[], k: number): number[][] {
    if (k === 1) return [positions];

    // Simple approach: divide range into k equal parts
    const min = Math.min(...positions);
    const max = Math.max(...positions);
    const range = max - min;
    const clusterWidth = range / k;

    const clusters: number[][] = Array.from({ length: k }, () => []);

    for (const pos of positions) {
      const clusterIndex = Math.min(
        Math.floor((pos - min) / clusterWidth),
        k - 1
      );
      clusters[clusterIndex].push(pos);
    }

    return clusters.filter(c => c.length > 0);
  }

  /**
   * Check if clusters are well-separated
   */
  private areClustersWellSeparated(clusters: number[][]): boolean {
    if (clusters.length < 2) return true;

    // Calculate cluster centers
    const centers = clusters.map(cluster => {
      const sum = cluster.reduce((a, b) => a + b, 0);
      return sum / cluster.length;
    });

    // Check distances between adjacent centers
    centers.sort((a, b) => a - b);

    for (let i = 1; i < centers.length; i++) {
      const distance = centers[i] - centers[i - 1];
      if (distance < this.config.minColumnGap) {
        return false;
      }
    }

    return true;
  }

  /**
   * Check if a position belongs to a cluster
   */
  private belongsToCluster(position: number, cluster: number[]): boolean {
    if (cluster.length === 0) return false;

    const min = Math.min(...cluster);
    const max = Math.max(...cluster);
    const center = (min + max) / 2;
    const range = max - min;

    // Position should be within cluster range plus some tolerance
    return Math.abs(position - center) <= range / 2 + this.config.minColumnGap / 2;
  }

  /**
   * Calculate confidence for clustering-based detection
   */
  private calculateClusteringConfidence(columns: Column[], allItems: PositionalTextItem[]): number {
    if (columns.length === 0) return 0;
    if (columns.length === 1) return 0.9;

    // Check that columns are balanced in size
    const itemCounts = columns.map(c => c.items.length);
    const avgCount = itemCounts.reduce((a, b) => a + b, 0) / itemCounts.length;
    const variance = itemCounts.reduce((sum, count) => sum + Math.pow(count - avgCount, 2), 0) / itemCounts.length;
    const balance = 1 - Math.min(variance / (avgCount * avgCount), 1);

    // Check that columns are well-separated
    let minGap = Infinity;
    for (let i = 1; i < columns.length; i++) {
      const gap = columns[i].leftBoundary - columns[i - 1].rightBoundary;
      minGap = Math.min(minGap, gap);
    }
    const separation = Math.min(minGap / this.config.minColumnGap, 1);

    // Combine factors
    return (balance * 0.4 + separation * 0.6);
  }

  /**
   * Calculate confidence for gap-based detection
   */
  private calculateGapConfidence(
    gaps: Array<{ position: number; size: number }>,
    columns: Column[]
  ): number {
    if (columns.length === 0) return 0;
    if (columns.length === 1) return 0.85;

    // Check gap sizes
    const avgGap = gaps.reduce((sum, g) => sum + g.size, 0) / gaps.length;
    const gapScore = Math.min(avgGap / (this.config.minColumnGap * 2), 1);

    // Check column balance
    const itemCounts = columns.map(c => c.items.length);
    const avgCount = itemCounts.reduce((a, b) => a + b, 0) / itemCounts.length;
    const balance = 1 - Math.min(
      Math.max(...itemCounts) / avgCount - 1,
      0.5
    ) / 0.5;

    return (gapScore * 0.5 + balance * 0.5);
  }

  /**
   * Validate and refine detected layout
   */
  private validateAndRefineLayout(layout: ColumnLayout): ColumnLayout {
    // Check column widths
    for (const column of layout.columns) {
      if (column.width < this.config.minColumnWidth) {
        // Column too narrow, might be false positive
        layout.confidence *= 0.8;
      }
    }

    // Check item distribution
    const totalItems = layout.columns.reduce((sum, col) => sum + col.items.length, 0);
    for (const column of layout.columns) {
      if (column.items.length < this.config.minItemsPerColumn) {
        layout.confidence *= 0.7;
      }
    }

    // If confidence is too low, fall back to single column
    if (layout.confidence < 0.5 && layout.columnCount > 1) {
      return {
        type: 'single',
        columnCount: 1,
        columns: [
          this.createColumn(
            0,
            layout.columns.flatMap(c => c.items),
            Math.min(...layout.columns.map(c => c.leftBoundary)),
            Math.max(...layout.columns.map(c => c.rightBoundary))
          ),
        ],
        confidence: 0.8,
        pageWidth: layout.pageWidth,
        pageHeight: layout.pageHeight,
      };
    }

    return layout;
  }

  /**
   * Estimate page dimensions from items
   */
  private estimatePageDimensions(items: PositionalTextItem[]): {
    pageWidth: number;
    pageHeight: number;
  } {
    if (items.length === 0) {
      return { pageWidth: 612, pageHeight: 792 }; // Default letter size
    }

    const maxX = Math.max(...items.map(item => item.x + item.width));
    const maxY = Math.max(...items.map(item => item.y + item.height));

    return {
      pageWidth: maxX * 1.1, // Add 10% margin
      pageHeight: maxY * 1.1,
    };
  }
}

/**
 * Sort items by column and reading order
 */
export function sortItemsByColumnAndPosition(
  items: PositionalTextItem[],
  layout: ColumnLayout
): PositionalTextItem[] {
  if (layout.columnCount === 1) {
    // Simple top-to-bottom, left-to-right sort
    return [...items].sort((a, b) => {
      // Higher y first (PDF coordinates)
      if (Math.abs(a.y - b.y) > 2) {
        return b.y - a.y;
      }
      // Then left to right
      return a.x - b.x;
    });
  }

  // Multi-column: sort by column, then by position within column
  const sorted: PositionalTextItem[] = [];

  for (const column of layout.columns) {
    const columnItems = column.items.sort((a, b) => {
      // Higher y first
      if (Math.abs(a.y - b.y) > 2) {
        return b.y - a.y;
      }
      // Then left to right
      return a.x - b.x;
    });

    sorted.push(...columnItems);
  }

  return sorted;
}

/**
 * Convenience function to analyze layout
 */
export function analyzePageLayout(
  items: PositionalTextItem[],
  config?: Partial<LayoutAnalysisConfig>
): ColumnLayout {
  const analyzer = new LayoutAnalyzer(config);
  return analyzer.analyzeLayout(items);
}

/**
 * Check if items represent a multi-column layout
 */
export function isMultiColumnLayout(items: PositionalTextItem[]): boolean {
  const layout = analyzePageLayout(items);
  return layout.columnCount > 1 && layout.confidence > 0.6;
}
