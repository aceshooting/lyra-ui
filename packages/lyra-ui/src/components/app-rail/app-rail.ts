import { html, nothing, svg, type SVGTemplateResult, type TemplateResult, type PropertyValues } from 'lit';
import { property, state } from 'lit/decorators.js';
import { LyraElement } from '../../internal/lyra-element.js';
import { defineElement } from '../../internal/prefix.js';
import { lockScroll } from '../../internal/scroll-lock.js';
import { nextId } from '../../internal/a11y.js';
import { closeIcon } from '../../internal/icons.js';
import { styles } from './app-rail.styles.js';

/** The rail's effective presentation -- see the class doc for what each renders. */
export type AppRailMode = 'full' | 'icon-only' | 'mobile';

/** What can be *assigned* to `mode` -- `'auto'` is a write-only sentinel; see the `mode` accessor doc. */
export type AppRailModeInput = AppRailMode | 'auto';

export interface AppRailModeChangeDetail {
  mode: AppRailMode;
}

export interface AppRailToggleDetail {
  open: boolean;
}

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

// Shadow-piercing so a slotted custom element's real focusable target (e.g.
// an <input> inside its own shadow root) is found even though the host tag
// itself doesn't match FOCUSABLE_SELECTOR. Deliberately duplicated from
// lyra-dialog's identical helper rather than imported/shared -- this
// component is its own standalone overlay for the mobile state and must not
// depend on lyra-dialog (see this file's class doc).
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
 *  lyra-dialog's/lyra-widget's identical helper. */
function isRendered(el: HTMLElement): boolean {
  return el.checkVisibility ? el.checkVisibility() : el.getClientRects().length > 0;
}

// icons.ts has no hamburger/menu glyph and this component must not modify
// that shared module -- inlined here instead, matching its 24x24
// viewBox/stroke-width/currentColor convention so it reads as part of the
// same icon set.
function menuIcon(): SVGTemplateResult {
  return svg`
    <svg
      width="1em"
      height="1em"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.75"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <line x1="4" y1="7" x2="20" y2="7"></line>
      <line x1="4" y1="12" x2="20" y2="12"></line>
      <line x1="4" y1="17" x2="20" y2="17"></line>
    </svg>
  `;
}

/**
 * Pure breakpoint-to-mode resolver, kept separate from the `matchMedia`
 * wiring below so it's directly unit-testable without resizing a real
 * browser window. `mobileMatches` wins over `iconOnlyMatches` when both are
 * true (the viewport is narrower than both breakpoints at once).
 */
export function computeAppRailMode(iconOnlyMatches: boolean, mobileMatches: boolean): AppRailMode {
  if (mobileMatches) return 'mobile';
  if (iconOnlyMatches) return 'icon-only';
  return 'full';
}

