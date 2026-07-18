import { html, nothing, type TemplateResult } from 'lit';
import { property } from 'lit/decorators.js';
import { LyraElement } from '../../internal/lyra-element.js';
import { safeMediaSrc } from '../../internal/safe-url.js';
import { finiteRange } from '../../internal/numbers.js';
import { styles } from './zoomable-frame.styles.js';

export interface LyraZoomableFrameEventMap {
  'lr-zoom-change': CustomEvent<{ zoom: number }>;
}

/**
 * `<lr-zoomable-frame>` — a scrollable frame for inspecting slotted or
 * image content at a bounded zoom level. Scrolling provides panning when the
 * content exceeds the frame; the controls and keyboard shortcuts change zoom.
 *
 * Two public reset methods cover different needs: `resetZoom()` (also wired to the built-in
 * reset button and the `0` keyboard shortcut) returns zoom to 1 while intentionally preserving
 * the current pan/scroll position; `resetView()` additionally returns pan to the origin, for a
 * caller (e.g. `<lr-lightbox>`) that wants a fully clean view, such as when swapping to new
 * content entirely.
 *
 * @customElement lr-zoomable-frame
 * @slot - Content to inspect; when `src` is set, an image is rendered instead.
 * @event lr-zoom-change - Zoom changed. `detail: { zoom }`.
 * @csspart base - The frame wrapper.
 * @csspart viewport - The scrollable viewport.
 * @csspart content - The transformed content wrapper.
 * @csspart controls - Zoom controls.
 * @csspart zoom-out - Zoom-out button.
 * @csspart zoom-in - Zoom-in button.
 * @csspart reset - Reset-to-100-percent button.
 * @cssprop --lr-zoomable-frame-min-block-size - Minimum viewport block size.
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

  /** `minZoom`/`maxZoom` normalized to finite, positive scale bounds before any zoom math -- an
   *  invalid attribute value would otherwise flow straight into the stepped-zoom clamp below,
   *  producing `NaN` instead of falling back to a sane default. Bounds mirror the pan/zoom
   *  convention already established for `<lr-flow-canvas>`/`<lr-graph>`. */
  private get safeMinZoom(): number {
    return finiteRange(this.minZoom, 0.5, 0.01, 1000);
  }
  private get safeMaxZoom(): number {
    return finiteRange(this.maxZoom, 4, this.safeMinZoom, 1000);
  }

  /** `zoomStep` normalized to a finite, strictly-positive increment -- a zero/negative/non-finite
   *  step would otherwise stall `zoomIn`/`zoomOut` (no-op or reverse direction) instead of clamping
   *  to a usable floor. `0.01` matches `setZoom()`'s own rounding grain (`Math.round(x * 100) /
   *  100`), so the floor itself always produces a visible zoom change instead of one the final
   *  rounding silently erases. */
  private get safeZoomStep(): number {
    return finiteRange(this.zoomStep, 0.25, 0.01, 1000);
  }

  /** The current `zoom`, normalized to a finite value clamped into `[safeMinZoom, safeMaxZoom]`. */
  private get safeZoom(): number {
    return finiteRange(this.zoom, 1, this.safeMinZoom, this.safeMaxZoom);
  }

  private setZoom(value: number): void {
    const min = this.safeMinZoom;
    const max = this.safeMaxZoom;
    const step = this.safeZoomStep;
    const stepped = Math.round(value / step) * step;
    const next = Math.min(max, Math.max(min, Math.round(stepped * 100) / 100));
    if (next === this.zoom) return;
    this.zoom = next;
    this.emit('lr-zoom-change', { zoom: next });
  }

  zoomIn = (): void => this.setZoom(this.safeZoom + this.safeZoomStep);
  zoomOut = (): void => this.setZoom(this.safeZoom - this.safeZoomStep);
  /** Resets zoom to 1 only -- deliberately leaves the viewport's native scroll offset
   *  untouched, so a consumer relying on "reset zoom but keep my pan position" (a legitimate
   *  photo-viewer pattern) doesn't regress. Backs the built-in reset button and the `0` keyboard
   *  shortcut. See `resetView()` for a stronger reset that also returns to the origin. */
  resetZoom = (): void => this.setZoom(1);
  /** Resets both zoom and pan/scroll position to their initial state -- distinct from
   *  `resetZoom()` (called by the built-in reset button), which intentionally preserves pan.
   *  Intended for a caller (e.g. `<lr-lightbox>`, swapping to a new image) that wants every
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
    const zoom = this.safeZoom;
    const min = this.safeMinZoom;
    const max = this.safeMaxZoom;
    const label = this.accessibleLabel || this.localize('zoomableFrameLabel');
    return html`<div part="base" role="region" aria-label=${label}>
      <div part="viewport" role="group" aria-label=${label} tabindex="0" @keydown=${this.onViewportKeyDown}>
        <div part="content" data-zoom=${String(zoom)} style="--lr-zoomable-frame-zoom: ${zoom}">
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
    'lr-zoomable-frame': LyraZoomableFrame;
  }
}
