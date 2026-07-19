import { html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import type { Placement } from '@floating-ui/dom';
import { LyraElement } from '../../../internal/lyra-element.js';
import { nextId } from '../../../internal/a11y.js';
import { place, virtualAnchorFromRect, type VirtualAnchor } from '../../../internal/positioner.js';
import { rtlAwarePlacement } from '../../../internal/rtl.js';
import { finiteDuration, finiteNumber } from '../../../internal/numbers.js';
import { tooltipStyles } from './overlay.styles.js';

/** Default show/hide timer delay (ms). */
const DEFAULT_DELAY = 150;
/** Default anchor-offset distance (px), passed to Floating UI's `offset()` middleware -- same
 *  semantics as `<lr-popover>.distance` (both wrap the same `place()`/`offset()` middleware). */
const DEFAULT_DISTANCE = 6;

/**
 * `<lr-tooltip>` — a localized, hover/focus tooltip for a consumer-owned trigger.
 *
 * @customElement lr-tooltip
 * @slot trigger - The element that receives hover/focus listeners.
 * @slot - Tooltip content.
 * @csspart trigger - The trigger wrapper.
 * @csspart popup - The tooltip popup.
 * @cssprop --lr-tooltip-max-inline-size - Maximum inline size of the tooltip (default `--lr-size-20rem`).
 * @cssprop --lr-tooltip-background - Tooltip background color (default `--lr-color-neutral`).
 * @cssprop --lr-tooltip-color - Tooltip text color (default `--lr-color-on-neutral`).
 */
export class LyraTooltip extends LyraElement {
  static styles = [LyraElement.styles, tooltipStyles];
  @property({ type: Boolean, reflect: true }) open = false;
  @property({ type: Boolean }) manual = false;
  /** Show/hide timer delay (ms) -- see `setOpen()`. NaN/negative/oversized all normalize through
   *  `finiteDuration`. */
  @property({ type: Number }) delay = DEFAULT_DELAY;
  @property({ reflect: true }) placement: Placement = 'top';
  /** Anchor-offset distance (px) passed to Floating UI's `offset()` middleware -- identical
   *  semantics to `<lr-popover>.distance` (can legitimately be negative for overlap). */
  @property({ type: Number }) distance = DEFAULT_DISTANCE;
  @property() content = '';
  @property({ attribute: 'aria-label' }) accessibleLabel = '';
  @state() private trigger?: HTMLElement;
  /** The virtual anchor set by `showAt()`, taking priority over `trigger` for positioning while
   *  set. Cleared whenever the tooltip closes, so a later `open = true` with no fresh `showAt()`
   *  call reverts to plain trigger-based behavior. */
  private virtualAnchor?: VirtualAnchor;
  /** `options.returnFocusTo` from the `showAt()` call that opened the tooltip, if any -- see
   *  `showAt()`'s doc comment and `onVirtualAnchorKeyDown`. */
  private returnFocusTo?: HTMLElement;
  private cleanup?: () => void;
  private timer?: ReturnType<typeof setTimeout>;
  private readonly tooltipId = nextId('tooltip');

  protected updated(changed: PropertyValues): void {
    if (changed.has('open') || changed.has('placement') || changed.has('distance')) {
      this.cleanup?.();
      this.cleanup = undefined;
      if (this.open) this.position();
      if (changed.has('open')) {
        // A virtual anchor has no slotted trigger to bind hover/focus/keydown listeners to (see
        // bindTrigger()) -- bind a document-level Escape listener for that path specifically
        // while such a tooltip is open, and clear the virtual-anchor state on close so a later
        // `open = true` with no fresh `showAt()` call reverts to plain trigger-based behavior.
        if (this.open) {
          if (this.virtualAnchor) document.addEventListener('keydown', this.onVirtualAnchorKeyDown);
        } else {
          document.removeEventListener('keydown', this.onVirtualAnchorKeyDown);
          this.virtualAnchor = undefined;
          this.returnFocusTo = undefined;
        }
      }
      this.syncTriggerA11y();
    }
  }
  connectedCallback(): void {
    super.connectedCallback();
    // A reconnect (e.g. a drag-and-drop reparent keeping this same element
    // instance) fires disconnectedCallback then connectedCallback
    // synchronously with no update in between, so updated() never reruns to
    // notice `open` is still true -- restore the Floating UI positioner
    // subscription it dropped. The trigger's own listeners are untouched by
    // (dis)connect since they live on a light-DOM element the reconnect
    // doesn't move independently of this host.
    if (this.hasUpdated && this.open) {
      this.position();
      if (this.virtualAnchor) document.addEventListener('keydown', this.onVirtualAnchorKeyDown);
    }
  }
  disconnectedCallback(): void {
    clearTimeout(this.timer);
    this.cleanup?.();
    this.cleanup = undefined;
    document.removeEventListener('keydown', this.onVirtualAnchorKeyDown);
    super.disconnectedCallback();
  }
  /**
   * Opens the tooltip anchored to an arbitrary rectangle instead of the slotted `trigger` -- for
   * anchoring to a graph node, a canvas pixel, a chart datum, or any other non-DOM location.
   * `width`/`height` default to `0` (a point). Positions exactly as `place()` would against a real
   * element (flip/shift/RTL all apply unchanged). Opens immediately, bypassing `delay`/`manual`
   * (both are hover-debounce concerns for a slotted trigger, not relevant to a deliberate
   * programmatic `showAt()` call).
   *
   * A virtual anchor has no DOM node, so `autoUpdate()` can't track it moving on its own -- call
   * `showAt()` again with fresh coordinates to re-anchor an already-open tooltip (e.g. on a graph
   * pan/zoom tick); the tooltip stays open across such a call, it does not toggle. Close it the
   * same way any tooltip closes: set `open = false` (there is no separate `hide()`). Pass
   * `rect.contextElement` (a real, still-connected element near the virtual point) when available
   * so `autoUpdate()` has something to observe for ancestor-scroll/resize tracking; omitting it
   * still works, it just means only explicit re-`showAt()` calls keep the tooltip anchored.
   *
   * A virtual anchor also has no `.focus()`. Escape returns focus to `options.returnFocusTo` when
   * supplied, or skips focus-return entirely otherwise -- refocusing the right place after a
   * virtual anchor closes is the host's responsibility, since Lyra can't assume how e.g. a graph
   * node's own keyboard model wants focus back.
   */
  showAt(
    rect: { x: number; y: number; width?: number; height?: number; contextElement?: Element },
    options?: { returnFocusTo?: HTMLElement },
  ): void {
    this.virtualAnchor = virtualAnchorFromRect(rect);
    this.returnFocusTo = options?.returnFocusTo;
    if (this.open) this.position();
    else this.open = true;
  }
  private position(): void {
    const popup = this.renderRoot.querySelector('[part="popup"]') as HTMLElement | null;
    const anchor = this.virtualAnchor ?? this.trigger;
    if (this.open && anchor && popup) {
      this.cleanup = place(anchor, popup, {
        placement: rtlAwarePlacement(this.placement, this),
        offset: finiteNumber(this.distance, DEFAULT_DISTANCE),
      });
    }
  }
  private syncTriggerA11y(): void {
    if (!this.trigger) return;
    this.trigger.setAttribute('aria-describedby', this.open ? this.tooltipId : '');
    if (!this.open) this.trigger.removeAttribute('aria-describedby');
  }
  private setOpen(next: boolean): void {
    clearTimeout(this.timer);
    const delay = finiteDuration(this.delay, DEFAULT_DELAY);
    if (next && delay > 0) this.timer = setTimeout(() => { this.open = true; }, delay);
    else this.open = next;
  }
  private bindTrigger(trigger: HTMLElement): void {
    trigger.addEventListener('mouseenter', this.onEnter);
    trigger.addEventListener('mouseleave', this.onLeave);
    trigger.addEventListener('focus', this.onEnter);
    trigger.addEventListener('blur', this.onLeave);
    trigger.addEventListener('keydown', this.onTriggerKeyDown);
  }
  private unbindTrigger(trigger: HTMLElement): void {
    trigger.removeEventListener('mouseenter', this.onEnter);
    trigger.removeEventListener('mouseleave', this.onLeave);
    trigger.removeEventListener('focus', this.onEnter);
    trigger.removeEventListener('blur', this.onLeave);
    trigger.removeEventListener('keydown', this.onTriggerKeyDown);
    trigger.removeAttribute('aria-describedby');
  }
  private onTriggerSlotChange = (event: Event): void => {
    const next = (event.target as HTMLSlotElement).assignedElements({ flatten: true })[0] as HTMLElement | undefined;
    if (next === this.trigger) return;
    // Swapping the slotted trigger (a conditional template, a repeat() re-key)
    // must strip the outgoing element's listeners and stale aria-describedby
    // before adopting the new one -- otherwise the old node keeps driving this
    // tooltip's open state and keeps pointing assistive tech at it.
    if (this.trigger) this.unbindTrigger(this.trigger);
    this.trigger = next;
    if (!this.trigger) return;
    this.bindTrigger(this.trigger);
    this.syncTriggerA11y();
  };
  private onEnter = (): void => { if (!this.manual) this.setOpen(true); };
  private onLeave = (): void => { if (!this.manual) this.setOpen(false); };
  private onTriggerKeyDown = (event: KeyboardEvent): void => {
    // WCAG 1.4.13: content shown on hover/focus must be dismissable without
    // moving pointer hover or keyboard focus -- Escape hides the tooltip while
    // leaving focus on the trigger (unlike the popover's Escape handling, the
    // trigger already has focus here, so there's nothing to refocus).
    if (this.manual || !this.open || event.key !== 'Escape') return;
    event.preventDefault();
    clearTimeout(this.timer);
    this.open = false;
  };
  /** Escape handling for a tooltip opened via `showAt()` -- bound at the document level while
   *  such a tooltip is open, since a virtual anchor has no slotted trigger for `onTriggerKeyDown`
   *  above to catch Escape through (that listener is only ever bound to a real trigger element via
   *  `bindTrigger()`). Only ever attached while `virtualAnchor` is set, so this never runs for a
   *  normal trigger-driven tooltip. */
  private onVirtualAnchorKeyDown = (event: KeyboardEvent): void => {
    if (event.key !== 'Escape') return;
    event.preventDefault();
    const returnFocusTarget = this.returnFocusTo;
    this.open = false;
    returnFocusTarget?.focus();
  };
  render(): TemplateResult {
    const label = this.getAttribute('aria-label') || this.accessibleLabel || nothing;
    return html`
      <span part="trigger"><slot name="trigger" @slotchange=${this.onTriggerSlotChange}></slot></span>
      <div id=${this.tooltipId} part="popup" role="tooltip" aria-label=${label} ?data-hidden=${!this.open}>
        <slot>${this.content}</slot>
      </div>
    `;
  }
}
declare global { interface HTMLElementTagNameMap { 'lr-tooltip': LyraTooltip; } }
