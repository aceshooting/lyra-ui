import {
  html,
  nothing,
  type PropertyValues,
  type TemplateResult,
} from 'lit';
import { property, state } from 'lit/decorators.js';
import type { Placement } from '@floating-ui/dom';
import { LyraElement } from '../../../internal/lyra-element.js';
import {
  isAccessibilitySubtreeExcluded,
  isAccessibilityVisibilityHidden,
  nextId,
  resolveAccessibleTrigger,
} from '../../../internal/a11y.js';
import {
  acquireAriaOwnership,
  type AriaOwnershipLease,
} from '../../../internal/aria-ownership.js';
import { isActionableElement } from '../../../internal/focus-navigation.js';
import { place, virtualAnchorFromRect, type VirtualAnchor } from '../../../internal/positioner.js';
import { rtlAwarePlacement } from '../../../internal/rtl.js';
import { finiteDuration, finiteNumber } from '../../../internal/numbers.js';
import {
  omittedEmptyStringConverter,
  trueDefaultBooleanConverter,
} from '../../../internal/converters.js';
import { activateOverlay, composedContains, type OverlayHandle } from '../../../internal/overlay-manager.js';
import { animateRegistered } from '../../../internal/registered-animation.js';
import { composedAccessibilityTextResult } from '../../../internal/accessibility-visibility.js';
import { applyOverlayArrow, type LyraArrowPlacement } from './overlay-arrow.js';
import {
  normalizeVirtualRect,
  observeOverlayAnchorIdentity,
  OverlayTransitionGate,
  resolveOverlayAnchor,
  type OverlayVirtualRect,
} from './overlay-shared.js';
import { tooltipStyles } from './overlay.styles.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_popover } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END


/** Default delay (ms) before an interaction opens the tooltip. */
const DEFAULT_SHOW_DELAY = 150;
/** Default delay (ms) before an interaction closes it again — none, so leaving is immediate. */
const DEFAULT_HIDE_DELAY = 0;
/** Default anchor-offset distance (px), passed to Floating UI's `offset()` middleware -- same
 *  semantics as `<lr-popover>.distance` (both wrap the same `place()`/`offset()` middleware). */
const DEFAULT_DISTANCE = 8;
/** `attachShadow()` itself is not observable. A short grace window catches custom elements that
 * attach an open root during upgrade/initialization without polling forever when a legitimate
 * custom element intentionally remains in the light DOM. */
const MAX_SHADOW_CONTENT_SCAN_FRAMES = 4;

/** One keyword of the space-separated `trigger` list. */
export type LyraTooltipTrigger = 'hover' | 'focus' | 'click' | 'manual';

export type { LyraArrowPlacement, OverlayVirtualRect };

/** The `showAt()` rectangle, shared verbatim with `<lr-popover>` (see `./overlay-shared.ts`). */

type TooltipContentSnapshot = {
  actionable: boolean;
  assigned: boolean;
  awaitingShadowRoot: boolean;
  labelReferenceRoots: Set<Document | ShadowRoot>;
  text: string;
  externalRoots: Set<Node>;
  shadowRoots: Set<ShadowRoot>;
  forwardingSlots: Set<HTMLSlotElement>;
  composedAncestors: Set<Element>;
};

export interface LyraTooltipEventMap {
  'lr-show': CustomEvent<null>;
  'lr-after-show': CustomEvent<null>;
  'lr-hide': CustomEvent<null>;
  'lr-after-hide': CustomEvent<null>;
}

