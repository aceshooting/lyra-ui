import { type PropertyValues } from 'lit';
import { state } from 'lit/decorators.js';
import { LyraElement } from './lyra-element.js';
import {
  DocumentAnchorTarget,
  prioritizedHighlightCandidates,
  type LyraAnchorTarget,
  type LyraAnchorTargetEventMap,
} from './anchor-target.js';
import {
  createTextQuoteIndex,
  emptyTextQuoteMatches,
  rangeFromTextQuoteMatch,
  scopeFromElement,
  TEXT_QUOTE_LIMITS,
  type TextQuoteIndex,
  type TextQuoteMatch,
  type TextQuoteMatches,
  type TextQuoteScope,
} from './text-quote.js';
import {
  acquireHighlightHandle,
  supportsCustomHighlights,
  type HighlightHandle,
} from './text-highlights.js';
import type {
  LyraAnchor,
  LyraAnchorKind,
  LyraHighlightTone,
  LyraHighlight,
} from '../components/viewers/document-viewer/anchors.js';

type PublicConstructor<T> = new (...args: never[]) => T;
type InternalMixinConstructor<T> = new (...args: any[]) => T;
type MixedConstructor<Base extends PublicConstructor<object>, Added> = Base & (
  new (...args: ConstructorParameters<Base>) => InstanceType<Base> & Added
);

export interface LyraSearchChangeDetail {
  query: string;
  /** Retained matches. A false `matchCountExact` makes this a lower bound. */
  matchCount: number;
  /** False when a corpus, query, match, or work ceiling prevented an exact count. */
  matchCountExact: boolean;
  activeIndex: number;
}

export interface LyraTextViewerTargetEventMap
  extends Omit<LyraAnchorTargetEventMap, 'lr-highlight-activate'> {
  'lr-search-change': CustomEvent<LyraSearchChangeDetail>;
}

export interface LyraTextViewerTarget extends LyraAnchorTarget {
  /** Resolves the retained match count. Inspect `lr-search-change.matchCountExact` to distinguish
   * an exact total from a lower bound when a resource ceiling is reached. */
  search(query: string): Promise<number>;
  searchNext(): Promise<boolean>;
  searchPrevious(): Promise<boolean>;
  clearSearch(): void;
}

/**
 * Shared anchor/search behavior for viewers whose loaded output is ordinary DOM text. The mixin
 * deliberately leaves rendering to each viewer, while resolving `text-quote`/`fragment` anchors,
 * emitting selection/search events, and painting both host highlights and search matches through
 * the same Custom Highlight/`<mark>` fallback used by the richer document viewers.
 */
/** How many search matches are materialized into live Ranges at once. A live Range is revalidated
 *  by the engine on every DOM mutation in its document, so retaining one per match turned a
 *  one-letter query over a large document into a multi-thousand-fold mutation slowdown. The window
 *  bounds painting independently of the quote engine's 10,000 retained-match ceiling;
 *  `matchCountExact=false` makes a capped `matchCount` an explicit lower bound. */
const SEARCH_PAINT_WINDOW = 200;
/** Host-supplied text quotes painted at once. The active quote is always retained inside the cap. */
const HIGHLIGHT_PAINT_LIMIT = 100;

function boundedFragmentTarget(root: Element, id: string): Element | null {
  if (root.id === id) return root;
  const walker = root.ownerDocument.createTreeWalker(root, 0x1 /* NodeFilter.SHOW_ELEMENT */);
  let inspected = 0;
  while (inspected < TEXT_QUOTE_LIMITS.maxTraversalNodes && walker.nextNode()) {
    inspected++;
    const candidate = walker.currentNode as Element;
    if (candidate.id === id) return candidate;
  }
  return null;
}
/** @internal Source-only overload preserving subclass statics and protected members. */
export function TextViewerTarget<
  T extends InternalMixinConstructor<LyraElement<LyraTextViewerTargetEventMap>>,
>(
  Base: T,
): T & InternalMixinConstructor<LyraTextViewerTarget & { renderAnchorLiveRegion(): unknown }>;
/** Public, declaration-safe mixin signature. */
export function TextViewerTarget<
  T extends PublicConstructor<LyraElement<LyraTextViewerTargetEventMap>>,
