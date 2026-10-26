import { deepActiveElementIn } from '../../../internal/active-element.js';
import { mapGeolocationErrorCode, type LyraMapGeolocationErrorCode, type MapOwnedControlKind, type LyraMapControlPosition,
  type NormalizedMapControlOptions } from './map-control-options.js';

export interface MapManagedControl {
  onAdd?(...args: unknown[]): HTMLElement;
  on?(type: string, callback: (event: unknown) => void): unknown;
  off?(type: string, callback: (event: unknown) => void): unknown;
}
export type MapManagedControlConstructor = new (options?: Record<string, unknown>) => unknown;
export interface MapControlLifecyclePeer {
  addControl(control: MapManagedControl, position: LyraMapControlPosition): unknown;
  removeControl(control: MapManagedControl): unknown;
  /** Native corner containers, used to move owned roots without recreating controls. */
  controlContainer?(position: LyraMapControlPosition): HTMLElement | undefined;
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
  options: NormalizedMapControlOptions;
  root?: HTMLElement;
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
      if (entry.map === map && entry.installed && next && (next.key === entry.options.key ||
        (entry.root && map.controlContainer && JSON.stringify(next.options) === JSON.stringify(entry.options.options)))) {
        entry.context = context; entry.options = next;
      }
      else { this.entries.delete(kind); retired.push(entry); }
    }
    for (const entry of retired) this.retire(entry);
    if (generation !== this.generation || !this.validContext(context) || generation !== this.generation) return;
    const pending: Entry[] = [];
    // Start every import together, but never let completion order determine native insertion.
    for (const [kind, options] of desired) {
      if (generation !== this.generation) break;
      if (this.entries.has(kind)) continue;
      const entry: Entry = { map, options, context, installed: false, attempted: false, adding: false, subscribing: false,
        removed: false, retired: false, subscriptions: [] };
      this.entries.set(kind, entry); pending.push(entry);
    }
    const loaded = await Promise.all(pending.map(async entry => {
      try { return await this.load(entry.options.kind); } catch { return undefined; }
    }));
    if (generation !== this.generation || !this.validContext(context)) return;
    const constructors = new Map(pending.map((entry, index) => [entry, loaded[index]]));
    const priority: readonly MapOwnedControlKind[] = ['navigation', 'scale', 'geolocate', 'attribution'];
    for (const corner of ['top-left', 'top-right', 'bottom-left', 'bottom-right'] as const) {
      const ordered = priority.map(kind => this.entries.get(kind)).filter((entry): entry is Entry =>
        entry !== undefined && entry.options.position === corner).sort((a, b) => a.options.order - b.options.order);
      const order = corner.startsWith('bottom') ? ordered.reverse() : ordered;
      for (const entry of order) {
        if (generation !== this.generation || !this.validContext(context)) return;
        if (constructors.has(entry)) this.install(entry, constructors.get(entry));
      }
    }
    // Native bottom corners prepend; the resulting DOM and keyboard order is always top-to-bottom.
    for (const corner of ['top-left', 'top-right', 'bottom-left', 'bottom-right'] as const) {
      if (generation !== this.generation || !this.validContext(context)) return;
      const entries = priority.map(kind => this.entries.get(kind)).filter((entry): entry is Entry =>
        entry !== undefined && entry.installed && entry.options.position === corner).sort((a, b) => a.options.order - b.options.order);
      for (let index = entries.length - 1; index >= 0; index--) {
        const entry = entries[index]!;
        if (generation !== this.generation || !this.current(entry)) return;
        try {
          const parent = map.controlContainer?.(corner);
          if (generation !== this.generation || !this.current(entry)) return;
          if (!parent || !entry.root) continue;
          const before = entries.slice(index + 1).find(next => next.root?.parentNode === parent)?.root ?? null;
          const root = entry.root;
          if (root.parentNode === parent && (before ? root.nextSibling === before : root.nextSibling === null)) continue;
          const tree = root.getRootNode() as Document | ShadowRoot;
          const active = tree.activeElement;
          const focus = active instanceof HTMLElement && root.contains(active) ? active : undefined;
          if (generation !== this.generation || !this.current(entry)) return;
          const document = root.ownerDocument;
          let focusTransferred = false;
          const trackFocus = (): void => { focusTransferred = true; };
          if (focus) document.addEventListener('focus', trackFocus, true);
          try { parent.insertBefore(root, before); }
          finally { if (focus) document.removeEventListener('focus', trackFocus, true); }
          if (generation !== this.generation || !this.current(entry)) return;
          const remaining = deepActiveElementIn(document);
          const lostFocus = remaining === null || remaining === document.body || remaining === document.documentElement;
          // Repair only removal-induced loss; a callback's new focus target takes precedence.
          if (focus?.isConnected && root.contains(focus) && focus.ownerDocument === document && !focusTransferred && lostFocus) {
            focus.focus({ preventScroll: true });
          }
          if (generation !== this.generation || !this.current(entry)) return;
        } catch {
          if (generation === this.generation && this.current(entry)) {
            try { entry.context.onFailure({ kind: entry.options.kind, code: 'control-failed' }); } catch { /* Caller owns feedback. */ }
          }
        }
      }
    }
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

  private install(entry: Entry, Constructor: MapManagedControlConstructor | null | undefined): void {
    try {
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
      const onAdd = entry.control.onAdd;
      if (!this.current(entry)) { this.release(entry); return; }
      const descriptor = Object.getOwnPropertyDescriptor(entry.control, 'onAdd');
      if (!this.current(entry)) { this.release(entry); return; }
      try {
        // Public native lifecycle hook yields the exact owned root; no private peer fields are read.
        if (onAdd) entry.control.onAdd = function (...args: unknown[]): HTMLElement {
          const root = onAdd.apply(this, args); entry.root = root; return root;
        };
        if (!this.current(entry)) { this.release(entry); return; }
        entry.attempted = true; entry.adding = true;
        entry.map.addControl(entry.control, entry.options.position);
      } finally {
        try {
          if (onAdd) {
            if (descriptor) Object.defineProperty(entry.control, 'onAdd', descriptor);
            else delete entry.control.onAdd;
          }
        } finally {
          entry.adding = false;
          // Reentrant teardown during addControl cannot assume native installation has finished.
          if (entry.retired) this.retire(entry);
        }
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
