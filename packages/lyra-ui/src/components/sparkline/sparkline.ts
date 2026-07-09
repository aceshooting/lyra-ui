import { html, svg, type TemplateResult } from 'lit';
import { property } from 'lit/decorators.js';
import { LyraElement } from '../../internal/lyra-element.js';
import { defineElement } from '../../internal/prefix.js';
import { styles } from './sparkline.styles.js';

const VIEW = 100;

/**
 * `<lyra-sparkline>` — a zero-dependency inline SVG trend chart.
 * Mirrors the Web Awesome `<wa-sparkline>` API under the `lyra-` prefix.
 *
 * @customElement lyra-sparkline
 * @csspart line - The line path (type="line").
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
    const lo = this.min ?? Math.min(...v);
    const hi = this.max ?? Math.max(...v);
    const span = hi - lo || 1;
    return v.map((n, i) => {
      const x = v.length > 1 ? (i / (v.length - 1)) * VIEW : VIEW / 2;
      const y = VIEW - ((n - lo) / span) * VIEW;
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
    if (!v.length) return html`<svg viewBox="0 0 ${VIEW} ${VIEW}"></svg>`;

    const pts = this.points();
    const d = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x},${y}`).join(' ');

    const shape =
      this.type === 'bar'
        ? pts.map(
            ([x, y]) =>
              svg`<rect part="bar" x="${x - 2}" y="${y}" width="4" height="${VIEW - y}"></rect>`,
          )
        : svg`<path part="line" d="${d}"></path>`;

    return html`<svg viewBox="0 0 ${VIEW} ${VIEW}" preserveAspectRatio="none">
      ${this.type === 'area' ? svg`<path part="area" d="${d} L${VIEW},${VIEW} L0,${VIEW} Z"></path>` : ''}
      ${shape}
    </svg>`;
  }
}

defineElement('sparkline', LyraSparkline);

declare global {
  interface HTMLElementTagNameMap {
    'lyra-sparkline': LyraSparkline;
  }
}
