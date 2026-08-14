import {
  html,
  nothing,
  type PropertyValues,
  type TemplateResult,
} from 'lit';
import { property, state } from 'lit/decorators.js';
import type { Placement } from '@floating-ui/dom';
import { LyraElement } from '../../../internal/lyra-element.js';
import { hostAriaLabel, nextId } from '../../../internal/a11y.js';
import {
  place,
  virtualAnchorFromRect,
  type PlaceStrategy,
  type PlaceSync,
  type VirtualAnchor,
} from '../../../internal/positioner.js';
import { rtlAwarePlacement } from '../../../internal/rtl.js';
import { finiteNumber } from '../../../internal/numbers.js';
import {
  omittedEmptyStringConverter,
  trueDefaultBooleanConverter,
} from '../../../internal/converters.js';
import { activateOverlay, type OverlayHandle } from '../../../internal/overlay-manager.js';
import { setCustomState } from '../../../internal/custom-states.js';
import { animateRegistered } from '../../../internal/registered-animation.js';
import { applyOverlayArrow, type LyraArrowPlacement } from './overlay-arrow.js';
import {
  normalizeVirtualRect,
  observeOverlayAnchorIdentity,
  resolveOverlayAnchor,
  type OverlayVirtualRect,
} from './overlay-shared.js';
import { styles } from './overlay.styles.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_menuLabel, LYRA_DEFAULT_popover } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END


/** Default anchor-offset distance (px), passed to Floating UI's `offset()` middleware. */
const DEFAULT_DISTANCE = 8;

/** Semantic role vocabulary for the popup surface. Dropdown subclasses set this to `menu`. */
export type LyraPopupRole = 'dialog' | 'menu';

export type { LyraArrowPlacement, OverlayVirtualRect };

/** The `showAt()` rectangle, shared verbatim with `<lr-tooltip>` (see `./overlay-shared.ts`). */

export interface LyraPopoverEventMap {
  'lr-show': CustomEvent<undefined>;
  'lr-after-show': CustomEvent<undefined>;
  'lr-hide': CustomEvent<undefined>;
  'lr-after-hide': CustomEvent<undefined>;
}

/**
 * `<lr-popover>` — a click-triggered, light-dismiss floating surface.
 *
 * Interaction/ARIA ownership is resolved separately from positioning. A slotted trigger wins and
 * receives the click listener plus `aria-haspopup`, `aria-expanded`, and `aria-controls`; without
 * one, a live HTML element resolved by `for` owns the same contract. A direct `.anchor` is
 * positioning-only. `showAt()`'s virtual anchor wins positioning and deliberately has no DOM
 * interaction/ARIA owner while active.
 * `aria-controls` targets this public host (which receives a stable generated `id` when the
 * consumer did not supply one), not the shadow-private popup. That keeps the relationship
 * resolvable for native triggers and lets `<lr-button>`/`<lr-icon-button>` reflect the host onto
 * their focused shadow-internal controls through `ariaControlsElements`.
 * Live `popupRole`, host-id, target-id, and target-identity changes keep those relationships
 * synchronized. Losing the sole live positioning anchor force-closes the surface; if a slotted or
 * `for` fallback remains, the popover repositions to it and stays open. A deliberate `showAt()`
 * virtual anchor remains open independently of DOM-anchor removal.
 *
 * Lifecycle: `show()` emits `lr-show` (cancelable) and then `lr-after-show` once the popup's
 * transition has finished; `hide()` emits `lr-hide` (cancelable) then `lr-after-hide`. Assigning
 * `open` runs the same sequence, so the property, the reflected attribute and the two methods can
 * never disagree. Markup that renders open from the start emits nothing.
 * Motion resolves through `popover.show`/`popover.hide` in the public animation registry.
 *
 * Positioning resolves `showAt()` virtual anchor, direct `.anchor`, `for`, then the interaction
 * owner, in that order. Thus `anchor` can position against an element that never receives click or
 * ARIA state, while `for` owns both positioning and interaction only when no trigger is slotted.
 *
 * @customElement lr-popover
 * @slot trigger - The highest-priority interaction/ARIA owner; toggles the popover even when
 *   positioning uses `anchor` or `for`.
 * @slot - Popover content.
 * @event lr-show - The popover is about to open. Cancelable — `preventDefault()` keeps it closed.
 * @event lr-after-show - The popover is open and its transition has finished.
 * @event lr-hide - The popover is about to close, for every dismissal path (Escape, light
 *   dismiss, `hide()`, `open = false`). Cancelable — `preventDefault()` keeps it open.
 * @event lr-after-hide - The popover is closed and its transition has finished.
 * @method show - `show(): Promise<void>` — programmatically open and resolve after
 *   `lr-after-show`.
 * @method hide - `hide(options?: { focusTrigger?: boolean }): Promise<void>` — programmatically
 *   close and resolve after `lr-after-hide`. Focus returns to the slotted/`for` interaction owner
 *   by default, matching Escape, light dismiss, and `el.open = false`; pass
 *   `focusTrigger: false` to preserve the current focus instead.
 * @csspart trigger - The trigger wrapper.
 * @csspart popup - The positioned popup; also carries `dialog` and `popup__popup` aliases.
 * @csspart dialog - Mapped alias on the positioned popup.
 * @csspart popup__popup - Exported popup alias on the positioned popup.
 * @csspart content - The content wrapper; also carries the `body` alias.
 * @csspart body - Mapped alias on the content wrapper.
 * @csspart arrow - The arrow element, rendered only when `arrow` is set. Its part name also
 *   carries the resolved side (`arrow-top`, `arrow-bottom`, `arrow-left`, `arrow-right`), so
 *   `::part(arrow arrow-top)` can style one side — state after `::part()` never matches.
 * @csspart popup__arrow - Exported mapped alias on the arrow.
 * @cssprop [--max-width=var(--lr-overlay-max-inline-size,var(--lr-size-20rem))] - Maximum inline
 * size of the popup.
 * @cssprop --lr-overlay-max-inline-size - Retained Lyra fallback for `--max-width`.
 * @cssprop [--arrow-size=var(--lr-overlay-arrow-size,var(--lr-size-0-375rem))] - Half-width of the
 * arrow square.
 * @cssprop --lr-overlay-arrow-size - Retained Lyra fallback for `--arrow-size`.
 * @cssprop [--show-duration=var(--lr-duration-fast)] - Opening transition duration.
 * @cssprop [--hide-duration=var(--lr-duration-fast)] - Closing transition duration.
 * @cssstate open - Present while the popover is open.
 * @status stable
 * @since 4.0.0
 */
