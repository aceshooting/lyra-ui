import { expect, fixture, fixtureCleanup, html, oneEvent, waitUntil } from '@open-wc/testing';
import { getWorkerUrl, setWorkerUrl } from '@aceshooting/lyra-map';
import { sendKeys } from '@web/test-runner-commands';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import { resetMouse, sendMouse } from '../../../../test/wtr-mouse.js';
import { LyraMap, LYRA_MAP_EMPTY_STYLE } from './map.js';
import { loadMapDrawingRuntime, loadMapFeatureStateRuntime, loadMapHashRuntime } from './map-feature-loader.js';
import type { LyraMapInstance, LyraMapOverlays, LyraMapPickDetail, LyraMapDrawingSnapshot } from './map.class.js';
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
async function centerPixel(el: LyraMap): Promise<number[]> {
  await el.whenIdle(); const map = peer(el), canvas = map.getCanvas();
  return new Promise(resolve => {
    const rendered = () => {
      map.off('render', rendered);
      const gl = canvas.getContext('webgl2')!, rgba = new Uint8Array(4);
      gl.readPixels(Math.floor(canvas.width / 2), Math.floor(canvas.height / 2), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, rgba);
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
  before(() => Promise.all([loadMapDrawingRuntime(), loadMapFeatureStateRuntime(), loadMapHashRuntime()]));
  beforeEach(() => {
    previousWorkerUrl = getWorkerUrl();
    setWorkerUrl(new URL('/__lyra-map-worker__/worker.mjs', location.origin).href);
  });
  afterEach(async () => { try { await resetMouse(); } finally { try { fixtureCleanup(); } finally { setWorkerUrl(previousWorkerUrl); } } });

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
  it('M09 renders a 600,000-value GeoJSON overlay with native paint, filter, zoom gating, order, picking and state across style swaps', async () => {
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

  it('M10 supplies lazy SDF icons, takes a sprite catalog beyond 64 and changes images without re-adding layers', async () => {
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

});
