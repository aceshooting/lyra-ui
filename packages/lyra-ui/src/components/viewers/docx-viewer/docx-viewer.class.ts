import { html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import { styleMap } from 'lit/directives/style-map.js';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { boundedViewerSearchQuery } from '../viewer-search-limits.js';
import { srOnly } from '../../../internal/a11y.js';
import {
  isAbortError,
  isResourceLimitError,
  LyraUserFacingError,
  readResponseArrayBuffer,
  resolveOwnerFetchTarget,
} from '../../../internal/resource-loader.js';
import { prefersReducedMotion } from '../../../internal/motion.js';
import { sanitizeCssLength } from '../../../internal/safe-css.js';
import { invalidateLyraLocaleCache } from '../../../internal/localization-runtime.js';
import { Slugger } from '../../../internal/slugger.js';
import {
  DocumentAnchorTarget,
  prioritizedHighlightCandidates,
  type LyraAnchorTargetEventMap,
} from '../../../internal/anchor-target.js';
import {
  buildQuoteAnchor,
  createTextQuoteIndex,
  emptyTextQuoteMatches,
  rangeFromTextQuoteMatch,
  rangesFromTextQuoteMatches,
  scopeFromElement,
  TEXT_QUOTE_LIMITS,
  TEXT_SELECTION_RECT_LIMIT,
  type TextQuoteIndex,
  type TextQuoteMatch,
  type TextQuoteMatches,
  type TextQuoteScope,
} from '../../../internal/text-quote.js';
import { acquireHighlightHandle, supportsCustomHighlights, type HighlightHandle } from '../../../internal/text-highlights.js';
import type {
  LyraAnchor,
  LyraHighlight,
  LyraHighlightTone,
} from '../document-viewer/anchors.js';
import { loadDocxDeps, type DocxDeps } from './docx-loader.js';
import { assertDocxArchiveWithinLimits } from './docx-resource-guard.js';
import { styles } from './docx-viewer.styles.js';
import type { LyraViewerDiagnosticEventDetail } from '../viewer-diagnostics.js';
export type {
  LyraViewerDiagnostic,
  LyraViewerDiagnosticCode,
  LyraViewerDiagnosticEventDetail,
  LyraViewerDiagnosticSeverity,
} from '../viewer-diagnostics.js';
import { ViewerAnnouncementController } from '../viewer-announcements.js';
import { renderViewerLoading, viewerLoadingStyles } from '../viewer-loading.js';
import { sanitizePassiveMarkup } from '../passive-markup.js';
import { viewerSemanticLabel, viewerSemanticRole } from '../viewer-semantic-owner.js';
import type { LyraSearchChangeDetail } from '../../../internal/text-viewer-target.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_anchorJumped, LYRA_DEFAULT_anchorJumpedToPage, LYRA_DEFAULT_anchorNotFound, LYRA_DEFAULT_documentPreviewEmpty, LYRA_DEFAULT_documentPreviewFailedToLoad, LYRA_DEFAULT_documentPreviewResourceTooLarge, LYRA_DEFAULT_documentPreviewTypeDocument, LYRA_DEFAULT_documentPreviewUrlNotAllowed, LYRA_DEFAULT_documentViewerMissingSanitizer, LYRA_DEFAULT_docxViewerLabel, LYRA_DEFAULT_docxViewerMissingConverter, LYRA_DEFAULT_highlightWithLabel, LYRA_DEFAULT_loadingDocument } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END


type FetchState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'loaded'; markup: string }
  | { kind: 'error'; message: string };

/** One entry of `getHeadingTree()`'s document-ordered outline. Same shape as `<lr-markdown>`'s
 *  own `MarkdownHeadingItem` -- kept as a separate, structurally identical type rather than
 *  importing across component families, matching this library's per-component-family type
 *  boundary. */
export interface DocxHeadingItem {
  id: string;
  label: string;
  level: number;
}

/** Every `LyraHighlightTone`, used to always call `HighlightHandle.setRanges()` once per tone on
 *  every repaint (with an empty array for an unused tone) -- `setRanges()` replaces a tone's ranges
 *  wholesale per call, so a tone this pass has nothing for still needs an explicit empty call to
 *  clear whatever it painted last pass. */
const HIGHLIGHT_TONES: LyraHighlightTone[] = ['accent', 'success', 'warning', 'danger', 'neutral'];
const MAX_DOCX_SEARCH_MATCHES = 1_000;
const MAX_DOCX_PAINTED_SEARCH_MATCHES = 200;
const MAX_DOCX_PAINTED_HIGHLIGHTS = 100;

/** Wraps the text covered by `range` in one or more `<mark part="...">` elements, splitting any
 *  text node the range only partially covers -- handles a match spanning an inline element
 *  boundary, not just a single text node. */
interface DocxPaintWorkBudget {
  traversalNodes: number;
  codeUnits: number;
  marks: number;
}

function nextDocxPaintNode(node: Node, root: Node): Node | null {
  if (node.firstChild) return node.firstChild;
  let cursor: Node | null = node;
  while (cursor && cursor !== root) {
    if (cursor.nextSibling) return cursor.nextSibling;
    cursor = cursor.parentNode;
  }
  return null;
}

