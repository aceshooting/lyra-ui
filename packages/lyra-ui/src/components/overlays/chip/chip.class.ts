import { html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { closeIcon } from '../../../internal/icons.js';
import { styles } from './chip.styles.js';

export type ChipTone = 'neutral' | 'brand' | 'success' | 'warning' | 'danger';
export type ChipSize = '2xs' | 'xs' | 's' | 'm' | 'l' | 'xl';

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
 * `detail: { value, selected }` -- the chip has already toggled its own `selected` state by the
 * time this fires.
 * @csspart base - The pill's root container.
 * @csspart icon - Wrapper around the `icon` slot. Hidden entirely while empty.
 * @csspart label - Wrapper around the default slot.
 * @csspart remove-button - The remove (×) affordance, only rendered while `removable`.
 * @cssprop [--lr-chip-pressed-bg=var(--lr-chip-bg)] - Background while a toggleable chip is
 * selected, independently themeable from its resting background.
 */
export class LyraChip extends LyraElement<LyraChipEventMap> {
  static styles = [LyraElement.styles, styles];

  /** Visual density. `m` preserves the original chip dimensions. */
  @property({ reflect: true }) size: ChipSize = 'm';

  /** Status/emphasis color. `neutral` (the default) reads as plain/unstyled. */
  @property({ reflect: true }) tone: ChipTone = 'neutral';

  /** Shows the remove (×) button. */
  @property({ type: Boolean, reflect: true }) removable = false;

  /** Opt-in toggle/pressed mode -- the current pressed value. Setting `selected` (to `true`, the
   *  common way to start a chip already pressed) opts the chip into toggle mode automatically, so
   *  `<lr-chip selected>` alone is enough: `[part='base']` becomes focusable and
   *  keyboard-activatable (Enter/Space, mirroring native `<button>` behavior), reflects
   *  `aria-pressed`, and toggles on click/activation, emitting `lr-chip-select`. That opt-in
   *  (tracked by `toggleable`, see below) persists once made, so toggling `selected` back to
   *  `false` never strips the chip's interactivity -- a chip a user has clicked "off" must stay
   *  clickable to turn it back "on". Has no effect (no interactive semantics added to
   *  `[part='base']`) when combined with `removable`, since the remove button already nests inside
   *  `[part='base']` -- axe-core's `nested-interactive` rule forbids a focusable descendant of a
   *  `role="button"` ancestor, and this component's two real use cases (a chart-series visibility
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

  protected willUpdate(changed: PropertyValues): void {
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

  private onBaseClick = (): void => {
    if (this.removable) return;
    this.selected = !this.selected;
    this.emit<ChipSelectDetail>('lr-chip-select', { value: this.value, selected: this.selected });
  };

  private onBaseKeyDown = (e: KeyboardEvent): void => {
    if (this.removable) return;
    if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
      e.preventDefault();
      this.onBaseClick();
    }
  };

  render(): TemplateResult {
    // `toggleMode` is sticky (see `toggleable`'s doc comment) and gates the chip's structural
    // interactivity, so it survives `selected` toggling back to false. `pressed` tracks only the
    // *current* value, for `aria-pressed`.
    const toggleMode = this.toggleable && !this.removable;
    const pressed = this.selected && !this.removable;
    return html`
      <span
        part="base"
        role=${toggleMode ? 'button' : nothing}
        tabindex=${toggleMode ? '0' : nothing}
        aria-pressed=${toggleMode ? (pressed ? 'true' : 'false') : nothing}
        @click=${toggleMode ? this.onBaseClick : nothing}
        @keydown=${toggleMode ? this.onBaseKeyDown : nothing}
      >
        <span part="icon" aria-hidden="true" ?hidden=${!this.hasIconSlot}>
          <slot name="icon" @slotchange=${this.onIconSlotChange}></slot>
        </span>
        <span part="label"><slot></slot></span>
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
