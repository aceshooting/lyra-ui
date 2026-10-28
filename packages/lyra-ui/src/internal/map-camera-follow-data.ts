import { getOwnDataDescriptor, isPlainDataRecord, MISSING_OWN_DATA_DESCRIPTOR, UNSAFE_OWN_DATA_DESCRIPTOR } from './data-descriptors.js';

export type MapCameraFollowMode = 'ground' | 'geographic-visual';
export interface MapCameraFollowOptions {
  readonly objectId: string;
  readonly mode: MapCameraFollowMode;
  readonly zoom?: number;
  readonly bearing?: number;
  readonly pitch?: number;
}
export type MapCameraFollowProfile =
  | { readonly status: 'admitted'; readonly helper: 'mercator' | 'globe' }
  | { readonly status: 'unavailable'; readonly reason: 'camera-constraints' | 'camera-capability' | 'camera-domain' | 'terrain' };
export type MapCameraFollowAttemptStatus = 'centering' | 'centered' | 'limited';
declare const attemptBrand: unique symbol;
export interface MapCameraFollowAttempt {
  readonly [attemptBrand]: true;
  readonly corrections: number;
  readonly nonImproving: number;
  readonly lastFrame?: number;
  /** Saturates only when the mathematical distance exceeds the finite number range. */
  readonly lastResidual?: number;
  readonly status: MapCameraFollowAttemptStatus;
}
export interface MapCameraFollowObservation {
  readonly frame: number;
  readonly point: readonly [number, number];
  readonly width: number;
  readonly height: number;
}
export interface MapCameraFollowStep {
  readonly attempt: MapCameraFollowAttempt;
  readonly status: MapCameraFollowAttemptStatus;
  readonly correction?: readonly [number, number];
}
interface Magnitude { readonly scale: number; readonly normalized: number; }
interface AttemptState { readonly maximum: number; readonly magnitude?: Magnitude; }
const attempts = new WeakMap<MapCameraFollowAttempt, AttemptState>();
const invalid = (): never => { throw new TypeError('Invalid camera follow data'); };
function own(record: object, key: PropertyKey): unknown {
  const descriptor = getOwnDataDescriptor(record, key);
  if (descriptor === UNSAFE_OWN_DATA_DESCRIPTOR) return invalid();
  return descriptor === MISSING_OWN_DATA_DESCRIPTOR ? undefined : descriptor.value;
}
function record(input: unknown, keys: readonly string[]): Record<string, unknown> {
  if (!isPlainDataRecord(input)) return invalid();
  for (const key of Reflect.ownKeys(input)) {
    if (typeof key !== 'string' || !keys.includes(key)) return invalid();
    own(input, key);
  }
  return input;
}
function finite(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return invalid();
  return value;
}
function ranged(value: unknown, lower: number, upper: number): number {
  const result = finite(value);
  if (result < lower || result > upper) return invalid();
  return result;
}
function boolean(value: unknown): boolean {
  if (typeof value !== 'boolean') return invalid();
  return value;
}
function angle(value: number): number {
  const reduced = value % 360;
  const result = reduced >= 180 ? reduced - 360 : reduced < -180 ? reduced + 360 : reduced;
  return result === 0 ? 0 : result;
}

/** Copies only follow intent; resolving an object and acquiring its camera remain separate. */
export function admitMapCameraFollowOptions(input: unknown): MapCameraFollowOptions {
  const source = record(input, ['objectId', 'mode', 'zoom', 'bearing', 'pitch']);
  const objectId = own(source, 'objectId'), mode = own(source, 'mode');
  if (typeof objectId !== 'string' || objectId.length < 1 || objectId.length > 1024 || objectId.trim().length === 0 ||
    (mode !== 'ground' && mode !== 'geographic-visual')) return invalid();
  const zoom = own(source, 'zoom'), bearing = own(source, 'bearing'), pitch = own(source, 'pitch');
  return Object.freeze({ objectId, mode,
    ...(zoom === undefined ? {} : { zoom: finite(zoom) }),
    ...(bearing === undefined ? {} : { bearing: angle(finite(bearing)) }),
    ...(pitch === undefined ? {} : { pitch: ranged(pitch, 0, 85) }),
  });
}

const profileKeys = ['latitude', 'zoom', 'pitch', 'width', 'height', 'projectionTransition', 'padding',
  'explicitBounds', 'explicitZoomLimits', 'nativeBounds', 'nativeMinZoom', 'nativeMaxZoom', 'terrain',
  'canPan', 'canObserveMotion', 'canStop', 'moving', 'hasProjection'] as const;
const unavailable = (reason: Extract<MapCameraFollowProfile, { status: 'unavailable' }>['reason']): MapCameraFollowProfile =>
  Object.freeze({ status: 'unavailable', reason });

