import { html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import { ref } from 'lit/directives/ref.js';
import { styleMap } from 'lit/directives/style-map.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { invalidateLyraLocaleCache } from '../../../internal/localization-runtime.js';
import { finiteCount, finiteNumber, finiteRange } from '../../../internal/numbers.js';
import {
  isAbortError,
  isResourceLimitError,
  LyraUserFacingError,
  readResponseArrayBuffer,
  resolveOwnerFetchTarget,
} from '../../../internal/resource-loader.js';
import { srOnly } from '../../../internal/a11y.js';
import { prefersReducedMotion } from '../../../internal/motion.js';
import { sanitizeCssLength, sanitizePercentRect } from '../../../internal/safe-css.js';
import {
  DocumentAnchorTarget,
  prioritizedHighlightCandidates,
  type LyraAnchorTargetEventMap,
} from '../../../internal/anchor-target.js';
import {
  boundedSelectionRects,
  boundedSelectionText,
  normalizeQuoteText,
  scopeFromItems,
  buildQuoteAnchor,
  createTextQuoteIndex,
  rangeFromTextQuoteMatch,
  rangesFromTextQuoteMatches,
  TEXT_QUOTE_LIMITS,
  type TextQuoteIndex,
  type TextQuoteMatch,
  type TextQuoteScope,
  type TextQuoteWorkBudget,
} from '../../../internal/text-quote.js';
import type { LyraHighlightLayer, HighlightLayerItem, LyraHighlightLayerEventMap } from '../highlight-layer/highlight-layer.class.js';
import type { LyraAnchor, LyraHighlight } from '../document-viewer/anchors.js';
import type {
  LyraPageViewerSnapshot,
  LyraPageViewerStateChangeDetail,
} from '../page-rail/page-rail.class.js';
import type { LyraVirtualListIndexedSource } from '../../layout/virtual-list/virtual-list.class.js';
import { ViewerAnnouncementController } from '../viewer-announcements.js';
import { boundedViewerSearchQuery } from '../viewer-search-limits.js';
import { viewerSemanticLabel, viewerSemanticRole } from '../viewer-semantic-owner.js';
import {
  loadPdfJs,
  type PdfDocumentApi,
  type PdfJsApi,
  type PdfOutlineEntryApi,
  type PdfPageApi,
  type PdfViewportApi,
} from './pdf-loader.js';
import { styles } from './pdf-viewer.styles.js';
import { getNumberFormat } from '../../../internal/intl-cache.js';
import type { LyraSearchChangeDetail } from '../../../internal/text-viewer-target.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_anchorJumped, LYRA_DEFAULT_anchorJumpedToPage, LYRA_DEFAULT_anchorNotFound, LYRA_DEFAULT_documentPreviewEmpty, LYRA_DEFAULT_documentPreviewFailedToLoad, LYRA_DEFAULT_documentPreviewResourceTooLarge, LYRA_DEFAULT_documentPreviewTypeDocument, LYRA_DEFAULT_documentPreviewUrlNotAllowed, LYRA_DEFAULT_loadingDocument, LYRA_DEFAULT_pdfViewerCurrentZoom, LYRA_DEFAULT_pdfViewerLabel, LYRA_DEFAULT_pdfViewerMissingLibrary, LYRA_DEFAULT_pdfViewerNextPage, LYRA_DEFAULT_pdfViewerPageOf, LYRA_DEFAULT_pdfViewerPreviousPage, LYRA_DEFAULT_pdfViewerZoomIn, LYRA_DEFAULT_pdfViewerZoomOut } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END


const MIN_ZOOM = 0.25;
const MAX_ZOOM = 4;
const ZOOM_STEP = 0.25;
const PAGE_TEXT_CACHE_LIMIT = 64;
const PAGE_SEARCH_INDEX_CACHE_LIMIT = 8;
const DEFAULT_THUMBNAIL_WIDTH = 96;
const MAX_THUMBNAIL_WIDTH = 2048;
const MAX_PAGE_COUNT = 100_000;
const MAX_SEARCH_MATCHES = 10_000;
const MAX_PAINTED_SEARCH_MATCHES = 200;
const MAX_PAINTED_SEARCH_MARKS = 200;
const MAX_PAINTED_HIGHLIGHTS = 100;
const MAX_HIGHLIGHT_RESOLUTION_ATTEMPTS = 1_000;
const MAX_HIGHLIGHT_RECTS = 1_000;
const MAX_SEARCH_PAGES = 1_000;
const MAX_OUTLINE_ITEMS = 10_000;
const MAX_OUTLINE_DEPTH = 100;
const MAX_PDF_TEXT_CHUNKS = TEXT_QUOTE_LIMITS.maxNodes;

interface PdfHighlightPaintBudget {
  readonly work: TextQuoteWorkBudget;
  remainingResolutionAttempts: number;
  remainingItems: number;
  remainingRects: number;
}

interface PdfPageTextResult {
  readonly text: string;
  readonly truncated: boolean;
}

interface PdfPageTextCacheEntry {
  promise: Promise<PdfPageTextResult>;
  cancelled: boolean;
  reader?: ReadableStreamDefaultReader<unknown>;
}

interface PdfTextAccumulator {
  readonly chunks: string[];
  length: number;
  inspectedItems: number;
  truncated: boolean;
}

interface PdfTextLayerBudget {
  remainingItems: number;
  remainingCodeUnits: number;
}

function isReadablePdfTextStream(value: unknown): value is ReadableStream<unknown> {
  return (typeof value === 'object' || typeof value === 'function')
    && value !== null
    && 'getReader' in value
    && typeof value.getReader === 'function';
}

/** Appends one peer chunk without enumerating or retaining anything beyond the page ceilings. */
function appendPdfTextItems(items: unknown, accumulator: PdfTextAccumulator): void {
  if (!Array.isArray(items)) return;
  for (let index = 0; index < items.length; index++) {
    if (accumulator.inspectedItems >= TEXT_QUOTE_LIMITS.maxNodes) {
      accumulator.truncated = true;
      return;
    }
    accumulator.inspectedItems++;
    const item = items[index];
    const value = item && typeof item === 'object' && 'str' in item && typeof item.str === 'string'
      ? item.str
      : '';
    const separator = item && typeof item === 'object' && 'hasEOL' in item && item.hasEOL === true
      ? '\n'
      : ' ';
    const remaining = TEXT_QUOTE_LIMITS.maxNodeCodeUnits - accumulator.length;
    if (remaining <= 0) {
      accumulator.truncated = true;
      return;
    }
    const retained = value.slice(0, remaining);
    accumulator.chunks.push(retained);
    accumulator.length += retained.length;
    if (retained.length !== value.length) {
      accumulator.truncated = true;
      return;
    }
    if (accumulator.length >= TEXT_QUOTE_LIMITS.maxNodeCodeUnits) {
      accumulator.truncated = true;
      return;
    }
    accumulator.chunks.push(separator);
    accumulator.length++;
  }
}

function boundedPdfTextLayerChunk(
  value: unknown,
  budget: PdfTextLayerBudget,
): { readonly value: unknown; readonly exhausted: boolean } {
  if (!value || typeof value !== 'object' || !('items' in value) || !Array.isArray(value.items)) {
    return { value, exhausted: false };
  }
  const source = value as {
    readonly items: unknown[];
    readonly styles?: unknown;
    readonly lang?: unknown;
  };
  const items: unknown[] = [];
  const fontNames = new Set<string>();
  let inspected = 0;
  while (
    inspected < source.items.length
    && budget.remainingItems > 0
    && budget.remainingCodeUnits > 0
  ) {
    const item = source.items[inspected++]!;
    if (!item || typeof item !== 'object') {
      items.push(item);
      budget.remainingItems--;
      continue;
    }
    const text = 'str' in item && typeof item.str === 'string' ? item.str : undefined;
    if (text !== undefined && text.length > budget.remainingCodeUnits) {
      const retained = text.slice(0, budget.remainingCodeUnits);
      if (retained) {
        const record = item as Record<string, unknown>;
        items.push({
          str: retained,
          dir: record['dir'],
          width: record['width'],
          height: record['height'],
          transform: record['transform'],
          fontName: record['fontName'],
          hasEOL: record['hasEOL'],
        });
        if (typeof record['fontName'] === 'string') fontNames.add(record['fontName']);
        budget.remainingItems--;
      }
      budget.remainingCodeUnits = 0;
      break;
    }
    items.push(item);
    budget.remainingItems--;
    if (text !== undefined) budget.remainingCodeUnits -= text.length;
    if ('fontName' in item && typeof item.fontName === 'string') fontNames.add(item.fontName);
  }
  const styles: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
  if (source.styles && typeof source.styles === 'object') {
    const sourceStyles = source.styles as Record<string, unknown>;
    for (const fontName of fontNames) styles[fontName] = sourceStyles[fontName];
  }
  return {
    value: { items, styles, lang: source.lang },
    exhausted: inspected < source.items.length
      || budget.remainingItems <= 0
      || budget.remainingCodeUnits <= 0,
  };
}

function singleChunkPdfTextStream(value?: unknown): ReadableStream<unknown> {
  return new ReadableStream<unknown>({
    start(controller) {
      if (value !== undefined) controller.enqueue(value);
      controller.close();
    },
  });
}

/** Wraps PDF.js's peer stream so its TextLayer never receives more DOM-producing input than Lyra
 * can subsequently index. A direct legacy `{ items }` stand-in is synchronously clipped first;
 * every other non-stream/opaque value becomes an empty stream and therefore fails closed. */
function boundedPdfTextLayerSource(source: unknown): unknown {
  const budget: PdfTextLayerBudget = {
    remainingItems: TEXT_QUOTE_LIMITS.maxNodes,
    remainingCodeUnits: TEXT_QUOTE_LIMITS.maxNodeCodeUnits,
  };
  if (typeof ReadableStream === 'undefined') return undefined;
  if (!isReadablePdfTextStream(source)) {
    const bounded = boundedPdfTextLayerChunk(source, budget);
    const hasBoundedItems = bounded.value
      && typeof bounded.value === 'object'
      && 'items' in bounded.value
      && Array.isArray(bounded.value.items);
    return singleChunkPdfTextStream(hasBoundedItems ? bounded.value : undefined);
  }
  const reader = source.getReader();
  let chunks = 0;
  let closed = false;
  return new ReadableStream<unknown>({
    async pull(controller): Promise<void> {
      if (closed) return;
      try {
        const result = await reader.read();
        if (result.done) {
          closed = true;
          controller.close();
          return;
        }
        chunks++;
        const bounded = boundedPdfTextLayerChunk(result.value, budget);
        controller.enqueue(bounded.value);
        if (bounded.exhausted || chunks >= MAX_PDF_TEXT_CHUNKS) {
          closed = true;
          void reader.cancel().catch(() => undefined);
          controller.close();
        }
      } catch (error) {
        closed = true;
        controller.error(error);
      }
    },
    cancel(reason): Promise<void> {
      closed = true;
      return reader.cancel(reason).then(() => undefined, () => undefined);
    },
  });
}

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
    current = current.nodeType === 11 && 'host' in current
      ? (current as ShadowRoot).host
      : current.parentNode;
  }
  return false;
}

