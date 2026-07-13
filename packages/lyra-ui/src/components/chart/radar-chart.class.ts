import { LyraChart, lockChartType } from './chart.class.js';

/**
 * `<lyra-radar-chart>` — `<lyra-chart>` with `type` locked to `"radar"`.
 *
 * @customElement lyra-radar-chart
 */
export class LyraRadarChart extends LyraChart {
  declare type: 'radar';
}

lockChartType(LyraRadarChart, 'radar');


declare global {
  interface HTMLElementTagNameMap {
    'lyra-radar-chart': LyraRadarChart;
  }
}

