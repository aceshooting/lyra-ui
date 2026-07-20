import { html, nothing, type TemplateResult, type PropertyValues } from 'lit';
import { property, state } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { activateOverlay, deepActiveElement, type OverlayHandle } from '../../../internal/overlay-manager.js';
import { lockScroll } from '../../../internal/scroll-lock.js';
import { styles } from './responsive-panel.styles.js';

const HEADING_SELECTOR = 'h1, h2, h3, h4, h5, h6, [role="heading"]';

/** The `mode` property's literal value -- `'auto'` tracks the viewport
 *  breakpoint live; `'inline'`/`'overlay'` force that presentation
 *  regardless of viewport width. */
export type ResponsivePanelMode = 'inline' | 'overlay' | 'auto';

/** What `mode` actually resolves to once the breakpoint is taken into
 *  account -- `'auto'` never appears here. */
export type ResponsivePanelEffectiveMode = 'inline' | 'overlay';

export type ResponsivePanelVariant = 'fullscreen' | 'bottom-sheet';

/** Reason the panel was closed, forwarded as the `lr-close` event detail --
 *  mirrors lr-dialog's own `DialogCloseReason` shape. `'escape'` and
 *  `'backdrop'` are emitted by the overlay presentation's own built-in
 *  dismiss triggers (they can't occur while inline, since there's no
 *  backdrop/document-keydown trap wired up then); any other string is
 *  whatever a caller passes to `close()`. */
export type ResponsivePanelCloseReason = 'escape' | 'backdrop' | 'api' | (string & Record<never, never>);

export interface ResponsivePanelModeChangeDetail {
  mode: ResponsivePanelEffectiveMode;
}

export interface LyraResponsivePanelEventMap {
  'lr-close': CustomEvent<ResponsivePanelCloseReason>;
  'lr-mode-change': CustomEvent<ResponsivePanelModeChangeDetail>;
}

/**
 * Pure resolution of the `mode` prop + current viewport into the actual
 * presentation. Kept separate from the `matchMedia` listener wiring below so
 * it's independently unit-testable, and so the live-viewport-response logic
 * can be exercised in tests by calling it (or the instance method that wraps
 * it) directly instead of needing control over the real browser window,
 * which `@web/test-runner` doesn't give.
 */
export function resolveEffectiveMode(mode: ResponsivePanelMode, belowBreakpoint: boolean): ResponsivePanelEffectiveMode {
  if (mode === 'inline' || mode === 'overlay') return mode;
  return belowBreakpoint ? 'overlay' : 'inline';
}

