import {
  getOwnDataDescriptor,
  isPlainDataRecord,
  MISSING_OWN_DATA_DESCRIPTOR,
  readOwnArrayLength,
  UNSAFE_OWN_DATA_DESCRIPTOR,
} from '../../../internal/data-descriptors.js';

export type SceneRequest = Readonly<{ connection: object; revision: number }>;
export type SceneSourceRole = 'candidate' | 'accepted' | 'installed';
export type SceneSourceFormat = 'gltf' | 'glb' | 'stl' | 'obj' | 'ply' | 'xyz' | 'pcd';
export type SceneSourceValue =
  | Readonly<{ format: SceneSourceFormat; bytes: ArrayBuffer | Uint8Array }>
  | Readonly<{ format: SceneSourceFormat; src: string }>;

export interface SceneByteReservation { release(): void }
/** A request already validated by the owning realm's URL adapter. */
export interface SceneResolvedRequest {
  readonly url: string;
  readonly owner: object;
}
export interface SceneSourceReceipt {
  readonly sourceId: number;
  readonly format: SceneSourceFormat;
}
export interface SceneSourceLease {
  readonly receipt: SceneSourceReceipt;
  release(): void;
}
export interface SceneSourceStage {
  readonly receipts: readonly SceneSourceReceipt[];
  dispose(): void;
}
export type SceneSourceSnapshot =
  | Readonly<{ kind: 'bytes'; format: SceneSourceFormat; bytes: Uint8Array }>
  | Readonly<{ kind: 'url'; format: SceneSourceFormat; request: SceneResolvedRequest }>;
export interface SceneSourceOwner {
  stage(values: readonly SceneSourceValue[], request: SceneRequest): SceneSourceStage;
  publish(stage: SceneSourceStage): readonly SceneSourceLease[];
  retain(receipt: SceneSourceReceipt, role: 'candidate' | 'installed'): SceneSourceLease;
  /** Internal borrowed view; the receiver must not mutate the owned bytes. */
  snapshot(receipt: SceneSourceReceipt): SceneSourceSnapshot;
  sealCurrent(): void;
  dispose(): void;
}
export interface SceneSourceOwnerOptions {
  readonly connection: object;
  /** The authoritative result must reflect synchronous reentry and external request changes before returning. */
  readonly isCurrent: (request: SceneRequest) => boolean;
  readonly reserveBytes: (byteLength: number) => SceneByteReservation;
  readonly resolveUrl: (source: string) => SceneResolvedRequest | null;
  readonly maxEncodedBytes: number;
}

type SourceMetadata =
  | Readonly<{ record: SceneSourceValue; kind: 'bytes'; format: SceneSourceFormat; bytes: object }>
  | Readonly<{ record: SceneSourceValue; kind: 'url'; format: SceneSourceFormat; src: string }>;
interface ByteRange {
  readonly buffer: ArrayBuffer;
  readonly byteOffset: number;
  readonly byteLength: number;
}
interface SourceEntry {
  metadata: SourceMetadata | undefined;
  readonly receipt: SceneSourceReceipt;
  readonly byteLength: number;
  retire: (() => void) | undefined;
  snapshot: SceneSourceSnapshot | undefined;
  candidate: number;
  accepted: number;
  installed: number;
  published: boolean;
  sealed: boolean;
}
interface StageState {
  readonly request: SceneRequest;
  readonly entries: readonly SourceEntry[];
  status: 'staged' | 'published' | 'disposed';
}

const SOURCE_FORMATS: readonly SceneSourceFormat[] = ['gltf', 'glb', 'stl', 'obj', 'ply', 'xyz', 'pcd'];
const MAX_STAGE_SOURCES = 32;
const staleErrors = new WeakSet<object>();

function invalid(): never {
  throw new TypeError('Invalid map scene source');
}

function stale(): never {
  const error = new TypeError('Stale map scene source');
  staleErrors.add(error);
  throw error;
}

/** Distinguish a cancelled publication from an invalid or fabricated source handle. */
export function isStaleMapSceneSourceError(error: unknown): boolean {
  return objectValue(error) && staleErrors.has(error);
}

function objectValue(value: unknown): value is object {
  return value !== null && (typeof value === 'object' || typeof value === 'function');
}

function field(value: object, key: PropertyKey): unknown {
  const descriptor = getOwnDataDescriptor(value, key);
  if (descriptor === MISSING_OWN_DATA_DESCRIPTOR || descriptor === UNSAFE_OWN_DATA_DESCRIPTOR) return invalid();
  return descriptor.value;
}

