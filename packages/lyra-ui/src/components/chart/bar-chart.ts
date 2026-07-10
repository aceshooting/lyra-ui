import { LyraChart } from './chart.js';
import { defineElement } from '../../internal/prefix.js';

/** `<lyra-bar-chart>` — `<lyra-chart>` with `type` locked to `"bar"`. */
export class LyraBarChart extends LyraChart {
  override type = 'bar' as const;
}

defineElement('bar-chart', LyraBarChart);

declare global {
  interface HTMLElementTagNameMap {
    'lyra-bar-chart': LyraBarChart;
  }
}
