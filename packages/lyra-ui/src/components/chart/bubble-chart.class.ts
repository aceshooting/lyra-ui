import { LyraChart, lockChartType } from './chart.class.js';

/**
 * `<lyra-bubble-chart>` — `<lyra-chart>` with `type` locked to `"bubble"`. Feed
 * points via `Series.points`, each needing an `x`/`y`/`r` (radius) triple —
 * cast the array through `as unknown as Series['points']` (or a local
 * `BubblePoint` type) when constructing it, since `Series.points` itself is
 * typed as `{ x; y; label? }[]` with no `r` field.
 *
 * @customElement lyra-bubble-chart
 */
export class LyraBubbleChart extends LyraChart {
  declare type: 'bubble';
}

lockChartType(LyraBubbleChart, 'bubble');


declare global {
  interface HTMLElementTagNameMap {
    'lyra-bubble-chart': LyraBubbleChart;
  }
}

