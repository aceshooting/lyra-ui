import { literalSetConverter } from '../../../internal/converters.js';
import { html, nothing, type TemplateResult } from 'lit';
import { property } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import type { LyraOrientation } from '../../../internal/shared-unions.js';
import { styles } from './divider.styles.js';

export type LyraDividerOrientation = LyraOrientation;
const orientationValues = literalSetConverter(['horizontal', 'vertical'], 'horizontal');

/**
 * `<lr-divider>` — a themeable semantic separator.
 *
 * @customElement lr-divider
 * @csspart base - The separator element.
 * @cssprop [--color=var(--lr-color-border-subtle)] - Separator color.
 * @cssprop [--spacing=0] - Space on both block sides (inline sides when vertical).
 * @cssprop [--width=var(--lr-border-width-thin)] - Separator thickness.
 * @status stable
 * @since 4.0.0
 */
export class LyraDivider extends LyraElement {
  static override styles = [LyraElement.styles, styles];
  private _orientation: LyraDividerOrientation = 'horizontal';
  /** Base orientation. The vertical shorthand takes precedence when present. */
  @property({ reflect: true, converter: orientationValues })
  get orientation(): LyraDividerOrientation { return this._orientation; }
  set orientation(value: LyraDividerOrientation) {
    const previous = this._orientation;
    this._orientation = orientationValues.normalizeReflected(this, 'orientation', value);
    this.requestUpdate('orientation', previous);
  }
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
