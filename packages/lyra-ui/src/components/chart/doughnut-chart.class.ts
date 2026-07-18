import { LyraChart, lockChartType } from './chart.class.js';

/**
 * `<lr-doughnut-chart>` — `<lr-chart>` with `type` locked to `"doughnut"`.
 *
 * @customElement lr-doughnut-chart
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

