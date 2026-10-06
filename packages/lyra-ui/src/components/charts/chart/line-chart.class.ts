import { LyraChart, type LyraChartType } from './chart.class.js';

/**
 * `<lr-line-chart>` — `<lr-chart>` with a `"line"` default and the mirrored writable type.
 *
 * @customElement lr-line-chart
 * @status stable
 * @since 4.0.0
 */
export class LyraLineChart extends LyraChart {
  override type: LyraChartType = 'line';
}


declare global {
  interface HTMLElementTagNameMap {
    'lr-line-chart': LyraLineChart;
  }
}
