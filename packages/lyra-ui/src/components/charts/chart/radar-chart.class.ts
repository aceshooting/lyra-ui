import { LyraChart, type LyraChartType } from './chart.class.js';

/**
 * `<lr-radar-chart>` — `<lr-chart>` with a `"radar"` default and the mirrored writable type.
 *
 * @customElement lr-radar-chart
 * @status stable
 * @since 4.0.0
 */
export class LyraRadarChart extends LyraChart {
  override type: LyraChartType = 'radar';
}


declare global {
  interface HTMLElementTagNameMap {
    'lr-radar-chart': LyraRadarChart;
  }
}
