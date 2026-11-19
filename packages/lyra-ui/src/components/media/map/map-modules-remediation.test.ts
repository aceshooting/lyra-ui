import { expect, fixture, fixtureCleanup, html, nextFrame, waitUntil } from '@open-wc/testing';
import { captureDevWarnings } from '../../../../test/expected-dev-warnings.js';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import { sceneArc } from '../../../../test/map-scene-admission-fixtures.js';
import { renderEnvironment } from '../../../../test/map-scene-render-component-fixtures.js';
import { ControlMapEngine, FakeAttributionControl as Attribution, FakeGeolocateControl as Geolocate } from '../../../../test/map-control-engine.js';
import { MapCanvasAllocationController } from './map-canvas-target.js';
import { mapFeatureLoader } from './map-feature-loader-core.js';
import { normalizeCameraOptions } from './map-camera.js';
import * as chrome from './map-control-chrome.js';
import { normalizeMapControlOptions } from './map-control-options.js';
import { buildMapLabelLayer, projectMapLabelOptions } from './map-data-layer-model.js';
import { MAP_IMAGE_LIMITS } from './map-image-admission.js';
import { exportMapImage, type MapImageExportServices } from './map-image-export.js';
import { MapImageProvider, type MapImageProviderContext } from './map-image-provider.js';
import { prepareMapImages, type MapImagePreparationServices } from './map-images.js';
import { loadMaplibreModule, type MapLibreMapCapability } from './map-loader.js';
import * as mapLoader from './map-loader.js';
import { MapGlobeControl } from './map-scene-controls.js';
import type { LyraMapDrawingSnapshot } from './map-drawing.js';
import { LYRA_MAP_EMPTY_STYLE, type LyraMap } from './map.js';
import './map.js';

describe('map loaders after a transient failure', () => {
  it('retries a rejected import but keeps an unusable module', async () => {
    let attempts = 0, unusable = 0;
    const valid = (value: unknown): value is string => value === 'ok';
    const load = mapLoader.createMapEngineLoader('test-peer', async () => {
      if (++attempts === 1) throw new Error('chunk unavailable');
      return 'ok';
    }, valid, () => 'Map');
    const keep = mapLoader.createMapEngineLoader('test-peer', async () => { unusable++; return {}; }, valid, () => 'Map');
    const warnings = await captureDevWarnings(async () => {
      const first = load.get();
      expect(first === load.get()).to.equal(true);
      expect(await first).to.equal(null);
      expect(await load.get()).to.equal('ok');
      expect(await load.get()).to.equal('ok');
      expect(attempts).to.equal(2);
      expect(await keep.get()).to.equal(null);
      expect(await keep.get()).to.equal(null);
      expect(unusable).to.equal(1);
    });
    expect(warnings.length).to.equal(2);
  });

  it('retries a failed feature chunk and shares the successful runtime', async () => {
    let calls = 0;
    const runtime = mapFeatureLoader(async () => {
      if (++calls === 1) throw new Error('chunk unavailable');
      return 'loaded';
    });
    expect(await runtime().catch(() => 'unavailable')).to.equal('unavailable');
    expect(runtime.loaded).to.equal(undefined);
    expect(await runtime()).to.equal('loaded');
    expect(runtime.loaded).to.equal('loaded');
    expect(calls).to.equal(2);
  });

  it('tells a failed import from a module that lacks a capability', async () => {
    const warnings = await captureDevWarnings(async () => {
      for (let index = 0; index < 2; index++) {
        expect(await loadMaplibreModule(async () => { throw new Error('chunk unavailable'); })).to.equal(null);
        expect(await loadMaplibreModule(async () => ({ Map: class {} }))).to.equal(null);
      }
    });
    expect(warnings).to.have.length(2);
    expect(warnings[0]).to.include('Check the network');
    expect(warnings[1]).to.include('lacks a capability');
  });
});

