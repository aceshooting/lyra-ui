import { html, type TemplateResult } from 'lit';
import { LyraElement } from '../../../internal/lyra-element.js';
import { styles } from './menu-label.styles.js';

/**
 * `<lr-menu-label>` — a non-interactive section heading inside `<lr-menu>`'s default slot.
 *
 * `role="presentation"` on the host: a `role="menu"` may only contain menu-item roles, so a
 * heading that kept a generic role would make the menu's own children invalid. The visible text
 * still reads normally in reading order, and `<lr-menu>`'s roving tabindex skips this element
 * because it is not a `LyraMenuItem` — a label is never a focus stop.
 *
 * To announce a *named group* rather than a caption, wrap the labelled items in an element with
 * `role="group"` and point its `aria-label` at the same text; idrefs cannot cross the shadow
 * boundary, so `aria-labelledby` against this element's internals would not resolve.
 *
 * @customElement lr-menu-label
 * @slot - The heading text.
 * @csspart base - The heading row.
 * @status stable
 * @since 8.0.0
 */
export class LyraMenuLabel extends LyraElement {
  static override styles = [LyraElement.styles, styles];

  override connectedCallback(): void {
    super.connectedCallback();
    if (!this.hasAttribute('role')) this.setAttribute('role', 'presentation');
  }

  override render(): TemplateResult {
    return html`<div part="base"><slot></slot></div>`;
  }
}

declare global { interface HTMLElementTagNameMap { 'lr-menu-label': LyraMenuLabel; } }
