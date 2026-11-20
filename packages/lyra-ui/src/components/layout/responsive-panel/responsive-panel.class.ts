import { requestThenCommit } from '../../../internal/request-commit.js';
import { markVetoGuardWrite, VetoWriteGuard } from '../../../internal/veto-write-guard.js';
import { AllocationObserverController, OwnedMutationObserver } from '../../../internal/owned-observer.js';
import { syncAriaDescribedByElements } from '../../../internal/aria-reflection.js';
import { NativeModalCarrier } from '../../../internal/native-modal-carrier.js';
import { ModalSurfaceController } from '../../../internal/modal-surface-controller.js';
import { nativeModalCarrierStyles } from '../../../internal/native-modal-carrier.styles.js';
import { html, nothing, type TemplateResult, type PropertyValues } from 'lit';
import { property, state } from 'lit/decorators.js';
import { resolveCssLength } from '../../../internal/css-length.js';
import { cancelDeferredFocusReturn } from '../../../internal/deferred-focus-return.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { hostAriaLabel } from '../../../internal/a11y.js';
import { resolveAccessibleName } from '../../../internal/accessible-name.js';
import { literalSetConverter } from '../../../internal/converters.js';
import { SlotPresenceController } from '../../../internal/slot-presence-controller.js';
import { trackScrollRegions } from '../../../internal/scroll-region.js';
import {
  activateOverlay,
  deepActiveElement,
  type OverlayHandle,
} from '../../../internal/overlay-manager.js';
import { styles } from './responsive-panel.styles.js';
import { resolveResponsivePanelEffectiveMode } from './responsive-panel-mode.js';
import type { LyraResponsivePanelMode, LyraResponsivePanelEffectiveMode } from './responsive-panel-mode.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_responsivePanel } from '../../../internal/default-strings/layout.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END

export { resolveResponsivePanelEffectiveMode } from './responsive-panel-mode.js';
const HEADING_SELECTOR = 'h1, h2, h3, h4, h5, h6, [role="heading"]';
const DEFAULT_OVERLAY_BREAKPOINT = '768px';

export type { LyraResponsivePanelMode, LyraResponsivePanelEffectiveMode } from './responsive-panel-mode.js';

const RESPONSIVE_PANEL_MODE = literalSetConverter<LyraResponsivePanelMode>(
  ['inline', 'overlay', 'auto'],
  'auto'
);

export type LyraResponsivePanelShape = 'fullscreen' | 'bottom-sheet' | 'start' | 'end';

/** Reason the panel was closed, forwarded as `lr-close` detail.reason --
 *  mirrors lr-dialog's own `DialogCloseReason` shape. `'escape'` and
 *  `'backdrop'` are emitted by the overlay presentation's own built-in
 *  dismiss triggers (they can't occur while inline, since there's no
 *  backdrop/document-keydown trap wired up then); any other string is
 *  whatever a caller passes to `close()`. */
export type LyraResponsivePanelCloseReason =
  | 'escape'
  | 'backdrop'
  | 'api'
  | (string & Record<never, never>);

export interface LyraResponsivePanelModeChangeDetail {
  mode: LyraResponsivePanelEffectiveMode;
}

/** The accepted dismissal reason. */
export interface LyraResponsivePanelCloseDetail {
  reason: LyraResponsivePanelCloseReason;
}

export interface LyraResponsivePanelEventMap {
  'lr-close-request': CustomEvent<LyraResponsivePanelCloseDetail>;
  'lr-close': CustomEvent<LyraResponsivePanelCloseDetail>;
  'lr-mode-change': CustomEvent<LyraResponsivePanelModeChangeDetail>;
}

