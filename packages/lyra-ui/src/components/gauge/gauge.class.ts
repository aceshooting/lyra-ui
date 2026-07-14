import { html, nothing, svg, type TemplateResult } from 'lit';
import { property } from 'lit/decorators.js';
import { LyraElement } from '../../internal/lyra-element.js';
import { finiteNumber } from '../../internal/numbers.js';
import { styles } from './gauge.styles.js';

export type GaugeType = 'radial' | 'linear';

// Radial gauge sweeps 270° (like a speedometer), leaving a 90° gap at the bottom.
const SWEEP_DEG = 270;
const START_DEG = 135; // rotate so the gap is centered at the bottom
const RADIUS = 40;
const CENTER = 50;
const STROKE = 10;

// Linear gauge: keep the bar thin and low in the 0..20 viewBox so the top
// ~12 units are free for a value/label text row above it.
const LINEAR_STROKE = 6;
const LINEAR_BAR_Y = 15;
const LINEAR_TEXT_Y = 8;
// Length of the x1=0 -> x2=100 horizontal fill/track line (Euclidean, y1==y2).
const LINEAR_LENGTH = 100;

function polarToCartesian(angleDeg: number): [number, number] {
  const rad = (angleDeg * Math.PI) / 180;
  return [CENTER + RADIUS * Math.cos(rad), CENTER + RADIUS * Math.sin(rad)];
}

function arcPath(startDeg: number, endDeg: number): string {
  const [sx, sy] = polarToCartesian(startDeg);
  const [ex, ey] = polarToCartesian(endDeg);
  const largeArc = endDeg - startDeg > 180 ? 1 : 0;
  return `M ${sx} ${sy} A ${RADIUS} ${RADIUS} 0 ${largeArc} 1 ${ex} ${ey}`;
}

// The radial fill's `d` is fixed geometry (the full 270° sweep), built once —
// a `d` rebuilt from `ratio` on every render is not reliably CSS-transitionable
// across browsers. Animated progress instead rides stroke-dasharray/
// stroke-dashoffset (always transitionable) over this constant path, the same
// technique used for the linear variant's fill line below.
const RADIAL_ARC_D = arcPath(START_DEG, START_DEG + SWEEP_DEG);
const RADIAL_ARC_LENGTH = (SWEEP_DEG / 360) * 2 * Math.PI * RADIUS;

/**
 * `<lyra-gauge>` — a radial or linear meter. First-party invention; no
 * generic gauge widget exists in Web Awesome.
 *
 * @customElement lyra-gauge
 * @csspart base - The root `<svg>`.
 * @csspart track - The background track arc/line.
 * @csspart fill - The animated fill arc/line.
 * @csspart value - The value text.
 * @csspart label - The label text.
 */
export class LyraGauge extends LyraElement {
  static styles = [LyraElement.styles, styles];

  @property({ type: Number }) value = 0;
  @property({ type: Number }) min = 0;
  @property({ type: Number }) max = 100;
  @property({ reflect: true }) type: GaugeType = 'radial';
  @property() label = '';
  /** Imperative override for the displayed/announced value text, e.g. `'72°F'` for a raw `value` of `72`.
   * An empty string is treated the same as unset and falls back to the numeric `value`. */
  @property({ attribute: false }) valueLabel?: string;

  // Normalizes a reversed min > max domain by swapping lo/hi, but only once
  // both bounds are finite -- shared by `ratio` (fill geometry) and
  // `willUpdate` (aria-value* trio) so the two can never silently diverge.
  private get domain(): { lo: number; hi: number } {
    const min = finiteNumber(this.min, 0);
    const max = finiteNumber(this.max, 100);
    return { lo: Math.min(min, max), hi: Math.max(min, max) };
  }

  private get ratio(): number {
    if (!Number.isFinite(this.value)) return 0;
    const { lo, hi } = this.domain;
    if (!Number.isFinite(lo) || !Number.isFinite(hi)) return 0;
    const span = hi - lo || 1;
    return Math.min(1, Math.max(0, (this.value - lo) / span));
  }

  /** The text rendered/announced for the current value: `valueLabel` when set,
   * else the numeric `value`, blanked (like the ARIA attributes and fill) when
   * `value` is non-finite (NaN/undefined/Infinity/-Infinity). */
  private get displayText(): string {
    return this.valueLabel || (!Number.isFinite(this.value) ? '' : String(this.value));
  }

