import type { ReactiveController, ReactiveControllerHost } from 'lit';

/** Attribute this controller toggles on the tracked element. Lives in the component's own shadow
 *  root (never on the host), so it is an internal styling hook, not consumer-visible DOM. */
export const SCROLL_OVERFLOW_ATTRIBUTE = 'data-scroll-overflow';

/** Sub-pixel slack: a track laid out at a fractional width reports `scrollWidth` one integer pixel
 *  above `clientWidth` while fitting exactly, which would otherwise read as permanent overflow. */
const TOLERANCE_PX = 1;

/**
 * Tracks whether a horizontally scrollable track *actually* overflows, toggling
 * `SCROLL_OVERFLOW_ATTRIBUTE` on it so styles can gate an edge affordance (the
 * `--lr-scroll-fade-size` mask) on there being something to scroll to.
 *
 * Why this exists: the four components carrying that mask (`lr-segmented`, `lr-tab-group`,
 * `lr-stepper`, `lr-timeline`) used to paint it unconditionally, deliberately -- "a low-cost
 * affordance for an overflowing row [that] does not need scroll-position JavaScript or observers".
 * The cost of skipping the measurement is not low, though: on a track that fits, the fade is pure
 * damage. At the default `2rem` per edge, a two-option `<lr-segmented>` (`Overall | Daily`) is
 * narrower than its own two fades, so *both* labels render half-transparent against the page --
 * reported as the control looking permanently disabled.
 *
 * Measurement, not scroll position: the mask stays symmetric (both edges), matching the previous
 * rendering for the overflowing case this was always meant to serve. Per-edge fades keyed to
 * `scrollLeft` would need a scroll listener on top of this; that is a separate feature, not a
 * bug fix.
 *
 * Update sources are split, because they catch different changes:
 *   - `ResizeObserver` on the track -- the *container* got narrower/wider (viewport resize, a
 *     split pane dragged, a parent's layout settling).
 *   - `hostUpdated()` -- the *content* changed (segments added, a tab label re-localized). A
 *     `ResizeObserver` on the track observes only its own border box, which a content change
 *     inside a scroll container need not alter at all, so this is not redundant with the above.
 *
 * @example
 * // in the component
 * private overflow = new ScrollOverflowController(this, () =>
 *   this.renderRoot.querySelector('[part="base"]'));
 */
export class ScrollOverflowController implements ReactiveController {
  #observer?: ResizeObserver;
  #observed?: Element;
  #ownerWindow?: Window;

  /**
   * @param host The component; registers itself so `hostUpdated`/`hostDisconnected` fire.
   * @param resolve Returns the scrollable track, re-resolved on every host update so a re-rendered
   *   (replaced) element is picked up rather than a stale reference kept alive.
   * @param onResize Invoked from inside this controller's own `ResizeObserver` callback (never from
   *   the synchronous `sync()` path, which the host's own `updated()` already covers) -- lets a
   *   consumer with extra resize-driven bookkeeping (e.g. `<lr-tab-group>`'s scroll-edge
   *   availability) piggyback on this controller's single observer instance instead of standing up
   *   a second one, which would double-count in anything stubbing `ResizeObserver` globally and
   *   need its own independent owner-realm rebind on adoption.
   */
  constructor(
    host: ReactiveControllerHost,
    private readonly resolve: () => Element | null | undefined,
    private readonly onResize?: () => void,
  ) {
    host.addController(this);
  }

  hostConnected(): void {
    this.sync();
  }

  hostUpdated(): void {
    this.sync();
  }

  private sync(): void {
    const element = this.resolve();
    const ownerWindow = element?.ownerDocument.defaultView ?? undefined;
    if (element !== this.#observed || ownerWindow !== this.#ownerWindow) {
      this.resetObservation();
      this.#observed = element ?? undefined;
      this.#ownerWindow = ownerWindow;
      const ResizeObserverConstructor = ownerWindow?.ResizeObserver;
      if (element && ResizeObserverConstructor) {
        const observer = new ResizeObserverConstructor(() => {
          if (
            this.#observer !== observer ||
            this.#observed !== element ||
            element.ownerDocument.defaultView !== ownerWindow
          ) {
            return;
          }
          this.measure();
          this.onResize?.();
        });
        this.#observer = observer;
        observer.observe(element);
      }
    }
    this.measure();
  }

  hostDisconnected(): void {
    this.resetObservation();
  }

  private resetObservation(): void {
    this.#observer?.disconnect();
    this.#observer = undefined;
    this.#observed = undefined;
    this.#ownerWindow = undefined;
  }

  /** Re-measure now. Public so a component that changes its own track's content outside Lit's
   *  update cycle can resync without waiting for the `ResizeObserver`'s async callback. */
  measure(): void {
    const element = this.#observed;
    if (!element) return;
    const overflows = element.scrollWidth - element.clientWidth > TOLERANCE_PX;
    element.toggleAttribute(SCROLL_OVERFLOW_ATTRIBUTE, overflows);
  }

  /**
   * Adds extra elements to this controller's single `ResizeObserver` instance -- for a consumer
   * that also needs to react to a *descendant's* intrinsic geometry changing independently of the
   * tracked element's own border box (e.g. a tab's label growing without the tablist's fixed-width
   * container resizing). A no-op until `sync()` has a live observer (no owner realm yet, or the
   * realm has no `ResizeObserver`); safe to call on every host update with the current element set
   * -- observing an already-observed target is a spec-defined no-op, and a target dropped from a
   * later call (e.g. a removed tab) simply stops mattering once it disconnects, matching the
   * primary element's own lifecycle here.
   */
  observeExtra(elements: Iterable<Element>): void {
    if (!this.#observer) return;
    for (const element of elements) this.#observer.observe(element);
  }
}

/**
 * Registers a `ScrollOverflowController` on `host`. Most callers (three of the four components
 * using this) keep no reference to it — the controller drives itself entirely from the host's own
 * update/disconnect callbacks, so a bare statement-expression call is enough; discarding the return
 * value doesn't trip `noUnusedLocals` (TS6133), which only fires on an unread *binding*, not a
 * discarded expression result. A caller with its own resize-driven bookkeeping to piggyback (see
 * `onResize`/`observeExtra` on the class) stores the returned controller in its own `private` field
 * instead of widening this one to `protected`/public, which would put an internal implementation
 * detail on the component's documented member surface.
 *
 * @param onResize See `ScrollOverflowController`'s constructor param of the same name.
 */
export function observeScrollOverflow(
  host: ReactiveControllerHost,
  resolve: () => Element | null | undefined,
  onResize?: () => void,
): ScrollOverflowController {
  return new ScrollOverflowController(host, resolve, onResize);
}
