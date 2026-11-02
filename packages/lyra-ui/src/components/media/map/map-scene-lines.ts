import type { CanonicalScenePosition } from '../../../internal/map-scene-contract.js';
import type { AdmittedSceneObject } from './map-scene-admission.js';

/** An admitted scene object drawn as a native line. */
export type SceneLineObject = Extract<AdmittedSceneObject, { readonly kind: 'path' | 'arc' }>;
/** `[longitude, latitude, altitude]`; longitudes are unwrapped so consecutive vertices differ by at most 180 degrees. */
export type SceneLineCoordinate = readonly [longitude: number, latitude: number, altitude: number];

export interface SceneLineFeature {
  readonly type: 'Feature';
  readonly properties: {
    readonly id: string;
    readonly kind: 'path' | 'arc';
    readonly color: string;
    readonly width: number;
    readonly opacity: number;
  };
  readonly geometry: { readonly type: 'LineString'; readonly coordinates: readonly SceneLineCoordinate[] };
}
export interface SceneLineData {
  readonly type: 'FeatureCollection';
  readonly features: readonly SceneLineFeature[];
}

/** Generated vertices shared by every path and arc of one scene. */
export const SCENE_LINE_VERTEX_LIMIT = 262_144;
/** Arcs always sample their height profile, even across short ground distances. */
export const SCENE_ARC_MIN_SEGMENTS = 32;
const radians = Math.PI / 180;
const FINEST_STEP = radians;

interface Segment {
  readonly start: CanonicalScenePosition;
  readonly end: CanonicalScenePosition;
  readonly angle: number;
  readonly greatCircle: boolean;
  readonly minimum: number;
  readonly height: number;
}

type Vector = readonly [number, number, number];

function unit(position: CanonicalScenePosition): Vector {
  const lng = position.lngLat[0] * radians, lat = position.lngLat[1] * radians;
  return [Math.cos(lat) * Math.cos(lng), Math.cos(lat) * Math.sin(lng), Math.sin(lat)];
}

function angle(a: Vector, b: Vector): number {
  const cross = Math.hypot(a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]);
  return Math.atan2(cross, a[0] * b[0] + a[1] * b[1] + a[2] * b[2]);
}

/**
 * Arc altitude in meters at fraction `t` of the ground track: the endpoint altitudes interpolate
 * linearly and `height` adds a parabolic rise, `4t(1 - t)`, that peaks at the midpoint.
 */
export function sceneArcAltitude(start: number, end: number, height: number, t: number): number {
  return start + (end - start) * t + height * 4 * t * (1 - t);
}

/**
 * Whether a line draped on the displayed surface reproduces the authored geometry. Altitude is
 * representable only when it is zero and refers to the surface the flat engine drapes onto:
 * sea level without terrain, or displayed terrain.
 */
export function sceneLineGrounded(object: SceneLineObject, terrain: boolean): boolean {
  if (object.kind === 'arc' && object.height !== 0) return false;
  const positions = object.kind === 'arc' ? [object.start, object.end] : object.positions;
  return positions.every(position => position.altitude === 0 && (!terrain || position.altitudeReference === 'terrain'));
}

function segments(object: SceneLineObject): readonly Segment[] {
  if (object.kind === 'arc') {
    return [{ start: object.start, end: object.end, angle: angle(unit(object.start), unit(object.end)),
      greatCircle: true, minimum: SCENE_ARC_MIN_SEGMENTS, height: object.height }];
  }
  const greatCircle = object.interpolation === 'great-circle', result: Segment[] = [];
  for (let index = 1; index < object.positions.length; index++) {
    const start = object.positions[index - 1]!, end = object.positions[index]!;
    result.push({ start, end, angle: greatCircle ? angle(unit(start), unit(end)) : 0, greatCircle, minimum: 1, height: 0 });
  }
  return result;
}

function steps(segment: Segment, step: number): number {
  return segment.greatCircle ? Math.max(segment.minimum, Math.ceil(segment.angle / step)) : 1;
}

