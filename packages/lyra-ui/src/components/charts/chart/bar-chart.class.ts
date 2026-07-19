import { LyraChart, lockChartType } from './chart.class.js';

/**
 * `<lr-bar-chart>` — `<lr-chart>` with `type` locked to `"bar"`.
 *
 * @customElement lr-bar-chart
 */
export class LyraBarChart extends LyraChart {
  declare type: 'bar';
}

lockChartType(LyraBarChart, 'bar');


declare global {
  interface HTMLElementTagNameMap {
    'lr-bar-chart': LyraBarChart;
  }
}

