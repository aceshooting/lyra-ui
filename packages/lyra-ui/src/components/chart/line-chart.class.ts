import { LyraChart, lockChartType } from './chart.class.js';

/**
 * `<lr-line-chart>` — `<lr-chart>` with `type` locked to `"line"`.
 *
 * @customElement lr-line-chart
 */
export class LyraLineChart extends LyraChart {
  declare type: 'line';
}

lockChartType(LyraLineChart, 'line');


declare global {
  interface HTMLElementTagNameMap {
    'lr-line-chart': LyraLineChart;
  }
}

