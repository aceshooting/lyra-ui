import { LyraChart, lockChartType } from './chart.js';
import { defineElement } from '../../internal/prefix.js';

/**
 * `<lyra-polar-area-chart>` — `<lyra-chart>` with `type` locked to `"polarArea"`.
 *
 * @customElement lyra-polar-area-chart
 */
export class LyraPolarAreaChart extends LyraChart {
  declare type: 'polarArea';
}

lockChartType(LyraPolarAreaChart, 'polarArea');

defineElement('polar-area-chart', LyraPolarAreaChart);

declare global {
  interface HTMLElementTagNameMap {
    'lyra-polar-area-chart': LyraPolarAreaChart;
  }
}
