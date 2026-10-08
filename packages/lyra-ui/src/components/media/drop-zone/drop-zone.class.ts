import { eventCollectionSupport } from '../../../internal/collection-snapshot.js';
import { html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { srOnly } from '../../../internal/a11y.js';
import { acquireAnnouncementSink, type AnnouncementSink } from '../../../internal/announcer.js';
import { attachInternalsSafely } from '../../../internal/element-internals.js';
import { setCustomState } from '../../../internal/custom-states.js';
import { getNumberFormat } from '../../../internal/intl-cache.js';
import { fileIcon } from '../../../internal/icons.js';
import { falseDefaultBooleanConverter } from '../../../internal/converters.js';
import {
  DropSessionController,
  type DropSessionState,
} from '../../../internal/drop-session-controller.js';
import {
  classifyFiles, EMPTY_MIME_TYPES, freezeDetail, handleDrop, mimeTypeFilter, outcomeText, snapshotMimeTypes,
  type FileIntakeResult,
} from '../file-input/file-intake.js';
import type { LyraSize } from '../../../internal/variants.js';
import { styles } from './drop-zone.styles.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_collapse, LYRA_DEFAULT_copy, LYRA_DEFAULT_details, LYRA_DEFAULT_dropzoneRejectedType, LYRA_DEFAULT_dropzoneReleaseToAdd, LYRA_DEFAULT_fileInputAcceptedMany, LYRA_DEFAULT_fileInputAcceptedOne, LYRA_DEFAULT_fileInputFolderRejected, LYRA_DEFAULT_fileInputRejectedCount, LYRA_DEFAULT_fileInputRejectedLimit, LYRA_DEFAULT_fileInputRejectedMany, LYRA_DEFAULT_fileInputRejectedMaxFiles, LYRA_DEFAULT_fileInputRejectedMaxTotalSize, LYRA_DEFAULT_fileInputRejectedOne, LYRA_DEFAULT_fileInputRejectedRead, LYRA_DEFAULT_fileInputRejectedSize, LYRA_DEFAULT_fileInputRejectedType, LYRA_DEFAULT_loading, LYRA_DEFAULT_map, LYRA_DEFAULT_navigation, LYRA_DEFAULT_open, LYRA_DEFAULT_search, LYRA_DEFAULT_select } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END

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
 * text size. Retuned per `size` tier; the documented default is the `m`/`medium` tier.
 * @cssprop [--lr-drop-zone-overlay-icon-size=var(--lr-font-size-xl)] - `[part="overlay-icon"]`
 * glyph size. Retuned per `size` tier.
 * @cssprop [--lr-drop-zone-overlay-padding=var(--lr-space-l)] - `[part="overlay"]` padding.
 * Retuned per `size` tier; the documented default is the `m`/`medium` tier.
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
    collapse: LYRA_DEFAULT_collapse,
    copy: LYRA_DEFAULT_copy,
    details: LYRA_DEFAULT_details,
    dropzoneRejectedType: LYRA_DEFAULT_dropzoneRejectedType,
    dropzoneReleaseToAdd: LYRA_DEFAULT_dropzoneReleaseToAdd,
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
    loading: LYRA_DEFAULT_loading,
    map: LYRA_DEFAULT_map,
    navigation: LYRA_DEFAULT_navigation,
    open: LYRA_DEFAULT_open,
    search: LYRA_DEFAULT_search,
    select: LYRA_DEFAULT_select,
  };
  // GENERATED DEFAULT-STRING SLICE: END
  protected static override collectionSupport = eventCollectionSupport;

  protected static override readonly immutableEventDetails = Object.freeze([
    'lr-files',
  ]);

  static override styles = [LyraElement.styles, styles, srOnly];

  /** Disables drag/drop handling entirely; the wrapped content keeps its own interactivity. */
  @property({ type: Boolean, reflect: true }) disabled = false;
  /** Accepts more than one file per drop, and enables recursive folder-drop traversal -- same
   *  contract as `lr-file-input`'s `multiple`. Defaults to `false`; opt in for batches or folders. */
  @property({ type: Boolean, reflect: true, converter: falseDefaultBooleanConverter }) multiple = false;
  /** Native-`accept`-style allowlist (`".csv,.xlsx"`, `"image/*"`, comma-separated mixes) --
   *  identical parsing to `lr-file-input`'s `accept`, via the same `matchesAccept()`. */
  @property() accept = '';
  /** Exact MIME allowlist, identical to `lr-file-input`'s; read as a bounded snapshot on each drop. */
  @property({ attribute: false }) allowedMimeTypes: readonly string[] = EMPTY_MIME_TYPES;
  /** Exact MIME denylist, evaluated before `allowedMimeTypes`. */
  @property({ attribute: false }) forbiddenMimeTypes: readonly string[] = EMPTY_MIME_TYPES;
  /** Message announced after an accepted drop; `{count}` becomes the accepted-file count.
   *  `undefined` uses the localized default; any supplied string, including `''`, is caller-owned. */
  @property({ attribute: 'accepted-message' }) acceptedMessage?: string;
  /** Message announced after rejected files; `{count}` becomes the rejected-file count.
   *  `undefined` uses the localized default; any supplied string, including `''`, is caller-owned. */
  @property({ attribute: 'rejected-message' }) rejectedMessage?: string;
  /** Largest accepted file size in bytes. `0` (the default) disables the check -- identical
   *  contract to `lr-file-input`'s `maxFileSize`, including its invalid-override fallback. */
  // numeric-guard-exempt: normalized by classifyFiles() in file-intake.ts
  @property({ type: Number, attribute: 'max-file-size' }) maxFileSize = 0;
  /** Largest number of files accepted per drop, counting `heldFileCount` plus the current drop's
   *  files. `0` (the default) disables the check -- identical contract to `lr-file-input`'s
   *  `maxFiles`. Since this component retains nothing of its own between drops, the count would
   *  otherwise always cover only the current drop -- `heldFileCount` is what lets a cumulative cap
   *  span separate drops. */
  // numeric-guard-exempt: normalized by classifyFiles() in file-intake.ts
  @property({ type: Number, attribute: 'max-files' }) maxFiles = 0;
  /** Largest combined byte size accepted per drop, summing `heldTotalSize` plus the current
   *  drop's files. `0` (the default) disables the check -- identical contract to
   *  `lr-file-input`'s `maxTotalSize`. */
  // numeric-guard-exempt: normalized by classifyFiles() in file-intake.ts
  @property({ type: Number, attribute: 'max-total-size' }) maxTotalSize = 0;
  /** Externally held file count added to the running count `maxFiles` evaluates against --
   *  identical contract to `lr-file-input`'s `heldFileCount`, letting a cumulative, server-backed
   *  cap span separate drops onto this region. `0` (the default) means "nothing held" and
   *  reproduces prior behavior exactly. A negative, `NaN`, or `Infinity` value is normalized to
   *  `0` via `finiteCount`. */
  // numeric-guard-exempt: normalized by classifyFiles() in file-intake.ts
  @property({ type: Number, attribute: 'held-file-count' }) heldFileCount = 0;
  /** Externally held byte total added to the running size `maxTotalSize` evaluates against --
   *  identical contract to `lr-file-input`'s `heldTotalSize`. */
  // numeric-guard-exempt: normalized by classifyFiles() in file-intake.ts
  @property({ type: Number, attribute: 'held-total-size' }) heldTotalSize = 0;
  /** Density tier for the overlay's padding, icon and instructional text -- identical contract and
   *  scale to `lr-file-input`'s own `size`, so a small-tier drop-zone can match a neighboring
   *  small-tier `lr-file-input` in the same dense layout. */
  @property({ reflect: true }) size: LyraSize = 'm';

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

  private classify(fileList: File[], isPreview = false): FileIntakeResult {
    return classifyFiles(
      this, fileList, this.multiple, [], isPreview,
      mimeTypeFilter(snapshotMimeTypes(this.allowedMimeTypes), snapshotMimeTypes(this.forbiddenMimeTypes)),
    );
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
    const detail = freezeDetail(this.classify(fileList), additionalRejected);
    const { files, rejected } = detail;
    this.rejectedFiles = rejected;
    const messages: string[] = [];
    const numberFormat = getNumberFormat(this.effectiveLocale);
    if (files.length) {
      const count = numberFormat.format(files.length);
      const key = files.length === 1 ? 'fileInputAcceptedOne' : 'fileInputAcceptedMany';
      messages.push(outcomeText(this.acceptedMessage, () => this.localize(key, undefined, { count }), count));
    }
    if (rejected.length) {
      const count = numberFormat.format(rejected.length);
      const key = rejected.length === 1 ? 'fileInputRejectedOne' : 'fileInputRejectedMany';
      messages.push(outcomeText(this.rejectedMessage, () => this.localize(key, undefined, { count }), count));
    }
    this.resultStatus = messages.filter((message) => message.length > 0).join(' ');
    this.emit('lr-files', detail);
  }

  private onDragEnter = (e: DragEvent): void => this.dropSession.onDragEnter(e);
  private onDragOver = (e: DragEvent): void => this.dropSession.onDragOver(e);
  private onDragLeave = (e: DragEvent): void => this.dropSession.onDragLeave(e);

  private onDrop = (e: DragEvent): void =>
    handleDrop(this, this.dropSession, e, this.multiple, (files, rejected) => this.emitFiles(files, rejected));

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
