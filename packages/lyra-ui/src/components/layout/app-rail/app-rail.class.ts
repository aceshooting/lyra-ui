import { html, nothing, svg, type SVGTemplateResult, type TemplateResult, type PropertyValues } from 'lit';
import { property, query, state } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { activateOverlay, composedContains, deepActiveElement, type OverlayHandle } from '../../../internal/overlay-manager.js';
import { nextId } from '../../../internal/a11y.js';
import { closeIcon } from '../../../internal/icons.js';
import { tag } from '../../../internal/prefix.js';
import { isRtl } from '../../../internal/rtl.js';
import { finiteRange } from '../../../internal/numbers.js';
import { readPersistedState, writePersistedState } from '../../../internal/persisted-state.js';
import { styles } from './app-rail.styles.js';
import './app-rail-item.class.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_closeNavigation, LYRA_DEFAULT_navigation, LYRA_DEFAULT_openNavigation, LYRA_DEFAULT_resizeNavigation } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END


/** The rail's effective presentation -- see the class doc for what each renders. */
export type LyraAppRailMode = 'full' | 'icon-only' | 'mobile';

/** {@link LyraAppRailMode} plus the `'auto'` release sentinel -- broader than `forceMode`'s own
 *  `LyraAppRailPreferredMode | 'auto'` type, since `forceMode` excludes `'mobile'` (the mobile
 *  breakpoint is always tracked automatically and can never be pinned; see its own doc). */
export type LyraAppRailModeInput = LyraAppRailMode | 'auto';

/** The non-mobile axis of {@link LyraAppRailMode} -- what `preferred-mode`/`forceMode` can
 *  manually prefer between, since the `mobile-breakpoint` continues to be tracked automatically
 *  regardless (see `preferredMode`'s own doc). */
export type LyraAppRailPreferredMode = Exclude<LyraAppRailMode, 'mobile'>;

/** Whitespace-separated tokens accepted by the `persist` attribute. */
export type LyraAppRailPersistField = 'open' | 'width' | 'preferred-mode';

const APP_RAIL_PERSIST_FIELDS = new Set<LyraAppRailPersistField>([
  'open',
  'width',
  'preferred-mode',
]);

export interface LyraAppRailModeChangeDetail {
  mode: LyraAppRailMode;
}

export interface LyraAppRailToggleDetail {
  open: boolean;
}

export interface LyraAppRailResizeDetail {
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
  preferredMode?: LyraAppRailPreferredMode | null,
): LyraAppRailMode {
  if (mobileMatches) return 'mobile';
  if (preferredMode) return preferredMode;
  if (iconOnlyMatches) return 'icon-only';
  return 'full';
}

