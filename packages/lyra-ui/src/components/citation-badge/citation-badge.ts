import { html, nothing, type TemplateResult, type PropertyValues } from 'lit';
import { property, state, query } from 'lit/decorators.js';
import { LyraElement } from '../../internal/lyra-element.js';
import { defineElement } from '../../internal/prefix.js';
import { place } from '../../internal/positioner.js';
import { nextId } from '../../internal/a11y.js';
import { styles } from './citation-badge.styles.js';

export type CitationBadgeStatus = 'default' | 'high' | 'medium' | 'low' | 'verified' | 'unverified';

export interface CitationActivateDetail {
  sourceId: string;
  index: number;
}

export interface CitationOpenDetail {
  sourceId: string;
  index: number;
  href?: string;
}

/** Visible (not just color-coded) status word, folded into the computed
 *  accessible name — `''` for `default` omits the status clause entirely
 *  rather than announcing a meaningless "Citation 3, Default". */
const STATUS_LABEL: Record<CitationBadgeStatus, string> = {
  default: '',
  high: 'High confidence',
  medium: 'Medium confidence',
  low: 'Low confidence',
  verified: 'Verified',
  unverified: 'Unverified',
};

// A short grace period before the popover actually hides on pointer-leave/
// focus-out, so moving the mouse from the badge into the popover itself (to
// select/copy its text) doesn't make it vanish mid-move. Cancelled outright
// if hover or focus returns before it fires. No delay on Escape or explicit
// keyboard blur — those are intentional dismissals, not transient pointer
// travel, so they close immediately.
const HIDE_DELAY_MS = 200;

/**
 * `<lyra-citation-badge>` — an inline `[n]` citation marker with a hover/
 * focus preview popover and confidence/verification-status coloring. Used
 * for an agent response's inline citations, each carrying a `source-id`
 * that matches a corresponding `<lyra-source-card>` shown elsewhere on the
 * page (a sibling component in this same family — this component doesn't
 * import or know anything about it, only carries the id through its
 * events).
 *
 * The default slot is *not* the badge's visible content — the badge always
 * renders `[index]` — it's reserved for optional rich preview content (e.g.
 * a filename + short excerpt) shown in a floating popover on hover/focus,
 * positioned with `internal/positioner.js`'s `place()` the same way
 * `<lyra-tool-call-chip>` positions its own detail tooltip. No popover shows
 * at all when the slot carries no content, and the popover never traps
 * focus — it's supplementary preview content, not a modal, so Tab continues
 * past the badge normally even while it happens to be visible from a mouse
 * hover.
 *
 * Two distinct signals fire from the same badge: `lyra-citation-activate`
 * (click, or Enter while focused — native `<button>` behavior, no listener
 * needed for the Enter case) is the lightweight "jump to this source"
 * signal a host wires to scrolling/highlighting the matching
 * `<lyra-source-card>`. `lyra-citation-open` (dblclick, or Space while
 * focused) is a distinct "full preview" signal — `href` in its detail is
 * `undefined` when the `href` prop isn't set; the consumer decides what
 * "open" means (a new tab, a dialog, etc). A double-click still fires two
 * `lyra-citation-activate` events (one per constituent click — standard
 * browser `dblclick` behavior) in addition to the one `lyra-citation-open`;
 * a consumer that only cares about the richer signal on a double-click
 * should ignore the paired activate events in that case.
 *
 * Status coloring: `verified`/`high` use the success tones (a claim that's
 * been checked out, or the model is confident in). `medium`/`low` use
 * warning (progressively less certain, but still a real citation).
 * `unverified` uses danger — deliberately distinct from `low`: "hasn't been
 * checked at all" is a different (arguably riskier) claim than "checked but
 * uncertain". `default` renders as plain neutral text with no background
 * tint, for citations that carry no confidence/verification signal at all.
 *
 * @customElement lyra-citation-badge
 * @slot - Rich preview/tooltip content (e.g. a filename + excerpt), shown in
 * a floating popover on hover/focus. Nothing renders (no hover affordance at
 * all) when this slot is empty.
 * @event lyra-citation-activate - The badge was activated (click, or Enter
 * while focused). `detail: { sourceId, index }`.
 * @event lyra-citation-open - The badge's "full preview" affordance was
 * triggered (dblclick, or Space while focused).
 * `detail: { sourceId, index, href }`.
 * @csspart base - The clickable badge (`<button>`).
 * @csspart bracket - Each of the two literal `[`/`]` glyphs.
 * @csspart index - The citation number.
 * @csspart popover - The floating preview panel (only meaningful while open).
 */
export class LyraCitationBadge extends LyraElement {
  static styles = [LyraElement.styles, styles];

  /** The citation number shown, e.g. `3` renders as `[3]`. */
  @property({ type: Number }) index = 1;

  /** Confidence/verification state — drives the badge's color and (unless
   *  `label` is set) part of its accessible name. */
  @property({ reflect: true }) status: CitationBadgeStatus = 'default';

  /** Id of a corresponding `<lyra-source-card>` elsewhere on the page —
   *  echoed back verbatim in both events, never read or validated here. */
  @property({ attribute: 'source-id' }) sourceId = '';

  /** Optional direct link target for the citation's source. Carried into
   *  `lyra-citation-open`'s detail as-is; this component never navigates. */
  @property() href = '';

  /** Overrides the computed accessible name (`"Citation {index}[, {status}]"`). */
  @property() label = '';

  // A `[part]` always contains a literal `<slot>` child regardless of
  // assigned content, so `:empty` never matches — real emptiness is tracked
  // in JS instead, same fix lyra-tool-call-chip's hasDetailSlot/lyra-stat's
  // hasIcon etc. already establish.
  @state() private hasPreviewSlot = false;
  @state() private popoverOpen = false;

