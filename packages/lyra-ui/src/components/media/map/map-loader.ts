import type { Feature, Geometry } from 'geojson';
import {
  resolveOptionalPeerCapability,
  unwrapOptionalPeerDefault,
} from '../../../internal/optional-peer-capabilities.js';

export interface MapLibreGeoJsonSource {
  setData(data: unknown): void;
  /** maplibre-gl 3+ incremental update. Optional because older peers lack it. */
  updateData?(diff: MapLibreSourceDataDiff): void;
  /** Retains the automatic property-diff signature for extracted method parameter types. */
  updateData?(diff: MapLibreGeoJsonDiff): void;
  /** Optional: zoom at which a cluster breaks apart. Promise-returning in current peers; older
   *  peers take a node-style callback instead. */
  getClusterExpansionZoom?(
    clusterId: number,
    callback?: (error: unknown, zoom?: number) => void,
  ): Promise<number> | void;
}

/** Consumer-authored incremental GeoJSON changes, forwarded to the active map engine. */
export interface MapLibreSourceDataDiff {
  readonly removeAll?: boolean;
  readonly remove?: readonly (string | number)[];
  readonly add?: readonly Feature[];
  readonly update?: readonly {
    readonly id: string | number;
    readonly newGeometry?: Geometry;
    readonly removeAllProperties?: boolean;
    readonly removeProperties?: readonly string[];
    readonly addOrUpdateProperties?: readonly { readonly key: string; readonly value: unknown }[];
  }[];
}

/** The subset of maplibre-gl's GeoJSON diff this component emits. */
export interface MapLibreGeoJsonDiff {
  readonly remove?: readonly (string | number)[];
  readonly add?: readonly Feature[];
  readonly update: readonly {
    readonly id: string | number;
    readonly addOrUpdateProperties: readonly { readonly key: string; readonly value: unknown }[];
    readonly removeProperties: readonly string[];
  }[];
}

export interface MapLibrePopupCapability {
  setHTML(html: string): this;
  setText(text: string): this;
  on?(type: 'open' | 'close', listener: () => void): this;
  isOpen?(): boolean;
  getElement?(): HTMLElement | undefined;
  options?: { focusAfterOpen?: boolean };
}

export interface MapLibreMarkerCapability {
  setLngLat(lngLat: [number, number]): this;
  setPopup(popup?: MapLibrePopupCapability): this;
  getPopup(): MapLibrePopupCapability | undefined;
  addTo(map: MapLibreMapCapability): this;
  remove(): void;
  getElement?(): HTMLElement;
}

/** Actual source, layer, projection and terrain descriptors to prepare before synchronous mutations. */
export interface LyraMapFeatureRequirements {
  readonly sources?: Readonly<Record<string, unknown>>;
  readonly layers?: readonly unknown[];
  readonly projection?: unknown;
  readonly terrain?: unknown;
}