function metadata(value: unknown): SourceMetadata {
  if (!isPlainDataRecord(value)) return invalid();
  const keys = Reflect.ownKeys(value);
  if (keys.length !== 2 || !keys.includes('format')) return invalid();
  const format = field(value, 'format');
  if (typeof format !== 'string' || !SOURCE_FORMATS.includes(format as SceneSourceFormat)) return invalid();
  if (keys.includes('bytes')) {
    const bytes = field(value, 'bytes');
    if (!objectValue(bytes)) return invalid();
    return { record: value as SceneSourceValue, kind: 'bytes', format: format as SceneSourceFormat, bytes };
  }
  if (keys.includes('src')) {
    const src = field(value, 'src');
    if (typeof src !== 'string' || src.trim().length === 0) return invalid();
    return { record: value as SceneSourceValue, kind: 'url', format: format as SceneSourceFormat, src };
  }
  return invalid();
}

/** Validate source metadata without inspecting an already retained byte container. */
export function readMapSceneSource(value: unknown): SceneSourceValue {
  try { return metadata(value).record; } catch { return invalid(); }
}

function sameMetadata(first: SourceMetadata, second: SourceMetadata): boolean {
  return first.record === second.record && first.format === second.format &&
    (first.kind === 'bytes' && second.kind === 'bytes' ? first.bytes === second.bytes :
      first.kind === 'url' && second.kind === 'url' && first.src === second.src);
}

function intrinsicGetter(prototype: object, name: PropertyKey): ((value: unknown) => unknown) | undefined {
  const get = Object.getOwnPropertyDescriptor(prototype, name)?.get;
  return get ? (value: unknown) => Reflect.apply(get, value, []) as unknown : undefined;
}

const arrayBufferLength = intrinsicGetter(ArrayBuffer.prototype, 'byteLength')!;
const arrayBufferResizable = intrinsicGetter(ArrayBuffer.prototype, 'resizable');
const typedArrayPrototype = Object.getPrototypeOf(Uint8Array.prototype) as object;
const typedArrayKind = intrinsicGetter(typedArrayPrototype, Symbol.toStringTag)!;
const typedArrayBuffer = intrinsicGetter(typedArrayPrototype, 'buffer')!;
const typedArrayOffset = intrinsicGetter(typedArrayPrototype, 'byteOffset')!;
const typedArrayLength = intrinsicGetter(typedArrayPrototype, 'byteLength')!;

/** Native slot reads exclude proxies, shared backing and caller-defined getters. */
function byteRange(value: object): ByteRange {
  let buffer: unknown = value;
  let byteOffset = 0;
  let byteLength: unknown;
  if (ArrayBuffer.isView(value)) {
    if (typedArrayKind(value) !== 'Uint8Array') return invalid();
    buffer = typedArrayBuffer(value);
    byteOffset = typedArrayOffset(value) as number;
    byteLength = typedArrayLength(value);
  }
  const bufferLength = arrayBufferLength(buffer);
  if (arrayBufferResizable?.(buffer) === true) return invalid();
  if (byteLength === undefined) byteLength = bufferLength;
  if (typeof byteLength !== 'number' || !Number.isSafeInteger(byteLength) || byteLength < 0 ||
      !Number.isSafeInteger(byteOffset) || byteOffset < 0) return invalid();
  // A detached buffer also reports zero length; constructing a native view distinguishes it.
  new Uint8Array(buffer as ArrayBuffer, byteOffset, byteLength);
  return { buffer: buffer as ArrayBuffer, byteOffset, byteLength };
}

function requestSnapshot(value: SceneRequest, connection: object): SceneRequest {
  if (!isPlainDataRecord(value)) return invalid();
  const actualConnection = field(value, 'connection');
  const revision = field(value, 'revision');
  if (actualConnection !== connection || typeof revision !== 'number' ||
      !Number.isSafeInteger(revision) || revision < 1) return invalid();
  return Object.freeze({ connection, revision });
}

function resolvedRequest(value: SceneResolvedRequest | null): SceneResolvedRequest {
  if (!isPlainDataRecord(value)) return invalid();
  const url = field(value, 'url');
  const owner = field(value, 'owner');
  if (typeof url !== 'string' || url.length === 0 || !objectValue(owner)) return invalid();
  return Object.freeze({ url, owner });
}

