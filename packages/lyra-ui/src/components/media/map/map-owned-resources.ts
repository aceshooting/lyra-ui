import { getOwnDataDescriptor, isPlainDataRecord, MISSING_OWN_DATA_DESCRIPTOR, readOwnArrayLength, UNSAFE_OWN_DATA_DESCRIPTOR } from '../../../internal/data-descriptors.js';
import type { LyraMapFeatureRequirements } from './map-loader.js';
import type { PreparedMapImage } from './map-images.js';
import { projectMapInteractionOptions, type LyraMapInteractionOptions } from './map-interaction-options.js';
import { planMapLayerOrder } from './map-layer-order.js';

/** A detached native source descriptor. A canvas source alone may retain its canvas identity. */
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

export interface MapOwnedResourcePeer {
  getSource(id: string): unknown;
  getLayer(id: string): unknown;
  layerIds(): readonly string[];
  addSource(id: string, source: Readonly<Record<string, unknown>>): unknown;
  removeSource(id: string): unknown;
  /** Inspect an admitted source change without mutation; an absent plan requests replacement. */
  planSourceUpdate?(id: string, previous: Readonly<Record<string, unknown>>, next: Readonly<Record<string, unknown>>, checkCurrent?: () => void): (() => void) | undefined;
  addLayer(layer: Readonly<Record<string, unknown>>, before?: string): unknown;
  removeLayer(id: string): unknown;
  moveLayer(id: string, before?: string): unknown;
  hasImage(id: string): boolean;
  addImage(id: string, image: ImageData, options: { readonly pixelRatio: number }): unknown;
  removeImage(id: string): unknown;
}
export interface MapOwnedResourceContext {
  readonly isCurrent: () => boolean;
  readonly prepare: (requirements: LyraMapFeatureRequirements, signal: AbortSignal) => Promise<void>;
  /** Synchronous ownership notification, after admission and before source-dependent retirement. */
  readonly beforeSourceChange?: (change: MapOwnedSourceChange) => void;
}
export interface MapOwnedSourceChange {
  readonly id: string;
  readonly reason: 'remove' | 'replace' | 'update' | 'rollback';
  readonly previous: Readonly<Record<string, unknown>> | undefined;
  readonly next: Readonly<Record<string, unknown>> | undefined;
}
type MapOwnedResourceError = 'collision' | 'missing-source' | 'order' | 'preparation' | 'peer' | 'aborted' | 'reentrant' | 'invalid-image';
export type MapOwnedResourceResult = { readonly ok: true } |
  { readonly ok: false; readonly code: MapOwnedResourceError; readonly rollbackFailed: boolean };
interface State {
  readonly sources: Map<string, LyraMapOverlaySource>;
  readonly layers: Map<string, LyraMapOverlayLayer>;
  readonly images: Map<string, PreparedMapImage>;
}
const state = (): State => ({ sources: new Map(), layers: new Map(), images: new Map() });
const copy = (value: State): State => ({ sources: new Map(value.sources), layers: new Map(value.layers), images: new Map(value.images) });
const failure = (code: MapOwnedResourceError, rollbackFailed = false): MapOwnedResourceResult => Object.freeze({ ok: false, code, rollbackFailed });
class ResourceFailure extends Error {
  constructor(readonly code: MapOwnedResourceError) { super(code); }
}
function equal(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true;
  if (Array.isArray(left) && Array.isArray(right)) return left.length === right.length && left.every((entry, index) => equal(entry, right[index]));
  if (!isPlainDataRecord(left) || !isPlainDataRecord(right)) return false;
  const keys = Object.keys(left);
  return keys.length === Object.keys(right).length && keys.every(key => Object.hasOwn(right, key) && equal(left[key], right[key]));
}
interface Transaction {
  readonly abort: AbortController;
  readonly images: ReadonlySet<PreparedMapImage>;
}

/**
 * Own resources admitted by this module, with explicit dependency order and bounded replay.
 * reconcile consumes its prepared image handles even on rejection; unchanged retained handles may
 * be supplied again. The owner removes the peer before dispose(). A changed style token means
 * that the peer has already discarded the previous style, so its IDs must be claimed afresh.
 * Direct external replacement/removal of registered IDs is outside this ownership contract.
 */
