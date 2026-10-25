import { expect, fixture, fixtureCleanup, html, waitUntil } from '@open-wc/testing';
import './map.js';
import { LYRA_MAP_EMPTY_STYLE, type LyraMap } from './map.js';
import { MapBasemapOrder, type MapBasemapOrderDraft } from './map-basemap-order.js';
import type { MapLayerOrderGroup } from './map-layer-order.js';

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
  getStyle() { return { layers: this.order.map(id => ({ ...(this.layers.get(id) as Record<string, unknown>), id })) }; }
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

  it('moves only selected basemap layers and restores order when before is omitted', async () => {
    const { element, peer } = await mount();
    for (const id of ['background', 'borders', 'roads', 'labels']) peer.addLayer({ id });
    await load(element, peer);
    const originalLayers = [...peer.layers.values()];
    const input = [{ layerId: 'borders', before: null, paint: { 'line-width': 2 } }];
    element.styleOverrides = input;
    await element.updateComplete;
    await waitUntil(() => peer.order.at(-1) === 'borders', 'basemap order override did not append');
    expect(peer.order).to.deep.equal(['background', 'roads', 'labels', 'borders']);
    expect([...peer.layers.values()].every((layer, index) => layer === originalLayers[index])).to.equal(true);
    element.styleOverrides = [{ layerId: 'borders', paint: { 'line-width': 2 } }];
    await element.updateComplete;
    await waitUntil(() => peer.order[1] === 'borders', 'removing before did not restore baseline');
    expect(peer.order).to.deep.equal(['background', 'borders', 'roads', 'labels']);
    expect(peer.paint.get('borders:line-width')).to.equal(2);
  });

  it('leaves order untouched when basemap overrides have no before field', async () => {
    const { element, peer } = await mount();
    for (const id of ['background', 'borders', 'labels']) peer.addLayer({ id });
    let moves = 0;
    peer.moveLayer = () => { moves += 1; };
    await load(element, peer);
    element.styleOverrides = [{ layerId: 'borders', paint: { 'line-width': 2 } }];
    await element.updateComplete;
    await waitUntil(() => peer.paint.get('borders:line-width') === 2);
    expect(moves).to.equal(0);
    expect(peer.order).to.deep.equal(['background', 'borders', 'labels']);
  });

  it('preserves an external basemap relocation when order ownership is released', async () => {
    const { element, peer } = await mount();
    for (const id of ['background', 'borders', 'roads', 'labels']) peer.addLayer({ id });
    await load(element, peer);
    const input = [{ layerId: 'borders', before: null }];
    element.styleOverrides = input;
    await element.updateComplete;
    await waitUntil(() => peer.order.at(-1) === 'borders');
    peer.moveLayer('borders', 'background');
    element.styleOverrides = [];
    await element.updateComplete;
    peer.idle = true; peer.fire('idle'); await element.whenIdle();
    expect(peer.order).to.deep.equal(['borders', 'background', 'roads', 'labels']);
  });

  it('preflights cycles between basemap placement and new owned resources before any native mutation', async () => {
    const { element, peer } = await mount();
    for (const id of ['base', 'borders', 'labels']) peer.addLayer({ id });
    await load(element, peer);
    let writes = 0;
    const addSource = peer.addSource.bind(peer), moveLayer = peer.moveLayer.bind(peer), paint = peer.setPaintProperty.bind(peer);
    peer.addSource = (id, source) => { writes += 1; return addSource(id, source); };
    peer.moveLayer = (id, before) => { writes += 1; moveLayer(id, before); };
    peer.setPaintProperty = (id, key, value) => { writes += 1; return paint(id, key, value); };
    element.overlays = { sources: [{ id: 'areas', source: { type: 'geojson', data: POINTS } }],
      layers: [{ layer: { id: 'areas-fill', type: 'fill', source: 'areas' }, before: 'borders' }] };
    const overrides = [{ layerId: 'borders', before: 'areas-fill', paint: { 'line-width': 3 } }];
    element.styleOverrides = overrides;
    await element.updateComplete;
    await waitUntil(() => Boolean(element.shadowRoot?.querySelector('[part="configuration-error"]')));
    expect(writes).to.equal(0);
    expect(peer.order).to.deep.equal(['base', 'borders', 'labels']);
    expect(peer.sources.size).to.equal(0);
  });

  it('combines basemap anchors with owned layers without recreating basemap resources', async () => {
    const { element, peer } = await mount();
    for (const id of ['base', 'borders', 'labels']) peer.addLayer({ id });
    await load(element, peer);
    const original = peer.getLayer('borders');
    element.overlays = { sources: [{ id: 'areas', source: { type: 'geojson', data: POINTS } }],
      layers: [{ layer: { id: 'areas-fill', type: 'fill', source: 'areas' }, before: 'labels' }] };
    const overrides = [{ layerId: 'borders', before: 'areas-fill' }];
    element.styleOverrides = overrides;
    await element.updateComplete;
    await waitUntil(() => peer.layers.has('areas-fill'));
    peer.idle = true; peer.fire('idle'); await element.whenIdle();
    expect(peer.order).to.deep.equal(['base', 'borders', 'areas-fill', 'labels']);
    expect(peer.getLayer('borders') === original).to.equal(true);
  });

  for (const failure of ['throw', 'no-op'] as const) {
    it(`rolls back moved basemap IDs when a native move fails by ${failure}`, async () => {
      const { element, peer } = await mount();
      for (const id of ['base', 'a', 'b', 'labels']) peer.addLayer({ id });
      await load(element, peer);
      const move = peer.moveLayer.bind(peer);
      let calls = 0;
      peer.moveLayer = (id, before) => {
        calls += 1;
        if (calls === 2) { if (failure === 'throw') throw new Error('Rejected move'); return; }
        move(id, before);
      };
      const overrides = [{ layerId: 'a', before: null }, { layerId: 'b', before: null }];
      element.styleOverrides = overrides;
      await element.updateComplete;
      await waitUntil(() => peer.removed);
      expect(peer.order).to.deep.equal(['base', 'a', 'b', 'labels']);
    });
  }

  it('does not roll back a new external layer order written during a failed native move', async () => {
    const { element, peer } = await mount();
    for (const id of ['base', 'a', 'labels']) peer.addLayer({ id });
    await load(element, peer);
    peer.moveLayer = () => { peer.order = ['a', 'labels', 'base']; throw new Error('External replacement'); };
    const overrides = [{ layerId: 'a', before: null }];
    element.styleOverrides = overrides;
    await element.updateComplete;
    await waitUntil(() => peer.removed);
    expect(peer.order).to.deep.equal(['a', 'labels', 'base']);
  });

  it('restores basemap placement after an owned same-ID layer is recreated', async () => {
    const { element, peer } = await mount();
    for (const id of ['base', 'borders', 'labels']) peer.addLayer({ id });
    await load(element, peer);
    element.overlays = { sources: [{ id: 'areas', source: { type: 'geojson', data: POINTS } }],
      layers: [{ layer: { id: 'areas-layer', type: 'circle', source: 'areas' }, before: 'labels' }] };
    await element.updateComplete;
    await waitUntil(() => peer.order.join() === 'base,borders,areas-layer,labels');
    peer.idle = true; peer.fire('idle'); await element.whenIdle();
    element.styleOverrides = [{ layerId: 'borders', before: null }];
    await element.updateComplete;
    await waitUntil(() => peer.order.join() === 'base,areas-layer,labels,borders');
    const previous = peer.getLayer('areas-layer');
    element.overlays = { sources: [{ id: 'areas', source: { type: 'geojson', data: POINTS } }],
      layers: [{ layer: { id: 'areas-layer', type: 'line', source: 'areas' } }] };
    await element.updateComplete;
    await waitUntil(() => peer.getLayer('areas-layer') !== previous);
    peer.idle = true; peer.fire('idle'); await element.whenIdle();
    expect(peer.order).to.deep.equal(['base', 'labels', 'areas-layer', 'borders']);
    element.styleOverrides = [];
    await element.updateComplete;
    peer.idle = true; peer.fire('idle'); await element.whenIdle();
    expect(peer.order).to.deep.equal(['base', 'borders', 'labels', 'areas-layer']);
  });

  for (const count of [12, 120]) for (const basemap of [false, true]) {
    it(`bounds native style reads for ${count} ${basemap ? 'basemap' : 'owned-only'} moves`, async () => {
      const { element, peer } = await mount();
      const ids = Array.from({ length: count }, (_, index) => `layer-${index}`);
      for (const id of ['base', ...ids, 'labels']) peer.addLayer({ id });
      await load(element, peer);
      element.styleOverrides = [{ layerId: 'base', paint: { 'background-opacity': 1 } }];
      await element.updateComplete;
      await waitUntil(() => peer.paint.get('base:background-opacity') === 1);
      peer.idle = true; peer.fire('idle'); await element.whenIdle();
      const nativeStyle = peer.getStyle.bind(peer), nativeMove = peer.moveLayer.bind(peer);
      let reads = 0, moves = 0;
      peer.getStyle = () => { reads += 1; return nativeStyle(); };
      peer.moveLayer = (id, before) => { moves += 1; nativeMove(id, before); };
      const draft = basemap ? new MapBasemapOrder().stage(peer.order, [{ source: 'base', before: null }],
        ids.map(id => ({ id, type: 'line', source: 'base' })), () => false) : undefined;
      // Isolate the final move phase from resource preparation to measure native serialization.
      const mover = element as unknown as { applyDataLayerOrder(groups: readonly MapLayerOrderGroup[], current: () => boolean, draft?: MapBasemapOrderDraft): void };
      mover.applyDataLayerOrder(basemap ? [] : ids.map(id => ({ id: `owned-${id}`, layerIds: [id] })), () => element.isConnected, draft);
      expect(moves).to.equal(count);
      expect(reads).to.equal(basemap ? 2 : 1);
      expect(peer.order).to.deep.equal(['base', 'labels', ...ids]);
    });
  }

  it('applies and restores selector placement beyond 256 matched basemap layers', async () => {
    const { element, peer } = await mount();
    const ids = Array.from({ length: 300 }, (_, index) => `boundary-${index}`);
    for (const id of ['base', ...ids, 'labels']) {
      const layer = { id, type: id.startsWith('boundary-') ? 'line' : 'fill', source: 'base' };
      peer.addLayer(layer);
    }
    await load(element, peer);
    element.styleOverrides = [{ source: 'base', layerType: 'line', before: null }];
    await element.updateComplete;
    await waitUntil(() => peer.order[1] === 'labels', 'expanded selector placement did not apply');
    expect(peer.order).to.deep.equal(['base', 'labels', ...ids]);
    element.styleOverrides = [];
    await element.updateComplete;
    await waitUntil(() => peer.order.at(-1) === 'labels');
    expect(peer.order).to.deep.equal(['base', ...ids, 'labels']);
  });

  it('defers absent paint-only targets, retries them and tolerates removal with same-turn release', async () => {
    const { element, peer } = await mount(el => {
      el.styleOverrides = [{ layerId: 'provider-line', paint: { 'line-color': 'red' } }];
    });
    await load(element, peer);
    expect(peer.removed).to.equal(false);
    expect(peer.paint.has('provider-line:line-color')).to.equal(false);
    peer.addLayer({ id: 'provider-line' });
    element.styleOverrides = [...element.styleOverrides];
    await element.updateComplete;
    await waitUntil(() => peer.paint.get('provider-line:line-color') === 'red');
    peer.idle = true; peer.fire('idle'); await element.whenIdle();
    peer.removeLayer('provider-line');
    element.styleOverrides = [];
    await element.updateComplete;
    peer.idle = true; peer.fire('idle'); await element.whenIdle();
    expect(peer.removed).to.equal(false);
  });

  it('retains explicit overrides for mutually exclusive basemap IDs across healthy style replacement', async () => {
    const { element, peer } = await mount();
    const seed = (border: string) => {
      peer.layers.clear(); peer.order = [];
      for (const id of ['base', border, 'labels']) peer.addLayer({ id });
    };
    seed('boundary-country');
    await load(element, peer);
    element.styleOverrides = [
      { layerId: 'boundary-country', before: null, paint: { 'line-color': 'red' } },
      { layerId: 'boundary_country_inner', before: null, paint: { 'line-color': 'red' } },
    ];
    await element.updateComplete;
    await waitUntil(() => peer.order.at(-1) === 'boundary-country');
    peer.idle = true; peer.fire('idle'); await element.whenIdle();
    expect(peer.paint.get('boundary-country:line-color')).to.equal('red');
    expect(peer.removed).to.equal(false);
    peer.setStyle = () => { seed('boundary_country_inner'); peer.fire('style.load'); return peer; };
    element.mapStyle = { version: 8, sources: {}, layers: [] };
    await element.whenStyleReady();
    expect(peer.order).to.deep.equal(['base', 'labels', 'boundary_country_inner']);
    expect(peer.paint.get('boundary_country_inner:line-color')).to.equal('red');
    expect(peer.removed).to.equal(false);
    element.styleOverrides = [];
    await element.updateComplete;
    await waitUntil(() => peer.order.join() === 'base,boundary_country_inner,labels');
  });

  it('waits for a modular object style commit before capturing basemap ordering and paint', async () => {
    const { element, peer } = await mount();
    const seed = (border: string) => {
      peer.layers.clear(); peer.paint.clear(); peer.order = [];
      for (const id of ['base', border, 'labels']) {
        const layer = { id, type: id === border ? 'line' : 'background' };
        peer.addLayer(layer);
      }
      peer.paint.set(`${border}:line-color`, 'black');
    };
    seed('boundary-country');
    element.styleOverrides = [
      { layerId: 'boundary-country', before: null, paint: { 'line-color': 'red' } },
      { layerId: 'boundary_country_inner', before: null, paint: { 'line-color': 'red' } },
    ];
    await element.updateComplete;
    await load(element, peer);
    peer.idle = true; peer.fire('idle'); await element.whenIdle();
    expect(peer.order).to.deep.equal(['base', 'labels', 'boundary-country']);
    expect(element.styleLayers.map(layer => layer.id)).to.deep.equal(['base', 'boundary-country', 'labels']);
    let commit!: () => void;
    peer.setStyle = () => {
      // Preparation retains the old ready style until this explicit commit.
      commit = () => { seed('boundary_country_inner'); peer.fire('style.load'); };
      return peer;
    };
    let ready = false;
    // The next connection selects this engine; the current modular peer still owns the style.
    element.engine = 'maplibre';
    element.mapStyle = { version: 8, sources: {}, layers: [] };
    const settled = element.whenStyleReady().then(() => { ready = true; });
    await element.updateComplete;
    await new Promise<void>(resolve => { setTimeout(resolve, 0); });
    expect(ready, 'The previous style must not satisfy object replacement readiness').to.equal(false);
    commit();
    await settled; await element.whenIdle();
    expect(peer.order).to.deep.equal(['base', 'labels', 'boundary_country_inner']);
    expect(peer.paint.get('boundary_country_inner:line-color')).to.equal('red');
    expect(element.styleLayers.map(layer => layer.id)).to.deep.equal(['base', 'boundary_country_inner', 'labels']);
    expect(peer.removed).to.equal(false);
    element.styleOverrides = [];
    await element.updateComplete; await element.whenIdle();
    expect(peer.order).to.deep.equal(['base', 'boundary_country_inner', 'labels']);
    expect(peer.paint.get('boundary_country_inner:line-color')).to.equal('black');
  });

  it('re-matches selector placement on style replacement and restores the new style baseline', async () => {
    const { element, peer } = await mount();
    const seed = (ids: string[]) => {
      peer.layers.clear(); peer.order = [];
      for (const id of ids) {
        const layer = { id, source: 'base', type: id.startsWith('border') ? 'line' : 'fill' };
        peer.addLayer(layer);
      }
    };
    seed(['base', 'border-a', 'fill', 'border-b', 'labels']);
    await load(element, peer);
    element.styleOverrides = [{ source: 'base', layerType: 'line', before: null }];
    await element.updateComplete;
    await waitUntil(() => peer.order.join() === 'base,fill,labels,border-a,border-b');
    peer.setStyle = () => { seed(['border-b', 'fill', 'border-a', 'labels', 'base']); peer.fire('style.load'); return peer; };
    element.mapStyle = { version: 8, sources: {}, layers: [] };
    await element.whenStyleReady();
    expect(peer.order).to.deep.equal(['fill', 'labels', 'base', 'border-b', 'border-a']);
    element.styleOverrides = [];
    await element.updateComplete;
    await waitUntil(() => peer.order.join() === 'border-b,fill,border-a,labels,base');
  });

  it('retires staged basemap placement when a newer style supersedes async feature preparation', async () => {
    const { element, peer } = await mount();
    for (const id of ['base', 'borders', 'labels']) peer.addLayer({ id });
    await load(element, peer);
    let release!: () => void;
    let preparing = false;
    const pending = new Promise<void>(resolve => { release = resolve; });
    OwnedMap.prepare = async requirements => {
      if ((requirements as { sources?: Record<string, unknown> }).sources?.['data-0']) { preparing = true; await pending; }
    };
    const move = peer.moveLayer.bind(peer);
    let moves = 0;
    peer.moveLayer = (id, before) => { moves += 1; move(id, before); };
    try {
      element.dataLayers = [{ sourceId: 'points', geojson: POINTS }];
      element.styleOverrides = [{ layerId: 'borders', before: null }];
      await element.updateComplete;
      await waitUntil(() => preparing);
      expect(moves).to.equal(0);
      peer.setStyle = () => {
        peer.layers.clear(); peer.order = [];
        for (const id of ['labels', 'borders', 'base']) peer.addLayer({ id });
        peer.fire('style.load'); return peer;
      };
      element.styleOverrides = []; element.dataLayers = [];
      element.mapStyle = { version: 8, sources: {}, layers: [] };
      await element.whenStyleReady();
      release();
      peer.idle = true; peer.fire('idle'); await element.whenIdle();
      expect(peer.order).to.deep.equal(['labels', 'borders', 'base']);
      expect(moves).to.equal(0);
    } finally { release(); }
  });

  it('stops native moves and rollback when a move disconnects the owning element', async () => {
    const { element, peer } = await mount();
    for (const id of ['base', 'a', 'b', 'labels']) peer.addLayer({ id });
    await load(element, peer);
    const move = peer.moveLayer.bind(peer);
    let moves = 0;
    peer.moveLayer = (id, before) => { moves += 1; move(id, before); element.remove(); };
    element.styleOverrides = [{ layerId: 'a', before: null }, { layerId: 'b', before: null }];
    await element.updateComplete;
    await waitUntil(() => peer.removed);
    expect(moves).to.equal(1);
    expect(peer.order).to.deep.equal(['base', 'a', 'labels', 'b']);
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
