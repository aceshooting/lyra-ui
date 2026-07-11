import { LyraChart } from './chart.js';
import { defineElement } from '../../internal/prefix.js';

/**
 * `<lyra-bubble-chart>` — `<lyra-chart>` with `type` locked to `"bubble"`. Feed
 * points via `Series.points`, each needing an `x`/`y`/`r` (radius) triple —
 * cast the array through `as unknown as Series['points']` (or a local
 * `BubblePoint` type) when constructing it, since `Series.points` itself is
 * typed as `{ x; y; label? }[]` with no `r` field.
 *
 * @customElement lyra-bubble-chart
 */
export class LyraBubbleChart extends LyraChart {
  declare type: 'bubble';
}

// `type` is locked read-only rather than a settable class field with just a
// default value — `LyraChart` declares it as a plain (decorator-managed)
// class field, and TypeScript forbids a subclass from re-declaring a base
// field as a getter/setter pair via ordinary class syntax (TS2611) — so the
// accessor pair is installed directly on the prototype instead, which is
// runtime-equivalent (same shadowing semantics as a class-syntax override)
// without tripping that check.
Object.defineProperty(LyraBubbleChart.prototype, 'type', {
  configurable: true,
  enumerable: true,
  get(): 'bubble' {
    return 'bubble';
  },
  set(_v: 'bubble') {
    /* locked to 'bubble'; direct writes are ignored */
  },
});

defineElement('bubble-chart', LyraBubbleChart);

declare global {
  interface HTMLElementTagNameMap {
    'lyra-bubble-chart': LyraBubbleChart;
  }
}
