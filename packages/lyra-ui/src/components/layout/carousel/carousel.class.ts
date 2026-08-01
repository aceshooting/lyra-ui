import { html, nothing, type PropertyValues, type TemplateResult } from "lit";
import { property, query } from "lit/decorators.js";
import { LyraElement } from "../../../internal/lyra-element.js";
import { finiteDuration, finiteInteger } from "../../../internal/numbers.js";
import { styles } from "./carousel.styles.js";
import { trueDefaultBooleanConverter } from "../../../internal/converters.js";
import { getNumberFormat } from "../../../internal/intl-cache.js";
import { tag } from "../../../internal/prefix.js";

interface SlideSnapshot {
  hidden: boolean | "until-found";
  inert: boolean;
  role: string | null;
  ariaLabel: string | null;
  ariaRoleDescription: string | null;
  ariaHidden: string | null;
}

/**
 * Quiet period after the last `scroll` event before the resting slide is adopted. Native touch
 * scrolling emits `scroll` continuously through the fling and the rubber-band, so reacting per
 * event would emit a slide change for every slide the finger flicked past. Waiting for the
 * scroller to actually come to rest emits exactly one. `scrollend` short-circuits this wherever
 * it is implemented; the timer is what keeps the contract identical where it is not.
 */
const SCROLL_SETTLE_MS = 120;

export interface LyraCarouselEventMap {
  "lr-slide-change": CustomEvent<{ index: number }>;
}

/**
 * `<lr-carousel>` — an accessible single-slide carousel for arbitrary
 * slotted content. The index is reflected and self-managed by navigation;
 * every change emits `lr-slide-change` so applications can persist or
 * coordinate the active slide.
 *
 * Slides live in a native scroll-snap track, so touch swiping, trackpad
 * panning, momentum, and rubber-banding all come from the platform rather
 * than a synthetic pointer-drag. Scrolling to a slide by hand is therefore a
 * first-class way to change the active slide: once the scroller comes to
 * rest, the resting slide is adopted and `lr-slide-change` is emitted, the
 * same as if a button had been pressed.
 *
 * @customElement lr-carousel
 * @slot - Slide elements. Each assigned element becomes one slide.
 * @event lr-slide-change - Active slide changed, whether by button, keyboard, indicator, autoplay,
 *   or the user scrolling the track to rest on another slide. `detail: { index }`.
 * @csspart base - The carousel landmark.
 * @csspart viewport - The keyboard-focusable slide viewport, and the scroll-snap scroll port.
 * @csspart track - The slotted slide wrapper, laid out as the inline snap track.
 * @csspart controls - Previous/next control row.
 * @csspart previous-button - Previous slide button.
 * @csspart previous-glyph - The chevron glyph inside `previous-button`, mirrored under RTL.
 * @csspart next-button - Next slide button.
 * @csspart next-glyph - The chevron glyph inside `next-button`, mirrored under RTL.
 * @csspart indicators - Indicator button group.
 * @csspart indicator - An individual slide indicator's interactive hit target, sized to the
 *   shared minimum tappable size (`--lr-icon-button-size`), independent of the smaller visible
 *   dot rendered inside it (mirrors `<lr-swatch-picker>`'s `[part="swatch"]`/`[part="swatch-fill"]`
 *   split).
 * @csspart indicator-dot - The individual indicator's compact visible dot.
 * @cssprop [--lr-carousel-indicator-current-bg=var(--lr-color-brand-quiet)] - Background of the
 *   current slide's indicator dot (`[aria-current="true"]`). Declared as an inline `var()` fallback
 *   (never on `:host`), so setting it on the element or an ancestor recolors only the current
 *   indicator without hijacking the library-wide `--lr-color-brand-quiet` token.
 * @cssprop [--lr-carousel-indicator-current-border-color=var(--lr-color-brand)] - Border color of
 *   the current slide's indicator dot.
 * @cssprop [--lr-carousel-slide-basis=100%] - Flex basis of every slide in the snap track. The
 *   default gives one slide per view; a smaller value (e.g. `50%`) shows several at once while the
 *   snap positions still land on each slide's inline start.
 */
