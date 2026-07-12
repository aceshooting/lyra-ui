import { html, svg, type TemplateResult } from 'lit';
import { property } from 'lit/decorators.js';
import { LyraElement } from '../../internal/lyra-element.js';
import { defineElement } from '../../internal/prefix.js';
import { styles } from './sparkline.styles.js';

const VIEW = 100;

// A <rect> per bar doesn't collapse into one path the way line/area do, so an
// unbounded `values` array turns directly into that many shadow-DOM nodes.
// Capping it keeps worst-case DOM size bounded without affecting any
// realistically-sized bar chart.
const MAX_BARS = 500;

function decimate<T>(arr: ReadonlyArray<T>, max: number): T[] {
  const step = arr.length / max;
  return Array.from({ length: max }, (_, i) => arr[Math.floor(i * step)]);
}

/**
 * `<lyra-sparkline>` — a zero-dependency inline SVG trend chart.
 * Mirrors the Web Awesome `<wa-sparkline>` API under the `lyra-` prefix.
 *
 * @customElement lyra-sparkline
 * @csspart line - The stroked line path (type="line" and type="area").
 * @csspart area - The filled area under the line (type="area").
 * @csspart bar - Each bar rectangle (type="bar").
 */
export class LyraSparkline extends LyraElement {
  static styles = [LyraElement.styles, styles];

  /** The data series to plot. */
  @property({ type: Array }) values: number[] = [];

  /** Rendering style. */
  @property() type: 'line' | 'bar' | 'area' = 'line';

  /** Lower bound of the value scale (defaults to the data minimum). */
  @property({ type: Number }) min?: number;

  /** Upper bound of the value scale (defaults to the data maximum). */
  @property({ type: Number }) max?: number;

  private points(): ReadonlyArray<readonly [number, number]> {
    const v = this.values;
    let autoLo = v[0];
    let autoHi = v[0];
    for (const n of v) {
      if (n < autoLo) autoLo = n;
      if (n > autoHi) autoHi = n;
    }
    const lo = this.min ?? autoLo;
    const hi = this.max ?? autoHi;
    const span = hi - lo;
    return v.map((n, i) => {
      const x = v.length > 1 ? (i / (v.length - 1)) * VIEW : VIEW / 2;
      const y = span === 0 ? VIEW / 2 : VIEW - ((n - lo) / span) * VIEW;
      return [x, y] as const;
    });
  }

  protected willUpdate(): void {
    const v = this.values;
    this.setAttribute('role', 'img');
    this.setAttribute(
      'aria-label',
      v.length ? `Trend of ${v.length} values, last ${v.at(-1)}` : 'No data',
    );
  }

  render(): TemplateResult {
    const v = this.values;
    if (!v.length) {
      return html`<svg viewBox="0 0 ${VIEW} ${VIEW}" aria-hidden="true"></svg>`;
    }

    const pts = this.points();

    if (this.type === 'bar') {
      const barPts = pts.length > MAX_BARS ? decimate(pts, MAX_BARS) : pts;
      const bars = barPts.map(([x, y]) => {
        const barY = Math.min(y, VIEW);
        return svg`<rect part="bar" x="${x - 2}" y="${barY}" width="4" height="${VIEW - barY}"></rect>`;
      });
      return html`<svg viewBox="0 0 ${VIEW} ${VIEW}" preserveAspectRatio="none" aria-hidden="true">
        ${bars}
      </svg>`;
    }

    const d =
      pts.length > 1
        ? pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x},${y}`).join(' ')
        : `M${pts[0][0]},${pts[0][1]} L${pts[0][0]},${pts[0][1]}`;

    return html`<svg viewBox="0 0 ${VIEW} ${VIEW}" preserveAspectRatio="none" aria-hidden="true">
      ${this.type === 'area' ? svg`<path part="area" d="${d} L${VIEW},${VIEW} L0,${VIEW} Z"></path>` : ''}
      <path part="line" d="${d}"></path>
    </svg>`;
  }
}

defineElement('sparkline', LyraSparkline);

declare global {
  interface HTMLElementTagNameMap {
    'lyra-sparkline': LyraSparkline;
  }
}
