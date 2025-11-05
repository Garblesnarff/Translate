// client/src/lib/pdf/PositionalTextBuilder.ts

import { isTibetanCharacter, isTsek, containsTibetan } from '../tibetan/syllableDetector';

/**
 * Represents a text item with its position on the page
 */
export interface PositionalTextItem {
  text: string;
  x: number;      // Horizontal position
  y: number;      // Vertical position
  width: number;  // Width of text item
  height: number; // Height of text item
  transform?: number[]; // Raw transform matrix from PDF.js
}

/**
 * Represents a line of text items grouped by vertical position
 */
interface TextLine {
  y: number;
  items: PositionalTextItem[];
  averageHeight: number;
}

/**
 * Configuration for text reconstruction
 */
export interface TextBuilderConfig {
  /** Threshold for grouping items into same line (in PDF units) */
  lineHeightThreshold: number;

  /** Threshold for adding space between items (in PDF units) */
  spaceThreshold: number;

  /** Whether to preserve artificial spacing in Tibetan text */
  preserveArtificialSpacing: boolean;

  /** Minimum gap to consider a paragraph break (multiple of average line height) */
  paragraphBreakMultiplier: number;
}

const DEFAULT_CONFIG: TextBuilderConfig = {
  lineHeightThreshold: 2,
  spaceThreshold: 3,
  preserveArtificialSpacing: false,
  paragraphBreakMultiplier: 1.5,
};

/**
 * PositionalTextBuilder reconstructs text from PDF text items
 * using their position data to properly handle spacing, line breaks,
 * and multi-column layouts.
 */
export class PositionalTextBuilder {
  private config: TextBuilderConfig;