export class LyraPopover<Events extends LyraPopoverEventMap = LyraPopoverEventMap> extends LyraElement<Events> {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    menuLabel: LYRA_DEFAULT_menuLabel,
    popover: LYRA_DEFAULT_popover,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  static override styles = [LyraElement.styles, styles];
  private _open = false;
  /** Whether the popover is open. Assigning it runs the full `lr-show`/`lr-hide` lifecycle.
   * @default false */
  @property({ type: Boolean, reflect: true })
  get open(): boolean {
    return this._open;
  }
  set open(next: boolean) {
    const normalized = Boolean(next) && this.canOpen;
    if (normalized === this._open) return;
    // Before the first render this is initial markup state, not a transition.
    if (!this.hasUpdated) {
      this.setOpen(normalized);
      return;
    }
    if (normalized) void this.show();
    else void this.hide();
  }
  @property({ reflect: true }) placement: Placement = 'top';
  /** Anchor-offset distance (px) passed to Floating UI's `offset()` middleware. Can legitimately
   *  be negative (overlaps the popup with the trigger); NaN/non-finite falls back to the default. */
  @property({ type: Number }) distance = 8;
  /** Offset along the anchor's edge, in pixels — Floating UI's cross-axis offset. */
  @property({ type: Number }) skidding = 0;
  /**
   * Id of an element elsewhere in this popover's own root. It participates in positioning behind
   * a direct `.anchor`; when it resolves to a live HTML element and no trigger is slotted, that
   * element also owns click and ARIA. A slotted trigger still wins interaction ownership, and a
   * `showAt()` virtual anchor wins positioning while suppressing every DOM interaction owner.
   */
  private _for = '';
  @property({ reflect: true, converter: omittedEmptyStringConverter })
  get for(): string {
    return this._for;
  }
  set for(next: string | null) {
    this._for = next ?? '';
  }
  /** Positioning-only element anchor. Takes precedence over `for` and the interaction owner, but
   *  never receives click listeners or generated ARIA. */
  @property({ attribute: false }) anchor: Element | null = null;
  /** Render an arrow that points at the anchor. Defaults on for the mapped surface. */
  @property({ type: Boolean, converter: trueDefaultBooleanConverter, reflect: true }) arrow = true;
  /** Positive mapped spelling for suppressing the default arrow. */
  @property({ type: Boolean, attribute: 'without-arrow', reflect: true }) withoutArrow = false;
  /** Where the arrow sits along the popup's edge. `anchor` tracks the anchor's centre. */
  @property({ attribute: 'arrow-placement' }) arrowPlacement: LyraArrowPlacement = 'anchor';
  /** Keeps the arrow this far from the popup's corners, in pixels. */
  @property({ type: Number, attribute: 'arrow-padding' }) arrowPadding = 0;
  /** Accessible name for the semantic popup. An authored host `aria-label` wins by presence,
   *  including an explicitly empty value, before this property or the localized role fallback. */
  @property({ attribute: 'aria-label' }) accessibleLabel = '';
  /** Semantic role used by the popup. Dropdown subclasses set this to `menu`. */
  @property({ attribute: 'popup-role' }) popupRole: LyraPopupRole = 'dialog';
  private trigger?: HTMLElement;
  private slottedTrigger?: HTMLElement;
  @state() private resolvedSide: 'top' | 'bottom' | 'left' | 'right' = 'bottom';
  private anchorPositioned = false;
  private positionedAnchor?: Element | VirtualAnchor;
  private observedDirectAnchor?: Element;
  private observedDirectAnchorWasConnected = false;
  private stopAnchorIdentityObservation?: () => void;
  private triggerA11y?: {
    hasPopup: boolean;
    popup: string | null;
    hasExpanded: boolean;
    expanded: string | null;
    hasControls: boolean;
    controls: string | null;
  };
  private triggerA11yObserver?: MutationObserver;
  private triggerA11yObserverDocument?: Document;
  private triggerA11yObserverGeneration = 0;
  /** The virtual anchor set by `showAt()`, taking priority over `trigger` for positioning while
   *  set. Cleared whenever the popover closes, so a later `open = true` with no fresh `showAt()`
   *  call reverts to plain trigger-based behavior. */
  private virtualAnchor?: VirtualAnchor;
  /** `options.returnFocusTo` from the `showAt()` call that opened the popover, if any -- see
   *  `showAt()`'s doc comment and `activatePopoverOverlay()`'s focus-return configuration. */
  private returnFocusTo?: HTMLElement;
  private cleanup?: () => void;
  /** Registered with the shared overlay manager while every popover is open, so one topmost stack
   *  owns Escape and focus restoration. */
  private overlayHandle?: OverlayHandle;
  private readonly generatedHostId = nextId('popover');
  private readonly popupId = nextId('popover-popup');
  private lightDismissDocument?: Document;
  private hostIdObserver?: MutationObserver;
  private hostIdObserverDocument?: Document;
  private hostIdObserverGeneration = 0;
  /** Invalidates an in-flight `lr-after-*` wait when the opposite transition interrupts it. */
  private transitionToken = 0;
  private transitionAnimation?: Animation;
  private readonly popoverInternals =
    typeof this.attachInternals === 'function' ? this.attachInternals() : undefined;

