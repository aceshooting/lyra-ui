import { LyraChart, lockChartType } from './chart.class.js';

/**
 * `<lr-pie-chart>` — `<lr-chart>` with `type` locked to `"pie"`. Single-series:
 * one `Series` with `data: number[]` and `color: string[]` as the slice palette.
 *
 * @customElement lr-pie-chart
 */
export class LyraPieChart extends LyraChart {
  declare type: 'pie';
}

lockChartType(LyraPieChart, 'pie');


declare global {
  interface HTMLElementTagNameMap {
    'lr-pie-chart': LyraPieChart;
  }
}

