import { html, type TemplateResult } from 'lit';
import { property } from 'lit/decorators.js';
import { LyraElement } from '../../internal/lyra-element.js';
import { defineElement } from '../../internal/prefix.js';
import { styles } from './empty.styles.js';

/**
 * `<lyra-empty>` — a generic empty/no-data state. First-party invention (no
 * Web Awesome equivalent); fills the gap identified across ~30 surveyed repos.
 *
 * @customElement lyra-empty
 * @slot - Custom icon or illustration (defaults to none).
 * @slot actions - Buttons/links shown below the description.
 * @csspart base, icon, heading, description, actions
 */
export class LyraEmpty extends LyraElement {
  static styles = [LyraElement.styles, styles];

  /** Short heading, e.g. "No results". */
  @property() heading = '';

  /** Supporting copy, e.g. "Try a different search." */
  @property() description = '';

  render(): TemplateResult {
    return html`
      <div part="base">
        <div part="icon"><slot></slot></div>
        <p part="heading">${this.heading}</p>
        <p part="description">${this.description}</p>
        <div part="actions"><slot name="actions"></slot></div>
      </div>
    `;
  }
}

defineElement('empty', LyraEmpty);

declare global {
  interface HTMLElementTagNameMap {
    'lyra-empty': LyraEmpty;
  }
}
