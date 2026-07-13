import { LyraChart, lockChartType } from './chart.js';
import { defineElement } from '../../internal/prefix.js';

/**
 * `<lyra-bar-chart>` — `<lyra-chart>` with `type` locked to `"bar"`.
 *
 * @customElement lyra-bar-chart
 */
export class LyraBarChart extends LyraChart {
  declare type: 'bar';
}

lockChartType(LyraBarChart, 'bar');

defineElement('bar-chart', LyraBarChart);

declare global {
  interface HTMLElementTagNameMap {
    'lyra-bar-chart': LyraBarChart;
  }
}
