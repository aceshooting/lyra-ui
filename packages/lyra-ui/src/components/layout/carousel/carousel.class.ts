import { html, nothing, type PropertyValues, type TemplateResult } from "lit";
import { property, query } from "lit/decorators.js";
import { LyraElement } from "../../../internal/lyra-element.js";
import { finiteDuration, finiteInteger } from "../../../internal/numbers.js";
import { getNumberFormat } from "../../../internal/intl-cache.js";
import { tag } from "../../../internal/prefix.js";
import { styles } from "./carousel.styles.js";
import type { LyraCarouselItem } from "./carousel-item.class.js";

interface SlideSnapshot {
  hidden: boolean | "until-found";
  inert: boolean;
  role: string | null;
  ariaLabel: string | null;
  ariaRoleDescription: string | null;
  ariaHidden: string | null;
}

interface RestingSlide {
  element: HTMLElement;
  index: number;
  cloneSide?: "before" | "after";
}

export type LyraCarouselOrientation = "horizontal" | "vertical";

const SCROLL_SETTLE_MS = 120;
const DRAG_CLICK_SUPPRESSION_MS = 0;

const falseDefaultBooleanFromAttributeConverter = {
  fromAttribute(value: string | null): boolean {
    return value !== null && value !== "false";
  },
};

export interface LyraCarouselEventMap {
  "lr-slide-change": CustomEvent<{ index: number; slide: HTMLElement }>;
}

/**
 * `<lr-carousel>` — a scroll-snap carousel for arbitrary slotted content. Its Web Awesome and
 * Shoelace-compatible surface supports optional navigation and pagination, multiple slides per
 * page, horizontal or vertical movement, autoplay, looping, and opt-in mouse dragging. The older
 * Lyra `index`/`showIndicators` names remain synchronized aliases of
 * `currentSlide`/`pagination`.
 *
 * @customElement lr-carousel
 * @slot - Slide elements. Each assigned element becomes one slide.
 * @slot next-icon - Optional next-navigation icon.
 * @slot previous-icon - Optional previous-navigation icon.
 * @event lr-slide-change - Active slide changed. `detail: { index, slide }`.
 * @csspart base - Compatibility name for the carousel landmark; use `carousel`.
 * @csspart carousel - The carousel landmark. It is the same node as `base`.
 * @csspart scroll-container - The keyboard-focusable scroll-snap viewport.
 * @csspart viewport - Lyra compatibility name for `scroll-container` on the same node.
 * @csspart track - Lyra extension wrapping the slotted slides and inert loop endcaps.
 * @csspart controls - Lyra extension wrapping enabled navigation and pagination.
 * @csspart navigation - The previous/next navigation wrapper.
 * @csspart navigation-button - Shared navigation button part.
 * @csspart navigation-button-previous - Previous navigation button.
 * @csspart navigation-button-next - Next navigation button.
 * @csspart navigation-button--previous - Shoelace name for the previous navigation button.
 * @csspart navigation-button--next - Shoelace name for the next navigation button.
 * @csspart previous-button - Lyra compatibility name for `navigation-button-previous`.
 * @csspart next-button - Lyra compatibility name for `navigation-button-next`.
 * @csspart previous-glyph - Wrapper around the previous-icon slot.
 * @csspart next-glyph - Wrapper around the next-icon slot.
 * @csspart pagination - The pagination wrapper.
 * @csspart pagination-item - A pagination button.
 * @csspart pagination-item-active - The active pagination button.
 * @csspart pagination-item--active - Shoelace name for the active pagination button.
 * @csspart indicators - Lyra compatibility name for `pagination`.
 * @csspart indicator - Lyra compatibility name for `pagination-item`.
 * @csspart indicator-dot - Compact visible dot inside a pagination button.
 * @cssprop [--aspect-ratio=16/9] - Aspect ratio inherited by each slide.
 * @cssprop --scroll-hint - Logical padding that reveals the nearest adjacent slides.
 * @cssprop [--slide-gap=var(--lr-space-m)] - Gap between slides.
 * @cssprop [--lr-carousel-indicator-current-bg=var(--lr-color-brand-quiet)] - Active dot fill.
 * @cssprop [--lr-carousel-indicator-current-border-color=var(--lr-color-brand)] - Active dot border.
 * @cssprop --lr-carousel-slide-basis - Compatibility override for the computed per-page basis.
 * @status stable
 * @since 4.0.0
 */
