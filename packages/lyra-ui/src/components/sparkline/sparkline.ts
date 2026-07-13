import { html, svg, type TemplateResult } from 'lit';
import { property } from 'lit/decorators.js';
import { LyraElement } from '../../internal/lyra-element.js';
import { defineElement } from '../../internal/prefix.js';
import { styles } from './sparkline.styles.js';

const VIEW = 100;

// A <rect> per bar doesn't collapse into one path the way line/area do, so an
// unbounded `values` array turns directly into that many shadow-DOM nodes --
// and an uncapped line/area path string grows without bound too. Capping the
// point count up front (shared by every render type) keeps worst-case
// DOM/compute bounded without affecting any realistically-sized chart.
const MAX_POINTS = 500; // shared point-count cap for every render type (line/area/bar)

function decimate<T>(arr: ReadonlyArray<T>, max: number): T[] {
  if (arr.length <= max) return [...arr];
  const step = (arr.length - 1) / (max - 1); // anchors both the first AND last sample exactly
  return Array.from({ length: max }, (_, i) => arr[Math.round(i * step)]);
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
    // Non-finite samples (NaN/undefined/null from upstream computed data)
    // can't be plotted or compared -- drop them up front so one bad point
    // can't inject a literal "NaN" into the path `d` string and truncate
    // every point that follows it.
    const raw = this.values.filter((n): n is number => Number.isFinite(n));
    // Auto min/max is scanned from the full, pre-decimation `values` -- doing
    // this after decimating would silently narrow the scale to whatever the
    // sampled subset happens to contain, which can clip or misproportion a
    // real extreme value that decimation happened to drop. Skip the scan
    // entirely when both bounds are already given explicitly -- its result
    // would just be discarded.
    let autoLo = raw[0];
    let autoHi = raw[0];
    if (this.min === undefined || this.max === undefined) {
      for (const n of raw) {
        if (n < autoLo) autoLo = n;
        if (n > autoHi) autoHi = n;
      }
    }
    const lo = this.min ?? autoLo;
    const hi = this.max ?? autoHi;
    const v = raw.length > MAX_POINTS ? decimate(raw, MAX_POINTS) : raw;
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
    const last = v.at(-1);
    // Real-world computed data (ratios, averages, percentages) carries
    // floating-point noise that isn't meaningful to announce -- round it for
    // the label the same way a human-facing value would be formatted.
    const formattedLast =
      typeof last === 'number' && Number.isFinite(last)
        ? last.toLocaleString(undefined, { maximumFractionDigits: 2 })
        : last;
    this.setAttribute(
      'aria-label',
      v.length ? `Trend of ${v.length} values, last ${formattedLast}` : 'No data',
    );
  }

  render(): TemplateResult {
    const v = this.values;
    if (!v.length) {
      return html`<svg viewBox="0 0 ${VIEW} ${VIEW}" aria-hidden="true"></svg>`;
    }

    const pts = this.points();

    if (this.type === 'bar') {
      // Narrow the bar width as the (already decimated-to-MAX_POINTS) point
      // count grows, so bars stop overlapping once there are more than a
      // handful -- VIEW / pts.length is each bar's full "slot" width; keep a
      // small gap between slots by drawing at 70% of it, floored at 1px and
      // capped at the original fixed 4px for small point counts.
      const slot = VIEW / pts.length;
      const barWidth = Math.min(4, Math.max(1, slot * 0.7));
      const bars = pts.map(([x, y]) => {
        // Clamp symmetrically: a value below an explicit `min` pushes `y`
        // above VIEW, and a value above an explicit `max` pushes it below 0 --
        // only clamping one side left the other free to draw a negative-y,
        // oversized rect that bled outside the sparkline's box.
        const barY = Math.min(VIEW, Math.max(0, y));
        return svg`<rect part="bar" x="${x - barWidth / 2}" y="${barY}" width="${barWidth}" height="${VIEW - barY}"></rect>`;
      });
      return html`<svg viewBox="0 0 ${VIEW} ${VIEW}" preserveAspectRatio="none" aria-hidden="true">
        ${bars}
      </svg>`;
    }

    // pts can end up empty even though `values` itself isn't -- e.g. every
    // entry was non-finite and got filtered out -- so the single-point
    // fallback below can't assume pts[0] exists.
    const d =
      pts.length > 1
        ? pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x},${y}`).join(' ')
        : pts.length === 1
          ? `M${pts[0][0]},${pts[0][1]} L${pts[0][0]},${pts[0][1]}`
          : '';

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