function wrapRangeInSearchMarks(
  range: Range,
  part: string,
  budget: DocxPaintWorkBudget,
): HTMLElement[] {
  const doc = range.startContainer.ownerDocument;
  if (!doc) return [];
  const textNodeType = doc.defaultView?.Node.TEXT_NODE ?? 3;
  if (range.startContainer === range.endContainer && range.startContainer.nodeType === textNodeType) {
    const textNode = range.startContainer as Text;
    if (budget.traversalNodes <= 0 || budget.codeUnits <= 0 || budget.marks <= 0) return [];
    budget.traversalNodes--;
    if (textNode.data.length > budget.codeUnits) {
      budget.codeUnits = 0;
      return [];
    }
    budget.codeUnits -= textNode.data.length;
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
          covered.push(textNode);
          if (covered.length > budget.marks) return [];
        }
      } catch {
        return [];
      }
    }
    node = nextDocxPaintNode(node, ancestor);
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
    budget.marks--;
  }
  return marks;
}

/** Unwraps a `<mark>` painted by `wrapRangeInSearchMarks()` back into plain text, merging the
 *  restored text with untouched sibling text nodes. */
function unwrapSearchMark(mark: HTMLElement): void {
  const parent = mark.parentNode;
  if (!parent) return;
  const before = mark.previousSibling;
  const firstMoved = mark.firstChild;
  while (mark.firstChild) parent.insertBefore(mark.firstChild, mark);
  const after = mark.nextSibling;
  parent.removeChild(mark);
  let cursor = before?.nodeType === 3 ? before : firstMoved ?? after;
  let localSteps = 0;
  while (cursor && cursor.parentNode === parent && localSteps++ < 4) {
    if (cursor.nodeType !== 3) break;
    const text = cursor as Text;
    if (text.data === '') {
      const next = text.nextSibling;
      text.remove();
      cursor = next;
      continue;
    }
    const next = text.nextSibling;
    if (next?.nodeType !== 3) break;
    text.appendData((next as Text).data);
    next.remove();
  }
}

export interface LyraDocxViewerEventMap extends LyraAnchorTargetEventMap {
  'lr-render-error': CustomEvent<{ error: unknown }>;
  'lr-viewer-diagnostic': CustomEvent<LyraViewerDiagnosticEventDetail>;
  'lr-search-change': CustomEvent<LyraSearchChangeDetail>;
}

class LyraDocxViewerBase extends LyraElement<LyraDocxViewerEventMap> {}

/**
 * Renders a DOCX document as sanitized semantic HTML using the optional
 * `mammoth` converter and `dompurify` sanitizer peers. DOCX content is always
 * sanitized; there is no unsanitized rendering mode for uploaded documents.
 *
 * Every rendered heading's slug (computed via the shared GitHub-slugger-style `Slugger` -- the same
 * algorithm and shared class `<lr-markdown>` uses, so identical heading text slugs identically
 * across both viewers) is stamped as its `id` and cached into `getHeadingTree()`'s document-ordered
 * outline -- unconditional, unlike `<lr-markdown>`'s opt-in `heading-anchors`, since this
 * component's rendered HTML is always internal (mammoth's own conversion output), never a raw string
 * a consumer might serialize verbatim. Adopts `DocumentAnchorTarget`: `fragment` anchors resolve
 * against that outline, `text-quote` anchors via `internal/text-quote.ts`'s shared scope/resolve
 * helpers; `highlights` re-resolve by quote after every render (never by node identity), so a
 * highlight painted before its quote is in the rendered markup yet simply paints once a later load
 * contains it. At most 100 quotes are painted per pass from a 1,000-entry candidate window;
 * `activeHighlightId` is retained from anywhere in the bounded host snapshot and resolved first.
 * Keyboard-accessible
 * highlight actions are rendered only for quotes that resolved
 * against the currently loaded document, so an action never presents an enabled no-op. Highlight
 * painting uses `internal/text-highlights.ts`'s `acquireHighlightHandle()` --
 * the CSS Custom Highlight API where the browser supports it (no DOM mutation at all), a `<mark>`-wrap
 * fallback otherwise. `search()`/`searchNext()`/`searchPrevious()`/`clearSearch()` do a
 * case-insensitive substring search over the rendered content's text and paint every match as a
 * `<mark part="search-match">` (the active one also carrying `search-match-active`) -- a separate,
 * always-real-DOM-element mechanism from the tone-based highlight painting above, since search needs
 * many simultaneously-visible matches rather than one set of themed spans.
 * A nonempty host `aria-label` makes the host the sole named semantic owner; otherwise the loaded
 * shadow document owns the explicit-empty, `name`, or localized fallback label.
 *
 * @customElement lr-docx-viewer
 * @event lr-render-error - Fired only when loading, conversion, or sanitization fails terminally.
 * @event lr-viewer-diagnostic - Structured non-fatal converter diagnostics. `detail.diagnostic`
 *   has code `docx-conversion-message`, severity, source, and the original peer value as `cause`.
 * @event lr-search-change - Fired whenever the search query, match count, or active match index
 *   changes, including source-reset and effective-locale re-evaluation. `detail: { query,
 *   matchCount, matchCountExact, activeIndex }`. Search accepts at most 4,096 query code units,
 *   scans at most 4,000,000 code units, and retains at most 1,000 matches; a false
 *   `matchCountExact` makes `matchCount` a lower bound after any ceiling is reached.
 * @event lr-highlight-activate - A painted `text-quote` highlight was clicked or its resolved
 *   keyboard action was activated. `detail: { highlightId }`.
 * @event lr-text-select - Fired on selection end inside the rendered content. `detail: { text,
 *   anchor, rects }`; `anchor` is a `text-quote` `LyraAnchor` scoped to the rendered content, or
 *   `null` if the selection couldn't be anchored.
 * @event lr-anchor-result - Fired after an `anchor` property assignment or a `scrollToAnchor()`
 *   call is applied. `detail: { found }`.
 * @csspart base - The root container with explicit `aria-busy` loading state.
 * @csspart body - The scrollable document body.
 * @csspart content - The semantic document content.
 * @csspart error - The error message region.
 * @csspart spinner - The visible tokenized loading treatment and ordinary text label.
 * @csspart highlight - A painted `text-quote` highlight (`<mark>`, `<mark>`-wrap fallback path only).
 * @csspart highlight-actions - Keyboard-accessible actions for the resolved text highlights.
 * @csspart highlight-action - One native highlight activation button.
 * @csspart search-match - A painted in-document search match.
 * @csspart search-match-active - The currently active search match (also carries `search-match`).
 * @cssprop [--lr-docx-viewer-max-height=none] - Maximum block size of the scrollable document body before it scrolls internally. Also settable via the `max-height` property.
 * @cssprop --lr-docx-viewer-highlight-accent-background - Accent highlight background.
 * @cssprop --lr-docx-viewer-highlight-success-background - Success highlight background.
 * @cssprop --lr-docx-viewer-highlight-warning-background - Warning highlight background.
 * @cssprop --lr-docx-viewer-highlight-danger-background - Danger highlight background.
 * @cssprop --lr-docx-viewer-highlight-neutral-background - Neutral highlight background.
 * @cssprop --lr-docx-viewer-highlight-active-background - Active highlight background.
 * @cssprop --lr-docx-viewer-highlight-active-outline - Active fallback-highlight outline.
 * @cssprop --lr-docx-viewer-search-match-background - Search-match background.
 * @cssprop --lr-docx-viewer-search-match-active-background - Active search-match background.
 * @cssprop --lr-docx-viewer-search-match-active-foreground - Active search-match foreground.
 * @status stable
 * @since 4.0.0
 */