interface PdfPaintWorkBudget {
  traversalNodes: number;
  codeUnits: number;
  marks: number;
}

function nextPdfPaintNode(node: Node, root: Node): Node | null {
  if (node.firstChild) return node.firstChild;
  let cursor: Node | null = node;
  while (cursor && cursor !== root) {
    if (cursor.nextSibling) return cursor.nextSibling;
    cursor = cursor.parentNode;
  }
  return null;
}

/** Wraps only the text portions of a range, with shared traversal/code-unit ceilings. */
function wrapPdfSearchRange(
  range: Range,
  part: string,
  budget: PdfPaintWorkBudget,
): HTMLElement[] {
  const doc = range.startContainer.ownerDocument;
  if (!doc || budget.marks <= 0) return [];
  const textNodeType = doc.defaultView?.Node.TEXT_NODE ?? 3;
  if (range.startContainer === range.endContainer && range.startContainer.nodeType === textNodeType) {
    const textNode = range.startContainer as Text;
    // `splitText()` copies the retained head/tail, so charge the complete source node rather than
    // only the selected slice; a tiny match inside a hostile multi-megabyte node is still large work.
    if (budget.traversalNodes <= 0 || budget.codeUnits <= 0) return [];
    const inspectedLength = textNode.data.length;
    if (inspectedLength > budget.codeUnits) {
      budget.codeUnits = 0;
      return [];
    }
    budget.traversalNodes--;
    budget.codeUnits -= inspectedLength;
    let target = textNode;
    if (range.endOffset < target.data.length) target.splitText(range.endOffset);
    if (range.startOffset > 0) target = target.splitText(range.startOffset);
    if (!target.data) return [];
    const mark = doc.createElement('mark');
    mark.setAttribute('part', part);
    target.parentNode?.insertBefore(mark, target);
    mark.appendChild(target);
    budget.marks--;
    return [mark];
  }
  const ancestor = range.commonAncestorContainer;
  const covered: Text[] = [];
  let node: Node | null = ancestor;
  while (node && budget.traversalNodes > 0 && budget.codeUnits > 0) {
    budget.traversalNodes--;
    if (node.nodeType === textNodeType) {
      const textNode = node as Text;
      if (textNode.data.length > budget.codeUnits) {
        budget.codeUnits = 0;
        break;
      }
      budget.codeUnits -= textNode.data.length;
      try {
        if (textNode.data.length > 0 && range.intersectsNode(textNode)) {
          // Fail closed before mutating the DOM when one logical match alone would exceed the
          // remaining aggregate mark budget. Returning a prefix would visually misquote it.
          if (covered.length >= budget.marks) return [];
          covered.push(textNode);
        }
      } catch {
        return [];
      }
    }
    node = nextPdfPaintNode(node, ancestor);
  }
  if (node) return [];
  const marks: HTMLElement[] = [];
  for (const textNode of covered) {
    const start = textNode === range.startContainer ? range.startOffset : 0;
    const end = textNode === range.endContainer ? range.endOffset : textNode.data.length;
    let target = textNode;
    if (end < target.data.length) target.splitText(end);
    if (start > 0) target = target.splitText(start);
    if (!target.data) continue;
    const mark = doc.createElement('mark');
    mark.setAttribute('part', part);
    target.parentNode?.insertBefore(mark, target);
    mark.appendChild(target);
    marks.push(mark);
  }
  budget.marks -= marks.length;
  return marks;
}

/** Rejoins only the Text nodes split by `wrapPdfSearchRange`; unlike `parent.normalize()`, this
 * never recursively walks an entire text layer once per mark. */
function unwrapPdfSearchMark(mark: Element): void {
  const parent = mark.parentNode;
  if (!parent) return;
  const textNodeType = mark.ownerDocument.defaultView?.Node.TEXT_NODE ?? 3;
  const before = mark.previousSibling;
  const after = mark.nextSibling;
  const first = mark.firstChild;
  while (mark.firstChild) parent.insertBefore(mark.firstChild, mark);
  parent.removeChild(mark);

  if (before?.nodeType === textNodeType && first?.nodeType === textNodeType) {
    (before as Text).appendData((first as Text).data);
    first.parentNode?.removeChild(first);
    if (after?.nodeType === textNodeType) {
      (before as Text).appendData((after as Text).data);
      after.parentNode?.removeChild(after);
    }
    return;
  }
  if (first?.nodeType === textNodeType && after?.nodeType === textNodeType) {
    (first as Text).appendData((after as Text).data);
    after.parentNode?.removeChild(after);
  } else if (!first && before?.nodeType === textNodeType && after?.nodeType === textNodeType) {
    (before as Text).appendData((after as Text).data);
    after.parentNode?.removeChild(after);
  }
}

type PdfLoadState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'ready'; doc: PdfDocumentApi; pageCount: number }
  | { kind: 'error'; message: string };

/** One entry of a PDF's table of contents, as returned by `getOutline()`. `page` is a 1-based page
 *  number; it's omitted when the entry's destination couldn't be resolved to a page. */
export interface PdfOutlineItem {
  title: string;
  page?: number;
  children?: PdfOutlineItem[];
}

/** One `search()` match in the shared normalized text-quote coordinate space. */
interface PdfSearchMatch {
  page: number;
  start: number;
  length: number;
}

interface PdfPageTextIndex {
  scope: TextQuoteScope;
  index: TextQuoteIndex;
  locale: string;
  sourceText?: string;
  sourceWorkCodeUnits: number;
  container?: HTMLElement;
  mappingDirty?: boolean;
}

