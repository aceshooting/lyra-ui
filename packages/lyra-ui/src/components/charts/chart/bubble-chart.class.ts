export type { LyraSpatialBounds, LyraSpatialChartSource, LyraSpatialChartPoint, LyraSpatialChartSeries, LyraChartSpatialPointSelectDetail, LyraSpatialBinSelectDetail } from './chart.class.js';
export type { LyraChartPreparedData, LyraChartSourcePointSelectDetail, LyraChartSourceCategorySelectDetail, LyraPreparedSeriesData, LyraPreparedCategoryData, LyraSeriesPointRef } from './chart.class.js';
import { LyraChart, type LyraChartType } from './chart.class.js';

/**
 * `<lr-bubble-chart>` — `<lr-chart>` with a `"bubble"` default and the mirrored writable type. Feed
 * points via `LyraChartSeries.points`, whose exported `LyraChartPoint` type carries
 * `x`/`y`, optional bubble `r` (radius), and an optional per-point `label`.
 *
 * Prepared-data compatibility follows the current writable type: line accepts series, bar
 * accepts series/categories, radial category types accept categories. Spatial types require
 * the spatial source route with bounded density and exact original point identity.
 *
 * @customElement lr-bubble-chart
 * @status stable
 * @since 4.0.0
 */
export class LyraBubbleChart extends LyraChart {
  override type: LyraChartType = 'bubble';
}


declare global {
  interface HTMLElementTagNameMap {
    'lr-bubble-chart': LyraBubbleChart;
  }
}
