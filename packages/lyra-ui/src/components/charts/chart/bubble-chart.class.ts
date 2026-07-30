import { LyraChart, lockChartType } from './chart.class.js';

/**
 * `<lr-bubble-chart>` — `<lr-chart>` with `type` locked to `"bubble"`. Feed
 * points via `Series.points`, whose exported `ChartPoint` type carries
 * `x`/`y`, optional bubble `r` (radius), and an optional per-point `label`.
 *
 * @customElement lr-bubble-chart
 */
export class LyraBubbleChart extends LyraChart {
  declare type: 'bubble';
}

lockChartType(LyraBubbleChart, 'bubble');


declare global {
  interface HTMLElementTagNameMap {
    'lr-bubble-chart': LyraBubbleChart;
  }
}
