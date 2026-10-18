export type { LyraChartPreparedData, LyraChartSourcePointSelectDetail, LyraChartSourceCategorySelectDetail, LyraPreparedSeriesData, LyraPreparedCategoryData, LyraSeriesPointRef } from './chart.class.js';
import { LyraChart, type LyraChartType } from './chart.class.js';

/**
 * `<lr-line-chart>` — `<lr-chart>` with a `"line"` default and the mirrored writable type.
 *
 * Prepared-data compatibility follows the current writable type: line accepts series, bar
 * accepts series/categories, radial category types accept categories. Spatial types require
 * their own source route and reject these prepared kinds.
 *
 * @customElement lr-line-chart
 * @status stable
 * @since 4.0.0
 */
export class LyraLineChart extends LyraChart {
  override type: LyraChartType = 'line';
}


declare global {
  interface HTMLElementTagNameMap {
    'lr-line-chart': LyraLineChart;
  }
}
