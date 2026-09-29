import { finiteRange } from '../../../internal/numbers.js';

/** A normalized numeric point-radius ramp used by a data layer's paint expression. */
export interface MapDataLayerPointRadius {
  readonly field: string;
  readonly stops: readonly (readonly [number, number])[];
  readonly interpolation: 'step' | 'linear';
  readonly fallback: number;
}

export interface MapDataLayerHeatmapOptions {
  readonly weightField: string | undefined;
  readonly weightRange: readonly [number, number] | undefined;
  readonly stops: readonly (readonly [number, string])[];
  readonly radius: number | readonly (readonly [number, number])[] | undefined;
  readonly intensity: number | readonly (readonly [number, number])[] | undefined;
}

/** `['step', input, base, threshold, output, …]`, retaining the admitted stop order. */
export function stepExpression<T>(input: unknown, stops: readonly (readonly [number, T])[]): unknown[] {
  const expression: unknown[] = ['step', input, stops[0]![1]];
  for (const [threshold, output] of stops) expression.push(threshold, output);
  return expression;
}

/** Builds the category match expression for individual point colors. */
export function pointColorExpression(
  field: string | undefined,
  colors: readonly (readonly [string, string])[],
  fallback: string,
): string | unknown[] {
  return field && colors.length
    ? ['match', ['get', field], ...colors.flatMap(([value, color]) => [value, color]), fallback]
    : fallback;
}

/** Builds a guarded numeric line-color ramp, using fallback paint for non-number properties. */
export function lineColorExpression(
  field: string | undefined,
  stops: readonly (readonly [number, string])[],
  fallback: string,
): string | unknown[] {
  if (!field || stops.length < 2) return fallback;
  return [
    'case', ['==', ['typeof', ['get', field]], 'number'],
    ['interpolate', ['linear'], ['number', ['get', field]], ...stops.flatMap(([value, color]) => [value, color])],
    fallback,
  ];
}

/** Builds the cluster count color steps, or returns the layer fallback when there are no stops. */
export function clusterColorExpression(
  stops: readonly (readonly [number, string])[],
  fallback: string | (() => string),
): string | unknown[] {
  return stops.length ? stepExpression(['get', 'point_count'], stops)
    : typeof fallback === 'function' ? fallback() : fallback;
}

/** Returns the opacity expression used to dim selected point categories. */
export function mutedCategoryOpacityExpression(
  field: string,
  categories: readonly string[],
  opacity: number,
): unknown[] {
  return ['match', ['get', field], ...categories.flatMap((value) => [value, opacity]), 1];
}

/** Converts a normalized scalar or ramp radius to MapLibre's data expression. */
export function pointRadiusExpression(radius: number | MapDataLayerPointRadius): number | unknown[] {
  if (typeof radius === 'number') return radius;
  const input: unknown[] = ['number', ['get', radius.field], 0];
  let domainInput: unknown[] = input;
  let stops = radius.stops;
  // Halving an overflow-spanning domain keeps the peer's interpolation subtraction finite.
  if (radius.interpolation === 'linear' && !Number.isFinite(stops.at(-1)![0] - stops[0]![0])) {
    stops = stops.map(([value, output]) => [value / 2, output] as const);
    if (stops.some(([value], index) => index > 0 && value <= stops[index - 1]![0])) return radius.fallback;
    domainInput = ['/', input, 2];
  }
  const output = stops.length === 1 ? stops[0]![1] : radius.interpolation === 'linear'
    ? ['interpolate', ['linear'], domainInput, ...stops.flat()]
    : stepExpression(input, stops);
  return ['case', ['all', ['==', ['typeof', ['get', radius.field]], 'number'],
    ['>=', input, -Number.MAX_VALUE], ['<=', input, Number.MAX_VALUE]], output, radius.fallback];
}

/** `heatmap-weight` for the authored field, or undefined to keep MapLibre's default weight of 1. */
export function heatmapWeightExpression(options: MapDataLayerHeatmapOptions | undefined): unknown[] | undefined {
  const field = options?.weightField ?? '';
  if (!field) return undefined;
  const min = options?.weightRange?.[0] ?? Number.NaN;
  const max = options?.weightRange?.[1] ?? Number.NaN;
  if (!Number.isFinite(min) || !Number.isFinite(max) || min >= max) return ['get', field];
  return ['interpolate', ['linear'], ['get', field], min, 0, max, 1];
}

/** Normalizes a scalar-or-zoom-stop paint value to a bounded MapLibre expression. */
export function heatmapZoomValue(
  value: number | readonly (readonly [number, number])[] | undefined,
  fallback: number,
  min: number,
  max: number,
): number | unknown[] {
  if (typeof value === 'number' || value === undefined) {
    return finiteRange(typeof value === 'number' ? value : Number.NaN, fallback, min, max);
  }
  const stops = value.map(([zoom, output]) => [zoom, finiteRange(output, fallback, min, max)] as const);
  if (stops.length === 0) return fallback;
  if (stops.length === 1) return stops[0]![1];
  const expression: unknown[] = ['interpolate', ['linear'], ['zoom']];
  for (const [zoom, output] of stops) expression.push(zoom, output);
  return expression;
}

/** Prepends the transparent density-zero floor needed when an authored heatmap starts above zero. */
export function heatmapColorExpression(
  authoredStops: readonly (readonly [number, string])[],
  fallbackStops: readonly (readonly [number, string])[] | (() => readonly (readonly [number, string])[]),
): unknown[] {
  const withFloor = (stops: readonly (readonly [number, string])[]) =>
    stops.length && stops[0]![0] > 0 ? [[0, 'rgba(0, 0, 0, 0)'] as const, ...stops] : stops;
  const authored = withFloor(authoredStops);
  const ramp = authored.length >= 2 ? authored
    : withFloor(typeof fallbackStops === 'function' ? fallbackStops() : fallbackStops);
  const expression: unknown[] = ['interpolate', ['linear'], ['heatmap-density']];
  for (const [density, color] of ramp) expression.push(density, color);
  return expression;
}
