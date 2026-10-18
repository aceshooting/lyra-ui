export type { LyraChartPreparedData, LyraChartSourcePointSelectDetail, LyraChartSourceCategorySelectDetail, LyraPreparedSeriesData, LyraPreparedCategoryData, LyraSeriesPointRef } from './chart.class.js';
import { LyraChart, type LyraChartType } from './chart.class.js';

/**
 * `<lr-bar-chart>` — `<lr-chart>` with a `"bar"` default. Like the mirrored Web Awesome tag,
 * its writable `type` still accepts the complete chart-type vocabulary.
 *
 * Prepared-data compatibility follows the current writable type: line accepts series, bar
 * accepts series/categories, radial category types accept categories. Spatial types require
 * their own source route and reject these prepared kinds.
 *
 * @customElement lr-bar-chart
 * @status stable
 * @since 4.0.0
 */
export class LyraBarChart extends LyraChart {
  override type: LyraChartType = 'bar';
}


declare global {
  interface HTMLElementTagNameMap {
    'lr-bar-chart': LyraBarChart;
  }
}
