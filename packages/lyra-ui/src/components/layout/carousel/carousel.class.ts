import { html, nothing, type PropertyValues, type TemplateResult } from "lit";
import { property, query } from "lit/decorators.js";
import {
  acquireAnnouncementSink,
  type AnnouncementSink,
} from "../../../internal/announcer.js";
import {
  isAccessibilitySubtreeExcluded,
  isAccessibilityVisible,
  isAccessibilityVisibilityHidden,
} from "../../../internal/accessibility-visibility.js";
import { activeElementIn, deepActiveElementIn } from "../../../internal/active-element.js";
import { composedAccessibilityText } from "../../../internal/announcement-text.js";
import { renderInertPresentation } from "../../../internal/inert-presentation.js";
import { LyraElement } from "../../../internal/lyra-element.js";
import { finiteDuration, finiteInteger } from "../../../internal/numbers.js";
import { composedContains } from "../../../internal/overlay-manager.js";
import { getNumberFormat } from "../../../internal/intl-cache.js";
import { tag } from "../../../internal/prefix.js";
import { styles } from "./carousel.styles.js";
import type { LyraCarouselItem } from "./carousel-item.class.js";
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_carousel, LYRA_DEFAULT_carouselGoTo, LYRA_DEFAULT_carouselIndicators, LYRA_DEFAULT_carouselLabel, LYRA_DEFAULT_carouselSlide, LYRA_DEFAULT_carouselSlideAnnouncement, LYRA_DEFAULT_carouselSlideAnnouncementSeparator, LYRA_DEFAULT_carouselSlidePosition, LYRA_DEFAULT_next, LYRA_DEFAULT_previous } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END


interface SlideSnapshot {
  hidden: boolean | "until-found";
  inert: boolean;
  role: string | null;
  label: string | null;
  roleDescription: string | null;
  ariaHidden: string | null;
}

interface RestingSlide {
  element: HTMLElement;
  index: number;
  cloneSide?: "before" | "after";
}

type CarouselChangeOrigin = "manual" | "autoplay";

export type LyraCarouselOrientation = "horizontal" | "vertical";

const LOOP_SNAPSHOT_UNSAFE_TAGS = new Set([
  "audio",
  "canvas",
  "embed",
  "form",
  "iframe",
  "img",
  "input",
  "link",
  "object",
  "picture",
  "script",
  "select",
  "source",
  "style",
  "textarea",
  "track",
  "video",
]);
const CAROUSEL_MANAGED_SLIDE_ATTRIBUTES = new Set([
  "aria-hidden",
  "aria-label",
  "aria-roledescription",
  "hidden",
  "inert",
  "role",
]);
const SLIDE_SNAPSHOT_KEYS = [
  "hidden",
  "inert",
  "role",
  "label",
  "roleDescription",
  "ariaHidden",
] as const satisfies readonly (keyof SlideSnapshot)[];

export interface LyraCarouselEventMap {
  "lr-slide-change": CustomEvent<{ index: number; slide: HTMLElement }>;
}