/**
 * `<lr-responsive-panel>` — the same slotted content either docked inline
 * in the page's normal layout flow (desktop) or presented as a full-screen/
 * bottom-sheet overlay, depending on its allocated inline size. Typical uses:
 * a settings panel or a conversation-history sidebar that's a permanent
 * docked pane on a wide screen but a modal on a phone.
 *
 * Breakpoint detection observes this component and compares its allocation with
 * `overlayBreakpoint`. Resizing a containing layout across the breakpoint while
 * `mode="auto"` (the default) updates the
 * effective presentation without unmounting or re-creating the slotted
 * content: inline and overlay presentation share the exact same shadow DOM
 * structure (only a css class, top-layer presentation, overlay-only `role`/`aria-modal`
 * attributes, and backdrop element differ), so lit-html's diffing keeps
 * `[part="body"]` and its `<slot>` as the same DOM node across the
 * transition -- scroll position and focus inside the slotted content survive
 * it for free. When an open inline panel becomes modal, focus already inside
 * is preserved and outside focus moves to the first available target. Closing
 * still returns to the opener captured by the original inline open.
 *
 * Closing the overlay presentation returns focus to that opener as the panel closes and, when that
 * attempt could not land (a host commonly hides its own opener while the panel is open and
 * re-shows it from its own render in response to `lr-close` or its own `open = false` write), again
 * once the close's update has completed and one animation frame has passed. That second pass only
 * acts while focus is still inside the closed panel or has fallen to `<body>` -- focus moved
 * elsewhere in the meantime is never taken back -- and when the opener still cannot take focus,
 * focus is left where it is. A reopen, or a disconnect, abandons it.
 *
 * The overlay presentation uses the library's shared overlay coordinator for
 * focus trapping, Escape/backdrop dismissal, inerting, and stack ordering,
 * while retaining this component's own responsive rendering and close event.
 * Its surface enters the browser top layer, so sticky headers and ancestor
 * stacking contexts cannot cover it. The host stays in its authored slot.
 *
 * Accessible name (overlay presentation only -- the inline presentation has
 * no dialog semantics to name), in priority order: if the host element itself
 * has an `aria-label` attribute set, its value wins outright, overriding
 * every source below -- the standard ARIA convention for a consumer that
 * wants full control over the announced name, matching lr-dialog's
 * `accessibleLabel` pattern. Otherwise a non-blank `label` is used.
 * When both are empty, this falls back to the `header` slot's content -- a
 * heading element (`h1`–`h6` or `[role="heading"]`) among the slotted header
 * content wins if present, otherwise the header slot's full text content is
 * used, mirroring lr-dialog's `detectHeading()`/`headingText` fallback (see
 * dialog.class.ts's module doc for why this uses `aria-label`, a copied string,
 * rather than `aria-labelledby`: the header content is light DOM while
 * `[part="panel"]` lives in this element's shadow tree, and an ID-reference
 * attribute can't resolve across that boundary). A panel opened without a
 * host `aria-label`, `label`, or header content receives the localized
 * `responsivePanel` fallback, so every overlay dialog remains named.
 *
 * @customElement lr-responsive-panel
 * @slot - The panel body.
 * @slot header - Optional header content, rendered above the body.
 * @slot footer - Optional footer content (e.g. action buttons), rendered below the body.
 * @event lr-close-request - Cancelable proposal before dismissal; detail is `{ reason }`.
 *   Fires for `close()` and overlay dismiss triggers in both presentations. Preventing default
 *   keeps the panel open. A plain `open = false` assignment remains a state write.
 * @event lr-close - Non-cancelable notification after closing; detail is `{ reason }`.
 *   Descendant notifications bubble too; check `event.target === event.currentTarget` when
 *   handling only this panel's dismissal.
 * @event lr-mode-change - `detail: LyraResponsivePanelModeChangeDetail`. Fired whenever the
 *   *effective* mode (not the `mode` prop's literal value, which may be `'auto'`) changes between
 *   `'inline'` and `'overlay'` -- crossing the breakpoint while `mode="auto"`, or the host
 *   reassigning `mode` to a value that changes the effective presentation. Never fired for the
 *   initial render, only for a live change thereafter.
 * @csspart base - The root wrapper; `display: none` while closed, positioned `fixed` while open
 *   and in the overlay presentation.
 * @csspart backdrop - The full-viewport scrim behind the panel -- only rendered in the overlay
 *   presentation.
 * @csspart panel - The panel surface itself (`role="dialog"` while open and in the overlay
 *   presentation).
 * @csspart header - The wrapper around the `header` slot.
 * @csspart body - The wrapper around the default slot.
 * @csspart footer - The wrapper around the `footer` slot.
 * Overlay state properties are resolved as inline fallbacks, so setting one on a panel or any
 * ancestor themes the overlay without changing docked panel chrome or shared tokens.
 * @cssprop --lr-responsive-panel-padding - Header, body and footer padding, each defaulting to its regional spacing.
 * @cssprop [--lr-responsive-panel-docked-radius=var(--lr-radius-container)] - Docked corner radius.
 * @cssprop [--lr-responsive-panel-docked-border-color=var(--lr-color-border-subtle)] - Docked border color.
 * @cssprop [--lr-responsive-panel-gap=var(--lr-space-s)] - Footer action gap.
 * @cssprop [--lr-responsive-panel-bg=var(--lr-color-surface)] - Background of `[part="panel"]` in the
 *   docked presentation; overlay presentations use `--lr-responsive-panel-overlay-panel-bg`.
 * @cssprop [--lr-responsive-panel-overlay-color=var(--lr-color-overlay)] - The overlay
 *   presentation's scrim color, applied to `[part="backdrop"]`.
 * @cssprop [--lr-responsive-panel-overlay-panel-bg=var(--lr-overlay-surface, var(--lr-color-surface-container-highest))] - Background
 *   of `[part="panel"]` in the overlay presentation.
 * @cssprop [--lr-responsive-panel-overlay-panel-shadow=var(--lr-overlay-shadow-modal, var(--lr-shadow-l))] - Shadow of
 *   `[part="panel"]` in the overlay presentation.
 * @cssprop [--lr-overlay-surface=var(--lr-color-surface-container-highest)] - Shared modal surface
 *   fill behind the overlay panel hook, so one declaration retints it with lr-dialog.
 * @cssprop [--lr-overlay-shadow-modal=var(--lr-shadow-l)] - Shared modal elevation behind the overlay panel hook.
 * @cssprop [--lr-responsive-panel-sheet-max-block-size=85dvh] - Maximum height of the
 *   `shape="bottom-sheet"` overlay panel (falls back to `85vh` where `dvh` is unsupported).
 * @cssprop [--lr-responsive-panel-side-inline-size=var(--lr-size-20rem)] - Width of the
 *   `shape="start"`/`shape="end"` overlay panel along the inline axis.
 * @status stable
 * @since 4.0.0
 */
