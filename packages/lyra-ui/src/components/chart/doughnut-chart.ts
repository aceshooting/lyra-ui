import { LyraChart, lockChartType } from './chart.js';
import { defineElement } from '../../internal/prefix.js';

/**
 * `<lyra-doughnut-chart>` — `<lyra-chart>` with `type` locked to `"doughnut"`.
 *
 * @customElement lyra-doughnut-chart
 */
export class LyraDoughnutChart extends LyraChart {
  declare type: 'doughnut';
}

lockChartType(LyraDoughnutChart, 'doughnut');

defineElement('doughnut-chart', LyraDoughnutChart);

declare global {
  interface HTMLElementTagNameMap {
    'lyra-doughnut-chart': LyraDoughnutChart;
  }
}
