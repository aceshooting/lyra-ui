/**
 * Pure, DOM-free grid geometry and collision resolution for `<lr-dashboard-grid>`. Every helper
 * here takes plain data in and returns plain data out -- no DOM reads, no timers, nothing
 * component-instance-specific -- so the placement/collision rules are unit-testable in isolation
 * from pointer/keyboard wiring, mirroring `widget-renderer/resolve.ts`'s own DOM-free-module
 * convention in this same package.
 */
import type { WidgetNode } from '../../conversation/widget-renderer/resolve.js';

/** One widget's position, size, and content within `<lr-dashboard-grid>`'s `layout`. Coordinates
 *  are integer grid units (`x`/`y` 0-based, `w`/`h` a span count), never pixels -- pixel geometry
 *  is resolved by the component at render/gesture time from `columns`/`rowHeight`/`gap`. */
export interface DashboardCell {
  id: string;
  /** 0-based column index of the cell's leading edge. */
  x: number;
  /** 0-based row index of the cell's leading edge. */
  y: number;
  /** Column span. Clamped to `[minW ?? 1, min(maxW ?? columns, columns)]` by every placement
   *  helper below -- a caller never needs to pre-clamp it. */
  w: number;
  /** Row span. Clamped to `[minH ?? 1, maxH ?? Infinity]`. */
  h: number;
  minW?: number;
  minH?: number;
  maxW?: number;
  maxH?: number;
  /** An immovable, unresizable cell -- excluded from drag/resize/keyboard-nudge gestures, and
   *  under `collision: 'push'` acts as a wall other cells settle against rather than something
   *  that can itself be displaced. */
  locked?: boolean;
  /** Declarative widget tree handed to a composed `<lr-widget-renderer>` for the cell's default
   *  content (see `<lr-dashboard-grid>`'s own doc for the light-DOM `cell-id` override escape
   *  hatch). `null`/omitted renders an empty default widget shell. */
  widget?: WidgetNode | null;
  /** Accessible name and default `<lr-widget>` title for the cell; falls back to `id` when unset. */
  label?: string;
}

/** How `resolvePlacement()` reacts when a requested move/resize would overlap another cell. */
export type DashboardCollisionPolicy = 'reject' | 'push' | 'overlap';

/** The minimal rectangle shape collision math needs -- every `DashboardCell` satisfies this, but
 *  gesture-preview code (a live pointer drag) can pass a lighter ad-hoc candidate too. */
