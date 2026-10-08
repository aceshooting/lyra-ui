import { html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import { styleMap } from 'lit/directives/style-map.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { tag } from '../../../internal/prefix.js';
import {
  isAbortError,
  isResourceLimitError,
  LyraUserFacingError,
  readResponseText,
  resolveOwnerFetchTarget,
} from '../../../internal/resource-loader.js';
import { hostAriaLabel, srOnly } from '../../../internal/a11y.js';
import { TableViewerController, type ResolvedCellHighlight } from '../table-viewer-shared.js';
import {
  DocumentAnchorTarget,
  type LyraAnchorTargetEventMap,
} from '../../../internal/anchor-target.js';
import { parseCellRange } from '../../../internal/cell-range.js';
import type { LyraAnchor, LyraAnchorKind } from '../document-viewer/anchors.js';
import {
  loadPapaParseCached,
  type PapaParseApi,
} from '../../../internal/papaparse-loader.js';
import { styles } from './csv-viewer.styles.js';
import {
  delimitedCellText as cell,
  delimitedColumnCount as columns,
  parseDelimitedGrid,
} from '../../../internal/delimited-data.js';
import { LatestTask } from '../../../internal/latest-task.js';
import { sanitizeCssLength } from '../../../internal/safe-css.js';
import type { LyraViewerDiagnosticEventDetail } from '../viewer-diagnostics.js';
export type {
  LyraViewerDiagnostic,
  LyraViewerDiagnosticCode,
  LyraViewerDiagnosticEventDetail,
  LyraViewerDiagnosticSeverity,
} from '../viewer-diagnostics.js';
import { renderViewerLoading, viewerLoadingStyles } from '../viewer-loading.js';
import {
  viewerSemanticLabel,
  viewerSemanticRole,
} from '../viewer-semantic-owner.js';
import type { LyraSearchChangeDetail } from '../../../internal/text-viewer-target.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_anchorJumped, LYRA_DEFAULT_anchorJumpedToPage, LYRA_DEFAULT_anchorNotFound, LYRA_DEFAULT_cellHighlightWithLabel, LYRA_DEFAULT_collapse, LYRA_DEFAULT_copy, LYRA_DEFAULT_csvViewerLabel, LYRA_DEFAULT_csvViewerUnavailable, LYRA_DEFAULT_details, LYRA_DEFAULT_documentPreviewEmpty, LYRA_DEFAULT_documentPreviewFailedToLoad, LYRA_DEFAULT_documentPreviewResourceTooLarge, LYRA_DEFAULT_documentPreviewTypeDocument, LYRA_DEFAULT_documentPreviewUrlNotAllowed, LYRA_DEFAULT_highlightWithLabel, LYRA_DEFAULT_loading, LYRA_DEFAULT_loadingDocument, LYRA_DEFAULT_map, LYRA_DEFAULT_navigation, LYRA_DEFAULT_noData, LYRA_DEFAULT_open, LYRA_DEFAULT_search, LYRA_DEFAULT_select, LYRA_DEFAULT_viewerSearchActiveMatch, LYRA_DEFAULT_viewerSearchMatchCount, LYRA_DEFAULT_viewerSearchNoMatches } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END

type CsvState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'loaded'; rows: unknown[][] }
  | { kind: 'error'; message: string };

/** A rendered header row shifts every raw-grid (1-based, header row included) row number down by
 *  one to reach the matching index into the virtualized body array. */
function headerOffset(hasHeaderRow: boolean): number {
  return hasHeaderRow ? 1 : 0;
}

/** A stable, module-level `<lr-virtual-list>.keyFunction` -- a fresh closure identity on every
 *  render() would defeat the virtual list's own offset-cache memoization (see its
 *  `.items`/`.renderItem` doc in render() below) on every unrelated re-render (a search keystroke,
 *  active-row change, locale change), not just on data changes. */
function indexKeyFunction(_item: unknown, index: number): number {
  return index;
}

export interface LyraCsvViewerEventMap
  extends Omit<LyraAnchorTargetEventMap, 'lr-text-select'> {
  'lr-render-error': CustomEvent<{ error: unknown }>;
  'lr-viewer-diagnostic': CustomEvent<LyraViewerDiagnosticEventDetail>;
  /** Fired whenever the search query, match count, or active match index changes, from
   *  `search()`/`searchNext()`/`searchPrevious()`/`clearSearch()`. */
  'lr-search-change': CustomEvent<LyraSearchChangeDetail>;
}

