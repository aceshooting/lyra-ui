import { viewerFailureMessage } from '../../../internal/viewer-failure-message.js';
import { formatChartValue } from '../../../internal/chart-number-format.js';
import { ViewerSourceController, ViewerSourceUrlNotAllowedError, type ViewerSourceToken } from '../../../internal/viewer-source-controller.js';
import type { LyraWorkbookSource } from '../../../data-sources.js';
export type { LyraTabularColumn, LyraSourceCell, LyraTabularHit, LyraTabularReadRequest, LyraSourceSearchRequest, LyraSourceSearchResult, LyraWorkbookHit } from '../../../data-sources.js';
/** Host-owned indexed or rectangular source for this viewer. */
export type SpreadsheetViewerSource = LyraWorkbookSource;
import { TabularInputSnapshot, tabularInputLimits, type TabularInputLimits } from '../../../internal/tabular-viewer-target.js';
import { snapshotViewerRows, ownTableValue } from '../../../internal/delimited-data.js';
import { html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import { guard } from 'lit/directives/guard.js';
import { styleMap } from 'lit/directives/style-map.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { tag } from '../../../internal/prefix.js';
import { srOnly } from '../../../internal/a11y.js';
import {
  assertTableDimensions,
  DEFAULT_MAX_RESOURCE_BYTES,
  isResourceLimitError,
  LyraResourceLimitError,
  LyraUserFacingError,
  yieldViewerTask,
} from '../../../internal/resource-loader.js';
import { sanitizeCssLength } from '../../../internal/safe-css.js';
import { TABLE_VIEWER_SOURCE_MESSAGE_KEYS, TableViewerSourceController, TableViewerController, type ResolvedCellHighlight, type TableViewerScrollMode, tableViewerScrollMode } from '../table-viewer-shared.js';
import { delimitedColumnCount } from '../../../internal/delimited-data.js';
import {
  DocumentAnchorTargetBase as DocumentAnchorTarget,
  type LyraAnchorTargetEventMap,
} from '../../../internal/anchor-target-base.js';
import { parseCellRange } from '../../../internal/cell-range.js';
import type { LyraAnchor, LyraAnchorKind } from '../document-viewer/anchors.js';
import { loadSheetJsCached, type SheetJsApi } from './spreadsheet-loader.js';
import { styles } from './spreadsheet-viewer.styles.js';
import { assertXlsxArchiveWithinLimits } from './xlsx-resource-guard.js';
import { getDateTimeFormat, getNumberFormat } from '../../../internal/intl-cache.js';
import {
  viewerSemanticLabel,
  viewerSemanticRole,
} from '../viewer-semantic-owner.js';
import { renderViewerLoading, viewerLoadingStyles } from '../viewer-loading.js';
import type { LyraSearchChangeDetail } from '../../../internal/text-viewer-target.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_anchorJumped, LYRA_DEFAULT_anchorJumpedToPage, LYRA_DEFAULT_anchorNotFound, LYRA_DEFAULT_collapse, LYRA_DEFAULT_copy, LYRA_DEFAULT_date, LYRA_DEFAULT_details, LYRA_DEFAULT_documentPreviewEmpty, LYRA_DEFAULT_highlightWithLabel, LYRA_DEFAULT_loading, LYRA_DEFAULT_map, LYRA_DEFAULT_noData, LYRA_DEFAULT_open, LYRA_DEFAULT_search, LYRA_DEFAULT_sourceSearchUnavailable, LYRA_DEFAULT_viewerSearchActiveMatch, LYRA_DEFAULT_viewerSearchMatchCount, LYRA_DEFAULT_viewerSearchNoMatches } from '../../../internal/default-strings/shared.generated.js';
import { LYRA_DEFAULT_cellHighlightWithLabel, LYRA_DEFAULT_documentPreviewFailedToLoad, LYRA_DEFAULT_documentPreviewResourceTooLarge, LYRA_DEFAULT_documentPreviewTypeDocument, LYRA_DEFAULT_documentPreviewUrlNotAllowed, LYRA_DEFAULT_loadingDocument, LYRA_DEFAULT_spreadsheetViewerLabel, LYRA_DEFAULT_spreadsheetViewerUnavailable } from '../../../internal/default-strings/viewers.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END

/** Parsed scalar-cell workbook accepted without loading a parser peer. */
export interface SpreadsheetViewerWorkbook {
  sheets: { name: string; rows: unknown[][] }[];
}

interface SpreadsheetSheet {
  name: string;
  rows: unknown[][];
  body: unknown[][];
  columns: number;
}
type SpreadsheetState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'loaded'; sheets: SpreadsheetSheet[] }
  | { kind: 'error'; message: () => string };