/**
 * `<lr-tooltip>` — a localized tooltip for a consumer-owned trigger. It accepts both mapped
 * light-DOM shapes without ambiguity: a Web Awesome-style named `trigger` plus default content,
 * or a Shoelace-style default trigger plus `content`/`slot="content"` content.
 * Plain content uses tooltip semantics. When the active content slot contains an actionable descendant
 * (including native controls, authored sequential focus stops, explicit ARIA widgets, and controls
 * inside a nested custom element's open shadow root), the popup promotes to a named
 * dialog and remains open while pointer or focus is inside so its controls can be reached. Escape
 * from popup content closes it and restores focus to the trigger. Prefer `<lr-popover>` when
 * click-to-open ownership is desired.
 * Forwarding slots are followed through their live composed assignments: reassignment, descendant
 * text/actionability changes, and restoration of a forwarding slot's fallback all update the
 * description and popup role. Image alternatives and bounded, cycle-safe `aria-labelledby`
 * traversal participate too; referenced roots are observed for text and identity changes even
 * when a target is external or not yet present. A host `aria-label` wins by attribute presence, so
 * an explicit empty label suppresses both derived content text and the localized actionable-popup
 * fallback.
 *
 * Interaction/ARIA ownership is independent of positioning. A slotted trigger wins; without one,
 * a live HTML element resolved by `for` receives the configured interaction listeners and
 * `aria-describedby`. A direct `.anchor` is positioning-only. `showAt()`'s virtual anchor wins
 * positioning and deliberately has no DOM interaction/ARIA owner while active. Losing the sole
 * live positioning anchor force-closes the tooltip, while a remaining slotted/`for` fallback is
 * rebound and keeps the tooltip open.
 *
 * `trigger` is a space-separated list of `hover`, `focus`, `click` and `manual`, defaulting to
 * `"hover focus"`. `manual` (in the list, or the standalone `manual` boolean) means only
 * `show()`/`hide()`/`open` move it. `show-delay` and `hide-delay` are independent, so a tooltip
 * can linger after the pointer leaves without also being slow to appear.
 * Motion resolves through `tooltip.show`/`tooltip.hide` in the public animation registry.
 * Content/trigger observers and delayed transitions bind to the current owner window; disconnect
 * and cross-document adoption cancel the old realm before reconnect creates replacements.
 *
 * While open, the trigger's `aria-describedby` targets a hidden text proxy in this component's
 * light DOM rather than the shadow-private popup. Native triggers can resolve that ID directly.
 * A description is only announced on the node that actually holds focus, so a custom-element
 * trigger also has the proxy applied to its first focusable descendant (through slots and nested
 * open shadow roots) — reaching `<lr-select>`, `<lr-switch>`, `<lr-chip>` and consumer-authored
 * wrappers, not only the components that forward their own host `aria-describedby`. Descendants
 * inside a shadow root are linked through `ariaDescribedByElements`, where the serialized internal
 * attribute is intentionally empty; descriptions the control already had are kept and restored.
 * Bubbling `focusin`/`focusout` observes those real composed targets, and moving focus within the
 * trigger or between interactive popup controls does not spuriously close the tooltip.
 *
 * @customElement lr-tooltip
 * @slot trigger - Web Awesome shape: the highest-priority interaction/ARIA owner.
 * @slot - Web Awesome shape: tooltip content; Shoelace shape: the trigger when no named trigger
 *   is present.
 * @slot content - Shoelace shape: tooltip content when the default slot owns the trigger.
 * @event lr-show - The tooltip is about to open. Cancelable — `preventDefault()` keeps it closed.
 * @event lr-after-show - The tooltip is open and its transition has finished.
 * @event lr-hide - The tooltip is about to close. Cancelable — `preventDefault()` keeps it open.
 * @event lr-after-hide - The tooltip is closed and its transition has finished.
 * @method show - `show(): Promise<void>` — open immediately and settle after `lr-after-show`.
 * @method hide - `hide(): Promise<void>` — close immediately and settle after `lr-after-hide`.
 * @csspart trigger - The trigger wrapper.
 * @csspart base - Compatibility name for the tooltip popup wrapper; it is the same node as
 *   `tooltip`.
 * @csspart tooltip - The tooltip popup wrapper. It is the same node as `base`.
 * @csspart popup - The tooltip popup. It is the same node as `base` and `tooltip`.
 * @csspart base__popup - Shoelace exported popup alias on the same node.
 * @csspart body - Tooltip content wrapper.
 * @csspart arrow - The arrow element, rendered only when `arrow` is set. Its part name also
 *   carries the resolved side (`arrow-top`, `arrow-bottom`, `arrow-left`, `arrow-right`).
 * @csspart base__arrow - Shoelace exported alias on the arrow.
 * @cssprop [--max-width=var(--lr-tooltip-max-inline-size,var(--lr-size-20rem))] - Maximum inline
 * size of the tooltip.
 * @cssprop --lr-tooltip-max-inline-size - Retained Lyra fallback for `--max-width`.
 * @cssprop --lr-tooltip-background - Tooltip background color (default `--lr-color-neutral`).
 * @cssprop --lr-tooltip-color - Tooltip text color (default `--lr-color-on-neutral`).
 * @cssprop [--arrow-size=var(--lr-tooltip-arrow-size,var(--lr-size-0-375rem))] - Half-width of the
 * arrow square.
 * @cssprop --lr-tooltip-arrow-size - Retained Lyra fallback for `--arrow-size`.
 * @cssprop [--show-delay=150ms] - Interaction show delay when `show-delay` is not explicit.
 * @cssprop [--hide-delay=0ms] - Interaction hide delay when `hide-delay` is not explicit.
 * @status stable
 * @since 4.0.0
 */
export class LyraTooltip extends LyraElement<LyraTooltipEventMap> {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    popover: LYRA_DEFAULT_popover,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  static override styles = [LyraElement.styles, tooltipStyles];
  private _open = false;
  /** Whether the tooltip is open. Assigning it runs the full `lr-show`/`lr-hide` lifecycle;
   *  assigning `false` also cancels a delayed open that has not fired yet.
   *  @default false */
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
  @property({ type: Number, attribute: 'show-delay' }) showDelay = 150;
  /** Delay (ms) before an interaction closes the tooltip again. `0` by default, so leaving the
   *  trigger closes it at once. */
  @property({ type: Number, attribute: 'hide-delay' }) hideDelay = 0;
  @property({ reflect: true }) placement: Placement = 'top';
  /** Anchor-offset distance (px) passed to Floating UI's `offset()` middleware -- identical
   *  semantics to `<lr-popover>.distance` (can legitimately be negative for overlap). */
  @property({ type: Number }) distance = 8;
  /** Offset along the anchor's edge, in pixels — Floating UI's cross-axis offset. */
  @property({ type: Number }) skidding = 0;
  /**
   * Id of an element elsewhere in this tooltip's own root. It participates in positioning behind
   * a direct `.anchor`; when it resolves to a live HTML element and no trigger is slotted, that
   * element also owns the configured interactions and `aria-describedby`. A slotted trigger wins
   * interaction ownership, while `showAt()` wins positioning and suppresses every DOM owner.
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
   *  never receives interaction listeners or generated ARIA. */
  @property({ attribute: false }) anchor: Element | null = null;
  /** Prevents interaction/programmatic opening and closes an open tooltip. */
  @property({ type: Boolean, reflect: true }) disabled = false;
  /** Uses viewport-fixed positioning instead of the containing-block default. */
  @property({ type: Boolean, reflect: true }) hoist = false;
  /** Render an arrow that points at the anchor. Defaults on for mapped tooltip markup. */
  @property({ type: Boolean, converter: trueDefaultBooleanConverter, reflect: true }) arrow = true;
  /** Positive mapped spelling for suppressing the default arrow. */
  @property({ type: Boolean, attribute: 'without-arrow', reflect: true }) withoutArrow = false;
  /** Where the arrow sits along the popup's edge. `anchor` tracks the anchor's centre. */
  @property({ attribute: 'arrow-placement' }) arrowPlacement: LyraArrowPlacement = 'anchor';
  /** Keeps the arrow this far from the popup's corners, in pixels. */
  @property({ type: Number, attribute: 'arrow-padding' }) arrowPadding = 0;
  @property() content = '';
  @property({ attribute: 'aria-label' }) accessibleLabel = '';
  private triggerElement?: HTMLElement;
  private slottedTriggerElement?: HTMLElement;
  /** True when the default slot is tooltip content (WA mode). False only when an explicit
   * Shoelace content source makes the default slot unambiguously the trigger. */
  private namedTriggerMode = true;
  @state() private interactiveContent = false;
  @state() private resolvedSide: 'top' | 'bottom' | 'left' | 'right' = 'top';
  @state() private anchorPositioned = false;
  private positionedAnchor?: Element | VirtualAnchor;
  private observedDirectAnchor?: Element;
  private observedDirectAnchorWasConnected = false;
  private stopAnchorIdentityObservation?: () => void;
  private triggerAria?: AriaOwnershipLease;
  private accessibleTriggerAria?: AriaOwnershipLease;
  /** The virtual anchor set by `showAt()`, taking priority over `for`/`trigger` for positioning
   *  while set. Cleared whenever the tooltip closes, so a later `open = true` with no fresh
   *  `showAt()` call reverts to plain trigger-based behavior. */
  private virtualAnchor?: VirtualAnchor;
  /** `options.returnFocusTo` from the `showAt()` call that opened the tooltip, if any -- see
   *  `showAt()`'s doc comment and `activateTooltipOverlay()`'s `onEscape` callback. */
  private returnFocusTo?: HTMLElement;
  private cleanup?: () => void;
  private timer?: number;
  private timerView?: Window;
  private pendingDirection?: 'show' | 'hide';
  private restoreFocusOnClose = false;
  /** Focus restoration after Escape is synchronous. Suppress only that focus event so returning
   * to the trigger does not immediately reopen the tooltip; a later genuine focus still opens. */
  private suppressTriggerFocusOpen = false;
  /** True while the current open state was driven by the pointer (a `mouseenter` on the trigger)
   *  rather than by focus, click, or `manual`. Only a pointer-held tooltip has to be re-derived
   *  when the trigger element is swapped out from under it -- see `adoptTrigger`. */
  private openedByPointer = false;
  /** Registered with the shared overlay manager while a virtual-anchor or actionable tooltip is
   *  open, so Escape ownership and focus return remain topmost-stack-aware. */
  private overlayHandle?: OverlayHandle;
  private readonly tooltipId = nextId('tooltip');
  private readonly descriptionId = nextId('tooltip-description');
  private descriptionProxy?: HTMLSpanElement;
  private contentObserver?: MutationObserver;
  private stopLabelReferenceIdentityObservation?: () => void;
  private readonly contentSlotListeners = new Set<HTMLSlotElement>();
  /** While an open tooltip contains a rootless custom element, rescan for a bounded initialization
   * grace period. Later observable content mutations start a fresh grace period. */
  private shadowContentScanFrame?: number;
  private shadowContentScanView?: Window;
  private shadowContentScanAttempts = 0;
  /** Invalidates an in-flight `lr-after-*` wait when the opposite transition interrupts it. */
  private transitionToken = 0;
  private transitionAnimation?: Animation;
  private readonly transitionGate = new OverlayTransitionGate();

