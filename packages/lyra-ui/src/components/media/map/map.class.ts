import { MapPaintBatch } from './map-paint-batch.js';
import type { MapExternalSourceEffects } from './map-external-source-effects.js';
import { collectionSupport } from '../../../internal/collection-snapshot.js';
import { snapshotMapStyle } from './map-style-input.js';
import { html, nothing, type TemplateResult, type PropertyValues } from 'lit';
import { property, query, state } from 'lit/decorators.js';
import { styleMap } from 'lit/directives/style-map.js';
import type { Feature, FeatureCollection } from 'geojson';
import { LyraElement } from '../../../internal/lyra-element.js';
import { HostDescriptionController } from '../../../internal/aria-controls.js';
import { GlassScrollLayer } from '../../../internal/glass-scroll-layer.js';
import {
  getInheritedPropertyDescriptor,
  getOwnDataDescriptor,
  isPlainDataRecord,
  type OwnDataDescriptorResult,
  MISSING_OWN_DATA_DESCRIPTOR,
  readOwnArrayLength,
  UNSAFE_OWN_DATA_DESCRIPTOR,
} from '../../../internal/data-descriptors.js';
import { literalSetConverter, trueDefaultBooleanConverter } from '../../../internal/converters.js';
import { devWarnOnce } from '../../../internal/dev-mode-attribute-warning.js';
import { litDevWarnings } from '../../../internal/dev-warning.js';
import { chevronIcon } from '../../../internal/icons.js';
import { sanitizeCssColor } from '../../../internal/safe-css.js';
import { DEFAULT_CANVAS_COLOR, resolveCanvasColor } from '../../../internal/canvas-color.js';
import { finiteDuration, finiteRange } from '../../../internal/numbers.js';
import { prefersReducedMotion } from '../../../internal/motion.js';
import { getNumberFormat } from '../../../internal/intl-cache.js';
import { notifyMapCanvasReady } from '../../../internal/map-canvas-ready.js';
import { AnnouncementSinkController } from '../../../internal/announcer.js';
import { hostAriaLabel, srOnly } from '../../../internal/a11y.js';
import { ThemeWatcher } from '../../../internal/theme-watcher.js';
import type { LyraMapAnchorBoundary, LyraMapAnchorCloseDetail, LyraMapAnchorSafeArea } from './map-anchor-options.js';
import type { MapAnchorController, MapAnchorHost } from './map-anchor-controller.js';
export type { LyraMapAnchorBoundary, LyraMapAnchorSafeArea, LyraMapAnchorCloseReason, LyraMapAnchorCloseDetail } from './map-anchor-options.js';
import {
  loadMapControl,
  loadMaplibre,
  loadModularMap,
  type LyraMapFeatureRequirements,
  type MapLibreGeoJsonSource,
  type MapLibreSourceDataDiff,
  type MapLibreMapCapability,
  type MapLibreMarkerCapability,
  type MapLibrePopupCapability,
  type MaplibreModule,
} from './map-loader.js';
import { styles } from './map.styles.js';
import { mapLayerHittable, queryMapHit, type MapHitRule, type LyraMapFeatureValue } from './map-hit-test.js';
export type { LyraMapFeatureValue } from './map-hit-test.js';
import { flattenedParentElement } from '../../../internal/composed-tree.js';
import { MapFeatureStateRouter, type MapFeatureStateRoute, type LyraMapFeatureOrigin, type LyraMapFeatureStateTarget,
  type LyraMapResolvedFeatureStateTarget } from './map-feature-state-router.js';
import type { MapFeatureStateRoutes } from './map-feature-state-routes.js';
import type { LyraMapFeatureState, MapFeatureStatePeer } from './map-feature-state.js';
export type { LyraMapFeatureState, LyraMapFeatureStateValue, LyraMapFeatureIdentifier } from './map-feature-state.js';
export type { LyraMapFeatureOrigin, LyraMapFeatureStateTarget, LyraMapResolvedFeatureStateTarget } from './map-feature-state-router.js';
import type { MapDrawingError, LyraMapDrawingSnapshot, LyraMapDrawingMode, LyraMapDrawingCancelReason, LyraMapDrawingCancelDetail,
  LyraMapDrawingVertexEndDetail } from './map-drawing.js';
import type { MapDrawingController, MapDrawingHost } from './map-drawing-controller.js';
export type { LyraMapDrawingSnapshot, LyraMapDrawingMetrics, LyraMapDrawingMode, LyraMapDrawingPoint, LyraMapDrawingCancelReason,
  LyraMapDrawingCancelDetail, LyraMapDrawingVertexEndDetail } from './map-drawing.js';
const DRAW_MODE = literalSetConverter<LyraMapDrawingMode>(['none', 'line', 'polygon'], 'none');
/** URL fragment form that `hash` reads and writes: a `key=` field, or the engine's unnamed token. */
export type LyraMapHashFormat = 'named' | 'unnamed';
const HASH_FORMAT = literalSetConverter<LyraMapHashFormat>(['named', 'unnamed'], 'named');
// Closed message-key sets: each table lists exactly the keys its feedback can show.
const MAP_CONFIGURATION_MESSAGE = {
  mapHashConflict: 'mapHashConflict', mapHashInvalid: 'mapHashInvalid', mapControlUnavailable: 'mapControlUnavailable',
  mapGeolocatePermissionDenied: 'mapGeolocatePermissionDenied', mapGeolocatePositionUnavailable: 'mapGeolocatePositionUnavailable',
  mapGeolocateTimeout: 'mapGeolocateTimeout', mapGeolocateError: 'mapGeolocateError', mapGeolocateOutOfBounds: 'mapGeolocateOutOfBounds',
} as const;
const MAP_SCALE_UNIT_MESSAGE = {
  mapScaleFeet: 'mapScaleFeet', mapScaleMeters: 'mapScaleMeters', mapScaleKilometers: 'mapScaleKilometers',
  mapScaleMiles: 'mapScaleMiles', mapScaleNauticalMiles: 'mapScaleNauticalMiles',
} as const;
const MAP_DRAWING_MESSAGE = {
  mapDrawingUnavailable: 'mapDrawingUnavailable', mapDrawingInvalidCoordinate: 'mapDrawingInvalidCoordinate',
  mapDrawingDuplicateVertex: 'mapDrawingDuplicateVertex', mapDrawingVertexLimit: 'mapDrawingVertexLimit',
  mapDrawingTooFewVertices: 'mapDrawingTooFewVertices', mapDrawingInvalidGeometry: 'mapDrawingInvalidGeometry',
} as const;
/** The settled temporary-resource work of an element whose drawing runtime is not loaded. */
const NO_DRAWING_WORK: Promise<void> = Promise.resolve();
/** The admitted form of the default, empty `overlays`, `images` and `styleOverrides`. */
const NO_OWNED_FEATURES: MapOwnedFeatureInput = Object.freeze({
  overlays: Object.freeze({ sources: Object.freeze([]), layers: Object.freeze([]) }),
  images: Object.freeze([]), styleOverrides: Object.freeze([]),
});
/** Conservatively true unless every input is an empty plain default, which needs no admission. */
function ownedFeaturesRequested(overlays: unknown, images: unknown, styleOverrides: unknown): boolean {
  try {
    const empty = (value: unknown): boolean => Array.isArray(value) && Object.getPrototypeOf(value) === Array.prototype && readOwnArrayLength(value) === 0;
    return !(isPlainDataRecord(overlays) && Object.getPrototypeOf(overlays) === Object.prototype && Reflect.ownKeys(overlays).length === 0 &&
      empty(images) && empty(styleOverrides));
  } catch { return true; }
}
import { MapCursorOwner } from './map-cursor.js';
import { mapCoordinates, mapOwnValue, renderedSizeKey } from './map-readers.js';
import { projectMapInteractionOptions, projectMapBasemapInteractions, expandMapStyleLayerTargets, type LyraMapInteractionOptions,
  type LyraMapBasemapInteraction, type CanonicalMapInteraction, type LyraMapStyleLayer, type LyraMapStyleSource } from './map-interaction-options.js';
export type { LyraMapInteractionOptions, LyraMapBasemapInteraction, LyraMapStyleLayerSelector, LyraMapStyleLayer,
  LyraMapStyleSource } from './map-interaction-options.js';
import type { MapHashOwner } from './map-hash-owner.js';
import type { MapHashCamera } from './map-hash.js';
import { MAP_HASH_UNNAMED } from './map-hash-option.js';
import { normalizeMapControlOptions, type LyraMapGeolocateControlOptions, type LyraMapAttributionControlOptions, type LyraMapGeolocationErrorCode,
  type LyraMapNavigationControlOptions, type LyraMapScaleControlOptions } from './map-control-options.js';
export type { LyraMapControlPosition, LyraMapScaleUnit, LyraMapNavigationControlOptions, LyraMapScaleControlOptions,
  LyraMapGeolocateControlOptions, LyraMapAttributionControlOptions, LyraMapAttributionLink, LyraMapGeolocationErrorCode } from './map-control-options.js';
import type { MapControlLifecyclePeer, MapControlsLifecycle } from './map-controls-lifecycle.js';
import { MapEngineEvents } from './map-engine-events.js';
import { MapReadiness } from './map-readiness.js';
import { LyraMapImageExportError, type LyraMapImageExportOptions, type LyraMapImageExportErrorCode } from './map-image-export-error.js';
import type { MapImageExportController, MapImageExportHost, MapImageExportRequest } from './map-image-export-controller.js';
import { loadMapAnchorRuntime, loadMapControlRuntime, loadMapDrawingRuntime, loadMapFeatureStateRuntime, loadMapHashRuntime,
  loadMapImageExportRuntime, loadMapOwnedFeatureRuntime } from './map-feature-loader.js';
export { LyraMapImageExportError } from './map-image-export-error.js';
export type { LyraMapImageExportOptions, LyraMapImageExportType, LyraMapImageExportErrorCode } from './map-image-export-error.js';
export interface LyraMapImageExportErrorDetail { readonly code: LyraMapImageExportErrorCode; }
import { createMapConstructionScheduler, type MapConstructionScheduler, type LyraMapInitialization } from './map-construction-scheduler.js';
export type { LyraMapInitialization } from './map-construction-scheduler.js';
import type { MapOwnedFeatures } from './map-owned-features.js';
import type { MapOwnedFeatureInput } from './map-owned-feature-input.js';
import type { MapOwnedOverlaySnapshot, LyraMapOverlaySource, LyraMapOverlayLayer } from './map-overlay-admission.js';
import type { LyraMapImage } from './map-image-admission.js';
import type { LyraMapImageProvider } from './map-image-provider.js';
export type { LyraMapImageProvider } from './map-image-provider.js';
import type { MapLayerOrderGroup } from './map-layer-order.js';
import { projectMapDataLayerModel, projectMapRowPlacement, projectMapLabelOptions, buildMapLabelLayer, buildMapExternalLayers,
  type CanonicalMapExternalLayer, type CanonicalMapLabel, type LyraMapExternalDataLayer, type LyraMapLabelOptions } from './map-data-layer-model.js';
export type { LyraMapVectorPaintProperty, LyraMapVectorLayoutProperty, LyraMapVectorStyleExpression,
  LyraMapVectorNumericValue, LyraMapVectorColorValue, LyraMapVectorPaint, LyraMapVectorLayout } from './map-vector-style.js';
export type { LyraMapSourceCoordinates, LyraMapLabelValue, LyraMapLabelOptions, LyraMapLabelAnchor, LyraMapTileSource,
  LyraMapExternalDataLayerOptions, LyraMapVectorDataLayer, LyraMapRasterDataLayer, LyraMapImageDataLayer,
  LyraMapCanvasDataLayer, LyraMapExternalDataLayer } from './map-data-layer-model.js';
/** Existing GeoJSON overlays and explicitly discriminated native external-source families. */
export type LyraMapDataLayer = LyraMapGeoJsonDataLayer | LyraMapExternalDataLayer;

import type { LyraMapStyleOverride, LyraMapStyleValue } from './map-style-override-admission.js';

export type { LyraMapOverlaySource, LyraMapOverlayLayer } from './map-overlay-admission.js';
/** Declarative native resources restored after every style replacement. */
export interface LyraMapOverlays {
  readonly sources?: readonly LyraMapOverlaySource[];
  readonly layers?: readonly LyraMapOverlayLayer[];
}
export type { LyraMapImage } from './map-image-admission.js';
export type { LyraMapStyleOverride, LyraMapStyleValue } from './map-style-override-admission.js';
import {
  emptyExtent,
  extendExtent,
  extendExtentWithGeoJson,
  extentToBounds,
  normalizeCameraOptions,
  type LyraMapCameraOptions,
  type MapCameraTarget,
} from './map-camera.js';
export type { LyraMapCameraOptions } from './map-camera.js';
import type { LyraMapStyleSpecification } from './map-empty-style.js';
export { LYRA_MAP_EMPTY_STYLE, type LyraMapStyleSpecification } from './map-empty-style.js';
import {
  projectGeoJson,
  projectAdmittedGeoJson,
  buildProjectedGeoJsonPropertyDiff,
  type CanonicalGeoJsonProjection,
} from './map-geojson-diff.js';
export { buildGeoJsonPropertyDiff } from './map-geojson-diff.js';
import {
  clusterColorExpression,
  heatmapColorExpression,
  heatmapWeightExpression,
  heatmapZoomValue,
  lineColorExpression,
  mutedCategoryOpacityExpression,
  pointColorExpression,
  pointRadiusExpression,
  stepExpression,
  type MapDataLayerPointRadius,
} from './map-data-layers.js';
import '../../overlays/skeleton/skeleton.class.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_mapActivate, LYRA_DEFAULT_mapCancelDrawing, LYRA_DEFAULT_mapCancelPick, LYRA_DEFAULT_mapCompleteDrawing, LYRA_DEFAULT_mapControlUnavailable, LYRA_DEFAULT_mapDrawAtCenter, LYRA_DEFAULT_mapDrawingArea, LYRA_DEFAULT_mapDrawingControls, LYRA_DEFAULT_mapDrawingDuplicateVertex, LYRA_DEFAULT_mapDrawingEditInstructions, LYRA_DEFAULT_mapDrawingInvalidCoordinate, LYRA_DEFAULT_mapDrawingInvalidGeometry, LYRA_DEFAULT_mapDrawingLength, LYRA_DEFAULT_mapDrawingTooFewVertices, LYRA_DEFAULT_mapDrawingUnavailable, LYRA_DEFAULT_mapDrawingVertex, LYRA_DEFAULT_mapDrawingVertexLimit, LYRA_DEFAULT_mapDrawingVertices, LYRA_DEFAULT_mapExportUnavailable, LYRA_DEFAULT_mapFeatureStateUnavailable, LYRA_DEFAULT_mapFeedback, LYRA_DEFAULT_mapGeolocateError, LYRA_DEFAULT_mapGeolocateFindLocation, LYRA_DEFAULT_mapGeolocateOutOfBounds, LYRA_DEFAULT_mapGeolocatePermissionDenied, LYRA_DEFAULT_mapGeolocatePositionUnavailable, LYRA_DEFAULT_mapGeolocateTimeout, LYRA_DEFAULT_mapGeolocateUnavailable, LYRA_DEFAULT_mapHashConflict, LYRA_DEFAULT_mapHashInvalid, LYRA_DEFAULT_mapInitializationFailed, LYRA_DEFAULT_mapLegend, LYRA_DEFAULT_mapMarker, LYRA_DEFAULT_mapMissingLibrary, LYRA_DEFAULT_mapPickAtCenter, LYRA_DEFAULT_mapResetNorth, LYRA_DEFAULT_mapScaleFeet, LYRA_DEFAULT_mapScaleKilometers, LYRA_DEFAULT_mapScaleMeters, LYRA_DEFAULT_mapScaleMiles, LYRA_DEFAULT_mapScaleNauticalMiles, LYRA_DEFAULT_mapSquareKilometers, LYRA_DEFAULT_mapSquareMeters, LYRA_DEFAULT_mapStyleRequired, LYRA_DEFAULT_mapToggleAttribution, LYRA_DEFAULT_mapUndoDrawing, LYRA_DEFAULT_mapWebglUnavailable } from '../../../internal/default-strings/media.generated.js';
import { LYRA_DEFAULT_cancel, LYRA_DEFAULT_close, LYRA_DEFAULT_collapse, LYRA_DEFAULT_copy, LYRA_DEFAULT_date, LYRA_DEFAULT_details, LYRA_DEFAULT_duration, LYRA_DEFAULT_items, LYRA_DEFAULT_legendTypeHidden, LYRA_DEFAULT_legendTypeShown, LYRA_DEFAULT_loading, LYRA_DEFAULT_map, LYRA_DEFAULT_navigation, LYRA_DEFAULT_noData, LYRA_DEFAULT_open, LYRA_DEFAULT_paginationSummary, LYRA_DEFAULT_remove, LYRA_DEFAULT_search, LYRA_DEFAULT_select, LYRA_DEFAULT_zoomIn, LYRA_DEFAULT_zoomOut } from '../../../internal/default-strings/shared.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END

/** A caller-authored GeoJSON source diff; feature IDs must be unique and stable. */
export type LyraMapSourceDataDiff = MapLibreSourceDataDiff;

/** Probes for a real WebGL2 context without ever touching maplibre-gl's own (unreliable) failure
 *  path -- see the call site in `tryConstructMap()`. */
function supportsWebGL2(host: Element): boolean {
  try {
    const context = host.ownerDocument.createElement('canvas').getContext('webgl2');
    if (!context) return false;
    try {
      context.getExtension('WEBGL_lose_context')?.loseContext();
    } catch {
      // Capability detection succeeded; explicit release is best-effort on partial implementations.
    }
    return true;
  } catch {
    return false;
  }
}

export type { LyraMapFeatureRequirements } from './map-loader.js';

/** Map engine selected before connecting the component. */
export type LyraMapEngine = 'modular' | 'maplibre';
const MAP_ENGINE = literalSetConverter<LyraMapEngine>(['modular', 'maplibre'], 'modular');

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

/**
 * Presentation role for each keyed `legendInteractive` row's toggle control. See the
 * `legendControlRole` property JSDoc for the full contract.
 */
export type LyraMapLegendControlRole = 'button' | 'checkbox';

const LEGEND_CONTROL_ROLE = literalSetConverter<LyraMapLegendControlRole>(
  ['button', 'checkbox'],
  'button',
);

/** One immutable, bounded map-legend row. Pattern supplies the non-color cue for color-only swatches. */
export interface LyraMapLegendEntry {
  readonly color: string;
  readonly label: string;
  readonly pattern: LyraMapLegendPattern;
  /**
   * Category key this row stands for -- the same string a `point.colors` / `point.icons` entry
   * matches against `point.field` / `point.iconField`. Trimmed, bounded to 256 characters and
   * retained in the canonical readback, unlike the `value` on the `icon` record below, which is
   * still dropped. A row that carries one becomes a keyboard-operable visibility toggle under
   * `legendInteractive`; a row without one stays inert. An absent, non-string, empty or
   * whitespace-only key leaves no `value` key at all.
   */
  readonly value?: string;
  /**
   * Optional glyph painted inside `[part="legend-swatch"]`, in the entry's own color, instead of
   * the solid color block that would otherwise cover it. Deliberately the record `point.icons`
   * already carries, so a key can reproduce the symbol its point layer draws rather than
   * describing it in color alone — hand the legend the very icon object the layer renders.
   *
   * The **icon record's own** `value` is accepted so a pass-through needs no reshaping, and is
   * left out of the canonical readback: a row's category key is the row-level `value` above, and
   * is never derived from the glyph's. Deriving it would silently make a row interactive that the
   * author never marked. Validation is the point icon's own (path data only, at most 8192
   * characters, positive `viewBox` dimensions); an unusable record is dropped and the row keeps
   * rendering its color swatch.
   *
   * That per-record 8192-character cap is deliberately the whole bound on path data, with no
   * aggregate budget of the kind `label` carries across the legend. Two reasons. The admission
   * grammar is shared verbatim with `point.icons` through one projector, so a legend-only
   * aggregate budget would make the same record admissible on the map and rejected in the key
   * describing it — the exact divergence sharing the projector exists to prevent. And a label
   * budget bounds *rendered text*, which is measured, wrapped and announced per character,
   * whereas a path is one inert attribute value on a decorative shape. The rendered total is
   * still finite and stated: at most one glyph per rendered row, so at most 100 of them, each at
   * most 8192 characters. A glyph omission is not counted in `legendProjection` either, because
   * the row it belongs to still renders — only dropped rows are omissions.
   */
  readonly icon?: LyraMapPointIcon | Omit<LyraMapPointIcon, 'value'>;
  /**
   * Optional section this row belongs to.
   *
   * **The grouping rule, which is pinned rather than inferred:** CONSECUTIVE entries sharing an
   * identical `group` render as one section -- a visible heading plus a `role="group"` the heading
   * names. An entry with no `group` keeps its DECLARED position: it is never hoisted above or sunk
   * below a section, and a `group` that reappears after an interruption opens a SECOND section
   * rather than reordering rows to merge them. Declaration order is the one thing the legend never
   * rewrites, because the order is itself information about the map.
   *
   * It is caller-supplied DATA, so it renders verbatim and is never passed through the locale
   * catalog. It is trimmed and bounded to 256 characters (ellipsized, since it is rendered prose
   * rather than a matched key); a non-string, empty or whitespace-only value leaves no `group` key
   * at all, so an empty string means "ungrouped" instead of an empty heading.
   *
   * Like the row-level `value`, it is NOT charged to the aggregate label budget: a budget bounds
   * rendered text, and the rendered total here is already finite and stated -- at most one heading
   * per rendered row, so at most 100 of them, each at most 256 characters. A section is also not a
   * row: the 100-row cap and the `legend-limit` summary count rows, never sections.
   */
  readonly group?: string;
}

/**
 * One `[value, color]` stop of a continuous legend ramp — deliberately the same shape as
 * `LyraMapChoroplethLayer['stops']`, so a consumer passes the choropleth's own stops straight
 * through instead of maintaining a second copy that drifts from the layer it describes.
 */
export type LyraMapLegendGradientStop = readonly [number, string];

/** A labelled mark along the legend gradient bar, at a position in the data's own units. */
export interface LyraMapLegendGradientTick {
  /** Position on the ramp, in the same units as the gradient's stops. A tick outside the ramp's
   *  lowest and highest stop is dropped. */
  readonly value: number;
  /** Caption; caller data, rendered verbatim. Defaults to the locale-formatted `value`. */
  readonly label?: string;
}

const MAX_LEGEND_GRADIENT_TICKS = 16;
const EMPTY_LEGEND_GRADIENT_TICKS: readonly LyraMapLegendGradientTick[] = Object.freeze([]);

/** Admits a bounded, ascending, de-duplicated tick list; a bare number is a tick without a label. */
function normalizeMapLegendGradientTicks(value: unknown): readonly LyraMapLegendGradientTick[] {
  try {
    const scanCount = boundedOwnArrayLength(value, MAX_LEGEND_GRADIENT_TICKS * 4);
    if (scanCount === undefined) return EMPTY_LEGEND_GRADIENT_TICKS;
    const byValue = new Map<number, LyraMapLegendGradientTick>();
    for (let index = 0; index < scanCount && byValue.size < MAX_LEGEND_GRADIENT_TICKS; index += 1) {
      const descriptor = getOwnDataDescriptor(value as object, String(index));
      if (descriptor === MISSING_OWN_DATA_DESCRIPTOR || isUnsafeDescriptor(descriptor)) continue;
      const entry = descriptor.value;
      let tickValue: unknown = entry;
      let label: unknown;
      if (isRuntimeRecord(entry)) {
        tickValue = optionalDescriptorValue(getOwnDataDescriptor(entry, 'value'));
        label = optionalDescriptorValue(getOwnDataDescriptor(entry, 'label'));
      }
      if (typeof tickValue !== 'number' || !Number.isFinite(tickValue) || byValue.has(tickValue)) continue;
      byValue.set(tickValue, Object.freeze(
        typeof label === 'string' && label.trim().length > 0
          ? { value: tickValue, label: boundedLegendText(label.trim(), 64) }
          : { value: tickValue },
      ));
    }
    if (byValue.size === 0) return EMPTY_LEGEND_GRADIENT_TICKS;
    return Object.freeze([...byValue.values()].sort((a, b) => a.value - b.value));
  } catch {
    return EMPTY_LEGEND_GRADIENT_TICKS;
  }
}

/** Upper bound on rendered gradient stops, matching the deterministic-truncation pattern
 *  the marker/data-layer collection bounds use below. A ramp needs a handful of stops; anything
 *  past this is a data bug, and an unbounded loop here would build a pathological gradient. */
const MAX_MAP_LEGEND_GRADIENT_STOPS = 64;

/**
 * Array and record admission is deliberately separate from projection. A value can revoke between
 * either operation, so every boundary reader is contained and later code only sees its canonical
 * result rather than the caller-owned object.
 */
function isRuntimeArray(value: unknown): value is readonly unknown[] {
  try {
    return Array.isArray(value);
  } catch {
    return false;
  }
}

function isRuntimeRecord(value: unknown): value is object {
  try {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
  } catch {
    return false;
  }
}

function boundedOwnArrayLength(value: unknown, limit: number): number | undefined {
  if (!isRuntimeArray(value)) return undefined;
  const descriptor = getOwnDataDescriptor(value, 'length');
  if (
    descriptor === MISSING_OWN_DATA_DESCRIPTOR ||
    descriptor === UNSAFE_OWN_DATA_DESCRIPTOR ||
    typeof descriptor.value !== 'number' ||
    !Number.isSafeInteger(descriptor.value) ||
    descriptor.value < 0
  )
    return undefined;
  return Math.min(descriptor.value, limit);
}

function isUnsafeDescriptor(
  descriptor: ReturnType<typeof getOwnDataDescriptor>,
): descriptor is typeof UNSAFE_OWN_DATA_DESCRIPTOR {
  return descriptor === UNSAFE_OWN_DATA_DESCRIPTOR;
}

function optionalDescriptorValue(
  descriptor: ReturnType<typeof getOwnDataDescriptor>,
): unknown | undefined {
  return descriptor === MISSING_OWN_DATA_DESCRIPTOR || isUnsafeDescriptor(descriptor)
    ? undefined
    : descriptor.value;
}

/**
 * Keeps only finite-value stops carrying a color CSS actually accepts, sorted ascending by value
 * and bounded. Returns an empty array when fewer than two usable stops survive: a one-stop
 * "gradient" is a flat block that describes nothing, so it falls back to rendering no bar at all
 * rather than a misleading solid one.
 */
function normalizeMapLegendGradient(
  value: unknown,
): readonly (readonly [number, string])[] {
  try {
    const scanCount = boundedOwnArrayLength(value, MAX_MAP_LEGEND_GRADIENT_STOPS);
    if (scanCount === undefined) return [];
    const usable: (readonly [number, string])[] = [];
    for (let index = 0; index < scanCount; index += 1) {
      const stopDescriptor = getOwnDataDescriptor(value as object, String(index));
      if (
        stopDescriptor === MISSING_OWN_DATA_DESCRIPTOR ||
        isUnsafeDescriptor(stopDescriptor)
      )
        continue;
      const stop = stopDescriptor.value;
      const stopLength = boundedOwnArrayLength(stop, 2);
      if (stopLength === undefined || stopLength < 2) continue;
      const valueDescriptor = getOwnDataDescriptor(stop as object, '0');
      const colorDescriptor = getOwnDataDescriptor(stop as object, '1');
      if (
        valueDescriptor === MISSING_OWN_DATA_DESCRIPTOR ||
        colorDescriptor === MISSING_OWN_DATA_DESCRIPTOR ||
        isUnsafeDescriptor(valueDescriptor) ||
        isUnsafeDescriptor(colorDescriptor) ||
        typeof valueDescriptor.value !== 'number' ||
        !Number.isFinite(valueDescriptor.value) ||
        typeof colorDescriptor.value !== 'string'
      )
        continue;
      const color = sanitizeCssColor(colorDescriptor.value);
      if (!color) continue;
      usable.push([valueDescriptor.value, color] as const);
    }
    if (usable.length < 2) return [];
    return Object.freeze(
      [...usable].sort((a, b) => a[0] - b[0]),
    ) as readonly (readonly [number, string])[];
  } catch {
    return [];
  }
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
  /** Whether any admitted row carries a `group`, so the ungrouped render path stays literally the
   *  expression it has always been rather than a nested one that merely produces the same nodes. */
  readonly grouped: boolean;
}

const MAP_LEGEND_ITEM_LIMIT = 100;
const MAP_LEGEND_SCAN_LIMIT = 1_000;
const MAP_LEGEND_LABEL_LIMIT = 256;
const MAP_LEGEND_TOTAL_LABEL_LIMIT = 8_192;
const MAP_LEGEND_COLOR_LIMIT = 256;
/** Bounds a row's category key. Sliced, never ellipsized like a label: a key is matched against
 *  `point.field` values, so an appended character would silently stop it matching anything. */
const MAP_LEGEND_VALUE_LIMIT = 256;
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
        value?: unknown;
        group?: unknown;
        icon?: unknown;
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
      const rawValue = candidate.value;
      const trimmedValue = typeof rawValue === 'string' ? rawValue.trim() : '';
      const value = trimmedValue ? trimmedValue.slice(0, MAP_LEGEND_VALUE_LIMIT) : undefined;
      const rawGroup = candidate.group;
      const trimmedGroup = typeof rawGroup === 'string' ? rawGroup.trim() : '';
      // Ellipsized, not sliced: unlike `value`, a group name is rendered prose rather than a key
      // matched against `point.field`, so a visible truncation marker is the honest bound.
      const group = trimmedGroup
        ? boundedLegendText(trimmedGroup, MAP_LEGEND_LABEL_LIMIT)
        : undefined;
      const rawIcon = candidate.icon;
      const icon = isRuntimeRecord(rawIcon) ? projectIconPaint(rawIcon) : undefined;
      entries.push(Object.freeze({
        color: rawColor.slice(0, MAP_LEGEND_COLOR_LIMIT),
        label,
        pattern: rawPattern as LyraMapLegendPattern,
        // An absent or unusable category key leaves no `value` key at all, on the same reasoning as
        // `icon` below: a legend that never used categories reads back byte-identically.
        ...(value ? { value } : {}),
        // Same rule for the section name, so an empty string means "ungrouped" rather than an
        // empty heading and a legend that never used sections reads back byte-identically.
        ...(group ? { group } : {}),
        // An absent or rejected glyph leaves no `icon` key at all, so a color-only row keeps
        // reading back exactly as it did before glyphs existed.
        ...(icon ? { icon } : {}),
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
  return {
    entries: frozenEntries,
    projection,
    grouped: frozenEntries.some((entry) => entry.group !== undefined),
  };
}

const EMPTY_HIDDEN_CATEGORIES = Object.freeze([]) as readonly string[];

/**
 * Bounded, deduplicated, frozen hidden-key snapshot. Mirrors `normalizeMapLegend()`'s
 * descriptor-safe discipline and `chart-legend-visibility.ts`'s `normalizeHiddenDatasets()`: a
 * caller-owned value can revoke between two reads, so every boundary read is contained and later
 * code only sees the canonical result rather than the caller's object.
 *
 * Keys are trimmed and bounded exactly as a legend row's own `value` is, so a key that would
 * match a bounded row still matches it. Duplicates keep their first occurrence, the same
 * first-wins rule `point.colors` applies to the very same category strings.
 */
function normalizeMapHiddenCategories(value: unknown): readonly string[] {
  let input: readonly unknown[];
  let length = 0;
  try {
    input = Array.isArray(value) ? value : [];
    length = Math.max(0, Math.min(MAP_LEGEND_SCAN_LIMIT, input.length));
  } catch {
    return EMPTY_HIDDEN_CATEGORIES;
  }
  const keys: string[] = [];
  for (let index = 0; index < length && keys.length < MAP_LEGEND_ITEM_LIMIT; index++) {
    try {
      const candidate = input[index];
      if (typeof candidate !== 'string') continue;
      const key = candidate.trim().slice(0, MAP_LEGEND_VALUE_LIMIT);
      if (!key || keys.includes(key)) continue;
      keys.push(key);
    } catch {
      // A hostile element is skipped without preventing later valid keys from being admitted.
    }
  }
  return keys.length ? (Object.freeze(keys) as readonly string[]) : EMPTY_HIDDEN_CATEGORIES;
}

/**
 * A legend row's glyph. Painted in `currentColor` so the swatch's inline entry color reaches both
 * fill and stroke through one property — which is also what lets forced-colors mode replace it
 * wholesale, since a system color override lands on `color` and the glyph follows.
 *
 * Decorative by construction: the row's own visible label carries the meaning a sighted reader
 * takes from the shape, and the wrapping swatch is already `aria-hidden` and `inert`.
 */
function renderLegendIcon(
  icon: LyraMapPointIcon | Omit<LyraMapPointIcon, 'value'>,
): TemplateResult {
  const [x, y, width, height] = icon.viewBox ?? DEFAULT_ICON_VIEW_BOX;
  const mode = icon.mode ?? 'fill';
  return html`<svg
    class="legend-icon"
    viewBox=${`${x} ${y} ${width} ${height}`}
    focusable="false"
  ><path
      d=${icon.path}
      fill=${mode === 'stroke' ? 'none' : 'currentColor'}
      stroke=${mode === 'fill' ? 'none' : 'currentColor'}
      stroke-width=${icon.strokeWidth ?? DEFAULT_ICON_STROKE_WIDTH}
      stroke-linecap=${icon.lineCap ?? 'round'}
      stroke-linejoin=${icon.lineJoin ?? 'round'}
    ></path></svg>`;
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
export interface LyraMapChoroplethLayer extends LyraMapInteractionOptions {
  readonly sourceId: string;
  readonly geojson: FeatureCollection;
  readonly field: string;
  /**
   * `[value, color]` pairs, ascending by `value`, fed to a maplibre-gl `interpolate` or `step`
   * expression. CSS custom-property references are resolved against the host before they reach
   * MapLibre's WebGL canvas and refreshed on live ancestor theme changes without rebuilding map
   * sources or layers. Must contain at least one pair -- an empty array can't build a valid
   * expression, so it's ignored (the existing fill layer, if any, is left as-is) rather than
   * applied.
   */
  readonly stops: readonly (readonly [number, string])[];
  /**
   * How the fill color is interpolated between `stops`. `'linear'` (the default) spaces the ramp
   * evenly in value; `'logarithmic'` compresses it, which is
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
   * starts at the data's minimum) need no extra configuration. CSS custom-property references are
   * resolved against the host before reaching MapLibre and refreshed with the stop colors on
   * live theme changes. Set it when the map should distinguish
   * "below the lowest advertised band" from the lowest band itself.
   */
  readonly stepBaseColor?: string;
  /**
   * How features without a usable value paint and are reported. A feature has no value when its
   * `field` property is missing, `null` or not a number. Without `noData`, such a feature is not
   * painted by this layer at all, so an application had to split its data into a second layer to
   * show it. `noData: {}` accepts every default.
   *
   * A click on a no-data feature reports `noData: true` in the `lr-map-click` detail. With
   * `choroplethLegend`, the legend shows a swatch for it, captioned `label`.
   */
  readonly noData?: LyraMapChoroplethNoData;
}

/** Paint and caption for choropleth features that have no value. */
export interface LyraMapChoroplethNoData {
  /** Fill color. A `var(--lr-…)` reference resolves against the host like `stops`. Defaults to the
   *  neutral data tone. */
  readonly color?: string;
  /** Outline color, drawn on no-data features only. Without it they have no distinct outline. */
  readonly strokeColor?: string;
  /** Legend caption. Caller data, rendered verbatim; defaults to the localized "No data". */
  readonly label?: string;
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

/** Number of exact MapLibre interpolation samples retained per legend interval. The public stop
 * count is already bounded, so this remains a bounded amount of inline gradient data. */
const CHOROPLETH_LEGEND_SAMPLES_PER_INTERVAL = 8;

/** MapLibre's exponential interpolation factor, kept in lockstep with the expression emitted for
 * a logarithmic choropleth. */
function choroplethLogInterpolationFactor(input: number, lower: number, upper: number): number {
  const difference = upper - lower;
  if (difference === 0) return 0;
  const progress = input - lower;
  return (
    (Math.pow(CHOROPLETH_LOG_INTERPOLATION_BASE, progress) - 1) /
    (Math.pow(CHOROPLETH_LOG_INTERPOLATION_BASE, difference) - 1)
  );
}

function compactGradientPercent(value: number): string {
  return String(Math.round(Math.min(100, Math.max(0, value)) * 10_000) / 10_000);
}

/**
 * Builds the continuous legend image. Linear choropleths retain the authored stops verbatim;
 * logarithmic choropleths sample the same exponential factor MapLibre evaluates and place those
 * mixed colors at their true data positions. CSS gradients have no exponential easing primitive,
 * so bounded sampling is the narrow way to keep the visible key truthful.
 */
function choroplethLegendGradientImage(
  stops: readonly (readonly [number, string])[],
  interpolation: LyraMapChoroplethInterpolation | undefined,
): string {
  const lo = stops[0]!;
  const hi = stops[stops.length - 1]!;
  const span = hi[0] - lo[0];
  const stopPercent = (value: number, index: number): number =>
    span > 0 ? ((value - lo[0]) / span) * 100 : (index / (stops.length - 1)) * 100;

  if (interpolation !== 'logarithmic' || span <= 0) {
    const image = stops
      .map(
        ([value, color], index) =>
          `${color} ${compactGradientPercent(stopPercent(value, index))}%`,
      )
      .join(', ');
    return `linear-gradient(to right, ${image})`;
  }

  const image = [`${lo[1]} 0%`];
  for (let index = 1; index < stops.length; index += 1) {
    const lower = stops[index - 1]!;
    const upper = stops[index]!;
    const interval = upper[0] - lower[0];
    if (interval <= 0) {
      image.push(`${upper[1]} ${compactGradientPercent(stopPercent(upper[0], index))}%`);
      continue;
    }
    for (let sample = 1; sample <= CHOROPLETH_LEGEND_SAMPLES_PER_INTERVAL; sample += 1) {
      const intervalProgress = sample / CHOROPLETH_LEGEND_SAMPLES_PER_INTERVAL;
      const input = lower[0] + interval * intervalProgress;
      const position = ((input - lo[0]) / span) * 100;
      if (sample === CHOROPLETH_LEGEND_SAMPLES_PER_INTERVAL) {
        image.push(`${upper[1]} ${compactGradientPercent(position)}%`);
        continue;
      }
      const factor = Math.min(
        1,
        Math.max(0, choroplethLogInterpolationFactor(input, lower[0], upper[0])),
      );
      const lowerWeight = compactGradientPercent((1 - factor) * 100);
      const upperWeight = compactGradientPercent(factor * 100);
      image.push(
        `color-mix(in srgb, ${lower[1]} ${lowerWeight}%, ${upper[1]} ${upperWeight}%) ` +
          `${compactGradientPercent(position)}%`,
      );
    }
  }
  return `linear-gradient(to right, ${image.join(', ')})`;
}

/**
 * What a `dataLayers` entry renders.
 *
 * `'auto'` (the default) splits the source by geometry into the
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
  /** Outline color for aggregate cluster circles only. Defaults to the layer stroke, color, then tone; individual pins keep their layer paint. */
  readonly strokeColor?: string;
  /**
   * Font stack for the cluster count label, which must exist in the style's glyph or font-file source.
   * Defaults to MapLibre's spec default; supply the names your style actually ships when that
   * default is absent. The count label is skipped when the style declares neither `glyphs` nor
   * readable native `font-faces`, since a text layer without a font source cannot paint text.
   */
  readonly countFont?: readonly string[];
  /** Count label foreground. Defaults to the layer tone's on-color. CSS token references resolve against this map. */
  readonly countColor?: string;
  /** Optional count label halo color. Without it, the label has no halo. */
  readonly countHaloColor?: string;
  /** Halo width in CSS pixels, clamped to 0–3 (one quarter of the 12px count text size). Defaults to 1 when a halo color is set. */
  readonly countHaloWidth?: number;
  /**
   * Zooms into a cluster when it is clicked: the camera eases to the cluster's position at the
   * zoom where it breaks apart (clamped to the camera range), honoring reduced motion and writing
   * the result back to `center` and `zoom`. `lr-map-click` still fires first, with
   * `origin: 'cluster'`. Defaults to `false`.
   */
  readonly zoomOnClick?: boolean;
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

/** Continuous feature-driven color and constant width for an auto data layer's lines/outlines. */
export interface LyraMapLineOptions {
  /** Numeric feature property to color by. Missing/non-numeric values use strokeColor/color/tone. */
  readonly field?: string;
  /** Linear [value, color] stops. First 64 entries are inspected, sorted and deduplicated
   * first-wins. Two usable stops are required; otherwise the flat stroke color remains.
   * CSS variables resolve on the host. Share these stops with legendGradient for a matching key. */
  readonly stops?: readonly (readonly [number, string])[];
  /** Stroke width in CSS pixels, clamped to [0, 200]. Unset/non-finite restores 2. */
  readonly width?: number;
  /** Whole-line opacity, clamped to [0, 1]. Unset/non-finite restores 1. */
  readonly opacity?: number;
}

/** Numeric radius interpolation: inclusive threshold bands or a continuous linear ramp. */
export type LyraMapPointRadiusInterpolation = 'step' | 'linear';

/** A numeric feature field mapped to an individual point's radius, independently of clustering. */
export interface LyraMapPointRadiusOptions {
  /** Numeric feature property. Missing, non-numeric and non-finite values use fallback. */
  readonly field: string;
  /** First 32 pairs are inspected; finite [value, radius] pairs are sorted and deduplicated first-wins. Radii clamp
   * to [0, 200] CSS pixels. One usable stop is constant; no usable stops use fallback. */
  readonly stops: readonly (readonly [number, number])[];
  /** Defaults to step. Step uses the first radius below the first threshold; linear clamps
   * outside the domain. An unrepresentable linear domain uses fallback. */
  readonly interpolation?: LyraMapPointRadiusInterpolation;
  /** Radius for invalid feature values or unusable scales. Defaults to 5; clamped to [0, 200]. */
  readonly fallback?: number;
}

/** How a point icon's path is painted. The existing filled-path behavior remains the default. */
export type LyraMapPointIconMode = 'fill' | 'stroke' | 'fill-stroke';
/** Shape of an open point-icon stroke's endpoints. */
export type LyraMapPointIconLineCap = 'butt' | 'round' | 'square';
/** Shape where point-icon stroke segments meet. */
export type LyraMapPointIconLineJoin = 'miter' | 'round' | 'bevel';

/** A category's SVG path, rasterized locally without parsing markup or fetching resources. */
export interface LyraMapPointIcon {
  /** Exact string category matched against point.iconField, or point.field when omitted. */
  readonly value: string;
  /** SVG path data only, at most 8192 characters. Markup, URLs and non-path commands are rejected. */
  readonly path: string;
  /** SVG [minX, minY, width, height]. Defaults to [0, 0, 24, 24]; dimensions must be positive. */
  readonly viewBox?: readonly [number, number, number, number];
  /** Fill, stroke, or both using point.iconColor. Defaults to fill. */
  readonly mode?: LyraMapPointIconMode;
  /** Stroke width in viewBox units, clamped to [0, 200]. Defaults to 2. Zero paints no stroke. */
  readonly strokeWidth?: number;
  /** Open-path endpoint shape. Defaults to round. */
  readonly lineCap?: LyraMapPointIconLineCap;
  /** Segment join shape. Defaults to round; miter joins retain the canvas miter limit of 10. */
  readonly lineJoin?: LyraMapPointIconLineJoin;
}

/** Category colors and optional symbols for points, including unclustered points in a cluster source. */
export interface LyraMapPointOptions {
  /** String feature property to match. Unknown, missing and non-string values use the flat layer color. */
  readonly field?: string;
  /** [category, CSS color] pairs; first 32 inspected, duplicate categories first-wins. */
  readonly colors?: readonly (readonly [string, string])[];
  /** Point radius in CSS pixels, clamped to [0, 200], or a numeric feature-field scale. Defaults to 5. */
  readonly radius?: number | LyraMapPointRadiusOptions;
  /** Point outline width in CSS pixels, clamped to [0, 200]. Defaults to 0. */
  readonly strokeWidth?: number;
  /** Outline color; defaults to the layer's strokeColor/color/tone. CSS variables resolve on the host. */
  readonly strokeColor?: string;
  /** String feature property used for icon matching; defaults to field. */
  readonly iconField?: string;
  /** First 32 icons inspected, duplicate values first-wins. Unknown categories keep their circle. */
  readonly icons?: readonly LyraMapPointIcon[];
  /** Icon fill/stroke ink; defaults to the layer tone's contrasting foreground. CSS variables supported. */
  readonly iconColor?: string;
  /** Icon bounding square in CSS pixels, clamped to [1, 200]. Defaults to 16. */
  readonly iconSize?: number;
}

/** One GeoJSON source rendered as three layers (`${sourceId}-fill` for polygons, `${sourceId}-line`
 *  for lines/outlines, `${sourceId}-circle` for points), or — under `cluster`/`kind` — as the
 *  cluster or heatmap layers those describe. Colors resolve from `--lr-*` tokens at apply time,
 *  defaulting to `accent`. */
export interface LyraMapGeoJsonDataLayer extends LyraMapInteractionOptions {
  /** Trimmed nonempty business identity. A collection retains the first occurrence and ignores
   * blank or later duplicate `sourceId` records. */
  readonly sourceId: string;
  readonly geojson: Feature | FeatureCollection;
  /** Logical data-layer sourceId or native layer anchor. Missing targets append; cycles reject the proposal. */
  readonly before?: string;
  /** Finite native minimum, clamped to [0,24], inclusive. Defaults to zero. */
  readonly minZoom?: number;
  /** Finite native maximum, clamped to [0,24], exclusive. Defaults to 24. Equal bounds are empty. */
  readonly maxZoom?: number;
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

  /** Line/outline paint in the default geometry split. Ignored by cluster and heatmap entries.
   * Does not change point colors or polygon fills. Updates repaint existing layers in place. */
  readonly line?: LyraMapLineOptions;

  /** Category point paint and safe path icons. Works with auto and clustered entries; ignored by heatmaps.
   * Categories share this source and therefore cluster together. No DOM marker is allocated per point. */
  readonly point?: LyraMapPointOptions;

  /** What this entry renders. Defaults to `'auto'`. */
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

  /** Text labels require a glyph-capable style. Clustered sources label only unclustered points.
   * Heatmaps and line placement on clustered points do not accept labels. */
  readonly label?: LyraMapLabelOptions;
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
  /** A CSS color. When omitted, the themed `--lr-color-brand` token is resolved instead of
   * maplibre-gl's own hardcoded default, so an unstyled pin still tracks the active theme.
   * Invalid values and `url()` paint servers use maplibre-gl's default marker color. */
  readonly color?: string;
  /** Visible popup text and the marker button's accessible name. A runtime record with a
   * non-string label is malformed and omitted without suppressing valid sibling markers. */
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

function markerPopupText(host: Element, markup: unknown): string {
  return typeof markup === 'string' && markup ? popupText(host, markup) : '';
}

/** Each entry becomes a source plus up to three GL layers (`fill`/`line`/`circle`) -- unbounded
 *  input would let a hostile/oversized `dataLayers` assignment synchronously add an unbounded
 *  number of sources/layers to the underlying map. First-N deterministic truncation, same
 *  rationale and pattern as `MAX_MAP_MARKERS` above. */


/** Immutable descriptor projection used exclusively after a layer reaches the map boundary. */
interface MapLayerIdentityDraft {
  readonly geojson: Map<string, string>;
  readonly external: Map<string, string>;
  nextGeojson: number;
  nextExternal: number;
  externalStyle: number;
}

interface CanonicalMapDataLayer extends CanonicalMapInteraction {
  readonly before?: string;
  readonly minZoom: number;
  readonly maxZoom: number;
  readonly placementRequested: boolean;
  readonly sourceId: string;
  readonly geojson: Feature | FeatureCollection;
  readonly geojsonProjection: CanonicalGeoJsonProjection;
  readonly label: CanonicalMapLabel | undefined;
  readonly invalidLabel: boolean;
  readonly tone: LyraMapGeoJsonDataLayer['tone'];
  readonly color: string | undefined;
  readonly strokeColor: string | undefined;
  readonly line: CanonicalLineOptions | undefined;
  readonly point: CanonicalPointOptions | undefined;
  readonly kind: LyraMapDataLayerKind;
  readonly heatmap: CanonicalHeatmapOptions | undefined;
  readonly cluster: NormalizedClusterOptions | undefined;
}

const EMPTY_CANONICAL_MAP_DATA_LAYERS: readonly CanonicalMapDataLayer[] = Object.freeze([]);

function mapTone(value: unknown): LyraMapGeoJsonDataLayer['tone'] {
  switch (value) {
    case 'accent':
    case 'success':
    case 'warning':
    case 'danger':
    case 'neutral':
      return value;
    default:
      return undefined;
  }
}

function projectMapDataLayer(value: unknown, kindDescriptor: OwnDataDescriptorResult): CanonicalMapDataLayer | undefined {
  try {
    if (!isRuntimeRecord(value)) return undefined;
    const sourceIdDescriptor = getOwnDataDescriptor(value, 'sourceId');
    const geojsonDescriptor = getOwnDataDescriptor(value, 'geojson');
    const toneDescriptor = getOwnDataDescriptor(value, 'tone');
    const colorDescriptor = getOwnDataDescriptor(value, 'color');
    const strokeColorDescriptor = getOwnDataDescriptor(value, 'strokeColor');
    const lineDescriptor = getOwnDataDescriptor(value, 'line');
    const heatmapDescriptor = getOwnDataDescriptor(value, 'heatmap');
    const clusterDescriptor = getOwnDataDescriptor(value, 'cluster');
    if (
      sourceIdDescriptor === MISSING_OWN_DATA_DESCRIPTOR ||
      geojsonDescriptor === MISSING_OWN_DATA_DESCRIPTOR ||
      isUnsafeDescriptor(sourceIdDescriptor) ||
      isUnsafeDescriptor(geojsonDescriptor)
    )
      return undefined;

    const sourceId = sourceIdDescriptor.value;
    const geojson = geojsonDescriptor.value;
    if (
      typeof sourceId !== 'string' ||
      sourceId.trim().length === 0 ||
      !isRuntimeRecord(geojson)
    )
      return undefined;

    const placement = projectMapRowPlacement(value);
    if (!placement) return undefined;
    const tone = mapTone(optionalDescriptorValue(toneDescriptor));
    const colorValue = optionalDescriptorValue(colorDescriptor);
    const strokeColorValue = optionalDescriptorValue(strokeColorDescriptor);
    const kindValue = optionalDescriptorValue(kindDescriptor);
    const heatmapValue = optionalDescriptorValue(heatmapDescriptor);
    const clusterValue = optionalDescriptorValue(clusterDescriptor);
    const kind: LyraMapDataLayerKind = kindValue === 'heatmap' ? 'heatmap' : 'auto';
    const labelDescriptor = getOwnDataDescriptor(value, 'label');
    const labelValue = optionalDescriptorValue(labelDescriptor);
    const label = labelValue === undefined ? undefined : projectMapLabelOptions(labelValue);
    const cluster = kind === 'auto' ? normalizedClusterOptions(clusterValue) : undefined;
    const invalidLabel = labelDescriptor === UNSAFE_OWN_DATA_DESCRIPTOR || (labelValue !== undefined &&
      (!label || kind === 'heatmap' || Boolean(cluster && label.placement === 'line') || Math.max(placement.minZoom, label.minZoom) > placement.maxZoom));
    return Object.freeze({
      sourceId: sourceId.trim(), ...projectMapInteractionOptions(value),
      before: placement.before, minZoom: placement.minZoom, maxZoom: placement.maxZoom, placementRequested: placement.requested,
      // GeoJSON is deliberately retained as one opaque identity. MapLibre owns its validation and
      // may accept a runtime payload broader than this component's type declaration.
      geojson: geojson as Feature | FeatureCollection,
      geojsonProjection: projectAdmittedGeoJson(geojson),
      tone,
      color: typeof colorValue === 'string' ? colorValue : undefined,
      strokeColor: typeof strokeColorValue === 'string' ? strokeColorValue : undefined,
      line: kind === 'auto' ? projectLineOptions(optionalDescriptorValue(lineDescriptor)) : undefined,
      point: kind === 'auto' ? projectPointOptions(optionalDescriptorValue(getOwnDataDescriptor(value, 'point'))) : undefined,
      kind,
      heatmap: kind === 'heatmap' ? projectHeatmapOptions(heatmapValue) : undefined,
      cluster, label, invalidLabel,
    });
  } catch {
    return undefined;
  }
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
  '-point-icon',
  '-cluster',
  '-cluster-count',
  '-heatmap',
  '-label',
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
const QUERYABLE_DATA_LAYER_SUFFIXES = ['-fill', '-line', '-circle', '-cluster', '-point-icon', '-label'] as const;

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
): readonly (readonly [number, T])[] {
  try {
    const scanCount = boundedOwnArrayLength(value, MAX_MAP_STEP_STOPS);
    if (scanCount === undefined) return Object.freeze([]);
    const usable: [number, T][] = [];
    for (let index = 0; index < scanCount; index += 1) {
      const stopDescriptor = getOwnDataDescriptor(value as object, String(index));
      if (
        stopDescriptor === MISSING_OWN_DATA_DESCRIPTOR ||
        isUnsafeDescriptor(stopDescriptor)
      )
        continue;
      const stop = stopDescriptor.value;
      const stopLength = boundedOwnArrayLength(stop, 2);
      if (stopLength === undefined || stopLength < 2) continue;
      const thresholdDescriptor = getOwnDataDescriptor(stop as object, '0');
      const outputDescriptor = getOwnDataDescriptor(stop as object, '1');
      if (
        thresholdDescriptor === MISSING_OWN_DATA_DESCRIPTOR ||
        outputDescriptor === MISSING_OWN_DATA_DESCRIPTOR ||
        isUnsafeDescriptor(thresholdDescriptor) ||
        isUnsafeDescriptor(outputDescriptor) ||
        typeof thresholdDescriptor.value !== 'number' ||
        !Number.isFinite(thresholdDescriptor.value) ||
        !isOutput(outputDescriptor.value)
      )
        continue;
      usable.push([clampThreshold(thresholdDescriptor.value), outputDescriptor.value]);
    }
    usable.sort((a, b) => a[0] - b[0]);
    const deduplicated = usable.filter(
      (stop, index) => index === 0 || stop[0] > usable[index - 1]![0],
    );
    return Object.freeze(deduplicated.map((stop) => Object.freeze(stop) as readonly [number, T]));
  } catch {
    return Object.freeze([]);
  }
}

const isFiniteOutput = (candidate: unknown): candidate is number =>
  typeof candidate === 'number' && Number.isFinite(candidate);
const isColorOutput = (candidate: unknown): candidate is string =>
  typeof candidate === 'string' && candidate.trim().length > 0;

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
/** Cap on the cluster count label's font stack; a stack is a fallback chain, not a list. */
const MAX_CLUSTER_COUNT_FONTS = 8;

/** `LyraMapClusterOptions` with every value normalized to something MapLibre accepts. */
interface NormalizedClusterOptions {
  readonly radius: number;
  readonly maxZoom: number;
  readonly radiusSteps: readonly (readonly [number, number])[];
  readonly colorSteps: readonly (readonly [number, string])[];
  readonly strokeColor: string | undefined;
  readonly countFont: readonly string[] | undefined;
  readonly countColor: string | undefined;
  readonly countHaloColor: string | undefined;
  readonly countHaloWidth: number;
  readonly zoomOnClick: boolean;
}

/**
 * Normalizes one entry's `cluster` option, or returns `undefined` when clustering is not requested.
 *
 * `cluster: {}` is meaningful — it opts in at every default — so presence of the object, not of any
 * particular field, is what enables clustering.
 */
function normalizedClusterOptions(value: unknown): NormalizedClusterOptions | undefined {
  try {
    if (!isRuntimeRecord(value)) return undefined;
    const radiusDescriptor = getOwnDataDescriptor(value, 'radius');
    const maxZoomDescriptor = getOwnDataDescriptor(value, 'maxZoom');
    const radiusStepsDescriptor = getOwnDataDescriptor(value, 'radiusSteps');
    const colorStepsDescriptor = getOwnDataDescriptor(value, 'colorSteps');
    const strokeColorDescriptor = getOwnDataDescriptor(value, 'strokeColor');
    const countFontDescriptor = getOwnDataDescriptor(value, 'countFont');
    const countColorDescriptor = getOwnDataDescriptor(value, 'countColor');
    const countHaloColorDescriptor = getOwnDataDescriptor(value, 'countHaloColor');
    const countHaloWidthDescriptor = getOwnDataDescriptor(value, 'countHaloWidth');
    const zoomOnClickDescriptor = getOwnDataDescriptor(value, 'zoomOnClick');
    const radiusValue = optionalDescriptorValue(radiusDescriptor);
    const maxZoomValue = optionalDescriptorValue(maxZoomDescriptor);
    const radiusSteps = normalizedSteps(
      optionalDescriptorValue(radiusStepsDescriptor),
      isFiniteOutput,
    );
    const colorSteps = normalizedSteps(optionalDescriptorValue(colorStepsDescriptor), isColorOutput);
    const fonts = normalizedClusterFonts(optionalDescriptorValue(countFontDescriptor));
    const countHaloWidthValue = optionalDescriptorValue(countHaloWidthDescriptor);
    return Object.freeze({
      radius: finiteRange(
        typeof radiusValue === 'number' ? radiusValue : Number.NaN,
        DEFAULT_CLUSTER_RADIUS,
        1,
        1_000,
      ),
      maxZoom: finiteRange(
        typeof maxZoomValue === 'number' ? maxZoomValue : Number.NaN,
        DEFAULT_CLUSTER_MAX_ZOOM,
        0,
        24,
      ),
      radiusSteps: radiusSteps.length ? radiusSteps : DEFAULT_CLUSTER_RADIUS_STEPS,
      colorSteps,
      strokeColor: sanitizeCssColor(optionalDescriptorValue(strokeColorDescriptor)),
      countFont: fonts.length ? fonts : undefined,
      countColor: sanitizeCssColor(optionalDescriptorValue(countColorDescriptor)),
      countHaloColor: sanitizeCssColor(optionalDescriptorValue(countHaloColorDescriptor)),
      countHaloWidth: countHaloWidthValue === undefined ? 1 : finiteRange(
        typeof countHaloWidthValue === 'number' ? countHaloWidthValue : Number.NaN,
        1,
        0,
        3,
      ),
      zoomOnClick: optionalDescriptorValue(zoomOnClickDescriptor) === true,
    });
  } catch {
    return undefined;
  }
}

function normalizedClusterFonts(value: unknown): readonly string[] {
  try {
    const length = boundedOwnArrayLength(value, MAX_CLUSTER_COUNT_FONTS);
    if (length === undefined) return Object.freeze([]);
    const fonts: string[] = [];
    for (let index = 0; index < length; index += 1) {
      const descriptor = getOwnDataDescriptor(value as object, String(index));
      if (
        descriptor === MISSING_OWN_DATA_DESCRIPTOR ||
        isUnsafeDescriptor(descriptor) ||
        typeof descriptor.value !== 'string' ||
        descriptor.value.trim().length === 0
      )
        continue;
      fonts.push(descriptor.value);
    }
    return Object.freeze(fonts);
  } catch {
    return Object.freeze([]);
  }
}

interface CanonicalLineOptions {
  readonly field: string | undefined;
  readonly stops: readonly (readonly [number, string])[];
  readonly width: number;
  readonly opacity: number;
}

interface CanonicalPointOptions {
  readonly field: string | undefined;
  readonly colors: readonly (readonly [string, string])[];
  readonly radius: number | CanonicalPointRadius;
  readonly strokeWidth: number;
  readonly strokeColor: string | undefined;
  readonly iconField: string | undefined;
  readonly icons: readonly CanonicalPointIcon[];
  readonly iconColor: string | undefined;
  readonly iconSize: number;
}

/**
 * The validated paint half of an icon record, shared by a point layer's `icons` and a legend
 * entry's `icon`: the same grammar, bounds and defaults reach both, so a consumer can hand one
 * record to each without either admitting something the other rejects.
 */
interface CanonicalIconPaint {
  readonly path: string;
  readonly viewBox: readonly [number, number, number, number];
  readonly mode: LyraMapPointIconMode;
  readonly strokeWidth: number;
  readonly lineCap: LyraMapPointIconLineCap;
  readonly lineJoin: LyraMapPointIconLineJoin;
}

interface CanonicalPointIcon extends CanonicalIconPaint {
  readonly value: string;
}

/** Point-icon defaults, applied identically by the projector below and the legend glyph render. */
const DEFAULT_ICON_VIEW_BOX = Object.freeze([0, 0, 24, 24]) as readonly [
  number,
  number,
  number,
  number,
];
const DEFAULT_ICON_STROKE_WIDTH = 2;
/** Markup, URLs and non-path commands are rejected: only SVG path data survives this. */
const ICON_PATH_GRAMMAR = /^[MmLlHhVvCcSsQqTtAaZz\d.eE+,\s-]+$/u;
const MAX_ICON_PATH_LENGTH = 8192;

/**
 * Descriptor-safe projection of one hostile-input icon record, minus the point layer's category
 * key. Returns undefined for anything unusable so each caller decides what an omission means —
 * a point keeps its circle, a legend row keeps its color swatch.
 */
function projectIconPaint(row: object): CanonicalIconPaint | undefined {
  const path = optionalDescriptorValue(getOwnDataDescriptor(row, 'path'));
  if (
    typeof path !== 'string' ||
    path.length === 0 ||
    path.length > MAX_ICON_PATH_LENGTH ||
    !ICON_PATH_GRAMMAR.test(path)
  )
    return undefined;
  const rawBox = optionalDescriptorValue(getOwnDataDescriptor(row, 'viewBox'));
  const box: number[] = [];
  if (rawBox === undefined) box.push(...DEFAULT_ICON_VIEW_BOX);
  else {
    if (boundedOwnArrayLength(rawBox, 4) !== 4) return undefined;
    for (let index = 0; index < 4; index++) {
      const coordinate = optionalDescriptorValue(getOwnDataDescriptor(rawBox as object, String(index)));
      if (typeof coordinate !== 'number' || !Number.isFinite(coordinate) || Math.abs(coordinate) > 10_000) return undefined;
      box.push(coordinate);
    }
    if (box[2]! < 0.001 || box[3]! < 0.001) return undefined;
  }
  const mode = optionalDescriptorValue(getOwnDataDescriptor(row, 'mode'));
  const strokeWidth = optionalDescriptorValue(getOwnDataDescriptor(row, 'strokeWidth'));
  const lineCap = optionalDescriptorValue(getOwnDataDescriptor(row, 'lineCap'));
  const lineJoin = optionalDescriptorValue(getOwnDataDescriptor(row, 'lineJoin'));
  return Object.freeze({
    path,
    viewBox: Object.freeze(box) as unknown as CanonicalIconPaint['viewBox'],
    mode: mode === 'stroke' || mode === 'fill-stroke' ? mode : 'fill',
    strokeWidth: finiteRange(
      typeof strokeWidth === 'number' ? strokeWidth : NaN,
      DEFAULT_ICON_STROKE_WIDTH,
      0,
      200,
    ),
    lineCap: lineCap === 'butt' || lineCap === 'square' ? lineCap : 'round',
    lineJoin: lineJoin === 'miter' || lineJoin === 'bevel' ? lineJoin : 'round',
  });
}

type CanonicalPointRadius = MapDataLayerPointRadius;

function projectPointRadius(value: unknown): number | CanonicalPointRadius {
  if (!isRuntimeRecord(value)) return finiteRange(typeof value === 'number' ? value : NaN, 5, 0, 200);
  const read = (key: string): unknown => optionalDescriptorValue(getOwnDataDescriptor(value, key));
  const field = read('field');
  const rawFallback = read('fallback');
  const fallback = finiteRange(typeof rawFallback === 'number' ? rawFallback : NaN, 5, 0, 200);
  const stops = normalizedSteps(read('stops'), isFiniteOutput)
    .map(([threshold, radius]) => Object.freeze([threshold, finiteRange(radius, 5, 0, 200)] as const));
  if (typeof field !== 'string' || !field.trim() || !stops.length) return fallback;
  return Object.freeze({ field: field.trim(), stops: Object.freeze(stops), fallback,
    interpolation: read('interpolation') === 'linear' ? 'linear' : 'step' });
}

function projectPointOptions(value: unknown): CanonicalPointOptions | undefined {
  if (!isRuntimeRecord(value)) return undefined;
  const read = (key: string): unknown => optionalDescriptorValue(getOwnDataDescriptor(value, key));
  const string = (key: string): string | undefined => {
    const candidate = read(key);
    return typeof candidate === 'string' && candidate.trim() ? candidate : undefined;
  };
  const number = (key: string, fallback: number, min: number, max: number): number => {
    const candidate = read(key);
    return finiteRange(typeof candidate === 'number' ? candidate : NaN, fallback, min, max);
  };
  const colors: (readonly [string, string])[] = [];
  const icons: CanonicalPointIcon[] = [];
  const project = (input: unknown, accept: (row: object) => void): void => {
    const length = boundedOwnArrayLength(input, MAX_MAP_STEP_STOPS) ?? 0;
    for (let index = 0; index < length; index++) {
      const row = optionalDescriptorValue(getOwnDataDescriptor(input as object, String(index)));
      if (row !== null && typeof row === 'object') accept(row);
    }
  };
  project(read('colors'), (row) => {
    const key = optionalDescriptorValue(getOwnDataDescriptor(row, '0'));
    const color = optionalDescriptorValue(getOwnDataDescriptor(row, '1'));
    if (typeof key !== 'string' || typeof color !== 'string' || !sanitizeCssColor(color) ||
      colors.some(([existing]) => existing === key)) return;
    colors.push(Object.freeze([key, color]));
  });
  project(read('icons'), (row) => {
    const key = optionalDescriptorValue(getOwnDataDescriptor(row, 'value'));
    if (typeof key !== 'string' || icons.some((icon) => icon.value === key)) return;
    const paint = projectIconPaint(row);
    if (!paint) return;
    icons.push(Object.freeze({ value: key, ...paint }));
  });
  return Object.freeze({ field: string('field'), colors: Object.freeze(colors), radius: projectPointRadius(read('radius')),
    strokeWidth: number('strokeWidth', 0, 0, 200), strokeColor: string('strokeColor'),
    iconField: string('iconField') ?? string('field'), icons: Object.freeze(icons),
    iconColor: string('iconColor'), iconSize: number('iconSize', 16, 1, 200) });
}

/** Fixed 2x atlas raster size; display size is controlled by point.iconSize, not device allocation. */
const POINT_ICON_RASTER_SIZE = 64;

function rasterPointIcon(host: Element, icon: CanonicalPointIcon, color: string): ImageData | undefined {
  try {
    const canvas = host.ownerDocument.createElement('canvas');
    canvas.width = canvas.height = POINT_ICON_RASTER_SIZE;
    const context = canvas.getContext('2d');
    const Path = host.ownerDocument.defaultView?.Path2D;
    if (!context || !Path) return undefined;
    const [x, y, width, height] = icon.viewBox;
    const scale = POINT_ICON_RASTER_SIZE / Math.max(width, height);
    context.translate((POINT_ICON_RASTER_SIZE - width * scale) / 2, (POINT_ICON_RASTER_SIZE - height * scale) / 2);
    context.scale(scale, scale);
    context.translate(-x, -y);
    const path = new Path(icon.path);
    if (icon.mode !== 'stroke') {
      context.fillStyle = color;
      context.fill(path);
    }
    if (icon.mode !== 'fill' && icon.strokeWidth > 0) {
      context.strokeStyle = color;
      context.lineWidth = icon.strokeWidth;
      context.lineCap = icon.lineCap;
      context.lineJoin = icon.lineJoin;
      context.stroke(path);
    }
    return context.getImageData(0, 0, POINT_ICON_RASTER_SIZE, POINT_ICON_RASTER_SIZE);
  } catch {
    return undefined;
  }
}

function projectLineOptions(value: unknown): CanonicalLineOptions | undefined {
  try {
    if (!isRuntimeRecord(value)) return undefined;
    const field = optionalDescriptorValue(getOwnDataDescriptor(value, 'field'));
    const width = optionalDescriptorValue(getOwnDataDescriptor(value, 'width'));
    const opacity = optionalDescriptorValue(getOwnDataDescriptor(value, 'opacity'));
    return Object.freeze({
      field: typeof field === 'string' && field.trim() ? field.trim() : undefined,
      stops: Object.freeze(normalizeMapLegendGradient(
        optionalDescriptorValue(getOwnDataDescriptor(value, 'stops')),
      ).filter((stop, index, stops) => index === 0 || stop[0] > stops[index - 1]![0])
        .map((stop) => Object.freeze(stop))),
      width: typeof width === 'number' ? finiteRange(width, 2, 0, 200) : 2,
      opacity: typeof opacity === 'number' ? finiteRange(opacity, 1, 0, 1) : 1,
    });
  } catch {
    return undefined;
  }
}

/** Immutable heatmap fields copied once from an admitted layer branch. */
interface CanonicalHeatmapOptions {
  readonly weightField: string | undefined;
  readonly weightRange: readonly [number, number] | undefined;
  readonly stops: readonly (readonly [number, string])[];
  readonly radius: number | readonly (readonly [number, number])[] | undefined;
  readonly intensity: number | readonly (readonly [number, number])[] | undefined;
  readonly opacity: number | undefined;
}

function projectedHeatmapRange(value: unknown): readonly [number, number] | undefined {
  try {
    const length = boundedOwnArrayLength(value, 2);
    if (length === undefined || length < 2) return undefined;
    const minDescriptor = getOwnDataDescriptor(value as object, '0');
    const maxDescriptor = getOwnDataDescriptor(value as object, '1');
    if (
      minDescriptor === MISSING_OWN_DATA_DESCRIPTOR ||
      maxDescriptor === MISSING_OWN_DATA_DESCRIPTOR ||
      isUnsafeDescriptor(minDescriptor) ||
      isUnsafeDescriptor(maxDescriptor) ||
      typeof minDescriptor.value !== 'number' ||
      typeof maxDescriptor.value !== 'number' ||
      !Number.isFinite(minDescriptor.value) ||
      !Number.isFinite(maxDescriptor.value)
    )
      return undefined;
    return Object.freeze([minDescriptor.value, maxDescriptor.value] as const);
  } catch {
    return undefined;
  }
}

function projectedHeatmapZoomValue(
  value: unknown,
): number | readonly (readonly [number, number])[] | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (!isRuntimeArray(value)) return undefined;
  return normalizedSteps(
    value,
    isFiniteOutput,
    (zoom) => finiteRange(zoom, 0, 0, 24),
  );
}

function projectHeatmapOptions(value: unknown): CanonicalHeatmapOptions | undefined {
  try {
    if (!isRuntimeRecord(value)) return undefined;
    const weightFieldDescriptor = getOwnDataDescriptor(value, 'weightField');
    const weightRangeDescriptor = getOwnDataDescriptor(value, 'weightRange');
    const stopsDescriptor = getOwnDataDescriptor(value, 'stops');
    const radiusDescriptor = getOwnDataDescriptor(value, 'radius');
    const intensityDescriptor = getOwnDataDescriptor(value, 'intensity');
    const opacityDescriptor = getOwnDataDescriptor(value, 'opacity');
    const weightFieldValue = optionalDescriptorValue(weightFieldDescriptor);
    const opacityValue = optionalDescriptorValue(opacityDescriptor);
    return Object.freeze({
      weightField:
        typeof weightFieldValue === 'string' && weightFieldValue.trim().length > 0
          ? weightFieldValue.trim()
          : undefined,
      weightRange: projectedHeatmapRange(optionalDescriptorValue(weightRangeDescriptor)),
      stops: normalizedSteps(
        optionalDescriptorValue(stopsDescriptor),
        isColorOutput,
        (density) => finiteRange(density, 0, 0, 1),
      ),
      radius: projectedHeatmapZoomValue(optionalDescriptorValue(radiusDescriptor)),
      intensity: projectedHeatmapZoomValue(optionalDescriptorValue(intensityDescriptor)),
      opacity:
        typeof opacityValue === 'number' && Number.isFinite(opacityValue)
          ? opacityValue
          : undefined,
    });
  } catch {
    return undefined;
  }
}

/**
 * The rendering shape one entry asks for, as a comparable string. Two entries with the same shape
 * can reuse a source and its layers; a change means a full rebuild (see `_appliedDataLayerShapes`).
 */
function dataLayerShape(layer: CanonicalMapDataLayer): string {
  if (layer.kind === 'heatmap') return 'heatmap';
  const cluster = layer.cluster;
  if (!cluster) return 'auto';
  return `cluster:${cluster.radius}:${cluster.maxZoom}:${cluster.countFont?.join(',') ?? ''}`;
}

/** MapLibre expression that is true for a feature carrying a numeric `field` value. */
function choroplethHasValueExpression(field: string): unknown[] {
  return ['==', ['typeof', ['get', field]], 'number'];
}

/** The accepted, one-read subset of a caller-owned choropleth record. */
interface CanonicalMapChoropleth extends CanonicalMapInteraction {
  readonly sourceId: string;
  readonly geojson: FeatureCollection;
  readonly geojsonProjection: CanonicalGeoJsonProjection;
  readonly field: string;
  readonly stops: readonly (readonly [number, string])[];
  readonly interpolation: LyraMapChoroplethInterpolation;
  readonly stepBaseColor: string | undefined;
  readonly noData: CanonicalChoroplethNoData | undefined;
}

/** The accepted `choropleth.noData` record. */
interface CanonicalChoroplethNoData {
  readonly color: string | undefined;
  readonly strokeColor: string | undefined;
  readonly label: string | undefined;
}

/** Bound on a no-data caption, matching a legend label. */
const MAX_NO_DATA_LABEL = 256;

function projectChoroplethNoData(value: unknown): CanonicalChoroplethNoData | undefined {
  try {
    if (!isRuntimeRecord(value)) return undefined;
    const label = optionalDescriptorValue(getOwnDataDescriptor(value, 'label'));
    const trimmed = typeof label === 'string' ? label.trim() : '';
    return Object.freeze({
      color: sanitizeCssColor(optionalDescriptorValue(getOwnDataDescriptor(value, 'color'))),
      strokeColor: sanitizeCssColor(optionalDescriptorValue(getOwnDataDescriptor(value, 'strokeColor'))),
      label: trimmed.length > 0 ? boundedLegendText(trimmed, MAX_NO_DATA_LABEL) : undefined,
    });
  } catch {
    return undefined;
  }
}

function projectMapChoropleth(value: unknown): CanonicalMapChoropleth | undefined {
  try {
    if (!isRuntimeRecord(value)) return undefined;
    const sourceIdDescriptor = getOwnDataDescriptor(value, 'sourceId');
    const geojsonDescriptor = getOwnDataDescriptor(value, 'geojson');
    const fieldDescriptor = getOwnDataDescriptor(value, 'field');
    const stopsDescriptor = getOwnDataDescriptor(value, 'stops');
    const interpolationDescriptor = getOwnDataDescriptor(value, 'interpolation');
    const stepBaseColorDescriptor = getOwnDataDescriptor(value, 'stepBaseColor');
    if (
      sourceIdDescriptor === MISSING_OWN_DATA_DESCRIPTOR ||
      geojsonDescriptor === MISSING_OWN_DATA_DESCRIPTOR ||
      fieldDescriptor === MISSING_OWN_DATA_DESCRIPTOR ||
      isUnsafeDescriptor(sourceIdDescriptor) ||
      isUnsafeDescriptor(geojsonDescriptor) ||
      isUnsafeDescriptor(fieldDescriptor)
    )
      return undefined;
    const sourceId = sourceIdDescriptor.value;
    const geojson = geojsonDescriptor.value;
    const field = fieldDescriptor.value;
    if (
      typeof sourceId !== 'string' ||
      sourceId.trim().length === 0 ||
      !isRuntimeRecord(geojson) ||
      typeof field !== 'string' ||
      field.trim().length === 0
    )
      return undefined;
    const interpolationValue = optionalDescriptorValue(interpolationDescriptor);
    const stepBaseColorValue = optionalDescriptorValue(stepBaseColorDescriptor);
    const interpolation: LyraMapChoroplethInterpolation =
      interpolationValue === 'logarithmic' || interpolationValue === 'step'
        ? interpolationValue
        : 'linear';
    return Object.freeze({
      sourceId: sourceId.trim(), ...projectMapInteractionOptions(value),
      geojson: geojson as FeatureCollection,
      geojsonProjection: projectAdmittedGeoJson(geojson),
      field: field.trim(),
      stops: normalizedSteps(optionalDescriptorValue(stopsDescriptor), isColorOutput),
      interpolation,
      stepBaseColor:
        typeof stepBaseColorValue === 'string' && stepBaseColorValue.trim().length > 0
          ? stepBaseColorValue
          : undefined,
      noData: projectChoroplethNoData(optionalDescriptorValue(getOwnDataDescriptor(value, 'noData'))),
    });
  } catch {
    return undefined;
  }
}

/** The accepted map marker snapshot; `unsafeHtml` remains opaque after its own descriptor read. */
interface CanonicalMapMarker {
  readonly id: string | undefined;
  readonly lngLat: readonly [number, number];
  readonly color: string | undefined;
  readonly label: string | undefined;
  readonly unsafeHtml: unknown | undefined;
}

const EMPTY_CANONICAL_MAP_MARKERS: readonly CanonicalMapMarker[] = Object.freeze([]);
const UNPROJECTED_MAP_VALUE = Symbol('unprojected-map-value');

function projectMarkerLngLat(value: unknown): readonly [number, number] | undefined {
  try {
    const length = boundedOwnArrayLength(value, 2);
    if (length === undefined || length < 2) return undefined;
    const lngDescriptor = getOwnDataDescriptor(value as object, '0');
    const latDescriptor = getOwnDataDescriptor(value as object, '1');
    if (
      lngDescriptor === MISSING_OWN_DATA_DESCRIPTOR ||
      latDescriptor === MISSING_OWN_DATA_DESCRIPTOR ||
      isUnsafeDescriptor(lngDescriptor) ||
      isUnsafeDescriptor(latDescriptor) ||
      typeof lngDescriptor.value !== 'number' ||
      typeof latDescriptor.value !== 'number' ||
      !Number.isFinite(lngDescriptor.value) ||
      !Number.isFinite(latDescriptor.value) ||
      latDescriptor.value < -90 ||
      latDescriptor.value > 90
    )
      return undefined;
    return Object.freeze([lngDescriptor.value, latDescriptor.value] as const);
  } catch {
    return undefined;
  }
}

function projectMapMarker(value: unknown): CanonicalMapMarker | undefined {
  try {
    if (!isRuntimeRecord(value)) return undefined;
    const idDescriptor = getOwnDataDescriptor(value, 'id');
    const lngLatDescriptor = getOwnDataDescriptor(value, 'lngLat');
    const colorDescriptor = getOwnDataDescriptor(value, 'color');
    const labelDescriptor = getOwnDataDescriptor(value, 'label');
    const unsafeHtmlDescriptor = getOwnDataDescriptor(value, 'unsafeHtml');
    if (
      lngLatDescriptor === MISSING_OWN_DATA_DESCRIPTOR ||
      isUnsafeDescriptor(idDescriptor) ||
      isUnsafeDescriptor(lngLatDescriptor) ||
      isUnsafeDescriptor(colorDescriptor) ||
      isUnsafeDescriptor(labelDescriptor) ||
      isUnsafeDescriptor(unsafeHtmlDescriptor)
    )
      return undefined;
    const lngLat = projectMarkerLngLat(lngLatDescriptor.value);
    const idValue = optionalDescriptorValue(idDescriptor);
    const labelValue = optionalDescriptorValue(labelDescriptor);
    if (
      !lngLat ||
      (idValue !== undefined && typeof idValue !== 'string') ||
      (typeof idValue === 'string' && idValue.trim().length === 0) ||
      (labelValue !== undefined && typeof labelValue !== 'string')
    )
      return undefined;
    const colorValue = optionalDescriptorValue(colorDescriptor);
    return Object.freeze({
      id: typeof idValue === 'string' ? idValue.trim() : undefined,
      lngLat,
      color: typeof colorValue === 'string' ? colorValue : undefined,
      label: typeof labelValue === 'string' ? labelValue : undefined,
      unsafeHtml: optionalDescriptorValue(unsafeHtmlDescriptor),
    });
  } catch {
    return undefined;
  }
}

function projectMapMarkers(value: unknown): readonly CanonicalMapMarker[] {
  try {
    const scanCount = boundedOwnArrayLength(value, MAX_MAP_MARKERS);
    if (scanCount === undefined) return EMPTY_CANONICAL_MAP_MARKERS;
    const output: CanonicalMapMarker[] = [];
    const explicitIds = new Set<string>();
    for (let index = 0; index < scanCount; index += 1) {
      const descriptor = getOwnDataDescriptor(value as object, String(index));
      if (descriptor === MISSING_OWN_DATA_DESCRIPTOR || isUnsafeDescriptor(descriptor)) continue;
      const marker = projectMapMarker(descriptor.value);
      if (!marker || (marker.id !== undefined && explicitIds.has(marker.id))) continue;
      if (marker.id !== undefined) explicitIds.add(marker.id);
      output.push(marker);
    }
    return output.length ? Object.freeze(output) : EMPTY_CANONICAL_MAP_MARKERS;
  } catch {
    return EMPTY_CANONICAL_MAP_MARKERS;
  }
}

/** Sets popup content without MapLibre moving focus into an already open popup. */
function setPopupContent(popup: MapLibrePopupCapability, marker: CanonicalMapMarker): MapLibrePopupCapability {
  const options = popup.options;
  const focus = options?.focusAfterOpen;
  if (options) options.focusAfterOpen = false;
  if (marker.unsafeHtml) popup.setHTML(marker.unsafeHtml as string);
  else popup.setText(marker.label!);
  if (options) options.focusAfterOpen = focus;
  return popup;
}

/**
 * Standard peer controls an `<lr-map>` adds and removes for you. Entries accept `true` (defaults),
 * `false` (disabled), or an options object. Attribution is enabled when omitted; other omitted
 * controls are disabled. The selected engine's control code loads only for enabled controls.
 */
export interface LyraMapGeolocateErrorDetail { readonly code: LyraMapGeolocationErrorCode; }
export interface LyraMapGeolocateOutOfBoundsDetail { readonly code: 'out-of-bounds'; }
/** Detail of `lr-map-geolocate`: the position the user-activated geolocate control located. */
export interface LyraMapGeolocateDetail {
  /** `[longitude, latitude]` reported by the browser. */
  readonly lngLat: readonly [number, number];
  /** Radius of uncertainty in metres, as the browser reports it. */
  readonly accuracy: number;
}

export interface LyraMapControls {
  readonly navigation?: boolean | LyraMapNavigationControlOptions;
  readonly scale?: boolean | LyraMapScaleControlOptions;
  readonly geolocate?: boolean | LyraMapGeolocateControlOptions;
  /** Text or guarded linked credits. Controls in a corner read navigation, scale, geolocate, attribution from top to bottom. */
  readonly attribution?: boolean | LyraMapAttributionControlOptions;
}

/**
 * Common imperative map capability returned by `LyraMap.map` without making
 * `maplibre-gl` a declaration dependency for consumers.
 */
export interface LyraMapInstance {
  /** Modular-engine readiness before imperative source/layer/projection/terrain mutations.
   * Absent when `engine="maplibre"` selects the canonical engine. */
  prepareFeatures?(requirements: LyraMapFeatureRequirements, options?: { signal?: AbortSignal }): Promise<void>;
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

/**
 * Screen pixels kept clear on each side of a fitted box. The sides are the viewport's physical
 * sides, because the map's projected space is physical in both text directions. An omitted side is
 * `0`.
 */
export interface LyraMapPadding {
  readonly top?: number;
  readonly right?: number;
  readonly bottom?: number;
  readonly left?: number;
}

/** Identifies the connection/style whose owned overlays reached readiness. */
export interface LyraMapReadinessDetail {
  /** Monotonically increasing for this element, including reconnects and style replacements. */
  readonly generation: number;
}

/** Options for `LyraMap.fitBounds()`. Every field is optional. */
export interface LyraMapFitBoundsOptions {
  /** Screen pixels kept clear around the box: one number for every side, or per side. A negative
   *  or non-finite side counts as `0`. Defaults to `0`. */
  readonly padding?: number | LyraMapPadding;
  /** Highest zoom the fit may reach, so a single point or a tight cluster does not zoom to the
   *  street. Clamped into the map's zoom limits (`minZoom`/`maxZoom`, `[0, 22]` by default); a
   *  non-finite value sets no ceiling beyond `maxZoom`. */
  readonly maxZoom?: number;
  /** Whether the camera animates to the box. Defaults to `true`. It never animates under
   *  `prefers-reduced-motion: reduce`, or when the fit was queued before the map existed. */
  readonly animate?: boolean;
}

/** What settled the camera that a `lr-map-view-change` reports: a user gesture (`'user'`: drag,
 *  wheel, touch, keyboard, box zoom or a standard peer navigation button), a `fitBounds()` or
 *  `fitToData()` call (`'fit'`), or a `flyTo()`, `easeTo()` or `jumpTo()` call (`'command'`). These
 *  are the only three: camera moves made directly through `map` are never reported. */
export type LyraMapViewChangeSource = 'user' | 'fit' | 'command';

/** Detail of `lr-map-view-change`. Frozen, and detached from the component's own state. */
export interface LyraMapViewChangeDetail {
  /** Settled `[longitude, latitude]`, longitude wrapped into `[-180, 180]`. Already written into
   *  `center`. */
  readonly center: readonly [number, number];
  /** Settled zoom. Already written into `zoom`. */
  readonly zoom: number;
  readonly source: LyraMapViewChangeSource;
  /** The visible geographic box, `[[west, south], [east, north]]`, inside `cameraPadding` (the
   *  area not covered by the padding). Longitudes are shifted so `west` lies in `[-180, 180]` and
   *  `east` may run past 180 across the antimeridian, so `fitBounds()` accepts the box back.
   *  Absent when the engine cannot report bounds. */
  readonly bounds?: LyraMapBounds;
}

/** Detail of `lr-map-move`. Frozen, and detached from the component's own state. */
export interface LyraMapMoveDetail {
  /** Current `[longitude, latitude]`, longitude wrapped into `[-180, 180]`. */
  readonly center: readonly [number, number];
  /** Current zoom. */
  readonly zoom: number;
  /** The visible box, as in `LyraMapViewChangeDetail.bounds`. Absent when the engine cannot
   *  report bounds. */
  readonly bounds?: LyraMapBounds;
}

/** A position in the map's container, `[x, y]` CSS pixels from its top-left corner. */
export type LyraMapPoint = readonly [number, number];

/** A validated `fitBounds()` request, ready for the peer. */
interface MapFitRequest {
  readonly bounds: LyraMapBounds;
  readonly padding: Readonly<Required<LyraMapPadding>>;
  readonly maxZoom: number | undefined;
  readonly animate: boolean;
}

/** A fit requested before the map existed, with the declarative camera it was requested against. */
interface PendingMapFit {
  readonly fit: MapFitRequest;
  readonly center: unknown;
  readonly zoom: unknown;
}

/** Event-data key the peer merges into the movement events of this component's own fits. */
const FIT_EVENT_KEY = 'lyraMapFit';
/** The same for this component's own camera commands (`flyTo()`, `easeTo()`, `jumpTo()`). */
const COMMAND_EVENT_KEY = 'lyraMapCommand';

const ZERO_CAMERA_PADDING: Readonly<Required<LyraMapPadding>> = Object.freeze({
  top: 0,
  right: 0,
  bottom: 0,
  left: 0,
});

/** The ceiling `fitToData()` applies unless told otherwise, so a single marker does not zoom to the
 *  street. */
const FIT_TO_DATA_MAX_ZOOM = 16;
/** The engine's own default zoom limits, used when neither `minZoom` nor `maxZoom` is usable. */
const DEFAULT_ZOOM_LIMITS: readonly [number, number] = Object.freeze([0, 22] as const);

type MapCommandKind = 'flyTo' | 'easeTo' | 'jumpTo';

/** A camera command requested before the map existed, with the declarative camera it was
 *  requested against. */
interface PendingMapCommand {
  readonly kind: MapCommandKind;
  readonly target: MapCameraTarget;
  readonly center: unknown;
  readonly zoom: unknown;
}

/** Copies a `center` value for a later by-value comparison, detaching it from the host's array. */
function snapshotCenter(center: unknown): unknown {
  return Array.isArray(center) ? [center[0], center[1]] : center;
}

/** Compares two `center` values by coordinates rather than identity: a framework that rebuilds an
 *  equal array on every render is not assigning a new camera. */
function sameCenterValue(a: unknown, b: unknown): boolean {
  if (Array.isArray(a) && Array.isArray(b)) return Object.is(a[0], b[0]) && Object.is(a[1], b[1]);
  return Object.is(a, b);
}

function isFiniteCoordinate(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/**
 * Validates a `fitBounds()` box, or returns `undefined` when it is unusable. Rejects rather than
 * clamps, like `maxBounds`: a silently corrected box frames the wrong place with nothing to show
 * for it. A single point (`west === east`, `south === north`) is a valid zero-size box.
 *
 * A box crossing the antimeridian comes in MapLibre's two forms: wrapped, `west > east`, or with
 * `east` unwrapped past 180 (up to one full turn east of `west`), which is what the peer's own
 * `LngLatBounds#adjustAntiMeridian()` produces. Both reach the peer in the unwrapped form, which
 * every supported peer major fits the short way round.
 */
function normalizeFitBounds(bounds: unknown): LyraMapBounds | undefined {
  if (!Array.isArray(bounds) || bounds.length !== 2) return undefined;
  const [southWest, northEast] = bounds as unknown[];
  if (!Array.isArray(southWest) || !Array.isArray(northEast)) return undefined;
  if (southWest.length !== 2 || northEast.length !== 2) return undefined;
  const [west, south] = southWest as unknown[];
  const [east, north] = northEast as unknown[];
  if (
    !isFiniteCoordinate(west) ||
    !isFiniteCoordinate(south) ||
    !isFiniteCoordinate(east) ||
    !isFiniteCoordinate(north)
  ) return undefined;
  if (west < -180 || west > 180 || east < -180 || east > west + 360) return undefined;
  if (south < -90 || north > 90 || south > north) return undefined;
  return Object.freeze([
    Object.freeze([west, south] as const),
    Object.freeze([west > east ? east + 360 : east, north] as const),
  ] as const);
}

/** One pixel count for every side, or a per-side record; each side lands in `[0, ∞)`. */
function normalizeFitPadding(padding: unknown): Readonly<Required<LyraMapPadding>> {
  const side = (value: unknown): number =>
    finiteRange(typeof value === 'number' ? value : 0, 0, 0);
  if (typeof padding === 'number') {
    const all = side(padding);
    return Object.freeze({ top: all, right: all, bottom: all, left: all });
  }
  const record: LyraMapPadding =
    typeof padding === 'object' && padding !== null ? (padding as LyraMapPadding) : {};
  return Object.freeze({
    top: side(record.top),
    right: side(record.right),
    bottom: side(record.bottom),
    left: side(record.left),
  });
}

/** MapLibre's own longitude wrap into `[-180, 180]`, leaving an in-range value bit-identical. */
function wrapLongitude(longitude: number): number {
  if (longitude >= -180 && longitude <= 180) return longitude;
  const wrapped = ((((longitude + 180) % 360) + 360) % 360) - 180;
  return wrapped === -180 ? 180 : wrapped;
}

/** A camera as `center`/`zoom` hold it: longitude wrapped into `[-180, 180]`. */
interface MapCamera {
  readonly center: readonly [number, number];
  readonly zoom: number;
}

/** The peer's current camera in `center`/`zoom` form, or `undefined` when it cannot be read. */
function readPeerCamera(map: MapLibreMapCapability): MapCamera | undefined {
  let longitude: number;
  let latitude: number;
  let zoom: number;
  try {
    ({ lng: longitude, lat: latitude } = map.getCenter());
    zoom = map.getZoom();
  } catch {
    return undefined;
  }
  if (!isFiniteCoordinate(longitude) || !isFiniteCoordinate(latitude) || !isFiniteCoordinate(zoom)) {
    return undefined;
  }
  return { center: [wrapLongitude(longitude), finiteRange(latitude, 0, -90, 90)], zoom };
}

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

/** Defensive JS-side fallback for `hiddenCategoryOpacity()` below, on exactly the reasoning
 *  `FALLBACK_FILL_OPACITY` carries: the custom property stays undeclared on `:host` so any
 *  ancestor's value inherits, and this preserves the documented paint when it is unset, the host
 *  is detached, or the authored value is unparseable. */
const FALLBACK_HIDDEN_CATEGORY_OPACITY = 0.15;

/**
 * Reads the current `--lr-map-hidden-category-opacity` custom property so a muted category is
 * retheme-able instead of a literal baked into the paint expression -- the same shape, and the
 * same reason, as `choroplethFillOpacity()` above: MapLibre paints to a WebGL canvas that never
 * sees the CSS cascade, so the token has to be resolved here. Bounded to [0, 1], which is the
 * only range MapLibre's opacity paint properties accept.
 */
function hiddenCategoryOpacity(host: Element): number {
  const raw = ownerWindow(host)
    ?.getComputedStyle(host)
    .getPropertyValue('--lr-map-hidden-category-opacity')
    .trim() ?? '';
  return finiteRange(Number.parseFloat(raw), FALLBACK_HIDDEN_CATEGORY_OPACITY, 0, 1);
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
  return raw || DEFAULT_CANVAS_COLOR;
}

/** Basic CSS names accepted by MapLibre's parser; other named/system colors need the DOM probe. */
const BASIC_MAP_PAINT_COLOR_NAMES = new Set([
  'aqua', 'black', 'blue', 'fuchsia', 'gray', 'green', 'lime', 'maroon', 'navy',
  'olive', 'purple', 'red', 'silver', 'teal', 'white', 'yellow', 'transparent',
]);

/**
 * Resolve CSS colors into MapLibre's narrower paint vocabulary. Its parser accepts legacy hex and
 * numeric rgb() but not modern color()/oklch()/color-mix(), even when the browser computes them.
 * Preserve already-supported layer-paint strings, and only pay for the DOM probe when needed.
 */
/** Paint strings the engine cannot parse itself: theme tokens, `currentColor` and CSS Color 4/5
 *  functions. They resolve against the host, so they follow its theme. */
const THEME_PAINT_COLOR = /^\s*(?:var\(|currentcolor\s*$|(?:color-mix|color|oklch|oklab|lch|lab|hwb|light-dark)\()/iu;
/** Author token for the temporary drawing's color; the accent tone when unset. */
const DRAWING_COLOR_TOKEN = '--lr-map-drawing-color';
const EMPTY_STYLE_LAYERS: readonly LyraMapStyleLayer[] = Object.freeze([]);
const EMPTY_STYLE_SOURCES: readonly LyraMapStyleSource[] = Object.freeze([]);
/** Any theme-dependent color inside serialized overlay paint. */
const paintColorCache = new WeakMap<Element, Map<string, string | undefined>>();
function resolvedMapPaintColor(host: Element, color: string | undefined, preserveLegacy: boolean): string | undefined {
  let cache = paintColorCache.get(host);
  if (!cache) paintColorCache.set(host, cache = new Map());
  const key = `${preserveLegacy}:${color ?? ''}`;
  if (cache.has(key)) return cache.get(key);
  const result = resolveMapPaintColor(host, color, preserveLegacy);
  if (cache.size >= 512) cache.clear();
  cache.set(key, result);
  return result;
}
function resolveMapPaintColor(host: Element, color: string | undefined, preserveLegacy: boolean): string | undefined {
  const candidate = typeof color === 'string' ? color.trim() : '';
  if (!candidate) return undefined;
  if (preserveLegacy) {
    const reference = /^var\(\s*(--[\w-]+)\s*\)$/.exec(candidate);
    const plain = reference
      ? ownerWindow(host)?.getComputedStyle(host).getPropertyValue(reference[1]!).trim() ?? ''
      : candidate;
    const namedPeerColor = BASIC_MAP_PAINT_COLOR_NAMES.has(plain.toLowerCase());
    if (
      /^#(?:[\da-f]{3,4}|[\da-f]{6}|[\da-f]{8})$/i.test(plain) ||
      ((/^rgba?\([\d\s.,/]+\)$/i.test(plain) || namedPeerColor) &&
        typeof CSS !== 'undefined' && CSS.supports('color', plain))
    ) return plain;
  }
  const resolved = resolveCanvasColor(host, candidate, '');
  if (!resolved) return undefined;
  if (/^rgba?\(/i.test(resolved)) return resolved;
  const canvas = host.ownerDocument.createElement('canvas');
  canvas.width = 1;
  canvas.height = 1;
  try {
    const context = canvas.getContext('2d', { colorSpace: 'srgb', willReadFrequently: true });
    if (!context) return undefined;
    // Computed modern colors may remain in color()/oklch() form. A one-pixel sRGB readback
    // converts only these colors; two sentinels distinguish invalid from an unchanged fillStyle.
    let accepted = false;
    for (const sentinel of ['rgb(1, 2, 3)', 'rgb(4, 5, 6)']) {
      context.fillStyle = sentinel;
      const before = context.fillStyle;
      context.fillStyle = resolved;
      if (context.fillStyle !== before) {
        accepted = true;
        break;
      }
    }
    if (!accepted) return undefined;
    context.fillRect(0, 0, 1, 1);
    const [r = 0, g = 0, b = 0, a = 0] = context.getImageData(0, 0, 1, 1).data;
    return a === 255
      ? `rgb(${r}, ${g}, ${b})`
      : `rgba(${r}, ${g}, ${b}, ${Math.round((a / 255) * 1000) / 1000})`;
  } catch {
    return undefined;
  }
}

/** Resolve an author color, falling back to a concrete tone color on invalid paint. */
function resolvedLayerColor(
  host: Element,
  explicit: string | undefined,
  tone: LyraMapGeoJsonDataLayer['tone'],
): string {
  return resolvedMapPaintColor(host, explicit, true)
    ?? resolvedMapPaintColor(host, dataLayerColor(host, tone), true)
    ?? DEFAULT_CANVAS_COLOR;
}

/** Resolve a validated count color without replacing an invalid token with the circle's fill. */
function resolvedClusterCountColor(host: Element, color: string | undefined): string | undefined {
  return resolvedMapPaintColor(host, color, false);
}

/** Keep the cluster's optional ring separate from the layer paint used by single points. */
function resolvedClusterStrokeColor(
  host: Element,
  clusterStroke: string | undefined,
  layer: CanonicalMapDataLayer,
): string {
  return resolvedMapPaintColor(host, clusterStroke, true)
    ?? resolvedLayerColor(host, layer.strokeColor ?? layer.color, layer.tone);
}

/**
 * Warns once per (source, property) when the descriptor metadata for a feature property carries
 * an integer too large to be tiled. The component never walks the peer-facing GeoJSON value here.
 */
function warnOnUntileableProperties(
  projection: CanonicalGeoJsonProjection,
  sourceLabel: string,
): void {
  if (!litDevWarnings()) return;
  for (const feature of projection.diagnostics) {
    for (const [key, value] of feature.properties) {
      if (typeof value !== 'number' || !Number.isFinite(value)) continue;
      if (Math.abs(value) <= Number.MAX_SAFE_INTEGER) continue;
      const identity = feature.id ?? `index ${feature.index}`;
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

/**
 * Complete proposed visibility snapshot for one map legend category, mirroring
 * `LyraChartLegendVisibilityChangeDetail`'s shape so a host that already reconciles a chart legend
 * reconciles this one the same way. Frozen, and detached from the component's own state.
 */
export interface LyraMapLegendToggleDetail {
  /** The activated row's `value` category key, exactly as it was admitted. */
  readonly value: string;
  /** Proposed visibility of `value` after this toggle. */
  readonly visible: boolean;
  /** Complete canonical proposed hidden-category set, in the order it would be committed. */
  readonly hiddenCategories: readonly string[];
}

/**
 * Proposed disclosure state for the legend PANEL, which is a different thing from one category's
 * visibility -- hence its own detail type rather than a reuse of `LyraMapLegendToggleDetail`.
 * Frozen, and detached from the component's own state.
 */
export interface LyraMapLegendPanelToggleDetail {
  /** Proposed `legendOpen` after this activation. */
  readonly open: boolean;
}

/** The key `choroplethLegend` derives from the choropleth. */
interface DerivedChoroplethLegend {
  readonly rows: readonly LyraMapLegendEntry[];
  readonly gradient: readonly (readonly [number, string])[];
  readonly interpolation: LyraMapChoroplethInterpolation;
  readonly ticks: readonly LyraMapLegendGradientTick[];
}

const EMPTY_DERIVED_LEGEND: DerivedChoroplethLegend = Object.freeze({
  rows: Object.freeze([]) as readonly LyraMapLegendEntry[],
  gradient: Object.freeze([]) as readonly (readonly [number, string])[],
  interpolation: 'linear',
  ticks: EMPTY_LEGEND_GRADIENT_TICKS,
});

/** Neutral swatch for features without a value, the same token the layer paints with by default. */
const NO_DATA_SWATCH_COLOR = 'var(--lr-color-text-quiet)';
/** Bidi isolates: a numeric range keeps its authored order inside a right-to-left legend. */
const ISOLATE_START = '\u2066';
const ISOLATE_END = '\u2069';

function legendRow(color: string, label: string, pattern: LyraMapLegendPattern): LyraMapLegendEntry {
  return Object.freeze({ color, label, pattern });
}

function buildDerivedChoroplethLegend(
  choropleth: CanonicalMapChoropleth,
  format: (value: number) => string,
  noDataLabel: string,
): DerivedChoroplethLegend {
  const rows: LyraMapLegendEntry[] = [];
  let gradient: readonly (readonly [number, string])[] = Object.freeze([]);
  let ticks: readonly LyraMapLegendGradientTick[] = EMPTY_LEGEND_GRADIENT_TICKS;
  const stops = choropleth.stops;
  const band = (text: string): string => `${ISOLATE_START}${text}${ISOLATE_END}`;
  if (choropleth.interpolation === 'step') {
    const base = choropleth.stepBaseColor;
    if (base && stops.length > 0) rows.push(legendRow(base, band(`< ${format(stops[0]![0])}`), 'solid'));
    if (base || stops.length > 1) {
      stops.forEach(([lower, color], index) => {
        const upper = stops[index + 1];
        const text = upper === undefined
          ? `\u2265 ${format(lower)}`
          : !base && index === 0 ? `< ${format(upper[0])}` : `${format(lower)} \u2013 ${format(upper[0])}`;
        rows.push(legendRow(color, band(text), 'solid'));
      });
    }
  } else if (stops.length >= 2) {
    gradient = stops;
    ticks = normalizeMapLegendGradientTicks(stops.slice(1, -1).map(([value]) => value));
  }
  if (choropleth.noData) {
    rows.push(legendRow(
      choropleth.noData.color ?? NO_DATA_SWATCH_COLOR,
      choropleth.noData.label ?? noDataLabel,
      'diagonal',
    ));
  }
  return Object.freeze({ rows: Object.freeze(rows), gradient, interpolation: choropleth.interpolation, ticks });
}

/** Detached hit data with a public logical source identity. Anonymous hits omit target. */
export interface LyraMapFeatureHit {
  readonly layerId: string;
  readonly origin: LyraMapFeatureOrigin;
  readonly source: string;
  readonly sourceLayer?: string;
  readonly id?: string | number;
  readonly properties: { readonly [key: string]: LyraMapFeatureValue };
  readonly target?: LyraMapResolvedFeatureStateTarget;
}
export interface LyraMapInteractionDetail {
  readonly lngLat: readonly [number, number];
  readonly hit?: LyraMapFeatureHit;
  /** The hit as a detached, deeply frozen GeoJSON feature: `id`, `properties` (as in `hit`) and its
   *  geometry in `[longitude, latitude]`. Rendered geometry comes from the engine's tiles, so a
   *  large feature may be clipped to the tiles around the pointer; `geometry` is `null` past
   *  100,000 coordinate values. Present whenever `hit` is. */
  readonly feature?: LyraMapFeature;
}
/** A detached GeoJSON feature reported by hover, context-menu and pick events. */
export type LyraMapFeature = Readonly<Feature>;
/** Detail of `lr-map-pointer-move`. Frozen. */
export interface LyraMapPointerDetail {
  /** `[longitude, latitude]` under the pointer, longitude wrapped into `[-180, 180]`. */
  readonly lngLat: readonly [number, number];
  /** The pointer position in the map's container, `[x, y]` CSS pixels (see `project()`). */
  readonly point: LyraMapPoint;
}
const MAX_FEATURE_COORDINATES = 100_000;
const GEOMETRY_TYPES = new Set(['Point', 'MultiPoint', 'LineString', 'MultiLineString', 'Polygon', 'MultiPolygon']);
/** A frozen copy of a peer geometry, or `null` when it is not usable GeoJSON or too large. */
function detachedGeometry(geometry: unknown): Feature['geometry'] | null {
  let budget = MAX_FEATURE_COORDINATES;
  const positions = (value: unknown, depth: number): unknown => {
    if (!Array.isArray(value)) throw new TypeError('geometry');
    if (depth === 0) {
      if (value.length < 2 || value.length > 4 || (budget -= value.length) < 0) throw new TypeError('geometry');
      return Object.freeze(value.map(entry => {
        if (typeof entry !== 'number' || !Number.isFinite(entry)) throw new TypeError('geometry');
        return entry;
      }));
    }
    return Object.freeze(value.map(entry => positions(entry, depth - 1)));
  };
  const one = (value: unknown, nested: boolean): Feature['geometry'] => {
    const type = mapOwnValue(value, 'type') ?? (value as { type?: unknown } | null)?.type;
    if (type === 'GeometryCollection' && !nested) {
      const members = (value as { geometries?: unknown }).geometries;
      if (!Array.isArray(members)) throw new TypeError('geometry');
      return Object.freeze({ type, geometries: Object.freeze(members.map(member => one(member, true))) }) as Feature['geometry'];
    }
    if (typeof type !== 'string' || !GEOMETRY_TYPES.has(type)) throw new TypeError('geometry');
    const depth = type === 'Point' ? 0 : type === 'MultiPoint' || type === 'LineString' ? 1
      : type === 'MultiPolygon' ? 3 : 2;
    return Object.freeze({ type, coordinates: positions((value as { coordinates?: unknown }).coordinates, depth) }) as Feature['geometry'];
  };
  try { return one(geometry, false); } catch { return null; }
}
function detachedMapFeature(raw: unknown, hit: LyraMapFeatureHit): LyraMapFeature {
  let geometry: unknown;
  try { geometry = (raw as { geometry?: unknown } | null)?.geometry; } catch { geometry = undefined; }
  return Object.freeze({ type: 'Feature', ...(hit.id === undefined ? {} : { id: hit.id }), properties: hit.properties,
    geometry: detachedGeometry(geometry) }) as LyraMapFeature;
}
export interface LyraMapPickDetail extends LyraMapInteractionDetail {
  readonly trigger: 'pointer' | 'keyboard';
}
interface AppliedMapInteraction extends MapHitRule {
  readonly origin: LyraMapFeatureOrigin;
  readonly source: string;
  readonly sourceLayer?: string;
  readonly cluster?: boolean;
}
/**
 * Feature-state identity of a native source: its GeoJSON `data` object by reference when the
 * descriptor holds one (large data is never serialized), otherwise the serialized descriptor.
 * The second member is the rest of the descriptor and the source layers, compared as text.
 */
function sourceIdentity(source: Readonly<Record<string, unknown>>, layers: readonly string[]): [unknown, string] {
  const data = source['data'];
  if (typeof data !== 'object' || data === null) return [JSON.stringify(source), JSON.stringify(layers)];
  const { data: _data, ...rest } = source;
  return [data, JSON.stringify([rest, layers])];
}
function featureStatePeer(map: MapLibreMapCapability): map is MapLibreMapCapability & MapFeatureStatePeer {
  try {
    return ['setFeatureState', 'removeFeatureState'].every(key => {
      const descriptor = getInheritedPropertyDescriptor(map, key);
      return descriptor && Object.hasOwn(descriptor, 'value') && typeof descriptor.value === 'function';
    });
  } catch { return false; }
}

export interface LyraMapEventMap {
  'lr-map-anchor-close': CustomEvent<LyraMapAnchorCloseDetail>;
  'lr-map-draw-start': CustomEvent<LyraMapDrawingSnapshot>;
  'lr-map-draw-change': CustomEvent<LyraMapDrawingSnapshot>;
  'lr-map-draw-complete': CustomEvent<LyraMapDrawingSnapshot>;
  'lr-map-draw-cancel': CustomEvent<LyraMapDrawingCancelDetail>;
  'lr-map-draw-vertex-end': CustomEvent<LyraMapDrawingVertexEndDetail>;
  'lr-map-feature-enter': CustomEvent<LyraMapInteractionDetail>;
  'lr-map-feature-leave': CustomEvent<LyraMapInteractionDetail>;
  'lr-map-pointer-move': CustomEvent<LyraMapPointerDetail>;
  'lr-map-pointer-leave': CustomEvent<null>;
  'lr-map-contextmenu': CustomEvent<LyraMapInteractionDetail>;
  'lr-map-pick': CustomEvent<LyraMapPickDetail>;
  'lr-map-load': CustomEvent<null>;
  'lr-map-geolocate': CustomEvent<LyraMapGeolocateDetail>;
  'lr-map-geolocate-error': CustomEvent<LyraMapGeolocateErrorDetail>;
  'lr-map-geolocate-out-of-bounds': CustomEvent<LyraMapGeolocateOutOfBoundsDetail>;
  'lr-map-export-error': CustomEvent<LyraMapImageExportErrorDetail>;
  'lr-map-style-load': CustomEvent<LyraMapReadinessDetail>;
  'lr-map-idle': CustomEvent<LyraMapReadinessDetail>;
  'lr-map-marker-activate': CustomEvent<LyraMapMarkerActivationDetail>;
  /** Cancelable proposal to change one legend category's visibility. */
  'lr-map-legend-toggle-request': CustomEvent<LyraMapLegendToggleDetail>;
  /** Cancelable proposal to open or collapse the legend panel. */
  'lr-map-legend-panel-toggle-request': CustomEvent<LyraMapLegendPanelToggleDetail>;
  'lr-map-view-change': CustomEvent<LyraMapViewChangeDetail>;
  'lr-map-move': CustomEvent<LyraMapMoveDetail>;
  'lr-map-click': CustomEvent<{
    readonly lngLat: readonly [number, number];
    readonly feature: Feature | undefined;
    /** Which layer `feature` was hit on, so a click is attributable when both a choropleth and
     *  `dataLayers` are painted. `'cluster'` marks a hit on a clustered entry's aggregate circle,
     *  whose `point_count`/`cluster_id` properties describe the group rather than one feature.
     *  `undefined` whenever `feature` is. */
    readonly origin: LyraMapFeatureOrigin | 'cluster' | undefined;
    readonly hit?: LyraMapFeatureHit;
    readonly target?: LyraMapResolvedFeatureStateTarget;
    /** The authored `dataLayers[].sourceId` the hit belongs to; `undefined` for a choropleth hit
     *  (which has only one possible source) and when nothing was hit. */
    readonly sourceId: string | undefined;
    /** Native vector source layer containing the hit; absent for other source families. */
    readonly sourceLayer?: string;
    /** `true` when the hit is a choropleth feature without a usable value and `choropleth.noData`
     *  is configured; absent otherwise. */
    readonly noData?: true;
  }>;
}
/**
 * `<lr-map>` — a modular MapLibre-compatible wrapper with a declarative legend, choropleth
 * GeoJSON layer, markers, and additive `dataLayers` GeoJSON overlays
 * (arbitrary shapes rendered as a source plus fill/line/circle layers, or — opting in per entry —
 * as a natively clustered point set or a `heatmap` density surface,
 * independent of `choropleth`'s field/stops color-interpolation), plus a peer-neutral
 * `map` getter for common imperative operations. Its runtime value is the underlying MapLibre
 * map, while its declaration stays independent of the optional peer. The default engine requires
 * `@aceshooting/lyra-map` with its bundler plugin or an explicit worker URL. `engine="maplibre"`
 * selects the full optional `maplibre-gl` peer (v5 or v6). Both engines require WebGL2; the
 * component styles generated canvas, marker, popup, and control DOM inside its shadow root.
 *
 * Marker inspection is limited to 2,000 entries (markersTruncated reports an omitted suffix),
 * and dataLayers to 100 entries. Automatic diffs support 10,000 features; updateSourceData()
 * forwards explicit diffs for larger sources without whole-source comparison.
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
 * Collection-bearing control data is admitted through bounded, descriptor-safe projections whose
 * retained configuration is frozen. Opaque `choropleth.geojson`, `dataLayers[].geojson`, and
 * marker `unsafeHtml` values retain their original identity only at the MapLibre/Popup and
 * immutable `lr-map-marker-activate` detail boundaries; the component does not inspect them
 * again after admission. Reassign control input when its configuration changes rather than
 * relying on mutation of its admitted projection.
 *
 * @customElement lr-map
 * @event lr-map-load - Fired once the underlying maplibregl.Map loads.
 * @event lr-map-geolocate - `detail: { lngLat, accuracy }` (`LyraMapGeolocateDetail`). Fired each time
 *   the user-activated geolocate control locates the user (including position updates while it
 *   tracks), after the browser granted access. Never fired without that user activation.
 * @event lr-map-geolocate-error - `detail: { code }` (`LyraMapGeolocateErrorDetail`). Location
 *   permission, availability or timeout failure; no location or native error message is exposed.
 * @event lr-map-geolocate-out-of-bounds - `detail: { code: 'out-of-bounds' }`. A user-activated
 *   location lies outside maxBounds; no coordinates are exposed.
 * @event lr-map-export-error - `detail: { code }` (`LyraMapImageExportErrorDetail`). Frozen sanitized export failure.
 * @csspart initialization-placeholder - Stable surface before native construction. It is
 *   noninteractive except for `initialization-activate`.
 * @csspart initialization-activate - Localized button covering an `initialization="interaction"`
 *   placeholder until the first input builds the map.
 * @csspart initialization-control - Decorative outline of a requested native control before construction.
 * @event lr-map-style-load - `detail: { generation }` (`LyraMapReadinessDetail`). Fired once per
 *   connection/style after generated and registered overlays, images, style overrides and their
 *   asynchronous preparation are restored.
 * @event lr-map-idle - `detail: { generation }` (`LyraMapReadinessDetail`). Fired after style
 *   readiness when the peer and current component work are idle, including later camera/source
 *   updates. These readiness events bubble, are composed, and are not cancelable.
 * @event lr-map-legend-toggle-request - **Cancelable.** Fired once when an interactive legend row
 *   is activated by pointer or by Enter/Space, carrying the immutable
 *   `detail: { value, visible, hiddenCategories }` -- the activated category key, its proposed
 *   visibility, and the complete proposed hidden set in the order it would be committed.
 *   `preventDefault()` is a real veto: `hiddenCategories` is not written, the row's `aria-pressed`
 *   does not change, the MapLibre paint is untouched, and nothing is announced, which is what lets
 *   a host own the set and write it itself. There is deliberately no second confirmation event:
 *   the committed state is `hiddenCategories`, which the host already observes, so a paired
 *   before/after vocabulary would be permanent public surface nobody asked for. A programmatic
 *   `hiddenCategories` assignment reconciles without emitting anything -- this event is a
 *   DOM-interaction proposal only.
 * @event lr-map-legend-panel-toggle-request - **Cancelable.** Fired once when the
 *   `legendCollapsible` disclosure is activated by pointer or by Enter/Space, carrying the
 *   immutable `detail: { open }` -- the proposed `legendOpen` value. It is the *panel's*
 *   disclosure, not a *category's* visibility, so it deliberately does not reuse
 *   `lr-map-legend-toggle-request`. `preventDefault()` is a real veto: `legendOpen` is not
 *   written, the rendered rows and the disclosure's `aria-expanded` do not change, which is what
 *   lets a host own the open state and write it itself. A programmatic `legendOpen` assignment
 *   reconciles without emitting anything, so a controlled host cannot loop.
 * @event lr-map-marker-activate - Fired once when an accepted declarative marker is activated by
 *   pointer/click or by Enter/Space. The immutable detail carries its normalized `id`, validated
 *   `lngLat`, accepted marker snapshot, and activation `source`.
 * @event lr-map-feature-enter - Pointer entered a different admitted feature (anonymous hits start a fresh transition on every pointer query); frozen `detail: { lngLat, hit, feature }`, where `feature` is the hit as a detached GeoJSON feature with its geometry.
 * @event lr-map-feature-leave - Pointer left its previous admitted feature; frozen `detail: { lngLat, hit, feature }`, the detail its enter carried.
 * @event lr-map-pointer-move - Fired at most once per animation frame while a mouse pointer moves over the map, whatever lies under it, carrying the frozen `detail: { lngLat, point }` (`LyraMapPointerDetail`): the coordinate and the container position, for tooltips and coordinate read-outs. Not fired while the map is inert or disabled.
 * @event lr-map-pointer-leave - The pointer left the map after an `lr-map-pointer-move`; `detail` is `null`.
 * @event lr-map-contextmenu - Frozen `detail: { lngLat, hit?, feature? }`; does not prevent the native context menu.
 * @event lr-map-pick - Pick mode selection, `detail: { lngLat, hit?, feature?, trigger }`. Pointer picks replace ordinary click dispatch; keyboard picks use the current camera center.
 * @event lr-map-anchor-close - Frozen `detail: { reason }` after an actually open anchor closes by API, close action or Escape.
 * @csspart anchor-close - Optional localized anchor close button.
 * @event lr-map-draw-start - Frozen drawing snapshot after the first accepted vertex, before change.
 * @event lr-map-draw-change - Frozen drawing snapshot after an accepted vertex, undo or vertex edit; explicit completed edits include recomputed geometry and spherical metrics.
 * @event lr-map-draw-complete - Frozen valid geometry and spherical metrics; temporary drawing clears after dispatch.
 * @event lr-map-draw-cancel - Frozen cancelled snapshot with a stable reason; mode and temporary state are cleared.
 * @event lr-map-draw-vertex-end - Frozen snapshot plus the moved vertex `index` (`LyraMapDrawingVertexEndDetail`) once a vertex drag that moved the vertex is released, and after each keyboard vertex move: the point to recompute anything derived from the shape, where `lr-map-draw-change` fires for every intermediate position.
 * @csspart drawing-measurements - Decorative layer holding the on-map measurement labels of `drawingMeasurements`.
 * @csspart drawing-measurement - One measurement label; `data-kind` is `segment`, `closing`, `area` or `length`.
 * @csspart drawing-summary - Localized total length (line) or area (polygon) beside the vertex count while `drawingMeasurements` is set.
 * @cssprop [--lr-map-drawing-color=var(--lr-color-brand)] - Color of the temporary drawing, its rubber band and vertex handles. Read from the resolved cascade, so a theme change repaints it.
 * @csspart drawing-controls - Wrapping keyboard-accessible drawing actions.
 * @csspart drawing-add - Add the current map center as a vertex.
 * @csspart drawing-undo - Remove the last vertex.
 * @csspart drawing-complete - Complete a valid drawing.
 * @csspart drawing-cancel - Cancel drawing.
 * @csspart drawing-status - Localized vertex count.
 * @csspart drawing-handles - Viewport-clipped projected vertex edit controls.
 * @csspart drawing-vertex - Keyboard-accessible vertex handle with logical arrow-key movement.
 * @csspart pick-controls - Coordinate-picking actions.
 * @csspart pick-center - Keyboard-accessible pick-at-center button.
 * @csspart pick-cancel - Button that exits pick mode.
 * @event lr-map-click - `detail: { lngLat, feature?, origin?, sourceId?, noData? }`. `feature` resolves
 *   against the choropleth fill *and* every applied `dataLayers` fill/line/circle/cluster layer,
 *   topmost first; `origin`/`sourceId` name where it came from. A hit on a clustered entry's
 *   aggregate circle reports `origin: 'cluster'` and carries MapLibre's `point_count`/`cluster_id`
 *   properties; a `kind: 'heatmap'` layer is never hit-tested, because MapLibre returns no features
 *   for a density surface. A hit on a choropleth feature without a numeric `field` value reports
 *   `noData: true` when `choropleth.noData` is configured; the key is absent otherwise. A cluster
 *   hit also eases the camera into the cluster when its entry sets `cluster.zoomOnClick`.
 * @event lr-map-view-change - Fired once each time the camera settles after a user gesture (drag,
 *   wheel, touch, keyboard, box zoom or a standard peer navigation button), a `fitBounds()` or
 *   `fitToData()` call, or a `flyTo()`/`easeTo()`/`jumpTo()` call, carrying the immutable
 *   `detail: { center, zoom, source, bounds? }` (`LyraMapViewChangeDetail`). The element has
 *   already written that camera into `center` and `zoom`, so it never resets it on its next
 *   update, and a host mirroring camera state assigns the detail back, at any later time, without
 *   moving the map. `source` is `'user'`, `'fit'` or `'command'`; `bounds` is the visible
 *   `[[west, south], [east, north]]` box inside `cameraPadding`. Assigning `center`/`zoom`
 *   reconciles without emitting it, so a controlled host cannot loop, and camera moves made
 *   directly through `map` are not reported.
 * @event lr-map-move - Fired at most once per animation frame while the camera moves, whatever
 *   moves it (a gesture, an animation, a camera command, a `center`/`zoom` assignment, a fit or a
 *   move made directly through `map`), and once more when the move ends, carrying the immutable
 *   `detail: { center, zoom, bounds? }` (`LyraMapMoveDetail`). It reports the camera as it is, not
 *   a settled intent: use `lr-map-view-change` to learn where the camera came to rest, and this
 *   event to keep an overlay glued to the map while it travels (pair it with `project()`).
 * @csspart base - The non-semantic map wrapper. It exposes `aria-busy="true"` while the optional
 *   map library loads and contains ordinary, non-live localized loading text.
 * @csspart configuration-error - Localized control or URL configuration feedback.
 * @csspart geolocate - Native user-activated geolocation button.
 * @csspart container - The MapLibre container. Its generated canvas is the actual focusable map
 *   region and receives the host-first accessible name and effective locale.
 * @slot anchor - Content placed at `anchorLngLat`: above the point, flipped below near the top edge
 *   and kept inside the map, following the point through camera moves and hidden while the point
 *   is off screen. The element only positions it (`part="anchor"` supplies a default surface);
 *   the slotted content owns its semantics, close control and focus.
 * @csspart anchor - The positioned wrapper of the `anchor` slot.
 * @slot legend - Custom legend content, rendered inside the legend panel's own layout so it stays
 *  positioned with the map instead of floating beside it. Slotted content is never made
 *  interactive by `legendInteractive`, which only reaches rows projected from `legend`.
 * @slot legend-start - The same extension point at the TOP of the legend panel: it renders ahead
 *  of the gradient bar and every projected row, where `legend` renders after them. Content here
 *  alone opens the panel, exactly as `legend`
 *  content alone does, and it is never made interactive by `legendInteractive`.
 * @csspart legend - The map legend.
 * @csspart legend-swatch - A legend color swatch, or the entry's glyph when it carries an `icon`
 *   — in which case the swatch drops its color block, border and pattern overlay, carries
 *   `data-icon="true"`, and paints the glyph itself in the entry color as the non-color cue. It
 *   nests inside `legend-toggle` on an interactive row and stays `aria-hidden`/`inert` there, so it
 *   never contributes to the button's accessible name.
 * @csspart legend-toggle - The `button` an interactive legend row renders around its swatch and
 *   label when `legendInteractive` is set and the row carries a `value`. Absent entirely when
 *   either is missing, so an unset map's legend markup is unchanged.
 * @csspart legend-toggle-hidden - Second token carried alongside `legend-toggle` while that row's
 *   category is in `hiddenCategories`. State lives in the part name rather than a separate
 *   attribute, so `::part(legend-toggle-hidden)` is a reachable styling hook.
 * @csspart legend-group - The `role="group"` wrapping one consecutive run of legend rows that
 *   share a `group`. Absent entirely when no admitted entry carries one, so an ungrouped legend's
 *   markup is unchanged.
 * @csspart legend-group-heading - The visible heading naming a `legend-group`. It renders the
 *   caller-supplied `group` string verbatim and names the group through `aria-labelledby`.
 * @csspart legend-disclosure - The `button` that collapses and expands the whole legend panel.
 *   Rendered only when `legendCollapsible` is set, so an unset map's legend markup is unchanged.
 *   It carries the localized panel name as its visible, accessible label plus `aria-expanded`
 *   rendered as the literal `"true"`/`"false"`, and it grows to the shared `--lr-icon-button-size`
 *   hit-area floor.
 * @csspart legend-disclosure-icon - The decorative chevron inside `legend-disclosure`. It is the
 *   wrapping part that rotates (per the shared icon set's contract), including under RTL.
 * @csspart legend-gradient - The continuous ramp bar rendered from `legendGradient`.
 * @csspart legend-lo - The low endpoint caption of the `legendGradient` bar (mirrors `lr-heatmap`).
 * @csspart legend-hi - The high endpoint caption of the `legendGradient` bar (mirrors `lr-heatmap`).
 * @csspart legend-ticks - The row of labelled marks under the gradient bar, when ticks are shown.
 * @csspart legend-tick - One labelled mark under the gradient bar, positioned at its value.
 * @csspart legend-derived - The swatch list `choroplethLegend` derives (step bands, no data).
 * @csspart legend-limit - Visible localized summary when legend input is bounded or shortened.
 * @csspart marker - A MapLibre-generated marker, with a 24px minimum target in both axes even
 *   when a peer/custom marker has no intrinsic content size.
 * @csspart popup - A MapLibre-generated marker popup.
 * @csspart popup-content - The content container inside a MapLibre-generated marker popup.
 * @csspart popup-close-button - The MapLibre-generated button that closes an open marker popup.
 * @csspart attribution - MapLibre-generated map attribution.
 * @csspart attribution-toggle - MapLibre's compact-attribution disclosure control with a decorative information glyph.
 * @csspart navigation - Standard peer NavigationControl group, added through `controls` or the map getter.
 * @csspart zoom-in - Peer zoom-in button with a localized accessible name and tokenized target.
 * @csspart zoom-out - Peer zoom-out button.
 * @csspart compass - Peer compass/reset-north button; its glyph retains the peer's bearing rotation.
 * @csspart scale - Standard peer ScaleControl bar. Units and updates remain owned by MapLibre.
 * @csspart error - Visible localized message shown instead of `container` when `mapStyle` is
 *   missing, the optional peer is unavailable, WebGL2 cannot be created, or map initialization
 *   fails; the transition is announced through the shared light-DOM assertive region.
 * @cssprop [--lr-map-height=var(--lr-size-24rem)] - Default host block size, shared with the
 *   pre-upgrade reservation stylesheet. An explicit outer `block-size` still wins.
 * @cssprop [--lr-map-choropleth-fill-opacity=0.75] - Fill opacity for choropleth and polygon
 *   `dataLayers` fills. Read from the resolved cascade whenever those layers are applied or painted
 *   after a theme change.
 * @cssprop [--lr-map-hidden-category-opacity=0.15] - Opacity a hidden category's points, point
 *   strokes and point icons are muted to in the rendered MapLibre paint. Read from the resolved
 *   cascade on every paint, because MapLibre draws to a WebGL canvas the CSS cascade never reaches.
 * @cssprop [--lr-map-legend-hidden-swatch-opacity=0.5] - Opacity of a hidden interactive legend
 *   row's decorative swatch. Only the `aria-hidden` swatch dims; the label re-colors through the
 *   quiet text token instead, so it keeps AA contrast.
 * @cssprop [--lr-map-popup-close-button-hover-bg=var(--lr-color-brand-quiet)] - Hover background
 *   of `popup-close-button`.
 * @cssprop [--lr-map-popup-close-button-hover-color=var(--lr-color-brand)] - Hover foreground of
 *   `popup-close-button`.
 * @cssprop [--lr-map-popup-close-button-active-bg=color-mix(in oklab, var(--lr-color-brand-quiet), var(--lr-color-mix-partner) var(--lr-color-mix-active))] - Pressed background of `popup-close-button`.
 * @cssprop [--lr-map-popup-close-button-active-color=var(--lr-color-brand)] - Pressed foreground
 *   of `popup-close-button`.
 *
 * The legend is read-only unless `legendInteractive` is set, which is opt-in for a reason: an
 * unset map renders exactly the key it rendered before, with no button, no extra attribute and no
 * extra MapLibre paint key. Only a row that carries its own `value` becomes a toggle -- the key is
 * never derived from an `icon` record's `value`, which would silently make a row operable the
 * author never marked. Each toggle is a native `button`, so it is one independent tab stop per row
 * (a 100-row legend contributes 100, exactly as a 100-series `lr-chart` legend does) and it grows
 * to the shared `--lr-icon-button-size` hit-area floor. Activation emits the cancelable
 * `lr-map-legend-toggle-request`; there is deliberately no confirmation event, because the
 * committed state is `hiddenCategories` and the host already observes it. A hidden category mutes
 * its points, point strokes and point icons through `--lr-map-hidden-category-opacity`; a
 * `kind: 'heatmap'` entry is deliberately out of scope, having no per-category field to mute.
 *
 * No style or tile provider is selected implicitly. Set `mapStyle` explicitly before connection;
 * this prevents a bare component from making an undeclared third-party request.
 * Navigation, scale, attribution and the legend follow the surrounding Glass or Solid treatment.
 * The legend material remains stationary while its public surface scrolls. Opaque accessibility
 * fallbacks preserve native peer controls and map data paint.
 * @status stable
 * @since 4.0.0
 */
export class LyraMap extends LyraElement<LyraMapEventMap> {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    cancel: LYRA_DEFAULT_cancel,
    close: LYRA_DEFAULT_close,
    collapse: LYRA_DEFAULT_collapse,
    copy: LYRA_DEFAULT_copy,
    date: LYRA_DEFAULT_date,
    details: LYRA_DEFAULT_details,
    duration: LYRA_DEFAULT_duration,
    items: LYRA_DEFAULT_items,
    legendTypeHidden: LYRA_DEFAULT_legendTypeHidden,
    legendTypeShown: LYRA_DEFAULT_legendTypeShown,
    loading: LYRA_DEFAULT_loading,
    map: LYRA_DEFAULT_map,
    mapActivate: LYRA_DEFAULT_mapActivate,
    mapCancelDrawing: LYRA_DEFAULT_mapCancelDrawing,
    mapCancelPick: LYRA_DEFAULT_mapCancelPick,
    mapCompleteDrawing: LYRA_DEFAULT_mapCompleteDrawing,
    mapControlUnavailable: LYRA_DEFAULT_mapControlUnavailable,
    mapDrawAtCenter: LYRA_DEFAULT_mapDrawAtCenter,
    mapDrawingArea: LYRA_DEFAULT_mapDrawingArea,
    mapDrawingControls: LYRA_DEFAULT_mapDrawingControls,
    mapDrawingDuplicateVertex: LYRA_DEFAULT_mapDrawingDuplicateVertex,
    mapDrawingEditInstructions: LYRA_DEFAULT_mapDrawingEditInstructions,
    mapDrawingInvalidCoordinate: LYRA_DEFAULT_mapDrawingInvalidCoordinate,
    mapDrawingInvalidGeometry: LYRA_DEFAULT_mapDrawingInvalidGeometry,
    mapDrawingLength: LYRA_DEFAULT_mapDrawingLength,
    mapDrawingTooFewVertices: LYRA_DEFAULT_mapDrawingTooFewVertices,
    mapDrawingUnavailable: LYRA_DEFAULT_mapDrawingUnavailable,
    mapDrawingVertex: LYRA_DEFAULT_mapDrawingVertex,
    mapDrawingVertexLimit: LYRA_DEFAULT_mapDrawingVertexLimit,
    mapDrawingVertices: LYRA_DEFAULT_mapDrawingVertices,
    mapExportUnavailable: LYRA_DEFAULT_mapExportUnavailable,
    mapFeatureStateUnavailable: LYRA_DEFAULT_mapFeatureStateUnavailable,
    mapFeedback: LYRA_DEFAULT_mapFeedback,
    mapGeolocateError: LYRA_DEFAULT_mapGeolocateError,
    mapGeolocateFindLocation: LYRA_DEFAULT_mapGeolocateFindLocation,
    mapGeolocateOutOfBounds: LYRA_DEFAULT_mapGeolocateOutOfBounds,
    mapGeolocatePermissionDenied: LYRA_DEFAULT_mapGeolocatePermissionDenied,
    mapGeolocatePositionUnavailable: LYRA_DEFAULT_mapGeolocatePositionUnavailable,
    mapGeolocateTimeout: LYRA_DEFAULT_mapGeolocateTimeout,
    mapGeolocateUnavailable: LYRA_DEFAULT_mapGeolocateUnavailable,
    mapHashConflict: LYRA_DEFAULT_mapHashConflict,
    mapHashInvalid: LYRA_DEFAULT_mapHashInvalid,
    mapInitializationFailed: LYRA_DEFAULT_mapInitializationFailed,
    mapLegend: LYRA_DEFAULT_mapLegend,
    mapMarker: LYRA_DEFAULT_mapMarker,
    mapMissingLibrary: LYRA_DEFAULT_mapMissingLibrary,
    mapPickAtCenter: LYRA_DEFAULT_mapPickAtCenter,
    mapResetNorth: LYRA_DEFAULT_mapResetNorth,
    mapScaleFeet: LYRA_DEFAULT_mapScaleFeet,
    mapScaleKilometers: LYRA_DEFAULT_mapScaleKilometers,
    mapScaleMeters: LYRA_DEFAULT_mapScaleMeters,
    mapScaleMiles: LYRA_DEFAULT_mapScaleMiles,
    mapScaleNauticalMiles: LYRA_DEFAULT_mapScaleNauticalMiles,
    mapSquareKilometers: LYRA_DEFAULT_mapSquareKilometers,
    mapSquareMeters: LYRA_DEFAULT_mapSquareMeters,
    mapStyleRequired: LYRA_DEFAULT_mapStyleRequired,
    mapToggleAttribution: LYRA_DEFAULT_mapToggleAttribution,
    mapUndoDrawing: LYRA_DEFAULT_mapUndoDrawing,
    mapWebglUnavailable: LYRA_DEFAULT_mapWebglUnavailable,
    navigation: LYRA_DEFAULT_navigation,
    noData: LYRA_DEFAULT_noData,
    open: LYRA_DEFAULT_open,
    paginationSummary: LYRA_DEFAULT_paginationSummary,
    remove: LYRA_DEFAULT_remove,
    search: LYRA_DEFAULT_search,
    select: LYRA_DEFAULT_select,
    zoomIn: LYRA_DEFAULT_zoomIn,
    zoomOut: LYRA_DEFAULT_zoomOut,
  };
  // GENERATED DEFAULT-STRING SLICE: END
  protected static override collectionSupport = collectionSupport;

  protected static override readonly immutableEventDetails = Object.freeze([
    'lr-map-click',
    'lr-map-feature-enter',
    'lr-map-feature-leave',
    'lr-map-pointer-move',
    'lr-map-contextmenu',
    'lr-map-pick',
    'lr-map-anchor-close',
    'lr-map-draw-start', 'lr-map-draw-change', 'lr-map-draw-complete', 'lr-map-draw-cancel', 'lr-map-draw-vertex-end',
    'lr-map-legend-panel-toggle-request',
    'lr-map-legend-toggle-request',
    'lr-map-marker-activate',
    'lr-map-move',
    'lr-map-export-error',
    'lr-map-geolocate',
    'lr-map-style-load',
    'lr-map-idle',
    'lr-map-view-change',
  ]);
  /** MapLibre features and admitted marker snapshots carry opaque peer values that the generic
   *  event-detail snapshotter must not walk. The marker is already a frozen canonical record; its
   *  `unsafeHtml` value therefore reaches both Popup and activation consumers by identity. */
  protected static override readonly identityEventDetailProperties = Object.freeze({
    'lr-map-click': Object.freeze(['feature']),
    // Already a bounded, deeply frozen copy; walking a large geometry again would be wasted work.
    'lr-map-feature-enter': Object.freeze(['feature']),
    'lr-map-feature-leave': Object.freeze(['feature']),
    'lr-map-contextmenu': Object.freeze(['feature']),
    'lr-map-pick': Object.freeze(['feature']),
    'lr-map-marker-activate': Object.freeze(['marker']),
  });

  protected static override readonly ownedCollectionProperties = Object.freeze([
    'center',
    'mapStyle',
    'overlays',
    'choropleth',
    'markers',
    'dataLayers',
    'images',
    'styleOverrides',
    'interactiveBasemapLayers',
  ]);
  /** The retained raw values are opaque after their schema projections below admit them. */
  protected static override readonly identityCollectionProperties = Object.freeze([
    'markers',
    'dataLayers',
    'images',
    'styleOverrides',
  ]);
  protected static override readonly identityCollectionObjectProperties = Object.freeze([
    'mapStyle',
    'choropleth',
    'overlays',
  ]);

  static override styles = [LyraElement.styles, styles, srOnly];
  private readonly hostDescription = new HostDescriptionController(
    this, () => (this._map?.getCanvas?.() as HTMLCanvasElement | undefined) ?? null,
  );

  /** Starts the shared optional-peer import without constructing a map. Returns false when the
   * peer is unavailable, so applications can decide whether to render their own fallback before
   * connecting an element. */
  static preload(engine: LyraMapEngine = 'modular'): Promise<boolean> {
    return (engine === 'maplibre' ? loadMaplibre() : loadModularMap()).then((module) => module !== null);
  }

  constructor() {
    super();
    new ThemeWatcher(this, () => {
      if (!this.syncPaintTheme()) return;
      const coordinated = this.refreshThemePaint();
      this.legendIsLine = this.legendDescribesLine();
      if (!coordinated) this.drawingController?.repaint();
    });
    new GlassScrollLayer(this, '[part="legend"]');
  }

  /** Initial and controlled map center as `[longitude, latitude]`. Once the camera settles after
   * a user gesture or `fitBounds()`, it holds that camera (see `lr-map-view-change`), so a map
   * rebuilt after a reconnect opens where the user left it. Assigning a value the map already
   * shows moves nothing; an assignment that interrupts an animation or gesture applies `zoom`
   * too, so the camera never keeps a half-finished axis.
   *
   * Compared by value against the last value assigned: a new array holding the same two numbers
   * is not a new request, even after a gesture, fit or camera command, so a framework that
   * rebuilds an equal array on every render never pulls the map back over the user's pan. A
   * different value still moves the camera; `jumpTo()` is the explicit way to re-centre. */
  @property({ type: Array })
  get center(): readonly [number, number] {
    return this._center;
  }
  set center(value: readonly [number, number]) {
    if (this.hasAssignedCenter && sameCenterValue(value, this.assignedCenter)) return;
    this.hasAssignedCenter = true;
    this.assignedCenter = snapshotCenter(value);
    this._center = value;
  }
  /** The last value the host assigned to `center`, copied, so a later equal assignment is a no-op
   *  however far the camera has since travelled. */
  private assignedCenter: unknown;
  private hasAssignedCenter = false;
  private _center: readonly [number, number] = Object.freeze([0, 0] as [number, number]);
  /** Initial and controlled map zoom level. Tracks the settled camera and reconciles the same way
   * as `center`. Clamped into the zoom limits (`minZoom`/`maxZoom`, `[0, 22]` by default). */
  @property({ type: Number }) zoom = 2;

  /**
   * Lowest zoom level the camera may reach, in `[0, 24]`. Unset leaves the engine's own floor, `0`.
   * Forwarded to the engine at construction and live: gestures, `zoom`, `fitBounds()`,
   * `fitToData()`, the URL `hash` and the camera commands all stay inside the limits. Raising it
   * above the camera moves the camera to the limit and writes the clamped value into `zoom`,
   * without an `lr-map-view-change`. A non-finite value counts as unset; when both limits are set
   * and `minZoom` exceeds `maxZoom`, both are ignored (with a dev-mode warning).
   */
  @property({ type: Number, attribute: 'min-zoom' }) minZoom?: number;

  /**
   * Highest zoom level the camera may reach, in `[0, 24]`. Unset leaves the engine's own ceiling,
   * `22` (or `minZoom` when that is higher). Forwarded and enforced exactly like `minZoom`; a
   * `fitBounds()`/`fitToData()` `maxZoom` above it is lowered to it.
   */
  @property({ type: Number, attribute: 'max-zoom' }) maxZoom?: number;

  /** Whether either zoom limit is set to a usable value, so construction forwards them. */
  private get zoomLimitsRequested(): boolean {
    return [this.minZoom, this.maxZoom].some(value => typeof value === 'number' && Number.isFinite(value));
  }

  /** `[min, max]` zoom limits, normalized into `[0, 24]`; an inverted explicit pair is ignored. */
  private get zoomLimits(): readonly [number, number] {
    const explicit = (value: unknown): number | undefined =>
      typeof value === 'number' && Number.isFinite(value) ? finiteRange(value, 0, 0, 24) : undefined;
    const min = explicit(this.minZoom), max = explicit(this.maxZoom);
    if (min !== undefined && max !== undefined && min > max) {
      devWarnOnce('lyra-map-zoom-limits-inverted', `<${this.localName}>: minZoom ${min} exceeds maxZoom ${max}; both limits are ignored.`);
      return DEFAULT_ZOOM_LIMITS;
    }
    const lower = min ?? 0;
    return [lower, max ?? Math.max(22, lower)];
  }

  /** Screen padding kept clear on each side of the viewport: the camera centre, and every fit, are
   *  measured inside it, so a panel or toolbar covering part of the map does not hide what the map
   *  frames. Sides are physical (not logical) pixels; an omitted side is `0`, and a negative or
   *  non-finite side counts as `0`. It is applied persistently, so it also shapes the `bounds`
   *  that `lr-map-view-change` and `lr-map-move` report (the visible box inside the padding).
   *  Changing it keeps the geographic centre fixed and shifts the picture; it is not reported as a
   *  camera change. Applied to the engine once it exists. */
  @property({ attribute: false }) cameraPadding?: LyraMapPadding;
  /** The padding currently applied to the engine. */
  private appliedPadding: Readonly<Required<LyraMapPadding>> = ZERO_CAMERA_PADDING;

  /** A camera command requested before the map existed; applied once, right after construction,
   *  unless `center` or `zoom` has meanwhile been given a different value. */
  private pendingCommand?: PendingMapCommand;
  /** Identifies this element's own camera commands when their `moveend` arrives from the peer. */
  private readonly commandToken = Object.freeze({});
  /** Set while the settled camera is being written into `center`/`zoom`: that write is the
   *  engine's own state, which the update it schedules does not push back. */
  private reflectingCamera = false;
  /** Invalidates a deferred limit clamp when a newer authored zoom or limit update wins. */
  private zoomLimitRevision = 0;
  /** Whether a `center`/`zoom` write is waiting for the update that pushes it to the peer. */
  private cameraUpdatePending = false;
  /** Camera work waiting for that update, so it applies after the assigned camera, not before. */
  private deferredCameraWork: Array<() => void> = [];
  /** The animation frame a `lr-map-move` report is waiting for. */
  private moveFrame?: number;

  /** A fit requested before the map existed; applied once, right after construction, unless
   *  `center` or `zoom` has meanwhile been given a different value. */
  private pendingFit?: PendingMapFit;
  /** Identifies this element's own fits when their `moveend` arrives from the peer. */
  private readonly fitToken = Object.freeze({});
  /** Whether a non-camera update is pending, so `syncMapSemantics()` has work to do. */
  private semanticsStale = true;
  private markerSemanticsStale = true;
  private geoJsonRefreshRequested = false;
  private refreshingGeoJson = false;
  /** The camera just read back from the peer into `center`/`zoom`. The update that write schedules
   *  consumes it, so that update does not push the same camera straight back. */
  private reflectedCamera?: { readonly center: readonly [number, number]; readonly zoom: number };
  /** Set between the peer's `boxzoomend` and the `moveend` of the animation that follows it. The
   *  peer animates a box zoom with no event data, so this is the only thing that marks that
   *  `moveend` as the user's. */
  private boxZoomSettling = false;
  /** Set while `updated()` moves the peer's camera itself (`center`/`zoom`, a `maxBounds` revert).
   *  Such a move can stop a fit that is still animating, which makes the peer settle that fit
   *  early; the settle must not be written back over the value being applied. */
  private writingCamera = false;

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
   * the same call, then checks the camera survived it. A camera below zoom 1 (fractional zoom
   * included) is tolerated: a rejected box is retried once from zoom 1 and the zoom and centre
   * that were showing are restored, so the limit applies to a map that currently shows the whole
   * world. If the box still cannot be applied the constraint is dropped, so the worst case is an
   * unconstrained map plus a dev-mode warning rather than a blank one.
   */
  @property({ attribute: false }) maxBounds: LyraMapBounds | null = null;

  /**
   * Standard controls to add, `{ navigation, scale, geolocate, attribution }`, each `true`, `false`
   * or an options object with a `position` corner (and, for `scale`, a `unit` of `'metric'` or `'imperial'`). The
   * element adds the control once the map exists, moves it when only its corner changes, replaces
   * it for other option changes and removes
   * it when it is dropped, instead of an application importing the engine's control classes and
   * calling `map.addControl()` itself.
   *
   * The controls are the engine's own, styled with Lyra tokens and exposing the `navigation`,
   * `zoom-in`, `zoom-out`, `compass` and `scale` parts. Their button names come from the `zoomIn`,
   * `zoomOut` and `mapResetNorth` strings and are re-applied when `lang`, `locale` or `strings`
   * change, so they follow a live language switch. Geolocation starts only from user activation;
   * failures emit sanitized codes and localized feedback. Attribution is enabled by default;
   * explicit false disables it. Custom attribution accepts escaped text or guarded HTTP(S) links;
   * invalid custom credits leave provider attribution visible. The visual and keyboard order within
   * each corner is navigation, scale, geolocate, attribution, regardless of import completion order.
   * A requested control
   * whose code cannot load leaves localized feedback while the map remains usable.
   */
  @property({ attribute: false }) controls?: Readonly<LyraMapControls>;

  /** URL fragment ownership of the camera. With the default `hashFormat`, `true` owns the named
   * field `map` (`#map=zoom/lat/lng[/bearing[/pitch]]`) and a string owns that field name; unset
   * does not read or write the URL. Other `&`-separated fragment tokens are preserved.
   *
   * A valid camera in the URL when the map is constructed takes precedence over a queued initial
   * fit. An absent, unrelated or malformed fragment does not suppress the fit: only a valid camera
   * in the owned field or token counts. A malformed owned value is left untouched, and the camera
   * is not written over it until navigation replaces it. Disabling leaves the URL intact. Two
   * connected maps cannot own the same window/key; the first owner keeps it.
   * Any value other than false, null or undefined loads the URL ownership runtime on demand. The
   * map is constructed once it has loaded, and URL feedback appears then; whenIdle() covers it.
   * If that runtime cannot be loaded, the URL is left untouched with localized control feedback. */
  @property({ attribute: false }) hash: boolean | string = false;

  /** Fragment form that `hash` reads and writes. `'named'` (default) uses a `key=` field.
   * `'unnamed'` uses the raw engine's unnamed form, `#zoom/lat/lng[/bearing[/pitch]]`, so existing
   * deep links keep working: the camera is the leading token without `=`, named fields after it
   * are preserved, and a fragment made only of named fields gets the camera prepended. `'unnamed'`
   * takes `hash = true`; a string `hash` is invalid and shows the localized hash feedback. Two
   * maps cannot own the unnamed token of one window, but one may own it beside named owners. */
  @property({ attribute: 'hash-format', converter: HASH_FORMAT }) hashFormat: LyraMapHashFormat = 'named';

  /** The option the URL owner receives: `hash` itself, or the internal unnamed-form selector. */
  private get hashOption(): unknown {
    if (this.hashFormat !== 'unnamed' || !this.hashRequested()) return this.hash;
    // An empty string is never a valid field name, so a named key under `'unnamed'` is invalid.
    return this.hash === true ? MAP_HASH_UNNAMED : '';
  }
  private hashOwner?: MapHashOwner;
  private hashRuntimePending = false;
  private hashRuntimeFailed = false;
  private applyingHash = false;
  @state() private hashIssue?: 'mapHashConflict' | 'mapHashInvalid' | 'mapControlUnavailable';
  @state() private controlIssue?: Exclude<keyof typeof MAP_CONFIGURATION_MESSAGE, 'mapHashConflict' | 'mapHashInvalid'>;

  private pendingHashIssue?: LyraMap['hashIssue'];
  private pendingControlIssue: LyraMap['controlIssue'];

  private setControlIssue(issue: LyraMap['controlIssue']): void {
    this.pendingControlIssue = issue;
    if (this.mapUpdateActive) this.scheduleAfterUpdate(() => { this.controlIssue = this.pendingControlIssue; }, 'map-control-feedback');
    else this.controlIssue = issue;
  }

  /** Whether `hash` asks for URL ownership; only these values need the ownership runtime. */
  private hashRequested(): boolean {
    return this.hash !== false && this.hash !== undefined && this.hash !== null;
  }

  /** The URL owner once its runtime has loaded; a requested hash starts loading it once. */
  private hashRuntime(): MapHashOwner | undefined {
    if (this.hashOwner || !this.hashRequested() || this.hashRuntimeFailed) return this.hashOwner;
    const runtime = loadMapHashRuntime.loaded;
    if (runtime) return this.hashOwner = new runtime.MapHashOwner();
    if (!this.hashRuntimePending) {
      this.hashRuntimePending = true;
      this.trackFeatureLoad(loadMapHashRuntime().then(() => undefined, () => { this.hashRuntimeFailed = true; }).then(() => {
        this.hashRuntimePending = false;
        if (!this.isConnected) return;
        this.syncHash(); this.applyHash(); this.tryConstructMap();
      }));
    }
    return undefined;
  }

  /** Optional runtimes still loading, together with the work their arrival resumes. */
  private featureLoads = 0;

  /** Readiness waits for an on-demand runtime and the continuation it resumes. */
  private trackFeatureLoad(work: Promise<void>): void {
    this.featureLoads += 1;
    this.readiness.invalidate();
    void work.finally(() => { this.featureLoads -= 1; this.readiness.check(); });
  }

  private syncHash(): void {
    if (!this.isConnected) return;
    const owner = this.hashRuntime();
    const status = owner ? owner.configure(this.ownerDocument.defaultView, this.hashOption, () => this.applyHash()) : undefined;
    const issue = status === 'conflict' ? 'mapHashConflict' : status === 'invalid' ? 'mapHashInvalid'
      : !owner && this.hashRuntimeFailed && this.hashRequested() ? 'mapControlUnavailable' : undefined;
    this.pendingHashIssue = issue;
    this.scheduleAfterUpdate(() => {
      const latest = this.pendingHashIssue;
      if (latest !== this.hashIssue) {
        this.hashIssue = latest;
        if (latest) this.announcements.announceAssertive(this.localize(MAP_CONFIGURATION_MESSAGE[latest]));
      }
    }, 'map-hash-feedback');
  }

  private applyHash(): void {
    if (this.mapUpdateActive) {
      this.scheduleAfterUpdate(() => this.applyHash(), 'map-apply-hash');
      return;
    }
    const map = this._map, connection = this._connectGeneration, option = this.hashOption;
    const current = () => this.isConnected && this._map === map && this._connectGeneration === connection && this.hashOption === option;
    const owner = this.hashOwner;
    if (!owner) return;
    const result = owner.read();
    if (!map || !current() || this.applyingHash) return;
    if (result.status === 'none') { this.writeHash(map); return; }
    if (result.status !== 'camera') return;
    const camera = result.camera;
    try {
      const shown = readPeerCamera(map); if (!current()) return;
      const bearing = map.getBearing?.() ?? 0; if (!current()) return;
      const pitch = map.getPitch?.() ?? 0; if (!current()) return;
      if (shown && shown.zoom === camera.zoom && shown.center[0] === camera.center[0] &&
        shown.center[1] === camera.center[1] && bearing === camera.bearing && pitch === camera.pitch) return;
      this.applyingHash = true;
      try { this.applyCameraCommand(map, 'jumpTo', { ...camera, center: [...camera.center] }, false); }
      finally { this.applyingHash = false; }
    } catch { /* A partial peer cannot apply this URL camera. */ }
  }

  private writeHash(map: MapLibreMapCapability): void {
    const connection = this._connectGeneration, option = this.hashOption;
    const current = () => this.isConnected && this._map === map && this._connectGeneration === connection && this.hashOption === option;
    if (!current() || this.applyingHash) return;
    try {
      const camera = readPeerCamera(map); if (!camera || !current()) return;
      const bearing = map.getBearing?.() ?? 0; if (!current()) return;
      const pitch = map.getPitch?.() ?? 0; if (!current()) return;
      this.hashOwner?.write({ ...camera, bearing, pitch });
    } catch { /* Unavailable camera state cannot replace an existing URL field. */ }
  }

  /**
   * Where the content slotted into `anchor` sits, `[longitude, latitude]`, or `null`/`undefined`
   * for none. The slotted content (a feature's details, say) is placed above the point, flipped
   * below it near the top edge and kept inside the map, follows the point as the camera moves and
   * is hidden while the point is off screen or the map is not ready. Use the `lngLat` of an
   * `lr-map-click` to anchor content to a clicked feature. See the `anchor` slot. The first
   * coordinate loads the anchor placement runtime on demand; placement, already asynchronous,
   * follows once it has loaded, and the anchor stays hidden if it cannot be loaded.
   */
  @property({ attribute: false }) anchorLngLat?: readonly [number, number] | null;
  /** Additional clipping boundaries intersected with map allocation. Accepts a connected Element
   * or a dense array of at most32 connected same-document Elements. An empty array adds none.
   * Invalid boundaries hide the anchor until corrected; caller arrays are never retained or mutated. */
  @property({ attribute: false }) anchorBoundary?: LyraMapAnchorBoundary;
  /** Nonnegative finite CSS-pixel logical insets inside the map allocation, in addition to the
   * existing8px placement padding. Missing edges default0; explicit invalid values/accessors hide
   * the anchor. Oversized valid edges collapse available allocation. Caller data is not mutated. */
  @property({ attribute: false }) anchorSafeArea?: LyraMapAnchorSafeArea;
  /** Adds a localized close action and nonmodal Escape ownership. Opening never moves focus. */
  @property({ type: Boolean, attribute: 'anchor-closable' }) anchorClosable = false;
  /** Defers native construction until visible (default), browser idle time (`idle`), immediate
   * admission (`eager`), or the first user input on the element (`interaction`): a pointer press,
   * touch, wheel, key press or click anywhere on it. Until then an `interaction` map shows its
   * placeholder with a localized `initialization-activate` button, so keyboard and assistive
   * technology users can start it too; focus moves to the map once it has been built from that
   * button. `whenIdle()` and `whenStyleReady()` wait for construction, so they settle only after
   * that input (or `initializationDelay`). Changing this before construction reschedules
   * admission; a live map is retained. */
  @property() initialization: LyraMapInitialization = 'visible';
  /** With `initialization="interaction"`, also constructs the map this many milliseconds after it
   * connected when no input arrived first. Unset (default) waits for input only; other modes ignore
   * it. A negative or non-finite value counts as unset. */
  @property({ type: Number, attribute: 'initialization-delay' }) initializationDelay?: number;
  private get safeInitializationDelay(): number | undefined {
    const delay = this.initializationDelay;
    return typeof delay === 'number' && Number.isFinite(delay) && delay >= 0 ? finiteDuration(delay, 0) : undefined;
  }
  private get initializationMode(): LyraMapInitialization {
    const mode = this.initialization;
    return mode === 'idle' || mode === 'eager' || mode === 'interaction' ? mode : 'visible';
  }
  /** An `interaction` map waiting for its first input, with its activation button rendered. */
  private get awaitingActivation(): boolean {
    return this.initializationMode === 'interaction' && !this._map && !this.failure && !this.loading &&
      this.constructionScheduler?.constructed !== true;
  }

  private _mapStyle?: Readonly<LyraMapStyleSpecification> | string;
  private _mapStyleSource?: Readonly<LyraMapStyleSpecification> | string;
  private _mapStyleRevision = 0;
  /** Required MapLibre style URL or peer-neutral style specification. No provider is contacted
   * unless a consumer assigns this property. Generated text accepts a nonempty glyph URL or
   * native font-faces with at most 64 families, 256 faces per family and 64 Unicode ranges per face. */
  @property({ attribute: false })
  get mapStyle(): Readonly<LyraMapStyleSpecification> | string | undefined { return this._mapStyle; }
  set mapStyle(value: Readonly<LyraMapStyleSpecification> | string | undefined) {
    if (value === this._mapStyleSource || value === this._mapStyle) return;
    const revision = ++this._mapStyleRevision;
    this._mapStyleSource = value;
    const previous = this._mapStyle;
    const snapshot = snapshotMapStyle(value, this.ownerDocument.defaultView) as Readonly<LyraMapStyleSpecification> | string | undefined;
    if (revision !== this._mapStyleRevision) return;
    this._mapStyle = snapshot;
    this.requestUpdate('mapStyle', previous);
  }
  private _legend = EMPTY_MAP_LEGEND;
  private _legendSource?: unknown;
  private _legendProjection = EMPTY_MAP_LEGEND_PROJECTION;
  private _legendGrouped = false;
  /** Immutable, bounded entries rendered in the optional map legend. A required pattern keeps
   * category identity available when authored colors collapse or are unavailable. */
  @property({ attribute: false })
  get legend(): readonly LyraMapLegendEntry[] {
    return this._legend;
  }
  set legend(value: readonly LyraMapLegendEntry[]) {
    if (value === this._legendSource || value === this._legend) return;
    this._legendSource = value;
    const previous = this._legend;
    const normalized = normalizeMapLegend(value);
    this._legend = normalized.entries;
    this._legendProjection = normalized.projection;
    this._legendGrouped = normalized.grouped;
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

  /** The same presence flag for `slot="legend-start"`, tracked separately so a header alone opens
   *  the panel and so the two extension points never stand in for one another. */
  @state() private hasLegendStartSlot = false;

  /** Light-DOM probe for slotted legend content, valid before the slot itself has ever rendered. */
  private probeLegendSlot(name: 'legend' | 'legend-start'): boolean {
    for (const child of Array.from(this.children)) {
      if (child.getAttribute('slot') === name) return true;
    }
    return false;
  }
  private _legendGradient: readonly (readonly [number, string])[] = Object.freeze([]);
  private _legendGradientSource?: unknown;
  private legendIsLine = false;
  /**
   * Renders the legend as a **continuous** gradient bar with endpoint labels instead of (or
   * alongside) the discrete `legend` swatches — the standard key for a choropleth, whose
   * `interpolate` fill is itself a continuous ramp that discrete rows cannot honestly describe.
   *
   * Takes the same `[value, color]` stop shape as `choropleth.stops`, so the usual assignment is
   * `legendGradient = myChoropleth.stops`. A dev-mode diagnostic reports an independently authored
   * copy that drifts from the layer. Stops are sorted ascending, bounded, and filtered to finite
   * values carrying a CSS-parsable color; fewer than two usable stops render no bar at all, since a
   * one-stop "gradient" is a flat block that describes nothing. A logarithmic choropleth samples
   * the same exponential interpolation in its visible key.
   *
   * Endpoint labels default to this component's locale-aware formatting of the lowest and highest
   * stop values; `legendGradientLoLabel`/`legendGradientHiLabel` override them.
   */
  get legendGradient(): readonly (readonly [number, string])[] {
    return this._legendGradient;
  }
  set legendGradient(value: readonly (readonly [number, string])[]) {
    if (value === this._legendGradientSource || value === this._legendGradient) return;
    this._legendGradientSource = value;
    const previous = this._legendGradient;
    this._legendGradient = normalizeMapLegendGradient(value);
    this.requestUpdate('legendGradient', previous);
  }

  /** Dev-mode-only: catches a gradient key whose value/color stops disagree with the layer it
   * claims to describe. Warning preserves explicit override behavior while making drift visible. */
  private warnOnLegendChoroplethMismatch(): void {
    if (!litDevWarnings() || this.legendIsLine) return;
    const layer = this.canonicalChoropleth;
    const legend = this.legendGradient;
    if (!layer || legend.length === 0 || layer.stops.length === 0) {
      return;
    }
    const sameLength = legend.length === layer.stops.length;
    const sameStops =
      sameLength &&
      legend.every(([legendValue, legendColor], index) => {
        const layerStop = layer.stops[index];
        return (
          layerStop !== undefined &&
          layerStop[0] === legendValue &&
          resolvedLayerColor(this, layerStop[1], undefined) ===
            resolvedLayerColor(this, legendColor, undefined)
        );
      });
    if (sameStops) return;
    devWarnOnce(
      'lyra-map-legend-choropleth-mismatch',
      `<${this.localName}>: legendGradient does not match choropleth.stops, so the visible key ` +
        'may misdescribe the map. Assign the same stops array to both, or derive both from one ' +
        'source.',
    );
  }

  private legendDescribesLine(): boolean {
    const stops = this.legendGradient;
    if (stops.length < 2) return false;
    return this.canonicalDataLayers.some((layer) => layer.kind === 'auto' && !layer.cluster && layer.line?.field &&
      layer.line.stops.length === stops.length && layer.line.stops.every(([value, color], index) =>
        value === stops[index]![0] && resolvedLayerColor(this, color, layer.tone) ===
        resolvedLayerColor(this, stops[index]![1], layer.tone)));
  }
  /** Overrides the low endpoint's caption; defaults to the lowest stop value, locale-formatted. */
  @property({ attribute: 'legend-gradient-lo-label' }) legendGradientLoLabel: string | null = null;
  /** Overrides the high endpoint's caption; defaults to the highest stop value, locale-formatted. */
  @property({ attribute: 'legend-gradient-hi-label' }) legendGradientHiLabel: string | null = null;

  private _legendGradientTicks = EMPTY_LEGEND_GRADIENT_TICKS;
  private _legendGradientTicksSource?: unknown;
  /**
   * Labelled marks under the legend gradient bar, `[{ value, label? }]` or bare numbers, at their
   * position on the ramp. Values are in the data's own units, so a logarithmic ramp keeps its marks
   * at the true data positions. Bounded to 16, sorted ascending and de-duplicated; a mark outside
   * the ramp's lowest and highest stop is not drawn. Without a `label` a mark reads the
   * locale-formatted value. Marks mirror under RTL together with the bar.
   *
   * Ticks accompany `legendGradient` or the ramp `choroplethLegend` derives; without a gradient they
   * render nothing. With `choroplethLegend`, assigning ticks replaces the derived marks (the
   * interior stop values), and assigning an empty array draws none.
   */
  @property({ attribute: false })
  get legendGradientTicks(): readonly LyraMapLegendGradientTick[] {
    return this._legendGradientTicks;
  }
  set legendGradientTicks(value: readonly (number | LyraMapLegendGradientTick)[]) {
    if (value === this._legendGradientTicksSource) return;
    this._legendGradientTicksSource = value;
    const previous = this._legendGradientTicks;
    this._legendGradientTicks = normalizeMapLegendGradientTicks(value);
    this._legendGradientTicksAssigned = Array.isArray(value);
    this.requestUpdate('legendGradientTicks', previous);
  }
  private _legendGradientTicksAssigned = false;

  /**
   * Derives the legend from `choropleth`. A `'step'` ramp renders one swatch row per band
   * (`< 10`, `10 – 20`, `≥ 50`, numbers formatted for the locale), because a continuous bar would
   * misdescribe discrete bands; a `'linear'` or `'logarithmic'` ramp renders the gradient bar from
   * `choropleth.stops` with its interior stops as ticks. When `choropleth.noData` is set, a
   * hatched swatch captioned with its `label` (or the localized "No data") joins the key.
   *
   * An explicit `legendGradient` replaces the derived bar and an explicit `legend` renders ahead
   * of the derived rows, so a key can still be authored by hand. Default `false`.
   */
  @property({ type: Boolean, attribute: 'choropleth-legend', reflect: true })
  choroplethLegend = false;

  private derivedLegend: DerivedChoroplethLegend = EMPTY_DERIVED_LEGEND;

  /** Counts from the latest bounded legend normalization. `truncated` covers omitted rows or
   * shortened labels; the returned record is frozen and never aliases caller input. Read-only --
   * derived from the live `legend` normalization, never assignable. The setter is a documented
   * no-op (matching `LyraChart.chartArea`'s pattern) so an accidental `.legendProjection=${x}`
   * Lit template binding degrades silently instead of throwing from inside lit-html's
   * property-commit. */
  get legendProjection(): LyraMapLegendProjection {
    return this._legendProjection;
  }
  set legendProjection(_value: LyraMapLegendProjection) {
    /* read-only, derived from the latest `legend` normalization; direct writes are silently ignored */
  }

  /**
   * Turns every legend row that carries a `value` into a keyboard-operable visibility toggle;
   * rows without one stay inert. Default `false`.
   *
   * Each toggle is an independently tabbable native `button`, so Enter and Space are the
   * platform's own activation and no roving tabindex is involved. The consequence is stated
   * rather than hidden: a 100-row interactive legend contributes 100 tab stops, exactly as a
   * 100-series `lr-chart` legend does. Each row also grows to the `--lr-icon-button-size` hit-area
   * floor; the legend panel's own `max-block-size`/`overflow: auto` contains the taller list.
   */
  @property({ type: Boolean, attribute: 'legend-interactive', reflect: true })
  legendInteractive = false;

  private _legendControlRole: LyraMapLegendControlRole = 'button';

  /**
   * How each keyed `legendInteractive` row's toggle control presents itself to assistive tech.
   * Inert while `legendInteractive` is unset, exactly like the toggle itself.
   *
   * - `'button'` (default) -- `<button aria-pressed>`.
   * - `'checkbox'` -- the SAME `<button>` element `renderLegendRow()` already renders, with its
   *   implicit role overridden to `role="checkbox"` and `aria-checked` in place of `aria-pressed`.
   *   A native `<input type="checkbox">` was considered and rejected: it would need its own
   *   swatch/label markup and its own click/keyboard wiring duplicated from the button branch,
   *   splitting `renderLegendRowContent()` in two. `<button role="checkbox">` keeps the swatch,
   *   the label, the click handler and the platform's own Enter/Space activation exactly as they
   *   are for the button branch -- only the two ARIA attributes differ, so the CSS in
   *   `map.styles.ts` (which targets `button[part~='legend-toggle']`, never a role or an ARIA
   *   state) needs no `'checkbox'`-specific rule.
   *
   * `aria-checked` tracks the same `visible` flag `aria-pressed` does, inverted from
   * `hiddenCategories`: a hidden category renders `aria-checked="false"`. Both states always
   * render explicitly (`"true"`/`"false"`), never a Lit `?aria-*` presence directive, which cannot
   * express the false state at all.
   */
  @property({ converter: LEGEND_CONTROL_ROLE, attribute: 'legend-control-role', reflect: true })
  get legendControlRole(): LyraMapLegendControlRole {
    return this._legendControlRole;
  }
  set legendControlRole(next: LyraMapLegendControlRole) {
    const normalized = LEGEND_CONTROL_ROLE.normalizeReflected(this, 'legend-control-role', next);
    const old = this._legendControlRole;
    if (old === normalized) return;
    this._legendControlRole = normalized;
    this.requestUpdate('legendControlRole', old);
  }

  /**
   * Renders a disclosure button inside the legend panel that collapses the key down to its header.
   * Default `false`.
   *
   * A collapsed panel hides the gradient bar, the rows, the `legend-limit` summary and the
   * trailing `legend` slot; the `legend-start` slot and the disclosure itself stay visible, so a
   * slotted header survives the collapse and the control that would restore the key is never the
   * thing the collapse hides.
   */
  @property({ type: Boolean, attribute: 'legend-collapsible', reflect: true })
  legendCollapsible = false;

  /**
   * Whether a `legendCollapsible` panel is expanded. Defaults **open**, so adding only
   * `legendCollapsible` never hides an existing key; it does nothing at all while
   * `legendCollapsible` is unset.
   *
   * It is a `true`-defaulting boolean, so it uses `trueDefaultBooleanConverter` rather than Lit's
   * presence-based boolean converter, which cannot express `legend-open="false"` at all. The
   * reflection follows the same converter: open (the default) reflects as an ABSENT attribute and
   * collapsed reflects as `legend-open="false"`.
   *
   * Controlled public state, so -- exactly like `hiddenCategories` -- it deliberately survives a
   * disconnect and reconnect: the "reset transient open-state in `disconnectedCallback()`" rule
   * covers dropdown/preview/tooltip `@state`, not a documented property a host owns and re-reads.
   * A programmatic assignment reconciles the rendered panel without emitting
   * `lr-map-legend-panel-toggle-request`, so a controlled host cannot loop.
   */
  @property({ attribute: 'legend-open', reflect: true, converter: trueDefaultBooleanConverter })
  legendOpen = true;

  /** True only when a collapsible panel is actually collapsed. `legendOpen` alone never hides
   *  anything, so an author who sets `legend-open="false"` without `legendCollapsible` -- and
   *  therefore renders no control to restore it -- still gets a readable key. */
  private get legendCollapsed(): boolean {
    return this.legendCollapsible && !this.legendOpen;
  }

  /**
   * Flips the whole panel's disclosure from the `legendCollapsible` button.
   *
   * The veto is the absence of a write, not a write that is undone afterwards: a listener that
   * owns the open state can assign its own `legendOpen` without this handler clobbering it.
   */
  private toggleLegendPanel(): void {
    if (!this.legendCollapsible) return;
    const open = !this.legendOpen;
    const proposal = this.emit('lr-map-legend-panel-toggle-request', { open }, { cancelable: true });
    if (proposal.defaultPrevented) return;
    this.legendOpen = open;
  }

  /** The panel disclosure, or nothing at all when the panel cannot collapse. The chevron is
   *  decorative: the button's own visible, localized text carries its name, and `aria-expanded`
   *  carries the state. */
  private renderLegendDisclosure(): TemplateResult | typeof nothing {
    if (!this.legendCollapsible) return nothing;
    return html`<button
      part="legend-disclosure"
      type="button"
      aria-expanded=${this.legendOpen ? 'true' : 'false'}
      aria-controls="map-legend-list"
      @click=${(): void => this.toggleLegendPanel()}
    ><span part="legend-disclosure-icon" class="legend-disclosure-icon" aria-hidden="true"
      >${chevronIcon()}</span
      ><span>${this.localize('mapLegend')}</span></button>`;
  }

  private _hiddenCategories: readonly string[] = EMPTY_HIDDEN_CATEGORIES;
  private _hiddenCategoriesSource?: unknown;
  /**
   * Complete controlled set of muted category keys, mirroring `lr-chart`'s `hiddenDatasets`.
   * Clone-owned and frozen; non-string, empty, whitespace-only and duplicate entries are dropped,
   * and at most 100 keys are retained. Honoured on the first render and the first MapLibre paint,
   * not only after a user toggle. An empty array deliberately means every category is visible.
   *
   * Controlled public state, so it deliberately survives a disconnect and reconnect: the
   * "reset transient open-state in `disconnectedCallback()`" rule covers dropdown/preview/tooltip
   * `@state`, not a documented property a host owns and re-reads.
   */
  @property({ attribute: false })
  get hiddenCategories(): readonly string[] {
    return this._hiddenCategories;
  }
  set hiddenCategories(value: readonly string[]) {
    if (value === this._hiddenCategoriesSource || value === this._hiddenCategories) return;
    this._hiddenCategoriesSource = value;
    const previous = this._hiddenCategories;
    this._hiddenCategories = normalizeMapHiddenCategories(value);
    this.requestUpdate('hiddenCategories', previous);
  }
  /** Optional GeoJSON choropleth layer and value-to-color configuration. */
  @property({ attribute: false }) choropleth?: Readonly<LyraMapChoroplethLayer>;
  /** Point markers rendered over the map. Explicit IDs are unique-nonempty first-wins. An idless
   * marker is instead identified by its coordinate occurrence, so colocated idless markers remain
   * separate. At most the first 2,000 entries are inspected; use dataLayers with cluster for
   * larger collections. markersTruncated reports an omitted suffix. */
  @property({ attribute: false }) markers: readonly LyraMapMarker[] = [];
  /** Whether authored marker entries exceed the 2,000-entry inspection ceiling. */
  get markersTruncated(): boolean {
    const descriptor = getOwnDataDescriptor(this.markers, 'length');
    return typeof descriptor !== 'symbol' && typeof descriptor.value === 'number' && descriptor.value > MAX_MAP_MARKERS;
  }

  /**
   * Additive GeoJSON layers rendered alongside the choropleth/markers -- each entry becomes a
   * source plus fill/line/circle layers. `sourceId` values are trimmed, must be nonempty, and retain
   * only their first occurrence. Defaults empty; at most 100 entries are inspected. Automatic
   * diffs inspect at most 10,000 features and 10,000,000 values (4,096 per feature, minimum
   * 50,000); larger changes use whole-source replacement or explicit updateSourceData().
   * Call requestUpdate() after intentionally mutating an opaque GeoJSON source in place.
   *
   * An entry opts into either of two other renderings, both strictly additive: `cluster` turns its
   * source into a natively clustered one (aggregate circle, count label, unclustered points), which
   * is what thousands of points need and what `markers` -- one real DOM element per entry -- cannot
   * be; `kind: 'heatmap'` replaces the geometry split with MapLibre's own `heatmap` layer. Neither
   * changes an entry that sets neither. `point` adds categorical circle paint and bounded SVG path
   * icons to ordinary or clustered points on the same source; `line` adds numeric route paint.
   * Explicit vector/raster/image/canvas entries add native external sources (up to 32); vector
   * entries name sourceLayer and line/circle/fill/symbol render families. HTTP(S) URL templates
   * use the engine transport contract and its CORS/provider behavior, without library response
   * byte ceilings. Image/canvas corners are TL/TR/BR/BL longitude/latitude pairs. Same-source
   * paint changes retain the source; supported native image/canvas setters retain update identity.
   * Optional text labels require a glyph-capable style and support bounded native expressions.
   */
  @property({ attribute: false }) dataLayers: readonly LyraMapDataLayer[] = [];

  /** Immutable native source/layer descriptors with stable IDs. Up to 128 sources and 128 layers
   * are snapshotted as bounded plain data (50,000 values, 10,000 entries per container and 1 MiB of
   * text in total); a rejected assignment shows the localized initialization failure. Canvas
   * sources retain only source.canvas by identity. A `geojson` source's `Feature` or
   * `FeatureCollection` `data` object is retained by identity instead, outside that budget, so
   * large data keeps native paint and layout expressions, filters, `minzoom`/`maxzoom`, symbol
   * layers, feature state and `before` ordering. Assigning a new data object updates the native
   * source in place (`setData`), keeping its layers and retiring its feature state; mutating the
   * retained object is not observed, and `updateSourceData()` forwards an incremental diff.
   * IDs must not collide with basemap/generated resources. Images, sources and layers replay in
   * dependency order after style changes; before targets refer to native layer IDs. A missing
   * target appends the layer. Hits skip a layer outside its zoom range, hidden, or with every
   * opacity known to be `0`. Direct mutation of registered peer IDs is unsupported.
   *
   * A layer's `source` may name a source of the basemap style itself (for example its vector
   * tiles, with a `source-layer`), so an application can restyle or highlight basemap features
   * without registering a copy of that source; the layer is restored after every style change
   * that still defines the source. Color-valued `paint` strings may be theme tokens (`var(--…)`),
   * `currentColor` or CSS color functions (`oklch()`, `color-mix()`, …): they resolve against this
   * host, convert to sRGB for the engine, and re-resolve when its theme changes. */
  @property({ attribute: false }) overlays: LyraMapOverlays = {};

  /** Immutable portable atlas images, prepared before registered symbol layers. Up to 1,024 stable
   * IDs accept sanitized inline SVG or CORS-readable SVG/PNG/JPEG/WebP URLs, within an aggregate
   * budget of 16,777,216 backing pixels and 8 MiB of encoded input. Explicit width/height
   * describe bounded backing pixels; pixelRatio changes logical size; `sdf: true` registers a
   * signed-distance-field image that `icon-color` recolors. Unchanged descriptors reuse
   * prepared pixels across updates and styles. Reassign to update/remove: an added, changed or
   * removed image is applied in place, without removing or re-adding the layers that use it.
   * Preparation failures reject readiness and show the localized initialization fallback. */
  @property({ attribute: false }) images: readonly LyraMapImage[] = [];

  /** Lazy atlas images: called with an image ID that a style layer needs and that neither
   * `images` nor the basemap sprite provides, through the engine's missing-image hook. Return (or
   * resolve to) an `images`-style descriptor with that same `id`, or nothing to leave it missing.
   * The descriptor is sanitized and rasterized like an `images` entry and shares its count, pixel
   * and byte budget; an image over budget, invalid or rejected stays missing (dev-mode warning)
   * without failing the map. Each ID is asked once per provider: its pixels are kept and re-added
   * after a `mapStyle` swap. Assigning `images` an ID the provider supplied hands it over to
   * `images`. Replacing or clearing the provider removes the images it supplied. The engine waits
   * for the provider before laying out the symbols that need the image, so `whenIdle()` covers it. */
  @property({ attribute: false }) imageProvider?: LyraMapImageProvider;

  /** Immutable paint/layout overrides for existing basemap layers only. Each entry names one layer
   * by `layerId`, or selects every current style layer whose `source`, `sourceLayer` and
   * `layerType` match the fields it gives; an explicit id wins over a selector, and an earlier
   * selector over a later one, and selectors re-match after each style swap (`styleLayers` lists
   * the candidates). Generated and registered layers own their own paint. Removing an override
   * restores its original value; changing mapStyle captures a new baseline. Color-valued strings
   * that are CSS var() tokens, currentColor or CSS color functions resolve against this host and
   * update with its theme. Up to 64 entries and 32 properties per kind are admitted, and a
   * selector may expand to at most 1,024 layers in total. */
  @property({ attribute: false }) styleOverrides: readonly LyraMapStyleOverride[] = [];


  private _canonicalChoroplethSource: unknown = UNPROJECTED_MAP_VALUE;
  private _canonicalChoropleth: CanonicalMapChoropleth | undefined;
  private _canonicalDataLayersSource: unknown = UNPROJECTED_MAP_VALUE;
  private _canonicalDataLayersBase = '';
  private _canonicalDataLayersOrigin = '';
  private _canonicalExternalLayers: readonly CanonicalMapExternalLayer[] = [];
  private invalidDataLayerModel = false;
  @state() private dataLayerIssue = false;
  private pendingDataLayerIssue = false;

  private setDataLayerIssue(issue: boolean): void {
    this.pendingDataLayerIssue = issue;
    this.scheduleAfterUpdate(() => {
      const next = this.pendingDataLayerIssue;
      if (next === this.dataLayerIssue) return;
      this.dataLayerIssue = next;
      if (next && this.isConnected) this.announcements.announceAssertive(this.localize('mapInitializationFailed'));
    }, 'map-data-layer-feedback');
  }
  private committedDataLayers: readonly CanonicalMapDataLayer[] = EMPTY_CANONICAL_MAP_DATA_LAYERS;
  private committedExternalLayers: readonly CanonicalMapExternalLayer[] = [];
  private groupOrderActive = false;
  private readonly plannedDataLayerIds = new Map<string, string>();
  private _canonicalDataLayers: readonly CanonicalMapDataLayer[] = EMPTY_CANONICAL_MAP_DATA_LAYERS;
  private _canonicalMarkersSource: unknown = UNPROJECTED_MAP_VALUE;
  private _canonicalMarkers: readonly CanonicalMapMarker[] = EMPTY_CANONICAL_MAP_MARKERS;

  /** A property assignment gets one descriptor projection; every subsequent map path uses it. */
  private get canonicalChoropleth(): CanonicalMapChoropleth | undefined {
    const source = this.choropleth;
    if (Object.is(source, this._canonicalChoroplethSource)) return this._canonicalChoropleth;
    this._canonicalChoroplethSource = source;
    this._canonicalChoropleth = projectMapChoropleth(source);
    return this._canonicalChoropleth;
  }

  private get canonicalDataLayers(): readonly CanonicalMapDataLayer[] {
    const source = this.dataLayers;
    const base = this.ownerDocument.baseURI, origin = this.ownerDocument.defaultView?.origin ?? 'null';
    if (Object.is(source, this._canonicalDataLayersSource) && base === this._canonicalDataLayersBase && origin === this._canonicalDataLayersOrigin) return this._canonicalDataLayers;
    this._canonicalDataLayersSource = source;
    this._canonicalDataLayersBase = base; this._canonicalDataLayersOrigin = origin;
    const model = projectMapDataLayerModel(source, { baseUrl: base, ownerOrigin: origin, projectGeoJson: projectMapDataLayer });
    this.invalidDataLayerModel = !model.ok;
    if (model.ok) {
      this._canonicalDataLayers = model.geojson;
      this._canonicalExternalLayers = model.external;
    }
    return this._canonicalDataLayers;
  }

  private get canonicalMarkers(): readonly CanonicalMapMarker[] {
    const source = this.markers;
    if (Object.is(source, this._canonicalMarkersSource)) return this._canonicalMarkers;
    this._canonicalMarkersSource = source;
    this._canonicalMarkers = projectMapMarkers(source);
    return this._canonicalMarkers;
  }

  /** Accessible name for MapLibre's focusable canvas; a host `aria-label` wins. Defaults to the
   *  localized `map` message, which an explicit empty string suppresses. */
  @property() label?: string;

  /** Optional engine. Set before connecting; changes take effect after disconnect/reconnect.
   * `modular` loads `@aceshooting/lyra-map`; `maplibre` explicitly selects the full `maplibre-gl`
   * peer. No engine is substituted when the selected peer is unavailable. */
  @property({ converter: MAP_ENGINE }) engine: LyraMapEngine = 'modular';

  /** True until the selected lazy-loaded map engine has settled (success or failure). */
  @state() private loading = true;

  /** Classified failure rendered as localized ordinary text and announced through the owner
   * document's assertive sink. */
  @state() private failure?: MapFailureReason;
  private readonly announcements = new AnnouncementSinkController(this, { eager: ['assertive'] });

  // Overridable instance field (not a direct `loadMaplibre()` call site) purely so tests can
  // inject a stubbed loader before the element ever connects -- matches docx-viewer's own
  // `loadLibrary` field/rationale exactly.
  private loadLibrary: (engine: LyraMapEngine) => ReturnType<typeof loadMaplibre> =
    engine => engine === 'maplibre' ? loadMaplibre() : loadModularMap();

  // Scheduler admission is connection-owned and does not construct while detached.
  private visible = false;
  private constructionScheduler?: MapConstructionScheduler;
  private constructionMode: LyraMapInitialization = 'visible';
  private constructionDelay?: number;


  @query('[part="container"]') private containerEl?: HTMLElement;
  @query('[part="anchor"]') private anchorEl?: HTMLElement;
  @query('.anchor-boundary') private anchorBoundaryEl?: HTMLElement;
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
  private _appliedGeoJson = new Map<string, CanonicalGeoJsonProjection>();
  private _nextDataLayerId = 0;
  private nextPointIconId = 0;
  private appliedPointPaint = new Set<string>();
  /** Layer ids whose paint currently carries a muting opacity, so the first paint after the last
   *  category is un-hidden can restore it -- and a layer that was never muted keeps its paint
   *  object free of the key entirely. Keyed by layer id, not source id, because one source's
   *  circle and point-icon layers mute independently on different fields. */
  private appliedPointMuting = new Set<string>();
  private appliedPointIcons = new Map<string, {
    signature: string;
    color: string;
    icons: readonly { id: string; icon: CanonicalPointIcon }[];
  }>();
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
  /** The canonical marker each live instance last rendered, keyed like `_markerInstances`. */
  private _markerSources = new Map<string, CanonicalMapMarker>();
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
  private _styleGeneration = 0;
  private readonly readiness = new MapReadiness();
  /** Native resource owners, created once their runtime has loaded for requested resources. */
  private ownedFeatures?: MapOwnedFeatures;
  private externalFeatures?: MapOwnedFeatures;
  private externalFeatureWorkStarted = false;
  private externalIdStyle = -1;
  private externalIdCounter = 0;
  private readonly externalSourceIds = new Map<string, string>();
  private readonly appliedGeoLabels = new Map<string, string>();
  private readonly peerEvents = new MapEngineEvents();
  private optionalFeatureWorkStarted = false;
  /** Explicit basemap layer opt-in; all other basemap features remain noninteractive. Each entry
   * names one layer by `layerId`, or selects every current style layer whose `source`,
   * `sourceLayer` and `layerType` match the fields it gives (for example
   * `{ sourceLayer: 'poi', layerType: 'symbol' }`); an explicit id wins over a selector, and an
   * earlier selector over a later one. Selectors re-match after each style swap; `styleLayers`
   * lists what they match against. */
  @property({ attribute: false }) interactiveBasemapLayers: readonly LyraMapBasemapInteraction[] = [];
  /** Pick coordinates by clicking the map or using the localized center-pick button. */
  @property({ type: Boolean, attribute: 'pick-mode' }) pickMode = false;
  /** Arms bounded line or polygon drawing. The first accepted vertex starts the session.
   * Pick mode cancels drawing without automatic resumption. Completion/cancellation reset to none.
   * Drawing preserves pan/zoom and temporarily owns double-click zoom. Maximum 512 vertices.
   * Accepted edits update desired state synchronously; whenIdle() covers temporary resource preparation.
   * Arming loads the drawing runtime on demand: the controls render at once, and the session starts
   * once that runtime has loaded and the style is ready. whenIdle() also covers that load. */
  @property({ attribute: 'draw-mode', converter: DRAW_MODE }) drawMode: LyraMapDrawingMode = 'none';
  /** Shows localized on-map measurement labels while drawing or editing: each segment's length,
   * a polygon's closing segment and its area at the centroid, and a line's total length beside its
   * last vertex. Lengths and areas are great-circle measurements, as in the drawing metrics,
   * formatted in metric units with the component locale. The same total also appears, for
   * assistive technology, beside the vertex count. Default `false`. */
  @property({ type: Boolean, attribute: 'drawing-measurements', reflect: true }) drawingMeasurements = false;
  @state() private drawingIssue?: keyof typeof MAP_DRAWING_MESSAGE;
  /** Bumped whenever a rendered value owned by the drawing controller changes. */
  @state() private drawingRevision = 0;
  /** Sessions, editing and temporary resources, once the drawing runtime has loaded. */
  private drawingController?: MapDrawingController;
  /** `loading` while the drawing runtime imports; `failed` until drawing is requested again. */
  private drawingLoad?: 'loading' | 'failed';
  private suppressDrawingClick = false;
  private drawingResetting = false;
  /** Advances when a drawing or armed mode ends; an image export in progress is tied to it. */
  private drawingEpoch = 0;
  private get drawingPending(): boolean { return this.drawingController?.pending === true; }
  private get drawingWork(): Promise<void> { return this.drawingController?.work ?? NO_DRAWING_WORK; }
  @state() private featureStateIssue = false;
  @state() private interactionBlocked = false;
  /** Hit-target routing over the accepted routes, so every hit can name its target. */
  private readonly stateRouter = new MapFeatureStateRouter();
  /** Desired feature state, created by the first write once its runtime has loaded. */
  private featureStates?: MapFeatureStateRoutes;
  /** `loading` while the state runtime imports; `failed` until a new style or connection. */
  private featureStateLoad?: 'loading' | 'failed';
  private stateRequested = false;
  private stateRoutingAvailable = true;
  private stateRoutes: readonly MapFeatureStateRoute[] = [];
  private readonly sourceIdentities = new Map<string, { readonly data: unknown; readonly shape: string; readonly token: object }>();
  private interactions: readonly AppliedMapInteraction[] = [];
  private interactionGeneration = 0;
  private interactionQuery = 0;
  private queryingMap = false;
  private hovered?: { readonly key: string; readonly detail: LyraMapInteractionDetail };
  private readonly mapCursor = new MapCursorOwner();
  private pointerCleanup?: () => void;
  private interactionObserver?: MutationObserver;

  private featureWork: Promise<void> = Promise.resolve();
  private finishFeatureWork?: () => void;
  private featureGeneration = 0;
  private featureAbort?: AbortController;
  private preparingFeatures = false;
  private preparedFeatureSignature?: string;
  private pendingMapLoad = false;
  private mapLoadEmitted = false;
  private rebuildGeneratedLayers = false;

  /** The underlying runtime `maplibregl.Map`, declared through Lyra's peer-neutral common-method
   * subset so consumers do not acquire a mandatory `maplibre-gl` type dependency. Consumers that
   * install the optional peer may explicitly narrow this value to its full `Map` type. */
  get map(): LyraMapInstance | undefined {
    return this._map as unknown as LyraMapInstance | undefined;
  }

  /**
   * Resolves when the current connection/style has restored generated and registered overlays,
   * images and basemap overrides, including asynchronous image and feature preparation. Callable while the connected map is still loading or
   * waiting to become visible. Rejects with AbortError when disconnected or superseded, and
   * MapReadinessError on a current load/preparation failure. A completed promise describes only
   * that style; call again after assigning a new mapStyle.
   */
  whenStyleReady(): Promise<void> {
    return this.readiness.whenStyleReady();
  }

  /**
   * Resolves when the current style, camera, sources and component preparation are idle. Each
   * call checks current work; the first idle is not reused after a later update. Rejects with
   * AbortError on disconnect/style replacement and MapReadinessError on a current peer or
   * preparation failure. Peers without a loaded() probe require a subsequent idle event.
   */
  whenIdle(): Promise<void> {
    return this.readiness.whenIdle();
  }

  /** Pushes `geojson` into an existing source, preferring an incremental property update over a
   *  whole-source replace. `setData()` always re-tiles everything; `updateData()` (maplibre-gl 3+)
   *  does not, which is the difference between a smooth animated choropleth and a heavy one. */
  private pushGeoJson(
    source: MapLibreGeoJsonSource,
    resolvedSourceId: string,
    geojson: unknown,
    projection: CanonicalGeoJsonProjection = projectGeoJson(geojson),
  ): void {
    const previous = this._appliedGeoJson.get(resolvedSourceId);
    if (previous === projection) return;
    const diff =
      typeof source.updateData === 'function' && previous !== undefined
        ? buildProjectedGeoJsonPropertyDiff(previous, projection)
        : null;
    if (diff === null || typeof source.updateData !== 'function') source.setData(geojson);
    else if (diff.update.length > 0 || diff.add?.length || diff.remove?.length)
      source.updateData(diff);
    this._appliedGeoJson.set(resolvedSourceId, projection);
  }

  /** Forwards a caller-authored diff to an applied dataLayers or choropleth public sourceId, or to
   * an applied `overlays` GeoJSON source ID. Returns false before the source is ready, after
   * disconnect, or if the engine lacks updateData. An overlay source replays its assigned `data`
   * after a `mapStyle` swap, so fold the diff into that data before the next swap or assignment.
   * The diff is passed through without cloning; the caller owns feature IDs and validity. This
   * route bypasses the automatic 10,000-feature comparison ceiling. It does not rewrite public
   * properties; reassigning controlled GeoJSON later replaces this imperative state in full. */
  updateSourceData(sourceId: string, diff: LyraMapSourceDataDiff): boolean {
    if (!this._map || !this._styleLoaded || !this.isConnected || typeof sourceId !== 'string') return false;
    const publicId = sourceId.trim();
    const resolved = this._appliedDataLayerIds.get(publicId) ??
      (this.canonicalChoropleth?.sourceId === publicId ? this._appliedChoroplethSourceId : undefined) ??
      (this.ownedFeatures?.ownsGeoJsonSource(publicId) ? publicId : undefined);
    if (!resolved) return false;
    const source = this._map.getSource(resolved) as MapLibreGeoJsonSource | undefined;
    if (typeof source?.updateData !== 'function') return false;
    this._appliedGeoJson.delete(resolved);
    this.readiness.invalidate();
    source.updateData(diff);
    this.readiness.check();
    return true;
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
   *  * Once that transform is already damaged, the defensive `getZoom()`/`getCenter()` snapshots
   *    can throw too. They therefore belong to the same boundary as the mutation and readback.
   *
   * A camera below zoom 1 is tolerated: the rejected box is retried once from zoom 1 and the zoom
   * and centre that were shown are restored, so a box constraining a map that currently shows
   * the whole world (fractional zoom 0.3, say) applies instead of being dropped.
   *
   * Otherwise the answer is the same: drop the constraint and restore the camera -- an
   * unconstrained map is a far smaller defect than a blank one -- and say so once, naming the
   * property. Both failures therefore share one revert path.
   */
  private applyMaxBounds(): void {
    const map = this._map;
    if (!map || typeof map.setMaxBounds !== 'function') return;
    const bounds = this.safeMaxBounds;
    let zoomBefore: number | undefined;
    let centerBefore: { lng: number; lat: number } | undefined;
    try {
      zoomBefore = map.getZoom();
      centerBefore = map.getCenter();
      if (this.constrainTo(map, bounds)) return;
      // The failure the peer shows at a sub-1 fractional zoom in a wide container is specific to
      // that zoom, so retry the same box once from zoom 1 and put the camera back afterwards. A box
      // that still fails there, or a camera that does not survive the restore, takes the revert
      // below.
      if (
        bounds !== null && typeof zoomBefore === 'number' && Number.isFinite(zoomBefore) && zoomBefore < 1 &&
        this.constrainFromWholeZoom(map, bounds, zoomBefore, centerBefore)
      ) return;
    } catch {
      // Fall through to the shared revert below. Clearing `maxBounds` is what un-wedges the
      // peer's transform, so it must happen even though the call that wedged it threw.
    }
    try {
      map.setMaxBounds(null);
    } catch {
      // Nothing further to try: the revert is best-effort by construction.
    }
    if (typeof zoomBefore === 'number' && Number.isFinite(zoomBefore)) map.setZoom(zoomBefore);
    if (centerBefore) map.setCenter([centerBefore.lng, centerBefore.lat]);
    devWarnOnce(
      'lyra-map-max-bounds-rejected',
      '<lr-map>: maxBounds left maplibre-gl without a usable camera, so it was dropped and the '
        + 'camera restored. This is a peer limitation, not a bad value -- it shows up at sub-1 '
        + 'fractional zooms in wide containers. Raise the zoom, narrow the box, or leave maxBounds '
        + 'unset.'
    );
  }

  /** Applies the constraint and reports whether the camera survived it. Never throws. */
  private constrainTo(map: MapLibreMapCapability, bounds: LyraMapBounds | null): boolean {
    try {
      map.setMaxBounds?.(bounds);
      return bounds === null || Number.isFinite(map.getZoom());
    } catch {
      return false;
    }
  }

  /**
   * Forwards `minZoom`/`maxZoom` to a live engine. The order keeps the engine's own `min <= max`
   * invariant at every step. A camera the new limits move is written back into `zoom`, without a
   * view-change report: the host assigned the limits, so the clamp is its own intent.
   */
  private applyZoomLimits(): void {
    const map = this._map;
    if (!map || typeof map.setMinZoom !== 'function' || typeof map.setMaxZoom !== 'function') return;
    const revision = ++this.zoomLimitRevision;
    const authoredZoom = this.zoom, minZoom = this.minZoom, maxZoom = this.maxZoom;
    const connection = this._connectGeneration, generation = this._styleGeneration, style = this.mapStyle;
    const [min, max] = this.zoomLimits;
    const current = (): boolean => this.isConnected && this._map === map && this.zoomLimitRevision === revision &&
      this._connectGeneration === connection && this._styleGeneration === generation && this.mapStyle === style &&
      Object.is(this.zoom, authoredZoom) && Object.is(this.minZoom, minZoom) && Object.is(this.maxZoom, maxZoom);
    this.writeCamera(() => {
      try {
        const currentMax = map.getMaxZoom?.();
        if (typeof currentMax === 'number' && min > currentMax) { map.setMaxZoom!(max); map.setMinZoom!(min); }
        else { map.setMinZoom!(min); map.setMaxZoom!(max); }
      } catch { /* A peer that rejects the limits keeps its previous ones. */ }
    });
    if (!current() || (this.zoom >= min && this.zoom <= max)) return;
    // Native constraints apply immediately; reactive normalization waits until Lit has finished.
    this.scheduleAfterUpdate(() => {
      if (!current()) return;
      const shown = readPeerCamera(map);
      if (!current() || !shown || this.zoom === shown.zoom) return;
      this.reflectedCamera = { center: shown.center, zoom: shown.zoom };
      this.reflectingCamera = true;
      try { this.zoom = shown.zoom; } finally { this.reflectingCamera = false; }
    }, `map-zoom-limits-${revision}`);
  }

  /** Installs the current `imageProvider` on the live engine, loading the owned-resource runtime
   *  once a provider is first assigned; a map that never sets one never loads it. */
  private syncImageProvider(): void {
    const map = this._map, provider = this.imageProvider;
    if (!map) return;
    const apply = (runtime: NonNullable<typeof loadMapOwnedFeatureRuntime.loaded>): void => {
      if (this._map !== map || !this.isConnected || this.imageProvider !== provider) return;
      if (typeof provider !== 'function' && !this.ownedFeatures) return;
      (this.ownedFeatures ??= new runtime.MapOwnedFeatures()).configureImageProvider(map, provider, this);
    };
    const runtime = loadMapOwnedFeatureRuntime.loaded;
    if (runtime) { apply(runtime); return; }
    if (typeof provider !== 'function') { this.ownedFeatures?.configureImageProvider(map, undefined, this); return; }
    this.trackFeatureLoad(loadMapOwnedFeatureRuntime().then(apply, () => {
      devWarnOnce('lyra-map-image-provider-runtime', `<${this.localName}>: the imageProvider runtime could not be loaded; missing images stay missing.`);
    }));
  }

  /** Retries a rejected constraint from zoom 1, then restores the zoom and centre that were shown. */
  private constrainFromWholeZoom(
    map: MapLibreMapCapability,
    bounds: LyraMapBounds,
    zoom: number,
    center: { lng: number; lat: number },
  ): boolean {
    try {
      map.setMaxBounds?.(null);
      map.setZoom(1);
      if (!this.constrainTo(map, bounds)) return false;
      map.setZoom(zoom);
      map.setCenter([center.lng, center.lat]);
      return Number.isFinite(map.getZoom());
    } catch {
      return false;
    }
  }

  /** `zoom` normalized to a finite value clamped into the zoom limits -- `minZoom`/`maxZoom` when
   *  set, otherwise maplibre-gl's own defaults `[0, 22]`, the bounds the underlying map itself
   *  enforces when neither option is passed. A non-finite value would otherwise
   *  reach the constructor's initial `zoom` option or a live `setZoom()` call unnormalized. */
  private get safeZoom(): number {
    const [min, max] = this.zoomLimits;
    return finiteRange(this.zoom, 2, min, max);
  }

  /** Longitude/latitude normalized before reaching MapLibre's constructor or live setter. */
  private get safeCenter(): [number, number] {
    const center = Array.isArray(this.center) ? this.center : [];
    return [
      finiteRange(Number(center[0]), 0, -180, 180),
      finiteRange(Number(center[1]), 0, -90, 90),
    ];
  }

  /**
   * Frames `bounds`, `[[west, south], [east, north]]`, in the viewport: the usual way to show every
   * current marker or a selected region whenever the data set changes.
   *
   * The resulting camera is written into `center` and `zoom` once it settles, and reported through
   * `lr-map-view-change` with `source: 'fit'`. Declarative state therefore stays the single source
   * of truth, and the element's own reconciliation never resets the fitted camera. A later
   * `center`/`zoom` assignment moves the camera as usual.
   *
   * Callable before the map exists (before the optional peer loads, or while an off-screen map is
   * still waiting to be constructed). The most recent such request is queued and applied without
   * animation right after construction, unless `center` or `zoom` has been given a different value
   * since the call: that assignment is the newer intent. Re-assigning the value already held (a
   * framework re-render building an equal array, say) keeps the queued fit.
   *
   * Latitudes lie in `[-90, 90]`, with `south <= north`, and longitudes in `[-180, 180]`. A box
   * crossing the antimeridian takes either of MapLibre's forms: `west > east`, or `east` unwrapped
   * past 180, up to one full turn east of `west` (what the peer's `LngLatBounds` produces). A single
   * point is a valid zero-size box (pair it with `maxZoom`). The camera animates unless `animate` is
   * `false`, the user prefers reduced motion, or the fit was queued.
   *
   * When the padded box cannot fit the map's current size (padding wider or taller than the map),
   * the peer leaves the camera where it is and logs its own warning: the method still returns
   * `true`, and no `lr-map-view-change` fires.
   *
   * There is deliberately no declarative `bounds` property. `center` and `zoom` already describe
   * the camera; a third camera input would need a precedence rule against them, and a framework
   * that rebuilds its arrays on every render would refit on every render and pull the camera away
   * from a user who has just panned. A one-shot command that writes its result back into
   * `center`/`zoom` keeps one camera input.
   *
   * Returns `false`, without moving or queueing anything, when `bounds` is unusable or the loaded
   * peer cannot fit a box, and `true` once the fit is running or queued.
   */
  fitBounds(bounds: LyraMapBounds, options: LyraMapFitBoundsOptions = {}): boolean {
    const box = normalizeFitBounds(bounds);
    if (!box) {
      devWarnOnce(
        'lyra-map-fit-bounds-rejected',
        `<${this.localName}>: fitBounds() ignored a box that is not [[west, south], [east, north]] `
          + 'with finite coordinates, latitudes in [-90, 90], south <= north, and longitudes in '
          + '[-180, 180] (east may run past 180, up to one full turn east of west, for a box '
          + 'crossing the antimeridian).',
      );
      return false;
    }
    const settings: LyraMapFitBoundsOptions =
      typeof options === 'object' && options !== null ? options : {};
    const maxZoom = settings.maxZoom;
    const fit: MapFitRequest = Object.freeze({
      bounds: box,
      padding: normalizeFitPadding(settings.padding),
      maxZoom: isFiniteCoordinate(maxZoom) ? finiteRange(maxZoom, 24, 0, 24) : undefined,
      animate: settings.animate !== false,
    });
    this.clusterZoomToken += 1;
    if (this.deferUntilCameraSettled(() => this.executeFit(fit))) return true;
    return this.executeFit(fit);
  }

  private executeFit(fit: MapFitRequest): boolean {
    const map = this._map;
    if (!map) {
      this.pendingCommand = undefined;
      this.pendingFit = Object.freeze({ fit, center: snapshotCenter(this.center), zoom: this.zoom });
      return true;
    }
    // A live fit is newer than anything still queued from before construction.
    this.pendingFit = undefined;
    this.pendingCommand = undefined;
    return this.applyFit(map, fit, fit.animate && !prefersReducedMotion(this));
  }

  /**
   * Runs `run` after the update that is about to push an assigned `center`/`zoom`, or reports
   * `false` when no such update is pending and the caller should run it now. A camera command that
   * ran first would be undone by that update, which pushes the assigned camera over the command's
   * result; running after it makes the command the newest intent, which it is.
   */
  private deferUntilCameraSettled(run: () => void): boolean {
    if (!this.cameraUpdatePending) return false;
    this.deferredCameraWork.push(run);
    if (this.deferredCameraWork.length === 1) {
      void this.updateComplete.then(() => {
        const work = this.deferredCameraWork;
        this.deferredCameraWork = [];
        for (const task of work) task();
      });
    }
    return true;
  }

  /**
   * Moves the camera with the engine's `flyTo`: a smooth, curved animation to `options`. The
   * resulting camera is written into `center` and `zoom` when it settles, and reported through
   * `lr-map-view-change` with `source: 'command'`, so declarative state stays the single source of
   * truth and the element's own reconciliation never moves the camera a second time.
   *
   * Under `prefers-reduced-motion: reduce` (or `data-lr-motion="reduce"`) the move is a jump.
   * Callable before the map exists: the most recent such request, or `fitBounds()` call, is queued
   * and applied without animation right after construction, unless `center` or `zoom` has been
   * given a different value since. A request made in the same tick as a `center`/`zoom` write
   * applies after that write.
   *
   * Every option is optional; an unusable one is ignored (see `LyraMapCameraOptions`). Returns
   * `false`, without moving or queueing anything, when no option is usable or the loaded engine
   * has no such command, and `true` once the move is running or queued.
   */
  flyTo(options: LyraMapCameraOptions): boolean {
    return this.runCameraCommand('flyTo', options);
  }

  /** Like `flyTo()`, but with the engine's `easeTo`: a straight, eased animation. */
  easeTo(options: LyraMapCameraOptions): boolean {
    return this.runCameraCommand('easeTo', options);
  }

  /**
   * Like `flyTo()`, but without animation: the camera is at `options` at once. This is the explicit
   * way to re-centre the map on a `center` the host already assigned (re-assigning an equal
   * `center` is a no-op).
   */
  jumpTo(options: LyraMapCameraOptions): boolean {
    return this.runCameraCommand('jumpTo', options);
  }

  private runCameraCommand(kind: MapCommandKind, options: LyraMapCameraOptions): boolean {
    const target = normalizeCameraOptions(options, this.zoomLimits);
    if (!target) {
      devWarnOnce(
        'lyra-map-camera-command-rejected',
        `<${this.localName}>: ${kind}() ignored options with no usable center, zoom, bearing or `
          + 'pitch (center is [longitude, latitude]; every number must be finite).',
      );
      return false;
    }
    this.clusterZoomToken += 1;
    if (this.deferUntilCameraSettled(() => this.executeCameraCommand(kind, target))) return true;
    return this.executeCameraCommand(kind, target);
  }

  private executeCameraCommand(kind: MapCommandKind, target: MapCameraTarget): boolean {
    const map = this._map;
    // A command is newer than a fit or command still queued from before construction.
    this.pendingFit = undefined;
    this.pendingCommand = undefined;
    if (!map) {
      this.pendingCommand = Object.freeze({
        kind,
        target,
        center: snapshotCenter(this.center),
        zoom: this.zoom,
      });
      return true;
    }
    return this.applyCameraCommand(map, kind, target, kind !== 'jumpTo' && !prefersReducedMotion(this));
  }

  private applyCameraCommand(
    map: MapLibreMapCapability,
    kind: MapCommandKind,
    target: MapCameraTarget,
    animate: boolean,
  ): boolean {
    const method = animate ? kind : 'jumpTo';
    const command = map[method];
    if (typeof command !== 'function') return false;
    const { duration, ...camera } = target;
    this.readiness.invalidate();
    try {
      command.call(
        map,
        { ...camera, ...(animate && duration !== undefined ? { duration } : {}) },
        { [COMMAND_EVENT_KEY]: this.commandToken },
      );
    } catch {
      return false;
    }
    return true;
  }

  private applyPendingCommand(): void {
    const map = this._map;
    const pending = this.pendingCommand;
    if (!map || !pending) return;
    this.pendingCommand = undefined;
    // A camera assigned a different value after the call is the newer intent.
    if (!sameCenterValue(this.center, pending.center) || !Object.is(this.zoom, pending.zoom)) return;
    this.applyCameraCommand(map, pending.kind, pending.target, false);
  }

  /**
   * Frames everything the map draws: `markers`, every `dataLayers` source and the `choropleth`,
   * measured from the geometry the element has already admitted rather than from the host's raw
   * values. Equivalent to `fitBounds()` of the union of their extents, with the same options,
   * `cameraPadding` and write-back, and `source: 'fit'`.
   *
   * `maxZoom` defaults to `16`, so a single marker does not zoom to the street; pass `maxZoom`
   * explicitly (a non-finite value for no ceiling) to change that. The extent is a plain
   * west-to-east span, so data on both sides of the antimeridian frames the long way round.
   *
   * Returns `false`, doing nothing, when the map draws no geometry at all, and otherwise what
   * `fitBounds()` returns. A `markers`/`dataLayers`/`choropleth` assignment made in the same tick
   * is already counted.
   */
  fitToData(options: LyraMapFitBoundsOptions = {}): boolean {
    const extent = emptyExtent();
    for (const marker of this.canonicalMarkers) extendExtent(extent, marker.lngLat[0], marker.lngLat[1]);
    for (const layer of this.canonicalDataLayers) extendExtentWithGeoJson(extent, layer.geojson);
    const choropleth = this.canonicalChoropleth;
    if (choropleth) extendExtentWithGeoJson(extent, choropleth.geojson);
    const bounds = extentToBounds(extent);
    if (!bounds) return false;
    const settings: LyraMapFitBoundsOptions =
      typeof options === 'object' && options !== null ? options : {};
    return this.fitBounds(bounds, { maxZoom: FIT_TO_DATA_MAX_ZOOM, ...settings });
  }

  /**
   * The position in the map's container, `[x, y]` CSS pixels from its top-left corner, of a
   * `[longitude, latitude]`: what an overlay needs to sit on a coordinate. Reads the camera as it
   * is now (so combine it with `lr-map-move` to follow a moving map), and is relative to the
   * container, not to `cameraPadding`. Returns `undefined` when the map does not exist yet, the
   * engine cannot project, or the input is not a finite pair.
   */
  project(lngLat: readonly [number, number]): LyraMapPoint | undefined {
    const map = this._map;
    if (!map || typeof map.project !== 'function') return undefined;
    if (!Array.isArray(lngLat) || !isFiniteCoordinate(lngLat[0]) || !isFiniteCoordinate(lngLat[1])) {
      return undefined;
    }
    try {
      const { x, y } = map.project([lngLat[0], lngLat[1]]);
      return isFiniteCoordinate(x) && isFiniteCoordinate(y) ? Object.freeze([x, y] as const) : undefined;
    } catch {
      return undefined;
    }
  }

  /**
   * The inverse of `project()`: the `[longitude, latitude]`, longitude wrapped into
   * `[-180, 180]`, under a container position `[x, y]` in CSS pixels. Returns `undefined` when the
   * map does not exist yet, the engine cannot unproject, or the input is not a finite pair.
   */
  unproject(point: LyraMapPoint): readonly [number, number] | undefined {
    const map = this._map;
    if (!map || typeof map.unproject !== 'function') return undefined;
    if (!Array.isArray(point) || !isFiniteCoordinate(point[0]) || !isFiniteCoordinate(point[1])) {
      return undefined;
    }
    try {
      const { lng, lat } = map.unproject([point[0], point[1]]);
      return isFiniteCoordinate(lng) && isFiniteCoordinate(lat)
        ? Object.freeze([wrapLongitude(lng), finiteRange(lat, 0, -90, 90)] as const)
        : undefined;
    } catch {
      return undefined;
    }
  }

  /** Native control ownership, loaded once the engine first needs a control (attribution by default). */
  private controlLifecycle?: MapControlsLifecycle;
  private controlPeer?: { readonly map: MapLibreMapCapability; readonly adapter: MapControlLifecyclePeer };

  private readonly scaleLabels = new Map<string, keyof typeof MAP_SCALE_UNIT_MESSAGE>();

  private controlLocale(): Record<string, string> {
    const unitText = (value: string) => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
    for (const [native, key] of [['ft', 'mapScaleFeet'], ['m', 'mapScaleMeters'], ['km', 'mapScaleKilometers'],
      ['mi', 'mapScaleMiles'], ['nm', 'mapScaleNauticalMiles']] as const) {
      this.scaleLabels.set(native, key); this.scaleLabels.set(this.localize(MAP_SCALE_UNIT_MESSAGE[key]), key);
    }
    return {
      'GeolocateControl.FindMyLocation': this.localize('mapGeolocateFindLocation'),
      'GeolocateControl.LocationNotAvailable': this.localize('mapGeolocateUnavailable'),
      'ScaleControl.Feet': unitText(this.localize('mapScaleFeet')),
      'ScaleControl.Meters': unitText(this.localize('mapScaleMeters')),
      'ScaleControl.Kilometers': unitText(this.localize('mapScaleKilometers')),
      'ScaleControl.Miles': unitText(this.localize('mapScaleMiles')),
      'ScaleControl.NauticalMiles': unitText(this.localize('mapScaleNauticalMiles')),
    };
  }

  /** Owns default attribution as well as explicit controls, so live configuration cannot duplicate it. */
  private syncControls(): void {
    const map = this._map;
    if (!map || typeof map.addControl !== 'function' || typeof map.removeControl !== 'function') return;
    const input = this.controls, connection = this._connectGeneration;
    const projected = normalizeMapControlOptions(input);
    const wanted = new Map(projected.controls);
    const attribution = isRuntimeRecord(input) ? getOwnDataDescriptor(input, 'attribution') : MISSING_OWN_DATA_DESCRIPTOR;
    const defaultAttribution = attribution === MISSING_OWN_DATA_DESCRIPTOR ||
      (attribution !== UNSAFE_OWN_DATA_DESCRIPTOR && attribution.value === undefined);
    if (defaultAttribution || projected.diagnostics.some(issue => issue.kind === 'attribution')) wanted.set('attribution', normalizeMapControlOptions({ attribution: true }).controls.get('attribution')!);
    this.setControlIssue(projected.diagnostics.length ? 'mapControlUnavailable' : undefined);
    const current = () => this.isConnected && this._map === map && this.controls === input && this._connectGeneration === connection;
    if (this.controlPeer?.map !== map) this.controlPeer = { map, adapter: {
      addControl: (control, position) => map.addControl!(control, position),
      removeControl: control => map.removeControl!(control),
      controlContainer: position => this.containerEl?.querySelector<HTMLElement>(`.maplibregl-ctrl-${position}`) ?? undefined,
    } };
    const peer = this.controlPeer.adapter;
    const run = ({ MapControlsLifecycle }: NonNullable<typeof loadMapControlRuntime.loaded>): Promise<void> => (this.controlLifecycle ??=
      new MapControlsLifecycle(kind => loadMapControl(kind, this.engine, this._maplibreModule))).sync(peer, wanted, {
      isCurrent: current,
      onEvent: event => {
        if (!current()) return;
        if (event.kind === 'geolocate-success') {
          if (this.pendingControlIssue !== 'mapControlUnavailable') this.setControlIssue(undefined);
          if (event.lngLat && event.accuracy !== undefined) {
            this.emit('lr-map-geolocate', { lngLat: event.lngLat, accuracy: event.accuracy } satisfies LyraMapGeolocateDetail);
          }
          return;
        }
        const issue = event.kind === 'geolocate-out-of-bounds' ? 'mapGeolocateOutOfBounds'
          : event.code === 'permission-denied' ? 'mapGeolocatePermissionDenied'
          : event.code === 'position-unavailable' ? 'mapGeolocatePositionUnavailable'
          : event.code === 'timeout' ? 'mapGeolocateTimeout' : 'mapGeolocateError';
        this.setControlIssue(issue);
        this.announcements.announceAssertive(this.localize(MAP_CONFIGURATION_MESSAGE[issue]));
        if (event.kind === 'geolocate-out-of-bounds') this.emit('lr-map-geolocate-out-of-bounds', { code: event.code });
        else this.emit('lr-map-geolocate-error', { code: event.code });
      },
      onFailure: failure => {
        if (!current() || (defaultAttribution && failure.kind === 'attribution')) return;
        this.setControlIssue('mapControlUnavailable');
        this.announcements.announceAssertive(this.localize('mapControlUnavailable'));
      },
    });
    const runtime = loadMapControlRuntime.loaded;
    // Without a previously owned control, an empty request needs no control runtime at all.
    const sync = !this.controlLifecycle && wanted.size === 0 ? Promise.resolve() : runtime ? run(runtime) : loadMapControlRuntime().then(run, () => {
      // Fail closed exactly like a control whose own code cannot load; default attribution stays silent.
      if (!current() || ![...wanted.keys()].some(kind => !defaultAttribution || kind !== 'attribution')) return;
      this.setControlIssue('mapControlUnavailable');
      this.announcements.announceAssertive(this.localize('mapControlUnavailable'));
    });
    this.trackFeatureLoad(sync.then(() => { if (current()) this.syncPeerChromeParts(); }));
  }

  /** Placement and close ownership, once a requested coordinate has loaded the anchor runtime. */
  private anchorController?: MapAnchorController;
  /** `loading` while the anchor runtime imports; `failed` until a coordinate is requested again. */
  private anchorLoad?: 'loading' | 'failed';
  private anchorSyncRequested = false;

  private exportController?: MapImageExportController;
  @state() private exportIssue = false;
  private pendingExportIssue = false;

  private publishExportIssue(value: boolean): void {
    this.pendingExportIssue = value;
    this.scheduleAfterUpdate(() => { this.exportIssue = this.pendingExportIssue; }, 'map-export-feedback');
  }

  /** Localized feedback for a failed export, plus its frozen sanitized public event. */
  private reportExportFailure(code: LyraMapImageExportErrorCode): void {
    if (code !== 'cancelled') {
      this.publishExportIssue(true);
      this.announcements.announceAssertive(this.localize('mapExportUnavailable'));
    }
    this.emit('lr-map-export-error', Object.freeze({ code } satisfies LyraMapImageExportErrorDetail));
  }

  private cancelImageExport(): void {
    this.exportController?.cancel();
  }

  /** Exports a fresh current-style WebGL frame as PNG (default), JPEG or WebP. Attribution
   * defaults to true and includes all admitted source/provider and custom credits in a footer.
   * DOM controls, markers and anchored content are excluded. Rejects with a sanitized
   * LyraMapImageExportError code; disconnect or style replacement cancels the operation.
   * The first call loads the export runtime on demand; options are admitted synchronously
   * either way. If that runtime cannot be loaded, the call rejects with `capture-failed`. */
  exportImage(options?: LyraMapImageExportOptions): Promise<Blob> {
    const map = this._map, style = this._styleGeneration, connection = this._connectGeneration;
    if (!map || !this.isConnected) {
      if (this.isConnected) this.reportExportFailure('not-ready');
      return Promise.reject(new LyraMapImageExportError('not-ready'));
    }
    let admitted: unknown, invalid = false;
    if (options !== undefined) {
      try {
        if (!isPlainDataRecord(options)) throw new TypeError('Invalid export options.');
        const keys = Reflect.ownKeys(options);
        if (keys.length > 2 || keys.some(key => key !== 'type' && key !== 'attribution')) throw new TypeError('Invalid export options.');
        const snapshot: Record<string, unknown> = {};
        for (const key of keys) {
          const descriptor = getOwnDataDescriptor(options, key);
          if (descriptor === MISSING_OWN_DATA_DESCRIPTOR || descriptor === UNSAFE_OWN_DATA_DESCRIPTOR) throw new TypeError('Invalid export options.');
          snapshot[String(key)] = descriptor.value;
        }
        admitted = Object.freeze(snapshot);
      } catch { invalid = true; }
    }
    const request: MapImageExportRequest = { map, style, connection, options: admitted, invalid };
    const run = (runtime: NonNullable<typeof loadMapImageExportRuntime.loaded>): Promise<Blob> =>
      (this.exportController ??= new runtime.MapImageExportController(this.imageExportHost())).export(request);
    const runtime = loadMapImageExportRuntime.loaded;
    if (runtime) return run(runtime);
    return loadMapImageExportRuntime().then(run, () => {
      const current = this.isConnected && this._map === map && this._styleGeneration === style && this._connectGeneration === connection;
      if (current) this.reportExportFailure('capture-failed');
      throw new LyraMapImageExportError(current ? 'capture-failed' : 'cancelled');
    });
  }

  private imageExportHost(): MapImageExportHost {
    return {
      element: this,
      current: (map, style, connection) => this.isConnected && this._map === map && this._styleGeneration === style && this._connectGeneration === connection,
      generations: () => [this.featureGeneration, this.drawingEpoch],
      pending: () => this.isUpdatePending || this.preparingFeatures || this.drawingPending,
      onRender: (map, listener) => this.peerEvents.subscribe(map, 'render', listener),
      clearFeedback: () => { this.publishExportIssue(false); },
      fail: code => { this.reportExportFailure(code); },
    };
  }

  /** Closes an actually placed anchor, restoring its prior focus only while it still owns focus.
   * Returns false without dispatch when already hidden, unplaced, inert or closed. */
  closeAnchor(): boolean { return this.anchorController?.close('api') ?? false; }

  /** Explicitly focuses the first eligible rendered anchor action. Returns false for a hidden,
   * stale, inert or not-yet-placed anchor, or when no eligible target exists. Never queues focus. */
  focusAnchor(): boolean { return this.anchorController?.focus() ?? false; }

  /** The anchor controller. A requested coordinate loads its runtime once; nothing can be placed
   * before it exists, so without one the anchor simply stays hidden. */
  private anchorRuntime(): MapAnchorController | undefined {
    if (this.anchorController) return this.anchorController;
    if (this.anchorLngLat === null || this.anchorLngLat === undefined) return undefined;
    const runtime = loadMapAnchorRuntime.loaded;
    if (runtime) return this.anchorController = new runtime.MapAnchorController(this.anchorHost());
    if (this.anchorLoad) return undefined;
    this.anchorLoad = 'loading';
    void loadMapAnchorRuntime().then(() => {
      this.anchorLoad = undefined;
      if (this.isConnected) this.scheduleAnchorSync();
    }, () => { this.anchorLoad = 'failed'; });
    return undefined;
  }

  private syncAnchor(): void { this.anchorRuntime()?.sync(); }

  /** Places the anchor on the next animation frame, once however many callers ask. */
  private scheduleAnchorSync(): void { this.anchorRuntime()?.schedule(); }

  private onAnchorFocus = (event: FocusEvent): void => { this.anchorController?.focusIn(event); };

  private onAnchorSlotChange = (): void => { this.scheduleAnchorSync(); };

  private anchorHost(): MapAnchorHost {
    return {
      element: this,
      wrapper: () => this.anchorEl,
      container: () => this.containerEl,
      fence: () => this.anchorBoundaryEl,
      map: () => this._map,
      styleLoaded: () => this._styleLoaded,
      generations: () => [this._styleGeneration, this._connectGeneration],
      updateActive: () => this.mapUpdateActive,
      afterUpdate: (callback, key) => { this.scheduleAfterUpdate(callback, key); },
      interactionBlocked: () => this.mapInteractionBlocked(),
      direction: () => this.effectiveDirection,
      emitClose: detail => { this.emit('lr-map-anchor-close', detail); },
    };
  }

  /**
   * Eases the camera into a clicked cluster when its entry opted in with `cluster.zoomOnClick`.
   * The expansion zoom comes from the cluster's own source; a peer without that capability, a
   * cluster that has vanished, or a click that a newer one superseded leaves the camera alone.
   */
  private zoomIntoCluster(publicSourceId: string, hit: Feature | undefined): void {
    const map = this._map;
    const layer = this.canonicalDataLayers.find((entry) => entry.sourceId === publicSourceId);
    if (!map || !layer?.cluster?.zoomOnClick) return;
    const clusterId = hit?.properties?.['cluster_id'];
    const geometry = hit?.geometry;
    if (typeof clusterId !== 'number' || geometry?.type !== 'Point') return;
    const [lng, lat] = geometry.coordinates;
    const resolvedId = this._appliedDataLayerIds.get(publicSourceId);
    const source = resolvedId === undefined ? undefined : map.getSource(resolvedId);
    if (!source || typeof source.getClusterExpansionZoom !== 'function') return;
    const token = ++this.clusterZoomToken;
    let eased = false;
    const ease = (zoom: unknown): void => {
      if (eased || token !== this.clusterZoomToken || this._map !== map || !isFiniteCoordinate(zoom)) return;
      // The source and its admitted configuration must still be the ones that were clicked.
      // A pending lookup must not move the camera after its overlay was replaced or disabled.
      if (this.canonicalDataLayers.find((entry) => entry.sourceId === publicSourceId) !== layer ||
        this._appliedDataLayerIds.get(publicSourceId) !== resolvedId || map.getSource(resolvedId!) !== source) return;
      eased = true;
      this.easeTo({ center: [lng!, lat!], zoom });
    };
    try {
      const pending = source.getClusterExpansionZoom(clusterId, (error, zoom) => {
        if (!error) ease(zoom);
      });
      if (pending && typeof (pending as Promise<number>).then === 'function') {
        (pending as Promise<number>).then(ease, () => undefined);
      }
    } catch {
      // A cluster that disappeared between the hit test and the lookup is not an error to surface.
    }
  }

  /** Supersedes an earlier cluster zoom still waiting for its expansion zoom. */
  private clusterZoomToken = 0;

  /** Pushes `cameraPadding` into the engine when it differs from what the engine already has. */
  private applyCameraPadding(): void {
    const map = this._map;
    if (!map || typeof map.setPadding !== 'function') return;
    const next = normalizeFitPadding(this.cameraPadding);
    const current = this.appliedPadding;
    if (
      next.top === current.top && next.right === current.right &&
      next.bottom === current.bottom && next.left === current.left
    ) return;
    this.appliedPadding = next;
    this.writeCamera(() => {
      try {
        map.setPadding?.({ ...next });
      } catch {
        // A peer that rejects padding keeps its previous one; fits then simply ignore it.
      }
    });
  }

  /** The visible box inside the applied `cameraPadding`, or `undefined` when it cannot be read. */
  private readVisibleBounds(map: MapLibreMapCapability): LyraMapBounds | undefined {
    try {
      const { top, right, bottom, left } = this.appliedPadding;
      const container = this.containerEl;
      let west: number;
      let south: number;
      let east: number;
      let north: number;
      const width = container?.clientWidth ?? 0;
      const height = container?.clientHeight ?? 0;
      if (
        (top || right || bottom || left) && typeof map.unproject === 'function' &&
        width - right > left && height - bottom > top
      ) {
        const corners = [
          [left, top], [width - right, top], [width - right, height - bottom], [left, height - bottom],
        ] as const;
        west = south = Infinity;
        east = north = -Infinity;
        for (const [x, y] of corners) {
          const { lng, lat } = map.unproject([x, y]);
          west = Math.min(west, lng);
          east = Math.max(east, lng);
          south = Math.min(south, lat);
          north = Math.max(north, lat);
        }
      } else {
        const box = map.getBounds?.();
        if (!box) return undefined;
        west = box.getWest();
        south = box.getSouth();
        east = box.getEast();
        north = box.getNorth();
      }
      if (![west, south, east, north].every(isFiniteCoordinate)) return undefined;
      // `west` into [-180, 180], keeping the span, so `fitBounds()` takes the box back.
      const span = east - west;
      if (span >= 360) {
        west = -180;
        east = 180;
      } else {
        west = wrapLongitude(west);
        east = west + span;
      }
      return Object.freeze([
        Object.freeze([west, finiteRange(south, 0, -90, 90)] as const),
        Object.freeze([east, finiteRange(north, 0, -90, 90)] as const),
      ] as const);
    } catch {
      return undefined;
    }
  }

  /** Queues a `lr-map-move` for the next animation frame, unless one is already queued. */
  private scheduleMoveReport(map: MapLibreMapCapability): void {
    if (this.moveFrame !== undefined) return;
    const view = ownerWindow(this);
    if (!view || typeof view.requestAnimationFrame !== 'function') {
      this.reportMove(map);
      return;
    }
    this.moveFrame = view.requestAnimationFrame(() => {
      this.moveFrame = undefined;
      this.reportMove(map);
    });
  }

  /** Reports a queued move now: the camera has stopped, and its last position must not wait. */
  private flushMoveReport(map: MapLibreMapCapability): void {
    if (this.moveFrame === undefined) return;
    this.cancelMoveReport();
    this.reportMove(map);
  }

  private cancelMoveReport(): void {
    if (this.moveFrame === undefined) return;
    ownerWindow(this)?.cancelAnimationFrame?.(this.moveFrame);
    this.moveFrame = undefined;
  }

  private reportMove(map: MapLibreMapCapability): void {
    if (this._map !== map) return;
    this.syncAnchor();
    const camera = readPeerCamera(map);
    if (!camera) return;
    const bounds = this.readVisibleBounds(map);
    this.emit('lr-map-move', bounds ? { ...camera, bounds } : { ...camera });
  }

  private applyFit(map: MapLibreMapCapability, fit: MapFitRequest, animate: boolean): boolean {
    if (typeof map.fitBounds !== 'function') return false;
    const [[west, south], [east, north]] = fit.bounds;
    // Limits apply when the fit runs: a queued fit honours limits assigned after it was requested.
    const [minZoom, maxZoom] = this.zoomLimits;
    const fitMaxZoom = fit.maxZoom !== undefined ? finiteRange(fit.maxZoom, maxZoom, minZoom, maxZoom)
      : this.zoomLimitsRequested ? maxZoom : undefined;
    this.readiness.invalidate();
    try {
      map.fitBounds(
        [
          [west, south],
          [east, north],
        ],
        {
          padding: { ...fit.padding },
          ...(fitMaxZoom === undefined ? {} : { maxZoom: fitMaxZoom }),
          animate,
        },
        { [FIT_EVENT_KEY]: this.fitToken },
      );
    } catch {
      return false;
    }
    return true;
  }

  private applyPendingFit(): void {
    const map = this._map;
    const pending = this.pendingFit;
    if (!map || !pending) return;
    this.pendingFit = undefined;
    // A camera assigned a different value after the call is the newer intent. Compared by value, so
    // an equal array rebuilt by a re-render does not count as one.
    if (!sameCenterValue(this.center, pending.center) || !Object.is(this.zoom, pending.zoom)) return;
    this.applyFit(map, pending.fit, false);
  }

  /** Writes the peer's settled camera into `center`/`zoom`, then reports it. */
  private reflectCamera(map: MapLibreMapCapability, source: LyraMapViewChangeSource): void {
    const camera = readPeerCamera(map);
    if (!camera) return;
    const center = Object.freeze(camera.center);
    const { zoom } = camera;
    this.reflectedCamera = { center, zoom };
    // Past the collection boundary, so a host re-committing its own array stays a no-op.
    const previousCenter = this._center;
    this.reflectingCamera = true;
    try {
      this._center = center;
      this.requestUpdate('center', previousCenter);
      this.zoom = zoom;
    } finally {
      this.reflectingCamera = false;
    }
    const bounds = this.readVisibleBounds(map);
    this.emit('lr-map-view-change', bounds ? { center, zoom, source, bounds } : { center, zoom, source });
  }

  /**
   * Pushes assigned `center`/`zoom` into the peer.
   *
   * An axis the peer already shows is skipped: both the camera just read back into `center`/`zoom`
   * and a host echoing a reported camera, however late, would otherwise push a redundant jump, and
   * a jump stops any animation or gesture in flight. A push that does interrupt a movement applies
   * the whole declared camera, because the interrupted movement would otherwise leave the axis that
   * was not assigned wherever it stopped. With nothing in flight, only the assigned axis moves.
   */
  private pushCamera(changed: PropertyValues): void {
    const reflected = this.reflectedCamera;
    this.reflectedCamera = undefined;
    const map = this._map;
    if (!map || (!changed.has('center') && !changed.has('zoom'))) return;
    const center = this.safeCenter;
    const zoom = this.safeZoom;
    const shown = readPeerCamera(map);
    const showsCenter = (camera: MapCamera | undefined): boolean =>
      camera !== undefined && center[0] === camera.center[0] && center[1] === camera.center[1];
    let pushCenter = changed.has('center') && !showsCenter(reflected) && !showsCenter(shown);
    let pushZoom = changed.has('zoom') && zoom !== reflected?.zoom && zoom !== shown?.zoom;
    if (!pushCenter && !pushZoom) return;
    let interrupting = false;
    try {
      interrupting = map.isMoving?.() === true;
    } catch {
      // A peer that cannot say is treated as idle: only the assigned axis moves, as before.
    }
    if (interrupting) {
      pushCenter = !showsCenter(shown);
      pushZoom = zoom !== shown?.zoom;
    }
    this.writeCamera(() => {
      if (pushCenter) map.setCenter(center);
      if (pushZoom) map.setZoom(zoom);
    });
  }

  /** Runs a camera move this element makes on its own behalf, which it never reports. */
  private writeCamera(write: () => void): void {
    const previous = this.writingCamera;
    this.readiness.invalidate();
    this.writingCamera = true;
    try {
      write();
    } finally {
      this.writingCamera = previous;
    }
  }

  override connectedCallback(): void {
    super.connectedCallback();
    const generation = ++this._connectGeneration;
    this.readiness.reset();
    this.hashRuntimeFailed = false;
    this.syncHash();
    this.visible = false;
    this.constructionScheduler?.disconnect();
    const scheduler = createMapConstructionScheduler(this, () => {
      if (!this.isConnected || this._connectGeneration !== generation || this.constructionScheduler !== scheduler) return;
      this.visible = true;
      const activator = this.shadowRoot?.activeElement?.matches?.('[part="initialization-activate"]') === true;
      this.tryConstructMap();
      // The activation button is about to disappear; hand its focus to the map region it started.
      if (activator && this._map) { try { this._map.getCanvas()?.focus?.({ preventScroll: true }); } catch { /* Focus stays put. */ } }
      this.scheduleAfterUpdate(() => {
        if (this.isConnected && this._connectGeneration === generation && this.constructionScheduler === scheduler) this.requestUpdate();
      }, `map-construction-${generation}`);
    });
    this.constructionScheduler = scheduler;
    this.constructionMode = this.initializationMode;
    this.constructionDelay = this.safeInitializationDelay;
    scheduler.connect(this.constructionMode, this.constructionDelay);
    // A reconnect is a new, owner-realm initialization transaction.
    this.failure = undefined;
    this.loading = true;
    this._webglReady = false;
    void (async () => {
      let mod: Awaited<ReturnType<typeof loadMaplibre>>;
      try {
        mod = await this.loadLibrary(this.engine);
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
      this.constructionScheduler?.setReady(true);
    })();
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.hashOwner?.dispose();
    this.disposeMap();
    this.constructionScheduler?.disconnect();
    this.constructionScheduler = undefined;
    for (const marker of this._markerInstances.values()) {
      const markerElement = marker.getElement?.();
      if (markerElement) this.markerActivationDetails.delete(markerElement);
      marker.remove();
    }
    this._markerInstances.clear();
    this._markerColors.clear();
    this._markerLabels.clear();
    this._markerPopupIds.clear();
    this._markerSources.clear();
  }

  private failureMessage(reason: MapFailureReason = this.failure ?? 'initialization-failed'): string {
    switch (reason) {
      case 'missing-peer': return this.localize('mapMissingLibrary', undefined, {
        package: this.engine === 'maplibre' ? 'maplibre-gl' : '@aceshooting/lyra-map',
      });
      case 'style-required': return this.localize('mapStyleRequired');
      case 'webgl-unavailable': return this.localize('mapWebglUnavailable');
      case 'initialization-failed': return this.localize('mapInitializationFailed');
    }
  }

  private failInitialization(reason: MapFailureReason, partialMap?: MapLibreMapCapability): void {
    const connection = this._connectGeneration, generation = this._styleGeneration, style = this.mapStyle;
    this.readiness.fail();
    try {
      if (partialMap) this.peerEvents.clear(partialMap);
      partialMap?.remove();
    } catch {
      // A partially-created peer instance may not have completed enough setup to remove cleanly.
    }
    this.disposeMap(false);
    const publish = (): void => {
      if (!this.isConnected || this._connectGeneration !== connection || this._styleGeneration !== generation || this.mapStyle !== style || this._map) return;
      this.loading = false;
      this.failure = reason;
      this.announcements.announceAssertive(this.failureMessage(reason));
    };
    if (this.mapUpdateActive) this.scheduleAfterUpdate(publish, `map-initialization-failure-${connection}-${generation}`);
    else publish();
  }

  private scheduleStyleRequiredFailure(): void {
    const generation = this._connectGeneration;
    const module = this._maplibreModule;
    this.scheduleAfterUpdate(() => {
      if (!this.isConnected || generation !== this._connectGeneration || module !== this._maplibreModule || hasMapStyle(this.mapStyle)) return;
      this.failInitialization('style-required');
    }, 'map-style-required');
  }

  private disposeMap(cancelReadiness = true): void {
    this.cancelImageExport();
    this.pendingExportIssue = false;
    if (!this.isConnected) this.exportIssue = false;
    else this.publishExportIssue(false);
    this.cancelMapDrawing('disconnect');
    this.drawingController?.cancelResources();
    if (cancelReadiness) this.readiness.cancel();
    this.cancelFeaturePreparation();
    this.pointerCleanup?.(); this.pointerCleanup = undefined;
    this.interactionObserver?.disconnect(); this.interactionObserver = undefined;
    this.mapCursor.clear(); this.hovered = undefined; this.endPointerReports(false);
    this.featureStates?.dispose(); this.featureStates = undefined; this.stateRouter.configure([]);
    if (this.featureStateLoad === 'failed') this.featureStateLoad = undefined;
    this.stateRequested = false; this.stateRoutes = []; this.interactions = []; this.sourceIdentities.clear(); this.featureStateIssue = false;
    this.preparedFeatureSignature = undefined;
    this.pendingMapLoad = false;
    this.mapLoadEmitted = false;
    this.rebuildGeneratedLayers = false;
    this.stopObservingMapAllocation();
    this.stopObservingPeerChrome();
    this.optionalFeatureWorkStarted = false;
    this.controlLifecycle?.dispose();
    this.controlPeer = undefined;
    if (this._map) this.peerEvents.clear(this._map);
    try {
      this._map?.remove();
    } catch {
      // Teardown is best-effort for a peer instance that failed partway through initialization.
    }
    this._map = undefined;
    this.drawingController?.disposeResources();
    this.ownedFeatures?.dispose();
    this.externalFeatures?.dispose();
    this.externalSourceEffects?.dispose(); this.externalSourceEffects = undefined;
    this.externalFeatureWorkStarted = false;
    this.externalSourceIds.clear();
    this.plannedDataLayerIds.clear(); this.appliedRowRanges.clear(); this.dataLayerIssue = false; this.pendingDataLayerIssue = false; this.groupOrderActive = false; this.pendingDrawingTheme = false;
    this.setControlIssue(undefined);
    this.anchorController?.dispose();
    this.cancelMoveReport();
    this.appliedPadding = ZERO_CAMERA_PADDING;
    this._styleLoaded = false;
    this._styleLayers = EMPTY_STYLE_LAYERS; this._styleSources = EMPTY_STYLE_SOURCES;
    this.boxZoomSettling = false;
    this.reflectedCamera = undefined;
    this._appliedChoroplethSourceId = undefined;
    this._appliedFillLayerId = undefined;
    this.appliedChoroplethPaintKey = undefined;
    this._appliedDataLayerIds.clear();
    this._appliedDataLayerShapes.clear();
    this.appliedLayerPaintKeys.clear();
    this.appliedPointIcons.clear();
    this.appliedPointPaint.clear();
    this.appliedGeoLabels.clear();
    this.appliedPointMuting.clear();
    this._appliedGeoJson.clear();
  }

  override adoptedCallback(): void {
    super.adoptedCallback();
    this.hostDescription.adopted();
    this.stopObservingMapAllocation();
    this.stopObservingPeerChrome();
    this.announcements.adopted();
    if (this._map && this.containerEl && this.isConnected) {
      this.observeMapAllocation(this._map, this.containerEl);
    }
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
    if (this.mapUpdateActive) {
      const connection = this._connectGeneration;
      this.scheduleAfterUpdate(() => {
        if (this.isConnected && this._connectGeneration === connection) this.tryConstructMap();
      }, `map-construct-${connection}`);
      return;
    }
    if (
      this._map ||
      !this._maplibreModule ||
      !this._webglReady ||
      !this.containerEl ||
      !this.visible ||
      !this.isConnected
    ) return;
    if (!hasMapStyle(this.mapStyle)) {
      this.scheduleStyleRequiredFailure();
      return;
    }
    // supportsWebGL2() is already checked before `this._maplibreModule` is ever set (see the
    // connectedCallback() load path above) -- reaching here with a set _maplibreModule means it
    // already passed. maplibre-gl doesn't fail construction cleanly when WebGL2 is unavailable
    // (it fires a GPUInitializationError internally and still returns a Map instance with no
    // `painter`, which would crash disconnectedCallback()'s `this._map.remove()`), so this must
    // stay a precondition rather than a try/catch around the constructor below.
    const mod = this._maplibreModule;
    const authoredCenter = this.center, authoredZoom = this.zoom, option = this.hashOption;
    this.syncHash();
    // A requested URL field is read before construction, so wait for its ownership runtime.
    if (!this.hashOwner && this.hashRequested() && !this.hashRuntimeFailed) return;
    const initialHash = this.hashOwner?.read() ?? { status: 'disabled' as const };
    const hashCamera: MapHashCamera | undefined = initialHash.status === 'camera' ? initialHash.camera : undefined;
    let candidate: MapLibreMapCapability | undefined;
    try {
      candidate = new mod.Map({
        container: this.containerEl,
        style: this.mapStyle as never,
        center: hashCamera ? [...hashCamera.center] : this.safeCenter,
        zoom: hashCamera ? finiteRange(hashCamera.zoom, this.safeZoom, ...this.zoomLimits) : this.safeZoom,
        ...(this.zoomLimitsRequested ? { minZoom: this.zoomLimits[0], maxZoom: this.zoomLimits[1] } : {}),
        ...(hashCamera ? { bearing: hashCamera.bearing, pitch: hashCamera.pitch } : {}),
        attributionControl: false,
        ...(typeof this.renderWorldCopies === 'boolean'
          ? { renderWorldCopies: this.renderWorldCopies }
          : {}),
        locale: {
          'Map.Title': this.effectiveMapLabel,
          'Marker.Title': this.localize('mapMarker'),
          'Popup.Close': this.localize('close'),
          'AttributionControl.ToggleAttribution': this.localize('mapToggleAttribution'),
          'AttributionControl.MapFeedback': this.localize('mapFeedback'),
          'NavigationControl.ZoomIn': this.localize('zoomIn'),
          'NavigationControl.ZoomOut': this.localize('zoomOut'),
          'NavigationControl.ResetBearing': this.localize('mapResetNorth'),
          ...this.controlLocale(),
        },
      });
      // Install every component-owned handler before publishing the instance. A constructor or
      // setup failure therefore leaves no half-live map reachable through the public getter.
      this.peerEvents.subscribe(candidate, 'error', event => {
        if (this._map !== candidate) return;
        if (!this._styleLoaded) { this.failInitialization('initialization-failed'); return; }
        console.error('lr-map:', event?.error ?? event);
      });
      this.peerEvents.subscribe(candidate, 'load', () => {
        if (this._map !== candidate || this.mapLoadEmitted) return;
        this.pendingMapLoad = true;
        this.flushMapLoad(candidate);
        void this.readiness.whenStyleReady().then(() => {
          this.flushMapLoad(candidate);
        }, () => undefined);
      });
      this.peerEvents.subscribe(candidate, 'click', event => { if (this._map === candidate) this.handleMapInteraction('click', event); });
      this.peerEvents.subscribe(candidate, 'contextmenu', event => { if (this._map === candidate) this.handleMapInteraction('contextmenu', event); });
      this.peerEvents.subscribe(candidate, 'mousemove', event => {
        if (this._map !== candidate) return;
        this.schedulePointerReport(candidate!, event);
        this.drawingController?.preview(mapCoordinates(mapOwnValue(event, 'lngLat')));
        this.handleMapInteraction('mousemove', event);
      });
      this.peerEvents.subscribe(candidate, 'mouseout', () => {
        if (this._map === candidate) { this.clearMapHover(); this.endPointerReports(); this.drawingController?.preview(undefined); }
      });
      this.peerEvents.subscribe(candidate, 'movestart', (event: Readonly<Record<string, unknown>> | undefined) => {
        if (this._map === candidate && event?.['originalEvent']) this.clusterZoomToken += 1;
      });
      this.peerEvents.subscribe(candidate, 'boxzoomstart', () => {
        if (this._map === candidate) this.clusterZoomToken += 1;
      });
      this.peerEvents.subscribe(candidate, 'boxzoomend', () => {
        if (this._map === candidate) this.boxZoomSettling = true;
      });
      this.peerEvents.subscribe(candidate, 'move', () => {
        if (this._map === candidate) { this.anchorController?.stop(); this.scheduleMoveReport(candidate!); this.drawingController?.scheduleHandles(); }
      });
      this.peerEvents.subscribe(candidate, 'moveend', (event) => {
        if (this._map !== candidate) return;
        this.flushMoveReport(candidate!);
        this.writeHash(candidate!);
        if (this._map !== candidate) return;
        // The peer merges a fit's event data into its movement events, and attaches the DOM event
        // behind every gesture-driven move (including its own navigation buttons). The one gesture
        // it does not tag is a box zoom: `boxzoomend` carries the mouseup, then the peer animates
        // with no event data, so the next untagged `moveend` is that animation settling or being
        // stopped. Anything else -- this element's own `center`/`zoom` push, a resize, a move made
        // directly through `map` -- is not a camera change this element reports.
        const fit = event?.[FIT_EVENT_KEY] === this.fitToken;
        const command = event?.[COMMAND_EVENT_KEY] === this.commandToken;
        const afterBoxZoom = !fit && !command && this.boxZoomSettling;
        if (!fit && !command) this.boxZoomSettling = false;
        if (this.writingCamera) return;
        const source: LyraMapViewChangeSource | undefined =
          fit ? 'fit' : command ? 'command' : event?.['originalEvent'] || afterBoxZoom ? 'user' : undefined;
        if (source) this.reflectCamera(candidate!, source);
      });
      const canvas = candidate.getCanvas?.() as HTMLCanvasElement | undefined;
      if (canvas) notifyMapCanvasReady(this, canvas);
      this._map = candidate;
      if (canvas) this.observeMapInteractions(canvas);
      this.beginStyleReadiness(candidate, true);
      if (!this.isConnected || this._map !== candidate) return;
      this.syncMapSemantics();
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
    if (!this.isConnected || this._map !== candidate) return;
    if (hashCamera) {
      this.pendingFit = undefined;
      // Retain the constrained initial camera immediately, then publish after the current update.
      // A newer authored camera wins; construction does not synthesize a view-change event.
      const connection = this._connectGeneration;
      const shown = readPeerCamera(this._map!);
      if (!this.isConnected || this._map !== candidate || this._connectGeneration !== connection) return;
      if (shown && this.hashOption === option && this.center === authoredCenter && this.zoom === authoredZoom) {
        this.reflectedCamera = { center: shown.center, zoom: shown.zoom };
        this.scheduleAfterUpdate(() => {
          if (!this.isConnected || this._map !== candidate || this._connectGeneration !== connection ||
            this.hashOption !== option || this.center !== authoredCenter || this.zoom !== authoredZoom) return;
          this.reflectingCamera = true;
          try { this.center = shown.center; this.zoom = shown.zoom; }
          finally { this.reflectingCamera = false; }
        }, `map-initial-hash-${connection}`);
      }
    }
    this.applyCameraPadding();
    this.syncControls();
    this.syncAnchor();
    this.syncImageProvider();
    // Deferred rather than applied here: this can run inside `updated()`, and the fit settles
    // synchronously, writing `center`/`zoom` -- a property write the update cycle must not see.
    const initialized = this._map;
    if (this.pendingFit) this.scheduleAfterUpdate(() => {
      if (this._map !== initialized) return;
      this.applyPendingFit(); if (initialized) this.writeHash(initialized);
    }, 'map-pending-fit');
    else if (this.pendingCommand) this.scheduleAfterUpdate(() => {
      if (this._map !== initialized) return;
      this.applyPendingCommand(); if (initialized) this.writeHash(initialized);
    }, 'map-pending-command');
    else if (initialized) this.writeHash(initialized);
  }

  private flushMapLoad(map: MapLibreMapCapability | undefined = this._map): void {
    if (!map || this._map !== map || !this.isConnected || !this.pendingMapLoad ||
      !this._styleLoaded || this.preparingFeatures || this.isUpdatePending) return;
    this.pendingMapLoad = false;
    this.mapLoadEmitted = true;
    this.emit('lr-map-load');
  }

  /** Bind readiness to this exact style before its mutation can synchronously emit events. */
  private beginStyleReadiness(map: MapLibreMapCapability, initial: boolean, mutate?: () => void): void {
    const connection = this._connectGeneration;
    const styleGeneration = this._styleGeneration;
    const style = this.mapStyle;
    const current = (): boolean => this.isConnected && this._map === map &&
      connection === this._connectGeneration && styleGeneration === this._styleGeneration && style === this.mapStyle;
    let started = false;
    const startRestoration = (): void => {
      if (started || !current()) return;
      started = true;
      this._styleLoaded = true;
      this.captureStyleCatalog(map);
      this._appliedChoroplethSourceId = undefined;
      this._appliedFillLayerId = undefined;
      this.appliedChoroplethPaintKey = undefined;
      this._appliedDataLayerIds.clear();
      this.plannedDataLayerIds.clear();
      this.appliedRowRanges.clear();
      this._appliedDataLayerShapes.clear();
      this.appliedLayerPaintKeys.clear();
      this.appliedPointPaint.clear();
      this.appliedGeoLabels.clear();
      this.appliedPointMuting.clear();
      this._appliedGeoJson.clear();
      this.rebuildGeneratedLayers = true;
      if (initial) this.applyMarkers();
      void this.reconcileGeneratedLayers();
      // An anchor requested before the style loaded is placed once its point can be projected.
      if (this.anchorLngLat) this.scheduleAnchorSync();
    };
    this.readiness.bind({
      subscribe: (event, listener) => {
        const types = event === 'style-ready' ? ['load', 'style.load'] as const
          : event === 'busy' ? ['movestart', 'move', 'dataloading'] as const : [event] as const;
        let active = true;
        const removers: (() => void)[] = [];
        const dispose = (): void => {
          active = false;
          for (const remove of removers) { try { remove(); } catch { /* Release remaining listeners. */ } }
        };
        try {
          for (const type of types) removers.push(this.peerEvents.subscribe(map, type, () => {
            if (!active || !current()) return;
            try {
              if (event === 'style-ready') startRestoration();
              if (active && current()) listener();
            } catch { if (current()) this.readiness.fail(); }
          }));
        } catch (error) { dispose(); throw error; }
        return dispose;
      },
      mutate: initial ? mutate : () => { this.peerEvents.rotate(map); if (current()) mutate?.(); },
      isStyleReady: () => {
        const ready = typeof map.isStyleLoaded === 'function' ? map.isStyleLoaded() === true
          : typeof map.loaded === 'function' && map.loaded() === true;
        if (ready) startRestoration();
        return ready;
      },
      isIdle: () => {
        if (typeof map.isMoving === 'function' && map.isMoving()) return false;
        return typeof map.loaded === 'function' ? map.loaded() === true : undefined;
      },
      ownerPending: () => this.isUpdatePending || this.preparingFeatures || this.drawingPending || this.featureLoads > 0 || !current(),
      restore: async signal => {
        if (!current() || signal.aborted) return;
        startRestoration();
        let work = this.featureWork, drawingWork = this.drawingWork;
        // A same-style property update may supersede preparation while the old peer promise is
        // pending. Cancellation releases that wait, and restoration follows the newest work.
        for (;;) {
          await Promise.all([work, drawingWork]);
          if (!current() || signal.aborted) return;
          if (this.isUpdatePending) {
            await this.updateComplete;
            if (!current() || signal.aborted) return;
          }
          if (work === this.featureWork && drawingWork === this.drawingWork) return;
          work = this.featureWork; drawingWork = this.drawingWork;
        }
      },
      onStyleReady: generation => { this.emit('lr-map-style-load', { generation } satisfies LyraMapReadinessDetail); },
      onIdle: generation => { this.emit('lr-map-idle', { generation } satisfies LyraMapReadinessDetail); },
      onError: styleWasReady => {
        // A late tile/network failure rejects idle waits without destroying an already rendered
        // map. A new style or reconnect starts a fresh readiness transaction.
        if (styleWasReady || (this._styleLoaded && !this.preparingFeatures && this.mapLoadEmitted)) return;
        this.scheduleAfterUpdate(() => {
          if (current()) this.failInitialization('initialization-failed');
        }, `map-readiness-failure-${styleGeneration}`);
      },
    });
  }

  override requestUpdate(...args: Parameters<LyraElement['requestUpdate']>): void {
    if (args[0] === undefined) this.geoJsonRefreshRequested = true;
    if (args[0] === 'zoom' && !this.reflectingCamera) this.zoomLimitRevision = (this.zoomLimitRevision ?? 0) + 1;
    super.requestUpdate(...args);
    const valueChanged = args[0] === undefined || !Object.is(args[1], Reflect.get(this, args[0]));
    if (valueChanged && (args[0] === undefined || ['mapStyle', 'dataLayers', 'choropleth', 'overlays', 'images', 'styleOverrides', 'interactiveBasemapLayers'].includes(String(args[0])))) {
      this.drawingConfigRevision = (this.drawingConfigRevision ?? 0) + 1;
    }
    if (valueChanged && (args[0] === undefined || ['anchorLngLat', 'anchorBoundary', 'anchorSafeArea', 'anchorClosable', 'mapStyle', 'dir'].includes(String(args[0])))) {
      this.anchorSyncRequested = true;
      // A new coordinate retries an anchor runtime whose import failed.
      if (args[0] === 'anchorLngLat' && this.anchorLoad === 'failed') this.anchorLoad = undefined;
      const anchor = this.anchorController;
      if (anchor && !anchor.closing && (args[0] === 'mapStyle' || args[0] === 'anchorLngLat' && !this.anchorLngLat)) anchor.hide(true, true);
      else anchor?.stop();
    }
    const drawing = this.drawingController?.active === true;
    if (valueChanged && !this.drawingResetting && args[0] === 'drawMode' && (drawing || args[1] === 'line' || args[1] === 'polygon')) this.cancelMapDrawing('mode-change', true, args[1] === 'polygon' ? 'polygon' : 'line');
    // Arming again retries a drawing runtime whose import failed.
    if (valueChanged && args[0] === 'drawMode' && this.drawingLoad === 'failed') this.drawingLoad = undefined;
    if (valueChanged && args[0] === 'pickMode' && this.pickMode && (drawing || this.drawMode === 'line' || this.drawMode === 'polygon')) this.cancelMapDrawing('pick-mode');
    if (valueChanged && this.isUpdatePending && (args[0] === undefined || ['mapStyle', 'dataLayers', 'choropleth', 'overlays', 'images', 'styleOverrides', 'interactiveBasemapLayers'].includes(String(args[0])))) {
      this.interactionGeneration = (this.interactionGeneration ?? 0) + 1;
      this.featureStates?.cancel();
    }
    if (valueChanged && this.readiness && this.isConnected && this.isUpdatePending) {
      if (args[0] === 'mapStyle' && !Object.is(args[1], this.mapStyle)) this.readiness.reset();
      else if (args[0] === undefined || ['center', 'zoom', 'minZoom', 'maxZoom', 'cameraPadding', 'maxBounds', 'dataLayers',
        'choropleth', 'markers', 'hiddenCategories', 'overlays', 'images', 'styleOverrides', 'interactiveBasemapLayers'].includes(String(args[0]))) this.readiness.invalidate();
    }
    if ((args[0] === 'center' || args[0] === 'zoom') && this.isUpdatePending && !this.reflectingCamera) {
      this.clusterZoomToken += 1;
      this.cameraUpdatePending = true;
    }
    // A no-op property write schedules nothing and must not mark the semantics stale.
    if (this.isUpdatePending && (args[0] === undefined || ['label', 'lang', 'locale', 'strings', 'markers',
      'legend', 'legendGradient', 'hasLegendSlot', 'hasLegendStartSlot', 'choropleth', 'choroplethLegend'].includes(String(args[0])))) this.semanticsStale = true;
    if (this.isUpdatePending && (args[0] === undefined || ['label', 'lang', 'locale', 'strings', 'markers'].includes(String(args[0])))) this.markerSemanticsStale = true;
  }

  private mapUpdateActive = false;

  protected override performUpdate(): void {
    this.mapUpdateActive = true;
    try { super.performUpdate(); } finally { this.mapUpdateActive = false; }
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    this.cameraUpdatePending = false;
    this.setAttribute('aria-busy', String(this.loading || (!this._map && !this.failure && !this.awaitingActivation)));
    if (this.legendCollapsed && (changed.has('legendOpen') || changed.has('legendCollapsible'))) {
      // Reset before the sticky material measures the collapsed viewport. WebKit can otherwise
      // retain the previous offset as scrollable overflow even after the legend rows disappear.
      const legend = this.shadowRoot?.querySelector<HTMLElement>('[part="legend"]');
      if (legend) legend.scrollTop = 0;
    }
    if (changed.has('choropleth') || changed.has('legendGradient')) {
      this.warnOnLegendChoroplethMismatch();
    }

    // Became visible after the maplibre-gl module had already loaded (the
    // reverse order — module loads first, visibility follows — is the
    // common case and is instead handled at the end of the
    // `loadMaplibre().then()` chain in connectedCallback() above).
    if (changed.has('mapStyle')) {
      this.cancelImageExport();
      this.drawingController?.styleChanging();
      this.drawingController?.cancelResources(true);
      this._styleGeneration += 1;
      this.cancelFeaturePreparation();
      this.preparedFeatureSignature = undefined;
      // A new style retries a feature-state runtime whose import failed.
      if (this.featureStateLoad === 'failed') this.featureStateLoad = undefined;
    }

    // Provider configuration replaces its image reservation; finish it before resource work
    // reserves the same atlas, including when both first load the ownership runtime.
    if (changed.has('imageProvider') && this._map) this.syncImageProvider();

    if (changed.has('mapStyle') && !hasMapStyle(this.mapStyle) && this._maplibreModule) {
      this.scheduleStyleRequiredFailure();
    } else if (changed.has('mapStyle') && !this._map && this._maplibreModule && hasMapStyle(this.mapStyle)) {
      this.tryConstructMap();
    } else if (changed.has('mapStyle') && this._map) {
      this._styleLoaded = false;
      this._styleLayers = EMPTY_STYLE_LAYERS; this._styleSources = EMPTY_STYLE_SOURCES;
      const map = this._map;
      this.beginStyleReadiness(map, false, () => {
        for (const sourceId of this.appliedPointIcons.keys()) this.removePointIcons(sourceId);
        map.setStyle(this.mapStyle as never);
      });
    } else if (this._styleLoaded && (this.refreshingGeoJson || changed.has('dataLayers') || changed.has('choropleth') ||
      changed.has('overlays') || changed.has('images') || changed.has('styleOverrides') || changed.has('interactiveBasemapLayers') ||
      (changed.has('imageProvider') && this.preparingFeatures))) {
      void this.reconcileGeneratedLayers();
    }
    const constructionMode = this.initializationMode, constructionDelay = this.safeInitializationDelay;
    if ((changed.has('initialization') || changed.has('initializationDelay')) &&
      (constructionMode !== this.constructionMode || (constructionMode === 'interaction' && constructionDelay !== this.constructionDelay))) {
      this.constructionMode = constructionMode; this.constructionDelay = constructionDelay;
      this.constructionScheduler?.reconfigure(constructionMode, constructionDelay);
    }
    this.constructionScheduler?.setReady(!!this.containerEl && this._webglReady && !!this._maplibreModule && hasMapStyle(this.mapStyle));
    if (changed.has('hiddenCategories') && this._map && this._styleLoaded) this.refreshThemePaint();
    if (changed.has('cameraPadding') && this._map) this.applyCameraPadding();
    this.pushCamera(changed);
    if (changed.has('maxBounds') && this._map) this.writeCamera(() => this.applyMaxBounds());
    if ((changed.has('minZoom') || changed.has('maxZoom')) && this._map) this.applyZoomLimits();
    if (changed.has('controls') && this._map) this.syncControls();
    if (changed.has('drawingMeasurements')) this.drawingController?.scheduleHandles();
    if (changed.has('pickMode') || changed.has('interactionBlocked')) { this.clearMapHover(); this.syncMapCursor(); }
    if (changed.has('hash') || changed.has('hashFormat')) { this.syncHash(); this.applyHash(); }
    if (this._map && (this.anchorSyncRequested || ['anchorLngLat', 'anchorBoundary', 'anchorSafeArea', 'anchorClosable', 'dir', 'strings', 'lang', 'locale'].some(name => changed.has(name)))) { this.anchorSyncRequested = false; this.syncAnchor(); }
    if (changed.has('markers') && this._map) this.applyMarkers();
    if (this.semanticsStale) {
      this.semanticsStale = false;
      this.syncMapSemantics(this.markerSemanticsStale);
      this.markerSemanticsStale = false;
    }
    this.drawingConfigApplied = this.drawingConfigApplying;
    this.syncDrawing();
    this.readiness.check();
    const map = this._map;
    if (this.pendingMapLoad) queueMicrotask(() => { this.flushMapLoad(map); });
  }

  protected override willUpdate(changed: PropertyValues): void {
    this.drawingConfigApplying = this.drawingConfigRevision;
    super.willUpdate(changed);
    this.refreshingGeoJson = this.geoJsonRefreshRequested;
    this.geoJsonRefreshRequested = false;
    if (this.refreshingGeoJson) {
      const choropleth = this.canonicalChoropleth;
      if (choropleth) this._canonicalChoropleth = {
        ...choropleth, geojsonProjection: projectAdmittedGeoJson(choropleth.geojson, true),
      };
      this._canonicalDataLayers = this.canonicalDataLayers.map(layer => ({
        ...layer, geojsonProjection: projectAdmittedGeoJson(layer.geojson, true),
      }));
    }
    if (changed.has('legendGradient') || changed.has('dataLayers')) {
      this.legendIsLine = this.legendDescribesLine();
    }
    this.derivedLegend = this.choroplethLegend && this.canonicalChoropleth
      ? buildDerivedChoroplethLegend(
          this.canonicalChoropleth,
          (value) => this.formatCount(value),
          this.localize('noData'),
        )
      : EMPTY_DERIVED_LEGEND;
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
        this.announcements.announceAssertive(this.failureMessage('webgl-unavailable'));
      }
    }
  }

  private paintThemeKey?: string;
  private paintThemeSources?: readonly unknown[];
  private paintThemeTokens: string[] = [];
  private syncPaintTheme(): boolean {
    // The ownership runtime is part of the key: override tokens are discovered once it can admit them.
    const sources = [this.dataLayers, this.choropleth, this.styleOverrides, this.overlays, loadMapOwnedFeatureRuntime.loaded];
    if (!this.paintThemeSources || sources.some((source, index) => source !== this.paintThemeSources![index])) {
      this.paintThemeSources = sources;
      const tokens = new Set([...Object.values(TONE_TOKEN), ...Object.values(ON_TONE_TOKEN),
        '--lr-map-choropleth-fill-opacity', '--lr-map-hidden-category-opacity', DRAWING_COLOR_TOKEN]);
      const inputs = JSON.stringify([this.canonicalDataLayers.map(({geojson: _geojson, geojsonProjection: _projection, ...paint}) => paint),
        [this.canonicalChoropleth?.stops, this.canonicalChoropleth?.stepBaseColor, this.canonicalChoropleth?.noData],
        loadMapOwnedFeatureRuntime.loaded?.projectMapStyleOverrides(this.styleOverrides),
        this._canonicalExternalLayers.map(({ source: _source, ...paint }) => paint)]);
      const overlayPaint = loadMapOwnedFeatureRuntime.loaded?.overlayPaintText(this.overlays) ?? '';
      for (const match of overlayPaint.matchAll(/var\(\s*(--[\w-]+)/g)) tokens.add(match[1]!);
      for (const match of inputs.matchAll(/var\(\s*(--[\w-]+)/g)) tokens.add(match[1]!);
      this.paintThemeTokens = [...tokens];
    }
    const style = ownerWindow(this)?.getComputedStyle(this);
    if (!style) return false;
    const tokens = new Set(this.paintThemeTokens);
    const values = [style.color, style.colorScheme];
    for (const token of tokens) {
      const value = style.getPropertyValue(token).trim(); values.push(token, value);
      if (tokens.size < 512) for (const match of value.matchAll(/var\(\s*(--[\w-]+)/g)) tokens.add(match[1]!);
    }
    const key = JSON.stringify(values);
    if (this.paintThemeKey === key) return false;
    this.paintThemeKey = key;
    paintColorCache.delete(this);
    this.appliedLayerPaintKeys.clear();
    this.appliedChoroplethPaintKey = undefined;
    return true;
  }

  /** Repaints token-derived and visibility-derived MapLibre values without touching sources,
   *  layers, or map geometry -- which is exactly what a theme change and a `hiddenCategories`
   *  change each need. */
  private readonly mapPaintBatch = new MapPaintBatch();
  private mapPaintBatchActive = false;

  private withMapPaintBatch(apply: () => void): boolean {
    const map = this._map;
    if (!map || !this._styleLoaded || !this.isConnected) return false;
    const style = this._styleGeneration, connection = this._connectGeneration, generation = this.featureGeneration;
    const styleInput = this.mapStyle, data = this.dataLayers, choropleth = this.choropleth, hidden = this.hiddenCategories;
    const current = () => this.isConnected && this._map === map && this._styleLoaded && this._styleGeneration === style &&
      this._connectGeneration === connection && this.featureGeneration === generation && this.mapStyle === styleInput &&
      this.dataLayers === data && this.choropleth === choropleth && this.hiddenCategories === hidden;
    const previous = this.mapPaintBatchActive; this.mapPaintBatchActive = true;
    try { this.mapPaintBatch.run(map, style, current, apply); return true; }
    catch (error) {
      // A native callback may supersede the batch after only its first write. Clear every
      // success cache and let the next current transaction supply missing paint and repaint.
      this.appliedLayerPaintKeys.clear(); this.appliedChoroplethPaintKey = undefined;
      if (error instanceof DOMException && error.name === 'AbortError') {
        // This scheduler keeps the first callback for its key. Read the latest owner when it
        // runs, rather than capturing a generation that another deferred request can replace.
        this.scheduleAfterUpdate(() => {
          if (this.isConnected && this._map && this._styleLoaded) void this.reconcileGeneratedLayers();
        }, 'map-paint-reconcile');
      } else if (current()) this.failInitialization('initialization-failed');
      return false;
    } finally { this.mapPaintBatchActive = previous; }
  }

  private removeMapLayer(id: string): void {
    this.mapPaintBatch.invalidate(id);
    this._map?.removeLayer(id);
  }

  private setMapPaint(id: string, property: string, value: unknown): void {
    if (this.mapPaintBatchActive) this.mapPaintBatch.write(id, property, value);
    else this.withMapPaintBatch(() => { this.mapPaintBatch.write(id, property, value); });
  }

  private pendingDrawingTheme = false;
  private refreshThemePaint(): boolean {
    if (this._canonicalExternalLayers.length || this.externalFeatureWorkStarted || this.optionalFeatureWorkStarted ||
      ownedFeaturesRequested(this.overlays, this.images, this.styleOverrides)) {
      paintColorCache.delete(this);
      this.appliedLayerPaintKeys.clear(); this.appliedChoroplethPaintKey = undefined;
      this.pendingDrawingTheme = true;
      void this.reconcileGeneratedLayers();
      return true;
    }
    this.withMapPaintBatch(() => this.refreshThemePaintBatch());
    return false;
  }

  private refreshThemePaintBatch(): void {
    paintColorCache.delete(this);
    if (!this._map || !this._styleLoaded) return;
    if (this.preparingFeatures) {
      if (this._canonicalExternalLayers.length || this.externalFeatureWorkStarted) {
        this.appliedLayerPaintKeys.clear();
      }
      return;
    }
    this.readiness.invalidate();
    const fillOpacity = choroplethFillOpacity(this);
    if (this._appliedFillLayerId) {
      const choropleth = this.canonicalChoropleth;
      if (choropleth && choropleth.stops.length > 0) {
        this.setMapPaint(this._appliedFillLayerId, 'fill-color', this.choroplethColorExpression(choropleth) as never);
      }
      this.setMapPaint(this._appliedFillLayerId, 'fill-opacity', fillOpacity);
    }
    const dataLayersBySourceId = new Map(
      this.canonicalDataLayers.map((layer) => [layer.sourceId, layer]),
    );
    for (const [publicSourceId, sourceId] of this._appliedDataLayerIds) {
      const dataLayer = dataLayersBySourceId.get(publicSourceId);
      if (!dataLayer) continue;
      // Re-runs the entry's own kind rather than assuming fill/line/circle: a clustered or heatmap
      // entry never created those, and MapLibre reports a paint write to a layer that does not
      // exist as an error event on this component's own handler.
      this.paintDataLayer(sourceId, dataLayer);
      const {geojson: _geojson, geojsonProjection: _projection, ...paint} = dataLayer;
      this.appliedLayerPaintKeys.set(sourceId, JSON.stringify(paint));
    }
  }

  /**
   * Records bounded desired state for a currently restored, unambiguous logical source. `true`
   * means admission, not a native paint acknowledgement; `whenIdle()` covers application and
   * rejects with a sanitized error on failure. As with native failures, idle remains rejected
   * until a new style or reconnect; desired state remains available for retry. Vector targets require sourceLayer. Basemap
   * sources require interactiveBasemapLayers opt-in. Invalid or colliding targets return false.
   * Retained routing admits at most 256 logical sources and 1,048,576 copied source-descriptor characters;
   * exceeding either bound disables retained routing atomically while map interaction remains available.
   * The first write loads the feature-state runtime on demand. Until it has loaded this returns false
   * without retaining anything, and whenIdle() resolves only after the load, so await it and write
   * again; once loaded, admission is synchronous for every element. If the runtime cannot load,
   * localized feedback is shown and writes keep returning false until a new style or connection.
   */
  setFeatureState(target: LyraMapFeatureStateTarget, patch: LyraMapFeatureState): boolean {
    if (!this.canWriteFeatureState()) return false;
    const states = this.featureStateRuntime();
    if (!states) return false;
    const accepted = states.set(target, patch).accepted;
    if (accepted) { this.stateRequested = true; this.flushFeatureState(); }
    return accepted;
  }

  /** Returns frozen own-data desired state, never caller-owned or native state references. */
  getFeatureState(target: LyraMapFeatureStateTarget): LyraMapFeatureState | undefined {
    return this.featureStates?.get(target);
  }

  /** Records removal of owned keys only; admission and idle semantics match setFeatureState(). */
  removeFeatureState(target: LyraMapFeatureStateTarget, key?: string): boolean {
    if (!this.canWriteFeatureState()) return false;
    const states = this.featureStateRuntime();
    if (!states) return false;
    const accepted = states.remove(target, key).accepted;
    if (accepted) { this.stateRequested = true; this.flushFeatureState(); }
    return accepted;
  }

  /** The desired-state owner, configured with the accepted routes. Without its runtime, the first
   * call starts that load once and returns undefined. */
  private featureStateRuntime(): MapFeatureStateRoutes | undefined {
    if (this.featureStates) return this.featureStates;
    const runtime = loadMapFeatureStateRuntime.loaded;
    if (runtime) {
      const states = new runtime.MapFeatureStateRoutes();
      states.configure(this.stateRoutes);
      return this.featureStates = states;
    }
    if (this.featureStateLoad) return undefined;
    this.featureStateLoad = 'loading';
    this.trackFeatureLoad(loadMapFeatureStateRuntime().then(() => { this.featureStateLoad = undefined; }, () => {
      this.featureStateLoad = 'failed';
      if (this.isConnected) this.featureStateIssue = true;
    }));
    return undefined;
  }

  private canWriteFeatureState(): boolean {
    const map = this._map, generation = this.interactionGeneration;
    return Boolean(map && this.isConnected && this._styleLoaded && !this.preparingFeatures &&
      !this.isUpdatePending && featureStatePeer(map) && this._map === map && generation === this.interactionGeneration && !this.isUpdatePending);
  }

  private flushFeatureState(): void {
    const map = this._map, generation = this.interactionGeneration;
    if (!map) return;
    this.readiness.invalidate();
    this.replayFeatureStates(map, () => this.isConnected && this._map === map && generation === this.interactionGeneration && !this.isUpdatePending);
    this.readiness.check();
  }

  private replayFeatureStates(map: MapLibreMapCapability, current: () => boolean, signal?: AbortSignal): void {
    if (!this.stateRequested || !current()) return;
    if (!this.stateRoutingAvailable) { this.featureStateIssue = true; this.readiness.fail(); return; }
    const states = this.featureStates;
    const result = states && featureStatePeer(map) ? states.replay(map, this._styleGeneration, signal, current) : undefined;
    if (!current()) return;
    if (!result?.accepted || result.diagnostics.length) {
      this.featureStateIssue = true; this.readiness.fail(); return;
    }
    this.featureStateIssue = false;
    if (result.applied) {
      try { map.triggerRepaint?.(); } catch { if (current()) { this.featureStateIssue = true; this.readiness.fail(); } }
    }
  }

  private sourceToken(origin: LyraMapFeatureOrigin, source: string, data: unknown, shape: string): object {
    const key = JSON.stringify([origin, source]), previous = this.sourceIdentities.get(key);
    if (previous && Object.is(previous.data, data) && previous.shape === shape) return previous.token;
    const token = Object.freeze({}); this.sourceIdentities.set(key, { data, shape, token }); return token;
  }

  /** Explicit `interactiveBasemapLayers` ids, then every current style layer a selector matches. */
  private basemapInteractionTargets(): readonly (CanonicalMapInteraction & { readonly layerId: string })[] | undefined {
    const opted = projectMapBasemapInteractions(this.interactiveBasemapLayers);
    if (!opted) return undefined;
    return expandMapStyleLayerTargets(opted, this._styleLayers, entry => entry)
      .map(({ layerId, entry }) => ({ layerId, interactive: entry.interactive, priority: entry.priority }));
  }

  private _styleLayers: readonly LyraMapStyleLayer[] = EMPTY_STYLE_LAYERS;
  private _styleSources: readonly LyraMapStyleSource[] = EMPTY_STYLE_SOURCES;
  /**
   * The layers of the current `mapStyle` as the engine loaded it, in paint order, before this
   * element added its own: `{ id, type, source?, sourceLayer? }`, frozen. Read it after
   * `lr-map-style-load` (or `whenStyleReady()`) to discover basemap layers for
   * `interactiveBasemapLayers`, `styleOverrides` or an overlay that targets a basemap source. Empty
   * before the style has loaded; replaced on every style swap. At most 4,096 layers are listed.
   */
  get styleLayers(): readonly LyraMapStyleLayer[] { return this._styleLayers; }
  /** The sources of the current `mapStyle`, `{ id, type }`, frozen, with the same timing as
   *  `styleLayers`. At most 1,024 sources are listed. */
  get styleSources(): readonly LyraMapStyleSource[] { return this._styleSources; }

  /** Records the basemap catalog when a style becomes ready, before generated resources exist. */
  private captureStyleCatalog(map: MapLibreMapCapability): void {
    let layers: LyraMapStyleLayer[] = [], sources: LyraMapStyleSource[] = [];
    try {
      const style = map.getStyle?.();
      const rawLayers = mapOwnValue(style, 'layers'), rawSources = mapOwnValue(style, 'sources');
      if (Array.isArray(rawLayers)) for (const layer of rawLayers.slice(0, 4096)) {
        const id = mapOwnValue(layer, 'id'), type = mapOwnValue(layer, 'type');
        const source = mapOwnValue(layer, 'source'), sourceLayer = mapOwnValue(layer, 'source-layer');
        if (typeof id !== 'string' || typeof type !== 'string') continue;
        layers.push(Object.freeze({ id, type, ...(typeof source === 'string' ? { source } : {}),
          ...(typeof sourceLayer === 'string' ? { sourceLayer } : {}) }));
      }
      if (isPlainDataRecord(rawSources)) for (const id of Object.keys(rawSources).slice(0, 1024)) {
        const type = mapOwnValue(mapOwnValue(rawSources, id), 'type');
        if (typeof type === 'string') sources.push(Object.freeze({ id, type }));
      }
    } catch { layers = []; sources = []; }
    this._styleLayers = layers.length ? Object.freeze(layers) : EMPTY_STYLE_LAYERS;
    this._styleSources = sources.length ? Object.freeze(sources) : EMPTY_STYLE_SOURCES;
  }

  private mapStateDefinitions(owned: MapOwnedOverlaySnapshot): readonly MapFeatureStateRoute[] {
    const routes: MapFeatureStateRoute[] = [], map = this._map;
    this.stateRoutingAvailable = true;
    let identityText = 0;
    if (!map) return routes;
    const generation = this.interactionGeneration;
    const current = (): boolean => this._map === map && generation === this.interactionGeneration && this.isConnected;
    const add = (origin: LyraMapFeatureOrigin, source: string, nativeSource: string, data: unknown, shape: string, sourceLayers?: readonly string[]): void => {
      identityText += typeof data === 'string' ? data.length : 0;
      if (routes.length >= 256 || identityText > 1048576) { this.stateRoutingAvailable = false; return; }
      routes.push({ origin, source, nativeSource, identity: this.sourceToken(origin, source, data, shape), ...(sourceLayers ? { sourceLayers } : {}) });
    };
    const choropleth = this.canonicalChoropleth;
    if (choropleth) add('choropleth', choropleth.sourceId, this._appliedChoroplethSourceId ?? '', choropleth.geojson, 'geojson');
    for (const row of this.canonicalDataLayers) add('data-layer', row.sourceId, this._appliedDataLayerIds.get(row.sourceId) ?? '', row.geojson, dataLayerShape(row));
    for (const row of this._canonicalExternalLayers) if (row.sourceLayer) {
      add('data-layer', row.sourceId, this.externalSourceIds.get(row.sourceId) ?? '', JSON.stringify(row.source), row.sourceLayer, [row.sourceLayer]);
    }
    for (const source of owned.sources) {
      if (!this.stateRoutingAvailable) break;
      const type = source.source['type'];
      const layers = [...new Set(owned.layers.filter(row => row.layer['source'] === source.id)
        .map(row => row.layer['source-layer']).filter((value): value is string => typeof value === 'string'))].sort();
      if (type === 'geojson' || type === 'vector' && layers.length) add('overlay', source.id, source.id, ...sourceIdentity(source.source, layers), type === 'vector' ? layers : undefined);
    }
    const opted = this.basemapInteractionTargets();
    if (opted?.length && this.stateRoutingAvailable) {
      const nativeOwned = new Set([...routes.map(route => route.nativeSource), ...owned.sources.map(source => source.id), ...this.externalSourceIds.values(), ...[...this.externalSourceIds.values()].map(id => `${id}-hit-source`), ...(this.drawingController?.sourceId ? [this.drawingController.sourceId] : [])]);
      const style = map.getStyle?.() ?? this.mapStyle;
      if (!current()) return [];
      const sources = mapOwnValue(style, 'sources');
      const groups = new Map<string, Set<string>>();
      for (const option of opted) {
        const layer = map.getLayer(option.layerId);
        if (!current()) return [];
        const source = mapOwnValue(layer, 'source'), sourceLayer = mapOwnValue(layer, 'source-layer');
        if (!option.interactive || typeof source !== 'string' || nativeOwned.has(source)) continue;
        let group = groups.get(source); if (!group) groups.set(source, group = new Set());
        if (typeof sourceLayer === 'string') group.add(sourceLayer);
      }
      for (const [id, group] of groups) {
        if (!this.stateRoutingAvailable) break;
        const raw = mapOwnValue(sources, id);
        // Reuse the source admission boundary before retaining any peer-owned style data.
        let snapshot: MapOwnedFeatureInput;
        // A basemap opt-in loads the ownership runtime before routes are defined; without it, skip.
        const admit = loadMapOwnedFeatureRuntime.loaded?.snapshotMapOwnedFeatureInput;
        if (!admit) continue;
        try { snapshot = admit({ overlays: { sources: [{ id, source: raw }], layers: [] }, images: [], styleOverrides: [] }); }
        catch { if (!current()) return []; else continue; }
        if (!current()) return [];
        const source = (snapshot.overlays as MapOwnedOverlaySnapshot).sources[0]?.source;
        const type = source?.['type'], layers = [...group].sort();
        if (source && (type === 'geojson' || type === 'vector' && layers.length)) add('basemap', id, id, ...sourceIdentity(source, layers), type === 'vector' ? layers : undefined);
      }
    }
    return this.stateRoutingAvailable ? routes : [];
  }

  private prepareStateRetirement(owned: MapOwnedOverlaySnapshot): void {
    const generation = this.interactionGeneration, map = this._map;
    const desired = this.mapStateDefinitions(owned);
    if (generation !== this.interactionGeneration || map !== this._map) return;
    for (const old of this.stateRoutes) {
      const next = desired.find(route => route.origin === old.origin && route.source === old.source);
      if (!next || next.identity !== old.identity) this.featureStates?.invalidateNative(old.origin, old.nativeSource);
    }
    const keys = new Set(desired.map(route => JSON.stringify([route.origin, route.source])));
    for (const key of this.sourceIdentities.keys()) if (!keys.has(key)) this.sourceIdentities.delete(key);
  }

  private configureMapInteractions(owned: MapOwnedOverlaySnapshot, external: ReturnType<typeof buildMapExternalLayers>): void {
    const generation = this.interactionGeneration, map = this._map;
    const current = (): boolean => generation === this.interactionGeneration && map === this._map && this.isConnected;
    const routes = this.mapStateDefinitions(owned);
    if (!current()) return;
    const states = this.featureStates;
    if (states ? states.configure(routes).accepted && this.stateRouter.configure(routes) : this.stateRouter.configure(routes)) this.stateRoutes = routes;
    else {
      states?.configure([]); this.stateRouter.configure([]); this.stateRoutes = [];
      if (this.stateRequested) { this.featureStateIssue = true; this.readiness.fail(); }
    }
    const rules: AppliedMapInteraction[] = [];
    const add = (layerId: string, origin: LyraMapFeatureOrigin, source: string, options: LyraMapInteractionOptions, sourceLayer?: string, cluster = false): void => {
      rules.push({ layerId, owner: origin === 'basemap' ? 'basemap' : 'overlay', origin, source,
        interactive: options.interactive ?? true, priority: options.priority ?? 0, ...(sourceLayer ? { sourceLayer } : {}), ...(cluster ? { cluster } : {}) });
    };
    const choropleth = this.canonicalChoropleth;
    if (choropleth && this._appliedFillLayerId) add(this._appliedFillLayerId, 'choropleth', choropleth.sourceId, choropleth);
    for (const row of this.canonicalDataLayers) {
      const native = this._appliedDataLayerIds.get(row.sourceId); if (!native) continue;
      for (const suffix of QUERYABLE_DATA_LAYER_SUFFIXES) add(`${native}${suffix}`, 'data-layer', row.sourceId, row, undefined, suffix === '-cluster');
    }
    for (const [layerId, hit] of external.hits) {
      const row = this._canonicalExternalLayers.find(entry => entry.sourceId === hit.sourceId);
      if (row) add(layerId, 'data-layer', row.sourceId, { ...row, interactive: row.interactive && !(row.category && this.hiddenCategories.includes(row.category)) }, hit.sourceLayer);
    }
    for (const row of owned.layers) {
      const source = row.layer['source'], sourceLayer = row.layer['source-layer'];
      if (typeof source === 'string') add(row.layer.id, 'overlay', source, row, typeof sourceLayer === 'string' ? sourceLayer : undefined);
    }
    const opted = this.basemapInteractionTargets();
    if (opted) for (const row of opted) {
      if (this.drawingController?.ownsLayer(row.layerId) === true || rules.some(rule => rule.layerId === row.layerId)) continue;
      const layer = map?.getLayer(row.layerId);
      if (!current()) return;
      const source = mapOwnValue(layer, 'source'), sourceLayer = mapOwnValue(layer, 'source-layer');
      if (typeof source === 'string' && !routes.some(route => route.origin !== 'basemap' && route.nativeSource === source)) add(row.layerId, 'basemap', source, row, typeof sourceLayer === 'string' ? sourceLayer : undefined);
    }
    if (current()) this.interactions = Object.freeze(rules);
  }

  private drawingConfigRevision = 0;
  private drawingConfigApplying = 0;
  private drawingConfigApplied = 0;

  private drawingActionAllowed(): boolean {
    return this.isConnected && !!this._map && this._styleLoaded && !this.preparingFeatures &&
      this.drawingConfigRevision === this.drawingConfigApplied && !this.mapInteractionBlocked();
  }

  private mapInteractionAllowed(): boolean {
    if (!this.isConnected || !this._map || !this._styleLoaded || this.preparingFeatures || this.isUpdatePending) return false;
    return !this.mapInteractionBlocked();
  }

  private mapInteractionBlocked(): boolean {
    for (let node: Element | null = this; node; node = flattenedParentElement(node)) if (node.hasAttribute('inert') || node === this && node.hasAttribute('disabled')) return true;
    return false;
  }

  private syncMapCursor(): void {
    const map = this._map, generation = this.interactionGeneration;
    if (!map || !this.mapInteractionAllowed()) { this.mapCursor.clear(); return; }
    try {
      const canvas = map.getCanvas();
      if (this._map !== map || generation !== this.interactionGeneration || !this.mapInteractionAllowed()) return;
      this.mapCursor.set(canvas, this.pickMode ? 'pick' : this.drawingController?.active ? 'drawing' : this.hovered ? 'hover' : undefined);
    } catch { if (this._map === map && generation === this.interactionGeneration) this.mapCursor.clear(); }
  }

  private observeMapInteractions(canvas: HTMLCanvasElement): void {
    const map = this._map;
    const current = (): boolean => this._map === map && this.isConnected;
    const cancel = (): void => { if (current()) { this.cancelMapDrawing('pointercancel'); if (!this.drawingController?.active) { this.clearMapHover(); this.mapCursor.clear(); } } };
    const down = (): void => { this.suppressDrawingClick = false; };
    const click = (event: MouseEvent): void => { if (this.suppressDrawingClick) { this.suppressDrawingClick = false; event.preventDefault(); event.stopImmediatePropagation(); } };
    canvas.addEventListener('pointercancel', cancel, true);
    canvas.addEventListener('pointerdown', down, true); canvas.addEventListener('click', click, true);
    this.pointerCleanup = () => { canvas.removeEventListener('pointercancel', cancel, true); canvas.removeEventListener('pointerdown', down, true); canvas.removeEventListener('click', click, true); };
    this.interactionBlocked = this.mapInteractionBlocked();
    this.interactionObserver = new MutationObserver(() => {
      if (!current()) return;
      this.interactionBlocked = this.mapInteractionBlocked();
      if (this.interactionBlocked) { this.cancelMapDrawing('disabled'); this.clearMapHover(); this.anchorController?.hide(); } else { this.syncMapCursor(); this.scheduleAnchorSync(); }
    });
    for (let node: Element | null = this; node; node = flattenedParentElement(node)) this.interactionObserver.observe(node, { attributes: true, attributeFilter: ['inert', 'disabled'] });
  }

  private pointerFrame?: number;
  private pendingPointer?: LyraMapPointerDetail;
  /** An `lr-map-pointer-move` was reported since the last `lr-map-pointer-leave`. */
  private pointerInside = false;

  /** Queues one `lr-map-pointer-move` per animation frame, carrying the latest position. */
  private schedulePointerReport(map: MapLibreMapCapability, event: unknown): void {
    const lngLat = mapCoordinates(mapOwnValue(event, 'lngLat'));
    const point = mapOwnValue(event, 'point');
    const x = mapOwnValue(point, 'x'), y = mapOwnValue(point, 'y');
    if (!lngLat || !isFiniteCoordinate(x) || !isFiniteCoordinate(y)) return;
    this.pendingPointer = Object.freeze({ lngLat: Object.freeze([wrapLongitude(lngLat[0]), lngLat[1]] as const), point: Object.freeze([x, y] as const) });
    if (this.pointerFrame !== undefined) return;
    const report = (): void => {
      this.pointerFrame = undefined;
      const detail = this.pendingPointer; this.pendingPointer = undefined;
      if (!detail || this._map !== map || !this.isConnected || this.mapInteractionBlocked()) return;
      this.pointerInside = true;
      this.emit('lr-map-pointer-move', detail);
    };
    const view = ownerWindow(this);
    if (!view || typeof view.requestAnimationFrame !== 'function') { report(); return; }
    this.pointerFrame = view.requestAnimationFrame(report);
  }

  /** Drops a queued pointer report and reports the leave of a pointer that was reported inside. */
  private endPointerReports(emit = true): void {
    if (this.pointerFrame !== undefined) ownerWindow(this)?.cancelAnimationFrame?.(this.pointerFrame);
    this.pointerFrame = undefined; this.pendingPointer = undefined;
    const inside = this.pointerInside; this.pointerInside = false;
    if (inside && emit && this.isConnected) this.emit('lr-map-pointer-leave');
  }

  private clearMapHover(): void {
    const previous = this.hovered; this.hovered = undefined; this.mapCursor.clear();
    if (previous && this.isConnected) this.emit('lr-map-feature-leave', previous.detail);
  }

  /** Opens an explicit vertex-edit session from a valid completed drawing snapshot.
   * Mode and vertices are detached through own data properties; geometry and spherical metrics
   * are recomputed. Caller metrics are ignored. False leaves existing state unchanged, including
   * when another session is active. A completion listener may synchronously reopen its result.
   * Accepted vertex edits emit frozen lr-map-draw-change snapshots with completed geometry and
   * metrics. Finish/completeDrawing commits and clears; cancel, style replacement and disconnect
   * retire the edit session. True admits desired state; whenIdle covers owned rendering work.
   * The first call loads the drawing runtime on demand. Until it has loaded, this returns false
   * without reading the snapshot or changing state, and whenIdle() resolves only after the load,
   * so await it and call again. Once loaded, admission is synchronous for every element. */
  editDrawing(snapshot: LyraMapDrawingSnapshot): boolean {
    if (this.drawingLoad === 'failed') this.drawingLoad = undefined;
    return this.drawingRuntime()?.edit(snapshot) ?? false;
  }

  /** Removes the last accepted vertex. Returns false when drawing is unavailable or empty. */
  undoDrawing(): boolean {
    return this.drawingController?.undo() ?? false;
  }

  /** Emits a frozen valid geometry with spherical metrics, then exits drawing mode.
   * Returns false for an incomplete/invalid shape. Completed geometry is not retained on the map;
   * assign it to dataLayers to keep it. Reentrant replacement belongs to the new drawing. */
  completeDrawing(): boolean {
    return this.drawingController?.complete() ?? false;
  }

  /** Cancels an armed or started drawing and clears its temporary resources and mode. An armed
   * mode whose drawing runtime is still loading is cancelled synchronously as well. */
  cancelDrawing(): boolean { return this.cancelMapDrawing('cancel'); }

  private cancelMapDrawing(reason: LyraMapDrawingCancelReason, keepMode = false, armedMode = this.drawMode): boolean {
    const drawing = this.drawingController;
    if (drawing) return drawing.cancel(reason, keepMode, armedMode);
    // Before the runtime loads, an armed mode has no session, gesture lease or resources to retire.
    if (armedMode !== 'line' && armedMode !== 'polygon') return false;
    this.drawingIssue = undefined;
    if (!keepMode) this.resetDrawingMode();
    this.drawingEpoch++; this.syncMapCursor();
    this.emit('lr-map-draw-cancel', Object.freeze({ mode: armedMode, phase: 'cancelled', vertices: Object.freeze([]), reason } satisfies LyraMapDrawingCancelDetail));
    return true;
  }

  private resetDrawingMode(): void {
    this.drawingResetting = true;
    try { this.drawMode = 'none'; } finally { this.drawingResetting = false; }
  }

  private syncDrawing(): void {
    if (this.mapUpdateActive) {
      this.scheduleAfterUpdate(() => this.syncDrawing(), 'map-sync-drawing');
      return;
    }
    const drawing = this.drawingController;
    if (drawing) { drawing.sync(); return; }
    if (this.pickMode) { this.cancelMapDrawing('pick-mode'); return; }
    if (this.mapInteractionBlocked()) { this.cancelMapDrawing('disabled'); return; }
    if (this.drawMode === 'line' || this.drawMode === 'polygon') this.drawingRuntime()?.sync();
  }

  /** The drawing controller. Without its runtime, starts loading it once and returns undefined;
   * a failed load is retried only when drawing is requested again. */
  private drawingRuntime(): MapDrawingController | undefined {
    if (this.drawingController) return this.drawingController;
    const runtime = loadMapDrawingRuntime.loaded;
    if (runtime) return this.drawingController = new runtime.MapDrawingController(this.drawingHost());
    if (this.drawingLoad) return undefined;
    this.drawingLoad = 'loading';
    this.trackFeatureLoad(loadMapDrawingRuntime().then(() => {
      this.drawingLoad = undefined;
      if (this.isConnected) this.syncDrawing();
    }, () => {
      this.drawingLoad = 'failed';
      if (this.isConnected) this.showDrawingError();
    }));
    return undefined;
  }

  private drawingHost(): MapDrawingHost {
    return {
      element: this,
      map: () => this._map,
      styleLoaded: () => this._styleLoaded,
      generations: () => [this._styleGeneration, this._connectGeneration],
      usable: () => !this.loading && !this.failure,
      epoch: () => this.drawingEpoch,
      advanceEpoch: () => { this.drawingEpoch++; },
      actionAllowed: () => this.drawingActionAllowed(),
      interactionAllowed: () => this.mapInteractionAllowed(),
      interactionBlocked: () => this.mapInteractionBlocked(),
      updateActive: () => this.mapUpdateActive,
      afterUpdate: (callback, key) => { this.scheduleAfterUpdate(callback, key); },
      emit: (type: 'lr-map-draw-start' | 'lr-map-draw-change' | 'lr-map-draw-complete', state) => { this.emit(type, state); },
      emitCancel: detail => { this.emit('lr-map-draw-cancel', detail); },
      emitVertexEnd: detail => { this.emit('lr-map-draw-vertex-end', detail); },
      showError: error => { this.showDrawingError(error); },
      clearError: () => { this.drawingIssue = undefined; },
      resetMode: () => { this.resetDrawingMode(); },
      suppressClick: () => { this.suppressDrawingClick = true; },
      syncCursor: () => { this.syncMapCursor(); },
      changed: () => { this.drawingRevision += 1; },
      invalidate: () => { this.readiness.invalidate(); },
      check: () => { this.readiness.check(); },
      fail: () => { this.readiness.fail(); },
      direction: () => this.effectiveDirection,
      accentColor: () => resolvedLayerColor(this, `var(${DRAWING_COLOR_TOKEN})`, 'accent'),
      resolve: (value, property) => this.resolveStyleOverride(value, property),
    };
  }

  private showDrawingError(error?: MapDrawingError): void {
    this.drawingIssue = error === 'invalid-coordinate' ? 'mapDrawingInvalidCoordinate'
      : error === 'duplicate-vertex' ? 'mapDrawingDuplicateVertex' : error === 'vertex-limit' ? 'mapDrawingVertexLimit'
        : error === 'too-few-vertices' || error === 'empty' ? 'mapDrawingTooFewVertices'
          : error && error !== 'inactive' ? 'mapDrawingInvalidGeometry' : 'mapDrawingUnavailable';
    this.announcements.announceAssertive(this.drawingErrorMessage());
  }

  private drawingErrorMessage(): string {
    return this.localize(MAP_DRAWING_MESSAGE[this.drawingIssue!], undefined, { count: this.drawingIssue === 'mapDrawingVertexLimit' ? 512 : this.drawMode === 'polygon' ? 3 : 2 });
  }

  private drawMapCenter = (): void => { this.drawingController?.addCenter(); };
  private cancelMapPick = (): void => { this.pickMode = false; this.clearMapHover(); };
  private pickMapCenter = (): void => {
    const map = this._map, generation = this.interactionGeneration;
    if (!map || !this.pickMode || !this.mapInteractionAllowed()) return;
    try {
      const lngLat = mapCoordinates(map.getCenter());
      if (lngLat && this._map === map && generation === this.interactionGeneration && this.mapInteractionAllowed()) this.emit('lr-map-pick', Object.freeze({ lngLat, trigger: 'keyboard' } satisfies LyraMapPickDetail));
    } catch { /* An unavailable center does not produce a pick. */ }
  };

  private handleMapInteraction(kind: 'click' | 'contextmenu' | 'mousemove', event: { readonly point: unknown; readonly lngLat: unknown }): void {
    const drawing = this.drawingController;
    if (kind === 'click' && (this.suppressDrawingClick || drawing?.consumeClick())) { this.suppressDrawingClick = false; return; }
    if (drawing?.dispatching) return;
    if (this.queryingMap) { this.interactionQuery++; return; }
    if (!this.mapInteractionAllowed()) { this.clearMapHover(); return; }
    const map = this._map!;
    const generation = this.interactionGeneration, query = ++this.interactionQuery, style = this.mapStyle;
    const current = (): boolean => this._map === map && generation === this.interactionGeneration && query === this.interactionQuery && style === this.mapStyle && this.mapInteractionAllowed();
    let lngLat: readonly [number, number] | undefined;
    let hit: LyraMapFeatureHit | undefined, rule: AppliedMapInteraction | undefined, raw: Feature | undefined;
    this.queryingMap = true;
    try {
      lngLat = mapCoordinates(mapOwnValue(event, 'lngLat'));
      if (!lngLat || !current()) return;
      if (kind === 'click' && drawing?.active && !this.pickMode) { if (!drawing.editing) drawing.add(lngLat); return; }
      let features: unknown;
      const rules = this.interactions;
      // A layer outside its zoom range, hidden or fully transparent cannot shadow a visible one.
      let zoom = Number.NaN;
      try { zoom = map.getZoom(); } catch { /* An unknown zoom keeps every layer eligible. */ }
      const result = queryMapHit({ getLayer: id => {
        const layer = map.getLayer(id);
        // Generated data-layer hit footprints are transparent by design; author layers are not.
        const rule = rules.find(rule => rule.layerId === id);
        const origin = rule?.origin;
        if (origin === 'data-layer' && Number.isFinite(zoom)) {
          const row = this.committedDataLayers.find(row => row.sourceId === rule?.source) ??
            this.committedExternalLayers.find(row => row.sourceId === rule?.source);
          if (row && (zoom < row.minZoom || zoom >= row.maxZoom)) return undefined;
        }
        return layer && mapLayerHittable(map, id, layer, zoom, origin === 'overlay' || origin === 'basemap') ? layer : undefined;
      }, queryRenderedFeatures: (point, options) => {
        features = map.queryRenderedFeatures([point.x, point.y], { layers: [...options.layers] }); return features;
      } }, mapOwnValue(event, 'point') as { readonly x: number; readonly y: number }, rules.map(({ layerId, owner, interactive, priority }) => ({ layerId, owner, interactive, priority })), { current });
      if (!current() || result.status !== 'hit' && result.status !== 'none') return;
      if (result.status === 'hit') {
        rule = rules.find(row => row.layerId === result.hit.layerId); if (!rule) return;
        const native = result.hit;
        const target = native.id === undefined ? undefined : this.stateRouter.resolve({ origin: rule.origin, source: rule.source, id: native.id, ...(rule.sourceLayer ? { sourceLayer: rule.sourceLayer } : {}) });
        hit = Object.freeze({ layerId: native.layerId, origin: rule.origin, source: rule.source, properties: native.properties,
          ...(native.id === undefined ? {} : { id: native.id }), ...(rule.sourceLayer ? { sourceLayer: rule.sourceLayer } : {}), ...(target ? { target } : {}) });
        raw = mapOwnValue(features, String(result.featureIndex)) as Feature | undefined;
      }
      if (!current()) return;
    } finally { this.queryingMap = false; }
    if (!lngLat) return;
    // The detached feature is built only for a detail that is dispatched, never per pointer move.
    const interaction = (): LyraMapInteractionDetail => Object.freeze({ lngLat, ...(hit ? { hit, feature: detachedMapFeature(raw, hit) } : {}) });
    if (kind === 'mousemove') {
      const key = hit ? JSON.stringify([hit.origin, hit.source, hit.sourceLayer ?? null, hit.layerId, hit.id === undefined ? ['anonymous', query] : ['id', hit.id]]) : undefined;
      if (key !== this.hovered?.key) {
        this.clearMapHover(); if (!current()) return;
        if (hit && key) { const detail = interaction(); this.hovered = { key, detail }; this.emit('lr-map-feature-enter', detail); }
      }
      if (current()) this.syncMapCursor(); return;
    }
    if (kind === 'contextmenu') { this.emit('lr-map-contextmenu', interaction()); return; }
    if (this.pickMode) { this.emit('lr-map-pick', Object.freeze({ ...interaction(), trigger: 'pointer' } satisfies LyraMapPickDetail)); return; }
    const clickToken = ++this.clusterZoomToken;
    const origin = rule?.cluster ? 'cluster' : rule?.origin;
    const choropleth = this.canonicalChoropleth;
    const noData = origin === 'choropleth' && choropleth?.noData !== undefined && typeof hit?.properties[choropleth.field] !== 'number';
    this.emit('lr-map-click', { lngLat, feature: raw, origin, sourceId: origin === 'choropleth' ? undefined : rule?.source,
      ...(rule?.sourceLayer ? { sourceLayer: rule.sourceLayer } : {}), ...(hit ? { hit, ...(hit.target ? { target: hit.target } : {}) } : {}), ...(noData ? { noData: true } : {}) });
    if (origin === 'cluster' && rule && clickToken === this.clusterZoomToken && current()) this.zoomIntoCluster(rule.source, raw);
  }

  private cancelFeaturePreparation(): void {
    this.interactionGeneration++; this.featureStates?.cancel(); this.clearMapHover();
    this.ownedFeatures?.cancel();
    this.externalFeatures?.cancel();
    this.finishFeatureWork?.();
    this.finishFeatureWork = undefined;
    this.featureGeneration += 1;
    this.featureAbort?.abort();
    this.featureAbort = undefined;
    this.preparingFeatures = false;
  }

  /** Source specifications and only the layer families this component is about to render. */
  private generatedFeatureRequirements(): LyraMapFeatureRequirements {
    const sources: Record<string, unknown> = {};
    const layers: { id: string; type: string; source: string }[] = [];
    const add = (source: string, types: readonly string[]): void => {
      for (const [index, type] of types.entries()) layers.push({ id: `${source}-${type}-${index}`, type, source });
    };
    const choropleth = this.canonicalChoropleth;
    if (choropleth) {
      sources['choropleth'] = { type: 'geojson', data: choropleth.geojson };
      if (choropleth.stops.length) add('choropleth', ['fill']);
    }
    for (const [index, layer] of this.canonicalDataLayers.entries()) {
      const source = `data-${index}`;
      const cluster = layer.cluster;
      sources[source] = { type: 'geojson', data: layer.geojson,
        ...(cluster ? { cluster: true, clusterRadius: cluster.radius, clusterMaxZoom: cluster.maxZoom } : {}),
      };
      if (layer.kind === 'heatmap') add(source, ['heatmap']);
      else {
        add(source, cluster ? ['circle'] : ['fill', 'line', 'circle']);
        if (layer.label || (cluster && this.styleProvidesGlyphs()) || (layer.point?.iconField && layer.point.icons.length)) {
          add(source, ['symbol']);
        }
      }
    }
    return { sources, layers };
  }

  private externalSourceEffects?: MapExternalSourceEffects;

  private externalLayerInput(owned: MapOwnedOverlaySnapshot, identities: MapLayerIdentityDraft): ReturnType<typeof buildMapExternalLayers> {
    if (identities.externalStyle !== this._styleGeneration) {
      identities.externalStyle = this._styleGeneration;
      identities.external.clear();
    }
    const reserved = new Set([...owned.sources.map(source => source.id), ...owned.layers.map(layer => layer.layer.id)]);
    const available = (id: string, retained: boolean): boolean => !reserved.has(id) &&
      !reserved.has(`${id}-render`) && !reserved.has(`${id}-label`) && !reserved.has(`${id}-hit`) && !reserved.has(`${id}-hit-source`) &&
      ((!this._map?.getSource(`${id}-hit-source`) && !this._map?.getLayer(`${id}-hit`)) || this.externalFeatures?.ownsLayer(`${id}-hit`) === true) &&
      (retained || (!this._map?.getSource(id) && !this._map?.getLayer(`${id}-render`) && !this._map?.getLayer(`${id}-label`)));
    return buildMapExternalLayers(this._canonicalExternalLayers, {
      nativeId: row => {
        const previous = identities.external.get(row.sourceId);
        if (previous && available(previous, this.externalFeatures?.ownsLayer(`${previous}-render`) === true)) return previous;
        for (let index = 0; index < 512; index++) {
          const id = `lr-external-layer-${identities.nextExternal++}`;
          if (!available(id, false)) continue;
          identities.external.set(row.sourceId, id); return id;
        }
        throw new Error('Map source identity is unavailable.');
      },
      color: value => resolvedLayerColor(this, value, 'accent'),
      styleColor: value => {
        const color = resolvedMapPaintColor(this, value, true);
        if (!color) throw new Error('Map color could not be resolved.');
        return color;
      }, hidden: new Set(this.hiddenCategories),
      glyphs: this.styleProvidesGlyphs(), mutedOpacity: hiddenCategoryOpacity(this),
    });
  }

  /** A shared logical view; native resource registries continue owning all mutations. */
  private dataLayerOrderGroups(owned: MapOwnedOverlaySnapshot, external: ReturnType<typeof buildMapExternalLayers>, identities: MapLayerIdentityDraft): readonly MapLayerOrderGroup[] {
    const groups: MapLayerOrderGroup[] = [];
    for (const row of this.canonicalDataLayers) {
      const native = this.resolveDataLayerSourceId(row, identities);
      const suffixes = row.kind === 'heatmap' ? ['-heatmap'] : row.cluster
        ? ['-cluster', ...(this.styleProvidesGlyphs() ? ['-cluster-count'] : []), '-circle'] : ['-fill', '-line', '-circle'];
      if (row.kind !== 'heatmap' && row.point?.iconField && row.point.icons.length) suffixes.push('-point-icon');
      if (row.label) suffixes.push('-label');
      groups.push({ id: row.sourceId, layerIds: suffixes.map(suffix => `${native}${suffix}`), ...(row.before ? { before: row.before } : {}) });
    }
    for (const row of this._canonicalExternalLayers) {
      const source = identities.external.get(row.sourceId);
      const layerIds = external.layers.filter(entry => entry.layer['source'] === source || entry.layer['source'] === `${source}-hit-source`).map(entry => entry.layer.id);
      groups.push({ id: row.sourceId, layerIds, ...(row.before ? { before: row.before } : {}) });
    }
    for (const entry of owned.layers) groups.push({ id: entry.layer.id, layerIds: [entry.layer.id], ...(entry.before ? { before: entry.before } : {}) });
    return groups;
  }

  private nativeLayerOrder(map: MapLibreMapCapability): string[] {
    const layers = mapOwnValue(map.getStyle?.(), 'layers');
    if (!Array.isArray(layers)) return [];
    return layers.map(layer => mapOwnValue(layer, 'id')).filter((id): id is string => typeof id === 'string');
  }

  private applyDataLayerOrder(groups: readonly MapLayerOrderGroup[], current: () => boolean): void {
    const map = this._map;
    if (!map || !current()) return;
    const original = this.nativeLayerOrder(map);
    if (!current()) return;
    const present = new Set(original);
    const active = groups.map(group => ({ ...group, layerIds: group.layerIds.filter(id => present.has(id)) })).filter(group => group.layerIds.length);
    const runtime = loadMapOwnedFeatureRuntime.loaded;
    if (!runtime) throw new Error('Map layer order is unavailable.');
    const plan = runtime.planMapLayerOrder(original, active);
    if (!plan.valid || plan.operations.some(operation => operation.kind !== 'move') || plan.operations.length && !map.moveLayer) {
      throw new Error('Map layer order is unavailable.');
    }
    try {
      for (const operation of plan.operations) {
        if (!current()) return;
        map.moveLayer!(operation.id, operation.before);
        if (!current()) return;
      }
    } catch (error) {
      // Restoring only still-owned groups leaves unrelated native resources untouched.
      const members = new Set(active.flatMap(group => group.layerIds));
      for (let index = original.length - 1; index >= 0; index--) {
        if (!current()) break;
        const id = original[index]!;
        if (!members.has(id)) continue;
        try { map.moveLayer!(id, original[index + 1]); } catch { break; }
      }
      throw error;
    }
  }

  private reconcileGeneratedLayers(): Promise<void> {
    const map = this._map;
    if (!map || !this._styleLoaded) return Promise.resolve();
    // A corrected sibling input can make a rejected mixed proposal valid without changing rows.
    if (this.dataLayerIssue || this.pendingDataLayerIssue) this._canonicalDataLayersSource = UNPROJECTED_MAP_VALUE;
    this.cancelFeaturePreparation();
    if (this._map !== map || !this.isConnected) return Promise.resolve();
    this.readiness.invalidate();
    let finish!: () => void;
    const work = new Promise<void>(resolve => { finish = resolve; });
    this.featureWork = work;
    this.finishFeatureWork = finish;
    const generation = this.featureGeneration;
    const connection = this._connectGeneration;
    const styleGeneration = this._styleGeneration;
    const style = this.mapStyle;
    const dataLayers = this.dataLayers;
    const choropleth = this.choropleth;
    const overlays = this.overlays;
    const images = this.images;
    const imageProvider = this.imageProvider;
    const styleOverrides = this.styleOverrides;
    const hiddenCategories = this.hiddenCategories;
    const interactiveBasemapLayers = this.interactiveBasemapLayers;
    let ownedInput!: MapOwnedFeatureInput;
    let externalInput!: ReturnType<typeof buildMapExternalLayers>;
    let orderGroups: readonly MapLayerOrderGroup[] | undefined;
    let retainGroupOrder = false;
    let mutationStarted = false;
    let preparedExternal = false;
    let finishApplication: (() => void) | undefined;
    let settleApplication: (() => void) | undefined;
    let rejectApplication: (() => void) | undefined;
    const identities: MapLayerIdentityDraft = {
      geojson: new Map(this.plannedDataLayerIds), external: new Map(this.externalSourceIds),
      nextGeojson: this._nextDataLayerId, nextExternal: this.externalIdCounter, externalStyle: this.externalIdStyle,
    };
    const controller = new AbortController();
    this.featureAbort = controller;
    this.preparingFeatures = true;
    const current = (): boolean => this.isConnected && this._map === map &&
      generation === this.featureGeneration && connection === this._connectGeneration &&
      styleGeneration === this._styleGeneration && style === this.mapStyle &&
      dataLayers === this.dataLayers && choropleth === this.choropleth &&
      overlays === this.overlays && images === this.images && imageProvider === this.imageProvider &&
      styleOverrides === this.styleOverrides && interactiveBasemapLayers === this.interactiveBasemapLayers &&
      ((!externalInput?.sources.length && !this.externalFeatureWorkStarted) || hiddenCategories === this.hiddenCategories);
    const apply = (): void => {
      if (!current() || controller.signal.aborted) return;
      mutationStarted = true;
      this.plannedDataLayerIds.clear(); for (const [key, value] of identities.geojson) this.plannedDataLayerIds.set(key, value);
      this.externalSourceIds.clear(); for (const [key, value] of identities.external) this.externalSourceIds.set(key, value);
      this._nextDataLayerId = identities.nextGeojson; this.externalIdCounter = identities.nextExternal; this.externalIdStyle = identities.externalStyle;
      this.prepareStateRetirement(ownedInput.overlays as MapOwnedOverlaySnapshot);
      if (!current() || controller.signal.aborted) return;
      const next = this.canonicalChoropleth;
      const nextId = next ? this.resolveChoroplethSourceId(next.sourceId) : undefined;
      if (this._appliedChoroplethSourceId && this._appliedChoroplethSourceId !== nextId) this.removeChoropleth();
      // Rebuilds retain the original paint order: generated overlays sit above the choropleth.
      if (!this.withMapPaintBatch(() => {
        if (this.rebuildGeneratedLayers) {
          this.applyChoropleth();
          this.applyDataLayers(current);
          this.rebuildGeneratedLayers = false;
        } else {
          this.applyDataLayers(current);
          this.applyChoropleth();
        }
      })) return;
      const complete = (): void => {
        if (!current() || controller.signal.aborted) return;
        if (orderGroups) { this.applyDataLayerOrder(orderGroups, current); if (!current()) return; this.groupOrderActive = retainGroupOrder; }
        if (!current()) return;
        this.committedDataLayers = this._canonicalDataLayers;
        this.committedExternalLayers = this._canonicalExternalLayers;
        this.setDataLayerIssue(false);
        this.configureMapInteractions(ownedInput.overlays as MapOwnedOverlaySnapshot, externalInput);
        if (!current() || controller.signal.aborted) return;
        this.replayFeatureStates(map, current, controller.signal);
        if (!current() || controller.signal.aborted) return;
        this.featureAbort = undefined;
        this.preparingFeatures = false;
        this.syncDrawing(); this.syncMapCursor();
        if (this.pendingDrawingTheme && current()) {
          this.pendingDrawingTheme = false;
          this.drawingController?.repaint();
        }
        if (!current()) return;
        this.flushMapLoad(map);
        finish();
        this.readiness.check();
      };
      finishApplication = complete;
      const completeResources = (): void => { if (preparedExternal) settleApplication?.(); else complete(); };
      // Default optional inputs preserve the native peer's synchronous generated-layer contract.
      // Once resources have been requested, even an empty snapshot must reconcile their removal.
      const admittedOverlays = ownedInput.overlays as { readonly sources: readonly unknown[]; readonly layers: readonly unknown[] };
      if (!this.optionalFeatureWorkStarted && !this.externalFeatureWorkStarted && externalInput.sources.length === 0 && admittedOverlays.sources.length === 0 && admittedOverlays.layers.length === 0 &&
        (ownedInput.images as readonly unknown[]).length === 0 && (ownedInput.styleOverrides as readonly unknown[]).length === 0) {
        try { complete(); } catch { fail(); } return;
      }
      this.optionalFeatureWorkStarted = true;
      const failure = (): void => {
        if (preparedExternal) rejectApplication?.();
        else if (current() && !controller.signal.aborted) fail();
      };
      const external = this.externalFeatureWorkStarted || externalInput.sources.length > 0;
      if (external) this.externalFeatureWorkStarted = true;
      // Native resource ownership loads on demand, inside this same feature transaction.
      const reconcileOwned = ({ MapOwnedFeatures }: NonNullable<typeof loadMapOwnedFeatureRuntime.loaded>): void => {
        if (!current() || controller.signal.aborted) return;
        const owned = this.ownedFeatures ??= new MapOwnedFeatures();
        const applyOwned = (): Promise<void> => owned.reconcile(map, styleGeneration, ownedInput, {
          owner: this, signal: controller.signal, isCurrent: current,
          beforeSourceChange: change => { this.featureStates?.refreshNative('overlay', change.id); },
          isGeneratedLayer: id => this.externalFeatures?.ownsLayer(id) === true || id === this._appliedFillLayerId || [...this._appliedDataLayerIds.values()]
            .some(sourceId => DATA_LAYER_SUFFIXES.some(suffix => id === `${sourceId}${suffix}`)),
          resolve: (value, property) => this.resolveStyleOverride(value, property),
          styleLayers: () => this._styleLayers,
        });
        if (external) {
          const applyExternal = (): Promise<void> => (this.externalFeatures ??= new MapOwnedFeatures()).reconcile(map, styleGeneration,
            { overlays: { sources: externalInput.sources, layers: externalInput.layers }, images: [], styleOverrides: [] }, {
            owner: this, signal: controller.signal, isCurrent: current, isGeneratedLayer: () => false,
            beforeSourceChange: change => { this.featureStates?.refreshNative('data-layer', change.id); },
            resolve: value => value,
          });
          const iconSymbols = this._canonicalExternalLayers.some(row => Boolean(row.style?.iconIds.length));
          const run = iconSymbols
            ? applyOwned().then(() => current() && !controller.signal.aborted ? applyExternal() : undefined)
            : applyExternal().then(() => current() && !controller.signal.aborted ? applyOwned() : undefined);
          void run.then(completeResources).catch(failure);
        } else void applyOwned().then(completeResources).catch(failure);
      };
      const runtime = loadMapOwnedFeatureRuntime.loaded;
      if (runtime) reconcileOwned(runtime);
      else void loadMapOwnedFeatureRuntime().then(reconcileOwned).catch(failure);
    };
    const fail = (): void => {
      if (!current()) return;
      this.preparingFeatures = false;
      finish();
      if (!mutationStarted && this.mapLoadEmitted && !this.pendingMapLoad) {
        this._canonicalDataLayers = this.committedDataLayers;
        this._canonicalExternalLayers = this.committedExternalLayers;
        this.setDataLayerIssue(true);
        this.readiness.check();
        return;
      }
      this.readiness.fail();
      if (!this.mapLoadEmitted || this.pendingMapLoad) { this.failInitialization('initialization-failed'); return; }
      this.scheduleAfterUpdate(() => {
        if (current()) this.failInitialization('initialization-failed');
      }, `map-feature-failure-${generation}`);
    };
    const begin = (input: MapOwnedFeatureInput): void => {
      this.syncPaintTheme();
      if (!current() || controller.signal.aborted) { finish(); return; }
      const runtime = loadMapOwnedFeatureRuntime.loaded;
      const owned = runtime ? runtime.resolveMapOwnedOverlayPaint(input.overlays as MapOwnedOverlaySnapshot,
        (value, property) => this.resolveStyleOverride(value, property)) : input.overlays as MapOwnedOverlaySnapshot;
      ownedInput = { ...input, overlays: owned };
      // Allocate namespaces only in this transaction; rejected proposals cannot retarget accepted state.
      const reserved = new Set([...owned.sources.map(source => source.id), ...owned.layers.map(entry => entry.layer.id)]);
      for (const row of this.canonicalDataLayers) {
        const id = this.resolveDataLayerSourceId(row, identities);
        if (reserved.has(id) || DATA_LAYER_SUFFIXES.some(suffix => reserved.has(`${id}${suffix}`))) throw new Error('Map resource identity conflicts.');
      }
      externalInput = this.externalLayerInput(owned, identities);
      if (!current() || controller.signal.aborted) { finish(); return; }
      retainGroupOrder = this.canonicalDataLayers.some(row => row.before !== undefined) ||
        this._canonicalExternalLayers.some(row => row.before !== undefined) || owned.layers.some(row => row.before !== undefined);
      if (this.groupOrderActive || retainGroupOrder) {
        if (!runtime || typeof map.getStyle !== 'function' || typeof map.moveLayer !== 'function') throw new Error('Map layer order is unavailable.');
        orderGroups = this.dataLayerOrderGroups(owned, externalInput, identities);
        const planned = runtime.planMapLayerOrder(this.nativeLayerOrder(map), orderGroups);
        if (!planned.valid) throw new Error('Map layer order is invalid.');
        if (planned.diagnostics.some(issue => issue.code === 'missing-anchor')) devWarnOnce('lyra-map-missing-layer-anchor', `<${this.localName}>: a missing layer anchor appends its group.`);
        if (!current()) { finish(); return; }
        // Existing registries receive concrete anchors; a final guarded group plan resolves forward cross-owner edges.
        const anchors = new Map(orderGroups.map(group => [group.id, group.layerIds[0]!]));
        for (const group of orderGroups) for (const id of group.layerIds) if (!anchors.has(id)) anchors.set(id, group.layerIds[0]!);
        const translate = (entry: LyraMapOverlayLayer): LyraMapOverlayLayer => entry.before && anchors.has(entry.before)
          ? { ...entry, before: anchors.get(entry.before)! } : entry;
        ownedInput = { ...ownedInput, overlays: { sources: owned.sources, layers: owned.layers.map(translate) } };
        externalInput = { ...externalInput, layers: externalInput.layers.map(translate) };
      }
      const preflight = (): void => {
        // Count actual source URLs, concrete anchors and resolved/compiled paint together.
        const finalOwned = ownedInput.overlays as MapOwnedOverlaySnapshot;
        if (externalInput.sources.length || finalOwned.sources.length || finalOwned.layers.length) {
          if (!runtime) throw new Error('Map resources are unavailable.');
          runtime.snapshotMapOwnedFeatureInput({ overlays: {
            sources: [...finalOwned.sources, ...externalInput.sources], layers: [...finalOwned.layers, ...externalInput.layers],
          }, images: ownedInput.images, styleOverrides: ownedInput.styleOverrides });
        }
        if (this.canonicalDataLayers.some(row => row.placementRequested) && typeof map.setLayerZoomRange !== 'function') {
          throw new Error('Map layer bounds are unavailable.');
        }
      };
      const prepare = (): Promise<void> | undefined => {
        if (!current() || controller.signal.aborted || typeof map.prepareFeatures !== 'function') return;
        const requirements = this.generatedFeatureRequirements();
        const signature = JSON.stringify([
          Object.values(requirements.sources ?? {}).map(source => (source as { type: string; cluster?: boolean }).type),
          (requirements.layers ?? []).map(layer => (layer as { type: string }).type),
        ]);
        if (signature === this.preparedFeatureSignature) return;
        return map.prepareFeatures(requirements, { signal: controller.signal }).then(() => {
          if (current() && !controller.signal.aborted) this.preparedFeatureSignature = signature;
        });
      };
      if (externalInput.sources.length || this.externalFeatureWorkStarted) {
        if (!runtime) throw new Error('Map resources are unavailable.');
        const effects = this.externalSourceEffects ??= new runtime.MapExternalSourceEffects();
        const revisions = new Map(this._canonicalExternalLayers.filter(row => row.kind === 'canvas').map(row =>
          [identities.external.get(row.sourceId)!, row.redrawRevision ?? 0] as const));
        const live = () => this.isConnected && this._map === map && this._styleGeneration === styleGeneration &&
          this._connectGeneration === connection && this.mapStyle === style;
        void effects.reconcile(map, styleGeneration, externalInput.sources, revisions, {
          owner: this, signal: controller.signal, isCurrent: current, isLive: live,
          canPauseCanvas: id => {
            void this.canonicalDataLayers;
            return !this.invalidDataLayerModel && this._canonicalExternalLayers.some(row =>
              row.kind === 'canvas' && this.externalSourceIds.get(row.sourceId) === id && row.source['animate'] === false);
          },
          retire: () => { if (live()) this.failInitialization('initialization-failed'); },
        }, () => new Promise<void>((resolve, reject) => {
          const aborted = (): void => { reject(new Error('Map resource application was superseded.')); };
          const clear = (): void => { controller.signal.removeEventListener('abort', aborted); };
          preparedExternal = true;
          settleApplication = () => { clear(); resolve(); };
          rejectApplication = () => { clear(); reject(new Error('Map resources could not be applied.')); };
          controller.signal.addEventListener('abort', aborted, { once: true });
          if (controller.signal.aborted) { clear(); aborted(); return; }
          try { apply(); } catch (error) { clear(); reject(error); }
        }), async sources => {
          externalInput = { ...externalInput, sources };
          preflight();
          await prepare();
        }).then(() => { if (current() && !controller.signal.aborted) finishApplication?.(); }).catch(() => {
          if (current() && !controller.signal.aborted) fail();
        });
        return;
      }
      preflight();
      if (!current() || controller.signal.aborted) { finish(); return; }
      const preparation = prepare();
      if (preparation) void preparation.then(apply).catch(() => { if (current() && !controller.signal.aborted) fail(); });
      else apply();
    };
    try {
      const geojson = this.canonicalDataLayers;
      if (this.invalidDataLayerModel || geojson.some(layer => layer.invalidLabel) ||
        (geojson.some(layer => layer.label !== undefined) && !this.styleProvidesGlyphs())) throw new Error('Map labels or sources are unavailable.');
      // Empty defaults stay synchronous; other resources and basemap opt-ins are admitted by the
      // ownership runtime, loaded once on demand inside this same feature transaction.
      const runtime = loadMapOwnedFeatureRuntime.loaded;
      if (runtime) begin(runtime.snapshotMapOwnedFeatureInput({ overlays, images, styleOverrides }));
      else if (!this._canonicalExternalLayers.length && !this.groupOrderActive && !geojson.some(layer => layer.before !== undefined) &&
        !ownedFeaturesRequested(overlays, images, styleOverrides) && !projectMapBasemapInteractions(interactiveBasemapLayers)?.length) begin(NO_OWNED_FEATURES);
      else void loadMapOwnedFeatureRuntime().then(loaded => {
        if (current() && !controller.signal.aborted) begin(loaded.snapshotMapOwnedFeatureInput({ overlays, images, styleOverrides }));
      }).catch(fail);
    } catch { fail(); }
    return work;
  }

  private resolveStyleOverride(value: LyraMapStyleValue, property: string): LyraMapStyleValue {
    if (!/(?:-color|-gradient)$/u.test(property)) return value;
    const resolve = (entry: LyraMapStyleValue): LyraMapStyleValue => {
      if (typeof entry === 'string' && THEME_PAINT_COLOR.test(entry)) {
        // Engines parse only sRGB notations, so tokens and modern color functions resolve against
        // this host and convert to sRGB; the theme watcher re-resolves them after a theme change.
        const color = resolvedMapPaintColor(this, entry, true);
        if (!color) throw new Error('Map color could not be resolved.');
        return color;
      }
      if (Array.isArray(entry)) return entry[0] === 'literal' ? entry : entry.map(resolve);
      if (entry !== null && typeof entry === 'object') return Object.fromEntries(
        Object.entries(entry).map(([key, child]) => [key, resolve(child as LyraMapStyleValue)]),
      );
      return entry;
    };
    return resolve(value);
  }

  private appliedChoroplethPaintKey?: string;
  private applyChoropleth(): void {
    if (!this._map) return;
    this.syncPaintTheme();
    const choropleth = this.canonicalChoropleth;
    if (!choropleth) {
      this.removeChoropleth();
      return;
    }
    const { geojson, geojsonProjection, stops } = choropleth;
    const sourceId = this.resolveChoroplethSourceId(choropleth.sourceId);
    const fillLayerId = `${sourceId}-fill`;

    if (this._appliedChoroplethSourceId && this._appliedChoroplethSourceId !== sourceId) {
      this.removeChoropleth();
    }

    warnOnUntileableProperties(geojsonProjection, 'choropleth');
    const existingSource = this._map.getSource(sourceId) as MapLibreGeoJsonSource | undefined;
    if (existingSource) {
      // Re-apply the data even if the color expression below ends up skipped:
      // `geojson` may have changed even though `sourceId`/`stops` didn't.
      this.pushGeoJson(existingSource, sourceId, geojson, geojsonProjection);
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
      this._appliedGeoJson.set(sourceId, geojsonProjection);
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

    const {geojson: _geojson, geojsonProjection: _projection, ...paint} = choropleth;
    const paintKey = JSON.stringify(paint);
    if (this.appliedChoroplethPaintKey === paintKey && this._map.getLayer(fillLayerId)) return;
    const colorExpr = this.choroplethColorExpression(choropleth);
    const outlineExpr = this.choroplethOutlineExpression(choropleth, colorExpr);
    if (this._map.getLayer(fillLayerId)) {
      this.setMapPaint(fillLayerId, 'fill-color', colorExpr as never);
      this.setMapPaint(fillLayerId, 'fill-opacity', choroplethFillOpacity(this));
      this.setMapPaint(fillLayerId, 'fill-outline-color', (outlineExpr ?? null) as never);
    } else {
      this._map.addLayer({
        id: fillLayerId,
        type: 'fill',
        source: sourceId,
        paint: {
          'fill-color': colorExpr as never,
          'fill-opacity': choroplethFillOpacity(this),
          ...(outlineExpr ? { 'fill-outline-color': outlineExpr as never } : {}),
        },
      });
    }
    this.appliedChoroplethPaintKey = paintKey;
    this._appliedFillLayerId = fillLayerId;
  }

  private choroplethColorExpression(choropleth: CanonicalMapChoropleth): unknown[] {
    const { field, stops } = choropleth;
    // `['step', input, base, threshold, color, …]` -- discrete bands, not a ramp. The base output
    // (values below the first threshold) defaults to the first stop's own color, so a legend whose
    // first band starts at the data minimum needs no extra configuration.
    const resolvedStops = stops.map(
      ([value, color]) => [value, resolvedLayerColor(this, color, undefined)] as const,
    );
    let colorExpr: unknown[];
    if (choropleth.interpolation === 'step') {
      const base =
        choropleth.stepBaseColor
          ? resolvedLayerColor(this, choropleth.stepBaseColor, undefined)
          : resolvedStops[0]![1];
      colorExpr = ['step', ['get', field], base];
      for (const [value, color] of resolvedStops) colorExpr.push(value, color);
    } else {
      // `stops` stay in the data's own units under either interpolation, so a consumer never has to
      // pre-transform values to log10 and then hand-relabel the legend back into real units.
      const interpolationExpr =
        choropleth.interpolation === 'logarithmic'
          ? ['exponential', CHOROPLETH_LOG_INTERPOLATION_BASE]
          : ['linear'];
      colorExpr = ['interpolate', interpolationExpr, ['get', field]];
      for (const [value, color] of resolvedStops) colorExpr.push(value, color);
    }

    // A feature whose value is missing, null or not a number would make the expression above fail
    // to evaluate and go unpainted, so an authored no-data paint takes those features instead.
    const noData = choropleth.noData;
    if (!noData) return colorExpr;
    return ['case', choroplethHasValueExpression(field), colorExpr, this.choroplethNoDataColor(noData)];
  }

  private choroplethNoDataColor(noData: CanonicalChoroplethNoData): string {
    return resolvedLayerColor(this, noData.color, 'neutral');
  }

  /** Outline paint, or `undefined` when no-data features have no distinct outline. */
  private choroplethOutlineExpression(
    choropleth: CanonicalMapChoropleth,
    colorExpr: unknown[],
  ): unknown[] | undefined {
    const stroke = choropleth.noData?.strokeColor;
    if (!stroke) return undefined;
    const resolved = resolvedMapPaintColor(this, stroke, true);
    if (!resolved) return undefined;
    // Other features keep MapLibre's default outline, which is their own fill color.
    return ['case', choroplethHasValueExpression(choropleth.field), colorExpr, resolved];
  }

  /**
   * Keeps the choropleth out of caller-controlled data-layer and existing native resource
   * namespaces, including registered overlays. Its own applied IDs remain reusable. Repeatedly
   * prefixing is intentional: a consumer may legitimately supply both `shared` and
   * `lr-choropleth-shared`, so a single conditional prefix is not sufficient.
   */
  private resolveChoroplethSourceId(sourceId: string): string {
    const dataSourceIds = new Set(this.canonicalDataLayers.map((layer) => layer.sourceId));
    let resolved = sourceId;
    for (let attempt = 0; attempt < 512; attempt += 1) {
      const sourceTaken = resolved !== this._appliedChoroplethSourceId && Boolean(this._map?.getSource(resolved));
      const fillId = `${resolved}-fill`;
      const fillTaken = fillId !== this._appliedFillLayerId && Boolean(this._map?.getLayer(fillId));
      if (!dataSourceIds.has(resolved) && !sourceTaken && !fillTaken) return resolved;
      resolved = `lr-choropleth-${resolved}`;
    }
    throw new Error('Map source namespace is unavailable.');
  }

  /** Removes whatever choropleth layer/source is currently applied, if any. */
  private removeChoropleth(): void {
    if (!this._map || !this._appliedChoroplethSourceId) return;
    this.featureStates?.refreshNative('choropleth', this._appliedChoroplethSourceId);
    if (this._appliedFillLayerId && this._map.getLayer(this._appliedFillLayerId)) {
      this.removeMapLayer(this._appliedFillLayerId);
    }
    if (this._map.getSource(this._appliedChoroplethSourceId)) {
      this._map.removeSource(this._appliedChoroplethSourceId);
    }
    // Forget the tracked GeoJSON too: a re-added source starts from whatever `addSource` was given,
    // so diffing a later update against the torn-down source's data would skip real changes.
    this._appliedGeoJson.delete(this._appliedChoroplethSourceId);
    this._appliedChoroplethSourceId = undefined;
    this._appliedFillLayerId = undefined;
    this.appliedChoroplethPaintKey = undefined;
  }

  /**
   * Applies every `dataLayers` entry as a GeoJSON source plus fill/line/circle
   * layers, reusing an existing source/layer in place (via `setData()`/
   * `setPaintProperty()`) when its id is already applied, and removing any
   * previously-applied id no longer present in `dataLayers` -- mirrors
   * `applyChoropleth()`'s add-or-update-in-place pattern above.
   */
  private readonly appliedLayerPaintKeys = new Map<string, string>();

  private readonly appliedRowRanges = new Map<string, string>();

  private applyDataLayers(transactionCurrent?: () => boolean): void {
    if (!this._map) return;
    const map = this._map, dataLayers = this.dataLayers, style = this.mapStyle, generation = this.featureGeneration;
    const current = transactionCurrent ?? (() => this.isConnected && this._map === map && dataLayers === this.dataLayers &&
      style === this.mapStyle && generation === this.featureGeneration);
    const check = (): void => { if (!current()) throw new DOMException('Map update superseded.', 'AbortError'); };
    check();
    this.syncPaintTheme();
    const layers = this.canonicalDataLayers;
    const nextIds = new Set(layers.map((layer) => layer.sourceId));
    for (const publicSourceId of this._appliedDataLayerIds.keys()) {
      if (!nextIds.has(publicSourceId)) this.removeDataLayer(publicSourceId);
    }
    for (const layer of layers) {
      check();
      const { sourceId: publicSourceId, geojson, geojsonProjection } = layer;
      const shape = dataLayerShape(layer);
      const appliedShape = this._appliedDataLayerShapes.get(publicSourceId);
      // A source's cluster options cannot be mutated after `addSource()`, and a kind change swaps
      // the whole layer set, so a changed shape tears this entry down and rebuilds it (see
      // `_appliedDataLayerShapes`). Every other update still reuses its source and layers.
      const sourceId = this.resolveDataLayerSourceId(layer);
      if (appliedShape !== undefined && appliedShape !== shape) this.removeDataLayer(publicSourceId);
      warnOnUntileableProperties(geojsonProjection, publicSourceId);
      const cluster = layer.cluster;
      const existingSource = this._map.getSource(sourceId) as MapLibreGeoJsonSource | undefined;
      check();
      if (existingSource) {
        this.pushGeoJson(existingSource, sourceId, geojson, geojsonProjection);
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
        check();
        this._appliedGeoJson.set(sourceId, geojsonProjection);
      }
      check();
      const { geojson: _geojson, geojsonProjection: _projection, ...paint } = layer;
      const paintKey = JSON.stringify(paint);
      if (!existingSource || this.appliedLayerPaintKeys.get(sourceId) !== paintKey) {
        this.applyDataLayerRendering(sourceId, layer, current);
        check();
        this.applyDataLayerRange(sourceId, layer, current);
        check();
        this.appliedLayerPaintKeys.set(sourceId, paintKey);
      }
      this._appliedDataLayerIds.set(publicSourceId, sourceId);
      this._appliedDataLayerShapes.set(publicSourceId, shape);
    }
  }

  /** Apply bounds to every installed member, retaining native source and layer identity. */
  private applyDataLayerRange(sourceId: string, layer: CanonicalMapDataLayer, current: () => boolean): void {
    const map = this._map;
    if (!map || !layer.placementRequested && !this.appliedRowRanges.has(sourceId)) return;
    const changes: { id: string; min: number; max: number; oldMin: number; oldMax: number }[] = [];
    for (const suffix of DATA_LAYER_SUFFIXES) {
      const id = `${sourceId}${suffix}`, native = map.getLayer(id);
      if (!current()) throw new DOMException('Map update superseded.', 'AbortError');
      if (!native) continue;
      const min = Math.max(layer.minZoom, suffix === '-label' ? layer.label?.minZoom ?? 0 : 0), max = layer.maxZoom;
      const rawMin = mapOwnValue(native, 'minzoom'), rawMax = mapOwnValue(native, 'maxzoom');
      const oldMin = typeof rawMin === 'number' ? rawMin : 0, oldMax = typeof rawMax === 'number' ? rawMax : 24;
      if (min !== oldMin || max !== oldMax) changes.push({ id, min, max, oldMin, oldMax });
    }
    if (changes.length && typeof map.setLayerZoomRange !== 'function') throw new Error('Map layer bounds are unavailable.');
    const journal: typeof changes = [];
    try {
      for (const change of changes) {
        if (!current()) throw new DOMException('Map update superseded.', 'AbortError');
        journal.push(change);
        map.setLayerZoomRange!(change.id, change.min, change.max);
        if (!current()) throw new DOMException('Map update superseded.', 'AbortError');
      }
      this.appliedRowRanges.set(sourceId, `${layer.minZoom}:${layer.maxZoom}`);
    } catch (error) {
      for (const change of journal.reverse()) {
        if (!current()) break;
        try { map.setLayerZoomRange!(change.id, change.oldMin, change.oldMax); } catch { break; }
      }
      throw error;
    }
  }

  /**
   * Adds (or repaints, when already present) the layers one entry's kind calls for. Kept separate
   * from source management above so a theme change can re-run exactly the paint half of it without
   * touching sources, data, or map geometry.
   */
  private applyDataLayerRendering(sourceId: string, layer: CanonicalMapDataLayer, current: () => boolean): void {
    if (layer.kind === 'heatmap') {
      this.applyHeatmapLayer(sourceId, layer);
      return;
    }
    const cluster = layer.cluster;
    if (cluster) {
      this.applyClusterLayers(sourceId, layer, cluster);
    } else {
      this.applyGeometryLayers(sourceId, layer);
    }
    if (!current()) throw new DOMException('Map update superseded.', 'AbortError');
    this.applyPointIcons(sourceId, layer);
    if (!current()) throw new DOMException('Map update superseded.', 'AbortError');
    this.applyGeoLabel(sourceId, layer, current);
  }

  /**
   * Rewrites only the token-derived paint of an already-applied entry, for the kind it was applied
   * with. Split from the add-or-update path above because a theme repaint must never query or
   * mutate map structure -- no `getLayer`, no `addLayer`, no source touch -- so that a retheme
   * cannot re-tile data or resurrect a layer a later reconciliation removed.
   */
  private paintDataLayer(sourceId: string, layer: CanonicalMapDataLayer): void {
    if (layer.kind === 'heatmap') {
      this.paintHeatmapLayer(sourceId, layer);
      return;
    }
    const cluster = layer.cluster;
    if (cluster) {
      this.paintClusterLayers(sourceId, layer, cluster);
    } else {
      this.paintGeometryLayers(sourceId, layer);
    }
    this.paintPointIcons(sourceId, layer);
    if (layer.label && this.appliedGeoLabels.has(sourceId)) {
      const descriptor = buildMapLabelLayer(`${sourceId}-label`, sourceId, layer.label, value => resolvedLayerColor(this, value, layer.tone));
      for (const [property, value] of Object.entries(descriptor['paint'] as Record<string, unknown>)) this.setMapPaint(descriptor.id, property, value);
    }
  }

  private applyGeoLabel(sourceId: string, layer: CanonicalMapDataLayer, current: () => boolean): void {
    const map = this._map;
    if (!map) return;
    const check = (): void => { if (!current()) throw new DOMException('Map update superseded.', 'AbortError'); };
    check();
    const id = `${sourceId}-label`;
    const existing = map.getLayer(id);
    check();
    if (!layer.label) {
      this.appliedGeoLabels.delete(sourceId);
      if (existing) { map.removeLayer(id); check(); }
      return;
    }
    const descriptor = buildMapLabelLayer(id, sourceId, layer.label, value => resolvedLayerColor(this, value, layer.tone));
    const native: LyraMapOverlayLayer['layer'] = layer.cluster ? { ...descriptor, filter: ['all', ['!', ['has', 'point_count']], ['==', ['geometry-type'], 'Point']] } : descriptor;
    const key = JSON.stringify(native);
    if (this.appliedGeoLabels.get(sourceId) === key) return;
    const previousKey = this.appliedGeoLabels.get(sourceId);
    if (existing && previousKey && typeof map.setLayoutProperty === 'function' &&
      typeof map.setFilter === 'function' && typeof map.setLayerZoomRange === 'function') {
      const previous = JSON.parse(previousKey) as Record<string, unknown>;
      const journal: (() => void)[] = [];
      const write = (apply: () => void, restore: () => void): void => {
        if (!current()) throw new DOMException('Map update superseded.', 'AbortError');
        // A callback may replace the proposal after changing native state; do not retain a success key.
        this.appliedGeoLabels.delete(sourceId);
        journal.push(restore); apply();
        if (!current()) throw new DOMException('Map update superseded.', 'AbortError');
      };
      try {
        for (const kind of ['layout', 'paint'] as const) {
          const before = (previous[kind] ?? {}) as Record<string, unknown>;
          const after = (native[kind] ?? {}) as Record<string, unknown>;
          for (const property of new Set([...Object.keys(before), ...Object.keys(after)])) {
            if (JSON.stringify(before[property]) === JSON.stringify(after[property])) continue;
            const setter = kind === 'layout' ? map.setLayoutProperty! : map.setPaintProperty;
            write(() => { setter.call(map, id, property, after[property] ?? null); },
              () => { setter.call(map, id, property, before[property] ?? null); });
          }
        }
        if (JSON.stringify(previous['filter']) !== JSON.stringify(native['filter'])) {
          write(() => { map.setFilter!(id, native['filter'] ?? null); }, () => { map.setFilter!(id, previous['filter'] ?? null); });
        }
        if (previous['minzoom'] !== native['minzoom']) {
          write(() => { map.setLayerZoomRange!(id, Math.max(layer.minZoom, layer.label!.minZoom), layer.maxZoom); },
            () => { map.setLayerZoomRange!(id, typeof previous['minzoom'] === 'number' ? previous['minzoom'] : 0, layer.maxZoom); });
        }
        if (!current()) throw new DOMException('Map update superseded.', 'AbortError');
      } catch (error) {
        for (const restore of journal.reverse()) { if (!current()) break; try { restore(); } catch { break; } }
        throw error;
      }
    } else {
      if (existing) { map.removeLayer(id); check(); }
      map.addLayer(native); check();
    }
    this.appliedGeoLabels.set(sourceId, key);
  }

  /** The pre-existing geometry split: polygons filled, lines/outlines stroked, points circled. */
  private applyGeometryLayers(sourceId: string, layer: CanonicalMapDataLayer): void {
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
        paint: {
          'line-color': this.lineColor(layer), 'line-width': layer.line?.width ?? 2,
          ...(layer.line ? { 'line-opacity': layer.line.opacity } : {}),
        },
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
    this.setMapPaint(lineId, 'line-width', layer.line?.width ?? 2);
    this.setMapPaint(lineId, 'line-opacity', layer.line?.opacity ?? 1);
    this.paintGeometryLayers(sourceId, layer);
  }

  /** Paint-only half of `applyGeometryLayers`. See `paintDataLayer` for why the halves are split. */
  private paintGeometryLayers(sourceId: string, layer: CanonicalMapDataLayer): void {
    if (!this._map) return;
    const tone = layer.tone;
    const color = resolvedLayerColor(this, layer.color, tone);
    this.setMapPaint(`${sourceId}-fill`, 'fill-color', color);
    this.setMapPaint(`${sourceId}-fill`, 'fill-opacity', choroplethFillOpacity(this));
    this.setMapPaint(`${sourceId}-line`, 'line-color', this.lineColor(layer));
    this.paintPoints(sourceId, layer);
  }

  private lineColor(layer: CanonicalMapDataLayer): string | unknown[] {
    const fallback = resolvedLayerColor(this, layer.strokeColor ?? layer.color, layer.tone);
    const line = layer.line;
    if (!line?.field || line.stops.length < 2) return fallback;
    return lineColorExpression(
      line.field,
      line.stops.map(([value, color]) => [value, resolvedLayerColor(this, color, layer.tone)] as const),
      fallback,
    );
  }

  /**
   * A `match` expression over `['get', field]` while any admitted category is hidden; a literal
   * `1` on the first paint after the last category is un-hidden; and `undefined` whenever nothing
   * is or was muted on `layerId` -- which is what leaves a `legendInteractive`-unset map
   * byte-identical: the paint key is never written, so MapLibre keeps its own default and the
   * layer's paint object gains no extra property.
   *
   * The flat `label, output` pair form is deliberately the shape `point.colors` already emits two
   * lines above its own `match`, so this file speaks one expression idiom rather than two.
   */
  private mutedPointOpacity(layerId: string, field: string | undefined): number | unknown[] | undefined {
    const muted = field ? this.hiddenCategories : EMPTY_HIDDEN_CATEGORIES;
    if (!muted.length) {
      if (!this.appliedPointMuting.delete(layerId)) return undefined;
      return 1;
    }
    this.appliedPointMuting.add(layerId);
    const dim = hiddenCategoryOpacity(this);
    return mutedCategoryOpacityExpression(field!, muted, dim);
  }

  private paintPoints(sourceId: string, layer: CanonicalMapDataLayer): void {
    if (!this._map) return;
    const point = layer.point;
    const fallback = resolvedLayerColor(this, layer.strokeColor ?? layer.color, layer.tone);
    const color = pointColorExpression(
      point?.field,
      point?.field && point.colors.length
        ? point.colors.map(([value, paint]) => [value, resolvedLayerColor(this, paint, layer.tone)] as const)
        : [],
      fallback,
    );
    const id = `${sourceId}-circle`;
    this.setMapPaint(id, 'circle-color', color);
    // Before the early return below: an un-mute must still land on a layer whose `point` options
    // were removed in the same update, which is the one case that return would otherwise skip.
    const opacity = this.mutedPointOpacity(id, point?.field);
    if (opacity !== undefined) {
      this.setMapPaint(id, 'circle-opacity', opacity);
      this.setMapPaint(id, 'circle-stroke-opacity', opacity);
    }
    if (!point && !this.appliedPointPaint.has(sourceId)) return;
    this.setMapPaint(id, 'circle-radius', pointRadiusExpression(point?.radius ?? 5));
    this.setMapPaint(id, 'circle-stroke-width', point?.strokeWidth ?? 0);
    this.setMapPaint(id, 'circle-stroke-color', point?.strokeColor
      ? resolvedLayerColor(this, point.strokeColor, layer.tone) : fallback);
    if (point) this.appliedPointPaint.add(sourceId);
    else this.appliedPointPaint.delete(sourceId);
  }

  /**
   * Unlike `resolvedLayerColor()`'s other ~16 call sites (all MapLibre `setPaintProperty` /
   * style-spec sinks), this result reaches a raw 2D canvas context's `fillStyle`/`strokeStyle` in
   * `rasterPointIcon()`. Canvas silently keeps its prior paint (opaque black on a fresh context)
   * when handed an unparseable string, so the resolved candidate is routed through the shared
   * `resolveCanvasColor()` DOM probe -- same as heatmap/audio-visualizer -- falling back to the
   * layer's theme-appropriate tone instead of silently rendering a black icon.
   */
  private pointIconColor(layer: CanonicalMapDataLayer): string {
    const resolved = resolvedLayerColor(
      this, layer.point?.iconColor ?? `var(${ON_TONE_TOKEN[layer.tone ?? 'accent']})`, layer.tone,
    );
    return resolveCanvasColor(this, resolved, dataLayerColor(this, layer.tone));
  }

  private removePointIcons(sourceId: string): void {
    const applied = this.appliedPointIcons.get(sourceId);
    if (!applied || !this._map) return;
    const id = `${sourceId}-point-icon`;
    if (this._map.getLayer(id)) this.removeMapLayer(id);
    for (const { id: imageId } of applied.icons) {
      if (this._map.hasImage?.(imageId)) this._map.removeImage?.(imageId);
    }
    this.appliedPointIcons.delete(sourceId);
    this.appliedPointMuting.delete(id);
  }

  private applyPointIcons(sourceId: string, layer: CanonicalMapDataLayer): void {
    const map = this._map;
    const point = layer.point;
    const signature = JSON.stringify([point?.iconField, point?.iconSize, point?.icons]);
    if (this.appliedPointIcons.get(sourceId)?.signature === signature) {
      this.paintPointIcons(sourceId, layer);
      return;
    }
    this.removePointIcons(sourceId);
    if (!point?.iconField || !point.icons.length || !map ||
      typeof map.addImage !== 'function' || typeof map.hasImage !== 'function' ||
      typeof map.updateImage !== 'function' || typeof map.removeImage !== 'function') return;
    const color = this.pointIconColor(layer);
    const icons: { id: string; icon: CanonicalPointIcon }[] = [];
    // Track ownership before allocating so teardown can also clean up a partially failed peer call.
    this.appliedPointIcons.set(sourceId, { signature, color, icons });
    for (const icon of point.icons) {
      const raster = rasterPointIcon(this, icon, color);
      if (!raster) continue;
      let id: string;
      do { id = `lr-point-icon-${this.nextPointIconId++}`; } while (map.hasImage(id));
      icons.push({ id, icon });
      map.addImage(id, raster, { pixelRatio: 2 });
    }
    if (!icons.length) return;
    map.addLayer({ id: `${sourceId}-point-icon`, type: 'symbol', source: sourceId,
      filter: layer.cluster
        ? ['all', ['==', ['geometry-type'], 'Point'], ['!', ['has', 'point_count']]]
        : ['==', ['geometry-type'], 'Point'],
      layout: {
        'icon-image': ['match', ['get', point.iconField], ...icons.flatMap(({ id, icon }) => [icon.value, id]), ''],
        'icon-size': point.iconSize / (POINT_ICON_RASTER_SIZE / 2),
        'icon-allow-overlap': true, 'icon-ignore-placement': true,
      },
    });
  }

  private paintPointIcons(sourceId: string, layer: CanonicalMapDataLayer): void {
    const applied = this.appliedPointIcons.get(sourceId);
    if (!applied) return;
    // Before the unchanged-color early return below, or a re-toggle at an unchanged theme would
    // silently never reach the muting write.
    const iconLayerId = `${sourceId}-point-icon`;
    const opacity = this.mutedPointOpacity(iconLayerId, layer.point?.iconField);
    if (opacity !== undefined) this.setMapPaint(iconLayerId, 'icon-opacity', opacity);
    const color = this.pointIconColor(layer);
    if (color === applied.color) return;
    for (const { id, icon } of applied.icons) {
      const raster = rasterPointIcon(this, icon, color);
      if (raster) this._map?.updateImage?.(id, raster);
    }
    applied.color = color;
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
    layer: CanonicalMapDataLayer,
    cluster: NormalizedClusterOptions,
  ): unknown[] | string {
    const tone = layer.tone;
    return clusterColorExpression(
      cluster.colorSteps.map(([count, stepColor]) =>
        [count, resolvedLayerColor(this, stepColor, tone)] as const),
      () => resolvedLayerColor(this, layer.color, tone),
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
    layer: CanonicalMapDataLayer,
    cluster: NormalizedClusterOptions,
  ): void {
    if (!this._map) return;
    const tone = layer.tone;
    const stroke = resolvedClusterStrokeColor(this, cluster.strokeColor, layer);
    const clusterId = `${sourceId}-cluster`;
    const countId = `${sourceId}-cluster-count`;
    const circleId = `${sourceId}-circle`;
    const clusterColor = this.clusterColorExpression(layer, cluster);
    const clusterRadius = stepExpression(['get', 'point_count'], cluster.radiusSteps);
    const countColor = resolvedClusterCountColor(this, cluster.countColor)
      ?? resolvedLayerColor(this, `var(${ON_TONE_TOKEN[tone ?? 'accent']})`, tone);
    const countHaloColor = resolvedClusterCountColor(this, cluster.countHaloColor);
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
        paint: {
          'text-color': countColor,
          ...(countHaloColor ? {
            'text-halo-color': countHaloColor,
            'text-halo-width': cluster.countHaloWidth,
          } : {}),
        },
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
    layer: CanonicalMapDataLayer,
    cluster: NormalizedClusterOptions,
  ): void {
    if (!this._map) return;
    const tone = layer.tone;
    const stroke = resolvedClusterStrokeColor(this, cluster.strokeColor, layer);
    const clusterId = `${sourceId}-cluster`;
    this.setMapPaint(clusterId, 'circle-color', this.clusterColorExpression(layer, cluster));
    this.setMapPaint(
      clusterId,
      'circle-radius',
      stepExpression(['get', 'point_count'], cluster.radiusSteps),
    );
    this.setMapPaint(clusterId, 'circle-stroke-color', stroke);
    // Gated on the same glyph condition that decided whether to add the layer at all, rather than
    // on a `getLayer` probe: a repaint must not query map structure (see `refreshThemePaint`).
    if (this.styleProvidesGlyphs()) {
      this.setMapPaint(
        `${sourceId}-cluster-count`,
        'text-color',
        resolvedClusterCountColor(this, cluster.countColor)
          ?? resolvedLayerColor(this, `var(${ON_TONE_TOKEN[tone ?? 'accent']})`, tone),
      );
      const countHaloColor = resolvedClusterCountColor(this, cluster.countHaloColor);
      this.setMapPaint(
        `${sourceId}-cluster-count`,
        'text-halo-color',
        countHaloColor ?? null,
      );
      this.setMapPaint(
        `${sourceId}-cluster-count`,
        'text-halo-width',
        countHaloColor ? cluster.countHaloWidth : null,
      );
    }
    this.paintPoints(sourceId, layer);
  }

  /** The single `heatmap` layer `kind: 'heatmap'` renders, in place of the geometry split. */
  private applyHeatmapLayer(sourceId: string, layer: CanonicalMapDataLayer): void {
    if (!this._map) return;
    const heatmapId = `${sourceId}-heatmap`;
    const options = layer.heatmap;
    const weight = heatmapWeightExpression(options);
    const color = this.heatmapColorExpression(layer);
    const radius = heatmapZoomValue(options?.radius, DEFAULT_HEATMAP_RADIUS, 1, 200);
    const intensity = heatmapZoomValue(options?.intensity, DEFAULT_HEATMAP_INTENSITY, 0, 100);
    const opacity = finiteRange(options?.opacity ?? Number.NaN, 1, 0, 1);
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
  private paintHeatmapLayer(sourceId: string, layer: CanonicalMapDataLayer): void {
    if (!this._map) return;
    const heatmapId = `${sourceId}-heatmap`;
    // `?? 1` rather than a skip: an update that DROPS `weightField` has to put the layer back on
    // MapLibre's own uniform weight, and leaving the previous expression in place would keep
    // weighting by a property the consumer no longer asked for.
    this.setMapPaint(
      heatmapId,
      'heatmap-weight',
      heatmapWeightExpression(layer.heatmap) ?? 1,
    );
    this.setMapPaint(
      heatmapId,
      'heatmap-intensity',
      heatmapZoomValue(layer.heatmap?.intensity, DEFAULT_HEATMAP_INTENSITY, 0, 100),
    );
    this.setMapPaint(heatmapId, 'heatmap-color', this.heatmapColorExpression(layer));
    this.setMapPaint(
      heatmapId,
      'heatmap-radius',
      heatmapZoomValue(layer.heatmap?.radius, DEFAULT_HEATMAP_RADIUS, 1, 200),
    );
    this.setMapPaint(
      heatmapId,
      'heatmap-opacity',
      finiteRange(layer.heatmap?.opacity ?? Number.NaN, 1, 0, 1),
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
  private heatmapColorExpression(layer: CanonicalMapDataLayer): unknown[] {
    const tone = layer.tone;
    const authored = (layer.heatmap?.stops ?? []).map(
      ([density, color]) => [density, resolvedLayerColor(this, color, tone)] as const,
    );
    return heatmapColorExpression(
      authored,
      () => HEATMAP_RAMP_TOKENS.map(([density, token]) =>
        [density, resolvedLayerColor(this, `var(${token})`, tone)] as const),
    );
  }

  /** Whether a style declares an own, readable PBF glyph URL or native font-file source. */
  private styleHasTextFonts(style: unknown): boolean {
    try {
      if (!isPlainDataRecord(style)) return false;
      const glyphs = getOwnDataDescriptor(style, 'glyphs');
      if (isUnsafeDescriptor(glyphs)) return false;
      const glyphUrl = optionalDescriptorValue(glyphs);
      if (typeof glyphUrl === 'string' && glyphUrl.trim().length > 0) return true;
      const facesDescriptor = getOwnDataDescriptor(style, 'font-faces');
      if (isUnsafeDescriptor(facesDescriptor)) return false;
      const faces = optionalDescriptorValue(facesDescriptor);
      if (!isPlainDataRecord(faces)) return false;
      const families = Reflect.ownKeys(faces);
      if (families.length === 0 || families.length > 64) return false;
      let familyCount = 0;
      for (const family of families) {
        if (typeof family !== 'string' || !Object.getOwnPropertyDescriptor(faces, family)?.enumerable) continue;
        if (!family.trim()) return false;
        familyCount++;
        const declarationDescriptor = getOwnDataDescriptor(faces, family);
        if (isUnsafeDescriptor(declarationDescriptor)) return false;
        const declaration = optionalDescriptorValue(declarationDescriptor);
        if (typeof declaration === 'string') {
          if (!declaration.trim()) return false;
          continue;
        }
        const count = boundedOwnArrayLength(declaration, 257);
        if (count === undefined || count === 0 || count > 256) return false;
        for (let index = 0; index < count; index++) {
          const face = optionalDescriptorValue(getOwnDataDescriptor(declaration as object, String(index)));
          if (!isPlainDataRecord(face)) return false;
          const faceKeys = Reflect.ownKeys(face);
          if (faceKeys.length > 2 || faceKeys.some(key => key !== 'url' && key !== 'unicode-range')) return false;
          const url = optionalDescriptorValue(getOwnDataDescriptor(face, 'url'));
          if (typeof url !== 'string' || !url.trim()) return false;
          const rangeDescriptor = getOwnDataDescriptor(face, 'unicode-range');
          if (isUnsafeDescriptor(rangeDescriptor)) return false;
          if (rangeDescriptor === MISSING_OWN_DATA_DESCRIPTOR) continue;
          const ranges = optionalDescriptorValue(rangeDescriptor);
          const rangeCount = boundedOwnArrayLength(ranges, 65);
          if (rangeCount === undefined || rangeCount > 64) return false;
          for (let rangeIndex = 0; rangeIndex < rangeCount; rangeIndex++) {
            const range = optionalDescriptorValue(getOwnDataDescriptor(ranges as object, String(rangeIndex)));
            if (typeof range !== 'string') return false;
            const match = /^u\+(?:([0-9a-f]{1,6})(?:-([0-9a-f]{1,6}))?|([0-9a-f]{0,5}\?{1,6}))$/i.exec(range);
            if (!match) return false;
            if (match[3] !== undefined) {
              if (match[3].length > 6) return false;
            } else {
              const start = Number.parseInt(match[1]!, 16);
              const end = Number.parseInt(match[2] ?? match[1]!, 16);
              if (start > end || end > 0x10ffff) return false;
            }
          }
        }
      }
      return familyCount > 0;
    } catch {
      return false;
    }
  }

  /**
   * Whether the active style declares a text source. The live style resolves URL styles;
   * declarative styles also support native font files without a PBF glyph endpoint.
   */
  private styleProvidesGlyphs(): boolean {
    try {
      const live = (this._map as { getStyle?: () => unknown } | undefined)?.getStyle?.();
      if (this.styleHasTextFonts(live)) return true;
    } catch {
      // A peer that cannot report its style yet falls back to the declarative specification.
    }
    return this.styleHasTextFonts(this.mapStyle);
  }

  /** Allocates a private source/layer namespace that cannot overwrite base-style resources. */
  private resolveDataLayerSourceId(layer: CanonicalMapDataLayer, identities?: MapLayerIdentityDraft): string {
    const publicSourceId = layer.sourceId;
    const planned = identities?.geojson ?? this.plannedDataLayerIds;
    const applied = this._appliedDataLayerIds.get(publicSourceId);
    const pending = planned.get(publicSourceId);
    const appliedShape = this._appliedDataLayerShapes.get(publicSourceId);
    const changedShape = appliedShape !== undefined && appliedShape !== dataLayerShape(layer);
    // Reserve the replacement before ordering/preparation; never reuse a retired worker identity.
    const retained = changedShape ? (pending !== applied ? pending : undefined) : applied ?? pending;
    if (retained) return retained;
    let sourceId: string;
    do {
      sourceId = `lr-data-layer-${identities ? identities.nextGeojson++ : this._nextDataLayerId++}`;
    } while (
      this._map?.getSource(sourceId) ||
      DATA_LAYER_SUFFIXES.some((suffix) => this._map?.getLayer(`${sourceId}${suffix}`))
    );
    planned.set(publicSourceId, sourceId);
    return sourceId;
  }

  /** Removes one previously-applied `dataLayers` entry's source/layers, if present. */
  private removeDataLayer(publicSourceId: string): void {
    if (!this._map) return;
    const sourceId = this._appliedDataLayerIds.get(publicSourceId);
    if (!sourceId) return;
    this.featureStates?.refreshNative('data-layer', sourceId);
    this.removePointIcons(sourceId);
    this.appliedPointPaint.delete(sourceId);
    this.appliedGeoLabels.delete(sourceId);
    this.appliedRowRanges.delete(sourceId);
    for (const suffix of DATA_LAYER_SUFFIXES) {
      const layerId = `${sourceId}${suffix}`;
      this.appliedPointMuting.delete(layerId);
      if (this._map.getLayer(layerId)) this.removeMapLayer(layerId);
    }
    if (this._map.getSource(sourceId)) this._map.removeSource(sourceId);
    this._appliedDataLayerIds.delete(publicSourceId);
    if (this.plannedDataLayerIds.get(publicSourceId) === sourceId) this.plannedDataLayerIds.delete(publicSourceId);
    this._appliedDataLayerShapes.delete(publicSourceId);
    this._appliedGeoJson.delete(sourceId);
    this.appliedLayerPaintKeys.delete(sourceId);
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
    // order in the accepted marker sequence doesn't change.
    const coordCounts = new Map<string, number>();
    const explicitIds = new Set<string>();
    for (const m of this.canonicalMarkers) {
      const lngLat = m.lngLat;
      const mapLngLat: [number, number] = [lngLat[0], lngLat[1]];
      let key: string;
      let id: string | undefined;
      if (m.id !== undefined) {
        id = m.id;
        if (explicitIds.has(id)) continue;
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
      // An explicit, invalid color (or a `url()` paint server) still falls through to
      // maplibre-gl's own hardcoded default -- documented on `LyraMapMarker.color` -- but an
      // omitted color inherits the brand token through CSS, preserving marker and popup identity
      // when the theme changes.
      const markerColor =
        sanitizeCssColor(m.color) ??
        (m.color === undefined ? 'currentColor' : undefined);
      const previous = this._markerSources.get(key);
      this._markerSources.set(key, m);
      const sameColor = this._markerColors.get(key) === markerColor;
      const sameContent = previous !== undefined && previous.label === m.label &&
        Object.is(previous.unsafeHtml, m.unsafeHtml);
      if (existing && sameColor && sameContent && previous.lngLat[0] === lngLat[0] &&
        previous.lngLat[1] === lngLat[1]) continue;
      if (existing && !sameColor) {
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
        const marker = new mod.Marker(markerColor ? { color: markerColor } : undefined).setLngLat(mapLngLat);
        if (m.unsafeHtml || m.label) {
          const popup = setPopupContent(new mod.Popup({ offset: 12 }), m);
          marker.setPopup(popup);
          this.configurePopupSemantics(key, marker, popup);
        }
        marker.addTo(map);
        this._markerInstances.set(key, marker);
        this._markerColors.set(key, markerColor);
      } else {
        existing.setLngLat(mapLngLat);
        const popup = existing.getPopup();
        if (!m.unsafeHtml && !m.label) {
          if (popup) existing.setPopup(undefined);
        } else if (!popup) {
          const nextPopup = setPopupContent(new mod.Popup({ offset: 12 }), m);
          existing.setPopup(nextPopup);
          this.configurePopupSemantics(key, existing, nextPopup);
        } else if (!sameContent) {
          setPopupContent(popup, m);
        }
      }
      const markerLabel = m.label?.trim() || markerPopupText(this, m.unsafeHtml);
      this._markerLabels.set(key, markerLabel || undefined);
      const markerElement = (this._markerInstances.get(key) as { getElement?: () => HTMLElement } | undefined)
        ?.getElement?.();
      if (markerElement) {
        addPartToken(markerElement, 'marker');
        const currentMarker = this._markerInstances.get(key);
        this.configureMarkerInteraction(markerElement, {
          id,
          lngLat,
          marker: m as LyraMapMarker,
        }, markerLabel);
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
        this._markerSources.delete(key);
      }
    }
  }

  private readonly configuredMarkerElements = new WeakSet<HTMLElement>();

  private configureMarkerInteraction(
    markerElement: HTMLElement,
    activation: Omit<LyraMapMarkerActivationDetail, 'source'>,
    markerLabel = activation.marker.label?.trim() || markerPopupText(this, activation.marker.unsafeHtml),
  ): void {
    this.markerActivationDetails.set(markerElement, activation);
    markerElement.setAttribute('role', 'button');
    markerElement.tabIndex = 0;
    markerElement.setAttribute('aria-label', markerLabel || this.localize('mapMarker'));
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
    return hostAriaLabel(this) ?? this.label ?? this.localize('map');
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
    // The first delivery reports the allocation the map and anchor were just laid out with.
    let size = renderedSizeKey(container);
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
        this.drawingController?.scheduleHandles();
      } catch {
        // A peer can be disposing in the same delivery turn; the next live allocation retries.
      }
      const next = renderedSizeKey(container);
      if (next === size) return;
      size = next;
      // Never placed inside this delivery: placing observes the anchor's own size, and starting a
      // new observation while another is being delivered trips the browser's loop error.
      this.scheduleAnchorSync();
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
    const pending = this.peerControlsResizeFrame;
    this.peerControlsResizeFrame = undefined;
    if (pending) pending.view.cancelAnimationFrame(pending.handle);
    this.peerControlsResizeObserver?.disconnect();
    this.peerControlsResizeObserver = undefined;
    this.peerChromeObserver?.disconnect();
    this.peerChromeObserver = undefined;
    this.observedPeerContainer = undefined;
  }

  private peerControlsResizeObserver?: ResizeObserver;
  private peerControlsResizeFrame?: { view: Window; handle: number };

  private schedulePeerControlInsets(observer: ResizeObserver | undefined, container: HTMLElement): void {
    if (
      this.peerControlsResizeObserver !== observer ||
      this.observedPeerContainer !== container ||
      this.containerEl !== container ||
      !this.isConnected ||
      this.peerControlsResizeFrame
    ) return;
    const view = container.ownerDocument.defaultView;
    if (!view) return;
    // Updating the legend from a deeper corner observer would resize a shallower observed
    // surface during the same delivery. Measure after that delivery has finished instead.
    const pending = { view, handle: 0 };
    this.peerControlsResizeFrame = pending;
    pending.handle = view.requestAnimationFrame(() => {
      if (this.peerControlsResizeFrame !== pending) return;
      this.peerControlsResizeFrame = undefined;
      if (
        this.peerControlsResizeObserver !== observer ||
        this.observedPeerContainer !== container ||
        this.containerEl !== container ||
        container.ownerDocument.defaultView !== view ||
        !this.isConnected
      ) return;
      this.measurePeerControlInsets(container);
    });
  }

  private measurePeerControlInsets(container: HTMLElement): void {
    if (!this.isConnected || this.containerEl !== container) return;
    for (const scale of container.querySelectorAll<HTMLElement>('.maplibregl-ctrl-scale')) {
      // The native distance width belongs to the ruler; a wider localized label can own its
      // background without stretching that geographic measurement.
      const width = scale.style.width;
      if (width && scale.style.getPropertyValue('--_lr-map-scale-width') !== width) {
        scale.style.setProperty('--_lr-map-scale-width', width);
      }
    }
    for (const edge of ['top', 'bottom']) {
      // These CSS insets need layout pixels, including when an ancestor scales the map.
      const height = Math.max(0, ...[...container.querySelectorAll<HTMLElement>(
        `.maplibregl-ctrl-${edge}-left, .maplibregl-ctrl-${edge}-right`,
      )].map((corner) => corner.offsetHeight));
      const base = container.parentElement;
      const name = `--_lr-map-controls-${edge}`;
      const value = `${height}px`;
      if (base && base.style.getPropertyValue(name) !== value) base.style.setProperty(name, value);
    }
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
      ['.maplibregl-ctrl-group:has(.maplibregl-ctrl-zoom-in, .maplibregl-ctrl-compass)', 'navigation'],
      ['.maplibregl-ctrl-zoom-in', 'zoom-in'],
      ['.maplibregl-ctrl-zoom-out', 'zoom-out'],
      ['.maplibregl-ctrl-compass', 'compass'],
      ['.maplibregl-ctrl-scale', 'scale'],
      ['.maplibregl-ctrl-geolocate', 'geolocate'],
    ];
    for (const [selector, part] of selectors) {
      const candidate = root as ParentNode & { matches?: (value: string) => boolean };
      const elements: Element[] = [];
      if (candidate.matches?.(selector)) elements.push(candidate as unknown as Element);
      if (!(root instanceof Element) || root.childElementCount > 0) elements.push(...root.querySelectorAll(selector));
      for (const element of elements) {
        addPartToken(element, part);
        if (part === 'scale') {
          const text = element.textContent ?? '';
          const units = [...this.scaleLabels.keys()].sort((a, b) => b.length - a.length);
          const unit = units.find(value => text.endsWith(` ${value}`) || text.endsWith(`\u00a0${value}`));
          if (unit) {
            const key = this.scaleLabels.get(unit)!;
            const translated = this.localize(MAP_SCALE_UNIT_MESSAGE[key]); this.scaleLabels.set(translated, key);
            const next = text.slice(0, -unit.length) + translated;
            if (next !== text) element.textContent = next;
          }
        }
        const label = part === 'attribution-toggle' ? this.localize('mapToggleAttribution')
          : part === 'zoom-in' ? this.localize('zoomIn')
          : part === 'zoom-out' ? this.localize('zoomOut')
          : part === 'compass' ? this.localize('mapResetNorth')
          : part === 'geolocate' ? this.localize((element as HTMLButtonElement).disabled ? 'mapGeolocateUnavailable' : 'mapGeolocateFindLocation') : undefined;
        if (label !== undefined) {
          if (element.getAttribute('aria-label') !== label) element.setAttribute('aria-label', label);
          if (element.getAttribute('title') !== label) element.setAttribute('title', label);
        }
      }
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
    const ResizeObserverCtor = container.ownerDocument.defaultView?.ResizeObserver;
    if (ResizeObserverCtor) {
      const observer = new ResizeObserverCtor(() => this.schedulePeerControlInsets(observer, container));
      this.peerControlsResizeObserver = observer;
      for (const corner of container.querySelectorAll<HTMLElement>(
        '.maplibregl-ctrl-top-left, .maplibregl-ctrl-top-right, .maplibregl-ctrl-bottom-left, .maplibregl-ctrl-bottom-right',
      )) this.peerControlsResizeObserver.observe(corner);
    }
    this.measurePeerControlInsets(container);
    this.peerChromeObserver = new MutationObserverCtor((records) => {
      if (!this.isConnected || this.containerEl !== container) return;
      let elementsChanged = false;
      for (const record of records) {
        if (record.type === 'attributes' && record.target instanceof Element) this.syncPeerChromeParts(record.target);
        if (record.type === 'characterData' && record.target.parentElement) this.syncPeerChromeParts(record.target.parentElement);
        if (record.type === 'childList' && record.target instanceof Element && record.target.matches('.maplibregl-ctrl-scale')) this.syncPeerChromeParts(record.target);
        for (const node of record.removedNodes) if (node.nodeType === 1) elementsChanged = true;
        for (const node of record.addedNodes) {
          if (node.nodeType !== 1) continue;
          elementsChanged = true;
          const element = node as Element;
          if (element.matches('.maplibregl-marker[part~="marker"]')) continue;
          this.syncPeerChromeParts(element);
        }
      }
      if (elementsChanged) this.schedulePeerControlInsets(this.peerControlsResizeObserver, container);
    });
    this.peerChromeObserver.observe(container, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['disabled'] });
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

  private syncMapSemantics(markers = true): void {
    const canvas = this._map?.getCanvas?.() as HTMLCanvasElement | undefined;
    if (canvas) {
      canvas.setAttribute('aria-label', this.effectiveMapLabel);
      canvas.setAttribute('lang', this.effectiveLocale);
      if (this.legend.length || this.legendGradient.length >= 2 || this.hasLegendSlot ||
        this.hasLegendStartSlot || this.legendProjection.truncated || this.hasDerivedLegend()) {
        canvas.setAttribute('aria-describedby', 'map-legend');
      }
      else canvas.removeAttribute('aria-describedby');
    }
    this.hostDescription.refresh();
    this.syncPeerChromeParts();
    if (!markers) return;
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

  /** A metric distance in the component locale: metres below 1 km, kilometres above. */
  private formatDistance(metres: number): string {
    return metres < 1000
      ? getNumberFormat(this.effectiveLocale, { style: 'unit', unit: 'meter', unitDisplay: 'short', maximumFractionDigits: 0 }).format(metres)
      : getNumberFormat(this.effectiveLocale, { style: 'unit', unit: 'kilometer', unitDisplay: 'short', maximumFractionDigits: metres < 10_000 ? 2 : 1 }).format(metres / 1000);
  }

  /** A metric area in the component locale: square metres below 1 km², square kilometres above. */
  private formatArea(squareMetres: number): string {
    return squareMetres < 1_000_000
      ? this.localize('mapSquareMeters', undefined, { value: getNumberFormat(this.effectiveLocale, { maximumFractionDigits: 0 }).format(squareMetres) })
      : this.localize('mapSquareKilometers', undefined, { value: getNumberFormat(this.effectiveLocale, { maximumFractionDigits: 2 }).format(squareMetres / 1_000_000) });
  }

  private drawingSummary(snapshot: LyraMapDrawingSnapshot | undefined): string | undefined {
    if (!snapshot || snapshot.vertices.length < 2) return undefined;
    const metrics = loadMapDrawingRuntime.loaded?.measureDrawing(snapshot.mode, snapshot.vertices);
    if (!metrics) return undefined;
    if (snapshot.mode === 'line') return this.localize('mapDrawingLength', undefined, { value: this.formatDistance(metrics.length) });
    return metrics.area === undefined ? undefined : this.localize('mapDrawingArea', undefined, { value: this.formatArea(metrics.area) });
  }

  private drawingLabelText(kind: 'segment' | 'closing' | 'area' | 'length', value: number): string {
    return kind === 'area' ? this.localize('mapDrawingArea', undefined, { value: this.formatArea(value) })
      : kind === 'length' ? this.localize('mapDrawingLength', undefined, { value: this.formatDistance(value) })
        : this.formatDistance(value);
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
    const filled = slot.assignedNodes({ flatten: true }).some(
      (node) =>
        node.nodeType === Node.ELEMENT_NODE ||
        (node.textContent ?? '').trim().length > 0,
    );
    if (slot.name === 'legend-start') this.hasLegendStartSlot = filled;
    else this.hasLegendSlot = filled;
  };

  /**
   * The continuous gradient bar plus its two endpoint captions, or nothing when `legendGradient`
   * holds fewer than two usable stops. Part names mirror `lr-heatmap`'s
   * `legend-lo`/`legend-hi` so a consumer styling both components learns one vocabulary.
   */
  /**
   * The swatch-plus-label pair every legend row renders: directly inside the row when the row is
   * inert, and inside the row's toggle button when `legendInteractive` has made it operable. One
   * source of truth, so the two branches can never drift, and an unset map keeps rendering exactly
   * the markup it rendered before the toggle existed.
   */
  private renderLegendRowContent(entry: LyraMapLegendEntry): TemplateResult {
    const paint = sanitizeCssColor(entry.color);
    return html`${entry.icon
                      ? html`<span
                          part="legend-swatch"
                          data-pattern=${entry.pattern}
                          data-icon="true"
                          aria-hidden="true"
                          inert
                          style=${styleMap(paint ? { color: paint } : {})}
                          >${renderLegendIcon(entry.icon)}</span
                        >`
                      : html`<span
                          part="legend-swatch"
                          data-pattern=${entry.pattern}
                          aria-hidden="true"
                          inert
                          style=${styleMap(paint ? { backgroundColor: paint } : {})}
                        ></span>`}
                    <span>${entry.label}</span>`;
  }

  /**
   * Flips one category's visibility from a legend toggle activation.
   *
   * `hiddenCategories` is a key set, so every row carrying the activated key flips together --
   * self-consistent by construction rather than by a per-row visibility flag that two rows
   * describing one category could disagree about.
   */
  private toggleLegendCategory(entry: LyraMapLegendEntry): void {
    const value = entry.value;
    if (!this.legendInteractive || value === undefined) return;
    const hidden = this.hiddenCategories;
    const wasHidden = hidden.includes(value);
    const next = wasHidden ? hidden.filter((key) => key !== value) : [...hidden, value];
    const proposal = this.emit(
      'lr-map-legend-toggle-request',
      { value, visible: wasHidden, hiddenCategories: [...next] },
      { cancelable: true },
    );
    // The veto is the absence of a write, not a write that is undone afterwards: a listener that
    // owns the set can assign its own `hiddenCategories` without this handler clobbering it.
    if (proposal.defaultPrevented) return;
    this.hiddenCategories = next;
    this.announceLegendVisibility(entry, wasHidden);
  }

  /**
   * The state change belongs in a live region because the thing that changed -- the map, and the
   * legend row's own styling -- is not the focused element, and `aria-pressed` alone only reports
   * the button's new state once focus is already on it.
   */
  private announceLegendVisibility(entry: LyraMapLegendEntry, nowVisible: boolean): void {
    this.announcements.announcePolite(
      this.localize(nowVisible ? 'legendTypeShown' : 'legendTypeHidden', undefined, {
        label: entry.label,
      }),
    );
  }

  /**
   * One legend row. Extracted verbatim from the list template so the grouped and ungrouped section
   * paths below render the same node rather than two copies that can drift.
   *
   * `aria-posinset`/`aria-setsize` deliberately stay whole-key values inside a section too.
   * `aria-setsize` already reports the *input* count rather than the rendered one, so a bounded key
   * stays honest; per-section input counts do not exist, because a row dropped by the bound carries
   * no attributable group. A section adds a labelled sub-region; it does not renumber the key.
   */
  private renderLegendRow(entry: LyraMapLegendEntry, index: number): TemplateResult {
    const key = entry.value;
    const interactive = this.legendInteractive && key !== undefined;
    const visible = key === undefined || !this.hiddenCategories.includes(key);
    const checkbox = this.legendControlRole === 'checkbox';
    return html`<div
                    class="legend-row"
                    role="listitem"
                    aria-posinset=${String(index + 1)}
                    aria-setsize=${String(this.legendProjection.inputCount)}
                  >
                    ${interactive
                      ? html`<button
                          part=${visible ? 'legend-toggle' : 'legend-toggle legend-toggle-hidden'}
                          type="button"
                          role=${checkbox ? 'checkbox' : nothing}
                          aria-pressed=${checkbox ? nothing : visible ? 'true' : 'false'}
                          aria-checked=${checkbox ? (visible ? 'true' : 'false') : nothing}
                          @click=${(): void => this.toggleLegendCategory(entry)}
                        >${this.renderLegendRowContent(entry)}</button>`
                      : this.renderLegendRowContent(entry)}
                  </div>`;
  }

  /**
   * The row list's children: bare rows when no admitted entry carries a `group`, and otherwise one
   * `role="group"` per CONSECUTIVE run sharing a group name, with ungrouped rows left exactly where
   * they were declared. The ungrouped branch is literally the expression this list has always been,
   * so a legend that uses no sections keeps rendering the markup it rendered before they existed.
   *
   * `group` is caller-supplied data: the heading renders it verbatim and never resolves it through
   * the locale catalog.
   *
   * Each section owns its OWN `role="list"` rather than the sections sitting directly inside the
   * outer one. `list` requires `listitem` children, and a `group` is not one -- axe reports both
   * `aria-required-children` on the outer list and `aria-required-parent` on every row inside the
   * group, critical, which is how this shape was caught. So a grouped legend renders one list per
   * run (including each ungrouped run) and the outer element drops its own `role`, while an
   * ungrouped legend keeps the single `role="list"` it has always had.
   */
  private renderLegendRows(): unknown {
    if (!this._legendGrouped) {
      return this.legend.map((entry, index) => this.renderLegendRow(entry, index));
    }
    const sections: { group: string | undefined; rows: TemplateResult[] }[] = [];
    this.legend.forEach((entry, index) => {
      const row = this.renderLegendRow(entry, index);
      const open = sections[sections.length - 1];
      if (open && open.group === entry.group) open.rows.push(row);
      else sections.push({ group: entry.group, rows: [row] });
    });
    return sections.map((section, sectionIndex) => {
      const rows = html`<div class="legend-section-list" role="list">${section.rows}</div>`;
      if (section.group === undefined) return rows;
      const headingId = `map-legend-group-${sectionIndex}`;
      return html`<div
                    class="legend-group"
                    part="legend-group"
                    role="group"
                    aria-labelledby=${headingId}
                  >
                    <div
                      class="legend-group-heading"
                      part="legend-group-heading"
                      id=${headingId}
                    >${section.group}</div>
                    ${rows}
                  </div>`;
    });
  }

  /** Whether `choroplethLegend` currently derives anything to show. */
  private hasDerivedLegend(): boolean {
    const derived = this.derivedLegend;
    return derived.rows.length > 0 || derived.gradient.length >= 2;
  }

  private renderLegendGradient(): TemplateResult | typeof nothing {
    const explicit = this.legendGradient;
    const derived = this.derivedLegend;
    // An authored gradient replaces the derived one outright; only the ticks may mix, and an
    // assigned list (even an empty one) always wins over the derived interior stops.
    const stops = explicit.length >= 2 ? explicit : derived.gradient;
    if (stops.length < 2) return nothing;
    const interpolation = explicit.length >= 2
      ? (this.legendIsLine ? 'linear' : this.canonicalChoropleth?.interpolation)
      : derived.interpolation;
    const lo = stops[0]!;
    const hi = stops[stops.length - 1]!;
    const image = choroplethLegendGradientImage(stops, interpolation);
    const ticks = this._legendGradientTicksAssigned || explicit.length >= 2
      ? this.legendGradientTicks
      : derived.ticks;
    const span = hi[0] - lo[0];
    const marks = span > 0 ? ticks.filter((tick) => tick.value >= lo[0] && tick.value <= hi[0]) : [];
    const bar = html`<span
        part="legend-gradient"
        class="gradient-bar"
        aria-hidden="true"
        inert
        style=${styleMap({ backgroundImage: image })}
      ></span>`;
    return html`<div class="legend-gradient" ?hidden=${this.legendCollapsed}>
      <span part="legend-lo">${this.legendGradientLoLabel ?? this.formatCount(lo[0])}</span>
      ${marks.length === 0
        ? bar
        : html`<span class="gradient-track">${bar}<span class="gradient-ticks" part="legend-ticks">${marks.map(
            (tick) => html`<span
              part="legend-tick"
              style=${styleMap({ '--_lr-map-tick-position': `${compactGradientPercent(((tick.value - lo[0]) / span) * 100)}%` })}
              >${tick.label ?? this.formatCount(tick.value)}</span
            >`,
          )}</span></span>`}
      <span part="legend-hi">${this.legendGradientHiLabel ?? this.formatCount(hi[0])}</span>
    </div>`;
  }

  /** Swatch rows derived from the choropleth (step bands, no data), in their own labelled list. */
  private renderDerivedLegendRows(): TemplateResult | typeof nothing {
    const rows = this.derivedLegend.rows;
    if (rows.length === 0) return nothing;
    return html`<div class="legend-list" part="legend-derived" role="list" ?hidden=${this.legendCollapsed}>
      ${rows.map((entry, index) => html`<div
        class="legend-row"
        role="listitem"
        aria-posinset=${String(index + 1)}
        aria-setsize=${String(rows.length)}
      >${this.renderLegendRowContent(entry)}</div>`)}
    </div>`;
  }

  override render(): TemplateResult {
    const drawing = this.drawingController;
    // Lit's own whitespace/comment marker nodes around the `${...}` binding mean
    // `[part="legend"]` is never truly `:empty` in CSS even with zero entries, so
    // the panel is omitted only when both the bounded legend and its projection result are empty
    // rather than relying on a CSS `:empty` selector that can never match.
    //
    // The legend's `aria-controls` names the map container, which exists only once the peer has
    // settled successfully: while loading, and on every failure, the attribute is dropped rather
    // than left pointing at an id that is not in the tree. A dangling idref is an ARIA violation
    // in its own right (axe reports it critical), and the legend is exactly the element a screen
    // reader would follow from.
    return html`
      <div
        part="base"
        aria-busy=${String(this.loading || (!this._map && !this.failure && !this.awaitingActivation))}
      >
        ${this.failure
          ? html`<div part="error">${this.failureMessage()}</div>`
          : this.loading
            ? html`
                <span class="sr-only">${this.localize('loading')}</span>
          <lr-skeleton shape="rect" .announce=${false}></lr-skeleton>
              `
            : html`<div part="container" id="map-container" lang=${this.effectiveLocale}></div>`}
        ${!this.failure && !this.loading && !this._map ? html`<div part="initialization-placeholder">
          ${this.awaitingActivation
            ? html`<button type="button" part="initialization-activate"><span class="activate-label">${this.localize('mapActivate')}</span></button>`
            : html`<span class="sr-only">${this.localize('loading')}</span>`}
          <lr-skeleton class="initialization-skeleton" shape="rect" .announce=${false}></lr-skeleton>
          <div class="initialization-controls" aria-hidden="true">${[...normalizeMapControlOptions(this.controls).controls.keys()].map(kind => html`<span part="initialization-control" data-control=${kind}></span>`)}</div>
        </div>` : nothing}
        ${this.hashIssue || this.controlIssue ? html`<div part="configuration-error">${this.localize(MAP_CONFIGURATION_MESSAGE[this.hashIssue ?? this.controlIssue!])}</div>` : nothing}
        ${this.exportIssue ? html`<div part="configuration-error">${this.localize('mapExportUnavailable')}</div>` : nothing}
        ${this.dataLayerIssue ? html`<div part="configuration-error">${this.localize('mapInitializationFailed')}</div>` : nothing}
        ${this.featureStateIssue ? html`<div part="configuration-error">${this.localize('mapFeatureStateUnavailable')}</div>` : nothing}
        ${this.pickMode && !this.failure && !this.loading ? html`<div part="pick-controls">
          <button type="button" part="pick-center" ?disabled=${this.interactionBlocked} @click=${this.pickMapCenter}>${this.localize('mapPickAtCenter')}</button>
          <button type="button" part="pick-cancel" ?disabled=${this.interactionBlocked} @click=${this.cancelMapPick}>${this.localize('mapCancelPick')}</button>
        </div>` : nothing}
        ${(this.drawMode === 'line' || this.drawMode === 'polygon' || drawing?.editing) && !this.pickMode && !this.failure && !this.loading ? html`<div part="drawing-controls" role="group" aria-label=${this.localize('mapDrawingControls')}>
          <button type="button" part="drawing-add" ?disabled=${this.interactionBlocked || !drawing?.active || drawing.editing} @click=${this.drawMapCenter}>${this.localize('mapDrawAtCenter')}</button>
          <button type="button" part="drawing-undo" ?disabled=${this.interactionBlocked || !drawing?.snapshot?.vertices.length || drawing.editing} @click=${() => this.undoDrawing()}>${this.localize('mapUndoDrawing')}</button>
          <button type="button" part="drawing-complete" ?disabled=${this.interactionBlocked || !drawing?.active} @click=${() => this.completeDrawing()}>${this.localize('mapCompleteDrawing')}</button>
          <button type="button" part="drawing-cancel" ?disabled=${this.interactionBlocked} @click=${() => this.cancelDrawing()}>${this.localize('mapCancelDrawing')}</button>
          <span part="drawing-status">${this.localize('mapDrawingVertices', undefined, { count: drawing?.snapshot?.vertices.length ?? 0 })}</span>
          ${this.drawingMeasurements && this.drawingSummary(drawing?.snapshot) ? html`<span part="drawing-summary">${this.drawingSummary(drawing?.snapshot)}</span>` : nothing}
        </div>` : nothing}
        ${this.drawingMeasurements && drawing?.labels.length ? html`<div part="drawing-measurements" aria-hidden="true">${drawing.labels.map(label => html`<span
          part="drawing-measurement" data-kind=${label.kind} style=${styleMap({ left: `${label.x}px`, top: `${label.y}px` })}
          >${this.drawingLabelText(label.kind, label.value)}</span>`)}</div>` : nothing}
        ${drawing?.handles.length ? html`<span id="drawing-edit-instructions" class="sr-only">${this.localize('mapDrawingEditInstructions')}</span>
          <div part="drawing-handles">${drawing.handles.map(handle => html`<button type="button" part="drawing-vertex"
            style=${styleMap({ left: `${handle.x}px`, top: `${handle.y}px` })} tabindex=${handle.index === drawing.selected ? '0' : '-1'}
            aria-label=${this.localize('mapDrawingVertex', undefined, { index: handle.index + 1 })} aria-describedby="drawing-edit-instructions"
            ?disabled=${this.interactionBlocked} @focus=${() => { drawing.select(handle.index); }}
            @pointerdown=${(event: PointerEvent) => { this.suppressDrawingClick = false; drawing.begin(event, handle.index); }}
            @keydown=${(event: KeyboardEvent) => drawing.vertexKey(event, handle.index)}
            @click=${(event: MouseEvent) => { event.preventDefault(); event.stopPropagation(); }}><span aria-hidden="true"></span></button>`)}</div>` : nothing}
        ${this.drawingIssue ? html`<div part="configuration-error">${this.drawingErrorMessage()}</div>` : nothing}
        <div class="anchor-boundary" aria-hidden="true"></div>
        <div part="anchor" hidden @focusin=${this.onAnchorFocus}><slot name="anchor" @slotchange=${this.onAnchorSlotChange}></slot>${this.anchorClosable
          ? html`<button type="button" part="anchor-close" @click=${() => { this.anchorController?.close('close-button'); }}>${this.localize('close')}</button>` : nothing}</div>
        ${this.legend.length ||
        this.legendProjection.truncated ||
        this.legendGradient.length ||
        this.hasDerivedLegend() ||
        this.hasLegendSlot ||
        this.hasLegendStartSlot ||
        this.probeLegendSlot('legend') ||
        this.probeLegendSlot('legend-start')
          ? html`<div
              part="legend"
              id="map-legend"
              role="group"
              aria-label=${this.localize('mapLegend')}
              aria-controls=${this.failure || this.loading ? nothing : 'map-container'}
              data-truncated=${String(this.legendProjection.truncated)}
            >
              <slot name="legend-start" @slotchange=${this.onLegendSlotChange}></slot>
              <div class="glass-scroll-layer" aria-hidden="true"></div>
              ${this.renderLegendDisclosure()}
              ${this.renderLegendGradient()}
              <div
                class="legend-list"
                role=${this._legendGrouped ? nothing : 'list'}
                id=${this.legendCollapsible ? 'map-legend-list' : nothing}
                ?hidden=${this.legendCollapsed}
              >
                ${this.renderLegendRows()}
              </div>
              ${this.renderDerivedLegendRows()}
              ${this.legendProjection.truncated
                ? html`<div id="map-legend-limit" part="legend-limit" ?hidden=${this.legendCollapsed}>
                    ${this.legendLimitText()}
                  </div>`
                : nothing}
              <slot name="legend" ?hidden=${this.legendCollapsed} @slotchange=${this.onLegendSlotChange}></slot>
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
