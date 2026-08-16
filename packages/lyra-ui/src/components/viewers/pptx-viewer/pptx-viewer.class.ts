import { html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { property, query, state } from 'lit/decorators.js';
import { styleMap } from 'lit/directives/style-map.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { srOnly } from '../../../internal/a11y.js';
import { finiteInteger } from '../../../internal/numbers.js';
import {
  TextViewerTarget,
  type LyraSearchChangeDetail,
  type LyraTextViewerTargetEventMap,
} from '../../../internal/text-viewer-target.js';
import { isAbortError, isResourceLimitError, readResponseArrayBuffer, resolveOwnerFetchTarget } from '../../../internal/resource-loader.js';
import { sanitizeCssLength } from '../../../internal/safe-css.js';
import { chevronIcon } from '../../../internal/icons.js';
import {
  adaptPptxViewer,
  getPptxRenderer,
  type PptxSearchHighlightHandle,
  type PptxRendererModule,
  type PptxTextSearchResult,
  type PptxViewerAdapter,
  type PptxViewerAdapterEvent,
} from './pptx-loader.js';
import { assertPptxArchiveWithinLimits } from './pptx-resource-guard.js';
import { styles } from './pptx-viewer.styles.js';
import { getNumberFormat } from '../../../internal/intl-cache.js';
import { ViewerAnnouncementController } from '../viewer-announcements.js';
import type { AnchorResultDetail, TextSelectDetail } from '../document-viewer/anchors.js';
import type { LyraViewerDiagnosticEventDetail } from '../viewer-diagnostics.js';
import type {
  LyraPageViewerSnapshot,
  LyraPageViewerStateChangeDetail,
  PageThumbnailRenderHandle,
} from '../page-rail/page-rail.class.js';
import { viewerSemanticLabel, viewerSemanticRole } from '../viewer-semantic-owner.js';
import { boundedViewerSearchQuery, ViewerSearchWorkBudget } from '../viewer-search-limits.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_anchorJumped, LYRA_DEFAULT_anchorJumpedToPage, LYRA_DEFAULT_anchorNotFound, LYRA_DEFAULT_documentPreviewFailedToLoad, LYRA_DEFAULT_documentPreviewResourceTooLarge, LYRA_DEFAULT_documentPreviewUrlNotAllowed, LYRA_DEFAULT_loading, LYRA_DEFAULT_pptxViewerFidelityNotice, LYRA_DEFAULT_pptxViewerLabel, LYRA_DEFAULT_pptxViewerNextSlide, LYRA_DEFAULT_pptxViewerPreviousSlide, LYRA_DEFAULT_pptxViewerRenderError, LYRA_DEFAULT_pptxViewerSlideOf } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END

export type {
  LyraViewerDiagnostic,
  LyraViewerDiagnosticCode,
  LyraViewerDiagnosticEventDetail,
  LyraViewerDiagnosticSeverity,
} from '../viewer-diagnostics.js';

type PptxPhase = 'idle' | 'loading' | 'mounted' | 'error';
const MAX_PPTX_SEARCH_MATCHES = 10_000;
const MAX_PPTX_THUMBNAIL_WIDTH = 2_048;

export interface LyraPptxViewerEventMap extends LyraTextViewerTargetEventMap {
  'lr-load': CustomEvent<{ slideCount: number }>;
  'lr-slide-change': CustomEvent<{ index: number; count: number }>;
  'lr-render-error': CustomEvent<{ error: unknown }>;
  'lr-search-change': CustomEvent<LyraSearchChangeDetail>;
  'lr-anchor-result': CustomEvent<AnchorResultDetail>;
  'lr-text-select': CustomEvent<TextSelectDetail>;
  'lr-viewer-diagnostic': CustomEvent<LyraViewerDiagnosticEventDetail>;
  'lr-page-viewer-state-change': CustomEvent<LyraPageViewerStateChangeDetail>;
}

class LyraPptxViewerBase extends LyraElement<LyraPptxViewerEventMap> {}

/**
 * Best-effort client-side PPTX viewer backed by `@aiden0z/pptx-renderer`.
 * The fidelity notice is intentionally always visible because animations,
 * equations, embedded OLE objects, notes, and several advanced effects are
 * not represented by the renderer.
 * Remote bytes and measured ZIP expansion are bounded before renderer-owned parsing begins; a
 * peer that does not expose a complete, safely bounded ZIP-limits capability fails closed.
 *
 * @customElement lr-pptx-viewer
 * @event lr-load - Fired after a presentation opens. `detail: { slideCount }`.
 * @event lr-slide-change - Fired when the active slide changes.
 * @event lr-render-error - Fired for terminal fetch/open/render failures and rejected public slide
 *   navigation. Navigation rejection enters the localized error state. Recoverable post-load
 *   slide/node/search events use `lr-viewer-diagnostic` without also posing as terminal errors.
 * @event {CustomEvent<LyraSearchChangeDetail>} lr-search-change - Fired whenever search state
 *   changes, including source-reset and effective-locale re-evaluation. Search accepts at most
 *   4,096 query code units, validates at most 4,000,000 result code
 *   units, and retains at most 10,000 valid matches; `matchCountExact=false` identifies a
 *   ceiling-truncated lower bound. Bubbling, composed, and non-cancelable.
 * @event {CustomEvent<AnchorResultDetail>} lr-anchor-result - Fired after an `anchor` assignment or
 *   `scrollToAnchor()` call is applied. `detail: { found: boolean }`. Bubbling, composed, and
 *   non-cancelable.
 * @event {CustomEvent<TextSelectDetail>} lr-text-select - Fired after a selection ends inside the
 *   rendered presentation. `detail: { text: string; anchor: LyraAnchor | null; rects: DOMRect[] }`.
 *   Bubbling, composed, and non-cancelable.
 * @event lr-viewer-diagnostic - Structured renderer diagnostics for slide/node/search failures.
 *   `detail.diagnostic` includes a stable code, source, cause, `fatal`, and page/node when known.
 * @event lr-page-viewer-state-change - Correlated page lifecycle state for `lr-page-rail` and
 *   other page-addressed integrations. `detail.snapshot` equals `pageViewerSnapshot`.
 * @csspart base - The named viewer region with explicit `aria-busy`; its ordinary visually-hidden
 *   loading label is announced on later transitions through the shared document-level polite sink.
 * @csspart header - The optional presentation-name row.
 * @csspart name - The presentation name.
 * @csspart notice - The persistent fidelity notice.
 * @csspart error - Visible ordinary error text; transitions announce through the shared
 *   document-level assertive region.
 * @csspart nav - Slide navigation controls.
 * @csspart previous-button - Previous-slide button.
 * @csspart previous-icon - Previous-slide icon; mirrors with effective RTL direction.
 * @csspart slide-count - Current slide indicator.
 * @csspart next-button - Next-slide button.
 * @csspart next-icon - Next-slide icon; mirrors with effective RTL direction.
 * @csspart container - The renderer-owned output container.
 * @cssprop [--lr-pptx-viewer-max-height=none] - Maximum block size of the scrollable renderer
 *   output container before it scrolls internally. Also settable via the `max-height` property.
 * @status stable
 * @since 4.0.0
 */
export class LyraPptxViewer extends TextViewerTarget(LyraPptxViewerBase) {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    anchorJumped: LYRA_DEFAULT_anchorJumped,
    anchorJumpedToPage: LYRA_DEFAULT_anchorJumpedToPage,
    anchorNotFound: LYRA_DEFAULT_anchorNotFound,
    documentPreviewFailedToLoad: LYRA_DEFAULT_documentPreviewFailedToLoad,
    documentPreviewResourceTooLarge: LYRA_DEFAULT_documentPreviewResourceTooLarge,
    documentPreviewUrlNotAllowed: LYRA_DEFAULT_documentPreviewUrlNotAllowed,
    loading: LYRA_DEFAULT_loading,
    pptxViewerFidelityNotice: LYRA_DEFAULT_pptxViewerFidelityNotice,
    pptxViewerLabel: LYRA_DEFAULT_pptxViewerLabel,
    pptxViewerNextSlide: LYRA_DEFAULT_pptxViewerNextSlide,
    pptxViewerPreviousSlide: LYRA_DEFAULT_pptxViewerPreviousSlide,
    pptxViewerRenderError: LYRA_DEFAULT_pptxViewerRenderError,
    pptxViewerSlideOf: LYRA_DEFAULT_pptxViewerSlideOf,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  // `srOnly` keeps the anchor-target mixin's aria-hidden diagnostic mirror from painting as a
  // visible row under the fidelity notice. The spoken copy lives in the document-level sink.
  static override styles = [LyraElement.styles, styles, srOnly];

  /** URL of the PPTX file. */
  @property() src = '';
  /** Optional presentation name. */
  @property() name = '';
  /** Accessible-name override for the viewer region. Omitting it falls back to `name`, then a
   *  localized default; an explicit empty string clears it. */
  @property() label?: string;
  /** One-based current slide for page-addressed integrations; assignments navigate when ready. */
  @property({ type: Number, reflect: true }) page = 1;
  /** A CSS `max-height` that caps the scrollable renderer output container; invalid values are ignored. */
  @property({ attribute: 'max-height' }) maxHeight = '';
  /**
   * Searches the renderer's complete presentation model, including slides that windowed rendering
   * has not mounted. Queries are capped at 4,096 code units, peer output validation at 4,000,000
   * code units, and retained results at 10,000. Navigation uses renderer-owned node overlays;
   * `lr-search-change.detail.matchCountExact=false` identifies a ceiling-truncated lower bound.
   */
  override async search(query: string): Promise<number> {
    const generation = ++this.pptxSearchGeneration;
    const viewer = this.viewer;
    const boundedQuery = boundedViewerSearchQuery(query, this.effectiveLocale);
    this.pptxSearchQuery = query;
    this.lastSearchLocale = this.effectiveLocale;
    this.disposeSearchHighlight();
    viewer?.clearSearchHighlights();
    if (!boundedQuery.accepted) {
      this.pptxSearchMatches = [];
      this.pptxSearchMatchCountExact = false;
      this.pptxSearchActiveIndex = -1;
      this.emitPptxSearchChange();
      return 0;
    }
    if (!viewer || !boundedQuery.needle) {
      this.pptxSearchMatches = [];
      this.pptxSearchMatchCountExact = true;
      this.pptxSearchActiveIndex = -1;
      this.emitPptxSearchChange();
      return 0;
    }
    try {
      const raw = viewer.searchText(query.trim(), { matchCase: false });
      if (generation !== this.pptxSearchGeneration || viewer !== this.viewer) {
        return this.pptxSearchMatches.length;
      }
      const normalized = this.normalizeSearchResults(raw, viewer.slideCount);
      this.pptxSearchMatches = normalized.matches;
      this.pptxSearchMatchCountExact = normalized.matchCountExact;
      this.pptxSearchActiveIndex = this.pptxSearchMatches.length > 0 ? 0 : -1;
      this.emitPptxSearchChange();
      if (this.pptxSearchActiveIndex >= 0) {
        await this.focusPptxSearchMatch(this.pptxSearchActiveIndex, generation, viewer);
      }
      return this.pptxSearchMatches.length;
    } catch (cause) {
      if (generation !== this.pptxSearchGeneration || viewer !== this.viewer) return 0;
      this.pptxSearchMatches = [];
      this.pptxSearchMatchCountExact = false;
      this.pptxSearchActiveIndex = -1;
      this.reportPeerDiagnostic('pptx-search-error', cause);
      this.emitPptxSearchChange();
      return 0;
    }
  }

  override async searchNext(): Promise<boolean> {
    const viewer = this.viewer;
    if (!viewer || this.pptxSearchMatches.length === 0) return false;
    const generation = ++this.pptxSearchGeneration;
    this.pptxSearchActiveIndex = (this.pptxSearchActiveIndex + 1) % this.pptxSearchMatches.length;
    this.emitPptxSearchChange();
    await this.focusPptxSearchMatch(this.pptxSearchActiveIndex, generation, viewer);
    return generation === this.pptxSearchGeneration;
  }

  override async searchPrevious(): Promise<boolean> {
    const viewer = this.viewer;
    if (!viewer || this.pptxSearchMatches.length === 0) return false;
    const generation = ++this.pptxSearchGeneration;
    this.pptxSearchActiveIndex = (
      this.pptxSearchActiveIndex - 1 + this.pptxSearchMatches.length
    ) % this.pptxSearchMatches.length;
    this.emitPptxSearchChange();
    await this.focusPptxSearchMatch(this.pptxSearchActiveIndex, generation, viewer);
    return generation === this.pptxSearchGeneration;
  }

  override clearSearch(): void {
    this.pptxSearchGeneration++;
    this.pptxSearchQuery = '';
    this.pptxSearchMatches = [];
    this.pptxSearchMatchCountExact = true;
    this.pptxSearchActiveIndex = -1;
    this.disposeSearchHighlight();
    this.viewer?.clearSearchHighlights();
    this.emitPptxSearchChange();
  }

  @state() private phase: PptxPhase = 'idle';
  @state() private errorMessage = '';
  @state() private slideCount = 0;
  @state() private currentSlideIndex = 0;
  @query('[part="container"]') private containerEl?: HTMLElement;

  /** @internal Test seam for replacing the optional renderer. */
  loadRenderer: () => Promise<PptxRendererModule | null> = getPptxRenderer;
  private viewer?: PptxViewerAdapter;
  private viewerUnsubscribe?: () => void;
  private generation = 0;
  private readonly announcements = new ViewerAnnouncementController(this);
  private pptxSearchQuery = '';
  private lastSearchLocale = '';
  private pptxSearchMatches: PptxTextSearchResult[] = [];
  private pendingSearchResetEvent = false;
  private pptxSearchMatchCountExact = true;
  private pptxSearchActiveIndex = -1;
  private pptxSearchGeneration = 0;
  private searchHighlight?: PptxSearchHighlightHandle;
  private pageViewerIdentity = 0;
  private pageViewerSnapshotValue: LyraPageViewerSnapshot = Object.freeze({
    identity: 0,
    status: 'idle',
    page: 1,
    pageCount: 0,
  });

  /** Atomic readonly page/count/lifecycle state; `identity` changes for every load transaction. */
  get pageViewerSnapshot(): LyraPageViewerSnapshot {
    return this.pageViewerSnapshotValue;
  }

  protected textContentRoot(): Element | null {
    return this.renderRoot.querySelector('[part="container"]') ?? this.renderRoot.querySelector('[part="base"]');
  }

  private readonly onViewerEvent = (event: PptxViewerAdapterEvent): void => {
    if (event.kind === 'slide-change') {
      this.commitSlide(event.index);
      return;
    }
    this.reportPeerDiagnostic(event.code, event.cause, {
      page: event.page,
      nodeId: event.nodeId,
    }, event.fatal);
  };

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    this.announcements.transition(
      'load',
      this.phase,
      this.phase === 'error' ? this.errorMessage : this.localize('loading'),
    );
    if (changed.has('src')) this.scheduleAfterUpdate(() => { void this.mount(); });
    if (changed.has('src') && this.pendingSearchResetEvent) {
      this.pendingSearchResetEvent = false;
      this.emitPptxSearchChange();
    }
    if (changed.has('page') && this.viewer && this.page - 1 !== this.currentSlideIndex) {
      const page = this.page;
      this.scheduleAfterUpdate(() => {
        if (this.page === page) void this.goToSlide(page - 1);
      }, 'page-navigation');
    }
    const locale = this.effectiveLocale;
    if (locale !== this.lastSearchLocale) {
      const shouldRecompute = this.pptxSearchQuery !== '';
      this.lastSearchLocale = locale;
      if (shouldRecompute) {
        this.scheduleAfterUpdate(() => {
          void this.search(this.pptxSearchQuery);
        }, 'search');
      }
    }
  }

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed);
    if (changed.has('src')) {
      this.pendingSearchResetEvent ||= this.hasPptxSearchState();
      this.resetPptxSearchState();
    }
    if (changed.has('page') || changed.has('slideCount')) {
      this.page = finiteInteger(this.page, 1, 1, Math.max(1, this.slideCount));
    }
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.announcements.connect();
    // A reconnect (e.g. a drag-and-drop reparent, a tab/panel re-hosting its
    // children, a virtualized list moving this same element instance) fires
    // disconnectedCallback then connectedCallback synchronously with no
    // update in between, so updated()'s `changed.has('src')` gate never
    // fires again to remount the presentation. disconnectedCallback already
    // reset `phase` to idle and tore the renderer down, so re-arm the mount
    // here whenever there's a `src` to load and this isn't the very first
    // connect (that case is already covered by updated()'s initial-render
    // gate).
    if (this.hasUpdated && this.src) this.scheduleAfterUpdate(() => { void this.mount(); });
  }

  override disconnectedCallback(): void {
    this.teardown();
    // Reset rather than leaving stale "mounted" state behind: without this,
    // a reconnect that isn't followed by a fresh mount (src unset, or the
    // reconnect races ahead of connectedCallback's remount) would keep
    // rendering the nav/slide controls as if a presentation were still
    // loaded, against a destroyed renderer -- an empty container with
    // live-looking prev/next buttons that silently no-op every click,
    // instead of an empty/idle state.
    this.phase = 'idle';
    this.slideCount = 0;
    this.currentSlideIndex = 0;
    this.page = 1;
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
    this.announcements.adopted();
  }

  /** Navigates to a zero-based slide index. A current renderer rejection is contained, enters the
   * localized error state, and emits `lr-render-error`; invalid or stale navigation is a no-op. */
  async goToSlide(index: number): Promise<void> {
    const viewer = this.viewer;
    if (!viewer || !Number.isSafeInteger(index) || index < 0 || index >= viewer.slideCount) return;
    const generation = this.generation;
    try {
      await viewer.goToSlide(index);
    } catch (error) {
      if (
        isAbortError(error)
        || !this.isConnected
        || generation !== this.generation
        || viewer !== this.viewer
      ) return;
      this.teardown();
      this.phase = 'error';
      this.slideCount = 0;
      this.currentSlideIndex = 0;
      this.page = 1;
      this.errorMessage = this.localize('pptxViewerRenderError');
      this.publishPageViewerSnapshot('error', 0);
      this.emit('lr-render-error', { error });
      return;
    }
    if (viewer === this.viewer && viewer.currentSlideIndex !== this.currentSlideIndex) {
      this.commitSlide(viewer.currentSlideIndex);
    }
  }

  /** Renders a one-based slide preview into `container`. The caller owns the returned handle. */
  async renderPageThumbnailToContainer(
    page: number,
    container: HTMLElement,
    options?: { width?: number },
  ): Promise<PageThumbnailRenderHandle | false> {
    const viewer = this.viewer;
    const generation = this.generation;
    const width = options?.width ?? 96;
    if (
      !viewer
      || !Number.isSafeInteger(page)
      || page < 1
      || page > viewer.slideCount
      || !Number.isFinite(width)
      || width <= 0
      || width > MAX_PPTX_THUMBNAIL_WIDTH
    ) return false;
    container.replaceChildren();
    const handle = viewer.renderThumbnailToContainer(page - 1, container, { width });
    if (!handle) return false;
    try {
      await handle.ready;
    } catch {
      handle.dispose();
      return false;
    }
    if (generation !== this.generation || viewer !== this.viewer || !container.isConnected) {
      handle.dispose();
      return false;
    }
    return handle;
  }

  private commitSlide(index: number): void {
    if (!Number.isSafeInteger(index) || index < 0 || index >= this.slideCount) return;
    const changed = index !== this.currentSlideIndex;
    this.currentSlideIndex = index;
    this.page = index + 1;
    this.publishPageViewerSnapshot('ready', this.slideCount);
    if (changed) this.emit('lr-slide-change', { index, count: this.slideCount });
  }

  private publishPageViewerSnapshot(
    status: LyraPageViewerSnapshot['status'],
    pageCount: number,
  ): void {
    const snapshot: LyraPageViewerSnapshot = Object.freeze({
      identity: this.pageViewerIdentity,
      status,
      page: status === 'ready'
        ? finiteInteger(this.page, 1, 1, Math.max(1, pageCount))
        : 1,
      pageCount: status === 'ready'
        ? finiteInteger(pageCount, 0, 0, Number.MAX_SAFE_INTEGER)
        : 0,
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

  private teardown(): void {
    const shouldEmitSearchReset = this.hasPptxSearchState();
    this.generation++;
    this.viewerUnsubscribe?.();
    this.viewerUnsubscribe = undefined;
    this.viewer?.destroy();
    this.viewer = undefined;
    this.resetPptxSearchState();
    if (shouldEmitSearchReset) this.emitPptxSearchChange();
  }

  private hasPptxSearchState(): boolean {
    return this.pptxSearchQuery !== ''
      || this.pptxSearchMatches.length > 0
      || !this.pptxSearchMatchCountExact
      || this.pptxSearchActiveIndex !== -1;
  }

  private resetPptxSearchState(): void {
    this.pptxSearchGeneration++;
    this.disposeSearchHighlight();
    this.viewer?.clearSearchHighlights();
    this.pptxSearchQuery = '';
    this.pptxSearchMatches = [];
    this.pptxSearchMatchCountExact = true;
    this.pptxSearchActiveIndex = -1;
  }

  private normalizeSearchResults(
    value: unknown,
    slideCount: number,
  ): { matches: PptxTextSearchResult[]; matchCountExact: boolean } {
    if (!Array.isArray(value)) throw new TypeError('PPTX search returned a non-array result.');
    const matches: PptxTextSearchResult[] = [];
    const work = new ViewerSearchWorkBudget();
    let matchCountExact = true;
    for (const candidate of value) {
      if (!work.consume('')) {
        matchCountExact = false;
        break;
      }
      if (!candidate || typeof candidate !== 'object') continue;
      const result = candidate as Partial<PptxTextSearchResult>;
      if (
        !Number.isSafeInteger(result.slideIndex)
        || result.slideIndex! < 0
        || result.slideIndex! >= slideCount
        || typeof result.nodeId !== 'string'
        || typeof result.text !== 'string'
        || !Number.isSafeInteger(result.matchStart)
        || !Number.isSafeInteger(result.matchEnd)
        || result.matchStart! < 0
        || result.matchEnd! < result.matchStart!
        || result.matchEnd! > result.text.length
      ) continue;
      if (!work.consume(result.nodeId) || !work.consume(result.text)) {
        matchCountExact = false;
        break;
      }
      if (matches.length === MAX_PPTX_SEARCH_MATCHES) {
        matchCountExact = false;
        break;
      }
      matches.push(candidate as PptxTextSearchResult);
    }
    return { matches, matchCountExact: matchCountExact && work.complete };
  }

  private async focusPptxSearchMatch(
    index: number,
    generation: number,
    viewer: PptxViewerAdapter,
  ): Promise<void> {
    const match = this.pptxSearchMatches[index];
    if (!match) return;
    this.disposeSearchHighlight();
    viewer.clearSearchHighlights();
    try {
      await viewer.goToSlide(match.slideIndex);
      if (generation !== this.pptxSearchGeneration || viewer !== this.viewer) return;
      const highlight = await viewer.highlightSearchResult(match, { scrollIntoView: false });
      if (generation !== this.pptxSearchGeneration || viewer !== this.viewer) {
        highlight?.dispose();
        return;
      }
      this.searchHighlight = highlight ?? undefined;
    } catch (cause) {
      if (generation === this.pptxSearchGeneration && viewer === this.viewer) {
        this.reportPeerDiagnostic('pptx-search-error', cause, { page: match.slideIndex + 1 });
      }
    }
  }

  private disposeSearchHighlight(): void {
    this.searchHighlight?.dispose();
    this.searchHighlight = undefined;
  }

  private emitPptxSearchChange(): void {
    this.emit('lr-search-change', {
      query: this.pptxSearchQuery,
      matchCount: this.pptxSearchMatches.length,
      matchCountExact: this.pptxSearchMatchCountExact,
      activeIndex: this.pptxSearchActiveIndex,
    });
  }

  private reportPeerDiagnostic(
    code: 'pptx-slide-render-error' | 'pptx-node-render-error' | 'pptx-search-error',
    cause: unknown,
    location: { page?: number; nodeId?: string } = {},
    fatal = false,
  ): void {
    this.emit('lr-viewer-diagnostic', {
      diagnostic: Object.freeze({
        code,
        severity: 'error',
        fatal,
        source: 'pptx-renderer',
        cause,
        ...location,
      } as const),
    });
    if (!fatal) return;
    this.teardown();
    this.phase = 'error';
    this.slideCount = 0;
    this.currentSlideIndex = 0;
    this.page = 1;
    this.errorMessage = this.localize('pptxViewerRenderError');
    this.publishPageViewerSnapshot('error', 0);
    this.emit('lr-render-error', { error: cause });
  }

  private async mount(): Promise<void> {
    this.teardown();
    this.pageViewerIdentity++;
    const signal = this.beginAbortableLoad();
    const generation = this.generation;
    this.slideCount = 0;
    this.currentSlideIndex = 0;
    this.page = 1;
    if (!this.src) {
      this.phase = 'idle';
      this.publishPageViewerSnapshot('idle', 0);
      return;
    }
    const fetchTarget = resolveOwnerFetchTarget(this, this.src);
    if (!fetchTarget) {
      const error = new Error(this.localize('documentPreviewUrlNotAllowed'));
      this.phase = 'error';
      this.errorMessage = error.message;
      this.publishPageViewerSnapshot('error', 0);
      this.emit('lr-render-error', { error });
      return;
    }
    this.phase = 'loading';
    this.publishPageViewerSnapshot('loading', 0);
    let module: PptxRendererModule | null;
    let response: Response;
    try {
      [module, response] = await Promise.all([
        this.loadRenderer(),
        fetchTarget.view.fetch(fetchTarget.url, signal ? { signal } : undefined),
      ]);
    } catch (error) {
      if (isAbortError(error) || !this.isConnected || generation !== this.generation) return;
      this.phase = 'error';
      this.errorMessage = this.localize(isResourceLimitError(error) ? 'documentPreviewResourceTooLarge' : 'documentPreviewFailedToLoad');
      this.publishPageViewerSnapshot('error', 0);
      this.emit('lr-render-error', { error });
      return;
    }
    if (!this.isConnected || generation !== this.generation) return;
    if (!module || !response.ok) {
      const error = new Error(
        this.localize(module ? 'documentPreviewFailedToLoad' : 'pptxViewerRenderError'),
      );
      this.phase = 'error';
      this.errorMessage = error.message;
      this.publishPageViewerSnapshot('error', 0);
      this.emit('lr-render-error', { error });
      return;
    }
    let buffer: ArrayBuffer;
    try {
      buffer = await readResponseArrayBuffer(response);
      if (!this.isConnected || generation !== this.generation) return;
      await assertPptxArchiveWithinLimits(buffer, { signal });
    } catch (error) {
      if (isAbortError(error) || !this.isConnected || generation !== this.generation) return;
      this.phase = 'error';
      this.errorMessage = this.localize(isResourceLimitError(error) ? 'documentPreviewResourceTooLarge' : 'documentPreviewFailedToLoad');
      this.publishPageViewerSnapshot('error', 0);
      this.emit('lr-render-error', { error });
      return;
    }
    if (!this.isConnected || generation !== this.generation) return;
    this.phase = 'mounted';
    await this.updateComplete;
    if (!this.isConnected || generation !== this.generation || !this.containerEl) return;
    try {
      const openedViewer = await module.PptxViewer.open(buffer, this.containerEl, {
        zipLimits: module.RECOMMENDED_ZIP_LIMITS,
        listOptions: { windowed: true },
      });
      if (!this.isConnected || generation !== this.generation) { openedViewer.destroy(); return; }
      const viewer = adaptPptxViewer(openedViewer);
      if (!viewer) {
        openedViewer.destroy();
        throw new TypeError('The PPTX renderer did not expose the required viewer capabilities.');
      }
      this.viewer = viewer;
      this.viewerUnsubscribe = viewer.subscribe(this.onViewerEvent);
      this.slideCount = viewer.slideCount;
      this.currentSlideIndex = viewer.currentSlideIndex;
      this.page = viewer.currentSlideIndex + 1;
      this.publishPageViewerSnapshot('ready', viewer.slideCount);
      this.emit('lr-load', { slideCount: viewer.slideCount });
    } catch (error) {
      if (isAbortError(error) || !this.isConnected || generation !== this.generation) return;
      this.phase = 'error';
      this.errorMessage = this.localize('pptxViewerRenderError');
      this.publishPageViewerSnapshot('error', 0);
      this.emit('lr-render-error', { error });
    }
  }

  private renderBody(): TemplateResult | typeof nothing {
    if (this.phase === 'loading') return html`
      <lr-skeleton shape="rect" .announce=${false}></lr-skeleton>
      <span class="sr-only">${this.localize('loading')}</span>
    `;
    if (this.phase === 'error') return html`<div part="error">${this.errorMessage}</div>`;
    if (this.phase !== 'mounted') return nothing;
    return html`
      <div part="nav" ?hidden=${this.slideCount <= 1}>
        <button part="previous-button" type="button" aria-label=${this.localize('pptxViewerPreviousSlide')} ?disabled=${this.currentSlideIndex <= 0} @click=${() => this.goToSlide(this.currentSlideIndex - 1)}>
          <span part="previous-icon" aria-hidden="true">${chevronIcon()}</span>
        </button>
        <span part="slide-count">${this.localize('pptxViewerSlideOf', undefined, {
          current: getNumberFormat(this.effectiveLocale).format(this.currentSlideIndex + 1),
          total: getNumberFormat(this.effectiveLocale).format(this.slideCount),
        })}</span>
        <button part="next-button" type="button" aria-label=${this.localize('pptxViewerNextSlide')} ?disabled=${this.currentSlideIndex >= this.slideCount - 1} @click=${() => this.goToSlide(this.currentSlideIndex + 1)}>
          <span part="next-icon" aria-hidden="true">${chevronIcon()}</span>
        </button>
      </div>
      <div part="container"></div>
    `;
  }

  override render(): TemplateResult {
    const ariaLabel = viewerSemanticLabel(
      this,
      this.label == null ? this.name || this.localize('pptxViewerLabel') : this.label
    );
    return html`
      <div
        part="base"
        role=${viewerSemanticRole(this, 'region') ?? nothing}
        aria-label=${ariaLabel ?? nothing}
        aria-busy=${this.phase === 'loading' ? 'true' : 'false'}
        style=${sanitizeCssLength(this.maxHeight)
          ? styleMap({ '--lr-pptx-viewer-max-height': sanitizeCssLength(this.maxHeight)! })
          : nothing}
      >
        <div part="header" ?hidden=${!this.name}><span part="name">${this.name}</span></div>
        <p part="notice" role="note">${this.localize('pptxViewerFidelityNotice')}</p>
        ${this.renderBody()}${this.renderAnchorLiveRegion()}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap { 'lr-pptx-viewer': LyraPptxViewer; }
}
