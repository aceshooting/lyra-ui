/// <reference types="geojson" />
import { html, type TemplateResult, type PropertyValues } from 'lit';
import { property, query } from 'lit/decorators.js';
import type { GeoJSONSource, Map as MaplibreMap, StyleSpecification } from 'maplibre-gl';
import { LyraElement } from '../../internal/lyra-element.js';
import { defineElement } from '../../internal/prefix.js';
import { loadMaplibre } from './map-loader.js';
import { styles } from './map.styles.js';

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

  @query('[part="container"]') private containerEl?: HTMLElement;
  private _map?: MaplibreMap;
  // Tracks whether the style has fired its initial 'load' (i.e. addSource/
  // addLayer/setPaintProperty are now safe to call), rather than re-querying
  // `this._map.isStyleLoaded()`: that also reflects in-flight *tile* loading
  // for every source, so it flips back to `false` as soon as the choropleth's
  // own GeoJSON source is added — which would wrongly block subsequent
  // choropleth updates from ever re-running.
  private _styleLoaded = false;

  /** The raw `maplibregl.Map` instance — escape hatch for anything this wrapper doesn't expose. */
  get map(): MaplibreMap | undefined {
    return this._map;
  }

  connectedCallback(): void {
    super.connectedCallback();
    void loadMaplibre().then((mod) => {
      if (!mod || !this.containerEl) return;
      this._map = new mod.Map({
        container: this.containerEl,
        style: this.mapStyle,
        center: this.center,
        zoom: this.zoom,
      });
      this._map.on('load', () => {
        this._styleLoaded = true;
        this.applyChoropleth();
        this.emit('lyra-map-load');
      });
      this._map.on('click', (e) => {
        const features = this.choropleth
          ? this._map!.queryRenderedFeatures(e.point, { layers: [`${this.choropleth.sourceId}-fill`] })
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
  }

  protected updated(changed: PropertyValues): void {
    if (changed.has('choropleth') && this._styleLoaded) this.applyChoropleth();
    if (changed.has('center') && this._map) this._map.setCenter(this.center);
    if (changed.has('zoom') && this._map) this._map.setZoom(this.zoom);
  }

  private applyChoropleth(): void {
    if (!this.choropleth || !this._map) return;
    const { sourceId, geojson, field, stops } = this.choropleth;
    const fillLayerId = `${sourceId}-fill`;
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
  }

  render(): TemplateResult {
    return html`
      <div part="base">
        <div part="container"></div>
        <div part="legend">
          ${this.legend.map(
            (entry) => html`<div class="legend-row">
              <span part="legend-swatch" style=${`background:${entry.color}`}></span>
              <span>${entry.label}</span>
            </div>`,
          )}
        </div>
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
