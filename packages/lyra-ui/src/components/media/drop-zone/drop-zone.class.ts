import type { LyraMessageKey } from '../../../internal/localization-types.js';
import { eventCollectionSupport } from '../../../internal/collection-snapshot.js';
import { html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { property, query, state } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { srOnly } from '../../../internal/a11y.js';
import { AnnouncementSinkController } from '../../../internal/announcer.js';
import { attachInternalsSafely } from '../../../internal/element-internals.js';
import { setCustomState } from '../../../internal/custom-states.js';
import { fileIcon } from '../../../internal/icons.js';
import { falseDefaultBooleanConverter } from '../../../internal/converters.js';
import { subscribeInheritedAttributes } from '../../../internal/inherited-attribute-hub.js';
import {
  DropSessionController,
  type DropSessionState,
} from '../../../internal/drop-session-controller.js';
import {
  classifyFiles, dragInstruction, EMPTY_MIME_TYPES, freezeDetail, handleDrop, mimeTypeFilter, rejectionMessages, selectionMessage, snapshotMimeTypes,
  type FileIntakeResult,
} from '../file-input/file-intake.js';
import type { LyraSize } from '../../../internal/variants.js';
import { styles } from './drop-zone.styles.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_dropzoneRejectedType, LYRA_DEFAULT_dropzoneReleaseToAdd, LYRA_DEFAULT_fileInputAcceptedMany, LYRA_DEFAULT_fileInputAcceptedOne, LYRA_DEFAULT_fileInputFolderRejected, LYRA_DEFAULT_fileInputRejectedCount, LYRA_DEFAULT_fileInputRejectedLimit, LYRA_DEFAULT_fileInputRejectedMany, LYRA_DEFAULT_fileInputRejectedMaxFiles, LYRA_DEFAULT_fileInputRejectedMaxTotalSize, LYRA_DEFAULT_fileInputRejectedOne, LYRA_DEFAULT_fileInputRejectedRead, LYRA_DEFAULT_fileInputRejectedSize, LYRA_DEFAULT_fileInputRejectedType, LYRA_DEFAULT_fileInputRejectionsMore } from '../../../internal/default-strings/media.generated.js';
import { LYRA_DEFAULT_collapse, LYRA_DEFAULT_copy, LYRA_DEFAULT_date, LYRA_DEFAULT_details, LYRA_DEFAULT_loading, LYRA_DEFAULT_map, LYRA_DEFAULT_open } from '../../../internal/default-strings/shared.generated.js';
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
 * **Targeting an existing region.** Instead of wrapping, the zone can sit beside a region that is
 * already in the page: set `for` to the region's id (resolved in the zone's own root, like a
 * label's `for`) or `target` to the element itself. The zone then attaches its drag listeners to
 * that element, lays its overlay over the element's box, adds no box of its own (`display:
 * contents`) and still emits `lr-files` from itself. Static markup keeps its layout tree, and the
 * definition can load after first paint. A `for` id that matches nothing binds nothing and is
 * re-resolved when the root's elements or ids change.
 *
 * The drag-session mechanics (nested-depth tracking, accept/reject preview, legacy File System API
 * folder traversal) are the exact ones `lr-file-input` uses, shared through
 * `internal/drop-session-controller.ts` rather than reimplemented here.
 *
 * @customElement lr-drop-zone
 * @slot - The wrapped region. Rendered as ordinary light DOM content; this element adds only the
 * drag listeners and the overlay layered on top. Not a drop target while `for`/`target` resolves to
 * an element.
 * @slot overlay - Custom drag-over overlay content, overriding the localized accept/reject text.
 * @event lr-files - Frozen `detail: { files, rejected, remainingFiles, remainingTotalSize }` with
 * detached readonly sequences and rejected-file records, fired on drop.
 * `remainingFiles`/`remainingTotalSize` report the allowance still left under `maxFiles`/
 * `maxTotalSize` after this drop (`null` while that limit is unset). Immutable `File` items retain
 * identity. Typed as {@linkcode LyraDropZoneFilesEvent}, so
 * `event.target`/`event.currentTarget` are `LyraDropZone` without a cast.
 * @csspart base - The wrapping element wrapping the default slot and the overlay.
 * @csspart overlay - The drag-over overlay, layered above the slotted content (or, while targeting,
 * fixed over the target's box). Hidden outside an active drag session.
 * @csspart overlay-icon - The default decorative overlay icon.
 * @csspart overlay-text - Wrapper around the overlay slot/text content.
 * @csspart status - The visually-hidden, `aria-hidden` mirror of the drag accept/reject state and
 * accepted/rejected counts. The announcement itself lands in the shared light-DOM polite region
 * (`acquireAnnouncementSink()` in `internal/announcer.ts`); this part is a styling/inspection
 * surface only.
 * @csspart rejection - The visible region listing the first 20 rejected files alongside their
 * reason, rendered in addition to the sr-only `status` summary.
 * @cssstate dragging - Matches during an active file drag session.
 * @cssstate targeted - Matches while `for`/`target` resolves to an element the zone is attached to.
 * @cssprop [--lr-drop-zone-overlay-z-index=var(--lr-layer-dropdown)] - Stacking order of the overlay while attached to a `for`/`target` element.
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
    date: LYRA_DEFAULT_date,
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
    fileInputRejectionsMore: LYRA_DEFAULT_fileInputRejectionsMore,
    loading: LYRA_DEFAULT_loading,
    map: LYRA_DEFAULT_map,
    open: LYRA_DEFAULT_open,
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
  /** Id of an existing element, in this zone's own root, to attach to instead of the default slot:
   *  the zone handles drags over that element and lays its overlay over it, so a server-rendered
   *  region becomes a drop target without being wrapped. An id that matches nothing binds nothing;
   *  it is re-resolved when elements or ids in the root change. `target` takes precedence. */
  @property() for = '';
  /** An element to attach to directly, taking precedence over `for` while it is connected. Same
   *  behavior as `for`; property only. */
  @property({ attribute: false }) target: Element | null = null;

  @query('[part="overlay"]') private overlayEl?: HTMLElement;
  /** The element the drag listeners are currently attached to, if any. */
  private boundTarget?: Element;
  private stopObservingRoot?: () => void;

  @state() private dragState: DropSessionState = 'default';
  @state() private rejectedFiles: readonly LyraDropZoneRejectedFile[] = Object.freeze([]);
  @state() private resultStatus = '';

  private readonly internals: ElementInternals;
  private readonly dropSession: DropSessionController;
  private readonly announcements = new AnnouncementSinkController(this, { eager: ['polite', 'assertive'] });
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

  /** Readonly state derived from the current drag session. Assignment is ignored, so a framework
   * binding that spreads every property cannot throw.
   * @default false */
  get dragging(): boolean {
    return this.dragState !== 'default';
  }
  set dragging(_value: boolean) {
    // Derived from the drag session.
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    super.willUpdate(changed);
    if (changed.has('disabled') && this.disabled) this.dropSession.reset();
    if (changed.has('for') || changed.has('target')) {
      this.syncTarget();
      this.observeRoot();
    }
  }

  private resolveTarget(): Element | undefined {
    if (!this.isConnected) return undefined;
    if (this.target?.isConnected) return this.target;
    if (!this.for) return undefined;
    const root = this.getRootNode() as Document | ShadowRoot;
    return root.getElementById?.(this.for) ?? undefined;
  }

  /** Moves the drag listeners to whichever element `target`/`for` resolves to now. */
  private syncTarget(): void {
    const next = this.resolveTarget();
    const previous = this.boundTarget;
    if (next === previous) return;
    if (previous) {
      previous.removeEventListener('dragenter', this.onTargetDragEnter);
      previous.removeEventListener('dragover', this.onTargetDragOver);
      previous.removeEventListener('dragleave', this.onTargetDragLeave);
      previous.removeEventListener('drop', this.onTargetDrop);
    }
    // A drop clears the overlay before its folder traversal finishes.
    this.dropSession.reset();
    this.boundTarget = next;
    if (next) {
      next.addEventListener('dragenter', this.onTargetDragEnter);
      next.addEventListener('dragover', this.onTargetDragOver);
      next.addEventListener('dragleave', this.onTargetDragLeave);
      next.addEventListener('drop', this.onTargetDrop);
    }
    setCustomState(this.internals, 'targeted', next !== undefined);
  }

  /** Watches the zone's root for element and id changes while `for`/`target` is set, so a region
   *  rendered after the zone (or replaced) is picked up. */
  private observeRoot(): void {
    this.stopObservingRoot?.();
    this.stopObservingRoot = undefined;
    if (!this.isConnected || (!this.for && !this.target)) return;
    const root = this.getRootNode();
    this.stopObservingRoot = subscribeInheritedAttributes(root, this.ownerDocument.defaultView?.MutationObserver, {
      attributes: ['id'],
      childList: true,
      changed: () => this.syncTarget(),
    });
  }

  /** Lays the fixed overlay over the target's border box. A transformed or filtered ancestor makes
   *  itself the containing block of a fixed box, so the box's actual origin is measured first and
   *  subtracted rather than assumed to be the viewport's. */
  private positionTargetOverlay(): void {
    const overlay = this.overlayEl;
    const target = this.boundTarget;
    if (!overlay || !target || overlay.hidden) return;
    const rect = target.getBoundingClientRect();
    overlay.style.left = '0px';
    overlay.style.top = '0px';
    const origin = overlay.getBoundingClientRect();
    overlay.style.left = `${rect.left - origin.left}px`;
    overlay.style.top = `${rect.top - origin.top}px`;
    overlay.style.width = `${rect.width}px`;
    overlay.style.height = `${rect.height}px`;
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.syncTarget();
    this.observeRoot();
  }

  override adoptedCallback(): void {
    super.adoptedCallback();
    this.announcements.adopted();
  }

  override disconnectedCallback(): void {
    this.stopObservingRoot?.();
    this.stopObservingRoot = undefined;
    this.syncTarget();
    // Re-arm so a reconnect never replays the state it disconnected holding. The drag session
    // itself is reset automatically: `DropSessionController.hostDisconnected()`.
    this.announcementsArmed = false;
    super.disconnectedCallback();
  }

  // Untyped `PropertyValues` (not `PropertyValues<this>`): the announced transitions are tracked
  // on private `@state()` fields, which `keyof this` does not include.
  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    if (changed.has('dragState')) this.positionTargetOverlay();
    if (this.announcementsArmed) {
      if (changed.has('dragState') && this.dragState !== 'default') {
        this.announcements.announcePolite(dragInstruction(this.dragState, this.intakeMessage));
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

  private readonly intakeMessage = (key: LyraMessageKey, values?: Record<string, number | string>): string =>
    this.localize(key, undefined, values);

  private emitFiles(fileList: File[], additionalRejected: readonly LyraDropZoneRejectedFile[] = []): void {
    const detail = freezeDetail(this.classify(fileList), additionalRejected);
    const { rejected } = detail;
    this.rejectedFiles = rejected;
    this.resultStatus = selectionMessage(detail, this.effectiveLocale, this.intakeMessage, this.acceptedMessage, this.rejectedMessage);
    if (this.resultStatus) this.announcements.announcePolite(this.resultStatus);
    if (rejected.length > 0) this.announcements.announceAssertive(rejectionMessages(rejected, this.effectiveLocale, this.intakeMessage).join(' '));
    this.emit('lr-files', detail);
  }

  // The default slot is not a drop target while a `for`/`target` element is bound, so a zone placed
  // inside its own target never counts one drag twice.
  private onDragEnter = (e: DragEvent): void => {
    if (!this.boundTarget) this.dropSession.onDragEnter(e);
  };
  private onDragOver = (e: DragEvent): void => {
    if (!this.boundTarget) this.dropSession.onDragOver(e);
  };
  private onDragLeave = (e: DragEvent): void => {
    if (!this.boundTarget) this.dropSession.onDragLeave(e);
  };
  private onDrop = (e: DragEvent): void => {
    if (!this.boundTarget) this.handleDropEvent(e);
  };

  private onTargetDragEnter = (e: Event): void => this.dropSession.onDragEnter(e as DragEvent);
  private onTargetDragOver = (e: Event): void => {
    this.dropSession.onDragOver(e as DragEvent);
    // dragover repeats while the pointer moves, so the overlay follows a region that scrolls or
    // resizes mid-drag.
    this.positionTargetOverlay();
  };
  private onTargetDragLeave = (e: Event): void => this.dropSession.onDragLeave(e as DragEvent);
  private onTargetDrop = (e: Event): void => this.handleDropEvent(e as DragEvent);

  private handleDropEvent(e: DragEvent): void {
    handleDrop(this, this.dropSession, e, this.multiple, (files, rejected) => this.emitFiles(files, rejected));
  }

  private statusText(): string {
    return this.dragState === 'default' ? this.resultStatus : dragInstruction(this.dragState, this.intakeMessage);
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
          <span part="overlay-text"><slot name="overlay">${dragInstruction(this.dragState, this.intakeMessage)}</slot></span>
        </div>
      </div>
      <div part="status" class="sr-only" aria-hidden="true">${this.statusText()}</div>
      ${this.rejectedFiles.length
        ? html`
            <div part="rejection">
              <ul>
                ${rejectionMessages(this.rejectedFiles, this.effectiveLocale, this.intakeMessage).map((message) => html`<li>${message}</li>`)}
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
