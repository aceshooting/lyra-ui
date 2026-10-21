import { expect, fixture, fixtureCleanup, html, nextFrame, waitUntil } from '@open-wc/testing';
import './map.js';
import type { LyraMap, LyraMapStyleSpecification } from './map.js';
import { loadMapControl } from './map-loader.js';

const EMPTY_STYLE = { version: 8, sources: {}, layers: [] } satisfies LyraMapStyleSpecification;
type Listener = (event: Record<string, unknown>) => void;

interface ScriptedLayer {
  readonly id: string;
  readonly type: string;
  readonly source?: string;
  paint: Record<string, unknown>;
}

class ScriptedSource {
  expansionZoom = 9;
  /** `callback` serves a peer that predates promise-returning cluster lookups. */
  callbackStyle = false;
  readonly expansionRequests: number[] = [];
  constructor(readonly spec: Record<string, unknown>) {}
  setData(): void {}
  getClusterExpansionZoom(clusterId: number, callback?: (error: unknown, zoom?: number) => void): Promise<number> | void {
    this.expansionRequests.push(clusterId);
    if (this.callbackStyle) {
      callback?.(null, this.expansionZoom);
      return undefined;
    }
    return Promise.resolve(this.expansionZoom);
  }
}

class ScriptedControl {
  readonly element = document.createElement('div');
  removed = false;
  constructor(readonly kind: 'navigation' | 'scale', readonly options: Record<string, unknown> = {}) {
    this.element.className = 'maplibregl-ctrl';
    if (kind === 'navigation') {
      this.element.classList.add('maplibregl-ctrl-group');
      for (const name of ['zoom-in', 'zoom-out', 'compass']) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = `maplibregl-ctrl-${name}`;
        this.element.append(button);
      }
    } else {
      this.element.classList.add('maplibregl-ctrl-scale');
    }
  }
  onAdd(): HTMLElement {
    return this.element;
  }
  onRemove(): void {
    this.removed = true;
    this.element.remove();
  }
}

class ScriptedNavigationControl extends ScriptedControl {
  constructor(options?: Record<string, unknown>) {
    super('navigation', options);
  }
}

class ScriptedScaleControl extends ScriptedControl {
  constructor(options?: Record<string, unknown>) {
    super('scale', options);
  }
}

/** A scripted engine: sources and layers are recorded, the camera settles synchronously, and
 *  `project()` maps one degree to ten pixels around the centre of a 512 x 384 container. */
class ScriptedOverlayMap {
  static instances: ScriptedOverlayMap[] = [];
  readonly options: Record<string, unknown>;
  readonly sources = new Map<string, ScriptedSource>();
  readonly layers = new Map<string, ScriptedLayer>();
  readonly commandCalls: { method: string; options: Record<string, unknown> }[] = [];
  readonly controls: { control: ScriptedControl; position: unknown }[] = [];
  readonly maxBoundsCalls: unknown[] = [];
  /** What the next `queryRenderedFeatures()` returns. */
  hits: unknown[] = [];
  /** Throws from `setMaxBounds()` while this returns true. */
  rejectMaxBounds: (bounds: unknown) => boolean = () => false;
  constrainCenter?: { lng: number; lat: number };
  center: { lng: number; lat: number };
  zoom: number;
  private readonly listeners = new Map<string, Set<Listener>>();
  private readonly canvas = document.createElement('canvas');

