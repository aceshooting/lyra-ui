import { html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import type { Placement } from '@floating-ui/dom';
import { LyraElement } from '../../../internal/lyra-element.js';
import { nextId } from '../../../internal/a11y.js';
import { place, virtualAnchorFromRect, type VirtualAnchor } from '../../../internal/positioner.js';
import { rtlAwarePlacement } from '../../../internal/rtl.js';
import { finiteDuration, finiteNumber } from '../../../internal/numbers.js';
import { activateOverlay, composedContains, type OverlayHandle } from '../../../internal/overlay-manager.js';
import { tooltipStyles } from './overlay.styles.js';

/** Default show/hide timer delay (ms). */
const DEFAULT_DELAY = 150;
/** Default anchor-offset distance (px), passed to Floating UI's `offset()` middleware -- same
 *  semantics as `<lr-popover>.distance` (both wrap the same `place()`/`offset()` middleware). */
const DEFAULT_DISTANCE = 6;
/** `attachShadow()` itself is not observable. A short grace window catches custom elements that
 * attach an open root during upgrade/initialization without polling forever when a legitimate
 * custom element intentionally remains in the light DOM. */
const MAX_SHADOW_CONTENT_SCAN_FRAMES = 4;

type TooltipVirtualRect = {
  x: number;
  y: number;
  width?: number;
  height?: number;
  contextElement?: Element;
};

const ACTIONABLE_SELECTOR =
  'a[href],button,input,select,textarea,[contenteditable]:not([contenteditable="false"]),' +
  '[tabindex]:not([tabindex="-1"]),[role="button"],[role="link"],[role="menuitem"]';

function normalizeVirtualRect(rect: TooltipVirtualRect): TooltipVirtualRect | undefined {
  const width = rect.width ?? 0;
  const height = rect.height ?? 0;
  if (![rect.x, rect.y, width, height].every(Number.isFinite)) return undefined;
  return {
    x: rect.x,
    y: rect.y,
    width: Math.max(0, width),
    height: Math.max(0, height),
    contextElement: rect.contextElement,
  };
}

/**
 * `<lr-tooltip>` — a localized, hover/focus tooltip for a consumer-owned trigger.
 * Plain content uses tooltip semantics. When the default slot contains an actionable descendant
 * (including inside a nested custom element's open shadow root), the popup promotes to a named
 * dialog and remains open while pointer or focus is inside so its controls can be reached. Escape
 * from popup content closes it and restores focus to the trigger. Prefer `<lr-popover>` when
 * click-to-open ownership is desired.
 *
 * While open, the trigger's `aria-describedby` targets a hidden text proxy in this component's
 * light DOM rather than the shadow-private popup. Native triggers can resolve that ID directly;
 * `<lr-button>` and `<lr-icon-button>` reflect it onto their focused internal controls through
 * `ariaDescribedByElements`, where the serialized internal attribute is intentionally empty.
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
    if (!next) {
      this.cancelPendingOpen();
      this.cancelShadowContentScan();
    }
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
  private restoreFocusOnClose = false;
  /** Focus restoration after Escape is synchronous. Suppress only that focus event so returning
   * to the trigger does not immediately reopen the tooltip; a later genuine focus still opens. */
  private suppressTriggerFocusOpen = false;
  /** Registered with the shared overlay manager while a virtual-anchor or actionable tooltip is
   *  open, so Escape ownership and focus return remain topmost-stack-aware. */
  private overlayHandle?: OverlayHandle;
  private readonly tooltipId = nextId('tooltip');
  private readonly descriptionId = nextId('tooltip-description');
  private descriptionProxy?: HTMLSpanElement;
  private contentObserver?: MutationObserver;
  /** While an open tooltip contains a rootless custom element, rescan for a bounded initialization
   * grace period. Later observable content mutations start a fresh grace period. */
  private shadowContentScanFrame?: number;
  private shadowContentScanView?: Window;
  private shadowContentScanAttempts = 0;

  protected override willUpdate(changed: PropertyValues): void {
    if (changed.has('manual') && this.manual) this.cancelPendingOpen();
    if (changed.has('delay') && this.pendingOpen) this.scheduleOpen();
  }

  protected override updated(changed: PropertyValues): void {
    if (
      changed.has('open') ||
      changed.has('placement') ||
      changed.has('distance') ||
      changed.has('interactiveContent')
    ) {
      this.cleanup?.();
      this.cleanup = undefined;
      if (this.open && this.isConnected) this.position();
      if (changed.has('open')) {
        // A virtual anchor has no slotted trigger to bind hover/focus/keydown listeners to (see
        // bindTrigger()) -- register with the shared, topmost-stack-aware overlay manager for that
        // path specifically while such a tooltip is open, so nested virtual-anchor popovers/
        // tooltips only close the topmost one on a single Escape press (instead of every instance
        // reacting to its own unscoped document-level listener), and clear the virtual-anchor
        // state on close so a later `open = true` with no fresh `showAt()` call reverts to plain
        // trigger-based behavior.
        if (this.open) {
          this.updateInteractiveContent();
          if (this.isConnected && this.requiresOverlayManager) this.activateTooltipOverlay();
        } else {
          const restoreFocus = this.restoreFocusOnClose;
          this.suppressTriggerFocusOpen = restoreFocus;
          try {
            this.overlayHandle?.deactivate({ restoreFocus });
          } finally {
            this.suppressTriggerFocusOpen = false;
          }
          this.overlayHandle = undefined;
          this.restoreFocusOnClose = false;
          this.virtualAnchor = undefined;
          this.returnFocusTo = undefined;
        }
      } else if (changed.has('interactiveContent') && this.open && this.isConnected) {
        if (this.requiresOverlayManager) this.activateTooltipOverlay();
        else {
          this.overlayHandle?.deactivate({ restoreFocus: false });
          this.overlayHandle = undefined;
        }
      }
      this.syncTriggerA11y();
    }
    if (changed.has('content') || changed.has('accessibleLabel')) this.updateDescriptionProxy();
  }
  override connectedCallback(): void {
    super.connectedCallback();
    this.ensureDescriptionProxy();
    this.contentObserver ??= new MutationObserver(() => this.updateInteractiveContent());
    this.updateInteractiveContent();
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
      if (this.requiresOverlayManager) {
        if (this.overlayHandle?.isActive()) this.overlayHandle.resume();
        else this.activateTooltipOverlay();
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
    this.cancelShadowContentScan();
    super.disconnectedCallback();
  }
  /** Registers a virtual-anchor or actionable tooltip with the shared overlay manager
   *  (`internal/overlay-manager.ts`) so Escape is routed only to the topmost overlay in the stack,
   *  instead of every open virtual-anchor popover/tooltip reacting to its own unscoped
   *  `document`-level keydown listener. Non-modal and non-focus-trapping: a virtual anchor has no
   *  DOM node to own focus, so background inerting and Tab trapping (both opt-in via `modal`/
   *  `trapFocus`) would be meaningless here -- only Escape ownership is needed. */
  private activateTooltipOverlay(): void {
    if (!this.isConnected) return;
    const restoreFocusTarget = this.virtualAnchor ? (this.returnFocusTo ?? null) : (this.trigger ?? null);
    if (this.overlayHandle?.isActive()) {
      this.overlayHandle.updateRestoreFocusTo(restoreFocusTarget);
      return;
    }
    this.overlayHandle = activateOverlay({
      host: this,
      panel: () => this.renderRoot.querySelector('[part="popup"]') as HTMLElement | null,
      onEscape: () => {
        this.restoreFocusOnClose = true;
        this.open = false;
      },
      restoreFocusTo: restoreFocusTarget,
      modal: false,
      trapFocus: false,
    });
  }

  private get requiresOverlayManager(): boolean {
    return this.virtualAnchor !== undefined || this.interactiveContent;
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
   * Non-finite coordinates or dimensions are ignored and leave the current open/anchor state
   * unchanged.
   */
  showAt(
    rect: TooltipVirtualRect,
    options?: { returnFocusTo?: HTMLElement },
  ): void {
    const normalizedRect = normalizeVirtualRect(rect);
    if (!normalizedRect) return;
    this.virtualAnchor = virtualAnchorFromRect(normalizedRect);
    this.returnFocusTo = options?.returnFocusTo;
    if (this.open) {
      this.activateTooltipOverlay();
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
    if (this.open) descriptions.add(this.descriptionId);
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
      if (this.open) descriptions.add(this.descriptionId);
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
    const hadTrigger = this.trigger !== undefined;
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
    if (!this.trigger) {
      if (hadTrigger && this.open && !this.virtualAnchor) this.open = false;
      return;
    }
    this.snapshotTriggerDescription(this.trigger);
    this.bindTrigger(this.trigger);
    this.syncTriggerA11y();
    // An initially-open tooltip reaches its first updated() before slotchange has supplied the
    // trigger, so that update has no anchor to position against. Re-run positioning once the
    // trigger exists, matching the initially-open popover path.
    if (this.open) this.position();
    if (this.open && this.interactiveContent) this.activateTooltipOverlay();
  };
  private onEnter = (event: Event): void => {
    if (event.type === 'focus' && this.suppressTriggerFocusOpen) return;
    if (!this.manual) this.setOpen(true);
  };
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
    if (!(target instanceof Element)) return false;
    const slot = this.renderRoot.querySelector<HTMLSlotElement>('[part="popup"] slot');
    return (
      this.renderRoot.querySelector<HTMLElement>('[part="popup"]')?.contains(target) === true ||
      slot?.assignedElements({ flatten: true }).some((element) => composedContains(element, target)) === true
    );
  }
  private updateInteractiveContent(fromShadowContentScan = false): void {
    if (!fromShadowContentScan) this.shadowContentScanAttempts = 0;
    const slot = this.renderRoot.querySelector<HTMLSlotElement>('[part="popup"] slot');
    if (!slot) return;
    const observedShadowRoots = new Set<ShadowRoot>();
    let awaitingShadowRoot = false;
    let actionable = false;
    const inspect = (element: Element): void => {
      if (element.matches(ACTIONABLE_SELECTOR)) actionable = true;
      if (element.shadowRoot) {
        observedShadowRoots.add(element.shadowRoot);
        for (const child of element.shadowRoot.children) inspect(child);
      } else if (element.localName.includes('-')) {
        awaitingShadowRoot = true;
      }
      for (const child of element.children) inspect(child);
    };
    for (const element of slot.assignedElements({ flatten: true })) inspect(element);
    this.interactiveContent = actionable;
    this.contentObserver?.disconnect();
    this.contentObserver?.observe(this, { childList: true, subtree: true, attributes: true });
    for (const root of observedShadowRoots) {
      this.contentObserver?.observe(root, { childList: true, subtree: true, attributes: true });
    }
    this.scheduleShadowContentScan(awaitingShadowRoot);
    this.updateDescriptionProxy();
  }
  private scheduleShadowContentScan(awaitingShadowRoot: boolean): void {
    this.cancelShadowContentScan(false);
    if (
      !awaitingShadowRoot
      || !this.open
      || !this.isConnected
      || this.shadowContentScanAttempts >= MAX_SHADOW_CONTENT_SCAN_FRAMES
    ) return;
    const view = this.ownerDocument.defaultView;
    if (!view) return;
    this.shadowContentScanView = view;
    this.shadowContentScanFrame = view.requestAnimationFrame(() => {
      this.shadowContentScanFrame = undefined;
      this.shadowContentScanView = undefined;
      this.shadowContentScanAttempts++;
      this.updateInteractiveContent(true);
    });
  }
  private cancelShadowContentScan(resetAttempts = true): void {
    if (this.shadowContentScanFrame !== undefined) {
      this.shadowContentScanView?.cancelAnimationFrame(this.shadowContentScanFrame);
    }
    this.shadowContentScanFrame = undefined;
    this.shadowContentScanView = undefined;
    if (resetAttempts) this.shadowContentScanAttempts = 0;
  }
  private ensureDescriptionProxy(): void {
    if (!this.descriptionProxy) {
      this.descriptionProxy = this.ownerDocument.createElement('span');
      this.descriptionProxy.id = this.descriptionId;
      this.descriptionProxy.slot = '__lr-tooltip-description';
      this.descriptionProxy.hidden = true;
      this.descriptionProxy.dataset['lyraTooltipDescription'] = '';
    }
    if (this.descriptionProxy.parentElement !== this) this.append(this.descriptionProxy);
    this.updateDescriptionProxy();
  }
  private updateDescriptionProxy(): void {
    if (!this.descriptionProxy) return;
    const slot = this.renderRoot.querySelector<HTMLSlotElement>('[part="popup"] slot:not([name])');
    const assignedText =
      slot
        ?.assignedNodes({ flatten: true })
        .map((node) => node.textContent ?? '')
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim() ?? '';
    const description = (this.accessibleLabel || assignedText || this.content).trim();
    if (this.descriptionProxy.textContent !== description) this.descriptionProxy.textContent = description;
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
      <slot name="__lr-tooltip-description" hidden></slot>
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
