import { html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { property, query, state } from 'lit/decorators.js';
import { LyraElement } from '../../internal/lyra-element.js';
import type { OptionalPeerApi } from '../../internal/optional-peer-types.js';
import { safeFetchUrl } from '../../internal/safe-url.js';
import { chevronIcon } from '../../internal/icons.js';
import { getPptxRenderer, type PptxRendererModule } from './pptx-loader.js';
import { styles } from './pptx-viewer.styles.js';
import '../skeleton/skeleton.js';

type PptxPhase = 'idle' | 'loading' | 'mounted' | 'error';

export interface LyraPptxViewerEventMap {
  'lyra-load': CustomEvent<{ slideCount: number }>;
  'lyra-slide-change': CustomEvent<{ index: number; count: number }>;
  'lyra-render-error': CustomEvent<{ error: unknown }>;
}

/**
 * Best-effort client-side PPTX viewer backed by `@aiden0z/pptx-renderer`.
 * The fidelity notice is intentionally always visible because animations,
 * equations, embedded OLE objects, notes, and several advanced effects are
 * not represented by the renderer.
 *
 * @customElement lyra-pptx-viewer
 * @event lyra-load - Fired after a presentation opens. `detail: { slideCount }`.
 * @event lyra-slide-change - Fired when the active slide changes.
 * @event lyra-render-error - Fired when fetching or rendering fails.
 * @csspart base - The named viewer region.
 * @csspart header - The optional presentation-name row.
 * @csspart name - The presentation name.
 * @csspart notice - The persistent fidelity notice.
 * @csspart error - The error region.
 * @csspart nav - Slide navigation controls.
 * @csspart previous-button - Previous-slide button.
 * @csspart previous-icon - Previous-slide icon.
 * @csspart slide-count - Current slide indicator.
 * @csspart next-button - Next-slide button.
 * @csspart next-icon - Next-slide icon.
 * @csspart container - The renderer-owned output container.
 */
export class LyraPptxViewer extends LyraElement<LyraPptxViewerEventMap> {
  static styles = [LyraElement.styles, styles];

  /** URL of the PPTX file. */
  @property() src = '';
  /** Optional presentation name. */
  @property() name = '';
  /** Accessible-name override for the viewer region. */
  @property() label = '';

  @state() private phase: PptxPhase = 'idle';
  @state() private errorMessage = '';
  @state() private slideCount = 0;
  @state() private currentSlideIndex = 0;
  @query('[part="container"]') private containerEl?: HTMLElement;

  /** @internal Test seam for replacing the optional renderer. */
  loadRenderer: () => Promise<PptxRendererModule | null> = getPptxRenderer;
  private viewer?: OptionalPeerApi;
  private generation = 0;

  private onSlideChange = (event: OptionalPeerApi): void => {
    this.currentSlideIndex = event.detail.index;
    this.emit('lyra-slide-change', { index: event.detail.index, count: this.slideCount });
  };

  protected willUpdate(changed: PropertyValues): void {
    if (!this.hasUpdated || changed.has('src')) void this.mount();
  }

  disconnectedCallback(): void {
    this.teardown();
    super.disconnectedCallback();
  }

  async goToSlide(index: number): Promise<void> { await this.viewer?.goToSlide(index); }

  private teardown(): void {
    this.generation++;
    this.viewer?.removeEventListener('slidechange', this.onSlideChange);
    this.viewer?.destroy();
    this.viewer = undefined;
  }

  private async mount(): Promise<void> {
    this.teardown();
    const generation = this.generation;
    if (!this.src) { this.phase = 'idle'; return; }
    const url = safeFetchUrl(this.src);
    if (!url) {
      this.phase = 'error';
      this.errorMessage = this.localize('documentPreviewUrlNotAllowed');
      return;
    }
    this.phase = 'loading';
    let module: PptxRendererModule | null;
    let response: Response;
    try {
      [module, response] = await Promise.all([this.loadRenderer(), fetch(url)]);
    } catch (error) {
      if (generation !== this.generation) return;
      this.phase = 'error';
      this.errorMessage = this.localize('documentPreviewFailedToLoad');
      this.emit('lyra-render-error', { error });
      return;
    }
    if (generation !== this.generation) return;
    if (!module || !response.ok) {
      this.phase = 'error';
      this.errorMessage = this.localize(module ? 'documentPreviewFailedToLoad' : 'pptxViewerRenderError');
      return;
    }
    let buffer: ArrayBuffer;
    try { buffer = await response.arrayBuffer(); }
    catch (error) {
      if (generation !== this.generation) return;
      this.phase = 'error';
      this.errorMessage = this.localize('documentPreviewFailedToLoad');
      this.emit('lyra-render-error', { error });
      return;
    }
    if (generation !== this.generation) return;
    this.phase = 'mounted';
    await this.updateComplete;
    if (generation !== this.generation || !this.containerEl) return;
    try {
      const viewer = await module.PptxViewer.open(buffer, this.containerEl, {
        zipLimits: module.RECOMMENDED_ZIP_LIMITS,
        listOptions: { windowed: true },
      });
      if (generation !== this.generation) { viewer.destroy(); return; }
      this.viewer = viewer;
      viewer.addEventListener('slidechange', this.onSlideChange);
      this.slideCount = viewer.slideCount;
      this.currentSlideIndex = viewer.currentSlideIndex;
      this.emit('lyra-load', { slideCount: viewer.slideCount });
    } catch (error) {
      if (generation !== this.generation) return;
      this.phase = 'error';
      this.errorMessage = this.localize('pptxViewerRenderError');
      this.emit('lyra-render-error', { error });
    }
  }

  private renderBody(): TemplateResult | typeof nothing {
    if (this.phase === 'loading') return html`<lyra-skeleton variant="rect"></lyra-skeleton>`;
    if (this.phase === 'error') return html`<div part="error" role="alert">${this.errorMessage}</div>`;
    if (this.phase !== 'mounted') return nothing;
    return html`
      <div part="nav" ?hidden=${this.slideCount <= 1}>
        <button part="previous-button" type="button" aria-label=${this.localize('pptxViewerPreviousSlide')} ?disabled=${this.currentSlideIndex <= 0} @click=${() => this.goToSlide(this.currentSlideIndex - 1)}>
          <span part="previous-icon" aria-hidden="true">${chevronIcon()}</span>
        </button>
        <span part="slide-count">${this.localize('pptxViewerSlideOf', undefined, { current: this.currentSlideIndex + 1, total: this.slideCount })}</span>
        <button part="next-button" type="button" aria-label=${this.localize('pptxViewerNextSlide')} ?disabled=${this.currentSlideIndex >= this.slideCount - 1} @click=${() => this.goToSlide(this.currentSlideIndex + 1)}>
          <span part="next-icon" aria-hidden="true">${chevronIcon()}</span>
        </button>
      </div>
      <div part="container"></div>
    `;
  }

  render(): TemplateResult {
    const ariaLabel = this.label || this.getAttribute('aria-label') || this.localize('pptxViewerLabel');
    return html`
      <div part="base" role="region" aria-label=${ariaLabel}>
        <div part="header" ?hidden=${!this.name}><span part="name">${this.name}</span></div>
        <p part="notice" role="note">${this.localize('pptxViewerFidelityNotice')}</p>
        ${this.renderBody()}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap { 'lyra-pptx-viewer': LyraPptxViewer; }
}
