import { html, type TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
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

  // `[part='icon']:empty` never matches because the part always contains a
  // `<slot>` element (CSS `:empty` only ignores text/comment nodes). Track
  // real slot assignment in JS instead and key the CSS off these instead.
  @state() private hasIcon = false;
  @state() private hasActions = false;

  firstUpdated(): void {
    // `slotchange` isn't guaranteed to fire for content already present at
    // parse/upgrade time in every browser, so do an initial check here too.
    this.checkIconSlot(this.shadowRoot!.querySelector('slot:not([name])') as HTMLSlotElement);
    this.checkActionsSlot(this.shadowRoot!.querySelector('slot[name="actions"]') as HTMLSlotElement);
  }

  private checkIconSlot(slot: HTMLSlotElement): void {
    this.hasIcon = slot.assignedElements({ flatten: true }).length > 0;
  }

  private checkActionsSlot(slot: HTMLSlotElement): void {
    this.hasActions = slot.assignedElements({ flatten: true }).length > 0;
  }

  private onIconSlotChange = (e: Event): void => {
    this.checkIconSlot(e.target as HTMLSlotElement);
  };

  private onActionsSlotChange = (e: Event): void => {
    this.checkActionsSlot(e.target as HTMLSlotElement);
  };

  render(): TemplateResult {
    return html`
      <div part="base">
        <div part="icon" ?hidden=${!this.hasIcon}><slot @slotchange=${this.onIconSlotChange}></slot></div>
        <p part="heading">${this.heading}</p>
        <p part="description">${this.description}</p>
        <div part="actions" ?hidden=${!this.hasActions}>
          <slot name="actions" @slotchange=${this.onActionsSlotChange}></slot>
        </div>
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