/** Classifies copied camera facts; this never detects native hooks or reads a renderer. */
export function admitMapCameraFollowProfile(input: unknown): MapCameraFollowProfile {
  try {
    const source = record(input, profileKeys);
    const explicitBounds = boolean(own(source, 'explicitBounds'));
    const explicitZoomLimits = boolean(own(source, 'explicitZoomLimits'));
    const nativeBounds = boolean(own(source, 'nativeBounds'));
    const nativeMinZoom = finite(own(source, 'nativeMinZoom')), nativeMaxZoom = finite(own(source, 'nativeMaxZoom'));
    if (explicitBounds || explicitZoomLimits || nativeBounds || nativeMinZoom !== -2 || nativeMaxZoom !== 22) return unavailable('camera-constraints');
    if (boolean(own(source, 'terrain'))) return unavailable('terrain');
    const canPan = boolean(own(source, 'canPan')), canObserveMotion = boolean(own(source, 'canObserveMotion'));
    const canStop = boolean(own(source, 'canStop')), moving = boolean(own(source, 'moving')), hasProjection = boolean(own(source, 'hasProjection'));
    if (!canPan || !canObserveMotion || !hasProjection || (moving && !canStop)) return unavailable('camera-capability');
    const latitude = ranged(own(source, 'latitude'), -90, 90), zoom = finite(own(source, 'zoom'));
    ranged(own(source, 'pitch'), 0, 60); ranged(own(source, 'width'), 64, 4096); ranged(own(source, 'height'), 64, 4096);
    const padding = record(own(source, 'padding'), ['top', 'bottom', 'left', 'right']);
    if (['top', 'bottom', 'left', 'right'].some(side => finite(own(padding, side)) !== 0)) return unavailable('camera-domain');
    const transition = ranged(own(source, 'projectionTransition'), 0, 1);
    // Matches the pinned native globe camera's latitude clamp, including its polar plateau.
    const adjustment = Math.log2(Math.cos(Math.min(Math.abs(latitude), 85.051129) * Math.PI / 180));
    const domain = transition > 0 ? zoom - adjustment : zoom;
    if (!Number.isFinite(domain) || domain < 4 || domain > 20) return unavailable('camera-domain');
    return Object.freeze({ status: 'admitted', helper: transition > 0 ? 'globe' : 'mercator' });
  } catch { return unavailable('camera-domain'); }
}

function makeAttempt(value: Omit<MapCameraFollowAttempt, typeof attemptBrand>, state: AttemptState): MapCameraFollowAttempt {
  const result = Object.freeze(value) as MapCameraFollowAttempt;
  attempts.set(result, state);
  return result;
}
/** A fresh explicit attempt; completed frames cannot reset this budget. */
export function createMapCameraFollowAttempt(options?: { readonly reducedMotion?: boolean }): MapCameraFollowAttempt {
  const source = record(options === undefined ? {} : options, ['reducedMotion']);
  const requested = own(source, 'reducedMotion');
  const reduced = requested === undefined ? false : boolean(requested);
  return makeAttempt({ corrections: 0, nonImproving: 0, status: 'centering' }, { maximum: reduced ? 1 : 4 });
}
function point(input: unknown): readonly [number, number] {
  if (!Array.isArray(input) || own(input, 'length') !== 2 || Reflect.ownKeys(input).length !== 3) return invalid();
  return [finite(own(input, '0')), finite(own(input, '1'))];
}
function magnitude(x: number, y: number): Magnitude {
  const scale = Math.max(Math.abs(x), Math.abs(y));
  return { scale, normalized: scale === 0 ? 0 : Math.hypot(x / scale, y / scale) };
}
function improves(next: Magnitude, previous: Magnitude): boolean {
  const scale = Math.max(next.scale, previous.scale);
  if (scale === 0) return false;
  return (next.scale / scale) * next.normalized < (previous.scale / scale) * previous.normalized;
}
function step(attempt: MapCameraFollowAttempt, correction?: readonly [number, number]): MapCameraFollowStep {
  return Object.freeze({ attempt, status: attempt.status, ...(correction === undefined ? {} : { correction: Object.freeze(correction) }) });
}

/** Consumes one completed eligible projection; pending/occluded target ownership belongs to its caller. */
export function observeMapCameraFollowAttempt(attempt: MapCameraFollowAttempt, input: MapCameraFollowObservation): MapCameraFollowStep {
  const state = attempts.get(attempt);
  if (!state) return invalid();
  const source = record(input, ['frame', 'point', 'width', 'height']);
  const frame = ranged(own(source, 'frame'), 0, Number.MAX_SAFE_INTEGER);
  if (!Number.isSafeInteger(frame)) return invalid();
  const width = ranged(own(source, 'width'), 64, 4096), height = ranged(own(source, 'height'), 64, 4096);
  const [x, y] = point(own(source, 'point'));
  if (attempt.status !== 'centering' || (attempt.lastFrame !== undefined && frame <= attempt.lastFrame)) return step(attempt);
  const dx = x - width / 2, dy = y - height / 2;
  const distance = magnitude(dx, dy);
  // The scaled pair retains ordering even when the mathematical distance exceeds MAX_VALUE.
  const residual = Math.min(Number.MAX_VALUE, distance.scale * distance.normalized);
  const centered = distance.scale <= 2 && distance.scale * distance.normalized <= 2;
  const nonImproving = state.magnitude && !improves(distance, state.magnitude) ? attempt.nonImproving + 1 : 0;
  const limited = !centered && (attempt.corrections >= state.maximum || nonImproving >= 2);
  const status: MapCameraFollowAttemptStatus = centered ? 'centered' : limited ? 'limited' : 'centering';
  const next = makeAttempt({ corrections: attempt.corrections + (status === 'centering' ? 1 : 0), nonImproving,
    lastFrame: frame, lastResidual: residual, status }, { maximum: state.maximum, magnitude: distance });
  return status === 'centering' ? step(next, [Math.max(-width / 2, Math.min(width / 2, dx)), Math.max(-height / 2, Math.min(height / 2, dy))]) : step(next);
}
