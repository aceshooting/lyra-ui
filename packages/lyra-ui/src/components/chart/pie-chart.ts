import { LyraChart } from './chart.js';
import { defineElement } from '../../internal/prefix.js';
import type { LyraChartType } from './chart.js';

/** `<lyra-pie-chart>` — `<lyra-chart>` with `type` locked to `"pie"`. Single-series: one `Series` with `data: number[]` and `color: string[]` as the slice palette. */
export class LyraPieChart extends LyraChart {
  override type = 'pie' as unknown as LyraChartType;
}

defineElement('pie-chart', LyraPieChart);

declare global {
  interface HTMLElementTagNameMap {
    'lyra-pie-chart': LyraPieChart;
  }
}
