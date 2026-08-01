import { html, type TemplateResult } from 'lit';
import { LyraElement } from '../../../internal/lyra-element.js';
import { styles } from './visually-hidden.styles.js';

/**
 * `<lr-visually-hidden>` — hides its content from sight while leaving it in the accessibility
 * tree, so screen readers still announce it.
 *
 * Content becomes visible again while anything inside it holds focus, which is what makes the
 * element usable for skip links: the link is invisible until a keyboard user tabs to it.
 *
 * @customElement lr-visually-hidden
 * @slot - The content to hide visually.
 */
export class LyraVisuallyHidden extends LyraElement {
  static override styles = [LyraElement.styles, styles];

  override render(): TemplateResult {
    return html`<slot></slot>`;
  }
}

declare global { interface HTMLElementTagNameMap { 'lr-visually-hidden': LyraVisuallyHidden; } }