/**
 * `<lr-responsive-panel>` — the same slotted content either docked inline
 * in the page's normal layout flow (desktop) or presented as a full-screen/
 * bottom-sheet overlay (mobile), depending on viewport width. Typical uses:
 * a settings panel or a conversation-history sidebar that's a permanent
 * docked pane on a wide screen but a modal on a phone.
 *
 * Breakpoint detection uses `matchMedia('(max-width: ' + mobileBreakpoint +
 * ')')`, re-evaluated live while connected -- resizing/rotating a device
 * that crosses the breakpoint while `mode="auto"` (the default) updates the
 * effective presentation without unmounting or re-creating the slotted
 * content: inline and overlay presentation share the exact same shadow DOM
 * structure (only a css class, and the overlay-only `role`/`aria-modal`
 * attributes and backdrop element, differ), so lit-html's diffing keeps
 * `[part="body"]` and its `<slot>` as the same DOM node across the
 * transition -- scroll position and focus inside the slotted content survive
 * it for free. When an open inline panel becomes modal, focus already inside
 * is preserved and outside focus moves to the first available target. Closing
 * still returns to the opener captured by the original inline open.
 *
 * The overlay presentation uses the library's shared overlay coordinator for
 * focus trapping, Escape/backdrop dismissal, inerting, and stack ordering,
 * while retaining this component's own responsive rendering and close event.
 *
 * Accessible name (overlay presentation only -- the inline presentation has
 * no dialog semantics to name), in priority order: if the host element itself
 * has an `aria-label` attribute set, its value wins outright, overriding
 * every source below -- the standard ARIA convention for a consumer that
 * wants full control over the announced name, matching lr-dialog's
 * `accessibleLabel` pattern. Otherwise `label`, when set, is used verbatim.
 * When both are empty, this falls back to the `header` slot's content -- a
 * heading element (`h1`–`h6` or `[role="heading"]`) among the slotted header
 * content wins if present, otherwise the header slot's full text content is
 * used, mirroring lr-dialog's `detectHeading()`/`headingText` fallback (see
 * dialog.ts's module doc for why this uses `aria-label`, a copied string,
 * rather than `aria-labelledby`: the header content is light DOM while
 * `[part="panel"]` lives in this element's shadow tree, and an ID-reference
 * attribute can't resolve across that boundary). A panel opened without a
 * host `aria-label`, `label`, or header content still renders `role="dialog"`
 * with no accessible name -- set one of those to avoid that.
 *
 * @customElement lr-responsive-panel
 * @slot - The panel body.
 * @slot header - Optional header content, rendered above the body.
 * @slot footer - Optional footer content (e.g. action buttons), rendered below the body.
 * @event lr-close - `detail: ResponsivePanelCloseReason`. Fired by the overlay presentation's
 *   built-in dismiss triggers (Escape, backdrop click) and by any `close()` call, in either
 *   presentation -- a plain `open = false` property write does not fire it (matching
 *   lr-dialog's own precedent: only going through `close()` counts as a dismissal), and this
 *   is deliberately the same event/semantics in both presentations, rather than only being
 *   meaningful for the overlay case, so a consumer only has to wire up one listener regardless
 *   of which presentation is currently active.
 * @event lr-mode-change - `detail: ResponsivePanelModeChangeDetail`. Fired whenever the
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
 * @cssprop [--lr-responsive-panel-overlay-color=var(--lr-color-overlay)] - The overlay
 *   presentation's scrim color, applied to `[part="backdrop"]`.
 * @cssprop [--lr-responsive-panel-sheet-max-block-size=85dvh] - Maximum height of the
 *   `variant="bottom-sheet"` overlay panel (falls back to `85vh` where `dvh` is unsupported).
 */
export class LyraResponsivePanel extends LyraElement<LyraResponsivePanelEventMap> {
  static styles = [LyraElement.styles, styles];

  /** Whether the panel is open. In the inline presentation this just means visible/mounted; in
   *  the overlay presentation this is the actual modal open/closed state. */
  @property({ type: Boolean, reflect: true }) open = false;

  /** `'auto'` (default) tracks `mobile-breakpoint` live; `'inline'`/`'overlay'` force that
   *  presentation regardless of viewport width. */
  @property({ reflect: true }) mode: ResponsivePanelMode = 'auto';

  /** Only affects the overlay presentation's visual treatment -- `'fullscreen'` (default) covers
   *  the whole viewport; `'bottom-sheet'` slides up from the bottom and doesn't cover the full
   *  height. */
  @property({ reflect: true }) variant: ResponsivePanelVariant = 'fullscreen';

  /** Accessible name for the overlay presentation's `role="dialog"`. Unused in the inline
   *  presentation, which has no dialog semantics to name. When empty, falls back to the `header`
   *  slot's content -- see the class doc for the full fallback order. */
  @property() label = '';

  /** CSS length passed to `matchMedia` as `(max-width: <this>)` to decide, in `mode="auto"`,
   *  whether the effective presentation is `'overlay'` (below/at this width) or `'inline'`
   *  (above it). */
  @property({ attribute: 'mobile-breakpoint' }) mobileBreakpoint = '768px';

  /** Host-level `aria-label` override for the overlay presentation's accessible name -- wins over
   *  every other source (`label`, the header-slot fallback), matching `<lr-dialog>`'s
   *  `accessibleLabel` pattern. See the class doc for the full precedence order. Set as a plain
   *  `aria-label` attribute on `<lr-responsive-panel>` itself, not a public JS property. */
  @property({ attribute: 'aria-label' }) private accessibleLabel: string | null = null;

  @state() private belowBreakpoint = false;
  @state() private effectiveMode: ResponsivePanelEffectiveMode = 'inline';
  @state() private hasHeaderSlot = false;
  @state() private hasFooterSlot = false;
  /** Fallback accessible name sourced from the `header` slot's content -- see `detectHeadingText()`. */
  @state() private headingText?: string;