/**
 * `<lr-carousel>` — a scroll-snap carousel for arbitrary slotted content. Its Web Awesome and
 * Shoelace-compatible surface supports optional navigation and pagination, multiple slides per
 * page, horizontal or vertical movement, autoplay, looping, and opt-in mouse dragging.
 * Manual active-page changes are announced through a pre-mounted light-DOM live region even while
 * autoplay is enabled. Only timer-driven advances stay silent, and neither initial connection nor
 * reconnection replays the current page. Changes made while the carousel or a composed ancestor is
 * accessibility-hidden stay silent. Subtree-pruned slide content is omitted; a visibility-hidden
 * wrapper may still expose a descendant that explicitly restores visibility. Forwarding slots
 * contribute their flattened assigned content; their fallback contributes only when the slot has
 * no direct assignment, even when an assignment is itself accessibility-hidden. The localized
 * `carouselSlideAnnouncement` and `carouselSlideAnnouncementSeparator` messages control the order,
 * punctuation, and separation of spoken position/content summaries.
 * Assigned slide semantics remain author-owned after connection: later `role`, `aria-label`,
 * `aria-roledescription`, `hidden`, `inert`, and `aria-hidden` changes persist through carousel
 * updates. Off-page slides are temporarily inert and aria-hidden, then regain their retained
 * author state when visible, unassigned, or disconnected.
 * Loop endcaps snapshot only side-effect-free plain HTML and stay synchronized with light-DOM
 * mutations. Slides containing custom elements, media/resources, form state, scripts, styles, or
 * non-HTML descendants use their original element for wrap alignment instead, so loop mode never
 * duplicates component lifecycles, network/playback owners, or stateful controls.
 *
 * @customElement lr-carousel
 * @slot - Slide elements. Each assigned element becomes one slide.
 * @slot next-icon - Optional decorative next-navigation icon. Its flattened subtree remains
 *   visible but is inert and hidden from assistive technology; the native button is the action.
 * @slot previous-icon - Optional decorative previous-navigation icon, with the same inert visual
 *   content contract as `next-icon`.
 * @event lr-slide-change - Active slide changed. `detail: { index, slide }`.
 * @attr {number} currentSlide - Web Awesome compatibility alias for `current-slide`; HTML
 *   normalizes it to `currentslide` at runtime. When both are present initially,
 *   `current-slide` wins.
 * @csspart base - Compatibility name for the carousel landmark; use `carousel`.
 * @csspart carousel - The carousel landmark. It is the same node as `base`.
 * @csspart scroll-container - The keyboard-focusable scroll-snap viewport.
 * @csspart track - Lyra extension wrapping the slotted slides and eligible inert loop snapshots.
 * @csspart controls - Lyra extension wrapping enabled navigation and pagination.
 * @csspart navigation - The previous/next navigation wrapper.
 * @csspart navigation-button - Shared navigation button part.
 * @csspart navigation-button-previous - Previous navigation button.
 * @csspart navigation-button-next - Next navigation button.
 * @csspart navigation-button--previous - Shoelace name for the previous navigation button.
 * @csspart navigation-button--next - Shoelace name for the next navigation button.
 * @csspart previous-glyph - Wrapper around the previous-icon slot.
 * @csspart next-glyph - Wrapper around the next-icon slot.
 * @csspart pagination - The pagination wrapper.
 * @csspart pagination-item - A pagination button.
 * @csspart pagination-item-active - The active pagination button.
 * @csspart pagination-item--active - Shoelace name for the active pagination button.
 * @csspart indicator-dot - Compact visible dot inside a pagination button.
 * @cssprop [--aspect-ratio=16/9] - Aspect ratio inherited by each slide.
 * @cssprop --scroll-hint - Logical padding that reveals the nearest adjacent slides.
 * @cssprop [--slide-gap=var(--lr-space-m)] - Gap between slides.
 * @cssprop [--lr-carousel-indicator-current-bg=var(--lr-color-brand-quiet)] - Active dot fill.
 * @cssprop [--lr-carousel-indicator-current-border-color=var(--lr-color-brand)] - Active dot border.
 * @cssprop [--lr-carousel-navigation-hover-bg=var(--lr-color-brand-quiet)] - Navigation hover background.
 * @cssprop [--lr-carousel-navigation-hover-border-color=var(--lr-color-brand)] - Navigation hover border.
 * @cssprop --lr-carousel-navigation-active-bg - Navigation pressed background; defaults to the
 *   former brand-quiet active mix.
 * @cssprop [--lr-carousel-navigation-active-border-color=var(--lr-color-brand)] - Navigation pressed border.
 * @cssprop [--lr-carousel-pagination-hover-bg=var(--lr-color-brand-quiet)] - Pagination-dot hover background.
 * @cssprop [--lr-carousel-pagination-hover-border-color=var(--lr-color-brand)] - Pagination-dot hover border.
 * @cssprop --lr-carousel-pagination-active-bg - Pagination-dot pressed background; defaults to the
 *   former brand-quiet active mix.
 * @cssprop [--lr-carousel-pagination-active-border-color=var(--lr-color-brand)] - Pagination-dot pressed border.
 * @cssprop --lr-carousel-slide-basis - Compatibility override for the computed per-page basis.
 * @status stable
 * @since 4.0.0
 */
export class LyraCarousel extends LyraElement<LyraCarouselEventMap> {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    carousel: LYRA_DEFAULT_carousel,
    carouselGoTo: LYRA_DEFAULT_carouselGoTo,
    carouselIndicators: LYRA_DEFAULT_carouselIndicators,
    carouselLabel: LYRA_DEFAULT_carouselLabel,
    carouselSlide: LYRA_DEFAULT_carouselSlide,
    carouselSlideAnnouncement: LYRA_DEFAULT_carouselSlideAnnouncement,
    carouselSlideAnnouncementSeparator: LYRA_DEFAULT_carouselSlideAnnouncementSeparator,
    carouselSlidePosition: LYRA_DEFAULT_carouselSlidePosition,
    next: LYRA_DEFAULT_next,
    previous: LYRA_DEFAULT_previous,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  static override styles = [LyraElement.styles, styles];

  static override get observedAttributes(): string[] {
    // Web Awesome publishes the mixed-case `currentSlide` spelling. HTML normalizes that token to
    // lowercase before custom-element observation, while Lyra keeps `current-slide` canonical.
    return [...new Set([...super.observedAttributes, "currentslide"])];
  }

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

  @property({ type: Boolean, reflect: true }) loop = false;
  @property({ type: Boolean, reflect: true }) autoplay = false;
  @property({ type: Number, attribute: "autoplay-interval", useDefault: true })
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

