import { html, type PropertyValues, type TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import { ref } from 'lit/directives/ref.js';
import { LyraElement } from '../../internal/lyra-element.js';
import { safeFetchUrl } from '../../internal/safe-url.js';
import { isAbortError, isResourceLimitError, readResponseArrayBuffer } from '../../internal/resource-loader.js';
import { srOnly } from '../../internal/a11y.js';
import { prefersReducedMotion } from '../../internal/motion.js';
import { DocumentAnchorTarget, type LyraAnchorTargetEventMap } from '../../internal/anchor-target.js';
import {
  normalizeQuoteText,
  scopeFromItems,
  resolveTextQuote,
  buildQuoteAnchor,
  type TextQuoteScope,
} from '../../internal/text-quote.js';
import '../virtual-list/virtual-list.js';
import '../skeleton/skeleton.js';
import '../highlight-layer/highlight-layer.js';
import type { LyraHighlightLayer, HighlightLayerItem } from '../highlight-layer/highlight-layer.class.js';
import type { LyraAnchor, HighlightActivateDetail, TextSelectDetail } from '../document-viewer/anchors.js';
import { loadPdfJs, type PdfJsApi } from './pdf-loader.js';
import { styles } from './pdf-viewer.styles.js';

const MIN_ZOOM = 0.25;
const MAX_ZOOM = 4;
const ZOOM_STEP = 0.25;
const PAGE_TEXT_CACHE_LIMIT = 64;
const DEFAULT_THUMBNAIL_WIDTH = 96;

function clampZoom(value: number): number {
  if (!Number.isFinite(value)) return 1;
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value));
}

/** `Node.contains()` never crosses a shadow boundary -- it walks plain light-DOM `parentNode` links,
 *  so `hostEl.contains(nodeInsideHostsOwnShadowRoot)` is `false` even though the node is visually and
 *  logically part of that host. This walks the composed tree instead: from `node`, follow `parentNode`
 *  as usual, and whenever that reaches a `ShadowRoot`, continue from its `.host` -- the same traversal
 *  `getRootNode({ composed: true })` performs internally, exposed here as a containment test against a
 *  specific `ancestor` rather than the top-level document. */
function containsAcrossShadowBoundaries(ancestor: Node, node: Node): boolean {
  let current: Node | null = node;
  while (current) {
    if (current === ancestor) return true;
    current = current instanceof ShadowRoot ? current.host : current.parentNode;
  }
  return false;
}

type PdfLoadState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'ready'; doc: PdfJsApi; pageCount: number }
  | { kind: 'error'; message: string };

export interface LyraPdfViewerEventMap extends LyraAnchorTargetEventMap {
  'lyra-render-error': CustomEvent<{ error: unknown }>;
  'lyra-page-change': CustomEvent<{ page: number; pageCount: number }>;
  'lyra-zoom-change': CustomEvent<{ zoom: number }>;
  'lyra-load': CustomEvent<{ pageCount: number }>;
}

class LyraPdfViewerBase extends LyraElement<LyraPdfViewerEventMap> {}