  private get rendersArrow(): boolean {
    return this.arrow && !this.withoutArrow;
  }

  private get activeContentSlot(): HTMLSlotElement | null {
    const selector = this.namedTriggerMode
      ? '[part~="body"] slot:not([name])'
      : '[part~="body"] slot[name="content"]';
    // The SSR hydration client can run connectedCallback before Lit assigns `renderRoot`. Prefer
    // an existing declarative shadow root in that window, and otherwise defer slot-derived work
    // until the first render/slotchange rather than dereferencing an uninitialized root.
    const root = this.renderRoot ?? this.shadowRoot;
    return root?.querySelector<HTMLSlotElement>(selector) ?? null;
  }

  private syncNamedTriggerMode(schedule = true): void {
    const children = Array.from(this.children);
    const hasNamedTrigger = children.some((child) => child.getAttribute('slot') === 'trigger');
    const hasShoelaceContent =
      this.content.length > 0 || children.some((child) => child.getAttribute('slot') === 'content');
    const next = hasNamedTrigger || !hasShoelaceContent;
    if (next === this.namedTriggerMode) return;
    const old = this.namedTriggerMode;
    this.namedTriggerMode = next;
    if (schedule && this.hasUpdated) this.requestUpdate('namedTriggerMode', old);
  }

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
    super.willUpdate(changed);
    this.syncNamedTriggerMode(false);
    if ((changed.has('manual') || changed.has('trigger')) && this.isManual) this.cancelPendingTransition();
    if (changed.has('disabled') && this.disabled) {
      this.cancelPendingTransition();
      if (this._open) {
        if (this.hasUpdated) void this.hide();
        else this.applyOpenState(false);
      }
    }
    const lostDirectAnchorProperty =
      changed.has('anchor')
      && changed.get('anchor') === this.observedDirectAnchor
      && this.observedDirectAnchorWasConnected
      && this.anchor?.isConnected !== true;
    if (lostDirectAnchorProperty && this.open && !this.resolveAnchor()) {
      void this.forceClose();
    }
    if (changed.has('showDelay') && this.pendingDirection === 'show') this.requestTransition(true);
    if (changed.has('hideDelay') && this.pendingDirection === 'hide') this.requestTransition(false);
    if (changed.has('for')) this.syncInteractionTrigger();
    // `anchorPositioned` gates `?data-hidden`, keeping the popup invisible until Floating UI has
    // actually placed it. Its close-path reset used to live in `updated()`, where flipping a
    // `@state` true -> false after the update completed scheduled a second, wasted render and
    // tripped Lit's change-in-update warning -- which `WTR_STRICT_CONSOLE=1` turns into a test
    // failure. It is a pure derivation of `open`, so it belongs here, before render. Nothing
    // visible changes: the same render already hides the popup via `!this.open`.
    if (changed.has('open') && !this.open) this.anchorPositioned = false;
    // A new anchor is likewise knowable before render: `position()`/`reposition()` runs from
    // `updated()` and clears this the moment it sees the anchor differs from the one it last placed
    // against, which flips the state after the update completed and buys a second render. Deriving
    // it here hides the popup in the *same* render that adopts the new anchor -- also the more
    // correct paint, since the old coordinates are already stale by then.
    if (changed.has('anchor') || changed.has('for')) this.anchorPositioned = false;
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    if (changed.has('for') || changed.has('anchor') || changed.has('open')) {
      this.syncAnchorIdentityObservation();
    }
    if (
      changed.has('open') ||
      changed.has('placement') ||
      changed.has('distance') ||
      changed.has('skidding') ||
      changed.has('for') ||
      changed.has('anchor') ||
      changed.has('hoist') ||
      changed.has('arrow') ||
      changed.has('withoutArrow') ||
      changed.has('arrowPlacement') ||
      changed.has('arrowPadding') ||
      changed.has('interactiveContent')
    ) {
      this.cleanup?.();
      this.cleanup = undefined;
      if (this.open && this.isConnected) this.position();
      if (changed.has('open')) {
        // A virtual anchor has no DOM trigger to bind hover/focus/keydown listeners to (see
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
          // `anchorPositioned` is reset in willUpdate(); `positionedAnchor` is not reactive.
          this.positionedAnchor = undefined;
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
          this.syncInteractionTrigger();
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
    this.syncAnchorIdentityObservation();
    this.ensureDescriptionProxy();
    this.contentObserver?.disconnect();
    const MutationObserverCtor = this.ownerDocument.defaultView?.MutationObserver;
    this.contentObserver = MutationObserverCtor
      ? new MutationObserverCtor(() => {
          this.syncNamedTriggerMode();
          this.updateInteractiveContent();
        })
      : undefined;
    this.updateInteractiveContent();
    this.syncInteractionTrigger();
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
    this.stopAnchorIdentityObservation?.();
    this.stopAnchorIdentityObservation = undefined;
    this.cancelPendingTransition();
    this.cleanup?.();
    this.cleanup = undefined;
    this.overlayHandle?.suspend();
    if (this.triggerElement) {
      this.unbindTrigger(this.triggerElement);
    }
    this.releaseTriggerA11y();
    this.triggerElement = undefined;
    this.contentObserver?.disconnect();
    this.contentObserver = undefined;
    this.stopLabelReferenceIdentityObservation?.();
    this.stopLabelReferenceIdentityObservation = undefined;
    this.clearContentSlotListeners();
    this.cancelShadowContentScan();
    // A pending after-event must not announce a transition the detached element left behind.
    this.transitionToken++;
    this.cancelTransitionAnimation();
    this.removeAttribute('data-closing');
    super.disconnectedCallback();
  }

  override adoptedCallback(): void {
    super.adoptedCallback();
    this.stopAnchorIdentityObservation?.();
    this.stopAnchorIdentityObservation = undefined;
    // Every asynchronous primitive is paired with the Window that created it. Adoption normally
    // brackets this callback with disconnect/connect, but clearing the old realm here as well
    // keeps an explicitly adopted, still-detached instance from retaining observers or timers.
    this.cancelPendingTransition();
    this.cancelShadowContentScan();
    this.contentObserver?.disconnect();
    this.contentObserver = undefined;
    this.stopLabelReferenceIdentityObservation?.();
    this.stopLabelReferenceIdentityObservation = undefined;
    this.clearContentSlotListeners();
    this.releaseTriggerA11y();
  }
  private syncAnchorIdentityObservation(): void {
    this.stopAnchorIdentityObservation?.();
    this.stopAnchorIdentityObservation = undefined;
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
        void this.forceClose();
        return;
      }
      if (nextAnchor !== this.positionedAnchor) this.position();
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
    const next = this.virtualAnchor ? undefined : (this.slottedTriggerElement ?? this.resolveForTrigger());
    this.adoptTrigger(next);
  }
  /** Registers a virtual-anchor or actionable tooltip with the shared overlay manager
   *  (`internal/overlay-manager.ts`) so Escape is routed only to the topmost overlay in the stack,
   *  instead of every open virtual-anchor popover/tooltip reacting to its own unscoped
   *  `document`-level keydown listener. Non-modal and non-focus-trapping: a virtual anchor has no
   *  DOM node to own focus, so background inerting and Tab trapping (both opt-in via `modal`/
   *  `trapFocus`) would be meaningless here -- only Escape ownership is needed. */
  private activateTooltipOverlay(): void {
    if (!this.isConnected) return;
    const restoreFocusTarget = this.virtualAnchor ? (this.returnFocusTo ?? null) : this.accessibleTrigger;
    if (this.overlayHandle?.isActive()) {
      this.overlayHandle.updateRestoreFocusTo(restoreFocusTarget);
      return;
    }
    this.overlayHandle = activateOverlay({
      host: this,
      panel: () => this.renderRoot.querySelector('[part~="popup"]') as HTMLElement | null,
      onEscape: () => this.hide({ restoreFocus: this.shouldRestoreFocusAfterEscape() }),
      restoreFocusTo: restoreFocusTarget,
      modal: false,
      trapFocus: false,
    });
    // A hover tooltip must never steal focus, so initial focus is moved only when the content
    // explicitly asks for it.
    this.overlayHandle.focusAutofocus();
  }

