import { html, nothing, type TemplateResult, type PropertyValues } from 'lit';
import { property, query, state } from 'lit/decorators.js';
import { styleMap } from 'lit/directives/style-map.js';
import type { Feature, FeatureCollection } from 'geojson';
import { LyraElement } from '../../../internal/lyra-element.js';
import { sanitizeCssColor, sanitizeSwatchColor } from '../../../internal/safe-css.js';
import { finiteRange } from '../../../internal/numbers.js';
import { notifyMapCanvasReady } from '../../../internal/map-canvas-ready.js';
import { acquireAnnouncementSink, type AnnouncementSink } from '../../../internal/announcer.js';
import { srOnly } from '../../../internal/a11y.js';
import {
  loadMaplibre,
  type MapLibreGeoJsonSource,
  type MapLibreMapCapability,
  type MapLibreMarkerCapability,
  type MapLibrePopupCapability,
  type MaplibreModule,
} from './map-loader.js';
import { styles } from './map.styles.js';
import '../../overlays/skeleton/skeleton.class.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_close, LYRA_DEFAULT_collapse, LYRA_DEFAULT_details, LYRA_DEFAULT_loading, LYRA_DEFAULT_map, LYRA_DEFAULT_mapMissingLibrary, LYRA_DEFAULT_open, LYRA_DEFAULT_remove } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END


/** Probes for a real WebGL2 context without ever touching maplibre-gl's own (unreliable) failure
 *  path -- see the call site in `tryConstructMap()`. */
function supportsWebGL2(): boolean {
  try {
    return document.createElement('canvas').getContext('webgl2') !== null;
  } catch {
    return false;
  }
}

export interface LegendEntry {
  color: string;
  label: string;
}

/**
 * Declarative GeoJSON fill layer, colored by interpolating `field`'s value
 * across `stops`.
 */
export interface ChoroplethLayer {
  sourceId: string;
  geojson: FeatureCollection;
  field: string;
  /**
   * `[value, color]` pairs, ascending by `value`, fed to a maplibre-gl
   * `interpolate` expression. Must contain at least one pair -- an empty
   * array can't build a valid expression, so it's ignored (the existing fill
   * layer, if any, is left as-is) rather than applied.
   */
  stops: [number, string][];
}

/** One GeoJSON source rendered as three layers (`${sourceId}-fill` for polygons, `${sourceId}-line`
 *  for lines/outlines, `${sourceId}-circle` for points). Colors resolve from `--lr-*` tokens at
 *  apply time, defaulting to `accent`. */
export interface GeoJsonDataLayer {
  sourceId: string;
  geojson: Feature | FeatureCollection;
  tone?: 'accent' | 'success' | 'warning' | 'danger' | 'neutral';
}

export interface MapMarker {
  id?: string;
  lngLat: [number, number];
  /** A CSS color. Invalid values and `url()` paint servers use maplibre-gl's default marker color. */
  color?: string;
  /** Visible popup text and the marker button's accessible name. */
  label?: string;
  /**
   * Rendered as the marker's popup content via maplibre-gl's
   * `Popup.setHTML()` -- parsed as raw markup, inline event handlers
   * included. This is the library's one explicit unsafe-HTML escape hatch:
   * only ever pass trusted content, and sanitize anything derived from user
   * input before assigning it here. Prefer `label` (rendered via the safe
   * `Popup.setText()`) whenever the content is plain text.
   */
  unsafeHtml?: string;
}

/** Peer-neutral subset of a MapLibre style accepted by `mapStyle`. */
export interface LyraMapStyleSpecification {
  version: 8;
  sources: Record<string, unknown>;
  layers: unknown[];
  name?: string;
  sprite?: string | { id: string; url: string }[];
  glyphs?: string;
}

/**
 * Common imperative map capability returned by `LyraMap.map` without making
 * `maplibre-gl` a declaration dependency for consumers.
 */
export interface LyraMapInstance {
  getCanvas(): HTMLCanvasElement;
  getCenter(): { lng: number; lat: number };
  getZoom(): number;
  setCenter(center: [number, number]): unknown;
  setZoom(zoom: number): unknown;
  resize(): unknown;
}

/**
 * Fallback `mapStyle` used only when a consumer never sets one. Points at
 * OpenStreetMap's shared **demo** tile server (`tile.openstreetmap.org`),
 * which is explicitly NOT for production/bulk use: it has no capacity
 * guarantees, requires an identifying `User-Agent`/`Referer`, and will
 * rate-limit or IP-block non-compliant or high-volume clients per the OSM
 * Foundation's tile usage policy
 * (https://operations.osmfoundation.org/policies/tiles/). Convenient for
 * local development and quick prototypes only — production apps MUST supply
 * their own `mapStyle` (a hosted vector/raster style from a tile provider
 * you have a plan with, or your own tile server).
 */
const DEFAULT_STYLE: LyraMapStyleSpecification = {
  version: 8,
  sources: {
    'lr-osm': {
      type: 'raster',
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      attribution: '© OpenStreetMap contributors',
    },
  },
  layers: [{ id: 'lr-osm', type: 'raster', source: 'lr-osm' }],
};

