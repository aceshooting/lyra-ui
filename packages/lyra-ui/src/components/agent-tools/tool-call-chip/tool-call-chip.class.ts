import {
  html,
  nothing,
  type ComplexAttributeConverter,
  type TemplateResult,
  type PropertyValues,
} from 'lit';
import { property, query, state } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { isKeyboardFocusEvent } from '../../../internal/focus-modality.js';
import type { LyraToolStatus } from '../../../internal/shared-unions.js';
import { deferredPlace as place } from '../../../internal/anchored-overlay-runtime.js';
import { activateNonmodalOverlay, type OverlayHandle } from '../../../internal/nonmodal-overlay-manager.js';
import { resolveEffectivePositioningStrategy } from '../../../internal/positioning-strategy.js';
import { nextId } from '../../../internal/a11y.js';
import { acquireResolvedAriaRelationship, type ResolvedAriaRelationshipLease } from '../../../internal/aria-controls.js';
import { finiteRange } from '../../../internal/numbers.js';
import { getNumberFormat } from '../../../internal/intl-cache.js';
import { durationMessageValue } from '../../../internal/duration.js';

import { TOOL_STATUS_LABEL_KEY, isToolCallStatus, toolStatusIcon } from '../tool-status.js';
import { styles } from './tool-call-chip.styles.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_accessibleLabelSeparator, LYRA_DEFAULT_collapse, LYRA_DEFAULT_details, LYRA_DEFAULT_durationMilliseconds, LYRA_DEFAULT_durationSeconds, LYRA_DEFAULT_map, LYRA_DEFAULT_navigation, LYRA_DEFAULT_open, LYRA_DEFAULT_popover, LYRA_DEFAULT_search, LYRA_DEFAULT_select, LYRA_DEFAULT_statusDenied, LYRA_DEFAULT_statusError, LYRA_DEFAULT_statusPending, LYRA_DEFAULT_statusRunning, LYRA_DEFAULT_statusSuccess, LYRA_DEFAULT_toolCall } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END

/** Same status vocabulary as `<lr-tool-result-dialog>`, so a call's chip
 *  and its detail dialog always agree on icon/label/tone. */
export type ToolCallStatus = LyraToolStatus;

export interface ToolChipSelectDetail {
  name: string;
  callId: string;
}

export interface LyraToolCallChipEventMap {
  'lr-tool-call-chip-select': CustomEvent<ToolChipSelectDetail>;
}

// The status glyphs and label keys are shared with `<lr-tool-result-dialog>`,
// `<lr-tool-timeline>` and `<lr-tool-call-block>` (../tool-status.ts), so a
// call reads identically wherever it is shown.
const STATUS_ICON = toolStatusIcon;

const statusConverter: ComplexAttributeConverter<ToolCallStatus> = {
  fromAttribute(value): ToolCallStatus {
    return value !== null && isToolCallStatus(value)
      ? (value as ToolCallStatus)
      : 'pending';
  },
  toAttribute(value): string {
    return value;
  },
};

