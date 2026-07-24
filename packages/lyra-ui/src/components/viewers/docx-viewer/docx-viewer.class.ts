import { html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { srOnly } from '../../../internal/a11y.js';
import { safeFetchUrl } from '../../../internal/safe-url.js';
import {
  isAbortError,
  isResourceLimitError,
  LyraUserFacingError,
  readResponseArrayBuffer,
} from '../../../internal/resource-loader.js';
import { prefersReducedMotion } from '../../../internal/motion.js';
import { invalidateLyraLocaleCache } from '../../../internal/localization.js';
import { Slugger } from '../../../internal/slugger.js';
import { DocumentAnchorTarget, type LyraAnchorTargetEventMap } from '../../../internal/anchor-target.js';
import { scopeFromElement, resolveTextQuote, buildQuoteAnchor } from '../../../internal/text-quote.js';
import { acquireHighlightHandle, supportsCustomHighlights, type HighlightHandle } from '../../../internal/text-highlights.js';
import type { LyraAnchor, LyraHighlightTone, HighlightActivateDetail } from '../document-viewer/anchors.js';
import { loadDocxDeps, type DocxDeps } from './docx-loader.js';
import { assertDocxArchiveWithinLimits } from './docx-resource-guard.js';
import { styles } from './docx-viewer.styles.js';

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

/** One `search()` match, as absolute offsets into the rendered content's concatenated text-node
 *  data (see `buildTextIndex()`) -- kept as plain numbers rather than a live `Range` so a repaint
 *  (`paintSearchMatches()`) can always recompute fresh `Range`s against the current DOM instead of
 *  reusing references that a previous paint pass's own text-node splitting may have invalidated. */
interface DocxSearchMatch {
  start: number;
  end: number;
}

/** One text node's contribution to a `buildTextIndex()` corpus: it occupies `[start, end)` in the
 *  concatenated raw text. */
interface DocxTextIndexEntry {
  node: Text;
  start: number;
  end: number;
}

/** Every `LyraHighlightTone`, used to always call `HighlightHandle.setRanges()` once per tone on
 *  every repaint (with an empty array for an unused tone) -- `setRanges()` replaces a tone's ranges
 *  wholesale per call, so a tone this pass has nothing for still needs an explicit empty call to
 *  clear whatever it painted last pass. */
const HIGHLIGHT_TONES: LyraHighlightTone[] = ['accent', 'success', 'warning', 'danger', 'neutral'];
const MAX_DOCX_SEARCH_MATCHES = 1_000;

/** Walks `root`'s text nodes in document order and returns their concatenated raw text alongside
 *  an offset table (`entries`) mapping each contiguous span back to the `Text` node that produced
 *  it -- the corpus both `search()` (case-insensitive substring matching) and `paintSearchMatches()`
 *  (re-locating a stored `{ start, end }` match back into the live DOM) share. */
function buildTextIndex(root: Element): { text: string; entries: DocxTextIndexEntry[] } {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const entries: DocxTextIndexEntry[] = [];
  let text = '';
  let node: Node | null;
  while ((node = walker.nextNode())) {
    const textNode = node as Text;
    if (textNode.data.length === 0) continue;
    entries.push({ node: textNode, start: text.length, end: text.length + textNode.data.length });
    text += textNode.data;
  }
  return { text, entries };
}

/** Resolves an absolute offset into a `buildTextIndex()` corpus back to a `(Text node, local
 *  offset)` point -- a boundary offset shared by two adjacent entries resolves to the end of the
 *  earlier one, which is still a valid `Range` boundary. */
function pointAtOffset(entries: DocxTextIndexEntry[], offset: number): { node: Text; offset: number } | null {
  for (const entry of entries) {
    if (offset >= entry.start && offset <= entry.end) return { node: entry.node, offset: offset - entry.start };
  }
  return null;
}

/** Wraps the text covered by `range` in one or more `<mark part="...">` elements, splitting any
 *  text node the range only partially covers -- handles a match spanning an inline element
 *  boundary, not just a single text node. */
function wrapRangeInSearchMarks(range: Range, part: string): HTMLElement[] {
  const doc = range.startContainer.ownerDocument ?? document;
  const ancestor = range.commonAncestorContainer;
  const walkRoot = ancestor.nodeType === Node.TEXT_NODE ? ancestor.parentNode! : ancestor;
  const walker = doc.createTreeWalker(walkRoot, NodeFilter.SHOW_TEXT);
  const covered: Text[] = [];
  let node: Node | null;
  while ((node = walker.nextNode())) {
    if (range.intersectsNode(node) && (node as Text).data.length > 0) covered.push(node as Text);
  }
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
  return marks;
}

/** Unwraps a `<mark>` painted by `wrapRangeInSearchMarks()` back into plain text, merging the
 *  restored text with untouched sibling text nodes. */
function unwrapSearchMark(mark: HTMLElement): void {
  const parent = mark.parentNode;
  if (!parent) return;
  while (mark.firstChild) parent.insertBefore(mark.firstChild, mark);
  parent.removeChild(mark);
  parent.normalize();
}

export interface LyraDocxViewerEventMap extends LyraAnchorTargetEventMap {
  'lr-render-error': CustomEvent<{ error: unknown }>;
  'lr-search-change': CustomEvent<{ query: string; matchCount: number; activeIndex: number }>;
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
 * contains it. Highlight painting uses `internal/text-highlights.ts`'s `acquireHighlightHandle()` --
 * the CSS Custom Highlight API where the browser supports it (no DOM mutation at all), a `<mark>`-wrap
 * fallback otherwise. `search()`/`searchNext()`/`searchPrevious()`/`clearSearch()` do a
 * case-insensitive substring search over the rendered content's text and paint every match as a
 * `<mark part="search-match">` (the active one also carrying `search-match-active`) -- a separate,
 * always-real-DOM-element mechanism from the tone-based highlight painting above, since search needs
 * many simultaneously-visible matches rather than one set of themed spans.
 *
 * @customElement lr-docx-viewer
 * @event lr-render-error - Fired when loading, conversion, sanitization, or a non-fatal Mammoth message occurs.
 * @event lr-search-change - Fired whenever the search query, match count, or active match index
 *   changes, from `search()`/`searchNext()`/`searchPrevious()`/`clearSearch()`. `detail: { query,
 *   matchCount, activeIndex }`.
 * @event lr-highlight-activate - A painted `text-quote` highlight was clicked. `detail: { id }`.
 * @event lr-text-select - Fired on selection end inside the rendered content. `detail: { text,
 *   anchor, rects }`; `anchor` is a `text-quote` `LyraAnchor` scoped to the rendered content, or
 *   `null` if the selection couldn't be anchored.
 * @event lr-anchor-result - Fired after an `anchor` property assignment or a `scrollToAnchor()`
 *   call is applied. `detail: { found }`.
 * @csspart base - The root container.
 * @csspart body - The scrollable document body.
 * @csspart content - The semantic document content.
 * @csspart error - The error message region.
 * @csspart spinner - The loading status region.
 * @csspart highlight - A painted `text-quote` highlight (`<mark>`, `<mark>`-wrap fallback path only).
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
 */
export class LyraDocxViewer extends DocumentAnchorTarget(LyraDocxViewerBase) {
  static override styles = [LyraElement.styles, styles, srOnly];

  /** URL to fetch and convert as a DOCX document. */
  @property() src = '';

  /** Accessible name for the rendered document. */
  @property() name = '';

  /** CSS length that caps the scrollable document body. */
  @property({ attribute: 'max-height' }) maxHeight = '';

  /** Anchor kinds this viewer resolves via `scrollToAnchor()`. Readonly. */
  override readonly anchorKinds = ['fragment', 'text-quote'] as const;

  @state() private fetchState: FetchState = { kind: 'idle' };
  @state() private searchMatches: DocxSearchMatch[] = [];
  @state() private searchActiveIndex = -1;

  private generation = 0;
  private lastLoadSrc = '';
  private loadLibrary: () => Promise<DocxDeps> = loadDocxDeps;

  /** Document-ordered heading outline, cached on every successful load (see `getHeadingTree()`). */
  private headingTree: DocxHeadingItem[] = [];

  /** Lazily acquired the first time a highlight needs painting; released on disconnect. */
  private highlightHandle?: HighlightHandle;

  /** The most recently resolved `text-quote` highlight ranges, kept for `onContentClick()`'s
   *  coordinate hit-test -- the CSS Custom Highlight API paints ranges without creating any DOM
   *  element to attach a click listener to, so activation is resolved by comparing the click point
   *  against each range's own `getClientRects()` instead, uniformly across both paint paths. */
  private resolvedHighlightRanges: { id: string; range: Range }[] = [];

  private searchQuery = '';
  private paintedSearchMarks: HTMLElement[] = [];

  override connectedCallback(): void {
    super.connectedCallback();
    if (this.hasUpdated && this.src.trim() && this.src === this.lastLoadSrc) {
      this.scheduleAfterUpdate(() => { void this.load(); });
    }
  }

  override disconnectedCallback(): void {
    this.generation++;
    super.disconnectedCallback(); // reaches DocumentAnchorTarget's own cleanup (anchor retry, selection binding)
    this.highlightHandle?.release();
    this.highlightHandle = undefined;
  }

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed); // reaches DocumentAnchorTarget's own willUpdate (declarative `anchor`)
    if (changed.has('src')) {
      // Search match offsets are only meaningful for the document they were found in -- reset
      // silently (no lr-search-change) rather than emit, mirroring <lr-pdf-viewer>'s identical
      // src-change behavior. Folded into this same update cycle (not updated()) so re-assigning
      // these @state() fields doesn't schedule a follow-up one.
      this.searchQuery = '';
      this.searchMatches = [];
      this.searchActiveIndex = -1;
      this.clearSearchPaint();
    }
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    if (changed.has('src')) this.scheduleAfterUpdate(() => { void this.load(); });
    if (changed.has('fetchState')) {
      // The content wrapper is a brand-new element every time fetchState transitions to 'loaded'
      // (a different render() branch than idle/loading/error), unlike a stable always-rendered
      // wrapper -- rebinding here (idempotent: bindTextSelection() cleans up its own previous
      // listeners first) keeps selection tracking attached to whichever element is live.
      const root = this.contentRoot();
      if (root) (this as unknown as { bindTextSelection(root: Element): void }).bindTextSelection(root);
    }
    if (changed.has('fetchState') || changed.has('highlights') || changed.has('activeHighlightId')) {
      this.repaintHighlights();
    }
  }

  private contentRoot(): Element | null {
    return this.renderRoot.querySelector('[part="content"]');
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

    const url = safeFetchUrl(this.src);
    if (!url) {
      this.failWithLocalizedMessage(this.localize('documentPreviewUrlNotAllowed'));
      return;
    }

    this.fetchState = { kind: 'loading' };
    try {
      const response = await fetch(url, signal ? { signal } : undefined);
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
      this.fetchState = { kind: 'loaded', markup: this.stampHeadings(DOMPurify.sanitize(converted.value)) };
      if (converted.messages.length > 0) this.emit('lr-render-error', { error: converted.messages });
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
   *  document never carries duplicate-slug state from a previous one. */
  private stampHeadings(sanitizedHtml: string): string {
    const doc = new DOMParser().parseFromString(sanitizedHtml, 'text/html');
    const slugger = new Slugger();
    const tree: DocxHeadingItem[] = [];
    doc.body.querySelectorAll('h1, h2, h3, h4, h5, h6').forEach((heading) => {
      const level = Number(heading.tagName.slice(1));
      const label = (heading.textContent ?? '').trim();
      const slug = slugger.slug(label);
      if (slug) heading.id = slug;
      tree.push({ id: slug, label, level });
    });
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
    const known = this.headingTree.some((h) => h.id === anchor.id);
    if (!known) return false;
    const el = root.querySelector(`#${CSS.escape(anchor.id)}`) ?? this.findHeadingByComputedId(root, anchor.id);
    if (!el) return false;
    el.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
    return true;
  }

  /** DOMPurify's DOM-clobbering protection (`SANITIZE_DOM`, on by default) strips an `id` whose
   *  *value* collides with a real `document` property name (e.g. a heading titled "Title" slugs to
   *  `id="title"`, colliding with `document.title`) -- re-derives the same slug order
   *  `getHeadingTree()` was built in and matches by position instead of by attribute, so such a
   *  heading is still reachable even without a DOM `id` present. */
  private findHeadingByComputedId(root: Element, id: string): Element | null {
    const index = this.headingTree.findIndex((h) => h.id === id);
    if (index < 0) return null;
    const headings = root.querySelectorAll('h1, h2, h3, h4, h5, h6');
    return headings[index] ?? null;
  }

  private applyTextQuoteAnchor(root: Element, anchor: Extract<LyraAnchor, { kind: 'text-quote' }>): boolean {
    const range = resolveTextQuote(scopeFromElement(root), anchor);
    if (!range) return false;
    const target = range.startContainer.nodeType === Node.ELEMENT_NODE ? (range.startContainer as Element) : range.startContainer.parentElement;
    (target ?? root).scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'center' });
    return true;
  }

  /** Overrides `DocumentAnchorTarget`'s default (whole render-root) selection scope -- only
   *  `[part="content"]` is a meaningful text-quote scope for this component. */
  protected computeSelectionAnchor(range: Range): LyraAnchor | null {
    const root = this.contentRoot();
    if (!root) return null;
    return buildQuoteAnchor(range, scopeFromElement(root));
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
      for (const tone of HIGHLIGHT_TONES) handle.setRanges(tone, []);
      handle.setActive(null);
      return;
    }
    const scope = scopeFromElement(root);
    const rangesByTone = new Map<LyraHighlightTone, Range[]>(HIGHLIGHT_TONES.map((tone) => [tone, []]));
    let activeRange: Range | null = null;
    for (const highlight of this.highlights) {
      if (highlight.anchor.kind !== 'text-quote') continue;
      const range = resolveTextQuote(scope, highlight.anchor);
      if (!range) continue;
      rangesByTone.get(highlight.tone ?? 'accent')!.push(range);
      this.resolvedHighlightRanges.push({ id: highlight.id, range });
      if (highlight.id === this.activeHighlightId) activeRange = range;
    }
    for (const [tone, ranges] of rangesByTone) handle.setRanges(tone, ranges);
    handle.setActive(activeRange);
    if (!supportsCustomHighlights()) {
      // The `<mark>`-wrap fallback creates real elements but carries no `part` of its own (the
      // module is shared by every adopting viewer, so it can't know this component's part naming)
      // -- stamped here so a consumer can still target `::part(highlight)` in browsers lacking the
      // CSS Custom Highlight API.
      for (const mark of root.querySelectorAll('mark[data-lr-highlight-tone]')) {
        if (!mark.hasAttribute('part')) mark.setAttribute('part', 'highlight');
      }
    }
  }

  /** Hit-tests a click point against every currently-resolved highlight's `getClientRects()`,
   *  topmost (last-resolved) first -- the CSS Custom Highlight API paints ranges without creating
   *  any DOM element to attach a click listener to, so this works identically on both paint paths. */
  private hitTestHighlightAt(x: number, y: number): string | null {
    for (let i = this.resolvedHighlightRanges.length - 1; i >= 0; i--) {
      const { id, range } = this.resolvedHighlightRanges[i]!; // safe: i in [0, length)
      for (const rect of range.getClientRects()) {
        if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) return id;
      }
    }
    return null;
  }

  // A single delegated listener on the content wrapper (not one per node) -- the rendered markup
  // is fully replaced on every content change, so a per-node listener would need re-attaching on
  // every render anyway.
  private onContentClick = (e: MouseEvent): void => {
    const highlightId = this.hitTestHighlightAt(e.clientX, e.clientY);
    if (highlightId) this.emit<HighlightActivateDetail>('lr-highlight-activate', { id: highlightId });
  };

  // -- search ----------------------------------------------------------------------------------------

  /** Case-insensitive substring search over the rendered content's text (via `buildTextIndex()`).
   *  An empty/whitespace-only query, or no loaded content, behaves like `clearSearch()` and resolves
   *  `0`. Every match is painted immediately (see `paintSearchMatches()`), with the first one scrolled
   *  into view. */
  async search(query: string): Promise<number> {
    // `lang` is a platform property rather than a Lit property, so it can change between user
    // searches without scheduling a render pass to invalidate LyraElement's per-update locale
    // memo. A search is itself a fresh locale-sensitive operation.
    invalidateLyraLocaleCache(this);
    this.searchQuery = query;
    const root = this.contentRoot();
    const trimmed = query.trim();
    if (!root || !trimmed) {
      this.searchMatches = [];
      this.searchActiveIndex = -1;
      this.clearSearchPaint();
      this.emitSearchChange();
      return 0;
    }
    const { text } = buildTextIndex(root);
    const haystack = text.toLocaleLowerCase(this.effectiveLocale);
    const needle = trimmed.toLocaleLowerCase(this.effectiveLocale);
    const matches: DocxSearchMatch[] = [];
    let from = 0;
    let idx: number;
    while ((idx = haystack.indexOf(needle, from)) !== -1) {
      matches.push({ start: idx, end: idx + needle.length });
      if (matches.length >= MAX_DOCX_SEARCH_MATCHES) break;
      from = idx + Math.max(1, needle.length);
    }
    this.searchMatches = matches;
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

  private scrollToActiveSearchMatch(): void {
    const active = this.renderRoot.querySelector('mark[part~="search-match-active"]') as HTMLElement | null;
    active?.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'center' });
  }

  private clearSearchPaint(): void {
    for (const mark of this.paintedSearchMarks) unwrapSearchMark(mark);
    this.paintedSearchMarks = [];
  }

  /** Unwraps any previously-painted marks, then re-derives fresh `Range`s from every stored
   *  `{ start, end }` match against the *current* DOM (`buildTextIndex()`) and wraps each in a
   *  `<mark part="search-match">`. Matches are wrapped in descending offset order deliberately: two
   *  matches sharing one text node would otherwise have the earlier match's stored offset
   *  invalidated by the later match's own `splitText()` calls -- processing highest-offset first
   *  only ever truncates the *end* of a shared node, which never shifts an earlier, not-yet-processed
   *  offset. */
  private paintSearchMatches(): void {
    this.clearSearchPaint();
    const root = this.contentRoot();
    if (!root || this.searchMatches.length === 0) return;
    const { entries } = buildTextIndex(root);
    const marks: HTMLElement[] = [];
    for (let i = this.searchMatches.length - 1; i >= 0; i--) {
      const match = this.searchMatches[i]!; // safe: i in [0, length)
      const startPoint = pointAtOffset(entries, match.start);
      const endPoint = pointAtOffset(entries, match.end);
      if (!startPoint || !endPoint) continue;
      const range = document.createRange();
      range.setStart(startPoint.node, startPoint.offset);
      range.setEnd(endPoint.node, endPoint.offset);
      const part = i === this.searchActiveIndex ? 'search-match search-match-active' : 'search-match';
      marks.push(...wrapRangeInSearchMarks(range, part));
    }
    this.paintedSearchMarks = marks;
  }

  private renderBody(): TemplateResult {
    switch (this.fetchState.kind) {
      case 'loaded':
        return html`
          <div
            part="content"
            role="document"
            aria-label=${this.getAttribute('aria-label') || this.name || this.localize('docxViewerLabel')}
            @click=${this.onContentClick}
          >
            ${unsafeHTML(this.fetchState.markup)}
          </div>
        `;
      case 'loading':
        return html`<div part="spinner" role="status"><span class="sr-only">${this.localize('loadingDocument')}</span></div>`;
      case 'error':
        return html`<div part="error" role="alert">${this.fetchState.message}</div>`;
      case 'idle':
      default:
        return html`<p class="empty-note">${this.localize('documentPreviewEmpty', undefined, { type: this.localize('documentPreviewTypeDocument') })}</p>`;
    }
  }

  override render(): TemplateResult {
    return html`
      <div
        part="base"
        style=${this.maxHeight ? `--lr-docx-viewer-max-height:${this.maxHeight}` : nothing}
      >
        <div part="body">${this.renderBody()}</div>
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
