import { expect, fixture, fixtureCleanup, html, waitUntil } from '@open-wc/testing';
import { LyraMap, LYRA_MAP_EMPTY_STYLE } from './map.js';
import { loadMapOwnedFeatureRuntime } from './map-feature-loader.js';

interface SceneProperties {
  projection: 'mercator' | 'globe' | undefined;
  terrain: { readonly source: string; readonly exaggeration?: number } | null | undefined;
}
type SceneMapElement = LyraMap & SceneProperties;
class ScenePeer {
  readonly canvas = document.createElement('canvas');
  readonly listeners = new Map<string, Set<() => void>>();
  readonly writes: string[] = [];
  readonly preparations: unknown[] = [];
  ready = false;
  removed = false;
  gate?: Promise<void>;
  style: Record<string, unknown>;
  projection: unknown;
  terrain: unknown;
  constructor(options: { style: Record<string, unknown> }) {
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
    this.style = value; this.projection = value['projection']; this.terrain = value['terrain'] ?? null;
    this.ready = true; this.fire('style.load'); return this;
  }
}
const originalObserver = window.IntersectionObserver;
const originalContext = HTMLCanvasElement.prototype.getContext;
const baseline = () => ({ ...LYRA_MAP_EMPTY_STYLE, projection: { type: 'globe' }, sources: { elevation: { type: 'raster-dem', tiles: [] } }, terrain: { source: 'elevation', exaggeration: 2 } });
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

describe('lr-map typed scene configuration', () => {
  before(() => loadMapOwnedFeatureRuntime());
  beforeEach(() => {
    Object.defineProperty(window, 'IntersectionObserver', { configurable: true, value: undefined });
    Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', { configurable: true, writable: true,
      value(this: HTMLCanvasElement, id: string, ...rest: unknown[]) { return id === 'webgl2' ? {} : originalContext.call(this, id as never, ...(rest as [])); } });
  });
  afterEach(() => { fixtureCleanup(); Object.defineProperty(window, 'IntersectionObserver', { configurable: true, value: originalObserver }); HTMLCanvasElement.prototype.getContext = originalContext; });

  it('leaves existing style configuration and native setters untouched when unset', async () => {
    const { element, peer } = await mount(); await idle(element);
    expect(peer.writes).to.deep.equal([]); expect(peer.projection).to.deep.equal({ type: 'globe' });
    expect(peer.terrain).to.deep.equal({ source: 'elevation', exaggeration: 2 });
    expect(element.hasAttribute('projection')).to.equal(false);
  });
  it('captures an already-loaded baseline before first opt-in and restores it on release', async () => {
    const { element, peer } = await mount(); element.projection = 'mercator'; element.terrain = null; await idle(element);
    expect(peer.projection).to.deep.equal({ type: 'mercator' }); expect(peer.terrain).to.equal(null);
    expect(element.getAttribute('projection')).to.equal('mercator');
    element.projection = undefined; element.terrain = undefined; await idle(element);
    expect(peer.projection).to.deep.equal({ type: 'globe' }); expect(peer.terrain).to.deep.equal({ source: 'elevation', exaggeration: 2 });
    expect(element.hasAttribute('projection')).to.equal(false);
  });
  it('applies declarative overrides before style-ready and accepts finite exaggeration above ten', async () => {
    const { peer } = await mount(element => { element.projection = 'mercator'; element.terrain = { source: 'elevation', exaggeration: 12 }; });
    expect(peer.projection).to.deep.equal({ type: 'mercator' }); expect(peer.terrain).to.deep.equal({ source: 'elevation', exaggeration: 12 });
  });
  it('keeps style readiness settled while idle awaits a same-style scene update', async () => {
    const { element, peer } = await mount(); let release!: () => void;
    peer.gate = new Promise<void>(resolve => { release = resolve; }); element.projection = 'mercator';
    const ready = element.whenStyleReady(); let finished = false;
    await element.updateComplete; const pending = element.whenIdle().then(() => { finished = true; });
    await ready; await Promise.resolve(); expect(finished).to.equal(false);
    release(); await pending; expect(peer.projection).to.deep.equal({ type: 'mercator' });
  });
  it('normalizes attribute removal and invalid programmatic projection without reflecting undefined', async () => {
    const { element, peer } = await mount(); element.setAttribute('projection', 'mercator'); await idle(element);
    expect(peer.projection).to.deep.equal({ type: 'mercator' });
    Reflect.set(element, 'projection', 'invalid'); await idle(element);
    expect(element.projection).to.equal(undefined); expect(element.hasAttribute('projection')).to.equal(false);
    expect(peer.projection).to.deep.equal({ type: 'globe' });
  });
  it('uses the replacement style baseline when an override is later cleared', async () => {
    const { element, peer } = await mount(element => { element.projection = 'mercator'; });
    const projection = { type: ['interpolate', ['linear'], ['zoom'], 0, 'globe', 5, 'mercator'] };
    element.mapStyle = { ...baseline(), projection };
    await idle(element); expect(peer.projection).to.deep.equal({ type: 'mercator' });
    element.projection = undefined; await idle(element);
    expect(peer.projection).to.deep.equal(projection);
    expect(peer.preparations.some(value => JSON.stringify(value).includes('interpolate'))).to.equal(false);
  });
  it('validates a named elevation source beyond the public catalog prefix', async () => {
    const sources: Record<string, unknown> = {};
    for (let row = 0; row < 1025; row++) sources[`other-${row}`] = { type: 'vector' };
    sources['elevation'] = { type: 'raster-dem' };
    const { element, peer } = await mount(value => { value.mapStyle = { ...baseline(), sources }; });
    element.terrain = { source: 'elevation', exaggeration: 3 }; await idle(element);
    expect(peer.terrain).to.deep.equal({ source: 'elevation', exaggeration: 3 });
    expect(element.styleSources.some(source => source.id === 'elevation')).to.equal(false);
  });
  it('shows the localized fallback instead of exposing a partially configured map', async () => {
    const { element, peer } = await mount(); element.strings = { mapInitializationFailed: 'Scene unavailable' };
    element.terrain = { source: 'missing' };
    let error: unknown; try { await idle(element); } catch (failure) { error = failure; }
    await element.updateComplete;
    expect((error as Error).name).to.equal('MapReadinessError');
    expect(peer.removed).to.equal(true); expect(element.map === undefined).to.equal(true);
    expect(element.shadowRoot!.textContent).to.include('Scene unavailable');
    expect(peer.writes).to.deep.equal([]);
  });
  it('does not apply an obsolete preparation after disconnect', async () => {
    const { element, peer } = await mount(); let release!: () => void;
    peer.gate = new Promise<void>(resolve => { release = resolve; });
    element.projection = 'mercator'; await element.updateComplete;
    element.remove(); release(); await Promise.resolve(); await Promise.resolve();
    expect(peer.writes).to.deep.equal([]); expect(peer.removed).to.equal(true);
  });
  it('owns terrain data at assignment rather than after asynchronous preparation', async () => {
    const { element, peer } = await mount(); const terrain = { source: 'elevation', exaggeration: 3 };
    element.terrain = terrain; terrain.source = 'missing'; terrain.exaggeration = Number.NaN;
    await idle(element); expect(peer.terrain).to.deep.equal({ source: 'elevation', exaggeration: 3 });
  });

});
