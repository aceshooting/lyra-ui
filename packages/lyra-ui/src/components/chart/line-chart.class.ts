import { LyraChart, lockChartType } from './chart.class.js';

/**
 * `<lyra-line-chart>` — `<lyra-chart>` with `type` locked to `"line"`.
 *
 * @customElement lyra-line-chart
 */
export class LyraLineChart extends LyraChart {
  declare type: 'line';
}

lockChartType(LyraLineChart, 'line');


declare global {
  interface HTMLElementTagNameMap {
    'lyra-line-chart': LyraLineChart;
  }
}

