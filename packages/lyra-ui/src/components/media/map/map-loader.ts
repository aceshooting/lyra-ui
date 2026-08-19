import {
  resolveOptionalPeerCapability,
  unwrapOptionalPeerDefault,
} from '../../../internal/optional-peer-capabilities.js';

export interface MapLibreGeoJsonSource {
  setData(data: unknown): void;
  /** maplibre-gl 3+ incremental update. Optional because older peers lack it. */
  updateData?(diff: MapLibreGeoJsonDiff): void;
}

/** The subset of maplibre-gl's GeoJSON diff this component emits: per-feature property updates. */
export interface MapLibreGeoJsonDiff {
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
}

export interface MapLibreMarkerCapability {
  setLngLat(lngLat: [number, number]): this;
  setPopup(popup?: MapLibrePopupCapability): this;
  getPopup(): MapLibrePopupCapability | undefined;
  addTo(map: MapLibreMapCapability): this;
  remove(): void;
  getElement?(): HTMLElement;
}

export interface MapLibreMapCapability {
  getCanvas?(): HTMLCanvasElement;
  getCenter(): { lng: number; lat: number };
  getZoom(): number;
  setCenter(center: [number, number]): unknown;
  setZoom(zoom: number): unknown;
  resize(): unknown;
  /** Optional: absent on peers predating it, and the caller feature-detects before use. */
  setMaxBounds?(bounds: readonly [readonly [number, number], readonly [number, number]] | null): unknown;
  remove(): void;
  on(type: 'error', listener: (event: { error?: unknown }) => void): this;
  on(type: 'load', listener: () => void): this;
  on(type: 'click', listener: (event: {
    point: unknown;
    lngLat: { lng: number; lat: number };
  }) => void): this;
  once(type: 'style.load', listener: () => void): this;
  setStyle(style: unknown): this;
  getSource(id: string): MapLibreGeoJsonSource | undefined;
  addSource(id: string, source: unknown): this;
  removeSource(id: string): this;
  getLayer(id: string): unknown;
  addLayer(layer: unknown): this;
  removeLayer(id: string): this;
  setPaintProperty(layerId: string, name: string, value: unknown): this;
  queryRenderedFeatures(point: unknown, options?: { layers?: string[] }): unknown[];
}

/** The MapLibre constructors Lyra consumes, structurally owned so the optional peer never leaks. */
export interface MaplibreModule {
  Map: new (options: Record<string, unknown>) => MapLibreMapCapability;
  Marker: new (options?: { color?: string }) => MapLibreMarkerCapability;
  Popup: new (options?: { offset?: number }) => MapLibrePopupCapability;
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

/** Loads and validates the MapLibre capabilities consumed by `<lr-map>`. @internal */
export async function loadMaplibreModule(
  importer: () => Promise<unknown> = () => import('maplibre-gl'),
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