  protected willUpdate(): void {
    this.setAttribute('role', 'meter');
    // Normalize a reversed min > max domain the same way `ratio` does, so the
    // announced aria-value* trio always agrees with the visual fill instead
    // of aria-valuenow pinning to one bound regardless of `value` (and
    // aria-valuemin/valuemax reporting an inverted, invalid ARIA range).
    const { lo, hi } = this.domain;
    const finiteTrio = Number.isFinite(this.value) && Number.isFinite(lo) && Number.isFinite(hi);
    if (finiteTrio) {
      const clamped = Math.min(hi, Math.max(lo, this.value));
      this.setAttribute('aria-valuenow', String(clamped));
    } else {
      this.removeAttribute('aria-valuenow');
    }
    if (Number.isFinite(lo)) this.setAttribute('aria-valuemin', String(lo));
    else this.removeAttribute('aria-valuemin');
    if (Number.isFinite(hi)) this.setAttribute('aria-valuemax', String(hi));
    else this.removeAttribute('aria-valuemax');
    if (this.label) this.setAttribute('aria-label', this.label);
    else this.removeAttribute('aria-label');
    if (this.valueLabel) this.setAttribute('aria-valuetext', this.valueLabel);
    else this.removeAttribute('aria-valuetext');
  }

  private renderRadial(): TemplateResult {
    const text = this.displayText;
    // Dashoffset counts down from the full arc length (nothing revealed) to 0
    // (whole sweep revealed) as ratio goes 0 -> 1 — the classic "draw an SVG
    // path" technique, which transitions smoothly via plain CSS.
    const dashoffset = RADIAL_ARC_LENGTH * (1 - this.ratio);
    return html`<svg part="base" viewBox="0 0 100 100">
      <path part="track" stroke-width=${STROKE} d=${RADIAL_ARC_D}></path>
      <path
        part="fill"
        stroke-width=${STROKE}
        d=${RADIAL_ARC_D}
        stroke-dasharray=${RADIAL_ARC_LENGTH}
        stroke-dashoffset=${dashoffset}
      ></path>
      <text part="value" x="50" y="52" aria-hidden="true">${text}</text>
      ${this.label ? svg`<text part="label" x="50" y="68" aria-hidden="true">${this.label}</text>` : ''}
    </svg>`;
  }

  private renderLinear(): TemplateResult {
    const text = this.displayText;
    const dashoffset = LINEAR_LENGTH * (1 - this.ratio);
    // Under RTL the meter must still visually fill and read in the same
    // start-to-end order as the surrounding text, so the physical x=0/x=100
    // endpoints swap roles -- the same physical-vs-logical horizontal concern
    // `<lyra-slider>` resolves via `effectiveDirection`/`isRtl()` for its own
    // track. (The radial variant's arc-sweep math is exempt geometry.)
    const rtl = this.effectiveDirection === 'rtl';
    const startX = rtl ? LINEAR_LENGTH : 0;
    const endX = rtl ? 0 : LINEAR_LENGTH;
    return html`<svg part="base" viewBox="0 0 100 20" preserveAspectRatio="none">
      <line part="track" x1=${startX} y1=${LINEAR_BAR_Y} x2=${endX} y2=${LINEAR_BAR_Y} stroke-width=${LINEAR_STROKE}></line>
      <line
        part="fill"
        x1=${startX}
        y1=${LINEAR_BAR_Y}
        x2=${endX}
        y2=${LINEAR_BAR_Y}
        stroke-width=${LINEAR_STROKE}
        stroke-dasharray=${LINEAR_LENGTH}
        stroke-dashoffset=${dashoffset}
      ></line>
      ${this.label
        ? svg`<text part="label" x=${startX} y=${LINEAR_TEXT_Y} style=${rtl ? 'text-anchor:end' : nothing} aria-hidden="true">${this.label}</text>`
        : ''}
      <text part="value" x=${endX} y=${LINEAR_TEXT_Y} style=${rtl ? 'text-anchor:start' : nothing} aria-hidden="true">${text}</text>
    </svg>`;
  }

  render(): TemplateResult {
    return this.type === 'linear' ? this.renderLinear() : this.renderRadial();
  }
}


declare global {
  interface HTMLElementTagNameMap {
    'lyra-gauge': LyraGauge;
  }
}