// Defensive JS-side fallback for choroplethFillOpacity() below, mirroring
// --lr-map-choropleth-fill-opacity's own default (see map.styles.ts) --
// only reached if getComputedStyle somehow can't resolve the custom
// property at all (e.g. host detached from the document).
const FALLBACK_FILL_OPACITY = 0.75;

/** Lit's server DOM intentionally gives custom elements no browser-owned document. */
function ownerWindow(host: Element): (Window & typeof globalThis) | null {
  return (host.ownerDocument as Document | undefined)?.defaultView ?? null;
}

/**
 * Reads the current `--lr-map-choropleth-fill-opacity` custom property so
 * the choropleth fill layer's opacity is retheme-able instead of a literal
 * hardcoded into the maplibre-gl paint expression.
 */
function choroplethFillOpacity(host: Element): number {
  const raw = ownerWindow(host)
    ?.getComputedStyle(host)
    .getPropertyValue('--lr-map-choropleth-fill-opacity')
    .trim() ?? '';
  const parsed = Number.parseFloat(raw);
  return Number.isFinite(parsed) ? parsed : FALLBACK_FILL_OPACITY;
}

const TONE_TOKEN: Record<NonNullable<GeoJsonDataLayer['tone']>, string> = {
  accent: '--lr-color-brand',
  success: '--lr-color-success',
  warning: '--lr-color-warning',
  danger: '--lr-color-danger',
  neutral: '--lr-color-text-quiet',
};

/**
 * Resolves a `GeoJsonDataLayer.tone` to a real color via the matching
 * `--lr-color-*` token, read at apply time (not property-set time) so a
 * later retheme is picked up the next time `dataLayers` is (re)applied --
 * same rationale as `choroplethFillOpacity()` above.
 */
function dataLayerColor(host: Element, tone: GeoJsonDataLayer['tone']): string {
  const token = TONE_TOKEN[tone ?? 'accent'];
  const raw = ownerWindow(host)?.getComputedStyle(host).getPropertyValue(token).trim() ?? '';
  return raw || '#0969da';
}

export interface LyraMapEventMap {
  'lr-map-load': CustomEvent<undefined>;
  'lr-map-click': CustomEvent<{
    lngLat: [number, number];
    feature: Feature | undefined;
  }>;
}
/**
 * `<lr-map>` — a maplibre-gl wrapper with a declarative legend, choropleth
 * GeoJSON layer, markers, and additive `dataLayers` GeoJSON overlays
 * (arbitrary shapes rendered as a source plus fill/line/circle layers,
 * independent of `choropleth`'s field/stops color-interpolation), plus a peer-neutral
 * `map` getter for common imperative operations. Its runtime value is the underlying MapLibre
 * map, while its declaration stays independent of the optional peer. Requires `maplibre-gl`
 * v5 or v6; the component styles MapLibre's generated canvas, marker, popup, and control DOM
 * inside its shadow root. MapLibre v6 is ESM-only, requires WebGL2, and needs its module-worker
 * URL configured once; v5's standard build includes its worker.
 *
 * The underlying `maplibregl.Map` — and the WebGL context it opens — isn't
 * constructed until this element is first visible in the viewport (tracked
 * via `IntersectionObserver`), even once the `maplibre-gl` peer dependency
 * has finished loading. Browsers hard-cap concurrent WebGL contexts per
 * page, so a grid/dashboard of many `<lr-map>` instances only constructs
 * the ones actually on-screen instead of racing to exhaust that budget the
 * instant each one mounts. `map` stays `undefined` (and `lr-map-load`
 * doesn't fire) until construction actually happens.
 *
 * @customElement lr-map
 * @event lr-map-load - Fired once the underlying maplibregl.Map loads.
 * @event lr-map-click - `detail: { lngLat, feature? }`.
 * @csspart base - The non-semantic map wrapper. It exposes `aria-busy="true"` while the optional
 *   map library loads and contains ordinary, non-live localized loading text.
 * @csspart container - The MapLibre container. Its generated canvas is the actual focusable map
 *   region and receives the host-first accessible name and effective locale.
 * @csspart legend - The map legend.
 * @csspart legend-swatch - A legend color swatch.
 * @csspart error - Visible message shown instead of `container` if the optional `maplibre-gl`
 *   peer dependency fails to load (e.g. not installed); the transition is announced through the
 *   shared light-DOM assertive region.
 *
 * ⚠️ The default `mapStyle` (when unset) uses OpenStreetMap's demo tile
 * server, which is not suitable for production traffic — see the
 * `DEFAULT_STYLE` doc comment above. Always pass an explicit
 * `mapStyle` in production.
 * @status stable
 * @since 4.0.0
 */
export class LyraMap extends LyraElement<LyraMapEventMap> {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    close: LYRA_DEFAULT_close,
    collapse: LYRA_DEFAULT_collapse,
    details: LYRA_DEFAULT_details,
    loading: LYRA_DEFAULT_loading,
    map: LYRA_DEFAULT_map,
    mapMissingLibrary: LYRA_DEFAULT_mapMissingLibrary,
    open: LYRA_DEFAULT_open,
    remove: LYRA_DEFAULT_remove,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  static override styles = [LyraElement.styles, styles, srOnly];

