import { LyraChart } from './chart.js';
import { defineElement } from '../../internal/prefix.js';

/**
 * `<lyra-bar-chart>` — `<lyra-chart>` with `type` locked to `"bar"`.
 *
 * @customElement lyra-bar-chart
 */
export class LyraBarChart extends LyraChart {
  declare type: 'bar';
}

// `type` is locked read-only rather than a settable class field with just a
// default value — `LyraChart` declares it as a plain (decorator-managed)
// class field, and TypeScript forbids a subclass from re-declaring a base
// field as a getter/setter pair via ordinary class syntax (TS2611) — so the
// accessor pair is installed directly on the prototype instead, which is
// runtime-equivalent (same shadowing semantics as a class-syntax override)
// without tripping that check.
Object.defineProperty(LyraBarChart.prototype, 'type', {
  configurable: true,
  enumerable: true,
  get(): 'bar' {
    return 'bar';
  },
  set(_v: 'bar') {
    /* locked to 'bar'; direct writes are ignored */
  },
});

defineElement('bar-chart', LyraBarChart);

declare global {
  interface HTMLElementTagNameMap {
    'lyra-bar-chart': LyraBarChart;
  }
}