export class MapOwnedResources {
  private peer?: MapOwnedResourcePeer;
  private style?: unknown;
  private applied = state();
  private readonly retained = new Set<PreparedMapImage>();
  private readonly transactions = new Set<Transaction>();
  private active?: Transaction;
  private mutating = false;
  private uncertain = false;
  private disposing = false;
  private readonly interruptedSourceUpdates = new Set<string>();

  ownsLayer(id: string): boolean { return this.applied.layers.has(id); }

  async reconcile(
    peer: MapOwnedResourcePeer,
    style: unknown,
    overlays: MapOwnedOverlaySnapshot,
    images: readonly PreparedMapImage[],
    context: MapOwnedResourceContext,
  ): Promise<MapOwnedResourceResult> {
    if (this.mutating || this.disposing) {
      for (const image of images) if (!this.retained.has(image)) image.dispose();
      return failure(this.disposing ? 'aborted' : 'reentrant');
    }
    const transaction: Transaction = { abort: new AbortController(), images: new Set(images) };
    for (const image of images) this.retained.add(image);
    this.transactions.add(transaction);
    const previous = this.active;
    this.active = transaction;
    previous?.abort.abort();
    const current = (): boolean => {
      try {
        return this.active === transaction && !transaction.abort.signal.aborted &&
          this.peer === peer && Object.is(this.style, style) && context.isCurrent() &&
          this.active === transaction && !transaction.abort.signal.aborted &&
          this.peer === peer && Object.is(this.style, style);
      } catch { return false; }
    };
    const guard = (): void => { if (!current()) throw new ResourceFailure('aborted'); };
    const notify = (change: MapOwnedSourceChange): void => {
      guard(); context.beforeSourceChange?.(Object.freeze(change)); guard();
    };
    let started = false; let locked = false; let original: State | undefined;
    try {
      // Aborting an older request can synchronously start a newer one. Do not replace that
      // newer request's peer/style ownership while the interrupted outer call resumes.
      if (this.active !== transaction || transaction.abort.signal.aborted) throw new ResourceFailure('aborted');
      if (this.peer !== peer || !Object.is(this.style, style)) {
        this.peer = peer; this.style = style; this.applied = state(); this.uncertain = false;
        this.interruptedSourceUpdates.clear();
      }
      guard();
      if (this.uncertain) return failure('peer', true);
      const desired = state();
      for (const source of overlays.sources) desired.sources.set(source.id, source);
      for (const layer of overlays.layers) desired.layers.set(layer.layer.id, layer);
      if (images.length > 64) throw new ResourceFailure('invalid-image');
      for (const image of images) {
        if (!image.image || desired.images.has(image.id)) throw new ResourceFailure('invalid-image');
        desired.images.set(image.id, image);
      }
      // New preparation is completed before old resources are retired. Abort races only this
      // module/worker barrier, whose rejected promise is observed even if a peer ignores abort.
      const sources = Object.fromEntries(overlays.sources.map(entry => [entry.id, entry.source]));
      let removeAbort = (): void => undefined;
      const cancelled = new Promise<never>((_resolve, rejectPromise) => {
        const abort = (): void => { rejectPromise(new ResourceFailure('aborted')); };
        if (transaction.abort.signal.aborted) { abort(); return; }
        transaction.abort.signal.addEventListener('abort', abort, { once: true });
        removeAbort = () => { transaction.abort.signal.removeEventListener('abort', abort); };
      });
      void cancelled.catch(() => undefined);
      try {
        guard();
        await Promise.race([context.prepare({ sources, layers: overlays.layers.map(entry => entry.layer) }, transaction.abort.signal), cancelled]);
      } catch (error) {
        if (!current() || error instanceof ResourceFailure && error.code === 'aborted') throw new ResourceFailure('aborted');
        throw new ResourceFailure('preparation');
      } finally { removeAbort(); }
      guard();
      original = copy(this.applied);
      for (const [id] of desired.sources) {
        if (!original.sources.has(id) && peer.getSource(id)) throw new ResourceFailure('collision');
        guard();
      }
      for (const [id] of desired.layers) {
        if (!original.layers.has(id) && peer.getLayer(id)) throw new ResourceFailure('collision');
        guard();
      }
      for (const [id] of desired.images) {
        if (!original.images.has(id) && peer.hasImage(id)) throw new ResourceFailure('collision');
        guard();
      }
      const changedSources = new Set([...original.sources].filter(([id, entry]) =>
        this.interruptedSourceUpdates.has(id) || !equal(entry.source, desired.sources.get(id)?.source)).map(([id]) => id));
      const sourceUpdates = new Map<string, () => void>();
      for (const id of changedSources) {
        const next = desired.sources.get(id);
        if (!next || this.interruptedSourceUpdates.has(id)) continue;
        guard();
        const apply = peer.planSourceUpdate?.(id, original.sources.get(id)!.source, next.source, guard);
        guard();
        if (typeof apply === 'function') { sourceUpdates.set(id, apply); changedSources.delete(id); }
      }
      const changedImages = new Set([...original.images].filter(([id, entry]) => entry !== desired.images.get(id)).map(([id]) => id));
      const removedLayers = new Set([...original.layers].filter(([id, entry]) => {
        const next = desired.layers.get(id);
        return !next || !equal(entry.layer, next.layer) || changedImages.size > 0 ||
          typeof entry.layer['source'] === 'string' && changedSources.has(entry.layer['source']);
      }).map(([id]) => id));
      for (const entry of desired.layers.values()) {
        const source = entry.layer['source'];
        if (typeof source === 'string' && !desired.sources.has(source) &&
          (changedSources.has(source) || !peer.getSource(source))) throw new ResourceFailure('missing-source');
        guard();
      }
      const existing = peer.layerIds(); guard();
      const order = planMapLayerOrder(existing.filter(id => !removedLayers.has(id)), overlays.layers.map(entry => ({
        id: entry.layer.id, layerIds: [entry.layer.id], ...(entry.before === undefined ? {} : { before: entry.before }),
      })));
      if (!order.valid) throw new ResourceFailure('order');
      this.mutating = true; locked = true;
      // Notify the complete admitted change set before retiring any layer. A callback can stop
      // ownership, but cannot recursively mutate this registry while the notification runs.
      for (const id of changedSources) notify({ id, reason: desired.sources.has(id) ? 'replace' : 'remove',
        previous: original.sources.get(id)!.source, next: desired.sources.get(id)?.source });
      for (const id of sourceUpdates.keys()) notify({ id, reason: 'update',
        previous: original.sources.get(id)!.source, next: desired.sources.get(id)!.source });
      guard(); started = true;
      this.applied = copy(original);
      for (const id of [...existing].reverse()) if (removedLayers.has(id)) {
        guard(); this.applied.layers.delete(id); peer.removeLayer(id); guard();
      }
      for (const id of changedSources) {
        guard(); const exists = peer.getSource(id); guard();
        this.applied.sources.delete(id); if (exists) peer.removeSource(id); guard();
      }
      for (const id of changedImages) {
        guard(); const exists = peer.hasImage(id); guard();
        this.applied.images.delete(id); if (exists) peer.removeImage(id); guard();
      }
      for (const [id, image] of desired.images) if (!this.applied.images.has(id)) {
        guard(); this.applied.images.set(id, image);
        peer.addImage(id, image.image!, { pixelRatio: image.pixelRatio }); guard();
      }
      for (const [id, source] of desired.sources) if (!this.applied.sources.has(id)) {
        guard(); this.applied.sources.set(id, source); peer.addSource(id, source.source); guard();
      }
      for (const [id, apply] of sourceUpdates) {
        // Journal the next descriptor first: cancellation may leave a partially updated native
        // source that a later request must replace, while a current failure can restore original.
        guard(); this.applied.sources.set(id, desired.sources.get(id)!);
        this.interruptedSourceUpdates.add(id); apply(); guard(); this.interruptedSourceUpdates.delete(id);
      }
      for (const operation of order.operations) {
        guard();
        const entry = desired.layers.get(operation.id)!;
        this.applied.layers.set(operation.id, entry);
        if (operation.kind === 'add') peer.addLayer(entry.layer, operation.before);
        else peer.moveLayer(operation.id, operation.before);
        guard();
      }
      this.applied = desired;
      this.interruptedSourceUpdates.clear();
      return Object.freeze({ ok: true });
    } catch (error) {
      const code = error instanceof ResourceFailure ? error.code : 'peer';
      let rollbackFailed = false;
      if (started && original && current()) {
        try { this.rollback(peer, original, guard, notify); }
        catch {
          rollbackFailed = true;
          if (this.peer === peer && Object.is(this.style, style)) this.uncertain = true;
        }
      }
      // An engine callback may cancel and throw before or after mutating its resource. No
      // current transaction can safely probe/repair that engine; retain pixels until a fresh
      // style or peer disposal instead of releasing a potentially installed image.
      if (started && !(error instanceof ResourceFailure) && !current() &&
        this.peer === peer && Object.is(this.style, style)) {
        rollbackFailed = true; this.uncertain = true;
      }
      return failure(code, rollbackFailed);
    } finally {
      if (locked) this.mutating = false;
      this.transactions.delete(transaction);
      if (this.active === transaction) this.active = undefined;
      this.sweep();
    }
  }

