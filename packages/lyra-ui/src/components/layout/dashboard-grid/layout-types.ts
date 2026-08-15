import type { LyraWidgetNode } from '../../conversation/widget-renderer/resolve.js';

/** One widget's immutable position, size, and content within `<lr-dashboard-grid>`'s `layout`.
 * Coordinates are integer grid units (`x`/`y` 0-based, `w`/`h` a span count), never pixels. */
export interface LyraDashboardCell {
  /** Stable, non-empty business identity. Duplicate cell IDs are resolved first-valid-entry-wins. */
  readonly cellId: string;
  /** 0-based column index of the cell's leading edge. */
  readonly x: number;
  /** 0-based row index of the cell's leading edge. */
  readonly y: number;
  /** Column span. */
  readonly w: number;
  /** Row span. */
  readonly h: number;
  readonly minW?: number;
  readonly minH?: number;
  readonly maxW?: number;
  readonly maxH?: number;
  /** An immovable, unresizable cell that also acts as a wall under `collision="push"`. */
  readonly locked?: boolean;
  /**
   * Declarative widget root used by the default cell's version-two widget document. Dashboard
   * admission takes a bounded frozen structural snapshot and omits hostile or malformed roots.
   */
  readonly widget?: LyraWidgetNode | null;
  /** Accessible name and default `<lr-widget>` title; falls back to `cellId` when absent or empty. */
  readonly label?: string;
}

/** How a requested move or resize handles overlap with another cell. */
export type LyraDashboardCollisionPolicy = 'reject' | 'push' | 'overlap';

/** Immutable result returned by `resolveLyraDashboardPlacement`. */
export interface LyraDashboardPlacementResult {
  /** Whether the normalized request was applied. */
  readonly accepted: boolean;
  /** Full immutable proposed layout, including a push cascade when applicable. */
  readonly layout: readonly LyraDashboardCell[];
  /** Stable layout-order cell IDs that overlapped the requested placement before resolution. */
  readonly collidedCellIds: readonly string[];
}