function unwrap(longitude: number, previous: number | undefined): number {
  if (previous === undefined) return longitude;
  let value = longitude;
  while (value - previous > 180) value -= 360;
  while (value - previous < -180) value += 360;
  return value;
}

function emit(target: SceneLineCoordinate[], longitude: number, latitude: number, altitude: number): void {
  const value = unwrap(longitude, target.at(-1)?.[0]);
  target.push(Object.freeze([value === 0 ? 0 : value, latitude === 0 ? 0 : latitude, altitude === 0 ? 0 : altitude] as const));
}

function trace(object: SceneLineObject, rows: readonly Segment[], step: number): readonly SceneLineCoordinate[] {
  const coordinates: SceneLineCoordinate[] = [];
  const first = rows[0]!.start;
  emit(coordinates, first.lngLat[0], first.lngLat[1], first.altitude);
  for (const segment of rows) {
    const count = steps(segment, step), { start, end } = segment;
    const a = unit(start), b = unit(end), sine = Math.sin(segment.angle);
    for (let index = 1; index < count; index++) {
      const t = index / count;
      const altitude = object.kind === 'arc' ? sceneArcAltitude(start.altitude, end.altitude, segment.height, t)
        : start.altitude + (end.altitude - start.altitude) * t;
      if (sine < 1e-12) {
        emit(coordinates, start.lngLat[0] + (unwrap(end.lngLat[0], start.lngLat[0]) - start.lngLat[0]) * t,
          start.lngLat[1] + (end.lngLat[1] - start.lngLat[1]) * t, altitude);
        continue;
      }
      const wa = Math.sin((1 - t) * segment.angle) / sine, wb = Math.sin(t * segment.angle) / sine;
      const x = wa * a[0] + wb * b[0], y = wa * a[1] + wb * b[1], z = wa * a[2] + wb * b[2];
      emit(coordinates, Math.atan2(y, x) / radians, Math.atan2(z, Math.hypot(x, y)) / radians, altitude);
    }
    emit(coordinates, end.lngLat[0], end.lngLat[1], end.altitude);
  }
  return Object.freeze(coordinates);
}

/**
 * Generates owned line coordinates for admitted paths and arcs. Great-circle paths and arcs are
 * sampled at most one degree apart; when the whole scene would exceed `limit` vertices, the shared
 * angular step doubles until it fits. Returns undefined when even one step per segment does not fit.
 */
export function tessellateSceneLines(objects: readonly SceneLineObject[],
  limit = SCENE_LINE_VERTEX_LIMIT): readonly (readonly SceneLineCoordinate[])[] | undefined {
  const rows = objects.map(segments);
  const count = (step: number): number => rows.reduce((total, row) =>
    total + 1 + row.reduce((sum, segment) => sum + steps(segment, step), 0), 0);
  let step = FINEST_STEP;
  while (count(step) > limit) {
    if (step >= Math.PI) return undefined;
    step *= 2;
  }
  return Object.freeze(objects.map((object, index) => trace(object, rows[index]!, step)));
}

/** One frozen GeoJSON feature per line; every object needs a resolved native color. */
export function buildSceneLineData(objects: readonly SceneLineObject[], colors: ReadonlyMap<string, string>,
  limit = SCENE_LINE_VERTEX_LIMIT): SceneLineData | undefined {
  if (objects.some(object => !colors.has(object.id))) return undefined;
  const geometry = tessellateSceneLines(objects, limit);
  if (!geometry) return undefined;
  const features = objects.map((object, index): SceneLineFeature => Object.freeze({ type: 'Feature',
    properties: Object.freeze({ id: object.id, kind: object.kind, color: colors.get(object.id)!, width: object.width,
      opacity: object.opacity }),
    geometry: Object.freeze({ type: 'LineString', coordinates: geometry[index]! }) }));
  return Object.freeze({ type: 'FeatureCollection', features: Object.freeze(features) });
}
