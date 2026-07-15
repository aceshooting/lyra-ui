import { html, type PropertyValues, type TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import { ref } from 'lit/directives/ref.js';
import { LyraElement } from '../../internal/lyra-element.js';
import { safeFetchUrl } from '../../internal/safe-url.js';
import { srOnly } from '../../internal/a11y.js';
import '../virtual-list/virtual-list.js';
import { loadPdfJs, type PdfJsApi } from './pdf-loader.js';
import { styles } from './pdf-viewer.styles.js';

const MIN_ZOOM = 0.25;
const MAX_ZOOM = 4;
const ZOOM_STEP = 0.25;

function clampZoom(value: number): number {
  if (!Number.isFinite(value)) return 1;
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value));
}

type PdfLoadState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'ready'; doc: PdfJsApi; pageCount: number }
  | { kind: 'error'; message: string };

export interface LyraPdfViewerEventMap {
  'lyra-render-error': CustomEvent<{ error: unknown }>;
  'lyra-page-change': CustomEvent<{ page: number; pageCount: number }>;
  'lyra-zoom-change': CustomEvent<{ zoom: number }>;
}

/**
 * Fetches PDF bytes and renders their pages with the optional `pdfjs-dist`
 * peer. Pages are composed through `lyra-virtual-list`, while a PDF.js text
 * layer keeps rendered text selectable and copyable.
 *
 * @customElement lyra-pdf-viewer
 * @event lyra-render-error - Fired when fetching, parsing, or rendering fails.
 * @event lyra-page-change - Fired when the current page changes.
 * @event lyra-zoom-change - Fired when the zoom multiplier changes.
 * @csspart base - The root viewer container.
 * @csspart toolbar - Pagination and zoom controls.
 * @csspart page-indicator - The current page text.
 * @csspart zoom-indicator - The current zoom percentage.
 * @csspart pages - The virtualized page list.
 * @csspart page - One rendered page wrapper.
 * @csspart text-layer - Selectable text positioned over a page canvas.
 * @csspart error - The error message region.
 * @csspart spinner - The loading status region.
 */
export class LyraPdfViewer extends LyraElement<LyraPdfViewerEventMap> {
  static styles = [LyraElement.styles, styles, srOnly];

  /** URL to fetch and render as a PDF document. */
  @property() src = '';
  /** Display name used as the document's accessible label fallback. */
  @property() name = '';
  /** One-based current page, clamped to the loaded document's page count. */
  @property({ type: Number, reflect: true }) page = 1;
  /** Page zoom multiplier, clamped to the range 0.25–4. */
  @property({ type: Number, reflect: true }) zoom = 1;

  @state() private loadState: PdfLoadState = { kind: 'idle' };
  private loadLibrary: () => Promise<PdfJsApi | null> = loadPdfJs;
  private generation = 0;
  private readonly pageCanvases = new Map<number, HTMLCanvasElement>();
  private readonly pageRenderTasks = new Map<number, { cancel(): void }>();
  private readonly pageCanvasRefs = new Map<number, (canvas: Element | undefined) => void>();
  private readonly textLayerContainers = new Map<number, HTMLElement>();
  private readonly textLayerContainerRefs = new Map<number, (element: Element | undefined) => void>();
  private readonly textLayers = new Map<number, { cancel(): void }>();

  protected willUpdate(changed: PropertyValues): void {
    if (!this.hasUpdated || changed.has('src')) void this.load();
    if (changed.has('page')) this.page = this.clampPage(this.page);
    if (changed.has('zoom')) {
      this.zoom = clampZoom(this.zoom);
      for (const [pageNumber, canvas] of this.pageCanvases) void this.renderPage(pageNumber, canvas);
    }
  }

  protected updated(changed: PropertyValues): void {
    super.updated(changed);
    if (changed.has('page') && this.loadState.kind === 'ready') {
      this.emit('lyra-page-change', { page: this.page, pageCount: this.loadState.pageCount });
    }
    if (changed.has('zoom')) this.emit('lyra-zoom-change', { zoom: this.zoom });
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    for (const task of this.pageRenderTasks.values()) task.cancel();
    for (const layer of this.textLayers.values()) layer.cancel();
    this.pageRenderTasks.clear();
    this.textLayers.clear();
    this.pageCanvases.clear();
    this.textLayerContainers.clear();
  }

