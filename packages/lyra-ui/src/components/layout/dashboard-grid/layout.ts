/**
 * Curated, DOM-free dashboard layout contract. Implementation-only collision, indexing, and
 * normalization helpers live in `layout-internal.ts`; this module deliberately exposes only the
 * authoring model and the one useful placement resolver.
 */
import {
  normalizeLyraDashboardCollisionPolicy,
  projectDashboardLayout,
  resolveDashboardPlacement,
  snapshotDashboardLayout,
} from "./layout-internal.js";
import type {
  LyraDashboardCell,
  LyraDashboardCollisionPolicy,
  LyraDashboardPlacementResult,
} from "./layout-types.js";

export type {
  LyraDashboardCell,
  LyraDashboardCollisionPolicy,
  LyraDashboardPlacementResult,
} from "./layout-types.js";

/**
 * Resolves one requested placement against an immutable, schema-normalized dashboard snapshot.
 * The input read is bounded to its first 1,000 positions; malformed entries are skipped and
 * duplicate cell IDs use the first valid occurrence. The returned array and cell records are fresh
 * frozen snapshots and never alias the input collection.
 */
export function resolveLyraDashboardPlacement(
  layout: readonly LyraDashboardCell[],
  candidateCellId: string,
  requested: Readonly<{ x: number; y: number; w: number; h: number }>,
  columns: number,
  policy: LyraDashboardCollisionPolicy
): LyraDashboardPlacementResult {
  const snapshot = snapshotDashboardLayout(layout);
  const normalized = projectDashboardLayout(snapshot, columns);
  return resolveDashboardPlacement(
    normalized,
    candidateCellId,
    requested,
    columns,
    normalizeLyraDashboardCollisionPolicy(policy)
  );
}
