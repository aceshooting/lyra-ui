import { getOwnDataDescriptor, isPlainDataRecord, MISSING_OWN_DATA_DESCRIPTOR, readOwnArrayLength, UNSAFE_OWN_DATA_DESCRIPTOR } from '../../../internal/data-descriptors.js';
import { projectMapInteractionOptions, type LyraMapInteractionOptions } from './map-interaction-options.js';

/** A detached native source descriptor. A canvas source retains its canvas identity, and a
 * `geojson` source retains a `Feature`/`FeatureCollection` `data` object by identity. */
export interface LyraMapOverlaySource {
  readonly id: string;
  readonly source: Readonly<Record<string, unknown>>;
}
export interface LyraMapOverlayLayer extends LyraMapInteractionOptions {
  readonly layer: Readonly<Record<string, unknown>> & { readonly id: string; readonly type: string };
  readonly before?: string;
}
export interface MapOwnedOverlaySnapshot {
  readonly sources: readonly LyraMapOverlaySource[];
  readonly layers: readonly LyraMapOverlayLayer[];
}
export type MapOverlayAdmission = { readonly ok: true; readonly overlays: MapOwnedOverlaySnapshot } |
  { readonly ok: false; readonly code: 'invalid-input' | 'limit' | 'duplicate-id' };
const LIMITS = Object.freeze({ sources: 128, layers: 128, values: 50_000, depth: 24, entries: 10_000,
  text: 1_048_576, id: 128 });
class AdmissionFailure extends Error {
  constructor(readonly code: 'invalid-input' | 'limit' | 'duplicate-id') { super(code); }
}
const reject = (code: AdmissionFailure['code']): never => { throw new AdmissionFailure(code); };
function own(input: object, key: string): unknown {
  const descriptor = getOwnDataDescriptor(input, key);
  if (descriptor === UNSAFE_OWN_DATA_DESCRIPTOR) return reject('invalid-input');
  return descriptor === MISSING_OWN_DATA_DESCRIPTOR ? undefined : descriptor.value;
}
function identifier(input: unknown): string {
  if (typeof input !== 'string' || !input.trim() || input.trim().length > LIMITS.id) return reject('invalid-input');
  const id = input.trim();
  if (id === '__proto__' || id === 'prototype' || id === 'constructor') return reject('invalid-input');
  return id;
}
function canvas(input: unknown): input is HTMLCanvasElement {
  if (typeof HTMLCanvasElement === 'undefined') return false;
  try {
    // A native getter checks Web-IDL slots across realms without reading caller-owned properties.
    const read = Object.getOwnPropertyDescriptor(HTMLCanvasElement.prototype, 'width')?.get;
    return typeof read?.call(input) === 'number';
  } catch { return false; }
}
/** GeoJSON `data` objects this module admitted by identity, without a deep copy. */
const identityGeoJson = new WeakSet<object>();
/** Whether `value` is GeoJSON source data admitted by identity (a validated envelope). */
export function isIdentityGeoJsonData(value: unknown): boolean {
  return typeof value === 'object' && value !== null && identityGeoJson.has(value);
}
/**
 * A `Feature` or `FeatureCollection` envelope, read through own data descriptors only. Its contents
 * are the engine's to validate, exactly as for `dataLayers` GeoJSON; they are neither walked nor
 * copied, so their size is bounded by the engine and not by the overlay value budget.
 */
function geoJsonEnvelope(value: unknown): value is object {
  if (!isPlainDataRecord(value)) return false;
  const type = own(value, 'type');
  if (type === 'Feature') {
    const geometry = own(value, 'geometry');
    return geometry === null || isPlainDataRecord(geometry);
  }
  if (type !== 'FeatureCollection') return false;
  const features = own(value, 'features');
  return plainArray(features) && readOwnArrayLength(features) !== undefined;
}
function plainArray(input: unknown): input is unknown[] {
  if (!Array.isArray(input)) return false;
  const prototype = Object.getPrototypeOf(input) as object | null;
  if (!prototype) return false;
  const constructor = Object.getOwnPropertyDescriptor(prototype, 'constructor');
  return Boolean(constructor && Object.hasOwn(constructor, 'value') && typeof constructor.value === 'function' &&
    Function.prototype.toString.call(constructor.value) === Function.prototype.toString.call(Array));
}

/**
 * Snapshot bounded plain native descriptors without executing accessors. Unknown native source and
 * layer options remain data for the selected engine's validation; no callbacks/custom-layer code
 * are admitted. Provider URLs use that engine's transport contract, not the image-fetch pipeline.
 * GeoJSON `Feature`/`FeatureCollection` data is retained by identity outside the value budget.
 */