export interface LyraPdfViewerEventMap extends LyraAnchorTargetEventMap {
  'lr-render-error': CustomEvent<{ error: unknown }>;
  'lr-page-change': CustomEvent<{ page: number; pageCount: number }>;
  'lr-zoom-change': CustomEvent<{ zoom: number }>;
  'lr-load': CustomEvent<{ pageCount: number }>;
  'lr-search-change': CustomEvent<LyraSearchChangeDetail>;
  'lr-page-viewer-state-change': CustomEvent<LyraPageViewerStateChangeDetail>;
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
 * @event lr-render-error - Fired when fetching, parsing, or rendering fails, including synchronous
 *   or rejected text-layer rendering. Text-layer failures are contained without an unhandled
 *   promise rejection.
 * @event lr-page-change - Fired when the current page changes.
 * @event lr-zoom-change - Fired when the zoom multiplier changes.
 * @event lr-load - Fired once the document reaches `ready`. `detail: { pageCount }`.
 * @event lr-highlight-activate - A highlight was activated. `detail: { highlightId }`.
 * @event lr-text-select - A text selection ended inside a page's text layer. `detail: { text,
 *   anchor, rects }`.
 * @event lr-anchor-result - Fired after an `anchor` (or `scrollToAnchor()` call) is applied.
 *   `detail: { found }`.
 * @event lr-search-change - Fired whenever the search query, match count, or active match index
 *   changes, including source-reset and effective-locale re-evaluation. `detail: { query,
 *   matchCount, matchCountExact, activeIndex }`. Search accepts at most 4,096 query code units,
 *   scans at most 1,000 pages/1,000,000 corpus code units/4,000,000 search code units, and retains
 *   at most 10,000 matches; a false `matchCountExact` makes `matchCount` a lower bound (including
 *   when a page could not be read or any ceiling is reached).
 * @event lr-page-viewer-state-change - Correlated page lifecycle state. `detail.snapshot` is the
 *   same readonly value exposed by `pageViewerSnapshot`; its `identity` changes for every load.
 * @csspart base - The named root viewer container with explicit `aria-busy`.
 * @csspart toolbar - Pagination and zoom controls.
 * @csspart previous-button - The previous-page button.
 * @csspart next-button - The next-page button.
 * @csspart zoom-out-button - The zoom-out button.
 * @csspart zoom-in-button - The zoom-in button.
 * @csspart page-indicator - The current page text.
 * @csspart zoom-indicator - The current zoom percentage.
 * @csspart pages - The virtualized page list.
 * @csspart page - One rendered page wrapper.
 * @csspart page-canvas - The canvas a page's content is painted onto.
 * @csspart page-error - A visible, page-local fallback when one page fails without invalidating
 *   the rest of the document.
 * @csspart page-error-visible - A currently visible page-local fallback (also carries
 *   `page-error`).
 * @csspart text-layer - Selectable text positioned over a page canvas.
 * @csspart text-span - One generated text run inside a page's text layer.
 * @csspart search-match - A painted in-document search match.
 * @csspart search-match-active - The currently active search match (also carries `search-match`).
 * @csspart error - Visible ordinary error text; transitions announce through the shared
 *   document-level assertive region.
 * @csspart spinner - The decorative loading placeholder and its ordinary visually-hidden label;
 *   transitions announce through the shared document-level polite region.
 * @cssprop [--lr-pdf-viewer-height=var(--lr-size-24rem)] - Block size of the virtualized page list.
 * @cssprop [--lr-pdf-viewer-toolbar-button-hover-bg=var(--lr-color-surface)] - Hover fill of the
 *   toolbar buttons. Defaults to the surface fill rather than the toolbar's own tint so the hover
 *   state is actually visible against it.
 *   Also settable via the `max-height` property.
 * @cssprop [--lr-pdf-viewer-search-match-bg=var(--lr-color-warning-quiet)] - Background of a
 *   painted, non-active search match.
 * @cssprop [--lr-pdf-viewer-search-match-active-bg=var(--lr-color-warning)] - Background of the
 *   currently active search match.
 * @status stable
 * @since 4.0.0
 */
export class LyraPdfViewer extends DocumentAnchorTarget(LyraPdfViewerBase) {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    anchorJumped: LYRA_DEFAULT_anchorJumped,
    anchorJumpedToPage: LYRA_DEFAULT_anchorJumpedToPage,
    anchorNotFound: LYRA_DEFAULT_anchorNotFound,
    documentPreviewEmpty: LYRA_DEFAULT_documentPreviewEmpty,
    documentPreviewFailedToLoad: LYRA_DEFAULT_documentPreviewFailedToLoad,
    documentPreviewResourceTooLarge: LYRA_DEFAULT_documentPreviewResourceTooLarge,
    documentPreviewTypeDocument: LYRA_DEFAULT_documentPreviewTypeDocument,
    documentPreviewUrlNotAllowed: LYRA_DEFAULT_documentPreviewUrlNotAllowed,
    loadingDocument: LYRA_DEFAULT_loadingDocument,
    pdfViewerCurrentZoom: LYRA_DEFAULT_pdfViewerCurrentZoom,
    pdfViewerLabel: LYRA_DEFAULT_pdfViewerLabel,
    pdfViewerMissingLibrary: LYRA_DEFAULT_pdfViewerMissingLibrary,
    pdfViewerNextPage: LYRA_DEFAULT_pdfViewerNextPage,
    pdfViewerPageOf: LYRA_DEFAULT_pdfViewerPageOf,
    pdfViewerPreviousPage: LYRA_DEFAULT_pdfViewerPreviousPage,
    pdfViewerZoomIn: LYRA_DEFAULT_pdfViewerZoomIn,
    pdfViewerZoomOut: LYRA_DEFAULT_pdfViewerZoomOut,
  };
  // GENERATED DEFAULT-STRING SLICE: END

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
   *  consumer to set the differently-named CSS custom property inline. Invalid values are
   *  ignored. */
  @property({ attribute: 'max-height' }) maxHeight = '';

  /** Anchor kinds this viewer resolves. `page` and page-addressed `region` anchors require an
   * integer within the loaded document's range; unlike the public `page` property, anchors are
   * rejected rather than clamped. */
  override readonly anchorKinds = ['page', 'text-quote', 'region'] as const;

  @state() private loadState: PdfLoadState = { kind: 'idle' };
  private pageViewerIdentity = 0;
  private pageViewerSnapshotValue: LyraPageViewerSnapshot = Object.freeze({
    identity: 0,
    status: 'idle',
    page: 1,
    pageCount: 0,
  });
  /** True while `page` was last set by the user scrolling the page list rather than by
   *  `nextPage()`/`previousPage()`/an explicit `page` assignment. `renderBody()` withholds
   *  `activeItemId` in that case so `<lr-virtual-list>` doesn't `scrollActiveIntoView()` back to a
   *  page boundary on every scroll-driven page crossing, fighting the user's own scroll. */
  @state() private scrollDrivenPage = false;
  private loadLibrary: () => Promise<PdfJsApi | null> = loadPdfJs;
  private generation = 0;
  private readonly pageCanvases = new Map<number, HTMLCanvasElement>();
  private readonly pageRenderTasks = new Map<number, { cancel(): void }>();
  private readonly pageRenderVersions = new Map<number, number>();
  private pageRenderGeneration = 0;
  private readonly pageCanvasRefs = new Map<number, (canvas: Element | undefined) => void>();
  private readonly textLayerContainers = new Map<number, HTMLElement>();
  private readonly textLayerContainerRefs = new Map<number, (element: Element | undefined) => void>();
  private readonly textLayers = new Map<number, { cancel(): void }>();
  private readonly textLayerReadyPromises = new Map<number, Promise<void>>();
  private readonly pageTextCache = new Map<number, PdfPageTextCacheEntry>();
  private readonly pageTextTruncated = new Set<number>();
  private readonly pageSearchIndexes = new Map<number, PdfPageTextIndex>();
  private readonly mountedPageTextIndexes = new Map<number, PdfPageTextIndex>();
  private pdfTextScopeBuilds = 0;
  private readonly thumbnailRenderTasks = new Map<HTMLCanvasElement, { cancel(): void }>();
  private readonly thumbnailRenderVersions = new Map<HTMLCanvasElement, number>();
  private thumbnailRenderGeneration = 0;
  private readonly pageHighlightItems = new Map<number, HighlightLayerItem[]>();
  private readonly pageHighlightLayerElements = new Map<number, LyraHighlightLayer>();
  private readonly highlightLayerRefs = new Map<number, (element: Element | undefined) => void>();
  private textSelectionCleanup?: () => void;
  private readonly pendingPageMountWaitCancels = new Set<() => void>();
  private pdfPageSourceCount = -1;
  private pdfPageSource: LyraVirtualListIndexedSource<number> = this.createPageSource(0);

  @state() private searchMatches: PdfSearchMatch[] = [];
  private searchMatchCountExact = true;
  @state() private searchActiveIndex = -1;
  private searchQuery = '';
  private searchGeneration = 0;
  private textIndexLocale?: string;
  private pendingSearchResetEvent = false;
  private anchorOperationGeneration = 0;
  private readonly announcements = new ViewerAnnouncementController(this);

  /**
   * Atomic readonly state for page-rail and other page-addressed integrations. Unlike the legacy
   * `lr-load`/`lr-page-change` pair, a late subscriber can read this immediately, and `identity`
   * distinguishes same-count document replacements.
   */
  get pageViewerSnapshot(): LyraPageViewerSnapshot {
    return this.pageViewerSnapshotValue;
  }

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
      // in. Reset here (rather than after rendering) so the state belongs to this update; the
      // canonical empty search event is emitted from updated() when there was public state to clear.
      this.pendingSearchResetEvent ||= this.hasSearchState();
      // Painted marks are torn down with the old page DOM. Reassigning these @state() fields here
      // folds the reset into this update instead of scheduling a follow-up render.
      this.resetSearchState();
    }
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    const locale = this.effectiveLocale;
    const localeChanged = this.textIndexLocale !== undefined && this.textIndexLocale !== locale;
    this.textIndexLocale = locale;
    if (localeChanged) {
      this.pageSearchIndexes.clear();
      this.mountedPageTextIndexes.clear();
    }
    this.announcements.transition(
      'load',
      this.loadState.kind,
      this.loadState.kind === 'error' ? this.loadState.message : this.localize('loadingDocument'),
    );
    if (changed.has('src')) {
      this.scheduleAfterUpdate(() => {
        void this.load();
      }, 'pdf-load');
      this.pageHighlightItems.clear();
      // getPageText() caches by page number alone -- without clearing it here, a page-1 lookup
      // from the previous document would still resolve to a cache hit, silently returning stale
      // text (and misdirecting any in-flight text-quote anchor scan) once the new document loads.
      this.clearPageTextCache();
      this.pageSearchIndexes.clear();
      this.mountedPageTextIndexes.clear();
      if (this.pendingSearchResetEvent) {
        this.pendingSearchResetEvent = false;
        this.emitSearchChange();
      }
    }
    if (changed.has('page') && this.loadState.kind === 'ready') {
      this.emit('lr-page-change', { page: this.page, pageCount: this.loadState.pageCount });
      this.publishPageViewerSnapshot('ready', this.loadState.pageCount);
    }
    if (changed.has('zoom') && changed.get('zoom') !== undefined) this.emit('lr-zoom-change', { zoom: this.zoom });
    if (changed.has('highlights') || changed.has('activeHighlightId') || localeChanged) {
      this.resolveMountedPageHighlights();
    }
    if (changed.has('activeHighlightId')) {
      for (const layer of this.pageHighlightLayerElements.values()) {
        layer.activeHighlightId = this.activeHighlightId;
      }
    }
    if (localeChanged && this.searchQuery.trim()) {
      this.scheduleAfterUpdate(() => { void this.search(this.searchQuery); }, 'pdf-search');
    }
  }

  override firstUpdated(changed: PropertyValues): void {
    super.firstUpdated(changed);
    const base = this.shadowRoot?.querySelector('[part="base"]') as HTMLElement | null;
    if (base) this.bindTextSelection(base);
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.announcements.connect();
    if (this.hasUpdated) {
      const base = this.shadowRoot?.querySelector('[part="base"]') as HTMLElement | null;
      if (base && !this.textSelectionCleanup) this.bindTextSelection(base);
      if (this.src) this.scheduleAfterUpdate(() => { void this.load(); }, 'pdf-load');
    }
  }

  override disconnectedCallback(): void {
    this.generation++;
    this.resetSearchState();
    this.pendingSearchResetEvent = false;
    this.anchorOperationGeneration++;
    this.beginAbortableLoad();
    this.cancelPendingPageMountWaits();
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
    this.clearPageTextCache();
    this.pageSearchIndexes.clear();
    this.mountedPageTextIndexes.clear();
    this.thumbnailRenderTasks.clear();
    this.thumbnailRenderVersions.clear();
    this.destroyLoadedDoc();
    this.loadState = { kind: 'idle' };
    this.pageViewerIdentity++;
    this.pageViewerSnapshotValue = Object.freeze({
      identity: this.pageViewerIdentity,
      status: 'idle',
      page: 1,
      pageCount: 0,
    });
    this.announcements.disconnect();
    super.disconnectedCallback();
  }

  override adoptedCallback(): void {
    super.adoptedCallback();
    this.cancelPendingPageMountWaits();
    this.announcements.adopted();
  }

  private cancelPendingPageMountWaits(): void {
    for (const cancel of [...this.pendingPageMountWaitCancels]) cancel();
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

  private publishPageViewerSnapshot(
    status: LyraPageViewerSnapshot['status'],
    pageCount: number,
  ): void {
    const snapshot = Object.freeze({
      identity: this.pageViewerIdentity,
      status,
      page: status === 'ready' ? this.clampPage(this.page) : 1,
      pageCount: status === 'ready' ? finiteCount(pageCount, 0, MAX_PAGE_COUNT) : 0,
    });
    const previous = this.pageViewerSnapshotValue;
    if (
      previous.identity === snapshot.identity
      && previous.status === snapshot.status
      && previous.page === snapshot.page
      && previous.pageCount === snapshot.pageCount
    ) return;
    this.pageViewerSnapshotValue = snapshot;
    if (this.isConnected) this.emit('lr-page-viewer-state-change', { snapshot });
  }

  private createPageSource(count: number): LyraVirtualListIndexedSource<number> {
    return Object.freeze({
      count,
      itemAt: (index: number) => index + 1,
      keyAt: (index: number) => index + 1,
      indexOfKey: (key: string | number) => typeof key === 'number' ? key - 1 : -1,
    });
  }

  private indexedPages(count: number): LyraVirtualListIndexedSource<number> {
    if (count !== this.pdfPageSourceCount) {
      this.pdfPageSourceCount = count;
      this.pdfPageSource = this.createPageSource(count);
    }
    return this.pdfPageSource;
  }

  private async load(): Promise<void> {
    const generation = ++this.generation;
    this.pageViewerIdentity++;
    const signal = this.beginAbortableLoad();
    this.destroyLoadedDoc();
    if (!this.src) {
      this.loadState = { kind: 'idle' };
      this.publishPageViewerSnapshot('idle', 0);
      return;
    }
    const fetchTarget = resolveOwnerFetchTarget(this, this.src);
    if (!fetchTarget) {
      const error = new LyraUserFacingError(this.localize('documentPreviewUrlNotAllowed'));
      this.loadState = { kind: 'error', message: error.message };
      this.publishPageViewerSnapshot('error', 0);
      this.emit('lr-render-error', { error });
      return;
    }
    this.loadState = { kind: 'loading' };
    this.publishPageViewerSnapshot('loading', 0);
    try {
      const response = await fetchTarget.view.fetch(fetchTarget.url, signal ? { signal } : undefined);
      if (!this.isConnected || generation !== this.generation) return;
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
      const data = await readResponseArrayBuffer(response);
      if (!this.isConnected || generation !== this.generation) return;
      const pdfjsLib = await this.loadLibrary();
      if (!this.isConnected || generation !== this.generation) return;
      if (!pdfjsLib) {
        const error = new LyraUserFacingError(this.localize('pdfViewerMissingLibrary'));
        this.loadState = { kind: 'error', message: error.message };
        this.publishPageViewerSnapshot('error', 0);
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
      this.publishPageViewerSnapshot('ready', pageCount);
      this.emit('lr-load', { pageCount });
    } catch (error) {
      if (isAbortError(error) || !this.isConnected || generation !== this.generation) return;
      this.loadState = {
        kind: 'error',
        message: error instanceof LyraUserFacingError
          ? error.message
          : this.localize(isResourceLimitError(error) ? 'documentPreviewResourceTooLarge' : 'documentPreviewFailedToLoad'),
      };
      this.publishPageViewerSnapshot('error', 0);
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
    const view = this.ownerDocument.defaultView;
    if (!list || !view) return Promise.resolve(false);
    return new Promise((resolve) => {
      let settled = false;
      let timeoutId: number | undefined;
      let cancel!: () => void;
      const finish = (mounted: boolean): void => {
        if (settled) return;
        settled = true;
        list.removeEventListener('lr-visible-range-changed', onRange as EventListener);
        if (timeoutId !== undefined) view.clearTimeout(timeoutId);
        this.pendingPageMountWaitCancels.delete(cancel);
        resolve(mounted);
      };
      const onRange = (): void => {
        if (this.pageCanvases.has(page)) finish(true);
      };
      cancel = () => finish(false);
      this.pendingPageMountWaitCancels.add(cancel);
      list.addEventListener('lr-visible-range-changed', onRange as EventListener);
      timeoutId = view.setTimeout(() => finish(false), 500);
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

  override async scrollToAnchor(target: LyraAnchor | string): Promise<boolean> {
    this.anchorOperationGeneration++;
    return super.scrollToAnchor(target);
  }

  protected async applyAnchor(anchor: LyraAnchor): Promise<boolean> {
    if (this.loadState.kind !== 'ready') return false;
    const doc = this.loadState.doc;
    const operation = this.anchorOperationGeneration;
    switch (anchor.kind) {
      case 'page': {
        if (
          !Number.isInteger(anchor.page)
          || anchor.page < 1
          || anchor.page > this.loadState.pageCount
          || !this.isCurrentAnchorOperation(operation, doc)
        ) return false;
        if (this.page !== anchor.page) {
          this.scrollDrivenPage = false;
          this.page = anchor.page;
        }
        await this.updateComplete;
        return this.isCurrentAnchorOperation(operation, doc) && this.pageCanvases.has(anchor.page);
      }
      case 'text-quote':
        return this.applyTextQuoteAnchor(anchor, operation, doc);
      case 'region':
        return this.applyRegionAnchor(anchor, operation, doc);
      default:
        return false;
    }
  }

  private isCurrentAnchorOperation(operation: number, doc: PdfDocumentApi): boolean {
    return (
      operation === this.anchorOperationGeneration
      && this.loadState.kind === 'ready'
      && this.loadState.doc === doc
    );
  }

  private *pageSearchOrder(hint: number | undefined, pageCount: number): Generator<number> {
    if (hint == null) {
      for (let page = 1; page <= pageCount; page++) yield page;
      return;
    }
    const clampedHint = Math.min(pageCount, Math.max(1, Math.round(hint)));
    yield clampedHint;
    for (let delta = 1; delta < pageCount; delta++) {
      if (clampedHint - delta >= 1) yield clampedHint - delta;
      if (clampedHint + delta <= pageCount) yield clampedHint + delta;
    }
  }

  private async applyTextQuoteAnchor(
    anchor: Extract<LyraAnchor, { kind: 'text-quote' }>,
    operation: number,
    doc: PdfDocumentApi,
  ): Promise<boolean> {
    if (!this.isCurrentAnchorOperation(operation, doc) || this.loadState.kind !== 'ready') return false;
    if (
      anchor.quote.length > TEXT_QUOTE_LIMITS.maxQueryCodeUnits
      || (anchor.prefix?.length ?? 0) > TEXT_QUOTE_LIMITS.maxQueryCodeUnits
      || (anchor.suffix?.length ?? 0) > TEXT_QUOTE_LIMITS.maxQueryCodeUnits
    ) return false;
    const quote = normalizeQuoteText(anchor.quote);
    if (!quote) return false;
    const order = this.pageSearchOrder(anchor.page, this.loadState.pageCount);
    let matchedPage: number | undefined;
    let inspectedPages = 0;
    let remainingCorpus = TEXT_QUOTE_LIMITS.maxCorpusCodeUnits;
    let remainingNormalizationWork = TEXT_QUOTE_LIMITS.maxNormalizationWorkCodeUnits;
    const workBudget: TextQuoteWorkBudget = {
      remainingCodeUnits: TEXT_QUOTE_LIMITS.maxSearchWorkCodeUnits,
    };
    for (const pageNumber of order) {
      if (
        inspectedPages++ >= MAX_SEARCH_PAGES
        || remainingCorpus <= 0
        || remainingNormalizationWork <= 0
        || workBudget.remainingCodeUnits <= 0
      ) break;
      // A page whose text layer is already mounted (the current page, or one a prior search
      // already visited) reflects exactly what's on screen -- reuse that index instead of an
      // independent raw re-extraction through the peer stream. This avoids a redundant
      // `streamTextContent()` read (which can be arbitrarily slow, or on a page whose stream the
      // peer never resumes, never resolve at all) for text this component has already indexed.
      let pageIndex = this.mountedPageTextIndex(pageNumber);
      if (!pageIndex) {
        let text: string;
        try {
          text = await this.getPageText(pageNumber);
        } catch {
          continue;
        }
        if (!this.isCurrentAnchorOperation(operation, doc)) return false;
        pageIndex = this.rawPageTextIndex(
          pageNumber,
          text,
          Math.min(remainingCorpus, TEXT_QUOTE_LIMITS.maxCorpusCodeUnits),
          Math.min(remainingNormalizationWork, TEXT_QUOTE_LIMITS.maxNormalizationWorkCodeUnits),
        );
        remainingCorpus -= pageIndex.scope.text.length;
        remainingNormalizationWork -= pageIndex.sourceWorkCodeUnits;
      }
      if (!this.isCurrentAnchorOperation(operation, doc)) return false;
      if (pageIndex.index.resolve(anchor, workBudget)) {
        matchedPage = pageNumber;
        break;
      }
      if (pageIndex.scope.truncated) break;
    }
    if (matchedPage == null) return false;

    if (!this.isCurrentAnchorOperation(operation, doc)) return false;
    if (this.page !== matchedPage) {
      this.scrollDrivenPage = false;
      this.page = matchedPage;
    }
    await this.updateComplete;
    if (!this.isCurrentAnchorOperation(operation, doc) || !this.pageCanvases.has(matchedPage)) return false;
    await this.textLayerReadyPromises.get(matchedPage);
    if (!this.isCurrentAnchorOperation(operation, doc)) return false;

    const range = this.resolveQuoteRangeOnPage(matchedPage, anchor);
    if (!range) return false;
    if (!this.isCurrentAnchorOperation(operation, doc)) return false;
    this.scrollRangeIntoView(range);
    return true;
  }

  private resolveQuoteRangeOnPage(pageNumber: number, anchor: { quote: string; prefix?: string; suffix?: string }): Range | null {
    const container = this.textLayerContainers.get(pageNumber);
    if (!container) return null;
    if (container.querySelector('mark[part~="search-match"]')) this.clearSearchPaint(container);
    const mounted = this.mountedPageTextIndex(pageNumber);
    if (!mounted) return null;
    const match = mounted.index.resolve(anchor);
    return match ? rangeFromTextQuoteMatch(mounted.scope, match) : null;
  }

  private async applyRegionAnchor(
    anchor: Extract<LyraAnchor, { kind: 'region' }>,
    operation: number,
    doc: PdfDocumentApi,
  ): Promise<boolean> {
    const rect = sanitizePercentRect(anchor.rect);
    if (
      !rect
      ||
      this.loadState.kind !== 'ready'
      || anchor.page == null
      || !Number.isInteger(anchor.page)
      || anchor.page < 1
      || anchor.page > this.loadState.pageCount
      || !this.isCurrentAnchorOperation(operation, doc)
    ) return false;
    if (this.page !== anchor.page) {
      this.scrollDrivenPage = false;
      this.page = anchor.page;
    }
    await this.updateComplete;
    if (!this.isCurrentAnchorOperation(operation, doc)) return false;
    const canvas = this.pageCanvases.get(anchor.page);
    if (!canvas) return false;
    if (!this.isCurrentAnchorOperation(operation, doc)) return false;
    this.scrollPercentRectIntoView(canvas, rect);
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
    scrollContainer.scrollBy({
      top: offset,
      behavior: prefersReducedMotion(this.ownerDocument.defaultView) ? 'auto' : 'smooth',
    });
  }

  private scrollPercentRectIntoView(pageEl: HTMLElement, rect: { x: number; y: number; width: number; height: number }): void {
    const scrollContainer = this.virtualListScrollContainer();
    if (!scrollContainer) return;
    const pageRect = pageEl.getBoundingClientRect();
    const containerRect = scrollContainer.getBoundingClientRect();
    const targetY = pageRect.top + (rect.y / 100) * pageRect.height;
    const offset = targetY - containerRect.top - containerRect.height / 2;
    scrollContainer.scrollBy({
      top: offset,
      behavior: prefersReducedMotion(this.ownerDocument.defaultView) ? 'auto' : 'smooth',
    });
  }

  // -- anchor-target: selection -> anchor ------------------------------------------------------------

  protected computeSelectionAnchor(range: Range): LyraAnchor | null {
    const pageNumber = this.pageForNode(range.startContainer);
    if (pageNumber == null) return null;
    const container = this.textLayerContainers.get(pageNumber);
    if (!container) return null;
    if (container.querySelector('mark[part~="search-match"]')) this.clearSearchPaint(container);
    const mounted = this.mountedPageTextIndex(pageNumber);
    if (!mounted) return null;
    const anchor = buildQuoteAnchor(range, mounted.scope);
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
    const ownerDocument = contentRoot.ownerDocument;
    const view = ownerDocument.defaultView;
    if (!view) {
      this.textSelectionCleanup = undefined;
      return;
    }

    const resolveSelectionRange = (): Range | null => {
      const hostShadowRoot = this.shadowRoot;
      const listShadowRoot = this.shadowRoot?.querySelector('lr-virtual-list')?.shadowRoot ?? null;
      const globalSelection = view.getSelection() as
        | (Selection & { getComposedRanges?: (options: { shadowRoots: ShadowRoot[] }) => StaticRange[] })
        | null;

      if (globalSelection?.getComposedRanges && hostShadowRoot) {
        const shadowRoots = listShadowRoot ? [hostShadowRoot, listShadowRoot] : [hostShadowRoot];
        const [composed] = globalSelection.getComposedRanges({ shadowRoots });
        if (!composed) return null;
        if (composed.startContainer === composed.endContainer && composed.startOffset === composed.endOffset) return null;
        const range = ownerDocument.createRange();
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
      const text = boundedSelectionText(range);
      if (!text) return;
      const anchor = this.computeSelectionAnchor(range);
      const rects = boundedSelectionRects(range);
      this.emit('lr-text-select', { text, anchor, rects });
    };

    let debounceHandle: number | undefined;
    const onSelectionChange = (): void => {
      if (debounceHandle !== undefined) view.cancelAnimationFrame(debounceHandle);
      debounceHandle = view.requestAnimationFrame(() => {
        debounceHandle = undefined;
        onSelectionEnd();
      });
    };

    contentRoot.addEventListener('pointerup', onSelectionEnd);
    contentRoot.addEventListener('keyup', onSelectionEnd);
    ownerDocument.addEventListener('selectionchange', onSelectionChange);

    this.textSelectionCleanup = () => {
      contentRoot.removeEventListener('pointerup', onSelectionEnd);
      contentRoot.removeEventListener('keyup', onSelectionEnd);
      ownerDocument.removeEventListener('selectionchange', onSelectionChange);
      if (debounceHandle !== undefined) view.cancelAnimationFrame(debounceHandle);
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
      return (await cached.promise).text;
    }
    const entry: PdfPageTextCacheEntry = {
      cancelled: false,
      promise: Promise.resolve({ text: '', truncated: false }),
    };
    this.pageTextCache.set(page, entry);
    if (this.pageTextCache.size > PAGE_TEXT_CACHE_LIMIT) {
      const oldestKey = this.pageTextCache.keys().next().value;
      if (oldestKey !== undefined) this.evictPageTextCacheEntry(oldestKey);
    }
    entry.promise = this.loadPageText(page, entry);
    void entry.promise.then(
      (result) => {
        // An evicted/replaced promise must never mutate metadata belonging to its successor.
        if (this.pageTextCache.get(page) !== entry) return;
        if (result.truncated) this.pageTextTruncated.add(page);
        else this.pageTextTruncated.delete(page);
      },
      () => {
        // Conditional identity is essential here: P1 can reject after eviction while a new P2 for
        // the same page is already cached. Unconditionally deleting by page would erase P2 (ABA).
        if (this.pageTextCache.get(page) !== entry) return;
        this.pageTextCache.delete(page);
        this.pageTextTruncated.delete(page);
      },
    );
    return (await entry.promise).text;
  }

  private evictPageTextCacheEntry(page: number): void {
    const entry = this.pageTextCache.get(page);
    if (!entry) return;
    this.pageTextCache.delete(page);
    this.pageTextTruncated.delete(page);
    entry.cancelled = true;
    void entry.reader?.cancel().catch(() => undefined);
  }

  private clearPageTextCache(): void {
    for (const entry of this.pageTextCache.values()) {
      entry.cancelled = true;
      void entry.reader?.cancel().catch(() => undefined);
    }
    this.pageTextCache.clear();
    this.pageTextTruncated.clear();
  }

  private async loadPageText(
    page: number,
    entry: PdfPageTextCacheEntry,
  ): Promise<PdfPageTextResult> {
    if (this.loadState.kind !== 'ready') throw new Error('No PDF document is loaded.');
    const doc = this.loadState.doc;
    const pdfPage = await doc.getPage(page);
    const DOMExceptionCtor = this.ownerDocument.defaultView?.DOMException ?? DOMException;
    if (entry.cancelled || this.loadState.kind !== 'ready' || this.loadState.doc !== doc) {
      throw new DOMExceptionCtor('Superseded', 'AbortError');
    }
    const accumulator: PdfTextAccumulator = {
      chunks: [],
      length: 0,
      inspectedItems: 0,
      truncated: false,
    };
    const source = pdfPage.streamTextContent?.();
    // The pinned pdfjs-dist peer guarantees `streamTextContent()`. Refuse a non-stream capability
    // rather than falling back to getTextContent(), whose implementation drains and materializes an
    // unbounded items array before Lyra can enforce its page ceiling.
    if (!isReadablePdfTextStream(source)) throw new Error('PDF text streaming is unavailable.');
    const reader = source.getReader();
    entry.reader = reader;
    let inspectedChunks = 0;
    try {
      while (inspectedChunks++ < MAX_PDF_TEXT_CHUNKS) {
        const result = await reader.read();
        if (entry.cancelled || this.loadState.kind !== 'ready' || this.loadState.doc !== doc) {
          void reader.cancel().catch(() => undefined);
          throw new DOMExceptionCtor('Superseded', 'AbortError');
        }
        if (result.done) break;
        const value = result.value;
        appendPdfTextItems(
          value && typeof value === 'object' && 'items' in value ? value.items : undefined,
          accumulator,
        );
        if (accumulator.truncated) {
          void reader.cancel().catch(() => undefined);
          break;
        }
      }
      if (inspectedChunks > MAX_PDF_TEXT_CHUNKS) {
        accumulator.truncated = true;
        void reader.cancel().catch(() => undefined);
      }
    } finally {
      if (entry.reader === reader) entry.reader = undefined;
      reader.releaseLock();
    }
    if (entry.cancelled || this.loadState.kind !== 'ready' || this.loadState.doc !== doc) {
      throw new DOMExceptionCtor('Superseded', 'AbortError');
    }
    return { text: accumulator.chunks.join(''), truncated: accumulator.truncated };
  }

  /** Renders `page` into `canvas` at `width` CSS px (default 96), devicePixelRatio-aware. Cancels a
   *  prior in-flight render for the same canvas. Resolves `false` when not ready or out of range.
   *  Caller owns the canvas -- no bitmap transfer, no hidden cache. */
  async renderPageThumbnail(page: number, canvas: HTMLCanvasElement, options?: { width?: number }): Promise<boolean> {
    if (this.loadState.kind !== 'ready') return false;
    const { pageCount } = this.loadState;
    if (!Number.isInteger(page) || page < 1 || page > pageCount) return false;
    const width = options?.width ?? DEFAULT_THUMBNAIL_WIDTH;
    if (!Number.isFinite(width) || width <= 0 || width > MAX_THUMBNAIL_WIDTH) return false;
    this.thumbnailRenderTasks.get(canvas)?.cancel();
    this.thumbnailRenderTasks.delete(canvas);
    const version = ++this.thumbnailRenderGeneration;
    this.thumbnailRenderVersions.set(canvas, version);
    const doc = this.loadState.doc;
    let renderTask: { promise: Promise<void>; cancel(): void } | undefined;
    try {
      const pdfPage = await doc.getPage(page);
      if (
        this.loadState.kind !== 'ready' ||
        this.loadState.doc !== doc ||
        this.thumbnailRenderVersions.get(canvas) !== version
      ) return false;
      const unscaledViewport = pdfPage.getViewport({ scale: 1 });
      if (!Number.isFinite(unscaledViewport.width) || unscaledViewport.width <= 0) return false;
      const scale = width / unscaledViewport.width;
      const viewport = pdfPage.getViewport({ scale });
      const dpr = canvas.ownerDocument.defaultView?.devicePixelRatio || 1;
      canvas.width = Math.floor(viewport.width * dpr);
      canvas.height = Math.floor(viewport.height * dpr);
      canvas.style.width = `${viewport.width}px`;
      canvas.style.height = `${viewport.height}px`;
      const context = canvas.getContext('2d');
      if (!context) return false;
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      renderTask = pdfPage.render({ canvasContext: context, viewport });
      this.thumbnailRenderTasks.set(canvas, renderTask);
      await renderTask.promise;
      return this.thumbnailRenderTasks.get(canvas) === renderTask &&
        this.thumbnailRenderVersions.get(canvas) === version;
    } catch (error) {
      if (isAbortError(error)) return false;
      throw error;
    } finally {
      if (renderTask && this.thumbnailRenderTasks.get(canvas) === renderTask) {
        this.thumbnailRenderTasks.delete(canvas);
      }
      if (this.thumbnailRenderVersions.get(canvas) === version) {
        this.thumbnailRenderVersions.delete(canvas);
      }
    }
  }

  // -- outline ---------------------------------------------------------------------------------------

  /** Maps pdf.js's own `getOutline()` tree to `PdfOutlineItem[]`, resolving each entry's
   *  destination to a 1-based page number best-effort -- an unresolvable destination keeps its
   *  `title`/`children` with `page` omitted rather than dropping the entry. Peer output is capped at
   *  10,000 unique entries and 100 levels; cycles are ignored. `[]` for a document with no outline
   *  or before one is loaded. */
  async getOutline(): Promise<PdfOutlineItem[]> {
    if (this.loadState.kind !== 'ready') return [];
    const doc = this.loadState.doc;
    if (!doc.getOutline) return [];
    const raw = await doc.getOutline();
    if (
      !Array.isArray(raw)
      || this.loadState.kind !== 'ready'
      || this.loadState.doc !== doc
    ) return [];
    const result = await this.mapOutlineItems(
      doc,
      raw,
      1,
      new WeakSet<object>(),
      { count: 0 },
    );
    return this.loadState.kind === 'ready' && this.loadState.doc === doc ? result : [];
  }

  private async mapOutlineItems(
    doc: PdfDocumentApi,
    rawItems: PdfOutlineEntryApi[],
    depth: number,
    seen: WeakSet<object>,
    budget: { count: number },
  ): Promise<PdfOutlineItem[]> {
    if (depth > MAX_OUTLINE_DEPTH || budget.count >= MAX_OUTLINE_ITEMS) return [];
    const mapped: PdfOutlineItem[] = [];
    for (const rawItem of rawItems) {
      if (budget.count >= MAX_OUTLINE_ITEMS) break;
      if (
        !rawItem
        || typeof rawItem !== 'object'
        || seen.has(rawItem as object)
      ) continue;
      seen.add(rawItem as object);
      budget.count++;
      const page = await this.resolveOutlineDestPage(doc, rawItem.dest);
      if (this.loadState.kind !== 'ready' || this.loadState.doc !== doc) return [];
      const rawChildren = Array.isArray(rawItem.items) ? rawItem.items : [];
      const children = depth < MAX_OUTLINE_DEPTH
        ? await this.mapOutlineItems(doc, rawChildren, depth + 1, seen, budget)
        : [];
      mapped.push({
        title: String(rawItem.title ?? ''),
        ...(page !== undefined ? { page } : {}),
        ...(children.length > 0 ? { children } : {}),
      });
    }
    return mapped;
  }

  private async resolveOutlineDestPage(
    doc: PdfDocumentApi,
    dest: unknown,
  ): Promise<number | undefined> {
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

  private createRawPageTextIndex(
    raw: string,
    maxCorpusCodeUnits = TEXT_QUOTE_LIMITS.maxCorpusCodeUnits,
    maxNormalizationWorkCodeUnits = TEXT_QUOTE_LIMITS.maxNormalizationWorkCodeUnits,
  ): PdfPageTextIndex {
    const inspectedRaw = raw.slice(0, Math.min(
      raw.length,
      TEXT_QUOTE_LIMITS.maxNodeCodeUnits,
      maxNormalizationWorkCodeUnits,
    ));
    const element = this.ownerDocument.createElement('span');
    element.textContent = inspectedRaw;
    const scope = scopeFromItems([{ text: inspectedRaw, element }], {
      maxCorpusCodeUnits,
      maxNormalizationWorkCodeUnits,
    });
    if (inspectedRaw.length !== raw.length) scope.truncated = true;
    this.pdfTextScopeBuilds++;
    return {
      scope,
      index: createTextQuoteIndex(scope, this.effectiveLocale, { maxMatches: MAX_SEARCH_MATCHES }),
      locale: this.effectiveLocale,
      sourceText: raw.length <= TEXT_QUOTE_LIMITS.maxNodeCodeUnits ? raw : undefined,
      sourceWorkCodeUnits: Math.min(
        raw.length,
        TEXT_QUOTE_LIMITS.maxNodeCodeUnits,
        maxNormalizationWorkCodeUnits,
      ),
    };
  }

  private rawPageTextIndex(
    pageNumber: number,
    raw: string,
    maxCorpusCodeUnits = TEXT_QUOTE_LIMITS.maxCorpusCodeUnits,
    maxNormalizationWorkCodeUnits = TEXT_QUOTE_LIMITS.maxNormalizationWorkCodeUnits,
  ): PdfPageTextIndex {
    const fullLimits = maxCorpusCodeUnits === TEXT_QUOTE_LIMITS.maxCorpusCodeUnits
      && maxNormalizationWorkCodeUnits === TEXT_QUOTE_LIMITS.maxNormalizationWorkCodeUnits;
    const cacheable = fullLimits && raw.length <= TEXT_QUOTE_LIMITS.maxNodeCodeUnits;
    const cached = this.pageSearchIndexes.get(pageNumber);
    if (
      cacheable
      && cached
      && cached.locale === this.effectiveLocale
      && cached.sourceText === raw
    ) {
      this.pageSearchIndexes.delete(pageNumber);
      this.pageSearchIndexes.set(pageNumber, cached);
      return cached;
    }
    const created = this.createRawPageTextIndex(raw, maxCorpusCodeUnits, maxNormalizationWorkCodeUnits);
    if (this.pageTextTruncated.has(pageNumber)) created.scope.truncated = true;
    if (cacheable) {
      this.pageSearchIndexes.set(pageNumber, created);
      if (this.pageSearchIndexes.size > PAGE_SEARCH_INDEX_CACHE_LIMIT) {
        const oldest = this.pageSearchIndexes.keys().next().value;
        if (oldest !== undefined) this.pageSearchIndexes.delete(oldest);
      }
    }
    return created;
  }

  private buildMountedPageScope(container: HTMLElement): TextQuoteScope {
    const items: Array<{
      text: string;
      element: HTMLElement;
      node: Text;
      joinBefore: boolean;
    }> = [];
    const doc = container.ownerDocument;
    const showAll = doc.defaultView?.NodeFilter.SHOW_ALL ?? 0xffffffff;
    const textNodeType = doc.defaultView?.Node.TEXT_NODE ?? 3;
    const walker = doc.createTreeWalker(container, showAll);
    const textRunOwners = new WeakMap<Node, HTMLElement | null>();
    textRunOwners.set(container, null);
    let traversed = 0;
    let traversalTruncated = false;
    let previousRun: HTMLElement | null = null;
    let node: Node | null;
    while ((node = walker.nextNode())) {
      traversed++;
      if (traversed > TEXT_QUOTE_LIMITS.maxTraversalNodes) {
        traversalTruncated = true;
        break;
      }
      const parentRun = node.parentNode ? textRunOwners.get(node.parentNode) ?? null : null;
      const run = node.nodeType === 1 && (node as Element).localName === 'span'
        ? parentRun ?? node as HTMLElement
        : parentRun;
      textRunOwners.set(node, run);
      if (node.nodeType !== textNodeType) continue;
      if (items.length >= TEXT_QUOTE_LIMITS.maxNodes) {
        traversalTruncated = true;
        break;
      }
      const textNode = node as Text;
      const element = textNode.parentElement ?? container;
      items.push({
        text: textNode.data,
        element,
        node: textNode,
        // Text descendants within one pdf.js run concatenate exactly. A new positioned span needs
        // the synthetic reading-order space that scopeFromItems traditionally supplies.
        joinBefore: items.length === 0 || run !== previousRun,
      });
      previousRun = run;
    }
    const scope = scopeFromItems(items);
    if (traversalTruncated) scope.truncated = true;
    this.pdfTextScopeBuilds++;
    return scope;
  }

  private mountedPageTextIndex(pageNumber: number, forceMappingRefresh = false): PdfPageTextIndex | null {
    const container = this.textLayerContainers.get(pageNumber);
    if (!container) return null;
    const cached = this.mountedPageTextIndexes.get(pageNumber);
    if (
      cached
      && cached.container === container
      && cached.locale === this.effectiveLocale
      && !cached.mappingDirty
      && !forceMappingRefresh
    ) return cached;
    const scope = this.buildMountedPageScope(container);
    if (
      cached
      && cached.container === container
      && cached.locale === this.effectiveLocale
      && cached.index.rebindScope(scope)
    ) {
      cached.scope = scope;
      cached.mappingDirty = false;
      return cached;
    }
    const created: PdfPageTextIndex = {
      scope,
      index: createTextQuoteIndex(scope, this.effectiveLocale, { maxMatches: MAX_SEARCH_MATCHES }),
      locale: this.effectiveLocale,
      sourceWorkCodeUnits: scope.text.length,
      container,
      mappingDirty: false,
    };
    this.mountedPageTextIndexes.set(pageNumber, created);
    return created;
  }

  /** @internal Focused-test seam for one-scope-per-content-generation verification. */
  protected pdfTextScopeBuildCount(): number {
    return this.pdfTextScopeBuilds;
  }

  /** @internal Focused-test seam for occurrence-index reuse on one mounted page. */
  protected pdfTextQuoteScanCount(pageNumber: number): number {
    return this.mountedPageTextIndexes.get(pageNumber)?.index.scanCount ?? 0;
  }

  /** Case-insensitive substring search over every page's text (via `getPageText()`). Matches use
   *  the shared bounded text-quote index's normalized coordinate space, never touching
   *  `highlights` -- painting is a self-contained overlay
   *  scoped to search only (see `paintSearchMatches()`). An empty/whitespace-only query behaves like
   *  `clearSearch()` and resolves `0`. Queries are capped at 4,096 code units, a pass at 1,000
   *  pages/1,000,000 corpus code units/4,000,000 search code units, and retained matches at 10,000;
   *  `lr-search-change.detail.matchCountExact=false` identifies that return as a lower bound. */
  async search(query: string): Promise<number> {
    // `lang` can change without a Lit property update; validate against a fresh effective locale
    // before the unloaded/empty branches so locale-fold expansion still reports inexact rejection.
    invalidateLyraLocaleCache(this);
    const generation = ++this.searchGeneration;
    this.searchQuery = query;
    this.clearSearchPaint();
    if (!boundedViewerSearchQuery(query, this.effectiveLocale).accepted) {
      this.searchMatches = [];
      this.searchMatchCountExact = false;
      this.searchActiveIndex = -1;
      this.emitSearchChange();
      return 0;
    }
    if (this.loadState.kind !== 'ready') {
      this.searchMatches = [];
      this.searchMatchCountExact = true;
      this.searchActiveIndex = -1;
      this.emitSearchChange();
      return 0;
    }
    const trimmedQuery = query.trim();
    if (!trimmedQuery) {
      this.searchMatches = [];
      this.searchMatchCountExact = true;
      this.searchActiveIndex = -1;
      this.emitSearchChange();
      return 0;
    }
    const { pageCount } = this.loadState;
    const matches: PdfSearchMatch[] = [];
    let matchCountExact = true;
    let remainingCorpus = TEXT_QUOTE_LIMITS.maxCorpusCodeUnits;
    let remainingNormalizationWork = TEXT_QUOTE_LIMITS.maxNormalizationWorkCodeUnits;
    const searchBudget: TextQuoteWorkBudget = {
      remainingCodeUnits: TEXT_QUOTE_LIMITS.maxSearchWorkCodeUnits,
    };
    const inspectedPages = Math.min(pageCount, MAX_SEARCH_PAGES);
    if (pageCount > inspectedPages) matchCountExact = false;
    for (let page = 1; page <= inspectedPages; page++) {
      if (generation !== this.searchGeneration) return this.searchMatches.length;
      if (remainingCorpus <= 0 || remainingNormalizationWork <= 0 || searchBudget.remainingCodeUnits <= 0) {
        matchCountExact = false;
        break;
      }
      let raw: string;
      try {
        raw = await this.getPageText(page);
      } catch {
        matchCountExact = false;
        continue;
      }
      if (generation !== this.searchGeneration) return this.searchMatches.length;
      const fullPageFits = raw.length <= remainingNormalizationWork;
      const pageIndex = this.rawPageTextIndex(
        page,
        raw,
        Math.min(remainingCorpus, TEXT_QUOTE_LIMITS.maxCorpusCodeUnits),
        Math.min(remainingNormalizationWork, TEXT_QUOTE_LIMITS.maxNormalizationWorkCodeUnits),
      );
      remainingCorpus -= pageIndex.scope.text.length;
      remainingNormalizationWork -= pageIndex.sourceWorkCodeUnits;
      const pageMatches = pageIndex.index.search(trimmedQuery, searchBudget);
      if (!pageMatches.matchCountExact) matchCountExact = false;
      const retainedBeforePage = matches.length;
      for (const match of pageMatches) {
        if (matches.length >= MAX_SEARCH_MATCHES) {
          matchCountExact = false;
          break;
        }
        matches.push({ page, start: match.start, length: match.end - match.start });
      }
      if (matches.length >= MAX_SEARCH_MATCHES && pageMatches.length > 0) {
        // Keep scanning only while the exact boundary remains plausible. A retained match beyond
        // the global cap proves the public count is a lower bound immediately.
        const retainedOnPage = matches.length - retainedBeforePage;
        if (pageMatches.length > retainedOnPage) {
          matchCountExact = false;
          break;
        }
      }
      if (!fullPageFits || pageIndex.scope.truncated || !pageMatches.scanComplete) {
        matchCountExact = false;
        break;
      }
    }
    if (generation !== this.searchGeneration) return this.searchMatches.length;
    this.searchMatches = matches;
    this.searchMatchCountExact = matchCountExact;
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
    this.resetSearchState();
    this.clearSearchPaint();
    this.emit('lr-search-change', { query: '', matchCount: 0, matchCountExact: true, activeIndex: -1 });
  }

  private hasSearchState(): boolean {
    return this.searchQuery !== ''
      || this.searchMatches.length > 0
      || !this.searchMatchCountExact
      || this.searchActiveIndex !== -1;
  }

  private resetSearchState(): void {
    this.searchGeneration++;
    this.searchQuery = '';
    this.searchMatches = [];
    this.searchMatchCountExact = true;
    this.searchActiveIndex = -1;
  }

  private emitSearchChange(): void {
    this.emit('lr-search-change', {
      query: this.searchQuery,
      matchCount: this.searchMatches.length,
      matchCountExact: this.searchMatchCountExact,
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
    const containers: Iterable<HTMLElement> = container ? [container] : this.textLayerContainers.values();
    for (const target of containers) {
      target.querySelectorAll('mark[part~="search-match"]').forEach((mark) => {
        unwrapPdfSearchMark(mark);
      });
      for (const cached of this.mountedPageTextIndexes.values()) {
        if (cached.container === target) cached.mappingDirty = true;
      }
    }
  }

  /** Resolves a bounded active-centred window against the mounted page's shared text scope and
   *  wraps each search match's normalized-offset range in a
   *  `<mark part="search-match">` (`search-match-active` added for the current match). A page whose
   *  text layer hasn't mounted yet (out of the virtualized render window) is silently skipped --
   *  painting resumes the next time that page's text layer finishes rendering, via the hook in
   *  `renderTextLayer()`. */
  private paintSearchMatches(page: number): void {
    const container = this.textLayerContainers.get(page);
    if (!container) return;
    this.clearSearchPaint(container);
    const count = Math.min(this.searchMatches.length, MAX_PAINTED_SEARCH_MATCHES);
    const half = MAX_PAINTED_SEARCH_MATCHES >> 1;
    const centre = this.searchActiveIndex < 0 ? 0 : this.searchActiveIndex;
    const start = Math.max(0, Math.min(centre - half, this.searchMatches.length - count));
    const pageMatches: Array<{ match: PdfSearchMatch; matchIndex: number }> = [];
    for (let matchIndex = start; matchIndex < start + count; matchIndex++) {
      const match = this.searchMatches[matchIndex];
      if (match?.page === page) pageMatches.push({ match, matchIndex });
    }
    if (pageMatches.length === 0) return;
    const active = pageMatches.find(({ matchIndex }) => matchIndex === this.searchActiveIndex);
    const nonOverlapping: typeof pageMatches = [];
    for (const candidate of active
      ? [active, ...pageMatches.filter((entry) => entry !== active)]
      : pageMatches) {
      const candidateEnd = candidate.match.start + candidate.match.length;
      if (nonOverlapping.some(({ match }) =>
        candidate.match.start < match.start + match.length && match.start < candidateEnd)) continue;
      nonOverlapping.push(candidate);
    }
    const mounted = this.mountedPageTextIndex(page);
    if (!mounted) return;
    const materialized = rangesFromTextQuoteMatches(
      mounted.scope,
      nonOverlapping.map(({ match }) => ({
        start: match.start,
        end: match.start + match.length,
      })),
    );
    const ranges: Array<{ matchIndex: number; match: PdfSearchMatch; range: Range }> = [];
    for (let position = 0; position < nonOverlapping.length; position++) {
      const { match, matchIndex } = nonOverlapping[position]!;
      const range = materialized[position] ?? null;
      if (range) ranges.push({ matchIndex, match, range });
    }
    ranges.sort((a, b) => b.match.start - a.match.start);
    const budget: PdfPaintWorkBudget = {
      traversalNodes: TEXT_QUOTE_LIMITS.maxTraversalNodes,
      codeUnits: TEXT_QUOTE_LIMITS.maxCorpusCodeUnits,
      marks: this.remainingSearchMarkBudget(container),
    };
    let painted = false;
    for (const { matchIndex, range } of ranges) {
      const part = matchIndex === this.searchActiveIndex
        ? 'search-match search-match-active'
        : 'search-match';
      if (wrapPdfSearchRange(range, part, budget).length > 0) painted = true;
    }
    if (painted) mounted.mappingDirty = true;
  }

  private remainingSearchMarkBudget(except: HTMLElement): number {
    let remaining = MAX_PAINTED_SEARCH_MARKS;
    for (const container of this.textLayerContainers.values()) {
      if (container === except) continue;
      const count = container.querySelectorAll('mark[part~="search-match"]').length;
      remaining -= Math.min(remaining, count);
      if (remaining <= 0) return 0;
    }
    return remaining;
  }

  // -- highlight painting --------------------------------------------------------------------------------

  private resolveMountedPageHighlights(): void {
    const candidates = prioritizedHighlightCandidates(this.highlights, this.activeHighlightId);
    const pages = [...this.pageCanvases.keys()]
      .filter((pageNumber) => this.textLayerContainers.has(pageNumber))
      .sort((left, right) => left - right);
    const active = this.activeHighlightId
      ? candidates.find((highlight) => highlight.id === this.activeHighlightId)
      : undefined;
    const activePage = active?.anchor.kind === 'page'
      ? active.anchor.page
      : active?.anchor.kind === 'region'
        ? active.anchor.page ?? this.page
        : active?.anchor.kind === 'text-quote'
          ? active.anchor.page
          : undefined;
    if (activePage !== undefined) {
      pages.sort((left, right) =>
        Number(right === activePage) - Number(left === activePage));
    }
    for (const layer of this.pageHighlightLayerElements.values()) layer.items = [];
    this.pageHighlightItems.clear();
    const results = new Map<number, HighlightLayerItem[]>();
    for (const pageNumber of pages) results.set(pageNumber, []);
    const textIndexes = new Map<number, PdfPageTextIndex | null>();
    const searchPaintPages = new Set<number>();
    const budget: PdfHighlightPaintBudget = {
      work: { remainingCodeUnits: TEXT_QUOTE_LIMITS.maxSearchWorkCodeUnits },
      remainingResolutionAttempts: MAX_HIGHLIGHT_RESOLUTION_ATTEMPTS,
      remainingItems: MAX_PAINTED_HIGHLIGHTS,
      remainingRects: MAX_HIGHLIGHT_RECTS,
    };
    interface ResolutionOption {
      pageNumber: number;
      pageRect: DOMRect;
      textIndex?: PdfPageTextIndex;
      match?: TextQuoteMatch;
      range?: Range | null;
    }
    const plans: Array<{ highlight: LyraHighlight; options: ResolutionOption[] }> = [];
    const textOptionsByPage = new Map<number, ResolutionOption[]>();
    const pageRects = new Map<number, DOMRect>();
    for (const highlight of candidates) {
      const options: ResolutionOption[] = [];
      for (const pageNumber of this.mountedPagesForHighlight(highlight.anchor, pages)) {
        const container = this.textLayerContainers.get(pageNumber);
        const canvas = this.pageCanvases.get(pageNumber);
        if (!container || !canvas || this.loadState.kind !== 'ready') continue;
        let pageRect = pageRects.get(pageNumber);
        if (!pageRect) {
          pageRect = canvas.getBoundingClientRect();
          pageRects.set(pageNumber, pageRect);
        }
        let textIndex: PdfPageTextIndex | undefined;
        if (highlight.anchor.kind === 'text-quote') {
          if (budget.remainingResolutionAttempts <= 0) break;
          if (!textIndexes.has(pageNumber)) {
            if (container.querySelector('mark[part~="search-match"]')) {
              searchPaintPages.add(pageNumber);
              this.clearSearchPaint(container);
            }
            textIndexes.set(pageNumber, this.mountedPageTextIndex(pageNumber));
          }
          textIndex = textIndexes.get(pageNumber) ?? undefined;
          if (!textIndex) continue;
          budget.remainingResolutionAttempts--;
          const match = textIndex.index.resolve(highlight.anchor, budget.work);
          if (!match) continue;
          const option = { pageNumber, pageRect, textIndex, match };
          options.push(option);
          const pageOptions = textOptionsByPage.get(pageNumber) ?? [];
          pageOptions.push(option);
          textOptionsByPage.set(pageNumber, pageOptions);
          continue;
        }
        options.push({ pageNumber, pageRect });
      }
      plans.push({ highlight, options });
    }
    // Scope provenance can include a full one-million-code-unit snapshot. Validate it once per
    // mounted page, then materialize every admitted candidate for that page as one synchronous
    // batch instead of multiplying the comparison by the 1,000-candidate admission ceiling.
    for (const [pageNumber, options] of textOptionsByPage) {
      const textIndex = textIndexes.get(pageNumber);
      if (!textIndex) continue;
      const ranges = rangesFromTextQuoteMatches(
        textIndex.scope,
        options.map(({ match }) => match),
      );
      for (let position = 0; position < options.length; position++) {
        options[position]!.range = ranges[position] ?? null;
      }
    }
    candidateLoop: for (const { highlight, options } of plans) {
      if (budget.remainingItems <= 0 || budget.remainingRects <= 0) break;
      for (const { pageNumber, pageRect, range } of options) {
        const rects = this.resolveHighlightRectsForPage(
          highlight.anchor,
          pageNumber,
          pageRect,
          budget,
          range,
        );
        if (rects.length === 0) continue;
        results.get(pageNumber)!.push({
          id: highlight.id,
          rects,
          label: highlight.label,
          tone: highlight.tone,
        });
        budget.remainingItems--;
        // One host highlight is one globally admitted item. A page-less quote searches mounted
        // pages in order and stops at its first exact resolution instead of consuming one slot per
        // page or letting page-one ordinary work starve the active candidate's later page.
        continue candidateLoop;
      }
    }
    for (const [pageNumber, pageItems] of results) {
      this.pageHighlightItems.set(pageNumber, pageItems);
      const layer = this.pageHighlightLayerElements.get(pageNumber);
      if (layer) layer.items = pageItems;
    }
    for (const pageNumber of searchPaintPages) this.paintSearchMatches(pageNumber);
  }

  private *mountedPagesForHighlight(
    anchor: LyraAnchor,
    mountedPages: readonly number[],
  ): Generator<number> {
    const addressedPage = anchor.kind === 'page'
      ? anchor.page
      : anchor.kind === 'region'
        ? anchor.page ?? this.page
        : anchor.kind === 'text-quote'
          ? anchor.page
          : undefined;
    if (addressedPage !== undefined) {
      if (mountedPages.includes(addressedPage)) yield addressedPage;
      return;
    }
    if (anchor.kind === 'text-quote') {
      for (const pageNumber of mountedPages) yield pageNumber;
    }
  }

  private resolveHighlightRectsForPage(
    anchor: LyraAnchor,
    pageNumber: number,
    pageRect: DOMRect,
    budget: PdfHighlightPaintBudget,
    range?: Range | null,
  ): { x: number; y: number; width: number; height: number }[] {
    if (anchor.kind === 'page' && anchor.page === pageNumber) {
      if (budget.remainingRects <= 0) return [];
      budget.remainingRects--;
      return [{ x: 0, y: 0, width: 100, height: 100 }];
    }
    if (anchor.kind === 'region' && (anchor.page ?? pageNumber) === pageNumber) {
      const rect = sanitizePercentRect(anchor.rect);
      if (!rect || budget.remainingRects <= 0) return [];
      budget.remainingRects--;
      return [rect];
    }
    if (
      anchor.kind === 'text-quote'
      && range
      && (anchor.page == null || anchor.page === pageNumber)
    ) {
      if (!(pageRect.width > 0) || !(pageRect.height > 0)) return [];
      const rects: { x: number; y: number; width: number; height: number }[] = [];
      for (const rect of range.getClientRects()) {
        // Enumerate at most one past the remaining ceiling so a logical highlight is either exact
        // or omitted; never return a visually misleading prefix of its rectangles.
        if (rects.length >= budget.remainingRects) return [];
        rects.push({
          x: ((rect.left - pageRect.left) / pageRect.width) * 100,
          y: ((rect.top - pageRect.top) / pageRect.height) * 100,
          width: (rect.width / pageRect.width) * 100,
          height: (rect.height / pageRect.height) * 100,
        });
      }
      budget.remainingRects -= rects.length;
      return rects;
    }
    return [];
  }

  private highlightLayerRef(pageNumber: number): (element: Element | undefined) => void {
    let callback = this.highlightLayerRefs.get(pageNumber);
    if (!callback) {
      callback = (element) => {
        if (!element) {
          this.pageHighlightLayerElements.delete(pageNumber);
          this.pageHighlightItems.delete(pageNumber);
          this.highlightLayerRefs.delete(pageNumber);
          return;
        }
        const layer = element as LyraHighlightLayer;
        this.pageHighlightLayerElements.set(pageNumber, layer);
        layer.items = this.pageHighlightItems.get(pageNumber) ?? [];
        layer.activeHighlightId = this.activeHighlightId;
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
    const canvas = this.pageCanvases.get(pageNumber);
    const selection = canvas?.ownerDocument.defaultView?.getSelection();
    if (selection && !selection.isCollapsed) return;
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
        this.emit('lr-highlight-activate', { highlightId: item.id });
        return;
      }
    }
  }

  /** `<lr-highlight-layer>`'s own `lr-highlight-activate` (bubbles + composed by default -- see
   *  `LyraElement.emit()`) fires directly on it for a click that lands squarely on its own
   *  rect-target (rare -- the text layer sitting on top normally intercepts a direct pointer click
   *  first, see `onPageClick`'s class-doc rationale) and for Enter/Space keyboard activation, which
   *  reaches the layer's own roving-tabindex rects directly since z-stacking doesn't affect tab
   *  order. Left unstopped, that raw event keeps bubbling right past this viewer under the very same
   *  public event name `onPageClick` above also emits -- reaching any consumer listening on
   *  `<lr-pdf-viewer>` as an undocumented duplicate. Stop it here and re-emit the viewer's own single
   *  copy instead, so exactly one `lr-highlight-activate` -- always originating from the viewer
   *  itself -- reaches consumers regardless of activation path. */
  private onHighlightLayerActivate = (event: LyraHighlightLayerEventMap['lr-highlight-activate']): void => {
    event.stopPropagation();
    this.emit('lr-highlight-activate', event.detail);
  };

  // -- rendering --------------------------------------------------------------------------------------------

  private renderToolbar(): TemplateResult {
    if (this.loadState.kind !== 'ready') return html``;
    const { pageCount } = this.loadState;
    const numberFormat = getNumberFormat(this.effectiveLocale);
    const formattedZoom = numberFormat.format(Math.round(this.zoom * 100));
    return html`<div part="toolbar">
      <button type="button" part="previous-button" data-action="previous" ?disabled=${this.page <= 1} aria-label=${this.localize('pdfViewerPreviousPage')} @click=${this.previousPage}>${this.localize('pdfViewerPreviousPage')}</button>
      <span part="page-indicator">${this.localize('pdfViewerPageOf', undefined, {
        page: numberFormat.format(this.page),
        total: numberFormat.format(pageCount),
      })}</span>
      <button type="button" part="next-button" data-action="next" ?disabled=${this.page >= pageCount} aria-label=${this.localize('pdfViewerNextPage')} @click=${this.nextPage}>${this.localize('pdfViewerNextPage')}</button>
      <button type="button" part="zoom-out-button" data-action="zoom-out" ?disabled=${this.zoom <= MIN_ZOOM} aria-label=${this.localize('pdfViewerZoomOut')} @click=${this.zoomOut}>${this.localize('pdfViewerZoomOut')}</button>
      <span part="zoom-indicator" aria-label=${this.localize('pdfViewerCurrentZoom', undefined, { percent: formattedZoom })}>${this.localize('pdfViewerCurrentZoom', undefined, { percent: formattedZoom })}</span>
      <button type="button" part="zoom-in-button" data-action="zoom-in" ?disabled=${this.zoom >= MAX_ZOOM} aria-label=${this.localize('pdfViewerZoomIn')} @click=${this.zoomIn}>${this.localize('pdfViewerZoomIn')}</button>
    </div>`;
  }

  private async renderPage(pageNumber: number, canvas: HTMLCanvasElement): Promise<void> {
    if (this.loadState.kind !== 'ready') return;
    const version = ++this.pageRenderGeneration;
    this.pageRenderVersions.set(pageNumber, version);
    const doc = this.loadState.doc;
    const zoom = this.zoom;
    let renderTask: { promise: Promise<void>; cancel(): void } | undefined;
    this.setPageError(canvas, false);
    this.pageRenderTasks.get(pageNumber)?.cancel();
    this.pageRenderTasks.delete(pageNumber);
    this.textLayers.get(pageNumber)?.cancel();
    this.textLayers.delete(pageNumber);
    try {
      const page = await doc.getPage(pageNumber);
      if (
        this.loadState.kind !== 'ready' ||
        this.loadState.doc !== doc ||
        this.pageRenderVersions.get(pageNumber) !== version ||
        this.pageCanvases.get(pageNumber) !== canvas
      ) return;
      const viewport = page.getViewport({ scale: zoom });
      const dpr = canvas.ownerDocument.defaultView?.devicePixelRatio || 1;
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
      if (!canvasContext) throw new Error('Canvas 2D context is unavailable.');
      canvasContext.setTransform(dpr, 0, 0, dpr, 0, 0);
      renderTask = page.render({ canvasContext, viewport });
      this.pageRenderTasks.set(pageNumber, renderTask);
      void this.renderTextLayer(pageNumber, page, viewport, version).catch((error: unknown) => {
        if (
          !isAbortError(error)
          && this.isConnected
          && this.loadState.kind === 'ready'
          && this.loadState.doc === doc
          && this.pageRenderVersions.get(pageNumber) === version
          && this.pageCanvases.get(pageNumber) === canvas
        ) this.emit('lr-render-error', { error });
      });
      await renderTask.promise;
      if (
        !this.isConnected
        || this.loadState.kind !== 'ready'
        || this.loadState.doc !== doc
        || this.pageRenderVersions.get(pageNumber) !== version
        || this.pageCanvases.get(pageNumber) !== canvas
      ) return;
      this.setPageError(canvas, false);
    } catch (error) {
      if (
        !isAbortError(error)
        && this.isConnected
        && this.loadState.kind === 'ready'
        && this.loadState.doc === doc
        && this.pageRenderVersions.get(pageNumber) === version
        && this.pageCanvases.get(pageNumber) === canvas
      ) {
        this.setPageError(canvas, true);
        this.emit('lr-render-error', { error });
      }
    } finally {
      if (renderTask && this.pageRenderTasks.get(pageNumber) === renderTask) {
        this.pageRenderTasks.delete(pageNumber);
      }
    }
  }

  private setPageError(canvas: HTMLCanvasElement, failed: boolean): void {
    const fallback = canvas.parentElement?.querySelector<HTMLElement>('[part~="page-error"]');
    if (!fallback) return;
    fallback.setAttribute('part', failed ? 'page-error page-error-visible' : 'page-error');
    fallback.hidden = !failed;
    fallback.textContent = failed ? this.localize('documentPreviewFailedToLoad') : '';
  }

  private async renderTextLayer(
    pageNumber: number,
    page: PdfPageApi,
    viewport: PdfViewportApi,
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
    this.mountedPageTextIndexes.delete(pageNumber);
    container.replaceChildren();
    const textLayer = new pdfjsLib.TextLayer({
      textContentSource: boundedPdfTextLayerSource(page.streamTextContent()),
      container,
      viewport,
    });
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
      this.resolveMountedPageHighlights();
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
    const doc = container.ownerDocument;
    const walker = doc.createTreeWalker(container, doc.defaultView?.NodeFilter.SHOW_ELEMENT ?? 1);
    let visited = 0;
    let node: Node | null;
    while (visited++ < TEXT_QUOTE_LIMITS.maxTraversalNodes && (node = walker.nextNode())) {
      const run = node as HTMLElement;
      if (run.localName === 'span' || run.localName === 'br') run.setAttribute('part', 'text-span');
    }
  }

  private pageCanvasRef(pageNumber: number): (element: Element | undefined) => void {
    let callback = this.pageCanvasRefs.get(pageNumber);
    if (!callback) {
      callback = (element: Element | undefined): void => {
        if (!element) {
          // Global render generations make deletion itself an invalidation: a later remount can
          // never reuse an old call's token, so this per-page map need not retain every seen page.
          this.pageRenderVersions.delete(pageNumber);
          this.pageCanvases.delete(pageNumber);
          this.pageRenderTasks.get(pageNumber)?.cancel();
          this.pageRenderTasks.delete(pageNumber);
          this.pageHighlightItems.delete(pageNumber);
          this.pageCanvasRefs.delete(pageNumber);
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
          this.mountedPageTextIndexes.delete(pageNumber);
          this.textLayers.get(pageNumber)?.cancel();
          this.textLayers.delete(pageNumber);
          this.textLayerReadyPromises.delete(pageNumber);
          this.pageHighlightItems.delete(pageNumber);
          this.textLayerContainerRefs.delete(pageNumber);
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
      <div part="page-error" hidden></div>
      <lr-highlight-layer
        ${ref(this.highlightLayerRef(number))}
        style="position:absolute; inset-block-start:var(--lr-space-m); inset-inline-start:50%; transform:translateX(${highlightTransform});"
        @lr-highlight-activate=${this.onHighlightLayerActivate}
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
        return html`${this.renderToolbar()}<lr-virtual-list part="pages" exportparts="page:page, page-canvas:page-canvas, page-error:page-error, text-layer:text-layer, text-span:text-span, search-match:search-match, search-match-active:search-match-active" .source=${this.indexedPages(this.loadState.pageCount)} .renderItem=${this.renderPageItem} .activeItemId=${this.scrollDrivenPage ? '' : this.page} @lr-visible-range-changed=${this.onVisibleRangeChanged}></lr-virtual-list>`;
      }
      case 'loading': return html`<div part="spinner">
        <lr-skeleton shape="rect" .announce=${false}></lr-skeleton>
        <span class="sr-only">${this.localize('loadingDocument')}</span>
      </div>`;
      case 'error': return html`<div part="error">${this.loadState.message}</div>`;
      case 'idle': default: return html`<p class="empty-note">${this.localize('documentPreviewEmpty', undefined, { type: this.localize('documentPreviewTypeDocument') })}</p>`;
    }
  }

  override render(): TemplateResult {
    return html`<div
      part="base"
      role=${viewerSemanticRole(this, 'region') ?? nothing}
      aria-busy=${this.loadState.kind === 'loading' ? 'true' : 'false'}
      style=${sanitizeCssLength(this.maxHeight)
        ? styleMap({ '--lr-pdf-viewer-height': sanitizeCssLength(this.maxHeight)! })
        : nothing}
      aria-label=${viewerSemanticLabel(this, this.name || this.localize('pdfViewerLabel')) ?? nothing}
    >${this.renderBody()}${this.renderAnchorLiveRegion()}</div>`;
  }
}

declare global { interface HTMLElementTagNameMap { 'lr-pdf-viewer': LyraPdfViewer; } }