export class LyraDocxViewer extends DocumentAnchorTarget(LyraDocxViewerBase) {
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
    documentViewerMissingSanitizer: LYRA_DEFAULT_documentViewerMissingSanitizer,
    docxViewerLabel: LYRA_DEFAULT_docxViewerLabel,
    docxViewerMissingConverter: LYRA_DEFAULT_docxViewerMissingConverter,
    highlightWithLabel: LYRA_DEFAULT_highlightWithLabel,
    loadingDocument: LYRA_DEFAULT_loadingDocument,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  static override styles = [LyraElement.styles, styles, srOnly, viewerLoadingStyles];

  /** URL to fetch and convert as a DOCX document. */
  @property() src = '';

  /** Accessible name for the rendered document when the host has no `aria-label`. Host
   *  `aria-label` wins by attribute presence, including an empty value. */
  @property() name = '';

  /** A CSS `max-height` that caps the scrollable document body; invalid values are ignored. */
  @property({ attribute: 'max-height' }) maxHeight = '';

  /** Anchor kinds this viewer resolves via `scrollToAnchor()`. Readonly. */
  override readonly anchorKinds = ['fragment', 'text-quote'] as const;

  @state() private fetchState: FetchState = { kind: 'idle' };
  @state() private searchMatches: TextQuoteMatches = emptyTextQuoteMatches();
  private searchMatchCountExact = true;
  @state() private searchActiveIndex = -1;
  @state() private resolvedHighlightActions: LyraHighlight[] = [];

  private generation = 0;
  private lastLoadSrc = '';
  private loadLibrary: () => Promise<DocxDeps> = loadDocxDeps;
  private readonly announcements = new ViewerAnnouncementController(this);

  /** Document-ordered heading outline, cached on every successful load (see `getHeadingTree()`). */
  private headingTree: DocxHeadingItem[] = [];

  /** Lazily acquired the first time a highlight needs painting; released on disconnect. */
  private highlightHandle?: HighlightHandle;

  /** The most recently resolved `text-quote` highlight ranges, kept for `onContentClick()`'s
   *  coordinate hit-test -- the CSS Custom Highlight API paints ranges without creating any DOM
   *  element to attach a click listener to, so activation is resolved by comparing the click point
   *  against each range's own `getClientRects()` instead, uniformly across both paint paths. */
  private resolvedHighlightRanges: { highlight: LyraHighlight; range: Range }[] = [];
  private pendingResolvedHighlightActions: LyraHighlight[] = [];
  private resolvedHighlightActionSyncPending = false;

  private searchQuery = '';
  private paintedSearchMarks: HTMLElement[] = [];

  /** Bounded normalized corpus plus reusable occurrence cache for the current loaded document. */
  private textIndexCache: { scope: TextQuoteScope; index: TextQuoteIndex; locale: string } | null = null;
  private textIndexMappingDirty = false;
  private textIndexLocale?: string;

  override connectedCallback(): void {
    super.connectedCallback();
    this.announcements.connect();
    if (this.hasUpdated && this.src.trim() && this.src === this.lastLoadSrc) {
      this.scheduleAfterUpdate(() => { void this.load(); });
    }
  }

  override disconnectedCallback(): void {
    this.generation++;
    this.resetResolvedHighlightActions();
    this.announcements.disconnect();
    super.disconnectedCallback(); // reaches DocumentAnchorTarget's own cleanup (anchor retry, selection binding)
    this.highlightHandle?.release();
    this.highlightHandle = undefined;
  }