/**
 * `<lyra-app-rail>` — a responsive navigation rail that adapts across three
 * presentations as the *viewport* narrows (not this element's own inline
 * size — see the `mode` accessor doc for why): `'full'` (nav items show
 * icon + label, inline), `'icon-only'` (a narrower inline rail, icons only),
 * and `'mobile'` (hidden behind a toggle button; opening it shows a
 * focus-trapped floating overlay over the page).
 *
 * Breakpoints are viewport-width `matchMedia()` queries against
 * `icon-only-breakpoint`/`mobile-breakpoint`, not a `ResizeObserver` on this
 * element — a nav rail's presentation should track the actual device/window
 * width the way a native OS shell's navigation does, not however much
 * horizontal space a particular layout happens to give it.
 *
 * This is its own standalone focus-trapped overlay implementation for the
 * `'mobile'` state (`role="dialog"`, Escape/backdrop-dismissible,
 * scroll-locking while open) rather than nesting a `<lyra-dialog>` in its
 * shadow template — see `<lyra-dialog>`'s own header comment for why a new
 * overlay-shaped component in this library duplicates that pattern locally
 * instead of composing the previous one. `[part="base"]` (the inline
 * `'full'`/`'icon-only'` presentation) and `[part="panel"]` (the mobile
 * overlay) are the *same* element promoted in place across modes (mirrors
 * `<lyra-widget>`'s fullscreen mode) — never both at once, and never two
 * separate copies of the slotted content, which slot projection can't
 * produce anyway (a light-DOM node is only ever assigned to one `<slot>`).
 * It's a plain `<div>` with an explicit `role="navigation"` rather than a
 * literal `<nav>` tag: a `<nav>`'s implicit role can't be overridden to
 * `role="dialog"` while the overlay is modal without an `aria-allowed-role`
 * violation (verified against axe), whereas an explicit `role="navigation"`
 * on a generic element can be swapped for `role="dialog"` freely.
 *
 * @customElement lyra-app-rail
 * @slot - Nav items — generic slotted content (e.g. `<a>`/`<button>`
 *   elements) the consumer builds with its own icon+label structure; this
 *   component only lays them out and manages the responsive chrome around
 *   them. See the `@example` below for the accessible-name expectation this
 *   places on the slotted content in `'icon-only'` mode. While the mobile
 *   overlay is open, clicking anywhere inside this slot closes it (see
 *   `onNavItemClick`) — every slotted item is assumed to be a navigation
 *   trigger, not necessarily a real link, so this fires on any click rather
 *   than trying to detect one.
 * @slot header - Logo/brand content, shown above the nav items in every mode.
 * @slot footer - A trailing user/settings trigger, shown below the nav items.
 * @event lyra-mode-change - The effective mode changed, whether from a
 *   breakpoint crossing or an explicit `mode` assignment. Not fired for a
 *   redundant reassignment to the mode already in effect.
 *   `detail: AppRailModeChangeDetail`.
 * @event lyra-toggle - The mobile overlay opened or closed — via the
 *   built-in toggle button, Escape, a backdrop click, a nav-item click while
 *   open, or a breakpoint/forced mode change leaving `'mobile'` while open.
 *   Not fired when a consumer sets `open` directly (mirrors `<lyra-dialog>`'s
 *   `open`/`close()` split). `detail: AppRailToggleDetail`.
 * @csspart base - The rail root while inline (`'full'`/`'icon-only'` modes).
 * @csspart header - The wrapper around the `header` slot.
 * @csspart nav - The wrapper around the default (nav items) slot.
 * @csspart footer - The wrapper around the `footer` slot.
 * @csspart toggle - The mobile hamburger/close toggle button. Hidden via
 *   CSS outside `'mobile'` mode.
 * @csspart backdrop - The mobile overlay's scrim. Only rendered while open.
 * @csspart panel - The mobile overlay's floating panel — see the class doc
 *   for why it's the same element as `base`, never both at once.
 *
 * @example
 * In `'icon-only'` mode, slotted nav items lose their visible text label.
 * Give each one a real accessible name regardless — `aria-label`, visually
 * hidden text, or a `title` — since this component only lays out whatever is
 * slotted and has no way to inspect or fix up a consumer's own markup:
 * ```html
 * <lyra-app-rail>
 *   <a href="/inbox" aria-label="Inbox"><svg aria-hidden="true">...</svg><span>Inbox</span></a>
 * </lyra-app-rail>
 * ```
 */
export class LyraAppRail extends LyraElement {
  static styles = [LyraElement.styles, styles];

  // `mode` needs a custom accessor (force/auto semantics below) rather than
  // the usual @property()-generated one -- registered here, alongside the
  // decorator-declared properties below, the same way lyra-model-select's
  // form-associated `value` accessor is. `reflect: true` still applies:
  // LitElement's update loop reflects any `reflect`-flagged property to its
  // attribute generically by reading `this[name]` after render, regardless
  // of whether that property has a custom or auto-generated accessor.
  static properties = {
    mode: { reflect: true, noAccessor: true },
  };

  /** Below this viewport width, the rail switches from `'full'` to
   *  `'icon-only'`. Any valid CSS length, used directly in a `max-width`
   *  media query. */
  @property({ attribute: 'icon-only-breakpoint' }) iconOnlyBreakpoint = '960px';

  /** Below this viewport width, the rail switches from `'icon-only'` to
   *  `'mobile'`. Should be smaller than `iconOnlyBreakpoint` to produce all
   *  three states as the viewport narrows. */
  @property({ attribute: 'mobile-breakpoint' }) mobileBreakpoint = '600px';

  /** Whether the mobile floating overlay is shown. Only meaningful while
   *  `mode` is `'mobile'` — the value is preserved (not reset) while another
   *  mode is active, but no overlay chrome renders until `mode` is
   *  `'mobile'` again. Set this directly, or use the built-in toggle button
   *  — there is no separate `show()`/`hide()` pair. */
  @property({ type: Boolean, reflect: true }) open = false;

  /** Accessible name for the rail's navigation landmark, and for its dialog
   *  role while the mobile overlay is open. */
  @property() label = 'Navigation';

  @state() private hasHeaderSlot = false;
  @state() private hasFooterSlot = false;

