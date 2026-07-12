/// <reference types="geojson" />
import { html, nothing, type TemplateResult, type PropertyValues } from 'lit';
import { property, query, state } from 'lit/decorators.js';
import { styleMap } from 'lit/directives/style-map.js';
import type { GeoJSONSource, Map as MaplibreMap, StyleSpecification } from 'maplibre-gl';
import type * as MaplibreGL from 'maplibre-gl';
import { LyraElement } from '../../internal/lyra-element.js';
import { defineElement } from '../../internal/prefix.js';
import { loadMaplibre } from './map-loader.js';
import { styles } from './map.styles.js';
import '../skeleton/skeleton.js';

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
  geojson: GeoJSON.FeatureCollection;
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
   * included. Only ever pass trusted content; sanitize anything derived
   * from user input before assigning it here.
   */
  html?: string;
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
const DEFAULT_STYLE: StyleSpecification = {
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

/**
 * `<lyra-map>` — a maplibre-gl wrapper with a declarative legend and
 * choropleth GeoJSON layer, plus a raw `map` escape hatch. Requires the
 * optional peer dep `maplibre-gl` (consumers also import its CSS once).
 *
 * @customElement lyra-map
 * @event lyra-map-load - Fired once the underlying maplibregl.Map loads.
 * @event lyra-map-click - `detail: { lngLat, feature? }`.
 * @csspart base, container, legend, legend-swatch
 *
 * ⚠️ The default `mapStyle` (when unset) uses OpenStreetMap's demo tile
 * server, which is not suitable for production traffic — see the
 * `DEFAULT_STYLE` doc comment in `map.ts`. Always pass an explicit
 * `mapStyle` in production.
 */
export class LyraMap extends LyraElement {
  static styles = [LyraElement.styles, styles];

  @property({ type: Array }) center: [number, number] = [0, 0];
  @property({ type: Number }) zoom = 2;
  @property({ attribute: false }) mapStyle: StyleSpecification | string = DEFAULT_STYLE;
  @property({ attribute: false }) legend: LegendEntry[] = [];
  @property({ attribute: false }) choropleth?: ChoroplethLayer;
  @property({ attribute: false }) markers: MapMarker[] = [];

  /** True until the lazy-loaded `maplibre-gl` peer dependency has settled (success or failure). */
  @state() private loading = true;

  @query('[part="container"]') private containerEl?: HTMLElement;
  private _map?: MaplibreMap;
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
  // this class of bug entirely, but that's a larger redesign — tracked as a
  // possible v2 option.
  private _appliedChoroplethSourceId?: string;
  private _appliedFillLayerId?: string;
  // Cached once connectedCallback's loadMaplibre().then() resolves, and always
  // set before `_map` itself is (see that closure) -- so any code path gated
  // on `this._map` being truthy can rely on this being set too, without
  // re-awaiting the (already-settled) loadMaplibre() promise.
  private _maplibreModule?: typeof MaplibreGL;
  private _markerInstances = new Map<string, import('maplibre-gl').Marker>();
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
  get map(): MaplibreMap | undefined {
    return this._map;
  }

  connectedCallback(): void {
    super.connectedCallback();
    const generation = ++this._connectGeneration;
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
      this._map.on('click', (e) => {
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
    });
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this._map?.remove();
    this._map = undefined;
    this._styleLoaded = false;
    this._appliedChoroplethSourceId = undefined;
    this._appliedFillLayerId = undefined;
    for (const marker of this._markerInstances.values()) marker.remove();
    this._markerInstances.clear();
  }

  protected updated(changed: PropertyValues): void {
    if (this.loading) this.setAttribute('aria-busy', 'true');
    else this.removeAttribute('aria-busy');

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

    const existingSource = this._map.getSource(sourceId) as GeoJSONSource | undefined;
    if (existingSource) {
      // Re-apply the data even if the color expression below ends up skipped:
      // `geojson` may have changed even though `sourceId`/`stops` didn't.
      existingSource.setData(geojson);
    } else {
      this._map.addSource(sourceId, { type: 'geojson', data: geojson, promoteId: 'id' });
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
        paint: { 'fill-color': colorExpr as never, 'fill-opacity': 0.75 },
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
    for (const m of this.markers) {
      const key = m.id ?? `${m.lngLat[0]},${m.lngLat[1]}`;
      visible.add(key);
      const existing = this._markerInstances.get(key);
      if (!existing) {
        const marker = new mod.Marker(m.color ? { color: m.color } : undefined).setLngLat(m.lngLat);
        if (m.html || m.label) {
          const popup = new mod.Popup({ offset: 12 });
          if (m.html) popup.setHTML(m.html);
          else if (m.label) popup.setText(m.label);
          marker.setPopup(popup);
        }
        marker.addTo(map);
        this._markerInstances.set(key, marker);
      } else {
        existing.setLngLat(m.lngLat);
        const popup = existing.getPopup();
        if (m.html) {
          if (popup) popup.setHTML(m.html);
          else existing.setPopup(new mod.Popup({ offset: 12 }).setHTML(m.html));
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
      <div part="base">
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

defineElement('map', LyraMap);

declare global {
  interface HTMLElementTagNameMap {
    'lyra-map': LyraMap;
  }
}
