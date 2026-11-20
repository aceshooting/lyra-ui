import type { Feature, FeatureCollection } from 'geojson';
import { projectChoroplethNoData, type CanonicalChoroplethNoData } from '../../../internal/choropleth-no-data.js';
import { isSafeNonArrayObject } from '../../../internal/object-guards.js';
import { finiteRange } from '../../../internal/numbers.js';
import { sanitizeCssColor } from '../../../internal/safe-css.js';
import {
  getOwnDataDescriptor,
  MISSING_OWN_DATA_DESCRIPTOR,
  type OwnDataDescriptorResult,
  UNSAFE_OWN_DATA_DESCRIPTOR,
} from '../../../internal/data-descriptors.js';
import { projectMapInteractionOptions, type CanonicalMapInteraction } from './map-interaction-options.js';
import { projectMapDataLayerModel, projectMapRowPlacement, projectMapLabelOptions, type CanonicalMapLabel } from './map-data-layer-model.js';
import { projectAdmittedGeoJson, type CanonicalGeoJsonProjection } from './map-geojson-diff.js';
import type { MapDataLayerPointRadius } from './map-data-layers.js';
import {
  boundedOwnArrayLength,
  isRuntimeArray,
  isUnsafeDescriptor,
  normalizeMapLegendGradient,
  optionalDescriptorValue,
  projectIconPaint,
  type CanonicalIconPaint,
} from './map-descriptor-values.js';

// On-demand projection for `dataLayers` and `choropleth`. A map that sets neither never loads this
// module, its descriptor model or its GeoJSON projection and diffing.

export type { CanonicalChoroplethNoData } from '../../../internal/choropleth-no-data.js';
export { buildMapLabelLayer } from './map-label-layer.js';
export { buildProjectedGeoJsonPropertyDiff, projectAdmittedGeoJson } from './map-geojson-diff.js';

export interface CanonicalMapDataLayer extends CanonicalMapInteraction {
  readonly before?: string;
  readonly minZoom: number;
  readonly maxZoom: number;
  readonly placementRequested: boolean;
  readonly sourceId: string;
  readonly geojson: Feature | FeatureCollection;
  readonly geojsonProjection: CanonicalGeoJsonProjection;
  readonly label: CanonicalMapLabel | undefined;
  readonly invalidLabel: boolean;
  readonly tone: ReturnType<typeof mapTone>;
  readonly color: string | undefined;
  readonly strokeColor: string | undefined;
  readonly line: CanonicalLineOptions | undefined;
  readonly point: CanonicalPointOptions | undefined;
  readonly kind: 'auto' | 'heatmap';
  readonly heatmap: CanonicalHeatmapOptions | undefined;
  readonly cluster: NormalizedClusterOptions | undefined;
}

function mapTone(value: unknown) {
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
    if (!isSafeNonArrayObject(value)) return undefined;
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
      !isSafeNonArrayObject(geojson)
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
    const kind = kindValue === 'heatmap' ? 'heatmap' : 'auto';
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
      geojson: geojson as unknown as Feature | FeatureCollection,
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

/** Cap on the cluster count label's font stack; a stack is a fallback chain, not a list. */
const MAX_CLUSTER_COUNT_FONTS = 8;

/** `LyraMapClusterOptions` with every value normalized to something MapLibre accepts. */
export interface NormalizedClusterOptions {
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
    if (!isSafeNonArrayObject(value)) return undefined;
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

export interface CanonicalLineOptions {
  readonly field: string | undefined;
  readonly stops: readonly (readonly [number, string])[];
  readonly width: number;
  readonly opacity: number;
}

export interface CanonicalPointOptions {
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

export interface CanonicalPointIcon extends CanonicalIconPaint {
  readonly value: string;
}

type CanonicalPointRadius = MapDataLayerPointRadius;

function projectPointRadius(value: unknown): number | CanonicalPointRadius {
  if (!isSafeNonArrayObject(value)) return finiteRange(typeof value === 'number' ? value : NaN, 5, 0, 200);
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
  if (!isSafeNonArrayObject(value)) return undefined;
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

function projectLineOptions(value: unknown): CanonicalLineOptions | undefined {
  try {
    if (!isSafeNonArrayObject(value)) return undefined;
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
export interface CanonicalHeatmapOptions {
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
    if (!isSafeNonArrayObject(value)) return undefined;
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

/** The accepted, one-read subset of a caller-owned choropleth record. */
export interface CanonicalMapChoropleth extends CanonicalMapInteraction {
  readonly sourceId: string;
  readonly geojson: FeatureCollection;
  readonly geojsonProjection: CanonicalGeoJsonProjection;
  readonly field: string;
  readonly stops: readonly (readonly [number, string])[];
  readonly interpolation: ReturnType<typeof choroplethInterpolation>;
  readonly stepBaseColor: string | undefined;
  readonly noData: CanonicalChoroplethNoData | undefined;
}

/** `logarithmic` and `step` are kept; anything else interpolates linearly. */
function choroplethInterpolation(value: unknown) {
  return value === 'logarithmic' || value === 'step' ? value : 'linear';
}

export function projectMapChoropleth(value: unknown): CanonicalMapChoropleth | undefined {
  try {
    if (!isSafeNonArrayObject(value)) return undefined;
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
      !isSafeNonArrayObject(geojson) ||
      typeof field !== 'string' ||
      field.trim().length === 0
    )
      return undefined;
    const interpolationValue = optionalDescriptorValue(interpolationDescriptor);
    const stepBaseColorValue = optionalDescriptorValue(stepBaseColorDescriptor);
    const interpolation = choroplethInterpolation(interpolationValue);
    return Object.freeze({
      sourceId: sourceId.trim(), ...projectMapInteractionOptions(value),
      geojson: geojson as unknown as FeatureCollection,
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

/** One immutable projection of a `dataLayers` assignment, resolved against the owner document. */
export function projectMapDataLayers(source: unknown, baseUrl: string, ownerOrigin: string) {
  return projectMapDataLayerModel(source, { baseUrl, ownerOrigin, projectGeoJson: projectMapDataLayer });
}
