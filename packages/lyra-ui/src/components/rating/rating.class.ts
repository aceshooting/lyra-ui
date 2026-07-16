import { html, nothing, type TemplateResult } from 'lit';
import { property } from 'lit/decorators.js';
import { LyraElement } from '../../internal/lyra-element.js';
import { styles } from './rating.styles.js';

export interface LyraRatingEventMap { 'lyra-change': CustomEvent<{ value: number }>; }

/**
 * `<lyra-rating>` — a keyboard-accessible star rating control.
 *
 * @customElement lyra-rating
 * @event lyra-change - The rating changed. `detail: { value }`.
 * @csspart base - The slider-like rating control.
 * @csspart star - Each visual star.
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
    this.value = Math.max(0, Math.min(this.max, Math.round(next / precision) * precision));
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
        return html`<span part="star" data-value=${star} ?data-filled=${this.value >= star} aria-hidden="true">★</span>`;
      })}
    </div>`;
  }
}
declare global { interface HTMLElementTagNameMap { 'lyra-rating': LyraRating; } }
