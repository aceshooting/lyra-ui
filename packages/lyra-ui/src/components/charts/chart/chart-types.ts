import type { LyraVariant } from '../../../internal/variants.js';

export interface LyraChartPoint {
  readonly x: number;
  readonly y: number;
  /** Bubble radius. Ignored by chart types that do not consume a radius. */
  readonly r?: number;
  /**
   * Optional caller-owned primitive identity retained by activation events. Objects, symbols,
   * and non-finite numbers are ignored so event payloads remain bounded and descriptor-safe.
   */
  readonly id?: string | number;
  /**
   * Caller-owned per-point label retained verbatim by events/export and interpolated into the
   * localized whole-point message used by descriptions, tables, and keyboard announcements.
   */
  readonly label?: string;
}

export interface LyraChartSeries {
  readonly label: string;
  readonly data?: readonly (number | null)[];
  readonly points?: readonly LyraChartPoint[];
  readonly color?: string | readonly string[];
  readonly fill?: boolean;
  readonly width?: number;
  readonly dash?: boolean;
  readonly noTooltip?: boolean;
  readonly axis?: 'y' | 'y2';
  /**
   * Chart.js dataset `stack` group id. Series sharing the same `stack` value on the same axis
   * accumulate into one stack; a different id starts an independent stack that Chart.js draws
   * side by side with the first on that same (stacked) axis. Omitted series default to Chart.js's
   * own ungrouped stack. Only meaningful on
   * an axis that is actually stacked -- see `LyraChart.stacked`/`LyraChart.stackedAxes`.
   */
  readonly stack?: string;
  readonly pointColors?: readonly string[];
  /**
   * Per-point radius. A single number applies to every point; an array (matching `data`'s
   * length) sets each point independently — passed straight through to Chart.js, which
   * supports both natively.
   */
  readonly pointRadius?: number | readonly number[];
  /**
   * Per-segment (the line between two consecutive points) border color, indexed by the
   * *starting* point of each segment — e.g. `['red', 'green']` on 3 points colors the first
   * segment red and the second green. Wired to Chart.js's `segment.borderColor`, and cycled
   * when shorter than the segment count. Sampled segments retain the original source starting
   * point's palette index. Only meaningful for line-type series.
   */
  readonly segmentColors?: readonly string[];
  /**
   * Per-series renderer. `'line'`/`'bar'` override the chart type for a mixed chart. `'band'`
   * draws a filled range between `lower` and `upper` (a confidence interval or percentile
   * envelope) beneath every line, on `line` and `bar` charts; `data` is then ignored. The fill uses
   * the series color at `--lr-chart-band-opacity`, and the tooltip, legend swatch, generated data
   * table, keyboard announcement and CSV export carry both bounds.
   */
  readonly type?: 'line' | 'bar' | 'band';
  /**
   * Lower bound per category for a `type: 'band'` series. `lower` and `upper` are clamped to the
   * shorter of the two (with a development warning); a row missing either bound is a gap, and a
   * row whose bounds are reversed is reordered.
   */
  readonly lower?: readonly (number | null)[];
  /** Upper bound per category for a `type: 'band'` series; see `lower`. */
  readonly upper?: readonly (number | null)[];
}


export type LyraChartIndexAxis = 'x' | 'y';

/**
 * One declarative chart annotation: a reference line (`value`) or a shaded band (`from`/`to`) on
 * the named axis.
 *
 * `value` and `from`/`to` are mutually exclusive; an entry supplying neither, or non-finite
 * numbers, is dropped rather than handed to Chart.js, where it would silently render nothing or
 * throw. `axis` defaults to `'y'`, the value axis for the common threshold case.
 */
export interface LyraChartAnnotation {
  readonly axis?: LyraChartIndexAxis;
  readonly value?: number;
  readonly from?: number;
  readonly to?: number;
  readonly label?: string;
  readonly tone?: LyraVariant;
}

/** A Chart.js-compatible plugin shape without making `chart.js` a type dependency for consumers. */
export interface LyraChartPlugin {
  readonly id: string;
}

/** Dataset configuration accepted by the raw `config` passthrough. */
export interface LyraChartDatasetConfiguration {
  type?: string;
  label?: unknown;
  data?: unknown[];
  hidden?: boolean;
  axis?: string;
  yAxisID?: string;
  stack?: string;
  noTooltip?: boolean;
  fill?: unknown;
  backgroundColor?: unknown;
  borderColor?: unknown;
  borderRadius?: unknown;
  borderWidth?: unknown;
  borderDash?: unknown;
  color?: unknown;
  pointStyle?: unknown;
  pointBackgroundColor?: unknown;
  pointRadius?: unknown;
  segment?: unknown;
}

/** Data block accepted by the raw `config` passthrough. */
export interface LyraChartDataConfiguration {
  labels?: unknown[];
  datasets?: LyraChartDatasetConfiguration[];
}

/**
 * Peer-neutral structural configuration accepted by `LyraChart.config`.
 * Install `chart.js` and use its own `ChartConfiguration` type when stricter
 * controller-specific checking is useful; that type remains structurally
 * assignable to this passthrough surface.
 */
export interface LyraChartConfiguration {
  type?: string;
  data?: LyraChartDataConfiguration;
  options?: object;
  plugins?: LyraChartPlugin[];
}

export interface LyraChartArea {
  readonly top: number;
  readonly left: number;
  readonly right: number;
  readonly bottom: number;
  readonly width: number;
  readonly height: number;
}

/** A single Chart.js hit-test result, as returned by `LyraChartInstance.getElementsAtEventForMode()`.
 *  Exported so the documented `LyraChartInstance` reference (`llms/charts.md`) names a real,
 *  importable symbol instead of an inaccessible internal interface. */
export interface ChartHit {
  datasetIndex: number;
  index: number;
}

/** Structural shape of a live Chart.js instance, without imposing `chart.js` as a type dependency
 *  on consumers. Exported so `LyraChartInstance`'s documented `extends RuntimeChart` reference
 *  names a real, importable symbol. */
export interface RuntimeChart {
  render?(): void;
  data: {
    labels?: unknown[];
    datasets: LyraChartDatasetConfiguration[];
  };
  options: Record<string, unknown>;
  config: { type?: unknown };
  legend?: unknown;
  chartArea?: LyraChartArea;
  destroy(): void;
  update(mode?: string): void;
  toBase64Image?(): string;
  getElementsAtEventForMode(
    event: Event,
    mode: string,
    options: Record<string, unknown>,
    useFinalPosition: boolean
  ): ChartHit[];
  getDatasetMeta?(index: number): { hidden: boolean | null };
  isDatasetVisible(index: number): boolean;
  setDatasetVisibility(index: number, visible: boolean): void;
  getDataVisibility?(index: number): boolean;
  toggleDataVisibility?(index: number): void;
  getZoomedScaleBounds?(): Record<string, { min: number; max: number } | undefined>;
  zoomScale?(id: string, range: { min: number; max: number }, mode?: string): void;
}

/** Public structural view of the current Chart.js instance, without imposing `chart.js` as a
 * type dependency on consumers. The value is `undefined` before the peer loads and after the
 * component disconnects. */
export interface LyraChartInstance extends RuntimeChart {}
