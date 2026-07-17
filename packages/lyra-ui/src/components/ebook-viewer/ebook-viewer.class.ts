import { html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import { createRef, ref, type Ref } from 'lit/directives/ref.js';
import { LyraElement } from '../../internal/lyra-element.js';
import { safeFetchUrl } from '../../internal/safe-url.js';
import { isAbortError, isResourceLimitError, readResponseArrayBuffer } from '../../internal/resource-loader.js';
import { chevronIcon } from '../../internal/icons.js';
import { srOnly } from '../../internal/a11y.js';
import { Announcer } from '../../internal/announcer.js';
import { announceSearchResult } from '../../internal/viewer-search.js';
import { DocumentAnchorTarget, type LyraAnchorTargetEventMap } from '../../internal/anchor-target.js';
import type { OptionalPeerApi } from '../../internal/optional-peer-types.js';
import type { LyraAnchor, HighlightActivateDetail, TextSelectDetail } from '../document-viewer/anchors.js';
import { getEpubJs, type EpubBook, type EpubRendition } from './ebook-loader.js';
import { styles } from './ebook-viewer.styles.js';

type EbookState = { kind: 'idle' } | { kind: 'loading' } | { kind: 'ready' } | { kind: 'error'; message: string };

/** One flattened entry of an EPUB's own navigation document (`book.navigation.toc`). `level`
 *  starts at 1 for a top-level entry and increases with nesting depth. */
export interface EbookTocItem {
  id: string;
  label: string;
  href: string;
  level: number;
}

/** One `search()` match: the CFI epub.js's own `item.find()` resolved it to, and the surrounding
 *  excerpt it reported alongside that CFI. */
interface EbookSearchMatch {
  cfi: string;
  excerpt: string;
}

export interface LyraEbookViewerEventMap extends LyraAnchorTargetEventMap {
  'lyra-render-error': CustomEvent<{ error: unknown }>;
  'lyra-location-change': CustomEvent<{ cfi: string; href: string }>;
  'lyra-search-change': CustomEvent<{ query: string; matchCount: number; activeIndex: number }>;
}

class LyraEbookViewerBase extends LyraElement<LyraEbookViewerEventMap> {}

/**
 * Renders an EPUB with the optional `epubjs` peer. The mount element is kept
 * stable because epub.js imperatively owns it and renders chapters in iframes.
 *
 * Adopts `DocumentAnchorTarget`: a `cfi` anchor displays directly via epub.js's own
 * `rendition.display()`; a `text-quote` anchor resolves by scanning the book's spine sections
 * with epub.js's own `item.find()`, since chapter content lives inside epub.js-owned iframes
 * rather than this component's own shadow DOM (a native `Range`/`Selection` inside one of those
 * iframes is invisible to this component's own document, so selection handling below is bridged
 * through epub.js's own `selected` event instead of the mixin's default DOM-selection binding).
 * `highlights` (kind `cfi`) paint via `rendition.annotations.highlight()` and are re-applied
 * whenever the rendition is recreated (a `src` change, or a reconnect remount) -- epub.js doesn't
 * persist annotations across a fresh `renderTo()`. `getToc()` reads the EPUB's own navigation
 * document into a flat, document-ordered outline once `book.ready` resolves. `location` (a CFI or
 * spine href) is recorded before the book is ready and applied once loading finishes, or applied
 * immediately once it already has; epub.js's own `relocated` event keeps it in sync with user
 * navigation without re-triggering a `display()` call for a change that originated from that same
 * event. `search()`/`searchNext()`/`searchPrevious()`/`clearSearch()` scan the spine sequentially
 * via epub.js's own `item.find()`, aborting a superseded scan when a newer search or a `src`
 * change supersedes it.
 *
 * @customElement lyra-ebook-viewer
 * @event lyra-render-error - Fired when fetching, opening, or rendering fails.
 * @event lyra-location-change - The reading location changed (from `rendition`'s own `relocated`
 *   event). `detail: { cfi, href }`.
 * @event lyra-search-change - Fired whenever the search query, match count, or active match index
 *   changes, from `search()`/`searchNext()`/`searchPrevious()`/`clearSearch()`. `detail: { query,
 *   matchCount, activeIndex }`.
 * @event lyra-highlight-activate - A painted `cfi` highlight was clicked. `detail: { id }`.
 * @event lyra-text-select - Fired on selection end inside a chapter iframe (mirrors epub.js's own
 *   `selected` event). `detail: { text, anchor, rects }`; `anchor` is a `cfi` `LyraAnchor`.
 * @event lyra-anchor-result - Fired after an `anchor` property assignment or a `scrollToAnchor()`
 *   call is applied. `detail: { found }`.
 * @csspart base - The viewer container.
 * @csspart toolbar - Previous and next chapter controls.
 * @csspart previous-button - The previous chapter button.
 * @csspart next-button - The next chapter button.
 * @csspart previous-icon - The previous button icon.
 * @csspart next-icon - The next button icon.
 * @csspart mount - The stable element epub.js renders into.
 * @csspart error - The error message region.
 * @csspart announcer - The visually-hidden `role="status"` region search results announce through.
 */
export class LyraEbookViewer extends DocumentAnchorTarget(LyraEbookViewerBase) {
  static styles = [LyraElement.styles, styles, srOnly];

  /** URL fetched as an ArrayBuffer and rendered as an EPUB. */
  @property() src = '';
  /** Display name used as the reading region's accessible-name fallback. */
  @property() name = '';
  /** Host `aria-label` override for the internal reading region. */
  @property({ attribute: 'aria-label' }) accessibleLabel = '';

  /** A CFI or spine href identifying the current reading position. Set before the book has
   *  finished loading, it's recorded and applied via `rendition.display()` once loading
   *  finishes; set after, it applies immediately. Kept in sync with epub.js's own `relocated`
   *  event (fired on any user navigation) without re-triggering a `display()` call for a change
   *  that originated from that same event. Not reflected as an attribute -- CFIs are long. */
  @property() location = '';

  /** Anchor kinds this viewer resolves: `cfi` displays directly via `rendition.display()`;
   *  `text-quote` resolves by scanning the book's spine with epub.js's own `item.find()`. */
  readonly anchorKinds = ['cfi', 'text-quote'] as const;

  @state() private ebookState: EbookState = { kind: 'idle' };
  @state() private searchMatches: EbookSearchMatch[] = [];
  @state() private searchActiveIndex = -1;

  private readonly mountRef: Ref<HTMLDivElement> = createRef();
  private book?: EpubBook;
  private rendition?: EpubRendition;
  private generation = 0;
  private searchQuery = '';
  private searchGeneration = 0;
  /** Set (for the duration of one synchronous relocated-handler call) before assigning
   *  `location` from epub.js's own `relocated` event, and consumed inside `updated()` -- Lit's
   *  update cycle is microtask-batched, so a flag reset synchronously right after the assignment
   *  would already be back to `false` by the time `updated()` observes it; consuming it there
   *  instead is what actually breaks the `relocated` <-> `display()` loop. */
  private applyingRelocated = false;
  private paintedHighlightCfis: string[] = [];
  private searchAnnotationCfi?: string;
  private readonly announcer = new Announcer({ onFlush: (text) => this.announceViaLiveRegion(text) });

  protected updated(changed: PropertyValues): void {
    super.updated(changed); // reaches DocumentAnchorTarget's own cleanup/live-region wiring
    if (changed.has('src')) this.scheduleAfterUpdate(() => { void this.load(); });
    if (changed.has('location')) {
      const fromRelocated = this.applyingRelocated;
      this.applyingRelocated = false;
      if (!fromRelocated && this.rendition && this.location) void this.rendition.display(this.location);
    }
    if ((changed.has('highlights') || changed.has('activeHighlightId')) && this.rendition) {
      this.repaintHighlights();
    }
  }

  connectedCallback(): void {
    super.connectedCallback();
    // A reconnect (e.g. a drag-and-drop reparent, a tab/panel re-hosting its
    // children, a virtualized list moving this same element instance) fires
    // disconnectedCallback then connectedCallback synchronously with no
    // update in between, so updated()'s `changed.has('src')` gate never
    // fires again to reload the book. disconnectedCallback already reset
    // `ebookState` to idle and tore epub.js down, so re-arm the load here
    // whenever there's a `src` to load and this isn't the very first connect
    // (that case is already covered by updated()'s initial-render gate).
    if (this.hasUpdated && this.src.trim()) this.scheduleAfterUpdate(() => { void this.load(); });
  }

  disconnectedCallback(): void {
    this.generation++;
    this.teardown();
    // Reset rather than leaving a stale "ready" state: without this, a
    // reconnect that isn't followed by a fresh load (src unset, or the
    // reconnect races ahead of connectedCallback's reload) would keep
    // rendering the toolbar's previous/next controls as enabled and
    // live-looking against a destroyed rendition, which silently no-ops
    // every click instead of surfacing an empty/idle state.
    this.ebookState = { kind: 'idle' };
    super.disconnectedCallback(); // reaches DocumentAnchorTarget's own cleanup (anchor retry, selection binding)
  }

  private teardown(): void {
    this.book?.destroy();
    this.book = undefined;
    this.rendition = undefined;
    // A destroyed rendition's own annotations/CFIs stop being meaningful, and a fresh renderTo()
    // starts with no painted annotations -- reset silently (no event) rather than leaving stale
    // state a following load() (or a reconnect that never reloads) could act on.
    this.searchGeneration++;
    this.searchQuery = '';
    this.searchMatches = [];
    this.searchActiveIndex = -1;
    this.searchAnnotationCfi = undefined;
    this.paintedHighlightCfis = [];
  }

  private async load(): Promise<void> {
    const generation = ++this.generation;
    const signal = this.beginAbortableLoad();
    this.teardown();
    if (!this.src.trim()) {
      this.ebookState = { kind: 'idle' };
      return;
    }
    const url = safeFetchUrl(this.src);
    if (!url) {
      this.ebookState = { kind: 'error', message: this.localize('documentPreviewUrlNotAllowed') };
      return;
    }
    this.ebookState = { kind: 'loading' };
    let data: ArrayBuffer;
    let factory: ((data: ArrayBuffer) => EpubBook) | null;
    try {
      [data, factory] = await Promise.all([
        fetch(url, signal ? { signal } : undefined).then((response) => {
          if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
          return readResponseArrayBuffer(response);
        }),
        getEpubJs(),
      ]);
    } catch (error) {
      if (isAbortError(error) || !this.isConnected || generation !== this.generation) return;
      this.ebookState = { kind: 'error', message: this.localize(isResourceLimitError(error) ? 'documentPreviewResourceTooLarge' : 'ebookViewerLoadError') };
      this.emit('lyra-render-error', { error });
      return;
    }
    if (!this.isConnected || generation !== this.generation) return;
    if (!factory) {
      this.ebookState = { kind: 'error', message: this.localize('ebookViewerLoadError') };
      return;
    }
    const mount = this.mountRef.value;
    if (!mount) {
      this.ebookState = { kind: 'error', message: this.localize('ebookViewerLoadError') };
      return;
    }
    try {
      const book = factory(data);
      const rendition = book.renderTo(mount, { width: '100%', height: '100%' }) as EpubRendition;
      await book.ready;
      await rendition.display(this.location || undefined);
      rendition.on('relocated', (loc: OptionalPeerApi) => {
        const cfi = loc?.start?.cfi ?? '';
        const href = loc?.start?.href ?? '';
        if (!cfi || cfi === this.location) return;
        this.applyingRelocated = true;
        this.location = cfi;
        this.emit('lyra-location-change', { cfi, href });
      });
      rendition.on('selected', (cfiRange: string, contents: OptionalPeerApi) => {
        const selection = contents?.window?.getSelection?.();
        const text = selection ? String(selection.toString()) : '';
        if (!text.trim()) return;
        const rects: DOMRect[] =
          selection && selection.rangeCount > 0 ? (Array.from(selection.getRangeAt(0).getClientRects()) as DOMRect[]) : [];
        this.emit<TextSelectDetail>('lyra-text-select', { text, anchor: { kind: 'cfi', cfi: cfiRange }, rects });
      });
      if (generation !== this.generation) {
        book.destroy();
        return;
      }
      this.book = book;
      this.rendition = rendition;
      this.ebookState = { kind: 'ready' };
      this.repaintHighlights();
    } catch (error) {
      if (isAbortError(error) || !this.isConnected || generation !== this.generation) return;
      this.ebookState = { kind: 'error', message: this.localize('ebookViewerLoadError') };
      this.emit('lyra-render-error', { error });
    }
  }

  private previous = (): void => { void this.rendition?.prev(); };
  private next = (): void => { void this.rendition?.next(); };

  // -- table of contents -------------------------------------------------------------------------

  /** Flattens the EPUB's own navigation document (`book.navigation.toc`, populated once
   *  `book.ready` resolves) into a document-ordered outline. `level` starts at 1 for a top-level
   *  entry and increases with nesting depth; `id` falls back to `href` when a navigation entry
   *  has none. Resolves `[]` before a book has loaded. */
  async getToc(): Promise<EbookTocItem[]> {
    if (!this.book) return [];
    await this.book.ready;
    const items: EbookTocItem[] = [];
    const walk = (list: OptionalPeerApi[] | undefined, level: number): void => {
      for (const entry of list ?? []) {
        items.push({
          id: entry.id || entry.href,
          label: String(entry.label ?? '').trim(),
          href: entry.href,
          level,
        });
        if (entry.subitems?.length) walk(entry.subitems, level + 1);
      }
    };
    walk(this.book.navigation?.toc, 1);
    return items;
  }

  // -- anchor-target: applyAnchor per kind ---------------------------------------------------------

  protected async applyAnchor(anchor: LyraAnchor): Promise<boolean> {
    if (!this.rendition) return false;
    if (anchor.kind === 'cfi') {
      await this.rendition.display(anchor.cfi);
      return true;
    }
    if (anchor.kind === 'text-quote') {
      const cfi = await this.findTextQuoteCfi(anchor.quote);
      if (!cfi) return false;
      await this.rendition.display(cfi);
      return true;
    }
    return false;
  }

  /** Scans the book's spine sections, in document order, for the first `item.find()` match of
   *  `quote` -- the same section-by-section load/find/unload cycle `search()` uses, but stops at
   *  the first hit instead of collecting every match. `null` when no section matches. */
  private async findTextQuoteCfi(quote: string): Promise<string | null> {
    if (!this.book) return null;
    const spineItems: OptionalPeerApi[] = this.book.spine?.spineItems ?? [];
    for (const item of spineItems) {
      try {
        await item.load(this.book.load?.bind(this.book));
        const results: OptionalPeerApi[] = (await item.find(quote)) ?? [];
        item.unload();
        if (results.length) return results[0].cfi;
      } catch {
        continue;
      }
    }
    return null;
  }

  // -- highlight painting --------------------------------------------------------------------------

  /** Re-applies every `cfi` highlight via `rendition.annotations.highlight()`, clearing whatever
   *  this instance previously painted first -- epub.js doesn't persist annotations across a fresh
   *  `renderTo()`, so this also runs once right after a (re)load finishes. Highlights whose anchor
   *  isn't `cfi` aren't paintable against epub.js's own annotation API and are skipped. */
  private repaintHighlights(): void {
    if (!this.rendition) return;
    for (const cfi of this.paintedHighlightCfis) this.rendition.annotations.remove(cfi, 'highlight');
    this.paintedHighlightCfis = [];
    for (const highlight of this.highlights) {
      if (highlight.anchor.kind !== 'cfi') continue;
      const cfi = highlight.anchor.cfi;
      const tone = highlight.tone ?? 'accent';
      this.rendition.annotations.highlight(
        cfi,
        { id: highlight.id },
        () => this.emit<HighlightActivateDetail>('lyra-highlight-activate', { id: highlight.id }),
        `lyra-hl-${tone}`,
      );
      this.paintedHighlightCfis.push(cfi);
    }
  }

  // -- search ----------------------------------------------------------------------------------------

  /** Case-insensitive search across every spine section, in document order, via epub.js's own
   *  `item.load()`/`item.find()`/`item.unload()`. Navigates to and highlights the first match once
   *  the scan completes. A newer `search()` call, `clearSearch()`, or a `src` change (via
   *  `teardown()`) aborts an in-flight scan. An empty/whitespace-only query behaves like
   *  `clearSearch()` and resolves `0`. */
  async search(query: string): Promise<number> {
    const generation = ++this.searchGeneration;
    this.searchQuery = query;
    this.clearSearchAnnotation();
    if (!this.book || !query.trim()) {
      this.searchMatches = [];
      this.searchActiveIndex = -1;
      this.emitSearchChange();
      return 0;
    }
    const matches: EbookSearchMatch[] = [];
    const spineItems: OptionalPeerApi[] = this.book.spine?.spineItems ?? [];
    for (const item of spineItems) {
      if (generation !== this.searchGeneration) return this.searchMatches.length;
      try {
        await item.load(this.book.load?.bind(this.book));
        const results: OptionalPeerApi[] = (await item.find(query)) ?? [];
        for (const r of results) matches.push({ cfi: r.cfi, excerpt: r.excerpt ?? '' });
        item.unload();
      } catch {
        continue;
      }
    }
    if (generation !== this.searchGeneration) return this.searchMatches.length;
    this.searchMatches = matches;
    this.searchActiveIndex = matches.length > 0 ? 0 : -1;
    this.emitSearchChange();
    if (this.searchActiveIndex >= 0) await this.showSearchMatch(this.searchActiveIndex);
    return matches.length;
  }

  /** Advances to the next match, wrapping to the first after the last. Resolves `false` (no-op)
   *  when there are no matches. */
  async searchNext(): Promise<boolean> {
    if (!this.searchMatches.length) return false;
    this.searchActiveIndex = (this.searchActiveIndex + 1) % this.searchMatches.length;
    this.emitSearchChange();
    await this.showSearchMatch(this.searchActiveIndex);
    return true;
  }

  /** Moves to the previous match, wrapping to the last before the first. Resolves `false` (no-op)
   *  when there are no matches. */
  async searchPrevious(): Promise<boolean> {
    if (!this.searchMatches.length) return false;
    this.searchActiveIndex = (this.searchActiveIndex - 1 + this.searchMatches.length) % this.searchMatches.length;
    this.emitSearchChange();
    await this.showSearchMatch(this.searchActiveIndex);
    return true;
  }

  /** Clears the query, matches, and any painted search annotation, and resets `lyra-search-change`
   *  to a 0-match/no-active-index state. */
  clearSearch(): void {
    this.searchGeneration++;
    this.searchQuery = '';
    this.searchMatches = [];
    this.searchActiveIndex = -1;
    this.clearSearchAnnotation();
    this.emit('lyra-search-change', { query: '', matchCount: 0, activeIndex: -1 });
  }

  private clearSearchAnnotation(): void {
    if (this.searchAnnotationCfi) this.rendition?.annotations.remove(this.searchAnnotationCfi, 'highlight');
    this.searchAnnotationCfi = undefined;
  }

  private async showSearchMatch(index: number): Promise<void> {
    const match = this.searchMatches[index];
    if (!match || !this.rendition) return;
    this.clearSearchAnnotation();
    await this.rendition.display(match.cfi);
    this.rendition.annotations.highlight(match.cfi, {}, undefined, 'lyra-ebook-search');
    this.searchAnnotationCfi = match.cfi;
  }

  private emitSearchChange(): void {
    this.emit('lyra-search-change', {
      query: this.searchQuery,
      matchCount: this.searchMatches.length,
      activeIndex: this.searchActiveIndex,
    });
    announceSearchResult(this.localize.bind(this), this.announcer, this.searchMatches.length, this.searchActiveIndex);
  }

  private announceViaLiveRegion(text: string): void {
    const region = this.renderRoot.querySelector('[part="announcer"]');
    if (region) region.textContent = text;
  }

  // -- rendering --------------------------------------------------------------------------------------------

  private renderStatus(): TemplateResult | typeof nothing {
    if (this.ebookState.kind === 'loading') return html`<p class="status-note">${this.localize('loadingDocument')}</p>`;
    if (this.ebookState.kind === 'error') return html`<div part="error" role="alert">${this.ebookState.message}</div>`;
    if (this.ebookState.kind === 'idle') {
      return html`<p class="status-note">${this.localize('documentPreviewEmpty', undefined, { type: this.localize('documentPreviewTypeDocument') })}</p>`;
    }
    return nothing;
  }

  render(): TemplateResult {
    const disabled = this.ebookState.kind !== 'ready';
    return html`
      <div part="base">
        <div part="toolbar">
          <button part="previous-button" type="button" aria-label=${this.localize('previous')} ?disabled=${disabled} @click=${this.previous}>
            <span part="previous-icon" aria-hidden="true">${chevronIcon()}</span>
          </button>
          <button part="next-button" type="button" aria-label=${this.localize('next')} ?disabled=${disabled} @click=${this.next}>
            <span part="next-icon" aria-hidden="true">${chevronIcon()}</span>
          </button>
        </div>
        <div part="mount" role="region" aria-label=${this.accessibleLabel || this.name || this.localize('ebookViewerRegionLabel')} ${ref(this.mountRef)}></div>
        ${this.renderStatus()}
        <div part="announcer" role="status" class="sr-only"></div>
        ${this.renderAnchorLiveRegion()}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap { 'lyra-ebook-viewer': LyraEbookViewer; }
}
