import { getOwnDataDescriptor, MISSING_OWN_DATA_DESCRIPTOR, UNSAFE_OWN_DATA_DESCRIPTOR } from '../../../internal/data-descriptors.js';
import { finiteRange } from '../../../internal/numbers.js';

/** `drawMode` value: `none` disarms drawing; `line` and `polygon` arm a session. */
export type LyraMapDrawingMode = 'none' | 'line' | 'polygon';
export type MapDrawingMode = Exclude<LyraMapDrawingMode, 'none'>;
/** A `[longitude, latitude]` drawing vertex. */
export type LyraMapDrawingPoint = readonly [number, number];
export type MapDrawingError = 'invalid-index' | 'inactive' | 'empty' | 'invalid-coordinate' | 'duplicate-vertex' |
  'antipodal-edge' | 'vertex-limit' | 'too-few-vertices' | 'self-intersection' | 'degenerate' | 'ambiguous-region';

/** Spherical measurements: metres, square metres, and a geographic centroid direction. */
export interface LyraMapDrawingMetrics {
  readonly length: number;
  readonly area: number;
  /** Area first-moment centroid for polygons; arc-length first-moment centroid for lines.
   * Symmetric geometry without a unique direction has no centroid. */
  readonly centroid: LyraMapDrawingPoint | null;
}

export interface LyraMapDrawingSnapshot {
  readonly mode: Exclude<LyraMapDrawingMode, 'none'>;
  readonly phase: 'drawing' | 'completed' | 'cancelled';
  readonly vertices: readonly LyraMapDrawingPoint[];
  readonly metrics?: LyraMapDrawingMetrics;
  readonly geometry?: Readonly<{
    type: 'LineString'; coordinates: readonly LyraMapDrawingPoint[];
  }> | Readonly<{
    type: 'Polygon'; coordinates: readonly (readonly LyraMapDrawingPoint[])[];
  }>;
}

export interface MapDrawingResult {
  readonly accepted: boolean;
  readonly error?: MapDrawingError;
  readonly state: LyraMapDrawingSnapshot;
}

type Vector = [number, number, number];
const RADIUS = 6_371_008.8;
const RADIANS = Math.PI / 180;
const MAX_VERTICES = 512;
const ANGULAR_EPSILON = 1e-10;
const FULL_SPHERE = 4 * Math.PI;

const dot = (a: Vector, b: Vector): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: Vector, b: Vector): Vector => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a: Vector): number => Math.hypot(...a);
const scale = (a: Vector, value: number): Vector => [a[0] * value, a[1] * value, a[2] * value];
const angle = (a: Vector, b: Vector): number => Math.atan2(norm(cross(a, b)), finiteRange(dot(a, b), 0, -1, 1));

function vector(point: LyraMapDrawingPoint): Vector {
  const longitude = point[0] * RADIANS;
  const latitude = point[1] * RADIANS;
  return [Math.cos(latitude) * Math.cos(longitude), Math.cos(latitude) * Math.sin(longitude), Math.sin(latitude)];
}

function admitPoint(value: unknown): LyraMapDrawingPoint | undefined {
  try {
    if (!Array.isArray(value)) return undefined;
    const values: number[] = [];
    for (const key of ['0', '1']) {
      const descriptor = getOwnDataDescriptor(value, key);
      if (descriptor === MISSING_OWN_DATA_DESCRIPTOR || descriptor === UNSAFE_OWN_DATA_DESCRIPTOR ||
        typeof descriptor.value !== 'number' || !Number.isFinite(descriptor.value)) return undefined;
      values.push(descriptor.value);
    }
    const [longitude, latitude] = values as [number, number];
    if (Math.abs(longitude) > 180 || Math.abs(latitude) > 90) return undefined;
    return Object.freeze([Math.abs(latitude) === 90 ? 0 : longitude === 180 ? -180 : longitude, latitude]);
  } catch {
    return undefined;
  }
}

function centroid(moment: Vector, minimum: number): LyraMapDrawingPoint | null {
  if (norm(moment) <= minimum) return null;
  const horizontal = Math.hypot(moment[0], moment[1]);
  const longitude = horizontal <= norm(moment) * 1e-12 ? 0 : Math.atan2(moment[1], moment[0]) / RADIANS;
  return Object.freeze([longitude === 180 ? -180 : longitude, Math.atan2(moment[2], horizontal) / RADIANS]);
}

function onArc(point: Vector, a: Vector, b: Vector): boolean {
  return angle(a, point) + angle(point, b) <= angle(a, b) + ANGULAR_EPSILON;
}