  @property({ type: Array }) center: [number, number] = [0, 0];
  @property({ type: Number }) zoom = 2;
  @property({ attribute: false }) mapStyle: LyraMapStyleSpecification | string = DEFAULT_STYLE;
  @property({ attribute: false }) legend: LegendEntry[] = [];
  @property({ attribute: false }) choropleth?: ChoroplethLayer;
  @property({ attribute: false }) markers: MapMarker[] = [];
  /** Additive GeoJSON layers rendered alongside the choropleth/markers -- each entry becomes a
   *  source plus fill/line/circle layers. Defaults empty (zero behavior change). */
  @property({ attribute: false }) dataLayers: GeoJsonDataLayer[] = [];

  /** Accessible-name fallback for MapLibre's focusable canvas. A host `aria-label` takes
   *  precedence when both are set; when neither is present, the canvas uses the localized `map`
   *  message. */
  @property() label = '';

  /** True until the lazy-loaded `maplibre-gl` peer dependency has settled (success or failure). */
  @state() private loading = true;

  /** True once the lazy-loaded `maplibre-gl` peer dependency has settled with a `null` result
   *  (not installed) -- render() fails closed into visible `part="error"` chrome instead of
   *  silently leaving `part="container"` empty, mirroring docx-viewer/pdf-viewer's identical
   *  "optional peer missing" treatment for the same failure shape. */
  @state() private loadFailed = false;
  private errorAnnouncementSink?: AnnouncementSink;

  // Overridable instance field (not a direct `loadMaplibre()` call site) purely so tests can
  // inject a stubbed loader before the element ever connects -- matches docx-viewer's own
  // `loadLibrary` field/rationale exactly.
  private loadLibrary: () => ReturnType<typeof loadMaplibre> = loadMaplibre;

  // Gates the actual `new mod.Map(...)` construction (see `tryConstructMap()`)
  // -- starts `false` so a `<lr-map>` mounted off-screen doesn't open a
  // WebGL context before it's ever seen, and only flips `true` once the
  // IntersectionObserver below reports this element actually intersecting
  // the viewport. Defaults `true` outright when `IntersectionObserver` isn't
  // available at all (fail open, matching `lr-chart`'s own fallback)
  // rather than gating construction on an observer that will never fire.
  @state() private visible = ownerWindow(this)?.IntersectionObserver === undefined;
  private intersectionObserver?: IntersectionObserver;

  @query('[part="container"]') private containerEl?: HTMLElement;
  private _map?: MapLibreMapCapability;
  // Tracks whether the style has fired its initial 'load' (i.e. addSource/
  // addLayer/setPaintProperty are now safe to call), rather than re-querying
  // `this._map.isStyleLoaded()`: that also reflects in-flight *tile* loading
  // for every source, so it flips back to `false` as soon as the choropleth's
  // own GeoJSON source is added — which would wrongly block subsequent
  // choropleth updates from ever re-running.
  private _styleLoaded = false;
  // Tracks the currently-applied choropleth's sourceId/fillLayerId so a
  // clear (`choropleth = undefined`) or a sourceId change can remove the
  // previous layer/source instead of leaking it. A declarative light-DOM-
  // children model (where removing a child removes its layer) would avoid
  // this class of bug entirely, but that would be a larger redesign.
  private _appliedChoroplethSourceId?: string;
  private _appliedFillLayerId?: string;
  // Tracks currently-applied dataLayers sourceIds for clean removal on reassignment/disconnect --
  // same rationale as `_appliedChoroplethSourceId` (a declarative light-DOM-children model would
  // avoid this bookkeeping entirely, but that's a larger redesign than this bridge warrants).
  private _appliedDataLayerIds = new Set<string>();
  // Cached once connectedCallback's loadMaplibre().then() resolves, and always
  // set before `_map` itself is (see that closure) -- so any code path gated
  // on `this._map` being truthy can rely on this being set too, without
  // re-awaiting the (already-settled) loadMaplibre() promise.
  private _maplibreModule?: MaplibreModule;
  private _markerInstances = new Map<string, MapLibreMarkerCapability>();
  private _markerLabels = new Map<string, string | undefined>();
  private _markerPopupIds = new Map<string, string>();
  private _configuredPopups = new WeakSet<object>();
  private _nextPopupId = 0;
  // The installed maplibre-gl's `Marker` class has no `setColor()` (verified
  // against its shipped `.d.ts` -- `color` is only ever consumed by the
  // constructor), so an id-matched marker whose `color` changes can't be
  // mutated in place; it has to be torn down and reconstructed instead. This
  // tracks the color each currently-live marker instance was last
  // constructed with, keyed the same as `_markerInstances`, so `applyMarkers`
  // can detect that mismatch without re-deriving it from the DOM.
  private _markerColors = new Map<string, string | undefined>();
  // Bumped on every connectedCallback and captured by value in its
  // loadMaplibre().then() closure below. A disconnect immediately followed
  // by a reconnect (fast remounts, route/tab switches, etc.) before that
  // cached promise settles would otherwise let *every* connect attempt's
  // closure construct its own maplibregl.Map against the same container —
  // only the last one written to `this._map` survives, and the earlier
  // ones leak their WebGL context/canvas/event listeners forever. Each
  // closure compares its captured generation against the current value
  // before doing anything observable, and bails if a newer
  // connectedCallback has since superseded it.
  private _connectGeneration = 0;

