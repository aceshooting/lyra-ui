import { html, type PropertyValues, type TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { safeFetchUrl } from '../../../internal/safe-url.js';
import { assertTableSize, isAbortError, isResourceLimitError, readResponseArrayBuffer } from '../../../internal/resource-loader.js';
import { srOnly } from '../../../internal/a11y.js';
import { prefersReducedMotion } from '../../../internal/motion.js';
import { DocumentAnchorTarget, type LyraAnchorTargetEventMap } from '../../../internal/anchor-target.js';
import { parseCellRange, type ParsedCellRange } from '../../../internal/cell-range.js';
import type { LyraAnchor, LyraAnchorKind, LyraHighlight } from '../document-viewer/anchors.js';
import '../../layout/tabs/tabs.js';
import '../../layout/virtual-list/virtual-list.js';
import { loadSheetJsCached, type SheetJsApi } from './spreadsheet-loader.js';
import { styles } from './spreadsheet-viewer.styles.js';

interface SpreadsheetSheet { name: string; rows: unknown[][]; }
type SpreadsheetState = { kind: 'idle' } | { kind: 'loading' } | { kind: 'loaded'; sheets: SpreadsheetSheet[] } | { kind: 'error'; message: string };

function columns(rows: unknown[][]): number { return rows.reduce((max, row) => Math.max(max, row.length), 0); }
function cell(value: unknown): string { return value === undefined || value === null ? '' : String(value); }

/** One `highlights` entry resolved against a sheet's parsed grid, alongside its parsed `cell-range`. */
interface ResolvedCellHighlight {
  highlight: LyraHighlight;
  parsed: ParsedCellRange;
}

export interface LyraSpreadsheetViewerEventMap extends LyraAnchorTargetEventMap {
  'lr-render-error': CustomEvent<{ error: unknown }>;
  /** Fired whenever the search query, match count, or active match index changes, from
   *  `search()`/`searchNext()`/`searchPrevious()`/`clearSearch()`. */
  'lr-search-change': CustomEvent<{ query: string; matchCount: number; activeIndex: number }>;
}

class LyraSpreadsheetViewerBase extends LyraElement<LyraSpreadsheetViewerEventMap> {}

/**
 * Fetches and renders `.xlsx` and legacy `.xls` workbooks with virtualized rows and sheet tabs.
 *
 * Adopts `DocumentAnchorTarget`: a `cell-range` anchor addresses one sheet's raw grid, 1-based, with
 * its (always-present) header row included -- matching how a spreadsheet app itself labels `A1`.
 * The target sheet resolves from the anchor's own `sheet` field (falling back to a `Sheet!`-prefixed
 * `range`, then the currently active sheet when neither is set); `scrollToAnchor()` switches
 * `<lr-tabs>`'s `active` tab first when the resolved sheet isn't already active, then scrolls the
 * addressed row into view via the virtualized list's `active-id`, then scrolls the first addressed
 * column horizontally into view. `highlights` paint as a focusable `part="cell-highlight"` on
 * membership, recomputed per row inside `renderRow()` so a row scrolled out and back in reconstructs
 * its highlight for free, with no persistent DOM to keep in sync. `search()` is a case-insensitive
 * substring match over every sheet's stringified cell values (the same stringification `cell()`
 * already renders), ordered sheet then row then column, switching tabs as navigation crosses sheets.
 *
 * @customElement lr-spreadsheet-viewer
 * @event lr-render-error - Fired when fetching or parsing fails.
 * @event lr-highlight-activate - A `highlights` cell was clicked, or activated via Enter/Space
 *   while focused. `detail: { id }`.
 * @event lr-anchor-result - Fired after an `anchor` property assignment or a `scrollToAnchor()`
 *   call is applied. `detail: { found }`.
 * @event lr-search-change - Fired whenever the search query, match count, or active match index
 *   changes, from `search()`/`searchNext()`/`searchPrevious()`/`clearSearch()`. `detail: { query,
 *   matchCount, activeIndex }`.
 * @csspart base - The root wrapper.
 * @csspart tabs - The sheet-switching `<lr-tabs>`, rendered only for a multi-sheet workbook.
 * @csspart sheet - The wrapper around one sheet's header row and virtualized body.
 * @csspart rows - The virtualized row list.
 * @csspart header-row - A sheet's header row.
 * @csspart data-row - One virtualized data row.
 * @csspart cell - One rendered cell.
 * @csspart cell-highlight - A cell covered by a `highlights` entry -- focusable, emits
 *   `lr-highlight-activate` on click or Enter/Space.
 * @csspart spinner - The loading status region.
 * @csspart error - The error message region.
 */
export class LyraSpreadsheetViewer extends DocumentAnchorTarget(LyraSpreadsheetViewerBase) {
  static styles = [LyraElement.styles, styles, srOnly];
  /** URL to fetch and parse. */
  @property() src = '';
  /** Source filename or display name, used as the viewer's accessible name. */
  @property() name = '';

  /** Anchor kinds this viewer resolves via `scrollToAnchor()`. */
  readonly anchorKinds: readonly LyraAnchorKind[] = ['cell-range'];

  @state() private fetchState: SpreadsheetState = { kind: 'idle' };
  /** Index into `fetchState.sheets` of the sheet currently shown -- bound to `<lr-tabs>`'s own
   *  `active` (as `sheet-${index}`), and switched by `scrollToAnchor()`/search navigation whenever
   *  a match lives on a different sheet. */
  @state() private activeSheetIndex = 0;
  /** The virtualized body row currently scrolled into view on the active sheet -- bound to
   *  `<lr-virtual-list>`'s own `active-id`. */
  @state() private activeRowKey: number | '' = '';
  @state() private searchMatches: { sheetIndex: number; row: number; col: number }[] = [];
  @state() private searchActiveIndex = -1;
  private searchQuery = '';
  private generation = 0;
  private loadLibrary: () => Promise<SheetJsApi | null> = loadSheetJsCached;

  protected willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed); // reaches DocumentAnchorTarget's own willUpdate (declarative `anchor`)
    if (changed.has('src')) {
      // A new document invalidates every previous sheet/row/column coordinate -- reset silently
      // (no event), mirroring <lr-pdf-viewer>'s identical src-change reset.
      this.searchQuery = '';
      this.searchMatches = [];
      this.searchActiveIndex = -1;
      this.activeRowKey = '';
      this.activeSheetIndex = 0;
    }
  }

  protected updated(changed: PropertyValues): void {
    super.updated(changed);
    if (changed.has('src')) this.scheduleAfterUpdate(() => { void this.load(); });
  }

  private async load(): Promise<void> {
    const generation = ++this.generation;
    const signal = this.beginAbortableLoad();
    if (!this.src) { this.fetchState = { kind: 'idle' }; return; }
    const url = safeFetchUrl(this.src);
    if (!url) { this.fetchState = { kind: 'error', message: this.localize('documentPreviewUrlNotAllowed') }; return; }
    this.fetchState = { kind: 'loading' };
    try {
      const response = await fetch(url, signal ? { signal } : undefined);
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
      const library = await this.loadLibrary();
      if (!this.isConnected || generation !== this.generation) return;
      if (!library) { this.fetchState = { kind: 'error', message: this.localize('spreadsheetViewerUnavailable') }; return; }
      const workbook = library.read(await readResponseArrayBuffer(response), { type: 'array' });
      const sheets = (workbook.SheetNames as string[]).map((name) => {
        const rows = library.utils.sheet_to_json(workbook.Sheets[name], { header: 1 }) as unknown[][];
        assertTableSize(rows);
        return { name, rows };
      });
      if (this.isConnected && generation === this.generation) this.fetchState = { kind: 'loaded', sheets };
    } catch (error) {
      if (isAbortError(error) || !this.isConnected || generation !== this.generation) return;
      this.fetchState = { kind: 'error', message: this.localize(isResourceLimitError(error) ? 'documentPreviewResourceTooLarge' : 'documentPreviewFailedToLoad') };
      this.emit('lr-render-error', { error });
    }
  }

  // -- cell highlights -----------------------------------------------------------------------------

  /** `rawRow` is 1-based, including the sheet's (always-present) header row -- the same raw-grid
   *  addressing convention every `cell-range` anchor uses. A highlight with no sheet resolved (from
   *  neither `anchor.sheet` nor a `Sheet!`-prefixed `range`) applies to every sheet. */
  private cellHighlightsForRow(rawRow: number, currentSheetName: string): ResolvedCellHighlight[] {
    return this.highlights.flatMap((highlight) => {
      if (highlight.anchor.kind !== 'cell-range') return [];
      const parsed = parseCellRange(highlight.anchor.range);
      if (!parsed) return [];
      const sheetName = highlight.anchor.sheet ?? parsed.sheet;
      if (sheetName !== undefined && sheetName !== currentSheetName) return [];
      return rawRow - 1 >= parsed.startRow && rawRow - 1 <= parsed.endRow ? [{ highlight, parsed }] : [];
    });
  }

  private renderCell(value: unknown, colIndex: number, rowHighlights: ResolvedCellHighlight[]): TemplateResult {
    const colHighlights = rowHighlights.filter((entry) => colIndex >= entry.parsed.startCol && colIndex <= entry.parsed.endCol);
    if (!colHighlights.length) return html`<div part="cell">${cell(value)}</div>`;
    const active = colHighlights.find((entry) => entry.highlight.id === this.activeHighlightId);
    const primary = active ?? colHighlights[0]!;
    const activate = (): void => { this.emit('lr-highlight-activate', { id: primary.highlight.id }); };
    // hit-area-exempt: dense data-grid cell, not an icon-only control
    return html`<div
      part="cell cell-highlight"
      role="button"
      ?data-active=${!!active}
      tabindex="0"
      aria-label=${primary.highlight.label || this.localize('viewerHighlightLabel')}
      @click=${activate}
      @keydown=${(e: KeyboardEvent) => {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        e.preventDefault();
        activate();
      }}
    >${cell(value)}</div>`;
  }

  private renderRow(row: unknown[], count: number, part: 'header-row' | 'data-row', rawRow: number, sheetName: string): TemplateResult {
    const rowHighlights = this.cellHighlightsForRow(rawRow, sheetName);
    return html`<div part=${part} style=${`grid-template-columns:repeat(${count},minmax(var(--lr-size-8rem),1fr))`}>${Array.from(
      { length: count },
      (_unused, index) => this.renderCell(row[index], index, rowHighlights),
    )}</div>`;
  }

  private renderSheet(sheet: SpreadsheetSheet, index: number): TemplateResult {
    const [header, ...body] = sheet.rows;
    if (!header) return html`<p class="empty-note">${this.localize('noData')}</p>`;
    const count = columns(sheet.rows);
    return html`<div part="sheet">${this.renderRow(header, count, 'header-row', 1, sheet.name)}<lr-virtual-list
      part="rows"
      data-sheet-index=${index}
      .items=${body}
      .renderItem=${(row: unknown, bodyIndex: number) => this.renderRow(row as unknown[], count, 'data-row', bodyIndex + 2, sheet.name)}
      .keyFunction=${(_item: unknown, bodyIndex: number) => bodyIndex}
      .activeId=${index === this.activeSheetIndex ? this.activeRowKey : ''}
    ></lr-virtual-list></div>`;
  }

  private renderLoaded(sheets: SpreadsheetSheet[]): TemplateResult {
    if (!sheets.length) return html`<p class="empty-note">${this.localize('noData')}</p>`;
    if (sheets.length === 1) return this.renderSheet(sheets[0]!, 0);
    return html`<lr-tabs part="tabs" .active=${`sheet-${this.activeSheetIndex}`} @lr-tabs-change=${this.onTabsChange}>${sheets.map((sheet, index) => html`<div slot=${`sheet-${index}`} label=${sheet.name}>${this.renderSheet(sheet, index)}</div>`)}</lr-tabs>`;
  }

  private onTabsChange = (e: CustomEvent<{ tabId: string }>): void => {
    const match = /^sheet-(\d+)$/.exec(e.detail.tabId);
    if (match) this.activeSheetIndex = Number(match[1]);
  };

  // -- anchor resolution ---------------------------------------------------------------------------

  /** Switches to `sheetIndex` (if needed) then scrolls raw-grid `(rawRow, col)` into view -- shared
   *  by `applyAnchor()` and every search navigation method, so both stay byte-identical in how a
   *  coordinate becomes a scroll. */
  private async jumpToCell(sheetIndex: number, rawRow: number, col: number): Promise<boolean> {
    if (this.fetchState.kind !== 'loaded') return false;
    const { sheets } = this.fetchState;
    if (sheetIndex < 0 || sheetIndex >= sheets.length) return false;
    const bodyIndex = rawRow - 2; // every sheet has exactly one (always-present) header row
    if (bodyIndex < 0) return false; // targets the header row itself -- not a virtualized row
    this.activeSheetIndex = sheetIndex;
    await this.updateComplete;
    this.activeRowKey = bodyIndex;
    await this.updateComplete;
    await this.scrollColumnIntoView(sheetIndex, col);
    return true;
  }

  protected async applyAnchor(anchor: LyraAnchor): Promise<boolean> {
    if (anchor.kind !== 'cell-range' || this.fetchState.kind !== 'loaded') return false;
    const parsed = parseCellRange(anchor.range);
    if (!parsed) return false;
    const sheetName = anchor.sheet ?? parsed.sheet;
    const sheetIndex = sheetName ? this.fetchState.sheets.findIndex((s) => s.name === sheetName) : this.activeSheetIndex;
    if (sheetIndex < 0) return false;
    return this.jumpToCell(sheetIndex, parsed.startRow + 1, parsed.startCol);
  }

  private async scrollColumnIntoView(sheetIndex: number, col: number): Promise<void> {
    const list = this.renderRoot.querySelector(`lr-virtual-list[data-sheet-index="${sheetIndex}"]`) as (HTMLElement & { updateComplete?: Promise<unknown> }) | null;
    if (list?.updateComplete) await list.updateComplete;
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    const row = list?.shadowRoot?.querySelector('[part="row"][aria-current="true"]');
    const target = row?.querySelectorAll('[part~="cell"]')[col] as HTMLElement | undefined;
    target?.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'nearest', inline: 'nearest' });
  }

  // -- search ---------------------------------------------------------------------------------------

  /** Case-insensitive substring search over every sheet's raw-grid cells (the same stringification
   *  `cell()` renders), ordered sheet then row then column -- each sheet's header row is included,
   *  the same raw-grid convention `cell-range` anchors use. An empty/whitespace-only query behaves
   *  like `clearSearch()` and resolves `0`. */
  async search(query: string): Promise<number> {
    this.searchQuery = query;
    const trimmed = query.trim().toLowerCase();
    const matches: { sheetIndex: number; row: number; col: number }[] = [];
    if (trimmed && this.fetchState.kind === 'loaded') {
      this.fetchState.sheets.forEach((sheet, sheetIndex) => {
        sheet.rows.forEach((row, r) => {
          row.forEach((value, c) => {
            if (cell(value).toLowerCase().includes(trimmed)) matches.push({ sheetIndex, row: r + 1, col: c });
          });
        });
      });
    }
    this.searchMatches = matches;
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
    this.searchActiveIndex = (this.searchActiveIndex + 1) % this.searchMatches.length;
    this.emitSearchChange();
    const match = this.searchMatches[this.searchActiveIndex]!;
    await this.jumpToCell(match.sheetIndex, match.row, match.col);
    return true;
  }

  /** Moves to the previous match, wrapping to the last before the first, switching sheets when the
   *  previous match lives on a different one. Resolves `false` (no-op) when there are no matches. */
  async searchPrevious(): Promise<boolean> {
    if (!this.searchMatches.length) return false;
    this.searchActiveIndex = (this.searchActiveIndex - 1 + this.searchMatches.length) % this.searchMatches.length;
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
    this.searchActiveIndex = -1;
    this.emit('lr-search-change', { query: '', matchCount: 0, activeIndex: -1 });
  }

  private emitSearchChange(): void {
    this.emit('lr-search-change', { query: this.searchQuery, matchCount: this.searchMatches.length, activeIndex: this.searchActiveIndex });
  }

  render(): TemplateResult {
    const body = this.fetchState.kind === 'loaded' ? this.renderLoaded(this.fetchState.sheets) : this.fetchState.kind === 'loading' ? html`<div part="spinner" role="status"><span class="sr-only">${this.localize('loadingDocument')}</span></div>` : this.fetchState.kind === 'error' ? html`<div part="error" role="alert">${this.fetchState.message}</div>` : html`<p class="empty-note">${this.localize('documentPreviewEmpty', undefined, { type: this.localize('documentPreviewTypeDocument') })}</p>`;
    return html`<div part="base" aria-label=${this.name || this.getAttribute('aria-label') || this.localize('spreadsheetViewerLabel')}>${body}${this.renderAnchorLiveRegion()}</div>`;
  }
}

declare global { interface HTMLElementTagNameMap { 'lr-spreadsheet-viewer': LyraSpreadsheetViewer; } }