export interface MapLibreMapCapability {
  /** Present on the modular engine; canonical MapLibre does not expose this method. */
  prepareFeatures?(requirements: LyraMapFeatureRequirements, options?: { signal?: AbortSignal }): Promise<void>;
  /** Required, unlike setMaxBounds below: the loader validates getCanvas is callable and rejects a
   *  peer without it, so holding this type already implies the method is present. Call sites still
   *  guard with `?.()` against a peer that satisfies the shape check and then lies at runtime. */
  getCanvas(): HTMLCanvasElement;
  getCenter(): { lng: number; lat: number };
  getZoom(): number;
  getBearing?(): number;
  getPitch?(): number;
  setCenter(center: [number, number]): unknown;
  setZoom(zoom: number): unknown;
  resize(): unknown;
  /** Optional zoom limits; `minZoom`/`maxZoom` feature-detect them before a live update. */
  setMinZoom?(zoom: number): unknown;
  setMaxZoom?(zoom: number): unknown;
  getMaxZoom?(): number;
  /** Optional: absent on peers predating it, and the caller feature-detects before use. */
  setMaxBounds?(bounds: readonly [readonly [number, number], readonly [number, number]] | null): unknown;
  /** Optional for the same reason; `LyraMap.fitBounds()` feature-detects it. The peer merges
   *  `eventData` into every movement event the fit fires, which is how its `moveend` is told
   *  apart from any other camera move. */
  fitBounds?(
    bounds: [[number, number], [number, number]],
    options: Record<string, unknown>,
    eventData: Record<string, unknown>,
  ): unknown;
  /** Optional and feature-detected: whether an animation or a gesture is moving the camera now. */
  isMoving?(): boolean;
  /** Optional readiness probes. Older compatible peers use ready/idle events instead. */
  isStyleLoaded?(): boolean;
  loaded?(): boolean;
  /** Optional cleanup; listeners on older peers become inert until remove() releases them. */
  off?(type: string, listener: () => void): this;
  /** Optional and feature-detected camera commands. The peer merges `eventData` into every
   *  movement event the command fires, which is how its `moveend` is attributed. */
  flyTo?(options: Record<string, unknown>, eventData?: Record<string, unknown>): unknown;
  easeTo?(options: Record<string, unknown>, eventData?: Record<string, unknown>): unknown;
  jumpTo?(options: Record<string, unknown>, eventData?: Record<string, unknown>): unknown;
  /** Optional: persistent screen padding the camera centre is measured inside. */
  setPadding?(padding: { top: number; right: number; bottom: number; left: number }): unknown;
  /** Optional: container-relative pixel position of a geographic point, and its inverse. */
  project?(lngLat: [number, number]): { x: number; y: number };
  unproject?(point: [number, number]): { lng: number; lat: number };
  /** Optional: standard peer controls. A control is the peer's own object (`onAdd`/`onRemove`). */
  addControl?(control: unknown, position?: string): unknown;
  removeControl?(control: unknown): unknown;
  /** Optional: the geographic box of the whole canvas. */
  getBounds?(): { getWest(): number; getSouth(): number; getEast(): number; getNorth(): number };
  remove(): void;
  on(type: 'error', listener: (event: { error?: unknown }) => void): this;
  on(type: 'render' | 'load' | 'style.load' | 'idle' | 'dataloading' | 'sourcedata' | 'movestart' | 'move' | 'error', listener: () => void): this;
  on(type: 'moveend', listener: (event: Readonly<Record<string, unknown>> | undefined) => void): this;
  on(type: 'move', listener: () => void): this;
  on(type: 'boxzoomend', listener: () => void): this;
  on(type: 'movestart' | 'boxzoomstart', listener: (event: Readonly<Record<string, unknown>> | undefined) => void): this;
  on(type: 'click', listener: (event: {
    point: unknown;
    lngLat: { lng: number; lat: number };
  }) => void): this;
  once(type: 'style.load', listener: () => void): this;
  setStyle(style: unknown): this;
  /** Optional native style capabilities, required only for declarative owned overlays/overrides. */
  getStyle?(): { readonly layers?: readonly { readonly id: string }[] };
  moveLayer?(id: string, before?: string): unknown;
  getPaintProperty?(id: string, property: string): unknown;
  getLayoutProperty?(id: string, property: string): unknown;
  setLayoutProperty?(id: string, property: string, value: unknown): unknown;
  setFilter?(id: string, filter: unknown): unknown;
  setLayerZoomRange?(id: string, min: number, max: number): unknown;
  setFeatureState?(target: import('./map-feature-state.js').LyraMapFeatureIdentifier, state: import('./map-feature-state.js').LyraMapFeatureState): unknown;
  removeFeatureState?(target: import('./map-feature-state.js').LyraMapFeatureIdentifier, key: string): unknown;
  triggerRepaint?(): unknown;
  getSource(id: string): MapLibreGeoJsonSource | undefined;
  addSource(id: string, source: unknown): this;
  removeSource(id: string): this;
  getLayer(id: string): unknown;
  addLayer(layer: unknown, before?: string): this;
  removeLayer(id: string): this;
  setPaintProperty(layerId: string, name: string, value: unknown): this;
  /** Optional image-atlas capabilities; point circles remain usable when a partial peer lacks these. */
  hasImage?(id: string): boolean;
  addImage?(id: string, image: ImageData, options: { pixelRatio: number; sdf?: boolean }): unknown;
  /** Optional lazy image hook: the engine awaits it before treating a style image as missing. */
  setMissingStyleImageResolver?(resolver: ((id: string) => void | Promise<void>) | null): unknown;
  updateImage?(id: string, image: ImageData): unknown;
  removeImage?(id: string): unknown;
  queryRenderedFeatures(point: unknown, options?: { layers?: string[] }): unknown[];
}

/** A standard peer control constructor (`NavigationControl`, `ScaleControl`). */
export type MapLibreControlConstructor = new (options?: Record<string, unknown>) => unknown;

