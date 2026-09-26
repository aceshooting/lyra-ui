import { html, nothing, type TemplateResult, type PropertyValues } from 'lit';
import { property, query, state } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { activateOverlay, collectFocusableElements, composedContains, deepActiveElement, type OverlayHandle } from '../../../internal/overlay-manager.js';
import { optionalLiteralSetConverter } from '../../../internal/converters.js';
import type { LyraFrame } from '../../../internal/variants.js';
export type { LyraFrame } from '../../../internal/variants.js';
import { detectPlatform } from '../../../internal/platform.js';
import { parseHotkey, hasNonShiftModifier, matchesHotkey, hotkeyAriaKeyShortcuts, isIgnorableKeyEvent, isEditableKeyEventTarget, registerHotkeyOwner, unregisterHotkeyOwner, resolveHotkeyOwner } from '../../../internal/hotkey.js';
import { nextId, isAccessibilityVisible } from '../../../internal/a11y.js';
import { acquireAriaOwnership, type AriaOwnershipLease } from '../../../internal/aria-ownership.js';
import { chevronIcon, closeIcon, menuIcon } from '../../../internal/icons.js';
import { tag } from '../../../internal/prefix.js';
import { isRtl } from '../../../internal/rtl.js';
import { prefersReducedMotion } from '../../../internal/motion.js';
import { finiteRange } from '../../../internal/numbers.js';
import { getNumberFormat } from '../../../internal/intl-cache.js';
import { readPersistedState, writePersistedState } from '../../../internal/persisted-state.js';
import {
  definePersistedProperty,
  isPersistedPropertyExplicitlySet,
} from '../../../internal/persisted-restore.js';
import { styles } from './app-rail.styles.js';
import './app-rail-item.class.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_appRailCollapse, LYRA_DEFAULT_appRailExpand, LYRA_DEFAULT_closeNavigation, LYRA_DEFAULT_navigation, LYRA_DEFAULT_openNavigation, LYRA_DEFAULT_resizeNavigation, LYRA_DEFAULT_resizeValuePixels } from '../../../internal/default-strings.generated.js';
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

const APP_RAIL_FRAME = optionalLiteralSetConverter<LyraFrame>(['card', 'plain']);

const APP_RAIL_PERSIST_FIELDS = new Set<LyraAppRailPersistField>([
  'open',
  'width',
  'preferred-mode',
]);

/** Which fields one `loadPersisted()` pass actually wrote -- not which ones storage happened to
 *  hold, and not which ones `persist` selects. `willUpdate()` post-processes exactly those two:
 *  a restored `preferredMode` is folded into the first render's effective mode, and a restored
 *  `open` is dropped again when the settled mode cannot support it. Internal (not exported): it
 *  describes a private return value, not any part of the element's public surface. */
interface LyraAppRailRestoredFields {
  /** A stored `open` was applied -- so it is this component's own write, not a consumer binding
   *  or declared attribute, that willUpdate()'s mobile-only invariant check may undo. */
  open: boolean;
  /** A stored `preferredMode` was applied and the effective mode needs recomputing for it. */
  preferredMode: boolean;
}

export interface LyraAppRailModeChangeDetail {
  mode: LyraAppRailMode;
}

export interface LyraAppRailToggleDetail {
  open: boolean;
}

