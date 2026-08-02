import { LyraChart, lockChartType } from './chart.class.js';

/**
 * `<lr-doughnut-chart>` — `<lr-chart>` with `type` locked to `"doughnut"`.
 *
 * @customElement lr-doughnut-chart
 * @status stable
 * @since 4.0.0
 */
export class LyraDoughnutChart extends LyraChart {
  declare type: 'doughnut';
}

lockChartType(LyraDoughnutChart, 'doughnut');


declare global {
  interface HTMLElementTagNameMap {
    'lr-doughnut-chart': LyraDoughnutChart;
  }
}

