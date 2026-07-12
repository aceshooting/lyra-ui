import { html, nothing, type TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import { LyraElement } from '../../internal/lyra-element.js';
import { defineElement } from '../../internal/prefix.js';
import { closeIcon } from '../../internal/icons.js';
import { styles } from './chip.styles.js';

export type ChipTone = 'neutral' | 'brand' | 'success' | 'warning' | 'danger';

export interface ChipRemoveDetail {
  value?: string;
}

/**
 * `<lyra-chip>` — a small, content-agnostic pill for a short label: a tag, an
 * active-filter/scope indicator, etc. Distinct from `<lyra-attachment-chip>`
 * (specifically file-shaped, with a thumbnail/size/upload-progress) — this
 * one carries no domain assumptions at all, just a label and an optional
 * leading icon/dot.
 *
 * `tone` tints the whole pill using the same loud-color-on-quiet-tint
 * convention `<lyra-tool-call-chip>`/`<lyra-citation-badge>` already
 * establish for status coloring: background is the tone's `-quiet` tint,
 * text/icon is the tone's loud color. `neutral` (the default) has no
 * dedicated token pair of its own, so it falls back to a plain
 * bordered-surface look — the same "no signal" treatment
 * `<lyra-citation-badge>`'s `default` status and `<lyra-tool-call-chip>`'s
 * `pending` status already use.
 *
 * This is a controlled component: clicking the remove (×) button only fires
 * `lyra-remove` — the chip never removes itself from the DOM on its own
 * interaction, the same contract `<lyra-attachment-chip>`/
 * `<lyra-conversation-item>` already follow. A consumer owns the underlying
 * list and decides whether/how the click actually removes anything.
 *
 * @customElement lyra-chip
 * @slot - The chip's label content.
 * @slot icon - Optional leading icon or status dot. Nothing is reserved for
 * it (no extra gap) when left empty.
 * @event lyra-remove - The remove (×) button was activated (click, or
 * Enter/Space while focused — native `<button>` behavior). `detail: { value }`
 * — `value` is `undefined` when the `value` prop was never set. Only
 * rendered while `removable`.
 * @csspart base - The pill's root container.
 * @csspart icon - Wrapper around the `icon` slot. Hidden entirely while empty.
 * @csspart label - Wrapper around the default slot.
 * @csspart remove-button - The remove (×) affordance, only rendered while `removable`.
 */
export class LyraChip extends LyraElement {
  static styles = [LyraElement.styles, styles];

  /** Status/emphasis color. `neutral` (the default) reads as plain/unstyled. */
  @property({ reflect: true }) tone: ChipTone = 'neutral';

  /** Shows the remove (×) button. */
  @property({ type: Boolean, reflect: true }) removable = false;

  /** Opaque consumer bookkeeping value — never read, validated, or rendered
   *  by this component itself, only ever echoed back verbatim (including
   *  `undefined` if never set) in `lyra-remove`'s detail. */
  @property() value?: string;

  // A `[part]` always contains a literal `<slot>` child regardless of
  // assigned content, so `:empty` never matches — real emptiness is tracked
  // in JS instead, the same fix `<lyra-stat>`'s `hasIcon`/
  // `<lyra-tool-call-chip>`'s `hasDetailSlot` etc. already establish.
  @state() private hasIconSlot = false;

  protected willUpdate(): void {
    if (!this.hasUpdated) {
      this.hasIconSlot = Array.from(this.children).some((el) => el.getAttribute('slot') === 'icon');
    }
  }

  private onIconSlotChange = (e: Event): void => {
    this.hasIconSlot = (e.target as HTMLSlotElement).assignedElements({ flatten: true }).length > 0;
  };

  // Only the default slot's own content counts toward the remove button's
  // accessible name — text incidentally living inside the (decorative)
  // `icon` slot shouldn't leak into "Remove {text}".
  private get labelText(): string {
    return Array.from(this.childNodes)
      .filter((n) => !(n instanceof Element && n.getAttribute('slot') === 'icon'))
      .map((n) => n.textContent ?? '')
      .join('')
      .trim();
  }

  private get accessibleRemoveLabel(): string {
    const text = this.labelText;
    return text ? `Remove ${text}` : 'Remove';
  }

  private onRemoveClick = (): void => {
    this.emit<ChipRemoveDetail>('lyra-remove', { value: this.value });
  };

  render(): TemplateResult {
    return html`
      <span part="base">
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

defineElement('chip', LyraChip);

declare global {
  interface HTMLElementTagNameMap {
    'lyra-chip': LyraChip;
  }
}
