import { html, nothing, svg, type PropertyValues, type SVGTemplateResult, type TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import { srOnly } from '../../internal/a11y.js';
import { LyraElement } from '../../internal/lyra-element.js';
import { safeFetchUrl } from '../../internal/safe-url.js';
import { FILE_SIZE_UNIT_KEYS, formatFileSize } from '../attachment-chip/attachment-chip.class.js';
import '../virtual-list/virtual-list.js';
import { loadArchiveLibraryCached, type ArchiveLibraryApi } from './archive-loader.js';
import { styles } from './archive-viewer.styles.js';

export interface ArchiveEntry { name: string; dir: boolean; size: number; }
type ArchiveState = { kind: 'idle' } | { kind: 'loading' } | { kind: 'loaded'; entries: ArchiveEntry[] } | { kind: 'error'; message: string };
export interface LyraArchiveViewerEventMap { 'lyra-render-error': CustomEvent<{ error: unknown }>; }

const ICON_VIEW_BOX = '0 0 24 24';
function icon(paths: SVGTemplateResult): SVGTemplateResult { return svg`<svg width="1em" height="1em" viewBox=${ICON_VIEW_BOX} fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${paths}</svg>`; }
function folderGlyph(): SVGTemplateResult { return icon(svg`<path d="M3 6a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"></path>`); }
function fileGlyph(): SVGTemplateResult { return icon(svg`<path d="M6 2h8l6 6v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Z"></path><polyline points="14 2 14 8 20 8"></polyline>`); }

/** Lists names and uncompressed sizes in a ZIP archive without rendering entry contents. File sizes
 * are measured through JSZip's public async API, so opening an archive decompresses each file once.
 *
 * @customElement lyra-archive-viewer
 * @event lyra-render-error - Fired when fetching or parsing the archive fails.
 * @csspart base - The root container.
 * @csspart entry - An archive entry row.
 * @csspart entry-icon - The decorative folder or file icon.
 * @csspart entry-name - The entry path.
 * @csspart entry-size - The human-readable file size.
 * @csspart spinner - The loading region.
 * @csspart error - The error region.
 */
export class LyraArchiveViewer extends LyraElement<LyraArchiveViewerEventMap> {
  static styles = [LyraElement.styles, styles, srOnly];
  /** URL to fetch and parse as a ZIP archive. */
  @property() src = '';
  /** Display name associated with the archive. */
  @property() name = '';
  @state() private fetchState: ArchiveState = { kind: 'idle' };
  private generation = 0;
  private loadLibrary: () => Promise<ArchiveLibraryApi | null> = loadArchiveLibraryCached;

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
      if (!library) { this.fetchState = { kind: 'error', message: this.localize('archiveViewerUnavailable') }; return; }
      const zip = await library.loadAsync(await response.arrayBuffer());
      const entries: ArchiveEntry[] = [];
      const sizes: Promise<void>[] = [];
      zip.forEach((_path: string, file: { name: string; dir: boolean; async: (type: string) => Promise<Uint8Array> }) => {
        const entry = { name: file.name, dir: file.dir, size: 0 };
        entries.push(entry);
        if (!file.dir) sizes.push(file.async('uint8array').then((bytes) => { entry.size = bytes.length; }));
      });
      await Promise.all(sizes);
      if (generation === this.generation) this.fetchState = { kind: 'loaded', entries };
    } catch (error) {
      if (generation !== this.generation) return;
      this.fetchState = { kind: 'error', message: error instanceof Error ? error.message : this.localize('documentPreviewFailedToLoad') };
      this.emit('lyra-render-error', { error });
    }
  }

  private renderEntry = (item: unknown): TemplateResult => {
    const entry = item as ArchiveEntry;
    const kind = this.localize(entry.dir ? 'archiveViewerFolder' : 'archiveViewerFile');
    return html`<div part="entry" data-dir=${entry.dir ? 'true' : 'false'}><span part="entry-icon">${entry.dir ? folderGlyph() : fileGlyph()}</span><span class="sr-only">${kind}</span><span part="entry-name" title=${entry.name}>${entry.name}</span>${entry.dir ? nothing : html`<span part="entry-size">${formatFileSize(entry.size, (unit) => this.localize(FILE_SIZE_UNIT_KEYS[unit]))}</span>`}</div>`;
  };

  private renderBody(): TemplateResult {
    switch (this.fetchState.kind) {
      case 'loaded': return this.fetchState.entries.length ? html`<lyra-virtual-list .items=${this.fetchState.entries} .renderItem=${this.renderEntry} .keyFunction=${(item: unknown) => (item as ArchiveEntry).name}></lyra-virtual-list>` : html`<p class="empty-note">${this.localize('archiveViewerEmpty')}</p>`;
      case 'loading': return html`<div part="spinner" role="status"><span class="sr-only">${this.localize('loadingDocument')}</span></div>`;
      case 'error': return html`<div part="error" role="alert">${this.fetchState.message}</div>`;
      case 'idle': default: return html`<p class="empty-note">${this.localize('documentPreviewEmpty', undefined, { type: this.localize('documentPreviewTypeDocument') })}</p>`;
    }
  }

  render(): TemplateResult { return html`<div part="base">${this.renderBody()}</div>`; }
}

declare global { interface HTMLElementTagNameMap { 'lyra-archive-viewer': LyraArchiveViewer; } }