class LyraCsvViewerBase extends LyraElement<LyraCsvViewerEventMap> {}

/**
 * Fetches CSV text, parses quoted fields with PapaParse, and virtualizes its rows.
 *
 * Adopts `DocumentAnchorTarget`: a `cell-range` anchor addresses the raw file grid, 1-based, with
 * the header row included unless `without-header-row` is set (matching how a spreadsheet app itself
 * labels `A1`) -- `scrollToAnchor()` scrolls the addressed row into view via the virtualized list's
 * `active-item-id`, then scrolls the first addressed column horizontally into view. A `sheet`-qualified
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
 * @event lr-render-error - Fired when fetching or parsing fails, a parser is unavailable, or the
 *   bounded parse exceeds a resource ceiling.
 * @event lr-viewer-diagnostic - Structured, non-fatal PapaParse diagnostics when a partial grid
 *   remains rendered. `detail.diagnostic.cause` contains the bounded diagnostic array.
 * @event lr-highlight-activate - A `highlights` cell was clicked, or activated via Enter/Space
 *   while focused. `detail: { highlightId }`.
 * @event lr-anchor-result - Fired after an `anchor` property assignment or a `scrollToAnchor()`
 *   call is applied. `detail: { found }`.
 * @event lr-search-change - Fired whenever the search query, match count, or active match index
 *   changes, including source-reset and effective-locale re-evaluation. `detail: { query,
 *   matchCount, matchCountExact, activeIndex }`. Search accepts at most 4,096 query code units,
 *   scans at most 4,000,000 cell code units, and retains at most 1,000 matches;
 *   `matchCountExact=false` identifies a ceiling-truncated lower bound.
 * @csspart base - The root wrapper with explicit `aria-busy` loading state.
 * @csspart body - The wrapper around the fetched-state content, capped by `max-height`; the nested
 *   virtual-list remains the data-row scrollport within that allocation.
 * @csspart sheet - The named `role="table"` wrapper around the header row and virtualized body.
 * @csspart rows - The virtualized row list.
 * @csspart header-row - The persistent header above the virtualized row scrollport, rendered unless
 *   `without-header-row` is set.
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
 * @cssprop [--lr-csv-viewer-max-height=none] - Maximum block size allocated to `[part="body"]`;
 *   the nested virtual-list scrolls data rows within the remainder below the persistent header.
 *   The `maxHeight` property sets this token inline on `[part="base"]`.
 * @status stable
 * @since 4.0.0
 */
export class LyraCsvViewer extends DocumentAnchorTarget(LyraCsvViewerBase) {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    anchorJumped: LYRA_DEFAULT_anchorJumped,
    anchorJumpedToPage: LYRA_DEFAULT_anchorJumpedToPage,
    anchorNotFound: LYRA_DEFAULT_anchorNotFound,
    cellHighlightWithLabel: LYRA_DEFAULT_cellHighlightWithLabel,
    collapse: LYRA_DEFAULT_collapse,
    copy: LYRA_DEFAULT_copy,
    csvViewerLabel: LYRA_DEFAULT_csvViewerLabel,
    csvViewerUnavailable: LYRA_DEFAULT_csvViewerUnavailable,
    details: LYRA_DEFAULT_details,
    documentPreviewEmpty: LYRA_DEFAULT_documentPreviewEmpty,
    documentPreviewFailedToLoad: LYRA_DEFAULT_documentPreviewFailedToLoad,
    documentPreviewResourceTooLarge: LYRA_DEFAULT_documentPreviewResourceTooLarge,
    documentPreviewTypeDocument: LYRA_DEFAULT_documentPreviewTypeDocument,
    documentPreviewUrlNotAllowed: LYRA_DEFAULT_documentPreviewUrlNotAllowed,
    highlightWithLabel: LYRA_DEFAULT_highlightWithLabel,
    loading: LYRA_DEFAULT_loading,
    loadingDocument: LYRA_DEFAULT_loadingDocument,
    map: LYRA_DEFAULT_map,
    navigation: LYRA_DEFAULT_navigation,
    noData: LYRA_DEFAULT_noData,
    open: LYRA_DEFAULT_open,
    search: LYRA_DEFAULT_search,
    select: LYRA_DEFAULT_select,
    viewerSearchActiveMatch: LYRA_DEFAULT_viewerSearchActiveMatch,
    viewerSearchMatchCount: LYRA_DEFAULT_viewerSearchMatchCount,
    viewerSearchNoMatches: LYRA_DEFAULT_viewerSearchNoMatches,
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
  /** Renders the first parsed row as an ordinary data row instead of the persistent header. */
  @property({ type: Boolean, attribute: 'without-header-row' }) withoutHeaderRow = false;
  /** CSS length that caps the scrollable body; invalid values are ignored. */
  @property({ attribute: 'max-height' }) maxHeight = '';

