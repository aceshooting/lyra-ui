import { property } from 'lit/decorators.js';
import { LyraChart, type Series } from './chart.js';
import { defineElement } from '../../internal/prefix.js';
import { binValues } from './histogram-bin.js';

/**
 * `<lyra-histogram>` — bins `values` into `bins` equal-width buckets and
 * renders them as a bar chart. No Chart.js histogram controller exists in
 * any surveyed seed; this composes `binValues()` with the plain `bar` type.
 *
 * @customElement lyra-histogram
 */
export class LyraHistogram extends LyraChart {
  override type = 'bar' as const;

  @property({ type: Number }) bins = 10;
  @property({ attribute: false }) values: number[] = [];
  @property() label = 'Frequency';
}

// `labels`/`datasets` are computed from `values`/`bins` rather than settable
// props. `LyraChart` declares both as plain (decorator-managed) class
// fields, and TypeScript forbids a subclass from re-declaring a base field
// as a getter/setter pair via ordinary class syntax (TS2611) — so the
// accessor pair is installed directly on the prototype instead, which is
// runtime-equivalent (same shadowing semantics as a class-syntax override)
// without tripping that check.
Object.defineProperty(LyraHistogram.prototype, 'labels', {
  configurable: true,
  enumerable: true,
  get(this: LyraHistogram): string[] {
    return binValues(this.values, this.bins).map((b) => b.label);
  },
  set(_v: string[]) {
    /* derived from `values`/`bins`; direct writes are ignored */
  },
});

Object.defineProperty(LyraHistogram.prototype, 'datasets', {
  configurable: true,
  enumerable: true,
  get(this: LyraHistogram): Series[] {
    return [{ label: this.label, data: binValues(this.values, this.bins).map((b) => b.count) }];
  },
  set(_v: Series[]) {
    /* derived from `values`/`bins`; direct writes are ignored */
  },
});

defineElement('histogram', LyraHistogram);

declare global {
  interface HTMLElementTagNameMap {
    'lyra-histogram': LyraHistogram;
  }
}
