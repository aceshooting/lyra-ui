import { html, type TemplateResult, type ComplexAttributeConverter } from 'lit';
import { property, state, query } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { srOnly } from '../../../internal/a11y.js';
import { finiteRange } from '../../../internal/numbers.js';
import { styles } from './file-input.styles.js';
import { matchesAccept } from './accept.js';

type DragState = 'default' | 'accept' | 'reject';

/** `true`-defaulting boolean attribute converter, identical shape to `<lr-activity-feed>`'s
 *  `trueDefaultBooleanConverter` -- duplicated locally per this library's convention of not
 *  sharing these tiny converters across independently-consumable component files. Lit's default
 *  presence-based `type: Boolean` can never be set back to `false` from a plain-HTML attribute
 *  once the property's own default is `true` (removing an attribute that was never present fires
 *  no `attributeChangedCallback`), so `fromAttribute` checks the literal string instead.
 *  `toAttribute` reflects the `true` state as a present (empty-string) attribute rather than
 *  omitting it, so `paste`'s host attribute is present by default, matching every other
 *  `reflect: true` boolean property in this library. */
const trueDefaultBooleanConverter: ComplexAttributeConverter<boolean> = {
  fromAttribute(value): boolean {
    return value !== 'false';
  },
  toAttribute(value): string | null {
    return value ? '' : null;
  },
};

/** Fallback cap applied in place of an invalid `maxFileSize` (NaN or negative -- e.g. an
 *  unparsable `max-file-size` attribute, or a host computing the value from a config that hasn't
 *  loaded yet). Deliberately duplicated rather than imported from `internal/resource-loader.ts`'s
 *  own `DEFAULT_MAX_RESOURCE_BYTES` (same value, same "no better number available" rationale) --
 *  that constant is themed around a remote-fetch byte cap, a different concern from this
 *  component's user-facing upload-size guard, and this library's convention is to duplicate a
 *  small constant like this locally rather than add a cross-component import for it (see e.g.
 *  `<lr-activity-feed>`'s own `trueDefaultBooleanConverter` doc comment). */
export const DEFAULT_MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024;

export interface RejectedFile {
  file: File;
  reason: 'type' | 'count' | 'size' | 'directory';
}

export interface LyraFileInputEventMap {
  blur: CustomEvent<undefined>;
  focus: CustomEvent<undefined>;
  'lr-files': CustomEvent<{ files: File[]; rejected: RejectedFile[] }>;
}
/**
 * `<lr-file-input>` — a drag-drop + click-to-browse file dropzone. Emits
 * raw `File[]`; parsing (CSV/XLSX/etc.) is left to the host, since that's
 * where files ultimately get uploaded and processed anyway.
 *
 * @customElement lr-file-input
 * @slot - Custom drop-zone content, overrides the visible `label` text. The
 * accessible name comes from a host `aria-label` when present, then falls
 * back to `label`, so icon-only slot content remains announced correctly.
 * @event lr-files - `detail: { files, rejected }`, fired on drop and manual selection.
 * @event focus - Fired when the semantic dropzone receives focus.
 * @event blur - Fired when the semantic dropzone loses focus.
 * @csspart base - The dropzone's root, clickable/focusable container.
 * @csspart input - The visually-hidden native `<input type="file">`.
 * @csspart status - The visually-hidden live region announcing drag accept/reject state.
 * @cssprop [--lr-file-input-compact-padding=var(--lr-space-s)] - `[part="base"]` padding while
 * `compact`.
 * @cssprop [--lr-file-input-compact-gap=var(--lr-space-2xs)] - Gap between the dropzone's slotted
 * children while `compact`.
 * @cssprop [--lr-file-input-compact-font-size=var(--lr-font-size-sm)] - Label font size while
 * `compact`.
 * @cssprop [--lr-file-input-accept-border-color=var(--lr-color-success)] - Border color of
 * `[part="base"][data-drag-state="accept"]`.
 * @cssprop [--lr-file-input-accept-bg=color-mix(in srgb, var(--lr-color-success) 8%, transparent)] -
 * Background of `[part="base"][data-drag-state="accept"]`.
 * @cssprop [--lr-file-input-reject-border-color=var(--lr-color-danger)] - Border color of
 * `[part="base"][data-drag-state="reject"]`.
 * @cssprop [--lr-file-input-reject-bg=color-mix(in srgb, var(--lr-color-danger) 8%, transparent)] -
 * Background of `[part="base"][data-drag-state="reject"]`.
 */
