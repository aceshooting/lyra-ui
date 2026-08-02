import { html, type TemplateResult } from 'lit';
import { property } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { styles } from './tab-panel.styles.js';

/**
 * `<lr-tab-panel>` — the content revealed by the `<lr-tab>` whose `panel` matches this element's
 * `name`. Mirrors `wa-tab-panel` / `sl-tab-panel`.
 *
 * Deliberately carries no `role="tabpanel"` of its own: `<lr-tab-group>` renders the
 * `role="tabpanel"` wrapper this element is projected into, and a second nested tabpanel role
 * would leave the panel announced twice. Show/hide is the group's job too.
 *
 * @customElement lr-tab-panel
 * @slot - The panel's content.
 * @csspart base - The panel content wrapper.
 * @cssprop [--padding=0] - Inner panel padding.
 * @status stable
 * @since 8.0.0
 */
export class LyraTabPanel extends LyraElement {
  static override styles = [LyraElement.styles, styles];

  /** Matches the `panel` of the `<lr-tab>` that reveals this panel. */
  @property({ reflect: true }) name = '';

  /** Whether this panel is active. The owning group synchronizes it after hydration; setting it
   * explicitly supplies the SSR-visible panel. */
  @property({ type: Boolean, reflect: true }) active = false;

  override render(): TemplateResult {
    return html`<div part="base"><slot></slot></div>`;
  }
}

declare global { interface HTMLElementTagNameMap { 'lr-tab-panel': LyraTabPanel; } }
