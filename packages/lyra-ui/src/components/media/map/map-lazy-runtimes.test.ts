import { expect, fixture, fixtureCleanup, html, waitUntil } from '@open-wc/testing';
import { ControlMapEngine, FakeAttributionControl as Attribution, FakeGeolocateControl as Geolocate } from '../../../../test/map-control-engine.js';
import * as anchorRuntime from './map-anchor-controller.js';
import * as controlRuntime from './map-controls-lifecycle.js';
import * as drawingRuntime from './map-drawing-controller.js';
import { MapDrawing, type LyraMapDrawingSnapshot } from './map-drawing.js';
import {
  __setMapFeatureImporterForTesting, loadMapAnchorRuntime, loadMapControlRuntime, loadMapDrawingRuntime, loadMapFeatureStateRuntime,
  loadMapHashRuntime, loadMapImageExportRuntime, loadMapImageRuntime, loadMapOwnedFeatureRuntime, loadMapStyleOverrideRuntime,
  type MapFeatureLoader,
} from './map-feature-loader.js';
import * as stateRuntime from './map-feature-state-routes.js';
import * as hashRuntime from './map-hash-owner.js';
import * as exportRuntime from './map-image-export-controller.js';
import { LyraMapImageExportError } from './map-image-export.js';
import * as imageRuntime from './map-images.js';
import * as ownedRuntime from './map-owned-features.js';
import * as overrideRuntime from './map-style-overrides.js';
import './map.js';
import { LYRA_MAP_EMPTY_STYLE, type LyraMap } from './map.js';

class LazyMap extends ControlMapEngine {
  readonly paint = new Map<string, unknown>();
  getPaintProperty(id: string, key: string): unknown { return this.paint.get(`${id}:${key}`); }
  getLayoutProperty(): unknown { return undefined; }
  setLayoutProperty(): this { return this; }
  override setPaintProperty(id?: string, key?: string, value?: unknown): this { if (id && key) this.paint.set(`${id}:${key}`, value); return this; }
}

const loaders: readonly MapFeatureLoader<unknown>[] = [loadMapAnchorRuntime, loadMapControlRuntime, loadMapDrawingRuntime, loadMapFeatureStateRuntime,
  loadMapHashRuntime, loadMapImageExportRuntime, loadMapImageRuntime, loadMapOwnedFeatureRuntime, loadMapStyleOverrideRuntime];

interface Gate { release(): void; fail(): void; readonly imports: number }
/** Holds one runtime's import until it is released or failed, counting the imports requested. */
function hold<T>(loader: MapFeatureLoader<T>, runtime: T): Gate {
  let release!: () => void, fail!: (error: Error) => void, imports = 0;
  const settled = new Promise<void>((resolve, reject) => { release = resolve; fail = reject; });
  settled.catch(() => undefined);
  __setMapFeatureImporterForTesting(loader, async () => { imports += 1; await settled; return runtime; });
  return { release: () => release(), fail: () => fail(new Error('Runtime chunk unavailable')), get imports() { return imports; } };
}
/** Counts imports of a runtime that otherwise loads normally. */
function count<T>(loader: MapFeatureLoader<T>, runtime: T): { readonly imports: number } {
  let imports = 0;
  __setMapFeatureImporterForTesting(loader, async () => { imports += 1; return runtime; });
  return { get imports() { return imports; } };
}

const originalObserver = window.IntersectionObserver;
const originalContext = HTMLCanvasElement.prototype.getContext;
let originalUrl: string;
let originalState: unknown;

