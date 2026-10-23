import { expect, fixture, fixtureCleanup, html, waitUntil } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import './map.js';
import '../../../translations/de/shared.js';
import '../../../translations/de/media.js';
import { LYRA_MAP_EMPTY_STYLE, type LyraMap } from './map.js';
import type { LyraMapDrawingSnapshot, LyraMapDrawingVertexEndDetail, LyraMapInteractionDetail, LyraMapPointerDetail,
  LyraMapGeolocateDetail, LyraMapStyleSpecification } from './map.class.js';
import { loadMapControlRuntime, loadMapDrawingRuntime, loadMapOwnedFeatureRuntime } from './map-feature-loader.js';
import { ControlMapEngine, FakeGeolocateControl as Geolocate, FakeAttributionControl as Attribution } from '../../../../test/map-control-engine.js';

type Layer = { readonly id: string; readonly type?: string; readonly source?: string; readonly 'source-layer'?: string; readonly paint?: Record<string, unknown> };
/** A basemap with two vector POI layers, a road layer and a background, as a tiled style declares them. */
const BASEMAP: LyraMapStyleSpecification = {
  ...LYRA_MAP_EMPTY_STYLE,
  sources: { tiles: { type: 'vector', tiles: ['https://tiles.invalid/{z}/{x}/{y}.pbf'] } },
  layers: [
    { id: 'background', type: 'background', paint: { 'background-color': '#ffffff' } },
    { id: 'road', type: 'line', source: 'tiles', 'source-layer': 'transportation' },
    { id: 'poi-label', type: 'symbol', source: 'tiles', 'source-layer': 'poi' },
    { id: 'poi-dot', type: 'circle', source: 'tiles', 'source-layer': 'poi' },
  ],
} as unknown as LyraMapStyleSpecification;

/** The scripted engine, plus a loaded basemap style, paint storage, setData capture and projection. */
class ParityMap extends ControlMapEngine {
  readonly paint = new Map<string, unknown>();
  readonly data = new Map<string, unknown>();
  constructor(options: Record<string, unknown>) {
    super(options); this.loadStyle(options['style']);
    // Like the engine, the canvas is the focusable map region inside the container.
    this.canvas.tabIndex = 0; (options['container'] as HTMLElement).append(this.canvas);
  }
  private loadStyle(style: unknown): void {
    const spec = style as { sources?: Record<string, unknown>; layers?: Layer[] } | undefined;
    for (const [id, source] of Object.entries(spec?.sources ?? {})) { this.sourceDescriptors.set(id, source); }
    for (const layer of spec?.layers ?? []) { this.layers.set(layer.id, layer); this.order.push(layer.id); }
  }
  override setStyle(style?: unknown): this {
    this.sources.clear(); this.layers.clear(); this.sourceDescriptors.clear(); this.nativeStates.clear(); this.order = []; this.idle = false;
    this.loadStyle(style); this.ready = this.synchronousStyle;
    if (this.ready) this.fire('style.load');
    return this;
  }
  override addSource(id: string, source?: unknown): this {
    super.addSource(id, source); this.data.set(id, (source as { data?: unknown } | undefined)?.data);
    const native = this.sources.get(id)!, setData = native.setData;
    native.setData = (value: unknown) => { this.data.set(id, value); setData(value); };
    return this;
  }
  override setPaintProperty(id?: string, key?: string, value?: unknown): this { this.paint.set(`${id}:${key}`, value); return this; }
  getPaintProperty(id: string, key: string): unknown {
    return this.paint.has(`${id}:${key}`) ? this.paint.get(`${id}:${key}`) : (this.layers.get(id) as Layer | undefined)?.paint?.[key];
  }
  getLayoutProperty(): unknown { return undefined; }
  setLayoutProperty(): this { return this; }
  override project(point: readonly [number, number]) { return { x: point[0] * 10 + 100, y: point[1] * 10 + 100 }; }
  unproject(point: readonly [number, number]) { return { lng: (point[0] - 100) / 10, lat: (point[1] - 100) / 10 }; }
}

const originalObserver = window.IntersectionObserver;
const originalContext = HTMLCanvasElement.prototype.getContext;

