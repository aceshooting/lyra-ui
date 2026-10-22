import type { LyraMapFeatureState, LyraMapFeatureIdentifier } from '../src/components/media/map/map-feature-state.js';

// A scripted engine for lr-map component suites: native controls, owned sources/layers, feature
// state, camera and hit queries without a WebGL context. Suites configure statics on a subclass.
export class FakeMapControl {
  readonly listeners = new Map<string, Set<(event: unknown) => void>>();
  removed = false;
  constructor(readonly options?: Record<string, unknown>) {}
  on(type: string, callback: (event: unknown) => void) { let set = this.listeners.get(type); if (!set) this.listeners.set(type, set = new Set()); set.add(callback); }
  off(type: string, callback: (event: unknown) => void) { this.listeners.get(type)?.delete(callback); }
  fire(type: string, event: unknown = {}) { for (const callback of [...this.listeners.get(type) ?? []]) callback(event); }
}
export class FakeGeolocateControl extends FakeMapControl {}
export class FakeAttributionControl extends FakeMapControl {}
export class ControlMapEngine {
  projected?: { x: number; y: number };
  beforeProject?: () => void;
  project(_coordinate: [number, number]) {
    this.beforeProject?.(); const container = this.options['container'] as HTMLElement;
    return this.projected ?? { x: container.clientWidth / 2, y: container.clientHeight / 2 };
  }
  static initialZoomGesture = true;
  zoomGesture = (this.constructor as typeof ControlMapEngine).initialZoomGesture;
  gestureCalls: string[] = [];
  readonly doubleClickZoom = {
    isEnabled: () => this.zoomGesture,
    disable: () => { this.gestureCalls.push('disable'); this.zoomGesture = false; },
    enable: () => { this.gestureCalls.push('enable'); this.zoomGesture = true; this.afterZoomEnable?.(); },
  };
  afterPanEnable?: () => void;
  afterZoomEnable?: () => void;
  panEnabled = true;
  readonly panCalls: string[] = [];
  readonly dragPan = {
    isEnabled: () => this.panEnabled,
    disable: () => { this.panCalls.push('disable'); this.panEnabled = false; },
    enable: () => { this.panCalls.push('enable'); this.panEnabled = true; this.afterPanEnable?.(); },
  };
  hits: unknown[] = [];
  queryCount = 0;
  queryError = false;
  stateError = false;
  beforeQuery?: () => void;
  beforeGetSource?: () => void;
  beforeGetCenter?: () => void;
  afterAddSource?: () => void;
  afterSetState?: () => void;
  beforeRemoveSource?: (id: string) => void;
  readonly sourceDescriptors = new Map<string, unknown>();
  readonly images = new Map<string, ImageData>();
  readonly nativeStates = new Map<string, Record<string, unknown>>();
  readonly stateCalls: { kind: string; target: LyraMapFeatureIdentifier; key?: string }[] = [];
  order: string[] = [];
  getStyle() { return { sources: Object.fromEntries(this.sourceDescriptors), layers: this.order.map(id => this.layers.get(id)) }; }
  moveLayer(id: string, before?: string) { this.order = this.order.filter(value => value !== id); this.order.splice(before ? this.order.indexOf(before) : this.order.length, 0, id); }
  hasImage(id: string) { return this.images.has(id); }
  addImage(id: string, pixels: ImageData) { this.images.set(id, pixels); }
  removeImage(id: string) { this.images.delete(id); }
  triggerRepaint() { this.scheduleIdle(); }
  private scheduleIdle(): void { queueMicrotask(() => { if (!this.removed) { this.idle = true; this.fire('idle'); } }); }
  setFeatureState(target: LyraMapFeatureIdentifier, state: LyraMapFeatureState) {
    if (this.stateError) throw new Error('Private native state failure');
    const key = JSON.stringify([target.source, target.sourceLayer ?? null, target.id]);
    this.nativeStates.set(key, { ...this.nativeStates.get(key), ...state }); this.stateCalls.push({ kind: 'set', target });
    this.afterSetState?.();
  }
  removeFeatureState(target: LyraMapFeatureIdentifier, key: string) {
    const state = this.nativeStates.get(JSON.stringify([target.source, target.sourceLayer ?? null, target.id]));
    if (state) delete state[key]; this.stateCalls.push({ kind: 'remove', target, key });
  }
  static initialReady = false;
  static prepare: ((requirements: unknown) => Promise<void>) | undefined;
  readonly listeners = new Map<string, Set<(event: Record<string, unknown>) => void>>();
  readonly canvas = document.createElement('canvas');
  readonly sources = new Map<string, { setData: (data: unknown) => void; updateData: (data: unknown) => void }>();
  readonly layers = new Map<string, unknown>();
  ready = (this.constructor as typeof ControlMapEngine).initialReady;
  idle = false;
  synchronousStyle = true;
  removed = false;
  center = { lng: 0, lat: 0 };
  zoom = 2;
  bearing = 0; pitch = 0; fits = 0;
  bounds: [[number, number], [number, number]] | null = null;
  readonly controls = new Set<FakeMapControl>();
  constructor(readonly options: Record<string, unknown>) {
    const center = options['center'] as [number, number]; this.center = { lng: center[0], lat: center[1] };
    this.zoom = options['zoom'] as number; this.bearing = options['bearing'] as number ?? 0; this.pitch = options['pitch'] as number ?? 0;
  }
  getBearing() { return this.bearing; }
  getPitch() { return this.pitch; }
  addControl(control: FakeMapControl) { this.controls.add(control); }
  removeControl(control: FakeMapControl) { this.controls.delete(control); control.removed = true; }
  fitBounds() { this.fits++; }
  setMaxBounds(bounds: [[number, number], [number, number]] | null) {
    this.bounds = bounds;
    if (bounds) this.center = { lng: Math.min(bounds[1][0], Math.max(bounds[0][0], this.center.lng)), lat: Math.min(bounds[1][1], Math.max(bounds[0][1], this.center.lat)) };
  }
  on(type: string, listener: (event: Record<string, unknown>) => void): this {
    const listeners = this.listeners.get(type) ?? new Set();
    this.listeners.set(type, listeners); listeners.add(listener); return this;
  }
  off(type: string, listener: (event: Record<string, unknown>) => void): this {
    this.listeners.get(type)?.delete(listener); return this;
  }
  once(type: string, listener: (event: Record<string, unknown>) => void): this {
    const run = (event: Record<string, unknown>) => { this.off(type, run); listener(event); };
    return this.on(type, run);
  }
  fire(type: string, event: Record<string, unknown> = {}): void {
    for (const listener of [...(this.listeners.get(type) ?? [])]) listener({ type, ...event });
  }
  isStyleLoaded(): boolean { return this.ready; }
  loaded(): boolean { return this.idle; }
  isMoving(): boolean { return false; }
  getCanvas(): HTMLCanvasElement { return this.canvas; }
  getCenter() { this.beforeGetCenter?.(); return this.center; }
  getZoom(): number { return this.zoom; }
  setCenter(value: [number, number]): void { this.center = { lng: value[0], lat: value[1] }; this.idle = false; }
  setZoom(value: number): void { this.zoom = value; this.idle = false; }
  jumpTo(options: { center?: [number, number]; zoom?: number; bearing?: number; pitch?: number }, data: Record<string, unknown> = {}): void {
    this.idle = false; this.fire('movestart');
    if (options.center) this.setCenter(options.center);
    if (options.zoom !== undefined) this.setZoom(options.zoom);
    if (options.bearing !== undefined) this.bearing = options.bearing;
    if (options.pitch !== undefined) this.pitch = options.pitch;
    this.setMaxBounds(this.bounds);
    this.fire('moveend', data);
  }
  resize(): void {}
  remove(): void { this.removed = true; this.listeners.clear(); }
  setStyle(): this {
    this.sources.clear(); this.layers.clear(); this.sourceDescriptors.clear(); this.nativeStates.clear(); this.order = []; this.idle = false;
    this.ready = this.synchronousStyle;
    if (this.ready) this.fire('style.load');
    return this;
  }
  prepareFeatures(requirements: unknown): Promise<void> { return (this.constructor as typeof ControlMapEngine).prepare?.(requirements) ?? Promise.resolve(); }
  getSource(id: string) { this.beforeGetSource?.(); return this.sources.get(id); }
  addSource(id: string, source?: unknown): this { this.sourceDescriptors.set(id, source); this.idle = false; this.sources.set(id, { setData: () => { this.idle = false; this.scheduleIdle(); }, updateData: () => { this.idle = false; this.scheduleIdle(); } }); this.afterAddSource?.(); this.scheduleIdle(); return this; }
  removeSource(id: string): this { this.beforeRemoveSource?.(id); this.sources.delete(id); this.sourceDescriptors.delete(id); this.scheduleIdle(); return this; }
  getLayer(id: string): unknown { return this.layers.get(id); }
  addLayer(layer: { id: string }, before?: string): this { this.layers.set(layer.id, layer); this.order.splice(before ? this.order.indexOf(before) : this.order.length, 0, layer.id); this.scheduleIdle(); return this; }
  removeLayer(id: string): this { this.layers.delete(id); this.order = this.order.filter(value => value !== id); this.scheduleIdle(); return this; }
  setPaintProperty(): this { return this; }
  queryRenderedFeatures(_point: unknown, options: { layers: readonly string[] }): unknown[] {
    this.queryCount++; this.beforeQuery?.(); if (this.queryError) throw new Error('Private native failure');
    return this.hits.filter(value => {
      if (value === null || typeof value !== 'object') return true;
      const layer = Object.getOwnPropertyDescriptor(value, 'layer');
      if (!layer || !Object.hasOwn(layer, 'value')) return true;
      const id = Object.getOwnPropertyDescriptor(layer.value as object, 'id');
      return !id || typeof id.value !== 'string' || options.layers.includes(id.value);
    });
  }
}