  private shouldRestoreFocusAfterEscape(): boolean {
    if (this.virtualAnchor) return this.returnFocusTo !== undefined;
    const active = this.ownerDocument.activeElement;
    return active !== null && composedContains(this, active);
  }

  private get requiresOverlayManager(): boolean {
    return this.open;
  }
  /**
   * Opens the tooltip anchored to an arbitrary rectangle instead of any DOM anchor -- for
   * anchoring to a graph node, a canvas pixel, a chart datum, or any other non-DOM location.
   * `width`/`height` default to `0` (a point). Positions exactly as `place()` would against a real
   * element (flip/shift/RTL all apply unchanged). Opens immediately, bypassing `show-delay` and
   * `trigger` (both are interaction-debounce concerns for a DOM trigger, not relevant to a
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
   * While the virtual anchor is active, no slotted/`for` element owns interactions or generated
   * ARIA. A virtual anchor also has no `.focus()`. Escape returns focus to
   * `options.returnFocusTo` when
   * supplied, or skips focus-return entirely otherwise -- refocusing the right place after a
   * virtual anchor closes is the host's responsibility, since Lyra can't assume how e.g. a graph
   * node's own keyboard model wants focus back.
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
      this.activateTooltipOverlay();
      this.position();
      return;
    }
    void this.show();
    if (this.open) return;
    this.virtualAnchor = previousAnchor;
    this.returnFocusTo = previousReturnFocusTo;
    this.syncInteractionTrigger();
  }

  /** Open immediately, bypassing `show-delay` and whatever `trigger` allows. Emits `lr-show`
   *  first — vetoing it leaves the tooltip closed — then `lr-after-show`. */
  show(): Promise<void> {
    this.cancelPendingTransition();
    if (this.disabled || this._open) return Promise.resolve();
    return this.transitionGate.request(true, () => {
      if (this.emit('lr-show', null, { cancelable: true }).defaultPrevented) {
        this.syncOpenAttribute();
        return;
      }
      this.cancelTransitionAnimation();
      this.removeAttribute('data-closing');
      this.applyOpenState(true);
      return this.settleTransition('lr-after-show');
    });
  }

