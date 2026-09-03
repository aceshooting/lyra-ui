import type { LyraEventDetailSnapshot } from '../../../internal/lyra-element.js';
import { html, nothing, type TemplateResult, type PropertyDeclaration, type PropertyValues } from 'lit';
import { property, query } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import {
  activateOverlay,
  type OverlayHandle,
} from '../../../internal/overlay-manager.js';
import { isRtl } from '../../../internal/rtl.js';
import { finiteRange } from '../../../internal/numbers.js';
import { getNumberFormat } from '../../../internal/intl-cache.js';
import {
  CollapseBreakpointController,
  OrientationBreakpointController,
  type BreakpointBasis,
} from '../../../internal/orientation-breakpoint.js';
import {
  readPersistedState,
  writePersistedState,
} from '../../../internal/persisted-state.js';
import { resolveCssLength } from '../../../internal/css-length.js';
import type { LyraOrientation } from '../../../internal/shared-unions.js';
import { styles } from './multi-split.styles.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_resizeDivider, LYRA_DEFAULT_resizeValuePercent } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END

const KEYBOARD_STEP = 2;

interface PersistedPanelSize {
  readonly panelId: string;
  readonly size: number;
}

interface PersistedPanelLayout {
  readonly version: 1;
  readonly panels: readonly PersistedPanelSize[];
}

function isPersistedPanelLayout(value: unknown): value is PersistedPanelLayout {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Partial<PersistedPanelLayout>;
  if (candidate.version !== 1 || !Array.isArray(candidate.panels)) return false;
  return candidate.panels.every((panel) => {
    if (typeof panel !== 'object' || panel === null) return false;
    const record = panel as Partial<PersistedPanelSize>;
    return (
      typeof record.panelId === 'string' &&
      record.panelId !== '' &&
      record.panelId.trim() === record.panelId &&
      typeof record.size === 'number' &&
      Number.isFinite(record.size) &&
      record.size >= 0
    );
  });
}

// Sentinel fallbacks so a one-sided constraint (only `minPx` or only
// `maxPx`) can still be expressed as a 3-argument CSS `clamp()` in the
// static layout, instead of needing two different flex-basis shapes.
const NO_MIN_PX = 0;
const NO_MAX_PX = 1_000_000;

interface DragState {
  index: number;
  startPos: number;
  base: HTMLElement;
  /** Cumulative delta already folded into the live `sizes` so far this
   *  gesture — clamping against live sizes (see onPointerMove) means each
   *  move must apply only the *incremental* delta since the last move, not
   *  the total-since-drag-start delta a snapshot-based clamp would use. */
  appliedDelta: number;
  /** Whether this pointer accepted at least one resize proposal. A pointerup
   *  only persists after an accepted proposal, so a listener that vetoes every
   *  move cannot cause a write of the unchanged layout. */
  acceptedResize: boolean;
}

/** A fixed-pixel-range constraint for one panel; index-aligned with `sizes`/
 *  `panelConstraints`. Either bound may be omitted to leave that side
 *  unconstrained (falls back to the component's percent-based `min`). */
export interface LyraMultiSplitPanelConstraint {
  readonly minPx?: number;
  readonly maxPx?: number;
  readonly minPercent?: number;
  readonly maxPercent?: number;
}

export type LyraMultiSplitConstraintIssueReason =
  | 'minimum-total'
  | 'maximum-total'
  | 'minimum-exceeds-maximum';

export interface LyraMultiSplitConstraintIssueDetail {
  readonly reason: LyraMultiSplitConstraintIssueReason;
  readonly panelCount: number;
  readonly minimumTotal: number;
  readonly maximumTotal: number | null;
  readonly containerSize: number;
}

interface ConstraintResolution {
  bounds: Array<{ min: number; max: number }>;
  usePanelConstraints: boolean;
  issue?: LyraMultiSplitConstraintIssueDetail;
}

// `position`/`inset-block`/`inset-inline-start`/`inset-inline-end` used to be owned here too, but
// their floating-state value is always the same fixed literal ('absolute', '0') rather than
// per-render computed data -- see multi-split.styles.ts's `::slotted([data-collapse-state='floating'])`
// rule, which now owns them as ordinary (overridable) stylesheet rules instead. Only genuinely
// live, per-render-computed properties stay here: `inline-size` mirrors the panel's own live,
// draggable `sizes[i]` percent (by design, so there's no visual jump un-floating -- see updated()).
const OWNED_PANEL_STYLE_PROPERTIES = ['flex', 'order', 'inline-size'] as const;

type OwnedPanelStyleProperty = (typeof OWNED_PANEL_STYLE_PROPERTIES)[number];

interface PanelStyleValue {
  value: string;
  priority: string;
}

interface PanelOwnershipSnapshot {
  readonly styles: Map<OwnedPanelStyleProperty, PanelStyleValue>;
  readonly appliedStyles: Map<OwnedPanelStyleProperty, PanelStyleValue>;
  hidden: HTMLElement['hidden'];
  appliedHidden?: HTMLElement['hidden'];
  collapseState: string | null;
  appliedCollapseState?: string | null;
}

/** Which pane (if any) participates in responsive collapse (see `collapse`). */
export type LyraMultiSplitCollapseMode = 'start' | 'end' | 'none';

/** The collapsing pane's current responsive state — `'wide'` is the normal
 *  drag-resizable percent layout (identical to `collapse="none"`); `'rail'`
 *  clamps it to `railWidth`; `'floating'` lifts it out of the flex flow as an
 *  overlay above the other pane. */
export type LyraMultiSplitCollapseState = 'wide' | 'rail' | 'floating';

/** What can be *assigned* to `collapseState` -- `'auto'` is a write-only
 *  sentinel; see the `collapseState` accessor doc. */
export type LyraMultiSplitCollapseStateInput =
  | LyraMultiSplitCollapseState
  | 'auto';

export interface LyraMultiSplitCollapseChangeDetail {
  readonly state: LyraMultiSplitCollapseState;
}

export interface LyraMultiSplitToggleDetail {
  readonly open: boolean;
}

export interface LyraMultiSplitResizeDetail {
  readonly sizes: readonly number[];
}

export interface LyraMultiSplitOrientationChangeDetail {
  readonly orientation: LyraOrientation;
}

export interface LyraMultiSplitEventMap {
  'lr-resize-request': CustomEvent<LyraEventDetailSnapshot<LyraMultiSplitResizeDetail>>;
  'lr-resize': CustomEvent<LyraEventDetailSnapshot<LyraMultiSplitResizeDetail>>;
  'lr-multi-split-collapse-change': CustomEvent<LyraMultiSplitCollapseChangeDetail>;
  'lr-toggle': CustomEvent<LyraMultiSplitToggleDetail>;
  'lr-multi-split-constraints-invalid': CustomEvent<LyraMultiSplitConstraintIssueDetail>;
  'lr-multi-split-orientation-change': CustomEvent<LyraMultiSplitOrientationChangeDetail>;
}
/**
 * `<lr-multi-split>` — resizable panels for dashboard layouts. Direct light-DOM
 * children are the panels; a divider is auto-inserted between each pair. Give every panel a
 * unique, nonempty, whitespace-stable `panel-id` when using `storageKey`: persistence records `panelId`/size pairs,
 * so reordered or replaced panels recover the size belonging to their business identity instead
 * of whichever panel happens to occupy the old array index. Missing or duplicate identities fail
 * persistence closed while leaving the live, non-persisted split usable.
 * In a fixed block allocation, each direct panel is a scroll container
 * (`min-block-size: 0; overflow: auto`) so long content stays within the
 * split instead of escaping into following content. Set an individual
 * panel's own `overflow` when it needs a different scrolling surface.
 *
 * Optionally, one pane can opt in to responsive collapse via `collapse`
 * (`"start"`/`"end"`, default `"none"` — no behavior change when unset): as
 * the split's own container narrows past `railBreakpoint` that pane clamps
 * to a fixed `railWidth`, and past the narrower `floatBreakpoint` it instead
 * becomes an absolutely-positioned overlay "floating card" above the other
 * pane. Both breakpoints accept a bare pixel number or a CSS length
 * (`px`/`rem`/`em`), and `collapseBreakpointBasis="viewport"` measures them
 * against the viewport via `matchMedia` instead of this component's own
 * allocation. This component only handles the width-collapse mechanics and
 * signals the current state — via the `collapseState`-derived
 * `data-collapse-state` attribute (set on both the host and the collapsing
 * panel itself) and the `lr-multi-split-collapse-change` event — it renders no
 * icon-only/collapsed UI of its own; slotted content is expected to adapt to
 * its own clamped width (e.g. via its own container query).
 *
 * `collapseState` is a public accessor with force/auto semantics mirroring
 * `<lr-app-rail>`'s `mode`: it's normally derived automatically from the
 * measured container width (via a `ResizeObserver` on `[part="base"]`)
 * whenever it crosses `railBreakpoint`/`floatBreakpoint`, but assigning it a
 * concrete `'wide'`/`'rail'`/`'floating'` value pins it there and stops that
 * automatic tracking — useful for a consumer-driven toggle (e.g. a button
 * that forces `'floating'` regardless of width). Assigning the write-only
 * `'auto'` sentinel releases the pin and immediately re-derives the state
 * from the current measured width, resuming automatic tracking. `'auto'` is
 * never a value this getter returns.
 * While `collapse="none"` or fewer than two direct panels exist, the public
 * and reflected effective state is always `'wide'`: a forced rail/floating
 * intent is retained privately for a later eligible pane but cannot emit,
 * render a backdrop, acquire focus/scroll-lock ownership, or project panel
 * markers. Enabling/disabling an eligible pane is itself an effective state
 * transition; disabling closes `open` and releases overlay/focus ownership.
 *
 * The `'floating'` state is a hidden-by-default drawer, gated by `open`
 * (mirrors `<lr-app-rail>`'s mobile overlay): while `collapseState` is
 * `'floating'` and `open` is `false` (the default), the collapsing panel
 * renders nothing — `hidden`, out of the accessibility tree, not just
 * visually hidden — instead of the always-visible overlay card this state
 * rendered before `open` existed. Setting `open = true` reveals it as a
 * focus-trapped floating panel with a `[part="backdrop"]` scrim; Escape or a
 * backdrop click proposes a cancelable close before changing `open`. Every sibling pane behind the drawer is inert for the
 * same interval, while the floating pane is the shared overlay manager's modal root. `open` is preserved (not reset)
 * while `collapseState` isn't `'floating'`, but no drawer chrome renders
 * until it is again — except that leaving `'floating'` while `open` is
 * `true` (a breakpoint crossing back to `'wide'`/`'rail'`, or a forced
 * reassignment) also closes it, the same way `<lr-app-rail>` closes its
 * mobile overlay when leaving `'mobile'` while open.
 *
 * Public collection properties take bounded, clone-owned readonly snapshots. Create a new
 * collection and reassign it after changes; mutating the assigned array does not update the view.
 *
 * @customElement lr-multi-split
 * @event lr-resize-request - A cancelable proposed `sizes` change from a divider drag or keyboard
 *   step. Call `preventDefault()` to keep `sizes` and persistence unchanged. Not fired when a
 *   consumer sets `sizes` directly. `detail: { sizes }` (`LyraMultiSplitResizeDetail`).
 * @event lr-resize - `detail: { sizes }`, fired on every drag movement that changes sizes and every
 *   keyboard step after `sizes` is assigned. Non-cancelable; not fired when a consumer sets
 *   `sizes` directly. Pointer release persists the settled sizes but emits no additional event.
 * @event lr-multi-split-collapse-change - `detail: { state }` (`LyraMultiSplitCollapseChangeDetail`),
 *   fired whenever the responsive `collapseState` actually transitions between
 *   `'wide'`/`'rail'`/`'floating'` — whether from a breakpoint crossing or an
 *   explicit `collapseState` assignment or collapse feature enable/disable.
 *   Forced writes while no eligible collapsing pane exists are inert and do
 *   not fire. Not fired for a redundant reassignment to the state already in
 *   effect.
 * @event lr-toggle - An Escape/backdrop request to close the floating drawer, or the forced close
 *   when an effective collapse transition leaves `'floating'` while open. `detail:
 *   LyraMultiSplitToggleDetail`. Escape/backdrop proposals are cancelable and fire before `open`
 *   changes; the forced responsive close is non-cancelable and fires after `open` is false. Direct
 *   `open` writes and no-op dismissals do not emit this event.
 * @event lr-multi-split-constraints-invalid - `detail: LyraMultiSplitConstraintIssueDetail`,
 *   fired once when the configured panel minimums/maximums cannot describe a
 *   layout that fits the track. The splitter rejects that infeasible set for
 *   interaction and falls back to a normalized percent minimum.
 * @event lr-multi-split-orientation-change - `detail: { orientation }`, fired when an enabled
 *   `orientationBreakpoint` changes the effective resize/layout axis.
 * @slot - Panels to arrange side by side (or stacked, when `orientation="vertical"`); each direct child becomes one resizable panel. Set a unique nonempty, whitespace-stable `panel-id` on every panel when using persistence.
 * @csspart base - The flex layout wrapper (`position: relative`, so the `'floating'` collapse state can anchor to it).
 * @csspart divider - Each `role="separator"` between two panels. `aria-valuenow` is the leading
 *   panel's percentage; `aria-valuemin`/`aria-valuemax` are that divider's currently achievable
 *   range, bounded by both adjacent panels' effective constraints and their current combined
 *   share (not whole-track bounds). Home/End move directly to those achievable extremes. Carries
 *   `aria-disabled="true"` and is drag/keyboard-inert
 *   while its adjacent panel is collapsed (`'rail'`/`'floating'`).
 * @csspart backdrop - The `'floating'` drawer's scrim. Only rendered while `collapseState === 'floating'` and `open`.
 * @cssprop [--lr-multi-split-overlay-color=var(--lr-color-overlay)] - The `'floating'` drawer scrim's color, applied to `[part="backdrop"]`.
 * @cssprop [--lr-multi-split-divider-target-size=max(var(--lr-icon-button-size),var(--lr-size-3px))] -
 *   The real layout gutter reserved for each divider along the resize axis. The narrow visual rule
 *   is centered inside this owned track, so the target never overlaps either adjacent panel.
 * @status stable
 * @since 9.0.0
 */
