import { html, nothing, type TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import { LyraElement } from '../../internal/lyra-element.js';
import { StripHostTitleAttribute } from '../../internal/strip-host-title.js';
import { styles } from './result-card.styles.js';

class LyraResultCardBase extends LyraElement {}

/**
 * `<lr-result-card>` — a small bordered card shell for a custom tool-result
 * renderer's body (see `<lr-tool-result-view>`'s `registerToolRenderer()`
 * in `../tool-result-view/registry.js`). Purely visual, with no state of its
 * own beyond slot-presence tracking: it gives every custom renderer the same
 * "small card" language (border, radius, optional title + header actions)
 * without each one hand-rolling its own box.
 *
 * Pairs with `<lr-result-field>` for the label/value rows that typically
 * make up the body, though the default slot accepts any content — nothing
 * here requires a `<lr-result-field>` specifically.
 *
 * @customElement lr-result-card
 * @slot - The card body — typically one or more `<lr-result-field>` rows.
 * @slot actions - Small header controls (e.g. a copy button), rendered
 * alongside the title.
 * @csspart base - The outer bordered container.
 * @csspart header - The header row wrapping the title and the `actions`
 * slot. Present in the DOM at all times (so a later `slotchange` on
 * `actions` is still observed) but `hidden` whenever there is no `title`
 * and no `actions` content — an untitled, action-less card has no visible
 * header bar at all.
 * @csspart title - The title text. Truncates with an ellipsis when it
 * overflows; carries its own native `title` attribute (the full string) so
 * hovering the truncated text reveals it via the browser's default tooltip,
 * scoped to just this element rather than the whole card. The host's own
 * `title` attribute is stripped once Lit has synced it into the `title`
 * property (see `StripHostTitleAttribute` in `internal/strip-host-title.ts`),
 * so the native tooltip never also covers the rest of the card.
 * @csspart actions - The wrapper around the `actions` slot. `hidden`
 * whenever the slot has no assigned content.
 * @csspart body - The wrapper around the default slot.
 */
export class LyraResultCard extends StripHostTitleAttribute(LyraResultCardBase) {
  static styles = [LyraElement.styles, styles];

  /** Small heading for the card. Leave unset for an untitled card (e.g. a
   *  bare block of `<lr-result-field>` rows with no natural heading).
   *  Rendered into the truncating `[part="title"]` span, which also carries
   *  this value as its own `title` attribute so the disclosure tooltip is
   *  scoped to that element rather than the whole host -- a bare host-level
   *  `title` attribute (the browser's global tooltip attribute) is actively
   *  stripped once Lit has synced it into this property, so the card never
   *  grows an unsolicited native tooltip repeating the same text. See
   *  `StripHostTitleAttribute` (`internal/strip-host-title.ts`). */
  @property() title = '';

  // See `<lr-widget>`'s identical `hasActionsSlot` -- a `[part]` wrapper
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
          ${hasTitle ? html`<span part="title" title=${this.title}>${this.title}</span>` : nothing}
          <div part="actions" ?hidden=${!this.hasActionsSlot}>
            <slot name="actions" @slotchange=${this.onActionsSlotChange}></slot>
          </div>
        </div>
        <div part="body"><slot></slot></div>
      </div>
    `;
  }
}


declare global {
  interface HTMLElementTagNameMap {
    'lr-result-card': LyraResultCard;
  }
}