export class LyraFileInput extends LyraElement<LyraFileInputEventMap> {
  static override styles = [LyraElement.styles, styles, srOnly];

  @property({ type: Boolean, reflect: true }) multiple = false;
  @property({ type: Boolean, reflect: true }) disabled = false;
  /** Tighter dropzone padding, gap and label font for constrained spaces (a toolbar, a table cell)
   *  -- same convention as `lr-empty`'s `compact`. Defaults to `false`, i.e. the full `--lr-space-l`
   *  dropzone. The dashed border stays; only the internal spacing shrinks. */
  @property({ type: Boolean, reflect: true }) compact = false;
  @property() accept = '';
  @property({ attribute: false }) allowedMimeTypes: string[] = [];
  @property({ attribute: false }) forbiddenMimeTypes: string[] = [];
  /** Largest accepted file size in bytes. `0` (the default) disables the size check entirely --
   *  see `effectiveMaxFileSize` for how an invalid override is handled. */
  @property({ type: Number, attribute: 'max-file-size' }) maxFileSize = 0;
  /** Enables directory selection through the browser's native picker. */
  @property({ type: Boolean, reflect: true }) directory = false;
  /** Enables files pasted from the clipboard into the dropzone. `true`-defaulting, so a plain
   *  `paste="false"` attribute (not just a `.paste=${false}` property binding) actually disables it. */
  @property({ type: Boolean, reflect: true, converter: trueDefaultBooleanConverter }) paste = true;
  @property() label = 'Drop files here or click to browse';
  /** Accessible name forwarded to the semantic dropzone and native file input.
   * When unset, the effective `label` text is used. */
  @property({ attribute: 'aria-label' }) accessibleLabel = '';
  /** Message announced after an accepted selection; `{count}` is replaced by
   * the number of accepted files. */
  @property({ attribute: 'accepted-message' }) acceptedMessage = '{count} file(s) added.';
  /** Message announced after rejected files; `{count}` is replaced by the
   * number of rejected files. */
  @property({ attribute: 'rejected-message' }) rejectedMessage = '{count} file(s) rejected.';

  @state() private dragState: DragState = 'default';
  @state() private resultStatus = '';
  @query('[part="base"]') private baseEl?: HTMLElement;
  @query('input[type="file"]') private inputEl?: HTMLInputElement;

  private dragCounter = 0;

  /** `maxFileSize` normalized: `0` (explicitly set, or left at the default) or `Infinity`
   *  (explicitly set) both mean "no limit" verbatim -- `null` here signals that. Anything else
   *  that isn't a positive, finite override -- a `NaN` from an invalid `max-file-size` attribute,
   *  or a negative value -- falls back to a sane cap instead. This matters because the size check
   *  below used to gate directly on `this.maxFileSize > 0`: `NaN > 0` and `-1 > 0` are both
   *  `false`, so an invalid override silently disabled the entire size limit (accepting files of
   *  any size) rather than failing safe. */
  private get effectiveMaxFileSize(): number | null {
    const maxFileSize = this.maxFileSize;
    if (maxFileSize === 0 || maxFileSize === Infinity) return null;
    return finiteRange(maxFileSize > 0 ? maxFileSize : NaN, DEFAULT_MAX_FILE_SIZE_BYTES, 1);
  }

