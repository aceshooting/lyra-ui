import { html, svg, type TemplateResult } from 'lit';
import { property } from 'lit/decorators.js';
import { LyraElement } from '../../internal/lyra-element.js';
import { defineElement } from '../../internal/prefix.js';
import { styles } from './gauge.styles.js';

export type GaugeType = 'radial' | 'linear';

// Radial gauge sweeps 270° (like a speedometer), leaving a 90° gap at the bottom.
const SWEEP_DEG = 270;
const START_DEG = 135; // rotate so the gap is centered at the bottom
const RADIUS = 40;
const CENTER = 50;
const STROKE = 10;

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

/**
 * `<lyra-gauge>` — a radial or linear meter. First-party invention; no
 * generic gauge widget was found across the surveyed repos.
 *
 * @customElement lyra-gauge
 * @csspart base, track, fill, value, label
 */
export class LyraGauge extends LyraElement {
  static styles = [LyraElement.styles, styles];

  @property({ type: Number }) value = 0;
  @property({ type: Number }) min = 0;
  @property({ type: Number }) max = 100;
  @property({ reflect: true }) type: GaugeType = 'radial';
  @property() label = '';
  @property({ attribute: false }) valueLabel?: string;

  private get ratio(): number {
    const span = this.max - this.min || 1;
    return Math.min(1, Math.max(0, (this.value - this.min) / span));
  }

  protected willUpdate(): void {
    this.setAttribute('role', 'meter');
    this.setAttribute('aria-valuenow', String(this.value));
    this.setAttribute('aria-valuemin', String(this.min));
    this.setAttribute('aria-valuemax', String(this.max));
    if (this.label) this.setAttribute('aria-label', this.label);
    else this.removeAttribute('aria-label');
  }

  private renderRadial(): TemplateResult {
    const endDeg = START_DEG + SWEEP_DEG * this.ratio;
    const text = this.valueLabel ?? String(this.value);
    return html`<svg viewBox="0 0 100 100">
      <path part="track" stroke-width=${STROKE} d=${arcPath(START_DEG, START_DEG + SWEEP_DEG)}></path>
      <path part="fill" stroke-width=${STROKE} d=${arcPath(START_DEG, endDeg)}></path>
      <text part="value" x="50" y="52">${text}</text>
      ${this.label ? svg`<text part="label" x="50" y="68">${this.label}</text>` : ''}
    </svg>`;
  }

  private renderLinear(): TemplateResult {
    const w = this.ratio * 100;
    return html`<svg viewBox="0 0 100 20" preserveAspectRatio="none">
      <line part="track" x1="0" y1="10" x2="100" y2="10" stroke-width=${STROKE}></line>
      <line part="fill" x1="0" y1="10" x2=${w} y2="10" stroke-width=${STROKE}></line>
    </svg>`;
  }

  render(): TemplateResult {
    return this.type === 'linear' ? this.renderLinear() : this.renderRadial();
  }
}

defineElement('gauge', LyraGauge);

declare global {
  interface HTMLElementTagNameMap {
    'lyra-gauge': LyraGauge;
  }
}
