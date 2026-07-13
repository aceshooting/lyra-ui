import { LyraChart, lockChartType } from './chart.js';
import { defineElement } from '../../internal/prefix.js';

/**
 * `<lyra-line-chart>` — `<lyra-chart>` with `type` locked to `"line"`.
 *
 * @customElement lyra-line-chart
 */
export class LyraLineChart extends LyraChart {
  declare type: 'line';
}

lockChartType(LyraLineChart, 'line');

defineElement('line-chart', LyraLineChart);

declare global {
  interface HTMLElementTagNameMap {
    'lyra-line-chart': LyraLineChart;
  }
}
