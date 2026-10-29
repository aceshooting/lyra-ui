import {
  getOwnDataDescriptor,
  isPlainDataRecord,
  MISSING_OWN_DATA_DESCRIPTOR,
  readOwnArrayLength,
  UNSAFE_OWN_DATA_DESCRIPTOR,
} from '../../../internal/data-descriptors.js';
import type { CanonicalScenePosition } from '../../../internal/map-scene-contract.js';
import { sanitizeCssColor } from '../../../internal/safe-css.js';
import { readMapSceneSource } from './map-scene-source-snapshot.js';
import type {
  SceneRequest,
  SceneSourceOwner,
  SceneSourceReceipt,
  SceneSourceStage,
  SceneSourceValue,
} from './map-scene-source-snapshot.js';

export type { CanonicalScenePosition } from '../../../internal/map-scene-contract.js';

interface AdmittedSceneObjectBase {
  readonly id: string;
  readonly label: string;
  readonly color?: string;
  readonly opacity: number;
  readonly interactive: boolean;
  readonly showLabel: boolean;
}

export interface AdmittedSceneMarker extends AdmittedSceneObjectBase {
  readonly kind: 'marker';
  readonly position: CanonicalScenePosition;
  readonly radius: number;
}

export interface AdmittedScenePath extends AdmittedSceneObjectBase {
  readonly kind: 'path';
  readonly positions: readonly CanonicalScenePosition[];
  readonly interpolation: 'linear' | 'great-circle';
  readonly width: number;
}

export interface AdmittedSceneArc extends AdmittedSceneObjectBase {
  readonly kind: 'arc';
  readonly start: CanonicalScenePosition;
  readonly end: CanonicalScenePosition;
  readonly height: number;
  readonly width: number;
}

export interface AdmittedSceneModel extends AdmittedSceneObjectBase {
  readonly kind: 'model';
  readonly position: CanonicalScenePosition;
  readonly source: SceneSourceReceipt;
  readonly metersPerUnit: number;
  readonly orientation: readonly [number, number, number, number];
}

export type AdmittedSceneObject = AdmittedSceneMarker | AdmittedScenePath | AdmittedSceneArc | AdmittedSceneModel;
type UnstagedSceneObject = Exclude<AdmittedSceneObject, AdmittedSceneModel> |
  (Omit<AdmittedSceneModel, 'source'> & { readonly source: SceneSourceValue });

export interface SceneAdmissionCandidate {
  readonly request: SceneRequest;
  readonly objects: readonly AdmittedSceneObject[];
  readonly sourceStage: SceneSourceStage;
  dispose(): void;
}

interface CandidateState {
  readonly sources: SceneSourceOwner;
  consumed: boolean;
}

const candidates = new WeakMap<SceneAdmissionCandidate, CandidateState>();
const baseFields = ['id', 'label', 'kind', 'color', 'opacity', 'interactive', 'showLabel'];
const latitudeLimit = 85.0511287798066;
const radians = Math.PI / 180;

function invalid(): never {
  throw new TypeError('Invalid map scene descriptor');
}

function own(record: object, key: string): unknown {
  const descriptor = getOwnDataDescriptor(record, key);
  if (descriptor === UNSAFE_OWN_DATA_DESCRIPTOR) invalid();
  return descriptor === MISSING_OWN_DATA_DESCRIPTOR ? undefined : descriptor.value;
}

function record(value: unknown, fields: readonly string[]): Record<string, unknown> {
  if (!isPlainDataRecord(value)) invalid();
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key !== 'string' || !fields.includes(key)) invalid();
    own(value, key);
  }
  return value;
}

/** Copy dense own data without consulting caller iterators or inherited array entries. */
function array(value: unknown, minimum: number, maximum: number): readonly unknown[] {
  if (!Array.isArray(value)) invalid();
  const length = readOwnArrayLength(value);
  if (length === undefined || length < minimum || length > maximum) invalid();
  if (Reflect.ownKeys(value).length !== length + 1) invalid();
  const result: unknown[] = [];
  for (let index = 0; index < length; index++) {
    const descriptor = getOwnDataDescriptor(value, String(index));
    if (descriptor === MISSING_OWN_DATA_DESCRIPTOR || descriptor === UNSAFE_OWN_DATA_DESCRIPTOR) invalid();
    result.push(descriptor.value);
  }
  return result;
}