export interface LyraAppRailResizeDetail {
  widthPx: number;
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
 * `<lr-app-rail>` — the library's application sidebar, a responsive navigation rail across three
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
 * @cssprop [--lr-app-rail-panel-shadow=var(--lr-shadow-l)] - Mobile panel elevation, read only while open; closed panels never paint it.
 * @cssprop [--lr-app-rail-frame-gap=var(--lr-space-s)] - Margin around a card frame.
 * @cssprop [--lr-app-rail-frame-radius=var(--lr-radius)] - Card-frame corner radius.
 * @cssprop [--lr-app-rail-frame-shadow=var(--lr-shadow-s)] - Card-frame elevation.
 * @customElement lr-app-rail
 * @slot - Nav items. Use `<lr-app-rail-item>` for the explicit icon/label
 *   contract that automatically hides labels in `'icon-only'` mode, and
 *   `<lr-app-rail-group>` to title and optionally collapse a section of them --
 *   a slotted group is marked `icon-only` exactly like a slotted item, and
 *   forwards that state to the items it owns. Generic
 *   links and buttons remain supported, but their compact presentation is the
 *   consumer's responsibility. While the mobile overlay is open, clicking
 *   anywhere inside this slot closes it.
 * @slot header - Logo/brand content, shown above the nav items in every mode.
 * @slot footer - A trailing user/settings trigger, shown below the nav items.
 * @event lr-mode-change - The effective mode changed. A LIVE breakpoint crossing (after mount) or
 *   an explicit `forceMode` assignment fires immediately, synchronously with the change. The mode
 *   this component settles on for its very FIRST mount -- whether that is simply the initial
 *   breakpoint match, or a persisted `preferred-mode` restored from storage (`storage-key` +
 *   `persist="preferred-mode"`) overriding it -- instead fires once, from that same mount's first
 *   `updated()`, so a listener always observes the single, settled mode once the initial render
 *   and attribute reflection have both already landed, never an intermediate pre-restore value the
 *   restore was always going to overwrite. Not fired for a redundant reassignment to the mode
 *   already in effect, nor when the first mount's settled mode never left the constructor default
 *   (the ordinary default-mode mount stays silent).
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
 *   CSS outside `'mobile'` mode, or -- while it is not also serving as the panel's only in-panel
 *   dismiss control (see below) -- entirely via `hideToggle`; it inherits the rail's typography
 *   and its glyph scales at 1em. Reparented to be the first child of `[part="panel"]` for exactly
 *   as long as the mobile overlay is open, so the shared focus trap (scoped to the panel alone)
 *   can reach it and Tab cycles through it like `<lr-dialog>`'s in-panel close button; moved back
 *   to its resting position, a sibling ahead of `[part="panel"]`, once closed. Reparenting reuses
 *   the same element throughout (never destroyed/recreated), so a reference captured before
 *   opening remains valid after closing. Rendered as its own reserved row ahead of the `header`
 *   slot while inside the panel, never absolutely overlaid on top of it, so a wide/slotted header
 *   is never obscured. `hideToggle` only suppresses it in its OUTSIDE/closed position (the "open"
 *   trigger, redundant once a consumer wires an external `trigger`/`for`); it stays visible once
 *   reparented inside the open panel, since it is then the only in-panel dismiss control.
 * @csspart backdrop - The mobile overlay's scrim. Only rendered while open.
 * @csspart collapse-toggle - The opt-in desktop collapse control, rendered inside
 *   `[part="header"]` only while `collapsible` is set and `mode` is not `'mobile'`. Carries the
 *   localized expand/collapse accessible name and renders `aria-expanded` in both states, so a
 *   screen reader announces the rail's current presentation rather than only its label.
 *   `aria-expanded` is deliberate even though collapsing removes nothing from the accessibility
 *   tree: `'icon-only'` only clips each item's `[part="label"]`/`[part="meta"]` visually, so a
 *   screen-reader user reads the same nav either way, and the attribute is what tells a magnifier
 *   or braille user which of the two presentations they are currently in. Its `aria-controls`
 *   names `[part="nav"]` — the item list whose presentation actually changes — never the
 *   `[part="base"]`/`[part="panel"]` element, which CONTAINS this button and would make the
 *   control claim to expand its own ancestor.
 * @csspart collapse-icon - The wrapper around `[part="collapse-toggle"]`'s chevron. The glyph is
 *   direction-aware through this wrapper's own `transform` (never a second, mirrored icon), so it
 *   always points toward the edge the rail is about to move to, under both `dir` values.
 * @csspart panel - The mobile overlay's floating panel — see the class doc
 *   for why it's the same element as `base`, never both at once.
 * @csspart resizer - The `resizable` opt-in's drag handle -- its interactive hit target, sized to
 *   the shared minimum tappable size (`--lr-icon-button-size`), independent of the slimmer
 *   visible line rendered by its `resizer-track` child. Its numeric ARIA range remains in CSS
 *   pixels while `aria-valuetext` reports the current width through the effective locale. Only
 *   rendered while `resizable` and `mode` is `'full'`.
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
 * @cssprop [--lr-app-rail-panel-inset-block-start=0] - Block-start (top) inset shared by
 *   `[part="panel"]` and `[part="backdrop"]` -- raise it to leave room for a fixed app bar/status
 *   area above the drawer instead of the panel/scrim starting flush with the viewport top.
 * @cssprop [--lr-app-rail-panel-radius=0] - Uniform corner radius of `[part="panel"]`. `0` (the
 *   default) reproduces today's flush-edged drawer; pairs naturally with a nonzero
 *   `--lr-app-rail-panel-inset-block-start`, which exposes the panel's top corners. Each per-corner
 *   token below defaults to this one, so setting only this token still rounds all four corners
 *   uniformly, exactly as before the per-corner tokens existed.
 * @cssprop [--lr-app-rail-panel-radius-start-start=var(--lr-app-rail-panel-radius)] - Logical
 *   `border-start-start-radius` of `[part="panel"]` -- the corner at the drawer's own flush
 *   inline-start edge, block-start side.
 * @cssprop [--lr-app-rail-panel-radius-start-end=var(--lr-app-rail-panel-radius)] - Logical
 *   `border-start-end-radius` of `[part="panel"]` -- the corner away from the flush inline-start
 *   edge, block-start side. One of the two corners a flush-against-one-edge drawer typically
 *   rounds.
 * @cssprop [--lr-app-rail-panel-radius-end-start=var(--lr-app-rail-panel-radius)] - Logical
 *   `border-end-start-radius` of `[part="panel"]` -- the corner at the drawer's own flush
 *   inline-start edge, block-end side.
 * @cssprop [--lr-app-rail-panel-radius-end-end=var(--lr-app-rail-panel-radius)] - Logical
 *   `border-end-end-radius` of `[part="panel"]` -- the corner away from the flush inline-start
 *   edge, block-end side. The other corner a flush-against-one-edge drawer typically rounds. All
 *   four per-corner tokens are logical, so which physical corner each one paints swaps under
 *   `dir="rtl"` with no second consumer rule -- the panel's own flush edge stays its logical
 *   inline-start regardless of direction.
 * @cssprop [--lr-app-rail-panel-overflow-block=auto] - `[part="panel"]`'s logical
 *   `overflow-block`, paired with `--lr-app-rail-panel-overflow-inline` below.
 * @cssprop [--lr-app-rail-panel-overflow-inline=clip] - `[part="panel"]`'s logical
 *   `overflow-inline`. `clip` (the default) prevents a spurious horizontal scrollbar from wide
 *   slotted header/footer content, but also clips a `position: fixed` popup opened by a
 *   slotted/nav-item control (e.g. a slotted `<lr-select>`/`<lr-menu>`) whenever that popup's
 *   rendered box extends past the panel's own inline bounds -- a `position: fixed` box is clipped
 *   by an ancestor's non-`visible` overflow regardless of its own containing block. Setting only
 *   this one to `visible` is not enough to escape that: per the CSS overflow spec, a lone
 *   `visible` axis paired with a non-`visible` other axis computes as `auto` instead, which still
 *   clips -- set `--lr-app-rail-panel-overflow-block` to `visible` too to actually stop the
 *   clipping, accepting that wide header/footer content can then scroll/bleed both ways instead.
 * @cssprop [--lr-app-rail-background=var(--lr-color-surface)] - `[part="base"]`'s background
 *   (the docked, non-overlay presentation); the unset fallback is transparent under frame="plain".
 * @cssprop [--lr-app-rail-panel-background=var(--lr-color-surface-overlay)] - `[part="panel"]`'s
 *   background (the mobile overlay presentation) -- kept separate from
 *   `--lr-app-rail-background`/`--lr-app-rail-overlay-color` (the backdrop scrim) since the panel
 *   is deliberately themed as a modal surface, not the docked rail chrome.
 * @cssprop [--lr-app-rail-header-padding=var(--lr-space-m)] - `[part="header"]`'s padding.
 * @cssprop [--lr-app-rail-footer-padding=var(--lr-space-m)] - `[part="footer"]`'s padding.
 * @cssprop [--lr-app-rail-nav-padding=var(--lr-space-s)] - `[part="nav"]`'s padding, unset
 *   reproducing the value this rule hard-coded before the token existed.
 * @cssprop [--lr-app-rail-nav-gap=var(--lr-space-xs)] - Gap between slotted items inside
 *   `[part="nav"]`, unset reproducing the value this rule hard-coded before the token existed.
 * @cssprop [--lr-app-rail-header-min-block-size=auto] - `[part="header"]`'s minimum block size.
 *   `auto` (the default) is the property's own initial value, so unset reproduces today's exact
 *   height; set it to reserve room for header content that mounts or resizes asynchronously.
 * @cssprop [--lr-app-rail-collapse-toggle-hover-bg=var(--lr-color-brand-quiet)] - Collapse-control
 *   hover background.
 * @cssprop [--lr-app-rail-collapse-toggle-hover-color=var(--lr-color-brand)] - Collapse-control
 *   hover foreground.
 * @cssprop --lr-app-rail-collapse-toggle-active-bg - Collapse-control pressed background; defaults
 *   to the same brand-quiet active mix `[part="toggle"]` uses.
 * @cssprop [--lr-app-rail-collapse-toggle-active-color=var(--lr-color-brand)] - Collapse-control
 *   pressed foreground.
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
    appRailCollapse: LYRA_DEFAULT_appRailCollapse,
    appRailExpand: LYRA_DEFAULT_appRailExpand,
    closeNavigation: LYRA_DEFAULT_closeNavigation,
    navigation: LYRA_DEFAULT_navigation,
    openNavigation: LYRA_DEFAULT_openNavigation,
    resizeNavigation: LYRA_DEFAULT_resizeNavigation,
    resizeValuePixels: LYRA_DEFAULT_resizeValuePixels,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  /** Both are host state this component writes itself -- `mode` is the derived effective mode
   *  (authors set `preferred-mode`), `dragging` tracks a live resize gesture. Neither is settable
   *  from markup, so neither is observed; declaring them keeps the rail from reporting its own
   *  output as an unknown attribute. */
  protected static readonly knownUnobservedAttributes: readonly string[] = ['mode', 'dragging'];