export class LyraCarousel extends LyraElement<LyraCarouselEventMap> {
  static override styles = [LyraElement.styles, styles];

  @property({ type: Number, reflect: true }) index = 0;
  @property({ type: Boolean, reflect: true }) loop = false;
  @property({ type: Boolean, reflect: true }) autoplay = false;
  @property({ type: Number, attribute: "autoplay-interval" })
  autoplayInterval = 5000;
  @property({
    attribute: "show-indicators",
    converter: trueDefaultBooleanConverter,
  })
  showIndicators = true;
  @property({ attribute: "accessible-label" }) accessibleLabel = "";
  @property({ attribute: "aria-label" }) private hostAccessibleLabel:
    | string
    | null = null;
  @query("slot") private slideSlot?: HTMLSlotElement;
  @query('[part="viewport"]') private viewport?: HTMLElement;

  private timer?: number;
  private reduceMotion = false;
  private mediaQuery?: MediaQueryList;
  private readonly slideSnapshots = new Map<HTMLElement, SlideSnapshot>();
  private scrollSettleTimer?: number;
  /** True while `index` is being adopted *from* the scroller, so the resulting update does not turn
   *  around and drive the scroller back to where it already is. */
  private adoptingScrolledSlide = false;
  /** The first alignment happens without animation: an `index` set in markup must not read as the
   *  carousel sliding into place on load. */
  private hasAlignedOnce = false;
  /** Slide a programmatic scroll is currently travelling toward, if any. */
  private pendingAlignIndex?: number;

  override connectedCallback(): void {
    super.connectedCallback();
    this.mediaQuery =
      typeof matchMedia === "function"
        ? matchMedia("(prefers-reduced-motion: reduce)")
        : undefined;
    this.reduceMotion = this.mediaQuery?.matches ?? false;
    this.mediaQuery?.addEventListener("change", this.onMotionPreferenceChange);
    this.restartAutoplay();
    if (this.hasUpdated) {
      queueMicrotask(() => {
        if (!this.isConnected) return;
        this.syncSlides();
        this.restartAutoplay();
        this.requestUpdate();
      });
    }
  }

  override disconnectedCallback(): void {
    this.stopAutoplay();
    this.cancelScrollSettle();
    this.hasAlignedOnce = false;
    this.mediaQuery?.removeEventListener(
      "change",
      this.onMotionPreferenceChange
    );
    this.mediaQuery = undefined;
    this.restoreSlides();
    super.disconnectedCallback();
  }

  protected override willUpdate(changed: PropertyValues): void {
    if (changed.has("index") && this.slideSlot) {
      this.index = this.normalizedIndex();
    }
  }

  protected override updated(changed: PropertyValues): void {
    // Slide metadata depends on locale and `.strings` as well as the carousel-specific
    // properties. LyraElement requests an update for those inherited inputs, so reconcile on
    // every update instead of leaving already-assigned slides in an old language.
    this.syncSlides();
    if (changed.has("autoplay") || changed.has("autoplayInterval"))
      this.restartAutoplay();
    // Only an index the component itself moved drives the scroller. An index adopted *from* a
    // user scroll is already where it belongs, and re-driving it would fight the gesture.
    if (!this.adoptingScrolledSlide && (changed.has("index") || !this.hasAlignedOnce)) {
      this.alignToActiveSlide();
    }
    this.hasAlignedOnce = true;
  }

  private onMotionPreferenceChange = (event: MediaQueryListEvent): void => {
    this.reduceMotion = event.matches;
    this.restartAutoplay();
  };

  private slides(): HTMLElement[] {
    return (this.slideSlot?.assignedElements({ flatten: true }) ?? []).filter(
      (element): element is HTMLElement => element instanceof HTMLElement
    );
  }

  /** Read-time-safe view of the reflected `index` property, clamped to `[0, count - 1]` -- `count`
   *  is the live slotted-slide count, not a static bound, so this re-clamps on every call rather
   *  than caching. */
  private normalizedIndex(count = this.slides().length): number {
    if (count === 0) return 0;
    return finiteInteger(this.index, 0, 0, count - 1);
  }

