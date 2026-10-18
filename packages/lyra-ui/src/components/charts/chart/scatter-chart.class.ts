export type { LyraSpatialBounds, LyraSpatialChartSource, LyraSpatialChartPoint, LyraSpatialChartSeries, LyraChartSpatialPointSelectDetail, LyraSpatialBinSelectDetail } from './chart.class.js';
export type { LyraChartPreparedData, LyraChartSourcePointSelectDetail, LyraChartSourceCategorySelectDetail, LyraPreparedSeriesData, LyraPreparedCategoryData, LyraSeriesPointRef } from './chart.class.js';
import { LyraChart, type LyraChartType } from './chart.class.js';

/**
 * `<lr-scatter-chart>` — `<lr-chart>` with a `"scatter"` default and the mirrored writable type. Feed
 * points via `LyraChartSeries.points`.
 *
 * Prepared-data compatibility follows the current writable type: line accepts series, bar
 * accepts series/categories, radial category types accept categories. Spatial types require
 * the spatial source route with bounded density and exact original point identity.
 *
 * @customElement lr-scatter-chart
 * @status stable
 * @since 4.0.0
 */
export class LyraScatterChart extends LyraChart {
  override type: LyraChartType = 'scatter';
}


declare global {
  interface HTMLElementTagNameMap {
    'lr-scatter-chart': LyraScatterChart;
  }
}