  /** Close immediately, bypassing `hide-delay`. Emits `lr-hide` first — vetoing it leaves the
   *  tooltip open — then `lr-after-hide`. `restoreFocus` is used by the Escape path, which has to
   *  put focus back on the trigger it took it from. */
  hide(options?: { restoreFocus?: boolean }): Promise<void> {
    this.cancelPendingTransition();
    if (!this._open) return Promise.resolve();
    return this.transitionGate.request(false, () => {
      if (this.emit('lr-hide', null, { cancelable: true }).defaultPrevented) {
        this.syncOpenAttribute();
        return;
      }
      if (options?.restoreFocus) this.restoreFocusOnClose = true;
      this.cancelTransitionAnimation();
      if (this.isConnected) this.setAttribute('data-closing', '');
      this.applyOpenState(false);
      return this.settleTransition('lr-after-hide');
    });
  }

  /** Structural teardown cannot be vetoed: no open tooltip may remain after its final live
   * positioning anchor disappears. */
  private forceClose(): Promise<void> {
    this.cancelPendingTransition();
    if (!this._open) return Promise.resolve();
    this.cancelTransitionAnimation();
    if (this.isConnected) this.setAttribute('data-closing', '');
    this.applyOpenState(false);
    return this.settleTransition('lr-after-hide');
  }

  private applyOpenState(next: boolean): void {
    const old = this._open;
    this._open = next;
    if (!next) this.cancelShadowContentScan();
    // Reset here rather than in onLeave: every close path (hide(), Escape, forceClose(), a
    // vetoed reopen) funnels through this one assignment, so the flag can never outlive the
    // pointer interaction that set it.
    if (!next) this.openedByPointer = false;
    this.requestUpdate('open', old);
  }

  /** A vetoed transition must leave the reflected attribute agreeing with the property; Lit only
   *  reflects properties it saw change. */
  private syncOpenAttribute(): void {
    this.toggleAttribute('open', this._open);
  }

