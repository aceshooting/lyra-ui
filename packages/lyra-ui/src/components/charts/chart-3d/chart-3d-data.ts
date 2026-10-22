import {
  validateGraphColumns,
  POINT_COLUMN_LIMIT,
  type TypedColumnIssue,
  type TypedColumnResult,
} from '../../../internal/typed-columns.js';

/** What a chart draws: uniform dots, dots sized by a per-row diameter, or lines joining adjacent rows. */
export type Chart3dType = 'scatter' | 'bubble' | 'line';

/**
 * Immutable typed columns; publish changes by assigning a new object. Row `i` of every column
 * describes row `i`. `ids` must be unique and non-empty. `x`, `y` and `z` are required and finite.
 * `size` holds CSS-pixel diameters from 0 to 1024 and only affects bubble charts. `category`
 * indexes `categories`, and `labels` names rows in the data table.
 */
export interface LyraChart3dColumns {
  readonly ids: readonly string[];
  readonly x: Float32Array;
  readonly y: Float32Array;
  readonly z: Float32Array;
  readonly size?: Float32Array;
  readonly category?: Uint16Array;
  readonly categories?: readonly string[];
  readonly labels?: readonly string[];
}

/** An axis label and an optional unit; ticks and the data table show `label (unit)`. */
export interface LyraChart3dAxis {
  readonly label?: string;
  readonly unit?: string;
}

/** Camera coordinates use the chart's normalized world; Y increases downward. Angles are radians. */
export interface LyraChart3dCamera {
  readonly yaw: number;
  readonly pitch: number;
  readonly distance: number;
  readonly target: { readonly x: number; readonly y: number; readonly z: number };
}

/** One source row as the data table presents it; `index` is the row's position in the source columns. */
export interface LyraChart3dRow {
  readonly id: string;
  readonly index: number;
  readonly label: string;
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly size?: number;
  readonly category?: string;
}

/** The payload handed to the optional points renderer. */
export interface Chart3dEngineData {
  positions: Float32Array;
  sizes?: Float32Array;
  categories?: Uint16Array;
  segments?: Uint32Array;
  mode: '3d';
  axes: {
    axis: 'x' | 'y' | 'z';
    min: number;
    max: number;
    label: string;
    ticks: { value: number; label: string }[];
    grid: boolean;
  }[];
}

const MAX_CATEGORY_NAMES = 65536;
const MAX_SIZE = 1024;

/** Reads one own data property, never invoking an accessor or inherited member. */
const own = (value: unknown, key: string): unknown => {
  if (!value || typeof value !== 'object') return undefined;
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  return descriptor && 'value' in descriptor ? descriptor.value : undefined;
};

const typedPrototype = Object.getPrototypeOf(Uint8Array.prototype) as object;
const typedGetter = (key: string | symbol) => Object.getOwnPropertyDescriptor(typedPrototype, key)!.get!;
const typedKind = typedGetter(Symbol.toStringTag);
const typedBuffer = typedGetter('buffer');
const typedOffset = typedGetter('byteOffset');
const typedLength = typedGetter('length');

/**
 * Wraps a caller's typed array in a fresh native view of the same buffer, so shadowed methods and
 * metadata on the caller's object are never trusted and nothing is copied. Anything that is not
 * the expected kind is returned unchanged for the shared validator to reject.
 */
function numeric(value: unknown, kind: 'Float32Array' | 'Uint16Array'): unknown {
  if (!value || typeof value !== 'object' || typedKind.call(value) !== kind) return value;
  const buffer = typedBuffer.call(value) as ArrayBuffer;
  const offset = typedOffset.call(value) as number;
  const length = typedLength.call(value) as number;
  return kind === 'Float32Array' ? new Float32Array(buffer, offset, length) : new Uint16Array(buffer, offset, length);
}

class Chart3dColumnError extends Error {
  constructor(readonly issue: TypedColumnIssue) {
    super(issue.code);
  }
}

/** Snapshots a string column from own data entries into a frozen array; accessors are rejected. */
function strings(value: unknown, limit: number, column: string): unknown {
  if (!Array.isArray(value)) return value;
  const length = own(value, 'length');
  if (typeof length !== 'number' || !Number.isSafeInteger(length) || length < 0) {
    throw new TypeError('Invalid string column length');
  }
  if (length > limit) throw new Chart3dColumnError({ code: 'too-many', column, limit });
  const result: string[] = [];
  for (let index = 0; index < length; index++) {
    const entry = own(value, String(index));
    if (typeof entry !== 'string') throw new TypeError('String columns require own string values');
    result.push(entry);
  }
  return Object.freeze(result);
}

/**
 * Validates caller columns once per assignment. Numeric buffers are shared (they are immutable by
 * contract) and string columns are snapshotted, without invoking shell or indexed accessors.
 */