export class LyraCarousel extends LyraElement<LyraCarouselEventMap> {
  static override styles = [LyraElement.styles, styles];

  private _currentSlide = 0;
  private _pagination = false;
  private _slides = 0;

  /** Zero-based start of the active slide page.
   * @default 0 */
  @property({ type: Number, attribute: "current-slide", reflect: true })
  get currentSlide(): number {
    return this._currentSlide;
  }
  set currentSlide(value: number) {
    this.setCurrentSlideState(value);
  }

  /** Compatibility alias for `currentSlide`.
   * @default 0 */
  @property({ type: Number, reflect: true })
  get index(): number {
    return this._currentSlide;
  }
  set index(value: number) {
    this.setCurrentSlideState(value);
  }

  @property({ type: Boolean, reflect: true }) loop = false;
  @property({ type: Boolean, reflect: true }) autoplay = false;
  @property({ type: Number, attribute: "autoplay-interval" })
  autoplayInterval = 3000;
  @property({ type: Boolean, reflect: true }) navigation = false;

  /** Whether page indicators are rendered.
   * @default false */
  @property({ type: Boolean, reflect: true })
  get pagination(): boolean {
    return this._pagination;
  }
  set pagination(value: boolean) {
    this.setPaginationState(Boolean(value));
  }

  /** Compatibility alias for `pagination`.
   * @default false */
  @property({
    attribute: "show-indicators",
    converter: falseDefaultBooleanFromAttributeConverter,
  })
  get showIndicators(): boolean {
    return this._pagination;
  }
  set showIndicators(value: boolean) {
    this.setPaginationState(Boolean(value));
  }

  @property() orientation: LyraCarouselOrientation = "horizontal";
  @property({ type: Boolean, attribute: "mouse-dragging", reflect: true })
  mouseDragging = false;
  @property({ type: Number, attribute: "slides-per-page" }) slidesPerPage = 1;
  @property({ type: Number, attribute: "slides-per-move" }) slidesPerMove = 1;
  /** Live count of assigned slides.
   * @default 0 */
  @property({ type: Number, reflect: true })
  get slides(): number {
    return this._slides;
  }
  set slides(value: number) {
    const old = this._slides;
    const next = finiteInteger(value, 0, 0);
    if (old === next) return;
    this._slides = next;
    this.requestUpdate("slides", old);
  }
  @property({ attribute: "accessible-label" }) accessibleLabel = "";
  @property({ attribute: "aria-label" }) private hostAccessibleLabel:
    | string
    | null = null;

  @query("slot:not([name])") private slideSlot?: HTMLSlotElement;
  @query('[part~="scroll-container"]') private viewport?: HTMLElement;
  @query(".scroll-hint-probe") private scrollHintProbe?: HTMLElement;
  @query('[data-clone-set="before"]') private beforeClones?: HTMLElement;
  @query('[data-clone-set="after"]') private afterClones?: HTMLElement;

  private timer?: number;
  private reduceMotion = false;
  private mediaQuery?: MediaQueryList;
  private readonly slideSnapshots = new Map<HTMLElement, SlideSnapshot>();
  private scrollSettleTimer?: number;
  private adoptingScrolledSlide = false;
  private hasAlignedOnce = false;
  private pendingAlignIndex?: number;
  private pendingAlignElement?: HTMLElement;
  private requestedBehavior?: ScrollBehavior;
  private requestedLoopSide?: "before" | "after";
  private loopClonesDirty = true;
  private pointerInteracting = false;
  private focusInteracting = false;
  private dragPointerId?: number;
  private dragStartCoordinate = 0;
  private dragStartScroll = 0;
  private dragMoved = false;
  private suppressClick = false;
  private suppressClickTimer?: number;

  constructor() {
    super();
    // Accessor-backed defaults do not pass through a class-field setter. Seed their first
    // reflection explicitly so `currentSlide`/`index`/`slides` honor the same reflected-default
    // contract as ordinary Lit fields without duplicating their state.
    this.requestUpdate("currentSlide", undefined);
    this.requestUpdate("index", undefined);
    this.requestUpdate("pagination", undefined);
    this.requestUpdate("slides", undefined);
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.mediaQuery =
      typeof matchMedia === "function"
        ? matchMedia("(prefers-reduced-motion: reduce)")
        : undefined;
    this.reduceMotion = this.mediaQuery?.matches ?? false;
    this.mediaQuery?.addEventListener("change", this.onMotionPreferenceChange);
    document.addEventListener("visibilitychange", this.onVisibilityChange);
    this.restartAutoplay();
    if (this.hasUpdated) {
      queueMicrotask(() => {
        if (!this.isConnected) return;
        this.handleSlidesChanged();
      });
    }
  }