/**
 * `<lr-tool-call-chip>` — a compact inline pill representing one tool/
 * function call an agent made mid-conversation, e.g.
 * `web_search: Searching web…` with a `running` spinner. It owns no detail
 * surface of its own: clicking (or Enter/Space-activating) it only fires
 * `lr-tool-call-chip-select` — a consumer wires that to opening a
 * `<lr-tool-result-dialog>` (or anything else) at the call site. Keeping
 * the two decoupled means a chip can be reused wherever a compact call
 * summary is useful, with or without a detail surface behind it.
 *
 * The default slot is *not* the chip's visible content — the chip's own
 * label is always built from `name`/`summary`/`status`/`duration-ms`. It's
 * reserved for optional read-only preview content (e.g. the tool's raw
 * arguments or a short formatted summary) shown in a floating tooltip on hover or keyboard focus
 * (the focused control matches `:focus-visible` and no pointer press preceded it), positioned
 * with `internal/positioner.js`'s `place()` the same way `<lr-combobox>`
 * positions its listbox. No tooltip is shown at all when the slot carries no
 * content — hovering an empty chip does nothing. Hover and keyboard focus are
 * tracked as independent reasons to keep the tooltip open (mirrors
 * `<lr-citation-badge>`'s popover), so releasing one modality while the
 * other is still active doesn't close it, and the trigger button's
 * `aria-describedby` points at the tooltip's id whenever it's open or focused (focus of any
 * kind describes the chip) and has content, so the association reaches assistive tech too; a host-authored `aria-describedby` is
 * projected onto the same button and merged with that id, since idrefs never cross the shadow
 * boundary on their own. The tooltip is an
 * explicitly noninteractive preview: its flattened subtree is inert, so a
 * consumer must put actions in the detail surface opened from
 * `lr-tool-call-chip-select`, not links or controls in this description slot.
 *
 * The `icon` slot overrides the built-in per-status glyph entirely via the
 * platform's own slot-fallback-content mechanism (`<slot
 * name="icon">${fallback}</slot>` — the same pattern `<lr-stat>`'s
 * `caption` slot and `<lr-file-input>`'s default slot already use):
 * whatever is assigned to `slot="icon"` wins; otherwise the `icon` prop is
 * rendered as a literal hint (e.g. an emoji); otherwise the built-in glyph
 * for the current `status` is used.
 *
 * @customElement lr-tool-call-chip
 * @slot - Noninteractive tooltip preview text or formatting, shown on hover or keyboard focus. Interactive
 * descendants are inert; put actions in the detail surface opened from
 * `lr-tool-call-chip-select`. Nothing renders when this slot is empty. An open tooltip
 * participates in shared Escape ordering even while only hovered, deferring to a genuinely
 * topmost overlay opened on top of it.
 * @slot icon - Overrides the built-in status glyph entirely.
 * @event lr-tool-call-chip-select - The chip was activated (click or
 * Enter/Space while focused). `detail: { name, callId }`. The `lr-tool-chip-select`
 * alias this event replaced was removed in 9.0.0.
 * @csspart base - The clickable pill (`<button>`).
 * @csspart icon - Wrapper around the status glyph / `icon` slot.
 * @csspart label - Wrapper around `category`, `name` and `summary`.
 * @csspart category - The optional grouping label.
 * @csspart name - The tool/function name.
 * @csspart summary - The short status text.
 * @csspart meta - Wrapper around `status-text` and `duration`.
 * @csspart status-text - The visible text twin of the status glyph/color — carries the state in text, not just color.
 * @csspart duration - The formatted `duration-ms`, when set.
 * @csspart tooltip - The floating detail popup (only meaningful while open).
 * @cssprop [--lr-tool-call-chip-spin=var(--lr-transition-ambient)] - Running-icon animation
 *   duration and timing.
 * @cssprop [--lr-transition-ambient=1.8s ease-in-out] - Pending-icon pulse duration and timing.
 * @cssprop [--lr-tool-call-chip-accent=var(--lr-color-text-quiet)] - Accent color for the status
 * glyph and text. Its private default follows `status` (`running` → brand, `success` → success,
 * `error` → danger, `denied` → warning); an inherited or direct public override always wins.
 * @cssprop [--lr-tool-call-chip-bg=var(--lr-color-surface)] - Chip background. Its private default
 * follows the same `status` rules using each status's `-quiet` tint; a public override wins.
 * @cssprop [--lr-tool-call-chip-border=var(--lr-color-border)] - Chip border color. Its private
 * default becomes transparent for every non-`pending` status; a public override wins.
 * @cssprop [--lr-overlay-surface=var(--lr-color-surface-overlay)] - Shared floating-surface fill,
 * on the anchored detail tooltip.
 * @cssprop [--lr-overlay-border=var(--lr-color-border-subtle)] - Shared floating-surface edge
 * colour, on the anchored detail tooltip.
 * @cssprop [--lr-overlay-radius=var(--lr-radius)] - Shared floating-surface corner radius, on the
 * anchored detail tooltip.
 * @cssprop [--lr-overlay-shadow-anchored=var(--lr-shadow-m)] - Elevation of the anchored surface.
 * @cssprop --lr-positioning-strategy - Cascading `absolute`/`fixed` override for the detail
 *   tooltip's `fixed` default, read from computed style when it is (re)positioned. Set it once on
 *   `:root`, a theme, or one clipping ancestor to change every unset tool call chip beneath it; an
 *   unrecognized value falls back to `fixed`.
 * @status stable
 * @since 4.0.0
 */
