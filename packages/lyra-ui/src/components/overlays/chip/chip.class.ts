import { html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { closeIcon } from '../../../internal/icons.js';
import { styles } from './chip.styles.js';

export type ChipTone = 'neutral' | 'brand' | 'success' | 'warning' | 'danger';
export type ChipSize = '3xs' | '2xs' | 'xs' | 's' | 'm' | 'l' | 'xl';

export interface ChipRemoveDetail {
  value?: string;
}

export interface ChipSelectDetail {
  value?: string;
  selected: boolean;
}

export interface LyraChipEventMap {
  'lr-remove': CustomEvent<ChipRemoveDetail>;
  'lr-chip-select': CustomEvent<ChipSelectDetail>;
}

/**
 * `<lr-chip>` — a small, content-agnostic pill for a short label: a tag, an
 * active-filter/scope indicator, etc. Distinct from `<lr-attachment-chip>`
 * (specifically file-shaped, with a thumbnail/size/upload-progress) — this
 * one carries no domain assumptions at all, just a label and an optional
 * leading icon/dot.
 *
 * `tone` tints the whole pill using the same loud-color-on-quiet-tint
 * convention `<lr-tool-call-chip>`/`<lr-citation-badge>` already
 * establish for status coloring: background is the tone's `-quiet` tint,
 * text/icon is the tone's loud color. `neutral` (the default) has no
 * dedicated token pair of its own, so it falls back to a plain
 * bordered-surface look — the same "no signal" treatment
 * `<lr-citation-badge>`'s `default` status and `<lr-tool-call-chip>`'s
 * `pending` status already use.
 *
 * This is a controlled component: clicking the remove (×) button only fires
 * `lr-remove` — the chip never removes itself from the DOM on its own
 * interaction, the same contract `<lr-attachment-chip>`/
 * `<lr-conversation-item>` already follow. A consumer owns the underlying
 * list and decides whether/how the click actually removes anything.
 *
 * @customElement lr-chip
 * @slot - The chip's label content.
 * @slot icon - Optional leading icon or status dot. Nothing is reserved for
 * it (no extra gap) when left empty.
 * @event lr-remove - The remove (×) button was activated (click, or
 * Enter/Space while focused — native `<button>` behavior). `detail: { value }`
 * — `value` is `undefined` when the `value` prop was never set. Only
 * rendered while `removable`.
 * @event lr-chip-select - Fired on click, or Enter/Space while focused, once the chip has
 * opted into toggle mode (via `selected` or `toggleable`) and `removable` is not set.
 * `detail: { value, selected }` contains the proposed next state. Cancelable; preventing it keeps
 * the current `selected` state unchanged.
 * @method focus - Forwards focus to the chip's active remove or toggle button.
 * @method blur - Forwards blur to the chip's active remove or toggle button.
 * @method click - Activates the chip's active remove or toggle button; passive chips retain the
 * ordinary `HTMLElement.click()` behavior.
 * @csspart base - The pill's root container.
 * @csspart icon - Wrapper around the `icon` slot. Hidden entirely while empty.
 * @csspart label - Wrapper around the default slot.
 * @csspart toggle-button - The real toggle control, rendered over the non-interactive label when
 * toggle mode is active.
 * @csspart remove-button - The remove (×) affordance, only rendered while `removable`.
 * @cssprop [--lr-chip-accent=var(--lr-color-text)] - Text/icon color of the pill. Each `tone` sets
 * it to that tone's loud color.
 * @cssprop [--lr-chip-bg=var(--lr-color-surface)] - Background of the pill. Each `tone` sets it to
 * that tone's `-quiet` tint.
 * @cssprop [--lr-chip-border=var(--lr-color-border)] - Border color of the pill. Every non-neutral
 * `tone` sets it to `transparent`.
 * @cssprop [--lr-chip-font-size=var(--lr-font-size-sm)] - Label font size. Each `size` sets it to
 * that step's font size.
 * @cssprop [--lr-chip-gap=var(--lr-space-xs)] - Gap between the icon, label, and remove button.
 * Each `size` sets it to that step's gap.
 * @cssprop [--lr-chip-radius=var(--lr-radius-pill)] - Corner radius of the pill and of the remove
 * button, kept in sync so retuning one retunes both. Does not vary by `size` tier.
 * @cssprop [--lr-chip-icon-size=var(--lr-font-size-sm)] - Font size of the `icon` slot wrapper.
 * Each `size` sets it to that step's icon size.
 * @cssprop [--lr-chip-padding-block=var(--lr-size-0-25rem)] - Block padding of the pill. Each
 * `size` sets it to that step's block padding.
 * @cssprop [--lr-chip-padding-inline=var(--lr-space-s)] - Inline padding of the pill. Each `size`
 * sets it to that step's inline padding.
 * @cssprop [--lr-chip-min-height=var(--lr-size-1-5rem)] - Component density floor for an
 * interactive chip. The real toggle/remove controls also enforce the shared
 * `--lr-icon-button-size` target floor.
 * @cssprop --lr-chip-height - Exact block size of the chip. Undeclared by default, so the chip
 * grows to fit its content (floored by `--lr-chip-min-height` when interactive). Set it to pin a
 * fixed height. A value below the shared interactive target is for non-interactive chips only.
 * @cssprop [--lr-chip-pressed-bg=var(--lr-chip-bg)] - Background while a toggleable chip is
 * selected, independently themeable from its resting background.
 * @cssprop [--lr-chip-pressed-border=var(--lr-chip-accent)] - Border color while a toggleable chip
 * is selected, independently themeable from the label/icon color.
 */
export class LyraChip extends LyraElement<LyraChipEventMap> {
  static override styles = [LyraElement.styles, styles];

  /** Visual density. `m` preserves the original chip dimensions. */
  @property({ reflect: true }) size: ChipSize = 'm';

  /** Status/emphasis color. `neutral` (the default) reads as plain/unstyled. */
  @property({ reflect: true }) tone: ChipTone = 'neutral';

  /** Shows the remove (×) button. */
  @property({ type: Boolean, reflect: true }) removable = false;

  /** Opt-in toggle/pressed mode -- the current pressed value. Setting `selected` (to `true`, the
   *  common way to start a chip already pressed) opts the chip into toggle mode automatically, so
   *  `<lr-chip selected>` alone is enough: `[part='toggle-button']` renders as a native,
   *  keyboard-activatable button and reflects
   *  `aria-pressed`, and toggles on click/activation, emitting `lr-chip-select`. That opt-in
   *  (tracked by `toggleable`, see below) persists once made, so toggling `selected` back to
   *  `false` never strips the chip's interactivity -- a chip a user has clicked "off" must stay
   *  clickable to turn it back "on". Has no effect when combined with `removable`, since that
   *  mode already owns the chip's one native action. The label slot is inert in toggle mode, so
   *  unrestricted slotted descendants can never nest inside or double-activate the real button.
   *  This component's two real use cases (a chart-series visibility
   *  toggle, a category filter chip) never need both at once. `false` (the default, with
   *  `toggleable` also left at its default) reproduces today's exact passive-label-pill output. */
  @property({ type: Boolean, reflect: true }) selected = false;

  /** Explicit opt-in into `selected`'s toggle/pressed interactive mode, independent of the
   *  *current* value of `selected`. Setting `selected` to `true` at any point opts in
   *  automatically (see its doc comment) and keeps this `true` from then on, which is enough for
   *  a chip that starts already pressed. Set `toggleable` directly for a chip that must be
   *  clickable from the outset while starting **unselected** -- e.g. an initially-inactive
   *  category filter chip -- since `selected`'s own default (`false`) can't be distinguished from
   *  "never opted in" on its own. */
  @property({ type: Boolean, reflect: true }) toggleable = false;

  /** Opaque consumer bookkeeping value — never read, validated, or rendered
   *  by this component itself, only ever echoed back verbatim (including
   *  `undefined` if never set) in `lr-remove`'s detail. */
  @property() value?: string;

  // A `[part]` always contains a literal `<slot>` child regardless of
  // assigned content, so `:empty` never matches — real emptiness is tracked
  // in JS instead, the same fix `<lr-stat>`'s `hasIcon`/
  // `<lr-tool-call-chip>`'s `hasDetailSlot` etc. already establish.
  @state() private hasIconSlot = false;
  private labelObserver?: MutationObserver;

  override connectedCallback(): void {
    super.connectedCallback();
    this.labelObserver ??= new MutationObserver(() => this.requestUpdate());
    this.labelObserver.observe(this, { childList: true, characterData: true, subtree: true });
  }

  override disconnectedCallback(): void {
    this.labelObserver?.disconnect();
    super.disconnectedCallback();
  }

  protected override willUpdate(changed: PropertyValues): void {
    if (!this.hasUpdated) {
      this.hasIconSlot = Array.from(this.children).some((el) => el.getAttribute('slot') === 'icon');
    }
    // Sticky opt-in: once `selected` has been true at any point, `toggleable` latches on and
    // never resets, so toggling `selected` back to false later can't un-opt the chip out of
    // toggle mode. `toggleable` can also be set directly up front for a chip that starts
    // unselected (selected's own default) but must still be interactive from the outset.
    if (changed.has('selected') && this.selected) {
      this.toggleable = true;
    }
  }

  private onIconSlotChange = (e: Event): void => {
    this.hasIconSlot = (e.target as HTMLSlotElement).assignedElements({ flatten: true }).length > 0;
  };

  // Only the default slot's own content counts toward the remove button's
  // accessible name — text incidentally living inside the (decorative)
  // `icon` slot shouldn't leak into "Remove {text}". Restricting to Text and
  // Element nodes also excludes Comment nodes: when a consumer interpolates
  // the label via a lit-html expression (`html\`<lr-chip>${label}</lr-chip>\``,
  // the ordinary way a data-driven label gets bound) rather than a static
  // string, lit-html inserts a marker Comment node alongside the Text node in
  // the light DOM. That comment's own (non-empty) data is internal
  // bookkeeping, not label content, so it must never reach `textContent`.
  private get labelText(): string {
    return Array.from(this.childNodes)
      .filter(
        (n): n is Text | Element =>
          (n.nodeType === Node.TEXT_NODE || n instanceof Element) &&
          !(n instanceof Element && n.getAttribute('slot') === 'icon'),
      )
      .map((n) => n.textContent ?? '')
      .join('')
      .trim();
  }

  private get accessibleRemoveLabel(): string {
    const text = this.labelText;
    return text ? this.localize('removeWithContext', undefined, { label: text }) : this.localize('remove');
  }

  private onRemoveClick = (): void => {
    this.emit<ChipRemoveDetail>('lr-remove', { value: this.value });
  };

  private onToggleClick = (): void => {
    const selected = !this.selected;
    const event = this.emit<ChipSelectDetail>(
      'lr-chip-select',
      { value: this.value, selected },
      { cancelable: true },
    );
    if (!event.defaultPrevented) this.selected = selected;
  };

  private get primaryControl(): HTMLButtonElement | null {
    return this.renderRoot.querySelector<HTMLButtonElement>(
      this.removable ? '[part="remove-button"]' : '[part="toggle-button"]',
    );
  }

  override focus(options?: FocusOptions): void {
    this.primaryControl?.focus(options);
  }

  override blur(): void {
    this.primaryControl?.blur();
  }

  override click(): void {
    const control = this.primaryControl;
    if (control) control.click();
    else super.click();
  }

  override render(): TemplateResult {
    // `toggleMode` is sticky (see `toggleable`'s doc comment) and gates the chip's structural
    // interactivity, so it survives `selected` toggling back to false. `pressed` tracks only the
    // *current* value, for `aria-pressed`.
    const toggleMode = this.toggleable && !this.removable;
    const pressed = this.selected && !this.removable;
    return html`
      <span
        part="base"
      >
        <span part="icon" aria-hidden="true" ?hidden=${!this.hasIconSlot}>
          <slot name="icon" @slotchange=${this.onIconSlotChange}></slot>
        </span>
        <span part="label" ?inert=${toggleMode}><slot></slot></span>
        ${toggleMode
          ? html`<button
              part="toggle-button"
              type="button"
              aria-label=${this.getAttribute('aria-label') || this.labelText || nothing}
              aria-pressed=${pressed ? 'true' : 'false'}
              @click=${this.onToggleClick}
            ></button>`
          : nothing}
        ${this.removable
          ? html`<button part="remove-button" type="button" aria-label=${this.accessibleRemoveLabel} @click=${this.onRemoveClick}>
              ${closeIcon()}
            </button>`
          : nothing}
      </span>
    `;
  }
}


declare global {
  interface HTMLElementTagNameMap {
    'lr-chip': LyraChip;
  }
}
