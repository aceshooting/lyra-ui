import type { ReactiveController, ReactiveControllerHost } from 'lit';
import { resolveCssLength } from './css-length.js';

/**
 * Which box a responsive breakpoint is compared against — the component's own measured allocation
 * (`'container'`, a `ResizeObserver`) or the viewport (`'viewport'`, a `matchMedia` query).
 *
 * This types the public `orientationBreakpointBasis` property on `<lr-split>` and `<lr-stepper>`
 * and `<lr-split>`'s `collapseBreakpointBasis`, so it must stay in the shipped `.d.ts` — unlike the
 * controllers below, it carries no internal-visibility tag. `tsconfig.json` sets `stripInternal`,
 * which erases any declaration whose JSDoc carries that tag; doing so here would leave public
 * properties referencing a member the published types don't export, which
 * `pnpm check:packed-consumer` catches as TS2305. Note the tag is matched anywhere in the comment
 * block, so do not name it in prose here either.
 */
export type BreakpointBasis = 'container' | 'viewport';

/** The original name of {@link BreakpointBasis}, from before a second breakpoint (`<lr-split>`'s
 *  `collapseBreakpointBasis`) shared the same union. Kept exported — and identical — so the shipped
 *  `.d.ts` keeps naming it for `orientationBreakpointBasis`, and so anything already importing it
 *  keeps compiling. Same publish-surface reasoning as the doc above. */
export type OrientationBreakpointBasis = BreakpointBasis;

/** A bare CSS `<number>` with no unit — mirrors css-length.ts's `BREAKPOINT_LENGTH_RE` numeric
 *  part. `matchMedia()`, unlike `resolveCssLength`, has no unitless default, so this is what the
 *  raw value must match before `arm()` appends `px` to it. */
const BARE_NUMBER_RE = /^[+-]?(?:\d+(?:\.\d+)?|\.\d+)$/;

/** The grammar a raw value must satisfy to be a usable `'viewport'`-basis breakpoint: the same
 *  signed CSS `<number>` as `BARE_NUMBER_RE`, plus an optional `px`/`rem`/`em` unit — mirrors
 *  css-length.ts's `BREAKPOINT_LENGTH_RE`. This only decides whether `arm()` is worth calling
 *  `matchMedia()` at all; it is not consulted for the actual crossing comparison, which the
 *  browser owns under viewport basis. */
const VIEWPORT_LENGTH_RE = /^[+-]?(?:\d+(?:\.\d+)?|\.\d+)(?:px|rem|em)?$/i;

/**
 * Owns the "is this component currently below its orientation breakpoint?"
 * question for `<lr-split>` and `<lr-stepper>`, which expose an identically
 * named `orientationBreakpoint`/`orientationBreakpointBasis` contract.
 *
 * Under `'container'` basis the host measures itself (via its own
 * `ResizeObserver`) and passes that width to `isBelow()`. Under `'viewport'`
 * basis this controller holds a `MediaQueryList` and the passed width is
 * ignored — the case a self-measured threshold cannot express, e.g. two
 * siblings in a row that stacks via a pure-CSS `@media` rule.
 *
 * `resolved` and `active` answer different questions and must not be conflated. `resolved` is a
 * pixel number meaningful only under `'container'` basis, where this controller — not the browser
 * — owns the comparison. Under `'viewport'` basis the browser evaluates the `@media` rule itself,
 * so no single pixel value describes the crossing point (e.g. an `em`/`rem` length there resolves
 * against the browser's *initial* font size, not `resolveCssLength`'s live computed one); callers
 * must gate on `active` instead, which only asks whether the authored value is usable at all.
 *
 * Listener teardown rides on `hostDisconnected()`, so neither component
 * hand-writes it.
 *
 * @internal
 */
export class OrientationBreakpointController implements ReactiveController {
  private mediaQuery?: MediaQueryList;
  private belowViewport = false;
  private raw?: number | string;
  private basis: BreakpointBasis = 'container';

  constructor(
    private readonly host: ReactiveControllerHost & Element,
    /** Invoked only when a viewport-basis query actually flips. The host
     *  re-derives its effective axis and emits its own change event. */
    private readonly onViewportChange: () => void,
  ) {
    host.addController(this);
  }

