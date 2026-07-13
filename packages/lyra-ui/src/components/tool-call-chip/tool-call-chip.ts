import { html, svg, nothing, type TemplateResult, type SVGTemplateResult, type PropertyValues } from 'lit';
import { property, state } from 'lit/decorators.js';
import { LyraElement } from '../../internal/lyra-element.js';
import { defineElement } from '../../internal/prefix.js';
import { place } from '../../internal/positioner.js';
import { nextId } from '../../internal/a11y.js';

import { styles } from './tool-call-chip.styles.js';

/** Same status vocabulary as `<lyra-tool-result-dialog>`, so a call's chip
 *  and its detail dialog always agree on icon/label/tone. */
export type ToolCallStatus = 'pending' | 'running' | 'success' | 'error' | 'denied';

export interface ToolChipSelectDetail {
  name: string;
  callId: string;
}

// Mirrors the shared icon set's viewBox/stroke conventions
// (internal/icons.ts's chevronIcon()/closeIcon()/etc.) without adding
// tool-call-specific glyphs to that module -- it's off limits here -- so
// these still read as part of the same visual language as the rest of the
// library's inline icons. Same approach lyra-checkbox's/lyra-chat-message's
// own local glyphs take for the identical reason, and deliberately the same
// shapes lyra-tool-result-dialog's own local glyphs use, so a call reads
// identically whether it's shown as this inline chip or in that dialog.
const ICON_VIEW_BOX = '0 0 24 24';
const ICON_STROKE_WIDTH = '1.75';

function icon(paths: SVGTemplateResult): SVGTemplateResult {
  return svg`
    <svg
      width="1em"
      height="1em"
      viewBox=${ICON_VIEW_BOX}
      fill="none"
      stroke="currentColor"
      stroke-width=${ICON_STROKE_WIDTH}
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      focusable="false"
    >${paths}</svg>
  `;
}

function pendingIcon(): SVGTemplateResult {
  return icon(svg`<circle cx="12" cy="12" r="9"></circle><polyline points="12 7 12 12 15 14"></polyline>`);
}

/** A three-quarter arc, spun by the `:host([status="running"]) [part="icon"] svg`
 *  CSS animation -- a full circle wouldn't visibly convey rotation. */
function runningIcon(): SVGTemplateResult {
  return icon(svg`<path d="M21 12a9 9 0 1 1-9-9"></path>`);
}

function successIcon(): SVGTemplateResult {
  return icon(svg`<circle cx="12" cy="12" r="9"></circle><polyline points="8 12.5 11 15.5 16 9.5"></polyline>`);
}

function errorIcon(): SVGTemplateResult {
  return icon(svg`
    <circle cx="12" cy="12" r="9"></circle>
    <line x1="9" y1="9" x2="15" y2="15"></line>
    <line x1="15" y1="9" x2="9" y2="15"></line>
  `);
}

/** A "blocked" glyph (circle + diagonal slash) -- distinct from `errorIcon()`
 *  since a denial is a policy rejection, not a runtime failure. */
function deniedIcon(): SVGTemplateResult {
  return icon(svg`<circle cx="12" cy="12" r="9"></circle><line x1="6" y1="18" x2="18" y2="6"></line>`);
}

const STATUS_ICON: Record<ToolCallStatus, () => SVGTemplateResult> = {
  pending: pendingIcon,
  running: runningIcon,
  success: successIcon,
  error: errorIcon,
  denied: deniedIcon,
};

/** Visible (not just color-coded) text for every status. */
const STATUS_LABEL: Record<ToolCallStatus, string> = {
  pending: 'Pending',
  running: 'Running',
  success: 'Success',
  error: 'Error',
  denied: 'Denied',
};

/** `820` -> `"820ms"`; `1500` -> `"1.5s"`; `2000` -> `"2s"`. Sub-second
 *  durations are the common case for a single tool call, so they get the
 *  more precise unit; once a call runs a full second or longer, trimming to
 *  (at most) one decimal place of seconds reads better than a 4-5 digit
 *  millisecond count. Identical algorithm to lyra-tool-result-dialog's own
 *  `formatDuration` -- duplicated rather than imported (these are two
 *  independent, separately-consumable components; see this file's header
 *  comment on the icon glyphs for the same rationale) but kept in lockstep
 *  so the same call reports the same duration text in both places. */