export interface LyraAppRailEventMap {
  'lr-mode-change': CustomEvent<LyraAppRailModeChangeDetail>;
  'lr-toggle': CustomEvent<LyraAppRailToggleDetail>;
  'lr-rail-resize-request': CustomEvent<LyraAppRailResizeDetail>;
  'lr-rail-resize': CustomEvent<LyraAppRailResizeDetail>;
}
/**
 * `<lr-app-rail>` — a responsive navigation rail that adapts across three
 * presentations as the *viewport* narrows (not this element's own inline
 * size — see the `mode` getter doc for why): `'full'` (nav items show
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
 *   breakpoint crossing or an explicit `forceMode` assignment. Not fired for a
 *   redundant reassignment to the mode already in effect.
 *   `detail: LyraAppRailModeChangeDetail`.
 * @event lr-toggle - The mobile overlay is opening or closing — via the
 *   built-in toggle button, Escape, a backdrop click, a nav-item click while
 *   open, or a breakpoint/forced mode change leaving `'mobile'` while open.
 *   Not fired when a consumer sets `open` directly (mirrors `<lr-dialog>`'s
 *   `open`/`close()` split). `detail: LyraAppRailToggleDetail`. Conditionally cancelable: every
 *   interactive trigger can be vetoed, but the forced mode-change close always applies
 *   (vetoing it would leave `open` stuck `true` in a mode where it's
 *   meaningless) -- call `preventDefault()` to keep the overlay as it is.
 * @event lr-rail-resize-request - A cancelable request to change the `resizable` rail's width via
 *   drag or keyboard stepping. Call `preventDefault()` to keep `railWidthPx` unchanged. Not fired
 *   when a consumer sets `railWidthPx` directly. `detail: LyraAppRailResizeDetail`.
 * @event lr-rail-resize - The `resizable` rail's width was committed: immediately after a genuine
 *   keyboard step, or once on pointerup after a genuine drag. Non-cancelable; no event is emitted
 *   for clamped no-ops, canceled/lost gestures, or direct `railWidthPx` writes.
 *   `detail: LyraAppRailResizeDetail`.
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
 * @cssprop [--lr-app-rail-toggle-hover-bg=var(--lr-color-brand-quiet)] - Toggle hover background.
 * @cssprop [--lr-app-rail-toggle-hover-color=var(--lr-color-brand)] - Toggle hover foreground.
 * @cssprop --lr-app-rail-toggle-active-bg - Toggle pressed background; defaults to the former
 *   brand-quiet active mix.
 * @cssprop [--lr-app-rail-toggle-active-color=var(--lr-color-brand)] - Toggle pressed foreground.
 * @cssprop [--lr-app-rail-resizer-hover-bg=var(--lr-color-brand)] - Resizer-track hover background.
 * @cssprop --lr-app-rail-resizer-active-bg - Resizer-track pressed background; defaults to the
 *   former brand active mix.
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
 * @status stable
 * @since 4.0.0
 */
export class LyraAppRail extends LyraElement<LyraAppRailEventMap> {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    closeNavigation: LYRA_DEFAULT_closeNavigation,
    navigation: LYRA_DEFAULT_navigation,
    openNavigation: LYRA_DEFAULT_openNavigation,
    resizeNavigation: LYRA_DEFAULT_resizeNavigation,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  static override styles = [LyraElement.styles, styles];

  /** Below this viewport width, the rail switches from `'full'` to
   *  `'icon-only'`. Any valid CSS length, used directly in a `max-width`
   *  media query. */
  @property({ attribute: 'icon-only-breakpoint', useDefault: true }) iconOnlyBreakpoint = '960px';

  /** Below this viewport width, the rail switches from `'icon-only'` to
   *  `'mobile'`. Should be smaller than `iconOnlyBreakpoint` to produce all
   *  three states as the viewport narrows. */
  @property({ attribute: 'mobile-breakpoint', useDefault: true }) mobileBreakpoint = '600px';

  /** Whether the mobile floating overlay is shown. Only meaningful while
   *  `mode` is `'mobile'`; leaving mobile mode closes it so a later mobile
   *  transition never restores a stale modal. Set this directly, or use the built-in toggle button
   *  — there is no separate `show()`/`hide()` pair. */
  @property({ type: Boolean, reflect: true }) open = false;

  /** Optional accessible name for the rail's navigation landmark and mobile dialog. Every
   *  nonempty supplied string is literal; only absence/empty uses the localized fallback. A
   *  host-level `aria-label` attribute takes precedence, including an explicit empty value. */
  @property() label?: string;

  /** Accessible name overriding `label` (and its localized default) for the nav landmark / dialog
   *  role, mirroring `<lr-date-input>`'s `accessibleLabel` pattern. Reads the host's own
   *  `aria-label` attribute -- unset (the default, `null`) reproduces today's exact
   *  `label`/localized-default output. */
  @property({ attribute: 'aria-label' }) private accessibleLabel:
    | string | null = null;