describe('remote map images', () => {
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"><rect width="8" height="8"/></svg>';
  const services: MapImagePreparationServices = { loadSanitizer: () => Promise.resolve({ sanitize: (value: string) => value }),
    rasterize: async (input) => ({ image: new ImageData(input.width, input.height), dispose: () => undefined }), fetchTimeoutMs: 60 };
  const rows = [{ id: 'icon', source: { kind: 'url', url: 'https://example.invalid/icon.svg' }, width: 8, height: 8, pixelRatio: 1 }];
  async function prepare(fetcher: typeof fetch) {
    const owner = await fixture<HTMLElement>(html`<div></div>`), abort = new AbortController();
    const native = window.fetch; window.fetch = fetcher;
    try { return await prepareMapImages(rows, { owner, signal: abort.signal, fetchController: new AbortController(), isCurrent: () => true }, services); }
    finally { window.fetch = native; }
  }
  const cors = (body: BodyInit | null) => { const response = new Response(body, { headers: { 'content-type': 'image/svg+xml' } }); Object.defineProperty(response, 'type', { value: 'cors' }); return response; };

  it('gives up on a host that never sends response headers', async () => {
    const started = performance.now();
    let signal: AbortSignal | null | undefined;
    const result = await prepare((_request, init) => {
      signal = init?.signal;
      return new Promise<Response>(() => undefined);
    });
    expect(signal?.aborted).to.equal(true);
    expect(result.ok).to.equal(false); expect(!result.ok && result.issue.code).to.equal('fetch');
    expect(performance.now() - started).to.be.lessThan(5000);
  });

  it('gives up on a body that stalls after the headers', async () => {
    const result = await prepare(async () => cors(new ReadableStream({ start(controller) { controller.enqueue(new TextEncoder().encode('<svg')); } })));
    expect(result.ok).to.equal(false); expect(!result.ok && result.issue.code).to.equal('fetch');
  });

  it('keeps a prompt response working under the same deadline', async () => {
    const result = await prepare(async () => cors(svg));
    expect(result.ok).to.equal(true); if (result.ok) result.dispose();
  });

  it('keeps the production deadline at the decode timeout', () => { expect(MAP_IMAGE_LIMITS.decodeTimeoutMs).to.be.greaterThan(0); });
});

describe('lazy image provider runtime failure', () => {
  class ProviderMap {
    listeners = new Set<(event: { id: string }) => void>();
    hasImage(): boolean { return false; }
    addImage(): void { /* not reached */ }
    removeImage(): void { /* not reached */ }
    on(_type: string, listener: (event: { id: string }) => void): void { this.listeners.add(listener); }
    off(_type: string, listener: (event: { id: string }) => void): void { this.listeners.delete(listener); }
  }
  for (const legacy of [true, false]) {
    it(`declines an image when the preparation runtime cannot load (${legacy ? 'engine event' : 'resolver hook'})`, async () => {
      const owner = await fixture<HTMLElement>(html`<div></div>`);
      const rejections: unknown[] = []; const onRejection = (event: PromiseRejectionEvent) => { rejections.push(event.reason); event.preventDefault(); };
      window.addEventListener('unhandledrejection', onRejection);
      const context: MapImageProviderContext = { owner, ownedIds: () => new Set(), ownedUsage: () => ({ count: 0, encodedBytes: 0, decodedPixels: 0 }),
        prepare: async () => { throw new Error('chunk unavailable'); } };
      const map = new ProviderMap(); let resolver: ((id: string) => Promise<void>) | undefined;
      if (!legacy) Object.assign(map, { setMissingStyleImageResolver: (value: typeof resolver) => { resolver = value; } });
      const asked: string[] = [];
      const provider = new MapImageProvider();
      provider.configure(map as unknown as MapLibreMapCapability, (id: string) => { asked.push(id); return { id, source: { kind: 'svg', markup: '<svg xmlns="http://www.w3.org/2000/svg" width="4" height="4"/>' }, width: 4, height: 4, pixelRatio: 1 }; }, context);
      const ask = async () => {
        if (legacy) { for (const listener of map.listeners) listener({ id: 'pin' }); } else await resolver!('pin');
        await new Promise((resolve) => setTimeout(resolve, 50));
      };
      try {
        const warnings = await captureDevWarnings(async () => { await ask(); await ask(); });
        expect(warnings.length).to.equal(1);
        expect(rejections.length).to.equal(0);
        expect(asked).to.deep.equal(['pin']);
      } finally {
        window.removeEventListener('unhandledrejection', onRejection);
        provider.configure(undefined, undefined, context);
      }
    });
  }
});