/** The MapLibre constructors Lyra consumes, structurally owned so the optional peer never leaks. */
export interface MaplibreModule {
  Map: new (options: Record<string, unknown>) => MapLibreMapCapability;
  Marker: new (options?: { color?: string }) => MapLibreMarkerCapability;
  Popup: new (options?: { offset?: number }) => MapLibrePopupCapability;
  /** Present on the full engine; the modular engine ships each control as its own subpath. */
  NavigationControl?: MapLibreControlConstructor;
  ScaleControl?: MapLibreControlConstructor;
  GeolocateControl?: MapLibreControlConstructor;
  AttributionControl?: MapLibreControlConstructor;
}

const MAP_METHODS = [
  // `LyraMapInstance.getCanvas()` (map.class.ts) is required, not optional -- a peer missing it
  // must fail validation here rather than passing and only throwing later at a consumer's own
  // `el.map.getCanvas()` call site.
  'getCanvas',
  'getCenter',
  'getZoom',
  'setCenter',
  'setZoom',
  'resize',
  'remove',
  'on',
  'once',
  'setStyle',
  'getSource',
  'addSource',
  'removeSource',
  'getLayer',
  'addLayer',
  'removeLayer',
  'setPaintProperty',
  'queryRenderedFeatures',
] as const;
const MARKER_METHODS = ['setLngLat', 'setPopup', 'getPopup', 'addTo', 'remove'] as const;
const POPUP_METHODS = ['setHTML', 'setText'] as const;

function isObjectLike(value: unknown): value is Record<PropertyKey, unknown> {
  return (typeof value === 'object' || typeof value === 'function') && value !== null;
}

function isConstructor(value: unknown): value is new (...args: never[]) => object {
  if (typeof value !== 'function') return false;
  try {
    Reflect.construct(Object, [], value);
    return true;
  } catch {
    return false;
  }
}

function missingConstructorCapability(
  module: Record<PropertyKey, unknown>,
  name: 'Map' | 'Marker' | 'Popup',
  methods: readonly string[],
): string | undefined {
  const Constructor = module[name];
  if (!isConstructor(Constructor)) return name;
  const prototype = (Constructor as unknown as { prototype?: unknown }).prototype;
  if (!isObjectLike(prototype)) return `${name}.prototype`;
  for (const method of methods) {
    if (typeof prototype[method] !== 'function') return `${name}.prototype.${method}`;
  }
  return undefined;
}

function missingMaplibreCapability(candidate: unknown): string | undefined {
  if (!isObjectLike(candidate)) return 'module namespace';
  return (
    missingConstructorCapability(candidate, 'Map', MAP_METHODS) ??
    missingConstructorCapability(candidate, 'Marker', MARKER_METHODS) ??
    missingConstructorCapability(candidate, 'Popup', POPUP_METHODS)
  );
}

function isMaplibreModule(candidate: unknown): candidate is MaplibreModule {
  return missingMaplibreCapability(candidate) === undefined;
}

function resolveMaplibreModule(value: unknown): MaplibreModule {
  const module = resolveOptionalPeerCapability(value, isMaplibreModule);
  if (module) return module;
  const candidate = unwrapOptionalPeerDefault(value);
  const missing = missingMaplibreCapability(candidate) ?? 'module namespace';
  throw new Error(
    `Invalid optional peer \`maplibre-gl\`: missing or invalid \`${missing}\` capability.`,
  );
}

let maplibre: Promise<MaplibreModule | null> | undefined;
let maplibreCapabilities: unknown;

/** Loads and validates the MapLibre capabilities consumed by `<lr-map>`. @internal */
export async function loadMaplibreModule(
  importer: () => Promise<unknown> = () => import('maplibre-gl').then(source =>
    maplibreCapabilities ??= Object.freeze({
      get Map() { return source.Map; },
      get Marker() { return source.Marker; },
      get Popup() { return source.Popup; },
      get NavigationControl() { return source.NavigationControl; },
      get ScaleControl() { return source.ScaleControl; },
      get setWorkerUrl() { return source.setWorkerUrl; },
      get getVersion() { return source.getVersion; },
      get default() { return (source as unknown as { readonly default?: unknown }).default; },
    }),
  ),
): Promise<MaplibreModule | null> {
  try {
    return resolveMaplibreModule(await importer());
  } catch (error) {
    console.warn(
      '<lr-map> needs the optional peer dependency `maplibre-gl` — install it with ' +
        '`pnpm add maplibre-gl`.',
      error,
    );
    return null;
  }
}

