import type { PropertyValues } from 'lit';
import { html, nothing, svg, type TemplateResult } from 'lit';
import { property } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { getNumberFormat } from '../../../internal/intl-cache.js';
import { finiteNumber, finiteRatio } from '../../../internal/numbers.js';
import { styles } from './gauge.styles.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_gaugeLabel, LYRA_DEFAULT_gaugeValueLabel } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END


/** The rendered geometry of a gauge. */
export type GaugeShape = 'radial' | 'ring' | 'linear';

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
// SVG text cannot wrap. Compressing an arbitrary string with `textLength` eventually makes every
// glyph illegible, so the visible caption is bounded while the host ARIA contract and the SVG
// title retain the full caller-owned text.
const RADIAL_VALUE_CHARACTERS = 9;
const RADIAL_LABEL_CHARACTERS = 12;
const LINEAR_VALUE_CHARACTERS = 10;
const LINEAR_LABEL_CHARACTERS = 10;

function abbreviateSvgText(value: string, maxCharacters: number): string {
  const characters = Array.from(value);
  if (characters.length <= maxCharacters) return value;
  return `${characters.slice(0, maxCharacters - 1).join('')}…`;
}

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
const RING_CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/**
 * `<lr-gauge>` — a radial, full-circle ring, or linear meter. First-party invention; no
 * generic gauge widget exists in Web Awesome.
 *
 * @customElement lr-gauge
 * @csspart base - The root `<svg>`.
 * @csspart track - The background track arc/line.
 * @csspart fill - The animated fill arc/line.
 * @csspart value - The value text.
 * @csspart label - The label text.
 * @cssprop [--lr-gauge-fill=var(--lr-color-brand)] - Fill stroke for radial, ring, and linear gauges.
 * @status stable
 * @since 4.0.0
 */
export class LyraGauge extends LyraElement {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    gaugeLabel: LYRA_DEFAULT_gaugeLabel,
    gaugeValueLabel: LYRA_DEFAULT_gaugeValueLabel,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  static override styles = [LyraElement.styles, styles];

  @property({ type: Number }) value = 0;
  @property({ type: Number }) min = 0;
  @property({ type: Number }) max = 100;
  /** Visual geometry. Named `shape` because this Lyra-original component is not a native input. */
  @property({ reflect: true }) shape: GaugeShape = 'radial';
  @property() label = '';
  /** Displayed/announced value text, e.g. `'72°F'` for a raw `value` of `72`.
   * An empty string is treated the same as unset and falls back to the numeric `value`. */
  @property({ attribute: 'value-text' }) valueText?: string;