/** Includes touches and overlap, so a completed ring always has a simple boundary. */
function intersects(a: Vector, b: Vector, c: Vector, d: Vector): boolean {
  const first = cross(a, b);
  const second = cross(c, d);
  const intersection = cross(first, second);
  const size = norm(intersection);
  if (size <= norm(first) * norm(second) * 1e-12) {
    return onArc(a, c, d) || onArc(b, c, d) || onArc(c, a, b) || onArc(d, a, b);
  }
  const point = scale(intersection, 1 / size);
  return (onArc(point, a, b) && onArc(point, c, d)) ||
    (onArc(scale(point, -1), a, b) && onArc(scale(point, -1), c, d));
}

function simpleRing(vertices: readonly Vector[]): boolean {
  for (let index = 0; index < vertices.length; index += 1) {
    const a = vertices[index]!;
    const b = vertices[(index + 1) % vertices.length]!;
    const c = vertices[(index + 2) % vertices.length]!;
    // Adjacent arcs share their endpoint, but may not retrace the same great circle.
    const first = cross(a, b);
    const second = cross(b, c);
    if (norm(cross(first, second)) <= norm(first) * norm(second) * 1e-12 && dot(first, second) < 0) return false;
    for (let other = index + 1; other < vertices.length; other += 1) {
      if (other === index + 1 || (index === 0 && other === vertices.length - 1)) continue;
      if (intersects(a, b, vertices[other]!, vertices[(other + 1) % vertices.length]!)) return false;
    }
  }
  return true;
}

