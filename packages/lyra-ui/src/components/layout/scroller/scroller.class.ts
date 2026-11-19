import { isElementNode } from '../../../internal/dom-guards.js';
import { hostAriaLabel } from '../../../internal/a11y.js';
import { html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { property, query, state } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { declaredDefaultConverter } from '../../../internal/converters.js';
import { finiteRange } from '../../../internal/numbers.js';
import type { LyraOrientation } from '../../../internal/shared-unions.js';
import { styles } from './scroller.styles.js';
import { shadowFocusTarget } from '../../../internal/active-element.js';
import { OwnedResizeObserver } from '../../../internal/owned-observer.js';
import { OwnedFrame } from '../../../internal/owned-timer.js';
import { scrollEdgePosition } from '../../../internal/scroll-overflow.js';
import { shouldIgnoreNavigationKey } from '../../../internal/list-navigation.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_scrollNext, LYRA_DEFAULT_scrollPrevious, LYRA_DEFAULT_scrollerLabel } from '../../../internal/default-strings/layout.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END


const CONTAINED_KEYS = new Set([
  'Enter',
  ' ',
  'ArrowLeft',
  'ArrowRight',
  'ArrowUp',
  'ArrowDown',
  'Home',
  'End',
  'PageUp',
  'PageDown',
]);

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
 * @event lr-scroll - `detail: { scrollStart: boolean; scrollEnd: boolean; scrollLeft: number;
 *   scrollTop: number }` reports the scroll position and available edges. Scroll-driven emissions
 *   are coalesced through one `requestAnimationFrame` tick, so a fling that fires dozens of native
 *   `scroll` events produces at most one of these per frame.
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
 * @cssprop [--lr-scroller-gap=var(--lr-space-s)] - Space between scrolled items.
 * @cssprop [--lr-scroller-controls-gap=var(--lr-space-xs)] - Space between the viewport and controls.
 * @cssprop [--lr-scroller-control-hover-bg=var(--lr-color-brand-quiet)] - Previous/next hover fill.
 * @cssprop [--lr-scroller-control-active-bg=color-mix(in oklab, var(--lr-scroller-control-hover-bg, var(--lr-color-brand-quiet)), var(--lr-color-mix-partner) var(--lr-color-mix-active))] - Previous/next pressed fill.
 * @cssprop [--lr-scroller-control-size=var(--lr-size-2rem)] - Control size.
 * @cssprop [--lr-scroller-min-block-size=var(--lr-size-10rem)] - Minimum vertical scroller size.
 * @cssprop [--shadow-color=var(--lr-color-surface)] - Base color of each edge shadow.
 * @cssprop [--shadow-size=var(--lr-size-2rem)] - Inline/block extent of each edge shadow.
 * @cssprop [--lr-scroller-shadow-color=var(--shadow-color)] - Lyra-prefixed shadow-color alias.
 * @cssprop [--lr-scroller-shadow-size=var(--shadow-size)] - Lyra-prefixed shadow-size alias.
 * @cssprop [--lr-scroller-hover-outline-width=var(--lr-border-width-thin)] - Outline width of the
 *   mouse-hover preview on `[part="viewport"]`.
 * @cssprop [--lr-scroller-hover-outline-style=solid] - Outline style of the mouse-hover preview on
 *   `[part="viewport"]`.
 * @cssprop [--lr-scroller-hover-outline-color=var(--lr-color-border)] - Outline color of the
 *   mouse-hover preview on `[part="viewport"]`. Set to `transparent` to opt out of the hover
 *   treatment entirely.
 * @cssprop [--lr-scroller-hover-outline-offset=var(--lr-focus-ring-offset)] - Offset of the
 *   mouse-hover preview on `[part="viewport"]`.
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

  @property({ reflect: true, converter: declaredDefaultConverter<LyraOrientation>('horizontal') })
  orientation: LyraOrientation = 'horizontal';
  @property({ type: Boolean, reflect: true }) controls = false;
  /** Hides the native scrollbar while preserving scrolling. */
  @property({ type: Boolean, attribute: 'without-scrollbar', reflect: true })
  withoutScrollbar = false;
  /** Removes both visual edge cues while leaving native scrolling untouched. */
  @property({ type: Boolean, attribute: 'without-shadow', reflect: true })
  withoutShadow = false;
  @property({ type: Number, attribute: 'scroll-step' }) scrollStep = 0;
  @property() label = '';
  /** Accessible name of the scroll viewport. A present host aria-label takes precedence. */
  @property({ attribute: 'aria-label' }) accessibleLabel: string | null = null;

  @state() private atStart = false;
  @state() private atEnd = false;
  @state() private measured = false;
  @query('[part="viewport"]') private viewport?: HTMLElement;
  @query('[part="content"]') private content?: HTMLElement;
  private readonly resizeObserver = new OwnedResizeObserver(this, () => this.updateEdges());
  private readonly scrollFrame = new OwnedFrame(this);
  private ownerRealmGeneration = 0;
  private edgeUpdatePending = false;

  override connectedCallback(): void {
    super.connectedCallback();
    this.resizeObserver.resume();
    this.armResizeObserver();
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
    if (!this.isConnected) return;
    this.resizeObserver.observe(this);
    if (this.viewport) this.resizeObserver.observe(this.viewport);
    if (this.content) this.resizeObserver.observe(this.content);
  }

  private resetOwnerRealmWork(): void {
    this.ownerRealmGeneration += 1;
    this.edgeUpdatePending = false;
    this.scrollFrame.cancel();
    this.resizeObserver.disconnect();
    this.measured = false;
  }

  private scheduleEdgeUpdate(): void {
    const ownerDocument = this.ownerDocument;
    const ownerWindow = ownerDocument.defaultView;
    if (!ownerWindow || !this.isConnected || this.edgeUpdatePending) return;
    this.edgeUpdatePending = true;
    const generation = this.ownerRealmGeneration;
    ownerWindow.queueMicrotask(() => {
      if (
        this.ownerRealmGeneration !== generation ||
        !this.isConnected ||
        this.ownerDocument !== ownerDocument
      ) {
        return;
      }
      this.edgeUpdatePending = false;
      this.updateEdges();
    });
  }

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed);
    const active = this.hasUpdated ? shadowFocusTarget(this) : null;
    if (active?.matches('[part~="previous"]') ? this.atStart : active?.matches('[part~="next"]') && this.atEnd)
      this.viewport?.focus();
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
    const { atStart, atEnd } = scrollEdgePosition(
      viewport,
      horizontal,
      horizontal && this.effectiveDirection === 'rtl'
    );
    return {
      scrollStart: atStart,
      scrollEnd: atEnd,
      scrollLeft: viewport.scrollLeft,
      scrollTop: viewport.scrollTop,
    };
  }

  private updateEdges = (): void => this.syncEdges(false);

  private syncEdges(emitForPositionChange: boolean): void {
    const detail = this.edgeDetail();
    const changed =
      !this.measured ||
      detail.scrollStart !== this.atStart ||
      detail.scrollEnd !== this.atEnd;
    this.measured = true;
    this.atStart = detail.scrollStart;
    this.atEnd = detail.scrollEnd;
    if (changed || emitForPositionChange) this.emit('lr-scroll', detail);
  }

  // One edge read and one `lr-scroll` dispatch per animation frame, however fast `scroll` fires.
  private onScroll = (): void => {
    if (this.scrollFrame.pending) return;
    this.scrollFrame.schedule(() => this.syncEdges(true));
  };

  /** Keys that move or activate the scroller's own viewport and buttons stay inside it, so an
   *  ancestor's roving or activation handler never mistakes them for its own. */
  private onBaseKeyDown = (event: KeyboardEvent): void => {
    if (shouldIgnoreNavigationKey(event) || event.shiftKey || !CONTAINED_KEYS.has(event.key)) return;
    const origin = event.composedPath()[0];
    if (isElementNode(origin) && origin.getRootNode() === this.renderRoot &&
      (origin === this.viewport || origin.matches('button[part~="control"]'))) {
      event.stopPropagation();
    }
  };

  private onSlotChange = (): void => {
    if (this.content) this.resizeObserver.observe(this.content);
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
      hostAriaLabel(this) ??
      (this.label || this.localize('scrollerLabel'));
    const vertical = this.orientation === 'vertical';
    return html`<div part="base" @keydown=${this.onBaseKeyDown}>
      ${this.controls
        ? html`<button
            part="control previous"
            type="button"
            aria-label=${this.localize('scrollPrevious')}
            ?disabled=${!this.measured || this.atStart}
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
          ?hidden=${!this.measured || this.withoutShadow || this.atStart}
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
          ?hidden=${!this.measured || this.withoutShadow || this.atEnd}
        ></span>
      </div>
      ${this.controls
        ? html`<button
            part="control next"
            type="button"
            aria-label=${this.localize('scrollNext')}
            ?disabled=${!this.measured || this.atEnd}
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
