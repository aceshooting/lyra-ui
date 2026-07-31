import { html, type TemplateResult } from 'lit';
import { property } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { styles } from './tab.styles.js';

/**
 * `<lr-tab>` — one tab in a `<lr-tab-group>`'s strip. Mirrors `wa-tab` / `sl-tab`.
 *
 * A declarative descriptor, not the interactive control: `<lr-tab-group>` renders the real
 * `role="tab"` button and projects this element's content into it, so the whole ARIA and
 * roving-tabindex contract stays in one place. That means the content may be rich (an icon plus a
 * label, a badge) while the button's accessible name is still exactly that content's text.
 *
 * Pair it with a `<lr-tab-panel>` whose `name` matches this element's `panel`.
 *
 * @customElement lr-tab
 * @slot - The tab's visible content.
 */
export class LyraTab extends LyraElement {
  static override styles = [LyraElement.styles, styles];

  /** The `name` of the `<lr-tab-panel>` this tab reveals. */
  @property({ reflect: true }) panel = '';

  /** Removes the tab from keyboard navigation and prevents activation. */
  @property({ type: Boolean, reflect: true }) disabled = false;

  override render(): TemplateResult {
    return html`<slot></slot>`;
  }
}

declare global { interface HTMLElementTagNameMap { 'lr-tab': LyraTab; } }