  static override styles = [LyraElement.styles, styles];

  /** Below this viewport width, the rail switches from `'full'` to
   *  `'icon-only'`. Any valid CSS length, used directly in a `max-width`
   *  media query. */
  @property({ attribute: 'icon-only-breakpoint', useDefault: true }) iconOnlyBreakpoint = '960px';

  /** Below this viewport width, the rail switches from `'icon-only'` to
   *  `'mobile'`. Should be smaller than `iconOnlyBreakpoint` to produce all
   *  three states as the viewport narrows. */
  @property({ attribute: 'mobile-breakpoint', useDefault: true }) mobileBreakpoint = '600px';

  // The three `storage-key`-restorable properties below are installed by
  // `definePersistedProperty()` (see the static block under them) rather than carrying a class
  // field, so `loadPersisted()` can tell "the consumer set this" from "this is still the declared
  // default". Their `@property()` decorators keep the public attribute/type/reflection contract in
  // one readable place -- and are the shape the manifest generator reads -- while `noAccessor: true`
  // stops Lit replacing the write-tracking accessor with its own. The declared default lives in the
  // static block's `initial`, and in the `@default` JSDoc tag for the manifest; adding a class-field
  // initializer back would assign through the setter during construction and re-create the exact
  // ambiguity this shape removes.

  /** Whether the mobile floating overlay is shown. Only meaningful while
   *  `mode` is `'mobile'`; leaving mobile mode closes it so a later mobile
   *  transition never restores a stale modal. Set this directly, or use the built-in toggle button
   *  — there is no separate `show()`/`hide()` pair.
   *  @default false */
  @property({ type: Boolean, reflect: true, noAccessor: true }) open!: boolean;

  /** Floating card or edgeless plain inline presentation; unset preserves the flush rail. */
  @property({ reflect: true, converter: APP_RAIL_FRAME })
  get frame(): LyraFrame | undefined { return this._frame; }
  set frame(next: LyraFrame | undefined) {
    const value = APP_RAIL_FRAME.normalizeReflected(this, 'frame', next);
    const old = this._frame;
    if (value === old) return;
    this._frame = value;
    this.requestUpdate('frame', old);
  }
  private _frame?: LyraFrame;

  /** Extends trigger/for association to desktop presentations with managed aria-expanded,
   * aria-controls and aria-keyshortcuts. Wire the trigger's click to toggle(). Independent of
   * collapsible, which alone decides whether the built-in collapse toggle renders. */
  @property({ type: Boolean, reflect: true, attribute: 'trigger-collapses' }) triggerCollapses = false;

  /** Optional keyboard chord. Requires ctrl, meta, mod or alt; editable targets and pinned or
   * inaccessible rails are ignored. The last eligible palette or rail owns a shared chord. */
  @property({ useDefault: true }) hotkey = '';

  /** Optional accessible name for the rail's navigation landmark and mobile dialog. Every
   *  nonempty supplied string is literal; only absence/empty uses the localized fallback. A
   *  host-level `aria-label` attribute takes precedence, including an explicit empty value. */
  @property() label?: string;

  /** Accessible name overriding `label` (and its localized default) for the nav landmark / dialog
   *  role, mirroring `<lr-date-input>`'s `accessibleLabel` pattern. Reads the host's own
   *  `aria-label` attribute -- unset (the default, `null`) reproduces today's exact
   *  `label`/localized-default output. */
  @property({ attribute: 'aria-label' }) private accessibleLabel: string | null = null;

  /** Manually prefers `'full'` or `'icon-only'` for the non-mobile breakpoint axis, while the
   *  `mobile-breakpoint` continues to be tracked automatically regardless — e.g. a user's manual
   *  collapse toggle that should still yield to a genuinely too-narrow-for-any-inline-rail
   *  viewport. Only consulted while `mode` isn't pinned via `forceMode` — that continues to take
   *  full priority, unchanged. Unset (the default, `null`) reproduces today's exact
   *  breakpoint-only behavior. */
  @property({ attribute: 'preferred-mode', noAccessor: true })
  preferredMode?: LyraAppRailPreferredMode | null;

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

  /** Suppresses the built-in mobile `[part='toggle']` hamburger/OPEN button -- for a consumer that
   *  already owns an external mobile-menu trigger wired to this rail's own `open` property (see
   *  `trigger`/`for`). `false` (the default) reproduces today's exact output; note `open` still
   *  has no built-in external trigger of its own once this is set, since `lr-toggle` only fires
   *  from the toggle button being removed. This does NOT remove the button once the overlay is
   *  open: at that point it has been reparented inside the trapped `[part="panel"]` (see the
   *  `toggle` csspart doc) as the panel's only in-panel dismiss control, and hiding it there too
   *  would leave the open panel with no in-panel way to close it at all -- only Escape/backdrop. */
  @property({ type: Boolean, reflect: true, attribute: 'hide-toggle' }) hideToggle = false;

  /** Opts in the desktop collapse control: a `[part="collapse-toggle"]` button rendered inside
   *  `[part="header"]` that flips the rail between its `'full'` and `'icon-only'` presentations,
   *  the same flip `toggleCollapse()` performs. It writes `preferredMode`, so the collapse survives
   *  a reload whenever `storage-key` is set and `persist` includes `preferred-mode`, and it still
   *  yields to a viewport too narrow for any inline rail (see `preferredMode`'s own doc).
   *
   *  Not rendered at all while `mode` is `'mobile'` -- there is no inline rail to collapse there,
   *  and rendering it would add a second, meaningless control to the focus-trapped overlay next to
   *  the `[part="toggle"]` dismiss button. `false` (the default) reproduces today's exact output:
   *  no extra element, and `[part="header"]`'s own block layout unchanged. */
  @property({ type: Boolean, reflect: true }) collapsible = false;

