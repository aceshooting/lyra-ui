import type { LyraTabularSource } from '../../../data-sources.js';
export type { LyraTabularColumn, LyraSourceCell, LyraTabularHit, LyraTabularReadRequest, LyraSourceSearchRequest, LyraSourceSearchResult } from '../../../data-sources.js';
/** Host-owned indexed or rectangular source for this viewer. */
export type CsvViewerSource = LyraTabularSource;
import { finiteCount } from '../../../internal/numbers.js';
import { snapshotViewerRows } from '../../../internal/delimited-data.js';
import { html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import { guard } from 'lit/directives/guard.js';
import { styleMap } from 'lit/directives/style-map.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { tag } from '../../../internal/prefix.js';
import {
  isAbortError,
  isResourceLimitError,
  LyraUserFacingError,
  readResponseText,
  resolveOwnerFetchTarget,
  yieldViewerTask,
} from '../../../internal/resource-loader.js';
import { hostAriaLabel, srOnly } from '../../../internal/a11y.js';
import { TableViewerSourceController, TableViewerController, type ResolvedCellHighlight } from '../table-viewer-shared.js';
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
  parseDelimitedGridYielding,
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
import { LYRA_DEFAULT_anchorJumped, LYRA_DEFAULT_anchorJumpedToPage, LYRA_DEFAULT_anchorNotFound, LYRA_DEFAULT_collapse, LYRA_DEFAULT_copy, LYRA_DEFAULT_date, LYRA_DEFAULT_details, LYRA_DEFAULT_documentPreviewEmpty, LYRA_DEFAULT_highlightWithLabel, LYRA_DEFAULT_loading, LYRA_DEFAULT_map, LYRA_DEFAULT_navigation, LYRA_DEFAULT_noData, LYRA_DEFAULT_open, LYRA_DEFAULT_search, LYRA_DEFAULT_select, LYRA_DEFAULT_sourceSearchUnavailable, LYRA_DEFAULT_viewerSearchActiveMatch, LYRA_DEFAULT_viewerSearchMatchCount, LYRA_DEFAULT_viewerSearchNoMatches } from '../../../internal/default-strings/shared.generated.js';
import { LYRA_DEFAULT_cellHighlightWithLabel, LYRA_DEFAULT_csvViewerLabel, LYRA_DEFAULT_csvViewerUnavailable, LYRA_DEFAULT_documentPreviewFailedToLoad, LYRA_DEFAULT_documentPreviewResourceTooLarge, LYRA_DEFAULT_documentPreviewTypeDocument, LYRA_DEFAULT_documentPreviewUrlNotAllowed, LYRA_DEFAULT_loadingDocument } from '../../../internal/default-strings/viewers.generated.js';
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
 * By default, a quote-aware structural scan enforces the 10,000-raw-row, 1,000-column, 1,000,000-cell, and
 * 100-diagnostic ceilings before PapaParse can materialize an amplified result. The peer then runs
 * with streaming row callbacks and the same limits as a second boundary.
 *
 * Row and column ceilings default to 10,000 and 1,000; maxRows/maxColumns can raise them to
 * 100,000 and 10,000. maxBytes defaults to 25 MiB and is bounded at 250 MiB. The 1,000,000-cell
 * ceiling remains independent. The owned `rows` input bypasses fetch and peer parsing; undefined
 * restores src. Header and body columns are windowed together, and anchors reveal hidden columns.
 * Remote parsing yields between admission/materialization passes; parsing itself remains synchronous.
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
 * @csspart search-status - Notice when a data source has no global search capability.
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
    date: LYRA_DEFAULT_date,
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
    sourceSearchUnavailable: LYRA_DEFAULT_sourceSearchUnavailable,
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

  protected static override readonly identityCollectionObjectProperties = Object.freeze(['dataSource']);
  private _dataSource?: CsvViewerSource;
  /** Optional host-owned full logical source. Takes precedence over legacy inputs; undefined restores
   * them. Reassign, including the same source, or call requestUpdate() after source mutation.
   * Source rows use fixed live --lr-size-3rem geometry; legacy row sizing is unchanged.
   * Column labels are separate from body rows; body row zero appears at display row one without a header and row two with a header.
   * Global search requires the source search capability. */
  @property({ attribute: false, noAccessor: true, hasChanged: () => true })
  get dataSource(): CsvViewerSource | undefined { return this._dataSource; }
  set dataSource(value: CsvViewerSource | undefined) {
    const previous = this._dataSource;
    this._dataSource = value;
    this.provider?.refresh();
    this.loadTask?.next();
    this.beginAbortableLoad();
    this.requestUpdate('dataSource', previous);
  }

  override requestUpdate(...args: Parameters<LyraElement['requestUpdate']>): void {
    if (args[0] === undefined && this._dataSource !== undefined) this.provider?.refresh();
    super.requestUpdate(...args);
  }

  /** URL to fetch and parse. */
  @property() src = '';

  /** Maximum admitted rows; defaults to 10,000 and can be raised to 100,000. */
  @property({ type: Number, attribute: 'max-rows' }) maxRows = 10000;
  /** Maximum admitted columns; defaults to 1,000 and can be raised to 10,000. */
  @property({ type: Number, attribute: 'max-columns' }) maxColumns = 1000;
  /** Maximum source bytes; defaults to 25 MiB and can be raised to 250 MiB. */
  @property({ type: Number, attribute: 'max-bytes' }) maxBytes = 26214400;
  private get effectiveMaxRows(): number { return Math.max(1, finiteCount(this.maxRows, 10000, 100000)); }
  private get effectiveMaxColumns(): number { return Math.max(1, finiteCount(this.maxColumns, 1000, 10000)); }
  private get effectiveMaxBytes(): number { return Math.max(1, finiteCount(this.maxBytes, 26214400, 262144000)); }
  private get parseLimits(): { maxRows: number; maxColumns: number } { return { maxRows: this.effectiveMaxRows, maxColumns: this.effectiveMaxColumns }; }
  private inputError: unknown;
  private inputSource?: WeakRef<object>;
  private inputLimits = '';
  private get currentInputLimits(): string { return `${this.effectiveMaxRows}:${this.effectiveMaxColumns}:${this.effectiveMaxBytes}`; }
  private _rows: unknown[][] | undefined;
  /** Owned scalar-cell grid, including its header. Takes precedence over src; undefined restores fetching.
   * Invalid or oversized inputs produce lr-render-error and the localized error state. Replace the array to refresh. */
  @property({ attribute: false, noAccessor: true })
  get rows(): unknown[][] | undefined { return this._rows; }
  set rows(value: unknown[][] | undefined) {
    const limits = this.currentInputLimits;
    if (limits === this.inputLimits && (value === this._rows || (value !== undefined && value === this.inputSource?.deref()))) return;
    const previous = this._rows;
    this.inputLimits = limits;
    this.inputSource = undefined;
    this.inputError = undefined;
    try {
      this._rows = value === undefined ? undefined : snapshotViewerRows(value, this.effectiveMaxRows, this.effectiveMaxColumns, this.effectiveMaxBytes);
      if (value !== undefined) this.inputSource = new WeakRef(value);
    }
    catch (error) { this._rows = []; this.inputError = error; }
    this.requestUpdate('rows', previous);
  }

  /** Source filename or display name used on the shadow viewer owner when host `aria-label` is
   *  absent. A non-empty host label remains on the host; an explicitly empty one is preserved on
   *  the shadow owner. */
  @property() name = '';
  private _withoutHeaderRow = false;
  /** Renders the first parsed row as an ordinary data row instead of the persistent header.
   * In source mode, hides the separate labels and clears search/navigation coordinates.
   * @default false
   */
  @property({ type: Boolean, attribute: 'without-header-row', noAccessor: true })
  get withoutHeaderRow(): boolean { return this._withoutHeaderRow; }
  set withoutHeaderRow(value: boolean) {
    const previous = this._withoutHeaderRow;
    if (value === previous) return;
    this._withoutHeaderRow = value;
    if (this.provider?.enabled) this.provider.clearSearch();
    this.requestUpdate('withoutHeaderRow', previous);
  }
  /** CSS length that caps the scrollable body; invalid values are ignored. */
  @property({ attribute: 'max-height' }) maxHeight = '';

  /** Anchor kinds this viewer resolves via `scrollToAnchor()`. */
  override readonly anchorKinds: readonly LyraAnchorKind[] = ['cell-range'];

  @state() private fetchState: CsvState = { kind: 'idle' };
  private loadTask = new LatestTask();
  private loadLibrary: () => Promise<PapaParseApi | null> = loadPapaParseCached;
  // @renderController TableViewerController
  private readonly table = new TableViewerController<{ row: number; col: number }>(this, {
    repaint: () => super.requestUpdate(),
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

  // @renderController TableViewerSourceController
  private readonly provider = new TableViewerSourceController(this, this.table, {
    source: () => this.dataSource,
    cancelAnchor: () => this.cancelPendingAnchor(),
    workbook: false,
    header: () => !this.withoutHeaderRow,
    columnLimit: () => this.effectiveMaxColumns,
    locale: () => this.effectiveLocale,
    localize: key => this.localize(key),
    repaint: () => super.requestUpdate(),
    error: error => {
      if (this.hasUpdated) this.table.announcements.announceAssertive(this.localize(isResourceLimitError(error) ? 'documentPreviewResourceTooLarge' : 'documentPreviewFailedToLoad'));
      this.emit('lr-render-error', { error });
    },
    emitSearch: detail => this.emit('lr-search-change', detail),
    format: value => value == null ? '' : String(value),
    label: () => hostAriaLabel(this) ?? (this.name || this.localize('csvViewerLabel')),
    colorVar: '--_lr-csv-viewer-highlight-color',
    headerPart: 'cell',
    activeHighlight: () => this.activeHighlightId,
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
    this.provider.adopted();
    this.table.adopted();
  }

  protected override willUpdate(changed: PropertyValues): void {
    this.provider.update();
    super.willUpdate(changed); // reaches DocumentAnchorTarget's own willUpdate (declarative `anchor`)
    this.table.willUpdate(changed, this.highlights, this.activeHighlightId, false); // csv has no sheets
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    this.table.updated(changed, this.fetchState);
  }

  private async load(): Promise<void> {
    if (this.dataSource !== undefined) return;
    this.table.lastLoadSrc = this.src;
    const generation = this.loadTask.next();
    const signal = this.beginAbortableLoad();
    if (this._rows !== undefined) {
      try {
        if (this.inputError) throw this.inputError;
        if (this.inputLimits !== this.currentInputLimits) {
          this._rows = snapshotViewerRows(this._rows, this.effectiveMaxRows, this.effectiveMaxColumns, this.effectiveMaxBytes);
          this.inputLimits = this.currentInputLimits;
        }
        const rows = this._rows;
        this.fetchState = { kind: 'loaded', rows };
      } catch (error) { this.fetchState = { kind: 'error', message: this.localize(isResourceLimitError(error) ? 'documentPreviewResourceTooLarge' : 'documentPreviewFailedToLoad') }; this.emit('lr-render-error', { error }); }
      return;
    }
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
      if (!this.isConnected || !this.loadTask.isCurrent(generation)) return;
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
      const source = await readResponseText(response, this.effectiveMaxBytes);
      if (!this.isConnected || !this.loadTask.isCurrent(generation)) return;
      const result = await parseDelimitedGridYielding(library, source, this.parseLimits, () => yieldViewerTask(this.ownerDocument.defaultView, () => this.isConnected && this.loadTask.isCurrent(generation)));
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
    const window = this.table.columnWindow(this.fetchState, count);
    const rowHighlights = this.table.highlightsForRow(rawRow);
    const header = part === 'header-row';
    return html`<div
      part=${part}
      role=${header ? 'row' : 'presentation'}
      aria-rowindex=${header ? '1' : nothing}
      style=${window.style}
    >
      ${guard([row, window.columns, rowHighlights, this.activeHighlightId, this.effectiveLocale, this.strings, this.localize('highlightWithLabel'), this.localize('cellHighlightWithLabel')], () => window.columns.map((index) =>
        this.renderCell(
          row[index],
          index,
          rowHighlights,
          header ? 'columnheader' : 'cell'
        )
      ))}
    </div>`;
  }

  // -- anchor resolution ---------------------------------------------------------------------------

  /** Scrolls raw-grid `(rawRow, col)` into view -- shared by `applyAnchor()` and every search
   *  navigation method, so both stay byte-identical in how a coordinate becomes a scroll. */
  private async jumpToCell(rawRow: number, col: number): Promise<boolean> {
    const loadedState = this.fetchState;
    if (loadedState.kind !== 'loaded') return false;
    const ownerDocument = this.ownerDocument;
    const isCurrent = (): boolean => this.isConnected && this.ownerDocument === ownerDocument && this.fetchState === loadedState;
    const { rows } = loadedState;
    this.virtualListInputs(rows, !this.withoutHeaderRow);
    if (rawRow < 1 || rawRow > rows.length || col < 0 || col >= this.virtualListInputsCache!.count)
      return false;
    await this.table.showColumn(this.fetchState, col, this.renderRoot.querySelector('[part="sheet"]'));
    if (!isCurrent()) return false;
    const bodyIndex = rawRow - 1 - headerOffset(!this.withoutHeaderRow);
    if (bodyIndex < 0) {
      return this.table.revealCell(this.renderRoot
        .querySelector('[part="header-row"]')
        ?.querySelector(`[aria-colindex="${col + 1}"]`) as HTMLElement | undefined);
    }
    this.table.setActiveRow(bodyIndex);
    await this.updateComplete;
    if (!isCurrent()) return false;
    await this.scrollColumnIntoView(col);
    if (!isCurrent()) return false;
    // `fetchState` is only ever reassigned by load(), so an identity change across the awaits above
    // means a concurrent `src` reassignment replaced the document mid-jump (a citation/file-tab
    // click landing on top of a still-resolving jump). The coordinate this call resolved belongs to
    // the previous document and nothing was scrolled into view for the current one, so report the
    // failure rather than letting the shared retry loop accept a phantom success and fire
    // `lr-anchor-result: { found: true }`.
    return isCurrent();
  }

  protected override async applyAnchor(anchor: LyraAnchor): Promise<boolean> {
    if (this.dataSource !== undefined) return this.provider.revealAnchor(anchor);
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
    if (this.dataSource !== undefined) return this.provider.search(query);
    return this.table.runSearch(query, this.fetchState.kind === 'loaded', (visit) => {
      if (this.fetchState.kind !== 'loaded') return;
      const { rows } = this.fetchState;
      for (let r = 0; r < rows.length; r++) {
        const row = rows[r]!;
        for (let c = 0; c < row.length; c++)
          if (!visit(cell(row[c]), { row: r + 1, col: c })) return;
      }
    }, this.fetchState);
  }

  /** Advances to the next match, wrapping to the first after the last. Resolves `false` (no-op)
   *  when there are no matches. */
  async searchNext(): Promise<boolean> {
    if (this.dataSource !== undefined) return this.provider.step(1);
    return this.table.step(1);
  }

  /** Moves to the previous match, wrapping to the last before the first. Resolves `false` (no-op)
   *  when there are no matches. */
  async searchPrevious(): Promise<boolean> {
    if (this.dataSource !== undefined) return this.provider.step(-1);
    return this.table.step(-1);
  }

  /** Clears the query, matches, and active index, and resets `lr-search-change` to a
   *  0-match/no-active-index state. */
  clearSearch(): void {
    if (this.dataSource !== undefined) { this.provider.clearSearch(); return; }
    this.table.clearSearch();
  }

  private stopInternalEvent = (event: Event): void => {
    event.stopPropagation();
  };

  /** Memoized `<lr-virtual-list>.items`, keyed on the exact `rows` array reference and whether the
   *  header row renders: a fresh `body` array on every render() (a search keystroke, active-row
   *  change, locale change) would defeat the virtual list's offset-cache memoization and force its
   *  O(n) `recomputeOffsets()`. `renderItem` changes only when cell output changes; active-row navigation retains it. */
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
      renderItem: this.table.rowRenderer(rows, [count, hasHeaderRow, this.table.columnWindow(this.fetchState, count).columns, this.activeHighlightId, this.strings], (row, index) =>
        this.renderRow(row as unknown[], count, 'data-row', index + 1 + headerOffset(hasHeaderRow))),
    };
  }

  override render(): TemplateResult {
    const label = viewerSemanticLabel(
      this,
      this.name || this.localize('csvViewerLabel')
    );
    let content: TemplateResult;
    if (this.dataSource !== undefined) content = this.provider.render();
    else if (this.fetchState.kind === 'loaded') {
      const rows = this.fetchState.rows;
      if (!rows.length)
        content = html`<p class="empty-note">${this.localize('noData')}</p>`;
      else {
        const hasHeaderRow = !this.withoutHeaderRow;
        const header = hasHeaderRow ? rows[0] : undefined;
        const { body, renderItem } = this.virtualListInputs(
          rows,
          hasHeaderRow
        );
        const count = this.virtualListInputsCache!.count;
        const tableLabel = hostAriaLabel(this)
          ?? (this.name || this.localize('csvViewerLabel'));
        content = html`<div
          part="sheet"
          @scroll=${(event: Event) => this.table.scrollColumns(this.fetchState, event.currentTarget as HTMLElement)}
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
            .items=${body.length <= 10000 ? body : nothing}
            .source=${this.table.indexedSource(body)}
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
      aria-busy=${(this.dataSource !== undefined ? this.provider.busy : this.fetchState.kind === 'loading') ? 'true' : 'false'}
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
