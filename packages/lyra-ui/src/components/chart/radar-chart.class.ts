import { LyraChart, lockChartType } from './chart.class.js';

/**
 * `<lr-radar-chart>` — `<lr-chart>` with `type` locked to `"radar"`.
 *
 * @customElement lr-radar-chart
 */
export class LyraRadarChart extends LyraChart {
  declare type: 'radar';
}

lockChartType(LyraRadarChart, 'radar');


declare global {
  interface HTMLElementTagNameMap {
    'lr-radar-chart': LyraRadarChart;
  }
}

