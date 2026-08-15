import { html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import { styleMap } from 'lit/directives/style-map.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import {
  isAbortError,
  isResourceLimitError,
  LyraUserFacingError,
  readResponseText,
  resolveOwnerFetchTarget,
} from '../../../internal/resource-loader.js';
import { srOnly } from '../../../internal/a11y.js';
import { prefersReducedMotion } from '../../../internal/motion.js';
import {
  DocumentAnchorTarget,
  type LyraAnchorTargetEventMap,
} from '../../../internal/anchor-target.js';
import {
  parseCellRange,
  type ParsedCellRange,
} from '../../../internal/cell-range.js';
import type {
  LyraAnchor,
  LyraAnchorKind,
  LyraHighlight,
} from '../document-viewer/anchors.js';
import {
  loadPapaParseCached,
  type PapaParseApi,
} from '../../../internal/papaparse-loader.js';
import { styles } from './csv-viewer.styles.js';
import { presenceTrueDefaultBooleanConverter as trueDefaultBooleanConverter } from '../../../internal/converters.js';
import {
  delimitedCellText as cell,
  delimitedColumnCount as columns,
  parseDelimitedGrid,
} from '../../../internal/delimited-data.js';
import { LatestTask } from '../../../internal/latest-task.js';
import { sanitizeCssLength } from '../../../internal/safe-css.js';
import { ViewerAnnouncementController } from '../viewer-announcements.js';
import { renderViewerLoading, viewerLoadingStyles } from '../viewer-loading.js';
import {
  viewerSemanticLabel,
  viewerSemanticRole,
} from '../viewer-semantic-owner.js';
import type { LyraSearchChangeDetail } from '../../../internal/text-viewer-target.js';
import {
  boundedViewerSearchQuery,
  ViewerSearchWorkBudget,
} from '../viewer-search-limits.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import {
  LYRA_DEFAULT_anchorJumped,
  LYRA_DEFAULT_anchorJumpedToPage,
  LYRA_DEFAULT_anchorNotFound,
  LYRA_DEFAULT_cellHighlightWithLabel,
  LYRA_DEFAULT_csvViewerLabel,
  LYRA_DEFAULT_csvViewerUnavailable,
  LYRA_DEFAULT_documentPreviewEmpty,
  LYRA_DEFAULT_documentPreviewFailedToLoad,
  LYRA_DEFAULT_documentPreviewResourceTooLarge,
  LYRA_DEFAULT_documentPreviewTypeDocument,
  LYRA_DEFAULT_documentPreviewUrlNotAllowed,
  LYRA_DEFAULT_highlightWithLabel,
  LYRA_DEFAULT_loadingDocument,
  LYRA_DEFAULT_noData,
} from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END

type CsvState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'loaded'; rows: unknown[][] }
  | { kind: 'error'; message: string };
type OwnedAnimationFrameWait = {
  owner: Window;
  handle?: number;
  resolve: (isCurrent: boolean) => void;
};
const MAX_SEARCH_MATCHES = 1_000;

/** `hasHeaderRow` shifts every raw-grid (1-based, header row included) row number down by one to
 *  reach the matching index into the virtualized body array. */
function headerOffset(hasHeaderRow: boolean): number {
  return hasHeaderRow ? 1 : 0;
}

/** One `highlights` entry resolved against the parsed grid, alongside its parsed `cell-range`. */
interface ResolvedCellHighlight {
  highlight: LyraHighlight;
  parsed: ParsedCellRange;
}

export interface LyraCsvViewerEventMap
  extends Omit<LyraAnchorTargetEventMap, 'lr-text-select'> {
  'lr-render-error': CustomEvent<{ error: unknown }>;
  /** Fired whenever the search query, match count, or active match index changes, from
   *  `search()`/`searchNext()`/`searchPrevious()`/`clearSearch()`. */
  'lr-search-change': CustomEvent<LyraSearchChangeDetail>;
}

