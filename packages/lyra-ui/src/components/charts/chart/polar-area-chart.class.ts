import { LyraChart, type LyraChartType } from './chart.class.js';

/**
 * `<lr-polar-area-chart>` — `<lr-chart>` with a `"polarArea"` default and the mirrored writable type.
 *
 * @customElement lr-polar-area-chart
 * @status stable
 * @since 4.0.0
 */
export class LyraPolarAreaChart extends LyraChart {
  override type: LyraChartType = 'polarArea';
}


declare global {
  interface HTMLElementTagNameMap {
    'lr-polar-area-chart': LyraPolarAreaChart;
  }
}
