import { html, type TemplateResult, nothing } from 'lit';
import { property } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { safeMediaSrc } from '../../../internal/safe-url.js';
import { finiteRange } from '../../../internal/numbers.js';
import { getNumberFormat } from '../../../internal/intl-cache.js';
import { styles } from './pan-zoom.styles.js';

function ownsKeyboardInput(event: KeyboardEvent): boolean {
  for (const target of event.composedPath()) {
    if (!(target instanceof Element)) continue;
    if (target.matches(
      'input, textarea, select, [contenteditable]:not([contenteditable="false"]), ' +
      '[role="textbox"], [role="searchbox"], [role="combobox"], [role="spinbutton"], ' +
      '[role="slider"], [role="listbox"], [role="menu"], [role="menuitem"], [role="radio"], ' +
      '[role="radiogroup"], [role="grid"], [role="tree"], [role="tablist"]',
    )) return true;
  }
  return false;
}

export interface LyraPanZoomEventMap {
  'lr-zoom-change': CustomEvent<{ zoom: number }>;
}

/**
 * `<lr-pan-zoom>` — a scrollable frame for inspecting slotted or image content at a bounded zoom
 * level. This is the intentionally renamed home of the original Lyra `lr-zoomable-frame`
 * pan-and-zoom API; `lr-zoomable-frame` now mirrors the iframe-based Web Awesome component.
 *
 * `resetZoom()` returns zoom to 1 while preserving the native scroll offset. `resetView()` also
 * returns the viewport to its origin for consumers that replace the inspected content.
 *
 * @customElement lr-pan-zoom
 * @slot - Content to inspect; when `src` is set, an image is rendered instead.
 * @event lr-zoom-change - Zoom changed. `detail: { zoom }`.
 * @csspart base - The frame wrapper.
 * @csspart viewport - The scrollable viewport.
 * @csspart content - The transformed content wrapper.
 * @csspart controls - Zoom controls.
 * @csspart zoom-out - Zoom-out button.
 * @csspart zoom-in - Zoom-in button.
 * @csspart reset - Reset-to-100-percent button.
 * @cssprop --lr-pan-zoom-min-block-size - Minimum viewport block size. The former
 *   `--lr-zoomable-frame-min-block-size` name remains a temporary fallback for migrated consumers.
 * @cssprop [--lr-pan-zoom-zoom=1] - Read-only scale written from `zoom`; set the property instead.
 * @status stable
 * @since 8.0.0
 */
export class LyraPanZoom extends LyraElement<LyraPanZoomEventMap> {
  static override styles = [LyraElement.styles, styles];

  @property({ type: Number, reflect: true }) zoom = 1;
  @property({ type: Number, attribute: 'min-zoom' }) minZoom = 0.5;
  @property({ type: Number, attribute: 'max-zoom' }) maxZoom = 4;
  @property({ type: Number, attribute: 'zoom-step' }) zoomStep = 0.25;
  @property() src = '';
  @property() alt = '';
  @property({ attribute: 'aria-label' }) accessibleLabel: string | null = null;

  private get safeMinZoom(): number {
    return finiteRange(this.minZoom, 0.5, 0.01, 1000);
  }

  private get safeMaxZoom(): number {
    return finiteRange(this.maxZoom, 4, this.safeMinZoom, 1000);
  }

  private get safeZoomStep(): number {
    return finiteRange(this.zoomStep, 0.25, 0.01, 1000);
  }

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

  zoomIn(): void {
    this.setZoom(this.safeZoom + this.safeZoomStep);
  }

  zoomOut(): void {
    this.setZoom(this.safeZoom - this.safeZoomStep);
  }

  resetZoom(): void {
    this.setZoom(1);
  }

  resetView(): void {
    this.resetZoom();
    this.renderRoot.querySelector<HTMLElement>('[part="viewport"]')?.scrollTo({ left: 0, top: 0 });
  }

  private onViewportKeyDown = (event: KeyboardEvent): void => {
    if (ownsKeyboardInput(event)) return;
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

  override render(): TemplateResult {
    const zoom = this.safeZoom;
    const min = this.safeMinZoom;
    const max = this.safeMaxZoom;
    const label = this.accessibleLabel || this.localize('zoomableFrameLabel');
    return html`<div part="base" role="region" aria-label=${label}>
      <div part="viewport" role="group" aria-label=${label} tabindex="0" @keydown=${this.onViewportKeyDown}>
        <div
          part="content"
          data-zoom=${String(zoom)}
          style="--lr-pan-zoom-zoom: ${zoom}; --lr-zoomable-frame-zoom: ${zoom}"
        >
          ${this.src ? html`<img src=${safeMediaSrc(this.src) ?? nothing} alt=${this.alt} />` : html`<slot></slot>`}
        </div>
      </div>
      <div part="controls" role="toolbar" aria-label=${this.localize('zoomControls')}>
        <button part="zoom-out" type="button" aria-label=${this.localize('zoomOut')} ?disabled=${zoom <= min} @click=${() => this.zoomOut()}>−</button>
        <button part="reset" type="button" aria-label=${this.localize('resetZoom')} @click=${() => this.resetZoom()}>${this.localize('pdfViewerCurrentZoom', undefined, {
          percent: getNumberFormat(this.effectiveLocale).format(100),
        })}</button>
        <button part="zoom-in" type="button" aria-label=${this.localize('zoomIn')} ?disabled=${zoom >= max} @click=${() => this.zoomIn()}>+</button>
      </div>
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-pan-zoom': LyraPanZoom;
  }
}
