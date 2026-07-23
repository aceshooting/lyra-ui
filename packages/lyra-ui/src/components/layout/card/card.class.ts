import { html, nothing, type TemplateResult, type PropertyValues } from "lit";
import { property, state } from "lit/decorators.js";
import { LyraElement } from "../../../internal/lyra-element.js";
import { safeLinkHref } from "../../../internal/safe-url.js";
import { styles } from "./card.styles.js";

export type CardAppearance =
  | "accent"
  | "filled"
  | "outlined"
  | "filled-outlined"
  | "plain";

export interface LyraCardEventMap {
  "lr-card-activate": CustomEvent<undefined>;
}

/**
 * Anything in the composed path between the original event target and `[part='base']` that a user
 * would reasonably consider "the thing I clicked". A whole-card activation must not fire when the
 * user aimed at a slotted control inside the card -- the card is a *container*, so unlike
 * `<lr-chip>`'s `toggleable` (which forbids focusable children outright and can therefore carry
 * `role="button"`), it can only distinguish the two cases at event time.
 */
const NESTED_CONTROL_SELECTOR = [
  "a[href]",
  "button",
  "input",
  "select",
  "textarea",
  "summary",
  "audio[controls]",
  "video[controls]",
  "label",
  '[contenteditable]:not([contenteditable="false"])',
  '[tabindex]:not([tabindex="-1"])',
  '[role="button"]',
  '[role="link"]',
  '[role="checkbox"]',
  '[role="switch"]',
  '[role="radio"]',
  '[role="menuitem"]',
  '[role="option"]',
  '[role="tab"]',
  '[role="textbox"]',
  '[role="slider"]',
  '[role="spinbutton"]',
].join(",");

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
 * @csspart activation-button - The native whole-card action, rendered while `interactive`
 *   without `href`. It is a sibling of slotted controls, so actionable descendants are never
 *   nested inside another actionable role.
 * @csspart media - Wrapper around the `media` slot. Hidden entirely when empty.
 * @csspart header - Wrapper around the `header` slot and `actions`. Hidden entirely when both are empty.
 * @csspart actions - Wrapper around the `actions` slot. Hidden entirely when empty.
 * @csspart body - Wrapper around the default slot.
 * @csspart footer - Wrapper around the `footer` slot. Hidden entirely when empty.
 * @event lr-card-activate - The whole card was activated (click, or Enter/Space on the native
 * `activation-button`). No detail. Only fired while `interactive` is set **without** `href`
 * -- with `href` the root is a real `<a>` and native navigation is the activation. Never fired for
 * an interaction that originated in a slotted control (a button, link, input, or anything else
 * focusable), so a card can keep its own action buttons.
 */
export class LyraCard extends LyraElement<LyraCardEventMap> {
  static override styles = [LyraElement.styles, styles];

  /** Visual treatment, mirroring `wa-card`'s `appearance` vocabulary. `'outlined'` (the default)
   *  is a bordered surface -- the common "small bordered surface with padding" idiom. */
  @property({ reflect: true }) appearance: CardAppearance = "outlined";

  /** Opt-in clickable-tile behavior: the hover/focus-visible treatment (border-color shift,
   *  `cursor: pointer`) plus, when `href` is **not** also set, real activation semantics --
   *  `[part='base']` becomes focusable (`tabindex="0"`), responds to Enter/Space, and emits
   *  `lr-card-activate`. With `href` set the root is already a real `<a>`, so native navigation
   *  stays the activation and `lr-card-activate` is never fired. `false` (the default) reproduces
   *  today's exact static output: no `tabindex`, no listeners, no events. */
  @property({ type: Boolean, reflect: true }) interactive = false;

  /** Host `aria-label` forwarded to the native no-href activation button. */
  @property({ attribute: "aria-label" }) accessibleLabel: string | null = null;

  /** When set, the card's root renders as a real `<a href=...>` instead of a `<div>` -- for a
   *  whole-card link (e.g. a wide CTA tile). Unset (the default) renders a plain `<div>`. */
  @property() href?: string;

  /** Native anchor target, used only while `href` resolves to a link. Setting this to `'_blank'`
   *  (or any other target) automatically derives `rel="noopener noreferrer"` on the rendered
   *  anchor -- there is no separately-settable `rel` property, so a consumer can't forget it and
   *  leave the opened page holding a `window.opener` back-reference (reverse-tabnabbing). Matches
   *  `lr-stat`'s/`lr-app-rail-item`'s identical pattern. */
  @property() target?: string;

