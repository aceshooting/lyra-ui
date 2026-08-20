import { html, type TemplateResult } from 'lit';
import { LyraElement } from '../../../internal/lyra-element.js';
import { styles } from './funnel.styles.js';

/**
 * `<lr-funnel>` — a themeable Funnel content surface.
 *
 * @customElement lr-funnel
 * @slot - Main content.
 * @csspart base - The content container.
 * @status experimental
 * @since unreleased
 */
export class LyraFunnel extends LyraElement {
  static override styles = [LyraElement.styles, styles];

  override render(): TemplateResult {
    return html`<div part="base"><slot></slot></div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-funnel': LyraFunnel;
  }
}