  /** Anchor kinds this viewer resolves via `scrollToAnchor()`. */
  override readonly anchorKinds: readonly LyraAnchorKind[] = ['cell-range'];

  @state() private fetchState: CsvState = { kind: 'idle' };
  private loadTask = new LatestTask();
  private loadLibrary: () => Promise<PapaParseApi | null> = loadPapaParseCached;
  // @renderController TableViewerController
  private readonly table = new TableViewerController<{ row: number; col: number }>(this, {
    emitSearch: (detail) => this.emit('lr-search-change', detail),
    emitActivate: (highlightId) => this.emit('lr-highlight-activate', { highlightId }),
    localize: (key, fallback, values) => this.localize(key, fallback, values),
    locale: () => this.effectiveLocale,
    schedule: (callback, key) => this.scheduleAfterUpdate(callback, key),
    load: () => this.load(),
    research: (query) => this.search(query),
    jump: (match) => this.jumpToCell(match.row, match.col),
    teardown: () => this.loadTask.next(),
  });

  override connectedCallback(): void {
    super.connectedCallback();
    this.table.connected();
  }

  override disconnectedCallback(): void {
    this.table.disconnecting();
    super.disconnectedCallback();
    this.table.disconnected();
  }

  override adoptedCallback(): void {
    super.adoptedCallback();
    this.table.adopted();
  }

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed); // reaches DocumentAnchorTarget's own willUpdate (declarative `anchor`)
    this.table.willUpdate(changed, this.highlights, this.activeHighlightId, false); // csv has no sheets
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    this.table.updated(changed, this.fetchState);
  }

  private async load(): Promise<void> {
    this.table.lastLoadSrc = this.src;
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
      if (this.table.search.query) await this.search(this.table.search.query);
      if (!this.isConnected || !this.loadTask.isCurrent(generation)) return;
      if (result.errors.length) {
        this.emit('lr-viewer-diagnostic', {
          diagnostic: Object.freeze({
            code: 'delimited-parse-diagnostic',
            severity: 'warning',
            fatal: false,
            source: 'papaparse',
            cause: result.errors,
          } as const),
        });
      }
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

  private renderCell(
    value: unknown,
    colIndex: number,
    rowHighlights: ResolvedCellHighlight[],
    role: 'cell' | 'columnheader'
  ): TemplateResult {
    return this.table.renderCell(
      cell(value), colIndex, rowHighlights, role, 'cell',
      '--_lr-csv-viewer-highlight-color', this.activeHighlightId,
    );
  }

  private renderRow(
    row: unknown[],
    count: number,
    part: 'header-row' | 'data-row',
    rawRow: number
  ): TemplateResult {
    const rowHighlights = this.table.highlightsForRow(rawRow);
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
    const bodyIndex = rawRow - 1 - headerOffset(!this.withoutHeaderRow);
    if (bodyIndex < 0) {
      return this.table.revealCell(this.renderRoot
        .querySelector('[part="header-row"]')
        ?.querySelectorAll('[part~="cell"]')[col] as HTMLElement | undefined);
    }
    this.table.setActiveRow(bodyIndex);
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

  protected override async applyAnchor(anchor: LyraAnchor): Promise<boolean> {
    if (anchor.kind !== 'cell-range' || anchor.sheet) return false; // csv has no sheets
    const parsed = parseCellRange(anchor.range);
    if (!parsed) return false;
    return this.jumpToCell(parsed.startRow + 1, parsed.startCol);
  }

  private async scrollColumnIntoView(col: number): Promise<void> {
    await this.table.scrollColumnIntoView(this.renderRoot, tag('virtual-list'), col);
  }

  // -- search ---------------------------------------------------------------------------------------

  /** Case-insensitive substring search over every raw-grid cell's stringified value (the same
   *  stringification `cell()` renders), ordered row then column -- the header row is included when
   *  present, the same raw-grid convention `cell-range` anchors use. An empty/whitespace-only query
   *  behaves like `clearSearch()` and resolves `0`. Returns at most 1,000 retained matches;
   *  `lr-search-change.detail.matchCountExact=false` identifies that return as a lower bound. */
  async search(query: string): Promise<number> {
    return this.table.runSearch(query, this.fetchState.kind === 'loaded', (visit) => {
      if (this.fetchState.kind !== 'loaded') return;
      const { rows } = this.fetchState;
      for (let r = 0; r < rows.length; r++) {
        const row = rows[r]!;
        for (let c = 0; c < row.length; c++)
          if (!visit(cell(row[c]), { row: r + 1, col: c })) return;
      }
    });
  }

  /** Advances to the next match, wrapping to the first after the last. Resolves `false` (no-op)
   *  when there are no matches. */
  async searchNext(): Promise<boolean> {
    return this.table.step(1);
  }

  /** Moves to the previous match, wrapping to the last before the first. Resolves `false` (no-op)
   *  when there are no matches. */
  async searchPrevious(): Promise<boolean> {
    return this.table.step(-1);
  }

  /** Clears the query, matches, and active index, and resets `lr-search-change` to a
   *  0-match/no-active-index state. */
  clearSearch(): void {
    this.table.clearSearch();
  }

  private stopInternalEvent = (event: Event): void => {
    event.stopPropagation();
  };

  /** Memoized `<lr-virtual-list>.items`, keyed on the exact `rows` array reference and whether the
   *  header row renders: a fresh `body` array on every render() (a search keystroke, active-row
   *  change, locale change) would defeat the virtual list's offset-cache memoization and force its
   *  O(n) `recomputeOffsets()`. `renderItem` stays fresh per render so a highlight or search-state
   *  change repaints the visible rows, as in the dataset and spreadsheet viewers. */
  private virtualListInputsCache?: {
    rows: unknown[][];
    hasHeaderRow: boolean;
    body: unknown[][];
    count: number;
  };

  private virtualListInputs(
    rows: unknown[][],
    hasHeaderRow: boolean
  ): { body: unknown[][]; renderItem: (row: unknown, index: number) => TemplateResult } {
    let cached = this.virtualListInputsCache;
    if (!cached || cached.rows !== rows || cached.hasHeaderRow !== hasHeaderRow) {
      cached = {
        rows,
        hasHeaderRow,
        body: hasHeaderRow ? rows.slice(1) : rows,
        count: columns(rows),
      };
      this.virtualListInputsCache = cached;
    }
    const { body, count } = cached;
    return {
      body,
      renderItem: (row, index) =>
        this.renderRow(row as unknown[], count, 'data-row', index + 1 + headerOffset(hasHeaderRow)),
    };
  }

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
        const hasHeaderRow = !this.withoutHeaderRow;
        const header = hasHeaderRow ? rows[0] : undefined;
        const count = columns(rows);
        const { body, renderItem } = this.virtualListInputs(
          rows,
          hasHeaderRow
        );
        const tableLabel = hostAriaLabel(this)
          ?? (this.name || this.localize('csvViewerLabel'));
        content = html`<div
          part="sheet"
          role="table"
          aria-label=${tableLabel}
          aria-rowcount=${rows.length}
          aria-colcount=${count}
        >
          ${header
            ? this.renderRow(header, count, 'header-row', 1)
            : nothing}<lr-virtual-list
            part="rows"
            exportparts="data-row:data-row, cell:cell, cell-highlight:cell-highlight, cell-highlight-action:cell-highlight-action"
            .items=${body}
            .renderItem=${renderItem}
            .keyFunction=${indexKeyFunction}
            .activeItemId=${this.table.activeRowKey}
            item-role="row"
            row-index-offset=${hasHeaderRow ? '1' : '0'}
            @lr-load-more=${this.stopInternalEvent}
            @lr-visible-range-change=${this.stopInternalEvent}
            @lr-virtual-scroll=${this.stopInternalEvent}
          ></lr-virtual-list>
        </div>`;
      }
    } else if (this.fetchState.kind === 'loading')
      content = renderViewerLoading(this.localize('loadingDocument'));
    else if (this.fetchState.kind === 'error')
      content = html`<div part="error">${this.fetchState.message}</div>`;
    else
      content = html`<p class="empty-note">${this.localize(
        'documentPreviewEmpty',
        undefined,
        { type: this.localize('documentPreviewTypeDocument') }
      )}</p>`;
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
