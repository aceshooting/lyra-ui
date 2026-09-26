import { html, nothing, type TemplateResult, type PropertyValues } from 'lit';
import { property, state, query } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { isKeyboardFocusEvent } from '../../../internal/focus-modality.js';
import { isNonBlankIdentity } from '../retrieval-identity.js';
import { deferredPlace as place } from '../../../internal/anchored-overlay-runtime.js';
import { activateNonmodalOverlay, type OverlayHandle } from '../../../internal/nonmodal-overlay-manager.js';
import { resolveEffectivePositioningStrategy } from '../../../internal/positioning-strategy.js';
import { nextId } from '../../../internal/a11y.js';
import { SlotPresenceController } from '../../../internal/slot-presence-controller.js';
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
 * @cssprop [--lr-overlay-surface=var(--lr-color-surface-overlay)] - Shared floating-surface fill,
 * on the anchored detail popover.
 * @cssprop [--lr-overlay-border=var(--lr-color-border-subtle)] - Shared floating-surface edge
 * colour, on the anchored detail popover.
 * @cssprop [--lr-overlay-radius=var(--lr-radius)] - Shared floating-surface corner radius, on the
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
  /** The default slot's preview content is often bare text (no wrapping element at all), so an
   *  element-only check never counts it, and a `[part]` always contains a literal `<slot>` child
   *  regardless of assignment, so `:empty` never matches either. The shared controller answers the
   *  same "does this slot carry real consumer content" question every other presence-driven
   *  component asks, seeded before the first render and kept live afterwards. */
  private readonly slotPresence = new SlotPresenceController(this);
  private cleanupPositioner?: () => void;
  private overlayHandle?: OverlayHandle;
  private hideTimer?: number;
  private hideTimerOwner?: Window;
  private hovering = false;
  private focused = false;

  private get hasPreviewSlot(): boolean {
    return this.slotPresence.has();
  }

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed);
    // The slot can be emptied out from under an already-open popover (e.g. a consumer clearing
    // preview content asynchronously) -- nothing left to show, so don't leave an empty panel
    // floating open.
    if (this.popoverOpen && !this.hasPreviewSlot) this.hidePreviewNow();
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    if (changed.has('popoverOpen')) {
      this.cleanupPositioner?.();
      this.cleanupPositioner = undefined;
      this.overlayHandle?.deactivate({ restoreFocus: false });
      this.overlayHandle = undefined;
      if (this.popoverOpen && this.buttonEl && this.popoverEl) {
        this.cleanupPositioner = place(this.buttonEl, this.popoverEl, {
          placement: 'top-start',
          strategy: resolveEffectivePositioningStrategy(this, undefined, 'fixed'),
        });
        // Registers with the shared topmost-overlay stack (internal/overlay-manager.ts) so
        // Escape defers to a genuinely topmost overlay opened above this popover, instead of
        // this preview always winning regardless of stacking order -- mirrors
        // <lr-tooltip>'s activateTooltipOverlay(). Nonmodal/non-trapping: this popover is
        // always `inert` and never owns focus of its own.
        this.overlayHandle = activateNonmodalOverlay({
          host: this,
          panel: () => this.popoverEl ?? null,
          onEscape: () => this.hidePreviewNow(),
          restoreFocusTo: null,
        });
      }
    }
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.cleanupPositioner?.();
    this.cleanupPositioner = undefined;
    this.overlayHandle?.deactivate({ restoreFocus: false });
    this.overlayHandle = undefined;
    this.clearHideTimer();
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

  private showPreview(): void {
    if (!this.hasPreviewSlot) return;
    this.clearHideTimer();
    if (this.popoverOpen) return;
    this.popoverOpen = true;
  }

  private clearHideTimer(): void {
    if (this.hideTimer !== undefined) this.hideTimerOwner?.clearTimeout(this.hideTimer);
    this.hideTimer = undefined;
    this.hideTimerOwner = undefined;
  }

  private scheduleHidePreview(): void {
    if (!this.popoverOpen || this.hovering || this.focused) return;
    this.clearHideTimer();
    const ownerWindow = this.ownerDocument.defaultView;
    if (!ownerWindow) return;
    const handle = ownerWindow.setTimeout(() => {
      if (this.hideTimer !== handle) return;
      this.hideTimer = undefined;
      this.hideTimerOwner = undefined;
      this.popoverOpen = false;
    }, HIDE_DELAY_MS);
    this.hideTimer = handle;
    this.hideTimerOwner = ownerWindow;
  }

  private hidePreviewNow(): void {
    this.clearHideTimer();
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
  private onFocusIn = (event: FocusEvent): void => {
    if (!isKeyboardFocusEvent(event)) return;
    this.focused = true;
    this.showPreview();
  };
  private onFocusOut = (): void => {
    this.focused = false;
    if (this.hovering) return;
    this.hidePreviewNow();
  };

  private onKeyDown = (e: KeyboardEvent): void => {
    if (e.key === 'Escape' && this.popoverOpen && this.overlayHandle?.isTopmost()) {
      // Swallow it here rather than letting it bubble to e.g. a containing lr-dialog's own
      // Escape-to-close handler. Gated on isTopmost() so a genuinely topmost overlay stacked
      // above this one gets the keypress instead (the shared document-level listener still
      // routes it there when this branch defers).
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