export class LyraToolCallChip extends LyraElement<LyraToolCallChipEventMap> {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    accessibleLabelSeparator: LYRA_DEFAULT_accessibleLabelSeparator,
    collapse: LYRA_DEFAULT_collapse,
    details: LYRA_DEFAULT_details,
    durationMilliseconds: LYRA_DEFAULT_durationMilliseconds,
    durationSeconds: LYRA_DEFAULT_durationSeconds,
    map: LYRA_DEFAULT_map,
    navigation: LYRA_DEFAULT_navigation,
    open: LYRA_DEFAULT_open,
    popover: LYRA_DEFAULT_popover,
    search: LYRA_DEFAULT_search,
    select: LYRA_DEFAULT_select,
    statusDenied: LYRA_DEFAULT_statusDenied,
    statusError: LYRA_DEFAULT_statusError,
    statusPending: LYRA_DEFAULT_statusPending,
    statusRunning: LYRA_DEFAULT_statusRunning,
    statusSuccess: LYRA_DEFAULT_statusSuccess,
    toolCall: LYRA_DEFAULT_toolCall,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  static override styles = [LyraElement.styles, styles];

  /** The tool/function name, e.g. `web_search`. */
  @property() name = '';

  /** Optional grouping label, e.g. `research`. Removing the attribute clears its displayed text. */
  @property() category = '';

  /**
   * The call's current lifecycle state — drives the glyph, color, and
   * `status-text`. Invalid runtime values use the pending presentation.
   */
  @property({ reflect: true, converter: statusConverter })
  status: ToolCallStatus = 'pending';

  /** Short human-readable status text, e.g. `Searching web…`. Removing the attribute clears its displayed text. */
  @property() summary = '';

  /** How long the call took, in milliseconds. Omitted from the chip entirely when unset. */
  @property({ type: Number, attribute: 'duration-ms' }) durationMs?: number;

  /** Literal icon hint (e.g. an emoji) used when the `icon` slot is empty — see the class doc's
   *  icon-precedence note. Ignored once anything is assigned to `slot="icon"`. */
  @property() icon = '';

  /** Unique identifier for this specific invocation — echoed back in `lr-tool-call-chip-select`'s
   *  detail so a listener can correlate the click with the call it fired for. */
  @property({ attribute: 'call-id' }) callId = '';

  // Same fix lr-stat's hasIcon/lr-combobox's hasHintSlot etc. already
  // establish: a `[part]` always contains a literal `<slot>` child regardless
  // of assigned content, so `:empty` never matches -- real emptiness is
  // tracked in JS instead. Text nodes count too: this slot's primary contract
  // is a noninteractive textual description, and requiring a wrapper element
  // merely to make a bare preview visible would contradict that contract.
  @state() private hasDetailSlot = false;
  @state() private tooltipOpen = false;

  private readonly tooltipId = nextId('tool-call-chip-tooltip');
  /** Projects a host `aria-describedby` onto the internal `[part="base"]` role owner, merged with
   *  whatever that element's own `aria-describedby` (the open tooltip's id, or nothing) currently
   *  is -- IDREFs are scoped per shadow root, so the host's own attribute cannot reach across the
   *  boundary on its own, and re-deriving the baseline on every update (rather than a one-shot
   *  merge) keeps the tooltip id included as `tooltipOpen` toggles. Mirrors
   *  `graph-query-builder.class.ts`'s identically-shaped `externalDescriptionLease`. */
  private externalDescriptionLease?: ResolvedAriaRelationshipLease;
  private cleanupPositioner?: () => void;
  private tooltipOverlay?: OverlayHandle;
  // Hover and focus are tracked as independent "keep it open" reasons --
  // mirrors lr-citation-badge's identical hovering/focused pair for the
  // same hover/focus preview-popover pattern -- so releasing one (e.g. the
  // pointer leaving while the chip still has keyboard focus) doesn't close a
  // tooltip the other modality is still holding open.
  private hovering = false;
  private focused = false;
  /** Any focus on the trigger describes it, whether or not keyboard focus opened the tooltip. */
  @state() private focusDescribed = false;

