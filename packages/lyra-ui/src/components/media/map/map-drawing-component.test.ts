import { expect, fixture, fixtureCleanup, html, waitUntil } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import { setReducedMotion } from '../../../../test/wtr-media.js';
import { MapDrawing, type LyraMapDrawingSnapshot } from './map-drawing.js';
import './map.js';
import { LYRA_MAP_EMPTY_STYLE, type LyraMap } from './map.js';
import { loadMapDrawingRuntime } from './map-feature-loader.js';

import { ControlMapEngine, FakeGeolocateControl as Geolocate, FakeAttributionControl as Attribution } from '../../../../test/map-control-engine.js';
class ControlMap extends ControlMapEngine {
  override project(point: readonly [number, number]) { this.beforeProject?.(); return { x: point[0] * 10 + 100, y: point[1] * 10 + 100 }; }
  unproject(point: readonly [number, number]) { return { lng: (point[0] - 100) / 10, lat: (point[1] - 100) / 10 }; }
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

function capture(element: LyraMap, type: string): unknown[] {
  const values: unknown[] = []; element.addEventListener(type, event => { values.push((event as CustomEvent).detail); }); return values;
}
async function settle(element: LyraMap, peer: ControlMap) { await element.updateComplete; peer.idle = true; peer.fire('idle'); await element.whenIdle(); await element.updateComplete; }
function click(peer: ControlMap, lng: number, lat: number, originalEvent?: Event) { peer.fire('click', { point: { x: 1, y: 2 }, lngLat: { lng, lat }, ...(originalEvent ? { originalEvent } : {}) }); }
async function drawing(mode: 'line' | 'polygon' = 'line', configure?: (element: LyraMap) => void) {
  const result = await mount(element => { element.drawMode = mode; configure?.(element); });
  await waitUntil(() => result.element.shadowRoot!.querySelector<HTMLButtonElement>('[part="drawing-add"]')?.disabled === false);
  return result;
}
async function vertex(element: LyraMap, peer: ControlMap, lng: number, lat: number) { click(peer, lng, lat); await settle(element, peer); }
async function pendingDrawing() {
  ControlMap.initialReady = false;
  const wrapper = await fixture<HTMLDivElement>(html`<div></div>`), element = document.createElement('lr-map') as LyraMap;
  element.engine = 'maplibre'; element.mapStyle = LYRA_MAP_EMPTY_STYLE; element.drawMode = 'line';
  (element as unknown as { loadLibrary: () => Promise<unknown> }).loadLibrary = async () => ({ Map: ControlMap, AttributionControl: Attribution });
  wrapper.append(element); await waitUntil(() => element.map !== undefined); await element.updateComplete;
  return { element, peer: element.map as unknown as ControlMap };
}

function completed(mode: 'line' | 'polygon' = 'line'): LyraMapDrawingSnapshot {
  const state = new MapDrawing(mode);
  for (const point of mode === 'line' ? [[0, 0], [5, 0]] : [[0, 0], [5, 0], [0, 5]]) state.add(point);
  return state.complete().state;
}
async function editSurface(element: LyraMap, peer: ControlMap) {
  element.style.inlineSize = '320px'; element.style.blockSize = '320px';
  peer.canvas.style.cssText = 'width:100%;height:100%;display:block';
  element.shadowRoot!.querySelector('[part="container"]')!.append(peer.canvas);
  peer.canvas.setPointerCapture = () => undefined; peer.canvas.releasePointerCapture = () => undefined;
  await element.updateComplete; peer.fire('move'); await Promise.resolve(); await element.updateComplete;
}
function pointer(peer: ControlMap, type: string, x: number, y: number) {
  const rect = peer.canvas.getBoundingClientRect();
  peer.canvas.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, pointerId: 7, isPrimary: true, button: 0, clientX: rect.left + x, clientY: rect.top + y }));
}

