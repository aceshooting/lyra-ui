import { html, nothing, type TemplateResult } from 'lit';
import { property } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import type { LyraOrientation } from '../../../internal/shared-unions.js';
import { styles } from './divider.styles.js';

export type LyraDividerOrientation = LyraOrientation;

/**
 * `<lr-divider>` — a themeable semantic separator.
 *
 * @customElement lr-divider
 * @csspart base - The separator element.
 * @cssprop [--color=var(--lr-color-border)] - Separator color.
 * @cssprop [--spacing=0] - Space on both block sides (inline sides when vertical).
 * @cssprop [--width=var(--lr-border-width-thin)] - Separator thickness.
 * @status stable
 * @since 4.0.0
 */
export class LyraDivider extends LyraElement {
  static override styles = [LyraElement.styles, styles];
  @property({ reflect: true }) orientation: LyraDividerOrientation = 'horizontal';
  /** Shoelace-compatible vertical-orientation shorthand. */
  @property({ type: Boolean, reflect: true }) vertical = false;
  override render(): TemplateResult {
    const orientation: LyraDividerOrientation =
      this.vertical || this.orientation === 'vertical' ? 'vertical' : 'horizontal';
    return html`<hr
      part="base"
      role="separator"
      aria-orientation=${orientation}
      aria-label=${this.getAttribute('aria-label') || nothing}
    >`;
  }
}
declare global { interface HTMLElementTagNameMap { 'lr-divider': LyraDivider; } }