export function admitChart3dData(value: unknown): TypedColumnResult<LyraChart3dColumns> {
  try {
    const source: Record<string, unknown> = {};
    for (const key of ['ids', 'x', 'y', 'z', 'size', 'category', 'categories', 'labels']) source[key] = own(value, key);
    for (const key of ['ids', 'labels', 'categories']) {
      source[key] = strings(source[key], key === 'categories' ? MAX_CATEGORY_NAMES : POINT_COLUMN_LIMIT, key);
    }
    for (const key of ['x', 'y', 'z', 'size', 'category']) {
      source[key] = numeric(source[key], key === 'category' ? 'Uint16Array' : 'Float32Array');
    }
    // The graph validator already checks ids, lengths, finiteness and category bounds; the chart has
    // no edges, so it receives empty edge columns and a zero edge ceiling.
    const result = validateGraphColumns(
      { ...source, source: new Uint32Array(), target: new Uint32Array() },
      { nodes: POINT_COLUMN_LIMIT, edges: 0 },
    );
    if (!result.ok) return result;
    const c = result.columns;
    for (const key of ['x', 'y', 'z'] as const) {
      if (!c[key]) return { ok: false, issue: { code: 'missing', column: key } };
    }
    if (c.size?.some((entry) => entry > MAX_SIZE)) return { ok: false, issue: { code: 'out-of-range', column: 'size' } };
    return {
      ok: true,
      count: result.count,
      columns: Object.freeze({
        ids: c.ids, x: c.x!, y: c.y!, z: c.z!, size: c.size, category: c.category, categories: c.categories, labels: c.labels,
      }),
    };
  } catch (error) {
    return { ok: false, issue: error instanceof Chart3dColumnError ? error.issue : { code: 'not-an-object', column: '' } };
  }
}

/** Copies an axis from untrusted input: own string data only, bounded in length. */
export function normalizeChart3dAxis(value: unknown): LyraChart3dAxis {
  try {
    const label = own(value, 'label');
    const unit = own(value, 'unit');
    return Object.freeze({
      label: typeof label === 'string' ? label.slice(0, 128) : '',
      unit: typeof unit === 'string' ? unit.slice(0, 64) : '',
    });
  } catch {
    return Object.freeze({});
  }
}

/** The visible and spoken axis title, with its unit when there is one. */
export function chart3dAxisTitle(axis: LyraChart3dAxis): string {
  const label = axis.label ?? '';
  return axis.unit ? `${label} (${axis.unit})` : label;
}

/** Copies a camera from untrusted input, clamping every field into a finite, renderer-safe range. */
export function normalizeChart3dCamera(value: unknown): LyraChart3dCamera {
  const bounded = (entry: unknown, fallback: number, min: number, max: number) =>
    typeof entry === 'number' && Number.isFinite(entry) ? Math.min(max, Math.max(min, entry)) : fallback;
  try {
    const target = own(value, 'target');
    return Object.freeze({
      yaw: bounded(own(value, 'yaw'), 0, -Math.PI * 2, Math.PI * 2),
      pitch: bounded(own(value, 'pitch'), 0, -Math.PI / 2 + 0.001, Math.PI / 2 - 0.001),
      distance: bounded(own(value, 'distance'), 5, 0.001, 1e8),
      target: Object.freeze({
        x: bounded(own(target, 'x'), 0, -1e7, 1e7),
        y: bounded(own(target, 'y'), 0, -1e7, 1e7),
        z: bounded(own(target, 'z'), 0, -1e7, 1e7),
      }),
    });
  } catch {
    return normalizeChart3dCamera(undefined);
  }
}

/**
 * A bounded view of the visible source rows. Hidden categories remove rows from the view without
 * changing the identity or source index of the rows that remain.
 */
export class Chart3dRows {
  /** Number of visible rows. */
  readonly count: number;
  private readonly visible: Uint32Array;
  private readonly lows = [Infinity, Infinity, Infinity];
  private readonly highs = [-Infinity, -Infinity, -Infinity];
  private lookup?: Map<string, number>;

  constructor(readonly columns: LyraChart3dColumns, hidden: ReadonlySet<number> = new Set()) {
    const total = columns.ids.length;
    const visible = new Uint32Array(total);
    const { category, x, y, z } = columns;
    let count = 0;
    for (let row = 0; row < total; row++) {
      if (category && hidden.has(category[row]!)) continue;
      visible[count++] = row;
      const values = [x[row]!, y[row]!, z[row]!];
      for (let axis = 0; axis < 3; axis++) {
        if (values[axis]! < this.lows[axis]!) this.lows[axis] = values[axis]!;
        if (values[axis]! > this.highs[axis]!) this.highs[axis] = values[axis]!;
      }
    }
    this.visible = visible.subarray(0, count);
    this.count = count;
  }

  /** Half the span of the largest axis, computed so opposite finite extremes never overflow. */
  private get scale(): number {
    return Math.max(...this.highs.map((high, axis) => high / 2 - this.lows[axis]! / 2)) || 1;
  }

