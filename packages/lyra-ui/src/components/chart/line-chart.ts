import { LyraChart } from './chart.js';
import { defineElement } from '../../internal/prefix.js';

/**
 * `<lyra-line-chart>` — `<lyra-chart>` with `type` locked to `"line"`.
 *
 * @customElement lyra-line-chart
 */
export class LyraLineChart extends LyraChart {
  declare type: 'line';
}

// `type` is locked read-only rather than a settable class field with just a
// default value — `LyraChart` declares it as a plain (decorator-managed)
// class field, and TypeScript forbids a subclass from re-declaring a base
// field as a getter/setter pair via ordinary class syntax (TS2611) — so the
// accessor pair is installed directly on the prototype instead, which is
// runtime-equivalent (same shadowing semantics as a class-syntax override)
// without tripping that check.
Object.defineProperty(LyraLineChart.prototype, 'type', {
  configurable: true,
  enumerable: true,
  get(): 'line' {
    return 'line';
  },
  set(_v: 'line') {
    /* locked to 'line'; direct writes are ignored */
  },
});

defineElement('line-chart', LyraLineChart);

declare global {
  interface HTMLElementTagNameMap {
    'lyra-line-chart': LyraLineChart;
  }
}
