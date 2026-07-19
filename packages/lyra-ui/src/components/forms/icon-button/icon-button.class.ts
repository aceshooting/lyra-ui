import { html, type TemplateResult } from 'lit';
import { property, query } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { styles } from './icon-button.styles.js';

/** `<lr-icon-button>` — an accessible icon-only action button.
 * @customElement lr-icon-button
 * @slot - Optional custom icon content.
 * @csspart button - Native button.
 * @cssprop [--lr-icon-button-size=2.5rem] - Inline and block size of the native button. A
 *   library-wide token (declared on `:root` by `tokens.styles.ts`, and the shared minimum
 *   tappable size several other components size their icon controls against), so overriding it
 *   globally resizes all of them together.
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
    return html`<button part="button" type=${this.type} ?disabled=${this.disabled} aria-label=${label}><lr-icon name=${this.icon}><slot></slot></lr-icon></button>`;
  }
}
declare global { interface HTMLElementTagNameMap { 'lr-icon-button': LyraIconButton; } }