describe('map drawing completion listener', () => {
  class ControlMap extends ControlMapEngine {
    override project(point: readonly [number, number]) { return { x: point[0] * 10 + 100, y: point[1] * 10 + 100 }; }
    unproject(point: readonly [number, number]) { return { lng: (point[0] - 100) / 10, lat: (point[1] - 100) / 10 }; }
  }
  const originalObserver = window.IntersectionObserver, originalContext = HTMLCanvasElement.prototype.getContext;
  beforeEach(() => {
    Object.defineProperty(window, 'IntersectionObserver', { configurable: true, value: undefined });
    Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', { configurable: true, writable: true,
      value(this: HTMLCanvasElement, id: string, ...rest: unknown[]) { return id === 'webgl2' ? {} : originalContext.call(this, id as never, ...(rest as [])); } });
  });
  afterEach(() => {
    fixtureCleanup();
    Object.defineProperty(window, 'IntersectionObserver', { configurable: true, value: originalObserver });
    HTMLCanvasElement.prototype.getContext = originalContext;
  });
  async function drawing() {
    const wrapper = await fixture<HTMLDivElement>(html`<div></div>`);
    const element = document.createElement('lr-map') as LyraMap;
    element.engine = 'maplibre'; element.mapStyle = LYRA_MAP_EMPTY_STYLE; element.drawMode = 'line';
    (element as unknown as { loadLibrary: () => Promise<unknown> }).loadLibrary = async () => ({ Map: ControlMap, GeolocateControl: Geolocate, AttributionControl: Attribution });
    wrapper.append(element);
    await waitUntil(() => element.map !== undefined); await element.updateComplete;
    const peer = element.map as unknown as ControlMap;
    peer.fire('load'); await element.updateComplete; await element.whenStyleReady();
    await waitUntil(() => element.shadowRoot!.querySelector<HTMLButtonElement>('[part="drawing-add"]')?.disabled === false, 'drawing controls never enabled', { timeout: 5000 });
    peer.canvas.setPointerCapture = () => undefined; peer.canvas.releasePointerCapture = () => undefined;
    return { element, peer };
  }
  const settle = async (element: LyraMap, peer: ControlMap) => { await element.updateComplete; peer.idle = true; peer.fire('idle'); await element.whenIdle(); await element.updateComplete; };

  it('does not report a cancellation for a drawing it has just completed', async () => {
    const { element, peer } = await drawing();
    for (const [lng, lat] of [[0, 0], [1, 0]] as const) { peer.fire('click', { point: { x: 1, y: 2 }, lngLat: { lng, lat } }); await settle(element, peer); }
    const cancels: unknown[] = [], completes: LyraMapDrawingSnapshot[] = []; let nested: boolean | undefined;
    element.addEventListener('lr-map-draw-cancel', event => { cancels.push((event as CustomEvent).detail); });
    element.addEventListener('lr-map-draw-complete', event => { completes.push((event as CustomEvent<LyraMapDrawingSnapshot>).detail); nested = element.cancelDrawing(); });
    expect(element.completeDrawing()).to.equal(true); await settle(element, peer);
    expect(completes.length).to.equal(1); expect(nested).to.equal(false); expect(cancels.length).to.equal(0);
  });
});

