import { fixture, html, waitUntil } from '@open-wc/testing';
import type { LyraMap, LyraMapStyleSpecification } from '../src/components/media/map/map.js';

// A scripted MapLibre-compatible engine installed at lr-map's library seam, so overlay and data
// contracts run in every browser without the WebGL2 context a real engine needs.
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
export class ScriptedOverlayMap {
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

export const originalGetContext = HTMLCanvasElement.prototype.getContext;

interface Harness {
  readonly el: LyraMap;
  readonly engine: ScriptedOverlayMap;
}

export async function liveScriptedMap(configure?: (el: LyraMap) => void, children?: Element[]): Promise<Harness> {
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
export async function loadStyle({ el, engine }: Harness): Promise<void> {
  engine.fire('load');
  await el.updateComplete;
}

export function layerWithSuffix(engine: ScriptedOverlayMap, suffix: string): ScriptedLayer {
  const layer = [...engine.layers.values()].find((candidate) => candidate.id.endsWith(suffix));
  if (!layer) throw new Error(`no layer ends with ${suffix}`);
  return layer;
}

export const COLLECTION = {
  type: 'FeatureCollection' as const,
  features: [
    { type: 'Feature' as const, properties: { pop: 10 }, geometry: { type: 'Point' as const, coordinates: [1, 1] } },
  ],
};

export function choropleth(extra: Record<string, unknown> = {}) {
  return {
    sourceId: 'regions',
    geojson: COLLECTION,
    field: 'pop',
    stops: [[0, '#ffffff'], [100, '#ff0000']] as [number, string][],
    ...extra,
  };
}

export function click(engine: ScriptedOverlayMap): void {
  engine.fire('click', { point: { x: 1, y: 1 }, lngLat: { lng: 1, lat: 2 } });
}
