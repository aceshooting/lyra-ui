import { finiteRange } from '../../../internal/numbers.js';

/** `[[west, south], [east, north]]`, the order maplibre-gl takes. */
export type MapCameraBounds = readonly [readonly [number, number], readonly [number, number]];

/** A camera target accepted by `flyTo()`, `easeTo()` and `jumpTo()`. Every field is optional; an
 *  omitted or unusable field keeps the camera's current value. */
export interface LyraMapCameraOptions {
  /** `[longitude, latitude]`; longitude is clamped into `[-180, 180]`, latitude into `[-90, 90]`. */
  readonly center?: readonly [number, number];
  /** Zoom level, clamped into `[0, 22]`. */
  readonly zoom?: number;
  /** Bearing in degrees, clockwise from north. */
  readonly bearing?: number;
  /** Pitch in degrees, clamped into `[0, 85]`. */
  readonly pitch?: number;
  /** Animation length in milliseconds for `flyTo()` and `easeTo()`; a negative or non-finite value
   *  uses the engine's own default. Ignored by `jumpTo()` and under `prefers-reduced-motion`. */
  readonly duration?: number;
}

/** A validated camera target, ready for the engine. */
export interface MapCameraTarget {
  readonly center?: [number, number];
  readonly zoom?: number;
  readonly bearing?: number;
  readonly pitch?: number;
  readonly duration?: number;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/** Validates a camera command's options, or returns `undefined` when nothing in them is usable. */
export function normalizeCameraOptions(options: unknown): MapCameraTarget | undefined {
  if (typeof options !== 'object' || options === null) return undefined;
  const source = options as Record<string, unknown>;
  const target: {
    center?: [number, number];
    zoom?: number;
    bearing?: number;
    pitch?: number;
    duration?: number;
  } = {};
  const center = source['center'];
  if (Array.isArray(center) && center.length === 2 && isFiniteNumber(center[0]) && isFiniteNumber(center[1])) {
    target.center = [finiteRange(center[0], 0, -180, 180), finiteRange(center[1], 0, -90, 90)];
  }
  if (isFiniteNumber(source['zoom'])) target.zoom = finiteRange(source['zoom'], 0, 0, 22);
  if (isFiniteNumber(source['bearing'])) target.bearing = source['bearing'];
  if (isFiniteNumber(source['pitch'])) target.pitch = finiteRange(source['pitch'], 0, 0, 85);
  if (
    target.center === undefined &&
    target.zoom === undefined &&
    target.bearing === undefined &&
    target.pitch === undefined
  ) return undefined;
  if (isFiniteNumber(source['duration']) && source['duration'] >= 0) target.duration = source['duration'];
  return Object.freeze(target);
}

/** Running extent of the positions seen so far. */
export interface CoordinateExtent {
  west: number;
  south: number;
  east: number;
  north: number;
  count: number;
}

export function emptyExtent(): CoordinateExtent {
  return { west: Infinity, south: Infinity, east: -Infinity, north: -Infinity, count: 0 };
}

/** Adds one `[longitude, latitude]` to the extent. A non-finite coordinate is skipped; an
 *  out-of-range one is clamped, because the fit validates its box and rejects what a clamp keeps. */
export function extendExtent(extent: CoordinateExtent, longitude: unknown, latitude: unknown): void {
  if (!isFiniteNumber(longitude) || !isFiniteNumber(latitude)) return;
  const lng = finiteRange(longitude, 0, -180, 180);
  const lat = finiteRange(latitude, 0, -90, 90);
  if (lng < extent.west) extent.west = lng;
  if (lng > extent.east) extent.east = lng;
  if (lat < extent.south) extent.south = lat;
  if (lat > extent.north) extent.north = lat;
  extent.count += 1;
}

/** Most positions one `fitToData()` call reads; geometry beyond it is ignored. */
const MAX_FIT_POSITIONS = 5_000_000;

/**
 * Extends `extent` with every position of an already-projected GeoJSON `Feature` or
 * `FeatureCollection`. Iterative, so deeply nested input cannot exhaust the call stack, and bounded
 * by `MAX_FIT_POSITIONS`. The box is a plain west/east span: data straddling the antimeridian frames
 * the long way round.
 */
export function extendExtentWithGeoJson(extent: CoordinateExtent, geojson: unknown): void {
  const stack: unknown[] = [geojson];
  let budget = MAX_FIT_POSITIONS;
  while (stack.length > 0 && budget > 0) {
    const node = stack.pop();
    if (typeof node !== 'object' || node === null) continue;
    const record = node as Record<string, unknown>;
    switch (record['type']) {
      case 'FeatureCollection': {
        const features = record['features'];
        if (Array.isArray(features)) for (let i = features.length - 1; i >= 0; i -= 1) stack.push(features[i]);
        break;
      }
      case 'Feature':
        stack.push(record['geometry']);
        break;
      case 'GeometryCollection': {
        const geometries = record['geometries'];
        if (Array.isArray(geometries)) for (let i = geometries.length - 1; i >= 0; i -= 1) stack.push(geometries[i]);
        break;
      }
      case 'Point':
      case 'MultiPoint':
      case 'LineString':
      case 'MultiLineString':
      case 'Polygon':
      case 'MultiPolygon':
        budget -= extendExtentWithCoordinates(extent, record['coordinates'], budget);
        break;
      default:
        break;
    }
  }
}

/** Walks a GeoJSON `coordinates` tree of any depth; returns how many positions it read. */
function extendExtentWithCoordinates(extent: CoordinateExtent, coordinates: unknown, budget: number): number {
  let read = 0;
  const stack: unknown[] = [coordinates];
  while (stack.length > 0 && read < budget) {
    const node = stack.pop();
    if (!Array.isArray(node) || node.length === 0) continue;
    if (typeof node[0] === 'number') {
      extendExtent(extent, node[0], node[1]);
      read += 1;
    } else {
      for (let i = node.length - 1; i >= 0; i -= 1) stack.push(node[i]);
    }
  }
  return read;
}

/** The extent as a fit box, or `undefined` when no position was seen. */
export function extentToBounds(extent: CoordinateExtent): MapCameraBounds | undefined {
  if (extent.count === 0) return undefined;
  return Object.freeze([
    Object.freeze([extent.west, extent.south] as const),
    Object.freeze([extent.east, extent.north] as const),
  ] as const);
}