const MAX_SPREADSHEET_SHEETS = 256;
const MAX_SPREADSHEET_CELLS = 1_000_000;

function cell(value: unknown, locale: string): string {
  if (value === undefined || value === null) return '';
  if (value instanceof Date) {
    // Date cells carry their wall-clock time in UTC fields; a time-only value precedes 1900.
    const dated = value.getUTCFullYear() >= 1900;
    const seconds = value.getUTCSeconds() > 0;
    const timed = !dated || seconds || value.getUTCHours() + value.getUTCMinutes() > 0;
    return getDateTimeFormat(locale, {
      timeZone: 'UTC',
      dateStyle: dated ? 'medium' : undefined,
      timeStyle: timed ? (seconds ? 'medium' : 'short') : undefined,
    }).format(value);
  }
  return typeof value === 'number'
    ? formatChartValue(value, locale, getNumberFormat(locale, { useGrouping: false }))
    : String(value);
}

export interface LyraSpreadsheetViewerEventMap
  extends Omit<LyraAnchorTargetEventMap, 'lr-text-select'> {
  'lr-load': CustomEvent<Record<string, never>>;
  'lr-render-error': CustomEvent<{ error: unknown }>;
  /** Fired whenever the search query, match count, or active match index changes, from
   *  `search()`/`searchNext()`/`searchPrevious()`/`clearSearch()`. */
  'lr-search-change': CustomEvent<LyraSearchChangeDetail>;
}

class LyraSpreadsheetViewerBase extends LyraElement<LyraSpreadsheetViewerEventMap> {}

/**
 * Fetches and renders `.xlsx` and legacy `.xls` workbooks with virtualized rows and sheet tabs.
 *
 * Adopts `DocumentAnchorTarget`: a `cell-range` anchor addresses one sheet's raw grid, 1-based, with
 * its (always-present) header row included -- matching how a spreadsheet app itself labels `A1`.
 * The target sheet resolves from the anchor's own `sheet` field (falling back to a `Sheet!`-prefixed
 * `range`, then the currently active sheet when neither is set); `scrollToAnchor()` switches
 * `<lr-tab-group>`'s `active` tab first when the resolved sheet isn't already active, then scrolls the
 * addressed row into view via the virtualized list's `active-item-id`, then scrolls the first addressed
 * column horizontally into view. `highlights` paint a structural `part="cell-highlight"` cell
 * wrapping a focusable native `part="cell-highlight-action"` button, recomputed per row inside
 * `renderRow()` so a row scrolled out and back in reconstructs its highlight for free, with no
 * persistent DOM to keep in sync. `search()` is a case-insensitive
 * substring match over every sheet's stringified cell values (the same stringification `cell()`
 * already renders), ordered sheet then row then column, switching tabs as navigation crosses sheets.
 * Cells render through their number formats; dates and General numbers use the effective locale.
 * By default, each sheet's used range is limited to 10,000 rows and 1,000 columns before it is expanded; a
 * workbook additionally retains at most 256 sheets and 1,000,000 aggregate cells. Internal tab and
 * virtual-list lifecycle events stay contained inside the viewer.
 *
 * Row and column ceilings default to 10,000 and 1,000; maxRows/maxColumns can raise them to
 * 100,000 and 10,000. maxBytes defaults to 25 MiB and is bounded at 250 MiB. The 1,000,000-cell
 * ceiling remains independent. The owned `workbook` input bypasses fetch and peer parsing; undefined
 * restores src. Header and body columns are windowed together, and anchors reveal hidden columns.
 * Remote parsing yields between admission/materialization passes; parsing itself remains synchronous.
 *
 * @customElement lr-spreadsheet-viewer
 * @event lr-load - Fired after rendering a successfully parsed document. Bubbles and is composed with empty detail.
 * @event lr-render-error - Fired when fetching or parsing fails.
 * @event lr-highlight-activate - A `highlights` cell was clicked, or activated via Enter/Space
 *   while focused. `detail: { highlightId }`.
 * @event lr-anchor-result - Fired after an `anchor` property assignment or a `scrollToAnchor()`
 *   call is applied. `detail: { found }`.
 * @event lr-search-change - Fired whenever the search query, match count, or active match index
 *   changes, including source-reset and effective-locale re-evaluation. `detail: { query,
 *   matchCount, matchCountExact, activeIndex }`. Search accepts at most 4,096 query code units,
 *   scans at most 4,000,000 cell code units, and retains at most 1,000 matches;
 *   `matchCountExact=false` identifies a ceiling-truncated lower bound.
 * @csspart base - The root wrapper.
 * @csspart body - The scrollable wrapper around the fetched-state content, capped by `max-height`.
 * @csspart tabs - The sheet-switching `<lr-tab-group>`, rendered only for a multi-sheet workbook;
 *   its `lr-tab-show`/`lr-tab-hide` lifecycle events do not escape this viewer.
 * @csspart sheet - The wrapper around one sheet's header row and virtualized body.
 * @csspart rows - The virtualized row list.
 * @csspart header-row - A sheet's header row.
 * @csspart data-row - One virtualized data row.
 * @csspart cell - One rendered cell.
 * @csspart cell-highlight - A structural cell covered by a `highlights` entry.
 * @csspart cell-highlight-action - The native button filling a highlighted cell -- focusable,
 *   emits `lr-highlight-activate` on click or Enter/Space. Its accessible name localizes the
 *   complete cell-value and annotation message through separate `{value}` and `{label}`
 *   placeholders.
 * @csspart spinner - Visible ordinary loading content with a motion-safe progress indicator.
 * @csspart error - The error message region.
 * @cssprop --lr-spreadsheet-viewer-background - Background of the viewer frame.
 * @cssprop --lr-spreadsheet-viewer-border - Border of the viewer frame.
 * @cssprop --lr-spreadsheet-viewer-border-radius - Corner radius of the viewer frame.
 * @cssprop --lr-spreadsheet-viewer-header-row-bg - Background of the column headings.
 * @cssprop [--lr-spreadsheet-viewer-highlight-color=var(--lr-color-brand)] - Outline color of a
 *   highlighted cell. The active highlight changes a private warning-color default; an inherited
 *   or direct public value remains authoritative.
 * @cssprop [--lr-spreadsheet-viewer-highlight-outline-offset=calc(-1 * var(--lr-border-width-medium))] -
 *   Outline offset of a highlighted cell.
 * @cssprop [--lr-spreadsheet-viewer-max-height=none] - Maximum block size of `[part="body"]`
 *   before it scrolls internally. The `maxHeight` property sets this token inline on
 *   `[part="base"]`.
 * @csspart search-status - Notice when a data source has no global search capability.
 * @status stable
 * @since 4.0.0
 */