  private restoreAttribute(
    slide: HTMLElement,
    name: string,
    value: string | null
  ): void {
    if (value === null) slide.removeAttribute(name);
    else slide.setAttribute(name, value);
  }

  private restoreSlide(slide: HTMLElement, snapshot: SlideSnapshot): void {
    slide.hidden = snapshot.hidden;
    slide.inert = snapshot.inert;
    this.restoreAttribute(slide, "role", snapshot.role);
    this.restoreAttribute(slide, "aria-label", snapshot.ariaLabel);
    this.restoreAttribute(
      slide,
      "aria-roledescription",
      snapshot.ariaRoleDescription
    );
    this.restoreAttribute(slide, "aria-hidden", snapshot.ariaHidden);
  }

  private restoreSlides(): void {
    for (const [slide, snapshot] of this.slideSnapshots)
      this.restoreSlide(slide, snapshot);
    this.slideSnapshots.clear();
  }

  private syncSlides = (): void => {
    const slides = this.slides();
    const assigned = new Set(slides);
    for (const [slide, snapshot] of this.slideSnapshots) {
      if (!assigned.has(slide)) {
        this.restoreSlide(slide, snapshot);
        this.slideSnapshots.delete(slide);
      }
    }
    const current = this.normalizedIndex(slides.length);
    if (this.index !== current) this.index = current;
    slides.forEach((slide, slideIndex) => {
      const existing = this.slideSnapshots.get(slide);
      const snapshot: SlideSnapshot = existing ?? {
        hidden: slide.hidden,
        inert: slide.inert,
        role: slide.getAttribute("role"),
        ariaLabel: slide.getAttribute("aria-label"),
        ariaRoleDescription: slide.getAttribute("aria-roledescription"),
        ariaHidden: slide.getAttribute("aria-hidden"),
      };
      if (!existing) {
        this.slideSnapshots.set(slide, snapshot);
      }

      // Arbitrary assigned elements keep their own native/author semantics. The optional
      // carousel-item wrapper is the one slide owner whose contract permits generated group
      // metadata, and even there explicit author attributes win.
      if (slide.localName === tag("carousel-item")) {
        this.restoreAttribute(slide, "role", snapshot.role ?? "group");
        this.restoreAttribute(
          slide,
          "aria-roledescription",
          snapshot.ariaRoleDescription ?? this.localize("carouselSlide")
        );
        const format = getNumberFormat(this.effectiveLocale);
        this.restoreAttribute(
          slide,
          "aria-label",
          snapshot.ariaLabel ??
            this.localize("carouselSlidePosition", undefined, {
              index: format.format(slideIndex + 1),
              total: format.format(slides.length),
            })
        );
      } else {
        this.restoreAttribute(slide, "role", snapshot.role);
        this.restoreAttribute(
          slide,
          "aria-roledescription",
          snapshot.ariaRoleDescription
        );
        this.restoreAttribute(slide, "aria-label", snapshot.ariaLabel);
      }

      // Off-screen slides keep their boxes -- the snap track needs something to scroll between --
      // but are taken out of the tab order and the accessibility tree. `inert` is what makes that
      // safe: a link two slides away must not be reachable by Tab while it is scrolled out of
      // view, and `aria-hidden` alone would leave it focusable but unnamed.
      slide.hidden = snapshot.hidden;
      if (slideIndex === current) {
        slide.inert = snapshot.inert;
        this.restoreAttribute(slide, "aria-hidden", snapshot.ariaHidden);
      } else {
        slide.inert = true;
        slide.setAttribute("aria-hidden", "true");
      }
    });
  };

  private changeTo(index: number): void {
    const count = this.slides().length;
    if (count === 0 || !Number.isFinite(index)) return;
    const requested = Math.trunc(index);
    let next = requested;
    if (this.loop) next = (requested + count) % count;
    else next = Math.min(count - 1, Math.max(0, requested));
    if (next === this.index) return;
    this.index = next;
    this.emit("lr-slide-change", { index: next });
  }

