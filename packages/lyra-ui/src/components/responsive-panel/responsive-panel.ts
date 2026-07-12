import { html, nothing, type TemplateResult, type PropertyValues } from 'lit';
import { property, state } from 'lit/decorators.js';
import { LyraElement } from '../../internal/lyra-element.js';
import { defineElement } from '../../internal/prefix.js';
import { lockScroll } from '../../internal/scroll-lock.js';
import { styles } from './responsive-panel.styles.js';

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

// Shadow-piercing so a slotted custom element's real focusable target (e.g.
// an <input> inside its own shadow root) is found even though the host tag
// itself doesn't match FOCUSABLE_SELECTOR. Deliberately duplicated from
// lyra-dialog's identical helper rather than imported/shared -- every
// overlay-shaped component in this family (lyra-dialog, lyra-widget,
// lyra-tool-result-dialog, lyra-tool-select-dialog) re-implements this
// locally rather than nesting a previous overlay component inside its own
// shadow DOM, because slot-forwarding would break the inner component's own
// light-DOM scanning.
function collectFocusable(el: Element): HTMLElement[] {
  const result: HTMLElement[] = [];
  if (el.matches(FOCUSABLE_SELECTOR)) {
    result.push(el as HTMLElement);
  }
  if (el instanceof HTMLSlotElement) {
    for (const assigned of el.assignedElements({ flatten: true })) {
      result.push(...collectFocusable(assigned));
    }
    return result;
  }
  const container: Element | ShadowRoot = el.shadowRoot ?? el;
  for (const child of Array.from(container.children)) {
    result.push(...collectFocusable(child));
  }
  return result;
}

/** Whether `el` is actually laid out/paintable -- `checkVisibility()` (falling
 *  back to `getClientRects().length` where unsupported) correctly follows
 *  flattened-tree/slot assignment, unlike `offsetParent`. Mirrors
 *  lyra-dialog's identical helper. */
function isRendered(el: HTMLElement): boolean {
  return el.checkVisibility ? el.checkVisibility() : el.getClientRects().length > 0;
}

/** The `mode` property's literal value -- `'auto'` tracks the viewport
 *  breakpoint live; `'inline'`/`'overlay'` force that presentation
 *  regardless of viewport width. */
export type ResponsivePanelMode = 'inline' | 'overlay' | 'auto';

/** What `mode` actually resolves to once the breakpoint is taken into
 *  account -- `'auto'` never appears here. */
export type ResponsivePanelEffectiveMode = 'inline' | 'overlay';

export type ResponsivePanelVariant = 'fullscreen' | 'bottom-sheet';

/** Reason the panel was closed, forwarded as the `lyra-close` event detail --
 *  mirrors lyra-dialog's own `DialogCloseReason` shape. `'escape'` and
 *  `'backdrop'` are emitted by the overlay presentation's own built-in
 *  dismiss triggers (they can't occur while inline, since there's no
 *  backdrop/document-keydown trap wired up then); any other string is
 *  whatever a caller passes to `close()`. */
export type ResponsivePanelCloseReason = 'escape' | 'backdrop' | 'api' | string;

