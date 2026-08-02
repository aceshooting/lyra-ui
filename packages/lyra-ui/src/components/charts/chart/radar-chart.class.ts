import { LyraChart, lockChartType } from './chart.class.js';

/**
 * `<lr-radar-chart>` — `<lr-chart>` with `type` locked to `"radar"`.
 *
 * @customElement lr-radar-chart
 * @status stable
 * @since 4.0.0
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