export class LyraMultiSplit extends LyraElement<LyraMultiSplitEventMap> {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    resizeDivider: LYRA_DEFAULT_resizeDivider,
    resizeValuePercent: LYRA_DEFAULT_resizeValuePercent,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  protected static override readonly ownedCollectionProperties = Object.freeze(['sizes', 'defaultSizes', 'panelConstraints']);

  static override styles = [LyraElement.styles, styles];
  // A proposal listener can restore a value before it returns. Count writes rather than comparing
  // only final snapshots so a synchronous reentrant state change still aborts the proposal.
  private toggleProposalDepth = 0;
  private toggleProposalMutationVersion = 0;
  private forcedCloseVersion = 0;
  protected static override readonly immutableEventDetails = Object.freeze([
    'lr-resize-request',
    'lr-resize',
  ]);

  // `collapseState` needs a custom accessor (force/auto semantics -- see the
  // class doc) rather than the usual @property()-generated one -- registered
  // here, alongside the decorator-declared properties below, the same way
  // lr-app-rail's `mode` is. `reflect: true` still applies: LitElement's
  // update loop reflects any `reflect`-flagged property to its attribute
  // generically by reading `this[name]` after render, regardless of whether
  // that property has a custom or auto-generated accessor. `attribute` is
  // spelled out (unlike `mode`, a single word whose Lit-default lowercase
  // form already reads fine) so the reflected attribute stays kebab-case,
  // matching this file's other attribute-reflected properties.
  static override properties = {
    collapseState: {
      reflect: true,
      attribute: 'collapse-state',
      noAccessor: true,
    },
  };

  @property({ attribute: false }) sizes: readonly number[] = [];
  /** Initialization-only size fallback, below valid persistence and above equal distribution. Later
   *  assignments never overwrite live resize state. Each entry is either a plain number (percent of
   *  the container, matching today's exact strict behavior) or a CSS length string (`'200px'`,
   *  `'20%'`, `'3rem'`) resolved against the measured container before percent-space validation --
   *  see `resolveDefaultSizes()`. Initialization runs on the first update (not synchronously on
   *  connection), so same-turn framework property bindings and `storageKey` persistence participate
   *  before the layout becomes live. A pure-number array is validated unchanged (an array that does
   *  not sum to ~100 is still rejected). */
  @property({ attribute: false }) defaultSizes: readonly (number | string)[] = [];
  @property({ type: Number }) min = 10;
  @property({ reflect: true }) orientation: LyraOrientation = 'horizontal';
  /** Opt-in inline-size breakpoint for this component's *own* measured allocation. Below it,
   *  `narrowOrientation` becomes effective. Unset by default — the whole responsive-orientation
   *  feature (and its `ResizeObserver`) is off, and `effectiveOrientation` just tracks
   *  `orientation`.
   *
   *  Accepts a bare pixel number (`900`, `orientation-breakpoint="900"` — the original form) or a
   *  CSS length string: `'900px'`, `'56.25rem'`, `'3em'`. Under the default
   *  `orientationBreakpointBasis="container"`, `rem` resolves against the *document root*'s
   *  computed font size — the rule a `@container` query follows, not a `@media` query's — and `em`
   *  against this element's own computed font size. The length is re-resolved on every measurement,
   *  never cached at first render, so a root font-size change moves the crossing width with no
   *  invalidation step. To stay in step with a sibling `@media (max-width: 56.25rem)` rule, use
   *  `orientationBreakpointBasis="viewport"`, which hands the length to the browser instead; see
   *  that property for why the two resolve `rem` differently.
   *
   *  Anything else — `''`, `'auto'`, garbage, a non-finite number, and deliberately `%`/`vw`/`vh`/
   *  `calc()` (which would mix reference boxes against an element-relative measurement) — behaves
   *  exactly as unset. Set `orientationBreakpointBasis="viewport"` for a viewport-relative
   *  breakpoint instead. */
  @property({ attribute: 'orientation-breakpoint' }) orientationBreakpoint?:
    | number
    | string;
  /** Which box `orientationBreakpoint` measures. `'container'` (the default) observes this
   *  component's own `[part="base"]` inline size via `ResizeObserver`, comparing strictly `<`.
   *  `'viewport'` instead evaluates `matchMedia('(max-width: <breakpoint>)')`, which is inclusive
   *  (`<=`) — native `max-width` semantics, deliberately, so the crossing point matches a CSS
   *  `@media` rule authored with the same length exactly.
   *
   *  Use `'viewport'` when two siblings in one row must flip together at a shared breakpoint: a row
   *  that stacks via a pure-CSS `@media` rule makes each sibling's own width non-monotonic across
   *  the transition, so no self-measured threshold can express it. `'viewport'` also lets the
   *  browser resolve a `rem` breakpoint with real `@media` semantics, keeping it in step with such
   *  a rule across browser zoom and user font-size preferences. */
  @property({ reflect: true, attribute: 'orientation-breakpoint-basis' })
  orientationBreakpointBasis: BreakpointBasis = 'container';
  /** Layout/resize axis used below `orientationBreakpoint`. */
  @property({ reflect: true, attribute: 'narrow-orientation' })
  narrowOrientation: LyraOrientation = 'vertical';
  @property({ attribute: 'storage-key' }) storageKey?: string;
  /** Optional px and/or percent min/max per panel, index-aligned with `sizes`. A
   *  `null`/missing entry leaves that panel purely percent-based (the
   *  existing `min`-only behavior). `sizes`, the `lr-resize` payload, and
   *  localStorage persistence stay percent-based regardless — only the
   *  effective clamp bounds change for a constrained panel. */
  @property({ attribute: false })
  panelConstraints: readonly (LyraMultiSplitPanelConstraint | null)[] = [];
  /** Opts a pane in to responsive collapse: `'start'` is the first light-DOM
   *  panel (index 0), `'end'` is the last. Both are LOGICAL positions, same
   *  as CSS `inset-inline-start`/`-end` — see the `collapsingIndex` getter
   *  for why that already resolves to the same physical index under RTL for
   *  this component (panels are never re-`order`ed for RTL, only the drag
   *  delta sign mirrors). Default `'none'`: none of the collapse behavior
   *  below applies, and rendering/behavior is identical to before this
   *  property existed. */
  @property({ reflect: true }) collapse: LyraMultiSplitCollapseMode = 'none';
  /** Fixed CSS length the collapsing pane clamps to in the `'rail'` state. */
  @property({ attribute: 'rail-width' }) railWidth = '3.5rem';
  /** Width below which the collapsing pane switches from its normal percent width to the fixed
   *  `railWidth` (`'rail'` state). Must stay above `floatBreakpoint` — an inverted pair is
   *  sanitized by raising this one to match, which collapses the `'rail'` band away rather than
   *  leaving a wide container reported as collapsed.
   *
   *  Accepts a bare pixel number (`640`, `rail-breakpoint="640"` — the original form) or a CSS
   *  length string: `'640px'`, `'68.75rem'`, `'3em'`. Under the default
   *  `collapseBreakpointBasis="container"` this is compared against this component's own measured
   *  `[part="base"]` inline size, strictly `<`, and `rem` resolves against the *document root*'s
   *  computed font size (a `@container` query's rule, not a `@media` query's) while `em` resolves
   *  against this element's own. The length is re-resolved on every measurement, never cached, so
   *  a root font-size change moves the crossing width with no invalidation step.
   *
   *  Anything the grammar rejects — `''`, `'auto'`, garbage, a non-finite number, and deliberately
   *  `%`/`vw`/`vh`/`calc()`/`var()` — falls back to the `640` default rather than switching the
   *  feature off (unlike `orientationBreakpoint`, this breakpoint has a documented default to fall
   *  back to). A negative length is floored at `0`, i.e. never crossed.
   *
   *  Default: `640`. */
  @property({ attribute: 'rail-breakpoint' }) railBreakpoint:
    | number
    | string = 640;
  /** Width below which the collapsing pane instead becomes an absolutely-positioned overlay above
   *  the other pane (`'floating'` state). Same accepted forms, basis, and sanitization as
   *  `railBreakpoint`; an unparseable value falls back to the `400` default.
   *
   *  Default: `400`. */
  @property({ attribute: 'float-breakpoint' }) floatBreakpoint:
    | number
    | string = 400;
  /** Which box `railBreakpoint`/`floatBreakpoint` measure. `'container'` (the default) observes
   *  this component's own `[part="base"]` inline size via `ResizeObserver`, comparing strictly `<`.
   *  `'viewport'` instead evaluates `matchMedia('(max-width: <breakpoint>)')` for each of the two
   *  thresholds, which is inclusive (`<=`) — native `max-width` semantics, deliberately, so the
   *  crossing point matches a CSS `@media` rule authored with the same length exactly. Switching
   *  basis therefore shifts each crossing point by 1px (the same trade-off
   *  `orientationBreakpointBasis` already makes).
   *
   *  Use `'viewport'` to collapse in step with a page-level responsive layout — e.g. a shell whose
   *  own `@media` rules restack at the same width — rather than with this split's own allocation.
   *  `'viewport'` also lets the browser resolve a `rem` breakpoint with real `@media` semantics
   *  (against the *initial* font size, ignoring an `html { font-size }` override), keeping it in
   *  step with such a rule.
   *
   *  Both bands are classified from both queries together on every change, so a fast resize that
   *  crosses both thresholds at once still lands on one correct state and fires
   *  `lr-multi-split-collapse-change` once. Under `'viewport'` basis the first paint is already correct —
   *  no `ResizeObserver` round-trip — and the initial state is not announced as a transition.
   *
   *  Default: `'container'`. */
  @property({ reflect: true, attribute: 'collapse-breakpoint-basis' })
  collapseBreakpointBasis: BreakpointBasis = 'container';
  /** Whether the `'floating'` collapse state's drawer is shown. Only
   *  meaningful while `collapseState` is `'floating'` — the value is
   *  preserved (not reset) while another state is active, but no drawer
   *  chrome renders until `collapseState` is `'floating'` again. Defaults to
   *  `false`: the collapsing pane renders nothing while floating until a
   *  consumer opts in by setting this (or it's forced open programmatically)
   *  — see the class doc. */
  @property({ type: Boolean, reflect: true }) open = false;
  /** Overrides the auto-inserted divider's `aria-label` — receives the divider's 0-based index
   *  and the total panel count (`lr-multi-split` supports N panels, so a single fixed string can't
   *  express every divider's label; a function can). Unset (the default) keeps today's exact
   *  localized `Resize divider between panel {a} and panel {b}` template (see `this.localize()`). */
  @property({ attribute: false }) dividerLabel?: (
    index: number,
    panelCount: number
  ) => string;