  /** Direct reference to an external element that opens this rail's mobile overlay -- e.g. a
   *  hamburger button living in application chrome rather than this component's own built-in
   *  `[part="toggle"]` (typically paired with `hideToggle`). When set (or resolved through
   *  `for`), closing the overlay by ANY path -- Escape, backdrop click, a nav-item click, or the
   *  built-in toggle itself -- returns focus to it, the same guarantee the built-in toggle's own
   *  click already gets. An external trigger needs this explicit association instead of relying
   *  on whatever last held focus: a consumer's own JS-driven `open = true` (rather than a real
   *  click) never focuses anything, and even a real click does not reliably focus its target in
   *  every browser. Resolved once when the overlay opens; reassign after that point to change the
   *  return target for the overlay's remaining lifetime. Read alongside `for`; this direct
   *  reference wins when both resolve to different elements. Unset (the default, `null`)
   *  reproduces today's exact behavior: only the built-in toggle's own click supplies a return
   *  target, for that interaction alone. With trigger-collapses, the same association manages
   *  desktop disclosure state and shortcuts; wire the trigger to toggle(). */
  @property({ attribute: false }) trigger: HTMLElement | null = null;

  /** Id of an external element that opens this rail's mobile overlay, the label/`htmlFor`-style
   *  alternative to assigning `trigger` directly -- mirrors `<lr-page-rail>`'s `for`. Resolved
   *  against this element's own root (shadow root or document) when the overlay opens. Ignored
   *  once `trigger` is itself set. */
  @property() for = '';

  /** Opts a continuously draggable width in for the `'full'` state — exposes a `[part="resizer"]`
   *  handle (pointer-drag and `ArrowLeft`/`ArrowRight` keyboard stepping, RTL-aware) clamped to
   *  `[minRailWidthPx, maxRailWidthPx]`. Set `storageKey` to persist the fields selected by
   *  `persist`; otherwise listen for `lr-rail-resize` and persist its committed `widthPx` yourself.
   *  Call `preventDefault()` on `lr-rail-resize-request` to keep the current width. A request
   *  listener that disables resizing, leaves full mode, or disconnects the rail also cancels the
   *  pending proposal without overwriting listener state. `false` (the
   *  default) renders no resizer and leaves the fixed-width `--lr-app-rail-width` CSS token exactly
   *  as before this property existed. */
  @property({ type: Boolean, reflect: true }) resizable = false;

  /** When set, persists the fields selected by `persist` to `localStorage` under
   *  `lr-app-rail:${storageKey}`, restoring them on the next mount — mirrors `lr-multi-split`'s
   *  `storage-key`. Effective `mode` is breakpoint-derived and is never persisted, and a stored
   *  `open` is restored only onto a mount whose breakpoint-derived mode is already `'mobile'` —
   *  `open` means nothing at a wider breakpoint (see its own doc), so a stored one is dropped
   *  there rather than left primed to throw the overlay open the moment the viewport narrows.
   *  Unset (the default) means no persistence, exactly as before. */
  @property({ attribute: 'storage-key' }) storageKey?: string;

  /**
   * Whitespace-separated persistence allowlist. `open width` is the backward-compatible default;
   * use `width preferred-mode` to retain layout preference without restoring the transient mobile
   * overlay. Valid tokens are `open`, `width`, and `preferred-mode`.
   */
  @property({ useDefault: true }) persist = 'open width';

  /** The rail's current width in px while `resizable` — settable/gettable. Unset defers to the
   *  `--lr-app-rail-width` CSS token's own resolved width. */
  @property({ type: Number, attribute: 'rail-width-px', noAccessor: true })
  railWidthPx?: number;

  static {
    definePersistedProperty(this.prototype, 'open', {
      initial: false,
      attribute: true,
      type: Boolean,
      reflect: true,
    });
    definePersistedProperty(this.prototype, 'preferredMode', {
      initial: undefined,
      attribute: 'preferred-mode',
    });
    definePersistedProperty(this.prototype, 'railWidthPx', {
      initial: undefined,
      attribute: 'rail-width-px',
      type: Number,
    });
  }

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
  // Queues a single deferred `lr-mode-change` announcement for the very first mount, from either
  // source able to move `_mode` away from its constructor default before the first render:
  // `setupMediaQueries()`'s breakpoint-derived computation, called synchronously from
  // `connectedCallback()` (see its own `{ silent: true }` call for why), and/or a persisted
  // `preferredMode` willUpdate()'s first-update branch restores from storage. Both write here
  // instead of emitting immediately because `connectedCallback()` always runs -- and so always
  // computes its breakpoint-derived mode -- before that same mount's `willUpdate()` has had a
  // chance to load a persisted `preferredMode` override. Emitting the breakpoint-derived mode
  // synchronously from `connectedCallback()` would let a listener observe it as a real
  // `lr-mode-change`, then a second, correct one once the restore lands moments later -- an event
  // announcing a mode the restore was always going to immediately overwrite. Queuing instead lets
  // `willUpdate()` overwrite this field with the correct final mode before anything is ever
  // emitted, and `updated()` flushes exactly one event, once the first render (and its attribute
  // reflection) have both already landed. `undefined` means "no change to announce" -- true on an
  // ordinary mount where the settled mode never left the constructor default, and once the queued
  // event has been emitted.
  private pendingInitialModeAnnouncement?: LyraAppRailMode;
  // Whether matchMedia changes are currently ignored because a consumer
  // pinned a specific mode via `forceMode` -- see the `mode` getter doc.
  private forced = false;
  private hotkeyWindow?: Window;
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
  private triggerAria?: AriaOwnershipLease;
  // Repairs focus after a responsive mobile close or removal of a focused inline resizer.
  private recoverInlineFocusAfterResponsiveClose = false;
  private readonly navId = nextId('app-rail-nav');
  /** `[part="nav"]`'s own id, distinct from `navId`. `[part="collapse-toggle"]` lives inside the
   *  element carrying `navId`, so pointing its `aria-controls` there claimed the button expands its
   *  own ancestor; the item list it actually re-presents is `[part="nav"]`. */
  private readonly navRegionId = nextId('app-rail-nav-region');

  @query('[part="base"], [part="panel"]') private baseEl?: HTMLElement;
  @query('[part="toggle"]') private toggleEl?: HTMLButtonElement;
  private resizePointerId?: number;
  private resizeOwnerWindow?: Window;
  private resizeStartX = 0;
  private resizeStartWidth = 0;
  private resizeGestureChanged = false;
  private managedItems = new Set<HTMLElement>();

