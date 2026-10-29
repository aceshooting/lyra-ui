import { admitMapTerrain, mapScenePreparation, type LyraMapTerrain } from './map-scene-configuration.js';

export type MapSceneControlKind = 'globe' | 'terrain';
export interface MapSceneControlContext {
  readonly isCurrent: () => boolean;
  readonly state: (kind: MapSceneControlKind) => { readonly ready: boolean; readonly busy: boolean; readonly label: string };
  readonly unavailable: (kind: MapSceneControlKind, unavailable: boolean) => void;
}
export interface MapSceneControlActivation {
  readonly kind: MapSceneControlKind;
  readonly pressed: boolean | 'mixed';
  readonly terrain?: LyraMapTerrain;
}
interface ScenePeer {
  getCanvas(): HTMLCanvasElement;
  getStyle(): unknown;
  getProjection(): unknown;
  getTerrain(): unknown;
  setProjection?: unknown;
  setTerrain?: unknown;
  on(type: string, listener: () => void): unknown;
  off(type: string, listener: () => void): unknown;
}

/** DOM-only toggles. Scene changes belong to the host's declarative property controller. */
class SceneControl {
  private context?: MapSceneControlContext;
  private peer?: ScenePeer;
  private root?: HTMLElement;
  private button?: HTMLButtonElement;
  private pressed: boolean | 'mixed' = false;
  private queued = false;
  private generation = 0;
  private readonly listeners = new Set<(event: unknown) => void>();
  private readonly events = ['terrain', 'projectiontransition', 'style.load', 'sourcedata', 'idle'] as const;
  private readonly terrain?: LyraMapTerrain;
  constructor(private readonly kind: MapSceneControlKind, options?: Record<string, unknown>) {
    if (kind === 'terrain') this.terrain = admitMapTerrain(options) ?? undefined;
  }
  setSceneContext(context: MapSceneControlContext): void { this.context = context; this.refreshSceneControl(); }
  on(type: string, listener: (event: unknown) => void): void { if (type === 'activate') this.listeners.add(listener); }
  off(type: string, listener: (event: unknown) => void): void { if (type === 'activate') this.listeners.delete(listener); }
  onAdd(value: unknown): HTMLElement {
    const peer = value as ScenePeer;
    for (const name of ['getCanvas', 'getStyle', 'getProjection', 'getTerrain', 'on', 'off', this.kind === 'globe' ? 'setProjection' : 'setTerrain'] as const) {
      if (typeof peer?.[name] !== 'function') throw new TypeError('Scene control capability is unavailable');
    }
    this.peer = peer;
    const document = peer.getCanvas().ownerDocument;
    const root = document.createElement('div'); root.className = `maplibregl-ctrl maplibregl-ctrl-group map-scene-${this.kind}-control`; root.part.add(`${this.kind}-control`);
    const button = document.createElement('button'); button.type = 'button'; button.part.add(`${this.kind}-button`);
    const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    icon.setAttribute('viewBox', '0 0 24 24'); icon.setAttribute('aria-hidden', 'true'); icon.setAttribute('focusable', 'false');
    icon.setAttribute('part', `${this.kind}-icon`); icon.setAttribute('class', 'map-scene-control-icon');
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', this.kind === 'globe'
      ? 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM3 12h18M12 3c-5 5-5 13 0 18M12 3c5 5 5 13 0 18'
      : 'm2 20 7-13 4 7 3-5 6 11ZM6 13l3 2 2-2');
    icon.append(path); button.append(icon); root.append(button);
    this.root = root; this.button = button; button.addEventListener('click', this.activate);
    try { for (const event of this.events) peer.on(event, this.schedule); }
    catch (error) { this.onRemove(); throw error; }
    this.refreshSceneControl(); return root;
  }
  onRemove(): void {
    const peer = this.peer; this.peer = undefined; this.generation++;
    this.button?.removeEventListener('click', this.activate);
    for (const event of this.events) { try { peer?.off(event, this.schedule); } catch { /* Retire every subscription. */ } }
    this.root?.remove(); this.root = undefined; this.button = undefined; this.queued = false;
  }
  private current(): boolean { return !!this.peer && !!this.context?.isCurrent(); }
  private readonly schedule = (): void => {
    if (this.queued || !this.current()) return;
    this.queued = true; const generation = this.generation;
    queueMicrotask(() => { if (generation !== this.generation) return; this.queued = false; this.refreshSceneControl(); });
  };
  refreshSceneControl(): void {
    const context = this.context, button = this.button, peer = this.peer;
    if (!context || !button || !peer || !this.current()) return;
    const state = context.state(this.kind);
    if (!this.current()) return;
    let unavailable = false;
    if (state.ready && !state.busy) {
      try {
        if (this.kind === 'globe') {
          const projection = peer.getProjection() as { readonly type?: unknown } | undefined;
          const type = projection?.type;
          this.pressed = type === 'globe' ? true : type === 'mercator' || type === undefined ? false : 'mixed';
        } else {
          this.pressed = peer.getTerrain() != null;
          if (!this.pressed) {
            if (!this.terrain) unavailable = true;
            else mapScenePreparation(undefined, this.terrain, peer.getStyle());
          }
        }
      } catch { unavailable = true; }
    }
    if (!this.current()) return;
    button.setAttribute('aria-label', state.label); button.title = state.label;
    button.setAttribute('aria-pressed', String(this.pressed));
    button.setAttribute('aria-busy', String(state.busy));
    button.disabled = !state.ready || state.busy || unavailable;
    context.unavailable(this.kind, unavailable);
  }
  private readonly activate = (): void => {
    this.refreshSceneControl();
    if (!this.current() || !this.button || this.button.disabled) return;
    this.button.disabled = true; this.button.setAttribute('aria-busy', 'true');
    const event: MapSceneControlActivation = Object.freeze({ kind: this.kind, pressed: this.pressed, ...(this.terrain ? { terrain: this.terrain } : {}) });
    for (const listener of [...this.listeners]) {
      if (!this.current()) break;
      listener(event);
    }
    this.schedule();
  };
}
export class MapGlobeControl extends SceneControl { constructor(options?: Record<string, unknown>) { super('globe', options); } }
export class MapTerrainControl extends SceneControl { constructor(options?: Record<string, unknown>) { super('terrain', options); } }
