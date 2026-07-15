import { html, type TemplateResult } from 'lit';
import { property } from 'lit/decorators.js';
import { LyraElement } from '../../internal/lyra-element.js';
import { styles } from './breadcrumb.styles.js';

/**
 * `<lyra-breadcrumb>` — a responsive navigation trail.
 *
 * @customElement lyra-breadcrumb
 * @slot - `<lyra-breadcrumb-item>` children.
 * @csspart base - The navigation wrapper.
 */
export class LyraBreadcrumb extends LyraElement {
  static styles = [LyraElement.styles, styles];
  @property({ attribute: 'accessible-label' }) accessibleLabel = '';
  render(): TemplateResult { return html`<nav part="base" aria-label=${this.accessibleLabel || this.localize('breadcrumb')}><div part="list" role="list"><slot></slot></div></nav>`; }
}
declare global { interface HTMLElementTagNameMap { 'lyra-breadcrumb': LyraBreadcrumb; } }
