import { html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import { ref } from 'lit/directives/ref.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { finiteCount, finiteNumber, finiteRange } from '../../../internal/numbers.js';
import { safeFetchUrl } from '../../../internal/safe-url.js';
import {
  isAbortError,
  isResourceLimitError,
  LyraUserFacingError,
  readResponseArrayBuffer,
} from '../../../internal/resource-loader.js';
import { srOnly } from '../../../internal/a11y.js';
import { prefersReducedMotion } from '../../../internal/motion.js';
import { DocumentAnchorTarget, type LyraAnchorTargetEventMap } from '../../../internal/anchor-target.js';
import {
  normalizeQuoteText,
  scopeFromItems,
  resolveTextQuote,
  buildQuoteAnchor,
  type TextQuoteScope,
} from '../../../internal/text-quote.js';
import type { LyraHighlightLayer, HighlightLayerItem } from '../highlight-layer/highlight-layer.class.js';
import type { LyraAnchor, HighlightActivateDetail, TextSelectDetail } from '../document-viewer/anchors.js';
import { loadPdfJs, type PdfJsApi } from './pdf-loader.js';
import { styles } from './pdf-viewer.styles.js';
import { getNumberFormat, getSegmenter } from '../../../internal/intl-cache.js';

const MIN_ZOOM = 0.25;
const MAX_ZOOM = 4;
const ZOOM_STEP = 0.25;
const PAGE_TEXT_CACHE_LIMIT = 64;
const DEFAULT_THUMBNAIL_WIDTH = 96;
const MAX_THUMBNAIL_WIDTH = 2048;
const MAX_PAGE_COUNT = 100_000;
const MAX_SEARCH_MATCHES = 10_000;

/** Clamps a candidate zoom multiplier to `[MIN_ZOOM, MAX_ZOOM]`, defaulting non-finite/`NaN` input
 *  to `1` (100%) rather than letting it reach the PDF.js viewport scale unsanitized. */
function clampZoom(value: number): number {
  return finiteRange(value, 1, MIN_ZOOM, MAX_ZOOM);
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

/** One entry of a PDF's table of contents, as returned by `getOutline()`. `page` is a 1-based page
 *  number; it's omitted when the entry's destination couldn't be resolved to a page. */
export interface PdfOutlineItem {
  title: string;
  page?: number;
  children?: PdfOutlineItem[];
}

/** One `search()` match, in `getPageText()`'s own raw coordinate space -- what lets a match be
 *  located back inside the real per-page text layer for painting. */
interface PdfSearchMatch {
  page: number;
  start: number;
  length: number;
}

interface NormalizedSearchText {
  text: string;
  /** Inclusive raw start for each UTF-16 unit in `text`. */
  rawStarts: number[];
  /** Exclusive raw end for each UTF-16 unit in `text`. */
  rawEnds: number[];
}

interface SearchCaseSegment {
  text: string;
  start: number;
  end: number;
}

function searchCaseFold(value: string, locale: string): string {
  let lowered: string;
  try {
    lowered = value.toLocaleLowerCase(locale);
  } catch (error) {
    if (!(error instanceof RangeError)) throw error;
    lowered = value.toLowerCase();
  }
  // Unicode caseless matching treats the medial and final lowercase sigma forms as equivalent.
  return lowered.replaceAll('ς', 'σ');
}

function searchCaseSegments(value: string, locale: string): SearchCaseSegment[] {
  if (typeof Intl.Segmenter === 'function') {
    let segments: Intl.Segments;
    try {
      segments = getSegmenter(locale, { granularity: 'grapheme' }).segment(value);
    } catch (error) {
      if (!(error instanceof RangeError)) throw error;
      segments = getSegmenter(undefined, { granularity: 'grapheme' }).segment(value);
    }
    return [...segments].map(({ segment, index }) => ({
      text: segment,
      start: index,
      end: index + segment.length,
    }));
  }

  const segments: SearchCaseSegment[] = [];
  let start = 0;
  for (const text of value) {
    segments.push({ text, start, end: start + text.length });
    start += text.length;
  }
  return segments;
}

/** Collapses whitespace runs to single spaces and locale-folds the complete string so contextual
 *  Unicode casing is preserved. Start/end maps retain the raw range behind each folded UTF-16 unit;
 *  an expanded grapheme maps every expansion unit to the complete raw grapheme so painted matches
 *  never split or overrun the original PDF text layer. */
function normalizeForSearch(raw: string, locale: string): NormalizedSearchText {
  let text = '';
  const rawStarts: number[] = [];
  const rawEnds: number[] = [];
  let lastWasSpace = false;
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i]!;
    if (/\s/.test(ch)) {
      if (!lastWasSpace && text.length > 0) {
        text += ' ';
        rawStarts.push(i);
        rawEnds.push(i + 1);
        lastWasSpace = true;
      }
      continue;
    }
    text += ch;
    rawStarts.push(i);
    rawEnds.push(i + 1);
    lastWasSpace = false;
  }
  if (text.endsWith(' ')) {
    text = text.slice(0, -1);
    rawStarts.pop();
    rawEnds.pop();
  }

  const folded = searchCaseFold(text, locale);
  if (folded.length === text.length) return { text: folded, rawStarts, rawEnds };

  const segments = searchCaseSegments(text, locale);
  const isolatedLength = segments.reduce(
    (length, segment) => length + searchCaseFold(segment.text, locale).length,
    0,
  );
  const foldedStarts: number[] = [];
  const foldedEnds: number[] = [];
  let foldedStart = 0;
  for (const segment of segments) {
    const foldedEnd =
      segment.end === text.length
        ? folded.length
        : isolatedLength === folded.length
          ? foldedStart + searchCaseFold(segment.text, locale).length
          : searchCaseFold(text.slice(0, segment.end), locale).length;
    const foldedLength = foldedEnd - foldedStart;
    const rawLength = segment.end - segment.start;
    if (foldedLength === rawLength) {
      for (let offset = 0; offset < foldedLength; offset++) {
        foldedStarts.push(rawStarts[segment.start + offset]!);
        foldedEnds.push(rawEnds[segment.start + offset]!);
      }
    } else {
      const rawStart = rawStarts[segment.start]!;
      const rawEnd = rawEnds[segment.end - 1]!;
      for (let offset = 0; offset < foldedLength; offset++) {
        foldedStarts.push(rawStart);
        foldedEnds.push(rawEnd);
      }
    }
    foldedStart = foldedEnd;
  }
  return { text: folded, rawStarts: foldedStarts, rawEnds: foldedEnds };
}

