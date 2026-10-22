import { getInheritedPropertyDescriptor } from '../../../internal/data-descriptors.js';
import { admitMapFeatureStateRoutes, resolveMapFeatureStateTarget, type LyraMapFeatureOrigin,
  type LyraMapResolvedFeatureStateTarget, type MapFeatureStateRoute } from './map-feature-state-router.js';
import { MapFeatureStateStore, type LyraMapFeatureState, type MapFeatureStatePeer, type LyraMapFeatureIdentifier,
  type MapFeatureStateResult, type MapFeatureStateReplayResult, type MapFeatureStateIssue, type MapFeatureStateRetirement } from './map-feature-state.js';

export type { MapFeatureStateRoute } from './map-feature-state-router.js';
const failure = (code: MapFeatureStateIssue): MapFeatureStateResult => Object.freeze({ accepted: false, code });
interface NativeRetirement extends MapFeatureStateRetirement { readonly sourceHandle: unknown; }
interface ReplayContext { readonly peer: MapFeatureStatePeer; readonly epoch: number; readonly current: () => boolean; readonly signal?: AbortSignal; }

/** Logical state routing over the bounded desired-state store; native handles are never public. */
export class MapFeatureStateRoutes {
  private readonly store = new MapFeatureStateStore();
  private routes = new Map<string, MapFeatureStateRoute>();
  private readonly adapters = new WeakMap<object, MapFeatureStatePeer>();
  private epoch = 0;
  private busy = false;
  private disposed = false;
  private replayContext?: ReplayContext;
  private readonly targets = new Map<string, LyraMapFeatureIdentifier>();
  private readonly refresh = new Set<string>();
  private retirements = new Map<string, NativeRetirement>();
  private readonly nativeSources = new Map<string, unknown>();
  private nativePeer?: MapFeatureStatePeer;
  private nativeGeneration: unknown;
  private sourceRetirements(key: string, route: MapFeatureStateRoute): readonly NativeRetirement[] {
    if (!this.nativeSources.has(route.nativeSource)) return [];
    const sourceHandle = this.nativeSources.get(route.nativeSource);
    return this.store.sourceRetirements(key).map(entry => Object.freeze({
      target: Object.freeze({ ...entry.target, source: route.nativeSource }), keys: entry.keys, sourceHandle,
    }));
  }
  private retainRetirements(entries: readonly NativeRetirement[]): boolean {
    if (!this.nativePeer) return true;
    const next = new Map(this.retirements);
    for (const entry of entries) {
      const key = this.targetKey(entry.target), previous = next.get(key);
      const keys = Object.freeze([...new Set([...(previous && previous.sourceHandle === entry.sourceHandle ? previous.keys : []), ...entry.keys])]);
      next.set(key, Object.freeze({ ...entry, keys }));
    }
    if (next.size > 1024) return false;
    let text = 0, keys = 0;
    for (const [key, entry] of next) { text += key.length + entry.keys.join('').length; keys += entry.keys.length; }
    if (text > 1048576 || keys > 65536) return false;
    this.retirements = next;
    return true;
  }
  private targetKey(target: LyraMapFeatureIdentifier): string { return JSON.stringify([target.source, target.sourceLayer ?? null, target.id]); }
  private dirtySource(source: string): void {
    for (const target of this.targets.values()) if (target.source === source) this.store.set(target, this.store.get(target) ?? {});
  }

  private run<T>(fallback: (code: MapFeatureStateIssue) => T, action: () => T): T {
    if (this.disposed) return fallback('disposed');
    if (this.busy) return fallback('reentrant');
    this.busy = true;
    try { return action(); } catch { return fallback(this.disposed ? 'disposed' : 'invalid-input'); }
    finally { this.busy = false; }
  }