>(
  Base: T,
): MixedConstructor<T, LyraTextViewerTarget & { renderAnchorLiveRegion(): unknown }>;
export function TextViewerTarget(
  Base: InternalMixinConstructor<LyraElement<LyraTextViewerTargetEventMap>>,
): InternalMixinConstructor<LyraElement<LyraTextViewerTargetEventMap> & LyraTextViewerTarget & {
  renderAnchorLiveRegion(): unknown;
}> {
  class TextViewerTargetElement extends DocumentAnchorTarget(Base) implements LyraTextViewerTarget {
    override readonly anchorKinds: readonly LyraAnchorKind[] = ['text-quote', 'fragment'];

    @state() private searchQuery = '';
    /** Matches as packed inert offsets, never as retained live `Range`s. Search ceilings can make
     *  this a truthful lower-bound collection; only `SEARCH_PAINT_WINDOW` are live at once. */
    @state() private searchMatches: TextQuoteMatches = emptyTextQuoteMatches();
    private searchMatchCountExact = true;
    private paintedRangeCount = 0;
    private highlightedRangeCount = 0;
    @state() private searchActiveIndex = -1;

    private selectionRoot: Element | null = null;
    private textScope?: TextQuoteScope;
    private textIndex?: TextQuoteIndex;
    private textIndexLocale = '';
    private textScopeBuilds = 0;
    private observedContentGeneration = 0;
    private observedNodeMappingGeneration = 0;
    private lastSearchGeneration = -1;
    private lastSearchLocale = '';
    private contentObserver?: MutationObserver;
    private contentObserverDocument?: Document;
    private searchRecomputePending = false;
    private searchHandle?: HighlightHandle;
    private lastPaintRoot: Element | null = null;
    private lastPaintMappingGeneration = -1;
    private lastPaintHighlights?: readonly LyraHighlight[];
    private lastPaintActiveHighlightId: string | null = null;
    private lastPaintSearchMatches?: TextQuoteMatches;
    private lastPaintSearchActiveIndex = -2;
    private lastPaintHandle?: HighlightHandle;
    private readonly disconnectWaiters = new Set<() => void>();

    /** Viewer-specific hook for the rendered document region. */
    protected textContentRoot(): Element | null {
      return this.renderRoot.querySelector('[part="body"]');
    }

    override connectedCallback(): void {
      super.connectedCallback();
      // Lit does not schedule a new update merely because an already-rendered element reconnects.
      // The disconnect path deliberately releases the selection listener and highlight handle, so
      // a reconnect needs one update to bind and paint them again even when no public property
      // changed while detached.
      if (this.hasUpdated) this.requestUpdate();
    }

    protected override updated(changed: PropertyValues): void {
      super.updated(changed);
      // Reactive state written during a subclass's disconnect teardown can still complete an
      // already-scheduled Lit update while the host is detached. Never re-bind the global
      // selection listener or recreate highlight handles from that detached update; reconnect
      // requests a fresh update above and restores both resources then.
      if (!this.isConnected) return;
      const root = this.textContentRoot();
      if (root !== this.selectionRoot || root?.ownerDocument !== this.contentObserverDocument) {
        (this as unknown as { unbindTextSelection(): void }).unbindTextSelection();
        this.contentObserver?.disconnect();
        this.contentObserver = undefined;
        this.contentObserverDocument = undefined;
        this.selectionRoot = root;
        this.invalidateTextContent();
        if (root) {
          (this as unknown as { bindTextSelection(contentRoot: Element): void }).bindTextSelection(root);
          this.observeTextContent(root);
        }
      } else if (root && (this.contentObserver?.takeRecords().length ?? 0) > 0) {
        const semanticChange = this.refreshTextScopeAfterMutation(root);
        if (semanticChange && this.searchQuery) this.scheduleSearchRecompute();
      }
      const localeChanged = this.effectiveLocale !== this.lastSearchLocale;
      if (this.textIndex && this.textIndexLocale !== this.effectiveLocale) this.invalidateTextIndex();
      if (
        this.searchQuery &&
        !changed.has('searchQuery') &&
        (this.observedContentGeneration !== this.lastSearchGeneration || localeChanged)
      ) {
        // updateSearchRanges() assigns reactive searchMatches. Defer that assignment until this
        // update has completed; doing it directly from updated() schedules a second Lit update
        // from inside the first one and emits Lit's change-in-update warning. This queue is
        // deliberately separate from LyraElement's coalesced viewer-load queue: a locale and
        // `src` change in one render must run both the search refresh and the viewer's load.
        this.scheduleSearchRecompute();
      }
      this.paintRanges();
    }

    override disconnectedCallback(): void {
      for (const resolve of this.disconnectWaiters) resolve();
      this.disconnectWaiters.clear();
      this.searchHandle?.release();
      this.searchHandle = undefined;
      this.contentObserver?.disconnect();
      this.contentObserver = undefined;
      this.contentObserverDocument = undefined;
      this.selectionRoot = null;
      this.invalidateTextContent();
      super.disconnectedCallback();
    }

    private observeTextContent(root: Element): void {
      const Observer = root.ownerDocument.defaultView?.MutationObserver;
      if (!Observer) return;
      this.contentObserverDocument = root.ownerDocument;
      this.contentObserver = new Observer((records) => {
        if (records.length === 0 || root !== this.selectionRoot) return;
        const semanticChange = this.refreshTextScopeAfterMutation(root);
        if (semanticChange && this.searchQuery) this.scheduleSearchRecompute();
        this.requestUpdate();
      });
      this.contentObserver.observe(root, { childList: true, characterData: true, subtree: true });
    }

    private invalidateTextIndex(): void {
      this.textIndex = undefined;
      this.textIndexLocale = '';
    }

    private invalidateTextContent(): void {
      this.textScope = undefined;
      this.invalidateTextIndex();
      this.observedContentGeneration++;
      this.observedNodeMappingGeneration++;
    }

    /** Refreshes node-bearing scope data after a DOM mutation. Structurally different markup with
     * the same normalized text (including the `<mark>` fallback's wrapping/unwrapping) preserves
     * search offsets and does not pretend the searchable content changed. */
    private refreshTextScopeAfterMutation(root: Element): boolean {
      const previous = this.textScope;
      if (!previous) {
        this.invalidateTextContent();
        return true;
      }
      const next = scopeFromElement(root);
      this.textScopeBuilds++;
      this.textScope = next;
      const semanticChange = previous.text !== next.text || previous.truncated !== next.truncated;
      this.observedNodeMappingGeneration++;
      if (semanticChange) {
        this.invalidateTextIndex();
        this.observedContentGeneration++;
      } else if (this.textIndex && !this.textIndex.rebindScope(next)) {
        this.invalidateTextIndex();
      }
      return semanticChange;
    }

    /** Drains records synchronously so an imperative navigation call made in the same task as an
     * external DOM edit can never emit the previous generation's match count. */
    private drainTextMutations(): boolean {
      const root = this.selectionRoot;
      if (!root || (this.contentObserver?.takeRecords().length ?? 0) === 0) return false;
      return this.refreshTextScopeAfterMutation(root);
    }

    private cachedTextScope(root: Element): TextQuoteScope {
      if (this.selectionRoot === root) {
        const semanticChange = this.drainTextMutations();
        if (semanticChange && this.searchQuery) this.scheduleSearchRecompute();
      }
      if (!this.textScope) {
        this.textScope = scopeFromElement(root);
        this.textScopeBuilds++;
      }
      return this.textScope;
    }

    private cachedTextIndex(root: Element): TextQuoteIndex {
      const scope = this.cachedTextScope(root);
      if (!this.textIndex || this.textIndex.scope !== scope || this.textIndexLocale !== this.effectiveLocale) {
        this.textIndex = createTextQuoteIndex(scope, this.effectiveLocale);
        this.textIndexLocale = this.effectiveLocale;
      }
      return this.textIndex;
    }

    /** The fallback highlighter wraps text in `<mark>` and therefore replaces text nodes without
     * changing their semantic content. Rebind the cached index to the replacement nodes while
     * preserving its folded corpus and occurrence cache. */
    private discardFallbackNodeCache(): void {
      if (supportsCustomHighlights(this.ownerDocument)) return;
      this.contentObserver?.takeRecords();
      const root = this.selectionRoot;
      if (!root) {
        this.textScope = undefined;
        this.invalidateTextIndex();
        return;
      }
      const previous = this.textScope;
      const next = scopeFromElement(root);
      this.textScope = next;
      this.textScopeBuilds++;
      this.observedNodeMappingGeneration++;
      if (!previous || previous.text !== next.text || previous.truncated !== next.truncated) {
        this.invalidateTextIndex();
        this.observedContentGeneration++;
      } else if (this.textIndex && !this.textIndex.rebindScope(next)) {
        this.invalidateTextIndex();
      }
    }

    protected async applyAnchor(anchor: LyraAnchor): Promise<boolean> {
      const root = this.textContentRoot();
      if (!root) return false;
      if (anchor.kind === 'fragment') {
        const target = boundedFragmentTarget(root, anchor.id);
        if (!target) return false;
        target.scrollIntoView?.({ block: 'nearest', behavior: 'auto' });
        return true;
      }
      if (anchor.kind !== 'text-quote') return false;
      const index = this.cachedTextIndex(root);
      const match = index.resolve(anchor, index.createWorkBudget());
      const range = match ? rangeFromTextQuoteMatch(index.scope, match) : null;
      if (!range) return false;
      const target = range.commonAncestorContainer.nodeType === Node.ELEMENT_NODE
        ? range.commonAncestorContainer as Element
        : range.commonAncestorContainer.parentElement;
      target?.scrollIntoView?.({ block: 'nearest', behavior: 'auto' });
      this.searchHandle?.flash(range);
      this.discardFallbackNodeCache();
      return true;
    }

    /** Resolves the retained match count. The emitted `matchCountExact` is false when that return
     * value is only a lower bound because a corpus, query, match, or work ceiling was reached. */
    async search(query: string): Promise<number> {
      this.searchQuery = query;
      this.searchActiveIndex = -1;
      this.searchMatches = emptyTextQuoteMatches();
      this.searchMatchCountExact = true;
      this.lastSearchGeneration = -1;
      this.lastSearchLocale = '';
      if (!(await this.waitForUpdateOrDisconnect())) return 0;
      this.updateSearchRanges();
      this.searchActiveIndex = this.searchMatches.length > 0 ? 0 : -1;
      this.paintRanges();
      this.emit('lr-search-change', {
        query: this.searchQuery,
        matchCount: this.searchMatches.length,
        matchCountExact: this.searchMatchCountExact,
        activeIndex: this.searchActiveIndex,
      });
      await this.scrollSearchMatch();
      return this.searchMatches.length;
    }

    async searchNext(): Promise<boolean> {
      const recomputed = this.recomputeSearchSynchronouslyIfStale();
      if (!this.searchMatches.length) {
        if (recomputed) this.emitSearchChange();
        return false;
      }
      this.searchActiveIndex = (this.searchActiveIndex + 1) % this.searchMatches.length;
      this.paintRanges();
      this.emitSearchChange();
      await this.scrollSearchMatch();
      return true;
    }

    async searchPrevious(): Promise<boolean> {
      const recomputed = this.recomputeSearchSynchronouslyIfStale();
      if (!this.searchMatches.length) {
        if (recomputed) this.emitSearchChange();
        return false;
      }
      this.searchActiveIndex = (this.searchActiveIndex - 1 + this.searchMatches.length) % this.searchMatches.length;
      this.paintRanges();
      this.emitSearchChange();
      await this.scrollSearchMatch();
      return true;
    }

    clearSearch(): void {
      this.searchQuery = '';
      this.lastSearchGeneration = this.observedContentGeneration;
      this.lastSearchLocale = '';
      this.searchMatches = emptyTextQuoteMatches();
      this.searchMatchCountExact = true;
      this.searchActiveIndex = -1;
      this.paintRanges();
      this.emit('lr-search-change', { query: '', matchCount: 0, matchCountExact: true, activeIndex: -1 });
    }

    private updateSearchRanges(): void {
      const root = this.textContentRoot();
      const index = root ? this.cachedTextIndex(root) : null;
      this.lastSearchGeneration = this.observedContentGeneration;
      this.lastSearchLocale = this.effectiveLocale;
      this.searchMatches = index
        ? index.search(this.searchQuery, index.createWorkBudget())
        : emptyTextQuoteMatches();
      this.searchMatchCountExact = this.searchMatches.matchCountExact;
    }

    private recomputeSearchSynchronouslyIfStale(): boolean {
      this.drainTextMutations();
      if (
        !this.searchQuery ||
        (this.lastSearchGeneration === this.observedContentGeneration &&
          this.lastSearchLocale === this.effectiveLocale)
      ) {
        return false;
      }
      const previousIndex = this.searchActiveIndex;
      this.updateSearchRanges();
      this.searchActiveIndex = this.searchMatches.length > 0
        ? Math.min(Math.max(previousIndex, 0), this.searchMatches.length - 1)
        : -1;
      this.paintRanges();
      return true;
    }

    private scheduleSearchRecompute(): void {
      if (this.searchRecomputePending) return;
      this.searchRecomputePending = true;
      queueMicrotask(() => {
        this.searchRecomputePending = false;
        if (!this.isConnected || !this.searchQuery) return;
        if (
          this.lastSearchGeneration === this.observedContentGeneration &&
          this.lastSearchLocale === this.effectiveLocale
        ) return;
        const previousIndex = this.searchActiveIndex;
        this.updateSearchRanges();
        this.searchActiveIndex = this.searchMatches.length > 0
          ? Math.min(Math.max(previousIndex, 0), this.searchMatches.length - 1)
          : -1;
        this.paintRanges();
        this.emitSearchChange();
      });
    }

    private emitSearchChange(): void {
      this.emit('lr-search-change', {
        query: this.searchQuery,
        matchCount: this.searchMatches.length,
        matchCountExact: this.searchMatchCountExact,
        activeIndex: this.searchActiveIndex,
      });
    }

    private async scrollSearchMatch(): Promise<void> {
      const range = this.activeSearchRange();
      if (!range) return;
      const target = range.commonAncestorContainer.nodeType === Node.ELEMENT_NODE
        ? range.commonAncestorContainer as Element
        : range.commonAncestorContainer.parentElement;
      target?.scrollIntoView?.({ block: 'nearest', behavior: 'auto' });
    }

    private async waitForUpdateOrDisconnect(): Promise<boolean> {
      while (this.isConnected) {
        let resolveDisconnect!: () => void;
        const disconnected = new Promise<false>((resolve) => {
          resolveDisconnect = () => resolve(false);
        });
        this.disconnectWaiters.add(resolveDisconnect);
        try {
          const completed = await Promise.race([
            this.updateComplete.then(() => true as const),
            disconnected,
          ]);
          if (completed) return true;
        } finally {
          this.disconnectWaiters.delete(resolveDisconnect);
        }
        // A DOM move can synchronously disconnect and reconnect the same instance before the
        // disconnect promise's continuation runs. In that case, wait for the reconnect update
        // instead of abandoning the non-empty query with stale ranges.
      }
      return false;
    }

    /** The slice of `searchMatches` painted right now: the active match plus the neighbours on
     *  either side, clamped to the array. Wrapping past either end re-centres the window. */
    private searchPaintWindow(): Array<{ index: number; match: TextQuoteMatch }> {
      const centre = this.searchActiveIndex < 0 ? 0 : this.searchActiveIndex;
      const half = SEARCH_PAINT_WINDOW >> 1;
      const count = Math.min(this.searchMatches.length, SEARCH_PAINT_WINDOW);
      const start = Math.max(0, Math.min(centre - half, this.searchMatches.length - count));
      const matches: Array<{ index: number; match: TextQuoteMatch }> = [];
      for (let index = start; index < start + count; index++) {
        const match = this.searchMatches.at(index);
        if (match) matches.push({ index, match });
      }
      return matches;
    }

    /** Materializes just the active match. Separate from the painted window because the active
     *  Range is also what `scrollSearchMatch()` scrolls to. */
    private activeSearchRange(): Range | null {
      if (this.lastSearchGeneration !== this.observedContentGeneration) return null;
      const match = this.searchMatches.at(this.searchActiveIndex);
      if (!match) return null;
      const root = this.textContentRoot();
      if (!root) return null;
      const scope = this.cachedTextScope(root);
      return this.lastSearchGeneration === this.observedContentGeneration
        ? rangeFromTextQuoteMatch(scope, match)
        : null;
    }

    /** How many live Ranges the last paint actually retained. `protected`, not public API: it
     *  exists so the shared search contract test can assert the window stays bounded, which is
     *  otherwise only observable through engine-internal Highlight registry state. */
    protected searchPaintedRangeCount(): number {
      return this.paintedRangeCount;
    }

    /** @internal Test seam proving one scope is retained for a stable content generation. */
    protected textScopeBuildCount(): number {
      return this.textScopeBuilds;
    }

    /** @internal Test seam for the bounded/reused occurrence-index work contract. */
    protected textQuoteScanCount(): number {
      return this.textIndex?.scanCount ?? 0;
    }

    /** @internal Test seam for the host-highlight cardinality ceiling. */
    protected highlightPaintedRangeCount(): number {
      return this.highlightedRangeCount;
    }

    private paintRanges(): void {
      if (!this.isConnected) {
        this.searchHandle?.release();
        this.searchHandle = undefined;
        return;
      }
      const root = this.textContentRoot();
      if (!root) {
        this.searchHandle?.release();
        this.searchHandle = undefined;
        return;
      }
      this.searchHandle ??= acquireHighlightHandle(this, this.ownerDocument);
      if (
        this.lastPaintRoot === root &&
        this.lastPaintMappingGeneration === this.observedNodeMappingGeneration &&
        this.lastPaintHighlights === this.highlights &&
        this.lastPaintActiveHighlightId === this.activeHighlightId &&
        this.lastPaintSearchMatches === this.searchMatches &&
        this.lastPaintSearchActiveIndex === this.searchActiveIndex &&
        this.lastPaintHandle === this.searchHandle
      ) return;
      const rangesByTone = new Map<LyraHighlightTone, Range[]>();
      const add = (tone: LyraHighlightTone, range: Range | null): void => {
        if (!range) return;
        const ranges = rangesByTone.get(tone) ?? [];
        ranges.push(range);
        rangesByTone.set(tone, ranges);
      };
      type TextHighlight = Omit<LyraHighlight, 'anchor'> & {
        anchor: Extract<LyraAnchor, { kind: 'text-quote' }>;
      };
      const isTextHighlight = (highlight: LyraHighlight): highlight is TextHighlight =>
        highlight.anchor.kind === 'text-quote';
      const highlightsToPaint: TextHighlight[] = [];
      let activeHighlight: TextHighlight | undefined;
      for (const highlight of prioritizedHighlightCandidates(this.highlights, this.activeHighlightId)) {
        if (!isTextHighlight(highlight)) continue;
        highlightsToPaint.push(highlight);
        if (highlight.id === this.activeHighlightId) activeHighlight = highlight;
      }

      const searchGenerationIsCurrent = this.lastSearchGeneration === this.observedContentGeneration;
      const needsScope = highlightsToPaint.length > 0 ||
        (searchGenerationIsCurrent && this.searchMatches.length > 0);
      const index = needsScope ? this.cachedTextIndex(root) : null;
      const highlightBudget = index?.createWorkBudget();
      let activeHostRange: Range | null = null;
      let highlighted = 0;
      for (const highlight of highlightsToPaint) {
        if (highlight !== activeHighlight && highlighted >= HIGHLIGHT_PAINT_LIMIT) break;
        const match = index?.resolve(highlight.anchor, highlightBudget);
        const range = match && index ? rangeFromTextQuoteMatch(index.scope, match) : null;
        add(highlight.tone ?? 'accent', range);
        if (range) highlighted++;
        if (highlight === activeHighlight) activeHostRange = range;
      }
      this.highlightedRangeCount = highlighted;
      // Materialize only a bounded window around the active match. Everything outside it is off
      // screen by construction (the viewport can't show 800 matches at once), and each Range
      // handed to the Highlight API is retained live for as long as it is painted.
      const scope = searchGenerationIsCurrent && this.searchMatches.length > 0
        ? (index?.scope ?? this.cachedTextScope(root))
        : null;
      let painted = 0;
      let activeSearchRange: Range | null = null;
      if (scope) {
        for (const { index: matchIndex, match } of this.searchPaintWindow()) {
          const range = rangeFromTextQuoteMatch(scope, match);
          if (range) {
            add('accent', range);
            painted++;
            if (matchIndex === this.searchActiveIndex) activeSearchRange = range;
          }
        }
      }
      this.paintedRangeCount = painted;
      const tones: LyraHighlightTone[] = ['accent', 'success', 'warning', 'danger', 'neutral'];
      for (const tone of tones) this.searchHandle.setRanges(tone, rangesByTone.get(tone) ?? []);
      this.searchHandle.setActive(activeHostRange ?? activeSearchRange);
      this.discardFallbackNodeCache();
      this.lastPaintRoot = root;
      this.lastPaintMappingGeneration = this.observedNodeMappingGeneration;
      this.lastPaintHighlights = this.highlights;
      this.lastPaintActiveHighlightId = this.activeHighlightId;
      this.lastPaintSearchMatches = this.searchMatches;
      this.lastPaintSearchActiveIndex = this.searchActiveIndex;
      this.lastPaintHandle = this.searchHandle;
    }
  }
  return TextViewerTargetElement as InternalMixinConstructor<
    LyraElement<LyraTextViewerTargetEventMap> & LyraTextViewerTarget & {
      renderAnchorLiveRegion(): unknown;
    }
  >;
}
