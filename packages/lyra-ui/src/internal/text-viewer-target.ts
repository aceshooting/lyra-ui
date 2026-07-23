import { type PropertyValues } from 'lit';
import { state } from 'lit/decorators.js';
import { LyraElement } from './lyra-element.js';
import { DocumentAnchorTarget, type LyraAnchorTarget, type LyraAnchorTargetEventMap } from './anchor-target.js';
import { findTextQuoteRanges, resolveTextQuote, scopeFromElement } from './text-quote.js';
import { acquireHighlightHandle, type HighlightHandle } from './text-highlights.js';
import type {
  LyraAnchor,
  LyraAnchorKind,
  LyraHighlightTone,
  LyraHighlight,
} from '../components/viewers/document-viewer/anchors.js';

type Constructor<T> = new (...args: any[]) => T;

export interface LyraTextViewerTargetEventMap extends LyraAnchorTargetEventMap {
  'lr-search-change': CustomEvent<{ query: string; matchCount: number; activeIndex: number }>;
}

export interface LyraTextViewerTarget extends LyraAnchorTarget {
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
export function TextViewerTarget<T extends Constructor<LyraElement<any>>>(
  Base: T,
): T & Constructor<LyraTextViewerTarget & { renderAnchorLiveRegion(): unknown }> {
  class TextViewerTargetElement extends DocumentAnchorTarget(Base) implements LyraTextViewerTarget {
    override readonly anchorKinds: readonly LyraAnchorKind[] = ['text-quote', 'fragment'];

    @state() private searchQuery = '';
    @state() private searchRanges: Range[] = [];
    @state() private searchActiveIndex = -1;

    private selectionRoot: Element | null = null;
    private lastSearchText = '';
    private searchHandle?: HighlightHandle;

    /** Viewer-specific hook for the rendered document region. */
    protected textContentRoot(): Element | null {
      return this.renderRoot.querySelector('[part="body"]');
    }

    protected override updated(changed: PropertyValues): void {
      super.updated(changed);
      const root = this.textContentRoot();
      if (root !== this.selectionRoot) {
        this.selectionRoot = root;
        if (root) (this as unknown as { bindTextSelection(contentRoot: Element): void }).bindTextSelection(root);
      }
      const searchText = root ? scopeFromElement(root).text : '';
      if (this.searchQuery && (searchText !== this.lastSearchText || changed.has('highlights'))) {
        // updateSearchRanges() assigns reactive searchRanges. Defer that assignment until this
        // update has completed; doing it directly from updated() schedules a second Lit update
        // from inside the first one and emits Lit's change-in-update warning.
        this.scheduleAfterUpdate(() => {
          this.updateSearchRanges();
          this.paintRanges();
        });
      }
      this.paintRanges();
    }

    override disconnectedCallback(): void {
      this.searchHandle?.release();
      this.searchHandle = undefined;
      this.selectionRoot = null;
      super.disconnectedCallback();
    }

    protected async applyAnchor(anchor: LyraAnchor): Promise<boolean> {
      const root = this.textContentRoot();
      if (!root) return false;
      if (anchor.kind === 'fragment') {
        const target = root.id === anchor.id ? root : Array.from(root.querySelectorAll<HTMLElement>('[id]')).find((el) => el.id === anchor.id);
        if (!target) return false;
        target.scrollIntoView?.({ block: 'nearest', behavior: 'auto' });
        return true;
      }
      if (anchor.kind !== 'text-quote') return false;
      const range = resolveTextQuote(scopeFromElement(root), anchor);
      if (!range) return false;
      const target = range.commonAncestorContainer.nodeType === Node.ELEMENT_NODE
        ? range.commonAncestorContainer as Element
        : range.commonAncestorContainer.parentElement;
      target?.scrollIntoView?.({ block: 'nearest', behavior: 'auto' });
      this.searchHandle?.flash(range);
      return true;
    }

    async search(query: string): Promise<number> {
      this.searchQuery = query;
      this.searchActiveIndex = -1;
      this.lastSearchText = '';
      await this.updateComplete;
      this.updateSearchRanges();
      this.searchActiveIndex = this.searchRanges.length > 0 ? 0 : -1;
      this.paintRanges();
      this.emit('lr-search-change', {
        query: this.searchQuery,
        matchCount: this.searchRanges.length,
        activeIndex: this.searchActiveIndex,
      });
      await this.scrollSearchMatch();
      return this.searchRanges.length;
    }

    async searchNext(): Promise<boolean> {
      if (!this.searchRanges.length) return false;
      this.searchActiveIndex = (this.searchActiveIndex + 1) % this.searchRanges.length;
      this.paintRanges();
      this.emitSearchChange();
      await this.scrollSearchMatch();
      return true;
    }

    async searchPrevious(): Promise<boolean> {
      if (!this.searchRanges.length) return false;
      this.searchActiveIndex = (this.searchActiveIndex - 1 + this.searchRanges.length) % this.searchRanges.length;
      this.paintRanges();
      this.emitSearchChange();
      await this.scrollSearchMatch();
      return true;
    }

    clearSearch(): void {
      this.searchQuery = '';
      this.lastSearchText = '';
      this.searchRanges = [];
      this.searchActiveIndex = -1;
      this.paintRanges();
      this.emit('lr-search-change', { query: '', matchCount: 0, activeIndex: -1 });
    }

    private updateSearchRanges(): void {
      const root = this.textContentRoot();
      const scope = root ? scopeFromElement(root) : null;
      this.lastSearchText = scope?.text ?? '';
      this.searchRanges = scope ? findTextQuoteRanges(scope, this.searchQuery) : [];
    }

    private emitSearchChange(): void {
      this.emit('lr-search-change', {
        query: this.searchQuery,
        matchCount: this.searchRanges.length,
        activeIndex: this.searchActiveIndex,
      });
    }

    private async scrollSearchMatch(): Promise<void> {
      const range = this.searchRanges[this.searchActiveIndex];
      if (!range) return;
      const target = range.commonAncestorContainer.nodeType === Node.ELEMENT_NODE
        ? range.commonAncestorContainer as Element
        : range.commonAncestorContainer.parentElement;
      target?.scrollIntoView?.({ block: 'nearest', behavior: 'auto' });
    }

    private paintRanges(): void {
      const root = this.textContentRoot();
      if (!root) {
        this.searchHandle?.release();
        return;
      }
      this.searchHandle ??= acquireHighlightHandle(this, this.ownerDocument);
      const rangesByTone = new Map<LyraHighlightTone, Range[]>();
      const add = (tone: LyraHighlightTone, range: Range | null): void => {
        if (!range) return;
        const ranges = rangesByTone.get(tone) ?? [];
        ranges.push(range);
        rangesByTone.set(tone, ranges);
      };
      for (const highlight of this.highlights) {
        if (highlight.anchor.kind === 'text-quote') add(highlight.tone ?? 'accent', resolveTextQuote(scopeFromElement(root), highlight.anchor));
      }
      for (const range of this.searchRanges) add('accent', range);
      const tones: LyraHighlightTone[] = ['accent', 'success', 'warning', 'danger', 'neutral'];
      for (const tone of tones) this.searchHandle.setRanges(tone, rangesByTone.get(tone) ?? []);
      const active = this.highlights.find((highlight: LyraHighlight) => highlight.id === this.activeHighlightId);
      this.searchHandle.setActive(active?.anchor.kind === 'text-quote' ? resolveTextQuote(scopeFromElement(root), active.anchor) : this.searchRanges[this.searchActiveIndex] ?? null);
    }
  }
  return TextViewerTargetElement;
}