  constructor(options: Record<string, unknown>) {
    this.options = options;
    const [lng, lat] = options['center'] as [number, number];
    this.center = { lng, lat };
    this.zoom = options['zoom'] as number;
    ScriptedOverlayMap.instances.push(this);
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

  getBounds() {
    const { lng, lat } = this.center;
    return {
      getWest: () => lng - 25,
      getSouth: () => lat - 19,
      getEast: () => lng + 25,
      getNorth: () => lat + 19,
    };
  }

  project(lngLat: [number, number]): { x: number; y: number } {
    return {
      x: 256 + (lngLat[0] - this.center.lng) * 10,
      y: 192 - (lngLat[1] - this.center.lat) * 10,
    };
  }

  unproject(point: [number, number]): { lng: number; lat: number } {
    return { lng: this.center.lng + (point[0] - 256) / 10, lat: this.center.lat - (point[1] - 192) / 10 };
  }

  setCenter(center: [number, number]): this {
    this.center = { lng: center[0], lat: center[1] };
    return this;
  }

  setZoom(zoom: number): this {
    this.zoom = zoom;
    return this;
  }

  setPadding(): this {
    return this;
  }

  isMoving(): boolean {
    return false;
  }

  private settle(method: string, options: Record<string, unknown>, eventData?: Record<string, unknown>): this {
    this.commandCalls.push({ method, options });
    const center = options['center'] as [number, number] | undefined;
    if (center) this.center = { lng: center[0], lat: center[1] };
    if (typeof options['zoom'] === 'number') this.zoom = options['zoom'];
    this.fire('move', eventData);
    this.fire('moveend', eventData);
    return this;
  }

  flyTo(options: Record<string, unknown>, eventData?: Record<string, unknown>): this {
    return this.settle('flyTo', options, eventData);
  }

  easeTo(options: Record<string, unknown>, eventData?: Record<string, unknown>): this {
    return this.settle('easeTo', options, eventData);
  }

  jumpTo(options: Record<string, unknown>, eventData?: Record<string, unknown>): this {
    return this.settle('jumpTo', options, eventData);
  }

  fitBounds(bounds: [[number, number], [number, number]], options: Record<string, unknown>, eventData?: Record<string, unknown>): this {
    return this.settle('fitBounds', {
      center: [(bounds[0][0] + bounds[1][0]) / 2, (bounds[0][1] + bounds[1][1]) / 2],
      zoom: options['maxZoom'] ?? 6,
    }, eventData);
  }

  setMaxBounds(bounds: unknown): this {
    this.maxBoundsCalls.push(bounds);
    if (bounds !== null && this.rejectMaxBounds(bounds)) throw new TypeError('constrain failed');
    if (bounds !== null && this.constrainCenter) this.center = { ...this.constrainCenter };
    return this;
  }

  setStyle(): this {
    this.sources.clear();
    this.layers.clear();
    return this;
  }

  getSource(id: string): ScriptedSource | undefined {
    return this.sources.get(id);
  }

  addSource(id: string, spec: Record<string, unknown>): this {
    this.sources.set(id, new ScriptedSource(spec));
    return this;
  }

  removeSource(id: string): this {
    this.sources.delete(id);
    return this;
  }

  getLayer(id: string): ScriptedLayer | undefined {
    return this.layers.get(id);
  }

  addLayer(layer: { id: string; type: string; source?: string; paint?: Record<string, unknown> }): this {
    this.layers.set(layer.id, { id: layer.id, type: layer.type, source: layer.source, paint: { ...layer.paint } });
    return this;
  }

  removeLayer(id: string): this {
    this.layers.delete(id);
    return this;
  }

  setPaintProperty(id: string, name: string, value: unknown): this {
    const layer = this.layers.get(id);
    if (!layer) return this;
    if (value === null || value === undefined) delete layer.paint[name];
    else layer.paint[name] = value;
    return this;
  }

  queryRenderedFeatures(): unknown[] {
    return this.hits;
  }

  addControl(control: ScriptedControl, position: unknown): this {
    this.controls.push({ control, position });
    (this.options['container'] as HTMLElement).append(control.onAdd());
    return this;
  }

  removeControl(control: ScriptedControl): this {
    control.onRemove();
    const index = this.controls.findIndex((entry) => entry.control === control);
    if (index >= 0) this.controls.splice(index, 1);
    return this;
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

const originalGetContext = HTMLCanvasElement.prototype.getContext;

interface Harness {
  readonly el: LyraMap;
  readonly engine: ScriptedOverlayMap;
}

async function liveScriptedMap(configure?: (el: LyraMap) => void, children?: Element[]): Promise<Harness> {
  let resolveLibrary!: (module: unknown) => void;
  const library = new Promise((resolve) => {
    resolveLibrary = resolve;
  });
  const wrapper = (await fixture(html`<div style="inline-size: 32rem; block-size: 24rem"></div>`)) as HTMLElement;
  const el = document.createElement('lr-map') as LyraMap;
  el.engine = 'maplibre';
  (el as unknown as { loadLibrary: () => Promise<unknown> }).loadLibrary = () => library;
  el.mapStyle = EMPTY_STYLE;
  configure?.(el);
  if (children) el.append(...children);
  wrapper.append(el);
  await el.updateComplete;
  resolveLibrary({
    Map: ScriptedOverlayMap,
    Marker: ScriptedMarker,
    Popup: ScriptedPopup,
    NavigationControl: ScriptedNavigationControl,
    ScaleControl: ScriptedScaleControl,
  });
  await waitUntil(() => el.map != null, 'scripted map never initialized', { timeout: 2000 });
  await el.updateComplete;
  await new Promise((resolve) => setTimeout(resolve, 0));
  return { el, engine: el.map as unknown as ScriptedOverlayMap };
}

/** Applies the generated layers, which the engine does once its style has loaded. */
async function loadStyle({ el, engine }: Harness): Promise<void> {
  engine.fire('load');
  await el.updateComplete;
}

function layerWithSuffix(engine: ScriptedOverlayMap, suffix: string): ScriptedLayer {
  const layer = [...engine.layers.values()].find((candidate) => candidate.id.endsWith(suffix));
  if (!layer) throw new Error(`no layer ends with ${suffix}`);
  return layer;
}

const COLLECTION = {
  type: 'FeatureCollection' as const,
  features: [
    { type: 'Feature' as const, properties: { pop: 10 }, geometry: { type: 'Point' as const, coordinates: [1, 1] } },
  ],
};

function choropleth(extra: Record<string, unknown> = {}) {
  return {
    sourceId: 'regions',
    geojson: COLLECTION,
    field: 'pop',
    stops: [[0, '#ffffff'], [100, '#ff0000']] as [number, string][],
    ...extra,
  };
}

function click(engine: ScriptedOverlayMap): void {
  engine.fire('click', { point: { x: 1, y: 1 }, lngLat: { lng: 1, lat: 2 } });
}

describe('map overlay failure recovery', () => {
  const intersectionObserver = Object.getOwnPropertyDescriptor(window, 'IntersectionObserver');
  const canvasGetContext = Object.getOwnPropertyDescriptor(HTMLCanvasElement.prototype, 'getContext');

  beforeEach(() => {
    ScriptedOverlayMap.instances = [];
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
    if (intersectionObserver) Object.defineProperty(window, 'IntersectionObserver', intersectionObserver);
    else delete (window as { IntersectionObserver?: typeof IntersectionObserver }).IntersectionObserver;
    if (canvasGetContext) Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', canvasGetContext);
  });

  it('skips an unreadable gradient mark without losing the readable marks', async () => {
    const { el } = await liveScriptedMap((map) => {
      map.legendGradient = [[0, '#ffffff'], [100, '#ff0000']];
    });
    const ticks = new Proxy([25, 75], {
      getOwnPropertyDescriptor(_target, key) {
        if (key === '1') throw new TypeError('revoked tick');
        return Reflect.getOwnPropertyDescriptor(_target, key);
      },
    });
    el.legendGradientTicks = ticks;
    await el.updateComplete;
    expect(el.legendGradientTicks.map((tick) => tick.value)).to.deep.equal([25]);
    expect(el.shadowRoot!.querySelectorAll('[part="legend-tick"]')).to.have.length(1);
    el.legendGradientTicks = [50];
    await el.updateComplete;
    expect(el.shadowRoot!.querySelectorAll('[part="legend-tick"]')).to.have.length(1);
  });

  it('ignores a revoked no-data style while retaining the admitted choropleth', async () => {
    const noData = new Proxy({ color: '#cccccc', label: 'Missing' }, {
      getOwnPropertyDescriptor(target, key) {
        if (key === 'label') throw new TypeError('revoked no-data style');
        return Reflect.getOwnPropertyDescriptor(target, key);
      },
    });
    const harness = await liveScriptedMap((el) => {
      el.choropleth = choropleth({ noData });
      el.choroplethLegend = true;
    });
    await loadStyle(harness);
    const fill = layerWithSuffix(harness.engine, '-fill');
    const paint = fill.paint['fill-color'] as unknown[];
    expect(paint[0]).to.equal('case');
    expect(paint[2]).to.deep.equal(['interpolate', ['linear'], ['get', 'pop'], 0, '#ffffff', 100, '#ff0000']);
    expect(Boolean(harness.el.shadowRoot!.querySelector('[part="legend-derived"]'))).to.equal(true);
    expect(harness.el.shadowRoot!.textContent).not.to.contain('Missing');
  });

  it('ignores an unreadable control while keeping the valid one active', async () => {
    const { el, engine } = await liveScriptedMap((map) => { map.controls = { navigation: true }; });
    await waitUntil(() => engine.controls.length === 1, 'navigation control never attached');
    const first = engine.controls[0]!.control;
    el.controls = new Proxy({ navigation: true, scale: true }, {
      getOwnPropertyDescriptor(target, key) {
        if (key === 'scale') throw new TypeError('revoked controls');
        return Reflect.getOwnPropertyDescriptor(target, key);
      },
    });
    await el.updateComplete;
    expect(first.removed).to.equal(false);
    expect(engine.controls).to.have.length(1);
    el.controls = { scale: true };
    await waitUntil(() => first.removed && engine.controls.length === 1, 'scale control never attached after recovery');
    expect(engine.controls[0]!.control.kind).to.equal('scale');
  });

  it('keeps the map usable after the peer refuses control removal and addition', async () => {
    const { el, engine } = await liveScriptedMap((map) => { map.controls = { navigation: true }; });
    await waitUntil(() => engine.controls.length === 1, 'navigation control never attached');
    const staleControl = engine.controls[0]!.control;
    const originalRemove = engine.removeControl.bind(engine);
    const originalAdd = engine.addControl.bind(engine);
    let removeAttempts = 0;
    let addAttempts = 0;
    engine.removeControl = () => { removeAttempts++; throw new TypeError('peer removed its controls'); };
    engine.addControl = () => { addAttempts++; throw new TypeError('peer refused scale control'); };
    try {
      el.controls = { scale: true };
      await el.updateComplete;
      await waitUntil(() => addAttempts === 1, 'peer control addition was never attempted');
      expect(removeAttempts).to.equal(1);
      expect(engine.controls).to.have.length(1);
      expect(el.jumpTo({ center: [8, 9], zoom: 4 })).to.equal(true);
      await waitUntil(() => engine.commandCalls.length > 0, 'camera command did not reach the peer');
      expect(engine.commandCalls.at(-1)).to.deep.equal({ method: 'jumpTo', options: { center: [8, 9], zoom: 4 } });
    } finally {
      engine.removeControl = originalRemove;
      engine.addControl = originalAdd;
    }
    engine.removeControl(staleControl);
    el.controls = { navigation: true };
    await waitUntil(() => engine.controls.length === 1, 'later navigation control never attached');
    expect(engine.controls[0]!.control.kind).to.equal('navigation');
  });

  it('drops a rejected world constraint when the peer also refuses the zoom-one retry', async () => {
    const { el, engine } = await liveScriptedMap((map) => {
      map.zoom = 0.4;
      map.center = [3, 4];
    });
    const originalSetZoom = engine.setZoom.bind(engine);
    engine.rejectMaxBounds = () => engine.zoom < 1;
    engine.setZoom = (zoom) => {
      if (zoom === 1) throw new TypeError('peer refused recovery zoom');
      return originalSetZoom(zoom);
    };
    const warningKey = 'lyra-map-max-bounds-rejected';
    const warningStore = (globalThis as { litIssuedWarnings?: Set<string> }).litIssuedWarnings;
    const wasWarned = warningStore?.has(warningKey);
    warningStore?.delete(warningKey);
    const expectedWarning = '<lr-map>: maxBounds left maplibre-gl without a usable camera, so it was dropped and the '
      + 'camera restored. This is a peer limitation, not a bad value -- it shows up at sub-1 '
      + 'fractional zooms in wide containers. Raise the zoom, narrow the box, or leave maxBounds '
      + 'unset.';
    const originalWarn = console.warn;
    const warnings: string[] = [];
    console.warn = (...args: unknown[]) => {
      if (args.length === 1 && args[0] === expectedWarning) {
        warnings.push(expectedWarning);
      } else originalWarn.apply(console, args);
    };
    try {
      el.maxBounds = [[-60, -40], [60, 40]];
      await el.updateComplete;
    } finally {
      console.warn = originalWarn;
      engine.setZoom = originalSetZoom;
      if (wasWarned) warningStore?.add(warningKey);
      else warningStore?.delete(warningKey);
    }
    expect(warnings).to.have.length(1);
    expect(engine.maxBoundsCalls.at(-1)).to.equal(null);
    expect(engine.zoom).to.equal(0.4);
    expect(engine.center).to.deep.equal({ lng: 3, lat: 4 });
  });

  it('ignores a cluster that disappears while its expansion zoom is requested', async () => {
    const harness = await liveScriptedMap((el) => {
      el.dataLayers = [{ sourceId: 'pins', geojson: COLLECTION, cluster: { zoomOnClick: true } }];
    });
    await loadStyle(harness);
    const source = [...harness.engine.sources.values()][0]!;
    const requestedIds: number[] = [];
    source.getClusterExpansionZoom = (clusterId) => {
      requestedIds.push(clusterId);
      throw new TypeError('cluster disappeared');
    };
    harness.engine.hits = [{
      layer: { id: layerWithSuffix(harness.engine, '-cluster').id },
      properties: { cluster_id: 7, point_count: 3 },
      geometry: { type: 'Point', coordinates: [3, 4] },
    }];
    click(harness.engine);
    await harness.el.updateComplete;
    expect(requestedIds).to.deep.equal([7]);
    expect(harness.engine.commandCalls).to.have.length(0);
    expect(harness.el.map === (harness.engine as unknown)).to.equal(true);
  });

  it('hides an offscreen anchor immediately when animation frames are unavailable', async () => {
    const card = document.createElement('div');
    card.slot = 'anchor';
    card.textContent = 'Map details';
    const { el, engine } = await liveScriptedMap((map) => {
      map.anchorLngLat = [5, 5];
    }, [card]);
    const anchor = el.shadowRoot!.querySelector<HTMLElement>('[part="anchor"]')!;
    await waitUntil(() => !anchor.hidden, 'anchor never became visible');
    await nextFrame();
    const originalFrame = Object.getOwnPropertyDescriptor(window, 'requestAnimationFrame');
    Object.defineProperty(window, 'requestAnimationFrame', { configurable: true, value: undefined });
    try {
      engine.center = { lng: 100, lat: 0 };
      engine.fire('move');
      expect(anchor.hidden).to.equal(true);
    } finally {
      if (originalFrame) Object.defineProperty(window, 'requestAnimationFrame', originalFrame);
      else delete (window as { requestAnimationFrame?: typeof requestAnimationFrame }).requestAnimationFrame;
    }
  });

  it('loads the modular controls on demand from their separate entry points', async () => {
    const navigation = await loadMapControl('navigation', 'modular', undefined);
    const scale = await loadMapControl('scale', 'modular', undefined);
    expect(navigation).to.be.a('function');
    expect(scale).to.be.a('function');
  });
});
