import { html, type TemplateResult } from 'lit';
import { property } from 'lit/decorators.js';
import { LyraElement } from '../../internal/lyra-element.js';
import { styles } from './spinner.styles.js';

export type SpinnerLabelPlacement = 'none' | 'after';

/**
 * `<lyra-spinner>` — an indeterminate busy indicator.
 *
 * @customElement lyra-spinner
 * @slot - Optional visible label.
 * @csspart base - The wrapper.
 * @csspart spinner - The animated indicator.
 * @csspart label - The accessible/visible label wrapper.
 */
export class LyraSpinner extends LyraElement {
  static styles = [LyraElement.styles, styles];
  @property({ attribute: 'label-placement', reflect: true }) labelPlacement: SpinnerLabelPlacement = 'none';
  /** Accessible name for the busy status, forwarded from a host `aria-label`. When unset, the
   *  localized "Loading…" default provides the name. */
  @property({ attribute: 'aria-label' }) accessibleLabel: string | null = null;
  render(): TemplateResult {
    const label = this.accessibleLabel || this.localize('loading');
    return html`<span part="base" role="status" aria-label=${label}>
      <span part="spinner" aria-hidden="true"></span>
      <span part="label" ?hidden=${this.labelPlacement === 'none'}><slot></slot></span>
    </span>`;
  }
}
declare global { interface HTMLElementTagNameMap { 'lyra-spinner': LyraSpinner; } }