export function admitMapOverlays(input: unknown): MapOverlayAdmission {
  try {
    if (!isPlainDataRecord(input) || Object.keys(input).some(key => key !== 'sources' && key !== 'layers')) return reject('invalid-input');
    let values = 0; let text = 0;
    const visiting = new WeakSet<object>();
    const clone = (value: unknown, depth: number, preserveCanvas = false): unknown => {
      if (++values > LIMITS.values || depth > LIMITS.depth) return reject('limit');
      if (preserveCanvas) return canvas(value) ? value : reject('invalid-input');
      if (value === null || typeof value === 'boolean') return value;
      if (typeof value === 'string') { text += value.length; if (text > LIMITS.text) return reject('limit'); return value; }
      if (typeof value === 'number') return Number.isFinite(value) ? value : reject('invalid-input');
      if (typeof value !== 'object' || visiting.has(value)) return reject('invalid-input');
      visiting.add(value);
      try {
        if (plainArray(value)) {
          const length = readOwnArrayLength(value);
          if (length === undefined) return reject('invalid-input');
          if (length > LIMITS.entries) return reject('limit');
          const copied: unknown[] = [];
          for (let index = 0; index < length; index += 1) copied.push(clone(own(value, String(index)), depth + 1));
          return Object.freeze(copied);
        }
        if (!isPlainDataRecord(value)) return reject('invalid-input');
        const copied: Record<string, unknown> = {};
        const keys = Object.keys(value);
        if (keys.length > LIMITS.entries) return reject('limit');
        for (const key of keys) {
          if (key === '__proto__' || key === 'prototype' || key === 'constructor') return reject('invalid-input');
          text += key.length; if (text > LIMITS.text) return reject('limit');
          copied[key] = clone(own(value, key), depth + 1);
        }
        return Object.freeze(copied);
      } finally { visiting.delete(value); }
    };
    const rows = (value: unknown, max: number): readonly unknown[] => {
      if (value === undefined) return [];
      if (!plainArray(value)) return reject('invalid-input');
      const length = readOwnArrayLength(value);
      if (length === undefined) return reject('invalid-input');
      if (length > max) return reject('limit');
      const output: unknown[] = [];
      for (let index = 0; index < length; index += 1) output.push(own(value, String(index)));
      return output;
    };
    const sourceIds = new Set<string>();
    const sources: LyraMapOverlaySource[] = [];
    for (const row of rows(own(input, 'sources'), LIMITS.sources)) {
      if (!isPlainDataRecord(row) || Object.keys(row).some(key => key !== 'id' && key !== 'source')) return reject('invalid-input');
      const id = identifier(own(row, 'id')); const source = own(row, 'source');
      if (sourceIds.has(id)) return reject('duplicate-id');
      if (!isPlainDataRecord(source)) return reject('invalid-input');
      const type = own(source, 'type');
      if (typeof type !== 'string' || !/^[a-z][a-z0-9-]{0,63}$/u.test(type)) return reject('invalid-input');
      let snapshot: Readonly<Record<string, unknown>>;
      if (type === 'canvas') {
        const output: Record<string, unknown> = {};
        const keys = Object.keys(source);
        if (keys.length > LIMITS.entries) return reject('limit');
        for (const key of keys) {
          if (key === '__proto__' || key === 'prototype' || key === 'constructor') return reject('invalid-input');
          text += key.length; if (text > LIMITS.text) return reject('limit');
          output[key] = clone(own(source, key), 1, key === 'canvas');
        }
        if (!Object.hasOwn(output, 'canvas')) return reject('invalid-input');
        snapshot = Object.freeze({ ...output, type });
      } else if (type === 'geojson' && geoJsonEnvelope(own(source, 'data'))) {
        // Large GeoJSON keeps its identity: the rest of the descriptor is snapshotted as usual.
        const data = own(source, 'data') as object;
        const output: Record<string, unknown> = {};
        const keys = Object.keys(source);
        if (keys.length > LIMITS.entries) return reject('limit');
        for (const key of keys) {
          if (key === '__proto__' || key === 'prototype' || key === 'constructor') return reject('invalid-input');
          text += key.length; if (text > LIMITS.text) return reject('limit');
          if (key !== 'data') output[key] = clone(own(source, key), 1);
        }
        identityGeoJson.add(data);
        snapshot = Object.freeze({ ...output, data, type });
      } else snapshot = Object.freeze({ ...clone(source, 0) as Readonly<Record<string, unknown>>, type });
      sourceIds.add(id); sources.push(Object.freeze({ id, source: snapshot }));
    }
    const layerIds = new Set<string>();
    const layers: LyraMapOverlayLayer[] = [];
    for (const row of rows(own(input, 'layers'), LIMITS.layers)) {
      if (!isPlainDataRecord(row) || Object.keys(row).some(key => key !== 'layer' && key !== 'before' && key !== 'interactive' && key !== 'priority')) return reject('invalid-input');
      const layer = own(row, 'layer');
      if (!isPlainDataRecord(layer)) return reject('invalid-input');
      const id = identifier(own(layer, 'id')); const type = own(layer, 'type');
      if (layerIds.has(id)) return reject('duplicate-id');
      if (typeof type !== 'string' || !/^[a-z][a-z0-9-]{0,63}$/u.test(type)) return reject('invalid-input');
      const source = own(layer, 'source');
      const before = own(row, 'before');
      const snapshot = { ...clone(layer, 0) as Readonly<Record<string, unknown>>, id, type,
        ...(source === undefined ? {} : { source: identifier(source) }) };
      layerIds.add(id);
      layers.push(Object.freeze({ ...projectMapInteractionOptions(row), layer: Object.freeze(snapshot), ...(before === undefined ? {} : { before: identifier(before) }) }));
    }
    return Object.freeze({ ok: true, overlays: Object.freeze({ sources: Object.freeze(sources), layers: Object.freeze(layers) }) });
  } catch (error) {
    return Object.freeze({ ok: false, code: error instanceof AdmissionFailure ? error.code : 'invalid-input' });
  }
}