  /** The underlying runtime `maplibregl.Map`, declared through Lyra's peer-neutral common-method
   * subset so consumers do not acquire a mandatory `maplibre-gl` type dependency. Consumers that
   * install the optional peer may explicitly narrow this value to its full `Map` type. */
  get map(): LyraMapInstance | undefined {
    return this._map as unknown as LyraMapInstance | undefined;
  }

  /** `zoom` normalized to a finite value clamped into `[0, 22]` -- maplibre-gl's own default
   *  `minZoom`/`maxZoom` (this component passes neither option to `new maplibregl.Map()`, so
   *  those are the bounds the underlying map itself enforces). A non-finite value would otherwise
   *  reach the constructor's initial `zoom` option or a live `setZoom()` call unnormalized. */
  private get safeZoom(): number {
    return finiteRange(this.zoom, 2, 0, 22);
  }

  /** Longitude/latitude normalized before reaching MapLibre's constructor or live setter. */
  private get safeCenter(): [number, number] {
    const center = Array.isArray(this.center) ? this.center : [];
    return [
      finiteRange(Number(center[0]), 0, -180, 180),
      finiteRange(Number(center[1]), 0, -90, 90),
    ];
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.syncErrorAnnouncementSink();
    const generation = ++this._connectGeneration;
    // A reconnect always tears the map down in disconnectedCallback() below,
    // so it needs its own fresh visibility read rather than trusting
    // whatever `visible` was left at from before the previous disconnect.
    const IntersectionObserverCtor = ownerWindow(this)?.IntersectionObserver;
    this.visible = IntersectionObserverCtor === undefined;
    // A reconnect after a previous failed load deserves its own fresh attempt rather than being
    // stuck showing the error state forever -- loadLibrary()'s own cached promise (once it
    // resolves null) would otherwise keep re-resolving null, but this at least clears the stale
    // UI state for a genuinely new connection.
    this.loadFailed = false;
    if (IntersectionObserverCtor) {
      const observer = new IntersectionObserverCtor((entries) => {
        if (entries[0]?.isIntersecting) this.visible = true;
      });
      this.intersectionObserver = observer;
      observer.observe(this);
    }
    void this.loadLibrary().then(async (mod) => {
      // A newer connectedCallback (disconnect + reconnect) already
      // superseded this attempt while loadLibrary()'s cached promise was
      // in flight — bail before touching any state, let the newer attempt's
      // own closure (already queued behind this one on the same promise)
      // take over instead.
      if (generation !== this._connectGeneration || !this.isConnected) return;
      this.loading = false;
      // WebGL2 support doesn't depend on visibility or timing, so it's checked here -- alongside
      // the "did the library even load" check, in the same synchronous block as `this.loading =
      // false` -- rather than later inside tryConstructMap(). tryConstructMap() also runs from
      // updated()'s visibility-triggered path, a post-render hook where setting reactive state
      // schedules a whole extra update cycle (a real regression: it broke strict-console tests
      // elsewhere that construct <lr-map> in a WebGL2-less environment). Failing this closed as
      // early as possible avoids that entirely, and is also just more correct: there's no reason
      // to wait for visibility to report an environment limitation that visibility can't fix.
      if (!mod || !supportsWebGL2()) {
        this.loadFailed = true;
        this.errorAnnouncementSink?.announce(this.localize('mapMissingLibrary'));
        return;
      }
      this._maplibreModule = mod;
      // `[part="container"]` only exists once `loading` flips to `false` and
      // Lit re-renders — wait for that render to land before querying it.
      await this.updateComplete;
      // Re-check after the await: the element may have been removed from
      // the DOM entirely while this loadMaplibre()/updateComplete window
      // was in flight — don't spin up a maplibre Map (WebGL context + event
      // listeners) for a detached instance (disconnectedCallback's cleanup
      // already ran) — or superseded by yet another disconnect+reconnect
      // cycle that happened during the `await` above.
      if (generation !== this._connectGeneration || !this.containerEl || !this.isConnected) return;
      this.tryConstructMap();
    });
  }

  override disconnectedCallback(): void {
    this.releaseErrorAnnouncementSink();
    super.disconnectedCallback();
    this._map?.remove();
    this._map = undefined;
    this._styleLoaded = false;
    this._appliedChoroplethSourceId = undefined;
    this._appliedFillLayerId = undefined;
    this._appliedDataLayerIds.clear();
    this.intersectionObserver?.disconnect();
    this.intersectionObserver = undefined;
    for (const marker of this._markerInstances.values()) marker.remove();
    this._markerInstances.clear();
    this._markerColors.clear();
    this._markerLabels.clear();
    this._markerPopupIds.clear();
  }

  adoptedCallback(): void {
    this.releaseErrorAnnouncementSink();
    this.syncErrorAnnouncementSink();
  }

  private syncErrorAnnouncementSink(): void {
    if (!this.isConnected) return;
    if (this.errorAnnouncementSink?.element.ownerDocument === this.ownerDocument) return;
    this.releaseErrorAnnouncementSink();
    this.errorAnnouncementSink = acquireAnnouncementSink('assertive', {
      document: this.ownerDocument,
      source: this,
    });
  }

  private releaseErrorAnnouncementSink(): void {
    this.errorAnnouncementSink?.release();
    this.errorAnnouncementSink = undefined;
  }

