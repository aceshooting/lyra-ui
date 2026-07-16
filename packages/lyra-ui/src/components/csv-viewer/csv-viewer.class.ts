import { html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import { LyraElement } from '../../internal/lyra-element.js';
import { safeFetchUrl } from '../../internal/safe-url.js';
import { assertTableSize, isAbortError, isResourceLimitError, readResponseText } from '../../internal/resource-loader.js';
import { srOnly } from '../../internal/a11y.js';
import '../virtual-list/virtual-list.js';
import { loadPapaParseCached, type PapaParseApi } from '../../internal/papaparse-loader.js';
import { styles } from './csv-viewer.styles.js';

type CsvState = { kind: 'idle' } | { kind: 'loading' } | { kind: 'loaded'; rows: unknown[][] } | { kind: 'error'; message: string };
function columns(rows: unknown[][]): number { return rows.reduce((max, row) => Math.max(max, row.length), 0); }
function cell(value: unknown): string { return value === undefined || value === null ? '' : String(value); }

export interface LyraCsvViewerEventMap { 'lyra-render-error': CustomEvent<{ error: unknown }>; }

/** Fetches CSV text, parses quoted fields with PapaParse, and virtualizes its rows. */
export class LyraCsvViewer extends LyraElement<LyraCsvViewerEventMap> {
  static styles = [LyraElement.styles, styles, srOnly];
  /** URL to fetch and parse. */
  @property() src = '';
  /** Source filename or display name, used as the viewer's accessible name. */
  @property() name = '';
  /** Whether the first parsed row is rendered as a sticky header. */
  @property({ type: Boolean, attribute: 'has-header-row' }) hasHeaderRow = true;
  @state() private fetchState: CsvState = { kind: 'idle' };
  private generation = 0;
  private loadLibrary: () => Promise<PapaParseApi | null> = loadPapaParseCached;

  protected updated(changed: PropertyValues): void {
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
      if (!library) { this.fetchState = { kind: 'error', message: this.localize('csvViewerUnavailable') }; return; }
      const result = library.parse(await readResponseText(response), { skipEmptyLines: true }) as { data: unknown[][]; errors: unknown[] };
      assertTableSize(result.data);
      if (!this.isConnected || generation !== this.generation) return;
      this.fetchState = { kind: 'loaded', rows: result.data };
      if (result.errors.length) this.emit('lyra-render-error', { error: result.errors });
    } catch (error) {
      if (isAbortError(error) || !this.isConnected || generation !== this.generation) return;
      this.fetchState = { kind: 'error', message: this.localize(isResourceLimitError(error) ? 'documentPreviewResourceTooLarge' : 'documentPreviewFailedToLoad') };
      this.emit('lyra-render-error', { error });
    }
  }

  private renderRow(row: unknown[], count: number, part: 'header-row' | 'data-row'): TemplateResult {
    return html`<div part=${part} style=${`grid-template-columns:repeat(${count},minmax(var(--lyra-size-8rem),1fr))`}>${Array.from({ length: count }, (_unused, index) => html`<div part="cell">${cell(row[index])}</div>`)}</div>`;
  }

  render(): TemplateResult {
    let content: TemplateResult;
    if (this.fetchState.kind === 'loaded') {
      const rows = this.fetchState.rows;
      if (!rows.length) content = html`<p class="empty-note">${this.localize('noData')}</p>`;
      else {
        const header = this.hasHeaderRow ? rows[0] : undefined;
        const body = this.hasHeaderRow ? rows.slice(1) : rows;
        const count = columns(rows);
        content = html`<div part="sheet">${header ? this.renderRow(header, count, 'header-row') : nothing}<lyra-virtual-list part="rows" .items=${body} .renderItem=${(row: unknown) => this.renderRow(row as unknown[], count, 'data-row')} .keyFunction=${(_item: unknown, index: number) => index}></lyra-virtual-list></div>`;
      }
    } else if (this.fetchState.kind === 'loading') content = html`<div part="spinner" role="status"><span class="sr-only">${this.localize('loadingDocument')}</span></div>`;
    else if (this.fetchState.kind === 'error') content = html`<div part="error" role="alert">${this.fetchState.message}</div>`;
    else content = html`<p class="empty-note">${this.localize('documentPreviewEmpty', undefined, { type: this.localize('documentPreviewTypeDocument') })}</p>`;
    return html`<div part="base" aria-label=${this.name || this.getAttribute('aria-label') || this.localize('csvViewerLabel')}>${content}</div>`;
  }
}

declare global { interface HTMLElementTagNameMap { 'lyra-csv-viewer': LyraCsvViewer; } }