describe('map image export attribution strip', () => {
  function setup(width: number, cssWidth: number | undefined, text: string, direction?: 'rtl') {
    const source = document.createElement('canvas'); source.width = width; source.height = 40;
    const ctx = source.getContext('2d')!; ctx.fillStyle = '#ff0000'; ctx.fillRect(0, 0, width, 40);
    if (cssWidth !== undefined) { source.style.cssText = `display:block;inline-size:${cssWidth}px;block-size:20px`; }
    if (direction) source.dir = direction;
    document.body.append(source);
    const drawn: { text: string; x: number; direction: string; align: string; font: string }[] = [];
    let listener: (() => void) | undefined;
    const service: MapImageExportServices = { requiresVisiblePixels: true, ready: async () => undefined, current: () => true,
      onRender(callback) { listener = callback; return () => { listener = undefined; }; }, requestRender() { listener?.(); },
      canvas: () => source, attributionText: () => text,
      createCanvas() {
        const canvas = document.createElement('canvas'), context = canvas.getContext('2d')!;
        context.measureText = ((value: string) => ({ width: value.length * 6 })) as typeof context.measureText;
        const paint = context.fillText.bind(context);
        context.fillText = ((value: string, x: number, y: number) => { drawn.push({ text: value, x, direction: context.direction, align: context.textAlign, font: context.font }); paint(value, x, y); }) as typeof context.fillText;
        return canvas;
      } };
    return { service, drawn, source };
  }
  afterEach(() => { for (const canvas of document.querySelectorAll('body > canvas')) canvas.remove(); });

  it('breaks lines at whitespace and only splits a token wider than the line', async () => {
    const item = setup(100, undefined, 'alpha beta gamma delta\nabcdefghijklmnopqrstuvwxyz0123456789');
    await exportMapImage({}, item.service);
    expect(item.drawn.map(line => line.text)).to.deep.equal(['alpha beta', 'gamma delta', 'abcdefghijklmn', 'opqrstuvwxyz01', '23456789']);
  });

  it('sizes the strip in CSS pixels of the map on a dense backing store', async () => {
    const dense = setup(400, 200, 'Map data'), plain = setup(200, 200, 'Map data');
    const a = await createImageBitmap(await exportMapImage({}, dense.service)), b = await createImageBitmap(await exportMapImage({}, plain.service));
    expect(a.height).to.equal(40 + 32 + 32); expect(b.height).to.equal(40 + 16 + 16);
    expect(dense.drawn[0]!.font.startsWith('24px')).to.equal(true); expect(plain.drawn[0]!.font.startsWith('12px')).to.equal(true);
    a.close(); b.close();
  });

  it('shapes and aligns the credit for a right-to-left map', async () => {
    const rtl = setup(200, undefined, 'Map data', 'rtl'), ltr = setup(200, undefined, 'Map data');
    await exportMapImage({}, rtl.service); await exportMapImage({}, ltr.service);
    expect(rtl.drawn[0]!.direction).to.equal('rtl'); expect(rtl.drawn[0]!.x).to.equal(192);
    expect(ltr.drawn[0]!.direction).to.equal('ltr'); expect(ltr.drawn[0]!.x).to.equal(8);
  });
});

describe('map option and label hardening', () => {
  it('names a linked credit by its host when the label is blank', () => {
    for (const label of ['', '   ']) {
      const entry = normalizeMapControlOptions({ attribution: { customAttribution: [{ label, url: 'https://example.com/credits' }] } }).controls.get('attribution')!;
      expect(entry.attributionText).to.deep.equal(['example.com']);
      const target = document.createElement('template'); target.innerHTML = (entry.options['customAttribution'] as readonly string[]).join('');
      expect(target.content.querySelector('a')!.textContent).to.equal('example.com');
    }
  });

  it('caps a camera duration that would never settle', () => {
    expect(normalizeCameraOptions({ zoom: 3, duration: 1e300 })).to.deep.equal({ zoom: 3, duration: 60000 });
    expect(normalizeCameraOptions({ zoom: 3, duration: 2500 })).to.deep.equal({ zoom: 3, duration: 2500 });
  });

  it('separates label text from the basemap with a surface halo unless a halo colour is authored', () => {
    const color = (value: string | undefined) => value ?? 'default';
    const halo = (input: Record<string, unknown>) => {
      const layer = buildMapLabelLayer('l', 's', projectMapLabelOptions({ field: 'name', ...input })!, color);
      const paint = layer['paint'] as Record<string, unknown>;
      return paint['text-halo-color'];
    };
    expect(halo({ haloWidth: 1 })).to.equal('var(--lr-color-surface)');
    expect(halo({ haloWidth: 1, haloColor: 'red' })).to.equal('red');
    expect(halo({})).to.equal('default');
  });
});

