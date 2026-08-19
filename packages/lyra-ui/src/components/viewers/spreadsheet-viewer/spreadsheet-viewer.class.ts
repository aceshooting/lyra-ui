import { html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import { styleMap } from 'lit/directives/style-map.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import {
  assertTableDimensions,
  assertTableSize,
  isAbortError,
  isResourceLimitError,
  LyraResourceLimitError,
  LyraUserFacingError,
  readResponseArrayBuffer,
  resolveOwnerFetchTarget,
} from '../../../internal/resource-loader.js';
import { sanitizeCssLength } from '../../../internal/safe-css.js';
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
import { loadSheetJsCached, type SheetJsApi } from './spreadsheet-loader.js';
import { styles } from './spreadsheet-viewer.styles.js';
import { assertXlsxArchiveWithinLimits } from './xlsx-resource-guard.js';
import { getNumberFormat } from '../../../internal/intl-cache.js';
import { ViewerAnnouncementController } from '../viewer-announcements.js';
import {
  viewerSemanticLabel,
  viewerSemanticRole,
} from '../viewer-semantic-owner.js';
import { renderViewerLoading, viewerLoadingStyles } from '../viewer-loading.js';
import type { LyraSearchChangeDetail } from '../../../internal/text-viewer-target.js';
import {
  boundedViewerSearchQuery,
  ViewerSearchWorkBudget,
} from '../viewer-search-limits.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_anchorJumped, LYRA_DEFAULT_anchorJumpedToPage, LYRA_DEFAULT_anchorNotFound, LYRA_DEFAULT_cellHighlightWithLabel, LYRA_DEFAULT_documentPreviewEmpty, LYRA_DEFAULT_documentPreviewFailedToLoad, LYRA_DEFAULT_documentPreviewResourceTooLarge, LYRA_DEFAULT_documentPreviewTypeDocument, LYRA_DEFAULT_documentPreviewUrlNotAllowed, LYRA_DEFAULT_highlightWithLabel, LYRA_DEFAULT_loadingDocument, LYRA_DEFAULT_noData, LYRA_DEFAULT_spreadsheetViewerLabel, LYRA_DEFAULT_spreadsheetViewerUnavailable } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END

interface SpreadsheetSheet {
  name: string;
  rows: unknown[][];
}
type SpreadsheetState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'loaded'; sheets: SpreadsheetSheet[] }
  | { kind: 'error'; message: string };
type OwnedAnimationFrameWait = {
  owner: Window;
  handle?: number;
  resolve: (isCurrent: boolean) => void;
};
const MAX_SPREADSHEET_SHEETS = 256;
const MAX_SPREADSHEET_CELLS = 1_000_000;
const MAX_SEARCH_MATCHES = 1_000;

function columns(rows: unknown[][]): number {
  return rows.reduce((max, row) => Math.max(max, row.length), 0);
}
function cell(value: unknown, locale: string): string {
  if (value === undefined || value === null) return '';
  return typeof value === 'number'
    ? getNumberFormat(locale).format(value)
    : String(value);
}

/** One `highlights` entry resolved against a sheet's parsed grid, alongside its parsed `cell-range`. */
interface ResolvedCellHighlight {
  highlight: LyraHighlight;
  parsed: ParsedCellRange;
}

