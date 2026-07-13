import { html, nothing, type TemplateResult } from 'lit';
import { property } from 'lit/decorators.js';
import { LyraElement } from '../../internal/lyra-element.js';
import { defineElement } from '../../internal/prefix.js';
import { styles } from './app-rail-item.styles.js';

/**
 * `<lyra-app-rail-item>` — an explicit icon/label navigation item for
 * `<lyra-app-rail>`. The rail sets its `icon-only` attribute as the viewport
 * changes, keeping the label available to assistive technology while removing
 * it from the visual layout.
 *
 * @customElement lyra-app-rail-item
 * @slot - The visible navigation label.
 * @slot icon - The leading icon.
 * @csspart base - The link or button receiving focus and activation.
 * @csspart icon - The icon wrapper.
 * @csspart label - The label wrapper; visually clipped in icon-only mode.
 */
export class LyraAppRailItem extends LyraElement {
  static styles = [LyraElement.styles, styles];

  /** Optional destination. Without `href`, the item renders as a button. */
  @property() href = '';

  /** Optional link target. */
  @property() target = '';

  /** Prevents activation while retaining the item in the rail. */
  @property({ type: Boolean, reflect: true }) disabled = false;

  render(): TemplateResult {
    const label = this.getAttribute('aria-label');
    const content = html`
      <span part="icon" aria-hidden=${label ? 'true' : nothing}><slot name="icon"></slot></span>
      <span part="label"><slot></slot></span>
    `;
    if (this.href && !this.disabled) {
      return html`<a
        part="base"
        href=${this.href}
        target=${this.target || nothing}
        aria-label=${label || nothing}
      >${content}</a>`;
    }
    return html`<button
      part="base"
      type="button"
      ?disabled=${this.disabled}
      aria-disabled=${this.disabled ? 'true' : nothing}
      aria-label=${label || nothing}
    >${content}</button>`;
  }
}

defineElement('app-rail-item', LyraAppRailItem);

declare global {
  interface HTMLElementTagNameMap {
    'lyra-app-rail-item': LyraAppRailItem;
  }
}