export interface CellRect {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface PlacementResult {
  /** Whether `requested` (after clamping) was applied. Always `true` for `'overlap'` and for any
   *  non-colliding request; `false` only when a real collision blocked it (`'reject'` policy, or
   *  `'push'` blocked by a locked cell). */
  accepted: boolean;
  /** The full proposed layout after applying the placement (including any `'push'` cascade).
   *  Reference-equal to the input `layout` when `accepted` is `false`. */
  layout: DashboardCell[];
  /** ids of every other cell whose rectangle overlapped the (clamped) requested placement, prior
   *  to any push resolution -- populated regardless of policy so a caller can inspect what would
   *  have collided even under `'overlap'`. */
  collidedWith: string[];
}

/** Axis-aligned rectangle overlap test (touching edges do not count as overlapping). */
export function overlaps(a: CellRect, b: CellRect): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

/** Every OTHER cell in `layout` whose rectangle overlaps `candidate`. */
export function findCollisions(layout: DashboardCell[], candidate: CellRect): string[] {
  return layout.filter((c) => c.id !== candidate.id && overlaps(c, candidate)).map((c) => c.id);
}

/** Clamps a candidate's `x`/`w` so it never spans outside `[0, columns)`, and its `y` to `>= 0`
 *  (the row axis is unbounded -- `grid-auto-rows` grows the track list as needed). `w`/`h` are
 *  clamped to `cell`'s own `minW`/`maxW`/`minH`/`maxH` first, so a too-small/too-large resize
 *  request settles at the nearest allowed size rather than being rejected outright. */
export function clampCandidate(
  cell: Pick<DashboardCell, 'minW' | 'minH' | 'maxW' | 'maxH'>,
  requested: { x: number; y: number; w: number; h: number },
  columns: number,
): { x: number; y: number; w: number; h: number } {
  const minW = cell.minW ?? 1;
  const maxW = Math.max(minW, Math.min(cell.maxW ?? columns, columns));
  const minH = cell.minH ?? 1;
  const maxH = Math.max(minH, cell.maxH ?? Number.POSITIVE_INFINITY);
  const w = Math.max(minW, Math.min(requested.w, maxW));
  const h = Math.max(minH, Math.min(requested.h, maxH));
  const x = Math.max(0, Math.min(requested.x, Math.max(0, columns - w)));
  const y = Math.max(0, requested.y);
  return { x, y, w, h };
}

/** Spatial reading order (row-major: top-to-bottom, then leading-to-trailing within a row) --
 *  used both for roving-focus keyboard navigation and for the DOM order cells render in, so the
 *  container-query stacked/compact layout (which drops grid placement in favor of document flow)
 *  reads in the same order as the grid layout it replaces. */
export function sortSpatial(layout: DashboardCell[]): DashboardCell[] {
  return [...layout].sort((a, b) => a.y - b.y || a.x - b.x);
}

function replaceCell(layout: DashboardCell[], next: DashboardCell): DashboardCell[] {
  return layout.map((c) => (c.id === next.id ? next : c));
}

/**
 * Resolves a single cell's requested move/resize against `layout`'s collision policy. `requested`
 * is clamped (bounds + this cell's own min/max) before any collision check, so out-of-range input
 * never itself causes a rejection -- only a genuine overlap with another cell can.
 *
 * - `'overlap'`: no collision check at all; the clamped request always applies.
 * - `'reject'`: a colliding request is dropped entirely (`layout` unchanged).
 * - `'push'`: colliding, unlocked cells are displaced downward (never off the requested cell's
 *   own path) to make room; a collision with a `locked` cell can't be resolved this way and is
 *   rejected, same as `'reject'`.
 */
export function resolvePlacement(
  layout: DashboardCell[],
  candidateId: string,
  requested: { x: number; y: number; w: number; h: number },
  columns: number,
  policy: DashboardCollisionPolicy,
): PlacementResult {
  const current = layout.find((c) => c.id === candidateId);
  if (!current) return { accepted: false, layout, collidedWith: [] };
  const clamped = clampCandidate(current, requested, columns);
  const candidate: DashboardCell = { ...current, ...clamped };
  const collidedWith = findCollisions(layout, candidate);

  if (policy === 'overlap' || collidedWith.length === 0) {
    return { accepted: true, layout: replaceCell(layout, candidate), collidedWith };
  }
  if (policy === 'reject') {
    return { accepted: false, layout, collidedWith };
  }
  // policy === 'push'
  const blockedByLocked = collidedWith.some((id) => layout.find((c) => c.id === id)?.locked);
  if (blockedByLocked) return { accepted: false, layout, collidedWith };
  return { accepted: true, layout: pushResolve(layout, candidate), collidedWith };
}

/** `'push'` collision resolution: settles every OTHER unlocked cell downward (along `y` only --
 *  `x`/`w` never change during a push), in priority order (the candidate first, then every
 *  remaining cell -- locked ones before unlocked ones, each group in its original `layout`
 *  order), so a cell only ever moves in response to a higher-priority cell it would otherwise
 *  overlap. Locked cells never move and are placed at their authored position unconditionally (a
 *  locked cell colliding with the candidate itself is already rejected by the caller before this
 *  runs). Bounded to one gravity pass per already-placed cell, so a pathological input terminates
 *  instead of looping. */
function pushResolve(layout: DashboardCell[], candidate: DashboardCell): DashboardCell[] {
  const others = layout.filter((c) => c.id !== candidate.id);
  const locked = others.filter((c) => c.locked);
  const movable = others.filter((c) => !c.locked);
  const ordered: DashboardCell[] = [{ ...candidate }, ...locked.map((c) => ({ ...c })), ...movable.map((c) => ({ ...c }))];
  const placed: DashboardCell[] = [];
  for (const cell of ordered) {
    if (cell.id !== candidate.id && cell.locked) {
      placed.push(cell);
      continue;
    }
    let y = cell.y;
    for (let i = 0; i < placed.length + 1; i++) {
      const blocking = placed.find((p) => overlaps({ ...cell, y }, p));
      if (!blocking) break;
      y = blocking.y + blocking.h;
    }
    placed.push({ ...cell, y });
  }
  return layout.map((c) => placed.find((p) => p.id === c.id)!);
}
