import type { LyraTabularSource } from '../../../data-sources.js';
export type { LyraTabularColumn, LyraSourceCell, LyraTabularHit, LyraTabularReadRequest, LyraSourceSearchRequest, LyraSourceSearchResult } from '../../../data-sources.js';
/** Host-owned indexed or rectangular source for this viewer. */
export type DatasetViewerSource = LyraTabularSource;
import { ViewerSourceController, ViewerSourceUrlNotAllowedError, type ViewerSourceToken } from '../../../internal/viewer-source-controller.js';
import { TabularInputSnapshot, tabularInputLimits, type TabularInputLimits } from '../../../internal/tabular-viewer-target.js';
import { parseDelimitedRecordsYielding, snapshotViewerRows, ownTableValue } from '../../../internal/delimited-data.js';
import { html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import { guard } from 'lit/directives/guard.js';
import { styleMap } from 'lit/directives/style-map.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { tag } from '../../../internal/prefix.js';
import {
  DEFAULT_MAX_RESOURCE_BYTES,
  isResourceLimitError,
  LyraUserFacingError,
  LyraResourceLimitError,
  yieldViewerTask,
} from '../../../internal/resource-loader.js';
import { viewerFailureMessage } from '../../../internal/viewer-failure-message.js';
import { srOnly } from '../../../internal/a11y.js';
import { makeScrollRegionFocusable } from '../../../internal/scroll-region.js';
import { normalizeLabel } from '../../../internal/accessible-name.js';
import { loadPapaParseCached } from '../../../internal/papaparse-loader.js';
import { parseCellRange } from '../../../internal/cell-range.js';
import {
  DocumentAnchorTargetBase as DocumentAnchorTarget,
  type LyraAnchorTargetEventMap,
} from '../../../internal/anchor-target-base.js';
import type { LyraAnchor, LyraAnchorKind } from '../../../internal/document-anchors.js';
import { styles } from './dataset-viewer.styles.js';
import { getNumberFormat } from '../../../internal/intl-cache.js';
import { TABLE_VIEWER_SOURCE_MESSAGE_KEYS, TableViewerSourceController, TableViewerController, type ResolvedCellHighlight, type TableViewerScrollMode, tableViewerScrollMode } from '../table-viewer-shared.js';
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
  viewerHostOwnsName,
  viewerSemanticLabel,
  viewerSemanticRole,
} from '../viewer-semantic-owner.js';
import type { LyraSearchChangeDetail } from '../../../internal/text-viewer-target.js';
import { blankNumberConverter } from '../../../internal/converters.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_anchorJumped, LYRA_DEFAULT_anchorJumpedToPage, LYRA_DEFAULT_anchorNotFound, LYRA_DEFAULT_documentPreviewEmpty, LYRA_DEFAULT_highlightWithLabel, LYRA_DEFAULT_noData, LYRA_DEFAULT_sourceSearchUnavailable, LYRA_DEFAULT_viewerSearchActiveMatch, LYRA_DEFAULT_viewerSearchMatchCount, LYRA_DEFAULT_viewerSearchNoMatches } from '../../../internal/default-strings/shared.generated.js';
import { LYRA_DEFAULT_cellHighlightWithLabel, LYRA_DEFAULT_datasetViewerCaption, LYRA_DEFAULT_datasetViewerCaptionNamed, LYRA_DEFAULT_datasetViewerEmpty, LYRA_DEFAULT_datasetViewerLabel, LYRA_DEFAULT_datasetViewerMissingParser, LYRA_DEFAULT_documentPreviewFailedToLoad, LYRA_DEFAULT_documentPreviewResourceTooLarge, LYRA_DEFAULT_documentPreviewTypeDataset, LYRA_DEFAULT_documentPreviewUrlNotAllowed, LYRA_DEFAULT_loadingDocument } from '../../../internal/default-strings/viewers.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END

export interface DatasetTable {
  fields: string[];
  rows: Record<string, string>[];
}
type DatasetFetchState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'loaded'; table: DatasetTable }
  | { kind: 'empty' }
  | { kind: 'error'; message: () => string };

/** Which element scrolls when `<lr-dataset-viewer>` overflows. */
export type DatasetViewerScrollMode = TableViewerScrollMode;

