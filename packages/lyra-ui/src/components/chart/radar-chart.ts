import { LyraChart } from './chart.js';
import { defineElement } from '../../internal/prefix.js';

/**
 * `<lyra-radar-chart>` — `<lyra-chart>` with `type` locked to `"radar"`.
 *
 * @customElement lyra-radar-chart
 */
export class LyraRadarChart extends LyraChart {
  declare type: 'radar';
}

// `type` is locked read-only rather than a settable class field with just a
// default value — `LyraChart` declares it as a plain (decorator-managed)
// class field, and TypeScript forbids a subclass from re-declaring a base
// field as a getter/setter pair via ordinary class syntax (TS2611) — so the
// accessor pair is installed directly on the prototype instead, which is
// runtime-equivalent (same shadowing semantics as a class-syntax override)
// without tripping that check.
Object.defineProperty(LyraRadarChart.prototype, 'type', {
  configurable: true,
  enumerable: true,
  get(): 'radar' {
    return 'radar';
  },
  set(_v: 'radar') {
    /* locked to 'radar'; direct writes are ignored */
  },
});

defineElement('radar-chart', LyraRadarChart);

declare global {
  interface HTMLElementTagNameMap {
    'lyra-radar-chart': LyraRadarChart;
  }
}