  private isAllowed(file: File, isPreview = false): 'ok' | 'type' | 'size' {
    if (this.forbiddenMimeTypes.includes(file.type)) return 'type';
    if (this.allowedMimeTypes.length > 0 && !this.allowedMimeTypes.includes(file.type)) return 'type';
    // During dragenter preview, `accept` extension patterns can't be evaluated (no
    // `.name` yet) — treat them as a possible match rather than a guaranteed reject,
    // so the preview doesn't flag a file that will in fact be accepted on drop.
    if (this.accept && !matchesAccept(file, this.accept, isPreview)) return 'type';
    // `file.size` is `undefined` on the synthetic `DataTransferItem`-cast objects
    // used during dragenter preview (real sizes aren't available until drop),
    // so this naturally only takes effect for the real `classify()` call at drop time.
    const maxFileSize = this.effectiveMaxFileSize;
    if (maxFileSize !== null && file.size > maxFileSize) return 'size';
    return 'ok';
  }

  private classify(
    fileList: File[],
    isPreview = false,
  ): { files: File[]; rejected: RejectedFile[] } {
    if (!this.multiple && fileList.length > 1) {
      return { files: [], rejected: fileList.map((file) => ({ file, reason: 'count' as const })) };
    }
    const files: File[] = [];
    const rejected: RejectedFile[] = [];
    for (const f of fileList) {
      const reason = this.isAllowed(f, isPreview);
      if (reason === 'ok') files.push(f);
      else rejected.push({ file: f, reason });
    }
    return { files, rejected };
  }

  private emitFiles(fileList: File[], additionalRejected: RejectedFile[] = []): void {
    const { files, rejected } = this.classify(fileList);
    rejected.push(...additionalRejected);
    const messages: string[] = [];
    if (files.length) {
      messages.push(
        this.localize(
          files.length === 1 ? 'fileInputAcceptedOne' : 'fileInputAcceptedMany',
          this.acceptedMessage === '{count} file(s) added.' ? undefined : this.acceptedMessage,
          { count: files.length },
        ),
      );
    }
    if (rejected.length) {
      messages.push(
        this.localize(
          rejected.length === 1 ? 'fileInputRejectedOne' : 'fileInputRejectedMany',
          this.rejectedMessage === '{count} file(s) rejected.' ? undefined : this.rejectedMessage,
          { count: rejected.length },
        ),
      );
    }
    this.resultStatus = messages.join(' ');
    this.emit('lr-files', { files, rejected });
  }

  /** Programmatically open the native file picker. */
  openPicker(): void {
    if (this.disabled) return;
    this.inputEl?.click();
  }

  /** Focuses the semantic dropzone. */
  override focus(options?: FocusOptions): void {
    this.baseEl?.focus(options);
  }

  private previewState(fileList: File[]): DragState {
    const { rejected } = this.classify(fileList, true);
    return rejected.length > 0 ? 'reject' : 'accept';
  }

  private onDragEnter = (e: DragEvent): void => {
    e.preventDefault();
    if (this.disabled) return;
    this.dragCounter++;
    const items = e.dataTransfer ? [...e.dataTransfer.items].filter((i) => i.kind === 'file') : [];
    this.dragState = items.length ? this.previewState(items as unknown as File[]) : 'default';
  };

  private onDragOver = (e: DragEvent): void => {
    // Always suppress the browser's default drop action (e.g. navigating the
    // whole page to the dropped file), even while disabled — only the
    // subsequent classification/emit logic is gated on `disabled`.
    e.preventDefault();
    if (this.disabled) return;
  };

  private onDragLeave = (e: DragEvent): void => {
    if (this.disabled) return;
    e.preventDefault();
    this.dragCounter = Math.max(0, this.dragCounter - 1);
    if (this.dragCounter === 0) this.dragState = 'default';
  };

