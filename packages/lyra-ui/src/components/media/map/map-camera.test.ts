import { expect, fixture, fixtureCleanup, html, waitUntil } from '@open-wc/testing';
import './map.js';
import { captureDevWarnings } from '../../../../test/expected-dev-warnings.js';
import type { LyraMap, LyraMapStyleSpecification } from './map.js';
import {
  emptyExtent,
  extendExtent,
  extendExtentWithGeoJson,
  extentToBounds,
  normalizeCameraOptions,
} from './map-camera.js';

// Camera contracts between the element and its engine, driven through a scripted engine installed
// at the component's `loadLibrary` seam, so every assertion runs in all three browsers: headless
// Firefox and WebKit do not reliably provide the WebGL2 context a real engine needs.

const EMPTY_STYLE = { version: 8, sources: {}, layers: [] } satisfies LyraMapStyleSpecification;

type Listener = (event: Record<string, unknown>) => void;

interface CommandCall {
  readonly method: string;
  readonly options: Record<string, unknown>;
  readonly eventData: Record<string, unknown> | undefined;
}

/** A camera engine that settles every command synchronously, like a jump, and fires the `move` and
 *  `moveend` events a real engine fires, with the caller's event data merged in. */
class ScriptedCameraMap {
  static instances: ScriptedCameraMap[] = [];
  readonly options: Record<string, unknown>;
  readonly commandCalls: CommandCall[] = [];
  readonly fitCalls: { bounds: unknown; options: Record<string, unknown> }[] = [];
  readonly setCenterCalls: unknown[] = [];
  readonly setZoomCalls: unknown[] = [];
  readonly paddingCalls: Record<string, number>[] = [];
  private readonly listeners = new Map<string, Set<Listener>>();
  private readonly canvas = document.createElement('canvas');
  center: { lng: number; lat: number };
  zoom: number;

  constructor(options: Record<string, unknown>) {
    this.options = options;
    const [lng, lat] = options['center'] as [number, number];
    this.center = { lng, lat };
    this.zoom = options['zoom'] as number;
    if (typeof options['minZoom'] === 'number') this.minZoom = options['minZoom'];
    if (typeof options['maxZoom'] === 'number') this.maxZoom = options['maxZoom'];
    ScriptedCameraMap.instances.push(this);
  }

  on(type: string, listener: Listener): this {
    let set = this.listeners.get(type);
    if (!set) this.listeners.set(type, (set = new Set()));
    set.add(listener);
    return this;
  }

  once(type: string, listener: Listener): this {
    return this.on(type, listener);
  }

  fire(type: string, eventData: Record<string, unknown> = {}): void {
    for (const listener of this.listeners.get(type) ?? []) listener({ type, target: this, ...eventData });
  }

  getCanvas(): HTMLCanvasElement {
    return this.canvas;
  }

  getCenter(): { lng: number; lat: number } {
    return { ...this.center };
  }

  getZoom(): number {
    return this.zoom;
  }

  /** A fixed 10-degree window around the centre, so tests can predict the reported box. */
  getBounds() {
    const { lng, lat } = this.center;
    return {
      getWest: () => lng - 5,
      getSouth: () => lat - 5,
      getEast: () => lng + 5,
      getNorth: () => lat + 5,
    };
  }

  /** One pixel per tenth of a degree, origin at (0, 0) = longitude 0, latitude 0. */
  project(lngLat: [number, number]): { x: number; y: number } {
    return { x: lngLat[0] * 10, y: -lngLat[1] * 10 };
  }

  unproject(point: [number, number]): { lng: number; lat: number } {
    return { lng: point[0] / 10, lat: -point[1] / 10 };
  }

  setPadding(padding: Record<string, number>): this {
    this.paddingCalls.push(padding);
    this.fire('moveend', {});
    return this;
  }

  private settle(camera: Record<string, unknown>, eventData?: Record<string, unknown>): void {
    const center = camera['center'] as [number, number] | undefined;
    if (center) this.center = { lng: center[0], lat: center[1] };
    if (typeof camera['zoom'] === 'number') this.zoom = camera['zoom'];
    this.fire('move', eventData);
    this.fire('moveend', eventData);
  }

  flyTo(options: Record<string, unknown>, eventData?: Record<string, unknown>): this {
    this.commandCalls.push({ method: 'flyTo', options, eventData });
    this.settle(options, eventData);
    return this;
  }

  easeTo(options: Record<string, unknown>, eventData?: Record<string, unknown>): this {
    this.commandCalls.push({ method: 'easeTo', options, eventData });
    this.settle(options, eventData);
    return this;
  }

  jumpTo(options: Record<string, unknown>, eventData?: Record<string, unknown>): this {
    this.commandCalls.push({ method: 'jumpTo', options, eventData });
    this.settle(options, eventData);
    return this;
  }

  setCenter(center: [number, number]): this {
    this.setCenterCalls.push(center);
    this.settle({ center });
    return this;
  }

  setZoom(zoom: number): this {
    this.setZoomCalls.push(zoom);
    this.settle({ zoom });
    return this;
  }