  // `label` supplies the default meter name, but an author-provided host
  // `aria-label` must win. Track the value last applied by the component so
  // later label updates remain distinguishable from author attribute edits.
  private appliedAriaLabel: string | null = null;
  private explicitAriaLabel: string | null = null;

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
    return finiteRatio(this.value, lo, hi);
  }

  /** The text rendered/announced for the current value: `valueText` when set,
   * else the numeric `value`, blanked (like the ARIA attributes and fill) when
   * `value` is non-finite (NaN/undefined/Infinity/-Infinity). */
  private get displayText(): string {
    return (
      this.valueText ||
      (!Number.isFinite(this.value) ? '' : getNumberFormat(this.effectiveLocale).format(this.value))
    );
  }

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed);
    // Normalize a reversed min > max domain the same way `ratio` does, so the
    // announced aria-value* trio always agrees with the visual fill instead
    // of aria-valuenow pinning to one bound regardless of `value` (and
    // aria-valuemin/valuemax reporting an inverted, invalid ARIA range).
    const { lo, hi } = this.domain;
    const finiteTrio =
      Number.isFinite(this.value) && Number.isFinite(lo) && Number.isFinite(hi) && lo !== hi;
    this.setAttribute('role', finiteTrio ? 'meter' : 'img');
    if (finiteTrio) {
      const clamped = Math.min(hi, Math.max(lo, this.value));
      this.setAttribute('aria-valuenow', String(clamped));
      this.setAttribute('aria-valuemin', String(lo));
      this.setAttribute('aria-valuemax', String(hi));
    } else {
      this.removeAttribute('aria-valuenow');
      this.removeAttribute('aria-valuemin');
      this.removeAttribute('aria-valuemax');
    }
    const currentAriaLabel = this.getAttribute('aria-label');
    if (currentAriaLabel !== this.appliedAriaLabel) {
      this.explicitAriaLabel = currentAriaLabel;
    }
    const defaultName = this.label || this.localize('gaugeLabel');
    const fallbackValueLabel =
      this.displayText && (!Number.isFinite(this.value) || lo === hi)
        ? this.localize('gaugeValueLabel', undefined, {
            label: defaultName,
            value: this.displayText,
          })
        : defaultName;
    const nextAriaLabel =
      this.explicitAriaLabel ||
      (finiteTrio ? defaultName : fallbackValueLabel);
    this.setAttribute('aria-label', nextAriaLabel);
    this.appliedAriaLabel = nextAriaLabel;
    if (finiteTrio && this.valueText) this.setAttribute('aria-valuetext', this.valueText);
    else this.removeAttribute('aria-valuetext');
  }

  private renderRadial(): TemplateResult {
    const fullText = this.displayText;
    const text = abbreviateSvgText(fullText, RADIAL_VALUE_CHARACTERS);
    const label = abbreviateSvgText(this.label, RADIAL_LABEL_CHARACTERS);
    // Dashoffset counts down from the full arc length (nothing revealed) to 0
    // (whole sweep revealed) as ratio goes 0 -> 1 — the classic "draw an SVG
    // path" technique, which transitions smoothly via plain CSS.
    const dashoffset = RADIAL_ARC_LENGTH * (1 - this.ratio);
    return html`<svg
      part="base"
      viewBox="0 0 100 100"
      aria-hidden="true"
      title=${this.label && fullText ? `${this.label}: ${fullText}` : this.label || fullText}
    >
      <path part="track" stroke-width=${STROKE} d=${RADIAL_ARC_D}></path>
      <path
        part="fill"
        stroke-width=${STROKE}
        d=${RADIAL_ARC_D}
        stroke-dasharray=${RADIAL_ARC_LENGTH}
        stroke-dashoffset=${dashoffset}
      ></path>
      <text
        part="value"
        x="50"
        y="52"
        aria-hidden="true"
      >${text}</text>
      ${this.label
        ? svg`<text
            part="label"
            x="50"
            y="68"
            aria-hidden="true"
          >${label}</text>`
        : nothing}
    </svg>`;
  }

  private renderLinear(): TemplateResult {
    const fullText = this.displayText;
    const text = abbreviateSvgText(fullText, LINEAR_VALUE_CHARACTERS);
    const label = abbreviateSvgText(this.label, LINEAR_LABEL_CHARACTERS);
    const dashoffset = LINEAR_LENGTH * (1 - this.ratio);
    // Under RTL the meter must still visually fill and read in the same
    // start-to-end order as the surrounding text, so the physical x=0/x=100
    // endpoints swap roles -- the same physical-vs-logical horizontal concern
    // `<lr-slider>` resolves via `effectiveDirection`/`isRtl()` for its own
    // track. (The radial variant's arc-sweep math is exempt geometry.)
    const rtl = this.effectiveDirection === 'rtl';
    const startX = rtl ? LINEAR_LENGTH : 0;
    const endX = rtl ? 0 : LINEAR_LENGTH;
    return html`<svg
      part="base"
      viewBox="0 0 100 20"
      preserveAspectRatio="none"
      aria-hidden="true"
      title=${this.label && fullText ? `${this.label}: ${fullText}` : this.label || fullText}
    >
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
        ? svg`<text
            part="label"
            x=${startX}
            y=${LINEAR_TEXT_Y}
            aria-hidden="true"
          >${label}</text>`
        : nothing}
      <text
        part="value"
        x=${endX}
        y=${LINEAR_TEXT_Y}
        aria-hidden="true"
      >${text}</text>
    </svg>`;
  }

  private renderRing(): TemplateResult {
    const fullText = this.displayText;
    const text = abbreviateSvgText(fullText, RADIAL_VALUE_CHARACTERS);
    const label = abbreviateSvgText(this.label, RADIAL_LABEL_CHARACTERS);
    const dashoffset = RING_CIRCUMFERENCE * (1 - this.ratio);
    return html`<svg
      part="base"
      viewBox="0 0 100 100"
      aria-hidden="true"
      title=${this.label && fullText ? `${this.label}: ${fullText}` : this.label || fullText}
    >
      <circle part="track" cx=${CENTER} cy=${CENTER} r=${RADIUS} stroke-width=${STROKE}></circle>
      <circle
        part="fill"
        cx=${CENTER}
        cy=${CENTER}
        r=${RADIUS}
        stroke-width=${STROKE}
        stroke-dasharray=${RING_CIRCUMFERENCE}
        stroke-dashoffset=${dashoffset}
        transform="rotate(-90 50 50)"
      ></circle>
      <text
        part="value"
        x="50"
        y="52"
        aria-hidden="true"
      >${text}</text>
      ${this.label
        ? svg`<text
            part="label"
            x="50"
            y="68"
            aria-hidden="true"
          >${label}</text>`
        : nothing}
    </svg>`;
  }

  override render(): TemplateResult {
    if (this.shape === 'linear') return this.renderLinear();
    if (this.shape === 'ring') return this.renderRing();
    return this.renderRadial();
  }
}


declare global {
  interface HTMLElementTagNameMap {
    'lr-gauge': LyraGauge;
  }
}
