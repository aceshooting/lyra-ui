import { html, nothing, type TemplateResult } from 'lit';
import { property } from 'lit/decorators.js';
import { LyraElement } from '../../internal/lyra-element.js';

/**
 * `<lyra-breadcrumb-item>` — one link or current-page label in a breadcrumb.
 *
 * @customElement lyra-breadcrumb-item
 * @slot - Item label.
 * @csspart base - The link or current-page label.
 */
export class LyraBreadcrumbItem extends LyraElement {
  static styles = [LyraElement.styles];
  @property() href = '';
  @property({ type: Boolean, reflect: true }) current = false;
  connectedCallback(): void {
    super.connectedCallback();
    this.setAttribute('role', 'listitem');
  }
  render(): TemplateResult {
    return this.href && !this.current
      ? html`<a part="base" href=${this.href}><slot></slot></a>`
      : html`<span part="base" aria-current=${this.current ? 'page' : nothing}><slot></slot></span>`;
  }
}
declare global { interface HTMLElementTagNameMap { 'lyra-breadcrumb-item': LyraBreadcrumbItem; } }