  /** Subclass seam for mapped overlays whose public distance default differs from the popover. */
  protected get defaultDistance(): number {
    return DEFAULT_DISTANCE;
  }

  /** Positioning hooks for mapped overlays that expose Floating UI's strategy/sync surface. */
  protected get positioningStrategy(): PlaceStrategy {
    return 'fixed';
  }
  protected get positioningSync(): PlaceSync | undefined {
    return undefined;
  }

  /** Registry namespace and token fallbacks are override seams for mapped dropdowns. */
  protected get animationNamespace(): string {
    return 'popover';
  }
  protected animationDurationProperties(showing: boolean): readonly string[] {
    return [showing ? '--show-duration' : '--hide-duration', '--lr-duration-fast'];
  }

  /** Additive part aliases for mapped subclasses. `popup`/`content` remain present. */
  protected get popupPartNames(): string {
    const parts = ['popup', 'dialog', 'popup__popup'];
    return parts.join(' ');
  }
  protected get contentPartNames(): string {
    const parts = ['content', 'body'];
    return parts.join(' ');
  }

  /** Subclasses can retain a different arrow default without forking rendering/positioning. */
  protected get rendersArrow(): boolean {
    return this.arrow && !this.withoutArrow;
  }

  /** Subclass opening invariant, checked for initial property/attribute replay and every later
   * imperative `show()`. Generic popovers are always eligible to open. */
  protected get canOpen(): boolean {
    return true;
  }

  /** Generic popovers project their default slot directly. A mapped subclass can insert an owned
   * interaction controller without replacing the trigger/popup shell. */
  protected renderPopupContent(): unknown {
    return html`<slot></slot>`;
  }

  /** Trigger-key extension point. Generic popovers deliberately retain click-only toggling. */
  protected onTriggerKeyDown(_event: KeyboardEvent): void {}

  /** Lets a mapped subclass include a separate containing element in its dismiss boundary. */
  protected isInsideLightDismissBoundary(path: EventTarget[]): boolean {
    return path.includes(this);
  }

