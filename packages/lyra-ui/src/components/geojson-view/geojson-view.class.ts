import { html, type PropertyValues, type TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import { LyraElement } from '../../internal/lyra-element.js';
import { safeFetchUrl } from '../../internal/safe-url.js';
import { isAbortError, isResourceLimitError, readResponseText } from '../../internal/resource-loader.js';
import { srOnly } from '../../internal/a11y.js';
import { loadMaplibre } from '../map/map-loader.js';
import type { GeoJsonDataLayer } from '../map/map.class.js';
import '../map/map.js';
import '../json-viewer/json-viewer.js';
import '../skeleton/skeleton.js';

type GeoJsonLike = { type: string; coordinates?: unknown; geometry?: GeoJsonLike; geometries?: GeoJsonLike[]; features?: { geometry?: GeoJsonLike }[] };

const GEOMETRY_TYPES = ['Feature', 'FeatureCollection', 'Point', 'LineString', 'Polygon', 'MultiPoint', 'MultiLineString', 'MultiPolygon', 'GeometryCollection'];

function isValidGeoJson(value: unknown): value is GeoJsonLike {
  if (typeof value !== 'object' || value === null) return false;
  return GEOMETRY_TYPES.includes((value as { type?: unknown }).type as string);
}

function featureCount(value: GeoJsonLike): number {
  if (value.type === 'FeatureCollection') return value.features?.length ?? 0;
  return 1;
}

function collectCoordinates(geom: GeoJsonLike | undefined, out: [number, number][]): void {
  if (!geom) return;
  if (geom.type === 'GeometryCollection') {
    geom.geometries?.forEach((g) => collectCoordinates(g, out));
    return;
  }
  const walk = (coords: unknown): void => {
    if (Array.isArray(coords) && typeof coords[0] === 'number') out.push([coords[0] as number, coords[1] as number]);
    else if (Array.isArray(coords)) coords.forEach(walk);
  };
  if (geom.coordinates !== undefined) walk(geom.coordinates);
}

function computeBbox(value: GeoJsonLike): [number, number, number, number] | null {
  const points: [number, number][] = [];
  if (value.type === 'FeatureCollection') value.features?.forEach((f) => collectCoordinates(f.geometry, points));
  else if (value.type === 'Feature') collectCoordinates(value.geometry, points);
  else collectCoordinates(value, points);
  if (!points.length) return null;
  let minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity;
  for (const [lng, lat] of points) {
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
  }
  return [minLng, minLat, maxLng, maxLat];
}

/** Web-Mercator-fit approximation with padding -- fits `bbox` into a viewport without needing a
 *  loaded `maplibregl.Map` instance to ask (this bridge computes `center`/`zoom` before the map
 *  exists). Latitude span is weighted ~2x to roughly account for Mercator's pole-ward compression. */
function fitBboxToView(bbox: [number, number, number, number]): { center: [number, number]; zoom: number } {
  const [minLng, minLat, maxLng, maxLat] = bbox;
  const center: [number, number] = [(minLng + maxLng) / 2, (minLat + maxLat) / 2];
  const lngSpan = Math.max(maxLng - minLng, 0.0001);
  const latSpan = Math.max(maxLat - minLat, 0.0001);
  const span = Math.max(lngSpan, latSpan * 2) * 1.4; // 40% padding so the shape doesn't touch the edges
  const zoom = Math.max(0, Math.min(18, Math.floor(Math.log2(360 / span))));
  return { center, zoom };
}

type GeojsonViewState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'loaded'; value: GeoJsonLike; center: [number, number]; zoom: number; peerAvailable: boolean }
  | { kind: 'error'; message: string };

export interface LyraGeojsonViewEventMap {
  'lyra-render-error': CustomEvent<{ error: unknown }>;
}

/**
 * `<lyra-geojson-view>` — internal document-registry bridge rendering a fetched GeoJSON file through
 * `<lyra-map>`'s `dataLayers`. Not a documented public tag: excluded from README/llms family tables,
 * present in the generated manifest since a defined custom element is technically reachable.
 *
 * @customElement lyra-geojson-view
 * @event lyra-render-error - Fetch, parse, or shape-validation failure. `detail: { error }`.
 * @csspart base - The root container.
 * @csspart status - The feature-count status line.
 * @csspart missing-library - The missing-maplibre-gl callout shown alongside the json-viewer fallback.
 * @csspart error - The error region.
 * @csspart spinner - The loading status region.
 */