export class LyraResponsivePanel extends LyraElement<LyraResponsivePanelEventMap> {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    responsivePanel: LYRA_DEFAULT_responsivePanel,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  private readonly openGuard = new VetoWriteGuard();
  private _open = false;
  private requestingOpen = false;

  static override styles = [LyraElement.styles, nativeModalCarrierStyles, styles];

  /** Whether the panel is open. In the inline presentation this just means visible/mounted; in
   *  the overlay presentation this is the actual modal open/closed state.
   * @default false */
  @property({ type: Boolean, reflect: true })
  get open(): boolean {
    return this._open;
  }
  set open(value: boolean) {
    markVetoGuardWrite(this.openGuard);
    this._open = value;
  }

  private _mode: LyraResponsivePanelMode = 'auto';

  /** `'auto'` (default) tracks `overlay-breakpoint` against this element's allocation;
   * `'inline'`/`'overlay'` force that presentation. */
  @property({ reflect: true, converter: RESPONSIVE_PANEL_MODE })
  get mode(): LyraResponsivePanelMode {
    return this._mode;
  }
  set mode(next: LyraResponsivePanelMode) {
    const normalized = RESPONSIVE_PANEL_MODE.normalizeReflected(
      this,
      'mode',
      next
    );
    const old = this._mode;
    if (old === normalized) return;
    this._mode = normalized;
    this.requestUpdate('mode', old);
  }