  /**
   * Constructs the underlying `maplibregl.Map` — called once both the
   * lazy-loaded `maplibre-gl` module has resolved and this element has been
   * observed intersecting the viewport, whichever settles last. Idempotent
   * (a no-op once `_map` already exists), so it's safe to call from both the
   * `connectedCallback()` load path and the visibility path in `updated()`
   * below without risking a double construction.
   */
  private tryConstructMap(): void {
    if (this._map || !this._maplibreModule || !this.containerEl || !this.visible || !this.isConnected) return;
    // supportsWebGL2() is already checked before `this._maplibreModule` is ever set (see the
    // connectedCallback() load path above) -- reaching here with a set _maplibreModule means it
    // already passed. maplibre-gl doesn't fail construction cleanly when WebGL2 is unavailable
    // (it fires a GPUInitializationError internally and still returns a Map instance with no
    // `painter`, which would crash disconnectedCallback()'s `this._map.remove()`), so this must
    // stay a precondition rather than a try/catch around the constructor below.
    const mod = this._maplibreModule;
    this._map = new mod.Map({
      container: this.containerEl,
      style: this.mapStyle as never,
      center: this.safeCenter,
      zoom: this.safeZoom,
      locale: {
        'Map.Title': this.effectiveMapLabel,
        'Marker.Title': this.localize('map'),
        'Popup.Close': this.localize('close'),
      },
    });
    const canvas = this._map.getCanvas?.() as HTMLCanvasElement | undefined;
    if (canvas) notifyMapCanvasReady(this, canvas);
    // maplibre-gl's Evented base rethrows an 'error' emission that has no
    // listener attached (mirroring Node's EventEmitter convention) -- with
    // no handler here, a failed tile/style fetch (e.g. DEFAULT_STYLE's
    // tile.openstreetmap.org demo server being unreachable or rate-limited)
    // would surface as an unhandled promise rejection instead of a normal,
    // catchable error. Log it instead so callers can see it without the
    // whole page treating it as an uncaught exception.
    this._map.on('error', (event) => {
      console.error('lr-map:', event.error ?? event);
    });
    this._map.on('load', () => {
      this._styleLoaded = true;
      this.applyChoropleth();
      this.applyMarkers();
      this.applyDataLayers();
      this.emit('lr-map-load');
    });
    this._map.on('click', (event) => {
      const fillLayerId = this._appliedFillLayerId;
      const features =
        fillLayerId && this._map!.getLayer(fillLayerId)
          ? this._map!.queryRenderedFeatures(event.point, { layers: [fillLayerId] })
          : [];
      this.emit('lr-map-click', {
        lngLat: [event.lngLat.lng, event.lngLat.lat],
        feature: features[0] as Feature | undefined,
      });
    });
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    this.setAttribute('aria-busy', String(this.loading));

    // Became visible after the maplibre-gl module had already loaded (the
    // reverse order — module loads first, visibility follows — is the
    // common case and is instead handled at the end of the
    // `loadMaplibre().then()` chain in connectedCallback() above).
    if (changed.has('visible') && this.visible) this.tryConstructMap();

    if (changed.has('mapStyle') && this._map) {
      // A style change wipes every layer/source maplibre-gl knows about, so
      // the previously-applied choropleth bookkeeping is stale the instant
      // setStyle() is called — clear it and re-apply once the new style's
      // own 'style.load' fires (mirrors the constructor's 'load' handshake).
      this._styleLoaded = false;
      this._appliedChoroplethSourceId = undefined;
      this._appliedFillLayerId = undefined;
      // Register the listener *before* calling setStyle(): maplibre-gl's
      // diff-based style update path (small, incremental style changes) can
      // fire 'style.load' synchronously from inside setStyle() itself —
      // registering the listener afterwards would miss that emission and
      // leave the choropleth (and `_styleLoaded`) never re-applied.
      this._map.once('style.load', () => {
        this._styleLoaded = true;
        this._appliedDataLayerIds.clear(); // a style change wipes every layer/source maplibre-gl knows about
        this.applyChoropleth();
        this.applyDataLayers();
      });
      this._map.setStyle(this.mapStyle as never);
    } else if (this._styleLoaded && (changed.has('dataLayers') || changed.has('choropleth'))) {
      const nextChoroplethSourceId = this.choropleth
        ? this.resolveChoroplethSourceId(this.choropleth.sourceId)
        : undefined;
      // Remove a choropleth that must move namespaces before mutating data layers. This ordering
      // also makes an atomic `choropleth = undefined; dataLayers = [{ same sourceId }]` update
      // safe: the old source is released before the new layers begin referring to that id.
      if (
        this._appliedChoroplethSourceId &&
        this._appliedChoroplethSourceId !== nextChoroplethSourceId
      ) {
        this.removeChoropleth();
      }
      if (changed.has('dataLayers')) this.applyDataLayers();
      this.applyChoropleth();
    }
    if (changed.has('center') && this._map) this._map.setCenter(this.safeCenter);
    if (changed.has('zoom') && this._map) this._map.setZoom(this.safeZoom);
    if (changed.has('markers') && this._map) this.applyMarkers();
    this.syncMapSemantics();
  }

