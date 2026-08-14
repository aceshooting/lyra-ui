/**
 * Curated, DOM-free dashboard layout contract. Implementation-only collision, indexing, and
 * normalization helpers live in `layout-internal.ts`; this module deliberately exposes only the
 * authoring model and the one useful placement resolver.
 */
import type { WidgetNode } from "../../conversation/widget-renderer/resolve.js";
import {
  normalizeLyraDashboardCollisionPolicy,
  projectDashboardLayout,
  resolveDashboardPlacement,
  snapshotDashboardLayout,
} from "./layout-internal.js";

/** One widget's immutable position, size, and content within `<lr-dashboard-grid>`'s `layout`.
 * Coordinates are integer grid units (`x`/`y` 0-based, `w`/`h` a span count), never pixels. */
export interface LyraDashboardCell {
  /** Stable, non-empty identity. Duplicate ids are resolved first-valid-entry-wins. */
  readonly id: string;
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
  /** Declarative widget root used by the default cell's version-two widget document. */
  readonly widget?: WidgetNode | null;
  /** Accessible name and default `<lr-widget>` title; falls back to `id` when absent or empty. */
  readonly label?: string;
}

/** How a requested move or resize handles overlap with another cell. */
export type LyraDashboardCollisionPolicy = "reject" | "push" | "overlap";

/** Immutable result returned by {@link resolveLyraDashboardPlacement}. */
export interface LyraDashboardPlacementResult {
  /** Whether the normalized request was applied. */
  readonly accepted: boolean;
  /** Full immutable proposed layout, including a push cascade when applicable. */
  readonly layout: readonly LyraDashboardCell[];
  /** Stable layout-order ids that overlapped the requested placement before resolution. */
  readonly collidedWith: readonly string[];
}

/**
 * Resolves one requested placement against an immutable, schema-normalized dashboard snapshot.
 * The input read is bounded to its first 1,000 positions; malformed entries are skipped and
 * duplicate ids use the first valid occurrence. The returned array and cell records are fresh
 * frozen snapshots and never alias the input collection.
 */
export function resolveLyraDashboardPlacement(
  layout: readonly LyraDashboardCell[],
  candidateId: string,
  requested: Readonly<{ x: number; y: number; w: number; h: number }>,
  columns: number,
  policy: LyraDashboardCollisionPolicy
): LyraDashboardPlacementResult {
  const snapshot = snapshotDashboardLayout(layout);
  const normalized = projectDashboardLayout(snapshot, columns);
  return resolveDashboardPlacement(
    normalized,
    candidateId,
    requested,
    columns,
    normalizeLyraDashboardCollisionPolicy(policy)
  );
}
