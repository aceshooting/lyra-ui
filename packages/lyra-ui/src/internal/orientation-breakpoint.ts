import type { ReactiveController, ReactiveControllerHost } from 'lit';
import { resolveCssLength } from './css-length.js';

/**
 * Which box an orientation breakpoint is compared against.
 *
 * This types the public `orientationBreakpointBasis` property on `<lr-split>` and `<lr-stepper>`,
 * so it must stay in the shipped `.d.ts` — unlike the controller below, it carries no
 * internal-visibility tag. `tsconfig.json` sets `stripInternal`, which erases any declaration whose
 * JSDoc carries that tag; doing so here would leave two public properties referencing a member the
 * published types don't export, which `pnpm check:packed-consumer` catches as TS2305. Note the tag
 * is matched anywhere in the comment block, so do not name it in prose here either.
 */
export type OrientationBreakpointBasis = 'container' | 'viewport';

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
  private basis: OrientationBreakpointBasis = 'container';

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
  configure(raw: number | string | undefined, basis: OrientationBreakpointBasis): void {
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

  hostConnected(): void {
    this.arm();
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
