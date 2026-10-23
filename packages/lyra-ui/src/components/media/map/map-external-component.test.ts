import { expect, fixture, fixtureCleanup, html, waitUntil } from '@open-wc/testing';
import { captureReentrantUpdateWarning } from '../../../../test/expected-lit-update.js';
import './map.js';
import { LYRA_MAP_EMPTY_STYLE, type LyraMap } from './map.js';
import { loadMapFeatureStateRuntime } from './map-feature-loader.js';

class OwnedMap {
  sourceWrites = 0;
  hits: unknown[] = [];
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
  private invalidate(): void {
    this.idle = false;
    queueMicrotask(() => {
      if (!this.ready || this.removed) return;
      this.idle = true;
      this.fire('idle');
    });
  }
  isStyleLoaded(): boolean { return this.ready; }
  loaded(): boolean { return this.idle; }
  isMoving(): boolean { return false; }
  getCanvas(): HTMLCanvasElement { return this.canvas; }
  getCenter() { return this.center; }
  getZoom(): number { return this.zoom; }
  setCenter(value: [number, number]): void { this.center = { lng: value[0], lat: value[1] }; this.invalidate(); }
  setZoom(value: number): void { this.zoom = value; this.invalidate(); }
  jumpTo(options: { center?: [number, number]; zoom?: number }): void {
    this.invalidate(); this.fire('movestart');
    if (options.center) this.setCenter(options.center);
    if (options.zoom !== undefined) this.setZoom(options.zoom);
    this.fire('moveend');
  }
  resize(): void {}
  remove(): void { this.removed = true; this.listeners.clear(); }
  setStyle(): this {
    this.sources.clear(); this.layers.clear(); this.images.clear(); this.sourceDescriptors.clear(); this.order = []; this.invalidate();
    this.ready = this.synchronousStyle;
    if (this.ready) this.fire('style.load');
    return this;
  }
  prepareFeatures(requirements: unknown): Promise<void> { return OwnedMap.prepare?.(requirements) ?? Promise.resolve(); }
  getSource(id: string) { return this.sources.get(id); }
  addSource(id: string, source: unknown): this {
    this.sourceWrites++; this.sourceDescriptors.set(id, source); this.invalidate();
    const update = (values: Record<string, unknown>): void => {
      this.sourceDescriptors.set(id, { ...this.sourceDescriptors.get(id) as Record<string, unknown>, ...values }); this.invalidate();
    };
    const native = { setData: (data: unknown) => { update({ data }); }, updateData: () => { this.invalidate(); },
      setCoordinates: (coordinates: unknown) => { update({ coordinates }); },
      updateImage: (image: Record<string, unknown>) => { update(image); },
      play: () => { update({ animate: true }); }, pause: () => { update({ animate: false }); } };
    this.sources.set(id, native); return this;
  }
  removeSource(id: string): this { this.sources.delete(id); return this; }
  getLayer(id: string): unknown { return this.layers.get(id); }
  addLayer(layer: { id: string }, before?: string): this { this.layers.set(layer.id, layer); this.order.splice(before ? this.order.indexOf(before) : this.order.length, 0, layer.id); return this; }
  removeLayer(id: string): this { this.layers.delete(id); this.order = this.order.filter(value => value !== id); return this; }
  setPaintProperty(id: string, key: string, value: unknown): this { this.paint.set(`${id}:${key}`, value); return this; }
  getPaintProperty(id: string, key: string): unknown { return this.paint.get(`${id}:${key}`); }
  getLayoutProperty(): unknown { return undefined; }
  setLayoutProperty(): this { return this; }
  repaints = 0;
  triggerRepaint(): void { this.repaints++; }
  getStyle() { return { layers: this.order.map(id => ({ id })) }; }
  moveLayer(id: string, before?: string): void { this.order = this.order.filter(value => value !== id); this.order.splice(before ? this.order.indexOf(before) : this.order.length, 0, id); }
  hasImage(id: string): boolean { return this.images.has(id); }
  addImage(id: string, pixels: ImageData): void { this.images.set(id, pixels); }
  removeImage(id: string): void { this.images.delete(id); }
  queryRenderedFeatures(): unknown[] { return this.hits; }
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

describe('lr-map external data layers and labels', () => {
  // Exercises the steady state after the on-demand runtime has loaded; map-lazy-runtimes.test.ts covers the loading itself.
  before(() => loadMapFeatureStateRuntime());
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

  it('coalesces generated paint changes and keeps equal snapshots repaint-free', async () => {
    const row = { sourceId: 'points', geojson: POINTS, color: '#ff0000' };
    const { element, peer } = await mount(el => { el.dataLayers = [row]; });
    await load(element, peer); await element.whenIdle();
    const source = [...peer.sources.values()][0], layers = [...peer.layers.values()]; peer.repaints = 0;
    element.dataLayers = [{ ...row, color: '#0000ff' }]; await element.updateComplete; await element.whenIdle();
    expect(peer.repaints).to.equal(1);
    expect([...peer.sources.values()][0] === source).to.equal(true);
    expect([...peer.layers.values()].every((layer, index) => layer === layers[index])).to.equal(true);
    element.dataLayers = [{ ...row, color: '#0000ff' }]; await element.updateComplete; await element.whenIdle();
    expect(peer.repaints).to.equal(1);
  });

  it('sanitizes repaint failure and retires the failed peer', async () => {
    const row = { sourceId: 'points', geojson: POINTS, color: '#ff0000' };
    const { element, peer } = await mount(el => { el.dataLayers = [row]; });
    await load(element, peer); await element.whenIdle();
    peer.triggerRepaint = () => { throw new Error('private repaint diagnostic'); };
    element.dataLayers = [{ ...row, color: '#0000ff' }]; await element.updateComplete;
    try { await element.whenIdle(); } catch { /* The existing sanitized resource failure is expected. */ }
    expect(peer.removed).to.equal(true);
    expect(element.shadowRoot?.textContent?.includes('private repaint diagnostic')).to.equal(false);
  });

  it('reports an image footprint click with authored source identity and no invented feature identity', async () => {
    const corners = [[0, 1], [1, 1], [1, 0], [0, 0]] as const;
    const { element, peer } = await mount(el => { el.dataLayers = [{ kind: 'image', sourceId: 'heat', url: 'https://example.test/a.png', coordinates: corners }]; });
    await load(element, peer);
    const layer = [...peer.layers.values()].find(value => (value as { id: string }).id.endsWith('-hit')) as { id: string; source: string } | undefined;
    expect(layer !== undefined, 'interactive image requires a native footprint layer').to.equal(true);
    const feature = (peer.sourceDescriptors.get(layer!.source) as { data: object }).data;
    peer.hits = [{ ...feature, layer: { id: layer!.id }, source: layer!.source }];
    let detail: unknown;
    element.addEventListener('lr-map-click', event => { detail = event.detail; });
    peer.fire('click', { point: { x: 1, y: 2 }, lngLat: { lng: 0.5, lat: 0.5 } });
    expect(detail).to.include({ origin: 'data-layer', sourceId: 'heat' });
    const hit = (detail as { hit: Record<string, unknown> }).hit;
    expect(hit['source']).to.equal('heat'); expect(hit['properties']).to.deep.equal({});
    expect(Object.hasOwn(hit, 'id') || Object.hasOwn(hit, 'sourceLayer') || Object.hasOwn(hit, 'target')).to.equal(false);
    expect(Object.isFrozen(hit)).to.equal(true);
    expect(element.setFeatureState({ origin: 'data-layer', source: 'heat', id: 1 }, { selected: true })).to.equal(false);
  });

  it('uses native hit order for image ties and explicit priority across overlapping footprints', async () => {
    const corners = [[0, 1], [1, 1], [1, 0], [0, 0]] as const;
    const rows = [
      { kind: 'image' as const, sourceId: 'bottom', url: 'https://example.test/a.png', coordinates: corners, priority: 4 },
      { kind: 'image' as const, sourceId: 'top', url: 'https://example.test/b.png', coordinates: corners, priority: 0 },
    ];
    const { element, peer } = await mount(el => { el.dataLayers = rows; }); await load(element, peer);
    // Native queries list rendered features topmost first, so derive the order from the render stack.
    const hitLayers = peer.order.filter(id => id.endsWith('-hit')).map(id => peer.layers.get(id)) as { id: string; source: string }[];
    expect(hitLayers.length).to.equal(2);
    peer.hits = hitLayers.slice().reverse().map(layer => ({ ...(peer.sourceDescriptors.get(layer.source) as { data: object }).data, layer: { id: layer.id } }));
    const sources: (string | undefined)[] = [];
    element.addEventListener('lr-map-click', event => { sources.push(event.detail.sourceId); });
    peer.fire('click', { point: { x: 1, y: 2 }, lngLat: { lng: 0.5, lat: 0.5 } });
    expect(sources).to.deep.equal(['bottom']);
    element.dataLayers = rows.map(row => ({ ...row, priority: 0 })); await element.updateComplete; await element.whenIdle();
    peer.fire('click', { point: { x: 1, y: 2 }, lngLat: { lng: 0.5, lat: 0.5 } });
    expect(sources).to.deep.equal(['bottom', 'top']);
  });

  it('clears footprint hover and excludes a hidden category without promoting its proxy to basemap state', async () => {
    const row = { kind: 'canvas' as const, sourceId: 'heat', canvas: document.createElement('canvas'),
      coordinates: [[0, 1], [1, 1], [1, 0], [0, 0]] as const, category: 'heat' };
    const { element, peer } = await mount(el => { el.dataLayers = [row]; }); await load(element, peer);
    const layer = [...peer.layers.values()].find(value => (value as { id: string }).id.endsWith('-hit')) as { id: string; source: string };
    expect(layer !== undefined).to.equal(true);
    peer.hits = [{ ...(peer.sourceDescriptors.get(layer.source) as { data: object }).data, layer: { id: layer.id } }];
    let entered = 0, left = 0; const clicked: (string | undefined)[] = [];
    element.addEventListener('lr-map-feature-enter', () => { entered++; }); element.addEventListener('lr-map-feature-leave', () => { left++; });
    element.addEventListener('lr-map-click', event => { clicked.push(event.detail.sourceId); });
    peer.fire('mousemove', { point: { x: 1, y: 2 }, lngLat: { lng: 0.5, lat: 0.5 } });
    expect(entered).to.equal(1); expect(peer.canvas.style.cursor).to.equal('pointer');
    element.interactiveBasemapLayers = [{ layerId: layer.id }]; element.hiddenCategories = ['heat'];
    await element.updateComplete; await element.whenIdle();
    expect(left).to.equal(1); expect(peer.canvas.style.cursor).to.equal('');
    expect(element.setFeatureState({ origin: 'basemap', source: layer.source, id: 1 }, { selected: true })).to.equal(false);
    peer.fire('click', { point: { x: 1, y: 2 }, lngLat: { lng: 0.5, lat: 0.5 } });
    expect(clicked).to.deep.equal([undefined]);
  });

  it('updates the footprint in place, restores it after style replacement and removes both owned resources', async () => {
    const row = { kind: 'image' as const, sourceId: 'heat', url: 'https://example.test/a.png', coordinates: [[0, 1], [1, 1], [1, 0], [0, 0]] as const };
    const { element, peer } = await mount(el => { el.dataLayers = [row]; }); await load(element, peer);
    const layer = [...peer.layers.values()].find(value => (value as { id: string }).id.endsWith('-hit')) as { id: string; source: string };
    expect(layer !== undefined).to.equal(true);
    const source = peer.sources.get(layer.source); const writes = peer.sourceWrites;
    const coordinates = [[2, 3], [3, 3], [3, 2], [2, 2]] as const;
    element.dataLayers = [{ ...row, coordinates }]; await element.updateComplete; await element.whenIdle();
    expect(peer.sources.get(layer.source) === source).to.equal(true); expect(peer.sourceWrites).to.equal(writes);
    expect((peer.sourceDescriptors.get(layer.source) as { data: { geometry: { coordinates: unknown } } }).data.geometry.coordinates).to.deep.equal([[...coordinates, coordinates[0]]]);
    element.mapStyle = { ...LYRA_MAP_EMPTY_STYLE }; await element.updateComplete; await element.whenStyleReady();
    const replay = [...peer.layers.values()].find(value => (value as { id: string }).id.endsWith('-hit')) as { id: string; source: string };
    expect(replay !== undefined).to.equal(true);
    expect((peer.sourceDescriptors.get(replay.source) as { data: { geometry: { coordinates: unknown } } }).data.geometry.coordinates).to.deep.equal([[...coordinates, coordinates[0]]]);
    element.dataLayers = []; await element.updateComplete; await element.whenIdle();
    expect(peer.sources.size).to.equal(0); expect(peer.layers.size).to.equal(0);
  });

  it('reserves footprint identifiers without replacing an authored source and drops disabled interaction resources', async () => {
    const row = { kind: 'image' as const, sourceId: 'heat', url: 'https://example.test/a.png', coordinates: [[0, 1], [1, 1], [1, 0], [0, 0]] as const };
    const collision = 'lr-external-layer-0-hit-source';
    const { element, peer } = await mount(el => {
      el.overlays = { sources: [{ id: collision, source: { type: 'geojson', data: POINTS } }], layers: [] }; el.dataLayers = [row];
    }); await load(element, peer);
    const authored = peer.sources.get(collision);
    const layer = [...peer.layers.values()].find(value => (value as { id: string }).id.endsWith('-hit')) as { source: string };
    expect(layer.source).not.to.equal(collision); expect(authored !== undefined).to.equal(true);
    element.dataLayers = [{ ...row, interactive: false }]; await element.updateComplete; await element.whenIdle();
    expect([...peer.layers.keys()].some(id => id.endsWith('-hit'))).to.equal(false);
    expect(peer.sources.get(collision) === authored).to.equal(true);
    expect([...peer.layers.values()].some(value => (value as { type: string }).type === 'raster')).to.equal(true);
  });

  it('prepares actual external source families and vector source-layer before publishing style readiness', async () => {
    const prepared: unknown[] = []; OwnedMap.prepare = async input => { prepared.push(input); };
    const canvas = document.createElement('canvas');
    const corners = [[0, 1], [1, 1], [1, 0], [0, 0]] as const;
    const { element, peer } = await mount(el => {
      el.dataLayers = [
        { kind: 'vector', sourceId: 'roads', source: { tiles: ['https://example.test/{z}/{x}/{y}.pbf'] }, sourceLayer: 'transport', render: 'line' },
        { kind: 'raster', sourceId: 'tiles', source: { tiles: ['https://example.test/{z}/{x}/{y}.png'] } },
        { kind: 'image', sourceId: 'image', url: 'https://example.test/image.png', coordinates: corners },
        { kind: 'canvas', sourceId: 'canvas', canvas, coordinates: corners },
      ];
    });
    await load(element, peer);
    expect([...peer.sourceDescriptors.values()].map(source => (source as { type: string }).type)).to.deep.equal(['vector', 'raster', 'image', 'geojson', 'canvas', 'geojson']);
    const request = prepared.find(value => Object.values((value as { sources?: Record<string, unknown> }).sources ?? {}).some(source => (source as { type: string }).type === 'vector')) as { layers: Record<string, unknown>[] };
    expect(request.layers.some(layer => layer['source-layer'] === 'transport')).to.equal(true);
    expect([...peer.sourceDescriptors.values()].some(source => (source as { canvas?: unknown }).canvas === canvas)).to.equal(true);
    element.mapStyle = { ...LYRA_MAP_EMPTY_STYLE }; await element.whenStyleReady();
    expect(peer.sourceDescriptors.size).to.equal(6);
  });

  it('retains a vector source for paint changes and reports its public source-layer on clicks', async () => {
    const row = { kind: 'vector' as const, sourceId: 'roads', source: { url: 'https://example.test/vector.json' }, sourceLayer: 'roads', render: 'line' as const };
    const { element, peer } = await mount(el => { el.dataLayers = [row]; }); await load(element, peer);
    const sourceId = [...peer.sources.keys()][0]; if (!sourceId) throw new Error('Missing source');
    const original = peer.sources.get(sourceId); const writes = peer.sourceWrites;
    element.dataLayers = [{ ...row, width: 8 }]; await element.updateComplete;
    await waitUntil(() => [...peer.layers.values()].some(layer => (layer as { paint?: Record<string, unknown> }).paint?.['line-width'] === 8));
    expect(peer.sources.get(sourceId) === original).to.equal(true); expect(peer.sourceWrites).to.equal(writes);
    const layer = [...peer.layers.values()][0] as { id: string };
    peer.hits = [{ type: 'Feature', properties: {}, geometry: null, layer: { id: layer.id } }];
    let detail: unknown; element.addEventListener('lr-map-click', event => { detail = event.detail; });
    peer.fire('click', { point: { x: 1, y: 2 }, lngLat: { lng: 1, lat: 2 } });
    expect(detail).to.include({ origin: 'data-layer', sourceId: 'roads', sourceLayer: 'roads' });
  });

  it('keeps source identity when GeoJSON labels change and removes labels before their source', async () => {
    const { element, peer } = await mount(el => {
      el.mapStyle = { ...LYRA_MAP_EMPTY_STYLE, glyphs: 'https://example.test/{fontstack}/{range}.pbf' };
      el.dataLayers = [{ sourceId: 'points', geojson: POINTS, label: { field: 'name' } }];
    });
    await load(element, peer);
    const sourceId = [...peer.sources.keys()][0]; if (!sourceId) throw new Error('Missing source');
    const source = peer.sources.get(sourceId);
    expect(peer.layers.has(`${sourceId}-label`)).to.equal(true);
    element.dataLayers = [{ sourceId: 'points', geojson: POINTS, label: { field: 'localized', placement: 'point' } }];
    await element.updateComplete; await element.whenIdle(); expect(peer.sources.get(sourceId) === source).to.equal(true);
    element.dataLayers = []; await element.updateComplete; await element.whenIdle();
    expect(peer.layers.size).to.equal(0); expect(peer.sources.size).to.equal(0);
  });

  it('updates image and same-canvas sources in place through the component registry', async () => {
    const canvas = document.createElement('canvas'); const corners = [[0, 1], [1, 1], [1, 0], [0, 0]] as const;
    const { element, peer } = await mount(el => { el.dataLayers = [
      { kind: 'image', sourceId: 'image', url: 'https://example.test/a.png', coordinates: corners },
      { kind: 'canvas', sourceId: 'canvas', canvas, coordinates: corners },
    ]; }); await load(element, peer);
    const original = [...peer.sources.values()]; const writes = peer.sourceWrites;
    const moved = [[-1, 1], [1, 1], [1, -1], [-1, -1]] as const;
    element.dataLayers = [
      { kind: 'image', sourceId: 'image', url: 'https://example.test/b.png', coordinates: moved },
      { kind: 'canvas', sourceId: 'canvas', canvas, coordinates: moved, animate: false },
    ]; await element.updateComplete;
    await waitUntil(() => [...peer.sourceDescriptors.values()].some(source => (source as { animate?: boolean }).animate === false));
    await element.whenIdle();
    expect([...peer.sources.values()].every((source, index) => source === original[index])).to.equal(true);
    expect(peer.sourceWrites).to.equal(writes);
    expect([...peer.sourceDescriptors.values()].some(source => (source as { url?: string }).url === 'https://example.test/b.png')).to.equal(true);
  });

  it('supersedes external preparation and ignores its late failure', async () => {
    let rejectOld!: (error: unknown) => void; let preparing = false;
    OwnedMap.prepare = async input => {
      const sources = Object.values((input as { sources?: Record<string, { type?: string }> }).sources ?? {});
      if (sources.some(source => source.type === 'vector')) {
        preparing = true; await new Promise<void>((_resolve, reject) => { rejectOld = reject; });
      }
    };
    const { element, peer } = await mount(el => { el.dataLayers = [
      { kind: 'vector', sourceId: 'data', source: { tiles: ['https://example.test/{z}/{x}/{y}.pbf'] }, sourceLayer: 'roads', render: 'line' },
    ]; });
    peer.ready = true; peer.fire('load'); await waitUntil(() => preparing);
    element.dataLayers = [{ kind: 'raster', sourceId: 'data', source: { tiles: ['https://example.test/{z}/{x}/{y}.png'] } }];
    await element.whenStyleReady(); rejectOld(new Error('obsolete preparation')); await Promise.resolve();
    expect([...peer.layers.values()].map(layer => (layer as { type: string }).type)).to.deep.equal(['raster']);
    expect(element.map === peer).to.equal(true);
  });

  it('rejects requested labels without glyphs with localized feedback and no label mutation', async () => {
    const { element, peer } = await mount(el => {
      el.strings = { mapInitializationFailed: 'Labels unavailable' };
      el.dataLayers = [{ sourceId: 'points', geojson: POINTS, label: { field: 'name' } }];
    });
    peer.ready = true; peer.fire('load');
    await waitUntil(() => element.map === undefined); await element.updateComplete;
    expect(peer.layers.size).to.equal(0);
    expect(element.shadowRoot?.querySelector('[part="error"]')?.textContent).to.include('Labels unavailable');
  });

  for (const [name, declaration] of [
    ['URL shorthand', '/fonts/test.ttf'],
    ['font face array', [{ url: '/fonts/test.ttf' }]],
    ['Unicode ranges', [{ url: '/fonts/test.ttf', 'unicode-range': ['U+26', 'U+0000-00FF', 'U+6??'] }]],
    ['empty Unicode range list', [{ url: '/fonts/test.ttf', 'unicode-range': [] }]],
  ] as const) {
    it(`admits GeoJSON labels from native font files with ${name}`, async () => {
      const { element, peer } = await mount(el => {
        const style = { ...LYRA_MAP_EMPTY_STYLE };
        Object.defineProperty(style, 'font-faces', { value: { 'Test Font': declaration }, enumerable: true });
        el.mapStyle = style;
        el.dataLayers = [{ sourceId: 'points', geojson: POINTS, label: { field: 'name', font: ['Test Font'] } }];
      });
      await load(element, peer);
      const labels = [...peer.layers.values()].filter(layer => (layer as { type?: string }).type === 'symbol');
      expect(labels).to.have.length(1);
      expect((labels[0] as { layout: Record<string, unknown> }).layout['text-font']).to.deep.equal(['Test Font']);
      expect(element.map === peer).to.equal(true);
    });
  }

  it('admits native font files from the loaded URL style and retains PBF glyph styles', async () => {
    const { element, peer } = await mount(el => {
      el.mapStyle = '/styles/map.json';
      el.dataLayers = [{ sourceId: 'points', geojson: POINTS, label: { field: 'name', font: ['Test Font'] } }];
    });
    peer.getStyle = () => ({ layers: [], 'font-faces': { 'Test Font': [{ url: '/fonts/test.ttf' }] } });
    await load(element, peer);
    expect([...peer.layers.keys()].filter(id => id.endsWith('-label'))).to.have.length(1);
    peer.getStyle = () => ({ layers: [] });
    element.mapStyle = { ...LYRA_MAP_EMPTY_STYLE, glyphs: '/fonts/{fontstack}/{range}.pbf' };
    await element.updateComplete;
    await element.whenStyleReady();
    expect([...peer.layers.keys()].filter(id => id.endsWith('-label'))).to.have.length(1);
  });

  it('includes cluster count labels with native font files and no PBF glyph URL', async () => {
    const { element, peer } = await mount(el => {
      const style = { ...LYRA_MAP_EMPTY_STYLE };
      Object.defineProperty(style, 'font-faces', { value: { 'Test Font': '/fonts/test.ttf' }, enumerable: true });
      el.mapStyle = style;
      el.dataLayers = [{ sourceId: 'points', geojson: POINTS, cluster: { zoomOnClick: true, countFont: ['Test Font'] } }];
    });
    await load(element, peer);
    expect([...peer.layers.keys()].some(id => id.endsWith('-cluster-count'))).to.equal(true);
  });

  for (const [name, faces] of [
    ['empty map', {}], ['empty family', { '': '/fonts/test.ttf' }],
    ['empty URL', { 'Test Font': '  ' }], ['empty face array', { 'Test Font': [] }],
    ['sparse face array', { 'Test Font': new Array<unknown>(1) }],
    ['sparse Unicode range array', { 'Test Font': [{ url: '/fonts/test.ttf', 'unicode-range': new Array<unknown>(1) }] }],
    ['too many font families', Object.fromEntries(Array.from({ length: 65 }, (_, index) => [`Font ${index}`, '/fonts/test.ttf']))],
    ['bare face object', { 'Test Font': { url: '/fonts/test.ttf' } }],
    ['missing URL', { 'Test Font': [{}] }], ['non-string URL', { 'Test Font': [{ url: 1 }] }],
    ['malformed Unicode range', { 'Test Font': [{ url: '/fonts/test.ttf', 'unicode-range': ['U+7F-00'] }] }],
    ['Unicode range outside scalar space', { 'Test Font': [{ url: '/fonts/test.ttf', 'unicode-range': ['U+110000'] }] }],
    ['malformed wildcard range', { 'Test Font': [{ url: '/fonts/test.ttf', 'unicode-range': ['U+12345??'] }] }],
    ['invalid Unicode syntax', { 'Test Font': [{ url: '/fonts/test.ttf', 'unicode-range': ['invalid'] }] }],
    ['non-array Unicode ranges', { 'Test Font': [{ url: '/fonts/test.ttf', 'unicode-range': 'U+26' }] }],
    ['non-string Unicode range', { 'Test Font': [{ url: '/fonts/test.ttf', 'unicode-range': [26] }] }],
    ['blank face URL', { 'Test Font': [{ url: ' ' }] }],
    ['unknown face member', { 'Test Font': [{ url: '/fonts/test.ttf', source: '/other.ttf' }] }],
  ] as const) {
    it(`rejects requested labels with ${name} font faces before any label mutation`, async () => {
      const { element, peer } = await mount(el => {
        const style = { ...LYRA_MAP_EMPTY_STYLE };
        Object.defineProperty(style, 'font-faces', { value: faces, enumerable: true });
        el.mapStyle = style;
        el.strings = { mapInitializationFailed: 'Labels unavailable' };
        el.dataLayers = [{ sourceId: 'points', geojson: POINTS, label: { field: 'name' } }];
      });
      peer.ready = true; peer.fire('load');
      await waitUntil(() => element.map === undefined); await element.updateComplete;
      expect(peer.layers.size).to.equal(0);
      expect(element.shadowRoot?.querySelector('[part="error"]')?.textContent).to.include('Labels unavailable');
    });
  }

  for (const kind of ['families', 'face members'] as const) {
    it(`rejects oversized native font ${kind} before inspecting record descriptors`, async () => {
      let descriptorReads = 0;
      const record = new Proxy({}, {
        ownKeys() { return Array.from({ length: kind === 'families' ? 65 : 3 }, (_, index) => `key${index}`); },
        getOwnPropertyDescriptor() {
          descriptorReads++;
          return { value: '/fonts/test.ttf', configurable: true, enumerable: true, writable: true };
        },
      });
      const faces = kind === 'families' ? record : { 'Test Font': [record] };
      const { element, peer } = await mount(el => {
        const style = { ...LYRA_MAP_EMPTY_STYLE };
        Object.defineProperty(style, 'font-faces', { value: faces, enumerable: true });
        el.mapStyle = style; el.strings = { mapInitializationFailed: 'Labels unavailable' };
        el.dataLayers = [{ sourceId: 'points', geojson: POINTS, label: { field: 'name' } }];
      });
      peer.ready = true; peer.fire('load');
      await waitUntil(() => element.map === undefined); await element.updateComplete;
      expect(descriptorReads).to.equal(0); expect(peer.layers.size).to.equal(0);
    });
  }

  it('does not admit non-enumerable or symbol-only font families', async () => {
    const faces = {};
    Object.defineProperty(faces, 'Test Font', { value: '/fonts/test.ttf' });
    Object.defineProperty(faces, Symbol('Font'), { value: '/fonts/test.ttf', enumerable: true });
    const { element, peer } = await mount(el => {
      const style = { ...LYRA_MAP_EMPTY_STYLE };
      Object.defineProperty(style, 'font-faces', { value: faces, enumerable: true });
      el.mapStyle = style; el.strings = { mapInitializationFailed: 'Labels unavailable' };
      el.dataLayers = [{ sourceId: 'points', geojson: POINTS, label: { field: 'name' } }];
    });
    peer.ready = true; peer.fire('load');
    await waitUntil(() => element.map === undefined); await element.updateComplete;
    expect(peer.layers.size).to.equal(0);
  });

  for (const kind of ['faces', 'ranges'] as const) {
    it(`rejects oversized native font ${kind} before reading their entries`, async () => {
      let entryReads = 0;
      const entries: unknown[] = []; entries.length = 1000000;
      const oversized = new Proxy(entries, {
        getOwnPropertyDescriptor(target, key) {
          if (typeof key === 'string' && /^\d+$/.test(key)) {
            entryReads++;
            return { value: kind === 'faces' ? { url: '/fonts/test.ttf' } : 'U+26',
              writable: true, configurable: true, enumerable: true };
          }
          return Reflect.getOwnPropertyDescriptor(target, key);
        },
      });
      const declaration = kind === 'faces' ? oversized : [{ url: '/fonts/test.ttf', 'unicode-range': oversized }];
      const { element, peer } = await mount(el => {
        const style = { ...LYRA_MAP_EMPTY_STYLE };
        Object.defineProperty(style, 'font-faces', { value: { 'Test Font': declaration }, enumerable: true });
        el.mapStyle = style; el.strings = { mapInitializationFailed: 'Labels unavailable' };
        el.dataLayers = [{ sourceId: 'points', geojson: POINTS, label: { field: 'name' } }];
      });
      peer.ready = true; peer.fire('load');
      await waitUntil(() => element.map === undefined); await element.updateComplete;
      expect(entryReads).to.equal(0); expect(peer.layers.size).to.equal(0);
      expect(element.shadowRoot?.querySelector('[part="error"]')?.textContent).to.include('Labels unavailable');
    });
  }

  for (const location of ['style', 'family', 'entry', 'face', 'ranges', 'range-entry', 'glyphs'] as const) {
    it(`does not invoke a ${location} font provider getter when rejecting labels`, async () => {
      let reads = 0;
      const getter = { enumerable: true, get() { reads++; throw new Error('Unreadable font provider'); } };
      const style = { ...LYRA_MAP_EMPTY_STYLE };
      const face = { url: '/fonts/test.ttf' };
      const faces = { 'Test Font': [face] };
      if (location === 'style') Object.defineProperty(style, 'font-faces', getter);
      else {
        Object.defineProperty(style, 'font-faces', { value: faces, enumerable: true });
        if (location === 'family') Object.defineProperty(faces, 'Test Font', getter);
        if (location === 'entry') Object.defineProperty(faces['Test Font'], '0', getter);
        if (location === 'range-entry') {
          const ranges = ['U+26']; Object.defineProperty(ranges, '0', getter);
          Object.defineProperty(face, 'unicode-range', { value: ranges, enumerable: true });
        }
        if (location === 'face') Object.defineProperty(face, 'url', getter);
        if (location === 'ranges') Object.defineProperty(face, 'unicode-range', getter);
        if (location === 'glyphs') Object.defineProperty(style, 'glyphs', getter);
      }
      const { element, peer } = await mount(el => {
        el.mapStyle = style; el.strings = { mapInitializationFailed: 'Labels unavailable' };
        el.dataLayers = [{ sourceId: 'points', geojson: POINTS, label: { field: 'name' } }];
      });
      peer.ready = true; peer.fire('load');
      await waitUntil(() => element.map === undefined); await element.updateComplete;
      expect(reads).to.equal(0); expect(peer.layers.size).to.equal(0);
      expect(element.shadowRoot?.querySelector('[part="error"]')?.textContent).to.include('Labels unavailable');
    });
  }

  it('switches one business source between GeoJSON and external families without leaving native resources', async () => {
    const { element, peer } = await mount(el => { el.dataLayers = [{ sourceId: 'same', geojson: POINTS }]; });
    await load(element, peer); expect(peer.layers.size).to.equal(3);
    element.dataLayers = [{ kind: 'raster', sourceId: 'same', source: { tiles: ['https://example.test/{z}/{x}/{y}.png'] } }];
    await element.updateComplete; await waitUntil(() => peer.layers.size === 1);
    expect(peer.sources.size).to.equal(1);
    element.dataLayers = [{ sourceId: 'same', geojson: POINTS }]; await element.updateComplete;
    await waitUntil(() => peer.layers.size === 3); expect(peer.sources.size).to.equal(1);
  });
  for (const reentrant of [false, true]) {
    it(`recovers complete choropleth paint and readiness after ${reentrant ? 'multiple nested generations' : 'data supersession'}`, async () => {
      const initial = { sourceId: 'regions', geojson: POINTS, field: 'value',
        stops: [[0, '#ff0000'], [1, '#ff0000']] as const, noData: { color: '#cccccc', strokeColor: '#000000' } };
      const { element, peer } = await mount(el => {
        el.choropleth = initial; el.style.setProperty('--lr-map-choropleth-fill-opacity', '0.4');
      });
      await load(element, peer); await element.whenIdle();
      const layerId = [...peer.layers.keys()].find(id => id.endsWith('-fill'))!;
      const source = [...peer.sources.values()][0], layer = peer.getLayer(layerId);
      for (const [key, value] of Object.entries((layer as { paint: Record<string, unknown> }).paint)) peer.paint.set(`${layerId}:${key}`, value);
      const original = peer.setPaintProperty.bind(peer); let interrupted = false;
      peer.repaints = 0;
      peer.setPaintProperty = (id, key, value) => {
        original(id, key, value);
        if (!interrupted && key === 'fill-color') {
          interrupted = true;
          if (reentrant) {
            const internal = element as unknown as { reconcileGeneratedLayers(): Promise<void> };
            void internal.reconcileGeneratedLayers();
            void internal.reconcileGeneratedLayers();
          } else element.dataLayers = [];
        }
        return peer;
      };
      const updatePaint = async () => {
        element.choropleth = { ...initial, stops: [[0, '#0000ff'], [1, '#0000ff']], noData: { color: '#cccccc', strokeColor: '#00ff00' } };
        await element.updateComplete; await element.whenIdle();
      };
      if (reentrant) await updatePaint();
      else expect(await captureReentrantUpdateWarning(element.localName, updatePaint)).to.equal(1);
      expect(interrupted).to.equal(true); expect(peer.removed).to.equal(false);
      expect(peer.getPaintProperty(layerId, 'fill-opacity')).to.equal(0.4);
      expect(JSON.stringify(peer.getPaintProperty(layerId, 'fill-outline-color'))).to.include('#00ff00');
      expect(JSON.stringify(peer.getPaintProperty(layerId, 'fill-color'))).to.include('#0000ff');
      expect(peer.repaints).to.be.greaterThan(0);
      expect([...peer.sources.values()][0] === source).to.equal(true); expect(peer.getLayer(layerId) === layer).to.equal(true);
    });
  }

});
