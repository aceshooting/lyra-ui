import { html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import { LyraElement } from '../../internal/lyra-element.js';
import { safeFetchUrl } from '../../internal/safe-url.js';
import { srOnly } from '../../internal/a11y.js';
import { loadPapaParse } from './dataset-loader.js';
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
      const table = await this.parse(await response.text());
      if (generation === this.generation) this.fetchState = { kind: 'loaded', table };
    } catch (error) {
      if (generation !== this.generation) return;
      this.fetchState = { kind: 'error', message: error instanceof Error ? error.message : this.localize('documentPreviewFailedToLoad') };
      this.emit('lyra-render-error', { error });
    }
  }

  private async parse(text: string): Promise<DatasetTable> {
    const papa = await loadPapaParse();
    if (!papa) throw new Error(this.localize('datasetViewerMissingParser'));
    const result = papa.parse(text, { delimiter: '', header: true, skipEmptyLines: true }) as { data: Record<string, string>[]; meta: { fields?: string[] } };
    const fields = result.meta.fields ?? [];
    if (!fields.length || !result.data.length) throw new Error(this.localize('datasetViewerEmpty'));
    return { fields, rows: result.data };
  }

  private renderBody(): TemplateResult {
    switch (this.fetchState.kind) {
      case 'loaded': {
        const { fields, rows } = this.fetchState.table;
        return html`<table part="table"><caption class="sr-only">${this.localize('datasetViewerCaption', undefined, { count: rows.length })}</caption><thead><tr>${fields.map((field) => html`<th scope="col">${field}</th>`)}</tr></thead><tbody>${rows.map((row) => html`<tr>${fields.map((field) => html`<td>${row[field] ?? ''}</td>`)}</tr>`)}</tbody></table>`;
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