export interface LyraPdfViewerEventMap extends LyraAnchorTargetEventMap {
  'lr-render-error': CustomEvent<{ error: unknown }>;
  'lr-page-change': CustomEvent<{ page: number; pageCount: number }>;
  'lr-zoom-change': CustomEvent<{ zoom: number }>;
  'lr-load': CustomEvent<{ pageCount: number }>;
  'lr-search-change': CustomEvent<{ query: string; matchCount: number; activeIndex: number }>;
}

class LyraPdfViewerBase extends LyraElement<LyraPdfViewerEventMap> {}

/**
 * Fetches PDF bytes and renders their pages with the optional `pdfjs-dist` peer. Pages are composed
 * through `lr-virtual-list`, while a PDF.js text layer keeps rendered text selectable and copyable.
 * Adopts `DocumentAnchorTarget`: `page`, `text-quote`, and `region` anchors resolve; highlights paint
 * via one `<lr-highlight-layer>` per page, stacked beneath the text layer (canvas -> highlights ->
 * text layer) so starting a text selection over a cited passage keeps working. Pointer activation of
 * a highlight is hit-tested at the page-wrapper level (`onPageClick`) since the text layer sitting on
 * top intercepts most direct pointer events; keyboard activation reaches the highlight layer's own
 * roving-tabindex rects directly, since z-stacking doesn't affect tab order. Accepted residual: a
 * click that ends a text-selection drag over a highlighted passage never activates it (the
 * selection-in-progress check in `onPageClick` exists precisely to distinguish that case from a
 * genuine activation click).
 *
 * @customElement lr-pdf-viewer
 * @event lr-render-error - Fired when fetching, parsing, or rendering fails.
 * @event lr-page-change - Fired when the current page changes.
 * @event lr-zoom-change - Fired when the zoom multiplier changes.
 * @event lr-load - Fired once the document reaches `ready`. `detail: { pageCount }`.
 * @event lr-highlight-activate - A highlight was activated. `detail: { id }`.
 * @event lr-text-select - A text selection ended inside a page's text layer. `detail: { text,
 *   anchor, rects }`.
 * @event lr-anchor-result - Fired after an `anchor` (or `scrollToAnchor()` call) is applied.
 *   `detail: { found }`.
 * @event lr-search-change - Fired whenever the search query, match count, or active match index
 *   changes, from `search()`/`searchNext()`/`searchPrevious()`/`clearSearch()`. `detail: { query,
 *   matchCount, activeIndex }`.
 * @csspart base - The root viewer container.
 * @csspart toolbar - Pagination and zoom controls.
 * @csspart page-indicator - The current page text.
 * @csspart zoom-indicator - The current zoom percentage.
 * @csspart pages - The virtualized page list.
 * @csspart page - One rendered page wrapper.
 * @csspart page-canvas - The canvas a page's content is painted onto.
 * @csspart text-layer - Selectable text positioned over a page canvas.
 * @csspart text-span - One generated text run inside a page's text layer.
 * @csspart search-match - A painted in-document search match.
 * @csspart search-match-active - The currently active search match (also carries `search-match`).
 * @csspart error - The error message region.
 * @csspart spinner - The loading status region.
 * @cssprop [--lr-pdf-viewer-height=var(--lr-size-24rem)] - Block size of the virtualized page list.
 *   Also settable via the `max-height` property.
 */
export class LyraPdfViewer extends DocumentAnchorTarget(LyraPdfViewerBase) {
  static override styles = [LyraElement.styles, styles, srOnly];

