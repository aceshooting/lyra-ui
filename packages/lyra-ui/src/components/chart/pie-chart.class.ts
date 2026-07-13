import { LyraChart, lockChartType } from './chart.class.js';

/**
 * `<lyra-pie-chart>` — `<lyra-chart>` with `type` locked to `"pie"`. Single-series:
 * one `Series` with `data: number[]` and `color: string[]` as the slice palette.
 *
 * @customElement lyra-pie-chart
 */
export class LyraPieChart extends LyraChart {
  declare type: 'pie';
}

lockChartType(LyraPieChart, 'pie');


declare global {
  interface HTMLElementTagNameMap {
    'lyra-pie-chart': LyraPieChart;
  }
}

