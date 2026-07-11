import { LyraChart } from './chart.js';
import { defineElement } from '../../internal/prefix.js';

/**
 * `<lyra-scatter-chart>` — `<lyra-chart>` with `type` locked to `"scatter"`. Feed
 * points via `Series.points`.
 *
 * @customElement lyra-scatter-chart
 */
export class LyraScatterChart extends LyraChart {
  declare type: 'scatter';
}

// `type` is locked read-only rather than a settable class field with just a
// default value — `LyraChart` declares it as a plain (decorator-managed)
// class field, and TypeScript forbids a subclass from re-declaring a base
// field as a getter/setter pair via ordinary class syntax (TS2611) — so the
// accessor pair is installed directly on the prototype instead, which is
// runtime-equivalent (same shadowing semantics as a class-syntax override)
// without tripping that check.
Object.defineProperty(LyraScatterChart.prototype, 'type', {
  configurable: true,
  enumerable: true,
  get(): 'scatter' {
    return 'scatter';
  },
  set(_v: 'scatter') {
    /* locked to 'scatter'; direct writes are ignored */
  },
});

defineElement('scatter-chart', LyraScatterChart);

declare global {
  interface HTMLElementTagNameMap {
    'lyra-scatter-chart': LyraScatterChart;
  }
}