  private cancelTransitionAnimation(): void {
    this.transitionAnimation?.cancel();
    this.transitionAnimation = undefined;
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
      const animation = popup
        ? animateRegistered(
            this,
            popup,
            `tooltip.${showing ? 'show' : 'hide'}`,
            this.effectiveDirection,
            {
              keyframes: showing ? [{ opacity: 0 }, { opacity: 1 }] : [{ opacity: 1 }, { opacity: 0 }],
              durationProperties: ['--lr-transition-fast', '--lr-duration-fast'],
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
    this.emit(event);
  }

  /** Resolves what the popup is positioned against: an explicit virtual anchor first, then the
   *  direct `anchor`, then the `for` idref, then the slotted trigger. Shared with `<lr-popover>`,
   *  which resolves the identical chain. */
  private resolveAnchor(): Element | VirtualAnchor | null {
    return resolveOverlayAnchor(this, {
      virtualAnchor: this.virtualAnchor,
      anchor: this.anchor,
      for: this.for,
      trigger: this.triggerElement,
    });
  }
  private position(): void {
    this.cleanup?.();
    this.cleanup = undefined;
    const popup = this.renderRoot.querySelector('[part~="popup"]') as HTMLElement | null;
    const arrowElement = this.renderRoot.querySelector('[part~="arrow"]') as HTMLElement | null;
    const anchor = this.resolveAnchor();
    if (!this.open || !anchor || !popup) {
      this.positionedAnchor = undefined;
      this.anchorPositioned = false;
      return;
    }
    if (anchor !== this.positionedAnchor) {
      this.anchorPositioned = false;
    }
    if (this.open && anchor && popup) {
      const arrowPadding = Math.max(0, finiteNumber(this.arrowPadding, 0));
      this.cleanup = place(anchor, popup, {
        placement: rtlAwarePlacement(this.placement, this),
        strategy: this.hoist ? 'fixed' : 'absolute',
        offset: finiteNumber(this.distance, DEFAULT_DISTANCE),
        skidding: finiteNumber(this.skidding, 0),
        arrow: this.rendersArrow && arrowElement ? arrowElement : undefined,
        arrowPadding,
        onPlaced: ({ placement, arrow }) => {
          this.positionedAnchor = anchor;
          this.anchorPositioned = true;
          const side = applyOverlayArrow(arrowElement, {
            placement,
            coords: arrow,
            enabled: this.rendersArrow,
            arrowPlacement: this.arrowPlacement,
            arrowPadding,
            rtl: this.effectiveDirection === 'rtl',
            sizeProperty: '--arrow-size',
            fallbackSizeProperty: '--lr-tooltip-arrow-size',
          });
          if (side !== this.resolvedSide) this.resolvedSide = side;
        },
      });
    }
  }
  private syncTriggerA11y(): void {
    const trigger = this.triggerElement ?? null;
    const proxy = this.open ? this.descriptionProxy : undefined;
    const contribution = { descriptions: proxy ? [proxy] : [] };
    if (this.triggerAria) this.triggerAria.update(trigger, contribution);
    else this.triggerAria = acquireAriaOwnership(trigger, contribution);

    const accessibleTrigger = this.accessibleTrigger;
    const distinctAccessibleTrigger = accessibleTrigger !== trigger ? accessibleTrigger : null;
    if (this.accessibleTriggerAria) {
      this.accessibleTriggerAria.update(distinctAccessibleTrigger, contribution);
    } else {
      this.accessibleTriggerAria = acquireAriaOwnership(distinctAccessibleTrigger, contribution);
    }
    if (this.overlayHandle?.isActive() && !this.virtualAnchor) {
      this.overlayHandle.updateRestoreFocusTo(accessibleTrigger);
    }
  }

  private get accessibleTrigger(): HTMLElement | null {
    return this.triggerElement ? resolveAccessibleTrigger(this.triggerElement) : null;
  }

  private releaseTriggerA11y(): void {
    this.accessibleTriggerAria?.release();
    this.accessibleTriggerAria = undefined;
    this.triggerAria?.release();
    this.triggerAria = undefined;
  }
  /** Runs `show()`/`hide()` after the matching delay, replacing whatever was pending. */
  private requestTransition(next: boolean): void {
    this.cancelPendingTransition();
    if (this.disabled) return;
    const delay = this.interactionDelay(next);
    if (delay <= 0) {
      if (next) this.show();
      else this.hide();
      return;
    }
    this.pendingDirection = next ? 'show' : 'hide';
    const view = this.ownerDocument.defaultView;
    if (!view) {
      this.pendingDirection = undefined;
      return;
    }
    this.timerView = view;
    const timer = view.setTimeout(() => {
      if (this.timerView !== view || this.timer !== timer) return;
      this.timer = undefined;
      this.timerView = undefined;
      this.pendingDirection = undefined;
      if (next) this.show();
      else this.hide();
    }, delay);
    this.timer = timer;
  }
  private interactionDelay(showing: boolean): number {
    const value = showing ? this.showDelay : this.hideDelay;
    const fallback = showing ? DEFAULT_SHOW_DELAY : DEFAULT_HIDE_DELAY;
    const attribute = showing ? 'show-delay' : 'hide-delay';
    if (this.hasAttribute(attribute) || value !== fallback) return finiteDuration(value, fallback);
    const property = showing ? '--show-delay' : '--hide-delay';
    const raw = this.ownerDocument.defaultView?.getComputedStyle(this).getPropertyValue(property).trim() ?? '';
    const match = raw.match(/^(-?(?:\d+\.?\d*|\.\d+))(ms|s)$/i);
    if (!match) return fallback;
    const amount = Number(match[1]);
    const milliseconds = match[2]?.toLowerCase() === 's' ? amount * 1000 : amount;
    return finiteDuration(milliseconds, fallback);
  }
  private cancelPendingTransition(): void {
    if (this.timer !== undefined) this.timerView?.clearTimeout(this.timer);
    this.timer = undefined;
    this.timerView = undefined;
    this.pendingDirection = undefined;
  }
  private bindTrigger(trigger: HTMLElement): void {
    trigger.addEventListener('mouseenter', this.onEnter);
    trigger.addEventListener('mouseleave', this.onLeave);
    trigger.addEventListener('focusin', this.onEnter);
    trigger.addEventListener('focusout', this.onLeave);
    trigger.addEventListener('click', this.onTriggerClick);
    trigger.addEventListener('keydown', this.onTriggerKeyDown);
  }
  private unbindTrigger(trigger: HTMLElement): void {
    trigger.removeEventListener('mouseenter', this.onEnter);
    trigger.removeEventListener('mouseleave', this.onLeave);
    trigger.removeEventListener('focusin', this.onEnter);
    trigger.removeEventListener('focusout', this.onLeave);
    trigger.removeEventListener('click', this.onTriggerClick);
    trigger.removeEventListener('keydown', this.onTriggerKeyDown);
  }
  /** Whether `trigger` is currently held open by a real user interaction -- the pointer resting
   *  over it, or focus sitting inside it. `:hover` is the browser's own post-layout hover state,
   *  which is exactly the question being asked ("is the pointer over THIS node") and needs no
   *  pointer-coordinate bookkeeping of our own. Both are wrapped because a detached or
   *  not-yet-laid-out node can throw on `matches()` in some engines. */
  private isTriggerHeld(trigger: HTMLElement): boolean {
    try {
      if (trigger.matches(':hover')) return true;
    } catch {
      /* fall through to the focus check */
    }
    const active = trigger.ownerDocument.activeElement;
    return active !== null && composedContains(trigger, active);
  }

  private adoptTrigger(next: HTMLElement | undefined): void {
    if (next === this.triggerElement) {
      this.syncTriggerA11y();
      return;
    }
    const hadTrigger = this.triggerElement !== undefined;
    // Swapping the slotted trigger (a conditional template, a repeat() re-key)
    // must strip the outgoing element's listeners and stale aria-describedby
    // before adopting the new one -- otherwise the old node keeps driving this
    // tooltip's open state and keeps pointing assistive tech at it.
    this.cancelPendingTransition();
    if (this.triggerElement) {
      this.unbindTrigger(this.triggerElement);
    }
    this.triggerElement = next;
    if (!this.triggerElement) {
      this.syncTriggerA11y();
      if (hadTrigger && this.open && !this.resolveAnchor()) void this.forceClose();
      return;
    }
    this.bindTrigger(this.triggerElement);
    this.syncTriggerA11y();
    // A list that re-renders (a chat transcript, a log view, anything virtualized) replaces the
    // `for` target with a FRESH node rather than moving the old one. The outgoing element is
    // detached before it can fire the `mouseleave` that normally closes a resting tooltip, and the
    // incoming element is not necessarily under the pointer -- so a pointer-held tooltip used to
    // survive the swap and hang over a trigger nobody was pointing at. Reported live as several
    // resting tooltips visible simultaneously with the pointer over none of them. Re-derive the
    // open state from the NEW element instead of inheriting the outgoing one's: keep it open only
    // while the incoming trigger is genuinely hovered or focused.
    if (hadTrigger && this._open && this.openedByPointer && !this.isTriggerHeld(this.triggerElement)) {
      void this.forceClose();
    }
    // An initially-open tooltip reaches its first updated() before slotchange has supplied the
    // trigger, so that update has no anchor to position against. Re-run positioning once the
    // trigger exists, matching the initially-open popover path.
    if (this.open) this.position();
    if (this.open && this.interactiveContent) this.activateTooltipOverlay();
  }
  private onTriggerSlotChange = (event: Event): void => {
    this.syncNamedTriggerMode();
    const slot = event.target as HTMLSlotElement;
    this.slottedTriggerElement = slot.assignedElements({ flatten: true })[0] as HTMLElement | undefined;
    this.syncInteractionTrigger();
  };
  private onEnter = (event: Event): void => {
    if (this.disabled) return;
    this.syncTriggerA11y();
    if (event.type === 'focusin') {
      if (this.suppressTriggerFocusOpen || !this.opensOn('focus')) return;
    } else if (!this.opensOn('hover')) return;
    if (event.type !== 'focusin') this.openedByPointer = true;
    this.requestTransition(true);
  };
  private onLeave = (event: Event): void => {
    if (event.type === 'focusout' ? !this.opensOn('focus') : !this.opensOn('hover')) return;
    const next = (event as FocusEvent | MouseEvent).relatedTarget;
    if (
      next !== null &&
      (next as Node).nodeType === 1 &&
      this.triggerElement &&
      composedContains(this.triggerElement, next as Element)
    ) {
      return;
    }
    if (this.interactiveContent && this.isPopupTarget(next)) return;
    this.requestTransition(false);
  };
  private onTriggerClick = (): void => {
    if (this.disabled) return;
    if (!this.opensOn('click')) return;
    this.syncTriggerA11y();
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
    if (
      next !== null
      && (next as Node).nodeType === 1
      && (
        (this.triggerElement && composedContains(this.triggerElement, next as Element)) ||
        this.isPopupTarget(next)
      )
    ) return;
    this.requestTransition(false);
  };
  private isPopupTarget(target: EventTarget | null): boolean {
    if (target === null || (target as Node).nodeType !== 1) return false;
    const element = target as Element;
    const slot = this.activeContentSlot;
    return (
      this.renderRoot.querySelector<HTMLElement>('[part~="popup"]')?.contains(element) === true ||
      slot?.assignedElements({ flatten: true }).some((root) => composedContains(root, element)) === true
    );
  }

  private onContentSlotChange = (event: Event): void => {
    if ((event.target as Element | null)?.localName !== 'slot') return;
    this.updateInteractiveContent();
  };

  private clearContentSlotListeners(): void {
    for (const slot of this.contentSlotListeners) {
      slot.removeEventListener('slotchange', this.onContentSlotChange);
    }
    this.contentSlotListeners.clear();
  }

  private syncContentSlotListeners(slots: ReadonlySet<HTMLSlotElement>): void {
    const activeSlot = this.activeContentSlot;
    for (const slot of this.contentSlotListeners) {
      if (slots.has(slot) && slot !== activeSlot) continue;
      slot.removeEventListener('slotchange', this.onContentSlotChange);
      this.contentSlotListeners.delete(slot);
    }
    for (const slot of slots) {
      if (slot === activeSlot || this.contentSlotListeners.has(slot)) continue;
      slot.addEventListener('slotchange', this.onContentSlotChange);
      this.contentSlotListeners.add(slot);
    }
  }

  private inspectContent(): TooltipContentSnapshot {
    const snapshot: TooltipContentSnapshot = {
      actionable: false,
      assigned: false,
      awaitingShadowRoot: false,
      labelReferenceRoots: new Set<Document | ShadowRoot>(),
      text: '',
      externalRoots: new Set<Node>(),
      shadowRoots: new Set<ShadowRoot>(),
      forwardingSlots: new Set<HTMLSlotElement>(),
      composedAncestors: new Set<Element>(),
    };
    const activeSlot = this.activeContentSlot;
    if (!activeSlot) return snapshot;
    snapshot.assigned = activeSlot.assignedNodes().length > 0;

    // The popup hides itself with `visibility: hidden` while closed. Visibility inherits through
    // slots, so reading consumer content in that state would otherwise classify every closed
    // tooltip as empty/non-actionable. Temporarily replace only that internal visibility with the
    // host's inherited value; consumer-authored hidden/visibility rules on the content or its
    // outer composed ancestors still participate in each getComputedStyle() call below.
    const popup = this.renderRoot.querySelector<HTMLElement>('[part~="popup"]');
    const bypassClosedVisibility = popup?.hasAttribute('data-hidden') === true;
    const previousVisibility = popup?.style.getPropertyValue('visibility') ?? '';
    const previousVisibilityPriority = popup?.style.getPropertyPriority('visibility') ?? '';
    if (popup && bypassClosedVisibility) {
      const hostVisibility = this.ownerDocument.defaultView?.getComputedStyle(this).visibility ?? 'visible';
      popup.style.setProperty('visibility', hostVisibility);
    }
    try {
      const visitedContentElements = new Set<Element>();
      const accessibilityText = composedAccessibilityTextResult(activeSlot, {
        // Reuse the shared walk's node/depth budgets for actionability and observer enrollment too.
        // Side effects only record nodes the bounded traversal actually reached; returning false
        // preserves its normal accessible-text projection.
        shouldPruneNode: (node) => {
          if (node.getRootNode() !== this.renderRoot && !this.contains(node)) {
            snapshot.externalRoots.add(node);
          }
          if (node.nodeType !== 1) return false;
          const element = node as Element;
          visitedContentElements.add(element);
          const excluded = isAccessibilitySubtreeExcluded(element);
          if (!excluded && !isAccessibilityVisibilityHidden(element) && isActionableElement(element)) {
            snapshot.actionable = true;
          }
          if (element.localName === 'slot') snapshot.forwardingSlots.add(element as HTMLSlotElement);
          if (element.shadowRoot) snapshot.shadowRoots.add(element.shadowRoot);
          else if (element.localName.includes('-')) snapshot.awaitingShadowRoot = true;
          return false;
        },
        // The shared walk invokes this for composed ancestors as well as visited content. Recording
        // only elements not already seen as content preserves the focused ancestor observation
        // without a second, independently recursive ancestry walk.
        isSubtreeExcluded: (element) => {
          if (!visitedContentElements.has(element) && element !== this) {
            snapshot.composedAncestors.add(element);
          }
          return isAccessibilitySubtreeExcluded(element);
        },
      });
      snapshot.text = accessibilityText.text.replace(/\s+/g, ' ').trim();
      for (const root of accessibilityText.labelReferenceRoots) {
        snapshot.labelReferenceRoots.add(root);
      }
      for (const reference of accessibilityText.referencedElements) {
        snapshot.externalRoots.add(reference);
      }
    } finally {
      if (popup && bypassClosedVisibility) {
        if (previousVisibility) {
          popup.style.setProperty('visibility', previousVisibility, previousVisibilityPriority);
        } else {
          popup.style.removeProperty('visibility');
        }
      }
    }
    return snapshot;
  }

  private observeContentNode(node: Node): void {
    if (!this.contentObserver) return;
    if (node.nodeType === 3) {
      this.contentObserver.observe(node, { characterData: true });
      return;
    }
    if (node.nodeType !== 1 && node.nodeType !== 11) return;
    this.contentObserver.observe(node, {
      attributes: true,
      attributeFilter: [
        'aria-hidden',
        'aria-label',
        'aria-labelledby',
        'alt',
        'class',
        'contenteditable',
        'hidden',
        'href',
        'inert',
        'open',
        'role',
        'slot',
        'style',
        'tabindex',
      ],
      childList: true,
      characterData: true,
      subtree: true,
    });
  }

  private bindContentObservation(snapshot: TooltipContentSnapshot): void {
    this.stopLabelReferenceIdentityObservation?.();
    this.stopLabelReferenceIdentityObservation = undefined;
    if (this.isConnected && snapshot.labelReferenceRoots.size > 0) {
      const cleanups = [...snapshot.labelReferenceRoots].map((root) =>
        observeOverlayAnchorIdentity(root, () => this.updateInteractiveContent()));
      this.stopLabelReferenceIdentityObservation = () => {
        for (const cleanup of cleanups) cleanup();
      };
    }
    if (!this.contentObserver) return;
    this.contentObserver.disconnect();
    for (const ancestor of snapshot.composedAncestors) {
      if (
        ancestor === this
        || ancestor.getRootNode() === this.renderRoot
        || snapshot.externalRoots.has(ancestor)
      ) continue;
      this.contentObserver.observe(ancestor, {
        attributes: true,
        attributeFilter: ['aria-hidden', 'class', 'hidden', 'inert', 'style'],
      });
    }
    this.observeContentNode(this);
    for (const root of snapshot.externalRoots) this.observeContentNode(root);
    for (const root of snapshot.shadowRoots) this.observeContentNode(root);
  }

  private updateInteractiveContent(fromShadowContentScan = false): void {
    if (!fromShadowContentScan) this.shadowContentScanAttempts = 0;
    const snapshot = this.inspectContent();
    this.interactiveContent = snapshot.actionable;
    this.syncContentSlotListeners(snapshot.forwardingSlots);
    this.bindContentObservation(snapshot);
    this.scheduleShadowContentScan(snapshot.awaitingShadowRoot);
    this.updateDescriptionProxy(snapshot.text, snapshot.assigned);
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
  private updateDescriptionProxy(contentText?: string, assigned?: boolean): void {
    if (!this.descriptionProxy) return;
    const hostLabel = this.getAttribute('aria-label');
    const snapshot = contentText === undefined || assigned === undefined ? this.inspectContent() : undefined;
    const visibleContent = contentText ?? snapshot?.text ?? '';
    const hasAssignment = assigned ?? snapshot?.assigned ?? false;
    const description = hostLabel !== null
      ? hostLabel.trim()
      : (this.accessibleLabel || visibleContent || (hasAssignment ? '' : this.content)).trim();
    if (this.descriptionProxy.textContent !== description) this.descriptionProxy.textContent = description;
  }
  private onTriggerKeyDown = (event: KeyboardEvent): void => {
    // WCAG 1.4.13: content shown on hover/focus must be dismissable without
    // moving pointer hover or keyboard focus -- Escape hides the tooltip while
    // leaving focus on the trigger (unlike the popover's Escape handling, the
    // trigger already has focus here, so there's nothing to refocus).
    if (this.isManual || !this.open || event.key !== 'Escape' || !this.overlayHandle?.isTopmost()) return;
    event.preventDefault();
    this.hide();
  };
  override render(): TemplateResult {
    const hostLabel = this.getAttribute('aria-label');
    const propertyLabel = this.accessibleLabel ?? '';
    const hasExplicitLabel = hostLabel !== null || propertyLabel.length > 0;
    const label = hostLabel !== null ? hostLabel : propertyLabel;
    const popupLabel = this.interactiveContent
      ? hasExplicitLabel ? label : this.localize('popover')
      : hasExplicitLabel ? label : nothing;
    return html`
      <span part="trigger">
        ${this.namedTriggerMode
          ? html`<slot name="trigger" @slotchange=${this.onTriggerSlotChange}></slot>`
          : html`<slot @slotchange=${this.onTriggerSlotChange}></slot>`}
      </span>
      <slot name="__lr-tooltip-description" hidden></slot>
      <div id=${this.tooltipId} part="popup base tooltip base__popup" role=${this.interactiveContent ? 'dialog' : 'tooltip'}
        aria-label=${popupLabel}
        ?data-hidden=${!this.open || !this.anchorPositioned}
        ?data-has-arrow=${this.rendersArrow}
        @mouseenter=${this.onPopupEnter} @mouseleave=${this.onPopupLeave}
        @focusin=${this.onPopupEnter} @focusout=${this.onPopupLeave}>
        <span part="body">
          ${this.namedTriggerMode
            ? html`<slot @slotchange=${this.onContentSlotChange}>${this.content}</slot>`
            : html`<slot name="content" @slotchange=${this.onContentSlotChange}>${this.content}</slot>`}
        </span>
        ${this.rendersArrow
          ? html`<span part="arrow base__arrow arrow-${this.resolvedSide}"></span>`
          : nothing}
      </div>
    `;
  }
}
declare global { interface HTMLElementTagNameMap { 'lr-tooltip': LyraTooltip; } }