export class LyraSpreadsheetViewer extends DocumentAnchorTarget(
  LyraSpreadsheetViewerBase
) {
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
    noData: LYRA_DEFAULT_noData,
    open: LYRA_DEFAULT_open,
    search: LYRA_DEFAULT_search,
    sourceSearchUnavailable: LYRA_DEFAULT_sourceSearchUnavailable,
    spreadsheetViewerLabel: LYRA_DEFAULT_spreadsheetViewerLabel,
    spreadsheetViewerUnavailable: LYRA_DEFAULT_spreadsheetViewerUnavailable,
    viewerSearchActiveMatch: LYRA_DEFAULT_viewerSearchActiveMatch,
    viewerSearchMatchCount: LYRA_DEFAULT_viewerSearchMatchCount,
    viewerSearchNoMatches: LYRA_DEFAULT_viewerSearchNoMatches,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  static override styles = [LyraElement.styles, styles, viewerLoadingStyles, srOnly];
  protected static override readonly identityCollectionObjectProperties = Object.freeze(['dataSource']);
  private _dataSource?: SpreadsheetViewerSource;
  /** Optional host-owned full logical source. Takes precedence over legacy inputs; undefined restores
   * them. Reassign, including the same source, or call requestUpdate() after source mutation.
   * Source rows use fixed live --lr-size-3rem geometry; legacy row sizing is unchanged.
   * Column labels are separate from body rows; body row zero appears at display row two.
   * Global search requires the source search capability. */
  @property({ attribute: false, noAccessor: true, hasChanged: () => true })
  get dataSource(): SpreadsheetViewerSource | undefined { return this._dataSource; }
  set dataSource(value: SpreadsheetViewerSource | undefined) {
    const previous = this._dataSource;
    this._dataSource = value;
    this.provider?.refresh();
    this.transport.cancel();
    this.requestUpdate('dataSource', previous);
  }

  override requestUpdate(...args: Parameters<LyraElement['requestUpdate']>): void {
    if (args[0] === undefined && this._dataSource !== undefined) this.provider?.refresh();
    super.requestUpdate(...args);
  }

  /** URL to fetch and parse. */
  @property() src = '';

  /** Maximum admitted rows; defaults to 10,000 and can be raised to 100,000. */
  // numeric-guard-exempt: tabularInputLimits bounds the row count before admission.
  @property({ type: Number, attribute: 'max-rows' }) maxRows = 10000;
  /** Maximum admitted columns; defaults to 1,000 and can be raised to 10,000. */
  // numeric-guard-exempt: tabularInputLimits bounds the column count before admission.
  @property({ type: Number, attribute: 'max-columns' }) maxColumns = 1000;
  /** Maximum source bytes; defaults to 25 MiB and can be raised to 250 MiB.
   * @default 26214400 */
  // numeric-guard-exempt: tabularInputLimits bounds the byte budget before reading or snapshotting.
  @property({ type: Number, attribute: 'max-bytes' }) maxBytes: number = DEFAULT_MAX_RESOURCE_BYTES;
  private get limits() { return tabularInputLimits(this.maxRows, this.maxColumns, this.maxBytes); }
  private readonly input = new TabularInputSnapshot<SpreadsheetViewerWorkbook>({
    snapshot: (value, limits) => this.snapshotWorkbook(value, limits),
    invalid: () => ({ sheets: [] }),
  });
  /** Owned parsed workbook of scalar-cell grids. Takes precedence over src; undefined restores fetching.
   * At most 256 sheets and 1,000,000 aggregate cells are accepted. Invalid input reports lr-render-error. */
  @property({ attribute: false, noAccessor: true })
  get workbook(): SpreadsheetViewerWorkbook | undefined { return this.input.value; }
  set workbook(value: SpreadsheetViewerWorkbook | undefined) {
    const previous = this.input.value;
    if (this.input.assign(value, this.limits)) this.requestUpdate('workbook', previous);
  }
  private snapshotWorkbook(value: SpreadsheetViewerWorkbook, limits: TabularInputLimits): SpreadsheetViewerWorkbook {
    const source = ownTableValue(value, 'sheets');
    if (!Array.isArray(source)) throw new TypeError('Invalid workbook sheets.');
    if (source.length > MAX_SPREADSHEET_SHEETS) throw new LyraResourceLimitError();
    const budget = { cells: 0, bytes: 0 };
    const encoder = new TextEncoder();
    const sheets: SpreadsheetViewerWorkbook['sheets'] = [];
    for (let index = 0; index < source.length; index++) {
      const sheet = ownTableValue(source, String(index));
      const name = ownTableValue(sheet, 'name');
      if (typeof name !== 'string') throw new TypeError('Invalid sheet name.');
      if (name.length > limits.bytes - budget.bytes) throw new LyraResourceLimitError();
      budget.bytes += encoder.encode(name).byteLength;
      if (budget.bytes > limits.bytes) throw new LyraResourceLimitError();
      const rows = snapshotViewerRows(ownTableValue(sheet, 'rows'), limits.rows, limits.columns, limits.bytes, budget);
      sheets.push(Object.freeze({ name, rows }));
    }
    return Object.freeze({ sheets: Object.freeze(sheets) as SpreadsheetViewerWorkbook['sheets'] });
  }

  /** Source filename or display name, used as the viewer's accessible name. */
  @property() name = '';
  /** A CSS `max-height`; invalid values are ignored. */
  @property({ attribute: 'max-height' }) maxHeight = '';

  private _scrollMode: TableViewerScrollMode = 'self';
  /** Select the viewer's scrollport (default) or use the page for both axes. */
  @property({ reflect: true, attribute: 'scroll-mode', converter: tableViewerScrollMode })
  get scrollMode(): TableViewerScrollMode { return this._scrollMode; }
  set scrollMode(value: TableViewerScrollMode) {
    const previous = this._scrollMode;
    this._scrollMode = tableViewerScrollMode.normalizeReflected(this, 'scroll-mode', value);
    this.requestUpdate('scrollMode', previous);
  }

  /** Anchor kinds this viewer resolves via `scrollToAnchor()`. */
  override readonly anchorKinds: readonly LyraAnchorKind[] = ['cell-range'];

  @state() private fetchState: SpreadsheetState = { kind: 'idle' };
  /** Index into `fetchState.sheets` of the sheet currently shown -- bound to `<lr-tab-group>`'s own
   *  `active` (as `sheet-${index}`), and switched by `scrollToAnchor()`/search navigation whenever
   *  a match lives on a different sheet. */
  @state() private activeSheetIndex = 0;
  /** The sheet that owns `table.activeRowKey`, the row last scrolled into view. */
  @state() private activeRowSheet = 0;
  private readonly transport = new ViewerSourceController(this, {
    load: (response, token) => this.readDocument(response, token),
    onError: error => {
      if (this.src !== this.table.lastLoadSrc) return;
      const failure = error instanceof ViewerSourceUrlNotAllowedError
        ? new LyraUserFacingError(this.localize('documentPreviewUrlNotAllowed'), localize => localize('documentPreviewUrlNotAllowed'))
        : error;
      this.fetchState = { kind: 'error', message: viewerFailureMessage(failure, this.localize.bind(this)) };
      this.emit('lr-render-error', { error: failure });
    },
  });
  private loadLibrary: () => Promise<SheetJsApi | null> = loadSheetJsCached;
  // @renderController TableViewerController
  private readonly table = new TableViewerController<{ sheetIndex: number; row: number; col: number }>(this, {
    repaint: () => super.requestUpdate(),
    emitSearch: (detail) => this.emit('lr-search-change', detail),
    emitActivate: (highlightId) => this.emit('lr-highlight-activate', { highlightId }),
    localize: (key, fallback, values) => this.localize(key, fallback, values),
    locale: () => this.effectiveLocale,
    pageScroll: () => this.scrollMode === 'page',
    schedule: (callback, key) => this.scheduleAfterUpdate(callback, key),
    load: () => this.load(),
    research: (query) => this.search(query),
    jump: (match) => this.jumpToCell(match.sheetIndex, match.row, match.col),
    // A genuine disconnect drops the grid (the query survives and re-runs after the reload).
    teardown: () => {
      this.transport.cancel();
      this.fetchState = { kind: 'idle' };
      this.table.activeRowKey = '';
      this.activeSheetIndex = 0;
    },
  });

  // @renderController TableViewerSourceController
  private readonly provider = new TableViewerSourceController(this, this.table, {
    source: () => this.dataSource,
    cancelAnchor: () => this.cancelPendingAnchor(),
    workbook: true,
    renderSheetTabs: (names, active, select) => html`<lr-tab-group part="tabs" .active=${`source-${active}`}
      @lr-tab-show=${(event: CustomEvent<{ name: string }>) => {
        event.stopPropagation(); select(Number(event.detail.name.slice(7)));
      }}>${names.map((name, index) => html`<lr-tab panel=${`source-${index}`}>${name}</lr-tab><lr-tab-panel name=${`source-${index}`}></lr-tab-panel>`)}</lr-tab-group>`,
    header: () => true,
    columnLimit: () => this.limits.columns,
    locale: () => this.effectiveLocale,
    pageScroll: () => this.scrollMode === 'page',
    localize: key => this.localize(TABLE_VIEWER_SOURCE_MESSAGE_KEYS[key]),
    repaint: () => super.requestUpdate(),
    error: error => {
      if (this.hasUpdated) this.table.announcements.announceAssertive(this.localize(isResourceLimitError(error) ? 'documentPreviewResourceTooLarge' : 'documentPreviewFailedToLoad'));
      this.emit('lr-render-error', { error });
    },
    emitSearch: detail => this.emit('lr-search-change', detail),
    format: value => cell(value, this.effectiveLocale),
    label: () => this.name || this.localize('spreadsheetViewerLabel'),
    colorVar: '--_lr-spreadsheet-viewer-highlight-color',
    headerPart: 'cell',
    activeHighlight: () => this.activeHighlightId,
  });

  override connectedCallback(): void {
    super.connectedCallback();
    this.table.connected();
    if (this.fetchState.kind === 'loading') this.scheduleAfterUpdate(() => { void this.load(); });
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
    this.table.willUpdate(changed, this.highlights, this.activeHighlightId, true);
    if (changed.has('src')) this.activeSheetIndex = 0;
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    this.table.updated(changed, this.fetchState);
    if (this.isConnected && changed.has('fetchState') && this.dataSource === undefined && this.fetchState.kind === 'loaded') this.emit('lr-load', {});
  }

  private async load(): Promise<void> {
    if (this.dataSource !== undefined) return;
    this.table.lastLoadSrc = this.src;
    if (this.input.value !== undefined) {
      this.transport.cancel();
      try {
        const workbook = this.input.admitted(this.limits)!;
        this.fetchState = { kind: 'loaded', sheets: workbook.sheets.map(sheet => ({ ...sheet, body: sheet.rows.slice(1), columns: delimitedColumnCount(sheet.rows) })) };
      } catch (error) {
        this.fetchState = {
          kind: 'error',
          message: isResourceLimitError(error)
            ? () => this.localize('documentPreviewResourceTooLarge')
            : () => this.localize('documentPreviewFailedToLoad'),
        };
        this.emit('lr-render-error', { error });
      }
      return;
    }
    this.fetchState = this.src ? { kind: 'loading' } : { kind: 'idle' };
    await this.transport.begin(this.src);
  }

  private async readDocument(response: Response, token: ViewerSourceToken): Promise<void> {
    const library = await this.loadLibrary();
    if (this.transport.isStale(token)) return;
    if (!library) {
      const message = () => this.localize('spreadsheetViewerUnavailable');
      const error = new LyraUserFacingError(message());
      this.fetchState = { kind: 'error', message };
      this.emit('lr-render-error', { error });
      return;
    }
    const source = await this.transport.readArrayBuffer(response, this.limits.bytes);
    if (this.transport.isStale(token)) return;
    await assertXlsxArchiveWithinLimits(source, undefined, undefined, {
      signal: token.signal,
      maxRows: this.limits.rows,
    });
    await yieldViewerTask(this.ownerDocument.defaultView, () => !this.transport.isStale(token));
    if (this.transport.isStale(token)) return;
    const workbook = library.read(source, {
      type: 'array',
      cellDates: true,
      cellNF: true,
      // Past this many rows SheetJS clamps a sheet's declared range to its parsed cells.
      sheetRows: this.limits.rows + 1,
    });
    if (this.transport.isStale(token)) return;
    const sheetNames = workbook.SheetNames;
    if (
      !Array.isArray(sheetNames) ||
      !sheetNames.every((name) => typeof name === 'string')
    ) {
      throw new Error('The xlsx peer returned a malformed workbook.');
    }
    if (sheetNames.length > MAX_SPREADSHEET_SHEETS) {
      throw new LyraResourceLimitError(
        'The spreadsheet contains too many sheets.'
      );
    }
    const sheets: SpreadsheetSheet[] = [];
    let totalCells = 0;
    for (const name of sheetNames) {
      await yieldViewerTask(this.ownerDocument.defaultView, () => !this.transport.isStale(token));
      const sheet = (workbook.Sheets[name] ?? {}) as Record<string, unknown>;
      // `sheet_to_json` visits every cell of the declared range, so bound that range first.
      const range = parseCellRange(String(sheet['!ref'] ?? 'A1'));
      if (!range) throw new Error('The xlsx peer returned a malformed workbook.');
      const rowCount = range.endRow - range.startRow + 1;
      const columnCount = range.endCol - range.startCol + 1;
      assertTableDimensions(rowCount, columnCount, this.limits.rows, this.limits.columns);
      totalCells += rowCount * columnCount;
      if (totalCells > MAX_SPREADSHEET_CELLS) {
        throw new LyraResourceLimitError(
          'The spreadsheet contains too many expanded cells.'
        );
      }
      // Formatted numbers render as the workbook shows them; General numbers stay numeric.
      for (const value of Object.values(sheet)) {
        const formatted = value as { t?: unknown; z?: unknown; w?: unknown; v?: unknown };
        if (formatted.t === 'n' && formatted.z !== undefined && formatted.z !== 'General' && typeof formatted.w === 'string') {
          formatted.t = 's';
          formatted.v = formatted.w;
        }
      }
      const rows = library.utils.sheet_to_json(sheet, {
        header: 1,
        UTC: true,
      }) as unknown[][];
      sheets.push({
        name,
        rows,
        body: rows.slice(1),
        columns: delimitedColumnCount(rows),
      });
    }
    if (!this.transport.isStale(token)) {
      this.fetchState = { kind: 'loaded', sheets };
      if (this.table.search.query) await this.search(this.table.search.query);
    }
  }

  // -- cell highlights -----------------------------------------------------------------------------

  private renderCell(
    value: unknown,
    colIndex: number,
    rowHighlights: ResolvedCellHighlight[],
    role: 'cell' | 'columnheader',
    columnCount: number
  ): TemplateResult {
    return this.table.renderCell(
      cell(value, this.effectiveLocale), colIndex, rowHighlights, role, 'cell',
      '--_lr-spreadsheet-viewer-highlight-color', this.activeHighlightId, columnCount,
    );
  }

  private renderRow(
    row: unknown[],
    count: number,
    part: 'header-row' | 'data-row',
    rawRow: number,
    sheetName: string
  ): TemplateResult {
    const window = this.table.columnWindow(sheetName, count);
    const rowHighlights = this.table.highlightsForRow(rawRow, sheetName);
    const header = part === 'header-row';
    return html`<div
      part=${part}
      role=${header ? 'row' : 'presentation'}
      aria-rowindex=${header ? '1' : nothing}
      style=${window.style}
      >${guard([row, window.columns, rowHighlights, this.activeHighlightId, this.effectiveLocale, this.strings, this.localize('highlightWithLabel'), this.localize('cellHighlightWithLabel')], () => window.columns.map((index) =>
        this.renderCell(
          row[index],
          index,
          rowHighlights,
          header ? 'columnheader' : 'cell',
          count
        )
      ))}</div
    >`;
  }

  // Stable, like the guarded `body`, so an unrelated update does not make the composed
  // `<lr-virtual-list>` recompute its O(n) offsets.
  private readonly virtualListKeyFunction = (_item: unknown, bodyIndex: number): number => bodyIndex;

  private renderSheet(sheet: SpreadsheetSheet, index: number): TemplateResult {
    const header = sheet.rows[0];
    if (!header)
      return html`<p class="empty-note">${this.localize('noData')}</p>`;
    const count = sheet.columns;
    return html`<div
      part="sheet"
      @scroll=${(event: Event) => this.table.scrollColumns(sheet.name, event.currentTarget as HTMLElement)}
      data-sheet-index=${index}
      role="table"
      aria-label=${sheet.name}
      aria-rowcount=${sheet.rows.length}
      aria-colcount=${count}
    >
      ${this.renderRow(
        header,
        count,
        'header-row',
        1,
        sheet.name
      )}<lr-virtual-list
        part="rows"
        exportparts="data-row:data-row, cell:cell, cell-highlight:cell-highlight, cell-highlight-action:cell-highlight-action"
        data-sheet-index=${index}
        .items=${guard([sheet.body], () => sheet.body.length <= 10000 ? sheet.body : nothing)}
        .scrollElement=${this.table.scrollWindow(this.scrollMode)}
        .source=${this.table.indexedSource(sheet.body)}
        .renderItem=${this.table.rowRenderer(sheet, [this.table.columnWindow(sheet.name, count).columns, this.activeHighlightId, this.strings], (row: unknown, bodyIndex: number) =>
          this.renderRow(
            row as unknown[],
            count,
            'data-row',
            bodyIndex + 2,
            sheet.name
          ))}
        .keyFunction=${sheet.body.length <= 10000 ? this.virtualListKeyFunction : undefined}
        .activeItemId=${index === this.activeRowSheet ? this.table.activeRowKey : ''}
        item-role="row"
        row-index-offset="1"
        @lr-load-more=${this.stopInternalEvent}
        @lr-visible-range-change=${this.stopInternalEvent}
        @lr-virtual-scroll=${this.stopInternalEvent}
      ></lr-virtual-list>
    </div>`;
  }

  private renderLoaded(sheets: SpreadsheetSheet[]): TemplateResult {
    if (!sheets.length)
      return html`<p class="empty-note">${this.localize('noData')}</p>`;
    if (sheets.length === 1) return this.renderSheet(sheets[0]!, 0);
    return html`<lr-tab-group
      @lr-activate=${this.stopInternalEvent}
      part="tabs"
      .active=${`sheet-${this.activeSheetIndex}`}
      @lr-tab-hide=${this.stopInternalEvent}
      @lr-tab-show=${this.onTabsChange}
      >${sheets.map(
        (sheet, index) =>
          html`<lr-tab panel=${`sheet-${index}`}>${sheet.name}</lr-tab>`
      )}${sheets.map(
        (sheet, index) =>
          html`<lr-tab-panel name=${`sheet-${index}`}
            >${index === this.activeSheetIndex ? this.renderSheet(sheet, index) : nothing}</lr-tab-panel
          >`
      )}</lr-tab-group
    >`;
  }

  private onTabsChange = (e: CustomEvent<{ name: string }>): void => {
    e.stopPropagation();
    const match = /^sheet-(\d+)$/.exec(e.detail.name);
    if (match) this.activeSheetIndex = Number(match[1]);
  };

  // -- anchor resolution ---------------------------------------------------------------------------

  /** Switches to `sheetIndex` (if needed) then scrolls raw-grid `(rawRow, col)` into view -- shared
   *  by `applyAnchor()` and every search navigation method, so both stay byte-identical in how a
   *  coordinate becomes a scroll. */
  private async jumpToCell(
    sheetIndex: number,
    rawRow: number,
    col: number
  ): Promise<boolean> {
    const loadedState = this.fetchState;
    if (loadedState.kind !== 'loaded') return false;
    const ownerDocument = this.ownerDocument;
    const isCurrent = (): boolean => this.isConnected && this.ownerDocument === ownerDocument && this.fetchState === loadedState;
    const { sheets } = loadedState;
    if (sheetIndex < 0 || sheetIndex >= sheets.length) return false;
    const sheet = sheets[sheetIndex]!;
    if (
      rawRow < 1 ||
      rawRow > sheet.rows.length ||
      col < 0 ||
      col >= sheet.columns
    )
      return false;
    const bodyIndex = rawRow - 2; // every sheet has exactly one (always-present) header row
    this.activeSheetIndex = sheetIndex;
    await this.updateComplete;
    if (!isCurrent()) return false;
    await this.table.showColumn(sheet.name, col, this.renderRoot.querySelector(`[part="sheet"][data-sheet-index="${sheetIndex}"]`));
    if (!isCurrent()) return false;
    if (bodyIndex < 0) {
      return this.table.revealCell(this.renderRoot
        .querySelector(
          `[part="sheet"][data-sheet-index="${sheetIndex}"] [part="header-row"]`
        )
        ?.querySelector(`[aria-colindex="${col + 1}"]`) as HTMLElement | undefined);
    }
    this.activeRowSheet = sheetIndex;
    this.table.setActiveRow(bodyIndex);
    await this.updateComplete;
    if (!isCurrent()) return false;
    await this.scrollColumnIntoView(sheetIndex, col);
    if (!isCurrent()) return false;
    // `fetchState` is only ever reassigned by load(), so an identity change across the awaits above
    // means a concurrent `src` reassignment replaced the workbook mid-jump (a citation/file-tab
    // click landing on top of a still-resolving jump). The coordinate this call resolved belongs to
    // the previous document and nothing was scrolled into view for the current one, so report the
    // failure rather than letting the shared retry loop accept a phantom success and fire
    // `lr-anchor-result: { found: true }`.
    return isCurrent();
  }

  protected override async applyAnchor(anchor: LyraAnchor): Promise<boolean> {
    if (this.dataSource !== undefined) return this.provider.revealAnchor(anchor);
    if (anchor.kind !== 'cell-range' || this.fetchState.kind !== 'loaded')
      return false;
    const parsed = parseCellRange(anchor.range);
    if (!parsed) return false;
    const sheetName = anchor.sheet ?? parsed.sheet;
    const sheetIndex = sheetName
      ? this.fetchState.sheets.findIndex((s) => s.name === sheetName)
      : this.activeSheetIndex;
    if (sheetIndex < 0) return false;
    return this.jumpToCell(sheetIndex, parsed.startRow + 1, parsed.startCol);
  }

  private async scrollColumnIntoView(
    sheetIndex: number,
    col: number
  ): Promise<void> {
    await this.table.scrollColumnIntoView(
      this.renderRoot, `${tag('virtual-list')}[data-sheet-index="${sheetIndex}"]`, col);
  }

  // -- search ---------------------------------------------------------------------------------------

  /** Case-insensitive substring search over every sheet's raw-grid cells (the same stringification
   *  `cell()` renders), ordered sheet then row then column -- each sheet's header row is included,
   *  the same raw-grid convention `cell-range` anchors use. An empty/whitespace-only query behaves
   *  like `clearSearch()` and resolves `0`. Returns at most 1,000 retained matches;
   *  `lr-search-change.detail.matchCountExact=false` identifies that return as a lower bound. */
  async search(query: string): Promise<number> {
    if (this.dataSource !== undefined) return this.provider.search(query);
    return this.table.runSearch(query, this.fetchState.kind === 'loaded', (visit) => {
      if (this.fetchState.kind !== 'loaded') return;
      const { sheets } = this.fetchState;
      for (let sheetIndex = 0; sheetIndex < sheets.length; sheetIndex++) {
        const sheet = sheets[sheetIndex]!;
        for (let r = 0; r < sheet.rows.length; r++) {
          const row = sheet.rows[r]!;
          for (let c = 0; c < row.length; c++)
            if (!visit(cell(row[c], this.effectiveLocale), { sheetIndex, row: r + 1, col: c })) return;
        }
      }
    }, this.fetchState);
  }

  /** Advances to the next match, wrapping to the first after the last, switching sheets when the
   *  next match lives on a different one. Resolves `false` (no-op) when there are no matches. */
  async searchNext(): Promise<boolean> {
    if (this.dataSource !== undefined) return this.provider.step(1);
    return this.table.step(1);
  }

  /** Moves to the previous match, wrapping to the last before the first, switching sheets when the
   *  previous match lives on a different one. Resolves `false` (no-op) when there are no matches. */
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

  override render(): TemplateResult {
    const body = this.dataSource !== undefined ? this.provider.render() :
      this.fetchState.kind === 'loaded'
        ? this.renderLoaded(this.fetchState.sheets)
        : this.fetchState.kind === 'loading'
        ? renderViewerLoading(this.localize('loadingDocument'))
        : this.fetchState.kind === 'error'
        ? html`<div part="error">${this.fetchState.message()}</div>`
        : html`<p class="empty-note">${this.localize(
            'documentPreviewEmpty',
            undefined,
            { type: this.localize('documentPreviewTypeDocument') }
          )}</p>`;
    const maxHeight = sanitizeCssLength(this.maxHeight);
    return html`<div
      part="base"
      role=${viewerSemanticRole(this, 'region') ?? nothing}
      style=${maxHeight
        ? styleMap({ '--lr-spreadsheet-viewer-max-height': maxHeight })
        : nothing}
      aria-label=${viewerSemanticLabel(
        this,
        this.name || this.localize('spreadsheetViewerLabel')
      ) ?? nothing}
      aria-busy=${(this.dataSource !== undefined ? this.provider.busy : this.fetchState.kind === 'loading') ? 'true' : 'false'}
    >
      <div part="body">${body}</div>
      ${this.renderAnchorLiveRegion()}
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-spreadsheet-viewer': LyraSpreadsheetViewer;
  }
}