  override disconnectedCallback(): void {
    this.cancelDrag(false);
    this.stopAutoplay();
    this.cancelScrollSettle();
    if (this.suppressClickTimer !== undefined)
      window.clearTimeout(this.suppressClickTimer);
    this.suppressClickTimer = undefined;
    this.suppressClick = false;
    this.pointerInteracting = false;
    this.focusInteracting = false;
    this.hasAlignedOnce = false;
    this.pendingAlignElement = undefined;
    this.pendingAlignIndex = undefined;
    this.requestedLoopSide = undefined;
    this.mediaQuery?.removeEventListener(
      "change",
      this.onMotionPreferenceChange
    );
    this.mediaQuery = undefined;
    document.removeEventListener("visibilitychange", this.onVisibilityChange);
    this.restoreSlides();
    super.disconnectedCallback();
  }

  protected override willUpdate(changed: PropertyValues): void {
    if (
      (changed.has("currentSlide") ||
        changed.has("index") ||
        changed.has("slidesPerPage")) &&
      this.slideSlot
    ) {
      const normalized = this.normalizedIndex();
      if (this.currentSlide !== normalized) this.currentSlide = normalized;
    }
  }

  protected override updated(changed: PropertyValues): void {
    this.syncSlides();
    if (
      this.loopClonesDirty ||
      changed.has("loop") ||
      changed.has("slidesPerPage") ||
      changed.has("slidesPerMove")
    ) {
      this.syncLoopClones();
      this.loopClonesDirty = false;
    }
    if (
      changed.has("autoplay") ||
      changed.has("autoplayInterval") ||
      changed.has("loop") ||
      changed.has("slidesPerPage")
    ) {
      this.restartAutoplay();
    }
    if (
      !this.adoptingScrolledSlide &&
      (changed.has("currentSlide") ||
        changed.has("index") ||
        changed.has("slidesPerPage") ||
        changed.has("orientation") ||
        !this.hasAlignedOnce)
    ) {
      this.alignToActiveSlide();
    }
    this.hasAlignedOnce = true;
  }

  private setCurrentSlideState(value: number): void {
    const old = this._currentSlide;
    const next = finiteInteger(value, 0);
    if (old === next) return;
    this._currentSlide = next;
    this.requestUpdate("currentSlide", old);
    this.requestUpdate("index", old);
  }

  private setPaginationState(value: boolean): void {
    const old = this._pagination;
    if (old === value) return;
    this._pagination = value;
    this.requestUpdate("pagination", old);
    this.requestUpdate("showIndicators", old);
  }

  private onMotionPreferenceChange = (event: MediaQueryListEvent): void => {
    this.reduceMotion = event.matches;
    this.restartAutoplay();
    this.requestUpdate();
  };

  private onVisibilityChange = (): void => {
    this.restartAutoplay();
  };

  private effectiveOrientation(): LyraCarouselOrientation {
    return this.orientation === "vertical" ? "vertical" : "horizontal";
  }

  private slideElements(): HTMLElement[] {
    return (this.slideSlot?.assignedElements({ flatten: true }) ?? []).filter(
      (element): element is HTMLElement => element instanceof HTMLElement
    );
  }

  private safeSlidesPerPage(count = this.slideElements().length): number {
    return finiteInteger(this.slidesPerPage, 1, 1, Math.max(1, count));
  }

  private safeSlidesPerMove(count = this.slideElements().length): number {
    return finiteInteger(
      this.slidesPerMove,
      1,
      1,
      this.safeSlidesPerPage(count)
    );
  }

  private maxStartIndex(count = this.slideElements().length): number {
    return Math.max(0, count - this.safeSlidesPerPage(count));
  }

  private normalizedIndex(count = this.slideElements().length): number {
    if (count === 0) return 0;
    const max = this.loop ? count - 1 : this.maxStartIndex(count);
    return finiteInteger(this.currentSlide, 0, 0, max);
  }

