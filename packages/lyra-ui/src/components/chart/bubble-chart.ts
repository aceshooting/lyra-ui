import { LyraChart } from './chart.js';
import { defineElement } from '../../internal/prefix.js';
import type { LyraChartType } from './chart.js';

/** `<lyra-bubble-chart>` — `<lyra-chart>` with `type` locked to `"bubble"`. Feed points via `Series.points` (each needs an `r` radius field, added by the host as extra keys — Chart.js reads `x`/`y`/`r` off each point object). */
export class LyraBubbleChart extends LyraChart {
  override type = 'bubble' as unknown as LyraChartType;
}

defineElement('bubble-chart', LyraBubbleChart);

declare global {
  interface HTMLElementTagNameMap {
    'lyra-bubble-chart': LyraBubbleChart;
  }
}
