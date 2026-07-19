import type { ReactiveController, ReactiveControllerHost } from 'lit';
import { resolveCssLength } from './css-length.js';

/** Which box an orientation breakpoint is compared against. @internal */
export type OrientationBreakpointBasis = 'container' | 'viewport';

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

  /** The breakpoint in pixels, or `undefined` when unset or unresolvable.
   *  Deliberately re-resolved on every read rather than cached, so a `rem`
   *  breakpoint tracks the live root font size — caching would freeze the
   *  crossing width and defeat the point of accepting `rem`. */
  get resolved(): number | undefined {
    return resolveCssLength(this.raw, this.host);
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
    const breakpoint = this.resolved;
    if (breakpoint === undefined) return false;
    return this.basis === 'viewport' ? this.belowViewport : containerWidth < breakpoint;
  }

  hostConnected(): void {
    this.arm();
  }

  hostDisconnected(): void {
    this.teardown();
  }

  private arm(): void {
    this.teardown();
    if (this.basis !== 'viewport' || this.resolved === undefined || typeof matchMedia !== 'function') {
      this.belowViewport = false;
      return;
    }
    // The authored string goes to the browser verbatim so `rem` resolves with real
    // media-query semantics; a bare number becomes `<n>px`, the documented default unit.
    const length = typeof this.raw === 'number' ? `${this.raw}px` : String(this.raw).trim();
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