class LyraCsvViewerBase extends LyraElement<LyraCsvViewerEventMap> {}

/**
 * Fetches CSV text, parses quoted fields with PapaParse, and virtualizes its rows.
 *
 * Adopts `DocumentAnchorTarget`: a `cell-range` anchor addresses the raw file grid, 1-based, with
 * the header row included whenever `has-header-row` is set (matching how a spreadsheet app itself
 * labels `A1`) -- `scrollToAnchor()` scrolls the addressed row into view via the virtualized list's
 * `active-id`, then scrolls the first addressed column horizontally into view. A `sheet`-qualified
 * anchor never resolves here -- this viewer has no sheets. `highlights` paint as a
 * `part="cell-highlight"` structural cell wrapping a native `part="cell-highlight-action"` button
 * on membership, recomputed per row inside `renderRow()` so a row scrolled out and back in
 * reconstructs its highlight for free, with no persistent DOM to keep in sync.
 * `search()` is a locale-aware case-insensitive substring match over the same stringified cell
 * values `cell()` already renders, ordered row then column.
 *
 * A quote-aware structural scan enforces the 10,000-raw-row, 1,000-column, 1,000,000-cell, and
 * 100-diagnostic ceilings before PapaParse can materialize an amplified result. The peer then runs
 * with streaming row callbacks and the same limits as a second boundary.
 *
 * @customElement lr-csv-viewer
 * @event lr-render-error - Fired when fetching or parsing fails, a parser is unavailable, the
 *   bounded parse exceeds a resource ceiling, or PapaParse returns recoverable diagnostics.
 * @event lr-highlight-activate - A `highlights` cell was clicked, or activated via Enter/Space
 *   while focused. `detail: { highlightId }`.
 * @event lr-anchor-result - Fired after an `anchor` property assignment or a `scrollToAnchor()`
 *   call is applied. `detail: { found }`.
 * @event lr-search-change - Fired whenever the search query, match count, or active match index
 *   changes, from `search()`/`searchNext()`/`searchPrevious()`/`clearSearch()`. `detail: { query,
 *   matchCount, matchCountExact, activeIndex }`. Search accepts at most 4,096 query code units,
 *   scans at most 4,000,000 cell code units, and retains at most 1,000 matches;
 *   `matchCountExact=false` identifies a ceiling-truncated lower bound.
 * @csspart base - The root wrapper with explicit `aria-busy` loading state.
 * @csspart body - The scrollable wrapper around the fetched-state content, capped by `max-height`.
 * @csspart sheet - The wrapper around the header row and virtualized body.
 * @csspart rows - The virtualized row list.
 * @csspart header-row - The sticky header row, rendered while `has-header-row` is set.
 * @csspart data-row - One virtualized data row.
 * @csspart cell - One rendered cell.
 * @csspart cell-highlight - A structural cell covered by a `highlights` entry.
 * @csspart cell-highlight-action - The native button filling a highlighted cell; emits
 *   `lr-highlight-activate` when activated. Its accessible name localizes the complete cell-value
 *   and annotation message through separate `{value}` and `{label}` placeholders.
 * @csspart spinner - The visible tokenized loading treatment and ordinary text label.
 * @csspart error - The error message region.
 * @cssprop [--lr-csv-viewer-highlight-color=var(--lr-color-brand)] - Outline color of a highlighted
 *   cell. The active highlight changes a private warning-color default; an inherited or direct
 *   public value remains authoritative.
 * @cssprop [--lr-csv-viewer-max-height=none] - Maximum block size of `[part="body"]` before it
 *   scrolls internally. The `maxHeight` property sets this token inline on `[part="base"]`.
 * @status stable
 * @since 4.0.0
 */
