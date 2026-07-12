/// <reference types="geojson" />
import { html, nothing, type TemplateResult, type PropertyValues } from 'lit';
import { property, query, state } from 'lit/decorators.js';
import type { GeoJSONSource, Map as MaplibreMap, StyleSpecification } from 'maplibre-gl';
import { LyraElement } from '../../internal/lyra-element.js';
import { defineElement } from '../../internal/prefix.js';
import { loadMaplibre } from './map-loader.js';
import { styles } from './map.styles.js';
import '../skeleton/skeleton.js';

export interface LegendEntry {
  color: string;
  label: string;
}

export interface ChoroplethLayer {
  sourceId: string;
  geojson: GeoJSON.FeatureCollection;
  field: string;
  stops: [number, string][];
}

export interface MapMarker {
  id?: string;
  lngLat: [number, number];
  color?: string;
  label?: string;
  html?: string;
}

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
 * `<lyra-map>` — a maplibre-gl wrapper with a declarative legend and
 * choropleth GeoJSON layer, plus a raw `map` escape hatch. Requires the
 * optional peer dep `maplibre-gl` (consumers also import its CSS once).
 *
 * @customElement lyra-map
 * @event lyra-map-load - Fired once the underlying maplibregl.Map loads.
 * @event lyra-map-click - `detail: { lngLat, feature? }`.
 * @csspart base, container, legend, legend-swatch
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
  private _maplibreModule: any;
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
      this._map.setStyle(this.mapStyle);
      this._map.once('style.load', () => {
        this._styleLoaded = true;
        this.applyChoropleth();
      });
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

    const colorExpr: unknown[] = ['interpolate', ['linear'], ['get', field]];
    for (const [value, color] of stops) colorExpr.push(value, color);

    const existingSource = this._map.getSource(sourceId) as GeoJSONSource | undefined;
    if (existingSource) {
      // Re-apply both the data and the color expression: `field`/`stops` may have
      // changed even though `sourceId` didn't (e.g. switching which metric colors
      // the same GeoJSON), so the paint property must be refreshed too.
      existingSource.setData(geojson);
      this._map.setPaintProperty(fillLayerId, 'fill-color', colorExpr as never);
    } else {
      this._map.addSource(sourceId, { type: 'geojson', data: geojson, promoteId: 'id' });
      this._map.addLayer({
        id: fillLayerId,
        type: 'fill',
        source: sourceId,
        paint: { 'fill-color': colorExpr as never, 'fill-opacity': 0.75 },
      });
    }
    this._appliedChoroplethSourceId = sourceId;
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

  private async applyMarkers(): Promise<void> {
    if (!this._map) return;
    const mod = await loadMaplibre();
    if (!mod) return;
    const visible = new Set<string>();
    for (const m of this.markers) {
      const key = m.id ?? `${m.lngLat[0]},${m.lngLat[1]}`;
      visible.add(key);
      const existing = this._markerInstances.get(key);
      if (!existing) {
        const marker = new (mod as any).Marker(m.color ? { color: m.color } : undefined).setLngLat(
          m.lngLat,
        );
        if (m.html || m.label) {
          const popup = new (mod as any).Popup({ offset: 12 });
          if (m.html) popup.setHTML(m.html);
          else if (m.label) popup.setText(m.label);
          marker.setPopup(popup);
        }
        marker.addTo(this._map);
        this._markerInstances.set(key, marker);
      } else {
        existing.setLngLat(m.lngLat);
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
              ${this.legend.map(
                (entry) => html`<div class="legend-row">
                  <span part="legend-swatch" style=${`background:${entry.color}`}></span>
                  <span>${entry.label}</span>
                </div>`,
              )}
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