describe('map control focus repair', () => {
  afterEach(() => { fixtureCleanup(); });
  it('refocuses a control dropped by a move, and leaves a deliberate focus change alone', async () => {
    const wrapper = await fixture<HTMLElement>(html`<div><div id="a"><button id="one">One</button></div><div id="b"></div><button id="other">Other</button></div>`);
    const a = wrapper.querySelector<HTMLElement>('#a')!, one = wrapper.querySelector<HTMLButtonElement>('#one')!, other = wrapper.querySelector<HTMLButtonElement>('#other')!;
    await focusByKeyboard(one);
    chrome.moveKeepingFocus(a, () => { wrapper.append(a); })();
    expect(document.activeElement === one).to.equal(true);
    await focusByKeyboard(one);
    const restore = chrome.moveKeepingFocus(a, () => { wrapper.prepend(a); });
    await focusByKeyboard(other); restore();
    expect(document.activeElement === other).to.equal(true);
  });

  it('repairs a focused control inside a shadow tree in another document', async () => {
    const frame = await fixture<HTMLIFrameElement>(html`<iframe title="Map"></iframe>`);
    const doc = frame.contentDocument!;
    const container = doc.createElement('div');
    doc.body.append(container);
    const controls = doc.createElement('div');
    controls.className = 'maplibregl-control-container';
    const corner = doc.createElement('div');
    corner.className = 'maplibregl-ctrl-top-left';
    const button = doc.createElement('button');
    const shadow = corner.attachShadow({ mode: 'open' });
    shadow.append(button);
    controls.append(corner);
    container.append(controls);
    await focusByKeyboard(button);
    const row = doc.createElement('div');
    row.className = 'map-control-row-top';
    Object.defineProperty(row, 'moveBefore', { configurable: true, value: undefined });
    controls.append(row);
    chrome.syncMapControlRows(container, () => true);
    expect(shadow.activeElement === button).to.equal(true);
    expect(corner.parentNode === row).to.equal(true);
  });

  it('returns focus to a scene control once the action it started has finished', async () => {
    const canvas = document.createElement('canvas'); let busy = false;
    const peer = { getCanvas: () => canvas, getStyle: () => ({ sources: {} }), getProjection: () => ({ type: 'mercator' }), getTerrain: () => null,
      setProjection: () => undefined, setTerrain: () => undefined, on: () => undefined, off: () => undefined };
    const control = new MapGlobeControl();
    control.setSceneContext({ isCurrent: () => true, state: () => ({ ready: true, busy, label: 'Globe' }), unavailable: () => undefined });
    const root = control.onAdd(peer); document.body.append(root);
    try {
      const button = root.querySelector('button')!;
      control.on('activate', () => { busy = true; });
      await focusByKeyboard(button); button.click();
      expect(button.disabled).to.equal(true);
      await new Promise(resolve => requestAnimationFrame(() => { resolve(undefined); }));
      busy = false; control.refreshSceneControl();
      expect(button.disabled).to.equal(false);
      expect(document.activeElement === button).to.equal(true);
    } finally { control.onRemove(); }
  });
});

describe('elevated scene renderer after a rejected import', () => {
  let env: Awaited<ReturnType<typeof renderEnvironment>>;
  beforeEach(async () => { env = await renderEnvironment(); });
  afterEach(async () => { await env.close(); fixtureCleanup(); });
  it('retries the renderer import for the next scene instead of keeping ground tracks for good', async () => {
    let attempts = 0, created = 0;
    env.setLayerImporter(async () => {
      attempts += 1;
      if (attempts === 1) throw new Error('chunk failed');
      return { createSceneLayer: () => {
        created += 1;
        return { invalidateStyle() {}, styleReady() {}, requestFrame() {}, setVisible() {}, pick: async () => null, dispose() {} };
      } };
    });
    const { element } = await env.mount(map => { map.scene = { objects: [sceneArc('raised')] }; });
    await waitUntil(() => attempts === 1, 'first import attempted', { timeout: 2000 });
    element.scene = { objects: [sceneArc('replacement')] };
    await waitUntil(() => created === 1, 'renderer installed after retry', { timeout: 2000 });
    expect(attempts).to.equal(2);
  });
});

it('suspends canvas allocation measurements for an offscreen target and resumes on entry', async () => {
  const target = await fixture<HTMLElement>(html`<div style="position:fixed;top:0;left:0;width:200px;height:100px">
    <div style="width:80px;height:40px"></div></div>`);
  const base = target.firstElementChild as HTMLElement;
  const measure = base.getBoundingClientRect.bind(base);
  let reads = 0;
  base.getBoundingClientRect = () => { reads++; return measure(); };
  const layout = new MapCanvasAllocationController({ element: base, base: () => base, target: () => target, changed() {} });
  try {
    layout.refresh();
    expect(reads).to.be.greaterThan(0);
    target.style.top = '200vh';
    await nextFrame(); await nextFrame(); await nextFrame();
    const before = reads;
    await nextFrame(); await nextFrame();
    expect(reads).to.equal(before);
    target.style.top = '0';
    await waitUntil(() => reads > before, 'visible canvas allocation resumed');
  } finally { layout.dispose(); }
});