  @query('[part="base"]') private buttonEl?: HTMLButtonElement;
  @query('[part="popover"]') private popoverEl?: HTMLElement;

  private readonly popoverId = nextId('citation-badge-popover');
  private cleanupPositioner?: () => void;
  private hideTimer?: ReturnType<typeof setTimeout>;
  // Hover and focus are tracked as independent "keep it open" reasons —
  // mirrors lyra-toast-item's identical hovering/focused pair — so releasing
  // one (e.g. the pointer leaving while the badge still has keyboard focus)
  // doesn't schedule a hide the other modality is still holding open.
  private hovering = false;
  private focused = false;

  protected willUpdate(): void {
    if (!this.hasUpdated) {
      this.hasPreviewSlot = Array.from(this.children).some((el) => !el.hasAttribute('slot'));
    }
  }

  protected updated(changed: PropertyValues): void {
    if (changed.has('popoverOpen')) {
      this.cleanupPositioner?.();
      this.cleanupPositioner = undefined;
      if (this.popoverOpen && this.buttonEl && this.popoverEl) {
        this.cleanupPositioner = place(this.buttonEl, this.popoverEl, { placement: 'top-start' });
      }
    }
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.cleanupPositioner?.();
    clearTimeout(this.hideTimer);
  }

  private get accessibleLabel(): string {
    if (this.label) return this.label;
    const statusText = STATUS_LABEL[this.status];
    return statusText ? `Citation ${this.index}, ${statusText}` : `Citation ${this.index}`;
  }

  private onSlotChange = (e: Event): void => {
    this.hasPreviewSlot = (e.target as HTMLSlotElement).assignedElements({ flatten: true }).length > 0;
    // The slot can be emptied out from under an already-open popover (e.g. a
    // consumer clearing preview content asynchronously) — nothing left to
    // show, so don't leave an empty panel floating open.
    if (!this.hasPreviewSlot) this.hidePreviewNow();
  };

  // Named showPreview/hidePreviewNow (not show/hidePopover) to avoid
  // colliding with the standard HTML Popover API's own
  // HTMLElement.prototype.showPopover()/hidePopover() -- this component
  // renders its own floating panel via internal/positioner.js rather than
  // the native `popover` attribute, but TS's DOM lib still declares those
  // method names on every HTMLElement subclass, so reusing them here would
  // be a same-name-different-signature override error.
  private showPreview(): void {
    if (!this.hasPreviewSlot || this.popoverOpen) return;
    clearTimeout(this.hideTimer);
    this.hideTimer = undefined;
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

  // Attached to the wrapper (not the button alone) so the popover's own
  // slotted content counts too — pointerenter/pointerleave/focusin/focusout
  // fire relative to whichever element they're bound to, not per descendant,
  // so moving the pointer or focus between the button and the popover panel
  // within this same wrapper never toggles hovering/focused off and on.
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
  // No grace period here, unlike onPointerLeave -- a blur (Tab/Shift+Tab
  // away, or focus programmatically moved elsewhere) is a deliberate
  // navigation, not the transient pointer travel the delay exists to survive,
  // so it closes at once. Still deferred to hover if the pointer happens to
  // be resting on the badge/popover at the same time.
  private onFocusOut = (): void => {
    this.focused = false;
    if (this.hovering) return;
    this.hidePreviewNow();
  };

  // keydown bubbles up from whatever actually holds focus (the button, or a
  // focusable element inside slotted preview content) — attaching this at
  // the wrapper, rather than the button alone, is what makes Escape work
  // "while the popover has focus-within" per the component's contract,
  // without needing to track focus targets explicitly here.
  private onKeyDown = (e: KeyboardEvent): void => {
    if (e.key === 'Escape' && this.popoverOpen) {
      // Swallow it here rather than letting it bubble to e.g. a containing
      // lyra-dialog's own Escape-to-close handler — dismissing this
      // lightweight preview shouldn't also close a surrounding modal.
      e.stopPropagation();
      this.hidePreviewNow();
      return;
    }
    // Space normally activates a <button> the same as Enter, but this
    // component gives the two keys distinct meanings (Enter = activate,
    // Space = open) — so Space's native click-on-keyup must be pre-empted
    // here (preventDefault on keydown suppresses it) rather than left to
    // fire alongside this. Enter deliberately gets no such handling: its
    // native immediate click already reaches onClick below.
    if (e.key === ' ' && !e.repeat && e.target === this.buttonEl) {
      e.preventDefault();
      this.emitOpen();
    }
  };

  private onClick = (): void => {
    this.emit<CitationActivateDetail>('lyra-citation-activate', { sourceId: this.sourceId, index: this.index });
  };

  private onDblClick = (): void => {
    this.emitOpen();
  };

  private emitOpen(): void {
    this.emit<CitationOpenDetail>('lyra-citation-open', {
      sourceId: this.sourceId,
      index: this.index,
      href: this.href || undefined,
    });
  }

  render(): TemplateResult {
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
          aria-label=${this.getAttribute('aria-label') || this.accessibleLabel}
          aria-describedby=${this.hasPreviewSlot && this.popoverOpen ? this.popoverId : nothing}
          @click=${this.onClick}
          @dblclick=${this.onDblClick}
        >
          <span part="bracket" aria-hidden="true">[</span><span part="index">${this.index}</span
          ><span part="bracket" aria-hidden="true">]</span>
        </button>
        <div part="popover" id=${this.popoverId} role="tooltip" ?hidden=${!this.popoverOpen}>
          <slot @slotchange=${this.onSlotChange}></slot>
        </div>
      </span>
    `;
  }
}

defineElement('citation-badge', LyraCitationBadge);

declare global {
  interface HTMLElementTagNameMap {
    'lyra-citation-badge': LyraCitationBadge;
  }
}
