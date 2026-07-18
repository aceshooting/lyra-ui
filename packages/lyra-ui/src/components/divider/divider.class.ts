import { html, type TemplateResult } from 'lit';
import { property } from 'lit/decorators.js';
import { LyraElement } from '../../internal/lyra-element.js';
import { styles } from './divider.styles.js';

export type DividerOrientation = 'horizontal' | 'vertical';

/**
 * `<lr-divider>` — a themeable semantic separator.
 *
 * @customElement lr-divider
 * @csspart base - The separator element.
 */
export class LyraDivider extends LyraElement {
  static styles = [LyraElement.styles, styles];
  @property({ reflect: true }) orientation: DividerOrientation = 'horizontal';
  render(): TemplateResult { return html`<hr part="base" role="separator" aria-orientation=${this.orientation}>`; }
}
declare global { interface HTMLElementTagNameMap { 'lr-divider': LyraDivider; } }
