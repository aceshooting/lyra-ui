import { finiteRange } from '../../../internal/numbers.js';
import { sanitizeCssColor } from '../../../internal/safe-css.js';
import {
  getOwnDataDescriptor,
  MISSING_OWN_DATA_DESCRIPTOR,
  ownDataDescriptorValue,
  readOwnArrayLength,
  UNSAFE_OWN_DATA_DESCRIPTOR,
} from '../../../internal/data-descriptors.js';

// Descriptor readers shared by the map's always-loaded legend and its on-demand data-layer runtime.

/** Upper bound on rendered gradient stops, matching the deterministic-truncation pattern
 *  the marker/data-layer collection bounds use below. A ramp needs a handful of stops; anything
 *  past this is a data bug, and an unbounded loop here would build a pathological gradient. */
export const MAX_MAP_LEGEND_GRADIENT_STOPS = 64;

/**
 * Array and record admission is deliberately separate from projection. A value can revoke between
 * either operation, so every boundary reader is contained and later code only sees its canonical
 * result rather than the caller-owned object.
 */
export function isRuntimeArray(value: unknown): value is readonly unknown[] {
  try {
    return Array.isArray(value);
  } catch {
    return false;
  }
}

export function boundedOwnArrayLength(value: unknown, limit: number): number | undefined {
  if (!isRuntimeArray(value)) return undefined;
  const length = readOwnArrayLength(value);
  return length === undefined ? undefined : Math.min(length, limit);
}

export function isUnsafeDescriptor(
  descriptor: ReturnType<typeof getOwnDataDescriptor>,
): descriptor is typeof UNSAFE_OWN_DATA_DESCRIPTOR {
  return descriptor === UNSAFE_OWN_DATA_DESCRIPTOR;
}

/** A descriptor's value, or `undefined` when it is missing or unsafe. */
export const optionalDescriptorValue = ownDataDescriptorValue;

/**
 * Keeps only finite-value stops carrying a color CSS actually accepts, sorted ascending by value
 * and bounded. Returns an empty array when fewer than two usable stops survive: a one-stop
 * "gradient" is a flat block that describes nothing, so it falls back to rendering no bar at all
 * rather than a misleading solid one.
 */
export function normalizeMapLegendGradient(
  value: unknown,
): readonly (readonly [number, string])[] {
  try {
    const scanCount = boundedOwnArrayLength(value, MAX_MAP_LEGEND_GRADIENT_STOPS);
    if (scanCount === undefined) return [];
    const usable: (readonly [number, string])[] = [];
    for (let index = 0; index < scanCount; index += 1) {
      const stopDescriptor = getOwnDataDescriptor(value as object, String(index));
      if (
        stopDescriptor === MISSING_OWN_DATA_DESCRIPTOR ||
        isUnsafeDescriptor(stopDescriptor)
      )
        continue;
      const stop = stopDescriptor.value;
      const stopLength = boundedOwnArrayLength(stop, 2);
      if (stopLength === undefined || stopLength < 2) continue;
      const valueDescriptor = getOwnDataDescriptor(stop as object, '0');
      const colorDescriptor = getOwnDataDescriptor(stop as object, '1');
      if (
        valueDescriptor === MISSING_OWN_DATA_DESCRIPTOR ||
        colorDescriptor === MISSING_OWN_DATA_DESCRIPTOR ||
        isUnsafeDescriptor(valueDescriptor) ||
        isUnsafeDescriptor(colorDescriptor) ||
        typeof valueDescriptor.value !== 'number' ||
        !Number.isFinite(valueDescriptor.value) ||
        typeof colorDescriptor.value !== 'string'
      )
        continue;
      const color = sanitizeCssColor(colorDescriptor.value);
      if (!color) continue;
      usable.push([valueDescriptor.value, color] as const);
    }
    if (usable.length < 2) return [];
    return Object.freeze(
      [...usable].sort((a, b) => a[0] - b[0]),
    ) as readonly (readonly [number, string])[];
  } catch {
    return [];
  }
}

export function boundedLegendText(value: string, limit: number): string {
  return value.length <= limit ? value : `${value.slice(0, Math.max(0, limit - 1))}…`;
}

/** Point-icon defaults, applied identically by the projector below and the legend glyph render. */
export const DEFAULT_ICON_VIEW_BOX = Object.freeze([0, 0, 24, 24]) as readonly [
  number,
  number,
  number,
  number,
];
export const DEFAULT_ICON_STROKE_WIDTH = 2;
/** Markup, URLs and non-path commands are rejected: only SVG path data survives this. */
const ICON_PATH_GRAMMAR = /^[MmLlHhVvCcSsQqTtAaZz\d.eE+,\s-]+$/u;
const MAX_ICON_PATH_LENGTH = 8192;

/**
 * Descriptor-safe projection of one hostile-input icon record, minus the point layer's category
 * key. Returns undefined for anything unusable so each caller decides what an omission means —
 * a point keeps its circle, a legend row keeps its color swatch.
 */
export function projectIconPaint(row: object) {
  const path = optionalDescriptorValue(getOwnDataDescriptor(row, 'path'));
  if (
    typeof path !== 'string' ||
    path.length === 0 ||
    path.length > MAX_ICON_PATH_LENGTH ||
    !ICON_PATH_GRAMMAR.test(path)
  )
    return undefined;
  const rawBox = optionalDescriptorValue(getOwnDataDescriptor(row, 'viewBox'));
  const box: number[] = [];
  if (rawBox === undefined) box.push(...DEFAULT_ICON_VIEW_BOX);
  else {
    if (boundedOwnArrayLength(rawBox, 4) !== 4) return undefined;
    for (let index = 0; index < 4; index++) {
      const coordinate = optionalDescriptorValue(getOwnDataDescriptor(rawBox as object, String(index)));
      if (typeof coordinate !== 'number' || !Number.isFinite(coordinate) || Math.abs(coordinate) > 10_000) return undefined;
      box.push(coordinate);
    }
    if (box[2]! < 0.001 || box[3]! < 0.001) return undefined;
  }
  const mode = optionalDescriptorValue(getOwnDataDescriptor(row, 'mode'));
  const strokeWidth = optionalDescriptorValue(getOwnDataDescriptor(row, 'strokeWidth'));
  const lineCap = optionalDescriptorValue(getOwnDataDescriptor(row, 'lineCap'));
  const lineJoin = optionalDescriptorValue(getOwnDataDescriptor(row, 'lineJoin'));
  return Object.freeze({
    path,
    viewBox: Object.freeze(box) as unknown as readonly [number, number, number, number],
    mode: mode === 'stroke' || mode === 'fill-stroke' ? mode : 'fill',
    strokeWidth: finiteRange(
      typeof strokeWidth === 'number' ? strokeWidth : NaN,
      DEFAULT_ICON_STROKE_WIDTH,
      0,
      200,
    ),
    lineCap: lineCap === 'butt' || lineCap === 'square' ? lineCap : 'round',
    lineJoin: lineJoin === 'miter' || lineJoin === 'bevel' ? lineJoin : 'round',
  });
}

/**
 * The validated paint half of an icon record, shared by a point layer's `icons` and a legend
 * entry's `icon`: the same grammar, bounds and defaults reach both, so a consumer can hand one
 * record to each without either admitting something the other rejects.
 */
export type CanonicalIconPaint = NonNullable<ReturnType<typeof projectIconPaint>>;