  private center(axis: number): number {
    return this.highs[axis]! / 2 + this.lows[axis]! / 2;
  }

  /** Uniform coordinate normalization with Y inverted so a larger source value is higher on screen. */
  private normalized(value: number, axis: number, scale = this.scale): number {
    return (value / scale - this.center(axis) / scale) * (axis === 1 ? -1 : 1);
  }

  /** The visible index of a source ID, or -1 when it is missing or hidden. */
  visibleIndex(id: string): number {
    if (!id) return -1;
    if (!this.lookup) {
      this.lookup = new Map();
      for (let index = 0; index < this.count; index++) this.lookup.set(this.columns.ids[this.visible[index]!]!, index);
    }
    return this.lookup.get(id) ?? -1;
  }

  /** The row at a visible index, or undefined outside the visible range. */
  row(index: number): LyraChart3dRow | undefined {
    if (!Number.isSafeInteger(index) || index < 0 || index >= this.count) return undefined;
    const row = this.visible[index]!;
    const c = this.columns;
    const category = c.category?.[row];
    return {
      id: c.ids[row]!,
      index: row,
      label: c.labels?.[row] ?? c.ids[row]!,
      x: c.x[row]!,
      y: c.y[row]!,
      z: c.z[row]!,
      size: c.size?.[row],
      category: category === undefined ? undefined : c.categories?.[category] ?? String(category),
    };
  }

  /** The normalized world position of a visible row, used to aim the camera without a renderer. */
  position(index: number): { x: number; y: number; z: number } | null {
    const row = this.row(index);
    if (!row) return null;
    const scale = this.scale;
    return { x: this.normalized(row.x, 0, scale), y: this.normalized(row.y, 1, scale), z: this.normalized(row.z, 2, scale) };
  }

  /** A camera that frames every visible row for a viewport of this size; no renderer is needed. */
  fitCamera(width: number, height: number): LyraChart3dCamera {
    if (!this.count) return normalizeChart3dCamera(undefined);
    const halves = this.highs.map((high, axis) => high / 2 - this.lows[axis]! / 2);
    const scale = Math.max(...halves) || 1;
    const aspect = (Number.isFinite(width) ? Math.max(1, width) : 1) / (Number.isFinite(height) ? Math.max(1, height) : 1);
    const distance =
      (Math.max(halves[0]! / scale / aspect, halves[1]! / scale) / Math.tan(Math.PI / 8) + halves[2]! / scale) * 1.2;
    return normalizeChart3dCamera({ yaw: 0, pitch: 0, distance: distance || 5, target: { x: 0, y: 0, z: 0 } });
  }

  /**
   * Builds the renderer payload for the visible rows. Row `i` of every array is visible row `i`.
   * Bubble sizes are passed through; line segments join only rows that were adjacent in the source,
   * so a hidden row breaks the line instead of being bridged.
   */
  data(type: Chart3dType, axes: readonly LyraChart3dAxis[], format: (value: number) => string): Chart3dEngineData {
    const scale = this.scale;
    const { columns } = this;
    const positions = new Float32Array(this.count * 3);
    const sizes = type === 'bubble' && columns.size ? new Float32Array(this.count) : undefined;
    const categories = columns.category ? new Uint16Array(this.count) : undefined;
    const segments = type === 'line' ? new Uint32Array(Math.max(0, this.count - 1) * 2) : undefined;
    let segmentLength = 0;
    for (let row = 0; row < this.count; row++) {
      const source = this.visible[row]!;
      positions[row * 3] = this.normalized(columns.x[source]!, 0, scale);
      positions[row * 3 + 1] = this.normalized(columns.y[source]!, 1, scale);
      positions[row * 3 + 2] = this.normalized(columns.z[source]!, 2, scale);
      if (sizes) sizes[row] = columns.size![source]!;
      if (categories) categories[row] = columns.category![source]!;
      if (segments && row > 0 && this.visible[row - 1]! + 1 === source) {
        segments[segmentLength++] = row - 1;
        segments[segmentLength++] = row;
      }
    }
    return {
      positions,
      sizes,
      categories,
      segments: segments?.subarray(0, segmentLength),
      mode: '3d',
      axes: (['x', 'y', 'z'] as const).map((axis, index) => {
        const low = this.count ? this.lows[index]! : 0;
        const high = this.count ? this.highs[index]! : 0;
        const ticks = Array.from({ length: low === high ? 1 : 5 }, (_, tick) => {
          const value = low * (1 - tick / 4) + (high * tick) / 4;
          return { value: this.count ? this.normalized(value, index, scale) : 0, label: format(value) };
        });
        const ends = this.count ? [this.normalized(low, index, scale), this.normalized(high, index, scale)] : [0, 0];
        return {
          axis,
          min: Math.min(...ends),
          max: Math.max(...ends),
          label: chart3dAxisTitle(normalizeChart3dAxis(axes[index])),
          ticks,
          grid: true,
        };
      }),
    };
  }
}
