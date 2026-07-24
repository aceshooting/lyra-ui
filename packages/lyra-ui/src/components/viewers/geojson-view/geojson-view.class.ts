import { html, type PropertyValues, type TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { TextViewerTarget, type LyraTextViewerTargetEventMap } from '../../../internal/text-viewer-target.js';
import { safeFetchUrl } from '../../../internal/safe-url.js';
import {
  isAbortError,
  isResourceLimitError,
  LyraResourceLimitError,
  LyraUserFacingError,
  readResponseText,
} from '../../../internal/resource-loader.js';
import { getNumberFormat } from '../../../internal/intl-cache.js';
import { srOnly } from '../../../internal/a11y.js';
import { loadMaplibre } from '../../media/map/map-loader.js';
import type { GeoJsonDataLayer } from '../../media/map/map.class.js';

/** The three structural container tags accepted by the GeoJSON bridge. */
export type GeoJsonTypeTag = 'Feature' | 'FeatureCollection' | 'GeometryCollection';

type GeoJsonLike = Record<string, unknown> & { type: string };
type GeometryType =
  | 'Point'
  | 'LineString'
  | 'Polygon'
  | 'MultiPoint'
  | 'MultiLineString'
  | 'MultiPolygon'
  | 'GeometryCollection';
type GeoTask =
  | { kind: 'geo'; value: unknown; depth: number; mode: 'any' | 'feature' | 'geometry' }
  | { kind: 'position' | 'positions' | 'line' | 'ring' | 'polygon' | 'multi-line' | 'multi-polygon'; value: unknown; depth: number };
type CoordinateTaskKind = Exclude<GeoTask['kind'], 'geo'>;
interface GeoBounds {
  minLng: number;
  maxLng: number;
  minShiftedLng: number;
  maxShiftedLng: number;
  minLat: number;
  maxLat: number;
}
interface GeoJsonAnalysis {
  value: GeoJsonLike;
  featureCount: number;
  bounds: GeoBounds | null;
}

const GEOMETRY_TYPES = new Set<GeometryType>([
  'Point',
  'LineString',
  'Polygon',
  'MultiPoint',
  'MultiLineString',
  'MultiPolygon',
  'GeometryCollection',
]);
const MAX_GEOJSON_POSITIONS = 10_000;
const MAX_GEOJSON_NODES = 50_000;
const MAX_GEOJSON_DEPTH = 64;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Validates the complete GeoJSON structure and derives bounds in one bounded iterative pass. It
 * never recursively descends or retains a second coordinate array, so adversarial nesting and
 * large coordinate sets have explicit depth/node/position ceilings before map rendering.
 */
function analyzeGeoJson(value: unknown): GeoJsonAnalysis {
  if (!isRecord(value)) throw new Error('not a GeoJSON object');
  const root = value as GeoJsonLike;
  const tasks: GeoTask[] = [{ kind: 'geo', value, depth: 0, mode: 'any' }];
  let processedNodes = 0;
  let positionCount = 0;
  let bounds: GeoBounds | null = null;

  const pushTask = (task: GeoTask): void => {
    if (task.depth > MAX_GEOJSON_DEPTH) throw new LyraResourceLimitError('The GeoJSON nesting is too deep.');
    if (processedNodes + tasks.length >= MAX_GEOJSON_NODES) {
      throw new LyraResourceLimitError('The GeoJSON contains too many nested values.');
    }
    tasks.push(task);
  };
  const pushArray = (items: unknown[], kind: CoordinateTaskKind, depth: number): void => {
    if (processedNodes + tasks.length + items.length > MAX_GEOJSON_NODES) {
      throw new LyraResourceLimitError('The GeoJSON contains too many nested values.');
    }
    for (let index = items.length - 1; index >= 0; index--) {
      pushTask({ kind, value: items[index], depth });
    }
  };
  const requireArray = (candidate: unknown, minimum = 0): unknown[] => {
    if (!Array.isArray(candidate) || candidate.length < minimum) throw new Error('invalid GeoJSON coordinates');
    return candidate;
  };

  while (tasks.length > 0) {
    const task = tasks.pop()!;
    processedNodes++;
    if (processedNodes > MAX_GEOJSON_NODES) {
      throw new LyraResourceLimitError('The GeoJSON contains too many nested values.');
    }
    if (task.depth > MAX_GEOJSON_DEPTH) throw new LyraResourceLimitError('The GeoJSON nesting is too deep.');

    if (task.kind === 'position') {
      const position = requireArray(task.value, 2);
      if (!position.every((coordinate) => typeof coordinate === 'number' && Number.isFinite(coordinate))) {
        throw new Error('invalid GeoJSON position');
      }
      const [lng, lat] = position as number[];
      if (lng! < -180 || lng! > 180 || lat! < -90 || lat! > 90) throw new Error('invalid GeoJSON position');
      positionCount++;
      if (positionCount > MAX_GEOJSON_POSITIONS) {
        throw new LyraResourceLimitError('The GeoJSON contains too many positions.');
      }
      const shiftedLng = lng! < 0 ? lng! + 360 : lng!;
      if (!bounds) {
        bounds = {
          minLng: lng!,
          maxLng: lng!,
          minShiftedLng: shiftedLng,
          maxShiftedLng: shiftedLng,
          minLat: lat!,
          maxLat: lat!,
        };
      } else {
        bounds.minLng = Math.min(bounds.minLng, lng!);
        bounds.maxLng = Math.max(bounds.maxLng, lng!);
        bounds.minShiftedLng = Math.min(bounds.minShiftedLng, shiftedLng);
        bounds.maxShiftedLng = Math.max(bounds.maxShiftedLng, shiftedLng);
        bounds.minLat = Math.min(bounds.minLat, lat!);
        bounds.maxLat = Math.max(bounds.maxLat, lat!);
      }
      continue;
    }

    if (task.kind === 'positions' || task.kind === 'line' || task.kind === 'ring') {
      const minimum = task.kind === 'ring' ? 4 : task.kind === 'line' ? 2 : 0;
      const positions = requireArray(task.value, minimum);
      if (task.kind === 'ring') {
        const first = positions[0];
        const last = positions[positions.length - 1];
        if (!Array.isArray(first) || !Array.isArray(last) || first.length !== last.length || first.some((item, index) => item !== last[index])) {
          throw new Error('GeoJSON polygon rings must be closed');
        }
      }
      pushArray(positions, 'position', task.depth + 1);
      continue;
    }

    if (task.kind === 'polygon' || task.kind === 'multi-line') {
      const parts = requireArray(task.value);
      pushArray(parts, task.kind === 'polygon' ? 'ring' : 'line', task.depth + 1);
      continue;
    }

    if (task.kind === 'multi-polygon') {
      pushArray(requireArray(task.value), 'polygon', task.depth + 1);
      continue;
    }

    if (task.kind !== 'geo') throw new Error('invalid GeoJSON coordinate structure');
    if (!isRecord(task.value) || typeof task.value['type'] !== 'string') throw new Error('invalid GeoJSON member');
    const member = task.value as GeoJsonLike;
    const type = member['type'];
    if (task.mode === 'feature' && type !== 'Feature') throw new Error('FeatureCollection contains a non-Feature');
    if (task.mode === 'geometry' && !GEOMETRY_TYPES.has(type as GeometryType)) throw new Error('invalid GeoJSON geometry');

    if (type === 'Feature') {
      if (task.mode === 'geometry' || !Object.hasOwn(member, 'geometry') || !Object.hasOwn(member, 'properties')) {
        throw new Error('invalid GeoJSON Feature');
      }
      if (member['properties'] !== null && !isRecord(member['properties'])) throw new Error('invalid GeoJSON Feature properties');
      if (member['geometry'] !== null) {
        pushTask({ kind: 'geo', value: member['geometry'], depth: task.depth + 1, mode: 'geometry' });
      }
      continue;
    }
    if (type === 'FeatureCollection') {
      if (task.mode !== 'any' || !Array.isArray(member['features'])) throw new Error('invalid GeoJSON FeatureCollection');
      for (let index = member['features'].length - 1; index >= 0; index--) {
        pushTask({ kind: 'geo', value: member['features'][index], depth: task.depth + 1, mode: 'feature' });
      }
      continue;
    }
    if (!GEOMETRY_TYPES.has(type as GeometryType)) throw new Error('invalid GeoJSON type');
    if (type === 'GeometryCollection') {
      if (!Array.isArray(member['geometries'])) throw new Error('invalid GeoJSON GeometryCollection');
      for (let index = member['geometries'].length - 1; index >= 0; index--) {
        pushTask({ kind: 'geo', value: member['geometries'][index], depth: task.depth + 1, mode: 'geometry' });
      }
      continue;
    }
    if (!Object.hasOwn(member, 'coordinates')) throw new Error('GeoJSON geometry has no coordinates');
    const coordinateKind: Record<Exclude<GeometryType, 'GeometryCollection'>, CoordinateTaskKind> = {
      Point: 'position',
      LineString: 'line',
      Polygon: 'polygon',
      MultiPoint: 'positions',
      MultiLineString: 'multi-line',
      MultiPolygon: 'multi-polygon',
    };
    pushTask({
      kind: coordinateKind[type as Exclude<GeometryType, 'GeometryCollection'>],
      value: member['coordinates'],
      depth: task.depth + 1,
    });
  }

  const count = root['type'] === 'FeatureCollection' && Array.isArray(root['features']) ? root['features'].length : 1;
  return { value: root, featureCount: count, bounds };
}

/** Web-Mercator-fit approximation with padding -- fits `bbox` into a viewport without needing a
 *  loaded `maplibregl.Map` instance to ask (this bridge computes `center`/`zoom` before the map
 *  exists). Latitude span is weighted ~2x to roughly account for Mercator's pole-ward compression. */
function fitBboxToView(bounds: GeoBounds): { center: [number, number]; zoom: number } {
  const standardSpan = bounds.maxLng - bounds.minLng;
  const shiftedSpan = bounds.maxShiftedLng - bounds.minShiftedLng;
  const crossesAntimeridian = shiftedSpan < standardSpan;
  let centerLng = crossesAntimeridian
    ? (bounds.minShiftedLng + bounds.maxShiftedLng) / 2
    : (bounds.minLng + bounds.maxLng) / 2;
  if (centerLng > 180) centerLng -= 360;
  const center: [number, number] = [centerLng, (bounds.minLat + bounds.maxLat) / 2];
  const lngSpan = Math.max(crossesAntimeridian ? shiftedSpan : standardSpan, 0.0001);
  const latSpan = Math.max(bounds.maxLat - bounds.minLat, 0.0001);
  const span = Math.max(lngSpan, latSpan * 2) * 1.4; // 40% padding so the shape doesn't touch the edges
  const zoom = Math.max(0, Math.min(18, Math.floor(Math.log2(360 / span))));
  return { center, zoom };
}

type GeojsonViewState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'loaded'; value: GeoJsonLike; featureCount: number; center: [number, number]; zoom: number; peerAvailable: boolean }
  | { kind: 'error'; message: string };