export interface LyraSpreadsheetViewerEventMap
  extends Omit<LyraAnchorTargetEventMap, 'lr-text-select'> {
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
 *
 * @customElement lr-spreadsheet-viewer
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
 * @csspart tabs - The sheet-switching `<lr-tab-group>`, rendered only for a multi-sheet workbook.
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
 * @cssprop [--lr-spreadsheet-viewer-highlight-color=var(--lr-color-brand)] - Outline color of a
 *   highlighted cell. The active highlight changes a private warning-color default; an inherited
 *   or direct public value remains authoritative.
 * @cssprop [--lr-spreadsheet-viewer-highlight-outline-offset=calc(-1 * var(--lr-border-width-medium))] -
 *   Outline offset of a highlighted cell.
 * @cssprop [--lr-spreadsheet-viewer-max-height=none] - Maximum block size of `[part="body"]`
 *   before it scrolls internally. The `maxHeight` property sets this token inline on
 *   `[part="base"]`.
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
    documentPreviewEmpty: LYRA_DEFAULT_documentPreviewEmpty,
    documentPreviewFailedToLoad: LYRA_DEFAULT_documentPreviewFailedToLoad,
    documentPreviewResourceTooLarge: LYRA_DEFAULT_documentPreviewResourceTooLarge,
    documentPreviewTypeDocument: LYRA_DEFAULT_documentPreviewTypeDocument,
    documentPreviewUrlNotAllowed: LYRA_DEFAULT_documentPreviewUrlNotAllowed,
    highlightWithLabel: LYRA_DEFAULT_highlightWithLabel,
    loadingDocument: LYRA_DEFAULT_loadingDocument,
    noData: LYRA_DEFAULT_noData,
    spreadsheetViewerLabel: LYRA_DEFAULT_spreadsheetViewerLabel,
    spreadsheetViewerUnavailable: LYRA_DEFAULT_spreadsheetViewerUnavailable,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  static override styles = [LyraElement.styles, styles, viewerLoadingStyles];
  /** URL to fetch and parse. */
  @property() src = '';
  /** Source filename or display name, used as the viewer's accessible name. */
  @property() name = '';
  /** A CSS `max-height`; invalid values are ignored. */
  @property({ attribute: 'max-height' }) maxHeight = '';

  /** Anchor kinds this viewer resolves via `scrollToAnchor()`. */
  override readonly anchorKinds: readonly LyraAnchorKind[] = ['cell-range'];

  @state() private fetchState: SpreadsheetState = { kind: 'idle' };
  /** Index into `fetchState.sheets` of the sheet currently shown -- bound to `<lr-tab-group>`'s own
   *  `active` (as `sheet-${index}`), and switched by `scrollToAnchor()`/search navigation whenever
   *  a match lives on a different sheet. */
  @state() private activeSheetIndex = 0;
  /** The virtualized body row currently scrolled into view on the active sheet -- bound to
   *  `<lr-virtual-list>`'s own `active-item-id`. */
  @state() private activeRowKey: number | '' = '';
  @state() private searchMatches: {
    sheetIndex: number;
    row: number;
    col: number;
  }[] = [];
  private searchMatchCountExact = true;
  @state() private searchActiveIndex = -1;
  private searchQuery = '';
  private lastSearchLocale = '';
  private pendingSearchResetEvent = false;
  private generation = 0;
  private loadLibrary: () => Promise<SheetJsApi | null> = loadSheetJsCached;
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
    this.generation++;
    this.cancelPendingAnimationFrames();
    // Reset rather than leaving a stale "loaded" state behind: without this, a reconnect with an
    // unchanged `src` (connectedCallback() re-triggers the load below, but only once the next
    // update completes) would keep rendering the previously-loaded sheet grid as if it were still
    // live -- interactive and scrollable against data that's about to be replaced -- instead of an
    // idle/loading state during the reload window. Mirrors svg-viewer.class.ts's unconditional
    // reset (this viewer, like svg-viewer, has no inline-data alternative to `src` that would make
    // the reset conditional, unlike xml-viewer/notebook-viewer's own disconnectedCallback).
    this.fetchState = { kind: 'idle' };
    // Mirrors willUpdate()'s own `changed.has('src')` reset block -- the same dependent state a
    // `src` change already clears must not survive a disconnect/reconnect cycle either. Deliberately
    // NOT routed through `pendingSearchResetEvent`: that flag is only ever consumed inside
    // `updated()`'s `changed.has('src')` branch, which a same-`src` reconnect never re-triggers, so
    // setting it here could leave it stuck (or attribute a stale reset to a later, unrelated `src`
    // change); a disconnect resets state silently, matching every sibling viewer's own
    // disconnectedCallback (none of them emit an event from here either).
    this.searchQuery = '';
    this.searchMatches = [];
    this.searchMatchCountExact = true;
    this.searchActiveIndex = -1;
    this.activeRowKey = '';
    this.activeSheetIndex = 0;
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
      this.pendingSearchResetEvent ||= this.searchQuery !== ''
        || this.searchMatches.length > 0
        || !this.searchMatchCountExact
        || this.searchActiveIndex !== -1;
      this.searchQuery = '';
      this.searchMatches = [];
      this.searchMatchCountExact = true;
      this.searchActiveIndex = -1;
      this.activeRowKey = '';
      this.activeSheetIndex = 0;
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
    if (changed.has('src') && this.pendingSearchResetEvent) {
      this.pendingSearchResetEvent = false;
      this.emitSearchChange();
    }
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
    const generation = ++this.generation;
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
      if (!this.isConnected || generation !== this.generation) return;
      if (!response.ok)
        throw new Error(`${response.status} ${response.statusText}`);
      const library = await this.loadLibrary();
      if (!this.isConnected || generation !== this.generation) return;
      if (!library) {
        const error = new LyraUserFacingError(
          this.localize('spreadsheetViewerUnavailable')
        );
        this.fetchState = { kind: 'error', message: error.message };
        this.emit('lr-render-error', { error });
        return;
      }
      const source = await readResponseArrayBuffer(response);
      if (!this.isConnected || generation !== this.generation) return;
      await assertXlsxArchiveWithinLimits(source, undefined, undefined, {
        signal,
      });
      if (!this.isConnected || generation !== this.generation) return;
      const workbook = library.read(source, { type: 'array' });
      if (!this.isConnected || generation !== this.generation) return;
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
      let totalRows = 0;
      let maxColumns = 0;
      let totalCells = 0;
      for (const name of sheetNames) {
        const rows = library.utils.sheet_to_json(workbook.Sheets[name], {
          header: 1,
        }) as unknown[][];
        assertTableSize(rows);
        totalRows += rows.length;
        maxColumns = Math.max(maxColumns, columns(rows));
        totalCells += rows.reduce((sum, row) => sum + row.length, 0);
        if (totalCells > MAX_SPREADSHEET_CELLS) {
          throw new LyraResourceLimitError(
            'The spreadsheet contains too many expanded cells.'
          );
        }
        assertTableDimensions(totalRows, maxColumns);
        sheets.push({ name, rows });
      }
      if (this.isConnected && generation === this.generation) {
        this.fetchState = { kind: 'loaded', sheets };
        if (this.searchQuery) await this.search(this.searchQuery);
      }
    } catch (error) {
      if (
        isAbortError(error) ||
        !this.isConnected ||
        generation !== this.generation
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

  /** `rawRow` is 1-based, including the sheet's (always-present) header row -- the same raw-grid
   *  addressing convention every `cell-range` anchor uses. A highlight with no sheet resolved (from
   *  neither `anchor.sheet` nor a `Sheet!`-prefixed `range`) applies to every sheet. */
  private cellHighlightsForRow(
    rawRow: number,
    currentSheetName: string
  ): ResolvedCellHighlight[] {
    const seen = new Set<string>();
    return this.highlights
      .filter((highlight) => {
        if (seen.has(highlight.id)) return false;
        seen.add(highlight.id);
        return true;
      })
      .flatMap((highlight) => {
        if (highlight.anchor.kind !== 'cell-range') return [];
        const parsed = parseCellRange(highlight.anchor.range);
        if (!parsed) return [];
        const sheetName = highlight.anchor.sheet ?? parsed.sheet;
        if (sheetName !== undefined && sheetName !== currentSheetName)
          return [];
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
    const text = cell(value, this.effectiveLocale);
    const colHighlights = rowHighlights.filter(
      (entry) =>
        colIndex >= entry.parsed.startCol && colIndex <= entry.parsed.endCol
    );
    if (!colHighlights.length)
      return html`<div part="cell" role=${role}>${text}</div>`;
    const active = colHighlights.find(
      (entry) => entry.highlight.id === this.activeHighlightId
    );
    const primary = active ?? colHighlights[0]!;
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
        ? '--_lr-spreadsheet-viewer-highlight-color: var(--lr-color-warning, var(--lr-color-brand))'
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
    rawRow: number,
    sheetName: string
  ): TemplateResult {
    const rowHighlights = this.cellHighlightsForRow(rawRow, sheetName);
    const header = part === 'header-row';
    return html`<div
      part=${part}
      role=${header ? 'row' : 'presentation'}
      aria-rowindex=${header ? '1' : nothing}
      style=${`grid-template-columns:repeat(${count},minmax(var(--lr-size-8rem),1fr))`}
      >${Array.from({ length: count }, (_unused, index) =>
        this.renderCell(
          row[index],
          index,
          rowHighlights,
          header ? 'columnheader' : 'cell'
        )
      )}</div
    >`;
  }

  private renderSheet(sheet: SpreadsheetSheet, index: number): TemplateResult {
    const [header, ...body] = sheet.rows;
    if (!header)
      return html`<p class="empty-note">${this.localize('noData')}</p>`;
    const count = columns(sheet.rows);
    return html`<div
      part="sheet"
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
        .items=${body}
        .renderItem=${(row: unknown, bodyIndex: number) =>
          this.renderRow(
            row as unknown[],
            count,
            'data-row',
            bodyIndex + 2,
            sheet.name
          )}
        .keyFunction=${(_item: unknown, bodyIndex: number) => bodyIndex}
        .activeItemId=${index === this.activeSheetIndex ? this.activeRowKey : ''}
        item-role="row"
        row-index-offset="1"
        @lr-load-more=${this.stopInternalEvent}
        @lr-visible-range-changed=${this.stopInternalEvent}
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
      part="tabs"
      .active=${`sheet-${this.activeSheetIndex}`}
      @lr-tab-show=${this.onTabsChange}
      >${sheets.map(
        (sheet, index) =>
          html`<lr-tab panel=${`sheet-${index}`}>${sheet.name}</lr-tab>`
      )}${sheets.map(
        (sheet, index) =>
          html`<lr-tab-panel name=${`sheet-${index}`}
            >${this.renderSheet(sheet, index)}</lr-tab-panel
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
    const { sheets } = loadedState;
    if (sheetIndex < 0 || sheetIndex >= sheets.length) return false;
    const sheet = sheets[sheetIndex]!;
    if (
      rawRow < 1 ||
      rawRow > sheet.rows.length ||
      col < 0 ||
      col >= columns(sheet.rows)
    )
      return false;
    const bodyIndex = rawRow - 2; // every sheet has exactly one (always-present) header row
    this.activeSheetIndex = sheetIndex;
    await this.updateComplete;
    if (bodyIndex < 0) {
      const target = this.renderRoot
        .querySelector(
          `[part="sheet"][data-sheet-index="${sheetIndex}"] [part="header-row"]`
        )
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
    await this.scrollColumnIntoView(sheetIndex, col);
    // `fetchState` is only ever reassigned by load(), so an identity change across the awaits above
    // means a concurrent `src` reassignment replaced the workbook mid-jump (a citation/file-tab
    // click landing on top of a still-resolving jump). The coordinate this call resolved belongs to
    // the previous document and nothing was scrolled into view for the current one, so report the
    // failure rather than letting the shared retry loop accept a phantom success and fire
    // `lr-anchor-result: { found: true }`.
    return this.fetchState === loadedState;
  }

  protected async applyAnchor(anchor: LyraAnchor): Promise<boolean> {
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
    const list = this.renderRoot.querySelector(
      `lr-virtual-list[data-sheet-index="${sheetIndex}"]`
    ) as (HTMLElement & { updateComplete?: Promise<unknown> }) | null;
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

  /** Case-insensitive substring search over every sheet's raw-grid cells (the same stringification
   *  `cell()` renders), ordered sheet then row then column -- each sheet's header row is included,
   *  the same raw-grid convention `cell-range` anchors use. An empty/whitespace-only query behaves
   *  like `clearSearch()` and resolves `0`. Returns at most 1,000 retained matches;
   *  `lr-search-change.detail.matchCountExact=false` identifies that return as a lower bound. */
  async search(query: string): Promise<number> {
    this.searchQuery = query;
    this.lastSearchLocale = this.effectiveLocale;
    const boundedQuery = boundedViewerSearchQuery(query, this.effectiveLocale);
    const trimmed = boundedQuery.needle;
    const matches: { sheetIndex: number; row: number; col: number }[] = [];
    let matchCountExact = boundedQuery.accepted;
    if (boundedQuery.accepted && trimmed && this.fetchState.kind === 'loaded') {
      const budget = new ViewerSearchWorkBudget();
      searchCells: for (
        let sheetIndex = 0;
        sheetIndex < this.fetchState.sheets.length;
        sheetIndex++
      ) {
        const sheet = this.fetchState.sheets[sheetIndex]!;
        for (let r = 0; r < sheet.rows.length; r++) {
          const row = sheet.rows[r]!;
          for (let c = 0; c < row.length; c++) {
            if (
              budget.includes(
                cell(row[c], this.effectiveLocale),
                trimmed,
                this.effectiveLocale
              )
            ) {
              if (matches.length === MAX_SEARCH_MATCHES) {
                matchCountExact = false;
                break searchCells;
              }
              matches.push({ sheetIndex, row: r + 1, col: c });
            }
            if (!budget.complete) {
              matchCountExact = false;
              break searchCells;
            }
          }
        }
      }
    }
    this.searchMatches = matches;
    this.searchMatchCountExact = matchCountExact;
    this.searchActiveIndex = matches.length > 0 ? 0 : -1;
    this.emitSearchChange();
    if (this.searchActiveIndex >= 0) {
      const first = matches[0]!;
      await this.jumpToCell(first.sheetIndex, first.row, first.col);
    }
    return matches.length;
  }

  /** Advances to the next match, wrapping to the first after the last, switching sheets when the
   *  next match lives on a different one. Resolves `false` (no-op) when there are no matches. */
  async searchNext(): Promise<boolean> {
    if (!this.searchMatches.length) return false;
    this.searchActiveIndex =
      (this.searchActiveIndex + 1) % this.searchMatches.length;
    this.emitSearchChange();
    const match = this.searchMatches[this.searchActiveIndex]!;
    await this.jumpToCell(match.sheetIndex, match.row, match.col);
    return true;
  }

  /** Moves to the previous match, wrapping to the last before the first, switching sheets when the
   *  previous match lives on a different one. Resolves `false` (no-op) when there are no matches. */
  async searchPrevious(): Promise<boolean> {
    if (!this.searchMatches.length) return false;
    this.searchActiveIndex =
      (this.searchActiveIndex - 1 + this.searchMatches.length) %
      this.searchMatches.length;
    this.emitSearchChange();
    const match = this.searchMatches[this.searchActiveIndex]!;
    await this.jumpToCell(match.sheetIndex, match.row, match.col);
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
    const body =
      this.fetchState.kind === 'loaded'
        ? this.renderLoaded(this.fetchState.sheets)
        : this.fetchState.kind === 'loading'
        ? renderViewerLoading(this.localize('loadingDocument'))
        : this.fetchState.kind === 'error'
        ? html`<div part="error">${this.fetchState.message}</div>`
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
      aria-busy=${this.fetchState.kind === 'loading' ? 'true' : 'false'}
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
