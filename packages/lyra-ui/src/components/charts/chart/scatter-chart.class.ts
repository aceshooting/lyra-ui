import { LyraChart, type LyraChartType } from './chart.class.js';

/**
 * `<lr-scatter-chart>` — `<lr-chart>` with a `"scatter"` default and the mirrored writable type. Feed
 * points via `LyraChartSeries.points`.
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
