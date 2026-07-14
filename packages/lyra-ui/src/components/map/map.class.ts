import { html, nothing, type TemplateResult, type PropertyValues } from 'lit';
import { property, query, state } from 'lit/decorators.js';
import { styleMap } from 'lit/directives/style-map.js';
import type { Feature, FeatureCollection } from 'geojson';
import { LyraElement } from '../../internal/lyra-element.js';
import type { OptionalPeerApi } from '../../internal/optional-peer-types.js';
import { loadMaplibre } from './map-loader.js';
import { styles } from './map.styles.js';
import '../skeleton/skeleton.class.js';

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

export interface MapMarker {
  id?: string;
  lngLat: [number, number];
  color?: string;
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
const DEFAULT_STYLE: OptionalPeerApi = {
  version: 8,
  sources: {
    'lyra-osm': {
      type: 'raster',
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      attribution: '© OpenStreetMap contributors',
    },
  },
  layers: [{ id: 'lyra-osm', type: 'raster', source: 'lyra-osm' }],
};

/**
 * Matches only actual CSS color syntax: hex (`#fff`/`#ffffff`/`#ffffffff`),
 * bare keywords (named colors, `transparent`, `currentColor`), the standard
 * color functions, and `var(--custom-property)` references. Anything else --
 * notably `url(...)`, which is otherwise valid `background` syntax -- is
 * rejected.
 */
const SAFE_SWATCH_COLOR =
  /^(?:#[0-9a-fA-F]{3,8}|[a-zA-Z]+|(?:rgb|rgba|hsl|hsla|hwb|lab|lch|oklab|oklch)\([-+0-9.%,/\s]+\)|var\(--[\w-]+\))$/;

/**
 * Rejects a `LegendEntry.color` that isn't recognizable CSS color syntax --
 * both to stop it breaking out of the single `background` declaration it's
 * assigned to (e.g. `;`, `{`, `}`, which terminate/reopen a declaration) and
 * to stop non-color values such as `url(...)` from being accepted, which
 * `background` also parses and would fetch as soon as the swatch renders.
 * This matters even though the swatch's color is set via Lit's `styleMap`
 * directive (not raw string interpolation): `styleMap`'s first commit for a
 * given attribute part serializes the whole `style` value as a single string
 * (only later updates go through the safe `CSSStyleDeclaration.setProperty()`
 * path), so an unsanitized value could still inject on that first render.
 */
function sanitizeSwatchColor(color: string): string | undefined {
  return SAFE_SWATCH_COLOR.test(color.trim()) ? color : undefined;
}

// Defensive JS-side fallback for choroplethFillOpacity() below, mirroring
// --lyra-map-choropleth-fill-opacity's own default (see map.styles.ts) --
// only reached if getComputedStyle somehow can't resolve the custom
// property at all (e.g. host detached from the document).
const FALLBACK_FILL_OPACITY = 0.75;

/**
 * Reads the current `--lyra-map-choropleth-fill-opacity` custom property so
 * the choropleth fill layer's opacity is retheme-able instead of a literal
 * hardcoded into the maplibre-gl paint expression.
 */
function choroplethFillOpacity(host: Element): number {
  const raw = getComputedStyle(host).getPropertyValue('--lyra-map-choropleth-fill-opacity').trim();
  const parsed = Number.parseFloat(raw);
  return Number.isFinite(parsed) ? parsed : FALLBACK_FILL_OPACITY;
}

export interface LyraMapEventMap {
  'lyra-map-load': CustomEvent<undefined>;
  'lyra-map-click': CustomEvent<{
    lngLat: [number, number];
    feature: Feature | undefined;
  }>;
}
/**
 * `<lyra-map>` — a maplibre-gl wrapper with a declarative legend and
 * choropleth GeoJSON layer, plus a raw `map` escape hatch. Requires the
 * optional peer dep `maplibre-gl` (consumers also import its CSS once).
 *
 * The underlying `maplibregl.Map` — and the WebGL context it opens — isn't
 * constructed until this element is first visible in the viewport (tracked
 * via `IntersectionObserver`), even once the `maplibre-gl` peer dependency
 * has finished loading. Browsers hard-cap concurrent WebGL contexts per
 * page, so a grid/dashboard of many `<lyra-map>` instances only constructs
 * the ones actually on-screen instead of racing to exhaust that budget the
 * instant each one mounts. `map` stays `undefined` (and `lyra-map-load`
 * doesn't fire) until construction actually happens.
 *
 * @customElement lyra-map
 * @event lyra-map-load - Fired once the underlying maplibregl.Map loads.
 * @event lyra-map-click - `detail: { lngLat, feature? }`.
 * @csspart base - The map wrapper.
 * @csspart container - The maplibre container.
 * @csspart legend - The map legend.
 * @csspart legend-swatch - A legend color swatch.
 *
 * ⚠️ The default `mapStyle` (when unset) uses OpenStreetMap's demo tile
 * server, which is not suitable for production traffic — see the
 * `DEFAULT_STYLE` doc comment in `map.ts`. Always pass an explicit
 * `mapStyle` in production.
 */
export class LyraMap extends LyraElement<LyraMapEventMap> {
  static styles = [LyraElement.styles, styles];

  @property({ type: Array }) center: [number, number] = [0, 0];
  @property({ type: Number }) zoom = 2;
  @property({ attribute: false }) mapStyle: OptionalPeerApi | string = DEFAULT_STYLE;
  @property({ attribute: false }) legend: LegendEntry[] = [];
  @property({ attribute: false }) choropleth?: ChoroplethLayer;
  @property({ attribute: false }) markers: MapMarker[] = [];

  /** Accessible name for the map region, applied as `[part="base"]`'s `aria-label` so
   *  screen-reader users get a description of an otherwise purely visual control.
   *  Empty (the default) falls back to the localized `'map'` message. */
  @property() label = '';

  /** True until the lazy-loaded `maplibre-gl` peer dependency has settled (success or failure). */
  @state() private loading = true;

  // Gates the actual `new mod.Map(...)` construction (see `tryConstructMap()`)
  // -- starts `false` so a `<lyra-map>` mounted off-screen doesn't open a
  // WebGL context before it's ever seen, and only flips `true` once the
  // IntersectionObserver below reports this element actually intersecting
  // the viewport. Defaults `true` outright when `IntersectionObserver` isn't
  // available at all (fail open, matching `lyra-chart`'s own fallback)
  // rather than gating construction on an observer that will never fire.
  @state() private visible = typeof IntersectionObserver === 'undefined';
  private intersectionObserver?: IntersectionObserver;

  @query('[part="container"]') private containerEl?: HTMLElement;
  private _map?: OptionalPeerApi;
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
  // Cached once connectedCallback's loadMaplibre().then() resolves, and always
  // set before `_map` itself is (see that closure) -- so any code path gated
  // on `this._map` being truthy can rely on this being set too, without
  // re-awaiting the (already-settled) loadMaplibre() promise.
  private _maplibreModule?: OptionalPeerApi;
  private _markerInstances = new Map<string, OptionalPeerApi>();
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

  /** The raw `maplibregl.Map` instance — escape hatch for anything this wrapper doesn't expose. */
  get map(): OptionalPeerApi | undefined {
    return this._map;
  }

  connectedCallback(): void {
    super.connectedCallback();
    const generation = ++this._connectGeneration;
    // A reconnect always tears the map down in disconnectedCallback() below,
    // so it needs its own fresh visibility read rather than trusting
    // whatever `visible` was left at from before the previous disconnect.
    this.visible = typeof IntersectionObserver === 'undefined';
    if (typeof IntersectionObserver !== 'undefined') {
      this.intersectionObserver = new IntersectionObserver((entries) => {
        if (entries[0]?.isIntersecting) this.visible = true;
      });
      this.intersectionObserver.observe(this);
    }
    void loadMaplibre().then(async (mod) => {
      // A newer connectedCallback (disconnect + reconnect) already
      // superseded this attempt while loadMaplibre()'s cached promise was
      // in flight — bail before touching any state, let the newer attempt's
      // own closure (already queued behind this one on the same promise)
      // take over instead.
      if (generation !== this._connectGeneration) return;
      this.loading = false;
      if (!mod) return;
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

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this._map?.remove();
    this._map = undefined;
    this._styleLoaded = false;
    this._appliedChoroplethSourceId = undefined;
    this._appliedFillLayerId = undefined;
    this.intersectionObserver?.disconnect();
    this.intersectionObserver = undefined;
    for (const marker of this._markerInstances.values()) marker.remove();
    this._markerInstances.clear();
    this._markerColors.clear();
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
    const mod = this._maplibreModule;
    this._map = new mod.Map({
      container: this.containerEl,
      style: this.mapStyle,
      center: this.center,
      zoom: this.zoom,
    });
    this._map.on('load', () => {
      this._styleLoaded = true;
      this.applyChoropleth();
      this.applyMarkers();
      this.emit('lyra-map-load');
    });
    this._map.on('click', (e: OptionalPeerApi) => {
      const fillLayerId = this._appliedFillLayerId;
      const features =
        fillLayerId && this._map!.getLayer(fillLayerId)
          ? this._map!.queryRenderedFeatures(e.point, { layers: [fillLayerId] })
          : [];
      this.emit('lyra-map-click', {
        lngLat: [e.lngLat.lng, e.lngLat.lat],
        feature: features[0],
      });
    });
  }

  protected updated(changed: PropertyValues): void {
    if (this.loading) this.setAttribute('aria-busy', 'true');
    else this.removeAttribute('aria-busy');

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
        this.applyChoropleth();
      });
      this._map.setStyle(this.mapStyle);
    } else if (changed.has('choropleth') && this._styleLoaded) {
      this.applyChoropleth();
    }
    if (changed.has('center') && this._map) this._map.setCenter(this.center);
    if (changed.has('zoom') && this._map) this._map.setZoom(this.zoom);
    if (changed.has('markers') && this._map) this.applyMarkers();
  }

  private applyChoropleth(): void {
    if (!this._map) return;
    if (!this.choropleth) {
      this.removeChoropleth();
      return;
    }
    const { sourceId, geojson, field, stops } = this.choropleth;
    const fillLayerId = `${sourceId}-fill`;

    if (this._appliedChoroplethSourceId && this._appliedChoroplethSourceId !== sourceId) {
      this.removeChoropleth();
    }

    const existingSource = this._map.getSource(sourceId) as OptionalPeerApi | undefined;
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
      // `feature.id` on `lyra-map-click` for the common case. Nothing in this
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
    for (const m of this.markers) {
      let key = m.id;
      if (key == null) {
        const coordKey = `${m.lngLat[0]},${m.lngLat[1]}`;
        const occurrence = coordCounts.get(coordKey) ?? 0;
        coordCounts.set(coordKey, occurrence + 1);
        key = `${coordKey}#${occurrence}`;
      }
      visible.add(key);
      let existing = this._markerInstances.get(key);
      if (existing && this._markerColors.get(key) !== m.color) {
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
        const marker = new mod.Marker(m.color ? { color: m.color } : undefined).setLngLat(m.lngLat);
        if (m.unsafeHtml || m.label) {
          const popup = new mod.Popup({ offset: 12 });
          if (m.unsafeHtml) popup.setHTML(m.unsafeHtml);
          else if (m.label) popup.setText(m.label);
          marker.setPopup(popup);
        }
        marker.addTo(map);
        this._markerInstances.set(key, marker);
        this._markerColors.set(key, m.color);
      } else {
        existing.setLngLat(m.lngLat);
        const popup = existing.getPopup();
        if (m.unsafeHtml) {
          if (popup) popup.setHTML(m.unsafeHtml);
          else existing.setPopup(new mod.Popup({ offset: 12 }).setHTML(m.unsafeHtml));
        } else if (m.label) {
          if (popup) popup.setText(m.label);
          else existing.setPopup(new mod.Popup({ offset: 12 }).setText(m.label));
        } else if (popup) {
          existing.setPopup(undefined);
        }
      }
    }
    for (const [key, marker] of this._markerInstances) {
      if (!visible.has(key)) {
        marker.remove();
        this._markerInstances.delete(key);
        this._markerColors.delete(key);
      }
    }
  }

  render(): TemplateResult {
    // Lit's own whitespace/comment marker nodes around the `${...}` binding mean
    // `[part="legend"]` is never truly `:empty` in CSS even with zero entries, so
    // the panel is omitted from the template entirely when `legend` is empty
    // (same `nothing` pattern `stat.ts` uses to omit its optional trend section)
    // rather than relying on a CSS `:empty` selector that can never match.
    return html`
      <div part="base" aria-label=${this.label || this.localize('map')}>
        ${this.loading
          ? html`<lyra-skeleton variant="rect"></lyra-skeleton>`
          : html`<div part="container"></div>`}
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
    'lyra-map': LyraMap;
  }
}
