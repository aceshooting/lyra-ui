import { LyraChart, type LyraChartType } from './chart.class.js';

/**
 * `<lr-pie-chart>` — `<lr-chart>` with a `"pie"` default and the mirrored writable type. Single-series:
 * one `LyraChartSeries` with `data: number[]` and `color: string[]` as the slice palette.
 *
 * @customElement lr-pie-chart
 * @status stable
 * @since 4.0.0
 */
export class LyraPieChart extends LyraChart {
  override type: LyraChartType = 'pie';
}


declare global {
  interface HTMLElementTagNameMap {
    'lr-pie-chart': LyraPieChart;
  }
}
