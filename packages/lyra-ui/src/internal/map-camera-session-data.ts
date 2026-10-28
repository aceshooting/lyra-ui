import { getOwnDataDescriptor, isPlainDataRecord, MISSING_OWN_DATA_DESCRIPTOR, UNSAFE_OWN_DATA_DESCRIPTOR } from './data-descriptors.js';
import { finiteInterpolate } from './numbers.js';

export interface MapViewpoint {
  readonly center: readonly [number, number];
  readonly zoom: number;
  readonly bearing: number;
  readonly pitch: number;
}
export interface MapCameraKeyframe {
  readonly instant: number;
  readonly view: MapViewpoint;
  readonly interpolation: 'linear' | 'hold';
}
declare const admittedTour: unique symbol;
export interface AdmittedMapCameraTour {
  readonly keyframes: readonly MapCameraKeyframe[];
  readonly [admittedTour]: true;
}
const tours = new WeakSet<object>();
const MAX_INSTANT = 8640000000000000;
const MAX_KEYFRAMES = 1024;

function record(input: unknown, allowed: readonly string[]): Record<string, unknown> {
  if (!isPlainDataRecord(input)) throw new TypeError('Invalid camera data record');
  for (const key of Reflect.ownKeys(input)) {
    if (typeof key !== 'string' || !allowed.includes(key)) throw new TypeError('Unknown camera data field');
    own(input, key);
  }
  return input;
}
function own(input: object, key: PropertyKey): unknown {
  const descriptor = getOwnDataDescriptor(input, key);
  if (descriptor === UNSAFE_OWN_DATA_DESCRIPTOR) throw new TypeError('Invalid camera data descriptor');
  return descriptor === MISSING_OWN_DATA_DESCRIPTOR ? undefined : descriptor.value;
}
function finite(input: unknown): number {
  if (typeof input !== 'number' || !Number.isFinite(input)) throw new TypeError('Expected finite camera value');
  return input;
}
function range(input: unknown, minimum: number, maximum: number): number {
  const value = finite(input);
  if (value < minimum || value > maximum) throw new RangeError('Camera value outside supported range');
  return value;
}
function instant(input: unknown): number { return range(input, -MAX_INSTANT, MAX_INSTANT); }
function wrap(value: number): number {
  const remainder = value % 360;
  const normalized = remainder >= 180 ? remainder - 360 : remainder < -180 ? remainder + 360 : remainder;
  return normalized === 0 ? 0 : normalized;
}
function array(input: unknown, minimum: number, maximum: number): { readonly value: readonly unknown[]; readonly length: number } {
  if (!Array.isArray(input)) throw new TypeError('Expected camera data array');
  const length = range(own(input, 'length'), minimum, maximum);
  if (!Number.isInteger(length)) throw new TypeError('Invalid camera data array length');
  // Only dense indexed arrays are data; extra own fields must not carry executable metadata.
  const keys = Reflect.ownKeys(input);
  if (keys.length !== length + 1 || keys.some(key => typeof key !== 'string' ||
    (key !== 'length' && (!/^(0|[1-9]\d*)$/.test(key) || Number(key) >= length)))) {
    throw new TypeError('Invalid camera data array fields');
  }
  return { value: input, length };
}
function copyView(input: MapViewpoint): MapViewpoint {
  return Object.freeze({ center: Object.freeze([input.center[0], input.center[1]] as const), zoom: input.zoom, bearing: input.bearing, pitch: input.pitch });
}

/** Strict, detached camera data; applying native camera limits is a separate operation. */
export function admitMapViewpoint(input: unknown): MapViewpoint {
  const source = record(input, ['center', 'zoom', 'bearing', 'pitch']);
  const center = array(own(source, 'center'), 2, 2).value;
  return Object.freeze({
    center: Object.freeze([range(own(center, '0'), -180, 180), range(own(center, '1'), -90, 90)] as const),
    zoom: finite(own(source, 'zoom')),
    bearing: wrap(finite(own(source, 'bearing'))),
    pitch: range(own(source, 'pitch'), 0, 85),
  });
}

/** Admit once; the runtime brand keeps sampling independent of caller records and accessors. */
export function admitMapCameraTour(input: unknown): AdmittedMapCameraTour {
  const source = record(input, ['keyframes']);
  const frames = array(own(source, 'keyframes'), 1, MAX_KEYFRAMES);
  const keyframes: MapCameraKeyframe[] = [];
  let previous = -Infinity;
  for (let index = 0; index < frames.length; index++) {
    const frame = record(own(frames.value, String(index)), ['instant', 'view', 'interpolation']);
    const time = instant(own(frame, 'instant'));
    if (time <= previous) throw new RangeError('Camera keyframes must be strictly increasing');
    previous = time;
    const requested = own(frame, 'interpolation');
    const interpolation = requested === undefined ? 'linear' : requested;
    if (interpolation !== 'linear' && interpolation !== 'hold') throw new TypeError('Invalid camera interpolation');
    keyframes.push(Object.freeze({ instant: time, view: admitMapViewpoint(own(frame, 'view')), interpolation }));
  }
  const result = Object.freeze({ keyframes: Object.freeze(keyframes) }) as AdmittedMapCameraTour;
  tours.add(result);
  return result;
}
function interpolateAngle(first: number, last: number, ratio: number): number {
  let difference = wrap(last - first);
  if (difference === -180) difference = 180;
  return wrap(first + difference * ratio);
}

/** Binary location over admitted immutable frames; results are detached frozen viewpoints. */
export function sampleMapCameraTour(
  tour: AdmittedMapCameraTour,
  time: number,
  options?: { readonly reducedMotion?: boolean },
): MapViewpoint {
  if (!tours.has(tour)) throw new TypeError('Expected admitted camera tour');
  const sample = instant(time);
  const configuration = options === undefined ? undefined : record(options, ['reducedMotion']);
  const motion = configuration === undefined ? undefined : own(configuration, 'reducedMotion');
  if (motion !== undefined && typeof motion !== 'boolean') throw new TypeError('Invalid camera sampling options');
  const frames = tour.keyframes;
  let low = 0, high = frames.length;
  while (low < high) {
    const middle = low + Math.floor((high - low) / 2);
    if (frames[middle]!.instant <= sample) low = middle + 1;
    else high = middle;
  }
  const index = Math.max(0, low - 1), first = frames[index]!;
  const last = frames[index + 1];
  if (sample <= first.instant || !last || first.interpolation === 'hold' || motion === true) return copyView(first.view);
  const ratio = (sample - first.instant) / (last.instant - first.instant);
  return Object.freeze({
    center: Object.freeze([interpolateAngle(first.view.center[0], last.view.center[0], ratio),
      finiteInterpolate(first.view.center[1], last.view.center[1], ratio)] as const),
    zoom: finiteInterpolate(first.view.zoom, last.view.zoom, ratio),
    bearing: interpolateAngle(first.view.bearing, last.view.bearing, ratio),
    pitch: finiteInterpolate(first.view.pitch, last.view.pitch, ratio),
  });
}
