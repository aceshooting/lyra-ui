export type { LyraChartPreparedData, LyraChartSourcePointSelectDetail, LyraChartSourceCategorySelectDetail, LyraPreparedSeriesData, LyraPreparedCategoryData, LyraSeriesPointRef } from './chart.class.js';
import { LyraChart, type LyraChartType } from './chart.class.js';

/**
 * `<lr-radar-chart>` — `<lr-chart>` with a `"radar"` default and the mirrored writable type.
 *
 * Prepared-data compatibility follows the current writable type: line accepts series, bar
 * accepts series/categories, radial category types accept categories. Spatial types require
 * their own source route and reject these prepared kinds.
 *
 * @customElement lr-radar-chart
 * @status stable
 * @since 4.0.0
 */
export class LyraRadarChart extends LyraChart {
  override type: LyraChartType = 'radar';
}


declare global {
  interface HTMLElementTagNameMap {
    'lr-radar-chart': LyraRadarChart;
  }
}