export interface LyraGeojsonViewEventMap extends LyraTextViewerTargetEventMap {
  'lr-render-error': CustomEvent<{ error: unknown }>;
}

class LyraGeojsonViewBase extends LyraElement<LyraGeojsonViewEventMap> {}

/**
 * `<lr-geojson-view>` — internal document-registry bridge rendering a fetched GeoJSON file through
 * `<lr-map>`'s `dataLayers`. Not a documented public tag: excluded from README/llms family tables,
 * present in the generated manifest since a defined custom element is technically reachable.
 *
 * @customElement lr-geojson-view
 * @event lr-render-error - Fetch, parse, or shape-validation failure. `detail: { error }`.
 * @csspart base - The root container.
 * @csspart status - The feature-count status line.
 * @csspart missing-library - The missing-maplibre-gl callout shown alongside the json-viewer fallback.
 * @csspart error - The error region.
 * @csspart spinner - The loading status region.
 */
export class LyraGeojsonView extends TextViewerTarget(LyraGeojsonViewBase) {
  static override styles = [LyraElement.styles, srOnly];

  @property() src = '';
  @property() name = '';
  /** Shared search/anchor surface for rendered feature metadata and status text. */
  override async search(query: string): Promise<number> { return super.search(query); }
  override async searchNext(): Promise<boolean> { return super.searchNext(); }
  override async searchPrevious(): Promise<boolean> { return super.searchPrevious(); }
  override clearSearch(): void { super.clearSearch(); }

