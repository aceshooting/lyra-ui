import { html, nothing, svg, type SVGTemplateResult, type TemplateResult, type PropertyValues } from 'lit';
import { property, query, state } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { activateOverlay, type OverlayHandle } from '../../../internal/overlay-manager.js';
import { lockScroll } from '../../../internal/scroll-lock.js';
import { nextId } from '../../../internal/a11y.js';
import { closeIcon } from '../../../internal/icons.js';
import { tag } from '../../../internal/prefix.js';
import { isRtl } from '../../../internal/rtl.js';
import { finiteRange } from '../../../internal/numbers.js';
import { styles } from './app-rail.styles.js';
import './app-rail-item.class.js';

/** The rail's effective presentation -- see the class doc for what each renders. */
export type AppRailMode = 'full' | 'icon-only' | 'mobile';

/** What can be *assigned* to `mode` -- `'auto'` is a write-only sentinel; see the `mode` accessor doc. */
export type AppRailModeInput = AppRailMode | 'auto';

/** The non-mobile axis of {@link AppRailMode} -- what `preferred-mode` can manually prefer between,
 *  since the `mobile-breakpoint` continues to be tracked automatically regardless (see
 *  `preferredMode`'s own doc). */
export type AppRailPreferredMode = Exclude<AppRailMode, 'mobile'>;

export interface AppRailModeChangeDetail {
  mode: AppRailMode;
}

export interface AppRailToggleDetail {
  open: boolean;
}

