import type { Feature, Geometry } from 'geojson';
import { litDevWarnings } from '../../../internal/dev-warning.js';
import { isObjectLike } from '../../../internal/object-guards.js';
import {
  createOptionalPeerLoader,
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
  /** Optional native allocation capabilities, feature-detected by opted-in scene rendering. */
  getContainer?(): HTMLElement;
  getPixelRatio?(): number;
  getPadding?(): { top: number; right: number; bottom: number; left: number };
  getCenter(): { lng: number; lat: number };
  getZoom(): number;
  getBearing?(): number;
  getPitch?(): number;
  /** Optional cancellation, required only for session-owned animated camera commands. */
  stop?(): unknown;
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
  on(type: 'movestart' | 'boxzoomstart' | 'dragstart' | 'zoomstart' | 'rotatestart' | 'pitchstart', listener: (event: Readonly<Record<string, unknown>> | undefined) => void): this;
  on(type: 'click', listener: (event: {
    point: unknown;
    lngLat: { lng: number; lat: number };
  }) => void): this;
  once(type: 'style.load', listener: () => void): this;
  setStyle(style: unknown, options?: { diff?: boolean }): this;
  /** Optional native style capabilities, required only for declarative owned overlays/overrides. */
  getStyle?(): { readonly layers?: readonly { readonly id: string }[] };
  /** Optional scene capabilities, required only for declarative projection/terrain overrides. */
  getProjection?(): unknown;
  getTerrain?(): unknown;
  setProjection?(value: unknown): unknown;
  setTerrain?(value: unknown): unknown;
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
  module: object,
  name: 'Map' | 'Marker' | 'Popup',
  methods: readonly string[],
): string | undefined {
  const Constructor = (module as Record<string, unknown>)[name];
  if (!isConstructor(Constructor)) return name;
  const prototype = (Constructor as unknown as { prototype?: unknown }).prototype;
  if (!isObjectLike(prototype)) return `${name}.prototype`;
  for (const method of methods) {
    if (typeof (prototype as Record<string, unknown>)[method] !== 'function') return `${name}.prototype.${method}`;
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

/** The shared loader owns retry policy. A fulfilled inspection can also describe an incompatible peer. */
export function createMapEngineLoader<T>(
  peer: string,
  importer: () => Promise<unknown>,
  validate: (candidate: unknown) => candidate is T,
  missing: (candidate: unknown) => string | undefined,
) {
  type Inspection = { module: T | null };
  const inspect = async (load: () => Promise<unknown>): Promise<Inspection> => {
    const value = await load();
    let capability = 'module namespace';
    try {
      const module = resolveOptionalPeerCapability(value, validate);
      if (module) return { module };
      capability = missing(unwrapOptionalPeerDefault(value)) ?? capability;
    } catch { /* The namespace may have unusable accessors. */ }
    const warnings = litDevWarnings();
    const key = `lyra-map:${peer}:${capability}`;
    if (warnings && !warnings.has(key)) {
      warnings.add(key);
      console.warn(`<lr-map> found \`${peer}\`, but it lacks a capability the map needs. Check its version.`,
        new Error(`Invalid optional peer \`${peer}\`: missing or invalid \`${capability}\` capability.`));
    }
    return { module: null };
  };
  const loader = createOptionalPeerLoader<Inspection>({
    load: () => inspect(importer),
    isCapability: (value): value is Inspection => isObjectLike(value) && 'module' in value,
    cache: 'generation',
    warningKey: `lyra-map:${peer}:import`,
    warning: `<lr-map> could not load the optional peer dependency \`${peer}\`. Check the network and installation (\`pnpm add ${peer}\`).`,
  });
  // Preserve the shared promise identity when mapping inspections to the engine capability.
  let previous: Promise<Inspection | null> | undefined;
  let result: Promise<T | null>;
  return {
    get(): Promise<T | null> {
      const next = loader.get();
      if (next !== previous) {
        previous = next;
        result = next.then(value => value?.module ?? null);
      }
      return result;
    },
    async loadWith(load = importer): Promise<T | null> {
      return (await loader.loadWith(() => inspect(load)))?.module ?? null;
    },
  };
}

let maplibreCapabilities: unknown;
const importMaplibre = (): Promise<unknown> => import('maplibre-gl').then(source =>
  maplibreCapabilities ??= Object.freeze({
    get Map() { return source.Map; },
    get Marker() { return source.Marker; },
    get Popup() { return source.Popup; },
    get NavigationControl() { return source.NavigationControl; },
    get ScaleControl() { return source.ScaleControl; },
    get GeolocateControl() { return source.GeolocateControl; },
    get AttributionControl() { return source.AttributionControl; },
    get setWorkerUrl() { return source.setWorkerUrl; },
    get getVersion() { return source.getVersion; },
    get default() { return (source as unknown as { readonly default?: unknown }).default; },
  }),
);

const maplibreLoader = createMapEngineLoader('maplibre-gl', importMaplibre, isMaplibreModule, missingMaplibreCapability);

/** Loads and validates the MapLibre capabilities consumed by `<lr-map>`. @internal */
export const loadMaplibreModule = maplibreLoader.loadWith;

/** Lazily loads the native engine. A rejected import is retried on the next call. */
export const loadMaplibre = maplibreLoader.get;

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
const importModularMap = (): Promise<unknown> => import('@aceshooting/lyra-map').then(source =>
  modularMapCapabilities ??= Object.freeze({
    get Map() { return source.Map; },
    get Marker() { return source.Marker; },
    get Popup() { return source.Popup; },
  }),
);

const modularLoader = createMapEngineLoader('@aceshooting/lyra-map', importModularMap, isModularMapModule,
  candidate => missingMaplibreCapability(candidate) ?? 'Map.prototype.prepareFeatures');

/** Loads and validates the optional modular engine without substituting a canonical engine. @internal */
export const loadModularMapModule = modularLoader.loadWith;

/** Lazily loads the modular companion. A rejected import is retried on the next call. */
export const loadModularMap = modularLoader.get;

/** The standard peer controls `<lr-map controls>` can add, by kind. */
export type MapControlKind = 'navigation' | 'scale' | 'geolocate' | 'globe' | 'terrain' | 'attribution';

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
  if (kind === 'globe' || kind === 'terrain') {
    const runtime = await import('./map-scene-controls.js');
    return kind === 'globe' ? runtime.MapGlobeControl : runtime.MapTerrainControl;
  }
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
    const control = isObjectLike(candidate) ? (candidate as Record<string, unknown>)[name] : undefined;
    return isConstructor(control) ? control as MapLibreControlConstructor : null;
  } catch (error) {
    console.warn(`<lr-map> could not load the ${kind} control from \`@aceshooting/lyra-map\`.`, error);
    return null;
  }
}
