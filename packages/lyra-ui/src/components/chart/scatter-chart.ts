import { LyraChart } from './chart.js';
import { defineElement } from '../../internal/prefix.js';

/**
 * `<lyra-scatter-chart>` — `<lyra-chart>` with `type` locked to `"scatter"`. Feed
 * points via `Series.points`.
 *
 * @customElement lyra-scatter-chart
 */
export class LyraScatterChart extends LyraChart {
  override type = 'scatter' as const;
}

defineElement('scatter-chart', LyraScatterChart);

declare global {
  interface HTMLElementTagNameMap {
    'lyra-scatter-chart': LyraScatterChart;
  }
}
