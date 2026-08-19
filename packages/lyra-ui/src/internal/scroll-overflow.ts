import type { ReactiveController, ReactiveControllerHost } from 'lit';
import { isRtl } from './rtl.js';

/** Attribute this controller toggles on the tracked element whenever it overflows at all (in
 *  either logical direction). Lives in the component's own shadow root (never on the host), so it
 *  is an internal styling hook, not consumer-visible DOM. Kept alongside the normalized
 *  `SCROLL_START_ATTRIBUTE`/`SCROLL_END_ATTRIBUTE` pair below (not replaced by them) because it is
 *  the cheap "is there anything to gate on at all" check every consumer's CSS combines with one or
 *  both of the logical-edge attributes -- see any of `segmented.styles.ts`/`stepper.styles.ts`/
 *  `timeline.styles.ts`/`widget.styles.ts`/`tab-group.styles.ts` for the combined selector shape. */
export const SCROLL_OVERFLOW_ATTRIBUTE = 'data-scroll-overflow';

/** Set on the tracked element while there is more content to reach by scrolling further toward its
 *  logical *start* (i.e. the track is not already at its start edge) -- RTL-aware via `isRtl()` on
 *  the tracked element itself, matching `<lr-tab-group>`'s original per-component computation. */
export const SCROLL_START_ATTRIBUTE = 'data-scroll-start';

/** Set on the tracked element while there is more content to reach by scrolling further toward its
 *  logical *end*. See `SCROLL_START_ATTRIBUTE`. */
export const SCROLL_END_ATTRIBUTE = 'data-scroll-end';

/** Sub-pixel slack: a track laid out at a fractional width reports `scrollWidth` one integer pixel
 *  above `clientWidth` while fitting exactly, which would otherwise read as permanent overflow. The
 *  same tolerance is reused for the scroll-position comparisons below, so a track resting within a
 *  pixel of an edge reads as "at that edge" rather than jittering the attribute on rounding noise. */
const TOLERANCE_PX = 1;

/**
 * Tracks whether a horizontally scrollable track *actually* overflows, and -- since which logical
 * edge(s) still have content to reach -- toggles three attributes on it so styles can gate an edge
 * affordance (the `--lr-scroll-fade-size` mask, and in `<lr-tab-group>`'s case a pair of scroll
 * buttons too) on there being something to scroll to, on the correct side:
 *   - `SCROLL_OVERFLOW_ATTRIBUTE` -- overflows at all, in either direction.
 *   - `SCROLL_START_ATTRIBUTE` / `SCROLL_END_ATTRIBUTE` -- there is more to reach toward that
 *     logical edge specifically, RTL-aware. A track already scrolled to its start no longer sets
 *     `SCROLL_START_ATTRIBUTE`, so a consumer combining `[data-scroll-overflow][data-scroll-end]`
 *     with `:not([data-scroll-start])` (the shape every one-sided mask rule in this library uses)
 *     fades only the reachable edge instead of dimming a side that is already fully in view.
 *
 * Why this exists: the components carrying that mask (`lr-segmented`, `lr-tab-group`, `lr-stepper`,
 * `lr-timeline`, `lr-widget`) used to paint it unconditionally, deliberately -- "a low-cost
 * affordance for an overflowing row [that] does not need scroll-position JavaScript or observers".
 * The cost of skipping the measurement is not low, though: on a track that fits, the fade is pure
 * damage. At the default `2rem` per edge, a two-option `<lr-segmented>` (`Overall | Daily`) is
 * narrower than its own two fades, so *both* labels render half-transparent against the page --
 * reported as the control looking permanently disabled. A single symmetric boolean fixed that but
 * introduced a smaller version of the same defect: a track scrolled fully to one edge still dims
 * that edge, because the boolean alone carries no scroll-position information.
 *
 * Update sources are split, because they catch different changes:
 *   - `ResizeObserver` on the track -- the *container* got narrower/wider (viewport resize, a
 *     split pane dragged, a parent's layout settling).
 *   - `hostUpdated()` -- the *content* changed (segments added, a tab label re-localized). A
 *     `ResizeObserver` on the track observes only its own border box, which a content change
 *     inside a scroll container need not alter at all, so this is not redundant with the above.
 *   - `scroll` on the track -- the user (or a programmatic `scrollTo`/`scrollIntoView`) moved the
 *     scroll position without resizing anything or triggering a host update at all.
 *   - `observeExtra()` -- a descendant's own intrinsic geometry changed independently of the
 *     tracked element's border box (a slotted button's label growing, an icon loading in) without
 *     the tracked element's own box moving at all, which the plain `ResizeObserver` above cannot
 *     see on its own. See that method's own doc.
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
  #scrollTarget?: Element;
  #onScroll = (): void => this.measure();

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
      if (element) {
        // Passive: this listener only reads scroll position, never blocks the scroll itself.
        element.addEventListener('scroll', this.#onScroll, { passive: true });
        this.#scrollTarget = element;
      }
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
    this.#scrollTarget?.removeEventListener('scroll', this.#onScroll);
    this.#scrollTarget = undefined;
  }

  /** Re-measure now. Public so a component that changes its own track's content outside Lit's
   *  update cycle can resync without waiting for the `ResizeObserver`'s async callback. */
  measure(): void {
    const element = this.#observed;
    if (!element) return;
    const extent = Math.max(0, element.scrollWidth - element.clientWidth);
    const overflows = extent > TOLERANCE_PX;
    element.toggleAttribute(SCROLL_OVERFLOW_ATTRIBUTE, overflows);
    if (!overflows) {
      element.toggleAttribute(SCROLL_START_ATTRIBUTE, false);
      element.toggleAttribute(SCROLL_END_ATTRIBUTE, false);
      return;
    }
    // Per the CSSOM View spec (what every browser this library targets actually implements),
    // scrollLeft in RTL runs 0 (inline-start) down to -extent (inline-end) -- not the legacy
    // WebKit convention of extent down to 0. Negating normalizes it back to the same "distance
    // from the logical start" the LTR branch already computes, matching lr-tab-group/lr-scroller.
    const raw = isRtl(element) ? -element.scrollLeft : element.scrollLeft;
    const position = Math.max(0, Math.min(extent, raw));
    element.toggleAttribute(SCROLL_START_ATTRIBUTE, position > TOLERANCE_PX);
    element.toggleAttribute(SCROLL_END_ATTRIBUTE, position < extent - TOLERANCE_PX);
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
