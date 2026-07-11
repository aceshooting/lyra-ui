import { LyraChart } from './chart.js';
import { defineElement } from '../../internal/prefix.js';

/**
 * `<lyra-polar-area-chart>` — `<lyra-chart>` with `type` locked to `"polarArea"`.
 *
 * @customElement lyra-polar-area-chart
 */
export class LyraPolarAreaChart extends LyraChart {
  declare type: 'polarArea';
}

// `type` is locked read-only rather than a settable class field with just a
// default value — `LyraChart` declares it as a plain (decorator-managed)
// class field, and TypeScript forbids a subclass from re-declaring a base
// field as a getter/setter pair via ordinary class syntax (TS2611) — so the
// accessor pair is installed directly on the prototype instead, which is
// runtime-equivalent (same shadowing semantics as a class-syntax override)
// without tripping that check.
Object.defineProperty(LyraPolarAreaChart.prototype, 'type', {
  configurable: true,
  enumerable: true,
  get(): 'polarArea' {
    return 'polarArea';
  },
  set(_v: 'polarArea') {
    /* locked to 'polarArea'; direct writes are ignored */
  },
});

defineElement('polar-area-chart', LyraPolarAreaChart);

declare global {
  interface HTMLElementTagNameMap {
    'lyra-polar-area-chart': LyraPolarAreaChart;
  }
}
