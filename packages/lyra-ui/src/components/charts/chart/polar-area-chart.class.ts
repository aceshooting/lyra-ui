export type { LyraChartPreparedData, LyraChartSourcePointSelectDetail, LyraChartSourceCategorySelectDetail, LyraPreparedSeriesData, LyraPreparedCategoryData, LyraSeriesPointRef } from './chart.class.js';
import { LyraChart, type LyraChartType } from './chart.class.js';

/**
 * `<lr-polar-area-chart>` — `<lr-chart>` with a `"polarArea"` default and the mirrored writable type.
 *
 * Prepared-data compatibility follows the current writable type: line accepts series, bar
 * accepts series/categories, radial category types accept categories. Spatial types require
 * their own source route and reject these prepared kinds.
 *
 * @customElement lr-polar-area-chart
 * @status stable
 * @since 4.0.0
 */
export class LyraPolarAreaChart extends LyraChart {
  override type: LyraChartType = 'polarArea';
}


declare global {
  interface HTMLElementTagNameMap {
    'lr-polar-area-chart': LyraPolarAreaChart;
  }
}