  next = (): void => this.changeTo(this.index + 1);
  previous = (): void => this.changeTo(this.index - 1);
  goTo = (index: number): void => this.changeTo(index);

  private stopAutoplay(): void {
    if (this.timer !== undefined) window.clearInterval(this.timer);
    this.timer = undefined;
  }

  private restartAutoplay(): void {
    this.stopAutoplay();
    if (!this.autoplay || this.reduceMotion || this.slides().length < 2) return;
    // `autoplayInterval` is a timer duration handed straight to `setInterval` -- floor it at 1s (a
    // sub-second autoplay interval would fight the transition and hurt usability more than help)
    // and default a non-finite/`NaN` value to the property's own 5s default.
    const interval = finiteDuration(this.autoplayInterval, 5000, 1000);
    this.timer = window.setInterval(() => {
      if (this.loop || this.index < this.slides().length - 1) this.next();
      else this.stopAutoplay();
    }, interval);
  }

  private onSlotChange = (): void => {
    this.syncSlides();
    this.restartAutoplay();
    this.requestUpdate();
  };

  /** Signed inline-axis distance from the viewport's inline start to `slide`'s. Reading rectangles
   *  rather than `scrollLeft` keeps this correct under RTL, where the inline start is the right
   *  edge and the scroll offset itself is negative. */
  private inlineOffsetOf(slide: HTMLElement, viewport: HTMLElement): number {
    const viewportRect = viewport.getBoundingClientRect();
    const slideRect = slide.getBoundingClientRect();
    return this.effectiveDirection === "rtl"
      ? slideRect.right - viewportRect.right
      : slideRect.left - viewportRect.left;
  }