  private applyChoropleth(): void {
    if (!this._map) return;
    if (!this.choropleth) {
      this.removeChoropleth();
      return;
    }
    const { geojson, field, stops } = this.choropleth;
    const sourceId = this.resolveChoroplethSourceId(this.choropleth.sourceId);
    const fillLayerId = `${sourceId}-fill`;

    if (this._appliedChoroplethSourceId && this._appliedChoroplethSourceId !== sourceId) {
      this.removeChoropleth();
    }

    const existingSource = this._map.getSource(sourceId) as MapLibreGeoJsonSource | undefined;
    if (existingSource) {
      // Re-apply the data even if the color expression below ends up skipped:
      // `geojson` may have changed even though `sourceId`/`stops` didn't.
      existingSource.setData(geojson);
    } else {
      // No `promoteId` -- maplibre-gl falls back to its own default id
      // resolution (the standard top-level GeoJSON `Feature.id`, when
      // present). A hardcoded `promoteId: 'id'` here would instead require
      // every feature to *also* duplicate its id inside `properties.id`,
      // silently discarding the real top-level `id` otherwise and breaking
      // `feature.id` on `lr-map-click` for the common case. Nothing in this
      // component actually needs feature-state promotion today; if that's
      // added later it should be driven by an explicit, documented
      // `ChoroplethLayer` option (e.g. `idField`), not a silent default.
      this._map.addSource(sourceId, { type: 'geojson', data: geojson });
    }
    this._appliedChoroplethSourceId = sourceId;

    // An `interpolate` expression needs at least one [value, color] stop pair
    // -- maplibre-gl's own expression parser requires it and otherwise fires a
    // silently-ignored ErrorEvent instead of throwing (`addLayer`/
    // `setPaintProperty` just no-op), so an empty `stops` would otherwise
    // "succeed" here without ever creating/updating the fill layer, and every
    // later update (valid `stops`, same `sourceId`) would find `existingSource`
    // and wrongly assume `setPaintProperty` has a real layer to target. Bail
    // before touching the layer at all and leave whatever fill layer already
    // exists (if any) untouched until `stops` is non-empty again.
    if (stops.length === 0) return;

    const colorExpr: unknown[] = ['interpolate', ['linear'], ['get', field]];
    for (const [value, color] of stops) colorExpr.push(value, color);

    if (this._map.getLayer(fillLayerId)) {
      this._map.setPaintProperty(fillLayerId, 'fill-color', colorExpr as never);
    } else {
      this._map.addLayer({
        id: fillLayerId,
        type: 'fill',
        source: sourceId,
        paint: { 'fill-color': colorExpr as never, 'fill-opacity': choroplethFillOpacity(this) },
      });
    }
    this._appliedFillLayerId = fillLayerId;
  }

  /**
   * Keeps the choropleth out of every caller-controlled data-layer namespace. Repeatedly prefixing
   * is intentional: a consumer may legitimately supply both `shared` and
   * `lr-choropleth-shared`, so a single conditional prefix is not sufficient.
   */
  private resolveChoroplethSourceId(sourceId: string): string {
    const dataSourceIds = new Set(this.dataLayers.map((layer) => layer.sourceId));
    let resolved = sourceId;
    while (dataSourceIds.has(resolved)) resolved = `lr-choropleth-${resolved}`;
    return resolved;
  }

  /** Removes whatever choropleth layer/source is currently applied, if any. */
  private removeChoropleth(): void {
    if (!this._map || !this._appliedChoroplethSourceId) return;
    if (this._appliedFillLayerId && this._map.getLayer(this._appliedFillLayerId)) {
      this._map.removeLayer(this._appliedFillLayerId);
    }
    if (this._map.getSource(this._appliedChoroplethSourceId)) {
      this._map.removeSource(this._appliedChoroplethSourceId);
    }
    this._appliedChoroplethSourceId = undefined;
    this._appliedFillLayerId = undefined;
  }

  /**
   * Applies every `dataLayers` entry as a GeoJSON source plus fill/line/circle
   * layers, reusing an existing source/layer in place (via `setData()`/
   * `setPaintProperty()`) when its id is already applied, and removing any
   * previously-applied id no longer present in `dataLayers` -- mirrors
   * `applyChoropleth()`'s add-or-update-in-place pattern above.
   */
  private applyDataLayers(): void {
    if (!this._map) return;
    const nextIds = new Set(this.dataLayers.map((l) => l.sourceId));
    for (const id of this._appliedDataLayerIds) {
      if (!nextIds.has(id)) this.removeDataLayer(id);
    }
    for (const layer of this.dataLayers) {
      const { sourceId, geojson, tone } = layer;
      const existingSource = this._map.getSource(sourceId) as MapLibreGeoJsonSource | undefined;
      if (existingSource) {
        existingSource.setData(geojson);
      } else {
        this._map.addSource(sourceId, { type: 'geojson', data: geojson });
      }
      const color = dataLayerColor(this, tone);
      const fillId = `${sourceId}-fill`;
      const lineId = `${sourceId}-line`;
      const circleId = `${sourceId}-circle`;
      if (!this._map.getLayer(fillId)) {
        this._map.addLayer({
          id: fillId,
          type: 'fill',
          source: sourceId,
          filter: ['==', ['geometry-type'], 'Polygon'],
          paint: { 'fill-color': color, 'fill-opacity': choroplethFillOpacity(this) },
        });
      } else {
        this._map.setPaintProperty(fillId, 'fill-color', color);
      }
      if (!this._map.getLayer(lineId)) {
        this._map.addLayer({
          id: lineId,
          type: 'line',
          source: sourceId,
          filter: ['in', ['geometry-type'], ['literal', ['LineString', 'Polygon']]],
          paint: { 'line-color': color, 'line-width': 2 },
        });
      } else {
        this._map.setPaintProperty(lineId, 'line-color', color);
      }
      if (!this._map.getLayer(circleId)) {
        this._map.addLayer({
          id: circleId,
          type: 'circle',
          source: sourceId,
          filter: ['==', ['geometry-type'], 'Point'],
          paint: { 'circle-color': color, 'circle-radius': 5 },
        });
      } else {
        this._map.setPaintProperty(circleId, 'circle-color', color);
      }
      this._appliedDataLayerIds.add(sourceId);
    }
  }