  private hasPreviewNodes(nodes: readonly Node[]): boolean {
    return nodes.some((node) => {
      if (node.nodeType === 3) return Boolean(node.textContent?.trim());
      if (node.nodeType !== 1) return false;
      const slotName = (node as Element).getAttribute('slot');
      return slotName === null || slotName === '';
    });
  }

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed);
    if (!this.hasUpdated) {
      this.hasDetailSlot = this.hasPreviewNodes(Array.from(this.childNodes));
    }
  }

  override connectedCallback(): void {
    super.connectedCallback();
    if (this.hasUpdated) this.syncExternalDescription();
  }

  private syncExternalDescription(): void {
    const target = this.isConnected ? (this.baseEl ?? null) : null;
    if (!target) {
      this.releaseExternalDescription();
      return;
    }
    if (this.externalDescriptionLease) this.externalDescriptionLease.update(target);
    else this.externalDescriptionLease = acquireResolvedAriaRelationship(this, target, 'aria-describedby');
  }

  private releaseExternalDescription(): void {
    this.externalDescriptionLease?.release();
    this.externalDescriptionLease = undefined;
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    this.syncExternalDescription();
    if (changed.has('tooltipOpen')) {
      this.cleanupPositioner?.();
      this.cleanupPositioner = undefined;
      this.tooltipOverlay?.deactivate({ restoreFocus: false });
      this.tooltipOverlay = undefined;
      if (this.tooltipOpen) {
        const anchor = this.renderRoot.querySelector(
          '[part="base"]'
        ) as HTMLElement | null;
        const tooltip = this.renderRoot.querySelector(
          '[part="tooltip"]'
        ) as HTMLElement | null;
        if (anchor && tooltip) {
          this.cleanupPositioner = place(anchor, tooltip, {
            placement: 'top-start',
            strategy: resolveEffectivePositioningStrategy(this, undefined, 'fixed'),
          });
          // Registers with the shared topmost-overlay stack (internal/overlay-manager.ts) so
          // Escape defers to a genuinely topmost overlay opened above this tooltip, instead of
          // this preview always winning regardless of stacking order -- mirrors
          // <lr-tooltip>'s activateTooltipOverlay() and <lr-usage-badge>'s
          // activateUsageBadgeOverlay(), which reuses this same tooltip contract wholesale.
          // Nonmodal/non-trapping: this tooltip is always `inert` and never owns focus of its
          // own.
          this.tooltipOverlay = activateNonmodalOverlay({
            host: this,
            panel: () => tooltip,
            onEscape: () => this.hideTooltip(),
            restoreFocusTo: null,
          });
        }
      }
    }
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.releaseExternalDescription();
    this.cleanupPositioner?.();
    this.cleanupPositioner = undefined;
    this.tooltipOverlay?.deactivate({ restoreFocus: false });
    this.tooltipOverlay = undefined;
    // Reset so a reconnect (e.g. a drag-drop reparent or a list re-render
    // that detaches and reattaches this node) re-triggers `updated()`'s
    // `tooltipOpen`-driven branch -- without this, `tooltipOpen` stays
    // `true` across the disconnect/reconnect and `changed.has('tooltipOpen')`
    // never fires again, leaving the tooltip rendered open at a stale,
    // frozen position with no live positioner attached.
    this.tooltipOpen = false;
    this.hovering = false;
    this.focused = false;
    this.focusDescribed = false;
  }

  private onDetailSlotChange = (e: Event): void => {
    this.hasDetailSlot = this.hasPreviewNodes(
      (e.target as HTMLSlotElement).assignedNodes({ flatten: true })
    );
    // The slot can be emptied out from under an already-open tooltip (e.g. a
    // consumer clearing streamed/async preview content) -- nothing left to
    // show, so don't leave an empty tooltip floating open regardless of
    // whether hover/focus is still active.
    if (!this.hasDetailSlot) this.hideTooltip();
  };

  private showTooltip(): void {
    if (!this.hasDetailSlot || this.tooltipOpen) return;
    this.tooltipOpen = true;
  }

  // Called both as the actual (unconditional) close -- from onDetailSlotChange
  // and the Escape handler below, where the tooltip must close regardless of
  // hover/focus state -- and from onMouseLeave/onBlur once each has already
  // confirmed the *other* modality isn't still holding the tooltip open. The
  // default slot is enforced as an inert, read-only preview (raw args, a
  // short snippet), not an interactive surface meant to retain focus/hover of
  // its own, so there's no "did the pointer move into the tooltip itself"
  // check needed beyond the hovering/focused pair.
  private hideTooltip(): void {
    if (!this.tooltipOpen) return;
    this.tooltipOpen = false;
  }

  private onMouseEnter = (): void => {
    this.hovering = true;
    this.showTooltip();
  };

  private onMouseLeave = (): void => {
    this.hovering = false;
    if (this.focused) return;
    this.hideTooltip();
  };

  private onFocus = (event: FocusEvent): void => {
    this.focusDescribed = true;
    if (!isKeyboardFocusEvent(event)) return;
    this.focused = true;
    this.showTooltip();
  };

  private onBlur = (): void => {
    this.focused = false;
    this.focusDescribed = false;
    if (this.hovering) return;
    this.hideTooltip();
  };

  private onKeyDown = (e: KeyboardEvent): void => {
    // The native <button> already handles Enter/Space activation on its
    // own -- this only needs to cover dismissing the (non-native) tooltip,
    // the same Escape-to-close convention every other popup in this library
    // follows (see lr-combobox's onKeyDown). Not gated on hovering/focused
    // (Escape is a deliberate dismissal, not transient pointer/focus
    // travel), but gated on tooltipOverlay.isTopmost() so a genuinely
    // topmost overlay stacked above this tooltip gets the keypress instead
    // -- the shared document-level listener still routes it there when this
    // branch defers.
    if (e.key === 'Escape' && this.tooltipOpen && this.tooltipOverlay?.isTopmost()) {
      e.stopPropagation();
      this.hideTooltip();
    }
  };

  private onClick = (): void => {
    this.emit('lr-tool-call-chip-select', {
      name: this.name,
      callId: this.callId,
    });
  };

  @query('[part="base"]') private baseEl?: HTMLButtonElement;

  /** Moves focus to the currently rendered chip button. */
  override focus(options?: FocusOptions): void {
    this.baseEl?.focus(options);
  }

  /** Removes focus from the currently rendered chip button. */
  override blur(): void {
    this.baseEl?.blur();
  }

  /** Forwards host activation to the internal base button, mirroring `<lr-button>`'s `click()`
   *  override. */
  override click(): void {
    this.baseEl?.click();
  }

  private get effectiveStatus(): ToolCallStatus {
    return isToolCallStatus(this.status) ? this.status : 'pending';
  }

  /** `durationMs` normalized to a finite, non-negative value, or `null` -- `null`/`undefined`
   *  and a non-finite raw value (e.g. a stray `NaN` assignment) both mean "no duration to show,"
   *  matching this property's own "omitted from the chip entirely when unset" contract, rather
   *  than rendering a literal "NaN ms". A finite negative value clamps to `0` instead of
   *  rendering a nonsensical negative duration. */
  private get safeDurationMs(): number | null {
    return this.durationMs != null && Number.isFinite(this.durationMs)
      ? finiteRange(this.durationMs, 0, 0)
      : null;
  }

  private get accessibleLabel(): string {
    const parts = [this.name || this.localize('toolCall')];
    if (this.summary) parts.push(this.summary);
    parts.push(this.localize(TOOL_STATUS_LABEL_KEY[this.effectiveStatus]));
    const durationMs = this.safeDurationMs;
    if (durationMs != null) {
      parts.push(this.localizedDuration(durationMs));
    }
    return parts.join(this.localize('accessibleLabelSeparator'));
  }

  private localizedDuration(ms: number): string {
    const duration = durationMessageValue(ms);
    return this.localize(duration.key, undefined, {
      value: getNumberFormat(this.effectiveLocale, {
        maximumFractionDigits: duration.key === 'durationSeconds' ? 1 : 0,
      }).format(duration.value),
    });
  }

  override render(): TemplateResult {
    const hasCategory = (this.category ?? '').length > 0;
    const hasSummary = (this.summary ?? '').length > 0;
    const durationMs = this.safeDurationMs;
    const hasDuration = durationMs != null;
    const status = this.effectiveStatus;

    return html`
      <button
        part="base"
        type="button"
        aria-label=${this.accessibleLabel}
        aria-describedby=${this.hasDetailSlot && (this.tooltipOpen || this.focusDescribed)
          ? this.tooltipId
          : nothing}
        @click=${this.onClick}
        @mouseenter=${this.onMouseEnter}
        @mouseleave=${this.onMouseLeave}
        @focus=${this.onFocus}
        @blur=${this.onBlur}
        @keydown=${this.onKeyDown}
      >
        <span part="icon" aria-hidden="true" inert>
          <slot name="icon"
            >${this.icon ? this.icon : STATUS_ICON(status)}</slot
          >
        </span>
        <span part="label">
          <span part="category" ?hidden=${!hasCategory}>${this.category}</span>
          <span part="name">${this.name || this.localize('toolCall')}</span>
          <span part="summary" ?hidden=${!hasSummary}>${this.summary}</span>
        </span>
        <span part="meta">
          <span part="status-text"
            >${this.localize(TOOL_STATUS_LABEL_KEY[status])}</span
          >
          <span part="duration" ?hidden=${!hasDuration}
            >${durationMs != null
              ? this.localizedDuration(durationMs)
              : nothing}</span
          >
        </span>
      </button>
      <div
        part="tooltip"
        id=${this.tooltipId}
        role="tooltip"
        inert
        ?hidden=${!this.tooltipOpen}
      >
        <slot @slotchange=${this.onDetailSlotChange}></slot>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-tool-call-chip': LyraToolCallChip;
  }
}