  fitBounds(
    bounds: readonly [readonly [number, number], readonly [number, number]],
    options: Record<string, unknown> = {},
    eventData: Record<string, unknown> = {},
  ): this {
    this.fitCalls.push({ bounds, options });
    const [[west, south], [east, north]] = bounds;
    this.settle({ center: [(west + east) / 2, (south + north) / 2], zoom: 6 }, eventData);
    return this;
  }

  isMoving(): boolean {
    return false;
  }

  readonly limitCalls: string[] = [];
  private minZoom = 0;
  private maxZoom = 22;

  /** Mirrors the engine: a limit that excludes the camera moves it inside. */
  setMinZoom(zoom: number): this {
    if (zoom > this.maxZoom) throw new Error('minZoom must be less than or equal to maxZoom');
    this.limitCalls.push(`min:${zoom}`); this.minZoom = zoom;
    if (this.zoom < zoom) this.setZoom(zoom);
    return this;
  }

  setMaxZoom(zoom: number): this {
    if (zoom < this.minZoom) throw new Error('maxZoom must be greater than or equal to minZoom');
    this.limitCalls.push(`max:${zoom}`); this.maxZoom = zoom;
    if (this.zoom > zoom) this.setZoom(zoom);
    return this;
  }

  getMaxZoom(): number {
    return this.maxZoom;
  }

  resize(): void {}
  remove(): void {}
}

class ScriptedPopup {
  setHTML(): this {
    return this;
  }

  setText(): this {
    return this;
  }
}

class ScriptedMarker {
  private readonly element = document.createElement('div');
  setLngLat(): this {
    return this;
  }

  setPopup(): this {
    return this;
  }

  getPopup(): undefined {
    return undefined;
  }

  addTo(): this {
    return this;
  }

  getElement(): HTMLElement {
    return this.element;
  }

  remove(): void {}
}

const OriginalIntersectionObserver = window.IntersectionObserver;
const originalGetContext = HTMLCanvasElement.prototype.getContext;
const originalMatchMedia = window.matchMedia;

function preferReducedMotion(reduce: boolean): void {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: (query: string) => ({
      matches: reduce && query.includes('prefers-reduced-motion: reduce'),
      media: query,
      onchange: null,
      addListener() {},
      removeListener() {},
      addEventListener() {},
      removeEventListener() {},
      dispatchEvent: () => false,
    }),
  });
}

interface Harness {
  readonly el: LyraMap;
  readonly load: () => Promise<ScriptedCameraMap>;
}

async function connectScriptedMap(configure?: (el: LyraMap) => void): Promise<Harness> {
  let resolveLibrary!: (module: unknown) => void;
  const library = new Promise((resolve) => {
    resolveLibrary = resolve;
  });
  const wrapper = (await fixture(html`<div style="inline-size: 32rem; block-size: 20rem"></div>`)) as HTMLElement;
  const el = document.createElement('lr-map') as LyraMap;
  el.engine = 'maplibre';
  (el as unknown as { loadLibrary: () => Promise<unknown> }).loadLibrary = () => library;
  el.mapStyle = EMPTY_STYLE;
  configure?.(el);
  wrapper.append(el);
  await el.updateComplete;
  return {
    el,
    load: async () => {
      resolveLibrary({ Map: ScriptedCameraMap, Marker: ScriptedMarker, Popup: ScriptedPopup });
      await waitUntil(() => el.map != null, 'scripted map never initialized', { timeout: 2000 });
      await el.updateComplete;
      return el.map as unknown as ScriptedCameraMap;
    },
  };
}

async function liveScriptedMap(
  configure?: (el: LyraMap) => void,
): Promise<{ el: LyraMap; engine: ScriptedCameraMap }> {
  const { el, load } = await connectScriptedMap(configure);
  const engine = await load();
  // Let the settle of construction (queued work, first update) finish before a test acts.
  await el.updateComplete;
  await new Promise((resolve) => setTimeout(resolve, 0));
  return { el, engine };
}

/** Collects the details of every `type` event dispatched while `run` executes and settles. */
async function collect(
  el: LyraMap,
  type: string,
  run: () => unknown | Promise<unknown>,
): Promise<Record<string, unknown>[]> {
  const details: Record<string, unknown>[] = [];
  const listener = (event: Event) => details.push((event as CustomEvent<Record<string, unknown>>).detail);
  el.addEventListener(type, listener);
  try {
    await run();
    await el.updateComplete;
    await new Promise((resolve) => setTimeout(resolve, 0));
    await el.updateComplete;
  } finally {
    el.removeEventListener(type, listener);
  }
  return details;
}

/** A pan by the user, as the engine reports it. */
function userPan(engine: ScriptedCameraMap, lng: number, lat: number): void {
  engine.center = { lng, lat };
  engine.fire('moveend', { originalEvent: {} });
}