/**
 * Fetches PDF bytes and renders their pages with the optional `pdfjs-dist` peer. Pages are composed
 * through `lyra-virtual-list`, while a PDF.js text layer keeps rendered text selectable and copyable.
 * Adopts `DocumentAnchorTarget`: `page`, `text-quote`, and `region` anchors resolve; highlights paint
 * via one `<lyra-highlight-layer>` per page, stacked beneath the text layer (canvas -> highlights ->
 * text layer) so starting a text selection over a cited passage keeps working. Pointer activation of
 * a highlight is hit-tested at the page-wrapper level (`onPageClick`) since the text layer sitting on
 * top intercepts most direct pointer events; keyboard activation reaches the highlight layer's own
 * roving-tabindex rects directly, since z-stacking doesn't affect tab order. Accepted residual: a
 * click that ends a text-selection drag over a highlighted passage never activates it (the
 * selection-in-progress check in `onPageClick` exists precisely to distinguish that case from a
 * genuine activation click).
 *
 * @customElement lyra-pdf-viewer
 * @event lyra-render-error - Fired when fetching, parsing, or rendering fails.
 * @event lyra-page-change - Fired when the current page changes.
 * @event lyra-zoom-change - Fired when the zoom multiplier changes.
 * @event lyra-load - Fired once the document reaches `ready`. `detail: { pageCount }`.
 * @event lyra-highlight-activate - A highlight was activated. `detail: { id }`.
 * @event lyra-text-select - A text selection ended inside a page's text layer. `detail: { text,
 *   anchor, rects }`.
 * @event lyra-anchor-result - Fired after an `anchor` (or `scrollToAnchor()` call) is applied.
 *   `detail: { found }`.
 * @csspart base - The root viewer container.
 * @csspart toolbar - Pagination and zoom controls.
 * @csspart page-indicator - The current page text.
 * @csspart zoom-indicator - The current zoom percentage.
 * @csspart pages - The virtualized page list.
 * @csspart page - One rendered page wrapper.
 * @csspart text-layer - Selectable text positioned over a page canvas.
 * @csspart error - The error message region.
 * @csspart spinner - The loading status region.
 * @csspart anchor-live-region - Visually-hidden `role="status"` region announcing anchor-jump results.
 * @cssprop [--lyra-pdf-viewer-height=var(--lyra-size-24rem)] - Block size of the virtualized page list.
 */
export class LyraPdfViewer extends DocumentAnchorTarget(LyraPdfViewerBase) {
  static styles = [LyraElement.styles, styles, srOnly];

  /** URL to fetch and render as a PDF document. */
  @property() src = '';
  /** Display name used as the document's accessible label fallback. */
  @property() name = '';
  /** One-based current page, clamped to the loaded document's page count. */
  @property({ type: Number, reflect: true }) page = 1;
  /** Page zoom multiplier, clamped to the range 0.25–4. */
  @property({ type: Number, reflect: true }) zoom = 1;

  /** Anchor kinds this viewer resolves. */
  readonly anchorKinds = ['page', 'text-quote', 'region'] as const;

  @state() private loadState: PdfLoadState = { kind: 'idle' };
  /** True while `page` was last set by the user scrolling the page list rather than by
   *  `nextPage()`/`previousPage()`/an explicit `page` assignment. `renderBody()` withholds
   *  `activeId` in that case so `<lyra-virtual-list>` doesn't `scrollActiveIntoView()` back to a
   *  page boundary on every scroll-driven page crossing, fighting the user's own scroll. */
  @state() private scrollDrivenPage = false;
  private loadLibrary: () => Promise<PdfJsApi | null> = loadPdfJs;
  private generation = 0;
  private readonly pageCanvases = new Map<number, HTMLCanvasElement>();
  private readonly pageRenderTasks = new Map<number, { cancel(): void }>();
  private readonly pageCanvasRefs = new Map<number, (canvas: Element | undefined) => void>();
  private readonly textLayerContainers = new Map<number, HTMLElement>();
  private readonly textLayerContainerRefs = new Map<number, (element: Element | undefined) => void>();
  private readonly textLayers = new Map<number, { cancel(): void }>();
  private readonly textLayerReadyPromises = new Map<number, Promise<void>>();
  private readonly pageTextCache = new Map<number, Promise<string>>();
  private readonly thumbnailRenderTasks = new Map<HTMLCanvasElement, { cancel(): void }>();
  private readonly pageHighlightItems = new Map<number, HighlightLayerItem[]>();
  private readonly pageHighlightLayerElements = new Map<number, LyraHighlightLayer>();
  private readonly highlightLayerRefs = new Map<number, (element: Element | undefined) => void>();
  private textSelectionCleanup?: () => void;

