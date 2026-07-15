import { html, type PropertyValues, type TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import { LyraElement } from '../../internal/lyra-element.js';
import { safeFetchUrl } from '../../internal/safe-url.js';
import { srOnly } from '../../internal/a11y.js';
import '../tabs/tabs.js';
import '../virtual-list/virtual-list.js';
import { loadSheetJsCached, type SheetJsApi } from './spreadsheet-loader.js';
import { styles } from './spreadsheet-viewer.styles.js';

interface SpreadsheetSheet { name: string; rows: unknown[][]; }
type SpreadsheetState = { kind: 'idle' } | { kind: 'loading' } | { kind: 'loaded'; sheets: SpreadsheetSheet[] } | { kind: 'error'; message: string };

function columns(rows: unknown[][]): number { return rows.reduce((max, row) => Math.max(max, row.length), 0); }
function cell(value: unknown): string { return value === undefined || value === null ? '' : String(value); }

export interface LyraSpreadsheetViewerEventMap { 'lyra-render-error': CustomEvent<{ error: unknown }>; }

/** Fetches and renders `.xlsx` and legacy `.xls` workbooks with virtualized rows and sheet tabs. */
export class LyraSpreadsheetViewer extends LyraElement<LyraSpreadsheetViewerEventMap> {
  static styles = [LyraElement.styles, styles, srOnly];
  /** URL to fetch and parse. */
  @property() src = '';
  /** Source filename or display name. */
  @property() name = '';
  @state() private fetchState: SpreadsheetState = { kind: 'idle' };
  private generation = 0;
  private loadLibrary: () => Promise<SheetJsApi | null> = loadSheetJsCached;

  protected willUpdate(changed: PropertyValues): void { if (!this.hasUpdated || changed.has('src')) void this.load(); }

  private async load(): Promise<void> {
    const generation = ++this.generation;
    if (!this.src) { this.fetchState = { kind: 'idle' }; return; }
    const url = safeFetchUrl(this.src);
    if (!url) { this.fetchState = { kind: 'error', message: this.localize('documentPreviewUrlNotAllowed') }; return; }
    this.fetchState = { kind: 'loading' };
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
      const library = await this.loadLibrary();
      if (generation !== this.generation) return;
      if (!library) { this.fetchState = { kind: 'error', message: this.localize('spreadsheetViewerUnavailable') }; return; }
      const workbook = library.read(await response.arrayBuffer(), { type: 'array' });
      const sheets = (workbook.SheetNames as string[]).map((name) => ({ name, rows: library.utils.sheet_to_json(workbook.Sheets[name], { header: 1 }) as unknown[][] }));
      if (generation === this.generation) this.fetchState = { kind: 'loaded', sheets };
    } catch (error) {
      if (generation !== this.generation) return;
      this.fetchState = { kind: 'error', message: error instanceof Error ? error.message : this.localize('documentPreviewFailedToLoad') };
      this.emit('lyra-render-error', { error });
    }
  }

  private renderRow(row: unknown[], count: number, part: 'header-row' | 'data-row'): TemplateResult {
    return html`<div part=${part} style=${`grid-template-columns:repeat(${count},minmax(var(--lyra-size-8rem),1fr))`}>${Array.from({ length: count }, (_unused, index) => html`<div part="cell">${cell(row[index])}</div>`)}</div>`;
  }

  private renderSheet(sheet: SpreadsheetSheet): TemplateResult {
    const [header, ...body] = sheet.rows;
    if (!header) return html`<p class="empty-note">${this.localize('noData')}</p>`;
    const count = columns(sheet.rows);
    return html`<div part="sheet">${this.renderRow(header, count, 'header-row')}<lyra-virtual-list part="rows" .items=${body} .renderItem=${(row: unknown) => this.renderRow(row as unknown[], count, 'data-row')} .keyFunction=${(_item: unknown, index: number) => index}></lyra-virtual-list></div>`;
  }

  private renderLoaded(sheets: SpreadsheetSheet[]): TemplateResult {
    if (!sheets.length) return html`<p class="empty-note">${this.localize('noData')}</p>`;
    if (sheets.length === 1) return this.renderSheet(sheets[0]);
    return html`<lyra-tabs part="tabs">${sheets.map((sheet, index) => html`<div slot=${`sheet-${index}`} label=${sheet.name}>${this.renderSheet(sheet)}</div>`)}</lyra-tabs>`;
  }

  render(): TemplateResult {
    const body = this.fetchState.kind === 'loaded' ? this.renderLoaded(this.fetchState.sheets) : this.fetchState.kind === 'loading' ? html`<div part="spinner" role="status"><span class="sr-only">${this.localize('loadingDocument')}</span></div>` : this.fetchState.kind === 'error' ? html`<div part="error" role="alert">${this.fetchState.message}</div>` : html`<p class="empty-note">${this.localize('documentPreviewEmpty', undefined, { type: this.localize('documentPreviewTypeDocument') })}</p>`;
    return html`<div part="base">${body}</div>`;
  }
}

declare global { interface HTMLElementTagNameMap { 'lyra-spreadsheet-viewer': LyraSpreadsheetViewer; } }
