import { LyraChart, type LyraChartType } from './chart.class.js';

/**
 * `<lr-doughnut-chart>` — `<lr-chart>` with a `"doughnut"` default and the mirrored writable type.
 *
 * @customElement lr-doughnut-chart
 * @status stable
 * @since 4.0.0
 */
export class LyraDoughnutChart extends LyraChart {
  override type: LyraChartType = 'doughnut';
}


declare global {
  interface HTMLElementTagNameMap {
    'lr-doughnut-chart': LyraDoughnutChart;
  }
}
