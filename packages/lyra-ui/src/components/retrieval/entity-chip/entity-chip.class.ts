import { html, nothing, type TemplateResult, type PropertyValues } from 'lit';
import { property, state, query } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { isNonBlankIdentity } from '../retrieval-identity.js';
import { place } from '../../../internal/positioner.js';
import { nextId } from '../../../internal/a11y.js';
import { styles } from './entity-chip.styles.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_entityChipWithType, LYRA_DEFAULT_untitledEntity } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END

export interface LyraEntityChipEventMap {
  /** Canonical name for the "user picked this entity" gesture. */
  'lr-entity-select': CustomEvent<{ entityId: string }>;
  'lr-entity-open': CustomEvent<{ entityId: string }>;
}

const HIDE_DELAY_MS = 200;

/** A node counts as real preview content if it's an element not assigned to some other named
 *  slot, or non-whitespace text -- mirrors `lr-citation-badge`'s identical `isRealPreviewNode`. */
function isRealPreviewNode(n: Node): boolean {
  return n.nodeType === Node.ELEMENT_NODE
    ? !(n as Element).hasAttribute('slot')
    : (n.textContent ?? '').trim().length > 0;
}

/**
 * `<lr-entity-chip>` — an inline `@entity` mention for agent prose: flow content,
 * keyboard-focusable, with a hover/focus preview popover. The knowledge-graph sibling of
 * `lr-citation-badge`, reusing its interaction contract wholesale. Carries ids through events
 * only -- no entity data resolution, no navigation.
 *
 * An authored host `aria-label` names the custom-element boundary intentionally; it is not copied
 * onto the internal button. Because host naming does not cross the shadow boundary, the button
 * keeps its localized text/type name (and its localized untitled fallback) as its own name.
 *
 * @customElement lr-entity-chip
 * @slot - Rich preview content (typically a compact `lr-entity-card`), shown in a floating
 * popover on hover/focus. No content -> no popover and no hover affordance at all.
 * @event lr-entity-select - Click, or Enter while focused. `detail: { entityId }`.
 * @event lr-entity-open - Dblclick, or Space while focused. `detail: { entityId }`.
 * @csspart base - The clickable chip (`<button>`).
 * @csspart label - The chip's visible `text`.
 * @csspart popover - The floating preview panel.
 * @cssprop [--lr-entity-chip-color=var(--lr-color-brand)] - Text/accent color. Reflected `type`
 * lets a host theme per type from CSS, e.g. `lr-entity-chip[type='person'] { --lr-entity-chip-color: ... }`.
 * @cssprop [--lr-entity-chip-bg=var(--lr-color-brand-quiet)] - Background color.
 * @cssprop [--lr-entity-chip-border=transparent] - Border color of the chip.
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
  /** The visible chip text (unlike citation-badge, the chip renders its own text, not `[n]`). */
  @property() text = '';
  /** The entity's `lr-graph` `nodeTypes` id; reflected so hosts theme per type from CSS. */
  @property({ reflect: true }) type = '';
  /** Resolved display label for `type`; when set, the accessible name speaks it instead of the raw
   *  type id. */
  @property({ attribute: 'type-label' }) typeLabel?: string;

  @state() private hasPreviewSlot = false;
  @state() private popoverOpen = false;

  @query('[part="base"]') private buttonEl?: HTMLButtonElement;
  @query('[part="popover"]') private popoverEl?: HTMLElement;

  private readonly popoverId = nextId('entity-chip-popover');
  private cleanupPositioner?: () => void;
  private hideTimer?: ReturnType<typeof setTimeout>;
  private hovering = false;
  private focused = false;

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed);
    if (!this.hasUpdated) {
      this.hasPreviewSlot = Array.from(this.childNodes).some(isRealPreviewNode);
    }
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    if (changed.has('popoverOpen')) {
      this.cleanupPositioner?.();
      this.cleanupPositioner = undefined;
      if (this.popoverOpen && this.buttonEl && this.popoverEl) {
        this.cleanupPositioner = place(this.buttonEl, this.popoverEl, {
          placement: 'top-start',
        });
      }
    }
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.cleanupPositioner?.();
    this.cleanupPositioner = undefined;
    clearTimeout(this.hideTimer);
    this.hideTimer = undefined;
    // Reset so a reconnect (e.g. a drag-drop reparent, or a virtualized/reordering
    // message list moving this element) re-triggers updated()'s open-driven branch --
    // without this, popoverOpen stays true across the disconnect/reconnect and
    // changed.has('popoverOpen') never fires again, leaving the popover rendered open
    // with a torn-down positioner and no live position/dismissal.
    this.popoverOpen = false;
    this.hovering = false;
    this.focused = false;
  }

  private get accessibleLabel(): string {
    const label =
      this.text.trim() === ''
        ? this.localize('untitledEntity')
        : this.text;
    const typeText = this.typeLabel?.trim() || this.type.trim();
    if (!typeText) return label;
    return this.localize('entityChipWithType', undefined, {
      label,
      type: typeText,
    });
  }

  private onSlotChange = (e: Event): void => {
    this.hasPreviewSlot = (e.target as HTMLSlotElement)
      .assignedNodes({ flatten: true })
      .some(isRealPreviewNode);
    if (!this.hasPreviewSlot) this.hidePreviewNow();
  };

  private showPreview(): void {
    if (!this.hasPreviewSlot) return;
    clearTimeout(this.hideTimer);
    this.hideTimer = undefined;
    if (this.popoverOpen) return;
    this.popoverOpen = true;
  }

  private scheduleHidePreview(): void {
    if (!this.popoverOpen || this.hovering || this.focused) return;
    clearTimeout(this.hideTimer);
    this.hideTimer = setTimeout(() => {
      this.hideTimer = undefined;
      this.popoverOpen = false;
    }, HIDE_DELAY_MS);
  }

  private hidePreviewNow(): void {
    clearTimeout(this.hideTimer);
    this.hideTimer = undefined;
    if (this.popoverOpen) this.popoverOpen = false;
  }

  private onPointerEnter = (): void => {
    this.hovering = true;
    this.showPreview();
  };
  private onPointerLeave = (): void => {
    this.hovering = false;
    this.scheduleHidePreview();
  };
  private onFocusIn = (): void => {
    this.focused = true;
    this.showPreview();
  };
  private onFocusOut = (): void => {
    this.focused = false;
    if (this.hovering) return;
    this.hidePreviewNow();
  };

  private onKeyDown = (e: KeyboardEvent): void => {
    if (e.key === 'Escape' && this.popoverOpen) {
      e.stopPropagation();
      this.hidePreviewNow();
      return;
    }
    if (e.key === ' ' && !e.repeat && e.target === this.buttonEl) {
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
        @pointerenter=${this.onPointerEnter}
        @pointerleave=${this.onPointerLeave}
        @focusin=${this.onFocusIn}
        @focusout=${this.onFocusOut}
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
          <slot @slotchange=${this.onSlotChange}></slot>
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
