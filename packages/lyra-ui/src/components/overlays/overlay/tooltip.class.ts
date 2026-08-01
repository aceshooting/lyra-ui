import { html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import type { Placement } from '@floating-ui/dom';
import { LyraElement } from '../../../internal/lyra-element.js';
import { nextId } from '../../../internal/a11y.js';
import { place, virtualAnchorFromRect, type VirtualAnchor } from '../../../internal/positioner.js';
import { rtlAwarePlacement } from '../../../internal/rtl.js';
import { finiteDuration, finiteNumber } from '../../../internal/numbers.js';
import { activateOverlay, composedContains, type OverlayHandle } from '../../../internal/overlay-manager.js';
import { applyOverlayArrow, type LyraArrowPlacement } from './overlay-arrow.js';
import { tooltipStyles } from './overlay.styles.js';

/** Default delay (ms) before an interaction opens the tooltip. */
const DEFAULT_SHOW_DELAY = 150;
/** Default delay (ms) before an interaction closes it again — none, so leaving is immediate. */
const DEFAULT_HIDE_DELAY = 0;
/** Default anchor-offset distance (px), passed to Floating UI's `offset()` middleware -- same
 *  semantics as `<lr-popover>.distance` (both wrap the same `place()`/`offset()` middleware). */
const DEFAULT_DISTANCE = 6;
/** `attachShadow()` itself is not observable. A short grace window catches custom elements that
 * attach an open root during upgrade/initialization without polling forever when a legitimate
 * custom element intentionally remains in the light DOM. */
const MAX_SHADOW_CONTENT_SCAN_FRAMES = 4;

/** One keyword of the space-separated `trigger` list. */
export type LyraTooltipTrigger = 'hover' | 'focus' | 'click' | 'manual';

export type { LyraArrowPlacement };

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

export interface LyraTooltipEventMap {
  'lr-show': CustomEvent<undefined>;
  'lr-after-show': CustomEvent<undefined>;
  'lr-hide': CustomEvent<undefined>;
  'lr-after-hide': CustomEvent<undefined>;
}

/**
 * `<lr-tooltip>` — a localized tooltip for a consumer-owned trigger.
 * Plain content uses tooltip semantics. When the default slot contains an actionable descendant
 * (including inside a nested custom element's open shadow root), the popup promotes to a named
 * dialog and remains open while pointer or focus is inside so its controls can be reached. Escape
 * from popup content closes it and restores focus to the trigger. Prefer `<lr-popover>` when
 * click-to-open ownership is desired.
 *
 * `trigger` is a space-separated list of `hover`, `focus`, `click` and `manual`, defaulting to
 * `"hover focus"`. `manual` (in the list, or the standalone `manual` boolean) means only
 * `show()`/`hide()`/`open` move it. `show-delay` and `hide-delay` are independent, so a tooltip
 * can linger after the pointer leaves without also being slow to appear.
 *
 * While open, the trigger's `aria-describedby` targets a hidden text proxy in this component's
 * light DOM rather than the shadow-private popup. Native triggers can resolve that ID directly;
 * `<lr-button>` and `<lr-icon-button>` reflect it onto their focused internal controls through
 * `ariaDescribedByElements`, where the serialized internal attribute is intentionally empty.
 *
 * @customElement lr-tooltip
 * @slot trigger - The element that receives the configured interaction listeners.
 * @slot - Tooltip content.
 * @event lr-show - The tooltip is about to open. Cancelable — `preventDefault()` keeps it closed.
 * @event lr-after-show - The tooltip is open and its transition has finished.
 * @event lr-hide - The tooltip is about to close. Cancelable — `preventDefault()` keeps it open.
 * @event lr-after-hide - The tooltip is closed and its transition has finished.
 * @method show - `show(): void` — open immediately, bypassing `show-delay` and `trigger`.
 * @method hide - `hide(): void` — close immediately, bypassing `hide-delay`.
 * @csspart trigger - The trigger wrapper.
 * @csspart popup - The tooltip popup.
 * @csspart arrow - The arrow element, rendered only when `arrow` is set. Its part name also
 *   carries the resolved side (`arrow-top`, `arrow-bottom`, `arrow-left`, `arrow-right`).
 * @cssprop --lr-tooltip-max-inline-size - Maximum inline size of the tooltip (default `--lr-size-20rem`).
 * @cssprop --lr-tooltip-background - Tooltip background color (default `--lr-color-neutral`).
 * @cssprop --lr-tooltip-color - Tooltip text color (default `--lr-color-on-neutral`).
 * @cssprop [--lr-tooltip-arrow-size=var(--lr-size-0-375rem)] - Half-width of the arrow square.
 */
export class LyraTooltip extends LyraElement<LyraTooltipEventMap> {
  static override styles = [LyraElement.styles, tooltipStyles];
  private _open = false;
  /** Whether the tooltip is open. Assigning it runs the full `lr-show`/`lr-hide` lifecycle;
   *  assigning `false` also cancels a delayed open that has not fired yet. */
  @property({ type: Boolean, reflect: true })
  get open(): boolean {
    return this._open;
  }
  set open(next: boolean) {
    const normalized = Boolean(next);
    // An explicit close always cancels a pending delayed open, even when the tooltip is already
    // closed -- otherwise the timer fires afterwards and reopens it behind the caller's back.
    if (!normalized) this.cancelPendingTransition();
    if (normalized === this._open) return;
    if (!this.hasUpdated) {
      this.applyOpenState(normalized);
      return;
    }
    if (normalized) this.show();
    else this.hide();
  }
  /**
   * Space-separated interaction list: any of `hover`, `focus`, `click`, `manual`. `manual` (or an
   * empty list) leaves the tooltip entirely under programmatic control.
   */
  @property() trigger = 'hover focus';
  /** Equivalent to including `manual` in `trigger`; kept because it reads better as a boolean
   *  attribute on a tooltip that is only ever driven from script. */
  @property({ type: Boolean }) manual = false;
  /** Delay (ms) before an interaction opens the tooltip. NaN/negative/oversized all normalize
   *  through `finiteDuration`. */
  @property({ type: Number, attribute: 'show-delay' }) showDelay = DEFAULT_SHOW_DELAY;
  /** Delay (ms) before an interaction closes the tooltip again. `0` by default, so leaving the
   *  trigger closes it at once. */
  @property({ type: Number, attribute: 'hide-delay' }) hideDelay = DEFAULT_HIDE_DELAY;
  @property({ reflect: true }) placement: Placement = 'top';
  /** Anchor-offset distance (px) passed to Floating UI's `offset()` middleware -- identical
   *  semantics to `<lr-popover>.distance` (can legitimately be negative for overlap). */
  @property({ type: Number }) distance = DEFAULT_DISTANCE;
  /** Offset along the anchor's edge, in pixels — Floating UI's cross-axis offset. */
  @property({ type: Number }) skidding = 0;
  /**
   * Id of an element elsewhere in this tooltip's own root to position against, instead of the
   * slotted trigger. The trigger keeps owning the interaction listeners and `aria-describedby`.
   * A `showAt()` virtual anchor still wins over it.
   */
  @property({ reflect: true }) for = '';
  /** Render an arrow that points at the anchor. */
  @property({ type: Boolean, reflect: true }) arrow = false;
  /** Where the arrow sits along the popup's edge. `anchor` tracks the anchor's centre. */
  @property({ attribute: 'arrow-placement' }) arrowPlacement: LyraArrowPlacement = 'anchor';
  /** Keeps the arrow this far from the popup's corners, in pixels. */
  @property({ type: Number, attribute: 'arrow-padding' }) arrowPadding = 0;
  @property() content = '';
  @property({ attribute: 'aria-label' }) accessibleLabel = '';
  @state() private triggerElement?: HTMLElement;
  @state() private interactiveContent = false;
  @state() private resolvedSide: 'top' | 'bottom' | 'left' | 'right' = 'top';
  private triggerDescription?: { had: boolean; value: string | null };
  private triggerDescriptionObserver?: MutationObserver;
  /** The virtual anchor set by `showAt()`, taking priority over `for`/`trigger` for positioning
   *  while set. Cleared whenever the tooltip closes, so a later `open = true` with no fresh
   *  `showAt()` call reverts to plain trigger-based behavior. */
  private virtualAnchor?: VirtualAnchor;
  /** `options.returnFocusTo` from the `showAt()` call that opened the tooltip, if any -- see
   *  `showAt()`'s doc comment and `activateTooltipOverlay()`'s `onEscape` callback. */
  private returnFocusTo?: HTMLElement;
  private cleanup?: () => void;
  private timer?: ReturnType<typeof setTimeout>;
  private pendingDirection?: 'show' | 'hide';
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
  /** Invalidates an in-flight `lr-after-*` wait when the opposite transition interrupts it. */
  private transitionToken = 0;

  /** The resolved interaction keywords. An empty list behaves like `manual`. */
  private get triggerKeywords(): Set<string> {
    return new Set(String(this.trigger ?? '').trim().split(/\s+/).filter(Boolean));
  }
  private get isManual(): boolean {
    const keywords = this.triggerKeywords;
    return this.manual || keywords.size === 0 || keywords.has('manual');
  }
  private opensOn(keyword: LyraTooltipTrigger): boolean {
    return !this.isManual && this.triggerKeywords.has(keyword);
  }

  protected override willUpdate(changed: PropertyValues): void {
    if ((changed.has('manual') || changed.has('trigger')) && this.isManual) this.cancelPendingTransition();
    if (changed.has('showDelay') && this.pendingDirection === 'show') this.requestTransition(true);
    if (changed.has('hideDelay') && this.pendingDirection === 'hide') this.requestTransition(false);
  }

  protected override updated(changed: PropertyValues): void {
    if (
      changed.has('open') ||
      changed.has('placement') ||
      changed.has('distance') ||
      changed.has('skidding') ||
      changed.has('for') ||
      changed.has('arrow') ||
      changed.has('arrowPlacement') ||
      changed.has('arrowPadding') ||
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
    if (this.triggerElement && !this.triggerDescription) {
      this.snapshotTriggerDescription(this.triggerElement);
      this.bindTrigger(this.triggerElement);
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
    this.cancelPendingTransition();
    this.cleanup?.();
    this.cleanup = undefined;
    this.overlayHandle?.suspend();
    if (this.triggerElement) {
      this.unbindTrigger(this.triggerElement);
      this.restoreTriggerDescription();
    }
    this.contentObserver?.disconnect();
    this.cancelShadowContentScan();
    // A pending after-event must not announce a transition the detached element left behind.
    this.transitionToken++;
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
    const restoreFocusTarget = this.virtualAnchor ? (this.returnFocusTo ?? null) : (this.triggerElement ?? null);
    if (this.overlayHandle?.isActive()) {
      this.overlayHandle.updateRestoreFocusTo(restoreFocusTarget);
      return;
    }
    this.overlayHandle = activateOverlay({
      host: this,
      panel: () => this.renderRoot.querySelector('[part="popup"]') as HTMLElement | null,
      onEscape: () => this.hide({ restoreFocus: true }),
      restoreFocusTo: restoreFocusTarget,
      modal: false,
      trapFocus: false,
    });
    // A hover tooltip must never steal focus, so initial focus is moved only when the content
    // explicitly asks for it.
    this.overlayHandle.focusAutofocus();
  }

  private get requiresOverlayManager(): boolean {
    return this.virtualAnchor !== undefined || this.interactiveContent;
  }
  /**
   * Opens the tooltip anchored to an arbitrary rectangle instead of the slotted `trigger` -- for
   * anchoring to a graph node, a canvas pixel, a chart datum, or any other non-DOM location.
   * `width`/`height` default to `0` (a point). Positions exactly as `place()` would against a real
   * element (flip/shift/RTL all apply unchanged). Opens immediately, bypassing `show-delay` and
   * `trigger` (both are interaction-debounce concerns for a slotted trigger, not relevant to a
   * deliberate programmatic `showAt()` call).
   *
   * A virtual anchor has no DOM node, so `autoUpdate()` can't track it moving on its own -- call
   * `showAt()` again with fresh coordinates to re-anchor an already-open tooltip (e.g. on a graph
   * pan/zoom tick); the tooltip stays open across such a call, it does not toggle. Close it with
   * `hide()` or `open = false`. Pass `rect.contextElement` (a real, still-connected element near
   * the virtual point) when available so `autoUpdate()` has something to observe for
   * ancestor-scroll/resize tracking; omitting it still works, it just means only explicit
   * re-`showAt()` calls keep the tooltip anchored.
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
    else this.show();
  }

  /** Open immediately, bypassing `show-delay` and whatever `trigger` allows. Emits `lr-show`
   *  first — vetoing it leaves the tooltip closed — then `lr-after-show`. */
  show(): void {
    this.cancelPendingTransition();
    if (this._open) return;
    if (this.emit('lr-show', undefined, { cancelable: true }).defaultPrevented) {
      this.syncOpenAttribute();
      return;
    }
    this.applyOpenState(true);
    void this.settleTransition('lr-after-show');
  }

  /** Close immediately, bypassing `hide-delay`. Emits `lr-hide` first — vetoing it leaves the
   *  tooltip open — then `lr-after-hide`. `restoreFocus` is used by the Escape path, which has to
   *  put focus back on the trigger it took it from. */
  hide(options?: { restoreFocus?: boolean }): void {
    this.cancelPendingTransition();
    if (!this._open) return;
    if (this.emit('lr-hide', undefined, { cancelable: true }).defaultPrevented) {
      this.syncOpenAttribute();
      return;
    }
    if (options?.restoreFocus) this.restoreFocusOnClose = true;
    this.applyOpenState(false);
    void this.settleTransition('lr-after-hide');
  }

  private applyOpenState(next: boolean): void {
    const old = this._open;
    this._open = next;
    if (!next) this.cancelShadowContentScan();
    this.requestUpdate('open', old);
  }

  /** A vetoed transition must leave the reflected attribute agreeing with the property; Lit only
   *  reflects properties it saw change. */
  private syncOpenAttribute(): void {
    this.toggleAttribute('open', this._open);
  }

  /** Resolves once the popup's open/close transition has finished, then emits the matching
   *  `lr-after-*` event. The transition resolves through `--lr-transition-fast`, which the token
   *  layer flattens under `prefers-reduced-motion: reduce`, so this settles in that branch too. */
  private async settleTransition(event: 'lr-after-show' | 'lr-after-hide'): Promise<void> {
    const token = ++this.transitionToken;
    await this.updateComplete;
    if (this.transitionToken !== token) return;
    if (this.isConnected) {
      const view = this.ownerDocument.defaultView;
      if (view) await new Promise<void>((resolve) => view.requestAnimationFrame(() => resolve()));
      if (this.transitionToken !== token) return;
      const popup = this.renderRoot.querySelector('[part="popup"]');
      const animations = popup?.getAnimations({ subtree: true }) ?? [];
      await Promise.all(animations.map((animation) => animation.finished.catch(() => undefined)));
      if (this.transitionToken !== token) return;
    }
    this.emit(event);
  }

  /** Resolves what the popup is positioned against: an explicit virtual anchor first, then the
   *  `for` idref, then the slotted trigger. */
  private resolveAnchor(): Element | VirtualAnchor | null {
    if (this.virtualAnchor) return this.virtualAnchor;
    if (this.for) {
      const root = this.getRootNode() as Document | ShadowRoot;
      const target = root.getElementById?.(this.for) ?? null;
      if (target) return target;
    }
    return this.triggerElement ?? null;
  }
  private position(): void {
    const popup = this.renderRoot.querySelector('[part="popup"]') as HTMLElement | null;
    const arrowElement = this.renderRoot.querySelector('[part~="arrow"]') as HTMLElement | null;
    const anchor = this.resolveAnchor();
    if (this.open && anchor && popup) {
      const arrowPadding = Math.max(0, finiteNumber(this.arrowPadding, 0));
      this.cleanup = place(anchor, popup, {
        placement: rtlAwarePlacement(this.placement, this),
        offset: finiteNumber(this.distance, DEFAULT_DISTANCE),
        skidding: finiteNumber(this.skidding, 0),
        arrow: this.arrow && arrowElement ? arrowElement : undefined,
        arrowPadding,
        onPlaced: ({ placement, arrow }) => {
          const side = applyOverlayArrow(arrowElement, {
            placement,
            coords: arrow,
            enabled: this.arrow,
            arrowPlacement: this.arrowPlacement,
            arrowPadding,
            rtl: this.effectiveDirection === 'rtl',
            sizeProperty: '--lr-tooltip-arrow-size',
          });
          if (side !== this.resolvedSide) this.resolvedSide = side;
        },
      });
    }
  }
  private syncTriggerA11y(): void {
    if (!this.triggerElement) return;
    const descriptions = new Set((this.triggerDescription?.value ?? '').split(/\s+/).filter(Boolean));
    if (this.open) descriptions.add(this.descriptionId);
    if (descriptions.size > 0) this.triggerElement.setAttribute('aria-describedby', [...descriptions].join(' '));
    else this.triggerElement.removeAttribute('aria-describedby');
  }
  /** Runs `show()`/`hide()` after the matching delay, replacing whatever was pending. */
  private requestTransition(next: boolean): void {
    this.cancelPendingTransition();
    const delay = next
      ? finiteDuration(this.showDelay, DEFAULT_SHOW_DELAY)
      : finiteDuration(this.hideDelay, DEFAULT_HIDE_DELAY);
    if (delay <= 0) {
      if (next) this.show();
      else this.hide();
      return;
    }
    this.pendingDirection = next ? 'show' : 'hide';
    this.timer = setTimeout(() => {
      this.timer = undefined;
      this.pendingDirection = undefined;
      if (next) this.show();
      else this.hide();
    }, delay);
  }
  private cancelPendingTransition(): void {
    clearTimeout(this.timer);
    this.timer = undefined;
    this.pendingDirection = undefined;
  }
  private bindTrigger(trigger: HTMLElement): void {
    trigger.addEventListener('mouseenter', this.onEnter);
    trigger.addEventListener('mouseleave', this.onLeave);
    trigger.addEventListener('focus', this.onEnter);
    trigger.addEventListener('blur', this.onLeave);
    trigger.addEventListener('click', this.onTriggerClick);
    trigger.addEventListener('keydown', this.onTriggerKeyDown);
  }
  private unbindTrigger(trigger: HTMLElement): void {
    trigger.removeEventListener('mouseenter', this.onEnter);
    trigger.removeEventListener('mouseleave', this.onLeave);
    trigger.removeEventListener('focus', this.onEnter);
    trigger.removeEventListener('blur', this.onLeave);
    trigger.removeEventListener('click', this.onTriggerClick);
    trigger.removeEventListener('keydown', this.onTriggerKeyDown);
  }
  private snapshotTriggerDescription(trigger: HTMLElement): void {
    this.triggerDescription = {
      had: trigger.hasAttribute('aria-describedby'),
      value: trigger.getAttribute('aria-describedby'),
    };
    this.triggerDescriptionObserver ??= new MutationObserver(() => {
      if (!this.triggerElement || !this.triggerDescription) return;
      const current = this.triggerElement.getAttribute('aria-describedby');
      const descriptions = new Set((this.triggerDescription.value ?? '').split(/\s+/).filter(Boolean));
      if (this.open) descriptions.add(this.descriptionId);
      const generated = descriptions.size > 0 ? [...descriptions].join(' ') : null;
      if (current === generated) return;
      this.triggerDescription.had = this.triggerElement.hasAttribute('aria-describedby');
      this.triggerDescription.value = current;
      this.syncTriggerA11y();
    });
    this.triggerDescriptionObserver.observe(trigger, {
      attributes: true,
      attributeFilter: ['aria-describedby'],
    });
  }
  private restoreTriggerDescription(): void {
    if (!this.triggerElement || !this.triggerDescription) return;
    this.triggerDescriptionObserver?.disconnect();
    if (this.triggerDescription.had) {
      this.triggerElement.setAttribute('aria-describedby', this.triggerDescription.value ?? '');
    } else {
      this.triggerElement.removeAttribute('aria-describedby');
    }
    this.triggerDescription = undefined;
  }
  private onTriggerSlotChange = (event: Event): void => {
    const next = (event.target as HTMLSlotElement).assignedElements({ flatten: true })[0] as HTMLElement | undefined;
    if (next === this.triggerElement) return;
    const hadTrigger = this.triggerElement !== undefined;
    // Swapping the slotted trigger (a conditional template, a repeat() re-key)
    // must strip the outgoing element's listeners and stale aria-describedby
    // before adopting the new one -- otherwise the old node keeps driving this
    // tooltip's open state and keeps pointing assistive tech at it.
    this.cancelPendingTransition();
    if (this.triggerElement) {
      this.unbindTrigger(this.triggerElement);
      this.restoreTriggerDescription();
    }
    this.triggerElement = next;
    if (!this.triggerElement) {
      if (hadTrigger && this.open && !this.virtualAnchor && !this.for) this.hide();
      return;
    }
    this.snapshotTriggerDescription(this.triggerElement);
    this.bindTrigger(this.triggerElement);
    this.syncTriggerA11y();
    // An initially-open tooltip reaches its first updated() before slotchange has supplied the
    // trigger, so that update has no anchor to position against. Re-run positioning once the
    // trigger exists, matching the initially-open popover path.
    if (this.open) this.position();
    if (this.open && this.interactiveContent) this.activateTooltipOverlay();
  };
  private onEnter = (event: Event): void => {
    if (event.type === 'focus') {
      if (this.suppressTriggerFocusOpen || !this.opensOn('focus')) return;
    } else if (!this.opensOn('hover')) return;
    this.requestTransition(true);
  };
  private onLeave = (event: Event): void => {
    if (event.type === 'blur' ? !this.opensOn('focus') : !this.opensOn('hover')) return;
    const next = (event as FocusEvent | MouseEvent).relatedTarget;
    if (this.interactiveContent && this.isPopupTarget(next)) return;
    this.requestTransition(false);
  };
  private onTriggerClick = (): void => {
    if (!this.opensOn('click')) return;
    if (this._open) this.hide();
    else this.show();
  };
  private onPopupEnter = (): void => {
    if (!this.interactiveContent || this.isManual) return;
    this.cancelPendingTransition();
    this.show();
  };
  private onPopupLeave = (event: Event): void => {
    if (!this.interactiveContent || this.isManual) return;
    const next = (event as FocusEvent | MouseEvent).relatedTarget;
    if (next instanceof Node && (this.triggerElement?.contains(next) || this.isPopupTarget(next))) return;
    this.requestTransition(false);
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
    if (this.isManual || !this.open || event.key !== 'Escape') return;
    event.preventDefault();
    this.hide();
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
        ${this.arrow ? html`<span part="arrow arrow-${this.resolvedSide}"></span>` : nothing}
      </div>
    `;
  }
}
declare global { interface HTMLElementTagNameMap { 'lr-tooltip': LyraTooltip; } }
