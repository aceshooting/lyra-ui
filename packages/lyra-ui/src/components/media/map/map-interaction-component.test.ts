import { expect, fixture, fixtureCleanup, html, waitUntil } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import type { LyraMapFeatureState, LyraMapFeatureIdentifier } from './map-feature-state.js';
import './map.js';
import { LYRA_MAP_EMPTY_STYLE, type LyraMap } from './map.js';
import { loadMapFeatureStateRuntime } from './map-feature-loader.js';

class Control {
  readonly listeners = new Map<string, Set<(event: unknown) => void>>();
  removed = false;
  constructor(readonly options?: Record<string, unknown>) {}
  on(type: string, callback: (event: unknown) => void) { let set = this.listeners.get(type); if (!set) this.listeners.set(type, set = new Set()); set.add(callback); }
  off(type: string, callback: (event: unknown) => void) { this.listeners.get(type)?.delete(callback); }
  fire(type: string, event: unknown = {}) { for (const callback of [...this.listeners.get(type) ?? []]) callback(event); }
}
class Geolocate extends Control {}
class Attribution extends Control {}
class ControlMap {
  hits: unknown[] = [];
  queryCount = 0;
  queryPoint?: unknown;
  queryError = false;
  stateError = false;
  beforeQuery?: () => void;
  beforeGetSource?: () => void;
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
  triggerRepaint() {}
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
  static prepare: (() => Promise<void>) | undefined;
  readonly listeners = new Map<string, Set<(event: Record<string, unknown>) => void>>();
  readonly canvas = document.createElement('canvas');
  readonly sources = new Map<string, { setData: (data: unknown) => void; updateData: (data: unknown) => void }>();
  readonly layers = new Map<string, unknown>();
  ready = ControlMap.initialReady;
  idle = false;
  synchronousStyle = true;
  removed = false;
  center = { lng: 0, lat: 0 };
  zoom = 2;
  bearing = 0; pitch = 0; fits = 0;
  bounds: [[number, number], [number, number]] | null = null;
  readonly controls = new Set<Control>();
  constructor(readonly options: Record<string, unknown>) {
    const center = options['center'] as [number, number]; this.center = { lng: center[0], lat: center[1] };
    this.zoom = options['zoom'] as number; this.bearing = options['bearing'] as number ?? 0; this.pitch = options['pitch'] as number ?? 0;
  }
  getBearing() { return this.bearing; }
  getPitch() { return this.pitch; }
  addControl(control: Control) { this.controls.add(control); }
  removeControl(control: Control) { this.controls.delete(control); control.removed = true; }
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
  getCenter() { return this.center; }
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
  prepareFeatures(): Promise<void> { return ControlMap.prepare?.() ?? Promise.resolve(); }
  getSource(id: string) { this.beforeGetSource?.(); return this.sources.get(id); }
  addSource(id: string, source?: unknown): this { this.sourceDescriptors.set(id, source); this.idle = false; this.sources.set(id, { setData: () => { this.idle = false; }, updateData: () => { this.idle = false; } }); return this; }
  removeSource(id: string): this { this.beforeRemoveSource?.(id); this.sources.delete(id); this.sourceDescriptors.delete(id); return this; }
  getLayer(id: string): unknown { return this.layers.get(id); }
  addLayer(layer: { id: string }, before?: string): this { this.layers.set(layer.id, layer); this.order.splice(before ? this.order.indexOf(before) : this.order.length, 0, layer.id); return this; }
  removeLayer(id: string): this { this.layers.delete(id); this.order = this.order.filter(value => value !== id); return this; }
  setPaintProperty(): this { return this; }
  queryRenderedFeatures(point: unknown, options: { layers: readonly string[] }): unknown[] {
    this.queryPoint = point;
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

const originalObserver = window.IntersectionObserver;
const originalContext = HTMLCanvasElement.prototype.getContext;
let originalUrl: string;
let originalState: unknown;
async function mount(configure: (element: LyraMap) => void = () => undefined) {
  const wrapper = await fixture<HTMLDivElement>(html`<div></div>`);
  const element = document.createElement('lr-map') as LyraMap;
  element.engine = 'maplibre'; element.mapStyle = LYRA_MAP_EMPTY_STYLE;
  (element as unknown as { loadLibrary: () => Promise<unknown> }).loadLibrary = async () => ({ Map: ControlMap, GeolocateControl: Geolocate, AttributionControl: Attribution });
  configure(element); wrapper.append(element);
  await waitUntil(() => element.map !== undefined); await element.updateComplete;
  const peer = element.map as unknown as ControlMap;
  peer.fire('load'); await element.updateComplete; await element.whenStyleReady();
  return { element, peer, wrapper };
}

const POINTS = { type: 'FeatureCollection' as const, features: [{ type: 'Feature' as const, id: 0, properties: { name: 'Point' }, geometry: { type: 'Point' as const, coordinates: [1, 2] } }] };
const row = (sourceId = 'points') => ({ sourceId, geojson: POINTS });
const address = (id: string | number = 0) => ({ source: 'points', id });
function circle(peer: ControlMap, source?: string): string {
  const found = [...peer.layers].find(([, value]) => {
    const layer = value as Record<string, unknown>; return layer['type'] === 'circle' && (!source || layer['source'] === source);
  });
  if (!found) throw new Error('Expected generated circle layer'); return found[0];
}
function hit(peer: ControlMap, layerId = circle(peer), id: string | number = 0) {
  const layer = peer.layers.get(layerId) as Record<string, unknown>;
  return { type: 'Feature', id, source: layer['source'], layer: { id: layerId }, properties: { name: 'Point' }, geometry: { type: 'Point', coordinates: [1, 2] } };
}
function fire(peer: ControlMap, kind = 'click') { peer.fire(kind, { point: { x: 1, y: 2 }, lngLat: { lng: 1, lat: 2 } }); }
function capture(element: LyraMap, type: string): unknown[] {
  const events: unknown[] = []; element.addEventListener(type, event => { events.push((event as CustomEvent).detail); }); return events;
}
async function restore(element: LyraMap) { await element.updateComplete; await element.whenStyleReady(); await element.updateComplete; }
async function idle(element: LyraMap, peer: ControlMap) { peer.idle = true; peer.fire('idle'); await element.whenIdle(); }

describe('lr-map interaction and retained state integration', () => {
  // Exercises the steady state after the on-demand runtime has loaded; map-lazy-runtimes.test.ts covers the loading itself.
  before(() => loadMapFeatureStateRuntime());
  beforeEach(() => {
    originalUrl = location.href; originalState = history.state; ControlMap.initialReady = true; ControlMap.prepare = undefined;
    Object.defineProperty(window, 'IntersectionObserver', { configurable: true, value: undefined });
    Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', { configurable: true, writable: true,
      value(this: HTMLCanvasElement, id: string, ...rest: unknown[]) { return id === 'webgl2' ? {} : originalContext.call(this, id as never, ...(rest as [])); } });
  });
  afterEach(() => {
    fixtureCleanup(); history.replaceState(originalState, '', originalUrl);
    Object.defineProperty(window, 'IntersectionObserver', { configurable: true, value: originalObserver });
    HTMLCanvasElement.prototype.getContext = originalContext;
  });

  it('keeps unset picking/state opt-ins and preserves a background click without querying absent layers', async () => {
    const { element, peer } = await mount(); const clicks = capture(element, 'lr-map-click'), picks = capture(element, 'lr-map-pick'); fire(peer);
    expect(peer.queryCount).to.equal(0); expect(clicks.length).to.equal(1); expect(picks.length).to.equal(0);
    expect(element.shadowRoot!.querySelector('[part="pick-center"]') === null).to.equal(true); expect(peer.stateCalls.length).to.equal(0);
    expect(element.setFeatureState(address(), { selected: true })).to.equal(false);
  });
  it('queries once and preserves raw legacy click fields alongside a frozen public hit/target', async () => {
    const { element, peer } = await mount(el => { el.dataLayers = [row()]; });
    const raw = hit(peer); peer.hits = [raw]; const clicks = capture(element, 'lr-map-click'); fire(peer);
    expect(peer.queryPoint).to.deep.equal([1, 2]);
    expect(peer.queryCount).to.equal(1); const detail = clicks[0] as { feature: unknown; origin: string; sourceId: string; hit: object; target: unknown };
    expect(detail.feature === raw).to.equal(true); expect(detail.origin).to.equal('data-layer'); expect(detail.sourceId).to.equal('points');
    expect(detail.target).to.deep.equal({ origin: 'data-layer', source: 'points', id: 0 }); expect(Object.isFrozen(detail.hit)).to.equal(true);
  });
  it('chooses explicit priority over native order and skips disabled interaction rows', async () => {
    const { element, peer } = await mount(el => { el.dataLayers = [{ ...row('low'), priority: 0 }, { ...row('high'), priority: 5 }, { ...row('off'), interactive: false, priority: 99 }]; });
    const circles = [...peer.layers].filter(([, layer]) => (layer as Record<string, unknown>)['type'] === 'circle').map(([id]) => id);
    peer.hits = [hit(peer, circles[0]!), hit(peer, circles[2]!), hit(peer, circles[1]!)]; const clicks = capture(element, 'lr-map-click'); fire(peer);
    expect(peer.queryCount).to.equal(1); expect((clicks[0] as { sourceId: string }).sourceId).to.equal('high');
  });
  it('applies owned overlay interaction metadata without querying a disabled basemap opt-in', async () => {
    const { element, peer } = await mount(el => {
      el.dataLayers = [row()]; el.overlays = { sources: [{ id: 'extra', source: { type: 'geojson', data: POINTS } }],
        layers: [{ layer: { id: 'extra-layer', type: 'circle', source: 'extra' }, priority: 10 }] };
      el.interactiveBasemapLayers = [{ layerId: 'unowned', interactive: false }];
    });
    peer.hits = [hit(peer), hit(peer, 'extra-layer', 'overlay-id')]; const clicks = capture(element, 'lr-map-click'); fire(peer);
    expect((clicks[0] as { hit: { origin: string; source: string } }).hit).to.include({ origin: 'overlay', source: 'extra' }); expect(peer.queryCount).to.equal(1);
  });
  it('does not dispatch a background click or context menu for malformed/error query results', async () => {
    const { element, peer } = await mount(el => { el.dataLayers = [row()]; }); const clicks = capture(element, 'lr-map-click'), menus = capture(element, 'lr-map-contextmenu');
    peer.hits = [null]; fire(peer); fire(peer, 'contextmenu'); peer.hits = []; peer.queryError = true; fire(peer); fire(peer, 'contextmenu');
    expect(clicks.length).to.equal(0); expect(menus.length).to.equal(0); expect(peer.queryCount).to.equal(4);
  });
  it('does not publish a hit/background after a query synchronously disconnects its owner', async () => {
    const { element, peer } = await mount(el => { el.dataLayers = [row()]; }); const clicks = capture(element, 'lr-map-click');
    peer.hits = [hit(peer)]; peer.beforeQuery = () => element.remove(); fire(peer); expect(clicks.length).to.equal(0); expect(peer.removed).to.equal(true);
  });
  it('bounds a recursively reentered native query and publishes neither the nested nor stale outer click', async () => {
    const { element, peer } = await mount(el => { el.dataLayers = [row()]; }); const clicks = capture(element, 'lr-map-click');
    peer.hits = [hit(peer)]; peer.beforeQuery = () => fire(peer); fire(peer);
    expect(peer.queryCount).to.equal(1); expect(clicks.length).to.equal(0);
  });
  it('emits a context menu with one query and preserves native context-menu default behavior', async () => {
    const { element, peer } = await mount(el => { el.dataLayers = [row()]; }); peer.hits = [hit(peer)]; const menus = capture(element, 'lr-map-contextmenu');
    let prevented = false; peer.fire('contextmenu', { point: { x: 1, y: 2 }, lngLat: { lng: 1, lat: 2 }, preventDefault: () => { prevented = true; } });
    expect(peer.queryCount).to.equal(1); expect(menus.length).to.equal(1); expect(prevented).to.equal(false);
    expect((menus[0] as { hit: { source: string } }).hit.source).to.equal('points');
  });
  it('retains numeric zero and string IDs separately and waits for idle after native replay', async () => {
    const { element, peer } = await mount(el => { el.dataLayers = [row()]; });
    expect(element.setFeatureState(address(0), { selected: true })).to.equal(true); expect(element.setFeatureState(address('0'), { selected: false })).to.equal(true);
    await idle(element, peer); expect(element.getFeatureState(address(0))).to.deep.equal({ selected: true }); expect(element.getFeatureState(address('0'))).to.deep.equal({ selected: false });
    expect(peer.stateCalls.filter(call => call.kind === 'set').map(call => call.target.id)).to.deep.equal([0, '0']);
  });
  it('rejects ambiguous logical sources until origin is explicit', async () => {
    const { element } = await mount(el => {
      el.dataLayers = [row()]; el.overlays = { sources: [{ id: 'points', source: { type: 'geojson', data: POINTS } }],
        layers: [{ layer: { id: 'owned-points', type: 'circle', source: 'points' } }] };
    });
    expect(element.setFeatureState(address(), { selected: true })).to.equal(false);
    expect(element.setFeatureState({ ...address(), origin: 'overlay' }, { selected: true })).to.equal(true);
    expect(element.getFeatureState({ ...address(), origin: 'overlay' })).to.deep.equal({ selected: true });
  });
  it('requires a vector source layer for retained state and exposes it in public hit targets', async () => {
    const { element, peer } = await mount(el => { el.dataLayers = [{ kind: 'vector', sourceId: 'roads', source: { tiles: ['https://example.test/{z}/{x}/{y}.pbf'] }, sourceLayer: 'transport', render: 'line' }]; });
    expect(element.setFeatureState({ source: 'roads', id: 0 }, { selected: true })).to.equal(false);
    expect(element.setFeatureState({ source: 'roads', sourceLayer: 'transport', id: 0 }, { selected: true })).to.equal(true);
    expect(peer.stateCalls[0]!.target.sourceLayer).to.equal('transport');
    const layer = [...peer.layers.keys()][0]!; peer.hits = [hit(peer, layer)]; const clicks = capture(element, 'lr-map-click'); fire(peer);
    expect((clicks[0] as { target: unknown }).target).to.deep.equal({ origin: 'data-layer', source: 'roads', sourceLayer: 'transport', id: 0 });
  });
  it('admits native basemap state and queries only after explicit layer opt-in', async () => {
    const { element, peer } = await mount(); peer.addSource('basemap', { type: 'geojson', data: POINTS }); peer.addLayer({ id: 'base-circle', type: 'circle', source: 'basemap' } as { id: string });
    expect(element.setFeatureState({ origin: 'basemap', source: 'basemap', id: 0 }, { selected: true })).to.equal(false);
    element.interactiveBasemapLayers = [{ layerId: 'base-circle' }]; await restore(element);
    expect(element.setFeatureState({ origin: 'basemap', source: 'basemap', id: 0 }, { selected: true })).to.equal(true);
    peer.hits = [hit(peer, 'base-circle')]; const clicks = capture(element, 'lr-map-click'); fire(peer);
    expect((clicks[0] as { hit: { origin: string; source: string } }).hit).to.include({ origin: 'basemap', source: 'basemap' }); expect(peer.queryCount).to.equal(1);
  });
  it('rejects all retained targets atomically above 256 basemap sources while keeping hit queries usable', async () => {
    const { element, peer } = await mount(); const layers = [];
    for (let index = 0; index < 257; index++) {
      const source = `base-${index}`, layerId = `base-layer-${index}`;
      peer.addSource(source, { type: 'geojson', data: POINTS }); peer.addLayer({ id: layerId, type: 'circle', source } as { id: string }); layers.push({ layerId });
    }
    element.interactiveBasemapLayers = layers; await restore(element);
    expect(element.setFeatureState({ origin: 'basemap', source: 'base-0', id: 0 }, { selected: true })).to.equal(false);
    expect(element.setFeatureState({ origin: 'basemap', source: 'base-256', id: 0 }, { selected: true })).to.equal(false);
    const clicks = capture(element, 'lr-map-click'); peer.hits = [hit(peer, 'base-layer-0')]; fire(peer);
    expect(element.map === (peer as unknown)).to.equal(true); expect(peer.removed).to.equal(false); expect(peer.queryCount).to.equal(1);
    expect((clicks[0] as { hit: { source: string; target?: unknown } }).hit).to.include({ source: 'base-0' }); expect((clicks[0] as { hit: { target?: unknown } }).hit.target).to.equal(undefined);
  });
  it('rejects the whole retained-source aggregate above one MiB without disabling admitted hit routes', async () => {
    const { element, peer } = await mount(); const layers = [];
    for (let index = 0; index < 18; index++) {
      const source = `large-${index}`, layerId = `large-layer-${index}`;
      const data = { type: 'FeatureCollection', features: [{ type: 'Feature', id: 0, properties: { text: 'x'.repeat(63_000) }, geometry: { type: 'Point', coordinates: [1, 2] } }] };
      peer.addSource(source, { type: 'geojson', data }); peer.addLayer({ id: layerId, type: 'circle', source } as { id: string }); layers.push({ layerId });
    }
    element.interactiveBasemapLayers = layers; await restore(element);
    expect(element.setFeatureState({ origin: 'basemap', source: 'large-0', id: 0 }, { selected: true })).to.equal(false);
    expect(element.setFeatureState({ origin: 'basemap', source: 'large-17', id: 0 }, { selected: true })).to.equal(false);
    const clicks = capture(element, 'lr-map-click'); peer.hits = [hit(peer, 'large-layer-0')]; fire(peer);
    expect(peer.removed).to.equal(false); expect(peer.queryCount).to.equal(1); expect((clicks[0] as { hit: { source: string } }).hit.source).to.equal('large-0');
  });
  it('rejects accessors and oversized state atomically and returns frozen detached snapshots', async () => {
    const { element } = await mount(el => { el.dataLayers = [row()]; }); let reads = 0; const state = { nested: { values: [1, 2] } };
    expect(element.setFeatureState(address(), state)).to.equal(true); state.nested.values[0] = 9;
    expect(element.setFeatureState(address(), { get secret() { reads++; return 'unsafe'; } })).to.equal(false);
    expect(element.setFeatureState(address(), { text: 'x'.repeat(4097) })).to.equal(false); expect(reads).to.equal(0);
    const retained = element.getFeatureState(address())!; expect(retained).to.deep.equal({ nested: { values: [1, 2] } }); expect(Object.isFrozen(retained['nested'])).to.equal(true);
  });
  it('retains state and sanitized idle failure until a fresh style after native retry succeeds', async () => {
    const { element, peer } = await mount(el => { el.dataLayers = [row()]; }); peer.stateError = true;
    expect(element.setFeatureState(address(), { selected: true })).to.equal(true);
    let failure: unknown;
    try { await element.whenIdle(); } catch (error) { failure = error; }
    expect(failure instanceof Error).to.equal(true); expect(String(failure)).not.to.include('Private native state failure');
    await element.updateComplete; expect(element.shadowRoot!.textContent).not.to.include('Private native state failure');
    expect(element.getFeatureState(address())).to.deep.equal({ selected: true }); peer.stateError = false;
    expect(element.setFeatureState(address(), { selected: true })).to.equal(true);
    expect(peer.stateCalls.some(call => call.kind === 'set')).to.equal(true); expect(element.getFeatureState(address())).to.deep.equal({ selected: true });
    let stillFailed = false; try { await element.whenIdle(); } catch { stillFailed = true; } expect(stillFailed).to.equal(true);
    element.mapStyle = { ...LYRA_MAP_EMPTY_STYLE }; await restore(element); await idle(element, peer);
  });
  it('invalidates semantic state before the native source-removal callback runs', async () => {
    const { element, peer } = await mount(el => { el.dataLayers = [row()]; }); element.setFeatureState(address(), { selected: true }); let removals = 0;
    peer.beforeRemoveSource = () => { removals++; expect(element.getFeatureState(address())).to.equal(undefined); };
    element.dataLayers = []; await restore(element); expect(removals).to.equal(1); expect(peer.sources.size).to.equal(0);
  });
  it('invalidates old overlay state before native same-ID source replacement', async () => {
    const owned = (data: unknown, tolerance = 0.375) => ({ sources: [{ id: 'owned', source: { type: 'geojson', data, tolerance } }], layers: [{ layer: { id: 'owned-circle', type: 'circle', source: 'owned' } }] });
    const { element, peer } = await mount(el => { el.overlays = owned(POINTS); });
    const source = peer.getSource('owned'); expect(source !== undefined).to.equal(true);
    const target = { origin: 'overlay' as const, source: 'owned', id: 0 }; expect(element.setFeatureState(target, { selected: true })).to.equal(true);
    let removals = 0; peer.beforeRemoveSource = id => { if (id === 'owned') { removals++; expect(element.getFeatureState(target)).to.equal(undefined); } };
    element.overlays = owned({ type: 'FeatureCollection', features: [] }, 0.5); await restore(element); await idle(element, peer);
    expect(removals).to.equal(1); expect(element.getFeatureState(target)).to.equal(undefined); expect(peer.sources.has('owned')).to.equal(true);
    expect(peer.getSource('owned') === source).to.equal(false);
  });
  it('stops replay before a native state mutation when getSource synchronously changes style or disconnects', async () => {
    for (const disconnect of [false, true]) {
      const { element, peer } = await mount(el => { el.dataLayers = [row()]; });
      peer.beforeGetSource = () => { peer.beforeGetSource = undefined; if (disconnect) element.remove(); else element.mapStyle = { ...LYRA_MAP_EMPTY_STYLE }; };
      element.setFeatureState(address(), { selected: true }); expect(peer.stateCalls.length).to.equal(0);
      if (disconnect) expect(peer.removed).to.equal(true); else { await restore(element); element.remove(); }
    }
  });
  it('rejects a state target whose descriptor reflection schedules a source mutation', async () => {
    const { element, peer } = await mount(el => { el.dataLayers = [row()]; });
    const target = new Proxy(address(), { getOwnPropertyDescriptor(value, key) {
      if (key === 'id') element.dataLayers = []; return Reflect.getOwnPropertyDescriptor(value, key);
    } });
    expect(element.setFeatureState(target, { selected: true })).to.equal(false); expect(peer.stateCalls.length).to.equal(0);
    await restore(element); expect(element.getFeatureState(address())).to.equal(undefined);
  });
  it('stops later state writes when a native state callback disconnects during style replay', async () => {
    const { element, peer } = await mount(el => { el.dataLayers = [row()]; });
    element.setFeatureState(address(0), { selected: true }); element.setFeatureState(address(1), { selected: true }); const writes = peer.stateCalls.length;
    peer.afterSetState = () => { peer.afterSetState = undefined; element.remove(); };
    element.mapStyle = { ...LYRA_MAP_EMPTY_STYLE }; const restoration = element.whenStyleReady().catch(() => undefined);
    await element.updateComplete; await waitUntil(() => peer.removed); await restoration;
    expect(peer.stateCalls.length - writes).to.equal(1);
  });
  it('replays retained semantic state after a style reset recreates native sources', async () => {
    const { element, peer } = await mount(el => { el.dataLayers = [row()]; }); element.setFeatureState(address(), { selected: true }); const writes = peer.stateCalls.length;
    element.mapStyle = { ...LYRA_MAP_EMPTY_STYLE }; await restore(element); await idle(element, peer);
    expect(peer.stateCalls.length).to.be.greaterThan(writes); expect(element.getFeatureState(address())).to.deep.equal({ selected: true });
    expect([...peer.nativeStates.values()].some(state => state['selected'] === true)).to.equal(true);
  });
  it('removes only owned state keys and preserves unrelated native state', async () => {
    const { element, peer } = await mount(el => { el.dataLayers = [row()]; }); element.setFeatureState(address(), { selected: true });
    const native = [...peer.nativeStates.values()][0]!; native['external'] = 'kept'; expect(element.removeFeatureState(address(), 'selected')).to.equal(true); await idle(element, peer);
    expect(native['selected']).to.equal(undefined); expect(native['external']).to.equal('kept'); expect(peer.stateCalls.at(-1)?.key).to.equal('selected');
  });
  it('reports typed pointer transitions once and restores external cursor priority on pointer cancellation', async () => {
    const { element, peer } = await mount(el => { el.dataLayers = [row()]; }); const enters = capture(element, 'lr-map-feature-enter'), leaves = capture(element, 'lr-map-feature-leave');
    peer.hits = [hit(peer, circle(peer), 0)]; fire(peer, 'mousemove'); fire(peer, 'mousemove'); expect(enters.length).to.equal(1); expect(peer.canvas.style.cursor).to.equal('pointer');
    peer.hits = [hit(peer, circle(peer), '0')]; fire(peer, 'mousemove'); expect(enters.length).to.equal(2); expect(leaves.length).to.equal(1);
    peer.canvas.style.setProperty('cursor', 'pointer', 'important'); peer.canvas.dispatchEvent(new Event('pointercancel'));
    expect(leaves.length).to.equal(2); expect(peer.canvas.style.getPropertyPriority('cursor')).to.equal('important');
  });
  it('treats every anonymous pointer hit as fresh without inventing a retained identity', async () => {
    const { element, peer } = await mount(el => { el.dataLayers = [row()]; });
    const { id: _id, ...anonymous } = hit(peer); peer.hits = [anonymous];
    const order: string[] = [], details: unknown[] = [];
    element.addEventListener('lr-map-feature-enter', event => { order.push('enter'); details.push((event as CustomEvent).detail); });
    element.addEventListener('lr-map-feature-leave', () => { order.push('leave'); });
    fire(peer, 'mousemove'); fire(peer, 'mousemove'); expect(order).to.deep.equal(['enter', 'leave', 'enter']);
    const feature = (details[1] as { hit: Record<string, unknown> }).hit;
    expect(Object.hasOwn(feature, 'id')).to.equal(false); expect(Object.hasOwn(feature, 'target')).to.equal(false);
  });
  it('blocks feature/pick dispatch from inert ancestors and clears existing hover', async () => {
    const { element, peer, wrapper } = await mount(el => { el.dataLayers = [row()]; }); peer.hits = [hit(peer)];
    const clicks = capture(element, 'lr-map-click'), leaves = capture(element, 'lr-map-feature-leave'); fire(peer, 'mousemove'); wrapper.inert = true; fire(peer);
    expect(clicks.length).to.equal(0); expect(leaves.length).to.equal(1); expect(peer.canvas.style.cursor).to.equal('');
  });
  it('picks a pointer location instead of dispatching an ordinary click', async () => {
    const { element, peer } = await mount(el => { el.dataLayers = [row()]; el.pickMode = true; }); peer.hits = [hit(peer)];
    const picks = capture(element, 'lr-map-pick'), clicks = capture(element, 'lr-map-click'); fire(peer);
    expect(clicks.length).to.equal(0); expect(picks.length).to.equal(1); expect((picks[0] as { trigger: string }).trigger).to.equal('pointer'); expect(peer.queryCount).to.equal(1);
  });
  it('offers localized keyboard picking at the current center and keyboard cancellation', async () => {
    const { element, peer } = await mount(el => { el.pickMode = true; el.strings = { mapPickAtCenter: 'Pick current center', mapCancelPick: 'Stop picking' }; });
    const picks = capture(element, 'lr-map-pick');
    await waitUntil(() => Boolean(element.shadowRoot!.querySelector('[part="pick-center"]')));
    const button = element.shadowRoot!.querySelector<HTMLButtonElement>('[part="pick-center"]')!;
    expect(button.textContent).to.equal('Pick current center'); await focusByKeyboard(button); await sendKeys({ press: 'Enter' });
    expect(picks).to.deep.equal([{ lngLat: [peer.center.lng, peer.center.lat], trigger: 'keyboard' }]);
    const cancel = element.shadowRoot!.querySelector<HTMLButtonElement>('[part="pick-cancel"]')!;
    expect(cancel.textContent).to.equal('Stop picking'); await focusByKeyboard(cancel); await sendKeys({ press: 'Enter' }); await element.updateComplete; expect(element.pickMode).to.equal(false);
  });
  it('provides English pick actions and keeps long localized actions inside a 320px allocation', async () => {
    const { element } = await mount(el => { el.pickMode = true; el.style.inlineSize = '320px'; el.style.maxInlineSize = '320px'; });
    await waitUntil(() => Boolean(element.shadowRoot!.querySelector('[part="pick-center"]')));
    const center = element.shadowRoot!.querySelector<HTMLButtonElement>('[part="pick-center"]')!, cancel = element.shadowRoot!.querySelector<HTMLButtonElement>('[part="pick-cancel"]')!;
    expect(center.textContent).to.equal('Pick at map center'); expect(cancel.textContent).to.equal('Cancel picking'); await expect(element).to.be.accessible();
    element.strings = { mapPickAtCenter: 'Choose the location at the center of this map with the keyboard', mapCancelPick: 'Cancel the current location selection and continue exploring' };
    await element.updateComplete;
    const allocation = element.getBoundingClientRect();
    for (const button of [center, cancel]) {
      const box = button.getBoundingClientRect(); expect(box.width).to.be.greaterThan(0); expect(box.left).to.be.at.least(allocation.left - 1); expect(box.right).to.be.at.most(allocation.right + 1);
    }
    await expect(element).to.be.accessible();
  });
  it('updates initially inert pick actions and cursor when its ancestor becomes interactive', async () => {
    const wrapper = await fixture<HTMLDivElement>(html`<div inert></div>`); const element = document.createElement('lr-map') as LyraMap;
    element.engine = 'maplibre'; element.mapStyle = LYRA_MAP_EMPTY_STYLE; element.pickMode = true;
    (element as unknown as { loadLibrary: () => Promise<unknown> }).loadLibrary = async () => ({ Map: ControlMap, AttributionControl: Attribution });
    wrapper.append(element); await waitUntil(() => element.map !== undefined); const peer = element.map as unknown as ControlMap;
    peer.fire('load'); await restore(element);
    const center = element.shadowRoot!.querySelector<HTMLButtonElement>('[part="pick-center"]')!, cancel = element.shadowRoot!.querySelector<HTMLButtonElement>('[part="pick-cancel"]')!;
    expect(center.disabled).to.equal(true); expect(cancel.disabled).to.equal(true); expect(peer.canvas.style.cursor).to.equal('');
    wrapper.inert = false;
    await waitUntil(() => !center.disabled && !cancel.disabled && peer.canvas.style.cursor === 'crosshair');
    expect(element.pickMode).to.equal(true);
  });
});