export interface AppRailResizeDetail {
  widthPx: number;
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
 * browser window. `mobileMatches` wins over everything else when true (the
 * viewport is narrower than both breakpoints at once); otherwise
 * `preferredMode` (when set) wins over `iconOnlyMatches` — a manual
 * preference for the full/icon-only axis specifically, while the mobile
 * breakpoint continues to be tracked automatically regardless.
 */
export function computeAppRailMode(
  iconOnlyMatches: boolean,
  mobileMatches: boolean,
  preferredMode?: AppRailPreferredMode | null,
): AppRailMode {
  if (mobileMatches) return 'mobile';
  if (preferredMode) return preferredMode;
  if (iconOnlyMatches) return 'icon-only';
  return 'full';
}

export interface LyraAppRailEventMap {
  'lr-mode-change': CustomEvent<AppRailModeChangeDetail>;
  'lr-toggle': CustomEvent<AppRailToggleDetail>;
  'lr-rail-resize': CustomEvent<AppRailResizeDetail>;
}
/**
 * `<lr-app-rail>` — a responsive navigation rail that adapts across three
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
 * focus restoration without nesting a `<lr-dialog>` in this component's
 * shadow template. `[part="base"]` (the inline
 * `'full'`/`'icon-only'` presentation) and `[part="panel"]` (the mobile
 * overlay) are the *same* element promoted in place across modes (mirrors
 * `<lr-widget>`'s fullscreen mode) — never both at once, and never two
 * separate copies of the slotted content, which slot projection can't
 * produce anyway (a light-DOM node is only ever assigned to one `<slot>`).
 * It's a plain `<div>` with an explicit `role="navigation"` rather than a
 * literal `<nav>` tag: a `<nav>`'s implicit role can't be overridden to
 * `role="dialog"` while the overlay is modal without an `aria-allowed-role`
 * violation (verified against axe), whereas an explicit `role="navigation"`
 * on a generic element can be swapped for `role="dialog"` freely.
 *
 * @customElement lr-app-rail
 * @slot - Nav items. Use `<lr-app-rail-item>` for the explicit icon/label
 *   contract that automatically hides labels in `'icon-only'` mode. Generic
 *   links and buttons remain supported, but their compact presentation is the
 *   consumer's responsibility. While the mobile overlay is open, clicking
 *   anywhere inside this slot closes it.
 * @slot header - Logo/brand content, shown above the nav items in every mode.
 * @slot footer - A trailing user/settings trigger, shown below the nav items.
 * @event lr-mode-change - The effective mode changed, whether from a
 *   breakpoint crossing or an explicit `mode` assignment. Not fired for a
 *   redundant reassignment to the mode already in effect.
 *   `detail: AppRailModeChangeDetail`.
 * @event lr-toggle - The mobile overlay is opening or closing — via the
 *   built-in toggle button, Escape, a backdrop click, a nav-item click while
 *   open, or a breakpoint/forced mode change leaving `'mobile'` while open.
 *   Not fired when a consumer sets `open` directly (mirrors `<lr-dialog>`'s
 *   `open`/`close()` split). `detail: AppRailToggleDetail`. Cancelable for
 *   every trigger except the forced mode-change close, which always applies
 *   (vetoing it would leave `open` stuck `true` in a mode where it's
 *   meaningless) -- call `preventDefault()` to keep the overlay as it is.
 * @event lr-rail-resize - The `resizable` rail's width changed via drag or keyboard stepping.
 *   Not fired when a consumer sets `railWidthPx` directly. `detail: AppRailResizeDetail`.
 * @csspart base - The rail root while inline (`'full'`/`'icon-only'` modes).
 * @csspart header - The wrapper around the `header` slot.
 * @csspart nav - The wrapper around the default (nav items) slot.
 * @csspart footer - The wrapper around the `footer` slot.
 * @csspart toggle - The mobile hamburger/close toggle button. Hidden via
 *   CSS outside `'mobile'` mode, or entirely via `hideToggle`.
 * @csspart backdrop - The mobile overlay's scrim. Only rendered while open.
 * @csspart panel - The mobile overlay's floating panel — see the class doc
 *   for why it's the same element as `base`, never both at once.
 * @csspart resizer - The `resizable` opt-in's drag handle -- its interactive hit target, sized to
 *   the shared minimum tappable size (`--lr-icon-button-size`), independent of the slimmer
 *   visible line rendered by its `resizer-track` child. Only rendered while `resizable` and `mode`
 *   is `'full'`.
 * @csspart resizer-track - The resizer's slim visible drag line, centered inside `[part="resizer"]`'s
 *   larger hit target (mirrors `<lr-swatch-picker>`'s `[part="swatch"]`/`[part="swatch-fill"]`
 *   split). Colors on hover/focus the same way the whole handle previously did.
 * @cssprop [--lr-app-rail-width=var(--lr-size-15rem)] - The inline rail's width in `'full'` mode.
 *   Overridden by an inline width while a `resizable` rail has an explicit `railWidthPx`.
 * @cssprop [--lr-app-rail-icon-width=var(--lr-size-4rem)] - The inline rail's width in
 *   `'icon-only'` mode, and the maximum width of each slotted `<lr-app-rail-item>` in that mode.
 * @cssprop [--lr-app-rail-mobile-width=var(--lr-size-18rem)] - The mobile overlay panel's width,
 *   capped at `85vw`.
 * @cssprop [--lr-app-rail-overlay-color=var(--lr-color-overlay)] - The mobile overlay scrim's
 *   background.
 *
 * @example
 * Use the item contract so the visible label collapses while its accessible
 * name remains available:
 * ```html
 * <lr-app-rail>
 *   <lr-app-rail-item href="/inbox" aria-label="Inbox">
 *     <svg slot="icon" aria-hidden="true">...</svg>Inbox
 *   </lr-app-rail-item>
 * </lr-app-rail>
 * ```
 */
export class LyraAppRail extends LyraElement<LyraAppRailEventMap> {
  static override styles = [LyraElement.styles, styles];

