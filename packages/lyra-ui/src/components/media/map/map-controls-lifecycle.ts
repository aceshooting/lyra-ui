import { mapGeolocationErrorCode, type LyraMapGeolocationErrorCode, type MapOwnedControlKind, type LyraMapControlPosition,
  type NormalizedMapControlOptions } from './map-control-options.js';

export interface MapManagedControl {
  on?(type: string, callback: (event: unknown) => void): unknown;
  off?(type: string, callback: (event: unknown) => void): unknown;
}
export type MapManagedControlConstructor = new (options?: Record<string, unknown>) => unknown;
export interface MapControlLifecyclePeer {
  addControl(control: MapManagedControl, position: LyraMapControlPosition): unknown;
  removeControl(control: MapManagedControl): unknown;
}
export type MapControlLifecycleEvent =
  { readonly kind: 'geolocate-error'; readonly code: LyraMapGeolocationErrorCode } |
  { readonly kind: 'geolocate-out-of-bounds'; readonly code: 'out-of-bounds' } |
  { readonly kind: 'geolocate-success'; readonly lngLat?: readonly [number, number]; readonly accuracy?: number };
export interface MapControlLifecycleContext {
  /** Captures the component's current connection, map and control configuration. */
  readonly isCurrent: () => boolean;
  readonly onEvent: (event: MapControlLifecycleEvent) => void;
  readonly onFailure: (failure: { readonly kind: MapOwnedControlKind; readonly code: 'control-failed' }) => void;
}
/** Reads a native `GeolocationPosition` through own data or its standard prototype getters only:
 *  finite `longitude`/`latitude` within range and a finite nonnegative `accuracy`, or nothing. */
function geolocatedPosition(event: unknown): { readonly lngLat: readonly [number, number]; readonly accuracy: number } | Record<string, never> {
  try {
    if (event === null || typeof event !== 'object') return {};
    const coords = (event as { readonly coords?: unknown }).coords;
    if (coords === null || typeof coords !== 'object') return {};
    const { longitude, latitude, accuracy } = coords as { readonly longitude?: unknown; readonly latitude?: unknown; readonly accuracy?: unknown };
    if (typeof longitude !== 'number' || typeof latitude !== 'number' || typeof accuracy !== 'number' ||
      !Number.isFinite(longitude) || !Number.isFinite(latitude) || !Number.isFinite(accuracy) ||
      Math.abs(longitude) > 180 || Math.abs(latitude) > 90 || accuracy < 0) return {};
    return { lngLat: Object.freeze([longitude, latitude] as const), accuracy };
  } catch { return {}; }
}
interface Entry {
  readonly map: MapControlLifecyclePeer;
  readonly options: NormalizedMapControlOptions;
  context: MapControlLifecycleContext;
  control?: MapManagedControl;
  installed: boolean;
  attempted: boolean;
  adding: boolean;
  subscribing: boolean;
  removed: boolean;
  retired: boolean;
  readonly subscriptions: { readonly type: string; readonly callback: (event: unknown) => void }[];
}

/**
 * Owns native controls and exact event subscriptions. The caller disables constructor-native
 * attribution and includes normalized attribution:true for an unset attribution option. Passing
 * attribution:false omits that entry. Provider attribution remains managed by the native control.
 * No location trigger is called: native user activation alone starts geolocation.
 */
export class MapControlsLifecycle {
  private generation = 0;
  private readonly entries = new Map<MapOwnedControlKind, Entry>();

  constructor(private readonly load: (kind: MapOwnedControlKind) => Promise<MapManagedControlConstructor | null | undefined>) {}

  async sync(map: MapControlLifecyclePeer, desired: ReadonlyMap<MapOwnedControlKind, NormalizedMapControlOptions>,
    context: MapControlLifecycleContext): Promise<void> {
    const generation = ++this.generation;
    const retired: Entry[] = [];
    // Clear ownership before any callback-capable native teardown. Pending imports are retried
    // rather than stranded when the same desired configuration is synchronized again.
    for (const [kind, entry] of this.entries) {
      const next = desired.get(kind);
      if (entry.map === map && entry.installed && next?.key === entry.options.key) entry.context = context;
      else { this.entries.delete(kind); retired.push(entry); }
    }
    for (const entry of retired) this.retire(entry);
    if (generation !== this.generation || !this.validContext(context) || generation !== this.generation) return;
    const work: Promise<void>[] = [];
    for (const [kind, options] of desired) {
      if (generation !== this.generation) break;
      if (this.entries.has(kind)) continue;
      const entry: Entry = { map, options, context, installed: false, attempted: false, adding: false, subscribing: false,
        removed: false, retired: false, subscriptions: [] };
      this.entries.set(kind, entry);
      work.push(this.install(entry));
    }
    await Promise.all(work);
  }

