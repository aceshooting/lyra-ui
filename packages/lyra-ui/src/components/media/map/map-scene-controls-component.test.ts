import { expect, fixture, fixtureCleanup, html, waitUntil } from '@open-wc/testing';
import { LyraMap, LYRA_MAP_EMPTY_STYLE } from './map.js';
import { loadMapOwnedFeatureRuntime, loadMapControlRuntime } from './map-feature-loader.js';

interface SceneProperties {
  projection: 'mercator' | 'globe' | undefined;
  terrain: { readonly source: string; readonly exaggeration?: number } | null | undefined;
}
type SceneMapElement = LyraMap & SceneProperties;
class ScenePeer {
  readonly canvas = document.createElement('canvas');
  readonly listeners = new Map<string, Set<() => void>>();
  readonly roots = new Map<object, HTMLElement>();
  addControl(control: { onAdd(map: ScenePeer): HTMLElement }): this { const root = control.onAdd(this); this.roots.set(control, root); this.canvas.parentNode?.append(root); return this; }
  removeControl(control: { onRemove?(): void }): this { this.roots.get(control)?.remove(); this.roots.delete(control); control.onRemove?.(); return this; }
  getContainer(): HTMLElement { return this.canvas.parentElement!; }
  readonly writes: string[] = [];
  readonly preparations: unknown[] = [];
  ready = false;
  removed = false;
  gate?: Promise<void>;
  deferStyle = false;
  pendingStyle?: Record<string, unknown>;
  style: Record<string, unknown>;
  projection: unknown;
  terrain: unknown;
  constructor(options: { style: Record<string, unknown>; container: HTMLElement }) {
    options.container.append(this.canvas);
    this.style = options.style; this.projection = this.style['projection']; this.terrain = this.style['terrain'] ?? null;
  }
  on(type: string, listener: () => void): this { const set = this.listeners.get(type) ?? new Set(); set.add(listener); this.listeners.set(type, set); return this; }
  off(type: string, listener: () => void): this { this.listeners.get(type)?.delete(listener); return this; }
  once(type: string, listener: () => void): this { const run = () => { this.off(type, run); listener(); }; return this.on(type, run); }
  fire(type: string): void { for (const listener of [...(this.listeners.get(type) ?? [])]) listener(); }
  getCanvas(): HTMLCanvasElement { return this.canvas; }
  getCenter() { return { lng: 0, lat: 0 }; }
  getZoom(): number { return 2; }
  setCenter(): void {}
  setZoom(): void {}
  resize(): void {}
  isStyleLoaded(): boolean { return this.ready; }
  loaded(): boolean { return this.ready; }
  isMoving(): boolean { return false; }
  getStyle(): Record<string, unknown> { return { ...this.style, projection: this.projection, terrain: this.terrain }; }
  getProjection(): unknown { return this.projection; }
  getTerrain(): unknown { return this.terrain; }
  setProjection(value: unknown): this { this.writes.push('projection'); this.projection = value; return this; }
  setTerrain(value: unknown): this { this.writes.push('terrain'); this.terrain = value; return this; }
  prepareFeatures(value: unknown): Promise<void> { this.preparations.push(value); return this.gate ?? Promise.resolve(); }
  getSource(): undefined { return undefined; }
  getLayer(): undefined { return undefined; }
  queryRenderedFeatures(): unknown[] { return []; }
  remove(): void { this.removed = true; this.listeners.clear(); }
  setStyle(value: Record<string, unknown>): this {
    if (this.deferStyle) { this.ready = false; this.pendingStyle = value; return this; }
    this.style = value; this.projection = value['projection']; this.terrain = value['terrain'] ?? null;
    this.ready = true; this.fire('style.load'); return this;
  }
}
const originalObserver = window.IntersectionObserver;
const originalContext = HTMLCanvasElement.prototype.getContext;
const baseline = () => ({ ...LYRA_MAP_EMPTY_STYLE, projection: { type: 'mercator' }, sources: { elevation: { type: 'raster-dem', tiles: [] } }, terrain: null });
async function mount(configure?: (element: SceneMapElement) => void) {
  const wrapper = await fixture<HTMLDivElement>(html`<div></div>`);
  const element = document.createElement('lr-map') as SceneMapElement;
  element.mapStyle = baseline(); element.controls = { attribution: false };
  (element as unknown as { loadLibrary: () => Promise<unknown> }).loadLibrary = async () => ({ Map: ScenePeer });
  configure?.(element); wrapper.append(element);
  await waitUntil(() => element.map !== undefined);
  const peer = element.map as unknown as ScenePeer;
  peer.ready = true; peer.fire('load');
  await element.whenStyleReady(); await element.updateComplete;
  return { element, peer };
}
async function idle(element: SceneMapElement) { await element.updateComplete; await element.whenIdle(); }

