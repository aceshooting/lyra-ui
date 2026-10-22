import { expect, fixture, fixtureCleanup, html, waitUntil } from '@open-wc/testing';
import './map.js';
import { LYRA_MAP_EMPTY_STYLE, type LyraMap } from './map.js';

class OwnedMap {
  static initialReady = false;
  static prepare: ((requirements: unknown) => Promise<void>) | undefined;
  readonly listeners = new Map<string, Set<(event: Record<string, unknown>) => void>>();
  readonly canvas = document.createElement('canvas');
  readonly sources = new Map<string, { setData: (data: unknown) => void; updateData: (data: unknown) => void }>();
  readonly layers = new Map<string, unknown>();
  readonly images = new Map<string, ImageData>();
  sourceDescriptors = new Map<string, unknown>();
  order: string[] = [];
  readonly paint = new Map<string, unknown>();
  ready = OwnedMap.initialReady;
  idle = false;
  synchronousStyle = true;
  removed = false;
  center = { lng: 0, lat: 0 };
  zoom = 2;
  constructor(readonly options: Record<string, unknown>) {}
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
  jumpTo(options: { center?: [number, number]; zoom?: number }): void {
    this.idle = false; this.fire('movestart');
    if (options.center) this.setCenter(options.center);
    if (options.zoom !== undefined) this.setZoom(options.zoom);
    this.fire('moveend');
  }
  resize(): void {}
  remove(): void { this.removed = true; this.listeners.clear(); }
  setStyle(): this {
    this.sources.clear(); this.layers.clear(); this.images.clear(); this.sourceDescriptors.clear(); this.order = []; this.idle = false;
    this.ready = this.synchronousStyle;
    if (this.ready) this.fire('style.load');
    return this;
  }
  prepareFeatures(requirements: unknown): Promise<void> { return OwnedMap.prepare?.(requirements) ?? Promise.resolve(); }
  getSource(id: string) { return this.sources.get(id); }
  addSource(id: string, source: unknown): this { this.sourceDescriptors.set(id, source); this.idle = false; this.sources.set(id, { setData: () => { this.idle = false; }, updateData: () => { this.idle = false; } }); return this; }
  removeSource(id: string): this { this.sources.delete(id); return this; }
  getLayer(id: string): unknown { return this.layers.get(id); }
  addLayer(layer: { id: string }, before?: string): this { this.layers.set(layer.id, layer); this.order.splice(before ? this.order.indexOf(before) : this.order.length, 0, layer.id); return this; }
  removeLayer(id: string): this { this.layers.delete(id); this.order = this.order.filter(value => value !== id); return this; }
  setPaintProperty(id: string, key: string, value: unknown): this { this.paint.set(`${id}:${key}`, value); return this; }
  getPaintProperty(id: string, key: string): unknown { return this.paint.get(`${id}:${key}`); }
  getLayoutProperty(): unknown { return undefined; }
  setLayoutProperty(): this { return this; }
  triggerRepaint(): void {}
  getStyle() { return { layers: this.order.map(id => ({ id })) }; }
  moveLayer(id: string, before?: string): void { this.order = this.order.filter(value => value !== id); this.order.splice(before ? this.order.indexOf(before) : this.order.length, 0, id); }
  hasImage(id: string): boolean { return this.images.has(id); }
  addImage(id: string, pixels: ImageData): void { this.images.set(id, pixels); }
  removeImage(id: string): void { this.images.delete(id); }
  queryRenderedFeatures(): unknown[] { return []; }
}

const originalObserver = window.IntersectionObserver;
const originalContext = HTMLCanvasElement.prototype.getContext;
const POINTS = { type: 'FeatureCollection' as const, features: [
  { type: 'Feature' as const, properties: {}, geometry: { type: 'Point' as const, coordinates: [1, 2] } },
] };

async function mount(configure?: (element: LyraMap) => void) {
  const wrapper = await fixture<HTMLDivElement>(html`<div></div>`);
  const element = document.createElement('lr-map') as LyraMap;
  element.mapStyle = LYRA_MAP_EMPTY_STYLE;
  (element as unknown as { loadLibrary: () => Promise<unknown> }).loadLibrary = async () => ({ Map: OwnedMap });
  configure?.(element); wrapper.append(element);
  await waitUntil(() => element.map !== undefined, 'map did not initialize');
  await element.updateComplete;
  return { element, peer: element.map as unknown as OwnedMap, wrapper };
}

async function load(element: LyraMap, peer: OwnedMap) {
  peer.ready = true; peer.fire('load'); await element.whenStyleReady();
}