export class LyraGeojsonView extends LyraElement<LyraGeojsonViewEventMap> {
  static styles = [LyraElement.styles, srOnly];

  @property() src = '';
  @property() name = '';

  @state() private loadState: GeojsonViewState = { kind: 'idle' };
  private generation = 0;

  /** @internal test-only hook forcing the missing-peer fallback path without needing to actually
   *  uninstall `maplibre-gl` in this test environment. */
  forceMissingMaplibreForTesting = false;

  protected updated(changed: PropertyValues): void {
    if (changed.has('src')) this.scheduleAfterUpdate(() => { void this.load(); });
  }

  private async load(): Promise<void> {
    const generation = ++this.generation;
    const signal = this.beginAbortableLoad();
    if (!this.src) { this.loadState = { kind: 'idle' }; return; }
    const url = safeFetchUrl(this.src);
    if (!url) { this.loadState = { kind: 'error', message: this.localize('documentPreviewUrlNotAllowed') }; return; }
    this.loadState = { kind: 'loading' };
    try {
      const response = await fetch(url, signal ? { signal } : undefined);
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
      const text = await readResponseText(response);
      if (!this.isConnected || generation !== this.generation) return;
      const parsed: unknown = JSON.parse(text);
      if (!isValidGeoJson(parsed)) throw new Error('not a valid GeoJSON Feature/FeatureCollection/geometry');
      const bbox = computeBbox(parsed);
      const { center, zoom } = bbox ? fitBboxToView(bbox) : { center: [0, 0] as [number, number], zoom: 1 };
      const maplibre = this.forceMissingMaplibreForTesting ? null : await loadMaplibre();
      if (!this.isConnected || generation !== this.generation) return;
      this.loadState = { kind: 'loaded', value: parsed, center, zoom, peerAvailable: maplibre !== null };
    } catch (error) {
      if (isAbortError(error) || !this.isConnected || generation !== this.generation) return;
      this.loadState = { kind: 'error', message: this.localize(isResourceLimitError(error) ? 'documentPreviewResourceTooLarge' : 'geojsonViewInvalid') };
      this.emit('lyra-render-error', { error });
    }
  }

  private renderBody(): TemplateResult {
    switch (this.loadState.kind) {
      case 'loaded': {
        const { value, center, zoom, peerAvailable } = this.loadState;
        const count = featureCount(value);
        const statusText = this.localize(count === 1 ? 'geojsonViewFeatureCount' : 'geojsonViewFeatureCountPlural', undefined, { count });
        if (!peerAvailable) {
          return html`
            <p part="missing-library">${this.localize('geojsonViewMissingMapLibrary')}</p>
            <lyra-json-viewer .data=${value} collapsed-depth="2"></lyra-json-viewer>
          `;
        }
        const dataLayers: GeoJsonDataLayer[] = [{ sourceId: 'lyra-geojson', geojson: value as never }];
        return html`
          <div part="status" role="status">${statusText}</div>
          <lyra-map .center=${center} .zoom=${zoom} .dataLayers=${dataLayers} label=${this.name || this.localize('geojsonViewLabel')}></lyra-map>
        `;
      }
      case 'loading':
        return html`<div part="spinner" role="status"><lyra-skeleton variant="rect" label=${this.localize('loadingDocument')}></lyra-skeleton></div>`;
      case 'error':
        return html`<div part="error" role="alert">${this.loadState.message}</div>`;
      case 'idle':
      default:
        return html`<p>${this.localize('documentPreviewEmpty', undefined, { type: this.localize('documentPreviewTypeDocument') })}</p>`;
    }
  }

  render(): TemplateResult {
    return html`<div part="base" aria-label=${this.name || this.localize('geojsonViewLabel')}>${this.renderBody()}</div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lyra-geojson-view': LyraGeojsonView;
  }
}
