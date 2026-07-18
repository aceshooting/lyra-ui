import { html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import { LyraElement } from '../../internal/lyra-element.js';
import { safeFetchUrl } from '../../internal/safe-url.js';
import { assertTableDimensions, isAbortError, isResourceLimitError, LyraUserFacingError, readResponseText } from '../../internal/resource-loader.js';
import { srOnly } from '../../internal/a11y.js';
import { loadPapaParseCached } from '../../internal/papaparse-loader.js';
import { parseCellRange, type ParsedCellRange } from '../../internal/cell-range.js';
import { DocumentAnchorTarget, type LyraAnchorTargetEventMap } from '../../internal/anchor-target.js';
import type { LyraAnchor, LyraAnchorKind, LyraHighlight } from '../document-viewer/anchors.js';
import '../virtual-list/virtual-list.js';
import { styles } from './dataset-viewer.styles.js';

export interface DatasetTable { fields: string[]; rows: Record<string, string>[]; }
type DatasetFetchState = { kind: 'idle' } | { kind: 'loading' } | { kind: 'loaded'; table: DatasetTable } | { kind: 'error'; message: string };

export interface LyraDatasetViewerEventMap extends LyraAnchorTargetEventMap {
  'lr-render-error': CustomEvent<{ error: unknown }>;
  /** Fired whenever the search query, match count, or active match index changes, from
   *  `search()`/`searchNext()`/`searchPrevious()`/`clearSearch()`. */
  'lr-search-change': CustomEvent<{ query: string; matchCount: number; activeIndex: number }>;
}

/** One `highlights` entry resolved against the parsed grid, alongside its parsed `cell-range`. */
interface ResolvedCellHighlight {
  highlight: LyraHighlight;
  parsed: ParsedCellRange;
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
 * addressed row into view via the virtualized list's `active-id`. A `sheet`-qualified anchor never
 * resolves here -- this viewer has no sheets. `highlights` paint as a `part="cell-highlight"` cell
 * wrapping a focusable `part="cell-highlight-action"` native button (keeping the ARIA table tree
 * intact) on membership, recomputed per row inside `renderRow()` so a row scrolled out and back
 * in reconstructs its highlight for free, with no persistent DOM to keep in sync. `search()` is a
 * case-insensitive substring match over every body cell's raw string value, ordered row then column.
 *
 * @customElement lr-dataset-viewer
 * @event lr-render-error - Fired when the fetched text fails to parse, or exceeds the resource-size guard.
 * @event lr-highlight-activate - A `highlights` cell was clicked, or activated via Enter/Space
 *   while focused. `detail: { id }`.
 * @event lr-anchor-result - Fired after an `anchor` property assignment or a `scrollToAnchor()`
 *   call is applied. `detail: { found }`.
 * @event lr-search-change - Fired whenever the search query, match count, or active match index
 *   changes, from `search()`/`searchNext()`/`searchPrevious()`/`clearSearch()`. `detail: { query,
 *   matchCount, activeIndex }`.
 * @csspart base - The root wrapper.
 * @csspart body - The scrollable body wrapper.
 * @csspart table - The `role="table"` container (accessible name via `aria-label`).
 * @csspart header-row - The sticky header row (`role="row"`).
 * @csspart header-cell - A header cell (`role="columnheader"`).
 * @csspart data-row - One virtualized data row.
 * @csspart cell - One rendered cell (`role="cell"`).
 * @csspart cell-highlight - A cell (`role="cell"`) covered by a `highlights` entry; wraps the
 *   `cell-highlight-action` button.
 * @csspart cell-highlight-action - The native button filling a highlighted cell -- focusable,
 *   emits `lr-highlight-activate` on click or Enter/Space.
 * @csspart spinner - The loading status region.
 * @csspart error - The error message region.
 */
export class LyraDatasetViewer extends DocumentAnchorTarget(LyraDatasetViewerBase) {
  static styles = [LyraElement.styles, styles, srOnly];
  /** URL to fetch and parse as delimited text. */
  @property() src = '';
  /** Display name used for the table's accessible name. */
  @property() name = '';
  /** CSS length that caps the scrollable body. */
  @property({ attribute: 'max-height' }) maxHeight = '';

  /** Anchor kinds this viewer resolves via `scrollToAnchor()`. */
  readonly anchorKinds: readonly LyraAnchorKind[] = ['cell-range'];

  @state() private fetchState: DatasetFetchState = { kind: 'idle' };
  /** The virtualized body row currently scrolled into view via `scrollToAnchor()` or search
   *  navigation -- bound to `<lr-virtual-list>`'s own `active-id`. */
  @state() private activeRowKey: number | '' = '';
  @state() private searchMatches: { row: number; col: number }[] = [];
  @state() private searchActiveIndex = -1;
  private searchQuery = '';
  private generation = 0;

  protected willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed); // reaches DocumentAnchorTarget's own willUpdate (declarative `anchor`)
    if (changed.has('src')) {
      // A new document invalidates every previous row/column coordinate -- reset silently (no
      // event), mirroring <lr-csv-viewer>'s identical src-change reset.
      this.searchQuery = '';
      this.searchMatches = [];
      this.searchActiveIndex = -1;
      this.activeRowKey = '';
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
      const table = await this.parse(await readResponseText(response));
      if (this.isConnected && generation === this.generation) this.fetchState = { kind: 'loaded', table };
    } catch (error) {
      if (isAbortError(error) || !this.isConnected || generation !== this.generation) return;
      this.fetchState = { kind: 'error', message: error instanceof LyraUserFacingError ? error.message : this.localize(isResourceLimitError(error) ? 'documentPreviewResourceTooLarge' : 'documentPreviewFailedToLoad') };
      this.emit('lr-render-error', { error });
    }
  }

  private async parse(text: string): Promise<DatasetTable> {
    const papa = await loadPapaParseCached();
    if (!papa) throw new LyraUserFacingError(this.localize('datasetViewerMissingParser'));
    const result = papa.parse(text, { delimiter: '', header: true, skipEmptyLines: true }) as { data: Record<string, string>[]; meta: { fields?: string[] } };
    const fields = result.meta.fields ?? [];
    if (!fields.length || !result.data.length) throw new LyraUserFacingError(this.localize('datasetViewerEmpty'));
    assertTableDimensions(result.data.length, fields.length);
    return { fields, rows: result.data };
  }

  // -- cell highlights -----------------------------------------------------------------------------

  /** `rawRow` is 1-based, always including the header row -- the same raw-file-grid addressing
   *  convention every `cell-range` anchor uses. */
  private cellHighlightsForRow(rawRow: number): ResolvedCellHighlight[] {
    return this.highlights.flatMap((highlight) => {
      if (highlight.anchor.kind !== 'cell-range' || highlight.anchor.sheet) return []; // dataset-viewer has no sheets
      const parsed = parseCellRange(highlight.anchor.range);
      if (!parsed) return [];
      return rawRow - 1 >= parsed.startRow && rawRow - 1 <= parsed.endRow ? [{ highlight, parsed }] : [];
    });
  }

  private renderCell(value: string, colIndex: number, rowHighlights: ResolvedCellHighlight[]): TemplateResult {
    const colHighlights = rowHighlights.filter((entry) => colIndex >= entry.parsed.startCol && colIndex <= entry.parsed.endCol);
    if (!colHighlights.length) return html`<div part="cell" role="cell">${value}</div>`;
    const active = colHighlights.find((entry) => entry.highlight.id === this.activeHighlightId);
    const primary = active ?? colHighlights[0]!;
    const activate = (): void => { this.emit('lr-highlight-activate', { id: primary.highlight.id }); };
    // The outer element must stay a plain `role="cell"` so the ARIA table tree (table > row >
    // cell) remains valid; the activation affordance is a nested native <button>, which carries
    // the button role plus Enter/Space activation on its own, without disturbing that structure.
    return html`<div part="cell cell-highlight" role="cell" ?data-active=${!!active} style=${active ? '--lr-dataset-viewer-highlight-color: var(--lr-color-warning, var(--lr-color-brand))' : ''}>
      <button
        part="cell-highlight-action"
        type="button"
        aria-label=${primary.highlight.label || this.localize('viewerHighlightLabel')}
        @click=${activate}
      >${value}</button>
    </div>`;
  }

  private renderRow = (row: Record<string, string>, index: number, fields: string[]): TemplateResult => {
    const rawRow = index + 2; // +1 for the always-present header row, +1 to become 1-based
    const rowHighlights = this.cellHighlightsForRow(rawRow);
    return html`<div part="data-row" role="presentation">${fields.map((field, col) => this.renderCell(row[field] ?? '', col, rowHighlights))}</div>`;
  };

  // -- anchor resolution ---------------------------------------------------------------------------

  /** Scrolls raw-grid row `rawRow` into view -- shared by `applyAnchor()` and every search
   *  navigation method, so both stay byte-identical in how a row coordinate becomes a scroll. There
   *  is no independent horizontal/column scroll here (unlike `<lr-csv-viewer>`'s `has-header-row`
   *  grid, this viewer's fixed-width grid columns fit its container without one). */
  private async jumpToCell(rawRow: number): Promise<boolean> {
    if (this.fetchState.kind !== 'loaded') return false;
    const bodyIndex = rawRow - 2; // -1 raw(1-based) -> 0-based, -1 for the always-present header row
    if (bodyIndex < 0 || bodyIndex >= this.fetchState.table.rows.length) return false;
    this.activeRowKey = bodyIndex;
    await this.updateComplete;
    return true;
  }

  protected async applyAnchor(anchor: LyraAnchor): Promise<boolean> {
    if (anchor.kind !== 'cell-range' || anchor.sheet) return false; // dataset-viewer has no sheets
    const parsed = parseCellRange(anchor.range);
    if (!parsed) return false;
    return this.jumpToCell(parsed.startRow + 1);
  }

  // -- search ---------------------------------------------------------------------------------------

  /** Case-insensitive substring search over every body cell's raw string value, ordered row then
   *  column -- the always-present header row itself has no cell values to search (its text lives in
   *  `fields`, not `rows`). An empty/whitespace-only query behaves like `clearSearch()` and resolves
   *  `0`. */
  async search(query: string): Promise<number> {
    this.searchQuery = query;
    const trimmed = query.trim().toLowerCase();
    const matches: { row: number; col: number }[] = [];
    if (trimmed && this.fetchState.kind === 'loaded') {
      const { fields, rows } = this.fetchState.table;
      rows.forEach((row, r) => {
        fields.forEach((field, c) => {
          if ((row[field] ?? '').toLowerCase().includes(trimmed)) matches.push({ row: r + 2, col: c });
        });
      });
    }
    this.searchMatches = matches;
    this.searchActiveIndex = matches.length > 0 ? 0 : -1;
    this.emitSearchChange();
    if (this.searchActiveIndex >= 0) await this.jumpToCell(matches[0]!.row);
    return matches.length;
  }

  /** Advances to the next match, wrapping to the first after the last. Resolves `false` (no-op)
   *  when there are no matches. */
  async searchNext(): Promise<boolean> {
    if (!this.searchMatches.length) return false;
    this.searchActiveIndex = (this.searchActiveIndex + 1) % this.searchMatches.length;
    this.emitSearchChange();
    await this.jumpToCell(this.searchMatches[this.searchActiveIndex]!.row);
    return true;
  }

  /** Moves to the previous match, wrapping to the last before the first. Resolves `false` (no-op)
   *  when there are no matches. */
  async searchPrevious(): Promise<boolean> {
    if (!this.searchMatches.length) return false;
    this.searchActiveIndex = (this.searchActiveIndex - 1 + this.searchMatches.length) % this.searchMatches.length;
    this.emitSearchChange();
    await this.jumpToCell(this.searchMatches[this.searchActiveIndex]!.row);
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

  private renderBody(): TemplateResult {
    switch (this.fetchState.kind) {
      case 'loaded': {
        const { fields, rows } = this.fetchState.table;
        const label = this.name
          ? this.localize('datasetViewerCaptionNamed', undefined, { name: this.name, count: rows.length })
          : this.localize('datasetViewerCaption', undefined, { count: rows.length });
        return html`
          <div part="table" role="table" aria-label=${label} aria-rowcount=${rows.length + 1} aria-colcount=${fields.length}>
            <div part="header-row" role="row" aria-rowindex="1">
              ${fields.map((field) => html`<div part="header-cell" role="columnheader">${field}</div>`)}
            </div>
            <lr-virtual-list
              .items=${rows}
              .renderItem=${(row: unknown, index: number) => this.renderRow(row as Record<string, string>, index, fields)}
              .keyFunction=${(_item: unknown, index: number) => index}
              .activeId=${this.activeRowKey}
              item-role="row"
              row-index-offset="1"
            ></lr-virtual-list>
          </div>
        `;
      }
      case 'loading': return html`<div part="spinner" role="status"><span class="sr-only">${this.localize('loadingDocument')}</span></div>`;
      case 'error': return html`<div part="error" role="alert">${this.fetchState.message}</div>`;
      case 'idle':
      default: return html`<p class="empty-note">${this.localize('documentPreviewEmpty', undefined, { type: this.localize('documentPreviewTypeDataset') })}</p>`;
    }
  }

  render(): TemplateResult {
    return html`<div part="base" style=${this.maxHeight ? `--lr-dataset-viewer-max-height:${this.maxHeight}` : nothing}><div part="body">${this.renderBody()}</div>${this.renderAnchorLiveRegion()}</div>`;
  }
}

declare global { interface HTMLElementTagNameMap { 'lr-dataset-viewer': LyraDatasetViewer; } }