async function create(configure: (element: LyraMap, wrapper: HTMLDivElement) => void = () => undefined) {
  const wrapper = await fixture<HTMLDivElement>(html`<div style="--parity-brand: rgb(10, 20, 30)"></div>`);
  const element = document.createElement('lr-map') as LyraMap;
  element.engine = 'maplibre'; element.mapStyle = BASEMAP;
  (element as unknown as { loadLibrary: () => Promise<unknown> }).loadLibrary = async () => ({ Map: ParityMap, GeolocateControl: Geolocate, AttributionControl: Attribution });
  configure(element, wrapper); wrapper.append(element);
  return { element, wrapper };
}
async function mount(configure: (element: LyraMap, wrapper: HTMLDivElement) => void = () => undefined) {
  const { element, wrapper } = await create(configure);
  await waitUntil(() => element.map !== undefined); await element.updateComplete;
  const peer = element.map as unknown as ParityMap;
  peer.fire('load'); await element.updateComplete; await element.whenStyleReady(); await element.updateComplete;
  return { element, peer, wrapper };
}
function capture<T = unknown>(element: LyraMap, type: string): T[] {
  const values: T[] = []; element.addEventListener(type, event => { values.push((event as CustomEvent<T>).detail); }); return values;
}
async function settle(element: LyraMap, peer: ParityMap) { await element.updateComplete; peer.idle = true; peer.fire('idle'); await element.whenIdle(); await element.updateComplete; }
function click(peer: ParityMap, lng: number, lat: number) { peer.fire('click', { point: { x: 1, y: 2 }, lngLat: { lng, lat } }); }
function part(element: LyraMap, name: string): HTMLElement | null { return element.shadowRoot!.querySelector<HTMLElement>(`[part~="${name}"]`); }
const frame = () => new Promise<void>(resolve => { requestAnimationFrame(() => { resolve(); }); });
/** Lays the scripted canvas out in the map so projected handles and labels have a viewport. */
async function surface(element: LyraMap, peer: ParityMap) {
  element.style.inlineSize = '320px'; element.style.blockSize = '320px';
  peer.canvas.style.cssText = 'width:100%;height:100%;display:block';
  element.shadowRoot!.querySelector('[part="container"]')!.append(peer.canvas);
  peer.canvas.setPointerCapture = () => undefined; peer.canvas.releasePointerCapture = () => undefined;
  await element.updateComplete; peer.fire('move'); await Promise.resolve(); await element.updateComplete;
}
function pointer(peer: ParityMap, type: string, x: number, y: number) {
  const rect = peer.canvas.getBoundingClientRect();
  peer.canvas.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, pointerId: 7, isPrimary: true, button: 0, clientX: rect.left + x, clientY: rect.top + y }));
}
async function drawing(mode: 'line' | 'polygon', configure?: (element: LyraMap, wrapper: HTMLDivElement) => void) {
  const result = await mount((element, wrapper) => { element.drawMode = mode; configure?.(element, wrapper); });
  await waitUntil(() => part(result.element, 'drawing-add')?.hasAttribute('disabled') === false);
  return result;
}
async function vertices(element: LyraMap, peer: ParityMap, points: readonly (readonly [number, number])[]) {
  for (const [lng, lat] of points) { click(peer, lng, lat); await settle(element, peer); }
}
function drawingSource(peer: ParityMap): string | undefined { return [...peer.sources.keys()].find(id => /^lr-drawing-\d+$/u.test(id)); }

