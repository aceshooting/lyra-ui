import { html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { property, query, state } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { finiteRange } from '../../../internal/numbers.js';
import type { LyraOrientation } from '../../../internal/shared-unions.js';
import { styles } from './scroller.styles.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_scrollNext, LYRA_DEFAULT_scrollPrevious, LYRA_DEFAULT_scrollerLabel } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END


export interface LyraScrollerEventMap {
  'lr-scroll': CustomEvent<{
    scrollStart: boolean;
    scrollEnd: boolean;
    scrollLeft: number;
    scrollTop: number;
  }>;
}

/**
 * `<lr-scroller>` — a responsive overflow surface with optional previous
 * and next controls. Content remains in the default slot, so cards, tabs, and
 * any consumer-owned interactive elements retain their own semantics.
 *
 * @customElement lr-scroller
 * @slot - Scrollable content.
 * @event lr-scroll - The scroll position or available edge changed. Scroll-driven emissions are
 *   coalesced through one `requestAnimationFrame` tick, so a fling that fires dozens of native
 *   `scroll` events produces at most one of these per frame — the same contract
 *   `<lr-virtual-list>`'s identically-named event already carries.
 * @csspart base - The overall scroller layout.
 * @csspart viewport - The native scroll container.
 * @csspart content - The slotted content wrapper.
 * @csspart start-shadow - Logical-start overflow cue.
 * @csspart end-shadow - Logical-end overflow cue.
 * @csspart previous - The previous/start control.
 * @csspart next - The next/end control.
 * @csspart control - Shared part on both `previous` and `next`.
 * @csspart previous-glyph - The chevron glyph inside `previous`, mirrored under RTL.
 * @csspart next-glyph - The chevron glyph inside `next`, mirrored under RTL.
 * @cssprop [--lr-scroller-control-size=var(--lr-size-2rem)] - Control size.
 * @cssprop [--lr-scroller-min-block-size=var(--lr-size-10rem)] - Minimum vertical scroller size.
 * @cssprop [--shadow-color=var(--lr-color-surface)] - Base color of each edge shadow.
 * @cssprop [--shadow-size=var(--lr-size-2rem)] - Inline/block extent of each edge shadow.
 * @cssprop [--lr-scroller-shadow-color=var(--shadow-color)] - Lyra-prefixed shadow-color alias.
 * @cssprop [--lr-scroller-shadow-size=var(--shadow-size)] - Lyra-prefixed shadow-size alias.
 * @status stable
 * @since 4.0.0
 */
export class LyraScroller extends LyraElement<LyraScrollerEventMap> {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    scrollNext: LYRA_DEFAULT_scrollNext,
    scrollPrevious: LYRA_DEFAULT_scrollPrevious,
    scrollerLabel: LYRA_DEFAULT_scrollerLabel,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  static override styles = [LyraElement.styles, styles];

  @property({ reflect: true }) orientation: LyraOrientation = 'horizontal';
  @property({ type: Boolean, reflect: true }) controls = false;
  /** Hides the native scrollbar while preserving scrolling. */
  @property({ type: Boolean, attribute: 'without-scrollbar', reflect: true })
  withoutScrollbar = false;
  /** Removes both visual edge cues while leaving native scrolling untouched. */
  @property({ type: Boolean, attribute: 'without-shadow', reflect: true })
  withoutShadow = false;
  @property({ type: Number, attribute: 'scroll-step' }) scrollStep = 0;
  @property() label = '';

  @state() private canScrollStart = false;
  @state() private canScrollEnd = false;
  @state() private measured = false;
  @query('[part="viewport"]') private viewport?: HTMLElement;
  @query('[part="content"]') private content?: HTMLElement;
  private resizeObserver?: ResizeObserver;
  private resizeObserverDocument?: Document;
  private ownerRealmGeneration = 0;

  override connectedCallback(): void {
    super.connectedCallback();
    this.armResizeObserver();
    // A reconnect (move in the DOM) re-creates the observer above but the shadow-root content
    // survives across disconnect/reconnect (Lit doesn't tear it down) -- re-observe the viewport
    // here too when it already exists. `firstUpdated()` only ever runs once, on the very first
    // render, so it can't be relied on for a reconnect; on the very first connect `this.viewport`
    // (a `@query`) isn't resolved yet, so `firstUpdated()` below still does that initial observe.
  }

  override firstUpdated(changed: PropertyValues): void {
    super.firstUpdated(changed);
    this.armResizeObserver();
    this.scheduleEdgeUpdate();
  }

  override disconnectedCallback(): void {
    this.resetOwnerRealmWork();
    super.disconnectedCallback();
  }

  override adoptedCallback(): void {
    super.adoptedCallback();
    this.resetOwnerRealmWork();
  }

  private armResizeObserver(): void {
    const ownerDocument = this.ownerDocument;
    if (!this.isConnected) return;
    if (this.resizeObserver && this.resizeObserverDocument === ownerDocument) {
      if (this.viewport) this.resizeObserver.observe(this.viewport);
      if (this.content) this.resizeObserver.observe(this.content);
      return;
    }
    this.resizeObserver?.disconnect();
    this.resizeObserver = undefined;
    this.resizeObserverDocument = undefined;
    const ResizeObserverCtor = ownerDocument.defaultView?.ResizeObserver;
    if (!ResizeObserverCtor) return;
    const generation = this.ownerRealmGeneration;
    const observer = new ResizeObserverCtor(() => {
      if (
        this.resizeObserver !== observer ||
        this.resizeObserverDocument !== ownerDocument ||
        this.ownerRealmGeneration !== generation ||
        !this.isConnected ||
        this.ownerDocument !== ownerDocument
      ) {
        return;
      }
      this.updateEdges();
    });
    this.resizeObserver = observer;
    this.resizeObserverDocument = ownerDocument;
    observer.observe(this);
    if (this.viewport) observer.observe(this.viewport);
    if (this.content) observer.observe(this.content);
  }

  private resetOwnerRealmWork(): void {
    this.ownerRealmGeneration += 1;
    this.cancelScrollFrame();
    this.resizeObserver?.disconnect();
    this.resizeObserver = undefined;
    this.resizeObserverDocument = undefined;
    this.measured = false;
  }

  private scheduleEdgeUpdate(): void {
    const ownerDocument = this.ownerDocument;
    const ownerWindow = ownerDocument.defaultView;
    if (!ownerWindow || !this.isConnected) return;
    const generation = this.ownerRealmGeneration;
    ownerWindow.queueMicrotask(() => {
      if (
        this.ownerRealmGeneration !== generation ||
        !this.isConnected ||
        this.ownerDocument !== ownerDocument
      ) {
        return;
      }
      this.updateEdges();
    });
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    if (changed.has('orientation') || changed.has('controls'))
      this.scheduleEdgeUpdate();
  }

  private edgeDetail() {
    const viewport = this.viewport;
    if (!viewport)
      return {
        scrollStart: false,
        scrollEnd: false,
        scrollLeft: 0,
        scrollTop: 0,
      };
    const horizontal = this.orientation === 'horizontal';
    const max = horizontal
      ? Math.max(0, viewport.scrollWidth - viewport.clientWidth)
      : Math.max(0, viewport.scrollHeight - viewport.clientHeight);
    const position = horizontal ? viewport.scrollLeft : viewport.scrollTop;
    const rtl = horizontal && this.effectiveDirection === 'rtl';
    // Per the CSSOM View spec (what every browser this library targets actually implements),
    // scrollLeft in RTL runs 0 (inline-start) down to -max (inline-end) -- not the legacy WebKit
    // convention of max down to 0. Negating (rather than `max - position`) normalizes it back to the
    // same "distance from inline-start" the LTR branch already computes.
    const startPosition = rtl ? -position : position;
    return {
      scrollStart: startPosition <= 1,
      scrollEnd: startPosition >= max - 1,
      scrollLeft: viewport.scrollLeft,
      scrollTop: viewport.scrollTop,
    };
  }

  private updateEdges = (): void => this.syncEdges(false);

  private syncEdges(emitForPositionChange: boolean): void {
    const detail = this.edgeDetail();
    const changed =
      !this.measured ||
      detail.scrollStart !== this.canScrollStart ||
      detail.scrollEnd !== this.canScrollEnd;
    this.measured = true;
    this.canScrollStart = detail.scrollStart;
    this.canScrollEnd = detail.scrollEnd;
    if (changed || emitForPositionChange) this.emit('lr-scroll', detail);
  }

  // Coalesce to one edge read + one `lr-scroll` dispatch per animation frame. Native `scroll`
  // events fire far faster than that during a trackpad/touch fling, and each tick otherwise cost a
  // full scrollWidth/clientWidth/scrollLeft layout read plus a CustomEvent dispatch. The sibling
  // `<lr-virtual-list>` already contracts its identically-named `lr-scroll` this way, so the two
  // now share one firing rule. Realm-guarded like every other deferred callback here: a scroller
  // adopted into (or removed from) another document drops the pending frame instead of reading a
  // stale viewport.
  private scrollFrame?: number;
  private scrollFrameWindow?: Window;

  private cancelScrollFrame(): void {
    if (this.scrollFrame !== undefined) this.scrollFrameWindow?.cancelAnimationFrame(this.scrollFrame);
    this.scrollFrame = undefined;
    this.scrollFrameWindow = undefined;
  }

  private onScroll = (): void => {
    if (this.scrollFrame !== undefined) return;
    const ownerDocument = this.ownerDocument;
    const ownerWindow = ownerDocument.defaultView;
    if (!ownerWindow || !this.isConnected) return;
    const generation = this.ownerRealmGeneration;
    const handle = ownerWindow.requestAnimationFrame(() => {
      if (
        this.scrollFrame !== handle ||
        this.scrollFrameWindow !== ownerWindow ||
        this.ownerRealmGeneration !== generation ||
        !this.isConnected ||
        this.ownerDocument !== ownerDocument
      ) {
        return;
      }
      this.scrollFrame = undefined;
      this.scrollFrameWindow = undefined;
      this.syncEdges(true);
    });
    this.scrollFrame = handle;
    this.scrollFrameWindow = ownerWindow;
  };

  private onSlotChange = (): void => {
    if (this.content) this.resizeObserver?.observe(this.content);
    this.scheduleEdgeUpdate();
  };

  /** `scrollStep` normalized to a finite, non-negative override amount before
   *  `scrollByDirection()`'s `> 0` gate below -- only a positive value overrides the
   *  viewport-percentage-based default there; zero, negative, or non-finite already falls through
   *  to that default via the comparison, so this just makes the normalization explicit instead of
   *  relying on incidental NaN/negative comparison semantics. */
  private get safeScrollStep(): number {
    return finiteRange(this.scrollStep, 0, 0);
  }

  private scrollByDirection(direction: -1 | 1): void {
    const viewport = this.viewport;
    if (!viewport) return;
    const horizontal = this.orientation === 'horizontal';
    const step = this.safeScrollStep;
    const amount =
      step > 0
        ? step
        : horizontal
        ? Math.max(1, viewport.clientWidth * 0.8)
        : Math.max(1, viewport.clientHeight * 0.8);
    const physicalDirection =
      horizontal && this.effectiveDirection === 'rtl' ? -direction : direction;
    viewport.scrollBy(
      horizontal
        ? { left: amount * physicalDirection }
        : { top: amount * direction }
    );
  }

  private scrollToEdge(edge: 'start' | 'end'): void {
    const viewport = this.viewport;
    if (!viewport) return;
    const horizontal = this.orientation === 'horizontal';
    if (horizontal) {
      const max = Math.max(0, viewport.scrollWidth - viewport.clientWidth);
      const rtl = this.effectiveDirection === 'rtl';
      viewport.scrollTo({ left: edge === 'start' ? 0 : rtl ? -max : max });
    } else {
      viewport.scrollTo({ top: edge === 'start' ? 0 : viewport.scrollHeight });
    }
  }

  override render(): TemplateResult {
    const label =
      this.getAttribute('aria-label') ??
      (this.label || this.localize('scrollerLabel'));
    const vertical = this.orientation === 'vertical';
    return html`<div part="base">
      ${this.controls
        ? html`<button
            part="control previous"
            type="button"
            aria-label=${this.localize('scrollPrevious')}
            ?disabled=${!this.measured || this.canScrollStart}
            @click=${() => this.scrollByDirection(-1)}
            @dblclick=${() => this.scrollToEdge('start')}
          >
            ${vertical
              ? html`<span part="previous-glyph" aria-hidden="true">↑</span>`
              : html`<span part="previous-glyph" aria-hidden="true">‹</span>`}
          </button>`
        : nothing}
      <div class="viewport-wrap">
        <span
          part="start-shadow"
          aria-hidden="true"
          ?hidden=${!this.measured || this.withoutShadow || this.canScrollStart}
        ></span>
        <div
          part="viewport"
          role="region"
          aria-label=${label}
          tabindex="0"
          @scroll=${this.onScroll}
        >
          <div part="content"><slot @slotchange=${this.onSlotChange}></slot></div>
        </div>
        <span
          part="end-shadow"
          aria-hidden="true"
          ?hidden=${!this.measured || this.withoutShadow || this.canScrollEnd}
        ></span>
      </div>
      ${this.controls
        ? html`<button
            part="control next"
            type="button"
            aria-label=${this.localize('scrollNext')}
            ?disabled=${!this.measured || this.canScrollEnd}
            @click=${() => this.scrollByDirection(1)}
            @dblclick=${() => this.scrollToEdge('end')}
          >
            ${vertical
              ? html`<span part="next-glyph" aria-hidden="true">↓</span>`
              : html`<span part="next-glyph" aria-hidden="true">›</span>`}
          </button>`
        : nothing}
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-scroller': LyraScroller;
  }
}