  private _mode: AppRailMode = 'full';
  // Whether matchMedia changes are currently ignored because a consumer
  // forced a specific mode -- see the `mode` accessor doc.
  private forced = false;
  private iconOnlyMatches = false;
  private mobileMatches = false;
  private mqIconOnly?: MediaQueryList;
  private mqMobile?: MediaQueryList;
  // Derived from mode === 'mobile' && open -- tracked as its own field
  // (rather than recomputed inline everywhere) so willUpdate can detect the
  // specific false->true/true->false transition regardless of which of the
  // two source properties changed.
  private overlayActive = false;
  private justOpened = false;
  private releaseScrollLock?: () => void;
  private lastTrigger?: HTMLElement;
  private readonly navId = nextId('app-rail-nav');

  /**
   * The rail's current effective presentation. Always one of the three real
   * modes — never `'auto'` — reflecting either the live breakpoint match or,
   * once forced, whatever was last assigned.
   *
   * Assigning `'full'`/`'icon-only'`/`'mobile'` forces that mode and stops
   * this element from responding to `icon-only-breakpoint`/
   * `mobile-breakpoint` matches. Assigning the sentinel `'auto'` releases
   * the force and immediately re-syncs to the current viewport width,
   * resuming automatic tracking. `'auto'` is a write-only instruction, not a
   * value this getter ever returns — there is no way to observe "currently
   * forced" from the property itself.
   */
  get mode(): AppRailMode {
    return this._mode;
  }
  set mode(next: AppRailModeInput) {
    if (next === 'auto') {
      if (!this.forced) return;
      this.forced = false;
      this.applyComputedMode();
      return;
    }
    if (next !== 'full' && next !== 'icon-only' && next !== 'mobile') return;
    this.forced = true;
    this.setEffectiveMode(next);
  }

  protected willUpdate(changed: PropertyValues): void {
    if (!this.hasUpdated) {
      this.hasHeaderSlot = Array.from(this.children).some((el) => el.getAttribute('slot') === 'header');
      this.hasFooterSlot = Array.from(this.children).some((el) => el.getAttribute('slot') === 'footer');
    }
    if (this.hasUpdated && (changed.has('iconOnlyBreakpoint') || changed.has('mobileBreakpoint'))) {
      this.teardownMediaQueries();
      this.setupMediaQueries();
    }
    if (changed.has('open') || changed.has('mode')) {
      const next = this._mode === 'mobile' && this.open;
      if (next !== this.overlayActive) {
        this.overlayActive = next;
        if (next) {
          this.justOpened = true;
          this.releaseScrollLock = lockScroll();
          document.addEventListener('keydown', this.onDocKeyDown);
        } else {
          this.releaseScrollLock?.();
          this.releaseScrollLock = undefined;
          document.removeEventListener('keydown', this.onDocKeyDown);
        }
      }
    }
  }