  /** The slide the scroller is currently resting closest to, or `undefined` when there is nothing
   *  to measure yet (no viewport, or no slides). */
  private restingSlideIndex(): number | undefined {
    const viewport = this.viewport;
    const slides = this.slides();
    if (!viewport || slides.length === 0) return undefined;
    let nearest: number | undefined;
    let nearestDistance = Number.POSITIVE_INFINITY;
    slides.forEach((slide, slideIndex) => {
      const distance = Math.abs(this.inlineOffsetOf(slide, viewport));
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearest = slideIndex;
      }
    });
    return nearest;
  }

  /** Brings the active slide's inline start flush with the viewport's, if it is not already.
   *  `instant` rather than `auto`: `auto` defers to the stylesheet's own `scroll-behavior: smooth`,
   *  so it would animate exactly where an animation is not wanted. */
  private alignToActiveSlide(): void {
    const viewport = this.viewport;
    const target = this.normalizedIndex();
    const slide = this.slides()[target];
    if (!viewport || !slide) return;
    const offset = this.inlineOffsetOf(slide, viewport);
    if (Math.round(offset) === 0) {
      this.pendingAlignIndex = undefined;
      return;
    }
    this.pendingAlignIndex = target;
    viewport.scrollBy({
      left: offset,
      behavior: this.reduceMotion || !this.hasAlignedOnce ? "instant" : "smooth",
    });
  }

  private cancelScrollSettle(): void {
    if (this.scrollSettleTimer !== undefined)
      window.clearTimeout(this.scrollSettleTimer);
    this.scrollSettleTimer = undefined;
  }

  private onViewportScroll = (): void => {
    this.cancelScrollSettle();
    this.scrollSettleTimer = window.setTimeout(
      this.settleScrolledSlide,
      SCROLL_SETTLE_MS
    );
  };

  /** `scrollend` fires once the scroller has finished, momentum included. Where it exists it makes
   *  the settle immediate; where it does not, the timer above is the only path and the contract is
   *  unchanged. */
  private onViewportScrollEnd = (): void => {
    this.cancelScrollSettle();
    this.settleScrolledSlide();
  };

  /** A user gesture supersedes any programmatic scroll still travelling: from here on the scroller
   *  is theirs, and the next resting position is theirs to define. */
  private readonly onViewportTakeover = {
    handleEvent: (): void => {
      this.pendingAlignIndex = undefined;
    },
    passive: true,
  };

  private settleScrolledSlide = (): void => {
    this.scrollSettleTimer = undefined;
    if (!this.isConnected) return;
    const resting = this.restingSlideIndex();
    if (resting === undefined) return;
    // A smooth programmatic scroll keeps emitting `scroll` while it travels, and one janky frame
    // is enough for the settle timer to fire mid-flight. Adopting that intermediate slide would
    // both emit a slide change nobody asked for and -- because mandatory snapping re-evaluates
    // when the slide metadata changes -- abort the animation short of its target.
    if (this.pendingAlignIndex !== undefined) {
      if (resting === this.pendingAlignIndex) this.pendingAlignIndex = undefined;
      return;
    }
    if (resting === this.index) return;
    this.adoptingScrolledSlide = true;
    this.index = resting;
    this.emit("lr-slide-change", { index: resting });
    void this.updateComplete.then(() => {
      this.adoptingScrolledSlide = false;
    });
  };

  private onViewportKeyDown = (event: KeyboardEvent): void => {
    const rtl = this.effectiveDirection === "rtl";
    const forwardKey = rtl ? "ArrowLeft" : "ArrowRight";
    const backwardKey = rtl ? "ArrowRight" : "ArrowLeft";
    if (event.key === forwardKey) {
      event.preventDefault();
      this.next();
    } else if (event.key === backwardKey) {
      event.preventDefault();
      this.previous();
    } else if (event.key === "Home") {
      event.preventDefault();
      this.goTo(0);
    } else if (event.key === "End") {
      event.preventDefault();
      this.goTo(this.slides().length - 1);
    }
  };

  override render(): TemplateResult {
    const count = this.slides().length;
    const current = this.normalizedIndex(count);
    const label =
      this.hostAccessibleLabel ||
      this.accessibleLabel ||
      this.localize("carouselLabel");
    const previousLabel = this.localize("previous");
    const nextLabel = this.localize("next");
    const numberFormat = getNumberFormat(this.effectiveLocale);
    return html`<section
      part="base"
      role="region"
      aria-roledescription=${this.localize("carousel")}
      aria-label=${label}
    >
      <div
        part="viewport"
        role="group"
        aria-label=${label}
        tabindex="0"
        aria-live=${this.autoplay ? "off" : "polite"}
        @keydown=${this.onViewportKeyDown}
        @scroll=${this.onViewportScroll}
        @scrollend=${this.onViewportScrollEnd}
        @pointerdown=${this.onViewportTakeover}
        @touchstart=${this.onViewportTakeover}
        @wheel=${this.onViewportTakeover}
      >
        <div part="track"><slot @slotchange=${this.onSlotChange}></slot></div>
      </div>
      ${count > 1
        ? html`<div part="controls">
            <button
              part="previous-button"
              type="button"
              aria-label=${previousLabel}
              ?disabled=${!this.loop && current === 0}
              @click=${this.previous}
            >
              <span part="previous-glyph" aria-hidden="true">‹</span>
            </button>
            ${this.showIndicators
              ? html`<div
                  part="indicators"
                  role="group"
                  aria-label=${this.localize("carouselIndicators")}
                >
                  ${Array.from(
                    { length: count },
                    (_, slideIndex) => html`<button
                      part="indicator"
                      type="button"
                      aria-label=${this.localize("carouselGoTo", undefined, {
                        index: numberFormat.format(slideIndex + 1),
                      })}
                      aria-current=${slideIndex === current ? "true" : "false"}
                      @click=${() => this.goTo(slideIndex)}
                    >
                      <span part="indicator-dot" aria-hidden="true"></span>
                    </button>`
                  )}
                </div>`
              : nothing}
            <button
              part="next-button"
              type="button"
              aria-label=${nextLabel}
              ?disabled=${!this.loop && current === count - 1}
              @click=${this.next}
            >
              <span part="next-glyph" aria-hidden="true">›</span>
            </button>
          </div>`
        : nothing}
    </section>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "lr-carousel": LyraCarousel;
  }
}