  /** Cancel pending preparation before the owner replaces a style or disconnects. */
  cancel(): void {
    const active = this.active;
    this.active = undefined;
    active?.abort.abort();
  }

  /** Called after the peer is removed; releases cached pixels and obsolete preparation. */
  dispose(): void {
    if (this.disposing) return;
    this.disposing = true;
    try {
      this.cancel(); this.peer = undefined; this.style = undefined; this.applied = state(); this.uncertain = false;
      this.interruptedSourceUpdates.clear();
      for (const transaction of [...this.transactions]) transaction.abort.abort();
      this.transactions.clear();
      for (const image of this.retained) image.dispose();
      this.retained.clear();
    } finally { this.disposing = false; }
  }

  private sweep(): void {
    if (this.uncertain) return;
    const needed = new Set(this.applied.images.values());
    for (const transaction of this.transactions) for (const image of transaction.images) needed.add(image);
    for (const image of this.retained) if (!needed.has(image)) {
      this.retained.delete(image); image.dispose();
    }
  }

  private rollback(peer: MapOwnedResourcePeer, original: State, guard: () => void,
    notify: (change: MapOwnedSourceChange) => void): void {
    const ownedLayers = new Set([...original.layers.keys(), ...this.applied.layers.keys()]);
    const ownedSources = new Set([...original.sources.keys(), ...this.applied.sources.keys()]);
    const ownedImages = new Set([...original.images.keys(), ...this.applied.images.keys()]);
    const existing = peer.layerIds(); guard();
    for (const id of ownedSources) notify({ id, reason: 'rollback',
      previous: this.applied.sources.get(id)?.source, next: original.sources.get(id)?.source });
    for (const id of [...existing].reverse()) if (ownedLayers.has(id)) {
      guard(); peer.removeLayer(id); guard();
    }
    for (const id of ownedSources) {
      guard(); const exists = peer.getSource(id); guard(); if (exists) peer.removeSource(id); guard();
    }
    for (const id of ownedImages) {
      guard(); const exists = peer.hasImage(id); guard(); if (exists) peer.removeImage(id); guard();
    }
    for (const [id, image] of original.images) {
      guard(); peer.addImage(id, image.image!, { pixelRatio: image.pixelRatio }); guard();
    }
    for (const [id, source] of original.sources) { guard(); peer.addSource(id, source.source); guard(); }
    const remaining = peer.layerIds(); guard();
    const order = planMapLayerOrder(remaining, [...original.layers.values()].map(entry => ({
      id: entry.layer.id, layerIds: [entry.layer.id], ...(entry.before === undefined ? {} : { before: entry.before }),
    })));
    if (!order.valid) throw new ResourceFailure('order');
    for (const operation of order.operations) {
      guard(); peer.addLayer(original.layers.get(operation.id)!.layer, operation.before); guard();
    }
    this.applied = original;
    this.interruptedSourceUpdates.clear();
  }
}