export interface ResponsivePanelModeChangeDetail {
  mode: ResponsivePanelEffectiveMode;
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
 * `<lyra-responsive-panel>` — the same slotted content either docked inline
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
 * it for free, with no extra bookkeeping required. The one exception is
 * focus: crossing the breakpoint while already open does *not* forcibly
 * move focus into the panel (unlike an `open` transition, which does) --
 * doing so on a resize could yank focus away from an input the user is
 * actively typing into inside the now-newly-modal panel, which is worse UX
 * than a modal that's very briefly missing its initial focus placement.
 *
 * The overlay presentation duplicates lyra-dialog's `role="dialog"` +
 * focus-trap + Escape/backdrop-dismiss + scroll-lock mechanics locally
 * rather than nesting a `<lyra-dialog>` inside this component's shadow DOM,
 * per the established precedent for every overlay-shaped component in this
 * family (see lyra-dialog's own module doc).
 *
 * @customElement lyra-responsive-panel
 * @slot - The panel body.
 * @slot header - Optional header content, rendered above the body.
 * @slot footer - Optional footer content (e.g. action buttons), rendered below the body.
 * @event lyra-close - `detail: ResponsivePanelCloseReason`. Fired by the overlay presentation's
 *   built-in dismiss triggers (Escape, backdrop click) and by any `close()` call, in either
 *   presentation -- a plain `open = false` property write does not fire it (matching
 *   lyra-dialog's own precedent: only going through `close()` counts as a dismissal), and this
 *   is deliberately the same event/semantics in both presentations, rather than only being
 *   meaningful for the overlay case, so a consumer only has to wire up one listener regardless
 *   of which presentation is currently active.
 * @event lyra-mode-change - `detail: ResponsivePanelModeChangeDetail`. Fired whenever the
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
 */
export class LyraResponsivePanel extends LyraElement {
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
   *  presentation, which has no dialog semantics to name. */
  @property() label = '';

  /** CSS length passed to `matchMedia` as `(max-width: <this>)` to decide, in `mode="auto"`,
   *  whether the effective presentation is `'overlay'` (below/at this width) or `'inline'`
   *  (above it). */
  @property({ attribute: 'mobile-breakpoint' }) mobileBreakpoint = '768px';

  @state() private belowBreakpoint = false;
  @state() private effectiveMode: ResponsivePanelEffectiveMode = 'inline';
  @state() private hasHeaderSlot = false;
  @state() private hasFooterSlot = false;

  private mediaQuery?: MediaQueryList;
  private releaseScrollLock?: () => void;
  private lastTrigger?: HTMLElement;
  /** Whether the overlay-only mechanics (scroll-lock, document Escape/Tab trap) are currently
   *  engaged -- derived from `effectiveMode === 'overlay' && open`, tracked separately from those
   *  two properties so willUpdate can diff "was engaged" vs "should be engaged now" regardless of
   *  which of the two changed. */
  private overlayChromeActive = false;
  private isFirstUpdate = true;

  protected willUpdate(changed: PropertyValues): void {
    this.isFirstUpdate = !this.hasUpdated;
    if (this.isFirstUpdate) {
      this.hasHeaderSlot = Array.from(this.children).some((el) => el.getAttribute('slot') === 'header');
      this.hasFooterSlot = Array.from(this.children).some((el) => el.getAttribute('slot') === 'footer');
    }
    if (this.isFirstUpdate || changed.has('mode') || changed.has('belowBreakpoint')) {
      this.effectiveMode = resolveEffectiveMode(this.mode, this.belowBreakpoint);
    }
    if (changed.has('mobileBreakpoint') && this.isConnected) {
      this.setupMediaQuery();
    }

    const overlayOpen = this.effectiveMode === 'overlay' && this.open;
    if (overlayOpen !== this.overlayChromeActive) {
      this.overlayChromeActive = overlayOpen;
      if (overlayOpen) {
        const active = this.getActiveElement();
        this.lastTrigger = active instanceof HTMLElement ? active : undefined;
        this.releaseScrollLock = lockScroll();
        document.addEventListener('keydown', this.onDocKeyDown);
      } else {
        this.releaseScrollLock?.();
        this.releaseScrollLock = undefined;
        document.removeEventListener('keydown', this.onDocKeyDown);
      }
    }
  }

  // Runs after render (not willUpdate) so [part="panel"] has already landed
  // in the DOM before the fallback .focus() call below can rely on it --
  // mirrors lyra-dialog's identical ordering rationale. Only a genuine `open`
  // transition steals focus (see the class doc for why a breakpoint-crossing
  // while already open deliberately does not).
  protected updated(changed: PropertyValues): void {
    if (!this.isFirstUpdate && changed.has('effectiveMode')) {
      this.emit<ResponsivePanelModeChangeDetail>('lyra-mode-change', { mode: this.effectiveMode });
    }
    if (changed.has('open') && this.open && this.effectiveMode === 'overlay') {
      const first = this.getFocusableElements()[0];
      if (first) {
        first.focus();
      } else {
        this.shadowRoot?.querySelector<HTMLElement>('[part="panel"]')?.focus();
      }
    }
  }

  connectedCallback(): void {
    super.connectedCallback();
    this.setupMediaQuery();
    // A reconnect (e.g. a drag-and-drop reparent keeping this same element
    // instance) fires disconnectedCallback then connectedCallback
    // synchronously with no update in between, so willUpdate never reruns to
    // notice overlay chrome is still supposed to be active -- restore it.
    // Mirrors lyra-dialog's identical reconnect handling.
    if (this.hasUpdated && this.overlayChromeActive && !this.releaseScrollLock) {
      this.releaseScrollLock = lockScroll();
      document.addEventListener('keydown', this.onDocKeyDown);
    }
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.mediaQuery?.removeEventListener('change', this.onMediaChange);
    this.mediaQuery = undefined;
    this.releaseScrollLock?.();
    this.releaseScrollLock = undefined;
    document.removeEventListener('keydown', this.onDocKeyDown);
  }

  private setupMediaQuery(): void {
    this.mediaQuery?.removeEventListener('change', this.onMediaChange);
    this.mediaQuery = window.matchMedia(`(max-width: ${this.mobileBreakpoint})`);
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
  };

  private onFooterSlotChange = (e: Event): void => {
    this.hasFooterSlot = (e.target as HTMLSlotElement).assignedElements({ flatten: true }).length > 0;
  };

  /**
   * Close the panel. `reason` is forwarded as the `lyra-close` detail --
   * built-in overlay triggers pass `'escape'`/`'backdrop'`; a consumer's own
   * close affordance (e.g. a footer button, or a docked panel's own toggle)
   * should call this directly with its own reason string. Fires in both
   * presentations (see the class doc's `lyra-close` note) but only returns
   * focus to the trigger that opened it when the overlay presentation is
   * active, since the inline presentation never took focus away from
   * anything to begin with.
   */
  close(reason: ResponsivePanelCloseReason = 'api'): void {
    if (!this.open) return;
    this.open = false;
    this.emit<ResponsivePanelCloseReason>('lyra-close', reason);
    if (this.effectiveMode === 'overlay') {
      this.lastTrigger?.focus();
    }
  }

  private onBackdropClick = (): void => {
    this.close('backdrop');
  };

  private onDocKeyDown = (e: KeyboardEvent): void => {
    if (!this.overlayChromeActive) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      this.close('escape');
      return;
    }
    if (e.key !== 'Tab') return;
    const focusable = this.getFocusableElements();
    if (focusable.length === 0) {
      e.preventDefault();
      return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = this.getActiveElement();
    if (e.shiftKey && active === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus();
    }
  };

  // Bounds Tab/Shift+Tab to the panel while overlay chrome is active. Order
  // follows the header slot, then the body slot, then the footer slot -- the
  // same order the flattened tree already tabs through.
  private getFocusableElements(): HTMLElement[] {
    const root = this.shadowRoot;
    if (!root) return [];
    const fromSlot = (selector: string): HTMLElement[] => {
      const slot = root.querySelector<HTMLSlotElement>(selector);
      return slot ? slot.assignedElements({ flatten: true }).flatMap(collectFocusable) : [];
    };
    return [
      ...fromSlot('slot[name="header"]'),
      ...fromSlot('slot:not([name])'),
      ...fromSlot('slot[name="footer"]'),
    ].filter(isRendered);
  }

  private getActiveElement(): Element | null {
    let active: Element | null = document.activeElement;
    while (active) {
      const inner: Element | null = active.shadowRoot?.activeElement ?? null;
      if (!inner) break;
      active = inner;
    }
    return active;
  }

  render(): TemplateResult {
    const overlay = this.effectiveMode === 'overlay';
    return html`
      <div part="base" class=${overlay ? 'overlay' : 'inline'}>
        ${overlay ? html`<div part="backdrop" @click=${this.onBackdropClick}></div>` : nothing}
        <div
          part="panel"
          role=${overlay ? 'dialog' : nothing}
          aria-modal=${overlay ? 'true' : nothing}
          aria-label=${overlay && this.label ? this.label : nothing}
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

defineElement('responsive-panel', LyraResponsivePanel);

declare global {
  interface HTMLElementTagNameMap {
    'lyra-responsive-panel': LyraResponsivePanel;
  }
}