  private clampPage(value: number): number {
    const pageCount = this.loadState.kind === 'ready' ? this.loadState.pageCount : 1;
    if (!Number.isFinite(value)) return 1;
    return Math.min(pageCount, Math.max(1, Math.round(value)));
  }

  private async load(): Promise<void> {
    const generation = ++this.generation;
    if (!this.src) {
      this.loadState = { kind: 'idle' };
      return;
    }
    const url = safeFetchUrl(this.src);
    if (!url) {
      this.loadState = { kind: 'error', message: this.localize('documentPreviewUrlNotAllowed') };
      return;
    }
    this.loadState = { kind: 'loading' };
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
      const data = await response.arrayBuffer();
      const pdfjsLib = await this.loadLibrary();
      if (generation !== this.generation) return;
      if (!pdfjsLib) {
        this.loadState = { kind: 'error', message: this.localize('pdfViewerMissingLibrary') };
        return;
      }
      const doc = await pdfjsLib.getDocument({ data }).promise;
      if (generation !== this.generation) return;
      this.page = 1;
      this.loadState = { kind: 'ready', doc, pageCount: doc.numPages };
    } catch (error) {
      if (generation !== this.generation) return;
      this.loadState = { kind: 'error', message: error instanceof Error ? error.message : this.localize('documentPreviewFailedToLoad') };
      this.emit('lyra-render-error', { error });
    }
  }

  nextPage(): void { this.setPage(this.page + 1); }
  previousPage(): void { this.setPage(this.page - 1); }
  zoomIn(): void { this.setZoom(this.zoom + ZOOM_STEP); }
  zoomOut(): void { this.setZoom(this.zoom - ZOOM_STEP); }

  private setPage(value: number): void {
    const next = this.clampPage(value);
    if (next !== this.page) this.page = next;
  }

  private setZoom(value: number): void {
    const next = clampZoom(value);
    if (next !== this.zoom) this.zoom = next;
  }

  private renderToolbar(): TemplateResult {
    if (this.loadState.kind !== 'ready') return html``;
    const { pageCount } = this.loadState;
    return html`<div part="toolbar">
      <button type="button" data-action="previous" ?disabled=${this.page <= 1} aria-label=${this.localize('pdfViewerPreviousPage')} @click=${this.previousPage}>${this.localize('pdfViewerPreviousPage')}</button>
      <span part="page-indicator">${this.localize('pdfViewerPageOf', undefined, { page: this.page, total: pageCount })}</span>
      <button type="button" data-action="next" ?disabled=${this.page >= pageCount} aria-label=${this.localize('pdfViewerNextPage')} @click=${this.nextPage}>${this.localize('pdfViewerNextPage')}</button>
      <button type="button" data-action="zoom-out" ?disabled=${this.zoom <= MIN_ZOOM} aria-label=${this.localize('pdfViewerZoomOut')} @click=${this.zoomOut}>${this.localize('pdfViewerZoomOut')}</button>
      <span part="zoom-indicator" aria-label=${this.localize('pdfViewerCurrentZoom', undefined, { percent: Math.round(this.zoom * 100) })}>${this.localize('pdfViewerCurrentZoom', undefined, { percent: Math.round(this.zoom * 100) })}</span>
      <button type="button" data-action="zoom-in" ?disabled=${this.zoom >= MAX_ZOOM} aria-label=${this.localize('pdfViewerZoomIn')} @click=${this.zoomIn}>${this.localize('pdfViewerZoomIn')}</button>
    </div>`;
  }

  private async renderPage(pageNumber: number, canvas: HTMLCanvasElement): Promise<void> {
    if (this.loadState.kind !== 'ready') return;
    this.pageRenderTasks.get(pageNumber)?.cancel();
    this.pageRenderTasks.delete(pageNumber);
    this.textLayers.get(pageNumber)?.cancel();
    this.textLayers.delete(pageNumber);
    const page = await this.loadState.doc.getPage(pageNumber);
    if (this.loadState.kind !== 'ready' || this.pageCanvases.get(pageNumber) !== canvas) return;
    const viewport = page.getViewport({ scale: this.zoom });
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.floor(viewport.width * dpr);
    canvas.height = Math.floor(viewport.height * dpr);
    canvas.style.width = `${viewport.width}px`;
    canvas.style.height = `${viewport.height}px`;
    const container = this.textLayerContainers.get(pageNumber);
    if (container) {
      container.style.width = `${viewport.width}px`;
      container.style.height = `${viewport.height}px`;
      container.style.transform = `translateX(-50%)`;
    }
    const canvasContext = canvas.getContext('2d');
    if (!canvasContext) return;
    canvasContext.setTransform(dpr, 0, 0, dpr, 0, 0);
    const renderTask = page.render({ canvasContext, viewport });
    this.pageRenderTasks.set(pageNumber, renderTask);
    void this.renderTextLayer(pageNumber, page, viewport);
    try {
      await renderTask.promise;
    } catch (error) {
      if (this.pageRenderTasks.get(pageNumber) === renderTask) this.emit('lyra-render-error', { error });
    } finally {
      if (this.pageRenderTasks.get(pageNumber) === renderTask) this.pageRenderTasks.delete(pageNumber);
    }
  }

  private async renderTextLayer(pageNumber: number, page: PdfJsApi, viewport: PdfJsApi): Promise<void> {
    const container = this.textLayerContainers.get(pageNumber);
    if (!container || !page.streamTextContent || !this.loadState.kind) return;
    const pdfjsLib = await this.loadLibrary();
    if (!pdfjsLib || !pdfjsLib.TextLayer || this.textLayerContainers.get(pageNumber) !== container) return;
    container.replaceChildren();
    const textLayer = new pdfjsLib.TextLayer({ textContentSource: page.streamTextContent(), container, viewport });
    this.textLayers.set(pageNumber, textLayer);
    try {
      await textLayer.render();
    } catch (error) {
      if (this.textLayers.get(pageNumber) === textLayer) this.emit('lyra-render-error', { error });
    }
  }

  private pageCanvasRef(pageNumber: number): (element: Element | undefined) => void {
    let callback = this.pageCanvasRefs.get(pageNumber);
    if (!callback) {
      callback = (element: Element | undefined): void => {
        if (!element) {
          this.pageCanvases.delete(pageNumber);
          this.pageRenderTasks.get(pageNumber)?.cancel();
          this.pageRenderTasks.delete(pageNumber);
          return;
        }
        this.pageCanvases.set(pageNumber, element as HTMLCanvasElement);
        void this.renderPage(pageNumber, element as HTMLCanvasElement);
      };
      this.pageCanvasRefs.set(pageNumber, callback);
    }
    return callback;
  }

  private textLayerContainerRef(pageNumber: number): (element: Element | undefined) => void {
    let callback = this.textLayerContainerRefs.get(pageNumber);
    if (!callback) {
      callback = (element: Element | undefined): void => {
        if (!element) {
          this.textLayerContainers.delete(pageNumber);
          this.textLayers.get(pageNumber)?.cancel();
          this.textLayers.delete(pageNumber);
          return;
        }
        this.textLayerContainers.set(pageNumber, element as HTMLElement);
      };
      this.textLayerContainerRefs.set(pageNumber, callback);
    }
    return callback;
  }

  private renderPageItem = (pageNumber: unknown): TemplateResult => {
    const number = pageNumber as number;
    return html`<div part="page"><canvas ${ref(this.pageCanvasRef(number))}></canvas><div part="text-layer" ${ref(this.textLayerContainerRef(number))}></div></div>`;
  };

  private onVisibleRangeChanged = (event: CustomEvent<{ start: number }>): void => {
    if (this.loadState.kind === 'ready') this.setPage(event.detail.start + 1);
  };

  private renderBody(): TemplateResult {
    switch (this.loadState.kind) {
      case 'ready': {
        const items = Array.from({ length: this.loadState.pageCount }, (_unused, index) => index + 1);
        return html`${this.renderToolbar()}<lyra-virtual-list part="pages" .items=${items} .renderItem=${this.renderPageItem} .keyFunction=${(item: unknown) => item as number} .activeId=${this.page} @lyra-visible-range-changed=${this.onVisibleRangeChanged}></lyra-virtual-list>`;
      }
      case 'loading': return html`<div part="spinner" role="status"><span class="sr-only">${this.localize('loadingDocument')}</span></div>`;
      case 'error': return html`<div part="error" role="alert">${this.loadState.message}</div>`;
      case 'idle': default: return html`<p class="empty-note">${this.localize('documentPreviewEmpty', undefined, { type: this.localize('documentPreviewTypeDocument') })}</p>`;
    }
  }

  render(): TemplateResult {
    return html`<div part="base" aria-label=${this.name || this.localize('pdfViewerLabel')}>${this.renderBody()}</div>`;
  }
}

declare global { interface HTMLElementTagNameMap { 'lyra-pdf-viewer': LyraPdfViewer; } }
