import { LyraChart, lockChartType } from './chart.class.js';

/**
 * `<lyra-scatter-chart>` — `<lyra-chart>` with `type` locked to `"scatter"`. Feed
 * points via `Series.points`.
 *
 * @customElement lyra-scatter-chart
 */
export class LyraScatterChart extends LyraChart {
  declare type: 'scatter';
}

lockChartType(LyraScatterChart, 'scatter');


declare global {
  interface HTMLElementTagNameMap {
    'lyra-scatter-chart': LyraScatterChart;
  }
}

