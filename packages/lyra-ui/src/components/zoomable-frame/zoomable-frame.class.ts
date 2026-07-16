import { html, nothing, type TemplateResult } from 'lit';
import { property } from 'lit/decorators.js';
import { LyraElement } from '../../internal/lyra-element.js';
import { safeMediaSrc } from '../../internal/safe-url.js';
import { styles } from './zoomable-frame.styles.js';

export interface LyraZoomableFrameEventMap {
  'lyra-zoom-change': CustomEvent<{ zoom: number }>;
}

/**
 * `<lyra-zoomable-frame>` — a scrollable frame for inspecting slotted or
 * image content at a bounded zoom level. Scrolling provides panning when the
 * content exceeds the frame; the controls and keyboard shortcuts change zoom.
 *
 * Two public reset methods cover different needs: `resetZoom()` (also wired to the built-in
 * reset button and the `0` keyboard shortcut) returns zoom to 1 while intentionally preserving
 * the current pan/scroll position; `resetView()` additionally returns pan to the origin, for a
 * caller (e.g. `<lyra-lightbox>`) that wants a fully clean view, such as when swapping to new
 * content entirely.
 *
 * @customElement lyra-zoomable-frame
 * @slot - Content to inspect; when `src` is set, an image is rendered instead.
 * @event lyra-zoom-change - Zoom changed. `detail: { zoom }`.
 * @csspart base - The frame wrapper.
 * @csspart viewport - The scrollable viewport.
 * @csspart content - The transformed content wrapper.
 * @csspart controls - Zoom controls.
 * @csspart zoom-out - Zoom-out button.
 * @csspart zoom-in - Zoom-in button.
 * @csspart reset - Reset-to-100-percent button.
 * @cssprop --lyra-zoomable-frame-min-block-size - Minimum viewport block size.
 */
export class LyraZoomableFrame extends LyraElement<LyraZoomableFrameEventMap> {
  static styles = [LyraElement.styles, styles];

  @property({ type: Number, reflect: true }) zoom = 1;
  @property({ type: Number, attribute: 'min-zoom' }) minZoom = 0.5;
  @property({ type: Number, attribute: 'max-zoom' }) maxZoom = 4;
  @property({ type: Number, attribute: 'zoom-step' }) zoomStep = 0.25;
  @property() src = '';
  @property() alt = '';
  @property({ attribute: 'aria-label' }) accessibleLabel: string | null = null;

  private normalizedBounds(): { min: number; max: number; step: number } {
    const min = Number.isFinite(this.minZoom) ? Math.max(0.01, this.minZoom) : 0.5;
    const max = Number.isFinite(this.maxZoom) ? Math.max(min, this.maxZoom) : Math.max(min, 4);
    const step = Number.isFinite(this.zoomStep) && this.zoomStep > 0 ? this.zoomStep : 0.25;
    return { min, max, step };
  }

  private normalizedZoom(): number {
    const { min, max } = this.normalizedBounds();
    return Math.min(max, Math.max(min, Number.isFinite(this.zoom) ? this.zoom : 1));
  }

  private setZoom(value: number): void {
    const { min, max, step } = this.normalizedBounds();
    const stepped = Math.round(value / step) * step;
    const next = Math.min(max, Math.max(min, Math.round(stepped * 100) / 100));
    if (next === this.zoom) return;
    this.zoom = next;
    this.emit('lyra-zoom-change', { zoom: next });
  }

  zoomIn = (): void => this.setZoom(this.normalizedZoom() + this.normalizedBounds().step);
  zoomOut = (): void => this.setZoom(this.normalizedZoom() - this.normalizedBounds().step);
  /** Resets zoom to 1 only -- deliberately leaves the viewport's native scroll offset
   *  untouched, so a consumer relying on "reset zoom but keep my pan position" (a legitimate
   *  photo-viewer pattern) doesn't regress. Backs the built-in reset button and the `0` keyboard
   *  shortcut. See `resetView()` for a stronger reset that also returns to the origin. */
  resetZoom = (): void => this.setZoom(1);
  /** Resets both zoom and pan/scroll position to their initial state -- distinct from
   *  `resetZoom()` (called by the built-in reset button), which intentionally preserves pan.
   *  Intended for a caller (e.g. `<lyra-lightbox>`, swapping to a new image) that wants every
   *  view to start clean rather than carrying over the previous image's zoom/pan state. */
  resetView = (): void => {
    this.resetZoom();
    this.renderRoot.querySelector<HTMLElement>('[part="viewport"]')?.scrollTo({ left: 0, top: 0 });
  };

  private onViewportKeyDown = (event: KeyboardEvent): void => {
    if (event.key === '+' || event.key === '=') {
      event.preventDefault();
      this.zoomIn();
    } else if (event.key === '-' || event.key === '_') {
      event.preventDefault();
      this.zoomOut();
    } else if (event.key === '0') {
      event.preventDefault();
      this.resetZoom();
    }
  };

  render(): TemplateResult {
    const zoom = this.normalizedZoom();
    const { min, max } = this.normalizedBounds();
    const label = this.accessibleLabel || this.localize('zoomableFrameLabel');
    return html`<div part="base" role="region" aria-label=${label}>
      <div part="viewport" tabindex="0" @keydown=${this.onViewportKeyDown}>
        <div part="content" data-zoom=${String(zoom)} style="--lyra-zoomable-frame-zoom: ${zoom}">
          ${this.src ? html`<img src=${safeMediaSrc(this.src) ?? ''} alt=${this.alt} />` : html`<slot></slot>`}
        </div>
      </div>
      <div part="controls" aria-label=${this.localize('zoomControls')}>
        <button part="zoom-out" type="button" aria-label=${this.localize('zoomOut')} ?disabled=${zoom <= min} @click=${this.zoomOut}>−</button>
        <button part="reset" type="button" aria-label=${this.localize('resetZoom')} @click=${this.resetZoom}>${this.localize('pdfViewerCurrentZoom', undefined, { percent: 100 })}</button>
        <button part="zoom-in" type="button" aria-label=${this.localize('zoomIn')} ?disabled=${zoom >= max} @click=${this.zoomIn}>+</button>
      </div>
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lyra-zoomable-frame': LyraZoomableFrame;
  }
}