  /** Only affects the overlay presentation's visual treatment -- `'fullscreen'` (default) covers
   *  the whole viewport; `'bottom-sheet'` anchors to the block-end edge and doesn't cover the full
   *  height; `'start'`/`'end'` anchor to the matching *logical* inline edge instead, like a docked
   *  sidebar's slide-in-from-the-edge overlay counterpart -- the anchored edge, the panel's rounded
   *  free edge, and the geometry all flip automatically under `dir="rtl"` (logical
   *  `inset-inline-*`/border-radius properties, no `:dir()` selector involved). No entrance motion
   *  is implied by any shape value. This is a presentation-shape axis, not the library's shared
   *  semantic-tone `variant` vocabulary (`lr-button`/`lr-badge`/etc.) -- it deliberately uses a
   *  different property name to avoid colliding with that meaning. */
  @property({ reflect: true }) shape: LyraResponsivePanelShape = 'fullscreen';

  /** Accessible name for the overlay presentation's `role="dialog"`. Unused in the inline
   *  presentation, which has no dialog semantics to name. When empty, falls back to the `header`
   *  slot's content -- see the class doc for the full fallback order. */
  @property() label = '';

  /** CSS length compared with this element's allocated inline size in `mode="auto"`.
   * At or below the breakpoint, the effective presentation is `'overlay'`. */
  @property({ attribute: 'overlay-breakpoint' }) overlayBreakpoint = DEFAULT_OVERLAY_BREAKPOINT;

  /** Host-level `aria-label` override for the overlay presentation's accessible name -- wins over
   *  every other source (`label`, the header-slot fallback), matching `<lr-dialog>`'s
   *  `accessibleLabel` pattern. See the class doc for the full precedence order. */
  @property({ attribute: 'aria-label' }) accessibleLabel: string | null = null;

  @state() private belowBreakpoint = false;
  @state() private resolvedMode: LyraResponsivePanelEffectiveMode = 'inline';
  private readonly slotPresence = new SlotPresenceController(this);
  /** Fallback accessible name sourced from the `header` slot's content -- see `detectHeadingText()`. */
  @state() private headingText?: string;

  private readonly allocation = new AllocationObserverController(this, {
    onInlineSize: (size) => {
      if (!this.ownerDocument.defaultView?.ResizeObserver) this.measureAllocation();
      else this.queueOwnerMicrotask(() => this.applyMeasuredInlineSize(size), true);
    },
  });
  private lastTrigger?: HTMLElement;
  private overlayHandle?: OverlayHandle;
  private readonly nativeModal = new NativeModalCarrier(this, {
    onCancel: () => { if (this.overlayHandle?.isTopmost()) this.close('escape'); },
    onUnexpectedClose: () => {
      if (this.overlayHandle?.isTopmost()) this.close('escape');
      if (this.open) this.modalSurface.show();
    },
  });
  private readonly modalSurface = new ModalSurfaceController(
    this,
    this.nativeModal,
    () => this.shadowRoot?.querySelector<HTMLElement>('[part="base"]') ?? null,
  );
  private readonly headerObserver = new OwnedMutationObserver(this, () => {
    this.headingText = this.detectHeadingText();
  });
  /** Space-separated ids that describe the panel; forwarded to the modal panel only while it is open as an overlay. */
  @property({ attribute: 'aria-describedby' }) private hostDescribedBy: string | null = null;
  private ownerRealmGeneration = 0;
  /** Whether the overlay-only mechanics (scroll-lock and shared overlay registration) are currently
   *  engaged -- derived from `effectiveMode === 'overlay' && open`, tracked separately from those
   *  two properties so willUpdate can diff "was engaged" vs "should be engaged now" regardless of
   *  which of the two changed. */
  private overlayChromeActive = false;
  private focusOverlayAfterUpdate = false;
  private isFirstUpdate = true;