describe('lr-map application parity', () => {
  before(() => Promise.all([loadMapDrawingRuntime(), loadMapOwnedFeatureRuntime(), loadMapControlRuntime()]));
  beforeEach(() => {
    ParityMap.initialReady = false; ParityMap.prepare = undefined; ParityMap.initialZoomGesture = true;
    Object.defineProperty(window, 'IntersectionObserver', { configurable: true, value: undefined });
    Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', { configurable: true, writable: true,
      value(this: HTMLCanvasElement, id: string, ...rest: unknown[]) { return id === 'webgl2' ? {} : originalContext.call(this, id as never, ...(rest as [])); } });
  });
  afterEach(() => {
    fixtureCleanup();
    Object.defineProperty(window, 'IntersectionObserver', { configurable: true, value: originalObserver });
    HTMLCanvasElement.prototype.getContext = originalContext;
  });

  describe('initialization="interaction"', () => {
    it('leaves the default visible initialization without an activation button', async () => {
      const { element } = await mount();
      expect(element.initialization).to.equal('visible'); expect(part(element, 'initialization-activate') === null).to.equal(true);
    });
    it('waits for host input behind a localized, accessible activation button and hands focus to the map', async () => {
      const { element } = await create(el => { el.initialization = 'interaction'; el.strings = { mapActivate: 'Open the map' }; });
      await waitUntil(() => part(element, 'initialization-activate') !== null);
      await new Promise(resolve => setTimeout(resolve, 50));
      expect(element.map).to.equal(undefined); expect(element.getAttribute('aria-busy')).to.equal('false');
      const button = part(element, 'initialization-activate')!;
      expect(button.localName).to.equal('button'); expect(button.textContent!.trim()).to.equal('Open the map');
      await expect(element).to.be.accessible();
      await focusByKeyboard(button); await sendKeys({ press: 'Enter' });
      await waitUntil(() => element.map !== undefined); await element.updateComplete;
      expect(part(element, 'initialization-activate') === null).to.equal(true);
      expect(element.shadowRoot!.activeElement?.localName).to.equal('canvas');
    });
    it('constructs on a wheel or touch on the host and after the optional delay', async () => {
      const wheel = await create(el => { el.initialization = 'interaction'; });
      await waitUntil(() => part(wheel.element, 'initialization-activate') !== null);
      wheel.element.dispatchEvent(new WheelEvent('wheel', { bubbles: true, deltaY: 10 }));
      await waitUntil(() => wheel.element.map !== undefined);
      const delayed = await create(el => { el.initialization = 'interaction'; el.initializationDelay = 400; });
      await waitUntil(() => part(delayed.element, 'initialization-activate') !== null);
      expect(delayed.element.map).to.equal(undefined);
      await waitUntil(() => delayed.element.map !== undefined, 'delay admits construction', { timeout: 4000 });
    });
    it('ignores an invalid delay and constructs at once when switched to eager', async () => {
      const { element } = await create(el => { el.initialization = 'interaction'; el.initializationDelay = -5; });
      await waitUntil(() => part(element, 'initialization-activate') !== null);
      await new Promise(resolve => setTimeout(resolve, 60)); expect(element.map).to.equal(undefined);
      element.initialization = 'eager'; await waitUntil(() => element.map !== undefined);
    });
  });

  describe('theme colors in overlay paint', () => {
    const overlays = (color: string) => ({ sources: [{ id: 'area', source: { type: 'geojson', data: { type: 'FeatureCollection', features: [] } } }],
      layers: [{ layer: { id: 'area-fill', type: 'fill', source: 'area', paint: { 'fill-color': ['case', ['has', 'x'], color, '#000000'], 'fill-opacity': 0.5 } } }] });
    const fill = (peer: ParityMap) => (peer.getPaintProperty('area-fill', 'fill-color') as unknown[])[2];
    it('resolves tokens to sRGB against the host and re-resolves them after a theme change', async () => {
      const { element, peer, wrapper } = await mount(el => { el.overlays = overlays('var(--parity-brand)'); });
      await settle(element, peer); expect(fill(peer)).to.equal('rgb(10, 20, 30)');
      const source = peer.getSource('area'), layer = peer.getLayer('area-fill');
      wrapper.style.setProperty('--parity-brand', 'rgb(200, 100, 50)');
      await waitUntil(() => fill(peer) === 'rgb(200, 100, 50)', 'theme change re-resolves overlay paint');
      expect(peer.getSource('area') === source).to.equal(true);
      expect(peer.getLayer('area-fill') === layer).to.equal(true);
    });
    it('converts CSS color functions the engine cannot parse, keeping plain colors untouched', async () => {
      const { element, peer } = await mount(el => { el.overlays = overlays('color-mix(in srgb, rgb(255, 0, 0), rgb(0, 0, 255))'); });
      await settle(element, peer); expect(fill(peer)).to.match(/^rgb\(128, 0, 128\)$|^rgb\(127, 0, 128\)$|^rgb\(128, 0, 127\)$/u);
      expect(((peer.layers.get('area-fill') as Layer).paint!['fill-color'] as unknown[])[3]).to.equal('#000000');
    });
  });

  describe('geolocation success', () => {
    it('emits the located position only from the control success and keeps errors sanitized', async () => {
      const { element, peer } = await mount(el => { el.controls = { geolocate: true, attribution: false }; });
      await waitUntil(() => peer.controls.size === 1); const control = [...peer.controls][0]!;
      const located = capture<LyraMapGeolocateDetail>(element, 'lr-map-geolocate');
      control.fire('geolocate', { coords: { longitude: 6.13, latitude: 49.61, accuracy: 18 } });
      control.fire('geolocate', { coords: { latitude: 42 } });
      expect(located).to.deep.equal([{ lngLat: [6.13, 49.61], accuracy: 18 }]); expect(Object.isFrozen(located[0])).to.equal(true);
    });
  });

  describe('drawing parity', () => {
    it('closes a polygon from a press on its first vertex, but not from a press 13 pixels away', async () => {
      const { element, peer } = await drawing('polygon'); await surface(element, peer);
      const completes = capture<LyraMapDrawingSnapshot>(element, 'lr-map-draw-complete');
      await vertices(element, peer, [[0, 0], [5, 0], [0, 5]]);
      pointer(peer, 'pointerdown', 113, 100); pointer(peer, 'pointerup', 113, 100); await element.updateComplete;
      expect(completes.length).to.equal(0);
      pointer(peer, 'pointerdown', 102, 101); pointer(peer, 'pointerup', 102, 101); await element.updateComplete;
      expect(completes.length).to.equal(1); expect(completes[0]!.geometry?.type).to.equal('Polygon'); expect(element.drawMode).to.equal('none');
    });
    it('renders a dashed rubber band to the pointer and closes it back to the first polygon vertex', async () => {
      const { element, peer } = await drawing('polygon'); await vertices(element, peer, [[0, 0], [5, 0]]);
      peer.fire('mousemove', { point: { x: 1, y: 2 }, lngLat: { lng: 3, lat: 4 } });
      const band = () => ((peer.data.get(drawingSource(peer) ?? '') as { features?: { properties: Record<string, unknown>; geometry: { coordinates: unknown } }[] } | undefined)
        ?.features ?? []).find(feature => feature.properties['preview'] === true);
      await waitUntil(() => band() !== undefined, 'rubber band rendered');
      expect(band()!.geometry.coordinates).to.deep.equal([[5, 0], [3, 4], [0, 0]]);
      const preview = [...peer.layers.values()].find(layer => (layer as Layer).id.endsWith('-preview')) as Layer;
      expect(preview.paint!['line-dasharray']).to.deep.equal([2, 2]);
      peer.fire('mouseout'); await waitUntil(() => band() === undefined, 'rubber band hidden when the pointer leaves');
    });
    it('shows localized measurement labels and a summary only when drawingMeasurements is set', async () => {
      const { element, peer } = await drawing('polygon', el => { el.lang = 'de'; }); await surface(element, peer);
      await vertices(element, peer, [[0, 0], [1, 0], [0, 1]]); await frame(); await element.updateComplete;
      expect(part(element, 'drawing-measurements') === null).to.equal(true); expect(part(element, 'drawing-summary') === null).to.equal(true);
      element.drawingMeasurements = true; await element.updateComplete;
      await waitUntil(() => element.shadowRoot!.querySelectorAll('[part="drawing-measurement"]').length === 4, 'segments, closing and area labelled');
      const labels = [...element.shadowRoot!.querySelectorAll<HTMLElement>('[part="drawing-measurement"]')].map(label => [label.dataset['kind'], label.textContent!.trim()]);
      expect(labels.map(([kind]) => kind)).to.deep.equal(['segment', 'segment', 'closing', 'area']);
      expect(labels[0]![1]).to.equal('111,2 km'); expect(labels[3]![1]).to.match(/^\S+ [\d.]+(,\d+)? km²$/u);
      expect(part(element, 'drawing-measurements')!.getAttribute('aria-hidden')).to.equal('true');
      expect(part(element, 'drawing-summary')!.textContent).to.equal(labels[3]![1]);
      await expect(element).to.be.accessible();
    });
    it('completes on Enter and removes the last vertex on Backspace while the map canvas has focus', async () => {
      const { element, peer } = await drawing('line');
      const changes = capture<LyraMapDrawingSnapshot>(element, 'lr-map-draw-change'), completes = capture(element, 'lr-map-draw-complete');
      await vertices(element, peer, [[0, 0], [1, 0], [2, 0]]);
      expect(peer.canvas.getAttribute('aria-keyshortcuts')).to.equal('Enter Backspace');
      const key = (name: string) => peer.canvas.dispatchEvent(new KeyboardEvent('keydown', { key: name, bubbles: true, cancelable: true }));
      expect(key('Backspace')).to.equal(false); expect(changes.at(-1)!.vertices.length).to.equal(2);
      document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); expect(completes.length).to.equal(0);
      expect(key('Enter')).to.equal(false); expect(completes.length).to.equal(1);
      expect(peer.canvas.hasAttribute('aria-keyshortcuts')).to.equal(false);
    });
    it('keeps an in-progress session across a mapStyle swap and restores its resources and gestures', async () => {
      const { element, peer } = await drawing('line');
      const cancels = capture(element, 'lr-map-draw-cancel'), completes = capture<LyraMapDrawingSnapshot>(element, 'lr-map-draw-complete');
      await vertices(element, peer, [[0, 0], [1, 0]]); expect(peer.zoomGesture).to.equal(false);
      element.mapStyle = { ...BASEMAP } as LyraMapStyleSpecification; await element.updateComplete; await element.whenStyleReady(); await settle(element, peer);
      expect(cancels.length).to.equal(0); expect(element.drawMode).to.equal('line'); expect(peer.zoomGesture).to.equal(false);
      await waitUntil(() => drawingSource(peer) !== undefined, 'drawing resources restored on the new style');
      await vertices(element, peer, [[2, 0]]);
      expect(element.completeDrawing()).to.equal(true); expect(completes[0]!.vertices).to.deep.equal([[0, 0], [1, 0], [2, 0]]);
      await settle(element, peer); expect(peer.zoomGesture).to.equal(true); expect(drawingSource(peer)).to.equal(undefined);
    });
    it('emits lr-map-draw-vertex-end once when a vertex drag is released, not for each move', async () => {
      const { element, peer } = await drawing('line'); await surface(element, peer); await vertices(element, peer, [[0, 0], [5, 0]]);
      const ends = capture<LyraMapDrawingVertexEndDetail>(element, 'lr-map-draw-vertex-end'), changes = capture(element, 'lr-map-draw-change');
      // Each move lands after the previous edit has rendered, as real pointer events do.
      pointer(peer, 'pointerdown', 150, 100); await element.updateComplete;
      pointer(peer, 'pointermove', 160, 100); await element.updateComplete;
      pointer(peer, 'pointermove', 170, 110); await element.updateComplete;
      pointer(peer, 'pointerup', 170, 110); await element.updateComplete;
      expect(changes.length).to.equal(3); expect(ends.length).to.equal(1);
      expect(ends[0]!.index).to.equal(1); expect(ends[0]!.vertices[1]).to.deep.equal([7, 1]); expect(Object.isFrozen(ends[0])).to.equal(true);
    });
    it('paints the temporary drawing with --lr-map-drawing-color and falls back to the accent', async () => {
      const { element, peer } = await drawing('line', el => { el.style.setProperty('--lr-map-drawing-color', 'rgb(1, 128, 3)'); });
      await vertices(element, peer, [[0, 0], [1, 0]]); const id = drawingSource(peer)!;
      expect((peer.layers.get(`${id}-line`) as Layer).paint!['line-color']).to.equal('rgb(1, 128, 3)');
      const unset = await drawing('line'); await vertices(unset.element, unset.peer, [[0, 0], [1, 0]]);
      expect((unset.peer.layers.get(`${drawingSource(unset.peer)!}-line`) as Layer).paint!['line-color']).not.to.equal('rgb(1, 128, 3)');
    });
  });

  describe('pointer and hover data', () => {
    it('reports the pointer at most once per frame with the latest position, then its leave', async () => {
      const { element, peer } = await mount();
      const moves = capture<LyraMapPointerDetail>(element, 'lr-map-pointer-move'), leaves = capture(element, 'lr-map-pointer-leave');
      peer.fire('mousemove', { point: { x: 10, y: 20 }, lngLat: { lng: 190, lat: 2 } });
      peer.fire('mousemove', { point: { x: 11, y: 21 }, lngLat: { lng: 1.5, lat: 2.5 } });
      expect(moves.length).to.equal(0); await frame(); await frame();
      expect(moves).to.deep.equal([{ lngLat: [1.5, 2.5], point: [11, 21] }]); expect(Object.isFrozen(moves[0]!.point)).to.equal(true);
      peer.fire('mouseout'); expect(leaves).to.deep.equal([null]);
      peer.fire('mouseout'); expect(leaves.length).to.equal(1);
    });
    it('adds a detached frozen GeoJSON feature with geometry to feature enter and leave', async () => {
      const { element, peer } = await mount(el => { el.interactiveBasemapLayers = [{ layerId: 'poi-dot' }]; });
      await settle(element, peer);
      const enters = capture<LyraMapInteractionDetail>(element, 'lr-map-feature-enter'), leaves = capture<LyraMapInteractionDetail>(element, 'lr-map-feature-leave');
      const geometry = { type: 'Polygon', coordinates: [[[0, 0], [1, 0], [1, 1], [0, 0]]] };
      peer.hits = [{ type: 'Feature', id: 4, layer: { id: 'poi-dot' }, source: 'tiles', sourceLayer: 'poi', properties: { name: 'Cafe' }, geometry }];
      peer.fire('mousemove', { point: { x: 1, y: 2 }, lngLat: { lng: 1, lat: 2 } });
      expect(enters.length).to.equal(1); const feature = enters[0]!.feature!;
      expect(feature).to.deep.equal({ type: 'Feature', id: 4, properties: { name: 'Cafe' }, geometry });
      expect(Object.isFrozen(feature) && Object.isFrozen(feature.geometry) && Object.isFrozen((feature.geometry as { coordinates: unknown[] }).coordinates[0])).to.equal(true);
      geometry.coordinates[0]![0]![0] = 9; expect((feature.geometry as { coordinates: number[][][] }).coordinates[0]![0]![0]).to.equal(0);
      peer.hits = []; peer.fire('mousemove', { point: { x: 5, y: 5 }, lngLat: { lng: 5, lat: 5 } });
      expect(leaves.length).to.equal(1); expect(leaves[0]!.feature === feature).to.equal(true);
    });
  });

  describe('basemap layer selectors and the style catalog', () => {
    it('lists the loaded basemap layers and sources, excluding resources the element adds', async () => {
      const { element, peer } = await mount(el => { el.dataLayers = [{ sourceId: 'mine', geojson: { type: 'FeatureCollection', features: [] } }]; });
      await settle(element, peer);
      expect(element.styleLayers).to.deep.equal([{ id: 'background', type: 'background' }, { id: 'road', type: 'line', source: 'tiles', sourceLayer: 'transportation' },
        { id: 'poi-label', type: 'symbol', source: 'tiles', sourceLayer: 'poi' }, { id: 'poi-dot', type: 'circle', source: 'tiles', sourceLayer: 'poi' }]);
      expect(element.styleSources).to.deep.equal([{ id: 'tiles', type: 'vector' }]); expect(Object.isFrozen(element.styleLayers)).to.equal(true);
    });
    it('opts basemap layers into interaction by source layer and type, with explicit ids first', async () => {
      const { element, peer } = await mount(el => { el.interactiveBasemapLayers = [{ sourceLayer: 'poi', layerType: 'symbol' }, { layerId: 'road', priority: 3 }]; });
      await settle(element, peer); const clicks = capture<{ hit?: { layerId: string; origin: string; sourceLayer?: string } }>(element, 'lr-map-click');
      for (const layer of ['poi-label', 'poi-dot', 'road']) {
        peer.hits = [{ type: 'Feature', id: 1, layer: { id: layer }, source: 'tiles', properties: {}, geometry: { type: 'Point', coordinates: [1, 2] } }];
        click(peer, 1, 2);
      }
      expect(clicks.map(detail => detail.hit?.layerId)).to.deep.equal(['poi-label', undefined, 'road']);
      expect(clicks[0]!.hit).to.include({ origin: 'basemap', sourceLayer: 'poi' });
    });
    it('applies one override to every layer a selector matches and restores them when it is removed', async () => {
      const { element, peer } = await mount(el => { el.styleOverrides = [{ sourceLayer: 'poi', paint: { 'icon-opacity': 0.4 } }, { layerId: 'poi-dot', paint: { 'icon-opacity': 1 } }]; });
      await settle(element, peer);
      expect(peer.paint.get('poi-label:icon-opacity')).to.equal(0.4); expect(peer.paint.get('poi-dot:icon-opacity')).to.equal(1);
      expect(peer.paint.has('road:icon-opacity')).to.equal(false);
      element.styleOverrides = []; await settle(element, peer); expect(peer.paint.get('poi-label:icon-opacity')).to.equal(null);
    });
    it('rejects a selector without fields and an entry mixing an id with a selector', async () => {
      for (const override of [{ paint: { 'icon-opacity': 0.4 } }, { layerId: 'road', sourceLayer: 'poi', paint: {} }, { sourceLayer: '', paint: {} }]) {
        const { element } = await create(el => { el.styleOverrides = [override as never]; });
        await waitUntil(() => element.map !== undefined); await element.updateComplete;
        const ready = element.whenStyleReady().then(() => 'ready', (error: Error) => error.name);
        (element.map as unknown as ParityMap).fire('load');
        expect(await ready, JSON.stringify(override)).to.equal('MapReadinessError');
        element.remove();
      }
    });
  });
});
