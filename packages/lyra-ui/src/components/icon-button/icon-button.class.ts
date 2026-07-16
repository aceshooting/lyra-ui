import { html, type TemplateResult } from 'lit';
import { property, query } from 'lit/decorators.js';
import { LyraElement } from '../../internal/lyra-element.js';
import { styles } from './icon-button.styles.js';

/** `<lyra-icon-button>` — an accessible icon-only action button.
 * @customElement lyra-icon-button
 * @slot - Optional custom icon content.
 * @csspart button - Native button.
 */
export class LyraIconButton extends LyraElement {
  static styles = [LyraElement.styles, styles];
  @property() icon = '';
  @property({ attribute: 'aria-label' }) accessibleLabel = '';
  @property() label = '';
  @property({ type: Boolean, reflect: true }) disabled = false;
  @property() type: 'button' | 'submit' | 'reset' = 'button';
  @query('button') private buttonEl?: HTMLButtonElement;
  override focus(options?: FocusOptions): void { this.buttonEl?.focus(options); }
  override blur(): void { this.buttonEl?.blur(); }
  render(): TemplateResult {
    const label = this.accessibleLabel || this.label || this.localize('iconButtonLabel');
    return html`<button part="button" type=${this.type} ?disabled=${this.disabled} aria-label=${label}><lyra-icon name=${this.icon}><slot></slot></lyra-icon></button>`;
  }
}
declare global { interface HTMLElementTagNameMap { 'lyra-icon-button': LyraIconButton; } }