describe('lr-map drawing integration', () => {
  // Exercises the steady state after the on-demand runtime has loaded; map-lazy-runtimes.test.ts covers the loading itself.
  before(() => loadMapDrawingRuntime());
  beforeEach(() => {
    originalUrl = location.href; originalState = history.state; ControlMap.initialReady = true; ControlMap.prepare = undefined; ControlMap.initialZoomGesture = true;
    Object.defineProperty(window, 'IntersectionObserver', { configurable: true, value: undefined });
    Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', { configurable: true, writable: true,
      value(this: HTMLCanvasElement, id: string, ...rest: unknown[]) { return id === 'webgl2' ? {} : originalContext.call(this, id as never, ...(rest as [])); } });
  });
  afterEach(() => {
    fixtureCleanup(); history.replaceState(originalState, '', originalUrl);
    Object.defineProperty(window, 'IntersectionObserver', { configurable: true, value: originalObserver });
    HTMLCanvasElement.prototype.getContext = originalContext;
  });

  it('keeps drawing unset without resources, gesture changes, drawing controls or events', async () => {
    const { element, peer } = await mount(); const starts = capture(element, 'lr-map-draw-start'), clicks = capture(element, 'lr-map-click'); click(peer, 1, 2);
    expect(element.drawMode).to.equal('none'); expect(peer.sources.size).to.equal(0); expect(peer.gestureCalls.length).to.equal(0);
    expect(element.shadowRoot!.querySelector('[part="drawing-controls"]') === null).to.equal(true); expect(starts.length).to.equal(0); expect(clicks.length).to.equal(1);
    expect(element.undoDrawing()).to.equal(false); expect(element.completeDrawing()).to.equal(false); expect(element.cancelDrawing()).to.equal(false);
  });
  it('arms without starting and emits first-vertex start once before changes, including undo back to zero', async () => {
    const { element, peer } = await drawing(); const order: string[] = [], snapshots: LyraMapDrawingSnapshot[] = [];
    element.addEventListener('lr-map-draw-start', event => { order.push('start'); snapshots.push((event as CustomEvent<LyraMapDrawingSnapshot>).detail); });
    element.addEventListener('lr-map-draw-change', () => { order.push('change'); }); expect(order.length).to.equal(0);
    await vertex(element, peer, 1, 2); expect(element.undoDrawing()).to.equal(true); await settle(element, peer); await vertex(element, peer, 2, 3);
    expect(order).to.deep.equal(['start', 'change', 'change', 'change']); expect(snapshots[0]!.vertices).to.deep.equal([[1, 2]]);
  });
  it('accepts native pointer and touch clicks as vertices without ordinary click dispatch', async () => {
    const { element, peer } = await drawing(); const clicks = capture(element, 'lr-map-click'), changes = capture(element, 'lr-map-draw-change');
    click(peer, 1, 2, new Event('pointerup')); await settle(element, peer); click(peer, 2, 3, new Event('touchend')); await settle(element, peer);
    expect(clicks.length).to.equal(0); expect((changes.at(-1) as LyraMapDrawingSnapshot).vertices).to.deep.equal([[1, 2], [2, 3]]); expect(peer.queryCount).to.equal(0);
  });
  it('emits completed frozen line geometry/metrics before clearing mode and ephemeral resources', async () => {
    const { element, peer } = await drawing(); await vertex(element, peer, 0, 0); await vertex(element, peer, 1, 0); let completed: LyraMapDrawingSnapshot | undefined;
    const cancels = capture(element, 'lr-map-draw-cancel');
    element.addEventListener('lr-map-draw-complete', event => { completed = (event as CustomEvent<LyraMapDrawingSnapshot>).detail; expect(element.drawMode).to.equal('line'); expect(peer.sources.size).to.equal(1); });
    expect(element.completeDrawing()).to.equal(true); expect(completed?.phase).to.equal('completed'); expect(completed?.geometry).to.deep.equal({ type: 'LineString', coordinates: [[0, 0], [1, 0]] });
    expect(completed?.metrics?.length).to.be.greaterThan(100_000); expect(Object.isFrozen(completed?.geometry)).to.equal(true); expect(Object.isFrozen(completed?.vertices[0])).to.equal(true);
    await settle(element, peer); expect(element.drawMode).to.equal('none'); expect(peer.sources.size).to.equal(0); expect(peer.layers.size).to.equal(0); expect(peer.zoomGesture).to.equal(true); expect(cancels.length).to.equal(0);
  });
  it('completes valid polygon geometry with a closed ring and positive spherical area', async () => {
    const { element, peer } = await drawing('polygon'); const complete = capture(element, 'lr-map-draw-complete');
    for (const [lng, lat] of [[0, 0], [1, 0], [0, 1]]) await vertex(element, peer, lng!, lat!);
    expect(element.completeDrawing()).to.equal(true); const state = complete[0] as LyraMapDrawingSnapshot;
    expect(state.geometry).to.deep.equal({ type: 'Polygon', coordinates: [[[0, 0], [1, 0], [0, 1], [0, 0]]] }); expect(state.metrics?.area).to.be.greaterThan(0); await settle(element, peer);
  });
  it('keeps invalid completion armed for correction and interpolates localized vertex requirements', async () => {
    const { element, peer } = await drawing('polygon', el => { el.strings = { mapDrawingTooFewVertices: 'Need {count} points' }; }); const complete = capture(element, 'lr-map-draw-complete');
    await vertex(element, peer, 0, 0); expect(element.completeDrawing()).to.equal(false); await element.updateComplete;
    expect(element.drawMode).to.equal('polygon'); expect(complete.length).to.equal(0); expect(element.shadowRoot!.textContent).to.include('Need 3 points');
    await vertex(element, peer, 1, 0); await vertex(element, peer, 0, 1); expect(element.completeDrawing()).to.equal(true); await settle(element, peer);
  });
  it('provides unregistered English actions, group/status/error text and live string overrides', async () => {
    const { element, peer } = await drawing(); const group = element.shadowRoot!.querySelector<HTMLElement>('[part="drawing-controls"]')!;
    expect(group.getAttribute('aria-label')).to.equal('Drawing controls');
    expect([...group.querySelectorAll('button')].map(button => button.textContent)).to.deep.equal(['Add vertex at map center', 'Undo last vertex', 'Finish drawing', 'Cancel drawing']);
    expect(element.shadowRoot!.querySelector('[part="drawing-status"]')!.textContent).to.equal('Vertices: 0');
    expect(element.completeDrawing()).to.equal(false); await element.updateComplete; expect(element.shadowRoot!.textContent).to.include('Add at least 2 vertices before finishing');
    element.strings = { mapDrawingControls: 'Shape actions', mapDrawingVertices: 'Points = {count}', mapDrawingTooFewVertices: 'Need {count} accepted points' };
    await element.updateComplete; expect(group.getAttribute('aria-label')).to.equal('Shape actions'); expect(element.shadowRoot!.textContent).to.include('Need 2 accepted points');
    await vertex(element, peer, 1, 2); expect(element.shadowRoot!.querySelector('[part="drawing-status"]')!.textContent).to.equal('Points = 1');
  });
  it('rejects duplicate and invalid native vertices without changing the accepted snapshot', async () => {
    const { element, peer } = await drawing(); const changes = capture(element, 'lr-map-draw-change'); await vertex(element, peer, 0, 0);
    click(peer, 0, 0); await element.updateComplete; click(peer, 0, NaN); await element.updateComplete;
    expect(changes.length).to.equal(1); expect((changes[0] as LyraMapDrawingSnapshot).vertices).to.deep.equal([[0, 0]]); expect(element.drawMode).to.equal('line');
  });
  it('caps admitted drawing vertices at 512 without changing the final accepted snapshot', async () => {
    const { element, peer } = await drawing(); const changes = capture(element, 'lr-map-draw-change');
    for (let index = 0; index < 512; index++) await vertex(element, peer, index / 1000, 0);
    click(peer, 0.6, 0); await element.updateComplete;
    expect(changes.length).to.equal(512); expect((changes.at(-1) as LyraMapDrawingSnapshot).vertices.length).to.equal(512); expect(element.drawMode).to.equal('line');
  }).timeout(30_000);
  it('stops the first change when its start listener cancels drawing synchronously', async () => {
    const { element, peer } = await drawing(); const changes = capture(element, 'lr-map-draw-change'), cancels = capture(element, 'lr-map-draw-cancel');
    element.addEventListener('lr-map-draw-start', () => { expect(element.cancelDrawing()).to.equal(true); }); click(peer, 1, 2); await settle(element, peer);
    expect(changes.length).to.equal(0); expect(cancels.length).to.equal(1); expect((cancels[0] as { reason: string }).reason).to.equal('cancel'); expect(element.drawMode).to.equal('none'); expect(peer.sources.size).to.equal(0);
  });
  it('keeps a mode replacement authored inside start separate from the retired session', async () => {
    const { element, peer } = await drawing(); const changes = capture(element, 'lr-map-draw-change'), cancels = capture(element, 'lr-map-draw-cancel');
    element.addEventListener('lr-map-draw-start', () => { element.drawMode = 'polygon'; }, { once: true }); click(peer, 0, 0); await settle(element, peer);
    expect(changes.length).to.equal(0); expect(element.drawMode).to.equal('polygon'); expect(cancels.length).to.equal(1); expect((cancels[0] as { reason: string }).reason).to.equal('mode-change');
    await vertex(element, peer, 2, 3); expect((changes[0] as LyraMapDrawingSnapshot).mode).to.equal('polygon'); expect((changes[0] as LyraMapDrawingSnapshot).vertices).to.deep.equal([[2, 3]]);
  });
  it('respects cancellation or mode replacement from a change callback without mutating its frozen snapshot', async () => {
    for (const replace of [false, true]) {
      const { element, peer } = await drawing(); let snapshot: LyraMapDrawingSnapshot | undefined; const cancels = capture(element, 'lr-map-draw-cancel');
      element.addEventListener('lr-map-draw-change', event => {
        snapshot = (event as CustomEvent<LyraMapDrawingSnapshot>).detail; expect(element.undoDrawing()).to.equal(false);
        if (replace) element.drawMode = 'polygon'; else expect(element.cancelDrawing()).to.equal(true);
      }, { once: true });
      click(peer, 1, 2); await settle(element, peer); expect(snapshot?.vertices).to.deep.equal([[1, 2]]); expect(Object.isFrozen(snapshot)).to.equal(true);
      expect(element.drawMode).to.equal(replace ? 'polygon' : 'none'); expect(cancels.length).to.equal(1); expect((cancels[0] as { reason: string }).reason).to.equal(replace ? 'mode-change' : 'cancel');
      expect(Object.isFrozen(cancels[0])).to.equal(true); element.remove();
    }
  });
  it('preserves replacement intent from a completion callback and rejects nested mutating methods', async () => {
    const { element, peer } = await drawing(); await vertex(element, peer, 0, 0); await vertex(element, peer, 1, 0);
    element.addEventListener('lr-map-draw-complete', () => { expect(element.undoDrawing()).to.equal(false); expect(element.completeDrawing()).to.equal(false); element.drawMode = 'polygon'; });
    expect(element.completeDrawing()).to.equal(true); await settle(element, peer); expect(element.drawMode).to.equal('polygon');
  });
  it('cancels on pick mode and does not silently resume drawing when picking ends', async () => {
    const { element, peer } = await drawing(); await vertex(element, peer, 0, 0); const cancels = capture(element, 'lr-map-draw-cancel');
    element.pickMode = true; await settle(element, peer); expect(cancels.length).to.equal(1); expect((cancels[0] as { reason: string }).reason).to.equal('pick-mode'); expect(element.drawMode).to.equal('none'); expect(peer.zoomGesture).to.equal(true);
    element.pickMode = false; await settle(element, peer); expect(element.shadowRoot!.querySelector('[part="drawing-controls"]') === null).to.equal(true);
  });
  it('cancels drawing on style change and preserves no ephemeral replay', async () => {
    const { element, peer } = await drawing(); await vertex(element, peer, 0, 0); const cancels = capture(element, 'lr-map-draw-cancel');
    element.mapStyle = { ...LYRA_MAP_EMPTY_STYLE }; await element.updateComplete; await element.whenStyleReady(); await settle(element, peer);
    expect(cancels.length).to.equal(1); expect((cancels[0] as { reason: string }).reason).to.equal('style-change'); expect(element.drawMode).to.equal('none'); expect(peer.sources.size).to.equal(0); expect(peer.zoomGesture).to.equal(true);
  });
  it('cancels an armed pre-ready mode exactly once for style, mode and pick replacement', async () => {
    for (const kind of ['style', 'mode', 'pick'] as const) {
      const { element, peer } = await pendingDrawing(); const cancels = capture(element, 'lr-map-draw-cancel'), starts = capture(element, 'lr-map-draw-start');
      if (kind === 'style') element.mapStyle = { ...LYRA_MAP_EMPTY_STYLE }; else if (kind === 'mode') element.drawMode = 'polygon'; else element.pickMode = true;
      await element.updateComplete; expect(cancels.length).to.equal(1);
      const cancelled = cancels[0] as LyraMapDrawingSnapshot & { reason: string };
      expect(cancelled).to.include({ mode: 'line', phase: 'cancelled', reason: kind === 'style' ? 'style-change' : kind === 'mode' ? 'mode-change' : 'pick-mode' });
      expect(cancelled.vertices).to.deep.equal([]); expect(Object.isFrozen(cancelled)).to.equal(true); expect(Object.isFrozen(cancelled.vertices)).to.equal(true);
      peer.ready = true; peer.fire('load'); await element.updateComplete; await element.whenStyleReady(); await element.updateComplete;
      expect(starts.length).to.equal(0); expect(element.drawMode).to.equal(kind === 'mode' ? 'polygon' : 'none'); expect(peer.sources.size).to.equal(0); element.remove();
    }
  });
  it('publishes accepted first-vertex events before a native source callback cancels drawing', async () => {
    for (const addSource of [false, true]) {
      const { element, peer } = await drawing(); const order: string[] = [];
      for (const type of ['start', 'change', 'cancel']) element.addEventListener(`lr-map-draw-${type}`, () => { order.push(type); });
      const cancel = () => { peer.beforeGetSource = undefined; peer.afterAddSource = undefined; element.cancelDrawing(); };
      if (addSource) peer.afterAddSource = cancel; else peer.beforeGetSource = cancel;
      click(peer, 1, 2); await settle(element, peer); expect(order).to.deep.equal(['start', 'change', 'cancel']); expect(element.drawMode).to.equal('none'); expect(peer.sources.size).to.equal(0); element.remove();
    }
  });
  it('publishes accepted undo before a native source callback cancels its resource update', async () => {
    const { element, peer } = await drawing(); await vertex(element, peer, 0, 0); await vertex(element, peer, 1, 0); const order: string[] = [];
    element.addEventListener('lr-map-draw-change', () => { order.push('change'); }); element.addEventListener('lr-map-draw-cancel', () => { order.push('cancel'); });
    peer.beforeGetSource = () => { peer.beforeGetSource = undefined; element.cancelDrawing(); };
    expect(element.undoDrawing()).to.equal(true); await settle(element, peer); expect(order).to.deep.equal(['change', 'cancel']); expect(peer.sources.size).to.equal(0);
  });
  it('cancels and restores native zoom before disconnect removes the map', async () => {
    const { element, peer } = await drawing(); await vertex(element, peer, 0, 0); const cancels = capture(element, 'lr-map-draw-cancel'); element.remove();
    expect(cancels.length).to.equal(1); expect((cancels[0] as { reason: string }).reason).to.equal('disconnect'); expect(peer.zoomGesture).to.equal(true); expect(peer.removed).to.equal(true);
  });
  it('cancels active drawing for pointercancel and ancestor inertness without automatic resume', async () => {
    for (const inert of [false, true]) {
      const { element, peer, wrapper } = await drawing(); await vertex(element, peer, 0, 0); const cancels = capture(element, 'lr-map-draw-cancel');
      if (inert) wrapper.inert = true; else peer.canvas.dispatchEvent(new Event('pointercancel'));
      await waitUntil(() => element.drawMode === 'none'); expect(cancels.length).to.equal(1); expect((cancels[0] as { reason: string }).reason).to.equal(inert ? 'disabled' : 'pointercancel');
      expect(peer.zoomGesture).to.equal(true); if (inert) wrapper.inert = false; await element.updateComplete; expect(element.drawMode).to.equal('none'); element.remove();
    }
  });
  it('preserves authored disabled double-click zoom through drawing cancellation', async () => {
    ControlMap.initialZoomGesture = false; const { element, peer } = await drawing(); expect(peer.gestureCalls.length).to.equal(0);
    expect(element.cancelDrawing()).to.equal(true); await settle(element, peer); expect(peer.zoomGesture).to.equal(false); expect(peer.gestureCalls.length).to.equal(0);
  });
  it('supports keyboard center add, undo, completion and Escape without declarative focus theft', async () => {
    const outside = document.createElement('button'); document.body.append(outside);
    try {
      await focusByKeyboard(outside); const { element, peer } = await drawing(); expect(document.activeElement === outside).to.equal(true);
      const add = element.shadowRoot!.querySelector<HTMLButtonElement>('[part="drawing-add"]')!; peer.center = { lng: 2, lat: 3 };
      await focusByKeyboard(add); await sendKeys({ press: 'Enter' }); await settle(element, peer);
      const undo = element.shadowRoot!.querySelector<HTMLButtonElement>('[part="drawing-undo"]')!; await focusByKeyboard(undo); await sendKeys({ press: 'Enter' }); await settle(element, peer);
      peer.center = { lng: 0, lat: 0 }; await focusByKeyboard(add); await sendKeys({ press: 'Enter' }); await settle(element, peer);
      peer.center = { lng: 1, lat: 0 }; await sendKeys({ press: 'Enter' }); await settle(element, peer);
      const complete = capture(element, 'lr-map-draw-complete'), finish = element.shadowRoot!.querySelector<HTMLButtonElement>('[part="drawing-complete"]')!;
      await focusByKeyboard(finish); await sendKeys({ press: 'Enter' }); await settle(element, peer); expect(complete.length).to.equal(1);
      element.drawMode = 'line'; await element.updateComplete; await waitUntil(() => Boolean(element.shadowRoot!.querySelector('[part="drawing-add"]')));
      const cancel = capture(element, 'lr-map-draw-cancel'); await focusByKeyboard(element.shadowRoot!.querySelector<HTMLButtonElement>('[part="drawing-add"]')!); await sendKeys({ press: 'Escape' }); await element.updateComplete;
      expect(element.drawMode).to.equal('none'); expect(cancel.length).to.equal(1); expect((cancel[0] as { reason: string }).reason).to.equal('escape');
    } finally { outside.remove(); }
  });
  it('keeps ordinary caller-owned sources after drawing completion and cleans only temporary resources', async () => {
    const geojson = { type: 'FeatureCollection' as const, features: [] };
    const { element, peer } = await drawing('line', el => { el.dataLayers = [{ sourceId: 'keep', geojson }]; }); const kept = [...peer.sources.keys()];
    await vertex(element, peer, 0, 0); await vertex(element, peer, 1, 0); expect(peer.sources.size).to.equal(2); element.completeDrawing(); await settle(element, peer);
    expect([...peer.sources.keys()]).to.deep.equal(kept); expect(peer.layers.size).to.equal(3);
  });
  it('allocates fresh drawing IDs around deliberate caller source/layer collisions and preserves both', async () => {
    const { element, peer } = await drawing('line', el => { el.overlays = {
      sources: [{ id: 'lr-drawing-0', source: { type: 'geojson', data: { type: 'FeatureCollection', features: [] } } }],
      layers: [{ layer: { id: 'lr-drawing-0-points', type: 'circle', source: 'lr-drawing-0' } }],
    }; });
    const source = peer.getSource('lr-drawing-0'), layer = peer.getLayer('lr-drawing-0-points'); await vertex(element, peer, 1, 2);
    expect(peer.sources.size).to.equal(2); expect([...peer.sources.keys()].some(id => id !== 'lr-drawing-0')).to.equal(true);
    element.cancelDrawing(); await settle(element, peer); expect(peer.getSource('lr-drawing-0') === source).to.equal(true); expect(peer.getLayer('lr-drawing-0-points') === layer).to.equal(true);
    expect(peer.sources.size).to.equal(1); expect(peer.layers.size).to.equal(1);
  });
  it('does not expose its ephemeral drawing source through a basemap interaction opt-in', async () => {
    const { element, peer } = await drawing(); await vertex(element, peer, 1, 2);
    const nativeSource = [...peer.sources.keys()][0]!;
    const points = [...peer.layers].find(([, value]) => (value as Record<string, unknown>)['type'] === 'circle')?.[0];
    if (!points) throw new Error('Expected ephemeral drawing points');
    element.interactiveBasemapLayers = [{ layerId: points }]; await element.updateComplete; await element.whenStyleReady(); await settle(element, peer);
    expect(element.setFeatureState({ origin: 'basemap', source: nativeSource, id: 1 }, { hover: true })).to.equal(false);
    expect(peer.stateCalls.length).to.equal(0); expect(element.drawMode).to.equal('line');
  });
  it('does not add a center vertex after its native center callback synchronously cancels drawing', async () => {
    const { element, peer } = await drawing(); const starts = capture(element, 'lr-map-draw-start');
    peer.beforeGetCenter = () => { peer.beforeGetCenter = undefined; element.cancelDrawing(); };
    const add = element.shadowRoot!.querySelector<HTMLButtonElement>('[part="drawing-add"]')!; await focusByKeyboard(add); await sendKeys({ press: 'Enter' }); await settle(element, peer);
    expect(starts.length).to.equal(0); expect(element.drawMode).to.equal('none'); expect(peer.sources.size).to.equal(0);
  });
  it('includes drawing preparation in idle and prevents late resource installation after cancellation', async () => {
    const { element, peer } = await drawing(); let release!: () => void, preparing = false;
    ControlMap.prepare = async requirements => {
      const sources = (requirements as { sources?: Record<string, unknown> }).sources ?? {};
      if (Object.keys(sources).length) { preparing = true; await new Promise<void>(resolve => { release = resolve; }); }
    };
    click(peer, 0, 0); await waitUntil(() => preparing); let idleResolved = false; const pending = element.whenIdle().then(() => { idleResolved = true; }, () => undefined);
    await Promise.resolve(); expect(idleResolved).to.equal(false); expect(element.cancelDrawing()).to.equal(true); ControlMap.prepare = undefined; await settle(element, peer);
    release(); await pending; await Promise.resolve(); expect(peer.sources.size).to.equal(0); expect(peer.layers.size).to.equal(0); expect(element.drawMode).to.equal('none');
  });
  it('reports a sanitized English error and rejects idle when drawing resource preparation fails', async () => {
    const { element, peer } = await drawing(); ControlMap.prepare = async requirements => {
      if (Object.keys((requirements as { sources?: Record<string, unknown> }).sources ?? {}).length) throw new Error('Private drawing preparation failure');
    };
    click(peer, 1, 2); let failure: unknown; try { await element.whenIdle(); } catch (error) { failure = error; }
    expect(failure instanceof Error).to.equal(true); expect(String(failure)).not.to.include('Private drawing preparation failure');
    await element.updateComplete; expect(element.shadowRoot!.textContent).to.include('Drawing could not be updated'); expect(element.shadowRoot!.textContent).not.to.include('Private drawing preparation failure');
    expect(peer.sources.size).to.equal(0); expect(peer.layers.size).to.equal(0);
  });
  it('introduces no drawing control animation or transition under either reduced-motion preference', async () => {
    try {
      for (const preference of ['reduce', 'no-preference'] as const) {
        await setReducedMotion(preference); const { element } = await drawing();
        const controls = element.shadowRoot!.querySelectorAll<HTMLElement>('[part="drawing-controls"], [part="drawing-controls"] button');
        expect(controls.length).to.equal(5);
        for (const control of controls) {
          const style = getComputedStyle(control); expect(style.animationName).to.equal('none'); expect(style.transitionDuration.split(',').every(duration => Number.parseFloat(duration) === 0)).to.equal(true);
        }
        element.remove();
      }
    } finally { await setReducedMotion('no-preference'); }
  });
  it('wraps long localized drawing controls within RTL 320px allocation and exposes accessible actions', async () => {
    const { element } = await drawing('line', el => { el.setAttribute('dir', 'rtl'); el.style.inlineSize = '320px'; el.style.maxInlineSize = '320px'; el.strings = {
      mapDrawAtCenter: 'Choose the current map center as the next drawing vertex', mapUndoDrawing: 'Undo the most recently accepted drawing vertex',
      mapCompleteDrawing: 'Finish the current drawing and retain its geometry', mapCancelDrawing: 'Cancel this drawing and return to map exploration',
    }; });
    const allocation = element.getBoundingClientRect(); const buttons = element.shadowRoot!.querySelectorAll<HTMLButtonElement>('[part="drawing-controls"] button');
    expect(buttons.length).to.equal(4);
    for (const button of buttons) { const box = button.getBoundingClientRect(); expect(box.width).to.be.greaterThan(0); expect(box.left).to.be.at.least(allocation.left - 1); expect(box.right).to.be.at.most(allocation.right + 1); }
    await expect(element).to.be.accessible();
  });

  it('opens explicit completed editing with recomputed frozen state and finishes without auto-retaining geometry', async () => {
    const { element, peer } = await mount();
    expect(typeof element.editDrawing, 'completed drawing editing requires editDrawing').to.equal('function');
    await editSurface(element, peer);
    const input = completed(), starts = capture(element, 'lr-map-draw-start'), changes = capture(element, 'lr-map-draw-change'), finishes = capture(element, 'lr-map-draw-complete');
    expect(element.editDrawing(input)).to.equal(true); await settle(element, peer);
    expect(element.drawMode).to.equal('none'); expect(starts.length).to.equal(0); expect(changes.length).to.equal(0); expect(peer.sources.size).to.equal(1);
    expect(element.completeDrawing()).to.equal(true); await settle(element, peer);
    expect(finishes.length).to.equal(1); expect(finishes[0]).to.deep.equal(input); expect(peer.sources.size).to.equal(0);
    expect(element.shadowRoot!.querySelector('[part="drawing-controls"]') === null).to.equal(true);
  });
  it('ignores caller geometry and metrics accessors while detaching admitted vertex arrays', async () => {
    const { element, peer } = await mount(); let reads = 0;
    const vertices = [[0, 0], [5, 0]];
    const input = Object.defineProperties({ mode: 'line', phase: 'completed', vertices }, { metrics: { get() { reads++; throw new Error('Metrics sentinel'); } }, geometry: { get() { reads++; throw new Error('Geometry sentinel'); } } });
    expect(element.editDrawing(input as unknown as LyraMapDrawingSnapshot)).to.equal(true); vertices[1]![0] = 90;
    const finishes = capture(element, 'lr-map-draw-complete'); expect(element.completeDrawing()).to.equal(true); await settle(element, peer);
    expect(reads).to.equal(0); expect((finishes[0] as LyraMapDrawingSnapshot).vertices).to.deep.equal([[0, 0], [5, 0]]);
    expect((finishes[0] as LyraMapDrawingSnapshot).metrics!.length).to.be.greaterThan(500000);
  });
  it('rejects invalid completed input and hostile own accessors without allocating resources', async () => {
    const { element, peer } = await mount(); let reads = 0;
    const accessor = Object.defineProperty({ mode: 'line', phase: 'completed' }, 'vertices', { get() { reads++; return [[0, 0], [5, 0]]; } });
    for (const input of [null, {}, { ...completed(), phase: 'drawing' }, { ...completed(), vertices: [[0, 0], [0, 0]] }, { ...completed(), vertices: new Array(513).fill([0, 0]) }, accessor]) {
      expect(element.editDrawing(input as LyraMapDrawingSnapshot)).to.equal(false);
    }
    expect(reads).to.equal(0); expect(peer.sources.size).to.equal(0); expect(peer.gestureCalls.length).to.equal(0);
  });
  it('rejects completed edit admission until authored style configuration has updated', async () => {
    const { element, peer } = await mount(); await settle(element, peer);
    element.mapStyle = { version: 8, sources: {}, layers: [] };
    expect(element.editDrawing(completed())).to.equal(false);
    expect(peer.gestureCalls.length).to.equal(0);
    await settle(element, peer);
    expect(element.editDrawing(completed())).to.equal(true);
    expect(element.cancelDrawing()).to.equal(true);
  });
  it('rejects collision with an active session and cancels pending snapshot reflection reentry', async () => {
    const { element, peer } = await drawing(); await vertex(element, peer, 1, 1);
    expect(element.editDrawing(completed())).to.equal(false); expect(element.drawMode).to.equal('line');
    element.cancelDrawing(); await settle(element, peer);
    const input = new Proxy(completed(), { getOwnPropertyDescriptor(target, key) { if (key === 'vertices') element.cancelDrawing(); return Reflect.getOwnPropertyDescriptor(target, key); } });
    expect(element.editDrawing(input)).to.equal(false); expect(peer.sources.size).to.equal(0);
  });
  it('allows a completion listener to synchronously reopen exactly its new explicit edit session', async () => {
    const { element, peer } = await drawing(); await vertex(element, peer, 0, 0); await vertex(element, peer, 5, 0);
    let admitted = false;
    element.addEventListener('lr-map-draw-complete', event => { admitted = element.editDrawing((event as CustomEvent<LyraMapDrawingSnapshot>).detail); }, { once: true });
    expect(element.completeDrawing()).to.equal(true); await settle(element, peer);
    expect(admitted).to.equal(true); expect(peer.sources.size).to.equal(1); expect(peer.zoomGesture).to.equal(false);
    expect(element.cancelDrawing()).to.equal(true); await settle(element, peer); expect(peer.zoomGesture).to.equal(true);
  });
  it('drags a completed vertex with fresh metrics and stable owned source while restoring pan without completing', async () => {
    const { element, peer } = await mount(); await editSurface(element, peer);
    expect(element.editDrawing(completed())).to.equal(true); await settle(element, peer);
    const source = [...peer.sources.keys()][0], oldCenter = { ...peer.center }, changes = capture(element, 'lr-map-draw-change'), finishes = capture(element, 'lr-map-draw-complete');
    pointer(peer, 'pointerdown', 100, 100); expect(peer.panEnabled).to.equal(false);
    pointer(peer, 'pointermove', 110, 110); pointer(peer, 'pointerup', 110, 110); await settle(element, peer);
    const state = changes.at(-1) as LyraMapDrawingSnapshot;
    expect(state.phase).to.equal('completed'); expect(state.vertices[0]).to.deep.equal([1, 1]); expect(state.metrics!.length).to.be.greaterThan(0);
    expect(Object.isFrozen(state) && Object.isFrozen(state.metrics) && Object.isFrozen(state.geometry)).to.equal(true);
    expect(finishes.length).to.equal(0); expect([...peer.sources.keys()]).to.deep.equal([source]); expect(peer.center).to.deep.equal(oldCenter); expect(peer.panCalls).to.deep.equal(['disable', 'enable']);
    const before = changes.length; click(peer, 20, 20); expect(changes.length).to.equal(before);
  });
  it('retains the last valid completed polygon when a dragged vertex would collapse it', async () => {
    const { element, peer } = await mount(); await editSurface(element, peer); element.editDrawing(completed('polygon')); await settle(element, peer);
    const changes = capture(element, 'lr-map-draw-change'); pointer(peer, 'pointerdown', 100, 100); pointer(peer, 'pointermove', 150, 100); pointer(peer, 'pointerup', 150, 100);
    expect(changes.length).to.equal(0); const finishes = capture(element, 'lr-map-draw-complete'); expect(element.completeDrawing()).to.equal(true);
    expect(finishes[0]).to.deep.equal(completed('polygon')); expect(peer.panEnabled).to.equal(true);
  });
  it('preserves author-disabled pan and permits active drawing correction without completing', async () => {
    const { element, peer } = await drawing(); await editSurface(element, peer); await vertex(element, peer, 0, 0); await vertex(element, peer, 5, 0); peer.panEnabled = false;
    const changes = capture(element, 'lr-map-draw-change'); pointer(peer, 'pointerdown', 100, 100); pointer(peer, 'pointermove', 110, 100); pointer(peer, 'pointerup', 110, 100);
    expect((changes.at(-1) as LyraMapDrawingSnapshot).phase).to.equal('drawing'); expect(peer.panCalls.length).to.equal(0); expect(peer.panEnabled).to.equal(false);
  });
  it('cancels captured editing on pointercancel with one reason and restores both native handlers', async () => {
    const { element, peer } = await mount(); await editSurface(element, peer); element.editDrawing(completed()); await settle(element, peer);
    const cancels = capture(element, 'lr-map-draw-cancel'); pointer(peer, 'pointerdown', 100, 100); pointer(peer, 'pointercancel', 100, 100); await settle(element, peer);
    expect(cancels.length).to.equal(1); expect((cancels[0] as { reason: string }).reason).to.equal('pointercancel'); expect(peer.panEnabled).to.equal(true); expect(peer.zoomGesture).to.equal(true); expect(peer.sources.size).to.equal(0);
  });
  it('retires captured editing before style replacement and ignores late pointer movement', async () => {
    const { element, peer } = await mount(); await editSurface(element, peer); element.editDrawing(completed()); await settle(element, peer);
    const changes = capture(element, 'lr-map-draw-change'); pointer(peer, 'pointerdown', 100, 100); element.mapStyle = { version: 8, sources: {}, layers: [] };
    pointer(peer, 'pointermove', 120, 100); await settle(element, peer);
    expect(changes.length).to.equal(0); expect(peer.panEnabled).to.equal(true); expect(peer.zoomGesture).to.equal(true); expect(peer.sources.size).to.equal(0);
  });
  it('retires a captured edit on disconnect and rejects disconnected admission', async () => {
    const { element, peer } = await mount(); await editSurface(element, peer); element.editDrawing(completed()); await settle(element, peer);
    pointer(peer, 'pointerdown', 100, 100); element.remove();
    expect(peer.panEnabled).to.equal(true); expect(peer.zoomGesture).to.equal(true); expect(peer.removed).to.equal(true); expect(element.editDrawing(completed())).to.equal(false);
  });
  it('supports localized keyboard handles, roving selection and logical RTL movement', async () => {
    const { element, peer } = await mount(el => { el.setAttribute('dir', 'rtl'); el.strings = { mapDrawingVertex: 'Corner {index}', mapDrawingEditInstructions: 'Use these keys to edit the selected corner' }; });
    await editSurface(element, peer); element.editDrawing(completed()); await settle(element, peer);
    await waitUntil(() => element.shadowRoot!.querySelectorAll('[part="drawing-vertex"]').length === 2);
    const handles = element.shadowRoot!.querySelectorAll<HTMLButtonElement>('[part="drawing-vertex"]');
    expect(handles[0]!.getAttribute('aria-label')).to.equal('Corner 1'); expect(element.shadowRoot!.textContent).to.include('Use these keys');
    expect(handles[0]!.tabIndex).to.equal(0); expect(handles[1]!.tabIndex).to.equal(-1);
    await focusByKeyboard(handles[0]!); const changes = capture(element, 'lr-map-draw-change'); await sendKeys({ press: 'ArrowRight' });
    expect((changes.at(-1) as LyraMapDrawingSnapshot).vertices[0]![0]).to.be.closeTo(-0.8, 0.001);
    await sendKeys({ press: 'PageDown' }); expect(element.shadowRoot!.activeElement === handles[1]).to.equal(true);
    await sendKeys({ press: 'Home' }); expect(element.shadowRoot!.activeElement === handles[0]).to.equal(true);
    expect(handles[0]!.getBoundingClientRect().width).to.be.at.least(24); expect(getComputedStyle(handles[0]!).touchAction).to.equal('none');
  });
  it('renders English editing labels without caller overrides and Escape cancels the explicit session', async () => {
    const { element, peer } = await mount(); await editSurface(element, peer); element.editDrawing(completed()); await settle(element, peer);
    await waitUntil(() => element.shadowRoot!.querySelector('[part="drawing-vertex"]') !== null);
    const handle = element.shadowRoot!.querySelector<HTMLButtonElement>('[part="drawing-vertex"]')!;
    expect(handle.getAttribute('aria-label')).to.equal('Vertex 1'); expect(element.shadowRoot!.textContent).to.include('Use arrow keys');
    await focusByKeyboard(handle); await sendKeys({ press: 'Escape' }); await settle(element, peer); expect(peer.sources.size).to.equal(0);
  });
  it('does not let a projection callback resurrect an edit cancelled during handle placement', async () => {
    const { element, peer } = await mount(); await editSurface(element, peer); element.editDrawing(completed());
    peer.beforeProject = () => { peer.beforeProject = undefined; element.cancelDrawing(); };
    await settle(element, peer); expect(element.shadowRoot!.querySelector('[part="drawing-vertex"]') === null).to.equal(true); expect(peer.sources.size).to.equal(0);
  });

  it('retires armed state before native enable callbacks so cancellation cannot recursively emit', async () => {
    const { element, peer } = await drawing(); await editSurface(element, peer); await vertex(element, peer, 0, 0); await vertex(element, peer, 5, 0);
    const cancels = capture(element, 'lr-map-draw-cancel'); pointer(peer, 'pointerdown', 100, 100);
    const nested: boolean[] = []; peer.afterPanEnable = () => { nested.push(element.cancelDrawing()); }; peer.afterZoomEnable = () => { nested.push(element.cancelDrawing()); };
    expect(element.cancelDrawing()).to.equal(true); await settle(element, peer);
    expect(nested).to.deep.equal([false, false]); expect(cancels.length).to.equal(1); expect(peer.panEnabled).to.equal(true); expect(peer.zoomGesture).to.equal(true);
  });
  it('does not synthesize cancel during completion when native zoom restoration reenters cancellation', async () => {
    const { element, peer } = await drawing(); await vertex(element, peer, 0, 0); await vertex(element, peer, 5, 0);
    const cancels = capture(element, 'lr-map-draw-cancel'); peer.afterZoomEnable = () => { element.cancelDrawing(); };
    expect(element.completeDrawing()).to.equal(true); await settle(element, peer); expect(cancels.length).to.equal(0); expect(peer.zoomGesture).to.equal(true);
  });
});