  /** The breakpoint in pixels — meaningful only under `'container'` basis, where this controller
   *  itself owns the crossing comparison. Under `'viewport'` basis the browser's `matchMedia()`
   *  owns the comparison instead, so this number is not the one actually in effect there (see
   *  class doc); use `active`, not this, to test whether the feature is on.
   *  Deliberately re-resolved on every read rather than cached, so a `rem`
   *  breakpoint tracks the live root font size — caching would freeze the
   *  crossing width and defeat the point of accepting `rem`. */
  get resolved(): number | undefined {
    return resolveCssLength(this.raw, this.host);
  }

  /** Whether the orientation-breakpoint feature is on at all, i.e. the authored value resolves to
   *  something usable under the current basis. Under `'container'` basis this is exactly
   *  `resolved !== undefined`. Under `'viewport'` basis `resolved` isn't meaningful (see class
   *  doc), so this instead checks that the raw value is a syntactically usable CSS length —
   *  the same grammar `arm()` hands to `matchMedia()`. */
  get active(): boolean {
    if (this.basis !== 'viewport') return this.resolved !== undefined;
    if (typeof this.raw === 'number') return Number.isFinite(this.raw);
    return typeof this.raw === 'string' && VIEWPORT_LENGTH_RE.test(this.raw.trim());
  }

  /** Whether the host needs a container-measuring `ResizeObserver` for the
   *  orientation feature. False under viewport basis, which arms nothing on
   *  the host, and false when the breakpoint doesn't resolve. */
  get containerObservationEnabled(): boolean {
    return this.basis === 'container' && this.resolved !== undefined;
  }

  /** Re-reads the host's authored configuration and (re-)arms. Idempotent —
   *  call it whenever `orientationBreakpoint` or the basis changes. */
  configure(raw: number | string | undefined, basis: BreakpointBasis): void {
    this.raw = raw;
    this.basis = basis;
    this.arm();
  }

  /** Whether the effective axis should currently be the narrow one.
   *  `containerWidth` is consulted only under `'container'` basis. */
  isBelow(containerWidth: number): boolean {
    if (!this.active) return false;
    if (this.basis === 'viewport') return this.belowViewport;
    const breakpoint = this.resolved;
    return breakpoint !== undefined && containerWidth < breakpoint;
  }

  /** `hostDisconnected()` removes the `change` listener, so a viewport crossing that happens while
   *  the host is detached is never observed — and Lit schedules no update on a plain reconnect, so
   *  the hosts' `willUpdate()` re-derivation doesn't run either. Re-arming reads the live
   *  `matches` back, and comparing it against the pre-arm value announces exactly the crossing
   *  that was slept through.
   *
   *  The comparison is what makes this safe to do here: Lit connects controllers *before* the
   *  host's first update, when the basis is still the `'container'` default and no breakpoint has
   *  been configured. An unconditional announcement would reach the host's callback with
   *  `shouldEmit: true`, bypassing the `hasUpdated` guard both hosts use in `willUpdate()`
   *  precisely to suppress a spurious mount-time orientation-change event. With the diff, an
   *  unchanged (and therefore also an unconfigured) state stays silent. */
  hostConnected(): void {
    const before = this.belowViewport;
    this.arm();
    if (this.belowViewport !== before) this.onViewportChange();
  }

  hostDisconnected(): void {
    this.teardown();
  }

  private arm(): void {
    this.teardown();
    if (this.basis !== 'viewport' || !this.active || typeof matchMedia !== 'function') {
      this.belowViewport = false;
      return;
    }
    // The authored string goes to the browser verbatim. Inside a media query, `rem`/`em` resolve
    // against the browser's *initial* font size, ignoring any `html { font-size }` override —
    // unlike `resolveCssLength`, which reads the real computed size. That is exactly why viewport
    // basis matches a hand-authored `@media` rule using the same length, and exactly why its
    // crossing point can differ from container basis. A bare number/numeric-string — same
    // unitless form `resolveCssLength` accepts — becomes `<n>px`, the documented default unit,
    // since `matchMedia()` has no unitless default.
    const trimmed = typeof this.raw === 'number' ? `${this.raw}` : String(this.raw).trim();
    const length = BARE_NUMBER_RE.test(trimmed) ? `${trimmed}px` : trimmed;
    this.mediaQuery = matchMedia(`(max-width: ${length})`);
    this.mediaQuery.addEventListener('change', this.onChange);
    this.belowViewport = this.mediaQuery.matches;
  }

  private teardown(): void {
    this.mediaQuery?.removeEventListener('change', this.onChange);
    this.mediaQuery = undefined;
  }

  private onChange = (e: MediaQueryListEvent): void => {
    if (e.matches === this.belowViewport) return;
    this.belowViewport = e.matches;
    this.onViewportChange();
  };
}