function number(value: unknown, minimum = -Infinity, maximum = Infinity): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < minimum || value > maximum) invalid();
  return value === 0 ? 0 : value;
}

function positive(value: unknown, fallback: number): number {
  const result = number(value === undefined ? fallback : value, 0);
  if (result === 0) invalid();
  return result;
}

function boolean(value: unknown, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  if (typeof value !== 'boolean') invalid();
  return value;
}

function longitude(value: unknown): number {
  const finite = number(value);
  if (finite >= -180 && finite < 180) return finite;
  const normalized = ((finite % 360) + 540) % 360 - 180;
  return normalized === 0 ? 0 : normalized;
}

function position(value: unknown): CanonicalScenePosition {
  const data = record(value, ['lngLat', 'altitude', 'altitudeReference']);
  const coordinates = array(own(data, 'lngLat'), 2, 2);
  const lngLat: readonly [number, number] = Object.freeze([
    longitude(coordinates[0]), number(coordinates[1], -latitudeLimit, latitudeLimit),
  ]);
  const altitude = own(data, 'altitude');
  const authoredReference = own(data, 'altitudeReference');
  const reference = authoredReference === undefined ? 'sea-level' : authoredReference;
  if (reference !== 'sea-level' && reference !== 'terrain') invalid();
  return Object.freeze({ lngLat, altitude: number(altitude === undefined ? 0 : altitude, -12000, 100000000),
    altitudeReference: reference });
}

function orientation(value: unknown): readonly [number, number, number, number] {
  const entries = value === undefined ? [0, 0, 0, 1] : array(value, 4, 4).map(entry => number(entry));
  const maximum = Math.max(...entries.map(Math.abs));
  if (maximum === 0) invalid();
  const scaled = entries.map(entry => entry / maximum);
  const magnitude = Math.hypot(...scaled);
  const normalized = scaled.map(entry => entry === 0 ? 0 : entry / magnitude);
  return Object.freeze([normalized[0]!, normalized[1]!, normalized[2]!, normalized[3]!]);
}

/** Reject ambiguous ground routes without tessellating or resolving terrain. */
function segment(start: CanonicalScenePosition, end: CanonicalScenePosition): boolean {
  if (start.altitudeReference !== end.altitudeReference) invalid();
  const unit = (point: CanonicalScenePosition): readonly [number, number, number] => {
    const lng = point.lngLat[0] * radians, lat = point.lngLat[1] * radians;
    return [Math.cos(lat) * Math.cos(lng), Math.cos(lat) * Math.sin(lng), Math.sin(lat)];
  };
  const a = unit(start), b = unit(end);
  const sine = Math.hypot(a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]);
  const cosine = a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  if (cosine < 0 && sine < 1e-8) invalid();
  return start.lngLat[0] !== end.lngLat[0] || start.lngLat[1] !== end.lngLat[1];
}