  /** Retire subscriptions before the caller removes the native map. Reusable after reconnect. */
  dispose(): void {
    this.generation += 1;
    const retired = [...this.entries.values()]; this.entries.clear();
    for (const entry of retired) this.retire(entry);
  }

  private validContext(context: MapControlLifecycleContext): boolean {
    try { return context.isCurrent(); } catch { return false; }
  }

  private current(entry: Entry): boolean {
    const owned = (): boolean => !entry.retired && this.entries.get(entry.options.kind) === entry;
    return owned() && this.validContext(entry.context) && owned();
  }

  private async install(entry: Entry): Promise<void> {
    try {
      const Constructor = await this.load(entry.options.kind);
      if (!this.current(entry)) { this.release(entry); return; }
      if (typeof Constructor !== 'function') throw new Error('Map control is unavailable.');
      const control: unknown = new Constructor(entry.options.options);
      if (control === null || (typeof control !== 'object' && typeof control !== 'function')) throw new Error('Map control is unavailable.');
      entry.control = control as MapManagedControl;
      if (!this.current(entry)) { this.release(entry); return; }
      if (entry.options.kind === 'geolocate') {
        if (typeof entry.control.on !== 'function' || typeof entry.control.off !== 'function') throw new Error('Map control events are unavailable.');
        this.subscribe(entry, 'error', event => {
          if (!this.current(entry)) return;
          let code: unknown;
          try { if (event !== null && typeof event === 'object') code = (event as { readonly code?: unknown }).code; } catch { /* Native code unavailable. */ }
          if (this.current(entry)) entry.context.onEvent({ kind: 'geolocate-error', code: mapGeolocationErrorCode(code) });
        });
        if (!this.current(entry)) { this.release(entry); return; }
        this.subscribe(entry, 'outofmaxbounds', () => {
          if (this.current(entry)) entry.context.onEvent({ kind: 'geolocate-out-of-bounds', code: 'out-of-bounds' });
        });
        if (!this.current(entry)) { this.release(entry); return; }
        this.subscribe(entry, 'geolocate', event => {
          if (!this.current(entry)) return;
          const position = geolocatedPosition(event);
          if (this.current(entry)) entry.context.onEvent(Object.freeze({ kind: 'geolocate-success', ...position }));
        });
        if (!this.current(entry)) { this.release(entry); return; }
      }
      entry.attempted = true; entry.adding = true;
      try { entry.map.addControl(entry.control, entry.options.position); }
      finally {
        entry.adding = false;
        // Reentrant teardown during addControl cannot assume native installation has finished.
        if (entry.retired) this.retire(entry);
      }
      if (!this.current(entry)) { this.release(entry); return; }
      entry.installed = true;
    } catch {
      const report = this.current(entry);
      const generation = this.generation;
      this.release(entry);
      if (report && generation === this.generation && this.validContext(entry.context) && generation === this.generation) {
        try { entry.context.onFailure({ kind: entry.options.kind, code: 'control-failed' }); } catch { /* Caller owns feedback. */ }
      }
    }
  }

  private subscribe(entry: Entry, type: string, callback: (event: unknown) => void): void {
    // Journal before on(): it can register then throw or synchronously reenter teardown.
    entry.subscriptions.push({ type, callback });
    entry.subscribing = true;
    try { entry.control!.on!(type, callback); }
    finally { entry.subscribing = false; if (entry.retired) this.retire(entry); }
  }

  private release(entry: Entry): void {
    if (this.entries.get(entry.options.kind) === entry) this.entries.delete(entry.options.kind);
    this.retire(entry);
  }

  private retire(entry: Entry): void {
    entry.retired = true;
    if (entry.subscribing) return;
    const subscriptions = entry.subscriptions.splice(0);
    for (const { type, callback } of subscriptions) {
      try { entry.control?.off?.(type, callback); } catch { /* Continue retiring remaining exact subscriptions. */ }
    }
    if (!entry.attempted || entry.adding || entry.removed || !entry.control) return;
    entry.removed = true;
    try { entry.map.removeControl(entry.control); } catch { /* Native partial installation may already be removed. */ }
  }
}