/** The collapsing pane's responsive band, widest first. Structurally identical to `<lr-split>`'s
 *  own `SplitCollapseState`, which stays declared next to the property it types — this controller
 *  deliberately doesn't import from a component. */
export type CollapseBand = 'wide' | 'rail' | 'floating';

/** `<lr-split>`'s documented `railBreakpoint` default, reapplied here because `resolveCssLength`
 *  reports an unparseable value as `undefined` rather than substituting anything. */
const DEFAULT_RAIL_PX = 640;
/** `<lr-split>`'s documented `floatBreakpoint` default; same reasoning as above. */
const DEFAULT_FLOAT_PX = 400;

/**
 * Owns `<lr-split>`'s two collapse thresholds — `railBreakpoint` and `floatBreakpoint` — and
 * classifies the current width into one of three bands.
 *
 * This is deliberately **not** a second instance of `OrientationBreakpointController`. That one
 * answers a single boolean against one threshold; collapse is a three-way classification against
 * two, and under `'viewport'` basis that means two `MediaQueryList`s whose `change` events can
 * arrive in either order across a fast resize. Both queries are therefore read together, live,
 * inside `classify()` — no band is ever assembled from one query's event plus the other's
 * remembered value, so an out-of-order pair cannot land the host on a band neither query supports.
 *
 * Two further differences from the orientation controller, both consequences of these breakpoints
 * having documented defaults rather than an off switch:
 *
 * - An unparseable length falls back to `640`/`400` instead of disabling the feature.
 * - The host's `ResizeObserver` is not droppable under `'viewport'` basis: `<lr-split>` still reads
 *   its measured width for the container-basis orientation feature and for the `'auto'` release
 *   path, so this controller reports no `containerObservationEnabled` equivalent.
 *
 * The `railPx >= floatPx` invariant is enforced in **pixel** space under both bases: a `rem` rail
 * and a `px` float are resolved by `resolveCssLength` first and compared afterwards. Under
 * `'viewport'` basis that resolution follows container-query rules (live computed root font size)
 * while the query the browser actually evaluates follows media-query rules (initial font size), so
 * the two can disagree if an app overrides `html { font-size }` — the invariant is a sanity guard
 * against an inverted authored pair, not a promise about the exact crossing pixel.
 *
 * Listener teardown rides on `hostDisconnected()`, so the host doesn't hand-write it.
 *
 * @internal
 */
export class CollapseBreakpointController implements ReactiveController {
  private railQuery?: MediaQueryList;
  private floatQuery?: MediaQueryList;
  private rawRail?: number | string;
  private rawFloat?: number | string;
  private basis: BreakpointBasis = 'container';
  /** The last band the armed queries produced — the diff `hostConnected()` compares against, and
   *  the guard that keeps two `change` events for one crossing from announcing it twice. Only
   *  meaningful under `'viewport'` basis; pinned to `'wide'` otherwise. */
  private band: CollapseBand = 'wide';

  constructor(
    private readonly host: ReactiveControllerHost & Element,
    /** Invoked only when the viewport-basis band actually changes. The host re-classifies and
     *  emits its own change event. */
    private readonly onViewportChange: () => void,
  ) {
    host.addController(this);
  }

  /** Re-reads the host's authored configuration and (re-)arms. Idempotent — call it whenever
   *  either breakpoint or the basis changes. */
  configure(rail: number | string | undefined, float: number | string | undefined, basis: BreakpointBasis): void {
    this.rawRail = rail;
    this.rawFloat = float;
    this.basis = basis;
    this.arm();
  }

  /** `floatBreakpoint` resolved to a finite, non-negative pixel width, falling back to the
   *  documented default. Re-resolved on every read so a `rem` length tracks the live root font
   *  size. */
  get floatPx(): number {
    return Math.max(0, resolveCssLength(this.rawFloat, this.host) ?? DEFAULT_FLOAT_PX);
  }

  /** `railBreakpoint` resolved the same way, then held at or above `floatPx` — the class doc
   *  requires the rail band sit above the floating one, and an inverted pair would otherwise let
   *  `classify()` skip `'rail'` entirely while leaving a wide container reported as collapsed. */
  get railPx(): number {
    return Math.max(this.floatPx, this.railUnclampedPx);
  }