function create(configure: (element: LyraMap) => void = () => undefined): LyraMap {
  const element = document.createElement('lr-map') as LyraMap;
  element.engine = 'maplibre'; element.mapStyle = LYRA_MAP_EMPTY_STYLE; element.style.inlineSize = '480px'; element.style.blockSize = '320px';
  (element as unknown as { loadLibrary: () => Promise<unknown> }).loadLibrary = async () => ({ Map: LazyMap, GeolocateControl: Geolocate, AttributionControl: Attribution });
  configure(element);
  return element;
}
async function mount(configure?: (element: LyraMap) => void) {
  const wrapper = await fixture<HTMLDivElement>(html`<div></div>`);
  const element = create(configure); wrapper.append(element);
  await waitUntil(() => element.map !== undefined); await element.updateComplete;
  const peer = element.map as unknown as LazyMap;
  peer.fire('load'); await element.updateComplete;
  return { element, peer, wrapper };
}
/** Mounts a map whose basemap style has a `water` fill layer for style overrides to target. */
async function mountWithBasemap(configure: (element: LyraMap) => void, prepare: (peer: LazyMap) => void = () => undefined) {
  const wrapper = await fixture<HTMLDivElement>(html`<div></div>`);
  const element = create(configure); wrapper.append(element);
  await waitUntil(() => element.map !== undefined); await element.updateComplete;
  const peer = element.map as unknown as LazyMap;
  peer.layers.set('water', { id: 'water', type: 'fill' }); peer.order.push('water'); prepare(peer);
  peer.fire('load'); await element.updateComplete;
  return { element, peer };
}
async function settle(element: LyraMap, peer: LazyMap): Promise<void> {
  await element.updateComplete; peer.idle = true; peer.fire('idle'); await element.whenIdle(); await element.updateComplete;
}
const tick = () => new Promise<void>(resolve => { setTimeout(resolve, 20); });
function capture(element: LyraMap, type: string): unknown[] {
  const values: unknown[] = []; element.addEventListener(type, event => { values.push((event as CustomEvent).detail); }); return values;
}
function completed(): LyraMapDrawingSnapshot {
  const drawing = new MapDrawing('line'); drawing.add([0, 0]); drawing.add([5, 0]); return drawing.complete().state;
}
const overlay = { sources: [{ id: 'local', source: { type: 'geojson', data: { type: 'FeatureCollection', features: [] } } }],
  layers: [{ layer: { id: 'local-fill', type: 'fill', source: 'local' } }] };
const text = (element: LyraMap) => element.shadowRoot!.textContent ?? '';

