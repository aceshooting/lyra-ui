import { html, nothing, type TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import { LyraElement } from '../../internal/lyra-element.js';
import { defineElement } from '../../internal/prefix.js';
import { styles } from './result-card.styles.js';

/**
 * `<lyra-result-card>` — a small bordered card shell for a custom tool-result
 * renderer's body (see `<lyra-tool-result-view>`'s `registerToolRenderer()`
 * in `../tool-result-view/registry.js`). Purely visual, with no state of its
 * own beyond slot-presence tracking: it gives every custom renderer the same
 * "small card" language (border, radius, optional title + header actions)
 * without each one hand-rolling its own box.
 *
 * Pairs with `<lyra-result-field>` for the label/value rows that typically
 * make up the body, though the default slot accepts any content — nothing
 * here requires a `<lyra-result-field>` specifically.
 *
 * @customElement lyra-result-card
 * @slot - The card body — typically one or more `<lyra-result-field>` rows.
 * @slot actions - Small header controls (e.g. a copy button), rendered
 * alongside the title.
 * @csspart base - The outer bordered container.
 * @csspart header - The header row wrapping the title and the `actions`
 * slot. Present in the DOM at all times (so a later `slotchange` on
 * `actions` is still observed) but `hidden` whenever there is no `title`
 * and no `actions` content — an untitled, action-less card has no visible
 * header bar at all.
 * @csspart title - The title text.
 * @csspart actions - The wrapper around the `actions` slot. `hidden`
 * whenever the slot has no assigned content.
 * @csspart body - The wrapper around the default slot.
 */
export class LyraResultCard extends LyraElement {
  static styles = [LyraElement.styles, styles];

  /** Small heading for the card. Leave unset for an untitled card (e.g. a
   *  bare block of `<lyra-result-field>` rows with no natural heading). */
  @property() title = '';

  // See `<lyra-widget>`'s identical `hasActionsSlot` -- a `[part]` wrapper
  // always contains a literal `<slot>` child regardless of assigned
  // content, so CSS `:empty` never matches; real emptiness is tracked here
  // in JS instead and used to both hide the actions wrapper and decide
  // whether the header row itself has anything to show.
  @state() private hasActionsSlot = false;

  protected willUpdate(): void {
    if (!this.hasUpdated) {
      this.hasActionsSlot = Array.from(this.children).some((el) => el.getAttribute('slot') === 'actions');
    }
  }

  private onActionsSlotChange = (e: Event): void => {
    this.hasActionsSlot = (e.target as HTMLSlotElement).assignedElements({ flatten: true }).length > 0;
  };

  render(): TemplateResult {
    const hasTitle = this.title.length > 0;
    const hasHeader = hasTitle || this.hasActionsSlot;
    return html`
      <div part="base">
        <div part="header" ?hidden=${!hasHeader}>
          ${hasTitle ? html`<span part="title">${this.title}</span>` : nothing}
          <div part="actions" ?hidden=${!this.hasActionsSlot}>
            <slot name="actions" @slotchange=${this.onActionsSlotChange}></slot>
          </div>
        </div>
        <div part="body"><slot></slot></div>
      </div>
    `;
  }
}

defineElement('result-card', LyraResultCard);

declare global {
  interface HTMLElementTagNameMap {
    'lyra-result-card': LyraResultCard;
  }
}
