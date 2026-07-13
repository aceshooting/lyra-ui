import { LyraChart, lockChartType } from './chart.class.js';

/**
 * `<lyra-doughnut-chart>` — `<lyra-chart>` with `type` locked to `"doughnut"`.
 *
 * @customElement lyra-doughnut-chart
 */
export class LyraDoughnutChart extends LyraChart {
  declare type: 'doughnut';
}

lockChartType(LyraDoughnutChart, 'doughnut');


declare global {
  interface HTMLElementTagNameMap {
    'lyra-doughnut-chart': LyraDoughnutChart;
  }
}