function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms < 1000) {
    return `${Math.round(Math.max(0, ms))}ms`;
  }
  const seconds = ms / 1000;
  const rounded = Math.round(seconds * 10) / 10;
  return `${Number.isInteger(rounded) ? rounded.toFixed(0) : rounded.toFixed(1)}s`;
}

/**
 * `<lyra-tool-call-chip>` — a compact inline pill representing one tool/
 * function call an agent made mid-conversation, e.g.
 * `web_search: Searching web…` with a `running` spinner. It owns no detail
 * surface of its own: clicking (or Enter/Space-activating) it only fires
 * `lyra-tool-chip-select` — a consumer wires that to opening a
 * `<lyra-tool-result-dialog>` (or anything else) at the call site. Keeping
 * the two decoupled means a chip can be reused wherever a compact call
 * summary is useful, with or without a detail surface behind it.
 *
 * The default slot is *not* the chip's visible content — the chip's own
 * label is always built from `name`/`summary`/`status`/`duration-ms`. It's
 * reserved for optional rich detail content (e.g. the tool's raw arguments,
 * a short preview) shown in a floating tooltip on hover/focus, positioned
 * with `internal/positioner.js`'s `place()` the same way `<lyra-combobox>`
 * positions its listbox. No tooltip is shown at all when the slot carries no
 * content — hovering an empty chip does nothing. Hover and keyboard focus are
 * tracked as independent reasons to keep the tooltip open (mirrors
 * `<lyra-citation-badge>`'s popover), so releasing one modality while the
 * other is still active doesn't close it, and the trigger button's
 * `aria-describedby` points at the tooltip's id whenever it's open and has
 * content, so the association reaches assistive tech too.
 *
 * The `icon` slot overrides the built-in per-status glyph entirely via the
 * platform's own slot-fallback-content mechanism (`<slot
 * name="icon">${fallback}</slot>` — the same pattern `<lyra-stat>`'s
 * `caption` slot and `<lyra-file-input>`'s default slot already use):
 * whatever is assigned to `slot="icon"` wins; otherwise the `icon` prop is
 * rendered as a literal hint (e.g. an emoji); otherwise the built-in glyph
 * for the current `status` is used.
 *
 * @customElement lyra-tool-call-chip
 * @slot - Rich tooltip/detail content, shown on hover/focus. Nothing renders
 * (no hover affordance at all) when this slot is empty.
 * @slot icon - Overrides the built-in status glyph entirely.
 * @event lyra-tool-chip-select - The chip was activated (click or Enter/Space
 * while focused). `detail: { name, callId }`.
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
 */
export class LyraToolCallChip extends LyraElement {
  static styles = [LyraElement.styles, styles];

  /** The tool/function name, e.g. `web_search`. */
  @property() name = '';

  /** Optional grouping label, e.g. `research`. */
  @property() category = '';

  /** The call's current lifecycle state — drives the glyph, color, and `status-text`. */
  @property({ reflect: true }) status: ToolCallStatus = 'pending';

  /** Short human-readable status text, e.g. `Searching web…`. */
  @property() summary = '';

  /** How long the call took, in milliseconds. Omitted from the chip entirely when unset. */
  @property({ type: Number, attribute: 'duration-ms' }) durationMs?: number;

  /** Literal icon hint (e.g. an emoji) used when the `icon` slot is empty — see the class doc's
   *  icon-precedence note. Ignored once anything is assigned to `slot="icon"`. */
  @property() icon = '';

  /** Unique identifier for this specific invocation — echoed back in `lyra-tool-chip-select`'s
   *  detail so a listener can correlate the click with the call it fired for. */
  @property({ attribute: 'call-id' }) callId = '';

  // Same fix lyra-stat's hasIcon/lyra-combobox's hasHintSlot etc. already
  // establish: a `[part]` always contains a literal `<slot>` child regardless
  // of assigned content, so `:empty` never matches -- real emptiness is
  // tracked in JS instead. Only element children count (mirrors lyra-stat's
  // identical default-slot check) since the tooltip's rich content is
  // expected to be markup, not a bare text node.
  @state() private hasDetailSlot = false;
  @state() private tooltipOpen = false;