describe('map camera helpers', () => {
  it('normalizes camera options and rejects a request with no usable camera field', () => {
    expect(normalizeCameraOptions({ center: [200, -95], zoom: 40, pitch: 120 })).to.deep.equal({
      center: [180, -90],
      zoom: 22,
      pitch: 85,
    });
    expect(normalizeCameraOptions({ center: [Number.NaN, 1], zoom: Number.NaN })).to.equal(undefined);
    expect(normalizeCameraOptions({ duration: 100 })).to.equal(undefined);
    expect(normalizeCameraOptions(null)).to.equal(undefined);
    expect(normalizeCameraOptions({ zoom: 3, duration: -1 })).to.deep.equal({ zoom: 3 });
    expect(normalizeCameraOptions({ zoom: 3, duration: 250 })).to.deep.equal({ zoom: 3, duration: 250 });
    expect(normalizeCameraOptions({ zoom: 30 }, [4, 24])).to.deep.equal({ zoom: 24 });
    expect(normalizeCameraOptions({ zoom: 1 }, [4, 12])).to.deep.equal({ zoom: 4 });
  });

  it('measures the extent of nested GeoJSON, skipping non-finite positions', () => {
    const extent = emptyExtent();
    extendExtentWithGeoJson(extent, {
      type: 'FeatureCollection',
      features: [
        { type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: [10, 20] } },
        {
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'MultiPolygon',
            coordinates: [[[[-5, -6], [30, 2], [Number.NaN, 4], [0, 50], [-5, -6]]]],
          },
        },
        {
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'GeometryCollection',
            geometries: [{ type: 'LineString', coordinates: [[0, 0], [60, -10]] }],
          },
        },
      ],
    });
    expect(extentToBounds(extent)).to.deep.equal([[-5, -10], [60, 50]]);
    expect(extentToBounds(emptyExtent())).to.equal(undefined);
    const clamped = emptyExtent();
    extendExtent(clamped, 400, -100);
    expect(extentToBounds(clamped)).to.deep.equal([[180, -90], [180, -90]]);
  });
});