function measurements(vertices: readonly Vector[], mode: MapDrawingMode): LyraMapDrawingMetrics | MapDrawingError {
  const polygon = mode === 'polygon';
  if (polygon && Math.PI - angle(vertices[vertices.length - 1]!, vertices[0]!) <= ANGULAR_EPSILON) return 'antipodal-edge';
  if (polygon && !simpleRing(vertices)) return 'self-intersection';
  let totalAngle = 0;
  const moment: Vector = [0, 0, 0];
  const edges = polygon ? vertices.length : vertices.length - 1;
  for (let index = 0; index < edges; index += 1) {
    const a = vertices[index]!;
    const b = vertices[(index + 1) % vertices.length]!;
    const arc = angle(a, b);
    totalAngle += arc;
    const normal = cross(a, b);
    const sum: Vector = [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
    const contribution = polygon
      ? scale(normal, arc / norm(normal))
      : scale(sum, 2 * Math.sin(arc / 2) / norm(sum));
    for (let axis = 0; axis < 3; axis += 1) moment[axis] = moment[axis]! + contribution[axis]!;
  }
  let solidAngle = 0;
  if (polygon) {
    const anchor = vertices[0]!;
    for (let index = 1; index < vertices.length - 1; index += 1) {
      const b = vertices[index]!;
      const c = vertices[index + 1]!;
      const numerator = dot(anchor, cross(b, c));
      const denominator = 1 + dot(anchor, b) + dot(b, c) + dot(c, anchor);
      if (Math.abs(numerator) < 1e-15 && denominator <= 0) return 'ambiguous-region';
      solidAngle += 2 * Math.atan2(numerator, denominator);
    }
    solidAngle %= FULL_SPHERE;
    if (solidAngle > 2 * Math.PI) solidAngle -= FULL_SPHERE;
    if (solidAngle < -2 * Math.PI) solidAngle += FULL_SPHERE;
    if (Math.abs(Math.abs(solidAngle) - 2 * Math.PI) <= ANGULAR_EPSILON) return 'ambiguous-region';
    if (Math.abs(solidAngle) * RADIUS * RADIUS < 1) return 'degenerate';
  }
  return Object.freeze({
    length: totalAngle * RADIUS,
    area: Math.abs(solidAngle) * RADIUS * RADIUS,
    centroid: centroid(polygon ? scale(moment, Math.sign(solidAngle)) : moment, polygon ? 1e-16 : totalAngle * 1e-12),
  });
}

/**
 * Bounded drawing session with detached immutable output and no input/event ownership.
 * Geometry follows shortest great-circle arcs on a sphere of radius 6,371,008.8 metres.
 * Polygons use the smaller enclosed region, reject self-touching/crossing/retraced boundaries,
 * antipodal edges, ambiguous hemispheres and areas below one square metre. Closure is implicit.
 * Intersection checks are O(V²), capped at 512 vertices; all other measurements are O(V).
 */
export class MapDrawing {
  private state: LyraMapDrawingSnapshot;

  constructor(mode: MapDrawingMode) {
    if (mode !== 'line' && mode !== 'polygon') throw new TypeError('Unsupported drawing mode.');
    this.state = Object.freeze({ mode, phase: 'drawing', vertices: Object.freeze([]) });
  }

  snapshot(): LyraMapDrawingSnapshot { return this.state; }

  private result(error?: MapDrawingError): MapDrawingResult {
    return Object.freeze({ accepted: error === undefined, ...(error ? { error } : {}), state: this.state });
  }

  add(value: unknown): MapDrawingResult {
    if (this.state.phase !== 'drawing') return this.result('inactive');
    if (this.state.vertices.length >= MAX_VERTICES) return this.result('vertex-limit');
    const point = admitPoint(value);
    if (!point) return this.result('invalid-coordinate');
    const next = vector(point);
    const vertices = this.state.vertices;
    const duplicateCandidates = this.state.mode === 'polygon' ? vertices : vertices.slice(-1);
    if (duplicateCandidates.some((entry) => angle(vector(entry), next) <= ANGULAR_EPSILON)) return this.result('duplicate-vertex');
    const previous = vertices[vertices.length - 1];
    if (previous && Math.PI - angle(vector(previous), next) <= ANGULAR_EPSILON) return this.result('antipodal-edge');
    this.state = Object.freeze({ ...this.state, vertices: Object.freeze([...vertices, point]) });
    return this.result();
  }

  /** Atomically edits a vertex; completed output is revalidated and remeasured. */
  replace(index: number, value: unknown): MapDrawingResult {
    const previous = this.state;
    if (previous.phase === 'cancelled') return this.result('inactive');
    if (!Number.isSafeInteger(index) || index < 0 || index >= previous.vertices.length) return this.result('invalid-index');
    const point = admitPoint(value);
    // Descriptor reflection may call back into this session. Never overwrite a newer edit.
    if (this.state !== previous) return this.result('inactive');
    if (!point) return this.result('invalid-coordinate');
    const next = vector(point), vertices = previous.vertices;
    const polygon = previous.mode === 'polygon';
    const neighbours = new Set<number>();
    if (index > 0) neighbours.add(index - 1);
    else if (polygon && vertices.length > 1) neighbours.add(vertices.length - 1);
    if (index + 1 < vertices.length) neighbours.add(index + 1);
    else if (polygon && vertices.length > 1) neighbours.add(0);
    const duplicateCandidates = polygon ? vertices.filter((_, other) => other !== index)
      : [...neighbours].map(other => vertices[other]!);
    if (duplicateCandidates.some(entry => angle(vector(entry), next) <= ANGULAR_EPSILON)) return this.result('duplicate-vertex');
    if ([...neighbours].some(other => Math.PI - angle(vector(vertices[other]!), next) <= ANGULAR_EPSILON)) return this.result('antipodal-edge');
    const changed = Object.freeze({ ...previous, vertices: Object.freeze(vertices.map((entry, other) => other === index ? point : entry)) });
    if (previous.phase === 'completed') {
      const completed = this.completedState(changed);
      if (typeof completed === 'string') return this.result(completed);
      this.state = completed;
    } else this.state = changed;
    return this.result();
  }

  undo(): MapDrawingResult {
    if (this.state.phase !== 'drawing') return this.result('inactive');
    if (this.state.vertices.length === 0) return this.result('empty');
    this.state = Object.freeze({ ...this.state, vertices: Object.freeze(this.state.vertices.slice(0, -1)) });
    return this.result();
  }

  cancel(): MapDrawingResult {
    this.state = Object.freeze({ mode: this.state.mode, phase: 'cancelled', vertices: Object.freeze([]) });
    return this.result();
  }

  complete(): MapDrawingResult {
    if (this.state.phase !== 'drawing') return this.result('inactive');
    const completed = this.completedState(this.state);
    if (typeof completed === 'string') return this.result(completed);
    this.state = completed;
    return this.result();
  }

  private completedState(state: LyraMapDrawingSnapshot): LyraMapDrawingSnapshot | MapDrawingError {
    const { mode, vertices } = state;
    if (vertices.length < (mode === 'polygon' ? 3 : 2)) return 'too-few-vertices';
    const metrics = measurements(vertices.map(vector), mode);
    if (typeof metrics === 'string') return metrics;
    const geometry = mode === 'line'
      ? Object.freeze({ type: 'LineString' as const, coordinates: vertices })
      : Object.freeze({ type: 'Polygon' as const, coordinates: Object.freeze([Object.freeze([...vertices, vertices[0]!])]) });
    return Object.freeze({ ...state, phase: 'completed', metrics, geometry });
  }
}