export class LyraCsvViewer extends DocumentAnchorTarget(LyraCsvViewerBase) {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> =
    {
      ...super.defaultStrings,
      anchorJumped: LYRA_DEFAULT_anchorJumped,
      anchorJumpedToPage: LYRA_DEFAULT_anchorJumpedToPage,
      anchorNotFound: LYRA_DEFAULT_anchorNotFound,
      cellHighlightWithLabel: LYRA_DEFAULT_cellHighlightWithLabel,
      csvViewerLabel: LYRA_DEFAULT_csvViewerLabel,
      csvViewerUnavailable: LYRA_DEFAULT_csvViewerUnavailable,
      documentPreviewEmpty: LYRA_DEFAULT_documentPreviewEmpty,
      documentPreviewFailedToLoad: LYRA_DEFAULT_documentPreviewFailedToLoad,
      documentPreviewResourceTooLarge:
        LYRA_DEFAULT_documentPreviewResourceTooLarge,
      documentPreviewTypeDocument: LYRA_DEFAULT_documentPreviewTypeDocument,
      documentPreviewUrlNotAllowed: LYRA_DEFAULT_documentPreviewUrlNotAllowed,
      highlightWithLabel: LYRA_DEFAULT_highlightWithLabel,
      loadingDocument: LYRA_DEFAULT_loadingDocument,
      noData: LYRA_DEFAULT_noData,
    };
  // GENERATED DEFAULT-STRING SLICE: END

  static override styles = [
    LyraElement.styles,
    styles,
    srOnly,
    viewerLoadingStyles,
  ];
  /** URL to fetch and parse. */
  @property() src = '';
  /** Source filename or display name used on the shadow viewer owner when host `aria-label` is
   *  absent. A non-empty host label remains on the host; an explicitly empty one is preserved on
   *  the shadow owner. */
  @property() name = '';
  /** Whether the first parsed row is rendered as a sticky header. */
  @property({
    attribute: 'has-header-row',
    converter: trueDefaultBooleanConverter,
  })
  hasHeaderRow = true;
  /** CSS length that caps the scrollable body. */
  /** A CSS `max-height`; invalid values are ignored. */
  @property({ attribute: 'max-height' }) maxHeight = '';

  /** Anchor kinds this viewer resolves via `scrollToAnchor()`. */
  override readonly anchorKinds: readonly LyraAnchorKind[] = ['cell-range'];

  @state() private fetchState: CsvState = { kind: 'idle' };
  /** The virtualized body row currently scrolled into view via `scrollToAnchor()` or search
   *  navigation -- bound to `<lr-virtual-list>`'s own `active-id`. */
  @state() private activeRowKey: number | '' = '';
  @state() private searchMatches: { row: number; col: number }[] = [];
  private searchMatchCountExact = true;
  @state() private searchActiveIndex = -1;
  private searchQuery = '';
  private lastSearchLocale = '';
  private loadTask = new LatestTask();
  private loadLibrary: () => Promise<PapaParseApi | null> = loadPapaParseCached;
  private lastLoadSrc = '';
  private readonly announcements = new ViewerAnnouncementController(this);
  private readonly pendingAnimationFrames = new Set<OwnedAnimationFrameWait>();

  override connectedCallback(): void {
    super.connectedCallback();
    this.announcements.connect();
    if (this.hasUpdated && this.src && this.src === this.lastLoadSrc) {
      this.scheduleAfterUpdate(() => {
        void this.load();
      });
    }
  }

  override disconnectedCallback(): void {
    this.loadTask.next();
    this.cancelPendingAnimationFrames();
    this.announcements.disconnect();
    super.disconnectedCallback();
  }

  override adoptedCallback(): void {
    super.adoptedCallback();
    this.cancelPendingAnimationFrames();
    this.announcements.adopted();
  }

  private waitForOwnerAnimationFrame(): Promise<boolean> {
    const owner = this.ownerDocument.defaultView;
    if (!owner || !this.isConnected) return Promise.resolve(false);
    return new Promise<boolean>((resolve) => {
      const pending: OwnedAnimationFrameWait = { owner, resolve };
      this.pendingAnimationFrames.add(pending);
      pending.handle = owner.requestAnimationFrame(() => {
        if (!this.pendingAnimationFrames.delete(pending)) return;
        resolve(this.isConnected && this.ownerDocument.defaultView === owner);
      });
    });
  }