  private onDrop = (e: DragEvent): void => {
    // Same rationale as `onDragOver`: prevent the browser's default drop
    // action unconditionally, before the `disabled` gate.
    e.preventDefault();
    if (this.disabled) return;
    this.dragCounter = 0;
    this.dragState = 'default';
    const files = [...(e.dataTransfer?.files ?? [])];
    const folders = [...(e.dataTransfer?.items ?? [])]
      .map((item) => (item as DataTransferItem & { webkitGetAsEntry?: () => FileSystemEntry | null }).webkitGetAsEntry?.())
      .filter((entry): entry is FileSystemEntry => !!entry && entry.isDirectory);
    const rejectedFolders = folders.map((folder) => ({ file: new File([], folder.name), reason: 'directory' as const }));
    if (files.length || rejectedFolders.length) this.emitFiles(files, rejectedFolders);
  };

  private onPaste = (e: ClipboardEvent): void => {
    if (!this.paste || this.disabled) return;
    const files = [...(e.clipboardData?.files ?? [])];
    if (files.length) { e.preventDefault(); this.emitFiles(files); }
  };

  private onInputChange = (e: Event): void => {
    const files = [...((e.target as HTMLInputElement).files ?? [])];
    (e.target as HTMLInputElement).value = '';
    if (files.length) this.emitFiles(files);
  };
  // Bridged off [part="base"] (the actual keyboard-focusable dropzone), not the visually-hidden,
  // tabindex="-1", aria-hidden native `<input type="file">` — that input is never focused by a
  // user, only `.click()`ed by `openPicker()`, so binding here is what makes a host-level
  // `addEventListener('focus' | 'blur', ...)` observe real focus/blur at all; native focus/blur
  // neither bubble nor cross the shadow boundary on their own.
  private onFocus = (): void => { this.emit('focus'); };
  private onBlur = (): void => { this.emit('blur'); };

  private onKeyDown = (e: KeyboardEvent): void => {
    if (this.disabled) return;
    if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
      // Prevent Space from scrolling the page, matching the `table.ts`
      // sortable-header/row convention for role-based clickable elements.
      e.preventDefault();
      this.openPicker();
    }
  };

  private statusText(): string {
    if (this.dragState === 'accept') return this.localize('dropzoneReleaseToAdd');
    if (this.dragState === 'reject') return this.localize('dropzoneRejectedType');
    return this.resultStatus;
  }

  /** Resolves `label`'s effective text: an explicit override wins verbatim; left at the
   *  built-in default it instead routes through `this.localize()` so a locale/`.strings`
   *  override applies without requiring `label` itself to be set. */
  private get effectiveLabel(): string {
    return this.localize(
      'fileInputDefaultLabel',
      this.label === 'Drop files here or click to browse' ? undefined : this.label,
    );
  }

  override render(): TemplateResult {
    const label = this.effectiveLabel;
    const accessibleLabel = this.accessibleLabel || label;
    return html`
      <div
        part="base"
        role="button"
        tabindex=${this.disabled ? '-1' : '0'}
        aria-disabled=${this.disabled ? 'true' : 'false'}
        aria-label=${accessibleLabel}
        data-drag-state=${this.dragState}
        @dragenter=${this.onDragEnter}
        @dragover=${this.onDragOver}
        @dragleave=${this.onDragLeave}
        @drop=${this.onDrop}
        @paste=${this.onPaste}
        @click=${() => !this.disabled && this.openPicker()}
        @keydown=${this.onKeyDown}
        @focus=${this.onFocus}
        @blur=${this.onBlur}
      >
        <slot>${label}</slot>
      </div>
      <div part="status" class="sr-only" role="status" aria-live="polite">${this.statusText()}</div>
      <input
        part="input"
        class="sr-only"
        type="file"
        tabindex="-1"
        aria-hidden="true"
        aria-label=${accessibleLabel}
        accept=${this.accept}
        ?multiple=${this.multiple}
        ?webkitdirectory=${this.directory}
        ?disabled=${this.disabled}
        @change=${this.onInputChange}
      />
    `;
  }
}


declare global {
  interface HTMLElementTagNameMap {
    'lr-file-input': LyraFileInput;
  }
}
