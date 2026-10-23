import { createMapModule, createMapModuleDemo, createMapModulePublisher } from '../../../../test/map-module-composition.js';
import { expect, fixture, fixtureCleanup, html, oneEvent, waitUntil } from '@open-wc/testing';
import { getWorkerUrl, setWorkerUrl } from '@aceshooting/lyra-map';
import { sendKeys } from '@web/test-runner-commands';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import { resetMouse, sendMouse } from '../../../../test/wtr-mouse.js';
import { LyraMap, LYRA_MAP_EMPTY_STYLE } from './map.js';
import { loadMapControlRuntime, loadMapDrawingRuntime, loadMapFeatureStateRuntime, loadMapHashRuntime, loadMapOwnedFeatureRuntime } from './map-feature-loader.js';
import type { LyraMapGeoJsonDataLayer, LyraMapInstance, LyraMapOverlays, LyraMapPickDetail, LyraMapDrawingSnapshot, LyraMapInteractionDetail, LyraMapPointerDetail } from './map.class.js';
void LyraMap;

/** Only real native methods, reached through the documented map getter. */
interface NativeMap extends LyraMapInstance {
  on(type: string, callback: () => void): this;
  off(type: string, callback: () => void): this;
  triggerRepaint(): void;
  getSource(id: string): unknown;
  getStyle(): { sources: Record<string, unknown>; layers: { id: string }[] };
  getLayer(id: string): unknown;
  hasImage(id: string): boolean;
  project(coordinates: [number, number]): { x: number; y: number };
  queryRenderedFeatures(point: { x: number; y: number }, options: { layers: string[] }): { layer: { id: string } }[];
  doubleClickZoom: { isEnabled(): boolean };
  dragPan: { isEnabled(): boolean };
}
const localStyle = () => ({ ...LYRA_MAP_EMPTY_STYLE, layers: [{ id: 'plain-background', type: 'background', paint: { 'background-color': '#ffffff' } }] });
function geometry(id: number | string = 7) {
  return { type: 'FeatureCollection', features: [{ type: 'Feature', id, properties: { name: 'Local area' },
    geometry: { type: 'Polygon', coordinates: [[[-5, -5], [5, -5], [5, 5], [-5, 5], [-5, -5]]] } }] };
}
function overlays(data = geometry()): LyraMapOverlays {
  return { sources: [{ id: 'local-area', source: { type: 'geojson', data, attribution: 'Local test geometry' } }], layers: [
    { interactive: true, layer: { id: 'local-fill', type: 'fill', source: 'local-area', paint: {
      'fill-color': ['case', ['boolean', ['feature-state', 'selected'], false], '#0000ff', '#ff0000'], 'fill-opacity': 1,
    } } },
  ] };
}
/** Every node an admission walk would visit: containers, strings, numbers and booleans alike. */
function countValues(root: unknown): number {
  let count = 0; const stack: unknown[] = [root];
  while (stack.length) {
    const value = stack.pop(); count += 1;
    if (Array.isArray(value)) stack.push(...value);
    else if (value !== null && typeof value === 'object') stack.push(...Object.values(value));
  }
  return count;
}
/** A 100 x 71 grid of 2-degree cells with 25-vertex rings; cell (50, 35), id 3550, is centred on 0,0. */
function largeGrid(color: string) {
  const features = [];
  for (let j = 0; j < 71; j++) for (let i = 0; i < 100; i++) {
    const x = (i - 50) * 2, y = (j - 35) * 2, ring: number[][] = [];
    const corners = [[x - 1, y - 1], [x + 1, y - 1], [x + 1, y + 1], [x - 1, y + 1]];
    for (let side = 0; side < 4; side++) {
      const [ax, ay] = corners[side]!, [bx, by] = corners[(side + 1) % 4]!;
      for (let step = 0; step < 6; step++) ring.push([ax! + (bx! - ax!) * step / 6, ay! + (by! - ay!) * step / 6]);
    }
    ring.push([...ring[0]!]);
    features.push({ type: 'Feature', id: j * 100 + i, properties: { kind: i === 49 && j === 35 ? 'excluded' : 'cell', color },
      geometry: { type: 'Polygon', coordinates: [ring] } });
  }
  return { type: 'FeatureCollection', features };
}
function largeOverlays(data: unknown): LyraMapOverlays {
  return { sources: [{ id: 'grid', source: { type: 'geojson', data } },
    { id: 'marker', source: { type: 'geojson', data: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [[40, -10], [40, 10]] } } } }], layers: [
    { interactive: false, layer: { id: 'marker-line', type: 'line', source: 'marker', paint: { 'line-color': '#00ff00', 'line-width': 4 } } },
    { interactive: true, before: 'marker-line', layer: { id: 'grid-fill', type: 'fill', source: 'grid', minzoom: 2, maxzoom: 6,
      filter: ['!=', ['get', 'kind'], 'excluded'],
      paint: {
        'fill-color': ['coalesce', ['feature-state', 'color'], ['match', ['get', 'kind'], 'cell', ['get', 'color'], '#000000']],
        'fill-opacity': ['interpolate', ['linear'], ['zoom'], 2, 1, 5, 1, 5.5, 0],
      } } },
  ] };
}
async function mount(configure: (el: LyraMap, wrapper: HTMLElement) => void = () => {}): Promise<{ el: LyraMap; wrapper: HTMLDivElement; outside: HTMLButtonElement }> {
  const wrapper = await fixture<HTMLDivElement>(html`<div style="inline-size:480px;position:relative"><button type="button">Outside map</button></div>`);
  const outside = wrapper.querySelector('button')!;
  const el = document.createElement('lr-map') as LyraMap;
  el.style.cssText = 'inline-size:480px;block-size:360px'; el.engine = 'modular';
  el.mapStyle = localStyle(); el.center = [0, 0]; el.zoom = 3; el.overlays = overlays();
  configure(el, wrapper);
  const loaded = oneEvent(el, 'lr-map-load'); wrapper.append(el); await loaded;
  await el.updateComplete; await el.whenIdle();
  expect(el.map !== undefined).to.equal(true);
  expect(el.map!.getCanvas().getContext('webgl2') !== null).to.equal(true);
  return { el, wrapper, outside };
}
const peer = (el: LyraMap): NativeMap => el.map as NativeMap;
async function click(element: HTMLElement): Promise<void> {
  const box = element.getBoundingClientRect();
  await sendMouse({ type: 'click', position: [Math.round(box.left + box.width / 2), Math.round(box.top + box.height / 2)] });
}
async function clickCanvas(el: LyraMap, x = 0.5, y = 0.5): Promise<void> {
  const box = peer(el).getCanvas().getBoundingClientRect();
  await sendMouse({ type: 'click', position: [Math.round(box.left + box.width * x), Math.round(box.top + box.height * y)] });
}
function button(el: LyraMap, part: string): HTMLButtonElement {
  const result = el.shadowRoot!.querySelector<HTMLButtonElement>(`[part~="${part}"]`);
  expect(result !== null).to.equal(true); return result!;
}
async function keyboardAction(el: LyraMap, part: string): Promise<void> {
  const target = button(el, part); await waitUntil(() => !target.disabled);
  await focusByKeyboard(target); await sendKeys({ press: 'Enter' }); await el.updateComplete;
}
/** Read synchronously inside an actual fresh render event; no retained drawing buffer needed. */
async function centerPixel(el: LyraMap, x = 0.5, y = 0.5): Promise<number[]> {
  await el.whenIdle(); const map = peer(el), canvas = map.getCanvas();
  return new Promise(resolve => {
    const rendered = () => {
      map.off('render', rendered);
      const gl = canvas.getContext('webgl2')!, rgba = new Uint8Array(4);
      gl.readPixels(Math.floor(canvas.width * x), Math.floor(canvas.height * (1 - y)), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, rgba);
      resolve(Array.from(rgba));
    };
    map.on('render', rendered); map.triggerRepaint();
  });
}
function color(actual: readonly number[], expected: readonly number[]): void {
  expect(expected.every((value, i) => Math.abs(value - actual[i]!) < 25)).to.equal(true);
}