const configure = (element: SceneMapElement) => { element.controls = { attribution: false, globe: true, terrain: { source: 'elevation', exaggeration: 12 } } as unknown as NonNullable<LyraMap['controls']>; };
function button(element: SceneMapElement, kind: string): HTMLButtonElement {
  const result = element.shadowRoot!.querySelector<HTMLButtonElement>(`[part~="${kind}-button"]`);
  expect(result !== null, `${kind} control installed`).to.equal(true); return result!;
}
async function ready(element: SceneMapElement) { await element.updateComplete; await element.whenControlsReady(); await idle(element); }
describe('lr-map component-owned scene controls', () => {
  before(async () => { await loadMapOwnedFeatureRuntime(); await loadMapControlRuntime(); });
  beforeEach(() => {
    Object.defineProperty(window, 'IntersectionObserver', { configurable: true, value: undefined });
    Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', { configurable: true, writable: true,
      value(this: HTMLCanvasElement, id: string, ...rest: unknown[]) { return id === 'webgl2' ? {} : originalContext.call(this, id as never, ...(rest as [])); } });
  });
  afterEach(() => { fixtureCleanup(); Object.defineProperty(window, 'IntersectionObserver', { configurable: true, value: originalObserver }); HTMLCanvasElement.prototype.getContext = originalContext; });
  it('installs named controls without acquiring scene overrides or preparing features', async () => {
    const { element, peer } = await mount(); await ready(element);
    const preparations = [...peer.preparations]; configure(element); await ready(element);
    expect(button(element, 'globe').getAttribute('aria-pressed')).to.equal('false');
    expect(button(element, 'terrain').getAttribute('aria-pressed')).to.equal('false');
    expect(button(element, 'globe').getAttribute('aria-label')).to.equal('Globe');
    expect(element.projection).to.equal(undefined); expect(element.terrain).to.equal(undefined);
    expect(peer.writes).to.deep.equal([]); expect(peer.preparations).to.deep.equal(preparations);
  });
  it('keeps both controls disabled while a replacement style is uncommitted', async () => {
    const { element, peer } = await mount(configure); await ready(element);
    peer.deferStyle = true; element.mapStyle = { ...baseline() }; await element.updateComplete;
    expect(button(element, 'globe').disabled).to.equal(true);
    expect(button(element, 'terrain').disabled).to.equal(true);
    button(element, 'globe').click(); expect(element.projection).to.equal(undefined);
    peer.deferStyle = false; peer.setStyle(peer.pendingStyle!); await idle(element);
    expect(button(element, 'globe').disabled).to.equal(false);
    expect(button(element, 'terrain').disabled).to.equal(false);
  });
  it('assigns before its request event and permits synchronous controlled reassertion', async () => {
    const { element, peer } = await mount(configure); await ready(element); let events = 0;
    element.addEventListener('lr-map-projection-change', event => {
      events++; expect(element.projection).to.equal('globe'); expect(peer.writes).to.deep.equal([]);
      expect((event as CustomEvent).detail).to.deep.equal({ projection: 'globe', source: 'control' });
      element.projection = 'mercator';
    });
    button(element, 'globe').click(); expect(events).to.equal(1); await idle(element);
    expect(peer.projection).to.deep.equal({ type: 'mercator' });
    expect(button(element, 'globe').getAttribute('aria-pressed')).to.equal('false');
  });
  it('updates literal and expression state on idle without a projection transition', async () => {
    const { element, peer } = await mount(configure); await ready(element);
    peer.projection = { type: ['interpolate', ['linear'], ['zoom'], 0, 'globe', 10, 'mercator'] }; peer.fire('idle');
    await waitUntil(() => button(element, 'globe').getAttribute('aria-pressed') === 'mixed');
    peer.projection = { type: 'globe', transition: { duration: 200 } }; peer.fire('idle');
    await waitUntil(() => button(element, 'globe').getAttribute('aria-pressed') === 'true');
    expect(element.projection).to.equal(undefined);
  });
  it('disables busy controls immediately and emits one detached terrain request', async () => {
    const { element, peer } = await mount(configure); await ready(element); let release!: () => void;
    peer.gate = new Promise(resolve => { release = resolve; }); const events: unknown[] = [];
    element.addEventListener('lr-map-terrain-change', event => { events.push((event as CustomEvent).detail); });
    const target = button(element, 'terrain'); target.click(); target.click();
    expect(events).to.deep.equal([{ terrain: { source: 'elevation', exaggeration: 12 }, source: 'control' }]);
    expect(target.disabled).to.equal(true); expect(target.getAttribute('aria-busy')).to.equal('true');
    await element.updateComplete; release(); await idle(element);
    expect(target.disabled).to.equal(false); expect(target.getAttribute('aria-pressed')).to.equal('true');
    expect(peer.terrain).to.deep.equal({ source: 'elevation', exaggeration: 12 });
  });
  it('keeps a missing enable source unavailable while allowing active terrain to be disabled', async () => {
    const { element, peer } = await mount(configure); await ready(element);
    peer.style = { ...peer.style, sources: {} }; peer.fire('sourcedata');
    await waitUntil(() => button(element, 'terrain').disabled);
    peer.terrain = { source: 'another', exaggeration: 2 }; peer.fire('terrain');
    await waitUntil(() => !button(element, 'terrain').disabled);
    button(element, 'terrain').click(); await idle(element);
    expect(element.terrain).to.equal(null); expect(peer.terrain).to.equal(null);
  });
  it('rejects a missing scene capability through controls readiness without retiring the map', async () => {
    const { element, peer } = await mount(); await ready(element);
    Reflect.set(peer, 'setProjection', undefined); configure(element); await element.updateComplete;
    let failed = false; try { await element.whenControlsReady(); } catch { failed = true; }
    expect(failed).to.equal(true); expect(peer.removed).to.equal(false); expect(peer.writes).to.deep.equal([]);
    expect(element.shadowRoot!.querySelector('[part~="globe-button"]')).to.equal(null);
  });
  it('recovers a directly addressed source beyond the public catalog cap without mutating the scene', async () => {
    const { element, peer } = await mount(configure); await ready(element);
    peer.style = { ...peer.style, sources: {} }; peer.fire('sourcedata');
    await waitUntil(() => button(element, 'terrain').disabled);
    const sources: Record<string, unknown> = {};
    for (let index = 0; index < 1040; index++) sources[`source-${index}`] = { type: 'geojson', data: { type: 'FeatureCollection', features: [] } };
    sources['elevation'] = { type: 'raster-dem' }; peer.style = { ...peer.style, sources }; peer.fire('sourcedata');
    await waitUntil(() => !button(element, 'terrain').disabled);
    expect(element.terrain).to.equal(undefined); expect(peer.writes).to.deep.equal([]);
  });
  it('retires removed and disconnected control callbacks', async () => {
    const { element } = await mount(configure); await ready(element); const old = button(element, 'globe');
    element.controls = { attribution: false }; await element.updateComplete; await element.whenControlsReady();
    old.click(); expect(element.projection).to.equal(undefined);
    configure(element); await element.updateComplete; await element.whenControlsReady();
    const next = button(element, 'globe'); element.remove(); next.click(); expect(element.projection).to.equal(undefined);
  });
  it('refreshes localized labels on retained roots and emits nothing for programmatic state', async () => {
    const { element } = await mount(configure); await ready(element); const globe = button(element, 'globe'); let events = 0;
    element.addEventListener('lr-map-projection-change', () => { events++; });
    element.strings = { mapGlobe: 'Planet', mapTerrain: 'Elevation' }; element.projection = 'globe'; await idle(element);
    expect(button(element, 'globe') === globe).to.equal(true); expect(globe.getAttribute('aria-label')).to.equal('Planet');
    expect(globe.getAttribute('aria-pressed')).to.equal('true'); expect(events).to.equal(0);
  });

});
