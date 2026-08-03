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
   */
  constructor(
    host: ReactiveControllerHost,
    private readonly resolve: () => Element | null | undefined,
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
}

/**
 * Registers a `ScrollOverflowController` on `host` and keeps no reference to it — the controller
 * drives itself entirely from the host's own update/disconnect callbacks, so the four components
 * using it have nothing to call back into. Call from the constructor.
 *
 * Exists because storing the controller in an otherwise-unread `private` field is a `noUnusedLocals`
 * error (TS6133), and widening the field to `protected`/public to dodge that would put an internal
 * implementation detail on the component's documented member surface.
 */
export function observeScrollOverflow(
  host: ReactiveControllerHost,
  resolve: () => Element | null | undefined,
): void {
  new ScrollOverflowController(host, resolve);
}
