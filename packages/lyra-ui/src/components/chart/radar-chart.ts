import { LyraChart, lockChartType } from './chart.js';
import { defineElement } from '../../internal/prefix.js';

/**
 * `<lyra-radar-chart>` — `<lyra-chart>` with `type` locked to `"radar"`.
 *
 * @customElement lyra-radar-chart
 */
export class LyraRadarChart extends LyraChart {
  declare type: 'radar';
}

lockChartType(LyraRadarChart, 'radar');

defineElement('radar-chart', LyraRadarChart);

declare global {
  interface HTMLElementTagNameMap {
    'lyra-radar-chart': LyraRadarChart;
  }
}