describe('lr-map actual modular companion integration', function () {
  this.timeout(45000);
  let previousWorkerUrl: string;
  // These cases need a real WebGL2 context; a browser without one shows the map's fallback instead.
  before(function () { if (!document.createElement('canvas').getContext('webgl2')) this.skip(); });
  // Exercises the steady state after the on-demand runtime has loaded; map-lazy-runtimes.test.ts covers the loading itself.
  before(() => Promise.all([loadMapDrawingRuntime(), loadMapFeatureStateRuntime(), loadMapHashRuntime(), loadMapOwnedFeatureRuntime(), loadMapControlRuntime()]));
  beforeEach(() => {
    previousWorkerUrl = getWorkerUrl();
    setWorkerUrl(new URL('/__lyra-map-worker__/worker.mjs', location.origin).href);
  });
  afterEach(async () => { try { await resetMouse(); } finally { try { fixtureCleanup(); } finally { setWorkerUrl(previousWorkerUrl); } } });

  for (const engine of ['modular', 'maplibre'] as const) {
    it(`updates retained static canvas pixels by revision in ${engine}`, async () => {
      const canvas = document.createElement('canvas'); canvas.width = canvas.height = 8;
      const draw = (fill: string) => { const context = canvas.getContext('2d')!; context.fillStyle = fill; context.fillRect(0, 0, 8, 8); };
      draw('#ff0000');
      const layer = { kind: 'canvas' as const, sourceId: 'retained', canvas, animate: false,
        coordinates: [[-10, 10], [10, 10], [10, -10], [-10, -10]] as const };
      const { el } = await mount(element => { element.engine = engine; element.overlays = {}; element.dataLayers = [layer]; });
      const map = peer(el), id = Object.entries(map.getStyle().sources).find(([, source]) => (source as { type?: string }).type === 'canvas')![0];
      const source = map.getSource(id), nativeLayer = map.getLayer(`${id}-render`);
      color(await centerPixel(el), [255, 0, 0, 255]); draw('#0000ff');
      color(await centerPixel(el), [255, 0, 0, 255]);
      const uploaded = new Promise<number[]>(resolve => {
        const rendered = () => {
          map.off('render', rendered); const drawing = map.getCanvas(), gl = drawing.getContext('webgl2')!, rgba = new Uint8Array(4);
          gl.readPixels(Math.floor(drawing.width / 2), Math.floor(drawing.height / 2), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, rgba);
          resolve(Array.from(rgba));
        };
        map.on('render', rendered);
      });
      el.dataLayers = [{ ...layer, redrawRevision: 1 }]; await el.updateComplete; await el.whenIdle();
      color(await uploaded, [0, 0, 255, 255]);
      expect(map.getSource(id) === source).to.equal(true); expect(map.getLayer(`${id}-render`) === nativeLayer).to.equal(true);
      expect((source as { hasTransition(): boolean }).hasTransition()).to.equal(false);
      draw('#00ff00'); el.dataLayers = [{ ...layer, redrawRevision: 1 }]; await el.updateComplete; await el.whenIdle();
      color(await centerPixel(el), [0, 0, 255, 255]);
      el.mapStyle = localStyle(); await el.updateComplete; await el.whenIdle();
      color(await centerPixel(el), [0, 255, 0, 255]);
    });
  }

  it('shows a paint-only ramp switch on an idle map without replacing its source or layer', async () => {
    const data = geometry(); Object.assign(data.features[0]!.properties, { value: 1 });
    const { el } = await mount(element => {
      element.overlays = {}; element.style.setProperty('--lr-map-choropleth-fill-opacity', '1');
      element.choropleth = { sourceId: 'metric', geojson: data as NonNullable<LyraMap['choropleth']>['geojson'], field: 'value', stops: [[0, '#ff0000'], [2, '#ff0000']] };
    });
    const map = peer(el), id = Object.keys(map.getStyle().sources)[0]!, source = map.getSource(id), layer = map.getLayer(`${id}-fill`);
    color(await centerPixel(el), [255, 0, 0, 255]);
    let painted: number[] | undefined;
    let renders = 0;
    let lastPixel: number[] | undefined;
    const samples: number[][] = [];
    const rendered = () => {
      const canvas = map.getCanvas(), gl = canvas.getContext('webgl2')!, rgba = new Uint8Array(4);
      gl.readPixels(Math.floor(canvas.width / 2), Math.floor(canvas.height / 2), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, rgba);
      const sample = Array.from(rgba); renders++; lastPixel = sample;
      if (samples.length < 8) samples.push(sample);
      if ([0, 0, 255, 255].every((value, index) => Math.abs(value - sample[index]!) < 25)) painted = sample;
    };
    map.on('render', rendered);
    try {
      el.choropleth = { ...el.choropleth!, stops: [[0, '#0000ff'], [2, '#0000ff']] }; await el.updateComplete;
      // Data-driven paint can reload worker tiles; observe its own frames without forcing one.
      try { await waitUntil(() => painted !== undefined, 'The changed ramp did not render', { timeout: 5000 }); }
      catch (error) { throw new Error(`The changed ramp did not render: frames=${renders}, firstPixels=${JSON.stringify(samples)}, lastPixel=${JSON.stringify(lastPixel)}`, { cause: error }); }
      color(painted!, [0, 0, 255, 255]); await el.whenIdle();
    } finally { map.off('render', rendered); }
    expect(map.getSource(id) === source).to.equal(true); expect(map.getLayer(`${id}-fill`) === layer).to.equal(true);
  });

  for (const engine of ['modular', 'maplibre'] as const) {
    it(`updates mutable owned-layer fields in place and preserves feature state in ${engine}`, async () => {
      const data = geometry();
      const target = { origin: 'overlay' as const, source: 'local-area', id: 7 };
      const initial: LyraMapOverlays = {
        sources: [{ id: 'local-area', source: { type: 'geojson', data } }],
        layers: [{ interactive: true, layer: {
          id: 'local-fill', type: 'fill', source: 'local-area', minzoom: 2, maxzoom: 6,
          filter: ['==', ['get', 'name'], 'Local area'], layout: { visibility: 'visible' },
          paint: { 'fill-color': ['case', ['boolean', ['feature-state', 'selected'], false], '#0000ff', '#ff0000'], 'fill-opacity': 1 },
        } }],
      };
      const { el } = await mount(element => { element.engine = engine; element.overlays = initial; });
      const map = peer(el), source = map.getSource('local-area'), layer = map.getLayer('local-fill');
      expect(source !== undefined && layer !== undefined).to.equal(true);
      expect(el.setFeatureState(target, { selected: true })).to.equal(true); await el.whenIdle();
      color(await centerPixel(el), [0, 0, 255, 255]);

      el.overlays = { sources: initial.sources, layers: [{ interactive: true, layer: {
        id: 'local-fill', type: 'fill', source: 'local-area', minzoom: 1, maxzoom: 10,
        filter: ['has', 'name'],
        paint: { 'fill-color': ['case', ['boolean', ['feature-state', 'selected'], false], '#00ff00', '#ff0000'] },
      } }] };
      await el.updateComplete; await el.whenIdle();
      expect(map.getSource('local-area') === source).to.equal(true);
      expect(map.getLayer('local-fill') === layer).to.equal(true);
      expect(el.getFeatureState(target)).to.deep.equal({ selected: true });
      const changed = map.getStyle().layers.find(row => row.id === 'local-fill') as {
        paint?: Record<string, unknown>; layout?: Record<string, unknown>; filter?: unknown; minzoom?: number; maxzoom?: number;
      };
      expect(changed.paint?.['fill-opacity'] === undefined || changed.paint?.['fill-opacity'] === null).to.equal(true);
      expect(changed.layout?.['visibility'] === undefined || changed.layout?.['visibility'] === null).to.equal(true);
      expect(changed.filter).to.deep.equal(['has', 'name']);
      expect(changed.minzoom).to.equal(1); expect(changed.maxzoom).to.equal(10);
      color(await centerPixel(el), [0, 255, 0, 255]);
      const clicked = oneEvent(el, 'lr-map-click'); await clickCanvas(el);
      const detail = (await clicked).detail;
      expect(detail.hit?.origin).to.equal('overlay'); expect(detail.sourceId).to.equal('local-area');

      el.overlays = { sources: initial.sources, layers: [{ interactive: true, layer: {
        id: 'local-fill', type: 'fill', source: 'local-area',
        paint: { 'fill-color': ['case', ['boolean', ['feature-state', 'selected'], false], '#00ff00', '#ff0000'] },
      } }] };
      await el.updateComplete; await el.whenIdle();
      expect(map.getLayer('local-fill') === layer).to.equal(true);
      const reset = map.getStyle().layers.find(row => row.id === 'local-fill') as { filter?: unknown; minzoom?: number; maxzoom?: number };
      expect(reset.filter === undefined || reset.filter === null).to.equal(true);
      expect(reset.minzoom ?? 0).to.equal(0); expect(reset.maxzoom ?? 24).to.equal(24);
      expect(el.getFeatureState(target)).to.deep.equal({ selected: true });
    });
  }

  for (const engine of ['modular', 'maplibre'] as const) {
    it(`updates and replays validated local image pixels without replacing its source in ${engine}`, async () => {
      const canvas = document.createElement('canvas'); canvas.width = canvas.height = 8;
      const image = (fill: string) => { const context = canvas.getContext('2d')!; context.fillStyle = fill; context.fillRect(0, 0, 8, 8); return canvas.toDataURL('image/png'); };
      const row = { kind: 'image' as const, sourceId: 'local', url: image('#ff0000'), coordinates: [[-10, 10], [10, 10], [10, -10], [-10, -10]] as const };
      const { el } = await mount(element => { element.engine = engine; element.overlays = {}; element.dataLayers = [row]; });
      const map = peer(el), id = Object.entries(map.getStyle().sources).find(([, source]) => (source as { type?: string }).type === 'image')![0];
      const source = map.getSource(id), layer = map.getLayer(`${id}-render`);
      color(await centerPixel(el), [255, 0, 0, 255]);
      el.dataLayers = [{ ...row, url: image('#0000ff') }]; await el.updateComplete; await el.whenIdle();
      color(await centerPixel(el), [0, 0, 255, 255]);
      expect(map.getSource(id) === source).to.equal(true); expect(map.getLayer(`${id}-render`) === layer).to.equal(true);
      el.mapStyle = localStyle(); await el.updateComplete; await el.whenIdle(); color(await centerPixel(el), [0, 0, 255, 255]);
    });
  }

  it('admits font-face maps through the full native validator on construction and style replacement', async () => {
    // No symbol layer requests these fonts; this exercises native style validation without a font service.
    const initial = { ...localStyle(), 'font-faces': { Demo: [{ url: '/unused-font.woff2', 'unicode-range': ['U+0-7F'] }] } };
    const el = await fixture<LyraMap>(html`<lr-map engine="maplibre" initialization="eager"
      style="display:block;inline-size:480px;block-size:360px" .mapStyle=${initial}></lr-map>`);
    await el.whenStyleReady(); await el.whenIdle();
    const map = peer(el);
    expect(map !== undefined).to.equal(true);
    expect((map.getStyle() as unknown as Record<string, unknown>)['font-faces']).to.deep.equal(initial['font-faces']);
    const replacement = { ...localStyle(), 'font-faces': { Other: 'unused-other-font.woff2' } };
    el.mapStyle = replacement;
    await el.updateComplete; await el.whenStyleReady(); await el.whenIdle();
    expect(el.map === map).to.equal(true);
    expect((map.getStyle() as unknown as Record<string, unknown>)['font-faces']).to.deep.equal(replacement['font-faces']);
  });

  it('M01 settles real controls and camera hash ownership across reconnect', async () => {
    const originalUrl = location.href, originalState = history.state;
    let el: LyraMap | undefined;
    try {
      history.replaceState(originalState, '', `${location.pathname}${location.search}#unrelated=preserved`);
      const mounted = await mount(map => { map.controls = { navigation: true }; map.hash = 'nativeMap'; }); el = mounted.el;
      color(await centerPixel(el), [255, 0, 0, 255]);
      const oldMap = el.map!, oldCanvas = oldMap.getCanvas();
      const zoom = el.zoom; const moved = oneEvent(el, 'lr-map-view-change');
      await click(button(el, 'zoom-in')); const detail = (await moved).detail; await el.whenIdle();
      expect(detail.source).to.equal('user'); expect(el.zoom).to.be.greaterThan(zoom);
      expect(Math.abs(el.zoom - oldMap.getZoom()) < 0.001).to.equal(true);
      const fragment = new URLSearchParams(location.hash.slice(1));
      expect(fragment.get('unrelated')).to.equal('preserved'); expect(fragment.has('nativeMap')).to.equal(true);
      expect(Number(fragment.get('nativeMap')!.split('/')[0])).to.be.closeTo(el.zoom, 0.001);
      el.remove(); expect(oldCanvas.isConnected).to.equal(false); expect(el.map).to.equal(undefined);
      history.replaceState(originalState, '', `${location.pathname}${location.search}#unrelated=preserved&nativeMap=4/0/0`);
      const loaded = oneEvent(el, 'lr-map-load'); mounted.wrapper.append(el); await loaded; await el.whenIdle();
      expect(el.map === oldMap).to.equal(false); expect(el.zoom).to.be.closeTo(4, 0.001);
      expect(el.shadowRoot!.querySelectorAll('[part~="navigation"]').length).to.equal(1);
    } finally { el?.remove(); history.replaceState(originalState, '', originalUrl); }
  });

  it('M02 highlights typed feature identity, distinguishes coordinate picking and retires replaced state', async () => {
    const data = geometry(); const { el } = await mount(map => { map.overlays = overlays(data); });
    const target = { origin: 'overlay' as const, source: 'local-area', id: 7 };
    color(await centerPixel(el), [255, 0, 0, 255]);
    expect(el.setFeatureState(target, { selected: true })).to.equal(true); await el.whenIdle();
    expect(el.getFeatureState(target)).to.deep.equal({ selected: true }); color(await centerPixel(el), [0, 0, 255, 255]);
    el.pickMode = true; await el.updateComplete;
    const picks: LyraMapPickDetail[] = []; el.addEventListener('lr-map-pick', event => picks.push(event.detail));
    const picked = oneEvent(el, 'lr-map-pick'); await clickCanvas(el); const detail = (await picked).detail;
    expect(detail.trigger).to.equal('pointer'); expect(detail.hit?.id).to.equal(7);
    expect(detail.hit?.source).to.equal('local-area'); expect(detail.hit?.origin).to.equal('overlay'); expect(picks.length).to.equal(1);
    const background = oneEvent(el, 'lr-map-pick'); await clickCanvas(el, 0.08, 0.15);
    expect((await background).detail.hit).to.equal(undefined); expect(picks.length).to.equal(2);
    const centered = oneEvent(el, 'lr-map-pick'); await keyboardAction(el, 'pick-center'); const center = (await centered).detail;
    expect(center.trigger).to.equal('keyboard'); expect(center.hit).to.equal(undefined);
    expect(center.lngLat[0]).to.be.closeTo(0, 0.001); expect(center.lngLat[1]).to.be.closeTo(0, 0.001);
    el.mapStyle = localStyle(); await el.updateComplete; await el.whenIdle();
    expect(el.getFeatureState(target)).to.deep.equal({ selected: true }); color(await centerPixel(el), [0, 0, 255, 255]);
    const source = peer(el).getSource('local-area'); expect(source !== undefined).to.equal(true);
    const updated = geometry(); updated.features[0]!.properties.name = 'Updated local area';
    el.overlays = overlays(updated); await el.updateComplete; await el.whenIdle();
    expect(peer(el).getSource('local-area') === source).to.equal(true);
    expect(el.getFeatureState(target)).to.equal(undefined); color(await centerPixel(el), [255, 0, 0, 255]);
    expect(el.setFeatureState(target, { selected: true })).to.equal(true); await el.whenIdle();
    color(await centerPixel(el), [0, 0, 255, 255]);
    el.overlays = overlays(geometry(8)); await el.updateComplete; await el.whenIdle();
    expect(peer(el).getSource('local-area') === source).to.equal(true);
    expect(el.getFeatureState(target)).to.equal(undefined); color(await centerPixel(el), [255, 0, 0, 255]);
  });

  it('M03 draws through real center controls and restores native gestures after complete and cancel', async () => {
    const { el } = await mount(); const map = peer(el);
    const baseline = map.getStyle().layers.map(layer => layer.id).sort(); const doubleClick = map.doubleClickZoom.isEnabled();
    el.drawMode = 'line'; await el.updateComplete;
    await waitUntil(() => !button(el, 'drawing-add').disabled); expect(map.doubleClickZoom.isEnabled()).to.equal(false);
    for (const center of [[-1, 0], [0, 0], [1, 1]] as const) {
      expect(el.jumpTo({ center })).to.equal(true); await el.whenIdle(); await keyboardAction(el, 'drawing-add'); await el.whenIdle();
    }
    expect(map.getStyle().layers.length).to.be.greaterThan(baseline.length);
    await keyboardAction(el, 'drawing-undo'); await el.whenIdle();
    const completed = oneEvent(el, 'lr-map-draw-complete'); await keyboardAction(el, 'drawing-complete');
    const detail = (await completed).detail as LyraMapDrawingSnapshot;
    expect(detail.phase).to.equal('completed'); expect(detail.geometry?.type).to.equal('LineString');
    expect(detail.vertices).to.deep.equal([[-1, 0], [0, 0]]); expect(detail.metrics!.length).to.be.closeTo(111195, 100);
    expect(Object.isFrozen(detail) && Object.isFrozen(detail.vertices) && Object.isFrozen(detail.vertices[0])).to.equal(true);
    await el.whenIdle(); expect(map.getStyle().layers.map(layer => layer.id).sort()).to.deep.equal(baseline);
    expect(map.doubleClickZoom.isEnabled()).to.equal(doubleClick);
    el.drawMode = 'polygon'; await el.updateComplete; await waitUntil(() => !button(el, 'drawing-add').disabled);
    await keyboardAction(el, 'drawing-add');
    const escaped = oneEvent(el, 'lr-map-draw-cancel'); await sendKeys({ press: 'Escape' });
    expect((await escaped).detail.reason).to.equal('escape'); expect(el.drawMode).to.equal('none');
    expect(map.doubleClickZoom.isEnabled()).to.equal(doubleClick);
    el.drawMode = 'line'; await el.updateComplete; await waitUntil(() => !button(el, 'drawing-add').disabled);
    const superseded = oneEvent(el, 'lr-map-draw-cancel'); el.pickMode = true;
    expect((await superseded).detail.reason).to.equal('pick-mode'); await el.updateComplete; await el.whenIdle();
    expect(map.getStyle().layers.map(layer => layer.id).sort()).to.deep.equal(baseline);
    expect(map.doubleClickZoom.isEnabled()).to.equal(doubleClick);
  });

  it('M04 places an RTL anchor inside real boundaries without passive focus and closes once on Escape', async () => {
    const { el, wrapper, outside } = await mount(); wrapper.dir = 'rtl';
    const box = el.getBoundingClientRect(), wrapperBox = wrapper.getBoundingClientRect();
    const boundary = document.createElement('div');
    boundary.style.cssText = `position:absolute;left:${box.left - wrapperBox.left + 12}px;top:${box.top - wrapperBox.top + 12}px;width:${box.width - 24}px;height:${box.height - 24}px;pointer-events:none`;
    wrapper.append(boundary);
    const action = document.createElement('button'); action.slot = 'anchor'; action.textContent = 'Anchor action';
    action.style.cssText = 'inline-size:150px;block-size:44px'; el.append(action);
    el.anchorBoundary = boundary; el.anchorSafeArea = { inlineStart: 80, inlineEnd: 12, blockStart: 12, blockEnd: 12 }; el.anchorClosable = true;
    await focusByKeyboard(outside); el.anchorLngLat = [8, 0]; await el.updateComplete;
    const anchor = el.shadowRoot!.querySelector<HTMLElement>('[part="anchor"]')!;
    await waitUntil(() => !anchor.hidden && anchor.style.left !== '' && getComputedStyle(anchor).visibility !== 'hidden' && anchor.getBoundingClientRect().width > 0, 'Real projected anchor is placed');
    expect(document.activeElement === outside).to.equal(true);
    const first = anchor.getBoundingClientRect(), mapBox = el.getBoundingClientRect(), clip = boundary.getBoundingClientRect();
    expect(first.left).to.be.at.least(clip.left - 1); expect(first.right).to.be.at.most(clip.right + 1);
    expect(first.right).to.be.at.most(mapBox.right - 80 - 7);
    expect(first.top).to.be.at.least(clip.top - 1); expect(first.bottom).to.be.at.most(clip.bottom + 1);
    expect(el.jumpTo({ center: [6, 0] })).to.equal(true); await el.whenIdle();
    await waitUntil(() => Math.abs(anchor.getBoundingClientRect().left - first.left) > 10, 'Anchor follows native projection');
    expect(el.focusAnchor()).to.equal(true); expect(document.activeElement === action).to.equal(true);
    let count = 0; el.addEventListener('lr-map-anchor-close', () => { count++; });
    const closed = oneEvent(el, 'lr-map-anchor-close'); await sendKeys({ press: 'Escape' });
    expect((await closed).detail.reason).to.equal('escape'); await el.updateComplete;
    expect(anchor.hidden).to.equal(true); expect(document.activeElement === outside).to.equal(true);
    expect(el.closeAnchor()).to.equal(false); expect(count).to.equal(1);
  });

  it('M05 exports fresh native pixels with attribution and excludes DOM overlays for both engines', async () => {
    for (const engine of ['modular', 'maplibre'] as const) {
      const { el } = await mount(map => { map.engine = engine; map.controls = { attribution: false }; });
      try {
        const overlay = document.createElement('div'); overlay.slot = 'anchor';
        overlay.style.cssText = 'inline-size:180px;block-size:100px;background:#00ff00'; el.append(overlay);
        el.anchorLngLat = [0, 0]; await el.updateComplete;
        await waitUntil(() => !el.shadowRoot!.querySelector<HTMLElement>('[part="anchor"]')!.hidden);
        el.mapStyle = localStyle(); await el.updateComplete; await el.whenIdle();
        expect(el.setFeatureState({ origin: 'overlay', source: 'local-area', id: 7 }, { selected: true })).to.equal(true);
        const blob = await el.exportImage();
        expect(blob.type, engine).to.equal('image/png');
        expect([...new Uint8Array(await blob.slice(0, 8).arrayBuffer())]).to.deep.equal([137, 80, 78, 71, 13, 10, 26, 10]);
        const bitmap = await createImageBitmap(blob);
        try {
          const native = peer(el).getCanvas(), canvas = document.createElement('canvas');
          expect(bitmap.width, engine).to.equal(native.width); expect(bitmap.height, engine).to.be.greaterThan(native.height);
          canvas.width = bitmap.width; canvas.height = bitmap.height;
          const ctx = canvas.getContext('2d')!; ctx.drawImage(bitmap, 0, 0);
          color([...ctx.getImageData(Math.floor(native.width / 2), Math.floor(native.height / 2), 1, 1).data], [0, 0, 255, 255]);
          const footer = ctx.getImageData(0, native.height, bitmap.width, bitmap.height - native.height).data;
          let dark = 0; for (let i = 0; i < footer.length; i += 4) if (footer[i]! < 150 && footer[i + 1]! < 150 && footer[i + 2]! < 150 && footer[i + 3]! > 200) dark++;
          expect(dark, `${engine} attribution text painted with controls disabled`).to.be.greaterThan(20);
        } finally { bitmap.close(); }
        const withoutCredits = await createImageBitmap(await el.exportImage({ attribution: false }));
        try { expect(withoutCredits.height).to.equal(peer(el).getCanvas().height); } finally { withoutCredits.close(); }
      } finally { el.remove(); }
    }
  });

  it('M06 defers visible construction, admits eager and idle, and retires disconnected admission', async () => {
    const wrapper = await fixture<HTMLDivElement>(html`<div style="position:absolute;left:-10000px;top:0;width:480px;height:360px"></div>`);
    const el = document.createElement('lr-map') as LyraMap;
    el.style.cssText = 'inline-size:480px;block-size:360px'; el.mapStyle = localStyle(); el.engine = 'modular';
    let loads = 0; el.addEventListener('lr-map-load', () => { loads++; });
    expect(el.initialization).to.equal('visible');
    expect(await LyraMap.preload('modular')).to.equal(true); expect(el.map).to.equal(undefined);
    wrapper.append(el); await el.updateComplete;
    await new Promise<void>(resolve => {
      const observer = new IntersectionObserver(entries => {
        if (entries.some(entry => entry.target === el && !entry.isIntersecting)) { observer.disconnect(); resolve(); }
      }); observer.observe(el);
    });
    expect(el.map).to.equal(undefined); expect(loads).to.equal(0);
    el.remove(); el.initialization = 'idle'; wrapper.append(el); el.remove();
    await el.updateComplete;
    await new Promise<void>(resolve => {
      if (typeof window.requestIdleCallback === 'function') window.requestIdleCallback(() => resolve(), { timeout: 1500 });
      else window.setTimeout(resolve, 0);
    });
    expect(el.map).to.equal(undefined); expect(loads).to.equal(0);
    el.initialization = 'eager'; const eager = oneEvent(el, 'lr-map-load'); wrapper.append(el); await eager; await el.whenIdle();
    const first = el.map!, canvas = first.getCanvas(); expect(loads).to.equal(1);
    el.remove(); expect(canvas.isConnected).to.equal(false); expect(el.map).to.equal(undefined);
    el.initialization = 'idle'; const idle = oneEvent(el, 'lr-map-load'); wrapper.append(el); await idle; await el.whenIdle();
    expect(el.map === first).to.equal(false); expect(loads).to.equal(2);
    expect(el.shadowRoot!.querySelectorAll('canvas.maplibregl-canvas').length).to.equal(1);
  });


  it('M07 edits a completed drawing through real vertex dragging and keyboard handles without moving the camera', async () => {
    const { el } = await mount(), map = peer(el);
    const baseline = Object.keys(map.getStyle().sources).sort(), pan = map.dragPan.isEnabled(), zoom = map.doubleClickZoom.isEnabled();
    el.drawMode = 'line'; await el.updateComplete; await waitUntil(() => !button(el, 'drawing-add').disabled);
    for (const center of [[-2, 0], [2, 1]] as const) { el.jumpTo({ center }); await el.whenIdle(); await keyboardAction(el, 'drawing-add'); }
    const done = oneEvent(el, 'lr-map-draw-complete'); await keyboardAction(el, 'drawing-complete');
    const original = (await done).detail as LyraMapDrawingSnapshot; await el.whenIdle();
    expect(Object.keys(map.getStyle().sources).sort()).to.deep.equal(baseline);
    el.jumpTo({ center: [0, 0] }); await el.whenIdle();
    expect(el.editDrawing(original)).to.equal(true); await el.whenIdle(); await el.updateComplete;
    await waitUntil(() => el.shadowRoot!.querySelectorAll('[part="drawing-vertex"]').length === 2);
    const retainedSources = Object.keys(map.getStyle().sources).sort(), camera = { ...map.getCenter() };
    const changes: LyraMapDrawingSnapshot[] = []; let completions = 0;
    el.addEventListener('lr-map-draw-change', event => { changes.push((event as CustomEvent<LyraMapDrawingSnapshot>).detail); });
    el.addEventListener('lr-map-draw-complete', () => { completions++; });
    const handle = button(el, 'drawing-vertex'), rect = handle.getBoundingClientRect();
    const x = Math.round(rect.left + rect.width / 2), y = Math.round(rect.top + rect.height / 2);
    await sendMouse({ type: 'move', position: [x, y] }); await sendMouse({ type: 'down' });
    expect(map.dragPan.isEnabled()).to.equal(false);
    try { await sendMouse({ type: 'move', position: [x + 12, y + 6] }); await sendMouse({ type: 'move', position: [x + 24, y + 12] }); }
    finally { await sendMouse({ type: 'up' }); }
    await waitUntil(() => changes.length > 0); await el.whenIdle();
    const dragged = changes.at(-1)!;
    expect(dragged.phase).to.equal('completed'); expect(dragged.vertices[0]).not.to.deep.equal(original.vertices[0]);
    expect(dragged.geometry?.type).to.equal('LineString'); expect(dragged.metrics!.length).not.to.equal(original.metrics!.length);
    expect(Object.isFrozen(dragged) && Object.isFrozen(dragged.metrics) && Object.isFrozen(dragged.geometry)).to.equal(true);
    expect(map.getCenter().lng).to.be.closeTo(camera.lng, 1e-9); expect(map.getCenter().lat).to.be.closeTo(camera.lat, 1e-9);
    expect(map.dragPan.isEnabled()).to.equal(pan); expect(completions).to.equal(0);
    expect(Object.keys(map.getStyle().sources).sort()).to.deep.equal(retainedSources);
    await focusByKeyboard(button(el, 'drawing-vertex')); await sendKeys({ press: 'ArrowUp' }); await el.whenIdle();
    expect(changes.at(-1)!.vertices[0]).not.to.deep.equal(dragged.vertices[0]);
    await keyboardAction(el, 'drawing-complete'); await el.whenIdle();
    expect(completions).to.equal(1); expect(Object.keys(map.getStyle().sources).sort()).to.deep.equal(baseline);
    expect(map.doubleClickZoom.isEnabled()).to.equal(zoom); expect(map.dragPan.isEnabled()).to.equal(pan);
    expect(el.shadowRoot!.querySelector('[part="drawing-vertex"]') === null).to.equal(true);
  });
  it('renders a 600,000-value GeoJSON overlay with native paint, filter, zoom gating, order, picking and state across style swaps', async () => {
    const data = largeGrid('#ff0000');
    expect(countValues(data)).to.be.greaterThan(600_000);
    const { el } = await mount(map => { map.overlays = largeOverlays(data); });
    const map = peer(el); const clicks: { origin?: string; sourceId?: string; hit?: { id?: unknown; source: string } }[] = [];
    el.addEventListener('lr-map-click', event => { clicks.push(event.detail); });
    const ids = map.getStyle().layers.map(layer => layer.id);
    expect(ids.indexOf('grid-fill')).to.be.lessThan(ids.indexOf('marker-line'));
    color(await centerPixel(el), [255, 0, 0, 255]);
    await clickCanvas(el); await waitUntil(() => clicks.length === 1);
    expect(clicks[0]!.origin).to.equal('overlay'); expect(clicks[0]!.sourceId).to.equal('grid');
    expect(clicks[0]!.hit!.id).to.equal(3550); expect(clicks[0]!.hit!.source).to.equal('grid');
    const excluded = map.project([-2, 0]), box = map.getCanvas().getBoundingClientRect();
    await sendMouse({ type: 'click', position: [Math.round(box.left + excluded.x), Math.round(box.top + excluded.y)] });
    await waitUntil(() => clicks.length === 2); expect(clicks[1]!.hit).to.equal(undefined);
    const target = { origin: 'overlay' as const, source: 'grid', id: 3550 };
    expect(el.setFeatureState(target, { color: '#0000ff' })).to.equal(true); await el.whenIdle();
    color(await centerPixel(el), [0, 0, 255, 255]);
    for (const [zoom, painted] of [[5.75, false], [6.5, false], [3, true]] as const) {
      expect(el.jumpTo({ zoom })).to.equal(true); await el.whenIdle();
      if (!painted) color(await centerPixel(el), [255, 255, 255, 255]);
      const count = clicks.length; await clickCanvas(el); await waitUntil(() => clicks.length > count);
      expect(clicks.at(-1)!.hit === undefined, `zoom ${zoom}`).to.equal(!painted);
    }
    for (let swap = 0; swap < 3; swap++) {
      el.mapStyle = localStyle(); await el.updateComplete; await el.whenIdle();
      expect(map.getSource('grid') !== undefined, `swap ${swap}`).to.equal(true);
      const order = map.getStyle().layers.map(layer => layer.id);
      expect(order.indexOf('grid-fill')).to.be.lessThan(order.indexOf('marker-line'));
      color(await centerPixel(el), [0, 0, 255, 255]);
    }
    const source = map.getSource('grid');
    el.overlays = largeOverlays(largeGrid('#00ff00')); await el.updateComplete; await el.whenIdle();
    expect(map.getSource('grid') === source).to.equal(true); expect(el.getFeatureState(target)).to.equal(undefined);
    color(await centerPixel(el), [0, 255, 0, 255]);
  });

  it('supplies lazy SDF icons, takes a sprite catalog beyond 64 and changes images without re-adding layers', async () => {
    const square = '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><rect width="32" height="32" fill="#ffffff"/></svg>';
    const catalog = Array.from({ length: 100 }, (_, index) => ({ id: `poi-${index}`, width: 8, height: 8, pixelRatio: 1,
      source: { kind: 'svg' as const, markup: square.replace('#ffffff', '#ff0000') } }));
    const asked: string[] = [];
    const pins: LyraMapOverlays = { sources: [{ id: 'pins', source: { type: 'geojson', data: { type: 'FeatureCollection', features: [
      { type: 'Feature', id: 1, properties: { icon: 'station-body' }, geometry: { type: 'Point', coordinates: [0, 0] } }] } } }],
    layers: [{ interactive: true, layer: { id: 'pins-icon', type: 'symbol', source: 'pins',
      layout: { 'icon-image': ['get', 'icon'], 'icon-allow-overlap': true }, paint: { 'icon-color': '#0000ff' } } }] };
    const { el } = await mount(map => {
      map.overlays = pins; map.images = catalog;
      map.imageProvider = async id => { asked.push(id); return { id, width: 32, height: 32, pixelRatio: 1, sdf: true, source: { kind: 'svg', markup: square } }; };
    });
    const map = peer(el);
    await waitUntil(() => map.hasImage('station-body'), 'provider image added'); await el.whenIdle();
    expect(asked).to.deep.equal(['station-body']); expect(map.hasImage('poi-99')).to.equal(true);
    color(await centerPixel(el), [0, 0, 255, 255]);
    const clicked = oneEvent(el, 'lr-map-click'); await clickCanvas(el);
    const detail = (await clicked).detail; expect(detail.sourceId).to.equal('pins'); expect(detail.hit?.id).to.equal(1);
    const layer = map.getLayer('pins-icon');
    el.images = [...catalog.slice(1), { ...catalog[0]!, id: 'poi-extra' }]; await el.updateComplete; await el.whenIdle();
    expect(map.hasImage('poi-0')).to.equal(false); expect(map.hasImage('poi-extra')).to.equal(true);
    expect(map.getLayer('pins-icon') === layer).to.equal(true);
    el.mapStyle = localStyle(); await el.updateComplete; await el.whenIdle();
    await waitUntil(() => map.hasImage('station-body'), 'provider image re-added after a style swap');
    expect(asked).to.deep.equal(['station-body']); color(await centerPixel(el), [0, 0, 255, 255]);
    el.overlays = {}; await el.updateComplete; await el.whenIdle();
    el.imageProvider = undefined; await el.updateComplete; await el.whenIdle();
    expect(map.hasImage('station-body')).to.equal(false);
  });

  it('M08 queries real canvas footprints through priority, zoom, category, update, replay and removal', async () => {
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 8;
    const context = canvas.getContext('2d')!; context.fillStyle = '#0000ff'; context.fillRect(0, 0, 2, 8);
    expect(context.getImageData(4, 4, 1, 1).data[3]).to.equal(0);
    const coordinates = [[-5, 5], [5, 5], [5, -5], [-5, -5]] as const;
    const bottom = { kind: 'canvas' as const, sourceId: 'bottom', canvas, coordinates, animate: false, minZoom: 0, maxZoom: 4, category: 'bottom' };
    const top = { ...bottom, sourceId: 'top', category: 'top' };
    const { el } = await mount(element => { element.overlays = {}; element.dataLayers = [bottom, top]; });
    const map = peer(el); const clicks: { sourceId?: string; hit?: { source: string; id?: unknown; sourceLayer?: string; target?: unknown } }[] = [];
    el.addEventListener('lr-map-click', event => { clicks.push(event.detail); });
    const hitLayers = () => map.getStyle().layers.filter(layer => layer.id.endsWith('-hit')).map(layer => layer.id);
    expect(hitLayers().length, 'interactive canvas requires real native footprint layers').to.equal(2);
    const point = map.project([0, 0]);
    const canvasBox = map.getCanvas().getBoundingClientRect();
    await sendMouse({ type: 'move', position: [Math.round(canvasBox.left + point.x), Math.round(canvasBox.top + point.y)] });
    await waitUntil(() => map.getCanvas().style.cursor === 'pointer', 'Native footprint hover owns the pointer cursor');
    expect([...new Set(map.queryRenderedFeatures(point, { layers: hitLayers() }).map(feature => feature.layer.id))].sort()).to.deep.equal(hitLayers().sort());
    await clickCanvas(el); await waitUntil(() => clicks.length === 1);
    expect(clicks.at(-1)!.sourceId).to.equal('top'); expect(clicks.at(-1)!.hit!.source).to.equal('top');
    expect(clicks.at(-1)!.hit!.id).to.equal(undefined); expect(clicks.at(-1)!.hit!.sourceLayer).to.equal(undefined);
    expect(clicks.at(-1)!.hit!.target).to.equal(undefined);
    await clickCanvas(el, 0.9); await waitUntil(() => clicks.length === 2);
    expect(clicks.at(-1)!.sourceId).to.equal(undefined); expect(clicks.at(-1)!.hit).to.equal(undefined);
    el.dataLayers = [{ ...bottom, priority: 9 }, top]; await el.updateComplete; await el.whenIdle();
    await clickCanvas(el); await waitUntil(() => clicks.length === 3); expect(clicks.at(-1)!.sourceId).to.equal('bottom');
    el.hiddenCategories = ['bottom']; await el.updateComplete; await el.whenIdle();
    await clickCanvas(el); await waitUntil(() => clicks.length === 4); expect(clicks.at(-1)!.sourceId).to.equal('top');
    expect(el.jumpTo({ zoom: 5 })).to.equal(true); await el.whenIdle();
    await clickCanvas(el); await waitUntil(() => clicks.length === 5); expect(clicks.at(-1)!.hit).to.equal(undefined);
    expect(el.jumpTo({ zoom: 3 })).to.equal(true); await el.whenIdle();
    el.mapStyle = localStyle(); await el.updateComplete; await el.whenIdle();
    await clickCanvas(el); await waitUntil(() => clicks.length === 6); expect(clicks.at(-1)!.sourceId).to.equal('top');
    const moved = [[10, 5], [20, 5], [20, -5], [10, -5]] as const;
    el.dataLayers = [{ ...bottom, coordinates: moved }, { ...top, coordinates: moved }]; await el.updateComplete; await el.whenIdle();
    await clickCanvas(el); await waitUntil(() => clicks.length === 7); expect(clicks.at(-1)!.hit).to.equal(undefined);
    const movedPoint = map.project([15, 0]), box = map.getCanvas().getBoundingClientRect();
    await sendMouse({ type: 'click', position: [Math.round(box.left + movedPoint.x), Math.round(box.top + movedPoint.y)] });
    await waitUntil(() => clicks.length === 8); expect(clicks.at(-1)!.sourceId).to.equal('top');
    el.dataLayers = []; await el.updateComplete; await el.whenIdle();
    expect(hitLayers()).to.deep.equal([]); expect(Object.keys(map.getStyle().sources)).to.deep.equal([]);
    expect(map.getCanvas().style.cursor).not.to.equal('pointer');
    await clickCanvas(el); await waitUntil(() => clicks.length === 9); expect(clicks.at(-1)!.hit).to.equal(undefined);
  });

  it('builds an interaction-initialized map from a real press on its activation button', async () => {
    const wrapper = await fixture<HTMLDivElement>(html`<div style="inline-size:480px"></div>`);
    const el = document.createElement('lr-map') as LyraMap;
    el.style.cssText = 'inline-size:480px;block-size:360px'; el.engine = 'modular'; el.mapStyle = localStyle();
    el.initialization = 'interaction'; wrapper.append(el);
    await waitUntil(() => el.shadowRoot!.querySelector('[part="initialization-activate"]') !== null);
    // wait-reason: interaction mode must remain unconstructed after the placeholder settles without input.
    await new Promise(resolve => setTimeout(resolve, 100)); expect(el.map).to.equal(undefined);
    const loaded = oneEvent(el, 'lr-map-load'); await click(button(el, 'initialization-activate')); await loaded;
    expect(el.map!.getCanvas().getContext('webgl2') !== null).to.equal(true);
  });

  it('paints theme-token overlay colors and repaints them after a real theme change', async () => {
    const { el, wrapper } = await mount(map => {
      map.style.setProperty('--native-overlay', 'rgb(0, 160, 0)');
      map.overlays = { ...overlays(), layers: [{ layer: { id: 'local-fill', type: 'fill', source: 'local-area', paint: { 'fill-color': 'var(--native-overlay)', 'fill-opacity': 1 } } }] };
    });
    color(await centerPixel(el), [0, 160, 0, 255]);
    wrapper.style.setProperty('--unused', '1'); el.style.setProperty('--native-overlay', 'oklch(0.45 0.3 264)');
    let lastPixel: number[] = [];
    try {
      await waitUntil(async () => { lastPixel = await centerPixel(el); return lastPixel[2]! > 150; }, 'theme change repaints the overlay');
    } catch (error) {
      throw new Error(`Theme repaint failed: ${JSON.stringify({ lastPixel,
        token: getComputedStyle(el).getPropertyValue('--native-overlay'), layer: peer(el).getStyle().layers.find(layer => layer.id === 'local-fill') })}`, { cause: error });
    }
  });

  it('closes a polygon on its first vertex, measures it, keeps it across a style swap and edits by keyboard', async () => {
    const { el } = await mount(map => { map.overlays = {}; map.drawingMeasurements = true; }); const map = peer(el);
    const doubleClick = map.doubleClickZoom.isEnabled();
    el.drawMode = 'polygon'; await el.updateComplete; await waitUntil(() => !button(el, 'drawing-add').disabled);
    const box = () => map.getCanvas().getBoundingClientRect();
    const at = async (lngLat: [number, number], type: 'click' | 'move' = 'click') => {
      const point = map.project(lngLat), rect = box();
      await sendMouse({ type, position: [Math.round(rect.left + point.x), Math.round(rect.top + point.y)] }); await el.updateComplete;
    };
    const changes: LyraMapDrawingSnapshot[] = []; el.addEventListener('lr-map-draw-change', event => { changes.push(event.detail); });
    for (const lngLat of [[-4, -4], [4, -4], [4, 4]] as [number, number][]) { await at(lngLat); await waitUntil(() => changes.at(-1)?.vertices.length === changes.length); }
    await at([0, 6], 'move');
    await waitUntil(() => map.getStyle().layers.some(layer => layer.id.endsWith('-preview')), 'rubber band layer');
    await waitUntil(() => el.shadowRoot!.querySelectorAll('[part="drawing-measurement"]').length === 4, 'measurement labels');
    el.mapStyle = localStyle(); await el.updateComplete; await el.whenIdle();
    expect(el.drawMode).to.equal('polygon'); expect(map.doubleClickZoom.isEnabled()).to.equal(false);
    await waitUntil(() => map.getStyle().layers.some(layer => layer.id.startsWith('lr-drawing-')), 'drawing restored on the new style');
    map.getCanvas().focus(); await sendKeys({ press: 'Backspace' }); await waitUntil(() => changes.at(-1)!.vertices.length === 2);
    await at([4, 4]);
    const completed = oneEvent(el, 'lr-map-draw-complete'); await at([-4, -4]);
    const detail = (await completed).detail as LyraMapDrawingSnapshot;
    expect(detail.geometry?.type).to.equal('Polygon'); expect(detail.vertices.length).to.equal(3); expect(detail.metrics!.area).to.be.greaterThan(1e11);
    await el.whenIdle(); expect(map.doubleClickZoom.isEnabled()).to.equal(doubleClick);
    expect(map.getStyle().layers.some(layer => layer.id.startsWith('lr-drawing-'))).to.equal(false);
    el.drawMode = 'line'; await el.updateComplete; await waitUntil(() => !button(el, 'drawing-add').disabled);
    await at([-2, 0]); await at([2, 0]);
    const line = oneEvent(el, 'lr-map-draw-complete'); map.getCanvas().focus(); await sendKeys({ press: 'Enter' });
    expect(((await line).detail as LyraMapDrawingSnapshot).geometry?.type).to.equal('LineString');
  });

  it('reports frame-throttled pointer positions and hover features with real geometry', async () => {
    const { el } = await mount(); const map = peer(el);
    const enters: LyraMapInteractionDetail[] = []; el.addEventListener('lr-map-feature-enter', event => { enters.push(event.detail); });
    const moved = oneEvent(el, 'lr-map-pointer-move');
    const point = map.project([0, 0]), rect = map.getCanvas().getBoundingClientRect();
    await sendMouse({ type: 'move', position: [Math.round(rect.left + point.x), Math.round(rect.top + point.y)] });
    const detail = (await moved).detail as LyraMapPointerDetail;
    expect(detail.lngLat[0]).to.be.closeTo(0, 0.5); expect(detail.lngLat[1]).to.be.closeTo(0, 0.5);
    expect(detail.point[0]).to.be.closeTo(point.x, 1.5); expect(detail.point[1]).to.be.closeTo(point.y, 1.5);
    await waitUntil(() => enters.length === 1, 'hover enters the overlay feature');
    const feature = enters[0]!.feature!;
    expect(feature.id).to.equal(7); expect(feature.properties).to.deep.equal({ name: 'Local area' });
    expect(feature.geometry?.type).to.equal('Polygon'); expect(Object.isFrozen(feature.geometry)).to.equal(true);
    const left = oneEvent(el, 'lr-map-pointer-leave'); await sendMouse({ type: 'move', position: [2, 2] }); await left;
  });

  it('selects real basemap layers by source and type for overrides and interaction, and lists the style', async () => {
    const basemap = () => ({ ...LYRA_MAP_EMPTY_STYLE, sources: { base: { type: 'geojson', data: geometry(3) } }, layers: [
      { id: 'plain-background', type: 'background', paint: { 'background-color': '#ffffff' } },
      { id: 'base-fill', type: 'fill', source: 'base', paint: { 'fill-color': '#ff0000' } },
      { id: 'base-outline', type: 'line', source: 'base', paint: { 'line-color': '#000000' } },
    ] });
    const { el } = await mount(map => {
      map.overlays = {}; map.mapStyle = basemap() as never;
      map.styleOverrides = [{ source: 'base', layerType: 'fill', paint: { 'fill-color': 'rgb(0, 0, 255)' } }];
      map.interactiveBasemapLayers = [{ source: 'base', layerType: 'fill' }];
    });
    expect(el.styleLayers.map(layer => layer.id)).to.deep.equal(['plain-background', 'base-fill', 'base-outline']);
    expect(el.styleLayers[1]).to.deep.equal({ id: 'base-fill', type: 'fill', source: 'base' });
    expect(el.styleSources).to.deep.equal([{ id: 'base', type: 'geojson' }]);
    color(await centerPixel(el), [0, 0, 255, 255]);
    const clicked = oneEvent(el, 'lr-map-click'); await clickCanvas(el);
    const hit = (await clicked).detail.hit!; expect(hit.origin).to.equal('basemap'); expect(hit.layerId).to.equal('base-fill');
    el.styleOverrides = []; await el.updateComplete; await el.whenIdle(); color(await centerPixel(el), [255, 0, 0, 255]);
  });

  it('reports the position of a user-activated real geolocate control', async () => {
    const geolocation = navigator.geolocation;
    const own = Object.getOwnPropertyDescriptor(geolocation, 'getCurrentPosition');
    try {
      Object.defineProperty(geolocation, 'getCurrentPosition', { configurable: true, value(success: PositionCallback) {
        setTimeout(() => success({ coords: { longitude: 1.5, latitude: 2.5, accuracy: 30, altitude: null, altitudeAccuracy: null, heading: null, speed: null,
          toJSON() { return {}; } }, timestamp: Date.now(), toJSON() { return {}; } } as GeolocationPosition), 0);
      } });
      const { el } = await mount(map => { map.controls = { geolocate: true }; });
      await waitUntil(() => el.shadowRoot!.querySelector('[part~="geolocate"]') !== null, 'geolocate control installed');
      const located = oneEvent(el, 'lr-map-geolocate'); await click(button(el, 'geolocate'));
      expect((await located).detail).to.deep.equal({ lngLat: [1.5, 2.5], accuracy: 30 });
    } finally {
      if (own) Object.defineProperty(geolocation, 'getCurrentPosition', own); else Reflect.deleteProperty(geolocation, 'getCurrentPosition');
    }
  });


  it('replays eight modules with attributed hits and feature state while updating and removing independently', async () => {
    let modules = createMapModuleDemo('#ff0000');
    // Place districts at the existing native harness's center for deterministic picking.
    modules = Object.freeze({ ...modules, districts: createMapModule('districts', geometry(7), '#ff0000') });
    const { el } = await mount(map => { map.overlays = {}; });
    const publish = createMapModulePublisher(value => { el.overlays = value; });
    publish(modules); await el.updateComplete; await el.whenIdle();
    const source = peer(el).getSource('city:districts:data');
    const target = { origin: 'overlay' as const, source: 'city:districts:data', id: 7 };
    color(await centerPixel(el, 0.49, 0.51), [255, 0, 0, 255]);
    expect(el.setFeatureState(target, { color: '#0000ff' })).to.equal(true);
    await el.whenIdle();
    color(await centerPixel(el, 0.49, 0.51), [0, 0, 255, 255]);
    // Districts cover the center; other modules do not cover this interior coordinate.
    const clicked = oneEvent(el, 'lr-map-click'); await clickCanvas(el, 0.49, 0.51);
    const detail = (await clicked).detail;
    expect(detail.hit?.origin).to.equal('overlay'); expect(detail.sourceId).to.equal('city:districts:data');
    expect(detail.hit?.id).to.equal(7);
    const roads = createMapModule('roads', modules.roads!.sources[0]!.source['data'] as object, '#00ff00');
    const { alerts: _removed, ...remaining } = modules;
    modules = Object.freeze({ ...remaining, roads }); publish(modules); await el.updateComplete; await el.whenIdle();
    expect(peer(el).getSource('city:districts:data') === source).to.equal(true);
    expect(el.getFeatureState(target)).to.deep.equal({ color: '#0000ff' });
    expect(peer(el).getSource('city:alerts:data')).to.equal(undefined);
    expect(peer(el).getLayer('city:alerts:fill')).to.equal(undefined);
    const assigned = el.overlays;
    expect(() => publish({ ...modules, selection: modules.districts })).to.throw('duplicate-source:city:districts:data');
    expect(el.overlays === assigned).to.equal(true);
    el.mapStyle = localStyle(); await el.updateComplete; await el.whenIdle();
    expect(peer(el).getStyle().layers.filter(layer => layer.id.startsWith('city:')).length).to.equal(7);
    expect(el.getFeatureState(target)).to.deep.equal({ color: '#0000ff' });
    color(await centerPixel(el, 0.49, 0.51), [0, 0, 255, 255]);
    const replayed = oneEvent(el, 'lr-map-click'); await clickCanvas(el, 0.49, 0.51);
    expect((await replayed).detail.sourceId).to.equal('city:districts:data');
  });

  it('orders linked native controls, moves focused roots and reconnects in both peers and directions', async () => {
    for (const engine of ['modular', 'maplibre'] as const) for (const direction of ['ltr', 'rtl']) {
      const controls = (position: 'top-right' | 'bottom-left') => ({
        navigation: { position }, scale: { position }, geolocate: { position },
        attribution: { position, compact: true, customAttribution: { label: 'Survey <team>', url: 'https://example.com/credits' } },
      });
      const { el, wrapper } = await mount(map => { map.engine = engine; map.dir = direction; map.controls = controls('bottom-left'); });
      const roots = () => [
        el.shadowRoot!.querySelector<HTMLElement>('[part~="navigation"]'),
        el.shadowRoot!.querySelector<HTMLElement>('[part~="scale"]'),
        el.shadowRoot!.querySelector<HTMLElement>('[part~="geolocate"]')?.closest<HTMLElement>('.maplibregl-ctrl'),
        el.shadowRoot!.querySelector<HTMLElement>('[part~="attribution"]'),
      ];
      try {
        try {
          await waitUntil(() => roots().every(root => root?.isConnected), `${engine}/${direction} controls connected`);
        } catch (error) {
          throw new Error(`Control setup failed: ${JSON.stringify({ engine, direction, connected: roots().map(root => root?.isConnected ?? false),
            nativeControls: [...el.shadowRoot!.querySelectorAll('.maplibregl-ctrl')].map(root => root.className) })}`, { cause: error });
        }
        const assertOrder = () => {
          const boxes = roots().map(root => root!.getBoundingClientRect());
          for (let index = 1; index < boxes.length; index++) expect(boxes[index]!.top).to.be.at.least(boxes[index - 1]!.bottom);
        };
        assertOrder();
        const initial = roots();
        const zoom = button(el, 'zoom-in'); await focusByKeyboard(zoom);
        el.controls = controls('top-right'); await el.updateComplete;
        await waitUntil(() => roots().every(root => root?.parentElement?.classList.contains('maplibregl-ctrl-top-right')));
        expect(roots().every((root, index) => root === initial[index])).to.equal(true);
        expect(el.shadowRoot!.activeElement === zoom).to.equal(true); assertOrder();
        const mapBox = el.getBoundingClientRect(), navBox = roots()[0]!.getBoundingClientRect();
        expect(navBox.left < mapBox.left + mapBox.width / 2).to.equal(direction === 'rtl');
        const attribution = roots()[3] as HTMLDetailsElement;
        const disclosure = button(el, 'attribution-toggle'); await focusByKeyboard(disclosure);
        // Compact native attribution can start expanded. Establish the closed state with the keyboard.
        if (attribution.open) {
          await sendKeys({ press: 'Enter' });
          await waitUntil(() => !attribution.open, 'keyboard closes compact attribution');
        }
        const link = attribution.querySelector<HTMLAnchorElement>('a[href="https://example.com/credits"]')!;
        expect(link !== null).to.equal(true); expect(link.textContent).to.equal('Survey <team>');
        expect(link.target).to.equal('_blank'); expect(link.rel).to.equal('noopener noreferrer');
        expect(roots()[3]!.textContent).to.include('Local test geometry');
        expect(link.getClientRects().length, 'closed attribution hides its link').to.equal(0);
        await sendKeys({ press: 'Enter' });
        await waitUntil(() => attribution.open && link.getBoundingClientRect().width > 0 &&
          link.getBoundingClientRect().height > 0, 'keyboard opens a visible attribution link');
        await sendKeys({ press: 'Tab' });
        expect(el.shadowRoot!.activeElement === link, 'Tab reaches the visible attribution link').to.equal(true);
        el.remove(); const loaded = oneEvent(el, 'lr-map-load'); wrapper.append(el); await loaded;
        await waitUntil(() => roots().every(root => root?.isConnected));
        for (const part of ['navigation', 'scale', 'geolocate', 'attribution']) expect(el.shadowRoot!.querySelectorAll(`[part~="${part}"]`).length).to.equal(1);
        assertOrder();
      } finally { el.remove(); }
    }
  });


  for (const engine of ['modular', 'maplibre'] as const) it(`retains GeoJSON source identity while ordering groups and changing row bounds (${engine})`, async () => {
    const data = geometry(44);
    const row: LyraMapGeoJsonDataLayer = { sourceId: 'bounded-area', geojson: data as LyraMapGeoJsonDataLayer['geojson'], minZoom: 2, maxZoom: 5, before: 'local-fill', color: '#00ff00' };
    const { el } = await mount(map => { map.engine = engine; map.dataLayers = [row]; });
    const map = peer(el);
    const sourceId = Object.entries(map.getStyle().sources).find(([id, value]) => id !== 'local-area' &&
      (value as Record<string, unknown>)['type'] === 'geojson')![0];
    const source = map.getSource(sourceId), fill = `${sourceId}-fill`;
    expect(map.getStyle().layers.findIndex(layer => layer.id === fill)).to.be.lessThan(map.getStyle().layers.findIndex(layer => layer.id === 'local-fill'));
    expect(map.getLayer(fill)).to.include({ minzoom: 2, maxzoom: 5 });
    const clicked = oneEvent(el, 'lr-map-click'); await clickCanvas(el);
    expect((await clicked).detail.sourceId).to.equal('local-area');
    el.dataLayers = [{ ...row, before: undefined, minZoom: 3, maxZoom: 6 }];
    await el.updateComplete; await el.whenIdle();
    expect(map.getSource(sourceId) === source).to.equal(true);
    expect(map.getLayer(fill)).to.include({ minzoom: 3, maxzoom: 6 });
    // Unanchored generated groups follow their explicit declaration order, ahead of owned overlays.
    el.overlays = {}; await el.updateComplete; await el.whenIdle();
    const visible = oneEvent(el, 'lr-map-click'); await clickCanvas(el);
    expect((await visible).detail.sourceId).to.equal(row.sourceId);
    el.dataLayers = [{ ...row, before: undefined, minZoom: 3, maxZoom: 3 }];
    await el.updateComplete; await el.whenIdle();
    const hidden = oneEvent(el, 'lr-map-click'); await clickCanvas(el);
    expect((await hidden).detail.hit).to.equal(undefined);
    expect(map.getSource(sourceId) === source).to.equal(true);
    for (let index = 0; index < 3; index++) {
      el.mapStyle = localStyle(); await el.updateComplete; await el.whenStyleReady(); await el.whenIdle();
      const current = peer(el), layers = current.getStyle().layers.filter(layer => layer.id.startsWith('lr-data-layer-'));
      expect(layers.length).to.equal(3);
      for (const layer of layers) expect(current.getLayer(layer.id)).to.include({ minzoom: 3, maxzoom: 3 });
      const absent = oneEvent(el, 'lr-map-click'); await clickCanvas(el); expect((await absent).detail.hit).to.equal(undefined);
    }
  });

  it('adds a sprite catalog and lazy SDF provider together after the map is idle', async () => {
    const { el } = await mount(map => { map.overlays = {}; });
    const map = peer(el), asked: string[] = [];
    const square = '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><rect width="32" height="32" fill="#ffffff"/></svg>';
    const catalog = Array.from({ length: 243 }, (_, index) => ({ id: `late-icon-${index}`, width: 8, height: 8, pixelRatio: 1,
      source: { kind: 'svg' as const, markup: square.replace('#ffffff', '#ff0000') } }));
    el.images = catalog;
    el.imageProvider = id => { asked.push(id); return { id, width: 32, height: 32, pixelRatio: 1, sdf: true,
      source: { kind: 'svg', markup: square } }; };
    el.overlays = { sources: [{ id: 'late-pins', source: { type: 'geojson', data: { type: 'FeatureCollection', features: [
      { type: 'Feature', id: 1, properties: {}, geometry: { type: 'Point', coordinates: [0, 0] } },
    ] } } }], layers: [{ interactive: true, layer: { id: 'late-pins-icon', type: 'symbol', source: 'late-pins',
      layout: { 'icon-image': 'late-provider', 'icon-allow-overlap': true }, paint: { 'icon-color': '#0000ff' } } }] };
    await el.updateComplete; await el.whenIdle();
    await waitUntil(() => map.hasImage('late-provider'), 'late provider image added'); await el.whenIdle();
    expect(catalog.every(image => map.hasImage(image.id))).to.equal(true);
    expect(asked).to.deep.equal(['late-provider']);
    expect(el.map === map).to.equal(true); color(await centerPixel(el), [0, 0, 255, 255]);
    const clicked = oneEvent(el, 'lr-map-click'); await clickCanvas(el);
    const detail = (await clicked).detail;
    expect(detail.sourceId).to.equal('late-pins'); expect(detail.hit?.id).to.equal(1);
  });

});