  private pageTargets(count = this.slideElements().length): number[] {
    if (count === 0) return [];
    const max = this.maxStartIndex(count);
    const move = this.safeSlidesPerMove(count);
    const targets: number[] = [0];
    for (let target = move; target < max; target += move) targets.push(target);
    if (max > 0 && targets.at(-1) !== max) targets.push(max);
    return targets;
  }

  private visibleIndices(count: number, current: number): Set<number> {
    const visible = new Set<number>();
    const perPage = this.safeSlidesPerPage(count);
    for (let offset = 0; offset < perPage; offset += 1) {
      const index = this.loop
        ? (current + offset) % count
        : current + offset;
      if (index >= 0 && index < count) visible.add(index);
    }
    return visible;
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
    const slides = this.slideElements();
    const assigned = new Set(slides);
    for (const [slide, snapshot] of this.slideSnapshots) {
      if (!assigned.has(slide)) {
        this.restoreSlide(slide, snapshot);
        this.slideSnapshots.delete(slide);
      }
    }
    const current = this.normalizedIndex(slides.length);
    if (this.currentSlide !== current) this.currentSlide = current;
    const visible = this.visibleIndices(slides.length, current);
    const format = getNumberFormat(this.effectiveLocale);

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
      if (!existing) this.slideSnapshots.set(slide, snapshot);

      if (slide.localName === tag("carousel-item")) {
        this.restoreAttribute(slide, "role", snapshot.role ?? "group");
        this.restoreAttribute(
          slide,
          "aria-roledescription",
          snapshot.ariaRoleDescription ?? this.localize("carouselSlide")
        );
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

      slide.hidden = snapshot.hidden;
      if (visible.has(slideIndex)) {
        slide.inert = snapshot.inert;
        this.restoreAttribute(slide, "aria-hidden", snapshot.ariaHidden);
      } else {
        slide.inert = true;
        slide.setAttribute("aria-hidden", "true");
      }
    });
  };

  private handleSlidesChanged(): void {
    const count = this.slideElements().length;
    if (this.slides !== count) this.slides = count;
    this.loopClonesDirty = true;
    this.syncSlides();
    this.syncLoopClones();
    this.loopClonesDirty = false;
    this.restartAutoplay();
    this.requestUpdate();
  }

  private onSlotChange = (): void => {
    this.handleSlidesChanged();
  };

  private prepareClone(
    original: HTMLElement,
    index: number,
    side: "before" | "after"
  ): HTMLElement {
    const clone = original.cloneNode(true) as HTMLElement;
    const descendants = [
      clone,
      ...Array.from(clone.querySelectorAll<HTMLElement>("*")),
    ];
    for (const descendant of descendants) {
      descendant.removeAttribute("id");
      descendant.removeAttribute("name");
      descendant.removeAttribute("form");
      descendant.removeAttribute("for");
      descendant.removeAttribute("aria-controls");
      descendant.removeAttribute("aria-describedby");
      descendant.removeAttribute("aria-labelledby");
    }
    clone.removeAttribute("slot");
    clone.dataset["carouselClone"] = side;
    clone.dataset["carouselIndex"] = String(index);
    clone.inert = true;
    clone.setAttribute("aria-hidden", "true");
    return clone;
  }

  private syncLoopClones(): void {
    const before = this.beforeClones;
    const after = this.afterClones;
    if (!before || !after) return;
    before.replaceChildren();
    after.replaceChildren();
    const slides = this.slideElements();
    if (!this.loop || slides.length < 2) return;
    const cloneCount = Math.min(
      slides.length,
      Math.max(
        this.safeSlidesPerPage(slides.length),
        this.safeSlidesPerMove(slides.length)
      )
    );
    const beforeStart = slides.length - cloneCount;
    for (let index = beforeStart; index < slides.length; index += 1) {
      before.append(this.prepareClone(slides[index]!, index, "before"));
    }
    for (let index = 0; index < cloneCount; index += 1) {
      after.append(this.prepareClone(slides[index]!, index, "after"));
    }
  }

  private cloneFor(
    side: "before" | "after",
    index: number
  ): HTMLElement | undefined {
    const container = side === "before" ? this.beforeClones : this.afterClones;
    return (
      container?.querySelector(`[data-carousel-index="${index}"]`) ??
      undefined
    ) as HTMLElement | undefined;
  }

  private changeTo(
    index: number,
    behavior: ScrollBehavior = "smooth"
  ): void {
    const slides = this.slideElements();
    const count = slides.length;
    if (count === 0 || !Number.isFinite(index)) return;
    const requested = Math.trunc(index);
    let next: number;
    let loopSide: "before" | "after" | undefined;
    if (this.loop) {
      next = ((requested % count) + count) % count;
      if (requested < 0) loopSide = "before";
      else if (requested >= count) loopSide = "after";
    } else {
      next = Math.min(this.maxStartIndex(count), Math.max(0, requested));
    }
    if (next === this.currentSlide) return;
    this.requestedBehavior = behavior;
    this.requestedLoopSide = loopSide;
    this.currentSlide = next;
    this.emit("lr-slide-change", { index: next, slide: slides[next]! });
  }

  /** Moves forward by `slidesPerMove`. */
  next(behavior: ScrollBehavior = "smooth"): void {
    this.changeTo(this.currentSlide + this.safeSlidesPerMove(), behavior);
  }

  /** Moves backward by `slidesPerMove`. */
  previous(behavior: ScrollBehavior = "smooth"): void {
    this.changeTo(this.currentSlide - this.safeSlidesPerMove(), behavior);
  }

  /** Moves to the requested slide. */
  goToSlide(index: number, behavior: ScrollBehavior = "smooth"): void {
    this.changeTo(index, behavior);
  }

  /** Compatibility alias for `goToSlide()`. */
  goTo(index: number, behavior: ScrollBehavior = "smooth"): void {
    this.goToSlide(index, behavior);
  }

  /** Appends a carousel item. */
  addSlide(slide: LyraCarouselItem): void {
    if (!(slide instanceof HTMLElement)) return;
    this.append(slide);
    queueMicrotask(() => {
      if (this.isConnected) this.handleSlidesChanged();
    });
  }

  /** Removes the carousel item at `index`. */
  removeSlide(index: number): void {
    if (!Number.isFinite(index)) return;
    const slides = this.slideElements();
    const target = slides[Math.trunc(index)];
    if (!target) return;
    target.remove();
    queueMicrotask(() => {
      if (this.isConnected) this.handleSlidesChanged();
    });
  }

  private stopAutoplay(): void {
    if (this.timer !== undefined) window.clearInterval(this.timer);
    this.timer = undefined;
  }

  private restartAutoplay(): void {
    this.stopAutoplay();
    const count = this.slideElements().length;
    if (
      !this.isConnected ||
      !this.autoplay ||
      this.reduceMotion ||
      this.pointerInteracting ||
      this.focusInteracting ||
      this.dragPointerId !== undefined ||
      document.visibilityState !== "visible" ||
      count <= this.safeSlidesPerPage(count)
    ) {
      return;
    }
    const interval = finiteDuration(this.autoplayInterval, 3000, 1000);
    this.timer = window.setInterval(() => {
      if (this.loop || this.currentSlide < this.maxStartIndex())
        this.next("smooth");
      else this.stopAutoplay();
    }, interval);
  }

  private scrollPaddingStart(): number {
    const rect = this.scrollHintProbe?.getBoundingClientRect();
    if (!rect) return 0;
    const pixels =
      this.effectiveOrientation() === "vertical" ? rect.height : rect.width;
    return Number.isFinite(pixels) ? pixels : 0;
  }

  private axisOffsetOf(slide: HTMLElement, viewport: HTMLElement): number {
    const viewportRect = viewport.getBoundingClientRect();
    const slideRect = slide.getBoundingClientRect();
    const padding = this.scrollPaddingStart();
    if (this.effectiveOrientation() === "vertical") {
      return slideRect.top - (viewportRect.top + padding);
    }
    return this.effectiveDirection === "rtl"
      ? slideRect.right - (viewportRect.right - padding)
      : slideRect.left - (viewportRect.left + padding);
  }

  private scrollByAxis(
    viewport: HTMLElement,
    distance: number,
    behavior: ScrollBehavior
  ): void {
    if (this.effectiveOrientation() === "vertical") {
      viewport.scrollBy({ top: distance, behavior });
    } else {
      viewport.scrollBy({ left: distance, behavior });
    }
  }

  private restingSlide(): RestingSlide | undefined {
    const viewport = this.viewport;
    const slides = this.slideElements();
    if (!viewport || slides.length === 0) return undefined;
    const candidates: RestingSlide[] = slides.map((element, index) => ({
      element,
      index,
    }));
    for (const clone of this.shadowRoot?.querySelectorAll<HTMLElement>(
      "[data-carousel-clone]"
    ) ?? []) {
      const index = Number(clone.dataset["carouselIndex"]);
      const cloneSide = clone.dataset["carouselClone"];
      if (
        Number.isInteger(index) &&
        index >= 0 &&
        index < slides.length &&
        (cloneSide === "before" || cloneSide === "after")
      ) {
        candidates.push({ element: clone, index, cloneSide });
      }
    }
    let nearest: RestingSlide | undefined;
    let nearestDistance = Number.POSITIVE_INFINITY;
    for (const candidate of candidates) {
      const distance = Math.abs(this.axisOffsetOf(candidate.element, viewport));
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearest = candidate;
      }
    }
    return nearest;
  }

  private alignToActiveSlide(): void {
    const viewport = this.viewport;
    const targetIndex = this.normalizedIndex();
    const realSlide = this.slideElements()[targetIndex];
    if (!viewport || !realSlide) return;
    const loopSide = this.requestedLoopSide;
    const requestedBehavior = this.requestedBehavior;
    this.requestedLoopSide = undefined;
    this.requestedBehavior = undefined;
    const target = loopSide
      ? this.cloneFor(loopSide, targetIndex) ?? realSlide
      : realSlide;
    const offset = this.axisOffsetOf(target, viewport);
    if (Math.round(offset) === 0) {
      this.pendingAlignIndex = undefined;
      this.pendingAlignElement = undefined;
      return;
    }
    this.pendingAlignIndex = targetIndex;
    this.pendingAlignElement = target;
    const behavior =
      this.reduceMotion || !this.hasAlignedOnce
        ? "instant"
        : requestedBehavior ?? "smooth";
    this.scrollByAxis(viewport, offset, behavior);
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

  private onViewportScrollEnd = (): void => {
    this.cancelScrollSettle();
    this.settleScrolledSlide();
  };

  private clearPendingAlignment(): void {
    this.pendingAlignElement = undefined;
    this.pendingAlignIndex = undefined;
    this.requestedLoopSide = undefined;
    this.requestedBehavior = undefined;
  }

  private takeOverViewport(): void {
    this.clearPendingAlignment();
  }

  private settleScrolledSlide = (): void => {
    this.scrollSettleTimer = undefined;
    if (!this.isConnected) return;
    const viewport = this.viewport;
    if (!viewport) return;

    if (this.pendingAlignElement) {
      if (Math.abs(this.axisOffsetOf(this.pendingAlignElement, viewport)) > 2)
        return;
      const cloneSide = this.pendingAlignElement.dataset["carouselClone"];
      if (cloneSide === "before" || cloneSide === "after") {
        const realSlide = this.slideElements()[this.pendingAlignIndex ?? -1];
        if (realSlide) {
          this.pendingAlignElement = realSlide;
          this.scrollByAxis(
            viewport,
            this.axisOffsetOf(realSlide, viewport),
            "instant"
          );
          return;
        }
      }
      this.clearPendingAlignment();
      return;
    }

    const resting = this.restingSlide();
    if (!resting) return;
    const changed = resting.index !== this.currentSlide;
    if (!changed && !resting.cloneSide) return;
    this.adoptingScrolledSlide = true;
    if (changed) {
      this.currentSlide = resting.index;
      this.emit("lr-slide-change", {
        index: resting.index,
        slide: this.slideElements()[resting.index]!,
      });
    }
    void this.updateComplete.then(() => {
      if (resting.cloneSide && this.isConnected && this.viewport) {
        const realSlide = this.slideElements()[resting.index];
        if (realSlide) {
          this.scrollByAxis(
            this.viewport,
            this.axisOffsetOf(realSlide, this.viewport),
            "instant"
          );
        }
      }
      this.adoptingScrolledSlide = false;
    });
  };

  private onViewportPointerEnter = (): void => {
    this.pointerInteracting = true;
    this.restartAutoplay();
  };

  private onViewportPointerLeave = (): void => {
    if (this.dragPointerId !== undefined) return;
    this.pointerInteracting = false;
    this.restartAutoplay();
  };

  private onViewportFocusIn = (): void => {
    this.focusInteracting = true;
    this.restartAutoplay();
  };

  private onViewportFocusOut = (): void => {
    queueMicrotask(() => {
      if (!this.isConnected) return;
      this.focusInteracting = this.matches(":focus-within");
      this.restartAutoplay();
    });
  };

  private onViewportPointerDown = (event: PointerEvent): void => {
    this.takeOverViewport();
    if (
      !this.mouseDragging ||
      event.pointerType !== "mouse" ||
      event.button !== 0 ||
      this.dragPointerId !== undefined
    ) {
      return;
    }
    const viewport = this.viewport;
    if (!viewport) return;
    this.dragPointerId = event.pointerId;
    this.dragStartCoordinate =
      this.effectiveOrientation() === "vertical"
        ? event.clientY
        : event.clientX;
    this.dragStartScroll =
      this.effectiveOrientation() === "vertical"
        ? viewport.scrollTop
        : viewport.scrollLeft;
    this.dragMoved = false;
    viewport.setAttribute("data-dragging", "");
    try {
      viewport.setPointerCapture(event.pointerId);
    } catch {
      // The pointer may already have ended in a synthetic or cross-document dispatch.
    }
    this.restartAutoplay();
  };

  private onViewportPointerMove = (event: PointerEvent): void => {
    if (event.pointerId !== this.dragPointerId) return;
    const viewport = this.viewport;
    if (!viewport) return;
    const coordinate =
      this.effectiveOrientation() === "vertical"
        ? event.clientY
        : event.clientX;
    const delta = coordinate - this.dragStartCoordinate;
    if (Math.abs(delta) > 2) this.dragMoved = true;
    if (!this.dragMoved) return;
    event.preventDefault();
    if (this.effectiveOrientation() === "vertical") {
      viewport.scrollTo({ top: this.dragStartScroll - delta, behavior: "instant" });
    } else {
      viewport.scrollTo({ left: this.dragStartScroll - delta, behavior: "instant" });
    }
  };

  private finishDrag(pointerId: number, canceled: boolean): void {
    if (pointerId !== this.dragPointerId) return;
    const viewport = this.viewport;
    const moved = this.dragMoved;
    this.dragPointerId = undefined;
    this.dragMoved = false;
    viewport?.removeAttribute("data-dragging");
    if (viewport?.hasPointerCapture(pointerId)) {
      try {
        viewport.releasePointerCapture(pointerId);
      } catch {
        // Pointer capture can disappear between the check and release.
      }
    }
    if (moved) {
      this.suppressClick = true;
      if (this.suppressClickTimer !== undefined)
        window.clearTimeout(this.suppressClickTimer);
      this.suppressClickTimer = window.setTimeout(() => {
        this.suppressClick = false;
        this.suppressClickTimer = undefined;
      }, DRAG_CLICK_SUPPRESSION_MS);
    }
    if (canceled && viewport) {
      const active = this.slideElements()[this.normalizedIndex()];
      if (active)
        this.scrollByAxis(
          viewport,
          this.axisOffsetOf(active, viewport),
          "smooth"
        );
    } else if (!canceled) {
      this.onViewportScroll();
    }
    if (!this.matches(":hover")) this.pointerInteracting = false;
    this.restartAutoplay();
  }

  private cancelDrag(realign: boolean): void {
    if (this.dragPointerId === undefined) return;
    this.finishDrag(this.dragPointerId, realign);
  }

  private onViewportPointerUp = (event: PointerEvent): void => {
    this.finishDrag(event.pointerId, false);
  };

  private onViewportPointerCancel = (event: PointerEvent): void => {
    this.finishDrag(event.pointerId, true);
  };

  private onViewportLostPointerCapture = (event: PointerEvent): void => {
    this.finishDrag(event.pointerId, true);
  };

  private onViewportClick = (event: MouseEvent): void => {
    if (!this.suppressClick) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  };

  private onViewportKeyDown = (event: KeyboardEvent): void => {
    const vertical = this.effectiveOrientation() === "vertical";
    const rtl = this.effectiveDirection === "rtl";
    const forwardKey = vertical ? "ArrowDown" : rtl ? "ArrowLeft" : "ArrowRight";
    const backwardKey = vertical ? "ArrowUp" : rtl ? "ArrowRight" : "ArrowLeft";
    if (event.key === forwardKey) {
      event.preventDefault();
      this.next();
    } else if (event.key === backwardKey) {
      event.preventDefault();
      this.previous();
    } else if (event.key === "Home") {
      event.preventDefault();
      this.goToSlide(0);
    } else if (event.key === "End") {
      event.preventDefault();
      this.goToSlide(this.loop ? this.slideElements().length - 1 : this.maxStartIndex());
    }
  };

  private computedSlideBasis(perPage: number): string {
    if (perPage === 1) {
      return "100%";
    }
    return `calc(${100 / perPage}% - var(--slide-gap, var(--lr-space-m)))`;
  }

  override render(): TemplateResult {
    const count = this.slideElements().length;
    const current = this.normalizedIndex(count);
    const pageTargets = this.pageTargets(count);
    const currentPage = pageTargets.reduce(
      (nearest, target, pageIndex) =>
        Math.abs(target - current) <
        Math.abs(pageTargets[nearest]! - current)
          ? pageIndex
          : nearest,
      0
    );
    const hasNavigation =
      this.navigation && count > this.safeSlidesPerPage(count);
    const hasPagination = this.pagination && pageTargets.length > 1;
    const label =
      this.hostAccessibleLabel ||
      this.accessibleLabel ||
      this.localize("carouselLabel");
    const numberFormat = getNumberFormat(this.effectiveLocale);
    const orientation = this.effectiveOrientation();
    const perPage = this.safeSlidesPerPage(count);

    return html`<section
      part="base carousel"
      role="region"
      aria-roledescription=${this.localize("carousel")}
      aria-label=${label}
      data-orientation=${orientation}
      ?data-mouse-dragging=${this.mouseDragging}
      @pointerenter=${this.onViewportPointerEnter}
      @pointerleave=${this.onViewportPointerLeave}
      @focusin=${this.onViewportFocusIn}
      @focusout=${this.onViewportFocusOut}
    >
      <div
        part="viewport scroll-container"
        role="group"
        aria-label=${label}
        tabindex="0"
        aria-live=${this.autoplay && !this.reduceMotion ? "off" : "polite"}
        @keydown=${this.onViewportKeyDown}
        @scroll=${this.onViewportScroll}
        @scrollend=${this.onViewportScrollEnd}
        @wheel=${this.takeOverViewport}
        @touchstart=${this.takeOverViewport}
        @pointerdown=${this.onViewportPointerDown}
        @pointermove=${this.onViewportPointerMove}
        @pointerup=${this.onViewportPointerUp}
        @pointercancel=${this.onViewportPointerCancel}
        @lostpointercapture=${this.onViewportLostPointerCapture}
        @click=${this.onViewportClick}
      >
        <span class="scroll-hint-probe" aria-hidden="true"></span>
        <div
          part="track"
          style=${`--_lr-carousel-computed-slide-basis: ${this.computedSlideBasis(
            perPage
          )}`}
        >
          <span class="loop-clones" data-clone-set="before"></span>
          <slot @slotchange=${this.onSlotChange}></slot>
          <span class="loop-clones" data-clone-set="after"></span>
        </div>
      </div>
      ${hasNavigation || hasPagination
        ? html`<div part="controls">
            ${hasNavigation
              ? html`<div part="navigation">
                  <button
                    part="previous-button navigation-button navigation-button-previous navigation-button--previous"
                    type="button"
                    aria-label=${this.localize("previous")}
                    ?disabled=${!this.loop && current === 0}
                    @click=${() => this.previous()}
                  >
                    <span part="previous-glyph" aria-hidden="true"
                      ><slot name="previous-icon">‹</slot></span
                    >
                  </button>
                  <button
                    part="next-button navigation-button navigation-button-next navigation-button--next"
                    type="button"
                    aria-label=${this.localize("next")}
                    ?disabled=${!this.loop &&
                    current === this.maxStartIndex(count)}
                    @click=${() => this.next()}
                  >
                    <span part="next-glyph" aria-hidden="true"
                      ><slot name="next-icon">›</slot></span
                    >
                  </button>
                </div>`
              : nothing}
            ${hasPagination
              ? html`<div
                  part="indicators pagination"
                  role="group"
                  aria-label=${this.localize("carouselIndicators")}
                >
                  ${pageTargets.map(
                    (target, pageIndex) => html`<button
                      part=${pageIndex === currentPage
                        ? "indicator pagination-item pagination-item-active pagination-item--active"
                        : "indicator pagination-item"}
                      type="button"
                      aria-label=${this.localize("carouselGoTo", undefined, {
                        index: numberFormat.format(target + 1),
                      })}
                      aria-current=${pageIndex === currentPage
                        ? "true"
                        : "false"}
                      @click=${() => this.goToSlide(target)}
                    >
                      <span part="indicator-dot" aria-hidden="true"></span>
                    </button>`
                  )}
                </div>`
              : nothing}
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