  constructor(config: Partial<TextBuilderConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Build text from positional text items
   */
  buildText(items: PositionalTextItem[]): string {
    if (items.length === 0) return '';

    // Group items by line (vertical position)
    const lines = this.groupIntoLines(items);

    // Sort lines by vertical position (top to bottom)
    lines.sort((a, b) => b.y - a.y); // PDF coordinates: higher y = higher on page

    // Build text from lines
    return this.reconstructTextFromLines(lines);
  }

  /**
   * Group text items into lines based on vertical position
   */
  private groupIntoLines(items: PositionalTextItem[]): TextLine[] {
    const linesMap = new Map<number, TextLine>();

    for (const item of items) {
      // Find existing line within threshold
      let foundLine = false;

      for (const [lineY, line] of linesMap.entries()) {
        if (Math.abs(item.y - lineY) <= this.config.lineHeightThreshold) {
          line.items.push(item);
          foundLine = true;
          break;
        }
      }

      // Create new line if not found
      if (!foundLine) {
        linesMap.set(item.y, {
          y: item.y,
          items: [item],
          averageHeight: item.height,
        });
      }
    }

    // Convert map to array and calculate average heights
    const lines = Array.from(linesMap.values());
    for (const line of lines) {
      const totalHeight = line.items.reduce((sum, item) => sum + item.height, 0);
      line.averageHeight = totalHeight / line.items.length;
    }

    return lines;
  }

  /**
   * Sort items in a line by horizontal position (left to right)
   */
  private sortLineItems(line: TextLine): void {
    line.items.sort((a, b) => a.x - b.x);
  }

  /**
   * Calculate spacing between two consecutive items
   */
  private calculateSpacing(item1: PositionalTextItem, item2: PositionalTextItem): string {
    // Distance from end of item1 to start of item2
    const gap = item2.x - (item1.x + item1.width);

    // If items overlap or are very close, no space
    if (gap <= 0) {
      return '';
    }

    // For Tibetan text, be more conservative about adding spaces
    const item1IsTibetan = containsTibetan(item1.text, 0.3);
    const item2IsTibetan = containsTibetan(item2.text, 0.3);

    // If both are Tibetan and there's already a tsek, no additional space
    if (item1IsTibetan && item2IsTibetan) {
      if (isTsek(item1.text[item1.text.length - 1]) ||
          isTsek(item2.text[0])) {
        return '';
      }
    }

    // Add space if gap exceeds threshold
    if (gap >= this.config.spaceThreshold) {
      // For very large gaps, might indicate column break
      if (gap > this.config.spaceThreshold * 10) {
        return '  '; // Double space for significant gaps
      }
      return ' ';
    }

    // For Tibetan text without explicit separator, don't add space
    if (item1IsTibetan && item2IsTibetan && !this.config.preserveArtificialSpacing) {
      return '';
    }

    return '';
  }

  /**
   * Reconstruct text from lines
   */
  private reconstructTextFromLines(lines: TextLine[]): string {
    const textParts: string[] = [];
    let previousLineY: number | null = null;
    let averageLineHeight = 0;

    // Calculate average line height for paragraph detection
    if (lines.length > 1) {
      const heights = lines.map(line => line.averageHeight);
      averageLineHeight = heights.reduce((sum, h) => sum + h, 0) / heights.length;
    }

    for (const line of lines) {
      // Sort items in line by horizontal position
      this.sortLineItems(line);

      // Build line text
      const lineText = this.buildLineText(line);

      // Determine line break type
      if (previousLineY !== null) {
        const lineGap = previousLineY - line.y; // Gap between lines

        // Check if this is a paragraph break
        if (averageLineHeight > 0 &&
            lineGap > averageLineHeight * this.config.paragraphBreakMultiplier) {
          textParts.push('\n\n'); // Paragraph break
        } else {
          textParts.push('\n'); // Regular line break
        }
      }

      textParts.push(lineText);
      previousLineY = line.y;
    }

    return textParts.join('');
  }

  /**
   * Build text from items in a single line
   */
  private buildLineText(line: TextLine): string {
    if (line.items.length === 0) return '';

    const parts: string[] = [];

    for (let i = 0; i < line.items.length; i++) {
      const item = line.items[i];
      parts.push(item.text);

      // Add spacing between items
      if (i < line.items.length - 1) {
        const nextItem = line.items[i + 1];
        const spacing = this.calculateSpacing(item, nextItem);
        if (spacing) {
          parts.push(spacing);
        }
      }
    }

    return parts.join('');
  }

  /**
   * Extract positional text items from PDF.js TextContent
   */
  static extractPositionalItems(textContent: any): PositionalTextItem[] {
    const items: PositionalTextItem[] = [];

    for (const item of textContent.items) {
      // PDF.js provides text items with transform matrix
      // Transform: [scaleX, skewY, skewX, scaleY, translateX, translateY]
      if ('str' in item && item.str && item.transform) {
        const transform = item.transform;

        items.push({
          text: item.str,
          x: transform[4], // translateX
          y: transform[5], // translateY
          width: item.width || 0,
          height: item.height || Math.abs(transform[3]), // scaleY as height approximation
          transform: transform,
        });
      }
    }

    return items;
  }

  /**
   * Detect if items represent a multi-column layout
   * Returns column boundaries if detected
   */
  static detectColumns(items: PositionalTextItem[]): number[] | null {
    if (items.length < 10) return null;

    // Group items by approximate x-position
    const xPositions = items.map(item => item.x).sort((a, b) => a - b);

    // Find significant gaps in x-positions (potential column boundaries)
    const gaps: Array<{ position: number; gap: number }> = [];

    for (let i = 1; i < xPositions.length; i++) {
      const gap = xPositions[i] - xPositions[i - 1];
      if (gap > 50) { // Significant gap threshold
        gaps.push({ position: xPositions[i - 1], gap });
      }
    }

    // If we found significant gaps, we might have columns
    if (gaps.length > 0) {
      // Sort by gap size and take the largest
      gaps.sort((a, b) => b.gap - a.gap);

      // Return column boundary positions
      return gaps.slice(0, 2).map(g => g.position);
    }

    return null;
  }

  /**
   * Group items by column for multi-column layouts
   */
  static groupByColumn(
    items: PositionalTextItem[],
    columnBoundaries: number[]
  ): PositionalTextItem[][] {
    const columns: PositionalTextItem[][] = [];

    // Sort boundaries
    const boundaries = [...columnBoundaries].sort((a, b) => a - b);

    // Create column groups
    for (let i = 0; i <= boundaries.length; i++) {
      columns.push([]);
    }

    // Assign items to columns
    for (const item of items) {
      let columnIndex = 0;
      for (let i = 0; i < boundaries.length; i++) {
        if (item.x > boundaries[i]) {
          columnIndex = i + 1;
        }
      }
      columns[columnIndex].push(item);
    }

    return columns;
  }
}

/**
 * Convenience function to build text from PDF.js TextContent
 */
export function buildTextFromPDFContent(
  textContent: any,
  config?: Partial<TextBuilderConfig>
): string {
  const items = PositionalTextBuilder.extractPositionalItems(textContent);
  const builder = new PositionalTextBuilder(config);

  // Check for multi-column layout
  const columnBoundaries = PositionalTextBuilder.detectColumns(items);

  if (columnBoundaries && columnBoundaries.length > 0) {
    // Handle multi-column layout
    const columns = PositionalTextBuilder.groupByColumn(items, columnBoundaries);

    // Build text for each column and combine
    const columnTexts = columns.map(columnItems => builder.buildText(columnItems));

    // Join columns with double line break
    return columnTexts.filter(text => text.trim().length > 0).join('\n\n');
  } else {
    // Single column layout
    return builder.buildText(items);
  }
}
