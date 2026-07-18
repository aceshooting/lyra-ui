import { html, type TemplateResult } from 'lit';
import { property } from 'lit/decorators.js';
import { LyraElement } from '../../internal/lyra-element.js';
import { styles } from './breadcrumb.styles.js';

/**
 * `<lr-breadcrumb>` — a responsive navigation trail.
 *
 * @customElement lr-breadcrumb
 * @slot - `<lr-breadcrumb-item>` children.
 * @csspart base - The navigation wrapper.
 * @csspart list - The `role="list"` flex row wrapping the slotted items.
 */
export class LyraBreadcrumb extends LyraElement {
  static styles = [LyraElement.styles, styles];
  /** Host-level `aria-label` override for the trail's accessible name --
   *  wins over the localized default ("Breadcrumb"). Set as a plain
   *  `aria-label` attribute on `<lr-breadcrumb>` itself, not a public JS
   *  property, since the `<nav>` landmark that owns the role lives in the
   *  shadow root and never inherits a host attribute automatically. */
  @property({ attribute: 'aria-label' }) accessibleLabel = '';
  render(): TemplateResult { return html`<nav part="base" aria-label=${this.accessibleLabel || this.localize('breadcrumb')}><div part="list" role="list"><slot></slot></div></nav>`; }
}
declare global { interface HTMLElementTagNameMap { 'lr-breadcrumb': LyraBreadcrumb; } }