function object(value: unknown): UnstagedSceneObject {
  if (!isPlainDataRecord(value)) invalid();
  const kind = own(value, 'kind');
  let fields: readonly string[];
  switch (kind) {
    case 'marker': fields = ['position', 'radius']; break;
    case 'path': fields = ['positions', 'interpolation', 'width']; break;
    case 'arc': fields = ['start', 'end', 'height', 'width']; break;
    case 'model': fields = ['position', 'source', 'metersPerUnit', 'orientation']; break;
    default: return invalid();
  }
  const data = record(value, [...baseFields, ...fields]);
  const id = own(data, 'id'), label = own(data, 'label');
  if (typeof id !== 'string' || id.length === 0 || id.length > 1024 || id.trim().length === 0 ||
      typeof label !== 'string' || label.trim().length === 0) invalid();
  const authoredColor = own(data, 'color');
  const color = authoredColor === undefined ? undefined : sanitizeCssColor(authoredColor);
  if (authoredColor !== undefined && color === undefined) invalid();
  const opacity = own(data, 'opacity');
  const base: AdmittedSceneObjectBase = {
    id, label, ...(color === undefined ? {} : { color }),
    opacity: number(opacity === undefined ? 1 : opacity, 0, 1),
    interactive: boolean(own(data, 'interactive'), true), showLabel: boolean(own(data, 'showLabel'), false),
  };
  switch (kind) {
    case 'marker': return Object.freeze({ ...base, kind, position: position(own(data, 'position')),
      radius: positive(own(data, 'radius'), 6) });
    case 'path': {
      const positions = Object.freeze(array(own(data, 'positions'), 2, 4096).map(position));
      const authoredInterpolation = own(data, 'interpolation');
      const interpolation = authoredInterpolation === undefined ? 'great-circle' : authoredInterpolation;
      if (interpolation !== 'linear' && interpolation !== 'great-circle') invalid();
      let hasLength = false;
      for (let index = 1; index < positions.length; index++) {
        hasLength = segment(positions[index - 1]!, positions[index]!) || hasLength;
      }
      if (!hasLength) invalid();
      return Object.freeze({ ...base, kind, positions, interpolation, width: positive(own(data, 'width'), 2) });
    }
    case 'arc': {
      const start = position(own(data, 'start')), end = position(own(data, 'end'));
      if (!segment(start, end)) invalid();
      return Object.freeze({ ...base, kind, start, end, height: number(own(data, 'height'), 0),
        width: positive(own(data, 'width'), 2) });
    }
    case 'model': return Object.freeze({ ...base, kind, position: position(own(data, 'position')),
      source: readMapSceneSource(own(data, 'source')), metersPerUnit: positive(own(data, 'metersPerUnit'), 1),
      orientation: orientation(own(data, 'orientation')) });
  }
}

/** The connection identity is opaque; request counters are finite, positive, safe integers. */
export function snapshotMapSceneRequest(value: SceneRequest): SceneRequest {
  try {
    const data = record(value, ['connection', 'revision']);
    const connection = own(data, 'connection'), revision = own(data, 'revision');
    if (connection === null || typeof connection !== 'object' ||
        typeof revision !== 'number' || !Number.isSafeInteger(revision) || revision < 1) invalid();
    return Object.freeze({ connection, revision });
  } catch { return invalid(); }
}

/** Validate the whole descriptor before source allocation, then bind models to owned receipts. */
export function stageMapSceneAdmission(value: unknown, options: {
  readonly request: SceneRequest;
  readonly sources: SceneSourceOwner;
}): SceneAdmissionCandidate {
  let sourceStage: SceneSourceStage | undefined;
  try {
    const request = snapshotMapSceneRequest(options.request);
    const scene = record(value, ['objects']);
    const objects = array(own(scene, 'objects'), 0, 2000).map(object);
    const ids = new Set<string>();
    const sources: SceneSourceValue[] = [];
    const sourceIndices = new Map<SceneSourceValue, number>();
    let models = 0;
    for (const admitted of objects) {
      if (ids.has(admitted.id)) invalid();
      ids.add(admitted.id);
      if (admitted.kind !== 'model') continue;
      if (++models > 32) invalid();
      if (!sourceIndices.has(admitted.source)) {
        sourceIndices.set(admitted.source, sources.length);
        sources.push(admitted.source);
      }
    }
    sourceStage = options.sources.stage(sources, request);
    const stage = sourceStage;
    const admitted: readonly AdmittedSceneObject[] = Object.freeze(objects.map(entry => {
      if (entry.kind !== 'model') return entry;
      const receipt = stage.receipts[sourceIndices.get(entry.source)!];
      if (!receipt) invalid();
      return Object.freeze({ ...entry, source: receipt });
    }));
    const state: CandidateState = { sources: options.sources, consumed: false };
    const candidate: SceneAdmissionCandidate = Object.freeze({ request, objects: admitted, sourceStage: stage,
      dispose() { state.consumed = true; stage.dispose(); } });
    candidates.set(candidate, state);
    return candidate;
  } catch {
    sourceStage?.dispose();
    return invalid();
  }
}

/** Claim an owned candidate before callback-capable commit validation. */
export function consumeMapSceneAdmission(candidate: SceneAdmissionCandidate, sources: SceneSourceOwner, connection: object): void {
  const state = candidates.get(candidate);
  if (!state || state.consumed || state.sources !== sources || candidate.request.connection !== connection) invalid();
  state.consumed = true;
}
