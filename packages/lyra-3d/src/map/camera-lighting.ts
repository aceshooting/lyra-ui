import { Matrix4 } from 'three';

interface LightingInput {
  /** Trusted host provenance; arithmetic cannot authenticate a matrix's projection family. */
  readonly nativeProjectionFamily: 'mercator' | 'mercator-globe';
  readonly transition: number;
  readonly tile: { readonly z: number; readonly x: number; readonly y: number; readonly wrap: number };
  readonly fallbackMatrix: readonly number[] | Float32Array | Float64Array;
  readonly clippingPlane: readonly [number, number, number, number];
  readonly anchor: { readonly lngLat: readonly [number, number]; readonly altitude: number };
}
interface ModelLighting {
  readonly eyeEnu: readonly [number, number, number];
  readonly convention: 'mercator-eye' | 'sphere-eye';
}
const radius = 6371008.8;
const radians = Math.PI / 180;
const fail = (): never => { throw new TypeError('Invalid geographic model camera.'); };
function own(value: unknown, key: PropertyKey): unknown {
  if (!value || typeof value !== 'object') return fail();
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  if (!descriptor || !Object.hasOwn(descriptor, 'value')) return fail();
  return descriptor.value;
}
function finite(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fail();
  return value;
}
function vector(value: unknown, length: number): number[] {
  if (Array.isArray(value)) {
    if (own(value, 'length') !== length) return fail();
    return Array.from({ length }, (_, index) => finite(own(value, String(index))));
  }
  const prototype = Object.getPrototypeOf(Float32Array.prototype) as object;
  const get = (key: PropertyKey) => Object.getOwnPropertyDescriptor(prototype, key)?.get?.call(value) as unknown;
  try {
    const kind = get(Symbol.toStringTag), backing = get('buffer');
    if (kind !== 'Float32Array' && kind !== 'Float64Array') return fail();
    Object.getOwnPropertyDescriptor(ArrayBuffer.prototype, 'byteLength')?.get?.call(backing);
    if (Object.getOwnPropertyDescriptor(ArrayBuffer.prototype, 'resizable')?.get?.call(backing) || get('length') !== length) return fail();
    const offset = finite(get('byteOffset'));
    const view = kind === 'Float32Array' ? new Float32Array(backing as ArrayBuffer, offset, length) : new Float64Array(backing as ArrayBuffer, offset, length);
    return Array.from({ length }, (_, index) => finite(view[index]));
  } catch { return fail(); }
}
function sphere(longitude: number, latitude: number, altitude: number): readonly [number, number, number] {
  const lng = (longitude % 360) * radians, lat = latitude * radians, r = 1 + altitude / radius;
  if (!Number.isFinite(r) || r <= 0) return fail();
  return [Math.sin(lng) * Math.cos(lat) * r, Math.sin(lat) * r, Math.cos(lng) * Math.cos(lat) * r];
}

/** Derives a physical ENU eye from a trusted native perspective tile snapshot; never owns a camera. */
export function deriveModelLighting(input: LightingInput): ModelLighting {
  const family = own(input, 'nativeProjectionFamily'), transition = finite(own(input, 'transition'));
  if ((family !== 'mercator' && family !== 'mercator-globe') || transition < 0 || transition > 1 || (family === 'mercator' && transition !== 0)) return fail();
  const tile = own(input, 'tile');
  const z = finite(own(tile, 'z')), x = finite(own(tile, 'x')), y = finite(own(tile, 'y')), wrap = finite(own(tile, 'wrap'));
  if (![z, x, y, wrap].every(Number.isSafeInteger) || z < 0 || z > 30 || x < 0 || y < 0 || x >= 2 ** z || y >= 2 ** z || Math.abs(wrap) > 1000000) return fail();
  const matrix = vector(own(input, 'fallbackMatrix'), 16), plane = vector(own(input, 'clippingPlane'), 4);
  const anchor = own(input, 'anchor'), lngLat = vector(own(anchor, 'lngLat'), 2);
  const longitude = lngLat[0]!, latitude = lngLat[1]!, altitude = finite(own(anchor, 'altitude'));
  if (Math.abs(latitude) > 85.0511287798066 || altitude < -12000 || altitude > 100000000) return fail();
  let eye: readonly [number, number, number];
  if (transition > 0) {
    const distance = -plane[3]!, normalLength = Math.hypot(plane[0]!, plane[1]!, plane[2]!);
    if (distance <= 0 || Math.abs(normalLength - 1) > 1e-5) return fail();
    eye = [plane[0]! / distance, plane[1]! / distance, plane[2]! / distance];
    if (!eye.every(Number.isFinite) || Math.hypot(...eye) <= 1) return fail();
  } else {
    const forward = new Matrix4().fromArray(matrix), determinant = forward.determinant();
    if (!Number.isFinite(determinant) || determinant === 0) return fail();
    const inverse = forward.clone().invert().elements;
    const w = inverse[11];
    if (!Number.isFinite(w) || w === 0) return fail();
    const tileEye = [inverse[8] / w, inverse[9] / w, inverse[10] / w];
    if (!tileEye.every(Number.isFinite)) return fail();
    const homogeneous = [...tileEye, 1];
    const clip = [0, 1, 2, 3].map(row => homogeneous.reduce((sum, value, column) => sum + matrix[column * 4 + row]! * value, 0));
    if (!clip.every(Number.isFinite) || clip[2] === 0) return fail();
    // This checks inverse consistency only; it cannot establish native CRS provenance or accuracy.
    const scale = Math.max(1, Math.abs(clip[2]!));
    if ([clip[0]!, clip[1]!, clip[3]!].some(value => Math.abs(value) > scale * 1e-7)) return fail();
    const size = 2 ** z;
    const worldX = (x + tileEye[0]! / 8192) / size + wrap;
    const worldY = (y + tileEye[1]! / 8192) / size;
    const inverseY = Math.PI * (1 - 2 * worldY);
    if (![worldX, worldY, inverseY].every(Number.isFinite)) return fail();
    const eyeLatitude = Math.sign(inverseY) * (Math.PI / 2 - 2 * Math.atan(Math.exp(-Math.abs(inverseY))));
    eye = sphere((worldX % 1) * 360 - 180, eyeLatitude / radians, tileEye[2]!);
  }
  const anchorSphere = sphere(longitude, latitude, altitude);
  const delta = eye.map((value, index) => (value - anchorSphere[index]!) * radius);
  const lng = (longitude % 360) * radians, lat = latitude * radians;
  const east = delta[0]! * Math.cos(lng) - delta[2]! * Math.sin(lng);
  const north = -delta[0]! * Math.sin(lng) * Math.sin(lat) + delta[1]! * Math.cos(lat) - delta[2]! * Math.cos(lng) * Math.sin(lat);
  const up = delta[0]! * Math.sin(lng) * Math.cos(lat) + delta[1]! * Math.sin(lat) + delta[2]! * Math.cos(lng) * Math.cos(lat);
  const eyeEnu: readonly [number, number, number] = Object.freeze([east, north, up]);
  if (!eyeEnu.every(Number.isFinite)) return fail();
  return Object.freeze({ eyeEnu, convention: transition > 0 ? 'sphere-eye' : 'mercator-eye' });
}