  // `mode` needs a custom accessor (force/auto semantics below) rather than
  // the usual @property()-generated one -- registered here, alongside the
  // decorator-declared properties below, the same way lr-model-select's
  // form-associated `value` accessor is. `reflect: true` still applies:
  // LitElement's update loop reflects any `reflect`-flagged property to its
  // attribute generically by reading `this[name]` after render, regardless
  // of whether that property has a custom or auto-generated accessor.
  static override properties = {
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
   *  role while the mobile overlay is open. A host-level `aria-label`
   *  attribute takes precedence over this when both are set -- see
   *  `accessibleLabel`. */
  @property() label = 'Navigation';

  /** Accessible name overriding `label` (and its localized default) for the nav landmark / dialog
   *  role, mirroring `<lr-date-input>`'s `accessibleLabel` pattern. Reads the host's own
   *  `aria-label` attribute -- unset (the default, `null`) reproduces today's exact
   *  `label`/localized-default output. */
  @property({ attribute: 'aria-label' }) private accessibleLabel: string | null = null;

  /** Manually prefers `'full'` or `'icon-only'` for the non-mobile breakpoint axis, while the
   *  `mobile-breakpoint` continues to be tracked automatically regardless — e.g. a user's manual
   *  collapse toggle that should still yield to a genuinely too-narrow-for-any-inline-rail
   *  viewport. Only consulted while `mode` isn't force-pinned via its own accessor (see the class
   *  doc) — that continues to take full priority, unchanged. Unset (the default, `null`)
   *  reproduces today's exact breakpoint-only behavior. */
  @property({ attribute: 'preferred-mode' }) preferredMode?: AppRailPreferredMode | null;

  /** Suppresses the built-in mobile `[part='toggle']` hamburger/close button entirely -- for a
   *  consumer that already owns an external mobile-menu toggle wired to this rail's own `open`
   *  property. `false` (the default) reproduces today's exact output; note `open` still has no
   *  built-in external trigger of its own once this is set, since `lr-toggle` only fires from the
   *  toggle button being removed. */
  @property({ type: Boolean, reflect: true, attribute: 'hide-toggle' }) hideToggle = false;

  /** Opts a continuously draggable width in for the `'full'` state — exposes a `[part="resizer"]`
   *  handle (pointer-drag and `ArrowLeft`/`ArrowRight` keyboard stepping, RTL-aware) clamped to
   *  `[minRailWidthPx, maxRailWidthPx]`. No built-in persistence — a consumer that wants the
   *  chosen width to survive a reload should listen for `lr-rail-resize` and persist `widthPx`
   *  itself. `false` (the default) renders no resizer and leaves the fixed-width
   *  `--lr-app-rail-width` CSS token exactly as before this property existed. */
  @property({ type: Boolean, reflect: true }) resizable = false;

  /** The rail's current width in px while `resizable` — settable/gettable. Unset defers to the
   *  `--lr-app-rail-width` CSS token's own resolved width. */
  @property({ type: Number, attribute: 'rail-width-px' }) railWidthPx?: number;

  /** Minimum `railWidthPx` a drag/keyboard resize can reach. */
  @property({ type: Number, attribute: 'min-rail-width-px' }) minRailWidthPx = 190;

  /** Maximum `railWidthPx` a drag/keyboard resize can reach. */
  @property({ type: Number, attribute: 'max-rail-width-px' }) maxRailWidthPx = 440;

  /** `true` for the duration of an active pointer-driven resize drag (not a keyboard step) --
   *  reflected so a consumer (or this component's own styles) can suppress `[part='base']`'s
   *  `transition: inline-size` during the drag, which otherwise visibly "chases" the pointer
   *  instead of tracking it 1:1. Read-only in practice (this component owns the transitions), but
   *  a plain reactive property like every other reflected boolean here. */
  @property({ type: Boolean, reflect: true }) dragging = false;

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

  @query('[part="base"]') private baseEl?: HTMLElement;
  private resizePointerId?: number;
  private resizeStartX = 0;
  private resizeStartWidth = 0;

  private syncSlottedItems(): void {
    const slot = this.shadowRoot?.querySelector<HTMLSlotElement>('[part="nav"] > slot');
    for (const item of slot?.assignedElements({ flatten: true }) ?? []) {
      if (item.localName === tag('app-rail-item')) {
        item.toggleAttribute('icon-only', this._mode === 'icon-only');
      }
    }
  }

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

  /** `minRailWidthPx` normalized to a finite, non-negative px floor -- an invalid attribute value
   *  would otherwise poison every `Math.min(maxRailWidthPx, Math.max(minRailWidthPx, ...))` clamp
   *  below (both the drag and keyboard-step handlers) and the resizer's own `aria-valuemin`. */
  private get safeMinRailWidthPx(): number {
    return finiteRange(this.minRailWidthPx, 190, 0);
  }

  /** `maxRailWidthPx` normalized the same way, then cross-referenced against the already-sanitized
   *  minimum so an inverted/invalid pair (e.g. `maxRailWidthPx` left below a since-raised
   *  `minRailWidthPx`) can never produce a negative-width clamp range. */
  private get safeMaxRailWidthPx(): number {
    return Math.max(this.safeMinRailWidthPx, finiteRange(this.maxRailWidthPx, 440, 0));
  }

  /** The rail's current effective width in px, whether or not `railWidthPx` has ever been
   *  explicitly set — falls back to the live measured width of `[part=base]` so the resizer's
   *  `aria-valuenow` and the first drag/keyboard step's start-width reflect the real rendered
   *  width even before a consumer ever sets `railWidthPx`. A set `railWidthPx` is clamped into
   *  `[safeMinRailWidthPx, safeMaxRailWidthPx]` here -- a NaN/negative/out-of-bounds direct
   *  assignment would otherwise reach `updated()`'s inline-size write and this resizer's own
   *  `aria-valuenow` exactly as given. */
  private get effectiveRailWidthPx(): number {
    if (this.railWidthPx != null) {
      return finiteRange(this.railWidthPx, this.safeMinRailWidthPx, this.safeMinRailWidthPx, this.safeMaxRailWidthPx);
    }
    return this.baseEl?.getBoundingClientRect().width ?? 240;
  }

  protected override willUpdate(changed: PropertyValues): void {
    if (!this.hasUpdated) {
      this.hasHeaderSlot = Array.from(this.children).some((el) => el.getAttribute('slot') === 'header');
      this.hasFooterSlot = Array.from(this.children).some((el) => el.getAttribute('slot') === 'footer');
    }
    if (this.hasUpdated && (changed.has('iconOnlyBreakpoint') || changed.has('mobileBreakpoint'))) {
      this.teardownMediaQueries();
      this.setupMediaQueries();
    }
    if (this.hasUpdated && changed.has('preferredMode') && !this.forced) {
      this.applyComputedMode();
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
  // rely on them -- mirrors lr-dialog's/lr-widget's identical ordering
  // rationale.
  protected override updated(changed: PropertyValues): void {
    this.syncSlottedItems();
    if (this.justOpened) {
      this.justOpened = false;
      this.overlayHandle?.focusInitial();
    }
    if (
      (changed.has('railWidthPx') || changed.has('resizable') || changed.has('mode') || !this.hasUpdated) &&
      this.baseEl
    ) {
      if (this.resizable && this.railWidthPx != null && this._mode === 'full') {
        this.baseEl.style.setProperty('inline-size', `${this.effectiveRailWidthPx}px`);
      } else {
        this.baseEl.style.removeProperty('inline-size');
      }
    }
  }

  override connectedCallback(): void {
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

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.teardownMediaQueries();
    this.releaseScrollLock?.();
    this.releaseScrollLock = undefined;
    this.overlayHandle?.suspend();
    this.dragging = false;
    this.resizePointerId = undefined;
    window.removeEventListener('pointermove', this.onResizerPointerMove);
    window.removeEventListener('pointerup', this.onResizerPointerUp);
    window.removeEventListener('pointercancel', this.onResizerPointerUp);
    window.removeEventListener('lostpointercapture', this.onResizerPointerUp);
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
    this.setEffectiveMode(computeAppRailMode(this.iconOnlyMatches, this.mobileMatches, this.preferredMode));
  }

  private setEffectiveMode(next: AppRailMode): void {
    if (this._mode === next) return;
    const old = this._mode;
    this._mode = next;
    this.requestUpdate('mode', old);
    this.emit<AppRailModeChangeDetail>('lr-mode-change', { mode: next });
    // 'open' is only meaningful in 'mobile' mode -- leaving it while open
    // closes the overlay as a side effect (through setOpen, so it still
    // emits lr-toggle and releases the scroll lock/focus trap normally)
    // rather than leaving a now-invisible overlay primed to reappear the
    // next time mode returns to 'mobile'. Forced: this is a consistency
    // fix-up, not a user dismissal, so a host can't veto it via lr-toggle.
    if (next !== 'mobile' && this.open) this.setOpen(false, { force: true });
  }

  private setOpen(next: boolean, options?: { force?: boolean }): void {
    if (this.open === next) return;
    // A breakpoint/forced mode change leaving 'mobile' while open is a consistency fix-up, not a
    // user dismissal -- it must apply unconditionally, or `open` could get stuck `true` while
    // `mode` is no longer `'mobile'` (where `open` is documented as meaningless).
    if (options?.force) {
      this.open = next;
      this.emit<AppRailToggleDetail>('lr-toggle', { open: next });
      return;
    }
    const event = this.emit<AppRailToggleDetail>('lr-toggle', { open: next }, { cancelable: true });
    if (event.defaultPrevented) return;
    this.open = next;
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
  private onNavSlotChange = (): void => {
    this.syncSlottedItems();
  };

  private onResizerPointerDown = (e: PointerEvent): void => {
    this.resizePointerId = e.pointerId;
    this.resizeStartX = e.clientX;
    this.resizeStartWidth = this.effectiveRailWidthPx;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    window.addEventListener('pointermove', this.onResizerPointerMove);
    window.addEventListener('pointerup', this.onResizerPointerUp);
    window.addEventListener('pointercancel', this.onResizerPointerUp);
    window.addEventListener('lostpointercapture', this.onResizerPointerUp);
    this.dragging = true;
  };

  private onResizerPointerMove = (e: PointerEvent): void => {
    if (e.pointerId !== this.resizePointerId) return;
    let delta = e.clientX - this.resizeStartX;
    if (isRtl(this)) delta = -delta;
    const next = Math.min(this.safeMaxRailWidthPx, Math.max(this.safeMinRailWidthPx, this.resizeStartWidth + delta));
    this.railWidthPx = next;
    this.emit<AppRailResizeDetail>('lr-rail-resize', { widthPx: next });
  };

  private onResizerPointerUp = (e: PointerEvent): void => {
    if (e.pointerId !== this.resizePointerId) return;
    this.resizePointerId = undefined;
    this.dragging = false;
    window.removeEventListener('pointermove', this.onResizerPointerMove);
    window.removeEventListener('pointerup', this.onResizerPointerUp);
    window.removeEventListener('pointercancel', this.onResizerPointerUp);
    window.removeEventListener('lostpointercapture', this.onResizerPointerUp);
  };

  private onResizerKeyDown = (e: KeyboardEvent): void => {
    const rtl = isRtl(this);
    const forwardKey = rtl ? 'ArrowLeft' : 'ArrowRight';
    const backwardKey = rtl ? 'ArrowRight' : 'ArrowLeft';
    const step = 8;
    if (e.key === forwardKey) {
      e.preventDefault();
      const next = Math.min(this.safeMaxRailWidthPx, this.effectiveRailWidthPx + step);
      this.railWidthPx = next;
      this.emit<AppRailResizeDetail>('lr-rail-resize', { widthPx: next });
    } else if (e.key === backwardKey) {
      e.preventDefault();
      const next = Math.max(this.safeMinRailWidthPx, this.effectiveRailWidthPx - step);
      this.railWidthPx = next;
      this.emit<AppRailResizeDetail>('lr-rail-resize', { widthPx: next });
    }
  };

  override render(): TemplateResult {
    const mobile = this._mode === 'mobile';
    return html`
      <button
        part="toggle"
        type="button"
        aria-expanded=${this.open ? 'true' : 'false'}
        aria-controls=${this.navId}
        aria-label=${this.open ? this.localize('closeNavigation') : this.localize('openNavigation')}
        @click=${this.onToggleClick}
      >
        ${this.open ? closeIcon() : menuIcon()}
      </button>
      ${mobile && this.open ? html`<div part="backdrop" @click=${this.onBackdropClick}></div>` : nothing}
      <div
        id=${this.navId}
        part=${mobile ? 'panel' : 'base'}
        aria-label=${
          this.accessibleLabel ?? this.localize('navigation', this.label === 'Navigation' ? undefined : this.label)
        }
        role=${this.overlayActive ? 'dialog' : 'navigation'}
        aria-modal=${this.overlayActive ? 'true' : nothing}
        tabindex=${this.overlayActive ? '-1' : nothing}
        ?inert=${mobile && !this.open}
      >
        <div part="header" ?hidden=${!this.hasHeaderSlot}>
          <slot name="header" @slotchange=${this.onHeaderSlotChange}></slot>
        </div>
        <div part="nav">
          <slot @slotchange=${this.onNavSlotChange} @click=${this.onNavItemClick}></slot>
        </div>
        <div part="footer" ?hidden=${!this.hasFooterSlot}>
          <slot name="footer" @slotchange=${this.onFooterSlotChange}></slot>
        </div>
      </div>
      ${this.resizable && this._mode === 'full'
        ? html`<div
            part="resizer"
            role="separator"
            aria-orientation="vertical"
            aria-label=${this.localize('resizeNavigation')}
            aria-valuenow=${Math.round(this.effectiveRailWidthPx)}
            aria-valuemin=${this.safeMinRailWidthPx}
            aria-valuemax=${this.safeMaxRailWidthPx}
            tabindex="0"
            @pointerdown=${this.onResizerPointerDown}
            @keydown=${this.onResizerKeyDown}
          ><span part="resizer-track"></span></div>`
        : nothing}
    `;
  }
}


declare global {
  interface HTMLElementTagNameMap {
    'lr-app-rail': LyraAppRail;
  }
}