  /** Manually prefers `'full'` or `'icon-only'` for the non-mobile breakpoint axis, while the
   *  `mobile-breakpoint` continues to be tracked automatically regardless — e.g. a user's manual
   *  collapse toggle that should still yield to a genuinely too-narrow-for-any-inline-rail
   *  viewport. Only consulted while `mode` isn't pinned via `forceMode` — that continues to take
   *  full priority, unchanged. Unset (the default, `null`) reproduces today's exact
   *  breakpoint-only behavior. */
  @property({ attribute: 'preferred-mode' }) preferredMode?: LyraAppRailPreferredMode | null;

  /** Pins the rail's effective `mode` to `'full'` or `'icon-only'`, bypassing the live
   *  `icon-only-breakpoint`/`mobile-breakpoint` match entirely. The sentinel `'auto'` (and the
   *  unset default, `undefined`) release the pin and resume automatic breakpoint tracking --
   *  whether the rail is currently pinned or auto-tracking is itself observable this way:
   *  `forceMode === 'auto'` (or unset) means auto-tracking, any other value means pinned.
   *  `'mobile'` cannot be pinned here -- the mobile breakpoint is always tracked automatically
   *  regardless, mirroring `preferredMode`'s own scope. An unrecognized value is ignored, leaving
   *  the current pinned/auto-tracking state unchanged. Applies synchronously -- mirrors the
   *  pre-9.0 `mode` setter this replaced, including for code (a resize gesture's own pointermove
   *  handler, e.g.) that reads `mode`-derived state immediately after assigning this property,
   *  with no intervening render. `mode` itself is a read-only resolved accessor; assign
   *  `forceMode` to change what it reports. */
  @property({ attribute: 'force-mode' })
  get forceMode(): LyraAppRailPreferredMode | 'auto' | undefined {
    return this._forceMode;
  }
  set forceMode(next: LyraAppRailPreferredMode | 'auto' | null | undefined) {
    // Validated BEFORE writing `_forceMode` -- an unrecognized value must leave the current
    // pinned/auto-tracking state (and its own readback) untouched, per the doc above. Writing the
    // raw value first would corrupt `forceMode`'s readback with the rejected string while `mode`
    // stayed unaffected, silently breaking the `forceMode === 'auto'`-means-auto-tracking
    // invariant this accessor exists to guarantee.
    if (next != null && next !== 'auto' && next !== 'full' && next !== 'icon-only') return;
    const old = this._forceMode;
    this._forceMode = next ?? undefined;
    this.requestUpdate('forceMode', old);
    if (next == null || next === 'auto') {
      if (!this.forced) return;
      this.forced = false;
      this.applyComputedMode();
      return;
    }
    this.forced = true;
    this.setEffectiveMode(next);
  }
  private _forceMode?: LyraAppRailPreferredMode | 'auto';

  /** Suppresses the built-in mobile `[part='toggle']` hamburger/close button entirely -- for a
   *  consumer that already owns an external mobile-menu toggle wired to this rail's own `open`
   *  property. `false` (the default) reproduces today's exact output; note `open` still has no
   *  built-in external trigger of its own once this is set, since `lr-toggle` only fires from the
   *  toggle button being removed. */
  @property({ type: Boolean, reflect: true, attribute: 'hide-toggle' }) hideToggle = false;

  /** Opts a continuously draggable width in for the `'full'` state — exposes a `[part="resizer"]`
   *  handle (pointer-drag and `ArrowLeft`/`ArrowRight` keyboard stepping, RTL-aware) clamped to
   *  `[minRailWidthPx, maxRailWidthPx]`. Set `storageKey` to persist the fields selected by
   *  `persist`; otherwise listen for `lr-rail-resize` and persist its committed `widthPx` yourself.
   *  Call `preventDefault()` on `lr-rail-resize-request` to keep the current width. `false` (the
   *  default) renders no resizer and leaves the fixed-width `--lr-app-rail-width` CSS token exactly
   *  as before this property existed. */
  @property({ type: Boolean, reflect: true }) resizable = false;

