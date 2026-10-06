import { LyraChart, type LyraChartType } from './chart.class.js';

/**
 * `<lr-bubble-chart>` — `<lr-chart>` with a `"bubble"` default and the mirrored writable type. Feed
 * points via `LyraChartSeries.points`, whose exported `LyraChartPoint` type carries
 * `x`/`y`, optional bubble `r` (radius), and an optional per-point `label`.
 *
 * @customElement lr-bubble-chart
 * @status stable
 * @since 4.0.0
 */
export class LyraBubbleChart extends LyraChart {
  override type: LyraChartType = 'bubble';
}


declare global {
  interface HTMLElementTagNameMap {
    'lr-bubble-chart': LyraBubbleChart;
  }
}
