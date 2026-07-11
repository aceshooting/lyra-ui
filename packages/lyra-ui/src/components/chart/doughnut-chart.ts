import { LyraChart } from './chart.js';
import { defineElement } from '../../internal/prefix.js';

/**
 * `<lyra-doughnut-chart>` — `<lyra-chart>` with `type` locked to `"doughnut"`.
 *
 * @customElement lyra-doughnut-chart
 */
export class LyraDoughnutChart extends LyraChart {
  declare type: 'doughnut';
}

// `type` is locked read-only rather than a settable class field with just a
// default value — `LyraChart` declares it as a plain (decorator-managed)
// class field, and TypeScript forbids a subclass from re-declaring a base
// field as a getter/setter pair via ordinary class syntax (TS2611) — so the
// accessor pair is installed directly on the prototype instead, which is
// runtime-equivalent (same shadowing semantics as a class-syntax override)
// without tripping that check.
Object.defineProperty(LyraDoughnutChart.prototype, 'type', {
  configurable: true,
  enumerable: true,
  get(): 'doughnut' {
    return 'doughnut';
  },
  set(_v: 'doughnut') {
    /* locked to 'doughnut'; direct writes are ignored */
  },
});

defineElement('doughnut-chart', LyraDoughnutChart);

declare global {
  interface HTMLElementTagNameMap {
    'lyra-doughnut-chart': LyraDoughnutChart;
  }
}
