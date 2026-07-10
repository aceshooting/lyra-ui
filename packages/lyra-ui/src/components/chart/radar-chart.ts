import { LyraChart } from './chart.js';
import { defineElement } from '../../internal/prefix.js';
import type { LyraChartType } from './chart.js';

/** `<lyra-radar-chart>` — `<lyra-chart>` with `type` locked to `"radar"`. */
export class LyraRadarChart extends LyraChart {
  override type = 'radar' as unknown as LyraChartType;
}

defineElement('radar-chart', LyraRadarChart);

declare global {
  interface HTMLElementTagNameMap {
    'lyra-radar-chart': LyraRadarChart;
  }
}