  /** URL to fetch and render as a PDF document. */
  @property() src = '';
  /** Display name used as the document's accessible label fallback. */
  @property() name = '';
  /** One-based current page, clamped to the loaded document's page count. */
  @property({ type: Number, reflect: true }) page = 1;
  /** Page zoom multiplier, clamped to the range 0.25–4. */
  @property({ type: Number, reflect: true }) zoom = 1;
  /** A CSS length (e.g. `"30rem"`); once set, overrides `--lr-pdf-viewer-height` -- the block size
   *  of the virtualized page list -- declaratively, the same `max-height` attribute
   *  `<lr-notebook-viewer>`/`<lr-svg-viewer>`/`<lr-xml-viewer>` expose, rather than requiring a
   *  consumer to set the differently-named CSS custom property inline. */
  @property({ attribute: 'max-height' }) maxHeight = '';

  /** Anchor kinds this viewer resolves. */
  override readonly anchorKinds = ['page', 'text-quote', 'region'] as const;

  @state() private loadState: PdfLoadState = { kind: 'idle' };
  /** True while `page` was last set by the user scrolling the page list rather than by
   *  `nextPage()`/`previousPage()`/an explicit `page` assignment. `renderBody()` withholds
   *  `activeId` in that case so `<lr-virtual-list>` doesn't `scrollActiveIntoView()` back to a
   *  page boundary on every scroll-driven page crossing, fighting the user's own scroll. */
  @state() private scrollDrivenPage = false;
  private loadLibrary: () => Promise<PdfJsApi | null> = loadPdfJs;
  private generation = 0;
  private readonly pageCanvases = new Map<number, HTMLCanvasElement>();
  private readonly pageRenderTasks = new Map<number, { cancel(): void }>();
  private readonly pageRenderVersions = new Map<number, number>();
  private readonly pageCanvasRefs = new Map<number, (canvas: Element | undefined) => void>();
  private readonly textLayerContainers = new Map<number, HTMLElement>();
  private readonly textLayerContainerRefs = new Map<number, (element: Element | undefined) => void>();
  private readonly textLayers = new Map<number, { cancel(): void }>();
  private readonly textLayerReadyPromises = new Map<number, Promise<void>>();
  private readonly pageTextCache = new Map<number, Promise<string>>();
  private readonly thumbnailRenderTasks = new Map<HTMLCanvasElement, { cancel(): void }>();
  private readonly thumbnailRenderVersions = new Map<HTMLCanvasElement, number>();
  private readonly pageHighlightItems = new Map<number, HighlightLayerItem[]>();
  private readonly pageHighlightLayerElements = new Map<number, LyraHighlightLayer>();
  private readonly highlightLayerRefs = new Map<number, (element: Element | undefined) => void>();
  private textSelectionCleanup?: () => void;