  @property({ useDefault: true }) orientation: LyraCarouselOrientation = "horizontal";
  @property({ type: Boolean, attribute: "mouse-dragging", reflect: true })
  mouseDragging = false;
  @property({ type: Number, attribute: "slides-per-page", useDefault: true }) slidesPerPage = 1;
  @property({ type: Number, attribute: "slides-per-move", useDefault: true }) slidesPerMove = 1;
  /** Live count of assigned slides.
   * @default 0 */
  get slides(): number {
    return this._slides;
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
  private timerWindow?: Window;
  private reduceMotion = false;
  private mediaQuery?: MediaQueryList;
  private visibilityDocument?: Document;
  private readonly snapshots = new Map<HTMLElement, SlideSnapshot>();
  private readonly appliedSnapshots = new WeakMap<
    HTMLElement,
    SlideSnapshot
  >();
  private settleTimer?: number;
  private settleTimerWindow?: Window;
  private adoptingScrolledSlide = false;
  private hasAlignedOnce = false;
  private alignIndex?: number;
  private alignTarget?: HTMLElement;
  private requestedBehavior?: ScrollBehavior;
  private loopSide?: "before" | "after";
  private loopClonesDirty = true;
  private pointerInteracting = false;
  private focusInteracting = false;
  private dragPointerId?: number;
  private dragStartCoordinate = 0;
  private dragStartScroll = 0;
  private dragMoved = false;
  private suppressClick = false;
  private clickTimer?: number;
  private clickTimerWindow?: Window;
  private announcementSink?: AnnouncementSink;
  private announcementsArmed = false;
  private changeOrigin: CarouselChangeOrigin = "manual";
  private manualPending = false;
  private observer?: MutationObserver;
  private observerDocument?: Document;
  private observerGeneration = 0;
  private lastFocusedSlide?: HTMLElement;

  constructor() {
    super();
    // Accessor-backed defaults do not pass through a class-field setter. Seed their first
    // reflection explicitly so the accessor-backed reactive defaults honor the same contract
    // contract as ordinary Lit fields without duplicating their state.
    this.requestUpdate("currentSlide", undefined);
    this.requestUpdate("pagination", undefined);
  }

  override attributeChangedCallback(
    name: string,
    oldValue: string | null,
    newValue: string | null
  ): void {
    if (name === "currentslide") {
      if (oldValue !== newValue) {
        this.currentSlide = finiteInteger(Number(newValue ?? 0), 0);
      }
      return;
    }
    super.attributeChangedCallback(name, oldValue, newValue);
    if (
      name === "current-slide" &&
      newValue === null &&
      oldValue !== newValue &&
      this.hasAttribute("currentslide")
    ) {
      this.currentSlide = finiteInteger(Number(this.getAttribute("currentslide") ?? 0), 0);
    }
  }

  override connectedCallback(): void {
    // Attribute reaction order follows author order. Make the canonical Lyra spelling win on the
    // initial dual-spelling case regardless of how the two attributes were ordered in markup.
    if (this.hasAttribute("current-slide")) {
      this.currentSlide = finiteInteger(Number(this.getAttribute("current-slide") ?? 0), 0);
    }
    super.connectedCallback();
    const view = this.ownerDocument.defaultView;
    this.announcementSink ??= acquireAnnouncementSink("polite", {
      document: this.ownerDocument,
      source: this,
    });
    this.announcementsArmed = false;
    this.manualPending = false;
    this.mediaQuery =
      typeof view?.matchMedia === "function"
        ? view.matchMedia("(prefers-reduced-motion: reduce)")
        : undefined;
    this.reduceMotion = this.mediaQuery?.matches ?? false;
    this.mediaQuery?.addEventListener("change", this.onMotionPreferenceChange);
    this.visibilityDocument = this.ownerDocument;
    this.visibilityDocument.addEventListener(
      "visibilitychange",
      this.onVisibilityChange
    );
    this.armSlideContentObserver();
    this.restartAutoplay();
    if (this.hasUpdated) {
      this.queueOwnerMicrotask(() => {
        if (!this.isConnected) return;
        this.handleSlidesChanged();
      });
    }
  }

  override disconnectedCallback(): void {
    this.announcementSink?.release();
    this.announcementSink = undefined;
    this.announcementsArmed = false;
    this.manualPending = false;
    this.cancelDrag(false);
    this.stopAutoplay();
    this.cancelScrollSettle();
    this.cancelClickSuppression();
    this.suppressClick = false;
    this.pointerInteracting = false;
    this.focusInteracting = false;
    this.hasAlignedOnce = false;
    this.clearAlignment();
    this.mediaQuery?.removeEventListener(
      "change",
      this.onMotionPreferenceChange
    );
    this.mediaQuery = undefined;
    this.visibilityDocument?.removeEventListener(
      "visibilitychange",
      this.onVisibilityChange
    );
    this.visibilityDocument = undefined;
    this.resetSlideContentObserver();
    this.restoreSlides();
    this.lastFocusedSlide = undefined;
    super.disconnectedCallback();
  }

  private armSlideContentObserver(): void {
    const ownerDocument = this.ownerDocument;
    const MutationObserverCtor = ownerDocument.defaultView?.MutationObserver;
    if (!MutationObserverCtor || !this.isConnected) return;
    this.resetSlideContentObserver();
    const generation = this.observerGeneration;
    const observer = new MutationObserverCtor((records) => {
      if (
        this.observer !== observer ||
        this.observerDocument !== ownerDocument ||
        this.observerGeneration !== generation ||
        !this.isConnected ||
        this.ownerDocument !== ownerDocument
      ) {
        return;
      }
      const snapshotChanged = records.some((record) => {
        if (record.type !== "attributes") return true;
        if (record.target === this) return false;
        if (
          !CAROUSEL_MANAGED_SLIDE_ATTRIBUTES.has(
            record.attributeName ?? ""
          )
        ) {
          return true;
        }
        const slide = record.target as HTMLElement;
        const snapshot = this.snapshots.get(slide);
        return snapshot
          ? this.adoptChanges(slide, snapshot)
          : false;
      });
      if (!snapshotChanged) return;
      if (this.loop) this.loopClonesDirty = true;
      this.syncSlides();
      this.requestUpdate();
    });
    this.observer = observer;
    this.observerDocument = ownerDocument;
    observer.observe(this, {
      attributes: true,
      characterData: true,
      childList: true,
      subtree: true,
    });
  }

  private resetSlideContentObserver(): void {
    this.observerGeneration += 1;
    this.observer?.disconnect();
    this.observer = undefined;
    this.observerDocument = undefined;
  }

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed);
    if (
      (changed.has("currentSlide") ||
        changed.has("slidesPerPage")) &&
      this.slideSlot
    ) {
      const normalized = this.normalizedIndex();
      if (this.currentSlide !== normalized) this.currentSlide = normalized;
    }
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    const shouldAnnounceActivePage =
      this.announcementsArmed &&
      (this.manualPending || changed.has("slidesPerPage"));
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
        changed.has("slidesPerPage") ||
        changed.has("orientation") ||
        !this.hasAlignedOnce)
    ) {
      this.alignToActiveSlide();
    }
    this.hasAlignedOnce = true;
    if (shouldAnnounceActivePage) this.announceActivePage();
    this.manualPending = false;
    this.announcementsArmed = true;
  }

  private setCurrentSlideState(value: number): void {
    const old = this._currentSlide;
    const next = finiteInteger(value, 0);
    if (old === next) return;
    this._currentSlide = next;
    if (this.changeOrigin === "manual") {
      this.manualPending = true;
    }
    this.requestUpdate("currentSlide", old);
  }

  private setPaginationState(value: boolean): void {
    const old = this._pagination;
    if (old === value) return;
    this._pagination = value;
    this.requestUpdate("pagination", old);
  }

  private onMotionPreferenceChange = (event: MediaQueryListEvent): void => {
    this.reduceMotion = event.matches;
    this.restartAutoplay();
    this.requestUpdate();
  };

  private onVisibilityChange = (): void => {
    this.restartAutoplay();
  };

  private queueOwnerMicrotask(callback: () => void): void {
    const view = this.ownerDocument.defaultView;
    if (view) view.queueMicrotask(callback);
    else queueMicrotask(callback);
  }

  private effectiveOrientation(): LyraCarouselOrientation {
    return this.orientation === "vertical" ? "vertical" : "horizontal";
  }

  private slideElements(): HTMLElement[] {
    return (this.slideSlot?.assignedElements({ flatten: true }) ?? []).filter(
      (element): element is HTMLElement =>
        element.nodeType === 1 &&
        element.namespaceURI === "http://www.w3.org/1999/xhtml"
    );
  }

  private pageSize(count = this.slideElements().length): number {
    return finiteInteger(this.slidesPerPage, 1, 1, Math.max(1, count));
  }

  private moveSize(count = this.slideElements().length): number {
    return finiteInteger(
      this.slidesPerMove,
      1,
      1,
      this.pageSize(count)
    );
  }

  private maxStartIndex(count = this.slideElements().length): number {
    return Math.max(0, count - this.pageSize(count));
  }

  private normalizedIndex(count = this.slideElements().length): number {
    if (count === 0) return 0;
    const max = this.loop ? count - 1 : this.maxStartIndex(count);
    return finiteInteger(this.currentSlide, 0, 0, max);
  }

  private pageTargets(count = this.slideElements().length): number[] {
    if (count === 0) return [];
    if (this.loop) return Array.from({ length: count }, (_unused, index) => index);
    const max = this.maxStartIndex(count);
    const move = this.moveSize(count);
    const targets: number[] = [0];
    for (let target = move; target < max; target += move) targets.push(target);
    if (max > 0 && targets.at(-1) !== max) targets.push(max);
    return targets;
  }

  private visibleIndices(count: number, current: number): Set<number> {
    const visible = new Set<number>();
    const perPage = this.pageSize(count);
    for (let offset = 0; offset < perPage; offset += 1) {
      const index = this.loop
        ? (current + offset) % count
        : current + offset;
      if (index >= 0 && index < count) visible.add(index);
    }
    return visible;
  }

  private announceActivePage(): void {
    if (!isAccessibilityVisible(this)) return;
    const slides = this.slideElements();
    if (slides.length === 0) return;
    const current = this.normalizedIndex(slides.length);
    const visible = this.visibleIndices(slides.length, current);
    const format = getNumberFormat(this.effectiveLocale);
    const messages = slides.flatMap((slide, index) => {
      if (!visible.has(index)) return [];
      if (isAccessibilitySubtreeExcluded(slide)) return [];
      const slideTextVisible = !isAccessibilityVisibilityHidden(slide);
      const authoredLabel = slideTextVisible
        ? this.snapshots.get(slide)?.label?.trim()
        : "";
      if (authoredLabel) return [authoredLabel];
      const position = this.localize("carouselSlidePosition", undefined, {
        index: format.format(index + 1),
        total: format.format(slides.length),
      });
      const content = Array.from(slide.childNodes)
        .map((node) => composedAccessibilityText(node, slideTextVisible))
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();
      if (!slideTextVisible && !content) return [];
      return [
        content && content !== position
          ? this.localize("carouselSlideAnnouncement", undefined, { position, content })
          : position,
      ];
    });
    this.announcementSink?.announce(
      messages.join(this.localize("carouselSlideAnnouncementSeparator"))
    );
  }

  private restoreAttribute(
    slide: HTMLElement,
    name: string,
    value: string | null
  ): void {
    if (value === null) slide.removeAttribute(name);
    else slide.setAttribute(name, value);
  }

  private snapshotSlide(slide: HTMLElement): SlideSnapshot {
    return {
      hidden: slide.hidden,
      inert: slide.inert,
      role: slide.getAttribute("role"),
      label: slide.getAttribute("aria-label"),
      roleDescription: slide.getAttribute("aria-roledescription"),
      ariaHidden: slide.getAttribute("aria-hidden"),
    };
  }

  private adoptChanges(
    slide: HTMLElement,
    snapshot: SlideSnapshot
  ): boolean {
    const applied = this.appliedSnapshots.get(slide);
    if (!applied) return false;
    const current = this.snapshotSlide(slide);
    let changed = false;
    for (const key of SLIDE_SNAPSHOT_KEYS) {
      if (current[key] !== applied[key]) {
        (snapshot as Record<keyof SlideSnapshot, unknown>)[key] = current[key];
        changed = true;
      }
    }
    return changed;
  }

  private restoreSlide(slide: HTMLElement, snapshot: SlideSnapshot): void {
    slide.hidden = snapshot.hidden;
    slide.inert = snapshot.inert;
    this.restoreAttribute(slide, "role", snapshot.role);
    this.restoreAttribute(slide, "aria-label", snapshot.label);
    this.restoreAttribute(
      slide,
      "aria-roledescription",
      snapshot.roleDescription
    );
    this.restoreAttribute(slide, "aria-hidden", snapshot.ariaHidden);
  }

  private restoreSlides(): void {
    for (const [slide, snapshot] of this.snapshots) {
      this.adoptChanges(slide, snapshot);
      this.restoreSlide(slide, snapshot);
    }
    this.snapshots.clear();
  }

  private syncSlides(): void {
    const slides = this.slideElements();
    const assigned = new Set(slides);
    for (const [slide, snapshot] of this.snapshots) {
      if (this.adoptChanges(slide, snapshot)) {
        this.loopClonesDirty = true;
      }
      if (!assigned.has(slide)) {
        this.restoreSlide(slide, snapshot);
        this.snapshots.delete(slide);
      }
    }
    const current = this.normalizedIndex(slides.length);
    if (this.currentSlide !== current) this.currentSlide = current;
    const visible = this.visibleIndices(slides.length, current);
    this.repairFocusBeforeSlideExclusion(slides, visible);
    const format = getNumberFormat(this.effectiveLocale);

    slides.forEach((slide, slideIndex) => {
      const existing = this.snapshots.get(slide);
      const snapshot = existing ?? this.snapshotSlide(slide);
      if (!existing) this.snapshots.set(slide, snapshot);

      if (slide.localName === tag("carousel-item")) {
        this.restoreAttribute(slide, "role", snapshot.role ?? "group");
        this.restoreAttribute(
          slide,
          "aria-roledescription",
          snapshot.roleDescription ?? this.localize("carouselSlide")
        );
        this.restoreAttribute(
          slide,
          "aria-label",
          snapshot.label ??
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
          snapshot.roleDescription
        );
        this.restoreAttribute(slide, "aria-label", snapshot.label);
      }

      slide.hidden = snapshot.hidden;
      if (visible.has(slideIndex)) {
        slide.inert = snapshot.inert;
        this.restoreAttribute(slide, "aria-hidden", snapshot.ariaHidden);
      } else {
        slide.inert = true;
        slide.setAttribute("aria-hidden", "true");
      }
      this.appliedSnapshots.set(slide, this.snapshotSlide(slide));
    });
  }

  /** Moves focus while the outgoing slide is still operable. Setting `inert` first lets the
   * platform strand focus on the document body, outside this carousel's keyboard handler. The
   * remembered-slide branch covers direct light-DOM removal, where slotchange necessarily runs
   * only after the focused node has already disconnected. */
  private repairFocusBeforeSlideExclusion(
    slides: HTMLElement[],
    visible: ReadonlySet<number>,
  ): void {
    const active = deepActiveElementIn(this.ownerDocument);
    const focusedIndex = slides.findIndex((slide) => composedContains(slide, active));
    const focusedSlideWillBeExcluded = focusedIndex >= 0 && !visible.has(focusedIndex);
    const focusedSlideWasRemoved =
      focusedIndex < 0 &&
      this.lastFocusedSlide !== undefined &&
      !this.lastFocusedSlide.isConnected &&
      (active === null || active === this.ownerDocument.body);
    if (!focusedSlideWillBeExcluded && !focusedSlideWasRemoved) return;
    this.viewport?.focus();
    this.lastFocusedSlide = undefined;
  }

  private handleSlidesChanged(): void {
    const count = this.slideElements().length;
    const active = activeElementIn(this.shadowRoot);
    if (active?.matches('[part~="pagination-item"]')) {
      const children = active.parentElement!.children;
      const pages = this.pageTargets(count).length;
      if (
        pages < 2 ||
        [...children].indexOf(active) >= pages
      )
        (pages > 1
          ? (children[pages - 1] as HTMLElement)
          : this.viewport
        )?.focus();
    } else if (
      active?.matches('[part~="navigation-button"]') &&
      (!this.navigation || count <= this.pageSize(count))
    ) {
      this.viewport?.focus();
    }
    if (this._slides !== count) {
      const previous = this._slides;
      this._slides = count;
      this.requestUpdate('slides', previous);
    }
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
  ): HTMLElement | undefined {
    const sourceElements = [
      original,
      ...Array.from(original.querySelectorAll<HTMLElement>("*")),
    ];
    if (
      sourceElements.some(
        (element) =>
          element.namespaceURI !== "http://www.w3.org/1999/xhtml" ||
          element.localName.includes("-") ||
          LOOP_SNAPSHOT_UNSAFE_TAGS.has(element.localName)
      )
    ) {
      return undefined;
    }
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
        this.pageSize(slides.length),
        this.moveSize(slides.length)
      )
    );
    const beforeStart = slides.length - cloneCount;
    for (let index = beforeStart; index < slides.length; index += 1) {
      const clone = this.prepareClone(slides[index]!, index, "before");
      if (clone) before.append(clone);
    }
    for (let index = 0; index < cloneCount; index += 1) {
      const clone = this.prepareClone(slides[index]!, index, "after");
      if (clone) after.append(clone);
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
    behavior: ScrollBehavior = "smooth",
    origin: CarouselChangeOrigin = "manual"
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
    this.loopSide = loopSide;
    const previousOrigin = this.changeOrigin;
    this.changeOrigin = origin;
    try {
      this.currentSlide = next;
    } finally {
      this.changeOrigin = previousOrigin;
    }
    this.emit("lr-slide-change", { index: next, slide: slides[next]! });
  }

  /** Moves forward by `slidesPerMove`. */
  next(behavior: ScrollBehavior = "smooth"): void {
    this.changeTo(this.currentSlide + this.moveSize(), behavior);
  }

  /** Moves backward by `slidesPerMove`. */
  previous(behavior: ScrollBehavior = "smooth"): void {
    this.changeTo(this.currentSlide - this.moveSize(), behavior);
  }

  /** Moves to the requested slide. */
  goToSlide(index: number, behavior: ScrollBehavior = "smooth"): void {
    this.changeTo(index, behavior);
  }

  /** Appends a carousel item. */
  addSlide(slide: LyraCarouselItem): void {
    if (
      slide?.nodeType !== 1 ||
      slide?.namespaceURI !== "http://www.w3.org/1999/xhtml"
    ) {
      return;
    }
    this.append(slide);
    this.queueOwnerMicrotask(() => {
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
    this.queueOwnerMicrotask(() => {
      if (this.isConnected) this.handleSlidesChanged();
    });
  }

  private stopAutoplay(): void {
    if (this.timer !== undefined) this.timerWindow?.clearInterval(this.timer);
    this.timer = undefined;
    this.timerWindow = undefined;
  }

  private restartAutoplay(): void {
    this.stopAutoplay();
    const count = this.slideElements().length;
    const doc = this.visibilityDocument ?? this.ownerDocument;
    const view = doc.defaultView;
    if (
      !this.isConnected ||
      !view ||
      !this.autoplay ||
      this.reduceMotion ||
      this.pointerInteracting ||
      this.focusInteracting ||
      this.dragPointerId !== undefined ||
      doc.visibilityState !== "visible" ||
      count <= this.pageSize(count)
    ) {
      return;
    }
    const interval = finiteDuration(this.autoplayInterval, 3000, 1000);
    this.timerWindow = view;
    this.timer = view.setInterval(() => {
      if (this.loop || this.currentSlide < this.maxStartIndex())
        this.changeTo(
          this.currentSlide + this.moveSize(),
          "smooth",
          "autoplay"
        );
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
    const loopSide = this.loopSide;
    const requestedBehavior = this.requestedBehavior;
    this.loopSide = undefined;
    this.requestedBehavior = undefined;
    const target = loopSide
      ? this.cloneFor(loopSide, targetIndex) ?? realSlide
      : realSlide;
    const offset = this.axisOffsetOf(target, viewport);
    if (Math.round(offset) === 0) {
      this.clearAlignment();
      return;
    }
    this.alignIndex = targetIndex;
    this.alignTarget = target;
    const behavior = this.motionAwareScrollBehavior(
      requestedBehavior ?? "smooth",
      true
    );
    this.scrollByAxis(viewport, offset, behavior);
  }

  private motionAwareScrollBehavior(
    requested: ScrollBehavior,
    instantBeforeFirstAlignment = false
  ): ScrollBehavior {
    return this.reduceMotion || (instantBeforeFirstAlignment && !this.hasAlignedOnce)
      ? "instant"
      : requested;
  }

  private cancelScrollSettle(): void {
    if (this.settleTimer !== undefined) {
      this.settleTimerWindow?.clearTimeout(this.settleTimer);
    }
    this.settleTimer = undefined;
    this.settleTimerWindow = undefined;
  }

  private onViewportScroll = (): void => {
    this.cancelScrollSettle();
    const view = this.ownerDocument.defaultView;
    if (!view) return;
    this.settleTimerWindow = view;
    this.settleTimer = view.setTimeout(
      this.settleScrolledSlide,
      120
    );
  };

  private onViewportScrollEnd = (): void => {
    this.cancelScrollSettle();
    this.settleScrolledSlide();
  };

  private clearAlignment(): void {
    this.alignTarget = undefined;
    this.alignIndex = undefined;
    this.loopSide = undefined;
    this.requestedBehavior = undefined;
  }

  private takeOverViewport(): void {
    this.clearAlignment();
  }

  private settleScrolledSlide = (): void => {
    this.settleTimer = undefined;
    this.settleTimerWindow = undefined;
    if (!this.isConnected) return;
    const viewport = this.viewport;
    if (!viewport) return;

    if (this.alignTarget) {
      if (Math.abs(this.axisOffsetOf(this.alignTarget, viewport)) > 2)
        return;
      const cloneSide = this.alignTarget.dataset["carouselClone"];
      if (cloneSide === "before" || cloneSide === "after") {
        const realSlide = this.slideElements()[this.alignIndex ?? -1];
        if (realSlide) {
          this.alignTarget = realSlide;
          this.scrollByAxis(
            viewport,
            this.axisOffsetOf(realSlide, viewport),
            "instant"
          );
          return;
        }
      }
      this.clearAlignment();
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

  private onViewportFocusIn = (event: FocusEvent): void => {
    this.focusInteracting = true;
    const slides = new Set(this.slideElements());
    const focusedSlide = event.composedPath().find(
      (candidate): candidate is HTMLElement =>
        (candidate as Partial<Node>).nodeType === 1 && slides.has(candidate as HTMLElement),
    );
    if (focusedSlide) this.lastFocusedSlide = focusedSlide;
    this.restartAutoplay();
  };

  private onViewportFocusOut = (): void => {
    this.queueOwnerMicrotask(() => {
      if (!this.isConnected) return;
      const active = deepActiveElementIn(this.ownerDocument);
      if (
        this.lastFocusedSlide &&
        !composedContains(this.lastFocusedSlide, active) &&
        (this.lastFocusedSlide.isConnected ||
          (active !== null && active !== this.ownerDocument.body))
      ) {
        this.lastFocusedSlide = undefined;
      }
      this.focusInteracting = this.matches(":focus-within");
      this.restartAutoplay();
    });
  };

  private onViewportPointerDown = (event: PointerEvent): void => {
    if (
      !this.mouseDragging ||
      event.pointerType !== "mouse" ||
      !event.isPrimary ||
      event.button !== 0 ||
      this.dragPointerId !== undefined ||
      this.pointerTargetsInteractiveContent(event)
    ) {
      return;
    }
    this.takeOverViewport();
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

  private pointerTargetsInteractiveContent(event: PointerEvent): boolean {
    const slides = new Set(this.slideElements());
    for (const target of event.composedPath()) {
      if (!(target instanceof Element)) continue;
      if (target === this || target === this.viewport || slides.has(target as HTMLElement)) continue;
      const name = target.localName;
      if (
        name === 'a' ||
        name === 'button' ||
        name === 'input' ||
        name === 'label' ||
        name === 'select' ||
        name === 'textarea' ||
        target.hasAttribute('contenteditable') ||
        (name.includes('-') && target.getRootNode() !== this.shadowRoot)
      ) return true;
      const role = target.getAttribute('role')?.trim().toLowerCase();
      if (role && ['button', 'checkbox', 'combobox', 'link', 'radio', 'slider', 'spinbutton', 'switch', 'textbox'].includes(role)) {
        return true;
      }
    }
    return false;
  }

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
      this.cancelClickSuppression();
      const view = this.ownerDocument.defaultView;
      if (!view) {
        this.suppressClick = false;
      } else {
        this.clickTimerWindow = view;
        this.clickTimer = view.setTimeout(() => {
          this.suppressClick = false;
          this.clickTimer = undefined;
          this.clickTimerWindow = undefined;
        }, 0);
      }
    }
    if (canceled && viewport) {
      const active = this.slideElements()[this.normalizedIndex()];
      if (active)
        this.scrollByAxis(
          viewport,
          this.axisOffsetOf(active, viewport),
          this.motionAwareScrollBehavior("smooth")
        );
    } else if (!canceled) {
      this.onViewportScroll();
    }
    if (!this.matches(":hover")) this.pointerInteracting = false;
    this.restartAutoplay();
  }

  private cancelClickSuppression(): void {
    if (this.clickTimer !== undefined) {
      this.clickTimerWindow?.clearTimeout(this.clickTimer);
    }
    this.clickTimer = undefined;
    this.clickTimerWindow = undefined;
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
    return `calc((100% - (${perPage - 1} * var(--slide-gap, var(--lr-space-m)))) / ${perPage})`;
  }

  override render(): TemplateResult {
    const count = this.slideElements().length;
    const current = this.normalizedIndex(count);
    const pageTargets = this.pageTargets(count);
    const exactCurrentPage = pageTargets.indexOf(current);
    const currentPage = exactCurrentPage >= 0
      ? exactCurrentPage
      : pageTargets.reduce(
          (nearest, target, pageIndex) =>
            Math.abs(target - current) < Math.abs(pageTargets[nearest]! - current)
              ? pageIndex
              : nearest,
          0,
        );
    const hasNavigation =
      this.navigation && count > this.pageSize(count);
    const hasPagination = this.pagination && pageTargets.length > 1;
    const label = this.hostAccessibleLabel !== null
      ? this.hostAccessibleLabel
      : this.accessibleLabel || this.localize("carouselLabel");
    const numberFormat = getNumberFormat(this.effectiveLocale);
    const orientation = this.effectiveOrientation();
    const perPage = this.pageSize(count);

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
        part="scroll-container"
        role="group"
        aria-label=${label}
        tabindex="0"
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
                    part="navigation-button navigation-button-previous navigation-button--previous"
                    type="button"
                    aria-label=${this.localize("previous")}
                    ?disabled=${!this.loop && current === 0}
                    @click=${() => this.previous()}
                  >
                    ${renderInertPresentation(
                      html`<slot name="previous-icon">‹</slot>`,
                      { part: "previous-glyph" },
                    )}
                  </button>
                  <button
                    part="navigation-button navigation-button-next navigation-button--next"
                    type="button"
                    aria-label=${this.localize("next")}
                    ?disabled=${!this.loop &&
                    current === this.maxStartIndex(count)}
                    @click=${() => this.next()}
                  >
                    ${renderInertPresentation(
                      html`<slot name="next-icon">›</slot>`,
                      { part: "next-glyph" },
                    )}
                  </button>
                </div>`
              : nothing}
            ${hasPagination
              ? html`<div
                  part="pagination"
                  role="group"
                  aria-label=${this.localize("carouselIndicators")}
                >
                  ${pageTargets.map(
                    (target, pageIndex) => html`<button
                      part=${pageIndex === currentPage
                        ? "pagination-item pagination-item-active pagination-item--active"
                        : "pagination-item"}
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