  @state() private hasHeaderSlot = false;
  @state() private hasMediaSlot = false;
  @state() private hasFooterSlot = false;
  @state() private hasActionsSlot = false;
  @state() private accessibleContentText = "";
  private contentObserver?: MutationObserver;

  protected override willUpdate(changed: PropertyValues): void {
    if (!this.hasUpdated) {
      this.hasHeaderSlot = Array.from(this.children).some(
        (el) => el.getAttribute("slot") === "header"
      );
      this.hasMediaSlot = Array.from(this.children).some(
        (el) => el.getAttribute("slot") === "media"
      );
      this.hasFooterSlot = Array.from(this.children).some(
        (el) => el.getAttribute("slot") === "footer"
      );
      this.hasActionsSlot = Array.from(this.children).some(
        (el) => el.getAttribute("slot") === "actions"
      );
      this.accessibleContentText = this.textContent?.trim() ?? "";
    }
    void changed;
  }

  private onHeaderSlotChange = (e: Event): void => {
    this.hasHeaderSlot =
      (e.target as HTMLSlotElement).assignedElements({ flatten: true }).length >
      0;
  };
  private onMediaSlotChange = (e: Event): void => {
    this.hasMediaSlot =
      (e.target as HTMLSlotElement).assignedElements({ flatten: true }).length >
      0;
  };
  private onFooterSlotChange = (e: Event): void => {
    this.hasFooterSlot =
      (e.target as HTMLSlotElement).assignedElements({ flatten: true }).length >
      0;
  };
  private onActionsSlotChange = (e: Event): void => {
    this.hasActionsSlot =
      (e.target as HTMLSlotElement).assignedElements({ flatten: true }).length >
      0;
  };

  /**
   * A card is a *container*, so it cannot forbid focusable children the way `<lr-chip>`'s
   * `toggleable` mode does -- which is exactly why `[part='base']` deliberately carries no
   * `role="button"` (axe-core's `nested-interactive` rule, which this library's own a11y gate
   * enforces, forbids a focusable descendant of a `role="button"` ancestor). The trade-off is that
   * "did the user aim at the card, or at a control inside it?" has to be answered at event time
   * instead: walk `composedPath()` from the original target up to `[part='base']` and bail out if
   * anything along the way is itself a control. `composedPath()` (rather than `e.target`) is what
   * makes this work through a slotted component's own shadow root -- a click on `<lr-button>`
   * retargets to the host, but its composed path still contains the internal native `<button>`.
   */
  private originatesInNestedControl(
    e: Event,
    root: EventTarget | null
  ): boolean {
    for (const node of e.composedPath()) {
      if (node === root) return false;
      if (node instanceof Element && node.matches(NESTED_CONTROL_SELECTOR))
        return true;
    }
    return false;
  }

  private onBaseClick = (e: Event): void => {
    const origin = e.composedPath()[0];
    if (
      origin instanceof Element &&
      origin.getAttribute("part") === "activation-button"
    ) {
      this.emit("lr-card-activate");
      return;
    }
    if (this.originatesInNestedControl(e, e.currentTarget)) return;
    this.emit("lr-card-activate");
  };

  override connectedCallback(): void {
    super.connectedCallback();
    this.contentObserver = new MutationObserver(() => {
      this.accessibleContentText = this.textContent?.trim() ?? "";
    });
    this.contentObserver.observe(this, {
      childList: true,
      characterData: true,
      subtree: true,
    });
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.contentObserver?.disconnect();
    this.contentObserver = undefined;
  }

  override render(): TemplateResult {
    const hasHeader = this.hasHeaderSlot || this.hasActionsSlot;
    const href = safeLinkHref(this.href);
    const activatable = this.interactive && !href;
    const body = html`
      ${activatable
        ? html`<button
            part="activation-button"
            type="button"
            tabindex="0"
            aria-label=${this.accessibleLabel ||
            this.accessibleContentText ||
            nothing}
          ></button>`
        : nothing}
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
    // With `href`, the `<a>` is already focusable and Enter-activated natively -- layering the
    // synthetic activation on top would double-fire. Everything below binds to `nothing` when the
    // card has not opted in, so the passive default renders byte-identically to before (mirrors
    // `<lr-chip>`'s `toggleable` gating).
    return href
      ? html`<a
          part="base"
          href=${href}
          target=${this.target || nothing}
          rel=${this.target ? "noopener noreferrer" : nothing}
          >${body}</a
        >`
      : html`<div
          part="base"
          @click=${activatable ? this.onBaseClick : nothing}
        >
          ${body}
        </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "lr-card": LyraCard;
  }
}
