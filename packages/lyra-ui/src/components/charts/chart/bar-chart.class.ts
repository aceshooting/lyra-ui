import { LyraChart, type LyraChartType } from './chart.class.js';

/**
 * `<lr-bar-chart>` — `<lr-chart>` with a `"bar"` default. Like the mirrored Web Awesome tag,
 * its writable `type` still accepts the complete chart-type vocabulary.
 *
 * @customElement lr-bar-chart
 * @status stable
 * @since 4.0.0
 */
export class LyraBarChart extends LyraChart {
  override type: LyraChartType = 'bar';
}


declare global {
  interface HTMLElementTagNameMap {
    'lr-bar-chart': LyraBarChart;
  }
}