  // Runs after render (not willUpdate) so [part="panel"] and its slotted
  // content have already landed in the DOM before the focus call below can
  // rely on them -- mirrors lyra-dialog's/lyra-widget's identical ordering
  // rationale.
  protected updated(): void {
    if (this.justOpened) {
      this.justOpened = false;
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
    this.setupMediaQueries();
    // A reconnect (e.g. a drag-and-drop reparent keeping this same element
    // instance) fires disconnectedCallback then connectedCallback
    // synchronously with no update in between, so willUpdate never reruns to
    // notice the overlay is still active -- restore the scroll lock/trap it
    // dropped. Mirrors lyra-dialog's/lyra-widget's identical reconnect handling.
    if (this.hasUpdated && this.overlayActive && !this.releaseScrollLock) {
      this.releaseScrollLock = lockScroll();
      document.addEventListener('keydown', this.onDocKeyDown);
    }
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.teardownMediaQueries();
    this.releaseScrollLock?.();
    this.releaseScrollLock = undefined;
    document.removeEventListener('keydown', this.onDocKeyDown);
  }

  private setupMediaQueries(): void {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    this.mqIconOnly = window.matchMedia(`(max-width: ${this.iconOnlyBreakpoint})`);
    this.mqMobile = window.matchMedia(`(max-width: ${this.mobileBreakpoint})`);
    this.mqIconOnly.addEventListener('change', this.onIconOnlyChange);
    this.mqMobile.addEventListener('change', this.onMobileChange);
    this.iconOnlyMatches = this.mqIconOnly.matches;
    this.mobileMatches = this.mqMobile.matches;
    if (!this.forced) this.applyComputedMode();
  }

  private teardownMediaQueries(): void {
    this.mqIconOnly?.removeEventListener('change', this.onIconOnlyChange);
    this.mqMobile?.removeEventListener('change', this.onMobileChange);
    this.mqIconOnly = undefined;
    this.mqMobile = undefined;
  }

  // Split into two single-query listeners (rather than one shared handler
  // reading both live MediaQueryLists) specifically so a test can invoke
  // either directly with a fabricated { matches } event -- exercising the
  // full breakpoint-response wiring without needing to actually resize the
  // browser window a test runs in.
  private onIconOnlyChange = (e: MediaQueryListEvent): void => {
    this.iconOnlyMatches = e.matches;
    if (!this.forced) this.applyComputedMode();
  };
  private onMobileChange = (e: MediaQueryListEvent): void => {
    this.mobileMatches = e.matches;
    if (!this.forced) this.applyComputedMode();
  };

  private applyComputedMode(): void {
    this.setEffectiveMode(computeAppRailMode(this.iconOnlyMatches, this.mobileMatches));
  }

  private setEffectiveMode(next: AppRailMode): void {
    if (this._mode === next) return;
    const old = this._mode;
    this._mode = next;
    this.requestUpdate('mode', old);
    this.emit<AppRailModeChangeDetail>('lyra-mode-change', { mode: next });
    // 'open' is only meaningful in 'mobile' mode -- leaving it while open
    // closes the overlay as a side effect (through setOpen, so it still
    // emits lyra-toggle and releases the scroll lock/focus trap normally)
    // rather than leaving a now-invisible overlay primed to reappear the
    // next time mode returns to 'mobile'.
    if (next !== 'mobile' && this.open) this.setOpen(false);
  }

  private setOpen(next: boolean): void {
    if (this.open === next) return;
    this.open = next;
    this.emit<AppRailToggleDetail>('lyra-toggle', { open: next });
    if (!next) this.lastTrigger?.focus();
  }

  private onToggleClick = (e: MouseEvent): void => {
    this.lastTrigger = e.currentTarget as HTMLElement;
    this.setOpen(!this.open);
  };

  private onBackdropClick = (): void => {
    this.setOpen(false);
  };

  // See the default-slot @slot doc -- any click inside the nav items while
  // the overlay is open closes it, without trying to distinguish a real
  // navigation trigger from incidental slotted content.
  private onNavItemClick = (): void => {
    if (this.overlayActive) this.setOpen(false);
  };

  private onHeaderSlotChange = (e: Event): void => {
    this.hasHeaderSlot = (e.target as HTMLSlotElement).assignedElements({ flatten: true }).length > 0;
  };
  private onFooterSlotChange = (e: Event): void => {
    this.hasFooterSlot = (e.target as HTMLSlotElement).assignedElements({ flatten: true }).length > 0;
  };

  private onDocKeyDown = (e: KeyboardEvent): void => {
    if (!this.overlayActive) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      this.setOpen(false);
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

  // Bounds Tab/Shift+Tab to the panel while the overlay is open. Order
  // follows the header slot, then the nav (default) slot, then the footer
  // slot -- the same order the flattened tree already tabs through. The
  // toggle button itself is deliberately excluded, same as a dialog trigger
  // living outside its own trap.
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
    const mobile = this._mode === 'mobile';
    return html`
      <button
        part="toggle"
        type="button"
        aria-expanded=${this.open ? 'true' : 'false'}
        aria-controls=${this.navId}
        aria-label=${this.open ? 'Close navigation' : 'Open navigation'}
        @click=${this.onToggleClick}
      >
        ${this.open ? closeIcon() : menuIcon()}
      </button>
      ${mobile && this.open ? html`<div part="backdrop" @click=${this.onBackdropClick}></div>` : nothing}
      <div
        id=${this.navId}
        part=${mobile ? 'panel' : 'base'}
        aria-label=${this.label}
        role=${this.overlayActive ? 'dialog' : 'navigation'}
        aria-modal=${this.overlayActive ? 'true' : nothing}
        tabindex=${this.overlayActive ? '-1' : nothing}
        ?inert=${mobile && !this.open}
      >
        <div part="header" ?hidden=${!this.hasHeaderSlot}>
          <slot name="header" @slotchange=${this.onHeaderSlotChange}></slot>
        </div>
        <div part="nav">
          <slot @click=${this.onNavItemClick}></slot>
        </div>
        <div part="footer" ?hidden=${!this.hasFooterSlot}>
          <slot name="footer" @slotchange=${this.onFooterSlotChange}></slot>
        </div>
      </div>
    `;
  }
}

defineElement('app-rail', LyraAppRail);

declare global {
  interface HTMLElementTagNameMap {
    'lyra-app-rail': LyraAppRail;
  }
}
