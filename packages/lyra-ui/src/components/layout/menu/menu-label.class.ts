import { html, type TemplateResult } from 'lit';
import { property } from 'lit/decorators.js';
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
 * Keep selectable items directly assigned or forwarded into the menu's default slot, with this
 * label as a sibling visual caption. Arbitrary group wrappers do not enroll their nested items
 * in the menu's keyboard navigation or selection handling.
 *
 * @customElement lr-menu-label
 * @slot - The heading text.
 * @csspart base - The heading row.
 * @cssprop [--lr-menu-label-color] - Color override.
 * @cssprop [--lr-menu-label-padding] - Padding override.
 * @cssprop [--lr-menu-label-font-size=var(--lr-font-size-sm)] - Font size of the heading row.
 * @cssprop [--lr-menu-label-font-weight=var(--lr-font-weight-semibold)] - Font weight of the heading row.
 * @cssprop [--lr-menu-label-letter-spacing=normal] - Letter spacing of the heading row.
 * @cssprop [--lr-menu-label-line-height=var(--lr-line-height-snug)] - Line height of the heading row.
 * @cssprop [--lr-menu-label-font-family=inherit] - Font family of the heading row.
 * @cssprop [--lr-menu-label-text-transform=inherit] - Text transform of the heading row.
 * @status stable
 * @since 8.0.0
 */
export class LyraMenuLabel extends LyraElement {
  static override styles = [LyraElement.styles, styles];

  /** Light-DOM semantic role. Reflected so the default is available to server renderers before
   * browser connection; authored values remain authoritative. */
  @property({ reflect: true }) override role: string | null = 'presentation';

  override attributeChangedCallback(name: string, oldValue: string | null, value: string | null): void {
    super.attributeChangedCallback(name, oldValue, value);
    if (name === 'role' && value === null) this.setAttribute('role', 'presentation');
  }

  override render(): TemplateResult {
    return html`<div part="base"><slot></slot></div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-menu-label': LyraMenuLabel;
  }
}