  configure(input: unknown): MapFeatureStateResult {
    return this.run(failure, () => {
      const epoch = this.epoch, next = admitMapFeatureStateRoutes(input);
      if (epoch !== this.epoch || this.disposed) return failure('cancelled');
      const retiring = [...this.routes].filter(([key, route]) => {
        const replacement = next.get(key); return !replacement || !Object.is(replacement.identity, route.identity);
      });
      if (!this.retainRetirements(retiring.flatMap(([key, route]) => this.sourceRetirements(key, route)))) return failure('limit');
      for (const [key] of retiring) this.store.invalidateSource(key);
      const accepted = this.store.setSources([...next].map(([source, route]) => ({ source, identity: route.identity })));
      if (!accepted.accepted) return accepted;
      const changed = next.size !== this.routes.size || [...next].some(([key, route]) => {
        const old = this.routes.get(key);
        return !old || old.nativeSource !== route.nativeSource || !Object.is(old.identity, route.identity) ||
          JSON.stringify(old.sourceLayers) !== JSON.stringify(route.sourceLayers);
      });
      for (const [key, target] of this.targets) {
        const route = next.get(target.source), previous = this.routes.get(target.source);
        if (!route || !previous || !Object.is(route.identity, previous.identity)) this.targets.delete(key);
      }
      for (const source of this.refresh) if (!next.has(source)) this.refresh.delete(source);
      for (const [key, route] of next) {
        const previous = this.routes.get(key);
        if (previous && Object.is(previous.identity, route.identity) &&
          (previous.nativeSource !== route.nativeSource || JSON.stringify(previous.sourceLayers) !== JSON.stringify(route.sourceLayers))) this.dirtySource(key);
      }
      this.routes = next;
      const nativeSources = new Set([...next.values()].map(route => route.nativeSource));
      for (const source of this.nativeSources.keys()) if (!nativeSources.has(source)) this.nativeSources.delete(source);
      if (changed) { this.epoch++; this.store.cancel(); }
      return accepted;
    });
  }

  private resolveTarget(input: unknown): { readonly target: LyraMapResolvedFeatureStateTarget; readonly route: MapFeatureStateRoute; readonly logical: LyraMapFeatureIdentifier } | undefined {
    return resolveMapFeatureStateTarget(this.routes, input);
  }

  /** Resolve public ambiguity and source-layer constraints without exposing internal route keys. */
  resolve(input: unknown): LyraMapResolvedFeatureStateTarget | undefined {
    return this.run(() => undefined, () => { const epoch = this.epoch, target = this.resolveTarget(input)?.target; return epoch === this.epoch && !this.disposed ? target : undefined; });
  }
  set(input: unknown, patch: unknown): MapFeatureStateResult {
    return this.run(failure, () => {
      const epoch = this.epoch, resolved = this.resolveTarget(input); if (epoch !== this.epoch || this.disposed) return failure('cancelled');
      if (!resolved) return failure('unknown-source');
      const result = this.store.set(resolved.logical, patch);
      if (result.accepted && this.store.get(resolved.logical)) this.targets.set(this.targetKey(resolved.logical), resolved.logical);
      return result;
    });
  }
  get(input: unknown): LyraMapFeatureState | undefined {
    return this.run(() => undefined, () => { const epoch = this.epoch, resolved = this.resolveTarget(input); return epoch === this.epoch && !this.disposed && resolved ? this.store.get(resolved.logical) : undefined; });
  }
  remove(input: unknown, property?: string): MapFeatureStateResult {
    return this.run(failure, () => { const epoch = this.epoch, resolved = this.resolveTarget(input); if (epoch !== this.epoch || this.disposed) return failure('cancelled'); return resolved ? this.store.remove(resolved.logical, property) : failure('unknown-source'); });
  }

  /** Semantic source retirement only; cancel() preserves desired state for physical replacement. */
  invalidateNative(origin: LyraMapFeatureOrigin, nativeSource: string): void {
    const retiring = [...this.routes].filter(([_key, route]) => route.origin === origin && route.nativeSource === nativeSource);
    if (!this.retainRetirements(retiring.flatMap(([key, route]) => this.sourceRetirements(key, route)))) throw new Error('Feature-state retirement limit.');
    this.cancel();
    for (const [key] of retiring) {
      this.routes.delete(key); this.store.invalidateSource(key);
      this.refresh.delete(key);
      for (const [targetKey, target] of this.targets) if (target.source === key) this.targets.delete(targetKey);
    }
  }
  /** Physical replacement under the same native ID retains desired state and key tombstones. */
  refreshNative(origin: LyraMapFeatureOrigin, nativeSource: string): MapFeatureStateResult {
    if (this.disposed) return failure('disposed');
    this.cancel();
    for (const [key, route] of this.routes) if (route.origin === origin && route.nativeSource === nativeSource) this.refresh.add(key);
    return Object.freeze({ accepted: true });
  }
  cancel(): void { this.epoch++; this.store.cancel(); }
  dispose(): void { this.cancel(); this.disposed = true; this.routes.clear(); this.targets.clear(); this.refresh.clear(); this.retirements.clear(); this.nativeSources.clear(); this.nativePeer = undefined; this.nativeGeneration = undefined; this.store.dispose(); this.replayContext = undefined; }

