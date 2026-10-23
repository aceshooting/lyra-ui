import { isPlainDataRecord } from '../../../internal/data-descriptors.js';
import type { LyraMapFeatureRequirements } from './map-loader.js';
import type { PreparedMapImage } from './map-images.js';
import { isIdentityGeoJsonData, type LyraMapOverlayLayer, type LyraMapOverlaySource, type MapOwnedOverlaySnapshot } from './map-overlay-admission.js';
import { planMapLayerOrder } from './map-layer-order.js';
import { MAP_IMAGE_LIMITS } from './map-image-admission.js';

export { admitMapOverlays } from './map-overlay-admission.js';
export type { MapOwnedOverlaySnapshot } from './map-overlay-admission.js';

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
  setPaintProperty?(id: string, property: string, value: unknown): unknown;
  setLayoutProperty?(id: string, property: string, value: unknown): unknown;
  setFilter?(id: string, filter: unknown): unknown;
  setLayerZoomRange?(id: string, min: number, max: number): unknown;
  triggerRepaint?(): unknown;
  hasImage(id: string): boolean;
  addImage(id: string, image: ImageData, options: { readonly pixelRatio: number; readonly sdf?: boolean }): unknown;
  removeImage(id: string): unknown;
}
export interface MapOwnedResourceContext {
  readonly isCurrent: () => boolean;
  readonly prepare: (requirements: LyraMapFeatureRequirements, signal: AbortSignal) => Promise<void>;
  /** Synchronous ownership notification, after admission and before source-dependent retirement. */
  readonly beforeMutation?: () => void;
  readonly afterMutation?: (safeToRestore: boolean) => void;
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
const imageOptions = (image: PreparedMapImage): { readonly pixelRatio: number; readonly sdf?: boolean } =>
  image.sdf ? { pixelRatio: image.pixelRatio, sdf: true } : { pixelRatio: image.pixelRatio };
const state = (): State => ({ sources: new Map(), layers: new Map(), images: new Map() });
const copy = (value: State): State => ({ sources: new Map(value.sources), layers: new Map(value.layers), images: new Map(value.images) });
const failure = (code: MapOwnedResourceError, rollbackFailed = false): MapOwnedResourceResult => Object.freeze({ ok: false, code, rollbackFailed });
class ResourceFailure extends Error {
  constructor(readonly code: MapOwnedResourceError) { super(code); }
}
function equal(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true;
  if (isIdentityGeoJsonData(left) || isIdentityGeoJsonData(right)) return false;
  if (Array.isArray(left) && Array.isArray(right)) return left.length === right.length && left.every((entry, index) => equal(entry, right[index]));
  if (!isPlainDataRecord(left) || !isPlainDataRecord(right)) return false;
  const keys = Object.keys(left);
  return keys.length === Object.keys(right).length && keys.every(key => Object.hasOwn(right, key) && equal(left[key], right[key]));
}
interface LayerMutation { apply(): void; restore(): void; }
const MUTABLE_LAYER_KEYS = new Set(['paint', 'layout', 'filter', 'minzoom', 'maxzoom']);

/** Plan bounded, already-admitted descriptors only. Unknown native fields remain structural. */
function planLayerUpdate(peer: MapOwnedResourcePeer, previous: LyraMapOverlayLayer['layer'], next: LyraMapOverlayLayer['layer']): readonly LayerMutation[] | undefined {
  const structural = (layer: LyraMapOverlayLayer['layer']) => Object.fromEntries(
    Object.entries(layer).filter(([key]) => !MUTABLE_LAYER_KEYS.has(key)),
  );
  if (!equal(structural(previous), structural(next))) return undefined;
  const id = next.id, mutations: LayerMutation[] = [];
  for (const kind of ['paint', 'layout'] as const) {
    const before = previous[kind] === undefined ? {} : previous[kind], after = next[kind] === undefined ? {} : next[kind];
    if (!isPlainDataRecord(before) || !isPlainDataRecord(after)) return undefined;
    const names = [...new Set([...Object.keys(before), ...Object.keys(after)])].filter(key => !equal(before[key], after[key]));
    if (!names.length) continue;
    const write = kind === 'paint' ? peer.setPaintProperty : peer.setLayoutProperty;
    if (typeof write !== 'function') return undefined;
    for (const name of names) mutations.push({
      apply: () => { write.call(peer, id, name, Object.hasOwn(after, name) ? after[name] : null); },
      restore: () => { write.call(peer, id, name, Object.hasOwn(before, name) ? before[name] : null); },
    });
  }
  if (!equal(previous['filter'], next['filter'])) {
    const write = peer.setFilter;
    if (typeof write !== 'function') return undefined;
    mutations.push({ apply: () => { write.call(peer, id, next['filter'] ?? null); },
      restore: () => { write.call(peer, id, previous['filter'] ?? null); } });
  }
  if (!equal(previous['minzoom'], next['minzoom']) || !equal(previous['maxzoom'], next['maxzoom'])) {
    const beforeMin = previous['minzoom'] === undefined ? 0 : previous['minzoom'], beforeMax = previous['maxzoom'] === undefined ? 24 : previous['maxzoom'];
    const afterMin = next['minzoom'] === undefined ? 0 : next['minzoom'], afterMax = next['maxzoom'] === undefined ? 24 : next['maxzoom'];
    const write = peer.setLayerZoomRange;
    if (typeof write !== 'function' || typeof beforeMin !== 'number' || typeof beforeMax !== 'number' ||
      typeof afterMin !== 'number' || typeof afterMax !== 'number') return undefined;
    mutations.push({ apply: () => { write.call(peer, id, afterMin, afterMax); },
      restore: () => { write.call(peer, id, beforeMin, beforeMax); } });
  }
  return mutations.length && typeof peer.triggerRepaint !== 'function' ? undefined : mutations;
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
  private readonly interruptedLayerUpdates = new Set<string>();
  /** Image IDs owned under an earlier style of the same peer. A diffed style swap keeps the
   *  engine's runtime images, so these may still be installed; they are replaced, not collisions. */
  private carriedImages = new Set<string>();

  ownsLayer(id: string): boolean { return this.applied.layers.has(id); }
  /** Whether `id` is an applied GeoJSON source of this registry. */
  ownsGeoJsonSource(id: string): boolean { return this.applied.sources.get(id)?.source['type'] === 'geojson'; }

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
    let started = false; let locked = false; let original: State | undefined; let safeToRestore = false;
    let fullRollback = false, mutableStarted = false;
    const layerJournal: Array<() => void> = [];
    try {
      // Aborting an older request can synchronously start a newer one. Do not replace that
      // newer request's peer/style ownership while the interrupted outer call resumes.
      if (this.active !== transaction || transaction.abort.signal.aborted) throw new ResourceFailure('aborted');
      if (this.peer !== peer || !Object.is(this.style, style)) {
        this.carriedImages = this.peer === peer ? new Set([...this.carriedImages, ...this.applied.images.keys()]) : new Set();
        this.peer = peer; this.style = style; this.applied = state(); this.uncertain = false;
        this.interruptedSourceUpdates.clear(); this.interruptedLayerUpdates.clear();
      }
      guard();
      if (this.uncertain) return failure('peer', true);
      const desired = state();
      for (const source of overlays.sources) desired.sources.set(source.id, source);
      for (const layer of overlays.layers) desired.layers.set(layer.layer.id, layer);
      if (images.length > MAP_IMAGE_LIMITS.count) throw new ResourceFailure('invalid-image');
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
        if (!original.images.has(id) && !this.carriedImages.has(id) && peer.hasImage(id)) throw new ResourceFailure('collision');
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
      const removedLayers = new Set<string>();
      const layerUpdates = new Map<string, readonly LayerMutation[]>();
      for (const [id, entry] of original.layers) {
        const next = desired.layers.get(id);
        // Changed images retain every dependent layer; changed source structure cannot.
        if (!next || this.interruptedLayerUpdates.has(id) ||
          typeof entry.layer['source'] === 'string' && changedSources.has(entry.layer['source'])) {
          removedLayers.add(id); continue;
        }
        if (equal(entry.layer, next.layer)) continue;
        guard(); const update = planLayerUpdate(peer, entry.layer, next.layer); guard();
        if (update) layerUpdates.set(id, update); else removedLayers.add(id);
      }
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
      guard(); context.beforeMutation?.(); guard(); started = true;
      this.applied = copy(original);
      for (const id of [...existing].reverse()) if (removedLayers.has(id)) {
        guard(); this.applied.layers.delete(id); fullRollback = true; peer.removeLayer(id); guard();
      }
      for (const id of changedSources) {
        guard(); const exists = peer.getSource(id); guard();
        this.applied.sources.delete(id); if (exists) { fullRollback = true; peer.removeSource(id); } guard();
      }
      for (const id of changedImages) {
        guard(); const exists = peer.hasImage(id); guard();
        this.applied.images.delete(id); if (exists) { fullRollback = true; peer.removeImage(id); } guard();
      }
      for (const [id, image] of desired.images) if (!this.applied.images.has(id)) {
        if (this.carriedImages.has(id)) { guard(); const carried = peer.hasImage(id); guard(); if (carried) { fullRollback = true; peer.removeImage(id); } guard(); }
        guard(); this.applied.images.set(id, image);
        fullRollback = true; peer.addImage(id, image.image!, imageOptions(image)); guard();
      }
      for (const [id, source] of desired.sources) if (!this.applied.sources.has(id)) {
        guard(); this.applied.sources.set(id, source); fullRollback = true; peer.addSource(id, source.source); guard();
      }
      for (const [id, apply] of sourceUpdates) {
        // Journal the next descriptor first: cancellation may leave a partially updated native
        // source that a later request must replace, while a current failure can restore original.
        guard(); this.applied.sources.set(id, desired.sources.get(id)!);
        this.interruptedSourceUpdates.add(id); fullRollback = true; apply(); guard(); this.interruptedSourceUpdates.delete(id);
      }
      for (const [id, mutations] of layerUpdates) {
        guard(); this.applied.layers.set(id, desired.layers.get(id)!);
        if (mutations.length) this.interruptedLayerUpdates.add(id);
        for (const mutation of mutations) {
          // Native setters can mutate and then throw. Record restoration before the call.
          guard(); layerJournal.push(mutation.restore); mutableStarted = true; mutation.apply(); guard();
        }
      }
      const workingOrder = existing.filter(id => !removedLayers.has(id));
      for (const operation of order.operations) {
        guard();
        const entry = desired.layers.get(operation.id)!;
        this.applied.layers.set(operation.id, entry);
        if (operation.kind === 'add') { fullRollback = true; peer.addLayer(entry.layer, operation.before); }
        else {
          const position = workingOrder.indexOf(operation.id), oldBefore = workingOrder[position + 1];
          layerJournal.push(() => { peer.moveLayer(operation.id, oldBefore); });
          peer.moveLayer(operation.id, operation.before);
        }
        guard();
        const position = workingOrder.indexOf(operation.id);
        if (position >= 0) workingOrder.splice(position, 1);
        workingOrder.splice(operation.before === undefined ? workingOrder.length : workingOrder.indexOf(operation.before), 0, operation.id);
      }
      if (mutableStarted) { guard(); peer.triggerRepaint!(); guard(); }
      this.applied = desired;
      this.interruptedSourceUpdates.clear(); this.interruptedLayerUpdates.clear();
      // Retired carried images that the engine still holds stay ours to remove later.
      for (const id of [...this.carriedImages]) {
        if (desired.images.has(id)) { this.carriedImages.delete(id); continue; }
        guard(); const held = peer.hasImage(id); guard();
        if (held) { fullRollback = true; peer.removeImage(id); }
        this.carriedImages.delete(id); guard();
      }
      safeToRestore = true;
      return Object.freeze({ ok: true });
    } catch (error) {
      const code = error instanceof ResourceFailure ? error.code : 'peer';
      let rollbackFailed = false;
      if (started && original && current()) {
        try {
          for (const restore of [...layerJournal].reverse()) { guard(); restore(); guard(); }
          if (fullRollback) this.rollback(peer, original, guard, notify);
          else {
            if (mutableStarted) { guard(); peer.triggerRepaint!(); guard(); }
            this.applied = original; this.interruptedLayerUpdates.clear();
          }
        }
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
      safeToRestore = !rollbackFailed && code !== 'aborted';
      return failure(code, rollbackFailed);
    } finally {
      if (locked) this.mutating = false;
      this.transactions.delete(transaction);
      if (this.active === transaction) this.active = undefined;
      try { this.sweep(); } finally { context.afterMutation?.(safeToRestore); }
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
      this.carriedImages = new Set();
      this.interruptedSourceUpdates.clear(); this.interruptedLayerUpdates.clear();
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
      guard(); peer.addImage(id, image.image!, imageOptions(image)); guard();
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
    this.interruptedSourceUpdates.clear(); this.interruptedLayerUpdates.clear();
  }
}