function references(entry: SourceEntry): number {
  return entry.candidate + entry.accepted + entry.installed;
}

/** Own source snapshots independently of accepted intent and installed rendering. */
export function createMapSceneSourceOwner(options: SceneSourceOwnerOptions): SceneSourceOwner {
  const { connection, isCurrent, reserveBytes, resolveUrl, maxEncodedBytes } = options;
  if (!objectValue(connection) || typeof isCurrent !== 'function' || typeof reserveBytes !== 'function' ||
      typeof resolveUrl !== 'function' || !Number.isSafeInteger(maxEncodedBytes) || maxEncodedBytes < 0) return invalid();

  const entries = new Set<SourceEntry>();
  const receipts = new WeakMap<SceneSourceReceipt, SourceEntry>();
  const reusable = new WeakMap<SceneSourceValue, SourceEntry>();
  const stages = new WeakMap<SceneSourceStage, StageState>();
  const pendingStages = new Set<StageState>();
  let closed = false;
  let generation = 0;
  let latestRequestRevision = 0;
  let nextSourceId = 1;
  let liveBytes = 0;

  function checkCurrent(request: SceneRequest, expectedGeneration: number): void {
    if (closed || generation !== expectedGeneration || request.revision < latestRequestRevision) return stale();
    const current = isCurrent(request);
    if (!current || closed || generation !== expectedGeneration || request.revision < latestRequestRevision) return stale();
  }

  function retire(entry: SourceEntry): void {
    if (references(entry) !== 0 || entry.snapshot === undefined) return;
    const meta = entry.metadata;
    const retireBytes = entry.retire;
    entry.sealed = true;
    entry.snapshot = undefined;
    entry.metadata = undefined;
    entry.retire = undefined;
    entries.delete(entry);
    if (meta && reusable.get(meta.record) === entry) reusable.delete(meta.record);
    liveBytes -= entry.byteLength;
    try { retireBytes?.(); } catch { /* Independent ownership retirement must continue. */ }
  }

  function release(entry: SourceEntry, role: SceneSourceRole): void {
    entry[role]--;
    retire(entry);
  }

  function lease(entry: SourceEntry, role: SceneSourceRole): SceneSourceLease {
    let released = false;
    return Object.freeze({ receipt: entry.receipt, release() {
      if (released) return;
      released = true;
      release(entry, role);
    } });
  }

  function disposeStage(state: StageState): void {
    if (state.status !== 'staged') return;
    state.status = 'disposed';
    pendingStages.delete(state);
    for (const entry of state.entries) release(entry, 'candidate');
  }

  function addEntry(meta: SourceMetadata, snapshot: SceneSourceSnapshot, byteLength: number, retireBytes?: () => void): SourceEntry {
    if (!Number.isSafeInteger(nextSourceId)) return invalid();
    const receipt = Object.freeze({ sourceId: nextSourceId++, format: meta.format });
    const entry: SourceEntry = { metadata: meta, receipt, byteLength, retire: retireBytes, snapshot,
      candidate: 1, accepted: 0, installed: 0, published: false, sealed: false };
    entries.add(entry);
    receipts.set(receipt, entry);
    return entry;
  }

  function newEntry(meta: SourceMetadata, request: SceneRequest, expectedGeneration: number): SourceEntry {
    if (meta.kind === 'url') {
      const resolved = resolveUrl(meta.src);
      checkCurrent(request, expectedGeneration);
      const snapshot = Object.freeze({ kind: 'url' as const, format: meta.format, request: resolvedRequest(resolved) });
      if (!sameMetadata(meta, metadata(meta.record))) return invalid();
      checkCurrent(request, expectedGeneration);
      return addEntry(meta, snapshot, 0);
    }

    const range = byteRange(meta.bytes);
    if (range.byteLength > maxEncodedBytes - liveBytes) return invalid();
    // Charge the in-flight reservation before calling the host: it may stage another scene.
    liveBytes += range.byteLength;
    let reservation: SceneByteReservation | undefined;
    let owned = false;
    try {
      reservation = reserveBytes(range.byteLength);
      checkCurrent(request, expectedGeneration);
      if (!sameMetadata(meta, metadata(meta.record))) return invalid();
      const bytes = new Uint8Array(range.byteLength);
      bytes.set(new Uint8Array(range.buffer, range.byteOffset, range.byteLength));
      checkCurrent(request, expectedGeneration);
      const reservationOwner = reservation;
      const entry = addEntry(meta, Object.freeze({ kind: 'bytes' as const, format: meta.format, bytes }),
        range.byteLength, () => reservationOwner.release());
      owned = true;
      return entry;
    } finally {
      if (!owned) {
        liveBytes -= range.byteLength;
        try { reservation?.release(); } catch { /* A failed reservation cannot retain staged ownership. */ }
      }
    }
  }

  function stage(values: readonly SceneSourceValue[], value: SceneRequest): SceneSourceStage {
    const acquired: SourceEntry[] = [];
    try {
      const request = requestSnapshot(value, connection);
      checkCurrent(request, generation);
      if (request.revision > latestRequestRevision) {
        latestRequestRevision = request.revision;
        generation++;
      }
      const expectedGeneration = generation;
      if (!Array.isArray(values)) return invalid();
      const length = readOwnArrayLength(values);
      if (length === undefined || length > MAX_STAGE_SOURCES) return invalid();
      if (Reflect.ownKeys(values).length !== length + 1) return invalid();
      const descriptors: SourceMetadata[] = [];
      const seen = new Set<SceneSourceValue>();
      for (let index = 0; index < length; index++) {
        const meta = metadata(field(values, String(index)));
        if (!seen.has(meta.record)) { seen.add(meta.record); descriptors.push(meta); }
      }
      for (const meta of descriptors) {
        checkCurrent(request, expectedGeneration);
        const existing = reusable.get(meta.record);
        if (existing) {
          if (existing.sealed || existing.snapshot === undefined || !existing.metadata ||
              !sameMetadata(existing.metadata, meta)) return invalid();
          existing.candidate++;
          acquired.push(existing);
        } else acquired.push(newEntry(meta, request, expectedGeneration));
      }
      for (const meta of descriptors) if (!sameMetadata(meta, metadata(meta.record))) return invalid();
      checkCurrent(request, expectedGeneration);
      const state: StageState = { request, entries: acquired, status: 'staged' };
      const result: SceneSourceStage = Object.freeze({ receipts: Object.freeze(acquired.map(entry => entry.receipt)),
        dispose() { disposeStage(state); } });
      stages.set(result, state);
      pendingStages.add(state);
      return result;
    } catch {
      for (const entry of acquired) release(entry, 'candidate');
      return invalid();
    }
  }

  function publish(stage: SceneSourceStage): readonly SceneSourceLease[] {
    const state = stages.get(stage);
    if (!state || state.status !== 'staged') return invalid();
    try {
      const expectedGeneration = generation;
      checkCurrent(state.request, expectedGeneration);
      if (state.status !== 'staged') return invalid();
      for (const entry of state.entries) {
        if (!entry.metadata) return invalid();
        const current = reusable.get(entry.metadata.record);
        if (entry.sealed || entry.snapshot === undefined || (current !== undefined && current !== entry)) return invalid();
      }
      const result = Object.freeze(state.entries.map(entry => lease(entry, 'accepted')));
      // No host callbacks occur during this ownership transfer and cache publication.
      generation++;
      state.status = 'published';
      pendingStages.delete(state);
      for (const entry of state.entries) {
        entry.accepted++;
        entry.candidate--;
        entry.published = true;
        reusable.set(entry.metadata!.record, entry);
      }
      return result;
    } catch (error) {
      if (isStaleMapSceneSourceError(error)) throw error;
      return invalid();
    }
  }

  function sealCurrent(): void {
    generation++;
    for (const entry of entries) {
      entry.sealed = true;
      if (entry.metadata) reusable.delete(entry.metadata.record);
    }
  }

  return Object.freeze({ stage, publish,
    retain(receipt: SceneSourceReceipt, role: 'candidate' | 'installed'): SceneSourceLease {
      const entry = receipts.get(receipt);
      if (closed || !entry || entry.sealed || !entry.published || entry.snapshot === undefined ||
          (role !== 'candidate' && role !== 'installed')) return invalid();
      entry[role]++;
      return lease(entry, role);
    },
    snapshot(receipt: SceneSourceReceipt): SceneSourceSnapshot {
      const entry = receipts.get(receipt);
      if (!entry || entry.snapshot === undefined) return invalid();
      return entry.snapshot;
    },
    sealCurrent,
    dispose() {
      if (closed) return;
      closed = true;
      sealCurrent();
      for (const state of [...pendingStages]) disposeStage(state);
    },
  });
}
