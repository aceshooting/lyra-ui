import { html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import { LyraElement } from '../../internal/lyra-element.js';
import { safeFetchUrl } from '../../internal/safe-url.js';
import { assertTableDimensions, DEFAULT_MAX_TABLE_COLUMNS, isAbortError, isResourceLimitError, LyraUserFacingError, readResponseText } from '../../internal/resource-loader.js';

// Unlike `lyra-csv-viewer`/`lyra-spreadsheet-viewer`, this component renders every row into a real
// `<table>` in one synchronous pass rather than through `<lyra-virtual-list>` (a real `<table>`'s
// `<tbody>` doesn't windowed-render the way a virtual list's plain divs can). The shared 10,000-row
// default is safe for those two virtualized siblings but would lock the main thread for seconds here
// at typical column counts, so this component enforces a much lower row cap instead.
const MAX_TABLE_ROWS = 1_000;
import { srOnly } from '../../internal/a11y.js';
import { loadPapaParseCached } from '../../internal/papaparse-loader.js';
import { styles } from './dataset-viewer.styles.js';

export interface DatasetTable { fields: string[]; rows: Record<string, string>[]; }
type DatasetFetchState = { kind: 'idle' } | { kind: 'loading' } | { kind: 'loaded'; table: DatasetTable } | { kind: 'error'; message: string };

export interface LyraDatasetViewerEventMap { 'lyra-render-error': CustomEvent<{ error: unknown }>; }

/** Fetches delimited text and renders a typed, accessible data table. */
export class LyraDatasetViewer extends LyraElement<LyraDatasetViewerEventMap> {
  static styles = [LyraElement.styles, styles, srOnly];
  /** URL to fetch and parse as delimited text. */
  @property() src = '';
  /** Display name used for the table caption. */
  @property() name = '';
  /** CSS length that caps the scrollable body. */
  @property({ attribute: 'max-height' }) maxHeight = '';
  @state() private fetchState: DatasetFetchState = { kind: 'idle' };
  private generation = 0;

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
      const table = await this.parse(await readResponseText(response));
      if (this.isConnected && generation === this.generation) this.fetchState = { kind: 'loaded', table };
    } catch (error) {
      if (isAbortError(error) || !this.isConnected || generation !== this.generation) return;
      this.fetchState = { kind: 'error', message: error instanceof LyraUserFacingError ? error.message : this.localize(isResourceLimitError(error) ? 'documentPreviewResourceTooLarge' : 'documentPreviewFailedToLoad') };
      this.emit('lyra-render-error', { error });
    }
  }

  private async parse(text: string): Promise<DatasetTable> {
    const papa = await loadPapaParseCached();
    if (!papa) throw new LyraUserFacingError(this.localize('datasetViewerMissingParser'));
    const result = papa.parse(text, { delimiter: '', header: true, skipEmptyLines: true }) as { data: Record<string, string>[]; meta: { fields?: string[] } };
    const fields = result.meta.fields ?? [];
    if (!fields.length || !result.data.length) throw new LyraUserFacingError(this.localize('datasetViewerEmpty'));
    assertTableDimensions(result.data.length, fields.length, MAX_TABLE_ROWS, DEFAULT_MAX_TABLE_COLUMNS);
    return { fields, rows: result.data };
  }

  private renderBody(): TemplateResult {
    switch (this.fetchState.kind) {
      case 'loaded': {
        const { fields, rows } = this.fetchState.table;
        const caption = this.name
          ? this.localize('datasetViewerCaptionNamed', undefined, { name: this.name, count: rows.length })
          : this.localize('datasetViewerCaption', undefined, { count: rows.length });
        return html`<table part="table"><caption class="sr-only">${caption}</caption><thead><tr>${fields.map((field) => html`<th scope="col">${field}</th>`)}</tr></thead><tbody>${rows.map((row) => html`<tr>${fields.map((field) => html`<td>${row[field] ?? ''}</td>`)}</tr>`)}</tbody></table>`;
      }
      case 'loading': return html`<div part="spinner" role="status"><span class="sr-only">${this.localize('loadingDocument')}</span></div>`;
      case 'error': return html`<div part="error" role="alert">${this.fetchState.message}</div>`;
      case 'idle':
      default: return html`<p class="empty-note">${this.localize('documentPreviewEmpty', undefined, { type: this.localize('documentPreviewTypeDataset') })}</p>`;
    }
  }

  render(): TemplateResult { return html`<div part="base" style=${this.maxHeight ? `--lyra-dataset-viewer-max-height:${this.maxHeight}` : nothing}><div part="body">${this.renderBody()}</div></div>`; }
}

declare global { interface HTMLElementTagNameMap { 'lyra-dataset-viewer': LyraDatasetViewer; } }
