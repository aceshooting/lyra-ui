import { html, nothing, svg, type SVGTemplateResult, type TemplateResult, type PropertyValues } from 'lit';
import { property, state } from 'lit/decorators.js';
import { LyraElement } from '../../internal/lyra-element.js';
import { activateOverlay, type OverlayHandle } from '../../internal/overlay-manager.js';
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
 * The `'mobile'` state participates in the library's shared overlay stack,
 * which supplies focus trapping, Escape/backdrop dismissal, inerting, and
 * focus restoration without nesting a `<lyra-dialog>` in this component's
 * shadow template. `[part="base"]` (the inline
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
  private overlayHandle?: OverlayHandle;
  private explicitTrigger?: HTMLElement;
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
          this.activateMobileOverlay();
        } else {
          this.deactivateMobileOverlay();
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
      this.overlayHandle?.focusInitial();
    }
  }

  connectedCallback(): void {
    super.connectedCallback();
    this.setupMediaQueries();
    // A reconnect (e.g. a drag-and-drop reparent keeping this same element
    // instance) fires disconnectedCallback then connectedCallback
    // synchronously with no update in between, so willUpdate never reruns to
    // notice the overlay is still active -- restore its shared registration
    // and scroll lock.
    if (this.hasUpdated && this._mode === 'mobile' && this.open) {
      if (this.overlayHandle?.isActive()) {
        this.overlayHandle.resume();
      } else {
        this.activateMobileOverlay();
      }
      if (!this.releaseScrollLock) this.releaseScrollLock = lockScroll(this.ownerDocument);
      queueMicrotask(() => this.overlayHandle?.focusInitial());
    }
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.teardownMediaQueries();
    this.releaseScrollLock?.();
    this.releaseScrollLock = undefined;
    this.overlayHandle?.suspend();
  }

  private activateMobileOverlay(): void {
    this.releaseScrollLock ??= lockScroll(this.ownerDocument);
    this.overlayHandle = activateOverlay({
      host: this,
      panel: () => this.shadowRoot?.querySelector<HTMLElement>('[part="panel"]') ?? null,
      onEscape: () => this.setOpen(false),
      onBackdrop: () => this.setOpen(false),
      restoreFocusTo: this.explicitTrigger,
    });
    this.explicitTrigger = undefined;
  }

  private deactivateMobileOverlay(): void {
    this.releaseScrollLock?.();
    this.releaseScrollLock = undefined;
    this.overlayHandle?.deactivate();
    this.overlayHandle = undefined;
  }

  private setupMediaQueries(): void {
    const view = this.ownerDocument.defaultView;
    if (!view?.matchMedia) return;
    this.mqIconOnly = view.matchMedia(`(max-width: ${this.iconOnlyBreakpoint})`);
    this.mqMobile = view.matchMedia(`(max-width: ${this.mobileBreakpoint})`);
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
  }

  private onToggleClick = (e: MouseEvent): void => {
    if (!this.open) this.explicitTrigger = e.currentTarget as HTMLElement;
    this.setOpen(!this.open);
  };

  private onBackdropClick = (): void => {
    this.overlayHandle?.dismissBackdrop();
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
