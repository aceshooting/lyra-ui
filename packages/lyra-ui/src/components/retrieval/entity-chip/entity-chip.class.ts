import { html, nothing, type TemplateResult } from 'lit';
import { property, state, query } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { shouldIgnoreActivationKey } from '../../../internal/list-navigation.js';
import { isNonBlankIdentity } from '../retrieval-identity.js';
import { createPreviewDisclosure } from '../../../internal/preview-disclosure-controller.js';
import { nextId } from '../../../internal/a11y.js';
import { SlotPresenceController } from '../../../internal/slot-presence-controller.js';
import { styles } from './entity-chip.styles.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_entityChipWithType, LYRA_DEFAULT_untitledEntity } from '../../../internal/default-strings/retrieval.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END

export interface LyraEntityChipEventMap {
  /** Canonical name for the "user picked this entity" gesture. */
  'lr-entity-select': CustomEvent<{ entityId: string }>;
  'lr-entity-open': CustomEvent<{ entityId: string }>;
}

const HIDE_DELAY_MS = 200;

/**
 * `<lr-entity-chip>` — an inline `@entity` mention for agent prose: flow content,
 * keyboard-focusable, with a hover or keyboard-focus preview popover (the focused control matches
 * `:focus-visible` and no pointer press preceded it). The knowledge-graph sibling of
 * `lr-citation-badge`, reusing its interaction contract wholesale. Carries ids through events
 * only -- no entity data resolution, no navigation.
 *
 * An authored host `aria-label` names the custom-element boundary intentionally; it is not copied
 * onto the internal button. Because host naming does not cross the shadow boundary, the button
 * keeps its localized text/type name (and its localized untitled fallback) as its own name.
 *
 * @customElement lr-entity-chip
 * @slot - Rich preview content (typically a compact `lr-entity-card`), shown in a floating
 * popover on hover or keyboard focus. No content -> no popover and no hover affordance at all. An open
 * popover participates in shared Escape ordering even while only hovered, deferring to a
 * genuinely topmost overlay opened on top of it.
 * @event lr-entity-select - Click, or Enter while focused. `detail: { entityId }`.
 * @event lr-entity-open - Dblclick, or Space while focused. `detail: { entityId }`.
 * @csspart base - The clickable chip (`<button>`).
 * @csspart label - The chip's visible `text`.
 * @csspart popover - The floating preview panel.
 * @cssprop [--lr-entity-chip-color=var(--lr-color-brand)] - Text/accent color. Reflected `type`
 * lets a host theme per type from CSS, e.g. `lr-entity-chip[type='person'] { --lr-entity-chip-color: ... }`.
 * @cssprop [--lr-entity-chip-bg=var(--lr-color-brand-quiet)] - Background color.
 * @cssprop [--lr-entity-chip-border=transparent] - Border color of the chip.
 * @cssprop [--lr-overlay-surface=var(--lr-color-surface-container-high)] - Shared floating-surface fill,
 * on the anchored detail popover.
 * @cssprop [--lr-overlay-border=var(--lr-color-border-subtle)] - Shared floating-surface edge
 * colour, on the anchored detail popover.
 * @cssprop [--lr-overlay-radius=var(--lr-radius-container)] - Shared floating-surface corner radius, on the
 * anchored detail popover.
 * @cssprop [--lr-overlay-shadow-anchored=var(--lr-shadow-m)] - Elevation of the anchored surface.
 * @cssprop --lr-positioning-strategy - Cascading `absolute`/`fixed` override for the preview
 *   popover's `fixed` default, read from computed style when it is (re)positioned. Set it once on
 *   `:root`, a theme, or one clipping ancestor to change every unset entity chip beneath it; an
 *   unrecognized value falls back to `fixed`.
 * @status stable
 * @since 4.0.0
 */
export class LyraEntityChip extends LyraElement<LyraEntityChipEventMap> {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    entityChipWithType: LYRA_DEFAULT_entityChipWithType,
    untitledEntity: LYRA_DEFAULT_untitledEntity,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  static override styles = [LyraElement.styles, styles];

  /** Echoed verbatim in both events. Blank identities disable activation. */
  @property({ attribute: 'entity-id' }) entityId = '';
  /** The visible chip text (unlike citation-badge, the chip renders its own text, not `[n]`).
   *  Removing the attribute leaves null readback and uses the localized untitled accessible name. */
  @property() text = '';
  /** The entity's `lr-graph` `nodeTypes` id; reflected so hosts theme per type from CSS.
   *  A removed attribute is treated as an absent type without rewriting null readback. */
  @property({ reflect: true }) type = '';
  /** Resolved display label for `type`; when set, the accessible name speaks it instead of the raw
   *  type id. */
  @property({ attribute: 'type-label' }) typeLabel?: string;

  @state() private popoverOpen = false;

  @query('[part="base"]') private buttonEl?: HTMLButtonElement;
  @query('[part="popover"]') private popoverEl?: HTMLElement;

  private readonly popoverId = nextId('entity-chip-popover');
  private readonly slotPresence = new SlotPresenceController(this);
  private readonly preview = createPreviewDisclosure(this, {
    button: () => this.buttonEl,
    panel: () => this.popoverEl,
    hasContent: () => this.hasPreviewSlot,
    isOpen: () => this.popoverOpen,
    setOpen: (open) => { this.popoverOpen = open; },
    hideDelayMs: HIDE_DELAY_MS,
  });

  private get hasPreviewSlot(): boolean {
    return this.slotPresence.has();
  }

  private get accessibleLabel(): string {
    const label =
      (this.text ?? '').trim() === ''
        ? this.localize('untitledEntity')
        : this.text;
    const typeText = this.typeLabel?.trim() || (this.type ?? '').trim();
    if (!typeText) return label;
    return this.localize('entityChipWithType', undefined, {
      label,
      type: typeText,
    });
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    if (this.preview.handleEscape(e)) return;
    if (e.key === ' ' && !shouldIgnoreActivationKey(e) && e.target === this.buttonEl) {
      e.preventDefault();
      this.emitOpen();
    }
  };

  private onClick = (): void => {
    if (!isNonBlankIdentity(this.entityId)) return;
    this.emit('lr-entity-select', { entityId: this.entityId });
  };

  private onDblClick = (): void => {
    this.emitOpen();
  };

  private emitOpen(): void {
    if (!isNonBlankIdentity(this.entityId)) return;
    this.emit('lr-entity-open', { entityId: this.entityId });
  }

  override render(): TemplateResult {
    return html`
      <span
        class="wrapper"
        @pointerenter=${() => this.preview.pointerEnter()}
        @pointerleave=${() => this.preview.pointerLeave()}
        @focusin=${(event: FocusEvent) => this.preview.focusIn(event)}
        @focusout=${() => this.preview.focusOut()}
        @keydown=${this.onKeyDown}
      >
        <button
          part="base"
          type="button"
          ?disabled=${!isNonBlankIdentity(this.entityId)}
          aria-label=${this.accessibleLabel}
          aria-describedby=${this.hasPreviewSlot ? this.popoverId : nothing}
          @click=${this.onClick}
          @dblclick=${this.onDblClick}
        >
          <span part="label">${this.text}</span>
        </button>
        <div
          part="popover"
          id=${this.popoverId}
          role="tooltip"
          inert
          ?hidden=${!this.popoverOpen}
        >
          <slot></slot>
        </div>
      </span>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-entity-chip': LyraEntityChip;
  }
}
