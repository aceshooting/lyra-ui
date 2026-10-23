import { isIdentityGeoJsonData } from './map-overlay-admission.js';
import { getInheritedPropertyDescriptor, getOwnDataDescriptor, isObjectValue, isPlainDataRecord, MISSING_OWN_DATA_DESCRIPTOR, readOwnArrayLength, UNSAFE_OWN_DATA_DESCRIPTOR } from '../../../internal/data-descriptors.js';

type NativeMethod = (...args: unknown[]) => unknown;
const MAX_VALUES = 50_000;
const MAX_ENTRIES = 10_000;
const MAX_DEPTH = 24;

function ownFields(value: unknown): ReadonlyMap<string, unknown> | undefined {
  if (!isPlainDataRecord(value)) return undefined;
  const keys = Reflect.ownKeys(value);
  if (keys.length > MAX_ENTRIES) return undefined;
  const fields = new Map<string, unknown>();
  for (const key of keys) {
    if (typeof key !== 'string' || key === '__proto__' || key === 'constructor' || key === 'prototype') return undefined;
    const descriptor = getOwnDataDescriptor(value, key);
    if (descriptor === MISSING_OWN_DATA_DESCRIPTOR || descriptor === UNSAFE_OWN_DATA_DESCRIPTOR) return undefined;
    fields.set(key, descriptor.value);
  }
  return fields;
}

function arrayValues(value: unknown): readonly unknown[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const prototype = Object.getPrototypeOf(value) as object | null;
  if (!prototype) return undefined;
  const constructor = Object.getOwnPropertyDescriptor(prototype, 'constructor');
  if (!constructor || !Object.hasOwn(constructor, 'value') || typeof constructor.value !== 'function' ||
    Function.prototype.toString.call(constructor.value) !== Function.prototype.toString.call(Array)) return undefined;
  const length = readOwnArrayLength(value);
  if (length === undefined || length > MAX_ENTRIES || Reflect.ownKeys(value).length !== length + 1) return undefined;
  const values: unknown[] = [];
  for (let index = 0; index < length; index += 1) {
    const descriptor = getOwnDataDescriptor(value, String(index));
    if (descriptor === MISSING_OWN_DATA_DESCRIPTOR || descriptor === UNSAFE_OWN_DATA_DESCRIPTOR) return undefined;
    values.push(descriptor.value);
  }
  return values;
}

function sameData(left: unknown, right: unknown): boolean {
  let values = 0;
  const leftPath = new WeakSet<object>();
  const rightPath = new WeakSet<object>();
  const equal = (a: unknown, b: unknown, depth: number): boolean => {
    if (++values > MAX_VALUES || depth > MAX_DEPTH || typeof a !== typeof b) return false;
    if (a === null || b === null) return a === b;
    if (typeof a === 'string' || typeof a === 'boolean') return a === b;
    if (typeof a === 'number') return Number.isFinite(a) && Number.isFinite(b) && Object.is(a, b);
    if (typeof a !== 'object' || typeof b !== 'object' || leftPath.has(a) || rightPath.has(b)) return false;
    leftPath.add(a); rightPath.add(b);
    try {
      if (Array.isArray(a) || Array.isArray(b)) {
        const left = arrayValues(a); const right = arrayValues(b);
        return left !== undefined && right !== undefined && left.length === right.length &&
          left.every((entry, index) => equal(entry, right[index], depth + 1));
      }
      const left = ownFields(a); const right = ownFields(b);
      if (!left || !right || left.size !== right.size) return false;
      for (const [key, value] of left) if (!right.has(key) || !equal(value, right.get(key), depth + 1)) return false;
      return true;
    } finally { leftPath.delete(a); rightPath.delete(b); }
  };
  return equal(left, right, 0);
}

/** Recognize admitted GeoJSON envelopes without treating arbitrary records as source data. */
function geoJsonData(value: unknown): boolean {
  const feature = (input: unknown): boolean => {
    const fields = ownFields(input);
    if (fields?.get('type') !== 'Feature' || !fields.has('geometry') || !fields.has('properties')) return false;
    const properties = fields.get('properties');
    if (properties !== null && !isPlainDataRecord(properties)) return false;
    const geometry = fields.get('geometry');
    if (geometry === null) return true;
    const shape = ownFields(geometry);
    if (!shape) return false;
    const type = shape.get('type');
    if (type === 'GeometryCollection') return Array.isArray(shape.get('geometries'));
    return ['Point', 'MultiPoint', 'LineString', 'MultiLineString', 'Polygon', 'MultiPolygon'].includes(type as string) &&
      Array.isArray(shape.get('coordinates'));
  };
  const fields = ownFields(value);
  if (fields?.get('type') === 'Feature') return feature(value);
  if (fields?.get('type') !== 'FeatureCollection') return false;
  const features = arrayValues(fields.get('features'));
  return features !== undefined && features.every(feature);
}

function sameMetadata(previous: ReadonlyMap<string, unknown>, next: ReadonlyMap<string, unknown>, mutable: ReadonlySet<string>): boolean {
  const keys = new Set([...previous.keys(), ...next.keys()]);
  for (const key of keys) {
    if (mutable.has(key)) continue;
    if (!previous.has(key) || !next.has(key) || !sameData(previous.get(key), next.get(key))) return false;
  }
  return true;
}