  /** Removes one previously-applied `dataLayers` entry's source/layers, if present. */
  private removeDataLayer(sourceId: string): void {
    if (!this._map) return;
    for (const layerId of [`${sourceId}-fill`, `${sourceId}-line`, `${sourceId}-circle`]) {
      if (this._map.getLayer(layerId)) this._map.removeLayer(layerId);
    }
    if (this._map.getSource(sourceId)) this._map.removeSource(sourceId);
    this._appliedDataLayerIds.delete(sourceId);
  }

  // Deliberately synchronous (no `await loadMaplibre()`): `_maplibreModule` is
  // already cached by the time `_map` exists (both are set in the same
  // connectedCallback closure, see above), and every caller here is
  // fire-and-forget. Re-awaiting the loader would open a window between the
  // `_map` check and the marker mutations below where a disconnect (which
  // synchronously clears `_map`) could resume into a torn-down map -- staying
  // synchronous closes that window by construction instead of re-checking
  // after the fact.
  private applyMarkers(): void {
    const map = this._map;
    const mod = this._maplibreModule;
    if (!map || !mod) return;
    const visible = new Set<string>();
    // Markers with no `id` used to key solely by `lngLat`, so two different
    // id-less markers placed at the exact same coordinates collided onto one
    // `_markerInstances` entry. An occurrence index (reset per render, per
    // coordinate) makes same-coordinate id-less markers distinct while
    // staying stable/consistent across re-renders as long as their relative
    // order in `this.markers` doesn't change.
    const coordCounts = new Map<string, number>();
    for (const candidate of Array.isArray(this.markers) ? this.markers : []) {
      const lngLat = this.validMarkerLngLat(candidate);
      if (!lngLat) continue;
      const m = candidate as MapMarker;
      let key: string;
      if (m.id != null) {
        key = `id:${m.id}`;
      } else {
        const coordKey = `${lngLat[0]},${lngLat[1]}`;
        const occurrence = coordCounts.get(coordKey) ?? 0;
        coordCounts.set(coordKey, occurrence + 1);
        key = `coordinate:${coordKey}#${occurrence}`;
      }
      visible.add(key);
      let existing = this._markerInstances.get(key);
      const markerColor = sanitizeCssColor(m.color);
      if (existing && this._markerColors.get(key) !== markerColor) {
        // `color` is baked into the marker's SVG at construction time with
        // no way to mutate it afterwards -- fall through to the "no existing
        // marker" branch below to reconstruct it instead. Note: this closes
        // any popup the user currently has open on this marker (a fresh,
        // closed Popup is built for the new instance) -- an accepted, narrow
        // side effect of the reconstruction fallback, not a bug.
        existing.remove();
        this._markerInstances.delete(key);
        this._markerColors.delete(key);
        existing = undefined;
      }
      if (!existing) {
        const marker = new mod.Marker(markerColor ? { color: markerColor } : undefined).setLngLat(lngLat);
        if (m.unsafeHtml || m.label) {
          const popup = new mod.Popup({ offset: 12 });
          if (m.unsafeHtml) popup.setHTML(m.unsafeHtml);
          else if (m.label) popup.setText(m.label);
          marker.setPopup(popup);
          this.configurePopupSemantics(key, marker, popup);
        }
        marker.addTo(map);
        this._markerInstances.set(key, marker);
        this._markerColors.set(key, markerColor);
      } else {
        existing.setLngLat(lngLat);
        const popup = existing.getPopup();
        if (m.unsafeHtml) {
          if (popup) popup.setHTML(m.unsafeHtml);
          else {
            const nextPopup = new mod.Popup({ offset: 12 }).setHTML(m.unsafeHtml);
            existing.setPopup(nextPopup);
            this.configurePopupSemantics(key, existing, nextPopup);
          }
        } else if (m.label) {
          if (popup) popup.setText(m.label);
          else {
            const nextPopup = new mod.Popup({ offset: 12 }).setText(m.label);
            existing.setPopup(nextPopup);
            this.configurePopupSemantics(key, existing, nextPopup);
          }
        } else if (popup) {
          existing.setPopup(undefined);
        }
      }
      this._markerLabels.set(key, m.label);
      const markerElement = (this._markerInstances.get(key) as { getElement?: () => HTMLElement } | undefined)
        ?.getElement?.();
      if (markerElement) {
        markerElement.setAttribute('aria-label', m.label || this.localize('map'));
        markerElement.setAttribute('lang', this.effectiveLocale);
        const currentMarker = this._markerInstances.get(key);
        const popup = currentMarker?.getPopup();
        if (popup && currentMarker) {
          this.configurePopupSemantics(key, currentMarker, popup);
          this.syncPopupSemantics(key, currentMarker, popup);
        } else {
          markerElement.removeAttribute('aria-controls');
          markerElement.removeAttribute('aria-expanded');
        }
      }
    }
    for (const [key, marker] of this._markerInstances) {
      if (!visible.has(key)) {
        marker.remove();
        this._markerInstances.delete(key);
        this._markerColors.delete(key);
        this._markerLabels.delete(key);
        this._markerPopupIds.delete(key);
      }
    }
  }

