import { LyraChart } from './chart.js';
import { defineElement } from '../../internal/prefix.js';
import type { LyraChartType } from './chart.js';

/** `<lyra-polar-area-chart>` — `<lyra-chart>` with `type` locked to `"polarArea"`. */
export class LyraPolarAreaChart extends LyraChart {
  override type = 'polarArea' as unknown as LyraChartType;
}

defineElement('polar-area-chart', LyraPolarAreaChart);

declare global {
  interface HTMLElementTagNameMap {
    'lyra-polar-area-chart': LyraPolarAreaChart;
  }
}