export interface LyraDatasetViewerEventMap
  extends Omit<LyraAnchorTargetEventMap, 'lr-text-select'> {
  'lr-load': CustomEvent<null>;
  'lr-render-error': CustomEvent<{ error: unknown }>;
  'lr-viewer-diagnostic': CustomEvent<LyraViewerDiagnosticEventDetail>;
  /** Fired whenever the search query, match count, or active match index changes, from
   *  `search()`/`searchNext()`/`searchPrevious()`/`clearSearch()`. */
  'lr-search-change': CustomEvent<LyraSearchChangeDetail>;
}

class LyraDatasetViewerBase extends LyraElement<LyraDatasetViewerEventMap> {}

/**
 * Fetches delimited text and renders a virtualized, accessible data table: a `role="table"`
 * container with a sticky `role="row"` header, composed with `<lr-virtual-list item-role="row">`
 * for the body so files far larger than a real synchronous `<table>` can render without locking the
 * main thread.
 *
 * Adopts `DocumentAnchorTarget`: a `cell-range` anchor addresses the raw file grid, 1-based, with
 * the header row always occupying row 1 (this component always parses with PapaParse's `header:
 * true`, so the first row is never part of the virtualized body) -- `scrollToAnchor()` scrolls the
 * addressed row into view via the virtualized list's `active-item-id`. A `sheet`-qualified anchor never
 * resolves here -- this viewer has no sheets. `highlights` paint as a `part="cell-highlight"` cell
 * wrapping a focusable `part="cell-highlight-action"` native button (keeping the ARIA table tree
 * intact) on membership, recomputed per row inside `renderRow()` so a row scrolled out and back
 * in reconstructs its highlight for free, with no persistent DOM to keep in sync. `search()` is a
 * locale-aware case-insensitive substring match over the header followed by every body cell's raw
 * string value, ordered row then column.
 *
 * By default, a quote-aware structural scan enforces the 10,000-data-row, 1,000-field, 1,000,000-cell, and
 * 100-diagnostic ceilings before PapaParse can materialize an amplified result. The peer then runs
 * with streaming record callbacks and the same limits as a second boundary.
 *
 * Row and column ceilings default to 10,000 and 1,000; maxRows/maxColumns can raise them to
 * 100,000 and 10,000. maxBytes defaults to 25 MiB and is bounded at 250 MiB. The 1,000,000-cell
 * ceiling remains independent. The owned `table` input bypasses fetch and peer parsing; undefined
 * restores src. Header and body columns are windowed together, and anchors reveal hidden columns.
 * Remote parsing yields between admission/materialization passes; parsing itself remains synchronous.
 *
 * @customElement lr-dataset-viewer
 * @event lr-load - Fired after rendering a successfully parsed document. Bubbles and is composed with a `null` detail.
 * @event lr-render-error - Fired when fetching or parsing fails, or the resource guard rejects the
 *   table.
 * @event lr-viewer-diagnostic - Structured, non-fatal PapaParse diagnostics when a recoverable
 *   partial table remains rendered. `detail.diagnostic.cause` contains the bounded diagnostic array.
 * @event lr-highlight-activate - A `highlights` cell was clicked, or activated via Enter/Space
 *   while focused. `detail: { highlightId }`.
 * @event lr-anchor-result - Fired after an `anchor` property assignment or a `scrollToAnchor()`
 *   call is applied. `detail: { found }`.
 * @event lr-search-change - Fired whenever the search query, match count, or active match index
 *   changes, including source-reset and effective-locale re-evaluation. `detail: { query,
 *   matchCount, matchCountExact, activeIndex }`. Search accepts at most 4,096 query code units,
 *   scans at most 4,000,000 cell code units, and retains at most 1,000 matches;
 *   `matchCountExact=false` identifies a ceiling-truncated lower bound.
 * @csspart base - The stable root wrapper with explicit `aria-busy` across every fetch state. `name` supplies its shadow
 *   region name; a non-empty host `aria-label` instead leaves ownership on the host, while an
 *   explicitly empty label remains explicit on this shadow owner. With neither source it stays a
 *   plain wrapper rather than an unnamed region.
 * @csspart body - The scrollable body wrapper. In `scroll-mode="self"` it becomes a named, keyboard-focusable
 *   region (`name`, else the localized "Dataset") while its rows overflow the cap, and adds no tab stop otherwise.
 * @csspart table - The `role="table"` container, named by the display name plus localized row
 *   count or by the localized row count alone; it never copies the host's overall name.
 * @csspart header-row - The sticky header row (`role="row"`).
 * @csspart header-cell - A header cell (`role="columnheader"`).
 * @csspart data-row - One virtualized data row.
 * @csspart cell - One rendered cell (`role="cell"`).
 * @csspart cell-highlight - A cell (`role="cell"`) covered by a `highlights` entry; wraps the
 *   `cell-highlight-action` button.
 * @csspart cell-highlight-action - The native button filling a highlighted cell -- focusable,
 *   emits `lr-highlight-activate` on click or Enter/Space. Its accessible name localizes the
 *   complete cell-value and annotation message through separate `{value}` and `{label}`
 *   placeholders.
 * @csspart spinner - The visible tokenized loading treatment and ordinary text label.
 * @csspart error - The error message region.
 * @cssprop --lr-dataset-viewer-bg - Background of the viewer frame.
 * @cssprop --lr-dataset-viewer-border - Border of the viewer frame.
 * @cssprop --lr-dataset-viewer-radius - Corner radius of the viewer frame.
 * @cssprop [--lr-dataset-viewer-max-height=none] - Maximum block size of `[part="body"]` before it
 *   scrolls internally. The `maxHeight` property sets this token inline on `[part="base"]`.
 *   `scrollMode='page'` deliberately ignores the cap and hands both axes to page flow so the
 *   sticky header can use the page scrollport.
 * @cssprop [--lr-dataset-viewer-highlight-color=var(--lr-color-brand)] - Outline color of a
 *   highlighted cell. The active highlight changes a private warning-color default; an inherited
 *   or direct public value remains authoritative.
 * @cssprop [--lr-dataset-viewer-header-row-bg=var(--lr-color-brand-quiet)] - Background of
 *   `[part="header-row"]`, independent of the highlight outline above.
 * @csspart search-status - Notice when a data source has no global search capability.
 * @cssprop [--lr-dataset-viewer-cell-action-hover-bg=var(--lr-color-brand-quiet)] - Hover background of a highlighted cell's `[part="cell-highlight-action"]`.
 * @cssprop --lr-dataset-viewer-cell-action-active-bg - Pressed background of that action. Defaults to the hover background mixed by the press step.
 * @status stable
 * @since 4.0.0
 */
