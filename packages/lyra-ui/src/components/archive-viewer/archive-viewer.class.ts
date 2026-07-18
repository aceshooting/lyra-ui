import { html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import { srOnly } from '../../internal/a11y.js';
import { LyraElement } from '../../internal/lyra-element.js';
import { fileIcon, folderIcon } from '../../internal/icons.js';
import { safeFetchUrl } from '../../internal/safe-url.js';
import { isAbortError, isResourceLimitError, LyraResourceLimitError, readResponseArrayBuffer } from '../../internal/resource-loader.js';
import { FILE_SIZE_UNIT_KEYS, formatFileSize } from '../attachment-chip/attachment-chip.class.js';
import '../virtual-list/virtual-list.js';
import { loadArchiveLibraryCached, type ArchiveLibraryApi } from './archive-loader.js';
import { styles } from './archive-viewer.styles.js';

export interface ArchiveEntry { name: string; dir: boolean; size: number; }
type ArchiveState = { kind: 'idle' } | { kind: 'loading' } | { kind: 'loaded'; entries: ArchiveEntry[] } | { kind: 'error'; message: string };
export interface LyraArchiveViewerEventMap { 'lr-render-error': CustomEvent<{ error: unknown }>; }

const MAX_ARCHIVE_ENTRIES = 10_000;
const MAX_ARCHIVE_UNCOMPRESSED_BYTES = 100 * 1024 * 1024;

/** Lists names and uncompressed sizes in a ZIP archive without rendering entry contents. File sizes
 * are measured through JSZip's public async API, so opening an archive decompresses each file once.
 *
 * @customElement lr-archive-viewer
 * @event lr-render-error - Fired when fetching or parsing the archive fails.
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
  /** Display name used as the archive listing's accessible label. */
  @property() name = '';
  @state() private fetchState: ArchiveState = { kind: 'idle' };
  private generation = 0;
  private loadLibrary: () => Promise<ArchiveLibraryApi | null> = loadArchiveLibraryCached;

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
      if (!library) { this.fetchState = { kind: 'error', message: this.localize('archiveViewerUnavailable') }; return; }
      const zip = await library.loadAsync(await readResponseArrayBuffer(response));
      const entries: ArchiveEntry[] = [];
      // Only fall back to decompressing an entry when its header didn't declare a size; JSZip
      // always populates `_data.uncompressedSize` from the local file header, so listing normally
      // never has to pay the cost of inflating every entry just to measure it.
      const sizes: Promise<void>[] = [];
      let declaredUncompressed = 0;
      zip.forEach((_path: string, file: { name: string; dir: boolean; async: (type: string) => Promise<Uint8Array>; _data?: { uncompressedSize?: number } }) => {
        if (entries.length >= MAX_ARCHIVE_ENTRIES) throw new LyraResourceLimitError();
        const declaredSize = file._data?.uncompressedSize;
        const hasDeclaredSize = Number.isFinite(declaredSize);
        if (hasDeclaredSize && declaredSize! > MAX_ARCHIVE_UNCOMPRESSED_BYTES) throw new LyraResourceLimitError();
        declaredUncompressed += declaredSize ?? 0;
        if (declaredUncompressed > MAX_ARCHIVE_UNCOMPRESSED_BYTES) throw new LyraResourceLimitError();
        const entry = { name: file.name, dir: file.dir, size: hasDeclaredSize ? declaredSize! : 0 };
        entries.push(entry);
        if (!file.dir && !hasDeclaredSize) sizes.push(file.async('uint8array').then((bytes) => { entry.size = bytes.length; }));
      });
      await Promise.all(sizes);
      if (generation === this.generation) this.fetchState = { kind: 'loaded', entries };
    } catch (error) {
      if (isAbortError(error) || !this.isConnected || generation !== this.generation) return;
      this.fetchState = { kind: 'error', message: this.localize(isResourceLimitError(error) ? 'documentPreviewResourceTooLarge' : 'documentPreviewFailedToLoad') };
      this.emit('lr-render-error', { error });
    }
  }

  private renderEntry = (item: unknown): TemplateResult => {
    const entry = item as ArchiveEntry;
    const kind = this.localize(entry.dir ? 'archiveViewerFolder' : 'archiveViewerFile');
    return html`<div part="entry" data-dir=${entry.dir ? 'true' : 'false'}><span part="entry-icon">${entry.dir ? folderIcon() : fileIcon()}</span><span class="sr-only">${kind}</span><span part="entry-name" title=${entry.name}>${entry.name}</span>${entry.dir ? nothing : html`<span part="entry-size">${formatFileSize(entry.size, (unit) => this.localize(FILE_SIZE_UNIT_KEYS[unit]))}</span>`}</div>`;
  };

  private renderBody(): TemplateResult {
    switch (this.fetchState.kind) {
      case 'loaded': return this.fetchState.entries.length ? html`<lr-virtual-list .items=${this.fetchState.entries} .renderItem=${this.renderEntry} .keyFunction=${(item: unknown) => (item as ArchiveEntry).name}></lr-virtual-list>` : html`<p class="empty-note">${this.localize('archiveViewerEmpty')}</p>`;
      case 'loading': return html`<div part="spinner" role="status"><span class="sr-only">${this.localize('loadingDocument')}</span></div>`;
      case 'error': return html`<div part="error" role="alert">${this.fetchState.message}</div>`;
      case 'idle': default: return html`<p class="empty-note">${this.localize('documentPreviewEmpty', undefined, { type: this.localize('documentPreviewTypeDocument') })}</p>`;
    }
  }

  render(): TemplateResult {
    // `name` (or a host-level aria-label) names the archive listing region; with neither set
    // there is nothing meaningful to announce, so the region role is only added once a name exists.
    const label = this.name || this.getAttribute('aria-label');
    return label
      ? html`<div part="base" role="region" aria-label=${label}>${this.renderBody()}</div>`
      : html`<div part="base">${this.renderBody()}</div>`;
  }
}

declare global { interface HTMLElementTagNameMap { 'lr-archive-viewer': LyraArchiveViewer; } }
