import { LyraChart, lockChartType } from './chart.class.js';

/**
 * `<lr-scatter-chart>` — `<lr-chart>` with `type` locked to `"scatter"`. Feed
 * points via `Series.points`.
 *
 * @customElement lr-scatter-chart
 * @status stable
 * @since 4.0.0
 */
export class LyraScatterChart extends LyraChart {
  declare type: 'scatter';
}

lockChartType(LyraScatterChart, 'scatter');


declare global {
  interface HTMLElementTagNameMap {
    'lr-scatter-chart': LyraScatterChart;
  }
}