  private mediaQuery?: MediaQueryList;
  private releaseScrollLock?: () => void;
  private lastTrigger?: HTMLElement;
  private overlayHandle?: OverlayHandle;
  /** Whether the overlay-only mechanics (scroll-lock and shared overlay registration) are currently
   *  engaged -- derived from `effectiveMode === 'overlay' && open`, tracked separately from those
   *  two properties so willUpdate can diff "was engaged" vs "should be engaged now" regardless of
   *  which of the two changed. */
  private overlayChromeActive = false;
  private focusOverlayAfterUpdate = false;
  private isFirstUpdate = true;

  protected willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed);
    this.isFirstUpdate = !this.hasUpdated;
    if (this.isFirstUpdate) {
      this.hasHeaderSlot = Array.from(this.children).some((el) => el.getAttribute('slot') === 'header');
      this.hasFooterSlot = Array.from(this.children).some((el) => el.getAttribute('slot') === 'footer');
      this.headingText = this.detectHeadingText();
    }
    // Must run before the effectiveMode computation below reads
    // belowBreakpoint: setupMediaQuery() -> handleBreakpointChange() mutates
    // belowBreakpoint synchronously, and a runtime mobileBreakpoint change is
    // otherwise the only kind of change in this method that doesn't itself
    // touch mode/belowBreakpoint, so computing effectiveMode first would read
    // the not-yet-updated belowBreakpoint and never get another chance to
    // react -- a property write from inside willUpdate doesn't schedule a
    // fresh update, it only folds into the one already in progress.
    // mobileBreakpoint is present on the very first willUpdate too (Lit's
    // changed-properties map includes every class-field default from
    // construction), but connectedCallback() already called setupMediaQuery()
    // once before this first update runs, so repeating it here would be
    // redundant -- only a live post-mount change should re-run it.
    if (!this.isFirstUpdate && changed.has('mobileBreakpoint') && this.isConnected) {
      this.setupMediaQuery();
    }
    if (this.isFirstUpdate || changed.has('mode') || changed.has('belowBreakpoint')) {
      this.effectiveMode = resolveEffectiveMode(this.mode, this.belowBreakpoint);
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
      this.lastTrigger = active && typeof (active as HTMLElement).focus === 'function' ? (active as HTMLElement) : undefined;
    }

    const overlayOpen = this.effectiveMode === 'overlay' && this.open;
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
        this.deactivateOverlayChrome(changed.has('open') && !this.open);
      }
    }
    if (changed.has('open') && !this.open) this.lastTrigger = undefined;
  }

  // Runs after render (not willUpdate) so [part="panel"] has already landed
  // in the DOM before the fallback .focus() call below can rely on it --
  // mirrors lr-dialog's identical ordering rationale.
  protected updated(changed: PropertyValues): void {
    super.updated(changed);
    if (!this.isFirstUpdate && changed.has('effectiveMode')) {
      this.emit<ResponsivePanelModeChangeDetail>('lr-mode-change', { mode: this.effectiveMode });
    }
    if (this.focusOverlayAfterUpdate) {
      this.focusOverlayAfterUpdate = false;
      this.overlayHandle?.focusInitial();
    }
  }

  connectedCallback(): void {
    super.connectedCallback();
    this.setupMediaQuery();
    // A reconnect (e.g. a drag-and-drop reparent keeping this same element
    // instance) fires disconnectedCallback then connectedCallback
    // synchronously with no update in between, so willUpdate never reruns to
    // notice overlay chrome is still supposed to be active -- restore it.
    const overlayOpen = resolveEffectiveMode(this.mode, this.belowBreakpoint) === 'overlay' && this.open;
    if (this.hasUpdated && overlayOpen) {
      if (this.overlayHandle?.isActive()) {
        this.overlayHandle.resume();
      } else {
        this.activateOverlayChrome();
      }
      if (!this.releaseScrollLock) this.releaseScrollLock = lockScroll(this.ownerDocument);
      queueMicrotask(() => this.overlayHandle?.focusInitial());
    }
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.mediaQuery?.removeEventListener('change', this.onMediaChange);
    this.mediaQuery = undefined;
    this.releaseScrollLock?.();
    this.releaseScrollLock = undefined;
    this.overlayHandle?.suspend();
  }

  private activateOverlayChrome(): void {
    this.releaseScrollLock ??= lockScroll(this.ownerDocument);
    this.overlayHandle = activateOverlay({
      host: this,
      panel: () => this.shadowRoot?.querySelector<HTMLElement>('[part="panel"]') ?? null,
      onEscape: () => this.close('escape'),
      onBackdrop: () => this.close('backdrop'),
      restoreFocusTo: this.lastTrigger ?? null,
    });
  }

  private deactivateOverlayChrome(restoreFocus = true): void {
    this.releaseScrollLock?.();
    this.releaseScrollLock = undefined;
    this.overlayHandle?.deactivate({ restoreFocus });
    this.overlayHandle = undefined;
  }

  private setupMediaQuery(): void {
    this.mediaQuery?.removeEventListener('change', this.onMediaChange);
    const view = this.ownerDocument.defaultView;
    if (!view?.matchMedia) {
      this.mediaQuery = undefined;
      return;
    }
    this.mediaQuery = view.matchMedia(`(max-width: ${this.mobileBreakpoint})`);
    this.mediaQuery.addEventListener('change', this.onMediaChange);
    this.handleBreakpointChange(this.mediaQuery.matches);
  }

  private onMediaChange = (e: MediaQueryListEvent): void => {
    this.handleBreakpointChange(e.matches);
  };

  /** The breakpoint-response logic itself, kept callable independently of the
   *  `matchMedia` listener that normally drives it -- tests invoke this
   *  directly to simulate crossing the breakpoint. */
  private handleBreakpointChange(matches: boolean): void {
    this.belowBreakpoint = matches;
  }

  private onHeaderSlotChange = (e: Event): void => {
    this.hasHeaderSlot = (e.target as HTMLSlotElement).assignedElements({ flatten: true }).length > 0;
    this.headingText = this.detectHeadingText();
  };

  private onFooterSlotChange = (e: Event): void => {
    this.hasFooterSlot = (e.target as HTMLSlotElement).assignedElements({ flatten: true }).length > 0;
  };

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
    const headerChildren = Array.from(this.children).filter((el) => el.getAttribute('slot') === 'header');
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
   * Close the panel. `reason` is forwarded as the `lr-close` detail --
   * built-in overlay triggers pass `'escape'`/`'backdrop'`; a consumer's own
   * close affordance (e.g. a footer button, or a docked panel's own toggle)
   * should call this directly with its own reason string. Fires in both
   * presentations (see the class doc's `lr-close` note) but only returns
   * focus to the trigger that opened it when the overlay presentation is
   * active, since the inline presentation never took focus away from
   * anything to begin with.
   */
  close(reason: ResponsivePanelCloseReason = 'api'): void {
    if (!this.open) return;
    this.open = false;
    this.emit<ResponsivePanelCloseReason>('lr-close', reason);
  }

  private onBackdropClick = (): void => {
    this.overlayHandle?.dismissBackdrop();
  };

  render(): TemplateResult {
    const overlay = this.effectiveMode === 'overlay';
    const accessibleName = this.accessibleLabel ?? (this.label || this.headingText);
    return html`
      <div part="base" class=${overlay ? 'overlay' : 'inline'}>
        ${overlay ? html`<div part="backdrop" @click=${this.onBackdropClick}></div>` : nothing}
        <div
          part="panel"
          role=${overlay ? 'dialog' : nothing}
          aria-modal=${overlay ? 'true' : nothing}
          aria-label=${overlay && accessibleName ? accessibleName : nothing}
          tabindex=${overlay ? '-1' : nothing}
        >
          <div part="header" ?hidden=${!this.hasHeaderSlot}>
            <slot name="header" @slotchange=${this.onHeaderSlotChange}></slot>
          </div>
          <div part="body">
            <slot></slot>
          </div>
          <div part="footer" ?hidden=${!this.hasFooterSlot}>
            <slot name="footer" @slotchange=${this.onFooterSlotChange}></slot>
          </div>
        </div>
      </div>
    `;
  }
}


declare global {
  interface HTMLElementTagNameMap {
    'lr-responsive-panel': LyraResponsivePanel;
  }
}