  private readonly tooltipId = nextId('tool-call-chip-tooltip');
  private cleanupPositioner?: () => void;
  // Hover and focus are tracked as independent "keep it open" reasons --
  // mirrors lyra-citation-badge's identical hovering/focused pair for the
  // same hover/focus preview-popover pattern -- so releasing one (e.g. the
  // pointer leaving while the chip still has keyboard focus) doesn't close a
  // tooltip the other modality is still holding open.
  private hovering = false;
  private focused = false;

  protected willUpdate(): void {
    if (!this.hasUpdated) {
      this.hasDetailSlot = Array.from(this.children).some((el) => !el.hasAttribute('slot'));
    }
  }

  protected updated(changed: PropertyValues): void {
    if (changed.has('tooltipOpen')) {
      this.cleanupPositioner?.();
      this.cleanupPositioner = undefined;
      if (this.tooltipOpen) {
        const anchor = this.renderRoot.querySelector('[part="base"]') as HTMLElement | null;
        const tooltip = this.renderRoot.querySelector('[part="tooltip"]') as HTMLElement | null;
        if (anchor && tooltip) this.cleanupPositioner = place(anchor, tooltip, { placement: 'top-start' });
      }
    }
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.cleanupPositioner?.();
  }

  private onDetailSlotChange = (e: Event): void => {
    this.hasDetailSlot = (e.target as HTMLSlotElement).assignedElements({ flatten: true }).length > 0;
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
  // default slot is documented as read-only preview content (raw args, a
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

  private onFocus = (): void => {
    this.focused = true;
    this.showTooltip();
  };

  private onBlur = (): void => {
    this.focused = false;
    if (this.hovering) return;
    this.hideTooltip();
  };

  private onKeyDown = (e: KeyboardEvent): void => {
    // The native <button> already handles Enter/Space activation on its
    // own -- this only needs to cover dismissing the (non-native) tooltip,
    // the same Escape-to-close convention every other popup in this library
    // follows (see lyra-combobox's onKeyDown). Unconditional close (not
    // gated on hovering/focused) since Escape is a deliberate dismissal, not
    // transient pointer/focus travel.
    if (e.key === 'Escape' && this.tooltipOpen) {
      e.stopPropagation();
      this.hideTooltip();
    }
  };

  private onClick = (): void => {
    this.emit<ToolChipSelectDetail>('lyra-tool-chip-select', { name: this.name, callId: this.callId });
  };

  private get accessibleLabel(): string {
    const parts = [this.name || 'Tool call'];
    if (this.summary) parts.push(this.summary);
    parts.push(STATUS_LABEL[this.status]);
    if (this.durationMs != null && Number.isFinite(this.durationMs)) parts.push(formatDuration(this.durationMs));
    return parts.join(' — ');
  }

  render(): TemplateResult {
    const hasCategory = this.category.length > 0;
    const hasSummary = this.summary.length > 0;
    const hasDuration = this.durationMs != null && Number.isFinite(this.durationMs);

    return html`
      <button
        part="base"
        type="button"
        aria-label=${this.getAttribute('aria-label') || this.accessibleLabel}
        aria-describedby=${this.hasDetailSlot && this.tooltipOpen ? this.tooltipId : nothing}
        @click=${this.onClick}
        @mouseenter=${this.onMouseEnter}
        @mouseleave=${this.onMouseLeave}
        @focus=${this.onFocus}
        @blur=${this.onBlur}
        @keydown=${this.onKeyDown}
      >
        <span part="icon" aria-hidden="true">
          <slot name="icon">${this.icon ? this.icon : STATUS_ICON[this.status]()}</slot>
        </span>
        <span part="label">
          <span part="category" ?hidden=${!hasCategory}>${this.category}</span>
          <span part="name">${this.name || 'Tool call'}</span>
          <span part="summary" ?hidden=${!hasSummary}>${this.summary}</span>
        </span>
        <span part="meta">
          <span part="status-text">${STATUS_LABEL[this.status]}</span>
          <span part="duration" ?hidden=${!hasDuration}>${hasDuration ? formatDuration(this.durationMs!) : nothing}</span>
        </span>
      </button>
      <div part="tooltip" id=${this.tooltipId} role="tooltip" ?hidden=${!this.tooltipOpen}>
        <slot @slotchange=${this.onDetailSlotChange}></slot>
      </div>
    `;
  }
}

defineElement('tool-call-chip', LyraToolCallChip);

declare global {
  interface HTMLElementTagNameMap {
    'lyra-tool-call-chip': LyraToolCallChip;
  }
}
