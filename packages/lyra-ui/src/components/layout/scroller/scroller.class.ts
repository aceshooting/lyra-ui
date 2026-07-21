import { html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { property, query, state } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { finiteRange } from '../../../internal/numbers.js';
import { styles } from './scroller.styles.js';

export type ScrollerOrientation = 'horizontal' | 'vertical';

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
 * @event lr-scroll - The scroll position or available edge changed.
 * @csspart base - The overall scroller layout.
 * @csspart viewport - The native scroll container.
 * @csspart content - The slotted content wrapper.
 * @csspart previous - The previous/start control.
 * @csspart next - The next/end control.
 * @csspart control - Shared part on both `previous` and `next`.
 * @csspart previous-glyph - The chevron glyph inside `previous`, mirrored under RTL.
 * @csspart next-glyph - The chevron glyph inside `next`, mirrored under RTL.
 * @cssprop [--lr-scroller-control-size=var(--lr-size-2rem)] - Control size.
 * @cssprop [--lr-scroller-min-block-size=var(--lr-size-10rem)] - Minimum vertical scroller size.
 */
export class LyraScroller extends LyraElement<LyraScrollerEventMap> {
  static override styles = [LyraElement.styles, styles];

  @property({ reflect: true }) orientation: ScrollerOrientation = 'horizontal';
  @property({ type: Boolean, reflect: true }) controls = false;
  @property({ type: Boolean, attribute: 'hide-scrollbar', reflect: true }) hideScrollbar = false;
  @property({ type: Number, attribute: 'scroll-step' }) scrollStep = 0;
  @property() label = '';

  @state() private canScrollStart = false;
  @state() private canScrollEnd = false;
  @query('[part="viewport"]') private viewport?: HTMLElement;
  private resizeObserver?: ResizeObserver;

  override connectedCallback(): void {
    super.connectedCallback();
    this.resizeObserver = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(this.updateEdges);
    this.resizeObserver?.observe(this);
    // A reconnect (move in the DOM) re-creates the observer above but the shadow-root content
    // survives across disconnect/reconnect (Lit doesn't tear it down) -- re-observe the viewport
    // here too when it already exists. `firstUpdated()` only ever runs once, on the very first
    // render, so it can't be relied on for a reconnect; on the very first connect `this.viewport`
    // (a `@query`) isn't resolved yet, so `firstUpdated()` below still does that initial observe.
    if (this.viewport) this.resizeObserver?.observe(this.viewport);
  }

  override firstUpdated(): void {
    this.resizeObserver?.observe(this.viewport!);
    queueMicrotask(this.updateEdges);
  }

  override disconnectedCallback(): void {
    this.resizeObserver?.disconnect();
    this.resizeObserver = undefined;
    super.disconnectedCallback();
  }

  protected override updated(changed: PropertyValues): void {
    if (changed.has('orientation') || changed.has('controls')) queueMicrotask(this.updateEdges);
  }

  private edgeDetail() {
    const viewport = this.viewport;
    if (!viewport) return { scrollStart: false, scrollEnd: false, scrollLeft: 0, scrollTop: 0 };
    const horizontal = this.orientation === 'horizontal';
    const max = horizontal ? Math.max(0, viewport.scrollWidth - viewport.clientWidth) : Math.max(0, viewport.scrollHeight - viewport.clientHeight);
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

  private updateEdges = (): void => {
    const detail = this.edgeDetail();
    const changed = detail.scrollStart !== this.canScrollStart || detail.scrollEnd !== this.canScrollEnd;
    this.canScrollStart = detail.scrollStart;
    this.canScrollEnd = detail.scrollEnd;
    if (changed) this.emit('lr-scroll', detail);
  };

  private onScroll = (): void => this.updateEdges();

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
    const amount = step > 0
      ? step
      : horizontal ? Math.max(1, viewport.clientWidth * 0.8) : Math.max(1, viewport.clientHeight * 0.8);
    const physicalDirection = horizontal && this.effectiveDirection === 'rtl' ? -direction : direction;
    viewport.scrollBy(horizontal ? { left: amount * physicalDirection } : { top: amount * direction });
  }

  private scrollToEdge(edge: 'start' | 'end'): void {
    const viewport = this.viewport;
    if (!viewport) return;
    const horizontal = this.orientation === 'horizontal';
    if (horizontal) {
      const max = Math.max(0, viewport.scrollWidth - viewport.clientWidth);
      const rtl = this.effectiveDirection === 'rtl';
      viewport.scrollTo({ left: edge === 'start' ? 0 : (rtl ? -max : max) });
    } else {
      viewport.scrollTo({ top: edge === 'start' ? 0 : viewport.scrollHeight });
    }
  }

  override render(): TemplateResult {
    const label = this.label || this.getAttribute('aria-label') || this.localize('scrollerLabel');
    const vertical = this.orientation === 'vertical';
    return html`<div part="base">
      ${this.controls ? html`<button part="control previous" type="button" aria-label=${this.localize('scrollPrevious')} ?disabled=${this.canScrollStart} @click=${() => this.scrollByDirection(-1)} @dblclick=${() => this.scrollToEdge('start')}>${vertical ? html`<span part="previous-glyph" aria-hidden="true">↑</span>` : html`<span part="previous-glyph" aria-hidden="true">‹</span>`}</button>` : nothing}
      <div part="viewport" role="region" aria-label=${label} tabindex="0" @scroll=${this.onScroll}><div part="content"><slot @slotchange=${this.updateEdges}></slot></div></div>
      ${this.controls ? html`<button part="control next" type="button" aria-label=${this.localize('scrollNext')} ?disabled=${this.canScrollEnd} @click=${() => this.scrollByDirection(1)} @dblclick=${() => this.scrollToEdge('end')}>${vertical ? html`<span part="next-glyph" aria-hidden="true">↓</span>` : html`<span part="next-glyph" aria-hidden="true">›</span>`}</button>` : nothing}
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-scroller': LyraScroller;
  }
}
