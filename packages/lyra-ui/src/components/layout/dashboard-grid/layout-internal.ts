/** DOM-free normalization, indexing, and collision implementation for `<lr-dashboard-grid>`. */
import { finiteInteger } from "../../../internal/numbers.js";
import {
  createWidgetDocument,
  type LyraWidgetNode,
} from "../../conversation/widget-renderer/resolve.js";
import type {
  LyraDashboardCell,
  LyraDashboardCollisionPolicy,
  LyraDashboardPlacementResult,
} from "./layout-types.js";

export const DASHBOARD_MAX_CELLS = 1_000;
const DASHBOARD_MAX_COLUMNS = 48;
const INVALID = Symbol("invalid-dashboard-value");
const MISSING = Symbol("missing-dashboard-value");

export type DashboardAuthoredCellSnapshot = Readonly<LyraDashboardCell>;

interface DashboardCellRect {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

export interface DashboardSpatialIndex {
  readonly columns: number;
  readonly byId: ReadonlyMap<string, LyraDashboardCell>;
  readonly orderById: ReadonlyMap<string, number>;
  readonly columnBuckets: readonly (readonly LyraDashboardCell[])[];
}

export interface DashboardPlacementMetrics {
  intervalQueries: number;
  intervalInsertions: number;
  collisionCandidates: number;
}

function safeRead(
  record: object,
  key: PropertyKey
): unknown | typeof INVALID | typeof MISSING {
  try {
    return Object.hasOwn(record, key) ? Reflect.get(record, key) : MISSING;
  } catch {
    return INVALID;
  }
}

function asFiniteInteger(
  value: unknown,
  fallback: number,
  min: number,
  max: number
): number {
  return finiteInteger(
    typeof value === "number" ? value : Number.NaN,
    fallback,
    min,
    max
  );
}

function optionalFiniteInteger(
  value: unknown,
  min: number,
  max: number
): number | undefined {
  return typeof value === "number" && Number.isFinite(value)
    ? finiteInteger(value, min, min, max)
    : undefined;
}

function isArray(value: unknown): value is unknown[] {
  try {
    return Array.isArray(value);
  } catch {
    return false;
  }
}

function snapshotDashboardWidget(
  value: unknown
): LyraWidgetNode | null | undefined {
  if (value === null) return null;
  if (value === undefined || value === MISSING) return undefined;
  try {
    return createWidgetDocument(value as LyraWidgetNode).root;
  } catch {
    return undefined;
  }
}

/** Reads at most the admitted prefix and copies every dashboard-owned field once. */
export function snapshotDashboardLayout(
  input: unknown
): readonly DashboardAuthoredCellSnapshot[] {
  if (!isArray(input)) return Object.freeze([]);
  const output: LyraDashboardCell[] = [];
  const ids = new Set<string>();
  const length = safeRead(input, "length");
  if (typeof length !== "number" || !Number.isFinite(length)) {
    return Object.freeze([]);
  }
  const count = Math.min(
    finiteInteger(length, 0, 0, DASHBOARD_MAX_CELLS),
    DASHBOARD_MAX_CELLS
  );
  for (let index = 0; index < count; index += 1) {
    const value = safeRead(input, index);
    if (
      value === INVALID ||
      value === MISSING ||
      value === null ||
      typeof value !== "object"
    )
      continue;
    const id = safeRead(value, "id");
    const x = safeRead(value, "x");
    const y = safeRead(value, "y");
    const w = safeRead(value, "w");
    const h = safeRead(value, "h");
    const minWValue = safeRead(value, "minW");
    const maxWValue = safeRead(value, "maxW");
    const minHValue = safeRead(value, "minH");
    const maxHValue = safeRead(value, "maxH");
    const label = safeRead(value, "label");
    const widget = safeRead(value, "widget");
    const locked = safeRead(value, "locked");
    if (
      [
        id,
        x,
        y,
        w,
        h,
        minWValue,
        maxWValue,
        minHValue,
        maxHValue,
        label,
        widget,
        locked,
      ].includes(INVALID) ||
      typeof id !== "string" ||
      id.length === 0 ||
      id !== id.trim() ||
      ids.has(id) ||
      x === MISSING ||
      y === MISSING ||
      w === MISSING ||
      h === MISSING
    ) {
      continue;
    }

    const minW = optionalFiniteInteger(minWValue, 1, DASHBOARD_MAX_COLUMNS);
    const maxW = optionalFiniteInteger(maxWValue, 1, DASHBOARD_MAX_COLUMNS);
    const minH = optionalFiniteInteger(minHValue, 1, Number.MAX_SAFE_INTEGER);
    const maxH = optionalFiniteInteger(maxHValue, 1, Number.MAX_SAFE_INTEGER);
    const widgetSnapshot = snapshotDashboardWidget(widget);
    const cell: LyraDashboardCell = {
      id,
      x: asFiniteInteger(x, 0, 0, Number.MAX_SAFE_INTEGER),
      y: asFiniteInteger(y, 0, 0, Number.MAX_SAFE_INTEGER),
      w: asFiniteInteger(w, 1, 1, DASHBOARD_MAX_COLUMNS),
      h: asFiniteInteger(h, 1, 1, Number.MAX_SAFE_INTEGER),
      ...(minW === undefined ? {} : { minW }),
      ...(maxW === undefined ? {} : { maxW }),
      ...(minH === undefined ? {} : { minH }),
      ...(maxH === undefined ? {} : { maxH }),
      ...(locked === true ? { locked: true } : {}),
      ...(typeof label === "string" ? { label } : {}),
      ...(widgetSnapshot === undefined ? {} : { widget: widgetSnapshot }),
    };
    ids.add(id);
    output.push(Object.freeze(cell));
  }
  return Object.freeze(output);
}

export function clampDashboardCandidate(
  cell: Pick<LyraDashboardCell, "minW" | "minH" | "maxW" | "maxH">,
  requested: Readonly<{ x: number; y: number; w: number; h: number }>,
  columnsInput: number
): Readonly<{ x: number; y: number; w: number; h: number }> {
  const columns = finiteInteger(columnsInput, 12, 1, DASHBOARD_MAX_COLUMNS);
  const { minW, maxW, minH, maxH } = normalizeDashboardBounds(cell, columns);
  const w = asFiniteInteger(requested.w, minW, minW, maxW);
  const h = asFiniteInteger(requested.h, minH, minH, maxH);
  const x = asFiniteInteger(requested.x, 0, 0, Math.max(0, columns - w));
  const y = asFiniteInteger(
    requested.y,
    0,
    0,
    Math.max(0, Number.MAX_SAFE_INTEGER - h)
  );
  return Object.freeze({ x, y, w, h });
}

function normalizeDashboardBounds(
  cell: Pick<LyraDashboardCell, "minW" | "minH" | "maxW" | "maxH">,
  columns: number
): Readonly<{ minW: number; maxW: number; minH: number; maxH: number }> {
  const minW = finiteInteger(cell.minW ?? 1, 1, 1, columns);
  const maxW = finiteInteger(cell.maxW ?? columns, columns, minW, columns);
  const minH = finiteInteger(cell.minH ?? 1, 1, 1, Number.MAX_SAFE_INTEGER);
  const maxH = finiteInteger(
    cell.maxH ?? Number.MAX_SAFE_INTEGER,
    Number.MAX_SAFE_INTEGER,
    minH,
    Number.MAX_SAFE_INTEGER
  );
  return Object.freeze({ minW, maxW, minH, maxH });
}

export function projectDashboardLayout(
  input: readonly DashboardAuthoredCellSnapshot[],
  columnsInput: number
): readonly LyraDashboardCell[] {
  const columns = finiteInteger(columnsInput, 12, 1, DASHBOARD_MAX_COLUMNS);
  return Object.freeze(
    input.map((cell) => {
      const bounds = normalizeDashboardBounds(cell, columns);
      const normalized = {
        ...cell,
        ...(cell.minW === undefined ? {} : { minW: bounds.minW }),
        ...(cell.maxW === undefined ? {} : { maxW: bounds.maxW }),
        ...(cell.minH === undefined ? {} : { minH: bounds.minH }),
        ...(cell.maxH === undefined ? {} : { maxH: bounds.maxH }),
      };
      return Object.freeze({
        ...normalized,
        ...clampDashboardCandidate(normalized, normalized, columns),
      });
    })
  );
}

export function normalizeLyraDashboardCollisionPolicy(
  value: unknown
): LyraDashboardCollisionPolicy {
  return value === "push" || value === "overlap" ? value : "reject";
}

export function overlapsDashboardCells(
  a: DashboardCellRect,
  b: DashboardCellRect
): boolean {
  return (
    a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
  );
}

export function sortDashboardSpatial(
  layout: readonly LyraDashboardCell[]
): readonly LyraDashboardCell[] {
  return Object.freeze([...layout].sort((a, b) => a.y - b.y || a.x - b.x));
}

export function createDashboardSpatialIndex(
  layout: readonly LyraDashboardCell[],
  columnsInput: number
): DashboardSpatialIndex {
  const columns = finiteInteger(columnsInput, 12, 1, DASHBOARD_MAX_COLUMNS);
  const byId = new Map<string, LyraDashboardCell>();
  const orderById = new Map<string, number>();
  const buckets: LyraDashboardCell[][] = Array.from(
    { length: columns },
    () => []
  );
  for (let index = 0; index < layout.length; index += 1) {
    const cell = layout[index]!;
    byId.set(cell.id, cell);
    orderById.set(cell.id, index);
    const end = Math.min(columns, cell.x + cell.w);
    for (let column = cell.x; column < end; column += 1) {
      buckets[column]!.push(cell);
    }
  }
  return Object.freeze({
    columns,
    byId,
    orderById,
    columnBuckets: Object.freeze(
      buckets.map((bucket) => Object.freeze(bucket))
    ),
  });
}

export function findDashboardCollisions(
  index: DashboardSpatialIndex,
  candidate: DashboardCellRect,
  metrics?: DashboardPlacementMetrics
): readonly string[] {
  const candidates = new Set<LyraDashboardCell>();
  const end = Math.min(index.columns, candidate.x + candidate.w);
  for (let column = Math.max(0, candidate.x); column < end; column += 1) {
    for (const cell of index.columnBuckets[column] ?? []) {
      metrics && (metrics.collisionCandidates += 1);
      if (cell.id !== candidate.id) candidates.add(cell);
    }
  }
  return Object.freeze(
    [...candidates]
      .filter((cell) => overlapsDashboardCells(cell, candidate))
      .sort(
        (a, b) =>
          (index.orderById.get(a.id) ?? 0) - (index.orderById.get(b.id) ?? 0)
      )
      .map((cell) => cell.id)
  );
}

interface OccupiedInterval {
  start: number;
  end: number;
}

function firstOverlappingInterval(
  intervals: readonly OccupiedInterval[],
  y: number,
  h: number
): OccupiedInterval | undefined {
  let low = 0;
  let high = intervals.length;
  while (low < high) {
    const middle = (low + high) >>> 1;
    if (intervals[middle]!.end <= y) low = middle + 1;
    else high = middle;
  }
  const interval = intervals[low];
  return interval && interval.start < y + h ? interval : undefined;
}

function addOccupiedInterval(
  intervals: OccupiedInterval[],
  start: number,
  end: number
): void {
  let low = 0;
  let high = intervals.length;
  while (low < high) {
    const middle = (low + high) >>> 1;
    if (intervals[middle]!.end < start) low = middle + 1;
    else high = middle;
  }
  const insertion = low;
  let mergedStart = start;
  let mergedEnd = end;
  let removalEnd = insertion;
  while (
    removalEnd < intervals.length &&
    intervals[removalEnd]!.start <= mergedEnd
  ) {
    mergedStart = Math.min(mergedStart, intervals[removalEnd]!.start);
    mergedEnd = Math.max(mergedEnd, intervals[removalEnd]!.end);
    removalEnd += 1;
  }
  intervals.splice(insertion, removalEnd - insertion, {
    start: mergedStart,
    end: mergedEnd,
  });
}

function pushResolve(
  layout: readonly LyraDashboardCell[],
  candidate: LyraDashboardCell,
  columns: number,
  metrics?: DashboardPlacementMetrics
): readonly LyraDashboardCell[] {
  const others = layout.filter((cell) => cell.id !== candidate.id);
  const ordered: LyraDashboardCell[] = [
    candidate,
    ...others.filter((cell) => cell.locked),
    ...others.filter((cell) => !cell.locked),
  ];
  const occupancy: OccupiedInterval[][] = Array.from(
    { length: columns },
    () => []
  );
  const placedById = new Map<string, LyraDashboardCell>();

  for (const cell of ordered) {
    let y = cell.y;
    if (cell.id === candidate.id || !cell.locked) {
      for (let pass = 0; pass <= placedById.size; pass += 1) {
        let nextY = y;
        const endColumn = Math.min(columns, cell.x + cell.w);
        for (let column = cell.x; column < endColumn; column += 1) {
          metrics && (metrics.intervalQueries += 1);
          const interval = firstOverlappingInterval(
            occupancy[column]!,
            y,
            cell.h
          );
          if (interval) nextY = Math.max(nextY, interval.end);
        }
        if (nextY === y) break;
        y = Math.min(nextY, Math.max(0, Number.MAX_SAFE_INTEGER - cell.h));
      }
    }
    const placed = Object.freeze({ ...cell, y });
    placedById.set(placed.id, placed);
    const occupiedEnd = Math.min(Number.MAX_SAFE_INTEGER, placed.y + placed.h);
    const endColumn = Math.min(columns, placed.x + placed.w);
    for (let column = placed.x; column < endColumn; column += 1) {
      metrics && (metrics.intervalInsertions += 1);
      addOccupiedInterval(occupancy[column]!, placed.y, occupiedEnd);
    }
  }

  return Object.freeze(layout.map((cell) => placedById.get(cell.id) ?? cell));
}

export function resolveDashboardPlacement(
  layout: readonly LyraDashboardCell[],
  candidateId: string,
  requested: Readonly<{ x: number; y: number; w: number; h: number }>,
  columnsInput: number,
  policyInput: LyraDashboardCollisionPolicy,
  metrics?: DashboardPlacementMetrics
): LyraDashboardPlacementResult {
  const columns = finiteInteger(columnsInput, 12, 1, DASHBOARD_MAX_COLUMNS);
  const policy = normalizeLyraDashboardCollisionPolicy(policyInput);
  const spatialIndex = createDashboardSpatialIndex(layout, columns);
  const current = spatialIndex.byId.get(candidateId);
  if (!current) {
    return Object.freeze({
      accepted: false,
      layout,
      collidedWith: Object.freeze([]),
    });
  }

  const clamped = clampDashboardCandidate(current, requested, columns);
  const candidate = Object.freeze({ ...current, ...clamped });
  const collidedWith = findDashboardCollisions(
    spatialIndex,
    candidate,
    metrics
  );
  if (policy === "reject" && collidedWith.length > 0) {
    return Object.freeze({ accepted: false, layout, collidedWith });
  }
  if (
    policy === "push" &&
    collidedWith.some((id) => spatialIndex.byId.get(id)?.locked)
  ) {
    return Object.freeze({ accepted: false, layout, collidedWith });
  }

  const nextLayout =
    policy === "push" && collidedWith.length > 0
      ? pushResolve(layout, candidate, columns, metrics)
      : Object.freeze(
          layout.map((cell) => (cell.id === candidate.id ? candidate : cell))
        );
  return Object.freeze({ accepted: true, layout: nextLayout, collidedWith });
}
