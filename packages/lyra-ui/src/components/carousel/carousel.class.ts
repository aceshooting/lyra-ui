import { html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { property, query } from 'lit/decorators.js';
import { LyraElement } from '../../internal/lyra-element.js';
import { finiteDuration, finiteInteger } from '../../internal/numbers.js';
import { styles } from './carousel.styles.js';

export interface LyraCarouselEventMap {
  'lyra-slide-change': CustomEvent<{ index: number }>;
}

/**
 * `<lyra-carousel>` — an accessible single-slide carousel for arbitrary
 * slotted content. The index is reflected and self-managed by navigation;
 * every change emits `lyra-slide-change` so applications can persist or
 * coordinate the active slide.
 *
 * @customElement lyra-carousel
 * @slot - Slide elements. Each assigned element becomes one slide.
 * @event lyra-slide-change - Active slide changed. `detail: { index }`.
 * @csspart base - The carousel landmark.
 * @csspart viewport - The keyboard-focusable slide viewport.
 * @csspart track - The slotted slide wrapper.
 * @csspart controls - Previous/next control row.
 * @csspart previous-button - Previous slide button.
 * @csspart previous-glyph - The chevron glyph inside `previous-button`, mirrored under RTL.
 * @csspart next-button - Next slide button.
 * @csspart next-glyph - The chevron glyph inside `next-button`, mirrored under RTL.
 * @csspart indicators - Indicator button group.
 * @csspart indicator - An individual slide indicator's interactive hit target, sized to the
 *   shared minimum tappable size (`--lyra-icon-button-size`), independent of the smaller visible
 *   dot rendered inside it (mirrors `<lyra-swatch-picker>`'s `[part="swatch"]`/`[part="swatch-fill"]`
 *   split).
 * @csspart indicator-dot - The individual indicator's compact visible dot.
 */
export class LyraCarousel extends LyraElement<LyraCarouselEventMap> {
  static styles = [LyraElement.styles, styles];

  @property({ type: Number, reflect: true }) index = 0;
  @property({ type: Boolean, reflect: true }) loop = false;
  @property({ type: Boolean, reflect: true }) autoplay = false;
  @property({ type: Number, attribute: 'autoplay-interval' }) autoplayInterval = 5000;
  @property({ type: Boolean, attribute: 'show-indicators' }) showIndicators = true;
  @property({ attribute: 'accessible-label' }) accessibleLabel = '';
  @property({ attribute: 'aria-label' }) private hostAccessibleLabel: string | null = null;
  @query('slot') private slideSlot?: HTMLSlotElement;

  private timer?: number;
  private reduceMotion = false;
  private mediaQuery?: MediaQueryList;

  connectedCallback(): void {
    super.connectedCallback();
    this.mediaQuery = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : undefined;
    this.reduceMotion = this.mediaQuery?.matches ?? false;
    this.mediaQuery?.addEventListener('change', this.onMotionPreferenceChange);
    this.restartAutoplay();
  }

  disconnectedCallback(): void {
    this.stopAutoplay();
    this.mediaQuery?.removeEventListener('change', this.onMotionPreferenceChange);
    this.mediaQuery = undefined;
    super.disconnectedCallback();
  }

  protected willUpdate(changed: PropertyValues): void {
    if (changed.has('index') && this.slideSlot) {
      this.index = this.normalizedIndex();
    }
  }

  protected updated(changed: PropertyValues): void {
    if (changed.has('index') || changed.has('loop') || changed.has('showIndicators')) this.syncSlides();
    if (changed.has('autoplay') || changed.has('autoplayInterval')) this.restartAutoplay();
  }

  private onMotionPreferenceChange = (event: MediaQueryListEvent): void => {
    this.reduceMotion = event.matches;
    this.restartAutoplay();
  };

  private slides(): HTMLElement[] {
    return (this.slideSlot?.assignedElements({ flatten: true }) ?? []).filter(
      (element): element is HTMLElement => element instanceof HTMLElement,
    );
  }

  /** Read-time-safe view of the reflected `index` property, clamped to `[0, count - 1]` -- `count`
   *  is the live slotted-slide count, not a static bound, so this re-clamps on every call rather
   *  than caching. */
  private normalizedIndex(count = this.slides().length): number {
    if (count === 0) return 0;
    return finiteInteger(this.index, 0, 0, count - 1);
  }

  private syncSlides = (): void => {
    const slides = this.slides();
    const current = this.normalizedIndex(slides.length);
    if (this.index !== current) this.index = current;
    slides.forEach((slide, slideIndex) => {
      const canUseGroupRole = !['IMG', 'VIDEO', 'AUDIO', 'BUTTON', 'INPUT', 'SELECT', 'TEXTAREA'].includes(
        slide.tagName,
      );
      if (canUseGroupRole) slide.setAttribute('role', 'group');
      else if (slide.getAttribute('role') === 'group') slide.removeAttribute('role');
      slide.setAttribute('aria-roledescription', this.localize('carouselSlide'));
      slide.setAttribute(
        'aria-label',
        this.localize('carouselSlidePosition', undefined, {
          index: slideIndex + 1,
          total: slides.length,
        }),
      );
      slide.toggleAttribute('hidden', slideIndex !== current);
      slide.setAttribute('aria-hidden', slideIndex === current ? 'false' : 'true');
    });
  };

  private changeTo(index: number): void {
    const count = this.slides().length;
    if (count === 0) return;
    let next = index;
    if (this.loop) next = (index + count) % count;
    else next = Math.min(count - 1, Math.max(0, index));
    if (next === this.index) return;
    this.index = next;
    this.emit('lyra-slide-change', { index: next });
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

  private onViewportKeyDown = (event: KeyboardEvent): void => {
    const rtl = this.effectiveDirection === 'rtl';
    const forwardKey = rtl ? 'ArrowLeft' : 'ArrowRight';
    const backwardKey = rtl ? 'ArrowRight' : 'ArrowLeft';
    if (event.key === forwardKey) {
      event.preventDefault();
      this.next();
    } else if (event.key === backwardKey) {
      event.preventDefault();
      this.previous();
    } else if (event.key === 'Home') {
      event.preventDefault();
      this.goTo(0);
    } else if (event.key === 'End') {
      event.preventDefault();
      this.goTo(this.slides().length - 1);
    }
  };

  render(): TemplateResult {
    const count = this.slides().length;
    const current = this.normalizedIndex(count);
    const label = this.hostAccessibleLabel || this.accessibleLabel || this.localize('carouselLabel');
    const previousLabel = this.localize('previous');
    const nextLabel = this.localize('next');
    return html`<section part="base" role="region" aria-roledescription=${this.localize('carousel')} aria-label=${label}>
      <div
        part="viewport"
        role="group"
        aria-label=${label}
        tabindex="0"
        aria-live=${this.autoplay ? 'off' : 'polite'}
        @keydown=${this.onViewportKeyDown}
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
            ><span part="previous-glyph" aria-hidden="true">‹</span></button>
            ${this.showIndicators
              ? html`<div part="indicators" role="group" aria-label=${this.localize('carouselIndicators')}>
                  ${Array.from({ length: count }, (_, slideIndex) => html`<button
                    part="indicator"
                    type="button"
                    aria-label=${this.localize('carouselGoTo', undefined, { index: slideIndex + 1 })}
                    aria-current=${slideIndex === current ? 'true' : 'false'}
                    @click=${() => this.goTo(slideIndex)}
                  ><span part="indicator-dot" aria-hidden="true"></span></button>`)}
                </div>`
              : nothing}
            <button
              part="next-button"
              type="button"
              aria-label=${nextLabel}
              ?disabled=${!this.loop && current === count - 1}
              @click=${this.next}
            ><span part="next-glyph" aria-hidden="true">›</span></button>
          </div>`
        : nothing}
    </section>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lyra-carousel': LyraCarousel;
  }
}