  /** When set, persists the fields selected by `persist` to `localStorage` under
   *  `lr-app-rail:${storageKey}`, restoring them on the next mount — mirrors `lr-multi-split`'s
   *  `storage-key`. Effective `mode` is breakpoint-derived and is never persisted. Unset (the
   *  default) means no persistence, exactly as before. */
  @property({ attribute: 'storage-key' }) storageKey?: string;

  /**
   * Whitespace-separated persistence allowlist. `open width` is the backward-compatible default;
   * use `width preferred-mode` to retain layout preference without restoring the transient mobile
   * overlay. Valid tokens are `open`, `width`, and `preferred-mode`.
   */
  @property({ useDefault: true }) persist = 'open width';

  /** The rail's current width in px while `resizable` — settable/gettable. Unset defers to the
   *  `--lr-app-rail-width` CSS token's own resolved width. */
  @property({ type: Number, attribute: 'rail-width-px' }) railWidthPx?: number;

  /** Minimum `railWidthPx` a drag/keyboard resize can reach. */
  @property({ type: Number, attribute: 'min-rail-width-px', useDefault: true }) minRailWidthPx = 190;

  /** Maximum `railWidthPx` a drag/keyboard resize can reach. */
  @property({ type: Number, attribute: 'max-rail-width-px', useDefault: true }) maxRailWidthPx = 440;

  /** `true` for the duration of an active pointer-driven resize drag (not a keyboard step) --
   *  reflected so a consumer (or this component's own styles) can suppress `[part='base']`'s
   *  `transition: inline-size` during the drag, which otherwise visibly "chases" the pointer
   *  instead of tracking it 1:1. Read-only -- this component owns the transitions entirely; there
   *  is no public setter. */
  get dragging(): boolean {
    return this._dragging;
  }
  private _dragging = false;

  /** Sets `_dragging` and its reflected `[dragging]` attribute together. `dragging` has no
   *  template binding of its own (only the CSS selectors in `app-rail.styles.ts` key off the
   *  attribute), so this bypasses Lit's reactive-property machinery entirely rather than routing
   *  through `requestUpdate()` -- see the `dragging` getter doc for why there is no public
   *  setter. */
  private setDragging(next: boolean): void {
    this._dragging = next;
    this.toggleAttribute('dragging', next);
  }

  @state() private hasHeaderSlot = false;
  @state() private hasFooterSlot = false;

  /** False until after the first `updated()`, so persistence never fires on the load pass. */
  private persistReady = false;

  private _mode: LyraAppRailMode = 'full';
  // The `mode` value last written to the reflected attribute -- lets `updated()` gate the
  // manual `setAttribute('mode', ...)` call on an actual change instead of firing it
  // unconditionally on every update pass (see `updated()`'s own comment for why unconditional
  // was wrong: it rewrote the same value once per unrelated reactive-property update, including
  // once per pointermove tick throughout an entire resize drag). `undefined` until the first
  // `updated()` runs, which always differs from a real `LyraAppRailMode` and so always reflects
  // the constructor-default `_mode` on that first pass.
  private _lastReflectedMode?: LyraAppRailMode;
  // Whether matchMedia changes are currently ignored because a consumer
  // pinned a specific mode via `forceMode` -- see the `mode` getter doc.
  private forced = false;
  private iconOnlyMatches = false;
  private mobileMatches = false;
  private mqIconOnly?: MediaQueryList;
  private mqMobile?: MediaQueryList;
  private mqIconOnlyListener?: (event: MediaQueryListEvent) => void;
  private mqMobileListener?: (event: MediaQueryListEvent) => void;
  // Derived from mode === 'mobile' && open -- tracked as its own field
  // (rather than recomputed inline everywhere) so willUpdate can detect the
  // specific false->true/true->false transition regardless of which of the
  // two source properties changed.
  private overlayActive = false;
  private justOpened = false;
  private overlayHandle?: OverlayHandle;
  private explicitTrigger?: HTMLElement;
  private recoverInlineFocusAfterResponsiveClose = false;
  private readonly navId = nextId('app-rail-nav');

