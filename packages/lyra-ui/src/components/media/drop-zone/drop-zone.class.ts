import { html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { srOnly } from '../../../internal/a11y.js';
import { acquireAnnouncementSink, type AnnouncementSink } from '../../../internal/announcer.js';
import { attachInternalsSafely } from '../../../internal/form-associated.js';
import { setCustomState } from '../../../internal/custom-states.js';
import { finiteCount, finiteRange } from '../../../internal/numbers.js';
import { AggregateFileLimitTracker } from '../../../internal/aggregate-file-limits.js';
import { getNumberFormat } from '../../../internal/intl-cache.js';
import { fileIcon } from '../../../internal/icons.js';
import { presenceTrueDefaultBooleanConverter as trueDefaultBooleanConverter } from '../../../internal/converters.js';
import {
  DropSessionController,
  type DropSessionState,
} from '../../../internal/drop-session-controller.js';
import { matchesAccept } from '../file-input/accept.js';
import { styles } from './drop-zone.styles.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_dropzoneRejectedType, LYRA_DEFAULT_dropzoneReleaseToAdd, LYRA_DEFAULT_fieldRequired, LYRA_DEFAULT_fileInputAcceptedMany, LYRA_DEFAULT_fileInputAcceptedOne, LYRA_DEFAULT_fileInputFolderRejected, LYRA_DEFAULT_fileInputRejectedCount, LYRA_DEFAULT_fileInputRejectedLimit, LYRA_DEFAULT_fileInputRejectedMany, LYRA_DEFAULT_fileInputRejectedMaxFiles, LYRA_DEFAULT_fileInputRejectedMaxTotalSize, LYRA_DEFAULT_fileInputRejectedOne, LYRA_DEFAULT_fileInputRejectedRead, LYRA_DEFAULT_fileInputRejectedSize, LYRA_DEFAULT_fileInputRejectedType } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END

// Deliberately not imported from `lr-file-input.class.ts` -- keeping this component's own
// numeric fallbacks decouples it from that class module's export surface, so a future change
// there can't accidentally ripple into this unrelated component. Values are numerically identical
// to `lr-file-input`'s own `DEFAULT_MAX_FILE_SIZE_BYTES`/`DEFAULT_MAX_FILES`/
// `DEFAULT_MAX_TOTAL_SIZE_BYTES` by design -- keep both in sync if either changes.
const DEFAULT_MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024;
const DEFAULT_MAX_FILES = 100;
const DEFAULT_MAX_TOTAL_SIZE_BYTES = 250 * 1024 * 1024;

export interface LyraDropZoneRejectedFile {
  readonly file: File;
  readonly reason: 'type' | 'count' | 'size' | 'directory' | 'read' | 'limit' | 'maxFiles' | 'maxTotalSize';
}

export interface LyraDropZoneFilesDetail {
  readonly files: readonly File[];
  readonly rejected: readonly LyraDropZoneRejectedFile[];
  /** Remaining allowance under `maxFiles` after this drop, at the control's running count
   *  (`heldFileCount`, since this component retains nothing of its own between drops) -- `null`
   *  while `maxFiles` is unset (no limit), never negative. */
  readonly remainingFiles: number | null;
  /** Remaining allowance under `maxTotalSize` after this drop, in bytes -- `null` while
   *  `maxTotalSize` is unset (no limit), never negative. */
  readonly remainingTotalSize: number | null;
}

/** `lr-files`' event type on `lr-drop-zone`, narrowing `target`/`currentTarget` to `LyraDropZone`
 *  so a listener reads them without casting -- same convention as `lr-file-input`'s
 *  `LyraFileInputFilesEvent`. */
export interface LyraDropZoneFilesEvent extends CustomEvent<LyraDropZoneFilesDetail> {
  readonly target: LyraDropZone;
  readonly currentTarget: LyraDropZone;
}

export interface LyraDropZoneEventMap {
  'lr-files': LyraDropZoneFilesEvent;
}

/**
 * `<lr-drop-zone>` -- a drag-and-drop region wrapper with no file input of its own. Wrap it around
 * an arbitrary region (a chat composer, a whole conversation viewport, a panel far larger than any
 * single control) to make that entire region a file-drop target: it owns the drag-session state,
 * renders a themeable drag-over overlay, applies `accept`/size/count limits, and emits the same
 * `lr-files` event shape `lr-file-input` does -- `detail: { files, rejected }` -- so the two are
 * interchangeable from a listener's point of view. It never renders a native file picker, a
 * selected-file list, or any focusable control of its own; wrap `lr-file-input` itself (or any
 * other focusable content) inside it when the region also needs a click-to-browse affordance.
 *
 * The drag-session mechanics (nested-depth tracking, accept/reject preview, legacy File System API
 * folder traversal) are the exact ones `lr-file-input` uses, shared through
 * `internal/drop-session-controller.ts` rather than reimplemented here.
 *
 * @customElement lr-drop-zone
 * @slot - The wrapped region. Rendered as ordinary light DOM content; this element adds only the
 * drag listeners and the overlay layered on top.
 * @slot overlay - Custom drag-over overlay content, overriding the localized accept/reject text.
 * @event lr-files - Frozen `detail: { files, rejected, remainingFiles, remainingTotalSize }` with
 * detached readonly sequences and rejected-file records, fired on drop.
 * `remainingFiles`/`remainingTotalSize` report the allowance still left under `maxFiles`/
 * `maxTotalSize` after this drop (`null` while that limit is unset). Immutable `File` items retain
 * identity. Typed as {@linkcode LyraDropZoneFilesEvent}, so
 * `event.target`/`event.currentTarget` are `LyraDropZone` without a cast.
 * @csspart base - The wrapping element wrapping the default slot and the overlay.
 * @csspart overlay - The drag-over overlay, layered above the slotted content. Hidden outside an
 * active drag session.
 * @csspart overlay-icon - The default decorative overlay icon.
 * @csspart overlay-text - Wrapper around the overlay slot/text content.
 * @csspart status - The visually-hidden, `aria-hidden` mirror of the drag accept/reject state and
 * accepted/rejected counts. The announcement itself lands in the shared light-DOM polite region
 * (`acquireAnnouncementSink()` in `internal/announcer.ts`); this part is a styling/inspection
 * surface only.
 * @csspart rejection - The visible region listing each currently-rejected file alongside its
 * reason, rendered in addition to the sr-only `status` summary.
 * @cssstate dragging - Matches during an active file drag session.
 * @cssprop [--lr-drop-zone-radius=var(--lr-radius)] - Corner radius of `[part="overlay"]`.
 * @cssprop [--lr-drop-zone-overlay-border-color=var(--lr-color-brand)] - Dashed border color of
 *   `[part="overlay"]` in its neutral drag state, before an accept or reject verdict.
 * @cssprop [--lr-drop-zone-overlay-bg=color-mix(in srgb, var(--lr-color-brand) 8%, transparent)] -
 *   Fill of `[part="overlay"]` in that same neutral drag state.
 * @cssprop [--lr-drop-zone-overlay-font-size=var(--lr-font-size-md-sm)] - Overlay instructional
 * text size.
 * @cssprop [--lr-drop-zone-overlay-icon-size=var(--lr-font-size-xl)] - `[part="overlay-icon"]`
 * glyph size.
 * @cssprop [--lr-drop-zone-overlay-gap=var(--lr-space-xs)] - Gap between the overlay icon and text.
 * @cssprop [--lr-drop-zone-accept-border-color=var(--lr-color-success)] - Border color of
 * `[part="overlay"][data-drag-state="accept"]`.
 * @cssprop [--lr-drop-zone-accept-bg=color-mix(in srgb, var(--lr-color-success) 12%, transparent)] -
 * Background of `[part="overlay"][data-drag-state="accept"]`.
 * @cssprop [--lr-drop-zone-reject-border-color=var(--lr-color-danger)] - Border color of
 * `[part="overlay"][data-drag-state="reject"]`.
 * @cssprop [--lr-drop-zone-reject-bg=color-mix(in srgb, var(--lr-color-danger) 12%, transparent)] -
 * Background of `[part="overlay"][data-drag-state="reject"]`.
 * @status experimental
 * @since 16.0.0
 */
export class LyraDropZone extends LyraElement<LyraDropZoneEventMap> {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    dropzoneRejectedType: LYRA_DEFAULT_dropzoneRejectedType,
    dropzoneReleaseToAdd: LYRA_DEFAULT_dropzoneReleaseToAdd,
    fieldRequired: LYRA_DEFAULT_fieldRequired,
    fileInputAcceptedMany: LYRA_DEFAULT_fileInputAcceptedMany,
    fileInputAcceptedOne: LYRA_DEFAULT_fileInputAcceptedOne,
    fileInputFolderRejected: LYRA_DEFAULT_fileInputFolderRejected,
    fileInputRejectedCount: LYRA_DEFAULT_fileInputRejectedCount,
    fileInputRejectedLimit: LYRA_DEFAULT_fileInputRejectedLimit,
    fileInputRejectedMany: LYRA_DEFAULT_fileInputRejectedMany,
    fileInputRejectedMaxFiles: LYRA_DEFAULT_fileInputRejectedMaxFiles,
    fileInputRejectedMaxTotalSize: LYRA_DEFAULT_fileInputRejectedMaxTotalSize,
    fileInputRejectedOne: LYRA_DEFAULT_fileInputRejectedOne,
    fileInputRejectedRead: LYRA_DEFAULT_fileInputRejectedRead,
    fileInputRejectedSize: LYRA_DEFAULT_fileInputRejectedSize,
    fileInputRejectedType: LYRA_DEFAULT_fileInputRejectedType,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  protected static override readonly immutableEventDetails = Object.freeze([
    'lr-files',
  ]);

  static override styles = [LyraElement.styles, styles, srOnly];

  /** Disables drag/drop handling entirely; the wrapped content keeps its own interactivity. */
  @property({ type: Boolean, reflect: true }) disabled = false;
  /** Accepts more than one file per drop, and enables recursive folder-drop traversal -- same
   *  contract as `lr-file-input`'s `multiple`. Unlike `lr-file-input`, this defaults to `true`:
   *  a region wrapper's typical use (dropping several files onto a chat surface) expects more than
   *  one file, and there is no native single-file picker here to keep in sync. */
  @property({ type: Boolean, reflect: true, converter: trueDefaultBooleanConverter }) multiple = true;
  /** Native-`accept`-style allowlist (`".csv,.xlsx"`, `"image/*"`, comma-separated mixes) --
   *  identical parsing to `lr-file-input`'s `accept`, via the same `matchesAccept()`. */
  @property() accept = '';
  /** Largest accepted file size in bytes. `0` (the default) disables the check -- identical
   *  contract to `lr-file-input`'s `maxFileSize`, including its invalid-override fallback. */
  @property({ type: Number, attribute: 'max-file-size' }) maxFileSize = 0;
  /** Largest number of files accepted per drop, counting `heldFileCount` plus the current drop's
   *  files. `0` (the default) disables the check -- identical contract to `lr-file-input`'s
   *  `maxFiles`. Since this component retains nothing of its own between drops, the count would
   *  otherwise always cover only the current drop -- `heldFileCount` is what lets a cumulative cap
   *  span separate drops. */
  @property({ type: Number, attribute: 'max-files' }) maxFiles = 0;
  /** Largest combined byte size accepted per drop, summing `heldTotalSize` plus the current
   *  drop's files. `0` (the default) disables the check -- identical contract to
   *  `lr-file-input`'s `maxTotalSize`. */
  @property({ type: Number, attribute: 'max-total-size' }) maxTotalSize = 0;
  /** Externally held file count added to the running count `maxFiles` evaluates against --
   *  identical contract to `lr-file-input`'s `heldFileCount`, letting a cumulative, server-backed
   *  cap span separate drops onto this region. `0` (the default) means "nothing held" and
   *  reproduces prior behavior exactly. A negative, `NaN`, or `Infinity` value is normalized to
   *  `0` via `finiteCount`. */
  @property({ type: Number, attribute: 'held-file-count' }) heldFileCount = 0;
  /** Externally held byte total added to the running size `maxTotalSize` evaluates against --
   *  identical contract to `lr-file-input`'s `heldTotalSize`. */
  @property({ type: Number, attribute: 'held-total-size' }) heldTotalSize = 0;

  @state() private dragState: DropSessionState = 'default';
  @state() private rejectedFiles: readonly LyraDropZoneRejectedFile[] = Object.freeze([]);
  @state() private resultStatus = '';

  private readonly internals: ElementInternals;
  private readonly dropSession: DropSessionController;
  private politeSink?: AnnouncementSink;
  private assertiveSink?: AnnouncementSink;
  /** False until the first render has committed, so mounting never announces a resting state. */
  private announcementsArmed = false;

  constructor() {
    super();
    this.internals = attachInternalsSafely(this);
    this.dropSession = new DropSessionController(this, {
      isDisabled: () => this.disabled,
      previewRejects: (items) => this.classify(items as unknown as File[], true).rejected.length > 0,
      onStateChange: () => {
        this.dragState = this.dropSession.state;
        setCustomState(this.internals, 'dragging', this.dropSession.dragging);
      },
    });
  }

  /** Readonly state derived from the current drag session.
   * @default false */
  get dragging(): boolean {
    return this.dragState !== 'default';
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    super.willUpdate(changed);
    if (changed.has('disabled') && this.disabled) this.dropSession.reset();
  }

  override connectedCallback(): void {
    super.connectedCallback();
    // Acquired on connect, not on the first announcement: assistive tech has to have been
    // observing a live region *before* text arrives for the change to be announced at all, and a
    // drag can start in the same task this element is appended in.
    this.politeSink ??= acquireAnnouncementSink('polite', {
      document: this.ownerDocument,
      source: this,
    });
    this.assertiveSink ??= acquireAnnouncementSink('assertive', {
      document: this.ownerDocument,
      source: this,
    });
  }

  override disconnectedCallback(): void {
    this.politeSink?.release();
    this.politeSink = undefined;
    this.assertiveSink?.release();
    this.assertiveSink = undefined;
    // Re-arm so a reconnect never replays the state it disconnected holding. The drag session
    // itself is reset automatically: `DropSessionController.hostDisconnected()`.
    this.announcementsArmed = false;
    super.disconnectedCallback();
  }

  // Untyped `PropertyValues` (not `PropertyValues<this>`): the announced transitions are tracked
  // on private `@state()` fields, which `keyof this` does not include.
  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    if (this.announcementsArmed) {
      if (changed.has('dragState') && this.dragState !== 'default') {
        this.politeSink?.announce(this.overlayText());
      }
      if (changed.has('resultStatus') && this.resultStatus) this.politeSink?.announce(this.resultStatus);
      if (changed.has('rejectedFiles') && this.rejectedFiles.length > 0) {
        this.assertiveSink?.announce(
          this.rejectedFiles.map((rejected) => this.rejectionMessage(rejected)).join(' '),
        );
      }
    }
    this.announcementsArmed = true;
  }

  /** `maxFileSize` normalized exactly like `lr-file-input`'s `effectiveMaxFileSize`. */
  private get effectiveMaxFileSize(): number | null {
    const maxFileSize = this.maxFileSize;
    if (maxFileSize === 0 || maxFileSize === Infinity) return null;
    return finiteRange(maxFileSize > 0 ? maxFileSize : NaN, DEFAULT_MAX_FILE_SIZE_BYTES, 1);
  }

  /** `maxFiles` normalized exactly like `lr-file-input`'s `effectiveMaxFiles`. */
  private get effectiveMaxFiles(): number | null {
    const maxFiles = this.maxFiles;
    if (maxFiles === 0 || maxFiles === Infinity) return null;
    return finiteRange(maxFiles > 0 ? maxFiles : NaN, DEFAULT_MAX_FILES, 1);
  }

  /** `maxTotalSize` normalized exactly like `lr-file-input`'s `effectiveMaxTotalSize`. */
  private get effectiveMaxTotalSize(): number | null {
    const maxTotalSize = this.maxTotalSize;
    if (maxTotalSize === 0 || maxTotalSize === Infinity) return null;
    return finiteRange(maxTotalSize > 0 ? maxTotalSize : NaN, DEFAULT_MAX_TOTAL_SIZE_BYTES, 1);
  }

  private isAllowed(file: File, isPreview = false): 'ok' | 'type' | 'size' {
    // Same preview caveats as `lr-file-input`'s `isAllowed()`: during dragenter preview, `.name`
    // and `.size` aren't available on the synthetic `DataTransferItem`-cast objects, so an
    // extension-only `accept` pattern is treated as a possible match rather than a guaranteed
    // reject, and the size check naturally never fires (`undefined > number` is always `false`).
    if (this.accept && !matchesAccept(file, this.accept, isPreview)) return 'type';
    const maxFileSize = this.effectiveMaxFileSize;
    if (maxFileSize !== null && file.size > maxFileSize) return 'size';
    return 'ok';
  }

  private classify(
    fileList: File[],
    isPreview = false,
  ): {
    files: File[];
    rejected: LyraDropZoneRejectedFile[];
    remainingFiles: number | null;
    remainingTotalSize: number | null;
  } {
    const limits = { maxFiles: this.effectiveMaxFiles, maxTotalSize: this.effectiveMaxTotalSize };
    // This component retains nothing of its own between drops -- the running total always starts
    // from `heldFileCount`/`heldTotalSize` alone, the externally held baseline the host reports.
    const tracker = new AggregateFileLimitTracker(
      finiteCount(this.heldFileCount, 0),
      finiteCount(this.heldTotalSize, 0),
    );
    if (!this.multiple && fileList.length > 1) {
      return {
        files: [],
        rejected: fileList.map((file) => ({ file, reason: 'count' as const })),
        ...tracker.allowance(limits),
      };
    }
    const files: File[] = [];
    const rejected: LyraDropZoneRejectedFile[] = [];
    for (const f of fileList) {
      const reason = this.isAllowed(f, isPreview);
      if (reason !== 'ok') {
        rejected.push({ file: f, reason });
        continue;
      }
      const limitReason = tracker.evaluate(f, limits);
      if (limitReason) {
        rejected.push({ file: f, reason: limitReason });
        continue;
      }
      files.push(f);
    }
    return { files, rejected, ...tracker.allowance(limits) };
  }

  private rejectionMessage(rejected: LyraDropZoneRejectedFile): string {
    const filename = rejected.file.name;
    switch (rejected.reason) {
      case 'type':
        return this.localize('fileInputRejectedType', undefined, { filename });
      case 'size':
        return this.localize('fileInputRejectedSize', undefined, { filename });
      case 'count':
        return this.localize('fileInputRejectedCount', undefined, { filename });
      case 'directory':
        return this.localize('fileInputFolderRejected', undefined, { filename });
      case 'read':
        return this.localize('fileInputRejectedRead', undefined, { filename });
      case 'limit':
        return this.localize('fileInputRejectedLimit', undefined, { filename });
      case 'maxFiles':
        return this.localize('fileInputRejectedMaxFiles', undefined, { filename });
      case 'maxTotalSize':
        return this.localize('fileInputRejectedMaxTotalSize', undefined, { filename });
    }
  }

  private emitFiles(fileList: File[], additionalRejected: readonly LyraDropZoneRejectedFile[] = []): void {
    const { files, rejected, remainingFiles, remainingTotalSize } = this.classify(fileList);
    rejected.push(...additionalRejected);
    const rejectedSnapshot = Object.freeze(rejected.map((item) => Object.freeze({ ...item })));
    const filesSnapshot = Object.freeze([...files]);
    this.rejectedFiles = rejectedSnapshot;
    const messages: string[] = [];
    const numberFormat = getNumberFormat(this.effectiveLocale);
    if (files.length) {
      messages.push(
        this.localize(
          files.length === 1 ? 'fileInputAcceptedOne' : 'fileInputAcceptedMany',
          undefined,
          { count: numberFormat.format(files.length) },
        ),
      );
    }
    if (rejected.length) {
      messages.push(
        this.localize(
          rejected.length === 1 ? 'fileInputRejectedOne' : 'fileInputRejectedMany',
          undefined,
          { count: numberFormat.format(rejected.length) },
        ),
      );
    }
    this.resultStatus = messages.filter((message) => message.length > 0).join(' ');
    this.emit(
      'lr-files',
      Object.freeze({ files: filesSnapshot, rejected: rejectedSnapshot, remainingFiles, remainingTotalSize }),
    );
  }

  private folderFailure(
    name: string,
    reason: 'directory' | 'read' | 'limit',
  ): LyraDropZoneRejectedFile {
    const FileCtor = this.ownerDocument.defaultView?.File ?? globalThis.File;
    return Object.freeze({ file: new FileCtor([], name), reason });
  }

  private onDragEnter = (e: DragEvent): void => this.dropSession.onDragEnter(e);
  private onDragOver = (e: DragEvent): void => this.dropSession.onDragOver(e);
  private onDragLeave = (e: DragEvent): void => this.dropSession.onDragLeave(e);

  private onDrop = (e: DragEvent): void => {
    const drop = this.dropSession.beginDrop(e);
    if (!drop) return;
    const { token, files, folders, overLimit } = drop;
    if (overLimit && this.multiple) {
      this.emitFiles([], [this.folderFailure(folders[0]?.name ?? '', 'limit')]);
      return;
    }
    if (folders.length && this.multiple) {
      void this.dropSession.readFolders(folders, token).then((result) => {
        if (!this.dropSession.isCurrent(token) || result.status === 'cancelled') return;
        if (result.status === 'error' || result.status === 'limit') {
          this.emitFiles([], [this.folderFailure(result.name, result.status === 'limit' ? 'limit' : 'read')]);
          return;
        }
        const allFiles = [...files, ...result.files];
        if (allFiles.length) this.emitFiles(allFiles);
      });
      return;
    }
    const rejectedFolders = folders.map((folder) => this.folderFailure(folder.name, 'directory'));
    if (files.length || rejectedFolders.length) this.emitFiles(files, rejectedFolders);
  };

  private overlayText(): string {
    if (this.dragState === 'accept') return this.localize('dropzoneReleaseToAdd');
    if (this.dragState === 'reject') return this.localize('dropzoneRejectedType');
    return '';
  }

  private statusText(): string {
    return this.dragState === 'default' ? this.resultStatus : this.overlayText();
  }

  override render(): TemplateResult {
    return html`
      <div
        part="base"
        @dragenter=${this.onDragEnter}
        @dragover=${this.onDragOver}
        @dragleave=${this.onDragLeave}
        @drop=${this.onDrop}
      >
        <slot></slot>
        <div part="overlay" data-drag-state=${this.dragState} ?hidden=${!this.dragging} aria-hidden="true">
          <span part="overlay-icon">${fileIcon()}</span>
          <span part="overlay-text"><slot name="overlay">${this.overlayText()}</slot></span>
        </div>
      </div>
      <div part="status" class="sr-only" aria-hidden="true">${this.statusText()}</div>
      ${this.rejectedFiles.length
        ? html`
            <div part="rejection">
              <ul>
                ${this.rejectedFiles.map((r) => html`<li>${this.rejectionMessage(r)}</li>`)}
              </ul>
            </div>
          `
        : nothing}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-drop-zone': LyraDropZone;
  }
}
