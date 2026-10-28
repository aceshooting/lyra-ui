import { finiteTuple, invalidPlacement, normalizeOrientation, ownData } from './model-placement.js';
import type { AdmittedSceneModel } from './types.js';

const formats = new Set(['gltf', 'glb', 'stl', 'obj', 'ply', 'xyz', 'pcd']);
const typedPrototype = Object.getPrototypeOf(Uint8Array.prototype) as object;
const getter = (prototype: object, key: string) => Object.getOwnPropertyDescriptor(prototype, key)?.get;
const typedBuffer = getter(typedPrototype, 'buffer');
const typedOffset = getter(typedPrototype, 'byteOffset');
const typedLength = getter(typedPrototype, 'byteLength');
const typedTag = Object.getOwnPropertyDescriptor(typedPrototype, Symbol.toStringTag)?.get;
const bufferLength = getter(ArrayBuffer.prototype, 'byteLength');
const resizable = getter(ArrayBuffer.prototype, 'resizable');

function record(value: unknown, allowed: readonly string[]): void {
  if (value === null || typeof value !== 'object') return invalidPlacement();
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return invalidPlacement();
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key !== 'string' || !allowed.includes(key)) return invalidPlacement();
    ownData(value, key);
  }
}
function text(value: unknown): string {
  if (typeof value !== 'string' || !value.trim() || value.length > 1024) return invalidPlacement();
  return value;
}
function boolean(value: unknown, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  if (typeof value !== 'boolean') return invalidPlacement();
  return value;
}
function number(value: unknown, fallback: number, min: number, max: number): number {
  const actual = value === undefined ? fallback : value;
  if (typeof actual !== 'number' || !Number.isFinite(actual) || actual < min || actual > max) return invalidPlacement();
  return actual;
}
function byteView(value: unknown): Uint8Array<ArrayBuffer> {
  if (typedTag?.call(value) !== 'Uint8Array') return invalidPlacement();
  const backing: unknown = typedBuffer?.call(value);
  // The native ArrayBuffer getter rejects shared and non-native backing stores.
  try {
    const size: unknown = bufferLength?.call(backing);
    if (typeof size !== 'number' || resizable?.call(backing)) return invalidPlacement();
    const length: unknown = typedLength?.call(value), offset: unknown = typedOffset?.call(value);
    if (typeof length !== 'number' || typeof offset !== 'number' || length < 1 || length > 64 * 1024 * 1024) return invalidPlacement();
    // Construction checks detached backing even when its reported length is zero.
    return new Uint8Array(backing as ArrayBuffer, offset, length);
  } catch { return invalidPlacement(); }
}

/** Snapshots prepared, byte-only model descriptors without granting URL fetch authority. */
export function snapshotSceneModels(input: unknown): readonly AdmittedSceneModel[] {
  if (!Array.isArray(input)) return invalidPlacement();
  const length = ownData(input, 'length');
  if (typeof length !== 'number' || length > 32) return invalidPlacement();
  const seen = new Set<string>();
  let encodedBytes = 0;
  // Complete descriptor validation precedes byte-copy allocation.
  const staged = Array.from({ length }, (_, index) => {
    const item = ownData(input, String(index));
    record(item, ['id', 'label', 'kind', 'position', 'source', 'metersPerUnit', 'orientation', 'color', 'opacity', 'interactive', 'showLabel']);
    const id = text(ownData(item, 'id')), label = text(ownData(item, 'label'));
    if (seen.has(id) || ownData(item, 'kind') !== 'model') return invalidPlacement();
    seen.add(id);
    const placement = ownData(item, 'position');
    record(placement, ['lngLat', 'altitude', 'altitudeReference']);
    const [longitude = 0, latitude = 0] = finiteTuple(ownData(placement, 'lngLat'), 2);
    if (Math.abs(latitude) > 85.0511287798066) return invalidPlacement();
    const lng = longitude >= -180 && longitude < 180 ? longitude : ((longitude % 360) + 540) % 360 - 180;
    const altitude = number(ownData(placement, 'altitude', true), 0, -12000, 100000000);
    const reference = ownData(placement, 'altitudeReference', true) ?? 'sea-level';
    if (reference !== 'sea-level' && reference !== 'terrain') return invalidPlacement();
    const source = ownData(item, 'source'); record(source, ['format', 'bytes']);
    const format = ownData(source, 'format');
    if (typeof format !== 'string' || !formats.has(format)) return invalidPlacement();
    const bytes = byteView(ownData(source, 'bytes'));
    encodedBytes += bytes.byteLength;
    if (encodedBytes > 64 * 1024 * 1024) return invalidPlacement();
    const metersPerUnit = number(ownData(item, 'metersPerUnit', true), 1, Number.MIN_VALUE, Number.MAX_VALUE);
    const orientation = normalizeOrientation(ownData(item, 'orientation', true));
    const color = ownData(item, 'color', true);
    if (color !== undefined && (typeof color !== 'string' || color.length > 256 || !color.trim())) return invalidPlacement();
    const position: AdmittedSceneModel['position'] = Object.freeze({
      lngLat: Object.freeze([lng, latitude]) as readonly [number, number], altitude, altitudeReference: reference });
    return { id, label, kind: 'model' as const, position,
      source: { format: format as AdmittedSceneModel['source']['format'], bytes }, metersPerUnit, orientation,
      ...(typeof color === 'string' ? { color } : {}),
      opacity: number(ownData(item, 'opacity', true), 1, 0, 1),
      interactive: boolean(ownData(item, 'interactive', true), true), showLabel: boolean(ownData(item, 'showLabel', true), false) };
  });
  return Object.freeze(staged.map(item => Object.freeze({ ...item,
    source: Object.freeze({ format: item.source.format, bytes: new Uint8Array(item.source.bytes) }) })));
}
