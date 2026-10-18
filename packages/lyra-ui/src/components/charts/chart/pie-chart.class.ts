export type { LyraChartPreparedData, LyraChartSourcePointSelectDetail, LyraChartSourceCategorySelectDetail, LyraPreparedSeriesData, LyraPreparedCategoryData, LyraSeriesPointRef } from './chart.class.js';
import { LyraChart, type LyraChartType } from './chart.class.js';

/**
 * `<lr-pie-chart>` — `<lr-chart>` with a `"pie"` default and the mirrored writable type. Single-series:
 * one `LyraChartSeries` with `data: number[]` and `color: string[]` as the slice palette.
 *
 * Prepared-data compatibility follows the current writable type: line accepts series, bar
 * accepts series/categories, radial category types accept categories. Spatial types require
 * their own source route and reject these prepared kinds.
 *
 * @customElement lr-pie-chart
 * @status stable
 * @since 4.0.0
 */
export class LyraPieChart extends LyraChart {
  override type: LyraChartType = 'pie';
}


declare global {
  interface HTMLElementTagNameMap {
    'lr-pie-chart': LyraPieChart;
  }
}