describe('lr-map declarative owned resources', () => {
  beforeEach(() => {
    OwnedMap.initialReady = false; OwnedMap.prepare = undefined;
    Object.defineProperty(window, 'IntersectionObserver', { configurable: true, value: undefined });
    Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', { configurable: true, writable: true,
      value(this: HTMLCanvasElement, id: string, ...rest: unknown[]) {
        return id === 'webgl2' ? {} : originalContext.call(this, id as never, ...(rest as []));
      } });
  });
  afterEach(() => {
    fixtureCleanup();
    Object.defineProperty(window, 'IntersectionObserver', { configurable: true, value: originalObserver });
    HTMLCanvasElement.prototype.getContext = originalContext;
  });

  it('restores native canvas identity and custom layers before publishing each style readiness', async () => {
    const canvas = document.createElement('canvas'); const events: boolean[] = [];
    const { element, peer } = await mount(el => {
      el.overlays = { sources: [{ id: 'raster', source: { type: 'canvas', canvas, coordinates: [[0, 1], [1, 1], [1, 0], [0, 0]] } }],
        layers: [{ layer: { id: 'coverage', type: 'raster', source: 'raster' } }] };
      el.addEventListener('lr-map-style-load', () => { events.push((el.map as unknown as OwnedMap).layers.has('coverage')); });
    });
    await load(element, peer);
    expect((peer.sourceDescriptors.get('raster') as { canvas: HTMLCanvasElement }).canvas === canvas).to.equal(true);
    element.mapStyle = { version: 8, sources: {}, layers: [] }; await element.whenStyleReady();
    expect(events).to.deep.equal([true, true]);
    expect((peer.sourceDescriptors.get('raster') as { canvas: HTMLCanvasElement }).canvas === canvas).to.equal(true);
  });

  it('holds style, idle and native load until actual custom feature preparation finishes', async () => {
    let release!: () => void; let customPreparing = false; let loads = 0; let styles = 0;
    const pending = new Promise<void>(resolve => { release = resolve; });
    OwnedMap.prepare = async requirements => {
      if ((requirements as { sources?: Record<string, unknown> }).sources?.['custom']) { customPreparing = true; await pending; }
    };
    const { element, peer } = await mount(el => {
      el.overlays = { sources: [{ id: 'custom', source: { type: 'geojson', data: POINTS } }],
        layers: [{ layer: { id: 'dots', type: 'circle', source: 'custom' } }] };
      el.addEventListener('lr-map-load', () => { loads += 1; }); el.addEventListener('lr-map-style-load', () => { styles += 1; });
    });
    peer.ready = true; peer.fire('load'); await waitUntil(() => customPreparing);
    peer.idle = true; peer.fire('idle'); await Promise.resolve();
    expect(loads).to.equal(0); expect(styles).to.equal(0); expect(peer.layers.has('dots')).to.equal(false);
    release(); await element.whenStyleReady(); expect(styles).to.equal(1); expect(loads).to.equal(1);
    peer.idle = true; peer.fire('idle'); await element.whenIdle();
    element.overlays = {}; const idle = element.whenIdle(); await element.updateComplete;
    await waitUntil(() => !peer.layers.has('dots')); peer.idle = true; peer.fire('idle'); await idle;
  });

  it('keeps registered source and layer ownership when a later choropleth requests the same IDs', async () => {
    const { element, peer } = await mount(el => {
      el.overlays = { sources: [{ id: 'shared', source: { type: 'geojson', data: POINTS } }],
        layers: [{ layer: { id: 'shared-fill', type: 'fill', source: 'shared' } }] };
    });
    await load(element, peer);
    const source = peer.sources.get('shared')!; const layer = peer.layers.get('shared-fill'); let writes = 0;
    source.setData = () => { writes += 1; }; source.updateData = () => { writes += 1; };
    element.choropleth = { sourceId: 'shared', geojson: POINTS, field: 'value', stops: [[0, 'red'], [1, 'blue']] };
    await element.updateComplete; await waitUntil(() => peer.sources.size === 2);
    peer.idle = true; peer.fire('idle'); await element.whenIdle();
    expect(peer.sources.get('shared') === source).to.equal(true);
    expect(peer.layers.get('shared-fill') === layer).to.equal(true);
    expect(peer.paint.has('shared-fill:fill-color')).to.equal(false); expect(writes).to.equal(0);
    element.choropleth = undefined; await element.updateComplete;
    await waitUntil(() => peer.sources.size === 1);
    expect(peer.sources.get('shared') === source).to.equal(true);
    expect(peer.layers.get('shared-fill') === layer).to.equal(true); expect(writes).to.equal(0);
    element.overlays = {}; await element.updateComplete;
    await waitUntil(() => peer.sources.size === 0); expect(peer.layers.size).to.equal(0);
  });

  it('keeps default registered layer placement above newly added generated layers', async () => {
    const { element, peer } = await mount(el => {
      el.overlays = { layers: [{ layer: { id: 'top', type: 'background' } }] };
    });
    await load(element, peer); expect(peer.order).to.deep.equal(['top']);
    element.choropleth = { sourceId: 'future', geojson: POINTS, field: 'value', stops: [[0, 'red'], [1, 'blue']] };
    await element.updateComplete;
    await waitUntil(() => peer.layers.has('future-fill'));
    peer.idle = true; peer.fire('idle'); await element.whenIdle();
    expect(peer.order).to.deep.equal(['future-fill', 'top']);
  });

  it('preserves event-only idle evidence for equal owned-property writes during an unrelated update', async () => {
    let preparations = 0; let styles = 0; let idles = 0;
    OwnedMap.prepare = async () => { preparations += 1; };
    const { element, peer } = await mount(el => {
      el.addEventListener('lr-map-style-load', () => { styles += 1; });
      el.addEventListener('lr-map-idle', () => { idles += 1; });
    });
    await load(element, peer); Object.defineProperty(peer, 'loaded', { value: undefined });
    peer.fire('idle'); await element.whenIdle(); const before = preparations;
    element.label = 'Updated map label';
    element.overlays = element.overlays; element.images = element.images; element.styleOverrides = element.styleOverrides;
    await element.updateComplete;
    let settled = false; void element.whenIdle().then(() => { settled = true; });
    await waitUntil(() => settled, 'equal assignments discarded current idle evidence');
    expect(preparations).to.equal(before); expect(styles).to.equal(1); expect(idles).to.equal(1);
    expect(peer.sources.size).to.equal(0); expect(peer.layers.size).to.equal(0); expect(peer.images.size).to.equal(0);
  });

  it('prepares a real portable SVG image and retains its pixels across style replacement', async () => {
    const { element, peer } = await mount(el => {
      el.images = [{ id: 'pin', source: { kind: 'svg', markup: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 4 4"><rect width="4" height="4" fill="red"/></svg>' }, width: 4, height: 4, pixelRatio: 1 }];
      el.overlays = { layers: [{ layer: { id: 'background', type: 'background' } }] };
    });
    await load(element, peer); const pixels = peer.images.get('pin');
    expect(pixels?.width).to.equal(4); expect(pixels?.data[0]).to.equal(255);
    element.mapStyle = { version: 8, sources: {}, layers: [] }; await element.whenStyleReady();
    expect(peer.images.get('pin') === pixels).to.equal(true);
    element.images = []; await element.updateComplete;
    await waitUntil(() => !peer.images.has('pin'));
  });

  it('ignores obsolete custom preparation while following a newer same-style assignment', async () => {
    let release!: () => void; let oldPreparing = false;
    const pending = new Promise<void>(resolve => { release = resolve; });
    OwnedMap.prepare = async requirements => {
      if ((requirements as { sources?: Record<string, unknown> }).sources?.['old']) { oldPreparing = true; await pending; }
    };
    const { element, peer } = await mount(el => {
      el.overlays = { sources: [{ id: 'old', source: { type: 'geojson', data: POINTS } }],
        layers: [{ layer: { id: 'old-layer', type: 'circle', source: 'old' } }] };
    });
    peer.ready = true; peer.fire('load'); await waitUntil(() => oldPreparing);
    element.overlays = { sources: [{ id: 'new', source: { type: 'geojson', data: POINTS } }],
      layers: [{ layer: { id: 'new-layer', type: 'circle', source: 'new' } }] };
    await element.whenStyleReady(); release(); await Promise.resolve();
    expect(peer.layers.has('new-layer')).to.equal(true); expect(peer.layers.has('old-layer')).to.equal(false);
  });

  it('uses localized visible failure for invalid images and rejects readiness', async () => {
    const { element, peer } = await mount(el => {
      el.strings = { mapInitializationFailed: 'Unable to restore map resources' };
      el.images = [{ id: 'pin', source: { kind: 'url', url: 'javascript:alert(1)' }, width: 1, height: 1, pixelRatio: 1 }];
    });
    const ready = element.whenStyleReady().catch(error => error as Error);
    peer.ready = true; peer.fire('load'); expect((await ready as Error).name).to.equal('MapReadinessError');
    await waitUntil(() => element.shadowRoot?.textContent?.includes('Unable to restore map resources') === true);
    expect(element.shadowRoot?.textContent?.includes('javascript:')).to.equal(false);
  });
});
