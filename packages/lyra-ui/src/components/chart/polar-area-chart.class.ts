import { LyraChart, lockChartType } from './chart.class.js';

/**
 * `<lr-polar-area-chart>` — `<lr-chart>` with `type` locked to `"polarArea"`.
 *
 * @customElement lr-polar-area-chart
 */
export class LyraPolarAreaChart extends LyraChart {
  declare type: 'polarArea';
}

lockChartType(LyraPolarAreaChart, 'polarArea');


declare global {
  interface HTMLElementTagNameMap {
    'lr-polar-area-chart': LyraPolarAreaChart;
  }
}

