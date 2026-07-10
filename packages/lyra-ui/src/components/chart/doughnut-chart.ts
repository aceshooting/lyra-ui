import { LyraChart } from './chart.js';
import { defineElement } from '../../internal/prefix.js';
import type { LyraChartType } from './chart.js';

/** `<lyra-doughnut-chart>` — `<lyra-chart>` with `type` locked to `"doughnut"`. */
export class LyraDoughnutChart extends LyraChart {
  override type = 'doughnut' as unknown as LyraChartType;
}

defineElement('doughnut-chart', LyraDoughnutChart);

declare global {
  interface HTMLElementTagNameMap {
    'lyra-doughnut-chart': LyraDoughnutChart;
  }
}