  /** Which band the collapsing pane belongs in right now. `containerWidth` is consulted only under
   *  `'container'` basis, where the comparison is strictly `<`; under `'viewport'` basis the
   *  browser owns it via `(max-width: …)`, which is inclusive (`<=`), so the two bases' crossing
   *  points differ by 1px — deliberate, so viewport basis lines up with a hand-authored `@media`
   *  rule using the same length. */
  classify(containerWidth: number): CollapseBand {
    if (this.viewportDriven) {
      // Both queries are read here, live and together — never one event's `matches` combined with
      // the other query's remembered value (see the class doc).
      if (this.floatQuery!.matches) return 'floating';
      if (this.railQuery!.matches) return 'rail';
      return 'wide';
    }
    if (containerWidth < this.floatPx) return 'floating';
    if (containerWidth < this.railPx) return 'rail';
    return 'wide';
  }

  /** Mirrors `OrientationBreakpointController.hostConnected()`: the `change` listeners are gone
   *  while detached and a plain reconnect schedules no Lit update, so re-arming and diffing the
   *  band is the only chance to notice a crossing that happened in between. The diff also keeps the
   *  very first connect — which Lit runs before the host's first update, before any `configure()` —
   *  silent, so no mount-time collapse event is invented. */
  hostConnected(): void {
    const before = this.band;
    this.arm();
    if (this.band !== before) this.onViewportChange();
  }

  hostDisconnected(): void {
    this.teardown();
  }

  /** `railBreakpoint` resolved and floored at 0, before the float-breakpoint invariant is applied
   *  — the raw side of the pixel-space comparison the class doc describes. */
  private get railUnclampedPx(): number {
    return Math.max(0, resolveCssLength(this.rawRail, this.host) ?? DEFAULT_RAIL_PX);
  }

  /** Whether the live classification comes from `matchMedia` rather than a measured width. False
   *  whenever the queries aren't armed (container basis, or no `matchMedia` at all), which is what
   *  makes `classify()`'s non-null assertions safe. */
  private get viewportDriven(): boolean {
    return this.basis === 'viewport' && this.railQuery !== undefined && this.floatQuery !== undefined;
  }

  private arm(): void {
    this.teardown();
    if (this.basis !== 'viewport' || typeof matchMedia !== 'function') {
      this.band = 'wide';
      return;
    }
    const floatLength = this.queryLength(this.rawFloat, DEFAULT_FLOAT_PX);
    // The `matchMedia`-side expression of `railPx`'s `Math.max`. Reusing the float query's own
    // text for an inverted pair (rather than `railPx` re-serialized to px) keeps the two queries
    // textually identical there, so they always agree and the `'rail'` band simply collapses away,
    // exactly as it does under container basis.
    const railLength = this.railUnclampedPx >= this.floatPx ? this.queryLength(this.rawRail, DEFAULT_RAIL_PX) : floatLength;
    this.railQuery = matchMedia(`(max-width: ${railLength})`);
    this.floatQuery = matchMedia(`(max-width: ${floatLength})`);
    this.railQuery.addEventListener('change', this.onChange);
    this.floatQuery.addEventListener('change', this.onChange);
    this.band = this.classify(Number.POSITIVE_INFINITY);
  }

  /** Serializes one authored breakpoint for `matchMedia`. A parseable length goes to the browser
   *  verbatim, so `rem`/`em` get real media-query semantics (resolved against the *initial* font
   *  size, ignoring any `html { font-size }` override) and line up with a hand-authored `@media`
   *  rule — the whole point of viewport basis. A bare number/numeric string becomes `<n>px`, since
   *  `matchMedia()` has no unitless default. An unparseable value falls back to the documented
   *  default, and a negative one to `0px` (a valid query that simply never matches, matching the
   *  container-basis clamp). */
  private queryLength(raw: number | string | undefined, fallbackPx: number): string {
    const resolved = resolveCssLength(raw, this.host);
    if (resolved === undefined) return `${fallbackPx}px`;
    if (resolved <= 0) return '0px';
    const trimmed = typeof raw === 'number' ? `${raw}` : String(raw).trim();
    return BARE_NUMBER_RE.test(trimmed) ? `${trimmed}px` : trimmed;
  }

  private teardown(): void {
    this.railQuery?.removeEventListener('change', this.onChange);
    this.floatQuery?.removeEventListener('change', this.onChange);
    this.railQuery = undefined;
    this.floatQuery = undefined;
  }

  /** Shared by both queries: re-classify from scratch and report only a real band change. Crossing
   *  both thresholds at once fires this twice, but the second call sees the band it already
   *  applied and stays quiet. */
  private onChange = (): void => {
    const next = this.classify(Number.POSITIVE_INFINITY);
    if (next === this.band) return;
    this.band = next;
    this.onViewportChange();
  };
}