describe('map camera', () => {
  beforeEach(() => {
    ScriptedCameraMap.instances = [];
    preferReducedMotion(false);
    Object.defineProperty(window, 'IntersectionObserver', { configurable: true, value: undefined });
    Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
      configurable: true,
      writable: true,
      value(this: HTMLCanvasElement, contextId: string, ...rest: unknown[]) {
        if (contextId === 'webgl2') return {};
        return originalGetContext.call(this, contextId as never, ...(rest as []));
      },
    });
  });

  afterEach(() => {
    fixtureCleanup();
    Object.defineProperty(window, 'IntersectionObserver', {
      configurable: true,
      value: OriginalIntersectionObserver,
    });
    HTMLCanvasElement.prototype.getContext = originalGetContext;
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      writable: true,
      value: originalMatchMedia,
    });
  });

  describe('center compares by value', () => {
    it('keeps the user pan when an equal but new array is assigned', async () => {
      const { el, engine } = await liveScriptedMap((map) => {
        map.center = [10, 20];
      });
      userPan(engine, 11, 21);
      await el.updateComplete;
      expect(el.center).to.deep.equal([11, 21]);

      el.center = [10, 20];
      await el.updateComplete;

      expect(engine.setCenterCalls, 'no push').to.have.length(0);
      expect(engine.center).to.deep.equal({ lng: 11, lat: 21 });
      expect(el.center, 'still the user camera').to.deep.equal([11, 21]);
    });

    it('moves for a different value, and again for a value that differs from the last assigned', async () => {
      const { el, engine } = await liveScriptedMap((map) => {
        map.center = [10, 20];
      });
      el.center = [30, 40];
      await el.updateComplete;
      expect(engine.center).to.deep.equal({ lng: 30, lat: 40 });

      userPan(engine, 31, 41);
      el.center = [30, 40];
      await el.updateComplete;
      expect(engine.center, 'an equal assignment is a no-op').to.deep.equal({ lng: 31, lat: 41 });

      el.center = [10, 20];
      await el.updateComplete;
      expect(engine.center, 'an earlier value is a new request').to.deep.equal({ lng: 10, lat: 20 });
    });

    it('treats a different longitude or latitude as a new value', async () => {
      const { el, engine } = await liveScriptedMap((map) => {
        map.center = [10, 20];
      });
      el.center = [10, 21];
      await el.updateComplete;
      expect(engine.center).to.deep.equal({ lng: 10, lat: 21 });
    });

    it('re-centres explicitly with jumpTo()', async () => {
      const { el, engine } = await liveScriptedMap((map) => {
        map.center = [10, 20];
      });
      userPan(engine, 11, 21);
      await el.updateComplete;
      expect(el.jumpTo({ center: [10, 20] })).to.equal(true);
      await el.updateComplete;
      expect(engine.center).to.deep.equal({ lng: 10, lat: 20 });
      expect(el.center).to.deep.equal([10, 20]);
    });
  });

  describe('camera commands', () => {
    for (const method of ['flyTo', 'easeTo', 'jumpTo'] as const) {
      it(`${method}() moves the engine, writes the camera back and reports source "command"`, async () => {
        const { el, engine } = await liveScriptedMap();
        let result = false;
        const changes = await collect(el, 'lr-map-view-change', () => {
          result = el[method]({ center: [5, 6], zoom: 7, duration: 300 });
        });

        expect(result).to.equal(true);
        expect(engine.commandCalls).to.have.length(1);
        expect(engine.commandCalls[0]!.method).to.equal(method);
        expect(engine.commandCalls[0]!.options['center']).to.deep.equal([5, 6]);
        expect(engine.commandCalls[0]!.options['zoom']).to.equal(7);
        expect(engine.commandCalls[0]!.options['duration'] === 300).to.equal(method !== 'jumpTo');
        expect(el.center).to.deep.equal([5, 6]);
        expect(el.zoom).to.equal(7);
        expect(changes).to.have.length(1);
        expect(changes[0]!['source']).to.equal('command');
        expect(changes[0]!['center']).to.deep.equal([5, 6]);
        expect(changes[0]!['zoom']).to.equal(7);
        expect(engine.setCenterCalls, 'written back without a second move').to.have.length(0);
        expect(engine.setZoomCalls).to.have.length(0);
        expect(engine.commandCalls).to.have.length(1);
      });
    }

    it('turns flyTo() and easeTo() into a jump under prefers-reduced-motion', async () => {
      preferReducedMotion(true);
      const { el, engine } = await liveScriptedMap();
      el.flyTo({ center: [1, 2], duration: 900 });
      el.easeTo({ zoom: 4, duration: 900 });
      expect(engine.commandCalls.map((call) => call.method)).to.deep.equal(['jumpTo', 'jumpTo']);
      expect(engine.commandCalls.every((call) => !('duration' in call.options))).to.equal(true);
    });

    it('jumps under a local data-lr-motion="reduce" scope', async () => {
      const { el, engine } = await liveScriptedMap();
      el.setAttribute('data-lr-motion', 'reduce');
      el.flyTo({ center: [1, 2] });
      expect(engine.commandCalls.map((call) => call.method)).to.deep.equal(['jumpTo']);
    });

    it('rejects options with nothing usable, without touching the engine', async () => {
      const { el, engine } = await liveScriptedMap();
      const originalWarn = console.warn;
      const warnings: string[] = [];
      console.warn = (...args: unknown[]) => {
        warnings.push(args.map(String).join(' '));
      };
      try {
        expect(el.flyTo({})).to.equal(false);
        expect(el.easeTo({ center: [Number.NaN, 0] })).to.equal(false);
        expect(el.jumpTo(null as never)).to.equal(false);
      } finally {
        console.warn = originalWarn;
      }
      expect(engine.commandCalls).to.have.length(0);
      expect(warnings.every((warning) => /flyTo|easeTo|jumpTo/.test(warning))).to.equal(true);
    });

    it('returns false when the engine has no such command', async () => {
      const { el, engine } = await liveScriptedMap();
      (engine as unknown as { flyTo?: unknown }).flyTo = undefined;
      expect(el.flyTo({ zoom: 3 })).to.equal(false);
    });

    it('queues a command made before the engine exists and applies it on load', async () => {
      const { el, load } = await connectScriptedMap();
      expect(el.flyTo({ center: [8, 9], zoom: 5 })).to.equal(true);
      expect(el.flyTo({ center: [12, 13], zoom: 6 }), 'the latest request wins').to.equal(true);
      let changes: Record<string, unknown>[] = [];
      let engine!: ScriptedCameraMap;
      changes = await collect(el, 'lr-map-view-change', async () => {
        engine = await load();
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      expect(engine.commandCalls).to.have.length(1);
      expect(engine.commandCalls[0]!.method, 'queued commands do not animate').to.equal('jumpTo');
      expect(el.center).to.deep.equal([12, 13]);
      expect(el.zoom).to.equal(6);
      expect(changes.map((change) => change['source'])).to.deep.equal(['command']);
    });

    it('drops a queued command when center is given a different value afterwards', async () => {
      const { el, load } = await connectScriptedMap();
      el.jumpTo({ center: [8, 9] });
      el.center = [40, 41];
      const engine = await load();
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(engine.commandCalls).to.have.length(0);
      expect(engine.center).to.deep.equal({ lng: 40, lat: 41 });
    });

    it('keeps a queued command when an equal center is re-assigned', async () => {
      const { el, load } = await connectScriptedMap((map) => {
        map.center = [3, 4];
      });
      el.jumpTo({ center: [8, 9] });
      el.center = [3, 4];
      const engine = await load();
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(engine.commandCalls).to.have.length(1);
      expect(el.center).to.deep.equal([8, 9]);
    });

    it('applies after a center assigned in the same tick, not before it', async () => {
      const { el, engine } = await liveScriptedMap();
      el.center = [50, 51];
      expect(el.flyTo({ center: [20, 21], zoom: 4 })).to.equal(true);
      expect(engine.commandCalls, 'deferred behind the pending update').to.have.length(0);
      await el.updateComplete;
      await waitUntil(() => engine.commandCalls.length === 1, 'the command never ran');
      await el.updateComplete;
      expect(engine.center).to.deep.equal({ lng: 20, lat: 21 });
      expect(el.center).to.deep.equal([20, 21]);
      expect(engine.setCenterCalls.length, 'the assigned center was pushed first').to.equal(1);
    });
  });

  describe('fitBounds ordering', () => {
    it('is not interrupted by a center assigned in the same tick', async () => {
      const { el, engine } = await liveScriptedMap();
      el.center = [50, 51];
      expect(el.fitBounds([[0, 0], [10, 10]])).to.equal(true);
      await el.updateComplete;
      await waitUntil(() => engine.fitCalls.length === 1, 'the fit never ran');
      await el.updateComplete;
      expect(engine.center).to.deep.equal({ lng: 5, lat: 5 });
      expect(el.center).to.deep.equal([5, 5]);
    });

    it('still applies synchronously when nothing is pending', async () => {
      const { el, engine } = await liveScriptedMap();
      expect(el.fitBounds([[0, 0], [10, 10]])).to.equal(true);
      expect(engine.fitCalls).to.have.length(1);
    });
  });

  describe('lr-map-view-change bounds', () => {

    it('normalizes a peer viewport spanning the world before publishing reusable bounds', async () => {
      const { el, engine } = await liveScriptedMap();
      engine.getBounds = () => ({
        getWest: () => -220, getSouth: () => -40,
        getEast: () => 220, getNorth: () => 50,
      });
      const [change] = await collect(el, 'lr-map-view-change', () => el.jumpTo({ zoom: 3 }));
      expect(change!['bounds']).to.deep.equal([[-180, -40], [180, 50]]);
      expect(el.fitBounds(change!['bounds'] as [[number, number], [number, number]])).to.equal(true);
      expect(engine.fitCalls.at(-1)!.bounds).to.deep.equal([[-180, -40], [180, 50]]);
    });

    it('keeps camera commands available after a peer refuses padding and accepts a later padding change', async () => {
      const { el, engine } = await liveScriptedMap();
      const apply = engine.setPadding.bind(engine);
      let refusals = 0;
      engine.setPadding = () => { refusals++; throw new Error('peer padding unavailable'); };
      el.cameraPadding = { top: 12 };
      await el.updateComplete;
      expect(refusals).to.equal(1);
      expect(el.map === engine).to.equal(true);
      expect(el.jumpTo({ center: [10, 20] })).to.equal(true);
      expect(engine.center).to.deep.equal({ lng: 10, lat: 20 });
      engine.setPadding = apply;
      el.cameraPadding = { top: 24, left: 8 };
      await el.updateComplete;
      expect(engine.paddingCalls).to.deep.equal([{ top: 24, right: 0, bottom: 0, left: 8 }]);
      expect(el.map === engine).to.equal(true);
    });

    it('reports the visible bounds for user, fit and command moves', async () => {
      const { el, engine } = await liveScriptedMap();
      const changes = await collect(el, 'lr-map-view-change', async () => {
        userPan(engine, 10, 20);
        el.fitBounds([[0, 0], [20, 20]]);
        el.jumpTo({ center: [30, 40] });
      });
      expect(changes.map((change) => change['source'])).to.deep.equal(['user', 'fit', 'command']);
      expect(changes[0]!['bounds']).to.deep.equal([[5, 15], [15, 25]]);
      expect(changes[1]!['bounds']).to.deep.equal([[5, 5], [15, 15]]);
      expect(changes[2]!['bounds']).to.deep.equal([[25, 35], [35, 45]]);
    });

    it('shifts a box that starts west of -180 so fitBounds accepts it back', async () => {
      const { el, engine } = await liveScriptedMap();
      const changes = await collect(el, 'lr-map-view-change', () => el.jumpTo({ center: [-178, 0] }));
      expect(engine.center.lng).to.equal(-178);
      const box = changes[0]!['bounds'] as [[number, number], [number, number]];
      const west = box[0][0];
      const east = box[1][0];
      expect(west).to.equal(-183 + 360);
      expect(east - west).to.equal(10);
    });

    it('omits bounds when the engine cannot report them', async () => {
      const { el, engine } = await liveScriptedMap();
      (engine as unknown as { getBounds?: unknown }).getBounds = undefined;
      const [change] = await collect(el, 'lr-map-view-change', () => el.jumpTo({ zoom: 3 }));
      expect(change).to.not.have.property('bounds');
      expect(change!['source']).to.equal('command');
    });

    it('measures the box inside cameraPadding', async () => {
      const { el, engine } = await liveScriptedMap((map) => {
        map.cameraPadding = { left: 100, top: 20 };
      });
      await el.updateComplete;
      const container = el.shadowRoot!.querySelector<HTMLElement>('[part="container"]')!;
      const width = container.clientWidth;
      const height = container.clientHeight;
      const [change] = await collect(el, 'lr-map-view-change', () => el.jumpTo({ zoom: 3 }));
      // The scripted engine unprojects one tenth of a degree per pixel.
      expect(change!['bounds']).to.deep.equal([
        [100 / 10, -height / 10],
        [width / 10, -20 / 10],
      ]);
      expect(engine.paddingCalls).to.have.length(1);
    });
  });

  describe('cameraPadding', () => {
    it('applies the padding once the engine exists', async () => {
      const { engine } = await liveScriptedMap((map) => {
        map.cameraPadding = { top: 10, left: 30 };
      });
      expect(engine.paddingCalls).to.deep.equal([{ top: 10, right: 0, bottom: 0, left: 30 }]);
    });

    it('applies nothing for the default, and changes only when the padding changes', async () => {
      const { el, engine } = await liveScriptedMap();
      expect(engine.paddingCalls).to.have.length(0);
      el.cameraPadding = { top: 5 };
      await el.updateComplete;
      el.cameraPadding = { top: 5 };
      await el.updateComplete;
      expect(engine.paddingCalls).to.deep.equal([{ top: 5, right: 0, bottom: 0, left: 0 }]);
      el.cameraPadding = undefined;
      await el.updateComplete;
      expect(engine.paddingCalls[1]).to.deep.equal({ top: 0, right: 0, bottom: 0, left: 0 });
    });

    it('guards negative and non-finite sides', async () => {
      const { engine } = await liveScriptedMap((map) => {
        map.cameraPadding = { top: -4, right: Number.NaN, bottom: Number.POSITIVE_INFINITY, left: 12 };
      });
      expect(engine.paddingCalls).to.have.length(1);
      const [call] = engine.paddingCalls;
      expect(call!['top']).to.equal(0);
      expect(call!['right']).to.equal(0);
      expect(call!['left']).to.equal(12);
      expect(Number.isFinite(call!['bottom'])).to.equal(true);
    });

    it('is not reported as a camera change', async () => {
      const { el } = await liveScriptedMap();
      const changes = await collect(el, 'lr-map-view-change', async () => {
        el.cameraPadding = { left: 40 };
      });
      expect(changes).to.have.length(0);
    });
  });

  describe('fitToData', () => {
    it('frames markers, data layers and the choropleth together', async () => {
      const { el, engine } = await liveScriptedMap((map) => {
        map.markers = [{ lngLat: [-10, 5] }, { lngLat: [4, 6] }];
        map.dataLayers = [{
          sourceId: 'routes',
          geojson: {
            type: 'FeatureCollection',
            features: [{
              type: 'Feature',
              properties: {},
              geometry: { type: 'LineString', coordinates: [[0, 0], [20, 3]] },
            }],
          },
        }];
        map.choropleth = {
          sourceId: 'regions',
          field: 'v',
          stops: [[0, '#000'], [1, '#fff']],
          geojson: {
            type: 'FeatureCollection',
            features: [{
              type: 'Feature',
              properties: { v: 1 },
              geometry: { type: 'Polygon', coordinates: [[[1, 1], [2, 30], [3, 1], [1, 1]]] },
            }],
          },
        };
      });
      const changes = await collect(el, 'lr-map-view-change', () => {
        expect(el.fitToData({ padding: 12 })).to.equal(true);
      });
      expect(engine.fitCalls).to.have.length(1);
      expect(engine.fitCalls[0]!.bounds).to.deep.equal([[-10, 0], [20, 30]]);
      expect((engine.fitCalls[0]!.options['padding'] as Record<string, number>)['top']).to.equal(12);
      expect(changes.map((change) => change['source'])).to.deep.equal(['fit']);
    });

    it('caps the zoom of a single marker unless told otherwise', async () => {
      const { el, engine } = await liveScriptedMap((map) => {
        map.markers = [{ lngLat: [2.35, 48.85] }];
      });
      el.fitToData();
      el.fitToData({ maxZoom: 9 });
      expect(engine.fitCalls[0]!.options['maxZoom']).to.equal(16);
      expect(engine.fitCalls[1]!.options['maxZoom']).to.equal(9);
    });

    it('counts a markers assignment made in the same tick', async () => {
      const { el, engine } = await liveScriptedMap();
      el.markers = [{ lngLat: [1, 2] }, { lngLat: [3, 4] }];
      expect(el.fitToData()).to.equal(true);
      await waitUntil(() => engine.fitCalls.length === 1, 'the fit never ran');
      expect(engine.fitCalls[0]!.bounds).to.deep.equal([[1, 2], [3, 4]]);
    });

    it('returns false and does nothing when nothing is drawn', async () => {
      const { el, engine } = await liveScriptedMap();
      expect(el.fitToData()).to.equal(false);
      expect(engine.fitCalls).to.have.length(0);
    });

    it('queues before the engine exists', async () => {
      const { el, load } = await connectScriptedMap((map) => {
        map.markers = [{ lngLat: [1, 2] }, { lngLat: [3, 4] }];
      });
      expect(el.fitToData()).to.equal(true);
      const engine = await load();
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(engine.fitCalls).to.have.length(1);
    });
  });

  describe('project and unproject', () => {
    it('delegates to the engine and validates its input', async () => {
      const { el } = await liveScriptedMap();
      expect(el.project([3, 4])).to.deep.equal([30, -40]);
      expect(el.unproject([30, -40])).to.deep.equal([3, 4]);
      expect(el.project([Number.NaN, 1])).to.equal(undefined);
      expect(el.unproject([1, Number.POSITIVE_INFINITY])).to.equal(undefined);
      expect(el.project(undefined as never)).to.equal(undefined);
    });

    it('wraps an unprojected longitude and returns undefined without an engine', async () => {
      const { el, engine } = await liveScriptedMap();
      engine.unproject = () => ({ lng: 190, lat: 10 });
      expect(el.unproject([0, 0])).to.deep.equal([-170, 10]);
      const { el: early } = await connectScriptedMap();
      expect(early.project([1, 1])).to.equal(undefined);
      expect(early.unproject([1, 1])).to.equal(undefined);
    });

    it('returns undefined when the engine cannot project', async () => {
      const { el, engine } = await liveScriptedMap();
      (engine as unknown as { project?: unknown }).project = undefined;
      expect(el.project([1, 1])).to.equal(undefined);
    });
  });

  describe('lr-map-move', () => {
    it('coalesces the moves of one frame into a single event', async () => {
      const { el, engine } = await liveScriptedMap();
      const moves = await collect(el, 'lr-map-move', async () => {
        engine.fire('move');
        engine.fire('move');
        engine.fire('move');
        await new Promise((resolve) => requestAnimationFrame(() => resolve(undefined)));
        await new Promise((resolve) => requestAnimationFrame(() => resolve(undefined)));
      });
      expect(moves).to.have.length(1);
      expect(moves[0]!['center']).to.deep.equal([0, 0]);
      expect(moves[0]!['zoom']).to.equal(2);
      expect(moves[0]!['bounds']).to.deep.equal([[-5, -5], [5, 5]]);
    });

    it('flushes the final position when the move ends, without waiting for a frame', async () => {
      const { el, engine } = await liveScriptedMap();
      const moves: Record<string, unknown>[] = [];
      el.addEventListener('lr-map-move', (event) => {
        moves.push((event as unknown as CustomEvent<Record<string, unknown>>).detail);
      });
      engine.center = { lng: 7, lat: 8 };
      engine.fire('move');
      engine.fire('moveend');
      expect(moves).to.have.length(1);
      expect(moves[0]!['center']).to.deep.equal([7, 8]);
    });

    it('is reported for programmatic moves too', async () => {
      const { el } = await liveScriptedMap();
      const moves = await collect(el, 'lr-map-move', async () => {
        el.flyTo({ center: [15, 16] });
      });
      expect(moves.length).to.be.greaterThan(0);
      expect(moves[moves.length - 1]!['center']).to.deep.equal([15, 16]);
    });

    it('is reported for a declarative center assignment', async () => {
      const { el } = await liveScriptedMap();
      const moves = await collect(el, 'lr-map-move', async () => {
        el.center = [21, 22];
      });
      expect(moves[moves.length - 1]!['center']).to.deep.equal([21, 22]);
    });

    it('does not report after the element is disconnected', async () => {
      const { el, engine } = await liveScriptedMap();
      engine.fire('move');
      const moves: unknown[] = [];
      el.addEventListener('lr-map-move', (event) => moves.push(event));
      el.remove();
      await new Promise((resolve) => requestAnimationFrame(() => resolve(undefined)));
      await new Promise((resolve) => requestAnimationFrame(() => resolve(undefined)));
      expect(moves).to.have.length(0);
    });
  });

  describe('zoom limits', () => {
    it('leaves construction and fits unchanged when neither limit is set', async () => {
      const { el, engine } = await liveScriptedMap((map) => { map.zoom = 30; });
      expect('minZoom' in engine.options).to.equal(false); expect('maxZoom' in engine.options).to.equal(false);
      expect(engine.options['zoom']).to.equal(22);
      el.fitBounds([[0, 0], [1, 1]]);
      expect('maxZoom' in engine.fitCalls[0]!.options).to.equal(false);
      expect(engine.limitCalls).to.deep.equal([]);
    });

    it('forwards both limits at construction and clamps the initial zoom into them', async () => {
      const { el, engine } = await liveScriptedMap((map) => { map.minZoom = 5; map.maxZoom = 12; map.zoom = 2; });
      expect(engine.options['minZoom']).to.equal(5); expect(engine.options['maxZoom']).to.equal(12);
      expect(engine.options['zoom']).to.equal(5);
      el.setAttribute('max-zoom', '24'); await el.updateComplete;
      expect(el.maxZoom).to.equal(24); expect(engine.limitCalls).to.deep.equal(['min:5', 'max:24']);
    });

    it('clamps camera commands, assigned zoom and fit ceilings into the limits', async () => {
      const { el, engine } = await liveScriptedMap((map) => { map.minZoom = 3; map.maxZoom = 10; });
      el.jumpTo({ zoom: 18 }); expect(engine.commandCalls.at(-1)!.options['zoom']).to.equal(10);
      el.easeTo({ zoom: 0 }); expect(engine.commandCalls.at(-1)!.options['zoom']).to.equal(3);
      el.zoom = 20; await el.updateComplete; expect(engine.setZoomCalls.at(-1)).to.equal(10);
      el.fitBounds([[0, 0], [1, 1]], { maxZoom: 16 }); expect(engine.fitCalls.at(-1)!.options['maxZoom']).to.equal(10);
      el.fitBounds([[0, 0], [1, 1]]); expect(engine.fitCalls.at(-1)!.options['maxZoom']).to.equal(10);
      el.markers = [{ lngLat: [1, 1] }]; await el.updateComplete;
      expect(el.fitToData()).to.equal(true); expect(engine.fitCalls.at(-1)!.options['maxZoom']).to.equal(10);
    });

    it('applies live limits in a valid order, clamps the camera and writes the clamp back without a report', async () => {
      const { el, engine } = await liveScriptedMap((map) => { map.zoom = 4; });
      const reports = await collect(el, 'lr-map-view-change', async () => {
        el.minZoom = 8; el.maxZoom = 15; await el.updateComplete;
      });
      expect(reports).to.deep.equal([]);
      expect(engine.limitCalls).to.deep.equal(['min:8', 'max:15']);
      expect(engine.zoom).to.equal(8); expect(el.zoom).to.equal(8);
      engine.limitCalls.length = 0;
      el.minZoom = 18; el.maxZoom = 20; await el.updateComplete;
      expect(engine.limitCalls).to.deep.equal(['max:20', 'min:18']); expect(el.zoom).to.equal(18);
      engine.limitCalls.length = 0;
      el.minZoom = undefined; el.maxZoom = undefined; await el.updateComplete;
      expect(engine.limitCalls).to.deep.equal(['min:0', 'max:22']); expect(el.zoom).to.equal(18);
    });

    it('applies native bounds immediately and publishes their clamp after the update', async () => {
      const { el, engine } = await liveScriptedMap((map) => { map.zoom = 4; });
      let between: readonly [number, number] | undefined;
      const reports = await collect(el, 'lr-map-view-change', () => {
        el.minZoom = 8; el.maxZoom = 15;
        queueMicrotask(() => { between = [engine.zoom, el.zoom]; });
      });
      expect(between).to.deep.equal([8, 4]);
      expect(engine.limitCalls).to.deep.equal(['min:8', 'max:15']);
      expect(el.zoom).to.equal(8);
      expect(reports).to.deep.equal([]);
    });

    for (const [authoredZoom, shownZoom] of [[4, 8], [12, 12], [20, 15]] as const) {
      it(`preserves a newer authored zoom ${authoredZoom} over a queued limit clamp`, async () => {
        const { el, engine } = await liveScriptedMap((map) => { map.zoom = 4; });
        const reports = await collect(el, 'lr-map-view-change', () => {
          el.minZoom = 8; el.maxZoom = 15;
          // This runs after the limit update but before its queued reactive publication.
          queueMicrotask(() => { el.zoom = authoredZoom; });
        });
        expect(el.zoom).to.equal(authoredZoom);
        expect(engine.zoom).to.equal(shownZoom);
        expect(reports).to.deep.equal([]);
      });
    }

    it('does not publish a clamp from superseded limits before applying the latest limits', async () => {
      const { el, engine } = await liveScriptedMap((map) => { map.zoom = 4; });
      let between: number | undefined;
      const reports = await collect(el, 'lr-map-view-change', () => {
        el.minZoom = 8; el.maxZoom = 15;
        queueMicrotask(() => {
          el.minZoom = 12; el.maxZoom = 20;
          queueMicrotask(() => { between = el.zoom; });
        });
      });
      expect(between).to.equal(4);
      expect(engine.limitCalls).to.deep.equal(['min:8', 'max:15', 'min:12', 'max:20']);
      expect(el.zoom).to.equal(12);
      expect(engine.zoom).to.equal(12);
      expect(reports).to.deep.equal([]);
    });

    it('discards a queued clamp when its style is replaced', async () => {
      const { el, engine } = await liveScriptedMap((map) => { map.zoom = 4; });
      const reports = await collect(el, 'lr-map-view-change', () => {
        el.minZoom = 8; el.maxZoom = 15;
        queueMicrotask(() => { el.mapStyle = undefined; });
      });
      expect(engine.zoom).to.equal(8);
      expect(el.map === undefined).to.equal(true);
      expect(el.zoom).to.equal(4);
      expect(reports).to.deep.equal([]);
    });

    it('discards a detached clamp when the element reconnects with a fresh peer', async () => {
      const { el, engine } = await liveScriptedMap((map) => { map.zoom = 4; });
      const parent = el.parentNode!;
      const reports = await collect(el, 'lr-map-view-change', async () => {
        el.minZoom = 8; el.maxZoom = 15;
        queueMicrotask(() => { el.remove(); });
        await el.updateComplete;
        await new Promise((resolve) => setTimeout(resolve, 0));
        parent.appendChild(el);
        await waitUntil(() => ScriptedCameraMap.instances.length === 2 && el.map !== undefined, 'reconnected camera peer never initialized');
      });
      const replacement = ScriptedCameraMap.instances[1]!;
      expect(replacement === engine).to.equal(false);
      expect(replacement.options['zoom']).to.equal(8);
      expect(el.zoom).to.equal(4);
      expect(reports).to.deep.equal([]);
    });

    it('ignores an inverted explicit pair and non-finite limits', async () => {
      let mounted!: Awaited<ReturnType<typeof liveScriptedMap>>;
      const warnings = await captureDevWarnings(async () => {
        mounted = await liveScriptedMap((map) => { map.minZoom = 14; map.maxZoom = 6; map.zoom = 20; });
        mounted.el.minZoom = Number.NaN; mounted.el.maxZoom = 6;
      });
      const { el, engine } = mounted;
      expect(warnings.filter(message => message.includes('minZoom 14 exceeds maxZoom 6'))).to.have.length(1);
      expect(engine.options['minZoom']).to.equal(0); expect(engine.options['maxZoom']).to.equal(22);
      expect(engine.options['zoom']).to.equal(20);
      await el.updateComplete;
      expect(engine.limitCalls).to.deep.equal(['min:0', 'max:6']); expect(el.zoom).to.equal(6);
      el.minZoom = 23; el.maxZoom = undefined; await el.updateComplete;
      expect(engine.limitCalls.slice(-2)).to.deep.equal(['max:23', 'min:23']);
    });
  });
});
