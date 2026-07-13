import { LyraChart, lockChartType } from './chart.class.js';

/**
 * `<lyra-bar-chart>` — `<lyra-chart>` with `type` locked to `"bar"`.
 *
 * @customElement lyra-bar-chart
 */
export class LyraBarChart extends LyraChart {
  declare type: 'bar';
}

lockChartType(LyraBarChart, 'bar');


declare global {
  interface HTMLElementTagNameMap {
    'lyra-bar-chart': LyraBarChart;
  }
}