  /** Internal hydration seed reflected into declarative output so a property-driven server render
   * and the browser's first reuse pass agree before assigned children can be observed. */
  @property({ type: Number, attribute: 'data-lr-panel-count', reflect: true })
  private panelCount = 0;
  private sizesReconciledForMembership = false;
  private _collapseState: LyraMultiSplitCollapseState = 'wide';
  // Whether ResizeObserver-driven measurement is currently ignored because a
  // consumer forced a specific collapseState -- see the accessor doc.
  private _forced = false;
  // Derived from collapseState === 'floating' && open -- tracked as its own
  // field (rather than recomputed inline everywhere) so willUpdate can detect
  // the specific false->true/true->false transition regardless of which of
  // the two source properties changed (mirrors lr-app-rail's
  // `overlayActive`).
  private overlayActive = false;
  private justOpened = false;
  private overlayHandle?: OverlayHandle;
  // Keyed by pointerId so an interrupted or concurrent (multi-touch) drag on
  // one divider never reads or clobbers another pointer's drag state.
  private drags = new Map<number, DragState>();
  private dragOwnerWindow?: Window;
  // Direct panels are an ordered ownership sequence, not merely a count. Each
  // snapshot preserves the latest author intent while the split temporarily
  // projects layout/collapse styles, so replacement, reordering, removal,
  // disconnect and adoption all release exact state instead of leaking the
  // last split-owned values into a reused node.
  private ownedPanels: HTMLElement[] = [];
  private readonly panelOwnership = new Map<
    HTMLElement,
    PanelOwnershipSnapshot
  >();
  private panelOwnershipObserver?: MutationObserver;
  private panelOwnershipObserverDocument?: Document;
  private panelOwnershipObserverGeneration = 0;
  private constraintIssueKey = '';
  private initializedSizes = false;
  private measuredInlineSize = Number.POSITIVE_INFINITY;
  private _effectiveOrientation: LyraOrientation = 'horizontal';
  @query('[part="base"]') private baseEl?: HTMLElement;
  private collapseResizeObserver?: ResizeObserver;
  private collapseObservedElement?: HTMLElement;
  private collapseObserverOwnerDocument?: Document;
  private collapseObserverGeneration = 0;
  /** Owns breakpoint resolution, basis selection, and the viewport `MediaQueryList` lifecycle
   *  (including teardown on disconnect) — see `OrientationBreakpointController`. */
  private orientationBreakpoints = new OrientationBreakpointController(
    this,
    () => this.updateEffectiveOrientation(this.measuredInlineSize, true)
  );
  /** Owns both collapse thresholds together, their basis, and the viewport `MediaQueryList`
   *  lifecycle — see `CollapseBreakpointController` for why the three-state classification can't
   *  be two independent single-threshold controllers. */
  private collapseBreakpoints = new CollapseBreakpointController(this, () =>
    this.updateCollapseState(this.measuredInlineSize, true)
  );

  override connectedCallback(): void {
    super.connectedCallback();
    // Seeds `measuredInlineSize` with a real reading of the host's own box, taken before the
    // very first render (and again on every reconnect) -- [part="base"] always spans the full
    // host inline-size (see multi-split.styles.ts's `inline-size: 100%`), so the host's own box is a
    // safe stand-in for it before that part even exists. Without this, `willUpdate()`'s
    // first-render classification would fall back to the `Number.POSITIVE_INFINITY` sentinel
    // ("wide"/"horizontal") and only correct itself once the ResizeObserver's own necessarily
    // async first callback lands -- a visible flash of the wrong layout under the default
    // 'container' basis (mirrors 'viewport' basis's already-synchronous correctness). The real
    // observer's own first callback still supersedes this approximation as soon as it fires.
    const hostWidth = this.getBoundingClientRect().width;
    if (hostWidth > 0) this.measuredInlineSize = hostWidth;
    this.seedFirstRenderState(() => this.syncPanelMembership(false));
    if (this.hasUpdated) this.syncPanelMembership(false);
    // Initialization waits for the first willUpdate() so property bindings committed later in
    // this same connection turn (notably defaultSizes/storageKey) participate in the
    // initialization-only precedence chain. Reconnects keep the already-live layout and only
    // reconcile it with the current panel count.
    if (this.initializedSizes) this.ensureSizes();
    // No-op on first mount (`baseEl` doesn't exist until the first render —
    // `firstUpdated()` below arms it then) but does the real work on a
    // reconnect, whose shadow DOM content survives disconnect. Mirrors
    // lite-chart.ts's identical connectedCallback/firstUpdated split for its
    // own ResizeObserver.
    if (this.responsiveObservationEnabled) this.armCollapseObserver();
    // A reconnect (e.g. a drag-and-drop reparent keeping this same element
    // instance) fires disconnectedCallback then connectedCallback
    // synchronously with no update in between, so willUpdate never reruns to
    // notice the floating drawer is still active -- restore its shared
    // registration and scroll lock. Mirrors lr-app-rail's identical
    // reconnect handling for its mobile overlay.
    if (this.hasUpdated && this.overlayActive) {
      if (this.overlayHandle?.isActive()) {
        this.overlayHandle.resume();
      } else {
        this.activateFloatingOverlay();
      }
      queueMicrotask(() => this.overlayHandle?.focusInitial());
    }
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    // Clean up any remaining event listeners from an in-flight drag.
    this.endDragGestures();
    this.resetCollapseObserver();
    this.overlayHandle?.suspend();
    this.releaseOwnedPanels();
  }

  override adoptedCallback(): void {
    super.adoptedCallback();
    this.endDragGestures();
    this.resetCollapseObserver();
    this.releaseOwnedPanels();
  }

  protected override firstUpdated(changed: PropertyValues): void {
    super.firstUpdated(changed);
    if (this.responsiveObservationEnabled) this.armCollapseObserver();
  }

