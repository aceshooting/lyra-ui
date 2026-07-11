import { LyraChart } from './chart.js';
import { defineElement } from '../../internal/prefix.js';

/**
 * `<lyra-pie-chart>` — `<lyra-chart>` with `type` locked to `"pie"`. Single-series:
 * one `Series` with `data: number[]` and `color: string[]` as the slice palette.
 *
 * @customElement lyra-pie-chart
 */
export class LyraPieChart extends LyraChart {
  declare type: 'pie';
}

// `type` is locked read-only rather than a settable class field with just a
// default value — `LyraChart` declares it as a plain (decorator-managed)
// class field, and TypeScript forbids a subclass from re-declaring a base
// field as a getter/setter pair via ordinary class syntax (TS2611) — so the
// accessor pair is installed directly on the prototype instead, which is
// runtime-equivalent (same shadowing semantics as a class-syntax override)
// without tripping that check.
Object.defineProperty(LyraPieChart.prototype, 'type', {
  configurable: true,
  enumerable: true,
  get(): 'pie' {
    return 'pie';
  },
  set(_v: 'pie') {
    /* locked to 'pie'; direct writes are ignored */
  },
});

defineElement('pie-chart', LyraPieChart);

declare global {
  interface HTMLElementTagNameMap {
    'lyra-pie-chart': LyraPieChart;
  }
}