describe('lr-map on-demand runtimes', () => {
  beforeEach(() => {
    originalUrl = location.href; originalState = history.state; LazyMap.initialReady = true; LazyMap.prepare = undefined;
    Object.defineProperty(window, 'IntersectionObserver', { configurable: true, value: undefined });
    Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', { configurable: true, writable: true,
      value(this: HTMLCanvasElement, id: string, ...rest: unknown[]) { return id === 'webgl2' ? {} : originalContext.call(this, id as never, ...(rest as [])); } });
  });
  afterEach(() => {
    fixtureCleanup(); history.replaceState(originalState, '', originalUrl);
    for (const loader of loaders) __setMapFeatureImporterForTesting(loader);
    Object.defineProperty(window, 'IntersectionObserver', { configurable: true, value: originalObserver });
    HTMLCanvasElement.prototype.getContext = originalContext;
  });

  it('imports no optional runtime for a data map that uses none of those features', async () => {
    const counters = [count(loadMapAnchorRuntime, anchorRuntime), count(loadMapControlRuntime, controlRuntime), count(loadMapDrawingRuntime, drawingRuntime),
      count(loadMapFeatureStateRuntime, stateRuntime),
      count(loadMapHashRuntime, hashRuntime), count(loadMapImageExportRuntime, exportRuntime), count(loadMapImageRuntime, imageRuntime),
      count(loadMapOwnedFeatureRuntime, ownedRuntime), count(loadMapStyleOverrideRuntime, overrideRuntime)];
    const { element, peer } = await mount(el => {
      el.controls = { attribution: false }; el.anchorLngLat = null; el.hash = false;
      el.dataLayers = [{ sourceId: 'points', geojson: { type: 'FeatureCollection', features: [{ type: 'Feature', id: 1, properties: {}, geometry: { type: 'Point', coordinates: [0, 0] } }] } }];
    });
    await element.whenStyleReady(); await settle(element, peer);
    peer.fire('click', { point: { x: 1, y: 2 }, lngLat: { lng: 1, lat: 2 } });
    expect(element.undoDrawing()).to.equal(false); expect(element.completeDrawing()).to.equal(false); expect(element.cancelDrawing()).to.equal(false);
    expect(element.closeAnchor()).to.equal(false); expect(element.focusAnchor()).to.equal(false);
    expect(element.getFeatureState({ source: 'points', id: 1 })).to.equal(undefined);
    expect(peer.sources.size).to.equal(1); await tick();
    expect(counters.map(counter => counter.imports)).to.deep.equal([0, 0, 0, 0, 0, 0, 0, 0, 0]);
  });

  it('renders armed drawing controls at once and starts the session once its runtime loads, with whenIdle covering the load', async () => {
    const gate = hold(loadMapDrawingRuntime, drawingRuntime);
    const { element, peer } = await mount(el => { el.drawMode = 'line'; });
    await waitUntil(() => gate.imports === 1);
    const add = () => element.shadowRoot!.querySelector<HTMLButtonElement>('[part="drawing-add"]');
    expect(add()?.disabled).to.equal(true);
    expect(element.undoDrawing()).to.equal(false); expect(element.completeDrawing()).to.equal(false);
    let idle = false; void element.whenIdle().then(() => { idle = true; }, () => undefined);
    peer.idle = true; peer.fire('idle'); await tick(); expect(idle).to.equal(false);
    gate.release(); await waitUntil(() => idle); await element.updateComplete;
    expect(add()?.disabled).to.equal(false); expect(gate.imports).to.equal(1);
    const starts = capture(element, 'lr-map-draw-start');
    peer.fire('click', { point: { x: 1, y: 2 }, lngLat: { lng: 1, lat: 2 } });
    expect(starts.length).to.equal(1);
  });

  it('cancels an armed mode synchronously while its runtime loads, with the same frozen detail and no session afterwards', async () => {
    const gate = hold(loadMapDrawingRuntime, drawingRuntime);
    const { element, peer } = await mount(el => { el.drawMode = 'polygon'; });
    await waitUntil(() => gate.imports === 1); const cancels = capture(element, 'lr-map-draw-cancel');
    expect(element.cancelDrawing()).to.equal(true); expect(element.cancelDrawing()).to.equal(false);
    expect(element.drawMode).to.equal('none'); expect(cancels).to.deep.equal([{ mode: 'polygon', phase: 'cancelled', vertices: [], reason: 'cancel' }]);
    expect(Object.isFrozen(cancels[0]) && Object.isFrozen((cancels[0] as LyraMapDrawingSnapshot).vertices)).to.equal(true);
    gate.release(); await settle(element, peer);
    expect(element.shadowRoot!.querySelector('[part="drawing-controls"]') === null).to.equal(true); expect(peer.gestureCalls.length).to.equal(0);
  });

  it('returns false from editDrawing while its runtime loads, shares one import, then admits the snapshot after whenIdle', async () => {
    const gate = hold(loadMapDrawingRuntime, drawingRuntime);
    const { element, peer } = await mount(); await element.whenStyleReady(); const input = completed();
    expect(element.editDrawing(input)).to.equal(false); expect(element.editDrawing(input)).to.equal(false);
    expect(gate.imports).to.equal(1); expect(peer.sources.size).to.equal(0); expect(peer.gestureCalls.length).to.equal(0);
    gate.release(); await settle(element, peer);
    expect(element.editDrawing(input)).to.equal(true); await settle(element, peer);
    expect(peer.sources.size).to.equal(1); expect(element.cancelDrawing()).to.equal(true);
  });

  it('fails closed with localized drawing feedback when its runtime cannot load, and retries when drawing is requested again', async () => {
    const gate = hold(loadMapDrawingRuntime, drawingRuntime);
    const { element } = await mount(el => { el.drawMode = 'line'; el.strings = { mapDrawingUnavailable: 'Drawing tools unavailable' }; });
    await waitUntil(() => gate.imports === 1); gate.fail();
    await waitUntil(() => text(element).includes('Drawing tools unavailable'));
    expect(element.drawMode).to.equal('line'); await element.updateComplete; await tick(); expect(gate.imports).to.equal(1);
    __setMapFeatureImporterForTesting(loadMapDrawingRuntime, async () => drawingRuntime);
    element.drawMode = 'none'; await element.updateComplete; element.drawMode = 'line'; await element.updateComplete;
    await waitUntil(() => element.shadowRoot!.querySelector<HTMLButtonElement>('[part="drawing-add"]')?.disabled === false);
    expect(text(element)).not.to.include('Drawing tools unavailable');
  });

  it('returns false from setFeatureState while its runtime loads, then admits the write after whenIdle', async () => {
    const gate = hold(loadMapFeatureStateRuntime, stateRuntime);
    const geojson = { type: 'FeatureCollection' as const, features: [] };
    const { element, peer } = await mount(el => { el.dataLayers = [{ sourceId: 'points', geojson }]; });
    await element.whenStyleReady(); await settle(element, peer);
    const target = { origin: 'data-layer' as const, source: 'points', id: 1 };
    expect(element.setFeatureState(target, { selected: true })).to.equal(false); expect(element.removeFeatureState(target)).to.equal(false);
    expect(gate.imports).to.equal(1); expect(element.getFeatureState(target)).to.equal(undefined);
    let idle = false; void element.whenIdle().then(() => { idle = true; }, () => undefined); await tick(); expect(idle).to.equal(false);
    gate.release(); await waitUntil(() => idle);
    expect(element.setFeatureState(target, { selected: true })).to.equal(true); expect(element.getFeatureState(target)).to.deep.equal({ selected: true });
    await settle(element, peer); expect(peer.stateCalls.length).to.equal(1);
  });

  it('shows localized feature-state feedback when its runtime cannot load and retries after a new style', async () => {
    const gate = hold(loadMapFeatureStateRuntime, stateRuntime);
    const { element, peer } = await mount(el => {
      el.dataLayers = [{ sourceId: 'points', geojson: { type: 'FeatureCollection', features: [] } }];
      el.strings = { mapFeatureStateUnavailable: 'Highlighting unavailable' };
    });
    await element.whenStyleReady(); await settle(element, peer);
    const target = { origin: 'data-layer' as const, source: 'points', id: 1 };
    expect(element.setFeatureState(target, { selected: true })).to.equal(false); gate.fail();
    await waitUntil(() => text(element).includes('Highlighting unavailable'));
    expect(element.setFeatureState(target, { selected: true })).to.equal(false); expect(gate.imports).to.equal(1);
    __setMapFeatureImporterForTesting(loadMapFeatureStateRuntime, async () => stateRuntime);
    element.mapStyle = { ...LYRA_MAP_EMPTY_STYLE }; await element.updateComplete; await element.whenStyleReady(); await settle(element, peer);
    expect(element.setFeatureState(target, { selected: true })).to.equal(false); await element.whenIdle();
    expect(element.setFeatureState(target, { selected: true })).to.equal(true);
  });

  it('rejects an export with capture-failed and localized feedback when its runtime cannot load', async () => {
    const gate = hold(loadMapImageExportRuntime, exportRuntime);
    const { element } = await mount(el => { el.strings = { mapExportUnavailable: 'Export unavailable' }; });
    const errors = capture(element, 'lr-map-export-error');
    const pending = element.exportImage({ attribution: false }); gate.fail();
    let failure: unknown; try { await pending; } catch (error) { failure = error; }
    expect(failure instanceof LyraMapImageExportError && failure.code).to.equal('capture-failed');
    expect(errors).to.deep.equal([{ code: 'capture-failed' }]); await element.updateComplete;
    expect(text(element)).to.include('Export unavailable');
  });

  it('admits export options when called, before its runtime loads', async () => {
    const gate = hold(loadMapImageExportRuntime, exportRuntime);
    const { element } = await mount(); const errors = capture(element, 'lr-map-export-error');
    const options: { type: string } = { type: 'image/gif' };
    const pending = element.exportImage(options as never); options.type = 'image/png'; gate.release();
    let failure: unknown; try { await pending; } catch (error) { failure = error; }
    expect(failure instanceof LyraMapImageExportError && failure.code).to.equal('invalid-options'); expect(errors).to.deep.equal([{ code: 'invalid-options' }]);
  });

  it('cancels quietly when the style changes while the export runtime loads', async () => {
    const gate = hold(loadMapImageExportRuntime, exportRuntime);
    const { element } = await mount(); const errors = capture(element, 'lr-map-export-error');
    const pending = element.exportImage({ attribution: false });
    element.mapStyle = { ...LYRA_MAP_EMPTY_STYLE }; await element.updateComplete; gate.release();
    let failure: unknown; try { await pending; } catch (error) { failure = error; }
    expect(failure instanceof LyraMapImageExportError && failure.code).to.equal('cancelled'); expect(errors.length).to.equal(0);
  });

  it('waits for URL ownership before constructing, so a valid initial hash still sets the first camera', async () => {
    const gate = hold(loadMapHashRuntime, hashRuntime);
    history.replaceState({}, '', '#map=9/40/20');
    const wrapper = await fixture<HTMLDivElement>(html`<div></div>`); const element = create(el => { el.hash = true; }); wrapper.append(element);
    await waitUntil(() => gate.imports === 1); await element.updateComplete; await tick();
    expect(element.map === undefined).to.equal(true);
    gate.release(); await waitUntil(() => element.map !== undefined);
    const peer = element.map as unknown as LazyMap;
    expect(peer.zoom).to.equal(9); expect(peer.center).to.deep.equal({ lng: 20, lat: 40 });
  });

  it('constructs without touching the URL and reports localized control feedback when URL ownership cannot load', async () => {
    const gate = hold(loadMapHashRuntime, hashRuntime);
    history.replaceState({}, '', '#map=9/40/20');
    const wrapper = await fixture<HTMLDivElement>(html`<div></div>`);
    const element = create(el => { el.hash = true; el.strings = { mapControlUnavailable: 'URL sync unavailable' }; }); wrapper.append(element);
    await waitUntil(() => gate.imports === 1); gate.fail(); await waitUntil(() => element.map !== undefined);
    const peer = element.map as unknown as LazyMap;
    expect(peer.zoom).to.equal(element.zoom); await waitUntil(() => text(element).includes('URL sync unavailable'));
    peer.zoom = 5; peer.fire('moveend', { originalEvent: {} }); expect(location.hash).to.equal('#map=9/40/20');
  });

  it('restores overlays through the on-demand ownership runtime before style readiness settles', async () => {
    const gate = hold(loadMapOwnedFeatureRuntime, ownedRuntime);
    const { element, peer } = await mount(el => { el.overlays = overlay; });
    let ready = false; void element.whenStyleReady().then(() => { ready = true; }, () => undefined);
    await waitUntil(() => gate.imports === 1); await tick();
    expect(ready).to.equal(false); expect(peer.sources.has('local')).to.equal(false);
    gate.release(); await waitUntil(() => ready);
    expect(peer.sources.has('local') && peer.layers.has('local-fill')).to.equal(true);
  });

  it('fails closed with the localized initialization fallback when resource ownership cannot load', async () => {
    const gate = hold(loadMapOwnedFeatureRuntime, ownedRuntime);
    const { element } = await mount(el => { el.overlays = overlay; el.strings = { mapInitializationFailed: 'Map resources unavailable' }; });
    const ready = element.whenStyleReady().then(() => 'ready', () => 'rejected');
    await waitUntil(() => gate.imports === 1); gate.fail();
    expect(await ready).to.equal('rejected');
    await waitUntil(() => element.shadowRoot!.querySelector('[part="error"]')?.textContent?.includes('Map resources unavailable') === true);
    expect(element.map === undefined).to.equal(true);
  });

  it('admits invalid resources once their runtime loads and keeps the same localized fallback', async () => {
    const gate = hold(loadMapOwnedFeatureRuntime, ownedRuntime);
    const { element } = await mount(el => {
      el.overlays = { sources: [{ id: 'invalid', source: { type: 'geojson', data: () => undefined } }] } as never;
      el.strings = { mapInitializationFailed: 'Map resources unavailable' };
    });
    await waitUntil(() => gate.imports === 1); gate.release();
    await waitUntil(() => element.shadowRoot!.querySelector('[part="error"]')?.textContent?.includes('Map resources unavailable') === true);
    expect(element.map === undefined).to.equal(true);
  });

  it('loads image preparation only for registered images and override ownership only for overrides', async () => {
    const images = count(loadMapImageRuntime, imageRuntime), overrides = count(loadMapStyleOverrideRuntime, overrideRuntime);
    const { element, peer } = await mount(el => { el.overlays = overlay; });
    await element.whenStyleReady(); await settle(element, peer);
    expect([images.imports, overrides.imports]).to.deep.equal([0, 0]);
    element.images = [{ id: 'pin', source: { kind: 'svg', markup: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 4 4"><rect width="4" height="4" fill="red"/></svg>' }, width: 4, height: 4, pixelRatio: 1 }];
    await element.updateComplete; await element.whenStyleReady(); await settle(element, peer);
    expect([images.imports, overrides.imports]).to.deep.equal([1, 0]); expect(peer.images.has('pin')).to.equal(true);
    peer.layers.set('water', { id: 'water', type: 'fill' }); peer.order.push('water');
    element.styleOverrides = [{ layerId: 'water', paint: { 'fill-color': '#336699' } }];
    await element.updateComplete; await settle(element, peer);
    expect([images.imports, overrides.imports]).to.deep.equal([1, 1]); expect(peer.paint.get('water:fill-color')).to.equal('#336699');
  });

  it('loads override ownership before any native resource change, so overlays and overrides apply together', async () => {
    const gate = hold(loadMapStyleOverrideRuntime, overrideRuntime);
    const { element, peer } = await mountWithBasemap(el => { el.overlays = overlay; el.styleOverrides = [{ layerId: 'water', paint: { 'fill-color': '#336699' } }]; });
    await waitUntil(() => gate.imports === 1); await tick();
    expect(peer.sources.has('local')).to.equal(false);
    gate.release(); await element.whenStyleReady(); await settle(element, peer);
    expect(peer.sources.has('local') && peer.paint.get('water:fill-color') === '#336699').to.equal(true);
  });

  it('fails closed before any native resource change when override ownership cannot load', async () => {
    const gate = hold(loadMapStyleOverrideRuntime, overrideRuntime);
    let added = 0;
    const { element } = await mountWithBasemap(el => {
      el.overlays = overlay; el.styleOverrides = [{ layerId: 'water', paint: { 'fill-color': '#336699' } }];
      el.strings = { mapInitializationFailed: 'Map resources unavailable' };
    }, peer => { peer.afterAddSource = () => { added += 1; }; });
    await waitUntil(() => gate.imports === 1); gate.fail();
    await waitUntil(() => element.shadowRoot!.querySelector('[part="error"]')?.textContent?.includes('Map resources unavailable') === true);
    expect(added).to.equal(0);
  });

  it('keeps an anchor hidden until its runtime loads, then places it', async () => {
    const gate = hold(loadMapAnchorRuntime, anchorRuntime);
    const slot = document.createElement('section'); slot.slot = 'anchor'; slot.append(Object.assign(document.createElement('button'), { textContent: 'Anchor action' }));
    const { element } = await mount(el => { el.append(slot); el.anchorLngLat = [0, 0]; });
    await waitUntil(() => gate.imports === 1); await tick();
    const panel = () => element.shadowRoot!.querySelector<HTMLElement>('[part="anchor"]')!;
    expect(panel().hidden).to.equal(true); expect(element.focusAnchor()).to.equal(false); expect(element.closeAnchor()).to.equal(false);
    gate.release();
    await waitUntil(() => !panel().hidden && panel().style.left !== '' && getComputedStyle(panel()).visibility !== 'hidden', 'anchor was not placed');
    expect(element.focusAnchor()).to.equal(true);
  });

  it('adds requested controls once their runtime loads and reports localized feedback when it cannot', async () => {
    const gate = hold(loadMapControlRuntime, controlRuntime);
    const { element, peer } = await mount(el => { el.controls = { geolocate: true, attribution: false }; el.strings = { mapControlUnavailable: 'Controls unavailable' }; });
    await waitUntil(() => gate.imports === 1); expect(peer.controls.size).to.equal(0);
    gate.fail(); await waitUntil(() => text(element).includes('Controls unavailable')); expect(peer.controls.size).to.equal(0);
    __setMapFeatureImporterForTesting(loadMapControlRuntime, async () => controlRuntime);
    element.controls = { geolocate: true }; await element.updateComplete;
    await waitUntil(() => peer.controls.size === 2); expect(text(element)).not.to.include('Controls unavailable');
  });
});
