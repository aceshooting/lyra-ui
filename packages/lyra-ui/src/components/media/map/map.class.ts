import { html, nothing, type TemplateResult, type PropertyValues } from 'lit';
import { property, query, state } from 'lit/decorators.js';
import { styleMap } from 'lit/directives/style-map.js';
import type { Feature, FeatureCollection } from 'geojson';
import { LyraElement } from '../../../internal/lyra-element.js';
import { devWarnOnce } from '../../../internal/dev-mode-attribute-warning.js';
import { sanitizeCssColor } from '../../../internal/safe-css.js';
import { finiteRange } from '../../../internal/numbers.js';
import { getNumberFormat } from '../../../internal/intl-cache.js';
import { notifyMapCanvasReady } from '../../../internal/map-canvas-ready.js';
import { acquireAnnouncementSink, type AnnouncementSink } from '../../../internal/announcer.js';
import { srOnly } from '../../../internal/a11y.js';
import { ThemeWatcher } from '../../../internal/theme-watcher.js';
import {
  loadMaplibre,
  type MapLibreGeoJsonDiff,
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
import { LYRA_DEFAULT_close, LYRA_DEFAULT_items, LYRA_DEFAULT_loading, LYRA_DEFAULT_map, LYRA_DEFAULT_mapInitializationFailed, LYRA_DEFAULT_mapLegend, LYRA_DEFAULT_mapMissingLibrary, LYRA_DEFAULT_mapStyleRequired, LYRA_DEFAULT_mapWebglUnavailable, LYRA_DEFAULT_paginationSummary } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END


/** Probes for a real WebGL2 context without ever touching maplibre-gl's own (unreliable) failure
 *  path -- see the call site in `tryConstructMap()`. */
function supportsWebGL2(host: Element): boolean {
  try {
    return host.ownerDocument.createElement('canvas').getContext('webgl2') !== null;
  } catch {
    return false;
  }
}

type MapFailureReason =
  | 'missing-peer'
  | 'style-required'
  | 'webgl-unavailable'
  | 'initialization-failed';

function hasMapStyle(style: LyraMapStyleSpecification | string | undefined): boolean {
  return typeof style === 'string' ? style.trim().length > 0 : style !== undefined;
}

/** Non-color encoding retained when a legend entry's authored color is unavailable. */
export type LyraMapLegendPattern = 'solid' | 'diagonal' | 'dots' | 'crosshatch';

/** One immutable, bounded map-legend row. Pattern is required so color is never the sole cue. */
export interface LyraMapLegendEntry {
  readonly color: string;
  readonly label: string;
  readonly pattern: LyraMapLegendPattern;
}

/**
 * One `[value, color]` stop of a continuous legend ramp — deliberately the same shape as
 * `LyraMapChoroplethLayer['stops']`, so a consumer passes the choropleth's own stops straight
 * through instead of maintaining a second copy that drifts from the layer it describes.
 */
export type LyraMapLegendGradientStop = readonly [number, string];

/** Upper bound on rendered gradient stops, matching the deterministic-truncation pattern
 *  `MAX_MAP_MARKERS`/`MAX_MAP_DATA_LAYERS` use below. A ramp needs a handful of stops; anything
 *  past this is a data bug, and an unbounded loop here would build a pathological gradient. */
const MAX_MAP_LEGEND_GRADIENT_STOPS = 64;

/**
 * Keeps only finite-value stops carrying a color CSS actually accepts, sorted ascending by value
 * and bounded. Returns an empty array when fewer than two usable stops survive: a one-stop
 * "gradient" is a flat block that describes nothing, so it falls back to rendering no bar at all
 * rather than a misleading solid one.
 */
function normalizeMapLegendGradient(
  value: unknown,
): readonly (readonly [number, string])[] {
  if (!Array.isArray(value)) return [];
  const usable: (readonly [number, string])[] = [];
  const scanCount = Math.min(value.length, MAX_MAP_LEGEND_GRADIENT_STOPS);
  for (let index = 0; index < scanCount; index += 1) {
    const stop: unknown = value[index];
    if (!Array.isArray(stop) || stop.length < 2) continue;
    const [rawValue, rawColor] = stop as [unknown, unknown];
    if (typeof rawValue !== 'number' || !Number.isFinite(rawValue)) continue;
    if (typeof rawColor !== 'string') continue;
    const color = sanitizeCssColor(rawColor);
    if (!color) continue;
    usable.push([rawValue, color] as const);
  }
  if (usable.length < 2) return [];
  return Object.freeze(
    [...usable].sort((a, b) => a[0] - b[0]),
  ) as readonly (readonly [number, string])[];
}

/** Observable result of normalizing the latest `legend` assignment. */
export interface LyraMapLegendProjection {
  readonly inputCount: number;
  readonly renderedCount: number;
  readonly omittedCount: number;
  readonly truncatedLabelCount: number;
  readonly truncated: boolean;
}

interface NormalizedMapLegend {
  readonly entries: readonly LyraMapLegendEntry[];
  readonly projection: LyraMapLegendProjection;
}

const MAP_LEGEND_ITEM_LIMIT = 100;
const MAP_LEGEND_SCAN_LIMIT = 1_000;
const MAP_LEGEND_LABEL_LIMIT = 256;
const MAP_LEGEND_TOTAL_LABEL_LIMIT = 8_192;
const MAP_LEGEND_COLOR_LIMIT = 256;
const MAP_LEGEND_PATTERNS = new Set<LyraMapLegendPattern>([
  'solid',
  'diagonal',
  'dots',
  'crosshatch',
]);
const EMPTY_MAP_LEGEND = Object.freeze([]) as readonly LyraMapLegendEntry[];
const EMPTY_MAP_LEGEND_PROJECTION: LyraMapLegendProjection = Object.freeze({
  inputCount: 0,
  renderedCount: 0,
  omittedCount: 0,
  truncatedLabelCount: 0,
  truncated: false,
});

function boundedLegendText(value: string, limit: number): string {
  return value.length <= limit ? value : `${value.slice(0, Math.max(0, limit - 1))}…`;
}

function normalizeMapLegend(value: unknown): NormalizedMapLegend {
  let input: readonly unknown[];
  try {
    input = Array.isArray(value) ? value : [];
  } catch {
    input = [];
  }
  let inputCount = 0;
  try {
    inputCount = Math.max(0, Math.min(Number.MAX_SAFE_INTEGER, input.length));
  } catch {
    inputCount = 0;
  }

  const entries: LyraMapLegendEntry[] = [];
  let labelCharacters = 0;
  let truncatedLabelCount = 0;
  const scanCount = Math.min(inputCount, MAP_LEGEND_SCAN_LIMIT);
  for (let index = 0; index < scanCount && entries.length < MAP_LEGEND_ITEM_LIMIT; index++) {
    try {
      const candidate = input[index] as {
        color?: unknown;
        label?: unknown;
        pattern?: unknown;
      } | null;
      if (!candidate || typeof candidate !== 'object') continue;
      const rawColor = candidate.color;
      const rawLabel = candidate.label;
      const rawPattern = candidate.pattern;
      if (
        typeof rawColor !== 'string' ||
        typeof rawLabel !== 'string' ||
        typeof rawPattern !== 'string' ||
        !MAP_LEGEND_PATTERNS.has(rawPattern as LyraMapLegendPattern)
      ) continue;

      const remaining = MAP_LEGEND_TOTAL_LABEL_LIMIT - labelCharacters;
      if (remaining <= 0) break;
      const labelLimit = Math.min(MAP_LEGEND_LABEL_LIMIT, remaining);
      const label = boundedLegendText(rawLabel, labelLimit);
      if (!label.trim()) continue;
      if (rawLabel.length > labelLimit) truncatedLabelCount++;
      labelCharacters += label.length;
      entries.push(Object.freeze({
        color: rawColor.slice(0, MAP_LEGEND_COLOR_LIMIT),
        label,
        pattern: rawPattern as LyraMapLegendPattern,
      }));
    } catch {
      // A hostile record is omitted without preventing later valid entries from rendering.
    }
  }

  const frozenEntries = entries.length ? Object.freeze(entries) : EMPTY_MAP_LEGEND;
  const omittedCount = Math.max(0, inputCount - frozenEntries.length);
  const projection: LyraMapLegendProjection = Object.freeze({
    inputCount,
    renderedCount: frozenEntries.length,
    omittedCount,
    truncatedLabelCount,
    truncated: omittedCount > 0 || truncatedLabelCount > 0,
  });
  return { entries: frozenEntries, projection };
}

function addPartToken(element: Element, token: string): void {
  const tokens = new Set((element.getAttribute('part') ?? '').split(/\s+/).filter(Boolean));
  tokens.add(token);
  element.setAttribute('part', [...tokens].join(' '));
}

/**
 * Declarative GeoJSON fill layer, colored by interpolating `field`'s value
 * across `stops`.
 */
export interface LyraMapChoroplethLayer {
  readonly sourceId: string;
  readonly geojson: FeatureCollection;
  readonly field: string;
  /**
   * `[value, color]` pairs, ascending by `value`, fed to a maplibre-gl
   * `interpolate` expression. Must contain at least one pair -- an empty
   * array can't build a valid expression, so it's ignored (the existing fill
   * layer, if any, is left as-is) rather than applied.
   */
  readonly stops: readonly (readonly [number, string])[];
  /**
   * How the fill color is interpolated between `stops`. `'linear'` (the default, and the only
   * previous behavior) spaces the ramp evenly in value; `'logarithmic'` compresses it, which is
   * what a heavy-tailed quantity — price, population, income — needs. On a linear ramp every value
   * below the maximum falls into the first color band, so the map reads as one flat color plus a
   * couple of outliers.
   *
   * This exposes an existing maplibre-gl capability rather than adding one: it emits
   * `['interpolate', ['exponential', base], …]`, whose sub-1 base yields the logarithmic-style
   * compression. Crucially, `stops` stay in the data's own units either way, so the legend keeps
   * reading in real values instead of log units.
   */
  readonly interpolation?: LyraMapChoroplethInterpolation;

  /**
   * Color for values BELOW the first `stops` threshold, used only when `interpolation` is
   * `'step'` — maplibre's `['step', …]` requires that base output before its first threshold.
   *
   * Defaults to the first stop's own color, which makes the common case (a legend whose first band
   * starts at the data's minimum) need no extra configuration. Set it when the map should
   * distinguish "below the lowest advertised band" from the lowest band itself.
   */
  readonly stepBaseColor?: string;
}

/**
 * How a choropleth's fill color is derived from its stops.
 *
 * `'linear'` and `'logarithmic'` both emit a maplibre `['interpolate', …]` expression, producing a
 * continuous ramp. `'step'` emits `['step', …]` instead, giving DISCRETE bands.
 *
 * A continuous ramp is wrong whenever the legend advertises a fixed set of ranges with one swatch
 * each: it puts colors on the map that appear nowhere in the legend, and renders two regions in the
 * same advertised band as visibly different colors. `legendGradient` covers the opposite case (a
 * gradient legend) but could not express this one.
 */
export type LyraMapChoroplethInterpolation = 'linear' | 'logarithmic' | 'step';

/**
 * Exponential base for `'logarithmic'` choropleth interpolation.
 *
 * maplibre-gl has no `['log']` interpolation type; `['exponential', base]` with a base below 1 is
 * the documented way to weight the ramp toward the low end of the domain, which is the visual
 * effect a log scale is wanted for. 0.25 spreads a heavy-tailed distribution's mass across the
 * palette without collapsing the top of the range into a single band.
 */
const CHOROPLETH_LOG_INTERPOLATION_BASE = 0.25;

/**
 * What a `dataLayers` entry renders.
 *
 * `'auto'` (the default, and the only previous behavior) splits the source by geometry into the
 * fill/line/circle layers below. `'heatmap'` replaces that split with MapLibre's own first-class
 * `heatmap` layer — a density surface, which the geometry split cannot express at all: thousands of
 * overlapping circles read as one opaque blob, not as where the data is concentrated.
 */
export type LyraMapDataLayerKind = 'auto' | 'heatmap';

/**
 * Native MapLibre marker clustering for one `dataLayers` entry.
 *
 * Clustering is a *source* option plus layers, not new rendering machinery: setting this adds
 * `cluster`/`clusterRadius`/`clusterMaxZoom` to the entry's GeoJSON source and swaps its geometry
 * split for a `${sourceId}-cluster` circle, a `${sourceId}-cluster-count` label, and a
 * `${sourceId}-circle` layer for the points that stayed unclustered. It is the answer to a
 * thousands-of-pins map, which `markers` cannot be: `markers` mints one real DOM element per entry,
 * which is correct for tens of pins and unreadable (and expensive) for thousands.
 *
 * A clustered source carries points only — MapLibre drops non-point geometry when clustering — so no
 * fill/line layer is created for a clustered entry.
 */
export interface LyraMapClusterOptions {
  /** Cluster radius in pixels at each zoom level. Defaults to 50, MapLibre's own default. */
  readonly radius?: number;
  /** Zoom past which points stop being clustered. Defaults to 14. */
  readonly maxZoom?: number;
  /**
   * `[pointCount, radiusPx]` breaks for the cluster circle, in the same ascending `[value, output]`
   * shape as `choropleth.stops` and with the same `['step', …]` semantics: the first entry's output
   * is also the base, so counts below the first threshold use it.
   */
  readonly radiusSteps?: readonly (readonly [number, number])[];
  /**
   * `[pointCount, color]` breaks for the cluster circle. Same vocabulary as `choropleth.stops`,
   * including color resolution: a `var(--lr-…)` reference is resolved against the host before it
   * reaches MapLibre, which paints to a WebGL canvas and never sees the CSS cascade.
   */
  readonly colorSteps?: readonly (readonly [number, string])[];
  /**
   * Font stack for the cluster count label, which must exist in the style's own glyph source.
   * Defaults to MapLibre's spec default; supply the names your style actually ships when that
   * default is absent. The count label is skipped entirely when the style declares no `glyphs`,
   * since a text layer without one paints nothing and only emits peer errors.
   */
  readonly countFont?: readonly string[];
}

/** A heatmap paint value expressed either as one constant or bounded `[zoom, value]` stops. */
export type LyraMapHeatmapZoomValue =
  | number
  | readonly (readonly [zoom: number, value: number])[];

/** Paint configuration for a `kind: 'heatmap'` data layer. */
export interface LyraMapHeatmapOptions {
  /** Feature property weighting each point. Omitted, every point weighs 1 (MapLibre's default). */
  readonly weightField?: string;
  /**
   * `[min, max]` of `weightField` in the data's own units, mapped onto MapLibre's 0–1 weight. Without
   * it the raw property value is used, which saturates the surface for any quantity above ~1.
   */
  readonly weightRange?: readonly [number, number];
  /**
   * `[density, color]` ramp stops, density in `[0, 1]` — the same `[value, color]` vocabulary
   * `choropleth.stops` and `legendGradient` already share, `var(--lr-…)` references included. A ramp
   * that does not start at density 0 gets a fully transparent stop prepended, because a colored zero
   * tints the entire map.
   *
   * One stop is therefore enough, as long as it sits above density 0: `[[1, hot]]` is spelled
   * exactly the way it reads, transparent to hot. The only ramp that cannot be honored is a lone
   * stop AT density 0, which is a flat color rather than a gradient; that one falls back to the
   * default ramp.
   */
  readonly stops?: readonly (readonly [number, string])[];
  /** Kernel radius in pixels, or linear `[zoom, radius]` stops. Zooms clamp to `[0, 24]`, radii
   * to `[1, 200]`, and a scalar/default remains 30. */
  readonly radius?: LyraMapHeatmapZoomValue;
  /** Global intensity multiplier, or linear `[zoom, intensity]` stops. Zooms clamp to `[0, 24]`,
   * intensity to `[0, 100]`, and a scalar/default remains 1. */
  readonly intensity?: LyraMapHeatmapZoomValue;
  /** Whole-layer opacity in `[0, 1]`. Omitted, MapLibre's own default remains in force. */
  readonly opacity?: number;
}

/** One GeoJSON source rendered as three layers (`${sourceId}-fill` for polygons, `${sourceId}-line`
 *  for lines/outlines, `${sourceId}-circle` for points), or — under `cluster`/`kind` — as the
 *  cluster or heatmap layers those describe. Colors resolve from `--lr-*` tokens at apply time,
 *  defaulting to `accent`. */
export interface LyraMapGeoJsonDataLayer {
  /** Trimmed nonempty business identity. A collection retains the first occurrence and ignores
   * blank or later duplicate `sourceId` records. */
  readonly sourceId: string;
  readonly geojson: Feature | FeatureCollection;
  readonly tone?: 'accent' | 'success' | 'warning' | 'danger' | 'neutral';

  /**
   * Explicit fill color, overriding `tone` for the polygon fill only. Any CSS color, including a
   * `var(--lr-…)` reference.
   *
   * Exists because a fill and its outline want opposite things on a choropleth-plus-overlay map,
   * and the difference is measurable rather than aesthetic: the fill competes for area with the
   * choropleth beside it, so it has to sit quiet, while the 1px outline competes with nothing and
   * is the only thing keeping a no-data region's shape readable once the fill is that faint.
   * Deriving one from the other put a real case at 1.41:1 against a light basemap — under WCAG
   * 1.4.11's 3:1 floor for graphical objects — leaving the region indistinguishable from bare
   * basemap.
   */
  readonly color?: string;

  /**
   * Explicit line/outline color, overriding `tone` for the `-line` and `-circle` layers. Falls back
   * to `color`, then to `tone`. See `color` for why these are separable.
   */
  readonly strokeColor?: string;

  /** What this entry renders. Defaults to `'auto'` — today's geometry split, unchanged. */
  readonly kind?: LyraMapDataLayerKind;

  /**
   * Paint configuration for `kind: 'heatmap'`. Ignored under any other kind, so it can be carried
   * beside an `'auto'` entry without effect.
   */
  readonly heatmap?: LyraMapHeatmapOptions;

  /**
   * Enables native MapLibre clustering for this entry. `cluster: {}` accepts every default.
   *
   * Ignored when `kind` is `'heatmap'`: a heatmap already aggregates density, and clustering its
   * input would feed it one weighted point per cluster instead of the real distribution.
   */
  readonly cluster?: LyraMapClusterOptions;
}

/** Each entry becomes one real, individually-focusable DOM marker button with activation
 *  listeners -- unbounded input would let a hostile/oversized `markers` assignment synchronously
 *  mint an unbounded number of them. First-N deterministic truncation, matching
 *  lightbox.class.ts's `MAX_LIGHTBOX_IMAGES` and image-viewer.class.ts's
 *  `IMAGE_VIEWER_HIGHLIGHT_LIMIT`. */
const MAX_MAP_MARKERS = 2_000;

export interface LyraMapMarker {
  /** Optional explicit business identity. Explicit IDs are trimmed and must be nonempty; the
   * first occurrence is retained. Markers with no `id` remain distinct by coordinate occurrence. */
  readonly id?: string;
  readonly lngLat: readonly [number, number];
  /** A CSS color. Invalid values and `url()` paint servers use maplibre-gl's default marker color. */
  readonly color?: string;
  /** Visible popup text and the marker button's accessible name. */
  readonly label?: string;
  /**
   * Rendered as the marker's popup content via maplibre-gl's
   * `Popup.setHTML()` -- parsed as raw markup, inline event handlers
   * included. This is the library's one explicit unsafe-HTML escape hatch:
   * only ever pass trusted content, and sanitize anything derived from user
   * input before assigning it here. Prefer `label` (rendered via the safe
   * `Popup.setText()`) whenever the content is plain text.
   */
  readonly unsafeHtml?: string;
}

/** Input path that activated a declarative map marker. */
export type LyraMapMarkerActivationSource = 'pointer' | 'keyboard';

/** Immutable payload emitted when a declarative marker is activated. */
export interface LyraMapMarkerActivationDetail {
  /** Trimmed explicit marker identity, or `undefined` for an idless marker. */
  readonly id: string | undefined;
  /** Validated marker position as `[longitude, latitude]`. */
  readonly lngLat: readonly [number, number];
  /** The accepted declarative marker snapshot. */
  readonly marker: LyraMapMarker;
  /** Whether activation came through click/pointer semantics or the keyboard contract. */
  readonly source: LyraMapMarkerActivationSource;
}

/** Extracts a marker name from trusted popup markup without attaching or executing it. Elements
 * whose text is not exposed as visible content are excluded before whitespace is normalized. */
function popupText(host: Element, markup: string): string {
  const template = host.ownerDocument.createElement('template');
  template.innerHTML = markup;
  for (const hidden of template.content.querySelectorAll(
    'script, style, template, [hidden], [aria-hidden="true"]',
  )) hidden.remove();
  return (template.content.textContent ?? '').replace(/\s+/gu, ' ').trim();
}

/** Each entry becomes a source plus up to three GL layers (`fill`/`line`/`circle`) -- unbounded
 *  input would let a hostile/oversized `dataLayers` assignment synchronously add an unbounded
 *  number of sources/layers to the underlying map. First-N deterministic truncation, same
 *  rationale and pattern as `MAX_MAP_MARKERS` above. */
const MAX_MAP_DATA_LAYERS = 100;

function normalizedDataLayers(value: unknown): LyraMapGeoJsonDataLayer[] {
  if (!Array.isArray(value)) return [];
  const output: LyraMapGeoJsonDataLayer[] = [];
  const seenSourceIds = new Set<string>();
  const scanCount = Math.min(value.length, MAX_MAP_DATA_LAYERS);
  for (let index = 0; index < scanCount; index++) {
    const candidate = value[index];
    try {
      if (candidate === null || typeof candidate !== 'object' || Array.isArray(candidate)) continue;
      const rawSourceId = (candidate as { sourceId?: unknown }).sourceId;
      if (typeof rawSourceId !== 'string') continue;
      const sourceId = rawSourceId.trim();
      if (sourceId.length === 0 || seenSourceIds.has(sourceId)) continue;
      seenSourceIds.add(sourceId);
      output.push(
        rawSourceId === sourceId
          ? candidate as LyraMapGeoJsonDataLayer
          : { ...candidate, sourceId } as LyraMapGeoJsonDataLayer,
      );
    } catch {
      // A malformed entry must not prevent later valid data layers from being applied.
    }
  }
  return output;
}

/**
 * Every layer suffix one `dataLayers` entry can own, across all kinds.
 *
 * Single source of truth on purpose: removal, private-id collision avoidance and the click
 * hit-test all enumerate layer ids, and a new kind that taught only one of them about its suffix
 * would leak layers on removal, or report a click on its own layer as open water.
 */
const DATA_LAYER_SUFFIXES = [
  '-fill',
  '-line',
  '-circle',
  '-cluster',
  '-cluster-count',
  '-heatmap',
] as const;

/**
 * The subset of `DATA_LAYER_SUFFIXES` a click hit-tests.
 *
 * `-heatmap` is excluded because MapLibre's `queryRenderedFeatures()` returns nothing for a heatmap
 * layer — it is a rendered density surface, not addressable features — so querying it would only
 * add a layer id the peer has to reject. `-cluster-count` is excluded because it sits exactly on
 * top of the `-cluster` circle already queried and carries the same properties, so including it
 * would just make the label, rather than the cluster, the topmost hit.
 */
const QUERYABLE_DATA_LAYER_SUFFIXES = ['-fill', '-line', '-circle', '-cluster'] as const;

/** Bound on cluster/heatmap step stops, matching `MAX_MAP_LEGEND_GRADIENT_STOPS`'s rationale. */
const MAX_MAP_STEP_STOPS = 32;

/**
 * Keeps only finite-threshold stops carrying a usable output, sorted ascending and deduplicated —
 * MapLibre's `['step', …]` and `['interpolate', …]` both reject a non-ascending domain outright,
 * which would take the whole layer down rather than degrading one stop.
 */
function normalizedSteps<T>(
  value: unknown,
  isOutput: (candidate: unknown) => candidate is T,
  clampThreshold: (threshold: number) => number = (threshold) => threshold,
): (readonly [number, T])[] {
  if (!Array.isArray(value)) return [];
  const usable: [number, T][] = [];
  const scanCount = Math.min(value.length, MAX_MAP_STEP_STOPS);
  for (let index = 0; index < scanCount; index += 1) {
    const stop: unknown = value[index];
    if (!Array.isArray(stop) || stop.length < 2) continue;
    const [rawThreshold, rawOutput] = stop as [unknown, unknown];
    if (typeof rawThreshold !== 'number' || !Number.isFinite(rawThreshold)) continue;
    if (!isOutput(rawOutput)) continue;
    usable.push([clampThreshold(rawThreshold), rawOutput]);
  }
  usable.sort((a, b) => a[0] - b[0]);
  return usable.filter((stop, index) => index === 0 || stop[0] > usable[index - 1]![0]);
}

const isFiniteOutput = (candidate: unknown): candidate is number =>
  typeof candidate === 'number' && Number.isFinite(candidate);
const isColorOutput = (candidate: unknown): candidate is string =>
  typeof candidate === 'string' && candidate.trim().length > 0;

/**
 * `['step', input, base, threshold, output, …]` — the same shape `applyChoropleth()`'s `'step'`
 * interpolation emits, including the base defaulting to the first stop's own output so a break at
 * the data minimum needs no extra configuration.
 */
function stepExpression<T>(input: unknown, stops: readonly (readonly [number, T])[]): unknown[] {
  const expression: unknown[] = ['step', input, stops[0]![1]];
  for (const [threshold, output] of stops) expression.push(threshold, output);
  return expression;
}

/** MapLibre's own `clusterRadius` default. */
const DEFAULT_CLUSTER_RADIUS = 50;
/** MapLibre's own `clusterMaxZoom` default. */
const DEFAULT_CLUSTER_MAX_ZOOM = 14;
/** `[point_count, radiusPx]` breaks giving a visibly larger circle for a denser cluster. */
const DEFAULT_CLUSTER_RADIUS_STEPS: readonly (readonly [number, number])[] = Object.freeze([
  [0, 14],
  [10, 18],
  [50, 24],
]);
/** MapLibre's own `heatmap-radius` default. */
const DEFAULT_HEATMAP_RADIUS = 30;
/** MapLibre's own `heatmap-intensity` default. */
const DEFAULT_HEATMAP_INTENSITY = 1;
/**
 * The density-0 color of every heatmap ramp. Fully transparent black is required, not a design
 * choice: MapLibre paints the ramp across the whole layer, so any visible color at density 0 tints
 * the entire map. It is spelled as literal rgba rather than the `transparent` keyword because this
 * value is handed to the peer's own color parser, not to CSS.
 */
const HEATMAP_TRANSPARENT = 'rgba(0, 0, 0, 0)';

/**
 * Prepends the transparent density-0 stop to a heatmap ramp that starts above zero.
 *
 * A ramp whose lowest stop is above zero paints that color across every zero-density pixel, which
 * is the whole map -- so the floor is prepended rather than assumed. An empty ramp is returned
 * untouched; it has no lowest stop to compare and no gradient to protect.
 */
function withTransparentFloor(
  stops: readonly (readonly [number, string])[],
): readonly (readonly [number, string])[] {
  return stops.length && stops[0]![0] > 0 ? [[0, HEATMAP_TRANSPARENT] as const, ...stops] : stops;
}

/** Cap on the cluster count label's font stack; a stack is a fallback chain, not a list. */
const MAX_CLUSTER_COUNT_FONTS = 8;

/** `LyraMapClusterOptions` with every value normalized to something MapLibre accepts. */
interface NormalizedClusterOptions {
  readonly radius: number;
  readonly maxZoom: number;
  readonly radiusSteps: readonly (readonly [number, number])[];
  readonly colorSteps: readonly (readonly [number, string])[];
  readonly countFont: readonly string[] | undefined;
}

/**
 * Normalizes one entry's `cluster` option, or returns `undefined` when clustering is not requested.
 *
 * `cluster: {}` is meaningful — it opts in at every default — so presence of the object, not of any
 * particular field, is what enables clustering.
 */
function normalizedClusterOptions(value: unknown): NormalizedClusterOptions | undefined {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const options = value as LyraMapClusterOptions;
  const radiusSteps = normalizedSteps(options.radiusSteps, isFiniteOutput);
  const fonts = Array.isArray(options.countFont)
    ? options.countFont
        .filter((font): font is string => typeof font === 'string' && font.trim().length > 0)
        .slice(0, MAX_CLUSTER_COUNT_FONTS)
    : [];
  return {
    radius: finiteRange(Number(options.radius), DEFAULT_CLUSTER_RADIUS, 1, 1_000),
    maxZoom: finiteRange(Number(options.maxZoom), DEFAULT_CLUSTER_MAX_ZOOM, 0, 24),
    radiusSteps: radiusSteps.length ? radiusSteps : DEFAULT_CLUSTER_RADIUS_STEPS,
    colorSteps: normalizedSteps(options.colorSteps, isColorOutput),
    countFont: fonts.length ? fonts : undefined,
  };
}

/**
 * The rendering shape one entry asks for, as a comparable string. Two entries with the same shape
 * can reuse a source and its layers; a change means a full rebuild (see `_appliedDataLayerShapes`).
 */
function dataLayerShape(layer: LyraMapGeoJsonDataLayer): string {
  if (layer.kind === 'heatmap') return 'heatmap';
  const cluster = normalizedClusterOptions(layer.cluster);
  if (!cluster) return 'auto';
  return `cluster:${cluster.radius}:${cluster.maxZoom}:${cluster.countFont?.join(',') ?? ''}`;
}

/**
 * `heatmap-weight` for the authored weight field, or `undefined` to leave MapLibre's own default of
 * 1 per point in place.
 *
 * With a `weightRange` the property is mapped onto the 0–1 domain MapLibre expects; without one the
 * raw value is passed through, which is only right for data already in that range.
 */
function heatmapWeightExpression(options: LyraMapHeatmapOptions | undefined): unknown[] | undefined {
  const field = typeof options?.weightField === 'string' ? options.weightField.trim() : '';
  if (!field) return undefined;
  const range = options?.weightRange;
  const min = Array.isArray(range) ? Number(range[0]) : Number.NaN;
  const max = Array.isArray(range) ? Number(range[1]) : Number.NaN;
  // Deliberately a finiteness test rather than a `finiteRange` clamp: a half-specified or inverted
  // range has no defensible substitute, and mapping the property onto the wrong domain would
  // silently saturate or flatten the whole surface. Passing the raw value through is honest.
  if (!Number.isFinite(min) || !Number.isFinite(max) || min >= max) return ['get', field];
  return ['interpolate', ['linear'], ['get', field], min, 0, max, 1];
}

/**
 * Normalizes a heatmap's scalar-or-zoom-stop paint value without leaking MapLibre expression
 * types into the public API. A single usable stop is a constant; two or more become a linear zoom
 * interpolation. Invalid arrays fall back to the established scalar default.
 */
function heatmapZoomValue(
  value: unknown,
  fallback: number,
  min: number,
  max: number,
): number | unknown[] {
  if (!Array.isArray(value)) return finiteRange(Number(value), fallback, min, max);
  const stops = normalizedSteps(
    value,
    isFiniteOutput,
    (zoom) => finiteRange(zoom, 0, 0, 24),
  ).map(
    ([zoom, output]) => [zoom, finiteRange(output, fallback, min, max)] as const,
  );
  if (stops.length === 0) return fallback;
  if (stops.length === 1) return stops[0]![1];
  const expression: unknown[] = ['interpolate', ['linear'], ['zoom']];
  for (const [zoom, output] of stops) expression.push(zoom, output);
  return expression;
}

/** Peer-neutral subset of a MapLibre style accepted by `mapStyle`. */
export interface LyraMapStyleSpecification {
  readonly version: 8;
  readonly sources: Readonly<Record<string, unknown>>;
  readonly layers: readonly unknown[];
  readonly name?: string;
  readonly sprite?: string | readonly Readonly<{ id: string; url: string }>[];
  readonly glyphs?: string;
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
  /**
   * Deliberately `unknown` rather than `LyraMapBounds | null`. This interface is the peer-neutral
   * surface the real maplibre `Map` must structurally satisfy, and maplibre spells this parameter
   * `LngLatBoundsLike | null` — a union of a `LngLatBounds` class instance, a mutable
   * `[LngLatLike, LngLatLike]` pair and a flat `[number, number, number, number]`. `LyraMapBounds`
   * is a *readonly* tuple, so it is assignable to none of them, and the class instance is assignable
   * to no tuple; with neither direction related, even method bivariance cannot bridge it and
   * `MapLibreMap extends LyraMapInstance` silently becomes false. Restating maplibre's union here
   * would mean importing its types into the peer-neutral layer, which is the one thing this
   * interface exists to avoid. The component's own call site stays typed: it only ever passes
   * `safeMaxBounds`, which is `LyraMapBounds | null`.
   */
  setMaxBounds?(bounds?: unknown): unknown;
}

/** A pan-constraining box, `[[west, south], [east, north]]`, in the order maplibre-gl takes. */
export type LyraMapBounds = readonly [
  readonly [number, number],
  readonly [number, number],
];

// Defensive JS-side fallback for choroplethFillOpacity() below. The custom
// property deliberately remains undeclared on :host so a value from any
// ancestor can inherit; this default preserves the established paint value
// when it is unset or the host is detached from a document.
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

const TONE_TOKEN: Record<NonNullable<LyraMapGeoJsonDataLayer['tone']>, string> = {
  accent: '--lr-color-brand',
  success: '--lr-color-success',
  warning: '--lr-color-warning',
  danger: '--lr-color-danger',
  neutral: '--lr-color-text-quiet',
};

/** Foreground pairing for each `tone`, used by the cluster count label so its text keeps its
 *  contrast against the cluster circle it sits on under any theme. `neutral` pairs with the loud
 *  neutral fill's foreground, which is also legible over `TONE_TOKEN`'s quieter neutral. */
const ON_TONE_TOKEN: Record<NonNullable<LyraMapGeoJsonDataLayer['tone']>, string> = {
  accent: '--lr-color-on-brand',
  success: '--lr-color-on-success',
  warning: '--lr-color-on-warning',
  danger: '--lr-color-on-danger',
  neutral: '--lr-color-on-neutral',
};

/**
 * Default heatmap ramp, as `[density, token]` pairs resolved at apply time.
 *
 * Cool-to-hot through the shared semantic tones rather than an invented palette, so a rethemed
 * application rethemes the density surface with everything else — and so the surface speaks the
 * same colour vocabulary as `tone` on the layer beside it.
 */
const HEATMAP_RAMP_TOKENS: readonly (readonly [number, string])[] = Object.freeze([
  [0.25, '--lr-color-brand'],
  [0.5, '--lr-color-success'],
  [0.75, '--lr-color-warning'],
  [1, '--lr-color-danger'],
]);

/**
 * Resolves a `LyraMapGeoJsonDataLayer.tone` to a real color via the matching
 * `--lr-color-*` token, read at apply time (not property-set time) so a
 * later retheme is picked up the next time `dataLayers` is (re)applied --
 * same rationale as `choroplethFillOpacity()` above.
 */
function dataLayerColor(host: Element, tone: LyraMapGeoJsonDataLayer['tone']): string {
  const token = TONE_TOKEN[tone ?? 'accent'];
  const raw = ownerWindow(host)?.getComputedStyle(host).getPropertyValue(token).trim() ?? '';
  return raw || '#0969da';
}

/**
 * Resolves an author-supplied color for one data layer, falling back to the layer's `tone`.
 *
 * A `var(--lr-…)` reference is resolved against the host first, because maplibre paints to a WebGL
 * canvas and never sees the CSS cascade — handing it a raw `var()` string yields no paint at all,
 * the same class of silent failure `resolveCanvasColor()` exists for elsewhere in this library.
 */
function resolvedLayerColor(
  host: Element,
  explicit: string | undefined,
  tone: LyraMapGeoJsonDataLayer['tone'],
): string {
  const candidate = typeof explicit === 'string' ? explicit.trim() : '';
  if (!candidate) return dataLayerColor(host, tone);
  const reference = /^var\(\s*(--[\w-]+)/.exec(candidate);
  if (!reference) return candidate;
  const resolved = ownerWindow(host)
    ?.getComputedStyle(host)
    .getPropertyValue(reference[1]!)
    .trim();
  return resolved || dataLayerColor(host, tone);
}

/** How many features one `warnOnUntileableProperties()` pass inspects. Every GeoJSON source is
 *  re-scanned on each apply, so this stays bounded for the same reason the rest of this component
 *  bounds consumer input: a diagnostic must not become the expensive part of a redraw. */
const UNTILEABLE_SCAN_FEATURE_LIMIT = 10_000;

/**
 * Warns once per (source, property) when a feature property carries an integer too large to be
 * tiled.
 *
 * maplibre-gl tiles every GeoJSON source through a worker into a protobuf vector tile, and a
 * property whose integer magnitude overflows a varint throws *inside that worker* -- "Given varint
 * doesn't fit into 10 bytes". That is not catchable by the consuming app and not a rejected
 * promise; it surfaces only as an opaque message on this component's own `error` handler, while
 * the rest of the layer still paints. A single bad feature in a large collection is therefore
 * invisible until someone walks the data by hand.
 *
 * The bound is `Number.MAX_SAFE_INTEGER`, which is stricter than the varint limit on purpose:
 * beyond it a JavaScript number has already lost integer identity, so a value that large is not
 * round-tripping through tiling intact under any encoding. Values that big belong in the
 * application beside the layer, not in the layer -- carry a reduced figure (a log, a bucket) in
 * the feature and keep the exact one in your own payload.
 */
function warnOnUntileableProperties(geojson: unknown, sourceLabel: string): void {
  const features = (geojson as { features?: unknown })?.features;
  if (!Array.isArray(features)) return;
  const limit = Math.min(features.length, UNTILEABLE_SCAN_FEATURE_LIMIT);
  for (let index = 0; index < limit; index += 1) {
    const feature = features[index] as
      | { id?: unknown; properties?: Record<string, unknown> | null }
      | undefined;
    const properties = feature?.properties;
    if (!properties || typeof properties !== 'object') continue;
    for (const [key, value] of Object.entries(properties)) {
      if (typeof value !== 'number' || !Number.isFinite(value)) continue;
      if (Math.abs(value) <= Number.MAX_SAFE_INTEGER) continue;
      const identity = feature?.id ?? `index ${index}`;
      devWarnOnce(
        `lyra-map-untileable-property:${sourceLabel}:${key}`,
        `<lr-map>: feature ${String(identity)} in "${sourceLabel}" carries ${key}=${value}, which is `
          + 'too large to survive maplibre-gl\'s vector-tile encoding. Tiling happens in a worker, '
          + 'so the failure would reach you only as an opaque "Given varint doesn\'t fit into 10 '
          + 'bytes" error while the rest of the layer still paints. Carry a reduced figure in the '
          + 'feature and keep the exact value in your own data.'
      );
    }
  }
}

/** Ceiling on the features one property-diff pass inspects, matching the untileable-property scan:
 *  past it, falling back to a whole-source replace is cheaper than the comparison itself. */
const GEOJSON_DIFF_FEATURE_LIMIT = 10_000;
/** Maximum values traversed while proving retained GeoJSON geometry unchanged. */
const GEOJSON_DIFF_VALUE_LIMIT = 50_000;

interface GeoJsonValueComparison {
  remaining: number;
  readonly forward: WeakMap<object, object>;
  readonly reverse: WeakMap<object, object>;
}

function isPlainGeoJsonRecord(value: object): boolean {
  try {
    const prototype = Object.getPrototypeOf(value);
    if (prototype === null) return true;
    const constructor = Object.getOwnPropertyDescriptor(prototype, 'constructor');
    return Boolean(
      constructor &&
        'value' in constructor &&
        typeof constructor.value === 'function' &&
        constructor.value.name === 'Object' &&
        Object.getPrototypeOf(prototype) === null
    );
  } catch {
    return false;
  }
}

/** Bounded equality for the JSON data model GeoJSON geometry/bbox values are allowed to contain.
 * It reads data descriptors only, preserves sparse-array and alias distinctions, and fails closed
 * for accessors, custom prototypes, exhausted work, or any reflective error. */
function sameGeoJsonValue(
  previous: unknown,
  next: unknown,
  comparison: GeoJsonValueComparison
): boolean {
  if (comparison.remaining <= 0) return false;
  comparison.remaining -= 1;
  if (Object.is(previous, next)) return true;
  if (
    previous === null ||
    next === null ||
    typeof previous !== 'object' ||
    typeof next !== 'object'
  )
    return false;

  const pairedNext = comparison.forward.get(previous);
  if (pairedNext) return pairedNext === next;
  const pairedPrevious = comparison.reverse.get(next);
  if (pairedPrevious) return pairedPrevious === previous;
  comparison.forward.set(previous, next);
  comparison.reverse.set(next, previous);

  const previousIsArray = Array.isArray(previous);
  const nextIsArray = Array.isArray(next);
  if (previousIsArray || nextIsArray) {
    if (!previousIsArray || !nextIsArray || previous.length !== next.length) return false;
    for (let index = 0; index < previous.length; index += 1) {
      const before = Object.getOwnPropertyDescriptor(previous, String(index));
      const after = Object.getOwnPropertyDescriptor(next, String(index));
      if (Boolean(before) !== Boolean(after)) return false;
      if (!before || !after) continue;
      if (!('value' in before) || !('value' in after)) return false;
      if (!sameGeoJsonValue(before.value, after.value, comparison)) return false;
    }
    return true;
  }

  if (!isPlainGeoJsonRecord(previous) || !isPlainGeoJsonRecord(next)) return false;
  const previousKeys = Object.keys(previous);
  const nextKeys = Object.keys(next);
  if (previousKeys.length !== nextKeys.length) return false;
  for (let index = 0; index < previousKeys.length; index += 1) {
    const key = previousKeys[index]!;
    if (key !== nextKeys[index]) return false;
    const before = Object.getOwnPropertyDescriptor(previous, key);
    const after = Object.getOwnPropertyDescriptor(next, key);
    if (!before || !after || !('value' in before) || !('value' in after)) return false;
    if (!sameGeoJsonValue(before.value, after.value, comparison)) return false;
  }
  return true;
}

function sameGeoJsonSnapshots(previous: unknown, next: unknown): boolean {
  try {
    return sameGeoJsonValue(previous, next, {
      remaining: GEOJSON_DIFF_VALUE_LIMIT,
      forward: new WeakMap(),
      reverse: new WeakMap(),
    });
  } catch {
    return false;
  }
}

interface IndexedGeoJsonFeature {
  readonly id: string | number;
  readonly index: number;
  readonly feature: Feature;
  readonly geometry: unknown;
  readonly bbox: unknown;
  readonly properties: Record<string, unknown>;
}

interface IndexedGeoJsonCollection {
  readonly ordered: readonly IndexedGeoJsonFeature[];
  readonly byId: ReadonlyMap<string | number, IndexedGeoJsonFeature>;
}

function indexGeoJsonCollection(value: unknown): IndexedGeoJsonCollection | null {
  try {
    if ((value as { type?: unknown })?.type !== 'FeatureCollection') return null;
    const features = (value as { features?: unknown })?.features;
    if (!Array.isArray(features) || features.length > GEOJSON_DIFF_FEATURE_LIMIT) return null;
    const ordered: IndexedGeoJsonFeature[] = [];
    const byId = new Map<string | number, IndexedGeoJsonFeature>();
    for (let index = 0; index < features.length; index += 1) {
      const feature = features[index] as Record<string, unknown> | null | undefined;
      if (!feature || Array.isArray(feature) || feature['type'] !== 'Feature') return null;
      const id = feature['id'];
      if ((typeof id !== 'string' && typeof id !== 'number') || byId.has(id)) return null;
      const rawProperties = feature['properties'];
      if (
        rawProperties !== null &&
        rawProperties !== undefined &&
        (typeof rawProperties !== 'object' || Array.isArray(rawProperties))
      )
        return null;
      const indexed = {
        id,
        index,
        feature: feature as unknown as Feature,
        geometry: feature['geometry'],
        bbox: feature['bbox'],
        properties: (rawProperties ?? {}) as Record<string, unknown>,
      };
      ordered.push(indexed);
      byId.set(id, indexed);
    }
    return { ordered, byId };
  } catch {
    return null;
  }
}

/**
 * Builds a maplibre-gl `updateData()` diff when stable feature ids make the change addressable,
 * and returns `null` otherwise so the caller replaces the whole source instead. Property changes,
 * additions, removals, and order changes all stay on the incremental path.
 *
 * `setData()` unconditionally re-tiles and repaints an entire source with no diffing. That is
 * invisible on a static map and expensive on an animated one: advancing a choropleth a step every
 * few hundred milliseconds re-tiles every polygon each time, when all that changed were the values
 * driving the colour ramp.
 *
 * Geometry and bbox values must remain semantically unchanged. The component's ownership boundary
 * necessarily detaches them on every accepted assignment, so reference identity cannot establish
 * that fact; a bounded, accessor-free comparison verifies their JSON data graph instead. Any
 * uncertainty still falls back to `setData()`.
 *
 * MapLibre applies removals before additions. To preserve the feature collection's observable
 * order, the longest next-order prefix already appearing in previous order stays in place; the
 * remaining suffix is removed and re-added in its exact next order. Appends and ordinary removals
 * therefore remain minimal, while a reorder changes only the suffix it invalidated.
 */
export function buildGeoJsonPropertyDiff(
  previous: unknown,
  next: unknown
): MapLibreGeoJsonDiff | null {
  const previousCollection = indexGeoJsonCollection(previous);
  const nextCollection = indexGeoJsonCollection(next);
  if (!previousCollection || !nextCollection) return null;

  const previousGeometry: unknown[] = [];
  const nextGeometry: unknown[] = [];
  for (const after of nextCollection.ordered) {
    const before = previousCollection.byId.get(after.id);
    if (!before) continue;
    previousGeometry.push(before.geometry, before.bbox);
    nextGeometry.push(after.geometry, after.bbox);
  }
  if (!sameGeoJsonSnapshots(previousGeometry, nextGeometry)) return null;

  const retained = new Set<string | number>();
  let previousIndex = -1;
  for (const feature of nextCollection.ordered) {
    const before = previousCollection.byId.get(feature.id);
    if (!before || before.index <= previousIndex) break;
    retained.add(feature.id);
    previousIndex = before.index;
  }

  const remove = previousCollection.ordered
    .filter((feature) => !retained.has(feature.id))
    .map((feature) => feature.id);
  const add = nextCollection.ordered
    .filter((feature) => !retained.has(feature.id))
    .map((feature) => feature.feature);

  const update: {
    id: string | number;
    addOrUpdateProperties: { key: string; value: unknown }[];
    removeProperties: string[];
  }[] = [];

  for (const after of nextCollection.ordered) {
    if (!retained.has(after.id)) continue;
    const before = previousCollection.byId.get(after.id)!;
    const addOrUpdateProperties: { key: string; value: unknown }[] = [];
    for (const [key, value] of Object.entries(after.properties)) {
      if (!Object.is(before.properties[key], value)) addOrUpdateProperties.push({ key, value });
    }
    const removeProperties = Object.keys(before.properties).filter(
      (key) => !Object.hasOwn(after.properties, key)
    );
    if (addOrUpdateProperties.length === 0 && removeProperties.length === 0) continue;
    update.push({ id: after.id, addOrUpdateProperties, removeProperties });
  }

  return {
    ...(remove.length ? { remove } : {}),
    ...(add.length ? { add } : {}),
    update,
  };
}

export interface LyraMapEventMap {
  'lr-map-load': CustomEvent<null>;
  'lr-map-marker-activate': CustomEvent<LyraMapMarkerActivationDetail>;
  'lr-map-click': CustomEvent<{
    readonly lngLat: readonly [number, number];
    readonly feature: Feature | undefined;
    /** Which layer `feature` was hit on, so a click is attributable when both a choropleth and
     *  `dataLayers` are painted. `'cluster'` marks a hit on a clustered entry's aggregate circle,
     *  whose `point_count`/`cluster_id` properties describe the group rather than one feature.
     *  `undefined` whenever `feature` is. */
    readonly origin: 'choropleth' | 'data-layer' | 'cluster' | undefined;
    /** The authored `dataLayers[].sourceId` the hit belongs to; `undefined` for a choropleth hit
     *  (which has only one possible source) and when nothing was hit. */
    readonly sourceId: string | undefined;
  }>;
}
/**
 * `<lr-map>` — a maplibre-gl wrapper with a declarative legend, choropleth
 * GeoJSON layer, markers, and additive `dataLayers` GeoJSON overlays
 * (arbitrary shapes rendered as a source plus fill/line/circle layers, or — opting in per entry —
 * as a natively clustered point set or a `heatmap` density surface,
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
 * Call `LyraMap.preload()` before connecting an element to start the optional
 * peer import early. `dataLayers[].sourceId` is a trimmed nonempty business identity; the first
 * occurrence is retained and blanks or later duplicates are ignored. It is declarative component input;
 * its backing MapLibre source and layers use collision-free component-owned
 * ids and must not be accessed through `map`.
 *
 * Collection-bearing inputs take bounded, recursively frozen snapshots synchronously. Mutate a
 * copy and reassign it to update the map; later changes to the assigned source are not observed.
 *
 * @customElement lr-map
 * @event lr-map-load - Fired once the underlying maplibregl.Map loads.
 * @event lr-map-marker-activate - Fired once when an accepted declarative marker is activated by
 *   pointer/click or by Enter/Space. The immutable detail carries its normalized `id`, validated
 *   `lngLat`, accepted marker snapshot, and activation `source`.
 * @event lr-map-click - `detail: { lngLat, feature?, origin?, sourceId? }`. `feature` resolves
 *   against the choropleth fill *and* every applied `dataLayers` fill/line/circle/cluster layer,
 *   topmost first; `origin`/`sourceId` name where it came from. A hit on a clustered entry's
 *   aggregate circle reports `origin: 'cluster'` and carries MapLibre's `point_count`/`cluster_id`
 *   properties; a `kind: 'heatmap'` layer is never hit-tested, because MapLibre returns no features
 *   for a density surface.
 * @csspart base - The non-semantic map wrapper. It exposes `aria-busy="true"` while the optional
 *   map library loads and contains ordinary, non-live localized loading text.
 * @csspart container - The MapLibre container. Its generated canvas is the actual focusable map
 *   region and receives the host-first accessible name and effective locale.
 * @slot legend - Custom legend content, rendered inside the legend panel's own layout so it stays
 *  positioned with the map instead of floating beside it.
 * @csspart legend - The map legend.
 * @csspart legend-swatch - A legend color swatch.
 * @csspart legend-gradient - The continuous ramp bar rendered from `legendGradient`.
 * @csspart legend-lo - The low endpoint caption of the `legendGradient` bar (mirrors `lr-heatmap`).
 * @csspart legend-hi - The high endpoint caption of the `legendGradient` bar (mirrors `lr-heatmap`).
 * @csspart legend-limit - Visible localized summary when legend input is bounded or shortened.
 * @csspart marker - A MapLibre-generated marker, with a 24px minimum target in both axes even
 *   when a peer/custom marker has no intrinsic content size.
 * @csspart popup - A MapLibre-generated marker popup.
 * @csspart popup-content - The content container inside a MapLibre-generated marker popup.
 * @csspart popup-close-button - The MapLibre-generated button that closes an open marker popup.
 * @csspart attribution - MapLibre-generated map attribution.
 * @csspart attribution-toggle - MapLibre's compact-attribution disclosure control.
 * @csspart error - Visible localized message shown instead of `container` when `mapStyle` is
 *   missing, the optional peer is unavailable, WebGL2 cannot be created, or map initialization
 *   fails; the transition is announced through the shared light-DOM assertive region.
 * @cssprop [--lr-map-choropleth-fill-opacity=0.75] - Fill opacity for choropleth and polygon
 *   `dataLayers` fills. Read from the resolved cascade whenever those layers are applied or painted
 *   after a theme change.
 * @cssprop [--lr-map-popup-close-button-hover-bg=var(--lr-color-brand-quiet)] - Hover background
 *   of `popup-close-button`.
 * @cssprop [--lr-map-popup-close-button-hover-color=var(--lr-color-brand)] - Hover foreground of
 *   `popup-close-button`.
 * @cssprop [--lr-map-popup-close-button-active-bg=color-mix(in oklab, var(--lr-color-brand-quiet), var(--lr-color-mix-partner) var(--lr-color-mix-active))] - Pressed background of `popup-close-button`.
 * @cssprop [--lr-map-popup-close-button-active-color=var(--lr-color-brand)] - Pressed foreground
 *   of `popup-close-button`.
 *
 * No style or tile provider is selected implicitly. Set `mapStyle` explicitly before connection;
 * this prevents a bare component from making an undeclared third-party request.
 * @status stable
 * @since 4.0.0
 */
export class LyraMap extends LyraElement<LyraMapEventMap> {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    close: LYRA_DEFAULT_close,
    items: LYRA_DEFAULT_items,
    loading: LYRA_DEFAULT_loading,
    map: LYRA_DEFAULT_map,
    mapInitializationFailed: LYRA_DEFAULT_mapInitializationFailed,
    mapLegend: LYRA_DEFAULT_mapLegend,
    mapMissingLibrary: LYRA_DEFAULT_mapMissingLibrary,
    mapStyleRequired: LYRA_DEFAULT_mapStyleRequired,
    mapWebglUnavailable: LYRA_DEFAULT_mapWebglUnavailable,
    paginationSummary: LYRA_DEFAULT_paginationSummary,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  protected static override readonly immutableEventDetails = Object.freeze([
    'lr-map-click',
    'lr-map-marker-activate',
  ]);
  /** `feature` is a maplibre-gl `queryRenderedFeatures()` result -- not a plain object the generic
   *  event-detail snapshotter can structurally clone, so its identity is preserved instead of being
   *  walked (which would otherwise silently collapse it to `undefined`). `lngLat` still gets the
   *  normal detached-and-frozen snapshot treatment. */
  protected static override readonly identityEventDetailProperties = Object.freeze({
    'lr-map-click': Object.freeze(['feature']),
  });

  protected static override readonly ownedCollectionProperties = Object.freeze([
    'center',
    'mapStyle',
    'choropleth',
    'markers',
    'dataLayers',
  ]);

  static override styles = [LyraElement.styles, styles, srOnly];

  /** Starts the shared optional-peer import without constructing a map. Returns false when the
   * peer is unavailable, so applications can decide whether to render their own fallback before
   * connecting an element. */
  static preload(): Promise<boolean> {
    return loadMaplibre().then((module) => module !== null);
  }

  constructor() {
    super();
    new ThemeWatcher(this, () => this.refreshThemePaint());
  }

  /** Initial and controlled map center as `[longitude, latitude]`. */
  @property({ type: Array }) center: readonly [number, number] = [0, 0];
  /** Initial and controlled map zoom level. */
  @property({ type: Number }) zoom = 2;
  /** Whether the constructed peer repeats the world horizontally. `undefined` leaves MapLibre's
   * own default in force. Construction-only; set before the map is created. */
  @property({ attribute: false }) renderWorldCopies?: boolean;

  /**
   * Box the map may not pan outside, `[[west, south], [east, north]]`, or `null` for unconstrained.
   *
   * Exists because reaching for `map.setMaxBounds()` through the `.map` escape hatch can wedge
   * maplibre-gl: at a sub-1 fractional zoom in a wide container, constraining to the full world box
   * has been observed to leave `getZoom()` returning `null` permanently, after which every frame
   * throws from inside the peer's own matrix math and the canvas never paints again -- a blank map,
   * with nothing thrown at the call site to attribute it to. Going through this property applies
   * the same call, then checks the camera survived it and reverts if it did not, so the worst case
   * is an unconstrained map plus a dev-mode warning rather than a blank one.
   */
  @property({ attribute: false }) maxBounds: LyraMapBounds | null = null;
  /** Required MapLibre style URL or peer-neutral style specification. No provider is contacted
   * unless a consumer assigns this property. */
  @property({ attribute: false }) mapStyle?: Readonly<LyraMapStyleSpecification> | string;
  private _legend = EMPTY_MAP_LEGEND;
  private _legendProjection = EMPTY_MAP_LEGEND_PROJECTION;
  /** Immutable, bounded entries rendered in the optional map legend. A required pattern keeps
   * category identity available when authored colors collapse or are unavailable. */
  @property({ attribute: false })
  get legend(): readonly LyraMapLegendEntry[] {
    return this._legend;
  }
  set legend(value: readonly LyraMapLegendEntry[]) {
    const previous = this._legend;
    const normalized = normalizeMapLegend(value);
    this._legend = normalized.entries;
    this._legendProjection = normalized.projection;
    this.requestUpdate('legend', previous);
  }

  /**
   * Whether a consumer supplied `slot="legend"` content, so the panel renders for it alone.
   *
   * Seeded from the light DOM rather than from the slot's own `slotchange`: the slot lives INSIDE
   * the legend panel, so a panel gated on slotchange could never render the slot that would fire
   * it. `slotchange` still runs afterwards to track content added or removed later.
   */
  @state() private hasLegendSlot = false;

  /** Light-DOM probe for slotted legend content, valid before the slot itself has ever rendered. */
  private probeLegendSlot(): boolean {
    for (const child of Array.from(this.children)) {
      if (child.getAttribute('slot') === 'legend') return true;
    }
    return false;
  }
  private _legendGradient: readonly (readonly [number, string])[] = Object.freeze([]);
  /**
   * Renders the legend as a **continuous** gradient bar with endpoint labels instead of (or
   * alongside) the discrete `legend` swatches — the standard key for a choropleth, whose
   * `interpolate` fill is itself a continuous ramp that discrete rows cannot honestly describe.
   *
   * Takes the same `[value, color]` stop shape as `choropleth.stops`, so the usual assignment is
   * `legendGradient = myChoropleth.stops` and the key cannot drift from the layer it describes.
   * Stops are sorted ascending, bounded, and filtered to finite values carrying a CSS-parsable
   * color; fewer than two usable stops render no bar at all, since a one-stop "gradient" is a flat
   * block that describes nothing. Unset (the default) renders exactly today's markup.
   *
   * Endpoint labels default to this component's locale-aware formatting of the lowest and highest
   * stop values; `legendGradientLoLabel`/`legendGradientHiLabel` override them.
   */
  get legendGradient(): readonly (readonly [number, string])[] {
    return this._legendGradient;
  }
  set legendGradient(value: readonly (readonly [number, string])[]) {
    const previous = this._legendGradient;
    this._legendGradient = normalizeMapLegendGradient(value);
    this.requestUpdate('legendGradient', previous);
  }
  /** Overrides the low endpoint's caption; defaults to the lowest stop value, locale-formatted. */
  @property({ attribute: 'legend-gradient-lo-label' }) legendGradientLoLabel: string | null = null;
  /** Overrides the high endpoint's caption; defaults to the highest stop value, locale-formatted. */
  @property({ attribute: 'legend-gradient-hi-label' }) legendGradientHiLabel: string | null = null;

  /** Counts from the latest bounded legend normalization. `truncated` covers omitted rows or
   * shortened labels; the returned record is frozen and never aliases caller input. */
  get legendProjection(): LyraMapLegendProjection {
    return this._legendProjection;
  }
  /** Optional GeoJSON choropleth layer and value-to-color configuration. */
  @property({ attribute: false }) choropleth?: Readonly<LyraMapChoroplethLayer>;
  /** Point markers rendered over the map. Explicit IDs are unique-nonempty first-wins. An idless
   * marker is instead identified by its coordinate occurrence, so colocated idless markers remain
   * separate. */
  @property({ attribute: false }) markers: readonly LyraMapMarker[] = [];
  /**
   * Additive GeoJSON layers rendered alongside the choropleth/markers -- each entry becomes a
   * source plus fill/line/circle layers. `sourceId` values are trimmed, must be nonempty, and retain
   * only their first occurrence. Defaults empty (zero behavior change).
   *
   * An entry opts into either of two other renderings, both strictly additive: `cluster` turns its
   * source into a natively clustered one (aggregate circle, count label, unclustered points), which
   * is what thousands of points need and what `markers` -- one real DOM element per entry -- cannot
   * be; `kind: 'heatmap'` replaces the geometry split with MapLibre's own `heatmap` layer. Neither
   * changes an entry that sets neither.
   */
  @property({ attribute: false }) dataLayers: readonly LyraMapGeoJsonDataLayer[] = [];

  /** Accessible name for MapLibre's focusable canvas. A nonempty host `aria-label` remains the
   *  overall component name and is not cloned onto the nested focus owner; the canvas uses this
   *  purpose-specific label or the localized `map` message. An explicit empty host name is
   *  preserved on the canvas for deliberately decorative embeddings. */
  @property() label = '';

  /** True until the lazy-loaded `maplibre-gl` peer dependency has settled (success or failure). */
  @state() private loading = true;

  /** Classified failure rendered as localized ordinary text and announced through the owner
   * document's assertive sink. */
  @state() private failure?: MapFailureReason;
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
  // Maps the declarative public source id to the component-owned MapLibre id used for it. The
  // generated ids prevent a base style from being updated or removed merely because it happens to
  // use the same id as one of this component's data layers.
  private _appliedDataLayerIds = new Map<string, string>();
  /**
   * The rendering shape (`'auto'`, a cluster signature, `'heatmap'`) each applied data layer was
   * built with, keyed identically to `_appliedDataLayerIds`.
   *
   * MapLibre bakes `cluster`/`clusterRadius`/`clusterMaxZoom` into a GeoJSON source at `addSource()`
   * time and exposes no setter for them, and a kind change swaps the layer set entirely. Neither
   * can be updated in place, so a shape that no longer matches forces a full teardown and rebuild
   * of that one entry instead of a silently stale source.
   */
  private _appliedDataLayerShapes = new Map<string, string>();
  /** Last GeoJSON applied per resolved source id, so an update can be diffed against it rather
   *  than replacing the whole source. Holds a reference, not a copy -- it is only ever compared. */
  private _appliedGeoJson = new Map<string, unknown>();
  private _nextDataLayerId = 0;
  // Cached once connectedCallback's loadMaplibre().then() resolves, and always
  // set before `_map` itself is (see that closure) -- so any code path gated
  // on `this._map` being truthy can rely on this being set too, without
  // re-awaiting the (already-settled) loadMaplibre() promise.
  private _maplibreModule?: MaplibreModule;
  /** True only after WebGL2 has been proved in the current owner-document realm. */
  private _webglReady = false;
  private _markerInstances = new Map<string, MapLibreMarkerCapability>();
  private _markerLabels = new Map<string, string | undefined>();
  private _markerPopupIds = new Map<string, string>();
  private readonly markerActivationDetails = new WeakMap<
    HTMLElement,
    Omit<LyraMapMarkerActivationDetail, 'source'>
  >();
  private _configuredPopups = new WeakSet<object>();
  private _nextPopupId = 0;
  private peerChromeObserver?: MutationObserver;
  private observedPeerContainer?: HTMLElement;
  private mapResizeObserver?: ResizeObserver;
  private observedMapContainer?: HTMLElement;
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

  /** Pushes `geojson` into an existing source, preferring an incremental property update over a
   *  whole-source replace. `setData()` always re-tiles everything; `updateData()` (maplibre-gl 3+)
   *  does not, which is the difference between a smooth animated choropleth and a heavy one. */
  private pushGeoJson(
    source: MapLibreGeoJsonSource,
    resolvedSourceId: string,
    geojson: unknown
  ): void {
    const previous = this._appliedGeoJson.get(resolvedSourceId);
    const diff =
      typeof source.updateData === 'function' && previous !== undefined
        ? buildGeoJsonPropertyDiff(previous, geojson)
        : null;
    if (diff === null || typeof source.updateData !== 'function') source.setData(geojson);
    else if (diff.update.length > 0 || diff.add?.length || diff.remove?.length)
      source.updateData(diff);
    this._appliedGeoJson.set(resolvedSourceId, geojson);
  }

  /** Normalized `maxBounds`, or `null` when unset or unusable. Rejects rather than clamps a
   *  malformed box: a silently corrected constraint is harder to debug than none at all. */
  private get safeMaxBounds(): LyraMapBounds | null {
    const bounds = this.maxBounds;
    if (!Array.isArray(bounds) || bounds.length !== 2) return null;
    const [southWest, northEast] = bounds as [unknown, unknown];
    if (!Array.isArray(southWest) || !Array.isArray(northEast)) return null;
    const [west, south] = southWest as [unknown, unknown];
    const [east, north] = northEast as [unknown, unknown];
    const values = [west, south, east, north].map(Number);
    if (!values.every((value) => Number.isFinite(value))) return null;
    const [w, s, e, n] = values as [number, number, number, number];
    if (w >= e || s >= n) return null;
    if (w < -180 || e > 180 || s < -90 || n > 90) return null;
    return [
      [w, s],
      [e, n],
    ];
  }

  /**
   * Applies `maxBounds`, then verifies the peer's camera survived it.
   *
   * maplibre-gl constrains the camera when bounds are set, and that constrain pass can fail in two
   * different ways at the same conditions -- sub-1 fractional zooms in wide containers:
   *
   *  * It can leave the transform in a state where `getZoom()` returns a non-number. There is no
   *    exception at the call site, so the only reliable signal is to read the camera back
   *    afterwards.
   *  * It can THROW synchronously out of `setMaxBounds()` itself (maplibre-gl 6.x raises
   *    `TypeError: Cannot read properties of null (reading '0')` at a full-world box). That
   *    happens *before* the readback line, so the readback guard alone never ran in the case it
   *    was written for -- and with no `try`/`catch` the exception escaped `updated()` into the
   *    consumer's render cycle, degenerating into repeated throws from the peer's own matrix math
   *    on every later `resize`/`setZoom` and a canvas that never paints again.
   *
   * Either way the answer is the same: drop the constraint and restore the camera -- an
   * unconstrained map is a far smaller defect than a blank one -- and say so once, naming the
   * property. Both failures therefore share one revert path.
   */
  private applyMaxBounds(): void {
    const map = this._map;
    if (!map || typeof map.setMaxBounds !== 'function') return;
    const bounds = this.safeMaxBounds;
    const zoomBefore = map.getZoom();
    const centerBefore = map.getCenter();
    try {
      map.setMaxBounds(bounds);
      if (bounds === null) return;
      if (Number.isFinite(map.getZoom())) return;
    } catch {
      // Fall through to the shared revert below. Clearing `maxBounds` is what un-wedges the
      // peer's transform, so it must happen even though the call that wedged it threw.
    }
    try {
      map.setMaxBounds(null);
    } catch {
      // Nothing further to try: the revert is best-effort by construction.
    }
    if (Number.isFinite(zoomBefore)) map.setZoom(zoomBefore);
    if (centerBefore) map.setCenter([centerBefore.lng, centerBefore.lat]);
    devWarnOnce(
      'lyra-map-max-bounds-rejected',
      '<lr-map>: maxBounds left maplibre-gl without a usable camera, so it was dropped and the '
        + 'camera restored. This is a peer limitation, not a bad value -- it shows up at sub-1 '
        + 'fractional zooms in wide containers. Raise the zoom, narrow the box, or leave maxBounds '
        + 'unset.'
    );
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
    // A reconnect is a new, owner-realm initialization transaction.
    this.failure = undefined;
    this.loading = true;
    this._webglReady = false;
    if (IntersectionObserverCtor) {
      const observer = new IntersectionObserverCtor((entries) => {
        if (entries[0]?.isIntersecting) this.visible = true;
      });
      this.intersectionObserver = observer;
      observer.observe(this);
    }
    void (async () => {
      let mod: Awaited<ReturnType<typeof loadMaplibre>>;
      try {
        mod = await this.loadLibrary();
      } catch {
        if (generation === this._connectGeneration && this.isConnected) {
          this.failInitialization('missing-peer');
        }
        return;
      }
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
      if (!mod) {
        this.failInitialization('missing-peer');
        return;
      }
      // Retain the successfully-loaded peer even when configuration is not ready yet, so assigning
      // `mapStyle` later can retry without a second import or reconnect.
      this._maplibreModule = mod;
      if (!hasMapStyle(this.mapStyle)) {
        this.failInitialization('style-required');
        return;
      }
      if (!supportsWebGL2(this)) {
        this.failInitialization('webgl-unavailable');
        return;
      }
      this._webglReady = true;
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
    })();
  }

  override disconnectedCallback(): void {
    this.releaseErrorAnnouncementSink();
    super.disconnectedCallback();
    this.disposeMap();
    this.intersectionObserver?.disconnect();
    this.intersectionObserver = undefined;
    for (const marker of this._markerInstances.values()) {
      const markerElement = marker.getElement?.();
      if (markerElement) this.markerActivationDetails.delete(markerElement);
      marker.remove();
    }
    this._markerInstances.clear();
    this._markerColors.clear();
    this._markerLabels.clear();
    this._markerPopupIds.clear();
  }

  private failureMessage(reason: MapFailureReason = this.failure ?? 'initialization-failed'): string {
    switch (reason) {
      case 'missing-peer': return this.localize('mapMissingLibrary');
      case 'style-required': return this.localize('mapStyleRequired');
      case 'webgl-unavailable': return this.localize('mapWebglUnavailable');
      case 'initialization-failed': return this.localize('mapInitializationFailed');
    }
  }

  private failInitialization(reason: MapFailureReason, partialMap?: MapLibreMapCapability): void {
    try {
      partialMap?.remove();
    } catch {
      // A partially-created peer instance may not have completed enough setup to remove cleanly.
    }
    this.disposeMap();
    this.loading = false;
    this.failure = reason;
    this.errorAnnouncementSink?.announce(this.failureMessage(reason));
  }

  private disposeMap(): void {
    this.stopObservingMapAllocation();
    this.stopObservingPeerChrome();
    try {
      this._map?.remove();
    } catch {
      // Teardown is best-effort for a peer instance that failed partway through initialization.
    }
    this._map = undefined;
    this._styleLoaded = false;
    this._appliedChoroplethSourceId = undefined;
    this._appliedFillLayerId = undefined;
    this._appliedDataLayerIds.clear();
    this._appliedDataLayerShapes.clear();
    this._appliedGeoJson.clear();
  }

  override adoptedCallback(): void {
    super.adoptedCallback();
    this.stopObservingMapAllocation();
    this.stopObservingPeerChrome();
    this.releaseErrorAnnouncementSink();
    this.syncErrorAnnouncementSink();
    if (this._map && this.containerEl && this.isConnected) {
      this.observeMapAllocation(this._map, this.containerEl);
    }
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
    if (
      this._map ||
      !this._maplibreModule ||
      !this._webglReady ||
      !this.containerEl ||
      !this.visible ||
      !this.isConnected
    ) return;
    if (!hasMapStyle(this.mapStyle)) {
      this.failInitialization('style-required');
      return;
    }
    // supportsWebGL2() is already checked before `this._maplibreModule` is ever set (see the
    // connectedCallback() load path above) -- reaching here with a set _maplibreModule means it
    // already passed. maplibre-gl doesn't fail construction cleanly when WebGL2 is unavailable
    // (it fires a GPUInitializationError internally and still returns a Map instance with no
    // `painter`, which would crash disconnectedCallback()'s `this._map.remove()`), so this must
    // stay a precondition rather than a try/catch around the constructor below.
    const mod = this._maplibreModule;
    let candidate: MapLibreMapCapability | undefined;
    try {
      candidate = new mod.Map({
        container: this.containerEl,
        style: this.mapStyle as never,
        center: this.safeCenter,
        zoom: this.safeZoom,
        ...(typeof this.renderWorldCopies === 'boolean'
          ? { renderWorldCopies: this.renderWorldCopies }
          : {}),
        locale: {
          'Map.Title': this.effectiveMapLabel,
          'Marker.Title': this.localize('map'),
          'Popup.Close': this.localize('close'),
        },
      });
      // Install every component-owned handler before publishing the instance. A constructor or
      // setup failure therefore leaves no half-live map reachable through the public getter.
      candidate.on('error', (event) => {
        if (this._map === candidate && !this._styleLoaded) {
          this.failInitialization('initialization-failed');
          return;
        }
        console.error('lr-map:', event.error ?? event);
      });
      candidate.on('load', () => {
        if (this._map !== candidate) return;
        try {
          this._styleLoaded = true;
          this.applyChoropleth();
          this.applyMarkers();
          this.applyDataLayers();
          this.emit('lr-map-load');
        } catch {
          this.failInitialization('initialization-failed');
        }
      });
      candidate.on('click', (event) => {
        if (this._map !== candidate) return;
        // Query the choropleth fill *and* every applied dataLayers layer. Querying only the
        // choropleth made a click on a `dataLayers` polygon indistinguishable from a click on
        // empty ocean -- `feature: undefined` either way -- which broke the very pattern the two
        // properties invite: choropleth for features that have a value, a data layer for features
        // that exist but have none. maplibre-gl returns hits topmost-first, and data layers are
        // added after the choropleth, so the visually-topmost shape wins on overlap.
        const fillLayerId = this._appliedFillLayerId;
        const layerIds: string[] = [];
        if (fillLayerId && candidate!.getLayer(fillLayerId)) layerIds.push(fillLayerId);
        for (const resolvedSourceId of this._appliedDataLayerIds.values()) {
          for (const suffix of QUERYABLE_DATA_LAYER_SUFFIXES) {
            const layerId = `${resolvedSourceId}${suffix}`;
            if (candidate!.getLayer(layerId)) layerIds.push(layerId);
          }
        }
        const features = layerIds.length
          ? candidate!.queryRenderedFeatures(event.point, { layers: layerIds })
          : [];
        const hit = features[0] as (Feature & { layer?: { id?: string } }) | undefined;
        const hitLayerId = hit?.layer?.id;
        let origin: 'choropleth' | 'data-layer' | 'cluster' | undefined;
        let sourceId: string | undefined;
        if (hitLayerId !== undefined) {
          if (hitLayerId === fillLayerId) {
            origin = 'choropleth';
          } else {
            for (const [publicSourceId, resolvedSourceId] of this._appliedDataLayerIds) {
              // The trailing dash keeps a resolved id that merely prefixes another from matching.
              if (!hitLayerId.startsWith(`${resolvedSourceId}-`)) continue;
              // A cluster is a synthetic aggregate, not one of the consumer's own features, so it
              // gets its own origin rather than being reported as an ordinary data-layer feature:
              // its `point_count`/`cluster_id` properties are the useful payload, and a consumer
              // typically zooms in on it instead of selecting it.
              origin = hitLayerId === `${resolvedSourceId}-cluster` ? 'cluster' : 'data-layer';
              sourceId = publicSourceId;
              break;
            }
          }
        }
        this.emit('lr-map-click', {
          lngLat: [event.lngLat.lng, event.lngLat.lat],
          feature: hit as Feature | undefined,
          origin,
          sourceId,
        });
      });
      const canvas = candidate.getCanvas?.() as HTMLCanvasElement | undefined;
      if (canvas) notifyMapCanvasReady(this, canvas);
      this._map = candidate;
      this.observeMapAllocation(candidate, this.containerEl);
      this.observePeerChrome();
      this.failure = undefined;
    } catch {
      this.failInitialization('initialization-failed', candidate);
      return;
    }
    // `maxBounds` is `attribute: false`, so a property binding is the only way to set it -- which
    // means its one and only appearance in `changed` is the FIRST update, long before this async
    // construction path has produced a map. `updated()`'s `&& this._map` guard therefore
    // short-circuits it, and since the property never changes again it is never retried. Applying
    // it here, on the map-ready path, is what makes a declaratively-set box reach the peer at all;
    // `updated()` still covers a later reassignment.
    this.applyMaxBounds();
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    this.setAttribute('aria-busy', String(this.loading));

    // Became visible after the maplibre-gl module had already loaded (the
    // reverse order — module loads first, visibility follows — is the
    // common case and is instead handled at the end of the
    // `loadMaplibre().then()` chain in connectedCallback() above).
    if (changed.has('visible') && this.visible) this.tryConstructMap();

    if (changed.has('mapStyle') && !hasMapStyle(this.mapStyle) && this._maplibreModule) {
      this.failInitialization('style-required');
    } else if (changed.has('mapStyle') && !this._map && this._maplibreModule && hasMapStyle(this.mapStyle)) {
      this.tryConstructMap();
    } else if (changed.has('mapStyle') && this._map) {
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
      const map = this._map;
      try {
        map.once('style.load', () => {
          if (this._map !== map) return;
          try {
            this._styleLoaded = true;
            this._appliedDataLayerIds.clear(); // a style change wipes every layer/source maplibre-gl knows about
            this._appliedDataLayerShapes.clear();
            this._appliedGeoJson.clear();
            this.applyChoropleth();
            this.applyDataLayers();
          } catch {
            this.scheduleAfterUpdate(
              () => this.failInitialization('initialization-failed'),
              'map-style-failure',
            );
          }
        });
        map.setStyle(this.mapStyle as never);
      } catch {
        this.scheduleAfterUpdate(
          () => this.failInitialization('initialization-failed'),
          'map-style-failure',
        );
      }
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
    if (changed.has('maxBounds') && this._map) this.applyMaxBounds();
    if (changed.has('markers') && this._map) this.applyMarkers();
    this.syncMapSemantics();
  }

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed);
    if (
      changed.has('mapStyle') &&
      !this._map &&
      this._maplibreModule &&
      hasMapStyle(this.mapStyle)
    ) {
      if (!this._webglReady) this._webglReady = supportsWebGL2(this);
      this.failure = this._webglReady ? undefined : 'webgl-unavailable';
      if (!this._webglReady) {
        this.loading = false;
        this.errorAnnouncementSink?.announce(this.failureMessage('webgl-unavailable'));
      }
    }
  }

  /** Repaints token-derived MapLibre values without touching sources, layers, or map geometry. */
  private refreshThemePaint(): void {
    if (!this._map || !this._styleLoaded) return;
    const fillOpacity = choroplethFillOpacity(this);
    if (this._appliedFillLayerId) {
      this._map.setPaintProperty(this._appliedFillLayerId, 'fill-opacity', fillOpacity);
    }
    const dataLayersBySourceId = new Map(
      normalizedDataLayers(this.dataLayers).map((layer) => [layer.sourceId, layer]),
    );
    for (const [publicSourceId, sourceId] of this._appliedDataLayerIds) {
      const dataLayer = dataLayersBySourceId.get(publicSourceId);
      if (!dataLayer) continue;
      // Re-runs the entry's own kind rather than assuming fill/line/circle: a clustered or heatmap
      // entry never created those, and MapLibre reports a paint write to a layer that does not
      // exist as an error event on this component's own handler.
      this.paintDataLayer(sourceId, dataLayer);
    }
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

    warnOnUntileableProperties(geojson, 'choropleth');
    const existingSource = this._map.getSource(sourceId) as MapLibreGeoJsonSource | undefined;
    if (existingSource) {
      // Re-apply the data even if the color expression below ends up skipped:
      // `geojson` may have changed even though `sourceId`/`stops` didn't.
      this.pushGeoJson(existingSource, sourceId, geojson);
    } else {
      // No `promoteId` -- maplibre-gl falls back to its own default id
      // resolution (the standard top-level GeoJSON `Feature.id`, when
      // present). A hardcoded `promoteId: 'id'` here would instead require
      // every feature to *also* duplicate its id inside `properties.id`,
      // silently discarding the real top-level `id` otherwise and breaking
      // `feature.id` on `lr-map-click` for the common case. Nothing in this
      // component actually needs feature-state promotion today; if that's
      // added later it should be driven by an explicit, documented
      // `LyraMapChoroplethLayer` option (e.g. `idField`), not a silent default.
      this._map.addSource(sourceId, { type: 'geojson', data: geojson });
      this._appliedGeoJson.set(sourceId, geojson);
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

    // `['step', input, base, threshold, color, …]` -- discrete bands, not a ramp. The base output
    // (values below the first threshold) defaults to the first stop's own color, so a legend whose
    // first band starts at the data minimum needs no extra configuration.
    let colorExpr: unknown[];
    if (this.choropleth.interpolation === 'step') {
      const base =
        typeof this.choropleth.stepBaseColor === 'string' && this.choropleth.stepBaseColor.trim()
          ? this.choropleth.stepBaseColor.trim()
          : stops[0]![1];
      colorExpr = ['step', ['get', field], base];
      for (const [value, color] of stops) colorExpr.push(value, color);
    } else {
      // `stops` stay in the data's own units under either interpolation, so a consumer never has to
      // pre-transform values to log10 and then hand-relabel the legend back into real units.
      const interpolationExpr =
        this.choropleth.interpolation === 'logarithmic'
          ? ['exponential', CHOROPLETH_LOG_INTERPOLATION_BASE]
          : ['linear'];
      colorExpr = ['interpolate', interpolationExpr, ['get', field]];
      for (const [value, color] of stops) colorExpr.push(value, color);
    }

    if (this._map.getLayer(fillLayerId)) {
      this._map.setPaintProperty(fillLayerId, 'fill-color', colorExpr as never);
      this._map.setPaintProperty(fillLayerId, 'fill-opacity', choroplethFillOpacity(this));
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
    const dataSourceIds = new Set(normalizedDataLayers(this.dataLayers).map((layer) => layer.sourceId));
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
    // Forget the tracked GeoJSON too: a re-added source starts from whatever `addSource` was given,
    // so diffing a later update against the torn-down source's data would skip real changes.
    this._appliedGeoJson.delete(this._appliedChoroplethSourceId);
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
    const layers = normalizedDataLayers(this.dataLayers);
    const nextIds = new Set(layers.map((layer) => layer.sourceId));
    for (const publicSourceId of this._appliedDataLayerIds.keys()) {
      if (!nextIds.has(publicSourceId)) this.removeDataLayer(publicSourceId);
    }
    for (const layer of layers) {
      const { sourceId: publicSourceId, geojson } = layer;
      const shape = dataLayerShape(layer);
      const appliedShape = this._appliedDataLayerShapes.get(publicSourceId);
      // A source's cluster options cannot be mutated after `addSource()`, and a kind change swaps
      // the whole layer set, so a changed shape tears this entry down and rebuilds it (see
      // `_appliedDataLayerShapes`). Every other update still reuses its source and layers.
      if (appliedShape !== undefined && appliedShape !== shape) this.removeDataLayer(publicSourceId);
      const sourceId = this.resolveDataLayerSourceId(publicSourceId);
      warnOnUntileableProperties(geojson, publicSourceId);
      const cluster = layer.kind === 'heatmap' ? undefined : normalizedClusterOptions(layer.cluster);
      const existingSource = this._map.getSource(sourceId) as MapLibreGeoJsonSource | undefined;
      if (existingSource) {
        this.pushGeoJson(existingSource, sourceId, geojson);
      } else {
        this._map.addSource(sourceId, {
          type: 'geojson',
          data: geojson,
          ...(cluster
            ? {
                cluster: true,
                clusterRadius: cluster.radius,
                clusterMaxZoom: cluster.maxZoom,
              }
            : {}),
        });
        this._appliedGeoJson.set(sourceId, geojson);
      }
      this.applyDataLayerRendering(sourceId, layer);
      this._appliedDataLayerIds.set(publicSourceId, sourceId);
      this._appliedDataLayerShapes.set(publicSourceId, shape);
    }
  }

  /**
   * Adds (or repaints, when already present) the layers one entry's kind calls for. Kept separate
   * from source management above so a theme change can re-run exactly the paint half of it without
   * touching sources, data, or map geometry.
   */
  private applyDataLayerRendering(sourceId: string, layer: LyraMapGeoJsonDataLayer): void {
    if (layer.kind === 'heatmap') {
      this.applyHeatmapLayer(sourceId, layer);
      return;
    }
    const cluster = normalizedClusterOptions(layer.cluster);
    if (cluster) {
      this.applyClusterLayers(sourceId, layer, cluster);
      return;
    }
    this.applyGeometryLayers(sourceId, layer);
  }

  /**
   * Rewrites only the token-derived paint of an already-applied entry, for the kind it was applied
   * with. Split from the add-or-update path above because a theme repaint must never query or
   * mutate map structure -- no `getLayer`, no `addLayer`, no source touch -- so that a retheme
   * cannot re-tile data or resurrect a layer a later reconciliation removed.
   */
  private paintDataLayer(sourceId: string, layer: LyraMapGeoJsonDataLayer): void {
    if (layer.kind === 'heatmap') {
      this.paintHeatmapLayer(sourceId, layer);
      return;
    }
    const cluster = normalizedClusterOptions(layer.cluster);
    if (cluster) {
      this.paintClusterLayers(sourceId, layer, cluster);
      return;
    }
    this.paintGeometryLayers(sourceId, layer);
  }

  /** The pre-existing geometry split: polygons filled, lines/outlines stroked, points circled. */
  private applyGeometryLayers(sourceId: string, layer: LyraMapGeoJsonDataLayer): void {
    if (!this._map) return;
    const tone = layer.tone;
    const color = resolvedLayerColor(this, layer.color, tone);
    const stroke = resolvedLayerColor(this, layer.strokeColor ?? layer.color, tone);
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
    }
    if (!this._map.getLayer(lineId)) {
      this._map.addLayer({
        id: lineId,
        type: 'line',
        source: sourceId,
        filter: ['in', ['geometry-type'], ['literal', ['LineString', 'Polygon']]],
        paint: { 'line-color': stroke, 'line-width': 2 },
      });
    }
    if (!this._map.getLayer(circleId)) {
      this._map.addLayer({
        id: circleId,
        type: 'circle',
        source: sourceId,
        filter: ['==', ['geometry-type'], 'Point'],
        paint: { 'circle-color': stroke, 'circle-radius': 5 },
      });
    }
    this.paintGeometryLayers(sourceId, layer);
  }

  /** Paint-only half of `applyGeometryLayers`. See `paintDataLayer` for why the halves are split. */
  private paintGeometryLayers(sourceId: string, layer: LyraMapGeoJsonDataLayer): void {
    if (!this._map) return;
    const tone = layer.tone;
    const color = resolvedLayerColor(this, layer.color, tone);
    const stroke = resolvedLayerColor(this, layer.strokeColor ?? layer.color, tone);
    this._map.setPaintProperty(`${sourceId}-fill`, 'fill-color', color);
    this._map.setPaintProperty(`${sourceId}-fill`, 'fill-opacity', choroplethFillOpacity(this));
    this._map.setPaintProperty(`${sourceId}-line`, 'line-color', stroke);
    this._map.setPaintProperty(`${sourceId}-circle`, 'circle-color', stroke);
  }

  /**
   * `['step', ['get', 'point_count'], …]` over the authored cluster color breaks, or the layer's
   * own flat color when none were supplied.
   *
   * Every break resolves through `resolvedLayerColor()` for the same reason `layer.color` does: the
   * breaks speak the `choropleth.stops` vocabulary, so a consumer writes `var(--lr-color-brand)` in
   * one and reasonably expects it in the other -- and MapLibre paints to a WebGL canvas that never
   * sees the CSS cascade, so an unresolved `var()` is not a wrong color but no paint at all.
   *
   * Shared by both halves of the apply/paint split so the two can never resolve differently.
   */
  private clusterColorExpression(
    layer: LyraMapGeoJsonDataLayer,
    cluster: NormalizedClusterOptions,
  ): unknown[] | string {
    const tone = layer.tone;
    if (!cluster.colorSteps.length) return resolvedLayerColor(this, layer.color, tone);
    return stepExpression(
      ['get', 'point_count'],
      cluster.colorSteps.map(
        ([count, stepColor]) => [count, resolvedLayerColor(this, stepColor, tone)] as const,
      ),
    );
  }

  /**
   * The three layers native MapLibre clustering needs: an aggregate circle over the clustered
   * points, its count label, and the points that stayed unclustered.
   *
   * No fill/line layer is created here — MapLibre's clustering keeps point features only, so those
   * two would be permanently empty while still occupying ids the click hit-test walks.
   */
  private applyClusterLayers(
    sourceId: string,
    layer: LyraMapGeoJsonDataLayer,
    cluster: NormalizedClusterOptions,
  ): void {
    if (!this._map) return;
    const tone = layer.tone;
    const stroke = resolvedLayerColor(this, layer.strokeColor ?? layer.color, tone);
    const clusterId = `${sourceId}-cluster`;
    const countId = `${sourceId}-cluster-count`;
    const circleId = `${sourceId}-circle`;
    const clusterColor = this.clusterColorExpression(layer, cluster);
    const clusterRadius = stepExpression(['get', 'point_count'], cluster.radiusSteps);
    const countColor = resolvedLayerColor(this, `var(${ON_TONE_TOKEN[tone ?? 'accent']})`, tone);
    if (!this._map.getLayer(clusterId)) {
      this._map.addLayer({
        id: clusterId,
        type: 'circle',
        source: sourceId,
        filter: ['has', 'point_count'],
        paint: {
          'circle-color': clusterColor,
          'circle-radius': clusterRadius,
          'circle-stroke-width': 1,
          'circle-stroke-color': stroke,
        },
      });
    }
    // A text layer needs glyphs from the style itself. Adding one against a style that declares
    // none paints nothing and emits peer errors on every render, so the count is simply omitted
    // there -- the graduated circle still carries the magnitude, and the count stays available on
    // `lr-map-click`.
    if (this.styleProvidesGlyphs() && !this._map.getLayer(countId)) {
      this._map.addLayer({
        id: countId,
        type: 'symbol',
        source: sourceId,
        filter: ['has', 'point_count'],
        layout: {
          'text-field': ['get', 'point_count_abbreviated'],
          'text-size': 12,
          ...(cluster.countFont ? { 'text-font': [...cluster.countFont] } : {}),
        },
        paint: { 'text-color': countColor },
      });
    }
    if (!this._map.getLayer(circleId)) {
      this._map.addLayer({
        id: circleId,
        type: 'circle',
        source: sourceId,
        filter: ['all', ['==', ['geometry-type'], 'Point'], ['!', ['has', 'point_count']]],
        paint: { 'circle-color': stroke, 'circle-radius': 5 },
      });
    }
    this.paintClusterLayers(sourceId, layer, cluster);
  }

  /** Paint-only half of `applyClusterLayers`. */
  private paintClusterLayers(
    sourceId: string,
    layer: LyraMapGeoJsonDataLayer,
    cluster: NormalizedClusterOptions,
  ): void {
    if (!this._map) return;
    const tone = layer.tone;
    const stroke = resolvedLayerColor(this, layer.strokeColor ?? layer.color, tone);
    const clusterId = `${sourceId}-cluster`;
    this._map.setPaintProperty(clusterId, 'circle-color', this.clusterColorExpression(layer, cluster));
    this._map.setPaintProperty(
      clusterId,
      'circle-radius',
      stepExpression(['get', 'point_count'], cluster.radiusSteps),
    );
    this._map.setPaintProperty(clusterId, 'circle-stroke-color', stroke);
    // Gated on the same glyph condition that decided whether to add the layer at all, rather than
    // on a `getLayer` probe: a repaint must not query map structure (see `refreshThemePaint`).
    if (this.styleProvidesGlyphs()) {
      this._map.setPaintProperty(
        `${sourceId}-cluster-count`,
        'text-color',
        resolvedLayerColor(this, `var(${ON_TONE_TOKEN[tone ?? 'accent']})`, tone),
      );
    }
    this._map.setPaintProperty(`${sourceId}-circle`, 'circle-color', stroke);
  }

  /** The single `heatmap` layer `kind: 'heatmap'` renders, in place of the geometry split. */
  private applyHeatmapLayer(sourceId: string, layer: LyraMapGeoJsonDataLayer): void {
    if (!this._map) return;
    const heatmapId = `${sourceId}-heatmap`;
    const options = layer.heatmap;
    const weight = heatmapWeightExpression(options);
    const color = this.heatmapColorExpression(layer);
    const radius = heatmapZoomValue(options?.radius, DEFAULT_HEATMAP_RADIUS, 1, 200);
    const intensity = heatmapZoomValue(options?.intensity, DEFAULT_HEATMAP_INTENSITY, 0, 100);
    const opacity = finiteRange(Number(options?.opacity), 1, 0, 1);
    if (!this._map.getLayer(heatmapId)) {
      this._map.addLayer({
        id: heatmapId,
        type: 'heatmap',
        source: sourceId,
        paint: {
          ...(weight ? { 'heatmap-weight': weight } : {}),
          'heatmap-intensity': intensity,
          'heatmap-color': color,
          'heatmap-radius': radius,
          ...(options?.opacity === undefined ? {} : { 'heatmap-opacity': opacity }),
        },
      });
      return;
    }
    this.paintHeatmapLayer(sourceId, layer);
  }

  /** Paint-only half of `applyHeatmapLayer`. */
  private paintHeatmapLayer(sourceId: string, layer: LyraMapGeoJsonDataLayer): void {
    if (!this._map) return;
    const heatmapId = `${sourceId}-heatmap`;
    // `?? 1` rather than a skip: an update that DROPS `weightField` has to put the layer back on
    // MapLibre's own uniform weight, and leaving the previous expression in place would keep
    // weighting by a property the consumer no longer asked for.
    this._map.setPaintProperty(
      heatmapId,
      'heatmap-weight',
      heatmapWeightExpression(layer.heatmap) ?? 1,
    );
    this._map.setPaintProperty(
      heatmapId,
      'heatmap-intensity',
      heatmapZoomValue(layer.heatmap?.intensity, DEFAULT_HEATMAP_INTENSITY, 0, 100),
    );
    this._map.setPaintProperty(heatmapId, 'heatmap-color', this.heatmapColorExpression(layer));
    this._map.setPaintProperty(
      heatmapId,
      'heatmap-radius',
      heatmapZoomValue(layer.heatmap?.radius, DEFAULT_HEATMAP_RADIUS, 1, 200),
    );
    this._map.setPaintProperty(
      heatmapId,
      'heatmap-opacity',
      finiteRange(Number(layer.heatmap?.opacity), 1, 0, 1),
    );
  }

  /**
   * `['interpolate', ['linear'], ['heatmap-density'], …]` over the authored ramp, or the shared
   * token ramp when none is usable. Colors resolve through the host first, since MapLibre paints to
   * a WebGL canvas and never sees a `var()`.
   *
   * One authored stop is enough, as long as it sits above density 0: the transparent floor this
   * prepends anyway makes it a real two-stop ramp, and `[[1, hot]]` is the most natural way to spell
   * "transparent to hot". The token ramp takes over only when the result still cannot interpolate --
   * a lone stop AT density 0, which describes a flat colour rather than a gradient.
   */
  private heatmapColorExpression(layer: LyraMapGeoJsonDataLayer): unknown[] {
    const tone = layer.tone;
    const authored = normalizedSteps(layer.heatmap?.stops, isColorOutput, (threshold) =>
      finiteRange(threshold, 0, 0, 1),
    ).map(([density, color]) => [density, resolvedLayerColor(this, color, tone)] as const);
    const authoredRamp = withTransparentFloor(authored);
    const ramp =
      authoredRamp.length >= 2
        ? authoredRamp
        : withTransparentFloor(
            HEATMAP_RAMP_TOKENS.map(
              ([density, token]) =>
                [density, resolvedLayerColor(this, `var(${token})`, tone)] as const,
            ),
          );
    const expression: unknown[] = ['interpolate', ['linear'], ['heatmap-density']];
    for (const [density, color] of ramp) expression.push(density, color);
    return expression;
  }

  /**
   * Whether the active style can render text at all. Prefers the live style (a `mapStyle` URL's
   * glyph source is only knowable once loaded) and falls back to the declarative specification.
   */
  private styleProvidesGlyphs(): boolean {
    try {
      const live = (this._map as { getStyle?: () => unknown } | undefined)?.getStyle?.();
      const liveGlyphs = (live as { glyphs?: unknown } | undefined)?.glyphs;
      if (typeof liveGlyphs === 'string' && liveGlyphs.trim().length > 0) return true;
    } catch {
      // A peer that cannot report its style yet simply has no glyph source to offer.
    }
    const declared = this.mapStyle;
    const declaredGlyphs =
      declared && typeof declared === 'object' ? (declared as { glyphs?: unknown }).glyphs : undefined;
    return typeof declaredGlyphs === 'string' && declaredGlyphs.trim().length > 0;
  }

  /** Allocates a private source/layer namespace that cannot overwrite base-style resources. */
  private resolveDataLayerSourceId(publicSourceId: string): string {
    const applied = this._appliedDataLayerIds.get(publicSourceId);
    if (applied) return applied;
    let sourceId: string;
    do {
      sourceId = `lr-data-layer-${this._nextDataLayerId++}`;
    } while (
      this._map?.getSource(sourceId) ||
      DATA_LAYER_SUFFIXES.some((suffix) => this._map?.getLayer(`${sourceId}${suffix}`))
    );
    return sourceId;
  }

  /** Removes one previously-applied `dataLayers` entry's source/layers, if present. */
  private removeDataLayer(publicSourceId: string): void {
    if (!this._map) return;
    const sourceId = this._appliedDataLayerIds.get(publicSourceId);
    if (!sourceId) return;
    for (const suffix of DATA_LAYER_SUFFIXES) {
      const layerId = `${sourceId}${suffix}`;
      if (this._map.getLayer(layerId)) this._map.removeLayer(layerId);
    }
    if (this._map.getSource(sourceId)) this._map.removeSource(sourceId);
    this._appliedDataLayerIds.delete(publicSourceId);
    this._appliedDataLayerShapes.delete(publicSourceId);
    this._appliedGeoJson.delete(sourceId);
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
    const explicitIds = new Set<string>();
    // First-N deterministic truncation -- see `MAX_MAP_MARKERS` above.
    const markers = Array.isArray(this.markers) ? this.markers.slice(0, MAX_MAP_MARKERS) : [];
    for (const candidate of markers) {
      const lngLat = this.validMarkerLngLat(candidate);
      if (!lngLat) continue;
      const m = candidate as LyraMapMarker;
      const rawId: unknown = m.id;
      let key: string;
      let id: string | undefined;
      if (rawId !== undefined) {
        if (typeof rawId !== 'string') continue;
        id = rawId.trim();
        if (id.length === 0 || explicitIds.has(id)) continue;
        explicitIds.add(id);
        key = `id:${id}`;
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
        const existingElement = existing.getElement?.();
        if (existingElement) this.markerActivationDetails.delete(existingElement);
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
      const markerLabel = m.label?.trim() || (m.unsafeHtml ? popupText(this, m.unsafeHtml) : '');
      this._markerLabels.set(key, markerLabel || undefined);
      const markerElement = (this._markerInstances.get(key) as { getElement?: () => HTMLElement } | undefined)
        ?.getElement?.();
      if (markerElement) {
        addPartToken(markerElement, 'marker');
        markerElement.setAttribute('aria-label', markerLabel || this.localize('map'));
        markerElement.setAttribute('lang', this.effectiveLocale);
        const currentMarker = this._markerInstances.get(key);
        this.configureMarkerInteraction(markerElement, {
          id,
          lngLat,
          marker: m,
        });
        const popup = currentMarker?.getPopup();
        if (popup && currentMarker) {
          this.configurePopupSemantics(key, currentMarker, popup);
          this.syncPopupSemantics(key, currentMarker, popup);
        } else {
          markerElement.removeAttribute('aria-controls');
          markerElement.removeAttribute('aria-expanded');
          markerElement.removeAttribute('aria-haspopup');
        }
      }
    }
    for (const [key, marker] of this._markerInstances) {
      if (!visible.has(key)) {
        const markerElement = marker.getElement?.();
        if (markerElement) this.markerActivationDetails.delete(markerElement);
        marker.remove();
        this._markerInstances.delete(key);
        this._markerColors.delete(key);
        this._markerLabels.delete(key);
        this._markerPopupIds.delete(key);
      }
    }
  }

  private readonly configuredMarkerElements = new WeakSet<HTMLElement>();

  private configureMarkerInteraction(
    markerElement: HTMLElement,
    activation: Omit<LyraMapMarkerActivationDetail, 'source'>,
  ): void {
    this.markerActivationDetails.set(markerElement, activation);
    markerElement.setAttribute('role', 'button');
    markerElement.tabIndex = 0;
    const markerLabel = activation.marker.label?.trim()
      || (activation.marker.unsafeHtml ? popupText(this, activation.marker.unsafeHtml) : '');
    markerElement.setAttribute('aria-label', markerLabel || this.localize('map'));
    markerElement.setAttribute('lang', this.effectiveLocale);
    if (this.configuredMarkerElements.has(markerElement)) return;
    this.configuredMarkerElements.add(markerElement);
    markerElement.addEventListener('click', (event) => {
      if (event.defaultPrevented) return;
      this.emitMarkerActivation(markerElement, 'pointer');
    });
    markerElement.addEventListener('keydown', (event) => {
      if (
        (event.key !== ' ' && event.key !== 'Enter') ||
        event.repeat ||
        event.defaultPrevented
      ) return;
      // MapLibre owns any popup toggle on its later keypress handler. Suppress only Space's page
      // scroll here while preserving propagation, then publish the same activation as Enter.
      if (event.key === ' ') event.preventDefault();
      this.emitMarkerActivation(markerElement, 'keyboard');
    }, { capture: true });
  }

  private emitMarkerActivation(
    markerElement: HTMLElement,
    source: LyraMapMarkerActivationSource,
  ): void {
    if (!this.isConnected) return;
    const activation = this.markerActivationDetails.get(markerElement);
    if (!activation) return;
    this.emit('lr-map-marker-activate', { ...activation, source });
  }

  private get effectiveMapLabel(): string {
    return this.getAttribute('aria-label') === '' ? '' : (this.label || this.localize('map'));
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

  private stopObservingMapAllocation(): void {
    this.mapResizeObserver?.disconnect();
    this.mapResizeObserver = undefined;
    this.observedMapContainer = undefined;
  }

  /** Keeps MapLibre's canvas allocation synchronized with this component's live container. */
  private observeMapAllocation(
    map: MapLibreMapCapability,
    container: HTMLElement,
  ): void {
    this.stopObservingMapAllocation();
    const ResizeObserverCtor = container.ownerDocument.defaultView?.ResizeObserver;
    if (!ResizeObserverCtor) return;
    let observer: ResizeObserver;
    observer = new ResizeObserverCtor(() => {
      if (
        this.mapResizeObserver !== observer ||
        this.observedMapContainer !== container ||
        this.containerEl !== container ||
        this._map !== map ||
        !this.isConnected
      ) return;
      try {
        map.resize();
      } catch {
        // A peer can be disposing in the same delivery turn; the next live allocation retries.
      }
    });
    this.mapResizeObserver = observer;
    this.observedMapContainer = container;
    try {
      observer.observe(container);
    } catch {
      this.stopObservingMapAllocation();
    }
  }

  private stopObservingPeerChrome(): void {
    this.peerChromeObserver?.disconnect();
    this.peerChromeObserver = undefined;
    this.observedPeerContainer = undefined;
  }

  /** Projects stable Lyra parts onto peer-owned nodes without erasing existing part tokens. */
  private syncPeerChromeParts(root: ParentNode = this.containerEl ?? this.renderRoot): void {
    const selectors: ReadonlyArray<readonly [string, string]> = [
      ['.maplibregl-marker', 'marker'],
      ['.maplibregl-popup', 'popup'],
      ['.maplibregl-popup-content', 'popup-content'],
      ['.maplibregl-popup-close-button', 'popup-close-button'],
      ['.maplibregl-ctrl-attrib', 'attribution'],
      ['.maplibregl-ctrl-attrib-button', 'attribution-toggle'],
    ];
    for (const [selector, part] of selectors) {
      const candidate = root as ParentNode & { matches?: (value: string) => boolean };
      if (candidate.matches?.(selector)) addPartToken(candidate as unknown as Element, part);
      for (const element of root.querySelectorAll(selector)) addPartToken(element, part);
    }
  }

  private observePeerChrome(): void {
    const container = this.containerEl;
    if (!container) return;
    this.syncPeerChromeParts(container);
    if (this.observedPeerContainer === container && this.peerChromeObserver) return;
    this.stopObservingPeerChrome();
    const MutationObserverCtor = container.ownerDocument.defaultView?.MutationObserver;
    if (!MutationObserverCtor) return;
    this.observedPeerContainer = container;
    this.peerChromeObserver = new MutationObserverCtor((records) => {
      if (!this.isConnected || this.containerEl !== container) return;
      for (const record of records) {
        for (const node of record.addedNodes) {
          if (node.nodeType === Node.ELEMENT_NODE) this.syncPeerChromeParts(node as Element);
        }
      }
    });
    this.peerChromeObserver.observe(container, { childList: true, subtree: true });
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
    markerElement.setAttribute('aria-haspopup', 'dialog');
    markerElement.setAttribute('aria-expanded', popup?.isOpen?.() ? 'true' : 'false');
    const popupElement = popup?.getElement?.() as HTMLElement | undefined;
    if (!popupElement) return;
    addPartToken(markerElement, 'marker');
    addPartToken(popupElement, 'popup');
    popupElement.id = id;
    popupElement.setAttribute('role', 'dialog');
    popupElement.setAttribute('lang', this.effectiveLocale);
    popupElement.setAttribute(
      'aria-label',
      this._markerLabels.get(key) || this.effectiveMapLabel,
    );
    const popupContent = popupElement.querySelector('.maplibregl-popup-content');
    if (popupContent) addPartToken(popupContent, 'popup-content');
    const closeButton = popupElement.querySelector('.maplibregl-popup-close-button');
    if (closeButton) addPartToken(closeButton, 'popup-close-button');
    closeButton?.setAttribute('aria-label', this.localize('close'));
  }

  private syncMapSemantics(): void {
    const canvas = this._map?.getCanvas?.() as HTMLCanvasElement | undefined;
    if (canvas) {
      canvas.setAttribute('aria-label', this.effectiveMapLabel);
      canvas.setAttribute('lang', this.effectiveLocale);
      if (this.legend.length || this.legendProjection.truncated) {
        canvas.setAttribute('aria-describedby', 'map-legend');
      }
      else canvas.removeAttribute('aria-describedby');
    }
    for (const [key, marker] of this._markerInstances) {
      const markerElement = marker.getElement?.() as HTMLElement | undefined;
      if (!markerElement) continue;
      addPartToken(markerElement, 'marker');
      markerElement.setAttribute('role', 'button');
      markerElement.tabIndex = 0;
      markerElement.setAttribute(
        'aria-label',
        this._markerLabels.get(key) || this.localize('map'),
      );
      markerElement.setAttribute('lang', this.effectiveLocale);
      const popup = marker.getPopup?.();
      if (popup) this.syncPopupSemantics(key, marker, popup);
      else {
        markerElement.removeAttribute('aria-controls');
        markerElement.removeAttribute('aria-expanded');
        markerElement.removeAttribute('aria-haspopup');
      }
    }
    this.syncPeerChromeParts();
  }

  private formatCount(value: number): string {
    return getNumberFormat(this.effectiveLocale).format(value);
  }

  private legendLimitText(): string {
    return this.localize('paginationSummary', undefined, {
      start: this.formatCount(this.legend.length === 0 ? 0 : 1),
      end: this.formatCount(this.legend.length),
      total: this.formatCount(this.legendProjection.inputCount),
      itemLabel: this.localize('items'),
    });
  }

  private onLegendSlotChange = (event: Event): void => {
    const slot = event.target as HTMLSlotElement;
    this.hasLegendSlot = slot.assignedNodes({ flatten: true }).some(
      (node) =>
        node.nodeType === Node.ELEMENT_NODE ||
        (node.textContent ?? '').trim().length > 0,
    );
  };

  /**
   * The continuous gradient bar plus its two endpoint captions, or nothing when `legendGradient`
   * holds fewer than two usable stops. Part names mirror `lr-heatmap`'s
   * `legend-lo`/`legend-hi` so a consumer styling both components learns one vocabulary.
   */
  private renderLegendGradient(): TemplateResult | typeof nothing {
    const stops = this.legendGradient;
    if (stops.length < 2) return nothing;
    const lo = stops[0]!;
    const hi = stops[stops.length - 1]!;
    const span = hi[0] - lo[0];
    // Position every intermediate stop at its true proportion of the value range, so the bar shows
    // the ramp the `interpolate` expression actually produces rather than evenly spacing colors
    // that are not evenly spaced in value. A zero span (every stop on the same value) can't be
    // divided, so those fall back to even spacing.
    const image = stops
      .map(([value, color], index) => {
        const percent =
          span > 0 ? ((value - lo[0]) / span) * 100 : (index / (stops.length - 1)) * 100;
        return `${color} ${percent}%`;
      })
      .join(', ');
    return html`<div class="legend-gradient">
      <span part="legend-lo">${this.legendGradientLoLabel ?? this.formatCount(lo[0])}</span>
      <span
        part="legend-gradient"
        class="gradient-bar"
        aria-hidden="true"
        inert
        style=${styleMap({ backgroundImage: `linear-gradient(to right, ${image})` })}
      ></span>
      <span part="legend-hi">${this.legendGradientHiLabel ?? this.formatCount(hi[0])}</span>
    </div>`;
  }

  override render(): TemplateResult {
    // Lit's own whitespace/comment marker nodes around the `${...}` binding mean
    // `[part="legend"]` is never truly `:empty` in CSS even with zero entries, so
    // the panel is omitted only when both the bounded legend and its projection result are empty
    // rather than relying on a CSS `:empty` selector that can never match.
    return html`
      <div
        part="base"
        aria-busy=${String(this.loading)}
      >
        ${this.failure
          ? html`<div part="error">${this.failureMessage()}</div>`
          : this.loading
            ? html`
                <span class="sr-only">${this.localize('loading')}</span>
          <lr-skeleton shape="rect" .announce=${false}></lr-skeleton>
              `
            : html`<div part="container" id="map-container" lang=${this.effectiveLocale}></div>`}
        ${this.legend.length ||
        this.legendProjection.truncated ||
        this.legendGradient.length ||
        this.hasLegendSlot ||
        this.probeLegendSlot()
          ? html`<div
              part="legend"
              id="map-legend"
              role="group"
              aria-label=${this.localize('mapLegend')}
              aria-controls="map-container"
              data-truncated=${String(this.legendProjection.truncated)}
            >
              ${this.renderLegendGradient()}
              <div class="legend-list" role="list">
                ${this.legend.map((entry, index) => {
                  const bg = sanitizeCssColor(entry.color);
                  return html`<div
                    class="legend-row"
                    role="listitem"
                    aria-posinset=${String(index + 1)}
                    aria-setsize=${String(this.legendProjection.inputCount)}
                  >
                    <span
                      part="legend-swatch"
                      data-pattern=${entry.pattern}
                      aria-hidden="true"
                      inert
                      style=${styleMap(bg ? { backgroundColor: bg } : {})}
                    ></span>
                    <span>${entry.label}</span>
                  </div>`;
                })}
              </div>
              ${this.legendProjection.truncated
                ? html`<div id="map-legend-limit" part="legend-limit">
                    ${this.legendLimitText()}
                  </div>`
                : nothing}
              <slot name="legend" @slotchange=${this.onLegendSlotChange}></slot>
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
