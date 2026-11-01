import {
  getOwnDataDescriptor,
  isPlainDataRecord,
  MISSING_OWN_DATA_DESCRIPTOR,
  UNSAFE_OWN_DATA_DESCRIPTOR,
} from '../../../internal/data-descriptors.js';
import type { LyraMapFeatureRequirements } from './map-loader.js';
import { safeValue, type LyraMapStyleValue } from './map-style-value.js';

/** Declarative shorthand projection override. */
export type LyraMapProjection = 'mercator' | 'globe';
/** A current-style raster elevation source and its nonnegative vertical scale. */
export interface LyraMapTerrain {
  readonly source: string;
  readonly exaggeration?: number;
}
/** Complete detached native projection specification, retained for replay. */
export type LyraMapSceneProjection = { readonly [key: string]: LyraMapStyleValue };
export interface LyraMapSceneBaseline {
  readonly projection: LyraMapSceneProjection;
  readonly terrain: LyraMapTerrain | null;
}

export function normalizeMapProjection(value: unknown): LyraMapProjection | undefined {
  return value === 'mercator' || value === 'globe' ? value : undefined;
}

function own(record: object, key: string): unknown {
  const descriptor = getOwnDataDescriptor(record, key);
  if (descriptor === UNSAFE_OWN_DATA_DESCRIPTOR) throw new TypeError('Invalid map scene descriptor');
  return descriptor === MISSING_OWN_DATA_DESCRIPTOR ? undefined : descriptor.value;
}

/** Admit a detached bounded terrain value without executing caller accessors. */
export function admitMapTerrain(input: unknown): LyraMapTerrain | null | undefined {
  if (input === undefined || input === null) return input;
  if (!isPlainDataRecord(input)) throw new TypeError('Invalid map terrain');
  const source = own(input, 'source');
  const scale = own(input, 'exaggeration');
  if (typeof source !== 'string' || source.trim().length === 0 || source.length > 4096 ||
    (scale !== undefined && (typeof scale !== 'number' || !Number.isFinite(scale) || scale < 0))) {
    throw new TypeError('Invalid map terrain');
  }
  return Object.freeze({ source, exaggeration: scale === undefined ? 1 : scale as number });
}

/** Snapshot complete replay data independently of modular preparation requirements. */
export function snapshotMapSceneBaseline(projection: unknown, terrain: unknown): LyraMapSceneBaseline {
  const input = projection === undefined ? { type: 'mercator' } : projection;
  const snapshot = safeValue(input)?.value;
  if (!isPlainDataRecord(snapshot)) throw new TypeError('Invalid map projection');
  const type = own(snapshot, 'type');
  if ((typeof type !== 'string' || type.length === 0) && !Array.isArray(type)) {
    throw new TypeError('Invalid map projection');
  }
  if (Array.isArray(type) && type.length === 0) throw new TypeError('Invalid map projection');
  return Object.freeze({ projection: snapshot as LyraMapSceneProjection, terrain: admitMapTerrain(terrain) ?? null });
}

/** Validate only the named source; unrelated catalog entries are never traversed. */
function terrainSource(style: unknown, source: string): Readonly<Record<string, unknown>> {
  if (!isPlainDataRecord(style)) throw new TypeError('Invalid current map style');
  const sources = own(style, 'sources');
  if (!isPlainDataRecord(sources)) throw new TypeError('Invalid map terrain source');
  const descriptor = own(sources, source);
  if (!isPlainDataRecord(descriptor) || own(descriptor, 'type') !== 'raster-dem') {
    throw new TypeError('Invalid map terrain source');
  }
  const result = Object.create(null) as Record<string, unknown>;
  Object.defineProperty(result, source, { value: Object.freeze({ type: 'raster-dem' }), enumerable: true });
  return Object.freeze(result);
}

/** Reduced activation metadata; never pass this object to the native projection setter. */
export function mapScenePreparation(
  projection: LyraMapSceneProjection | undefined,
  terrain: LyraMapTerrain | null | undefined,
  style: unknown,
): LyraMapFeatureRequirements {
  let projectionMetadata: Readonly<{ type: string }> | undefined;
  if (projection !== undefined) {
    const type = own(projection, 'type');
    if (typeof type === 'string' && type !== 'mercator' && type !== 'globe') throw new TypeError('Unsupported map projection');
    if (typeof type !== 'string' && !Array.isArray(type)) throw new TypeError('Invalid map projection');
    projectionMetadata = Object.freeze({ type: type === 'mercator' ? 'mercator' : 'globe' });
  }
  return Object.freeze({ ...(projectionMetadata === undefined ? {} : { projection: projectionMetadata }),
    ...(terrain === undefined ? {} : { terrain: terrain !== null }),
    ...(terrain == null ? {} : { sources: terrainSource(style, terrain.source) }) });
}

/** Compare admitted plain data independent of record insertion order. */
export function mapSceneValueEqual(first: unknown, second: unknown): boolean {
  if (first === second) return true;
  if (Array.isArray(first) || Array.isArray(second)) {
    return Array.isArray(first) && Array.isArray(second) && first.length === second.length &&
      first.every((value, index) => mapSceneValueEqual(value, second[index]));
  }
  if (!isPlainDataRecord(first) || !isPlainDataRecord(second)) return false;
  const keys = Object.keys(first);
  return keys.length === Object.keys(second).length && keys.every((key) =>
    Object.hasOwn(second, key) && mapSceneValueEqual(own(first, key), own(second, key)));
}