  private cancelPendingAnimationFrames(): void {
    const pendingFrames = [...this.pendingAnimationFrames];
    this.pendingAnimationFrames.clear();
    for (const pending of pendingFrames) {
      if (pending.handle !== undefined)
        pending.owner.cancelAnimationFrame(pending.handle);
      pending.resolve(false);
    }
  }

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed); // reaches DocumentAnchorTarget's own willUpdate (declarative `anchor`)
    if (changed.has('src')) {
      // A new document invalidates every previous row/column coordinate -- reset silently (no
      // event), mirroring <lr-pdf-viewer>'s identical src-change reset.
      this.searchQuery = '';
      this.searchMatches = [];
      this.searchMatchCountExact = true;
      this.searchActiveIndex = -1;
      this.activeRowKey = '';
    }
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    this.announcements.transition(
      'load',
      this.fetchState.kind,
      this.fetchState.kind === 'error'
        ? this.fetchState.message
        : this.localize('loadingDocument')
    );
    if (changed.has('src'))
      this.scheduleAfterUpdate(() => {
        void this.load();
      });
    const locale = this.effectiveLocale;
    if (locale !== this.lastSearchLocale) {
      const shouldRecompute = !!this.searchQuery;
      this.lastSearchLocale = locale;
      if (shouldRecompute)
        this.scheduleAfterUpdate(() => {
          void this.search(this.searchQuery);
        }, 'search');
    }
  }

  private async load(): Promise<void> {
    this.lastLoadSrc = this.src;
    const generation = this.loadTask.next();
    const signal = this.beginAbortableLoad();
    if (!this.src) {
      this.fetchState = { kind: 'idle' };
      return;
    }
    const fetchTarget = resolveOwnerFetchTarget(this, this.src);
    if (!fetchTarget) {
      const error = new LyraUserFacingError(
        this.localize('documentPreviewUrlNotAllowed')
      );
      this.fetchState = { kind: 'error', message: error.message };
      this.emit('lr-render-error', { error });
      return;
    }
    this.fetchState = { kind: 'loading' };
    try {
      const response = await fetchTarget.view.fetch(
        fetchTarget.url,
        signal ? { signal } : undefined
      );
      if (!response.ok)
        throw new Error(`${response.status} ${response.statusText}`);
      const library = await this.loadLibrary();
      if (!this.isConnected || !this.loadTask.isCurrent(generation)) return;
      if (!library) {
        const error = new LyraUserFacingError(
          this.localize('csvViewerUnavailable')
        );
        this.fetchState = { kind: 'error', message: error.message };
        this.emit('lr-render-error', { error });
        return;
      }
      const source = await readResponseText(response);
      if (!this.isConnected || !this.loadTask.isCurrent(generation)) return;
      const result = parseDelimitedGrid(library, source);
      if (!this.isConnected || !this.loadTask.isCurrent(generation)) return;
      this.fetchState = { kind: 'loaded', rows: result.data };
      if (this.searchQuery) await this.search(this.searchQuery);
      if (!this.isConnected || !this.loadTask.isCurrent(generation)) return;
      if (result.errors.length)
        this.emit('lr-render-error', { error: result.errors });
    } catch (error) {
      if (
        isAbortError(error) ||
        !this.isConnected ||
        !this.loadTask.isCurrent(generation)
      )
        return;
      this.fetchState = {
        kind: 'error',
        message: this.localize(
          isResourceLimitError(error)
            ? 'documentPreviewResourceTooLarge'
            : 'documentPreviewFailedToLoad'
        ),
      };
      this.emit('lr-render-error', { error });
    }
  }

  // -- cell highlights -----------------------------------------------------------------------------

  /** `rawRow` is 1-based, including the header row when present -- the same raw-file-grid
   *  addressing convention every `cell-range` anchor uses. */
  private cellHighlightsForRow(rawRow: number): ResolvedCellHighlight[] {
    const seen = new Set<string>();
    return this.highlights
      .filter((highlight) => {
        if (seen.has(highlight.id)) return false;
        seen.add(highlight.id);
        return true;
      })
      .flatMap((highlight) => {
        if (highlight.anchor.kind !== 'cell-range' || highlight.anchor.sheet)
          return []; // csv has no sheets
        const parsed = parseCellRange(highlight.anchor.range);
        if (!parsed) return [];
        return rawRow - 1 >= parsed.startRow && rawRow - 1 <= parsed.endRow
          ? [{ highlight, parsed }]
          : [];
      });
  }

  private renderCell(
    value: unknown,
    colIndex: number,
    rowHighlights: ResolvedCellHighlight[],
    role: 'cell' | 'columnheader'
  ): TemplateResult {
    const colHighlights = rowHighlights.filter(
      (entry) =>
        colIndex >= entry.parsed.startCol && colIndex <= entry.parsed.endCol
    );
    if (!colHighlights.length)
      return html`<div part="cell" role=${role}>${cell(value)}</div>`;
    const active = colHighlights.find(
      (entry) => entry.highlight.id === this.activeHighlightId
    );
    const primary = active ?? colHighlights[0]!;
    const text = cell(value);
    const accessibleLabel = primary.highlight.label
      ? this.localize('cellHighlightWithLabel', undefined, {
          value: text,
          label: primary.highlight.label,
        })
      : this.localize('highlightWithLabel', undefined, { label: text });
    const activate = (): void => {
      this.emit('lr-highlight-activate', { highlightId: primary.highlight.id });
    };
    return html`<div
      part="cell cell-highlight"
      role=${role}
      ?data-active=${!!active}
      style=${active
        ? '--_lr-csv-viewer-highlight-color: var(--lr-color-warning, var(--lr-color-brand))'
        : ''}
    >
      <button
        part="cell-highlight-action"
        type="button"
        aria-label=${accessibleLabel}
        @click=${activate}
      >
        ${text}
      </button>
    </div>`;
  }

  private renderRow(
    row: unknown[],
    count: number,
    part: 'header-row' | 'data-row',
    rawRow: number
  ): TemplateResult {
    const rowHighlights = this.cellHighlightsForRow(rawRow);
    const header = part === 'header-row';
    return html`<div
      part=${part}
      role=${header ? 'row' : 'presentation'}
      aria-rowindex=${header ? '1' : nothing}
      style=${`grid-template-columns:repeat(${count},minmax(var(--lr-size-8rem),1fr))`}
    >
      ${Array.from({ length: count }, (_unused, index) =>
        this.renderCell(
          row[index],
          index,
          rowHighlights,
          header ? 'columnheader' : 'cell'
        )
      )}
    </div>`;
  }

  // -- anchor resolution ---------------------------------------------------------------------------

  /** Scrolls raw-grid `(rawRow, col)` into view -- shared by `applyAnchor()` and every search
   *  navigation method, so both stay byte-identical in how a coordinate becomes a scroll. */
  private async jumpToCell(rawRow: number, col: number): Promise<boolean> {
    const loadedState = this.fetchState;
    if (loadedState.kind !== 'loaded') return false;
    const { rows } = loadedState;
    if (rawRow < 1 || rawRow > rows.length || col < 0 || col >= columns(rows))
      return false;
    const bodyIndex = rawRow - 1 - headerOffset(this.hasHeaderRow);
    if (bodyIndex < 0) {
      const target = this.renderRoot
        .querySelector('[part="header-row"]')
        ?.querySelectorAll('[part~="cell"]')[col] as HTMLElement | undefined;
      target?.scrollIntoView({
        behavior: prefersReducedMotion(this.ownerDocument.defaultView)
          ? 'auto'
          : 'smooth',
        block: 'nearest',
        inline: 'nearest',
      });
      return !!target;
    }
    this.activeRowKey = bodyIndex;
    await this.updateComplete;
    await this.scrollColumnIntoView(col);
    // `fetchState` is only ever reassigned by load(), so an identity change across the awaits above
    // means a concurrent `src` reassignment replaced the document mid-jump (a citation/file-tab
    // click landing on top of a still-resolving jump). The coordinate this call resolved belongs to
    // the previous document and nothing was scrolled into view for the current one, so report the
    // failure rather than letting the shared retry loop accept a phantom success and fire
    // `lr-anchor-result: { found: true }`.
    return this.fetchState === loadedState;
  }

  protected async applyAnchor(anchor: LyraAnchor): Promise<boolean> {
    if (anchor.kind !== 'cell-range' || anchor.sheet) return false; // csv has no sheets
    const parsed = parseCellRange(anchor.range);
    if (!parsed) return false;
    return this.jumpToCell(parsed.startRow + 1, parsed.startCol);
  }

  private async scrollColumnIntoView(col: number): Promise<void> {
    const list = this.renderRoot.querySelector('lr-virtual-list') as
      | (HTMLElement & { updateComplete?: Promise<unknown> })
      | null;
    if (list?.updateComplete) await list.updateComplete;
    if (!(await this.waitForOwnerAnimationFrame())) return;
    const row = list?.shadowRoot?.querySelector(
      '[part="row"][aria-current="true"]'
    );
    const target = row?.querySelectorAll('[part~="cell"]')[col] as
      | HTMLElement
      | undefined;
    target?.scrollIntoView({
      behavior: prefersReducedMotion(this.ownerDocument.defaultView)
        ? 'auto'
        : 'smooth',
      block: 'nearest',
      inline: 'nearest',
    });
  }

  // -- search ---------------------------------------------------------------------------------------

  /** Case-insensitive substring search over every raw-grid cell's stringified value (the same
   *  stringification `cell()` renders), ordered row then column -- the header row is included when
   *  present, the same raw-grid convention `cell-range` anchors use. An empty/whitespace-only query
   *  behaves like `clearSearch()` and resolves `0`. Returns at most 1,000 retained matches;
   *  `lr-search-change.detail.matchCountExact=false` identifies that return as a lower bound. */
  async search(query: string): Promise<number> {
    this.searchQuery = query;
    this.lastSearchLocale = this.effectiveLocale;
    const boundedQuery = boundedViewerSearchQuery(query, this.effectiveLocale);
    const trimmed = boundedQuery.needle;
    const matches: { row: number; col: number }[] = [];
    let matchCountExact = boundedQuery.accepted;
    if (boundedQuery.accepted && trimmed && this.fetchState.kind === 'loaded') {
      const budget = new ViewerSearchWorkBudget();
      const { rows } = this.fetchState;
      searchRows: for (let r = 0; r < rows.length; r++) {
        const row = rows[r]!;
        for (let c = 0; c < row.length; c++) {
          if (budget.includes(cell(row[c]), trimmed, this.effectiveLocale)) {
            if (matches.length === MAX_SEARCH_MATCHES) {
              matchCountExact = false;
              break searchRows;
            }
            matches.push({ row: r + 1, col: c });
          }
          if (!budget.complete) {
            matchCountExact = false;
            break searchRows;
          }
        }
      }
    }
    this.searchMatches = matches;
    this.searchMatchCountExact = matchCountExact;
    this.searchActiveIndex = matches.length > 0 ? 0 : -1;
    this.emitSearchChange();
    if (this.searchActiveIndex >= 0)
      await this.jumpToCell(matches[0]!.row, matches[0]!.col);
    return matches.length;
  }

  /** Advances to the next match, wrapping to the first after the last. Resolves `false` (no-op)
   *  when there are no matches. */
  async searchNext(): Promise<boolean> {
    if (!this.searchMatches.length) return false;
    this.searchActiveIndex =
      (this.searchActiveIndex + 1) % this.searchMatches.length;
    this.emitSearchChange();
    const match = this.searchMatches[this.searchActiveIndex]!;
    await this.jumpToCell(match.row, match.col);
    return true;
  }

  /** Moves to the previous match, wrapping to the last before the first. Resolves `false` (no-op)
   *  when there are no matches. */
  async searchPrevious(): Promise<boolean> {
    if (!this.searchMatches.length) return false;
    this.searchActiveIndex =
      (this.searchActiveIndex - 1 + this.searchMatches.length) %
      this.searchMatches.length;
    this.emitSearchChange();
    const match = this.searchMatches[this.searchActiveIndex]!;
    await this.jumpToCell(match.row, match.col);
    return true;
  }

  /** Clears the query, matches, and active index, and resets `lr-search-change` to a
   *  0-match/no-active-index state. */
  clearSearch(): void {
    this.searchQuery = '';
    this.searchMatches = [];
    this.searchMatchCountExact = true;
    this.searchActiveIndex = -1;
    this.emit('lr-search-change', {
      query: '',
      matchCount: 0,
      matchCountExact: true,
      activeIndex: -1,
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

  private stopInternalEvent = (event: Event): void => {
    event.stopPropagation();
  };

  override render(): TemplateResult {
    const label = viewerSemanticLabel(
      this,
      this.name || this.localize('csvViewerLabel')
    );
    let content: TemplateResult;
    if (this.fetchState.kind === 'loaded') {
      const rows = this.fetchState.rows;
      if (!rows.length)
        content = html`<p class="empty-note">${this.localize('noData')}</p>`;
      else {
        const header = this.hasHeaderRow ? rows[0] : undefined;
        const body = this.hasHeaderRow ? rows.slice(1) : rows;
        const count = columns(rows);
        content = html`<div
          part="sheet"
          role="table"
          aria-rowcount=${rows.length}
          aria-colcount=${count}
        >
          ${header
            ? this.renderRow(header, count, 'header-row', 1)
            : nothing}<lr-virtual-list
            part="rows"
            exportparts="data-row:data-row, cell:cell, cell-highlight:cell-highlight, cell-highlight-action:cell-highlight-action"
            .items=${body}
            .renderItem=${(row: unknown, index: number) =>
              this.renderRow(
                row as unknown[],
                count,
                'data-row',
                index + 1 + headerOffset(this.hasHeaderRow)
              )}
            .keyFunction=${(_item: unknown, index: number) => index}
            .activeId=${this.activeRowKey}
            item-role="row"
            row-index-offset=${this.hasHeaderRow ? '1' : '0'}
            @lr-load-more=${this.stopInternalEvent}
            @lr-visible-range-changed=${this.stopInternalEvent}
            @lr-virtual-scroll=${this.stopInternalEvent}
          ></lr-virtual-list>
        </div>`;
      }
    } else if (this.fetchState.kind === 'loading')
      content = renderViewerLoading(this.localize('loadingDocument'));
    else if (this.fetchState.kind === 'error')
      content = html`<div part="error">${this.fetchState.message}</div>`;
    else
      content = html`<p class="empty-note">
        ${this.localize('documentPreviewEmpty', undefined, {
          type: this.localize('documentPreviewTypeDocument'),
        })}
      </p>`;
    const maxHeight = sanitizeCssLength(this.maxHeight);
    return html`<div
      part="base"
      role=${viewerSemanticRole(this, 'region') ?? nothing}
      style=${maxHeight
        ? styleMap({ '--lr-csv-viewer-max-height': maxHeight })
        : nothing}
      aria-label=${label ?? nothing}
      aria-busy=${this.fetchState.kind === 'loading' ? 'true' : 'false'}
    >
      <div part="body">${content}</div>
      ${this.renderAnchorLiveRegion()}
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-csv-viewer': LyraCsvViewer;
  }
}