export class LyraDatasetViewer extends DocumentAnchorTarget(
  LyraDatasetViewerBase
) {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    anchorJumped: LYRA_DEFAULT_anchorJumped,
    anchorJumpedToPage: LYRA_DEFAULT_anchorJumpedToPage,
    anchorNotFound: LYRA_DEFAULT_anchorNotFound,
    cellHighlightWithLabel: LYRA_DEFAULT_cellHighlightWithLabel,
    datasetViewerCaption: LYRA_DEFAULT_datasetViewerCaption,
    datasetViewerCaptionNamed: LYRA_DEFAULT_datasetViewerCaptionNamed,
    datasetViewerEmpty: LYRA_DEFAULT_datasetViewerEmpty,
    datasetViewerLabel: LYRA_DEFAULT_datasetViewerLabel,
    datasetViewerMissingParser: LYRA_DEFAULT_datasetViewerMissingParser,
    documentPreviewEmpty: LYRA_DEFAULT_documentPreviewEmpty,
    documentPreviewFailedToLoad: LYRA_DEFAULT_documentPreviewFailedToLoad,
    documentPreviewResourceTooLarge: LYRA_DEFAULT_documentPreviewResourceTooLarge,
    documentPreviewTypeDataset: LYRA_DEFAULT_documentPreviewTypeDataset,
    documentPreviewUrlNotAllowed: LYRA_DEFAULT_documentPreviewUrlNotAllowed,
    highlightWithLabel: LYRA_DEFAULT_highlightWithLabel,
    loadingDocument: LYRA_DEFAULT_loadingDocument,
    noData: LYRA_DEFAULT_noData,
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
  private _dataSource?: DatasetViewerSource;
  /** Optional host-owned full logical source. Takes precedence over legacy inputs; undefined restores
   * them. Reassign, including the same source, or call requestUpdate() after source mutation.
   * Source rows use fixed live --lr-size-3rem geometry; legacy row sizing is unchanged.
   * Column labels are separate from body rows; body row zero appears at display row two.
   * Global search requires the source search capability. */
  @property({ attribute: false, noAccessor: true, hasChanged: () => true })
  get dataSource(): DatasetViewerSource | undefined { return this._dataSource; }
  set dataSource(value: DatasetViewerSource | undefined) {
    const previous = this._dataSource;
    this._dataSource = value;
    this.provider?.refresh();
    this.transport?.cancel();
    this.requestUpdate('dataSource', previous);
  }

  override requestUpdate(...args: Parameters<LyraElement['requestUpdate']>): void {
    if (args[0] === undefined && this._dataSource !== undefined) this.provider?.refresh();
    super.requestUpdate(...args);
  }

  /** URL to fetch and parse as delimited text. */
  @property() src = '';

  /** Maximum admitted rows; defaults to 10,000 and can be raised to 100,000. */
  // numeric-guard-exempt: tabularInputLimits bounds the row count before admission.
  @property({ converter: blankNumberConverter(10000), attribute: 'max-rows' }) maxRows = 10000;
  /** Maximum admitted columns; defaults to 1,000 and can be raised to 10,000. */
  // numeric-guard-exempt: tabularInputLimits bounds the column count before admission.
  @property({ converter: blankNumberConverter(1000), attribute: 'max-columns' }) maxColumns = 1000;
  /** Maximum source bytes; defaults to 25 MiB and can be raised to 250 MiB.
   * @default 26214400 */
  // numeric-guard-exempt: tabularInputLimits bounds the byte budget before reading or snapshotting.
  @property({ converter: blankNumberConverter(DEFAULT_MAX_RESOURCE_BYTES), attribute: 'max-bytes' }) maxBytes: number = DEFAULT_MAX_RESOURCE_BYTES;
  private get limits() { return tabularInputLimits(this.maxRows, this.maxColumns, this.maxBytes); }
  private readonly input = new TabularInputSnapshot<DatasetTable>({
    snapshot: (value, limits) => this.snapshotTable(value, limits),
    invalid: () => ({ fields: [], rows: [] }),
  });
  private get parseLimits() { const { rows, columns } = this.limits; return { maxRows: rows, maxColumns: columns }; }
  /** Owned field-keyed scalar table. Takes precedence over src; undefined restores fetching.
   * Invalid or oversized inputs produce lr-render-error and the localized error state. Replace the object to refresh. */
  @property({ attribute: false, noAccessor: true })
  get table(): DatasetTable | undefined { return this.input.value; }
  set table(value: DatasetTable | undefined) {
    const previous = this.input.value;
    if (this.input.assign(value, this.limits)) this.requestUpdate('table', previous);
  }
  private snapshotTable(value: DatasetTable, limits: TabularInputLimits): DatasetTable {
    const budget = { cells: 0, bytes: 0 };
    const fieldsInput = ownTableValue(value, 'fields');
    const fields = snapshotViewerRows([fieldsInput], 1, limits.columns, limits.bytes, budget)[0]!;
    if (!fields.every(field => typeof field === 'string') || new Set(fields).size !== fields.length) throw new TypeError('Invalid table fields.');
    const records = ownTableValue(value, 'rows');
    if (!Array.isArray(records)) throw new TypeError('Invalid table rows.');
    if (records.length > limits.rows || records.length * fields.length > 1000000) throw new LyraResourceLimitError();
    const grid: unknown[][] = [];
    for (let index = 0; index < records.length; index++) {
      const row = ownTableValue(records, String(index));
      grid.push(fields.map(field => ownTableValue(row, field as string)));
    }
    const rows = snapshotViewerRows(grid, limits.rows, limits.columns, limits.bytes, budget).map(row => Object.freeze(Object.fromEntries(fields.map((field, index) => [field, row[index] == null ? '' : String(row[index])]))));
    return Object.freeze({ fields: fields as string[], rows: Object.freeze(rows) as Record<string, string>[] });
  }

  /** Display name used for the table's row-count caption and for `[part="base"]` when host
   *  `aria-label` is absent. A non-empty host label remains on the host; an explicitly empty one
   *  stays explicit on the shadow owner. */
  @property() name = '';
  /** CSS length that caps the scrollable body; invalid values are ignored. */
  @property({ attribute: 'max-height' }) maxHeight = '';

  private _scrollMode: DatasetViewerScrollMode = 'self';

  /**
   * Which element scrolls when the table overflows. `'self'` preserves contained horizontal
   * scrolling and applies `maxHeight`. `'page'` removes intervening scroll containers while
   * retaining rounded header corners, making the page the sticky header's scrollport and letting
   * the rows window against the page's own scroll; a wide dataset can consequently overflow its
   * host.
   */
  @property({ reflect: true, attribute: 'scroll-mode', converter: tableViewerScrollMode })
  get scrollMode(): DatasetViewerScrollMode {
    return this._scrollMode;
  }
  set scrollMode(next: DatasetViewerScrollMode) {
    const normalized = tableViewerScrollMode.normalizeReflected(
      this,
      'scroll-mode',
      next
    );
    const previous = this._scrollMode;
    if (previous === normalized) return;
    this._scrollMode = normalized;
    this.requestUpdate('scrollMode', previous);
  }

  /** Anchor kinds this viewer resolves via `scrollToAnchor()`. */
  override readonly anchorKinds: readonly LyraAnchorKind[] = ['cell-range'];

  @state() private fetchState: DatasetFetchState = { kind: 'idle' };
  private readonly transport = new ViewerSourceController(this, {
    load: (response, token) => this.readDocument(response, token),
    onError: error => {
      if (this.src !== this.tableController.lastLoadSrc) return;
      const failure = error instanceof ViewerSourceUrlNotAllowedError
        ? new LyraUserFacingError(this.localize('documentPreviewUrlNotAllowed'), localize => localize('documentPreviewUrlNotAllowed'))
        : error;
      this.fetchState = { kind: 'error', message: viewerFailureMessage(failure, this.localize.bind(this)) };
      this.emit('lr-render-error', { error: failure });
    },
  });
  // @renderController TableViewerController
  private readonly tableController = new TableViewerController<{ row: number; col: number }>(this, {
    repaint: () => super.requestUpdate(),
    emitSearch: (detail) => this.emit('lr-search-change', detail),
    emitActivate: (highlightId) => this.emit('lr-highlight-activate', { highlightId }),
    localize: (key, fallback, values) => this.localize(key, fallback, values),
    locale: () => this.effectiveLocale,
    schedule: (callback, key) => this.scheduleAfterUpdate(callback, key),
    load: () => this.load(),
    research: (query) => this.search(query),
    jump: (match) => this.jumpToCell(match.row, match.col),
    teardown: () => this.transport.cancel(),
    pageScroll: () => this.scrollMode === 'page',
  });

  // @renderController TableViewerSourceController
  private readonly provider = new TableViewerSourceController(this, this.tableController, {
    source: () => this.dataSource,
    cancelAnchor: () => this.cancelPendingAnchor(),
    workbook: false,
    header: () => true,
    columnLimit: () => this.limits.columns,
    locale: () => this.effectiveLocale,
    localize: key => this.localize(TABLE_VIEWER_SOURCE_MESSAGE_KEYS[key]),
    repaint: () => super.requestUpdate(),
    error: error => {
      if (this.hasUpdated) this.tableController.announcements.announceAssertive(this.localize(isResourceLimitError(error) ? 'documentPreviewResourceTooLarge' : 'documentPreviewFailedToLoad'));
      this.emit('lr-render-error', { error });
    },
    emitSearch: detail => this.emit('lr-search-change', detail),
    format: value => value == null ? '' : String(value),
    label: (rows) => {
      const name = normalizeLabel(this.name);
      const count = getNumberFormat(this.effectiveLocale).format(rows);
      return name ? this.localize('datasetViewerCaptionNamed', undefined, { name, count }) : this.localize('datasetViewerCaption', undefined, { count });
    },
    colorVar: '--_lr-dataset-viewer-highlight-color',
    headerPart: 'header-cell',
    activeHighlight: () => this.activeHighlightId,
    pageScroll: () => this.scrollMode === 'page',
    scrollContainer: () => this.renderRoot.querySelector('[part="body"]'),
  });

  private releaseScrollRegion?: () => void;

  /** A capped self-scrolling body that holds no focusable cell gets its own named tab stop while
   *  it overflows, so keyboard users can scroll it; page mode hands scrolling to the page. */
  private syncScrollRegion(): void {
    this.releaseScrollRegion?.();
    const body = this.renderRoot.querySelector<HTMLElement>('[part="body"]');
    this.releaseScrollRegion = body && this.isConnected && this.scrollMode === 'self'
      ? makeScrollRegionFocusable(body, this.localize('datasetViewerLabel'))
      : undefined;
  }

  override connectedCallback(): void {
    super.connectedCallback();
    if (this.hasUpdated) this.syncScrollRegion();
    this.tableController.connected();
    if (this.fetchState.kind === 'loading') this.scheduleAfterUpdate(() => { void this.load(); });
  }

  override disconnectedCallback(): void {
    this.releaseScrollRegion?.();
    this.releaseScrollRegion = undefined;
    this.tableController.disconnecting();
    super.disconnectedCallback();
    this.tableController.disconnected();
  }

  override adoptedCallback(): void {
    super.adoptedCallback();
    this.provider.adopted();
    this.tableController.adopted();
  }

  protected override willUpdate(changed: PropertyValues): void {
    this.provider.update();
    super.willUpdate(changed); // reaches DocumentAnchorTarget's own willUpdate (declarative `anchor`)
    this.tableController.willUpdate(changed, this.highlights, this.activeHighlightId, false); // dataset-viewer has no sheets
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    this.tableController.updated(changed, this.fetchState);
    this.syncScrollRegion();
    const list = this.renderRoot.querySelector<HTMLElement & { scrollElement?: HTMLElement }>(tag('virtual-list'));
    if (list && this.scrollMode === 'self') {
      list.scrollElement = this.renderRoot.querySelector<HTMLElement>('[part="body"]') ?? undefined;
    }
    if (this.isConnected && changed.has('fetchState') && this.dataSource === undefined && (this.fetchState.kind === 'loaded' || this.fetchState.kind === 'empty')) this.emit('lr-load', null);
  }

  private async load(): Promise<void> {
    if (this.dataSource !== undefined) return;
    this.tableController.lastLoadSrc = this.src;
    if (this.input.value !== undefined) {
      this.transport.cancel();
      try {
        const table = this.input.admitted(this.limits)!;
        this.fetchState = table.rows.length && table.fields.length ? { kind: 'loaded', table } : { kind: 'empty' };
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
    const papa = await loadPapaParseCached();
    if (this.transport.isStale(token)) return;
    if (!papa) throw new LyraUserFacingError(this.localize('datasetViewerMissingParser'), localize => localize('datasetViewerMissingParser'));
    const source = await this.transport.readText(response, this.limits.bytes);
    if (this.transport.isStale(token)) return;
    const result = await parseDelimitedRecordsYielding(papa, source, this.parseLimits, () =>
      yieldViewerTask(this.ownerDocument.defaultView, () => !this.transport.isStale(token)));
    if (this.transport.isStale(token)) return;
    const { fields, rows, errors } = result;
    this.fetchState = fields.length && rows.length ? { kind: 'loaded', table: { fields, rows } } : { kind: 'empty' };
    if (this.fetchState.kind === 'loaded' && this.tableController.search.query) await this.search(this.tableController.search.query);
    if (errors.length && !this.transport.isStale(token)) {
      this.emit('lr-viewer-diagnostic', {
        diagnostic: Object.freeze({ code: 'delimited-parse-diagnostic', severity: 'warning', fatal: false, source: 'papaparse', cause: errors } as const),
      });
    }
  }

  // -- cell highlights -----------------------------------------------------------------------------

  private renderCell(
    value: string,
    colIndex: number,
    rowHighlights: ResolvedCellHighlight[],
    columnCount: number,
    role: 'cell' | 'columnheader' = 'cell'
  ): TemplateResult {
    return this.tableController.renderCell(
      value, colIndex, rowHighlights, role, role === 'columnheader' ? 'header-cell' : 'cell',
      '--_lr-dataset-viewer-highlight-color', this.activeHighlightId, columnCount,
    );
  }

  private renderRow = (
    row: Record<string, string>,
    index: number,
    fields: string[]
  ): TemplateResult => {
    const window = this.tableController.columnWindow(this.fetchState, fields.length);
    const rawRow = index + 2; // +1 for the always-present header row, +1 to become 1-based
    const rowHighlights = this.tableController.highlightsForRow(rawRow);
    // The body shrinks to its content, so the last row sits on the frame's own bottom border; its
    // cell dividers would double that edge.
    const last = this.fetchState.kind === 'loaded' && index === this.fetchState.table.rows.length - 1;
    return html`<div part="data-row" role="presentation" style=${last ? `${window.style};--_lr-dataset-viewer-row-divider:0` : window.style}>
      ${window.columns.map((col) =>
        this.renderCell(row[fields[col]!] ?? '', col, rowHighlights, fields.length)
      )}
    </div>`;
  };

  // -- anchor resolution ---------------------------------------------------------------------------

  /** Scrolls raw-grid `(rawRow, col)` into view -- shared by `applyAnchor()` and every search
   *  navigation method, so both stay byte-identical in how a coordinate becomes a scroll. */
  private async jumpToCell(rawRow: number, col: number): Promise<boolean> {
    const loadedState = this.fetchState;
    if (loadedState.kind !== 'loaded') return false;
    const ownerDocument = this.ownerDocument;
    const isCurrent = (): boolean => this.isConnected && this.ownerDocument === ownerDocument && this.fetchState === loadedState;
    const { fields, rows } = loadedState.table;
    if (
      rawRow < 1 ||
      rawRow > rows.length + 1 ||
      col < 0 ||
      col >= fields.length
    )
      return false;
    await this.tableController.showColumn(this.fetchState, col, this.renderRoot.querySelector('[part="body"]'));
    if (!isCurrent()) return false;
    const bodyIndex = rawRow - 2; // -1 raw(1-based) -> 0-based, -1 for the always-present header row
    if (bodyIndex < 0) {
      return this.tableController.revealCell(this.renderRoot
        .querySelector('[part="header-row"]')
        ?.querySelector(`[aria-colindex="${col + 1}"]`) as HTMLElement | undefined);
    }
    this.tableController.setActiveRow(bodyIndex);
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

  private async scrollColumnIntoView(col: number): Promise<void> {
    await this.tableController.scrollColumnIntoView(this.renderRoot, tag('virtual-list'), col);
  }

  protected override async applyAnchor(anchor: LyraAnchor): Promise<boolean> {
    if (this.dataSource !== undefined) return this.provider.revealAnchor(anchor);
    if (anchor.kind !== 'cell-range' || anchor.sheet) return false; // dataset-viewer has no sheets
    const parsed = parseCellRange(anchor.range);
    if (!parsed) return false;
    return this.jumpToCell(parsed.startRow + 1, parsed.startCol);
  }

  // -- search ---------------------------------------------------------------------------------------

  /** Locale-aware case-insensitive substring search over the header fields followed by every body
   *  cell's raw string value, ordered row then column. An empty/whitespace-only query behaves like
   *  `clearSearch()` and resolves `0`. Returns at most 1,000 retained matches;
   *  `lr-search-change.detail.matchCountExact=false` identifies that return as a lower bound. */
  async search(query: string): Promise<number> {
    if (this.dataSource !== undefined) return this.provider.search(query);
    return this.tableController.runSearch(query, this.fetchState.kind === 'loaded', (visit) => {
      if (this.fetchState.kind !== 'loaded') return;
      const { fields, rows } = this.fetchState.table;
      for (let c = 0; c < fields.length; c++)
        if (!visit(fields[c]!, { row: 1, col: c })) return;
      for (let r = 0; r < rows.length; r++) {
        const row = rows[r]!;
        for (let c = 0; c < fields.length; c++)
          if (!visit(row[fields[c]!] ?? '', { row: r + 2, col: c })) return;
      }
    }, this.fetchState);
  }

  /** Advances to the next match, wrapping to the first after the last. Resolves `false` (no-op)
   *  when there are no matches. */
  async searchNext(): Promise<boolean> {
    if (this.dataSource !== undefined) return this.provider.step(1);
    return this.tableController.step(1);
  }

  /** Moves to the previous match, wrapping to the last before the first. Resolves `false` (no-op)
   *  when there are no matches. */
  async searchPrevious(): Promise<boolean> {
    if (this.dataSource !== undefined) return this.provider.step(-1);
    return this.tableController.step(-1);
  }

  /** Clears the query, matches, and active index, and resets `lr-search-change` to a
   *  0-match/no-active-index state. */
  clearSearch(): void {
    if (this.dataSource !== undefined) { this.provider.clearSearch(); return; }
    this.tableController.clearSearch();
  }

  private stopInternalEvent = (event: Event): void => {
    event.stopPropagation();
  };

  // Stable across every render (unlike an inline arrow literal in the template), and the
  // composed `<lr-virtual-list>`'s `.items` binding is `guard()`-ed against the same table's
  // `rows` reference -- together these keep an unrelated reactive update (e.g. `searchQuery`,
  // `activeRowKey`) from forcing a full O(n) offset recompute, since `.keyFunction` and `.items`
  // otherwise appear to change identity on every render even when the row data itself did not.
  private readonly virtualListKeyFunction = (_item: unknown, index: number): number => index;

  private renderBody(): TemplateResult {
    if (this.dataSource !== undefined) return this.provider.render();
    switch (this.fetchState.kind) {
      case 'loaded': {
        const { fields, rows } = this.fetchState.table;
        const window = this.tableController.columnWindow(this.fetchState, fields.length);
        const localizedCount = getNumberFormat(this.effectiveLocale).format(
          rows.length
        );
        const name = normalizeLabel(this.name);
        const label = name
          ? this.localize('datasetViewerCaptionNamed', undefined, {
              name,
              count: localizedCount,
            })
          : this.localize('datasetViewerCaption', undefined, {
              count: localizedCount,
            });
        const headerHighlights = this.tableController.highlightsForRow(1);
        return html`
          <div
            part="table"
            role="table"
            aria-label=${label}
            aria-rowcount=${rows.length + 1}
            aria-colcount=${fields.length}
          >
            <div part="header-row" role="row" aria-rowindex="1" style=${window.style}>
              ${guard([fields, window.columns, headerHighlights, this.activeHighlightId, this.effectiveLocale, this.strings, this.localize('highlightWithLabel'), this.localize('cellHighlightWithLabel')], () => window.columns.map((col) =>
                this.renderCell(fields[col]!, col, headerHighlights, fields.length, 'columnheader')
              ))}
            </div>
            <lr-virtual-list
              exportparts="data-row:data-row, cell:cell, cell-highlight:cell-highlight, cell-highlight-action:cell-highlight-action"
              .items=${guard([rows], () => rows.length <= 10000 ? rows : nothing)}
              .source=${this.tableController.indexedSource(rows)}
              .renderItem=${this.tableController.rowRenderer(rows, [fields, window.columns, this.activeHighlightId, this.strings], (row: unknown, index: number) =>
                this.renderRow(row as Record<string, string>, index, fields))}
              .keyFunction=${rows.length <= 10000 ? this.virtualListKeyFunction : undefined}
              .activeItemId=${this.tableController.activeRowKey}
              .scrollElement=${this.tableController.scrollWindow(this.scrollMode)}
              item-role="row"
              row-index-offset="1"
              @lr-load-more=${this.stopInternalEvent}
              @lr-visible-range-change=${this.stopInternalEvent}
              @lr-virtual-scroll=${this.stopInternalEvent}
            ></lr-virtual-list>
          </div>
        `;
      }
      case 'loading':
        return renderViewerLoading(this.localize('loadingDocument'));
      case 'empty':
        return html`<p class="empty-note">${this.localize(
          'datasetViewerEmpty'
        )}</p>`;
      case 'error':
        return html`<div part="error">${this.fetchState.message()}</div>`;
      case 'idle':
      default:
        return html`<p class="empty-note">${this.localize(
          'documentPreviewEmpty',
          undefined,
          { type: this.localize('documentPreviewTypeDataset') }
        )}</p>`;
    }
  }

  override render(): TemplateResult {
    const maxHeight = sanitizeCssLength(this.maxHeight);
    // `name` names the dataset region in EVERY fetch state, not just
    // once a table exists -- otherwise a landmark-navigating screen-reader user finds nothing at
    // all while the viewer is idle, loading, empty, or in error, which is every state except a
    // successful non-empty load. The richer row-count caption stays on the inner [part='table'].
    // A non-empty host name owns the overall semantics (the host takes the region role) and is never
    // copied to either shadow owner;
    // with neither name source there is no unnamed region (mirroring <lr-archive-viewer>).
    const label = viewerSemanticLabel(this, normalizeLabel(this.name) ?? null);
    const role = viewerSemanticRole(this, label !== null || viewerHostOwnsName(this) ? 'region' : null);
    const style = maxHeight
      ? styleMap({ '--lr-dataset-viewer-max-height': maxHeight })
      : nothing;
    return html`<div
      part="base"
      role=${role ?? nothing}
      aria-label=${label ?? nothing}
      aria-busy=${(this.dataSource !== undefined ? this.provider.busy : this.fetchState.kind === 'loading') ? 'true' : 'false'}
      style=${style}
    >
      <div part="body" @scroll=${(event: Event) => this.dataSource !== undefined ? this.provider.scrollColumns(event.currentTarget as HTMLElement) : this.tableController.scrollColumns(this.fetchState, event.currentTarget as HTMLElement)}>${this.renderBody()}</div>
      ${this.renderAnchorLiveRegion()}
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-dataset-viewer': LyraDatasetViewer;
  }
}