  @state() private loadState: GeojsonViewState = { kind: 'idle' };
  private generation = 0;
  private lastLoadSrc = '';

  /** @internal test-only hook forcing the missing-peer fallback path without needing to actually
   *  uninstall `maplibre-gl` in this test environment. */
  forceMissingMaplibreForTesting = false;

  protected textContentRoot(): Element | null {
    return this.renderRoot.querySelector('[part="base"]');
  }

  private stopChildEvent(event: Event): void {
    event.stopPropagation();
  }

  override connectedCallback(): void {
    super.connectedCallback();
    if (this.hasUpdated && this.src.trim() && this.src === this.lastLoadSrc) {
      this.scheduleAfterUpdate(() => { void this.load(); });
    }
  }

  override disconnectedCallback(): void {
    this.generation++;
    this.loadState = { kind: 'idle' };
    super.disconnectedCallback();
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    if (changed.has('src')) this.scheduleAfterUpdate(() => { void this.load(); });
  }

  private async load(): Promise<void> {
    const generation = ++this.generation;
    const signal = this.beginAbortableLoad();
    this.lastLoadSrc = this.src;
    if (!this.src) { this.loadState = { kind: 'idle' }; return; }
    const url = safeFetchUrl(this.src);
    if (!url) {
      this.failWithLocalizedMessage(this.localize('documentPreviewUrlNotAllowed'));
      return;
    }
    this.loadState = { kind: 'loading' };
    try {
      const response = await fetch(url, signal ? { signal } : undefined);
      if (!this.isConnected || generation !== this.generation) return;
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
      const text = await readResponseText(response);
      if (!this.isConnected || generation !== this.generation) return;
      const parsed: unknown = JSON.parse(text);
      const analysis = analyzeGeoJson(parsed);
      const { center, zoom } = analysis.bounds
        ? fitBboxToView(analysis.bounds)
        : { center: [0, 0] as [number, number], zoom: 1 };
      const maplibre = this.forceMissingMaplibreForTesting ? null : await loadMaplibre();
      if (!this.isConnected || generation !== this.generation) return;
      this.loadState = {
        kind: 'loaded',
        value: analysis.value,
        featureCount: analysis.featureCount,
        center,
        zoom,
        peerAvailable: maplibre !== null,
      };
      if (!maplibre) {
        this.emit('lr-render-error', {
          error: new LyraUserFacingError(this.localize('geojsonViewMissingMapLibrary')),
        });
      }
    } catch (error) {
      if (isAbortError(error) || !this.isConnected || generation !== this.generation) return;
      this.loadState = { kind: 'error', message: this.localize(isResourceLimitError(error) ? 'documentPreviewResourceTooLarge' : 'geojsonViewInvalid') };
      this.emit('lr-render-error', { error });
    }
  }