  /** Runs once when a newly opened/re-anchored popup has completed its first placement and is no
   *  longer visibility-hidden. Focus cannot reliably enter a visibility-hidden subtree in Firefox
   *  or WebKit, so autofocus and mapped menu focus wait for this readiness boundary. */
  protected onPopupPositioned(): void {
    this.overlayHandle?.focusAutofocus();
  }

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed);
    const lostDirectAnchorProperty =
      changed.has('anchor')
      && changed.get('anchor') === this.observedDirectAnchor
      && this.observedDirectAnchorWasConnected
      && this.anchor?.isConnected !== true;
    if (lostDirectAnchorProperty && this.open && !this.resolveAnchor()) {
      void this.forceClose({ focusTrigger: false });
    }
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    if (changed.has('for') || changed.has('anchor') || changed.has('open')) {
      this.syncAnchorIdentityObservation();
    }
    if (changed.has('for')) this.syncInteractionTrigger();
    if (
      changed.has('open') ||
      changed.has('placement') ||
      changed.has('distance') ||
      changed.has('skidding') ||
      changed.has('for') ||
      changed.has('anchor') ||
      changed.has('arrow') ||
      changed.has('withoutArrow') ||
      changed.has('arrowPlacement') ||
      changed.has('arrowPadding') ||
      changed.has('popupRole')
    ) {
      this.cleanup?.();
      this.cleanup = undefined;
      if (this.open && this.isConnected) this.positionPopup();
      // Scoped to a real open/close transition -- a placement/distance-only
      // change re-runs this whole block to reposition, but must not toggle the
      // document listener when `open` itself didn't change. The lifecycle
      // events themselves are emitted from show()/hide(), before the state flips.
      if (changed.has('open')) {
        if (this.open) {
          if (this.isConnected) {
            this.startLightDismiss();
            this.activatePopoverOverlay();
          }
        } else {
          this.positionedAnchor = undefined;
          this.anchorPositioned = false;
          this.stopLightDismiss();
          this.overlayHandle?.deactivate();
          this.overlayHandle = undefined;
          this.virtualAnchor = undefined;
          this.returnFocusTo = undefined;
          this.syncInteractionTrigger();
        }
      }
      if (this.isConnected) this.syncTriggerA11y();
    }
  }
  override connectedCallback(): void {
    super.connectedCallback();
    this.syncAnchorIdentityObservation();
    if (!this.id) this.id = this.generatedHostId;
    this.observeHostId();
    this.syncInteractionTrigger();
    // A reconnect (e.g. a drag-and-drop reparent keeping this same element
    // instance) fires disconnectedCallback then connectedCallback
    // synchronously with no update in between, so updated() never reruns to
    // notice `open` is still true -- restore the light-dismiss listener and
    // the Floating UI positioner subscription it dropped. No lifecycle event is
    // emitted: reconnecting an already-open popover is not an open transition,
    // and `lr-show` was already announced when `open` became true.
    if (this.hasUpdated && this.open) {
      const wasPreviouslyActivated = this.overlayHandle?.isActive() === true;
      this.startLightDismiss();
      if (wasPreviouslyActivated) this.overlayHandle!.resume();
      else this.activatePopoverOverlay();
      this.positionPopup();
    }
  }
  override disconnectedCallback(): void {
    this.stopAnchorIdentityObservation?.();
    this.stopAnchorIdentityObservation = undefined;
    this.cleanup?.();
    this.cleanup = undefined;
    this.stopLightDismiss();
    this.resetHostIdObserver();
    this.overlayHandle?.suspend();
    this.trigger?.removeEventListener('click', this.onTriggerClick);
    this.restoreTriggerA11y();
    this.trigger = undefined;
    // A pending after-event must not announce a transition the detached element left behind.
    this.transitionToken++;
    this.cancelTransitionAnimation();
    this.removeAttribute('data-closing');
    super.disconnectedCallback();
  }

  adoptedCallback(): void {
    this.stopAnchorIdentityObservation?.();
    this.stopAnchorIdentityObservation = undefined;
    this.resetHostIdObserver();
    this.resetTriggerA11yObserver();
  }
  private syncAnchorIdentityObservation(): void {
    this.stopAnchorIdentityObservation?.();
    this.stopAnchorIdentityObservation = undefined;
    // A `for` target can be inserted or replaced while closed and owns interaction, so it remains
    // observable. A direct anchor has no interaction contract and only needs structural tracking
    // while an open surface is actively positioned against it. Slotted triggers use slotchange.
    const directAnchor = this.open ? (this.anchor ?? undefined) : undefined;
    this.observedDirectAnchor = directAnchor;
    this.observedDirectAnchorWasConnected = directAnchor?.isConnected === true;
    if (!this.isConnected || (!this.for && !directAnchor)) return;

    const onIdentityChange = (): void => {
      const directAnchorRemoved =
        this.anchor === this.observedDirectAnchor
        && this.observedDirectAnchorWasConnected
        && this.observedDirectAnchor?.isConnected === false;
      this.observedDirectAnchorWasConnected = this.observedDirectAnchor?.isConnected === true;
      this.syncInteractionTrigger();
      if (!this.open) return;
      const nextAnchor = this.resolveAnchor();
      if (directAnchorRemoved && !nextAnchor) {
        void this.forceClose({ focusTrigger: false });
        return;
      }
      if (nextAnchor !== this.positionedAnchor) this.positionPopup();
    };
    const observedRoots = new Set<Node>([this]);
    if (directAnchor && directAnchor.getRootNode() !== this.getRootNode()) {
      observedRoots.add(directAnchor.isConnected ? directAnchor : directAnchor.ownerDocument);
    }
    const cleanups = [...observedRoots].map((root) =>
      observeOverlayAnchorIdentity(root, onIdentityChange));
    this.stopAnchorIdentityObservation = () => {
      for (const cleanup of cleanups) cleanup();
    };
  }

  private resolveForTrigger(): HTMLElement | undefined {
    if (!this.for) return undefined;
    const root = this.getRootNode() as Document | ShadowRoot;
    const target = root.getElementById?.(this.for) ?? null;
    const HTMLElementCtor = target?.ownerDocument.defaultView?.HTMLElement;
    return target && HTMLElementCtor && target instanceof HTMLElementCtor ? target : undefined;
  }

  private syncInteractionTrigger(): void {
    const next = this.virtualAnchor ? undefined : (this.slottedTrigger ?? this.resolveForTrigger());
    if (next === this.trigger) return;
    const previous = this.trigger;
    if (previous) {
      previous.removeEventListener('click', this.onTriggerClick);
      this.restoreTriggerA11y();
    }
    this.trigger = next;
    if (this.trigger) {
      this.snapshotTriggerA11y(this.trigger);
      if (this.trigger !== this.slottedTrigger) this.trigger.addEventListener('click', this.onTriggerClick);
      this.syncTriggerA11y();
    }
    if (this.open) {
      if (!this.resolveAnchor()) {
        void this.forceClose({ focusTrigger: false });
        return;
      }
      this.updatePopoverRestoreFocusTarget();
      this.positionPopup();
    }
  }
  /** Registers every open popover with the shared, topmost-stack-aware overlay manager. Popovers
   *  remain nonmodal and non-focus-trapping; the manager owns Escape and restoration to the
   *  trigger (or a virtual anchor's explicit `returnFocusTo`). */
  private activatePopoverOverlay(): void {
    if (!this.isConnected || this.overlayHandle?.isActive()) return;
    this.overlayHandle = activateOverlay({
      host: this,
      panel: () => this.renderRoot.querySelector('[part~="popup"]') as HTMLElement | null,
      onEscape: () => void this.hide(),
      restoreFocusTo: this.virtualAnchor ? (this.returnFocusTo ?? null) : (this.trigger ?? null),
      modal: false,
      trapFocus: false,
    });
  }

  /** Updates the eventual focus-return target without changing this popover's overlay-stack
   *  identity. Re-registering would promote an underlying popover above a newer overlay and, when
   *  this popover is already topmost, briefly move focus into the overlay underneath. */
  private updatePopoverRestoreFocusTarget(): void {
    const target = this.virtualAnchor ? (this.returnFocusTo ?? null) : (this.trigger ?? null);
    if (this.overlayHandle?.isActive()) {
      this.overlayHandle.updateRestoreFocusTo(target);
      return;
    }
    this.activatePopoverOverlay();
  }
  /**
   * Opens the popover anchored to an arbitrary rectangle instead of any DOM anchor -- for
   * anchoring to a graph node, a canvas pixel, a chart datum, or any other non-DOM location.
   * `width`/`height` default to `0` (a point). Positions exactly as `place()` would against a real
   * element (flip/shift/RTL all apply unchanged).
   *
   * A virtual anchor has no DOM node, so `autoUpdate()` can't track it moving on its own -- call
   * `showAt()` again with fresh coordinates to re-anchor an already-open popover (e.g. on a graph
   * pan/zoom tick); the popover stays open across such a call, it does not toggle. Pass
   * `rect.contextElement` (a real, still-connected element near the virtual point) when available
   * so `autoUpdate()` has something to observe for ancestor-scroll/resize tracking; omitting it
   * still works, it just means only explicit re-`showAt()` calls keep the popover anchored.
   *
   * While the virtual anchor is active, no slotted/`for` element owns click or generated ARIA.
   * A virtual anchor also has no `.focus()`. Escape, light dismiss, and programmatic close return
   * focus to `options.returnFocusTo` when supplied, or skip focus-return entirely otherwise --
   * refocusing the right place after a virtual anchor closes is the host's responsibility, since
   * Lyra can't assume how e.g. a graph node's own keyboard model wants focus back.
   * Non-finite coordinates or dimensions are ignored and leave the current open/anchor state
   * unchanged.
   */
  showAt(
    rect: OverlayVirtualRect,
    options?: { returnFocusTo?: HTMLElement },
  ): void {
    const normalizedRect = normalizeVirtualRect(rect);
    if (!normalizedRect) return;
    const previousAnchor = this.virtualAnchor;
    const previousReturnFocusTo = this.returnFocusTo;
    this.virtualAnchor = virtualAnchorFromRect(normalizedRect);
    this.returnFocusTo = options?.returnFocusTo;
    this.syncInteractionTrigger();
    if (this.open) {
      this.updatePopoverRestoreFocusTarget();
      this.positionPopup();
      return;
    }
    void this.show();
    if (this.open) return;
    this.virtualAnchor = previousAnchor;
    this.returnFocusTo = previousReturnFocusTo;
    this.syncInteractionTrigger();
  }
  /** Resolves what the popup is positioned against: an explicit virtual anchor first, then the
   *  direct `anchor`, then the `for` idref, then the slotted trigger. Shared with `<lr-tooltip>`,
   *  which resolves the identical chain. */
  private resolveAnchor(): Element | VirtualAnchor | null {
    return resolveOverlayAnchor(this, {
      virtualAnchor: this.virtualAnchor,
      anchor: this.anchor,
      for: this.for,
      trigger: this.trigger,
    });
  }
  protected positionPopup(): void {
    this.cleanup?.();
    this.cleanup = undefined;
    const popup = this.renderRoot.querySelector('[part~="popup"]') as HTMLElement | null;
    const arrowElement = this.renderRoot.querySelector('[part~="arrow"]') as HTMLElement | null;
    const anchor = this.resolveAnchor();
    if (!this.open || !anchor || !popup) {
      this.positionedAnchor = undefined;
      this.anchorPositioned = false;
      popup?.setAttribute('data-hidden', '');
      return;
    }
    if (anchor !== this.positionedAnchor) {
      this.anchorPositioned = false;
      popup.setAttribute('data-hidden', '');
    }
    this.cleanup = place(anchor, popup, {
      placement: rtlAwarePlacement(this.placement, this),
      strategy: this.positioningStrategy,
      offset: finiteNumber(this.distance, this.defaultDistance),
      skidding: finiteNumber(this.skidding, 0),
      sync: this.positioningSync,
      arrow: this.rendersArrow && arrowElement ? arrowElement : undefined,
      arrowPadding: Math.max(0, finiteNumber(this.arrowPadding, 0)),
      onPlaced: ({ placement, arrow }) => {
        const becamePositioned = !this.anchorPositioned || this.positionedAnchor !== anchor;
        this.positionedAnchor = anchor;
        this.anchorPositioned = true;
        if (this.open && this.resolveAnchor() === anchor) {
          popup.removeAttribute('data-hidden');
          if (becamePositioned) this.onPopupPositioned();
        }
        const side = applyOverlayArrow(arrowElement, {
          placement,
          coords: arrow,
          enabled: this.rendersArrow,
          arrowPlacement: this.arrowPlacement,
          arrowPadding: Math.max(0, finiteNumber(this.arrowPadding, 0)),
          rtl: this.effectiveDirection === 'rtl',
          sizeProperty: '--arrow-size',
          fallbackSizeProperty: '--lr-overlay-arrow-size',
        });
        if (side !== this.resolvedSide) this.resolvedSide = side;
      },
    });
  }
  private syncTriggerA11y(): void {
    if (!this.trigger) return;
    const expanded = this.open ? 'true' : 'false';
    if (this.trigger.getAttribute('aria-haspopup') !== this.popupRole) {
      this.trigger.setAttribute('aria-haspopup', this.popupRole);
    }
    if (this.trigger.getAttribute('aria-expanded') !== expanded) {
      this.trigger.setAttribute('aria-expanded', expanded);
    }
    if (this.trigger.getAttribute('aria-controls') !== this.generatedControls) {
      this.trigger.setAttribute('aria-controls', this.generatedControls);
    }
  }
  private get generatedControls(): string {
    const controls = new Set((this.triggerA11y?.controls ?? '').split(/\s+/).filter(Boolean));
    // The trigger lives in this component's light DOM, so a string IDREF cannot resolve the
    // shadow-private popup. Point at the public host, matching lr-menu's trigger contract.
    controls.add(this.id);
    return [...controls].join(' ');
  }
  private snapshotTriggerA11y(trigger: HTMLElement): void {
    this.triggerA11y = {
      hasPopup: trigger.hasAttribute('aria-haspopup'),
      popup: trigger.getAttribute('aria-haspopup'),
      hasExpanded: trigger.hasAttribute('aria-expanded'),
      expanded: trigger.getAttribute('aria-expanded'),
      hasControls: trigger.hasAttribute('aria-controls'),
      controls: trigger.getAttribute('aria-controls'),
    };
    this.resetTriggerA11yObserver();
    const ownerDocument = this.ownerDocument;
    const MutationObserverCtor = ownerDocument.defaultView?.MutationObserver;
    if (!MutationObserverCtor) return;
    const generation = this.triggerA11yObserverGeneration;
    const observer = new MutationObserverCtor((records) => {
      if (
        this.triggerA11yObserver !== observer ||
        this.triggerA11yObserverDocument !== ownerDocument ||
        this.triggerA11yObserverGeneration !== generation ||
        !this.isConnected ||
        this.ownerDocument !== ownerDocument ||
        this.trigger !== trigger
      ) {
        return;
      }
      if (!this.trigger || !this.triggerA11y) return;
      let authorChanged = false;
      for (const { attributeName } of records) {
        if (!attributeName) continue;
        const current = this.trigger.getAttribute(attributeName);
        const generated =
          attributeName === 'aria-haspopup'
            ? this.popupRole
            : attributeName === 'aria-expanded'
              ? this.open
                ? 'true'
                : 'false'
              : this.generatedControls;
        if (current === generated) continue;
        authorChanged = true;
        const had = this.trigger.hasAttribute(attributeName);
        if (attributeName === 'aria-haspopup') {
          this.triggerA11y.hasPopup = had;
          this.triggerA11y.popup = current;
        } else if (attributeName === 'aria-expanded') {
          this.triggerA11y.hasExpanded = had;
          this.triggerA11y.expanded = current;
        } else {
          this.triggerA11y.hasControls = had;
          this.triggerA11y.controls = current;
        }
      }
      if (authorChanged) this.syncTriggerA11y();
    });
    this.triggerA11yObserver = observer;
    this.triggerA11yObserverDocument = ownerDocument;
    observer.observe(trigger, {
      attributes: true,
      attributeFilter: ['aria-haspopup', 'aria-expanded', 'aria-controls'],
    });
  }
  private restoreTriggerA11y(): void {
    if (!this.trigger || !this.triggerA11y) return;
    this.resetTriggerA11yObserver();
    const restore = (name: string, had: boolean, value: string | null): void => {
      if (had) this.trigger!.setAttribute(name, value ?? '');
      else this.trigger!.removeAttribute(name);
    };
    restore('aria-haspopup', this.triggerA11y.hasPopup, this.triggerA11y.popup);
    restore('aria-expanded', this.triggerA11y.hasExpanded, this.triggerA11y.expanded);
    restore('aria-controls', this.triggerA11y.hasControls, this.triggerA11y.controls);
    this.triggerA11y = undefined;
  }

  private resetTriggerA11yObserver(): void {
    this.triggerA11yObserverGeneration += 1;
    this.triggerA11yObserver?.disconnect();
    this.triggerA11yObserver = undefined;
    this.triggerA11yObserverDocument = undefined;
  }
  private onTriggerSlotChange = (event: Event): void => {
    const next = (event.target as HTMLSlotElement).assignedElements({ flatten: true })[0] as HTMLElement | undefined;
    if (next === this.slottedTrigger) return;
    this.slottedTrigger = next;
    this.syncInteractionTrigger();
  };
  private onTriggerClick = (): void => {
    if (this.virtualAnchor) return;
    if (this.open) void this.hide();
    else void this.show();
  };
  private onPopupClick = (event: MouseEvent): void => {
    if (event.defaultPrevented) return;
    const path = event.composedPath();
    const hostIndex = path.indexOf(this);
    if (hostIndex < 0) return;
    const closeAction = path.slice(0, hostIndex).find(
      (target): target is HTMLElement =>
        (target as Node).nodeType === 1
        && (target as HTMLElement).getAttribute('data-popover') === 'close',
    );
    if (!closeAction) return;
    // The closest owning surface consumes the declarative action even when its own hide is vetoed;
    // an ancestor popover must never interpret the same activation as its close request.
    event.stopPropagation();
    const state = closeAction as HTMLElement & { disabled?: boolean; effectiveDisabled?: boolean };
    if (
      state.effectiveDisabled === true
      || state.disabled === true
      || closeAction.hasAttribute('disabled')
      || closeAction.getAttribute('aria-disabled')?.trim().toLowerCase() === 'true'
      || closeAction.hasAttribute('inert')
      || closeAction.closest('[inert]')
    ) return;
    void this.hide();
  };
  private onDocumentPointer = (event: PointerEvent): void => {
    if (!this.overlayHandle?.isTopmost()) return;
    if (!this.isInsideLightDismissBoundary(event.composedPath())) void this.hide();
  };

  private startLightDismiss(): void {
    const nextDocument = this.ownerDocument;
    if (this.lightDismissDocument === nextDocument) return;
    this.stopLightDismiss();
    nextDocument.addEventListener('pointerdown', this.onDocumentPointer);
    this.lightDismissDocument = nextDocument;
  }

  private stopLightDismiss(): void {
    this.lightDismissDocument?.removeEventListener('pointerdown', this.onDocumentPointer);
    this.lightDismissDocument = undefined;
  }

  private observeHostId(): void {
    const ownerDocument = this.ownerDocument;
    if (this.hostIdObserver && this.hostIdObserverDocument === ownerDocument) return;
    this.resetHostIdObserver();
    const MutationObserverCtor = ownerDocument.defaultView?.MutationObserver;
    if (!MutationObserverCtor || !this.isConnected) return;
    const generation = this.hostIdObserverGeneration;
    const observer = new MutationObserverCtor(() => {
      if (
        this.hostIdObserver !== observer ||
        this.hostIdObserverDocument !== ownerDocument ||
        this.hostIdObserverGeneration !== generation ||
        !this.isConnected ||
        this.ownerDocument !== ownerDocument
      ) {
        return;
      }
      if (!this.id) this.id = this.generatedHostId;
      this.syncTriggerA11y();
    });
    this.hostIdObserver = observer;
    this.hostIdObserverDocument = ownerDocument;
    observer.observe(this, { attributes: true, attributeFilter: ['id'] });
  }

  private resetHostIdObserver(): void {
    this.hostIdObserverGeneration += 1;
    this.hostIdObserver?.disconnect();
    this.hostIdObserver = undefined;
    this.hostIdObserverDocument = undefined;
  }

  private setOpen(next: boolean): void {
    if (this._open === next) return;
    const old = this._open;
    this._open = next;
    setCustomState(this.popoverInternals, 'open', next);
    this.requestUpdate('open', old);
  }

  /** A vetoed transition must leave the reflected attribute agreeing with the property; Lit only
   *  reflects properties it saw change. */
  private syncOpenAttribute(): void {
    this.toggleAttribute('open', this._open);
  }

  /** Open the popover. Emits `lr-show` first — vetoing it leaves the popover closed — and
   *  `lr-after-show` once the popup's transition has finished. */
  show(): Promise<void> {
    if (this._open || !this.canOpen) return Promise.resolve();
    if (this.emitCancelableLifecycle('lr-show').defaultPrevented) {
      this.syncOpenAttribute();
      return Promise.resolve();
    }
    this.cancelTransitionAnimation();
    this.removeAttribute('data-closing');
    this.setOpen(true);
    return this.settleTransition('lr-after-show');
  }

  /** Programmatically close the popover and return focus to its trigger by default, matching
   *  Escape, light dismiss, and a bare `el.open = false`. Pass `{ focusTrigger: false }` to opt
   *  out and leave focus where it is. Virtual anchors restore their explicit `returnFocusTo`.
   *  Emits `lr-hide` first — vetoing it leaves the popover open — then `lr-after-hide`. */
  hide(options?: { focusTrigger?: boolean }): Promise<void> {
    if (!this._open) return Promise.resolve();
    if (this.emitCancelableLifecycle('lr-hide').defaultPrevented) {
      this.syncOpenAttribute();
      return Promise.resolve();
    }
    return this.forceClose(options);
  }

  /** The close half of `hide()` without the veto point, for structural teardown that leaves an
   *  open surface with no live positioning anchor. */
  private forceClose(options?: { focusTrigger?: boolean }): Promise<void> {
    if (!this._open) return Promise.resolve();
    if (options?.focusTrigger === false) {
      this.overlayHandle?.deactivate({ restoreFocus: false });
      this.overlayHandle = undefined;
    }
    this.cancelTransitionAnimation();
    if (this.isConnected) this.setAttribute('data-closing', '');
    this.setOpen(false);
    return this.settleTransition('lr-after-hide');
  }

  private cancelTransitionAnimation(): void {
    this.transitionAnimation?.cancel();
    this.transitionAnimation = undefined;
  }

  /**
   * `emit()` pinned to this class's own base event map.
   *
   * `Events` is a type parameter here so `<lr-dropdown>` can widen the map, which leaves
   * `LyraEmitArgs<Events, K>` an unresolved conditional type that no concrete argument list can be
   * checked against. The `Events extends LyraPopoverEventMap` constraint already guarantees these
   * four lifecycle events keep their detail-less shape, so resolve them against the base map.
   */
  private emitCancelableLifecycle(
    name: 'lr-show' | 'lr-hide',
  ): CustomEvent<undefined> {
    return (this as LyraPopover<LyraPopoverEventMap>).emit(name, undefined, { cancelable: true });
  }

  private emitSettledLifecycle(
    name: 'lr-after-show' | 'lr-after-hide',
  ): CustomEvent<undefined> {
    return (this as LyraPopover<LyraPopoverEventMap>).emit(name);
  }

  /** Resolves once the registry-backed popup animation has finished, then emits the matching
   * `lr-after-*` event. A disabled registration retains the lifecycle without native motion. */
  private async settleTransition(event: 'lr-after-show' | 'lr-after-hide'): Promise<void> {
    const token = ++this.transitionToken;
    await this.updateComplete;
    if (this.transitionToken !== token) return;
    if (this.isConnected) {
      const popup = this.renderRoot.querySelector<HTMLElement>('[part~="popup"]');
      const showing = event === 'lr-after-show';
      const offset = 'translateY(var(--lr-size-neg-0-25rem))';
      const animation = popup
        ? animateRegistered(
            this,
            popup,
            `${this.animationNamespace}.${showing ? 'show' : 'hide'}`,
            this.effectiveDirection,
            {
              keyframes: showing
                ? [{ opacity: 0, transform: offset }, { opacity: 1, transform: 'translateY(0)' }]
                : [{ opacity: 1, transform: 'translateY(0)' }, { opacity: 0, transform: offset }],
              durationProperties: this.animationDurationProperties(showing),
              easingProperties: ['--lr-easing-standard'],
            },
          )
        : undefined;
      this.transitionAnimation = animation;
      await animation?.finished.catch(() => undefined);
      if (this.transitionToken !== token) return;
      this.cancelTransitionAnimation();
    }
    if (event === 'lr-after-hide') this.removeAttribute('data-closing');
    this.emitSettledLifecycle(event);
  }

  override render(): TemplateResult {
    // The accessible-name fallback follows the popup's actual semantic role --
    // a `popupRole="menu"` popup (e.g. <lr-dropdown>) is announced as a menu,
    // not as a generic "Popover", so its translation is looked up under the
    // same key <lr-menu> uses for its own default name.
    const label = hostAriaLabel(this) ?? (
      this.accessibleLabel || this.localize(this.popupRole === 'menu' ? 'menuLabel' : 'popover')
    );
    return html`
      <span part="trigger" @click=${this.onTriggerClick} @keydown=${this.onTriggerKeyDown}>
        <slot name="trigger" @slotchange=${this.onTriggerSlotChange}></slot>
      </span>
      <div id=${this.popupId} part=${this.popupPartNames} role=${this.popupRole} aria-label=${label}
        ?data-hidden=${!this.open || !this.anchorPositioned} ?data-has-arrow=${this.rendersArrow}
        @click=${this.onPopupClick}>
        <div part=${this.contentPartNames}>${this.renderPopupContent()}</div>
        ${this.rendersArrow
          ? html`<span part="arrow popup__arrow arrow-${this.resolvedSide}"></span>`
          : nothing}
      </div>
    `;
  }
}
declare global { interface HTMLElementTagNameMap { 'lr-popover': LyraPopover; } }