  @query('[part="base"]') private baseEl?: HTMLElement;
  private resizePointerId?: number;
  private resizeOwnerWindow?: Window;
  private resizeStartX = 0;
  private resizeStartWidth = 0;
  private resizeGestureChanged = false;
  private managedItems = new Set<HTMLElement>();

  private syncSlottedItems(): void {
    const slot = this.shadowRoot?.querySelector<HTMLSlotElement>('[part="nav"] > slot');
    const itemTag = tag('app-rail-item');
    const railTag = tag('app-rail');
    const next = new Set(
      (slot?.assignedElements({ flatten: true }) ?? []).filter(
        (item): item is HTMLElement => item.localName === itemTag,
      ),
    );
    for (const item of this.managedItems) {
      if (next.has(item)) continue;
      const newOwner = item.closest(railTag) as LyraAppRail | null;
      if (
        newOwner &&
        newOwner !== this &&
        item.parentElement === newOwner &&
        !item.hasAttribute('slot')
      ) {
        item.toggleAttribute('icon-only', newOwner.mode === 'icon-only');
      } else {
        item.removeAttribute('icon-only');
      }
    }
    for (const item of next)
      item.toggleAttribute('icon-only', this._mode === 'icon-only');
    this.managedItems = next;
  }

  /**
   * The rail's current effective presentation. Always one of the three real
   * modes — never `'auto'` — reflecting either the live breakpoint match or,
   * once pinned via `forceMode`, whatever mode is currently pinned.
   *
   * Read-only: this getter never accepts an assignment. Set `forceMode` to
   * pin `'full'`/`'icon-only'`, or to `'auto'`/unset to release the pin and
   * resume automatic breakpoint tracking -- unlike the pre-9.0 `mode`
   * setter this replaced, whether the rail is currently pinned is itself
   * observable via `forceMode === 'auto'` (or unset).
   *
   * Reflected to the `mode` attribute for `:host([mode="..."])` styling --
   * manually, via `updated()`, since this property has no Lit-managed
   * accessor to reflect through (see `setEffectiveMode()`).
   */
  get mode(): LyraAppRailMode {
    return this._mode;
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

  private get storageFullKey(): string | undefined {
    return this.storageKey ? `lr-app-rail:${this.storageKey}` : undefined;
  }

  private get persistFields(): Set<LyraAppRailPersistField> {
    const persist = typeof this.persist === 'string' ? this.persist : '';
    return new Set(
      persist
        .split(/\s+/)
        .filter((field): field is LyraAppRailPersistField =>
          APP_RAIL_PERSIST_FIELDS.has(field as LyraAppRailPersistField),
        ),
    );
  }

  /** Restore the selected persisted fields. Runs once, before the first render. Effective `mode`
   *  remains breakpoint-derived; only the optional non-mobile `preferredMode` input is restorable. */
  private loadPersisted(): boolean {
    const parsed = readPersistedState(
      this.storageFullKey,
      (v): v is { open?: unknown; railWidthPx?: unknown; preferredMode?: unknown;
      } =>
        typeof v === 'object' && v !== null,
    );
    if (!parsed) return false;
    const fields = this.persistFields;
    if (fields.has('open') && typeof parsed.open === 'boolean') this.open = parsed.open;
    if (
      fields.has('width') &&
      typeof parsed.railWidthPx === 'number' &&
      Number.isFinite(parsed.railWidthPx)
    ) {
      this.railWidthPx = parsed.railWidthPx;
    }
    if (
      fields.has('preferred-mode') &&
      (parsed.preferredMode === 'full' || parsed.preferredMode === 'icon-only')
    ) {
      this.preferredMode = parsed.preferredMode;
      return true;
    }
    return false;
  }

  private persistState(): void {
    const fields = this.persistFields;
    if (fields.size === 0) return;
    const state: {
      open?: boolean;
      railWidthPx?: number;
      preferredMode?: LyraAppRailPreferredMode | null;
    } = {};
    if (fields.has('open')) state.open = this.open;
    if (fields.has('width')) state.railWidthPx = this.railWidthPx;
    if (fields.has('preferred-mode')) state.preferredMode = this.preferredMode ?? null;
    writePersistedState(this.storageFullKey, state);
  }

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed);
    if (
      (changed.has('resizable') || changed.has('mode')) &&
      (!this.resizable || this._mode !== 'full')
    ) {
      this.endResizerGesture();
    }
    if (!this.hasUpdated) {
      this.hasHeaderSlot = Array.from(this.children).some((el) => el.getAttribute('slot') === 'header');
      this.hasFooterSlot = Array.from(this.children).some((el) => el.getAttribute('slot') === 'footer');
      const restoredPreferredMode = this.loadPersisted();
      if (restoredPreferredMode && !this.forced) {
        // Fold the restored preference into the first render without emitting a user-facing mode
        // change event during mount or scheduling a second update from inside willUpdate().
        this._mode = computeAppRailMode(
          this.iconOnlyMatches,
          this.mobileMatches,
          this.preferredMode,
        );
      }
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
          this.deactivateMobileOverlay(this._mode === 'mobile');
        }
      }
    }
  }

  // Runs after render (not willUpdate) so [part="panel"] and its slotted
  // content have already landed in the DOM before the focus call below can
  // rely on them -- mirrors lr-dialog's/lr-widget's identical ordering
  // rationale.
  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    // `mode` has no Lit-managed accessor (see its getter doc), so its attribute reflection is
    // manual -- gated on `_lastReflectedMode` (not `changed.has('mode')`, since `mode` is never a
    // real reactive property `changed` could name) so a same-value update pass doesn't rewrite an
    // unchanged attribute. `_lastReflectedMode` starts `undefined`, which never equals a real
    // `LyraAppRailMode`, so the very first update still reflects `_mode`'s constructor-default
    // value even though `setEffectiveMode()` never "changes" from that default.
    if (this._lastReflectedMode !== this._mode) {
      this._lastReflectedMode = this._mode;
      this.setAttribute('mode', this._mode);
    }
    this.syncSlottedItems();
    if (this.recoverInlineFocusAfterResponsiveClose) {
      this.recoverInlineFocusAfterResponsiveClose = false;
      const active = deepActiveElement(this.ownerDocument);
      if (this.baseEl && !composedContains(this.baseEl, active)) this.baseEl.focus();
    }
    if (this.justOpened) {
      this.justOpened = false;
      this.overlayHandle?.focusInitial();
    }
    // Persist whenever the persistable state changes, but never on the initial update -- that pass
    // is where loadPersisted() set these values, and Lit has already flipped `hasUpdated` to true
    // by the time `updated` runs, so a dedicated flag is needed to skip it.
    if (
      this.persistReady &&
      (changed.has('open') ||
        (changed.has('railWidthPx') && !this.dragging) ||
        changed.has('preferredMode') ||
        changed.has('persist'))
    ) {
      this.persistState();
    }
    this.persistReady = true;
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
    // `forceMode`'s own setter applies synchronously (see its doc) -- including for an initial
    // `force-mode` attribute, whose attributeChangedCallback reaction runs during upgrade, before
    // connectedCallback -- so `forced`/`_mode` are already correct by the time setupMediaQueries()
    // below decides whether `forced` should suppress its breakpoint read. No explicit sync needed
    // here, unlike the mode-getter's other, purely-computed state.
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
      queueMicrotask(() => this.overlayHandle?.focusInitial());
    }
    if (this.hasUpdated) {
      queueMicrotask(() => {
        if (this.isConnected) this.syncSlottedItems();
      });
    }
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.teardownMediaQueries();
    this.overlayHandle?.suspend();
    this.endResizerGesture();
  }

  override adoptedCallback(): void {
    super.adoptedCallback();
    this.teardownMediaQueries();
    this.endResizerGesture();
  }

  private activateMobileOverlay(): void {
    this.overlayHandle = activateOverlay({
      host: this,
      panel: () => this.shadowRoot?.querySelector<HTMLElement>('[part="panel"]') ?? null,
      onEscape: () => this.setOpen(false),
      onBackdrop: () => this.setOpen(false),
      restoreFocusTo: this.explicitTrigger,
      lockScroll: true,
      suspendWhenUnrendered: true,
    });
    this.explicitTrigger = undefined;
  }

  private deactivateMobileOverlay(restoreFocus = true): void {
    this.overlayHandle?.deactivate({ restoreFocus });
    this.overlayHandle = undefined;
  }

  private setupMediaQueries(): void {
    if (!this.isConnected) return;
    const view = this.ownerDocument.defaultView;
    if (!view?.matchMedia) return;
    const iconOnlyQuery = view.matchMedia(`(max-width: ${this.iconOnlyBreakpoint})`);
    const mobileQuery = view.matchMedia(`(max-width: ${this.mobileBreakpoint})`);
    const iconOnlyListener = (event: MediaQueryListEvent): void => {
      if (
        this.mqIconOnly !== iconOnlyQuery ||
        !this.isConnected ||
        this.ownerDocument.defaultView !== view
      ) {
        return;
      }
      this.onIconOnlyChange(event);
    };
    const mobileListener = (event: MediaQueryListEvent): void => {
      if (
        this.mqMobile !== mobileQuery ||
        !this.isConnected ||
        this.ownerDocument.defaultView !== view
      ) {
        return;
      }
      this.onMobileChange(event);
    };
    this.mqIconOnly = iconOnlyQuery;
    this.mqMobile = mobileQuery;
    this.mqIconOnlyListener = iconOnlyListener;
    this.mqMobileListener = mobileListener;
    iconOnlyQuery.addEventListener('change', iconOnlyListener);
    mobileQuery.addEventListener('change', mobileListener);
    this.iconOnlyMatches = iconOnlyQuery.matches;
    this.mobileMatches = mobileQuery.matches;
    if (!this.forced) this.applyComputedMode();
  }

  private teardownMediaQueries(): void {
    if (this.mqIconOnly && this.mqIconOnlyListener) {
      this.mqIconOnly.removeEventListener('change', this.mqIconOnlyListener);
    }
    if (this.mqMobile && this.mqMobileListener) {
      this.mqMobile.removeEventListener('change', this.mqMobileListener);
    }
    this.mqIconOnly = undefined;
    this.mqMobile = undefined;
    this.mqIconOnlyListener = undefined;
    this.mqMobileListener = undefined;
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

  private setEffectiveMode(next: LyraAppRailMode): void {
    if (this._mode === next) return;
    const old = this._mode;
    if (old === 'mobile' && next !== 'mobile' && this.open) {
      this.recoverInlineFocusAfterResponsiveClose = true;
    }
    this._mode = next;
    this.requestUpdate('mode', old);
    this.emit('lr-mode-change', { mode: next });
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
      this.emit('lr-toggle', { open: next });
      return;
    }
    const mode = this._mode;
    const open = this.open;
    const event = this.emit('lr-toggle', { open: next }, { cancelable: true });
    // A listener can synchronously take ownership of mode or open while the
    // proposal is dispatching. Do not overwrite that state after it returns.
    if (event.defaultPrevented || this._mode !== mode || this.open !== open) return;
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
    if (
      !e.isPrimary ||
      e.button !== 0 ||
      !this.resizable ||
      this._mode !== 'full' ||
      this.resizePointerId !== undefined
    ) return;
    const resizer = e.currentTarget as HTMLElement;
    const ownerWindow = resizer.ownerDocument.defaultView;
    if (!ownerWindow) return;
    this.resizePointerId = e.pointerId;
    this.resizeOwnerWindow = ownerWindow;
    this.resizeStartX = e.clientX;
    this.resizeStartWidth = this.effectiveRailWidthPx;
    this.resizeGestureChanged = false;
    resizer.setPointerCapture(e.pointerId);
    ownerWindow.addEventListener('pointermove', this.onResizerPointerMove);
    ownerWindow.addEventListener('pointerup', this.onResizerPointerUp);
    ownerWindow.addEventListener('pointercancel', this.onResizerPointerUp);
    ownerWindow.addEventListener('lostpointercapture', this.onResizerPointerUp);
    this.setDragging(true);
  };

  private onResizerPointerMove = (e: PointerEvent): void => {
    if (e.pointerId !== this.resizePointerId) return;
    if (!this.resizable || this._mode !== 'full') {
      this.endResizerGesture();
      return;
    }
    let delta = e.clientX - this.resizeStartX;
    if (isRtl(this)) delta = -delta;
    const next = Math.min(this.safeMaxRailWidthPx, Math.max(this.safeMinRailWidthPx, this.resizeStartWidth + delta));
    this.requestRailResize(next, false);
  };

  private onResizerPointerUp = (e: PointerEvent): void => {
    if (e.pointerId !== this.resizePointerId) return;
    this.endResizerGesture(e.type === 'pointerup');
  };

  private endResizerGesture(commit = false): void {
    const ownerWindow = this.resizeOwnerWindow;
    const changed = this.resizeGestureChanged;
    const widthPx = this.effectiveRailWidthPx;
    this.resizePointerId = undefined;
    this.resizeOwnerWindow = undefined;
    this.resizeGestureChanged = false;
    this.setDragging(false);
    ownerWindow?.removeEventListener('pointermove', this.onResizerPointerMove);
    ownerWindow?.removeEventListener('pointerup', this.onResizerPointerUp);
    ownerWindow?.removeEventListener('pointercancel', this.onResizerPointerUp);
    ownerWindow?.removeEventListener('lostpointercapture', this.onResizerPointerUp);
    if (commit && changed) {
      this.emit('lr-rail-resize', { widthPx });
      if (this.persistReady) this.persistState();
    }
  }

  /** Emits the cancelable proposal before committing, so a vetoed gesture never mutates width or
   *  triggers the existing post-commit resize notification. */
  private requestRailResize(next: number, commit = true): boolean {
    if (next === this.effectiveRailWidthPx) return false;
    const event = this.emit('lr-rail-resize-request', { widthPx: next }, { cancelable: true });
    if (event.defaultPrevented) return false;
    this.railWidthPx = next;
    if (commit) this.emit('lr-rail-resize', { widthPx: next });
    else this.resizeGestureChanged = true;
    return true;
  }

  private onResizerKeyDown = (e: KeyboardEvent): void => {
    const rtl = isRtl(this);
    const forwardKey = rtl ? 'ArrowLeft' : 'ArrowRight';
    const backwardKey = rtl ? 'ArrowRight' : 'ArrowLeft';
    const step = 8;
    if (e.key === forwardKey) {
      const next = Math.min(this.safeMaxRailWidthPx, this.effectiveRailWidthPx + step);
      if (next !== this.effectiveRailWidthPx) {
        e.preventDefault();
        this.requestRailResize(next);
      }
    } else if (e.key === backwardKey) {
      const next = Math.max(this.safeMinRailWidthPx, this.effectiveRailWidthPx - step);
      if (next !== this.effectiveRailWidthPx) {
        e.preventDefault();
        this.requestRailResize(next);
      }
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
          this.accessibleLabel ?? (this.label ? this.label : this.localize('navigation'))
        }
        role=${this.overlayActive ? 'dialog' : 'navigation'}
        aria-modal=${this.overlayActive ? 'true' : nothing}
        tabindex=${this.overlayActive || !mobile ? '-1' : nothing}
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