  @state() private searchMatches: PdfSearchMatch[] = [];
  @state() private searchActiveIndex = -1;
  private searchQuery = '';
  private searchGeneration = 0;

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed); // reaches DocumentAnchorTarget's own willUpdate (declarative `anchor`)
    if (changed.has('page')) this.page = this.clampPage(this.page);
    if (changed.has('page') && !changed.has('scrollDrivenPage')) this.scrollDrivenPage = false;
    if (changed.has('zoom')) {
      this.zoom = clampZoom(this.zoom);
      for (const [pageNumber, canvas] of this.pageCanvases) void this.renderPage(pageNumber, canvas);
    }
    if (changed.has('src')) {
      // Search match page/offset coordinates are only meaningful for the document they were found
      // in -- silently reset (no event) rather than emit, mirroring how pageHighlightItems/
      // pageTextCache reset without notifying either (see updated() below); the painted marks
      // themselves are torn down for free along with the old page DOM as lr-virtual-list
      // re-renders with the new document. Reset here (not updated()) so re-assigning these @state()
      // fields folds into this same update cycle instead of scheduling a follow-up one.
      this.searchGeneration++;
      this.searchQuery = '';
      this.searchMatches = [];
      this.searchActiveIndex = -1;
    }
  }

  protected override updated(changed: PropertyValues): void {
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
      this.emit('lr-page-change', { page: this.page, pageCount: this.loadState.pageCount });
    }
    if (changed.has('zoom') && changed.get('zoom') !== undefined) this.emit('lr-zoom-change', { zoom: this.zoom });
    if (changed.has('highlights')) {
      for (const pageNumber of this.pageCanvases.keys()) void this.resolvePageHighlights(pageNumber);
    }
    if (changed.has('activeHighlightId')) {
      for (const layer of this.pageHighlightLayerElements.values()) layer.activeId = this.activeHighlightId;
    }
  }

  override firstUpdated(): void {
    const base = this.shadowRoot?.querySelector('[part="base"]') as HTMLElement | null;
    if (base) this.bindTextSelection(base);
  }

  override connectedCallback(): void {
    super.connectedCallback();
    if (this.hasUpdated) {
      const base = this.shadowRoot?.querySelector('[part="base"]') as HTMLElement | null;
      if (base && !this.textSelectionCleanup) this.bindTextSelection(base);
      if (this.src) this.scheduleAfterUpdate(() => { void this.load(); });
    }
  }

  override disconnectedCallback(): void {
    this.generation++;
    this.searchGeneration++;
    this.beginAbortableLoad();
    this.textSelectionCleanup?.();
    this.textSelectionCleanup = undefined;
    for (const task of this.pageRenderTasks.values()) task.cancel();
    for (const layer of this.textLayers.values()) layer.cancel();
    for (const task of this.thumbnailRenderTasks.values()) task.cancel();
    this.pageRenderTasks.clear();
    this.pageRenderVersions.clear();
    this.textLayers.clear();
    this.pageCanvases.clear();
    this.textLayerContainers.clear();
    this.textLayerReadyPromises.clear();
    this.pageTextCache.clear();
    this.thumbnailRenderTasks.clear();
    this.thumbnailRenderVersions.clear();
    this.destroyLoadedDoc();
    this.loadState = { kind: 'idle' };
    super.disconnectedCallback();
  }

  /** Releases the current PDF.js document's worker and buffered pages before replacing or dropping
   *  `loadState` -- `PDFDocumentProxy` is not garbage-collected on its own; every `src` change and
   *  every disconnect must explicitly `destroy()` the previous document or it (and its worker) leaks. */
  private destroyLoadedDoc(): void {
    if (this.loadState.kind === 'ready') void this.loadState.doc.destroy?.();
  }

  /** Clamps a candidate page number to `[1, pageCount]` (or `[1, 1]` before a document is loaded),
   *  rounding a fractional page to the nearest whole page and defaulting a non-finite/`NaN` page
   *  to `1` rather than letting it reach the virtualized page list unsanitized. */
  private clampPage(value: number): number {
    const pageCount = this.loadState.kind === 'ready' ? this.loadState.pageCount : 1;
    const rounded = Math.round(finiteNumber(value, 1));
    return finiteRange(rounded, 1, 1, pageCount);
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
      const error = new LyraUserFacingError(this.localize('documentPreviewUrlNotAllowed'));
      this.loadState = { kind: 'error', message: error.message };
      this.emit('lr-render-error', { error });
      return;
    }
    this.loadState = { kind: 'loading' };
    try {
      const response = await fetch(url, signal ? { signal } : undefined);
      if (!this.isConnected || generation !== this.generation) return;
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
      const data = await readResponseArrayBuffer(response);
      if (!this.isConnected || generation !== this.generation) return;
      const pdfjsLib = await this.loadLibrary();
      if (!this.isConnected || generation !== this.generation) return;
      if (!pdfjsLib) {
        const error = new LyraUserFacingError(this.localize('pdfViewerMissingLibrary'));
        this.loadState = { kind: 'error', message: error.message };
        this.emit('lr-render-error', { error });
        return;
      }
      const doc = await pdfjsLib.getDocument({ data }).promise;
      if (!this.isConnected || generation !== this.generation) {
        await doc.destroy?.();
        return;
      }
      const pageCount = finiteCount(doc.numPages, 0, MAX_PAGE_COUNT);
      if (pageCount < 1 || pageCount !== doc.numPages) {
        await doc.destroy?.();
        throw new LyraUserFacingError(this.localize('documentPreviewResourceTooLarge'));
      }
      this.page = 1;
      this.loadState = { kind: 'ready', doc, pageCount };
      this.emit('lr-load', { pageCount });
    } catch (error) {
      if (isAbortError(error) || !this.isConnected || generation !== this.generation) return;
      this.loadState = {
        kind: 'error',
        message: error instanceof LyraUserFacingError
          ? error.message
          : this.localize(isResourceLimitError(error) ? 'documentPreviewResourceTooLarge' : 'documentPreviewFailedToLoad'),
      };
      this.emit('lr-render-error', { error });
    }
  }

  nextPage(): void { this.scrollDrivenPage = false; this.setPage(this.page + 1); }
  previousPage(): void { this.scrollDrivenPage = false; this.setPage(this.page - 1); }
  zoomIn(): void { this.setZoom(this.zoom + ZOOM_STEP); }
  zoomOut(): void { this.setZoom(this.zoom - ZOOM_STEP); }

  /** Sets `page` and resolves once the target page's canvas has actually mounted inside the
   *  virtualized list (bounded by a timeout, so a page that somehow never mounts can't hang this
   *  promise forever). Resolves `false` without changing `page` for an out-of-range value. */
  async goToPage(page: number): Promise<boolean> {
    if (this.loadState.kind !== 'ready') return false;
    if (!Number.isInteger(page) || page < 1 || page > this.loadState.pageCount) return false;
    if (page === this.page && this.pageCanvases.has(page)) return true;
    this.scrollDrivenPage = false;
    this.page = page;
    await this.updateComplete;
    return this.waitForPageMount(page);
  }

  private waitForPageMount(page: number): Promise<boolean> {
    if (this.pageCanvases.has(page)) return Promise.resolve(true);
    const list = this.shadowRoot?.querySelector('lr-virtual-list');
    if (!list) return Promise.resolve(false);
    return new Promise((resolve) => {
      const onRange = (): void => {
        if (this.pageCanvases.has(page)) {
          list.removeEventListener('lr-visible-range-changed', onRange as EventListener);
          clearTimeout(timeoutId);
          resolve(true);
        }
      };
      list.addEventListener('lr-visible-range-changed', onRange as EventListener);
      const timeoutId = setTimeout(() => {
        list.removeEventListener('lr-visible-range-changed', onRange as EventListener);
        resolve(false);
      }, 500);
    });
  }

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
      (this.shadowRoot?.querySelector('lr-virtual-list')?.shadowRoot?.querySelector('[part="base"]') as HTMLElement | null) ?? null
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
   *  `<lr-virtual-list>`'s own nested shadow root (virtualization adds a second shadow boundary
   *  below this viewer's own render root), one level deeper than the mixin's default composed-range
   *  lookup resolves. Left unresolved, a selection ending inside a page's text layer retargets to the
   *  boundary of `<lr-virtual-list>` itself, which has no light-DOM text of its own -- the resulting
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
      const listShadowRoot = this.shadowRoot?.querySelector('lr-virtual-list')?.shadowRoot ?? null;
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
      this.emit<TextSelectDetail>('lr-text-select', { text, anchor, rects });
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
    const doc = this.loadState.doc;
    const pdfPage = await doc.getPage(page);
    if (this.loadState.kind !== 'ready' || this.loadState.doc !== doc) throw new DOMException('Superseded', 'AbortError');
    const content = await pdfPage.getTextContent();
    if (this.loadState.kind !== 'ready' || this.loadState.doc !== doc) throw new DOMException('Superseded', 'AbortError');
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
    const version = (this.thumbnailRenderVersions.get(canvas) ?? 0) + 1;
    this.thumbnailRenderVersions.set(canvas, version);
    const doc = this.loadState.doc;
    const pdfPage = await doc.getPage(page);
    if (
      this.loadState.kind !== 'ready' ||
      this.loadState.doc !== doc ||
      this.thumbnailRenderVersions.get(canvas) !== version
    ) return false;
    const width = options?.width ?? DEFAULT_THUMBNAIL_WIDTH;
    if (!Number.isFinite(width) || width <= 0 || width > MAX_THUMBNAIL_WIDTH) return false;
    const unscaledViewport = pdfPage.getViewport({ scale: 1 });
    if (!Number.isFinite(unscaledViewport.width) || unscaledViewport.width <= 0) return false;
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
      return this.thumbnailRenderTasks.get(canvas) === renderTask &&
        this.thumbnailRenderVersions.get(canvas) === version;
    } catch (error) {
      if (isAbortError(error)) return false;
      throw error;
    } finally {
      if (this.thumbnailRenderTasks.get(canvas) === renderTask) this.thumbnailRenderTasks.delete(canvas);
    }
  }

  // -- outline ---------------------------------------------------------------------------------------

  /** Maps pdf.js's own `getOutline()` tree to `PdfOutlineItem[]`, resolving each entry's
   *  destination to a 1-based page number best-effort -- an unresolvable destination keeps its
   *  `title`/`children` with `page` omitted rather than dropping the entry. `[]` for a document with
   *  no outline or before one is loaded. */
  async getOutline(): Promise<PdfOutlineItem[]> {
    if (this.loadState.kind !== 'ready') return [];
    const doc = this.loadState.doc;
    if (!doc.getOutline) return [];
    const raw = await doc.getOutline();
    if (!raw) return [];
    return Promise.all((raw as PdfJsApi[]).map((item) => this.mapOutlineItem(doc, item)));
  }

  private async mapOutlineItem(doc: PdfJsApi, item: PdfJsApi): Promise<PdfOutlineItem> {
    const page = await this.resolveOutlineDestPage(doc, item.dest);
    const rawChildren = (item.items ?? []) as PdfJsApi[];
    const children =
      rawChildren.length > 0 ? await Promise.all(rawChildren.map((child) => this.mapOutlineItem(doc, child))) : undefined;
    return {
      title: String(item.title ?? ''),
      ...(page !== undefined ? { page } : {}),
      ...(children ? { children } : {}),
    };
  }

  private async resolveOutlineDestPage(doc: PdfJsApi, dest: unknown): Promise<number | undefined> {
    if (!dest) return undefined;
    try {
      const explicitDest = typeof dest === 'string' ? await doc.getDestination(dest) : dest;
      const ref = Array.isArray(explicitDest) ? explicitDest[0] : undefined;
      if (!ref) return undefined;
      const pageIndex = await doc.getPageIndex(ref);
      return typeof pageIndex === 'number' ? pageIndex + 1 : undefined;
    } catch {
      return undefined;
    }
  }

  // -- search ----------------------------------------------------------------------------------------

  /** Case-insensitive substring search over every page's text (via `getPageText()`). Matches are
   *  stored in `getPageText()`'s own raw coordinate space via a normalized/raw offset table (see
   *  `normalizeForSearch()`), never touching `highlights` -- painting is a self-contained overlay
   *  scoped to search only (see `paintSearchMatches()`). An empty/whitespace-only query behaves like
   *  `clearSearch()` and resolves `0`. */
  async search(query: string): Promise<number> {
    const generation = ++this.searchGeneration;
    this.searchQuery = query;
    this.clearSearchPaint();
    if (this.loadState.kind !== 'ready' || !query.trim()) {
      this.searchMatches = [];
      this.searchActiveIndex = -1;
      this.emitSearchChange();
      return 0;
    }
    const { pageCount } = this.loadState;
    const normalizedQuery = normalizeForSearch(query.trim(), this.effectiveLocale).text;
    const matches: PdfSearchMatch[] = [];
    for (let page = 1; page <= pageCount; page++) {
      if (generation !== this.searchGeneration) return this.searchMatches.length;
      let raw: string;
      try {
        raw = await this.getPageText(page);
      } catch {
        continue;
      }
      if (generation !== this.searchGeneration) return this.searchMatches.length;
      const { text, rawStarts, rawEnds } = normalizeForSearch(raw, this.effectiveLocale);
      let from = 0;
      let idx: number;
      while ((idx = text.indexOf(normalizedQuery, from)) !== -1) {
        const rawStart = rawStarts[idx] ?? 0;
        const rawEndExclusive = rawEnds[idx + normalizedQuery.length - 1] ?? rawStart;
        matches.push({ page, start: rawStart, length: rawEndExclusive - rawStart });
        if (matches.length >= MAX_SEARCH_MATCHES) break;
        from = idx + Math.max(1, normalizedQuery.length);
      }
      if (matches.length >= MAX_SEARCH_MATCHES) break;
    }
    if (generation !== this.searchGeneration) return this.searchMatches.length;
    this.searchMatches = matches;
    this.searchActiveIndex = matches.length > 0 ? 0 : -1;
    this.emitSearchChange();
    if (this.searchActiveIndex >= 0) await this.focusSearchMatch(this.searchActiveIndex);
    return matches.length;
  }

  /** Advances to the next match, wrapping to the first after the last. Resolves `false` (no-op)
   *  when there are no matches. */
  async searchNext(): Promise<boolean> {
    if (this.searchMatches.length === 0) return false;
    this.searchActiveIndex = (this.searchActiveIndex + 1) % this.searchMatches.length;
    this.emitSearchChange();
    await this.focusSearchMatch(this.searchActiveIndex);
    return true;
  }

  /** Moves to the previous match, wrapping to the last before the first. Resolves `false` (no-op)
   *  when there are no matches. */
  async searchPrevious(): Promise<boolean> {
    if (this.searchMatches.length === 0) return false;
    this.searchActiveIndex = (this.searchActiveIndex - 1 + this.searchMatches.length) % this.searchMatches.length;
    this.emitSearchChange();
    await this.focusSearchMatch(this.searchActiveIndex);
    return true;
  }

  /** Clears the query, matches, and any painted marks, and resets `lr-search-change` to a
   *  0-match/no-active-index state. */
  clearSearch(): void {
    this.searchGeneration++;
    this.searchQuery = '';
    this.searchMatches = [];
    this.searchActiveIndex = -1;
    this.clearSearchPaint();
    this.emit('lr-search-change', { query: '', matchCount: 0, activeIndex: -1 });
  }

  private emitSearchChange(): void {
    this.emit('lr-search-change', {
      query: this.searchQuery,
      matchCount: this.searchMatches.length,
      activeIndex: this.searchActiveIndex,
    });
  }

  private async focusSearchMatch(index: number): Promise<void> {
    const match = this.searchMatches[index];
    if (!match) return;
    await this.goToPage(match.page);
    // Wait for an in-flight text-layer render for the target page, if any, so the very first paint
    // attempt lands on real content instead of an empty container -- the renderTextLayer() hook below
    // re-paints anyway once ready, but this avoids a needless empty-container round-trip.
    await this.textLayerReadyPromises.get(match.page);
    this.paintSearchMatches(match.page);
  }

  /** Unwraps every painted `<mark part="search-match">` back into plain text, across every mounted
   *  page's text-layer container (or just `container` when given, for a single-page repaint). */
  private clearSearchPaint(container?: HTMLElement): void {
    const containers = container ? [container] : Array.from(this.textLayerContainers.values());
    for (const target of containers) {
      target.querySelectorAll('mark[part~="search-match"]').forEach((mark) => {
        const parent = mark.parentNode;
        if (!parent) return;
        while (mark.firstChild) parent.insertBefore(mark.firstChild, mark);
        parent.removeChild(mark);
        parent.normalize();
      });
    }
  }

  /** Walks the given page's mounted text-layer container in the same order `getPageText()` reads
   *  it (raw text-node concatenation) and wraps each search match's raw-offset range in a
   *  `<mark part="search-match">` (`search-match-active` added for the current match). A page whose
   *  text layer hasn't mounted yet (out of the virtualized render window) is silently skipped --
   *  painting resumes the next time that page's text layer finishes rendering, via the hook in
   *  `renderTextLayer()`. */
  private paintSearchMatches(page: number): void {
    const container = this.textLayerContainers.get(page);
    if (!container) return;
    this.clearSearchPaint(container);
    const pageMatches = this.searchMatches
      .map((match, matchIndex) => ({ ...match, matchIndex }))
      .filter((match) => match.page === page);
    if (pageMatches.length === 0) return;
    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
    const ranges: { node: Text; start: number; end: number }[] = [];
    let cursor = 0;
    let node: Text | null;
    while ((node = walker.nextNode() as Text | null)) {
      const len = node.data.length;
      ranges.push({ node, start: cursor, end: cursor + len });
      cursor += len + 1;
    }
    for (const r of ranges) {
      // Every match intersecting this one physical text node, left-to-right. Two matches can land in
      // the same node when the search term repeats within one text-layer span (e.g. "aab" inside
      // "aabaab") -- surroundContents() below extracts/splits the node as each one is wrapped, so a
      // later match's offset must be computed against the node it *actually* lives in post-split, not
      // the pristine reference `ranges` captured before any painting started (that stale reference is
      // what used to throw an uncaught IndexSizeError from setStart()/setEnd()).
      const intersecting = pageMatches
        .map((match) => ({
          matchIndex: match.matchIndex,
          start: Math.max(match.start, r.start),
          end: Math.min(match.start + match.length, r.end),
        }))
        .filter((m) => m.start < m.end)
        .sort((a, b) => a.start - b.start);
      let currentNode: Text = r.node;
      let currentNodeRawStart = r.start;
      for (const m of intersecting) {
        const range = document.createRange();
        try {
          range.setStart(currentNode, m.start - currentNodeRawStart);
          range.setEnd(currentNode, m.end - currentNodeRawStart);
        } catch {
          // Defensive only -- the running currentNode/currentNodeRawStart bookkeeping above is meant
          // to keep this offset always valid; one bad match still shouldn't take down the rest of the
          // page's painting.
          continue;
        }
        const mark = document.createElement('mark');
        const parts = ['search-match'];
        if (m.matchIndex === this.searchActiveIndex) parts.push('search-match-active');
        mark.setAttribute('part', parts.join(' '));
        try {
          range.surroundContents(mark);
        } catch {
          // A range spanning a text-layer span boundary in a way surroundContents can't wrap --
          // best-effort painting, the match is still reachable via goToPage()/searchNext().
          continue;
        }
        // surroundContents() extracts the matched text out of currentNode, leaving whatever came
        // after it in a new sibling Text node right after the inserted <mark> -- that's where a
        // further match in this same original node now lives, starting at this match's raw end.
        const remainder = mark.nextSibling;
        if (remainder instanceof Text) {
          currentNode = remainder;
          currentNodeRawStart = m.end;
        } else {
          break; // nothing left in this node for a further match to land in
        }
      }
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
      const item = items[i];
      if (!item) continue; // safe: counted loop over items — never undefined in-bounds
      const hit = item.rects.some(
        (rect) => xPct >= rect.x && xPct <= rect.x + rect.width && yPct >= rect.y && yPct <= rect.y + rect.height,
      );
      if (hit) {
        this.emit<HighlightActivateDetail>('lr-highlight-activate', { id: item.id });
        return;
      }
    }
  }

  // -- rendering --------------------------------------------------------------------------------------------

  private renderToolbar(): TemplateResult {
    if (this.loadState.kind !== 'ready') return html``;
    const { pageCount } = this.loadState;
    const numberFormat = getNumberFormat(this.effectiveLocale);
    const formattedZoom = numberFormat.format(Math.round(this.zoom * 100));
    return html`<div part="toolbar">
      <button type="button" data-action="previous" ?disabled=${this.page <= 1} aria-label=${this.localize('pdfViewerPreviousPage')} @click=${this.previousPage}>${this.localize('pdfViewerPreviousPage')}</button>
      <span part="page-indicator">${this.localize('pdfViewerPageOf', undefined, {
        page: numberFormat.format(this.page),
        total: numberFormat.format(pageCount),
      })}</span>
      <button type="button" data-action="next" ?disabled=${this.page >= pageCount} aria-label=${this.localize('pdfViewerNextPage')} @click=${this.nextPage}>${this.localize('pdfViewerNextPage')}</button>
      <button type="button" data-action="zoom-out" ?disabled=${this.zoom <= MIN_ZOOM} aria-label=${this.localize('pdfViewerZoomOut')} @click=${this.zoomOut}>${this.localize('pdfViewerZoomOut')}</button>
      <span part="zoom-indicator" aria-label=${this.localize('pdfViewerCurrentZoom', undefined, { percent: formattedZoom })}>${this.localize('pdfViewerCurrentZoom', undefined, { percent: formattedZoom })}</span>
      <button type="button" data-action="zoom-in" ?disabled=${this.zoom >= MAX_ZOOM} aria-label=${this.localize('pdfViewerZoomIn')} @click=${this.zoomIn}>${this.localize('pdfViewerZoomIn')}</button>
    </div>`;
  }

  private async renderPage(pageNumber: number, canvas: HTMLCanvasElement): Promise<void> {
    if (this.loadState.kind !== 'ready') return;
    const version = (this.pageRenderVersions.get(pageNumber) ?? 0) + 1;
    this.pageRenderVersions.set(pageNumber, version);
    const doc = this.loadState.doc;
    const zoom = this.zoom;
    this.pageRenderTasks.get(pageNumber)?.cancel();
    this.pageRenderTasks.delete(pageNumber);
    this.textLayers.get(pageNumber)?.cancel();
    this.textLayers.delete(pageNumber);
    const page = await doc.getPage(pageNumber);
    if (
      this.loadState.kind !== 'ready' ||
      this.loadState.doc !== doc ||
      this.pageRenderVersions.get(pageNumber) !== version ||
      this.pageCanvases.get(pageNumber) !== canvas
    ) return;
    const viewport = page.getViewport({ scale: zoom });
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.floor(viewport.width * dpr);
    canvas.height = Math.floor(viewport.height * dpr);
    canvas.style.width = `${viewport.width}px`;
    canvas.style.height = `${viewport.height}px`;
    const container = this.textLayerContainers.get(pageNumber);
    if (container) {
      container.style.width = `${viewport.width}px`;
      container.style.height = `${viewport.height}px`;
      container.style.setProperty('--total-scale-factor', String(zoom));
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
    void this.renderTextLayer(pageNumber, page, viewport, version);
    try {
      await renderTask.promise;
    } catch (error) {
      if (!isAbortError(error) && this.isConnected && this.pageRenderTasks.get(pageNumber) === renderTask) this.emit('lr-render-error', { error });
    } finally {
      if (this.pageRenderTasks.get(pageNumber) === renderTask) this.pageRenderTasks.delete(pageNumber);
    }
  }

  private async renderTextLayer(
    pageNumber: number,
    page: PdfJsApi,
    viewport: PdfJsApi,
    version: number,
  ): Promise<void> {
    const container = this.textLayerContainers.get(pageNumber);
    if (!container || !page.streamTextContent || this.loadState.kind !== 'ready') return;
    const pdfjsLib = await this.loadLibrary();
    if (
      !pdfjsLib ||
      !pdfjsLib.TextLayer ||
      this.pageRenderVersions.get(pageNumber) !== version ||
      this.textLayerContainers.get(pageNumber) !== container
    ) return;
    container.replaceChildren();
    const textLayer = new pdfjsLib.TextLayer({ textContentSource: page.streamTextContent(), container, viewport });
    this.textLayers.set(pageNumber, textLayer);
    const renderPromise = textLayer.render().then(
      () => undefined,
      (error: unknown) => {
        if (!isAbortError(error) && this.isConnected && this.textLayers.get(pageNumber) === textLayer) this.emit('lr-render-error', { error });
      },
    );
    this.textLayerReadyPromises.set(pageNumber, renderPromise);
    await renderPromise;
    if (this.textLayers.get(pageNumber) === textLayer && this.pageRenderVersions.get(pageNumber) === version) {
      this.markTextRunParts(container);
      void this.resolvePageHighlights(pageNumber);
      // A page that mounts (or remounts, e.g. after a zoom change re-renders every visible page) while
      // it already has search matches needs its marks painted here too -- focusSearchMatch() only
      // paints the page it just navigated to, not every page that might scroll into view afterward.
      if (this.searchMatches.some((match) => match.page === pageNumber)) this.paintSearchMatches(pageNumber);
    }
  }

  /** Names every text run PDF.js just generated as a `text-span` part. The runs are created
   *  imperatively by `TextLayer.render()`, and they land inside `<lr-virtual-list>`'s shadow root
   *  along with the rest of the page item -- so the stylesheet reaches them through
   *  `lr-virtual-list::part(text-span)`, which cannot be written as a descendant of the
   *  `text-layer` part. Naming them also makes each run reachable from a consumer's own
   *  `lr-pdf-viewer::part(text-span)` rule. */
  private markTextRunParts(container: HTMLElement): void {
    container.querySelectorAll('span, br').forEach((run) => run.setAttribute('part', 'text-span'));
  }

  private pageCanvasRef(pageNumber: number): (element: Element | undefined) => void {
    let callback = this.pageCanvasRefs.get(pageNumber);
    if (!callback) {
      callback = (element: Element | undefined): void => {
        if (!element) {
          this.pageRenderVersions.set(pageNumber, (this.pageRenderVersions.get(pageNumber) ?? 0) + 1);
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
      <canvas part="page-canvas" ${ref(this.pageCanvasRef(number))}></canvas>
      <lr-highlight-layer
        ${ref(this.highlightLayerRef(number))}
        style="position:absolute; inset-block-start:var(--lr-space-m); inset-inline-start:50%; transform:translateX(${highlightTransform});"
      ></lr-highlight-layer>
      <div part="text-layer" ${ref(this.textLayerContainerRef(number))}></div>
    </div>`;
  };

  private onVisibleRangeChanged = (event: CustomEvent<{ start: number }>): void => {
    event.stopPropagation();
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
        return html`${this.renderToolbar()}<lr-virtual-list part="pages" exportparts="page:page, page-canvas:page-canvas, text-layer:text-layer, text-span:text-span, search-match:search-match, search-match-active:search-match-active" .items=${items} .renderItem=${this.renderPageItem} .keyFunction=${(item: unknown) => item as number} .activeId=${this.scrollDrivenPage ? '' : this.page} @lr-visible-range-changed=${this.onVisibleRangeChanged}></lr-virtual-list>`;
      }
      case 'loading': return html`<div part="spinner"><lr-skeleton variant="rect" label=${this.localize('loadingDocument')}></lr-skeleton></div>`;
      case 'error': return html`<div part="error" role="alert">${this.loadState.message}</div>`;
      case 'idle': default: return html`<p class="empty-note">${this.localize('documentPreviewEmpty', undefined, { type: this.localize('documentPreviewTypeDocument') })}</p>`;
    }
  }

  override render(): TemplateResult {
    return html`<div
      part="base"
      role="region"
      style=${this.maxHeight ? `--lr-pdf-viewer-height:${this.maxHeight}` : nothing}
      aria-label=${this.getAttribute('aria-label') || this.name || this.localize('pdfViewerLabel')}
    >${this.renderBody()}${this.renderAnchorLiveRegion()}</div>`;
  }
}

declare global { interface HTMLElementTagNameMap { 'lr-pdf-viewer': LyraPdfViewer; } }