/**
 * Lazily loads the optional peer dependency `maplibre-gl` once per page.
 * Resolves to `null` (with a one-time warning) if it isn't installed —
 * mirrors `<lr-flag>`'s peer-dependency pattern. `<lr-map>` supplies the styles for MapLibre's
 * generated DOM inside its shadow root. MapLibre v6 consumers also configure its module-worker URL
 * for their bundler once they install the peer; v5's standard build includes its worker.
 */
export function loadMaplibre(): Promise<MaplibreModule | null> {
  if (!maplibre) {
    maplibre = loadMaplibreModule();
  }
  return maplibre;
}

/** The companion additionally provides per-map main-thread and worker readiness. */
export interface ModularMapModule extends MaplibreModule {
  Map: new (options: Record<string, unknown>) => MapLibreMapCapability & {
    prepareFeatures(requirements: LyraMapFeatureRequirements, options?: { signal?: AbortSignal }): Promise<void>;
  };
}

function isModularMapModule(candidate: unknown): candidate is ModularMapModule {
  return isMaplibreModule(candidate) &&
    typeof candidate.Map.prototype.prepareFeatures === 'function';
}

let modularMapCapabilities: unknown;

/** Loads and validates the optional modular engine without substituting a canonical engine. @internal */
export async function loadModularMapModule(
  importer: () => Promise<unknown> = () => import('@aceshooting/lyra-map').then(source =>
    modularMapCapabilities ??= Object.freeze({
      get Map() { return source.Map; },
      get Marker() { return source.Marker; },
      get Popup() { return source.Popup; },
    }),
  ),
): Promise<ModularMapModule | null> {
  try {
    const value = await importer();
    const module = resolveOptionalPeerCapability(value, isModularMapModule);
    if (module) return module;
    const candidate = unwrapOptionalPeerDefault(value);
    const missing = missingMaplibreCapability(candidate) ?? 'Map.prototype.prepareFeatures';
    throw new Error(`Invalid optional peer \`@aceshooting/lyra-map\`: missing or invalid \`${missing}\` capability.`);
  } catch (error) {
    console.warn('<lr-map> needs the optional peer dependency `@aceshooting/lyra-map` — install it with `pnpm add @aceshooting/lyra-map`.', error);
    return null;
  }
}

let modularMap: Promise<ModularMapModule | null> | undefined;

/** Lazily loads the modular companion once per page. A failed load never selects another engine. */
export function loadModularMap(): Promise<ModularMapModule | null> {
  return modularMap ??= loadModularMapModule();
}

/** The standard peer controls `<lr-map controls>` can add, by kind. */
export type MapControlKind = 'navigation' | 'scale' | 'geolocate' | 'attribution';

/**
 * Loads one standard control constructor for the selected engine. The full engine carries every
 * control on its main module; the modular engine ships each as a subpath import, so a map that
 * declares no control never fetches one. Resolves to `null` when the peer cannot provide it.
 * @internal
 */
export async function loadMapControl(
  kind: MapControlKind,
  engine: 'modular' | 'maplibre',
  module: MaplibreModule | undefined,
): Promise<MapLibreControlConstructor | null> {
  const name = ({ navigation: 'NavigationControl', scale: 'ScaleControl', geolocate: 'GeolocateControl', attribution: 'AttributionControl' } as const)[kind];
  const provided = module?.[name];
  if (isConstructor(provided)) return provided as MapLibreControlConstructor;
  if (engine !== 'modular') return null;
  try {
    const source: unknown = kind === 'navigation'
      ? await import('@aceshooting/lyra-map/controls/navigation')
      : kind === 'scale' ? await import('@aceshooting/lyra-map/controls/scale')
      : kind === 'geolocate' ? await import('@aceshooting/lyra-map/controls/geolocate')
      : await import('@aceshooting/lyra-map/controls/attribution');
    const candidate = unwrapOptionalPeerDefault(source);
    const control = isObjectLike(candidate) ? candidate[name] : undefined;
    return isConstructor(control) ? control as MapLibreControlConstructor : null;
  } catch (error) {
    console.warn(`<lr-map> could not load the ${kind} control from \`@aceshooting/lyra-map\`.`, error);
    return null;
  }
}