  /** Both branches here derive one reactive property from another with no
   *  DOM measurement involved, so they belong in `willUpdate()` rather than
   *  `updated()`: setting a reactive property from `updated()`/
   *  `firstUpdated()` schedules a *second* update on top of the one that
   *  just finished, which Lit's dev-mode console flags ("scheduled an
   *  update ... after an update completed"). Both of these were real and
   *  reproducible in normal usage, not just test artifacts --
   *  `ensureSizes()` on any direct `sizes` assignment whose length doesn't
   *  match `panelCount` (e.g. a consumer correcting a stale layout), and the
   *  `collapseState` reset on every `collapse` -> `'none'` transition. The
   *  `collapse !== 'none'` re-arm path in `syncCollapseObserver()` still
   *  needs a freshly measured container width and stays in `updated()` --
   *  see `armCollapseObserver()`'s own doc comment for why *that* one is the
   *  documented exception instead (mirrors virtual-list.ts's
   *  `attachContainerListeners()`). */
  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed);
    if (!this.ownerDocument && this.panelCount === 0) {
      this.panelCount = Math.max(
        this.sizes.length,
        this.defaultSizes.length,
        this.panelConstraints.length
      );
    }
    if (!this.initializedSizes) {
      this.initializeSizes();
      this.initializedSizes = true;
    } else if (changed.has('sizes')) {
      const previous = changed.get('sizes');
      if (this.sizesReconciledForMembership) {
        this.sizesReconciledForMembership = false;
      } else if (!this.validLiveSizes(this.sizes)) {
        if (Array.isArray(previous) && this.validLiveSizes(previous)) {
          this.sizes = [...previous];
        } else {
          this.sizes = [];
          this.ensureSizes();
        }
      }
    } else if (this.sizes.length === 0) {
      this.ensureSizes();
    }
    if (
      changed.has('orientationBreakpoint') ||
      changed.has('orientationBreakpointBasis')
    ) {
      this.orientationBreakpoints.configure(
        this.orientationBreakpoint,
        this.orientationBreakpointBasis
      );
    }
    if (
      changed.has('orientation') ||
      changed.has('narrowOrientation') ||
      changed.has('orientationBreakpoint') ||
      changed.has('orientationBreakpointBasis')
    ) {
      // Under 'viewport' basis, `configure()` just above (re-)armed `matchMedia` synchronously,
      // so `isBelow()` here already reflects a live, authoritative read -- exactly the "fresh
      // measurement" condition that earns `shouldEmit: true` elsewhere (see this method's own
      // doc comment). Under 'container' basis there's no such fresh read here -- only a stale
      // `measuredInlineSize` snapshot -- so that case keeps deferring the emit to the
      // `ResizeObserver` callback's own fresh measurement, as before.
      //
      // `hasUpdated` additionally excludes the first render: Lit's initial `changed` map lists
      // every set property, so a viewport breakpoint that already matches at mount would
      // otherwise announce a transition that never happened. The initial axis is not a change.
      this.updateEffectiveOrientation(
        this.measuredInlineSize,
        this.hasUpdated && this.orientationBreakpointBasis === 'viewport'
      );
    }
    const collapseInputsChanged =
      changed.has('collapse') ||
      changed.has('railBreakpoint') ||
      changed.has('floatBreakpoint') ||
      changed.has('collapseBreakpointBasis');
    if (collapseInputsChanged) {
      const previousEffective = changed.has('collapse')
        ? this.effectiveCollapseStateFor(
            (changed.get('collapse') as
              | LyraMultiSplitCollapseMode
              | undefined) ?? 'none'
          )
        : this.collapseState;
      // Switching the logical collapsing pane while rail/floating is active
      // can move the disabled divider without changing collapseState itself.
      if (changed.has('collapse') && previousEffective !== 'wide') {
        this.endDragGestures();
      }
      this.collapseBreakpoints.configure(
        this.railBreakpoint,
        this.floatBreakpoint,
        this.collapseBreakpointBasis
      );
      // Classifying here, rather than waiting for the shared `ResizeObserver`'s first callback, is
      // what makes `data-collapse-state` correct on the *first paint* under viewport basis --
      // `configure()` just armed both queries synchronously, so `classify()` is already a live,
      // authoritative read (mirrors the orientation branch above). Under container basis this
      // re-maps `measuredInlineSize`, which `connectedCallback()` already seeded with a real
      // reading of the host's own box before this first render (see its own comment) -- so the
      // first paint is already correct here too, with no `ResizeObserver` round-trip needed; the
      // observer's own fresh callback still owns every subsequent transition.
      //
      // `hasUpdated` excludes the first render from the emit for the same reason the orientation
      // branch does: Lit's initial `changed` map lists every set property, so a viewport
      // breakpoint that already matches at mount would otherwise announce a transition that never
      // happened. The initial state is not a change.
      if (this.collapsingIndex !== -1 && !this._forced) {
        this._collapseState = this.collapseBreakpoints.classify(
          this.measuredInlineSize
        );
      }
      this.applyEffectiveCollapseTransition(
        previousEffective,
        this.collapseState,
        this.hasUpdated
      );
    }
    if (
      changed.has('open') ||
      changed.has('collapseState') ||
      changed.has('collapse') ||
      changed.has('panelCount')
    ) {
      const next = this.collapseState === 'floating' && this.open;
      if (next !== this.overlayActive) {
        this.overlayActive = next;
        if (next) {
          this.justOpened = true;
          this.activateFloatingOverlay();
        } else {
          this.deactivateFloatingOverlay();
        }
      }
    }
  }

  /**
   * The collapsing pane's effective responsive state. Always one of the three
   * real states — never `'auto'` — and always `'wide'` while collapse is
   * disabled or fewer than two panels exist. Otherwise it reflects either the
   * live measured width or, once forced, whatever was last assigned. See the
   * class doc for the full force/auto contract.
   */
  get collapseState(): LyraMultiSplitCollapseState {
    return this.effectiveCollapseStateFor(this.collapse);
  }
  set collapseState(next: LyraMultiSplitCollapseStateInput) {
    if (next === 'auto') {
      this._forced = false;
      this.updateCollapseState(this.currentMeasuredWidth());
      return;
    }
    this._forced = true;
    this.setRequestedCollapseState(next);
  }

  /** The live layout and resize axis after applying `orientationBreakpoint` — identical to
   *  `orientation` whenever `orientationBreakpoint` is unset (or set to something that doesn't
   *  resolve to a length). Also reflected as the `data-effective-orientation` host attribute (only
   *  present while `orientationBreakpoint` resolves, mirroring `data-collapse-state`'s
   *  only-present-while-active contract) so CSS can
   *  target the live axis directly instead of every consumer duplicating this fallback. */
  get effectiveOrientation(): LyraOrientation {
    return this._effectiveOrientation;
  }

  /** Whether the shared collapse/orientation `ResizeObserver` needs to be armed at all — true when
   *  either responsive feature (`collapse` or a *container-basis* `orientationBreakpoint`) is opted
   *  into, since both are driven off the same measured `[part="base"]` width (see
   *  `armCollapseObserver()`). A viewport-basis *orientation* breakpoint is driven by `matchMedia`
   *  instead and contributes no arming of its own.
   *
   *  `collapseBreakpointBasis="viewport"` deliberately does NOT drop the observer the way the
   *  orientation feature's viewport basis does: the measurement it feeds (`measuredInlineSize`) is
   *  still read by `updateEffectiveOrientation()` for a container-basis orientation breakpoint, and
   *  by the `collapseState = 'auto'` release path, which re-derives from the current measured
   *  width. Collapse's basis therefore changes only which values `classify()` consults, never
   *  whether the split measures itself. */
  private get responsiveObservationEnabled(): boolean {
    return (
      this.collapse !== 'none' ||
      this.orientationBreakpoints.containerObservationEnabled
    );
  }

  /** Classifies a measured inline size into the effective resize/layout axis and, only on an
   *  actual transition, applies it — mirrors `updateCollapseState()`'s shape. `shouldEmit` is
   *  true only when the caller is acting on a *fresh* read: the shared `ResizeObserver`
   *  callback's own fresh measurement (container basis), or the `willUpdate()` caller when basis
   *  is `'viewport'` (where `configure()` just re-armed `matchMedia` synchronously, so `isBelow()`
   *  is already live rather than a stale snapshot). It's false for the container-basis
   *  property-driven re-derivation in `willUpdate()`, which only re-maps the last known
   *  `measuredInlineSize` and defers the emit to the `ResizeObserver`'s next fresh callback.
   *  Matches `applyCollapseStateChange()`'s only-fire-on-a-real-transition contract for
   *  `lr-multi-split-orientation-change`. Safe to call `requestUpdate()` unconditionally here even from
   *  the mid-cycle `willUpdate()` path — see `willUpdate()`'s own doc comment for why that's the
   *  documented exception (unlike `updated()`/`firstUpdated()`, `willUpdate()` runs before Lit
   *  clears its pending-update flag, so this can't schedule a redundant second update). */
  private updateEffectiveOrientation(width: number, shouldEmit: boolean): void {
    const next: LyraOrientation = this.orientationBreakpoints.isBelow(width)
      ? this.narrowOrientation
      : this.orientation;
    if (next === this._effectiveOrientation) return;
    // A live gesture's start position is measured along the old axis. Keeping
    // it through this switch would reinterpret the same coordinates on the
    // new axis and resize the wrong panel extent.
    this.endDragGestures();
    this._effectiveOrientation = next;
    this.requestUpdate();
    if (shouldEmit) {
      this.emit('lr-multi-split-orientation-change', {
        orientation: next,
      });
    }
  }

  /** The container width (px) `[part="base"]` is measured at right now --
   *  used to re-derive `collapseState` immediately when a forced value is
   *  released back to `'auto'`, outside of the `ResizeObserver`'s own
   *  (async, entry-driven) callback. Mirrors the synchronous initial read
   *  `armCollapseObserver()` already does when it (re-)arms. */
  private currentMeasuredWidth(): number {
    return this.baseEl?.clientWidth ?? 0;
  }

  /** Resolves the consumer/observer-requested state through the feature's
   * actual availability. A forced rail/floating value can be remembered while
   * collapse is disabled, but the public/reflected/effectful state stays wide
   * until a real pane exists. */
  private effectiveCollapseStateFor(
    collapse: LyraMultiSplitCollapseMode
  ): LyraMultiSplitCollapseState {
    return collapse !== 'none' && this.panelCount >= 2
      ? this._collapseState
      : 'wide';
  }

  /** Applies the effects of an effective transition. Requested state and
   * effective state are deliberately separate so disabled forced writes never
   * create a backdrop, event, focus trap or scroll lock. */
  private applyEffectiveCollapseTransition(
    previous: LyraMultiSplitCollapseState,
    next: LyraMultiSplitCollapseState,
    shouldEmit = true
  ): void {
    if (previous === next) return;
    this.endDragGestures();
    this.requestUpdate('collapseState', previous);
    const forceClose = previous === 'floating' && next !== 'floating' && this.open;
    const forcedCloseVersion = this.forcedCloseVersion;
    if (shouldEmit) {
      this.emit('lr-multi-split-collapse-change', { state: next });
    }
    if (
      forceClose &&
      this.forcedCloseVersion === forcedCloseVersion &&
      this.collapseState !== 'floating'
    ) {
      this.setOpen(false, { force: true });
    }
  }

  private setOpen(next: boolean, options?: { force?: boolean }): void {
    if (options?.force) {
      this.open = next;
      this.forcedCloseVersion += 1;
      this.emit('lr-toggle', { open: next });
      return;
    }
    if (this.open === next) return;
    const collapseState = this.collapseState;
    const open = this.open;
    const mutationVersion = this.toggleProposalMutationVersion;
    this.toggleProposalDepth += 1;
    try {
      const event = this.emit('lr-toggle', { open: next }, { cancelable: true });
      if (
        event.defaultPrevented ||
        this.toggleProposalMutationVersion !== mutationVersion ||
        this.collapseState !== collapseState ||
        this.open !== open
      ) {
        return;
      }
    } finally {
      this.toggleProposalDepth -= 1;
    }
    this.open = next;
  }

  override requestUpdate(
    name?: PropertyKey,
    oldValue?: unknown,
    options?: PropertyDeclaration,
  ): void {
    if (
      this.toggleProposalDepth > 0 &&
      (
        (name === 'open' && oldValue !== this.open) ||
        (name === 'collapse' && oldValue !== this.collapse) ||
        (name === 'collapseState' && oldValue !== this.collapseState)
      )
    ) {
      this.toggleProposalMutationVersion += 1;
    }
    super.requestUpdate(name, oldValue, options);
  }

  private setRequestedCollapseState(
    next: LyraMultiSplitCollapseState,
    shouldEmit = true
  ): void {
    const previousEffective = this.collapseState;
    if (next === this._collapseState) return;
    this._collapseState = next;
    const nextEffective = this.collapseState;
    this.applyEffectiveCollapseTransition(
      previousEffective,
      nextEffective,
      shouldEmit
    );
    // Normalize a disabled `collapse-state` attribute back to the effective
    // `wide` value even though the effective property did not transition.
    if (previousEffective === nextEffective && next !== nextEffective) {
      this.requestUpdate('collapseState', next);
    }
  }

  private get storageFullKey(): string | undefined {
    return this.storageKey
      ? `lr-multi-split:${this.storageKey}:panels`
      : undefined;
  }

  /** Reads the domain identities for a complete panel sequence. A single missing, blank,
   *  whitespace-unstable, or duplicate
   *  value invalidates the whole identity model so persistence can never silently fall back to
   *  positional ownership. Retained identities are never rewritten. */
  private panelIdsFor(panels: readonly HTMLElement[]): string[] | null {
    const ids: string[] = [];
    const seen = new Set<string>();
    for (const panel of panels) {
      const panelId = panel.getAttribute('panel-id') ?? '';
      if (!panelId || panelId.trim() !== panelId || seen.has(panelId)) return null;
      seen.add(panelId);
      ids.push(panelId);
    }
    return ids;
  }

  /** Maps the live percentages from the previous ordered panel sequence onto the next sequence by
   *  `panelId`. Existing panels retain their relative proportions, new identities receive one
   *  equal-share slot, and removed identities release their share proportionally. */
  private reconcileIdentitySizes(
    previousIds: readonly string[],
    previousValues: readonly number[],
    nextIds: readonly string[]
  ): number[] | null {
    if (previousIds.length !== previousValues.length || nextIds.length === 0)
      return null;
    const previousSizes = new Map<string, number>();
    previousIds.forEach((panelId, index) => {
      previousSizes.set(panelId, previousValues[index]!);
    });
    const retainedTotal = nextIds.reduce(
      (total, panelId) => total + (previousSizes.get(panelId) ?? 0),
      0
    );
    const missingCount = nextIds.filter(
      (panelId) => !previousSizes.has(panelId)
    ).length;
    if (!(retainedTotal > 0)) {
      const equal = 100 / nextIds.length;
      return nextIds.map(() => equal);
    }

    const newShare = 100 / nextIds.length;
    const retainedTarget = 100 - newShare * missingCount;
    const retainedScale = retainedTarget / retainedTotal;
    return nextIds.map((panelId) => {
      const previous = previousSizes.get(panelId);
      return previous === undefined ? newShare : previous * retainedScale;
    });
  }

  private reconcileSizesByPanelId(
    previousPanels: readonly HTMLElement[],
    nextPanels: readonly HTMLElement[]
  ): number[] | null {
    if (previousPanels.length !== this.sizes.length || nextPanels.length === 0)
      return null;
    const previousIds = this.panelIdsFor(previousPanels);
    const nextIds = this.panelIdsFor(nextPanels);
    if (!previousIds || !nextIds) return null;
    return this.reconcileIdentitySizes(previousIds, this.sizes, nextIds);
  }

  private validInitialSizes(value: readonly number[]): boolean {
    if (!Array.isArray(value) || value.length !== this.panelCount) return false;
    if (!value.every((size) => Number.isFinite(size) && size >= this.safeMin))
      return false;
    return Math.abs(value.reduce((sum, size) => sum + size, 0) - 100) < 0.01;
  }

  /** Post-mount assignments use the feasible shared floor. A configured `min` can exceed the
   * aggregate available space, in which case interaction deliberately falls back to
   * `normalizedDefaultMin()` rather than freezing every divider. */
  private validLiveSizes(value: readonly number[]): boolean {
    if (!Array.isArray(value) || value.length !== this.panelCount) return false;
    const floor = this.normalizedDefaultMin();
    if (!value.every((size) => Number.isFinite(size) && size >= floor))
      return false;
    return Math.abs(value.reduce((sum, size) => sum + size, 0) - 100) < 0.01;
  }

  /** Resolves `defaultSizes` to a percent-space array for `initializeSizes()`, or `null` when it is
   *  empty/unusable. A **pure-number** array keeps strict behavior -- it is
   *  passed straight to `validInitialSizes()` with no normalization, so `[30, 60]` is still rejected.
   *  Only when at least one entry is a CSS length string are lengths resolved against the measured
   *  container (numbers as percent-of-container; strings through the shared contextual
   *  `resolveCssLength`) and then normalized to percentages. */
  private resolveDefaultSizes(): number[] | null {
    if (this.defaultSizes.length === 0) return null;
    const hasLengthString = this.defaultSizes.some(
      (entry) => typeof entry === 'string'
    );
    if (!hasLengthString) {
      const numbers = this.defaultSizes as number[];
      return this.validInitialSizes(numbers) ? [...numbers] : null;
    }
    // At least one CSS length string. `currentMeasuredWidth()` (baseEl) is 0 before the first render,
    // which is when `initializeSizes()` runs from `willUpdate()`; fall back to the host's own box --
    // [part="base"] is `inline-size: 100%` of the host, so they are equal (the same stand-in
    // `connectedCallback()` uses to seed `measuredInlineSize`).
    const containerSize =
      this.currentMeasuredWidth() || this.getBoundingClientRect().width;
    if (!(containerSize > 0)) return null;
    const resolvedPx: number[] = [];
    for (const entry of this.defaultSizes) {
      if (typeof entry === 'number') {
        if (!Number.isFinite(entry)) return null;
        resolvedPx.push((entry / 100) * containerSize); // a bare number is percent-of-container
        continue;
      }
      const px = resolveCssLength(entry, {
        host: this,
        percentBase: containerSize,
        viewportBasis: this.ownerDocument.defaultView ?? undefined,
      });
      if (px == null || !(px >= 0)) return null;
      resolvedPx.push(px);
    }
    const sum = resolvedPx.reduce((total, size) => total + size, 0);
    if (!(sum > 0)) return null;
    const normalized = resolvedPx.map((size) => (size / sum) * 100);
    return this.validInitialSizes(normalized) ? normalized : null;
  }

  private initializeSizes(): void {
    if (this.loadPersisted()) return;
    if (this.validInitialSizes(this.sizes)) return;
    const resolved = this.resolveDefaultSizes();
    if (resolved) {
      this.sizes = resolved;
      return;
    }
    this.sizes = [];
    this.ensureSizes();
  }

  private loadPersisted(): boolean {
    const panelIds = this.panelIdsFor(this.ownedPanels);
    if (!panelIds) return false;
    const parsed = readPersistedState(
      this.storageFullKey,
      isPersistedPanelLayout
    );
    if (!parsed || parsed.panels.length === 0) return false;
    const persistedIds: string[] = [];
    const persistedSizes: number[] = [];
    const seen = new Set<string>();
    for (const panel of parsed.panels) {
      if (seen.has(panel.panelId)) return false;
      seen.add(panel.panelId);
      persistedIds.push(panel.panelId);
      persistedSizes.push(panel.size);
    }
    if (
      Math.abs(persistedSizes.reduce((sum, size) => sum + size, 0) - 100) >=
      0.01
    )
      return false;
    const normalized = this.reconcileIdentitySizes(
      persistedIds,
      persistedSizes,
      panelIds
    );
    if (!normalized) return false;
    if (this.validInitialSizes(normalized)) {
      this.sizes = normalized;
      return true;
    }
    return false;
  }

  private persist(): void {
    const panelIds = this.panelIdsFor(this.ownedPanels);
    if (!panelIds || panelIds.length !== this.sizes.length) return;
    const layout: PersistedPanelLayout = {
      version: 1,
      panels: panelIds.map((panelId, index) => ({
        panelId,
        size: this.sizes[index]!,
      })),
    };
    writePersistedState(this.storageFullKey, layout);
  }

  private ensureSizes(): void {
    if (this.panelCount === this.sizes.length) return;
    if (this.panelCount <= 0) {
      this.sizes = [];
      return;
    }
    if (this.sizes.length === 0) {
      const equal = 100 / this.panelCount;
      this.sizes = Array.from({ length: this.panelCount }, () => equal);
      return;
    }
    // A panel was added or removed: rebalance the existing sizes
    // proportionally instead of discarding every panel's customized size,
    // so an unrelated panel-count change doesn't wipe the whole layout.
    const diff = this.panelCount - this.sizes.length;
    if (diff > 0) {
      const newShare = 100 / this.panelCount;
      const scale = (100 - newShare * diff) / 100;
      this.sizes = [
        ...this.sizes.map((s) => s * scale),
        ...Array.from({ length: diff }, () => newShare),
      ];
    } else {
      const kept = this.sizes.slice(0, this.panelCount);
      const removedTotal = this.sizes
        .slice(this.panelCount)
        .reduce((sum, s) => sum + s, 0);
      const keptTotal = kept.reduce((sum, s) => sum + s, 0) || 1;
      this.sizes = kept.map((s) => s + (s / keptTotal) * removedTotal);
    }
  }

  private readPanelStyle(
    panel: HTMLElement,
    property: OwnedPanelStyleProperty
  ): PanelStyleValue {
    return {
      value: panel.style.getPropertyValue(property),
      priority: panel.style.getPropertyPriority(property),
    };
  }

  private samePanelStyle(
    left: PanelStyleValue,
    right: PanelStyleValue
  ): boolean {
    return left.value === right.value && left.priority === right.priority;
  }

  private snapshotPanelOwnership(panel: HTMLElement): PanelOwnershipSnapshot {
    const styles = new Map<OwnedPanelStyleProperty, PanelStyleValue>();
    for (const property of OWNED_PANEL_STYLE_PROPERTIES) {
      styles.set(property, this.readPanelStyle(panel, property));
    }
    return {
      styles,
      appliedStyles: new Map(),
      hidden: panel.hidden,
      collapseState: panel.getAttribute('data-collapse-state'),
    };
  }

  /** Adopts author mutations made while a panel is owned before reasserting
   * the effective split projection. These latest values become the release
   * baseline, rather than the stale values from initial acquisition. */
  private adoptPanelOwnership(
    panel: HTMLElement,
    snapshot: PanelOwnershipSnapshot
  ): void {
    for (const property of OWNED_PANEL_STYLE_PROPERTIES) {
      const current = this.readPanelStyle(panel, property);
      const applied = snapshot.appliedStyles.get(property);
      if (
        (applied && !this.samePanelStyle(current, applied)) ||
        (!applied &&
          !this.samePanelStyle(current, snapshot.styles.get(property)!))
      ) {
        snapshot.styles.set(property, current);
      }
    }
    if (
      (snapshot.appliedHidden !== undefined &&
        panel.hidden !== snapshot.appliedHidden) ||
      (snapshot.appliedHidden === undefined && panel.hidden !== snapshot.hidden)
    ) {
      snapshot.hidden = panel.hidden;
    }
    const collapseState = panel.getAttribute('data-collapse-state');
    if (
      (snapshot.appliedCollapseState !== undefined &&
        collapseState !== snapshot.appliedCollapseState) ||
      (snapshot.appliedCollapseState === undefined &&
        collapseState !== snapshot.collapseState)
    ) {
      snapshot.collapseState = collapseState;
    }
  }

  private applyOwnedPanelStyle(
    panel: HTMLElement,
    snapshot: PanelOwnershipSnapshot,
    property: OwnedPanelStyleProperty,
    value: PanelStyleValue
  ): void {
    if (value.value === '') panel.style.removeProperty(property);
    else panel.style.setProperty(property, value.value, value.priority);
    snapshot.appliedStyles.set(property, this.readPanelStyle(panel, property));
  }

  private applyOwnedPanelStyleValue(
    panel: HTMLElement,
    snapshot: PanelOwnershipSnapshot,
    property: OwnedPanelStyleProperty,
    value: string
  ): void {
    this.applyOwnedPanelStyle(panel, snapshot, property, {
      value,
      priority: '',
    });
  }

  private applyOwnedPanelHidden(
    panel: HTMLElement,
    snapshot: PanelOwnershipSnapshot,
    hidden: HTMLElement['hidden']
  ): void {
    panel.hidden = hidden;
    snapshot.appliedHidden = panel.hidden;
  }

  private applyOwnedPanelCollapseState(
    panel: HTMLElement,
    snapshot: PanelOwnershipSnapshot,
    state: string | null
  ): void {
    if (state === null) panel.removeAttribute('data-collapse-state');
    else panel.setAttribute('data-collapse-state', state);
    snapshot.appliedCollapseState = panel.getAttribute('data-collapse-state');
  }

  private restorePanelOwnership(
    panel: HTMLElement,
    snapshot: PanelOwnershipSnapshot
  ): void {
    this.adoptPanelOwnership(panel, snapshot);
    for (const property of OWNED_PANEL_STYLE_PROPERTIES) {
      const value = snapshot.styles.get(property)!;
      if (value.value === '') panel.style.removeProperty(property);
      else panel.style.setProperty(property, value.value, value.priority);
    }
    panel.hidden = snapshot.hidden;
    if (snapshot.collapseState === null) {
      panel.removeAttribute('data-collapse-state');
    } else {
      panel.setAttribute('data-collapse-state', snapshot.collapseState);
    }
  }

  private panelProjectionDiverged(
    panel: HTMLElement,
    snapshot: PanelOwnershipSnapshot
  ): boolean {
    for (const property of OWNED_PANEL_STYLE_PROPERTIES) {
      const current = this.readPanelStyle(panel, property);
      const applied = snapshot.appliedStyles.get(property);
      const expected = applied ?? snapshot.styles.get(property)!;
      if (!this.samePanelStyle(current, expected)) return true;
    }
    if (panel.hidden !== (snapshot.appliedHidden ?? snapshot.hidden))
      return true;
    const expectedCollapseState =
      snapshot.appliedCollapseState !== undefined
        ? snapshot.appliedCollapseState
        : snapshot.collapseState;
    return panel.getAttribute('data-collapse-state') !== expectedCollapseState;
  }

  private resetPanelOwnershipObserver(): void {
    this.panelOwnershipObserverGeneration += 1;
    this.panelOwnershipObserver?.disconnect();
    this.panelOwnershipObserver = undefined;
    this.panelOwnershipObserverDocument = undefined;
  }

  private observeOwnedPanels(): void {
    this.resetPanelOwnershipObserver();
    const ownerDocument = this.ownerDocument;
    const MutationObserverConstructor =
      ownerDocument.defaultView?.MutationObserver;
    if (
      !MutationObserverConstructor ||
      !this.isConnected ||
      this.ownedPanels.length === 0
    ) {
      return;
    }
    const generation = this.panelOwnershipObserverGeneration;
    const observer = new MutationObserverConstructor((records) => {
      if (
        this.panelOwnershipObserver !== observer ||
        this.panelOwnershipObserverDocument !== this.ownerDocument ||
        this.panelOwnershipObserverGeneration !== generation ||
        !this.isConnected
      ) {
        return;
      }
      const changed = records.some((record) => {
        const panel = record.target as HTMLElement;
        const snapshot = this.panelOwnership.get(panel);
        return snapshot ? this.panelProjectionDiverged(panel, snapshot) : false;
      });
      if (changed) this.requestUpdate();
    });
    this.panelOwnershipObserver = observer;
    this.panelOwnershipObserverDocument = ownerDocument;
    for (const panel of this.ownedPanels) {
      observer.observe(panel, {
        attributes: true,
        attributeFilter: ['style', 'hidden', 'data-collapse-state'],
      });
    }
  }

  private samePanelSequence(next: readonly HTMLElement[]): boolean {
    return (
      next.length === this.ownedPanels.length &&
      next.every((panel, index) => panel === this.ownedPanels[index])
    );
  }

  private syncPanelMembership(reconcileSizes = true): void {
    const next = [...this.children] as HTMLElement[];
    if (this.samePanelSequence(next)) return;

    const previousPanels = this.ownedPanels;
    const identitySizes = reconcileSizes
      ? this.reconcileSizesByPanelId(previousPanels, next)
      : null;
    const previousEffective = this.collapseState;
    const nextSet = new Set(next);
    for (const panel of this.ownedPanels) {
      if (nextSet.has(panel)) continue;
      const snapshot = this.panelOwnership.get(panel);
      if (snapshot) this.restorePanelOwnership(panel, snapshot);
      this.panelOwnership.delete(panel);
    }
    for (const panel of next) {
      if (!this.panelOwnership.has(panel)) {
        this.panelOwnership.set(panel, this.snapshotPanelOwnership(panel));
      }
    }

    const countChanged = next.length !== this.panelCount;
    this.ownedPanels = next;
    this.panelCount = next.length;
    if (this.collapsingIndex !== -1 && !this._forced) {
      this._collapseState = this.collapseBreakpoints.classify(
        this.currentMeasuredWidth()
      );
    }
    this.applyEffectiveCollapseTransition(
      previousEffective,
      this.collapseState,
      this.hasUpdated
    );
    if (identitySizes) {
      this.sizesReconciledForMembership = true;
      this.sizes = identitySizes;
    } else if (countChanged && reconcileSizes) {
      this.sizesReconciledForMembership = true;
      this.ensureSizes();
    }
    this.observeOwnedPanels();
    if (this.hasUpdated) this.requestUpdate();
  }

  private releaseOwnedPanels(): void {
    this.resetPanelOwnershipObserver();
    for (const panel of this.ownedPanels) {
      const snapshot = this.panelOwnership.get(panel);
      if (snapshot) this.restorePanelOwnership(panel, snapshot);
    }
    this.ownedPanels = [];
    this.panelOwnership.clear();
  }

  private onSlotChange = (): void => {
    this.updateBrowserDerivedState(() => this.syncPanelMembership());
  };

  /** The container extent (px) along the resize axis, read live so a
   *  container resize between calls is always picked up — same live read
   *  `onPointerMove` already does via `drag.base.clientWidth/clientHeight`. */
  private getContainerSize(): number {
    if (!this.baseEl) return 0;
    return this.effectiveOrientation === 'vertical'
      ? this.baseEl.clientHeight
      : this.baseEl.clientWidth;
  }

  /** The physical panel index `collapse: 'start' | 'end'` resolves to, or
   *  `-1` when collapse is off (`'none'`) or there are fewer than 2 panels
   *  to collapse one of. Panels are laid out via ascending inline `order`
   *  (see `updated()`) and that ordering is never re-swapped for RTL — only
   *  the drag/keyboard *delta sign* mirrors for RTL, exactly like
   *  `onPointerMove`/`onDividerKeyDown` — so panel index 0 already renders
   *  at the logical inline-start edge under both LTR and RTL (confirmed by
   *  the pointer-drag RTL test elsewhere in this file: panel 0 renders on
   *  the visual *right*, i.e. the RTL inline-start side). `'start'` therefore
   *  always resolves to index 0 and `'end'` to `panelCount - 1`, regardless
   *  of `isRtl(this)` — consulting it here would swap collapse onto the
   *  panel that visually sits at the *other* logical edge, which would be a
   *  bug against this component's own RTL rendering, not a fix for one.
   */
  private get collapsingIndex(): number {
    if (this.collapse === 'none' || this.panelCount < 2) return -1;
    return this.collapse === 'start' ? 0 : this.panelCount - 1;
  }

  /** Whether a pane is actually collapsed (rail or floating) right now —
   *  `false` whenever `collapse === 'none'`, since `collapseState` then
   *  never leaves its `'wide'` default. */
  private get collapseActive(): boolean {
    return this.collapsingIndex !== -1 && this.collapseState !== 'wide';
  }

  /** Dragging/keyboard-resizing is disabled on the one divider immediately
   *  adjacent to the currently-collapsed pane (its other side has nothing
   *  meaningful to resize against while the pane is rail/floating-width). */
  private isDividerDisabled(index: number): boolean {
    if (!this.collapseActive) return false;
    const adjacent = this.collapsingIndex === 0 ? 0 : this.panelCount - 2;
    return index === adjacent;
  }

  /** Classifies the current width into the collapsing pane's responsive state and, only on an
   *  actual transition, applies it (via the same `applyCollapseStateChange()` the accessor's
   *  forced-value path uses). `width` is consulted only under `collapseBreakpointBasis =
   *  'container'`; the viewport basis reads its two media queries instead (see
   *  `CollapseBreakpointController`). Gated behind `_forced` so a pinned `collapseState` is never
   *  silently overwritten by a subsequent resize — this is also what the accessor's `'auto'`
   *  release calls (with the current measured width) to re-derive the state without duplicating
   *  the classification logic.
   *
   *  `shouldEmit` is false only for the very first render's viewport-basis classification, which
   *  establishes the starting state rather than transitioning to it — see `willUpdate()`. */
  private updateCollapseState(width: number, shouldEmit = true): void {
    if (this.collapse === 'none') return;
    if (this._forced) return;
    this.setRequestedCollapseState(
      this.collapseBreakpoints.classify(width),
      shouldEmit
    );
  }

  /** Creates (idempotently) and (re-)observes `[part="base"]` with the shared collapse-state/
   *  effective-orientation `ResizeObserver` — a no-op until `baseEl` exists (see
   *  `firstUpdated()`/`connectedCallback()`). One observer drives both responsive features off
   *  the same measurement (see `responsiveObservationEnabled()`) rather than each arming its own.
   *  The observer's first callback supplies the initial layout measurement; keeping the read
   *  there avoids mutating reactive state from `firstUpdated()`/`updated()`, which would create a
   *  redundant lifecycle update and a Lit warning. */
  private armCollapseObserver(): void {
    const observedElement = this.baseEl;
    if (!this.isConnected || !observedElement) return;
    const ownerDocument = this.ownerDocument;
    if (
      this.collapseResizeObserver &&
      this.collapseObservedElement === observedElement &&
      this.collapseObserverOwnerDocument === ownerDocument
    ) {
      return;
    }

    this.resetCollapseObserver();
    const ResizeObserverConstructor = ownerDocument.defaultView?.ResizeObserver;
    if (!ResizeObserverConstructor) return;
    const generation = this.collapseObserverGeneration;
    const observer = new ResizeObserverConstructor((entries) => {
      if (
        this.collapseResizeObserver !== observer ||
        this.collapseObserverGeneration !== generation ||
        !this.isConnected ||
        this.ownerDocument !== ownerDocument ||
        this.baseEl !== observedElement
      ) {
        return;
      }
      const box = entries[0]?.contentBoxSize?.[0];
      const width = box
        ? box.inlineSize
        : observedElement.getBoundingClientRect().width;
      this.measuredInlineSize = width;
      this.updateCollapseState(width);
      this.updateEffectiveOrientation(width, true);
    });
    this.collapseResizeObserver = observer;
    this.collapseObservedElement = observedElement;
    this.collapseObserverOwnerDocument = ownerDocument;
    observer.observe(observedElement);
  }

  private resetCollapseObserver(): void {
    this.collapseObserverGeneration += 1;
    this.collapseResizeObserver?.disconnect();
    this.collapseResizeObserver = undefined;
    this.collapseObservedElement = undefined;
    this.collapseObserverOwnerDocument = undefined;
  }

  /** Reacts to a live `collapse`/`orientationBreakpoint` property change (as opposed to the
   *  connect/first-render arming above): turns the shared observer on/off. The `collapseState`
   *  reset for the `'none'` case lives in `willUpdate()` instead (see its doc comment) so no
   *  stale rail/floating styling survives switching collapse off, without the extra render pass
   *  a property set here would cost. */
  private syncCollapseObserver(): void {
    if (!this.responsiveObservationEnabled) {
      this.resetCollapseObserver();
      return;
    }
    this.armCollapseObserver();
  }

  /** `min` normalized to a finite, non-negative percent floor before it reaches
   *  `normalizedDefaultMin()`/`resolveConstraintBounds()`'s clamp math or `loadPersisted()`'s
   *  validity check -- an invalid attribute value would otherwise poison every panel's percent
   *  bounds with `NaN` or a negative floor. */
  private get safeMin(): number {
    return finiteRange(this.min, 10, 0);
  }

  /** The safe fallback for a shared percent minimum. A value above the
   *  available share is still useful as a consumer intent, but it cannot be
   *  honored for every panel at once, so reduce it proportionally. */
  private normalizedDefaultMin(): number {
    if (this.panelCount <= 0) return 0;
    const requested = this.safeMin;
    // Leave one keyboard step of aggregate slack after rejecting an
    // infeasible configuration, so an equal starting layout remains
    // resizable instead of merely becoming a different frozen layout.
    const available = Math.max(0, 100 - KEYBOARD_STEP);
    return Math.min(requested, available / this.panelCount);
  }

  /** Resolves all panel bounds together so aggregate feasibility is checked
   *  before an individual divider is asked to clamp a pair. An invalid set is
   *  rejected as a whole: interaction uses the safe shared minimum instead of
   *  exposing a divider whose minimum is greater than its maximum. */
  private resolveConstraintBounds(containerSize: number): ConstraintResolution {
    const fallbackMin = this.normalizedDefaultMin();
    const fallback = Array.from({ length: this.panelCount }, () => ({
      min: fallbackMin,
      max: Infinity,
    }));
    if (this.panelCount <= 0) return { bounds: [], usePanelConstraints: true };

    const bounds: Array<{ min: number; max: number }> = [];
    let minimumTotal = 0;
    let maximumTotal = 0;
    let hasUnboundedMaximum = false;
    let issueReason: LyraMultiSplitConstraintIssueReason | undefined;

    for (let index = 0; index < this.panelCount; index++) {
      const constraint = this.panelConstraints[index];
      let min = this.safeMin;
      let max = Infinity;
      let minSet = false;
      let maxSet = false;
      if (constraint) {
        if (
          constraint.minPx != null &&
          Number.isFinite(constraint.minPx) &&
          constraint.minPx >= 0 &&
          containerSize > 0
        ) {
          min = (constraint.minPx / containerSize) * 100;
          minSet = true;
        }
        if (
          constraint.minPercent != null &&
          Number.isFinite(constraint.minPercent) &&
          constraint.minPercent >= 0
        ) {
          // The stricter (larger) of a px-derived and a directly-specified percent minimum —
          // px alone still simply overwrites the component-wide safeMin floor, matching the
          // pre-existing minPx-only behavior.
          min = minSet
            ? Math.max(min, constraint.minPercent)
            : constraint.minPercent;
          minSet = true;
        }
        if (
          constraint.maxPx != null &&
          Number.isFinite(constraint.maxPx) &&
          constraint.maxPx >= 0 &&
          containerSize > 0
        ) {
          max = (constraint.maxPx / containerSize) * 100;
          maxSet = true;
        }
        if (
          constraint.maxPercent != null &&
          Number.isFinite(constraint.maxPercent) &&
          constraint.maxPercent >= 0
        ) {
          // The stricter (smaller) of a px-derived and a directly-specified percent maximum.
          max = maxSet
            ? Math.min(max, constraint.maxPercent)
            : constraint.maxPercent;
          maxSet = true;
        }
        if (
          (constraint.minPx != null &&
            (!Number.isFinite(constraint.minPx) || constraint.minPx < 0)) ||
          (constraint.maxPx != null &&
            (!Number.isFinite(constraint.maxPx) || constraint.maxPx < 0)) ||
          (constraint.minPercent != null &&
            (!Number.isFinite(constraint.minPercent) ||
              constraint.minPercent < 0)) ||
          (constraint.maxPercent != null &&
            (!Number.isFinite(constraint.maxPercent) ||
              constraint.maxPercent < 0))
        ) {
          issueReason ??= 'minimum-exceeds-maximum';
        }
      }
      if (min > max) issueReason ??= 'minimum-exceeds-maximum';
      bounds.push({ min, max });
      minimumTotal += min;
      if (Number.isFinite(max)) maximumTotal += max;
      else hasUnboundedMaximum = true;
    }

    if (issueReason == null && minimumTotal > 100 + 1e-9)
      issueReason = 'minimum-total';
    if (
      issueReason == null &&
      !hasUnboundedMaximum &&
      maximumTotal < 100 - 1e-9
    )
      issueReason = 'maximum-total';
    if (issueReason == null) return { bounds, usePanelConstraints: true };

    return {
      bounds: fallback,
      usePanelConstraints: false,
      issue: {
        reason: issueReason,
        panelCount: this.panelCount,
        minimumTotal,
        maximumTotal: hasUnboundedMaximum ? null : maximumTotal,
        containerSize,
      },
    };
  }

  private percentBounds(
    index: number,
    containerSize: number
  ): { min: number; max: number } {
    return (
      this.resolveConstraintBounds(containerSize).bounds[index] ?? {
        min: 0,
        max: Infinity,
      }
    );
  }

  /** Whether a panel's constraint needs the clamp()-based flex-basis branch at all (as opposed to
   *  the plain bare-percent branch) — true whenever any px or percent bound is set. */
  private hasClampConstraint(
    constraint: LyraMultiSplitPanelConstraint | null | undefined
  ): boolean {
    return (
      !!constraint &&
      (constraint.minPx != null ||
        constraint.maxPx != null ||
        constraint.minPercent != null ||
        constraint.maxPercent != null)
    );
  }

  /** Builds the min side of a constrained panel's CSS `clamp()` flex-basis. A single specified
   *  bound (either unit) is used bare, preserving the exact pre-existing px-only shape; combining
   *  two different unit types needs a native CSS `max()` so the browser keeps picking the stricter
   *  (larger) bound after a container resize with no extra JS — the component's own percent-based
   *  `min` floor is folded in as an always-present third term in that combined case only, since a
   *  single bare bound already fully replaces it (mirrors `resolveConstraintBounds()`'s equivalent
   *  overwrite-vs-combine split for the JS-side percent bounds). */
  private minSideExpr(
    constraint: LyraMultiSplitPanelConstraint | null | undefined
  ): string {
    const terms: string[] = [];
    if (
      constraint?.minPx != null &&
      Number.isFinite(constraint.minPx) &&
      constraint.minPx >= 0
    ) {
      terms.push(`${constraint.minPx}px`);
    }
    if (
      constraint?.minPercent != null &&
      Number.isFinite(constraint.minPercent) &&
      constraint.minPercent >= 0
    ) {
      terms.push(`${constraint.minPercent}%`);
    }
    if (terms.length === 0) return `${NO_MIN_PX}px`;
    if (terms.length === 1) return terms[0]!; // safe: exactly one term
    return `max(${this.safeMin}%, ${terms.join(', ')})`;
  }

  /** The max-side mirror of `minSideExpr()` — uses CSS `min()` (stricter = smaller) when combining
   *  both unit types; no equivalent shared floor exists to fold in for the max side. */
  private maxSideExpr(
    constraint: LyraMultiSplitPanelConstraint | null | undefined
  ): string {
    const terms: string[] = [];
    if (
      constraint?.maxPx != null &&
      Number.isFinite(constraint.maxPx) &&
      constraint.maxPx >= 0
    ) {
      terms.push(`${constraint.maxPx}px`);
    }
    if (
      constraint?.maxPercent != null &&
      Number.isFinite(constraint.maxPercent) &&
      constraint.maxPercent >= 0
    ) {
      terms.push(`${constraint.maxPercent}%`);
    }
    if (terms.length === 0) return `${NO_MAX_PX}px`;
    if (terms.length === 1) return terms[0]!; // safe: exactly one term
    return `min(${terms.join(', ')})`;
  }

  private clampPair(
    sizes: readonly number[],
    i: number,
    delta: number,
    containerSize = 0
  ): number[] {
    const next = [...sizes];
    const currentA = next[i];
    const currentB = next[i + 1];
    if (currentA === undefined || currentB === undefined) return next;
    const pairTotal = currentA + currentB;
    const a = this.percentBounds(i, containerSize);
    const b = this.percentBounds(i + 1, containerSize);
    // Panel i's own bounds, further narrowed by panel i+1's bounds (its
    // partner's min/max caps how much i can grow/shrink within the pair).
    const loRaw = Math.max(a.min, pairTotal - b.max);
    const hiRaw = Math.min(a.max, pairTotal - b.min);
    // Clamp *toward* the bound instead of rejecting the whole move when the
    // result is still outside it — otherwise a pair that starts under its
    // combined min (e.g. an equal split across many panels) can never be
    // moved at all, since every step recomputes the same rejected delta from
    // the same untouched starting sizes.
    const lo = Math.min(loRaw, pairTotal);
    const hi = Math.max(hiRaw, lo);
    const clampedA = Math.min(Math.max(currentA + delta, lo), hi);
    next[i] = clampedA;
    next[i + 1] = pairTotal - clampedA;
    return next;
  }

  /** Emits the cancelable user-interaction proposal before committing it. The
   *  existing `lr-resize` notification remains the non-cancelable post-commit
   *  signal, so property-driven layouts stay silent while hosts can veto an
   *  interaction before it changes their persistence-facing state. */
  private requestResize(next: number[], commit: boolean): boolean {
    if (
      next.length === this.sizes.length &&
      next.every((size, index) => Math.abs(size - this.sizes[index]!) <= 1e-9)
    ) {
      return false;
    }
    const request = this.emit(
      'lr-resize-request',
      { sizes: [...next] },
      { cancelable: true }
    );
    if (request.defaultPrevented) return false;
    this.sizes = next;
    this.emit('lr-resize', { sizes: [...this.sizes] });
    if (commit) this.persist();
    return true;
  }

  private applyDelta(index: number, delta: number, commit: boolean): boolean {
    const next = this.clampPair(
      this.sizes,
      index,
      delta,
      this.getContainerSize()
    );
    const changed =
      next.length !== this.sizes.length ||
      next.some(
        (size, currentIndex) =>
          Math.abs(size - this.sizes[currentIndex]!) > 1e-9
      );
    if (!changed) return false;
    this.requestResize(next, commit);
    return true;
  }

  /** The collapsing pane's light-DOM element itself — the `'floating'`
   *  drawer's focus-trap/backdrop target. There's no separate shadow-DOM
   *  panel to trap focus within (unlike `<lr-app-rail>`'s `[part="panel"]`):
   *  the slotted panel *is* the floating drawer, just repositioned via
   *  inline styles in `updated()`. */
  private get floatingPanelEl(): HTMLElement | null {
    const index = this.collapsingIndex;
    return index === -1 ? null : this.ownedPanels[index] ?? null;
  }

  private activateFloatingOverlay(): void {
    this.overlayHandle = activateOverlay({
      host: this,
      panel: () => this.floatingPanelEl,
      modalRoot: () => this.floatingPanelEl,
      onEscape: () => this.setOpen(false),
      onBackdrop: () => this.setOpen(false),
      lockScroll: true,
      suspendWhenUnrendered: true,
    });
  }

  private deactivateFloatingOverlay(): void {
    this.overlayHandle?.deactivate();
    this.overlayHandle = undefined;
  }

  private onBackdropClick = (): void => {
    this.overlayHandle?.dismissBackdrop();
  };

  /** Native pointer input retargets from an inert scrim to the allowed base-path ancestor. */
  private onModalLayerClick = (event: MouseEvent): void => {
    if (event.target === this.baseEl) this.overlayHandle?.dismissBackdrop();
  };

  private onPointerDown = (e: PointerEvent, index: number): void => {
    // The divider adjacent to a currently rail/floating-collapsed pane isn't
    // draggable — mirrors the `[part="divider"][aria-disabled="true"]`
    // `pointer-events: none` in multi-split.styles.ts (belt-and-suspenders: this
    // guard also covers a synthetic/programmatic pointerdown that CSS
    // wouldn't stop).
    if (e.button !== 0 || this.isDividerDisabled(index)) return;
    const divider = e.currentTarget as HTMLElement;
    const ownerWindow = divider.ownerDocument.defaultView;
    if (!ownerWindow) return;
    if (this.drags.size > 0 && this.dragOwnerWindow !== ownerWindow) return;
    // The divider that dispatched this is itself a child of [part="base"],
    // so baseEl is guaranteed to be already rendered here.
    this.drags.set(e.pointerId, {
      index,
      startPos:
        this.effectiveOrientation === 'vertical' ? e.clientY : e.clientX,
      base: this.baseEl!,
      appliedDelta: 0,
      acceptedResize: false,
    });
    divider.setPointerCapture(e.pointerId);
    if (this.drags.size === 1) {
      this.dragOwnerWindow = ownerWindow;
      ownerWindow.addEventListener('pointermove', this.onPointerMove);
      ownerWindow.addEventListener('pointerup', this.onPointerUp);
      // A drag can end without a pointerup: a system gesture / palm rejection
      // can fire `pointercancel`, and losing capture (e.g. element removed)
      // fires `lostpointercapture` — both need the same teardown as pointerup
      // or the divider keeps "resizing" in response to unrelated movement.
      ownerWindow.addEventListener('pointercancel', this.onPointerUp);
      ownerWindow.addEventListener('lostpointercapture', this.onPointerUp);
    }
  };

  private onPointerMove = (e: PointerEvent): void => {
    const drag = this.drags.get(e.pointerId);
    if (!drag) return;
    // Collapse state can change after pointerdown (including a forced public
    // assignment), so the initial eligibility check alone is not sufficient.
    if (this.isDividerDisabled(drag.index)) {
      this.endDragGestures();
      return;
    }
    const total =
      this.effectiveOrientation === 'vertical'
        ? drag.base.clientHeight
        : drag.base.clientWidth;
    if (!Number.isFinite(total) || total <= 0) {
      this.endDragGestures();
      return;
    }
    const pos =
      this.effectiveOrientation === 'vertical' ? e.clientY : e.clientX;
    let cumulativeDelta = ((pos - drag.startPos) / total) * 100;
    // Panels are ordered along the inline axis via CSS `order`, so under RTL
    // `flex-direction: row` already renders panel[i] to the *right* of
    // panel[i+1] — a physically-rightward drag has to shrink index instead
    // of growing it to keep matching the visible panel under the pointer.
    if (this.effectiveOrientation === 'horizontal' && isRtl(this))
      cumulativeDelta = -cumulativeDelta;
    // Clamp against the *current* live sizes, not this pointer's own drag-start
    // snapshot -- two adjacent dividers dragged concurrently share one panel
    // between them, and each clamp pass must see whatever the other pointer's
    // move has *just* written, or the two independently-clamped pairs can each
    // stay individually valid while their shared panel drifts past what either
    // pair alone would allow, letting the total exceed 100%. Since the clamp
    // basis is now the live, already-partially-applied `this.sizes` instead of
    // a fixed drag-start snapshot, only the *incremental* delta since the last
    // move may be applied here (not the cumulative-since-drag-start delta a
    // snapshot-based clamp would use).
    const incremental = cumulativeDelta - drag.appliedDelta;
    const priorValue = this.sizes[drag.index];
    if (priorValue === undefined) return;
    const paired = this.clampPair(this.sizes, drag.index, incremental, total);
    const pairedA = paired[drag.index];
    const pairedB = paired[drag.index + 1];
    if (pairedA === undefined || pairedB === undefined) return;
    // Accumulate this move's own *realized* increment (post-clamp) onto the
    // running total, rather than recomputing an absolute "total since
    // drag-start" diff against a fixed startSizes snapshot. clampPair can
    // cap the actual move short of what was requested (e.g. a drag
    // saturating a panel's min/panelConstraints bound), so the realized
    // portion still has to be tracked instead of the raw request. An
    // absolute since-start diff also silently absorbs any change a different
    // concurrent pointer's drag makes to this same shared panel between this
    // pointer's own moves (adjacent dividers share one panel: divider i's
    // index+1 panel is divider i+1's index panel), corrupting this pointer's
    // next incremental calculation. Summing only this move's own delta
    // (paired vs. the value immediately prior to this clamp) avoids both
    // bugs at once.
    // Merge only this drag's pair into the live sizes so a concurrent drag
    // on another divider (different pointerId) isn't clobbered.
    const next = [...this.sizes];
    next[drag.index] = pairedA;
    next[drag.index + 1] = pairedB;
    if (!this.requestResize(next, false)) return;
    drag.appliedDelta += pairedA - priorValue;
    drag.acceptedResize = true;
  };

  private onPointerUp = (e: PointerEvent): void => {
    const drag = this.drags.get(e.pointerId);
    if (!drag) return;
    this.drags.delete(e.pointerId);
    if (e.type === 'pointerup' && drag.acceptedResize) this.persist();
    if (this.drags.size === 0) this.removeDragListeners();
  };

  private removeDragListeners(): void {
    const ownerWindow = this.dragOwnerWindow;
    this.dragOwnerWindow = undefined;
    ownerWindow?.removeEventListener('pointermove', this.onPointerMove);
    ownerWindow?.removeEventListener('pointerup', this.onPointerUp);
    ownerWindow?.removeEventListener('pointercancel', this.onPointerUp);
    ownerWindow?.removeEventListener('lostpointercapture', this.onPointerUp);
  }

  private endDragGestures(): void {
    this.drags.clear();
    this.removeDragListeners();
  }

  private onDividerKeyDown = (e: KeyboardEvent, index: number): void => {
    // Same rail/floating-adjacent guard as onPointerDown.
    if (this.isDividerDisabled(index)) return;
    // Mirror the same swap as onPointerMove for horizontal+RTL.
    const rtl = this.effectiveOrientation === 'horizontal' && isRtl(this);
    const forwardKey =
      this.effectiveOrientation === 'vertical'
        ? 'ArrowDown'
        : rtl
        ? 'ArrowLeft'
        : 'ArrowRight';
    const backwardKey =
      this.effectiveOrientation === 'vertical'
        ? 'ArrowUp'
        : rtl
        ? 'ArrowRight'
        : 'ArrowLeft';
    if (e.key === 'Home' || e.key === 'End') {
      const { min, max } = this.dividerValueRange(index);
      const current = this.sizes[index];
      if (current !== undefined) {
        const target = e.key === 'Home' ? min : max;
        if (this.applyDelta(index, target - current, true)) e.preventDefault();
      }
    } else if (e.key === forwardKey) {
      if (this.applyDelta(index, KEYBOARD_STEP, true)) e.preventDefault();
    } else if (e.key === backwardKey) {
      if (this.applyDelta(index, -KEYBOARD_STEP, true)) e.preventDefault();
    }
  };

  private dividerValueRange(
    index: number,
    bounds: ConstraintResolution['bounds'] = this.resolveConstraintBounds(
      this.getContainerSize()
    ).bounds
  ): { min: number; max: number } {
    const pairTotal = (this.sizes[index] ?? 0) + (this.sizes[index + 1] ?? 0);
    const leading = bounds[index]!;
    const trailing = bounds[index + 1]!;
    const min = Math.max(leading.min, pairTotal - trailing.max);
    return {
      min,
      max: Math.max(min, Math.min(leading.max, pairTotal - trailing.min)),
    };
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    if (
      changed.has('collapse') ||
      changed.has('orientationBreakpoint') ||
      changed.has('orientationBreakpointBasis')
    ) {
      this.syncCollapseObserver();
    }
    // Host-level marker for external CSS targeting of the live resize/layout axis (mirrors
    // `data-collapse-state` below) -- only present while the feature is actually opted into,
    // same only-while-active contract. Gated on `active` (not `resolvedOrientationBreakpoint`)
    // so a viewport-basis breakpoint still publishes the marker even though `resolved` is
    // meaningless there -- see OrientationBreakpointController's class doc.
    if (this.orientationBreakpoints.active) {
      this.setAttribute(
        'data-effective-orientation',
        this._effectiveOrientation
      );
    } else {
      this.removeAttribute('data-effective-orientation');
    }
    const constraintResolution = this.resolveConstraintBounds(
      this.getContainerSize()
    );
    const issue = constraintResolution.issue;
    const issueKey = issue
      ? `${issue.reason}:${issue.panelCount}:${issue.minimumTotal}:${
          issue.maximumTotal ?? 'unbounded'
        }`
      : '';
    if (issueKey !== this.constraintIssueKey) {
      this.constraintIssueKey = issueKey;
      if (issue) this.emit('lr-multi-split-constraints-invalid', issue);
    }
    const panels = this.ownedPanels;
    for (const panel of panels) {
      const snapshot = this.panelOwnership.get(panel);
      if (snapshot) this.adoptPanelOwnership(panel, snapshot);
    }
    // Resolved once per pass rather than per panel: which physical index (if
    // any) is actually collapsed right now — `-1` covers both `collapse ===
    // 'none'` (the default) and a `collapse !== 'none'` pane that's still in
    // its normal `'wide'` state, so every panel below falls straight through
    // to the exact pre-existing (non-collapse) styling in either case.
    const collapsingIndex = this.collapseActive ? this.collapsingIndex : -1;
    // Percent-space bounds are already known before layout: resolveConstraintBounds()
    // above converted each panel's minPx/maxPx into a percent range using this same
    // containerSize. Clamp each panel's raw sizes[i] against its own bounds to find how
    // much of its basis a constrained panel's CSS clamp() will take away this render,
    // then hand that freed percentage to sibling panels with no active pixel constraint
    // of their own, proportional to their own sizes share -- mirrors the collapsed
    // branch's `flex: ${percent} 1 0%` grow-by-own-share pattern a few lines below.
    // Skipped while a panel is collapsing (that branch redistributes its own freed
    // space differently), and only handles a panel clamped *down* below its raw share --
    // a panel clamped *up* (raw share under its own minPx) is left as today, since
    // handling that symmetrically would mean *shrinking* other panels below their own
    // bounds, a different, unfiled problem.
    const redistributedShare = new Array<number>(panels.length).fill(0);
    if (collapsingIndex === -1) {
      let freedPercent = 0;
      const growableIndexes: number[] = [];
      let growableTotal = 0;
      for (let i = 0; i < panels.length; i++) {
        const percent = this.sizes[i] ?? 0;
        const constraint = constraintResolution.usePanelConstraints
          ? this.panelConstraints[i]
          : undefined;
        if (this.hasClampConstraint(constraint)) {
          const bounds = constraintResolution.bounds[i];
          const clamped = bounds
            ? Math.min(Math.max(percent, bounds.min), bounds.max)
            : percent;
          if (clamped < percent) freedPercent += percent - clamped;
        } else {
          growableIndexes.push(i);
          growableTotal += percent;
        }
      }
      if (freedPercent > 0 && growableTotal > 0) {
        for (const i of growableIndexes) {
          redistributedShare[i] =
            freedPercent * ((this.sizes[i] ?? 0) / growableTotal);
        }
      }
    }
    panels.forEach((panel, i) => {
      const snapshot = this.panelOwnership.get(panel);
      if (!snapshot) return;
      const percent = this.sizes[i] ?? 0;
      const constraint = constraintResolution.usePanelConstraints
        ? this.panelConstraints[i]
        : undefined;
      // Collapse-only inline style is always cleared first, then re-applied
      // below only for the panel that needs it this pass. `position`/`inset-*`
      // no longer go through this owned-inline path at all — see
      // multi-split.styles.ts's `::slotted([data-collapse-state='floating'])`
      // rule, which owns their (always-fixed) floating-state value instead.
      this.applyOwnedPanelStyle(
        panel,
        snapshot,
        'inline-size',
        snapshot.styles.get('inline-size')!
      );
      this.applyOwnedPanelHidden(panel, snapshot, snapshot.hidden);

      if (collapsingIndex === i && this.collapseState === 'rail') {
        // Fixed rail width instead of the normal clamp()/percent flex-basis.
        this.applyOwnedPanelStyleValue(
          panel,
          snapshot,
          'flex',
          `0 0 ${this.railWidth}`
        );
      } else if (
        collapsingIndex === i &&
        this.collapseState === 'floating' &&
        !this.open
      ) {
        // Hidden-by-default drawer (see the class doc): rendering nothing
        // (not just visually collapsed, so it's out of the accessibility
        // tree too) until a consumer sets `open`. The pane still vacates the
        // flex flow the same way the open/floating branch below does, via
        // `hidden`'s UA `display: none` rather than `position: absolute`, so
        // the other pane below still grows to fill the space regardless of
        // which of the two branches applied.
        this.applyOwnedPanelStyleValue(panel, snapshot, 'flex', 'none');
        this.applyOwnedPanelHidden(panel, snapshot, true);
      } else if (collapsingIndex === i && this.collapseState === 'floating') {
        // `this.open` is true here. Lifted out of the flex flow entirely as
        // an overlay card, anchored to its own logical start/end edge,
        // spanning the full cross-axis extent — [part="base"] carries
        // `position: relative` for this to anchor against, and
        // multi-split.styles.ts's `::slotted([data-collapse-state='floating'])`
        // rule (keyed off `collapse`, already reflected onto the host) owns
        // `position`/`inset-block`/the edge inset as ordinary, overridable CSS.
        // Sized here at its own normal percent width (i.e. what it would render
        // at in the `'wide'` state), so there's no visual size jump the moment
        // it un-floats — this one stays inline since it's genuinely live,
        // synced to the same draggable `sizes[i]` the `'wide'` state uses.
        this.applyOwnedPanelStyleValue(panel, snapshot, 'flex', 'none');
        this.applyOwnedPanelStyleValue(
          panel,
          snapshot,
          'inline-size',
          `${percent}%`
        );
      } else if (collapsingIndex !== -1 && i !== collapsingIndex) {
        // The pane(s) sharing the split with a currently rail/floating
        // collapsed pane: grow to fill whatever space that pane no longer
        // occupies (its full percent-basis space while floating, or
        // percent-basis-minus-railWidth while railed), proportionally to
        // their own relative `sizes` share for a 3+-panel split -- but still
        // honor this panel's own panelConstraints via the same clamp()
        // flex-basis the uncollapsed branch below uses, so a constrained
        // sibling doesn't grow past its own maxPx (or below its own minPx)
        // just because an adjacent pane collapsed.
        this.applyOwnedPanelStyleValue(
          panel,
          snapshot,
          'flex',
          this.hasClampConstraint(constraint)
            ? `0 1 clamp(${this.minSideExpr(
                constraint
              )}, ${percent}%, ${this.maxSideExpr(constraint)})`
            : `${percent} 1 0%`
        );
      } else {
        // clamp() mixes units natively, so a constrained panel stays pinned
        // between its px bounds across container resizes with no extra
        // ResizeObserver -- the browser re-evaluates it on every layout pass.
        // flex-shrink: 1 (not 0) lets the row's panels absorb the auto-inserted
        // dividers' own combined width instead of the row's total content width
        // overflowing the container by (panelCount - 1) * dividerWidth, which
        // flex-shrink: 0 previously could not.
        //
        // An unconstrained panel's basis also folds in any space freed by a
        // clamped sibling this render (see redistributedShare above); a
        // constrained panel's own clamp() is untouched by that, since it's
        // never itself a redistribution target.
        const adjustedPercent = percent + (redistributedShare[i] ?? 0);
        this.applyOwnedPanelStyleValue(
          panel,
          snapshot,
          'flex',
          this.hasClampConstraint(constraint)
            ? `0 1 clamp(${this.minSideExpr(
                constraint
              )}, ${percent}%, ${this.maxSideExpr(constraint)})`
            : `0 1 ${adjustedPercent}%`
        );
      }
      this.applyOwnedPanelStyleValue(panel, snapshot, 'order', String(i * 2));

      if (collapsingIndex === i) {
        this.applyOwnedPanelCollapseState(panel, snapshot, this.collapseState);
      } else {
        this.applyOwnedPanelCollapseState(panel, snapshot, null);
      }
    });

    // Host-level marker (mirrors the per-panel `dataset.collapseState`
    // above) for simple external CSS targeting of the whole component's
    // current state, e.g. `lr-multi-split[data-collapse-state="rail"] + aside`.
    // Absent whenever there's nothing collapsed to report (`collapse ===
    // 'none'` or still `'wide'`), same as the per-panel marker.
    if (collapsingIndex !== -1) {
      this.setAttribute('data-collapse-state', this.collapseState);
    } else {
      this.removeAttribute('data-collapse-state');
    }

    // Runs after this render (not willUpdate) so the floating panel's
    // repositioned geometry above has already landed before the focus call
    // below can rely on it -- mirrors lr-app-rail's/lr-dialog's identical
    // ordering rationale for their own overlay's initial focus.
    if (this.justOpened) {
      this.justOpened = false;
      this.overlayHandle?.focusInitial();
    }
  }

  override render(): TemplateResult {
    const dividers: TemplateResult[] = [];
    const bounds = this.resolveConstraintBounds(this.getContainerSize()).bounds;
    for (let i = 0; i < this.panelCount - 1; i++) {
      // The achievable range is bounded by both adjacent panels, not the
      // whole track — pushing past it would starve the partner even though
      // this pair still has room. Keep max >= min for imperfect persisted or
      // consumer-supplied starting sizes.
      const { min: valueMin, max: valueMax } = this.dividerValueRange(
        i,
        bounds
      );
      const disabled = this.isDividerDisabled(i);
      dividers.push(html`<div
        part="divider"
        role="separator"
        aria-label=${this.dividerLabel
          ? this.dividerLabel(i, this.panelCount)
          : this.localize('resizeDivider', undefined, {
              a: getNumberFormat(this.effectiveLocale).format(i + 1),
              b: getNumberFormat(this.effectiveLocale).format(i + 2),
            })}
        aria-orientation=${this.effectiveOrientation === 'vertical'
          ? 'horizontal'
          : 'vertical'}
        aria-valuenow=${Math.round(this.sizes[i] ?? 0)}
        aria-valuetext=${this.localize('resizeValuePercent', undefined, {
          value: getNumberFormat(this.effectiveLocale).format(
            Math.round(this.sizes[i] ?? 0),
          ),
        })}
        aria-valuemin=${Math.round(valueMin)}
        aria-valuemax=${Math.round(valueMax)}
        aria-disabled=${disabled ? 'true' : 'false'}
        tabindex=${disabled ? '-1' : '0'}
        style=${`order:${i * 2 + 1}`}
        @pointerdown=${(e: PointerEvent) => this.onPointerDown(e, i)}
        @keydown=${(e: KeyboardEvent) => this.onDividerKeyDown(e, i)}
      ></div>`);
    }
    const showBackdrop = this.collapseState === 'floating' && this.open;
    return html`<div part="base" @click=${this.onModalLayerClick}>
      <slot @slotchange=${this.onSlotChange}></slot>
      ${dividers}
      ${showBackdrop
        ? html`<div part="backdrop" @click=${this.onBackdropClick}></div>`
        : nothing}
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-multi-split': LyraMultiSplit;
  }
}
