import { html, type TemplateResult, type PropertyValues } from 'lit';
import { property, state } from 'lit/decorators.js';
import { LyraElement } from '../../internal/lyra-element.js';
import { safeLinkHref } from '../../internal/safe-url.js';
import { styles } from './card.styles.js';

export type CardAppearance = 'accent' | 'filled' | 'outlined' | 'filled-outlined' | 'plain';

/**
 * `<lr-card>` — a generic, styled bordered content container: the "small bordered surface with
 * padding" idiom common to hero highlights, clickable grid tiles, and management-list items. A
 * direct `<lr-*>` counterpart to `<wa-card>`'s contract, staying slot-compatible with
 * `lr-result-card` where they overlap.
 *
 * The header is allocation-responsive: long or translated header content can shrink and wrap,
 * and the actions group moves onto another line when both no longer fit side by side.
 *
 * @customElement lr-card
 * @slot - The card body.
 * @slot header - Header row content, rendered above the body.
 * @slot media - Media content (e.g. an image), rendered above the header.
 * @slot footer - Footer content, rendered below the body.
 * @slot actions - Small header controls, rendered alongside the header content.
 * @csspart base - The outer container (a `<div>`, or an `<a>` when `href` is set).
 * @csspart media - Wrapper around the `media` slot. Hidden entirely when empty.
 * @csspart header - Wrapper around the `header` slot and `actions`. Hidden entirely when both are empty.
 * @csspart actions - Wrapper around the `actions` slot. Hidden entirely when empty.
 * @csspart body - Wrapper around the default slot.
 * @csspart footer - Wrapper around the `footer` slot. Hidden entirely when empty.
 */
export class LyraCard extends LyraElement {
  static styles = [LyraElement.styles, styles];

  /** Visual treatment, mirroring `wa-card`'s `appearance` vocabulary. `'outlined'` (the default)
   *  is a bordered surface -- the common "small bordered surface with padding" idiom. */
  @property({ reflect: true }) appearance: CardAppearance = 'outlined';

  /** Opt-in hover/focus-visible treatment (border-color shift, cursor: pointer) for a card used
   *  as a clickable tile -- purely visual; this component takes no position on what "activate"
   *  means unless `href` is also set. `false` (the default) reproduces today's exact static
   *  output. */
  @property({ type: Boolean, reflect: true }) interactive = false;

  /** When set, the card's root renders as a real `<a href=...>` instead of a `<div>` -- for a
   *  whole-card link (e.g. a wide CTA tile). Unset (the default) renders a plain `<div>`. */
  @property() href?: string;

  @state() private hasHeaderSlot = false;
  @state() private hasMediaSlot = false;
  @state() private hasFooterSlot = false;
  @state() private hasActionsSlot = false;

  protected willUpdate(changed: PropertyValues): void {
    if (!this.hasUpdated) {
      this.hasHeaderSlot = Array.from(this.children).some((el) => el.getAttribute('slot') === 'header');
      this.hasMediaSlot = Array.from(this.children).some((el) => el.getAttribute('slot') === 'media');
      this.hasFooterSlot = Array.from(this.children).some((el) => el.getAttribute('slot') === 'footer');
      this.hasActionsSlot = Array.from(this.children).some((el) => el.getAttribute('slot') === 'actions');
    }
    void changed;
  }

  private onHeaderSlotChange = (e: Event): void => {
    this.hasHeaderSlot = (e.target as HTMLSlotElement).assignedElements({ flatten: true }).length > 0;
  };
  private onMediaSlotChange = (e: Event): void => {
    this.hasMediaSlot = (e.target as HTMLSlotElement).assignedElements({ flatten: true }).length > 0;
  };
  private onFooterSlotChange = (e: Event): void => {
    this.hasFooterSlot = (e.target as HTMLSlotElement).assignedElements({ flatten: true }).length > 0;
  };
  private onActionsSlotChange = (e: Event): void => {
    this.hasActionsSlot = (e.target as HTMLSlotElement).assignedElements({ flatten: true }).length > 0;
  };

  render(): TemplateResult {
    const hasHeader = this.hasHeaderSlot || this.hasActionsSlot;
    const body = html`
      <div part="media" ?hidden=${!this.hasMediaSlot}>
        <slot name="media" @slotchange=${this.onMediaSlotChange}></slot>
      </div>
      <div part="header" ?hidden=${!hasHeader}>
        <slot name="header" @slotchange=${this.onHeaderSlotChange}></slot>
        <div part="actions" ?hidden=${!this.hasActionsSlot}>
          <slot name="actions" @slotchange=${this.onActionsSlotChange}></slot>
        </div>
      </div>
      <div part="body"><slot></slot></div>
      <div part="footer" ?hidden=${!this.hasFooterSlot}>
        <slot name="footer" @slotchange=${this.onFooterSlotChange}></slot>
      </div>
    `;
    const href = safeLinkHref(this.href);
    return href
      ? html`<a part="base" href=${href}>${body}</a>`
      : html`<div part="base">${body}</div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-card': LyraCard;
  }
}