  private get effectiveMapLabel(): string {
    return this.getAttribute('aria-label') || this.label || this.localize('map');
  }

  private validMarkerLngLat(candidate: unknown): [number, number] | null {
    if (!candidate || typeof candidate !== 'object') return null;
    const lngLat = (candidate as { lngLat?: unknown }).lngLat;
    if (!Array.isArray(lngLat) || lngLat.length < 2) return null;
    const [lng, lat] = lngLat;
    if (
      typeof lng !== 'number' ||
      typeof lat !== 'number' ||
      !Number.isFinite(lng) ||
      !Number.isFinite(lat) ||
      lat < -90 ||
      lat > 90
    ) {
      return null;
    }
    return [lng, lat];
  }

  private popupId(key: string): string {
    let id = this._markerPopupIds.get(key);
    if (!id) {
      id = `map-popup-${this._connectGeneration}-${++this._nextPopupId}`;
      this._markerPopupIds.set(key, id);
    }
    return id;
  }

  private configurePopupSemantics(
    key: string,
    marker: MapLibreMarkerCapability,
    popup: MapLibrePopupCapability,
  ): void {
    if (!popup || typeof popup !== 'object' || this._configuredPopups.has(popup)) return;
    this._configuredPopups.add(popup);
    popup.on?.('open', () => this.syncPopupSemantics(key, marker, popup));
    popup.on?.('close', () => {
      marker.getElement?.()?.setAttribute('aria-expanded', 'false');
    });
  }

  private syncPopupSemantics(
    key: string,
    marker: MapLibreMarkerCapability,
    popup: MapLibrePopupCapability,
  ): void {
    const markerElement = marker?.getElement?.() as HTMLElement | undefined;
    if (!markerElement) return;
    const id = this.popupId(key);
    markerElement.setAttribute('aria-controls', id);
    markerElement.setAttribute('aria-expanded', popup?.isOpen?.() ? 'true' : 'false');
    const popupElement = popup?.getElement?.() as HTMLElement | undefined;
    if (!popupElement) return;
    popupElement.id = id;
    popupElement.setAttribute('role', 'dialog');
    popupElement.setAttribute('lang', this.effectiveLocale);
    popupElement.setAttribute(
      'aria-label',
      this._markerLabels.get(key) || this.effectiveMapLabel,
    );
    popupElement
      .querySelector('.maplibregl-popup-close-button')
      ?.setAttribute('aria-label', this.localize('close'));
  }

  private syncMapSemantics(): void {
    const canvas = this._map?.getCanvas?.() as HTMLCanvasElement | undefined;
    if (canvas) {
      canvas.setAttribute('aria-label', this.effectiveMapLabel);
      canvas.setAttribute('lang', this.effectiveLocale);
    }
    for (const [key, marker] of this._markerInstances) {
      const markerElement = marker.getElement?.() as HTMLElement | undefined;
      if (!markerElement) continue;
      markerElement.setAttribute(
        'aria-label',
        this._markerLabels.get(key) || this.localize('map'),
      );
      markerElement.setAttribute('lang', this.effectiveLocale);
      const popup = marker.getPopup?.();
      if (popup) this.syncPopupSemantics(key, marker, popup);
    }
  }

  override render(): TemplateResult {
    // Lit's own whitespace/comment marker nodes around the `${...}` binding mean
    // `[part="legend"]` is never truly `:empty` in CSS even with zero entries, so
    // the panel is omitted from the template entirely when `legend` is empty
    // (same `nothing` pattern `stat.ts` uses to omit its optional trend section)
    // rather than relying on a CSS `:empty` selector that can never match.
    return html`
      <div
        part="base"
        aria-busy=${String(this.loading)}
      >
        ${this.loadFailed
          ? html`<div part="error">${this.localize('mapMissingLibrary')}</div>`
          : this.loading
            ? html`
                <span class="sr-only">${this.localize('loading')}</span>
                <lr-skeleton variant="rect" .announce=${false}></lr-skeleton>
              `
            : html`<div part="container" lang=${this.effectiveLocale}></div>`}
        ${this.legend.length
          ? html`<div part="legend">
              ${this.legend.map((entry) => {
                const bg = sanitizeSwatchColor(entry.color);
                return html`<div class="legend-row">
                  <span part="legend-swatch" style=${styleMap(bg ? { background: bg } : {})}></span>
                  <span>${entry.label}</span>
                </div>`;
              })}
            </div>`
          : nothing}
      </div>
    `;
  }
}


declare global {
  interface HTMLElementTagNameMap {
    'lr-map': LyraMap;
  }
}
