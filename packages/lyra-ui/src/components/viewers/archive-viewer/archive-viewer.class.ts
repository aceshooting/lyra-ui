import { html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import { srOnly } from '../../../internal/a11y.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { TextViewerTarget, type LyraTextViewerTargetEventMap } from '../../../internal/text-viewer-target.js';
import { fileIcon, folderIcon } from '../../../internal/icons.js';
import { safeFetchUrl } from '../../../internal/safe-url.js';
import { isAbortError, isResourceLimitError, LyraResourceLimitError, readResponseArrayBuffer } from '../../../internal/resource-loader.js';
import { getNumberFormat } from '../../../internal/intl-cache.js';
import { FILE_SIZE_UNIT_KEYS, formatFileSize } from '../../media/attachment-chip/attachment-chip.class.js';
import { loadArchiveLibraryCached, type ArchiveLibraryApi } from './archive-loader.js';
import { styles } from './archive-viewer.styles.js';

export interface ArchiveEntry { name: string; dir: boolean; size: number; }
interface ArchiveStream {
  on(type: 'data', callback: (chunk: Uint8Array) => void): ArchiveStream;
  on(type: 'error', callback: (error: unknown) => void): ArchiveStream;
  on(type: 'end', callback: () => void): ArchiveStream;
  pause?(): void;
  resume(): void;
}
interface ArchiveFile {
  name: string;
  dir: boolean;
  _data?: { uncompressedSize?: number };
  internalStream?: (type: 'uint8array') => ArchiveStream;
}
type ArchiveState = { kind: 'idle' } | { kind: 'loading' } | { kind: 'loaded'; entries: ArchiveEntry[] } | { kind: 'error'; message: string };
export interface LyraArchiveViewerEventMap extends LyraTextViewerTargetEventMap { 'lr-render-error': CustomEvent<{ error: unknown }>; }

const MAX_ARCHIVE_ENTRIES = 10_000;
const MAX_ARCHIVE_UNCOMPRESSED_BYTES = 100 * 1024 * 1024;
class LyraArchiveViewerBase extends LyraElement<LyraArchiveViewerEventMap> {}

/** Measures one JSZip entry incrementally. Failing closed when the public stream API is absent is
 * intentional: `file.async('uint8array')` would allocate the entire unknown-size entry before the
 * viewer had any opportunity to enforce its uncompressed-byte ceiling. */
function measureArchiveEntry(
  file: ArchiveFile,
  remainingBytes: number,
  isCurrent: () => boolean,
): Promise<number> {
  const stream = file.internalStream?.('uint8array');
  if (!stream) {
    return Promise.reject(new LyraResourceLimitError('The archive entry size cannot be measured safely.'));
  }
  return new Promise<number>((resolve, reject) => {
    let total = 0;
    let settled = false;
    const fail = (error: unknown): void => {
      if (settled) return;
      settled = true;
      stream.pause?.();
      reject(error);
    };
    stream
      .on('data', (chunk) => {
        if (!isCurrent()) {
          const error = new Error('The operation was aborted.');
          error.name = 'AbortError';
          fail(error);
          return;
        }
        total += chunk.length;
        if (total > remainingBytes) {
          fail(new LyraResourceLimitError('The expanded archive is too large.'));
        }
      })
      .on('error', fail)
      .on('end', () => {
        if (settled) return;
        if (!isCurrent()) {
          const error = new Error('The operation was aborted.');
          error.name = 'AbortError';
          fail(error);
          return;
        }
        settled = true;
        resolve(total);
      });
    stream.resume();
  });
}

/** Lists names and uncompressed sizes in a ZIP archive without rendering entry contents. Sizes use
 * archive metadata when available; file entries without size metadata are inflated sequentially
 * once for measurement. The combined declared and measured uncompressed size is capped at 100 MB.
 *
 * @customElement lr-archive-viewer
 * @event lr-render-error - Fired when fetching or parsing the archive fails.
 * @csspart base - The root container.
 * @csspart body - The archive listing body.
 * @csspart entry - An archive entry row.
 * @csspart entry-icon - The decorative folder or file icon.
 * @csspart entry-name - The entry path.
 * @csspart entry-name-dir - The entry path of a directory row (also carries `entry-name`).
 * @csspart entry-size - The human-readable file size.
 * @csspart spinner - The loading region.
 * @csspart error - The error region.
 */
export class LyraArchiveViewer extends TextViewerTarget(LyraArchiveViewerBase) {
  static override styles = [LyraElement.styles, styles, srOnly];
  /** URL to fetch and parse as a ZIP archive. */
  @property() src = '';
  /** Display name used as the archive listing's accessible label. */
  @property() name = '';

  /** Case-insensitive text search with next/previous navigation, plus text-quote/fragment anchors
   *  and highlights supplied by the shared text-viewer target contract. */
  override async search(query: string): Promise<number> { return super.search(query); }
  override async searchNext(): Promise<boolean> { return super.searchNext(); }
  override async searchPrevious(): Promise<boolean> { return super.searchPrevious(); }
  override clearSearch(): void { super.clearSearch(); }
  @state() private fetchState: ArchiveState = { kind: 'idle' };
  private generation = 0;
  private loadLibrary: () => Promise<ArchiveLibraryApi | null> = loadArchiveLibraryCached;

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    if (changed.has('src')) this.scheduleAfterUpdate(() => { void this.load(); });
  }

  override connectedCallback(): void {
    super.connectedCallback();
    if (this.hasUpdated && this.src) this.scheduleAfterUpdate(() => { void this.load(); });
  }

  private async load(): Promise<void> {
    const generation = ++this.generation;
    const signal = this.beginAbortableLoad();
    if (!this.src) { this.fetchState = { kind: 'idle' }; return; }
    const url = safeFetchUrl(this.src);
    if (!url) {
      const error = new Error('Unsafe archive source URL');
      this.fetchState = { kind: 'error', message: this.localize('documentPreviewUrlNotAllowed') };
      this.emit('lr-render-error', { error });
      return;
    }
    this.fetchState = { kind: 'loading' };
    try {
      const response = await fetch(url, signal ? { signal } : undefined);
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
      if (!this.isConnected || generation !== this.generation) return;
      const library = await this.loadLibrary();
      if (!this.isConnected || generation !== this.generation) return;
      if (!library) {
        const error = new Error('Archive renderer unavailable');
        this.fetchState = { kind: 'error', message: this.localize('archiveViewerUnavailable') };
        this.emit('lr-render-error', { error });
        return;
      }
      const buffer = await readResponseArrayBuffer(response);
      if (!this.isConnected || generation !== this.generation) return;
      const zip = await library.loadAsync(buffer);
      if (!this.isConnected || generation !== this.generation) return;
      const entries: ArchiveEntry[] = [];
      // Only fall back to decompressing an entry when its header didn't declare a size; JSZip
      // always populates `_data.uncompressedSize` from the local file header, so listing normally
      // never has to pay the cost of inflating every entry just to measure it.
      const fallbackSizes: Array<{ entry: ArchiveEntry; file: ArchiveFile }> = [];
      let totalUncompressed = 0;
      zip.forEach((_path: string, file: ArchiveFile) => {
        if (entries.length >= MAX_ARCHIVE_ENTRIES) throw new LyraResourceLimitError();
        const declaredSize = file._data?.uncompressedSize;
        const hasDeclaredSize = Number.isFinite(declaredSize);
        if (hasDeclaredSize && declaredSize! > MAX_ARCHIVE_UNCOMPRESSED_BYTES) throw new LyraResourceLimitError();
        totalUncompressed += hasDeclaredSize ? declaredSize! : 0;
        if (totalUncompressed > MAX_ARCHIVE_UNCOMPRESSED_BYTES) throw new LyraResourceLimitError();
        const entry = { name: file.name, dir: file.dir, size: hasDeclaredSize ? declaredSize! : 0 };
        entries.push(entry);
        if (!file.dir && !hasDeclaredSize) fallbackSizes.push({ entry, file });
      });
      for (const fallback of fallbackSizes) {
        const size = await measureArchiveEntry(
          fallback.file,
          MAX_ARCHIVE_UNCOMPRESSED_BYTES - totalUncompressed,
          () => this.isConnected && generation === this.generation,
        );
        if (!this.isConnected || generation !== this.generation) return;
        fallback.entry.size = size;
        totalUncompressed += size;
        if (totalUncompressed > MAX_ARCHIVE_UNCOMPRESSED_BYTES) throw new LyraResourceLimitError();
      }
      this.fetchState = { kind: 'loaded', entries };
    } catch (error) {
      if (isAbortError(error) || !this.isConnected || generation !== this.generation) return;
      this.fetchState = { kind: 'error', message: this.localize(isResourceLimitError(error) ? 'documentPreviewResourceTooLarge' : 'documentPreviewFailedToLoad') };
      this.emit('lr-render-error', { error });
    }
  }

  private renderEntry = (item: unknown): TemplateResult => {
    const entry = item as ArchiveEntry;
    const kind = this.localize(entry.dir ? 'archiveViewerFolder' : 'archiveViewerFile');
    return html`<div part="entry" data-dir=${entry.dir ? 'true' : 'false'}><span part="entry-icon">${entry.dir ? folderIcon() : fileIcon()}</span><span class="sr-only">${kind}</span><span part=${entry.dir ? 'entry-name entry-name-dir' : 'entry-name'} dir="auto" title=${entry.name}>${entry.name}</span>${entry.dir ? nothing : html`<span part="entry-size" dir="auto">${formatFileSize(
      entry.size,
      (unit) => this.localize(FILE_SIZE_UNIT_KEYS[unit]),
      (value, fractionDigits) => getNumberFormat(this.effectiveLocale, {
        minimumFractionDigits: fractionDigits,
        maximumFractionDigits: fractionDigits,
      }).format(value),
    )}</span>`}</div>`;
  };

  private renderBody(): TemplateResult {
    switch (this.fetchState.kind) {
      case 'loaded': return this.fetchState.entries.length ? html`<lr-virtual-list exportparts="entry:entry, entry-icon:entry-icon, entry-name:entry-name, entry-name-dir:entry-name-dir, entry-size:entry-size" .items=${this.fetchState.entries} .renderItem=${this.renderEntry} .keyFunction=${(item: unknown) => (item as ArchiveEntry).name}></lr-virtual-list>` : html`<p class="empty-note">${this.localize('archiveViewerEmpty')}</p>`;
      case 'loading': return html`<div part="spinner" role="status"><span class="sr-only">${this.localize('loadingDocument')}</span></div>`;
      case 'error': return html`<div part="error" role="alert">${this.fetchState.message}</div>`;
      case 'idle': default: return html`<p class="empty-note">${this.localize('documentPreviewEmpty', undefined, { type: this.localize('documentPreviewTypeDocument') })}</p>`;
    }
  }

  override render(): TemplateResult {
    // `name` (or a host-level aria-label) names the archive listing region; with neither set
    // there is nothing meaningful to announce, so the region role is only added once a name exists.
    const label = this.getAttribute('aria-label') || this.name;
    return label
      ? html`<div part="base" role="region" aria-label=${label}><div part="body">${this.renderBody()}</div>${this.renderAnchorLiveRegion()}</div>`
      : html`<div part="base"><div part="body">${this.renderBody()}</div>${this.renderAnchorLiveRegion()}</div>`;
  }
}

declare global { interface HTMLElementTagNameMap { 'lr-archive-viewer': LyraArchiveViewer; } }