  private syncSlottedItems(): void {
    const slot = this.shadowRoot?.querySelector<HTMLSlotElement>('[part="nav"] > slot');
    const itemTag = tag('app-rail-item');
    const groupTag = tag('app-rail-group');
    const railTag = tag('app-rail');
    // Groups are marked exactly like items and forward the state to the items THEY own. The rail
    // deliberately does not reach through a group: `assignedElements({ flatten: true })` expands
    // nested `<slot>` elements, not element children, so a group's items are never in this list --
    // and having two owners write the same attribute on the same node is how the ownership bugs in
    // this file started. Referenced by tag name only, so no import edge (and no cycle) is created.
    const next = new Set(
      (slot?.assignedElements({ flatten: true }) ?? []).filter(
        (item): item is HTMLElement =>
          item.localName === itemTag || item.localName === groupTag,
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

  private resizeValueText(widthPx: number): string {
    return this.localize('resizeValuePixels', undefined, {
      value: getNumberFormat(this.effectiveLocale).format(Math.round(widthPx)),
    });
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

  /** Restore the selected persisted fields. Runs once, before the first render, and never
   *  overwrites a field the consumer already assigned before this point -- a controlled
   *  `.open=${false}`/`.railWidthPx=${240}` binding stays authoritative over stale `localStorage`
   *  state instead of being silently clobbered by it, with no `lr-toggle` (or equivalent) firing
   *  for a change the consumer never asked for. Effective `mode` remains breakpoint-derived; only
   *  the optional non-mobile `preferredMode` input is restorable.
   *
   *  The per-field guard is `isPersistedPropertyExplicitlySet()`, which reports whether the
   *  property's setter ever ran. The `changed.has(...)` check it replaces could not answer that
   *  for `open`: Lit enters a property carrying a declared default into the very first
   *  `changedProperties` batch on its own, so the guard was true on every mount and the restore
   *  never ran at all.
   *
   *  Reports which fields this pass actually wrote (never which ones storage merely held), so
   *  `willUpdate()` can post-process exactly those: fold a restored `preferredMode` into the
   *  first render's effective mode, and drop a restored `open` the settled mode cannot support. */
  private loadPersisted(): LyraAppRailRestoredFields {
    const restored: LyraAppRailRestoredFields = { open: false, preferredMode: false };
    const parsed = readPersistedState(
      this.storageFullKey,
      (v): v is { open?: unknown; railWidthPx?: unknown; preferredMode?: unknown;
      } =>
        typeof v === 'object' && v !== null,
    );
    if (!parsed) return restored;
    const fields = this.persistFields;
    if (
      fields.has('open') &&
      !isPersistedPropertyExplicitlySet(this, 'open') &&
      typeof parsed.open === 'boolean'
    ) {
      this.open = parsed.open;
      restored.open = true;
    }
    if (
      fields.has('width') &&
      !isPersistedPropertyExplicitlySet(this, 'railWidthPx') &&
      typeof parsed.railWidthPx === 'number' &&
      Number.isFinite(parsed.railWidthPx)
    ) {
      this.railWidthPx = parsed.railWidthPx;
    }
    if (
      fields.has('preferred-mode') &&
      !isPersistedPropertyExplicitlySet(this, 'preferredMode') &&
      (parsed.preferredMode === 'full' || parsed.preferredMode === 'icon-only')
    ) {
      this.preferredMode = parsed.preferredMode;
      restored.preferredMode = true;
    }
    return restored;
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
      const restored = this.loadPersisted();
      if (restored.preferredMode && !this.forced) {
        // Fold the restored preference into the first render directly (bypassing
        // setEffectiveMode()) rather than emitting lr-mode-change from inside willUpdate(): the
        // event fires synchronously, before this same update's render/attribute-reflection has
        // run, so a listener would observe a "mode changed to X" notification while `[mode]` and
        // the rendered [part="base"/"panel"] still show the pre-restore default. The restoration
        // is still observable -- a consumer syncing app chrome to the rail's mode does need to
        // learn about it -- so a single settled event is queued here and emitted from updated(),
        // once the first render (and its attribute reflection) has actually landed. This
        // overwrites -- with the correct final mode -- any announcement `connectedCallback()`'s own
        // pre-restore breakpoint computation already queued (see `pendingInitialModeAnnouncement`'s
        // doc), so a listener never observes that discarded pre-restore value. No event is queued
        // at all when the restored mode happens to equal whatever `_mode` already settled to
        // (whether that is the constructor default or the pre-restore breakpoint match): nothing
        // observable changed either way.
        const restoredMode = computeAppRailMode(
          this.iconOnlyMatches,
          this.mobileMatches,
          this.preferredMode,
        );
        if (restoredMode !== this._mode) {
          this._mode = restoredMode;
          this.pendingInitialModeAnnouncement = restoredMode;
        }
      }
      // `open` is meaningful only while the effective mode is 'mobile' -- the same invariant
      // `setEffectiveMode()` enforces for every later mode change, which cannot cover this one.
      // `connectedCallback()` -> `setupMediaQueries()` settles the breakpoint-derived mode BEFORE
      // this restore runs, and `setEffectiveMode()` early-returns on an unchanged mode, so it
      // never re-fires to fix up a value written after it: a desktop mount that stays desktop
      // would keep a stored `open: true`, reflect `[open]`, and then spring a focus-trapping,
      // scroll-locking modal on the user with no user action at all the first time the viewport
      // narrowed past `mobile-breakpoint` (where the mode-change path skips its own force-close,
      // because the mode it is entering IS 'mobile'). Dropped silently, and only for a value this
      // restore itself wrote: no `lr-toggle` announced the restore, so none announces undoing it,
      // and a consumer's own declared `open` -- an explicit initial state for the overlay rather
      // than stale cross-session storage -- stays authoritative exactly as before.
      if (restored.open && this.open && this._mode !== 'mobile') this.open = false;
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
        if (this.hasUpdated && this._mode === 'mobile' && !prefersReducedMotion(this.ownerDocument.defaultView)) {
          this.baseEl?.toggleAttribute('data-sliding', true);
        }
        this.overlayActive = next;
        // Before activate/deactivate -- see placeToggle()'s own doc for why this ordering is load
        // bearing on close (it must land before this same pass's render marks the toggle's old
        // panel parent inert).
        this.placeToggle(next);
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
    // Flushes whatever `pendingInitialModeAnnouncement` queued for this mount -- the
    // breakpoint-derived mode `connectedCallback()` computed silently, a persisted `preferredMode`
    // that overwrote it in willUpdate() above, or nothing at all -- now that this update's render
    // and attribute reflection have both landed, so the announced mode is settled and matches what
    // a listener can already observe in the DOM. Cleared unconditionally so it can only ever fire
    // once, on the very first update.
    if (this.pendingInitialModeAnnouncement !== undefined) {
      const mode = this.pendingInitialModeAnnouncement;
      this.pendingInitialModeAnnouncement = undefined;
      this.emit('lr-mode-change', { mode });
    }
    this.syncSlottedItems();
    // Idempotent catch-up: the proactive willUpdate() call above no-ops before this component's
    // very first render (its @query refs aren't resolvable yet), which matters for a rail that
    // mounts directly into an already-open mobile overlay (an initial `open` attribute plus an
    // already-matching mobile breakpoint) -- this is what actually reparents the toggle in that
    // case.
    this.placeToggle(this.overlayActive);
    // After the render that owns [part="panel"]'s identity, so the lease projects the element the
    // trigger really controls rather than the previous pass's [part="base"].
    this.syncExternalTriggerA11y();
    this.syncBuiltInKeyShortcuts();
    if (this.baseEl && (this._mode !== 'mobile' || !this.baseEl.getAnimations().some(animation =>
      'transitionProperty' in animation && animation.transitionProperty === 'transform'))) {
      this.baseEl.removeAttribute('data-sliding');
    }
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
    if (this.baseEl) {
      if (this.resizable && this.railWidthPx != null && this._mode === 'full') {
        this.baseEl.style.setProperty('inline-size', `${this.effectiveRailWidthPx}px`);
      } else {
        this.baseEl.style.removeProperty('inline-size');
      }
    }
    this.syncResizerPosition();
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.hotkeyWindow = this.ownerDocument.defaultView ?? undefined;
    if (this.hotkeyWindow) {
      registerHotkeyOwner(this.hotkeyWindow, this, this.acceptsHotkey);
      this.hotkeyWindow.addEventListener('keydown', this.onHotkeyKeyDown);
    }
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
        if (!this.isConnected) return;
        this.syncSlottedItems();
        // disconnectedCallback() hands the trigger lease back (see releaseExternalTriggerA11y),
        // and only `updated()` ever re-acquires it -- but a reconnect that lands on the SAME mode
        // schedules no update at all (`setEffectiveMode()` early-returns on an unchanged mode),
        // so without this the consumer's own hamburger button would permanently lose
        // `aria-expanded`/`aria-controls` after a reparent.
        this.syncExternalTriggerA11y();
      });
    }
  }

  override disconnectedCallback(): void {
    if (this.hotkeyWindow) {
      this.hotkeyWindow.removeEventListener('keydown', this.onHotkeyKeyDown);
      unregisterHotkeyOwner(this.hotkeyWindow, this);
      this.hotkeyWindow = undefined;
    }
    this.baseEl?.removeAttribute('data-sliding');
    super.disconnectedCallback();
    this.teardownMediaQueries();
    this.overlayHandle?.suspend();
    this.endResizerGesture();
    // The lease writes onto a consumer-owned element outside this shadow root, so it has to be
    // handed back here: a disconnected rail that left `aria-expanded` behind would announce a
    // disclosure nothing can open, and Lit's own teardown never reaches an element it does not own.
    this.releaseExternalTriggerA11y();
  }

  override adoptedCallback(): void {
    super.adoptedCallback();
    this.teardownMediaQueries();
    this.endResizerGesture();
  }

  /** Resolves the settable external open trigger -- a direct `trigger` reference, or the element
   *  `for` idrefs, in that order. `null` when neither is set or `for` doesn't resolve to a real
   *  element, in which case `activateMobileOverlay()`'s own fallback (whatever held focus when
   *  the overlay opened -- e.g. the built-in toggle after its own click) continues to apply
   *  exactly as before either property existed. */
  private resolveExternalTrigger(): HTMLElement | null {
    if (this.trigger) return this.trigger;
    if (!this.for) return null;
    const root = this.getRootNode() as Document | ShadowRoot;
    const found = root.getElementById?.(this.for);
    return found instanceof HTMLElement ? found : null;
  }

  private activateMobileOverlay(): void {
    const explicitTrigger = this.explicitTrigger;
    this.explicitTrigger = undefined;
    // A plain `undefined` (both `explicitTrigger` and the external `trigger`/`for` association
    // unset) is passed through as-is, not wrapped in a resolver -- `activateOverlayStack()` reads
    // an `undefined` `restoreFocusTo` as "capture whatever holds focus right now" (see
    // internal/overlay-stack.ts), the fallback this component relied on before either property
    // existed. Resolving eagerly, once, here (rather than via a live resolver invoked at close
    // time) matches `trigger`'s own doc: the association is fixed for the overlay's lifetime once
    // it opens.
    const restoreFocusTo = explicitTrigger ?? this.resolveExternalTrigger() ?? undefined;
    this.overlayHandle = activateOverlay({
      host: this,
      panel: () => this.shadowRoot?.querySelector<HTMLElement>('[part="panel"]') ?? null,
      onEscape: () => this.setOpen(false),
      onBackdrop: () => this.setOpen(false),
      restoreFocusTo,
      // Mirrors <lr-dialog>'s own preferredInitialFocus: the toggle now lives inside the panel
      // (see placeToggle()) as its first, and so first-focusable, child -- without this, opening
      // would move focus to the close control instead of the rail's actual nav content. Falls
      // through to the panel itself, never the toggle, when nothing else is focusable, matching
      // this component's behavior from before the toggle was ever reparented.
      preferredInitialFocus: () => {
        const panel = this.shadowRoot?.querySelector<HTMLElement>('[part="panel"]') ?? null;
        if (!panel) return null;
        const toggle = this.toggleEl ?? null;
        const stops = collectFocusableElements(panel).filter((stop) => stop !== toggle);
        return stops[0] ?? panel;
      },
      lockScroll: true,
      suspendWhenUnrendered: true,
    });
  }

  private deactivateMobileOverlay(restoreFocus = true): void {
    this.overlayHandle?.deactivate({ restoreFocus });
    this.overlayHandle = undefined;
  }

  /** Reparents the (never destroyed/recreated) toggle button between its two valid DOM positions:
   *  the first child of `[part="panel"]` while the mobile overlay is open, so the shared focus
   *  trap and `aria-modal` subtree (both scoped to the panel alone) actually reach it, or a
   *  sibling immediately ahead of `[part="base"]`/`[part="panel"]` -- its resting position --
   *  otherwise. Called BEFORE `activateMobileOverlay()`/`deactivateMobileOverlay()` from
   *  `willUpdate()` so the move (in either direction) always lands before that same pass's render
   *  applies `[part="panel"]`'s `inert` attribute: moving the focused toggle out first, ahead of
   *  `inert` landing on its old parent, is what lets `deactivateMobileOverlay()`'s focus-return
   *  land and stick instead of the browser force-blurring it a moment later for having become a
   *  descendant of a newly-inert ancestor. Also called from `updated()` as an idempotent
   *  post-render catch-up, since this component's own `@query` refs are not yet resolvable before
   *  the very first render -- needed for a rail that mounts directly into an already-open mobile
   *  overlay. Each branch checks the toggle's current position and skips the DOM write entirely
   *  when it is already where it belongs -- NOT merely as an optimization: `Node.insertBefore()`
   *  unconditionally removes the node from its current parent before re-inserting it, even when
   *  the requested position is exactly where the node already is, and removing the currently
   *  *focused* element -- even for a single synchronous remove-then-reinsert with no yield to the
   *  browser -- silently drops focus. `updated()`'s post-render catch-up call runs immediately
   *  after `deactivateMobileOverlay()`'s own focus-return inside the same `willUpdate()`/render
   *  pass, so an unconditional `insertBefore()` there would re-blur the toggle right after focus
   *  had just been restored to it. Observed for real: before this guard, "returns focus to the
   *  toggle button after closing" failed only once `placeToggle()`'s close-direction move itself
   *  started working (see the `parentNode`/`parentElement` note above) -- while that move was
   *  silently a no-op, this redundant call was too, which is why the loss went unnoticed. */
  private placeToggle(insidePanel: boolean): void {
    const toggle = this.toggleEl;
    const panel = this.baseEl;
    if (!toggle || !panel) return;
    if (insidePanel) {
      if (panel.firstChild !== toggle) panel.insertBefore(toggle, panel.firstChild);
      return;
    }
    // `parentNode`, not `parentElement`: [part="base"]/[part="panel"] is a direct child of this
    // component's shadow root in the render template below, and `Node.parentElement` returns
    // `null` (not the root) whenever a node's parent isn't itself an Element -- a ShadowRoot is a
    // DocumentFragment, not an Element, so `panel.parentElement` was always `null` here and the
    // `?.` silently skipped this insertBefore on every close, leaving the toggle stranded inside
    // the panel. `parentNode` resolves to the ShadowRoot itself, which implements `insertBefore`
    // the same as any other `Node`.
    if (toggle.nextSibling !== panel) panel.parentNode?.insertBefore(toggle, panel);
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
    if (this.forced) return;
    // The very first call here runs synchronously from connectedCallback(), before this same
    // mount's willUpdate() has had a chance to restore a persisted `preferredMode` (see
    // `pendingInitialModeAnnouncement`'s doc) -- compute the mode silently and let that first
    // update cycle reconcile and announce whatever the settled result turns out to be. A
    // reconnect and a live breakpoint-attribute change both always run with `hasUpdated` already
    // true, so they keep today's immediate, synchronous announcement unchanged.
    this.applyComputedMode(this.hasUpdated ? undefined : { silent: true });
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

  private applyComputedMode(options?: { silent?: boolean }): void {
    this.setEffectiveMode(
      computeAppRailMode(this.iconOnlyMatches, this.mobileMatches, this.preferredMode),
      options,
    );
  }

  private setEffectiveMode(next: LyraAppRailMode, options?: { silent?: boolean }): void {
    if (this._mode === next) return;
    const old = this._mode;
    const resizer = this.renderRoot?.querySelector<HTMLElement>('[part="resizer"]');
    if (old === 'full' && next === 'icon-only' && resizer && composedContains(resizer, deepActiveElement(this.ownerDocument))) {
      this.recoverInlineFocusAfterResponsiveClose = true;
    }
    if (next !== 'mobile') this.baseEl?.removeAttribute('data-sliding');
    if (old === 'mobile' && next !== 'mobile' && this.open) {
      this.recoverInlineFocusAfterResponsiveClose = true;
    }
    this._mode = next;
    if (this.baseEl) {
      if (!(this.resizable && this.railWidthPx != null && next === 'full')) {
        this.baseEl.style.removeProperty('inline-size');
      }
    }
    this.requestUpdate('mode', old);
    // `silent` is set only by setupMediaQueries()'s very first, pre-render call (see
    // `pendingInitialModeAnnouncement`'s doc) -- queue instead of emitting immediately so a
    // same-mount persisted-`preferredMode` restore in willUpdate() gets the chance to overwrite
    // this with the correct final mode before a listener ever observes either value.
    if (options?.silent) {
      this.pendingInitialModeAnnouncement = next;
    } else {
      this.emit('lr-mode-change', { mode: next });
    }
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
  /**
   * Flips the rail between its `'full'` and `'icon-only'` presentations by writing
   * `preferredMode` -- the same action `[part="collapse-toggle"]` performs, exposed for a consumer
   * that renders its own collapse control (in app chrome, a command palette, a keyboard shortcut)
   * instead of, or alongside, opting into `collapsible`.
   *
   * Writes `preferredMode`, never `forceMode`: the collapse is a *preference* on the
   * full/icon-only axis, so the `mobile-breakpoint` keeps being tracked automatically and a
   * genuinely too-narrow viewport still wins. It therefore persists exactly like any other
   * `preferredMode` write -- whenever `storage-key` is set and `persist` includes
   * `preferred-mode` -- and announces itself through the existing `lr-mode-change` event.
   *
   * A no-op while `mode` is `'mobile'`: there is no inline rail to collapse, and flipping the
   * preference from there would silently arm a presentation the user never chose for whenever the
   * viewport widened again. While `forceMode` pins the mode the preference is still recorded, and
   * alternates from the recorded preference and takes effect once the pin is released.
   */
  toggleCollapse(): void {
    if (this._mode === 'mobile') return;
    this.preferredMode = (this.preferredMode ?? this._mode) === 'icon-only' ? 'full' : 'icon-only';
  }

  /** Opens/closes the mobile overlay or toggles the inline full/icon-only preference.
   * Does nothing while disconnected. A pinned mode records the preference for later use. */
  toggle(): void {
    if (!this.isConnected) return;
    if (this._mode === 'mobile') this.setOpen(!this.open);
    else this.toggleCollapse();
  }

  private acceptsHotkey = (event: KeyboardEvent): boolean => {
    const parsed = parseHotkey(this.hotkey);
    return this.isConnected && !this.forced && parsed !== null && hasNonShiftModifier(parsed) &&
      matchesHotkey(parsed, event, detectPlatform(this.hotkeyWindow?.navigator) === 'mac') &&
      !isEditableKeyEventTarget(event) && isAccessibilityVisible(this);
  };

  private onHotkeyKeyDown = (event: Event): void => {
    if (event.defaultPrevented || isIgnorableKeyEvent(event) || !this.hotkeyWindow) return;
    const keyboard = event as KeyboardEvent;
    if (!this.acceptsHotkey(keyboard) || resolveHotkeyOwner(this.hotkeyWindow, keyboard) !== this) return;
    event.preventDefault();
    this.toggle();
  };

  private get resolvedHotkeyShortcuts(): string | null {
    const parsed = parseHotkey(this.hotkey);
    return hotkeyAriaKeyShortcuts(parsed && hasNonShiftModifier(parsed) ? parsed : null,
      detectPlatform(this.ownerDocument.defaultView?.navigator) === 'mac');
  }

  private syncBuiltInKeyShortcuts(): void {
    const value = this.resolvedHotkeyShortcuts;
    for (const control of [this.toggleEl, this.renderRoot.querySelector('[part="collapse-toggle"]')]) {
      if (!control || control.getAttribute('aria-keyshortcuts') === value) continue;
      if (value === null) control.removeAttribute('aria-keyshortcuts');
      else control.setAttribute('aria-keyshortcuts', value);
    }
  }

  private onPanelTransition = (event: TransitionEvent): void => {
    if (event.target === event.currentTarget && event.propertyName === 'transform') this.baseEl?.removeAttribute('data-sliding');
  };

  private onCollapseToggleClick = (): void => {
    this.toggleCollapse();
  };

  /** Projects the disclosure state of the mobile overlay onto whatever external element
   *  `trigger`/`for` resolves to, through the shared ARIA-ownership lease `<lr-popover>` uses for
   *  the same job. An external trigger lives in the consumer's light DOM while `[part="panel"]`
   *  lives in this shadow root, so a plain `aria-controls` idref cannot connect them -- the lease
   *  falls back to the `ariaControlsElements` element-reference form, which crosses the boundary,
   *  and restores whatever the consumer had written itself once released.
   *
   *  Applied in mobile mode, or on desktop when triggerCollapses explicitly opts in. Without
   *  that option an inline rail publishes no external disclosure. Unlike focus return (resolved
   *  once, when the overlay opens), this tracks live: reassigning `trigger` moves the state to the
   *  new element and clears it from the old one on the next update. */
  private syncExternalTriggerA11y(): void {
    const mobile = this._mode === 'mobile';
    const trigger = mobile || this.triggerCollapses ? this.resolveExternalTrigger() : null;
    if (!trigger) {
      this.releaseExternalTriggerA11y();
      return;
    }
    const panel = this.baseEl ?? null;
    const contribution = {
      attributes: {
        'aria-expanded': (mobile ? this.open : this._mode === 'full') ? 'true' : 'false',
        'aria-keyshortcuts': this.resolvedHotkeyShortcuts,
      },
      controls: panel ? [panel] : [],
    };
    if (this.triggerAria) this.triggerAria.update(trigger, contribution);
    else this.triggerAria = acquireAriaOwnership(trigger, contribution);
  }

  private releaseExternalTriggerA11y(): void {
    this.triggerAria?.release();
    this.triggerAria = undefined;
  }


  // See the default-slot @slot doc -- any click inside the nav items while
  // the overlay is open closes it, without trying to distinguish a real
  // navigation trigger from incidental slotted content.
  private onNavItemClick = (): void => {
    if (this.overlayActive) this.setOpen(false);
  };

  // Each reads the light-DOM `slot` attribute directly rather than the live `assignedElements()`
  // snapshot: WebKit has been observed reporting the latter transiently empty for an unrelated
  // forwarding-slot chain nested inside the assigned element (see `<lr-switch>`'s equivalent
  // fix), even though the assigned child's own `slot` attribute never changed.
  private onHeaderSlotChange = (): void => {
    this.hasHeaderSlot = Array.from(this.children).some((el) => el.getAttribute('slot') === 'header');
  };
  private onFooterSlotChange = (): void => {
    this.hasFooterSlot = Array.from(this.children).some((el) => el.getAttribute('slot') === 'footer');
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
    if (!this.resizable || this._mode !== 'full' || !this.isConnected) return false;
    if (next === this.effectiveRailWidthPx) return false;
    const event = this.emit('lr-rail-resize-request', { widthPx: next }, { cancelable: true });
    if (!this.resizable || this._mode !== 'full' || !this.isConnected) {
      this.endResizerGesture();
      return false;
    }
    if (event.defaultPrevented) return false;
    this.railWidthPx = next;
    if (commit) this.emit('lr-rail-resize', { widthPx: next });
    else this.resizeGestureChanged = true;
    return true;
  }

  private onResizerKeyDown = (e: KeyboardEvent): void => {
    const rtl = this.getAttribute('dir') === 'rtl' || isRtl(this);
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

  private syncResizerPosition(): void {
    const resizer = this.renderRoot.querySelector<HTMLElement>('[part="resizer"]');
    if (!resizer || !this.baseEl || this._mode !== 'full' || !this.resizable) return;
    const hostRect = this.getBoundingClientRect();
    const baseRect = this.baseEl.getBoundingClientRect();
    const half = resizer.getBoundingClientRect().width / 2;
    const rtl = this.getAttribute('dir') === 'rtl' || isRtl(this);
    const offset = rtl ? hostRect.right - baseRect.left : baseRect.right - hostRect.left;
    resizer.style.setProperty('inset-inline-start', `${offset - half}px`);
    resizer.style.removeProperty('inset-inline-end');
  }

  override render(): TemplateResult {
    const mobile = this._mode === 'mobile';
    const railWidthPx = this.effectiveRailWidthPx;
    const showCollapse = this.collapsible && !mobile;
    const expanded = this._mode !== 'icon-only';
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
        @transitionend=${this.onPanelTransition}
        @transitioncancel=${this.onPanelTransition}
      >
        <div part="header" ?hidden=${!this.hasHeaderSlot && !showCollapse}>
          <slot name="header" @slotchange=${this.onHeaderSlotChange}></slot>
          ${showCollapse
            ? html`<button
                part="collapse-toggle"
                type="button"
                aria-expanded=${expanded ? 'true' : 'false'}
                aria-controls=${this.navRegionId}
                aria-label=${expanded
                  ? this.localize('appRailCollapse')
                  : this.localize('appRailExpand')}
                @click=${this.onCollapseToggleClick}
              ><span part="collapse-icon" aria-hidden="true">${chevronIcon()}</span></button>`
            : nothing}
        </div>
        <div part="nav" id=${this.navRegionId}>
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
            aria-valuenow=${Math.round(railWidthPx)}
            aria-valuetext=${this.resizeValueText(railWidthPx)}
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