  private failWithLocalizedMessage(message: string): void {
    const error = new LyraUserFacingError(message);
    this.loadState = { kind: 'error', message };
    this.emit('lr-render-error', { error });
  }

  private renderBody(): TemplateResult {
    switch (this.loadState.kind) {
      case 'loaded': {
        const { value, featureCount, center, zoom, peerAvailable } = this.loadState;
        const statusText = this.localize(
          featureCount === 1 ? 'geojsonViewFeatureCount' : 'geojsonViewFeatureCountPlural',
          undefined,
          { count: getNumberFormat(this.effectiveLocale).format(featureCount) },
        );
        if (!peerAvailable) {
          return html`
            <p part="missing-library">${this.localize('geojsonViewMissingMapLibrary')}</p>
            <lr-json-viewer
              .data=${value}
              collapsed-depth="2"
              @lr-copy=${this.stopChildEvent}
              @lr-search-change=${this.stopChildEvent}
            ></lr-json-viewer>
          `;
        }
        const dataLayers: GeoJsonDataLayer[] = [{ sourceId: 'lr-geojson', geojson: value as never }];
        const label = this.getAttribute('aria-label') || this.name || this.localize('geojsonViewLabel');
        return html`
          <div part="status" role="status">${statusText}</div>
          <lr-map
            .center=${center}
            .zoom=${zoom}
            .dataLayers=${dataLayers}
            label=${label}
            @lr-map-load=${this.stopChildEvent}
            @lr-map-click=${this.stopChildEvent}
          ></lr-map>
        `;
      }
      case 'loading':
        return html`<div part="spinner" role="status"><lr-skeleton variant="rect" label=${this.localize('loadingDocument')}></lr-skeleton></div>`;
      case 'error':
        return html`<div part="error" role="alert">${this.loadState.message}</div>`;
      case 'idle':
      default:
        return html`<p>${this.localize('documentPreviewEmpty', undefined, { type: this.localize('documentPreviewTypeDocument') })}</p>`;
    }
  }

  override render(): TemplateResult {
    return html`<div part="base" role="region" aria-label=${this.getAttribute('aria-label') || this.name || this.localize('geojsonViewLabel')}>${this.renderBody()}${this.renderAnchorLiveRegion()}</div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-geojson-view': LyraGeojsonView;
  }
}