  /** The currently resolved presentation. Composition/measurement is the sole write authority. */
  get effectiveMode(): LyraResponsivePanelEffectiveMode {
    return this.resolvedMode;
  }

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed);
    this.isFirstUpdate = !this.hasUpdated;
    if (this.isFirstUpdate) {
      this.headingText = this.detectHeadingText();
    }
    if (
      !this.isFirstUpdate &&
      (changed.has('overlayBreakpoint') || changed.has('mode')) &&
      this.isConnected
    ) {
      this.measureAllocation();
    }
    if (
      this.isFirstUpdate ||
      changed.has('mode') ||
      changed.has('belowBreakpoint')
    ) {
      this.resolvedMode = resolveResponsivePanelEffectiveMode(
        this.mode,
        this.belowBreakpoint
      );
    }

    // Captured on a genuine open transition only, independent of
    // effectiveMode at that moment -- so it reflects whatever triggered the
    // open even if a later breakpoint crossing (while still open) switches
    // the presentation to overlay before close() runs. Deliberately not
    // folded into the overlayOpen-engage branch below: that branch also
    // fires when only effectiveMode (not open) changes, which would
    // re-capture whatever currently has focus (e.g. something inside the
    // panel) instead of the original external trigger.
    if (changed.has('open') && this.open) {
      const active = deepActiveElement(this.ownerDocument);
      this.lastTrigger =
        active && typeof (active as HTMLElement).focus === 'function'
          ? (active as HTMLElement)
          : undefined;
    }

    const overlayOpen = this.resolvedMode === 'overlay' && this.open;
    if (overlayOpen !== this.overlayChromeActive) {
      this.overlayChromeActive = overlayOpen;
      if (overlayOpen) {
        this.activateOverlayChrome();
        // Once the presentation becomes modal, focus cannot remain behind
        // it. The manager preserves focus that is already inside the panel
        // and otherwise moves it to the first composed focus target.
        this.focusOverlayAfterUpdate = true;
      } else {
        // Removing modal chrome while the still-open panel becomes inline
        // must preserve focus in that same panel. Only a real open -> closed
        // transition restores the opener.
        const restoreFocus = changed.has('open') && !this.open;
        this.deactivateOverlayChrome(restoreFocus);
      }
    }
    if (changed.has('open') && !this.open) this.lastTrigger = undefined;
  }

  // Runs after render (not willUpdate) so [part="panel"] has already landed
  // in the DOM before the fallback .focus() call below can rely on it --
  // mirrors lr-dialog's identical ordering rationale.
  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    this.showOverlaySurface();
    const overlayOpen = this.open && this.effectiveMode === 'overlay';
    for (const owner of this.renderRoot.querySelectorAll<HTMLElement>('[part="panel"], [data-native-modal-carrier]')) {
      syncAriaDescribedByElements(this, owner, overlayOpen ? this.hostDescribedBy : null);
    }
    if (!this.isFirstUpdate && changed.has('resolvedMode')) {
      // After the update completes, so a listener that assigns a property schedules a fresh
      // update instead of one inside this cycle.
      const mode = this.resolvedMode;
      this.scheduleAfterUpdate(() => {
        if (this.resolvedMode === mode) this.emit('lr-mode-change', { mode });
      }, 'responsive-mode-change');
    }
    if (this.focusOverlayAfterUpdate) {
      this.focusOverlayAfterUpdate = false;
      this.overlayHandle?.focusInitial();
    }
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.measureAllocation();
    // A reconnect (e.g. a drag-and-drop reparent keeping this same element
    // instance) fires disconnectedCallback then connectedCallback
    // synchronously with no update in between, so willUpdate never reruns to
    // notice overlay chrome is still supposed to be active -- restore it.
    const overlayOpen =
      resolveResponsivePanelEffectiveMode(this.mode, this.belowBreakpoint) === 'overlay' &&
      this.open;
    if (this.hasUpdated && overlayOpen) {
      if (this.overlayHandle?.isActive()) {
        this.overlayHandle.resume();
      } else {
        this.activateOverlayChrome();
      }
      this.queueOwnerMicrotask(() => {
        this.showOverlaySurface();
        this.overlayHandle?.focusInitial();
      });
    }
    if (this.hasUpdated) {
      this.queueOwnerMicrotask(() => {
        const slot = this.shadowRoot?.querySelector<HTMLSlotElement>(
          'slot[name="header"]'
        );
        if (slot) this.syncHeaderSlot(slot.assignedElements({ flatten: true }));
      });
    }
  }

  override disconnectedCallback(): void {
    // Finish connection cleanup before overlay teardown can flush a queued reconnect.
    this.resetOwnerRealmWork();
    cancelDeferredFocusReturn(this);
    super.disconnectedCallback();
    this.modalSurface.disconnect();
    this.overlayHandle?.suspend();
  }

  override adoptedCallback(): void {
    super.adoptedCallback();
    this.allocation.refresh();
    this.resetOwnerRealmWork();
    // Connection in the new document owns measurement and observer setup.
  }

  private resetOwnerRealmWork(): void {
    this.ownerRealmGeneration += 1;
    this.resetHeaderObserver();
  }

  private queueOwnerMicrotask(callback: VoidFunction, nextFrame = false): void {
    const ownerDocument = this.ownerDocument;
    const ownerWindow = ownerDocument.defaultView;
    if (!ownerWindow || !this.isConnected) return;
    const generation = this.ownerRealmGeneration;
    const run = (): void => {
      if (
        this.ownerRealmGeneration !== generation ||
        !this.isConnected ||
        this.ownerDocument !== ownerDocument
      ) {
        return;
      }
      callback();
    };
    if (nextFrame) ownerWindow.requestAnimationFrame(run);
    else ownerWindow.queueMicrotask(run);
  }

  private activateOverlayChrome(): void {
    this.modalSurface.prepare();
    this.overlayHandle = activateOverlay({
      host: this,
      panel: () =>
        this.shadowRoot?.querySelector<HTMLElement>('[part="panel"]') ?? null,
      onEscape: () => this.close('escape'),
      onBackdrop: () => this.close('backdrop'),
      restoreFocusTo: this.lastTrigger ?? null,
      lockScroll: true,
      suspendWhenUnrendered: true,
      // Covers an opener the host only re-shows after the close.
      deferredReturn: () => {
        const opener = this.lastTrigger;
        return opener ? { candidates: () => [opener], isCurrent: () => !this.open } : undefined;
      },
    });
  }

  private deactivateOverlayChrome(restoreFocus = true): void {
    this.modalSurface.hide();
    this.nativeModal.prepare(false);
    this.overlayHandle?.deactivate({ restoreFocus });
    this.overlayHandle = undefined;
  }

  private showOverlaySurface(): void {
    if (!this.isConnected || !this.open || this.effectiveMode !== 'overlay') return;
    // Reconcile registration against the newly rendered surface before using stack order.
    this.overlayHandle?.resume();
    this.modalSurface.show();
  }

  private measureAllocation(): void {
    if (this.mode !== 'auto') return;
    const inlineSize = this.offsetWidth;
    if (inlineSize > 0) this.applyMeasuredInlineSize(inlineSize);
  }

  /** Applies an authoritative allocation measurement. Kept separate from observer delivery for
   * deterministic tests and reconnect/adoption reconciliation. */
  private applyMeasuredInlineSize(inlineSize: number): void {
    if (!Number.isFinite(inlineSize) || inlineSize < 0) return;
    const resolved = resolveCssLength(this.overlayBreakpoint, { host: this });
    const fallback = resolveCssLength(DEFAULT_OVERLAY_BREAKPOINT, { host: this }) ?? 768;
    const breakpoint = Math.max(
      0,
      resolved !== undefined && Number.isFinite(resolved) ? resolved : fallback
    );
    this.belowBreakpoint = inlineSize <= breakpoint;
  }

  private onHeaderSlotChange = (e: Event): void => {
    this.syncHeaderSlot(
      (e.target as HTMLSlotElement).assignedElements({ flatten: true })
    );
  };

  private syncHeaderSlot(assigned: Element[]): void {
    this.headingText = this.detectHeadingText();
    this.resetHeaderObserver();
    if (assigned.length === 0 || !this.isConnected) return;
    for (const element of assigned) {
      this.headerObserver.observe(element, {
        childList: true,
        characterData: true,
        subtree: true,
      });
    }
  }

  private resetHeaderObserver(): void {
    this.headerObserver.clear();
  }

  // Only direct children slotted into `header` are scanned -- same depth
  // limit lr-dialog's own detectHeading() applies to its direct children.
  // A heading tag among them wins (its own text only, so a header slot mixing
  // a heading with e.g. a trailing icon button doesn't pull the button's
  // label into the accessible name); otherwise the header slot's combined
  // text stands in for it, since this component (unlike lr-dialog) has a
  // dedicated header slot that's already the conventional place a heading
  // would go. Recomputed only on slot assignment changes, not on every
  // render -- same rationale as lr-dialog's detectHeading().
  private detectHeadingText(): string | undefined {
    const headerChildren = Array.from(this.children).filter(
      (el) => el.getAttribute('slot') === 'header'
    );
    if (headerChildren.length === 0) return undefined;
    const heading = headerChildren.find((el) => el.matches(HEADING_SELECTOR));
    if (heading) return heading.textContent?.trim() || undefined;
    return (
      headerChildren
        .map((el) => el.textContent?.trim())
        .filter(Boolean)
        .join(' ') || undefined
    );
  }

  /**
   * Close the panel. `reason` is forwarded as `lr-close` detail.reason --
   * built-in overlay triggers pass `'escape'`/`'backdrop'`; a consumer's own
   * close affordance (e.g. a footer button, or a docked panel's own toggle)
   * should call this directly with its own reason string. `lr-close-request` is a
   * cancelable, pre-mutation veto point: a listener calling
   * `preventDefault()` leaves the panel and any active overlay chrome open.
   * It fires in both presentations (see the class doc's `lr-close` note) but
   * only returns focus to the trigger that opened it when the overlay
   * presentation is active, since the inline presentation never took focus
   * away from anything to begin with.
   */
  close(reason: LyraResponsivePanelCloseReason = 'api'): void {
    if (this.requestingOpen || !this.open) return;
    const parent = this.parentNode;
    const document = this.ownerDocument;
    const connected = this.isConnected;
    this.requestingOpen = true;
    try {
      requestThenCommit({
        requestDetail: { reason },
        emitRequest: (proposal, init: { cancelable: true }) => this.emit('lr-close-request', proposal, init),
        guard: this.openGuard,
        commit: () => {
          if (this.isConnected !== connected || this.parentNode !== parent || this.ownerDocument !== document) return;
          this.open = false;
          this.emit('lr-close', { reason });
        },
      });
    } finally {
      this.requestingOpen = false;
    }
  }

  /** Opens either presentation through the same `open` property as a controlled host write. */
  show(): void {
    this.open = true;
  }

  /** Alias of `close('api')`; the existing cancelable close request still applies. */
  hide(): void {
    this.close();
  }

  private onBackdropClick = (): void => {
    this.overlayHandle?.dismissBackdrop();
  };

  constructor() {
    super();
    // The body is the scrollport between header and footer; text content has no tab stop of its own.
    trackScrollRegions(this, () => {
      const el = this.renderRoot.querySelector<HTMLElement>('[part="body"]');
      return [el && { el, name: this.accessibleLabel ?? (this.label || this.headingText || this.localize('responsivePanel')) }];
    });
  }

  override render(): TemplateResult {
    const overlay = this.effectiveMode === 'overlay';
    const accessibleName =
      this.accessibleLabel === '' || hostAriaLabel(this) === ''
        ? ''
        : resolveAccessibleName(this, this.label, this.headingText, this.localize('responsivePanel'));
    return this.nativeModal.render(html`
      <div part="base" class=${overlay ? 'overlay' : 'inline'}>
        ${overlay
          ? html`<div part="backdrop" @click=${this.onBackdropClick}></div>`
          : nothing}
        <div
          part="panel"
          role=${overlay && !this.nativeModal.requested ? 'dialog' : nothing}
          aria-modal=${overlay && !this.nativeModal.requested ? 'true' : nothing}
          aria-label=${overlay && !this.nativeModal.requested ? accessibleName : nothing}
          tabindex=${overlay ? '-1' : nothing}
        >
          <div part="header" ?hidden=${!this.slotPresence.has('header')}>
            <slot name="header" @slotchange=${this.onHeaderSlotChange}></slot>
          </div>
          <div part="body">
            <slot></slot>
          </div>
          <div part="footer" ?hidden=${!this.slotPresence.has('footer')}>
            <slot name="footer"></slot>
          </div>
          ${this.nativeModal.renderHelperSlot()}
        </div>
      </div>
    `, { label: accessibleName });
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-responsive-panel': LyraResponsivePanel;
  }
}