function validCoordinates(value: unknown): boolean {
  const corners = arrayValues(value);
  return corners?.length === 4 && corners.every(corner => {
    const pair = arrayValues(corner);
    return pair?.length === 2 && typeof pair[0] === 'number' && Number.isFinite(pair[0]) && Math.abs(pair[0]) <= 180 &&
      typeof pair[1] === 'number' && Number.isFinite(pair[1]) && Math.abs(pair[1]) <= 90;
  });
}

function nativeCanvas(value: unknown): boolean {
  if (typeof HTMLCanvasElement === 'undefined') return false;
  try {
    const read = Object.getOwnPropertyDescriptor(HTMLCanvasElement.prototype, 'width')?.get;
    return typeof read === 'function' && typeof Reflect.apply(read, value, []) === 'number';
  } catch { return false; }
}

function method(source: unknown, key: string): NativeMethod | undefined {
  if (!isObjectValue(source)) return undefined;
  const descriptor = getInheritedPropertyDescriptor(source, key);
  return descriptor && Object.hasOwn(descriptor, 'value') && typeof descriptor.value === 'function'
    ? descriptor.value as NativeMethod : undefined;
}

/**
 * Plan the narrow native GeoJSON data and image/canvas updates that retain dependent layers. Unsupported changes
 * or capabilities return no plan so the owner can replace the source in dependency order. The
 * descriptors have already crossed admission; reflection here does not evaluate their accessors.
 * The optional owner check runs before every native operation, including compound canvas updates.
 */
export function planMapSourceUpdate(
  source: unknown,
  previous: Readonly<Record<string, unknown>>,
  next: Readonly<Record<string, unknown>>,
  checkCurrent?: () => void,
): (() => void) | undefined {
  try {
    const before = ownFields(previous); const after = ownFields(next);
    if (!before || !after || before.get('type') !== after.get('type')) return undefined;
    const type = before.get('type');
    if (type === 'geojson') {
      const previousData = before.get('data'); const nextData = after.get('data');
      // Identity-admitted data is replaced in place by reference; it is never walked here.
      if (isIdentityGeoJsonData(nextData) || isIdentityGeoJsonData(previousData)) {
        if (previousData === nextData || (!isIdentityGeoJsonData(nextData) && typeof nextData !== 'string') ||
          !sameMetadata(before, after, new Set(['data']))) return undefined;
        const setData = method(source, 'setData');
        return setData ? () => { checkCurrent?.(); Reflect.apply(setData, source, [nextData]); } : undefined;
      }
      if (!sameData(previousData, previousData) || !sameData(nextData, nextData) ||
        !geoJsonData(previousData) || !geoJsonData(nextData) ||
        !sameMetadata(before, after, new Set(['data'])) || sameData(before.get('data'), after.get('data'))) return undefined;
      const setData = method(source, 'setData');
      return setData ? () => { checkCurrent?.(); Reflect.apply(setData, source, [after.get('data')]); } : undefined;
    }
    if (type !== 'image' && type !== 'canvas') return undefined;
    const coordinates = after.get('coordinates');
    if (!validCoordinates(before.get('coordinates')) || !validCoordinates(coordinates)) return undefined;
    const moved = !sameData(before.get('coordinates'), coordinates);
    if (type === 'image') {
      if (!sameMetadata(before, after, new Set(['url', 'coordinates']))) return undefined;
      const url = after.get('url');
      if (typeof before.get('url') !== 'string' || typeof url !== 'string') return undefined;
      if (before.get('url') !== url) {
        const updateImage = method(source, 'updateImage');
        return updateImage ? () => { checkCurrent?.(); Reflect.apply(updateImage, source, [{ url, coordinates }]); } : undefined;
      }
      if (!moved) return undefined;
      const setCoordinates = method(source, 'setCoordinates');
      return setCoordinates ? () => { checkCurrent?.(); Reflect.apply(setCoordinates, source, [coordinates]); } : undefined;
    }
    if (!sameMetadata(before, after, new Set(['canvas', 'coordinates', 'animate'])) ||
      before.get('canvas') !== after.get('canvas') || !nativeCanvas(after.get('canvas'))) return undefined;
    if ((before.has('animate') && typeof before.get('animate') !== 'boolean') ||
      (after.has('animate') && typeof after.get('animate') !== 'boolean')) return undefined;
    const wasAnimating = before.get('animate') !== false; const animate = after.get('animate') !== false;
    const animationChanged = wasAnimating !== animate;
    if (!moved && !animationChanged) return undefined;
    const setCoordinates = moved ? method(source, 'setCoordinates') : undefined;
    const setAnimation = animationChanged ? method(source, animate ? 'play' : 'pause') : undefined;
    if ((moved && !setCoordinates) || (animationChanged && !setAnimation)) return undefined;
    return () => {
      if (setCoordinates) { checkCurrent?.(); Reflect.apply(setCoordinates, source, [coordinates]); }
      if (setAnimation) { checkCurrent?.(); Reflect.apply(setAnimation, source, []); }
    };
  } catch { return undefined; }
}
