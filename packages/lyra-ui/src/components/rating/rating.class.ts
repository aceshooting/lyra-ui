import { html, svg, type SVGTemplateResult, type TemplateResult } from 'lit';
import { property } from 'lit/decorators.js';
import { LyraElement } from '../../internal/lyra-element.js';
import { styles } from './rating.styles.js';

export interface LyraRatingEventMap { 'lyra-change': CustomEvent<{ value: number }>; }

// A five-point star, sharing internal/icons.ts's 24x24 viewBox / 1em sizing
// contract so it reads as part of the same visual language, without adding a
// rating-only shape to that shared module. Rendered as two stacked copies per
// star -- a `currentColor`-stroked outline (the empty backdrop) and a
// `currentColor`-filled solid clipped to the filled fraction -- so a
// fractional `precision` (e.g. `0.5`) can render a partial fill instead of
// only ever snapping to the nearest whole star.
const STAR_POINTS = '12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2';
function starOutline(): SVGTemplateResult {
  return svg`<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linejoin="round" aria-hidden="true" focusable="false"><polygon points=${STAR_POINTS}></polygon></svg>`;
}
function starSolid(): SVGTemplateResult {
  return svg`<svg width="1em" height="1em" viewBox="0 0 24 24" fill="currentColor" stroke="none" aria-hidden="true" focusable="false"><polygon points=${STAR_POINTS}></polygon></svg>`;
}

/**
 * `<lyra-rating>` — a keyboard-accessible star rating control.
 *
 * @customElement lyra-rating
 * @event lyra-change - The rating changed. `detail: { value }`.
 * @csspart base - The slider-like rating control.
 * @csspart star - Each visual star.
 * @csspart star-fill - The filled overlay inside each star, clipped to that
 * star's filled fraction (0%, a partial percentage under a fractional
 * `precision`, or 100%).
 * @cssprop [--lyra-rating-fill=var(--lyra-color-warning)] - Filled-star color.
 * @cssprop [--lyra-rating-empty-color=var(--lyra-color-border)] - Unfilled-star color.
 * @cssprop [--lyra-rating-size=var(--lyra-font-size-xl)] - Star size.
 */
export class LyraRating extends LyraElement<LyraRatingEventMap> {
  static styles = [LyraElement.styles, styles];
  @property({ type: Number, reflect: true }) value = 0;
  @property({ type: Number, reflect: true }) max = 5;
  @property({ type: Number }) precision = 1;
  @property({ type: Boolean, reflect: true }) readonly = false;
  @property({ type: Boolean, reflect: true }) disabled = false;
  @property({ attribute: 'aria-label' }) accessibleLabel = '';
  private setValue(next: number): void {
    if (this.readonly || this.disabled) return;
    const precision = this.precision > 0 ? this.precision : 1;
    const clamped = Math.max(0, Math.min(this.max, Math.round(next / precision) * precision));
    if (clamped === this.value) return;
    this.value = clamped;
    this.emit('lyra-change', { value: this.value });
  }
  private onClick = (event: MouseEvent): void => {
    const target = (event.target as HTMLElement).closest('[data-value]') as HTMLElement | null;
    if (target) this.setValue(Number(target.dataset.value));
  };
  private onKeyDown = (event: KeyboardEvent): void => {
    const forwardKey = this.effectiveDirection === 'rtl' ? 'ArrowLeft' : 'ArrowRight';
    const backwardKey = this.effectiveDirection === 'rtl' ? 'ArrowRight' : 'ArrowLeft';
    if (event.key === forwardKey || event.key === 'ArrowUp') { event.preventDefault(); this.setValue(this.value + this.precision); }
    if (event.key === backwardKey || event.key === 'ArrowDown') { event.preventDefault(); this.setValue(this.value - this.precision); }
    if (event.key === 'Home') { event.preventDefault(); this.setValue(0); }
    if (event.key === 'End') { event.preventDefault(); this.setValue(this.max); }
  };
  render(): TemplateResult {
    const count = Math.max(0, Math.round(this.max));
    return html`<div part="base" role="slider" tabindex=${this.disabled ? '-1' : '0'}
      aria-label=${this.getAttribute('aria-label') || this.accessibleLabel || this.localize('rating')}
      aria-valuemin="0" aria-valuemax=${this.max} aria-valuenow=${this.value}
      aria-disabled=${this.disabled ? 'true' : 'false'} aria-readonly=${this.readonly ? 'true' : 'false'}
      @click=${this.onClick} @keydown=${this.onKeyDown}>
      ${Array.from({ length: count }, (_, index) => {
        const star = index + 1;
        const fraction = Math.max(0, Math.min(1, this.value - index));
        return html`<span part="star" data-value=${star} ?data-filled=${fraction >= 1} aria-hidden="true">
          ${starOutline()}
          <span part="star-fill" style=${`inline-size:${fraction * 100}%`}>${starSolid()}</span>
        </span>`;
      })}
    </div>`;
  }
}
declare global { interface HTMLElementTagNameMap { 'lyra-rating': LyraRating; } }
