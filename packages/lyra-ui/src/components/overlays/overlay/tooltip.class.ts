import { html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import type { Placement } from '@floating-ui/dom';
import { LyraElement } from '../../../internal/lyra-element.js';
import { nextId } from '../../../internal/a11y.js';
import { place, virtualAnchorFromRect, type VirtualAnchor } from '../../../internal/positioner.js';
import { rtlAwarePlacement } from '../../../internal/rtl.js';
import { finiteDuration, finiteNumber } from '../../../internal/numbers.js';
import { activateOverlay, type OverlayHandle } from '../../../internal/overlay-manager.js';
import { tooltipStyles } from './overlay.styles.js';

/** Default show/hide timer delay (ms). */
const DEFAULT_DELAY = 150;
/** Default anchor-offset distance (px), passed to Floating UI's `offset()` middleware -- same
 *  semantics as `<lr-popover>.distance` (both wrap the same `place()`/`offset()` middleware). */
const DEFAULT_DISTANCE = 6;

/**
 * `<lr-tooltip>` — a localized, hover/focus tooltip for a consumer-owned trigger.
 * Plain content uses tooltip semantics. When the default slot contains an actionable descendant,
 * the popup promotes to a named dialog and remains open while pointer or focus is inside so its
 * controls can be reached. Prefer `<lr-popover>` when click-to-open ownership is desired.
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
  static override styles = [LyraElement.styles, tooltipStyles];
  private _open = false;
  @property({ type: Boolean, reflect: true })
  get open(): boolean {
    return this._open;
  }
  set open(next: boolean) {
    const old = this._open;
    this._open = next;
    if (!next) this.cancelPendingOpen();
    this.requestUpdate('open', old);
  }
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
  @state() private interactiveContent = false;
  private triggerDescription?: { had: boolean; value: string | null };
  private triggerDescriptionObserver?: MutationObserver;
  /** The virtual anchor set by `showAt()`, taking priority over `trigger` for positioning while
   *  set. Cleared whenever the tooltip closes, so a later `open = true` with no fresh `showAt()`
   *  call reverts to plain trigger-based behavior. */
  private virtualAnchor?: VirtualAnchor;
  /** `options.returnFocusTo` from the `showAt()` call that opened the tooltip, if any -- see
   *  `showAt()`'s doc comment and `activateVirtualAnchorOverlay()`'s `onEscape` callback. */
  private returnFocusTo?: HTMLElement;
  private cleanup?: () => void;
  private timer?: ReturnType<typeof setTimeout>;
  private pendingOpen = false;
  /** Registered with the shared overlay manager only while a `showAt()`-opened (virtual-anchor)
   *  tooltip is open -- see `activateVirtualAnchorOverlay()`. A trigger-based tooltip keeps using
   *  its own trigger-scoped keydown handler below, unaffected by this. */
  private overlayHandle?: OverlayHandle;
  private readonly tooltipId = nextId('tooltip');
  private contentObserver?: MutationObserver;

  protected override willUpdate(changed: PropertyValues): void {
    if (changed.has('manual') && this.manual) this.cancelPendingOpen();
    if (changed.has('delay') && this.pendingOpen) this.scheduleOpen();
  }

  protected override updated(changed: PropertyValues): void {
    if (changed.has('open') || changed.has('placement') || changed.has('distance')) {
      this.cleanup?.();
      this.cleanup = undefined;
      if (this.open) this.position();
      if (changed.has('open')) {
        // A virtual anchor has no slotted trigger to bind hover/focus/keydown listeners to (see
        // bindTrigger()) -- register with the shared, topmost-stack-aware overlay manager for that
        // path specifically while such a tooltip is open, so nested virtual-anchor popovers/
        // tooltips only close the topmost one on a single Escape press (instead of every instance
        // reacting to its own unscoped document-level listener), and clear the virtual-anchor
        // state on close so a later `open = true` with no fresh `showAt()` call reverts to plain
        // trigger-based behavior.
        if (this.open) {
          if (this.virtualAnchor) this.activateVirtualAnchorOverlay();
        } else {
          this.overlayHandle?.deactivate({ restoreFocus: false });
          this.overlayHandle = undefined;
          this.virtualAnchor = undefined;
          this.returnFocusTo = undefined;
        }
      }
      this.syncTriggerA11y();
    }
  }
  override connectedCallback(): void {
    super.connectedCallback();
    this.contentObserver ??= new MutationObserver(() => this.updateInteractiveContent());
    this.contentObserver.observe(this, { childList: true, subtree: true, attributes: true });
    if (this.trigger && !this.triggerDescription) {
      this.snapshotTriggerDescription(this.trigger);
      this.bindTrigger(this.trigger);
      this.syncTriggerA11y();
    }
    // A reconnect (e.g. a drag-and-drop reparent keeping this same element
    // instance) fires disconnectedCallback then connectedCallback
    // synchronously with no update in between, so updated() never reruns to
    // notice `open` is still true -- restore the Floating UI positioner
    // subscription it dropped. The trigger's own listeners are untouched by
    // (dis)connect since they live on a light-DOM element the reconnect
    // doesn't move independently of this host.
    if (this.hasUpdated && this.open) {
      this.position();
      if (this.virtualAnchor) {
        if (this.overlayHandle?.isActive()) this.overlayHandle.resume();
        else this.activateVirtualAnchorOverlay();
      }
    }
  }
  override disconnectedCallback(): void {
    this.cancelPendingOpen();
    this.cleanup?.();
    this.cleanup = undefined;
    this.overlayHandle?.suspend();
    if (this.trigger) {
      this.unbindTrigger(this.trigger);
      this.restoreTriggerDescription();
    }
    this.contentObserver?.disconnect();
    super.disconnectedCallback();
  }
  /** Registers this virtual-anchor-opened tooltip with the shared overlay manager
   *  (`internal/overlay-manager.ts`) so Escape is routed only to the topmost overlay in the stack,
   *  instead of every open virtual-anchor popover/tooltip reacting to its own unscoped
   *  `document`-level keydown listener. Non-modal and non-focus-trapping: a virtual anchor has no
   *  DOM node to own focus, so background inerting and Tab trapping (both opt-in via `modal`/
   *  `trapFocus`) would be meaningless here -- only Escape ownership is needed. */
  private activateVirtualAnchorOverlay(): void {
    if (this.overlayHandle?.isActive()) return;
    this.overlayHandle = activateOverlay({
      host: this,
      panel: () => this.renderRoot.querySelector('[part="popup"]') as HTMLElement | null,
      onEscape: () => {
        const returnFocusTarget = this.returnFocusTo;
        this.open = false;
        returnFocusTarget?.focus();
      },
      modal: false,
      trapFocus: false,
    });
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
    if (this.open) {
      this.activateVirtualAnchorOverlay();
      this.position();
    }
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
    const descriptions = new Set((this.triggerDescription?.value ?? '').split(/\s+/).filter(Boolean));
    if (this.open) descriptions.add(this.tooltipId);
    if (descriptions.size > 0) this.trigger.setAttribute('aria-describedby', [...descriptions].join(' '));
    else this.trigger.removeAttribute('aria-describedby');
  }
  private setOpen(next: boolean): void {
    this.cancelPendingOpen();
    const delay = finiteDuration(this.delay, DEFAULT_DELAY);
    if (next && delay > 0) {
      this.pendingOpen = true;
      this.timer = setTimeout(() => {
        this.pendingOpen = false;
        this.timer = undefined;
        this.open = true;
      }, delay);
    }
    else this.open = next;
  }
  private cancelPendingOpen(): void {
    clearTimeout(this.timer);
    this.timer = undefined;
    this.pendingOpen = false;
  }
  private scheduleOpen(): void {
    this.cancelPendingOpen();
    const delay = finiteDuration(this.delay, DEFAULT_DELAY);
    if (delay <= 0) {
      this.open = true;
      return;
    }
    this.pendingOpen = true;
    this.timer = setTimeout(() => {
      this.pendingOpen = false;
      this.timer = undefined;
      this.open = true;
    }, delay);
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
  }
  private snapshotTriggerDescription(trigger: HTMLElement): void {
    this.triggerDescription = {
      had: trigger.hasAttribute('aria-describedby'),
      value: trigger.getAttribute('aria-describedby'),
    };
    this.triggerDescriptionObserver ??= new MutationObserver(() => {
      if (!this.trigger || !this.triggerDescription) return;
      const current = this.trigger.getAttribute('aria-describedby');
      const descriptions = new Set((this.triggerDescription.value ?? '').split(/\s+/).filter(Boolean));
      if (this.open) descriptions.add(this.tooltipId);
      const generated = descriptions.size > 0 ? [...descriptions].join(' ') : null;
      if (current === generated) return;
      this.triggerDescription.had = this.trigger.hasAttribute('aria-describedby');
      this.triggerDescription.value = current;
      this.syncTriggerA11y();
    });
    this.triggerDescriptionObserver.observe(trigger, {
      attributes: true,
      attributeFilter: ['aria-describedby'],
    });
  }
  private restoreTriggerDescription(): void {
    if (!this.trigger || !this.triggerDescription) return;
    this.triggerDescriptionObserver?.disconnect();
    if (this.triggerDescription.had) {
      this.trigger.setAttribute('aria-describedby', this.triggerDescription.value ?? '');
    } else {
      this.trigger.removeAttribute('aria-describedby');
    }
    this.triggerDescription = undefined;
  }
  private onTriggerSlotChange = (event: Event): void => {
    const next = (event.target as HTMLSlotElement).assignedElements({ flatten: true })[0] as HTMLElement | undefined;
    if (next === this.trigger) return;
    // Swapping the slotted trigger (a conditional template, a repeat() re-key)
    // must strip the outgoing element's listeners and stale aria-describedby
    // before adopting the new one -- otherwise the old node keeps driving this
    // tooltip's open state and keeps pointing assistive tech at it.
    this.cancelPendingOpen();
    if (this.trigger) {
      this.unbindTrigger(this.trigger);
      this.restoreTriggerDescription();
    }
    this.trigger = next;
    if (!this.trigger) return;
    this.snapshotTriggerDescription(this.trigger);
    this.bindTrigger(this.trigger);
    this.syncTriggerA11y();
    // An initially-open tooltip reaches its first updated() before slotchange has supplied the
    // trigger, so that update has no anchor to position against. Re-run positioning once the
    // trigger exists, matching the initially-open popover path.
    if (this.open) this.position();
  };
  private onEnter = (): void => { if (!this.manual) this.setOpen(true); };
  private onLeave = (event: Event): void => {
    if (this.manual) return;
    const next = (event as FocusEvent | MouseEvent).relatedTarget;
    if (this.interactiveContent && this.isPopupTarget(next)) return;
    this.setOpen(false);
  };
  private onPopupEnter = (): void => {
    if (!this.interactiveContent || this.manual) return;
    this.cancelPendingOpen();
    this.open = true;
  };
  private onPopupLeave = (event: Event): void => {
    if (!this.interactiveContent || this.manual) return;
    const next = (event as FocusEvent | MouseEvent).relatedTarget;
    if (next instanceof Node && (this.trigger?.contains(next) || this.isPopupTarget(next))) return;
    this.setOpen(false);
  };
  private isPopupTarget(target: EventTarget | null): boolean {
    if (!(target instanceof Node)) return false;
    const slot = this.renderRoot.querySelector<HTMLSlotElement>('[part="popup"] slot');
    return (
      this.renderRoot.querySelector<HTMLElement>('[part="popup"]')?.contains(target) === true ||
      slot?.assignedElements({ flatten: true }).some((element) => element === target || element.contains(target)) === true
    );
  }
  private updateInteractiveContent(): void {
    const slot = this.renderRoot.querySelector<HTMLSlotElement>('[part="popup"] slot');
    if (!slot) return;
    const selector =
      'a[href],button,input,select,textarea,[contenteditable]:not([contenteditable="false"]),' +
      '[tabindex]:not([tabindex="-1"]),[role="button"],[role="link"],[role="menuitem"]';
    this.interactiveContent = slot.assignedElements({ flatten: true }).some(
      (element) => element.matches(selector) || element.querySelector(selector) !== null,
    );
  }
  private onTriggerKeyDown = (event: KeyboardEvent): void => {
    // WCAG 1.4.13: content shown on hover/focus must be dismissable without
    // moving pointer hover or keyboard focus -- Escape hides the tooltip while
    // leaving focus on the trigger (unlike the popover's Escape handling, the
    // trigger already has focus here, so there's nothing to refocus).
    if (this.manual || !this.open || event.key !== 'Escape') return;
    event.preventDefault();
    this.cancelPendingOpen();
    this.open = false;
  };
  override render(): TemplateResult {
    const label = this.getAttribute('aria-label') || this.accessibleLabel;
    return html`
      <span part="trigger"><slot name="trigger" @slotchange=${this.onTriggerSlotChange}></slot></span>
      <div id=${this.tooltipId} part="popup" role=${this.interactiveContent ? 'dialog' : 'tooltip'}
        aria-label=${this.interactiveContent ? label || this.localize('popover') : label || nothing}
        ?data-hidden=${!this.open}
        @mouseenter=${this.onPopupEnter} @mouseleave=${this.onPopupLeave}
        @focusin=${this.onPopupEnter} @focusout=${this.onPopupLeave}>
        <slot @slotchange=${this.updateInteractiveContent}>${this.content}</slot>
      </div>
    `;
  }
}
declare global { interface HTMLElementTagNameMap { 'lr-tooltip': LyraTooltip; } }