  protected willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed); // reaches DocumentAnchorTarget's own willUpdate (declarative `anchor`)
    if (changed.has('page')) this.page = this.clampPage(this.page);
    if (changed.has('page') && !changed.has('scrollDrivenPage')) this.scrollDrivenPage = false;
    if (changed.has('zoom')) {
      this.zoom = clampZoom(this.zoom);
      for (const [pageNumber, canvas] of this.pageCanvases) void this.renderPage(pageNumber, canvas);
    }
  }

  protected updated(changed: PropertyValues): void {
    super.updated(changed);
    if (changed.has('src')) {
      this.scheduleAfterUpdate(() => {
        void this.load();
      });
      this.pageHighlightItems.clear();
      // getPageText() caches by page number alone -- without clearing it here, a page-1 lookup
      // from the previous document would still resolve to a cache hit, silently returning stale
      // text (and misdirecting any in-flight text-quote anchor scan) once the new document loads.
      this.pageTextCache.clear();
    }
    if (changed.has('page') && this.loadState.kind === 'ready') {
      this.emit('lyra-page-change', { page: this.page, pageCount: this.loadState.pageCount });
    }
    if (changed.has('zoom') && changed.get('zoom') !== undefined) this.emit('lyra-zoom-change', { zoom: this.zoom });
    if (changed.has('highlights')) {
      for (const pageNumber of this.pageCanvases.keys()) void this.resolvePageHighlights(pageNumber);
    }
    if (changed.has('activeHighlightId')) {
      for (const layer of this.pageHighlightLayerElements.values()) layer.activeId = this.activeHighlightId;
    }
  }

  firstUpdated(): void {
    const base = this.shadowRoot?.querySelector('[part="base"]') as HTMLElement | null;
    if (base) this.bindTextSelection(base);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.textSelectionCleanup?.();
    this.textSelectionCleanup = undefined;
    for (const task of this.pageRenderTasks.values()) task.cancel();
    for (const layer of this.textLayers.values()) layer.cancel();
    for (const task of this.thumbnailRenderTasks.values()) task.cancel();
    this.pageRenderTasks.clear();
    this.textLayers.clear();
    this.pageCanvases.clear();
    this.textLayerContainers.clear();
    this.textLayerReadyPromises.clear();
    this.pageTextCache.clear();
    this.thumbnailRenderTasks.clear();
    this.destroyLoadedDoc();
  }

  /** Releases the current PDF.js document's worker and buffered pages before replacing or dropping
   *  `loadState` -- `PDFDocumentProxy` is not garbage-collected on its own; every `src` change and
   *  every disconnect must explicitly `destroy()` the previous document or it (and its worker) leaks. */
  private destroyLoadedDoc(): void {
    if (this.loadState.kind === 'ready') void this.loadState.doc.destroy?.();
  }

  private clampPage(value: number): number {
    const pageCount = this.loadState.kind === 'ready' ? this.loadState.pageCount : 1;
    if (!Number.isFinite(value)) return 1;
    return Math.min(pageCount, Math.max(1, Math.round(value)));
  }

  private async load(): Promise<void> {
    const generation = ++this.generation;
    const signal = this.beginAbortableLoad();
    this.destroyLoadedDoc();
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
      const response = await fetch(url, signal ? { signal } : undefined);
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
      const data = await readResponseArrayBuffer(response);
      const pdfjsLib = await this.loadLibrary();
      if (!this.isConnected || generation !== this.generation) return;
      if (!pdfjsLib) {
        this.loadState = { kind: 'error', message: this.localize('pdfViewerMissingLibrary') };
        return;
      }
      const doc = await pdfjsLib.getDocument({ data }).promise;
      if (!this.isConnected || generation !== this.generation) return;
      this.page = 1;
      this.loadState = { kind: 'ready', doc, pageCount: doc.numPages };
      this.emit('lyra-load', { pageCount: doc.numPages });
    } catch (error) {
      if (isAbortError(error) || !this.isConnected || generation !== this.generation) return;
      this.loadState = { kind: 'error', message: this.localize(isResourceLimitError(error) ? 'documentPreviewResourceTooLarge' : 'documentPreviewFailedToLoad') };
      this.emit('lyra-render-error', { error });
    }
  }

  nextPage(): void { this.scrollDrivenPage = false; this.setPage(this.page + 1); }
  previousPage(): void { this.scrollDrivenPage = false; this.setPage(this.page - 1); }
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

  // -- anchor-target: applyAnchor per kind ---------------------------------------------------------

  protected async applyAnchor(anchor: LyraAnchor): Promise<boolean> {
    if (this.loadState.kind !== 'ready') return false;
    switch (anchor.kind) {
      case 'page': {
        const clamped = this.clampPage(anchor.page);
        if (this.page !== clamped) {
          this.scrollDrivenPage = false;
          this.page = clamped;
        }
        await this.updateComplete;
        return this.pageCanvases.has(clamped);
      }
      case 'text-quote':
        return this.applyTextQuoteAnchor(anchor);
      case 'region':
        return this.applyRegionAnchor(anchor);
      default:
        return false;
    }
  }

  private pageSearchOrder(hint: number | undefined, pageCount: number): number[] {
    if (hint == null) return Array.from({ length: pageCount }, (_unused, i) => i + 1);
    const clampedHint = Math.min(pageCount, Math.max(1, Math.round(hint)));
    const order = [clampedHint];
    for (let delta = 1; delta < pageCount; delta++) {
      if (clampedHint - delta >= 1) order.push(clampedHint - delta);
      if (clampedHint + delta <= pageCount) order.push(clampedHint + delta);
    }
    return order;
  }

  private async applyTextQuoteAnchor(anchor: Extract<LyraAnchor, { kind: 'text-quote' }>): Promise<boolean> {
    if (this.loadState.kind !== 'ready') return false;
    const quote = normalizeQuoteText(anchor.quote);
    if (!quote) return false;
    const order = this.pageSearchOrder(anchor.page, this.loadState.pageCount);
    let matchedPage: number | undefined;
    for (const pageNumber of order) {
      const text = await this.getPageText(pageNumber);
      if (normalizeQuoteText(text).includes(quote)) {
        matchedPage = pageNumber;
        break;
      }
    }
    if (matchedPage == null) return false;

    if (this.page !== matchedPage) {
      this.scrollDrivenPage = false;
      this.page = matchedPage;
    }
    await this.updateComplete;
    if (!this.pageCanvases.has(matchedPage)) return false;
    await this.textLayerReadyPromises.get(matchedPage);

    const range = this.resolveQuoteRangeOnPage(matchedPage, anchor);
    if (!range) return false;
    this.scrollRangeIntoView(range);
    return true;
  }

  private resolveQuoteRangeOnPage(pageNumber: number, anchor: { quote: string; prefix?: string; suffix?: string }): Range | null {
    const container = this.textLayerContainers.get(pageNumber);
    if (!container) return null;
    const items = Array.from(container.querySelectorAll<HTMLElement>('span')).map((element) => ({
      text: element.textContent ?? '',
      element,
    }));
    if (items.length === 0) return null;
    return resolveTextQuote(scopeFromItems(items), anchor);
  }

  private async applyRegionAnchor(anchor: Extract<LyraAnchor, { kind: 'region' }>): Promise<boolean> {
    if (this.loadState.kind !== 'ready' || anchor.page == null) return false;
    const clamped = this.clampPage(anchor.page);
    if (this.page !== clamped) {
      this.scrollDrivenPage = false;
      this.page = clamped;
    }
    await this.updateComplete;
    const canvas = this.pageCanvases.get(clamped);
    if (!canvas) return false;
    this.scrollPercentRectIntoView(canvas, anchor.rect);
    return true;
  }

  private virtualListScrollContainer(): HTMLElement | null {
    return (
      (this.shadowRoot?.querySelector('lyra-virtual-list')?.shadowRoot?.querySelector('[part="base"]') as HTMLElement | null) ?? null
    );
  }

  private scrollRangeIntoView(range: Range): void {
    const rect = range.getClientRects()[0];
    const scrollContainer = this.virtualListScrollContainer();
    if (!rect || !scrollContainer) return;
    const containerRect = scrollContainer.getBoundingClientRect();
    const offset = rect.top - containerRect.top - containerRect.height / 2 + rect.height / 2;
    scrollContainer.scrollBy({ top: offset, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
  }

  private scrollPercentRectIntoView(pageEl: HTMLElement, rect: { x: number; y: number; width: number; height: number }): void {
    const scrollContainer = this.virtualListScrollContainer();
    if (!scrollContainer) return;
    const pageRect = pageEl.getBoundingClientRect();
    const containerRect = scrollContainer.getBoundingClientRect();
    const targetY = pageRect.top + (rect.y / 100) * pageRect.height;
    const offset = targetY - containerRect.top - containerRect.height / 2;
    scrollContainer.scrollBy({ top: offset, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
  }

  // -- anchor-target: selection -> anchor ------------------------------------------------------------

  protected computeSelectionAnchor(range: Range): LyraAnchor | null {
    const pageNumber = this.pageForNode(range.startContainer);
    if (pageNumber == null) return null;
    const container = this.textLayerContainers.get(pageNumber);
    if (!container) return null;
    const items = Array.from(container.querySelectorAll<HTMLElement>('span')).map((element) => ({
      text: element.textContent ?? '',
      element,
    }));
    const scope = scopeFromItems(items);
    const anchor = buildQuoteAnchor(range, scope);
    return anchor.kind === 'text-quote' ? { ...anchor, page: pageNumber } : anchor;
  }

  private pageForNode(node: Node): number | null {
    for (const [pageNumber, container] of this.textLayerContainers) {
      if (container.contains(node)) return pageNumber;
    }
    return null;
  }

  /** Overrides `DocumentAnchorTarget`'s default selection binding. Page content renders inside
   *  `<lyra-virtual-list>`'s own nested shadow root (virtualization adds a second shadow boundary
   *  below this viewer's own render root), one level deeper than the mixin's default composed-range
   *  lookup resolves. Left unresolved, a selection ending inside a page's text layer retargets to the
   *  boundary of `<lyra-virtual-list>` itself, which has no light-DOM text of its own -- the resulting
   *  range stringifies to nothing and the selection is silently dropped. This override adds the
   *  virtual list's own shadow root to the lookup so the resolved range still reaches the actual
   *  selected text, then follows the same selection-end/rAF-debounced-`selectionchange` shape the
   *  default binding uses -- with one more adjustment: the default binding's own containment check
   *  (`contentRoot.contains(range.commonAncestorContainer)`) can't see past a shadow boundary either
   *  (`Node.contains()` only walks light-DOM `parentNode` links), so it's replaced here with
   *  `containsAcrossShadowBoundaries()`, which also follows a `ShadowRoot`'s `.host` link. */
  protected bindTextSelection(contentRoot: Element): void {
    this.textSelectionCleanup?.();

    const resolveSelectionRange = (): Range | null => {
      const hostShadowRoot = this.shadowRoot;
      const listShadowRoot = this.shadowRoot?.querySelector('lyra-virtual-list')?.shadowRoot ?? null;
      const globalSelection = window.getSelection() as
        | (Selection & { getComposedRanges?: (options: { shadowRoots: ShadowRoot[] }) => StaticRange[] })
        | null;

      if (globalSelection?.getComposedRanges && hostShadowRoot) {
        const shadowRoots = listShadowRoot ? [hostShadowRoot, listShadowRoot] : [hostShadowRoot];
        const [composed] = globalSelection.getComposedRanges({ shadowRoots });
        if (!composed) return null;
        if (composed.startContainer === composed.endContainer && composed.startOffset === composed.endOffset) return null;
        const range = document.createRange();
        range.setStart(composed.startContainer, composed.startOffset);
        range.setEnd(composed.endContainer, composed.endOffset);
        return range;
      }

      const nestedSelection = (listShadowRoot as unknown as { getSelection?: () => Selection | null } | null)?.getSelection?.();
      const selection = nestedSelection ?? globalSelection;
      if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return null;
      return selection.getRangeAt(0);
    };

    const onSelectionEnd = (): void => {
      const range = resolveSelectionRange();
      if (!range) return;
      if (!containsAcrossShadowBoundaries(contentRoot, range.commonAncestorContainer) && range.commonAncestorContainer !== contentRoot) return;
      const text = normalizeQuoteText(range.toString());
      if (!text) return;
      const anchor = this.computeSelectionAnchor(range);
      const rects = Array.from(range.getClientRects());
      this.emit<TextSelectDetail>('lyra-text-select', { text, anchor, rects });
    };

    let debounceHandle: ReturnType<typeof requestAnimationFrame> | undefined;
    const onSelectionChange = (): void => {
      if (debounceHandle !== undefined) cancelAnimationFrame(debounceHandle);
      debounceHandle = requestAnimationFrame(() => {
        debounceHandle = undefined;
        onSelectionEnd();
      });
    };

    contentRoot.addEventListener('pointerup', onSelectionEnd);
    contentRoot.addEventListener('keyup', onSelectionEnd);
    document.addEventListener('selectionchange', onSelectionChange);

    this.textSelectionCleanup = () => {
      contentRoot.removeEventListener('pointerup', onSelectionEnd);
      contentRoot.removeEventListener('keyup', onSelectionEnd);
      document.removeEventListener('selectionchange', onSelectionChange);
      if (debounceHandle !== undefined) cancelAnimationFrame(debounceHandle);
    };
  }

  // -- text/thumbnail exposure -------------------------------------------------------------------------

  /** Raw reading-order text of one page, independent of DOM materialization. Rejects on no loaded
   *  document or an out-of-range page. Per-page LRU cache (64 pages) with shared in-flight promises.
   *  Deliberately no `getDocumentText()` -- callers loop pages. */
  async getPageText(page: number): Promise<string> {
    if (this.loadState.kind !== 'ready') throw new Error('No PDF document is loaded.');
    const { pageCount } = this.loadState;
    if (!Number.isInteger(page) || page < 1 || page > pageCount) {
      throw new Error(`Page ${page} is out of range (1-${pageCount}).`);
    }
    const cached = this.pageTextCache.get(page);
    if (cached) {
      this.pageTextCache.delete(page);
      this.pageTextCache.set(page, cached); // bump recency (Map iteration order doubles as LRU order)
      return cached;
    }
    const promise = this.loadPageText(page);
    this.pageTextCache.set(page, promise);
    promise.catch(() => this.pageTextCache.delete(page));
    if (this.pageTextCache.size > PAGE_TEXT_CACHE_LIMIT) {
      const oldestKey = this.pageTextCache.keys().next().value;
      if (oldestKey !== undefined) this.pageTextCache.delete(oldestKey);
    }
    return promise;
  }

  private async loadPageText(page: number): Promise<string> {
    if (this.loadState.kind !== 'ready') throw new Error('No PDF document is loaded.');
    const pdfPage = await this.loadState.doc.getPage(page);
    const content = await pdfPage.getTextContent();
    let text = '';
    for (const item of content.items as { str?: string; hasEOL?: boolean }[]) {
      text += item.str ?? '';
      text += item.hasEOL ? '\n' : ' ';
    }
    return text;
  }

  /** Renders `page` into `canvas` at `width` CSS px (default 96), devicePixelRatio-aware. Cancels a
   *  prior in-flight render for the same canvas. Resolves `false` when not ready or out of range.
   *  Caller owns the canvas -- no bitmap transfer, no hidden cache. */
  async renderPageThumbnail(page: number, canvas: HTMLCanvasElement, options?: { width?: number }): Promise<boolean> {
    if (this.loadState.kind !== 'ready') return false;
    const { pageCount } = this.loadState;
    if (!Number.isInteger(page) || page < 1 || page > pageCount) return false;
    this.thumbnailRenderTasks.get(canvas)?.cancel();
    this.thumbnailRenderTasks.delete(canvas);
    const pdfPage = await this.loadState.doc.getPage(page);
    if (this.loadState.kind !== 'ready') return false;
    const width = options?.width ?? DEFAULT_THUMBNAIL_WIDTH;
    const unscaledViewport = pdfPage.getViewport({ scale: 1 });
    const scale = width / unscaledViewport.width;
    const viewport = pdfPage.getViewport({ scale });
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.floor(viewport.width * dpr);
    canvas.height = Math.floor(viewport.height * dpr);
    canvas.style.width = `${viewport.width}px`;
    canvas.style.height = `${viewport.height}px`;
    const context = canvas.getContext('2d');
    if (!context) return false;
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    const renderTask = pdfPage.render({ canvasContext: context, viewport });
    this.thumbnailRenderTasks.set(canvas, renderTask);
    try {
      await renderTask.promise;
      return this.thumbnailRenderTasks.get(canvas) === renderTask;
    } catch (error) {
      if (isAbortError(error)) return false;
      throw error;
    } finally {
      if (this.thumbnailRenderTasks.get(canvas) === renderTask) this.thumbnailRenderTasks.delete(canvas);
    }
  }

  // -- highlight painting --------------------------------------------------------------------------------

  private async resolvePageHighlights(pageNumber: number): Promise<void> {
    const container = this.textLayerContainers.get(pageNumber);
    const canvas = this.pageCanvases.get(pageNumber);
    if (!container || !canvas || this.loadState.kind !== 'ready') return;
    const items = Array.from(container.querySelectorAll<HTMLElement>('span')).map((element) => ({
      text: element.textContent ?? '',
      element,
    }));
    const scope = items.length ? scopeFromItems(items) : undefined;
    const pageRect = canvas.getBoundingClientRect();
    const results: HighlightLayerItem[] = [];
    for (const highlight of this.highlights) {
      const rects = this.resolveHighlightRectsForPage(highlight.anchor, pageNumber, scope, pageRect);
      if (rects.length) results.push({ id: highlight.id, rects, label: highlight.label, tone: highlight.tone });
    }
    this.pageHighlightItems.set(pageNumber, results);
    const layer = this.pageHighlightLayerElements.get(pageNumber);
    if (layer) layer.items = results;
  }

  private resolveHighlightRectsForPage(
    anchor: LyraAnchor,
    pageNumber: number,
    scope: TextQuoteScope | undefined,
    pageRect: DOMRect,
  ): { x: number; y: number; width: number; height: number }[] {
    if (anchor.kind === 'page' && anchor.page === pageNumber) return [{ x: 0, y: 0, width: 100, height: 100 }];
    if (anchor.kind === 'region' && (anchor.page ?? pageNumber) === pageNumber) return [anchor.rect];
    if (anchor.kind === 'text-quote' && scope && (anchor.page == null || anchor.page === pageNumber)) {
      const range = resolveTextQuote(scope, anchor);
      if (!range) return [];
      return Array.from(range.getClientRects()).map((rect) => ({
        x: ((rect.left - pageRect.left) / pageRect.width) * 100,
        y: ((rect.top - pageRect.top) / pageRect.height) * 100,
        width: (rect.width / pageRect.width) * 100,
        height: (rect.height / pageRect.height) * 100,
      }));
    }
    return [];
  }

  private highlightLayerRef(pageNumber: number): (element: Element | undefined) => void {
    let callback = this.highlightLayerRefs.get(pageNumber);
    if (!callback) {
      callback = (element) => {
        if (!element) {
          this.pageHighlightLayerElements.delete(pageNumber);
          return;
        }
        const layer = element as LyraHighlightLayer;
        this.pageHighlightLayerElements.set(pageNumber, layer);
        layer.items = this.pageHighlightItems.get(pageNumber) ?? [];
        layer.activeId = this.activeHighlightId;
        const canvas = this.pageCanvases.get(pageNumber);
        if (canvas?.style.width) {
          layer.style.width = canvas.style.width;
          layer.style.height = canvas.style.height;
        }
      };
      this.highlightLayerRefs.set(pageNumber, callback);
    }
    return callback;
  }

  /** Pointer-activation hit-test for a page's painted highlights -- see the class doc for why this
   *  exists instead of relying on the highlight layer's own click handling. */
  private onPageClick(pageNumber: number, e: MouseEvent): void {
    const selection = window.getSelection();
    if (selection && !selection.isCollapsed) return;
    const canvas = this.pageCanvases.get(pageNumber);
    const items = this.pageHighlightItems.get(pageNumber);
    if (!canvas || !items || items.length === 0) return;
    const pageRect = canvas.getBoundingClientRect();
    const xPct = ((e.clientX - pageRect.left) / pageRect.width) * 100;
    const yPct = ((e.clientY - pageRect.top) / pageRect.height) * 100;
    for (let i = items.length - 1; i >= 0; i--) {
      const hit = items[i].rects.some(
        (rect) => xPct >= rect.x && xPct <= rect.x + rect.width && yPct >= rect.y && yPct <= rect.y + rect.height,
      );
      if (hit) {
        this.emit<HighlightActivateDetail>('lyra-highlight-activate', { id: items[i].id });
        return;
      }
    }
  }

  // -- rendering --------------------------------------------------------------------------------------------

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
      container.style.setProperty('--total-scale-factor', String(this.zoom));
    }
    const highlightLayerEl = this.pageHighlightLayerElements.get(pageNumber);
    if (highlightLayerEl) {
      highlightLayerEl.style.width = `${viewport.width}px`;
      highlightLayerEl.style.height = `${viewport.height}px`;
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
      if (!isAbortError(error) && this.isConnected && this.pageRenderTasks.get(pageNumber) === renderTask) this.emit('lyra-render-error', { error });
    } finally {
      if (this.pageRenderTasks.get(pageNumber) === renderTask) this.pageRenderTasks.delete(pageNumber);
    }
  }

  private async renderTextLayer(pageNumber: number, page: PdfJsApi, viewport: PdfJsApi): Promise<void> {
    const container = this.textLayerContainers.get(pageNumber);
    if (!container || !page.streamTextContent || this.loadState.kind !== 'ready') return;
    const pdfjsLib = await this.loadLibrary();
    if (!pdfjsLib || !pdfjsLib.TextLayer || this.textLayerContainers.get(pageNumber) !== container) return;
    container.replaceChildren();
    const textLayer = new pdfjsLib.TextLayer({ textContentSource: page.streamTextContent(), container, viewport });
    this.textLayers.set(pageNumber, textLayer);
    const renderPromise = textLayer.render().then(
      () => undefined,
      (error: unknown) => {
        if (!isAbortError(error) && this.isConnected && this.textLayers.get(pageNumber) === textLayer) this.emit('lyra-render-error', { error });
      },
    );
    this.textLayerReadyPromises.set(pageNumber, renderPromise);
    await renderPromise;
    if (this.textLayers.get(pageNumber) === textLayer) void this.resolvePageHighlights(pageNumber);
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
          this.textLayerReadyPromises.delete(pageNumber);
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
    const highlightTransform = this.effectiveDirection === 'rtl' ? '50%' : '-50%';
    return html`<div part="page" @click=${(e: MouseEvent) => this.onPageClick(number, e)}>
      <canvas ${ref(this.pageCanvasRef(number))}></canvas>
      <lyra-highlight-layer
        ${ref(this.highlightLayerRef(number))}
        style="position:absolute; inset-block-start:var(--lyra-space-m); inset-inline-start:50%; transform:translateX(${highlightTransform});"
      ></lyra-highlight-layer>
      <div part="text-layer" ${ref(this.textLayerContainerRef(number))}></div>
    </div>`;
  };

  private onVisibleRangeChanged = (event: CustomEvent<{ start: number }>): void => {
    if (this.loadState.kind !== 'ready') return;
    const next = this.clampPage(event.detail.start + 1);
    if (next === this.page) return;
    this.scrollDrivenPage = true;
    this.page = next;
  };

  private renderBody(): TemplateResult {
    switch (this.loadState.kind) {
      case 'ready': {
        const items = Array.from({ length: this.loadState.pageCount }, (_unused, index) => index + 1);
        return html`${this.renderToolbar()}<lyra-virtual-list part="pages" .items=${items} .renderItem=${this.renderPageItem} .keyFunction=${(item: unknown) => item as number} .activeId=${this.scrollDrivenPage ? '' : this.page} @lyra-visible-range-changed=${this.onVisibleRangeChanged}></lyra-virtual-list>`;
      }
      case 'loading': return html`<div part="spinner"><lyra-skeleton variant="rect" label=${this.localize('loadingDocument')}></lyra-skeleton></div>`;
      case 'error': return html`<div part="error" role="alert">${this.loadState.message}</div>`;
      case 'idle': default: return html`<p class="empty-note">${this.localize('documentPreviewEmpty', undefined, { type: this.localize('documentPreviewTypeDocument') })}</p>`;
    }
  }

  render(): TemplateResult {
    return html`<div part="base" aria-label=${this.getAttribute('aria-label') || this.name || this.localize('pdfViewerLabel')}>${this.renderBody()}${this.renderAnchorLiveRegion()}</div>`;
  }
}

declare global { interface HTMLElementTagNameMap { 'lyra-pdf-viewer': LyraPdfViewer; } }