  private check(): ReplayContext {
    const context = this.replayContext;
    const owned = () => Boolean(context && !this.disposed && context.epoch === this.epoch && !context.signal?.aborted && this.replayContext === context);
    let valid = false;
    try { valid = owned() && context!.current() && owned(); } catch { /* A failed owner predicate cancels replay. */ }
    if (!valid) {
      this.store.cancel(); throw new Error('Feature-state replay is stale.');
    }
    return context!;
  }
  private nativeTarget(target: LyraMapFeatureIdentifier): LyraMapFeatureIdentifier {
    const route = this.routes.get(target.source);
    if (!route || (route.sourceLayers ? !target.sourceLayer || !route.sourceLayers.includes(target.sourceLayer) : target.sourceLayer !== undefined)) throw new Error('Feature-state route is unavailable.');
    return Object.freeze({ ...target, source: route.nativeSource });
  }
  private call(key: 'getSource' | 'setFeatureState' | 'removeFeatureState', args: readonly unknown[]): unknown {
    const context = this.check();
    const descriptor = getInheritedPropertyDescriptor(context.peer, key);
    this.check();
    if (!descriptor || !Object.hasOwn(descriptor, 'value') || typeof descriptor.value !== 'function') throw new Error('Feature-state capability is unavailable.');
    const result: unknown = Reflect.apply(descriptor.value, context.peer, args);
    this.check(); return result;
  }
  private adapter(peer: MapFeatureStatePeer): MapFeatureStatePeer {
    let adapter = this.adapters.get(peer);
    if (!adapter) {
      adapter = {
        getSource: logical => {
          this.check(); const route = this.routes.get(logical);
          if (!route) return undefined;
          const source = this.call('getSource', [route.nativeSource]);
          if (source) this.nativeSources.set(route.nativeSource, source);
          return source;
        },
        setFeatureState: (target, state) => { this.check(); return this.call('setFeatureState', [this.nativeTarget(target), state]); },
        removeFeatureState: (target, key) => { this.check(); return this.call('removeFeatureState', [this.nativeTarget(target), key]); },
      };
      this.adapters.set(peer, adapter);
    }
    return adapter;
  }
  replay(peer: MapFeatureStatePeer, generation: unknown, signal?: AbortSignal, current: () => boolean = () => true): MapFeatureStateReplayResult {
    const failed = (code: MapFeatureStateIssue): MapFeatureStateReplayResult => Object.freeze({ ...failure(code), applied: 0,
      diagnostics: Object.freeze([Object.freeze({ code })]) });
    return this.run(failed, () => {
      this.replayContext = { peer, epoch: this.epoch, current, ...(signal ? { signal } : {}) };
      try {
        this.check();
        if (this.nativePeer !== peer || !Object.is(this.nativeGeneration, generation)) { this.retirements.clear(); this.nativeSources.clear(); }
        this.nativePeer = peer; this.nativeGeneration = generation;
        let retired = 0;
        try {
          for (const [key, entry] of this.retirements) {
            if (this.call('getSource', [entry.target.source]) === entry.sourceHandle) {
              for (const property of entry.keys) this.call('removeFeatureState', [entry.target, property]);
            }
            this.retirements.delete(key); retired++;
          }
        } catch {
          this.check(); return failed('peer-error');
        }
        for (const source of this.refresh) this.dirtySource(source);
        this.refresh.clear();
        const result = this.store.replay(this.adapter(peer), generation, signal);
        if (result.accepted && result.diagnostics.length === 0) for (const [key, target] of this.targets) {
          if (!this.store.get(target)) this.targets.delete(key);
        }
        const diagnostics = result.diagnostics.map(issue => {
          const route = issue.target ? this.routes.get(issue.target.source) : undefined;
          const target = route && issue.target ? Object.freeze({ ...issue.target, origin: route.origin, source: route.source }) : undefined;
          return Object.freeze({ code: issue.code, ...(target ? { target } : {}) });
        });
        return Object.freeze({ ...result, applied: result.applied + retired, diagnostics: Object.freeze(diagnostics) });
      } catch { return failed(this.disposed ? 'disposed' : 'cancelled'); }
      finally { this.replayContext = undefined; }
    });
  }
}