  override adoptedCallback(): void {
    super.adoptedCallback();
    this.announcements.adopted();
  }

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed); // reaches DocumentAnchorTarget's own willUpdate (declarative `anchor`)
    if (changed.has('src') || changed.has('highlights')) {
      this.resetResolvedHighlightActions();
    }
    if (changed.has('src') || changed.has('fetchState')) this.resetSearchForContentChange();
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    const locale = this.effectiveLocale;
    const localeChanged = this.textIndexLocale !== undefined && this.textIndexLocale !== locale;
    this.textIndexLocale = locale;
    if (localeChanged) this.textIndexCache = null;
    this.announcements.transition(
      'load',
      this.fetchState.kind,
      this.fetchState.kind === 'error' ? this.fetchState.message : this.localize('loadingDocument'),
    );
    if (changed.has('src')) this.scheduleAfterUpdate(() => { void this.load(); });
    if (changed.has('fetchState')) {
      // The content wrapper is a brand-new element every time fetchState transitions to 'loaded'
      // (a different render() branch than idle/loading/error), unlike a stable always-rendered
      // wrapper -- rebinding here (idempotent: bindTextSelection() cleans up its own previous
      // listeners first) keeps selection tracking attached to whichever element is live.
      const root = this.contentRoot();
      if (root) (this as unknown as { bindTextSelection(root: Element): void }).bindTextSelection(root);
      // Any fetchState transition means contentRoot() is either gone or a brand-new element (see
      // above), so a previously cached text index (see getTextIndex()) can no longer describe it.
      this.textIndexCache = null;
      this.textIndexMappingDirty = false;
    }
    if (
      changed.has('fetchState')
      || changed.has('highlights')
      || changed.has('activeHighlightId')
      || (localeChanged && this.highlights.length > 0)
    ) {
      this.repaintHighlights();
    }
    if (localeChanged && this.searchQuery.trim()) {
      this.scheduleAfterUpdate(() => { void this.search(this.searchQuery); });
    }
  }

  private contentRoot(): Element | null {
    return this.renderRoot.querySelector('[part="content"]');
  }

  private resetSearchForContentChange(): void {
    const shouldEmit = this.searchQuery !== '' || this.searchMatches.length > 0 || this.searchActiveIndex !== -1;
    this.searchQuery = '';
    this.searchMatches = emptyTextQuoteMatches();
    this.searchMatchCountExact = true;
    this.searchActiveIndex = -1;
    this.clearSearchPaint();
    if (shouldEmit) {
      this.emit('lr-search-change', {
        query: '',
        matchCount: 0,
        matchCountExact: true,
        activeIndex: -1,
      });
    }
  }

  private async load(): Promise<void> {
    const generation = ++this.generation;
    const signal = this.beginAbortableLoad();
    this.lastLoadSrc = this.src;
    if (!this.src) {
      this.fetchState = { kind: 'idle' };
      this.headingTree = [];
      return;
    }

    const fetchTarget = resolveOwnerFetchTarget(this, this.src);
    if (!fetchTarget) {
      this.failWithLocalizedMessage(this.localize('documentPreviewUrlNotAllowed'));
      return;
    }

    this.fetchState = { kind: 'loading' };
    try {
      const response = await fetchTarget.view.fetch(fetchTarget.url, signal ? { signal } : undefined);
      if (!this.isConnected || generation !== this.generation) return;
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
      const arrayBuffer = await readResponseArrayBuffer(response);
      if (!this.isConnected || generation !== this.generation) return;
      await assertDocxArchiveWithinLimits(arrayBuffer, undefined, undefined, { signal });
      if (!this.isConnected || generation !== this.generation) return;
      const { mammoth, DOMPurify } = await this.loadLibrary();
      if (!this.isConnected || generation !== this.generation) return;
      if (!mammoth) {
        this.failWithLocalizedMessage(this.localize('docxViewerMissingConverter'));
        return;
      }
      if (!DOMPurify) {
        this.failWithLocalizedMessage(this.localize('documentViewerMissingSanitizer'));
        return;
      }

      const converted = (await mammoth.convertToHtml({ arrayBuffer })) as { value: string; messages: unknown[] };
      if (!this.isConnected || generation !== this.generation) return;
      const markup = sanitizePassiveMarkup(
        DOMPurify,
        converted.value,
        this.ownerDocument,
        'passive-document',
      );
      if (!this.isConnected || generation !== this.generation) return;
      this.fetchState = {
        kind: 'loaded',
        markup: this.stampHeadings(markup),
      };
      if (converted.messages.length > 0) {
        for (const cause of converted.messages) {
          this.emit('lr-viewer-diagnostic', {
            diagnostic: Object.freeze({
              code: 'docx-conversion-message',
              severity: 'warning',
              fatal: false,
              source: 'mammoth',
              cause,
            } as const),
          });
        }
      }
    } catch (error) {
      if (isAbortError(error) || !this.isConnected || generation !== this.generation) return;
      this.fetchState = {
        kind: 'error',
        message: this.localize(isResourceLimitError(error) ? 'documentPreviewResourceTooLarge' : 'documentPreviewFailedToLoad'),
      };
      this.emit('lr-render-error', { error });
    }
  }

  private failWithLocalizedMessage(message: string): void {
    const error = new LyraUserFacingError(message);
    this.fetchState = { kind: 'error', message };
    this.emit('lr-render-error', { error });
  }

  /** Parses the already-sanitized markup once (`DOMParser`), stamps a `Slugger`-computed `id` on
   *  every `h1`-`h6`, and caches the resulting document-ordered outline into `headingTree`. A fresh
   *  `Slugger` per call, matching `<lr-markdown>`'s own per-parse instance, so re-loading a new
   *  document never carries duplicate-slug state from a previous one. Traversal admits at most the
   *  shared 20,000-node ceiling, and the slugger's monotonic suffix cursor keeps aggregate duplicate
   *  membership work linear across that bounded pass. */
  private stampHeadings(sanitizedHtml: string): string {
    const DOMParserCtor = this.ownerDocument.defaultView?.DOMParser;
    if (!DOMParserCtor) throw new Error('DOMParser is unavailable without a browsing context.');
    const doc = new DOMParserCtor().parseFromString(sanitizedHtml, 'text/html');
    const slugger = new Slugger();
    const tree: DocxHeadingItem[] = [];
    const walker = doc.createTreeWalker(doc.body, 0x1 /* NodeFilter.SHOW_ELEMENT */);
    let inspected = 0;
    let node: Node | null;
    while (
      inspected < TEXT_QUOTE_LIMITS.maxTraversalNodes
      && (node = walker.nextNode())
    ) {
      inspected++;
      const heading = node as Element;
      if (!/^H[1-6]$/.test(heading.tagName)) continue;
      const level = Number(heading.tagName.slice(1));
      const label = (heading.textContent ?? '').trim();
      const slug = slugger.slug(label);
      if (slug) heading.id = slug;
      tree.push({ id: slug, label, level });
    }
    this.headingTree = tree;
    return doc.body.innerHTML;
  }

  /** A document-ordered, flattened heading outline -- empty until a document has finished loading. */
  getHeadingTree(): DocxHeadingItem[] {
    return [...this.headingTree];
  }

  // -- anchor-target: applyAnchor per kind -----------------------------------------------------

  protected async applyAnchor(anchor: LyraAnchor): Promise<boolean> {
    const root = this.contentRoot();
    if (!root) return false;
    switch (anchor.kind) {
      case 'fragment':
        return this.applyFragmentAnchor(root, anchor);
      case 'text-quote':
        return this.applyTextQuoteAnchor(root, anchor);
      default:
        return false;
    }
  }

  private applyFragmentAnchor(root: Element, anchor: Extract<LyraAnchor, { kind: 'fragment' }>): boolean {
    if (!anchor.id) return false;
    let expectedIndex = -1;
    const headingLimit = Math.min(this.headingTree.length, TEXT_QUOTE_LIMITS.maxTraversalNodes);
    for (let index = 0; index < headingLimit; index++) {
      if (this.headingTree[index]?.id === anchor.id) {
        expectedIndex = index;
        break;
      }
    }
    if (expectedIndex < 0) return false;
    // Fragment anchors are heading ids, so scan that fixed set and compare the raw attribute.
    // This accepts selector punctuation and works in adopted/partial DOM realms with no
    // `CSS.escape`, while the positional fallback below still covers sanitizer-stripped ids.
    const walker = root.ownerDocument.createTreeWalker(root, 0x1 /* NodeFilter.SHOW_ELEMENT */);
    let inspected = 0;
    let headingIndex = 0;
    let idMatch: Element | null = null;
    let positionalMatch: Element | null = null;
    let node: Node | null;
    while (
      inspected < TEXT_QUOTE_LIMITS.maxTraversalNodes
      && (node = walker.nextNode())
    ) {
      inspected++;
      const heading = node as Element;
      if (!/^H[1-6]$/.test(heading.tagName)) continue;
      if (heading.getAttribute('id') === anchor.id) idMatch ??= heading;
      if (headingIndex === expectedIndex) positionalMatch = heading;
      headingIndex++;
      if (idMatch && positionalMatch) break;
    }
    const el = idMatch ?? positionalMatch;
    if (!el) return false;
    el.scrollIntoView({ behavior: prefersReducedMotion(this.ownerDocument.defaultView) ? 'auto' : 'smooth', block: 'start' });
    return true;
  }

  private applyTextQuoteAnchor(root: Element, anchor: Extract<LyraAnchor, { kind: 'text-quote' }>): boolean {
    const { scope, index } = this.currentTextIndex(root);
    const match = index.resolve(anchor);
    const range = match ? rangeFromTextQuoteMatch(scope, match) : null;
    if (!range) return false;
    const target = range.startContainer.nodeType === Node.ELEMENT_NODE ? (range.startContainer as Element) : range.startContainer.parentElement;
    (target ?? root).scrollIntoView({ behavior: prefersReducedMotion(this.ownerDocument.defaultView) ? 'auto' : 'smooth', block: 'center' });
    return true;
  }

  /** Overrides `DocumentAnchorTarget`'s default (whole render-root) selection scope -- only
   *  `[part="content"]` is a meaningful text-quote scope for this component. */
  protected computeSelectionAnchor(range: Range): LyraAnchor | null {
    const root = this.contentRoot();
    if (!root) return null;
    return buildQuoteAnchor(range, this.currentTextIndex(root).scope);
  }

  // -- highlight painting ------------------------------------------------------------------------

  private ensureHighlightHandle(): HighlightHandle {
    if (!this.highlightHandle) this.highlightHandle = acquireHighlightHandle(this, this.ownerDocument);
    return this.highlightHandle;
  }

  /** Re-resolves every `text-quote` highlight against the current rendered content and repaints
   *  via `acquireHighlightHandle()` -- resolution is always by quote text, never by node identity.
   *  `fragment` highlights aren't painted (there is no literal span of text to wrap/underline for a
   *  whole section). When there is no loaded content (idle/loading/error), every tone is explicitly
   *  cleared rather than left as-is, since a previously-loaded document's content (and its painted
   *  ranges) may no longer exist in the DOM at all. */
  private repaintHighlights(): void {
    this.resolvedHighlightRanges = [];
    const root = this.contentRoot();
    const handle = this.ensureHighlightHandle();
    if (!root) {
      this.syncResolvedHighlightActions([]);
      for (const tone of HIGHLIGHT_TONES) handle.setRanges(tone, []);
      handle.setActive(null);
      return;
    }
    const { scope, index } = this.currentTextIndex(root);
    const workBudget = index.createWorkBudget();
    const rangesByTone = new Map<LyraHighlightTone, Range[]>(HIGHLIGHT_TONES.map((tone) => [tone, []]));
    let activeRange: Range | null = null;
    const candidates = prioritizedHighlightCandidates(this.highlights, this.activeHighlightId);
    const resolved: Array<{ highlight: LyraHighlight; match: TextQuoteMatch }> = [];
    for (const highlight of candidates) {
      if (resolved.length >= MAX_DOCX_PAINTED_HIGHLIGHTS) break;
      if (highlight.anchor.kind !== 'text-quote') continue;
      const match = index.resolve(highlight.anchor, workBudget);
      if (match) resolved.push({ highlight, match });
    }
    const resolvedRanges = rangesFromTextQuoteMatches(scope, resolved.map(({ match }) => match));
    for (let position = 0; position < resolved.length; position++) {
      const { highlight } = resolved[position]!;
      const range = resolvedRanges[position] ?? null;
      if (!range) continue;
      rangesByTone.get(highlight.tone ?? 'accent')!.push(range);
      this.resolvedHighlightRanges.push({ highlight, range });
      if (highlight.id === this.activeHighlightId) activeRange = range;
    }
    this.syncResolvedHighlightActions(
      this.resolvedHighlightRanges.map(({ highlight }) => highlight),
    );
    for (const [tone, ranges] of rangesByTone) handle.setRanges(tone, ranges);
    handle.setActive(activeRange);
    if (!supportsCustomHighlights(this.ownerDocument)) {
      // The `<mark>`-wrap fallback creates real elements but carries no `part` of its own (the
      // module is shared by every adopting viewer, so it can't know this component's part naming)
      // -- stamped here so a consumer can still target `::part(highlight)` in browsers lacking the
      // CSS Custom Highlight API.
      const walker = root.ownerDocument.createTreeWalker(root, 0x1 /* NodeFilter.SHOW_ELEMENT */);
      let inspected = 0;
      let node: Node | null;
      while (
        inspected < TEXT_QUOTE_LIMITS.maxTraversalNodes + MAX_DOCX_PAINTED_HIGHLIGHTS
        && (node = walker.nextNode())
      ) {
        inspected++;
        const mark = node as Element;
        if (
          mark.localName === 'mark'
          && mark.hasAttribute('data-lr-highlight-tone')
          && !mark.hasAttribute('part')
        ) mark.setAttribute('part', 'highlight');
      }
      this.textIndexMappingDirty = true;
    }
  }

  /** Mirrors the synchronous range-resolution result into render state after the current Lit
   * update has finished. Repainting runs from `updated()`, so assigning the state there directly
   * would create a change-in-update warning; coalescing through one microtask also ensures a rapid
   * loading -> loaded transition exposes only the latest document's resolved entries. */
  private syncResolvedHighlightActions(highlights: LyraHighlight[]): void {
    this.pendingResolvedHighlightActions = [...new Set(highlights)];
    if (this.resolvedHighlightActionSyncPending) return;
    this.resolvedHighlightActionSyncPending = true;
    queueMicrotask(() => {
      this.resolvedHighlightActionSyncPending = false;
      if (!this.isConnected) return;
      const next = this.pendingResolvedHighlightActions;
      if (
        next.length === this.resolvedHighlightActions.length
        && next.every((highlight, index) => highlight === this.resolvedHighlightActions[index])
      ) return;
      this.resolvedHighlightActions = next;
    });
  }

  /** Drops both live ranges and render-facing entries before a document can leave the loaded state.
   * This is synchronous so neither a `src` transition nor reconnect can render an old document's
   * enabled action beside idle/loading UI while the next repaint microtask is still pending. */
  private resetResolvedHighlightActions(): void {
    this.resolvedHighlightRanges = [];
    this.pendingResolvedHighlightActions = [];
    this.resolvedHighlightActions = [];
  }

  /** Hit-tests a click point against every currently-resolved highlight's `getClientRects()`,
   *  topmost (last-resolved) first -- the CSS Custom Highlight API paints ranges without creating
   *  any DOM element to attach a click listener to, so this works identically on both paint paths. */
  private hitTestHighlightAt(x: number, y: number): string | null {
    let remainingRects = TEXT_SELECTION_RECT_LIMIT;
    for (let i = this.resolvedHighlightRanges.length - 1; i >= 0; i--) {
      const { highlight, range } = this.resolvedHighlightRanges[i]!; // safe: i in [0, length)
      for (const rect of range.getClientRects()) {
        if (remainingRects-- <= 0) return null;
        if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
          return highlight.id;
        }
      }
    }
    return null;
  }

  // A single delegated listener on the content wrapper (not one per node) -- the rendered markup
  // is fully replaced on every content change, so a per-node listener would need re-attaching on
  // every render anyway.
  private onContentClick = (e: MouseEvent): void => {
    const highlightId = this.hitTestHighlightAt(e.clientX, e.clientY);
    if (highlightId) this.emit('lr-highlight-activate', { highlightId });
  };

  private highlightActionLabel(highlight: LyraHighlight): string {
    return this.localize('highlightWithLabel', undefined, {
      label:
        highlight.label ||
        (highlight.anchor.kind === 'text-quote'
          ? highlight.anchor.quote
          : highlight.id),
    });
  }

  private activateHighlightAction(highlight: LyraHighlight): void {
    const resolved = this.resolvedHighlightRanges.find((entry) => entry.highlight === highlight);
    if (!resolved) return;
    const elementNode = this.ownerDocument.defaultView?.Node.ELEMENT_NODE ?? 1;
    const target =
      resolved.range.commonAncestorContainer.nodeType === elementNode
        ? resolved.range.commonAncestorContainer as Element
        : resolved.range.commonAncestorContainer.parentElement;
    target?.scrollIntoView?.({ block: 'nearest', behavior: 'auto' });
    this.activeHighlightId = highlight.id;
    this.emit('lr-highlight-activate', { highlightId: highlight.id });
  }

  private renderHighlightActions(): TemplateResult | typeof nothing {
    const resolved = new Set(this.resolvedHighlightActions);
    const highlights = this.highlights.filter(
      (highlight) => highlight.anchor.kind === 'text-quote' && resolved.has(highlight),
    );
    if (highlights.length === 0) return nothing;
    return html`
      <div part="highlight-actions">
        ${highlights.map((highlight) => {
          const label = this.highlightActionLabel(highlight);
          return html`
            <button
              part="highlight-action"
              type="button"
              aria-label=${label}
              @click=${() => this.activateHighlightAction(highlight)}
            >${highlight.label || label}</button>
          `;
        })}
      </div>
    `;
  }

  // -- search ----------------------------------------------------------------------------------------

  private getTextIndex(root: Element): { scope: TextQuoteScope; index: TextQuoteIndex; locale: string } {
    const locale = this.effectiveLocale;
    if (!this.textIndexCache || this.textIndexCache.locale !== locale) {
      const scope = scopeFromElement(root);
      this.textIndexCache = {
        scope,
        index: createTextQuoteIndex(scope, locale, { maxMatches: MAX_DOCX_SEARCH_MATCHES }),
        locale,
      };
      this.textIndexMappingDirty = false;
    }
    return this.textIndexCache;
  }

  /** Rebuilds only the node-bearing scope after fallback `<mark>` writes, preserving occurrence
   * offsets and the folded corpus when the normalized text is unchanged. */
  private currentTextIndex(root: Element): { scope: TextQuoteScope; index: TextQuoteIndex; locale: string } {
    const cached = this.getTextIndex(root);
    if (!this.textIndexMappingDirty) return cached;
    const scope = scopeFromElement(root);
    if (cached.index.rebindScope(scope)) {
      cached.scope = scope;
      this.textIndexMappingDirty = false;
      return cached;
    }
    this.textIndexCache = null;
    this.textIndexMappingDirty = false;
    return this.getTextIndex(root);
  }

  /** Case-insensitive substring search over the rendered content's text (via `getTextIndex()`).
   *  An empty/whitespace-only query, or no loaded content, behaves like `clearSearch()` and resolves
   *  `0`. Queries are limited to 4,096 code units, the indexed corpus to 1,000,000 code units and
   *  20,000 text nodes, and each pass to 4,000,000 scanned code units. Up to 1,000 matches are
   *  retained and a 200-match window is painted (see
   *  `paintSearchMatches()`), with the first one scrolled into view;
   *  `lr-search-change.detail.matchCountExact=false` identifies the resolved return as a lower
   *  bound. */
  async search(query: string): Promise<number> {
    // `lang` is a platform property rather than a Lit property, so it can change between user
    // searches without scheduling a render pass to invalidate LyraElement's per-update locale
    // memo. A search is itself a fresh locale-sensitive operation.
    invalidateLyraLocaleCache(this);
    this.searchQuery = query;
    if (!boundedViewerSearchQuery(query, this.effectiveLocale).accepted) {
      this.searchMatches = emptyTextQuoteMatches();
      this.searchMatchCountExact = false;
      this.searchActiveIndex = -1;
      this.clearSearchPaint();
      this.emitSearchChange();
      return 0;
    }
    const root = this.contentRoot();
    if (!root) {
      this.searchMatches = emptyTextQuoteMatches();
      this.searchMatchCountExact = true;
      this.searchActiveIndex = -1;
      this.clearSearchPaint();
      this.emitSearchChange();
      return 0;
    }
    const trimmed = query.trim();
    if (!trimmed) {
      this.searchMatches = emptyTextQuoteMatches();
      this.searchMatchCountExact = true;
      this.searchActiveIndex = -1;
      this.clearSearchPaint();
      this.emitSearchChange();
      return 0;
    }
    const { index } = this.getTextIndex(root);
    const matches = index.search(trimmed, index.createWorkBudget());
    this.searchMatches = matches;
    this.searchMatchCountExact = matches.matchCountExact;
    this.searchActiveIndex = matches.length > 0 ? 0 : -1;
    this.emitSearchChange();
    this.paintSearchMatches();
    if (this.searchActiveIndex >= 0) this.scrollToActiveSearchMatch();
    return matches.length;
  }

  /** Advances to the next match, wrapping to the first after the last. Resolves `false` (no-op)
   *  when there are no matches. */
  async searchNext(): Promise<boolean> {
    if (!this.searchMatches.length) return false;
    this.searchActiveIndex = (this.searchActiveIndex + 1) % this.searchMatches.length;
    this.emitSearchChange();
    this.paintSearchMatches();
    this.scrollToActiveSearchMatch();
    return true;
  }

  /** Moves to the previous match, wrapping to the last before the first. Resolves `false` (no-op)
   *  when there are no matches. */
  async searchPrevious(): Promise<boolean> {
    if (!this.searchMatches.length) return false;
    this.searchActiveIndex = (this.searchActiveIndex - 1 + this.searchMatches.length) % this.searchMatches.length;
    this.emitSearchChange();
    this.paintSearchMatches();
    this.scrollToActiveSearchMatch();
    return true;
  }

  /** Clears the query, matches, and any painted marks, and resets `lr-search-change` to a
   *  0-match/no-active-index state. */
  clearSearch(): void {
    this.searchQuery = '';
    this.searchMatches = emptyTextQuoteMatches();
    this.searchMatchCountExact = true;
    this.searchActiveIndex = -1;
    this.clearSearchPaint();
    this.emit('lr-search-change', { query: '', matchCount: 0, matchCountExact: true, activeIndex: -1 });
  }

  private emitSearchChange(): void {
    this.emit('lr-search-change', {
      query: this.searchQuery,
      matchCount: this.searchMatches.length,
      matchCountExact: this.searchMatchCountExact,
      activeIndex: this.searchActiveIndex,
    });
  }

  private scrollToActiveSearchMatch(): void {
    const active = this.renderRoot.querySelector('mark[part~="search-match-active"]') as HTMLElement | null;
    active?.scrollIntoView({ behavior: prefersReducedMotion(this.ownerDocument.defaultView) ? 'auto' : 'smooth', block: 'center' });
  }

  private clearSearchPaint(): void {
    if (this.paintedSearchMarks.length > 0) this.textIndexMappingDirty = true;
    for (const mark of this.paintedSearchMarks) unwrapSearchMark(mark);
    this.paintedSearchMarks = [];
  }

  /** Unwraps any previously-painted marks, then re-derives fresh `Range`s from every stored
   *  `{ start, end }` match against the *current* DOM (`getTextIndex()`, cached per loaded document
   *  rather than rebuilt on every call -- see `textIndexCache`) and wraps each in a `<mark
   *  part="search-match">`. Matches are wrapped in descending offset order deliberately: two
   *  matches sharing one text node would otherwise have the earlier match's stored offset
   *  invalidated by the later match's own `splitText()` calls -- processing highest-offset first
   *  only ever truncates the *end* of a shared node, which never shifts an earlier, not-yet-processed
   *  offset. */
  private paintSearchMatches(): void {
    this.clearSearchPaint();
    const root = this.contentRoot();
    if (!root || this.searchMatches.length === 0) return;
    const { scope } = this.currentTextIndex(root);
    const marks: HTMLElement[] = [];
    const count = Math.min(this.searchMatches.length, MAX_DOCX_PAINTED_SEARCH_MATCHES);
    const half = MAX_DOCX_PAINTED_SEARCH_MATCHES >> 1;
    const centre = this.searchActiveIndex < 0 ? 0 : this.searchActiveIndex;
    const start = Math.max(0, Math.min(centre - half, this.searchMatches.length - count));
    const budget: DocxPaintWorkBudget = {
      traversalNodes: TEXT_QUOTE_LIMITS.maxTraversalNodes,
      codeUnits: TEXT_QUOTE_LIMITS.maxCorpusCodeUnits,
      marks: MAX_DOCX_PAINTED_SEARCH_MATCHES,
    };
    const window: Array<{ index: number; match: TextQuoteMatch }> = [];
    for (let i = start + count - 1; i >= start; i--) {
      const match = this.searchMatches.at(i);
      if (!match) continue;
      window.push({ index: i, match });
    }
    const resolvedRanges = rangesFromTextQuoteMatches(scope, window.map(({ match }) => match));
    const ranges: Array<{ index: number; range: Range }> = [];
    for (let position = 0; position < window.length; position++) {
      const range = resolvedRanges[position];
      if (!range) continue;
      ranges.push({ index: window[position]!.index, range });
    }
    for (const { index, range } of ranges) {
      const part = index === this.searchActiveIndex ? 'search-match search-match-active' : 'search-match';
      marks.push(...wrapRangeInSearchMarks(range, part, budget));
    }
    this.paintedSearchMarks = marks;
    if (marks.length > 0) this.textIndexMappingDirty = true;
  }

  private renderBody(): TemplateResult {
    switch (this.fetchState.kind) {
      case 'loaded':
        return html`
          <div
            part="content"
            role=${viewerSemanticRole(this, 'document') ?? nothing}
            aria-label=${viewerSemanticLabel(this, this.name || this.localize('docxViewerLabel')) ?? nothing}
            @click=${this.onContentClick}
          >
            ${unsafeHTML(this.fetchState.markup)}
          </div>
        `;
      case 'loading':
        return renderViewerLoading(this.localize('loadingDocument'));
      case 'error':
        return html`<div part="error">${this.fetchState.message}</div>`;
      case 'idle':
      default:
        return html`<p class="empty-note">${this.localize('documentPreviewEmpty', undefined, { type: this.localize('documentPreviewTypeDocument') })}</p>`;
    }
  }

  override render(): TemplateResult {
    return html`
      <div
        part="base"
        aria-busy=${this.fetchState.kind === 'loading' ? 'true' : 'false'}
        style=${sanitizeCssLength(this.maxHeight)
          ? styleMap({ '--lr-docx-viewer-max-height': sanitizeCssLength(this.maxHeight)! })
          : nothing}
      >
        <div part="body">${this.renderBody()}${this.renderHighlightActions()}</div>
        ${this.renderAnchorLiveRegion()}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-docx-viewer': LyraDocxViewer;
  }
}
