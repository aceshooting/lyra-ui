import { html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { property, query, state } from 'lit/decorators.js';
import { LyraElement } from '../../internal/lyra-element.js';
import { styles } from './scroller.styles.js';

export type ScrollerOrientation = 'horizontal' | 'vertical';

export interface LyraScrollerEventMap {
  'lyra-scroll': CustomEvent<{
    scrollStart: boolean;
    scrollEnd: boolean;
    scrollLeft: number;
    scrollTop: number;
  }>;
}

/**
 * `<lyra-scroller>` — a responsive overflow surface with optional previous
 * and next controls. Content remains in the default slot, so cards, tabs, and
 * any consumer-owned interactive elements retain their own semantics.
 *
 * @customElement lyra-scroller
 * @slot - Scrollable content.
 * @event lyra-scroll - The scroll position or available edge changed.
 * @csspart base - The overall scroller layout.
 * @csspart viewport - The native scroll container.
 * @csspart content - The slotted content wrapper.
 * @csspart previous - The previous/start control.
 * @csspart next - The next/end control.
 * @cssprop --lyra-scroller-control-size - Control size.
 * @cssprop --lyra-scroller-min-block-size - Minimum vertical scroller size.
 */
export class LyraScroller extends LyraElement<LyraScrollerEventMap> {
  static styles = [LyraElement.styles, styles];

  @property({ reflect: true }) orientation: ScrollerOrientation = 'horizontal';
  @property({ type: Boolean, reflect: true }) controls = false;
  @property({ type: Boolean, attribute: 'hide-scrollbar', reflect: true }) hideScrollbar = false;
  @property({ type: Number, attribute: 'scroll-step' }) scrollStep = 0;
  @property() label = '';

  @state() private canScrollStart = false;
  @state() private canScrollEnd = false;
  @query('[part="viewport"]') private viewport?: HTMLElement;
  private resizeObserver?: ResizeObserver;

  firstUpdated(): void {
    this.resizeObserver = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(this.updateEdges);
    this.resizeObserver?.observe(this);
    this.resizeObserver?.observe(this.viewport!);
    queueMicrotask(this.updateEdges);
  }

  disconnectedCallback(): void {
    this.resizeObserver?.disconnect();
    this.resizeObserver = undefined;
    super.disconnectedCallback();
  }

  protected updated(changed: PropertyValues): void {
    if (changed.has('orientation') || changed.has('controls')) queueMicrotask(this.updateEdges);
  }

  private edgeDetail() {
    const viewport = this.viewport;
    if (!viewport) return { scrollStart: false, scrollEnd: false, scrollLeft: 0, scrollTop: 0 };
    const horizontal = this.orientation === 'horizontal';
    const max = horizontal ? Math.max(0, viewport.scrollWidth - viewport.clientWidth) : Math.max(0, viewport.scrollHeight - viewport.clientHeight);
    const position = horizontal ? viewport.scrollLeft : viewport.scrollTop;
    const rtl = horizontal && this.effectiveDirection === 'rtl';
    const startPosition = rtl ? max - position : position;
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
    if (changed) this.emit('lyra-scroll', detail);
  };

  private onScroll = (): void => this.updateEdges();

  private scrollByDirection(direction: -1 | 1): void {
    const viewport = this.viewport;
    if (!viewport) return;
    const horizontal = this.orientation === 'horizontal';
    const amount = this.scrollStep > 0
      ? this.scrollStep
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
      viewport.scrollTo({ left: edge === 'start' ? (rtl ? max : 0) : (rtl ? 0 : max) });
    } else {
      viewport.scrollTo({ top: edge === 'start' ? 0 : viewport.scrollHeight });
    }
  }

  render(): TemplateResult {
    const label = this.label || this.getAttribute('aria-label') || this.localize('scrollerLabel');
    const vertical = this.orientation === 'vertical';
    return html`<div part="base" role="region" aria-label=${label}>
      ${this.controls ? html`<button part="control previous" type="button" aria-label=${this.localize('scrollPrevious')} ?disabled=${this.canScrollStart} @click=${() => this.scrollByDirection(-1)} @dblclick=${() => this.scrollToEdge('start')}>${vertical ? '↑' : html`<span part="previous-glyph" aria-hidden="true">‹</span>`}</button>` : nothing}
      <div part="viewport" tabindex="0" @scroll=${this.onScroll}><div part="content"><slot @slotchange=${this.updateEdges}></slot></div></div>
      ${this.controls ? html`<button part="control next" type="button" aria-label=${this.localize('scrollNext')} ?disabled=${this.canScrollEnd} @click=${() => this.scrollByDirection(1)} @dblclick=${() => this.scrollToEdge('end')}>${vertical ? '↓' : html`<span part="next-glyph" aria-hidden="true">›</span>`}</button>` : nothing}
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lyra-scroller': LyraScroller;
  }
}
