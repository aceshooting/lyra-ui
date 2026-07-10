import { html, nothing, type TemplateResult } from 'lit';
import { property, state, query } from 'lit/decorators.js';
import { LyraElement } from '../../internal/lyra-element.js';
import { defineElement } from '../../internal/prefix.js';
import { styles } from './file-input.styles.js';
import { matchesAccept } from './accept.js';

type DragState = 'default' | 'accept' | 'reject';

export interface RejectedFile {
  file: File;
  reason: 'type' | 'count' | 'size';
}

/**
 * `<lyra-file-input>` — a drag-drop + click-to-browse file dropzone. Emits
 * raw `File[]`; parsing (CSV/XLSX/etc.) is left to the host, matching every
 * surveyed upload seed (all of which upload raw files to a backend).
 *
 * @customElement lyra-file-input
 * @slot - Custom drop-zone content, overrides the `label` attribute.
 * @event lyra-files - `detail: { files, rejected }`, fired on drop and manual selection.
 * @csspart base, input
 */
export class LyraFileInput extends LyraElement {
  static styles = [LyraElement.styles, styles];

  @property({ type: Boolean, reflect: true }) multiple = false;
  @property({ type: Boolean, reflect: true }) disabled = false;
  @property() accept = '';
  @property({ attribute: false }) allowedMimeTypes: string[] = [];
  @property({ attribute: false }) forbiddenMimeTypes: string[] = [];
  @property({ type: Number, attribute: 'max-file-size' }) maxFileSize = 0;
  @property() label = 'Drop files here or click to browse';

  @state() private dragState: DragState = 'default';
  @query('input[type="file"]') private inputEl?: HTMLInputElement;

  private dragCounter = 0;

  private isAllowed(file: File): 'ok' | 'type' | 'size' {
    if (this.forbiddenMimeTypes.includes(file.type)) return 'type';
    if (this.allowedMimeTypes.length > 0 && !this.allowedMimeTypes.includes(file.type)) return 'type';
    if (this.accept && !matchesAccept(file, this.accept)) return 'type';
    // `file.size` is `undefined` on the synthetic `DataTransferItem`-cast objects
    // used during dragenter preview (real sizes aren't available until drop),
    // so this naturally only takes effect for the real `classify()` call at drop time.
    if (this.maxFileSize > 0 && file.size > this.maxFileSize) return 'size';
    return 'ok';
  }

  private classify(fileList: File[]): { files: File[]; rejected: RejectedFile[] } {
    if (!this.multiple && fileList.length > 1) {
      return { files: [], rejected: fileList.map((file) => ({ file, reason: 'count' as const })) };
    }
    const files: File[] = [];
    const rejected: RejectedFile[] = [];
    for (const f of fileList) {
      const reason = this.isAllowed(f);
      if (reason === 'ok') files.push(f);
      else rejected.push({ file: f, reason });
    }
    return { files, rejected };
  }

  private emitFiles(fileList: File[]): void {
    const { files, rejected } = this.classify(fileList);
    this.emit('lyra-files', { files, rejected });
  }

  /** Programmatically open the native file picker. */
  openPicker(): void {
    this.inputEl?.click();
  }

  private previewState(fileList: File[]): DragState {
    const { rejected } = this.classify(fileList);
    return rejected.length > 0 ? 'reject' : 'accept';
  }

  private onDragEnter = (e: DragEvent): void => {
    if (this.disabled) return;
    e.preventDefault();
    this.dragCounter++;
    const items = e.dataTransfer ? [...e.dataTransfer.items].filter((i) => i.kind === 'file') : [];
    this.dragState = items.length ? this.previewState(items as unknown as File[]) : 'default';
  };

  private onDragOver = (e: DragEvent): void => {
    if (this.disabled) return;
    e.preventDefault();
  };

  private onDragLeave = (e: DragEvent): void => {
    if (this.disabled) return;
    e.preventDefault();
    this.dragCounter = Math.max(0, this.dragCounter - 1);
    if (this.dragCounter === 0) this.dragState = 'default';
  };

  private onDrop = (e: DragEvent): void => {
    if (this.disabled) return;
    e.preventDefault();
    this.dragCounter = 0;
    this.dragState = 'default';
    const files = [...(e.dataTransfer?.files ?? [])];
    if (files.length) this.emitFiles(files);
  };

  private onInputChange = (e: Event): void => {
    const files = [...((e.target as HTMLInputElement).files ?? [])];
    (e.target as HTMLInputElement).value = '';
    if (files.length) this.emitFiles(files);
  };

  private onKeyDown = (e: KeyboardEvent): void => {
    if (this.disabled) return;
    if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
      // Prevent Space from scrolling the page, matching the `table.ts`
      // sortable-header/row convention for role-based clickable elements.
      e.preventDefault();
      this.openPicker();
    }
  };

  render(): TemplateResult {
    return html`
      <div
        part="base"
        role="button"
        tabindex=${this.disabled ? '-1' : '0'}
        aria-disabled=${this.disabled ? 'true' : nothing}
        data-drag-state=${this.dragState}
        @dragenter=${this.onDragEnter}
        @dragover=${this.onDragOver}
        @dragleave=${this.onDragLeave}
        @drop=${this.onDrop}
        @click=${() => !this.disabled && this.openPicker()}
        @keydown=${this.onKeyDown}
      >
        <slot>${this.label}</slot>
      </div>
      <input
        part="input"
        type="file"
        tabindex="-1"
        aria-hidden="true"
        accept=${this.accept}
        ?multiple=${this.multiple}
        ?disabled=${this.disabled}
        @change=${this.onInputChange}
      />
    `;
  }
}

defineElement('file-input', LyraFileInput);

declare global {
  interface HTMLElementTagNameMap {
    'lyra-file-input': LyraFileInput;
  }
}
